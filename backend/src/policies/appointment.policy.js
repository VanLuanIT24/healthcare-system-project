const { PERMISSION } = require('../constants/permissions');
const { allow, deny, sameId, actorType, hasAnyPermission } = require('./policy-decision');

function canReadAppointment(actor = {}, appointment = {}) {
  if (actorType(actor) === 'patient') {
    return sameId(appointment.patient_id, actor.patientId || actor.patient_id)
      ? allow()
      : deny('patient_scope_denied');
  }
  if (actorType(actor) !== 'staff') return deny('unsupported_actor');
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS])) return allow();
  if (hasAnyPermission(actor, [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT]) && sameId(appointment.department_id, actor.departmentId || actor.department_id)) return allow();
  if (hasAnyPermission(actor, [PERMISSION.APPOINTMENTS.READ_OWN]) && sameId(appointment.doctor_id, actor.userId || actor.user_id)) return allow();
  return deny('appointment_scope_denied');
}

function canBookAppointment(actor = {}, payload = {}) {
  if (actorType(actor) === 'patient') {
    return sameId(payload.patient_id, actor.patientId || actor.patient_id) ? allow() : deny('patient_scope_denied');
  }
  if (actorType(actor) !== 'staff') return deny('unsupported_actor');
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.APPOINTMENTS.CREATE])) return allow();
  return deny('appointment_create_denied');
}

module.exports = {
  canReadAppointment,
  canBookAppointment,
};
