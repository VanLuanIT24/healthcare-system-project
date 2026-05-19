const { Types } = require('mongoose');
const {
  Allergy,
  ClinicalNote,
  Department,
  Encounter,
  MedicationAdministration,
  NursingHandoff,
  NursingTask,
  Patient,
  ProblemList,
  User,
  VitalSign,
  Notification,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  ADMINISTRATION_STATUS,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_RECIPIENT_TYPE,
  NOTIFICATION_STATUS,
} = require('../constants/statuses');
const {
  CODE_TYPE,
  generateBusinessCode,
} = require('./code-generator.service');
const {
  buildPagination,
  createError,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const permissionService = require('./permission.service');
const realtimeService = require('../realtime/realtime.service');

const OPEN_STATUSES = ['draft', 'assigned', 'accepted', 'todo', 'in_progress', 'blocked', 'waiting_doctor', 'overdue'];
const DONE_STATUSES = ['done'];
const CLOSED_STATUSES = ['done', 'cancelled'];
const PRIORITY_ORDER = { low: 1, normal: 2, medium: 2, high: 3, urgent: 4, stat: 5, critical: 5 };
const TASK_TYPE_GROUPS = {
  vital_sign: 'vitals',
  vital: 'vitals',
  medication_admin: 'medication',
  medication_monitoring: 'medication',
  post_medication_monitor: 'monitoring',
  pre_lab: 'lab',
  specimen_collection: 'lab',
  pre_imaging: 'imaging',
  pre_procedure: 'procedure',
  post_procedure_monitor: 'monitoring',
  doctor_report: 'doctor_report',
  patient_transport: 'transport',
  bedside_care: 'care',
  diet: 'care',
  cleaning: 'care',
  round: 'round',
  admission_checklist: 'admission',
  discharge_checklist: 'discharge',
  handoff_followup: 'handoff',
  handover: 'handoff',
  emergency_response: 'emergency',
  preparation: 'preparation',
  triage: 'triage',
};

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || null;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function actorRoles(actor = {}) {
  return Array.isArray(actor.roles) ? actor.roles : actor.user?.roles || [];
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes.filter(Boolean));
}

function hasGlobalScope(actor = {}) {
  return hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.NURSING_TASKS.MANAGE,
    PERMISSION.NURSING_TASKS.READ,
    PERMISSION.REPORTS.READ_ALL,
  ]) || actorRoles(actor).some((role) => ['super_admin', 'admin', 'manager'].includes(role));
}

function normalizeId(value) {
  if (!value) return null;
  const id = value._id || value.id || value;
  return typeof id.toString === 'function' ? id.toString() : String(id);
}

function sameId(left, right) {
  const leftId = normalizeId(left);
  const rightId = normalizeId(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return undefined;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(String(value))) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(String(value));
}

function parseDate(value, fieldName = 'date') {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function addDepartmentScope(filter, query = {}, actor = {}) {
  const departmentId = query.department_id || actorDepartmentId(actor);
  if (query.department_id) {
    filter.department_id = toObjectId(query.department_id, 'department_id');
    return;
  }
  if (!hasGlobalScope(actor) && departmentId) {
    filter.department_id = toObjectId(departmentId, 'department_id');
  }
}

function buildDateWindow(query = {}) {
  const date = parseDate(query.date || new Date(), 'date');
  return {
    date,
    dayStart: getStartOfDay(date),
    dayEnd: getEndOfDay(date),
  };
}

function normalizePriority(priority) {
  if (priority === 'critical') return 'stat';
  if (priority === 'medium') return 'normal';
  return priority || 'normal';
}

function minutesBetween(from, to = new Date()) {
  if (!from) return 0;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / 60000));
}

function isOpen(task = {}) {
  return OPEN_STATUSES.includes(task.status);
}

function isOverdue(task = {}, now = new Date()) {
  if (!task.due_at || CLOSED_STATUSES.includes(task.status)) return false;
  return new Date(task.due_at).getTime() < now.getTime();
}

function patientDto(patient = {}) {
  if (!patient) return null;
  return {
    patient_id: normalizeId(patient),
    patient_code: patient.patient_code || null,
    full_name: patient.full_name || patient.patient_name || 'Chưa rõ bệnh nhân',
    patient_name: patient.full_name || patient.patient_name || 'Chưa rõ bệnh nhân',
    gender: patient.gender || null,
    date_of_birth: patient.date_of_birth || null,
    phone: patient.phone || null,
  };
}

function userDto(user = {}) {
  if (!user) return null;
  return {
    user_id: normalizeId(user),
    full_name: user.full_name || user.display_name || user.username || 'Chưa rõ nhân sự',
    employee_code: user.employee_code || null,
  };
}

function vitalDto(vital = {}) {
  if (!vital) return null;
  return {
    vital_sign_id: normalizeId(vital),
    recorded_at: vital.recorded_at || vital.created_at,
    recorded_by: userDto(vital.recorded_by),
    systolic_bp: vital.systolic_bp ?? null,
    diastolic_bp: vital.diastolic_bp ?? null,
    heart_rate: vital.heart_rate ?? null,
    temperature: vital.temperature ?? null,
    spo2: vital.spo2 ?? null,
    respiratory_rate: vital.respiratory_rate ?? null,
    pain_score: vital.pain_score ?? null,
    severity: vital.overall_severity || vital.severity || 'normal',
    abnormal_flags: vital.abnormal_flags || [],
  };
}

function checklistSummary(task = {}) {
  const items = task.checklist_items || [];
  const done = items.filter((item) => item.status === 'done').length;
  const required = items.filter((item) => item.required).length;
  const requiredDone = items.filter((item) => item.required && item.status === 'done').length;
  return {
    total: items.length,
    done,
    required,
    required_done: requiredDone,
    completion_rate: items.length ? Math.round((done / items.length) * 100) : 0,
  };
}

function taskDto(task = {}, context = {}) {
  const now = context.now || new Date();
  const overdue = isOverdue(task, now);
  const patient = patientDto(task.patient_id);
  const assignedTo = userDto(task.assigned_to);
  const completedBy = userDto(task.completed_by);
  const latestVitals = context.vitalsByPatient?.get(patient?.patient_id) || task.latest_vitals_snapshot || null;
  const rawPriority = normalizePriority(task.priority);
  const displayStatus = overdue && isOpen(task) ? 'overdue' : task.status;
  const priority = overdue && PRIORITY_ORDER[rawPriority] < PRIORITY_ORDER.high ? 'high' : rawPriority;

  return {
    id: normalizeId(task),
    task_id: normalizeId(task),
    task_code: task.task_code,
    patient,
    patient_id: patient?.patient_id || normalizeId(task.patient_id),
    patient_code: patient?.patient_code || null,
    patient_name: patient?.patient_name || 'Chưa rõ bệnh nhân',
    encounter_id: normalizeId(task.encounter_id),
    admission_id: normalizeId(task.admission_id),
    queue_ticket_id: normalizeId(task.queue_ticket_id),
    emergency_case_id: normalizeId(task.emergency_case_id),
    department_id: normalizeId(task.department_id),
    department_name: task.department_id?.department_name || null,
    room_id: normalizeId(task.room_id),
    room_name: task.room_id?.room_name || task.room_id?.name || null,
    bed_id: normalizeId(task.bed_id),
    bed_label: task.bed_id?.bed_label || task.bed_id?.bed_number || task.bed_id?.name || null,
    source_module: task.source_module || task.source_type || 'manual',
    source_type: task.source_type || task.source_module || 'manual',
    source_id: normalizeId(task.source_id),
    task_type: task.task_type || 'other',
    type: task.task_type || 'other',
    task_group: TASK_TYPE_GROUPS[task.task_type] || 'other',
    title: task.title,
    description: task.description,
    reason: task.description || task.title,
    priority,
    raw_priority: task.priority,
    status: displayStatus,
    raw_status: task.status,
    assigned_to: assignedTo?.user_id || normalizeId(task.assigned_to),
    assigned_to_name: assignedTo?.full_name || null,
    assigned_to_user: assignedTo,
    assigned_role: task.assigned_role || null,
    assigned_by: normalizeId(task.assigned_by),
    due_at: task.due_at,
    sla_minutes: task.sla_minutes ?? null,
    accepted_at: task.accepted_at,
    started_at: task.started_at,
    overdue_at: task.overdue_at || (overdue ? task.due_at : null),
    overdue_minutes: overdue ? minutesBetween(task.due_at, now) : 0,
    completed_at: task.completed_at,
    completed_by: completedBy,
    completed_late_reason: task.completed_late_reason || null,
    checklist_items: task.checklist_items || [],
    checklist: checklistSummary(task),
    result_note: task.result_note || null,
    latest_note: task.result_note || task.metadata?.latest_note || null,
    clinical_note_id: normalizeId(task.clinical_note_id),
    conversation_id: normalizeId(task.conversation_id),
    handoff_id: normalizeId(task.handoff_id),
    escalation_level: task.escalation_level || 0,
    escalated_to: normalizeId(task.escalated_to),
    escalated_at: task.escalated_at,
    escalation_reason: task.escalation_reason || null,
    blocked_reason: task.blocked_reason || null,
    cancel_reason: task.cancel_reason || null,
    quality_review_status: task.quality_review_status || 'none',
    latest_vitals: latestVitals ? vitalDto(latestVitals) : null,
    flags: buildRiskFlags({ task, latestVitals }),
    actions: buildTaskActions(displayStatus),
    created_at: task.created_at,
    updated_at: task.updated_at,
    metadata: task.metadata || {},
  };
}

function buildRiskFlags({ task = {}, latestVitals = null }) {
  const flags = [];
  const priority = normalizePriority(task.priority);
  if (['urgent', 'stat', 'critical'].includes(priority)) flags.push(priority === 'stat' || priority === 'critical' ? 'stat' : 'urgent');
  if (isOverdue(task)) flags.push('overdue');
  if (task.task_type?.includes('medication')) flags.push('medication');
  if (task.task_type === 'doctor_report' || task.escalation_level > 0) flags.push('doctor_report_needed');
  const severity = latestVitals?.overall_severity || latestVitals?.severity;
  if (['high', 'critical'].includes(severity)) flags.push('critical_vitals');
  return [...new Set(flags)];
}

function buildTaskActions(status) {
  const base = ['add_note', 'report_doctor', 'add_to_handoff'];
  if (status === 'assigned' || status === 'todo') return ['accept', 'start', 'complete', ...base];
  if (status === 'accepted') return ['start', 'block', 'complete', ...base];
  if (status === 'in_progress') return ['complete', 'block', ...base];
  if (status === 'blocked') return ['resume', 'reassign', ...base];
  if (status === 'overdue') return ['complete', 'escalate', 'reassign', 'extend', ...base];
  if (status === 'done') return ['create_follow_up', 'request_review'];
  return base;
}

function buildTaskQuery(query = {}, actor = {}, mode = 'list') {
  const filter = {};
  const { dayStart, dayEnd } = buildDateWindow(query);
  addDepartmentScope(filter, query, actor);

  if (query.search) {
    const pattern = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { task_code: { $regex: pattern, $options: 'i' } },
      { title: { $regex: pattern, $options: 'i' } },
      { description: { $regex: pattern, $options: 'i' } },
    ];
  }
  if (query.patient_id) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  if (query.encounter_id) filter.encounter_id = toObjectId(query.encounter_id, 'encounter_id');
  if (query.admission_id) filter.admission_id = toObjectId(query.admission_id, 'admission_id');
  if (query.assigned_to === 'me' || query.nurse_id === 'me' || mode === 'my') filter.assigned_to = toObjectId(actorUserId(actor), 'user_id');
  else if (query.assigned_to === 'unassigned') filter.assigned_to = { $exists: false };
  else if (query.assigned_to) filter.assigned_to = toObjectId(query.assigned_to, 'assigned_to');
  if (query.priority) filter.priority = query.priority === 'stat' ? { $in: ['stat', 'critical'] } : query.priority;
  if (query.task_type || query.type) filter.task_type = query.task_type || query.type;
  if (query.source_module || query.source_type) filter.source_module = query.source_module || query.source_type;

  if (mode === 'overdue' || query.status === 'overdue') {
    filter.status = { $in: OPEN_STATUSES };
    filter.due_at = { $lt: new Date() };
    return filter;
  }
  if (mode === 'completed') {
    filter.status = { $in: DONE_STATUSES };
    filter.completed_at = { $gte: dayStart, $lte: dayEnd };
    return filter;
  }
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
    return filter;
  }
  if (mode === 'today' || query.scope === 'today') {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { due_at: { $gte: dayStart, $lte: dayEnd } },
          { created_at: { $gte: dayStart, $lte: dayEnd } },
          { status: { $in: OPEN_STATUSES }, due_at: { $lt: new Date() } },
        ],
      },
    ];
  }
  return filter;
}

function populateTaskQuery(query) {
  return query
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('department_id', 'department_name department_code')
    .populate('assigned_to', 'full_name employee_code username')
    .populate('completed_by', 'full_name employee_code username')
    .populate('room_id', 'room_name room_code name')
    .populate('bed_id', 'bed_label bed_number name');
}

async function latestVitalsByPatient(patientIds = []) {
  const ids = [...new Set(patientIds.filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const vitals = await VitalSign.find({ patient_id: { $in: ids.map((id) => toObjectId(id, 'patient_id')) } })
    .sort({ recorded_at: -1, created_at: -1 })
    .populate('recorded_by', 'full_name employee_code username')
    .lean();
  const map = new Map();
  vitals.forEach((vital) => {
    const patientId = normalizeId(vital.patient_id);
    if (!map.has(patientId)) map.set(patientId, vital);
  });
  return map;
}

async function enrichTaskList(tasks = [], now = new Date()) {
  const patientIds = tasks.map((task) => normalizeId(task.patient_id)).filter(Boolean);
  const vitalsByPatient = await latestVitalsByPatient(patientIds);
  return tasks.map((task) => taskDto(task, { now, vitalsByPatient }));
}

async function emitTaskEvent(event, task, extra = {}) {
  const payload = {
    task_id: normalizeId(task),
    task_code: task.task_code,
    patient_id: normalizeId(task.patient_id),
    department_id: normalizeId(task.department_id),
    status: task.status,
    priority: task.priority,
    title: task.title,
    ...extra,
  };
  return realtimeService.emitToScope(event, payload, {
    user_id: normalizeId(task.assigned_to),
    patient_id: normalizeId(task.patient_id),
    department_id: normalizeId(task.department_id),
    role: extra.role || 'nurse',
  });
}

async function notifyTaskAssignee(task, title, message, priority = NOTIFICATION_PRIORITY.NORMAL) {
  const userId = normalizeId(task.assigned_to);
  if (!userId) return null;
  const notification = await Notification.create({
    recipient_type: NOTIFICATION_RECIPIENT_TYPE.STAFF,
    recipient_id: toObjectId(userId, 'recipient_id'),
    recipient_actor_type: 'staff',
    recipient_actor_id: toObjectId(userId, 'recipient_actor_id'),
    recipient_user_id: toObjectId(userId, 'recipient_user_id'),
    patient_id: task.patient_id,
    channel: NOTIFICATION_CHANNEL.IN_APP,
    notification_type: 'nursing_task',
    event_type: 'nursing_task.assigned',
    priority,
    title,
    message,
    action_url: `/nurse/tasks-handover/assigned?task=${normalizeId(task)}`,
    payload: { entity_type: 'nursing_task', entity_id: normalizeId(task), task_code: task.task_code },
    created_by_module: 'nursing-task-service',
    sent_at: new Date(),
    delivered_at: new Date(),
    status: NOTIFICATION_STATUS.SENT,
  });
  realtimeService.emitToScope('notification.created', {
    notification_id: normalizeId(notification),
    title,
    priority,
    action_url: notification.action_url,
  }, { user_id: userId });
  return notification;
}

async function listTasks(query = {}, actor = {}, mode = 'list') {
  const filter = buildTaskQuery(query, actor, mode);
  const { page, limit, skip } = getPagination(query, 50, 200);
  const sort = mode === 'completed'
    ? { completed_at: -1, updated_at: -1 }
    : { due_at: 1, priority: -1, created_at: 1 };
  const [items, total] = await Promise.all([
    populateTaskQuery(NursingTask.find(filter))
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    NursingTask.countDocuments(filter),
  ]);
  const enriched = await enrichTaskList(items, new Date());
  return {
    items: enriched,
    summary: summarizeTasks(enriched),
    pagination: buildPagination(page, limit, total),
  };
}

function summarizeTasks(tasks = []) {
  return {
    total: tasks.length,
    assigned: tasks.filter((task) => ['assigned', 'todo'].includes(task.raw_status || task.status)).length,
    accepted: tasks.filter((task) => task.raw_status === 'accepted').length,
    in_progress: tasks.filter((task) => task.raw_status === 'in_progress').length,
    blocked: tasks.filter((task) => task.raw_status === 'blocked').length,
    overdue: tasks.filter((task) => task.status === 'overdue').length,
    done: tasks.filter((task) => task.raw_status === 'done').length,
    urgent: tasks.filter((task) => ['urgent', 'stat', 'critical'].includes(task.raw_priority || task.priority)).length,
    doctor_report: tasks.filter((task) => task.flags?.includes('doctor_report_needed')).length,
    medication: tasks.filter((task) => task.task_group === 'medication').length,
    vitals: tasks.filter((task) => task.task_group === 'vitals').length,
    handoff: tasks.filter((task) => task.handoff_id || task.task_group === 'handoff').length,
  };
}

async function getTaskSummary(query = {}, actor = {}) {
  const base = buildTaskQuery({ ...query, status: undefined }, actor, query.scope === 'my' ? 'my' : 'today');
  const now = new Date();
  const [total, assigned, inProgress, blocked, overdue, done, urgent, doctorReport] = await Promise.all([
    NursingTask.countDocuments(base),
    NursingTask.countDocuments({ ...base, status: { $in: ['assigned', 'todo', 'accepted'] } }),
    NursingTask.countDocuments({ ...base, status: 'in_progress' }),
    NursingTask.countDocuments({ ...base, status: 'blocked' }),
    NursingTask.countDocuments({ ...base, status: { $in: OPEN_STATUSES }, due_at: { $lt: now } }),
    NursingTask.countDocuments({ ...base, status: 'done' }),
    NursingTask.countDocuments({ ...base, priority: { $in: ['urgent', 'stat', 'critical'] }, status: { $nin: CLOSED_STATUSES } }),
    NursingTask.countDocuments({ ...base, task_type: 'doctor_report', status: { $nin: CLOSED_STATUSES } }),
  ]);
  return { total, assigned, in_progress: inProgress, blocked, overdue, done, urgent, doctor_report: doctorReport };
}

async function getTask(taskId, actor = {}) {
  const task = await populateTaskQuery(NursingTask.findById(taskId)).lean();
  if (!task) throw createError('Không tìm thấy task điều dưỡng.', 404);
  const [dto] = await enrichTaskList([task], new Date());
  return dto;
}

async function createTask(payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.patient_id) throw createError('patient_id là bắt buộc.', 400);
  if (!payload.title) throw createError('title là bắt buộc.', 400);
  const patient = await Patient.findById(payload.patient_id).select('_id').lean();
  if (!patient) throw createError('Không tìm thấy bệnh nhân.', 404);
  const departmentId = payload.department_id || actorDepartmentId(actor);
  if (!departmentId) throw createError('department_id là bắt buộc.', 400);
  const now = new Date();
  const dueAt = payload.due_at
    ? parseDate(payload.due_at, 'due_at')
    : payload.sla_minutes ? new Date(now.getTime() + Number(payload.sla_minutes) * 60000) : undefined;
  const task = await NursingTask.create({
    task_code: payload.task_code || await generateBusinessCode(CODE_TYPE.NURSING_TASK, { date: now, sequenceLength: 5 }),
    patient_id: toObjectId(payload.patient_id, 'patient_id'),
    encounter_id: payload.encounter_id ? toObjectId(payload.encounter_id, 'encounter_id') : undefined,
    admission_id: payload.admission_id ? toObjectId(payload.admission_id, 'admission_id') : undefined,
    queue_ticket_id: payload.queue_ticket_id ? toObjectId(payload.queue_ticket_id, 'queue_ticket_id') : undefined,
    emergency_case_id: payload.emergency_case_id ? toObjectId(payload.emergency_case_id, 'emergency_case_id') : undefined,
    department_id: toObjectId(departmentId, 'department_id'),
    room_id: payload.room_id ? toObjectId(payload.room_id, 'room_id') : undefined,
    bed_id: payload.bed_id ? toObjectId(payload.bed_id, 'bed_id') : undefined,
    source_module: payload.source_module || payload.source_type || 'manual',
    source_type: payload.source_type || payload.source_module || 'manual',
    source_id: payload.source_id ? toObjectId(payload.source_id, 'source_id') : undefined,
    task_type: payload.task_type || payload.type || 'other',
    title: normalizeString(payload.title),
    description: normalizeString(payload.description),
    priority: normalizePriority(payload.priority),
    status: payload.status || 'assigned',
    assigned_to: payload.assigned_to ? toObjectId(payload.assigned_to, 'assigned_to') : undefined,
    assigned_role: payload.assigned_role,
    assigned_department_id: payload.assigned_department_id ? toObjectId(payload.assigned_department_id, 'assigned_department_id') : toObjectId(departmentId, 'department_id'),
    assigned_by: actorUserId(actor) ? toObjectId(actorUserId(actor), 'assigned_by') : undefined,
    due_at: dueAt,
    sla_minutes: payload.sla_minutes,
    checklist_items: (payload.checklist_items || []).map((item) => ({
      title: item.title,
      required: Boolean(item.required),
      status: item.status || 'pending',
      note: item.note,
    })),
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({
    actor,
    action: 'nursing_task.created',
    targetType: 'nursing_task',
    targetId: task._id,
    status: 'success',
    message: 'Tạo task điều dưỡng.',
    requestMeta,
  });
  await emitTaskEvent('nursing_task.created', task);
  if (task.assigned_to) await notifyTaskAssignee(task, 'Task điều dưỡng mới', task.title, notificationPriority(task.priority));
  return getTask(task._id, actor);
}

function notificationPriority(priority) {
  if (['stat', 'critical'].includes(priority)) return NOTIFICATION_PRIORITY.CRITICAL;
  if (priority === 'urgent') return NOTIFICATION_PRIORITY.URGENT;
  if (priority === 'high') return NOTIFICATION_PRIORITY.HIGH;
  if (priority === 'low') return NOTIFICATION_PRIORITY.LOW;
  return NOTIFICATION_PRIORITY.NORMAL;
}

async function loadTaskForWrite(taskId) {
  const task = await NursingTask.findById(taskId);
  if (!task) throw createError('Không tìm thấy task điều dưỡng.', 404);
  return task;
}

async function saveTransition(task, actor, action, requestMeta, metadata = {}) {
  task.updated_by = actorUserId(actor);
  await task.save();
  await recordAuditLog({
    actor,
    action: `nursing_task.${action}`,
    targetType: 'nursing_task',
    targetId: task._id,
    status: 'success',
    message: `Cập nhật task điều dưỡng: ${action}.`,
    requestMeta,
    metadata,
  });
  await emitTaskEvent(`nursing_task.${action}`, task, metadata);
  return getTask(task._id, actor);
}

async function acceptTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const task = await loadTaskForWrite(taskId);
  if (!task.assigned_to && actorUserId(actor)) task.assigned_to = toObjectId(actorUserId(actor), 'assigned_to');
  task.status = 'accepted';
  task.accepted_at = task.accepted_at || new Date();
  return saveTransition(task, actor, 'accepted', requestMeta, { previous_status: task.status, note: payload.note });
}

async function startTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const task = await loadTaskForWrite(taskId);
  if (!task.assigned_to && actorUserId(actor)) task.assigned_to = toObjectId(actorUserId(actor), 'assigned_to');
  if (!task.accepted_at) task.accepted_at = new Date();
  task.status = 'in_progress';
  task.started_at = task.started_at || new Date();
  task.started_by = actorUserId(actor) ? toObjectId(actorUserId(actor), 'started_by') : undefined;
  return saveTransition(task, actor, 'started', requestMeta, { note: payload.note });
}

async function blockTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const reason = normalizeString(payload.blocked_reason || payload.reason);
  if (!reason) throw createError('blocked_reason là bắt buộc.', 400);
  const task = await loadTaskForWrite(taskId);
  task.status = 'blocked';
  task.blocked_reason = reason;
  if (['high', 'urgent', 'stat', 'critical'].includes(task.priority)) {
    await emitTaskEvent('nursing_task.blocked', task, { role: 'nurse_manager', blocked_reason: reason });
  }
  return saveTransition(task, actor, 'blocked', requestMeta, { blocked_reason: reason });
}

async function resumeTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const task = await loadTaskForWrite(taskId);
  task.status = task.started_at ? 'in_progress' : 'accepted';
  task.blocked_reason = undefined;
  return saveTransition(task, actor, 'resumed', requestMeta, { note: payload.note });
}

async function completeTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const task = await loadTaskForWrite(taskId);
  const missingRequired = (task.checklist_items || []).filter((item) => item.required && item.status !== 'done');
  if (missingRequired.length) throw createError('Task còn checklist bắt buộc chưa hoàn tất.', 409);
  const now = new Date();
  const late = task.due_at && new Date(task.due_at).getTime() < now.getTime();
  task.status = 'done';
  task.completed_at = now;
  task.completed_by = actorUserId(actor) ? toObjectId(actorUserId(actor), 'completed_by') : undefined;
  task.result_note = normalizeString(payload.result_note || payload.note) || task.result_note;
  if (late) task.completed_late_reason = normalizeString(payload.completed_late_reason || payload.late_reason) || task.completed_late_reason;
  if (payload.create_clinical_note && task.encounter_id) {
    const note = await ClinicalNote.create({
      encounter_id: task.encounter_id,
      author_id: toObjectId(actorUserId(actor), 'author_id'),
      note_type: 'nursing_task_completion',
      title: `Hoàn tất task ${task.task_code}`,
      content: task.result_note || `Điều dưỡng đã hoàn tất: ${task.title}`,
      linked_task_id: task._id,
      priority: ['urgent', 'stat', 'critical'].includes(task.priority) ? 'urgent' : 'normal',
      visibility: 'care_team',
      created_by: actorUserId(actor),
      updated_by: actorUserId(actor),
    });
    task.clinical_note_id = note._id;
  }
  return saveTransition(task, actor, 'completed', requestMeta, { late, result_note: task.result_note });
}

async function cancelTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const reason = normalizeString(payload.cancel_reason || payload.reason);
  if (!reason) throw createError('cancel_reason là bắt buộc.', 400);
  const task = await loadTaskForWrite(taskId);
  task.status = 'cancelled';
  task.cancelled_at = new Date();
  task.cancelled_by = actorUserId(actor) ? toObjectId(actorUserId(actor), 'cancelled_by') : undefined;
  task.cancel_reason = reason;
  return saveTransition(task, actor, 'cancelled', requestMeta, { cancel_reason: reason });
}

async function reassignTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.assigned_to && !payload.assigned_role) throw createError('assigned_to hoặc assigned_role là bắt buộc.', 400);
  const task = await loadTaskForWrite(taskId);
  const previousAssignee = normalizeId(task.assigned_to);
  task.assigned_to = payload.assigned_to ? toObjectId(payload.assigned_to, 'assigned_to') : undefined;
  task.assigned_role = payload.assigned_role || task.assigned_role;
  task.assigned_by = actorUserId(actor) ? toObjectId(actorUserId(actor), 'assigned_by') : task.assigned_by;
  task.status = 'assigned';
  task.accepted_at = undefined;
  task.started_at = undefined;
  task.started_by = undefined;
  await notifyTaskAssignee(task, 'Task điều dưỡng được giao lại', task.title, notificationPriority(task.priority));
  return saveTransition(task, actor, 'reassigned', requestMeta, { previous_assignee: previousAssignee, reason: payload.reason });
}

async function escalateTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const task = await loadTaskForWrite(taskId);
  task.escalation_level = Number(task.escalation_level || 0) + 1;
  task.escalated_at = new Date();
  task.escalated_by = actorUserId(actor) ? toObjectId(actorUserId(actor), 'escalated_by') : undefined;
  task.escalated_to = payload.escalated_to ? toObjectId(payload.escalated_to, 'escalated_to') : task.escalated_to;
  task.escalation_reason = normalizeString(payload.escalation_reason || payload.reason) || task.escalation_reason;
  task.priority = ['stat', 'critical'].includes(task.priority) ? task.priority : 'urgent';
  await emitTaskEvent('nursing_task.escalated', task, { role: 'nurse_manager', escalation_level: task.escalation_level });
  return saveTransition(task, actor, 'escalated', requestMeta, { escalation_level: task.escalation_level });
}

async function extendTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const task = await loadTaskForWrite(taskId);
  if (!payload.due_at && !payload.extend_minutes) throw createError('due_at hoặc extend_minutes là bắt buộc.', 400);
  task.due_at = payload.due_at
    ? parseDate(payload.due_at, 'due_at')
    : new Date((task.due_at ? new Date(task.due_at).getTime() : Date.now()) + Number(payload.extend_minutes) * 60000);
  task.status = task.status === 'overdue' ? 'assigned' : task.status;
  return saveTransition(task, actor, 'extended', requestMeta, { due_at: task.due_at, reason: payload.reason });
}

async function remindTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const task = await loadTaskForWrite(taskId);
  await notifyTaskAssignee(task, 'Nhắc task điều dưỡng', payload.message || task.title, notificationPriority(task.priority));
  return saveTransition(task, actor, 'reminded', requestMeta, { message: payload.message });
}

async function addTaskNote(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const note = normalizeString(payload.note || payload.result_note);
  if (!note) throw createError('note là bắt buộc.', 400);
  const task = await loadTaskForWrite(taskId);
  const notes = Array.isArray(task.metadata?.task_notes) ? task.metadata.task_notes : [];
  task.metadata = {
    ...(task.metadata || {}),
    latest_note: note,
    task_notes: [
      ...notes,
      { note, created_at: new Date(), created_by: actorUserId(actor), kind: payload.kind || 'nursing_note' },
    ],
  };
  task.result_note = payload.result_note ? note : task.result_note;
  return saveTransition(task, actor, 'note_added', requestMeta, { note });
}

async function createClinicalNoteFromTask(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const task = await loadTaskForWrite(taskId);
  if (!task.encounter_id && !payload.encounter_id) throw createError('Task chưa có encounter để tạo clinical note.', 409);
  const note = await ClinicalNote.create({
    encounter_id: payload.encounter_id ? toObjectId(payload.encounter_id, 'encounter_id') : task.encounter_id,
    author_id: toObjectId(actorUserId(actor), 'author_id'),
    note_type: payload.note_type || 'nursing_task_note',
    title: payload.title || `Ghi chú task ${task.task_code}`,
    content: payload.content || payload.note || task.result_note || task.description || task.title,
    linked_task_id: task._id,
    priority: payload.priority || (['urgent', 'stat', 'critical'].includes(task.priority) ? 'urgent' : 'normal'),
    visibility: payload.visibility || 'care_team',
    tags: payload.tags || ['nursing_task'],
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  task.clinical_note_id = note._id;
  await saveTransition(task, actor, 'clinical_note_created', requestMeta, { clinical_note_id: normalizeId(note) });
  return { task: await getTask(task._id, actor), clinical_note: note.toObject ? note.toObject() : note };
}

async function reportDoctor(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const task = await loadTaskForWrite(taskId);
  task.status = task.status === 'done' ? task.status : 'waiting_doctor';
  task.escalation_level = Number(task.escalation_level || 0) + 1;
  task.escalation_reason = normalizeString(payload.reason || payload.message) || task.escalation_reason || 'Báo bác sĩ từ task điều dưỡng';
  task.metadata = {
    ...(task.metadata || {}),
    doctor_report: {
      message: payload.message || task.escalation_reason,
      doctor_id: payload.doctor_id || null,
      reported_at: new Date(),
      reported_by: actorUserId(actor),
    },
  };
  if (payload.doctor_id) {
    await Notification.create({
      recipient_type: NOTIFICATION_RECIPIENT_TYPE.STAFF,
      recipient_id: toObjectId(payload.doctor_id, 'doctor_id'),
      recipient_actor_type: 'staff',
      recipient_actor_id: toObjectId(payload.doctor_id, 'doctor_id'),
      recipient_user_id: toObjectId(payload.doctor_id, 'doctor_id'),
      patient_id: task.patient_id,
      channel: NOTIFICATION_CHANNEL.IN_APP,
      notification_type: 'nursing_task.doctor_report',
      event_type: 'nursing_task.report_doctor',
      priority: notificationPriority(task.priority),
      title: `Điều dưỡng báo bác sĩ: ${task.title}`,
      message: payload.message || task.escalation_reason,
      action_url: `/doctor/patients?patient=${normalizeId(task.patient_id)}`,
      payload: { entity_type: 'nursing_task', entity_id: normalizeId(task), task_code: task.task_code },
      created_by_module: 'nursing-task-service',
      sent_at: new Date(),
      delivered_at: new Date(),
      status: NOTIFICATION_STATUS.SENT,
    });
    realtimeService.emitToScope('nursing_task.report_doctor', {
      task_id: normalizeId(task),
      patient_id: normalizeId(task.patient_id),
      message: payload.message || task.escalation_reason,
    }, { user_id: payload.doctor_id, patient_id: normalizeId(task.patient_id) });
  }
  return saveTransition(task, actor, 'reported_doctor', requestMeta, { doctor_id: payload.doctor_id });
}

async function addToHandoff(taskId, payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.handoff_id) throw createError('handoff_id là bắt buộc.', 400);
  const [task, handoff] = await Promise.all([
    loadTaskForWrite(taskId),
    NursingHandoff.findById(payload.handoff_id),
  ]);
  if (!handoff) throw createError('Không tìm thấy bàn giao ca.', 404);
  task.handoff_id = handoff._id;
  if (!handoff.task_ids.some((id) => sameId(id, task._id))) handoff.task_ids.push(task._id);
  const patientItem = handoff.patient_items.find((item) => sameId(item.patient_id, task.patient_id));
  if (patientItem && !patientItem.pending_task_ids.some((id) => sameId(id, task._id))) {
    patientItem.pending_task_ids.push(task._id);
  }
  await handoff.save();
  return saveTransition(task, actor, 'added_to_handoff', requestMeta, { handoff_id: normalizeId(handoff) });
}

async function updateChecklistItem(taskId, itemId, payload = {}, actor = {}, requestMeta = {}, forcedStatus = null) {
  const task = await loadTaskForWrite(taskId);
  const item = task.checklist_items.id(itemId);
  if (!item) throw createError('Không tìm thấy checklist item.', 404);
  item.status = forcedStatus || payload.status || 'done';
  item.note = payload.note ?? item.note;
  item.checked_at = new Date();
  item.checked_by = actorUserId(actor) ? toObjectId(actorUserId(actor), 'checked_by') : undefined;
  return saveTransition(task, actor, item.status === 'skipped' ? 'checklist_skipped' : 'checklist_checked', requestMeta, {
    item_id: itemId,
    item_status: item.status,
  });
}

async function bulkComplete(payload = {}, actor = {}, requestMeta = {}) {
  const ids = payload.task_ids || [];
  if (!Array.isArray(ids) || ids.length === 0) throw createError('task_ids không được rỗng.', 400);
  const results = [];
  for (const taskId of ids) {
    results.push(await completeTask(taskId, payload, actor, requestMeta));
  }
  return { completed_count: results.length, items: results };
}

async function bulkReassign(payload = {}, actor = {}, requestMeta = {}) {
  const ids = payload.task_ids || [];
  if (!Array.isArray(ids) || ids.length === 0) throw createError('task_ids không được rỗng.', 400);
  const results = [];
  for (const taskId of ids) {
    results.push(await reassignTask(taskId, payload, actor, requestMeta));
  }
  return { reassigned_count: results.length, items: results };
}

async function bulkAddToHandoff(payload = {}, actor = {}, requestMeta = {}) {
  const ids = payload.task_ids || [];
  if (!Array.isArray(ids) || ids.length === 0) throw createError('task_ids không được rỗng.', 400);
  const results = [];
  for (const taskId of ids) {
    results.push(await addToHandoff(taskId, payload, actor, requestMeta));
  }
  return { added_count: results.length, items: results };
}

async function patientMatrix(query = {}, actor = {}) {
  const payload = await listTasks({ ...query, status: query.status || undefined, limit: query.limit || 500 }, actor, 'today');
  const patientIds = [...new Set(payload.items.map((task) => task.patient_id).filter(Boolean))];
  const [allergies, problems, meds] = await Promise.all([
    Allergy.find({ patient_id: { $in: patientIds.map((id) => toObjectId(id, 'patient_id')) }, status: 'active' }).lean(),
    ProblemList.find({ patient_id: { $in: patientIds.map((id) => toObjectId(id, 'patient_id')) }, status: 'active' }).lean(),
    MedicationAdministration.find({ patient_id: { $in: patientIds.map((id) => toObjectId(id, 'patient_id')) }, status: ADMINISTRATION_STATUS.SCHEDULED }).lean(),
  ]);
  const allergiesByPatient = groupByPatient(allergies);
  const problemsByPatient = groupByPatient(problems);
  const medsByPatient = groupByPatient(meds);
  const rows = new Map();
  payload.items.forEach((task) => {
    const row = rows.get(task.patient_id) || {
      patient: task.patient,
      patient_id: task.patient_id,
      room_name: task.room_name,
      bed_label: task.bed_label,
      latest_vitals: task.latest_vitals,
      risk_tags: [],
      task_counts: { pending: 0, overdue: 0, medication: 0, vital: 0, lab: 0, imaging: 0, procedure: 0, monitoring: 0, doctor_report: 0, handoff: 0, done: 0 },
      next_task: null,
      tasks: [],
    };
    row.tasks.push(task);
    const key = task.status === 'done' ? 'done' : task.status === 'overdue' ? 'overdue' : 'pending';
    row.task_counts[key] += 1;
    if (row.task_counts[task.task_group] !== undefined) row.task_counts[task.task_group] += 1;
    if (task.task_group === 'vitals') row.task_counts.vital += 1;
    if (task.task_group === 'medication') row.task_counts.medication += 1;
    if (!row.next_task || new Date(task.due_at || task.created_at) < new Date(row.next_task.due_at || row.next_task.created_at)) row.next_task = task;
    rows.set(task.patient_id, row);
  });
  const items = Array.from(rows.values()).map((row) => {
    const patientAllergies = allergiesByPatient.get(row.patient_id) || [];
    const patientProblems = problemsByPatient.get(row.patient_id) || [];
    const patientMeds = medsByPatient.get(row.patient_id) || [];
    const tags = [];
    if (patientAllergies.length) tags.push('allergy');
    if (row.latest_vitals && ['high', 'critical'].includes(row.latest_vitals.severity)) tags.push('critical_vitals');
    if (row.task_counts.overdue) tags.push('overdue');
    if (patientMeds.length) tags.push('medication_attention');
    return {
      ...row,
      risk_tags: [...new Set([...row.risk_tags, ...tags])],
      acuity_level: tags.includes('critical_vitals') || row.task_counts.overdue > 1 ? 'critical' : tags.length ? 'high' : row.task_counts.pending > 4 ? 'medium' : 'low',
      allergies: patientAllergies,
      problems: patientProblems,
      pending_medications: patientMeds,
    };
  });
  return { items, summary: summarizePatientMatrix(items), meta: payload.meta || {} };
}

function groupByPatient(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const key = normalizeId(item.patient_id);
    if (!key) return;
    map.set(key, [...(map.get(key) || []), item]);
  });
  return map;
}

function summarizePatientMatrix(items = []) {
  return {
    patients: items.length,
    with_overdue: items.filter((item) => item.task_counts.overdue).length,
    high_risk: items.filter((item) => ['high', 'critical'].includes(item.acuity_level)).length,
    pending_tasks: items.reduce((sum, item) => sum + item.task_counts.pending + item.task_counts.overdue, 0),
    medication_pending: items.reduce((sum, item) => sum + item.task_counts.medication, 0),
    vital_pending: items.reduce((sum, item) => sum + item.task_counts.vital, 0),
    doctor_report: items.reduce((sum, item) => sum + item.task_counts.doctor_report, 0),
    handoff: items.reduce((sum, item) => sum + item.task_counts.handoff, 0),
  };
}

async function workload(query = {}, actor = {}) {
  const payload = await listTasks({ ...query, status: undefined, limit: 1000 }, actor, 'today');
  const byUser = new Map();
  payload.items.forEach((task) => {
    const key = task.assigned_to || 'unassigned';
    const item = byUser.get(key) || {
      user_id: task.assigned_to,
      full_name: task.assigned_to_name || 'Chưa phân công',
      total: 0,
      overdue: 0,
      urgent: 0,
      in_progress: 0,
      done: 0,
    };
    item.total += 1;
    if (task.status === 'overdue') item.overdue += 1;
    if (['urgent', 'stat', 'critical'].includes(task.priority)) item.urgent += 1;
    if (task.status === 'in_progress') item.in_progress += 1;
    if (task.status === 'done') item.done += 1;
    byUser.set(key, item);
  });
  const items = Array.from(byUser.values()).sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  return {
    items,
    summary: {
      nurses: items.filter((item) => item.user_id).length,
      unassigned: byUser.get('unassigned')?.total || 0,
      total: payload.summary.total,
      overdue: payload.summary.overdue,
      urgent: payload.summary.urgent,
    },
  };
}

async function auditTrail(taskId, actor = {}) {
  const task = await getTask(taskId, actor);
  const events = [
    { type: 'created', at: task.created_at, title: 'Task được tạo', actor_id: task.assigned_by },
    task.accepted_at ? { type: 'accepted', at: task.accepted_at, title: 'Điều dưỡng nhận task', actor_id: task.assigned_to } : null,
    task.started_at ? { type: 'started', at: task.started_at, title: 'Bắt đầu xử lý', actor_id: task.assigned_to } : null,
    task.escalated_at ? { type: 'escalated', at: task.escalated_at, title: 'Escalate task', note: task.escalation_reason } : null,
    task.completed_at ? { type: 'completed', at: task.completed_at, title: 'Hoàn tất task', actor_id: task.completed_by?.user_id, note: task.result_note } : null,
  ].filter(Boolean);
  return { task_id: task.task_id, task_code: task.task_code, items: events.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0)) };
}

async function createFollowUp(taskId, payload = {}, actor = {}, requestMeta = {}) {
  const sourceTask = await NursingTask.findById(taskId).lean();
  if (!sourceTask) throw createError('Không tìm thấy task điều dưỡng.', 404);
  return createTask({
    patient_id: normalizeId(sourceTask.patient_id),
    encounter_id: normalizeId(sourceTask.encounter_id),
    admission_id: normalizeId(sourceTask.admission_id),
    queue_ticket_id: normalizeId(sourceTask.queue_ticket_id),
    department_id: normalizeId(sourceTask.department_id),
    room_id: normalizeId(sourceTask.room_id),
    bed_id: normalizeId(sourceTask.bed_id),
    source_module: 'manual',
    source_type: 'nursing_task_follow_up',
    source_id: normalizeId(sourceTask),
    task_type: payload.task_type || sourceTask.task_type,
    title: payload.title || `Theo dõi sau: ${sourceTask.title}`,
    description: payload.description || payload.note || `Task follow-up từ ${sourceTask.task_code}`,
    priority: payload.priority || sourceTask.priority,
    assigned_to: payload.assigned_to || normalizeId(sourceTask.assigned_to),
    due_at: payload.due_at,
    sla_minutes: payload.sla_minutes,
    checklist_items: payload.checklist_items || [],
    metadata: { follow_up_from_task_id: normalizeId(sourceTask), ...(payload.metadata || {}) },
  }, actor, requestMeta);
}

async function updateReview(taskId, status, payload = {}, actor = {}, requestMeta = {}) {
  const task = await loadTaskForWrite(taskId);
  task.quality_review_status = status;
  task.metadata = {
    ...(task.metadata || {}),
    review: {
      status,
      note: payload.note || payload.reason,
      reviewed_at: new Date(),
      reviewed_by: actorUserId(actor),
    },
  };
  return saveTransition(task, actor, `review_${status}`, requestMeta, { review_status: status });
}

module.exports = {
  listTasks,
  listMyTasks: (query, actor) => listTasks(query, actor, 'my'),
  listOverdueTasks: (query, actor) => listTasks(query, actor, 'overdue'),
  listCompletedTasks: (query, actor) => listTasks(query, actor, 'completed'),
  getTaskSummary,
  getTask,
  createTask,
  acceptTask,
  startTask,
  blockTask,
  resumeTask,
  completeTask,
  cancelTask,
  reassignTask,
  escalateTask,
  extendTask,
  remindTask,
  addTaskNote,
  createClinicalNoteFromTask,
  reportDoctor,
  addToHandoff,
  updateChecklistItem,
  bulkComplete,
  bulkReassign,
  bulkAddToHandoff,
  patientMatrix,
  tasksByPatient: (query, actor) => listTasks(query, actor, 'list'),
  workload,
  auditTrail,
  createFollowUp,
  requestReview: (taskId, payload, actor, requestMeta) => updateReview(taskId, 'pending_review', payload, actor, requestMeta),
  approveReview: (taskId, payload, actor, requestMeta) => updateReview(taskId, 'approved', payload, actor, requestMeta),
  rejectReview: (taskId, payload, actor, requestMeta) => updateReview(taskId, 'needs_correction', payload, actor, requestMeta),
};
