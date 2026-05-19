const { Types } = require('mongoose');
const {
  Allergy,
  ClinicalAlert,
  ClinicalNote,
  DoctorNotificationRequest,
  EmergencyCase,
  Encounter,
  ImagingReport,
  LabResult,
  MedicationAdministration,
  MedicationMaster,
  MedicationReactionObservation,
  Notification,
  NursingMonitoringCheck,
  NursingMonitoringSession,
  Patient,
  PostProcedureObservation,
  ProcedureOrder,
  ProblemList,
  VitalSign,
} = require('../models');
const actorContext = require('../common/actors');
const notificationService = require('./notification.service');
const codeGeneratorService = require('./code-generator.service');
const {
  ADMINISTRATION_STATUS,
  CLINICAL_NOTE_STATUS,
  EMERGENCY_PRIORITY,
  EMERGENCY_STATUS,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_RECIPIENT_TYPE,
  NOTIFICATION_STATUS,
} = require('../constants/statuses');
const {
  buildPagination,
  createError,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeString,
  recordAuditLog,
} = require('./core.service');

const OPEN_MONITORING_STATUSES = ['active', 'watching', 'doctor_notified', 'doctor_acknowledged', 'escalated'];
const OPEN_ALERT_STATUSES = ['open', 'acknowledged', 'doctor_notified', 'escalated'];
const OPEN_DOCTOR_NOTIFICATION_STATUSES = ['draft', 'sent', 'delivered', 'seen', 'acknowledged', 'escalated'];
const OPEN_EMERGENCY_STATUSES = ['created', 'acknowledged', 'triaged', 'dispatched'];
const ACTIVE_ENCOUNTER_STATUSES = ['arrived', 'in_progress', 'on_hold'];
const RECENT_HOURS = 18;

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || actorContext.getStaffId(actor) || null;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || actorContext.getDepartmentId(actor) || null;
}

function systemActor(actor = {}, requestMeta = {}) {
  return actorContext.buildSystemActor({
    serviceName: 'nursing-clinical-command',
    requestMeta,
    permissions: actor.permissions || [],
  });
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (value._id) return toObjectId(value._id, fieldName);
  if (!Types.ObjectId.isValid(String(value))) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(String(value));
}

function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return String(value);
  if (value._id) return normalizeId(value._id);
  if (value.id) return normalizeId(value.id);
  return typeof value.toString === 'function' ? value.toString() : null;
}

function sameId(left, right) {
  return String(normalizeId(left) || '') === String(normalizeId(right) || '');
}

function splitList(value, fallback = []) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  const normalized = normalizeString(value);
  return normalized ? normalized.split(',').map((item) => item.trim()).filter(Boolean) : fallback;
}

function parseDate(value, fieldName = 'date') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function minutesSince(value, now = new Date()) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
}

function minutesUntil(value, now = new Date()) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - now.getTime()) / 60000);
}

function isOverdue(value, now = new Date()) {
  const date = value ? new Date(value) : null;
  return Boolean(date && !Number.isNaN(date.getTime()) && date.getTime() < now.getTime());
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
    patient_id: normalizeId(patient),
    patient_code: value.patient_code || null,
    patient_name: value.full_name || value.patient_name || 'Chưa rõ bệnh nhân',
    gender: value.gender || null,
    age: ageFromDate(value.date_of_birth),
    phone: value.phone || null,
  };
}

function userDto(user = {}) {
  if (!user) return null;
  const value = user && typeof user === 'object' ? user : {};
  return {
    user_id: normalizeId(user),
    full_name: value.full_name || value.username || value.employee_code || null,
    employee_code: value.employee_code || null,
  };
}

function departmentDto(department = {}) {
  if (!department) return null;
  const value = department && typeof department === 'object' ? department : {};
  return {
    department_id: normalizeId(department),
    department_name: value.department_name || value.name || null,
    department_code: value.department_code || null,
  };
}

function numeric(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function vitalDisplay(vital = {}) {
  if (!vital) return null;
  return {
    vital_sign_id: normalizeId(vital),
    temperature: vital.temperature ?? null,
    heart_rate: vital.heart_rate ?? null,
    respiratory_rate: vital.respiratory_rate ?? null,
    systolic_bp: vital.systolic_bp ?? null,
    diastolic_bp: vital.diastolic_bp ?? null,
    spo2: vital.spo2 ?? null,
    pain_score: vital.pain_score ?? null,
    bmi: vital.bmi ?? null,
    recorded_at: vital.recorded_at || null,
    recorded_by: userDto(vital.recorded_by),
    abnormal_flags: vital.abnormal_flags || [],
    severity: vital.overall_severity || vital.severity || 'normal',
    requires_recheck: Boolean(vital.requires_recheck),
    requires_doctor_notification: Boolean(vital.requires_doctor_notification || vital.doctor_notification_required),
    acknowledged_at: vital.acknowledged_at || null,
    doctor_notified_at: vital.doctor_notified_at || null,
  };
}

function vitalFlags(vital = {}) {
  if (!vital) return [];
  if (Array.isArray(vital.abnormal_flags) && vital.abnormal_flags.length) {
    return vital.abnormal_flags.map((flag) => ({
      field: flag.field,
      value: flag.value,
      display_value: flag.display_value || flag.value,
      severity: flag.severity || flag.level || 'warning',
      message: flag.message || flag.field,
    }));
  }

  const flags = [];
  const spo2 = numeric(vital.spo2);
  const sbp = numeric(vital.systolic_bp);
  const dbp = numeric(vital.diastolic_bp);
  const hr = numeric(vital.heart_rate);
  const rr = numeric(vital.respiratory_rate);
  const temp = numeric(vital.temperature);

  if (spo2 !== null && spo2 < 90) flags.push({ field: 'spo2', value: spo2, severity: 'critical', message: 'SpO2 thấp' });
  if (sbp !== null && sbp < 90) flags.push({ field: 'systolic_bp', value: sbp, severity: 'high', message: 'Huyết áp tâm thu thấp' });
  if (sbp !== null && sbp >= 180) flags.push({ field: 'systolic_bp', value: sbp, severity: 'critical', message: 'Huyết áp tâm thu rất cao' });
  if (dbp !== null && dbp >= 120) flags.push({ field: 'diastolic_bp', value: dbp, severity: 'critical', message: 'Huyết áp tâm trương rất cao' });
  if (hr !== null && hr >= 130) flags.push({ field: 'heart_rate', value: hr, severity: 'high', message: 'Mạch nhanh' });
  if (hr !== null && hr < 50) flags.push({ field: 'heart_rate', value: hr, severity: 'high', message: 'Mạch chậm' });
  if (rr !== null && rr >= 30) flags.push({ field: 'respiratory_rate', value: rr, severity: 'high', message: 'Nhịp thở nhanh' });
  if (rr !== null && rr < 8) flags.push({ field: 'respiratory_rate', value: rr, severity: 'critical', message: 'Nhịp thở rất chậm' });
  if (temp !== null && temp >= 39) flags.push({ field: 'temperature', value: temp, severity: 'high', message: 'Sốt cao' });
  if (temp !== null && temp < 35) flags.push({ field: 'temperature', value: temp, severity: 'high', message: 'Hạ thân nhiệt' });

  return flags;
}

function riskFromSignals({ vital = null, labCritical = false, imagingCritical = false, procedureSeverity = null, medicationSeverity = null, emergencyPriority = null } = {}) {
  const flags = vitalFlags(vital);
  let score = 10;
  if (flags.some((flag) => flag.severity === 'critical')) score = Math.max(score, 92);
  else if (flags.some((flag) => flag.severity === 'high')) score = Math.max(score, 74);
  else if (flags.some((flag) => flag.severity === 'warning')) score = Math.max(score, 48);
  if (labCritical || imagingCritical) score = Math.max(score, 82);
  if (['urgent'].includes(procedureSeverity)) score = Math.max(score, 76);
  if (['critical'].includes(procedureSeverity)) score = Math.max(score, 94);
  if (['severe'].includes(medicationSeverity)) score = Math.max(score, 82);
  if (['life_threatening'].includes(medicationSeverity)) score = Math.max(score, 96);
  if (emergencyPriority === 'critical') score = Math.max(score, 98);
  if (score >= 90) return { level: 'critical', score };
  if (score >= 70) return { level: 'high', score };
  if (score >= 40) return { level: 'medium', score };
  return { level: 'low', score };
}

function priorityFromRisk(level) {
  if (level === 'critical') return 'critical';
  if (level === 'high') return 'high';
  if (level === 'medium') return 'medium';
  return 'low';
}

function notificationPriority(priority) {
  if (priority === 'critical') return NOTIFICATION_PRIORITY.CRITICAL;
  if (priority === 'stat') return NOTIFICATION_PRIORITY.URGENT;
  if (priority === 'urgent') return NOTIFICATION_PRIORITY.HIGH;
  return NOTIFICATION_PRIORITY.NORMAL;
}

function monitoringIntervals(priority = 'medium') {
  const normalized = priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium';
  return {
    low: { recheck: 120, sla: 240 },
    medium: { recheck: 60, sla: 120 },
    high: { recheck: 15, sla: 30 },
    critical: { recheck: 5, sla: 5 },
  }[normalized];
}

function doctorNotificationSla(priority = 'routine') {
  return {
    routine: 120,
    urgent: 15,
    stat: 5,
    critical: 3,
  }[priority] || 60;
}

function sourceTitle(sourceType) {
  return {
    manual: 'Theo dõi thủ công',
    abnormal_vital: 'Sinh hiệu bất thường',
    post_procedure: 'Sau thủ thuật',
    post_medication: 'Sau dùng thuốc',
    doctor_request: 'Yêu cầu bác sĩ',
    lab_critical: 'Lab critical',
    imaging_critical: 'CĐHA critical',
  }[sourceType] || 'Theo dõi lâm sàng';
}

function applyDepartmentScope(filter, query = {}, actor = {}) {
  const departmentId = query.department_id || query.departmentId || actorDepartmentId(actor);
  if (departmentId && String(departmentId).toLowerCase() !== 'all') {
    filter.department_id = toObjectId(departmentId, 'department_id');
  }
  return filter;
}

function baseDateRange(query = {}) {
  const date = parseDate(query.date, 'date') || new Date();
  const start = query.from ? parseDate(query.from, 'from') : getStartOfDay(date);
  const end = query.to ? parseDate(query.to, 'to') : getEndOfDay(date);
  return { date, start, end };
}

async function latestVitalsByEncounter(encounterIds = []) {
  const ids = [...new Set(encounterIds.map(normalizeId).filter(Boolean))].map((id) => toObjectId(id, 'encounter_id'));
  if (!ids.length) return new Map();
  const vitals = await VitalSign.find({ encounter_id: { $in: ids }, status: { $ne: 'entered_in_error' } })
    .sort({ recorded_at: -1, created_at: -1 })
    .populate('recorded_by', 'full_name employee_code')
    .lean();
  const map = new Map();
  for (const vital of vitals) {
    const key = normalizeId(vital.encounter_id);
    if (!map.has(key)) map.set(key, vital);
  }
  return map;
}

async function criticalLabEncounterSet(encounterIds = []) {
  const ids = [...new Set(encounterIds.map(normalizeId).filter(Boolean))].map((id) => toObjectId(id, 'encounter_id'));
  if (!ids.length) return new Set();
  const results = await LabResult.find({ encounter_id: { $in: ids }, is_critical: true, critical_acknowledged_at: { $exists: false } })
    .select('encounter_id')
    .lean();
  return new Set(results.map((item) => normalizeId(item.encounter_id)).filter(Boolean));
}

async function criticalImagingEncounterSet(encounterIds = []) {
  const ids = [...new Set(encounterIds.map(normalizeId).filter(Boolean))].map((id) => toObjectId(id, 'encounter_id'));
  if (!ids.length) return new Set();
  const reports = await ImagingReport.find({ encounter_id: { $in: ids }, is_critical: true, critical_acknowledged_at: { $exists: false } })
    .select('encounter_id')
    .lean();
  return new Set(reports.map((item) => normalizeId(item.encounter_id)).filter(Boolean));
}

async function patientRiskMap(patientIds = []) {
  const ids = [...new Set(patientIds.map(normalizeId).filter(Boolean))].map((id) => toObjectId(id, 'patient_id'));
  if (!ids.length) return new Map();
  const [allergies, problems] = await Promise.all([
    Allergy.find({ patient_id: { $in: ids }, status: 'active' }).select('patient_id allergen severity reaction').lean(),
    ProblemList.find({ patient_id: { $in: ids }, status: 'active' }).select('patient_id problem_name severity').lean(),
  ]);
  const map = new Map();
  for (const id of ids) map.set(String(id), { allergies: [], problems: [] });
  for (const allergy of allergies) {
    const key = normalizeId(allergy.patient_id);
    if (!map.has(key)) map.set(key, { allergies: [], problems: [] });
    map.get(key).allergies.push(allergy);
  }
  for (const problem of problems) {
    const key = normalizeId(problem.patient_id);
    if (!map.has(key)) map.set(key, { allergies: [], problems: [] });
    map.get(key).problems.push(problem);
  }
  return map;
}

function formatMonitoringSession(session = {}, latestVital = null, risks = {}, now = new Date()) {
  const patient = patientDto(session.patient_id);
  const encounter = session.encounter_id && typeof session.encounter_id === 'object' ? session.encounter_id : {};
  const department = departmentDto(session.department_id || encounter.department_id);
  const doctor = userDto(session.attending_doctor_id || encounter.attending_doctor_id);
  const nurse = userDto(session.assigned_nurse_id);
  const vital = vitalDisplay(latestVital);
  const signals = riskFromSignals({
    vital: latestVital,
    labCritical: risks.labCritical,
    imagingCritical: risks.imagingCritical,
  });
  const priority = session.priority || priorityFromRisk(signals.level);

  return {
    id: normalizeId(session),
    monitoring_session_id: normalizeId(session),
    source: 'monitoring_session',
    patient,
    patient_id: patient.patient_id,
    patient_code: patient.patient_code,
    patient_name: patient.patient_name,
    encounter_id: normalizeId(encounter) || normalizeId(session.encounter_id),
    encounter_code: encounter.encounter_code || null,
    encounter_status: encounter.status || null,
    department,
    doctor,
    assigned_nurse: nurse,
    reason: session.reason,
    source_type: session.source_type,
    source_label: sourceTitle(session.source_type),
    priority,
    risk_level: signals.level,
    risk_score: Math.max(Number(session.risk_score || 0), signals.score),
    status: session.status,
    latest_vital: vital,
    risk_flags: [
      ...vitalFlags(latestVital).map((flag) => flag.message),
      ...(risks.labCritical ? ['Lab critical'] : []),
      ...(risks.imagingCritical ? ['CĐHA critical'] : []),
      ...(risks.allergies || []).filter((item) => ['severe', 'life_threatening'].includes(item.severity)).map((item) => `Dị ứng ${item.allergen}`),
    ],
    allergies: risks.allergies || [],
    problems: risks.problems || [],
    started_at: session.started_at,
    last_checked_at: session.last_checked_at,
    last_checked_minutes: session.last_checked_at ? minutesSince(session.last_checked_at, now) : null,
    next_check_at: session.next_check_at,
    next_check_minutes: minutesUntil(session.next_check_at, now),
    sla_due_at: session.sla_due_at,
    sla_minutes: minutesUntil(session.sla_due_at, now),
    sla_breached: isOverdue(session.sla_due_at, now),
    doctor_notified_at: session.doctor_notified_at,
    doctor_acknowledged_at: session.doctor_acknowledged_at,
    tags: session.tags || [],
    metadata: session.metadata || {},
    actions: ['record_vital', 'add_note', 'notify_doctor', 'create_emergency', 'mark_stable', 'open_timeline'],
  };
}

function formatEncounterMonitoringRow(encounter = {}, latestVital = null, risks = {}, now = new Date()) {
  const patient = patientDto(encounter.patient_id);
  const risk = riskFromSignals({
    vital: latestVital,
    labCritical: risks.labCritical,
    imagingCritical: risks.imagingCritical,
  });
  const priority = priorityFromRisk(risk.level);
  const flags = vitalFlags(latestVital);
  const latestRecordedAt = latestVital?.recorded_at || encounter.vital_recorded_at || encounter.start_time;
  const staleVital = !latestVital || minutesSince(latestRecordedAt, now) > 30;

  return {
    id: `encounter_${normalizeId(encounter)}`,
    source: 'encounter',
    monitoring_session_id: null,
    patient,
    patient_id: patient.patient_id,
    patient_code: patient.patient_code,
    patient_name: patient.patient_name,
    encounter_id: normalizeId(encounter),
    encounter_code: encounter.encounter_code,
    encounter_status: encounter.status,
    department: departmentDto(encounter.department_id),
    doctor: userDto(encounter.attending_doctor_id),
    assigned_nurse: userDto(encounter.assigned_nurse_id),
    reason: flags.length
      ? flags.slice(0, 2).map((flag) => flag.message).join(' · ')
      : encounter.chief_reason || 'Encounter đang cần điều dưỡng theo dõi',
    source_type: flags.length ? 'abnormal_vital' : 'manual',
    source_label: flags.length ? sourceTitle('abnormal_vital') : 'Encounter active',
    priority: staleVital && priority === 'low' ? 'medium' : priority,
    risk_level: staleVital && risk.level === 'low' ? 'medium' : risk.level,
    risk_score: staleVital ? Math.max(risk.score, 42) : risk.score,
    status: encounter.nursing_status || encounter.status,
    latest_vital: vitalDisplay(latestVital),
    risk_flags: [
      ...flags.map((flag) => flag.message),
      ...(staleVital ? ['Cần đo lại sinh hiệu'] : []),
      ...(risks.labCritical ? ['Lab critical'] : []),
      ...(risks.imagingCritical ? ['CĐHA critical'] : []),
      ...(risks.allergies || []).filter((item) => ['severe', 'life_threatening'].includes(item.severity)).map((item) => `Dị ứng ${item.allergen}`),
    ],
    allergies: risks.allergies || [],
    problems: risks.problems || [],
    started_at: encounter.start_time,
    last_checked_at: latestRecordedAt,
    last_checked_minutes: latestRecordedAt ? minutesSince(latestRecordedAt, now) : null,
    next_check_at: staleVital ? now.toISOString() : addMinutes(new Date(latestRecordedAt), monitoringIntervals(priority).recheck).toISOString(),
    next_check_minutes: staleVital ? -1 : minutesUntil(addMinutes(new Date(latestRecordedAt), monitoringIntervals(priority).recheck), now),
    sla_due_at: null,
    sla_minutes: null,
    sla_breached: staleVital && minutesSince(latestRecordedAt, now) > 45,
    doctor_notified_at: latestVital?.doctor_notified_at || null,
    doctor_acknowledged_at: null,
    tags: flags.length ? ['abnormal_vital'] : ['active_encounter'],
    metadata: {},
    actions: ['start_monitoring', 'record_vital', 'add_note', 'notify_doctor', 'create_emergency', 'open_timeline'],
  };
}

async function listMonitoringSessions(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query, 40, 120);
  const filter = {};
  const statuses = splitList(query.status, OPEN_MONITORING_STATUSES);
  if (!statuses.includes('all')) filter.status = { $in: statuses };
  if (query.priority && query.priority !== 'all') filter.priority = query.priority;
  if (query.source_type && query.source_type !== 'all') filter.source_type = query.source_type;
  if (query.assigned_nurse_id === 'me') filter.assigned_nurse_id = toObjectId(actorUserId(actor), 'assigned_nurse_id');
  else if (query.assigned_nurse_id) filter.assigned_nurse_id = toObjectId(query.assigned_nurse_id, 'assigned_nurse_id');
  if (query.encounter_id) filter.encounter_id = toObjectId(query.encounter_id, 'encounter_id');
  if (query.patient_id) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  applyDepartmentScope(filter, query, actor);

  const [items, total] = await Promise.all([
    NursingMonitoringSession.find(filter)
      .sort({ priority: 1, next_check_at: 1, started_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('encounter_id', 'encounter_code status start_time chief_reason attending_doctor_id department_id')
      .populate('assigned_nurse_id', 'full_name employee_code')
      .populate('attending_doctor_id', 'full_name employee_code')
      .populate('department_id', 'department_name department_code')
      .lean(),
    NursingMonitoringSession.countDocuments(filter),
  ]);
  const encounterIds = items.map((item) => item.encounter_id).map(normalizeId).filter(Boolean);
  const patientIds = items.map((item) => item.patient_id).map(normalizeId).filter(Boolean);
  const [vitalMap, labSet, imagingSet, riskMap] = await Promise.all([
    latestVitalsByEncounter(encounterIds),
    criticalLabEncounterSet(encounterIds),
    criticalImagingEncounterSet(encounterIds),
    patientRiskMap(patientIds),
  ]);
  const now = new Date();
  return {
    items: items.map((item) => formatMonitoringSession(item, vitalMap.get(normalizeId(item.encounter_id)), {
      labCritical: labSet.has(normalizeId(item.encounter_id)),
      imagingCritical: imagingSet.has(normalizeId(item.encounter_id)),
      ...(riskMap.get(normalizeId(item.patient_id)) || {}),
    }, now)),
    pagination: buildPagination(page, limit, total),
  };
}

async function getMonitoringCommandCenter(query = {}, actor = {}) {
  const { start, end } = baseDateRange(query);
  const now = new Date();
  const departmentFilter = {};
  applyDepartmentScope(departmentFilter, query, actor);

  const [sessionsResult, activeEncounters, openDoctorNotifications, openAlerts, completedProcedures, medicationAdministrations, emergencyCases] = await Promise.all([
    listMonitoringSessions({ ...query, status: query.status || OPEN_MONITORING_STATUSES.join(','), limit: query.limit || 160 }, actor),
    Encounter.find({
      ...departmentFilter,
      status: { $in: ACTIVE_ENCOUNTER_STATUSES },
      start_time: { $gte: start, $lte: end },
    })
      .sort({ start_time: 1 })
      .limit(200)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('attending_doctor_id', 'full_name employee_code')
      .populate('assigned_nurse_id', 'full_name employee_code')
      .populate('department_id', 'department_name department_code')
      .lean(),
    DoctorNotificationRequest.find({ ...departmentFilter, status: { $in: OPEN_DOCTOR_NOTIFICATION_STATUSES } })
      .sort({ priority: -1, created_at: -1 })
      .limit(80)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('to_doctor_id', 'full_name employee_code')
      .populate('from_nurse_id', 'full_name employee_code')
      .lean(),
    ClinicalAlert.find({ ...departmentFilter, status: { $in: OPEN_ALERT_STATUSES } })
      .sort({ severity: -1, created_at: -1 })
      .limit(120)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('assigned_to_user_id', 'full_name employee_code')
      .lean(),
    ProcedureOrder.find({ ...departmentFilter, status: 'completed', completed_at: { $gte: new Date(now.getTime() - RECENT_HOURS * 3600000) } })
      .sort({ completed_at: -1 })
      .limit(80)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('performer_id', 'full_name employee_code')
      .populate('department_id', 'department_name department_code')
      .lean(),
    MedicationAdministration.find({
      status: { $in: ['given', 'held', 'refused', 'omitted'] },
      $or: [
        { administered_at: { $gte: new Date(now.getTime() - RECENT_HOURS * 3600000) } },
        { scheduled_at: { $gte: new Date(now.getTime() - RECENT_HOURS * 3600000) } },
      ],
    })
      .sort({ administered_at: -1, scheduled_at: -1 })
      .limit(80)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('medication_id', 'generic_name brand_name strength route_default')
      .populate('administered_by', 'full_name employee_code')
      .lean(),
    EmergencyCase.find({ status: { $in: OPEN_EMERGENCY_STATUSES } })
      .sort({ priority: -1, created_at: -1 })
      .limit(80)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('assigned_to_user_id', 'full_name employee_code')
      .populate('assigned_department_id', 'department_name department_code')
      .lean(),
  ]);

  const sessionEncounterIds = new Set(sessionsResult.items.map((item) => item.encounter_id).filter(Boolean));
  const encounterIds = activeEncounters.map(normalizeId).filter(Boolean);
  const patientIds = activeEncounters.map((item) => item.patient_id).map(normalizeId).filter(Boolean);
  const [vitalMap, labSet, imagingSet, riskMap] = await Promise.all([
    latestVitalsByEncounter(encounterIds),
    criticalLabEncounterSet(encounterIds),
    criticalImagingEncounterSet(encounterIds),
    patientRiskMap(patientIds),
  ]);

  const derivedRows = activeEncounters
    .filter((encounter) => !sessionEncounterIds.has(normalizeId(encounter)))
    .map((encounter) => formatEncounterMonitoringRow(encounter, vitalMap.get(normalizeId(encounter)), {
      labCritical: labSet.has(normalizeId(encounter)),
      imagingCritical: imagingSet.has(normalizeId(encounter)),
      ...(riskMap.get(normalizeId(encounter.patient_id)) || {}),
    }, now));

  const monitoringRows = [...sessionsResult.items, ...derivedRows]
    .sort((a, b) => {
      const rank = { critical: 4, high: 3, medium: 2, low: 1 };
      return (rank[b.priority] || 0) - (rank[a.priority] || 0)
        || Number(b.sla_breached) - Number(a.sla_breached)
        || (a.next_check_minutes ?? 9999) - (b.next_check_minutes ?? 9999);
    });

  const doctorRows = openDoctorNotifications.map(formatDoctorNotification);
  const alertRows = openAlerts.map(formatClinicalAlert);
  const procedureRows = await attachLatestProcedureObservations(completedProcedures);
  const medicationRows = await attachLatestMedicationReactions(medicationAdministrations);
  const emergencyRows = emergencyCases.map(formatEmergencyCase);

  return {
    meta: {
      generated_at: now.toISOString(),
      realtime: true,
      refresh_seconds: 5,
      source: 'nursing-clinical-command',
    },
    kpis: {
      total_monitoring: monitoringRows.length,
      critical: monitoringRows.filter((item) => item.priority === 'critical').length + alertRows.filter((item) => item.severity === 'critical').length,
      needs_vital_recheck: monitoringRows.filter((item) => item.latest_vital?.requires_recheck || item.risk_flags.includes('Cần đo lại sinh hiệu')).length,
      doctor_waiting: doctorRows.filter((item) => ['sent', 'delivered', 'seen', 'acknowledged', 'escalated'].includes(item.status)).length,
      sla_breached: monitoringRows.filter((item) => item.sla_breached).length + doctorRows.filter((item) => item.sla_breached).length + alertRows.filter((item) => item.sla_breached).length,
      post_procedure: procedureRows.length,
      post_medication: medicationRows.length,
      medication_reactions: medicationRows.filter((item) => item.latest_reaction).length,
      emergency_open: emergencyRows.length,
    },
    monitoring: {
      items: monitoringRows,
      pagination: sessionsResult.pagination,
    },
    alerts: {
      items: alertRows,
      summary: buildAlertSummary(alertRows),
    },
    doctor_notifications: {
      items: doctorRows,
      summary: buildDoctorNotificationSummary(doctorRows),
    },
    post_procedure: {
      items: procedureRows,
      summary: buildPostProcedureSummary(procedureRows),
    },
    post_medication: {
      items: medicationRows,
      summary: buildMedicationSummary(medicationRows),
    },
    emergency: {
      items: emergencyRows,
      summary: buildEmergencySummary(emergencyRows),
    },
  };
}

async function createMonitoringSession(payload = {}, actor = {}, requestMeta = {}) {
  const encounter = payload.encounter_id
    ? await Encounter.findById(payload.encounter_id).lean()
    : null;
  if (payload.encounter_id && !encounter) throw createError('Không tìm thấy encounter.', 404);
  const patientId = payload.patient_id || encounter?.patient_id;
  if (!patientId) throw createError('patient_id hoặc encounter_id là bắt buộc.', 400);
  const priority = payload.priority || 'medium';
  const intervals = monitoringIntervals(priority);
  const now = new Date();
  const session = await NursingMonitoringSession.create({
    patient_id: toObjectId(patientId, 'patient_id'),
    encounter_id: toObjectId(payload.encounter_id || encounter?._id, 'encounter_id'),
    admission_id: payload.admission_id ? toObjectId(payload.admission_id, 'admission_id') : undefined,
    source_type: payload.source_type || 'manual',
    source_id: payload.source_id ? toObjectId(payload.source_id, 'source_id') : undefined,
    reason: payload.reason || sourceTitle(payload.source_type || 'manual'),
    priority,
    risk_score: payload.risk_score || 0,
    status: payload.status || 'active',
    assigned_nurse_id: payload.assigned_nurse_id ? toObjectId(payload.assigned_nurse_id, 'assigned_nurse_id') : actorUserId(actor),
    attending_doctor_id: payload.attending_doctor_id || encounter?.attending_doctor_id,
    department_id: payload.department_id || encounter?.department_id || actorDepartmentId(actor),
    started_at: payload.started_at ? parseDate(payload.started_at, 'started_at') : now,
    last_checked_at: payload.last_checked_at ? parseDate(payload.last_checked_at, 'last_checked_at') : undefined,
    next_check_at: payload.next_check_at ? parseDate(payload.next_check_at, 'next_check_at') : addMinutes(now, intervals.recheck),
    sla_due_at: payload.sla_due_at ? parseDate(payload.sla_due_at, 'sla_due_at') : addMinutes(now, intervals.sla),
    tags: payload.tags || [],
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({
    actor,
    action: 'nursing.monitoring.create',
    targetType: 'nursing_monitoring_session',
    targetId: session._id,
    status: 'success',
    message: 'Tạo phiên theo dõi điều dưỡng.',
    requestMeta,
  });
  return getMonitoringSession(session._id, actor);
}

async function getMonitoringSession(monitoringId, actor = {}) {
  const item = await NursingMonitoringSession.findById(monitoringId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('encounter_id', 'encounter_code status start_time chief_reason attending_doctor_id department_id')
    .populate('assigned_nurse_id', 'full_name employee_code')
    .populate('attending_doctor_id', 'full_name employee_code')
    .populate('department_id', 'department_name department_code')
    .lean();
  if (!item) throw createError('Không tìm thấy phiên theo dõi.', 404);
  const [vitalMap, labSet, imagingSet, riskMap] = await Promise.all([
    latestVitalsByEncounter([item.encounter_id]),
    criticalLabEncounterSet([item.encounter_id]),
    criticalImagingEncounterSet([item.encounter_id]),
    patientRiskMap([item.patient_id]),
  ]);
  return formatMonitoringSession(item, vitalMap.get(normalizeId(item.encounter_id)), {
    labCritical: labSet.has(normalizeId(item.encounter_id)),
    imagingCritical: imagingSet.has(normalizeId(item.encounter_id)),
    ...(riskMap.get(normalizeId(item.patient_id)) || {}),
  });
}

async function updateMonitoringSession(monitoringId, payload = {}, actor = {}, requestMeta = {}) {
  const session = await NursingMonitoringSession.findById(monitoringId);
  if (!session) throw createError('Không tìm thấy phiên theo dõi.', 404);
  [
    'reason',
    'priority',
    'risk_score',
    'status',
    'tags',
    'metadata',
  ].forEach((field) => {
    if (payload[field] !== undefined) session[field] = payload[field];
  });
  if (payload.assigned_nurse_id !== undefined) session.assigned_nurse_id = payload.assigned_nurse_id ? toObjectId(payload.assigned_nurse_id, 'assigned_nurse_id') : undefined;
  if (payload.attending_doctor_id) session.attending_doctor_id = toObjectId(payload.attending_doctor_id, 'attending_doctor_id');
  if (payload.department_id) session.department_id = toObjectId(payload.department_id, 'department_id');
  if (payload.next_check_at) session.next_check_at = parseDate(payload.next_check_at, 'next_check_at');
  if (payload.sla_due_at) session.sla_due_at = parseDate(payload.sla_due_at, 'sla_due_at');
  session.updated_by = actorUserId(actor);
  await session.save();
  await recordAuditLog({
    actor,
    action: 'nursing.monitoring.update',
    targetType: 'nursing_monitoring_session',
    targetId: session._id,
    status: 'success',
    message: 'Cập nhật phiên theo dõi điều dưỡng.',
    requestMeta,
  });
  return getMonitoringSession(session._id, actor);
}

async function addMonitoringCheck(monitoringId, payload = {}, actor = {}, requestMeta = {}) {
  const session = await NursingMonitoringSession.findById(monitoringId);
  if (!session) throw createError('Không tìm thấy phiên theo dõi.', 404);
  const checkedAt = payload.checked_at ? parseDate(payload.checked_at, 'checked_at') : new Date();
  const check = await NursingMonitoringCheck.create({
    monitoring_session_id: session._id,
    patient_id: session.patient_id,
    encounter_id: session.encounter_id,
    checked_by: actorUserId(actor),
    checked_at: checkedAt,
    subjective_note: payload.subjective_note,
    objective_note: payload.objective_note,
    intervention_note: payload.intervention_note,
    vital_sign_id: payload.vital_sign_id ? toObjectId(payload.vital_sign_id, 'vital_sign_id') : undefined,
    pain_score: payload.pain_score,
    consciousness: payload.consciousness,
    warning_flags: payload.warning_flags || [],
    next_check_at: payload.next_check_at ? parseDate(payload.next_check_at, 'next_check_at') : undefined,
    need_doctor_notification: Boolean(payload.need_doctor_notification),
    status_after_check: payload.status_after_check || 'watching',
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });

  session.last_checked_at = checkedAt;
  session.next_check_at = check.next_check_at || addMinutes(checkedAt, monitoringIntervals(session.priority).recheck);
  if (check.status_after_check === 'stable') session.status = 'stable';
  if (check.status_after_check === 'critical') {
    session.status = 'escalated';
    session.priority = 'critical';
    session.escalated_at = session.escalated_at || new Date();
  } else if (session.status === 'active') {
    session.status = 'watching';
  }
  session.updated_by = actorUserId(actor);

  if (payload.need_doctor_notification && payload.send_doctor_notification) {
    const request = await createDoctorNotificationRequest({
      patient_id: session.patient_id,
      encounter_id: session.encounter_id,
      to_doctor_id: session.attending_doctor_id,
      department_id: session.department_id,
      priority: session.priority === 'critical' ? 'critical' : 'urgent',
      category: 'manual',
      related_alert_id: payload.related_alert_id,
      latest_vital_sign_id: payload.vital_sign_id,
      sbar: payload.sbar || {
        situation: payload.subjective_note || session.reason,
        background: session.reason,
        assessment: payload.objective_note || payload.intervention_note,
        recommendation: 'Bác sĩ vui lòng đánh giá và phản hồi hướng xử trí.',
      },
      send: true,
    }, actor, requestMeta);
    check.doctor_notification_request_id = request.doctor_notification_request_id || request.id;
    session.doctor_notified_at = new Date();
    session.status = 'doctor_notified';
  }

  await Promise.all([check.save(), session.save()]);
  await recordAuditLog({
    actor,
    action: 'nursing.monitoring.check',
    targetType: 'nursing_monitoring_session',
    targetId: session._id,
    status: 'success',
    message: 'Ghi nhận check theo dõi điều dưỡng.',
    requestMeta,
  });
  return {
    session: await getMonitoringSession(session._id, actor),
    check,
  };
}

async function assignMonitoringSession(monitoringId, payload = {}, actor = {}, requestMeta = {}) {
  return updateMonitoringSession(monitoringId, {
    assigned_nurse_id: payload.assigned_nurse_id || actorUserId(actor),
  }, actor, requestMeta);
}

async function notifyDoctorFromMonitoring(monitoringId, payload = {}, actor = {}, requestMeta = {}) {
  const session = await NursingMonitoringSession.findById(monitoringId).lean();
  if (!session) throw createError('Không tìm thấy phiên theo dõi.', 404);
  const request = await createDoctorNotificationRequest({
    patient_id: session.patient_id,
    encounter_id: session.encounter_id,
    to_doctor_id: payload.to_doctor_id || session.attending_doctor_id,
    department_id: session.department_id,
    priority: payload.priority || (session.priority === 'critical' ? 'critical' : 'urgent'),
    category: payload.category || session.source_type || 'manual',
    latest_vital_sign_id: payload.latest_vital_sign_id,
    related_alert_id: payload.related_alert_id,
    sbar: payload.sbar || {
      situation: payload.message || session.reason,
      background: payload.background || sourceTitle(session.source_type),
      assessment: payload.assessment || 'Điều dưỡng đang theo dõi sát.',
      recommendation: payload.recommendation || 'Bác sĩ vui lòng phản hồi hướng xử trí.',
    },
    send: true,
  }, actor, requestMeta);
  await NursingMonitoringSession.updateOne({ _id: session._id }, {
    $set: {
      status: 'doctor_notified',
      doctor_notified_at: new Date(),
      updated_by: actorUserId(actor),
    },
  });
  return request;
}

async function escalateMonitoringSession(monitoringId, payload = {}, actor = {}, requestMeta = {}) {
  const session = await NursingMonitoringSession.findById(monitoringId);
  if (!session) throw createError('Không tìm thấy phiên theo dõi.', 404);
  session.status = 'escalated';
  session.priority = 'critical';
  session.escalated_at = new Date();
  session.updated_by = actorUserId(actor);
  await session.save();
  const alert = await createClinicalAlert({
    patient_id: session.patient_id,
    encounter_id: session.encounter_id,
    source_type: 'manual',
    source_id: session._id,
    title: payload.title || 'Phiên theo dõi được escalation',
    message: payload.reason || session.reason,
    severity: 'critical',
    department_id: session.department_id,
    assigned_to_user_id: session.assigned_nurse_id,
  }, actor, requestMeta);
  await recordAuditLog({
    actor,
    action: 'nursing.monitoring.escalate',
    targetType: 'nursing_monitoring_session',
    targetId: session._id,
    status: 'success',
    message: 'Escalate phiên theo dõi điều dưỡng.',
    requestMeta,
  });
  return { session: await getMonitoringSession(session._id, actor), alert };
}

async function updateMonitoringTerminalStatus(monitoringId, status, payload = {}, actor = {}, requestMeta = {}) {
  const session = await NursingMonitoringSession.findById(monitoringId);
  if (!session) throw createError('Không tìm thấy phiên theo dõi.', 404);
  session.status = status;
  if (status === 'stable') session.last_checked_at = session.last_checked_at || new Date();
  if (status === 'resolved') session.resolved_at = new Date();
  if (status === 'cancelled') {
    session.cancelled_at = new Date();
    session.cancel_reason = payload.reason || payload.cancel_reason;
  }
  session.updated_by = actorUserId(actor);
  await session.save();
  await recordAuditLog({
    actor,
    action: `nursing.monitoring.${status}`,
    targetType: 'nursing_monitoring_session',
    targetId: session._id,
    status: 'success',
    message: 'Cập nhật trạng thái phiên theo dõi điều dưỡng.',
    requestMeta,
  });
  return getMonitoringSession(session._id, actor);
}

async function getMonitoringTimeline(monitoringId, actor = {}) {
  const session = await NursingMonitoringSession.findById(monitoringId).lean();
  if (!session) throw createError('Không tìm thấy phiên theo dõi.', 404);
  const [checks, notes, vitals, alerts, notifications] = await Promise.all([
    NursingMonitoringCheck.find({ monitoring_session_id: session._id }).sort({ checked_at: -1 }).populate('checked_by', 'full_name employee_code').lean(),
    ClinicalNote.find({ encounter_id: session.encounter_id }).sort({ created_at: -1 }).limit(30).populate('author_id', 'full_name employee_code').lean(),
    VitalSign.find({ encounter_id: session.encounter_id, status: { $ne: 'entered_in_error' } }).sort({ recorded_at: -1 }).limit(30).populate('recorded_by', 'full_name employee_code').lean(),
    ClinicalAlert.find({ encounter_id: session.encounter_id }).sort({ created_at: -1 }).limit(30).lean(),
    DoctorNotificationRequest.find({ encounter_id: session.encounter_id }).sort({ created_at: -1 }).limit(30).populate('to_doctor_id', 'full_name employee_code').lean(),
  ]);
  const items = [
    ...checks.map((item) => ({ type: 'monitoring_check', at: item.checked_at, title: `Check: ${item.status_after_check}`, body: item.objective_note || item.subjective_note, actor: userDto(item.checked_by), raw: item })),
    ...notes.map((item) => ({ type: 'clinical_note', at: item.signed_at || item.created_at, title: item.title || item.note_type, body: item.content, actor: userDto(item.author_id), raw: item })),
    ...vitals.map((item) => ({ type: 'vital_sign', at: item.recorded_at, title: 'Sinh hiệu', body: vitalFlags(item).map((flag) => flag.message).join(' · ') || 'Bản ghi sinh hiệu', actor: userDto(item.recorded_by), raw: vitalDisplay(item) })),
    ...alerts.map((item) => ({ type: 'clinical_alert', at: item.created_at, title: item.title, body: item.message, raw: formatClinicalAlert(item) })),
    ...notifications.map((item) => ({ type: 'doctor_notification', at: item.sent_at || item.created_at, title: item.request_no, body: item.sbar?.situation, actor: userDto(item.to_doctor_id), raw: formatDoctorNotification(item) })),
  ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
  return { monitoring_session_id: normalizeId(session), items };
}

async function generateDoctorRequestNo() {
  return codeGeneratorService.generateSequenceCode(DoctorNotificationRequest, 'request_no', 'DNR', {
    separator: '-',
    sequenceWidth: 4,
  });
}

function formatSbarContent(request = {}) {
  const sbar = request.sbar || {};
  return [
    `S - Situation: ${sbar.situation || 'Chưa ghi nhận.'}`,
    `B - Background: ${sbar.background || 'Chưa ghi nhận.'}`,
    `A - Assessment: ${sbar.assessment || 'Chưa ghi nhận.'}`,
    `R - Recommendation: ${sbar.recommendation || 'Chưa ghi nhận.'}`,
  ].join('\n');
}

function formatDoctorNotification(item = {}) {
  const patient = patientDto(item.patient_id);
  const now = new Date();
  return {
    id: normalizeId(item),
    doctor_notification_request_id: normalizeId(item),
    request_no: item.request_no,
    patient,
    patient_id: patient.patient_id,
    patient_code: patient.patient_code,
    patient_name: patient.patient_name,
    encounter_id: normalizeId(item.encounter_id),
    from_nurse: userDto(item.from_nurse_id),
    to_doctor: userDto(item.to_doctor_id),
    department: departmentDto(item.department_id),
    priority: item.priority,
    category: item.category,
    sbar: item.sbar || {},
    status: item.status,
    sent_at: item.sent_at,
    delivered_at: item.delivered_at,
    seen_at: item.seen_at,
    acknowledged_at: item.acknowledged_at,
    responded_at: item.responded_at,
    closed_at: item.closed_at,
    doctor_response: item.doctor_response,
    notification_id: normalizeId(item.notification_id),
    sla_due_at: item.sla_due_at,
    sla_minutes: minutesUntil(item.sla_due_at, now),
    sla_breached: Boolean(item.breached_at || (item.sla_due_at && isOverdue(item.sla_due_at, now) && !['responded', 'closed', 'cancelled'].includes(item.status))),
    escalation_level: item.escalation_level || 0,
    escalated_at: item.escalated_at,
    metadata: item.metadata || {},
  };
}

async function createDoctorNotificationRequest(payload = {}, actor = {}, requestMeta = {}) {
  const encounter = payload.encounter_id ? await Encounter.findById(payload.encounter_id).lean() : null;
  if (payload.encounter_id && !encounter) throw createError('Không tìm thấy encounter.', 404);
  const patientId = payload.patient_id || encounter?.patient_id;
  if (!patientId) throw createError('patient_id hoặc encounter_id là bắt buộc.', 400);
  const priority = payload.priority || 'urgent';
  const now = new Date();
  const request = await DoctorNotificationRequest.create({
    request_no: await generateDoctorRequestNo(),
    patient_id: toObjectId(patientId, 'patient_id'),
    encounter_id: payload.encounter_id ? toObjectId(payload.encounter_id, 'encounter_id') : undefined,
    admission_id: payload.admission_id ? toObjectId(payload.admission_id, 'admission_id') : undefined,
    from_nurse_id: payload.from_nurse_id ? toObjectId(payload.from_nurse_id, 'from_nurse_id') : toObjectId(actorUserId(actor), 'from_nurse_id'),
    to_doctor_id: payload.to_doctor_id || encounter?.attending_doctor_id,
    department_id: payload.department_id || encounter?.department_id || actorDepartmentId(actor),
    priority,
    category: payload.category || 'manual',
    sbar: payload.sbar || {},
    latest_vital_sign_id: payload.latest_vital_sign_id ? toObjectId(payload.latest_vital_sign_id, 'latest_vital_sign_id') : undefined,
    related_note_id: payload.related_note_id ? toObjectId(payload.related_note_id, 'related_note_id') : undefined,
    related_order_id: payload.related_order_id ? toObjectId(payload.related_order_id, 'related_order_id') : undefined,
    related_procedure_order_id: payload.related_procedure_order_id ? toObjectId(payload.related_procedure_order_id, 'related_procedure_order_id') : undefined,
    related_medication_administration_id: payload.related_medication_administration_id ? toObjectId(payload.related_medication_administration_id, 'related_medication_administration_id') : undefined,
    related_lab_result_id: payload.related_lab_result_id ? toObjectId(payload.related_lab_result_id, 'related_lab_result_id') : undefined,
    related_imaging_report_id: payload.related_imaging_report_id ? toObjectId(payload.related_imaging_report_id, 'related_imaging_report_id') : undefined,
    related_alert_id: payload.related_alert_id ? toObjectId(payload.related_alert_id, 'related_alert_id') : undefined,
    related_emergency_case_id: payload.related_emergency_case_id ? toObjectId(payload.related_emergency_case_id, 'related_emergency_case_id') : undefined,
    status: payload.status || 'draft',
    sla_due_at: payload.sla_due_at ? parseDate(payload.sla_due_at, 'sla_due_at') : addMinutes(now, doctorNotificationSla(priority)),
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({
    actor,
    action: 'nursing.doctor_notification.create',
    targetType: 'doctor_notification_request',
    targetId: request._id,
    status: 'success',
    message: 'Tạo yêu cầu báo bác sĩ.',
    requestMeta,
  });
  if (payload.send) return sendDoctorNotificationRequest(request._id, {}, actor, requestMeta);
  return getDoctorNotificationRequest(request._id, actor);
}

async function listDoctorNotifications(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query, 40, 120);
  const filter = {};
  const statuses = splitList(query.status, OPEN_DOCTOR_NOTIFICATION_STATUSES);
  if (!statuses.includes('all')) filter.status = { $in: statuses };
  if (query.priority && query.priority !== 'all') filter.priority = query.priority;
  if (query.category && query.category !== 'all') filter.category = query.category;
  if (query.to_doctor_id === 'me') filter.to_doctor_id = toObjectId(actorUserId(actor), 'to_doctor_id');
  else if (query.to_doctor_id) filter.to_doctor_id = toObjectId(query.to_doctor_id, 'to_doctor_id');
  if (query.from_nurse_id === 'me') filter.from_nurse_id = toObjectId(actorUserId(actor), 'from_nurse_id');
  else if (query.from_nurse_id) filter.from_nurse_id = toObjectId(query.from_nurse_id, 'from_nurse_id');
  if (query.patient_id) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  if (query.encounter_id) filter.encounter_id = toObjectId(query.encounter_id, 'encounter_id');
  applyDepartmentScope(filter, query, actor);
  const [items, total] = await Promise.all([
    DoctorNotificationRequest.find(filter)
      .sort({ sla_due_at: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('from_nurse_id', 'full_name employee_code')
      .populate('to_doctor_id', 'full_name employee_code')
      .populate('department_id', 'department_name department_code')
      .lean(),
    DoctorNotificationRequest.countDocuments(filter),
  ]);
  return {
    items: items.map(formatDoctorNotification),
    pagination: buildPagination(page, limit, total),
    summary: buildDoctorNotificationSummary(items.map(formatDoctorNotification)),
  };
}

async function getDoctorNotificationRequest(requestId, actor = {}) {
  const request = await DoctorNotificationRequest.findById(requestId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('from_nurse_id', 'full_name employee_code')
    .populate('to_doctor_id', 'full_name employee_code')
    .populate('department_id', 'department_name department_code')
    .lean();
  if (!request) throw createError('Không tìm thấy yêu cầu báo bác sĩ.', 404);
  return formatDoctorNotification(request);
}

async function updateDoctorNotificationRequest(requestId, payload = {}, actor = {}, requestMeta = {}) {
  const request = await DoctorNotificationRequest.findById(requestId);
  if (!request) throw createError('Không tìm thấy yêu cầu báo bác sĩ.', 404);
  ['priority', 'category', 'sbar', 'metadata'].forEach((field) => {
    if (payload[field] !== undefined) request[field] = payload[field];
  });
  if (payload.to_doctor_id) request.to_doctor_id = toObjectId(payload.to_doctor_id, 'to_doctor_id');
  if (payload.sla_due_at) request.sla_due_at = parseDate(payload.sla_due_at, 'sla_due_at');
  request.updated_by = actorUserId(actor);
  await request.save();
  await recordAuditLog({
    actor,
    action: 'nursing.doctor_notification.update',
    targetType: 'doctor_notification_request',
    targetId: request._id,
    status: 'success',
    message: 'Cập nhật yêu cầu báo bác sĩ.',
    requestMeta,
  });
  return getDoctorNotificationRequest(request._id, actor);
}

async function sendDoctorNotificationRequest(requestId, payload = {}, actor = {}, requestMeta = {}) {
  const request = await DoctorNotificationRequest.findById(requestId);
  if (!request) throw createError('Không tìm thấy yêu cầu báo bác sĩ.', 404);
  if (!request.to_doctor_id && !payload.to_doctor_id) throw createError('Yêu cầu báo bác sĩ chưa có bác sĩ nhận.', 400);
  if (payload.to_doctor_id) request.to_doctor_id = toObjectId(payload.to_doctor_id, 'to_doctor_id');

  let note = null;
  if (request.encounter_id && !request.related_note_id) {
    note = await ClinicalNote.create({
      encounter_id: request.encounter_id,
      author_id: request.from_nurse_id || actorUserId(actor),
      note_type: 'doctor_notification_note',
      title: `SBAR ${request.request_no}`,
      content: formatSbarContent(request),
      priority: ['critical', 'stat'].includes(request.priority) ? 'urgent' : 'important',
      visibility: 'care_team',
      notified_doctor_id: request.to_doctor_id,
      doctor_notified_at: new Date(),
      doctor_response_status: 'pending',
      status: CLINICAL_NOTE_STATUS.SIGNED,
      signed_by: request.from_nurse_id || actorUserId(actor),
      signed_at: new Date(),
      created_by: actorUserId(actor),
      updated_by: actorUserId(actor),
    });
    request.related_note_id = note._id;
  }

  const notification = await notificationService.createNotification({
    recipient_type: NOTIFICATION_RECIPIENT_TYPE.STAFF,
    recipient_user_id: request.to_doctor_id,
    patient_id: request.patient_id,
    channel: NOTIFICATION_CHANNEL.IN_APP,
    notification_type: 'nursing.doctor_notification.sent',
    event_type: 'nursing.doctor_notification.sent',
    priority: notificationPriority(request.priority),
    dedupe_key: `doctor_notification:${request._id}:doctor:${request.to_doctor_id}`,
    title: ['critical', 'stat'].includes(request.priority) ? 'Báo bác sĩ khẩn' : 'Điều dưỡng báo bác sĩ',
    message: request.sbar?.situation || 'Có yêu cầu SBAR từ điều dưỡng.',
    payload: {
      entity_type: 'doctor_notification_request',
      entity_id: String(request._id),
      request_no: request.request_no,
      encounter_id: normalizeId(request.encounter_id),
      patient_id: normalizeId(request.patient_id),
      priority: request.priority,
      route: `/nurse/monitoring-reporting/report-doctor?request=${request._id}`,
      action: 'review_sbar',
    },
    send_immediately: true,
    created_by_module: 'nursing',
  }, systemActor(actor, requestMeta), requestMeta);

  request.notification_id = notification?._id || notification?.id;
  request.status = 'sent';
  request.sent_at = request.sent_at || new Date();
  request.delivered_at = request.delivered_at || new Date();
  request.updated_by = actorUserId(actor);
  await request.save();
  await recordAuditLog({
    actor,
    action: 'nursing.doctor_notification.send',
    targetType: 'doctor_notification_request',
    targetId: request._id,
    status: 'success',
    message: 'Gửi yêu cầu báo bác sĩ.',
    requestMeta,
  });
  return getDoctorNotificationRequest(request._id, actor);
}

async function transitionDoctorNotification(requestId, action, payload = {}, actor = {}, requestMeta = {}) {
  const request = await DoctorNotificationRequest.findById(requestId);
  if (!request) throw createError('Không tìm thấy yêu cầu báo bác sĩ.', 404);
  const now = new Date();
  if (action === 'mark-seen') {
    request.status = ['responded', 'closed'].includes(request.status) ? request.status : 'seen';
    request.seen_at = request.seen_at || now;
    if (request.notification_id) {
      await Notification.updateOne({ _id: request.notification_id }, { $set: { status: NOTIFICATION_STATUS.READ, read_at: now } });
    }
  }
  if (action === 'acknowledge') {
    request.status = 'acknowledged';
    request.acknowledged_at = request.acknowledged_at || now;
    request.seen_at = request.seen_at || now;
  }
  if (action === 'respond') {
    request.status = 'responded';
    request.responded_at = now;
    request.doctor_response = payload.doctor_response || payload.response || request.doctor_response;
    if (request.encounter_id && payload.create_note !== false) {
      const note = await ClinicalNote.create({
        encounter_id: request.encounter_id,
        author_id: actorUserId(actor) || request.to_doctor_id,
        note_type: 'doctor_response_note',
        title: `Phản hồi ${request.request_no}`,
        content: request.doctor_response || 'Bác sĩ đã phản hồi yêu cầu.',
        priority: 'important',
        visibility: 'care_team',
        status: CLINICAL_NOTE_STATUS.SIGNED,
        signed_by: actorUserId(actor) || request.to_doctor_id,
        signed_at: now,
        created_by: actorUserId(actor),
        updated_by: actorUserId(actor),
      });
      request.response_note_id = note._id;
    }
  }
  if (action === 'escalate') {
    request.status = 'escalated';
    request.escalation_level = Number(request.escalation_level || 0) + 1;
    request.escalated_to_user_id = payload.escalated_to_user_id ? toObjectId(payload.escalated_to_user_id, 'escalated_to_user_id') : undefined;
    request.escalated_at = now;
    request.breached_at = request.breached_at || (isOverdue(request.sla_due_at, now) ? now : undefined);
  }
  if (action === 'close') {
    request.status = 'closed';
    request.closed_at = now;
  }
  if (action === 'cancel') {
    request.status = 'cancelled';
    request.cancelled_at = now;
    request.cancel_reason = payload.reason || payload.cancel_reason;
  }
  request.updated_by = actorUserId(actor);
  await request.save();
  await recordAuditLog({
    actor,
    action: `nursing.doctor_notification.${action}`,
    targetType: 'doctor_notification_request',
    targetId: request._id,
    status: 'success',
    message: 'Cập nhật workflow báo bác sĩ.',
    requestMeta,
  });
  return getDoctorNotificationRequest(request._id, actor);
}

async function getDoctorNotificationTimeline(requestId, actor = {}) {
  const request = await DoctorNotificationRequest.findById(requestId).populate('notification_id').lean();
  if (!request) throw createError('Không tìm thấy yêu cầu báo bác sĩ.', 404);
  const items = [
    { type: 'created', at: request.created_at, title: 'Tạo yêu cầu', body: request.sbar?.situation },
    request.sent_at ? { type: 'sent', at: request.sent_at, title: 'Đã gửi bác sĩ', body: request.request_no } : null,
    request.delivered_at ? { type: 'delivered', at: request.delivered_at, title: 'Notification delivered', body: normalizeId(request.notification_id) } : null,
    request.seen_at ? { type: 'seen', at: request.seen_at, title: 'Bác sĩ đã xem', body: null } : null,
    request.acknowledged_at ? { type: 'acknowledged', at: request.acknowledged_at, title: 'Bác sĩ đã nhận xử lý', body: null } : null,
    request.responded_at ? { type: 'responded', at: request.responded_at, title: 'Bác sĩ phản hồi', body: request.doctor_response } : null,
    request.escalated_at ? { type: 'escalated', at: request.escalated_at, title: 'Escalated', body: `Level ${request.escalation_level || 1}` } : null,
    request.closed_at ? { type: 'closed', at: request.closed_at, title: 'Đã đóng', body: null } : null,
  ].filter(Boolean).sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  return { doctor_notification_request_id: normalizeId(request), items };
}

function formatClinicalAlert(alert = {}) {
  const patient = patientDto(alert.patient_id);
  const now = new Date();
  return {
    id: normalizeId(alert),
    clinical_alert_id: normalizeId(alert),
    patient,
    patient_id: patient.patient_id,
    patient_code: patient.patient_code,
    patient_name: patient.patient_name,
    encounter_id: normalizeId(alert.encounter_id),
    source_type: alert.source_type,
    source_id: normalizeId(alert.source_id),
    rule_code: alert.rule_code,
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
    status: alert.status,
    assigned_to: userDto(alert.assigned_to_user_id),
    department: departmentDto(alert.department_id),
    acknowledged_at: alert.acknowledged_at,
    doctor_notification_request_id: normalizeId(alert.doctor_notification_request_id),
    doctor_notified_at: alert.doctor_notified_at,
    escalated_at: alert.escalated_at,
    resolved_at: alert.resolved_at,
    sla_due_at: alert.sla_due_at,
    sla_minutes: minutesUntil(alert.sla_due_at, now),
    sla_breached: Boolean(alert.breached_at || (alert.sla_due_at && isOverdue(alert.sla_due_at, now) && !['resolved', 'dismissed'].includes(alert.status))),
    metadata: alert.metadata || {},
    created_at: alert.created_at,
    actions: ['acknowledge', 'notify_doctor', 'escalate', 'resolve', 'dismiss'],
  };
}

async function createClinicalAlert(payload = {}, actor = {}, requestMeta = {}) {
  const alert = await ClinicalAlert.findOneAndUpdate(
    payload.source_type && payload.source_id
      ? { source_type: payload.source_type, source_id: toObjectId(payload.source_id, 'source_id'), status: { $in: OPEN_ALERT_STATUSES } }
      : { _id: new Types.ObjectId() },
    {
      $setOnInsert: {
        patient_id: toObjectId(payload.patient_id, 'patient_id'),
        encounter_id: payload.encounter_id ? toObjectId(payload.encounter_id, 'encounter_id') : undefined,
        admission_id: payload.admission_id ? toObjectId(payload.admission_id, 'admission_id') : undefined,
        source_type: payload.source_type || 'manual',
        source_id: payload.source_id ? toObjectId(payload.source_id, 'source_id') : undefined,
        rule_code: payload.rule_code,
        title: payload.title,
        message: payload.message,
        severity: payload.severity || 'warning',
        status: payload.status || 'open',
        assigned_to_user_id: payload.assigned_to_user_id,
        department_id: payload.department_id || actorDepartmentId(actor),
        sla_due_at: payload.sla_due_at ? parseDate(payload.sla_due_at, 'sla_due_at') : addMinutes(new Date(), payload.severity === 'critical' ? 5 : 30),
        metadata: payload.metadata || {},
        created_by: actorUserId(actor),
      },
      $set: {
        updated_by: actorUserId(actor),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await recordAuditLog({
    actor,
    action: 'clinical_alert.create',
    targetType: 'clinical_alert',
    targetId: alert._id,
    status: 'success',
    message: 'Tạo cảnh báo lâm sàng.',
    requestMeta,
  });
  return getClinicalAlert(alert._id, actor);
}

async function listClinicalAlerts(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query, 60, 160);
  const filter = {};
  const statuses = splitList(query.status, OPEN_ALERT_STATUSES);
  if (!statuses.includes('all')) filter.status = { $in: statuses };
  if (query.severity && query.severity !== 'all') filter.severity = query.severity;
  if (query.source_type && query.source_type !== 'all') filter.source_type = query.source_type;
  if (query.patient_id) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  if (query.encounter_id) filter.encounter_id = toObjectId(query.encounter_id, 'encounter_id');
  applyDepartmentScope(filter, query, actor);
  const [items, total] = await Promise.all([
    ClinicalAlert.find(filter)
      .sort({ severity: -1, sla_due_at: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('assigned_to_user_id', 'full_name employee_code')
      .populate('department_id', 'department_name department_code')
      .lean(),
    ClinicalAlert.countDocuments(filter),
  ]);
  const formatted = items.map(formatClinicalAlert);
  return {
    items: formatted,
    board: {
      open: formatted.filter((item) => item.status === 'open'),
      acknowledged: formatted.filter((item) => item.status === 'acknowledged'),
      doctor_notified: formatted.filter((item) => item.status === 'doctor_notified'),
      escalated: formatted.filter((item) => item.status === 'escalated'),
      resolved: formatted.filter((item) => item.status === 'resolved'),
      dismissed: formatted.filter((item) => item.status === 'dismissed'),
    },
    summary: buildAlertSummary(formatted),
    pagination: buildPagination(page, limit, total),
  };
}

async function getClinicalAlert(alertId, actor = {}) {
  const alert = await ClinicalAlert.findById(alertId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('assigned_to_user_id', 'full_name employee_code')
    .populate('department_id', 'department_name department_code')
    .lean();
  if (!alert) throw createError('Không tìm thấy cảnh báo lâm sàng.', 404);
  return formatClinicalAlert(alert);
}

async function updateClinicalAlertAction(alertId, action, payload = {}, actor = {}, requestMeta = {}) {
  const alert = await ClinicalAlert.findById(alertId);
  if (!alert) throw createError('Không tìm thấy cảnh báo lâm sàng.', 404);
  const now = new Date();
  if (action === 'acknowledge') {
    alert.status = 'acknowledged';
    alert.acknowledged_by = actorUserId(actor);
    alert.acknowledged_at = now;
  }
  if (action === 'notify-doctor') {
    const request = await createDoctorNotificationRequest({
      patient_id: alert.patient_id,
      encounter_id: alert.encounter_id,
      department_id: alert.department_id,
      priority: alert.severity === 'critical' ? 'critical' : 'urgent',
      category: alert.source_type === 'vital_sign' ? 'abnormal_vital' : alert.source_type === 'lab_result' ? 'lab_critical' : alert.source_type === 'imaging_report' ? 'imaging_critical' : 'manual',
      related_alert_id: alert._id,
      sbar: payload.sbar || {
        situation: alert.title,
        background: alert.message,
        assessment: `Mức độ ${alert.severity}`,
        recommendation: 'Bác sĩ vui lòng phản hồi hướng xử trí.',
      },
      send: true,
    }, actor, requestMeta);
    alert.status = 'doctor_notified';
    alert.doctor_notification_request_id = request.doctor_notification_request_id || request.id;
    alert.doctor_notified_at = now;
  }
  if (action === 'escalate') {
    alert.status = 'escalated';
    alert.severity = alert.severity === 'critical' ? alert.severity : 'critical';
    alert.escalated_at = now;
    alert.breached_at = alert.breached_at || (isOverdue(alert.sla_due_at, now) ? now : undefined);
  }
  if (action === 'resolve') {
    alert.status = 'resolved';
    alert.resolved_by = actorUserId(actor);
    alert.resolved_at = now;
  }
  if (action === 'dismiss') {
    alert.status = 'dismissed';
    alert.dismissed_by = actorUserId(actor);
    alert.dismissed_at = now;
    alert.dismiss_reason = payload.reason || payload.dismiss_reason;
  }
  alert.updated_by = actorUserId(actor);
  await alert.save();
  await recordAuditLog({
    actor,
    action: `clinical_alert.${action}`,
    targetType: 'clinical_alert',
    targetId: alert._id,
    status: 'success',
    message: 'Cập nhật cảnh báo lâm sàng.',
    requestMeta,
  });
  return getClinicalAlert(alert._id, actor);
}

async function evaluateVitalSign(vitalSignId, actor = {}, requestMeta = {}) {
  const vital = await VitalSign.findById(vitalSignId).lean();
  if (!vital) throw createError('Không tìm thấy sinh hiệu.', 404);
  const flags = vitalFlags(vital);
  if (!flags.length) {
    return { created: false, alert: null, message: 'Sinh hiệu chưa có cờ bất thường.' };
  }
  const severity = flags.some((flag) => flag.severity === 'critical') ? 'critical' : 'high';
  const alert = await createClinicalAlert({
    patient_id: vital.patient_id,
    encounter_id: vital.encounter_id,
    source_type: 'vital_sign',
    source_id: vital._id,
    rule_code: flags[0]?.field ? `vital.${flags[0].field}` : 'vital.abnormal',
    title: severity === 'critical' ? 'Sinh hiệu critical' : 'Sinh hiệu bất thường',
    message: flags.map((flag) => `${flag.message}: ${flag.value}`).join(' · '),
    severity,
    department_id: payloadDepartmentFromVital(vital),
    metadata: { flags },
  }, actor, requestMeta);
  return { created: true, alert };
}

async function evaluateEncounterAlerts(encounterId, actor = {}, requestMeta = {}) {
  const latest = await VitalSign.findOne({ encounter_id: encounterId, status: { $ne: 'entered_in_error' } }).sort({ recorded_at: -1 }).lean();
  if (!latest) return { created: 0, alerts: [] };
  const result = await evaluateVitalSign(latest._id, actor, requestMeta);
  return { created: result.created ? 1 : 0, alerts: result.alert ? [result.alert] : [] };
}

function payloadDepartmentFromVital(vital = {}) {
  return vital.department_id || undefined;
}

async function attachLatestProcedureObservations(procedureOrders = []) {
  const ids = procedureOrders.map(normalizeId).filter(Boolean).map((id) => toObjectId(id, 'procedure_order_id'));
  const observations = ids.length
    ? await PostProcedureObservation.find({ procedure_order_id: { $in: ids } }).sort({ observed_at: -1 }).lean()
    : [];
  const map = new Map();
  for (const observation of observations) {
    const key = normalizeId(observation.procedure_order_id);
    if (!map.has(key)) map.set(key, observation);
  }
  return procedureOrders.map((order) => formatPostProcedureOrder(order, map.get(normalizeId(order))));
}

function formatPostProcedureOrder(order = {}, observation = null) {
  const patient = patientDto(order.patient_id);
  const completedAt = order.completed_at || order.performed_end;
  return {
    id: normalizeId(order),
    procedure_order_id: normalizeId(order),
    patient,
    patient_id: patient.patient_id,
    patient_code: patient.patient_code,
    patient_name: patient.patient_name,
    encounter_id: normalizeId(order.encounter_id),
    procedure_order_no: order.procedure_order_no,
    procedure_name: order.procedure_name,
    priority: order.priority,
    performer: userDto(order.performer_id),
    department: departmentDto(order.department_id),
    completed_at: completedAt,
    minutes_after_completed: completedAt ? minutesSince(completedAt) : null,
    result_note: order.result_note,
    latest_observation: observation ? {
      post_procedure_observation_id: normalizeId(observation),
      observed_at: observation.observed_at,
      pain_score: observation.pain_score,
      bleeding_level: observation.bleeding_level,
      wound_status: observation.wound_status,
      consciousness: observation.consciousness,
      nausea: observation.nausea,
      vomiting: observation.vomiting,
      dizziness: observation.dizziness,
      dyspnea: observation.dyspnea,
      pallor: observation.pallor,
      severity: observation.severity,
      status: observation.status,
      next_check_at: observation.next_check_at,
      doctor_notified: observation.doctor_notified,
      complication_flags: observation.complication_flags || [],
    } : null,
    status: observation?.status || 'monitoring',
    severity: observation?.severity || 'watch',
    next_check_at: observation?.next_check_at || (completedAt ? addMinutes(new Date(completedAt), 15).toISOString() : null),
    actions: ['observe', 'record_vital', 'add_note', 'notify_doctor', 'create_emergency', 'mark_stable', 'open_timeline'],
  };
}

async function listPostProcedure(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query, 40, 120);
  const { start, end } = baseDateRange(query);
  const filter = { status: query.status && query.status !== 'all' ? query.status : 'completed' };
  applyDepartmentScope(filter, query, actor);
  if (!query.all_dates) filter.completed_at = { $gte: start, $lte: end };
  const [orders, total] = await Promise.all([
    ProcedureOrder.find(filter)
      .sort({ completed_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('performer_id', 'full_name employee_code')
      .populate('department_id', 'department_name department_code')
      .lean(),
    ProcedureOrder.countDocuments(filter),
  ]);
  const items = await attachLatestProcedureObservations(orders);
  return {
    items,
    summary: buildPostProcedureSummary(items),
    pagination: buildPagination(page, limit, total),
  };
}

async function getPostProcedure(procedureOrderId, actor = {}) {
  const order = await ProcedureOrder.findById(procedureOrderId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('performer_id', 'full_name employee_code')
    .populate('department_id', 'department_name department_code')
    .lean();
  if (!order) throw createError('Không tìm thấy thủ thuật.', 404);
  const observation = await PostProcedureObservation.findOne({ procedure_order_id: order._id }).sort({ observed_at: -1 }).lean();
  return formatPostProcedureOrder(order, observation);
}

function inferPostProcedureSeverity(payload = {}) {
  if (payload.bleeding_level === 'severe' || payload.consciousness === 'unresponsive' || payload.dyspnea) return 'critical';
  if (payload.bleeding_level === 'moderate' || Number(payload.pain_score || 0) >= 8 || payload.consciousness === 'confused') return 'urgent';
  if (payload.bleeding_level === 'mild' || Number(payload.pain_score || 0) >= 5 || payload.dizziness || payload.vomiting) return 'watch';
  return payload.severity || 'normal';
}

async function addPostProcedureObservation(procedureOrderId, payload = {}, actor = {}, requestMeta = {}) {
  const order = await ProcedureOrder.findById(procedureOrderId).lean();
  if (!order) throw createError('Không tìm thấy thủ thuật.', 404);
  const severity = payload.severity || inferPostProcedureSeverity(payload);
  const observation = await PostProcedureObservation.create({
    procedure_order_id: order._id,
    patient_id: order.patient_id,
    encounter_id: order.encounter_id,
    admission_id: payload.admission_id,
    observed_by: actorUserId(actor),
    observed_at: payload.observed_at ? parseDate(payload.observed_at, 'observed_at') : new Date(),
    pain_score: payload.pain_score,
    bleeding_level: payload.bleeding_level || 'none',
    wound_status: payload.wound_status,
    consciousness: payload.consciousness || 'alert',
    nausea: Boolean(payload.nausea),
    vomiting: Boolean(payload.vomiting),
    dizziness: Boolean(payload.dizziness),
    dyspnea: Boolean(payload.dyspnea),
    pallor: Boolean(payload.pallor),
    vital_sign_id: payload.vital_sign_id ? toObjectId(payload.vital_sign_id, 'vital_sign_id') : undefined,
    intervention_note: payload.intervention_note,
    patient_instruction: payload.patient_instruction,
    complication_flags: payload.complication_flags || [],
    severity,
    next_check_at: payload.next_check_at ? parseDate(payload.next_check_at, 'next_check_at') : addMinutes(new Date(), severity === 'critical' ? 5 : severity === 'urgent' ? 15 : 30),
    doctor_notified: false,
    status: ['urgent', 'critical'].includes(severity) ? 'monitoring' : payload.status || 'monitoring',
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  if (['urgent', 'critical'].includes(severity)) {
    await createClinicalAlert({
      patient_id: observation.patient_id,
      encounter_id: observation.encounter_id,
      source_type: 'procedure_observation',
      source_id: observation._id,
      title: severity === 'critical' ? 'Biến chứng hậu thủ thuật critical' : 'Cần theo dõi hậu thủ thuật',
      message: [payload.wound_status, payload.intervention_note, ...(payload.complication_flags || [])].filter(Boolean).join(' · ') || `Mức độ ${severity}`,
      severity: severity === 'critical' ? 'critical' : 'high',
      department_id: order.department_id,
    }, actor, requestMeta);
  }
  await recordAuditLog({
    actor,
    action: 'nursing.post_procedure.observe',
    targetType: 'post_procedure_observation',
    targetId: observation._id,
    status: 'success',
    message: 'Ghi nhận hậu thủ thuật.',
    requestMeta,
  });
  return getPostProcedure(order._id, actor);
}

async function postProcedureAction(procedureOrderId, action, payload = {}, actor = {}, requestMeta = {}) {
  const latest = await PostProcedureObservation.findOne({ procedure_order_id: procedureOrderId }).sort({ observed_at: -1 });
  if (!latest && action !== 'create-emergency') throw createError('Chưa có ghi nhận hậu thủ thuật.', 404);
  if (action === 'mark-stable') {
    latest.status = 'stable';
    latest.severity = 'normal';
  }
  if (action === 'notify-doctor') {
    const request = await createDoctorNotificationRequest({
      patient_id: latest.patient_id,
      encounter_id: latest.encounter_id,
      priority: latest.severity === 'critical' ? 'critical' : 'urgent',
      category: 'post_procedure',
      related_procedure_order_id: latest.procedure_order_id,
      sbar: payload.sbar || {
        situation: payload.message || 'Bệnh nhân cần theo dõi sau thủ thuật.',
        background: `Đau ${latest.pain_score ?? '-'}, chảy máu ${latest.bleeding_level}.`,
        assessment: latest.intervention_note || latest.wound_status,
        recommendation: 'Bác sĩ vui lòng đánh giá hậu thủ thuật.',
      },
      send: true,
    }, actor, requestMeta);
    latest.status = 'doctor_notified';
    latest.doctor_notified = true;
    latest.doctor_notification_request_id = request.doctor_notification_request_id || request.id;
  }
  if (action === 'escalate') {
    latest.status = 'escalated';
    latest.severity = 'critical';
  }
  if (action === 'create-emergency') {
    const order = await ProcedureOrder.findById(procedureOrderId).lean();
    if (!order) throw createError('Không tìm thấy thủ thuật.', 404);
    const emergency = await EmergencyCase.create({
      case_code: await generateEmergencyCode(),
      patient_id: order.patient_id,
      triggered_by_actor_type: 'staff',
      triggered_by_actor_id: actorUserId(actor),
      type: 'medical_emergency',
      status: EMERGENCY_STATUS.CREATED,
      priority: EMERGENCY_PRIORITY.CRITICAL,
      location_text: payload.location_text,
      symptoms: payload.symptoms || payload.message || 'Biến chứng sau thủ thuật',
      note: payload.note,
      assigned_department_id: order.department_id,
      related_encounter_id: order.encounter_id,
      created_by: actorUserId(actor),
      updated_by: actorUserId(actor),
    });
    if (latest) {
      latest.status = 'emergency';
      latest.emergency_case_id = emergency._id;
    }
  }
  if (latest) {
    latest.updated_by = actorUserId(actor);
    await latest.save();
  }
  await recordAuditLog({
    actor,
    action: `nursing.post_procedure.${action}`,
    targetType: 'procedure_order',
    targetId: procedureOrderId,
    status: 'success',
    message: 'Cập nhật hậu thủ thuật.',
    requestMeta,
  });
  return getPostProcedure(procedureOrderId, actor);
}

async function generateEmergencyCode() {
  return codeGeneratorService.generateSequenceCode(EmergencyCase, 'case_code', 'SOS', {
    separator: '-',
    sequenceWidth: 4,
  });
}

async function attachLatestMedicationReactions(administrations = []) {
  const ids = administrations.map(normalizeId).filter(Boolean).map((id) => toObjectId(id, 'medication_administration_id'));
  const reactions = ids.length
    ? await MedicationReactionObservation.find({ medication_administration_id: { $in: ids } }).sort({ observed_at: -1 }).lean()
    : [];
  const map = new Map();
  for (const reaction of reactions) {
    const key = normalizeId(reaction.medication_administration_id);
    if (!map.has(key)) map.set(key, reaction);
  }
  return administrations.map((item) => formatMedicationAdministration(item, map.get(normalizeId(item))));
}

function medicationName(medication = {}) {
  if (!medication || typeof medication !== 'object') return null;
  return [medication.brand_name || medication.generic_name, medication.strength].filter(Boolean).join(' ');
}

function formatMedicationAdministration(item = {}, reaction = null) {
  const patient = patientDto(item.patient_id);
  return {
    id: normalizeId(item),
    medication_administration_id: normalizeId(item),
    patient,
    patient_id: patient.patient_id,
    patient_code: patient.patient_code,
    patient_name: patient.patient_name,
    encounter_id: normalizeId(item.encounter_id),
    admission_id: normalizeId(item.admission_id),
    prescription_item_id: normalizeId(item.prescription_item_id),
    medication_id: normalizeId(item.medication_id),
    medication_name: medicationName(item.medication_id),
    administered_by: userDto(item.administered_by),
    scheduled_at: item.scheduled_at,
    administered_at: item.administered_at,
    minutes_after_administered: item.administered_at ? minutesSince(item.administered_at) : null,
    dose: item.dose,
    route: item.route || item.medication_id?.route_default,
    site: item.site,
    note: item.note,
    reason_not_given: item.reason_not_given,
    status: item.status,
    latest_reaction: reaction ? {
      medication_reaction_observation_id: normalizeId(reaction),
      observed_at: reaction.observed_at,
      symptoms: reaction.symptoms || [],
      onset_at: reaction.onset_at,
      severity: reaction.severity,
      suspected_allergy: reaction.suspected_allergy,
      intervention_note: reaction.intervention_note,
      medication_stopped: reaction.medication_stopped,
      status: reaction.status,
    } : null,
    risk_level: reaction?.severity === 'life_threatening' ? 'critical' : reaction?.severity === 'severe' ? 'high' : reaction ? 'medium' : 'low',
    actions: ['record_reaction', 'record_vital', 'notify_doctor', 'create_allergy', 'create_emergency'],
  };
}

async function listMedicationAdministrations(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query, 50, 160);
  const filter = {};
  if (query.status && query.status !== 'all') filter.status = { $in: splitList(query.status) };
  if (query.patient_id) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  if (query.encounter_id) filter.encounter_id = toObjectId(query.encounter_id, 'encounter_id');
  if (query.admission_id) filter.admission_id = toObjectId(query.admission_id, 'admission_id');
  if (!query.all_dates) {
    const { start, end } = baseDateRange(query);
    filter.$or = [{ scheduled_at: { $gte: start, $lte: end } }, { administered_at: { $gte: start, $lte: end } }];
  }
  const [items, total] = await Promise.all([
    MedicationAdministration.find(filter)
      .sort({ administered_at: -1, scheduled_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('medication_id', 'generic_name brand_name strength route_default')
      .populate('administered_by', 'full_name employee_code')
      .lean(),
    MedicationAdministration.countDocuments(filter),
  ]);
  const formatted = await attachLatestMedicationReactions(items);
  return {
    items: formatted,
    summary: buildMedicationSummary(formatted),
    pagination: buildPagination(page, limit, total),
  };
}

async function getMedicationAdministration(administrationId, actor = {}) {
  const item = await MedicationAdministration.findById(administrationId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('medication_id', 'generic_name brand_name strength route_default')
    .populate('administered_by', 'full_name employee_code')
    .lean();
  if (!item) throw createError('Không tìm thấy ghi nhận dùng thuốc.', 404);
  const reaction = await MedicationReactionObservation.findOne({ medication_administration_id: item._id }).sort({ observed_at: -1 }).lean();
  return formatMedicationAdministration(item, reaction);
}

async function createMedicationAdministration(payload = {}, actor = {}, requestMeta = {}) {
  const administration = await MedicationAdministration.create({
    patient_id: toObjectId(payload.patient_id, 'patient_id'),
    encounter_id: payload.encounter_id ? toObjectId(payload.encounter_id, 'encounter_id') : undefined,
    admission_id: payload.admission_id ? toObjectId(payload.admission_id, 'admission_id') : undefined,
    prescription_item_id: toObjectId(payload.prescription_item_id, 'prescription_item_id'),
    medication_id: toObjectId(payload.medication_id, 'medication_id'),
    administered_by: payload.administered_by ? toObjectId(payload.administered_by, 'administered_by') : undefined,
    scheduled_at: payload.scheduled_at ? parseDate(payload.scheduled_at, 'scheduled_at') : undefined,
    administered_at: payload.administered_at ? parseDate(payload.administered_at, 'administered_at') : undefined,
    dose: payload.dose,
    route: payload.route,
    site: payload.site,
    note: payload.note,
    reason_not_given: payload.reason_not_given,
    status: payload.status || ADMINISTRATION_STATUS.SCHEDULED,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({
    actor,
    action: 'medication_administration.create',
    targetType: 'medication_administration',
    targetId: administration._id,
    status: 'success',
    message: 'Tạo ghi nhận dùng thuốc.',
    requestMeta,
  });
  return getMedicationAdministration(administration._id, actor);
}

async function transitionMedicationAdministration(administrationId, action, payload = {}, actor = {}, requestMeta = {}) {
  const item = await MedicationAdministration.findById(administrationId);
  if (!item) throw createError('Không tìm thấy ghi nhận dùng thuốc.', 404);
  const statusByAction = {
    give: ADMINISTRATION_STATUS.GIVEN,
    hold: ADMINISTRATION_STATUS.HELD,
    refuse: ADMINISTRATION_STATUS.REFUSED,
    omit: ADMINISTRATION_STATUS.OMITTED,
    cancel: ADMINISTRATION_STATUS.CANCELLED,
    'entered-in-error': ADMINISTRATION_STATUS.ENTERED_IN_ERROR,
  };
  const status = statusByAction[action];
  if (!status) throw createError('Thao tác dùng thuốc không hợp lệ.', 400);
  item.status = status;
  if (status === ADMINISTRATION_STATUS.GIVEN) {
    item.administered_by = actorUserId(actor);
    item.administered_at = payload.administered_at ? parseDate(payload.administered_at, 'administered_at') : new Date();
    if (payload.dose !== undefined) item.dose = payload.dose;
    if (payload.route !== undefined) item.route = payload.route;
    if (payload.site !== undefined) item.site = payload.site;
  }
  if ([ADMINISTRATION_STATUS.HELD, ADMINISTRATION_STATUS.REFUSED, ADMINISTRATION_STATUS.OMITTED].includes(status)) {
    item.reason_not_given = payload.reason_not_given || payload.reason || item.reason_not_given;
  }
  if (payload.note !== undefined) item.note = payload.note;
  item.updated_by = actorUserId(actor);
  await item.save();
  await recordAuditLog({
    actor,
    action: `medication_administration.${action}`,
    targetType: 'medication_administration',
    targetId: item._id,
    status: 'success',
    message: 'Cập nhật ghi nhận dùng thuốc.',
    requestMeta,
  });
  return getMedicationAdministration(item._id, actor);
}

async function addMedicationReaction(administrationId, payload = {}, actor = {}, requestMeta = {}) {
  const administration = await MedicationAdministration.findById(administrationId).populate('medication_id').lean();
  if (!administration) throw createError('Không tìm thấy ghi nhận dùng thuốc.', 404);
  const reaction = await MedicationReactionObservation.create({
    medication_administration_id: administration._id,
    patient_id: administration.patient_id,
    encounter_id: administration.encounter_id,
    admission_id: administration.admission_id,
    observed_by: actorUserId(actor),
    observed_at: payload.observed_at ? parseDate(payload.observed_at, 'observed_at') : new Date(),
    symptoms: payload.symptoms || [],
    onset_at: payload.onset_at ? parseDate(payload.onset_at, 'onset_at') : undefined,
    severity: payload.severity || 'mild',
    suspected_allergy: Boolean(payload.suspected_allergy),
    suspected_medication_id: payload.suspected_medication_id ? toObjectId(payload.suspected_medication_id, 'suspected_medication_id') : administration.medication_id?._id || administration.medication_id,
    vital_sign_id: payload.vital_sign_id ? toObjectId(payload.vital_sign_id, 'vital_sign_id') : undefined,
    intervention_note: payload.intervention_note,
    medication_stopped: Boolean(payload.medication_stopped),
    status: 'observed',
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  if (payload.create_allergy && reaction.suspected_allergy) {
    const medication = administration.medication_id && typeof administration.medication_id === 'object'
      ? administration.medication_id
      : await MedicationMaster.findById(administration.medication_id).lean();
    const allergy = await Allergy.create({
      patient_id: administration.patient_id,
      encounter_id: administration.encounter_id,
      recorded_by: actorUserId(actor),
      allergy_type: 'medication',
      allergen: medicationName(medication) || 'Thuốc nghi ngờ',
      reaction: (payload.symptoms || []).join(', '),
      severity: reaction.severity === 'life_threatening' ? 'life_threatening' : reaction.severity === 'severe' ? 'severe' : reaction.severity === 'moderate' ? 'moderate' : 'mild',
      onset_date: reaction.onset_at || reaction.observed_at,
      notes: reaction.intervention_note,
      created_by: actorUserId(actor),
      updated_by: actorUserId(actor),
    });
    reaction.allergy_created_id = allergy._id;
    reaction.status = 'allergy_recorded';
    await reaction.save();
  }
  if (['severe', 'life_threatening'].includes(reaction.severity)) {
    await createClinicalAlert({
      patient_id: reaction.patient_id,
      encounter_id: reaction.encounter_id,
      source_type: 'medication_reaction',
      source_id: reaction._id,
      title: reaction.severity === 'life_threatening' ? 'Nghi phản vệ hoặc phản ứng thuốc nguy kịch' : 'Nghi phản ứng thuốc nặng',
      message: (reaction.symptoms || []).join(' · ') || reaction.intervention_note || 'Cần bác sĩ đánh giá phản ứng thuốc.',
      severity: reaction.severity === 'life_threatening' ? 'critical' : 'high',
      metadata: { medication_administration_id: normalizeId(administration._id) },
    }, actor, requestMeta);
  }
  await recordAuditLog({
    actor,
    action: 'medication_reaction.observe',
    targetType: 'medication_reaction_observation',
    targetId: reaction._id,
    status: 'success',
    message: 'Ghi nhận phản ứng sau dùng thuốc.',
    requestMeta,
  });
  return getMedicationAdministration(administration._id, actor);
}

function buildAlertSummary(items = []) {
  return {
    total: items.length,
    critical: items.filter((item) => item.severity === 'critical').length,
    high: items.filter((item) => item.severity === 'high').length,
    waiting_ack: items.filter((item) => item.status === 'open').length,
    doctor_notified: items.filter((item) => item.status === 'doctor_notified').length,
    breached: items.filter((item) => item.sla_breached).length,
  };
}

function buildDoctorNotificationSummary(items = []) {
  return {
    total: items.length,
    drafts: items.filter((item) => item.status === 'draft').length,
    sent_waiting_read: items.filter((item) => ['sent', 'delivered'].includes(item.status)).length,
    seen_waiting_response: items.filter((item) => ['seen', 'acknowledged'].includes(item.status)).length,
    responded: items.filter((item) => item.status === 'responded').length,
    breached: items.filter((item) => item.sla_breached).length,
    escalated: items.filter((item) => item.status === 'escalated').length,
  };
}

function buildPostProcedureSummary(items = []) {
  return {
    total: items.length,
    monitoring: items.filter((item) => ['monitoring', 'doctor_notified', 'escalated', 'emergency'].includes(item.status)).length,
    suspected_complication: items.filter((item) => ['urgent', 'critical'].includes(item.severity)).length,
    due_10_minutes: items.filter((item) => {
      const minutes = minutesUntil(item.next_check_at);
      return minutes !== null && minutes <= 10;
    }).length,
    doctor_notified: items.filter((item) => item.latest_observation?.doctor_notified).length,
    stable: items.filter((item) => item.status === 'stable').length,
  };
}

function buildMedicationSummary(items = []) {
  return {
    total: items.length,
    given: items.filter((item) => item.status === 'given').length,
    needs_follow_up: items.filter((item) => item.status === 'given' && minutesSince(item.administered_at) <= 60).length,
    suspected_reaction: items.filter((item) => item.latest_reaction).length,
    suspected_allergy: items.filter((item) => item.latest_reaction?.suspected_allergy).length,
    held_refused_omitted: items.filter((item) => ['held', 'refused', 'omitted'].includes(item.status)).length,
  };
}

function buildEmergencySummary(items = []) {
  return {
    open: items.length,
    critical: items.filter((item) => item.priority === 'critical').length,
    waiting_ack: items.filter((item) => item.status === 'created').length,
    triaged: items.filter((item) => item.status === 'triaged').length,
    dispatched: items.filter((item) => item.status === 'dispatched').length,
    breached: items.filter((item) => item.sla_breached).length,
  };
}

function formatEmergencyCase(item = {}) {
  const patient = patientDto(item.patient_id);
  const dueAt = item.first_response_due_at || (item.created_at ? addMinutes(new Date(item.created_at), 5).toISOString() : null);
  return {
    id: normalizeId(item),
    case_id: normalizeId(item),
    case_code: item.case_code,
    patient,
    patient_id: patient.patient_id,
    patient_code: patient.patient_code,
    patient_name: patient.patient_name,
    type: item.type,
    status: item.status,
    priority: item.priority,
    location_text: item.location_text,
    symptoms: item.symptoms,
    note: item.note,
    assigned_to: userDto(item.assigned_to_user_id),
    assigned_department: departmentDto(item.assigned_department_id),
    related_encounter_id: normalizeId(item.related_encounter_id),
    created_at: item.created_at,
    acknowledged_at: item.acknowledged_at,
    triaged_at: item.triaged_at,
    dispatched_at: item.dispatched_at,
    escalated_at: item.escalated_at,
    resolved_at: item.resolved_at,
    first_response_due_at: dueAt,
    sla_minutes: minutesUntil(dueAt),
    sla_breached: Boolean(item.sla_breached_at || isOverdue(dueAt)),
    escalation_level: item.escalation_level || 0,
    metadata: item.metadata || {},
  };
}

module.exports = {
  getMonitoringCommandCenter,
  listMonitoringSessions,
  createMonitoringSession,
  getMonitoringSession,
  updateMonitoringSession,
  addMonitoringCheck,
  assignMonitoringSession,
  notifyDoctorFromMonitoring,
  escalateMonitoringSession,
  markMonitoringStable: (id, payload, actor, requestMeta) => updateMonitoringTerminalStatus(id, 'stable', payload, actor, requestMeta),
  resolveMonitoringSession: (id, payload, actor, requestMeta) => updateMonitoringTerminalStatus(id, 'resolved', payload, actor, requestMeta),
  cancelMonitoringSession: (id, payload, actor, requestMeta) => updateMonitoringTerminalStatus(id, 'cancelled', payload, actor, requestMeta),
  getMonitoringTimeline,
  listDoctorNotifications,
  createDoctorNotificationRequest,
  getDoctorNotificationRequest,
  updateDoctorNotificationRequest,
  sendDoctorNotificationRequest,
  markDoctorNotificationSeen: (id, payload, actor, requestMeta) => transitionDoctorNotification(id, 'mark-seen', payload, actor, requestMeta),
  acknowledgeDoctorNotification: (id, payload, actor, requestMeta) => transitionDoctorNotification(id, 'acknowledge', payload, actor, requestMeta),
  respondDoctorNotification: (id, payload, actor, requestMeta) => transitionDoctorNotification(id, 'respond', payload, actor, requestMeta),
  escalateDoctorNotification: (id, payload, actor, requestMeta) => transitionDoctorNotification(id, 'escalate', payload, actor, requestMeta),
  closeDoctorNotification: (id, payload, actor, requestMeta) => transitionDoctorNotification(id, 'close', payload, actor, requestMeta),
  cancelDoctorNotification: (id, payload, actor, requestMeta) => transitionDoctorNotification(id, 'cancel', payload, actor, requestMeta),
  getDoctorNotificationTimeline,
  listClinicalAlerts,
  createClinicalAlert,
  getClinicalAlert,
  acknowledgeClinicalAlert: (id, payload, actor, requestMeta) => updateClinicalAlertAction(id, 'acknowledge', payload, actor, requestMeta),
  notifyDoctorClinicalAlert: (id, payload, actor, requestMeta) => updateClinicalAlertAction(id, 'notify-doctor', payload, actor, requestMeta),
  escalateClinicalAlert: (id, payload, actor, requestMeta) => updateClinicalAlertAction(id, 'escalate', payload, actor, requestMeta),
  resolveClinicalAlert: (id, payload, actor, requestMeta) => updateClinicalAlertAction(id, 'resolve', payload, actor, requestMeta),
  dismissClinicalAlert: (id, payload, actor, requestMeta) => updateClinicalAlertAction(id, 'dismiss', payload, actor, requestMeta),
  evaluateEncounterAlerts,
  evaluateVitalSign,
  listPostProcedure,
  getPostProcedure,
  addPostProcedureObservation,
  markPostProcedureStable: (id, payload, actor, requestMeta) => postProcedureAction(id, 'mark-stable', payload, actor, requestMeta),
  notifyDoctorPostProcedure: (id, payload, actor, requestMeta) => postProcedureAction(id, 'notify-doctor', payload, actor, requestMeta),
  escalatePostProcedure: (id, payload, actor, requestMeta) => postProcedureAction(id, 'escalate', payload, actor, requestMeta),
  createEmergencyFromPostProcedure: (id, payload, actor, requestMeta) => postProcedureAction(id, 'create-emergency', payload, actor, requestMeta),
  listMedicationAdministrations,
  getMedicationAdministration,
  createMedicationAdministration,
  giveMedicationAdministration: (id, payload, actor, requestMeta) => transitionMedicationAdministration(id, 'give', payload, actor, requestMeta),
  holdMedicationAdministration: (id, payload, actor, requestMeta) => transitionMedicationAdministration(id, 'hold', payload, actor, requestMeta),
  refuseMedicationAdministration: (id, payload, actor, requestMeta) => transitionMedicationAdministration(id, 'refuse', payload, actor, requestMeta),
  omitMedicationAdministration: (id, payload, actor, requestMeta) => transitionMedicationAdministration(id, 'omit', payload, actor, requestMeta),
  cancelMedicationAdministration: (id, payload, actor, requestMeta) => transitionMedicationAdministration(id, 'cancel', payload, actor, requestMeta),
  markMedicationAdministrationEnteredInError: (id, payload, actor, requestMeta) => transitionMedicationAdministration(id, 'entered-in-error', payload, actor, requestMeta),
  addMedicationReaction,
};
