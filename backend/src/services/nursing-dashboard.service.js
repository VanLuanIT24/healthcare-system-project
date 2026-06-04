const { Types } = require('mongoose');
const {
  Admission,
  BedAssignment,
  EmergencyCase,
  Encounter,
  InpatientTask,
  MedicationAdministration,
  Notification,
  Allergy,
  Appointment,
  ClinicalNote,
  NursingIntake,
  NursingTask,
  Order,
  Patient,
  ProblemList,
  QueueTicket,
  ServicePreparationChecklist,
  TriageAssessment,
  VitalSign,
  Department,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  ADMISSION_STATUS,
  ADMINISTRATION_STATUS,
  EMERGENCY_STATUS,
  ENCOUNTER_STATUS,
  INPATIENT_TASK_STATUS,
  NURSING_WORKFLOW_STATUS,
  NURSING_WORKFLOW_STATUSES,
  CLINICAL_NOTE_STATUS,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_RECIPIENT_TYPE,
  NOTIFICATION_STATUS,
  ORDER_STATUS,
  ORDER_TYPE,
  QUEUE_STATUS,
  VITAL_SIGN_STATUS,
} = require('../constants/statuses');
const permissionService = require('./permission.service');
const workspaceAccessService = require('./workspace-access.service');
const {
  buildPagination,
  createError,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeString,
  recordAuditLog,
} = require('./core.service');

const OPEN_QUEUE_STATUSES = [
  QUEUE_STATUS.WAITING,
  QUEUE_STATUS.CALLED,
  QUEUE_STATUS.RECALLED,
  QUEUE_STATUS.SKIPPED,
  QUEUE_STATUS.IN_SERVICE,
];

const OPEN_EMERGENCY_STATUSES = [
  EMERGENCY_STATUS.CREATED,
  EMERGENCY_STATUS.ACKNOWLEDGED,
  EMERGENCY_STATUS.TRIAGED,
  EMERGENCY_STATUS.DISPATCHED,
];

const ACTIVE_ENCOUNTER_STATUSES = [
  ENCOUNTER_STATUS.PLANNED,
  ENCOUNTER_STATUS.ARRIVED,
  ENCOUNTER_STATUS.IN_PROGRESS,
  ENCOUNTER_STATUS.ON_HOLD,
];

const OPEN_ORDER_STATUSES = [
  ORDER_STATUS.ORDERED,
  ORDER_STATUS.ACKNOWLEDGED,
  ORDER_STATUS.IN_PROGRESS,
];

const PREPARATION_ORDER_TYPES = [
  ORDER_TYPE.LAB,
  ORDER_TYPE.IMAGING,
  ORDER_TYPE.PROCEDURE,
  ORDER_TYPE.SERVICE,
  ORDER_TYPE.NURSING,
];

const CHECKLIST_ORDER_TYPES = [
  ORDER_TYPE.LAB,
  ORDER_TYPE.IMAGING,
  ORDER_TYPE.PROCEDURE,
  ORDER_TYPE.SERVICE,
];

const OPEN_TASK_STATUSES = ['draft', 'assigned', 'accepted', 'todo', 'in_progress', 'blocked', 'waiting_doctor', 'overdue'];
const DEFAULT_LIMIT = 80;
const NURSING_WAITING_SLA_MINUTES = 30;
const EMERGENCY_ACK_SLA_MINUTES = 5;
const NURSING_COMMAND_MENUS = [
  { id: 'dashboard', group: 'Tổng quan', label: 'Bảng điều khiển', route: '/nurse/dashboard', keywords: ['dashboard', 'tong quan'] },
  { id: 'pending-processing', group: 'Tổng quan', label: 'Bệnh nhân chờ xử lý', route: '/nurse/overview/pending-processing', keywords: ['benh nhan', 'cho xu ly'] },
  { id: 'priority-alerts', group: 'Tổng quan', label: 'Cảnh báo ưu tiên', route: '/nurse/overview/priority-alerts', keywords: ['canh bao', 'uu tien'] },
  { id: 'vitals-waiting', group: 'Sinh hiệu và ghi nhận', label: 'Chờ đo sinh hiệu', route: '/nurse/vitals-records/waiting', keywords: ['sinh hieu', 'cho do'] },
  { id: 'vitals-entry', group: 'Sinh hiệu và ghi nhận', label: 'Nhập sinh hiệu', route: '/nurse/vitals-records/entry', keywords: ['nhap sinh hieu', 'do sinh hieu'] },
  { id: 'vitals-abnormal', group: 'Sinh hiệu và ghi nhận', label: 'Sinh hiệu bất thường', route: '/nurse/vitals-records/abnormal', keywords: ['bat thuong', 'critical', 'spo2'] },
  { id: 'waiting-triage', group: 'Tiếp nhận và phân loại', label: 'Chờ phân loại', route: '/nurse/reception-triage/waiting-triage', keywords: ['triage', 'phan loai'] },
  { id: 'ready-for-doctor', group: 'Tiếp nhận và phân loại', label: 'Sẵn sàng gặp bác sĩ', route: '/nurse/reception-triage/ready-for-doctor', keywords: ['bac si', 'ready'] },
  { id: 'service-preparation', group: 'Chuẩn bị dịch vụ', label: 'Chờ chuẩn bị', route: '/nurse/service-preparation/waiting', keywords: ['chuan bi', 'cls'] },
  { id: 'monitoring-alerts', group: 'Theo dõi và báo bác sĩ', label: 'Cảnh báo bất thường', route: '/nurse/monitoring-reporting/abnormal-alerts', keywords: ['theo doi', 'bao bac si'] },
  { id: 'tasks-assigned', group: 'Nhiệm vụ và bàn giao', label: 'Nhiệm vụ được giao', route: '/nurse/tasks-handover/assigned', keywords: ['task', 'nhiem vu'] },
  { id: 'tasks-overdue', group: 'Nhiệm vụ và bàn giao', label: 'Nhiệm vụ quá hạn', route: '/nurse/tasks-handover/overdue', keywords: ['qua han', 'overdue'] },
  { id: 'shift-handover', group: 'Nhiệm vụ và bàn giao', label: 'Bàn giao ca', route: '/nurse/tasks-handover/shift-handover', keywords: ['ban giao', 'ca truc'] },
  { id: 'inpatient-list', group: 'Nội trú', label: 'Danh sách nội trú', route: '/nurse/inpatient/list', keywords: ['noi tru', 'giuong'] },
  { id: 'emergency-open', group: 'Cấp cứu', label: 'Ca khẩn đang mở', route: '/nurse/emergency/open-cases', keywords: ['cap cuu', 'khan'] },
  { id: 'patient-profile', group: 'Tra cứu bệnh nhân', label: 'Hồ sơ bệnh nhân', route: '/nurse/patient-lookup/profile', keywords: ['ho so', 'patient'] },
];

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes);
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || null;
}

function actorRoles(actor = {}) {
  return Array.isArray(actor.roles) ? actor.roles : actor.user?.roles || [];
}

function hasGlobalNursingScope(actor = {}) {
  return hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.READ,
    PERMISSION.QUEUE.READ,
    PERMISSION.ENCOUNTERS.READ,
  ]) || actorRoles(actor).some((role) => ['super_admin', 'admin', 'manager', 'department_head'].includes(role));
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(value);
}

function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return String(value);
  if (value._id) return normalizeId(value._id);
  if (value.id) return normalizeId(value.id);
  if (typeof value.toString === 'function') {
    const output = value.toString();
    return output && output !== '[object Object]' ? output : null;
  }
  return null;
}

function definedObject(input = {}) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function sameId(left, right) {
  return String(normalizeId(left) || '') === String(normalizeId(right) || '');
}

function parseDate(value, fieldName = 'date') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addHours(date, hours) {
  const output = new Date(date);
  output.setHours(output.getHours() + hours);
  return output;
}

function getShiftRange(dayStart, shift) {
  const start = new Date(dayStart);
  const end = new Date(dayStart);

  if (shift === 'morning') {
    start.setHours(6, 0, 0, 0);
    end.setHours(13, 59, 59, 999);
    return { rangeStart: start, rangeEnd: end };
  }

  if (shift === 'afternoon') {
    start.setHours(14, 0, 0, 0);
    end.setHours(21, 59, 59, 999);
    return { rangeStart: start, rangeEnd: end };
  }

  if (shift === 'night') {
    start.setHours(22, 0, 0, 0);
    end.setHours(5, 59, 59, 999);
    return { rangeStart: start, rangeEnd: addHours(end, 24) };
  }

  return { rangeStart: dayStart, rangeEnd: getEndOfDay(dayStart) };
}

function normalizeFilters(query = {}, actor = {}) {
  const selectedDate = parseDate(query.date, 'date') || new Date();
  const dayStart = getStartOfDay(selectedDate);
  const dayEnd = getEndOfDay(selectedDate);
  const shift = ['morning', 'afternoon', 'night'].includes(normalizeString(query.shift).toLowerCase())
    ? normalizeString(query.shift).toLowerCase()
    : 'all';
  const { rangeStart, rangeEnd } = getShiftRange(dayStart, shift);
  const requestedDepartmentId = normalizeString(query.department_id || query.departmentId);
  const actorDepartment = actorDepartmentId(actor);
  const globalScope = hasGlobalNursingScope(actor);

  if (!globalScope && requestedDepartmentId && actorDepartment && !sameId(requestedDepartmentId, actorDepartment)) {
    throw createError('Bạn chỉ được xem dashboard điều dưỡng trong khoa/phòng được phân quyền.', 403);
  }

  const departmentId = requestedDepartmentId || (!globalScope ? actorDepartment : null);
  if (!globalScope && !departmentId) {
    throw createError('Không xác định được khoa/phòng của điều dưỡng hiện tại.', 403);
  }
  const requestedNurseId = normalizeString(query.nurse_id || query.nurseId);
  const requestedNurseKey = requestedNurseId.toLowerCase();
  const requestedAssignment = normalizeString(query.assigned_to || query.assignedTo);
  const requestedAssignmentKey = requestedAssignment.toLowerCase();
  const currentUserId = actorUserId(actor);
  const nurseId = requestedNurseKey === 'me' || requestedAssignmentKey === 'me'
    ? currentUserId
    : requestedNurseKey === 'unassigned'
      ? null
      : requestedNurseId;
  const assignmentFilter = requestedNurseKey === 'unassigned'
    ? 'unassigned'
    : requestedAssignmentKey === 'unassigned'
      ? 'unassigned'
      : requestedAssignmentKey === 'me'
        ? ''
        : requestedAssignment;

  return {
    date: selectedDate,
    date_key: toDateKey(selectedDate),
    day_start: dayStart,
    day_end: dayEnd,
    range_start: rangeStart,
    range_end: rangeEnd,
    shift,
    department_id: departmentId ? String(departmentId) : null,
    department_object_id: departmentId ? toObjectId(departmentId, 'department_id') : null,
    nurse_id: nurseId ? String(nurseId) : '',
    priority: normalizeString(query.priority).toLowerCase(),
    type: normalizeString(query.type).toLowerCase(),
    status: normalizeString(query.status).toLowerCase(),
    assigned_to: assignmentFilter,
    now: new Date(),
  };
}

function addDepartmentFilter(filter, filters, field = 'department_id') {
  if (filters.department_object_id) filter[field] = filters.department_object_id;
  return filter;
}

function ageFromDate(value) {
  if (!value) return null;
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function patientDto(patient = {}) {
  const value = patient && typeof patient === 'object' ? patient : {};
  return {
    patient_id: normalizeId(value),
    patient_code: value.patient_code || null,
    patient_name: value.full_name || value.patient_name || 'Chưa rõ bệnh nhân',
    gender: value.gender || null,
    age: ageFromDate(value.date_of_birth),
    phone: value.phone || null,
  };
}

function userName(user = {}) {
  if (!user || typeof user !== 'object') return null;
  return user.full_name || user.employee_code || null;
}

function minutesSince(value, now = new Date()) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
}

function severityRank(severity) {
  return {
    critical: 5,
    high: 4,
    urgent: 4,
    medium: 3,
    warning: 2,
    low: 1,
    normal: 0,
  }[severity] || 0;
}

function priorityRank(priority) {
  return {
    critical: 5,
    high: 4,
    medium: 3,
    normal: 2,
    low: 1,
  }[priority] || 0;
}

function normalizePriority(priority) {
  if (['critical', 'stat'].includes(priority)) return 'critical';
  if (['high', 'urgent', 'vip', 'priority'].includes(priority)) return 'high';
  if (['medium', 'warning', 'routine', 'normal'].includes(priority)) return 'medium';
  return 'normal';
}

function numeric(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function vitalFlag(field, value, severity, message, displayValue = value) {
  if (value === undefined || value === null || value === '') return null;
  return {
    field,
    value,
    display_value: displayValue,
    severity,
    message,
  };
}

function buildAbnormalFlags(vital = {}) {
  const spo2 = numeric(vital.spo2);
  const systolicBp = numeric(vital.systolic_bp);
  const diastolicBp = numeric(vital.diastolic_bp);
  const heartRate = numeric(vital.heart_rate);
  const respiratoryRate = numeric(vital.respiratory_rate);
  const temperature = numeric(vital.temperature);

  return [
    spo2 !== null && spo2 < 90 ? vitalFlag('spo2', spo2, 'critical', 'SpO2 thấp', `${spo2}%`) : null,
    systolicBp !== null && systolicBp >= 180 ? vitalFlag('systolic_bp', systolicBp, 'critical', 'Huyết áp tâm thu rất cao', `${systolicBp} mmHg`) : null,
    systolicBp !== null && systolicBp < 90 ? vitalFlag('systolic_bp', systolicBp, 'high', 'Huyết áp tâm thu thấp', `${systolicBp} mmHg`) : null,
    diastolicBp !== null && diastolicBp >= 120 ? vitalFlag('diastolic_bp', diastolicBp, 'critical', 'Huyết áp tâm trương rất cao', `${diastolicBp} mmHg`) : null,
    heartRate !== null && heartRate >= 130 ? vitalFlag('heart_rate', heartRate, 'high', 'Mạch nhanh', `${heartRate} bpm`) : null,
    heartRate !== null && heartRate < 50 ? vitalFlag('heart_rate', heartRate, 'high', 'Mạch chậm', `${heartRate} bpm`) : null,
    respiratoryRate !== null && respiratoryRate >= 30 ? vitalFlag('respiratory_rate', respiratoryRate, 'high', 'Nhịp thở nhanh', `${respiratoryRate}/phút`) : null,
    respiratoryRate !== null && respiratoryRate < 8 ? vitalFlag('respiratory_rate', respiratoryRate, 'critical', 'Nhịp thở rất chậm', `${respiratoryRate}/phút`) : null,
    temperature !== null && temperature >= 39 ? vitalFlag('temperature', temperature, 'high', 'Sốt cao', `${temperature}°C`) : null,
    temperature !== null && temperature < 35 ? vitalFlag('temperature', temperature, 'high', 'Hạ thân nhiệt', `${temperature}°C`) : null,
  ].filter(Boolean);
}

function getOverallSeverity(flags = []) {
  if (flags.some((flag) => flag.severity === 'critical')) return 'critical';
  if (flags.some((flag) => flag.severity === 'high')) return 'high';
  if (flags.some((flag) => flag.severity === 'warning')) return 'warning';
  return 'normal';
}

function normalizeVitalFlags(vital = {}) {
  const flags = Array.isArray(vital.abnormal_flags) && vital.abnormal_flags.length
    ? vital.abnormal_flags
    : buildAbnormalFlags(vital);
  const overall = vital.overall_severity && vital.overall_severity !== 'normal'
    ? vital.overall_severity
    : getOverallSeverity(flags);
  return { flags, overall };
}

function getVitalAlertMessage(flags = [], vital = {}) {
  if (flags.length) {
    return flags
      .slice(0, 2)
      .map((flag) => `${flag.field === 'spo2' ? 'SpO2' : flag.message} ${flag.display_value || flag.value}`)
      .join(' · ');
  }
  if (vital.systolic_bp && vital.diastolic_bp) return `HA ${vital.systolic_bp}/${vital.diastolic_bp}`;
  if (vital.spo2) return `SpO2 ${vital.spo2}%`;
  return 'Sinh hiệu cần xem lại';
}

function formatQueueItem(ticket = {}, filters = {}) {
  const waitingSince = ticket.checkin_time || ticket.created_at;
  return {
    queue_ticket_id: normalizeId(ticket),
    queue_number: ticket.display_number || ticket.queue_number,
    patient: patientDto(ticket.patient_id),
    patient_id: normalizeId(ticket.patient_id),
    patient_code: ticket.patient_id?.patient_code || null,
    patient_name: ticket.patient_id?.full_name || 'Chưa rõ bệnh nhân',
    doctor_id: normalizeId(ticket.doctor_id),
    doctor_name: userName(ticket.doctor_id),
    assigned_nurse_id: normalizeId(ticket.assigned_nurse_id),
    assigned_nurse_name: userName(ticket.assigned_nurse_id),
    department_id: normalizeId(ticket.department_id),
    department_name: ticket.department_id?.department_name || null,
    encounter_id: normalizeId(ticket.encounter_id),
    appointment_id: normalizeId(ticket.appointment_id),
    status: ticket.status,
    nursing_stage: ticket.nursing_stage || NURSING_WORKFLOW_STATUS.WAITING_NURSE,
    queue_type: ticket.queue_type,
    checkin_time: ticket.checkin_time,
    called_time: ticket.called_time,
    service_start_time: ticket.service_start_time,
    skipped_at: ticket.skipped_at,
    no_show_at: ticket.no_show_at,
    priority_reason: ticket.priority_reason || null,
    waiting_minutes: minutesSince(waitingSince, filters.now),
  };
}

function statusCounts(items = [], key = 'status') {
  return items.reduce((counts, item) => {
    const status = item[key] || 'unknown';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function isOpenTask(task = {}) {
  return OPEN_TASK_STATUSES.includes(task.status);
}

function isOverdue(value, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime();
}

function taskPriority(task = {}, now = new Date()) {
  if (task.priority) return normalizePriority(task.priority);
  return isOverdue(task.due_at, now) ? 'high' : 'medium';
}

function taskDto(task = {}, sourceType = 'nursing_task', now = new Date()) {
  const patient = patientDto(task.patient_id);
  const overdue = isOverdue(task.due_at, now) && isOpenTask(task);
  return {
    id: `${sourceType}_${normalizeId(task)}`,
    source_type: sourceType,
    source_id: normalizeId(task),
    task_id: normalizeId(task),
    patient_id: patient.patient_id,
    patient_code: patient.patient_code,
    patient_name: patient.patient_name,
    type: task.task_type || task.type || 'nursing_task',
    title: task.title || 'Nhiệm vụ điều dưỡng',
    reason: task.description || task.title || 'Nhiệm vụ điều dưỡng cần xử lý',
    priority: overdue ? 'high' : taskPriority(task, now),
    status: overdue ? 'overdue' : task.status,
    due_at: task.due_at,
    waiting_since: task.created_at,
    overdue_minutes: overdue ? minutesSince(task.due_at, now) : 0,
    assigned_to: normalizeId(task.assigned_to),
    assigned_to_name: userName(task.assigned_to),
    actions: ['start_task', 'complete_task', 'create_nursing_note'],
  };
}

function buildWorkItem({
  id,
  type,
  priority = 'medium',
  patient,
  encounterId = null,
  queueTicketId = null,
  admissionId = null,
  sourceType,
  sourceId,
  reason,
  status = 'pending',
  location = null,
  assignedTo = null,
  assignedToName = null,
  waitingSince = null,
  overdueMinutes = 0,
  flags = [],
  actions = [],
  metadata = {},
}) {
  const patientInfo = patientDto(patient);
  return {
    id,
    type,
    priority,
    patient_id: patientInfo.patient_id,
    patient_code: patientInfo.patient_code,
    patient_name: patientInfo.patient_name,
    gender: patientInfo.gender,
    age: patientInfo.age,
    encounter_id: encounterId,
    queue_ticket_id: queueTicketId,
    admission_id: admissionId,
    source_type: sourceType,
    source_id: sourceId,
    reason,
    status,
    location,
    assigned_to: normalizeId(assignedTo),
    assigned_to_name: assignedToName || userName(assignedTo),
    waiting_since: waitingSince,
    overdue_minutes: overdueMinutes,
    flags,
    actions,
    metadata,
  };
}

function sortWorkItems(items = []) {
  return [...items].sort((a, b) => {
    const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
    if (priorityDiff) return priorityDiff;
    return new Date(a.waiting_since || 0).getTime() - new Date(b.waiting_since || 0).getTime();
  });
}

function filterWorkItems(items = [], filters = {}) {
  return items.filter((item) => {
    if (filters.type && filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.priority && filters.priority !== 'all' && item.priority !== filters.priority) return false;
    if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.assigned_to === 'unassigned' && item.assigned_to) return false;
    if (filters.nurse_id && !sameId(item.assigned_to, filters.nurse_id)) return false;
    return true;
  });
}

async function fetchQueueTickets(filters = {}) {
  const queueFilter = {
    queue_date: filters.day_start,
  };
  addDepartmentFilter(queueFilter, filters);
  if (filters.shift !== 'all') {
    queueFilter.checkin_time = { $gte: filters.range_start, $lte: filters.range_end };
  }

  return QueueTicket.find(queueFilter)
    .sort({ checkin_time: 1, created_at: 1, queue_number: 1 })
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('doctor_id', 'full_name employee_code')
    .populate('assigned_nurse_id', 'full_name employee_code')
    .populate('department_id', 'department_name department_code')
    .lean();
}

async function fetchEncounters(filters = {}, queueTickets = []) {
  const queueEncounterIds = queueTickets.map((ticket) => normalizeId(ticket.encounter_id)).filter(Boolean);
  const dateFilter = { start_time: { $gte: filters.day_start, $lte: filters.day_end } };
  const encounterFilter = queueEncounterIds.length
    ? { $or: [dateFilter, { _id: { $in: queueEncounterIds.map((id) => toObjectId(id, 'encounter_id')) } }] }
    : dateFilter;
  addDepartmentFilter(encounterFilter, filters);

  return Encounter.find(encounterFilter)
    .sort({ start_time: 1, created_at: 1 })
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('attending_doctor_id', 'full_name employee_code')
    .populate('assigned_nurse_id', 'full_name employee_code')
    .populate('department_id', 'department_name department_code')
    .lean();
}

async function fetchVitals(filters = {}, encounters = [], queueTickets = []) {
  const encounterIds = encounters.map((encounter) => normalizeId(encounter)).filter(Boolean);
  const queueTicketIds = queueTickets.map((ticket) => normalizeId(ticket)).filter(Boolean);
  const vitalFilter = {
    recorded_at: { $gte: filters.range_start, $lte: filters.range_end },
  };

  const contextFilters = [];
  if (encounterIds.length) {
    contextFilters.push({ encounter_id: { $in: encounterIds.map((id) => toObjectId(id, 'encounter_id')) } });
  }
  if (queueTicketIds.length) {
    contextFilters.push({ queue_ticket_id: { $in: queueTicketIds.map((id) => toObjectId(id, 'queue_ticket_id')) } });
  }

  if (contextFilters.length) {
    vitalFilter.$or = contextFilters;
  } else if (filters.department_object_id) {
    vitalFilter.encounter_id = { $in: [] };
  }

  const [recorded, enteredInError] = await Promise.all([
    VitalSign.find({ ...vitalFilter, status: { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR } })
      .sort({ recorded_at: -1 })
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate({
        path: 'encounter_id',
        select: 'encounter_code patient_id department_id attending_doctor_id nursing_status',
        populate: [
          { path: 'patient_id', select: 'patient_code full_name gender date_of_birth phone' },
          { path: 'department_id', select: 'department_name department_code' },
          { path: 'attending_doctor_id', select: 'full_name employee_code' },
        ],
      })
      .populate({
        path: 'queue_ticket_id',
        select: 'queue_number display_number patient_id department_id doctor_id nursing_stage encounter_id',
        populate: [
          { path: 'patient_id', select: 'patient_code full_name gender date_of_birth phone' },
          { path: 'department_id', select: 'department_name department_code' },
          { path: 'doctor_id', select: 'full_name employee_code' },
        ],
      })
      .populate({
        path: 'appointment_id',
        select: 'appointment_time appointment_type reason status patient_id department_id doctor_id',
        populate: [
          { path: 'patient_id', select: 'patient_code full_name gender date_of_birth phone' },
          { path: 'department_id', select: 'department_name department_code' },
          { path: 'doctor_id', select: 'full_name employee_code' },
        ],
      })
      .lean(),
    VitalSign.countDocuments({ ...vitalFilter, status: VITAL_SIGN_STATUS.ENTERED_IN_ERROR }),
  ]);

  return { recorded, enteredInError };
}

async function fetchOrders(filters = {}) {
  const orderFilter = {
    ordered_at: { $gte: filters.range_start, $lte: filters.range_end },
    status: { $in: OPEN_ORDER_STATUSES },
    order_type: { $in: PREPARATION_ORDER_TYPES },
  };
  addDepartmentFilter(orderFilter, filters);

  return Order.find(orderFilter)
    .sort({ priority: -1, ordered_at: 1 })
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('encounter_id', 'encounter_code nursing_status status')
    .populate('ordered_by', 'full_name employee_code')
    .lean();
}

async function fetchEmergencyCases(filters = {}) {
  const emergencyFilter = {
    status: { $in: OPEN_EMERGENCY_STATUSES },
  };
  addDepartmentFilter(emergencyFilter, filters, 'assigned_department_id');

  return EmergencyCase.find(emergencyFilter)
    .sort({ priority: -1, created_at: 1 })
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('assigned_to_user_id', 'full_name employee_code')
    .populate('assigned_department_id', 'department_name department_code')
    .lean();
}

async function fetchAdmissions(filters = {}) {
  const admissionFilter = {
    status: { $in: [ADMISSION_STATUS.ADMITTED, ADMISSION_STATUS.TRANSFERRED] },
  };
  addDepartmentFilter(admissionFilter, filters);

  return Admission.find(admissionFilter)
    .sort({ admitted_at: -1, created_at: -1 })
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('department_id', 'department_name department_code')
    .lean();
}

async function fetchNursingTasks(filters = {}) {
  const taskFilter = {
    $or: [
      { due_at: { $gte: filters.day_start, $lte: filters.day_end } },
      { status: { $in: OPEN_TASK_STATUSES }, due_at: { $lte: filters.now } },
    ],
  };
  addDepartmentFilter(taskFilter, filters);
  if (filters.assigned_to === 'unassigned') taskFilter.assigned_to = null;
  if (filters.nurse_id) taskFilter.assigned_to = toObjectId(filters.nurse_id, 'nurse_id');

  return NursingTask.find(taskFilter)
    .sort({ due_at: 1, priority: -1, created_at: 1 })
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('assigned_to', 'full_name employee_code')
    .lean();
}

async function fetchTriageAssessments(filters = {}) {
  const triageFilter = {
    created_at: { $gte: filters.day_start, $lte: filters.day_end },
  };
  addDepartmentFilter(triageFilter, filters);

  return TriageAssessment.find(triageFilter)
    .sort({ priority: -1, created_at: -1 })
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('queue_ticket_id', 'queue_number display_number status checkin_time nursing_stage')
    .populate('encounter_id', 'encounter_code nursing_status status')
    .populate('triage_by', 'full_name employee_code')
    .lean();
}

async function fetchPreparationChecklists(filters = {}) {
  const checklistFilter = {
    status: { $in: ['pending', 'in_progress'] },
  };
  addDepartmentFilter(checklistFilter, filters);
  if (filters.assigned_to === 'unassigned') checklistFilter.assigned_to = null;
  if (filters.nurse_id) checklistFilter.assigned_to = toObjectId(filters.nurse_id, 'nurse_id');

  return ServicePreparationChecklist.find(checklistFilter)
    .sort({ created_at: 1 })
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('order_id', 'order_no order_type priority status clinical_indication ordered_at')
    .populate('assigned_to', 'full_name employee_code')
    .lean();
}

async function fetchInpatientData(filters = {}, admissions = []) {
  const admissionIds = admissions.map((admission) => normalizeId(admission)).filter(Boolean);
  if (!admissionIds.length) {
    return {
      bedAssignments: [],
      inpatientTasks: [],
      medicationDue: [],
    };
  }

  const admissionObjectIds = admissionIds.map((id) => toObjectId(id, 'admission_id'));
  const [bedAssignments, inpatientTasks, medicationDue] = await Promise.all([
    BedAssignment.find({ admission_id: { $in: admissionObjectIds }, status: 'active' })
      .populate({
        path: 'bed_id',
        select: 'bed_number room_id',
        populate: { path: 'room_id', select: 'room_number room_name' },
      })
      .lean(),
    InpatientTask.find({
      admission_id: { $in: admissionObjectIds },
      $or: [
        { due_at: { $gte: filters.day_start, $lte: filters.day_end } },
        { status: { $in: [INPATIENT_TASK_STATUS.TODO, INPATIENT_TASK_STATUS.IN_PROGRESS] }, due_at: { $lte: filters.now } },
      ],
    })
      .sort({ due_at: 1, created_at: 1 })
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('assigned_to', 'full_name employee_code')
      .lean(),
    MedicationAdministration.find({
      admission_id: { $in: admissionObjectIds },
      status: ADMINISTRATION_STATUS.SCHEDULED,
      scheduled_at: { $lte: addHours(filters.now, 1) },
    })
      .sort({ scheduled_at: 1 })
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('medication_id', 'generic_name brand_name')
      .lean(),
  ]);

  return { bedAssignments, inpatientTasks, medicationDue };
}

async function fetchUnreadNotifications(actor = {}) {
  const userId = actorUserId(actor);
  if (!userId || !Types.ObjectId.isValid(String(userId))) return 0;
  return Notification.countDocuments({
    recipient_user_id: toObjectId(userId, 'user_id'),
    read_at: null,
    archived_at: null,
  });
}

async function fetchNotificationActivity(actor = {}, limit = 10) {
  const userId = actorUserId(actor);
  if (!userId || !Types.ObjectId.isValid(String(userId))) return [];

  return Notification.find({
    recipient_user_id: toObjectId(userId, 'user_id'),
    archived_at: null,
  })
    .sort({ created_at: -1 })
    .limit(limit)
    .select('title message notification_type event_type priority action_url read_at created_at')
    .lean();
}

function buildMaps({ queueTickets = [], encounters = [], admissions = [], bedAssignments = [] }) {
  const encountersById = new Map(encounters.map((encounter) => [String(normalizeId(encounter)), encounter]));
  const queueByEncounter = new Map();
  queueTickets.forEach((ticket) => {
    const encounterId = normalizeId(ticket.encounter_id);
    if (encounterId) queueByEncounter.set(encounterId, ticket);
  });

  const bedByAdmission = new Map();
  bedAssignments.forEach((assignment) => {
    const admissionId = normalizeId(assignment.admission_id);
    if (!admissionId) return;
    const bed = assignment.bed_id || {};
    const room = bed.room_id || {};
    bedByAdmission.set(admissionId, {
      bed_id: normalizeId(bed),
      bed_number: bed.bed_number || null,
      room_id: normalizeId(room),
      room_name: room.room_name || room.room_number || null,
    });
  });

  const admissionsById = new Map(admissions.map((admission) => [String(normalizeId(admission)), admission]));
  return { encountersById, queueByEncounter, bedByAdmission, admissionsById };
}

function buildVitalSummaries(vitals = [], encountersById = new Map()) {
  const vitalEncounterIds = new Set();
  const vitalQueueIds = new Set();
  const latestByEncounter = new Map();
  const latestByQueue = new Map();
  const abnormal = [];

  vitals.forEach((vital) => {
    const encounterId = normalizeId(vital.encounter_id);
    const queueTicketId = normalizeId(vital.queue_ticket_id);
    if (encounterId) {
      vitalEncounterIds.add(encounterId);
      if (!latestByEncounter.has(encounterId)) latestByEncounter.set(encounterId, vital);
    }
    if (queueTicketId) {
      vitalQueueIds.add(queueTicketId);
      if (!latestByQueue.has(queueTicketId)) latestByQueue.set(queueTicketId, vital);
    }

    const { flags, overall } = normalizeVitalFlags(vital);
    if (overall !== 'normal') {
      const encounter = encountersById.get(encounterId) || vital.encounter_id || {};
      const queueTicket = vital.queue_ticket_id && typeof vital.queue_ticket_id === 'object' ? vital.queue_ticket_id : {};
      const appointment = vital.appointment_id && typeof vital.appointment_id === 'object' ? vital.appointment_id : {};
      const patient = vital.patient_id && typeof vital.patient_id === 'object'
        ? vital.patient_id
        : encounter.patient_id || queueTicket.patient_id || appointment.patient_id;
      const department = encounter.department_id || queueTicket.department_id || appointment.department_id;
      const doctor = encounter.attending_doctor_id || queueTicket.doctor_id || appointment.doctor_id;
      abnormal.push({
        vital_sign_id: normalizeId(vital),
        encounter_id: encounterId,
        queue_ticket_id: queueTicketId,
        appointment_id: normalizeId(vital.appointment_id),
        patient: patientDto(patient),
        patient_id: normalizeId(patient),
        patient_code: patient?.patient_code || null,
        patient_name: patient?.full_name || 'Chưa rõ bệnh nhân',
        age: ageFromDate(patient?.date_of_birth),
        gender: patient?.gender || null,
        phone: patient?.phone || null,
        queue_number: queueTicket.display_number || queueTicket.queue_number || null,
        department_id: normalizeId(department),
        department_name: department?.department_name || null,
        doctor_id: normalizeId(doctor),
        doctor_name: userName(doctor),
        recorded_at: vital.recorded_at,
        status: vital.status,
        overall_severity: overall,
        severity: overall,
        abnormal_flags: flags,
        message: getVitalAlertMessage(flags, vital),
        requires_recheck: Boolean(vital.requires_recheck),
        suggested_recheck_minutes: vital.suggested_recheck_minutes || null,
        requires_doctor_notification: vital.requires_doctor_notification ?? ['high', 'critical'].includes(overall),
        related_task_id: normalizeId(vital.related_task_id),
        acknowledged_at: vital.acknowledged_at || null,
        doctor_notified_at: vital.doctor_notified_at || null,
        escalated_at: vital.escalated_at || null,
        escalation_reason: vital.escalation_reason || null,
        values: {
          temperature: vital.temperature ?? null,
          heart_rate: vital.heart_rate ?? null,
          respiratory_rate: vital.respiratory_rate ?? null,
          systolic_bp: vital.systolic_bp ?? null,
          diastolic_bp: vital.diastolic_bp ?? null,
          spo2: vital.spo2 ?? null,
        },
      });
    }
  });

  abnormal.sort((a, b) => {
    const severityDiff = severityRank(b.severity) - severityRank(a.severity);
    if (severityDiff) return severityDiff;
    return new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime();
  });

  return { vitalEncounterIds, vitalQueueIds, latestByEncounter, latestByQueue, abnormal };
}

function buildPendingVitals(queueTickets = [], encountersById = new Map(), vitalSummary = {}, filters = {}) {
  const vitalEncounterIds = vitalSummary.vitalEncounterIds || new Set();
  const vitalQueueIds = vitalSummary.vitalQueueIds || new Set();
  return queueTickets
    .filter((ticket) => OPEN_QUEUE_STATUSES.includes(ticket.status))
    .filter((ticket) => {
      const encounterId = normalizeId(ticket.encounter_id);
      const queueTicketId = normalizeId(ticket);
      return !vitalQueueIds.has(queueTicketId) && (!encounterId || !vitalEncounterIds.has(encounterId));
    })
    .map((ticket) => {
      const encounterId = normalizeId(ticket.encounter_id);
      const encounter = encounterId ? encountersById.get(encounterId) : null;
      const waitingSince = ticket.checkin_time || ticket.created_at;
      const waitingMinutes = minutesSince(waitingSince, filters.now);
      return {
        queue_ticket_id: normalizeId(ticket),
        encounter_id: encounterId,
        patient: patientDto(ticket.patient_id || encounter?.patient_id),
        patient_id: normalizeId(ticket.patient_id || encounter?.patient_id),
        patient_code: ticket.patient_id?.patient_code || encounter?.patient_id?.patient_code || null,
        patient_name: ticket.patient_id?.full_name || encounter?.patient_id?.full_name || 'Chưa rõ bệnh nhân',
        age: ageFromDate(ticket.patient_id?.date_of_birth || encounter?.patient_id?.date_of_birth),
        gender: ticket.patient_id?.gender || encounter?.patient_id?.gender || null,
        phone: ticket.patient_id?.phone || encounter?.patient_id?.phone || null,
        queue_number: ticket.display_number || ticket.queue_number,
        department_id: normalizeId(ticket.department_id || encounter?.department_id),
        department_name: ticket.department_id?.department_name || encounter?.department_id?.department_name || null,
        doctor_id: normalizeId(ticket.doctor_id || encounter?.attending_doctor_id),
        doctor_name: userName(ticket.doctor_id || encounter?.attending_doctor_id),
        reason: ticket.priority_reason || encounter?.chief_reason || ticket.appointment_id?.reason || 'Chờ đo sinh hiệu trước khám',
        nursing_stage: ticket.nursing_stage || NURSING_WORKFLOW_STATUS.VITAL_PENDING,
        assigned_nurse_id: normalizeId(ticket.assigned_nurse_id || encounter?.assigned_nurse_id),
        assigned_nurse_name: userName(ticket.assigned_nurse_id || encounter?.assigned_nurse_id),
        waiting_since: waitingSince,
        waiting_minutes: waitingMinutes,
        priority: ticket.queue_type === 'vip' || ticket.queue_type === 'priority' || waitingMinutes >= 30 ? 'high' : 'medium',
        status: ticket.nursing_stage || NURSING_WORKFLOW_STATUS.VITAL_PENDING,
        actions: ['record_vital', 'create_nursing_note'],
      };
    });
}

function buildPreparationItems(orders = []) {
  return orders.map((order) => {
    const patient = patientDto(order.patient_id);
    return {
      order_id: normalizeId(order),
      encounter_id: normalizeId(order.encounter_id),
      patient,
      patient_id: patient.patient_id,
      patient_name: patient.patient_name,
      order_type: order.order_type,
      order_no: order.order_no,
      status: order.status,
      priority: normalizePriority(order.priority),
      ordered_at: order.ordered_at,
      reason: order.clinical_indication || `${order.order_type || 'Dịch vụ'} đang chờ chuẩn bị`,
      actions: ['open_checklist', 'acknowledge_order', 'complete_preparation'],
    };
  });
}

function buildChecklistItems(checklists = []) {
  return checklists.map((checklist) => {
    const patient = patientDto(checklist.patient_id);
    const totalItems = Array.isArray(checklist.checklist_items) ? checklist.checklist_items.length : 0;
    const checkedItems = Array.isArray(checklist.checklist_items)
      ? checklist.checklist_items.filter((item) => item.checked).length
      : 0;

    return {
      checklist_id: normalizeId(checklist),
      order_id: normalizeId(checklist.order_id),
      encounter_id: normalizeId(checklist.encounter_id),
      patient,
      patient_id: patient.patient_id,
      patient_name: patient.patient_name,
      order_type: checklist.order_type,
      order_no: checklist.order_id?.order_no || null,
      status: checklist.status,
      assigned_to: normalizeId(checklist.assigned_to),
      assigned_to_name: userName(checklist.assigned_to),
      progress: {
        checked: checkedItems,
        total: totalItems,
        percent: totalItems ? Math.round((checkedItems / totalItems) * 100) : 0,
      },
      created_at: checklist.created_at,
      reason: checklist.order_id?.clinical_indication || `${checklist.order_type || 'Dịch vụ'} đang chờ checklist`,
      actions: ['open_checklist', 'complete_preparation'],
    };
  });
}

function buildQueueBoard(queueItems = []) {
  const statusMap = {
    waiting: [],
    called: [],
    recalled: [],
    in_service: [],
    skipped: [],
    completed: [],
    no_show: [],
    transferred: [],
  };

  queueItems.forEach((item) => {
    const key = item.status === QUEUE_STATUS.RECALLED ? 'recalled' : item.status;
    if (statusMap[key]) statusMap[key].push(item);
  });

  return Object.fromEntries(
    Object.entries(statusMap).map(([key, items]) => [
      key,
      items
        .sort((a, b) => (b.waiting_minutes || 0) - (a.waiting_minutes || 0))
        .slice(0, 8),
    ]),
  );
}

function buildTriagePanel(queueTickets = [], triageAssessments = [], filters = {}) {
  const completedQueueIds = new Set(
    triageAssessments
      .filter((item) => item.status === 'completed')
      .map((item) => normalizeId(item.queue_ticket_id))
      .filter(Boolean),
  );
  const pendingItems = queueTickets
    .filter((ticket) => OPEN_QUEUE_STATUSES.includes(ticket.status))
    .filter((ticket) => !completedQueueIds.has(String(normalizeId(ticket))))
    .filter((ticket) => ['waiting_nurse', 'triage_pending', 'triage_in_progress', 'not_started'].includes(ticket.nursing_stage || 'waiting_nurse'))
    .map((ticket) => ({
      queue_ticket_id: normalizeId(ticket),
      encounter_id: normalizeId(ticket.encounter_id),
      appointment_id: normalizeId(ticket.appointment_id),
      patient: patientDto(ticket.patient_id),
      patient_id: normalizeId(ticket.patient_id),
      patient_code: ticket.patient_id?.patient_code || null,
      patient_name: ticket.patient_id?.full_name || 'Chưa rõ bệnh nhân',
      department_id: normalizeId(ticket.department_id),
      department_name: ticket.department_id?.department_name || null,
      doctor_id: normalizeId(ticket.doctor_id),
      doctor_name: userName(ticket.doctor_id),
      queue_number: ticket.display_number || ticket.queue_number,
      status: ticket.status,
      nursing_stage: ticket.nursing_stage || NURSING_WORKFLOW_STATUS.WAITING_NURSE,
      queue_type: ticket.queue_type,
      checkin_time: ticket.checkin_time,
      reason: ticket.priority_reason || 'Chờ điều dưỡng phân loại',
      waiting_since: ticket.checkin_time || ticket.created_at,
      waiting_minutes: minutesSince(ticket.checkin_time || ticket.created_at, filters.now),
      priority: ticket.queue_type === 'vip' || ticket.queue_type === 'priority' ? 'high' : 'medium',
      actions: ['create_triage', 'record_vital'],
    }))
    .sort((a, b) => (b.waiting_minutes || 0) - (a.waiting_minutes || 0));

  const inProgress = triageAssessments.filter((item) => ['draft', 'in_progress'].includes(item.status));
  const completed = triageAssessments.filter((item) => item.status === 'completed');
  const highPriority = triageAssessments.filter((item) => ['critical', 'high'].includes(item.priority));
  const pendingQueueIds = new Set(pendingItems.map((item) => item.queue_ticket_id).filter(Boolean));
  const inProgressItems = inProgress
    .filter((item) => normalizeId(item.queue_ticket_id) && !pendingQueueIds.has(normalizeId(item.queue_ticket_id)))
    .map((item) => ({
      triage_id: normalizeId(item),
      queue_ticket_id: normalizeId(item.queue_ticket_id),
      encounter_id: normalizeId(item.encounter_id),
      patient: patientDto(item.patient_id),
      patient_id: normalizeId(item.patient_id),
      patient_code: item.patient_id?.patient_code || null,
      patient_name: item.patient_id?.full_name || 'Chưa rõ bệnh nhân',
      department_id: normalizeId(item.department_id),
      doctor_id: normalizeId(item.doctor_id),
      queue_number: item.queue_ticket_id?.display_number || item.queue_ticket_id?.queue_number,
      status: item.queue_ticket_id?.status || 'waiting',
      nursing_stage: item.status === 'in_progress' ? NURSING_WORKFLOW_STATUS.TRIAGE_IN_PROGRESS : NURSING_WORKFLOW_STATUS.TRIAGE_PENDING,
      queue_type: item.priority === 'critical' || item.priority === 'high' ? 'priority' : 'normal',
      reason: item.chief_complaint || item.symptoms || 'Đang lập phiếu phân loại',
      waiting_since: item.queue_ticket_id?.checkin_time || item.created_at,
      waiting_minutes: minutesSince(item.queue_ticket_id?.checkin_time || item.created_at, filters.now),
      priority: item.priority || 'medium',
      acuity_level: item.acuity_level,
      actions: ['complete_triage', 'record_vital'],
    }));

  return {
    pending: pendingItems.length,
    in_progress: inProgress.length,
    completed: completed.length,
    high_priority: highPriority.length,
    pending_items: [...pendingItems, ...inProgressItems].slice(0, 24),
    recent_items: triageAssessments.slice(0, 8).map((item) => ({
      triage_id: normalizeId(item),
      queue_ticket_id: normalizeId(item.queue_ticket_id),
      encounter_id: normalizeId(item.encounter_id),
      patient: patientDto(item.patient_id),
      patient_id: normalizeId(item.patient_id),
      patient_name: item.patient_id?.full_name || 'Chưa rõ bệnh nhân',
      patient_code: item.patient_id?.patient_code || null,
      priority: item.priority,
      triage_level: item.triage_level,
      acuity_level: item.acuity_level,
      status: item.status,
      triage_at: item.triage_at || item.created_at,
      triage_by_name: userName(item.triage_by),
      chief_complaint: item.chief_complaint || item.symptoms || null,
    })),
  };
}

function buildActivityFeed({ notifications = [], priorityAlerts = [], queueItems = [], vitalSummary = {}, nursingTasks = [] }) {
  const notificationItems = notifications.map((item) => ({
    id: `notification_${normalizeId(item)}`,
    type: item.notification_type || item.event_type || 'notification',
    title: item.title,
    message: item.message,
    priority: normalizePriority(item.priority),
    created_at: item.created_at,
    read_at: item.read_at,
  }));

  const alertItems = priorityAlerts.slice(0, 5).map((item) => ({
    id: `activity_${item.id}`,
    type: item.type,
    title: item.patient_name || 'Cảnh báo ưu tiên',
    message: item.message,
    priority: normalizePriority(item.severity),
    created_at: item.created_at,
  }));

  const queueItemsFeed = queueItems
    .filter((item) => [QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED, QUEUE_STATUS.SKIPPED, QUEUE_STATUS.IN_SERVICE].includes(item.status))
    .slice(0, 5)
    .map((item) => ({
      id: `queue_${item.queue_ticket_id}`,
      type: 'queue',
      title: `Queue ${item.queue_number}`,
      message: `${item.patient_name} · ${item.status}`,
      priority: item.status === QUEUE_STATUS.SKIPPED ? 'high' : 'normal',
      created_at: item.called_time || item.service_start_time || item.skipped_at || item.checkin_time,
    }));

  const vitalItems = (vitalSummary.abnormal || []).slice(0, 5).map((item) => ({
    id: `vital_${item.vital_sign_id}`,
    type: 'vital',
    title: item.patient_name,
    message: item.message,
    priority: normalizePriority(item.severity),
    created_at: item.recorded_at,
  }));

  const taskItems = nursingTasks
    .filter((task) => ['todo', 'in_progress'].includes(task.status))
    .slice(0, 5)
    .map((task) => ({
      id: `task_${normalizeId(task)}`,
      type: 'task',
      title: task.title,
      message: task.patient_id?.full_name || 'Task điều dưỡng',
      priority: normalizePriority(task.priority),
      created_at: task.created_at,
    }));

  return [...notificationItems, ...alertItems, ...queueItemsFeed, ...vitalItems, ...taskItems]
    .filter((item) => item.created_at)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 14);
}

function buildWorklist({
  queueTickets,
  emergencyCases,
  abnormalVitals,
  pendingVitals,
  preparationItems,
  nursingTasks,
  inpatientTasks,
  medicationDue,
  maps,
  filters,
}) {
  const items = [];

  abnormalVitals.forEach((vital) => {
    items.push(buildWorkItem({
      id: `abnormal_vital_${vital.vital_sign_id}`,
      type: 'abnormal_vital',
      priority: normalizePriority(vital.severity),
      patient: vital.patient,
      encounterId: vital.encounter_id,
      sourceType: 'vital_sign',
      sourceId: vital.vital_sign_id,
      reason: vital.message,
      status: vital.doctor_notified_at ? 'doctor_notified' : 'needs_attention',
      waitingSince: vital.recorded_at,
      overdueMinutes: minutesSince(vital.recorded_at, filters.now),
      flags: vital.abnormal_flags.map((flag) => flag.field),
      actions: ['notify_doctor', 'acknowledge', 'open_patient'],
      metadata: { severity: vital.severity, values: vital.values },
    }));
  });

  emergencyCases.forEach((emergencyCase) => {
    items.push(buildWorkItem({
      id: `emergency_${normalizeId(emergencyCase)}`,
      type: 'emergency',
      priority: emergencyCase.priority === 'critical' ? 'critical' : 'high',
      patient: emergencyCase.patient_id,
      encounterId: normalizeId(emergencyCase.related_encounter_id),
      sourceType: 'emergency_case',
      sourceId: normalizeId(emergencyCase),
      reason: emergencyCase.symptoms || emergencyCase.note || 'Ca cấp cứu đang mở',
      status: emergencyCase.status,
      location: emergencyCase.location_text || null,
      assignedTo: emergencyCase.assigned_to_user_id,
      waitingSince: emergencyCase.created_at,
      overdueMinutes: emergencyCase.status === EMERGENCY_STATUS.CREATED ? minutesSince(emergencyCase.created_at, filters.now) : 0,
      flags: ['emergency'],
      actions: emergencyCase.status === EMERGENCY_STATUS.CREATED
        ? ['acknowledge_emergency', 'open_case']
        : ['dispatch_emergency', 'open_case'],
      metadata: { case_code: emergencyCase.case_code },
    }));
  });

  pendingVitals.forEach((item) => {
    items.push(buildWorkItem({
      id: `vital_pending_${item.queue_ticket_id || item.encounter_id}`,
      type: 'vital_pending',
      priority: item.priority,
      patient: item.patient,
      encounterId: item.encounter_id,
      queueTicketId: item.queue_ticket_id,
      sourceType: 'queue',
      sourceId: item.queue_ticket_id,
      reason: 'Bệnh nhân đã check-in, chưa có sinh hiệu trong lượt hiện tại',
      status: 'pending',
      assignedTo: item.assigned_nurse_id,
      assignedToName: item.assigned_nurse_name,
      waitingSince: item.waiting_since,
      overdueMinutes: item.waiting_minutes > 15 ? item.waiting_minutes : 0,
      flags: item.waiting_minutes > 15 ? ['waiting_over_15m'] : [],
      actions: ['record_vital', 'create_nursing_note', 'mark_ready_for_doctor'],
      metadata: { queue_number: item.queue_number },
    }));
  });

  queueTickets
    .filter((ticket) => OPEN_QUEUE_STATUSES.includes(ticket.status))
    .filter((ticket) => ['waiting_nurse', 'triage_pending', 'not_started'].includes(ticket.nursing_stage || 'waiting_nurse'))
    .forEach((ticket) => {
      const waitingMinutes = minutesSince(ticket.checkin_time || ticket.created_at, filters.now);
      items.push(buildWorkItem({
        id: `waiting_nurse_${normalizeId(ticket)}`,
        type: ticket.nursing_stage === 'triage_pending' ? 'triage_pending' : 'waiting_nurse',
        priority: ticket.queue_type === 'vip' || ticket.queue_type === 'priority' || waitingMinutes >= 30 ? 'high' : 'medium',
        patient: ticket.patient_id,
        encounterId: normalizeId(ticket.encounter_id),
        queueTicketId: normalizeId(ticket),
        sourceType: 'queue',
        sourceId: normalizeId(ticket),
        reason: ticket.nursing_stage === 'triage_pending' ? 'Chờ điều dưỡng phân loại' : 'Bệnh nhân đang chờ điều dưỡng tiếp nhận',
        status: ticket.status,
        assignedTo: ticket.assigned_nurse_id,
        assignedToName: userName(ticket.assigned_nurse_id),
        waitingSince: ticket.checkin_time || ticket.created_at,
        overdueMinutes: waitingMinutes > 20 ? waitingMinutes : 0,
        flags: ticket.status === QUEUE_STATUS.SKIPPED ? ['skipped'] : [],
        actions: ['create_triage', 'record_vital', 'open_patient'],
        metadata: { queue_number: ticket.display_number || ticket.queue_number },
      }));
    });

  preparationItems.forEach((item) => {
    items.push(buildWorkItem({
      id: `preparation_${item.order_id}`,
      type: 'preparation_pending',
      priority: item.priority,
      patient: item.patient,
      encounterId: item.encounter_id,
      sourceType: 'order',
      sourceId: item.order_id,
      reason: item.reason,
      status: item.status,
      waitingSince: item.ordered_at,
      overdueMinutes: minutesSince(item.ordered_at, filters.now) > 45 ? minutesSince(item.ordered_at, filters.now) : 0,
      flags: [item.order_type],
      actions: item.actions,
      metadata: { order_no: item.order_no, order_type: item.order_type },
    }));
  });

  [...nursingTasks.map((task) => taskDto(task, 'nursing_task', filters.now)), ...inpatientTasks.map((task) => taskDto(task, 'inpatient_task', filters.now))]
    .filter((task) => task.status === 'overdue' || isOpenTask(task))
    .forEach((task) => {
      items.push(buildWorkItem({
        id: task.id,
        type: task.status === 'overdue' ? 'task_overdue' : 'task_due',
        priority: task.priority,
        patient: {
          _id: task.patient_id,
          patient_code: task.patient_code,
          full_name: task.patient_name,
        },
        sourceType: task.source_type,
        sourceId: task.source_id,
        reason: task.reason,
        status: task.status,
        assignedTo: task.assigned_to,
        waitingSince: task.due_at || task.waiting_since,
        overdueMinutes: task.overdue_minutes,
        flags: task.status === 'overdue' ? ['overdue'] : [],
        actions: task.actions,
      }));
    });

  medicationDue.forEach((medication) => {
    const admission = maps.admissionsById.get(String(normalizeId(medication.admission_id)));
    const bed = maps.bedByAdmission.get(String(normalizeId(medication.admission_id)));
    const medicationName = medication.medication_id?.generic_name || medication.medication_id?.brand_name || 'Thuốc tại giường';
    items.push(buildWorkItem({
      id: `medication_due_${normalizeId(medication)}`,
      type: isOverdue(medication.scheduled_at, filters.now) ? 'medication_overdue' : 'medication_due',
      priority: isOverdue(medication.scheduled_at, filters.now) ? 'high' : 'medium',
      patient: medication.patient_id || admission?.patient_id,
      admissionId: normalizeId(medication.admission_id),
      sourceType: 'medication_administration',
      sourceId: normalizeId(medication),
      reason: `${medicationName} đến giờ dùng`,
      status: isOverdue(medication.scheduled_at, filters.now) ? 'overdue' : medication.status,
      location: bed ? [bed.room_name, bed.bed_number].filter(Boolean).join(' · ') : null,
      waitingSince: medication.scheduled_at,
      overdueMinutes: isOverdue(medication.scheduled_at, filters.now) ? minutesSince(medication.scheduled_at, filters.now) : 0,
      flags: ['medication'],
      actions: ['administer_medication', 'hold_medication', 'open_patient'],
    }));
  });

  return sortWorkItems(items);
}

function buildPriorityAlerts({ abnormalVitals, emergencyCases, queueTickets, nursingTasks, inpatientTasks, medicationDue, filters }) {
  const alerts = [];

  abnormalVitals.slice(0, 8).forEach((vital) => {
    alerts.push({
      id: `alert_vital_${vital.vital_sign_id}`,
      type: 'abnormal_vital',
      severity: vital.severity,
      patient_id: vital.patient_id,
      patient_name: vital.patient_name,
      message: vital.message,
      source_id: vital.vital_sign_id,
      created_at: vital.recorded_at,
      actions: ['acknowledge', 'notify_doctor', 'open_patient'],
    });
  });

  emergencyCases.forEach((item) => {
    alerts.push({
      id: `alert_emergency_${normalizeId(item)}`,
      type: 'emergency',
      severity: item.priority === 'critical' ? 'critical' : 'high',
      patient_id: normalizeId(item.patient_id),
      patient_name: item.patient_id?.full_name || 'Chưa rõ bệnh nhân',
      message: item.symptoms || item.note || `Ca ${item.case_code} đang mở`,
      source_id: normalizeId(item),
      created_at: item.created_at,
      actions: item.status === EMERGENCY_STATUS.CREATED ? ['acknowledge', 'open_case'] : ['dispatch', 'open_case'],
    });
  });

  queueTickets
    .filter((ticket) => OPEN_QUEUE_STATUSES.includes(ticket.status))
    .filter((ticket) => minutesSince(ticket.checkin_time || ticket.created_at, filters.now) >= 30 || ticket.status === QUEUE_STATUS.SKIPPED)
    .forEach((ticket) => {
      alerts.push({
        id: `alert_queue_${normalizeId(ticket)}`,
        type: ticket.status === QUEUE_STATUS.SKIPPED ? 'queue_skipped' : 'long_waiting',
        severity: ticket.status === QUEUE_STATUS.SKIPPED ? 'high' : 'medium',
        patient_id: normalizeId(ticket.patient_id),
        patient_name: ticket.patient_id?.full_name || 'Chưa rõ bệnh nhân',
        message: ticket.status === QUEUE_STATUS.SKIPPED
          ? `Queue ${ticket.display_number || ticket.queue_number} bị skip`
          : `Chờ ${minutesSince(ticket.checkin_time || ticket.created_at, filters.now)} phút`,
        source_id: normalizeId(ticket),
        created_at: ticket.checkin_time || ticket.created_at,
        actions: ['recall_queue', 'open_patient'],
      });
    });

  [...nursingTasks, ...inpatientTasks]
    .filter((task) => isOpenTask(task) && isOverdue(task.due_at, filters.now))
    .forEach((task) => {
      alerts.push({
        id: `alert_task_${normalizeId(task)}`,
        type: 'task_overdue',
        severity: 'high',
        patient_id: normalizeId(task.patient_id),
        patient_name: task.patient_id?.full_name || 'Chưa rõ bệnh nhân',
        message: task.title || 'Task điều dưỡng quá hạn',
        source_id: normalizeId(task),
        created_at: task.due_at || task.created_at,
        actions: ['complete_task', 'create_note', 'open_patient'],
      });
    });

  medicationDue
    .filter((medication) => isOverdue(medication.scheduled_at, filters.now))
    .forEach((medication) => {
      alerts.push({
        id: `alert_med_${normalizeId(medication)}`,
        type: 'medication_overdue',
        severity: 'high',
        patient_id: normalizeId(medication.patient_id),
        patient_name: medication.patient_id?.full_name || 'Chưa rõ bệnh nhân',
        message: 'Thuốc tại giường quá giờ',
        source_id: normalizeId(medication),
        created_at: medication.scheduled_at,
        actions: ['administer_medication', 'open_patient'],
      });
    });

  return alerts
    .sort((a, b) => {
      const severityDiff = severityRank(b.severity) - severityRank(a.severity);
      if (severityDiff) return severityDiff;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    })
    .slice(0, 16);
}

async function assembleDashboard(query = {}, actor = {}) {
  const filters = normalizeFilters(query, actor);
  const [
    department,
    queueTickets,
    orders,
    emergencyCases,
    admissions,
    nursingTasks,
    unreadNotifications,
    notificationActivity,
    triageAssessments,
    preparationChecklists,
  ] = await Promise.all([
    filters.department_object_id
      ? Department.findById(filters.department_object_id).select('department_code department_name').lean()
      : null,
    fetchQueueTickets(filters),
    fetchOrders(filters),
    fetchEmergencyCases(filters),
    fetchAdmissions(filters),
    fetchNursingTasks(filters),
    fetchUnreadNotifications(actor),
    fetchNotificationActivity(actor),
    fetchTriageAssessments(filters),
    fetchPreparationChecklists(filters),
  ]);

  const encounters = await fetchEncounters(filters, queueTickets);
  const { bedAssignments, inpatientTasks, medicationDue } = await fetchInpatientData(filters, admissions);
  const { recorded: vitalRecords, enteredInError: enteredInErrorVitals } = await fetchVitals(filters, encounters, queueTickets);
  const maps = buildMaps({ queueTickets, encounters, admissions, bedAssignments });
  const vitalSummary = buildVitalSummaries(vitalRecords, maps.encountersById);
  const pendingVitals = buildPendingVitals(queueTickets, maps.encountersById, vitalSummary, filters);
  const preparationItems = buildPreparationItems(orders);
  const checklistItems = buildChecklistItems(preparationChecklists);
  const queueItems = queueTickets.map((ticket) => formatQueueItem(ticket, filters));
  const queueItemLimit = Math.min(Math.max(Number(query.queue_limit || query.limit || DEFAULT_LIMIT), 1), 500);
  const queueBoard = buildQueueBoard(queueItems);
  const triagePanel = buildTriagePanel(queueTickets, triageAssessments, filters);
  const worklist = buildWorklist({
    queueTickets,
    emergencyCases,
    abnormalVitals: vitalSummary.abnormal,
    pendingVitals,
    preparationItems,
    nursingTasks,
    inpatientTasks,
    medicationDue,
    maps,
    filters,
  });
  const filteredWorklist = filterWorkItems(worklist, filters).slice(0, Math.min(Math.max(Number(query.limit || DEFAULT_LIMIT), 1), 200));
  const priorityAlerts = buildPriorityAlerts({
    abnormalVitals: vitalSummary.abnormal,
    emergencyCases,
    queueTickets,
    nursingTasks,
    inpatientTasks,
    medicationDue,
    filters,
  });
  const queueCounts = statusCounts(queueTickets);
  const nursingStageCounts = statusCounts(queueTickets, 'nursing_stage');
  const encounterNursingCounts = statusCounts(encounters, 'nursing_status');
  const overdueNursingTasks = nursingTasks.filter((task) => isOpenTask(task) && isOverdue(task.due_at, filters.now));
  const overdueInpatientTasks = inpatientTasks.filter((task) => isOpenTask(task) && isOverdue(task.due_at, filters.now));
  const dueNursingTasks = nursingTasks.filter((task) => task.due_at && task.due_at >= filters.day_start && task.due_at <= filters.day_end);
  const dueInpatientTasks = inpatientTasks.filter((task) => task.due_at && task.due_at >= filters.day_start && task.due_at <= filters.day_end);
  const activeAdmissionsWithoutBed = admissions.filter((admission) => !maps.bedByAdmission.has(String(normalizeId(admission))));
  const emergencyCounts = statusCounts(emergencyCases);
  const slaWaitingItems = queueItems.filter((item) => OPEN_QUEUE_STATUSES.includes(item.status) && item.waiting_minutes >= NURSING_WAITING_SLA_MINUTES);

  const checkedIn = queueTickets.filter((ticket) => ticket.checkin_time || OPEN_QUEUE_STATUSES.includes(ticket.status)).length;
  const waitingNurse = (nursingStageCounts[NURSING_WORKFLOW_STATUS.WAITING_NURSE] || 0)
    + (nursingStageCounts[NURSING_WORKFLOW_STATUS.NOT_STARTED] || 0);
  const triagePending = (nursingStageCounts[NURSING_WORKFLOW_STATUS.TRIAGE_PENDING] || 0)
    + (encounterNursingCounts[NURSING_WORKFLOW_STATUS.TRIAGE_PENDING] || 0);
  const preparationPending = preparationItems.length
    + (nursingStageCounts[NURSING_WORKFLOW_STATUS.PREPARATION_PENDING] || 0)
    + (encounterNursingCounts[NURSING_WORKFLOW_STATUS.PREPARATION_PENDING] || 0);
  const readyForDoctor = (nursingStageCounts[NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR] || 0)
    + (encounterNursingCounts[NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR] || 0);
  const activityFeed = buildActivityFeed({
    notifications: notificationActivity,
    priorityAlerts,
    queueItems,
    vitalSummary,
    nursingTasks,
  });

  return {
    meta: {
      date: filters.date_key,
      department_id: filters.department_id,
      department_name: department?.department_name || null,
      department_code: department?.department_code || null,
      shift: filters.shift,
      realtime_rooms: [
        filters.department_id ? `department:${filters.department_id}` : null,
        filters.department_id ? `nursing:department:${filters.department_id}` : null,
        'role:nurse',
      ].filter(Boolean),
      generated_at: filters.now.toISOString(),
    },
    kpis: {
      checked_in: checkedIn,
      waiting_nurse: waitingNurse || queueCounts[QUEUE_STATUS.WAITING] || 0,
      triage_pending: triagePending,
      vital_pending: pendingVitals.length,
      ready_for_doctor: readyForDoctor,
      nursing_sla_waiting: slaWaitingItems.length,
      abnormal_vitals: vitalSummary.abnormal.length,
      preparation_pending: preparationPending,
      tasks_due_today: dueNursingTasks.length + dueInpatientTasks.length,
      tasks_overdue: overdueNursingTasks.length + overdueInpatientTasks.length,
      open_emergency_cases: emergencyCases.length,
      active_inpatients: admissions.length,
      medication_due_now: medicationDue.length,
    },
    priority_alerts: priorityAlerts,
    worklist: {
      items: filteredWorklist,
      summary: {
        total: worklist.length,
        critical: worklist.filter((item) => item.priority === 'critical').length,
        high: worklist.filter((item) => item.priority === 'high').length,
        overdue: worklist.filter((item) => item.status === 'overdue' || item.overdue_minutes > 0).length,
      },
    },
    queue: {
      total: queueTickets.length,
      waiting: queueCounts[QUEUE_STATUS.WAITING] || 0,
      called: (queueCounts[QUEUE_STATUS.CALLED] || 0) + (queueCounts[QUEUE_STATUS.RECALLED] || 0),
      in_service: queueCounts[QUEUE_STATUS.IN_SERVICE] || 0,
      skipped: queueCounts[QUEUE_STATUS.SKIPPED] || 0,
      completed: queueCounts[QUEUE_STATUS.COMPLETED] || 0,
      no_show: queueCounts[QUEUE_STATUS.NO_SHOW] || 0,
      cancelled: queueCounts[QUEUE_STATUS.CANCELLED] || 0,
      items: queueItems.slice(0, queueItemLimit),
      board: queueBoard,
      longest_waiting: queueItems
        .filter((item) => OPEN_QUEUE_STATUSES.includes(item.status))
        .sort((a, b) => (b.waiting_minutes || 0) - (a.waiting_minutes || 0))
        .slice(0, 6),
    },
    triage: triagePanel,
    vitals: {
      pending: pendingVitals.length,
      pending_items: pendingVitals.slice(0, 12),
      recorded_today: vitalRecords.length,
      abnormal: vitalSummary.abnormal.length,
      abnormal_items: vitalSummary.abnormal.slice(0, 12),
      entered_in_error: enteredInErrorVitals,
      latest_by_encounter: Array.from(vitalSummary.latestByEncounter.values()).slice(0, 8),
      latest_by_queue: Array.from(vitalSummary.latestByQueue.values()).slice(0, 12),
    },
    tasks: {
      assigned_to_me: nursingTasks.filter((task) => actorUserId(actor) && sameId(task.assigned_to, actorUserId(actor))).length,
      due_today: dueNursingTasks.length + dueInpatientTasks.length,
      overdue: overdueNursingTasks.length + overdueInpatientTasks.length,
      completed: nursingTasks.filter((task) => task.status === 'done').length + inpatientTasks.filter((task) => task.status === INPATIENT_TASK_STATUS.DONE).length,
      items: [...nursingTasks.map((task) => taskDto(task, 'nursing_task', filters.now)), ...inpatientTasks.map((task) => taskDto(task, 'inpatient_task', filters.now))]
        .sort((a, b) => new Date(a.due_at || 0).getTime() - new Date(b.due_at || 0).getTime())
        .slice(0, 12),
    },
    emergency: {
      open: emergencyCases.length,
      new: emergencyCounts[EMERGENCY_STATUS.CREATED] || 0,
      acknowledged: emergencyCounts[EMERGENCY_STATUS.ACKNOWLEDGED] || 0,
      triaged: emergencyCounts[EMERGENCY_STATUS.TRIAGED] || 0,
      dispatched: emergencyCounts[EMERGENCY_STATUS.DISPATCHED] || 0,
      sla_breached: emergencyCases.filter((item) => item.status === EMERGENCY_STATUS.CREATED && minutesSince(item.created_at, filters.now) >= EMERGENCY_ACK_SLA_MINUTES).length,
      items: emergencyCases.slice(0, 8),
    },
    inpatient: {
      active_admissions: admissions.length,
      pending_bed_assignment: activeAdmissionsWithoutBed.length,
      medication_due_now: medicationDue.length,
      medication_overdue: medicationDue.filter((item) => isOverdue(item.scheduled_at, filters.now)).length,
      inpatient_tasks_overdue: overdueInpatientTasks.length,
      admissions: admissions.slice(0, 8).map((admission) => {
        const bed = maps.bedByAdmission.get(String(normalizeId(admission)));
        return {
          admission_id: normalizeId(admission),
          admission_no: admission.admission_no,
          patient: patientDto(admission.patient_id),
          admitted_at: admission.admitted_at,
          status: admission.status,
          bed,
        };
      }),
    },
    service_preparation: {
      pending: preparationItems.length + checklistItems.length,
      lab: preparationItems.filter((item) => item.order_type === ORDER_TYPE.LAB).length,
      imaging: preparationItems.filter((item) => item.order_type === ORDER_TYPE.IMAGING).length,
      procedure: preparationItems.filter((item) => item.order_type === ORDER_TYPE.PROCEDURE).length,
      checklist_pending: checklistItems.length,
      items: [...checklistItems, ...preparationItems].slice(0, 10),
    },
    notifications: {
      unread: unreadNotifications,
      items: notificationActivity,
    },
    activity_feed: activityFeed,
    filters: {
      date: filters.date_key,
      department_id: filters.department_id,
      shift: filters.shift,
      nurse_id: filters.nurse_id || null,
      priority: filters.priority || null,
      type: filters.type || null,
      status: filters.status || null,
      assigned_to: filters.assigned_to || null,
    },
  };
}

async function getOverview(query = {}, actor = {}) {
  return assembleDashboard(query, actor);
}

async function getKpis(query = {}, actor = {}) {
  const dashboard = await assembleDashboard(query, actor);
  return {
    meta: dashboard.meta,
    kpis: dashboard.kpis,
  };
}

async function getWorklist(query = {}, actor = {}) {
  const dashboard = await assembleDashboard(query, actor);
  return dashboard.worklist;
}

async function getPriorityAlerts(query = {}, actor = {}) {
  const dashboard = await assembleDashboard(query, actor);
  return {
    items: dashboard.priority_alerts,
    summary: {
      total: dashboard.priority_alerts.length,
      critical: dashboard.priority_alerts.filter((item) => item.severity === 'critical').length,
      high: dashboard.priority_alerts.filter((item) => item.severity === 'high').length,
    },
  };
}

function commandNormalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function commandMatches(item = {}, query = '') {
  if (!query) return true;
  const haystack = commandNormalize([
    item.label,
    item.title,
    item.name,
    item.patient_name,
    item.patient_code,
    item.queue_number,
    item.group,
    item.status,
    item.type,
    item.reason,
    ...(item.keywords || []),
  ].filter(Boolean).join(' '));
  return haystack.includes(query);
}

function uniqueBy(items = [], keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildShiftSummaryFromDashboard(dashboard = {}) {
  const abnormal = Number(dashboard.vitals?.abnormal || 0);
  const criticalVitals = (dashboard.vitals?.abnormal_items || []).filter((item) => item.severity === 'critical').length;
  const priorityAlerts = dashboard.priority_alerts || [];
  const overdueTasks = Number(dashboard.tasks?.overdue || 0);
  const triagePending = Number(dashboard.triage?.pending || dashboard.kpis?.triage_pending || 0);
  const postProcedure = Number(dashboard.service_preparation?.procedure || 0);
  const handoffs = Number(dashboard.kpis?.handoffs_active || 0);
  const needDoctor = priorityAlerts.filter((item) => item.actions?.includes('notify_doctor')).length
    + (dashboard.vitals?.abnormal_items || []).filter((item) => item.requires_doctor_notification).length;
  const critical = criticalVitals + priorityAlerts.filter((item) => item.severity === 'critical').length + Number(dashboard.emergency?.new || 0);
  const high = priorityAlerts.filter((item) => item.severity === 'high').length + abnormal - criticalVitals;
  const items = [
    { code: 'abnormal_vitals', label: 'Sinh hiệu bất thường', count: abnormal, severity: criticalVitals ? 'critical' : 'high', route: '/nurse/vitals-records/abnormal' },
    { code: 'urgent_cases', label: 'Ca cần báo khẩn', count: Number(dashboard.emergency?.open || 0), severity: dashboard.emergency?.sla_breached ? 'critical' : 'high', route: '/nurse/monitoring-reporting/urgent-cases' },
    { code: 'overdue_tasks', label: 'Nhiệm vụ quá hạn', count: overdueTasks, severity: overdueTasks ? 'warning' : 'normal', route: '/nurse/tasks-handover/overdue' },
    { code: 'triage_pending', label: 'Bệnh nhân chờ triage', count: triagePending, severity: triagePending >= 7 ? 'warning' : 'normal', route: '/nurse/reception-triage/waiting-triage' },
    { code: 'post_procedure', label: 'Sau thủ thuật cần theo dõi', count: postProcedure, severity: postProcedure ? 'warning' : 'normal', route: '/nurse/monitoring-reporting/post-procedure' },
    { code: 'handoffs_active', label: 'Chờ bàn giao ca', count: handoffs, severity: handoffs ? 'normal' : 'muted', route: '/nurse/tasks-handover/shift-handover' },
    { code: 'need_doctor', label: 'Cần báo bác sĩ', count: needDoctor, severity: needDoctor ? 'high' : 'normal', route: '/nurse/monitoring-reporting/report-doctor' },
  ];

  return {
    shift: dashboard.meta?.shift || 'all',
    department: dashboard.meta?.department_name || null,
    department_id: dashboard.meta?.department_id || null,
    alert_total: abnormal + Number(dashboard.emergency?.open || 0) + overdueTasks,
    critical,
    high,
    items,
    last_updated_at: dashboard.meta?.generated_at || new Date().toISOString(),
  };
}

function buildTopbarQuickActions(dashboard = {}) {
  return [
    {
      code: 'record_vital',
      label: 'Nhập sinh hiệu',
      route: '/nurse/vitals-records/entry',
      count: dashboard.vitals?.pending || 0,
      tone: dashboard.vitals?.pending ? 'primary' : 'neutral',
    },
    {
      code: 'abnormal_vitals',
      label: 'Xem sinh hiệu bất thường',
      route: '/nurse/vitals-records/abnormal',
      count: dashboard.vitals?.abnormal || 0,
      tone: dashboard.vitals?.abnormal ? 'danger' : 'neutral',
    },
    {
      code: 'overdue_tasks',
      label: 'Nhiệm vụ quá hạn',
      route: '/nurse/tasks-handover/overdue',
      count: dashboard.tasks?.overdue || 0,
      tone: dashboard.tasks?.overdue ? 'warning' : 'neutral',
    },
    {
      code: 'priority_alerts',
      label: 'Cảnh báo ưu tiên',
      route: '/nurse/overview/priority-alerts',
      count: dashboard.priority_alerts?.length || 0,
      tone: dashboard.priority_alerts?.length ? 'warning' : 'neutral',
    },
  ];
}

async function getShiftSummary(query = {}, actor = {}) {
  const dashboard = await assembleDashboard(query, actor);
  return {
    meta: dashboard.meta,
    ...buildShiftSummaryFromDashboard(dashboard),
  };
}

async function getTopbarBootstrap(query = {}, actor = {}) {
  const dashboard = await assembleDashboard({ ...query, limit: query.limit || 80 }, actor);
  const shiftSummary = buildShiftSummaryFromDashboard(dashboard);
  const workspace = workspaceAccessService.getAvailableWorkspaces(actor, {
    current_workspace: 'nursing',
    badges: {
      nursing: {
        alerts: shiftSummary.alert_total,
        tasks: dashboard.tasks?.due_today || 0,
      },
    },
  });
  return {
    profile: {
      user_id: actorUserId(actor),
      actor_type: actor.actorType || actor.actor_type || 'staff',
      display_name: actor.user?.full_name || actor.full_name || actor.name || null,
      email: actor.user?.email || actor.email || null,
      roles: actorRoles(actor),
      department_id: actorDepartmentId(actor),
      department_name: dashboard.meta?.department_name || null,
      online_status: 'online',
    },
    workspace: {
      current_workspace: 'nursing',
      current_department_id: dashboard.meta?.department_id || actorDepartmentId(actor),
      current_department_name: dashboard.meta?.department_name || null,
      current_shift: dashboard.meta?.shift || 'all',
      realtime_rooms: dashboard.meta?.realtime_rooms || [],
      available_workspaces: workspace.available_workspaces,
    },
    permissions: actor.permissions || [],
    counters: {
      unread_notifications: dashboard.notifications?.unread || 0,
      pending_vitals: dashboard.vitals?.pending || 0,
      abnormal_vitals: dashboard.vitals?.abnormal || 0,
      priority_alerts: dashboard.priority_alerts?.length || 0,
      overdue_tasks: dashboard.tasks?.overdue || 0,
      waiting_triage: dashboard.triage?.pending || 0,
      open_emergency_cases: dashboard.emergency?.open || 0,
    },
    shift_summary: shiftSummary,
    priority_alert_summary: {
      total: dashboard.priority_alerts?.length || 0,
      critical: dashboard.priority_alerts?.filter((item) => item.severity === 'critical').length || 0,
      high: dashboard.priority_alerts?.filter((item) => item.severity === 'high').length || 0,
    },
    notification_preview: dashboard.notifications?.items || [],
    quick_actions: buildTopbarQuickActions(dashboard),
    meta: dashboard.meta,
  };
}

async function search(query = {}, actor = {}) {
  const q = commandNormalize(query.q || query.keyword || '');
  const limit = Math.min(Math.max(Number(query.limit || 8), 1), 20);
  const dashboard = await assembleDashboard({ ...query, limit: 200, queue_limit: 200 }, actor);
  const patientSources = [
    ...(dashboard.queue?.items || []),
    ...(dashboard.vitals?.pending_items || []),
    ...(dashboard.vitals?.abnormal_items || []),
    ...(dashboard.worklist?.items || []),
  ];
  const patients = uniqueBy(patientSources.map((item) => ({
    patient_id: item.patient_id || item.patient?.patient_id,
    patient_code: item.patient_code || item.patient?.patient_code,
    patient_name: item.patient_name || item.patient?.patient_name || item.title,
    gender: item.patient?.gender || null,
    age: item.patient?.age || null,
    current_status: item.nursing_stage || item.status || item.type,
    department_id: item.department_id || dashboard.meta?.department_id || null,
    department_name: item.department_name || dashboard.meta?.department_name || null,
    queue_ticket_id: item.queue_ticket_id || item.source_id || null,
    encounter_id: item.encounter_id || null,
    risk_chips: [
      item.priority === 'critical' ? 'critical' : null,
      item.priority === 'high' ? 'high' : null,
      item.type?.includes('vital') ? 'sinh hiệu' : null,
    ].filter(Boolean),
    actions: ['open_patient', 'record_vital', 'create_task'],
  })).filter((item) => item.patient_id || item.patient_name), (item) => item.patient_id || item.patient_name)
    .filter((item) => commandMatches(item, q))
    .slice(0, limit);

  const queueItems = (dashboard.queue?.items || [])
    .map((item) => ({
      queue_ticket_id: item.queue_ticket_id,
      queue_number: item.queue_number,
      patient_name: item.patient_name,
      patient_code: item.patient_code,
      status: item.status,
      nursing_stage: item.nursing_stage,
      waiting_minutes: item.waiting_minutes,
      route: '/nurse/overview/realtime-queue',
    }))
    .filter((item) => commandMatches(item, q))
    .slice(0, limit);

  const tasks = (dashboard.tasks?.items || [])
    .map((item) => ({
      task_id: item.task_id || item.source_id,
      title: item.title,
      patient_name: item.patient_name,
      priority: item.priority,
      status: item.status,
      due_at: item.due_at,
      route: item.status === 'overdue' ? '/nurse/tasks-handover/overdue' : '/nurse/tasks-handover/assigned',
    }))
    .filter((item) => commandMatches(item, q))
    .slice(0, limit);

  const alerts = (dashboard.priority_alerts || [])
    .map((item) => ({
      alert_id: item.id || item.source_id,
      title: item.message || item.reason || item.type,
      patient_name: item.patient_name,
      severity: item.severity,
      created_at: item.created_at,
      route: item.type === 'abnormal_vital' ? '/nurse/vitals-records/abnormal' : '/nurse/overview/priority-alerts',
    }))
    .filter((item) => commandMatches(item, q))
    .slice(0, limit);

  const menus = NURSING_COMMAND_MENUS
    .filter((item) => commandMatches(item, q))
    .slice(0, limit);

  return {
    query: query.q || '',
    groups: {
      patients,
      queue_items: queueItems,
      tasks,
      alerts,
      menus,
      quick_actions: buildTopbarQuickActions(dashboard).filter((item) => commandMatches(item, q)).slice(0, limit),
    },
    meta: dashboard.meta,
  };
}

function workItemWaitingMinutes(item = {}, now = new Date()) {
  return item.overdue_minutes || minutesSince(item.waiting_since, now);
}

function nursingSlaStatus(item = {}, now = new Date()) {
  const waitingMinutes = workItemWaitingMinutes(item, now);
  if (item.priority === 'critical' || item.status === 'overdue' || waitingMinutes >= 30) return 'breached';
  if (item.priority === 'high' || waitingMinutes >= 15) return 'warning';
  return 'normal';
}

function decoratePendingPatient(item = {}, now = new Date()) {
  const waitingMinutes = workItemWaitingMinutes(item, now);
  return {
    ...item,
    waiting_minutes: waitingMinutes,
    sla_status: nursingSlaStatus(item, now),
    sla_due_at: item.waiting_since
      ? new Date(new Date(item.waiting_since).getTime() + (item.priority === 'critical' ? 5 : item.priority === 'high' ? 15 : 30) * 60000).toISOString()
      : null,
  };
}

function buildPriorityLane(items = [], now = new Date()) {
  const decorated = items.map((item) => decoratePendingPatient(item, now));
  return {
    immediate: decorated
      .filter((item) => ['critical', 'high'].includes(item.priority) || item.sla_status === 'breached')
      .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || (b.waiting_minutes || 0) - (a.waiting_minutes || 0))
      .slice(0, 6),
    longest_waiting: decorated
      .filter((item) => item.waiting_since)
      .sort((a, b) => (b.waiting_minutes || 0) - (a.waiting_minutes || 0))
      .slice(0, 6),
    unassigned: decorated
      .filter((item) => !item.assigned_to)
      .slice(0, 8),
    stat: decorated
      .filter((item) => item.flags?.includes('stat') || item.metadata?.order_type === ORDER_TYPE.LAB || item.priority === 'critical')
      .slice(0, 6),
  };
}

function pendingPatientSummary(items = [], dashboard = {}, now = new Date()) {
  return {
    total: items.length,
    critical: items.filter((item) => item.priority === 'critical').length,
    high: items.filter((item) => item.priority === 'high').length,
    triage_pending: items.filter((item) => item.type === 'triage_pending').length,
    vital_pending: items.filter((item) => item.type === 'vital_pending').length,
    abnormal_vitals: items.filter((item) => item.type === 'abnormal_vital').length,
    preparation_pending: items.filter((item) => item.type === 'preparation_pending').length,
    need_doctor: items.filter((item) => item.actions?.includes('notify_doctor')).length,
    unassigned: items.filter((item) => !item.assigned_to).length,
    sla_breached: items.filter((item) => nursingSlaStatus(item, now) === 'breached').length,
    queue_waiting: dashboard.queue?.waiting || 0,
  };
}

async function getPendingPatients(query = {}, actor = {}) {
  const dashboard = await assembleDashboard({ ...query, limit: query.limit || 160 }, actor);
  const now = new Date(dashboard.meta.generated_at || Date.now());
  const items = (dashboard.worklist.items || []).map((item) => decoratePendingPatient(item, now));
  return {
    meta: dashboard.meta,
    summary: pendingPatientSummary(items, dashboard, now),
    priority_lane: buildPriorityLane(items, now),
    items,
    activity_feed: dashboard.activity_feed,
  };
}

async function getPendingPatientsSummary(query = {}, actor = {}) {
  const payload = await getPendingPatients(query, actor);
  return {
    meta: payload.meta,
    summary: payload.summary,
  };
}

async function getPendingPatientsPriorityLane(query = {}, actor = {}) {
  const payload = await getPendingPatients(query, actor);
  return {
    meta: payload.meta,
    priority_lane: payload.priority_lane,
  };
}

function defaultIntakeChecklist(payload = {}) {
  return {
    identity_verified: Boolean(payload.identity_verified),
    appointment_verified: Boolean(payload.appointment_verified),
    allergy_checked: Boolean(payload.allergy_checked),
    reason_confirmed: Boolean(payload.reason_confirmed),
    consent_checked: Boolean(payload.consent_checked),
    vital_required: payload.vital_required !== undefined ? Boolean(payload.vital_required) : true,
    triage_required: Boolean(payload.triage_required),
    problem_reviewed: Boolean(payload.problem_reviewed),
    medication_reviewed: Boolean(payload.medication_reviewed),
  };
}

function hasUpdatePathConflict(path, updatePaths = []) {
  return updatePaths.some((candidate) => (
    candidate === path
    || candidate.startsWith(`${path}.`)
    || path.startsWith(`${candidate}.`)
  ));
}

function withoutConflictingSetOnInsertPaths(setOnInsert = {}, setFields = {}) {
  const setPaths = Object.keys(setFields);
  return Object.fromEntries(
    Object.entries(setOnInsert).filter(([path]) => !hasUpdatePathConflict(path, setPaths)),
  );
}

function intakeDto(intake = {}) {
  if (!intake) return null;
  return {
    intake_id: normalizeId(intake),
    queue_ticket_id: normalizeId(intake.queue_ticket_id),
    appointment_id: normalizeId(intake.appointment_id),
    encounter_id: normalizeId(intake.encounter_id),
    patient: patientDto(intake.patient_id),
    patient_id: normalizeId(intake.patient_id),
    department_id: normalizeId(intake.department_id),
    doctor_id: normalizeId(intake.doctor_id),
    assigned_nurse_id: normalizeId(intake.assigned_nurse_id),
    assigned_nurse_name: userName(intake.assigned_nurse_id),
    status: intake.status,
    started_at: intake.started_at,
    completed_at: intake.completed_at,
    checklist: intake.checklist || {},
    note: intake.note || null,
    created_at: intake.created_at,
    updated_at: intake.updated_at,
  };
}

async function getQueueTicketOrThrow(ticketId) {
  const ticket = await QueueTicket.findById(ticketId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('doctor_id', 'full_name employee_code')
    .populate('assigned_nurse_id', 'full_name employee_code')
    .populate('department_id', 'department_name department_code');
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  return ticket;
}

async function upsertIntakeForTicket(ticket, patch = {}, actor = {}) {
  const now = new Date();
  const userId = actorUserId(actor);
  const setFields = {
    ...patch,
    appointment_id: ticket.appointment_id,
    encounter_id: ticket.encounter_id,
    patient_id: ticket.patient_id?._id || ticket.patient_id,
    department_id: ticket.department_id?._id || ticket.department_id,
    doctor_id: ticket.doctor_id?._id || ticket.doctor_id,
    updated_by: userId,
    updated_at: now,
  };
  const setOnInsert = {
    queue_ticket_id: ticket._id,
    appointment_id: ticket.appointment_id,
    encounter_id: ticket.encounter_id,
    patient_id: ticket.patient_id?._id || ticket.patient_id,
    department_id: ticket.department_id?._id || ticket.department_id,
    doctor_id: ticket.doctor_id?._id || ticket.doctor_id,
    status: 'waiting',
    checklist: defaultIntakeChecklist({}),
    created_by: userId,
  };

  return NursingIntake.findOneAndUpdate(
    { queue_ticket_id: ticket._id },
    {
      $setOnInsert: withoutConflictingSetOnInsertPaths(setOnInsert, setFields),
      $set: setFields,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('assigned_nurse_id', 'full_name employee_code')
    .lean();
}

async function getIntakeDashboard(query = {}, actor = {}) {
  const dashboard = await assembleDashboard({ ...query, queue_limit: query.queue_limit || 240, limit: query.limit || 160 }, actor);
  const now = new Date(dashboard.meta.generated_at || Date.now());
  const queueItems = dashboard.queue.items || [];
  const checkedInItems = queueItems.filter((item) => OPEN_QUEUE_STATUSES.includes(item.status) || item.checkin_time);
  const readyItems = queueItems.filter((item) => item.nursing_stage === NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR);
  return {
    ...dashboard,
    intake: {
      summary: {
        checked_in: checkedInItems.length,
        waiting_nurse: checkedInItems.filter((item) => [NURSING_WORKFLOW_STATUS.WAITING_NURSE, NURSING_WORKFLOW_STATUS.NOT_STARTED].includes(item.nursing_stage)).length,
        nurse_in_progress: checkedInItems.filter((item) => item.nursing_stage === NURSING_WORKFLOW_STATUS.NURSE_IN_PROGRESS).length,
        triage_waiting: checkedInItems.filter((item) => item.nursing_stage === NURSING_WORKFLOW_STATUS.TRIAGE_PENDING).length,
        triage_in_progress: checkedInItems.filter((item) => item.nursing_stage === NURSING_WORKFLOW_STATUS.TRIAGE_IN_PROGRESS).length,
        vital_pending: dashboard.vitals.pending,
        abnormal_vitals: dashboard.vitals.abnormal,
        ready_for_doctor: readyItems.length,
        sla_breached: checkedInItems.filter((item) => nursingSlaStatus({ ...item, waiting_since: item.checkin_time, priority: normalizePriority(item.queue_type) }, now) === 'breached').length,
      },
      checked_in_items: checkedInItems,
      ready_items: readyItems,
      triage_items: dashboard.triage.pending_items,
      priority_lane: buildPriorityLane(dashboard.worklist.items || [], now),
    },
  };
}

async function getIntakeWorklist(query = {}, actor = {}) {
  const payload = await getIntakeDashboard(query, actor);
  return {
    meta: payload.meta,
    summary: payload.intake.summary,
    items: payload.intake.checked_in_items,
    lanes: {
      waiting_nurse: payload.intake.checked_in_items.filter((item) => [NURSING_WORKFLOW_STATUS.WAITING_NURSE, NURSING_WORKFLOW_STATUS.NOT_STARTED].includes(item.nursing_stage)),
      in_progress: payload.intake.checked_in_items.filter((item) => item.nursing_stage === NURSING_WORKFLOW_STATUS.NURSE_IN_PROGRESS),
      vital_pending: payload.vitals.pending_items,
      triage_pending: payload.triage.pending_items,
      ready_for_doctor: payload.intake.ready_items,
    },
  };
}

async function getQueueContext(ticketId, actor = {}) {
  const ticket = await QueueTicket.findById(ticketId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone date_of_birth')
    .populate('doctor_id', 'full_name employee_code')
    .populate('assigned_nurse_id', 'full_name employee_code')
    .populate('department_id', 'department_name department_code')
    .populate('appointment_id', 'appointment_time appointment_type reason source status checked_in_at')
    .populate('encounter_id', 'encounter_code encounter_type status nursing_status start_time chief_reason attending_doctor_id')
    .lean();
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);

  const patientId = normalizeId(ticket.patient_id);
  const [latestVital, latestTriage, intake, allergies, problems, notes, emergencyCase] = await Promise.all([
    VitalSign.findOne({
      status: { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR },
      $or: [
        { queue_ticket_id: ticket._id },
        ticket.encounter_id ? { encounter_id: ticket.encounter_id?._id || ticket.encounter_id } : null,
      ].filter(Boolean),
    }).sort({ recorded_at: -1 }).lean(),
    TriageAssessment.findOne({ queue_ticket_id: ticket._id, status: { $ne: 'entered_in_error' } })
      .sort({ created_at: -1 })
      .populate('triage_by', 'full_name employee_code')
      .lean(),
    NursingIntake.findOne({ queue_ticket_id: ticket._id })
      .populate('assigned_nurse_id', 'full_name employee_code')
      .lean(),
    patientId ? Allergy.find({ patient_id: toObjectId(patientId, 'patient_id'), status: 'active' }).sort({ severity: -1, created_at: -1 }).limit(8).lean() : [],
    patientId ? ProblemList.find({ patient_id: toObjectId(patientId, 'patient_id'), status: 'active' }).sort({ severity: -1, created_at: -1 }).limit(8).lean() : [],
    ticket.encounter_id ? ClinicalNote.find({ encounter_id: ticket.encounter_id?._id || ticket.encounter_id, status: { $ne: 'cancelled' } }).sort({ created_at: -1 }).limit(5).lean() : [],
    patientId ? EmergencyCase.findOne({ patient_id: toObjectId(patientId, 'patient_id'), status: { $in: OPEN_EMERGENCY_STATUSES } }).sort({ created_at: -1 }).lean() : null,
  ]);

  return {
    queue_ticket: formatQueueItem(ticket, { now: new Date() }),
    raw_queue_ticket: ticket,
    appointment: ticket.appointment_id || null,
    encounter: ticket.encounter_id || null,
    patient: patientDto(ticket.patient_id),
    doctor: ticket.doctor_id || null,
    department: ticket.department_id || null,
    latest_vital: latestVital,
    latest_triage: latestTriage,
    nursing_intake: intakeDto(intake),
    allergies,
    active_problems: problems,
    latest_notes: notes,
    emergency_case: emergencyCase,
    risk_tags: buildRiskTags({ ticket, latestVital, latestTriage, allergies, problems, emergencyCase }),
    available_actions: buildAvailableActions(ticket, latestVital, latestTriage, intake),
  };
}

function buildRiskTags({ ticket = {}, latestVital = null, latestTriage = null, allergies = [], problems = [], emergencyCase = null }) {
  const tags = [];
  if (ticket.queue_type === 'vip') tags.push({ code: 'VIP', label: 'VIP', severity: 'high' });
  if (ticket.queue_type === 'priority') tags.push({ code: 'PRIORITY', label: 'Ưu tiên', severity: 'high' });
  if (Array.isArray(allergies) && allergies.length) tags.push({ code: 'ALLERGY', label: 'Có dị ứng', severity: 'high' });
  if (Array.isArray(problems) && problems.length) tags.push({ code: 'PROBLEM', label: 'Bệnh nền active', severity: 'warning' });
  if (latestVital?.overall_severity && latestVital.overall_severity !== 'normal') tags.push({ code: 'ABNORMAL_VITAL', label: 'Sinh hiệu bất thường', severity: latestVital.overall_severity });
  if (latestTriage?.acuity_level && ['red', 'orange'].includes(latestTriage.acuity_level)) tags.push({ code: 'HIGH_ACUITY', label: 'Triage khẩn', severity: 'critical' });
  if (emergencyCase) tags.push({ code: 'EMERGENCY', label: 'Có ca khẩn liên quan', severity: 'critical' });
  return tags;
}

function buildAvailableActions(ticket = {}, latestVital = null, latestTriage = null, intake = null) {
  const terminal = [QUEUE_STATUS.COMPLETED, QUEUE_STATUS.CANCELLED, QUEUE_STATUS.NO_SHOW].includes(ticket.status);
  const hasVital = Boolean(latestVital);
  const hasTriage = Boolean(latestTriage && latestTriage.status === 'completed');
  return {
    can_claim: !terminal && !ticket.assigned_nurse_id,
    can_release: !terminal && Boolean(ticket.assigned_nurse_id),
    can_start_intake: !terminal && [NURSING_WORKFLOW_STATUS.WAITING_NURSE, NURSING_WORKFLOW_STATUS.NOT_STARTED].includes(ticket.nursing_stage || NURSING_WORKFLOW_STATUS.WAITING_NURSE),
    can_record_vital: !terminal,
    can_start_triage: !terminal && !hasTriage,
    can_complete_triage: !terminal && Boolean(latestTriage) && latestTriage.status !== 'completed',
    can_mark_ready: !terminal && (hasVital || hasTriage || intake?.status === 'completed'),
    can_transfer: !terminal && [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.SKIPPED, QUEUE_STATUS.RECALLED].includes(ticket.status),
    can_call: !terminal && [QUEUE_STATUS.WAITING, QUEUE_STATUS.SKIPPED, QUEUE_STATUS.RECALLED].includes(ticket.status),
    can_start_service: [QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED].includes(ticket.status),
    record_vital_reason: !terminal ? null : 'Queue đã kết thúc.',
    start_service_reason: [QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED].includes(ticket.status) ? null : 'Queue chưa được gọi.',
  };
}

async function claimQueueIntake(ticketId, actor = {}, requestMeta = {}) {
  const ticket = await getQueueTicketOrThrow(ticketId);
  const userId = actorUserId(actor);
  ticket.assigned_nurse_id = toObjectId(userId, 'user_id');
  ticket.assigned_nurse_at = new Date();
  ticket.nursing_stage = NURSING_WORKFLOW_STATUS.NURSE_IN_PROGRESS;
  ticket.nurse_started_at = ticket.nurse_started_at || new Date();
  ticket.nursing_stage_updated_at = new Date();
  ticket.nursing_stage_updated_by = userId;
  ticket.updated_by = userId;
  await ticket.save();

  const intake = await upsertIntakeForTicket(ticket, {
    assigned_nurse_id: toObjectId(userId, 'user_id'),
    status: 'in_progress',
    started_at: ticket.nurse_started_at,
  }, actor);

  await recordAuditLog({
    actor,
    action: 'nursing.intake.claim',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Điều dưỡng nhận tiếp nhận bệnh nhân.',
    requestMeta,
  });

  return { queue_ticket_id: String(ticket._id), nursing_stage: ticket.nursing_stage, nursing_intake: intakeDto(intake) };
}

async function releaseQueueIntake(ticketId, actor = {}, requestMeta = {}) {
  const ticket = await getQueueTicketOrThrow(ticketId);
  ticket.assigned_nurse_id = undefined;
  ticket.assigned_nurse_at = undefined;
  ticket.nursing_stage = NURSING_WORKFLOW_STATUS.WAITING_NURSE;
  ticket.nursing_stage_updated_at = new Date();
  ticket.nursing_stage_updated_by = actorUserId(actor);
  ticket.updated_by = actorUserId(actor);
  await ticket.save();

  const intake = await upsertIntakeForTicket(ticket, {
    assigned_nurse_id: undefined,
    status: 'waiting',
    released_at: new Date(),
  }, actor);

  await recordAuditLog({
    actor,
    action: 'nursing.intake.release',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Điều dưỡng trả bệnh nhân về danh sách chờ.',
    requestMeta,
  });

  return { queue_ticket_id: String(ticket._id), nursing_stage: ticket.nursing_stage, nursing_intake: intakeDto(intake) };
}

async function startQueueIntake(ticketId, actor = {}, requestMeta = {}) {
  return claimQueueIntake(ticketId, actor, requestMeta);
}

async function completeQueueIntake(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await getQueueTicketOrThrow(ticketId);
  const checklist = defaultIntakeChecklist(payload.checklist || payload);
  const nextStage = checklist.triage_required
    ? NURSING_WORKFLOW_STATUS.TRIAGE_PENDING
    : checklist.vital_required && !ticket.latest_vital_sign_id
      ? NURSING_WORKFLOW_STATUS.VITAL_PENDING
      : NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR;

  ticket.triage_required = checklist.triage_required;
  ticket.vital_required = checklist.vital_required;
  ticket.intake_checklist_completed = true;
  ticket.nurse_completed_at = new Date();
  ticket.nursing_stage = nextStage;
  ticket.nursing_stage_updated_at = new Date();
  ticket.nursing_stage_updated_by = actorUserId(actor);
  if (nextStage === NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR) {
    ticket.ready_for_doctor_at = new Date();
    ticket.ready_for_doctor_by = actorUserId(actor);
  }
  ticket.updated_by = actorUserId(actor);
  await ticket.save();

  const assignedNurseId = normalizeId(ticket.assigned_nurse_id) || actorUserId(actor);
  const intake = await upsertIntakeForTicket(ticket, {
    assigned_nurse_id: assignedNurseId ? toObjectId(assignedNurseId, 'assigned_nurse_id') : undefined,
    status: 'completed',
    completed_at: ticket.nurse_completed_at,
    checklist,
    note: payload.note,
  }, actor);

  await recordAuditLog({
    actor,
    action: 'nursing.intake.complete',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Hoàn tất tiếp nhận điều dưỡng.',
    requestMeta,
    metadata: { next_stage: nextStage },
  });

  return { queue_ticket_id: String(ticket._id), nursing_stage: ticket.nursing_stage, nursing_intake: intakeDto(intake) };
}

async function addQueueIntakeNote(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const note = String(payload.note || payload.content || '').trim();
  if (!note) throw createError('note là bắt buộc.', 400);

  const ticket = await getQueueTicketOrThrow(ticketId);
  const existing = await NursingIntake.findOne({ queue_ticket_id: ticket._id }).lean();
  const stampedNote = `[${new Date().toISOString()}] ${note}`;
  const nextNote = existing?.note ? `${existing.note}\n${stampedNote}` : stampedNote;
  const assignedNurseId = normalizeId(ticket.assigned_nurse_id) || actorUserId(actor);
  const intake = await upsertIntakeForTicket(ticket, {
    assigned_nurse_id: assignedNurseId ? toObjectId(assignedNurseId, 'assigned_nurse_id') : undefined,
    status: existing?.status || (ticket.nursing_stage === NURSING_WORKFLOW_STATUS.NURSE_IN_PROGRESS ? 'in_progress' : 'waiting'),
    note: nextNote,
  }, actor);

  await recordAuditLog({
    actor,
    action: 'nursing.intake.note',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Thêm ghi chú tiếp nhận điều dưỡng.',
    requestMeta,
  });

  return { queue_ticket_id: String(ticket._id), nursing_intake: intakeDto(intake) };
}

function buildTaskBoardColumns(tasks = []) {
  const columns = {
    unassigned: [],
    todo: [],
    in_progress: [],
    overdue: [],
    waiting_doctor: [],
    done: [],
  };

  tasks.forEach((task) => {
    const key = task.status === 'overdue'
      ? 'overdue'
      : task.status === 'done'
        ? 'done'
        : task.status === 'in_progress'
          ? 'in_progress'
          : task.actions?.includes('notify_doctor') || task.status === 'waiting_doctor'
            ? 'waiting_doctor'
            : !task.assigned_to
              ? 'unassigned'
              : 'todo';
    columns[key].push(task);
  });

  return columns;
}

function buildTaskTimeline(tasks = []) {
  const buckets = new Map();
  tasks.forEach((task) => {
    const sourceDate = task.due_at || task.waiting_since;
    if (!sourceDate) return;
    const date = new Date(sourceDate);
    if (Number.isNaN(date.getTime())) return;
    const hour = date.getHours();
    const key = `${String(hour).padStart(2, '0')}:00`;
    const bucket = buckets.get(key) || {
      hour: key,
      total: 0,
      overdue: 0,
      completed: 0,
      vital: 0,
      preparation: 0,
      emergency: 0,
      items: [],
    };
    bucket.total += 1;
    if (task.status === 'overdue') bucket.overdue += 1;
    if (task.status === 'done') bucket.completed += 1;
    if (task.type === 'vital') bucket.vital += 1;
    if (task.type === 'preparation') bucket.preparation += 1;
    if (task.type === 'emergency_response') bucket.emergency += 1;
    bucket.items.push(task);
    buckets.set(key, bucket);
  });

  return Array.from(buckets.values()).sort((a, b) => a.hour.localeCompare(b.hour));
}

async function getTasksBoard(query = {}, actor = {}) {
  const [taskPayload, dashboard] = await Promise.all([
    listTasks({ ...query, limit: query.limit || 200 }, actor, 'today'),
    assembleDashboard({ ...query, limit: 80 }, actor),
  ]);
  const generatedTasks = (dashboard.worklist.items || [])
    .filter((item) => ['vital_pending', 'triage_pending', 'preparation_pending', 'emergency', 'medication_due', 'medication_overdue'].includes(item.type))
    .slice(0, 32)
    .map((item) => {
      const decorated = decoratePendingPatient(item, new Date(dashboard.meta.generated_at || Date.now()));
      return {
        id: `generated_${item.id}`,
        source_type: decorated.source_type,
        source_id: decorated.source_id,
        patient_id: decorated.patient_id,
        patient_code: decorated.patient_code,
        patient_name: decorated.patient_name,
        type: decorated.type === 'vital_pending' ? 'vital' : decorated.type === 'preparation_pending' ? 'preparation' : decorated.type,
        title: decorated.type === 'vital_pending' ? 'Đo sinh hiệu' : decorated.reason,
        reason: decorated.reason,
        priority: decorated.priority,
        status: decorated.sla_status === 'breached' || decorated.status === 'overdue' ? 'overdue' : 'todo',
        due_at: decorated.sla_due_at || decorated.waiting_since,
        waiting_since: decorated.waiting_since,
        overdue_minutes: decorated.overdue_minutes || 0,
        assigned_to: decorated.assigned_to,
        assigned_to_name: decorated.assigned_to_name,
        actions: decorated.actions,
        metadata: decorated.metadata,
      };
    });
  const tasks = [...taskPayload.items, ...generatedTasks]
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || new Date(a.due_at || a.waiting_since || 0) - new Date(b.due_at || b.waiting_since || 0));

  return {
    meta: dashboard.meta,
    summary: {
      total: tasks.length,
      mine: tasks.filter((task) => actorUserId(actor) && sameId(task.assigned_to, actorUserId(actor))).length,
      unassigned: tasks.filter((task) => !task.assigned_to).length,
      in_progress: tasks.filter((task) => task.status === 'in_progress').length,
      overdue: tasks.filter((task) => task.status === 'overdue').length,
      done: tasks.filter((task) => task.status === 'done').length,
      waiting_doctor: tasks.filter((task) => task.status === 'waiting_doctor' || task.actions?.includes('notify_doctor')).length,
      handover: tasks.filter((task) => task.type === 'handover').length,
    },
    columns: buildTaskBoardColumns(tasks),
    timeline: buildTaskTimeline(tasks),
    table: tasks,
  };
}

async function getTaskDetail(taskId, actor = {}) {
  const task = await NursingTask.findById(taskId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('assigned_to', 'full_name employee_code')
    .populate('queue_ticket_id', 'queue_number display_number status nursing_stage checkin_time')
    .lean();
  if (!task) throw createError('Không tìm thấy task điều dưỡng.', 404);
  return taskDto(task, 'nursing_task', new Date());
}

async function assignTaskToMe(taskId, actor = {}, requestMeta = {}) {
  const userId = actorUserId(actor);
  if (!userId) throw createError('Không xác định được điều dưỡng hiện tại.', 403);
  const task = await NursingTask.findById(taskId);
  if (!task) throw createError('Không tìm thấy task điều dưỡng.', 404);
  task.assigned_to = toObjectId(userId, 'user_id');
  task.updated_by = userId;
  await task.save();
  await recordAuditLog({
    actor,
    action: 'nursing.task.assign_to_me',
    targetType: 'nursing_task',
    targetId: task._id,
    status: 'success',
    message: 'Điều dưỡng nhận task.',
    requestMeta,
  });
  return taskDto(task, 'nursing_task', new Date());
}

async function reopenTask(taskId, actor = {}, requestMeta = {}) {
  const task = await NursingTask.findById(taskId);
  if (!task) throw createError('Không tìm thấy task điều dưỡng.', 404);
  task.status = 'todo';
  task.completed_at = undefined;
  task.completed_by = undefined;
  task.cancelled_at = undefined;
  task.cancelled_by = undefined;
  task.updated_by = actorUserId(actor);
  await task.save();
  await recordAuditLog({
    actor,
    action: 'nursing.task.reopen',
    targetType: 'nursing_task',
    targetId: task._id,
    status: 'success',
    message: 'Mở lại task điều dưỡng.',
    requestMeta,
  });
  return taskDto(task, 'nursing_task', new Date());
}

function normalizeAlert(alert = {}) {
  const waitingMinutes = minutesSince(alert.created_at, new Date());
  return {
    ...alert,
    status: alert.status || 'open',
    waiting_minutes: waitingMinutes,
    sla_status: alert.severity === 'critical' || alert.type?.includes('overdue') || waitingMinutes >= 30 ? 'breached' : waitingMinutes >= 15 ? 'warning' : 'normal',
    source_type: alert.type,
  };
}

function buildAlertTypeChart(alerts = []) {
  return alerts.reduce((chart, alert) => {
    const type = alert.type || 'system';
    chart[type] = (chart[type] || 0) + 1;
    return chart;
  }, {});
}

async function getPriorityAlertCenter(query = {}, actor = {}) {
  const dashboard = await assembleDashboard(query, actor);
  const alerts = (dashboard.priority_alerts || []).map(normalizeAlert);
  return {
    meta: dashboard.meta,
    summary: {
      total: alerts.length,
      critical: alerts.filter((alert) => alert.severity === 'critical').length,
      high: alerts.filter((alert) => alert.severity === 'high').length,
      unacknowledged: alerts.filter((alert) => !alert.acknowledged_at && alert.status !== 'resolved').length,
      need_doctor: alerts.filter((alert) => alert.actions?.includes('notify_doctor')).length,
      sla_breached: alerts.filter((alert) => alert.sla_status === 'breached').length,
      resolved_today: alerts.filter((alert) => alert.status === 'resolved').length,
    },
    severity_heat: {
      critical: alerts.filter((alert) => alert.severity === 'critical').length,
      high: alerts.filter((alert) => alert.severity === 'high').length,
      medium: alerts.filter((alert) => ['medium', 'warning'].includes(alert.severity)).length,
    },
    type_chart: buildAlertTypeChart(alerts),
    items: alerts,
    selected: alerts[0] || null,
  };
}

async function getPriorityAlertSummary(query = {}, actor = {}) {
  const payload = await getPriorityAlertCenter(query, actor);
  return {
    meta: payload.meta,
    summary: payload.summary,
    severity_heat: payload.severity_heat,
    type_chart: payload.type_chart,
  };
}

async function getPriorityAlertDetail(alertId, query = {}, actor = {}) {
  const payload = await getPriorityAlertCenter(query, actor);
  const alert = payload.items.find((item) => item.id === alertId);
  if (!alert) throw createError('Không tìm thấy cảnh báo ưu tiên.', 404);
  return {
    alert,
    patient_context: {
      patient_id: alert.patient_id,
      patient_name: alert.patient_name,
      patient_code: alert.patient_code || null,
    },
    action_history: [],
  };
}

async function updatePriorityAlertAction(alertId, action, payload = {}, actor = {}, requestMeta = {}) {
  if (alertId.startsWith('alert_vital_')) {
    const vitalId = alertId.replace('alert_vital_', '');
    if (action === 'acknowledge') return acknowledgeVitalAlert(vitalId, actor, requestMeta);
    if (action === 'notify_doctor') return notifyDoctorOfVital(vitalId, actor, requestMeta);
  }

  if (alertId.startsWith('alert_task_')) {
    const taskId = alertId.replace('alert_task_', '');
    if (action === 'assign_to_me') return assignTaskToMe(taskId, actor, requestMeta);
    if (action === 'resolve') return updateTaskStatus(taskId, 'done', payload, actor, requestMeta);
  }

  await recordAuditLog({
    actor,
    action: `nursing.priority_alert.${action}`,
    targetType: 'priority_alert',
    targetId: alertId,
    status: 'success',
    message: 'Cập nhật cảnh báo ưu tiên tổng hợp.',
    requestMeta,
    metadata: payload,
  });

  return {
    alert_id: alertId,
    action,
    status: 'accepted',
    updated_at: new Date().toISOString(),
  };
}

function flattenQueueBoard(board = {}) {
  return Object.values(board).flat();
}

function estimateClearTime(queueMetrics = {}, now = new Date()) {
  const waiting = queueMetrics.waiting || 0;
  const throughput = queueMetrics.throughput_per_hour || 1;
  const minutes = Math.ceil((waiting / Math.max(throughput, 1)) * 60);
  const date = new Date(now.getTime() + minutes * 60000);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function buildQueueMetrics(dashboard = {}) {
  const now = new Date(dashboard.meta?.generated_at || Date.now());
  const boardItems = flattenQueueBoard(dashboard.queue?.board || {});
  const activeItems = boardItems.filter((item) => OPEN_QUEUE_STATUSES.includes(item.status));
  const waitValues = activeItems.map((item) => item.waiting_minutes || 0);
  const completed = dashboard.queue?.completed || 0;
  const dayStart = new Date(dashboard.meta?.date || now);
  const elapsedHours = Math.max((now.getTime() - dayStart.getTime()) / 3600000, 1);
  const metrics = {
    total: dashboard.queue?.total || 0,
    waiting: dashboard.queue?.waiting || 0,
    average_wait_minutes: waitValues.length ? Math.round(waitValues.reduce((sum, value) => sum + value, 0) / waitValues.length) : 0,
    longest_wait_minutes: waitValues.length ? Math.max(...waitValues) : 0,
    throughput_per_hour: Math.round((completed / elapsedHours) * 10) / 10,
    no_show_rate: dashboard.queue?.total ? Math.round(((dashboard.queue.no_show || 0) / dashboard.queue.total) * 1000) / 10 : 0,
    skip_rate: dashboard.queue?.total ? Math.round(((dashboard.queue.skipped || 0) / dashboard.queue.total) * 1000) / 10 : 0,
    bottleneck_status: dashboard.kpis?.vital_pending >= dashboard.kpis?.triage_pending ? 'vital_pending' : 'triage_pending',
    sla_breached: activeItems.filter((item) => (item.waiting_minutes || 0) >= NURSING_WAITING_SLA_MINUTES).length,
  };
  return {
    ...metrics,
    estimated_clear_time: estimateClearTime(metrics, now),
  };
}

async function getNursingQueueBoard(query = {}, actor = {}) {
  const dashboard = await assembleDashboard(query, actor);
  const metrics = buildQueueMetrics(dashboard);
  return {
    meta: dashboard.meta,
    summary: {
      total: dashboard.queue.total,
      waiting: dashboard.queue.waiting,
      called: dashboard.queue.called,
      in_service: dashboard.queue.in_service,
      skipped: dashboard.queue.skipped,
      completed: dashboard.queue.completed,
      no_show: dashboard.queue.no_show,
      recalled: dashboard.queue.board?.recalled?.length || 0,
      transferred: dashboard.queue.board?.transferred?.length || 0,
      sla_breached: metrics.sla_breached,
    },
    metrics,
    board: dashboard.queue.board,
    table: (dashboard.queue.items || flattenQueueBoard(dashboard.queue.board || []))
      .sort((a, b) => (b.waiting_minutes || 0) - (a.waiting_minutes || 0)),
    tv_display: {
      calling: [...(dashboard.queue.board?.called || []), ...(dashboard.queue.board?.recalled || [])][0] || null,
      next: dashboard.queue.board?.waiting?.slice(0, 5) || [],
      in_service: dashboard.queue.board?.in_service?.slice(0, 3) || [],
    },
  };
}

async function getNursingQueueMetrics(query = {}, actor = {}) {
  const payload = await getNursingQueueBoard(query, actor);
  return {
    meta: payload.meta,
    summary: payload.summary,
    metrics: payload.metrics,
  };
}

function stripWorkItemId(workItemId = '', prefix) {
  return String(workItemId).startsWith(prefix) ? String(workItemId).slice(prefix.length) : null;
}

async function assignQueueOrEncounter(sourceId, actor = {}, requestMeta = {}) {
  const userId = actorUserId(actor);
  if (!userId) throw createError('Không xác định được điều dưỡng hiện tại.', 403);

  let ticket = null;
  if (Types.ObjectId.isValid(sourceId)) {
    ticket = await QueueTicket.findById(sourceId);
  }

  if (ticket) {
    ticket.assigned_nurse_id = toObjectId(userId, 'user_id');
    ticket.assigned_nurse_at = new Date();
    ticket.updated_by = userId;
    await ticket.save();
    if (ticket.encounter_id) {
      await Encounter.updateOne(
        { _id: ticket.encounter_id },
        {
          $set: {
            assigned_nurse_id: toObjectId(userId, 'user_id'),
            assigned_nurse_at: new Date(),
            updated_by: toObjectId(userId, 'user_id'),
          },
        },
      );
    }
    await recordAuditLog({
      actor,
      action: 'nursing.work_item.assign_queue_to_me',
      targetType: 'queue_ticket',
      targetId: ticket._id,
      status: 'success',
      message: 'Điều dưỡng nhận xử lý queue ticket.',
      requestMeta,
    });
    return {
      source_type: 'queue_ticket',
      source_id: String(ticket._id),
      assigned_to: String(userId),
      assigned_at: ticket.assigned_nurse_at,
    };
  }

  const encounter = Types.ObjectId.isValid(sourceId) ? await Encounter.findById(sourceId) : null;
  if (!encounter) throw createError('Không tìm thấy work item để nhận xử lý.', 404);
  encounter.assigned_nurse_id = toObjectId(userId, 'user_id');
  encounter.assigned_nurse_at = new Date();
  encounter.updated_by = userId;
  await encounter.save();
  await recordAuditLog({
    actor,
    action: 'nursing.work_item.assign_encounter_to_me',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Điều dưỡng nhận xử lý encounter.',
    requestMeta,
  });
  return {
    source_type: 'encounter',
    source_id: String(encounter._id),
    assigned_to: String(userId),
    assigned_at: encounter.assigned_nurse_at,
  };
}

async function createTaskFromVital(vitalId, actor = {}, requestMeta = {}) {
  const userId = actorUserId(actor);
  const vital = await VitalSign.findById(vitalId).populate('encounter_id', 'department_id patient_id').lean();
  if (!vital) throw createError('Không tìm thấy sinh hiệu.', 404);
  const departmentId = vital.encounter_id?.department_id || actorDepartmentId(actor);
  if (!departmentId) throw createError('Không xác định được khoa/phòng cho task.', 400);
  const task = await NursingTask.findOneAndUpdate(
    { source_type: 'vital_sign', source_id: vital._id },
    {
      $setOnInsert: {
        patient_id: vital.patient_id || vital.encounter_id?.patient_id,
        encounter_id: vital.encounter_id?._id || vital.encounter_id,
        department_id: departmentId,
        title: 'Xử lý sinh hiệu bất thường',
        description: 'Cần xác nhận sinh hiệu và báo bác sĩ nếu cần.',
        task_type: 'vital',
        priority: 'critical',
        status: 'todo',
        source_type: 'vital_sign',
        source_id: vital._id,
        created_by: userId,
      },
      $set: {
        assigned_to: toObjectId(userId, 'user_id'),
        updated_by: toObjectId(userId, 'user_id'),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await recordAuditLog({
    actor,
    action: 'nursing.work_item.assign_vital_to_me',
    targetType: 'nursing_task',
    targetId: task._id,
    status: 'success',
    message: 'Tạo/nhận task xử lý sinh hiệu bất thường.',
    requestMeta,
  });
  return taskDto(task, 'nursing_task', new Date());
}

async function assignWorkItemToMe(workItemId, actor = {}, requestMeta = {}) {
  const userId = actorUserId(actor);
  if (!userId) throw createError('Không xác định được điều dưỡng hiện tại.', 403);

  const nursingTaskId = stripWorkItemId(workItemId, 'nursing_task_');
  if (nursingTaskId) return assignTaskToMe(nursingTaskId, actor, requestMeta);

  const inpatientTaskId = stripWorkItemId(workItemId, 'inpatient_task_');
  if (inpatientTaskId) {
    const task = await InpatientTask.findById(inpatientTaskId);
    if (!task) throw createError('Không tìm thấy task nội trú.', 404);
    task.assigned_to = toObjectId(userId, 'user_id');
    task.updated_by = userId;
    await task.save();
    return taskDto(task, 'inpatient_task', new Date());
  }

  const waitingTicketId = stripWorkItemId(workItemId, 'waiting_nurse_');
  if (waitingTicketId) return assignQueueOrEncounter(waitingTicketId, actor, requestMeta);

  const vitalPendingId = stripWorkItemId(workItemId, 'vital_pending_');
  if (vitalPendingId) return assignQueueOrEncounter(vitalPendingId, actor, requestMeta);

  const emergencyId = stripWorkItemId(workItemId, 'emergency_');
  if (emergencyId) {
    const emergencyCase = await EmergencyCase.findById(emergencyId);
    if (!emergencyCase) throw createError('Không tìm thấy ca cấp cứu.', 404);
    emergencyCase.assigned_to_user_id = toObjectId(userId, 'user_id');
    emergencyCase.updated_by = userId;
    await emergencyCase.save();
    return { source_type: 'emergency_case', source_id: emergencyId, assigned_to: String(userId) };
  }

  const preparationOrderId = stripWorkItemId(workItemId, 'preparation_');
  if (preparationOrderId) {
    const checklist = await createPreparationFromOrder(preparationOrderId, { assigned_to: userId }, actor, requestMeta);
    checklist.assigned_to = toObjectId(userId, 'user_id');
    checklist.updated_by = userId;
    await checklist.save();
    return { source_type: 'service_preparation_checklist', source_id: String(checklist._id), assigned_to: String(userId) };
  }

  const abnormalVitalId = stripWorkItemId(workItemId, 'abnormal_vital_');
  if (abnormalVitalId) return createTaskFromVital(abnormalVitalId, actor, requestMeta);

  throw createError('Loại work item chưa hỗ trợ nhận xử lý.', 409);
}

async function completeWorkItem(workItemId, payload = {}, actor = {}, requestMeta = {}) {
  const nursingTaskId = stripWorkItemId(workItemId, 'nursing_task_');
  if (nursingTaskId) return updateTaskStatus(nursingTaskId, 'done', payload, actor, requestMeta);

  const inpatientTaskId = stripWorkItemId(workItemId, 'inpatient_task_');
  if (inpatientTaskId) {
    const task = await InpatientTask.findById(inpatientTaskId);
    if (!task) throw createError('Không tìm thấy task nội trú.', 404);
    task.status = INPATIENT_TASK_STATUS.DONE;
    task.completed_at = new Date();
    task.completed_by = actorUserId(actor);
    task.updated_by = actorUserId(actor);
    await task.save();
    return taskDto(task, 'inpatient_task', new Date());
  }

  const vitalPendingId = stripWorkItemId(workItemId, 'vital_pending_');
  if (vitalPendingId) return markQueueStage(vitalPendingId, NURSING_WORKFLOW_STATUS.VITAL_DONE, actor, requestMeta);

  const waitingTicketId = stripWorkItemId(workItemId, 'waiting_nurse_');
  if (waitingTicketId) return markQueueStage(waitingTicketId, NURSING_WORKFLOW_STATUS.TRIAGE_DONE, actor, requestMeta);

  const preparationOrderId = stripWorkItemId(workItemId, 'preparation_');
  if (preparationOrderId) {
    const checklist = await ServicePreparationChecklist.findOne({ order_id: toObjectId(preparationOrderId, 'order_id') });
    if (!checklist) throw createError('Chưa có checklist chuẩn bị để hoàn tất.', 409);
    return completePreparation(checklist._id, actor, requestMeta);
  }

  throw createError('Loại work item chưa hỗ trợ hoàn tất trực tiếp.', 409);
}

async function getPendingVitals(query = {}, actor = {}) {
  const dashboard = await assembleDashboard(query, actor);
  const items = dashboard.vitals.pending_items || [];
  return {
    meta: dashboard.meta,
    items,
    summary: {
      pending: dashboard.vitals.pending,
      total_waiting: dashboard.vitals.pending,
      no_vitals: items.filter((item) => !item.latest_vital_sign_id && !item.latest_vital_sign).length,
      overdue: items.filter((item) => (item.waiting_minutes || 0) >= NURSING_WAITING_SLA_MINUTES).length,
      high_priority: items.filter((item) => ['critical', 'high'].includes(item.priority)).length,
      recheck_due: items.filter((item) => item.requires_recheck).length,
      abnormal_latest: items.filter((item) => {
        const vital = item.latest_vital_sign || item.latest_vital || {};
        return vital.overall_severity && vital.overall_severity !== 'normal';
      }).length,
    },
  };
}

async function getAbnormalVitals(query = {}, actor = {}) {
  const dashboard = await assembleDashboard(query, actor);
  const items = dashboard.vitals.abnormal_items || [];
  return {
    meta: dashboard.meta,
    items,
    summary: {
      abnormal: dashboard.vitals.abnormal,
      critical: items.filter((item) => item.severity === 'critical').length,
      high: items.filter((item) => item.severity === 'high').length,
      warning: items.filter((item) => ['warning', 'high'].includes(item.severity)).length,
      unacknowledged: items.filter((item) => !item.acknowledged_at).length,
      doctor_notified: items.filter((item) => item.doctor_notified_at).length,
    },
  };
}

function formatVitalHistoryItem(vital = {}) {
  const encounter = vital.encounter_id && typeof vital.encounter_id === 'object' ? vital.encounter_id : {};
  const queueTicket = vital.queue_ticket_id && typeof vital.queue_ticket_id === 'object' ? vital.queue_ticket_id : {};
  const appointment = vital.appointment_id && typeof vital.appointment_id === 'object' ? vital.appointment_id : {};
  const patient = vital.patient_id && typeof vital.patient_id === 'object'
    ? vital.patient_id
    : encounter.patient_id || queueTicket.patient_id || appointment.patient_id;
  return {
    vital_sign: vital,
    vital_sign_id: normalizeId(vital),
    patient: patientDto(patient),
    patient_id: normalizeId(patient),
    patient_code: patient?.patient_code || null,
    patient_name: patient?.full_name || 'Chưa rõ bệnh nhân',
    age: ageFromDate(patient?.date_of_birth),
    gender: patient?.gender || null,
    phone: patient?.phone || null,
    encounter_id: normalizeId(encounter) || normalizeId(vital.encounter_id),
    encounter_code: encounter.encounter_code || null,
    queue_ticket_id: normalizeId(queueTicket) || normalizeId(vital.queue_ticket_id),
    queue_number: queueTicket.display_number || queueTicket.queue_number || null,
    department_id: normalizeId(encounter.department_id || queueTicket.department_id || appointment.department_id),
    department_name: encounter.department_id?.department_name || queueTicket.department_id?.department_name || appointment.department_id?.department_name || null,
    doctor_id: normalizeId(encounter.attending_doctor_id || queueTicket.doctor_id || appointment.doctor_id),
    doctor_name: userName(encounter.attending_doctor_id || queueTicket.doctor_id || appointment.doctor_id),
    recorded_at: vital.recorded_at,
    status: vital.status,
    severity: vital.overall_severity || vital.severity || 'normal',
  };
}

function vitalHistorySummary(items = []) {
  return {
    total_records: items.length,
    abnormal_records: items.filter((entry) => entry.severity && entry.severity !== 'normal').length,
    critical_records: items.filter((entry) => entry.severity === 'critical').length,
    amended_records: items.filter((entry) => entry.status === VITAL_SIGN_STATUS.AMENDED).length,
    entered_in_error_records: items.filter((entry) => entry.status === VITAL_SIGN_STATUS.ENTERED_IN_ERROR).length,
  };
}

async function getVitalHistory(query = {}, actor = {}) {
  const filters = normalizeFilters(query, actor);
  const vitalFilter = {
    recorded_at: { $gte: filters.range_start, $lte: filters.range_end },
  };
  if (query.patient_id) vitalFilter.patient_id = toObjectId(query.patient_id, 'patient_id');
  if (query.encounter_id) vitalFilter.encounter_id = toObjectId(query.encounter_id, 'encounter_id');
  if (query.queue_ticket_id) vitalFilter.queue_ticket_id = toObjectId(query.queue_ticket_id, 'queue_ticket_id');
  if (filters.status && filters.status !== 'all') vitalFilter.status = filters.status;
  if (!query.include_entered_in_error && !vitalFilter.status) vitalFilter.status = { $ne: VITAL_SIGN_STATUS.ENTERED_IN_ERROR };
  if (filters.priority && filters.priority !== 'all') vitalFilter.overall_severity = filters.priority;
  if (query.severity && query.severity !== 'all') vitalFilter.overall_severity = query.severity;

  const limit = Math.min(Math.max(Number(query.limit || 120), 1), 300);
  let items = await VitalSign.find(vitalFilter)
    .sort({ recorded_at: -1 })
    .limit(limit)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate({
      path: 'encounter_id',
      select: 'encounter_code patient_id department_id attending_doctor_id nursing_status start_time chief_reason',
      populate: [
        { path: 'patient_id', select: 'patient_code full_name gender date_of_birth phone' },
        { path: 'department_id', select: 'department_name department_code' },
        { path: 'attending_doctor_id', select: 'full_name employee_code' },
      ],
    })
    .populate({
      path: 'queue_ticket_id',
      select: 'queue_number display_number patient_id department_id doctor_id nursing_stage priority_reason checkin_time',
      populate: [
        { path: 'patient_id', select: 'patient_code full_name gender date_of_birth phone' },
        { path: 'department_id', select: 'department_name department_code' },
        { path: 'doctor_id', select: 'full_name employee_code' },
      ],
    })
    .populate({
      path: 'appointment_id',
      select: 'appointment_time appointment_type reason status patient_id department_id doctor_id',
      populate: [
        { path: 'patient_id', select: 'patient_code full_name gender date_of_birth phone' },
        { path: 'department_id', select: 'department_name department_code' },
        { path: 'doctor_id', select: 'full_name employee_code' },
      ],
    })
    .populate('recorded_by', 'full_name employee_code')
    .lean();

  const formatted = items.map(formatVitalHistoryItem)
    .filter((entry) => !filters.department_id || sameId(entry.department_id, filters.department_id));
  const selected = formatted[0] || null;
  return {
    meta: {
      date: filters.date_key,
      shift: filters.shift,
      department_id: filters.department_id,
      generated_at: filters.now.toISOString(),
    },
    patient: selected ? selected.patient : null,
    summary: vitalHistorySummary(formatted),
    items: formatted,
  };
}

function formatNursingNoteItem(note = {}) {
  const encounter = note.encounter_id && typeof note.encounter_id === 'object' ? note.encounter_id : {};
  const linkedVitals = Array.isArray(note.linked_vital_sign_ids) ? note.linked_vital_sign_ids : [];
  const latestVital = linkedVitals.find((item) => item && typeof item === 'object') || null;
  const patient = encounter.patient_id || (latestVital?.patient_id && typeof latestVital.patient_id === 'object' ? latestVital.patient_id : {}) || {};
  const severity = latestVital?.overall_severity || latestVital?.severity || (String(note.note_type || '').toLowerCase().includes('abnormal') ? 'warning' : 'normal');
  return {
    ...note,
    clinical_note_id: normalizeId(note),
    encounter_id: normalizeId(encounter) || normalizeId(note.encounter_id),
    encounter_code: encounter.encounter_code || null,
    patient: patientDto(patient),
    patient_id: normalizeId(patient),
    patient_code: patient.patient_code || null,
    patient_name: patient.full_name || 'Chưa rõ bệnh nhân',
    age: ageFromDate(patient.date_of_birth),
    gender: patient.gender || null,
    phone: patient.phone || null,
    department_id: normalizeId(encounter.department_id),
    department_name: encounter.department_id?.department_name || null,
    doctor_id: normalizeId(encounter.attending_doctor_id),
    doctor_name: userName(encounter.attending_doctor_id),
    latest_vital_sign: latestVital || null,
    severity,
  };
}

async function getNursingVitalNotes(query = {}, actor = {}) {
  const filters = normalizeFilters(query, actor);
  const noteFilter = {
    created_at: { $gte: filters.range_start, $lte: filters.range_end },
    $or: [
      { note_type: /^nursing/i },
      { tags: { $in: ['nursing', 'vital_sign', 'abnormal_vital'] } },
      { linked_vital_sign_ids: { $exists: true, $ne: [] } },
    ],
  };
  if (query.encounter_id) noteFilter.encounter_id = toObjectId(query.encounter_id, 'encounter_id');
  if (filters.status && filters.status !== 'all') noteFilter.status = filters.status;
  const contextualFilters = [];
  if (query.vital_sign_id) {
    contextualFilters.push({ linked_vital_sign_ids: toObjectId(query.vital_sign_id, 'vital_sign_id') });
  }
  if (query.patient_id && !query.encounter_id) {
    const encounterIds = await Encounter.find({ patient_id: toObjectId(query.patient_id, 'patient_id') }).distinct('_id');
    contextualFilters.push(encounterIds.length ? { encounter_id: { $in: encounterIds } } : { encounter_id: { $in: [] } });
  }
  if (query.queue_ticket_id && !query.encounter_id) {
    const [ticket, vitalIds] = await Promise.all([
      QueueTicket.findById(toObjectId(query.queue_ticket_id, 'queue_ticket_id')).select('encounter_id').lean(),
      VitalSign.find({ queue_ticket_id: toObjectId(query.queue_ticket_id, 'queue_ticket_id') }).distinct('_id'),
    ]);
    const queueFilters = [];
    if (ticket?.encounter_id) queueFilters.push({ encounter_id: ticket.encounter_id });
    if (vitalIds.length) queueFilters.push({ linked_vital_sign_ids: { $in: vitalIds } });
    contextualFilters.push(queueFilters.length ? { $or: queueFilters } : { encounter_id: { $in: [] } });
  }
  const findFilter = contextualFilters.length ? { $and: [noteFilter, ...contextualFilters] } : noteFilter;

  const limit = Math.min(Math.max(Number(query.limit || 120), 1), 300);
  const rows = await ClinicalNote.find(findFilter)
    .sort({ created_at: -1 })
    .limit(limit)
    .populate({
      path: 'encounter_id',
      select: 'encounter_code patient_id department_id attending_doctor_id status start_time chief_reason',
      populate: [
        { path: 'patient_id', select: 'patient_code full_name gender date_of_birth phone' },
        { path: 'department_id', select: 'department_name department_code' },
        { path: 'attending_doctor_id', select: 'full_name employee_code' },
      ],
    })
    .populate('author_id', 'full_name employee_code')
    .populate('signed_by', 'full_name employee_code')
    .populate('notified_doctor_id', 'full_name employee_code')
    .populate({
      path: 'linked_vital_sign_ids',
      select: [
        'recorded_at',
        'status',
        'patient_id',
        'encounter_id',
        'queue_ticket_id',
        'appointment_id',
        'recorded_by',
        'temperature',
        'heart_rate',
        'respiratory_rate',
        'systolic_bp',
        'diastolic_bp',
        'spo2',
        'weight',
        'height',
        'bmi',
        'pain_score',
        'blood_glucose',
        'gcs_total',
        'oxygen_device',
        'oxygen_flow_rate',
        'abnormal_flags',
        'severity',
        'overall_severity',
        'requires_recheck',
        'suggested_recheck_minutes',
        'requires_doctor_notification',
        'acknowledged_at',
        'doctor_notified_at',
        'related_task_id',
        'note',
      ].join(' '),
      populate: [
        { path: 'recorded_by', select: 'full_name employee_code' },
        { path: 'patient_id', select: 'patient_code full_name gender date_of_birth phone' },
      ],
    })
    .lean();

  const items = rows.map(formatNursingNoteItem)
    .filter((item) => !filters.department_id || sameId(item.department_id, filters.department_id));
  return {
    meta: {
      date: filters.date_key,
      shift: filters.shift,
      department_id: filters.department_id,
      generated_at: filters.now.toISOString(),
    },
    summary: {
      total: items.length,
      draft: items.filter((item) => item.status === 'draft').length,
      unsigned: items.filter((item) => ['draft', 'in_progress'].includes(item.status)).length,
      abnormal: items.filter((item) => String(item.note_type || '').toLowerCase().includes('abnormal') || item.severity !== 'normal').length,
      doctor_notified: items.filter((item) => item.notified_doctor_id || item.doctor_notified_at).length,
      linked_vitals: items.filter((item) => Array.isArray(item.linked_vital_sign_ids) && item.linked_vital_sign_ids.length).length,
    },
    items,
  };
}

async function markQueueStage(ticketId, stage, actor = {}, requestMeta = {}) {
  if (!NURSING_WORKFLOW_STATUSES.includes(stage)) throw createError('nursing_stage không hợp lệ.', 400);
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);

  ticket.nursing_stage = stage;
  ticket.nursing_stage_updated_at = new Date();
  ticket.nursing_stage_updated_by = actorUserId(actor);
  if (stage === NURSING_WORKFLOW_STATUS.NURSE_IN_PROGRESS) ticket.nurse_started_at = ticket.nurse_started_at || new Date();
  if (stage === NURSING_WORKFLOW_STATUS.TRIAGE_IN_PROGRESS) ticket.triage_started_at = ticket.triage_started_at || new Date();
  if (stage === NURSING_WORKFLOW_STATUS.TRIAGE_DONE) ticket.triage_completed_at = new Date();
  if (stage === NURSING_WORKFLOW_STATUS.VITAL_DONE) ticket.vital_recorded_at = ticket.vital_recorded_at || new Date();
  if (stage === NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR) {
    ticket.ready_for_doctor_at = new Date();
    ticket.ready_for_doctor_by = actorUserId(actor);
  }
  ticket.updated_by = actorUserId(actor);
  await ticket.save();

  if (ticket.encounter_id) {
    await Encounter.updateOne(
      { _id: ticket.encounter_id },
      {
        $set: {
          nursing_status: stage,
          nursing_status_updated_at: new Date(),
          nursing_status_updated_by: actorUserId(actor),
          ...(stage === NURSING_WORKFLOW_STATUS.NURSE_IN_PROGRESS ? { waiting_nurse_at: ticket.nurse_started_at || new Date() } : {}),
          ...(stage === NURSING_WORKFLOW_STATUS.TRIAGE_IN_PROGRESS ? { triage_started_at: new Date() } : {}),
          ...(stage === NURSING_WORKFLOW_STATUS.TRIAGE_DONE ? { triage_completed_at: new Date() } : {}),
          ...(stage === NURSING_WORKFLOW_STATUS.VITAL_DONE ? { vital_recorded_at: new Date() } : {}),
          ...(stage === NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR ? { ready_for_doctor_at: new Date() } : {}),
        },
      },
    );
  }

  await recordAuditLog({
    actor,
    action: 'nursing.queue_stage.update',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Cập nhật nursing stage của queue ticket.',
    requestMeta,
    metadata: { nursing_stage: stage },
  });

  return {
    queue_ticket_id: String(ticket._id),
    nursing_stage: ticket.nursing_stage,
    updated_at: ticket.updated_at,
  };
}

async function markEncounterReadyForDoctor(encounterId, actor = {}, requestMeta = {}) {
  const encounter = await Encounter.findById(encounterId);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);

  encounter.nursing_status = NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR;
  encounter.nursing_status_updated_at = new Date();
  encounter.nursing_status_updated_by = actorUserId(actor);
  encounter.ready_for_doctor_at = new Date();
  encounter.updated_by = actorUserId(actor);
  await encounter.save();

  await QueueTicket.updateOne(
    { encounter_id: encounter._id },
    {
      $set: {
        nursing_stage: NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR,
        nursing_stage_updated_at: new Date(),
        nursing_stage_updated_by: actorUserId(actor),
        updated_by: actorUserId(actor),
      },
    },
  );

  await recordAuditLog({
    actor,
    action: 'nursing.encounter.ready_for_doctor',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Đánh dấu encounter sẵn sàng gặp bác sĩ.',
    requestMeta,
  });

  return {
    encounter_id: String(encounter._id),
    nursing_status: encounter.nursing_status,
    ready_for_doctor_at: encounter.ready_for_doctor_at,
  };
}

async function loadVitalForAction(vitalSignId) {
  const vital = await VitalSign.findById(vitalSignId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate({
      path: 'encounter_id',
      select: 'encounter_code patient_id department_id attending_doctor_id nursing_status',
      populate: [
        { path: 'patient_id', select: 'patient_code full_name gender date_of_birth phone' },
        { path: 'department_id', select: 'department_name department_code' },
        { path: 'attending_doctor_id', select: 'full_name employee_code' },
      ],
    })
    .populate({
      path: 'queue_ticket_id',
      select: 'queue_number display_number patient_id department_id doctor_id nursing_stage encounter_id',
      populate: [
        { path: 'patient_id', select: 'patient_code full_name gender date_of_birth phone' },
        { path: 'department_id', select: 'department_name department_code' },
        { path: 'doctor_id', select: 'full_name employee_code' },
      ],
    })
    .populate({
      path: 'appointment_id',
      select: 'appointment_time appointment_type reason status patient_id department_id doctor_id',
      populate: [
        { path: 'patient_id', select: 'patient_code full_name gender date_of_birth phone' },
        { path: 'department_id', select: 'department_name department_code' },
        { path: 'doctor_id', select: 'full_name employee_code' },
      ],
    });
  if (!vital) throw createError('Không tìm thấy sinh hiệu.', 404);
  return vital;
}

function vitalActionContext(vital = {}, actor = {}) {
  const encounter = vital.encounter_id && typeof vital.encounter_id === 'object' ? vital.encounter_id : {};
  const queueTicket = vital.queue_ticket_id && typeof vital.queue_ticket_id === 'object' ? vital.queue_ticket_id : {};
  const appointment = vital.appointment_id && typeof vital.appointment_id === 'object' ? vital.appointment_id : {};
  const patient = vital.patient_id && typeof vital.patient_id === 'object'
    ? vital.patient_id
    : encounter.patient_id || queueTicket.patient_id || appointment.patient_id;
  const department = encounter.department_id || queueTicket.department_id || appointment.department_id || actorDepartmentId(actor);
  const doctor = encounter.attending_doctor_id || queueTicket.doctor_id || appointment.doctor_id;
  return {
    patient,
    patient_id: normalizeId(patient) || normalizeId(vital.patient_id) || normalizeId(encounter.patient_id) || normalizeId(queueTicket.patient_id) || normalizeId(appointment.patient_id),
    patient_name: patient?.full_name || 'bệnh nhân',
    encounter_id: normalizeId(encounter) || normalizeId(vital.encounter_id) || normalizeId(queueTicket.encounter_id),
    queue_ticket_id: normalizeId(queueTicket) || normalizeId(vital.queue_ticket_id),
    appointment_id: normalizeId(appointment) || normalizeId(vital.appointment_id),
    department_id: normalizeId(department),
    doctor_id: normalizeId(doctor),
    doctor_name: userName(doctor),
    queue_number: queueTicket.display_number || queueTicket.queue_number || null,
  };
}

function formatVitalReadingForAction(vital = {}) {
  const bp = vital.systolic_bp && vital.diastolic_bp ? `HA ${vital.systolic_bp}/${vital.diastolic_bp}` : null;
  return [
    vital.temperature ? `T ${vital.temperature}°C` : null,
    vital.heart_rate ? `M ${vital.heart_rate}` : null,
    vital.respiratory_rate ? `NT ${vital.respiratory_rate}` : null,
    bp,
    vital.spo2 ? `SpO2 ${vital.spo2}%` : null,
  ].filter(Boolean).join(' · ') || 'Sinh hiệu bất thường';
}

function notificationPriorityForVital(vital = {}, emergency = false) {
  if (emergency || vital.overall_severity === 'critical' || vital.severity === 'critical') return NOTIFICATION_PRIORITY.CRITICAL;
  if (['high', 'warning'].includes(vital.overall_severity || vital.severity)) return NOTIFICATION_PRIORITY.URGENT;
  return NOTIFICATION_PRIORITY.HIGH;
}

function taskPriorityForVital(vital = {}, emergency = false) {
  if (emergency || vital.overall_severity === 'critical' || vital.severity === 'critical') return 'stat';
  if (vital.overall_severity === 'high' || vital.severity === 'high') return 'urgent';
  return 'high';
}

function taskPriorityValue(priority = 'normal') {
  return {
    low: 1,
    normal: 2,
    medium: 3,
    high: 4,
    urgent: 5,
    stat: 6,
    critical: 6,
  }[priority] || 0;
}

async function notifyAssignedDoctorForVital(vital, payload = {}, actor = {}, requestMeta = {}) {
  const context = vitalActionContext(vital, actor);
  if (!context.doctor_id || !Types.ObjectId.isValid(String(context.doctor_id))) return null;
  const emergency = Boolean(payload.emergency);
  const title = emergency
    ? `Báo khẩn sinh hiệu: ${context.patient_name}`
    : `Sinh hiệu bất thường: ${context.patient_name}`;
  const message = normalizeString(payload.message)
    || `${formatVitalReadingForAction(vital)}. ${emergency ? 'Cần bác sĩ phản hồi khẩn.' : 'Điều dưỡng đề nghị bác sĩ xem lại.'}`;
  const nowValue = new Date();
  const notification = await Notification.findOneAndUpdate(
    { dedupe_key: `nursing:vital:${normalizeId(vital)}:${emergency ? 'emergency' : 'doctor'}` },
    {
      $setOnInsert: definedObject({
        recipient_type: NOTIFICATION_RECIPIENT_TYPE.STAFF,
        recipient_id: toObjectId(context.doctor_id, 'doctor_id'),
        recipient_actor_type: 'staff',
        recipient_actor_id: toObjectId(context.doctor_id, 'doctor_id'),
        recipient_user_id: toObjectId(context.doctor_id, 'doctor_id'),
        patient_id: context.patient_id ? toObjectId(context.patient_id, 'patient_id') : undefined,
        channel: NOTIFICATION_CHANNEL.IN_APP,
        notification_type: emergency ? 'nursing_vital.emergency' : 'nursing_vital.doctor_notification',
        event_type: emergency ? 'nursing.vital_alert.emergency' : 'nursing.vital_alert.notify_doctor',
        created_by_module: 'nursing-dashboard-service',
        created_by: actorUserId(actor),
      }),
      $set: definedObject({
        priority: notificationPriorityForVital(vital, emergency),
        title,
        message,
        body: message,
        action_url: context.patient_id ? `/doctor/patients?patient=${context.patient_id}&vital=${normalizeId(vital)}` : `/doctor/workspace?vital=${normalizeId(vital)}`,
        payload: {
          entity_type: 'vital_sign',
          entity_id: normalizeId(vital),
          vital_sign_id: normalizeId(vital),
          patient_id: context.patient_id,
          encounter_id: context.encounter_id,
          queue_ticket_id: context.queue_ticket_id,
          queue_number: context.queue_number,
          severity: vital.overall_severity || vital.severity,
          emergency,
          request_meta: requestMeta?.requestId ? { request_id: requestMeta.requestId } : undefined,
        },
        sent_at: nowValue,
        delivered_at: nowValue,
        status: NOTIFICATION_STATUS.SENT,
        updated_by: actorUserId(actor),
      }),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return notification;
}

async function upsertVitalRecheckTask(vital, payload = {}, actor = {}, requestMeta = {}, options = {}) {
  const context = vitalActionContext(vital, actor);
  if (!context.patient_id) throw createError('Không xác định được bệnh nhân để tạo việc đo lại.', 400);
  if (!context.department_id) throw createError('Không xác định được khoa/phòng cho việc đo lại.', 400);
  const emergency = Boolean(options.emergency);
  const nowValue = new Date();
  const slaMinutes = Math.max(5, Math.min(Number(payload.sla_minutes || payload.suggested_recheck_minutes || vital.suggested_recheck_minutes || (emergency ? 5 : 15)), 240));
  const dueAt = new Date(nowValue.getTime() + slaMinutes * 60000);
  const nextPriority = taskPriorityForVital(vital, emergency);
  let task = await NursingTask.findOne({
    source_type: 'vital_sign',
    source_id: vital._id,
    status: { $in: OPEN_TASK_STATUSES },
  });

  if (!task) {
    task = new NursingTask({
      source_module: emergency ? 'emergency' : 'system',
      source_type: 'vital_sign',
      source_id: vital._id,
      patient_id: toObjectId(context.patient_id, 'patient_id'),
      encounter_id: context.encounter_id ? toObjectId(context.encounter_id, 'encounter_id') : undefined,
      queue_ticket_id: context.queue_ticket_id ? toObjectId(context.queue_ticket_id, 'queue_ticket_id') : undefined,
      department_id: toObjectId(context.department_id, 'department_id'),
      task_type: emergency ? 'emergency_response' : 'vital_sign',
      status: 'todo',
      created_by: actorUserId(actor),
    });
  }

  task.title = normalizeString(payload.title) || (emergency ? `Đáp ứng khẩn sinh hiệu - ${context.patient_name}` : `Đo lại sinh hiệu - ${context.patient_name}`);
  task.description = normalizeString(payload.description) || `${formatVitalReadingForAction(vital)}. ${emergency ? 'Ưu tiên khẩn, báo bác sĩ và theo dõi sát.' : 'Đo lại sau cảnh báo và cập nhật bác sĩ nếu còn bất thường.'}`;
  task.priority = taskPriorityValue(nextPriority) > taskPriorityValue(task.priority) ? nextPriority : task.priority || nextPriority;
  task.assigned_to = actorUserId(actor) ? toObjectId(actorUserId(actor), 'assigned_to') : task.assigned_to;
  task.assigned_department_id = toObjectId(context.department_id, 'department_id');
  task.assigned_by = task.assigned_by || (actorUserId(actor) ? toObjectId(actorUserId(actor), 'assigned_by') : undefined);
  task.sla_minutes = slaMinutes;
  task.due_at = !task.due_at || task.due_at > dueAt ? dueAt : task.due_at;
  task.metadata = {
    ...(task.metadata || {}),
    vital_alert: {
      vital_sign_id: normalizeId(vital),
      severity: vital.overall_severity || vital.severity,
      reading: formatVitalReadingForAction(vital),
      requested_at: nowValue,
      requested_by: actorUserId(actor),
      emergency,
    },
  };
  if (emergency) {
    task.escalation_level = Math.max(Number(task.escalation_level || 0), 1);
    task.escalation_reason = normalizeString(payload.reason) || 'Báo khẩn sinh hiệu bất thường.';
    task.escalated_at = task.escalated_at || nowValue;
    task.escalated_by = actorUserId(actor) ? toObjectId(actorUserId(actor), 'escalated_by') : task.escalated_by;
  }
  task.updated_by = actorUserId(actor);
  await task.save();

  vital.related_task_id = task._id;
  vital.requires_recheck = true;
  vital.suggested_recheck_minutes = slaMinutes;
  vital.updated_by = actorUserId(actor);
  await vital.save();

  await recordAuditLog({
    actor,
    action: emergency ? 'nursing.vital_alert.emergency_task' : 'nursing.vital_alert.request_recheck',
    targetType: 'nursing_task',
    targetId: task._id,
    status: 'success',
    message: emergency ? 'Tạo/cập nhật việc đáp ứng khẩn từ sinh hiệu.' : 'Tạo/cập nhật việc đo lại sinh hiệu.',
    requestMeta,
    metadata: { vital_sign_id: normalizeId(vital), sla_minutes: slaMinutes, emergency },
  });

  return taskDto(task, 'nursing_task', nowValue);
}

async function acknowledgeVitalAlert(vitalSignId, actor = {}, requestMeta = {}) {
  const vital = await loadVitalForAction(vitalSignId);

  const flags = buildAbnormalFlags(vital);
  vital.abnormal_flags = flags;
  vital.overall_severity = getOverallSeverity(flags);
  vital.requires_doctor_notification = ['high', 'critical'].includes(vital.overall_severity);
  vital.acknowledged_by = actorUserId(actor);
  vital.acknowledged_at = new Date();
  vital.updated_by = actorUserId(actor);
  await vital.save();

  await recordAuditLog({
    actor,
    action: 'nursing.vital_alert.acknowledge',
    targetType: 'vital_sign',
    targetId: vital._id,
    status: 'success',
    message: 'Điều dưỡng đã xác nhận cảnh báo sinh hiệu.',
    requestMeta,
  });

  return {
    vital_sign_id: String(vital._id),
    acknowledged_at: vital.acknowledged_at,
    overall_severity: vital.overall_severity,
  };
}

async function notifyDoctorOfVital(vitalSignId, actor = {}, requestMeta = {}) {
  const vital = await loadVitalForAction(vitalSignId);

  const flags = buildAbnormalFlags(vital);
  vital.abnormal_flags = flags;
  vital.overall_severity = getOverallSeverity(flags);
  vital.requires_doctor_notification = ['high', 'critical'].includes(vital.overall_severity);
  vital.doctor_notified_by = actorUserId(actor);
  vital.doctor_notified_at = new Date();
  vital.updated_by = actorUserId(actor);
  await vital.save();
  const notification = await notifyAssignedDoctorForVital(vital, {}, actor, requestMeta);

  await recordAuditLog({
    actor,
    action: 'nursing.vital_alert.notify_doctor',
    targetType: 'vital_sign',
    targetId: vital._id,
    status: 'success',
    message: 'Điều dưỡng đã báo bác sĩ về sinh hiệu bất thường.',
    requestMeta,
  });

  return {
    vital_sign_id: String(vital._id),
    doctor_notified_at: vital.doctor_notified_at,
    overall_severity: vital.overall_severity,
    notification_id: normalizeId(notification),
  };
}

async function requestVitalRecheck(vitalSignId, payload = {}, actor = {}, requestMeta = {}) {
  const vital = await loadVitalForAction(vitalSignId);
  const flags = buildAbnormalFlags(vital);
  vital.abnormal_flags = flags;
  vital.overall_severity = getOverallSeverity(flags);
  vital.requires_doctor_notification = ['high', 'critical'].includes(vital.overall_severity);
  const task = await upsertVitalRecheckTask(vital, payload, actor, requestMeta);
  return {
    vital_sign_id: String(vital._id),
    related_task_id: task.task_id || task._id || normalizeId(task),
    requires_recheck: true,
    suggested_recheck_minutes: vital.suggested_recheck_minutes,
    task,
  };
}

async function createVitalNursingNote(vitalSignId, payload = {}, actor = {}, requestMeta = {}) {
  const vital = await loadVitalForAction(vitalSignId);
  const context = vitalActionContext(vital, actor);
  if (!context.encounter_id) throw createError('Sinh hiệu chưa gắn lượt khám để tạo ghi chú điều dưỡng.', 409);
  const userId = actorUserId(actor);
  if (!userId) throw createError('Không xác định được nhân viên tạo ghi chú.', 403);
  const status = payload.status === CLINICAL_NOTE_STATUS.DRAFT ? CLINICAL_NOTE_STATUS.DRAFT : CLINICAL_NOTE_STATUS.SIGNED;
  const content = normalizeString(payload.content)
    || `Sinh hiệu bất thường: ${formatVitalReadingForAction(vital)}. Điều dưỡng đã ghi nhận và theo dõi theo quy trình.`;
  const note = await ClinicalNote.create(definedObject({
    encounter_id: toObjectId(context.encounter_id, 'encounter_id'),
    author_id: toObjectId(userId, 'user_id'),
    note_type: normalizeString(payload.note_type) || 'nursing_abnormal_vital',
    title: normalizeString(payload.title) || 'Theo dõi sinh hiệu bất thường',
    content,
    linked_vital_sign_ids: [vital._id],
    linked_task_id: vital.related_task_id,
    priority: payload.priority || (['critical', 'high'].includes(vital.overall_severity || vital.severity) ? 'urgent' : 'important'),
    visibility: payload.visibility || 'care_team',
    tags: Array.isArray(payload.tags) && payload.tags.length ? payload.tags : ['nursing', 'vital_sign', 'abnormal_vital'],
    notified_doctor_id: context.doctor_id ? toObjectId(context.doctor_id, 'doctor_id') : undefined,
    doctor_notified_at: context.doctor_id && vital.doctor_notified_at ? vital.doctor_notified_at : undefined,
    status,
    signed_by: status === CLINICAL_NOTE_STATUS.SIGNED ? toObjectId(userId, 'user_id') : undefined,
    signed_at: status === CLINICAL_NOTE_STATUS.SIGNED ? new Date() : undefined,
    created_by: userId,
    updated_by: userId,
  }));

  await recordAuditLog({
    actor,
    action: 'nursing.vital_alert.create_note',
    targetType: 'clinical_note',
    targetId: note._id,
    status: 'success',
    message: 'Tạo ghi chú điều dưỡng từ sinh hiệu bất thường.',
    requestMeta,
    metadata: { vital_sign_id: normalizeId(vital), encounter_id: context.encounter_id },
  });

  return {
    vital_sign_id: String(vital._id),
    clinical_note_id: String(note._id),
    note,
  };
}

async function escalateVitalAlert(vitalSignId, payload = {}, actor = {}, requestMeta = {}) {
  const vital = await loadVitalForAction(vitalSignId);
  const flags = buildAbnormalFlags(vital);
  const nowValue = new Date();
  vital.abnormal_flags = flags;
  vital.overall_severity = getOverallSeverity(flags);
  vital.requires_doctor_notification = true;
  vital.acknowledged_by = vital.acknowledged_by || actorUserId(actor);
  vital.acknowledged_at = vital.acknowledged_at || nowValue;
  vital.doctor_notified_by = actorUserId(actor);
  vital.doctor_notified_at = nowValue;
  vital.escalated_by = actorUserId(actor);
  vital.escalated_at = nowValue;
  vital.escalation_reason = normalizeString(payload.reason) || 'Báo khẩn sinh hiệu bất thường.';
  vital.updated_by = actorUserId(actor);
  await vital.save();

  const [notification, task] = await Promise.all([
    notifyAssignedDoctorForVital(vital, { ...payload, emergency: true }, actor, requestMeta),
    upsertVitalRecheckTask(vital, payload, actor, requestMeta, { emergency: true }),
  ]);

  await recordAuditLog({
    actor,
    action: 'nursing.vital_alert.escalate',
    targetType: 'vital_sign',
    targetId: vital._id,
    status: 'success',
    message: 'Điều dưỡng báo khẩn sinh hiệu bất thường.',
    requestMeta,
    metadata: { notification_id: normalizeId(notification), task_id: task.task_id || task._id || normalizeId(task) },
  });

  return {
    vital_sign_id: String(vital._id),
    acknowledged_at: vital.acknowledged_at,
    doctor_notified_at: vital.doctor_notified_at,
    escalated_at: vital.escalated_at,
    escalation_reason: vital.escalation_reason,
    related_task_id: task.task_id || task._id || normalizeId(task),
    notification_id: normalizeId(notification),
    task,
  };
}

function buildTaskFilter(query = {}, actor = {}, mode = 'today') {
  const filters = normalizeFilters(query, actor);
  const filter = {};
  addDepartmentFilter(filter, filters);
  if (mode === 'my') filter.assigned_to = toObjectId(actorUserId(actor), 'user_id');
  if (mode === 'overdue') {
    filter.status = { $in: OPEN_TASK_STATUSES };
    filter.due_at = { $lte: filters.now };
  } else {
    filter.$or = [
      { due_at: { $gte: filters.day_start, $lte: filters.day_end } },
      { status: { $in: OPEN_TASK_STATUSES }, due_at: { $lte: filters.now } },
    ];
  }
  if (query.status) filter.status = query.status;
  if (query.task_type) filter.task_type = query.task_type;
  return { filter, filters };
}

async function listTasks(query = {}, actor = {}, mode = 'today') {
  const { filter, filters } = buildTaskFilter(query, actor, mode);
  const { page, limit, skip } = getPagination(query, 20, 100);
  const [items, total] = await Promise.all([
    NursingTask.find(filter)
      .sort({ due_at: 1, priority: -1, created_at: 1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('assigned_to', 'full_name employee_code')
      .lean(),
    NursingTask.countDocuments(filter),
  ]);

  return {
    items: items.map((task) => taskDto(task, 'nursing_task', filters.now)),
    pagination: buildPagination(page, limit, total),
  };
}

async function createTask(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.patient_id) throw createError('patient_id là bắt buộc.', 400);
  if (!payload.department_id && !actorDepartmentId(actor)) throw createError('department_id là bắt buộc.', 400);
  if (!payload.title) throw createError('title là bắt buộc.', 400);

  const task = await NursingTask.create({
    patient_id: toObjectId(payload.patient_id, 'patient_id'),
    encounter_id: payload.encounter_id ? toObjectId(payload.encounter_id, 'encounter_id') : undefined,
    admission_id: payload.admission_id ? toObjectId(payload.admission_id, 'admission_id') : undefined,
    queue_ticket_id: payload.queue_ticket_id ? toObjectId(payload.queue_ticket_id, 'queue_ticket_id') : undefined,
    department_id: toObjectId(payload.department_id || actorDepartmentId(actor), 'department_id'),
    title: payload.title,
    description: payload.description,
    task_type: payload.task_type || 'other',
    priority: payload.priority || 'medium',
    status: payload.status || 'todo',
    assigned_to: payload.assigned_to ? toObjectId(payload.assigned_to, 'assigned_to') : undefined,
    assigned_role: payload.assigned_role,
    due_at: payload.due_at ? parseDate(payload.due_at, 'due_at') : undefined,
    source_type: payload.source_type,
    source_id: payload.source_id ? toObjectId(payload.source_id, 'source_id') : undefined,
    metadata: payload.metadata,
    created_by: actorUserId(actor),
  });

  await recordAuditLog({
    actor,
    action: 'nursing.task.create',
    targetType: 'nursing_task',
    targetId: task._id,
    status: 'success',
    message: 'Tạo task điều dưỡng.',
    requestMeta,
  });

  return taskDto(task, 'nursing_task', new Date());
}

async function updateTaskStatus(taskId, nextStatus, payload = {}, actor = {}, requestMeta = {}) {
  const task = await NursingTask.findById(taskId);
  if (!task) throw createError('Không tìm thấy task điều dưỡng.', 404);

  task.status = nextStatus;
  task.updated_by = actorUserId(actor);
  if (nextStatus === 'in_progress') {
    task.started_at = task.started_at || new Date();
    task.started_by = actorUserId(actor);
  }
  if (nextStatus === 'done') {
    task.completed_at = new Date();
    task.completed_by = actorUserId(actor);
  }
  if (nextStatus === 'cancelled') {
    task.cancelled_at = new Date();
    task.cancelled_by = actorUserId(actor);
    task.cancel_reason = payload.reason || payload.cancel_reason;
  }
  if (payload.escalation_reason) {
    task.escalated_at = new Date();
    task.escalated_by = actorUserId(actor);
    task.escalation_reason = payload.escalation_reason;
    task.priority = task.priority === 'critical' ? task.priority : 'high';
  }
  await task.save();

  await recordAuditLog({
    actor,
    action: `nursing.task.${nextStatus}`,
    targetType: 'nursing_task',
    targetId: task._id,
    status: 'success',
    message: 'Cập nhật trạng thái task điều dưỡng.',
    requestMeta,
    metadata: { status: nextStatus },
  });

  return taskDto(task, 'nursing_task', new Date());
}

async function escalateTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const task = await NursingTask.findById(taskId);
  if (!task) throw createError('Không tìm thấy task điều dưỡng.', 404);
  task.escalated_at = new Date();
  task.escalated_by = actorUserId(actor);
  task.escalation_reason = payload.reason || payload.escalation_reason;
  task.priority = task.priority === 'critical' ? task.priority : 'high';
  task.updated_by = actorUserId(actor);
  await task.save();
  await recordAuditLog({
    actor,
    action: 'nursing.task.escalate',
    targetType: 'nursing_task',
    targetId: task._id,
    status: 'success',
    message: 'Escalate task điều dưỡng.',
    requestMeta,
  });
  return taskDto(task, 'nursing_task', new Date());
}

function defaultChecklistItems(orderType) {
  const common = [
    { key: 'identify_patient', label: 'Xác nhận đúng bệnh nhân', required: true },
  ];
  const byType = {
    lab: [
      { key: 'fasting_check', label: 'Kiểm tra nhịn ăn nếu cần', required: false },
      { key: 'tube_ready', label: 'Chuẩn bị ống lấy mẫu', required: true },
      { key: 'label_sample', label: 'Dán nhãn mẫu', required: true },
      { key: 'send_sample', label: 'Gửi mẫu', required: true },
    ],
    imaging: [
      { key: 'indication_confirmed', label: 'Xác nhận chỉ định', required: true },
      { key: 'contrast_allergy_check', label: 'Kiểm tra dị ứng thuốc cản quang', required: false },
      { key: 'contraindication_check', label: 'Kiểm tra chống chỉ định', required: true },
      { key: 'transfer_ready', label: 'Chuẩn bị chuyển bệnh nhân', required: true },
    ],
    procedure: [
      { key: 'consent_check', label: 'Kiểm tra cam kết/đồng ý thủ thuật', required: true },
      { key: 'pre_procedure_vitals', label: 'Kiểm tra sinh hiệu trước thủ thuật', required: true },
      { key: 'equipment_ready', label: 'Chuẩn bị dụng cụ', required: true },
      { key: 'handoff_ready', label: 'Bàn giao sang phòng thủ thuật', required: true },
    ],
  };
  return [...common, ...(byType[orderType] || [
    { key: 'preparation_done', label: 'Hoàn tất chuẩn bị dịch vụ', required: true },
  ])];
}

async function getPendingTriage(query = {}, actor = {}) {
  const dashboard = await assembleDashboard(query, actor);
  return {
    items: dashboard.triage.pending_items,
    summary: {
      pending: dashboard.triage.pending,
      in_progress: dashboard.triage.in_progress,
      completed: dashboard.triage.completed,
      high_priority: dashboard.triage.high_priority,
    },
  };
}

async function createTriageAssessment(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.patient_id) throw createError('patient_id là bắt buộc.', 400);
  if (!payload.department_id && !actorDepartmentId(actor)) throw createError('department_id là bắt buộc.', 400);

  const status = payload.status || 'draft';
  const triage = await TriageAssessment.create({
    patient_id: toObjectId(payload.patient_id, 'patient_id'),
    appointment_id: payload.appointment_id ? toObjectId(payload.appointment_id, 'appointment_id') : undefined,
    encounter_id: payload.encounter_id ? toObjectId(payload.encounter_id, 'encounter_id') : undefined,
    queue_ticket_id: payload.queue_ticket_id ? toObjectId(payload.queue_ticket_id, 'queue_ticket_id') : undefined,
    department_id: toObjectId(payload.department_id || actorDepartmentId(actor), 'department_id'),
    doctor_id: payload.doctor_id ? toObjectId(payload.doctor_id, 'doctor_id') : undefined,
    nurse_id: actorUserId(actor),
    triage_by: actorUserId(actor),
    triage_at: status === 'completed' ? new Date() : payload.triage_at ? parseDate(payload.triage_at, 'triage_at') : undefined,
    chief_complaint: payload.chief_complaint,
    symptom_onset_at: payload.symptom_onset_at ? parseDate(payload.symptom_onset_at, 'symptom_onset_at') : undefined,
    symptoms: payload.symptoms,
    pain_score: payload.pain_score,
    consciousness: payload.consciousness,
    consciousness_level: payload.consciousness_level,
    breathing_status: payload.breathing_status,
    circulation_status: payload.circulation_status,
    mobility_status: payload.mobility_status,
    acuity_level: payload.acuity_level || 'green',
    priority_score: payload.priority_score,
    red_flags: payload.red_flags,
    triage_level: payload.triage_level || 'non_urgent',
    priority: payload.priority || 'medium',
    recommended_destination: payload.recommended_destination || 'doctor',
    recommended_action: payload.recommended_action || 'normal_queue',
    recommended_department_id: payload.recommended_department_id ? toObjectId(payload.recommended_department_id, 'recommended_department_id') : undefined,
    recommended_doctor_id: payload.recommended_doctor_id ? toObjectId(payload.recommended_doctor_id, 'recommended_doctor_id') : undefined,
    infectious_screening: payload.infectious_screening,
    fall_risk_score: payload.fall_risk_score,
    pregnancy_status: payload.pregnancy_status,
    allergy_reviewed: payload.allergy_reviewed,
    medication_reviewed: payload.medication_reviewed,
    problem_reviewed: payload.problem_reviewed,
    vital_sign_id: payload.vital_sign_id ? toObjectId(payload.vital_sign_id, 'vital_sign_id') : undefined,
    vital_snapshot: payload.vital_snapshot,
    status,
    started_at: status === 'in_progress' ? new Date() : undefined,
    completed_at: status === 'completed' ? new Date() : undefined,
    completed_by: status === 'completed' ? actorUserId(actor) : undefined,
    note: payload.note,
    created_by: actorUserId(actor),
  });

  if (payload.queue_ticket_id) {
    const stage = status === 'completed'
      ? NURSING_WORKFLOW_STATUS.TRIAGE_DONE
      : status === 'in_progress'
        ? NURSING_WORKFLOW_STATUS.TRIAGE_IN_PROGRESS
        : NURSING_WORKFLOW_STATUS.TRIAGE_PENDING;
    await QueueTicket.updateOne(
      { _id: triage.queue_ticket_id },
      {
        $set: {
          triage_assessment_id: triage._id,
          nursing_stage: stage,
          triage_started_at: status === 'in_progress' ? new Date() : undefined,
          triage_completed_at: status === 'completed' ? new Date() : undefined,
          nursing_stage_updated_at: new Date(),
          nursing_stage_updated_by: actorUserId(actor),
          updated_by: actorUserId(actor),
        },
      },
    );
  }

  if (status === 'completed' && payload.queue_ticket_id) {
    await markQueueStage(payload.queue_ticket_id, NURSING_WORKFLOW_STATUS.TRIAGE_DONE, actor, requestMeta);
  }

  await recordAuditLog({
    actor,
    action: 'nursing.triage.create',
    targetType: 'triage_assessment',
    targetId: triage._id,
    status: 'success',
    message: 'Tạo phiếu triage điều dưỡng.',
    requestMeta,
  });

  return triage;
}

async function completeTriageAssessment(triageId, payload = {}, actor = {}, requestMeta = {}) {
  const triage = await TriageAssessment.findById(triageId);
  if (!triage) throw createError('Không tìm thấy phiếu triage.', 404);

  Object.entries({
    chief_complaint: payload.chief_complaint,
    symptoms: payload.symptoms,
    pain_score: payload.pain_score,
    consciousness: payload.consciousness,
    consciousness_level: payload.consciousness_level,
    breathing_status: payload.breathing_status,
    circulation_status: payload.circulation_status,
    mobility_status: payload.mobility_status,
    acuity_level: payload.acuity_level,
    priority_score: payload.priority_score,
    red_flags: payload.red_flags,
    triage_level: payload.triage_level,
    priority: payload.priority,
    recommended_destination: payload.recommended_destination,
    recommended_action: payload.recommended_action,
    infectious_screening: payload.infectious_screening,
    fall_risk_score: payload.fall_risk_score,
    pregnancy_status: payload.pregnancy_status,
    allergy_reviewed: payload.allergy_reviewed,
    medication_reviewed: payload.medication_reviewed,
    problem_reviewed: payload.problem_reviewed,
    vital_snapshot: payload.vital_snapshot,
    note: payload.note,
  }).forEach(([key, value]) => {
    if (value !== undefined) triage[key] = value;
  });
  if (payload.vital_sign_id) triage.vital_sign_id = toObjectId(payload.vital_sign_id, 'vital_sign_id');
  if (payload.recommended_department_id) triage.recommended_department_id = toObjectId(payload.recommended_department_id, 'recommended_department_id');
  if (payload.recommended_doctor_id) triage.recommended_doctor_id = toObjectId(payload.recommended_doctor_id, 'recommended_doctor_id');

  triage.status = 'completed';
  triage.triage_by = actorUserId(actor);
  triage.triage_at = new Date();
  triage.completed_at = new Date();
  triage.completed_by = actorUserId(actor);
  triage.updated_by = actorUserId(actor);
  await triage.save();

  if (triage.queue_ticket_id) {
    await markQueueStage(triage.queue_ticket_id, NURSING_WORKFLOW_STATUS.TRIAGE_DONE, actor, requestMeta);
  }

  await recordAuditLog({
    actor,
    action: 'nursing.triage.complete',
    targetType: 'triage_assessment',
    targetId: triage._id,
    status: 'success',
    message: 'Hoàn tất phiếu triage điều dưỡng.',
    requestMeta,
  });

  return triage;
}

async function getTriageWorklist(query = {}, actor = {}) {
  return getPendingTriage({ ...query, limit: query.limit || 160 }, actor);
}

async function getLatestTriageByQueue(ticketId, actor = {}) {
  const ticket = await QueueTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  const triage = await TriageAssessment.findOne({ queue_ticket_id: ticket._id, status: { $ne: 'entered_in_error' } })
    .sort({ created_at: -1 })
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('triage_by', 'full_name employee_code')
    .lean();
  return { queue_ticket_id: String(ticket._id), triage };
}

async function updateTriageAssessment(triageId, payload = {}, actor = {}, requestMeta = {}) {
  const triage = await TriageAssessment.findById(triageId);
  if (!triage) throw createError('Không tìm thấy phiếu triage.', 404);
  if (['completed', 'cancelled', 'entered_in_error'].includes(triage.status)) {
    throw createError('Phiếu triage đã khóa, không thể cập nhật trực tiếp.', 409);
  }

  [
    'chief_complaint',
    'symptoms',
    'pain_score',
    'consciousness',
    'consciousness_level',
    'breathing_status',
    'circulation_status',
    'mobility_status',
    'acuity_level',
    'priority_score',
    'red_flags',
    'triage_level',
    'priority',
    'recommended_destination',
    'recommended_action',
    'infectious_screening',
    'fall_risk_score',
    'pregnancy_status',
    'allergy_reviewed',
    'medication_reviewed',
    'problem_reviewed',
    'vital_snapshot',
    'note',
  ].forEach((key) => {
    if (payload[key] !== undefined) triage[key] = payload[key];
  });
  if (payload.symptom_onset_at) triage.symptom_onset_at = parseDate(payload.symptom_onset_at, 'symptom_onset_at');
  if (payload.vital_sign_id) triage.vital_sign_id = toObjectId(payload.vital_sign_id, 'vital_sign_id');
  if (payload.recommended_department_id) triage.recommended_department_id = toObjectId(payload.recommended_department_id, 'recommended_department_id');
  if (payload.recommended_doctor_id) triage.recommended_doctor_id = toObjectId(payload.recommended_doctor_id, 'recommended_doctor_id');
  triage.updated_by = actorUserId(actor);
  await triage.save();

  await recordAuditLog({
    actor,
    action: 'nursing.triage.update',
    targetType: 'triage_assessment',
    targetId: triage._id,
    status: 'success',
    message: 'Cập nhật phiếu triage điều dưỡng.',
    requestMeta,
  });

  return triage;
}

async function startTriageAssessment(triageId, actor = {}, requestMeta = {}) {
  const triage = await TriageAssessment.findById(triageId);
  if (!triage) throw createError('Không tìm thấy phiếu triage.', 404);
  if (!['draft', 'in_progress'].includes(triage.status)) throw createError('Phiếu triage không thể bắt đầu.', 409);
  triage.status = 'in_progress';
  triage.started_at = triage.started_at || new Date();
  triage.triage_by = actorUserId(actor);
  triage.nurse_id = actorUserId(actor);
  triage.updated_by = actorUserId(actor);
  await triage.save();
  if (triage.queue_ticket_id) {
    await markQueueStage(triage.queue_ticket_id, NURSING_WORKFLOW_STATUS.TRIAGE_IN_PROGRESS, actor, requestMeta);
  }
  await recordAuditLog({
    actor,
    action: 'nursing.triage.start',
    targetType: 'triage_assessment',
    targetId: triage._id,
    status: 'success',
    message: 'Bắt đầu phiếu triage điều dưỡng.',
    requestMeta,
  });
  return triage;
}

async function cancelTriageAssessment(triageId, payload = {}, actor = {}, requestMeta = {}) {
  const triage = await TriageAssessment.findById(triageId);
  if (!triage) throw createError('Không tìm thấy phiếu triage.', 404);
  if (triage.status === 'completed') throw createError('Phiếu triage đã hoàn tất, không thể hủy.', 409);
  triage.status = 'cancelled';
  triage.cancelled_at = new Date();
  triage.cancelled_by = actorUserId(actor);
  triage.cancel_reason = payload.reason || payload.cancel_reason;
  triage.updated_by = actorUserId(actor);
  await triage.save();
  await recordAuditLog({
    actor,
    action: 'nursing.triage.cancel',
    targetType: 'triage_assessment',
    targetId: triage._id,
    status: 'success',
    message: 'Hủy phiếu triage điều dưỡng.',
    requestMeta,
  });
  return triage;
}

async function markTriageEnteredInError(triageId, payload = {}, actor = {}, requestMeta = {}) {
  const triage = await TriageAssessment.findById(triageId);
  if (!triage) throw createError('Không tìm thấy phiếu triage.', 404);
  triage.status = 'entered_in_error';
  triage.entered_in_error_by = actorUserId(actor);
  triage.entered_in_error_at = new Date();
  triage.entered_in_error_reason = payload.reason || payload.entered_in_error_reason;
  triage.updated_by = actorUserId(actor);
  await triage.save();
  await recordAuditLog({
    actor,
    action: 'nursing.triage.entered_in_error',
    targetType: 'triage_assessment',
    targetId: triage._id,
    status: 'success',
    message: 'Đánh dấu phiếu triage nhập sai.',
    requestMeta,
  });
  return triage;
}

async function getReadyForDoctor(query = {}, actor = {}) {
  const dashboard = await getIntakeDashboard({ ...query, queue_limit: query.queue_limit || 300 }, actor);
  const items = (dashboard.intake.ready_items || []).filter((item) => !query.doctor_id || sameId(item.doctor_id, query.doctor_id));
  return {
    meta: dashboard.meta,
    summary: {
      total: items.length,
      priority: items.filter((item) => ['priority', 'vip'].includes(item.queue_type)).length,
      called: items.filter((item) => [QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED].includes(item.status)).length,
      in_service: items.filter((item) => item.status === QUEUE_STATUS.IN_SERVICE).length,
      waiting_after_ready: items.filter((item) => item.ready_for_doctor_at && minutesSince(item.ready_for_doctor_at, new Date()) >= 15).length,
    },
    items,
  };
}

async function unmarkReadyForDoctor(ticketId, actor = {}, requestMeta = {}) {
  const ticket = await getQueueTicketOrThrow(ticketId);
  ticket.nursing_stage = NURSING_WORKFLOW_STATUS.TRIAGE_PENDING;
  ticket.ready_for_doctor_at = undefined;
  ticket.ready_for_doctor_by = undefined;
  ticket.nursing_stage_updated_at = new Date();
  ticket.nursing_stage_updated_by = actorUserId(actor);
  ticket.updated_by = actorUserId(actor);
  await ticket.save();
  await recordAuditLog({
    actor,
    action: 'nursing.ready_for_doctor.revoke',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Thu hồi trạng thái sẵn sàng gặp bác sĩ.',
    requestMeta,
  });
  return { queue_ticket_id: String(ticket._id), nursing_stage: ticket.nursing_stage };
}

async function notifyDoctorQueue(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await getQueueTicketOrThrow(ticketId);
  const task = await NursingTask.findOneAndUpdate(
    { source_type: 'queue_ticket', source_id: ticket._id, task_type: 'triage' },
    {
      $setOnInsert: {
        patient_id: ticket.patient_id?._id || ticket.patient_id,
        encounter_id: ticket.encounter_id,
        queue_ticket_id: ticket._id,
        department_id: ticket.department_id?._id || ticket.department_id,
        title: 'Báo bác sĩ bệnh nhân đã sẵn sàng',
        description: payload.message || 'Bệnh nhân đã hoàn tất tiếp nhận/triage và sẵn sàng vào phòng khám.',
        task_type: 'triage',
        priority: ticket.queue_type === 'normal' ? 'medium' : 'high',
        status: 'todo',
        source_type: 'queue_ticket',
        source_id: ticket._id,
        created_by: actorUserId(actor),
      },
      $set: {
        assigned_to: ticket.doctor_id?._id || ticket.doctor_id,
        updated_by: actorUserId(actor),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await recordAuditLog({
    actor,
    action: 'nursing.ready_for_doctor.notify_doctor',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Báo bác sĩ bệnh nhân đã sẵn sàng.',
    requestMeta,
  });
  return taskDto(task, 'nursing_task', new Date());
}

async function getPendingPreparations(query = {}, actor = {}) {
  const dashboard = await assembleDashboard(query, actor);
  return {
    items: dashboard.service_preparation.items,
    summary: {
      pending: dashboard.service_preparation.pending,
      lab: dashboard.service_preparation.lab,
      imaging: dashboard.service_preparation.imaging,
      procedure: dashboard.service_preparation.procedure,
      checklist_pending: dashboard.service_preparation.checklist_pending,
    },
  };
}

async function createPreparationFromOrder(orderId, payload = {}, actor = {}, requestMeta = {}) {
  const order = await Order.findById(orderId).lean();
  if (!order) throw createError('Không tìm thấy order.', 404);
  if (!CHECKLIST_ORDER_TYPES.includes(order.order_type)) throw createError('Order này không cần checklist chuẩn bị.', 409);

  const checklist = await ServicePreparationChecklist.findOneAndUpdate(
    { order_id: order._id },
    {
      $setOnInsert: {
        patient_id: order.patient_id,
        encounter_id: order.encounter_id,
        order_id: order._id,
        order_type: order.order_type,
        department_id: order.department_id || payload.department_id || actorDepartmentId(actor),
        status: 'pending',
        assigned_to: payload.assigned_to ? toObjectId(payload.assigned_to, 'assigned_to') : undefined,
        checklist_items: payload.checklist_items || defaultChecklistItems(order.order_type),
        created_by: actorUserId(actor),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await recordAuditLog({
    actor,
    action: 'nursing.preparation.create_from_order',
    targetType: 'service_preparation_checklist',
    targetId: checklist._id,
    status: 'success',
    message: 'Tạo checklist chuẩn bị dịch vụ từ order.',
    requestMeta,
  });

  return checklist;
}

async function updatePreparationItem(checklistId, itemKey, payload = {}, actor = {}, requestMeta = {}) {
  const checklist = await ServicePreparationChecklist.findById(checklistId);
  if (!checklist) throw createError('Không tìm thấy checklist chuẩn bị.', 404);
  const item = checklist.checklist_items.find((entry) => entry.key === itemKey);
  if (!item) throw createError('Không tìm thấy mục checklist.', 404);

  item.checked = Boolean(payload.checked);
  item.checked_by = actorUserId(actor);
  item.checked_at = item.checked ? new Date() : undefined;
  item.note = payload.note ?? item.note;
  checklist.status = checklist.checklist_items.some((entry) => entry.checked) ? 'in_progress' : 'pending';
  checklist.updated_by = actorUserId(actor);
  await checklist.save();

  await recordAuditLog({
    actor,
    action: 'nursing.preparation.item_update',
    targetType: 'service_preparation_checklist',
    targetId: checklist._id,
    status: 'success',
    message: 'Cập nhật mục checklist chuẩn bị dịch vụ.',
    requestMeta,
    metadata: { item_key: itemKey, checked: item.checked },
  });

  return checklist;
}

async function completePreparation(checklistId, actor = {}, requestMeta = {}) {
  const checklist = await ServicePreparationChecklist.findById(checklistId);
  if (!checklist) throw createError('Không tìm thấy checklist chuẩn bị.', 404);

  const missingRequired = checklist.checklist_items.filter((item) => item.required && !item.checked);
  if (missingRequired.length) throw createError('Checklist còn mục bắt buộc chưa hoàn tất.', 409);

  checklist.status = 'completed';
  checklist.completed_by = actorUserId(actor);
  checklist.completed_at = new Date();
  checklist.updated_by = actorUserId(actor);
  await checklist.save();

  await recordAuditLog({
    actor,
    action: 'nursing.preparation.complete',
    targetType: 'service_preparation_checklist',
    targetId: checklist._id,
    status: 'success',
    message: 'Hoàn tất checklist chuẩn bị dịch vụ.',
    requestMeta,
  });

  return checklist;
}

module.exports = {
  getOverview,
  getKpis,
  getWorklist,
  getPriorityAlerts,
  getTopbarBootstrap,
  getShiftSummary,
  search,
  getPendingPatients,
  getPendingPatientsSummary,
  getPendingPatientsPriorityLane,
  getIntakeDashboard,
  getIntakeWorklist,
  getQueueContext,
  claimQueueIntake,
  releaseQueueIntake,
  startQueueIntake,
  completeQueueIntake,
  addQueueIntakeNote,
  assignWorkItemToMe,
  completeWorkItem,
  getPendingVitals,
  getAbnormalVitals,
  getVitalHistory,
  getNursingVitalNotes,
  getTasksBoard,
  getTaskDetail,
  assignTaskToMe,
  reopenTask,
  getPriorityAlertCenter,
  getPriorityAlertSummary,
  getPriorityAlertDetail,
  updatePriorityAlertAction,
  getNursingQueueBoard,
  getNursingQueueMetrics,
  getPendingTriage,
  getTriageWorklist,
  getLatestTriageByQueue,
  createTriageAssessment,
  updateTriageAssessment,
  startTriageAssessment,
  completeTriageAssessment,
  cancelTriageAssessment,
  markTriageEnteredInError,
  getReadyForDoctor,
  unmarkReadyForDoctor,
  notifyDoctorQueue,
  getPendingPreparations,
  createPreparationFromOrder,
  updatePreparationItem,
  completePreparation,
  markQueueStage,
  markEncounterReadyForDoctor,
  acknowledgeVitalAlert,
  notifyDoctorOfVital,
  requestVitalRecheck,
  createVitalNursingNote,
  escalateVitalAlert,
  listTasks,
  createTask,
  startTask: (taskId, actor, requestMeta) => updateTaskStatus(taskId, 'in_progress', {}, actor, requestMeta),
  completeTask: (taskId, payload, actor, requestMeta) => updateTaskStatus(taskId, 'done', payload, actor, requestMeta),
  cancelTask: (taskId, payload, actor, requestMeta) => updateTaskStatus(taskId, 'cancelled', payload, actor, requestMeta),
  escalateTask,
};
