const { decodeAndValidateJwt } = require('../common/auth');
const { AuthSession, Patient, PatientAccount, PatientRelative, User } = require('../models');
const { ACTOR_TYPE, LEGACY_ACTOR_TYPE, PATIENT_STATUS, RELATIVE_STATUS, normalizeActorType } = require('../constants/statuses');
const { ROLE_CODE } = require('../constants/permissions');
const { buildUserAuthorizationSnapshot } = require('../services/access-control.service');
const { PATIENT_PORTAL_PERMISSIONS, RELATIVE_PORTAL_PERMISSIONS } = require('../services/auth/auth.policy');

function socketToken(socket) {
  const authToken = socket.handshake?.auth?.token;
  const bearer = socket.handshake?.headers?.authorization || '';
  if (authToken) return authToken;
  const [scheme, token] = bearer.split(' ');
  return scheme === 'Bearer' ? token : null;
}

async function resolveActiveSession(payload) {
  const actorTypes = [payload.actor_type];
  if (payload.actor_type_raw && payload.actor_type_raw !== payload.actor_type) actorTypes.push(payload.actor_type_raw);
  if (payload.actor_type === ACTOR_TYPE.PATIENT_RELATIVE) actorTypes.push(LEGACY_ACTOR_TYPE.RELATIVE);
  return AuthSession.findOne({
    _id: payload.session_id,
    actor_type: { $in: [...new Set(actorTypes.filter(Boolean))] },
    actor_id: payload.sub,
    revoked_at: null,
    expires_at: { $gt: new Date() },
  }).lean();
}

async function buildSocketAuth(payload, session) {
  const actorType = normalizeActorType(payload.actor_type);
  if (actorType === ACTOR_TYPE.STAFF) {
    const user = await User.findById(payload.sub).lean();
    if (!user || user.is_deleted || user.status !== 'active') throw new Error('Invalid staff account.');
    const authorization = await buildUserAuthorizationSnapshot(user._id, Number(user.permission_version || 1));
    return {
      actorType: ACTOR_TYPE.STAFF,
      actorId: String(user._id),
      userId: String(user._id),
      departmentId: user.department_id ? String(user.department_id) : null,
      sessionId: String(session._id),
      roles: authorization.roles,
      permissions: authorization.permissions,
      user,
      session,
    };
  }
  if (actorType === ACTOR_TYPE.PATIENT) {
    const account = await PatientAccount.findById(payload.sub).lean();
    if (!account || account.is_deleted || account.status !== 'active') throw new Error('Invalid patient account.');
    const patient = await Patient.findById(account.patient_id).lean();
    if (!patient || patient.is_deleted || patient.status !== PATIENT_STATUS.ACTIVE) throw new Error('Invalid patient profile.');
    return {
      actorType: ACTOR_TYPE.PATIENT,
      actorId: String(account._id),
      patientAccountId: String(account._id),
      patientId: String(patient._id),
      sessionId: String(session._id),
      roles: [ROLE_CODE.PATIENT],
      permissions: PATIENT_PORTAL_PERMISSIONS,
      account,
      patient,
      session,
    };
  }
  if (actorType === ACTOR_TYPE.PATIENT_RELATIVE) {
    const relative = await PatientRelative.findById(payload.sub).lean();
    if (!relative || relative.is_deleted || relative.status !== RELATIVE_STATUS.ACTIVE) throw new Error('Invalid relative account.');
    const patient = await Patient.findById(relative.patient_id).lean();
    if (!patient || patient.is_deleted || patient.status !== PATIENT_STATUS.ACTIVE) throw new Error('Invalid linked patient profile.');
    return {
      actorType,
      actorId: String(relative._id),
      relativeId: String(relative._id),
      patientId: String(patient._id),
      sessionId: String(session._id),
      roles: [ROLE_CODE.PATIENT_RELATIVE],
      permissions: RELATIVE_PORTAL_PERMISSIONS,
      relative,
      patient,
      session,
    };
  }
  throw new Error('Unsupported socket actor type.');
}

async function authenticateSocket(socket, next) {
  try {
    const token = socketToken(socket);
    if (!token) throw new Error('Missing socket token.');
    const payload = decodeAndValidateJwt(token);
    const session = await resolveActiveSession(payload);
    if (!session) throw new Error('Invalid socket session.');
    socket.auth = await buildSocketAuth(payload, session);
    return next();
  } catch (error) {
    return next(new Error('Unauthorized socket connection.'));
  }
}

module.exports = {
  authenticateSocket,
};
