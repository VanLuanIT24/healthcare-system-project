const { Attachment, InsurancePolicy, Patient } = require('../models');
const {
  INSURANCE_POLICY_SOURCE,
  INSURANCE_POLICY_STATUS,
  INSURANCE_VERIFICATION_STATUS,
  REALTIME_EVENT_TYPE,
} = require('../constants/statuses');
const { buildPagination, createError, getPagination, recordAuditLog } = require('./core.service');
const actorContext = require('../common/actors');
const eventBus = require('../events/event-bus.service');

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function patientId(actor = {}) {
  const id = actorContext.getPatientId(actor);
  if (!id) throw createError('Không xác định được patient của portal.', 403);
  return id;
}

function requireStaff(actor = {}) {
  if (actorContext.getActorType(actor) !== 'staff') throw createError('Chỉ nhân sự được thao tác bảo hiểm này.', 403);
}

async function assertPatientExists(id) {
  const patient = await Patient.findOne({ _id: id, is_deleted: false }).lean();
  if (!patient) throw createError('Không tìm thấy patient.', 404);
  return patient;
}

async function getOwnPolicy(policyId, actor = {}) {
  const policy = await InsurancePolicy.findOne({ _id: policyId, patient_id: patientId(actor), is_deleted: false });
  if (!policy) throw createError('Không tìm thấy insurance policy.', 404);
  return policy;
}

async function createMyInsurancePolicy(payload = {}, actor = {}, requestMeta = {}) {
  const pid = patientId(actor);
  await assertPatientExists(pid);
  const payerName = normalizeString(payload.payer_name || payload.payerName);
  const policyNo = normalizeString(payload.policy_no || payload.policyNo);
  if (!payerName) throw createError('payer_name là bắt buộc.', 422);
  if (!policyNo) throw createError('policy_no là bắt buộc.', 422);
  const context = actorContext.buildActorContext(actor);
  const policy = await InsurancePolicy.create({
    patient_id: pid,
    payer_name: payerName,
    payer_code: normalizeString(payload.payer_code || payload.payerCode),
    policy_no: policyNo,
    member_no: normalizeString(payload.member_no || payload.memberNo),
    coverage_type: normalizeString(payload.coverage_type || payload.coverageType),
    coverage_percent: payload.coverage_percent ?? payload.coveragePercent,
    valid_from: payload.valid_from || payload.validFrom,
    valid_to: payload.valid_to || payload.validTo,
    is_primary: Boolean(payload.is_primary || payload.isPrimary),
    source: INSURANCE_POLICY_SOURCE.PATIENT_SUBMITTED,
    verification_status: INSURANCE_VERIFICATION_STATUS.DRAFT,
    submitted_by_actor_type: context.actor_type,
    submitted_by_actor_id: context.actor_id,
    status: INSURANCE_POLICY_STATUS.INACTIVE,
  });
  await recordAuditLog({ actor, action: 'insurance_policy.patient_create', targetType: 'insurance_policy', targetId: policy._id, status: 'success', message: 'Patient tạo insurance policy draft.', requestMeta, metadata: { patient_id: toId(pid) } });
  return policy.toObject();
}

async function updateMyInsurancePolicy(policyId, payload = {}, actor = {}, requestMeta = {}) {
  const policy = await getOwnPolicy(policyId, actor);
  if (policy.verification_status === INSURANCE_VERIFICATION_STATUS.VERIFIED) {
    throw createError('Policy đã verified, không thể sửa từ portal.', 409);
  }
  for (const [field, source] of Object.entries({
    payer_name: payload.payer_name || payload.payerName,
    payer_code: payload.payer_code || payload.payerCode,
    policy_no: payload.policy_no || payload.policyNo,
    member_no: payload.member_no || payload.memberNo,
    coverage_type: payload.coverage_type || payload.coverageType,
    coverage_percent: payload.coverage_percent ?? payload.coveragePercent,
    valid_from: payload.valid_from || payload.validFrom,
    valid_to: payload.valid_to || payload.validTo,
    is_primary: payload.is_primary ?? payload.isPrimary,
  })) {
    if (source !== undefined) policy[field] = source;
  }
  policy.verification_status = INSURANCE_VERIFICATION_STATUS.DRAFT;
  await policy.save();
  await recordAuditLog({ actor, action: 'insurance_policy.patient_update', targetType: 'insurance_policy', targetId: policy._id, status: 'success', message: 'Patient cập nhật insurance policy.', requestMeta });
  return policy.toObject();
}

async function submitMyInsurancePolicy(policyId, actor = {}, requestMeta = {}) {
  const policy = await getOwnPolicy(policyId, actor);
  if (!policy.front_card_attachment_id && !policy.back_card_attachment_id) {
    throw createError('Cần upload ít nhất một mặt thẻ bảo hiểm trước khi submit.', 409);
  }
  const context = actorContext.buildActorContext(actor);
  policy.verification_status = INSURANCE_VERIFICATION_STATUS.SUBMITTED;
  policy.submitted_by_actor_type = context.actor_type;
  policy.submitted_by_actor_id = context.actor_id;
  policy.submitted_at = new Date();
  await policy.save();
  await recordAuditLog({ actor, action: 'insurance_policy.patient_submit', targetType: 'insurance_policy', targetId: policy._id, status: 'success', message: 'Patient submit insurance policy.', requestMeta });
  return policy.toObject();
}

async function attachMyInsurancePolicyCard(policyId, payload = {}, actor = {}, requestMeta = {}) {
  const policy = await getOwnPolicy(policyId, actor);
  const attachmentId = payload.attachment_id || payload.attachmentId;
  const side = normalizeString(payload.side || payload.card_side || payload.cardSide);
  if (!['front', 'back'].includes(side)) throw createError('side phải là front hoặc back.', 422);
  const attachment = await Attachment.findOne({ _id: attachmentId, patient_id: policy.patient_id }).lean();
  if (!attachment) throw createError('Không tìm thấy attachment thẻ bảo hiểm.', 404);
  if (side === 'front') policy.front_card_attachment_id = attachment._id;
  if (side === 'back') policy.back_card_attachment_id = attachment._id;
  await policy.save();
  await recordAuditLog({ actor, action: 'insurance_policy.patient_attach_card', targetType: 'insurance_policy', targetId: policy._id, status: 'success', message: 'Patient attach insurance card.', requestMeta, metadata: { attachment_id: toId(attachment._id), side } });
  return policy.toObject();
}

async function verifyInsurancePolicy(policyId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const policy = await InsurancePolicy.findById(policyId);
  if (!policy) throw createError('Không tìm thấy insurance policy.', 404);
  policy.verification_status = INSURANCE_VERIFICATION_STATUS.VERIFIED;
  policy.status = INSURANCE_POLICY_STATUS.ACTIVE;
  policy.reviewed_by = actor.userId;
  policy.reviewed_at = new Date();
  policy.rejection_reason = undefined;
  if (payload.coverage_percent !== undefined) policy.coverage_percent = payload.coverage_percent;
  await policy.save();
  await recordAuditLog({ actor, action: 'insurance_policy.verify', targetType: 'insurance_policy', targetId: policy._id, status: 'success', message: 'Verify insurance policy.', requestMeta });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.INSURANCE_VERIFIED,
    aggregateType: 'insurance_policy',
    aggregateId: policy._id,
    recipientScope: {
      patient_id: policy.patient_id,
      recipients: [{ recipient_type: 'patient', recipient_id: policy.patient_id, patient_id: policy.patient_id }],
    },
    payload: {
      policy_id: toId(policy._id),
      verification_status: policy.verification_status,
      notification: {
        title: 'Bảo hiểm đã được xác minh',
        body: policy.payer_name,
        priority: 'normal',
      },
    },
  });
  return policy.toObject();
}

async function rejectInsurancePolicy(policyId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const policy = await InsurancePolicy.findById(policyId);
  if (!policy) throw createError('Không tìm thấy insurance policy.', 404);
  policy.verification_status = INSURANCE_VERIFICATION_STATUS.REJECTED;
  policy.status = INSURANCE_POLICY_STATUS.INACTIVE;
  policy.reviewed_by = actor.userId;
  policy.reviewed_at = new Date();
  policy.rejection_reason = normalizeString(payload.reason || payload.rejection_reason);
  await policy.save();
  await recordAuditLog({ actor, action: 'insurance_policy.reject', targetType: 'insurance_policy', targetId: policy._id, status: 'success', message: 'Reject insurance policy.', requestMeta, metadata: { reason: policy.rejection_reason } });
  return policy.toObject();
}

async function listMyInsurancePolicies(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { patient_id: patientId(actor), is_deleted: false };
  if (query.verification_status) filter.verification_status = query.verification_status;
  const [items, total] = await Promise.all([
    InsurancePolicy.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    InsurancePolicy.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

module.exports = {
  createMyInsurancePolicy,
  updateMyInsurancePolicy,
  submitMyInsurancePolicy,
  attachMyInsurancePolicyCard,
  verifyInsurancePolicy,
  rejectInsurancePolicy,
  listMyInsurancePolicies,
};
