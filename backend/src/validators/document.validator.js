const ApiError = require('../common/errors/api-error');
const ERROR_CODE = require('../common/errors/error-codes');

function assertDocumentReleased(document) {
  if (!document) throw ApiError.notFound('Không tìm thấy document.');
  if (!document.released_to_patient && document.visibility !== 'patient_visible') {
    throw ApiError.forbidden('Tài liệu chưa được phát hành cho bệnh nhân.', {
      document_id: String(document._id || document.id),
      visibility: document.visibility,
    }, ERROR_CODE.DOCUMENT_NOT_RELEASED);
  }
  return true;
}

function assertDocumentDownloadScope(actor = {}, document = {}) {
  const actorType = actor.actorType || actor.actor_type;
  if (actorType === 'patient' && String(document.patient_id) !== String(actor.patientId || actor.patient_id)) {
    throw ApiError.forbidden('Bạn không có quyền tải tài liệu này.', null, ERROR_CODE.POLICY_DECISION_DENIED);
  }
  if ((actorType === 'patient_relative' || actorType === 'relative') && String(document.patient_id) !== String(actor.patientId || actor.patient_id)) {
    throw ApiError.forbidden('Người nhà không có scope trên tài liệu này.', null, ERROR_CODE.RELATIVE_SCOPE_DENIED);
  }
  return true;
}

module.exports = {
  state: {
    assertDocumentReleased,
  },
  scope: {
    assertDocumentDownloadScope,
  },
};
