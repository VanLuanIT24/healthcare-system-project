const { PERMISSION } = require('../constants/permissions');
const { allow, deny, sameId, actorType, hasAnyPermission } = require('./policy-decision');

function canCreateSos(actor = {}) {
  const type = actorType(actor);
  if ((type === 'patient' || type === 'patient_relative' || type === 'relative') && hasAnyPermission(actor, [PERMISSION.EMERGENCY.SELF_SOS])) return allow();
  return deny('sos_create_denied');
}

function canReadCase(actor = {}, emergencyCase = {}) {
  const type = actorType(actor);
  if (type === 'staff' && hasAnyPermission(actor, [PERMISSION.EMERGENCY.READ, PERMISSION.SYSTEM.FULL_ACCESS])) return allow();
  if ((type === 'patient' || type === 'patient_relative' || type === 'relative') && sameId(emergencyCase.patient_id, actor.patientId || actor.patient_id)) return allow();
  return deny('emergency_case_scope_denied');
}

module.exports = {
  canCreateSos,
  canReadCase,
};
