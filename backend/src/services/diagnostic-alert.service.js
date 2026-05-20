const mongoose = require('mongoose');
const {
  Attachment,
  AuditLog,
  DiagnosticAlert,
  ImagingOrder,
  ImagingReport,
  ImagingReportCorrectionRequest,
  LabOrder,
  LabResult,
  LabResultCorrectionRequest,
  LabResultItem,
  MissingDocumentTask,
  Order,
  ProcedureOrder,
  Specimen,
} = require('../models');
const {
  ATTACHMENT_STATUS,
  DOCUMENT_REVIEW_STATUS,
  IMAGING_ORDER_STATUS,
  IMAGING_REPORT_STATUS,
  LAB_RESULT_STATUS,
  ORDER_PRIORITY,
  ORDER_STATUS,
  ORDER_TYPE,
  PROCEDURE_STATUS,
  REALTIME_EVENT_TYPE,
  SPECIMEN_STATUS,
} = require('../constants/statuses');
const { PERMISSION } = require('../constants/permissions');
const { hasAnyPermission, hasPermission } = require('../common/permissions');
const { normalizePagination, buildPaginationMeta } = require('../common/helpers/pagination.helper');
const ApiError = require('../common/errors/api-error');
const auditService = require('./audit.service');
const imagingService = require('./imaging.service');
const laboratoryService = require('./laboratory.service');
const { generateSequenceCode } = require('./code-generator.service');
const eventBus = require('../events/event-bus.service');

const {
  DIAGNOSTIC_ALERT_CATEGORY: CATEGORY,
  DIAGNOSTIC_ALERT_STATUS: ALERT_STATUS,
  DIAGNOSTIC_ALERT_SEVERITY: SEVERITY,
  DIAGNOSTIC_ALERT_SOURCE_TYPE: SOURCE_TYPE,
} = DiagnosticAlert;

const OPEN_ALERT_STATUSES = [
  ALERT_STATUS.OPEN,
  ALERT_STATUS.ACKNOWLEDGED,
  ALERT_STATUS.ASSIGNED,
  ALERT_STATUS.IN_PROGRESS,
  ALERT_STATUS.ESCALATED,
];

const CLOSED_ALERT_STATUSES = [ALERT_STATUS.RESOLVED, ALERT_STATUS.DISMISSED];

const READ_PERMISSIONS = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.DIAGNOSTIC_ALERTS.READ,
  PERMISSION.DIAGNOSTIC_ALERTS.READ_OWN,
  PERMISSION.DIAGNOSTIC_ALERTS.READ_DEPARTMENT,
  PERMISSION.DIAGNOSTIC_ALERTS.READ_ASSIGNED,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.LAB_ORDERS.READ_OWN,
  PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
  PERMISSION.SPECIMENS.READ,
  PERMISSION.LAB_RESULTS.READ,
  PERMISSION.LAB_RESULTS.READ_FINAL,
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.IMAGING_ORDERS.READ_OWN,
  PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT,
  PERMISSION.IMAGING_REPORTS.READ,
  PERMISSION.IMAGING_REPORTS.READ_FINAL,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ_OWN,
  PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
  PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ,
  PERMISSION.ATTACHMENTS.READ,
  PERMISSION.ATTACHMENTS.READ_BY_ENTITY,
  PERMISSION.ATTACHMENTS.READ_LAB,
  PERMISSION.ATTACHMENTS.READ_IMAGING,
  PERMISSION.ATTACHMENTS.READ_PROCEDURE,
].filter(Boolean);

const WRITE_PERMISSIONS = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.DIAGNOSTIC_ALERTS.ACKNOWLEDGE,
  PERMISSION.DIAGNOSTIC_ALERTS.ASSIGN,
  PERMISSION.DIAGNOSTIC_ALERTS.ESCALATE,
  PERMISSION.DIAGNOSTIC_ALERTS.RESOLVE,
  PERMISSION.DIAGNOSTIC_ALERTS.DISMISS,
  PERMISSION.DIAGNOSTIC_ALERTS.BULK_ACTION,
  PERMISSION.DIAGNOSTIC_ALERTS.MANAGE,
  PERMISSION.LAB_RESULTS.CRITICAL_ACKNOWLEDGE,
  PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE,
  PERMISSION.ORDERS.ACKNOWLEDGE,
  PERMISSION.ORDERS.UPDATE,
  PERMISSION.SPECIMENS.REJECT,
  PERMISSION.ATTACHMENTS.MANAGE,
].filter(Boolean);

const CRITICAL_ACK_SLA_MINUTES = {
  [ORDER_PRIORITY.STAT]: 5,
  [ORDER_PRIORITY.URGENT]: 10,
  [ORDER_PRIORITY.ROUTINE]: 30,
};

const ORDER_SLA_MINUTES = {
  [ORDER_PRIORITY.STAT]: 60,
  [ORDER_PRIORITY.URGENT]: 240,
  [ORDER_PRIORITY.ROUTINE]: 1440,
};

const RECOLLECTION_SLA_MINUTES = {
  [ORDER_PRIORITY.STAT]: 30,
  [ORDER_PRIORITY.URGENT]: 120,
  [ORDER_PRIORITY.ROUTINE]: 480,
};

const TERMINAL_PARENT_ORDER_STATUSES = [
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.ENTERED_IN_ERROR,
];

const ACTIVE_ATTACHMENT_STATUSES = [ATTACHMENT_STATUS.ACTIVE];

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function actorId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || actor.user?._id || actor.user?.id || null;
}

function assertStaffRead(actor = {}) {
  if (actorType(actor) !== 'staff') {
    throw ApiError.forbidden('Chỉ tài khoản nhân sự được truy cập Diagnostic Alert Center.');
  }
  if (!hasAnyPermission(actor, READ_PERMISSIONS)) {
    throw ApiError.forbidden('Bạn không có quyền xem cảnh báo cận lâm sàng.');
  }
}

function assertStaffWrite(actor = {}) {
  if (actorType(actor) !== 'staff') {
    throw ApiError.forbidden('Chỉ tài khoản nhân sự được xử lý Diagnostic Alert Center.');
  }
  if (!hasAnyPermission(actor, WRITE_PERMISSIONS)) {
    throw ApiError.forbidden('Bạn không có quyền xử lý cảnh báo cận lâm sàng.');
  }
}

function toId(value) {
  if (!value) return null;
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return String(value);
}

function optionalObjectId(value, fieldName = 'id') {
  const id = toId(value);
  if (!id) return undefined;
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest(`${fieldName} không hợp lệ.`);
  return new mongoose.Types.ObjectId(id);
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateRange(query = {}) {
  const start = parseDate(query.date_from || query.from);
  const end = parseDate(query.date_to || query.to);
  if (query.date) {
    const day = parseDate(query.date);
    if (!day) return null;
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return { start: dayStart, end: dayEnd };
  }
  if (!start && !end) return null;
  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(23, 59, 59, 999);
  return { start, end };
}

function withinRange(value, range) {
  if (!range) return true;
  const date = parseDate(value);
  if (!date) return false;
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
}

function addMinutes(value, minutes) {
  const date = parseDate(value) || new Date();
  return new Date(date.getTime() + Number(minutes || 0) * 60000);
}

function minutesBetween(left, right = new Date()) {
  const start = parseDate(left);
  const end = parseDate(right);
  if (!start || !end) return null;
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 60000));
}

function normalizePriority(priority) {
  const value = String(priority || '').toLowerCase();
  return [ORDER_PRIORITY.STAT, ORDER_PRIORITY.URGENT, ORDER_PRIORITY.ROUTINE].includes(value)
    ? value
    : ORDER_PRIORITY.ROUTINE;
}

function priorityRank(priority) {
  return { stat: 0, urgent: 1, routine: 2 }[priority] ?? 3;
}

function severityRank(severity) {
  return { critical: 0, high: 1, warning: 2, info: 3 }[severity] ?? 9;
}

function makeSla(dueAt, now = new Date(), warningMinutes = 15) {
  const due = parseDate(dueAt);
  if (!due) return null;
  const remainingMinutes = Math.ceil((due.getTime() - now.getTime()) / 60000);
  const breachedMinutes = Math.max(0, Math.ceil((now.getTime() - due.getTime()) / 60000));
  const state = breachedMinutes > 0 ? 'breached' : remainingMinutes <= warningMinutes ? 'warning' : 'normal';
  return {
    due_at: due,
    state,
    remaining_minutes: Math.max(0, remainingMinutes),
    breached_minutes: breachedMinutes,
    warning_minutes: warningMinutes,
  };
}

function person(value, fallback = 'Chưa phân công') {
  if (!value) return null;
  if (typeof value === 'string') return { id: value, name: fallback };
  return {
    id: toId(value),
    name: value.full_name || value.name || value.username || value.employee_code || fallback,
    username: value.username,
    employee_code: value.employee_code,
  };
}

function patient(value) {
  if (!value) return null;
  if (typeof value === 'string') return { id: value };
  return {
    id: toId(value),
    patient_code: value.patient_code,
    full_name: value.full_name,
    date_of_birth: value.date_of_birth,
    gender: value.gender,
    phone: value.phone,
  };
}

function encounter(value) {
  if (!value) return null;
  if (typeof value === 'string') return { id: value };
  return {
    id: toId(value),
    encounter_code: value.encounter_code,
    encounter_type: value.encounter_type,
    status: value.status,
    start_time: value.start_time,
    department_id: toId(value.department_id),
    attending_doctor_id: toId(value.attending_doctor_id),
  };
}

function department(value) {
  if (!value) return null;
  if (typeof value === 'string') return { id: value };
  return {
    id: toId(value),
    department_code: value.department_code,
    department_name: value.department_name,
  };
}

function sourceOrder(order) {
  if (!order) return null;
  return {
    id: toId(order),
    order_no: order.order_no,
    order_type: order.order_type,
    priority: order.priority,
    status: order.status,
    ordered_at: order.ordered_at,
    acknowledged_at: order.acknowledged_at,
    sla_due_at: order.sla_due_at,
    sla_status: order.sla_status,
    ordered_by: person(order.ordered_by),
    assigned_to: person(order.assigned_to),
    department: department(order.department_id),
  };
}

function sourceKey(sourceType, sourceId, category) {
  return `${sourceType}:${toId(sourceId)}:${category}`;
}

function criticalSummaryFromItems(items = []) {
  const critical = items.find((item) => item.is_critical || ['critical_low', 'critical_high'].includes(item.abnormal_flag)) || items[0];
  if (!critical) return 'Critical result cần xác nhận.';
  return [
    critical.item_name || critical.item_code || 'Chỉ số',
    critical.result_value,
    critical.unit,
    critical.abnormal_flag,
  ].filter(Boolean).join(' ');
}

function safeString(value) {
  return String(value || '').trim();
}

function buildAllowedActions(keys = []) {
  const allowed = {};
  for (const key of keys) allowed[key] = true;
  return allowed;
}

function baseAlert(snapshot) {
  return {
    status: ALERT_STATUS.OPEN,
    severity: SEVERITY.WARNING,
    priority: ORDER_PRIORITY.ROUTINE,
    first_detected_at: snapshot.detected_at || new Date(),
    last_seen_at: new Date(),
    metadata: {},
    allowed_actions: {},
    ...snapshot,
    source_id: toId(snapshot.source_id),
  };
}

async function publishAlertEvent(eventType, alert, actor = {}, payload = {}) {
  if (!eventType || !alert?._id) return;
  await eventBus.publishDomainEvent({
    eventType,
    aggregateType: 'diagnostic_alert',
    aggregateId: alert._id,
    actor: actorId(actor) ? { user_id: actorId(actor), actor_type: actorType(actor) } : undefined,
    recipientScope: {
      rooms: [
        'diagnostics:alerts',
        alert.department_id ? `department:${alert.department_id}:diagnostics` : null,
        alert.assigned_to_user_id ? `user:${alert.assigned_to_user_id}:alerts` : null,
        alert.patient_id ? `patient:${alert.patient_id}:diagnostics` : null,
      ].filter(Boolean),
    },
    payload: {
      alert_id: toId(alert),
      alert_no: alert.alert_no,
      category: alert.category,
      severity: alert.severity,
      status: alert.status,
      title: alert.title,
      ...payload,
    },
    idempotencyKey: `${eventType}:${toId(alert)}:${alert.status}:${new Date(alert.updated_at || Date.now()).getTime()}`,
  }, { publishImmediately: false }).catch(() => {});
}

async function materializeSnapshot(snapshot, actor = {}) {
  const normalized = baseAlert(snapshot);
  const existing = await DiagnosticAlert.findOne({
    source_type: normalized.source_type,
    source_id: optionalObjectId(normalized.source_id, 'source_id'),
    category: normalized.category,
  });

  const fields = {
    source_type: normalized.source_type,
    source_id: optionalObjectId(normalized.source_id, 'source_id'),
    patient_id: optionalObjectId(normalized.patient_id, 'patient_id'),
    encounter_id: optionalObjectId(normalized.encounter_id, 'encounter_id'),
    order_id: optionalObjectId(normalized.order_id, 'order_id'),
    department_id: optionalObjectId(normalized.department_id, 'department_id'),
    module: normalized.module,
    category: normalized.category,
    title: normalized.title,
    message: normalized.message,
    severity: normalized.severity,
    priority: normalizePriority(normalized.priority),
    first_detected_at: normalized.first_detected_at || new Date(),
    last_seen_at: new Date(),
    notified_at: normalized.notified_at,
    sla_due_at: normalized.sla_due_at,
    breached_at: normalized.breached_at,
    assigned_to_role: normalized.assigned_to_role,
    metadata: normalized.metadata || {},
    updated_by: actorId(actor),
  };

  if (existing) {
    const currentStatus = existing.status || ALERT_STATUS.OPEN;
    Object.assign(existing, fields, {
      status: currentStatus,
      first_detected_at: existing.first_detected_at || fields.first_detected_at,
    });
    await existing.save();
    return normalizeAlertDocument(existing, normalized);
  }

  const created = await DiagnosticAlert.create({
    ...fields,
    alert_no: await generateSequenceCode(DiagnosticAlert, 'alert_no', 'DAL', { sequenceWidth: 4 }),
    status: normalized.status || ALERT_STATUS.OPEN,
    created_by: actorId(actor),
  });
  await publishAlertEvent(REALTIME_EVENT_TYPE.DIAGNOSTIC_ALERT_CREATED || 'diagnostic_alert.created', created, actor);
  return normalizeAlertDocument(created, normalized);
}

function normalizeAlertDocument(alert, snapshot = {}) {
  const plain = alert?.toObject ? alert.toObject() : alert || {};
  const metadata = { ...(snapshot.metadata || {}), ...(plain.metadata || {}) };
  const sla = snapshot.sla || makeSla(plain.sla_due_at);
  return {
    ...snapshot,
    id: toId(plain._id || plain.id || snapshot.id),
    alert_id: toId(plain._id || plain.id || snapshot.alert_id),
    alert_no: plain.alert_no || snapshot.alert_no,
    source_type: plain.source_type || snapshot.source_type,
    source_id: toId(plain.source_id || snapshot.source_id),
    module: plain.module || snapshot.module,
    category: plain.category || snapshot.category,
    title: plain.title || snapshot.title,
    message: plain.message || snapshot.message,
    severity: plain.severity || snapshot.severity || SEVERITY.WARNING,
    priority: normalizePriority(plain.priority || snapshot.priority),
    status: plain.status || snapshot.status || ALERT_STATUS.OPEN,
    patient_id: toId(plain.patient_id || snapshot.patient_id),
    encounter_id: toId(plain.encounter_id || snapshot.encounter_id),
    order_id: toId(plain.order_id || snapshot.order_id),
    department_id: toId(plain.department_id || snapshot.department_id),
    first_detected_at: plain.first_detected_at || snapshot.first_detected_at,
    last_seen_at: plain.last_seen_at || snapshot.last_seen_at,
    notified_at: plain.notified_at || snapshot.notified_at,
    acknowledged_by: person(plain.acknowledged_by || snapshot.acknowledged_by),
    acknowledged_at: plain.acknowledged_at || snapshot.acknowledged_at,
    assigned_to_user_id: toId(plain.assigned_to_user_id || snapshot.assigned_to_user_id),
    assigned_to_role: plain.assigned_to_role || snapshot.assigned_to_role,
    sla_due_at: plain.sla_due_at || snapshot.sla_due_at,
    breached_at: plain.breached_at || snapshot.breached_at,
    escalation_level: Number(plain.escalation_level || snapshot.escalation_level || 0),
    last_escalated_at: plain.last_escalated_at || snapshot.last_escalated_at,
    resolution_note: plain.resolution_note || snapshot.resolution_note,
    metadata,
    sla,
    sla_status: sla?.state || snapshot.sla_status,
    allowed_actions: snapshot.allowed_actions || metadata.allowed_actions || {},
    action_keys: Object.keys(snapshot.allowed_actions || metadata.allowed_actions || {}),
    persisted: Boolean(plain._id || plain.id),
  };
}

function applySnapshotFilters(items = [], query = {}) {
  const range = dateRange(query);
  const category = safeString(query.category || query.alert_category || '');
  const module = safeString(query.module || query.source || '').toLowerCase();
  const search = safeString(query.search || query.q).toLowerCase();
  const openOnly = String(query.open || 'true').toLowerCase() !== 'false';

  return items.filter((item) => {
    if (category && item.category !== category) return false;
    if (module && module !== 'all' && item.module !== module && item.source_type !== module) return false;
    if (query.severity && item.severity !== query.severity) return false;
    if (query.priority && item.priority !== query.priority) return false;
    if (query.status && item.status !== query.status) return false;
    if (!query.status && openOnly && CLOSED_ALERT_STATUSES.includes(item.status)) return false;
    if (query.sla_status && item.sla?.state !== query.sla_status && item.sla_status !== query.sla_status) return false;
    if (query.patient_id && item.patient_id !== String(query.patient_id)) return false;
    if (query.encounter_id && item.encounter_id !== String(query.encounter_id)) return false;
    if (query.department_id && item.department_id !== String(query.department_id)) return false;
    if (range && !withinRange(item.first_detected_at || item.notified_at || item.created_at, range)) return false;
    if (!search) return true;
    return [
      item.alert_no,
      item.title,
      item.message,
      item.critical_summary,
      item.source?.code,
      item.source?.label,
      item.patient?.patient_code,
      item.patient?.full_name,
      item.order?.order_no,
      item.encounter?.encounter_code,
    ].filter(Boolean).join(' ').toLowerCase().includes(search);
  });
}

async function buildCriticalLabSnapshots(query = {}) {
  const resultFilter = {
    is_current: { $ne: false },
    is_critical: true,
    critical_acknowledged_at: null,
    status: { $nin: [LAB_RESULT_STATUS.CANCELLED, LAB_RESULT_STATUS.ENTERED_IN_ERROR] },
  };
  if (query.patient_id) resultFilter.patient_id = query.patient_id;
  const results = await LabResult.find(resultFilter)
    .sort({ critical_notified_at: -1, reported_at: -1, created_at: -1 })
    .limit(300)
    .populate({
      path: 'lab_order_id',
      select: 'lab_order_no test_code test_name priority status order_id encounter_id ordered_by ordered_at',
      populate: [
        { path: 'order_id', select: 'order_no order_type priority status department_id ordered_at ordered_by assigned_to sla_due_at sla_status', populate: [
          { path: 'department_id', select: 'department_code department_name' },
          { path: 'ordered_by', select: 'full_name username employee_code' },
          { path: 'assigned_to', select: 'full_name username employee_code' },
        ] },
        { path: 'encounter_id', select: 'encounter_code encounter_type status start_time department_id attending_doctor_id' },
        { path: 'ordered_by', select: 'full_name username employee_code' },
      ],
    })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('performed_by verified_by', 'full_name username employee_code')
    .lean();

  const resultIds = results.map((row) => row._id);
  const items = resultIds.length
    ? await LabResultItem.find({
      lab_result_id: { $in: resultIds },
      $or: [
        { is_critical: true },
        { abnormal_flag: { $in: ['critical_low', 'critical_high'] } },
      ],
    }).sort({ display_order: 1 }).lean()
    : [];
  const itemsByResult = items.reduce((map, item) => {
    const key = String(item.lab_result_id);
    const list = map.get(key) || [];
    list.push(item);
    map.set(key, list);
    return map;
  }, new Map());

  const snapshots = [];
  for (const result of results) {
    const labOrder = result.lab_order_id || {};
    const parentOrder = labOrder.order_id || {};
    const priority = normalizePriority(labOrder.priority || parentOrder.priority);
    const notifiedAt = result.critical_notified_at || result.reported_at || result.created_at;
    const dueAt = addMinutes(notifiedAt, CRITICAL_ACK_SLA_MINUTES[priority]);
    const sla = makeSla(dueAt, new Date(), 3);
    const criticalItems = itemsByResult.get(String(result._id)) || [];
    const summary = criticalSummaryFromItems(criticalItems);
    const base = {
      source_type: SOURCE_TYPE.LAB_RESULT,
      source_id: result._id,
      module: 'lab',
      patient_id: result.patient_id?._id || result.patient_id,
      encounter_id: labOrder.encounter_id?._id || labOrder.encounter_id,
      order_id: parentOrder._id || labOrder.order_id,
      department_id: parentOrder.department_id?._id || parentOrder.department_id,
      priority,
      severity: SEVERITY.CRITICAL,
      title: `${result.result_no || 'Lab result'} critical chưa ACK`,
      message: summary,
      first_detected_at: notifiedAt,
      notified_at: notifiedAt,
      sla_due_at: dueAt,
      breached_at: sla?.state === 'breached' ? dueAt : undefined,
      sla,
      sla_status: sla?.state,
      patient: patient(result.patient_id),
      encounter: encounter(labOrder.encounter_id),
      order: sourceOrder(parentOrder),
      source: {
        type: SOURCE_TYPE.LAB_RESULT,
        code: result.result_no,
        label: labOrder.test_name || 'Xét nghiệm',
        status: result.status,
        module_label: 'Lab',
      },
      result: {
        id: toId(result),
        result_no: result.result_no,
        status: result.status,
        reported_at: result.reported_at,
        released_to_patient: result.released_to_patient,
        amended_at: result.amended_at,
      },
      critical_summary: summary,
      critical_items: criticalItems,
      allowed_actions: buildAllowedActions(['acknowledge', 'notify', 'escalate', 'request_amend', 'timeline']),
      metadata: {
        allowed_actions: buildAllowedActions(['acknowledge', 'notify', 'escalate', 'request_amend', 'timeline']),
        critical_items: criticalItems,
      },
    };
    snapshots.push(baseAlert({ ...base, category: CATEGORY.CRITICAL_RESULT_OPEN }));
    if (sla?.state === 'breached') {
      snapshots.push(baseAlert({
        ...base,
        category: CATEGORY.CRITICAL_ACK_OVERDUE,
        title: `${result.result_no || 'Lab result'} quá hạn ACK`,
        message: `${summary} - quá hạn ${sla.breached_minutes} phút.`,
      }));
    }
  }
  return snapshots;
}

async function buildCriticalImagingSnapshots(query = {}) {
  const reportFilter = {
    is_current: { $ne: false },
    is_critical: true,
    critical_acknowledged_at: null,
    status: { $nin: [IMAGING_REPORT_STATUS.CANCELLED] },
  };
  if (query.patient_id) reportFilter.patient_id = query.patient_id;
  const reports = await ImagingReport.find(reportFilter)
    .sort({ critical_notified_at: -1, reported_at: -1, created_at: -1 })
    .limit(300)
    .populate({
      path: 'imaging_order_id',
      select: 'imaging_order_no modality body_part priority status order_id encounter_id ordered_by ordered_at assigned_radiologist_id assigned_technician_id scheduled_at completed_at',
      populate: [
        { path: 'order_id', select: 'order_no order_type priority status department_id ordered_at ordered_by assigned_to sla_due_at sla_status', populate: [
          { path: 'department_id', select: 'department_code department_name' },
          { path: 'ordered_by', select: 'full_name username employee_code' },
          { path: 'assigned_to', select: 'full_name username employee_code' },
        ] },
        { path: 'encounter_id', select: 'encounter_code encounter_type status start_time department_id attending_doctor_id' },
        { path: 'assigned_radiologist_id', select: 'full_name username employee_code' },
        { path: 'assigned_technician_id', select: 'full_name username employee_code' },
      ],
    })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('radiologist_id verified_by', 'full_name username employee_code')
    .lean();

  const snapshots = [];
  for (const report of reports) {
    const imagingOrder = report.imaging_order_id || {};
    const parentOrder = imagingOrder.order_id || {};
    const priority = normalizePriority(imagingOrder.priority || parentOrder.priority);
    const notifiedAt = report.critical_notified_at || report.reported_at || report.created_at;
    const dueAt = addMinutes(notifiedAt, CRITICAL_ACK_SLA_MINUTES[priority]);
    const sla = makeSla(dueAt, new Date(), 3);
    const summary = report.critical_finding || report.critical_note || report.impression || 'Critical imaging finding cần xác nhận.';
    const base = {
      source_type: SOURCE_TYPE.IMAGING_REPORT,
      source_id: report._id,
      module: 'imaging',
      patient_id: report.patient_id?._id || report.patient_id,
      encounter_id: imagingOrder.encounter_id?._id || imagingOrder.encounter_id,
      order_id: parentOrder._id || imagingOrder.order_id,
      department_id: parentOrder.department_id?._id || parentOrder.department_id,
      priority,
      severity: SEVERITY.CRITICAL,
      title: `${report.report_no || 'Imaging report'} critical chưa ACK`,
      message: summary,
      first_detected_at: notifiedAt,
      notified_at: notifiedAt,
      sla_due_at: dueAt,
      breached_at: sla?.state === 'breached' ? dueAt : undefined,
      sla,
      sla_status: sla?.state,
      patient: patient(report.patient_id),
      encounter: encounter(imagingOrder.encounter_id),
      order: sourceOrder(parentOrder),
      source: {
        type: SOURCE_TYPE.IMAGING_REPORT,
        code: report.report_no,
        label: [imagingOrder.modality, imagingOrder.body_part].filter(Boolean).join(' - ') || 'Chẩn đoán hình ảnh',
        status: report.status,
        module_label: 'Chẩn đoán hình ảnh',
      },
      report: {
        id: toId(report),
        report_no: report.report_no,
        status: report.status,
        reported_at: report.reported_at,
        critical_finding: report.critical_finding,
        critical_note: report.critical_note,
        impression: report.impression,
        released_to_patient: report.released_to_patient,
      },
      critical_summary: summary,
      allowed_actions: buildAllowedActions(['acknowledge', 'notify', 'escalate', 'request_amend', 'timeline']),
      metadata: {
        allowed_actions: buildAllowedActions(['acknowledge', 'notify', 'escalate', 'request_amend', 'timeline']),
        modality: imagingOrder.modality,
        body_part: imagingOrder.body_part,
      },
    };
    snapshots.push(baseAlert({ ...base, category: CATEGORY.CRITICAL_RESULT_OPEN }));
    if (sla?.state === 'breached') {
      snapshots.push(baseAlert({
        ...base,
        category: CATEGORY.CRITICAL_ACK_OVERDUE,
        title: `${report.report_no || 'Imaging report'} quá hạn ACK`,
        message: `${summary} - quá hạn ${sla.breached_minutes} phút.`,
      }));
    }
  }
  return snapshots;
}

async function buildRejectedSpecimenSnapshots(query = {}) {
  const filter = { status: SPECIMEN_STATUS.REJECTED };
  if (query.patient_id) filter.patient_id = query.patient_id;
  const rows = await Specimen.find(filter)
    .sort({ rejected_at: -1, created_at: -1 })
    .limit(300)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('rejected_by collected_by received_by', 'full_name username employee_code')
    .populate({
      path: 'lab_order_id',
      select: 'lab_order_no test_code test_name priority status order_id encounter_id ordered_by ordered_at',
      populate: [
        { path: 'order_id', select: 'order_no order_type priority status department_id ordered_at ordered_by assigned_to', populate: [
          { path: 'department_id', select: 'department_code department_name' },
          { path: 'ordered_by', select: 'full_name username employee_code' },
          { path: 'assigned_to', select: 'full_name username employee_code' },
        ] },
        { path: 'encounter_id', select: 'encounter_code encounter_type status start_time department_id attending_doctor_id' },
      ],
    })
    .lean();

  return rows.map((specimen) => {
    const labOrder = specimen.lab_order_id || {};
    const parentOrder = labOrder.order_id || {};
    const priority = normalizePriority(labOrder.priority || parentOrder.priority);
    const dueAt = addMinutes(specimen.rejected_at || specimen.created_at, RECOLLECTION_SLA_MINUTES[priority]);
    const sla = makeSla(dueAt, new Date(), 30);
    const severity = specimen.rejection_severity === 'critical' || priority === ORDER_PRIORITY.STAT
      ? SEVERITY.CRITICAL
      : priority === ORDER_PRIORITY.URGENT
        ? SEVERITY.HIGH
        : SEVERITY.WARNING;
    return baseAlert({
      category: CATEGORY.SPECIMEN_REJECTED,
      source_type: SOURCE_TYPE.SPECIMEN,
      source_id: specimen._id,
      module: 'lab',
      patient_id: specimen.patient_id?._id || specimen.patient_id,
      encounter_id: labOrder.encounter_id?._id || labOrder.encounter_id,
      order_id: parentOrder._id || labOrder.order_id,
      department_id: parentOrder.department_id?._id || parentOrder.department_id,
      priority,
      severity,
      title: `${specimen.specimen_no || 'Specimen'} bị từ chối`,
      message: specimen.rejection_reason || specimen.rejection_reason_code || 'Mẫu bệnh phẩm bị từ chối, cần đánh giá lấy lại.',
      first_detected_at: specimen.rejected_at || specimen.created_at,
      sla_due_at: dueAt,
      breached_at: sla?.state === 'breached' ? dueAt : undefined,
      sla,
      sla_status: sla?.state,
      patient: patient(specimen.patient_id),
      encounter: encounter(labOrder.encounter_id),
      order: sourceOrder(parentOrder),
      source: {
        type: SOURCE_TYPE.SPECIMEN,
        code: specimen.specimen_no,
        label: specimen.specimen_type,
        status: specimen.status,
        module_label: 'Mẫu xét nghiệm',
      },
      specimen: {
        id: toId(specimen),
        specimen_no: specimen.specimen_no,
        specimen_type: specimen.specimen_type,
        container_type: specimen.container_type,
        collected_at: specimen.collected_at,
        received_at: specimen.received_at,
        rejected_at: specimen.rejected_at,
        rejected_by: person(specimen.rejected_by),
        rejection_reason: specimen.rejection_reason,
        rejection_reason_code: specimen.rejection_reason_code,
        need_recollection: specimen.need_recollection,
      },
      allowed_actions: buildAllowedActions(['notify_nurse', 'notify_doctor', 'request_recollection', 'print_barcode', 'dispose', 'timeline', 'resolve']),
      metadata: {
        allowed_actions: buildAllowedActions(['notify_nurse', 'notify_doctor', 'request_recollection', 'print_barcode', 'dispose', 'timeline', 'resolve']),
        rejection_reason_code: specimen.rejection_reason_code,
        need_recollection: specimen.need_recollection,
      },
    });
  });
}

async function buildOverdueOrderSnapshots(query = {}) {
  const orderFilter = {
    order_type: { $in: [ORDER_TYPE.LAB, ORDER_TYPE.IMAGING, ORDER_TYPE.PROCEDURE] },
    status: { $nin: TERMINAL_PARENT_ORDER_STATUSES },
  };
  if (query.patient_id) orderFilter.patient_id = query.patient_id;
  const orders = await Order.find(orderFilter)
    .sort({ sla_due_at: 1, ordered_at: 1 })
    .limit(500)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id attending_doctor_id')
    .populate('department_id', 'department_code department_name')
    .populate('ordered_by assigned_to acknowledged_by', 'full_name username employee_code')
    .lean();

  const orderIds = orders.map((order) => order._id);
  const [labOrders, imagingOrders, procedureOrders] = await Promise.all([
    LabOrder.find({ order_id: { $in: orderIds } }).select('order_id lab_order_no test_name status priority ordered_at').lean(),
    ImagingOrder.find({ order_id: { $in: orderIds } }).select('order_id imaging_order_no modality body_part status priority scheduled_at started_at completed_at').lean(),
    ProcedureOrder.find({ order_id: { $in: orderIds } }).select('order_id procedure_order_no procedure_name status priority scheduled_start started_at completed_at').lean(),
  ]);
  const childByOrder = new Map([
    ...labOrders.map((row) => [String(row.order_id), { module: 'lab', row, code: row.lab_order_no, label: row.test_name }]),
    ...imagingOrders.map((row) => [String(row.order_id), { module: 'imaging', row, code: row.imaging_order_no, label: [row.modality, row.body_part].filter(Boolean).join(' - ') }]),
    ...procedureOrders.map((row) => [String(row.order_id), { module: 'procedure', row, code: row.procedure_order_no, label: row.procedure_name }]),
  ]);

  const now = new Date();
  return orders
    .map((order) => {
      const priority = normalizePriority(order.priority);
      const dueAt = order.sla_due_at || addMinutes(order.ordered_at, ORDER_SLA_MINUTES[priority]);
      const sla = makeSla(dueAt, now, priority === ORDER_PRIORITY.STAT ? 10 : 60);
      if (order.sla_status !== 'breached' && sla?.state !== 'breached') return null;
      const child = childByOrder.get(String(order._id)) || {};
      const module = child.module || order.order_type || 'orders';
      return baseAlert({
        category: CATEGORY.ORDER_OVERDUE,
        source_type: SOURCE_TYPE.ORDER,
        source_id: order._id,
        module,
        patient_id: order.patient_id?._id || order.patient_id,
        encounter_id: order.encounter_id?._id || order.encounter_id,
        order_id: order._id,
        department_id: order.department_id?._id || order.department_id,
        priority,
        severity: priority === ORDER_PRIORITY.STAT ? SEVERITY.CRITICAL : SEVERITY.HIGH,
        title: `${order.order_no || 'Order'} quá hạn SLA`,
        message: `${child.label || order.order_type || 'Chỉ định'} đang ở trạng thái ${child.row?.status || order.status}.`,
        first_detected_at: dueAt,
        sla_due_at: dueAt,
        breached_at: dueAt,
        sla,
        sla_status: 'breached',
        patient: patient(order.patient_id),
        encounter: encounter(order.encounter_id),
        order: sourceOrder(order),
        source: {
          type: SOURCE_TYPE.ORDER,
          code: child.code || order.order_no,
          label: child.label || order.order_type,
          status: child.row?.status || order.status,
          module_label: module,
        },
        current_stage: child.row?.status || order.status,
        overdue_minutes: sla?.breached_minutes || order.sla_breach_minutes || 0,
        allowed_actions: buildAllowedActions(['acknowledge', 'assign', 'start', 'complete', 'notify_department', 'escalate', 'timeline']),
        metadata: {
          allowed_actions: buildAllowedActions(['acknowledge', 'assign', 'start', 'complete', 'notify_department', 'escalate', 'timeline']),
          child_order: child.row || null,
          sla_status: order.sla_status,
        },
      });
    })
    .filter(Boolean);
}

async function buildMissingFileSnapshots(query = {}) {
  const snapshots = [];
  const missingTasks = await MissingDocumentTask.find({ status: { $in: ['open', 'overdue'] } })
    .sort({ due_at: 1, created_at: -1 })
    .limit(250)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
    .populate('order_id', 'order_no order_type priority status department_id ordered_at')
    .lean();

  for (const task of missingTasks) {
    const priority = normalizePriority(task.order_id?.priority);
    const sla = makeSla(task.due_at, new Date(), 30);
    snapshots.push(baseAlert({
      category: CATEGORY.MISSING_RESULT_FILE,
      source_type: SOURCE_TYPE.MISSING_DOCUMENT_TASK,
      source_id: task._id,
      module: task.module || 'records',
      patient_id: task.patient_id?._id || task.patient_id,
      encounter_id: task.encounter_id?._id || task.encounter_id,
      order_id: task.order_id?._id || task.order_id,
      department_id: task.order_id?.department_id,
      priority,
      severity: task.severity === 'critical' ? SEVERITY.CRITICAL : task.severity === 'high' ? SEVERITY.HIGH : SEVERITY.WARNING,
      title: task.expected_file_label || `${task.entity_code || 'Hồ sơ'} thiếu tệp`,
      message: `${task.required_category} chưa đủ theo rule ${task.trigger_status || ''}`.trim(),
      first_detected_at: task.created_at,
      sla_due_at: task.due_at,
      breached_at: task.status === 'overdue' || sla?.state === 'breached' ? task.due_at : undefined,
      sla,
      sla_status: task.status === 'overdue' ? 'breached' : sla?.state,
      patient: patient(task.patient_id),
      encounter: encounter(task.encounter_id),
      order: sourceOrder(task.order_id),
      source: {
        type: SOURCE_TYPE.MISSING_DOCUMENT_TASK,
        code: task.entity_code,
        label: task.expected_file_label || task.required_category,
        status: task.status,
        module_label: task.module,
      },
      file_matrix: [{
        required_file: task.expected_file_label || task.required_category,
        category: task.required_category,
        status: task.status === 'overdue' ? 'overdue' : 'missing',
      }],
      allowed_actions: buildAllowedActions(['upload_file', 'view_files', 'request_review', 'mark_not_required', 'notify_staff', 'resolve']),
      metadata: {
        allowed_actions: buildAllowedActions(['upload_file', 'view_files', 'request_review', 'mark_not_required', 'notify_staff', 'resolve']),
        required_category: task.required_category,
        responsible_role: task.responsible_role,
      },
    }));
  }

  const badAttachments = await Attachment.find({
    status: ATTACHMENT_STATUS.ACTIVE,
    $or: [
      { scan_status: { $in: ['failed', 'infected'] } },
      { review_status: { $in: [DOCUMENT_REVIEW_STATUS.PENDING, DOCUMENT_REVIEW_STATUS.REJECTED] } },
    ],
  })
    .sort({ created_at: -1 })
    .limit(200)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
    .populate('order_id', 'order_no order_type priority status department_id ordered_at')
    .populate('uploaded_by', 'full_name username employee_code')
    .lean();

  for (const attachment of badAttachments) {
    const issue = attachment.scan_status === 'infected'
      ? 'File bị đánh dấu nhiễm mã độc'
      : attachment.scan_status === 'failed'
        ? 'Scan file thất bại'
        : attachment.review_status === DOCUMENT_REVIEW_STATUS.REJECTED
          ? 'File bị từ chối rà soát'
          : 'File đang chờ rà soát';
    snapshots.push(baseAlert({
      category: CATEGORY.MISSING_RESULT_FILE,
      source_type: SOURCE_TYPE.ATTACHMENT,
      source_id: attachment._id,
      module: attachment.entity_type?.includes('imaging') ? 'imaging' : attachment.entity_type?.includes('procedure') ? 'procedure' : attachment.entity_type?.includes('lab') ? 'lab' : 'records',
      patient_id: attachment.patient_id?._id || attachment.patient_id,
      encounter_id: attachment.encounter_id?._id || attachment.encounter_id,
      order_id: attachment.order_id?._id || attachment.order_id,
      department_id: attachment.order_id?.department_id || attachment.encounter_id?.department_id,
      priority: normalizePriority(attachment.order_id?.priority),
      severity: attachment.scan_status === 'infected' ? SEVERITY.CRITICAL : SEVERITY.HIGH,
      title: issue,
      message: attachment.original_name || attachment.file_name,
      first_detected_at: attachment.created_at,
      patient: patient(attachment.patient_id),
      encounter: encounter(attachment.encounter_id),
      order: sourceOrder(attachment.order_id),
      source: {
        type: SOURCE_TYPE.ATTACHMENT,
        code: attachment.file_name,
        label: attachment.category || attachment.original_name,
        status: attachment.scan_status,
        module_label: attachment.entity_type,
      },
      attachment: {
        id: toId(attachment),
        file_name: attachment.file_name,
        original_name: attachment.original_name,
        category: attachment.category,
        scan_status: attachment.scan_status,
        review_status: attachment.review_status,
        released_to_patient: attachment.released_to_patient,
        uploaded_by: person(attachment.uploaded_by),
        created_at: attachment.created_at,
      },
      file_matrix: [{
        required_file: attachment.category || 'Tệp kết quả',
        category: attachment.category,
        status: attachment.scan_status === 'clean' ? attachment.review_status : attachment.scan_status,
      }],
      allowed_actions: buildAllowedActions(['view_file', 'download_file', 'archive_file', 'request_review', 'release_to_patient', 'resolve']),
      metadata: {
        allowed_actions: buildAllowedActions(['view_file', 'download_file', 'archive_file', 'request_review', 'release_to_patient', 'resolve']),
        scan_status: attachment.scan_status,
        review_status: attachment.review_status,
      },
    }));
  }

  return snapshots;
}

async function buildCorrectionSnapshots(query = {}) {
  const [labCorrections, imagingCorrections] = await Promise.all([
    LabResultCorrectionRequest.find({ status: { $in: ['open', 'in_progress'] } })
      .sort({ due_at: 1, requested_at: -1 })
      .limit(250)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
      .populate('lab_order_id', 'lab_order_no test_name priority status order_id')
      .populate('lab_result_id', 'result_no status is_critical released_to_patient amendment_version')
      .populate('requested_by assigned_to', 'full_name username employee_code')
      .lean(),
    ImagingReportCorrectionRequest.find({ status: { $in: ['open', 'in_progress'] } })
      .sort({ due_at: 1, requested_at: -1 })
      .limit(250)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('imaging_order_id', 'imaging_order_no modality body_part priority status order_id encounter_id')
      .populate('report_id', 'report_no status is_critical released_to_patient amendment_version')
      .populate('requested_by assigned_to', 'full_name username employee_code')
      .lean(),
  ]);

  const snapshots = [];
  for (const correction of labCorrections) {
    const priority = normalizePriority(correction.priority || correction.lab_order_id?.priority);
    const sla = makeSla(correction.due_at, new Date(), 60);
    snapshots.push(baseAlert({
      category: CATEGORY.RESULT_NEEDS_CORRECTION,
      source_type: SOURCE_TYPE.LAB_CORRECTION_REQUEST,
      source_id: correction._id,
      module: 'lab',
      patient_id: correction.patient_id?._id || correction.patient_id,
      encounter_id: correction.encounter_id?._id || correction.encounter_id,
      order_id: correction.lab_order_id?.order_id,
      priority,
      severity: correction.lab_result_id?.is_critical ? SEVERITY.CRITICAL : priority === ORDER_PRIORITY.STAT ? SEVERITY.HIGH : SEVERITY.WARNING,
      title: `${correction.lab_result_id?.result_no || 'Lab result'} cần sửa`,
      message: correction.reason_text,
      first_detected_at: correction.requested_at,
      sla_due_at: correction.due_at,
      breached_at: sla?.state === 'breached' ? correction.due_at : undefined,
      sla,
      sla_status: sla?.state,
      patient: patient(correction.patient_id),
      encounter: encounter(correction.encounter_id),
      source: {
        type: SOURCE_TYPE.LAB_CORRECTION_REQUEST,
        code: correction.lab_result_id?.result_no,
        label: correction.lab_order_id?.test_name || 'Lab correction',
        status: correction.status,
        module_label: 'Lab',
      },
      correction: {
        id: toId(correction),
        source_result_no: correction.lab_result_id?.result_no,
        reason_code: correction.reason_code,
        reason_text: correction.reason_text,
        requested_by: person(correction.requested_by),
        assigned_to: person(correction.assigned_to),
        status: correction.status,
        due_at: correction.due_at,
      },
      allowed_actions: buildAllowedActions(['open_amend_form', 'assign', 'start', 'resolve', 'reject', 'release_amended_result', 'notify_doctor']),
      metadata: {
        allowed_actions: buildAllowedActions(['open_amend_form', 'assign', 'start', 'resolve', 'reject', 'release_amended_result', 'notify_doctor']),
        reason_code: correction.reason_code,
      },
    }));
  }

  for (const correction of imagingCorrections) {
    const imagingOrder = correction.imaging_order_id || {};
    const priority = normalizePriority(imagingOrder.priority);
    const sla = makeSla(correction.due_at, new Date(), 60);
    snapshots.push(baseAlert({
      category: CATEGORY.RESULT_NEEDS_CORRECTION,
      source_type: SOURCE_TYPE.IMAGING_CORRECTION_REQUEST,
      source_id: correction._id,
      module: 'imaging',
      patient_id: correction.patient_id?._id || correction.patient_id,
      encounter_id: imagingOrder.encounter_id?._id || imagingOrder.encounter_id,
      order_id: imagingOrder.order_id,
      priority,
      severity: correction.severity === 'critical' || correction.report_id?.is_critical ? SEVERITY.CRITICAL : correction.severity === 'high' ? SEVERITY.HIGH : SEVERITY.WARNING,
      title: `${correction.report_id?.report_no || 'Imaging report'} cần sửa`,
      message: correction.reason,
      first_detected_at: correction.requested_at,
      sla_due_at: correction.due_at,
      breached_at: sla?.state === 'breached' ? correction.due_at : undefined,
      sla,
      sla_status: sla?.state,
      patient: patient(correction.patient_id),
      source: {
        type: SOURCE_TYPE.IMAGING_CORRECTION_REQUEST,
        code: correction.report_id?.report_no,
        label: [imagingOrder.modality, imagingOrder.body_part].filter(Boolean).join(' - ') || 'Imaging correction',
        status: correction.status,
        module_label: 'Chẩn đoán hình ảnh',
      },
      correction: {
        id: toId(correction),
        source_report_no: correction.report_id?.report_no,
        correction_type: correction.correction_type,
        reason_text: correction.reason,
        requested_by: person(correction.requested_by),
        assigned_to: person(correction.assigned_to),
        status: correction.status,
        due_at: correction.due_at,
      },
      allowed_actions: buildAllowedActions(['open_amend_form', 'assign', 'start', 'resolve', 'reject', 'release_amended_result', 'notify_doctor']),
      metadata: {
        allowed_actions: buildAllowedActions(['open_amend_form', 'assign', 'start', 'resolve', 'reject', 'release_amended_result', 'notify_doctor']),
        correction_type: correction.correction_type,
      },
    }));
  }

  return snapshots;
}

async function buildNoShowCancelSnapshots(query = {}) {
  const imagingRows = await ImagingOrder.find({
    $or: [
      { status: IMAGING_ORDER_STATUS.NO_SHOW },
      { cancelled_at: { $ne: null } },
    ],
  })
    .sort({ no_show_at: -1, cancelled_at: -1, scheduled_at: -1 })
    .limit(250)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
    .populate('order_id', 'order_no order_type priority status department_id ordered_at charge_id')
    .populate('ordered_by assigned_technician_id assigned_radiologist_id cancelled_by', 'full_name username employee_code')
    .lean();

  const procedureRows = await ProcedureOrder.find({
    $or: [
      { status: PROCEDURE_STATUS.NO_SHOW },
      { cancelled_at: { $ne: null } },
    ],
  })
    .sort({ no_show_at: -1, cancelled_at: -1, scheduled_start: -1 })
    .limit(250)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
    .populate('order_id', 'order_no order_type priority status department_id ordered_at charge_id')
    .populate('requested_by performer_id department_id cancelled_by no_show_by', 'full_name username employee_code department_code department_name')
    .lean();

  const snapshots = [];
  for (const row of imagingRows) {
    const eventType = row.status === IMAGING_ORDER_STATUS.NO_SHOW || row.no_show_at ? 'no_show' : 'cancelled';
    const eventAt = row.no_show_at || row.cancelled_at || row.updated_at;
    const priority = normalizePriority(row.priority || row.order_id?.priority);
    snapshots.push(baseAlert({
      category: CATEGORY.NO_SHOW_OR_ABNORMAL_CANCEL,
      source_type: SOURCE_TYPE.IMAGING_ORDER,
      source_id: row._id,
      module: 'imaging',
      patient_id: row.patient_id?._id || row.patient_id,
      encounter_id: row.encounter_id?._id || row.encounter_id,
      order_id: row.order_id?._id || row.order_id,
      department_id: row.order_id?.department_id,
      priority,
      severity: priority === ORDER_PRIORITY.STAT ? SEVERITY.HIGH : SEVERITY.WARNING,
      title: `${row.imaging_order_no || 'Imaging order'} ${eventType === 'no_show' ? 'no-show' : 'hủy bất thường'}`,
      message: row.no_show_reason || row.cancel_reason || 'Cần liên hệ và đánh giá reschedule/billing impact.',
      first_detected_at: eventAt,
      patient: patient(row.patient_id),
      encounter: encounter(row.encounter_id),
      order: sourceOrder(row.order_id),
      source: {
        type: SOURCE_TYPE.IMAGING_ORDER,
        code: row.imaging_order_no,
        label: [row.modality, row.body_part].filter(Boolean).join(' - '),
        status: row.status,
        module_label: 'Chẩn đoán hình ảnh',
      },
      no_show_case: {
        event_type: eventType,
        scheduled_at: row.scheduled_at,
        no_show_at: row.no_show_at,
        cancelled_at: row.cancelled_at,
        reason: row.no_show_reason || row.cancel_reason,
        billing_impact: { has_charge: Boolean(row.order_id?.charge_id) },
      },
      allowed_actions: buildAllowedActions(['mark_contacted', 'log_call', 'reschedule_request', 'notify_doctor', 'close_case', 'timeline']),
      metadata: {
        allowed_actions: buildAllowedActions(['mark_contacted', 'log_call', 'reschedule_request', 'notify_doctor', 'close_case', 'timeline']),
        event_type: eventType,
      },
    }));
  }

  for (const row of procedureRows) {
    const eventType = row.status === PROCEDURE_STATUS.NO_SHOW || row.no_show_at ? 'no_show' : 'cancelled';
    const eventAt = row.no_show_at || row.cancelled_at || row.updated_at;
    const priority = normalizePriority(row.priority || row.order_id?.priority);
    snapshots.push(baseAlert({
      category: CATEGORY.NO_SHOW_OR_ABNORMAL_CANCEL,
      source_type: SOURCE_TYPE.PROCEDURE_ORDER,
      source_id: row._id,
      module: 'procedure',
      patient_id: row.patient_id?._id || row.patient_id,
      encounter_id: row.encounter_id?._id || row.encounter_id,
      order_id: row.order_id?._id || row.order_id,
      department_id: row.department_id?._id || row.order_id?.department_id,
      priority,
      severity: priority === ORDER_PRIORITY.STAT ? SEVERITY.HIGH : SEVERITY.WARNING,
      title: `${row.procedure_order_no || 'Procedure order'} ${eventType === 'no_show' ? 'no-show' : 'hủy bất thường'}`,
      message: row.no_show_reason || row.cancel_reason || 'Cần liên hệ và đánh giá reschedule/billing impact.',
      first_detected_at: eventAt,
      patient: patient(row.patient_id),
      encounter: encounter(row.encounter_id),
      order: sourceOrder(row.order_id),
      source: {
        type: SOURCE_TYPE.PROCEDURE_ORDER,
        code: row.procedure_order_no,
        label: row.procedure_name,
        status: row.status,
        module_label: 'Thủ thuật',
      },
      no_show_case: {
        event_type: eventType,
        scheduled_at: row.scheduled_start,
        no_show_at: row.no_show_at,
        cancelled_at: row.cancelled_at,
        reason: row.no_show_reason || row.cancel_reason,
        billing_impact: { has_charge: Boolean(row.order_id?.charge_id) },
      },
      allowed_actions: buildAllowedActions(['mark_contacted', 'log_call', 'reschedule_request', 'notify_doctor', 'close_case', 'timeline']),
      metadata: {
        allowed_actions: buildAllowedActions(['mark_contacted', 'log_call', 'reschedule_request', 'notify_doctor', 'close_case', 'timeline']),
        event_type: eventType,
      },
    }));
  }
  return snapshots;
}

async function buildAllSnapshots(query = {}) {
  const requestedCategory = safeString(query.category || '');
  const builders = [];
  if (!requestedCategory || [CATEGORY.CRITICAL_RESULT_OPEN, CATEGORY.CRITICAL_ACK_OVERDUE].includes(requestedCategory)) {
    builders.push(buildCriticalLabSnapshots(query), buildCriticalImagingSnapshots(query));
  }
  if (!requestedCategory || requestedCategory === CATEGORY.SPECIMEN_REJECTED) builders.push(buildRejectedSpecimenSnapshots(query));
  if (!requestedCategory || requestedCategory === CATEGORY.ORDER_OVERDUE) builders.push(buildOverdueOrderSnapshots(query));
  if (!requestedCategory || requestedCategory === CATEGORY.MISSING_RESULT_FILE) builders.push(buildMissingFileSnapshots(query));
  if (!requestedCategory || requestedCategory === CATEGORY.RESULT_NEEDS_CORRECTION) builders.push(buildCorrectionSnapshots(query));
  if (!requestedCategory || requestedCategory === CATEGORY.NO_SHOW_OR_ABNORMAL_CANCEL) builders.push(buildNoShowCancelSnapshots(query));
  const groups = await Promise.all(builders);
  return groups.flat();
}

async function materializeSnapshots(snapshots = [], actor = {}, query = {}) {
  if (String(query.materialize || 'true').toLowerCase() === 'false') {
    return snapshots.map((item) => normalizeAlertDocument(null, item));
  }
  const rows = [];
  for (const snapshot of snapshots) rows.push(await materializeSnapshot(snapshot, actor));
  return rows;
}

function buildSummary(items = []) {
  const openItems = items.filter((item) => OPEN_ALERT_STATUSES.includes(item.status));
  const byCategory = {};
  const byModule = {};
  const bySeverity = {};
  const byStatus = {};
  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    byModule[item.module] = (byModule[item.module] || 0) + 1;
    bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
  }
  return {
    total: items.length,
    open: openItems.length,
    critical: items.filter((item) => item.severity === SEVERITY.CRITICAL).length,
    high: items.filter((item) => item.severity === SEVERITY.HIGH).length,
    warning: items.filter((item) => item.severity === SEVERITY.WARNING).length,
    critical_open: items.filter((item) => item.category === CATEGORY.CRITICAL_RESULT_OPEN).length,
    ack_overdue: items.filter((item) => item.category === CATEGORY.CRITICAL_ACK_OVERDUE).length,
    rejected_specimens: items.filter((item) => item.category === CATEGORY.SPECIMEN_REJECTED).length,
    overdue_orders: items.filter((item) => item.category === CATEGORY.ORDER_OVERDUE).length,
    missing_files: items.filter((item) => item.category === CATEGORY.MISSING_RESULT_FILE).length,
    correction_needed: items.filter((item) => item.category === CATEGORY.RESULT_NEEDS_CORRECTION).length,
    no_show_cancel: items.filter((item) => item.category === CATEGORY.NO_SHOW_OR_ABNORMAL_CANCEL).length,
    breached: items.filter((item) => item.sla?.state === 'breached' || item.sla_status === 'breached').length,
    warning_sla: items.filter((item) => item.sla?.state === 'warning' || item.sla_status === 'warning').length,
    stat: items.filter((item) => item.priority === ORDER_PRIORITY.STAT).length,
    urgent: items.filter((item) => item.priority === ORDER_PRIORITY.URGENT).length,
    by_category: byCategory,
    by_module: byModule,
    by_severity: bySeverity,
    by_status: byStatus,
  };
}

function sortAlerts(items = []) {
  return [...items].sort((left, right) => (
    severityRank(left.severity) - severityRank(right.severity)
    || (left.sla?.state === 'breached' ? 0 : 1) - (right.sla?.state === 'breached' ? 0 : 1)
    || priorityRank(left.priority) - priorityRank(right.priority)
    || new Date(left.sla_due_at || left.first_detected_at || 0).getTime() - new Date(right.sla_due_at || right.first_detected_at || 0).getTime()
  ));
}

async function listDiagnosticAlerts(query = {}, actor = {}) {
  assertStaffRead(actor);
  const snapshots = await buildAllSnapshots(query);
  const materialized = await materializeSnapshots(snapshots, actor, query);
  const filtered = sortAlerts(applySnapshotFilters(materialized, query));
  const { page, limit, skip } = normalizePagination(query);
  const paginated = filtered.slice(skip, skip + limit);
  return {
    generated_at: new Date(),
    realtime: {
      active: true,
      events: [
        'diagnostic_alert.created',
        'diagnostic_alert.updated',
        'diagnostic_alert.acknowledged',
        'diagnostic_alert.assigned',
        'diagnostic_alert.escalated',
        'diagnostic_alert.resolved',
        'diagnostic_alert.dismissed',
        'diagnostic_alert.sla_breached',
      ],
      rooms: ['diagnostics:alerts'],
    },
    summary: buildSummary(filtered),
    items: paginated,
    pagination: buildPaginationMeta({ page, limit, total: filtered.length }),
  };
}

async function getDiagnosticAlertSummary(query = {}, actor = {}) {
  assertStaffRead(actor);
  const snapshots = await buildAllSnapshots(query);
  const materialized = await materializeSnapshots(snapshots, actor, query);
  const filtered = applySnapshotFilters(materialized, { ...query, limit: 1000 });
  return {
    generated_at: new Date(),
    summary: buildSummary(filtered),
  };
}

async function loadSourceDetail(alert = {}) {
  const sourceId = alert.source_id;
  if (!sourceId) return null;
  const commonPopulate = [
    { path: 'patient_id', select: 'patient_code full_name date_of_birth gender phone' },
    { path: 'encounter_id', select: 'encounter_code encounter_type status start_time department_id attending_doctor_id' },
  ];
  if (alert.source_type === SOURCE_TYPE.LAB_RESULT) {
    const [result, items, attachments] = await Promise.all([
      LabResult.findById(sourceId)
        .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
        .populate('performed_by verified_by critical_acknowledged_by', 'full_name username employee_code')
        .populate({ path: 'lab_order_id', select: 'lab_order_no test_code test_name priority status order_id encounter_id ordered_by ordered_at', populate: [
          { path: 'order_id', select: 'order_no order_type priority status department_id ordered_at' },
          { path: 'encounter_id', select: 'encounter_code encounter_type status start_time department_id' },
        ] })
        .lean(),
      LabResultItem.find({ lab_result_id: sourceId }).sort({ display_order: 1, created_at: 1 }).lean(),
      Attachment.find({ entity_type: 'lab_result', entity_id: sourceId, status: { $ne: ATTACHMENT_STATUS.DELETED } }).sort({ created_at: -1 }).lean(),
    ]);
    return { result, items, attachments };
  }
  if (alert.source_type === SOURCE_TYPE.IMAGING_REPORT) {
    const [report, attachments] = await Promise.all([
      ImagingReport.findById(sourceId)
        .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
        .populate('radiologist_id technician_id verified_by critical_acknowledged_by', 'full_name username employee_code')
        .populate({ path: 'imaging_order_id', select: 'imaging_order_no modality body_part priority status order_id encounter_id scheduled_at completed_at', populate: [
          { path: 'order_id', select: 'order_no order_type priority status department_id ordered_at' },
          { path: 'encounter_id', select: 'encounter_code encounter_type status start_time department_id' },
        ] })
        .lean(),
      Attachment.find({
        $or: [
          { entity_type: 'imaging_report', entity_id: sourceId },
          { entity_type: 'imaging_order', entity_id: alert.metadata?.imaging_order_id },
        ],
        status: { $ne: ATTACHMENT_STATUS.DELETED },
      }).sort({ created_at: -1 }).lean(),
    ]);
    return { report, attachments };
  }
  if (alert.source_type === SOURCE_TYPE.SPECIMEN) {
    return Specimen.findById(sourceId)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('collected_by received_by rejected_by disposed_by', 'full_name username employee_code')
      .populate({ path: 'lab_order_id', select: 'lab_order_no test_code test_name priority status order_id encounter_id', populate: [
        { path: 'order_id', select: 'order_no order_type priority status department_id ordered_at' },
        { path: 'encounter_id', select: 'encounter_code encounter_type status start_time department_id' },
      ] })
      .lean();
  }
  if (alert.source_type === SOURCE_TYPE.ORDER) {
    return Order.findById(sourceId)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
      .populate('department_id', 'department_code department_name')
      .populate('ordered_by assigned_to acknowledged_by', 'full_name username employee_code')
      .lean();
  }
  if (alert.source_type === SOURCE_TYPE.IMAGING_ORDER) {
    return ImagingOrder.findById(sourceId)
      .populate(commonPopulate)
      .populate('order_id', 'order_no order_type priority status department_id ordered_at charge_id')
      .populate('ordered_by assigned_technician_id assigned_radiologist_id cancelled_by', 'full_name username employee_code')
      .lean();
  }
  if (alert.source_type === SOURCE_TYPE.PROCEDURE_ORDER) {
    return ProcedureOrder.findById(sourceId)
      .populate(commonPopulate)
      .populate('order_id', 'order_no order_type priority status department_id ordered_at charge_id')
      .populate('requested_by performer_id cancelled_by no_show_by', 'full_name username employee_code')
      .lean();
  }
  if (alert.source_type === SOURCE_TYPE.ATTACHMENT) {
    return Attachment.findById(sourceId)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
      .populate('order_id', 'order_no order_type priority status department_id ordered_at')
      .populate('uploaded_by reviewed_by released_by', 'full_name username employee_code')
      .lean();
  }
  return null;
}

async function getDiagnosticAlertDetail(alertId, actor = {}) {
  assertStaffRead(actor);
  const alert = await DiagnosticAlert.findById(alertId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id attending_doctor_id')
    .populate('order_id', 'order_no order_type priority status department_id ordered_at ordered_by assigned_to')
    .populate('department_id', 'department_code department_name')
    .populate('assigned_to_user_id acknowledged_by resolved_by dismissed_by', 'full_name username employee_code')
    .lean();
  if (!alert) throw ApiError.notFound('Không tìm thấy diagnostic alert.');
  const [sourceDetail, auditTrail] = await Promise.all([
    loadSourceDetail(alert),
    AuditLog.find({
      $or: [
        { target_type: 'diagnostic_alert', target_id: alert._id },
        { target_type: alert.source_type, target_id: alert.source_id },
      ],
    }).sort({ created_at: -1 }).limit(30).lean().catch(() => []),
  ]);
  return {
    alert: normalizeAlertDocument(alert, {
      patient: patient(alert.patient_id),
      encounter: encounter(alert.encounter_id),
      order: sourceOrder(alert.order_id),
      source: {
        type: alert.source_type,
        code: alert.metadata?.source_code,
        label: alert.metadata?.source_label,
        status: alert.metadata?.source_status,
      },
      allowed_actions: alert.metadata?.allowed_actions || {},
    }),
    source_detail: sourceDetail,
    timeline: auditTrail,
    audit: auditTrail,
  };
}

async function updateAlert(alertId, updates = {}, actor = {}, action = 'diagnostic_alert.updated', requestMeta = {}) {
  assertStaffWrite(actor);
  const alert = await DiagnosticAlert.findById(alertId);
  if (!alert) throw ApiError.notFound('Không tìm thấy diagnostic alert.');
  const fromStatus = alert.status;
  Object.assign(alert, updates, { updated_by: actorId(actor) });
  await alert.save();
  await auditService.recordAuditLog({
    actor,
    action,
    targetType: 'diagnostic_alert',
    targetId: alert._id,
    status: 'success',
    message: 'Cập nhật Diagnostic Alert Center.',
    requestMeta,
    metadata: { from_status: fromStatus, to_status: alert.status },
  }).catch(() => {});
  const eventTypeMap = {
    'diagnostic_alert.acknowledged': REALTIME_EVENT_TYPE.DIAGNOSTIC_ALERT_ACKNOWLEDGED || 'diagnostic_alert.acknowledged',
    'diagnostic_alert.assigned': REALTIME_EVENT_TYPE.DIAGNOSTIC_ALERT_ASSIGNED || 'diagnostic_alert.assigned',
    'diagnostic_alert.escalated': REALTIME_EVENT_TYPE.DIAGNOSTIC_ALERT_ESCALATED || 'diagnostic_alert.escalated',
    'diagnostic_alert.resolved': REALTIME_EVENT_TYPE.DIAGNOSTIC_ALERT_RESOLVED || 'diagnostic_alert.resolved',
    'diagnostic_alert.dismissed': REALTIME_EVENT_TYPE.DIAGNOSTIC_ALERT_DISMISSED || 'diagnostic_alert.dismissed',
  };
  await publishAlertEvent(eventTypeMap[action] || REALTIME_EVENT_TYPE.DIAGNOSTIC_ALERT_UPDATED || 'diagnostic_alert.updated', alert, actor, { from_status: fromStatus });
  return getDiagnosticAlertDetail(alert._id, actor);
}

async function acknowledgeAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  const alert = await DiagnosticAlert.findById(alertId);
  if (!alert) throw ApiError.notFound('Không tìm thấy diagnostic alert.');
  if (payload.sync_source !== false) {
    if (alert.source_type === SOURCE_TYPE.LAB_RESULT && [CATEGORY.CRITICAL_RESULT_OPEN, CATEGORY.CRITICAL_ACK_OVERDUE].includes(alert.category)) {
      await laboratoryService.acknowledgeCriticalLabResult(alert.source_id, actor, requestMeta);
    }
    if (alert.source_type === SOURCE_TYPE.IMAGING_REPORT && [CATEGORY.CRITICAL_RESULT_OPEN, CATEGORY.CRITICAL_ACK_OVERDUE].includes(alert.category)) {
      await imagingService.acknowledgeCriticalImagingReport(alert.source_id, actor, requestMeta);
    }
  }
  return updateAlert(alertId, {
    status: ALERT_STATUS.ACKNOWLEDGED,
    acknowledged_by: actorId(actor),
    acknowledged_at: new Date(),
    resolution_note: payload.note,
  }, actor, 'diagnostic_alert.acknowledged', requestMeta);
}

function assignAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  const assignedTo = payload.assigned_to_user_id || payload.assigned_to || payload.user_id || actorId(actor);
  if (!assignedTo) throw ApiError.badRequest('assigned_to_user_id là bắt buộc.');
  return updateAlert(alertId, {
    status: ALERT_STATUS.ASSIGNED,
    assigned_to_user_id: optionalObjectId(assignedTo, 'assigned_to_user_id'),
    assigned_to_role: payload.assigned_to_role,
  }, actor, 'diagnostic_alert.assigned', requestMeta);
}

function escalateAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  return updateAlert(alertId, {
    status: ALERT_STATUS.ESCALATED,
    escalation_level: Math.max(Number(payload.escalation_level || payload.level || 1), 1),
    last_escalated_at: new Date(),
    resolution_note: payload.reason || payload.note,
  }, actor, 'diagnostic_alert.escalated', requestMeta);
}

function resolveAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  return updateAlert(alertId, {
    status: ALERT_STATUS.RESOLVED,
    resolved_by: actorId(actor),
    resolved_at: new Date(),
    resolution_note: payload.resolution_note || payload.note || payload.reason,
  }, actor, 'diagnostic_alert.resolved', requestMeta);
}

function dismissAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  const reason = payload.reason || payload.dismiss_reason;
  if (!reason) throw ApiError.badRequest('reason là bắt buộc khi dismiss alert.');
  return updateAlert(alertId, {
    status: ALERT_STATUS.DISMISSED,
    dismissed_by: actorId(actor),
    dismissed_at: new Date(),
    dismiss_reason: reason,
  }, actor, 'diagnostic_alert.dismissed', requestMeta);
}

async function bulkAction(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffWrite(actor);
  const alertIds = Array.isArray(payload.alert_ids) ? payload.alert_ids : Array.isArray(payload.ids) ? payload.ids : [];
  if (!alertIds.length) throw ApiError.badRequest('alert_ids là bắt buộc.');
  const action = payload.action;
  const results = [];
  for (const alertId of alertIds) {
    if (action === 'acknowledge') results.push(await acknowledgeAlert(alertId, payload, actor, requestMeta));
    else if (action === 'assign') results.push(await assignAlert(alertId, payload, actor, requestMeta));
    else if (action === 'escalate') results.push(await escalateAlert(alertId, payload, actor, requestMeta));
    else if (action === 'resolve') results.push(await resolveAlert(alertId, payload, actor, requestMeta));
    else if (action === 'dismiss') results.push(await dismissAlert(alertId, payload, actor, requestMeta));
    else throw ApiError.badRequest('action không hợp lệ.');
  }
  return { action, processed: results.length, results };
}

function withCategory(category) {
  return (query = {}, actor = {}) => listDiagnosticAlerts({ ...query, category }, actor);
}

async function runDiagnosticAlertSlaSweep(actor = {}) {
  const result = await listDiagnosticAlerts({ materialize: 'true', open: 'true', limit: 100 }, actor);
  const breached = result.items.filter((item) => item.sla?.state === 'breached');
  await Promise.all(breached.map((item) => DiagnosticAlert.updateOne(
    { _id: item.alert_id, breached_at: null },
    { $set: { breached_at: item.sla_due_at, updated_by: actorId(actor) } },
  )));
  return {
    checked: result.summary.total,
    breached: breached.length,
    generated_at: new Date(),
  };
}

module.exports = {
  acknowledgeAlert,
  assignAlert,
  bulkAction,
  dismissAlert,
  escalateAlert,
  getCriticalOpenAlerts: withCategory(CATEGORY.CRITICAL_RESULT_OPEN),
  getCriticalOverdueAlerts: withCategory(CATEGORY.CRITICAL_ACK_OVERDUE),
  getDiagnosticAlertDetail,
  getDiagnosticAlertSummary,
  getMissingFileAlerts: withCategory(CATEGORY.MISSING_RESULT_FILE),
  getNoShowCancellationAlerts: withCategory(CATEGORY.NO_SHOW_OR_ABNORMAL_CANCEL),
  getOverdueOrderAlerts: withCategory(CATEGORY.ORDER_OVERDUE),
  getRejectedSpecimenAlerts: withCategory(CATEGORY.SPECIMEN_REJECTED),
  getCorrectionNeededAlerts: withCategory(CATEGORY.RESULT_NEEDS_CORRECTION),
  listDiagnosticAlerts,
  resolveAlert,
  runDiagnosticAlertSlaSweep,
};
