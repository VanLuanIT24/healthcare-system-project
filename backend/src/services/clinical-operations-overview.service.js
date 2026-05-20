const crypto = require('crypto');
const mongoose = require('mongoose');
const {
  Attachment,
  Charge,
  ClinicalOpsEscalation,
  ClinicalOpsSlaRule,
  ImagingOrder,
  ImagingReport,
  LabOrder,
  LabResult,
  LabResultItem,
  Order,
  ProcedureOrder,
  ResultSignature,
  Specimen,
} = require('../models');
const {
  ATTACHMENT_STATUS,
  CHARGE_STATUS,
  IMAGING_ORDER_STATUS,
  IMAGING_REPORT_STATUS,
  LAB_ORDER_STATUS,
  LAB_RESULT_STATUS,
  ORDER_PRIORITY,
  ORDER_TYPE,
  PROCEDURE_STATUS,
  SPECIMEN_STATUS,
} = require('../constants/statuses');
const { PERMISSION, ROLE_CODE } = require('../constants/permissions');
const { hasAnyPermission, hasPermission } = require('../common/permissions');
const ApiError = require('../common/errors/api-error');
const auditService = require('./audit.service');
const laboratoryService = require('./laboratory.service');
const imagingService = require('./imaging.service');

const ACTIVE_ATTACHMENT_STATUSES = [ATTACHMENT_STATUS.ACTIVE];
const ACTIVE_CHARGE_EXCLUDED_STATUSES = [CHARGE_STATUS.VOIDED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.REFUNDED];
const OPEN_ESCALATION_STATUSES = ['open', 'acknowledged'];
const OPEN_ORDER_STATUSES = ['ordered', 'acknowledged', 'scheduled', 'collected', 'received', 'in_progress', 'draft', 'preliminary'];
const TERMINAL_ORDER_STATUSES = ['completed', 'cancelled', 'rejected', 'no_show', 'entered_in_error'];
const PENDING_RESULT_STATUSES = [LAB_RESULT_STATUS.PRELIMINARY, IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY];

const READ_PERMISSIONS = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.LAB_ORDERS.READ_OWN,
  PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
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
  PERMISSION.SPECIMENS.READ,
  PERMISSION.ATTACHMENTS.READ,
  PERMISSION.ATTACHMENTS.READ_CLINICAL,
  PERMISSION.ATTACHMENTS.READ_IMAGING,
  PERMISSION.ATTACHMENTS.READ_PROCEDURE,
];

const MODULE_READ_PERMISSIONS = {
  lab: [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.ORDERS.READ,
    PERMISSION.ORDERS.READ_LAB,
    PERMISSION.LAB_ORDERS.READ,
    PERMISSION.LAB_RESULTS.READ,
  ],
  imaging: [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.ORDERS.READ,
    PERMISSION.ORDERS.READ_IMAGING,
    PERMISSION.IMAGING_ORDERS.READ,
    PERMISSION.IMAGING_REPORTS.READ,
  ],
  procedure: [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.ORDERS.READ,
    PERMISSION.ORDERS.READ_PROCEDURE,
    PERMISSION.PROCEDURE_ORDERS.READ,
    PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ,
  ],
};

const MODULE_DEPARTMENT_PERMISSIONS = {
  lab: [PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.LAB_ORDERS.READ_DEPARTMENT],
  imaging: [PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT],
  procedure: [PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT],
};

const MODULE_OWN_PERMISSIONS = {
  lab: [PERMISSION.ORDERS.READ_OWN, PERMISSION.LAB_ORDERS.READ_OWN],
  imaging: [PERMISSION.ORDERS.READ_OWN, PERMISSION.IMAGING_ORDERS.READ_OWN],
  procedure: [PERMISSION.ORDERS.READ_OWN, PERMISSION.PROCEDURE_ORDERS.READ_OWN],
};

const SLA_FALLBACK_RULES = {
  lab: {
    ordered_to_collection: { [ORDER_PRIORITY.STAT]: 15, [ORDER_PRIORITY.URGENT]: 60, [ORDER_PRIORITY.ROUTINE]: 240, warning: 10 },
    collected_to_received: { [ORDER_PRIORITY.STAT]: 15, [ORDER_PRIORITY.URGENT]: 30, [ORDER_PRIORITY.ROUTINE]: 120, warning: 10 },
    received_to_testing: { [ORDER_PRIORITY.STAT]: 20, [ORDER_PRIORITY.URGENT]: 45, [ORDER_PRIORITY.ROUTINE]: 180, warning: 15 },
    testing_to_preliminary: { [ORDER_PRIORITY.STAT]: 45, [ORDER_PRIORITY.URGENT]: 120, [ORDER_PRIORITY.ROUTINE]: 480, warning: 30 },
    preliminary_to_final: { [ORDER_PRIORITY.STAT]: 30, [ORDER_PRIORITY.URGENT]: 90, [ORDER_PRIORITY.ROUTINE]: 240, warning: 20 },
    critical_acknowledgement: { [ORDER_PRIORITY.STAT]: 10, [ORDER_PRIORITY.URGENT]: 15, [ORDER_PRIORITY.ROUTINE]: 30, warning: 5 },
    final_to_release: { [ORDER_PRIORITY.STAT]: 60, [ORDER_PRIORITY.URGENT]: 240, [ORDER_PRIORITY.ROUTINE]: 1440, warning: 60 },
  },
  imaging: {
    ordered_to_scheduled: { [ORDER_PRIORITY.STAT]: 20, [ORDER_PRIORITY.URGENT]: 90, [ORDER_PRIORITY.ROUTINE]: 480, warning: 20 },
    scheduled_to_started: { [ORDER_PRIORITY.STAT]: 20, [ORDER_PRIORITY.URGENT]: 60, [ORDER_PRIORITY.ROUTINE]: 180, warning: 15 },
    started_to_completed: { [ORDER_PRIORITY.STAT]: 60, [ORDER_PRIORITY.URGENT]: 120, [ORDER_PRIORITY.ROUTINE]: 240, warning: 20 },
    completed_to_report: { [ORDER_PRIORITY.STAT]: 45, [ORDER_PRIORITY.URGENT]: 180, [ORDER_PRIORITY.ROUTINE]: 720, warning: 30 },
    report_to_final: { [ORDER_PRIORITY.STAT]: 30, [ORDER_PRIORITY.URGENT]: 120, [ORDER_PRIORITY.ROUTINE]: 480, warning: 30 },
    critical_acknowledgement: { [ORDER_PRIORITY.STAT]: 10, [ORDER_PRIORITY.URGENT]: 15, [ORDER_PRIORITY.ROUTINE]: 30, warning: 5 },
    final_to_release: { [ORDER_PRIORITY.STAT]: 60, [ORDER_PRIORITY.URGENT]: 240, [ORDER_PRIORITY.ROUTINE]: 1440, warning: 60 },
  },
  procedure: {
    ordered_to_scheduled: { [ORDER_PRIORITY.STAT]: 30, [ORDER_PRIORITY.URGENT]: 120, [ORDER_PRIORITY.ROUTINE]: 720, warning: 30 },
    scheduled_to_started: { [ORDER_PRIORITY.STAT]: 30, [ORDER_PRIORITY.URGENT]: 90, [ORDER_PRIORITY.ROUTINE]: 240, warning: 20 },
    started_to_completed: { [ORDER_PRIORITY.STAT]: 120, [ORDER_PRIORITY.URGENT]: 240, [ORDER_PRIORITY.ROUTINE]: 480, warning: 30 },
    completed_to_result_note: { [ORDER_PRIORITY.STAT]: 30, [ORDER_PRIORITY.URGENT]: 120, [ORDER_PRIORITY.ROUTINE]: 240, warning: 30 },
    completed_to_charge: { [ORDER_PRIORITY.STAT]: 60, [ORDER_PRIORITY.URGENT]: 240, [ORDER_PRIORITY.ROUTINE]: 1440, warning: 60 },
    completed_to_file: { [ORDER_PRIORITY.STAT]: 60, [ORDER_PRIORITY.URGENT]: 240, [ORDER_PRIORITY.ROUTINE]: 1440, warning: 60 },
  },
};

function assertStaffRead(actor = {}) {
  if ((actor.actorType || actor.actor_type) !== 'staff') {
    throw ApiError.forbidden('Chỉ tài khoản nhân sự được truy cập Clinical Operations.');
  }
  if (!hasAnyPermission(actor, READ_PERMISSIONS) && ![ROLE_CODE.SUPER_ADMIN, ROLE_CODE.ADMIN, ROLE_CODE.MANAGER].some((role) => hasRole(actor, role))) {
    throw ApiError.forbidden('Bạn không có quyền xem tổng quan cận lâm sàng.');
  }
}

function toId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return String(value);
}

function toObjectId(value, fieldName = 'id') {
  const id = toId(value);
  if (!id || !mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest(`${fieldName} không hợp lệ.`);
  }
  return new mongoose.Types.ObjectId(id);
}

function normalizeModule(value = 'all') {
  const normalized = String(value || 'all').toLowerCase();
  return ['lab', 'imaging', 'procedure', 'all'].includes(normalized) ? normalized : 'all';
}

function requestedModules(query = {}) {
  const module = normalizeModule(query.module);
  return module === 'all' ? ['lab', 'imaging', 'procedure'] : [module];
}

function normalizePriority(priority) {
  const value = String(priority || '').toLowerCase();
  return ['stat', 'urgent', 'routine'].includes(value) ? value : '';
}

function normalizeScope(scope) {
  const value = String(scope || '').toLowerCase();
  return ['mine', 'department', 'all'].includes(value) ? value : 'department';
}

function normalizeString(value) {
  return String(value || '').trim();
}

function escapeRegex(value) {
  return normalizeString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function localDateRange(value = new Date()) {
  const date = parseDate(value) || new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function buildDateRange(query = {}, { defaultToday = false } = {}) {
  if (query.date) return localDateRange(query.date);
  const start = parseDate(query.date_from);
  const end = parseDate(query.date_to);
  if (start || end) {
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  return defaultToday ? localDateRange(new Date()) : null;
}

function applyDateFilter(filter, field, range) {
  if (!range) return;
  filter[field] = {};
  if (range.start) filter[field].$gte = range.start;
  if (range.end) filter[field].$lte = range.end;
}

function limitFromQuery(query = {}, fallback = 120, max = 500) {
  const value = Number(query.limit);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

function canReadAllModule(module, actor = {}) {
  return hasAnyPermission(actor, MODULE_READ_PERMISSIONS[module] || []);
}

function canReadDepartmentModule(module, actor = {}) {
  return hasAnyPermission(actor, MODULE_DEPARTMENT_PERMISSIONS[module] || []);
}

function canReadOwnModule(module, actor = {}) {
  return hasAnyPermission(actor, MODULE_OWN_PERMISSIONS[module] || []);
}

function resolveEffectiveScope(module, query = {}, actor = {}) {
  const requestedScope = normalizeScope(query.scope);
  if (requestedScope === 'all' && canReadAllModule(module, actor)) return 'all';
  if (requestedScope === 'mine' && actor.userId && canReadOwnModule(module, actor)) return 'mine';
  if (actor.departmentId && canReadDepartmentModule(module, actor)) return 'department';
  if (actor.userId && canReadOwnModule(module, actor)) return 'mine';
  if (canReadAllModule(module, actor)) return 'all';
  return 'none';
}

async function scopedParentOrderIds(module, query = {}, actor = {}) {
  const scope = resolveEffectiveScope(module, query, actor);
  if (scope === 'none') throw ApiError.forbidden(`Bạn không có quyền xem dữ liệu ${module}.`);
  const filter = { order_type: module };
  if (query.department_id) filter.department_id = query.department_id;
  if (scope === 'department' && actor.departmentId) filter.department_id = actor.departmentId;
  if (scope === 'mine' && actor.userId) filter.ordered_by = actor.userId;
  if (!filter.department_id && !filter.ordered_by) return null;
  const orders = await Order.find(filter).select('_id').lean();
  return orders.map((order) => order._id);
}

function person(value, fallback = 'Chưa phân công') {
  if (!value) return null;
  if (typeof value === 'string') return { id: value, name: fallback };
  return {
    id: toId(value),
    name: value.full_name || value.username || value.employee_code || fallback,
    username: value.username,
    employee_code: value.employee_code,
    department_id: toId(value.department_id),
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

function timestampMax(...values) {
  const dates = values.map(parseDate).filter(Boolean);
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function minutesBetween(left, right = new Date()) {
  const start = parseDate(left);
  const end = parseDate(right);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function getSlaFallback(module, stage, priority) {
  const stageRule = SLA_FALLBACK_RULES[module]?.[stage] || {};
  return {
    threshold_minutes: Number(stageRule[priority] || stageRule[ORDER_PRIORITY.ROUTINE] || 240),
    warning_minutes: Number(stageRule.warning || 15),
  };
}

async function loadSlaRuleMap() {
  const rows = await ClinicalOpsSlaRule.find({ active: true }).lean();
  const map = new Map();
  for (const row of rows) {
    map.set(`${row.module}:${row.stage}:${row.priority}`, row);
  }
  return map;
}

function buildSla({ module, stage, priority = ORDER_PRIORITY.ROUTINE, startedAt, completedAt, rules, now = new Date() }) {
  const start = parseDate(startedAt);
  if (!start || !stage) return null;
  const configured = rules?.get(`${module}:${stage}:${priority}`);
  const fallback = getSlaFallback(module, stage, priority);
  const thresholdMinutes = Number(configured?.threshold_minutes || fallback.threshold_minutes);
  const warningMinutes = Number(configured?.warning_minutes ?? fallback.warning_minutes);
  const dueAt = new Date(start.getTime() + thresholdMinutes * 60000);
  const completed = parseDate(completedAt);
  const reference = completed || now;
  const remainingMinutes = Math.ceil((dueAt.getTime() - reference.getTime()) / 60000);
  const breachMinutes = Math.max(0, Math.ceil((reference.getTime() - dueAt.getTime()) / 60000));
  const state = completed
    ? 'completed'
    : breachMinutes > 0
      ? 'breached'
      : remainingMinutes <= warningMinutes
        ? 'warning'
        : 'normal';

  return {
    stage,
    due_at: dueAt,
    remaining_minutes: completed ? 0 : remainingMinutes,
    breached_minutes: breachMinutes,
    state,
    threshold_minutes: thresholdMinutes,
    warning_minutes: warningMinutes,
    started_at: start,
    completed_at: completed,
  };
}

function pushAction(actions, action, permission, actor) {
  if (!permission || hasAnyPermission(actor, Array.isArray(permission) ? permission : [permission])) {
    actions.push(action);
  }
}

function escalationKey(entityType, entityId) {
  return `${entityType}:${toId(entityId)}`;
}

async function loadOpenEscalationMap(descriptors = []) {
  const byType = descriptors.reduce((acc, item) => {
    if (!item.entity_type || !item.entity_id) return acc;
    const key = item.entity_type;
    acc[key] = acc[key] || [];
    acc[key].push(item.entity_id);
    return acc;
  }, {});
  const clauses = Object.entries(byType)
    .filter(([, ids]) => ids.length)
    .map(([entityType, ids]) => ({ entity_type: entityType, entity_id: { $in: ids } }));
  if (!clauses.length) return new Map();
  const rows = await ClinicalOpsEscalation.find({
    $or: clauses,
    status: { $in: OPEN_ESCALATION_STATUSES },
  })
    .populate('escalated_by', 'full_name username employee_code')
    .populate('escalated_to', 'full_name username employee_code')
    .sort({ escalated_at: -1 })
    .lean();
  const map = new Map();
  for (const row of rows) {
    const key = escalationKey(row.entity_type, row.entity_id);
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

function attachEscalation(row, escalationMap) {
  const escalation = escalationMap.get(escalationKey(row.entity_type, row.entity_id));
  if (!escalation) return row;
  return {
    ...row,
    escalation: {
      id: toId(escalation),
      status: escalation.status,
      level: escalation.escalation_level,
      reason: escalation.reason,
      escalated_at: escalation.escalated_at,
      escalated_by: person(escalation.escalated_by),
      escalated_to: (escalation.escalated_to || []).map((item) => person(item)).filter(Boolean),
    },
    warnings: [...(row.warnings || []), 'escalated'],
  };
}

function getLatestByDate(rows = [], dateFields = ['updated_at', 'created_at']) {
  return [...rows].sort((left, right) => {
    const leftDate = timestampMax(...dateFields.map((field) => left[field])) || new Date(0);
    const rightDate = timestampMax(...dateFields.map((field) => right[field])) || new Date(0);
    return rightDate.getTime() - leftDate.getTime();
  })[0] || null;
}

function groupById(rows = [], fieldName) {
  const map = new Map();
  for (const row of rows) {
    const id = toId(row[fieldName]);
    if (!id) continue;
    const list = map.get(id) || [];
    list.push(row);
    map.set(id, list);
  }
  return map;
}

function hasActiveAttachment(rows = []) {
  return rows.some((attachment) => ACTIVE_ATTACHMENT_STATUSES.includes(attachment.status));
}

function attachmentIssueCount(rows = []) {
  return rows.filter((attachment) => (
    ['failed', 'infected'].includes(attachment.scan_status)
    || ['pending', 'rejected'].includes(attachment.review_status)
  )).length;
}

function hasActiveCharge(rows = []) {
  return rows.some((charge) => !ACTIVE_CHARGE_EXCLUDED_STATUSES.includes(charge.status));
}

function labStage(order, specimen, result) {
  if (result?.status === LAB_RESULT_STATUS.PRELIMINARY) return ['result_preliminary', 'Kết quả sơ bộ, chờ duyệt'];
  if ([LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED].includes(result?.status)) return ['result_final', 'Đã có kết quả cuối'];
  if (specimen?.status === SPECIMEN_STATUS.REJECTED || order.status === LAB_ORDER_STATUS.REJECTED) return ['specimen_rejected', 'Mẫu bị từ chối'];
  if (specimen?.status === SPECIMEN_STATUS.IN_TESTING || order.status === LAB_ORDER_STATUS.IN_PROGRESS) return ['in_testing', 'Đang xét nghiệm'];
  if (specimen?.status === SPECIMEN_STATUS.RECEIVED || order.status === LAB_ORDER_STATUS.RECEIVED) return ['waiting_process', 'Mẫu đã nhận, chờ chạy'];
  if (specimen?.status === SPECIMEN_STATUS.COLLECTED || order.status === LAB_ORDER_STATUS.COLLECTED) return ['waiting_receive', 'Mẫu đã lấy, chờ nhận'];
  if (order.status === LAB_ORDER_STATUS.COMPLETED) return ['completed', 'Hoàn tất xét nghiệm'];
  if (order.status === LAB_ORDER_STATUS.CANCELLED) return ['cancelled', 'Đã hủy'];
  return ['waiting_collection', 'Chờ lấy mẫu'];
}

function labNextAction(order, specimen, result) {
  if (result?.status === LAB_RESULT_STATUS.PRELIMINARY) return 'finalize_lab_result';
  if (specimen?.status === SPECIMEN_STATUS.COLLECTED || order.status === LAB_ORDER_STATUS.COLLECTED) return 'receive_specimen';
  if (specimen?.status === SPECIMEN_STATUS.RECEIVED || order.status === LAB_ORDER_STATUS.RECEIVED) return 'process_specimen';
  if (specimen?.status === SPECIMEN_STATUS.IN_TESTING || order.status === LAB_ORDER_STATUS.IN_PROGRESS) return result ? 'update_lab_result' : 'create_lab_result';
  if (order.status === LAB_ORDER_STATUS.ORDERED) return 'collect_specimen';
  return 'open_timeline';
}

function labSla(order, specimen, result, rules) {
  if (result?.is_critical && !result.critical_acknowledged_at) {
    return buildSla({
      module: 'lab',
      stage: 'critical_acknowledgement',
      priority: order.priority,
      startedAt: result.critical_notified_at || result.reported_at || result.created_at,
      completedAt: result.critical_acknowledged_at,
      rules,
    });
  }
  if (result?.status === LAB_RESULT_STATUS.PRELIMINARY) {
    return buildSla({ module: 'lab', stage: 'preliminary_to_final', priority: order.priority, startedAt: result.reported_at || result.created_at, completedAt: result.verified_at, rules });
  }
  if (specimen?.status === SPECIMEN_STATUS.IN_TESTING || order.status === LAB_ORDER_STATUS.IN_PROGRESS) {
    return buildSla({ module: 'lab', stage: 'testing_to_preliminary', priority: order.priority, startedAt: specimen?.received_at || order.updated_at || order.ordered_at, completedAt: result?.reported_at, rules });
  }
  if (specimen?.status === SPECIMEN_STATUS.RECEIVED || order.status === LAB_ORDER_STATUS.RECEIVED) {
    return buildSla({ module: 'lab', stage: 'received_to_testing', priority: order.priority, startedAt: specimen?.received_at || order.updated_at, completedAt: specimen?.updated_at && specimen?.status === SPECIMEN_STATUS.IN_TESTING ? specimen.updated_at : null, rules });
  }
  if (specimen?.status === SPECIMEN_STATUS.COLLECTED || order.status === LAB_ORDER_STATUS.COLLECTED) {
    return buildSla({ module: 'lab', stage: 'collected_to_received', priority: order.priority, startedAt: specimen?.collected_at || order.collected_at || order.updated_at, completedAt: specimen?.received_at, rules });
  }
  return buildSla({ module: 'lab', stage: 'ordered_to_collection', priority: order.priority, startedAt: order.ordered_at, completedAt: specimen?.collected_at || order.collected_at, rules });
}

function labAllowedActions(order, specimen, result, actor = {}) {
  const actions = ['open_timeline'];
  if (order.status === LAB_ORDER_STATUS.ORDERED) {
    pushAction(actions, 'acknowledge', [PERMISSION.LAB_ORDERS.ACKNOWLEDGE, PERMISSION.ORDERS.ACKNOWLEDGE], actor);
    pushAction(actions, 'collect_specimen', [PERMISSION.SPECIMENS.COLLECT, PERMISSION.LAB_ORDERS.COLLECT], actor);
  }
  if (specimen?.status === SPECIMEN_STATUS.COLLECTED || order.status === LAB_ORDER_STATUS.COLLECTED) {
    pushAction(actions, 'receive_specimen', PERMISSION.SPECIMENS.RECEIVE, actor);
    pushAction(actions, 'reject_specimen', PERMISSION.SPECIMENS.REJECT, actor);
  }
  if (specimen?.status === SPECIMEN_STATUS.RECEIVED || order.status === LAB_ORDER_STATUS.RECEIVED) {
    pushAction(actions, 'process_specimen', [PERMISSION.SPECIMENS.PROCESS, PERMISSION.LAB_ORDERS.PROCESS], actor);
    pushAction(actions, 'create_lab_result', PERMISSION.LAB_RESULTS.CREATE, actor);
  }
  if (order.status === LAB_ORDER_STATUS.IN_PROGRESS) {
    pushAction(actions, result ? 'update_lab_result' : 'create_lab_result', [PERMISSION.LAB_RESULTS.WRITE, PERMISSION.LAB_RESULTS.CREATE], actor);
  }
  if (result?.status === LAB_RESULT_STATUS.PRELIMINARY) {
    pushAction(actions, 'finalize', PERMISSION.LAB_RESULTS.FINALIZE, actor);
    pushAction(actions, 'amend', PERMISSION.LAB_RESULTS.AMEND, actor);
  }
  if (result?.is_critical && !result.critical_acknowledged_at) {
    pushAction(actions, 'acknowledge_critical', [PERMISSION.LAB_RESULTS.CRITICAL_ACKNOWLEDGE, PERMISSION.LAB_RESULTS.READ_FINAL], actor);
  }
  pushAction(actions, 'escalate', null, actor);
  return [...new Set(actions)];
}

function buildLabRow(order, related = {}, rules, actor = {}) {
  const specimens = related.specimensByOrder.get(toId(order)) || [];
  const results = related.resultsByOrder.get(toId(order)) || [];
  const specimen = getLatestByDate(specimens, ['received_at', 'collected_at', 'updated_at', 'created_at']);
  const result = getLatestByDate(results, ['verified_at', 'reported_at', 'updated_at', 'created_at']);
  const [stageCode, stageLabel] = labStage(order, specimen, result);
  const sla = labSla(order, specimen, result, rules);
  const warnings = [];
  if (result?.is_critical && !result.critical_acknowledged_at) warnings.push('critical_unacknowledged');
  if (specimen?.status === SPECIMEN_STATUS.REJECTED) warnings.push('specimen_rejected');
  if (sla?.state === 'warning') warnings.push('sla_warning');
  if (sla?.state === 'breached') warnings.push('sla_breached');

  return {
    work_item_id: `lab_order:${toId(order)}`,
    module: 'lab',
    entity_type: 'lab_order',
    entity_id: toId(order),
    order_id: toId(order.order_id),
    order_no: order.lab_order_no,
    parent_order_no: order.order_id?.order_no,
    priority: order.priority,
    status: order.status,
    title: order.test_name,
    service_label: order.test_name,
    clinical_indication: order.clinical_note || order.order_id?.clinical_indication,
    stage_code: stageCode,
    stage_label: stageLabel,
    next_action: labNextAction(order, specimen, result),
    allowed_actions: labAllowedActions(order, specimen, result, actor),
    patient: patient(order.patient_id),
    encounter: encounter(order.encounter_id),
    ordered_by: person(order.ordered_by),
    owner: person(result?.performed_by || specimen?.received_by || specimen?.collected_by || order.ordered_by),
    department: department(order.order_id?.department_id),
    ordered_at: order.ordered_at,
    last_update_at: timestampMax(order.updated_at, specimen?.updated_at, result?.updated_at, result?.reported_at),
    sla,
    missing: [],
    warnings,
    result: result ? {
      id: toId(result),
      result_no: result.result_no,
      status: result.status,
      is_critical: Boolean(result.is_critical),
      reported_at: result.reported_at,
      verified_at: result.verified_at,
      released_to_patient: Boolean(result.released_to_patient),
    } : null,
    specimen: specimen ? {
      id: toId(specimen),
      specimen_no: specimen.specimen_no,
      status: specimen.status,
      collected_at: specimen.collected_at,
      received_at: specimen.received_at,
    } : null,
  };
}

function imagingStage(order, report, attachments = []) {
  if (report?.status === IMAGING_REPORT_STATUS.FINAL || report?.status === IMAGING_REPORT_STATUS.AMENDED) return ['report_final', 'Báo cáo đã ký'];
  if (report?.status === IMAGING_REPORT_STATUS.PRELIMINARY) return ['report_preliminary', 'Báo cáo sơ bộ, chờ ký'];
  if (report?.status === IMAGING_REPORT_STATUS.DRAFT) return ['report_draft', 'Báo cáo nháp'];
  if (order.status === IMAGING_ORDER_STATUS.COMPLETED && !hasActiveAttachment(attachments)) return ['imaging_missing_file', 'Hoàn tất kỹ thuật, thiếu tệp'];
  if (order.status === IMAGING_ORDER_STATUS.COMPLETED) return ['technical_completed', 'Hoàn tất kỹ thuật, chờ đọc'];
  if (order.status === IMAGING_ORDER_STATUS.IN_PROGRESS) return ['in_progress', 'Đang thực hiện'];
  if (order.status === IMAGING_ORDER_STATUS.SCHEDULED) return ['scheduled', 'Đã xếp lịch'];
  if (order.status === IMAGING_ORDER_STATUS.NO_SHOW) return ['no_show', 'Không đến thực hiện'];
  if (order.status === IMAGING_ORDER_STATUS.CANCELLED) return ['cancelled', 'Đã hủy'];
  return ['waiting_schedule', 'Chờ xếp lịch'];
}

function imagingNextAction(order, report, attachments = []) {
  if (report?.status === IMAGING_REPORT_STATUS.PRELIMINARY || report?.status === IMAGING_REPORT_STATUS.DRAFT) return 'finalize_imaging_report';
  if (order.status === IMAGING_ORDER_STATUS.COMPLETED && !report) return 'create_imaging_report';
  if (order.status === IMAGING_ORDER_STATUS.COMPLETED && !hasActiveAttachment(attachments)) return 'upload_imaging_file';
  if (order.status === IMAGING_ORDER_STATUS.IN_PROGRESS) return 'complete_imaging_order';
  if (order.status === IMAGING_ORDER_STATUS.SCHEDULED) return 'start_imaging_order';
  if (order.status === IMAGING_ORDER_STATUS.ORDERED) return 'schedule_imaging_order';
  return 'open_timeline';
}

function imagingSla(order, report, rules) {
  if (report?.is_critical && !report.critical_acknowledged_at) {
    return buildSla({
      module: 'imaging',
      stage: 'critical_acknowledgement',
      priority: order.priority,
      startedAt: report.critical_notified_at || report.reported_at || report.created_at,
      completedAt: report.critical_acknowledged_at,
      rules,
    });
  }
  if (report?.status === IMAGING_REPORT_STATUS.PRELIMINARY || report?.status === IMAGING_REPORT_STATUS.DRAFT) {
    return buildSla({ module: 'imaging', stage: 'report_to_final', priority: order.priority, startedAt: report.reported_at || report.created_at, completedAt: report.verified_at, rules });
  }
  if (order.status === IMAGING_ORDER_STATUS.COMPLETED) {
    return buildSla({ module: 'imaging', stage: 'completed_to_report', priority: order.priority, startedAt: order.completed_at || order.updated_at, completedAt: report?.reported_at || report?.created_at, rules });
  }
  if (order.status === IMAGING_ORDER_STATUS.IN_PROGRESS) {
    return buildSla({ module: 'imaging', stage: 'started_to_completed', priority: order.priority, startedAt: order.started_at || order.updated_at, completedAt: order.completed_at, rules });
  }
  if (order.status === IMAGING_ORDER_STATUS.SCHEDULED) {
    return buildSla({ module: 'imaging', stage: 'scheduled_to_started', priority: order.priority, startedAt: order.scheduled_at || order.updated_at, completedAt: order.started_at, rules });
  }
  return buildSla({ module: 'imaging', stage: 'ordered_to_scheduled', priority: order.priority, startedAt: order.ordered_at, completedAt: order.scheduled_at, rules });
}

function imagingAllowedActions(order, report, actor = {}) {
  const actions = ['open_timeline'];
  if (order.status === IMAGING_ORDER_STATUS.ORDERED) {
    pushAction(actions, 'schedule', [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE], actor);
  }
  if (order.status === IMAGING_ORDER_STATUS.SCHEDULED) {
    pushAction(actions, 'start', [PERMISSION.IMAGING_ORDERS.START, PERMISSION.ORDERS.START], actor);
  }
  if (order.status === IMAGING_ORDER_STATUS.IN_PROGRESS) {
    pushAction(actions, 'complete', [PERMISSION.IMAGING_ORDERS.COMPLETE, PERMISSION.ORDERS.COMPLETE], actor);
  }
  if (order.status === IMAGING_ORDER_STATUS.COMPLETED) {
    pushAction(actions, 'upload_file', [PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD], actor);
    pushAction(actions, 'create_report', PERMISSION.IMAGING_REPORTS.CREATE, actor);
  }
  if (report?.status === IMAGING_REPORT_STATUS.DRAFT || report?.status === IMAGING_REPORT_STATUS.PRELIMINARY) {
    pushAction(actions, 'finalize', PERMISSION.IMAGING_REPORTS.FINALIZE, actor);
    pushAction(actions, 'amend', PERMISSION.IMAGING_REPORTS.AMEND, actor);
  }
  if (report?.is_critical && !report.critical_acknowledged_at) {
    pushAction(actions, 'acknowledge_critical', [PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE, PERMISSION.IMAGING_REPORTS.READ_FINAL], actor);
  }
  pushAction(actions, 'escalate', null, actor);
  return [...new Set(actions)];
}

function buildImagingRow(order, related = {}, rules, actor = {}) {
  const reports = related.reportsByOrder.get(toId(order)) || [];
  const attachments = related.attachmentsByOrder.get(toId(order.order_id)) || [];
  const report = getLatestByDate(reports, ['verified_at', 'reported_at', 'updated_at', 'created_at']);
  const [stageCode, stageLabel] = imagingStage(order, report, attachments);
  const sla = imagingSla(order, report, rules);
  const missing = [];
  const warnings = [];
  if (order.status === IMAGING_ORDER_STATUS.COMPLETED && !hasActiveAttachment(attachments)) missing.push('file');
  const issueCount = attachmentIssueCount(attachments);
  if (issueCount > 0) warnings.push('file_issue');
  if (report?.is_critical && !report.critical_acknowledged_at) warnings.push('critical_unacknowledged');
  if (sla?.state === 'warning') warnings.push('sla_warning');
  if (sla?.state === 'breached') warnings.push('sla_breached');

  return {
    work_item_id: `imaging_order:${toId(order)}`,
    module: 'imaging',
    entity_type: 'imaging_order',
    entity_id: toId(order),
    order_id: toId(order.order_id),
    order_no: order.imaging_order_no,
    parent_order_no: order.order_id?.order_no,
    priority: order.priority,
    status: order.status,
    title: [order.modality, order.body_part].filter(Boolean).join(' - '),
    service_label: [order.modality, order.body_part].filter(Boolean).join(' - '),
    clinical_indication: order.clinical_indication || order.order_id?.clinical_indication,
    stage_code: stageCode,
    stage_label: stageLabel,
    next_action: imagingNextAction(order, report, attachments),
    allowed_actions: imagingAllowedActions(order, report, actor),
    patient: patient(order.patient_id),
    encounter: encounter(order.encounter_id),
    ordered_by: person(order.ordered_by),
    owner: person(report?.radiologist_id || order.completed_by || order.started_by || order.scheduled_by || order.ordered_by),
    department: department(order.order_id?.department_id),
    room_id: toId(order.room_id),
    ordered_at: order.ordered_at,
    scheduled_at: order.scheduled_at,
    last_update_at: timestampMax(order.updated_at, report?.updated_at, report?.reported_at),
    sla,
    missing,
    warnings,
    report: report ? {
      id: toId(report),
      report_no: report.report_no,
      status: report.status,
      is_critical: Boolean(report.is_critical),
      critical_finding: report.critical_finding,
      reported_at: report.reported_at,
      verified_at: report.verified_at,
      released_to_patient: Boolean(report.released_to_patient),
    } : null,
    attachments: {
      count: attachments.length,
      issue_count: issueCount,
    },
  };
}

function procedureStage(order, attachments = [], charges = []) {
  const missing = [];
  if (order.status === PROCEDURE_STATUS.COMPLETED && !normalizeString(order.result_note)) missing.push('result_note');
  if (order.status === PROCEDURE_STATUS.COMPLETED && !hasActiveAttachment(attachments)) missing.push('file');
  if (order.status === PROCEDURE_STATUS.COMPLETED && !hasActiveCharge(charges)) missing.push('charge');
  if (missing.length) return [`procedure_missing_${missing[0]}`, `Hoàn tất thủ thuật, thiếu ${missing.join(', ')}`];
  if (order.status === PROCEDURE_STATUS.COMPLETED) return ['completed', 'Hoàn tất thủ thuật'];
  if (order.status === PROCEDURE_STATUS.IN_PROGRESS) return ['in_progress', 'Đang thực hiện thủ thuật'];
  if (order.status === PROCEDURE_STATUS.SCHEDULED) return ['scheduled', 'Đã xếp lịch thủ thuật'];
  if (order.status === PROCEDURE_STATUS.NO_SHOW) return ['no_show', 'Không đến thực hiện'];
  if (order.status === PROCEDURE_STATUS.CANCELLED) return ['cancelled', 'Đã hủy'];
  return ['waiting_schedule', 'Chờ xếp lịch thủ thuật'];
}

function procedureNextAction(order, attachments = [], charges = []) {
  if (order.status === PROCEDURE_STATUS.COMPLETED && !normalizeString(order.result_note)) return 'add_result_note';
  if (order.status === PROCEDURE_STATUS.COMPLETED && !hasActiveAttachment(attachments)) return 'upload_procedure_file';
  if (order.status === PROCEDURE_STATUS.COMPLETED && !hasActiveCharge(charges)) return 'create_procedure_charge';
  if (order.status === PROCEDURE_STATUS.IN_PROGRESS) return 'complete_procedure';
  if (order.status === PROCEDURE_STATUS.SCHEDULED) return 'start_procedure';
  if (order.status === PROCEDURE_STATUS.ORDERED) return 'schedule_procedure';
  return 'open_timeline';
}

function procedureSla(order, attachments = [], charges = [], rules) {
  if (order.status === PROCEDURE_STATUS.COMPLETED && !normalizeString(order.result_note)) {
    return buildSla({ module: 'procedure', stage: 'completed_to_result_note', priority: order.priority, startedAt: order.completed_at || order.updated_at, completedAt: normalizeString(order.result_note) ? order.updated_at : null, rules });
  }
  if (order.status === PROCEDURE_STATUS.COMPLETED && !hasActiveAttachment(attachments)) {
    return buildSla({ module: 'procedure', stage: 'completed_to_file', priority: order.priority, startedAt: order.completed_at || order.updated_at, completedAt: hasActiveAttachment(attachments) ? attachments[0]?.created_at : null, rules });
  }
  if (order.status === PROCEDURE_STATUS.COMPLETED && !hasActiveCharge(charges)) {
    return buildSla({ module: 'procedure', stage: 'completed_to_charge', priority: order.priority, startedAt: order.completed_at || order.updated_at, completedAt: hasActiveCharge(charges) ? charges[0]?.created_at : null, rules });
  }
  if (order.status === PROCEDURE_STATUS.IN_PROGRESS) {
    return buildSla({ module: 'procedure', stage: 'started_to_completed', priority: order.priority, startedAt: order.performed_start || order.started_at || order.updated_at, completedAt: order.completed_at, rules });
  }
  if (order.status === PROCEDURE_STATUS.SCHEDULED) {
    return buildSla({ module: 'procedure', stage: 'scheduled_to_started', priority: order.priority, startedAt: order.scheduled_start || order.scheduled_at || order.updated_at, completedAt: order.performed_start || order.started_at, rules });
  }
  return buildSla({ module: 'procedure', stage: 'ordered_to_scheduled', priority: order.priority, startedAt: order.order_id?.ordered_at || order.created_at, completedAt: order.scheduled_at || order.scheduled_start, rules });
}

function procedureAllowedActions(order, actor = {}) {
  const actions = ['open_timeline'];
  if (order.status === PROCEDURE_STATUS.ORDERED) pushAction(actions, 'schedule', [PERMISSION.PROCEDURE_ORDERS.SCHEDULE, PERMISSION.ORDERS.ACKNOWLEDGE], actor);
  if (order.status === PROCEDURE_STATUS.SCHEDULED) pushAction(actions, 'start', [PERMISSION.PROCEDURE_ORDERS.START, PERMISSION.ORDERS.START], actor);
  if (order.status === PROCEDURE_STATUS.IN_PROGRESS) pushAction(actions, 'complete', [PERMISSION.PROCEDURE_ORDERS.COMPLETE, PERMISSION.ORDERS.COMPLETE], actor);
  if (order.status === PROCEDURE_STATUS.COMPLETED) {
    pushAction(actions, 'upload_file', [PERMISSION.ATTACHMENTS.UPLOAD_PROCEDURE, PERMISSION.ATTACHMENTS.UPLOAD], actor);
    pushAction(actions, 'create_charge', [PERMISSION.PROCEDURE_ORDERS.CHARGE_CREATE, PERMISSION.CHARGES.CREATE, PERMISSION.CHARGES.REQUEST_CREATE, PERMISSION.ORDERS.CREATE_CHARGE], actor);
  }
  pushAction(actions, 'escalate', null, actor);
  return [...new Set(actions)];
}

function buildProcedureRow(order, related = {}, rules, actor = {}) {
  const attachments = related.attachmentsByOrder.get(toId(order.order_id)) || [];
  const charges = related.chargesByOrder.get(toId(order.order_id)) || [];
  const [stageCode, stageLabel] = procedureStage(order, attachments, charges);
  const sla = procedureSla(order, attachments, charges, rules);
  const missing = [];
  const warnings = [];
  if (order.status === PROCEDURE_STATUS.COMPLETED && !normalizeString(order.result_note)) missing.push('result_note');
  if (order.status === PROCEDURE_STATUS.COMPLETED && !hasActiveAttachment(attachments)) missing.push('file');
  if (order.status === PROCEDURE_STATUS.COMPLETED && !hasActiveCharge(charges)) missing.push('charge');
  const issueCount = attachmentIssueCount(attachments);
  if (issueCount > 0) warnings.push('file_issue');
  if (sla?.state === 'warning') warnings.push('sla_warning');
  if (sla?.state === 'breached') warnings.push('sla_breached');

  return {
    work_item_id: `procedure_order:${toId(order)}`,
    module: 'procedure',
    entity_type: 'procedure_order',
    entity_id: toId(order),
    order_id: toId(order.order_id),
    order_no: order.procedure_order_no,
    parent_order_no: order.order_id?.order_no,
    priority: order.priority,
    status: order.status,
    title: order.procedure_name,
    service_label: order.procedure_name,
    clinical_indication: order.clinical_indication || order.order_id?.clinical_indication,
    stage_code: stageCode,
    stage_label: stageLabel,
    next_action: procedureNextAction(order, attachments, charges),
    allowed_actions: procedureAllowedActions(order, actor),
    patient: patient(order.patient_id),
    encounter: encounter(order.encounter_id),
    ordered_by: person(order.requested_by),
    owner: person(order.performer_id || order.completed_by || order.started_by || order.scheduled_by || order.requested_by),
    department: department(order.department_id || order.order_id?.department_id),
    ordered_at: order.order_id?.ordered_at || order.created_at,
    scheduled_at: order.scheduled_start || order.scheduled_at,
    last_update_at: timestampMax(order.updated_at, order.completed_at, order.performed_end),
    sla,
    missing,
    warnings,
    procedure: {
      code: order.procedure_code,
      result_note: order.result_note,
      completed_at: order.completed_at,
      no_show_at: order.no_show_at,
    },
    attachments: {
      count: attachments.length,
      issue_count: issueCount,
    },
    charges: {
      count: charges.length,
      has_active_charge: hasActiveCharge(charges),
    },
  };
}

async function loadLabRows(query = {}, actor = {}, options = {}) {
  const range = options.dateRange || buildDateRange(query, { defaultToday: options.defaultToday });
  const filter = {};
  if (query.status) filter.status = query.status;
  const priority = normalizePriority(query.priority);
  if (priority) filter.priority = priority;
  if (query.patient_id) filter.patient_id = query.patient_id;
  if (query.encounter_id) filter.encounter_id = query.encounter_id;
  applyDateFilter(filter, 'ordered_at', range);
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [
      { lab_order_no: { $regex: keyword, $options: 'i' } },
      { test_name: { $regex: keyword, $options: 'i' } },
      { test_code: { $regex: keyword, $options: 'i' } },
    ];
  }
  const parentIds = await scopedParentOrderIds('lab', query, actor);
  if (parentIds) filter.order_id = { $in: parentIds };
  if (options.activeOnly) filter.status = { $nin: [LAB_ORDER_STATUS.COMPLETED, LAB_ORDER_STATUS.CANCELLED, LAB_ORDER_STATUS.REJECTED] };

  let queryBuilder = LabOrder.find(filter)
    .sort(options.sort || { ordered_at: -1 })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id attending_doctor_id')
    .populate('ordered_by', 'full_name username employee_code department_id')
    .populate('order_id', 'order_no status priority department_id ordered_at clinical_indication charge_id');

  if (options.limit !== 0) queryBuilder = queryBuilder.limit(options.limit || limitFromQuery(query));
  const orders = await queryBuilder.lean();
  const orderIds = orders.map((item) => item._id);
  const [specimens, results] = await Promise.all([
    orderIds.length ? Specimen.find({ lab_order_id: { $in: orderIds } })
      .populate('collected_by', 'full_name username employee_code')
      .populate('received_by', 'full_name username employee_code')
      .sort({ created_at: 1 }).lean() : [],
    orderIds.length ? LabResult.find({ lab_order_id: { $in: orderIds }, is_current: { $ne: false } })
      .populate('performed_by', 'full_name username employee_code')
      .populate('verified_by', 'full_name username employee_code')
      .sort({ reported_at: -1, created_at: -1 }).lean() : [],
  ]);
  const related = {
    specimensByOrder: groupById(specimens, 'lab_order_id'),
    resultsByOrder: groupById(results, 'lab_order_id'),
  };
  const rules = options.rules || await loadSlaRuleMap();
  return orders.map((order) => buildLabRow(order, related, rules, actor));
}

async function loadImagingRows(query = {}, actor = {}, options = {}) {
  const range = options.dateRange || buildDateRange(query, { defaultToday: options.defaultToday });
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.modality) filter.modality = query.modality;
  const priority = normalizePriority(query.priority);
  if (priority) filter.priority = priority;
  if (query.patient_id) filter.patient_id = query.patient_id;
  if (query.encounter_id) filter.encounter_id = query.encounter_id;
  applyDateFilter(filter, 'ordered_at', range);
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [
      { imaging_order_no: { $regex: keyword, $options: 'i' } },
      { modality: { $regex: keyword, $options: 'i' } },
      { body_part: { $regex: keyword, $options: 'i' } },
    ];
  }
  const parentIds = await scopedParentOrderIds('imaging', query, actor);
  if (parentIds) filter.order_id = { $in: parentIds };
  if (options.activeOnly) filter.status = { $nin: [IMAGING_ORDER_STATUS.COMPLETED, IMAGING_ORDER_STATUS.CANCELLED, IMAGING_ORDER_STATUS.NO_SHOW] };

  let queryBuilder = ImagingOrder.find(filter)
    .sort(options.sort || { scheduled_at: 1, ordered_at: -1 })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id attending_doctor_id')
    .populate('ordered_by', 'full_name username employee_code department_id')
    .populate('scheduled_by', 'full_name username employee_code')
    .populate('started_by', 'full_name username employee_code')
    .populate('completed_by', 'full_name username employee_code')
    .populate('order_id', 'order_no status priority department_id ordered_at clinical_indication charge_id');

  if (options.limit !== 0) queryBuilder = queryBuilder.limit(options.limit || limitFromQuery(query));
  const orders = await queryBuilder.lean();
  const orderIds = orders.map((item) => item._id);
  const parentOrderIds = orders.map((item) => item.order_id?._id || item.order_id).filter(Boolean);
  const [reports, attachments] = await Promise.all([
    orderIds.length ? ImagingReport.find({ imaging_order_id: { $in: orderIds } })
      .populate('radiologist_id', 'full_name username employee_code')
      .populate('verified_by', 'full_name username employee_code')
      .sort({ verified_at: -1, reported_at: -1, created_at: -1 }).lean() : [],
    parentOrderIds.length ? Attachment.find({
      order_id: { $in: parentOrderIds },
      status: { $in: ACTIVE_ATTACHMENT_STATUSES },
    }).sort({ created_at: -1 }).lean() : [],
  ]);
  const related = {
    reportsByOrder: groupById(reports, 'imaging_order_id'),
    attachmentsByOrder: groupById(attachments, 'order_id'),
  };
  const rules = options.rules || await loadSlaRuleMap();
  return orders.map((order) => buildImagingRow(order, related, rules, actor));
}

async function loadProcedureRows(query = {}, actor = {}, options = {}) {
  const range = options.dateRange || buildDateRange(query, { defaultToday: options.defaultToday });
  const filter = {};
  if (query.status) filter.status = query.status;
  const priority = normalizePriority(query.priority);
  if (priority) filter.priority = priority;
  if (query.patient_id) filter.patient_id = query.patient_id;
  if (query.encounter_id) filter.encounter_id = query.encounter_id;
  if (query.department_id) filter.department_id = query.department_id;
  applyDateFilter(filter, 'created_at', range);
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [
      { procedure_order_no: { $regex: keyword, $options: 'i' } },
      { procedure_name: { $regex: keyword, $options: 'i' } },
      { procedure_code: { $regex: keyword, $options: 'i' } },
    ];
  }
  const scope = resolveEffectiveScope('procedure', query, actor);
  if (scope === 'none') throw ApiError.forbidden('Bạn không có quyền xem dữ liệu procedure.');
  if (scope === 'department' && actor.departmentId) filter.department_id = actor.departmentId;
  if (scope === 'mine' && actor.userId) filter.requested_by = actor.userId;
  if (options.activeOnly) filter.status = { $nin: [PROCEDURE_STATUS.COMPLETED, PROCEDURE_STATUS.CANCELLED, PROCEDURE_STATUS.NO_SHOW] };

  let queryBuilder = ProcedureOrder.find(filter)
    .sort(options.sort || { scheduled_start: 1, created_at: -1 })
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id attending_doctor_id')
    .populate('requested_by', 'full_name username employee_code department_id')
    .populate('performer_id', 'full_name username employee_code department_id')
    .populate('scheduled_by', 'full_name username employee_code')
    .populate('started_by', 'full_name username employee_code')
    .populate('completed_by', 'full_name username employee_code')
    .populate('department_id', 'department_code department_name')
    .populate('order_id', 'order_no status priority department_id ordered_at service_id charge_id is_billable clinical_indication');

  if (options.limit !== 0) queryBuilder = queryBuilder.limit(options.limit || limitFromQuery(query));
  const orders = await queryBuilder.lean();
  const parentOrderIds = orders.map((item) => item.order_id?._id || item.order_id).filter(Boolean);
  const [attachments, charges] = await Promise.all([
    parentOrderIds.length ? Attachment.find({
      order_id: { $in: parentOrderIds },
      status: { $in: ACTIVE_ATTACHMENT_STATUSES },
    }).sort({ created_at: -1 }).lean() : [],
    parentOrderIds.length ? Charge.find({
      order_id: { $in: parentOrderIds },
      status: { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES },
    }).sort({ charged_at: -1, created_at: -1 }).lean() : [],
  ]);
  const related = {
    attachmentsByOrder: groupById(attachments, 'order_id'),
    chargesByOrder: groupById(charges, 'order_id'),
  };
  const rules = options.rules || await loadSlaRuleMap();
  return orders.map((order) => buildProcedureRow(order, related, rules, actor));
}

async function loadRows(query = {}, actor = {}, options = {}) {
  assertStaffRead(actor);
  const modules = requestedModules(query);
  const rules = options.rules || await loadSlaRuleMap();
  const loaders = {
    lab: () => loadLabRows(query, actor, { ...options, rules }),
    imaging: () => loadImagingRows(query, actor, { ...options, rules }),
    procedure: () => loadProcedureRows(query, actor, { ...options, rules }),
  };
  const nestedRows = await Promise.all(modules.map((module) => loaders[module]()));
  const rows = nestedRows.flat();
  const escalationMap = await loadOpenEscalationMap(rows.map((row) => ({
    entity_type: row.entity_type,
    entity_id: row.entity_id,
  })));
  return rows.map((row) => attachEscalation(row, escalationMap));
}

function summarizeRows(rows = []) {
  const summary = {
    total: rows.length,
    stat: 0,
    urgent: 0,
    routine: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
    sla_warning: 0,
    sla_breached: 0,
    overdue: 0,
    critical_unacknowledged: 0,
    missing_file: 0,
    file_issue: 0,
  };
  for (const row of rows) {
    if (row.priority === ORDER_PRIORITY.STAT) summary.stat += 1;
    if (row.priority === ORDER_PRIORITY.URGENT) summary.urgent += 1;
    if (row.priority === ORDER_PRIORITY.ROUTINE) summary.routine += 1;
    if (row.status === 'in_progress') summary.in_progress += 1;
    if (row.status === 'completed') summary.completed += 1;
    if (row.status === 'cancelled') summary.cancelled += 1;
    if (row.status === 'no_show') summary.no_show += 1;
    if (row.sla?.state === 'warning') summary.sla_warning += 1;
    if (row.sla?.state === 'breached') {
      summary.sla_breached += 1;
      summary.overdue += 1;
    }
    if (row.warnings?.includes('critical_unacknowledged')) summary.critical_unacknowledged += 1;
    if (row.missing?.includes('file')) summary.missing_file += 1;
    if (row.warnings?.includes('file_issue')) summary.file_issue += 1;
  }
  return summary;
}

function filterRows(rows = [], query = {}) {
  return rows.filter((row) => {
    if (query.status_group === 'waiting_action' && !['ordered', 'scheduled', 'collected', 'received'].includes(row.status)) return false;
    if (query.status_group === 'in_progress' && row.status !== 'in_progress') return false;
    if (query.status_group === 'pending_result' && !['result_preliminary', 'technical_completed', 'report_draft', 'report_preliminary'].includes(row.stage_code)) return false;
    if (query.status_group === 'pending_sign' && !['result_preliminary', 'report_draft', 'report_preliminary'].includes(row.stage_code)) return false;
    if (query.sla === 'warning' && row.sla?.state !== 'warning') return false;
    if (query.sla === 'breached' && row.sla?.state !== 'breached') return false;
    if (query.sla === 'normal' && row.sla?.state !== 'normal') return false;
    return true;
  });
}

async function getTodayWorklist(query = {}, actor = {}) {
  const rows = await loadRows(query, actor, {
    dateRange: buildDateRange(query, { defaultToday: true }),
    limit: limitFromQuery(query, 160, 600),
  });
  const filtered = filterRows(rows, query)
    .filter((row) => !TERMINAL_ORDER_STATUSES.includes(row.status) || row.missing?.length || row.warnings?.length)
    .sort((left, right) => {
      const priorityScore = { stat: 0, urgent: 1, routine: 2 };
      const leftPriority = priorityScore[left.priority] ?? 3;
      const rightPriority = priorityScore[right.priority] ?? 3;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      const leftDue = parseDate(left.sla?.due_at)?.getTime() || Number.MAX_SAFE_INTEGER;
      const rightDue = parseDate(right.sla?.due_at)?.getTime() || Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue;
    });
  return {
    summary: {
      ...summarizeRows(filtered),
      sla_warning: filtered.filter((row) => row.sla?.state === 'warning').length,
      sla_breached: filtered.filter((row) => row.sla?.state === 'breached').length,
    },
    items: filtered,
  };
}

function laneForStatUrgent(row) {
  if (row.sla?.state === 'breached' || row.escalation) return 'overdue_or_escalated';
  const isStat = row.priority === ORDER_PRIORITY.STAT;
  const waiting = ['ordered', 'scheduled', 'collected', 'received'].includes(row.status);
  if (isStat && waiting) return 'stat_waiting_ack';
  if (isStat) return 'stat_in_progress';
  if (waiting) return 'urgent_waiting_ack';
  return 'urgent_in_progress';
}

async function getStatUrgent(query = {}, actor = {}) {
  const rows = await loadRows({ ...query, priority: '' }, actor, {
    limit: limitFromQuery(query, 220, 800),
    activeOnly: true,
  });
  const priorityRows = rows.filter((row) => [ORDER_PRIORITY.STAT, ORDER_PRIORITY.URGENT].includes(row.priority));
  const lanes = {
    stat_waiting_ack: [],
    stat_in_progress: [],
    urgent_waiting_ack: [],
    urgent_in_progress: [],
    overdue_or_escalated: [],
  };
  for (const row of priorityRows) {
    lanes[laneForStatUrgent(row)].push(row);
  }
  return {
    summary: {
      stat_open: priorityRows.filter((row) => row.priority === ORDER_PRIORITY.STAT).length,
      urgent_open: priorityRows.filter((row) => row.priority === ORDER_PRIORITY.URGENT).length,
      stat_overdue: priorityRows.filter((row) => row.priority === ORDER_PRIORITY.STAT && row.sla?.state === 'breached').length,
      urgent_overdue: priorityRows.filter((row) => row.priority === ORDER_PRIORITY.URGENT && row.sla?.state === 'breached').length,
      escalated: priorityRows.filter((row) => row.escalation).length,
      average_response_minutes: average(priorityRows.map((row) => minutesBetween(row.ordered_at, row.last_update_at)).filter((value) => value !== null)),
    },
    lanes,
  };
}

function average(values = []) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length);
}

function median(values = []) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

async function labCriticalRows(query = {}, actor = {}, rules) {
  const filter = { is_critical: true, is_current: { $ne: false } };
  if (query.acknowledgement === 'unacknowledged' || query.critical_acknowledged === 'false') filter.critical_acknowledged_at = null;
  const range = buildDateRange(query);
  applyDateFilter(filter, 'reported_at', range);
  if (query.patient_id) filter.patient_id = query.patient_id;
  const resultRows = await LabResult.find(filter)
    .sort({ critical_acknowledged_at: 1, critical_notified_at: -1, reported_at: -1, created_at: -1 })
    .limit(limitFromQuery(query, 160, 600))
    .populate('lab_order_id', 'lab_order_no order_id encounter_id test_name status priority ordered_by ordered_at')
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('verified_by', 'full_name username employee_code')
    .populate('critical_acknowledged_by', 'full_name username employee_code')
    .lean();
  const labOrderIds = resultRows.map((row) => row.lab_order_id?._id || row.lab_order_id).filter(Boolean);
  const [orders, items] = await Promise.all([
    labOrderIds.length ? LabOrder.find({ _id: { $in: labOrderIds } })
      .populate('encounter_id', 'encounter_code encounter_type status start_time department_id attending_doctor_id')
      .populate('ordered_by', 'full_name username employee_code')
      .lean() : [],
    resultRows.length ? LabResultItem.find({ lab_result_id: { $in: resultRows.map((row) => row._id) }, is_critical: true }).lean() : [],
  ]);
  const orderById = new Map(orders.map((order) => [toId(order), order]));
  const itemsByResult = groupById(items, 'lab_result_id');

  return resultRows.map((result) => {
    const order = orderById.get(toId(result.lab_order_id));
    const criticalItems = itemsByResult.get(toId(result)) || [];
    const firstCritical = criticalItems[0];
    const sla = buildSla({
      module: 'lab',
      stage: 'critical_acknowledgement',
      priority: order?.priority || result.lab_order_id?.priority || ORDER_PRIORITY.ROUTINE,
      startedAt: result.critical_notified_at || result.reported_at || result.created_at,
      completedAt: result.critical_acknowledged_at,
      rules,
    });
    return {
      critical_id: `lab_result:${toId(result)}`,
      module: 'lab',
      entity_type: 'lab_result',
      entity_id: toId(result),
      title: firstCritical?.item_name || order?.test_name || result.lab_order_id?.test_name || 'Kết quả xét nghiệm nguy cấp',
      critical_value: firstCritical ? [firstCritical.item_name, firstCritical.result_value, firstCritical.unit].filter(Boolean).join(' ') : result.interpretation || 'Có chỉ số nguy cấp',
      critical_note: firstCritical?.comment || result.notes || result.interpretation,
      status: result.status,
      priority: order?.priority || result.lab_order_id?.priority || ORDER_PRIORITY.ROUTINE,
      result_no: result.result_no,
      order_no: order?.lab_order_no || result.lab_order_id?.lab_order_no,
      service_label: order?.test_name || result.lab_order_id?.test_name,
      notified_at: result.critical_notified_at || result.reported_at,
      acknowledged_at: result.critical_acknowledged_at,
      acknowledged_by: person(result.critical_acknowledged_by),
      ordered_by: person(order?.ordered_by),
      patient: patient(result.patient_id),
      encounter: encounter(order?.encounter_id),
      sla,
      allowed_actions: labAllowedActions(order || { status: '', priority: ORDER_PRIORITY.ROUTINE }, null, result, actor),
      item_summary: {
        abnormal_items: criticalItems.length,
        critical_items: criticalItems.length,
      },
    };
  });
}

async function imagingCriticalRows(query = {}, actor = {}, rules) {
  const filter = { is_critical: true };
  if (query.acknowledgement === 'unacknowledged' || query.critical_acknowledged === 'false') filter.critical_acknowledged_at = null;
  const range = buildDateRange(query);
  applyDateFilter(filter, 'reported_at', range);
  if (query.patient_id) filter.patient_id = query.patient_id;
  const reports = await ImagingReport.find(filter)
    .sort({ critical_acknowledged_at: 1, critical_notified_at: -1, reported_at: -1, created_at: -1 })
    .limit(limitFromQuery(query, 160, 600))
    .populate('imaging_order_id', 'imaging_order_no order_id encounter_id modality body_part status priority ordered_by ordered_at')
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('radiologist_id', 'full_name username employee_code')
    .populate('verified_by', 'full_name username employee_code')
    .populate('critical_acknowledged_by', 'full_name username employee_code')
    .lean();
  const orderIds = reports.map((row) => row.imaging_order_id?._id || row.imaging_order_id).filter(Boolean);
  const orders = orderIds.length ? await ImagingOrder.find({ _id: { $in: orderIds } })
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id attending_doctor_id')
    .populate('ordered_by', 'full_name username employee_code')
    .lean() : [];
  const orderById = new Map(orders.map((order) => [toId(order), order]));

  return reports.map((report) => {
    const order = orderById.get(toId(report.imaging_order_id));
    const sla = buildSla({
      module: 'imaging',
      stage: 'critical_acknowledgement',
      priority: order?.priority || report.imaging_order_id?.priority || ORDER_PRIORITY.ROUTINE,
      startedAt: report.critical_notified_at || report.reported_at || report.created_at,
      completedAt: report.critical_acknowledged_at,
      rules,
    });
    return {
      critical_id: `imaging_report:${toId(report)}`,
      module: 'imaging',
      entity_type: 'imaging_report',
      entity_id: toId(report),
      title: report.critical_finding || `${order?.modality || report.imaging_order_id?.modality || 'CĐHA'} ${order?.body_part || report.imaging_order_id?.body_part || ''}`.trim(),
      critical_value: report.critical_finding,
      critical_note: report.critical_note || report.impression,
      status: report.status,
      priority: order?.priority || report.imaging_order_id?.priority || ORDER_PRIORITY.ROUTINE,
      result_no: report.report_no,
      order_no: order?.imaging_order_no || report.imaging_order_id?.imaging_order_no,
      service_label: [order?.modality || report.imaging_order_id?.modality, order?.body_part || report.imaging_order_id?.body_part].filter(Boolean).join(' - '),
      notified_at: report.critical_notified_at || report.reported_at,
      acknowledged_at: report.critical_acknowledged_at,
      acknowledged_by: person(report.critical_acknowledged_by),
      ordered_by: person(order?.ordered_by),
      patient: patient(report.patient_id),
      encounter: encounter(order?.encounter_id),
      sla,
      allowed_actions: imagingAllowedActions(order || { status: '', priority: ORDER_PRIORITY.ROUTINE }, report, actor),
      item_summary: {
        abnormal_items: report.critical_finding ? 1 : 0,
        critical_items: 1,
      },
    };
  });
}

async function getCriticalResults(query = {}, actor = {}) {
  assertStaffRead(actor);
  const rules = await loadSlaRuleMap();
  const modules = requestedModules(query).filter((module) => module !== 'procedure');
  const rows = (await Promise.all([
    modules.includes('lab') ? labCriticalRows(query, actor, rules) : [],
    modules.includes('imaging') ? imagingCriticalRows(query, actor, rules) : [],
  ])).flat();
  const escalationMap = await loadOpenEscalationMap(rows.map((row) => ({ entity_type: row.entity_type, entity_id: row.entity_id })));
  const items = rows
    .map((row) => attachEscalation(row, escalationMap))
    .filter((row) => {
      if (query.tab === 'unacknowledged') return !row.acknowledged_at;
      if (query.tab === 'overdue') return row.sla?.state === 'breached';
      if (query.tab === 'acknowledged') return Boolean(row.acknowledged_at);
      return true;
    })
    .sort((left, right) => {
      if (!left.acknowledged_at && right.acknowledged_at) return -1;
      if (left.acknowledged_at && !right.acknowledged_at) return 1;
      const leftDue = parseDate(left.sla?.due_at)?.getTime() || Number.MAX_SAFE_INTEGER;
      const rightDue = parseDate(right.sla?.due_at)?.getTime() || Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue;
    });
  const acknowledgedDurations = items
    .filter((item) => item.acknowledged_at)
    .map((item) => minutesBetween(item.notified_at, item.acknowledged_at))
    .filter((value) => value !== null);
  return {
    summary: {
      total_critical: items.length,
      unacknowledged: items.filter((item) => !item.acknowledged_at).length,
      overdue_ack: items.filter((item) => item.sla?.state === 'breached').length,
      lab_critical: items.filter((item) => item.module === 'lab').length,
      imaging_critical: items.filter((item) => item.module === 'imaging').length,
      median_ack_minutes: median(acknowledgedDurations),
    },
    items,
  };
}

async function getPendingCompletion(query = {}, actor = {}) {
  const rows = await loadRows(query, actor, {
    limit: limitFromQuery(query, 180, 700),
  });
  const items = rows.filter((row) => {
    if (row.module === 'lab') {
      return ['waiting_receive', 'waiting_process', 'in_testing', 'result_preliminary'].includes(row.stage_code);
    }
    if (row.module === 'imaging') {
      return ['technical_completed', 'imaging_missing_file', 'report_draft', 'report_preliminary'].includes(row.stage_code);
    }
    if (row.module === 'procedure') {
      return row.status === PROCEDURE_STATUS.IN_PROGRESS || row.missing?.length;
    }
    return false;
  }).map((row) => ({
    ...row,
    completion_state: row.stage_code,
    age_minutes: minutesBetween(row.last_update_at || row.ordered_at),
  }));

  return {
    summary: {
      total: items.length,
      blocked: items.filter((item) => item.missing?.length || item.warnings?.includes('file_issue')).length,
      ready_for_approval: items.filter((item) => ['result_preliminary', 'report_preliminary', 'report_draft'].includes(item.completion_state)).length,
      lab: items.filter((item) => item.module === 'lab').length,
      imaging: items.filter((item) => item.module === 'imaging').length,
      procedure: items.filter((item) => item.module === 'procedure').length,
    },
    items,
  };
}

async function getPendingApproval(query = {}, actor = {}) {
  assertStaffRead(actor);
  const module = normalizeModule(query.module);
  const limit = limitFromQuery(query, 180, 700);
  const resultFilter = { status: LAB_RESULT_STATUS.PRELIMINARY, is_current: { $ne: false } };
  const reportFilter = { status: { $in: [IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY] } };
  if (query.critical_only === 'true') {
    resultFilter.is_critical = true;
    reportFilter.is_critical = true;
  }
  if (query.patient_id) {
    resultFilter.patient_id = query.patient_id;
    reportFilter.patient_id = query.patient_id;
  }
  const range = buildDateRange(query);
  applyDateFilter(resultFilter, 'reported_at', range);
  applyDateFilter(reportFilter, 'reported_at', range);

  const [labResults, imagingReports] = await Promise.all([
    module === 'imaging' ? [] : LabResult.find(resultFilter)
      .sort({ is_critical: -1, reported_at: 1, created_at: 1 })
      .limit(limit)
      .populate('lab_order_id', 'lab_order_no order_id encounter_id test_name status priority ordered_by ordered_at')
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('performed_by', 'full_name username employee_code')
      .lean(),
    module === 'lab' || module === 'procedure' ? [] : ImagingReport.find(reportFilter)
      .sort({ is_critical: -1, reported_at: 1, created_at: 1 })
      .limit(limit)
      .populate('imaging_order_id', 'imaging_order_no order_id encounter_id modality body_part status priority ordered_by ordered_at')
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('radiologist_id', 'full_name username employee_code')
      .lean(),
  ]);
  const labOrderIds = labResults.map((item) => item.lab_order_id?._id || item.lab_order_id).filter(Boolean);
  const imagingOrderIds = imagingReports.map((item) => item.imaging_order_id?._id || item.imaging_order_id).filter(Boolean);
  const [labOrders, imagingOrders, resultItems] = await Promise.all([
    labOrderIds.length ? LabOrder.find({ _id: { $in: labOrderIds } })
      .populate('encounter_id', 'encounter_code encounter_type status start_time department_id attending_doctor_id')
      .populate('ordered_by', 'full_name username employee_code')
      .lean() : [],
    imagingOrderIds.length ? ImagingOrder.find({ _id: { $in: imagingOrderIds } })
      .populate('encounter_id', 'encounter_code encounter_type status start_time department_id attending_doctor_id')
      .populate('ordered_by', 'full_name username employee_code')
      .lean() : [],
    labResults.length ? LabResultItem.find({ lab_result_id: { $in: labResults.map((item) => item._id) } }).lean() : [],
  ]);
  const labOrderById = new Map(labOrders.map((item) => [toId(item), item]));
  const imagingOrderById = new Map(imagingOrders.map((item) => [toId(item), item]));
  const itemsByResult = groupById(resultItems, 'lab_result_id');
  const items = [
    ...labResults.map((result) => {
      const order = labOrderById.get(toId(result.lab_order_id));
      const resultItemsForRow = itemsByResult.get(toId(result)) || [];
      return {
        module: 'lab',
        entity_type: 'lab_result',
        entity_id: toId(result),
        status: result.status,
        priority: order?.priority || result.lab_order_id?.priority || ORDER_PRIORITY.ROUTINE,
        is_critical: Boolean(result.is_critical),
        patient: patient(result.patient_id),
        encounter: encounter(order?.encounter_id),
        order_no: order?.lab_order_no || result.lab_order_id?.lab_order_no,
        result_no: result.result_no,
        service_label: order?.test_name || result.lab_order_id?.test_name,
        ordered_by: person(order?.ordered_by),
        owner: person(result.performed_by),
        created_at: result.reported_at || result.created_at,
        waiting_minutes: minutesBetween(result.reported_at || result.created_at),
        review_payload: {
          abnormal_items: resultItemsForRow.filter((item) => !['normal', 'unknown'].includes(item.abnormal_flag)).length,
          critical_items: resultItemsForRow.filter((item) => item.is_critical).length,
        },
        allowed_actions: labAllowedActions(order || { status: '', priority: ORDER_PRIORITY.ROUTINE }, null, result, actor),
      };
    }),
    ...imagingReports.map((report) => {
      const order = imagingOrderById.get(toId(report.imaging_order_id));
      return {
        module: 'imaging',
        entity_type: 'imaging_report',
        entity_id: toId(report),
        status: report.status,
        priority: order?.priority || report.imaging_order_id?.priority || ORDER_PRIORITY.ROUTINE,
        is_critical: Boolean(report.is_critical),
        patient: patient(report.patient_id),
        encounter: encounter(order?.encounter_id),
        order_no: order?.imaging_order_no || report.imaging_order_id?.imaging_order_no,
        result_no: report.report_no,
        service_label: [order?.modality || report.imaging_order_id?.modality, order?.body_part || report.imaging_order_id?.body_part].filter(Boolean).join(' - '),
        ordered_by: person(order?.ordered_by),
        owner: person(report.radiologist_id),
        created_at: report.reported_at || report.created_at,
        waiting_minutes: minutesBetween(report.reported_at || report.created_at),
        review_payload: {
          abnormal_items: report.findings ? 1 : 0,
          critical_items: report.is_critical ? 1 : 0,
        },
        allowed_actions: imagingAllowedActions(order || { status: '', priority: ORDER_PRIORITY.ROUTINE }, report, actor),
      };
    }),
  ].sort((left, right) => {
    const priorityScore = { stat: 0, urgent: 1, routine: 2 };
    if (priorityScore[left.priority] !== priorityScore[right.priority]) return priorityScore[left.priority] - priorityScore[right.priority];
    if (left.is_critical !== right.is_critical) return left.is_critical ? -1 : 1;
    return Number(right.waiting_minutes || 0) - Number(left.waiting_minutes || 0);
  });

  return {
    summary: {
      lab_pending: items.filter((item) => item.module === 'lab').length,
      imaging_pending: items.filter((item) => item.module === 'imaging').length,
      critical_pending: items.filter((item) => item.is_critical).length,
      amended_pending: items.filter((item) => item.status === 'amended').length,
      total: items.length,
    },
    items,
  };
}

async function getOverdueOrders(query = {}, actor = {}) {
  const rows = await loadRows(query, actor, {
    limit: limitFromQuery(query, 300, 1000),
  });
  const items = rows
    .filter((row) => row.sla?.state === 'breached')
    .sort((left, right) => Number(right.sla?.breached_minutes || 0) - Number(left.sla?.breached_minutes || 0))
    .map((row) => ({
      ...row,
      sla_stage: row.sla?.stage,
      current_status: row.status,
      due_at: row.sla?.due_at,
      breached_minutes: row.sla?.breached_minutes,
      severity: row.priority === ORDER_PRIORITY.STAT || Number(row.sla?.breached_minutes || 0) > 120 ? 'high' : 'medium',
    }));
  return {
    summary: {
      total_overdue: items.length,
      stat_overdue: items.filter((row) => row.priority === ORDER_PRIORITY.STAT).length,
      urgent_overdue: items.filter((row) => row.priority === ORDER_PRIORITY.URGENT).length,
      lab_overdue: items.filter((row) => row.module === 'lab').length,
      imaging_overdue: items.filter((row) => row.module === 'imaging').length,
      procedure_overdue: items.filter((row) => row.module === 'procedure').length,
      over_2h: items.filter((row) => Number(row.breached_minutes || 0) > 120).length,
      over_24h: items.filter((row) => Number(row.breached_minutes || 0) > 1440).length,
    },
    items,
  };
}

function countBy(rows = [], predicate) {
  return rows.filter(predicate).length;
}

function flowCounts(rows = [], stages = []) {
  return Object.fromEntries(stages.map((stage) => [stage, rows.filter((row) => row.stage_code === stage || row.status === stage).length]));
}

function buildBottlenecks(rows = [], criticalItems = []) {
  const candidates = [
    {
      id: 'critical-unacknowledged',
      title: 'Critical chưa xác nhận',
      module: 'safety',
      severity: criticalItems.filter((item) => !item.acknowledged_at).length > 0 ? 'high' : 'normal',
      count: criticalItems.filter((item) => !item.acknowledged_at).length,
      next_action: 'open_critical_center',
    },
    {
      id: 'sla-breached',
      title: 'Order quá hạn SLA',
      module: 'operations',
      severity: rows.filter((item) => item.sla?.state === 'breached').length > 0 ? 'high' : 'normal',
      count: rows.filter((item) => item.sla?.state === 'breached').length,
      next_action: 'open_overdue_orders',
    },
    {
      id: 'file-issues',
      title: 'File thiếu hoặc lỗi scan',
      module: 'records',
      severity: rows.filter((item) => item.missing?.includes('file') || item.warnings?.includes('file_issue')).length > 0 ? 'medium' : 'normal',
      count: rows.filter((item) => item.missing?.includes('file') || item.warnings?.includes('file_issue')).length,
      next_action: 'open_pending_completion',
    },
    {
      id: 'procedure-missing-charge',
      title: 'Procedure thiếu charge',
      module: 'procedure',
      severity: rows.filter((item) => item.module === 'procedure' && item.missing?.includes('charge')).length > 0 ? 'medium' : 'normal',
      count: rows.filter((item) => item.module === 'procedure' && item.missing?.includes('charge')).length,
      next_action: 'create_charge',
    },
    {
      id: 'rejected-specimens',
      title: 'Mẫu bị từ chối',
      module: 'lab',
      severity: rows.filter((item) => item.warnings?.includes('specimen_rejected')).length > 0 ? 'medium' : 'normal',
      count: rows.filter((item) => item.warnings?.includes('specimen_rejected')).length,
      next_action: 'review_specimens',
    },
  ];
  return candidates.filter((item) => item.count > 0);
}

function buildRealtimeEvents(rows = [], criticalItems = []) {
  return [
    ...rows.map((row) => ({
      event_type: `${row.module}.${row.stage_code}`,
      event_time: row.last_update_at || row.ordered_at,
      module: row.module,
      title: row.stage_label,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      patient: row.patient,
      priority: row.priority,
    })),
    ...criticalItems.map((item) => ({
      event_type: `${item.module}.critical`,
      event_time: item.notified_at,
      module: item.module,
      title: item.title,
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      patient: item.patient,
      priority: item.priority,
    })),
  ]
    .filter((item) => item.event_time)
    .sort((left, right) => parseDate(right.event_time).getTime() - parseDate(left.event_time).getTime())
    .slice(0, 20);
}

async function getDashboard(query = {}, actor = {}) {
  assertStaffRead(actor);
  const dateRange = buildDateRange(query, { defaultToday: true });
  const rules = await loadSlaRuleMap();
  const rows = await loadRows(query, actor, { dateRange, limit: 0, rules });
  const critical = await getCriticalResults({ ...query, limit: 200 }, actor);
  const pendingApproval = await getPendingApproval({ ...query, limit: 300 }, actor);
  const overdue = await getOverdueOrders({ ...query, limit: 500 }, actor);
  const labRows = rows.filter((item) => item.module === 'lab');
  const imagingRows = rows.filter((item) => item.module === 'imaging');
  const procedureRows = rows.filter((item) => item.module === 'procedure');
  const completedRows = rows.filter((item) => item.status === 'completed' || ['result_final', 'report_final'].includes(item.stage_code));
  const completedSlaRows = completedRows.filter((item) => item.sla);
  const slaCompliance = completedSlaRows.length
    ? Math.round((completedSlaRows.filter((item) => Number(item.sla?.breached_minutes || 0) === 0).length / completedSlaRows.length) * 1000) / 10
    : Math.max(0, 100 - Math.round((overdue.summary.total_overdue / Math.max(rows.length, 1)) * 1000) / 10);

  return {
    generated_at: new Date(),
    filters: {
      module: normalizeModule(query.module),
      scope: normalizeScope(query.scope),
      date_from: dateRange?.start,
      date_to: dateRange?.end,
    },
    summary: {
      total_orders_today: rows.length,
      new_orders_last_15_minutes: rows.filter((row) => minutesBetween(row.ordered_at) <= 15).length,
      stat_open: rows.filter((row) => row.priority === ORDER_PRIORITY.STAT && !TERMINAL_ORDER_STATUSES.includes(row.status)).length,
      urgent_open: rows.filter((row) => row.priority === ORDER_PRIORITY.URGENT && !TERMINAL_ORDER_STATUSES.includes(row.status)).length,
      critical_unacknowledged: critical.summary.unacknowledged,
      pending_completion: rows.filter((row) => row.missing?.length || ['waiting_receive', 'waiting_process', 'in_testing', 'technical_completed', 'report_draft'].includes(row.stage_code)).length,
      pending_approval: pendingApproval.summary.total,
      overdue_orders: overdue.summary.total_overdue,
      completed_today: completedRows.length,
      cancelled_today: countBy(rows, (row) => row.status === 'cancelled'),
      no_show_today: countBy(rows, (row) => row.status === 'no_show'),
      entered_in_error: countBy(rows, (row) => row.status === 'entered_in_error'),
      sla_warning: countBy(rows, (row) => row.sla?.state === 'warning'),
      sla_breached: overdue.summary.total_overdue,
      sla_compliance_percent: slaCompliance,
      median_tat_minutes: median(completedRows.map((row) => minutesBetween(row.ordered_at, row.last_update_at)).filter((value) => value !== null)),
      critical_response_time_minutes: critical.summary.median_ack_minutes,
    },
    lab: {
      ordered: labRows.length,
      waiting_collection: countBy(labRows, (row) => row.stage_code === 'waiting_collection'),
      collected: countBy(labRows, (row) => row.stage_code === 'waiting_receive'),
      received: countBy(labRows, (row) => row.stage_code === 'waiting_process'),
      in_testing: countBy(labRows, (row) => row.stage_code === 'in_testing'),
      preliminary_results: countBy(labRows, (row) => row.stage_code === 'result_preliminary'),
      final_results: countBy(labRows, (row) => row.stage_code === 'result_final'),
      critical_unacknowledged: critical.items.filter((item) => item.module === 'lab' && !item.acknowledged_at).length,
      rejected_specimens: countBy(labRows, (row) => row.warnings?.includes('specimen_rejected')),
      stored_specimens: countBy(labRows, (row) => row.specimen?.status === SPECIMEN_STATUS.STORED),
      flow: flowCounts(labRows, ['waiting_collection', 'waiting_receive', 'waiting_process', 'in_testing', 'result_preliminary', 'result_final']),
    },
    imaging: {
      ordered: imagingRows.length,
      waiting_schedule: countBy(imagingRows, (row) => row.stage_code === 'waiting_schedule'),
      scheduled_today: countBy(imagingRows, (row) => row.status === 'scheduled'),
      in_progress: countBy(imagingRows, (row) => row.status === 'in_progress'),
      technical_completed: countBy(imagingRows, (row) => row.stage_code === 'technical_completed' || row.stage_code === 'imaging_missing_file'),
      reports_pending_sign: pendingApproval.items.filter((item) => item.module === 'imaging').length,
      reports_signed: countBy(imagingRows, (row) => row.stage_code === 'report_final'),
      critical_unacknowledged: critical.items.filter((item) => item.module === 'imaging' && !item.acknowledged_at).length,
      file_issue_or_missing: countBy(imagingRows, (row) => row.missing?.includes('file') || row.warnings?.includes('file_issue')),
      flow: flowCounts(imagingRows, ['waiting_schedule', 'scheduled', 'in_progress', 'technical_completed', 'report_draft', 'report_preliminary', 'report_final']),
    },
    procedure: {
      ordered: procedureRows.length,
      scheduled_today: countBy(procedureRows, (row) => row.status === 'scheduled'),
      in_progress: countBy(procedureRows, (row) => row.status === 'in_progress'),
      completed: countBy(procedureRows, (row) => row.status === 'completed'),
      no_show: countBy(procedureRows, (row) => row.status === 'no_show'),
      missing_charge: countBy(procedureRows, (row) => row.missing?.includes('charge')),
      missing_file: countBy(procedureRows, (row) => row.missing?.includes('file')),
      missing_result_note: countBy(procedureRows, (row) => row.missing?.includes('result_note')),
      flow: flowCounts(procedureRows, ['waiting_schedule', 'scheduled', 'in_progress', 'completed', 'procedure_missing_result_note', 'procedure_missing_file', 'procedure_missing_charge']),
    },
    bottlenecks: buildBottlenecks(rows, critical.items),
    realtime_events: buildRealtimeEvents(rows, critical.items),
  };
}

function hasRole(actor = {}, roleCode) {
  return (actor.roles || []).includes(roleCode);
}

function sidebarItem(id, label, path, icon, badgeKey = null) {
  return { id, label, path, icon, badge_key: badgeKey };
}

function fullClinicalOpsSidebarSections(overviewItems = []) {
  return [
    { id: 'overview', label: 'Tổng quan', items: overviewItems },
    {
      id: 'order-center',
      label: 'Trung tâm chỉ định',
      items: [
        sidebarItem('orders-all', 'Tất cả chỉ định cận lâm sàng', '/clinical-ops/orders/all', 'ClipboardList'),
        sidebarItem('orders-pending-receive', 'Chỉ định chờ tiếp nhận', '/clinical-ops/orders/pending-receive', 'Clock3'),
        sidebarItem('orders-received', 'Chỉ định đã tiếp nhận', '/clinical-ops/orders/received', 'CheckCircle2'),
        sidebarItem('orders-in-progress', 'Chỉ định đang thực hiện', '/clinical-ops/orders/in-progress', 'Activity'),
        sidebarItem('orders-completed', 'Chỉ định hoàn tất', '/clinical-ops/orders/completed', 'BadgeCheck'),
        sidebarItem('orders-cancelled', 'Chỉ định bị hủy', '/clinical-ops/orders/cancelled', 'AlertTriangle'),
        sidebarItem('orders-entry-errors', 'Chỉ định nhập sai', '/clinical-ops/orders/entry-errors', 'FileText'),
        sidebarItem('orders-timeline', 'Dòng thời gian chỉ định', '/clinical-ops/orders/timeline', 'History'),
      ],
    },
    {
      id: 'tests',
      label: 'Xét nghiệm',
      items: [
        sidebarItem('tests-orders', 'Chỉ định xét nghiệm', '/clinical-ops/tests/orders', 'ClipboardList'),
        sidebarItem('tests-waiting-specimen', 'Chờ lấy mẫu', '/clinical-ops/tests/waiting-specimen', 'Clock3'),
        sidebarItem('tests-collected', 'Đã lấy mẫu', '/clinical-ops/tests/specimen-collected', 'BadgeCheck'),
        sidebarItem('tests-waiting-receive', 'Chờ nhận mẫu', '/clinical-ops/tests/waiting-receive', 'Clock3'),
        sidebarItem('tests-processing', 'Đang xét nghiệm', '/clinical-ops/tests/processing', 'Activity'),
        sidebarItem('tests-result-entry', 'Nhập kết quả', '/clinical-ops/tests/result-entry', 'FileText'),
        sidebarItem('tests-pending-approval', 'Kết quả chờ duyệt', '/clinical-ops/tests/pending-approval', 'ClipboardCheck'),
        sidebarItem('tests-approved-results', 'Kết quả đã duyệt', '/clinical-ops/tests/approved-results', 'BadgeCheck'),
        sidebarItem('tests-corrections-needed', 'Kết quả cần sửa', '/clinical-ops/tests/corrections-needed', 'AlertTriangle'),
        sidebarItem('tests-critical-results', 'Kết quả xét nghiệm nguy cấp', '/clinical-ops/tests/critical-results', 'ShieldAlert'),
      ],
    },
    {
      id: 'specimens',
      label: 'Mẫu bệnh phẩm',
      items: [
        sidebarItem('specimens-list', 'Danh sách mẫu', '/clinical-ops/specimens', 'ClipboardList'),
        sidebarItem('specimens-waiting-collection', 'Mẫu chờ lấy', '/clinical-ops/specimens/waiting-collection', 'Clock3'),
        sidebarItem('specimens-collected', 'Mẫu đã lấy', '/clinical-ops/specimens/collected', 'BadgeCheck'),
        sidebarItem('specimens-receive', 'Nhận mẫu', '/clinical-ops/specimens/receive', 'ClipboardPlus'),
        sidebarItem('specimens-reject', 'Từ chối mẫu', '/clinical-ops/specimens/reject', 'AlertTriangle'),
        sidebarItem('specimens-testing', 'Mẫu đang xét nghiệm', '/clinical-ops/specimens/testing', 'Activity'),
        sidebarItem('specimens-storage', 'Mẫu lưu kho', '/clinical-ops/specimens/storage', 'Microscope'),
        sidebarItem('specimens-destroyed', 'Mẫu đã hủy', '/clinical-ops/specimens/destroyed', 'AlertTriangle'),
        sidebarItem('specimens-history', 'Lịch sử mẫu', '/clinical-ops/specimens/history', 'History'),
      ],
    },
    {
      id: 'imaging',
      label: 'Chẩn đoán hình ảnh',
      items: [
        sidebarItem('imaging-orders', 'Chỉ định chẩn đoán hình ảnh', '/clinical-ops/imaging/orders', 'ClipboardList'),
        sidebarItem('imaging-waiting-schedule', 'Chờ xếp lịch', '/clinical-ops/imaging/waiting-schedule', 'Clock3'),
        sidebarItem('imaging-schedule', 'Lịch thực hiện', '/clinical-ops/imaging/schedule', 'CalendarDays'),
        sidebarItem('imaging-in-progress', 'Đang thực hiện', '/clinical-ops/imaging/in-progress', 'Activity'),
        sidebarItem('imaging-tech-complete', 'Hoàn tất kỹ thuật', '/clinical-ops/imaging/technical-complete', 'BadgeCheck'),
        sidebarItem('imaging-upload', 'Tải hình ảnh / tệp kết quả', '/clinical-ops/imaging/upload-files', 'FileText'),
        sidebarItem('imaging-no-show', 'Không đến thực hiện', '/clinical-ops/imaging/no-show', 'AlertTriangle'),
        sidebarItem('imaging-reports', 'Báo cáo chẩn đoán hình ảnh', '/clinical-ops/imaging/reports', 'FileText'),
        sidebarItem('imaging-pending-signature', 'Báo cáo chờ ký', '/clinical-ops/imaging/pending-signature', 'ClipboardCheck'),
        sidebarItem('imaging-signed', 'Báo cáo đã ký', '/clinical-ops/imaging/signed-reports', 'FileCheck2'),
        sidebarItem('imaging-corrections', 'Báo cáo cần sửa', '/clinical-ops/imaging/corrections-needed', 'AlertTriangle'),
        sidebarItem('imaging-critical-findings', 'Phát hiện hình ảnh nguy cấp', '/clinical-ops/imaging/critical-findings', 'ShieldAlert'),
      ],
    },
    {
      id: 'procedures',
      label: 'Thủ thuật',
      items: [
        sidebarItem('procedures-orders', 'Chỉ định thủ thuật', '/clinical-ops/procedures/orders', 'ClipboardList'),
        sidebarItem('procedures-waiting-schedule', 'Chờ xếp lịch', '/clinical-ops/procedures/waiting-schedule', 'Clock3'),
        sidebarItem('procedures-schedule', 'Lịch thủ thuật', '/clinical-ops/procedures/schedule', 'CalendarDays'),
        sidebarItem('procedures-prep', 'Chuẩn bị thủ thuật', '/clinical-ops/procedures/preparation', 'ClipboardCheck'),
        sidebarItem('procedures-in-progress', 'Đang thực hiện', '/clinical-ops/procedures/in-progress', 'Activity'),
        sidebarItem('procedures-results', 'Kết quả thủ thuật', '/clinical-ops/procedures/results', 'FileText'),
        sidebarItem('procedures-complete', 'Hoàn tất thủ thuật', '/clinical-ops/procedures/complete', 'BadgeCheck'),
        sidebarItem('procedures-no-show', 'Không đến thực hiện', '/clinical-ops/procedures/no-show', 'AlertTriangle'),
        sidebarItem('procedures-files', 'Tệp thủ thuật', '/clinical-ops/procedures/files', 'FileText'),
        sidebarItem('procedures-fees', 'Chi phí thủ thuật', '/clinical-ops/procedures/fees', 'WalletCards'),
      ],
    },
    {
      id: 'approvals',
      label: 'Duyệt và trả kết quả',
      items: [
        sidebarItem('approvals-lab', 'Chờ duyệt xét nghiệm', '/clinical-ops/approvals/lab', 'FlaskConical'),
        sidebarItem('approvals-imaging', 'Chờ ký chẩn đoán hình ảnh', '/clinical-ops/approvals/imaging-signature', 'ScanLine'),
        sidebarItem('approvals-procedure', 'Chờ xác nhận thủ thuật', '/clinical-ops/approvals/procedure-confirmation', 'ClipboardCheck'),
        sidebarItem('approvals-returned-doctor', 'Kết quả đã trả bác sĩ', '/clinical-ops/approvals/returned-to-doctor', 'Stethoscope'),
        sidebarItem('approvals-returned-patient', 'Kết quả đã trả bệnh nhân', '/clinical-ops/approvals/returned-to-patient', 'UserSquare2'),
        sidebarItem('approvals-amend-needed', 'Kết quả cần điều chỉnh', '/clinical-ops/approvals/amend-needed', 'AlertTriangle'),
        sidebarItem('approvals-history', 'Lịch sử duyệt / ký', '/clinical-ops/approvals/history', 'History'),
      ],
    },
    {
      id: 'result-files',
      label: 'Tệp và tài liệu kết quả',
      items: [
        sidebarItem('files-imaging', 'Tệp chẩn đoán hình ảnh', '/clinical-ops/result-files/imaging', 'ScanLine'),
        sidebarItem('files-procedure', 'Tệp thủ thuật', '/clinical-ops/result-files/procedure', 'ClipboardPlus'),
        sidebarItem('files-lab', 'Tệp xét nghiệm', '/clinical-ops/result-files/lab', 'FlaskConical'),
        sidebarItem('files-missing', 'Tệp còn thiếu', '/clinical-ops/result-files/missing', 'AlertTriangle'),
        sidebarItem('files-scan-errors', 'Tệp lỗi quét', '/clinical-ops/result-files/scan-errors', 'AlertTriangle'),
        sidebarItem('files-review', 'Tệp chờ rà soát', '/clinical-ops/result-files/pending-review', 'ClipboardCheck'),
        sidebarItem('files-released', 'Tệp đã phát hành', '/clinical-ops/result-files/released', 'FileCheck2'),
      ],
    },
    {
      id: 'alerts',
      label: 'Cảnh báo',
      items: [
        sidebarItem('alerts-command-center', 'Trung tâm cảnh báo', '/clinical-ops/alerts', 'ShieldAlert'),
        sidebarItem('alerts-critical-unhandled', 'Kết quả nguy cấp chưa xử lý', '/clinical-ops/alerts/critical-unhandled', 'ShieldAlert'),
        sidebarItem('alerts-critical-overdue', 'Kết quả nguy cấp quá hạn xác nhận', '/clinical-ops/alerts/critical-overdue-confirmation', 'Clock3'),
        sidebarItem('alerts-rejected-specimens', 'Mẫu bị từ chối', '/clinical-ops/alerts/rejected-specimens', 'AlertTriangle'),
        sidebarItem('alerts-overdue-orders', 'Chỉ định quá hạn', '/clinical-ops/alerts/overdue-orders', 'Clock3'),
        sidebarItem('alerts-missing-files', 'Thiếu tệp kết quả', '/clinical-ops/alerts/missing-result-files', 'FileText'),
        sidebarItem('alerts-corrections', 'Kết quả cần sửa', '/clinical-ops/alerts/corrections-needed', 'ClipboardCheck'),
        sidebarItem('alerts-no-show-cancel', 'Không đến thực hiện / hủy bất thường', '/clinical-ops/alerts/no-show-abnormal-cancel', 'AlertTriangle'),
      ],
    },
    {
      id: 'patient-lookup',
      label: 'Tra cứu bệnh nhân',
      items: [
        sidebarItem('lookup-by-patient', 'Theo bệnh nhân', '/clinical-ops/patient-lookup/by-patient', 'Users'),
        sidebarItem('lookup-by-encounter', 'Theo lượt khám', '/clinical-ops/patient-lookup/by-visit', 'ClipboardList'),
        sidebarItem('lookup-lab-history', 'Lịch sử xét nghiệm', '/clinical-ops/patient-lookup/lab-history', 'FlaskConical'),
        sidebarItem('lookup-imaging-history', 'Lịch sử chẩn đoán hình ảnh', '/clinical-ops/patient-lookup/imaging-history', 'ScanLine'),
        sidebarItem('lookup-procedure-history', 'Lịch sử thủ thuật', '/clinical-ops/patient-lookup/procedure-history', 'ClipboardPlus'),
        sidebarItem('lookup-clinical-summary', 'Tổng hợp cận lâm sàng', '/clinical-ops/patient-lookup/clinical-summary', 'FileText'),
      ],
    },
  ];
}

async function getSidebar(query = {}, actor = {}) {
  assertStaffRead(actor);
  const isFullOps = hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.ORDERS.READ])
    || hasRole(actor, ROLE_CODE.SUPER_ADMIN)
    || hasRole(actor, ROLE_CODE.ADMIN)
    || hasRole(actor, ROLE_CODE.MANAGER);
  const items = [];
  const configItems = [];

  if (isFullOps || hasRole(actor, ROLE_CODE.LAB_MANAGER)) {
    items.push(sidebarItem('dashboard', 'Dashboard cận lâm sàng', '/clinical-ops/overview/dashboard', 'LayoutGrid', 'total_orders_today'));
  }
  if (isFullOps || [ROLE_CODE.LAB_TECHNICIAN, ROLE_CODE.IMAGING_TECHNICIAN, ROLE_CODE.RADIOLOGIST, ROLE_CODE.PROCEDURE_STAFF, ROLE_CODE.DOCTOR].some((role) => hasRole(actor, role))) {
    items.push(sidebarItem('today-worklist', 'Việc cần xử lý hôm nay', '/clinical-ops/overview/today-worklist', 'ClipboardCheck', 'worklist_total'));
  }
  if (isFullOps || [ROLE_CODE.LAB_TECHNICIAN, ROLE_CODE.IMAGING_TECHNICIAN, ROLE_CODE.PROCEDURE_STAFF].some((role) => hasRole(actor, role))) {
    items.push(sidebarItem('stat-urgent', 'STAT / Urgent orders', '/clinical-ops/overview/stat-urgent', 'ShieldAlert', 'stat_open'));
  }
  if (isFullOps || [ROLE_CODE.LAB_TECHNICIAN, ROLE_CODE.LAB_MANAGER, ROLE_CODE.RADIOLOGIST, ROLE_CODE.DOCTOR].some((role) => hasRole(actor, role))) {
    items.push(sidebarItem('critical-results', 'Critical results', '/clinical-ops/overview/critical-results', 'Siren', 'critical_unacknowledged'));
  }
  if (isFullOps || hasRole(actor, ROLE_CODE.DOCTOR)) {
    items.push(sidebarItem('pending-completion', 'Kết quả chờ hoàn tất', '/clinical-ops/overview/pending-completion', 'FileClock', 'pending_completion'));
  }
  if (isFullOps || [ROLE_CODE.LAB_MANAGER, ROLE_CODE.RADIOLOGIST].some((role) => hasRole(actor, role))) {
    items.push(sidebarItem('pending-approval', 'Kết quả chờ duyệt / ký', '/clinical-ops/overview/pending-approval', 'BadgeCheck', 'pending_approval'));
  }
  if (isFullOps || [ROLE_CODE.LAB_MANAGER, ROLE_CODE.IMAGING_TECHNICIAN, ROLE_CODE.PROCEDURE_STAFF].some((role) => hasRole(actor, role))) {
    items.push(sidebarItem('overdue-orders', 'Order quá hạn', '/clinical-ops/overview/overdue-orders', 'TimerOff', 'overdue_orders'));
  }

  if (hasRole(actor, ROLE_CODE.NURSE) && !isFullOps) {
    return {
      workspace: 'clinical-operations',
      role_scope: 'nursing_related',
      sections: [{
        id: 'nursing-related',
        label: 'Cận lâm sàng liên quan',
        items: [
          sidebarItem('nursing-preparation', 'Bệnh nhân cần chuẩn bị', '/lab/nursing-related/patient-preparation', 'Users'),
          sidebarItem('nursing-specimen', 'Chờ lấy mẫu', '/lab/nursing-related/waiting-specimen', 'FlaskConical'),
          sidebarItem('nursing-imaging', 'Lịch CĐHA của bệnh nhân', '/lab/nursing-related/patient-imaging-schedule', 'ScanLine'),
          sidebarItem('nursing-procedure', 'Lịch thủ thuật của bệnh nhân', '/lab/nursing-related/patient-procedure-schedule', 'CalendarDays'),
          sidebarItem('nursing-results', 'Kết quả đã có', '/lab/nursing-related/available-results', 'FileCheck2'),
          sidebarItem('nursing-critical', 'Cảnh báo critical liên quan', '/lab/nursing-related/related-critical-alerts', 'ShieldAlert'),
        ],
      }],
    };
  }

  const canReadConfigCommandCenter = isFullOps || hasAnyPermission(actor, [
    PERMISSION.LAB_TEST_CATALOG.READ,
    PERMISSION.SPECIMEN_TYPE_CATALOG.READ,
    PERMISSION.IMAGING_MODALITY_CATALOG.READ,
    PERMISSION.IMAGING_EQUIPMENT.READ,
    PERMISSION.PROCEDURE_CATALOG.READ,
    PERMISSION.CLINICAL_SLA_RULES.READ,
    PERMISSION.RESULT_REPORT_TEMPLATES.READ,
  ].filter(Boolean));
  if (canReadConfigCommandCenter) {
    configItems.push(sidebarItem('config-command-center', 'Configuration Command Center', '/clinical-ops/config', 'Settings2'));
  }
  if (isFullOps || hasAnyPermission(actor, [PERMISSION.LAB_TEST_CATALOG.READ])) {
    configItems.push(sidebarItem('config-lab-tests', 'Lab test catalog', '/clinical-ops/config/lab-tests', 'FlaskConical'));
  }
  if (isFullOps || hasAnyPermission(actor, [PERMISSION.SPECIMEN_TYPE_CATALOG.READ])) {
    configItems.push(sidebarItem('config-specimen-types', 'Loại mẫu bệnh phẩm', '/clinical-ops/config/specimen-types', 'Microscope'));
  }
  if (isFullOps || hasAnyPermission(actor, [PERMISSION.IMAGING_MODALITY_CATALOG.READ])) {
    configItems.push(sidebarItem('config-imaging-modalities', 'Imaging modality', '/clinical-ops/config/imaging-modalities', 'ScanLine'));
  }
  if (isFullOps || hasAnyPermission(actor, [PERMISSION.IMAGING_EQUIPMENT.READ])) {
    configItems.push(sidebarItem('config-imaging-rooms', 'Phòng / thiết bị CĐHA', '/clinical-ops/config/imaging-rooms-equipment', 'HardDrive'));
  }
  if (isFullOps || hasAnyPermission(actor, [PERMISSION.PROCEDURE_CATALOG.READ])) {
    configItems.push(sidebarItem('config-procedures', 'Danh mục thủ thuật', '/clinical-ops/config/procedures', 'Stethoscope'));
  }
  if (isFullOps || hasAnyPermission(actor, [
    PERMISSION.PROCEDURE_CATALOG.READ,
    PERMISSION.NURSING_TASKS.READ,
    PERMISSION.NURSING_TASKS.READ_DEPARTMENT,
  ])) {
    configItems.push(sidebarItem('config-checklists', 'Checklist thủ thuật', '/clinical-ops/config/procedure-checklists', 'ListChecks'));
  }
  if (isFullOps || hasAnyPermission(actor, [PERMISSION.CLINICAL_SLA_RULES.READ])) {
    configItems.push(sidebarItem('config-sla-alerts', 'SLA & cảnh báo', '/clinical-ops/config/sla-alerts', 'Timer'));
  }
  if (isFullOps || hasAnyPermission(actor, [PERMISSION.RESULT_REPORT_TEMPLATES.READ])) {
    configItems.push(sidebarItem('config-report-templates', 'Mẫu báo cáo kết quả', '/clinical-ops/config/result-report-templates', 'FileText'));
  }

  if (isFullOps) {
    const fullSections = fullClinicalOpsSidebarSections(items);
    if (configItems.length) {
      fullSections.push({
        id: 'config',
        label: 'Danh mục & cấu hình',
        items: configItems,
      });
    }
    fullSections.push({
      id: 'nursing-related',
      label: 'Cận lâm sàng liên quan',
      items: [
        sidebarItem('nursing-patient-preparation', 'Bệnh nhân cần chuẩn bị', '/clinical-ops/nursing-related/patient-preparation', 'Users'),
        sidebarItem('nursing-waiting-specimen', 'Chờ lấy mẫu', '/clinical-ops/nursing-related/waiting-specimen', 'FlaskConical'),
        sidebarItem('nursing-imaging-schedule', 'Lịch chẩn đoán hình ảnh của bệnh nhân', '/clinical-ops/nursing-related/patient-imaging-schedule', 'ScanLine'),
        sidebarItem('nursing-procedure-schedule', 'Lịch thủ thuật của bệnh nhân', '/clinical-ops/nursing-related/patient-procedure-schedule', 'CalendarDays'),
        sidebarItem('nursing-following-orders', 'Chỉ định đang theo dõi', '/clinical-ops/nursing-related/following-orders', 'ClipboardList'),
        sidebarItem('nursing-available-results', 'Kết quả đã có', '/clinical-ops/nursing-related/available-results', 'FileCheck2'),
        sidebarItem('nursing-related-critical-alerts', 'Cảnh báo nguy cấp liên quan', '/clinical-ops/nursing-related/related-critical-alerts', 'ShieldAlert'),
      ],
    });
    return {
      workspace: 'clinical-operations',
      role_scope: 'all',
      sections: fullSections,
    };
  }

  const sections = [{
    id: 'overview',
    label: 'Tổng quan',
    items,
  }];
  if (configItems.length) {
    sections.push({
      id: 'config',
      label: 'Danh mục & cấu hình',
      items: configItems,
    });
  }

  return {
    workspace: 'clinical-operations',
    role_scope: isFullOps ? 'all' : 'role_limited',
    sections,
  };
}

async function createEscalation(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffRead(actor);
  const entityType = normalizeString(payload.entity_type);
  const entityId = toObjectId(payload.entity_id, 'entity_id');
  const module = normalizeString(payload.module || entityType.split('_')[0]);
  const reason = normalizeString(payload.reason);
  if (!reason) throw ApiError.badRequest('reason là bắt buộc.');
  const escalation = await ClinicalOpsEscalation.create({
    entity_type: entityType,
    entity_id: entityId,
    module: ['lab', 'imaging', 'procedure', 'orders'].includes(module) ? module : 'orders',
    escalation_level: Number(payload.escalation_level || 1),
    reason,
    note: payload.note,
    escalated_by: actor.userId,
    escalated_to: (payload.escalated_to || []).filter((id) => mongoose.isValidObjectId(id)),
    created_by: actor.userId,
    updated_by: actor.userId,
  });
  await auditService.recordAuditLog({
    actor,
    action: 'clinical_ops.escalation.create',
    targetType: 'clinical_ops_escalation',
    targetId: escalation._id,
    status: 'success',
    message: 'Tạo escalation clinical operations.',
    requestMeta,
    metadata: { entity_type: entityType, entity_id: String(entityId), reason },
  }).catch(() => {});
  return escalation.toObject();
}

async function acknowledgeEscalation(escalationId, actor = {}, requestMeta = {}) {
  assertStaffRead(actor);
  const escalation = await ClinicalOpsEscalation.findById(escalationId);
  if (!escalation) throw ApiError.notFound('Không tìm thấy escalation.');
  if (escalation.status === 'resolved' || escalation.status === 'dismissed') {
    throw ApiError.conflict('Escalation đã kết thúc.');
  }
  escalation.status = 'acknowledged';
  escalation.acknowledged_by = actor.userId;
  escalation.acknowledged_at = new Date();
  escalation.updated_by = actor.userId;
  await escalation.save();
  await auditService.recordAuditLog({
    actor,
    action: 'clinical_ops.escalation.acknowledge',
    targetType: 'clinical_ops_escalation',
    targetId: escalation._id,
    status: 'success',
    message: 'Acknowledge escalation clinical operations.',
    requestMeta,
  }).catch(() => {});
  return escalation.toObject();
}

async function resolveEscalation(escalationId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffRead(actor);
  const escalation = await ClinicalOpsEscalation.findById(escalationId);
  if (!escalation) throw ApiError.notFound('Không tìm thấy escalation.');
  if (escalation.status === 'resolved') return escalation.toObject();
  escalation.status = 'resolved';
  escalation.resolved_by = actor.userId;
  escalation.resolved_at = new Date();
  escalation.note = payload.note || escalation.note;
  escalation.updated_by = actor.userId;
  await escalation.save();
  await auditService.recordAuditLog({
    actor,
    action: 'clinical_ops.escalation.resolve',
    targetType: 'clinical_ops_escalation',
    targetId: escalation._id,
    status: 'success',
    message: 'Resolve escalation clinical operations.',
    requestMeta,
  }).catch(() => {});
  return escalation.toObject();
}

function signatureHash({ entityType, entityId, signedBy, signedAt, snapshot }) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ entityType, entityId, signedBy, signedAt, snapshot }))
    .digest('hex');
}

async function signResult(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffRead(actor);
  const entityType = normalizeString(payload.entity_type);
  const entityId = toObjectId(payload.entity_id, 'entity_id');
  if (!['lab_result', 'imaging_report'].includes(entityType)) {
    throw ApiError.badRequest('entity_type phải là lab_result hoặc imaging_report.');
  }
  let finalized;
  if (entityType === 'lab_result') {
    finalized = await laboratoryService.finalizeLabResult(entityId, actor, requestMeta);
  } else {
    finalized = await imagingService.finalizeImagingReport(entityId, actor, requestMeta);
  }
  const signedAt = new Date();
  const snapshot = {
    entity_type: entityType,
    entity_id: String(entityId),
    finalized,
    signed_by: actor.userId,
    signed_at: signedAt,
  };
  const signature = await ResultSignature.create({
    entity_type: entityType,
    entity_id: entityId,
    signed_by: actor.userId,
    signed_at: signedAt,
    signature_method: payload.signature_method || 'system',
    signature_hash: signatureHash({ entityType, entityId: String(entityId), signedBy: actor.userId, signedAt, snapshot }),
    signature_snapshot: snapshot,
    created_by: actor.userId,
    updated_by: actor.userId,
  });
  await auditService.recordAuditLog({
    actor,
    action: 'clinical_ops.signature.sign',
    targetType: 'result_signature',
    targetId: signature._id,
    status: 'success',
    message: 'Ký kết quả clinical operations.',
    requestMeta,
    metadata: { entity_type: entityType, entity_id: String(entityId) },
  }).catch(() => {});
  return { signature: signature.toObject(), finalized };
}

async function revokeSignature(signatureId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffRead(actor);
  const signature = await ResultSignature.findById(signatureId);
  if (!signature) throw ApiError.notFound('Không tìm thấy chữ ký.');
  if (signature.status === 'revoked') return signature.toObject();
  signature.status = 'revoked';
  signature.revoked_by = actor.userId;
  signature.revoked_at = new Date();
  signature.revoke_reason = normalizeString(payload.revoke_reason || payload.reason);
  signature.updated_by = actor.userId;
  await signature.save();
  await auditService.recordAuditLog({
    actor,
    action: 'clinical_ops.signature.revoke',
    targetType: 'result_signature',
    targetId: signature._id,
    status: 'success',
    message: 'Thu hồi chữ ký kết quả clinical operations.',
    requestMeta,
    metadata: { reason: signature.revoke_reason },
  }).catch(() => {});
  return signature.toObject();
}

module.exports = {
  getDashboard,
  getTodayWorklist,
  getStatUrgent,
  getCriticalResults,
  getPendingCompletion,
  getPendingApproval,
  getOverdueOrders,
  getSidebar,
  createEscalation,
  acknowledgeEscalation,
  resolveEscalation,
  signResult,
  revokeSignature,
};
