const env = require('../../config/env');
const ApiError = require('../../common/errors/api-error');
const { AUDIT_STATUS, normalizeActorType } = require('../../constants/statuses');
const {
  PasswordResetToken,
  PatientAccount,
  User,
  generateResetCode,
  generateResetToken,
  hashResetCode,
  hashResetToken,
} = require('../../models');
const auditService = require('../audit.service');
const sessionService = require('./auth-session.service');
const {
  ACTOR_TYPE,
  AUTH_MESSAGES,
  AUTH_POLICY,
} = require('./auth.policy');
const passwordService = require('./password.service');
const rateLimitService = require('./rate-limit.service');
const authNotificationService = require('./auth-notification.service');
const { findStaffByIdentifier } = require('./staff-auth.service');
const { findPatientAccountByIdentifier } = require('./patient-auth.service');

function calculateResetExpiry() {
  return new Date(Date.now() + AUTH_POLICY.passwordResetExpiresInMinutes * 60 * 1000);
}

function buildResetLink(resetToken, actorType) {
  const baseUrl = String(env.appBaseUrl || '').replace(/\/+$/, '');
  if (!baseUrl || !resetToken) return undefined;
  const routePath = actorType === ACTOR_TYPE.PATIENT ? '/patient/reset-password' : '/staff/reset-password';
  return `${baseUrl}${routePath}?actorType=${encodeURIComponent(actorType)}&token=${encodeURIComponent(resetToken)}`;
}

async function findAccountForReset(actorType, identifier) {
  if (actorType === ACTOR_TYPE.STAFF) {
    return findStaffByIdentifier(identifier);
  }

  if (actorType === ACTOR_TYPE.PATIENT) {
    return findPatientAccountByIdentifier(identifier);
  }

  throw ApiError.badRequest('Loại tài khoản không hợp lệ.');
}

async function revokeExistingResetTokens(actorType, actorId) {
  await PasswordResetToken.updateMany(
    {
      actor_type: actorType,
      actor_id: actorId,
      used_at: null,
      revoked_at: null,
    },
    {
      $set: {
        revoked_at: new Date(),
      },
    },
  );
}

function getResetIdentifier(input = {}) {
  return input.login || input.identifier || input.email || input.phone || input.username;
}

async function buildResetLookupFilter(input = {}, actorTypeArg = null) {
  const actorType = normalizeActorType(input.actor_type || input.actorType || actorTypeArg || ACTOR_TYPE.STAFF);
  const token = input.token || input.reset_token;
  const code = input.code || input.reset_code;

  if (!token && !code) {
    throw ApiError.validation('reset_token hoặc reset_code là bắt buộc.');
  }

  const filter = {
    actor_type: actorType,
    used_at: null,
    revoked_at: null,
    expires_at: { $gt: new Date() },
    ...(token ? { token_hash: hashResetToken(token) } : {}),
    ...(code ? { reset_code_hash: hashResetCode(code) } : {}),
  };

  if (code && !token) {
    const identifier = getResetIdentifier(input);
    if (!identifier) {
      throw ApiError.validation('identifier là bắt buộc khi xác minh bằng reset_code.');
    }

    const account = await findAccountForReset(actorType, identifier);
    if (!account || account.is_deleted || account.status === 'disabled') {
      throw ApiError.unauthorized('Reset token is invalid or expired.');
    }
    filter.actor_id = account._id;
  }

  return filter;
}

async function requestPasswordReset(payload = {}, requestMeta = {}) {
  const actorType = normalizeActorType(payload.actor_type || payload.actorType || ACTOR_TYPE.STAFF);
  const identifier = payload.login || payload.identifier || payload.email || payload.phone || payload.username;

  if (!identifier) {
    throw ApiError.validation('Thông tin nhận diện tài khoản là bắt buộc.');
  }

  rateLimitService.checkPasswordResetRateLimit(identifier, actorType);

  const account = await findAccountForReset(actorType, identifier);
  if (!account || account.is_deleted || account.status === 'disabled') {
    await auditService.recordAuditLog({
      actorType: ACTOR_TYPE.SYSTEM,
      action: 'auth.password_reset.request',
      status: AUDIT_STATUS.FAILURE,
      message: 'Password reset requested for missing or disabled account.',
      requestMeta,
      metadata: {
        actor_type: actorType,
      },
    });

    return {
      success: true,
      message: AUTH_MESSAGES.RESET_REQUEST_ACCEPTED,
    };
  }

  await revokeExistingResetTokens(actorType, account._id);

  const resetToken = generateResetToken();
  const resetCode = generateResetCode();
  const expiresAt = calculateResetExpiry();
  const resetLink = buildResetLink(resetToken, actorType);
  await PasswordResetToken.create({
    actor_type: actorType,
    actor_id: account._id,
    token_hash: hashResetToken(resetToken),
    reset_code_hash: hashResetCode(resetCode),
    expires_at: expiresAt,
    requested_ip: requestMeta.ipAddress || requestMeta.ip,
    requested_user_agent: requestMeta.userAgent || requestMeta.user_agent,
  });

  await auditService.recordAuditLog({
    actorType,
    actorId: account._id,
    action: 'auth.password_reset.request',
    targetType: actorType === ACTOR_TYPE.STAFF ? 'user' : 'patient_account',
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Password reset token issued.',
    requestMeta,
  });

  await authNotificationService.notifyPasswordResetRequested(account, actorType, {
    resetLink,
    resetCode,
    expiresAt,
  }, requestMeta);

  return {
    success: true,
    message: AUTH_MESSAGES.RESET_REQUEST_ACCEPTED,
    ...(env.exposeResetSecrets ? {
      reset_token: resetToken,
      reset_code: resetCode,
      reset_link: resetLink,
    } : {}),
  };
}

async function verifyPasswordResetToken(input = {}, actorTypeArg = null) {
  const actorType = normalizeActorType(input.actor_type || input.actorType || actorTypeArg || ACTOR_TYPE.STAFF);
  const filter = await buildResetLookupFilter(input, actorType);

  const resetRecord = await PasswordResetToken.findOne(filter);
  if (!resetRecord) {
    throw ApiError.unauthorized('Reset token is invalid or expired.');
  }

  const account = actorType === ACTOR_TYPE.STAFF
    ? await User.findById(resetRecord.actor_id)
    : await PatientAccount.findById(resetRecord.actor_id);

  if (!account || account.is_deleted || account.status === 'disabled') {
    throw ApiError.unauthorized('Reset token is invalid or expired.');
  }

  return {
    resetRecord,
    account,
  };
}

async function resetPassword(payload = {}, requestMeta = {}) {
  const newPassword = payload.new_password || payload.newPassword || payload.password;
  if (!newPassword) {
    throw ApiError.validation('new_password là bắt buộc.');
  }

  const { resetRecord, account } = await verifyPasswordResetToken(payload);
  const actorType = resetRecord.actor_type;

  passwordService.validatePasswordPolicy({
    password: newPassword,
    username: account.username,
    email: account.email,
    phone: account.phone,
    actorType,
  });

  const consumedRecord = await PasswordResetToken.findOneAndUpdate(
    {
      _id: resetRecord._id,
      used_at: null,
      revoked_at: null,
      expires_at: { $gt: new Date() },
    },
    {
      $set: {
        used_at: new Date(),
      },
    },
    { new: true },
  );
  if (!consumedRecord) {
    throw ApiError.unauthorized('Reset token is invalid or expired.');
  }

  await passwordService.applyNewPassword(account, newPassword, actorType, {
    changedBy: actorType === ACTOR_TYPE.STAFF ? account._id : undefined,
    reason: 'password_reset',
    mustChangePassword: false,
  });
  account.failed_login_attempts = 0;
  account.locked_until = undefined;
  if (account.status === 'locked') {
    account.status = 'active';
  }
  if (actorType === ACTOR_TYPE.STAFF) {
    account.must_change_password = false;
  }
  await account.save();

  await revokeExistingResetTokens(actorType, account._id);
  await sessionService.invalidateAllUserSessions(actorType, account._id, requestMeta, {
    actorType,
    actorId: account._id,
  });

  await auditService.recordAuditLog({
    actorType,
    actorId: account._id,
    action: 'auth.password_reset.complete',
    targetType: actorType === ACTOR_TYPE.STAFF ? 'user' : 'patient_account',
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Password reset completed.',
    requestMeta,
  });

  await authNotificationService.notifyPasswordReset(account, actorType, requestMeta);

  return { success: true };
}

module.exports = {
  // requestPasswordReset: Tạo yêu cầu đặt lại mật khẩu.
  requestPasswordReset,
  // verifyPasswordResetToken: Xác minh token đặt lại mật khẩu.
  verifyPasswordResetToken,
  // resetPassword: Đặt lại mật khẩu.
  resetPassword,
};
