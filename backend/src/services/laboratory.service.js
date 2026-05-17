const {
  AuditLog,
  Charge,
  Encounter,
  LabOrder,
  LabResult,
  LabResultItem,
  Order,
  Patient,
  Specimen,
} = require('../models');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const permissionService = require('./permission.service');
const notificationService = require('./notification.service');
const {
  ABNORMAL_FLAG,
  ABNORMAL_FLAGS,
  CHARGE_STATUS,
  LAB_ORDER_STATUS,
  LAB_RESULT_STATUS,
  ORDER_STATUS,
  RESULT_ITEM_STATUS,
  SPECIMEN_STATUS,
} = require('../constants/statuses');
const {
  LAB_ORDER_TRANSITIONS,
  LAB_RESULT_TRANSITIONS,
  ORDER_TRANSITIONS,
  SPECIMEN_TRANSITIONS,
} = require('../constants/transitions');
const { PERMISSION } = require('../constants/permissions');
const { assertTransition, canTransition } = require('../shared/utils/status-transition');
const { withOptionalTransaction } = require('../shared/utils/transaction');
const ERROR_CODE = require('../common/errors/error-codes');

const LAB_ORDER_TERMINAL_STATUSES = [
  LAB_ORDER_STATUS.COMPLETED,
  LAB_ORDER_STATUS.CANCELLED,
  LAB_ORDER_STATUS.REJECTED,
];

const RESULT_TERMINAL_STATUSES = [
  LAB_RESULT_STATUS.CANCELLED,
  LAB_RESULT_STATUS.ENTERED_IN_ERROR,
];

const CRITICAL_FLAGS = [
  ABNORMAL_FLAG.CRITICAL_LOW,
  ABNORMAL_FLAG.CRITICAL_HIGH,
];

const FINAL_RESULT_STATUSES = [
  LAB_RESULT_STATUS.FINAL,
  LAB_RESULT_STATUS.AMENDED,
];

const RESULT_SPECIMEN_FINALIZABLE_STATUSES = [
  SPECIMEN_STATUS.RECEIVED,
  SPECIMEN_STATUS.IN_TESTING,
  SPECIMEN_STATUS.STORED,
];

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function sameId(left, right) {
  return String(left?._id || left || '') === String(right?._id || right || '');
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes.filter(Boolean));
}

function normalizeString(value) {
  return String(value || '').trim();
}

function nonEmpty(value) {
  return normalizeString(value).length > 0;
}

function hasOnlyFinalResultAccess(actor = {}) {
  return hasPermission(actor, PERMISSION.LAB_RESULTS.READ_FINAL)
    && !hasAnyPermission(actor, [
      PERMISSION.SYSTEM.FULL_ACCESS,
      PERMISSION.LAB_RESULTS.READ,
      PERMISSION.LAB_ORDERS.READ,
    ]);
}

function isFinalResultStatus(status) {
  return FINAL_RESULT_STATUSES.includes(status);
}

function applyFinalOnlyResultFilter(filter) {
  if (filter.status && !FINAL_RESULT_STATUSES.includes(filter.status)) {
    throw createError('Quyền hiện tại chỉ được xem lab result final/amended.', 403);
  }
  filter.status = { $in: FINAL_RESULT_STATUSES };
}

function ensureEnum(value, allowedValues, fieldName) {
  if (value !== undefined && value !== null && value !== '' && !allowedValues.includes(value)) {
    throw createError(`${fieldName} không hợp lệ.`);
  }
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`);
  return date;
}

function assertActorUser(actor = {}) {
  if (!actor?.userId) throw createError('Actor hiện tại không phải staff user hợp lệ.', 403);
}

function assertStaffPermission(actor, permissions, message = 'Bạn không có quyền thao tác laboratory.') {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (!hasAnyPermission(actor, Array.isArray(permissions) ? permissions : [permissions])) {
    throw createError(message, 403);
  }
  return true;
}

function assertPatientActive(patient) {
  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (patient.status !== 'active') throw createError('Bệnh nhân không active.', 409);
}

async function recordLaboratoryFailure({ actor, action, targetType, targetId, requestMeta, error, metadata = {} }) {
  try {
    await recordAuditLog({
      actor,
      action,
      targetType,
      targetId,
      status: 'failure',
      message: error?.message || 'Laboratory action failed.',
      requestMeta,
      metadata: {
        ...metadata,
        error_name: error?.name,
        error_code: error?.code,
      },
    });
  } catch (_) {
    // Best-effort audit must not mask the original business error.
  }
}

function laboratoryFailureAuditContext(methodName, args = []) {
  const configs = {
    acknowledgeLabOrder: { action: 'lab_order.acknowledged', targetType: 'lab_order', targetIndex: 0, actorIndex: 1, requestMetaIndex: 2 },
    cancelLabOrder: { action: 'lab_order.cancelled', targetType: 'lab_order', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    createSpecimen: { action: 'specimen.created', targetType: 'lab_order', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    collectSpecimen: { action: 'specimen.collected', targetType: 'specimen', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    receiveSpecimen: { action: 'specimen.received', targetType: 'specimen', targetIndex: 0, actorIndex: 1, requestMetaIndex: 2 },
    rejectSpecimen: { action: 'specimen.rejected', targetType: 'specimen', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    processSpecimen: { action: 'specimen.in_testing', targetType: 'specimen', targetIndex: 0, actorIndex: 1, requestMetaIndex: 2 },
    storeSpecimen: { action: 'specimen.stored', targetType: 'specimen', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    disposeSpecimen: { action: 'specimen.disposed', targetType: 'specimen', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    createLabResult: { action: 'lab_result.created', targetType: 'lab_order', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    updateLabResult: { action: 'lab_result.updated', targetType: 'lab_result', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    finalizeLabResult: { action: 'lab_result.finalized', targetType: 'lab_result', targetIndex: 0, actorIndex: 1, requestMetaIndex: 2 },
    amendLabResult: { action: 'lab_result.amended', targetType: 'lab_result', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    cancelLabResult: { action: 'lab_result.cancelled', targetType: 'lab_result', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    markLabResultEnteredInError: { action: 'lab_result.entered_in_error', targetType: 'lab_result', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    createLabResultItem: { action: 'lab_result_item.created', targetType: 'lab_result', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    updateLabResultItem: { action: 'lab_result_item.updated', targetType: 'lab_result_item', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    removeLabResultItem: { action: 'lab_result_item.removed', targetType: 'lab_result_item', targetIndex: 0, actorIndex: 1, requestMetaIndex: 2 },
    acknowledgeCriticalLabResult: { action: 'lab_result.critical_acknowledged', targetType: 'lab_result', targetIndex: 0, actorIndex: 1, requestMetaIndex: 2 },
    releaseLabResultToPatient: { action: 'lab_result.released_to_patient', targetType: 'lab_result', targetIndex: 0, actorIndex: 1, requestMetaIndex: 2 },
  };
  const config = configs[methodName];
  if (!config) return null;
  return {
    action: config.action,
    targetType: config.targetType,
    targetId: args[config.targetIndex],
    actor: args[config.actorIndex],
    requestMeta: args[config.requestMetaIndex],
  };
}

function withLaboratoryFailureAudits(serviceExports) {
  return Object.fromEntries(Object.entries(serviceExports).map(([methodName, method]) => {
    if (typeof method !== 'function') return [methodName, method];
    const config = laboratoryFailureAuditContext(methodName, []);
    if (!config) return [methodName, method];
    return [methodName, async (...args) => {
      try {
        return await method(...args);
      } catch (error) {
        const context = laboratoryFailureAuditContext(methodName, args);
        await recordLaboratoryFailure({
          actor: context.actor,
          action: context.action,
          targetType: context.targetType,
          targetId: context.targetId,
          requestMeta: context.requestMeta,
          error,
        });
        throw error;
      }
    }];
  }));
}

async function generateSpecimenNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.SPECIMEN, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

async function generateLabResultNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.LAB_RESULT, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

async function getLabOrderOrThrow(labOrderId, session = null) {
  const labOrder = await withSession(LabOrder.findById(labOrderId), session);
  if (!labOrder) throw createError('Không tìm thấy lab order.', 404);
  return labOrder;
}

async function getSpecimenOrThrow(specimenId, session = null) {
  const specimen = await withSession(Specimen.findById(specimenId), session);
  if (!specimen) throw createError('Không tìm thấy specimen.', 404);
  return specimen;
}

async function getLabResultOrThrow(resultId, session = null) {
  const result = await withSession(LabResult.findById(resultId), session);
  if (!result) throw createError('Không tìm thấy lab result.', 404);
  return result;
}

async function loadLabOrderContext(labOrder, session = null) {
  const [order, encounter, patient] = await Promise.all([
    withSession(Order.findById(labOrder.order_id).lean(), session),
    withSession(Encounter.findById(labOrder.encounter_id).lean(), session),
    withSession(Patient.findById(labOrder.patient_id).lean(), session),
  ]);

  if (!order) throw createError('Không tìm thấy order mẹ của lab order.', 409);
  if (!encounter) throw createError('Không tìm thấy encounter của lab order.', 409);
  assertPatientActive(patient);

  return { order, encounter, patient };
}

async function loadResultContext(result, session = null) {
  const labOrder = await withSession(LabOrder.findById(result.lab_order_id), session);
  if (!labOrder) throw createError('Không tìm thấy lab order của result.', 409);
  const context = await loadLabOrderContext(labOrder, session);
  return { labOrder, ...context };
}

function assertLabOrderAccess(labOrder, context, actor = {}, permissions = {}) {
  if (!actorType(actor)) return true;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;

  if (actorType(actor) === 'patient') {
    if (sameId(labOrder.patient_id, actor.patientId || actor.patient_id)) return true;
    throw createError('Bạn không có quyền xem dữ liệu xét nghiệm này.', 403);
  }

  if (hasAnyPermission(actor, permissions.global || []) && !actorDepartmentId(actor)) return true;

  if (
    actor.userId
    && (
      sameId(labOrder.ordered_by, actor.userId)
      || sameId(context?.encounter?.attending_doctor_id, actor.userId)
      || sameId(context?.order?.ordered_by, actor.userId)
    )
    && hasAnyPermission(actor, permissions.own || [])
  ) {
    return true;
  }

  const departmentId = actorDepartmentId(actor);
  if (
    departmentId
    && (
      sameId(context?.order?.department_id, departmentId)
      || sameId(context?.encounter?.department_id, departmentId)
    )
    && hasAnyPermission(actor, permissions.department || [])
  ) {
    return true;
  }

  throw createError('Bạn không có quyền thao tác lab order này.', 403);
}

function assertEncounterReadAccess(encounter, actor = {}) {
  if (!actorType(actor)) return true;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  const departmentId = actorDepartmentId(actor);
  if (!departmentId && hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.READ, PERMISSION.ORDERS.READ, PERMISSION.LAB_ORDERS.READ])) return true;
  if (actor.userId && sameId(encounter.attending_doctor_id, actor.userId) && hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.ORDERS.READ_OWN, PERMISSION.LAB_ORDERS.READ_OWN])) return true;
  if (departmentId && sameId(encounter.department_id, departmentId) && hasAnyPermission(actor, [
    PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    PERMISSION.ORDERS.READ_DEPARTMENT,
    PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
    PERMISSION.ENCOUNTERS.READ,
    PERMISSION.ORDERS.READ,
    PERMISSION.LAB_ORDERS.READ,
  ])) return true;
  throw createError('Bạn không có quyền xem lab summary của encounter này.', 403);
}

function readAccessPermissions() {
  return {
    global: [
      PERMISSION.LAB_ORDERS.READ,
      PERMISSION.LAB_RESULTS.READ,
      PERMISSION.ORDERS.READ,
      PERMISSION.ORDERS.READ_LAB,
    ],
    own: [
      PERMISSION.LAB_ORDERS.READ_OWN,
      PERMISSION.ORDERS.READ_OWN,
      PERMISSION.ENCOUNTERS.READ_OWN,
    ],
    department: [
      PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
      PERMISSION.ORDERS.READ_DEPARTMENT,
      PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
      PERMISSION.LAB_ORDERS.READ,
      PERMISSION.LAB_RESULTS.READ,
      PERMISSION.ORDERS.READ,
      PERMISSION.ORDERS.READ_LAB,
      PERMISSION.ENCOUNTERS.READ,
    ],
  };
}

function writeAccessPermissions(extra = []) {
  return {
    global: [...extra],
    own: [PERMISSION.LAB_ORDERS.READ_OWN],
    department: [PERMISSION.LAB_ORDERS.READ_DEPARTMENT, PERMISSION.LAB_ORDERS.READ, PERMISSION.ORDERS.READ_LAB, ...extra],
  };
}

async function buildScopedOrderIds(query = {}, actor = {}) {
  const orderFilter = { order_type: 'lab' };
  if (query.department_id) orderFilter.department_id = query.department_id;
  const departmentId = actorDepartmentId(actor);
  const canUseGlobalRead = hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)
    || (hasAnyPermission(actor, [
      PERMISSION.LAB_ORDERS.READ,
      PERMISSION.ORDERS.READ,
      PERMISSION.ORDERS.READ_LAB,
    ]) && !departmentId);
  if (actorType(actor) && !canUseGlobalRead) {
    if (actor.userId && hasAnyPermission(actor, [PERMISSION.LAB_ORDERS.READ_OWN, PERMISSION.ORDERS.READ_OWN])) {
      orderFilter.ordered_by = actor.userId;
    } else if (departmentId && hasAnyPermission(actor, [PERMISSION.LAB_ORDERS.READ_DEPARTMENT, PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.LAB_ORDERS.READ, PERMISSION.ORDERS.READ_LAB])) {
      if (orderFilter.department_id && !sameId(orderFilter.department_id, departmentId)) {
        throw createError('Bạn không có quyền xem lab order khoa khác.', 403);
      }
      orderFilter.department_id = departmentId;
    } else {
      throw createError('Bạn không có quyền xem danh sách lab order.', 403);
    }
  }

  if (orderFilter.department_id || orderFilter.ordered_by) {
    const orders = await Order.find(orderFilter).select('_id').lean();
    return orders.map((order) => order._id);
  }

  return null;
}

function applyDateRange(filter, query = {}, fieldName) {
  if (query.date_from || query.date_to) {
    filter[fieldName] = {};
    if (query.date_from) filter[fieldName].$gte = parseDate(query.date_from, 'date_from');
    if (query.date_to) filter[fieldName].$lte = parseDate(query.date_to, 'date_to');
  }
}

async function listLabOrders(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  for (const field of ['status', 'priority', 'patient_id', 'encounter_id', 'ordered_by', 'test_code', 'test_name']) {
    if (query[field]) filter[field] = query[field];
  }
  applyDateRange(filter, query, 'ordered_at');

  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [
      { lab_order_no: { $regex: keyword, $options: 'i' } },
      { test_name: { $regex: keyword, $options: 'i' } },
      { test_code: { $regex: keyword, $options: 'i' } },
    ];
  }

  const scopedOrderIds = await buildScopedOrderIds(query, actor);
  if (scopedOrderIds) filter.order_id = { $in: scopedOrderIds };

  const [items, total] = await Promise.all([
    LabOrder.find(filter)
      .sort({ ordered_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('encounter_id', 'encounter_code encounter_type status start_time')
      .populate('ordered_by', 'full_name username employee_code')
      .populate('order_id', 'order_no status priority department_id ordered_at')
      .lean(),
    LabOrder.countDocuments(filter),
  ]);

  return { items, pagination: buildPagination(page, limit, total) };
}

function getAllowedLabOrderActions(labOrder, actor = {}) {
  return {
    can_acknowledge: labOrder.status === LAB_ORDER_STATUS.ORDERED && hasAnyPermission(actor, [PERMISSION.LAB_ORDERS.ACKNOWLEDGE, PERMISSION.ORDERS.ACKNOWLEDGE]),
    can_collect: labOrder.status === LAB_ORDER_STATUS.ORDERED && hasAnyPermission(actor, [PERMISSION.LAB_ORDERS.COLLECT, PERMISSION.SPECIMENS.COLLECT]),
    can_cancel: !LAB_ORDER_TERMINAL_STATUSES.includes(labOrder.status) && hasAnyPermission(actor, [PERMISSION.LAB_ORDERS.CANCEL, PERMISSION.ORDERS.CANCEL]),
    can_create_result: [LAB_ORDER_STATUS.RECEIVED, LAB_ORDER_STATUS.IN_PROGRESS].includes(labOrder.status) && hasPermission(actor, PERMISSION.LAB_RESULTS.CREATE),
  };
}

async function getLabOrderDetail(labOrderId, actor = {}) {
  const labOrder = await LabOrder.findById(labOrderId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time')
    .populate('ordered_by', 'full_name username employee_code')
    .populate('order_id', 'order_no status priority department_id ordered_at clinical_indication charge_id')
    .lean();
  if (!labOrder) throw createError('Không tìm thấy lab order.', 404);

  const rawLabOrder = await LabOrder.findById(labOrderId).lean();
  const context = await loadLabOrderContext(rawLabOrder);
  assertLabOrderAccess(rawLabOrder, context, actor, readAccessPermissions());

  const [specimens, results, charge, logs] = await Promise.all([
    Specimen.find({ lab_order_id: labOrderId }).sort({ created_at: 1 }).lean(),
    LabResult.find({ lab_order_id: labOrderId }).sort({ reported_at: -1, created_at: -1 }).lean(),
    Charge.findOne({ order_id: context.order._id }).lean(),
    AuditLog.find({
      $or: [
        { target_type: 'lab_order', target_id: labOrderId },
        { target_type: 'order', target_id: context.order._id },
      ],
    }).sort({ created_at: -1 }).limit(20).lean(),
  ]);

  return {
    lab_order: labOrder,
    specimens,
    results,
    charge,
    activity: logs,
    allowed_actions: getAllowedLabOrderActions(rawLabOrder, actor),
  };
}

async function updateOrderStatus(orderId, nextStatus, actor, session = null) {
  const order = await withSession(Order.findById(orderId), session);
  if (!order) throw createError('Không tìm thấy order mẹ.', 409);
  if (order.status === nextStatus) return order;
  assertTransition(ORDER_TRANSITIONS, order.status, nextStatus, 'order');
  order.status = nextStatus;
  order.updated_by = actor?.userId;
  await order.save(sessionOptions(session));
  return order;
}

async function updateLabOrderStatus(labOrder, nextStatus, actor, session = null, extra = {}) {
  if (labOrder.status === nextStatus) return labOrder;
  assertTransition(LAB_ORDER_TRANSITIONS, labOrder.status, nextStatus, 'lab_order');
  labOrder.status = nextStatus;
  if (nextStatus === LAB_ORDER_STATUS.COLLECTED) labOrder.collected_at = extra.collected_at || labOrder.collected_at || new Date();
  if (nextStatus === LAB_ORDER_STATUS.COMPLETED) labOrder.completed_at = extra.completed_at || labOrder.completed_at || new Date();
  labOrder.updated_by = actor?.userId;
  await labOrder.save(sessionOptions(session));
  return labOrder;
}

async function acknowledgeLabOrder(labOrderId, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.LAB_ORDERS.ACKNOWLEDGE, PERMISSION.ORDERS.ACKNOWLEDGE]);
  let orderId;
  await withOptionalTransaction(async (session) => {
    const labOrder = await getLabOrderOrThrow(labOrderId, session);
    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_ORDERS.ACKNOWLEDGE, PERMISSION.ORDERS.ACKNOWLEDGE]));
    if (labOrder.status !== LAB_ORDER_STATUS.ORDERED) throw createError('Chỉ lab order ordered mới được acknowledge.', 409);
    await updateOrderStatus(labOrder.order_id, ORDER_STATUS.ACKNOWLEDGED, actor, session);
    orderId = labOrder.order_id;
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'lab_order.acknowledged',
    targetType: 'lab_order',
    targetId: labOrderId,
    status: 'success',
    message: 'Lab order đã được acknowledge.',
    requestMeta,
    metadata: { order_id: String(orderId || '') },
  });
  return getLabOrderDetail(labOrderId, actor);
}

async function voidChargeForLabOrder(orderId, reason, actor, session = null) {
  const charges = await withSession(Charge.find({
    order_id: orderId,
    status: { $nin: [CHARGE_STATUS.VOIDED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.REFUNDED] },
  }), session);

  for (const charge of charges) {
    if (charge.invoice_id || charge.status === CHARGE_STATUS.BILLED) {
      throw createError('Lab order đã có charge lên invoice, cần Billing Module xử lý adjustment.', 409);
    }
    charge.status = CHARGE_STATUS.VOIDED;
    charge.voided_by = actor?.userId;
    charge.voided_at = new Date();
    charge.void_reason = reason;
    charge.updated_by = actor?.userId;
    await charge.save(sessionOptions(session));
  }
  return charges.length;
}

async function cancelLabOrder(labOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.LAB_ORDERS.CANCEL, PERMISSION.ORDERS.CANCEL]);
  const reason = payload.reason || payload.cancel_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi hủy lab order.');

  let voidedCharges = 0;
  await withOptionalTransaction(async (session) => {
    const labOrder = await getLabOrderOrThrow(labOrderId, session);
    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_ORDERS.CANCEL, PERMISSION.ORDERS.CANCEL]));
    if (LAB_ORDER_TERMINAL_STATUSES.includes(labOrder.status)) throw createError('Lab order đã ở trạng thái kết thúc.', 409);
    const hasFinalResult = await withSession(LabResult.exists({
      lab_order_id: labOrder._id,
      status: { $in: [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED] },
    }), session);
    if (hasFinalResult) throw createError('Lab order đã có result final/amended, không thể hủy thường.', 409);

    if (labOrder.status === LAB_ORDER_STATUS.IN_PROGRESS && !payload.force) {
      throw createError('Lab order đang in_progress, cần force/override để hủy.', 409);
    }

    voidedCharges = await voidChargeForLabOrder(labOrder.order_id, reason, actor, session);
    await updateLabOrderStatus(labOrder, LAB_ORDER_STATUS.CANCELLED, actor, session);
    await updateOrderStatus(labOrder.order_id, ORDER_STATUS.CANCELLED, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'lab_order.cancelled',
    targetType: 'lab_order',
    targetId: labOrderId,
    status: 'success',
    message: 'Hủy lab order thành công.',
    requestMeta,
    metadata: { reason, voided_charges: voidedCharges },
  });
  return getLabOrderDetail(labOrderId, actor);
}

function validateSpecimenPayload(payload = {}) {
  if (!nonEmpty(payload.specimen_type)) throw createError('specimen_type là bắt buộc.');
  return {
    specimen_type: normalizeString(payload.specimen_type),
    container_type: payload.container_type ? normalizeString(payload.container_type) : undefined,
    storage_location: payload.storage_location ? normalizeString(payload.storage_location) : undefined,
    collected_at: parseDate(payload.collected_at, 'collected_at'),
  };
}

async function createSpecimen(labOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SPECIMENS.CREATE, PERMISSION.LAB_ORDERS.COLLECT]);
  const normalized = validateSpecimenPayload(payload);
  let specimenId;
  await withOptionalTransaction(async (session) => {
    const labOrder = await getLabOrderOrThrow(labOrderId, session);
    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.CREATE, PERMISSION.LAB_ORDERS.COLLECT]));
    if (![LAB_ORDER_STATUS.ORDERED, LAB_ORDER_STATUS.COLLECTED].includes(labOrder.status)) {
      throw createError('Chỉ lab order ordered/collected mới được tạo specimen.', 409);
    }
    const activeSpecimenExists = await withSession(Specimen.exists({
      lab_order_id: labOrder._id,
      status: { $nin: [SPECIMEN_STATUS.REJECTED, SPECIMEN_STATUS.DISPOSED] },
    }), session);
    if (activeSpecimenExists) {
      throw createError('Lab order đã có specimen active. Giai đoạn hiện tại chỉ hỗ trợ 1 specimen cho 1 lab order.', 409);
    }

    const isCollected = Boolean(payload.mark_collected || normalized.collected_at);
    const specimenNo = payload.specimen_no || await generateSpecimenNumber({ session });
    const [specimen] = await Specimen.create([{
      lab_order_id: labOrder._id,
      patient_id: labOrder.patient_id,
      specimen_no: specimenNo,
      specimen_type: normalized.specimen_type,
      container_type: normalized.container_type,
      storage_location: normalized.storage_location,
      collected_by: isCollected ? actor?.userId : undefined,
      collected_at: isCollected ? (normalized.collected_at || new Date()) : undefined,
      status: isCollected ? SPECIMEN_STATUS.COLLECTED : SPECIMEN_STATUS.PLANNED,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    specimenId = specimen._id;

    if (isCollected && labOrder.status === LAB_ORDER_STATUS.ORDERED) {
      await updateLabOrderStatus(labOrder, LAB_ORDER_STATUS.COLLECTED, actor, session, { collected_at: specimen.collected_at });
      await updateOrderStatus(labOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'specimen.created',
    targetType: 'specimen',
    targetId: specimenId,
    status: 'success',
    message: 'Tạo specimen thành công.',
    requestMeta,
    metadata: { lab_order_id: String(labOrderId) },
  });
  return getSpecimenDetail(specimenId, actor);
}

async function collectSpecimen(targetId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SPECIMENS.COLLECT, PERMISSION.LAB_ORDERS.COLLECT]);
  let specimenId;

  await withOptionalTransaction(async (session) => {
    let specimen = await withSession(Specimen.findById(targetId), session);
    let labOrder;
    if (specimen) {
      labOrder = await getLabOrderOrThrow(specimen.lab_order_id, session);
    } else {
      labOrder = await getLabOrderOrThrow(targetId, session);
      specimen = await withSession(Specimen.findOne({
        lab_order_id: labOrder._id,
        status: SPECIMEN_STATUS.PLANNED,
      }).sort({ created_at: 1 }), session);
      if (!specimen) {
        const specimenPayload = validateSpecimenPayload({ ...payload, specimen_type: payload.specimen_type || labOrder.specimen_type || labOrder.test_name });
        const specimenNo = payload.specimen_no || await generateSpecimenNumber({ session });
        [specimen] = await Specimen.create([{
          lab_order_id: labOrder._id,
          patient_id: labOrder.patient_id,
          specimen_no: specimenNo,
          specimen_type: specimenPayload.specimen_type,
          container_type: specimenPayload.container_type,
          storage_location: specimenPayload.storage_location,
          status: SPECIMEN_STATUS.PLANNED,
          created_by: actor?.userId,
          updated_by: actor?.userId,
        }], sessionOptions(session));
      }
    }

    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.COLLECT, PERMISSION.LAB_ORDERS.COLLECT]));
    if (labOrder.status !== LAB_ORDER_STATUS.ORDERED) throw createError('Chỉ lab order ordered mới được collect specimen.', 409);
    if (specimen.status !== SPECIMEN_STATUS.PLANNED) throw createError('Chỉ specimen planned mới được collect.', 409);
    assertTransition(SPECIMEN_TRANSITIONS, specimen.status, SPECIMEN_STATUS.COLLECTED, 'specimen');

    specimen.status = SPECIMEN_STATUS.COLLECTED;
    specimen.collected_by = actor?.userId;
    specimen.collected_at = parseDate(payload.collected_at, 'collected_at') || new Date();
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));
    specimenId = specimen._id;

    await updateLabOrderStatus(labOrder, LAB_ORDER_STATUS.COLLECTED, actor, session, { collected_at: specimen.collected_at });
    await updateOrderStatus(labOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'specimen.collected',
    targetType: 'specimen',
    targetId: specimenId,
    status: 'success',
    message: 'Collect specimen thành công.',
    requestMeta,
  });
  return getSpecimenDetail(specimenId, actor);
}

async function getSpecimenDetail(specimenId, actor = {}) {
  const specimen = await Specimen.findById(specimenId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('lab_order_id', 'lab_order_no test_name status order_id encounter_id ordered_by')
    .populate('collected_by', 'full_name username employee_code')
    .populate('received_by', 'full_name username employee_code')
    .populate('rejected_by', 'full_name username employee_code')
    .lean();
  if (!specimen) throw createError('Không tìm thấy specimen.', 404);

  const rawLabOrder = await LabOrder.findById(specimen.lab_order_id?._id || specimen.lab_order_id).lean();
  const context = await loadLabOrderContext(rawLabOrder);
  assertLabOrderAccess(rawLabOrder, context, actor, readAccessPermissions());
  return { specimen };
}

async function receiveSpecimen(specimenId, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.SPECIMENS.RECEIVE);
  await withOptionalTransaction(async (session) => {
    const specimen = await getSpecimenOrThrow(specimenId, session);
    const labOrder = await getLabOrderOrThrow(specimen.lab_order_id, session);
    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.RECEIVE]));
    assertTransition(SPECIMEN_TRANSITIONS, specimen.status, SPECIMEN_STATUS.RECEIVED, 'specimen');
    if (labOrder.status !== LAB_ORDER_STATUS.COLLECTED) throw createError('Lab order phải ở trạng thái collected trước khi receive.', 409);

    specimen.status = SPECIMEN_STATUS.RECEIVED;
    specimen.received_by = actor?.userId;
    specimen.received_at = new Date();
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));
    await updateLabOrderStatus(labOrder, LAB_ORDER_STATUS.RECEIVED, actor, session);
    await updateOrderStatus(labOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'specimen.received', targetType: 'specimen', targetId: specimenId, status: 'success', message: 'Receive specimen thành công.', requestMeta });
  return getSpecimenDetail(specimenId, actor);
}

async function rejectSpecimen(specimenId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.SPECIMENS.REJECT);
  const reason = payload.reason || payload.rejection_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi reject specimen.');

  let labOrderId;
  await withOptionalTransaction(async (session) => {
    const specimen = await getSpecimenOrThrow(specimenId, session);
    const labOrder = await getLabOrderOrThrow(specimen.lab_order_id, session);
    labOrderId = labOrder._id;
    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.REJECT]));
    assertTransition(SPECIMEN_TRANSITIONS, specimen.status, SPECIMEN_STATUS.REJECTED, 'specimen');

    specimen.status = SPECIMEN_STATUS.REJECTED;
    specimen.rejected_by = actor?.userId;
    specimen.rejected_at = new Date();
    specimen.rejection_reason = reason;
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));

    const activeSpecimenCount = await withSession(Specimen.countDocuments({
      lab_order_id: labOrder._id,
      status: { $nin: [SPECIMEN_STATUS.REJECTED, SPECIMEN_STATUS.DISPOSED] },
    }), session);
    if (activeSpecimenCount === 0 && canTransition(LAB_ORDER_TRANSITIONS, labOrder.status, LAB_ORDER_STATUS.REJECTED)) {
      await updateLabOrderStatus(labOrder, LAB_ORDER_STATUS.REJECTED, actor, session);
      await updateOrderStatus(labOrder.order_id, ORDER_STATUS.CANCELLED, actor, session);
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'specimen.rejected',
    targetType: 'specimen',
    targetId: specimenId,
    status: 'success',
    message: 'Reject specimen thành công.',
    requestMeta,
    metadata: { lab_order_id: String(labOrderId || ''), reason },
  });
  return getSpecimenDetail(specimenId, actor);
}

async function processSpecimen(specimenId, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SPECIMENS.PROCESS, PERMISSION.LAB_ORDERS.PROCESS]);
  await withOptionalTransaction(async (session) => {
    const specimen = await getSpecimenOrThrow(specimenId, session);
    const labOrder = await getLabOrderOrThrow(specimen.lab_order_id, session);
    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.PROCESS, PERMISSION.LAB_ORDERS.PROCESS]));
    assertTransition(SPECIMEN_TRANSITIONS, specimen.status, SPECIMEN_STATUS.IN_TESTING, 'specimen');
    if (labOrder.status !== LAB_ORDER_STATUS.RECEIVED) throw createError('Lab order phải received trước khi process specimen.', 409);

    specimen.status = SPECIMEN_STATUS.IN_TESTING;
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));
    await updateLabOrderStatus(labOrder, LAB_ORDER_STATUS.IN_PROGRESS, actor, session);
    await updateOrderStatus(labOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'specimen.in_testing', targetType: 'specimen', targetId: specimenId, status: 'success', message: 'Process specimen thành công.', requestMeta });
  return getSpecimenDetail(specimenId, actor);
}

async function storeSpecimen(specimenId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.SPECIMENS.STORE);
  await withOptionalTransaction(async (session) => {
    const specimen = await getSpecimenOrThrow(specimenId, session);
    const labOrder = await getLabOrderOrThrow(specimen.lab_order_id, session);
    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.STORE]));
    assertTransition(SPECIMEN_TRANSITIONS, specimen.status, SPECIMEN_STATUS.STORED, 'specimen');
    specimen.status = SPECIMEN_STATUS.STORED;
    if (payload.storage_location !== undefined) specimen.storage_location = normalizeString(payload.storage_location);
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({ actor, action: 'specimen.stored', targetType: 'specimen', targetId: specimenId, status: 'success', message: 'Store specimen thành công.', requestMeta });
  return getSpecimenDetail(specimenId, actor);
}

async function disposeSpecimen(specimenId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.SPECIMENS.DISPOSE);
  const reason = payload.reason || payload.dispose_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi dispose specimen.');
  await withOptionalTransaction(async (session) => {
    const specimen = await getSpecimenOrThrow(specimenId, session);
    const labOrder = await getLabOrderOrThrow(specimen.lab_order_id, session);
    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.DISPOSE]));
    if (specimen.status === SPECIMEN_STATUS.IN_TESTING && !payload.force) {
      throw createError('Không được dispose specimen đang in_testing nếu không có force policy.', 409);
    }
    assertTransition(SPECIMEN_TRANSITIONS, specimen.status, SPECIMEN_STATUS.DISPOSED, 'specimen');
    specimen.status = SPECIMEN_STATUS.DISPOSED;
    specimen.disposed_by = actor?.userId;
    specimen.disposed_at = new Date();
    specimen.dispose_reason = reason;
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({ actor, action: 'specimen.disposed', targetType: 'specimen', targetId: specimenId, status: 'success', message: 'Dispose specimen thành công.', requestMeta, metadata: { reason } });
  return getSpecimenDetail(specimenId, actor);
}

function validateResultItemPayload(item = {}, options = {}) {
  if (!nonEmpty(item.item_name)) throw createError('item_name là bắt buộc.');
  const hasTextValue = item.result_value !== undefined && item.result_value !== null && nonEmpty(item.result_value);
  const hasNumericValue = item.numeric_value !== undefined && item.numeric_value !== null && item.numeric_value !== '' && Number.isFinite(Number(item.numeric_value));
  if (!hasTextValue && !hasNumericValue) throw createError('result_value hoặc numeric_value là bắt buộc.');
  ensureEnum(item.abnormal_flag, ABNORMAL_FLAGS, 'abnormal_flag');
  const abnormalFlag = item.abnormal_flag || calculateAbnormalFlag(item.numeric_value, item.reference_range);
  return {
    item_code: item.item_code ? normalizeString(item.item_code).toUpperCase() : undefined,
    item_name: normalizeString(item.item_name),
    result_value: item.result_value !== undefined ? normalizeString(item.result_value) : undefined,
    numeric_value: hasNumericValue ? Number(item.numeric_value) : undefined,
    unit: item.unit ? normalizeString(item.unit) : undefined,
    reference_range: item.reference_range ? normalizeString(item.reference_range) : undefined,
    abnormal_flag: abnormalFlag,
    is_critical: item.is_critical !== undefined ? Boolean(item.is_critical) : CRITICAL_FLAGS.includes(abnormalFlag),
    comment: item.comment,
    display_order: item.display_order !== undefined ? Number(item.display_order) : options.displayOrder || 0,
    status: item.status || RESULT_ITEM_STATUS.PRELIMINARY,
  };
}

function collectManualFlagItems(items = []) {
  return items
    .filter((item) => {
      if (!item.abnormal_flag || item.abnormal_flag === ABNORMAL_FLAG.UNKNOWN) return false;
      const calculated = calculateAbnormalFlag(item.numeric_value, item.reference_range);
      return calculated === ABNORMAL_FLAG.UNKNOWN || calculated !== item.abnormal_flag;
    })
    .map((item) => ({
      item_code: item.item_code,
      item_name: item.item_name,
      abnormal_flag: item.abnormal_flag,
      calculated_flag: calculateAbnormalFlag(item.numeric_value, item.reference_range),
    }));
}

function validateLabResultPayload(payload = {}) {
  return {
    specimen_id: payload.specimen_id,
    interpretation: payload.interpretation,
    notes: payload.notes,
    result_items: Array.isArray(payload.result_items)
      ? payload.result_items.map((item, index) => validateResultItemPayload(item, { displayOrder: index + 1 }))
      : [],
  };
}

async function validateLabResultCreation(labOrderId, payload = {}, actor = {}, session = null) {
  assertStaffPermission(actor, PERMISSION.LAB_RESULTS.CREATE);
  const labOrder = await getLabOrderOrThrow(labOrderId, session);
  const context = await loadLabOrderContext(labOrder, session);
  assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_RESULTS.CREATE]));
  if (![LAB_ORDER_STATUS.RECEIVED, LAB_ORDER_STATUS.IN_PROGRESS].includes(labOrder.status)) {
    throw createError('Lab order phải received/in_progress trước khi tạo result.', 409);
  }

  const normalized = validateLabResultPayload(payload);
  let specimen = null;
  if (normalized.specimen_id) {
    specimen = await withSession(Specimen.findById(normalized.specimen_id).lean(), session);
    if (!specimen || !sameId(specimen.lab_order_id, labOrder._id)) throw createError('Specimen không thuộc lab order này.', 409);
    if ([SPECIMEN_STATUS.REJECTED, SPECIMEN_STATUS.DISPOSED].includes(specimen.status)) {
      throw createError('Không tạo result cho specimen rejected/disposed.', 409);
    }
  } else {
    specimen = await withSession(Specimen.findOne({
      lab_order_id: labOrder._id,
      status: { $in: [SPECIMEN_STATUS.RECEIVED, SPECIMEN_STATUS.IN_TESTING, SPECIMEN_STATUS.STORED] },
    }).sort({ received_at: -1, created_at: -1 }).lean(), session);
    if (!specimen) throw createError('Cần specimen received/in_testing/stored trước khi tạo lab result.', 409);
    normalized.specimen_id = specimen._id;
  }

  const hasFinal = await withSession(LabResult.exists({
    lab_order_id: labOrder._id,
    is_current: { $ne: false },
    status: { $in: [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED] },
  }), session);
  if (hasFinal) throw createError('Lab order đã có result final/amended.', 409);

  return { labOrder, context, specimen, normalized };
}

async function createLabResult(labOrderId, payload = {}, actor, requestMeta = {}) {
  let resultId;
  let manualFlagItems = [];
  await withOptionalTransaction(async (session) => {
    const validation = await validateLabResultCreation(labOrderId, payload, actor, session);
    manualFlagItems = collectManualFlagItems(validation.normalized.result_items);
    const resultNo = payload.result_no || await generateLabResultNumber({ session });
    const [result] = await LabResult.create([{
      lab_order_id: validation.labOrder._id,
      specimen_id: validation.normalized.specimen_id,
      patient_id: validation.labOrder.patient_id,
      result_no: resultNo,
      performed_by: actor?.userId,
      reported_at: new Date(),
      is_current: true,
      interpretation: validation.normalized.interpretation,
      notes: validation.normalized.notes,
      status: LAB_RESULT_STATUS.PRELIMINARY,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    resultId = result._id;

    if (validation.normalized.result_items.length > 0) {
      await LabResultItem.create(validation.normalized.result_items.map((item) => ({
        ...item,
        lab_result_id: result._id,
        created_by: actor?.userId,
        updated_by: actor?.userId,
      })), sessionOptions(session));
    }

    if (validation.labOrder.status === LAB_ORDER_STATUS.RECEIVED) {
      await updateLabOrderStatus(validation.labOrder, LAB_ORDER_STATUS.IN_PROGRESS, actor, session);
    }
    await updateOrderStatus(validation.labOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'lab_result.created',
    targetType: 'lab_result',
    targetId: resultId,
    status: 'success',
    message: 'Tạo lab result thành công.',
    requestMeta,
    metadata: { lab_order_id: String(labOrderId), manual_abnormal_flags: manualFlagItems },
  });
  return getLabResultDetail(resultId, actor);
}

async function getLabResultDetail(resultId, actor = {}) {
  const result = await LabResult.findById(resultId)
    .populate('lab_order_id', 'lab_order_no order_id encounter_id test_name status')
    .populate('specimen_id', 'specimen_no specimen_type status collected_at received_at')
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('performed_by', 'full_name username employee_code')
    .populate('verified_by', 'full_name username employee_code')
    .lean();
  if (!result) throw createError('Không tìm thấy lab result.', 404);

  const rawResult = await LabResult.findById(resultId).lean();
  const { labOrder, ...context } = await loadResultContext(rawResult);
  if (actorType(actor) === 'patient') {
    if (!sameId(rawResult.patient_id, actor.patientId || actor.patient_id)) throw createError('Bạn không có quyền xem result này.', 403);
    if (!rawResult.released_to_patient || !isFinalResultStatus(rawResult.status)) {
      throw createError('Result chưa được release cho patient portal.', 403);
    }
  } else {
    if (hasOnlyFinalResultAccess(actor) && !isFinalResultStatus(rawResult.status)) {
      throw createError('Quyền hiện tại chỉ được xem lab result final/amended.', 403);
    }
    assertLabOrderAccess(labOrder, context, actor, readAccessPermissions());
  }

  const items = await LabResultItem.find({ lab_result_id: resultId })
    .sort({ display_order: 1, created_at: 1 })
    .lean();
  return { result, items };
}

async function buildScopedLabResultFilter(query = {}, actor = {}) {
  const filter = {};
  if (query.include_history !== 'true') filter.is_current = { $ne: false };
  for (const field of ['patient_id', 'lab_order_id', 'specimen_id', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  applyDateRange(filter, query, 'reported_at');

  if (query.encounter_id) {
    const labOrders = await LabOrder.find({ encounter_id: query.encounter_id }).select('_id').lean();
    filter.lab_order_id = { $in: labOrders.map((labOrder) => labOrder._id) };
  }

  if (actorType(actor) === 'patient') {
    filter.patient_id = actor.patientId || actor.patient_id;
    filter.released_to_patient = true;
    filter.status = { $in: FINAL_RESULT_STATUSES };
    return filter;
  }

  if (!actorType(actor)) return filter;
  const departmentId = actorDepartmentId(actor);
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    return filter;
  }
  if (
    !departmentId
    && hasAnyPermission(actor, [PERMISSION.LAB_RESULTS.READ, PERMISSION.LAB_ORDERS.READ, PERMISSION.ORDERS.READ_LAB])
  ) {
    if (query.include_history !== 'true') filter.is_current = { $ne: false };
    return filter;
  }

  const finalOnly = hasPermission(actor, PERMISSION.LAB_RESULTS.READ_FINAL);

  if (actor.userId && hasAnyPermission(actor, [PERMISSION.LAB_ORDERS.READ_OWN, PERMISSION.ORDERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_OWN])) {
    const labOrders = await LabOrder.find({ ordered_by: actor.userId }).select('_id').lean();
    filter.lab_order_id = { $in: labOrders.map((labOrder) => labOrder._id) };
    if (finalOnly) applyFinalOnlyResultFilter(filter);
    return filter;
  }

  if (departmentId && hasAnyPermission(actor, [
    PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
    PERMISSION.ORDERS.READ_DEPARTMENT,
    PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    PERMISSION.LAB_RESULTS.READ,
    PERMISSION.LAB_ORDERS.READ,
    PERMISSION.ORDERS.READ,
    PERMISSION.ORDERS.READ_LAB,
  ])) {
    const orders = await Order.find({ order_type: 'lab', department_id: departmentId }).select('_id').lean();
    const labOrders = await LabOrder.find({ order_id: { $in: orders.map((order) => order._id) } }).select('_id').lean();
    filter.lab_order_id = { $in: labOrders.map((labOrder) => labOrder._id) };
    if (finalOnly) applyFinalOnlyResultFilter(filter);
    return filter;
  }

  if (finalOnly && hasPermission(actor, PERMISSION.ORDERS.READ) && !departmentId) {
    applyFinalOnlyResultFilter(filter);
    return filter;
  }

  throw createError('Bạn không có quyền xem lab results.', 403);
}

async function listLabResults(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildScopedLabResultFilter(query, actor);
  const [items, total] = await Promise.all([
    LabResult.find(filter)
      .sort({ reported_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('lab_order_id', 'lab_order_no test_name status encounter_id order_id')
      .populate('specimen_id', 'specimen_no specimen_type status')
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('verified_by', 'full_name username employee_code')
      .lean(),
    LabResult.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function updateLabResult(resultId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.LAB_RESULTS.WRITE, PERMISSION.LAB_RESULTS.UPDATE_OWN]);
  await withOptionalTransaction(async (session) => {
    const result = await getLabResultOrThrow(resultId, session);
    const { labOrder, ...context } = await loadResultContext(result, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_RESULTS.WRITE, PERMISSION.LAB_RESULTS.UPDATE_OWN]));
    if (result.status !== LAB_RESULT_STATUS.PRELIMINARY) {
      throw createError('Chỉ preliminary result mới được update trực tiếp. Result final/amended phải amend.', 409);
    }
    if (!sameId(result.performed_by, actor?.userId) && !hasPermission(actor, PERMISSION.LAB_RESULTS.WRITE)) {
      throw createError('Chỉ người nhập hoặc người có quyền write mới được sửa result.', 403);
    }

    const before = result.toObject();
    if (payload.interpretation !== undefined) result.interpretation = payload.interpretation;
    if (payload.notes !== undefined) result.notes = payload.notes;
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));

    if (Array.isArray(payload.result_items)) {
      await LabResultItem.deleteMany({ lab_result_id: result._id }).session(session);
      const items = payload.result_items.map((item, index) => ({
        ...validateResultItemPayload(item, { displayOrder: index + 1 }),
        lab_result_id: result._id,
        created_by: actor?.userId,
        updated_by: actor?.userId,
      }));
      if (items.length > 0) await LabResultItem.create(items, sessionOptions(session));
    }

    await recordAuditLog({
      actor,
      action: 'lab_result.updated',
      targetType: 'lab_result',
      targetId: result._id,
      status: 'success',
      message: 'Cập nhật lab result thành công.',
      requestMeta,
      before,
      after: result.toObject(),
    });
  }, { fallbackToNoTransaction: true });

  return getLabResultDetail(resultId, actor);
}

async function validateLabResultBeforeFinalize(resultId, actor = {}, session = null) {
  assertStaffPermission(actor, PERMISSION.LAB_RESULTS.FINALIZE);
  const result = await getLabResultOrThrow(resultId, session);
  const { labOrder, ...context } = await loadResultContext(result, session);
  assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_RESULTS.FINALIZE]));
  const finalizingAmendedCompletedOrder = result.status === LAB_RESULT_STATUS.AMENDED && labOrder.status === LAB_ORDER_STATUS.COMPLETED;
  if (![LAB_ORDER_STATUS.RECEIVED, LAB_ORDER_STATUS.IN_PROGRESS].includes(labOrder.status) && !finalizingAmendedCompletedOrder) {
    throw createError('Lab order phải received/in_progress trước khi finalize result.', 409);
  }
  if (![LAB_RESULT_STATUS.PRELIMINARY, LAB_RESULT_STATUS.AMENDED].includes(result.status)) {
    throw createError('Chỉ preliminary/amended result mới được finalize.', 409);
  }
  if (!result.specimen_id) throw createError('Lab result phải gắn specimen trước khi finalize.', 409);
  const specimen = await withSession(Specimen.findById(result.specimen_id).lean(), session);
  if (!specimen || !sameId(specimen.lab_order_id, labOrder._id)) throw createError('Specimen không thuộc lab order này.', 409);
  if (!RESULT_SPECIMEN_FINALIZABLE_STATUSES.includes(specimen.status)) {
    throw createError('Specimen phải received/in_testing/stored trước khi finalize result.', 409);
  }
  const existingFinal = await withSession(LabResult.exists({
    lab_order_id: labOrder._id,
    _id: { $ne: result._id },
    is_current: { $ne: false },
    status: { $in: FINAL_RESULT_STATUSES },
  }), session);
  if (existingFinal) throw createError('Lab order đã có result final/amended khác.', 409);
  const items = await withSession(LabResultItem.find({ lab_result_id: result._id }).lean(), session);
  if (items.length === 0) throw createError('Lab result phải có ít nhất một result item trước khi finalize.', 409);
  const invalidItem = items.find((item) => !nonEmpty(item.item_name) || (!nonEmpty(item.result_value) && item.numeric_value === undefined));
  if (invalidItem) throw createError('Mỗi result item phải có item_name và result_value/numeric_value.', 409);
  const invalidNumericItem = items.find((item) => item.numeric_value !== undefined && (!nonEmpty(item.unit) || !nonEmpty(item.reference_range)));
  if (invalidNumericItem) throw createError('Result item numeric phải có unit và reference_range trước khi finalize.', 409);
  const hasCritical = items.some((item) => item.is_critical || CRITICAL_FLAGS.includes(item.abnormal_flag));
  return {
    result,
    labOrder,
    context,
    items,
    hasCritical,
    warnings: hasCritical
      ? [{ code: 'critical_result', message: 'Result có chỉ số critical, cần notify bác sĩ.' }]
      : [],
  };
}

async function finalizeLabResult(resultId, actor, requestMeta = {}) {
  let criticalDetected = false;
  await withOptionalTransaction(async (session) => {
    const validation = await validateLabResultBeforeFinalize(resultId, actor, session);
    const before = validation.result.toObject();

    validation.result.status = LAB_RESULT_STATUS.FINAL;
    validation.result.is_current = true;
    validation.result.verified_by = actor?.userId;
    validation.result.verified_at = new Date();
    validation.result.reported_at = validation.result.reported_at || new Date();
    validation.result.is_critical = validation.hasCritical;
    if (validation.hasCritical) validation.result.critical_notified_at = new Date();
    validation.result.updated_by = actor?.userId;
    await validation.result.save(sessionOptions(session));

    await LabResultItem.updateMany(
      { lab_result_id: validation.result._id },
      {
        $set: {
          status: RESULT_ITEM_STATUS.FINAL,
          updated_by: actor?.userId,
        },
      },
      sessionOptions(session),
    );

    if (validation.hasCritical) {
      await LabResultItem.updateMany(
        {
          lab_result_id: validation.result._id,
          $or: [
            { is_critical: true },
            { abnormal_flag: { $in: CRITICAL_FLAGS } },
          ],
        },
        {
          $set: {
            critical_notified_at: new Date(),
            updated_by: actor?.userId,
          },
        },
        sessionOptions(session),
      );
    }

    await updateLabOrderStatus(validation.labOrder, LAB_ORDER_STATUS.COMPLETED, actor, session, { completed_at: new Date() });
    await updateOrderStatus(validation.labOrder.order_id, ORDER_STATUS.COMPLETED, actor, session);

    if (validation.result.specimen_id) {
      const specimen = await withSession(Specimen.findById(validation.result.specimen_id), session);
      if (specimen && specimen.status === SPECIMEN_STATUS.IN_TESTING) {
        assertTransition(SPECIMEN_TRANSITIONS, specimen.status, SPECIMEN_STATUS.STORED, 'specimen');
        specimen.status = SPECIMEN_STATUS.STORED;
        specimen.updated_by = actor?.userId;
        await specimen.save(sessionOptions(session));
      }
    }

    criticalDetected = validation.warnings.length > 0;
    await recordAuditLog({
      actor,
      action: 'lab_result.finalized',
      targetType: 'lab_result',
      targetId: validation.result._id,
      status: 'success',
      message: 'Finalize lab result thành công.',
      requestMeta,
      before,
      after: validation.result.toObject(),
      metadata: { warnings: validation.warnings },
    });
    if (validation.hasCritical) {
      await recordAuditLog({
        actor,
        action: 'lab_result.critical_pending_ack',
        targetType: 'lab_result',
        targetId: validation.result._id,
        status: 'success',
        message: 'Critical lab result đang chờ acknowledge.',
        requestMeta,
        metadata: {
          lab_order_id: String(validation.labOrder._id),
          order_id: String(validation.labOrder.order_id),
          ack_required: true,
        },
      });
    }
  }, { fallbackToNoTransaction: true });

  await notifyDoctorLabResultFinal(resultId, actor, { critical: criticalDetected });
  return getLabResultDetail(resultId, actor);
}

async function amendLabResult(resultId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.LAB_RESULTS.AMEND);
  const reason = payload.reason || payload.amend_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi amend lab result.');

  let amendedResultId;
  let manualFlagItems = [];
  await withOptionalTransaction(async (session) => {
    const result = await getLabResultOrThrow(resultId, session);
    const { labOrder, ...context } = await loadResultContext(result, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_RESULTS.AMEND]));
    if (![LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED].includes(result.status)) {
      throw createError('Chỉ final/amended result mới được amend.', 409);
    }
    if (result.is_current === false) {
      throw createError('Chỉ version lab result hiện hành mới được amend.', 409);
    }
    const before = result.toObject();
    assertTransition(LAB_RESULT_TRANSITIONS, result.status, LAB_RESULT_STATUS.AMENDED, 'lab_result');

    const sourceItems = await withSession(LabResultItem.find({
      lab_result_id: result._id,
      status: { $ne: RESULT_ITEM_STATUS.CANCELLED },
    }).sort({ display_order: 1, created_at: 1 }).lean(), session);
    const nextItems = Array.isArray(payload.result_items)
      ? payload.result_items.map((item, index) => validateResultItemPayload({ ...item, status: RESULT_ITEM_STATUS.AMENDED }, { displayOrder: index + 1 }))
      : sourceItems.map((item, index) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        result_value: item.result_value,
        numeric_value: item.numeric_value,
        unit: item.unit,
        reference_range: item.reference_range,
        abnormal_flag: item.abnormal_flag,
        is_critical: item.is_critical,
        comment: item.comment,
        display_order: item.display_order || index + 1,
        status: RESULT_ITEM_STATUS.AMENDED,
      }));
    if (nextItems.length === 0) throw createError('Amend lab result phải có ít nhất một result item.', 409);
    manualFlagItems = collectManualFlagItems(nextItems);

    const isCritical = nextItems.some((item) => item.is_critical || CRITICAL_FLAGS.includes(item.abnormal_flag));
    const resultNo = payload.result_no || await generateLabResultNumber({ session });
    const duplicateResultNo = await withSession(LabResult.exists({ result_no: resultNo }), session);
    if (duplicateResultNo) throw createError('result_no đã tồn tại.', 409);
    result.is_current = false;
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));

    const [amendedResult] = await LabResult.create([{
      lab_order_id: result.lab_order_id,
      specimen_id: result.specimen_id,
      patient_id: result.patient_id,
      amended_from: result._id,
      is_current: true,
      result_no: resultNo,
      performed_by: result.performed_by || actor?.userId,
      verified_by: actor?.userId,
      verified_at: new Date(),
      reported_at: new Date(),
      released_to_patient: false,
      is_critical: isCritical,
      critical_notified_at: isCritical ? new Date() : undefined,
      amended_by: actor?.userId,
      amended_at: new Date(),
      amend_reason: reason,
      amendment_version: Number(result.amendment_version || 1) + 1,
      interpretation: payload.interpretation !== undefined ? payload.interpretation : result.interpretation,
      notes: payload.notes !== undefined ? payload.notes : result.notes,
      status: LAB_RESULT_STATUS.AMENDED,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    amendedResultId = amendedResult._id;

    await LabResultItem.create(nextItems.map((item) => ({
      ...item,
      status: RESULT_ITEM_STATUS.AMENDED,
      lab_result_id: amendedResult._id,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    })), sessionOptions(session));

    result.superseded_by = amendedResult._id;
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));

    await recordAuditLog({
      actor,
      action: 'lab_result.amended',
      targetType: 'lab_result',
      targetId: amendedResult._id,
      status: 'success',
      message: 'Amend lab result thành công.',
      requestMeta,
      before,
      after: amendedResult.toObject(),
      metadata: {
        reason,
        amended_from: String(result._id),
        amendment_version: amendedResult.amendment_version,
        manual_abnormal_flags: manualFlagItems,
      },
    });
  }, { fallbackToNoTransaction: true });

  const amendedResult = await LabResult.findById(amendedResultId).lean();
  await notifyDoctorLabResultFinal(amendedResultId, actor, { amended: true, critical: Boolean(amendedResult?.is_critical) });
  return getLabResultDetail(amendedResultId, actor);
}

async function cancelLabResult(resultId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.LAB_RESULTS.CANCEL);
  const reason = payload.reason || payload.cancel_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi cancel lab result.');

  await withOptionalTransaction(async (session) => {
    const result = await getLabResultOrThrow(resultId, session);
    const { labOrder, ...context } = await loadResultContext(result, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_RESULTS.CANCEL]));
    if (RESULT_TERMINAL_STATUSES.includes(result.status)) throw createError('Lab result đã ở trạng thái kết thúc.', 409);
    if ([LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED].includes(result.status) && !payload.force) {
      throw createError('Result final/amended cần force/override để cancel.', 409);
    }
    if (!canTransition(LAB_RESULT_TRANSITIONS, result.status, LAB_RESULT_STATUS.CANCELLED) && !payload.force) {
      assertTransition(LAB_RESULT_TRANSITIONS, result.status, LAB_RESULT_STATUS.CANCELLED, 'lab_result');
    }
    const remainingFinal = await withSession(LabResult.exists({
      lab_order_id: labOrder._id,
      _id: { $ne: result._id },
      is_current: { $ne: false },
      status: { $in: [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED] },
    }), session);
    if (!remainingFinal && labOrder.status === LAB_ORDER_STATUS.COMPLETED) {
      throw createError('Không thể cancel result final/amended cuối cùng của lab order completed bằng flow thường. Hãy dùng amend hoặc quy trình correction riêng.', 409);
    }
    result.status = LAB_RESULT_STATUS.CANCELLED;
    result.cancelled_by = actor?.userId;
    result.cancelled_at = new Date();
    result.cancel_reason = reason;
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));
    await LabResultItem.updateMany(
      { lab_result_id: result._id },
      { $set: { status: RESULT_ITEM_STATUS.CANCELLED, updated_by: actor?.userId } },
      sessionOptions(session),
    );

  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'lab_result.cancelled', targetType: 'lab_result', targetId: resultId, status: 'success', message: 'Cancel lab result thành công.', requestMeta, metadata: { reason } });
  return getLabResultDetail(resultId, actor);
}

async function markLabResultEnteredInError(resultId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.LAB_RESULTS.ENTERED_IN_ERROR);
  const reason = payload.reason || payload.entered_in_error_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi entered_in_error lab result.');

  await withOptionalTransaction(async (session) => {
    const result = await getLabResultOrThrow(resultId, session);
    const { labOrder, ...context } = await loadResultContext(result, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_RESULTS.ENTERED_IN_ERROR]));
    if (result.status === LAB_RESULT_STATUS.ENTERED_IN_ERROR) throw createError('Lab result đã entered_in_error.', 409);
    if ([LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED].includes(result.status) && !payload.force) {
      throw createError('Result final/amended cần force/override để entered_in_error.', 409);
    }
    if (!canTransition(LAB_RESULT_TRANSITIONS, result.status, LAB_RESULT_STATUS.ENTERED_IN_ERROR) && !payload.force) {
      assertTransition(LAB_RESULT_TRANSITIONS, result.status, LAB_RESULT_STATUS.ENTERED_IN_ERROR, 'lab_result');
    }
    const remainingFinal = await withSession(LabResult.exists({
      lab_order_id: labOrder._id,
      _id: { $ne: result._id },
      is_current: { $ne: false },
      status: { $in: [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED] },
    }), session);
    if (!remainingFinal && labOrder.status === LAB_ORDER_STATUS.COMPLETED) {
      throw createError('Không thể entered_in_error result final/amended cuối cùng của lab order completed bằng flow thường. Hãy dùng amend/correction để không lệch trạng thái order.', 409);
    }
    result.status = LAB_RESULT_STATUS.ENTERED_IN_ERROR;
    result.entered_in_error_by = actor?.userId;
    result.entered_in_error_at = new Date();
    result.entered_in_error_reason = reason;
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));
    await LabResultItem.updateMany(
      { lab_result_id: result._id },
      { $set: { status: RESULT_ITEM_STATUS.CANCELLED, updated_by: actor?.userId } },
      sessionOptions(session),
    );
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'lab_result.entered_in_error', targetType: 'lab_result', targetId: resultId, status: 'success', message: 'Đánh dấu lab result entered_in_error thành công.', requestMeta, metadata: { reason } });
  return getLabResultDetail(resultId, actor);
}

async function createLabResultItem(resultId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.LAB_RESULT_ITEMS.CREATE);
  let itemId;
  let manualFlagItems = [];
  await withOptionalTransaction(async (session) => {
    const result = await getLabResultOrThrow(resultId, session);
    const { labOrder, ...context } = await loadResultContext(result, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_RESULT_ITEMS.CREATE]));
    if (result.status !== LAB_RESULT_STATUS.PRELIMINARY) throw createError('Chỉ preliminary result mới được thêm item trực tiếp.', 409);
    const itemPayload = validateResultItemPayload(payload);
    manualFlagItems = collectManualFlagItems([itemPayload]);
    const [item] = await LabResultItem.create([{
      ...itemPayload,
      lab_result_id: result._id,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    itemId = item._id;
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({ actor, action: 'lab_result_item.created', targetType: 'lab_result_item', targetId: itemId, status: 'success', message: 'Tạo lab result item thành công.', requestMeta, metadata: { manual_abnormal_flags: manualFlagItems } });
  return LabResultItem.findById(itemId).lean();
}

async function updateLabResultItem(itemId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.LAB_RESULT_ITEMS.UPDATE, PERMISSION.LAB_RESULTS.WRITE]);
  let resultId;
  await withOptionalTransaction(async (session) => {
    const item = await withSession(LabResultItem.findById(itemId), session);
    if (!item) throw createError('Không tìm thấy lab result item.', 404);
    const result = await getLabResultOrThrow(item.lab_result_id, session);
    resultId = result._id;
    const { labOrder, ...context } = await loadResultContext(result, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_RESULT_ITEMS.UPDATE, PERMISSION.LAB_RESULTS.WRITE]));
    if (result.status !== LAB_RESULT_STATUS.PRELIMINARY) throw createError('Result final/amended phải amend result, không update item trực tiếp.', 409);
    const before = item.toObject();
    const itemPayload = validateResultItemPayload({ ...item.toObject(), ...payload });
    Object.assign(item, itemPayload);
    item.updated_by = actor?.userId;
    await item.save(sessionOptions(session));
    await recordAuditLog({ actor, action: 'lab_result_item.updated', targetType: 'lab_result_item', targetId: item._id, status: 'success', message: 'Cập nhật lab result item thành công.', requestMeta, before, after: item.toObject(), metadata: { lab_result_id: String(resultId), manual_abnormal_flags: collectManualFlagItems([itemPayload]) } });
  }, { fallbackToNoTransaction: true });
  return LabResultItem.findById(itemId).lean();
}

async function removeLabResultItem(itemId, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.LAB_RESULT_ITEMS.DELETE);
  await withOptionalTransaction(async (session) => {
    const item = await withSession(LabResultItem.findById(itemId), session);
    if (!item) throw createError('Không tìm thấy lab result item.', 404);
    const result = await getLabResultOrThrow(item.lab_result_id, session);
    const { labOrder, ...context } = await loadResultContext(result, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_RESULT_ITEMS.DELETE]));
    if (result.status === LAB_RESULT_STATUS.PRELIMINARY) {
      await LabResultItem.deleteOne({ _id: item._id }, sessionOptions(session));
    } else {
      item.status = RESULT_ITEM_STATUS.CANCELLED;
      item.updated_by = actor?.userId;
      await item.save(sessionOptions(session));
    }
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({ actor, action: 'lab_result_item.removed', targetType: 'lab_result_item', targetId: itemId, status: 'success', message: 'Remove lab result item thành công.', requestMeta });
  return { removed: true };
}

function calculateAbnormalFlag(numericValue, referenceRange) {
  if (numericValue === undefined || numericValue === null || numericValue === '') return ABNORMAL_FLAG.UNKNOWN;
  const value = Number(numericValue);
  if (!Number.isFinite(value)) return ABNORMAL_FLAG.UNKNOWN;
  const match = normalizeString(referenceRange).match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return ABNORMAL_FLAG.UNKNOWN;
  const low = Number(match[1]);
  const high = Number(match[2]);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return ABNORMAL_FLAG.UNKNOWN;
  if (value < low) return ABNORMAL_FLAG.LOW;
  if (value > high) return ABNORMAL_FLAG.HIGH;
  return ABNORMAL_FLAG.NORMAL;
}

async function notifyDoctorLabResultFinal(resultId, actor = {}, options = {}) {
  return notificationService.notifyLabResultFinal(resultId, actor, options);
}

async function acknowledgeCriticalLabResult(resultId, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.LAB_RESULTS.CRITICAL_ACKNOWLEDGE, PERMISSION.LAB_RESULTS.READ_FINAL]);
  await withOptionalTransaction(async (session) => {
    const result = await getLabResultOrThrow(resultId, session);
    const { labOrder, ...context } = await loadResultContext(result, session);
    assertLabOrderAccess(labOrder, context, actor, {
      global: [PERMISSION.LAB_RESULTS.CRITICAL_ACKNOWLEDGE, PERMISSION.LAB_RESULTS.READ],
      own: [PERMISSION.LAB_ORDERS.READ_OWN, PERMISSION.ORDERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_OWN],
      department: [PERMISSION.LAB_ORDERS.READ_DEPARTMENT, PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
    });
    if (!isFinalResultStatus(result.status)) throw createError('Chỉ final/amended result mới được acknowledge critical.', 409);
    const criticalItemsExist = await withSession(LabResultItem.exists({
      lab_result_id: result._id,
      status: { $ne: RESULT_ITEM_STATUS.CANCELLED },
      $or: [
        { is_critical: true },
        { abnormal_flag: { $in: CRITICAL_FLAGS } },
      ],
    }), session);
    if (!result.is_critical && !criticalItemsExist) throw createError('Lab result này không có critical flag.', 409);
    result.is_critical = true;
    result.critical_acknowledged_by = actor?.userId;
    result.critical_acknowledged_at = new Date();
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'lab_result.critical_acknowledged',
    targetType: 'lab_result',
    targetId: resultId,
    status: 'success',
    message: 'Acknowledge critical lab result thành công.',
    requestMeta,
  });
  return getLabResultDetail(resultId, actor);
}

async function releaseLabResultToPatient(resultId, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.LAB_RESULTS.RELEASE_TO_PATIENT);
  await withOptionalTransaction(async (session) => {
    const result = await getLabResultOrThrow(resultId, session);
    const { labOrder, ...context } = await loadResultContext(result, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_RESULTS.RELEASE_TO_PATIENT]));
    if (![LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED].includes(result.status)) {
      throw createError('Chỉ final/amended result mới được release cho patient.', 409, null, ERROR_CODE.LAB_RESULT_NOT_FINALIZED);
    }
    if (result.is_current === false) {
      throw createError('Không release version lab result đã bị supersede.', 409);
    }
    result.released_to_patient = true;
    result.released_at = new Date();
    result.released_by = actor?.userId;
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  const result = await LabResult.findById(resultId).lean();
  await notificationService.notifyLabResultFinal(result._id, actor, { released: true, patient_only: true });

  await recordAuditLog({ actor, action: 'lab_result.released_to_patient', targetType: 'lab_result', targetId: resultId, status: 'success', message: 'Release lab result cho patient thành công.', requestMeta });
  return getLabResultDetail(resultId, actor);
}

async function getMyLabResults(actor = {}, query = {}) {
  if (actorType(actor) !== 'patient') throw createError('Chỉ patient được gọi API này.', 403);
  if (!hasPermission(actor, PERMISSION.LAB_RESULTS.SELF_READ_RELEASED)) throw createError('Bạn không có quyền xem lab results.', 403);
  const { page, limit, skip } = getPagination(query);
  const filter = {
    patient_id: actor.patientId || actor.patient_id,
    released_to_patient: true,
    is_current: { $ne: false },
    status: { $in: [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED] },
  };
  const [items, total] = await Promise.all([
    LabResult.find(filter).sort({ reported_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    LabResult.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getEncounterLabSummary(encounterId, actor = {}) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  assertEncounterReadAccess(encounter, actor);

  const rows = await LabOrder.aggregate([
    { $match: { encounter_id: encounter._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byStatus = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row._id] = row.count;
    total += row.count;
  }
  return { encounter_id: encounterId, total_lab_orders: total, by_status: byStatus };
}

const laboratoryServiceExports = {
  // generateSpecimenNumber: Sinh/tạo mã mẫu bệnh phẩm.
  generateSpecimenNumber,
  // generateLabResultNumber: Sinh/tạo mã kết quả xét nghiệm.
  generateLabResultNumber,
  // listLabOrders: Liệt kê chỉ định xét nghiệm.
  listLabOrders,
  // getLabOrderDetail: Lấy chi tiết chỉ định xét nghiệm.
  getLabOrderDetail,
  // acknowledgeLabOrder: Ghi nhận đã tiếp nhận xét nghiệm y lệnh.
  acknowledgeLabOrder,
  // cancelLabOrder: Hủy xét nghiệm y lệnh.
  cancelLabOrder,
  // createSpecimen: Tạo mẫu bệnh phẩm.
  createSpecimen,
  // collectSpecimen: Thu thập mẫu bệnh phẩm.
  collectSpecimen,
  // getSpecimenDetail: Lấy chi tiết mẫu bệnh phẩm.
  getSpecimenDetail,
  // receiveSpecimen: Tiếp nhận mẫu bệnh phẩm.
  receiveSpecimen,
  // rejectSpecimen: Từ chối mẫu bệnh phẩm.
  rejectSpecimen,
  // processSpecimen: Xử lý mẫu bệnh phẩm.
  processSpecimen,
  // storeSpecimen: Lưu trữ mẫu bệnh phẩm.
  storeSpecimen,
  // disposeSpecimen: Hủy bỏ/xử lý mẫu bệnh phẩm.
  disposeSpecimen,
  // validateLabResultCreation: Kiểm tra tính hợp lệ của điều kiện tạo kết quả xét nghiệm.
  validateLabResultCreation,
  // createLabResult: Tạo kết quả xét nghiệm.
  createLabResult,
  // listLabResults: Liệt kê kết quả xét nghiệm.
  listLabResults,
  // getLabResultDetail: Lấy chi tiết kết quả xét nghiệm.
  getLabResultDetail,
  // updateLabResult: Cập nhật kết quả xét nghiệm.
  updateLabResult,
  // validateLabResultBeforeFinalize: Kiểm tra tính hợp lệ của kết quả xét nghiệm trước khi hoàn tất.
  validateLabResultBeforeFinalize,
  // finalizeLabResult: Hoàn tất kết quả xét nghiệm.
  finalizeLabResult,
  // amendLabResult: Sửa đổi/bổ sung kết quả xét nghiệm.
  amendLabResult,
  // cancelLabResult: Hủy kết quả xét nghiệm.
  cancelLabResult,
  // markLabResultEnteredInError: Đánh dấu kết quả xét nghiệm là nhập sai.
  markLabResultEnteredInError,
  // createLabResultItem: Tạo mục kết quả xét nghiệm.
  createLabResultItem,
  // updateLabResultItem: Cập nhật mục kết quả xét nghiệm.
  updateLabResultItem,
  // removeLabResultItem: Gỡ/xóa mục kết quả xét nghiệm.
  removeLabResultItem,
  // calculateAbnormalFlag: Tính toán bất thường cờ đánh dấu.
  calculateAbnormalFlag,
  // notifyDoctorLabResultFinal: Gửi thông báo về bác sĩ xét nghiệm kết quả cuối cùng.
  notifyDoctorLabResultFinal,
  // acknowledgeCriticalLabResult: Ghi nhận bác sĩ/nhân sự đã xem lab result critical.
  acknowledgeCriticalLabResult,
  // releaseLabResultToPatient: Phát hành kết quả xét nghiệm cho bệnh nhân.
  releaseLabResultToPatient,
  // getMyLabResults: Lấy kết quả xét nghiệm của người dùng hiện tại.
  getMyLabResults,
  // getEncounterLabSummary: Lấy tổng hợp xét nghiệm của lượt khám.
  getEncounterLabSummary,
};

module.exports = withLaboratoryFailureAudits(laboratoryServiceExports);
