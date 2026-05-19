const { randomBytes } = require('crypto');
const {
  Allergy,
  EmergencyCase,
  EmergencyCaseEvent,
  EmergencyTriage,
  Patient,
  ProblemList,
  VitalSign,
} = require('../models');
const {
  ACTOR_TYPE,
  EMERGENCY_CASE_TYPES,
  EMERGENCY_CASE_TYPE,
  EMERGENCY_PRIORITIES,
  EMERGENCY_PRIORITY,
  EMERGENCY_STATUS,
  REALTIME_EVENT_TYPE,
} = require('../constants/statuses');
const { buildPagination, createError, getPagination, recordAuditLog } = require('./core.service');
const actorContext = require('../common/actors');
const eventBus = require('../events/event-bus.service');
const { isValidObjectId, toObjectId } = require('../common/helpers/object-id.helper');

const OPEN_CASE_STATUSES = [
  EMERGENCY_STATUS.CREATED,
  EMERGENCY_STATUS.ACKNOWLEDGED,
  EMERGENCY_STATUS.TRIAGED,
  EMERGENCY_STATUS.DISPATCHED,
];

const CLOSED_CASE_STATUSES = [
  EMERGENCY_STATUS.RESOLVED,
  EMERGENCY_STATUS.CANCELLED,
  EMERGENCY_STATUS.FALSE_ALARM,
];

const SLA_TARGETS = {
  critical: {
    acknowledgeSeconds: 120,
    triageSeconds: 300,
    dispatchSeconds: 420,
    resolveSeconds: 3600,
  },
  urgent: {
    acknowledgeSeconds: 300,
    triageSeconds: 900,
    dispatchSeconds: 1200,
    resolveSeconds: 7200,
  },
};

const TRIAGE_EDITABLE_FIELDS = [
  'chief_complaint',
  'onset_time',
  'mechanism_of_injury',
  'symptoms',
  'airway_status',
  'breathing_status',
  'circulation_status',
  'disability_status',
  'exposure_status',
  'temperature',
  'heart_rate',
  'respiratory_rate',
  'systolic_bp',
  'diastolic_bp',
  'spo2',
  'pain_score',
  'gcs_eye',
  'gcs_verbal',
  'gcs_motor',
  'gcs_total',
  'avpu',
  'blood_glucose',
  'oxygen_support',
  'oxygen_flow_rate',
  'esi_level',
  'triage_color',
  'final_priority',
  'risk_flags',
  'recommended_actions',
  'disposition',
  'doctor_required',
  'dispatch_required',
  'stat_lab_required',
  'stat_imaging_required',
  'admission_required',
  'note',
  'metadata',
];

function toId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value.toHexString === 'function') return value.toHexString();
  if (value._id && value._id !== value) return toId(value._id);
  if (value.id && value.id !== value && typeof value.id !== 'function') return toId(value.id);
  const output = typeof value.toString === 'function' ? value.toString() : String(value);
  return output && output !== '[object Object]' ? output : null;
}

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizeEnum(value, allowed, fallback, label) {
  const normalized = normalizeString(value) || fallback;
  if (!allowed.includes(normalized)) throw createError(`${label} không hợp lệ.`, 422);
  return normalized;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitCsv(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  const normalized = normalizeString(value);
  return normalized ? normalized.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function addSeconds(date, seconds) {
  const source = date ? new Date(date) : new Date();
  return new Date(source.getTime() + Number(seconds || 0) * 1000);
}

function secondsBetween(left, right = new Date()) {
  if (!left) return null;
  const date = new Date(left);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - right.getTime()) / 1000);
}

function minutesSince(value, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
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
    patient_id: toId(patient),
    patient_code: value.patient_code || null,
    patient_name: value.full_name || value.patient_name || 'Chưa rõ bệnh nhân',
    phone: value.phone || null,
    gender: value.gender || null,
    age: ageFromDate(value.date_of_birth),
  };
}

function userDto(user = {}) {
  if (!user) return null;
  const value = user && typeof user === 'object' ? user : {};
  return {
    user_id: toId(user),
    full_name: value.full_name || value.username || value.employee_code || null,
    employee_code: value.employee_code || null,
  };
}

function departmentDto(department = {}) {
  if (!department) return null;
  const value = department && typeof department === 'object' ? department : {};
  return {
    department_id: toId(department),
    department_name: value.department_name || value.name || null,
    department_code: value.department_code || null,
  };
}

function buildSlaMoments(emergencyCase = {}) {
  const createdAt = emergencyCase.created_at || new Date();
  const targets = SLA_TARGETS[emergencyCase.priority] || SLA_TARGETS.urgent;
  return {
    acknowledge_due_at: emergencyCase.first_response_due_at || addSeconds(createdAt, targets.acknowledgeSeconds),
    triage_due_at: emergencyCase.triage_due_at || addSeconds(createdAt, targets.triageSeconds),
    dispatch_due_at: emergencyCase.dispatch_due_at || addSeconds(createdAt, targets.dispatchSeconds),
    resolve_due_at: emergencyCase.resolved_due_at || addSeconds(createdAt, targets.resolveSeconds),
  };
}

function nextDueForStatus(emergencyCase = {}) {
  const due = buildSlaMoments(emergencyCase);
  if (emergencyCase.status === EMERGENCY_STATUS.CREATED) return due.acknowledge_due_at;
  if (emergencyCase.status === EMERGENCY_STATUS.ACKNOWLEDGED) return due.triage_due_at;
  if (emergencyCase.status === EMERGENCY_STATUS.TRIAGED) return due.dispatch_due_at;
  if (emergencyCase.status === EMERGENCY_STATUS.DISPATCHED) return due.resolve_due_at;
  return null;
}

function slaStatusForCase(emergencyCase = {}, now = new Date()) {
  if (CLOSED_CASE_STATUSES.includes(emergencyCase.status)) return 'closed';
  if (emergencyCase.escalated_at || emergencyCase.metadata?.escalated_at || Number(emergencyCase.escalation_level || 0) > 0) return 'escalated';
  const nextDue = nextDueForStatus(emergencyCase);
  const seconds = secondsBetween(nextDue, now);
  if (seconds === null) return emergencyCase.sla_status || 'on_time';
  if (seconds < 0 || emergencyCase.sla_breached_at) return 'breached';
  if (seconds <= 120) return 'at_risk';
  return 'on_time';
}

function buildRiskFlags(emergencyCase = {}, latestVital = null) {
  const snapshot = emergencyCase.metadata?.patient_risk_snapshot || {};
  const flags = [];
  if (Array.isArray(snapshot.allergies) && snapshot.allergies.length) flags.push('Có dị ứng');
  if (Array.isArray(snapshot.chronic_problems) && snapshot.chronic_problems.length) flags.push('Bệnh nền');
  if (!emergencyCase.location_lat || !emergencyCase.location_lng) flags.push('No GPS');
  if (emergencyCase.type === EMERGENCY_CASE_TYPE.FALL) flags.push('Fall');
  if (emergencyCase.type === EMERGENCY_CASE_TYPE.PANIC) flags.push('Panic');
  if (emergencyCase.priority === EMERGENCY_PRIORITY.CRITICAL) flags.push('Critical');
  if (emergencyCase.escalated_at || emergencyCase.metadata?.escalated_at || emergencyCase.escalation_level) flags.push('Escalated');
  if (latestVital?.spo2 && latestVital.spo2 < 90) flags.push('SpO2 thấp');
  if (latestVital?.systolic_bp && latestVital.systolic_bp < 90) flags.push('Tụt HA');
  if (latestVital?.heart_rate && latestVital.heart_rate >= 130) flags.push('Mạch nhanh');
  return [...new Set(flags)];
}

function formatCase(emergencyCase = {}, latestVital = null, now = new Date()) {
  const patient = patientDto(emergencyCase.patient_id);
  const due = buildSlaMoments(emergencyCase);
  const nextDue = nextDueForStatus(emergencyCase);
  return {
    id: toId(emergencyCase),
    case_id: toId(emergencyCase),
    case_code: emergencyCase.case_code,
    patient,
    patient_id: patient.patient_id,
    patient_code: patient.patient_code,
    patient_name: patient.patient_name,
    type: emergencyCase.type,
    status: emergencyCase.status,
    priority: emergencyCase.priority,
    source: emergencyCase.source || emergencyCase.metadata?.source || null,
    location_lat: emergencyCase.location_lat,
    location_lng: emergencyCase.location_lng,
    location_text: emergencyCase.location_text,
    symptoms: emergencyCase.symptoms,
    note: emergencyCase.note,
    assigned_to: userDto(emergencyCase.assigned_to_user_id),
    assigned_department: departmentDto(emergencyCase.assigned_department_id),
    primary_nurse: userDto(emergencyCase.primary_nurse_id),
    primary_doctor: userDto(emergencyCase.primary_doctor_id),
    related_appointment_id: toId(emergencyCase.related_appointment_id),
    related_encounter_id: toId(emergencyCase.related_encounter_id),
    created_at: emergencyCase.created_at,
    acknowledged_at: emergencyCase.acknowledged_at,
    triaged_at: emergencyCase.triaged_at,
    dispatched_at: emergencyCase.dispatched_at,
    doctor_notified_at: emergencyCase.doctor_notified_at,
    doctor_acknowledged_at: emergencyCase.doctor_acknowledged_at,
    doctor_seen_at: emergencyCase.doctor_seen_at,
    escalated_at: emergencyCase.escalated_at || emergencyCase.metadata?.escalated_at,
    resolved_at: emergencyCase.resolved_at,
    closed_at: emergencyCase.closed_at,
    close_reason: emergencyCase.close_reason,
    outcome: emergencyCase.outcome,
    disposition: emergencyCase.disposition,
    escalation_level: emergencyCase.escalation_level || 0,
    triage_level: emergencyCase.triage_level,
    triage_color: emergencyCase.triage_color,
    esi_level: emergencyCase.esi_level,
    metadata: emergencyCase.metadata || {},
    latest_vital: latestVital,
    risk_flags: buildRiskFlags(emergencyCase, latestVital),
    sla: {
      ...due,
      next_due_at: nextDue,
      next_due_seconds: secondsBetween(nextDue, now),
      status: slaStatusForCase(emergencyCase, now),
      created_minutes: minutesSince(emergencyCase.created_at, now),
      acknowledge_seconds: emergencyCase.acknowledged_at && emergencyCase.created_at
        ? Math.round((new Date(emergencyCase.acknowledged_at).getTime() - new Date(emergencyCase.created_at).getTime()) / 1000)
        : null,
    },
  };
}

async function latestVitalForCases(cases = []) {
  const encounterIds = [...new Set(cases.map((item) => toId(item.related_encounter_id)).filter(Boolean))];
  if (!encounterIds.length) return new Map();
  const vitals = await VitalSign.find({ encounter_id: { $in: encounterIds }, status: { $ne: 'entered_in_error' } })
    .sort({ recorded_at: -1, created_at: -1 })
    .lean();
  const map = new Map();
  for (const vital of vitals) {
    const key = toId(vital.encounter_id);
    if (!map.has(key)) map.set(key, vital);
  }
  return map;
}

function setDefaultDueDates(emergencyCase) {
  const due = buildSlaMoments(emergencyCase);
  emergencyCase.first_response_due_at = emergencyCase.first_response_due_at || due.acknowledge_due_at;
  emergencyCase.triage_due_at = emergencyCase.triage_due_at || due.triage_due_at;
  emergencyCase.dispatch_due_at = emergencyCase.dispatch_due_at || due.dispatch_due_at;
  emergencyCase.resolved_due_at = emergencyCase.resolved_due_at || due.resolve_due_at;
  emergencyCase.sla_next_due_at = nextDueForStatus(emergencyCase);
  emergencyCase.sla_status = slaStatusForCase(emergencyCase);
}

function requireStaff(actor = {}) {
  if (actorContext.getActorType(actor) !== ACTOR_TYPE.STAFF) throw createError('Chỉ nhân sự được thao tác emergency case.', 403);
}

async function generateCaseCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `SOS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const exists = await EmergencyCase.exists({ case_code: code });
    if (!exists) return code;
  }
  throw createError('Không thể sinh mã emergency case.', 409);
}

async function patientRiskSnapshot(patientId) {
  const [allergies, chronicProblems] = await Promise.all([
    Allergy.find({ patient_id: patientId, status: 'active' }).select('allergen severity reaction').limit(10).lean(),
    ProblemList.find({ patient_id: patientId, status: 'active' }).select('problem_name severity').limit(10).lean(),
  ]);
  return { allergies, chronic_problems: chronicProblems };
}

async function appendCaseEvent(caseId, eventType, {
  actor = {},
  fromStatus,
  toStatus,
  note,
  payload,
} = {}) {
  return EmergencyCaseEvent.create({
    case_id: caseId,
    event_type: eventType,
    actor_id: actor.userId || actor.user_id || actor.actorId || actor.actor_id,
    from_status: fromStatus,
    to_status: toStatus,
    note,
    payload,
  });
}

async function resolvePatientId(actor = {}, payload = {}) {
  const patientId = actorContext.getActorType(actor) === ACTOR_TYPE.STAFF
    ? payload.patient_id || payload.patientId
    : actorContext.getPatientId(actor);
  if (!patientId || !isValidObjectId(patientId)) throw createError('patient_id không hợp lệ.', 422);
  const patient = await Patient.findOne({ _id: patientId, is_deleted: false }).lean();
  if (!patient) throw createError('Không tìm thấy patient.', 404);
  return toObjectId(patientId, 'patient_id');
}

async function createSos(payload = {}, actor = {}, requestMeta = {}) {
  const patientId = await resolvePatientId(actor, payload);
  const context = actorContext.buildActorContext(actor);
  const riskSnapshot = await patientRiskSnapshot(patientId);
  const emergencyCase = await EmergencyCase.create({
    case_code: await generateCaseCode(),
    patient_id: patientId,
    triggered_by_actor_type: context.actor_type,
    triggered_by_actor_id: context.actor_id,
    type: normalizeEnum(payload.type, EMERGENCY_CASE_TYPES, EMERGENCY_CASE_TYPE.SOS, 'type'),
    status: EMERGENCY_STATUS.CREATED,
    priority: normalizeEnum(payload.priority, EMERGENCY_PRIORITIES, EMERGENCY_PRIORITY.URGENT, 'priority'),
    location_lat: payload.location_lat ?? payload.locationLat,
    location_lng: payload.location_lng ?? payload.locationLng,
    location_text: payload.location_text || payload.locationText,
    symptoms: payload.symptoms,
    note: payload.note,
    assigned_to_user_id: payload.assigned_to_user_id || payload.assignedToUserId,
    assigned_department_id: payload.assigned_department_id || payload.assignedDepartmentId,
    related_appointment_id: payload.related_appointment_id || payload.relatedAppointmentId,
    related_encounter_id: payload.related_encounter_id || payload.relatedEncounterId,
    source: payload.source || (context.actor_type === ACTOR_TYPE.STAFF ? 'staff_created' : context.actor_type === 'patient_relative' ? 'relative_app' : 'patient_app'),
    primary_nurse_id: payload.primary_nurse_id || payload.primaryNurseId || payload.assigned_to_user_id || payload.assignedToUserId,
    primary_doctor_id: payload.primary_doctor_id || payload.primaryDoctorId,
    metadata: {
      ...(payload.metadata || {}),
      source: payload.source || (context.actor_type === ACTOR_TYPE.STAFF ? 'staff_created' : context.actor_type === 'patient_relative' ? 'relative_app' : 'patient_app'),
      patient_risk_snapshot: riskSnapshot,
    },
    created_by: actor.userId,
    updated_by: actor.userId,
  });
  setDefaultDueDates(emergencyCase);
  await emergencyCase.save();
  await recordAuditLog({
    actor,
    action: 'emergency.sos_triggered',
    targetType: 'emergency_case',
    targetId: emergencyCase._id,
    status: 'success',
    message: 'Tạo emergency SOS.',
    requestMeta,
    metadata: { patient_id: toId(patientId), priority: emergencyCase.priority },
  });
  await appendCaseEvent(emergencyCase._id, 'created', {
    actor,
    toStatus: emergencyCase.status,
    note: emergencyCase.note,
    payload: {
      priority: emergencyCase.priority,
      location_text: emergencyCase.location_text,
      symptoms: emergencyCase.symptoms,
    },
  });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.EMERGENCY_CREATED,
    aggregateType: 'emergency_case',
    aggregateId: emergencyCase._id,
    recipientScope: {
      patient_id: patientId,
      emergency_case_id: emergencyCase._id,
      department_id: emergencyCase.assigned_department_id,
      user_id: emergencyCase.assigned_to_user_id,
      role: ['nurse', 'admin'],
      rooms: ['department:emergency'],
      recipients: [{ recipient_type: 'patient', recipient_id: patientId, patient_id: patientId }],
    },
    payload: {
      case_id: toId(emergencyCase._id),
      case_code: emergencyCase.case_code,
      priority: emergencyCase.priority,
      location_lat: emergencyCase.location_lat,
      location_lng: emergencyCase.location_lng,
      notification: {
        title: 'SOS khẩn cấp đã được gửi',
        body: `Mã ca ${emergencyCase.case_code} đã được tạo.`,
        priority: 'critical',
      },
    },
  });
  return emergencyCase.toObject();
}

async function listCases(query = {}, actor = {}) {
  requireStaff(actor);
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  for (const field of ['patient_id', 'status', 'priority', 'assigned_department_id', 'assigned_to_user_id', 'type']) {
    if (!query[field]) continue;
    const values = splitCsv(query[field]);
    filter[field] = values.length > 1 ? { $in: values } : query[field];
  }
  const q = normalizeString(query.q || query.search);
  if (q) {
    const pattern = new RegExp(escapeRegExp(q), 'i');
    const patients = await Patient.find({
      is_deleted: false,
      $or: [
        { patient_code: pattern },
        { full_name: pattern },
        { phone: pattern },
      ],
    }).select('_id').limit(40).lean();
    filter.$or = [
      { case_code: pattern },
      { location_text: pattern },
      { symptoms: pattern },
      { note: pattern },
      { patient_id: { $in: patients.map((patient) => patient._id) } },
    ];
  }
  const [items, total] = await Promise.all([
    EmergencyCase.find(filter)
      .sort({ escalation_level: -1, sla_breached_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone date_of_birth gender')
      .populate('assigned_to_user_id', 'full_name username employee_code')
      .populate('primary_nurse_id', 'full_name username employee_code')
      .populate('primary_doctor_id', 'full_name username employee_code')
      .populate('assigned_department_id', 'department_name department_code')
      .lean(),
    EmergencyCase.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getCase(caseId, actor = {}) {
  const emergencyCase = await EmergencyCase.findById(caseId)
    .populate('patient_id', 'patient_code full_name phone date_of_birth gender')
    .populate('assigned_to_user_id', 'full_name username employee_code')
    .populate('primary_nurse_id', 'full_name username employee_code')
    .populate('primary_doctor_id', 'full_name username employee_code')
    .populate('assigned_department_id', 'department_name department_code')
    .lean();
  if (!emergencyCase) throw createError('Không tìm thấy emergency case.', 404);
  if (actorContext.getActorType(actor) !== ACTOR_TYPE.STAFF && toId(actorContext.getPatientId(actor)) !== toId(emergencyCase.patient_id?._id || emergencyCase.patient_id)) {
    throw createError('Bạn không có quyền xem emergency case này.', 403);
  }
  return emergencyCase;
}

async function transitionCase(caseId, status, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const emergencyCase = await EmergencyCase.findById(caseId);
  if (!emergencyCase) throw createError('Không tìm thấy emergency case.', 404);
  const fromStatus = emergencyCase.status;
  emergencyCase.status = status;
  if (payload.assigned_to_user_id || payload.assignedToUserId) emergencyCase.assigned_to_user_id = payload.assigned_to_user_id || payload.assignedToUserId;
  if (payload.assigned_department_id || payload.assignedDepartmentId) emergencyCase.assigned_department_id = payload.assigned_department_id || payload.assignedDepartmentId;
  if (payload.primary_nurse_id || payload.primaryNurseId) emergencyCase.primary_nurse_id = payload.primary_nurse_id || payload.primaryNurseId;
  if (payload.primary_doctor_id || payload.primaryDoctorId) emergencyCase.primary_doctor_id = payload.primary_doctor_id || payload.primaryDoctorId;
  if (payload.note) emergencyCase.note = payload.note;
  if (status === EMERGENCY_STATUS.ACKNOWLEDGED && !emergencyCase.acknowledged_at) emergencyCase.acknowledged_at = new Date();
  if (status === EMERGENCY_STATUS.TRIAGED && !emergencyCase.triaged_at) emergencyCase.triaged_at = new Date();
  if (status === EMERGENCY_STATUS.DISPATCHED && !emergencyCase.dispatched_at) emergencyCase.dispatched_at = new Date();
  if ([EMERGENCY_STATUS.RESOLVED, EMERGENCY_STATUS.CANCELLED, EMERGENCY_STATUS.FALSE_ALARM].includes(status)) {
    emergencyCase.resolved_at = new Date();
    emergencyCase.closed_at = emergencyCase.resolved_at;
    emergencyCase.closed_by = actor.userId;
    emergencyCase.close_reason = payload.reason || payload.close_reason || payload.transition_reason;
    emergencyCase.outcome = payload.outcome || emergencyCase.outcome;
    emergencyCase.disposition = payload.disposition || emergencyCase.disposition;
  }
  emergencyCase.metadata = { ...(emergencyCase.metadata || {}), ...(payload.metadata || {}), transition_reason: payload.reason || payload.transition_reason };
  setDefaultDueDates(emergencyCase);
  emergencyCase.updated_by = actor.userId;
  await emergencyCase.save();
  await appendCaseEvent(emergencyCase._id, status, {
    actor,
    fromStatus,
    toStatus: status,
    note: payload.note || payload.reason || payload.transition_reason,
    payload,
  });
  await recordAuditLog({ actor, action: `emergency.${status}`, targetType: 'emergency_case', targetId: emergencyCase._id, status: 'success', message: 'Cập nhật emergency case.', requestMeta });
  const eventTypeByStatus = {
    [EMERGENCY_STATUS.ACKNOWLEDGED]: REALTIME_EVENT_TYPE.EMERGENCY_ACKNOWLEDGED,
    [EMERGENCY_STATUS.TRIAGED]: REALTIME_EVENT_TYPE.EMERGENCY_TRIAGED,
    [EMERGENCY_STATUS.DISPATCHED]: REALTIME_EVENT_TYPE.EMERGENCY_DISPATCHED,
    [EMERGENCY_STATUS.RESOLVED]: REALTIME_EVENT_TYPE.EMERGENCY_RESOLVED,
    [EMERGENCY_STATUS.CANCELLED]: REALTIME_EVENT_TYPE.EMERGENCY_CANCELLED,
    [EMERGENCY_STATUS.FALSE_ALARM]: REALTIME_EVENT_TYPE.EMERGENCY_CANCELLED,
  };
  await eventBus.publishDomainEvent({
    eventType: eventTypeByStatus[status] || `emergency.${status}`,
    aggregateType: 'emergency_case',
    aggregateId: emergencyCase._id,
    recipientScope: {
      patient_id: emergencyCase.patient_id,
      emergency_case_id: emergencyCase._id,
      department_id: emergencyCase.assigned_department_id,
      user_id: emergencyCase.assigned_to_user_id,
      role: ['nurse', 'admin'],
      rooms: ['department:emergency'],
      recipients: [{ recipient_type: 'patient', recipient_id: emergencyCase.patient_id, patient_id: emergencyCase.patient_id }],
    },
    payload: {
      case_id: toId(emergencyCase._id),
      case_code: emergencyCase.case_code,
      status,
      notification: {
        title: 'Cập nhật ca khẩn cấp',
        body: `Ca ${emergencyCase.case_code} chuyển sang ${status}.`,
        priority: 'urgent',
      },
    },
  });
  return getCase(emergencyCase._id, actor);
}

async function assignCase(caseId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const emergencyCase = await EmergencyCase.findById(caseId);
  if (!emergencyCase) throw createError('Không tìm thấy emergency case.', 404);
  if (payload.assigned_to_user_id || payload.assignedToUserId) emergencyCase.assigned_to_user_id = payload.assigned_to_user_id || payload.assignedToUserId;
  if (payload.assigned_department_id || payload.assignedDepartmentId) emergencyCase.assigned_department_id = payload.assigned_department_id || payload.assignedDepartmentId;
  if (payload.primary_nurse_id || payload.primaryNurseId) emergencyCase.primary_nurse_id = payload.primary_nurse_id || payload.primaryNurseId;
  if (payload.primary_doctor_id || payload.primaryDoctorId) emergencyCase.primary_doctor_id = payload.primary_doctor_id || payload.primaryDoctorId;
  emergencyCase.updated_by = actor.userId;
  await emergencyCase.save();
  await appendCaseEvent(emergencyCase._id, 'assigned', { actor, toStatus: emergencyCase.status, note: payload.note, payload });
  await recordAuditLog({ actor, action: 'emergency.assigned', targetType: 'emergency_case', targetId: emergencyCase._id, status: 'success', message: 'Phân công emergency case.', requestMeta });
  return getCase(emergencyCase._id, actor);
}

async function escalateCase(caseId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const emergencyCase = await EmergencyCase.findById(caseId);
  if (!emergencyCase) throw createError('Không tìm thấy emergency case.', 404);
  emergencyCase.priority = EMERGENCY_PRIORITY.CRITICAL;
  emergencyCase.escalation_level = Number(emergencyCase.escalation_level || 0) + 1;
  emergencyCase.escalated_at = new Date();
  if (payload.assigned_to_user_id || payload.assignedToUserId) emergencyCase.assigned_to_user_id = payload.assigned_to_user_id || payload.assignedToUserId;
  if (payload.assigned_department_id || payload.assignedDepartmentId) emergencyCase.assigned_department_id = payload.assigned_department_id || payload.assignedDepartmentId;
  emergencyCase.metadata = { ...(emergencyCase.metadata || {}), escalation_reason: payload.reason || payload.note };
  emergencyCase.sla_status = 'escalated';
  emergencyCase.sla_breached_at = emergencyCase.sla_breached_at || new Date();
  emergencyCase.updated_by = actor.userId;
  await emergencyCase.save();
  await appendCaseEvent(emergencyCase._id, 'escalated', { actor, toStatus: emergencyCase.status, note: payload.reason || payload.note, payload });
  await recordAuditLog({ actor, action: 'emergency.escalated', targetType: 'emergency_case', targetId: emergencyCase._id, status: 'success', message: 'Escalate emergency case.', requestMeta });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.EMERGENCY_ESCALATED,
    aggregateType: 'emergency_case',
    aggregateId: emergencyCase._id,
    recipientScope: {
      patient_id: emergencyCase.patient_id,
      emergency_case_id: emergencyCase._id,
      department_id: emergencyCase.assigned_department_id,
      user_id: emergencyCase.assigned_to_user_id,
      role: ['nurse', 'doctor', 'admin'],
      rooms: ['department:emergency'],
    },
    payload: {
      case_id: toId(emergencyCase._id),
      case_code: emergencyCase.case_code,
      escalation_level: emergencyCase.escalation_level,
      priority: emergencyCase.priority,
    },
  });
  return getCase(emergencyCase._id, actor);
}

async function updateCaseLocation(caseId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const emergencyCase = await EmergencyCase.findById(caseId);
  if (!emergencyCase) throw createError('Không tìm thấy emergency case.', 404);
  if (payload.location_lat !== undefined || payload.locationLat !== undefined) emergencyCase.location_lat = payload.location_lat ?? payload.locationLat;
  if (payload.location_lng !== undefined || payload.locationLng !== undefined) emergencyCase.location_lng = payload.location_lng ?? payload.locationLng;
  if (payload.location_text !== undefined || payload.locationText !== undefined) emergencyCase.location_text = payload.location_text || payload.locationText;
  emergencyCase.updated_by = actor.userId;
  await emergencyCase.save();
  await appendCaseEvent(emergencyCase._id, 'location_updated', { actor, toStatus: emergencyCase.status, note: payload.note, payload });
  await recordAuditLog({ actor, action: 'emergency.location_updated', targetType: 'emergency_case', targetId: emergencyCase._id, status: 'success', message: 'Cập nhật vị trí emergency case.', requestMeta });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.EMERGENCY_LOCATION_UPDATED,
    aggregateType: 'emergency_case',
    aggregateId: emergencyCase._id,
    recipientScope: {
      patient_id: emergencyCase.patient_id,
      emergency_case_id: emergencyCase._id,
      department_id: emergencyCase.assigned_department_id,
      user_id: emergencyCase.assigned_to_user_id,
      role: ['nurse', 'doctor', 'admin'],
      rooms: ['department:emergency'],
    },
    payload: {
      case_id: toId(emergencyCase._id),
      case_code: emergencyCase.case_code,
      location_lat: emergencyCase.location_lat,
      location_lng: emergencyCase.location_lng,
      location_text: emergencyCase.location_text,
    },
  });
  return getCase(emergencyCase._id, actor);
}

async function addCaseNote(caseId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const emergencyCase = await EmergencyCase.findById(caseId);
  if (!emergencyCase) throw createError('Không tìm thấy emergency case.', 404);
  if (payload.note) emergencyCase.note = payload.note;
  emergencyCase.updated_by = actor.userId;
  await emergencyCase.save();
  await appendCaseEvent(emergencyCase._id, 'note_added', { actor, toStatus: emergencyCase.status, note: payload.note, payload });
  await recordAuditLog({ actor, action: 'emergency.note_added', targetType: 'emergency_case', targetId: emergencyCase._id, status: 'success', message: 'Thêm ghi chú emergency case.', requestMeta });
  return getCase(emergencyCase._id, actor);
}

async function getCaseTimeline(caseId, actor = {}) {
  const emergencyCase = await getCase(caseId, actor);
  const events = await EmergencyCaseEvent.find({ case_id: caseId })
    .sort({ created_at: -1 })
    .populate('actor_id', 'full_name employee_code')
    .lean();
  return {
    case: emergencyCase,
    items: events.map((event) => ({
      id: toId(event._id),
      event_type: event.event_type,
      from_status: event.from_status,
      to_status: event.to_status,
      note: event.note,
      payload: event.payload || {},
      actor: event.actor_id,
      created_at: event.created_at,
    })),
  };
}

async function listFormattedCases(filter = {}, query = {}, actor = {}) {
  requireStaff(actor);
  const { page, limit, skip } = getPagination(query);
  const items = await EmergencyCase.find(filter)
    .sort({ escalation_level: -1, sla_breached_at: -1, created_at: -1 })
    .skip(skip)
    .limit(limit)
    .populate('patient_id', 'patient_code full_name phone date_of_birth gender')
    .populate('assigned_to_user_id', 'full_name username employee_code')
    .populate('primary_nurse_id', 'full_name username employee_code')
    .populate('primary_doctor_id', 'full_name username employee_code')
    .populate('assigned_department_id', 'department_name department_code')
    .lean();
  const total = await EmergencyCase.countDocuments(filter);
  const vitalMap = await latestVitalForCases(items);
  const now = new Date();
  const formatted = items.map((item) => formatCase(item, vitalMap.get(toId(item.related_encounter_id)), now))
    .sort((left, right) => {
      const priorityRank = { critical: 2, urgent: 1 };
      const statusRank = { breached: 5, escalated: 4, at_risk: 3, on_time: 2, closed: 1 };
      return (statusRank[right.sla.status] || 0) - (statusRank[left.sla.status] || 0)
        || (priorityRank[right.priority] || 0) - (priorityRank[left.priority] || 0)
        || new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
    });

  return { items: formatted, pagination: buildPagination(page, limit, total) };
}

async function listOpenCases(query = {}, actor = {}) {
  const filter = { status: { $in: OPEN_CASE_STATUSES } };
  if (query.priority && query.priority !== 'all') filter.priority = query.priority;
  if (query.status && query.status !== 'all') filter.status = { $in: splitCsv(query.status).length ? splitCsv(query.status) : [query.status] };
  if (query.type && query.type !== 'all') filter.type = query.type;
  if (query.assigned_department_id) filter.assigned_department_id = query.assigned_department_id;
  if (query.assigned_to_user_id) filter.assigned_to_user_id = query.assigned_to_user_id;
  if (query.q || query.search) {
    const pattern = new RegExp(escapeRegExp(query.q || query.search), 'i');
    const patients = await Patient.find({
      is_deleted: false,
      $or: [{ patient_code: pattern }, { full_name: pattern }, { phone: pattern }],
    }).select('_id').limit(40).lean();
    filter.$or = [
      { case_code: pattern },
      { location_text: pattern },
      { symptoms: pattern },
      { note: pattern },
      { patient_id: { $in: patients.map((patient) => patient._id) } },
    ];
  }
  return listFormattedCases(filter, query, actor);
}

async function listClosedCases(query = {}, actor = {}) {
  const statuses = query.status && query.status !== 'all' ? splitCsv(query.status) : CLOSED_CASE_STATUSES;
  const filter = { status: { $in: statuses.length ? statuses : CLOSED_CASE_STATUSES } };
  if (query.priority && query.priority !== 'all') filter.priority = query.priority;
  if (query.type && query.type !== 'all') filter.type = query.type;
  return listFormattedCases(filter, query, actor);
}

async function getOpenSummary(query = {}, actor = {}) {
  requireStaff(actor);
  const { items } = await listOpenCases({ ...query, limit: query.limit || 500 }, actor);
  const ackSeconds = items.map((item) => item.sla.acknowledge_seconds).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const medianAck = ackSeconds.length ? ackSeconds[Math.floor(ackSeconds.length / 2)] : null;
  const counters = {
    open: items.length,
    critical: items.filter((item) => item.priority === EMERGENCY_PRIORITY.CRITICAL).length,
    urgent: items.filter((item) => item.priority === EMERGENCY_PRIORITY.URGENT).length,
    unassigned: items.filter((item) => !item.assigned_to?.user_id).length,
    acknowledged: items.filter((item) => item.status === EMERGENCY_STATUS.ACKNOWLEDGED).length,
    triaged: items.filter((item) => item.status === EMERGENCY_STATUS.TRIAGED).length,
    dispatched: items.filter((item) => item.status === EMERGENCY_STATUS.DISPATCHED).length,
    breached: items.filter((item) => item.sla.status === 'breached').length,
    at_risk: items.filter((item) => item.sla.status === 'at_risk').length,
    escalated: items.filter((item) => item.sla.status === 'escalated').length,
    patient_sos: items.filter((item) => ['patient_app', 'relative_app'].includes(item.source)).length,
    staff_created: items.filter((item) => item.source === 'staff_created').length,
    with_gps: items.filter((item) => item.location_lat && item.location_lng).length,
    severe_allergy: items.filter((item) => (item.metadata?.patient_risk_snapshot?.allergies || []).some((allergy) => ['severe', 'life_threatening'].includes(allergy.severity))).length,
  };

  return {
    generated_at: new Date().toISOString(),
    counters,
    median_acknowledge_seconds: medianAck,
    median_acknowledge_label: medianAck === null ? null : `${Math.floor(medianAck / 60)}:${String(medianAck % 60).padStart(2, '0')}`,
    items: items.slice(0, 20),
  };
}

async function updateCasePriority(caseId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const emergencyCase = await EmergencyCase.findById(caseId);
  if (!emergencyCase) throw createError('Không tìm thấy emergency case.', 404);
  const priority = normalizeEnum(payload.priority, EMERGENCY_PRIORITIES, emergencyCase.priority, 'priority');
  const before = emergencyCase.priority;
  emergencyCase.priority = priority;
  emergencyCase.sla_next_due_at = nextDueForStatus(emergencyCase);
  emergencyCase.sla_status = slaStatusForCase(emergencyCase);
  emergencyCase.updated_by = actor.userId;
  await emergencyCase.save();
  await appendCaseEvent(emergencyCase._id, 'priority_changed', {
    actor,
    toStatus: emergencyCase.status,
    note: payload.reason || payload.note,
    payload: { from_priority: before, to_priority: priority, ...payload },
  });
  await recordAuditLog({ actor, action: 'emergency.priority_changed', targetType: 'emergency_case', targetId: emergencyCase._id, status: 'success', message: 'Đổi priority emergency case.', requestMeta });
  return getCase(emergencyCase._id, actor);
}

async function notifyDoctor(caseId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const emergencyCase = await EmergencyCase.findById(caseId);
  if (!emergencyCase) throw createError('Không tìm thấy emergency case.', 404);
  emergencyCase.primary_doctor_id = payload.doctor_id || payload.primary_doctor_id || payload.primaryDoctorId || emergencyCase.primary_doctor_id;
  emergencyCase.doctor_notified_at = new Date();
  emergencyCase.metadata = {
    ...(emergencyCase.metadata || {}),
    doctor_notification: {
      doctor_id: toId(emergencyCase.primary_doctor_id),
      channel: payload.channel || 'in_app',
      message: payload.message || payload.note || emergencyCase.symptoms,
      notified_at: emergencyCase.doctor_notified_at,
    },
  };
  emergencyCase.updated_by = actor.userId;
  await emergencyCase.save();
  await appendCaseEvent(emergencyCase._id, 'doctor_notified', {
    actor,
    toStatus: emergencyCase.status,
    note: payload.message || payload.note,
    payload,
  });
  await eventBus.publishDomainEvent({
    eventType: 'emergency.doctor_notified',
    aggregateType: 'emergency_case',
    aggregateId: emergencyCase._id,
    recipientScope: {
      patient_id: emergencyCase.patient_id,
      emergency_case_id: emergencyCase._id,
      department_id: emergencyCase.assigned_department_id,
      user_id: emergencyCase.primary_doctor_id,
      role: ['doctor', 'nurse', 'admin'],
      rooms: ['department:emergency'],
    },
    payload: {
      case_id: toId(emergencyCase._id),
      case_code: emergencyCase.case_code,
      doctor_id: toId(emergencyCase.primary_doctor_id),
      notification: {
        title: 'Cần bác sĩ phản hồi ca cấp cứu',
        body: payload.message || `Ca ${emergencyCase.case_code} cần bác sĩ đánh giá.`,
        priority: emergencyCase.priority === EMERGENCY_PRIORITY.CRITICAL ? 'critical' : 'urgent',
      },
    },
  });
  await recordAuditLog({ actor, action: 'emergency.doctor_notified', targetType: 'emergency_case', targetId: emergencyCase._id, status: 'success', message: 'Báo bác sĩ cho emergency case.', requestMeta });
  return getCase(emergencyCase._id, actor);
}

function applyTriagePayload(triage, payload = {}) {
  for (const field of TRIAGE_EDITABLE_FIELDS) {
    if (payload[field] !== undefined) triage[field] = payload[field];
  }
  if (payload.onset_time) triage.onset_time = new Date(payload.onset_time);
  return triage;
}

async function findOrCreateTriage(caseId, payload = {}, actor = {}) {
  const emergencyCase = await EmergencyCase.findById(caseId);
  if (!emergencyCase) throw createError('Không tìm thấy emergency case.', 404);
  let triage = await EmergencyTriage.findOne({
    emergency_case_id: emergencyCase._id,
    status: { $in: ['draft', 'in_progress'] },
  }).sort({ created_at: -1 });
  if (!triage) {
    triage = new EmergencyTriage({
      emergency_case_id: emergencyCase._id,
      patient_id: emergencyCase.patient_id,
      encounter_id: emergencyCase.related_encounter_id,
      triage_by: actor.userId,
      status: payload.status || 'draft',
      created_by: actor.userId,
      updated_by: actor.userId,
    });
  }
  applyTriagePayload(triage, payload);
  return { emergencyCase, triage };
}

async function startEmergencyTriage(caseId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const { emergencyCase, triage } = await findOrCreateTriage(caseId, payload, actor);
  triage.status = 'in_progress';
  triage.triage_by = triage.triage_by || actor.userId;
  triage.triage_started_at = triage.triage_started_at || new Date();
  triage.updated_by = actor.userId;
  await triage.save();
  emergencyCase.metadata = { ...(emergencyCase.metadata || {}), triage_started_at: triage.triage_started_at };
  if (emergencyCase.status === EMERGENCY_STATUS.CREATED && !emergencyCase.acknowledged_at) {
    emergencyCase.status = EMERGENCY_STATUS.ACKNOWLEDGED;
    emergencyCase.acknowledged_at = new Date();
  }
  setDefaultDueDates(emergencyCase);
  emergencyCase.updated_by = actor.userId;
  await emergencyCase.save();
  await appendCaseEvent(caseId, 'triage_started', { actor, toStatus: emergencyCase.status, note: payload.note, payload });
  await recordAuditLog({ actor, action: 'emergency.triage_started', targetType: 'emergency_case', targetId: emergencyCase._id, status: 'success', message: 'Bắt đầu triage emergency case.', requestMeta });
  return getCaseTriage(caseId, actor);
}

async function saveEmergencyTriageDraft(caseId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const { emergencyCase, triage } = await findOrCreateTriage(caseId, payload, actor);
  triage.status = triage.status === 'in_progress' ? 'in_progress' : 'draft';
  triage.updated_by = actor.userId;
  await triage.save();
  await appendCaseEvent(emergencyCase._id, 'triage_draft_saved', { actor, toStatus: emergencyCase.status, note: payload.note, payload });
  await recordAuditLog({ actor, action: 'emergency.triage_draft_saved', targetType: 'emergency_triage', targetId: triage._id, status: 'success', message: 'Lưu nháp triage emergency case.', requestMeta });
  return getCaseTriage(caseId, actor);
}

async function completeEmergencyTriage(caseId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const { emergencyCase, triage } = await findOrCreateTriage(caseId, payload, actor);
  const fromStatus = emergencyCase.status;
  triage.status = 'completed';
  triage.triage_by = triage.triage_by || actor.userId;
  triage.triage_started_at = triage.triage_started_at || new Date();
  triage.triage_completed_at = new Date();
  triage.final_priority = triage.final_priority || payload.priority || emergencyCase.priority;
  triage.updated_by = actor.userId;
  await triage.save();

  emergencyCase.status = EMERGENCY_STATUS.TRIAGED;
  emergencyCase.priority = triage.final_priority || emergencyCase.priority;
  emergencyCase.triaged_at = triage.triage_completed_at;
  emergencyCase.triage_level = triage.esi_level ? `ESI ${triage.esi_level}` : emergencyCase.triage_level;
  emergencyCase.triage_color = triage.triage_color || emergencyCase.triage_color;
  emergencyCase.esi_level = triage.esi_level || emergencyCase.esi_level;
  emergencyCase.metadata = {
    ...(emergencyCase.metadata || {}),
    emergency_triage_id: triage._id,
    triage_summary: {
      esi_level: triage.esi_level,
      triage_color: triage.triage_color,
      final_priority: triage.final_priority,
      risk_flags: triage.risk_flags,
      recommended_actions: triage.recommended_actions,
      doctor_required: triage.doctor_required,
      dispatch_required: triage.dispatch_required,
    },
  };
  setDefaultDueDates(emergencyCase);
  emergencyCase.updated_by = actor.userId;
  await emergencyCase.save();
  await appendCaseEvent(emergencyCase._id, 'triage_completed', {
    actor,
    fromStatus,
    toStatus: emergencyCase.status,
    note: triage.note,
    payload: triage.toObject(),
  });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.EMERGENCY_TRIAGED,
    aggregateType: 'emergency_case',
    aggregateId: emergencyCase._id,
    recipientScope: {
      patient_id: emergencyCase.patient_id,
      emergency_case_id: emergencyCase._id,
      department_id: emergencyCase.assigned_department_id,
      user_id: emergencyCase.assigned_to_user_id,
      role: ['nurse', 'doctor', 'admin'],
      rooms: ['department:emergency'],
    },
    payload: {
      case_id: toId(emergencyCase._id),
      case_code: emergencyCase.case_code,
      triage_id: toId(triage._id),
      priority: emergencyCase.priority,
      esi_level: triage.esi_level,
      triage_color: triage.triage_color,
    },
  });
  await recordAuditLog({ actor, action: 'emergency.triage_completed', targetType: 'emergency_triage', targetId: triage._id, status: 'success', message: 'Hoàn tất triage emergency case.', requestMeta });
  return getCaseTriage(caseId, actor);
}

async function getCaseTriage(caseId, actor = {}) {
  await getCase(caseId, actor);
  const triage = await EmergencyTriage.findOne({ emergency_case_id: caseId })
    .sort({ created_at: -1 })
    .populate('triage_by', 'full_name employee_code')
    .populate('signed_by', 'full_name employee_code')
    .lean();
  return { triage };
}

async function updateEmergencyTriage(triageId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const triage = await EmergencyTriage.findById(triageId);
  if (!triage) throw createError('Không tìm thấy emergency triage.', 404);
  if (['signed', 'cancelled', 'entered_in_error'].includes(triage.status)) throw createError('Phiếu triage đã khóa, không thể sửa.', 409);
  applyTriagePayload(triage, payload);
  triage.updated_by = actor.userId;
  await triage.save();
  await appendCaseEvent(triage.emergency_case_id, 'triage_updated', { actor, toStatus: undefined, note: payload.note, payload });
  await recordAuditLog({ actor, action: 'emergency.triage_updated', targetType: 'emergency_triage', targetId: triage._id, status: 'success', message: 'Cập nhật emergency triage.', requestMeta });
  return getCaseTriage(triage.emergency_case_id, actor);
}

async function signEmergencyTriage(triageId, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const triage = await EmergencyTriage.findById(triageId);
  if (!triage) throw createError('Không tìm thấy emergency triage.', 404);
  if (triage.status !== 'completed') throw createError('Chỉ ký phiếu triage đã hoàn tất.', 409);
  triage.status = 'signed';
  triage.signed_by = actor.userId;
  triage.signed_at = new Date();
  triage.updated_by = actor.userId;
  await triage.save();
  await appendCaseEvent(triage.emergency_case_id, 'triage_signed', { actor, note: 'Ký phiếu triage cấp cứu.', payload: { triage_id: triage._id } });
  await recordAuditLog({ actor, action: 'emergency.triage_signed', targetType: 'emergency_triage', targetId: triage._id, status: 'success', message: 'Ký emergency triage.', requestMeta });
  return getCaseTriage(triage.emergency_case_id, actor);
}

async function getTriageQueue(query = {}, actor = {}) {
  const statuses = query.status && query.status !== 'all' ? splitCsv(query.status) : [EMERGENCY_STATUS.CREATED, EMERGENCY_STATUS.ACKNOWLEDGED];
  const result = await listFormattedCases({ status: { $in: statuses } }, { ...query, limit: query.limit || 100 }, actor);
  const triages = await EmergencyTriage.find({ emergency_case_id: { $in: result.items.map((item) => item.case_id) } })
    .sort({ created_at: -1 })
    .lean();
  const triageMap = new Map();
  for (const triage of triages) {
    const key = toId(triage.emergency_case_id);
    if (!triageMap.has(key)) triageMap.set(key, triage);
  }
  return {
    ...result,
    items: result.items.map((item) => ({ ...item, triage: triageMap.get(item.case_id) || null })),
    summary: {
      waiting: result.items.filter((item) => item.status === EMERGENCY_STATUS.CREATED).length,
      in_progress: triages.filter((item) => item.status === 'in_progress').length,
      critical: result.items.filter((item) => item.priority === EMERGENCY_PRIORITY.CRITICAL).length,
    },
  };
}

async function getDispatchBoard(query = {}, actor = {}) {
  const result = await listFormattedCases({
    status: { $in: [EMERGENCY_STATUS.CREATED, EMERGENCY_STATUS.ACKNOWLEDGED, EMERGENCY_STATUS.TRIAGED, EMERGENCY_STATUS.DISPATCHED] },
  }, { ...query, limit: query.limit || 120 }, actor);
  const needDispatch = result.items.filter((item) => (
    item.priority === EMERGENCY_PRIORITY.CRITICAL
    || item.status === EMERGENCY_STATUS.TRIAGED
    || item.type === EMERGENCY_CASE_TYPE.FALL
    || item.metadata?.triage_summary?.dispatch_required
    || item.sla.status === 'breached'
  ));
  return {
    generated_at: new Date().toISOString(),
    cases: needDispatch,
    active_dispatches: result.items.filter((item) => item.status === EMERGENCY_STATUS.DISPATCHED),
    teams: [
      { team_code: 'ERT-01', name: 'Đội phản ứng nhanh 1', status: 'available', eta_minutes: 3, equipment: ['Oxy', 'Monitor', 'Cáng'] },
      { team_code: 'ERT-02', name: 'Đội cấp cứu nội viện', status: 'busy', eta_minutes: 7, equipment: ['Defibrillator', 'Emergency cart'] },
      { team_code: 'ICU-LIAISON', name: 'Liên lạc ICU', status: 'available', eta_minutes: 5, equipment: ['Monitor', 'Ventilator handoff'] },
    ],
    summary: {
      need_dispatch: needDispatch.length,
      en_route: result.items.filter((item) => item.metadata?.dispatch?.status === 'en_route').length,
      arrived_scene: result.items.filter((item) => item.metadata?.dispatch?.status === 'arrived_at_scene').length,
      transporting: result.items.filter((item) => item.metadata?.dispatch?.status === 'transporting').length,
      dispatched: result.items.filter((item) => item.status === EMERGENCY_STATUS.DISPATCHED).length,
    },
  };
}

async function getEscalations(query = {}, actor = {}) {
  const result = await listFormattedCases({
    status: { $in: OPEN_CASE_STATUSES },
    $or: [
      { escalated_at: { $exists: true, $ne: null } },
      { escalation_level: { $gt: 0 } },
      { sla_breached_at: { $exists: true, $ne: null } },
      { 'metadata.escalated_at': { $exists: true, $ne: null } },
    ],
  }, { ...query, limit: query.limit || 120 }, actor);
  const items = result.items.map((item) => ({
    id: `esc_${item.case_id}`,
    escalation_id: `case_${item.case_id}`,
    case: item,
    case_id: item.case_id,
    case_code: item.case_code,
    patient: item.patient,
    priority: item.priority,
    case_status: item.status,
    level: item.escalation_level || 1,
    reason: item.metadata?.escalation_reason || (item.sla.status === 'breached' ? 'sla_breached' : 'manual_escalation'),
    status: item.sla.status === 'closed' ? 'resolved' : 'open',
    triggered_at: item.escalated_at || item.sla.next_due_at || item.created_at,
    overdue_seconds: item.sla.next_due_seconds !== null && item.sla.next_due_seconds < 0 ? Math.abs(item.sla.next_due_seconds) : 0,
    owner: item.assigned_to,
    department: item.assigned_department,
  }));
  return {
    items,
    summary: {
      open: items.filter((item) => item.status === 'open').length,
      unacknowledged: items.filter((item) => item.case_status === EMERGENCY_STATUS.CREATED).length,
      triage_delay: items.filter((item) => item.case_status === EMERGENCY_STATUS.ACKNOWLEDGED).length,
      dispatch_delay: items.filter((item) => item.case_status === EMERGENCY_STATUS.TRIAGED).length,
      critical_no_owner: items.filter((item) => item.priority === EMERGENCY_PRIORITY.CRITICAL && !item.owner?.user_id).length,
    },
  };
}

async function getSlaBoard(query = {}, actor = {}) {
  const result = await listFormattedCases({
    status: { $in: [...OPEN_CASE_STATUSES, ...CLOSED_CASE_STATUSES] },
  }, { ...query, limit: query.limit || 200 }, actor);
  const rows = result.items.map((item) => ({
    ...item,
    overall_sla: item.sla.status,
    acknowledge_actual_at: item.acknowledged_at,
    triage_actual_at: item.triaged_at,
    dispatch_actual_at: item.dispatched_at,
    doctor_response_actual_at: item.doctor_acknowledged_at || item.doctor_seen_at,
    resolve_actual_at: item.resolved_at,
  }));
  const openRows = rows.filter((item) => OPEN_CASE_STATUSES.includes(item.status));
  const closedRows = rows.filter((item) => CLOSED_CASE_STATUSES.includes(item.status));
  const ackTimes = rows.map((item) => item.sla.acknowledge_seconds).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  return {
    generated_at: new Date().toISOString(),
    items: rows,
    analytics: {
      by_status: OPEN_CASE_STATUSES.map((status) => ({ label: status, value: rows.filter((item) => item.status === status).length })),
      by_priority: EMERGENCY_PRIORITIES.map((priority) => ({ label: priority, value: rows.filter((item) => item.priority === priority).length })),
      by_sla: ['on_time', 'at_risk', 'breached', 'escalated', 'closed'].map((status) => ({ label: status, value: rows.filter((item) => item.sla.status === status).length })),
    },
    summary: {
      total: rows.length,
      open: openRows.length,
      closed: closedRows.length,
      at_risk: rows.filter((item) => item.sla.status === 'at_risk').length,
      breached: rows.filter((item) => item.sla.status === 'breached').length,
      escalated: rows.filter((item) => item.sla.status === 'escalated').length,
      compliance_percent: rows.length ? Math.round((rows.filter((item) => !['breached', 'escalated'].includes(item.sla.status)).length / rows.length) * 100) : 100,
      median_acknowledge_seconds: ackTimes.length ? ackTimes[Math.floor(ackTimes.length / 2)] : null,
    },
  };
}

module.exports = {
  createSos,
  createCase: createSos,
  listCases,
  listOpenCases,
  listClosedCases,
  getOpenSummary,
  getCase,
  acknowledgeCase: (caseId, payload, actor, requestMeta) => transitionCase(caseId, EMERGENCY_STATUS.ACKNOWLEDGED, payload, actor, requestMeta),
  triageCase: (caseId, payload, actor, requestMeta) => transitionCase(caseId, EMERGENCY_STATUS.TRIAGED, payload, actor, requestMeta),
  dispatchCase: (caseId, payload, actor, requestMeta) => transitionCase(caseId, EMERGENCY_STATUS.DISPATCHED, payload, actor, requestMeta),
  resolveCase: (caseId, payload, actor, requestMeta) => transitionCase(caseId, EMERGENCY_STATUS.RESOLVED, payload, actor, requestMeta),
  cancelCase: (caseId, payload, actor, requestMeta) => transitionCase(caseId, payload.false_alarm ? EMERGENCY_STATUS.FALSE_ALARM : EMERGENCY_STATUS.CANCELLED, payload, actor, requestMeta),
  assignCase,
  updateCasePriority,
  escalateCase,
  updateCaseLocation,
  addCaseNote,
  getCaseTimeline,
  notifyDoctor,
  getTriageQueue,
  startEmergencyTriage,
  saveEmergencyTriageDraft,
  completeEmergencyTriage,
  getCaseTriage,
  updateEmergencyTriage,
  signEmergencyTriage,
  getDispatchBoard,
  getEscalations,
  getSlaBoard,
};
