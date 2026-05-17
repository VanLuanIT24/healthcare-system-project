const { decodeAndValidateJwt, extractBearerToken } = require('../common/auth');
const { AuthSession, Patient, PatientAccount, PatientRelative, User } = require('../models');
const { ROLE_CODE } = require('../constants/permissions');
const { ACTOR_TYPE, LEGACY_ACTOR_TYPE, PATIENT_STATUS, RELATIVE_STATUS, normalizeActorType } = require('../constants/statuses');
const { buildUserAuthorizationSnapshot } = require('../services/access-control.service');
const { ApiError } = require('../common');
const actorContext = require('../common/actors');
const { PATIENT_PORTAL_PERMISSIONS, RELATIVE_PORTAL_PERMISSIONS } = require('../services/auth/auth.policy');

function ensureActiveAccount(account, label) {
  if (!account || account.is_deleted) {
    return `${label} không tồn tại hoặc đã bị xóa.`;
  }

  if (account.locked_until && account.locked_until > new Date()) {
    return `${label} đang tạm bị khóa.`;
  }

  if (account.status !== 'active') {
    return `${label} hiện không khả dụng.`;
  }

  return null;
}

async function resolveStaffAuthorization(user) {
  const permissionVersion = Number(user.permission_version || 1);
  const authorization = await buildUserAuthorizationSnapshot(user._id, permissionVersion);
  return {
    ...authorization,
    permissionVersion,
  };
}

async function resolveActiveSession(payload) {
  const actorTypes = [payload.actor_type];
  if (payload.actor_type_raw && payload.actor_type_raw !== payload.actor_type) {
    actorTypes.push(payload.actor_type_raw);
  }
  if (payload.actor_type === ACTOR_TYPE.PATIENT_RELATIVE) {
    actorTypes.push(LEGACY_ACTOR_TYPE.RELATIVE);
  }

  return AuthSession.findOne({
    _id: payload.session_id,
    actor_type: { $in: [...new Set(actorTypes.filter(Boolean))] },
    actor_id: payload.sub,
    revoked_at: null,
    expires_at: { $gt: new Date() },
  }).lean();
}

function attachAuthContext(req, auth) {
  req.auth = auth;

  if (!req.context) return;

  const actor = actorContext.buildActorContext(auth);
  req.context.session_id = auth.sessionId || null;
  req.context.actor_type = auth.actorType;
  req.context.actor_id = actor.actor_id;
  req.context.subject_id = actor.subject_id;
  req.context.roles = auth.roles || [];
  req.context.permissions = auth.permissions || [];
  req.context.scopes = auth.scopes || [];
  req.context.actor = actor;
  req.context.session = {
    session_id: auth.sessionId || null,
    token_type: auth.tokenType || null,
  };

  if (auth.actorType === 'staff') {
    req.context.user = auth.user;
    req.context.department_id = auth.user?.department_id || null;
    return;
  }

  if (auth.actorType === 'patient') {
    req.context.patientAccount = auth.account;
    req.context.patient_id = auth.patientId;
    return;
  }

  if (auth.actorType === ACTOR_TYPE.PATIENT_RELATIVE) {
    req.context.relative = auth.relative;
    req.context.patient_id = auth.patientId;
    req.context.relative_id = auth.relativeId;
  }
}

function isAllowedWhilePasswordChangeRequired(req) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  const method = String(req.method || '').toUpperCase();

  return (
    (method === 'POST' && path.endsWith('/auth/change-password')) ||
    (method === 'POST' && path.endsWith('/auth/logout')) ||
    (method === 'POST' && path.endsWith('/auth/logout-all-devices')) ||
    (method === 'GET' && path.endsWith('/auth/me')) ||
    (method === 'GET' && path.endsWith('/auth/me/session'))
  );
}

async function authenticate(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return next(ApiError.unauthorized('Thiếu token truy cập hoặc token không hợp lệ.'));
    }

    const payload = decodeAndValidateJwt(token);
    const session = await resolveActiveSession(payload);
    if (!session) {
      return next(ApiError.unauthorized('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'));
    }

    const actorType = normalizeActorType(payload.actor_type);

    if (actorType === ACTOR_TYPE.STAFF) {
      const user = await User.findById(payload.sub).lean();
      if (!user) {
        return next(ApiError.unauthorized('Không tìm thấy tài khoản nhân sự.'));
      }

      const accountStateError = ensureActiveAccount(user, 'Tài khoản nhân sự');
      if (accountStateError) {
        return next(ApiError.unauthorized(accountStateError));
      }

      const authorization = await resolveStaffAuthorization(user);

      if (user.must_change_password && !isAllowedWhilePasswordChangeRequired(req)) {
        return next(ApiError.forbidden('Bạn cần đổi mật khẩu trước khi sử dụng chức năng này.', {
          code: 'PASSWORD_CHANGE_REQUIRED',
        }));
      }

      attachAuthContext(req, {
        actorType: 'staff',
        userId: String(user._id),
        departmentId: user.department_id ? String(user.department_id) : null,
        sessionId: String(session._id),
        tokenType: payload.token_type,
        roles: authorization.roles,
        roleDetails: authorization.roleDetails,
        permissions: authorization.permissions,
        permissionVersion: authorization.permissionVersion,
        user,
        session,
      });
      return next();
    }

    if (actorType === ACTOR_TYPE.PATIENT) {
      const account = await PatientAccount.findById(payload.sub).lean();
      if (!account) {
        return next(ApiError.unauthorized('Không tìm thấy tài khoản bệnh nhân.'));
      }

      const accountStateError = ensureActiveAccount(account, 'Tài khoản bệnh nhân');
      if (accountStateError) {
        return next(ApiError.unauthorized(accountStateError));
      }

      const patient = await Patient.findById(account.patient_id).lean();
      if (!patient || patient.is_deleted || patient.status !== PATIENT_STATUS.ACTIVE) {
        return next(ApiError.unauthorized('Không tìm thấy hồ sơ bệnh nhân.'));
      }

      attachAuthContext(req, {
        actorType: 'patient',
        patientAccountId: String(account._id),
        patientId: String(patient._id),
        sessionId: String(session._id),
        tokenType: payload.token_type,
        roles: [ROLE_CODE.PATIENT],
        permissions: PATIENT_PORTAL_PERMISSIONS,
        account,
        patient,
        session,
      });
      return next();
    }

    if (actorType === ACTOR_TYPE.PATIENT_RELATIVE) {
      const relative = await PatientRelative.findById(payload.sub).lean();
      if (!relative || relative.is_deleted || relative.status !== RELATIVE_STATUS.ACTIVE) {
        return next(ApiError.unauthorized('Không tìm thấy tài khoản người nhà hợp lệ.'));
      }

      const patient = await Patient.findById(relative.patient_id).lean();
      if (!patient || patient.is_deleted || patient.status !== PATIENT_STATUS.ACTIVE) {
        return next(ApiError.unauthorized('Không tìm thấy hồ sơ bệnh nhân được liên kết.'));
      }

      attachAuthContext(req, {
        actorType,
        relativeId: String(relative._id),
        patientId: String(patient._id),
        sessionId: String(session._id),
        tokenType: payload.token_type,
        roles: [ROLE_CODE.PATIENT_RELATIVE],
        permissions: RELATIVE_PORTAL_PERMISSIONS,
        relative,
        patient,
        session,
      });
      return next();
    }

    return next(ApiError.unauthorized('Loại tài khoản không được hỗ trợ.'));
  } catch (error) {
    return next(ApiError.unauthorized('Bạn chưa được xác thực hoặc phiên đăng nhập đã hết hạn.'));
  }
}

module.exports = authenticate;
