const { ACTOR_TYPE, normalizeActorType } = require('../../constants/statuses');
const { ROLE_CODE } = require('../../constants/permissions');
const permissionChecker = require('../permissions');

function normalizeId(value) {
  if (value === undefined || value === null || value === '') return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function compactArray(values = []) {
  return [...new Set(values.filter(Boolean).map(normalizeId))];
}

function firstPresent(actor = {}, fields = []) {
  const field = fields.find((fieldName) => actor[fieldName] !== undefined && actor[fieldName] !== null && actor[fieldName] !== '');
  return field ? actor[field] : null;
}

function getActorType(actor = {}) {
  return normalizeActorType(actor.actorType || actor.actor_type || actor.type);
}

function getActorId(actor = {}) {
  const actorType = getActorType(actor);

  if (actorType === ACTOR_TYPE.STAFF) {
    return firstPresent(actor, ['userId', 'user_id', 'staffId', 'staff_id', 'actorId', 'actor_id']);
  }

  if (actorType === ACTOR_TYPE.PATIENT) {
    return firstPresent(actor, ['patientAccountId', 'patient_account_id', 'accountId', 'account_id', 'actorId', 'actor_id']);
  }

  if (actorType === ACTOR_TYPE.PATIENT_RELATIVE) {
    return firstPresent(actor, ['relativeId', 'relative_id', 'patientRelativeId', 'patient_relative_id', 'actorId', 'actor_id']);
  }

  if (actorType === ACTOR_TYPE.SYSTEM) {
    return firstPresent(actor, ['actorId', 'actor_id', 'serviceId', 'service_id', 'jobId', 'job_id']);
  }

  if (actorType === ACTOR_TYPE.SERVICE_ACCOUNT) {
    return firstPresent(actor, ['serviceAccountId', 'service_account_id', 'actorId', 'actor_id', 'userId', 'user_id']);
  }

  return firstPresent(actor, ['actorId', 'actor_id', 'id']);
}

function getStaffId(actor = {}) {
  if (getActorType(actor) !== ACTOR_TYPE.STAFF) return null;
  return firstPresent(actor, ['userId', 'user_id', 'staffId', 'staff_id', 'actorId', 'actor_id']);
}

function getPatientAccountId(actor = {}) {
  if (getActorType(actor) !== ACTOR_TYPE.PATIENT) return null;
  return firstPresent(actor, ['patientAccountId', 'patient_account_id', 'accountId', 'account_id', 'actorId', 'actor_id']);
}

function getPatientId(actor = {}) {
  return firstPresent(actor, ['patientId', 'patient_id']) ||
    actor.patient?.id ||
    actor.patient?._id ||
    null;
}

function getRelativeId(actor = {}) {
  if (getActorType(actor) !== ACTOR_TYPE.PATIENT_RELATIVE) return null;
  return firstPresent(actor, ['relativeId', 'relative_id', 'patientRelativeId', 'patient_relative_id', 'actorId', 'actor_id']);
}

function getDepartmentId(actor = {}) {
  return firstPresent(actor, ['departmentId', 'department_id']) ||
    actor.user?.department_id ||
    actor.department?.id ||
    actor.department?._id ||
    null;
}

function getDepartmentIds(actor = {}) {
  return compactArray([
    getDepartmentId(actor),
    ...(actor.departmentIds || actor.department_ids || []),
  ]);
}

function getDoctorProfileId(actor = {}) {
  return firstPresent(actor, ['doctorProfileId', 'doctor_profile_id']) ||
    actor.doctorProfile?._id ||
    actor.doctorProfile?.id ||
    null;
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
  return getActorType(actor) === ACTOR_TYPE.PATIENT_RELATIVE;
}

function isSystem(actor = {}) {
  return [ACTOR_TYPE.SYSTEM, ACTOR_TYPE.SERVICE_ACCOUNT].includes(getActorType(actor));
}

function isSuperAdmin(actor = {}) {
  return hasRole(actor, ROLE_CODE.SUPER_ADMIN) ||
    permissionChecker.hasPermission(actor, 'system.full_access');
}

function buildSystemActor({ serviceName, serviceId, jobId, actorId, permissions = [], scopes = [], requestMeta = {} } = {}) {
  if (!serviceName && !serviceId && !jobId && !actorId) {
    throw new Error('serviceName, serviceId, jobId or actorId is required for system actor.');
  }

  return buildActorContext({
    actor_type: ACTOR_TYPE.SYSTEM,
    actor_id: actorId || serviceId || jobId || `system:${serviceName}`,
    service_name: serviceName,
    service_id: serviceId,
    job_id: jobId,
    permissions,
    scopes,
    auth_level: 'system',
    request_id: requestMeta.requestId || requestMeta.request_id,
    ip: requestMeta.ip || requestMeta.ipAddress,
  });
}

function buildServiceAccountActor({
  serviceAccountId,
  serviceName,
  permissions = [],
  scopes = [],
  sessionId,
  authLevel = 'service_account',
} = {}) {
  if (!serviceAccountId) {
    throw new Error('serviceAccountId is required for service account actor.');
  }

  return buildActorContext({
    actor_type: ACTOR_TYPE.SERVICE_ACCOUNT,
    service_account_id: serviceAccountId,
    service_name: serviceName,
    permissions,
    scopes,
    session_id: sessionId,
    auth_level: authLevel,
  });
}

function buildActorContext(input = {}, options = {}) {
  const actorType = getActorType(input);
  const roles = input.roles || [];
  const permissions = input.permissions || [];
  const scopes = input.scopes || [];
  const actorId = normalizeId(getActorId(input));

  if (actorType && !actorId && options.requireActorId !== false) {
    throw new Error(`Missing actor id for actor_type=${actorType}.`);
  }

  const departmentId = getDepartmentId(input);
  const userId = getStaffId(input);
  const patientAccountId = getPatientAccountId(input);
  const patientId = getPatientId(input);
  const relativeId = getRelativeId(input);
  const subjectId = firstPresent(input, ['subjectId', 'subject_id']) || patientId || actorId;

  return {
    actor_type: actorType,
    actor_id: actorId,
    subject_id: normalizeId(subjectId),
    user_id: normalizeId(userId),
    staff_id: normalizeId(userId),
    patient_account_id: normalizeId(patientAccountId),
    patient_id: normalizeId(patientId),
    relative_id: normalizeId(relativeId),
    service_account_id: normalizeId(firstPresent(input, ['serviceAccountId', 'service_account_id'])),
    service_id: normalizeId(firstPresent(input, ['serviceId', 'service_id'])),
    service_name: input.serviceName || input.service_name || null,
    job_id: normalizeId(firstPresent(input, ['jobId', 'job_id'])),
    roles,
    permissions,
    scopes,
    department_id: normalizeId(departmentId),
    department_ids: getDepartmentIds(input),
    doctor_profile_id: normalizeId(getDoctorProfileId(input)),
    session_id: normalizeId(firstPresent(input, ['sessionId', 'session_id'])),
    auth_level: input.authLevel || input.auth_level || 'authenticated',
    is_break_glass: Boolean(input.isBreakGlass || input.is_break_glass),
    is_super_admin: isSuperAdmin(input),
    is_staff: actorType === ACTOR_TYPE.STAFF,
    is_patient: actorType === ACTOR_TYPE.PATIENT,
    is_patient_relative: actorType === ACTOR_TYPE.PATIENT_RELATIVE,
    is_system: actorType === ACTOR_TYPE.SYSTEM,
    is_service_account: actorType === ACTOR_TYPE.SERVICE_ACCOUNT,
  };
}

function toLegacyAuth(actorContext = {}, source = {}) {
  return {
    ...source,
    actorType: actorContext.actor_type,
    actorId: actorContext.actor_id,
    subjectId: actorContext.subject_id,
    userId: actorContext.user_id,
    patientAccountId: actorContext.patient_account_id,
    patientId: actorContext.patient_id,
    relativeId: actorContext.relative_id,
    serviceAccountId: actorContext.service_account_id,
    departmentId: actorContext.department_id,
    roles: actorContext.roles || [],
    permissions: actorContext.permissions || [],
    scopes: actorContext.scopes || [],
    sessionId: actorContext.session_id,
    authLevel: actorContext.auth_level,
    isBreakGlass: actorContext.is_break_glass,
  };
}

module.exports = {
  normalizeId,
  compactArray,
  normalizeActorType,
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
  buildSystemActor,
  buildServiceAccountActor,
  buildActorContext,
  toLegacyAuth,
};
