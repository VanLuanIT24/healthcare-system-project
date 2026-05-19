const { Types } = require('mongoose');
const {
  AuditLog,
  Encounter,
  VitalSign,
  VitalSignCorrectionRequest,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const { VITAL_SIGN_STATUS } = require('../constants/statuses');
const permissionService = require('./permission.service');
const {
  buildPagination,
  createError,
  getPagination,
  recordAuditLog,
} = require('./core.service');

const VITAL_CORRECTION_FIELDS = [
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
  'oxygen_device',
  'oxygen_flow_rate',
  'consciousness_level',
  'gcs_eye',
  'gcs_verbal',
  'gcs_motor',
  'gcs_total',
  'measurement_position',
  'temperature_site',
  'bp_site',
  'source',
  'device_id',
  'recorded_at',
  'note',
];

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || null;
}

function actorRoles(actor = {}) {
  return Array.isArray(actor.roles) ? actor.roles : actor.user?.roles || [];
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes);
}

function hasCorrectionReviewerScope(actor = {}) {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (hasAnyPermission(actor, [PERMISSION.VITAL_SIGNS.ENTERED_IN_ERROR, PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS])) return true;
  return actorRoles(actor).some((role) => ['super_admin', 'admin', 'manager', 'department_head', 'nurse_manager'].includes(role));
}

function assertCanRead(actor = {}) {
  if (hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.VITAL_SIGNS.READ,
    PERMISSION.ENCOUNTERS.READ,
    PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    PERMISSION.CLINICAL_NOTES.READ,
  ])) return;
  throw createError('Bạn không có quyền xem yêu cầu sửa sinh hiệu.', 403);
}

function assertCanRequest(actor = {}) {
  if (hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.VITAL_SIGNS.UPDATE_OWN,
    PERMISSION.VITAL_SIGNS.ENTERED_IN_ERROR,
    PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS,
  ])) return;
  throw createError('Bạn không có quyền yêu cầu sửa sinh hiệu.', 403);
}

function assertCanReview(actor = {}) {
  if (hasCorrectionReviewerScope(actor)) return;
  throw createError('Bạn không có quyền duyệt yêu cầu sửa sinh hiệu.', 403);
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(value);
}

function pickVitalValues(vital = {}) {
  return VITAL_CORRECTION_FIELDS.reduce((output, field) => {
    if (vital[field] !== undefined) output[field] = vital[field];
    return output;
  }, {});
}

function normalizeProposedValues(values = {}) {
  return VITAL_CORRECTION_FIELDS.reduce((output, field) => {
    if (values[field] !== undefined) output[field] = values[field];
    return output;
  }, {});
}

async function resolveDepartmentId(vital = {}) {
  if (!vital.encounter_id) return null;
  const encounter = await Encounter.findById(vital.encounter_id).select('department_id').lean();
  return encounter?.department_id || null;
}

async function requestCorrection(vitalSignId, payload = {}, actor = {}, requestMeta = {}) {
  assertCanRequest(actor);
  const vital = await VitalSign.findById(vitalSignId).lean();
  if (!vital) throw createError('Không tìm thấy sinh hiệu cần sửa.', 404);
  if (!payload.reason) throw createError('reason là bắt buộc.', 400);

  const proposedValues = normalizeProposedValues(payload.proposed_values || payload.values || {});
  if (!Object.keys(proposedValues).length && !payload.replacement_vital_sign_id) {
    throw createError('Cần proposed_values hoặc replacement_vital_sign_id.', 400);
  }

  const correction = await VitalSignCorrectionRequest.create({
    vital_sign_id: vital._id,
    patient_id: vital.patient_id,
    encounter_id: vital.encounter_id,
    department_id: await resolveDepartmentId(vital),
    requested_by: actorUserId(actor),
    requested_at: new Date(),
    reason: payload.reason,
    reason_category: payload.reason_category || 'other',
    current_values: payload.current_values || pickVitalValues(vital),
    proposed_values: proposedValues,
    replacement_vital_sign_id: payload.replacement_vital_sign_id ? toObjectId(payload.replacement_vital_sign_id, 'replacement_vital_sign_id') : undefined,
    status: 'pending',
    created_by: actorUserId(actor),
  });

  await recordAuditLog({
    actor,
    action: 'vital_correction.request',
    targetType: 'vital_sign_correction_request',
    targetId: correction._id,
    status: 'success',
    message: 'Tạo yêu cầu sửa sinh hiệu.',
    requestMeta,
    metadata: { vital_sign_id: String(vital._id), reason_category: correction.reason_category },
  });

  return getCorrectionDetail(correction._id, actor);
}

async function listCorrections(query = {}, actor = {}) {
  assertCanRead(actor);
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.vital_sign_id) filter.vital_sign_id = toObjectId(query.vital_sign_id, 'vital_sign_id');
  if (query.patient_id) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  if (query.encounter_id) filter.encounter_id = toObjectId(query.encounter_id, 'encounter_id');
  if (query.department_id) filter.department_id = toObjectId(query.department_id, 'department_id');

  const [items, total] = await Promise.all([
    VitalSignCorrectionRequest.find(filter)
      .sort({ requested_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate('encounter_id', 'encounter_code status start_time department_id attending_doctor_id')
      .populate('requested_by', 'full_name employee_code')
      .populate('reviewed_by', 'full_name employee_code')
      .populate('applied_by', 'full_name employee_code')
      .lean(),
    VitalSignCorrectionRequest.countDocuments(filter),
  ]);

  const summaryBase = await VitalSignCorrectionRequest.aggregate([
    { $match: filter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const summary = summaryBase.reduce((output, row) => ({ ...output, [row._id]: row.count }), {
    pending: 0,
    approved: 0,
    rejected: 0,
    applied: 0,
    cancelled: 0,
  });

  return {
    summary: {
      total: total,
      ...summary,
    },
    items,
    pagination: buildPagination(page, limit, total),
  };
}

async function getCorrectionDetail(requestId, actor = {}) {
  assertCanRead(actor);
  const correction = await VitalSignCorrectionRequest.findById(requestId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate('encounter_id', 'encounter_code status start_time department_id attending_doctor_id')
    .populate('vital_sign_id')
    .populate('requested_by', 'full_name employee_code')
    .populate('reviewed_by', 'full_name employee_code')
    .populate('applied_by', 'full_name employee_code')
    .lean();
  if (!correction) throw createError('Không tìm thấy yêu cầu sửa sinh hiệu.', 404);
  return { correction };
}

async function updateReviewStatus(requestId, status, payload = {}, actor = {}, requestMeta = {}) {
  assertCanReview(actor);
  const correction = await VitalSignCorrectionRequest.findById(requestId);
  if (!correction) throw createError('Không tìm thấy yêu cầu sửa sinh hiệu.', 404);
  if (correction.status !== 'pending') throw createError('Yêu cầu sửa không còn ở trạng thái pending.', 409);

  const before = correction.toObject();
  correction.status = status;
  correction.reviewed_by = actorUserId(actor);
  correction.reviewed_at = new Date();
  correction.review_note = payload.review_note || payload.note;
  correction.updated_by = actorUserId(actor);
  await correction.save();

  await recordAuditLog({
    actor,
    action: `vital_correction.${status}`,
    targetType: 'vital_sign_correction_request',
    targetId: correction._id,
    status: 'success',
    message: status === 'approved' ? 'Duyệt yêu cầu sửa sinh hiệu.' : 'Từ chối yêu cầu sửa sinh hiệu.',
    requestMeta,
    before,
    after: correction.toObject(),
  });

  return getCorrectionDetail(correction._id, actor);
}

async function approveCorrection(requestId, payload = {}, actor = {}, requestMeta = {}) {
  return updateReviewStatus(requestId, 'approved', payload, actor, requestMeta);
}

async function rejectCorrection(requestId, payload = {}, actor = {}, requestMeta = {}) {
  return updateReviewStatus(requestId, 'rejected', payload, actor, requestMeta);
}

async function applyCorrection(requestId, payload = {}, actor = {}, requestMeta = {}) {
  assertCanReview(actor);
  const correction = await VitalSignCorrectionRequest.findById(requestId);
  if (!correction) throw createError('Không tìm thấy yêu cầu sửa sinh hiệu.', 404);
  if (!['pending', 'approved'].includes(correction.status)) throw createError('Yêu cầu sửa không thể áp dụng.', 409);

  const vital = await VitalSign.findById(correction.vital_sign_id);
  if (!vital) throw createError('Không tìm thấy sinh hiệu gốc.', 404);
  if (vital.status === VITAL_SIGN_STATUS.ENTERED_IN_ERROR) throw createError('Sinh hiệu đã nhập sai, không thể áp dụng sửa.', 409);

  const beforeVital = vital.toObject();
  const values = normalizeProposedValues(payload.proposed_values || correction.proposed_values || {});
  Object.entries(values).forEach(([field, value]) => {
    vital[field] = value;
  });
  vital.status = VITAL_SIGN_STATUS.AMENDED;
  vital.updated_by = actorUserId(actor);
  await vital.save();

  const beforeCorrection = correction.toObject();
  correction.status = 'applied';
  correction.reviewed_by = correction.reviewed_by || actorUserId(actor);
  correction.reviewed_at = correction.reviewed_at || new Date();
  correction.applied_by = actorUserId(actor);
  correction.applied_at = new Date();
  correction.updated_by = actorUserId(actor);
  await correction.save();

  await recordAuditLog({
    actor,
    action: 'vital_correction.apply',
    targetType: 'vital_sign',
    targetId: vital._id,
    status: 'success',
    message: 'Áp dụng yêu cầu sửa sinh hiệu.',
    requestMeta,
    before: beforeVital,
    after: vital.toObject(),
    metadata: { correction_request_id: String(correction._id) },
  });
  await recordAuditLog({
    actor,
    action: 'vital_correction.applied_status',
    targetType: 'vital_sign_correction_request',
    targetId: correction._id,
    status: 'success',
    message: 'Cập nhật trạng thái yêu cầu sửa sinh hiệu.',
    requestMeta,
    before: beforeCorrection,
    after: correction.toObject(),
  });

  return getCorrectionDetail(correction._id, actor);
}

async function cancelCorrection(requestId, payload = {}, actor = {}, requestMeta = {}) {
  assertCanRequest(actor);
  const correction = await VitalSignCorrectionRequest.findById(requestId);
  if (!correction) throw createError('Không tìm thấy yêu cầu sửa sinh hiệu.', 404);
  if (!['pending', 'approved'].includes(correction.status)) throw createError('Yêu cầu sửa không thể hủy.', 409);
  const before = correction.toObject();
  correction.status = 'cancelled';
  correction.cancelled_by = actorUserId(actor);
  correction.cancelled_at = new Date();
  correction.cancel_reason = payload.reason || payload.cancel_reason;
  correction.updated_by = actorUserId(actor);
  await correction.save();

  await recordAuditLog({
    actor,
    action: 'vital_correction.cancel',
    targetType: 'vital_sign_correction_request',
    targetId: correction._id,
    status: 'success',
    message: 'Hủy yêu cầu sửa sinh hiệu.',
    requestMeta,
    before,
    after: correction.toObject(),
  });

  return getCorrectionDetail(correction._id, actor);
}

async function getVitalSignChangeHistory(vitalSignId, actor = {}) {
  assertCanRead(actor);
  const targetId = toObjectId(vitalSignId, 'vitalSignId');
  const [vitalSign, audit_logs, correction_requests] = await Promise.all([
    VitalSign.findById(targetId).lean(),
    AuditLog.find({ target_type: 'vital_sign', target_id: targetId }).sort({ created_at: -1 }).limit(80).lean(),
    VitalSignCorrectionRequest.find({ vital_sign_id: targetId }).sort({ requested_at: -1 }).lean(),
  ]);
  if (!vitalSign) throw createError('Không tìm thấy sinh hiệu.', 404);
  return { vital_sign: vitalSign, audit_logs, correction_requests };
}

module.exports = {
  applyCorrection,
  approveCorrection,
  cancelCorrection,
  getCorrectionDetail,
  getVitalSignChangeHistory,
  listCorrections,
  rejectCorrection,
  requestCorrection,
};
