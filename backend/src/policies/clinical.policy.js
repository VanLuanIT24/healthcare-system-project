const ERROR_CODE = require('../common/errors/error-codes');
const { PERMISSION } = require('../constants/permissions');
const { LAB_RESULT_STATUS } = require('../constants/statuses');
const { allow, deny, sameId, actorType, hasAnyPermission } = require('./policy-decision');

function canViewLabResult(actor = {}, labResult = {}) {
  const type = actorType(actor);
  if (type === 'patient') {
    if (!sameId(labResult.patient_id, actor.patientId || actor.patient_id)) return deny('lab_patient_scope_denied');
    if (!labResult.released_to_patient) return deny('lab_not_released', ERROR_CODE.LAB_RESULT_NOT_FINALIZED);
    return allow();
  }
  if (type === 'patient_relative' || type === 'relative') {
    if (!sameId(labResult.patient_id, actor.patientId || actor.patient_id)) return deny('relative_scope_denied', ERROR_CODE.RELATIVE_SCOPE_DENIED);
    if (!labResult.released_to_patient) return deny('lab_not_released', ERROR_CODE.LAB_RESULT_NOT_FINALIZED);
    return allow();
  }
  if (type === 'staff' && hasAnyPermission(actor, [PERMISSION.LAB_RESULTS.READ, PERMISSION.LAB_RESULTS.READ_FINAL, PERMISSION.SYSTEM.FULL_ACCESS])) return allow();
  return deny('lab_result_read_denied');
}

function canReleaseLabResult(actor = {}, labResult = {}) {
  if (actorType(actor) !== 'staff') return deny('staff_required');
  if (![LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED].includes(labResult.status)) {
    return deny('lab_result_not_finalized', ERROR_CODE.LAB_RESULT_NOT_FINALIZED);
  }
  if (hasAnyPermission(actor, [PERMISSION.LAB_RESULTS.RELEASE_TO_PATIENT, PERMISSION.LAB_RESULTS.WRITE, PERMISSION.SYSTEM.FULL_ACCESS])) return allow();
  return deny('lab_result_release_denied');
}

module.exports = {
  canViewLabResult,
  canReleaseLabResult,
};
