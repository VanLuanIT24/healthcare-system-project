const env = require('../../config/env');
const { ROLE_CODE, ROLE_PERMISSION_MAP } = require('../../constants/permissions');
const { ACTOR_TYPE } = require('../../constants/statuses');
const actorContext = require('../../common/actors');

const TOKEN_TYPE = {
  ACCESS: 'access',
};

const AUTH_POLICY = {
  maxFailedLoginAttempts: 5,
  lockDurationMinutes: 15,
  passwordResetExpiresInMinutes: env.passwordResetExpiresInMinutes || 15,
  allowPendingPatientLogin: false,
};

const STAFF_MANAGED_STATUSES = ['active', 'suspended', 'locked', 'disabled'];
const PATIENT_ACCOUNT_LOGIN_STATUSES = ['active'];

const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: 'Thông tin tài khoản hoặc mật khẩu không chính xác.',
  RESET_REQUEST_ACCEPTED: 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi tới kênh liên hệ đã đăng ký.',
};

const PATIENT_PORTAL_PERMISSIONS = ROLE_PERMISSION_MAP[ROLE_CODE.PATIENT] || [];
const RELATIVE_PORTAL_PERMISSIONS = ROLE_PERMISSION_MAP[ROLE_CODE.PATIENT_RELATIVE] || [];

function getActorId(auth = {}) {
  return actorContext.getActorId(auth);
}

function isSuperAdmin(auth = {}) {
  return (auth.roles || []).includes(ROLE_CODE.SUPER_ADMIN);
}

module.exports = {
  // ACTOR_TYPE: Định nghĩa hằng số/cấu hình actor type dùng chung trong service.
  ACTOR_TYPE,
  // TOKEN_TYPE: Định nghĩa hằng số/cấu hình token type dùng chung trong service.
  TOKEN_TYPE,
  // AUTH_POLICY: Định nghĩa hằng số/cấu hình auth policy dùng chung trong service.
  AUTH_POLICY,
  // AUTH_MESSAGES: Định nghĩa hằng số/cấu hình auth messages dùng chung trong service.
  AUTH_MESSAGES,
  // STAFF_MANAGED_STATUSES: Định nghĩa hằng số/cấu hình staff managed statuses dùng chung trong service.
  STAFF_MANAGED_STATUSES,
  // PATIENT_ACCOUNT_LOGIN_STATUSES: Định nghĩa hằng số/cấu hình patient account login statuses dùng chung trong service.
  PATIENT_ACCOUNT_LOGIN_STATUSES,
  // PATIENT_PORTAL_PERMISSIONS: Định nghĩa hằng số/cấu hình patient portal permissions dùng chung trong service.
  PATIENT_PORTAL_PERMISSIONS,
  // RELATIVE_PORTAL_PERMISSIONS: Định nghĩa hằng số/cấu hình relative portal permissions dùng chung trong service.
  RELATIVE_PORTAL_PERMISSIONS,
  // getActorId: Lấy id của tác nhân.
  getActorId,
  // isSuperAdmin: Kiểm tra super quản trị.
  isSuperAdmin,
};
