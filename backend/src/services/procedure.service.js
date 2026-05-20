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
  ProcedureResult,
  ServiceCatalog,
  ServicePreparation,
  PostProcedureObservation,
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
  DOCUMENT_REVIEW_STATUS,
  DOCUMENT_VISIBILITY,
  ENCOUNTER_STATUS,
  ORDER_STATUS,
  ORDER_TYPE,
  PROCEDURE_RESULT_STATUS,
  PROCEDURE_STATUS,
  SERVICE_STATUS,
  SERVICE_TYPE,
} = require('../constants/statuses');
const {
  ORDER_TRANSITIONS,
  PROCEDURE_RESULT_TRANSITIONS,
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

const FINAL_PROCEDURE_RESULT_STATUSES = [
  PROCEDURE_RESULT_STATUS.FINAL,
  PROCEDURE_RESULT_STATUS.AMENDED,
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

function parseBoolean(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`);
  return date;
}

function startOfLocalDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
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

function procedureSlaRules(priority = 'routine') {
  const rules = {
    stat: { schedule_due_minutes: 30, start_due_minutes: 15, complete_due_minutes: 90, result_due_minutes: 120 },
    urgent: { schedule_due_minutes: 120, start_due_minutes: 45, complete_due_minutes: 240, result_due_minutes: 360 },
    routine: { schedule_due_minutes: 480, start_due_minutes: 60, complete_due_minutes: 720, result_due_minutes: 1440 },
  };
  return rules[priority] || rules.routine;
}

function makeProcedureSlaSnapshot(procedureOrder = {}, result = null) {
  const rules = procedureSlaRules(procedureOrder.priority);
  let stage = 'completed';
  let startedAt = null;
  let dueMinutes = 0;

  if (procedureOrder.status === PROCEDURE_STATUS.ORDERED) {
    stage = 'schedule';
    startedAt = procedureOrder.created_at;
    dueMinutes = rules.schedule_due_minutes;
  } else if (procedureOrder.status === PROCEDURE_STATUS.SCHEDULED) {
    stage = 'start';
    startedAt = procedureOrder.scheduled_start || procedureOrder.scheduled_at || procedureOrder.created_at;
    dueMinutes = rules.start_due_minutes;
  } else if (procedureOrder.status === PROCEDURE_STATUS.IN_PROGRESS) {
    stage = 'complete';
    startedAt = procedureOrder.performed_start || procedureOrder.started_at || procedureOrder.created_at;
    dueMinutes = rules.complete_due_minutes;
  } else if (procedureOrder.status === PROCEDURE_STATUS.COMPLETED && !FINAL_PROCEDURE_RESULT_STATUSES.includes(result?.status)) {
    stage = 'result';
    startedAt = procedureOrder.completed_at || procedureOrder.performed_end || procedureOrder.created_at;
    dueMinutes = rules.result_due_minutes;
  }

  if (!startedAt || !dueMinutes) {
    return { stage, state: 'done', risk_level: 'normal', due_at: null, remaining_minutes: null, is_overdue: false };
  }

  const dueAt = new Date(new Date(startedAt).getTime() + dueMinutes * 60 * 1000);
  const diffMinutes = Math.round((dueAt.getTime() - Date.now()) / 60000);
  const isOverdue = diffMinutes < 0;
  const riskLevel = isOverdue ? 'breached' : diffMinutes <= 30 ? 'warning' : 'normal';
  return {
    stage,
    state: isOverdue ? 'overdue' : 'active',
    risk_level: riskLevel,
    due_at: dueAt,
    remaining_minutes: Math.max(diffMinutes, 0),
    breached_minutes: isOverdue ? Math.abs(diffMinutes) : 0,
    is_overdue: isOverdue,
  };
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

  const procedureOrderIds = items.map((item) => item._id).filter(Boolean);
  const orderIds = items.map((item) => item.order_id?._id || item.order_id).filter(Boolean);
  const [charges, attachmentRows, results] = await Promise.all([
    orderIds.length
      ? Charge.find({
        order_id: { $in: orderIds },
        status: { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES },
      }).lean()
      : [],
    orderIds.length
      ? Attachment.aggregate([
        {
          $match: {
            order_id: { $in: orderIds.map((id) => toObjectId(id, 'order_id')) },
            status: ATTACHMENT_STATUS.ACTIVE,
          },
        },
        { $group: { _id: '$order_id', count: { $sum: 1 }, pending_scan: { $sum: { $cond: [{ $eq: ['$scan_status', 'pending'] }, 1, 0] } } } },
      ])
      : [],
    procedureOrderIds.length
      ? ProcedureResult.find({ procedure_order_id: { $in: procedureOrderIds } }).lean()
      : [],
  ]);

  const chargeByOrder = new Map();
  for (const charge of charges) {
    const key = String(charge.order_id);
    const current = chargeByOrder.get(key) || { total_amount: 0, statuses: new Set(), charge_count: 0 };
    current.total_amount += Number(charge.total_amount || 0);
    current.statuses.add(charge.status);
    current.charge_count += 1;
    chargeByOrder.set(key, current);
  }

  const attachmentByOrder = new Map(attachmentRows.map((row) => [String(row._id), row]));
  const resultByProcedure = new Map(results.map((result) => [String(result.procedure_order_id), result]));

  return {
    items: items.map((item) => {
      const orderId = String(item.order_id?._id || item.order_id || '');
      const chargeSummary = chargeByOrder.get(orderId);
      const attachmentSummary = attachmentByOrder.get(orderId);
      const result = resultByProcedure.get(String(item._id));
      return {
        ...item,
        charge_summary: chargeSummary
          ? {
            total_amount: chargeSummary.total_amount,
            statuses: [...chargeSummary.statuses],
            charge_count: chargeSummary.charge_count,
          }
          : null,
        attachment_summary: attachmentSummary
          ? {
            attachment_count: attachmentSummary.count,
            pending_scan: attachmentSummary.pending_scan,
          }
          : { attachment_count: 0, pending_scan: 0 },
        result_summary: result
          ? {
            result_id: result._id,
            result_no: result.result_no,
            status: result.status,
            signed_at: result.signed_at,
            released_to_doctor: result.released_to_doctor,
            released_to_patient: result.released_to_patient,
            is_critical: result.is_critical,
          }
          : null,
        sla: makeProcedureSlaSnapshot(item, result),
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

function getAllowedProcedureActions(procedureOrder, actor = {}, result = null) {
  return {
    can_schedule: [PROCEDURE_STATUS.ORDERED, PROCEDURE_STATUS.SCHEDULED].includes(procedureOrder.status)
      && hasPermission(actor, PERMISSION.PROCEDURE_ORDERS.SCHEDULE),
    can_reschedule: [PROCEDURE_STATUS.ORDERED, PROCEDURE_STATUS.SCHEDULED].includes(procedureOrder.status)
      && hasPermission(actor, PERMISSION.PROCEDURE_ORDERS.SCHEDULE),
    can_assign_performer: !PROCEDURE_TERMINAL_STATUSES.includes(procedureOrder.status)
      && hasAnyPermission(actor, [PERMISSION.PROCEDURE_ORDERS.SCHEDULE, PERMISSION.PROCEDURE_ORDERS.UPDATE]),
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
    can_create_result: procedureOrder.status === PROCEDURE_STATUS.COMPLETED
      && !result
      && hasAnyPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]),
    can_update_result: Boolean(result)
      && [PROCEDURE_RESULT_STATUS.DRAFT, PROCEDURE_RESULT_STATUS.PRELIMINARY].includes(result.status)
      && hasAnyPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]),
    can_finalize_result: Boolean(result)
      && [PROCEDURE_RESULT_STATUS.DRAFT, PROCEDURE_RESULT_STATUS.PRELIMINARY].includes(result.status)
      && hasAnyPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]),
    can_sign_result: Boolean(result)
      && FINAL_PROCEDURE_RESULT_STATUSES.includes(result.status)
      && !result.signed_at
      && hasAnyPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]),
    can_release_result: Boolean(result)
      && FINAL_PROCEDURE_RESULT_STATUSES.includes(result.status)
      && hasAnyPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]),
    can_review_attachment: hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD, PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT]),
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

  const [attachments, charges, result, preparation, postProcedureObservations, logs] = await Promise.all([
    Attachment.find({
      order_id: context.order._id,
      status: { $in: ACTIVE_ATTACHMENT_STATUSES },
    }).sort({ created_at: -1 }).lean(),
    Charge.find({ order_id: context.order._id }).sort({ charged_at: -1, created_at: -1 }).populate('service_id', 'service_code service_name service_type unit_price').lean(),
    ProcedureResult.findOne({ procedure_order_id: procedureOrderId })
      .populate('performer_id', 'full_name username employee_code')
      .populate('assistant_ids', 'full_name username employee_code')
      .populate('reported_by', 'full_name username employee_code')
      .populate('signed_by', 'full_name username employee_code')
      .lean(),
    ServicePreparation.findOne({ procedure_order_id: procedureOrderId })
      .populate('assigned_nurse_id', 'full_name username employee_code')
      .populate('department_id', 'department_code department_name')
      .populate('destination_department_id', 'department_code department_name')
      .lean(),
    PostProcedureObservation.find({ procedure_order_id: procedureOrderId })
      .sort({ observed_at: -1, created_at: -1 })
      .limit(12)
      .populate('observed_by', 'full_name username employee_code')
      .lean(),
    AuditLog.find({
      $or: [
        { target_type: 'procedure_order', target_id: procedureOrderId },
        { target_type: 'order', target_id: context.order._id },
        { target_type: 'procedure_result', 'metadata.procedure_order_id': String(procedureOrderId) },
        { 'metadata.procedure_order_id': String(procedureOrderId) },
      ],
    }).sort({ created_at: -1 }).limit(30).lean(),
  ]);

  return {
    procedure_order: procedureOrder,
    attachments: attachments.map((attachment) => sanitizeAttachmentForActor(attachment, actor)),
    charges,
    result,
    preparation,
    post_procedure_observations: postProcedureObservations,
    activity: logs,
    allowed_actions: getAllowedProcedureActions(rawProcedureOrder, actor, result),
    sla: makeProcedureSlaSnapshot(rawProcedureOrder, result),
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

async function rescheduleProcedure(procedureOrderId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.SCHEDULE, PERMISSION.PROCEDURE_ORDERS.UPDATE, PERMISSION.ORDERS.ACKNOWLEDGE]);

  let scheduledStart;
  await withOptionalTransaction(async (session) => {
    const procedureOrder = await getProcedureOrderOrThrow(procedureOrderId, session);
    const context = await loadProcedureOrderContext(procedureOrder, session);
    const validation = await checkProcedureCanBeScheduled(procedureOrder, payload, context, actor, session);
    scheduledStart = validation.scheduledStart;

    procedureOrder.scheduled_start = validation.scheduledStart;
    procedureOrder.scheduled_end = validation.scheduledEnd || undefined;
    procedureOrder.scheduled_by = actor?.userId;
    procedureOrder.scheduled_at = new Date();
    if (payload.performer_id !== undefined) procedureOrder.performer_id = payload.performer_id || undefined;
    if (payload.department_id !== undefined) procedureOrder.department_id = payload.department_id || undefined;
    procedureOrder.updated_by = actor?.userId;
    await procedureOrder.save(sessionOptions(session));
    if (procedureOrder.status === PROCEDURE_STATUS.ORDERED) {
      await updateProcedureStatus(procedureOrder, PROCEDURE_STATUS.SCHEDULED, actor, session);
      await syncProcedureStatusToParentOrder(procedureOrder, actor, session);
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'procedure_order.rescheduled',
    targetType: 'procedure_order',
    targetId: procedureOrderId,
    status: 'success',
    message: 'Reschedule procedure order thành công.',
    requestMeta,
    metadata: { scheduled_start: scheduledStart, reason: payload.reason || payload.reschedule_reason },
  });
  return getProcedureOrderDetail(procedureOrderId, actor);
}

async function assignProcedurePerformer(procedureOrderId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.SCHEDULE, PERMISSION.PROCEDURE_ORDERS.UPDATE]);
  const performerId = payload.performer_id;
  if (!performerId) throw createError('performer_id là bắt buộc.');

  await withOptionalTransaction(async (session) => {
    const procedureOrder = await getProcedureOrderOrThrow(procedureOrderId, session);
    const context = await loadProcedureOrderContext(procedureOrder, session);
    if (PROCEDURE_TERMINAL_STATUSES.includes(procedureOrder.status)) {
      throw createError('Procedure order đã kết thúc, không thể đổi performer.', 409);
    }
    assertProcedureOrderAccess(
      procedureOrder,
      context,
      actor,
      writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.SCHEDULE, PERMISSION.PROCEDURE_ORDERS.UPDATE]),
    );
    await validateActiveUser(performerId, 'performer_id', session);
    procedureOrder.performer_id = performerId;
    procedureOrder.updated_by = actor?.userId;
    await procedureOrder.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'procedure_order.performer_assigned',
    targetType: 'procedure_order',
    targetId: procedureOrderId,
    status: 'success',
    message: 'Assign procedure performer thành công.',
    requestMeta,
    metadata: { performer_id: performerId },
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

async function getAttachmentProcedureOrder(attachment, session = null) {
  if (attachment.entity_type === ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER) {
    return withSession(ProcedureOrder.findById(attachment.entity_id), session);
  }
  if (attachment.order_id) {
    return withSession(ProcedureOrder.findOne({ order_id: attachment.order_id }), session);
  }
  return null;
}

async function listProcedureFiles(query = {}, actor = {}) {
  assertStaffPermission(actor, [
    PERMISSION.ATTACHMENTS.READ_PROCEDURE,
    PERMISSION.ATTACHMENTS.READ,
    PERMISSION.PROCEDURE_ORDERS.READ,
  ]);

  const { page, limit, skip } = getPagination(query);
  const scopedProcedureFilter = await buildProcedureListFilter({
    patient_id: query.patient_id,
    encounter_id: query.encounter_id,
    department_id: query.department_id,
  }, actor);
  const scopedProcedures = await ProcedureOrder.find(scopedProcedureFilter).select('_id order_id').lean();
  const procedureIds = scopedProcedures.map((item) => item._id);
  const orderIds = scopedProcedures.map((item) => item.order_id).filter(Boolean);

  const filter = {
    entity_type: ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER,
    status: query.include_deleted === 'true' ? { $ne: null } : ATTACHMENT_STATUS.ACTIVE,
    $or: [
      { entity_id: { $in: procedureIds } },
      { order_id: { $in: orderIds } },
    ],
  };

  for (const field of ['category', 'scan_status', 'review_status', 'visibility', 'patient_id', 'encounter_id', 'order_id']) {
    if (query[field]) filter[field] = field.endsWith('_id') ? normalizeIdFilterValue(query[field], field) : query[field];
  }
  if (query.released_to_patient !== undefined) filter.released_to_patient = parseBoolean(query.released_to_patient) === true;
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { file_name: { $regex: keyword, $options: 'i' } },
        { original_name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
      ],
    });
  }

  const [items, total] = await Promise.all([
    Attachment.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('uploaded_by', 'full_name username employee_code')
      .populate('reviewed_by', 'full_name username employee_code')
      .populate('released_by', 'full_name username employee_code')
      .lean(),
    Attachment.countDocuments(filter),
  ]);

  return { items: items.map((attachment) => sanitizeAttachmentForActor(attachment, actor)), pagination: buildPagination(page, limit, total) };
}

async function updateProcedureFileReview(attachmentId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD, PERMISSION.ATTACHMENTS.READ_PROCEDURE]);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  const procedureOrder = await getAttachmentProcedureOrder(attachment);
  if (!procedureOrder) throw createError('Attachment không thuộc procedure order hợp lệ.', 409);
  const context = await loadProcedureOrderContext(procedureOrder);
  assertProcedureOrderAccess(
    procedureOrder,
    context,
    actor,
    writeAccessPermissions([PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD]),
  );

  const reviewStatus = payload.review_status || payload.status || DOCUMENT_REVIEW_STATUS.PENDING;
  if (!['pending', 'accepted', 'rejected'].includes(reviewStatus)) throw createError('review_status không hợp lệ.');
  attachment.review_status = reviewStatus;
  attachment.review_note = payload.review_note !== undefined ? payload.review_note : attachment.review_note;
  if (reviewStatus === DOCUMENT_REVIEW_STATUS.PENDING) {
    attachment.submitted_for_review_at = new Date();
  } else {
    attachment.reviewed_by = actor?.userId;
    attachment.reviewed_at = new Date();
  }
  attachment.updated_by = actor?.userId;
  await attachment.save();

  await recordAuditLog({
    actor,
    action: `procedure_attachment.review_${reviewStatus}`,
    targetType: 'attachment',
    targetId: attachmentId,
    status: 'success',
    message: 'Cập nhật review procedure attachment thành công.',
    requestMeta,
    metadata: { procedure_order_id: String(procedureOrder._id), review_status: reviewStatus },
  });
  return attachment.toObject();
}

async function releaseProcedureFileToPatient(attachmentId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.PROCEDURE_ORDERS.UPDATE]);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  const procedureOrder = await getAttachmentProcedureOrder(attachment);
  if (!procedureOrder) throw createError('Attachment không thuộc procedure order hợp lệ.', 409);
  const context = await loadProcedureOrderContext(procedureOrder);
  assertProcedureOrderAccess(
    procedureOrder,
    context,
    actor,
    writeAccessPermissions([PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.PROCEDURE_ORDERS.UPDATE]),
  );

  const released = payload.released_to_patient !== false;
  attachment.released_to_patient = released;
  attachment.released_at = released ? new Date() : undefined;
  attachment.released_by = released ? actor?.userId : undefined;
  attachment.visibility = released ? (payload.visibility || DOCUMENT_VISIBILITY.PATIENT_VISIBLE) : DOCUMENT_VISIBILITY.STAFF_ONLY;
  attachment.updated_by = actor?.userId;
  await attachment.save();

  await recordAuditLog({
    actor,
    action: released ? 'procedure_attachment.released_to_patient' : 'procedure_attachment.release_revoked',
    targetType: 'attachment',
    targetId: attachmentId,
    status: 'success',
    message: released ? 'Release procedure file cho patient thành công.' : 'Thu hồi release procedure file thành công.',
    requestMeta,
    metadata: { procedure_order_id: String(procedureOrder._id) },
  });
  return attachment.toObject();
}

async function archiveProcedureFile(attachmentId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.ARCHIVE, PERMISSION.ATTACHMENTS.DELETE_SOFT]);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  const procedureOrder = await getAttachmentProcedureOrder(attachment);
  if (!procedureOrder) throw createError('Attachment không thuộc procedure order hợp lệ.', 409);
  const context = await loadProcedureOrderContext(procedureOrder);
  assertProcedureOrderAccess(procedureOrder, context, actor, writeAccessPermissions([PERMISSION.ATTACHMENTS.ARCHIVE, PERMISSION.ATTACHMENTS.DELETE_SOFT]));
  attachment.status = ATTACHMENT_STATUS.ARCHIVED;
  attachment.archived_by = actor?.userId;
  attachment.archived_by_staff = true;
  attachment.archived_at = new Date();
  attachment.archive_reason = payload.reason || payload.archive_reason;
  attachment.updated_by = actor?.userId;
  await attachment.save();
  await recordAuditLog({ actor, action: 'procedure_attachment.archived', targetType: 'attachment', targetId: attachmentId, status: 'success', message: 'Archive procedure file thành công.', requestMeta, metadata: { reason: attachment.archive_reason } });
  return attachment.toObject();
}

async function restoreProcedureFile(attachmentId, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.RESTORE, PERMISSION.ATTACHMENTS.ARCHIVE]);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  const procedureOrder = await getAttachmentProcedureOrder(attachment);
  if (!procedureOrder) throw createError('Attachment không thuộc procedure order hợp lệ.', 409);
  const context = await loadProcedureOrderContext(procedureOrder);
  assertProcedureOrderAccess(procedureOrder, context, actor, writeAccessPermissions([PERMISSION.ATTACHMENTS.RESTORE, PERMISSION.ATTACHMENTS.ARCHIVE]));
  attachment.status = ATTACHMENT_STATUS.ACTIVE;
  attachment.archived_by = undefined;
  attachment.archived_by_staff = false;
  attachment.archived_at = undefined;
  attachment.archive_reason = undefined;
  attachment.updated_by = actor?.userId;
  await attachment.save();
  await recordAuditLog({ actor, action: 'procedure_attachment.restored', targetType: 'attachment', targetId: attachmentId, status: 'success', message: 'Restore procedure file thành công.', requestMeta });
  return attachment.toObject();
}

async function deleteProcedureAttachment(attachmentId, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.ARCHIVE]);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  const procedureOrder = await getAttachmentProcedureOrder(attachment);
  if (!procedureOrder) throw createError('Attachment không thuộc procedure order hợp lệ.', 409);
  const context = await loadProcedureOrderContext(procedureOrder);
  assertProcedureOrderAccess(procedureOrder, context, actor, writeAccessPermissions([PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.ARCHIVE]));
  attachment.status = ATTACHMENT_STATUS.DELETED;
  attachment.deleted_by = actor?.userId;
  attachment.deleted_at = new Date();
  attachment.delete_reason = undefined;
  attachment.updated_by = actor?.userId;
  await attachment.save();
  await recordAuditLog({ actor, action: 'procedure_attachment.deleted', targetType: 'attachment', targetId: attachmentId, status: 'success', message: 'Soft delete procedure attachment thành công.', requestMeta, metadata: { procedure_order_id: String(procedureOrder._id) } });
  return { deleted: true };
}

async function listProcedureWorkspaceCharges(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.CHARGES.READ, PERMISSION.PROCEDURE_ORDERS.READ, PERMISSION.PROCEDURE_ORDERS.CHARGE_CREATE]);
  const { page, limit, skip } = getPagination(query);
  const procedureFilter = await buildProcedureListFilter({
    status: query.status,
    patient_id: query.patient_id,
    encounter_id: query.encounter_id,
    department_id: query.department_id,
    date_from: query.date_from,
    date_to: query.date_to,
    scheduled_from: query.scheduled_from,
    scheduled_to: query.scheduled_to,
    performed_from: query.performed_from,
    performed_to: query.performed_to,
    search: query.search,
  }, actor);
  if (query.missing === 'true') procedureFilter.status = PROCEDURE_STATUS.COMPLETED;
  const procedureOrders = await ProcedureOrder.find(procedureFilter)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('performer_id', 'full_name username employee_code')
    .populate('order_id', 'order_no status service_id is_billable')
    .lean();
  const orderIds = procedureOrders.map((item) => item.order_id?._id || item.order_id).filter(Boolean);

  if (query.missing === 'true') {
    const chargedOrderIds = await Charge.distinct('order_id', {
      order_id: { $in: orderIds },
      status: { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES },
    });
    const chargedSet = new Set(chargedOrderIds.map((id) => String(id)));
    const missing = procedureOrders.filter((item) => !chargedSet.has(String(item.order_id?._id || item.order_id)));
    return {
      items: missing.slice(skip, skip + limit).map((procedureOrder) => ({ procedure_order: procedureOrder, missing_charge: true })),
      pagination: buildPagination(page, limit, missing.length),
    };
  }

  const filter = { order_id: { $in: orderIds } };
  if (query.charge_status || query.status_filter) filter.status = query.charge_status || query.status_filter;
  if (query.service_id) filter.service_id = toObjectId(query.service_id, 'service_id');
  applyDateRange(filter, query, 'charged_at', 'charged_from', 'charged_to');
  const [items, total] = await Promise.all([
    Charge.find(filter)
      .sort({ charged_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('service_id', 'service_code service_name service_type unit_price')
      .populate('order_id', 'order_no status priority')
      .lean(),
    Charge.countDocuments(filter),
  ]);
  const procedureByOrder = new Map(procedureOrders.map((item) => [String(item.order_id?._id || item.order_id), item]));
  return {
    items: items.map((charge) => ({
      ...charge,
      procedure_order: procedureByOrder.get(String(charge.order_id?._id || charge.order_id)) || null,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function generateProcedureResultNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.PROCEDURE_RESULT, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

function normalizeProcedureResultPayload(payload = {}) {
  return {
    template_id: payload.template_id || undefined,
    technique: payload.technique,
    findings: payload.findings,
    conclusion: payload.conclusion,
    complications: Array.isArray(payload.complications)
      ? payload.complications.map(normalizeString).filter(Boolean)
      : typeof payload.complications === 'string'
        ? payload.complications.split(',').map(normalizeString).filter(Boolean)
        : undefined,
    blood_loss: payload.blood_loss,
    anesthesia_type: payload.anesthesia_type,
    specimens_collected: Array.isArray(payload.specimens_collected)
      ? payload.specimens_collected.map(normalizeString).filter(Boolean)
      : typeof payload.specimens_collected === 'string'
        ? payload.specimens_collected.split(',').map(normalizeString).filter(Boolean)
        : undefined,
    post_procedure_instruction: payload.post_procedure_instruction,
    recommendation: payload.recommendation,
    assistant_ids: Array.isArray(payload.assistant_ids) ? payload.assistant_ids : undefined,
    is_critical: payload.is_critical !== undefined ? Boolean(payload.is_critical) : undefined,
    critical_note: payload.critical_note,
    metadata: payload.metadata,
  };
}

async function getProcedureResultOrThrow(resultId, session = null) {
  const result = await withSession(ProcedureResult.findById(resultId), session);
  if (!result) throw createError('Không tìm thấy procedure result.', 404);
  return result;
}

async function loadProcedureResultContext(result, session = null) {
  const procedureOrder = await withSession(ProcedureOrder.findById(result.procedure_order_id), session);
  if (!procedureOrder) throw createError('Không tìm thấy procedure order của result.', 409);
  const context = await loadProcedureOrderContext(procedureOrder, session);
  return { procedureOrder, ...context };
}

function validateProcedureResultBeforeFinal(result, options = {}) {
  if (!nonEmpty(result.conclusion) && !options.allow_empty_conclusion) {
    throw createError('conclusion là bắt buộc khi finalize/sign procedure result.', 409);
  }
  return true;
}

async function createProcedureResult(procedureOrderId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]);
  let resultId;

  await withOptionalTransaction(async (session) => {
    const procedureOrder = await getProcedureOrderOrThrow(procedureOrderId, session);
    const context = await loadProcedureOrderContext(procedureOrder, session);
    assertProcedureOrderAccess(procedureOrder, context, actor, writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]));
    if (![PROCEDURE_STATUS.IN_PROGRESS, PROCEDURE_STATUS.COMPLETED].includes(procedureOrder.status)) {
      throw createError('Procedure phải in_progress/completed trước khi tạo structured result.', 409);
    }
    const existing = await withSession(ProcedureResult.exists({ procedure_order_id: procedureOrder._id }), session);
    if (existing) throw createError('Procedure order đã có structured result.', 409);
    const normalized = normalizeProcedureResultPayload(payload);
    const status = payload.status || PROCEDURE_RESULT_STATUS.DRAFT;
    if (!Object.values(PROCEDURE_RESULT_STATUS).includes(status)) throw createError('result status không hợp lệ.');
    const resultNo = payload.result_no || await generateProcedureResultNumber({ session });
    const [result] = await ProcedureResult.create([{
      procedure_order_id: procedureOrder._id,
      patient_id: procedureOrder.patient_id,
      encounter_id: procedureOrder.encounter_id,
      result_no: resultNo,
      performer_id: payload.performer_id || procedureOrder.performer_id || actor?.userId,
      reported_by: actor?.userId,
      reported_at: [PROCEDURE_RESULT_STATUS.PRELIMINARY, PROCEDURE_RESULT_STATUS.FINAL].includes(status) ? new Date() : undefined,
      status,
      ...normalized,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    resultId = result._id;
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'procedure_result.created',
    targetType: 'procedure_result',
    targetId: resultId,
    status: 'success',
    message: 'Tạo structured procedure result thành công.',
    requestMeta,
    metadata: { procedure_order_id: String(procedureOrderId) },
  });
  return getProcedureResultDetail(resultId, actor);
}

async function getProcedureResultDetail(resultId, actor = {}) {
  const result = await ProcedureResult.findById(resultId)
    .populate('procedure_order_id', 'procedure_order_no procedure_name status priority scheduled_start performed_start performed_end completed_at')
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time')
    .populate('performer_id', 'full_name username employee_code')
    .populate('assistant_ids', 'full_name username employee_code')
    .populate('reported_by', 'full_name username employee_code')
    .populate('signed_by', 'full_name username employee_code')
    .lean();
  if (!result) throw createError('Không tìm thấy procedure result.', 404);
  const rawResult = await ProcedureResult.findById(resultId).lean();
  const { procedureOrder, ...context } = await loadProcedureResultContext(rawResult);
  assertProcedureOrderAccess(procedureOrder, context, actor, readAccessPermissions());
  return { result };
}

async function getProcedureResultByOrder(procedureOrderId, actor = {}) {
  const procedureOrder = await ProcedureOrder.findById(procedureOrderId).lean();
  if (!procedureOrder) throw createError('Không tìm thấy procedure order.', 404);
  const context = await loadProcedureOrderContext(procedureOrder);
  assertProcedureOrderAccess(procedureOrder, context, actor, readAccessPermissions());
  const result = await ProcedureResult.findOne({ procedure_order_id: procedureOrderId })
    .populate('performer_id', 'full_name username employee_code')
    .populate('assistant_ids', 'full_name username employee_code')
    .populate('reported_by', 'full_name username employee_code')
    .populate('signed_by', 'full_name username employee_code')
    .lean();
  return { result };
}

async function listProcedureResults(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.READ, PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT, PERMISSION.ORDERS.READ_PROCEDURE]);
  const { page, limit, skip } = getPagination(query);
  const procedureFilter = await buildProcedureListFilter({
    status: query.procedure_status,
    patient_id: query.patient_id,
    encounter_id: query.encounter_id,
    performer_id: query.performer_id,
    department_id: query.department_id,
    search: query.search,
  }, actor);
  const procedures = await ProcedureOrder.find(procedureFilter).select('_id').lean();
  const procedureIds = procedures.map((item) => item._id);
  const filter = { procedure_order_id: { $in: procedureIds } };
  if (query.status) filter.status = query.status.includes(',') ? { $in: query.status.split(',').map(normalizeString).filter(Boolean) } : query.status;
  if (query.is_critical !== undefined) filter.is_critical = parseBoolean(query.is_critical) === true;
  if (query.released_to_patient !== undefined) filter.released_to_patient = parseBoolean(query.released_to_patient) === true;
  applyDateRange(filter, query, 'reported_at');

  const [items, total] = await Promise.all([
    ProcedureResult.find(filter)
      .sort({ signed_at: -1, reported_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('procedure_order_id', 'procedure_order_no procedure_name status priority scheduled_start performed_start performed_end completed_at')
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('performer_id', 'full_name username employee_code')
      .populate('signed_by', 'full_name username employee_code')
      .lean(),
    ProcedureResult.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function updateProcedureResult(resultId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]);

  await withOptionalTransaction(async (session) => {
    const result = await getProcedureResultOrThrow(resultId, session);
    const { procedureOrder, ...context } = await loadProcedureResultContext(result, session);
    assertProcedureOrderAccess(procedureOrder, context, actor, writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]));
    if (![PROCEDURE_RESULT_STATUS.DRAFT, PROCEDURE_RESULT_STATUS.PRELIMINARY].includes(result.status)) {
      throw createError('Chỉ draft/preliminary procedure result mới sửa trực tiếp.', 409);
    }
    const normalized = normalizeProcedureResultPayload(payload);
    for (const [key, value] of Object.entries(normalized)) {
      if (value !== undefined) result[key] = value;
    }
    if (payload.status && payload.status !== result.status) {
      assertTransition(PROCEDURE_RESULT_TRANSITIONS, result.status, payload.status, 'procedure_result');
      result.status = payload.status;
      if (payload.status === PROCEDURE_RESULT_STATUS.PRELIMINARY) result.reported_at = result.reported_at || new Date();
    }
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'procedure_result.updated', targetType: 'procedure_result', targetId: resultId, status: 'success', message: 'Cập nhật procedure result thành công.', requestMeta });
  return getProcedureResultDetail(resultId, actor);
}

async function finalizeProcedureResult(resultId, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]);
  let critical = false;

  await withOptionalTransaction(async (session) => {
    const result = await getProcedureResultOrThrow(resultId, session);
    const { procedureOrder, ...context } = await loadProcedureResultContext(result, session);
    assertProcedureOrderAccess(procedureOrder, context, actor, writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]));
    if (![PROCEDURE_RESULT_STATUS.DRAFT, PROCEDURE_RESULT_STATUS.PRELIMINARY, PROCEDURE_RESULT_STATUS.AMENDED].includes(result.status)) {
      throw createError('Procedure result không ở trạng thái có thể finalize.', 409);
    }
    validateProcedureResultBeforeFinal(result);
    if (result.status !== PROCEDURE_RESULT_STATUS.FINAL) {
      assertTransition(PROCEDURE_RESULT_TRANSITIONS, result.status, PROCEDURE_RESULT_STATUS.FINAL, 'procedure_result');
      result.status = PROCEDURE_RESULT_STATUS.FINAL;
    }
    result.reported_by = result.reported_by || actor?.userId;
    result.reported_at = result.reported_at || new Date();
    if (result.is_critical && !result.critical_notified_at) result.critical_notified_at = new Date();
    result.updated_by = actor?.userId;
    critical = Boolean(result.is_critical);
    await result.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'procedure_result.finalized', targetType: 'procedure_result', targetId: resultId, status: 'success', message: 'Finalize procedure result thành công.', requestMeta, metadata: { critical } });
  return getProcedureResultDetail(resultId, actor);
}

async function signProcedureResult(resultId, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]);

  await withOptionalTransaction(async (session) => {
    const result = await getProcedureResultOrThrow(resultId, session);
    const { procedureOrder, ...context } = await loadProcedureResultContext(result, session);
    assertProcedureOrderAccess(procedureOrder, context, actor, writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]));
    validateProcedureResultBeforeFinal(result);
    if (!FINAL_PROCEDURE_RESULT_STATUSES.includes(result.status)) {
      assertTransition(PROCEDURE_RESULT_TRANSITIONS, result.status, PROCEDURE_RESULT_STATUS.FINAL, 'procedure_result');
      result.status = PROCEDURE_RESULT_STATUS.FINAL;
    }
    result.signed_by = actor?.userId;
    result.signed_at = new Date();
    result.reported_at = result.reported_at || new Date();
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'procedure_result.signed', targetType: 'procedure_result', targetId: resultId, status: 'success', message: 'Ký procedure result thành công.', requestMeta });
  return getProcedureResultDetail(resultId, actor);
}

async function amendProcedureResult(resultId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]);
  const reason = payload.reason || payload.amendment_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi amend procedure result.');

  await withOptionalTransaction(async (session) => {
    const result = await getProcedureResultOrThrow(resultId, session);
    const { procedureOrder, ...context } = await loadProcedureResultContext(result, session);
    assertProcedureOrderAccess(procedureOrder, context, actor, writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]));
    if (!FINAL_PROCEDURE_RESULT_STATUSES.includes(result.status)) throw createError('Chỉ final/amended procedure result mới được amend.', 409);
    const normalized = normalizeProcedureResultPayload(payload);
    for (const [key, value] of Object.entries(normalized)) {
      if (value !== undefined) result[key] = value;
    }
    if (result.status !== PROCEDURE_RESULT_STATUS.AMENDED) {
      assertTransition(PROCEDURE_RESULT_TRANSITIONS, result.status, PROCEDURE_RESULT_STATUS.AMENDED, 'procedure_result');
    }
    validateProcedureResultBeforeFinal(result);
    result.status = PROCEDURE_RESULT_STATUS.AMENDED;
    result.amended_by = actor?.userId;
    result.amended_at = new Date();
    result.amendment_reason = reason;
    result.signed_by = actor?.userId;
    result.signed_at = new Date();
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'procedure_result.amended', targetType: 'procedure_result', targetId: resultId, status: 'success', message: 'Amend procedure result thành công.', requestMeta, metadata: { reason } });
  return getProcedureResultDetail(resultId, actor);
}

async function releaseProcedureResult(resultId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]);
  const target = payload.target || (payload.to_patient ? 'patient' : 'doctor');

  await withOptionalTransaction(async (session) => {
    const result = await getProcedureResultOrThrow(resultId, session);
    const { procedureOrder, ...context } = await loadProcedureResultContext(result, session);
    assertProcedureOrderAccess(procedureOrder, context, actor, writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]));
    if (!FINAL_PROCEDURE_RESULT_STATUSES.includes(result.status)) throw createError('Chỉ final/amended procedure result mới được release.', 409);
    if (target === 'patient') {
      result.released_to_patient = true;
      result.released_to_patient_at = new Date();
      result.released_to_patient_by = actor?.userId;
    } else {
      result.released_to_doctor = true;
      result.released_to_doctor_at = new Date();
      result.released_to_doctor_by = actor?.userId;
      procedureOrder.released_to_doctor = true;
      procedureOrder.released_to_doctor_at = result.released_to_doctor_at;
      procedureOrder.released_to_doctor_by = actor?.userId;
      procedureOrder.updated_by = actor?.userId;
      await procedureOrder.save(sessionOptions(session));
    }
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: `procedure_result.released_to_${target}`, targetType: 'procedure_result', targetId: resultId, status: 'success', message: 'Release procedure result thành công.', requestMeta, metadata: { target } });
  return getProcedureResultDetail(resultId, actor);
}

async function cancelProcedureResult(resultId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]);
  const reason = payload.reason || payload.cancel_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi cancel procedure result.');

  await withOptionalTransaction(async (session) => {
    const result = await getProcedureResultOrThrow(resultId, session);
    const { procedureOrder, ...context } = await loadProcedureResultContext(result, session);
    assertProcedureOrderAccess(procedureOrder, context, actor, writeAccessPermissions([PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.PROCEDURE_ORDERS.UPDATE]));
    if (FINAL_PROCEDURE_RESULT_STATUSES.includes(result.status)) throw createError('Không cancel final/amended result bằng flow thường, hãy dùng amend.', 409);
    assertTransition(PROCEDURE_RESULT_TRANSITIONS, result.status, PROCEDURE_RESULT_STATUS.CANCELLED, 'procedure_result');
    result.status = PROCEDURE_RESULT_STATUS.CANCELLED;
    result.cancelled_by = actor?.userId;
    result.cancelled_at = new Date();
    result.cancel_reason = reason;
    result.updated_by = actor?.userId;
    await result.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'procedure_result.cancelled', targetType: 'procedure_result', targetId: resultId, status: 'success', message: 'Cancel procedure result thành công.', requestMeta, metadata: { reason } });
  return getProcedureResultDetail(resultId, actor);
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

  const completedProcedures = await ProcedureOrder.find({ ...filter, status: PROCEDURE_STATUS.COMPLETED }).select('_id order_id').lean();
  const completedProcedureIds = completedProcedures.map((item) => item._id);
  const completedOrderIds = completedProcedures.map((item) => item.order_id).filter(Boolean);
  const [ordersWithAttachments, ordersWithCharges, resultRows, criticalResults, pendingFileReview] = await Promise.all([
    completedOrderIds.length
      ? Attachment.distinct('order_id', { order_id: { $in: completedOrderIds }, status: ATTACHMENT_STATUS.ACTIVE })
      : [],
    completedOrderIds.length
      ? Charge.distinct('order_id', { order_id: { $in: completedOrderIds }, status: { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES } })
      : [],
    completedProcedureIds.length
      ? ProcedureResult.aggregate([
        { $match: { procedure_order_id: { $in: completedProcedureIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      : [],
    completedProcedureIds.length
      ? ProcedureResult.countDocuments({ procedure_order_id: { $in: completedProcedureIds }, is_critical: true, critical_acknowledged_at: { $exists: false } })
      : 0,
    Attachment.countDocuments({
      entity_type: ATTACHMENT_ENTITY_TYPE.PROCEDURE_ORDER,
      status: ATTACHMENT_STATUS.ACTIVE,
      review_status: DOCUMENT_REVIEW_STATUS.PENDING,
    }),
  ]);

  const attachedSet = new Set(ordersWithAttachments.map((id) => String(id)));
  const chargedSet = new Set(ordersWithCharges.map((id) => String(id)));
  const resultByStatus = Object.fromEntries(resultRows.map((row) => [row._id, row.count]));

  return {
    total_procedure_orders: total,
    upcoming_scheduled: upcoming,
    by_status: byStatus,
    by_priority: byPriority,
    completed_missing_attachment: completedProcedures.filter((item) => !attachedSet.has(String(item.order_id))).length,
    completed_missing_charge: completedProcedures.filter((item) => !chargedSet.has(String(item.order_id))).length,
    result_by_status: resultByStatus,
    critical_unacknowledged: criticalResults,
    pending_file_review: pendingFileReview,
  };
}

async function getProcedureWorklistCounts(query = {}, actor = {}) {
  const summary = await getProcedureDashboardSummary(query, actor);
  return {
    counters: {
      total_orders: summary.total_procedure_orders,
      ordered: summary.by_status?.[PROCEDURE_STATUS.ORDERED] || 0,
      scheduled: summary.by_status?.[PROCEDURE_STATUS.SCHEDULED] || 0,
      in_progress: summary.by_status?.[PROCEDURE_STATUS.IN_PROGRESS] || 0,
      completed: summary.by_status?.[PROCEDURE_STATUS.COMPLETED] || 0,
      no_show: summary.by_status?.[PROCEDURE_STATUS.NO_SHOW] || 0,
      cancelled: summary.by_status?.[PROCEDURE_STATUS.CANCELLED] || 0,
      upcoming_scheduled: summary.upcoming_scheduled,
      missing_attachment: summary.completed_missing_attachment,
      missing_charge: summary.completed_missing_charge,
      critical_unacknowledged: summary.critical_unacknowledged,
      pending_file_review: summary.pending_file_review,
    },
    by_priority: summary.by_priority,
    result_by_status: summary.result_by_status,
  };
}

async function getProcedureCalendar(query = {}, actor = {}) {
  const day = parseDate(query.date, 'date') || new Date();
  const params = {
    ...query,
    status: query.status || PROCEDURE_STATUS.SCHEDULED,
    scheduled_from: query.scheduled_from || startOfLocalDay(day).toISOString(),
    scheduled_to: query.scheduled_to || endOfLocalDay(day).toISOString(),
    limit: query.limit || 200,
  };
  const worklist = await listProcedureOrders(params, actor);
  const byPerformer = {};
  const byDepartment = {};
  for (const item of worklist.items || []) {
    const performerKey = String(item.performer_id?._id || item.performer_id || 'unassigned');
    const departmentKey = String(item.department_id?._id || item.department_id || 'unassigned');
    if (!byPerformer[performerKey]) byPerformer[performerKey] = [];
    if (!byDepartment[departmentKey]) byDepartment[departmentKey] = [];
    byPerformer[performerKey].push(item);
    byDepartment[departmentKey].push(item);
  }
  return {
    date: startOfLocalDay(day),
    performers: Object.entries(byPerformer).map(([performer_id, items]) => ({ performer_id, items })),
    departments: Object.entries(byDepartment).map(([department_id, items]) => ({ department_id, items })),
    items: worklist.items,
    pagination: worklist.pagination,
  };
}

async function getProcedureTimeline(procedureOrderId, actor = {}) {
  const detail = await getProcedureOrderDetail(procedureOrderId, actor);
  const attachmentIds = (detail.attachments || []).map((attachment) => attachment._id);
  const chargeIds = (detail.charges || []).map((charge) => charge._id);
  const resultId = detail.result?._id;
  const orderId = detail.procedure_order.order_id?._id || detail.procedure_order.order_id;
  const logs = await AuditLog.find({
    $or: [
      { target_type: 'procedure_order', target_id: procedureOrderId },
      { target_type: 'order', target_id: orderId },
      { target_type: 'attachment', target_id: { $in: attachmentIds } },
      { target_type: 'charge', target_id: { $in: chargeIds } },
      ...(resultId ? [{ target_type: 'procedure_result', target_id: resultId }] : []),
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
  // rescheduleProcedure: Đổi lịch thủ thuật.
  rescheduleProcedure,
  // assignProcedurePerformer: Assign người thực hiện thủ thuật.
  assignProcedurePerformer,
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
  // listProcedureFiles: Liệt kê tệp thủ thuật toàn workspace.
  listProcedureFiles,
  // updateProcedureFileReview: Gửi duyệt/duyệt/từ chối tệp thủ thuật.
  updateProcedureFileReview,
  // releaseProcedureFileToPatient: Release hoặc revoke tệp thủ thuật cho bệnh nhân.
  releaseProcedureFileToPatient,
  // archiveProcedureFile: Lưu trữ tệp thủ thuật.
  archiveProcedureFile,
  // restoreProcedureFile: Khôi phục tệp thủ thuật.
  restoreProcedureFile,
  // deleteProcedureAttachment: Xóa mềm tệp thủ thuật.
  deleteProcedureAttachment,
  // listProcedureWorkspaceCharges: Liệt kê chi phí thủ thuật toàn workspace.
  listProcedureWorkspaceCharges,
  // createProcedureResult: Tạo kết quả thủ thuật có cấu trúc.
  createProcedureResult,
  // getProcedureResultByOrder: Lấy kết quả thủ thuật theo procedure order.
  getProcedureResultByOrder,
  // getProcedureResultDetail: Lấy chi tiết kết quả thủ thuật.
  getProcedureResultDetail,
  // listProcedureResults: Liệt kê kết quả thủ thuật.
  listProcedureResults,
  // updateProcedureResult: Cập nhật kết quả thủ thuật draft/preliminary.
  updateProcedureResult,
  // finalizeProcedureResult: Finalize kết quả thủ thuật.
  finalizeProcedureResult,
  // signProcedureResult: Ký kết quả thủ thuật.
  signProcedureResult,
  // amendProcedureResult: Amend kết quả thủ thuật.
  amendProcedureResult,
  // releaseProcedureResult: Release kết quả thủ thuật.
  releaseProcedureResult,
  // cancelProcedureResult: Hủy kết quả thủ thuật draft/preliminary.
  cancelProcedureResult,
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
  // getProcedureWorklistCounts: Lấy counter worklist thủ thuật.
  getProcedureWorklistCounts,
  // getProcedureCalendar: Lấy board lịch thủ thuật theo ngày.
  getProcedureCalendar,
  // getProcedureTimeline: Lấy dòng thời gian thủ thuật.
  getProcedureTimeline,
  // notifyDoctorProcedureLifecycle: Gửi thông báo vòng đời thủ thuật cho bác sĩ.
  notifyDoctorProcedureLifecycle,
};
