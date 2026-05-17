const ApiError = require('../../common/errors/api-error');
const { AUDIT_STATUS } = require('../../constants/statuses');
const auditService = require('../audit.service');
const authNotificationService = require('./auth-notification.service');
const {
  ACTOR_TYPE,
  AUTH_POLICY,
  PATIENT_ACCOUNT_LOGIN_STATUSES,
} = require('./auth.policy');

function getTargetType(actorType) {
  return actorType === ACTOR_TYPE.STAFF ? 'user' : 'patient_account';
}

function getLoginAction(actorType, success) {
  if (!success) return 'auth.login_failed';
  return 'auth.login';
}

function calculateLockUntil() {
  return new Date(Date.now() + AUTH_POLICY.lockDurationMinutes * 60 * 1000);
}

async function autoUnlockIfExpired(account) {
  if (account?.status === 'locked' && account.locked_until && account.locked_until <= new Date()) {
    account.status = 'active';
    account.locked_until = undefined;
    account.failed_login_attempts = 0;
    await account.save();
  }
}

async function checkAccountStatusBeforeLogin(account, actorType) {
  if (!account || account.is_deleted) {
    throw ApiError.unauthorized('Invalid credentials or account is not allowed to login.');
  }

  await autoUnlockIfExpired(account);

  if (account.locked_until && account.locked_until > new Date()) {
    throw ApiError.unauthorized('Invalid credentials or account is not allowed to login.');
  }

  if (actorType === ACTOR_TYPE.STAFF && account.status !== 'active') {
    throw ApiError.unauthorized('Invalid credentials or account is not allowed to login.');
  }

  if (actorType === ACTOR_TYPE.PATIENT) {
    const allowedStatuses = AUTH_POLICY.allowPendingPatientLogin
      ? [...PATIENT_ACCOUNT_LOGIN_STATUSES, 'pending_verification']
      : PATIENT_ACCOUNT_LOGIN_STATUSES;

    if (!allowedStatuses.includes(account.status)) {
      throw ApiError.unauthorized('Invalid credentials or account is not allowed to login.');
    }
  }

  return true;
}

async function assertUserCanLogin(user) {
  return checkAccountStatusBeforeLogin(user, ACTOR_TYPE.STAFF);
}

async function recordLoginSuccess(account, actorType, requestMeta = {}) {
  account.failed_login_attempts = 0;
  account.locked_until = undefined;
  account.last_login_at = new Date();
  if (requestMeta.ipAddress) {
    account.last_login_ip = requestMeta.ipAddress;
  }
  await account.save();

  await auditService.recordAuditLog({
    actorType,
    actorId: account._id,
    action: getLoginAction(actorType, true),
    targetType: getTargetType(actorType),
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: actorType === ACTOR_TYPE.STAFF ? 'Staff login successful.' : 'Patient login successful.',
    requestMeta,
  });

  await authNotificationService.notifyNewLogin(account, actorType, requestMeta);

  return true;
}

async function lockAccountAfterFailedAttempts(account, actorType, requestMeta = {}) {
  const nextAttempts = (account.failed_login_attempts || 0) + 1;
  account.failed_login_attempts = nextAttempts;

  if (nextAttempts >= AUTH_POLICY.maxFailedLoginAttempts) {
    account.status = 'locked';
    account.locked_until = calculateLockUntil();
  }

  await account.save();

  if (nextAttempts >= AUTH_POLICY.maxFailedLoginAttempts) {
    await auditService.recordAuditLog({
      actorType: ACTOR_TYPE.SYSTEM,
      action: 'auth.account_locked',
      targetType: getTargetType(actorType),
      targetId: account._id,
      status: AUDIT_STATUS.SUCCESS,
      message: 'Account locked after failed login attempts.',
      requestMeta,
      metadata: {
        actor_type: actorType,
        failed_login_attempts: nextAttempts,
        locked_until: account.locked_until,
      },
    });

    await authNotificationService.notifyAccountLocked(account, actorType, requestMeta);
  }

  return account;
}

async function recordLoginFailure(account, actorType, reason = 'invalid_credentials', requestMeta = {}) {
  if (account) {
    await lockAccountAfterFailedAttempts(account, actorType, requestMeta);
  }

  await auditService.recordAuditLog({
    actorType: account ? actorType : ACTOR_TYPE.SYSTEM,
    actorId: account?._id,
    action: getLoginAction(actorType, false),
    targetType: getTargetType(actorType),
    targetId: account?._id,
    status: AUDIT_STATUS.FAILURE,
    message: 'Login failed.',
    requestMeta,
    metadata: {
      actor_type: actorType,
      reason,
    },
  });

  return true;
}

module.exports = {
  // calculateLockUntil: Tính thời điểm tài khoản được mở khóa lại sau khi bị khóa.
  calculateLockUntil,
  // checkAccountStatusBeforeLogin: Kiểm tra trạng thái tài khoản trước khi cho phép đăng nhập.
  checkAccountStatusBeforeLogin,
  // assertUserCanLogin: Bảo đảm user staff được phép login.
  assertUserCanLogin,
  // recordLoginSuccess: Ghi nhận lần đăng nhập thành công và reset bộ đếm thất bại.
  recordLoginSuccess,
  // recordLoginFailure: Ghi nhận lần đăng nhập thất bại để phục vụ khóa tài khoản/cảnh báo.
  recordLoginFailure,
  // lockAccountAfterFailedAttempts: Khóa tài khoản khi số lần đăng nhập thất bại vượt ngưỡng.
  lockAccountAfterFailedAttempts,
};
