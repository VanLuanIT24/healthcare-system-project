const env = require('../../config/env');
const { PERMISSION, ROLE_CODE } = require('../../constants/permissions');
const { ACTOR_TYPE } = require('../../constants/statuses');

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

const PATIENT_PORTAL_PERMISSIONS = [
  PERMISSION.PATIENTS.SELF_READ,
  PERMISSION.PATIENTS.SELF_UPDATE_BASIC,
  PERMISSION.APPOINTMENTS.SELF_READ,
  PERMISSION.APPOINTMENTS.SELF_CREATE,
  PERMISSION.APPOINTMENTS.SELF_CANCEL_BY_POLICY,
  PERMISSION.APPOINTMENTS.SELF_RESCHEDULE_BY_POLICY,
  PERMISSION.SCHEDULES.PUBLIC_READ,
  PERMISSION.DOCTOR_PROFILES.PUBLIC_READ,
  PERMISSION.DEPARTMENTS.READ,
  PERMISSION.QUEUE.SELF_READ,
  PERMISSION.ENCOUNTERS.SELF_READ_SUMMARY,
  PERMISSION.CONSULTATIONS.SELF_READ_SIGNED,
  PERMISSION.DIAGNOSES.SELF_READ_RELEASED,
  PERMISSION.LAB_RESULTS.SELF_READ_RELEASED,
  PERMISSION.IMAGING_REPORTS.SELF_READ_RELEASED,
  PERMISSION.PROCEDURE_ORDERS.SELF_READ_COMPLETED,
  PERMISSION.PRESCRIPTIONS.SELF_READ,
  PERMISSION.ADMISSIONS.SELF_READ,
  PERMISSION.MEDICAL_RECORDS.SELF_READ_RELEASED,
  PERMISSION.INVOICES.SELF_READ,
  PERMISSION.PAYMENTS.SELF_READ,
  PERMISSION.PAYMENTS.SELF_CREATE_ONLINE,
  PERMISSION.INSURANCE_POLICIES.SELF_READ,
  PERMISSION.INSURANCE_POLICIES.SELF_SUBMIT_INFO,
  PERMISSION.INSURANCE_CLAIMS.SELF_READ,
  PERMISSION.ATTACHMENTS.SELF_READ,
  PERMISSION.ATTACHMENTS.SELF_READ_RELEASED,
  PERMISSION.ATTACHMENTS.SELF_DOWNLOAD_RELEASED,
  PERMISSION.ATTACHMENTS.SELF_UPLOAD_BASIC,
  PERMISSION.DOCUMENTS.TIMELINE_READ_OWN,
  PERMISSION.NOTIFICATIONS.SELF_READ,
  PERMISSION.NOTIFICATIONS.SELF_MARK_READ,
  PERMISSION.NOTIFICATIONS.SELF_MARK_ALL_READ,
];

const RELATIVE_PORTAL_PERMISSIONS = [
  PERMISSION.PATIENT_RELATIVES.LINKED_PATIENTS_READ,
  PERMISSION.MEDICAL_RECORDS.RELATIVE_READ_RELEASED_IF_AUTHORIZED,
  PERMISSION.NOTIFICATIONS.RELATIVE_READ,
];

function getActorId(auth = {}) {
  return auth.userId || auth.patientAccountId || auth.actor_id || auth.actorId;
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
