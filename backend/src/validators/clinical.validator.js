const ApiError = require('../common/errors/api-error');
const ERROR_CODE = require('../common/errors/error-codes');
const { LAB_RESULT_STATUS } = require('../constants/statuses');

function assertLabResultFinalized(labResult) {
  if (!labResult) throw ApiError.notFound('Không tìm thấy lab result.');
  if (![LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED].includes(labResult.status)) {
    throw ApiError.conflict('Lab result chưa finalized.', {
      lab_result_id: String(labResult._id || labResult.id),
      status: labResult.status,
    }, ERROR_CODE.LAB_RESULT_NOT_FINALIZED);
  }
  return true;
}

function assertClinicalResourceScope(actor = {}, resource = {}) {
  const actorType = actor.actorType || actor.actor_type;
  if (actorType === 'patient' && String(resource.patient_id) !== String(actor.patientId || actor.patient_id)) {
    throw ApiError.forbidden('Bạn không có quyền xem dữ liệu lâm sàng này.', null, ERROR_CODE.POLICY_DECISION_DENIED);
  }
  return true;
}

module.exports = {
  state: {
    assertLabResultFinalized,
  },
  scope: {
    assertClinicalResourceScope,
  },
};
