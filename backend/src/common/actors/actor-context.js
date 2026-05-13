const { ACTOR_TYPE } = require('../../constants/statuses');
const { ROLE_CODE } = require('../../constants/permissions');
const permissionChecker = require('../permissions');

function normalizeId(value) {
  if (value === undefined || value === null) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function getActorType(actor = {}) {
  return actor.actorType || actor.actor_type || actor.type || null;
}

function getActorId(actor = {}) {
  return actor.userId ||
    actor.user_id ||
    actor.patientAccountId ||
    actor.patient_account_id ||
    actor.relativeId ||
    actor.relative_id ||
    actor.actorId ||
    actor.actor_id ||
    actor.id ||
    null;
}

function getStaffId(actor = {}) {
  return actor.userId || actor.user_id || actor.staff_id || (
    getActorType(actor) === ACTOR_TYPE.STAFF ? getActorId(actor) : null
  );
}

function getPatientAccountId(actor = {}) {
  return actor.patientAccountId || actor.patient_account_id || (
    getActorType(actor) === ACTOR_TYPE.PATIENT ? getActorId(actor) : null
  );
}

function getPatientId(actor = {}) {
  return actor.patientId ||
    actor.patient_id ||
    actor.patient?.id ||
    actor.patient?._id ||
    null;
}

function getRelativeId(actor = {}) {
  return actor.relativeId || actor.relative_id || (
    [ACTOR_TYPE.RELATIVE, ACTOR_TYPE.PATIENT_RELATIVE].includes(getActorType(actor)) ? getActorId(actor) : null
  );
}

function getDepartmentId(actor = {}) {
  return actor.departmentId ||
    actor.department_id ||
    actor.user?.department_id ||
    actor.department?.id ||
    actor.department?._id ||
    null;
}

function getDepartmentIds(actor = {}) {
  const ids = [
    getDepartmentId(actor),
    ...(actor.departmentIds || actor.department_ids || []),
  ].filter(Boolean).map(normalizeId);

  return [...new Set(ids)];
}

function getDoctorProfileId(actor = {}) {
  return actor.doctorProfileId || actor.doctor_profile_id || actor.doctorProfile?._id || actor.doctorProfile?.id || null;
}

function hasRole(actor = {}, roleCode) {
  return (actor.roles || []).includes(roleCode);
}

function isStaff(actor = {}) {
  return getActorType(actor) === ACTOR_TYPE.STAFF;
}

function isPatient(actor = {}) {
  return getActorType(actor) === ACTOR_TYPE.PATIENT;
}

function isPatientRelative(actor = {}) {
  return [ACTOR_TYPE.RELATIVE, ACTOR_TYPE.PATIENT_RELATIVE].includes(getActorType(actor));
}

function isSystem(actor = {}) {
  return getActorType(actor) === ACTOR_TYPE.SYSTEM || actor.system === true || actor.internal === true;
}

function isSuperAdmin(actor = {}) {
  return hasRole(actor, ROLE_CODE.SUPER_ADMIN) ||
    permissionChecker.hasPermission(actor, 'system.full_access');
}

function buildActorContext(input = {}) {
  const actorType = getActorType(input);
  const roles = input.roles || [];
  const permissions = input.permissions || [];
  const departmentId = getDepartmentId(input);
  const userId = getStaffId(input);
  const patientAccountId = getPatientAccountId(input);
  const patientId = getPatientId(input);
  const relativeId = getRelativeId(input);

  return {
    actor_type: actorType,
    actor_id: normalizeId(getActorId(input)),
    user_id: normalizeId(userId),
    staff_id: normalizeId(userId),
    patient_account_id: normalizeId(patientAccountId),
    patient_id: normalizeId(patientId),
    relative_id: normalizeId(relativeId),
    roles,
    permissions,
    department_id: normalizeId(departmentId),
    department_ids: getDepartmentIds(input),
    doctor_profile_id: normalizeId(getDoctorProfileId(input)),
    is_super_admin: isSuperAdmin(input),
    is_staff: actorType === ACTOR_TYPE.STAFF,
    is_patient: actorType === ACTOR_TYPE.PATIENT,
    is_patient_relative: [ACTOR_TYPE.RELATIVE, ACTOR_TYPE.PATIENT_RELATIVE].includes(actorType),
    is_system: actorType === ACTOR_TYPE.SYSTEM || input.system === true || input.internal === true,
  };
}

function toLegacyAuth(actorContext = {}, source = {}) {
  return {
    ...source,
    actorType: actorContext.actor_type,
    actorId: actorContext.actor_id,
    userId: actorContext.user_id,
    patientAccountId: actorContext.patient_account_id,
    patientId: actorContext.patient_id,
    relativeId: actorContext.relative_id,
    departmentId: actorContext.department_id,
    roles: actorContext.roles || [],
    permissions: actorContext.permissions || [],
  };
}

module.exports = {
  normalizeId,
  getActorType,
  getActorId,
  getStaffId,
  getPatientAccountId,
  getPatientId,
  getRelativeId,
  getDepartmentId,
  getDepartmentIds,
  getDoctorProfileId,
  hasRole,
  isStaff,
  isPatient,
  isPatientRelative,
  isSystem,
  isSuperAdmin,
  buildActorContext,
  toLegacyAuth,
};
