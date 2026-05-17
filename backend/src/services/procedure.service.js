const { mongoose } = require('../config/database');
const {
  Attachment,
  AuditLog,
  Charge,
  Department,
  Encounter,
  Order,
  Patient,
  ProcedureOrder,
  ServiceCatalog,
  User,
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
  ATTACHMENT_ENTITY_TYPE,
  ATTACHMENT_STATUS,
  CHARGE_STATUS,
  ENCOUNTER_STATUS,
  ORDER_STATUS,
  ORDER_TYPE,
  PROCEDURE_STATUS,
  SERVICE_STATUS,
  SERVICE_TYPE,
} = require('../constants/statuses');
const {
  ORDER_TRANSITIONS,
  PROCEDURE_TRANSITIONS,
} = require('../constants/transitions');
const { PERMISSION } = require('../constants/permissions');
const { assertTransition, canTransition } = require('../shared/utils/status-transition');
const actorContext = require('../common/actors');
const { withOptionalTransaction } = require('../shared/utils/transaction');

const PROCEDURE_TERMINAL_STATUSES = [
  PROCEDURE_STATUS.COMPLETED,
  PROCEDURE_STATUS.CANCELLED,
  PROCEDURE_STATUS.NO_SHOW,
];

const ACTIVE_ATTACHMENT_STATUSES = [ATTACHMENT_STATUS.ACTIVE];

const ACTIVE_CHARGE_EXCLUDED_STATUSES = [
  CHARGE_STATUS.VOIDED,
  CHARGE_STATUS.CANCELLED,
  CHARGE_STATUS.REFUNDED,
];

const PROCEDURE_TO_ORDER_STATUS = {
  [PROCEDURE_STATUS.ORDERED]: ORDER_STATUS.ORDERED,
  [PROCEDURE_STATUS.SCHEDULED]: ORDER_STATUS.ACKNOWLEDGED,
  [PROCEDURE_STATUS.IN_PROGRESS]: ORDER_STATUS.IN_PROGRESS,
  [PROCEDURE_STATUS.COMPLETED]: ORDER_STATUS.COMPLETED,
  [PROCEDURE_STATUS.CANCELLED]: ORDER_STATUS.CANCELLED,
  [PROCEDURE_STATUS.NO_SHOW]: ORDER_STATUS.CANCELLED,
};

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

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`);
  return date;
}

function toObjectId(id, fieldName = 'id') {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(`${fieldName} không hợp lệ.`);
  return new mongoose.Types.ObjectId(id);
}

function normalizeIdFilterValue(value, fieldName) {
  if (value && typeof value === 'object' && value.$in) {
    return { $in: value.$in.map((item) => toObjectId(item, fieldName)) };
  }
  return toObjectId(value, fieldName);
}

function assertActorUser(actor = {}) {
  if (!actor?.userId) throw createError('Actor hiện tại không phải staff user hợp lệ.', 403);
}

function assertStaffPermission(actor, permissions, message = 'Bạn không có quyền thao tác Procedure Module.') {
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

function assertEncounterOpen(encounter) {
  if (!encounter) throw createError('Không tìm thấy encounter của procedure order.', 409);
  if ([ENCOUNTER_STATUS.COMPLETED, ENCOUNTER_STATUS.CANCELLED].includes(encounter.status)) {
    throw createError('Encounter đã completed/cancelled, không thể thao tác procedure.', 409);
  }
}

function validateProcedureStatusTransition(currentStatus, nextStatus) {
  return assertTransition(PROCEDURE_TRANSITIONS, currentStatus, nextStatus, 'procedure_order');
}

async function generateChargeNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.CHARGE, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

async function getProcedureOrderOrThrow(procedureOrderId, session = null) {
  const procedureOrder = await withSession(ProcedureOrder.findById(procedureOrderId), session);
  if (!procedureOrder) throw createError('Không tìm thấy procedure order.', 404);
  return procedureOrder;
}

async function loadProcedureOrderContext(procedureOrder, session = null) {
  const [order, encounter, patient] = await Promise.all([
    withSession(Order.findById(procedureOrder.order_id).lean(), session),
    withSession(Encounter.findById(procedureOrder.encounter_id).lean(), session),
    withSession(Patient.findById(procedureOrder.patient_id).lean(), session),
  ]);

  if (!order) throw createError('Không tìm thấy order mẹ của procedure order.', 409);
  if (order.order_type !== ORDER_TYPE.PROCEDURE) throw createError('Order mẹ không phải procedure order.', 409);
  if (!encounter) throw createError('Không tìm thấy encounter của procedure order.', 409);
  assertPatientActive(patient);

  return { order, encounter, patient };
}

function readAccessPermissions() {
  return {
    global: [
      PERMISSION.PROCEDURE_ORDERS.READ,
      PERMISSION.ORDERS.READ,
      PERMISSION.ORDERS.READ_PROCEDURE,
    ],
    own: [
      PERMISSION.PROCEDURE_ORDERS.READ_OWN,
      PERMISSION.ORDERS.READ_OWN,
      PERMISSION.ENCOUNTERS.READ_OWN,
    ],
    department: [
      PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
      PERMISSION.ORDERS.READ_DEPARTMENT,
      PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    ],
  };
}

function writeAccessPermissions(extra = []) {
  return {
    global: [
      PERMISSION.PROCEDURE_ORDERS.READ,
      PERMISSION.ORDERS.READ_PROCEDURE,
      ...extra,
    ],
    own: [
      PERMISSION.PROCEDURE_ORDERS.READ_OWN,
      PERMISSION.ORDERS.READ_OWN,
    ],
    department: [
      PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
      PERMISSION.ORDERS.READ_DEPARTMENT,
    ],
  };
}

function assertProcedureOrderAccess(procedureOrder, context, actor = {}, permissions = {}) {
  if (!actorType(actor)) return true;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;

  if (actorType(actor) === 'patient') {
    if (
      sameId(procedureOrder.patient_id, actor.patientId || actor.patient_id)
      && procedureOrder.status === PROCEDURE_STATUS.COMPLETED
      && hasPermission(actor, PERMISSION.PROCEDURE_ORDERS.SELF_READ_COMPLETED)
    ) {
      return true;
    }
    throw createError('Bạn không có quyền xem procedure order này.', 403);
  }

  if (hasAnyPermission(actor, permissions.global || [])) return true;

  if (
    actor.userId
    && (
      sameId(procedureOrder.requested_by, actor.userId)
      || sameId(procedureOrder.performer_id, actor.userId)
      || sameId(context?.order?.ordered_by, actor.userId)
      || sameId(context?.encounter?.attending_doctor_id, actor.userId)
    )
    && hasAnyPermission(actor, permissions.own || [])
  ) {
    return true;
  }

  const departmentId = actorDepartmentId(actor);
  if (
    departmentId
    && (
      sameId(procedureOrder.department_id, departmentId)
      || sameId(context?.order?.department_id, departmentId)
      || sameId(context?.encounter?.department_id, departmentId)
    )
    && hasAnyPermission(actor, permissions.department || [])
  ) {
    return true;
  }

  throw createError('Bạn không có quyền thao tác procedure order này.', 403);
}

function assertEncounterReadAccess(encounter, actor = {}) {
  if (!actorType(actor)) return true;
  if (hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.ENCOUNTERS.READ,
    PERMISSION.ORDERS.READ,
    PERMISSION.PROCEDURE_ORDERS.READ,
    PERMISSION.ORDERS.READ_PROCEDURE,
  ])) return true;

  if (
    actor.userId
    && sameId(encounter.attending_doctor_id, actor.userId)
    && hasAnyPermission(actor, [
      PERMISSION.ENCOUNTERS.READ_OWN,
      PERMISSION.ORDERS.READ_OWN,
      PERMISSION.PROCEDURE_ORDERS.READ_OWN,
    ])
  ) return true;

  const departmentId = actorDepartmentId(actor);
  if (
    departmentId
    && sameId(encounter.department_id, departmentId)
    && hasAnyPermission(actor, [
      PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
      PERMISSION.ORDERS.READ_DEPARTMENT,
      PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
    ])
  ) return true;

  throw createError('Bạn không có quyền xem procedure summary của encounter này.', 403);
}

function addFilterCondition(filter, condition) {
  if (!condition || Object.keys(condition).length === 0) return;
  filter.$and = filter.$and || [];
  filter.$and.push(condition);
}

async function buildProcedureScopeCondition(query = {}, actor = {}) {
  if (!actorType(actor)) return null;
  if (hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.PROCEDURE_ORDERS.READ,
    PERMISSION.ORDERS.READ,
    PERMISSION.ORDERS.READ_PROCEDURE,
  ])) return null;

  if (actorType(actor) === 'patient') {
    const patientId = actor.patientId || actor.patient_id;
    if (!patientId || !hasPermission(actor, PERMISSION.PROCEDURE_ORDERS.SELF_READ_COMPLETED)) {
      throw createError('Bạn không có quyền xem danh sách procedure order.', 403);
    }
    return { patient_id: toObjectId(patientId, 'patientId'), status: PROCEDURE_STATUS.COMPLETED };
  }

  if (actor.userId && hasAnyPermission(actor, [PERMISSION.PROCEDURE_ORDERS.READ_OWN, PERMISSION.ORDERS.READ_OWN])) {
    const userObjectId = toObjectId(actor.userId, 'userId');
    const [orders, encounters] = await Promise.all([
      Order.find({ order_type: ORDER_TYPE.PROCEDURE, ordered_by: actor.userId }).select('_id').lean(),
      Encounter.find({ attending_doctor_id: actor.userId }).select('_id').lean(),
    ]);
    return {
      $or: [
        { requested_by: userObjectId },
        { performer_id: userObjectId },
        { order_id: { $in: orders.map((order) => order._id) } },
        { encounter_id: { $in: encounters.map((encounter) => encounter._id) } },
      ],
    };
  }

  const departmentId = actorDepartmentId(actor);
  if (departmentId && hasAnyPermission(actor, [PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT, PERMISSION.ORDERS.READ_DEPARTMENT])) {
    const departmentObjectId = toObjectId(departmentId, 'departmentId');
    const [orders, encounters] = await Promise.all([
      Order.find({ order_type: ORDER_TYPE.PROCEDURE, department_id: departmentId }).select('_id').lean(),
      Encounter.find({ department_id: departmentId }).select('_id').lean(),
    ]);
    return {
      $or: [
        { department_id: departmentObjectId },
        { order_id: { $in: orders.map((order) => order._id) } },
        { encounter_id: { $in: encounters.map((encounter) => encounter._id) } },
      ],
    };
  }

  throw createError('Bạn không có quyền xem danh sách procedure order.', 403);
}

function applyDateRange(filter, query = {}, fieldName, fromKey = 'date_from', toKey = 'date_to') {
  if (query[fromKey] || query[toKey]) {
    filter[fieldName] = {};
    if (query[fromKey]) filter[fieldName].$gte = parseDate(query[fromKey], fromKey);
    if (query[toKey]) filter[fieldName].$lte = parseDate(query[toKey], toKey);
  }
}

async function buildProcedureListFilter(query = {}, actor = {}) {
  const filter = {};
  for (const field of [
    'status',
    'priority',
    'procedure_code',
  ]) {
    if (query[field]) filter[field] = query[field];
  }
  for (const field of ['patient_id', 'encounter_id', 'requested_by', 'performer_id', 'department_id']) {
    if (query[field]) filter[field] = normalizeIdFilterValue(query[field], field);
  }

  applyDateRange(filter, query, 'created_at');
  applyDateRange(filter, query, 'scheduled_start', 'scheduled_from', 'scheduled_to');
  applyDateRange(filter, query, 'performed_start', 'performed_from', 'performed_to');

  if (query.search || query.procedure_name) {
    const keyword = escapeRegex(query.search || query.procedure_name);
    filter.$or = [
      { procedure_order_no: { $regex: keyword, $options: 'i' } },
      { procedure_name: { $regex: keyword, $options: 'i' } },
      { procedure_code: { $regex: keyword, $options: 'i' } },
    ];
  }

  const scopeCondition = await buildProcedureScopeCondition(query, actor);
  addFilterCondition(filter, scopeCondition);
  return filter;
}

async function listProcedureOrders(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildProcedureListFilter(query, actor);

  const [items, total] = await Promise.all([
    ProcedureOrder.find(filter)
      .sort({ scheduled_start: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('encounter_id', 'encounter_code encounter_type status start_time')
      .populate('requested_by', 'full_name username employee_code')
      .populate('performer_id', 'full_name username employee_code')
      .populate('department_id', 'department_code department_name')
      .populate('order_id', 'order_no status priority department_id ordered_at service_id charge_id is_billable')
      .lean(),
    ProcedureOrder.countDocuments(filter),
  ]);

  const orderIds = items.map((item) => item.order_id?._id || item.order_id).filter(Boolean);
  const charges = orderIds.length
    ? await Charge.find({
      order_id: { $in: orderIds },
      status: { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES },
    }).lean()
    : [];

  const chargeByOrder = new Map();
  for (const charge of charges) {
    const key = String(charge.order_id);
    const current = chargeByOrder.get(key) || { total_amount: 0, statuses: new Set(), charge_count: 0 };
    current.total_amount += Number(charge.total_amount || 0);
    current.statuses.add(charge.status);
    current.charge_count += 1;
    chargeByOrder.set(key, current);
  }

  return {
    items: items.map((item) => {
      const orderId = String(item.order_id?._id || item.order_id || '');
      const chargeSummary = chargeByOrder.get(orderId);
      return {
        ...item,
        charge_summary: chargeSummary
          ? {
            total_amount: chargeSummary.total_amount,
            statuses: [...chargeSummary.statuses],
            charge_count: chargeSummary.charge_count,
          }
          : null,
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

function getAllowedProcedureActions(procedureOrder, actor = {}) {
  return {
    can_schedule: [PROCEDURE_STATUS.ORDERED, PROCEDURE_STATUS.SCHEDULED].includes(procedureOrder.status)
      && hasPermission(actor, PERMISSION.PROCEDURE_ORDERS.SCHEDULE),
    can_start: [PROCEDURE_STATUS.ORDERED, PROCEDURE_STATUS.SCHEDULED].includes(procedureOrder.status)
      && hasPermission(actor, PERMISSION.PROCEDURE_ORDERS.START),
    can_complete: procedureOrder.status === PROCEDURE_STATUS.IN_PROGRESS
      && hasPermission(actor, PERMISSION.PROCEDURE_ORDERS.COMPLETE),
    can_cancel: !PROCEDURE_TERMINAL_STATUSES.includes(procedureOrder.status)
      && hasAnyPermission(actor, [PERMISSION.PROCEDURE_ORDERS.CANCEL, PERMISSION.ORDERS.CANCEL]),
    can_no_show: [PROCEDURE_STATUS.ORDERED, PROCEDURE_STATUS.SCHEDULED].includes(procedureOrder.status)
      && hasPermission(actor, PERMISSION.PROCEDURE_ORDERS.NO_SHOW),
    can_upload_attachment: ![PROCEDURE_STATUS.CANCELLED, PROCEDURE_STATUS.NO_SHOW].includes(procedureOrder.status)
      && hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD]),
    can_create_charge: procedureOrder.status === PROCEDURE_STATUS.COMPLETED
      && hasAnyPermission(actor, [
        PERMISSION.PROCEDURE_ORDERS.CHARGE_CREATE,
        PERMISSION.CHARGES.CREATE,
        PERMISSION.CHARGES.REQUEST_CREATE,
        PERMISSION.ORDERS.CREATE_CHARGE,
      ]),
  };
}

function sanitizeAttachmentForActor(attachment, actor = {}) {
  if (actorType(actor) !== 'patient') return attachment;
  const {
    storage_path: _storagePath,
    checksum: _checksum,
    ...safeAttachment
  } = attachment;
  return safeAttachment;
}

async function getProcedureOrderDetail(procedureOrderId, actor = {}) {
  const procedureOrder = await ProcedureOrder.findById(procedureOrderId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time')
    .populate('requested_by', 'full_name username employee_code')
    .populate('performer_id', 'full_name username employee_code')
    .populate('department_id', 'department_code department_name')
    .populate('scheduled_by', 'full_name username employee_code')
    .populate('started_by', 'full_name username employee_code')
    .populate('completed_by', 'full_name username employee_code')
    .populate('cancelled_by', 'full_name username employee_code')
    .populate('no_show_by', 'full_name username employee_code')
    .populate('order_id', 'order_no status priority department_id ordered_at clinical_indication service_id charge_id is_billable')
    .lean();
  if (!procedureOrder) throw createError('Không tìm thấy procedure order.', 404);

  const rawProcedureOrder = await ProcedureOrder.findById(procedureOrderId).lean();
  const context = await loadProcedureOrderContext(rawProcedureOrder);
  assertProcedureOrderAccess(rawProcedureOrder, context, actor, readAccessPermissions());

  const [attachments, charges, logs] = await Promise.all([
    Attachment.find({
      order_id: context.order._id,
      status: { $in: ACTIVE_ATTACHMENT_STATUSES },
    }).sort({ created_at: -1 }).lean(),
    Charge.find({ order_id: context.order._id }).sort({ charged_at: -1, created_at: -1 }).lean(),
    AuditLog.find({
      $or: [
        { target_type: 'procedure_order', target_id: procedureOrderId },
        { target_type: 'order', target_id: context.order._id },
        { 'metadata.procedure_order_id': String(procedureOrderId) },
      ],
    }).sort({ created_at: -1 }).limit(30).lean(),
  ]);

  return {
    procedure_order: procedureOrder,
    attachments: attachments.map((attachment) => sanitizeAttachmentForActor(attachment, actor)),
    charges,
    activity: logs,
    allowed_actions: getAllowedProcedureActions(rawProcedureOrder, actor),
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

async function syncProcedureStatusToParentOrder(procedureOrder, actor, session = null) {
  const nextOrderStatus = PROCEDURE_TO_ORDER_STATUS[procedureOrder.status];
  if (!nextOrderStatus) return null;
  return updateOrderStatus(procedureOrder.order_id, nextOrderStatus, actor, session);
}

async function updateProcedureStatus(procedureOrder, nextStatus, actor, session = null, extra = {}) {
  if (procedureOrder.status !== nextStatus) {
    validateProcedureStatusTransition(procedureOrder.status, nextStatus);
    procedureOrder.status = nextStatus;
  }

  const now = extra.now || new Date();
  if (nextStatus === PROCEDURE_STATUS.SCHEDULED) {
    procedureOrder.scheduled_by = actor?.userId;
    procedureOrder.scheduled_at = now;
  }
  if (nextStatus === PROCEDURE_STATUS.IN_PROGRESS) {
    procedureOrder.started_by = actor?.userId;
    procedureOrder.started_at = now;
    procedureOrder.performed_start = extra.performed_start || procedureOrder.performed_start || now;
  }
  if (nextStatus === PROCEDURE_STATUS.COMPLETED) {
    procedureOrder.completed_by = actor?.userId;
    procedureOrder.completed_at = now;
    procedureOrder.performed_end = extra.performed_end || procedureOrder.performed_end || now;
  }
  if (nextStatus === PROCEDURE_STATUS.CANCELLED) {
    procedureOrder.cancelled_by = actor?.userId;
    procedureOrder.cancelled_at = now;
    procedureOrder.cancel_reason = extra.reason || procedureOrder.cancel_reason;
  }
  if (nextStatus === PROCEDURE_STATUS.NO_SHOW) {
    procedureOrder.no_show_by = actor?.userId;
    procedureOrder.no_show_at = now;
    procedureOrder.no_show_reason = extra.reason || procedureOrder.no_show_reason;
  }

  procedureOrder.updated_by = actor?.userId;
  await procedureOrder.save(sessionOptions(session));
  return procedureOrder;
}

async function validateActiveUser(userId, fieldName, session = null) {
  if (!userId) return null;
  const user = await withSession(User.findById(userId).lean(), session);
  if (!user || user.is_deleted) throw createError(`Không tìm thấy ${fieldName}.`, 404);
  if (user.status !== 'active') throw createError(`${fieldName} không active.`, 409);
  return user;
}

async function validateActiveDepartment(departmentId, session = null) {
  if (!departmentId) return null;
  const department = await withSession(Department.findById(departmentId).lean(), session);
  if (!department || department.is_deleted) throw createError('Không tìm thấy department.', 404);
  if (department.status !== 'active') throw createError('Department không active.', 409);
  return department;
}

function assertParentOrderProcessable(order) {
  if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.ENTERED_IN_ERROR, ORDER_STATUS.COMPLETED].includes(order.status)) {
    throw createError('Order mẹ đã cancelled/completed/entered_in_error.', 409);
  }
}

async function checkProcedureCanBeScheduled(procedureOrder, payload = {}, context, actor, session = null) {
  if (![PROCEDURE_STATUS.ORDERED, PROCEDURE_STATUS.SCHEDULED].includes(procedureOrder.status)) {
    throw createError('Chỉ procedure order ordered/scheduled mới được schedule.', 409);
  }
  assertParentOrderProcessable(context.order);
  assertEncounterOpen(context.encounter);

  const scheduledStart = parseDate(payload.scheduled_start, 'scheduled_start');
  const scheduledEnd = parseDate(payload.scheduled_end, 'scheduled_end');
  if (!scheduledStart) throw createError('scheduled_start là bắt buộc.');
  if (scheduledEnd && scheduledStart >= scheduledEnd) throw createError('scheduled_start phải nhỏ hơn scheduled_end.');
  if (scheduledStart < new Date() && !payload.allow_past_schedule) {
    throw createError('scheduled_start không được ở quá khứ.', 409);
  }

  if (payload.performer_id) await validateActiveUser(payload.performer_id, 'performer_id', session);
  if (payload.department_id) await validateActiveDepartment(payload.department_id, session);

  assertProcedureOrderAccess(
    procedureOrder,
    context,
    actor,
    writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.SCHEDULE, PERMISSION.ORDERS.ACKNOWLEDGE]),
  );

  return { scheduledStart, scheduledEnd };
}

function assertAssignedPerformerAllowed(procedureOrder, actor, payload = {}, actionLabel = 'thao tác') {
  if (!procedureOrder.performer_id || sameId(procedureOrder.performer_id, actor?.userId)) return true;
  if (
    payload.override_performer
    && hasAnyPermission(actor, [
      PERMISSION.PROCEDURE_ORDERS.UPDATE,
      PERMISSION.PROCEDURE_ORDERS.SCHEDULE,
      PERMISSION.SYSTEM.FULL_ACCESS,
    ])
  ) return true;

  throw createError(`Procedure đã có performer khác, không thể ${actionLabel} nếu không có override_performer.`, 403);
}

async function checkProcedureCanStart(procedureOrder, payload = {}, context, actor) {
  if (![PROCEDURE_STATUS.ORDERED, PROCEDURE_STATUS.SCHEDULED].includes(procedureOrder.status)) {
    throw createError('Procedure order phải ordered/scheduled trước khi start.', 409);
  }
  if (![ORDER_STATUS.ORDERED, ORDER_STATUS.ACKNOWLEDGED, ORDER_STATUS.IN_PROGRESS].includes(context.order.status)) {
    throw createError('Order mẹ không ở trạng thái cho phép start procedure.', 409);
  }
  assertEncounterOpen(context.encounter);
  assertAssignedPerformerAllowed(procedureOrder, actor, payload, 'start');
  assertProcedureOrderAccess(
    procedureOrder,
    context,
    actor,
    writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.START, PERMISSION.ORDERS.START]),
  );
  return true;
}

async function checkProcedureCanComplete(procedureOrder, payload = {}, context, actor, session = null) {
  if (procedureOrder.status !== PROCEDURE_STATUS.IN_PROGRESS) {
    throw createError('Chỉ procedure order in_progress mới được complete.', 409);
  }
  assertEncounterOpen(context.encounter);
  assertAssignedPerformerAllowed(procedureOrder, actor, payload, 'complete');

  const performedEnd = parseDate(payload.performed_end, 'performed_end') || new Date();
  const performedStart = procedureOrder.performed_start || parseDate(payload.performed_start, 'performed_start') || new Date();
  if (performedEnd < performedStart) throw createError('performed_end phải lớn hơn hoặc bằng performed_start.', 409);
  if (!nonEmpty(payload.result_note) && !payload.allow_empty_result_note) {
    throw createError('result_note là bắt buộc khi complete procedure.', 409);
  }

  if (payload.require_attachment) {
    const attachmentExists = await withSession(Attachment.exists({
      order_id: procedureOrder.order_id,
      status: ATTACHMENT_STATUS.ACTIVE,
    }), session);
    if (!attachmentExists) throw createError('Cần ít nhất một procedure attachment trước khi complete.', 409);
  }

  assertProcedureOrderAccess(
    procedureOrder,
    context,
    actor,
    writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.ORDERS.COMPLETE]),
  );
  return { performedStart, performedEnd };
}

async function checkProcedureCanCancel(procedureOrder, payload = {}, context, actor) {
  if (PROCEDURE_TERMINAL_STATUSES.includes(procedureOrder.status)) {
    throw createError('Procedure order đã ở trạng thái kết thúc.', 409);
  }
  if (
    procedureOrder.status === PROCEDURE_STATUS.IN_PROGRESS
    && !payload.force
    && !hasAnyPermission(actor, [PERMISSION.ORDERS.OVERRIDE_CANCEL_IN_PROGRESS, PERMISSION.SYSTEM.FULL_ACCESS])
  ) {
    throw createError('Procedure order đang in_progress, cần force/override để cancel.', 409);
  }

  assertProcedureOrderAccess(
    procedureOrder,
    context,
    actor,
    writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.CANCEL, PERMISSION.ORDERS.CANCEL]),
  );
  return true;
}

async function checkProcedureCanNoShow(procedureOrder, payload = {}, context, actor) {
  if (![PROCEDURE_STATUS.ORDERED, PROCEDURE_STATUS.SCHEDULED].includes(procedureOrder.status)) {
    throw createError('Chỉ ordered/scheduled procedure order mới được mark no_show.', 409);
  }
  if (procedureOrder.performed_start) throw createError('Procedure đã bắt đầu thực hiện, không thể no_show.', 409);

  const scheduledStart = procedureOrder.scheduled_start;
  if (!scheduledStart && !payload.force) {
    throw createError('Procedure chưa có scheduled_start, cần force để mark no_show.', 409);
  }
  if (scheduledStart && scheduledStart > new Date() && !payload.force) {
    throw createError('Chưa tới scheduled_start, không thể mark no_show.', 409);
  }

  assertProcedureOrderAccess(
    procedureOrder,
    context,
    actor,
    writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.NO_SHOW, PERMISSION.PROCEDURE_ORDERS.UPDATE]),
  );
  return true;
}

async function scheduleProcedure(procedureOrderId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.SCHEDULE, PERMISSION.ORDERS.ACKNOWLEDGE]);

  let scheduledStart;
  await withOptionalTransaction(async (session) => {
    const procedureOrder = await getProcedureOrderOrThrow(procedureOrderId, session);
    const context = await loadProcedureOrderContext(procedureOrder, session);
    const validation = await checkProcedureCanBeScheduled(procedureOrder, payload, context, actor, session);
    scheduledStart = validation.scheduledStart;

    procedureOrder.scheduled_start = validation.scheduledStart;
    procedureOrder.scheduled_end = validation.scheduledEnd || undefined;
    if (payload.performer_id !== undefined) procedureOrder.performer_id = payload.performer_id || undefined;
    if (payload.department_id !== undefined) procedureOrder.department_id = payload.department_id || undefined;
    await updateProcedureStatus(procedureOrder, PROCEDURE_STATUS.SCHEDULED, actor, session);
    await syncProcedureStatusToParentOrder(procedureOrder, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'procedure_order.scheduled',
    targetType: 'procedure_order',
    targetId: procedureOrderId,
    status: 'success',
    message: 'Schedule procedure order thành công.',
    requestMeta,
    metadata: { scheduled_start: scheduledStart, performer_id: payload.performer_id || null },
  });
  return getProcedureOrderDetail(procedureOrderId, actor);
}

async function startProcedure(procedureOrderId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.START, PERMISSION.ORDERS.START]);

  await withOptionalTransaction(async (session) => {
    const procedureOrder = await getProcedureOrderOrThrow(procedureOrderId, session);
    const context = await loadProcedureOrderContext(procedureOrder, session);
    await checkProcedureCanStart(procedureOrder, payload, context, actor);

    if (!procedureOrder.performer_id) procedureOrder.performer_id = actor.userId;
    await updateProcedureStatus(procedureOrder, PROCEDURE_STATUS.IN_PROGRESS, actor, session, {
      performed_start: parseDate(payload.performed_start, 'performed_start') || new Date(),
    });
    await syncProcedureStatusToParentOrder(procedureOrder, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'procedure_order.started',
    targetType: 'procedure_order',
    targetId: procedureOrderId,
    status: 'success',
    message: 'Start procedure order thành công.',
    requestMeta,
  });
  return getProcedureOrderDetail(procedureOrderId, actor);
}

async function completeProcedure(procedureOrderId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.ORDERS.COMPLETE]);

  let chargeId = null;
  await withOptionalTransaction(async (session) => {
    const procedureOrder = await getProcedureOrderOrThrow(procedureOrderId, session);
    const context = await loadProcedureOrderContext(procedureOrder, session);
    const validation = await checkProcedureCanComplete(procedureOrder, payload, context, actor, session);

    procedureOrder.performed_start = procedureOrder.performed_start || validation.performedStart;
    procedureOrder.result_note = payload.result_note !== undefined ? payload.result_note : procedureOrder.result_note;
    await updateProcedureStatus(procedureOrder, PROCEDURE_STATUS.COMPLETED, actor, session, {
      performed_end: validation.performedEnd,
    });
    await syncProcedureStatusToParentOrder(procedureOrder, actor, session);

    if (payload.create_charge !== false && context.order.is_billable) {
      const charge = await createProcedureChargeInternal(procedureOrder, payload.charge || payload, actor, session, {
        requireCompleted: true,
        silentIfNoBillableService: true,
      });
      chargeId = charge?._id || null;
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'procedure_order.completed',
    targetType: 'procedure_order',
    targetId: procedureOrderId,
    status: 'success',
    message: 'Complete procedure order thành công.',
    requestMeta,
    metadata: { charge_id: chargeId },
  });
  await notifyDoctorProcedureLifecycle(procedureOrderId, actor, { event: 'completed' });
  return getProcedureOrderDetail(procedureOrderId, actor);
}

async function voidProcedureChargeIfCancelled(orderId, reason, actor, session = null) {
  const charges = await withSession(Charge.find({
    order_id: orderId,
    status: { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES },
  }), session);

  for (const charge of charges) {
    if (charge.invoice_id || charge.status === CHARGE_STATUS.BILLED) {
      throw createError('Procedure order đã có charge lên invoice, cần Billing Module xử lý adjustment/refund.', 409);
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

async function cancelProcedure(procedureOrderId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.CANCEL, PERMISSION.ORDERS.CANCEL]);
  const reason = payload.reason || payload.cancel_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi cancel procedure order.');

  let voidedCharges = 0;
  await withOptionalTransaction(async (session) => {
    const procedureOrder = await getProcedureOrderOrThrow(procedureOrderId, session);
    const context = await loadProcedureOrderContext(procedureOrder, session);
    await checkProcedureCanCancel(procedureOrder, payload, context, actor);

    voidedCharges = await voidProcedureChargeIfCancelled(procedureOrder.order_id, reason, actor, session);
    await updateProcedureStatus(procedureOrder, PROCEDURE_STATUS.CANCELLED, actor, session, { reason });
    await syncProcedureStatusToParentOrder(procedureOrder, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'procedure_order.cancelled',
    targetType: 'procedure_order',
    targetId: procedureOrderId,
    status: 'success',
    message: 'Cancel procedure order thành công.',
    requestMeta,
    metadata: { reason, voided_charges: voidedCharges },
  });
  await notifyDoctorProcedureLifecycle(procedureOrderId, actor, { event: 'cancelled', reason });
  return getProcedureOrderDetail(procedureOrderId, actor);
}

async function noShowProcedure(procedureOrderId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.NO_SHOW, PERMISSION.PROCEDURE_ORDERS.UPDATE]);
  const reason = payload.reason || payload.no_show_reason || 'no_show';

  let voidedCharges = 0;
  await withOptionalTransaction(async (session) => {
    const procedureOrder = await getProcedureOrderOrThrow(procedureOrderId, session);
    const context = await loadProcedureOrderContext(procedureOrder, session);
    await checkProcedureCanNoShow(procedureOrder, payload, context, actor);

    voidedCharges = await voidProcedureChargeIfCancelled(procedureOrder.order_id, reason, actor, session);
    await updateProcedureStatus(procedureOrder, PROCEDURE_STATUS.NO_SHOW, actor, session, { reason });
    await syncProcedureStatusToParentOrder(procedureOrder, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'procedure_order.no_show',
    targetType: 'procedure_order',
    targetId: procedureOrderId,
    status: 'success',
    message: 'Mark procedure order no_show thành công.',
    requestMeta,
    metadata: { reason, voided_charges: voidedCharges },
  });
  await notifyDoctorProcedureLifecycle(procedureOrderId, actor, { event: 'no_show', reason });
  return getProcedureOrderDetail(procedureOrderId, actor);
}

async function resolveProcedureService(procedureOrder, payload = {}, context = null, session = null) {
  const order = context?.order || await withSession(Order.findById(procedureOrder.order_id).lean(), session);
  const serviceId = payload.service_id || order?.service_id;
  let service = null;

  if (serviceId) {
    service = await withSession(ServiceCatalog.findById(serviceId).lean(), session);
  } else if (procedureOrder.procedure_code) {
    service = await withSession(ServiceCatalog.findOne({
      service_code: procedureOrder.procedure_code,
      service_type: SERVICE_TYPE.PROCEDURE,
      is_deleted: false,
    }).lean(), session);
  }

  if (!service || service.is_deleted) return null;
  if (service.status !== SERVICE_STATUS.ACTIVE) throw createError('Service catalog không active.', 409);
  if (service.service_type !== SERVICE_TYPE.PROCEDURE) {
    throw createError('service_type không tương thích với procedure order.', 409);
  }
  return service;
}

async function createProcedureChargeInternal(procedureOrder, payload = {}, actor, session = null, options = {}) {
  const context = await loadProcedureOrderContext(procedureOrder, session);
  assertProcedureOrderAccess(
    procedureOrder,
    context,
    actor,
    writeAccessPermissions([
      PERMISSION.PROCEDURE_ORDERS.CHARGE_CREATE,
      PERMISSION.CHARGES.CREATE,
      PERMISSION.CHARGES.REQUEST_CREATE,
      PERMISSION.ORDERS.CREATE_CHARGE,
    ]),
  );

  if ([PROCEDURE_STATUS.CANCELLED, PROCEDURE_STATUS.NO_SHOW].includes(procedureOrder.status)) {
    throw createError('Không tạo charge cho procedure cancelled/no_show.', 409);
  }
  if (options.requireCompleted !== false && procedureOrder.status !== PROCEDURE_STATUS.COMPLETED) {
    throw createError('Chỉ procedure completed mới được tạo charge.', 409);
  }

  const service = await resolveProcedureService(procedureOrder, payload, context, session);
  if (!service) {
    if (options.silentIfNoBillableService) return null;
    throw createError('Procedure order chưa có service catalog để tạo charge.', 409);
  }
  if (!service.is_billable) {
    if (options.silentIfNoBillableService) return null;
    throw createError('Service catalog này không billable.', 409);
  }

  const existing = await withSession(Charge.findOne({
    order_id: procedureOrder.order_id,
    status: { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES },
  }).lean(), session);
  if (existing) throw createError('Procedure order đã có charge active.', 409);

  const quantity = Number(payload.quantity || 1);
  const discountAmount = Number(payload.discount_amount || 0);
  const taxAmount = Number(payload.tax_amount || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) throw createError('quantity tính phí phải lớn hơn 0.');
  if (!Number.isFinite(discountAmount) || discountAmount < 0) throw createError('discount_amount không hợp lệ.');
  if (!Number.isFinite(taxAmount) || taxAmount < 0) throw createError('tax_amount không hợp lệ.');

  const unitPrice = Number(service.unit_price || 0);
  const totalAmount = Math.max((quantity * unitPrice) - discountAmount + taxAmount, 0);
  const chargeNo = payload.charge_no || await generateChargeNumber({ session });
  const chargeStatus = payload.status || CHARGE_STATUS.POSTED;
  if (![CHARGE_STATUS.DRAFT, CHARGE_STATUS.POSTED].includes(chargeStatus)) {
    throw createError('Procedure Module chỉ được tạo charge draft/posted.', 409);
  }
  const [charge] = await Charge.create([{
    patient_id: procedureOrder.patient_id,
    encounter_id: procedureOrder.encounter_id,
    admission_id: context.order.admission_id,
    service_id: service._id,
    order_id: procedureOrder.order_id,
    charge_no: chargeNo,
    description: payload.description || payload.charge_description || procedureOrder.procedure_name || service.service_name,
    quantity,
    unit_price: unitPrice,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    charged_at: payload.charged_at ? parseDate(payload.charged_at, 'charged_at') : new Date(),
    status: chargeStatus,
    created_by: actor?.userId,
    updated_by: actor?.userId,
  }], sessionOptions(session));

  await withSession(Order.updateOne({ _id: procedureOrder.order_id }, {
    $set: {
      charge_id: charge._id,
      is_billable: true,
      updated_by: actor?.userId,
    },
  }), session);

  return charge;
}

async function createProcedureCharge(procedureOrderId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [
    PERMISSION.PROCEDURE_ORDERS.CHARGE_CREATE,
    PERMISSION.CHARGES.CREATE,
    PERMISSION.CHARGES.REQUEST_CREATE,
    PERMISSION.ORDERS.CREATE_CHARGE,
  ]);

  let chargeId = null;
  await withOptionalTransaction(async (session) => {
    const procedureOrder = await getProcedureOrderOrThrow(procedureOrderId, session);
    const charge = await createProcedureChargeInternal(procedureOrder, payload, actor, session, {
      requireCompleted: payload.allow_before_complete ? false : true,
    });
    chargeId = charge?._id || null;
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'procedure_order.charge_created',
    targetType: 'procedure_order',
    targetId: procedureOrderId,
    status: 'success',
    message: 'Tạo charge cho procedure order thành công.',
    requestMeta,
    metadata: { charge_id: chargeId },
  });
  return Charge.findById(chargeId).lean();
}

async function listProcedureCharges(procedureOrderId, actor = {}) {
  const procedureOrder = await ProcedureOrder.findById(procedureOrderId).lean();
  if (!procedureOrder) throw createError('Không tìm thấy procedure order.', 404);
  const context = await loadProcedureOrderContext(procedureOrder);
  assertProcedureOrderAccess(procedureOrder, context, actor, readAccessPermissions());
  const charges = await Charge.find({ order_id: procedureOrder.order_id }).sort({ charged_at: -1, created_at: -1 }).lean();
  return { items: charges };
}

function validateAttachmentPayload(payload = {}) {
  if (!nonEmpty(payload.file_name)) throw createError('file_name là bắt buộc.');
  if (!nonEmpty(payload.storage_path)) throw createError('storage_path là bắt buộc.');
  const fileSize = payload.file_size !== undefined ? Number(payload.file_size) : undefined;
  if (fileSize !== undefined && (!Number.isFinite(fileSize) || fileSize < 0)) {
    throw createError('file_size không hợp lệ.');
  }
  return {
    file_name: normalizeString(payload.file_name),
    original_name: payload.original_name ? normalizeString(payload.original_name) : undefined,
    mime_type: payload.mime_type ? normalizeString(payload.mime_type) : undefined,
    file_size: fileSize,
    storage_path: normalizeString(payload.storage_path),
    checksum: payload.checksum ? normalizeString(payload.checksum) : undefined,
    category: normalizeString(payload.category) || 'procedure_result',
    description: payload.description,
  };
}

async function uploadProcedureAttachment(procedureOrderId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD]);
  const normalized = validateAttachmentPayload(payload);
  let attachmentId;

  await withOptionalTransaction(async (session) => {
    const procedureOrder = await getProcedureOrderOrThrow(procedureOrderId, session);
    const context = await loadProcedureOrderContext(procedureOrder, session);
    assertProcedureOrderAccess(
      procedureOrder,
      context,
      actor,
      writeAccessPermissions([PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD]),
    );
    if ([PROCEDURE_STATUS.CANCELLED, PROCEDURE_STATUS.NO_SHOW].includes(procedureOrder.status)) {
      throw createError('Không upload attachment vào procedure order cancelled/no_show.', 409);
    }
    if (normalized.checksum) {
      const duplicate = await withSession(Attachment.exists({
        order_id: procedureOrder.order_id,
        checksum: normalized.checksum,
        status: ATTACHMENT_STATUS.ACTIVE,
      }), session);
      if (duplicate) throw createError('Attachment checksum đã tồn tại cho procedure order này.', 409);
    }

    const [attachment] = await Attachment.create([{
      patient_id: procedureOrder.patient_id,
      encounter_id: procedureOrder.encounter_id,
      order_id: procedureOrder.order_id,
      entity_type: ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER,
      entity_id: procedureOrder._id,
      uploaded_by: actor?.userId,
      ...normalized,
      status: ATTACHMENT_STATUS.ACTIVE,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    attachmentId = attachment._id;
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'procedure_attachment.uploaded',
    targetType: 'attachment',
    targetId: attachmentId,
    status: 'success',
    message: 'Upload procedure attachment thành công.',
    requestMeta,
    metadata: { procedure_order_id: String(procedureOrderId) },
  });
  return Attachment.findById(attachmentId).lean();
}

async function listProcedureAttachments(procedureOrderId, actor = {}) {
  const procedureOrder = await ProcedureOrder.findById(procedureOrderId).lean();
  if (!procedureOrder) throw createError('Không tìm thấy procedure order.', 404);
  const context = await loadProcedureOrderContext(procedureOrder);
  assertProcedureOrderAccess(procedureOrder, context, actor, readAccessPermissions());
  const attachments = await Attachment.find({
    order_id: procedureOrder.order_id,
    status: ATTACHMENT_STATUS.ACTIVE,
  }).sort({ created_at: -1 }).lean();
  return { items: attachments.map((attachment) => sanitizeAttachmentForActor(attachment, actor)) };
}

async function getEncounterProcedureSummary(encounterId, actor = {}) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  assertEncounterReadAccess(encounter, actor);

  const rows = await ProcedureOrder.aggregate([
    { $match: { encounter_id: toObjectId(encounterId, 'encounterId') } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const byStatus = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row._id] = row.count;
    total += row.count;
  }
  return { encounter_id: String(encounter._id), total_procedure_orders: total, by_status: byStatus };
}

async function getPatientProcedureHistory(patientId, query = {}, actor = {}) {
  if (actorType(actor) === 'patient' && !sameId(patientId, actor.patientId || actor.patient_id)) {
    throw createError('Bạn không có quyền xem lịch sử thủ thuật của bệnh nhân khác.', 403);
  }
  return listProcedureOrders({
    ...query,
    patient_id: patientId,
    ...(actorType(actor) === 'patient' ? { status: PROCEDURE_STATUS.COMPLETED } : {}),
  }, actor);
}

async function getProcedureDashboardSummary(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ, PERMISSION.PROCEDURE_ORDERS.READ]);
  const filter = await buildProcedureListFilter(query, actor);
  const rows = await ProcedureOrder.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { status: '$status', priority: '$priority' },
        count: { $sum: 1 },
      },
    },
  ]);

  const byStatus = {};
  const byPriority = {};
  let total = 0;
  for (const row of rows) {
    const { status, priority } = row._id;
    byStatus[status] = (byStatus[status] || 0) + row.count;
    byPriority[priority] = (byPriority[priority] || 0) + row.count;
    total += row.count;
  }

  const upcoming = await ProcedureOrder.countDocuments({
    ...filter,
    status: PROCEDURE_STATUS.SCHEDULED,
    scheduled_start: { $gte: new Date() },
  });

  return {
    total_procedure_orders: total,
    upcoming_scheduled: upcoming,
    by_status: byStatus,
    by_priority: byPriority,
  };
}

async function getProcedureTimeline(procedureOrderId, actor = {}) {
  const detail = await getProcedureOrderDetail(procedureOrderId, actor);
  const attachmentIds = (detail.attachments || []).map((attachment) => attachment._id);
  const chargeIds = (detail.charges || []).map((charge) => charge._id);
  const orderId = detail.procedure_order.order_id?._id || detail.procedure_order.order_id;
  const logs = await AuditLog.find({
    $or: [
      { target_type: 'procedure_order', target_id: procedureOrderId },
      { target_type: 'order', target_id: orderId },
      { target_type: 'attachment', target_id: { $in: attachmentIds } },
      { target_type: 'charge', target_id: { $in: chargeIds } },
      { 'metadata.procedure_order_id': String(procedureOrderId) },
    ],
  }).sort({ created_at: 1 }).lean();

  return {
    procedure_order_id: String(procedureOrderId),
    events: logs.map((log) => ({
      event_type: log.action,
      event_time: log.created_at,
      module: 'procedures',
      title: log.message || log.action,
      actor_type: log.actor_type,
      actor_id: log.actor_id,
      entity_type: log.target_type,
      entity_id: log.target_id,
      metadata: log.metadata,
    })),
  };
}

async function notifyDoctorProcedureLifecycle(procedureOrderId, actor = {}, options = {}) {
  const procedureOrder = await ProcedureOrder.findById(procedureOrderId).lean();
  if (!procedureOrder) return null;
  const context = await loadProcedureOrderContext(procedureOrder);
  const recipientUserId = procedureOrder.requested_by || context.order.ordered_by || context.encounter.attending_doctor_id;
  if (!recipientUserId) return null;

  const titleByEvent = {
    completed: 'Thủ thuật đã hoàn tất',
    cancelled: 'Thủ thuật đã hủy',
    no_show: 'Bệnh nhân không đến làm thủ thuật',
  };

  return notificationService.createNotification({
    recipient_user_id: recipientUserId,
    notification_type: `procedure_order.${options.event || 'updated'}`,
    title: titleByEvent[options.event] || 'Procedure order đã cập nhật',
    message: `Procedure ${procedureOrder.procedure_order_no} - ${procedureOrder.procedure_name} đã ${options.event || 'updated'}.`,
    priority: options.event === 'no_show' ? 'high' : 'normal',
    dedupe_key: `procedure_order.${options.event || 'updated'}:${procedureOrder._id}:doctor:${recipientUserId}`,
    payload: {
      entity_type: 'procedure_order',
      entity_id: String(procedureOrder._id),
      procedure_order_id: String(procedureOrder._id),
      order_id: String(procedureOrder.order_id),
      encounter_id: String(procedureOrder.encounter_id),
      patient_id: String(procedureOrder.patient_id),
      event: options.event,
      reason: options.reason || null,
      actor_user_id: actor?.userId || null,
      route: `/procedures/orders/${procedureOrder._id}`,
      action: 'view_procedure_order',
    },
    created_by_module: 'procedures',
  }, {
    ...actorContext.buildSystemActor({ serviceName: 'procedures.notifications' }),
    createdByModule: 'procedures',
  });
}

module.exports = {
  // validateProcedureStatusTransition: Kiểm tra tính hợp lệ của chuyển trạng thái thủ thuật.
  validateProcedureStatusTransition,
  // listProcedureOrders: Liệt kê chỉ định thủ thuật.
  listProcedureOrders,
  // getProcedureOrderDetail: Lấy chi tiết chỉ định thủ thuật.
  getProcedureOrderDetail,
  // scheduleProcedure: Lên lịch cho thủ thuật.
  scheduleProcedure,
  // startProcedure: Bắt đầu thủ thuật.
  startProcedure,
  // completeProcedure: Hoàn tất thủ thuật.
  completeProcedure,
  // cancelProcedure: Hủy thủ thuật.
  cancelProcedure,
  // noShowProcedure: Đánh dấu ca thủ thuật là bệnh nhân vắng mặt.
  noShowProcedure,
  // resolveProcedureService: Xác định dịch vụ thủ thuật tương ứng để xử lý nghiệp vụ/viện phí.
  resolveProcedureService,
  // createProcedureCharge: Tạo khoản phí thủ thuật.
  createProcedureCharge,
  // listProcedureCharges: Liệt kê khoản phí thủ thuật.
  listProcedureCharges,
  // voidProcedureChargeIfCancelled: Hủy hiệu lực khoản phí thủ thuật khi bị hủy.
  voidProcedureChargeIfCancelled,
  // uploadProcedureAttachment: Tải lên tệp đính kèm thủ thuật.
  uploadProcedureAttachment,
  // listProcedureAttachments: Liệt kê tệp đính kèm thủ thuật.
  listProcedureAttachments,
  // syncProcedureStatusToParentOrder: Đồng bộ trạng thái thủ thuật về y lệnh cha.
  syncProcedureStatusToParentOrder,
  // checkProcedureCanBeScheduled: Kiểm tra điều kiện lên lịch thủ thuật.
  checkProcedureCanBeScheduled,
  // checkProcedureCanStart: Kiểm tra điều kiện bắt đầu thủ thuật.
  checkProcedureCanStart,
  // checkProcedureCanComplete: Kiểm tra điều kiện hoàn tất thủ thuật.
  checkProcedureCanComplete,
  // checkProcedureCanCancel: Kiểm tra điều kiện hủy thủ thuật.
  checkProcedureCanCancel,
  // checkProcedureCanNoShow: Kiểm tra điều kiện đánh dấu vắng mặt thủ thuật.
  checkProcedureCanNoShow,
  // getEncounterProcedureSummary: Lấy tổng hợp thủ thuật của lượt khám.
  getEncounterProcedureSummary,
  // getPatientProcedureHistory: Lấy lịch sử thủ thuật của bệnh nhân.
  getPatientProcedureHistory,
  // getProcedureDashboardSummary: Lấy tổng hợp dashboard thủ thuật.
  getProcedureDashboardSummary,
  // getProcedureTimeline: Lấy dòng thời gian thủ thuật.
  getProcedureTimeline,
  // notifyDoctorProcedureLifecycle: Gửi thông báo vòng đời thủ thuật cho bác sĩ.
  notifyDoctorProcedureLifecycle,
};
