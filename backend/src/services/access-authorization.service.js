const { BreakGlassAccess, ConsentRecord, Patient } = require('../models');
const {
  ACTOR_TYPE,
  BREAK_GLASS_STATUS,
  CONSENT_STATUS,
  CONSENT_TYPES,
} = require('../constants/statuses');
const { buildPagination, createError, getPagination, recordAuditLog } = require('./core.service');
const actorContext = require('../common/actors');
const { isValidObjectId, toObjectId } = require('../common/helpers/object-id.helper');

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function requireStaff(actor = {}) {
  if (actorContext.getActorType(actor) !== ACTOR_TYPE.STAFF) throw createError('Chỉ nhân sự được thao tác chức năng này.', 403);
}

async function resolvePatient(patientId) {
  if (!patientId || !isValidObjectId(patientId)) throw createError('patient_id không hợp lệ.', 422);
  const patient = await Patient.findOne({ _id: patientId, is_deleted: false }).lean();
  if (!patient) throw createError('Không tìm thấy patient.', 404);
  return patient;
}

function assertSelfPatient(actor = {}, patientId) {
  if (actorContext.getActorType(actor) === ACTOR_TYPE.STAFF) return;
  if (toId(actorContext.getPatientId(actor)) !== toId(patientId)) {
    throw createError('Bạn chỉ được thao tác consent của chính mình.', 403);
  }
}

async function signConsent(payload = {}, actor = {}, requestMeta = {}) {
  const patientId = actorContext.getActorType(actor) === ACTOR_TYPE.STAFF
    ? payload.patient_id || payload.patientId
    : actorContext.getPatientId(actor);
  const patient = await resolvePatient(patientId);
  assertSelfPatient(actor, patient._id);
  const consentType = normalizeString(payload.consent_type || payload.consentType);
  if (!CONSENT_TYPES.includes(consentType)) throw createError('consent_type không hợp lệ.', 422);
  const context = actorContext.buildActorContext(actor);
  const record = await ConsentRecord.create({
    patient_id: patient._id,
    actor_type: context.actor_type,
    actor_id: context.actor_id,
    consent_type: consentType,
    status: CONSENT_STATUS.ACTIVE,
    signed_at: payload.signed_at ? new Date(payload.signed_at) : new Date(),
    expires_at: payload.expires_at ? new Date(payload.expires_at) : undefined,
    document_attachment_id: payload.document_attachment_id || payload.documentAttachmentId,
    signature_data: payload.signature_data || payload.signatureData,
    scope: payload.scope,
    metadata: payload.metadata,
  });
  await recordAuditLog({ actor, action: 'consent.sign', targetType: 'consent_record', targetId: record._id, status: 'success', message: 'Ký consent.', requestMeta, metadata: { patient_id: toId(patient._id), consent_type: consentType } });
  return record.toObject();
}

async function listConsents(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (actorContext.getActorType(actor) === ACTOR_TYPE.STAFF) {
    if (query.patient_id) filter.patient_id = query.patient_id;
  } else {
    filter.patient_id = actorContext.getPatientId(actor);
  }
  if (query.consent_type) filter.consent_type = query.consent_type;
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    ConsentRecord.find(filter).sort({ signed_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    ConsentRecord.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function revokeConsent(consentId, payload = {}, actor = {}, requestMeta = {}) {
  const record = await ConsentRecord.findById(consentId);
  if (!record) throw createError('Không tìm thấy consent.', 404);
  assertSelfPatient(actor, record.patient_id);
  record.status = CONSENT_STATUS.REVOKED;
  record.revoked_at = new Date();
  record.metadata = { ...(record.metadata || {}), revoked_reason: payload.reason || payload.revoked_reason };
  await record.save();
  await recordAuditLog({ actor, action: 'consent.revoke', targetType: 'consent_record', targetId: record._id, status: 'success', message: 'Thu hồi consent.', requestMeta });
  return record.toObject();
}

async function startBreakGlass(payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const reason = normalizeString(payload.reason);
  if (!reason) throw createError('reason là bắt buộc.', 422);
  const patient = await resolvePatient(payload.patient_id || payload.patientId);
  const access = await BreakGlassAccess.create({
    patient_id: patient._id,
    accessed_by_user_id: actorContext.getStaffId(actor),
    reason,
    started_at: new Date(),
    status: BREAK_GLASS_STATUS.ACTIVE,
    metadata: payload.metadata,
  });
  await recordAuditLog({ actor, action: 'break_glass.start', targetType: 'break_glass_access', targetId: access._id, status: 'success', message: 'Bắt đầu break-glass.', requestMeta, metadata: { patient_id: toId(patient._id), reason } });
  return access.toObject();
}

async function endBreakGlass(accessId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const access = accessId
    ? await BreakGlassAccess.findById(accessId)
    : await BreakGlassAccess.findOne({
      accessed_by_user_id: actorContext.getStaffId(actor),
      status: BREAK_GLASS_STATUS.ACTIVE,
      ...(payload.patient_id || payload.patientId ? { patient_id: payload.patient_id || payload.patientId } : {}),
    }).sort({ started_at: -1 });
  if (!access) throw createError('Không tìm thấy break-glass access.', 404);
  if (access.status !== BREAK_GLASS_STATUS.ENDED) {
    access.status = BREAK_GLASS_STATUS.ENDED;
    access.ended_at = new Date();
    access.metadata = { ...(access.metadata || {}), end_reason: payload.reason || payload.end_reason };
    await access.save();
  }
  await recordAuditLog({ actor, action: 'break_glass.end', targetType: 'break_glass_access', targetId: access._id, status: 'success', message: 'Kết thúc break-glass.', requestMeta });
  return access.toObject();
}

async function listBreakGlass(query = {}, actor = {}) {
  requireStaff(actor);
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.patient_id) filter.patient_id = query.patient_id;
  if (query.status) filter.status = query.status;
  if (query.accessed_by_user_id) filter.accessed_by_user_id = query.accessed_by_user_id;
  const [items, total] = await Promise.all([
    BreakGlassAccess.find(filter).sort({ started_at: -1 }).skip(skip).limit(limit).populate('accessed_by_user_id', 'full_name username employee_code').lean(),
    BreakGlassAccess.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

module.exports = {
  signConsent,
  listConsents,
  revokeConsent,
  startBreakGlass,
  endBreakGlass,
  listBreakGlass,
};
