const {
  Attachment,
  AuditLog,
  Charge,
  Encounter,
  LabOrder,
  LabResult,
  LabResultCorrectionRequest,
  LabResultItem,
  LabSlaRule,
  LabTestCatalog,
  Order,
  Patient,
  Specimen,
  SpecimenCustodyEvent,
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
  ATTACHMENT_ENTITY_TYPE,
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

const CORRECTION_OPEN_STATUSES = ['open', 'in_progress'];

const DEFAULT_SLA_BY_PRIORITY = {
  stat: {
    collect_due_minutes: 15,
    receive_due_minutes: 30,
    process_due_minutes: 60,
    result_due_minutes: 90,
    approval_due_minutes: 120,
    critical_ack_due_minutes: 15,
  },
  urgent: {
    collect_due_minutes: 45,
    receive_due_minutes: 90,
    process_due_minutes: 180,
    result_due_minutes: 240,
    approval_due_minutes: 300,
    critical_ack_due_minutes: 15,
  },
  routine: {
    collect_due_minutes: 120,
    receive_due_minutes: 240,
    process_due_minutes: 480,
    result_due_minutes: 720,
    approval_due_minutes: 960,
    critical_ack_due_minutes: 30,
  },
};

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

function parseOptionalNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw createError(`${fieldName} phải là số hợp lệ.`);
  return number;
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

function parseOptionalBoolean(value) {
  const parsed = parseBoolean(value);
  return parsed === undefined ? undefined : Boolean(parsed);
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || null;
}

function startOfLocalDay(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw createError('Ngày không hợp lệ.');
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfLocalDay(value = new Date()) {
  const date = startOfLocalDay(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function minutesBetween(start, end = new Date()) {
  const left = start ? new Date(start) : null;
  const right = end ? new Date(end) : new Date();
  if (!left || Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return 0;
  return Math.max(Math.round((right.getTime() - left.getTime()) / 60000), 0);
}

function percentile(values = [], ratio = 0.5) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return normalizeString(value);
}

function normalizeObjectIdArray(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.filter(Boolean);
}

function removeUndefinedFields(input = {}) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function applyNamedDateRange(filter, fieldName, fromValue, toValue, fromName = `${fieldName}_from`, toName = `${fieldName}_to`) {
  if (!fromValue && !toValue) return;
  filter[fieldName] = {
    ...(filter[fieldName] || {}),
    ...(fromValue ? { $gte: parseDate(fromValue, fromName) } : {}),
    ...(toValue ? { $lte: parseDate(toValue, toName) } : {}),
  };
}

function queryValues(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value)
    ? value.filter((item) => item !== undefined && item !== null && item !== '')
    : String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function addQueryFilter(filter, fieldName, value) {
  const values = queryValues(value);
  if (!values.length) return;
  filter[fieldName] = values.length === 1 ? values[0] : { $in: values };
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
    receiveSpecimen: { action: 'specimen.received', targetType: 'specimen', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    rejectSpecimen: { action: 'specimen.rejected', targetType: 'specimen', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
    processSpecimen: { action: 'specimen.in_testing', targetType: 'specimen', targetIndex: 0, actorIndex: 2, requestMetaIndex: 3 },
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
    can_collect: [LAB_ORDER_STATUS.ORDERED, LAB_ORDER_STATUS.RECOLLECTION_REQUIRED].includes(labOrder.status) && hasAnyPermission(actor, [PERMISSION.LAB_ORDERS.COLLECT, PERMISSION.SPECIMENS.COLLECT]),
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

  const [specimens, results, charge] = await Promise.all([
    Specimen.find({ lab_order_id: labOrderId }).sort({ created_at: 1 }).lean(),
    LabResult.find({ lab_order_id: labOrderId }).sort({ reported_at: -1, created_at: -1 }).lean(),
    Charge.findOne({ order_id: context.order._id }).lean(),
  ]);
  const specimenIds = specimens.map((specimen) => specimen._id);
  const resultIds = results.map((result) => result._id);
  const logs = await AuditLog.find({
    $or: [
      { target_type: 'lab_order', target_id: labOrderId },
      { target_type: 'order', target_id: context.order._id },
      { target_type: 'specimen', target_id: { $in: specimenIds } },
      { target_type: 'lab_result', target_id: { $in: resultIds } },
      { 'metadata.lab_order_id': String(labOrderId) },
      { 'metadata.specimen_id': { $in: specimenIds.map((id) => String(id)) } },
      { 'metadata.result_id': { $in: resultIds.map((id) => String(id)) } },
    ],
  }).sort({ created_at: -1 }).limit(40).lean();

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
    barcode: payload.barcode || payload.barcode_value ? normalizeString(payload.barcode || payload.barcode_value) : undefined,
    specimen_type: normalizeString(payload.specimen_type),
    container_type: payload.container_type ? normalizeString(payload.container_type) : undefined,
    tube_count: parseOptionalNumber(payload.tube_count, 'tube_count'),
    collection_site: payload.collection_site ? normalizeString(payload.collection_site) : undefined,
    collection_condition: payload.collection_condition ? normalizeString(payload.collection_condition) : undefined,
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
    if (![LAB_ORDER_STATUS.ORDERED, LAB_ORDER_STATUS.COLLECTED, LAB_ORDER_STATUS.RECOLLECTION_REQUIRED].includes(labOrder.status)) {
      throw createError('Chỉ lab order ordered/collected/recollection_required mới được tạo specimen.', 409);
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
      barcode: normalized.barcode || specimenNo,
      barcode_value: normalized.barcode || specimenNo,
      specimen_type: normalized.specimen_type,
      container_type: normalized.container_type,
      tube_count: normalized.tube_count || 1,
      collection_site: normalized.collection_site,
      collection_condition: normalized.collection_condition,
      storage_location: normalized.storage_location,
      collected_by: isCollected ? actor?.userId : undefined,
      collected_at: isCollected ? (normalized.collected_at || new Date()) : undefined,
      status: isCollected ? SPECIMEN_STATUS.COLLECTED : SPECIMEN_STATUS.PLANNED,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    specimenId = specimen._id;
    await recordSpecimenCustodyEvent(specimen, {
      event_type: isCollected ? 'collected' : 'created',
      to_user: isCollected ? actorUserId(actor) : undefined,
      to_location: normalized.storage_location,
      note: isCollected ? 'Specimen created and collected.' : 'Specimen created.',
    }, actor, session);

    if (isCollected && [LAB_ORDER_STATUS.ORDERED, LAB_ORDER_STATUS.RECOLLECTION_REQUIRED].includes(labOrder.status)) {
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
          barcode: specimenPayload.barcode || specimenNo,
          barcode_value: specimenPayload.barcode || specimenNo,
          specimen_type: specimenPayload.specimen_type,
          container_type: specimenPayload.container_type,
          tube_count: specimenPayload.tube_count || 1,
          collection_site: specimenPayload.collection_site,
          collection_condition: specimenPayload.collection_condition,
          storage_location: specimenPayload.storage_location,
          status: SPECIMEN_STATUS.PLANNED,
          created_by: actor?.userId,
          updated_by: actor?.userId,
        }], sessionOptions(session));
      }
    }

    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.COLLECT, PERMISSION.LAB_ORDERS.COLLECT]));
    if (![LAB_ORDER_STATUS.ORDERED, LAB_ORDER_STATUS.RECOLLECTION_REQUIRED].includes(labOrder.status)) {
      throw createError('Chỉ lab order ordered/recollection_required mới được collect specimen.', 409);
    }
    if (specimen.status !== SPECIMEN_STATUS.PLANNED) throw createError('Chỉ specimen planned mới được collect.', 409);
    assertTransition(SPECIMEN_TRANSITIONS, specimen.status, SPECIMEN_STATUS.COLLECTED, 'specimen');

    specimen.status = SPECIMEN_STATUS.COLLECTED;
    specimen.collected_by = actor?.userId;
    specimen.collected_at = parseDate(payload.collected_at, 'collected_at') || new Date();
    if (payload.barcode !== undefined || payload.barcode_value !== undefined) {
      specimen.barcode = normalizeString(payload.barcode || payload.barcode_value);
      specimen.barcode_value = normalizeString(payload.barcode || payload.barcode_value);
    } else if (!specimen.barcode_value) {
      specimen.barcode_value = specimen.barcode || specimen.specimen_no;
    }
    if (payload.container_type !== undefined) specimen.container_type = normalizeString(payload.container_type);
    if (payload.tube_count !== undefined) specimen.tube_count = parseOptionalNumber(payload.tube_count, 'tube_count') || specimen.tube_count;
    if (payload.collection_site !== undefined) specimen.collection_site = normalizeString(payload.collection_site);
    if (payload.collection_condition !== undefined) specimen.collection_condition = normalizeString(payload.collection_condition);
    if (payload.storage_location !== undefined) specimen.storage_location = normalizeString(payload.storage_location);
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));
    specimenId = specimen._id;
    await recordSpecimenCustodyEvent(specimen, {
      event_type: 'collected',
      to_user: actorUserId(actor),
      to_location: specimen.storage_location,
      condition: specimen.collection_condition,
      note: payload.collection_note || payload.note,
      metadata: {
        collection_site: specimen.collection_site,
        tube_count: specimen.tube_count,
      },
    }, actor, session);

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
    .populate({
      path: 'lab_order_id',
      select: 'lab_order_no test_code test_name priority specimen_type status order_id encounter_id ordered_by ordered_at collected_at completed_at',
      populate: [
        { path: 'order_id', select: 'order_no status priority department_id ordered_at clinical_indication' },
        { path: 'encounter_id', select: 'encounter_code encounter_type status start_time department_id attending_doctor_id' },
      ],
    })
    .populate('collected_by', 'full_name username employee_code')
    .populate('received_by', 'full_name username employee_code')
    .populate('rejected_by', 'full_name username employee_code')
    .populate('disposed_by', 'full_name username employee_code')
    .populate('stored_by', 'full_name username employee_code')
    .populate('testing_started_by', 'full_name username employee_code')
    .populate('label_printed_by', 'full_name username employee_code')
    .populate('last_label_printed_by', 'full_name username employee_code')
    .lean();
  if (!specimen) throw createError('Không tìm thấy specimen.', 404);

  const rawLabOrder = await LabOrder.findById(specimen.lab_order_id?._id || specimen.lab_order_id).lean();
  const context = await loadLabOrderContext(rawLabOrder);
  assertLabOrderAccess(rawLabOrder, context, actor, readAccessPermissions());
  const [rules, linkedResults, attachments, recentCustody] = await Promise.all([
    LabSlaRule.find({ active: true }).lean(),
    LabResult.find({ specimen_id: specimen._id }).sort({ reported_at: -1, created_at: -1 }).lean(),
    Attachment.find({ entity_type: ATTACHMENT_ENTITY_TYPE.SPECIMEN, entity_id: specimen._id }).sort({ created_at: -1 }).limit(12).lean(),
    SpecimenCustodyEvent.find({ specimen_id: specimen._id }).sort({ event_at: -1, created_at: -1 }).limit(12).lean(),
  ]);
  const enriched = enrichSpecimenDocument(specimen, { rules, resultRows: linkedResults, actor });
  return {
    specimen: enriched,
    patient: enriched.patient,
    lab_order: enriched.lab_order,
    order: enriched.order,
    encounter: enriched.encounter,
    linked_results: linkedResults,
    attachments,
    recent_custody: recentCustody,
  };
}

function getSpecimenAllowedActions(specimen = {}, labOrder = {}, actor = {}) {
  return {
    can_collect: specimen.status === SPECIMEN_STATUS.PLANNED && [LAB_ORDER_STATUS.ORDERED, LAB_ORDER_STATUS.RECOLLECTION_REQUIRED].includes(labOrder?.status) && hasAnyPermission(actor, [PERMISSION.SPECIMENS.COLLECT, PERMISSION.LAB_ORDERS.COLLECT]),
    can_receive: specimen.status === SPECIMEN_STATUS.COLLECTED && hasPermission(actor, PERMISSION.SPECIMENS.RECEIVE),
    can_reject: [SPECIMEN_STATUS.PLANNED, SPECIMEN_STATUS.COLLECTED, SPECIMEN_STATUS.RECEIVED].includes(specimen.status) && hasPermission(actor, PERMISSION.SPECIMENS.REJECT),
    can_process: specimen.status === SPECIMEN_STATUS.RECEIVED && hasAnyPermission(actor, [PERMISSION.SPECIMENS.PROCESS, PERMISSION.LAB_ORDERS.PROCESS]),
    can_store: [SPECIMEN_STATUS.RECEIVED, SPECIMEN_STATUS.IN_TESTING].includes(specimen.status) && hasPermission(actor, PERMISSION.SPECIMENS.STORE),
    can_dispose: [SPECIMEN_STATUS.IN_TESTING, SPECIMEN_STATUS.STORED].includes(specimen.status) && hasPermission(actor, PERMISSION.SPECIMENS.DISPOSE),
    can_print_label: hasAnyPermission(actor, [PERMISSION.SPECIMENS.READ, PERMISSION.SPECIMENS.CREATE, PERMISSION.SPECIMENS.COLLECT, PERMISSION.LAB_ORDERS.COLLECT]),
    can_request_recollection: specimen.status === SPECIMEN_STATUS.REJECTED && hasAnyPermission(actor, [PERMISSION.SPECIMENS.CREATE, PERMISSION.SPECIMENS.COLLECT, PERMISSION.LAB_ORDERS.COLLECT]),
  };
}

function addMinutes(date, minutes) {
  const parsed = date ? new Date(date) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getTime() + (Number(minutes || 0) * 60000));
}

function makeSpecimenSlaSnapshot(specimen = {}, labOrder = {}, resultRows = [], rules = []) {
  const rule = matchSlaRule(labOrder || {}, rules);
  let stage = null;
  let startedAt = null;
  let dueField = null;
  if (specimen.status === SPECIMEN_STATUS.PLANNED) {
    stage = 'collection';
    startedAt = labOrder?.ordered_at || specimen.created_at;
    dueField = 'collect_due_minutes';
  } else if (specimen.status === SPECIMEN_STATUS.COLLECTED) {
    stage = 'receive';
    startedAt = specimen.collected_at || specimen.created_at;
    dueField = 'receive_due_minutes';
  } else if (specimen.status === SPECIMEN_STATUS.RECEIVED) {
    stage = 'process';
    startedAt = specimen.received_at || specimen.collected_at || specimen.created_at;
    dueField = 'process_due_minutes';
  } else if (specimen.status === SPECIMEN_STATUS.IN_TESTING) {
    stage = resultRows.length ? 'approval' : 'result';
    startedAt = specimen.testing_started_at || specimen.received_at || specimen.created_at;
    dueField = resultRows.length ? 'approval_due_minutes' : 'result_due_minutes';
  }
  const ageMinutes = minutesBetween(specimen.collected_at || specimen.created_at || labOrder?.ordered_at);
  if (!stage || !startedAt) {
    return {
      age_minutes: ageMinutes,
      is_overdue: false,
      risk_level: specimen.status === SPECIMEN_STATUS.REJECTED ? 'danger' : 'neutral',
      state: 'neutral',
    };
  }
  const dueMinutes = Number(rule?.[dueField] || defaultSlaForPriority(labOrder?.priority)?.[dueField] || 0);
  const elapsedMinutes = minutesBetween(startedAt);
  const remainingMinutes = dueMinutes - elapsedMinutes;
  const state = remainingMinutes < 0 ? 'breached' : remainingMinutes <= Math.max(15, Math.round(dueMinutes * 0.2)) ? 'warning' : 'normal';
  return {
    stage,
    state,
    age_minutes: ageMinutes,
    due_minutes: dueMinutes,
    elapsed_minutes: elapsedMinutes,
    remaining_minutes: Math.max(remainingMinutes, 0),
    breached_minutes: Math.max(-remainingMinutes, 0),
    due_at: addMinutes(startedAt, dueMinutes),
    receive_due_at: specimen.collected_at ? addMinutes(specimen.collected_at, Number(rule?.receive_due_minutes || defaultSlaForPriority(labOrder?.priority)?.receive_due_minutes || 0)) : null,
    is_overdue: state === 'breached',
    risk_level: state === 'breached' ? 'danger' : state === 'warning' ? 'warning' : 'normal',
    started_at: startedAt,
  };
}

function mapRowsByField(rows = [], fieldName) {
  return rows.reduce((map, row) => {
    if (!row?.[fieldName]) return map;
    const key = String(row[fieldName]);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
}

function enrichSpecimenDocument(specimen = {}, options = {}) {
  const labOrder = specimen.lab_order_id && typeof specimen.lab_order_id === 'object' ? specimen.lab_order_id : null;
  const patient = specimen.patient_id && typeof specimen.patient_id === 'object' ? specimen.patient_id : null;
  const order = labOrder?.order_id && typeof labOrder.order_id === 'object' ? labOrder.order_id : null;
  const encounter = labOrder?.encounter_id && typeof labOrder.encounter_id === 'object' ? labOrder.encounter_id : null;
  const resultRows = options.resultRows || [];
  const linkedBySpecimen = options.resultsBySpecimen?.get(String(specimen._id)) || [];
  const linkedByOrder = labOrder?._id ? (options.resultsByOrder?.get(String(labOrder._id)) || []) : [];
  const linkedResults = resultRows.length ? resultRows : (linkedBySpecimen.length ? linkedBySpecimen : linkedByOrder);
  const sla = makeSpecimenSlaSnapshot(specimen, labOrder || {}, linkedResults, options.rules || []);
  return {
    ...specimen,
    barcode_value: specimen.barcode_value || specimen.barcode || specimen.specimen_no,
    patient,
    lab_order: labOrder,
    order,
    encounter,
    linked_results: linkedResults,
    has_result: linkedResults.length > 0,
    has_critical_result: linkedResults.some((result) => result.is_critical),
    sla,
    allowed_actions: getSpecimenAllowedActions(specimen, labOrder || {}, options.actor || {}),
  };
}

function intersectObjectIds(left, right) {
  if (!Array.isArray(left)) return right;
  if (!Array.isArray(right)) return left;
  const rightSet = new Set(right.map((id) => String(id)));
  return left.filter((id) => rightSet.has(String(id)));
}

function mergeObjectIdInFilter(filter, fieldName, ids) {
  if (!Array.isArray(ids)) return;
  const current = filter[fieldName];
  if (!current) {
    filter[fieldName] = { $in: ids };
    return;
  }
  if (current.$in) {
    filter[fieldName] = { $in: intersectObjectIds(current.$in, ids) };
    return;
  }
  filter[fieldName] = { $in: intersectObjectIds([current], ids) };
}

function specimenDateField(query = {}) {
  const allowed = ['created_at', 'collected_at', 'received_at', 'rejected_at', 'stored_at', 'disposed_at'];
  if (allowed.includes(query.date_field)) return query.date_field;
  if (query.status === SPECIMEN_STATUS.COLLECTED) return 'collected_at';
  if (query.status === SPECIMEN_STATUS.RECEIVED || query.status === SPECIMEN_STATUS.IN_TESTING) return 'received_at';
  if (query.status === SPECIMEN_STATUS.REJECTED) return 'rejected_at';
  if (query.status === SPECIMEN_STATUS.STORED) return 'stored_at';
  if (query.status === SPECIMEN_STATUS.DISPOSED) return 'disposed_at';
  return 'created_at';
}

function specimenSort(query = {}) {
  const allowed = new Set([
    'created_at',
    'collected_at',
    'received_at',
    'rejected_at',
    'stored_at',
    'disposed_at',
    'retention_until',
    'specimen_no',
    'status',
  ]);
  if (!query.sort) return { collected_at: -1, received_at: -1, created_at: -1 };
  const raw = String(query.sort);
  const direction = raw.startsWith('-') || raw.endsWith(':desc') ? -1 : 1;
  const field = raw.replace(/^-/, '').replace(/:(asc|desc)$/i, '');
  return allowed.has(field) ? { [field]: direction } : { collected_at: -1, received_at: -1, created_at: -1 };
}

async function buildSpecimenListFilter(query = {}, actor = {}) {
  const filter = {};
  for (const field of [
    'status',
    'patient_id',
    'lab_order_id',
    'specimen_no',
    'specimen_type',
    'container_type',
    'collected_by',
    'received_by',
    'rejected_by',
    'disposed_by',
    'storage_location',
  ]) {
    addQueryFilter(filter, field, query[field]);
  }
  applyDateRange(filter, query, specimenDateField(query));
  applyNamedDateRange(filter, 'collected_at', query.collected_from, query.collected_to, 'collected_from', 'collected_to');
  applyNamedDateRange(filter, 'received_at', query.received_from, query.received_to, 'received_from', 'received_to');
  applyNamedDateRange(filter, 'rejected_at', query.rejected_from, query.rejected_to, 'rejected_from', 'rejected_to');
  applyNamedDateRange(filter, 'disposed_at', query.disposed_from, query.disposed_to, 'disposed_from', 'disposed_to');
  if (parseBoolean(query.retention_due) === true) {
    filter.status = SPECIMEN_STATUS.STORED;
    filter.retention_until = { ...(filter.retention_until || {}), $lte: parseDate(query.retention_date, 'retention_date') || new Date() };
  }

  const labOrderFilter = {};
  for (const field of ['encounter_id', 'priority', 'test_code', 'test_name']) {
    addQueryFilter(labOrderFilter, field, query[field]);
  }
  const scopedOrderIds = await buildScopedOrderIds(query, actor);
  if (scopedOrderIds) labOrderFilter.order_id = { $in: scopedOrderIds };

  if (Object.keys(labOrderFilter).length) {
    const labOrders = await LabOrder.find(labOrderFilter).select('_id').lean();
    mergeObjectIdInFilter(filter, 'lab_order_id', labOrders.map((labOrder) => labOrder._id));
  } else if (actorType(actor) && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    await buildScopedOrderIds(query, actor);
  }

  const resultDerivedFilterNeeded = query.has_result !== undefined || query.has_critical_result !== undefined;
  if (resultDerivedFilterNeeded) {
    const resultFilter = { is_current: { $ne: false } };
    if (parseBoolean(query.has_critical_result) === true) resultFilter.is_critical = true;
    const resultRows = await LabResult.find(resultFilter).select('lab_order_id specimen_id is_critical').lean();
    const resultSpecimenIds = resultRows.map((result) => result.specimen_id).filter(Boolean);
    const resultLabOrderIds = resultRows.filter((result) => !result.specimen_id).map((result) => result.lab_order_id).filter(Boolean);
    const shouldHaveResult = parseBoolean(query.has_result) !== false && query.has_critical_result === undefined
      ? true
      : parseBoolean(query.has_result);
    const shouldHaveCritical = parseBoolean(query.has_critical_result);
    const shouldInclude = shouldHaveCritical === true || shouldHaveResult === true;
    if (shouldInclude) {
      if (resultSpecimenIds.length) mergeObjectIdInFilter(filter, '_id', resultSpecimenIds);
      else if (resultLabOrderIds.length) mergeObjectIdInFilter(filter, 'lab_order_id', resultLabOrderIds);
      else mergeObjectIdInFilter(filter, '_id', []);
    } else if (shouldHaveResult === false || shouldHaveCritical === false) {
      if (resultSpecimenIds.length) filter._id = { ...(filter._id || {}), $nin: resultSpecimenIds };
      if (resultLabOrderIds.length) filter.lab_order_id = { ...(filter.lab_order_id || {}), $nin: resultLabOrderIds };
    }
  }

  if (query.search) {
    const keyword = escapeRegex(query.search);
    const [matchingLabOrders, matchingPatients] = await Promise.all([
      LabOrder.find({
        $or: [
          { lab_order_no: { $regex: keyword, $options: 'i' } },
          { test_name: { $regex: keyword, $options: 'i' } },
          { test_code: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').limit(100).lean(),
      Patient.find({
        $or: [
          { patient_code: { $regex: keyword, $options: 'i' } },
          { full_name: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').limit(100).lean(),
    ]);
    filter.$or = [
      { specimen_no: { $regex: keyword, $options: 'i' } },
      { barcode: { $regex: keyword, $options: 'i' } },
      { barcode_value: { $regex: keyword, $options: 'i' } },
      ...(matchingLabOrders.length ? [{ lab_order_id: { $in: matchingLabOrders.map((labOrder) => labOrder._id) } }] : []),
      ...(matchingPatients.length ? [{ patient_id: { $in: matchingPatients.map((patient) => patient._id) } }] : []),
    ];
  }
  return filter;
}

function loadSpecimenWorklistRows(filter, query = {}) {
  return Specimen.find(filter)
    .sort(specimenSort(query))
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate({
      path: 'lab_order_id',
      select: 'lab_order_no test_code test_name priority status encounter_id order_id ordered_at collected_at',
      populate: [
        { path: 'order_id', select: 'order_no status priority department_id ordered_at' },
        { path: 'encounter_id', select: 'encounter_code encounter_type status start_time department_id' },
      ],
    })
    .populate('collected_by', 'full_name username employee_code')
    .populate('received_by', 'full_name username employee_code')
    .populate('rejected_by', 'full_name username employee_code')
    .populate('disposed_by', 'full_name username employee_code')
    .populate('stored_by', 'full_name username employee_code')
    .populate('testing_started_by', 'full_name username employee_code')
    .lean();
}

async function enrichSpecimenRows(rows = [], actor = {}) {
  const specimenIds = rows.map((specimen) => specimen._id);
  const labOrderIds = rows.map((specimen) => specimen.lab_order_id?._id || specimen.lab_order_id).filter(Boolean);
  const [rules, resultRows] = await Promise.all([
    LabSlaRule.find({ active: true }).lean(),
    LabResult.find({
      $or: [
        { specimen_id: { $in: specimenIds } },
        { specimen_id: { $exists: false }, lab_order_id: { $in: labOrderIds } },
        { specimen_id: null, lab_order_id: { $in: labOrderIds } },
      ],
      is_current: { $ne: false },
    }).select('result_no lab_order_id specimen_id status is_critical critical_acknowledged_at reported_at created_at').lean(),
  ]);
  const resultsBySpecimen = mapRowsByField(resultRows, 'specimen_id');
  const resultsByOrder = mapRowsByField(resultRows, 'lab_order_id');
  return rows.map((specimen) => enrichSpecimenDocument(specimen, {
    actor,
    rules,
    resultsBySpecimen,
    resultsByOrder,
  }));
}

async function listSpecimens(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildSpecimenListFilter(query, actor);
  const derivedOverdueFilter = query.is_overdue !== undefined;
  if (derivedOverdueFilter) {
    const rows = await loadSpecimenWorklistRows(filter, query);
    const enriched = await enrichSpecimenRows(rows, actor);
    const shouldBeOverdue = parseBoolean(query.is_overdue);
    const filtered = enriched.filter((specimen) => Boolean(specimen.sla?.is_overdue) === shouldBeOverdue);
    return {
      items: filtered.slice(skip, skip + limit),
      pagination: buildPagination(page, limit, filtered.length),
    };
  }

  const [items, total] = await Promise.all([
    loadSpecimenWorklistRows(filter, query)
      .skip(skip)
      .limit(limit),
    Specimen.countDocuments(filter),
  ]);

  return {
    items: await enrichSpecimenRows(items, actor),
    pagination: buildPagination(page, limit, total),
  };
}

function normalizeQualityCheckPayload(payload = {}) {
  const source = payload.quality_check || payload;
  return removeUndefinedFields({
    label_verified: parseOptionalBoolean(source.label_verified),
    patient_identity_verified: parseOptionalBoolean(source.patient_identity_verified),
    container_intact: parseOptionalBoolean(source.container_intact),
    volume_adequate: parseOptionalBoolean(source.volume_adequate),
    sample_quality: normalizeOptionalString(source.sample_quality),
    temperature_celsius: parseOptionalNumber(source.temperature_celsius, 'temperature_celsius'),
    hemolysis_level: normalizeOptionalString(source.hemolysis_level),
    clot_detected: parseOptionalBoolean(source.clot_detected),
    leak_detected: parseOptionalBoolean(source.leak_detected),
    note: normalizeOptionalString(source.note || source.receive_note),
  });
}

function normalizeTestingPayload(payload = {}, actor = {}) {
  return removeUndefinedFields({
    testing_started_by: actorUserId(actor),
    testing_started_at: parseDate(payload.testing_started_at || payload.started_at, 'testing_started_at') || new Date(),
    instrument_id: normalizeOptionalString(payload.instrument_id || payload.analyzer_id),
    workstation_id: normalizeOptionalString(payload.workstation_id || payload.workstation),
    assay_run_id: normalizeOptionalString(payload.assay_run_id || payload.testing_session),
    testing_note: normalizeOptionalString(payload.testing_note || payload.note),
  });
}

function normalizeStoragePayload(payload = {}, actor = {}) {
  return removeUndefinedFields({
    storage_location: normalizeOptionalString(payload.storage_location),
    stored_by: actorUserId(actor),
    stored_at: parseDate(payload.stored_at, 'stored_at') || new Date(),
    storage_unit: normalizeOptionalString(payload.storage_unit),
    storage_rack: normalizeOptionalString(payload.storage_rack),
    storage_box: normalizeOptionalString(payload.storage_box),
    storage_slot: normalizeOptionalString(payload.storage_slot),
    retention_policy_code: normalizeOptionalString(payload.retention_policy_code),
    retention_until: parseDate(payload.retention_until, 'retention_until'),
    storage_temperature: parseOptionalNumber(payload.storage_temperature, 'storage_temperature'),
    storage_note: normalizeOptionalString(payload.storage_note || payload.note),
  });
}

function normalizeDisposalPayload(payload = {}, actor = {}) {
  const reason = payload.reason || payload.dispose_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi dispose specimen.');
  return removeUndefinedFields({
    disposed_by: actorUserId(actor),
    disposed_at: parseDate(payload.disposed_at, 'disposed_at') || new Date(),
    dispose_reason: normalizeString(reason),
    dispose_method: normalizeOptionalString(payload.dispose_method),
    dispose_witness_by: payload.dispose_witness_by || payload.witness_by,
    dispose_document_no: normalizeOptionalString(payload.dispose_document_no),
    dispose_attachment_id: payload.dispose_attachment_id,
  });
}

async function recordSpecimenCustodyEvent(specimen, payload = {}, actor = {}, session = null) {
  if (!specimen?._id || !payload.event_type) return null;
  const [event] = await SpecimenCustodyEvent.create([{
    specimen_id: specimen._id,
    lab_order_id: specimen.lab_order_id,
    patient_id: specimen.patient_id,
    event_type: payload.event_type,
    from_user: payload.from_user,
    to_user: payload.to_user,
    from_location: payload.from_location,
    to_location: payload.to_location,
    event_at: payload.event_at || new Date(),
    condition: payload.condition,
    temperature_celsius: payload.temperature_celsius,
    note: payload.note,
    metadata: payload.metadata,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  }], sessionOptions(session));
  return event;
}

async function receiveSpecimen(specimenId, payload = {}, actor, requestMeta = {}) {
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
    specimen.received_at = parseDate(payload.received_at, 'received_at') || new Date();
    const qualityCheck = normalizeQualityCheckPayload(payload);
    if (Object.keys(qualityCheck).length) specimen.quality_check = qualityCheck;
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));
    await updateLabOrderStatus(labOrder, LAB_ORDER_STATUS.RECEIVED, actor, session);
    await updateOrderStatus(labOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
    await recordSpecimenCustodyEvent(specimen, {
      event_type: 'received',
      to_user: actorUserId(actor),
      to_location: payload.received_location,
      condition: qualityCheck.sample_quality,
      temperature_celsius: qualityCheck.temperature_celsius,
      note: qualityCheck.note,
      metadata: { quality_check: qualityCheck },
    }, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'specimen.received', targetType: 'specimen', targetId: specimenId, status: 'success', message: 'Receive specimen thành công.', requestMeta });
  return getSpecimenDetail(specimenId, actor);
}

async function rejectSpecimen(specimenId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.SPECIMENS.REJECT);
  const reason = payload.reason || payload.rejection_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi reject specimen.');
  const needRecollection = parseOptionalBoolean(payload.need_recollection ?? payload.requires_recollection) === true;
  const cancelOrder = parseOptionalBoolean(payload.cancel_order);

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
    specimen.rejected_at = parseDate(payload.rejected_at, 'rejected_at') || new Date();
    specimen.rejection_reason = reason;
    specimen.rejection_reason_code = normalizeOptionalString(payload.reason_code || payload.rejection_code);
    specimen.rejection_stage = normalizeOptionalString(payload.stage || payload.rejection_stage);
    specimen.rejection_severity = normalizeOptionalString(payload.severity || payload.rejection_severity);
    specimen.need_recollection = needRecollection;
    specimen.reject_notify_doctor = parseOptionalBoolean(payload.notify_doctor) === true;
    specimen.reject_notify_nurse = parseOptionalBoolean(payload.notify_nurse) === true;
    specimen.rejection_evidence_attachment_ids = normalizeObjectIdArray(payload.evidence_attachment_ids || payload.photo_attachment_id);
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));
    await recordSpecimenCustodyEvent(specimen, {
      event_type: 'rejected',
      from_user: actorUserId(actor),
      condition: specimen.rejection_reason_code,
      note: reason,
      metadata: {
        reason_code: specimen.rejection_reason_code,
        stage: specimen.rejection_stage,
        severity: specimen.rejection_severity,
        need_recollection: needRecollection,
      },
    }, actor, session);

    const activeSpecimenCount = await withSession(Specimen.countDocuments({
      lab_order_id: labOrder._id,
      status: { $nin: [SPECIMEN_STATUS.REJECTED, SPECIMEN_STATUS.DISPOSED] },
    }), session);
    if (activeSpecimenCount === 0 && needRecollection && cancelOrder !== true && canTransition(LAB_ORDER_TRANSITIONS, labOrder.status, LAB_ORDER_STATUS.RECOLLECTION_REQUIRED)) {
      await updateLabOrderStatus(labOrder, LAB_ORDER_STATUS.RECOLLECTION_REQUIRED, actor, session);
      const contextOrder = context.order;
      if (contextOrder?.status !== ORDER_STATUS.IN_PROGRESS && canTransition(ORDER_TRANSITIONS, contextOrder?.status, ORDER_STATUS.IN_PROGRESS)) {
        await updateOrderStatus(labOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
      }
    } else if (activeSpecimenCount === 0 && canTransition(LAB_ORDER_TRANSITIONS, labOrder.status, LAB_ORDER_STATUS.REJECTED)) {
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
    metadata: {
      lab_order_id: String(labOrderId || ''),
      reason,
      reason_code: payload.reason_code || payload.rejection_code,
      need_recollection: needRecollection,
      cancel_order: cancelOrder,
    },
  });
  return getSpecimenDetail(specimenId, actor);
}

async function processSpecimen(specimenId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SPECIMENS.PROCESS, PERMISSION.LAB_ORDERS.PROCESS]);
  await withOptionalTransaction(async (session) => {
    const specimen = await getSpecimenOrThrow(specimenId, session);
    const labOrder = await getLabOrderOrThrow(specimen.lab_order_id, session);
    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.PROCESS, PERMISSION.LAB_ORDERS.PROCESS]));
    assertTransition(SPECIMEN_TRANSITIONS, specimen.status, SPECIMEN_STATUS.IN_TESTING, 'specimen');
    if (labOrder.status !== LAB_ORDER_STATUS.RECEIVED) throw createError('Lab order phải received trước khi process specimen.', 409);

    specimen.status = SPECIMEN_STATUS.IN_TESTING;
    Object.assign(specimen, normalizeTestingPayload(payload, actor));
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));
    await updateLabOrderStatus(labOrder, LAB_ORDER_STATUS.IN_PROGRESS, actor, session);
    await updateOrderStatus(labOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
    await recordSpecimenCustodyEvent(specimen, {
      event_type: 'in_testing',
      to_user: actorUserId(actor),
      to_location: payload.workstation_id || payload.workstation,
      note: payload.testing_note || payload.note,
      metadata: {
        instrument_id: payload.instrument_id || payload.analyzer_id,
        workstation_id: payload.workstation_id || payload.workstation,
        assay_run_id: payload.assay_run_id || payload.testing_session,
      },
    }, actor, session);
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
    Object.assign(specimen, normalizeStoragePayload(payload, actor));
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));
    await recordSpecimenCustodyEvent(specimen, {
      event_type: 'stored',
      to_user: actorUserId(actor),
      to_location: specimen.storage_location,
      condition: payload.storage_condition,
      temperature_celsius: specimen.storage_temperature,
      note: specimen.storage_note,
      metadata: {
        storage_unit: specimen.storage_unit,
        storage_rack: specimen.storage_rack,
        storage_box: specimen.storage_box,
        storage_slot: specimen.storage_slot,
        retention_until: specimen.retention_until,
      },
    }, actor, session);
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({ actor, action: 'specimen.stored', targetType: 'specimen', targetId: specimenId, status: 'success', message: 'Store specimen thành công.', requestMeta });
  return getSpecimenDetail(specimenId, actor);
}

async function disposeSpecimen(specimenId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.SPECIMENS.DISPOSE);
  const disposal = normalizeDisposalPayload(payload, actor);
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
    Object.assign(specimen, disposal);
    specimen.updated_by = actor?.userId;
    await specimen.save(sessionOptions(session));
    await recordSpecimenCustodyEvent(specimen, {
      event_type: 'disposed',
      from_user: actorUserId(actor),
      from_location: specimen.storage_location,
      condition: specimen.dispose_method,
      note: specimen.dispose_reason,
      metadata: {
        dispose_document_no: specimen.dispose_document_no,
        dispose_attachment_id: specimen.dispose_attachment_id,
      },
    }, actor, session);
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({ actor, action: 'specimen.disposed', targetType: 'specimen', targetId: specimenId, status: 'success', message: 'Dispose specimen thành công.', requestMeta, metadata: { reason: disposal.dispose_reason, dispose_method: disposal.dispose_method } });
  return getSpecimenDetail(specimenId, actor);
}

async function getSpecimenStats(query = {}, actor = {}) {
  const day = parseDate(query.date, 'date') || new Date();
  const start = query.date_from ? parseDate(query.date_from, 'date_from') : startOfLocalDay(day);
  const end = query.date_to ? parseDate(query.date_to, 'date_to') : endOfLocalDay(day);
  const baseFilter = await buildSpecimenListFilter({ ...query, status: undefined, date_from: undefined, date_to: undefined }, actor);
  const todayFilter = { ...baseFilter, created_at: { $gte: start, $lte: end } };

  const [
    totalToday,
    statusRows,
    statPending,
    rejectedToday,
    collectedRows,
    receivedRows,
  ] = await Promise.all([
    Specimen.countDocuments(todayFilter),
    Promise.all(Object.values(SPECIMEN_STATUS).map(async (status) => ({
      _id: status,
      count: await Specimen.countDocuments({ ...todayFilter, status }),
    }))),
    (async () => {
      const filter = await buildSpecimenListFilter({ ...query, priority: 'stat', status: undefined }, actor);
      filter.status = { $in: [SPECIMEN_STATUS.PLANNED, SPECIMEN_STATUS.COLLECTED, SPECIMEN_STATUS.RECEIVED, SPECIMEN_STATUS.IN_TESTING] };
      return Specimen.countDocuments(filter);
    })(),
    Specimen.countDocuments({ ...baseFilter, status: SPECIMEN_STATUS.REJECTED, rejected_at: { $gte: start, $lte: end } }),
    Specimen.find({
      ...baseFilter,
      collected_at: { $exists: true },
      received_at: { $exists: true },
    }).select('collected_at received_at').limit(1000).lean(),
    Specimen.find({
      ...baseFilter,
      received_at: { $exists: true },
      testing_started_at: { $exists: true },
    }).select('received_at testing_started_at').limit(1000).lean(),
  ]);

  const byStatus = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  const collectedWaitingRows = await loadSpecimenWorklistRows({ ...baseFilter, status: SPECIMEN_STATUS.COLLECTED }, query).limit(1000);
  const enrichedCollected = await enrichSpecimenRows(collectedWaitingRows, actor);
  const receiveOverdue = enrichedCollected.filter((specimen) => specimen.sla?.is_overdue).length;
  const collectionToReceive = collectedRows.map((specimen) => minutesBetween(specimen.collected_at, specimen.received_at));
  const receiveToTesting = receivedRows.map((specimen) => minutesBetween(specimen.received_at, specimen.testing_started_at));

  return {
    total_today: totalToday,
    planned: byStatus[SPECIMEN_STATUS.PLANNED] || 0,
    collected: byStatus[SPECIMEN_STATUS.COLLECTED] || 0,
    received: byStatus[SPECIMEN_STATUS.RECEIVED] || 0,
    rejected: byStatus[SPECIMEN_STATUS.REJECTED] || 0,
    in_testing: byStatus[SPECIMEN_STATUS.IN_TESTING] || 0,
    stored: byStatus[SPECIMEN_STATUS.STORED] || 0,
    disposed: byStatus[SPECIMEN_STATUS.DISPOSED] || 0,
    stat_pending: statPending,
    receive_overdue: receiveOverdue,
    rejection_rate: totalToday ? Number(((rejectedToday / totalToday) * 100).toFixed(2)) : 0,
    avg_collection_to_receive_minutes: collectionToReceive.length ? Math.round(collectionToReceive.reduce((sum, value) => sum + value, 0) / collectionToReceive.length) : 0,
    avg_receive_to_testing_minutes: receiveToTesting.length ? Math.round(receiveToTesting.reduce((sum, value) => sum + value, 0) / receiveToTesting.length) : 0,
  };
}

async function lookupSpecimen(query = {}, actor = {}) {
  const barcode = normalizeOptionalString(query.barcode || query.specimen_no || query.search);
  if (!barcode) throw createError('barcode/specimen_no là bắt buộc.', 400);
  const keyword = escapeRegex(barcode);
  const rows = await loadSpecimenWorklistRows({
    $or: [
      { specimen_no: { $regex: `^${keyword}$`, $options: 'i' } },
      { barcode: { $regex: `^${keyword}$`, $options: 'i' } },
      { barcode_value: { $regex: `^${keyword}$`, $options: 'i' } },
    ],
  }, query).limit(1);
  if (!rows.length) throw createError('Không tìm thấy specimen theo barcode.', 404);
  const rawLabOrder = await LabOrder.findById(rows[0].lab_order_id?._id || rows[0].lab_order_id).lean();
  const context = await loadLabOrderContext(rawLabOrder);
  assertLabOrderAccess(rawLabOrder, context, actor, readAccessPermissions());
  const [specimen] = await enrichSpecimenRows(rows, actor);
  return { specimen };
}

async function getSpecimenTimeline(specimenId, actor = {}) {
  const detail = await getSpecimenDetail(specimenId, actor);
  const specimen = detail.specimen;
  const resultIds = (detail.linked_results || []).map((result) => result._id);
  const [auditLogs, custodyEvents] = await Promise.all([
    AuditLog.find({
      $or: [
        { target_type: 'specimen', target_id: specimen._id },
        { target_type: 'lab_order', target_id: specimen.lab_order?._id || specimen.lab_order_id },
        { target_type: 'lab_result', target_id: { $in: resultIds } },
        { 'metadata.specimen_id': String(specimen._id) },
        { 'metadata.lab_order_id': String(specimen.lab_order?._id || specimen.lab_order_id || '') },
      ],
    }).sort({ created_at: -1 }).limit(80).lean(),
    SpecimenCustodyEvent.find({ specimen_id: specimen._id }).sort({ event_at: -1, created_at: -1 }).limit(80).lean(),
  ]);
  const timeline = [
    ...auditLogs.map((log) => ({
      source: 'audit',
      at: log.created_at,
      action: log.action,
      actor: { actor_type: log.actor_type, actor_id: log.actor_id },
      status: log.status,
      message: log.message,
      before_status: log.before?.status,
      after_status: log.after?.status,
      metadata: log.metadata,
    })),
    ...custodyEvents.map((event) => ({
      source: 'custody',
      at: event.event_at || event.created_at,
      action: `specimen.custody.${event.event_type}`,
      actor: { actor_id: event.created_by },
      status: 'success',
      message: event.note,
      metadata: event,
    })),
  ].sort((left, right) => new Date(right.at || 0) - new Date(left.at || 0));
  return {
    specimen,
    timeline,
    linked: {
      lab_order: detail.lab_order,
      results: detail.linked_results,
      attachments: detail.attachments,
      custody: custodyEvents,
    },
  };
}

async function printSpecimenLabels(payload = {}, actor = {}, requestMeta = {}) {
  const specimenIds = normalizeObjectIdArray(payload.specimen_ids || payload.ids);
  if (!specimenIds.length) throw createError('specimen_ids là bắt buộc.', 400);
  assertStaffPermission(actor, [PERMISSION.SPECIMENS.READ, PERMISSION.SPECIMENS.CREATE, PERMISSION.SPECIMENS.COLLECT]);
  const contexts = [];
  for (const specimenId of specimenIds) {
    contexts.push(await loadSpecimenLabelContext(specimenId, actor));
  }
  const now = new Date();
  await Specimen.updateMany(
    { _id: { $in: specimenIds } },
    {
      $set: {
        label_printed_at: now,
        label_printed_by: actorUserId(actor),
        last_label_printed_at: now,
        last_label_printed_by: actorUserId(actor),
        updated_by: actorUserId(actor),
      },
      $inc: { label_print_count: 1 },
    },
  );
  const labels = contexts.map(({ specimen, labOrder, patient }) => labelSnapshot({
    ...specimen,
    barcode_value: specimen.barcode_value || specimen.barcode || specimen.specimen_no,
  }, labOrder, patient));
  await recordAuditLog({
    actor,
    action: 'specimen.labels_printed',
    targetType: 'specimen',
    targetId: specimenIds[0],
    status: 'success',
    message: 'In nhãn specimen hàng loạt.',
    requestMeta,
    metadata: { specimen_ids: specimenIds.map(String), count: specimenIds.length },
  });
  return { labels, html: renderSpecimenLabelHtml(labels) };
}

async function bulkReceiveSpecimens(payload = {}, actor = {}, requestMeta = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw createError('items là bắt buộc.', 400);
  const received = [];
  const failed = [];
  for (const item of items) {
    try {
      const result = await receiveSpecimen(item.specimen_id || item._id, item, actor, requestMeta);
      received.push(result.specimen);
    } catch (error) {
      failed.push({ specimen_id: item.specimen_id || item._id, message: error.message });
    }
  }
  return { received, failed, summary: { received: received.length, failed: failed.length } };
}

async function bulkRejectSpecimens(payload = {}, actor = {}, requestMeta = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw createError('items là bắt buộc.', 400);
  const rejected = [];
  const failed = [];
  for (const item of items) {
    try {
      const result = await rejectSpecimen(item.specimen_id || item._id, item, actor, requestMeta);
      rejected.push(result.specimen);
    } catch (error) {
      failed.push({ specimen_id: item.specimen_id || item._id, message: error.message });
    }
  }
  return { rejected, failed, summary: { rejected: rejected.length, failed: failed.length } };
}

async function requestSpecimenRecollection(specimenId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SPECIMENS.CREATE, PERMISSION.SPECIMENS.COLLECT, PERMISSION.LAB_ORDERS.COLLECT]);
  let recollectionSpecimenId = null;
  await withOptionalTransaction(async (session) => {
    const specimen = await getSpecimenOrThrow(specimenId, session);
    const labOrder = await getLabOrderOrThrow(specimen.lab_order_id, session);
    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.CREATE, PERMISSION.LAB_ORDERS.COLLECT]));
    specimen.need_recollection = true;
    specimen.updated_by = actorUserId(actor);
    await specimen.save(sessionOptions(session));
    if (canTransition(LAB_ORDER_TRANSITIONS, labOrder.status, LAB_ORDER_STATUS.RECOLLECTION_REQUIRED)) {
      await updateLabOrderStatus(labOrder, LAB_ORDER_STATUS.RECOLLECTION_REQUIRED, actor, session);
    }
    const activeSpecimenExists = await withSession(Specimen.exists({
      lab_order_id: labOrder._id,
      status: { $nin: [SPECIMEN_STATUS.REJECTED, SPECIMEN_STATUS.DISPOSED] },
    }), session);
    if (payload.create_specimen !== false && !activeSpecimenExists) {
      const specimenNo = payload.specimen_no || await generateSpecimenNumber({ session });
      const [newSpecimen] = await Specimen.create([{
        lab_order_id: labOrder._id,
        patient_id: labOrder.patient_id,
        specimen_no: specimenNo,
        barcode: payload.barcode || specimenNo,
        barcode_value: payload.barcode || specimenNo,
        specimen_type: payload.specimen_type || specimen.specimen_type || labOrder.specimen_type || labOrder.test_name,
        container_type: payload.container_type || specimen.container_type,
        tube_count: payload.tube_count || specimen.tube_count || 1,
        collection_site: payload.collection_site || specimen.collection_site,
        collection_condition: payload.collection_condition || specimen.collection_condition,
        status: SPECIMEN_STATUS.PLANNED,
        created_by: actorUserId(actor),
        updated_by: actorUserId(actor),
      }], sessionOptions(session));
      recollectionSpecimenId = newSpecimen._id;
      await recordSpecimenCustodyEvent(newSpecimen, {
        event_type: 'created',
        note: payload.reason || 'Created for recollection.',
        metadata: { previous_specimen_id: String(specimen._id) },
      }, actor, session);
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'specimen.recollection_requested',
    targetType: 'specimen',
    targetId: specimenId,
    status: 'success',
    message: 'Tạo yêu cầu lấy lại mẫu.',
    requestMeta,
    metadata: { recollection_specimen_id: recollectionSpecimenId ? String(recollectionSpecimenId) : undefined, reason: payload.reason },
  });
  return {
    original: await getSpecimenDetail(specimenId, actor),
    recollection: recollectionSpecimenId ? await getSpecimenDetail(recollectionSpecimenId, actor) : null,
  };
}

async function getSpecimenCustody(specimenId, actor = {}) {
  const detail = await getSpecimenDetail(specimenId, actor);
  const items = await SpecimenCustodyEvent.find({ specimen_id: specimenId }).sort({ event_at: -1, created_at: -1 }).lean();
  return { specimen: detail.specimen, items };
}

async function createSpecimenCustodyEvent(specimenId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SPECIMENS.READ, PERMISSION.SPECIMENS.COLLECT, PERMISSION.SPECIMENS.RECEIVE, PERMISSION.SPECIMENS.STORE]);
  if (!nonEmpty(payload.event_type)) throw createError('event_type là bắt buộc.', 400);
  let eventId;
  await withOptionalTransaction(async (session) => {
    const specimen = await getSpecimenOrThrow(specimenId, session);
    const labOrder = await getLabOrderOrThrow(specimen.lab_order_id, session);
    const context = await loadLabOrderContext(labOrder, session);
    assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.READ, PERMISSION.SPECIMENS.COLLECT, PERMISSION.SPECIMENS.RECEIVE, PERMISSION.SPECIMENS.STORE]));
    const event = await recordSpecimenCustodyEvent(specimen, {
      event_type: normalizeString(payload.event_type),
      from_user: payload.from_user,
      to_user: payload.to_user,
      from_location: payload.from_location,
      to_location: payload.to_location,
      event_at: parseDate(payload.event_at, 'event_at') || new Date(),
      condition: payload.condition,
      temperature_celsius: parseOptionalNumber(payload.temperature_celsius, 'temperature_celsius'),
      note: payload.note,
      metadata: payload.metadata,
    }, actor, session);
    eventId = event?._id;
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({
    actor,
    action: 'specimen.custody_event_created',
    targetType: 'specimen',
    targetId: specimenId,
    status: 'success',
    message: 'Ghi nhận chain-of-custody specimen.',
    requestMeta,
    metadata: { custody_event_id: eventId ? String(eventId) : undefined, event_type: payload.event_type },
  });
  return getSpecimenCustody(specimenId, actor);
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
  for (const field of ['patient_id', 'lab_order_id', 'specimen_id', 'status', 'verified_by', 'performed_by']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.is_critical !== undefined) filter.is_critical = parseBoolean(query.is_critical);
  if (query.released_to_patient !== undefined) filter.released_to_patient = parseBoolean(query.released_to_patient);
  if (query.critical_acknowledged === 'true') filter.critical_acknowledged_at = { $exists: true };
  if (query.critical_acknowledged === 'false') filter.critical_acknowledged_at = null;
  if (query.critical_unacknowledged === 'true') {
    filter.is_critical = true;
    filter.critical_acknowledged_at = null;
  }
  if (query.critical_ack_overdue === 'true') {
    filter.is_critical = true;
    filter.critical_acknowledged_at = null;
    filter.critical_notified_at = { $lte: new Date(Date.now() - 30 * 60000) };
  }
  if (query.amended === 'true') {
    filter.status = LAB_RESULT_STATUS.AMENDED;
  }
  if (query.entered_in_error === 'true') {
    filter.status = LAB_RESULT_STATUS.ENTERED_IN_ERROR;
  }
  applyDateRange(filter, query, 'reported_at');

  if (query.encounter_id) {
    const labOrders = await LabOrder.find({ encounter_id: query.encounter_id }).select('_id').lean();
    filter.lab_order_id = { $in: labOrders.map((labOrder) => labOrder._id) };
  }

  if (query.search) {
    const keyword = escapeRegex(query.search);
    const [matchingLabOrders, matchingPatients] = await Promise.all([
      LabOrder.find({
        $or: [
          { lab_order_no: { $regex: keyword, $options: 'i' } },
          { test_name: { $regex: keyword, $options: 'i' } },
          { test_code: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').limit(100).lean(),
      Patient.find({
        $or: [
          { patient_code: { $regex: keyword, $options: 'i' } },
          { full_name: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').limit(100).lean(),
    ]);
    filter.$or = [
      { result_no: { $regex: keyword, $options: 'i' } },
      ...(matchingLabOrders.length ? [{ lab_order_id: { $in: matchingLabOrders.map((labOrder) => labOrder._id) } }] : []),
      ...(matchingPatients.length ? [{ patient_id: { $in: matchingPatients.map((patient) => patient._id) } }] : []),
    ];
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
    mergeObjectIdInFilter(filter, 'lab_order_id', labOrders.map((labOrder) => labOrder._id));
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
    mergeObjectIdInFilter(filter, 'lab_order_id', labOrders.map((labOrder) => labOrder._id));
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
      .populate('performed_by', 'full_name username employee_code')
      .populate('verified_by', 'full_name username employee_code')
      .populate('critical_acknowledged_by', 'full_name username employee_code')
      .lean(),
    LabResult.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

function defaultSlaForPriority(priority) {
  return DEFAULT_SLA_BY_PRIORITY[priority] || DEFAULT_SLA_BY_PRIORITY.routine;
}

function matchSlaRule(labOrder = {}, rules = []) {
  const priority = labOrder.priority || 'routine';
  const testCode = normalizeString(labOrder.test_code).toUpperCase();
  return rules.find((rule) => rule.priority === priority && rule.test_code && rule.test_code === testCode)
    || rules.find((rule) => rule.priority === priority && rule.category && rule.category === labOrder.category)
    || rules.find((rule) => rule.priority === priority && !rule.test_code && !rule.category)
    || defaultSlaForPriority(priority);
}

function getLabOrderStageClock(labOrder = {}, specimens = [], results = []) {
  const latestSpecimen = specimens[0] || {};
  const latestResult = results[0] || {};
  const hasResult = results.length > 0;
  if (labOrder.status === LAB_ORDER_STATUS.ORDERED) {
    return { stage: 'collection', started_at: labOrder.ordered_at, dueField: 'collect_due_minutes' };
  }
  if (labOrder.status === LAB_ORDER_STATUS.COLLECTED) {
    return { stage: 'receive', started_at: latestSpecimen.collected_at || labOrder.collected_at || labOrder.ordered_at, dueField: 'receive_due_minutes' };
  }
  if (labOrder.status === LAB_ORDER_STATUS.RECEIVED) {
    return { stage: 'process', started_at: latestSpecimen.received_at || labOrder.ordered_at, dueField: 'process_due_minutes' };
  }
  if (labOrder.status === LAB_ORDER_STATUS.IN_PROGRESS) {
    return { stage: hasResult ? 'approval' : 'result', started_at: latestResult.reported_at || latestResult.created_at || latestSpecimen.received_at || labOrder.ordered_at, dueField: hasResult ? 'approval_due_minutes' : 'result_due_minutes' };
  }
  return null;
}

function makeSlaSnapshot(labOrder = {}, specimens = [], results = [], rules = []) {
  const stageClock = getLabOrderStageClock(labOrder, specimens, results);
  if (!stageClock || !stageClock.started_at) return null;
  const rule = matchSlaRule(labOrder, rules);
  const dueMinutes = Number(rule[stageClock.dueField] || defaultSlaForPriority(labOrder.priority)[stageClock.dueField] || 0);
  const elapsedMinutes = minutesBetween(stageClock.started_at);
  const remainingMinutes = dueMinutes - elapsedMinutes;
  return {
    stage: stageClock.stage,
    state: remainingMinutes < 0 ? 'breached' : remainingMinutes <= Math.max(15, Math.round(dueMinutes * 0.2)) ? 'warning' : 'normal',
    due_minutes: dueMinutes,
    elapsed_minutes: elapsedMinutes,
    remaining_minutes: Math.max(remainingMinutes, 0),
    breached_minutes: Math.max(-remainingMinutes, 0),
    started_at: stageClock.started_at,
  };
}

async function getScopedLabOrderFilter(query = {}, actor = {}) {
  const filter = {};
  const scopedOrderIds = await buildScopedOrderIds(query, actor);
  if (scopedOrderIds) filter.order_id = { $in: scopedOrderIds };
  return filter;
}

async function getLabWorkspaceSummary(query = {}, actor = {}) {
  const day = parseDate(query.date, 'date') || new Date();
  const start = startOfLocalDay(day);
  const end = endOfLocalDay(day);
  const scopedLabOrderFilter = await getScopedLabOrderFilter(query, actor);
  const activeLabOrderFilter = {
    ...scopedLabOrderFilter,
    status: { $nin: [LAB_ORDER_STATUS.COMPLETED, LAB_ORDER_STATUS.CANCELLED, LAB_ORDER_STATUS.REJECTED] },
  };

  const resultBaseFilter = await buildScopedLabResultFilter({ include_history: query.include_history }, actor);
  const resultTodayFilter = { ...resultBaseFilter, reported_at: { $gte: start, $lte: end } };
  const finalTodayFilter = {
    ...resultTodayFilter,
    status: { $in: FINAL_RESULT_STATUSES },
  };

  const [
    totalToday,
    waitingCollection,
    collectedWaitingReceive,
    receivedWaitingTesting,
    inTesting,
    preliminaryResults,
    finalToday,
    criticalUnacknowledged,
    rejectedSpecimens,
    todayOrders,
    activeOrders,
    activeSpecimens,
    activeResults,
    rules,
    workloadByStatusRows,
    workloadByTestRows,
    workloadByTechnicianRows,
  ] = await Promise.all([
    LabOrder.countDocuments({ ...scopedLabOrderFilter, ordered_at: { $gte: start, $lte: end } }),
    LabOrder.countDocuments({ ...scopedLabOrderFilter, status: LAB_ORDER_STATUS.ORDERED }),
    LabOrder.countDocuments({ ...scopedLabOrderFilter, status: LAB_ORDER_STATUS.COLLECTED }),
    LabOrder.countDocuments({ ...scopedLabOrderFilter, status: LAB_ORDER_STATUS.RECEIVED }),
    LabOrder.countDocuments({ ...scopedLabOrderFilter, status: LAB_ORDER_STATUS.IN_PROGRESS }),
    LabResult.countDocuments({ ...resultBaseFilter, status: LAB_RESULT_STATUS.PRELIMINARY }),
    LabResult.countDocuments(finalTodayFilter),
    LabResult.countDocuments({
      ...resultBaseFilter,
      is_critical: true,
      status: { $in: FINAL_RESULT_STATUSES },
      critical_acknowledged_at: { $exists: false },
    }),
    Specimen.countDocuments({ status: SPECIMEN_STATUS.REJECTED, rejected_at: { $gte: start, $lte: end } }),
    LabOrder.find({ ...scopedLabOrderFilter, ordered_at: { $gte: start, $lte: end } }).select('priority ordered_at completed_at status').lean(),
    LabOrder.find(activeLabOrderFilter).select('_id order_id lab_order_no test_code test_name priority status ordered_at collected_at completed_at').limit(500).lean(),
    Specimen.find({ status: { $nin: [SPECIMEN_STATUS.REJECTED, SPECIMEN_STATUS.DISPOSED] } }).select('lab_order_id status collected_at received_at').sort({ created_at: -1 }).lean(),
    LabResult.find({ ...resultBaseFilter, status: LAB_RESULT_STATUS.PRELIMINARY }).select('lab_order_id reported_at created_at status').sort({ created_at: -1 }).lean(),
    LabSlaRule.find({ active: true }).lean(),
    LabOrder.aggregate([
      { $match: scopedLabOrderFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    LabOrder.aggregate([
      { $match: { ...scopedLabOrderFilter, ordered_at: { $gte: start, $lte: end } } },
      { $group: { _id: { test_code: '$test_code', test_name: '$test_name' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    LabResult.aggregate([
      { $match: { ...resultTodayFilter, performed_by: { $ne: null } } },
      { $group: { _id: '$performed_by', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const specimensByOrder = activeSpecimens.reduce((map, specimen) => {
    const key = String(specimen.lab_order_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(specimen);
    return map;
  }, new Map());
  const resultsByOrder = activeResults.reduce((map, result) => {
    const key = String(result.lab_order_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(result);
    return map;
  }, new Map());
  const overdueOrders = activeOrders.filter((labOrder) => {
    const sla = makeSlaSnapshot(labOrder, specimensByOrder.get(String(labOrder._id)) || [], resultsByOrder.get(String(labOrder._id)) || [], rules);
    return sla?.state === 'breached';
  });
  const completedDurations = todayOrders
    .filter((order) => order.completed_at && order.ordered_at)
    .map((order) => minutesBetween(order.ordered_at, order.completed_at));
  const completedByPriority = (priority) => todayOrders
    .filter((order) => order.priority === priority && order.completed_at && order.ordered_at)
    .map((order) => minutesBetween(order.ordered_at, order.completed_at));

  return {
    counters: {
      total_today: totalToday,
      waiting_collection: waitingCollection,
      collected_waiting_receive: collectedWaitingReceive,
      received_waiting_testing: receivedWaitingTesting,
      in_testing: inTesting,
      preliminary_results: preliminaryResults,
      pending_approval: preliminaryResults,
      final_today: finalToday,
      critical_unacknowledged: criticalUnacknowledged,
      rejected_specimens: rejectedSpecimens,
      overdue_orders: overdueOrders.length,
    },
    priority: {
      stat: todayOrders.filter((order) => order.priority === 'stat').length,
      urgent: todayOrders.filter((order) => order.priority === 'urgent').length,
      routine: todayOrders.filter((order) => order.priority === 'routine').length,
    },
    turnaround_time: {
      median_minutes: percentile(completedDurations, 0.5),
      p90_minutes: percentile(completedDurations, 0.9),
      stat_median_minutes: percentile(completedByPriority('stat'), 0.5),
      urgent_median_minutes: percentile(completedByPriority('urgent'), 0.5),
    },
    workload_by_status: workloadByStatusRows.map((row) => ({ status: row._id, count: row.count })),
    workload_by_test: workloadByTestRows.map((row) => ({
      test_code: row._id.test_code,
      test_name: row._id.test_name,
      count: row.count,
    })),
    workload_by_technician: workloadByTechnicianRows.map((row) => ({ performed_by: row._id, count: row.count })),
  };
}

async function getLabWorkspaceOverdue(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const scopedLabOrderFilter = await getScopedLabOrderFilter(query, actor);
  const filter = {
    ...scopedLabOrderFilter,
    status: { $nin: [LAB_ORDER_STATUS.COMPLETED, LAB_ORDER_STATUS.CANCELLED, LAB_ORDER_STATUS.REJECTED] },
  };
  if (query.priority) filter.priority = query.priority;

  const [orders, specimens, results, rules] = await Promise.all([
    LabOrder.find(filter)
      .sort({ priority: 1, ordered_at: 1 })
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('encounter_id', 'encounter_code encounter_type status start_time')
      .populate('ordered_by', 'full_name username employee_code')
      .lean(),
    Specimen.find({ status: { $nin: [SPECIMEN_STATUS.REJECTED, SPECIMEN_STATUS.DISPOSED] } }).sort({ created_at: -1 }).lean(),
    LabResult.find({ is_current: { $ne: false }, status: LAB_RESULT_STATUS.PRELIMINARY }).sort({ created_at: -1 }).lean(),
    LabSlaRule.find({ active: true }).lean(),
  ]);

  const specimensByOrder = specimens.reduce((map, specimen) => {
    const key = String(specimen.lab_order_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(specimen);
    return map;
  }, new Map());
  const resultsByOrder = results.reduce((map, result) => {
    const key = String(result.lab_order_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(result);
    return map;
  }, new Map());
  const items = orders
    .map((labOrder) => ({
      lab_order: labOrder,
      sla: makeSlaSnapshot(labOrder, specimensByOrder.get(String(labOrder._id)) || [], resultsByOrder.get(String(labOrder._id)) || [], rules),
    }))
    .filter((item) => item.sla?.state === 'breached')
    .sort((a, b) => (b.sla.breached_minutes || 0) - (a.sla.breached_minutes || 0));

  return {
    summary: {
      total_overdue: items.length,
      stat_overdue: items.filter((item) => item.lab_order.priority === 'stat').length,
      urgent_overdue: items.filter((item) => item.lab_order.priority === 'urgent').length,
      routine_overdue: items.filter((item) => item.lab_order.priority === 'routine').length,
    },
    items: items.slice(skip, skip + limit),
    pagination: buildPagination(page, limit, items.length),
  };
}

function normalizeReferenceRanges(ranges = []) {
  if (!Array.isArray(ranges)) return [];
  return ranges.map((range) => ({
    gender: range.gender ? normalizeString(range.gender) : undefined,
    age_min: parseOptionalNumber(range.age_min, 'age_min'),
    age_max: parseOptionalNumber(range.age_max, 'age_max'),
    min: parseOptionalNumber(range.min, 'min'),
    max: parseOptionalNumber(range.max, 'max'),
    critical_low: parseOptionalNumber(range.critical_low, 'critical_low'),
    critical_high: parseOptionalNumber(range.critical_high, 'critical_high'),
    text_range: range.text_range ? normalizeString(range.text_range) : undefined,
    unit: range.unit ? normalizeString(range.unit) : undefined,
    interpretation: range.interpretation ? normalizeString(range.interpretation) : undefined,
    method: range.method ? normalizeString(range.method) : undefined,
    instrument: range.instrument ? normalizeString(range.instrument) : undefined,
    pregnancy_status: range.pregnancy_status ? normalizeString(range.pregnancy_status) : undefined,
    effective_from: range.effective_from ? parseDate(range.effective_from, 'effective_from') : undefined,
    effective_to: range.effective_to ? parseDate(range.effective_to, 'effective_to') : undefined,
  }));
}

function normalizeCatalogResultItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (!nonEmpty(item.item_name)) throw createError('result_items.item_name là bắt buộc.');
    return {
      item_code: item.item_code ? normalizeString(item.item_code).toUpperCase() : undefined,
      item_name: normalizeString(item.item_name),
      unit: item.unit ? normalizeString(item.unit) : undefined,
      reference_range: item.reference_range ? normalizeString(item.reference_range) : undefined,
      critical_low: parseOptionalNumber(item.critical_low, 'critical_low'),
      critical_high: parseOptionalNumber(item.critical_high, 'critical_high'),
      display_order: parseOptionalNumber(item.display_order, 'display_order') || index + 1,
    };
  });
}

function normalizeCatalogPayload(payload = {}, { partial = false } = {}) {
  if (!partial && !nonEmpty(payload.code)) throw createError('code là bắt buộc.');
  if (!partial && !nonEmpty(payload.name)) throw createError('name là bắt buộc.');
  const output = {};
  if (payload.code !== undefined) output.code = normalizeString(payload.code).toUpperCase();
  if (payload.name !== undefined) output.name = normalizeString(payload.name);
  if (payload.category !== undefined) output.category = normalizeString(payload.category);
  if (payload.specimen_type !== undefined) output.specimen_type = normalizeString(payload.specimen_type);
  if (payload.specimen_type_id !== undefined) output.specimen_type_id = payload.specimen_type_id || undefined;
  if (payload.container_type !== undefined) output.container_type = normalizeString(payload.container_type);
  if (payload.collection_instruction !== undefined) output.collection_instruction = normalizeString(payload.collection_instruction);
  if (payload.unit !== undefined) output.unit = normalizeString(payload.unit);
  if (payload.reference_ranges !== undefined) output.reference_ranges = normalizeReferenceRanges(payload.reference_ranges);
  if (payload.result_items !== undefined) output.result_items = normalizeCatalogResultItems(payload.result_items);
  if (payload.turnaround_minutes !== undefined) output.turnaround_minutes = parseOptionalNumber(payload.turnaround_minutes, 'turnaround_minutes');
  if (payload.price_service_id !== undefined) output.price_service_id = payload.price_service_id || undefined;
  if (payload.active !== undefined) output.active = parseBoolean(payload.active);
  if (payload.metadata !== undefined) output.metadata = payload.metadata || {};
  return output;
}

function assertCanManageCatalog(actor = {}) {
  return assertStaffPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.LAB_RESULTS.FINALIZE,
    PERMISSION.LAB_RESULTS.WRITE,
  ], 'Bạn không có quyền cấu hình danh mục xét nghiệm.');
}

async function listLabTestCatalog(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.LAB_ORDERS.READ, PERMISSION.LAB_RESULTS.READ, PERMISSION.ORDERS.READ_LAB]);
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.active !== undefined) filter.active = parseBoolean(query.active);
  for (const field of ['category', 'specimen_type', 'code']) {
    if (query[field]) filter[field] = field === 'code' ? normalizeString(query[field]).toUpperCase() : query[field];
  }
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [
      { code: { $regex: keyword, $options: 'i' } },
      { name: { $regex: keyword, $options: 'i' } },
      { category: { $regex: keyword, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    LabTestCatalog.find(filter)
      .sort({ active: -1, category: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .populate('price_service_id', 'service_code service_name unit_price currency status is_billable')
      .populate('specimen_type_id', 'code name container_type tube_color active')
      .lean(),
    LabTestCatalog.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getLabTestCatalogDetail(catalogTestId, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.LAB_ORDERS.READ, PERMISSION.LAB_RESULTS.READ, PERMISSION.ORDERS.READ_LAB]);
  const item = await LabTestCatalog.findById(catalogTestId)
    .populate('price_service_id', 'service_code service_name unit_price currency status is_billable')
    .populate('specimen_type_id', 'code name container_type tube_color active')
    .lean();
  if (!item) throw createError('Không tìm thấy xét nghiệm trong catalog.', 404);
  return { item };
}

async function createLabTestCatalog(payload = {}, actor = {}, requestMeta = {}) {
  assertCanManageCatalog(actor);
  const normalized = normalizeCatalogPayload(payload);
  const existing = await LabTestCatalog.exists({ code: normalized.code });
  if (existing) throw createError('Mã xét nghiệm đã tồn tại.', 409);
  const item = await LabTestCatalog.create({
    ...normalized,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({
    actor,
    action: 'lab_catalog.test_created',
    targetType: 'lab_test_catalog',
    targetId: item._id,
    status: 'success',
    message: 'Tạo danh mục xét nghiệm.',
    requestMeta,
    after: item.toObject(),
  });
  return getLabTestCatalogDetail(item._id, actor);
}

async function updateLabTestCatalog(catalogTestId, payload = {}, actor = {}, requestMeta = {}) {
  assertCanManageCatalog(actor);
  const item = await LabTestCatalog.findById(catalogTestId);
  if (!item) throw createError('Không tìm thấy xét nghiệm trong catalog.', 404);
  const normalized = normalizeCatalogPayload(payload, { partial: true });
  if (normalized.code && normalized.code !== item.code) {
    const existing = await LabTestCatalog.exists({ code: normalized.code, _id: { $ne: item._id } });
    if (existing) throw createError('Mã xét nghiệm đã tồn tại.', 409);
  }
  const before = item.toObject();
  Object.assign(item, normalized);
  item.updated_by = actorUserId(actor);
  await item.save();
  await recordAuditLog({
    actor,
    action: 'lab_catalog.test_updated',
    targetType: 'lab_test_catalog',
    targetId: item._id,
    status: 'success',
    message: 'Cập nhật danh mục xét nghiệm.',
    requestMeta,
    before,
    after: item.toObject(),
  });
  return getLabTestCatalogDetail(item._id, actor);
}

async function setLabTestCatalogActive(catalogTestId, active, actor = {}, requestMeta = {}) {
  return updateLabTestCatalog(catalogTestId, { active }, actor, requestMeta);
}

function normalizeSlaRulePayload(payload = {}, { partial = false } = {}) {
  const output = {};
  if (!partial && !nonEmpty(payload.priority)) output.priority = 'routine';
  if (payload.test_code !== undefined) output.test_code = payload.test_code ? normalizeString(payload.test_code).toUpperCase() : undefined;
  if (payload.category !== undefined) output.category = payload.category ? normalizeString(payload.category) : undefined;
  if (payload.priority !== undefined) output.priority = normalizeString(payload.priority) || 'routine';
  for (const field of ['collect_due_minutes', 'receive_due_minutes', 'process_due_minutes', 'result_due_minutes', 'approval_due_minutes', 'critical_ack_due_minutes']) {
    if (payload[field] !== undefined) output[field] = parseOptionalNumber(payload[field], field);
  }
  if (payload.active !== undefined) output.active = parseBoolean(payload.active);
  if (payload.metadata !== undefined) output.metadata = payload.metadata || {};
  return output;
}

async function listLabSlaRules(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.LAB_ORDERS.READ, PERMISSION.LAB_RESULTS.READ, PERMISSION.ORDERS.READ_LAB]);
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.active !== undefined) filter.active = parseBoolean(query.active);
  if (query.priority) filter.priority = query.priority;
  if (query.test_code) filter.test_code = normalizeString(query.test_code).toUpperCase();
  if (query.category) filter.category = query.category;
  const [items, total] = await Promise.all([
    LabSlaRule.find(filter).sort({ active: -1, priority: 1, test_code: 1, category: 1 }).skip(skip).limit(limit).lean(),
    LabSlaRule.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total), defaults: DEFAULT_SLA_BY_PRIORITY };
}

async function createLabSlaRule(payload = {}, actor = {}, requestMeta = {}) {
  assertCanManageCatalog(actor);
  const normalized = normalizeSlaRulePayload(payload);
  const rule = await LabSlaRule.create({ ...normalized, created_by: actorUserId(actor), updated_by: actorUserId(actor) });
  await recordAuditLog({
    actor,
    action: 'lab_sla_rule.created',
    targetType: 'lab_sla_rule',
    targetId: rule._id,
    status: 'success',
    message: 'Tạo SLA rule xét nghiệm.',
    requestMeta,
    after: rule.toObject(),
  });
  return { rule };
}

async function updateLabSlaRule(ruleId, payload = {}, actor = {}, requestMeta = {}) {
  assertCanManageCatalog(actor);
  const rule = await LabSlaRule.findById(ruleId);
  if (!rule) throw createError('Không tìm thấy SLA rule xét nghiệm.', 404);
  const before = rule.toObject();
  Object.assign(rule, normalizeSlaRulePayload(payload, { partial: true }));
  rule.updated_by = actorUserId(actor);
  await rule.save();
  await recordAuditLog({
    actor,
    action: 'lab_sla_rule.updated',
    targetType: 'lab_sla_rule',
    targetId: rule._id,
    status: 'success',
    message: 'Cập nhật SLA rule xét nghiệm.',
    requestMeta,
    before,
    after: rule.toObject(),
  });
  return { rule };
}

function assertCanManageCorrection(actor = {}) {
  return assertStaffPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.LAB_RESULTS.FINALIZE,
    PERMISSION.LAB_RESULTS.WRITE,
  ], 'Bạn không có quyền quản lý yêu cầu sửa kết quả xét nghiệm.');
}

async function requestLabResultCorrection(resultId, payload = {}, actor = {}, requestMeta = {}) {
  assertCanManageCorrection(actor);
  const reasonText = payload.reason_text || payload.reason;
  if (!nonEmpty(reasonText)) throw createError('reason_text là bắt buộc.');
  const result = await getLabResultOrThrow(resultId);
  const { labOrder, ...context } = await loadResultContext(result);
  assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.LAB_RESULTS.FINALIZE, PERMISSION.LAB_RESULTS.WRITE]));

  if (!payload.allow_duplicate) {
    const openExisting = await LabResultCorrectionRequest.exists({
      lab_result_id: result._id,
      status: { $in: CORRECTION_OPEN_STATUSES },
    });
    if (openExisting) throw createError('Result đang có yêu cầu sửa chưa đóng.', 409);
  }

  const correction = await LabResultCorrectionRequest.create({
    lab_result_id: result._id,
    lab_order_id: labOrder._id,
    specimen_id: result.specimen_id,
    patient_id: result.patient_id,
    encounter_id: labOrder.encounter_id,
    requested_by: actorUserId(actor),
    requested_at: new Date(),
    assigned_to: payload.assigned_to,
    reason_code: payload.reason_code ? normalizeString(payload.reason_code) : undefined,
    reason_text: normalizeString(reasonText),
    priority: payload.priority || labOrder.priority || 'routine',
    due_at: parseDate(payload.due_at, 'due_at'),
    status: 'open',
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });

  await recordAuditLog({
    actor,
    action: 'lab_result.correction_requested',
    targetType: 'lab_result_correction_request',
    targetId: correction._id,
    status: 'success',
    message: 'Tạo yêu cầu sửa kết quả xét nghiệm.',
    requestMeta,
    metadata: {
      lab_result_id: String(result._id),
      lab_order_id: String(labOrder._id),
      reason_code: correction.reason_code,
    },
  });
  return getLabResultCorrectionDetail(correction._id, actor);
}

async function listLabResultCorrections(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.LAB_RESULTS.READ, PERMISSION.LAB_RESULTS.WRITE, PERMISSION.LAB_RESULTS.FINALIZE]);
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  for (const field of ['status', 'priority', 'lab_result_id', 'lab_order_id', 'patient_id', 'encounter_id', 'assigned_to', 'requested_by']) {
    if (query[field]) filter[field] = query[field];
  }
  applyDateRange(filter, query, 'requested_at');

  if (query.search) {
    const keyword = escapeRegex(query.search);
    const [matchingResults, matchingOrders, matchingPatients] = await Promise.all([
      LabResult.find({ result_no: { $regex: keyword, $options: 'i' } }).select('_id').limit(100).lean(),
      LabOrder.find({
        $or: [
          { lab_order_no: { $regex: keyword, $options: 'i' } },
          { test_name: { $regex: keyword, $options: 'i' } },
          { test_code: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').limit(100).lean(),
      Patient.find({
        $or: [
          { patient_code: { $regex: keyword, $options: 'i' } },
          { full_name: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').limit(100).lean(),
    ]);
    filter.$or = [
      { reason_text: { $regex: keyword, $options: 'i' } },
      { reason_code: { $regex: keyword, $options: 'i' } },
      ...(matchingResults.length ? [{ lab_result_id: { $in: matchingResults.map((result) => result._id) } }] : []),
      ...(matchingOrders.length ? [{ lab_order_id: { $in: matchingOrders.map((order) => order._id) } }] : []),
      ...(matchingPatients.length ? [{ patient_id: { $in: matchingPatients.map((patient) => patient._id) } }] : []),
    ];
  }

  const [items, total, summaryRows] = await Promise.all([
    LabResultCorrectionRequest.find(filter)
      .sort({ due_at: 1, requested_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('lab_result_id', 'result_no status is_critical reported_at verified_at')
      .populate('lab_order_id', 'lab_order_no test_code test_name priority status')
      .populate('specimen_id', 'specimen_no specimen_type status')
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('requested_by', 'full_name username employee_code')
      .populate('assigned_to', 'full_name username employee_code')
      .populate('resolved_by', 'full_name username employee_code')
      .lean(),
    LabResultCorrectionRequest.countDocuments(filter),
    LabResultCorrectionRequest.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  const summary = summaryRows.reduce((output, row) => ({ ...output, [row._id]: row.count }), {
    open: 0,
    in_progress: 0,
    resolved: 0,
    cancelled: 0,
  });
  return { summary: { total, ...summary }, items, pagination: buildPagination(page, limit, total) };
}

async function getLabResultCorrectionDetail(correctionId, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.LAB_RESULTS.READ, PERMISSION.LAB_RESULTS.WRITE, PERMISSION.LAB_RESULTS.FINALIZE]);
  const correction = await LabResultCorrectionRequest.findById(correctionId)
    .populate('lab_result_id', 'result_no status is_critical reported_at verified_at interpretation notes')
    .populate('lab_order_id', 'lab_order_no test_code test_name priority status order_id encounter_id')
    .populate('specimen_id', 'specimen_no specimen_type status collected_at received_at')
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('requested_by', 'full_name username employee_code')
    .populate('assigned_to', 'full_name username employee_code')
    .populate('resolved_by', 'full_name username employee_code')
    .populate('cancelled_by', 'full_name username employee_code')
    .lean();
  if (!correction) throw createError('Không tìm thấy yêu cầu sửa kết quả xét nghiệm.', 404);
  return { correction };
}

async function resolveLabResultCorrection(correctionId, payload = {}, actor = {}, requestMeta = {}) {
  assertCanManageCorrection(actor);
  const correction = await LabResultCorrectionRequest.findById(correctionId);
  if (!correction) throw createError('Không tìm thấy yêu cầu sửa kết quả xét nghiệm.', 404);
  if (!CORRECTION_OPEN_STATUSES.includes(correction.status)) throw createError('Yêu cầu sửa đã đóng.', 409);
  const before = correction.toObject();
  correction.status = 'resolved';
  correction.resolved_by = actorUserId(actor);
  correction.resolved_at = new Date();
  correction.resolution_note = payload.resolution_note || payload.note;
  correction.updated_by = actorUserId(actor);
  await correction.save();
  await recordAuditLog({
    actor,
    action: 'lab_result.correction_resolved',
    targetType: 'lab_result_correction_request',
    targetId: correction._id,
    status: 'success',
    message: 'Đóng yêu cầu sửa kết quả xét nghiệm.',
    requestMeta,
    before,
    after: correction.toObject(),
  });
  return getLabResultCorrectionDetail(correction._id, actor);
}

async function cancelLabResultCorrection(correctionId, payload = {}, actor = {}, requestMeta = {}) {
  assertCanManageCorrection(actor);
  const correction = await LabResultCorrectionRequest.findById(correctionId);
  if (!correction) throw createError('Không tìm thấy yêu cầu sửa kết quả xét nghiệm.', 404);
  if (!CORRECTION_OPEN_STATUSES.includes(correction.status)) throw createError('Yêu cầu sửa đã đóng.', 409);
  const before = correction.toObject();
  correction.status = 'cancelled';
  correction.cancelled_by = actorUserId(actor);
  correction.cancelled_at = new Date();
  correction.cancel_reason = payload.reason || payload.cancel_reason;
  correction.updated_by = actorUserId(actor);
  await correction.save();
  await recordAuditLog({
    actor,
    action: 'lab_result.correction_cancelled',
    targetType: 'lab_result_correction_request',
    targetId: correction._id,
    status: 'success',
    message: 'Hủy yêu cầu sửa kết quả xét nghiệm.',
    requestMeta,
    before,
    after: correction.toObject(),
  });
  return getLabResultCorrectionDetail(correction._id, actor);
}

function labelSnapshot(specimen = {}, labOrder = {}, patient = {}) {
  return {
    specimen_id: specimen._id,
    specimen_no: specimen.specimen_no,
    barcode: specimen.barcode_value || specimen.barcode || specimen.specimen_no,
    specimen_type: specimen.specimen_type,
    container_type: specimen.container_type,
    tube_count: specimen.tube_count || 1,
    patient_code: patient.patient_code,
    patient_name: patient.full_name,
    test_code: labOrder.test_code,
    test_name: labOrder.test_name,
    priority: labOrder.priority,
    collected_at: specimen.collected_at,
  };
}

function renderSpecimenLabelHtml(labels = []) {
  const rows = labels.map((label) => `
    <article class="label">
      <header><strong>${escapeHtml(label.specimen_no)}</strong><span>${escapeHtml(label.priority || '')}</span></header>
      <div class="barcode">${escapeHtml(label.barcode)}</div>
      <p>${escapeHtml(label.patient_code || '')} - ${escapeHtml(label.patient_name || '')}</p>
      <p>${escapeHtml(label.test_code || '')} ${escapeHtml(label.test_name || '')}</p>
      <small>${escapeHtml(label.specimen_type || '')} / ${escapeHtml(label.container_type || '')} / ${escapeHtml(label.tube_count)}</small>
    </article>
  `).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;margin:16px;color:#111827}
    .grid{display:grid;grid-template-columns:repeat(2, 280px);gap:12px}
    .label{border:1px solid #111827;border-radius:6px;padding:10px;min-height:150px}
    header{display:flex;justify-content:space-between;gap:8px}
    .barcode{margin:10px 0;padding:8px;border:1px dashed #111827;text-align:center;font-size:18px;font-weight:800;letter-spacing:2px}
    p{margin:5px 0;font-size:12px}small{font-size:11px;color:#4b5563}
  </style></head><body><main class="grid">${rows}</main></body></html>`;
}

async function loadSpecimenLabelContext(specimenId, actor = {}) {
  const specimen = await Specimen.findById(specimenId).lean();
  if (!specimen) throw createError('Không tìm thấy specimen.', 404);
  const labOrder = await LabOrder.findById(specimen.lab_order_id).lean();
  const context = await loadLabOrderContext(labOrder);
  assertLabOrderAccess(labOrder, context, actor, readAccessPermissions());
  return { specimen, labOrder, patient: context.patient };
}

async function printSpecimenLabel(specimenId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SPECIMENS.READ, PERMISSION.SPECIMENS.CREATE, PERMISSION.SPECIMENS.COLLECT]);
  const { specimen, labOrder, patient } = await loadSpecimenLabelContext(specimenId, actor);
  const before = specimen;
  await Specimen.updateOne(
    { _id: specimen._id },
    {
      $set: {
        barcode: specimen.barcode || specimen.specimen_no,
        barcode_value: specimen.barcode_value || specimen.barcode || specimen.specimen_no,
        label_printed_at: new Date(),
        label_printed_by: actorUserId(actor),
        last_label_printed_at: new Date(),
        last_label_printed_by: actorUserId(actor),
        updated_by: actorUserId(actor),
      },
      $inc: { label_print_count: 1 },
    },
  );
  const updated = await Specimen.findById(specimen._id).lean();
  const labels = [labelSnapshot(updated, labOrder, patient)];
  await recordAuditLog({
    actor,
    action: 'specimen.label_printed',
    targetType: 'specimen',
    targetId: specimen._id,
    status: 'success',
    message: 'In nhãn specimen.',
    requestMeta,
    before,
    after: updated,
    metadata: { reprint_reason: payload.reprint_reason },
  });
  return {
    labels,
    html: renderSpecimenLabelHtml(labels),
  };
}

async function printLabOrderLabels(labOrderId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.SPECIMENS.READ, PERMISSION.SPECIMENS.CREATE, PERMISSION.LAB_ORDERS.COLLECT]);
  const labOrder = await getLabOrderOrThrow(labOrderId);
  const context = await loadLabOrderContext(labOrder);
  assertLabOrderAccess(labOrder, context, actor, writeAccessPermissions([PERMISSION.SPECIMENS.CREATE, PERMISSION.LAB_ORDERS.COLLECT]));
  let specimens = await Specimen.find({
    lab_order_id: labOrder._id,
    status: { $nin: [SPECIMEN_STATUS.REJECTED, SPECIMEN_STATUS.DISPOSED] },
  }).lean();
  if (!specimens.length && payload.auto_create !== false) {
    const specimenNo = await generateSpecimenNumber();
    const specimen = await Specimen.create({
      lab_order_id: labOrder._id,
      patient_id: labOrder.patient_id,
      specimen_no: specimenNo,
      barcode: specimenNo,
      barcode_value: specimenNo,
      specimen_type: payload.specimen_type || labOrder.specimen_type || labOrder.test_name,
      container_type: payload.container_type,
      tube_count: payload.tube_count || 1,
      status: SPECIMEN_STATUS.PLANNED,
      created_by: actorUserId(actor),
      updated_by: actorUserId(actor),
    });
    specimens = [specimen.toObject()];
  }
  await Specimen.updateMany(
    { _id: { $in: specimens.map((specimen) => specimen._id) } },
    {
      $set: {
        last_label_printed_at: new Date(),
        last_label_printed_by: actorUserId(actor),
        label_printed_at: new Date(),
        label_printed_by: actorUserId(actor),
        updated_by: actorUserId(actor),
      },
      $inc: { label_print_count: 1 },
    },
  );
  const updated = await Specimen.find({ _id: { $in: specimens.map((specimen) => specimen._id) } }).lean();
  const labels = updated.map((specimen) => labelSnapshot(specimen, labOrder, context.patient));
  await recordAuditLog({
    actor,
    action: 'lab_order.labels_printed',
    targetType: 'lab_order',
    targetId: labOrder._id,
    status: 'success',
    message: 'In nhãn specimen cho lab order.',
    requestMeta,
    metadata: { specimen_ids: updated.map((specimen) => String(specimen._id)) },
  });
  return { labels, html: renderSpecimenLabelHtml(labels) };
}

async function getSpecimenLabelPdf(specimenId, actor = {}) {
  const { specimen, labOrder, patient } = await loadSpecimenLabelContext(specimenId, actor);
  const labels = [labelSnapshot(specimen, labOrder, patient)];
  return {
    file_name: `${specimen.specimen_no || 'specimen-label'}.html`,
    content_type: 'text/html',
    labels,
    html: renderSpecimenLabelHtml(labels),
  };
}

function renderLabResultHtml(detail = {}) {
  const result = detail.result || {};
  const labOrder = result.lab_order_id || {};
  const patient = result.patient_id || {};
  const rows = (detail.items || []).map((item) => `
    <tr>
      <td>${escapeHtml(item.item_code || '')}</td>
      <td>${escapeHtml(item.item_name || '')}</td>
      <td>${escapeHtml(item.result_value || item.numeric_value || '')}</td>
      <td>${escapeHtml(item.unit || '')}</td>
      <td>${escapeHtml(item.reference_range || '')}</td>
      <td>${escapeHtml(item.abnormal_flag || '')}</td>
      <td>${escapeHtml(item.comment || '')}</td>
    </tr>
  `).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;margin:32px;color:#111827}
    header{border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:18px}
    h1{margin:0 0 8px;font-size:22px}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:16px 0}
    table{width:100%;border-collapse:collapse;margin-top:18px}
    th,td{border:1px solid #d1d5db;padding:8px;text-align:left;font-size:12px}
    th{background:#f3f4f6}
  </style></head><body>
    <header><h1>Kết quả xét nghiệm ${escapeHtml(result.result_no || '')}</h1><p>${escapeHtml(labOrder.test_name || '')}</p></header>
    <section class="grid">
      <div><strong>Bệnh nhân:</strong> ${escapeHtml(patient.patient_code || '')} - ${escapeHtml(patient.full_name || '')}</div>
      <div><strong>Trạng thái:</strong> ${escapeHtml(result.status || '')}</div>
      <div><strong>Ngày báo cáo:</strong> ${escapeHtml(result.reported_at || '')}</div>
      <div><strong>Critical:</strong> ${result.is_critical ? 'Có' : 'Không'}</div>
    </section>
    <table><thead><tr><th>Code</th><th>Chỉ số</th><th>Giá trị</th><th>Đơn vị</th><th>Tham chiếu</th><th>Flag</th><th>Ghi chú</th></tr></thead><tbody>${rows}</tbody></table>
    <section><h2>Diễn giải</h2><p>${escapeHtml(result.interpretation || '')}</p><p>${escapeHtml(result.notes || '')}</p></section>
  </body></html>`;
}

async function getLabResultPdf(resultId, actor = {}) {
  const detail = await getLabResultDetail(resultId, actor);
  return {
    file_name: `${detail.result?.result_no || 'lab-result'}.html`,
    content_type: 'text/html',
    result: detail.result,
    items: detail.items,
    html: renderLabResultHtml(detail),
  };
}

async function printLabResult(resultId, payload = {}, actor = {}, requestMeta = {}) {
  const printable = await getLabResultPdf(resultId, actor);
  await recordAuditLog({
    actor,
    action: 'lab_result.printed',
    targetType: 'lab_result',
    targetId: resultId,
    status: 'success',
    message: 'In kết quả xét nghiệm.',
    requestMeta,
    metadata: { print_reason: payload.reason || payload.print_reason },
  });
  return printable;
}

async function getLabResultVersions(resultId, actor = {}) {
  const result = await LabResult.findById(resultId).lean();
  if (!result) throw createError('Không tìm thấy lab result.', 404);
  const { labOrder, ...context } = await loadResultContext(result);
  assertLabOrderAccess(labOrder, context, actor, readAccessPermissions());
  const versions = await LabResult.find({ lab_order_id: result.lab_order_id })
    .sort({ amendment_version: 1, created_at: 1 })
    .populate('performed_by', 'full_name username employee_code')
    .populate('verified_by', 'full_name username employee_code')
    .lean();
  const items = await LabResultItem.find({ lab_result_id: { $in: versions.map((version) => version._id) } })
    .sort({ display_order: 1, created_at: 1 })
    .lean();
  const itemsByResult = items.reduce((map, item) => {
    const key = String(item.lab_result_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
  return {
    current_result_id: result.is_current === false ? result.superseded_by || result._id : result._id,
    versions: versions.map((version) => ({
      result: version,
      items: itemsByResult.get(String(version._id)) || [],
    })),
  };
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
        specimen.stored_by = actor?.userId;
        specimen.stored_at = new Date();
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
  // listSpecimens: Liệt kê mẫu bệnh phẩm theo worklist.
  listSpecimens,
  // getSpecimenStats: Tổng hợp KPI mẫu bệnh phẩm.
  getSpecimenStats,
  // lookupSpecimen: Tra cứu mẫu bệnh phẩm bằng barcode/specimen no.
  lookupSpecimen,
  // getSpecimenTimeline: Lấy timeline/audit/custody của mẫu bệnh phẩm.
  getSpecimenTimeline,
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
  // printSpecimenLabels: In nhãn hàng loạt.
  printSpecimenLabels,
  // bulkReceiveSpecimens: Nhận mẫu hàng loạt.
  bulkReceiveSpecimens,
  // bulkRejectSpecimens: Từ chối mẫu hàng loạt.
  bulkRejectSpecimens,
  // requestSpecimenRecollection: Yêu cầu lấy lại mẫu.
  requestSpecimenRecollection,
  // getSpecimenCustody: Xem chain-of-custody mẫu.
  getSpecimenCustody,
  // createSpecimenCustodyEvent: Ghi nhận custody event thủ công.
  createSpecimenCustodyEvent,
  // validateLabResultCreation: Kiểm tra tính hợp lệ của điều kiện tạo kết quả xét nghiệm.
  validateLabResultCreation,
  // createLabResult: Tạo kết quả xét nghiệm.
  createLabResult,
  // listLabResults: Liệt kê kết quả xét nghiệm.
  listLabResults,
  // getLabWorkspaceSummary: Tổng hợp KPI/workload lab workspace.
  getLabWorkspaceSummary,
  // getLabWorkspaceOverdue: Liệt kê order quá hạn SLA.
  getLabWorkspaceOverdue,
  // getLabResultDetail: Lấy chi tiết kết quả xét nghiệm.
  getLabResultDetail,
  // getLabResultVersions: Lấy lịch sử version/amend result.
  getLabResultVersions,
  // getLabResultPdf: Lấy payload in/xuất kết quả.
  getLabResultPdf,
  // printLabResult: Ghi nhận lượt in kết quả.
  printLabResult,
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
  // requestLabResultCorrection: Yêu cầu sửa kết quả xét nghiệm.
  requestLabResultCorrection,
  // listLabResultCorrections: Liệt kê yêu cầu sửa kết quả xét nghiệm.
  listLabResultCorrections,
  // getLabResultCorrectionDetail: Lấy chi tiết yêu cầu sửa kết quả xét nghiệm.
  getLabResultCorrectionDetail,
  // resolveLabResultCorrection: Đóng yêu cầu sửa kết quả xét nghiệm.
  resolveLabResultCorrection,
  // cancelLabResultCorrection: Hủy yêu cầu sửa kết quả xét nghiệm.
  cancelLabResultCorrection,
  // listLabTestCatalog: Liệt kê danh mục xét nghiệm.
  listLabTestCatalog,
  // getLabTestCatalogDetail: Lấy chi tiết danh mục xét nghiệm.
  getLabTestCatalogDetail,
  // createLabTestCatalog: Tạo danh mục xét nghiệm.
  createLabTestCatalog,
  // updateLabTestCatalog: Cập nhật danh mục xét nghiệm.
  updateLabTestCatalog,
  // setLabTestCatalogActive: Active/deactivate danh mục xét nghiệm.
  setLabTestCatalogActive,
  // listLabSlaRules: Liệt kê rule SLA xét nghiệm.
  listLabSlaRules,
  // createLabSlaRule: Tạo rule SLA xét nghiệm.
  createLabSlaRule,
  // updateLabSlaRule: Cập nhật rule SLA xét nghiệm.
  updateLabSlaRule,
  // printSpecimenLabel: Ghi nhận lượt in nhãn mẫu.
  printSpecimenLabel,
  // printLabOrderLabels: In nhãn theo lab order.
  printLabOrderLabels,
  // getSpecimenLabelPdf: Lấy payload nhãn mẫu.
  getSpecimenLabelPdf,
  // getMyLabResults: Lấy kết quả xét nghiệm của người dùng hiện tại.
  getMyLabResults,
  // getEncounterLabSummary: Lấy tổng hợp xét nghiệm của lượt khám.
  getEncounterLabSummary,
};

module.exports = withLaboratoryFailureAudits(laboratoryServiceExports);
