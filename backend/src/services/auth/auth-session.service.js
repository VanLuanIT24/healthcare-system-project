const ApiError = require('../../common/errors/api-error');
const { randomUUID } = require('crypto');
const { AUDIT_STATUS, PATIENT_STATUS } = require('../../constants/statuses');
const { AuthSession, Patient, PatientAccount, User } = require('../../models');
const auditService = require('../audit.service');
const permissionService = require('../permission.service');
const { PERMISSION } = require('../../constants/permissions');
const {
  ACTOR_TYPE,
  getActorId,
  isSuperAdmin,
} = require('./auth.policy');
const {
  generateAccessToken,
  generateRefreshToken,
  getAccessTokenExpiresInSeconds,
  getRefreshTokenExpiresInSeconds,
  hashRefreshToken,
} = require('./token.service');
const authNotificationService = require('./auth-notification.service');

function buildRefreshExpiry() {
  return new Date(Date.now() + getRefreshTokenExpiresInSeconds() * 1000);
}

function getRequestIp(requestMeta = {}) {
  return requestMeta.ipAddress || requestMeta.ip || null;
}

function getRequestUserAgent(requestMeta = {}) {
  return requestMeta.userAgent || requestMeta.user_agent || null;
}

function parseUserAgent(userAgent = '') {
  const text = String(userAgent || '');
  let browser = null;
  let os = null;

  if (/Edg\//.test(text)) browser = 'Edge';
  else if (/Chrome\//.test(text)) browser = 'Chrome';
  else if (/Firefox\//.test(text)) browser = 'Firefox';
  else if (/Safari\//.test(text)) browser = 'Safari';

  if (/Windows/i.test(text)) os = 'Windows';
  else if (/Android/i.test(text)) os = 'Android';
  else if (/iPhone|iPad|iOS/i.test(text)) os = 'iOS';
  else if (/Mac OS|Macintosh/i.test(text)) os = 'macOS';
  else if (/Linux/i.test(text)) os = 'Linux';

  return { browser, os };
}

function buildSessionMetadata(requestMeta = {}, options = {}) {
  const userAgent = getRequestUserAgent(requestMeta);
  const ip = getRequestIp(requestMeta);
  const parsed = parseUserAgent(userAgent);

  return {
    device_id: requestMeta.deviceId || requestMeta.device_id || options.deviceId || options.device_id,
    device_name: requestMeta.deviceName || requestMeta.device_name || options.deviceName || options.device_name,
    browser: requestMeta.browser || options.browser || parsed.browser,
    os: requestMeta.os || options.os || parsed.os,
    location: requestMeta.location || options.location,
    login_method: requestMeta.loginMethod || requestMeta.login_method || options.loginMethod || options.login_method || 'password',
    created_ip: requestMeta.createdIp || requestMeta.created_ip || ip,
    last_ip: requestMeta.lastIp || requestMeta.last_ip || ip,
    user_agent: userAgent,
    ip_address: ip,
  };
}

async function createAuthSession(actorType, actorId, refreshToken, requestMeta = {}, options = {}) {
  const session = await AuthSession.create(
    [{
      actor_type: actorType,
      actor_id: actorId,
      refresh_token_hash: hashRefreshToken(refreshToken),
      refresh_token_history: [],
      token_family_id: options.tokenFamilyId || options.token_family_id || randomUUID(),
      parent_session_id: options.parentSessionId || options.parent_session_id,
      ...buildSessionMetadata(requestMeta, options),
      expires_at: options.expiresAt || buildRefreshExpiry(),
      last_used_at: new Date(),
    }],
    options.session ? { session: options.session } : undefined,
  );

  return Array.isArray(session) ? session[0] : session;
}

async function getSessionByRefreshToken(refreshToken) {
  if (!refreshToken) {
    throw ApiError.badRequest('refresh_token is required.');
  }

  return AuthSession.findOne({
    refresh_token_hash: hashRefreshToken(refreshToken),
  });
}

async function detectRefreshTokenReuse(refreshToken) {
  if (!refreshToken) return null;
  const tokenHash = hashRefreshToken(refreshToken);
  return AuthSession.findOne({
    'refresh_token_history.token_hash': tokenHash,
  });
}

async function getAccountForSession(session) {
  if (session.actor_type === ACTOR_TYPE.STAFF) {
    return User.findById(session.actor_id);
  }

  if (session.actor_type === ACTOR_TYPE.PATIENT) {
    return PatientAccount.findById(session.actor_id);
  }

  return null;
}

async function validateRefreshSession(session) {
  if (!session || session.revoked_at || session.expires_at <= new Date()) {
    throw ApiError.unauthorized('Refresh session is invalid or expired.');
  }

  const account = await getAccountForSession(session);
  if (!account || account.is_deleted || account.status !== 'active') {
    throw ApiError.unauthorized('Account is not allowed to refresh session.');
  }

  if (session.actor_type === ACTOR_TYPE.PATIENT) {
    const patient = await Patient.findById(account.patient_id).lean();
    if (!patient || patient.is_deleted || patient.status !== PATIENT_STATUS.ACTIVE) {
      throw ApiError.unauthorized('Account is not allowed to refresh session.');
    }
  }

  return {
    session,
    account,
  };
}

async function rotateRefreshToken(session, requestMeta = {}) {
  const refreshToken = generateRefreshToken();
  const previousHash = session.refresh_token_hash;
  const now = new Date();
  const setFields = {
    refresh_token_hash: hashRefreshToken(refreshToken),
    last_used_at: now,
  };

  if (getRequestIp(requestMeta)) {
    setFields.ip_address = getRequestIp(requestMeta);
    setFields.last_ip = getRequestIp(requestMeta);
  }
  if (getRequestUserAgent(requestMeta)) setFields.user_agent = getRequestUserAgent(requestMeta);

  const updatedSession = await AuthSession.findOneAndUpdate(
    {
      _id: session._id,
      refresh_token_hash: previousHash,
      revoked_at: null,
      expires_at: { $gt: now },
    },
    {
      $set: setFields,
      $push: {
        refresh_token_history: {
          $each: [{
            token_hash: previousHash,
            rotated_at: now,
          }],
          $slice: -10,
        },
      },
    },
    { new: true },
  );

  if (!updatedSession) return null;

  return {
    refreshToken,
    session: updatedSession,
  };
}

async function markTokenHistoryReplay(session, refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken);
  session.refresh_token_history = (session.refresh_token_history || []).map((item) => {
    if (item.token_hash !== tokenHash) return item;
    item.replayed_at = item.replayed_at || new Date();
    return item;
  });
  await session.save();
}

async function auditTokenReplayAttempt(session, requestMeta = {}) {
  const account = session ? await getAccountForSession(session) : null;
  await auditService.recordAuditLog({
    actorType: session?.actor_type || ACTOR_TYPE.SYSTEM,
    actorId: session?.actor_id,
    action: 'auth.refresh_token_replay',
    targetType: 'auth_session',
    targetId: session?._id,
    status: AUDIT_STATUS.FAILURE,
    message: 'Refresh token replay attempt detected.',
    requestMeta,
    metadata: {
      token_family_id: session?.token_family_id,
    },
  });
  if (account) {
    await authNotificationService.notifySuspiciousLogin(account, session.actor_type, requestMeta);
  }
}

async function revokeSessionFamily(session, requestMeta = {}, options = {}) {
  if (!session?.token_family_id) {
    return { success: true, revoked_count: 0 };
  }

  const result = await AuthSession.updateMany(
    {
      token_family_id: session.token_family_id,
      revoked_at: null,
    },
    {
      $set: {
        revoked_at: new Date(),
        revoked_reason: options.reason || 'refresh_token_reuse',
        revoked_by: options.revokedBy,
        last_used_at: new Date(),
      },
    },
  );

  await auditService.recordAuditLog({
    actorType: ACTOR_TYPE.SYSTEM,
    action: 'auth.session_family.revoked',
    targetType: 'auth_session',
    targetId: session._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Session family revoked.',
    requestMeta,
    metadata: {
      token_family_id: session.token_family_id,
      revoked_count: result.modifiedCount || 0,
      reason: options.reason || 'refresh_token_reuse',
    },
  });

  return {
    success: true,
    revoked_count: result.modifiedCount || 0,
  };
}

async function revokeAllSessionsOnTokenReuse(session, requestMeta = {}) {
  await revokeSessionFamily(session, requestMeta, { reason: 'refresh_token_reuse' });
  return invalidateAllUserSessions(session.actor_type, session.actor_id, requestMeta, {
    actorType: ACTOR_TYPE.SYSTEM,
    actorId: null,
    reason: 'refresh_token_reuse',
  });
}

async function refreshAccessToken(refreshToken, requestMeta = {}) {
  const currentSession = await getSessionByRefreshToken(refreshToken);
  if (!currentSession) {
    const replayedSession = await detectRefreshTokenReuse(refreshToken);
    if (replayedSession) {
      await markTokenHistoryReplay(replayedSession, refreshToken);
      await auditTokenReplayAttempt(replayedSession, requestMeta);
      await revokeAllSessionsOnTokenReuse(replayedSession, requestMeta);
    }
    throw ApiError.unauthorized('Refresh session is invalid or expired.');
  }

  const { session, account } = await validateRefreshSession(currentSession);
  const rotated = await rotateRefreshToken(session, requestMeta);
  if (!rotated) {
    const replayedSession = await detectRefreshTokenReuse(refreshToken);
    if (replayedSession) {
      await markTokenHistoryReplay(replayedSession, refreshToken);
      await auditTokenReplayAttempt(replayedSession, requestMeta);
      await revokeAllSessionsOnTokenReuse(replayedSession, requestMeta);
    }
    throw ApiError.unauthorized('Refresh session is invalid or expired.');
  }

  const accessToken = generateAccessToken({
    actorType: rotated.session.actor_type,
    actorId: rotated.session.actor_id,
    sessionId: rotated.session._id,
  });

  await auditService.recordAuditLog({
    actorType: rotated.session.actor_type,
    actorId: rotated.session.actor_id,
    action: 'auth.refresh_token',
    targetType: rotated.session.actor_type === ACTOR_TYPE.STAFF ? 'user' : 'patient_account',
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Refresh token rotated successfully.',
    requestMeta,
    metadata: {
      session_id: String(rotated.session._id),
    },
  });

  return {
    access_token: accessToken,
    refresh_token: rotated.refreshToken,
    token_type: 'Bearer',
    expires_in: getAccessTokenExpiresInSeconds(),
  };
}

async function revokeRefreshToken(refreshToken, auth = null, requestMeta = {}) {
  if (!refreshToken) return { success: true };

  const session = await AuthSession.findOne({
    refresh_token_hash: hashRefreshToken(refreshToken),
  });

  if (!session) return { success: true };

  if (!session.revoked_at) {
    session.revoked_at = new Date();
    session.revoked_reason = 'logout';
    session.revoked_by = getActorId(auth);
    session.last_used_at = new Date();
    await session.save();
  }

  await auditService.recordAuditLog({
    actorType: auth?.actorType || session.actor_type,
    actorId: getActorId(auth) || session.actor_id,
    action: 'auth.logout',
    targetType: 'auth_session',
    targetId: session._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Session revoked.',
    requestMeta,
  });

  return { success: true };
}

function assertCanRevokeSession(session, auth = {}) {
  const actorId = getActorId(auth);
  const isOwner = actorId && String(session.actor_id) === String(actorId) && session.actor_type === auth.actorType;
  const isPrivilegedStaff = auth.actorType === ACTOR_TYPE.STAFF && (
    isSuperAdmin(auth) ||
    permissionService.hasAnyPermission(auth.permissions || [], [
      PERMISSION.USERS.RESET_PASSWORD,
      PERMISSION.USERS.LOCK,
    ])
  );

  if (!isOwner && !isPrivilegedStaff) {
    throw ApiError.forbidden('Bạn không có quyền thu hồi phiên đăng nhập này.');
  }
}

function assertCanOwnSession(session, auth = {}) {
  const actorId = getActorId(auth);
  const isOwner = actorId && String(session.actor_id) === String(actorId) && session.actor_type === auth.actorType;

  if (!isOwner) {
    throw ApiError.forbidden('Bạn chỉ được đổi tên thiết bị của phiên đăng nhập của chính mình.');
  }
}

async function revokeSessionById(sessionId, auth = {}, requestMeta = {}) {
  const session = await AuthSession.findById(sessionId);
  if (!session) {
    throw ApiError.notFound('Không tìm thấy phiên đăng nhập.');
  }

  assertCanRevokeSession(session, auth);

  if (!session.revoked_at) {
    session.revoked_at = new Date();
    session.revoked_reason = 'revoked_by_user';
    session.revoked_by = getActorId(auth);
    session.last_used_at = new Date();
    await session.save();
  }

  await auditService.recordAuditLog({
    actorType: auth.actorType || session.actor_type,
    actorId: getActorId(auth) || session.actor_id,
    action: 'auth.session.revoke',
    targetType: 'auth_session',
    targetId: session._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Session revoked by id.',
    requestMeta,
  });

  return { success: true };
}

async function invalidateAllUserSessions(actorType, actorId, requestMeta = {}, options = {}) {
  const filter = {
    actor_type: actorType,
    actor_id: actorId,
    revoked_at: null,
    expires_at: { $gt: new Date() },
  };

  if (options.excludeSessionId) {
    filter._id = { $ne: options.excludeSessionId };
  }

  const result = await AuthSession.updateMany(filter, {
    $set: {
      revoked_at: new Date(),
      revoked_reason: options.reason || 'invalidate_all',
      revoked_by: options.actorId,
      last_used_at: new Date(),
    },
  });

  if (options.audit !== false) {
    await auditService.recordAuditLog({
      actorType: options.actorType || ACTOR_TYPE.SYSTEM,
      actorId: options.actorId,
      action: 'auth.sessions.invalidate_all',
      targetType: actorType === ACTOR_TYPE.STAFF ? 'user' : 'patient_account',
      targetId: actorId,
      status: AUDIT_STATUS.SUCCESS,
      message: 'All active sessions invalidated.',
      requestMeta,
      metadata: {
        revoked_count: result.modifiedCount || 0,
      },
    });
  }

  return {
    success: true,
    revoked_count: result.modifiedCount || 0,
  };
}

async function getCurrentSession(context = {}) {
  const sessionId = context.session_id || context.sessionId;
  if (!sessionId) {
    throw ApiError.badRequest('session_id is required.');
  }

  const session = await AuthSession.findById(sessionId).lean();
  if (!session || session.revoked_at || session.expires_at <= new Date()) {
    throw ApiError.unauthorized('Current session is invalid or expired.');
  }

  return session;
}

async function getMySessions(auth = {}) {
  const actorId = getActorId(auth);
  const sessions = await AuthSession.find({
    actor_type: auth.actorType || auth.actor_type,
    actor_id: actorId,
    expires_at: { $gt: new Date() },
  })
    .sort({ created_at: -1 })
    .lean();

  const currentSessionId = auth.sessionId || auth.session_id;

  return {
    items: sessions.map((session) => serializeSession(session, currentSessionId)),
  };
}

function serializeSession(session, currentSessionId = null) {
  return {
    session_id: String(session._id),
    actor_type: session.actor_type,
    actor_id: session.actor_id ? String(session.actor_id) : null,
    ip_address: session.ip_address,
    user_agent: session.user_agent,
    device_id: session.device_id,
    device_name: session.device_name,
    browser: session.browser,
    os: session.os,
    location: session.location,
    login_method: session.login_method,
    created_ip: session.created_ip,
    last_ip: session.last_ip,
    created_at: session.created_at,
    last_used_at: session.last_used_at,
    expires_at: session.expires_at,
    revoked_at: session.revoked_at,
    revoked_reason: session.revoked_reason,
    is_current: currentSessionId ? String(session._id) === String(currentSessionId) : false,
    is_active: !session.revoked_at && session.expires_at > new Date(),
  };
}

async function getCurrentSessionDetail(auth = {}) {
  const sessionId = auth.sessionId || auth.session_id;
  const session = await getCurrentSession({ sessionId });
  return {
    session: serializeSession(session, sessionId),
  };
}

async function renameSessionDevice(sessionId, payload = {}, auth = {}, requestMeta = {}) {
  const session = await AuthSession.findById(sessionId);
  if (!session) throw ApiError.notFound('Không tìm thấy phiên đăng nhập.');
  assertCanOwnSession(session, auth);

  const deviceName = String(payload.device_name || payload.deviceName || '').trim();
  if (!deviceName) throw ApiError.validation('device_name là bắt buộc.');

  session.device_name = deviceName;
  await session.save();

  await auditService.recordAuditLog({
    actor: auth,
    action: 'auth.session.rename_device',
    targetType: 'auth_session',
    targetId: session._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Session device renamed.',
    requestMeta,
    metadata: { device_name: deviceName },
  });

  return { success: true, session_id: String(session._id), device_name: deviceName };
}

async function revokeOtherSessions(auth = {}, requestMeta = {}) {
  const actorId = getActorId(auth);
  if (!actorId || !auth.actorType) throw ApiError.unauthorized('Bạn chưa được xác thực.');

  return invalidateAllUserSessions(auth.actorType, actorId, requestMeta, {
    actorType: auth.actorType,
    actorId,
    excludeSessionId: auth.sessionId || auth.session_id,
    reason: 'revoke_other_sessions',
  });
}

async function revokeExpiredSessions(requestMeta = {}) {
  const result = await AuthSession.updateMany(
    {
      revoked_at: null,
      expires_at: { $lte: new Date() },
    },
    {
      $set: {
        revoked_at: new Date(),
        revoked_reason: 'expired',
        last_used_at: new Date(),
      },
    },
  );

  await auditService.recordAuditLog({
    actorType: ACTOR_TYPE.SYSTEM,
    action: 'auth.sessions.revoke_expired',
    targetType: 'auth_session',
    status: AUDIT_STATUS.SUCCESS,
    message: 'Expired sessions revoked.',
    requestMeta,
    metadata: { revoked_count: result.modifiedCount || 0 },
  });

  return { success: true, revoked_count: result.modifiedCount || 0 };
}

async function cleanupExpiredSessions(requestMeta = {}) {
  const result = await AuthSession.deleteMany({
    expires_at: { $lte: new Date() },
    revoked_at: { $ne: null },
  });

  await auditService.recordAuditLog({
    actorType: ACTOR_TYPE.SYSTEM,
    action: 'auth.sessions.cleanup_expired',
    targetType: 'auth_session',
    status: AUDIT_STATUS.SUCCESS,
    message: 'Expired revoked sessions cleaned up.',
    requestMeta,
    metadata: { deleted_count: result.deletedCount || 0 },
  });

  return { success: true, deleted_count: result.deletedCount || 0 };
}

module.exports = {
  // createAuthSession: Tạo xác thực phiên đăng nhập.
  createAuthSession,
  // getSessionByRefreshToken: Tìm phiên đăng nhập bằng refresh token.
  getSessionByRefreshToken,
  // detectRefreshTokenReuse: Phát hiện refresh token bị tái sử dụng.
  detectRefreshTokenReuse,
  // validateRefreshSession: Kiểm tra tính hợp lệ của phiên refresh token.
  validateRefreshSession,
  // rotateRefreshToken: Xoay vòng refresh token.
  rotateRefreshToken,
  // refreshAccessToken: Làm mới access token từ refresh token hợp lệ.
  refreshAccessToken,
  // revokeRefreshToken: Thu hồi refresh token.
  revokeRefreshToken,
  // revokeSessionFamily: Thu hồi nhóm phiên liên quan.
  revokeSessionFamily,
  // revokeAllSessionsOnTokenReuse: Thu hồi toàn bộ phiên liên quan khi phát hiện refresh token bị tái sử dụng.
  revokeAllSessionsOnTokenReuse,
  // auditTokenReplayAttempt: Ghi audit cho lần nghi ngờ replay token.
  auditTokenReplayAttempt,
  // revokeSessionById: Thu hồi phiên đăng nhập theo id.
  revokeSessionById,
  // invalidateAllUserSessions: Vô hiệu hóa toàn bộ phiên đăng nhập của người dùng.
  invalidateAllUserSessions,
  // getCurrentSession: Lấy phiên đăng nhập hiện tại.
  getCurrentSession,
  // getCurrentSessionDetail: Lấy chi tiết phiên đăng nhập hiện tại.
  getCurrentSessionDetail,
  // getMySessions: Lấy các phiên đăng nhập của người dùng hiện tại.
  getMySessions,
  // renameSessionDevice: Đổi tên thiết bị hiển thị của phiên đăng nhập.
  renameSessionDevice,
  // revokeOtherSessions: Thu hồi các phiên đăng nhập khác.
  revokeOtherSessions,
  // revokeExpiredSessions: Thu hồi các phiên đăng nhập hết hạn.
  revokeExpiredSessions,
  // cleanupExpiredSessions: Dọn dẹp các phiên đăng nhập hết hạn.
  cleanupExpiredSessions,
};
