const {
  Allergy,
  Attachment,
  AuditLog,
  Charge,
  Encounter,
  ImagingEquipment,
  ImagingModality,
  ImagingOrder,
  ImagingReport,
  ImagingReportCorrectionRequest,
  ImagingReportTemplate,
  ImagingRoom,
  Order,
  Patient,
} = require('../models');
const { mongoose } = require('../config/database');
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
  ALLERGY_SEVERITY,
  ALLERGY_STATUS,
  ALLERGY_TYPE,
  ATTACHMENT_ENTITY_TYPE,
  ATTACHMENT_STATUS,
  CHARGE_STATUS,
  DOCUMENT_REVIEW_STATUS,
  DOCUMENT_VISIBILITY,
  IMAGING_ORDER_STATUS,
  IMAGING_REPORT_STATUS,
  ORDER_STATUS,
  ORDER_TYPE,
} = require('../constants/statuses');
const {
  IMAGING_ORDER_TRANSITIONS,
  IMAGING_REPORT_TRANSITIONS,
  ORDER_TRANSITIONS,
} = require('../constants/transitions');
const { PERMISSION } = require('../constants/permissions');
const { assertTransition, canTransition } = require('../shared/utils/status-transition');
const { withOptionalTransaction } = require('../shared/utils/transaction');

const IMAGING_ORDER_TERMINAL_STATUSES = [
  IMAGING_ORDER_STATUS.COMPLETED,
  IMAGING_ORDER_STATUS.CANCELLED,
  IMAGING_ORDER_STATUS.NO_SHOW,
];

const FINAL_REPORT_STATUSES = [
  IMAGING_REPORT_STATUS.FINAL,
  IMAGING_REPORT_STATUS.AMENDED,
];

const ACTIVE_ATTACHMENT_STATUSES = [
  ATTACHMENT_STATUS.ACTIVE,
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

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`);
  return date;
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

function parseOptionalNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw createError(`${fieldName} phải là số hợp lệ.`);
  return number;
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || null;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return normalizeString(value);
}

function removeUndefinedFields(input = {}) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function assertStaffPermission(actor, permissions, message = 'Bạn không có quyền thao tác Imaging Module.') {
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

function sanitizeAttachmentForActor(attachment, actor = {}) {
  if (actorType(actor) !== 'patient') return attachment;
  const {
    storage_path: _storagePath,
    checksum: _checksum,
    ...safeAttachment
  } = attachment;
  return safeAttachment;
}

async function generateImagingReportNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.IMAGING_REPORT, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

async function getImagingOrderOrThrow(imagingOrderId, session = null) {
  const imagingOrder = await withSession(ImagingOrder.findById(imagingOrderId), session);
  if (!imagingOrder) throw createError('Không tìm thấy imaging order.', 404);
  return imagingOrder;
}

async function getImagingReportOrThrow(reportId, session = null) {
  const report = await withSession(ImagingReport.findById(reportId), session);
  if (!report) throw createError('Không tìm thấy imaging report.', 404);
  return report;
}

async function loadImagingOrderContext(imagingOrder, session = null) {
  const [order, encounter, patient] = await Promise.all([
    withSession(Order.findById(imagingOrder.order_id).lean(), session),
    withSession(Encounter.findById(imagingOrder.encounter_id).lean(), session),
    withSession(Patient.findById(imagingOrder.patient_id).lean(), session),
  ]);
  if (!order) throw createError('Không tìm thấy order mẹ của imaging order.', 409);
  if (!encounter) throw createError('Không tìm thấy encounter của imaging order.', 409);
  assertPatientActive(patient);
  return { order, encounter, patient };
}

async function loadReportContext(report, session = null) {
  const imagingOrder = await withSession(ImagingOrder.findById(report.imaging_order_id), session);
  if (!imagingOrder) throw createError('Không tìm thấy imaging order của report.', 409);
  const context = await loadImagingOrderContext(imagingOrder, session);
  return { imagingOrder, ...context };
}

function readAccessPermissions() {
  return {
    global: [
      PERMISSION.IMAGING_ORDERS.READ,
      PERMISSION.IMAGING_REPORTS.READ,
      PERMISSION.IMAGING_REPORTS.READ_FINAL,
      PERMISSION.ORDERS.READ,
      PERMISSION.ORDERS.READ_IMAGING,
    ],
    own: [
      PERMISSION.IMAGING_ORDERS.READ_OWN,
      PERMISSION.ORDERS.READ_OWN,
      PERMISSION.ENCOUNTERS.READ_OWN,
    ],
    department: [
      PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT,
      PERMISSION.ORDERS.READ_DEPARTMENT,
      PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    ],
  };
}

function writeAccessPermissions(extra = []) {
  return {
    global: [
      PERMISSION.IMAGING_ORDERS.READ,
      PERMISSION.IMAGING_REPORTS.WRITE,
      PERMISSION.ORDERS.READ_IMAGING,
      ...extra,
    ],
    own: [PERMISSION.IMAGING_ORDERS.READ_OWN],
    department: [PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT, PERMISSION.ORDERS.READ_DEPARTMENT],
  };
}

function assertImagingOrderAccess(imagingOrder, context, actor = {}, permissions = {}) {
  if (!actorType(actor)) return true;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;

  if (actorType(actor) === 'patient') {
    if (sameId(imagingOrder.patient_id, actor.patientId || actor.patient_id)) return true;
    throw createError('Bạn không có quyền xem dữ liệu CĐHA này.', 403);
  }

  if (hasAnyPermission(actor, permissions.global || [])) return true;

  if (
    actor.userId
    && (
      sameId(imagingOrder.ordered_by, actor.userId)
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

  throw createError('Bạn không có quyền thao tác imaging order này.', 403);
}

function assertEncounterReadAccess(encounter, actor = {}) {
  if (!actorType(actor)) return true;
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.ENCOUNTERS.READ, PERMISSION.ORDERS.READ, PERMISSION.IMAGING_ORDERS.READ])) return true;
  if (actor.userId && sameId(encounter.attending_doctor_id, actor.userId) && hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.ORDERS.READ_OWN, PERMISSION.IMAGING_ORDERS.READ_OWN])) return true;
  const departmentId = actorDepartmentId(actor);
  if (departmentId && sameId(encounter.department_id, departmentId) && hasAnyPermission(actor, [PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_DEPARTMENT, PERMISSION.ORDERS.READ_DEPARTMENT])) return true;
  throw createError('Bạn không có quyền xem imaging summary của encounter này.', 403);
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

async function updateImagingOrderStatus(imagingOrder, nextStatus, actor, session = null, extra = {}) {
  if (imagingOrder.status === nextStatus) return imagingOrder;
  assertTransition(IMAGING_ORDER_TRANSITIONS, imagingOrder.status, nextStatus, 'imaging_order');
  imagingOrder.status = nextStatus;
  if (nextStatus === IMAGING_ORDER_STATUS.SCHEDULED) {
    imagingOrder.scheduled_by = actor?.userId;
    imagingOrder.scheduled_at = extra.scheduled_at || imagingOrder.scheduled_at;
  }
  if (nextStatus === IMAGING_ORDER_STATUS.IN_PROGRESS) {
    imagingOrder.started_by = actor?.userId;
    imagingOrder.started_at = extra.started_at || new Date();
  }
  if (nextStatus === IMAGING_ORDER_STATUS.COMPLETED) {
    imagingOrder.completed_by = actor?.userId;
    imagingOrder.completed_at = extra.completed_at || new Date();
  }
  if (nextStatus === IMAGING_ORDER_STATUS.CANCELLED) {
    imagingOrder.cancelled_by = actor?.userId;
    imagingOrder.cancelled_at = new Date();
    imagingOrder.cancel_reason = extra.reason || imagingOrder.cancel_reason;
  }
  if (nextStatus === IMAGING_ORDER_STATUS.NO_SHOW) {
    imagingOrder.no_show_at = new Date();
    imagingOrder.no_show_reason = extra.reason || imagingOrder.no_show_reason;
  }
  imagingOrder.updated_by = actor?.userId;
  await imagingOrder.save(sessionOptions(session));
  return imagingOrder;
}

async function buildScopedOrderIds(query = {}, actor = {}) {
  const orderFilter = { order_type: ORDER_TYPE.IMAGING };
  if (query.department_id) orderFilter.department_id = query.department_id;

  if (actorType(actor) && !hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.IMAGING_ORDERS.READ, PERMISSION.IMAGING_REPORTS.READ, PERMISSION.ORDERS.READ, PERMISSION.ORDERS.READ_IMAGING])) {
    if (actor.userId && hasAnyPermission(actor, [PERMISSION.IMAGING_ORDERS.READ_OWN, PERMISSION.ORDERS.READ_OWN])) {
      orderFilter.ordered_by = actor.userId;
    } else if (actorDepartmentId(actor) && hasAnyPermission(actor, [PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT, PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_DEPARTMENT])) {
      orderFilter.department_id = actorDepartmentId(actor);
    } else {
      throw createError('Bạn không có quyền xem danh sách imaging order.', 403);
    }
  }

  if (orderFilter.department_id || orderFilter.ordered_by) {
    const orders = await Order.find(orderFilter).select('_id').lean();
    return orders.map((order) => order._id);
  }
  return null;
}

function applyDateRange(filter, query = {}, fieldName, fromKey = 'date_from', toKey = 'date_to') {
  if (query[fromKey] || query[toKey]) {
    filter[fieldName] = {};
    if (query[fromKey]) filter[fieldName].$gte = parseDate(query[fromKey], fromKey);
    if (query[toKey]) filter[fieldName].$lte = parseDate(query[toKey], toKey);
  }
}

function mergeObjectIdInFilter(filter, fieldName, ids = []) {
  const normalized = ids.filter(Boolean);
  if (!normalized.length) {
    filter[fieldName] = { $in: [] };
    return;
  }
  const current = filter[fieldName];
  if (!current) {
    filter[fieldName] = { $in: normalized };
    return;
  }
  const currentIds = current.$in ? current.$in : [current];
  const currentSet = new Set(currentIds.map((id) => String(id)));
  filter[fieldName] = { $in: normalized.filter((id) => currentSet.has(String(id))) };
}

function imagingOrderSort(query = {}) {
  const allowed = new Set(['ordered_at', 'scheduled_at', 'started_at', 'completed_at', 'priority', 'status', 'modality']);
  if (!query.sort) return { scheduled_at: 1, ordered_at: -1 };
  const raw = String(query.sort);
  const direction = raw.startsWith('-') || raw.endsWith(':desc') ? -1 : 1;
  const field = raw.replace(/^-/, '').replace(/:(asc|desc)$/i, '');
  return allowed.has(field) ? { [field]: direction } : { scheduled_at: 1, ordered_at: -1 };
}

function defaultImagingSla(priority = 'routine') {
  const map = {
    stat: { schedule_due_minutes: 30, technical_due_minutes: 90, report_due_minutes: 180, critical_ack_due_minutes: 15 },
    urgent: { schedule_due_minutes: 120, technical_due_minutes: 360, report_due_minutes: 720, critical_ack_due_minutes: 30 },
    routine: { schedule_due_minutes: 480, technical_due_minutes: 1440, report_due_minutes: 2880, critical_ack_due_minutes: 60 },
  };
  return map[priority] || map.routine;
}

function makeImagingSlaSnapshot(order = {}, report = null) {
  let stage = null;
  let startedAt = null;
  let dueMinutes = 0;
  const rules = defaultImagingSla(order.priority);
  if (order.status === IMAGING_ORDER_STATUS.ORDERED) {
    stage = 'schedule';
    startedAt = order.ordered_at;
    dueMinutes = rules.schedule_due_minutes;
  } else if (order.status === IMAGING_ORDER_STATUS.SCHEDULED) {
    stage = 'technical_start';
    startedAt = order.scheduled_at || order.ordered_at;
    dueMinutes = rules.technical_due_minutes;
  } else if (order.status === IMAGING_ORDER_STATUS.IN_PROGRESS) {
    stage = 'technical_complete';
    startedAt = order.started_at || order.scheduled_at || order.ordered_at;
    dueMinutes = rules.technical_due_minutes;
  } else if (order.status === IMAGING_ORDER_STATUS.COMPLETED && !FINAL_REPORT_STATUSES.includes(report?.status)) {
    stage = 'report';
    startedAt = order.completed_at || order.started_at || order.ordered_at;
    dueMinutes = rules.report_due_minutes;
  } else if (report?.is_critical && !report.critical_acknowledged_at) {
    stage = 'critical_ack';
    startedAt = report.critical_notified_at || report.verified_at || report.reported_at;
    dueMinutes = rules.critical_ack_due_minutes;
  }
  if (!stage || !startedAt) {
    return { state: 'neutral', risk_level: 'neutral', is_overdue: false, age_minutes: minutesBetween(order.ordered_at) };
  }
  const elapsed = minutesBetween(startedAt);
  const remaining = dueMinutes - elapsed;
  const state = remaining < 0 ? 'breached' : remaining <= Math.max(15, Math.round(dueMinutes * 0.2)) ? 'warning' : 'normal';
  return {
    stage,
    state,
    risk_level: state === 'breached' ? 'danger' : state,
    due_minutes: dueMinutes,
    elapsed_minutes: elapsed,
    remaining_minutes: Math.max(remaining, 0),
    breached_minutes: Math.max(-remaining, 0),
    started_at: startedAt,
    is_overdue: state === 'breached',
    age_minutes: minutesBetween(order.ordered_at),
  };
}

async function buildImagingOrderListFilter(query = {}, actor = {}) {
  const filter = {};
  for (const field of [
    'status',
    'modality',
    'priority',
    'patient_id',
    'encounter_id',
    'ordered_by',
    'body_part',
    'room_id',
    'assigned_technician_id',
    'assigned_radiologist_id',
    'arrival_status',
  ]) {
    addQueryFilter(filter, field, query[field]);
  }
  if (query.technician_id) addQueryFilter(filter, 'assigned_technician_id', query.technician_id);
  if (query.radiologist_id) addQueryFilter(filter, 'assigned_radiologist_id', query.radiologist_id);
  if (query.contrast_required !== undefined) filter.contrast_required = parseBoolean(query.contrast_required) === true;
  applyDateRange(filter, query, 'ordered_at');
  applyDateRange(filter, query, 'scheduled_at', 'scheduled_from', 'scheduled_to');
  applyDateRange(filter, query, 'completed_at', 'completed_from', 'completed_to');

  if (query.search) {
    const keyword = escapeRegex(query.search);
    const [matchingPatients, matchingOrders] = await Promise.all([
      Patient.find({
        $or: [
          { patient_code: { $regex: keyword, $options: 'i' } },
          { full_name: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').limit(100).lean(),
      Order.find({
        order_type: ORDER_TYPE.IMAGING,
        order_no: { $regex: keyword, $options: 'i' },
      }).select('_id').limit(100).lean(),
    ]);
    filter.$or = [
      { imaging_order_no: { $regex: keyword, $options: 'i' } },
      { modality: { $regex: keyword, $options: 'i' } },
      { body_part: { $regex: keyword, $options: 'i' } },
      ...(matchingPatients.length ? [{ patient_id: { $in: matchingPatients.map((patient) => patient._id) } }] : []),
      ...(matchingOrders.length ? [{ order_id: { $in: matchingOrders.map((order) => order._id) } }] : []),
    ];
  }

  const scopedOrderIds = await buildScopedOrderIds(query, actor);
  if (scopedOrderIds) filter.order_id = { $in: scopedOrderIds };

  if (query.report_status || query.critical !== undefined || query.is_critical !== undefined || query.radiologist_id || query.technician_id) {
    const reportFilter = {};
    if (query.report_status) addQueryFilter(reportFilter, 'status', query.report_status);
    const criticalValue = query.critical !== undefined ? query.critical : query.is_critical;
    if (criticalValue !== undefined) reportFilter.is_critical = parseBoolean(criticalValue) === true;
    if (query.radiologist_id) reportFilter.radiologist_id = query.radiologist_id;
    if (query.technician_id) reportFilter.technician_id = query.technician_id;
    const reports = await ImagingReport.find(reportFilter).select('imaging_order_id').lean();
    mergeObjectIdInFilter(filter, '_id', reports.map((report) => report.imaging_order_id));
  }

  if (query.has_attachment !== undefined || query.missing_attachment !== undefined) {
    const attachments = await Attachment.find({
      entity_type: ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER,
      status: ATTACHMENT_STATUS.ACTIVE,
    }).select('entity_id').lean();
    const orderIds = [...new Set(attachments.map((attachment) => String(attachment.entity_id)))];
    if (parseBoolean(query.has_attachment) === true || parseBoolean(query.missing_attachment) === false) {
      mergeObjectIdInFilter(filter, '_id', orderIds);
    } else if (parseBoolean(query.missing_attachment) === true || parseBoolean(query.has_attachment) === false) {
      filter._id = { ...(filter._id || {}), $nin: orderIds };
    }
  }

  return filter;
}

async function enrichImagingOrders(items = [], actor = {}) {
  const ids = items.map((item) => item._id);
  const orderIds = items.map((item) => item.order_id?._id || item.order_id).filter(Boolean);
  const [reports, attachmentCounts] = await Promise.all([
    ImagingReport.find({ imaging_order_id: { $in: ids } }).sort({ verified_at: -1, reported_at: -1, created_at: -1 }).lean(),
    Attachment.aggregate([
      { $match: { order_id: { $in: orderIds }, status: ATTACHMENT_STATUS.ACTIVE } },
      { $group: { _id: '$order_id', count: { $sum: 1 }, scan_failed: { $sum: { $cond: [{ $eq: ['$scan_status', 'failed'] }, 1, 0] } }, review_pending: { $sum: { $cond: [{ $eq: ['$review_status', DOCUMENT_REVIEW_STATUS.PENDING] }, 1, 0] } } } },
    ]),
  ]);
  const reportsByOrder = new Map();
  for (const report of reports) {
    const key = String(report.imaging_order_id);
    if (!reportsByOrder.has(key)) reportsByOrder.set(key, report);
  }
  const attachmentCountByOrder = new Map(attachmentCounts.map((row) => [String(row._id), row]));
  return items.map((item) => {
    const report = reportsByOrder.get(String(item._id)) || null;
    const attachmentStats = attachmentCountByOrder.get(String(item.order_id?._id || item.order_id)) || {};
    return {
      ...item,
      report_status: report?.status || null,
      report_id: report?._id || null,
      latest_report: report,
      file_count: attachmentStats.count || 0,
      scan_failed_count: attachmentStats.scan_failed || 0,
      review_pending_count: attachmentStats.review_pending || 0,
      is_critical: Boolean(report?.is_critical),
      sla: makeImagingSlaSnapshot(item, report),
      allowed_actions: getAllowedImagingOrderActions(item, actor),
    };
  });
}

async function listImagingOrders(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildImagingOrderListFilter(query, actor);
  if (query.overdue_sla !== undefined) {
    const rows = await ImagingOrder.find(filter)
      .sort(imagingOrderSort(query))
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('encounter_id', 'encounter_code encounter_type status start_time')
      .populate('ordered_by', 'full_name username employee_code')
      .populate('assigned_technician_id', 'full_name username employee_code')
      .populate('assigned_radiologist_id', 'full_name username employee_code')
      .populate('order_id', 'order_no status priority department_id ordered_at')
      .lean();
    const enrichedRows = await enrichImagingOrders(rows, actor);
    const overdue = parseBoolean(query.overdue_sla);
    const filteredRows = enrichedRows.filter((item) => Boolean(item.sla?.is_overdue) === overdue);
    return {
      items: filteredRows.slice(skip, skip + limit),
      pagination: buildPagination(page, limit, filteredRows.length),
    };
  }

  const [items, total] = await Promise.all([
    ImagingOrder.find(filter)
      .sort(imagingOrderSort(query))
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('encounter_id', 'encounter_code encounter_type status start_time')
      .populate('ordered_by', 'full_name username employee_code')
      .populate('scheduled_by', 'full_name username employee_code')
      .populate('started_by', 'full_name username employee_code')
      .populate('completed_by', 'full_name username employee_code')
      .populate('assigned_technician_id', 'full_name username employee_code')
      .populate('assigned_radiologist_id', 'full_name username employee_code')
      .populate('order_id', 'order_no status priority department_id ordered_at')
      .lean(),
    ImagingOrder.countDocuments(filter),
  ]);

  return {
    items: await enrichImagingOrders(items, actor),
    pagination: buildPagination(page, limit, total),
  };
}

function getAllowedImagingOrderActions(imagingOrder, actor = {}) {
  return {
    can_schedule: imagingOrder.status === IMAGING_ORDER_STATUS.ORDERED && hasPermission(actor, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS),
    can_start: [IMAGING_ORDER_STATUS.ORDERED, IMAGING_ORDER_STATUS.SCHEDULED].includes(imagingOrder.status) && hasPermission(actor, PERMISSION.IMAGING_ORDERS.START),
    can_complete: imagingOrder.status === IMAGING_ORDER_STATUS.IN_PROGRESS && hasPermission(actor, PERMISSION.IMAGING_ORDERS.COMPLETE),
    can_cancel: !IMAGING_ORDER_TERMINAL_STATUSES.includes(imagingOrder.status) && hasAnyPermission(actor, [PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.ORDERS.CANCEL]),
    can_upload_attachment: ![IMAGING_ORDER_STATUS.CANCELLED, IMAGING_ORDER_STATUS.NO_SHOW].includes(imagingOrder.status) && hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD]),
    can_create_report: imagingOrder.status === IMAGING_ORDER_STATUS.COMPLETED && hasPermission(actor, PERMISSION.IMAGING_REPORTS.CREATE),
  };
}

async function getImagingOrderDetail(imagingOrderId, actor = {}) {
  const imagingOrder = await ImagingOrder.findById(imagingOrderId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time')
    .populate('ordered_by', 'full_name username employee_code')
    .populate('order_id', 'order_no status priority department_id ordered_at clinical_indication charge_id')
    .populate('scheduled_by', 'full_name username employee_code')
    .populate('started_by', 'full_name username employee_code')
    .populate('completed_by', 'full_name username employee_code')
    .populate('assigned_technician_id', 'full_name username employee_code')
    .populate('assigned_radiologist_id', 'full_name username employee_code')
    .populate('room_id', 'code name modality maintenance_status default_duration_minutes')
    .lean();
  if (!imagingOrder) throw createError('Không tìm thấy imaging order.', 404);

  const rawImagingOrder = await ImagingOrder.findById(imagingOrderId).lean();
  const context = await loadImagingOrderContext(rawImagingOrder);
  assertImagingOrderAccess(rawImagingOrder, context, actor, readAccessPermissions());

  const [reports, attachments, charge] = await Promise.all([
    ImagingReport.find({ imaging_order_id: imagingOrderId }).sort({ verified_at: -1, reported_at: -1, created_at: -1 }).lean(),
    Attachment.find({
      order_id: context.order._id,
      status: { $in: ACTIVE_ATTACHMENT_STATUSES },
    }).sort({ created_at: -1 }).lean(),
    Charge.findOne({ order_id: context.order._id }).lean(),
  ]);
  const reportIds = reports.map((report) => report._id);
  const attachmentIds = attachments.map((attachment) => attachment._id);
  const logs = await AuditLog.find({
    $or: [
      { target_type: 'imaging_order', target_id: imagingOrderId },
      { target_type: 'order', target_id: context.order._id },
      { target_type: 'imaging_report', target_id: { $in: reportIds } },
      { target_type: 'attachment', target_id: { $in: attachmentIds } },
      { 'metadata.imaging_order_id': String(imagingOrderId) },
    ],
  }).sort({ created_at: -1 }).limit(40).lean();

  return {
    imaging_order: imagingOrder,
    reports,
    attachments,
    charge,
    activity: logs,
    allowed_actions: getAllowedImagingOrderActions(rawImagingOrder, actor),
    sla: makeImagingSlaSnapshot(rawImagingOrder, reports[0]),
  };
}

async function assertRoomScheduleAvailable({ imagingOrderId, roomId, scheduledAt, durationMinutes = 30 }, session = null) {
  if (!roomId || !scheduledAt) return true;
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + Number(durationMinutes || 30) * 60000);
  const dayStart = startOfLocalDay(start);
  const dayEnd = endOfLocalDay(start);
  const existing = await withSession(ImagingOrder.find({
    _id: { $ne: imagingOrderId },
    room_id: roomId,
    status: { $in: [IMAGING_ORDER_STATUS.SCHEDULED, IMAGING_ORDER_STATUS.IN_PROGRESS] },
    scheduled_at: { $gte: dayStart, $lte: dayEnd },
  }).select('imaging_order_no scheduled_at duration_minutes').lean(), session);
  const conflict = existing.find((item) => {
    const itemStart = new Date(item.scheduled_at);
    const itemEnd = new Date(itemStart.getTime() + Number(item.duration_minutes || 30) * 60000);
    return start < itemEnd && end > itemStart;
  });
  if (conflict) {
    throw createError('Phòng CĐHA đã có lịch trong khung giờ này.', 409, {
      conflict_imaging_order_no: conflict.imaging_order_no,
      conflict_scheduled_at: conflict.scheduled_at,
    });
  }
  return true;
}

async function scheduleImagingOrder(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE]);
  const scheduledAt = parseDate(payload.scheduled_at, 'scheduled_at');
  if (!scheduledAt) throw createError('scheduled_at là bắt buộc.');
  if (scheduledAt < new Date() && !payload.allow_past_schedule) throw createError('scheduled_at không được ở quá khứ.', 409);

  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE]));
    if (context.order.status === ORDER_STATUS.CANCELLED || context.order.status === ORDER_STATUS.ENTERED_IN_ERROR) {
      throw createError('Order mẹ đã cancelled/entered_in_error.', 409);
    }
    if (imagingOrder.status !== IMAGING_ORDER_STATUS.ORDERED) throw createError('Chỉ imaging order ordered mới được schedule.', 409);
    const durationMinutes = parseOptionalNumber(payload.duration_minutes, 'duration_minutes') || imagingOrder.duration_minutes || 30;
    await assertRoomScheduleAvailable({ imagingOrderId, roomId: payload.room_id || imagingOrder.room_id, scheduledAt, durationMinutes }, session);
    imagingOrder.room_id = payload.room_id || imagingOrder.room_id;
    imagingOrder.duration_minutes = durationMinutes;
    imagingOrder.assigned_technician_id = payload.assigned_technician_id || payload.technician_id || imagingOrder.assigned_technician_id;
    imagingOrder.patient_arrival_at = parseDate(payload.patient_arrival_at, 'patient_arrival_at') || imagingOrder.patient_arrival_at;
    imagingOrder.preparation_instruction = payload.preparation_instruction || imagingOrder.preparation_instruction;
    imagingOrder.internal_note = payload.internal_note || imagingOrder.internal_note;
    await updateImagingOrderStatus(imagingOrder, IMAGING_ORDER_STATUS.SCHEDULED, actor, session, { scheduled_at: scheduledAt });
    await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.ACKNOWLEDGED, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_order.scheduled', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Schedule imaging order thành công.', requestMeta, metadata: { scheduled_at: scheduledAt } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function rescheduleImagingOrder(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE]);
  const scheduledAt = parseDate(payload.scheduled_at, 'scheduled_at');
  if (!scheduledAt) throw createError('scheduled_at là bắt buộc.');
  if (scheduledAt < new Date() && !payload.allow_past_schedule) throw createError('scheduled_at không được ở quá khứ.', 409);
  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE]));
    if (![IMAGING_ORDER_STATUS.ORDERED, IMAGING_ORDER_STATUS.SCHEDULED].includes(imagingOrder.status)) {
      throw createError('Chỉ order ordered/scheduled mới được reschedule.', 409);
    }
    const previousScheduledAt = imagingOrder.scheduled_at;
    const durationMinutes = parseOptionalNumber(payload.duration_minutes, 'duration_minutes') || imagingOrder.duration_minutes || 30;
    await assertRoomScheduleAvailable({ imagingOrderId, roomId: payload.room_id || imagingOrder.room_id, scheduledAt, durationMinutes }, session);
    imagingOrder.rescheduled_from = previousScheduledAt;
    imagingOrder.rescheduled_by = actorUserId(actor);
    imagingOrder.rescheduled_at = new Date();
    imagingOrder.reschedule_reason = payload.reason || payload.reschedule_reason;
    imagingOrder.scheduled_at = scheduledAt;
    imagingOrder.scheduled_by = actorUserId(actor);
    imagingOrder.room_id = payload.room_id || imagingOrder.room_id;
    imagingOrder.duration_minutes = durationMinutes;
    imagingOrder.patient_arrival_at = parseDate(payload.patient_arrival_at, 'patient_arrival_at') || imagingOrder.patient_arrival_at;
    imagingOrder.preparation_instruction = payload.preparation_instruction || imagingOrder.preparation_instruction;
    imagingOrder.internal_note = payload.internal_note || imagingOrder.internal_note;
    if (imagingOrder.status === IMAGING_ORDER_STATUS.ORDERED) imagingOrder.status = IMAGING_ORDER_STATUS.SCHEDULED;
    imagingOrder.updated_by = actorUserId(actor);
    await imagingOrder.save(sessionOptions(session));
    if (context.order.status === ORDER_STATUS.ORDERED) await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.ACKNOWLEDGED, actor, session);
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({ actor, action: 'imaging_order.rescheduled', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Reschedule imaging order thành công.', requestMeta, metadata: { scheduled_at: scheduledAt, reason: payload.reason || payload.reschedule_reason } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function assignImagingTechnician(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE]);
  const technicianId = payload.technician_id || payload.assigned_technician_id;
  if (!technicianId) throw createError('technician_id là bắt buộc.', 400);
  const imagingOrder = await getImagingOrderOrThrow(imagingOrderId);
  const context = await loadImagingOrderContext(imagingOrder);
  assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.UPDATE_STATUS]));
  imagingOrder.assigned_technician_id = technicianId;
  imagingOrder.assigned_by = actorUserId(actor);
  imagingOrder.assigned_at = new Date();
  imagingOrder.updated_by = actorUserId(actor);
  await imagingOrder.save();
  await recordAuditLog({ actor, action: 'imaging_order.technician_assigned', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Assign imaging technician thành công.', requestMeta, metadata: { technician_id: technicianId } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function assignImagingRadiologist(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS]);
  const radiologistId = payload.radiologist_id || payload.assigned_radiologist_id;
  if (!radiologistId) throw createError('radiologist_id là bắt buộc.', 400);
  const imagingOrder = await getImagingOrderOrThrow(imagingOrderId);
  const context = await loadImagingOrderContext(imagingOrder);
  assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS]));
  imagingOrder.assigned_radiologist_id = radiologistId;
  imagingOrder.assigned_by = actorUserId(actor);
  imagingOrder.assigned_at = new Date();
  imagingOrder.updated_by = actorUserId(actor);
  await imagingOrder.save();
  await recordAuditLog({ actor, action: 'imaging_order.radiologist_assigned', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Assign radiologist thành công.', requestMeta, metadata: { radiologist_id: radiologistId } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function updateImagingArrivalStatus(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.IMAGING_ORDERS.START]);
  const status = payload.arrival_status;
  if (!['arrived', 'ready', 'not_ready'].includes(status)) throw createError('arrival_status không hợp lệ.', 400);
  const imagingOrder = await getImagingOrderOrThrow(imagingOrderId);
  const context = await loadImagingOrderContext(imagingOrder);
  assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.IMAGING_ORDERS.START]));
  imagingOrder.arrival_status = status;
  if (status === 'arrived') imagingOrder.arrival_at = parseDate(payload.arrival_at, 'arrival_at') || new Date();
  if (status === 'ready') imagingOrder.ready_at = parseDate(payload.ready_at, 'ready_at') || new Date();
  if (status === 'not_ready') imagingOrder.not_ready_reason = payload.reason || payload.not_ready_reason;
  imagingOrder.updated_by = actorUserId(actor);
  await imagingOrder.save();
  await recordAuditLog({ actor, action: `imaging_order.patient_${status}`, targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Cập nhật trạng thái chuẩn bị CĐHA.', requestMeta, metadata: { arrival_status: status, reason: imagingOrder.not_ready_reason } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function checkContrastAllergyRisk(imagingOrder, payload = {}) {
  if (!imagingOrder.contrast_required) return [];
  const allergies = await Allergy.find({
    patient_id: imagingOrder.patient_id,
    allergy_type: ALLERGY_TYPE.CONTRAST,
    status: ALLERGY_STATUS.ACTIVE,
  }).lean();
  if (allergies.length === 0) return [];
  const hasHighRisk = allergies.some((item) => [ALLERGY_SEVERITY.SEVERE, ALLERGY_SEVERITY.LIFE_THREATENING].includes(item.severity));
  if (hasHighRisk && !payload.override_contrast_allergy) {
    throw createError('Bệnh nhân có allergy contrast mức cao. Cần override_contrast_allergy và reason trước khi start.', 409, {
      allergies,
    });
  }
  if (hasHighRisk && !nonEmpty(payload.override_reason)) {
    throw createError('override_reason là bắt buộc khi override contrast allergy.', 409);
  }
  return allergies.map((item) => ({
    allergy_id: item._id,
    allergen: item.allergen,
    severity: item.severity,
  }));
}

async function startImagingOrder(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.START, PERMISSION.ORDERS.START]);
  let warnings = [];
  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.START, PERMISSION.ORDERS.START]));
    if (![IMAGING_ORDER_STATUS.ORDERED, IMAGING_ORDER_STATUS.SCHEDULED].includes(imagingOrder.status)) {
      throw createError('Imaging order phải ordered/scheduled trước khi start.', 409);
    }
    warnings = await checkContrastAllergyRisk(imagingOrder, payload);
    imagingOrder.technical_note = payload.technical_note || imagingOrder.technical_note;
    await updateImagingOrderStatus(imagingOrder, IMAGING_ORDER_STATUS.IN_PROGRESS, actor, session, { started_at: parseDate(payload.started_at, 'started_at') || new Date() });
    await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_order.started', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Start imaging order thành công.', requestMeta, metadata: { contrast_warnings: warnings, override_reason: payload.override_reason } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function completeImagingOrder(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.COMPLETE, PERMISSION.ORDERS.START]);
  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.COMPLETE, PERMISSION.ORDERS.START]));
    if (imagingOrder.status !== IMAGING_ORDER_STATUS.IN_PROGRESS) throw createError('Chỉ imaging order in_progress mới được complete kỹ thuật.', 409);
    if (payload.require_attachment) {
      const attachmentExists = await withSession(Attachment.exists({
        order_id: imagingOrder.order_id,
        status: ATTACHMENT_STATUS.ACTIVE,
      }), session);
      if (!attachmentExists) throw createError('Cần ít nhất một imaging attachment trước khi complete kỹ thuật.', 409);
    }
    imagingOrder.technical_note = payload.technical_note || imagingOrder.technical_note;
    imagingOrder.repeat_requested = parseBoolean(payload.repeat_requested) === true || imagingOrder.repeat_requested;
    imagingOrder.repeat_reason = payload.repeat_reason || imagingOrder.repeat_reason;
    await updateImagingOrderStatus(imagingOrder, IMAGING_ORDER_STATUS.COMPLETED, actor, session, { completed_at: parseDate(payload.completed_at, 'completed_at') || new Date() });
    if (context.order.status !== ORDER_STATUS.IN_PROGRESS) {
      await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_order.completed', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Complete technical imaging order thành công. Order mẹ vẫn chờ report final.', requestMeta });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function voidChargeForImagingOrder(orderId, reason, actor, session = null) {
  const charges = await withSession(Charge.find({
    order_id: orderId,
    status: { $nin: [CHARGE_STATUS.VOIDED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.REFUNDED] },
  }), session);
  for (const charge of charges) {
    if (charge.invoice_id || charge.status === CHARGE_STATUS.BILLED) {
      throw createError('Imaging order đã có charge lên invoice, cần Billing Module xử lý adjustment.', 409);
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

async function cancelImagingOrder(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.ORDERS.CANCEL]);
  const reason = payload.reason || payload.cancel_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi cancel imaging order.');
  let voidedCharges = 0;

  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.ORDERS.CANCEL]));
    if (IMAGING_ORDER_TERMINAL_STATUSES.includes(imagingOrder.status)) throw createError('Imaging order đã ở trạng thái kết thúc.', 409);
    const finalReportExists = await withSession(ImagingReport.exists({
      imaging_order_id: imagingOrder._id,
      status: { $in: FINAL_REPORT_STATUSES },
    }), session);
    if (finalReportExists) throw createError('Imaging order đã có report final/amended, không thể cancel thường.', 409);
    if (imagingOrder.status === IMAGING_ORDER_STATUS.IN_PROGRESS && !payload.force) {
      throw createError('Imaging order đang in_progress, cần force/override để cancel.', 409);
    }
    voidedCharges = await voidChargeForImagingOrder(imagingOrder.order_id, reason, actor, session);
    await updateImagingOrderStatus(imagingOrder, IMAGING_ORDER_STATUS.CANCELLED, actor, session, { reason });
    await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.CANCELLED, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_order.cancelled', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Cancel imaging order thành công.', requestMeta, metadata: { reason, voided_charges: voidedCharges } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function markImagingOrderNoShow(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS]);
  const reason = payload.reason || payload.no_show_reason || 'no_show';
  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS]));
    if (![IMAGING_ORDER_STATUS.ORDERED, IMAGING_ORDER_STATUS.SCHEDULED].includes(imagingOrder.status)) {
      throw createError('Chỉ ordered/scheduled imaging order mới được mark no_show.', 409);
    }
    await updateImagingOrderStatus(imagingOrder, IMAGING_ORDER_STATUS.NO_SHOW, actor, session, { reason });
    await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.CANCELLED, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_order.no_show', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Mark imaging order no_show thành công.', requestMeta, metadata: { reason } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

function validateAttachmentPayload(payload = {}) {
  if (!nonEmpty(payload.file_name)) throw createError('file_name là bắt buộc.');
  if (!nonEmpty(payload.storage_path)) throw createError('storage_path là bắt buộc.');
  const fileSize = payload.file_size !== undefined ? Number(payload.file_size) : undefined;
  if (fileSize !== undefined && (!Number.isFinite(fileSize) || fileSize < 0)) throw createError('file_size không hợp lệ.');
  return {
    file_name: normalizeString(payload.file_name),
    original_name: payload.original_name ? normalizeString(payload.original_name) : undefined,
    mime_type: payload.mime_type ? normalizeString(payload.mime_type) : undefined,
    file_size: fileSize,
    storage_path: normalizeString(payload.storage_path),
    storage_provider: normalizeOptionalString(payload.storage_provider),
    storage_key: normalizeOptionalString(payload.storage_key),
    checksum: payload.checksum ? normalizeString(payload.checksum) : undefined,
    checksum_sha256: normalizeOptionalString(payload.checksum_sha256),
    preview_url: normalizeOptionalString(payload.preview_url),
    thumbnail_url: normalizeOptionalString(payload.thumbnail_url),
    category: normalizeString(payload.category) || 'imaging_image',
    description: payload.description,
    scan_status: normalizeOptionalString(payload.scan_status),
    review_status: normalizeOptionalString(payload.review_status),
    visibility: normalizeOptionalString(payload.visibility),
    released_to_patient: parseBoolean(payload.released_to_patient) === true,
  };
}

async function uploadImagingAttachment(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD]);
  const normalized = validateAttachmentPayload(payload);
  let attachmentId;
  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD]));
    if ([IMAGING_ORDER_STATUS.CANCELLED, IMAGING_ORDER_STATUS.NO_SHOW].includes(imagingOrder.status)) {
      throw createError('Không upload attachment vào imaging order cancelled/no_show.', 409);
    }
    if (normalized.checksum) {
      const duplicate = await withSession(Attachment.exists({
        order_id: imagingOrder.order_id,
        checksum: normalized.checksum,
        status: ATTACHMENT_STATUS.ACTIVE,
      }), session);
      if (duplicate) throw createError('Attachment checksum đã tồn tại cho imaging order này.', 409);
    }
    const [attachment] = await Attachment.create([{
      patient_id: imagingOrder.patient_id,
      encounter_id: imagingOrder.encounter_id,
      order_id: imagingOrder.order_id,
      entity_type: ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER,
      entity_id: imagingOrder._id,
      uploaded_by: actor?.userId,
      ...normalized,
      status: ATTACHMENT_STATUS.ACTIVE,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    attachmentId = attachment._id;
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_attachment.uploaded', targetType: 'attachment', targetId: attachmentId, status: 'success', message: 'Upload imaging attachment thành công.', requestMeta, metadata: { imaging_order_id: String(imagingOrderId) } });
  return Attachment.findById(attachmentId).lean();
}

async function listImagingAttachments(imagingOrderId, actor = {}) {
  const imagingOrder = await ImagingOrder.findById(imagingOrderId).lean();
  if (!imagingOrder) throw createError('Không tìm thấy imaging order.', 404);
  const context = await loadImagingOrderContext(imagingOrder);
  assertImagingOrderAccess(imagingOrder, context, actor, readAccessPermissions());
  const attachments = await Attachment.find({
    order_id: imagingOrder.order_id,
    status: ATTACHMENT_STATUS.ACTIVE,
  }).sort({ created_at: -1 }).lean();
  return { items: attachments };
}

async function deleteImagingAttachment(attachmentId, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.ARCHIVE]);
  await withOptionalTransaction(async (session) => {
    const attachment = await withSession(Attachment.findById(attachmentId), session);
    if (!attachment) throw createError('Không tìm thấy attachment.', 404);
    if (attachment.status !== ATTACHMENT_STATUS.ACTIVE) throw createError('Attachment không active.', 409);
    const imagingOrder = await withSession(ImagingOrder.findOne({ order_id: attachment.order_id }), session);
    if (!imagingOrder) throw createError('Attachment không thuộc imaging order hợp lệ.', 409);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.ARCHIVE]));
    attachment.status = ATTACHMENT_STATUS.DELETED;
    attachment.deleted_by = actor?.userId;
    attachment.deleted_at = new Date();
    attachment.updated_by = actor?.userId;
    await attachment.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({ actor, action: 'imaging_attachment.deleted', targetType: 'attachment', targetId: attachmentId, status: 'success', message: 'Soft delete imaging attachment thành công.', requestMeta });
  return { deleted: true };
}

async function listImagingFiles(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.READ_IMAGING, PERMISSION.ATTACHMENTS.READ, PERMISSION.IMAGING_ORDERS.READ, PERMISSION.IMAGING_REPORTS.READ]);
  const { page, limit, skip } = getPagination(query);
  const filter = {
    entity_type: { $in: [ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER, ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT] },
    status: query.include_deleted === 'true' ? { $ne: null } : ATTACHMENT_STATUS.ACTIVE,
  };
  for (const field of ['category', 'scan_status', 'review_status', 'visibility', 'patient_id', 'encounter_id', 'order_id']) {
    addQueryFilter(filter, field, query[field]);
  }
  if (query.released_to_patient !== undefined) filter.released_to_patient = parseBoolean(query.released_to_patient) === true;
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [
      { file_name: { $regex: keyword, $options: 'i' } },
      { original_name: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    Attachment.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('uploaded_by', 'full_name username employee_code')
      .populate('reviewed_by', 'full_name username employee_code')
      .lean(),
    Attachment.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getAttachmentImagingOrder(attachment, session = null) {
  if (attachment.entity_type === ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER) {
    return withSession(ImagingOrder.findById(attachment.entity_id), session);
  }
  if (attachment.order_id) {
    return withSession(ImagingOrder.findOne({ order_id: attachment.order_id }), session);
  }
  return null;
}

async function reviewImagingFile(attachmentId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.READ_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT]);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  const imagingOrder = await getAttachmentImagingOrder(attachment);
  if (!imagingOrder) throw createError('Attachment không thuộc imaging order hợp lệ.', 409);
  const context = await loadImagingOrderContext(imagingOrder);
  assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT]));
  if (payload.review_status) attachment.review_status = payload.review_status;
  if (payload.review_note !== undefined) attachment.review_note = payload.review_note;
  attachment.reviewed_by = actorUserId(actor);
  attachment.reviewed_at = new Date();
  attachment.updated_by = actorUserId(actor);
  await attachment.save();
  await recordAuditLog({ actor, action: 'imaging_attachment.reviewed', targetType: 'attachment', targetId: attachmentId, status: 'success', message: 'Review imaging file thành công.', requestMeta, metadata: { review_status: attachment.review_status } });
  return attachment.toObject();
}

async function releaseImagingFileToPatient(attachmentId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.RELEASE_TO_PATIENT, PERMISSION.IMAGING_REPORTS.RELEASE_TO_PATIENT]);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  attachment.released_to_patient = payload.released_to_patient !== false;
  attachment.released_at = new Date();
  attachment.released_by = actorUserId(actor);
  attachment.visibility = payload.visibility || DOCUMENT_VISIBILITY.PATIENT_VISIBLE;
  attachment.updated_by = actorUserId(actor);
  await attachment.save();
  await recordAuditLog({ actor, action: 'imaging_attachment.released_to_patient', targetType: 'attachment', targetId: attachmentId, status: 'success', message: 'Release imaging file cho patient.', requestMeta });
  return attachment.toObject();
}

async function archiveImagingFile(attachmentId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.ARCHIVE, PERMISSION.ATTACHMENTS.DELETE_SOFT]);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  attachment.status = ATTACHMENT_STATUS.ARCHIVED;
  attachment.archived_by = actorUserId(actor);
  attachment.archived_by_staff = true;
  attachment.archived_at = new Date();
  attachment.archive_reason = payload.reason || payload.archive_reason;
  attachment.updated_by = actorUserId(actor);
  await attachment.save();
  await recordAuditLog({ actor, action: 'imaging_attachment.archived', targetType: 'attachment', targetId: attachmentId, status: 'success', message: 'Archive imaging file.', requestMeta, metadata: { reason: attachment.archive_reason } });
  return attachment.toObject();
}

async function restoreImagingFile(attachmentId, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.RESTORE, PERMISSION.ATTACHMENTS.ARCHIVE]);
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy attachment.', 404);
  attachment.status = ATTACHMENT_STATUS.ACTIVE;
  attachment.archived_by = undefined;
  attachment.archived_by_staff = false;
  attachment.archived_at = undefined;
  attachment.archive_reason = undefined;
  attachment.updated_by = actorUserId(actor);
  await attachment.save();
  await recordAuditLog({ actor, action: 'imaging_attachment.restored', targetType: 'attachment', targetId: attachmentId, status: 'success', message: 'Restore imaging file.', requestMeta });
  return attachment.toObject();
}

async function createImagingUploadUrl(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD]);
  const imagingOrder = await getImagingOrderOrThrow(imagingOrderId);
  const context = await loadImagingOrderContext(imagingOrder);
  assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD]));
  const fileName = normalizeOptionalString(payload.file_name || payload.original_name);
  if (!fileName) throw createError('file_name là bắt buộc.', 400);
  const storageKey = `imaging/${imagingOrderId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  await recordAuditLog({ actor, action: 'imaging_attachment.upload_url_created', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Tạo upload-url imaging file.', requestMeta, metadata: { storage_key: storageKey } });
  return {
    upload_url: `/api/files/local-upload/${storageKey}`,
    storage_provider: payload.storage_provider || 'local',
    storage_key: storageKey,
    expires_in_seconds: 900,
  };
}

async function completeImagingFileUpload(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  if (!payload.storage_path && payload.storage_key) payload.storage_path = payload.storage_key;
  return uploadImagingAttachment(imagingOrderId, payload, actor, requestMeta);
}

function validateReportPayload(payload = {}, options = {}) {
  if (options.requireImpression && !nonEmpty(payload.impression)) throw createError('impression là bắt buộc khi finalize imaging report.', 409);
  return {
    technician_id: payload.technician_id || undefined,
    findings: payload.findings,
    impression: payload.impression,
    recommendation: payload.recommendation,
    is_critical: Boolean(payload.is_critical),
    critical_note: payload.critical_note,
    status: payload.status || IMAGING_REPORT_STATUS.DRAFT,
  };
}

async function createImagingReport(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.IMAGING_REPORTS.CREATE);
  let reportId;
  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.CREATE]));
    if (imagingOrder.status !== IMAGING_ORDER_STATUS.COMPLETED) {
      throw createError('Imaging order phải completed kỹ thuật trước khi tạo report.', 409);
    }
    const activeReport = await withSession(ImagingReport.exists({
      imaging_order_id: imagingOrder._id,
      status: { $in: [IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY, IMAGING_REPORT_STATUS.FINAL, IMAGING_REPORT_STATUS.AMENDED] },
    }), session);
    if (activeReport) throw createError('Imaging order đã có report active.', 409);
    const normalized = validateReportPayload(payload);
    const reportNo = payload.report_no || await generateImagingReportNumber({ session });
    const [report] = await ImagingReport.create([{
      imaging_order_id: imagingOrder._id,
      patient_id: imagingOrder.patient_id,
      report_no: reportNo,
      radiologist_id: actor?.userId,
      technician_id: normalized.technician_id,
      findings: normalized.findings,
      impression: normalized.impression,
      recommendation: normalized.recommendation,
      reported_at: normalized.status === IMAGING_REPORT_STATUS.PRELIMINARY ? new Date() : undefined,
      is_critical: normalized.is_critical,
      critical_note: normalized.critical_note,
      status: normalized.status === IMAGING_REPORT_STATUS.PRELIMINARY ? IMAGING_REPORT_STATUS.PRELIMINARY : IMAGING_REPORT_STATUS.DRAFT,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    reportId = report._id;
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_report.created', targetType: 'imaging_report', targetId: reportId, status: 'success', message: 'Tạo imaging report thành công.', requestMeta, metadata: { imaging_order_id: String(imagingOrderId) } });
  return getImagingReportDetail(reportId, actor);
}

async function getImagingReportDetail(reportId, actor = {}) {
  const report = await ImagingReport.findById(reportId)
    .populate('imaging_order_id', 'imaging_order_no order_id encounter_id modality body_part status')
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('radiologist_id', 'full_name username employee_code')
    .populate('technician_id', 'full_name username employee_code')
    .populate('verified_by', 'full_name username employee_code')
    .lean();
  if (!report) throw createError('Không tìm thấy imaging report.', 404);

  const rawReport = await ImagingReport.findById(reportId).lean();
  const { imagingOrder, ...context } = await loadReportContext(rawReport);
  if (actorType(actor) === 'patient') {
    if (!sameId(rawReport.patient_id, actor.patientId || actor.patient_id)) throw createError('Bạn không có quyền xem report này.', 403);
    if (!rawReport.released_to_patient || !FINAL_REPORT_STATUSES.includes(rawReport.status)) {
      throw createError('Report chưa được release cho patient portal.', 403);
    }
  } else {
    assertImagingOrderAccess(imagingOrder, context, actor, readAccessPermissions());
  }

  const attachments = await Attachment.find({
    $or: [
      { entity_type: ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT, entity_id: rawReport._id },
      { order_id: imagingOrder.order_id },
    ],
    status: ATTACHMENT_STATUS.ACTIVE,
  }).sort({ created_at: -1 }).lean();

  return {
    report,
    attachments: attachments.map((attachment) => sanitizeAttachmentForActor(attachment, actor)),
  };
}

async function buildScopedReportFilter(query = {}, actor = {}) {
  const filter = {};
  for (const field of ['patient_id', 'imaging_order_id', 'status', 'radiologist_id', 'technician_id']) {
    addQueryFilter(filter, field, query[field]);
  }
  applyDateRange(filter, query, 'reported_at');
  applyDateRange(filter, query, 'verified_at', 'verified_from', 'verified_to');

  if (query.is_critical !== undefined) filter.is_critical = parseBoolean(query.is_critical) === true;
  if (query.released_to_patient !== undefined) filter.released_to_patient = parseBoolean(query.released_to_patient) === true;
  if (query.amended === 'true') filter.status = IMAGING_REPORT_STATUS.AMENDED;
  if (query.critical_unacknowledged === 'true') {
    filter.is_critical = true;
    filter.critical_acknowledged_at = null;
  }
  if (query.critical_ack_overdue === 'true') {
    filter.is_critical = true;
    filter.critical_acknowledged_at = null;
    filter.critical_notified_at = { $lte: new Date(Date.now() - 30 * 60000) };
  }
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [
      { report_no: { $regex: keyword, $options: 'i' } },
      { findings: { $regex: keyword, $options: 'i' } },
      { impression: { $regex: keyword, $options: 'i' } },
      { critical_note: { $regex: keyword, $options: 'i' } },
    ];
  }

  if (query.encounter_id || query.modality || query.body_part || query.priority || query.department_id) {
    const imagingOrderFilter = {};
    if (query.encounter_id) imagingOrderFilter.encounter_id = query.encounter_id;
    if (query.modality) addQueryFilter(imagingOrderFilter, 'modality', query.modality);
    if (query.body_part) imagingOrderFilter.body_part = { $regex: escapeRegex(query.body_part), $options: 'i' };
    if (query.priority) addQueryFilter(imagingOrderFilter, 'priority', query.priority);
    if (query.department_id) {
      const orderIds = await Order.distinct('_id', { order_type: ORDER_TYPE.IMAGING, department_id: query.department_id });
      imagingOrderFilter.order_id = { $in: orderIds };
    }
    const imagingOrders = await ImagingOrder.find(imagingOrderFilter).select('_id').lean();
    filter.imaging_order_id = { $in: imagingOrders.map((order) => order._id) };
  }

  if (actorType(actor) === 'patient') {
    filter.patient_id = actor.patientId || actor.patient_id;
    filter.released_to_patient = true;
    filter.status = { $in: FINAL_REPORT_STATUSES };
    return filter;
  }

  if (!actorType(actor)) return filter;
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.IMAGING_REPORTS.READ, PERMISSION.IMAGING_REPORTS.READ_FINAL, PERMISSION.IMAGING_ORDERS.READ, PERMISSION.ORDERS.READ_IMAGING, PERMISSION.ORDERS.READ])) {
    return filter;
  }

  if (actor.userId && hasAnyPermission(actor, [PERMISSION.IMAGING_ORDERS.READ_OWN, PERMISSION.ORDERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_OWN])) {
    const imagingOrders = await ImagingOrder.find({ ordered_by: actor.userId }).select('_id').lean();
    filter.imaging_order_id = { $in: imagingOrders.map((order) => order._id) };
    return filter;
  }

  const departmentId = actorDepartmentId(actor);
  if (departmentId && hasAnyPermission(actor, [PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT, PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_DEPARTMENT])) {
    const orders = await Order.find({ order_type: ORDER_TYPE.IMAGING, department_id: departmentId }).select('_id').lean();
    const imagingOrders = await ImagingOrder.find({ order_id: { $in: orders.map((order) => order._id) } }).select('_id').lean();
    filter.imaging_order_id = { $in: imagingOrders.map((order) => order._id) };
    return filter;
  }

  throw createError('Bạn không có quyền xem imaging reports.', 403);
}

async function listImagingReports(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildScopedReportFilter(query, actor);
  const [items, total] = await Promise.all([
    ImagingReport.find(filter)
      .sort({ reported_at: -1, verified_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('imaging_order_id', 'imaging_order_no modality body_part status encounter_id order_id')
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('radiologist_id', 'full_name username employee_code')
      .populate('verified_by', 'full_name username employee_code')
      .lean(),
    ImagingReport.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function updateImagingReport(reportId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.UPDATE_OWN]);
  await withOptionalTransaction(async (session) => {
    const report = await getImagingReportOrThrow(reportId, session);
    const { imagingOrder, ...context } = await loadReportContext(report, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.UPDATE_OWN]));
    if (![IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY].includes(report.status)) {
      throw createError('Final/amended report không sửa trực tiếp, phải amend.', 409);
    }
    if (!sameId(report.radiologist_id, actor?.userId) && !hasPermission(actor, PERMISSION.IMAGING_REPORTS.WRITE)) {
      throw createError('Chỉ radiologist tạo report hoặc người có quyền write mới được sửa.', 403);
    }
    const before = report.toObject();
    const normalized = validateReportPayload(payload);
    if (payload.findings !== undefined) report.findings = normalized.findings;
    if (payload.impression !== undefined) report.impression = normalized.impression;
    if (payload.recommendation !== undefined) report.recommendation = normalized.recommendation;
    if (payload.is_critical !== undefined) report.is_critical = normalized.is_critical;
    if (payload.critical_note !== undefined) report.critical_note = normalized.critical_note;
    if (payload.status === IMAGING_REPORT_STATUS.PRELIMINARY && report.status === IMAGING_REPORT_STATUS.DRAFT) {
      assertTransition(IMAGING_REPORT_TRANSITIONS, report.status, IMAGING_REPORT_STATUS.PRELIMINARY, 'imaging_report');
      report.status = IMAGING_REPORT_STATUS.PRELIMINARY;
      report.reported_at = report.reported_at || new Date();
    }
    report.updated_by = actor?.userId;
    await report.save(sessionOptions(session));
    await recordAuditLog({ actor, action: 'imaging_report.updated', targetType: 'imaging_report', targetId: report._id, status: 'success', message: 'Cập nhật imaging report thành công.', requestMeta, before, after: report.toObject() });
  }, { fallbackToNoTransaction: true });
  return getImagingReportDetail(reportId, actor);
}

async function validateImagingReportBeforeFinalize(reportId, actor = {}, session = null) {
  assertStaffPermission(actor, PERMISSION.IMAGING_REPORTS.FINALIZE);
  const report = await getImagingReportOrThrow(reportId, session);
  const { imagingOrder, ...context } = await loadReportContext(report, session);
  assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.FINALIZE]));
  if (![IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY].includes(report.status)) {
    throw createError('Chỉ draft/preliminary report mới được finalize.', 409);
  }
  if (imagingOrder.status !== IMAGING_ORDER_STATUS.COMPLETED) {
    throw createError('Imaging order phải completed kỹ thuật trước khi finalize report.', 409);
  }
  if (!nonEmpty(report.impression)) throw createError('impression là bắt buộc khi finalize imaging report.', 409);
  return {
    report,
    imagingOrder,
    context,
    warnings: report.is_critical ? [{ code: 'critical_imaging_finding', message: 'Report được đánh dấu critical.' }] : [],
  };
}

async function finalizeImagingReport(reportId, actor, requestMeta = {}) {
  let critical = false;
  await withOptionalTransaction(async (session) => {
    const validation = await validateImagingReportBeforeFinalize(reportId, actor, session);
    const before = validation.report.toObject();
    assertTransition(IMAGING_REPORT_TRANSITIONS, validation.report.status, IMAGING_REPORT_STATUS.FINAL, 'imaging_report');
    validation.report.status = IMAGING_REPORT_STATUS.FINAL;
    validation.report.verified_by = actor?.userId;
    validation.report.verified_at = new Date();
    validation.report.reported_at = validation.report.reported_at || new Date();
    validation.report.updated_by = actor?.userId;
    if (validation.report.is_critical) validation.report.critical_notified_at = new Date();
    await validation.report.save(sessionOptions(session));
    await updateOrderStatus(validation.imagingOrder.order_id, ORDER_STATUS.COMPLETED, actor, session);
    critical = validation.report.is_critical;
    await recordAuditLog({ actor, action: 'imaging_report.finalized', targetType: 'imaging_report', targetId: validation.report._id, status: 'success', message: 'Finalize imaging report thành công.', requestMeta, before, after: validation.report.toObject(), metadata: { warnings: validation.warnings } });
  }, { fallbackToNoTransaction: true });

  await notifyDoctorImagingFinal(reportId, actor, { critical });
  return getImagingReportDetail(reportId, actor);
}

async function amendImagingReport(reportId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.IMAGING_REPORTS.AMEND);
  const reason = payload.reason || payload.amend_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi amend imaging report.');

  await withOptionalTransaction(async (session) => {
    const report = await getImagingReportOrThrow(reportId, session);
    const { imagingOrder, ...context } = await loadReportContext(report, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.AMEND]));
    if (!FINAL_REPORT_STATUSES.includes(report.status)) throw createError('Chỉ final/amended report mới được amend.', 409);
    const before = report.toObject();
    if (report.status !== IMAGING_REPORT_STATUS.AMENDED) {
      assertTransition(IMAGING_REPORT_TRANSITIONS, report.status, IMAGING_REPORT_STATUS.AMENDED, 'imaging_report');
    }
    if (payload.findings !== undefined) report.findings = payload.findings;
    if (payload.impression !== undefined) report.impression = payload.impression;
    if (!nonEmpty(report.impression)) throw createError('impression là bắt buộc sau amend.', 409);
    if (payload.recommendation !== undefined) report.recommendation = payload.recommendation;
    if (payload.is_critical !== undefined) report.is_critical = Boolean(payload.is_critical);
    if (payload.critical_note !== undefined) report.critical_note = payload.critical_note;
    report.status = IMAGING_REPORT_STATUS.AMENDED;
    report.amended_by = actor?.userId;
    report.amended_at = new Date();
    report.amend_reason = reason;
    report.verified_by = actor?.userId;
    report.verified_at = new Date();
    report.updated_by = actor?.userId;
    if (report.is_critical && !report.critical_notified_at) report.critical_notified_at = new Date();
    await report.save(sessionOptions(session));
    if (context.order.status !== ORDER_STATUS.COMPLETED) {
      await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.COMPLETED, actor, session);
    }
    await recordAuditLog({ actor, action: 'imaging_report.amended', targetType: 'imaging_report', targetId: report._id, status: 'success', message: 'Amend imaging report thành công.', requestMeta, before, after: report.toObject(), metadata: { reason } });
  }, { fallbackToNoTransaction: true });

  await notifyDoctorImagingFinal(reportId, actor, { amended: true });
  return getImagingReportDetail(reportId, actor);
}

async function cancelImagingReport(reportId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.IMAGING_REPORTS.CANCEL);
  const reason = payload.reason || payload.cancel_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi cancel imaging report.');

  await withOptionalTransaction(async (session) => {
    const report = await getImagingReportOrThrow(reportId, session);
    const { imagingOrder, ...context } = await loadReportContext(report, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.CANCEL]));
    if (report.status === IMAGING_REPORT_STATUS.CANCELLED) throw createError('Report đã cancelled.', 409);
    if (FINAL_REPORT_STATUSES.includes(report.status)) {
      throw createError('Không cancel report final/amended bằng flow thường. Hãy dùng amend/correction để không lệch trạng thái order.', 409);
    }
    assertTransition(IMAGING_REPORT_TRANSITIONS, report.status, IMAGING_REPORT_STATUS.CANCELLED, 'imaging_report');
    report.status = IMAGING_REPORT_STATUS.CANCELLED;
    report.cancelled_by = actor?.userId;
    report.cancelled_at = new Date();
    report.cancel_reason = reason;
    report.updated_by = actor?.userId;
    await report.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_report.cancelled', targetType: 'imaging_report', targetId: reportId, status: 'success', message: 'Cancel imaging report thành công.', requestMeta, metadata: { reason } });
  return getImagingReportDetail(reportId, actor);
}

async function notifyDoctorImagingFinal(reportId, actor = {}, options = {}) {
  return notificationService.notifyImagingReportFinal(reportId, actor, options);
}

async function releaseImagingReportToPatient(reportId, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.IMAGING_REPORTS.RELEASE_TO_PATIENT);
  await withOptionalTransaction(async (session) => {
    const report = await getImagingReportOrThrow(reportId, session);
    const { imagingOrder, ...context } = await loadReportContext(report, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.RELEASE_TO_PATIENT]));
    if (!FINAL_REPORT_STATUSES.includes(report.status)) throw createError('Chỉ final/amended report mới được release cho patient.', 409);
    report.released_to_patient = true;
    report.released_at = new Date();
    report.released_by = actor?.userId;
    report.updated_by = actor?.userId;
    await report.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  const report = await ImagingReport.findById(reportId).lean();
  await notificationService.notifyImagingReportFinal(report._id, actor, { released: true, patient_only: true });

  await recordAuditLog({ actor, action: 'imaging_report.released_to_patient', targetType: 'imaging_report', targetId: reportId, status: 'success', message: 'Release imaging report cho patient thành công.', requestMeta });
  return getImagingReportDetail(reportId, actor);
}

async function acknowledgeCriticalImagingReport(reportId, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE, PERMISSION.IMAGING_REPORTS.READ_FINAL]);
  await withOptionalTransaction(async (session) => {
    const report = await getImagingReportOrThrow(reportId, session);
    const { imagingOrder, ...context } = await loadReportContext(report, session);
    assertImagingOrderAccess(imagingOrder, context, actor, readAccessPermissions());
    if (!report.is_critical) throw createError('Report không phải critical.', 409);
    report.critical_acknowledged_by = actor?.userId;
    report.critical_acknowledged_at = new Date();
    report.updated_by = actor?.userId;
    await report.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({ actor, action: 'imaging_report.critical_acknowledged', targetType: 'imaging_report', targetId: reportId, status: 'success', message: 'Acknowledge critical imaging report thành công.', requestMeta });
  return getImagingReportDetail(reportId, actor);
}

async function getMyImagingReports(actor = {}, query = {}) {
  if (actorType(actor) !== 'patient') throw createError('Chỉ patient được gọi API này.', 403);
  if (!hasPermission(actor, PERMISSION.IMAGING_REPORTS.SELF_READ_RELEASED)) throw createError('Bạn không có quyền xem imaging reports.', 403);
  return listImagingReports(query, actor);
}

function assertSelfImagingPatient(actor = {}) {
  if (actorType(actor) !== 'patient') throw createError('Chỉ patient được gọi API này.', 403);
  if (!hasPermission(actor, PERMISSION.IMAGING_REPORTS.SELF_READ_RELEASED)) throw createError('Bạn không có quyền xem imaging reports.', 403);
  const patientId = actor.patientId || actor.patient_id;
  if (!patientId) throw createError('Không xác định được patient_id.', 403);
  return patientId;
}

function buildReleasedImagingReportFilter(patientId) {
  const normalizedPatientId = typeof patientId === 'string' && mongoose.Types.ObjectId.isValid(patientId)
    ? new mongoose.Types.ObjectId(patientId)
    : patientId;
  return {
    patient_id: normalizedPatientId,
    released_to_patient: true,
    release_revoked_at: { $exists: false },
    is_current: { $ne: false },
    status: { $in: FINAL_REPORT_STATUSES },
  };
}

async function getMyImagingReportsSummary(actor = {}) {
  const patientId = assertSelfImagingPatient(actor);
  const filter = buildReleasedImagingReportFilter(patientId);
  const [total, unviewed, critical, recent, byModality] = await Promise.all([
    ImagingReport.countDocuments(filter),
    ImagingReport.countDocuments({ ...filter, patient_viewed_at: null }),
    ImagingReport.countDocuments({ ...filter, is_critical: true }),
    ImagingReport.find(filter).sort({ released_at: -1, reported_at: -1, created_at: -1 }).limit(5).lean(),
    ImagingReport.aggregate([
      { $match: filter },
      { $lookup: { from: 'imaging_orders', localField: 'imaging_order_id', foreignField: '_id', as: 'order' } },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$order.modality', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    total,
    new_count: unviewed,
    unviewed,
    viewed: Math.max(0, total - unviewed),
    critical,
    recent,
    by_modality: Object.fromEntries(byModality.map((row) => [row._id || 'other', row.count])),
  };
}

async function getMyImagingReportFiles(reportId, actor = {}) {
  const detail = await getImagingReportDetail(reportId, actor);
  return { report: detail.report, files: detail.attachments || [] };
}

async function markMyImagingReportViewed(reportId, actor = {}, requestMeta = {}) {
  const patientId = assertSelfImagingPatient(actor);
  const report = await ImagingReport.findOne({
    _id: reportId,
    ...buildReleasedImagingReportFilter(patientId),
  });
  if (!report) throw createError('Không tìm thấy imaging report đã phát hành.', 404);

  if (!report.patient_viewed_at) {
    report.patient_viewed_at = new Date();
    await report.save();
    await recordAuditLog({
      actor,
      action: 'imaging_report.patient_viewed',
      targetType: 'imaging_report',
      targetId: report._id,
      status: 'success',
      message: 'Bệnh nhân đánh dấu đã xem báo cáo CĐHA.',
      requestMeta,
    });
  }

  return getImagingReportDetail(reportId, actor);
}

async function getEncounterImagingSummary(encounterId, actor = {}) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  assertEncounterReadAccess(encounter, actor);
  const rows = await ImagingOrder.aggregate([
    { $match: { encounter_id: encounter._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const reports = await ImagingReport.aggregate([
    {
      $lookup: {
        from: 'imaging_orders',
        localField: 'imaging_order_id',
        foreignField: '_id',
        as: 'imaging_order',
      },
    },
    { $unwind: '$imaging_order' },
    { $match: { 'imaging_order.encounter_id': encounter._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byStatus = {};
  const reportByStatus = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row._id] = row.count;
    total += row.count;
  }
  for (const row of reports) reportByStatus[row._id] = row.count;
  return {
    encounter_id: encounterId,
    total_imaging_orders: total,
    by_status: byStatus,
    report_by_status: reportByStatus,
  };
}

async function getImagingDashboard(query = {}, actor = {}) {
  const day = parseDate(query.date, 'date') || new Date();
  const start = query.date_from ? parseDate(query.date_from, 'date_from') : startOfLocalDay(day);
  const end = query.date_to ? parseDate(query.date_to, 'date_to') : endOfLocalDay(day);
  const baseFilter = await buildImagingOrderListFilter({ ...query, status: undefined, date_from: undefined, date_to: undefined }, actor);
  const todayFilter = { ...baseFilter, ordered_at: { $gte: start, $lte: end } };
  const reportFilter = await buildScopedReportFilter({ date_from: query.date_from || start.toISOString(), date_to: query.date_to || end.toISOString() }, actor);
  const [
    totalOrders,
    statOrders,
    statusRows,
    reportRows,
    criticalUnacknowledged,
    finalReports,
    byModalityRows,
    byRoomRows,
    fileIssues,
    recentCritical,
    waitingReportRows,
  ] = await Promise.all([
    ImagingOrder.countDocuments(todayFilter),
    ImagingOrder.countDocuments({ ...todayFilter, priority: 'stat' }),
    Promise.all(Object.values(IMAGING_ORDER_STATUS).map(async (status) => ({ status, count: await ImagingOrder.countDocuments({ ...todayFilter, status }) }))),
    Promise.all(Object.values(IMAGING_REPORT_STATUS).map(async (status) => ({ status, count: await ImagingReport.countDocuments({ ...reportFilter, status }) }))),
    ImagingReport.countDocuments({ ...reportFilter, is_critical: true, critical_acknowledged_at: { $exists: false } }),
    ImagingReport.countDocuments({ ...reportFilter, status: { $in: FINAL_REPORT_STATUSES } }),
    ImagingOrder.aggregate([
      { $match: todayFilter },
      { $group: { _id: '$modality', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ImagingOrder.aggregate([
      { $match: todayFilter },
      { $group: { _id: '$room_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Attachment.countDocuments({
      entity_type: { $in: [ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER, ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT] },
      status: ATTACHMENT_STATUS.ACTIVE,
      $or: [{ scan_status: 'failed' }, { review_status: DOCUMENT_REVIEW_STATUS.PENDING }],
    }),
    ImagingReport.find({ ...reportFilter, is_critical: true }).sort({ critical_notified_at: -1, verified_at: -1 }).limit(8).populate('patient_id', 'patient_code full_name gender date_of_birth').lean(),
    ImagingOrder.find({ ...baseFilter, status: IMAGING_ORDER_STATUS.COMPLETED }).sort({ completed_at: 1 }).limit(12).populate('patient_id', 'patient_code full_name gender date_of_birth').lean(),
  ]);
  const orderStatus = Object.fromEntries(statusRows.map((row) => [row.status, row.count]));
  const reportStatus = Object.fromEntries(reportRows.map((row) => [row.status, row.count]));
  const waitingReportIds = waitingReportRows.map((order) => order._id);
  const reportedOrderIds = await ImagingReport.distinct('imaging_order_id', {
    imaging_order_id: { $in: waitingReportIds },
    status: { $in: [IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY, ...FINAL_REPORT_STATUSES] },
  });
  const reportedSet = new Set(reportedOrderIds.map((id) => String(id)));
  return {
    today: {
      total_orders: totalOrders,
      stat_orders: statOrders,
      scheduled: orderStatus[IMAGING_ORDER_STATUS.SCHEDULED] || 0,
      in_progress: orderStatus[IMAGING_ORDER_STATUS.IN_PROGRESS] || 0,
      completed_technical: orderStatus[IMAGING_ORDER_STATUS.COMPLETED] || 0,
      waiting_report: waitingReportRows.filter((order) => !reportedSet.has(String(order._id))).length,
      draft_reports: reportStatus[IMAGING_REPORT_STATUS.DRAFT] || 0,
      preliminary_reports: reportStatus[IMAGING_REPORT_STATUS.PRELIMINARY] || 0,
      final_reports: finalReports,
      critical_unacknowledged: criticalUnacknowledged,
      no_show: orderStatus[IMAGING_ORDER_STATUS.NO_SHOW] || 0,
      cancelled: orderStatus[IMAGING_ORDER_STATUS.CANCELLED] || 0,
      file_issues: fileIssues,
    },
    by_modality: byModalityRows.map((row) => ({ modality: row._id || 'unknown', count: row.count })),
    by_room: byRoomRows.map((row) => ({ room_id: row._id, count: row.count })),
    recent_critical: recentCritical,
    waiting_report: waitingReportRows.filter((order) => !reportedSet.has(String(order._id))),
  };
}

async function getImagingWorklistCounts(query = {}, actor = {}) {
  const dashboard = await getImagingDashboard(query, actor);
  return {
    counters: dashboard.today,
    by_modality: dashboard.by_modality,
    by_room: dashboard.by_room,
  };
}

async function getImagingSlaBoard(query = {}, actor = {}) {
  return listImagingOrders({ ...query, overdue_sla: query.overdue_sla ?? 'true', limit: query.limit || 50 }, actor);
}

async function getImagingScheduleBoard(query = {}, actor = {}) {
  const day = parseDate(query.date, 'date') || new Date();
  const params = {
    ...query,
    status: query.status || IMAGING_ORDER_STATUS.SCHEDULED,
    scheduled_from: query.scheduled_from || startOfLocalDay(day).toISOString(),
    scheduled_to: query.scheduled_to || endOfLocalDay(day).toISOString(),
    limit: query.limit || 200,
    sort: 'scheduled_at',
  };
  const worklist = await listImagingOrders(params, actor);
  const byRoom = {};
  for (const item of worklist.items || []) {
    const roomKey = String(item.room_id?._id || item.room_id || 'unassigned');
    if (!byRoom[roomKey]) byRoom[roomKey] = [];
    byRoom[roomKey].push(item);
  }
  return {
    date: startOfLocalDay(day),
    rooms: Object.entries(byRoom).map(([room_id, items]) => ({ room_id, items })),
    items: worklist.items,
    pagination: worklist.pagination,
  };
}

async function getImagingSlotSuggestions(query = {}, actor = {}) {
  const imagingOrder = query.imaging_order_id ? await ImagingOrder.findById(query.imaging_order_id).lean() : null;
  if (imagingOrder) {
    const context = await loadImagingOrderContext(imagingOrder);
    assertImagingOrderAccess(imagingOrder, context, actor, readAccessPermissions());
  }
  const day = parseDate(query.date, 'date') || new Date();
  const modality = query.modality || imagingOrder?.modality;
  const rooms = await ImagingRoom.find({
    active: true,
    maintenance_status: 'available',
    ...(modality ? { modality } : {}),
    ...(query.room_id ? { _id: query.room_id } : {}),
  }).lean();
  const suggestions = [];
  const base = startOfLocalDay(day);
  for (const room of rooms) {
    for (const hour of [8, 9, 10, 13, 14, 15, 16]) {
      const slot = new Date(base);
      slot.setHours(hour, 0, 0, 0);
      try {
        await assertRoomScheduleAvailable({
          imagingOrderId: imagingOrder?._id,
          roomId: room._id,
          scheduledAt: slot,
          durationMinutes: query.duration_minutes || imagingOrder?.duration_minutes || room.default_duration_minutes || 30,
        });
        suggestions.push({ room, scheduled_at: slot, duration_minutes: query.duration_minutes || imagingOrder?.duration_minutes || room.default_duration_minutes || 30 });
      } catch (_) {
        // Busy slot, skip.
      }
    }
  }
  return { items: suggestions.slice(0, Number(query.limit || 20)) };
}

async function listImagingRooms(query = {}) {
  const filter = {};
  addQueryFilter(filter, 'modality', query.modality);
  if (query.active !== undefined) filter.active = parseBoolean(query.active) === true;
  if (query.maintenance_status) filter.maintenance_status = query.maintenance_status;
  const items = await ImagingRoom.find(filter).sort({ modality: 1, code: 1 }).populate('equipment_id', 'code name status').lean();
  return { items };
}

async function createImagingRoom(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.SYSTEM.FULL_ACCESS]);
  const room = await ImagingRoom.create({
    code: normalizeString(payload.code).toUpperCase(),
    name: normalizeString(payload.name),
    modality: payload.modality,
    location_id: payload.location_id,
    equipment_id: payload.equipment_id,
    default_duration_minutes: parseOptionalNumber(payload.default_duration_minutes, 'default_duration_minutes') || 30,
    active: payload.active !== undefined ? parseBoolean(payload.active) : true,
    maintenance_status: payload.maintenance_status || 'available',
    metadata: payload.metadata,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'imaging_room.created', targetType: 'imaging_room', targetId: room._id, status: 'success', message: 'Tạo phòng CĐHA.', requestMeta });
  return room.toObject();
}

async function updateImagingRoom(roomId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.SYSTEM.FULL_ACCESS]);
  const room = await ImagingRoom.findById(roomId);
  if (!room) throw createError('Không tìm thấy imaging room.', 404);
  for (const field of ['name', 'modality', 'location_id', 'equipment_id', 'maintenance_status', 'metadata']) {
    if (payload[field] !== undefined) room[field] = payload[field];
  }
  if (payload.default_duration_minutes !== undefined) room.default_duration_minutes = parseOptionalNumber(payload.default_duration_minutes, 'default_duration_minutes');
  if (payload.active !== undefined) room.active = parseBoolean(payload.active);
  room.updated_by = actorUserId(actor);
  await room.save();
  await recordAuditLog({ actor, action: 'imaging_room.updated', targetType: 'imaging_room', targetId: room._id, status: 'success', message: 'Cập nhật phòng CĐHA.', requestMeta });
  return room.toObject();
}

async function listImagingEquipment(query = {}) {
  const filter = {};
  addQueryFilter(filter, 'modality', query.modality);
  addQueryFilter(filter, 'status', query.status);
  const items = await ImagingEquipment.find(filter).sort({ modality: 1, code: 1 }).lean();
  return { items };
}

async function createImagingEquipment(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.SYSTEM.FULL_ACCESS]);
  const equipment = await ImagingEquipment.create({
    code: normalizeString(payload.code).toUpperCase(),
    name: normalizeString(payload.name),
    modality: payload.modality,
    manufacturer: payload.manufacturer,
    model: payload.model,
    serial_no: payload.serial_no,
    status: payload.status || 'available',
    last_maintenance_at: parseDate(payload.last_maintenance_at, 'last_maintenance_at'),
    next_maintenance_at: parseDate(payload.next_maintenance_at, 'next_maintenance_at'),
    metadata: payload.metadata,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'imaging_equipment.created', targetType: 'imaging_equipment', targetId: equipment._id, status: 'success', message: 'Tạo thiết bị CĐHA.', requestMeta });
  return equipment.toObject();
}

async function updateImagingEquipment(equipmentId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.SYSTEM.FULL_ACCESS]);
  const equipment = await ImagingEquipment.findById(equipmentId);
  if (!equipment) throw createError('Không tìm thấy imaging equipment.', 404);
  for (const field of ['name', 'modality', 'manufacturer', 'model', 'serial_no', 'status', 'metadata']) {
    if (payload[field] !== undefined) equipment[field] = payload[field];
  }
  if (payload.last_maintenance_at !== undefined) equipment.last_maintenance_at = parseDate(payload.last_maintenance_at, 'last_maintenance_at');
  if (payload.next_maintenance_at !== undefined) equipment.next_maintenance_at = parseDate(payload.next_maintenance_at, 'next_maintenance_at');
  equipment.updated_by = actorUserId(actor);
  await equipment.save();
  await recordAuditLog({ actor, action: 'imaging_equipment.updated', targetType: 'imaging_equipment', targetId: equipment._id, status: 'success', message: 'Cập nhật thiết bị CĐHA.', requestMeta });
  return equipment.toObject();
}

async function listImagingReportTemplates(query = {}) {
  const filter = {};
  addQueryFilter(filter, 'modality', query.modality);
  if (query.body_part) filter.body_part = { $regex: escapeRegex(query.body_part), $options: 'i' };
  if (query.active !== undefined) filter.active = parseBoolean(query.active) === true;
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [{ code: { $regex: keyword, $options: 'i' } }, { name: { $regex: keyword, $options: 'i' } }];
  }
  const items = await ImagingReportTemplate.find(filter).sort({ modality: 1, body_part: 1, name: 1 }).lean();
  return { items };
}

async function createImagingReportTemplate(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE]);
  const template = await ImagingReportTemplate.create({
    code: normalizeString(payload.code).toUpperCase(),
    name: normalizeString(payload.name),
    modality: payload.modality,
    body_part: payload.body_part,
    findings_template: payload.findings_template,
    impression_template: payload.impression_template,
    recommendation_template: payload.recommendation_template,
    active: payload.active !== undefined ? parseBoolean(payload.active) : true,
    metadata: payload.metadata,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'imaging_report_template.created', targetType: 'imaging_report_template', targetId: template._id, status: 'success', message: 'Tạo template report CĐHA.', requestMeta });
  return template.toObject();
}

async function updateImagingReportTemplate(templateId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE]);
  const template = await ImagingReportTemplate.findById(templateId);
  if (!template) throw createError('Không tìm thấy imaging report template.', 404);
  for (const field of ['name', 'modality', 'body_part', 'findings_template', 'impression_template', 'recommendation_template', 'metadata']) {
    if (payload[field] !== undefined) template[field] = payload[field];
  }
  if (payload.active !== undefined) template.active = parseBoolean(payload.active);
  template.updated_by = actorUserId(actor);
  await template.save();
  await recordAuditLog({ actor, action: 'imaging_report_template.updated', targetType: 'imaging_report_template', targetId: template._id, status: 'success', message: 'Cập nhật template report CĐHA.', requestMeta });
  return template.toObject();
}

async function requestImagingReportCorrection(reportId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE, PERMISSION.IMAGING_REPORTS.AMEND]);
  const reason = payload.reason || payload.reason_text;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc.', 400);
  const report = await getImagingReportOrThrow(reportId);
  const { imagingOrder, ...context } = await loadReportContext(report);
  assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE, PERMISSION.IMAGING_REPORTS.AMEND]));
  const correction = await ImagingReportCorrectionRequest.create({
    report_id: report._id,
    imaging_order_id: imagingOrder._id,
    patient_id: report.patient_id,
    requested_by: actorUserId(actor),
    assigned_to: payload.assigned_to,
    reason,
    correction_type: payload.correction_type || 'text',
    severity: payload.severity || 'medium',
    due_at: parseDate(payload.due_at, 'due_at'),
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'imaging_report.correction_requested', targetType: 'imaging_report_correction_request', targetId: correction._id, status: 'success', message: 'Tạo yêu cầu sửa report CĐHA.', requestMeta, metadata: { report_id: String(reportId), reason } });
  return correction.toObject();
}

async function listImagingReportCorrections(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.READ, PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE]);
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  for (const field of ['status', 'severity', 'correction_type', 'assigned_to', 'patient_id', 'imaging_order_id', 'report_id']) addQueryFilter(filter, field, query[field]);
  const [items, total] = await Promise.all([
    ImagingReportCorrectionRequest.find(filter)
      .sort({ requested_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('report_id', 'report_no status is_critical')
      .populate('imaging_order_id', 'imaging_order_no modality body_part status')
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('requested_by', 'full_name username employee_code')
      .populate('assigned_to', 'full_name username employee_code')
      .lean(),
    ImagingReportCorrectionRequest.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function updateImagingReportCorrectionStatus(correctionId, payload = {}, actor = {}, requestMeta = {}, nextStatus) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.FINALIZE, PERMISSION.IMAGING_REPORTS.AMEND]);
  const correction = await ImagingReportCorrectionRequest.findById(correctionId);
  if (!correction) throw createError('Không tìm thấy correction request.', 404);
  if (payload.assigned_to !== undefined) correction.assigned_to = payload.assigned_to;
  if (nextStatus === 'in_progress') correction.status = 'in_progress';
  if (nextStatus === 'resolved') {
    correction.status = 'resolved';
    correction.resolved_by = actorUserId(actor);
    correction.resolved_at = new Date();
    correction.resolution_note = payload.resolution_note || payload.note;
  }
  if (nextStatus === 'cancelled') {
    correction.status = 'cancelled';
    correction.cancelled_by = actorUserId(actor);
    correction.cancelled_at = new Date();
    correction.cancel_reason = payload.reason || payload.cancel_reason;
  }
  correction.updated_by = actorUserId(actor);
  await correction.save();
  await recordAuditLog({ actor, action: `imaging_report.correction_${nextStatus}`, targetType: 'imaging_report_correction_request', targetId: correction._id, status: 'success', message: 'Cập nhật correction request CĐHA.', requestMeta });
  return correction.toObject();
}

function renderImagingReportHtml(detail = {}) {
  const report = detail.report || {};
  const order = report.imaging_order_id || {};
  const patient = report.patient_id || {};
  const criticalText = report.critical_note || report.critical_finding || '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;margin:32px;color:#111827}
    header{border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:18px}
    h1{margin:0 0 8px;font-size:22px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:16px 0}
    section{margin-top:18px}h2{font-size:14px;margin:0 0 6px}p{white-space:pre-wrap;line-height:1.5}
  </style></head><body>
    <header><h1>Báo cáo chẩn đoán hình ảnh ${escapeHtml(report.report_no)}</h1><p>${escapeHtml(order.modality)} ${escapeHtml(order.body_part)}</p></header>
    <div class="grid"><span>Bệnh nhân: <strong>${escapeHtml(patient.patient_code)} ${escapeHtml(patient.full_name)}</strong></span><span>Trạng thái: <strong>${escapeHtml(report.status)}</strong></span></div>
    <section><h2>Mô tả</h2><p>${escapeHtml(report.findings)}</p></section>
    <section><h2>Kết luận</h2><p>${escapeHtml(report.impression)}</p></section>
    <section><h2>Khuyến nghị</h2><p>${escapeHtml(report.recommendation)}</p></section>
    ${report.is_critical ? `<section><h2>Critical</h2><p>${escapeHtml(criticalText)}</p></section>` : ''}
  </body></html>`;
}

async function getImagingReportPdf(reportId, actor = {}) {
  const detail = await getImagingReportDetail(reportId, actor);
  return {
    file_name: `${detail.report.report_no || 'imaging-report'}.html`,
    content_type: 'text/html',
    html: renderImagingReportHtml(detail),
    report: detail.report,
  };
}

async function renderImagingReportPdf(reportId, payload = {}, actor = {}, requestMeta = {}) {
  const pdf = await getImagingReportPdf(reportId, actor);
  await recordAuditLog({ actor, action: 'imaging_report.pdf_rendered', targetType: 'imaging_report', targetId: reportId, status: 'success', message: 'Render PDF report CĐHA.', requestMeta, metadata: { template: payload.template } });
  return pdf;
}

async function notifyCriticalImagingReport(reportId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE, PERMISSION.IMAGING_REPORTS.FINALIZE, PERMISSION.IMAGING_REPORTS.WRITE]);
  const report = await getImagingReportOrThrow(reportId);
  report.is_critical = true;
  report.critical_notified_at = new Date();
  if (payload.critical_note !== undefined) report.critical_note = payload.critical_note;
  report.updated_by = actorUserId(actor);
  await report.save();
  await notificationService.notifyImagingReportFinal(report._id, actor, { critical: true });
  await recordAuditLog({ actor, action: 'imaging_report.critical_notified', targetType: 'imaging_report', targetId: reportId, status: 'success', message: 'Notify critical imaging report.', requestMeta, metadata: { recipient_id: payload.recipient_id } });
  return getImagingReportDetail(reportId, actor);
}

async function escalateCriticalImagingReport(reportId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE, PERMISSION.IMAGING_REPORTS.FINALIZE, PERMISSION.IMAGING_REPORTS.WRITE]);
  await recordAuditLog({ actor, action: 'imaging_report.critical_escalated', targetType: 'imaging_report', targetId: reportId, status: 'success', message: 'Escalate critical imaging finding.', requestMeta, metadata: { escalation_level: payload.escalation_level || 1, note: payload.note } });
  return getImagingReportDetail(reportId, actor);
}

async function getCriticalImagingBoard(query = {}, actor = {}) {
  return listImagingReports({ ...query, is_critical: 'true', limit: query.limit || 50 }, actor);
}

async function getImagingTimeline(imagingOrderId, actor = {}) {
  const detail = await getImagingOrderDetail(imagingOrderId, actor);
  const reportIds = (detail.reports || []).map((report) => report._id);
  const attachmentIds = (detail.attachments || []).map((attachment) => attachment._id);
  const logs = await AuditLog.find({
    $or: [
      { target_type: 'imaging_order', target_id: imagingOrderId },
      { target_type: 'imaging_report', target_id: { $in: reportIds } },
      { target_type: 'attachment', target_id: { $in: attachmentIds } },
      { target_type: 'order', target_id: detail.imaging_order.order_id?._id || detail.imaging_order.order_id },
    ],
  }).sort({ created_at: 1 }).lean();
  return {
    imaging_order_id: imagingOrderId,
    events: logs.map((log) => ({
      event_type: log.action,
      event_time: log.created_at,
      module: 'imaging',
      title: log.message || log.action,
      actor_type: log.actor_type,
      actor_id: log.actor_id,
      entity_type: log.target_type,
      entity_id: log.target_id,
      metadata: log.metadata,
    })),
  };
}

module.exports = {
  // generateImagingReportNumber: Sinh/tạo mã báo cáo chẩn đoán hình ảnh.
  generateImagingReportNumber,
  // listImagingOrders: Liệt kê chỉ định chẩn đoán hình ảnh.
  listImagingOrders,
  // getImagingDashboard: Tổng hợp dashboard/workload CĐHA.
  getImagingDashboard,
  // getImagingWorklistCounts: Trả counters cho worklist CĐHA.
  getImagingWorklistCounts,
  // getImagingSlaBoard: Liệt kê worklist quá hạn SLA CĐHA.
  getImagingSlaBoard,
  // getImagingScheduleBoard: Lịch theo phòng/ngày.
  getImagingScheduleBoard,
  // getImagingSlotSuggestions: Gợi ý slot phòng CĐHA.
  getImagingSlotSuggestions,
  // getImagingOrderDetail: Lấy chi tiết chỉ định chẩn đoán hình ảnh.
  getImagingOrderDetail,
  // scheduleImagingOrder: Lên lịch cho chẩn đoán hình ảnh y lệnh.
  scheduleImagingOrder,
  // rescheduleImagingOrder: Đổi lịch chẩn đoán hình ảnh.
  rescheduleImagingOrder,
  // assignImagingTechnician: Assign technician.
  assignImagingTechnician,
  // assignImagingRadiologist: Assign radiologist.
  assignImagingRadiologist,
  // updateImagingArrivalStatus: Cập nhật arrived/ready/not-ready.
  updateImagingArrivalStatus,
  // startImagingOrder: Bắt đầu chẩn đoán hình ảnh y lệnh.
  startImagingOrder,
  // completeImagingOrder: Hoàn tất chẩn đoán hình ảnh y lệnh.
  completeImagingOrder,
  // cancelImagingOrder: Hủy chẩn đoán hình ảnh y lệnh.
  cancelImagingOrder,
  // markImagingOrderNoShow: Đánh dấu ca chẩn đoán hình ảnh là bệnh nhân vắng mặt.
  markImagingOrderNoShow,
  // checkContrastAllergyRisk: Kiểm tra rủi ro dị ứng thuốc cản quang.
  checkContrastAllergyRisk,
  // uploadImagingAttachment: Tải lên tệp đính kèm chẩn đoán hình ảnh.
  uploadImagingAttachment,
  // listImagingAttachments: Liệt kê tệp đính kèm chẩn đoán hình ảnh.
  listImagingAttachments,
  // listImagingFiles: Liệt kê file CĐHA toàn workspace.
  listImagingFiles,
  // createImagingUploadUrl: Tạo upload URL metadata cho file CĐHA.
  createImagingUploadUrl,
  // completeImagingFileUpload: Hoàn tất metadata upload file CĐHA.
  completeImagingFileUpload,
  // reviewImagingFile: Review file CĐHA.
  reviewImagingFile,
  // releaseImagingFileToPatient: Release file CĐHA cho patient.
  releaseImagingFileToPatient,
  // archiveImagingFile: Archive file CĐHA.
  archiveImagingFile,
  // restoreImagingFile: Restore file CĐHA.
  restoreImagingFile,
  // deleteImagingAttachment: Xóa tệp đính kèm chẩn đoán hình ảnh.
  deleteImagingAttachment,
  // createImagingReport: Tạo báo cáo chẩn đoán hình ảnh.
  createImagingReport,
  // getImagingReportDetail: Lấy chi tiết báo cáo chẩn đoán hình ảnh.
  getImagingReportDetail,
  // listImagingReports: Liệt kê báo cáo chẩn đoán hình ảnh.
  listImagingReports,
  // getImagingReportPdf: Lấy HTML/PDF payload report.
  getImagingReportPdf,
  // renderImagingReportPdf: Ghi nhận render PDF report.
  renderImagingReportPdf,
  // updateImagingReport: Cập nhật báo cáo chẩn đoán hình ảnh.
  updateImagingReport,
  // validateImagingReportBeforeFinalize: Kiểm tra tính hợp lệ của báo cáo chẩn đoán hình ảnh trước khi hoàn tất.
  validateImagingReportBeforeFinalize,
  // finalizeImagingReport: Hoàn tất báo cáo chẩn đoán hình ảnh.
  finalizeImagingReport,
  // amendImagingReport: Sửa đổi/bổ sung báo cáo chẩn đoán hình ảnh.
  amendImagingReport,
  // cancelImagingReport: Hủy báo cáo chẩn đoán hình ảnh.
  cancelImagingReport,
  // notifyDoctorImagingFinal: Gửi thông báo kết quả chẩn đoán hình ảnh cuối cùng cho bác sĩ.
  notifyDoctorImagingFinal,
  // releaseImagingReportToPatient: Phát hành báo cáo chẩn đoán hình ảnh cho bệnh nhân.
  releaseImagingReportToPatient,
  // acknowledgeCriticalImagingReport: Ghi nhận đã tiếp nhận báo cáo chẩn đoán hình ảnh nghiêm trọng.
  acknowledgeCriticalImagingReport,
  // notifyCriticalImagingReport: Gửi lại thông báo critical.
  notifyCriticalImagingReport,
  // escalateCriticalImagingReport: Escalate critical finding.
  escalateCriticalImagingReport,
  // getCriticalImagingBoard: Board critical findings.
  getCriticalImagingBoard,
  // requestImagingReportCorrection: Tạo yêu cầu sửa report CĐHA.
  requestImagingReportCorrection,
  // listImagingReportCorrections: Liệt kê yêu cầu sửa report CĐHA.
  listImagingReportCorrections,
  // updateImagingReportCorrectionStatus: Assign/resolve/cancel correction request.
  updateImagingReportCorrectionStatus,
  // listImagingRooms: Danh sách phòng CĐHA.
  listImagingRooms,
  // createImagingRoom: Tạo phòng CĐHA.
  createImagingRoom,
  // updateImagingRoom: Cập nhật phòng CĐHA.
  updateImagingRoom,
  // listImagingEquipment: Danh sách thiết bị CĐHA.
  listImagingEquipment,
  // createImagingEquipment: Tạo thiết bị CĐHA.
  createImagingEquipment,
  // updateImagingEquipment: Cập nhật thiết bị CĐHA.
  updateImagingEquipment,
  // listImagingReportTemplates: Danh sách template report CĐHA.
  listImagingReportTemplates,
  // createImagingReportTemplate: Tạo template report CĐHA.
  createImagingReportTemplate,
  // updateImagingReportTemplate: Cập nhật template report CĐHA.
  updateImagingReportTemplate,
  // getMyImagingReports: Lấy báo cáo chẩn đoán hình ảnh của người dùng hiện tại.
  getMyImagingReports,
  // getMyImagingReportsSummary: Tổng hợp CĐHA đã phát hành cho patient.
  getMyImagingReportsSummary,
  // getMyImagingReportFiles: Lấy file CĐHA đã phát hành.
  getMyImagingReportFiles,
  // markMyImagingReportViewed: Đánh dấu bệnh nhân đã xem report.
  markMyImagingReportViewed,
  // getEncounterImagingSummary: Lấy tổng hợp chẩn đoán hình ảnh của lượt khám.
  getEncounterImagingSummary,
  // getImagingTimeline: Lấy dòng thời gian chẩn đoán hình ảnh.
  getImagingTimeline,
};
