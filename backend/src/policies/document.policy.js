const ERROR_CODE = require('../common/errors/error-codes');
const { PERMISSION } = require('../constants/permissions');
const { allow, deny, sameId, actorType, hasAnyPermission } = require('./policy-decision');

function canDownload(actor = {}, attachment = {}) {
  const type = actorType(actor);
  if (type === 'patient') {
    if (!sameId(attachment.patient_id, actor.patientId || actor.patient_id)) return deny('document_patient_scope_denied');
    if (!attachment.released_to_patient && attachment.visibility !== 'patient_visible') return deny('document_not_released', ERROR_CODE.DOCUMENT_NOT_RELEASED);
    return allow();
  }
  if (type === 'patient_relative' || type === 'relative') {
    if (!sameId(attachment.patient_id, actor.patientId || actor.patient_id)) return deny('relative_scope_denied', ERROR_CODE.RELATIVE_SCOPE_DENIED);
    if (!attachment.released_to_patient && attachment.visibility !== 'shared_with_relative') return deny('document_not_released', ERROR_CODE.DOCUMENT_NOT_RELEASED);
    return allow();
  }
  if (type === 'staff' && hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.DOWNLOAD, PERMISSION.ATTACHMENTS.READ, PERMISSION.SYSTEM.FULL_ACCESS])) return allow();
  return deny('document_download_denied');
}

module.exports = {
  canDownload,
};
