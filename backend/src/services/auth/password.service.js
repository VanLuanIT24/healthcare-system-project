const ApiError = require('../../common/errors/api-error');
const { AUDIT_STATUS } = require('../../constants/statuses');
const { PatientAccount, User } = require('../../models');
const auditService = require('../audit.service');
const { comparePassword, hashPassword } = require('../../common/auth/password-hash');
const sessionService = require('./auth-session.service');
const authNotificationService = require('./auth-notification.service');
const { ACTOR_TYPE, getActorId } = require('./auth.policy');

const PASSWORD_POLICY = {
  historyLimit: 5,
  staffExpiryDays: 90,
};

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  '12345678',
  '123456789',
  'qwerty123',
  'admin123',
  'letmein',
  'welcome1',
]);

function addPasswordError(errors, message) {
  errors.push({
    field: 'password',
    message,
  });
}

function validatePasswordPolicy(input = {}, actorTypeArg = null) {
  const password = String(input.password || '');
  const actorType = input.actorType || input.actor_type || actorTypeArg || ACTOR_TYPE.STAFF;
  const identifiers = [input.username, input.email, input.phone]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  const normalizedPassword = password.trim().toLowerCase();
  const errors = [];

  if (!password) {
    addPasswordError(errors, 'Password is required.');
  }

  const minLength = actorType === ACTOR_TYPE.STAFF ? 10 : 8;
  if (password.length < minLength) {
    addPasswordError(errors, `Password must contain at least ${minLength} characters.`);
  }

  if (password.length > 128) {
    addPasswordError(errors, 'Password must not exceed 128 characters.');
  }

  if (!/[a-z]/.test(password)) {
    addPasswordError(errors, 'Password must contain lowercase letter.');
  }

  if (!/[0-9]/.test(password)) {
    addPasswordError(errors, 'Password must contain number.');
  }

  if (actorType === ACTOR_TYPE.STAFF && !/[A-Z]/.test(password)) {
    addPasswordError(errors, 'Staff password must contain uppercase letter.');
  }

  if (actorType === ACTOR_TYPE.STAFF && !/[^A-Za-z0-9]/.test(password)) {
    addPasswordError(errors, 'Staff password must contain special character.');
  }

  if (COMMON_PASSWORDS.has(normalizedPassword)) {
    addPasswordError(errors, 'Password is too common.');
  }

  if (identifiers.some((value) => value && normalizedPassword.includes(value))) {
    addPasswordError(errors, 'Password must not contain username, email, or phone.');
  }

  if (errors.length) {
    throw ApiError.validation('Password policy validation failed', errors);
  }

  return true;
}

function calculatePasswordExpiry(actorType) {
  if (actorType !== ACTOR_TYPE.STAFF) return undefined;
  return new Date(Date.now() + PASSWORD_POLICY.staffExpiryDays * 24 * 60 * 60 * 1000);
}

function getPasswordHistory(account = {}, limit = PASSWORD_POLICY.historyLimit) {
  return (account.password_history || [])
    .slice()
    .sort((left, right) => new Date(right.changed_at || 0) - new Date(left.changed_at || 0))
    .slice(0, limit);
}

async function preventReuseLastNPasswords(account = {}, newPassword, limit = PASSWORD_POLICY.historyLimit) {
  const candidates = [
    ...(account.password_hash ? [{ password_hash: account.password_hash }] : []),
    ...getPasswordHistory(account, limit),
  ];

  for (const item of candidates) {
    if (item?.password_hash && await comparePassword(newPassword, item.password_hash)) {
      throw ApiError.validation(`Không được dùng lại ${limit} mật khẩu gần nhất.`);
    }
  }

  return true;
}

function appendPasswordHistory(account, previousHash, options = {}) {
  if (!previousHash) return;

  const history = [
    ...(account.password_history || []),
    {
      password_hash: previousHash,
      changed_at: new Date(),
      changed_by: options.changedBy,
      reason: options.reason,
    },
  ];

  account.password_history = history.slice(-PASSWORD_POLICY.historyLimit);
}

async function applyNewPassword(account, newPassword, actorType, options = {}) {
  await preventReuseLastNPasswords(account, newPassword, options.historyLimit || PASSWORD_POLICY.historyLimit);
  const previousHash = account.password_hash;

  appendPasswordHistory(account, previousHash, {
    changedBy: options.changedBy,
    reason: options.reason,
  });

  account.password_hash = await hashPassword(newPassword);
  account.password_changed_at = new Date();
  account.password_expired_at = calculatePasswordExpiry(actorType);

  if (actorType === ACTOR_TYPE.STAFF && options.mustChangePassword !== undefined) {
    account.must_change_password = Boolean(options.mustChangePassword);
  }
}

function isPasswordExpired(account = {}) {
  return Boolean(account.password_expired_at && account.password_expired_at <= new Date());
}

async function changePassword(auth = {}, payload = {}, requestMeta = {}) {
  const currentPassword = payload.current_password || payload.currentPassword;
  const newPassword = payload.new_password || payload.newPassword;

  if (!currentPassword || !newPassword) {
    throw ApiError.validation('current_password và new_password là bắt buộc.');
  }

  if (currentPassword === newPassword) {
    throw ApiError.validation('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
  }

  const actorType = auth.actorType || auth.actor_type;
  const actorId = getActorId(auth);
  const account = actorType === ACTOR_TYPE.STAFF
    ? await User.findById(actorId)
    : await PatientAccount.findById(actorId);

  if (!account || account.is_deleted) {
    throw ApiError.notFound('Không tìm thấy tài khoản.');
  }

  const isCurrentPasswordValid = await comparePassword(currentPassword, account.password_hash);
  if (!isCurrentPasswordValid) {
    throw ApiError.badRequest('Mật khẩu hiện tại không đúng.');
  }

  validatePasswordPolicy({
    password: newPassword,
    username: account.username,
    email: account.email,
    phone: account.phone,
    actorType,
  });

  await applyNewPassword(account, newPassword, actorType, {
    changedBy: actorType === ACTOR_TYPE.STAFF ? account._id : undefined,
    reason: 'change_password',
    mustChangePassword: false,
  });
  account.failed_login_attempts = 0;
  account.locked_until = undefined;
  if (actorType === ACTOR_TYPE.STAFF) {
    account.must_change_password = false;
  }
  await account.save();

  await sessionService.invalidateAllUserSessions(actorType, account._id, requestMeta, {
    actorType,
    actorId: account._id,
    excludeSessionId: auth.sessionId || auth.session_id,
  });

  await auditService.recordAuditLog({
    actor: auth,
    action: 'auth.change_password',
    targetType: actorType === ACTOR_TYPE.STAFF ? 'user' : 'patient_account',
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Password changed.',
    requestMeta,
  });

  await authNotificationService.notifyPasswordChanged(account, actorType, requestMeta);

  return {
    success: true,
    revoked_other_sessions: true,
  };
}

module.exports = {
  // PASSWORD_POLICY: Định nghĩa hằng số/cấu hình password policy dùng chung trong service.
  PASSWORD_POLICY,
  // validatePasswordPolicy: Kiểm tra mật khẩu có đáp ứng chính sách bảo mật hay không.
  validatePasswordPolicy,
  // calculatePasswordExpiry: Tính toán mật khẩu expiry.
  calculatePasswordExpiry,
  // preventReuseLastNPasswords: Ngăn người dùng dùng lại các mật khẩu gần nhất.
  preventReuseLastNPasswords,
  // appendPasswordHistory: Thêm mật khẩu mới vào lịch sử mật khẩu của tài khoản.
  appendPasswordHistory,
  // applyNewPassword: Áp dụng mật khẩu mới, cập nhật hash và metadata bảo mật.
  applyNewPassword,
  // isPasswordExpired: Kiểm tra mật khẩu expired.
  isPasswordExpired,
  // hashPassword: Băm mật khẩu trước khi lưu trữ.
  hashPassword,
  // comparePassword: So sánh mật khẩu thô với mật khẩu đã băm.
  comparePassword,
  // changePassword: Đổi mật khẩu tài khoản và áp dụng các quy tắc bảo mật liên quan.
  changePassword,
};
