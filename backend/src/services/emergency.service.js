const { randomBytes } = require('crypto');
const { Allergy, EmergencyCase, Patient, ProblemList } = require('../models');
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

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
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
    metadata: {
      ...(payload.metadata || {}),
      patient_risk_snapshot: riskSnapshot,
    },
    created_by: actor.userId,
    updated_by: actor.userId,
  });
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
    if (query[field]) filter[field] = query[field];
  }
  const [items, total] = await Promise.all([
    EmergencyCase.find(filter)
      .sort({ priority: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('assigned_to_user_id', 'full_name username employee_code')
      .lean(),
    EmergencyCase.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getCase(caseId, actor = {}) {
  const emergencyCase = await EmergencyCase.findById(caseId)
    .populate('patient_id', 'patient_code full_name phone date_of_birth gender')
    .populate('assigned_to_user_id', 'full_name username employee_code')
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
  emergencyCase.status = status;
  if (payload.assigned_to_user_id || payload.assignedToUserId) emergencyCase.assigned_to_user_id = payload.assigned_to_user_id || payload.assignedToUserId;
  if (payload.assigned_department_id || payload.assignedDepartmentId) emergencyCase.assigned_department_id = payload.assigned_department_id || payload.assignedDepartmentId;
  if (payload.note) emergencyCase.note = payload.note;
  if (status === EMERGENCY_STATUS.ACKNOWLEDGED && !emergencyCase.acknowledged_at) emergencyCase.acknowledged_at = new Date();
  if ([EMERGENCY_STATUS.RESOLVED, EMERGENCY_STATUS.CANCELLED, EMERGENCY_STATUS.FALSE_ALARM].includes(status)) emergencyCase.resolved_at = new Date();
  emergencyCase.metadata = { ...(emergencyCase.metadata || {}), ...(payload.metadata || {}), transition_reason: payload.reason || payload.transition_reason };
  emergencyCase.updated_by = actor.userId;
  await emergencyCase.save();
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

module.exports = {
  createSos,
  listCases,
  getCase,
  acknowledgeCase: (caseId, payload, actor, requestMeta) => transitionCase(caseId, EMERGENCY_STATUS.ACKNOWLEDGED, payload, actor, requestMeta),
  triageCase: (caseId, payload, actor, requestMeta) => transitionCase(caseId, EMERGENCY_STATUS.TRIAGED, payload, actor, requestMeta),
  dispatchCase: (caseId, payload, actor, requestMeta) => transitionCase(caseId, EMERGENCY_STATUS.DISPATCHED, payload, actor, requestMeta),
  resolveCase: (caseId, payload, actor, requestMeta) => transitionCase(caseId, EMERGENCY_STATUS.RESOLVED, payload, actor, requestMeta),
  cancelCase: (caseId, payload, actor, requestMeta) => transitionCase(caseId, payload.false_alarm ? EMERGENCY_STATUS.FALSE_ALARM : EMERGENCY_STATUS.CANCELLED, payload, actor, requestMeta),
};
