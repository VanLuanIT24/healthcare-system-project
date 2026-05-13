const ApiError = require('../common/errors/api-error');
const passwordService = require('./auth/password.service');
const sessionService = require('./auth/auth-session.service');
const staffAuthService = require('./auth/staff-auth.service');
const patientAuthService = require('./auth/patient-auth.service');
const passwordResetService = require('./auth/password-reset.service');
const currentProfileService = require('./auth/current-profile.service');
const authAuditService = require('./auth/auth-audit.service');
const { getActorId } = require('./auth/auth.policy');

async function refreshAccessToken(payload = {}, requestMeta = {}) {
  if (!payload.refresh_token) {
    throw ApiError.badRequest('refresh_token là bắt buộc.');
  }
  return sessionService.refreshAccessToken(payload.refresh_token, requestMeta);
}

async function revokeRefreshToken(payload = {}, auth = {}, requestMeta = {}) {
  if (payload.refresh_token) {
    return sessionService.revokeRefreshToken(payload.refresh_token, auth, requestMeta);
  }

  if (payload.session_id) {
    return sessionService.revokeSessionById(payload.session_id, auth, requestMeta);
  }

  return { success: true };
}

async function logout(payload = {}, auth = {}, requestMeta = {}) {
  if (payload.refresh_token) {
    return sessionService.revokeRefreshToken(payload.refresh_token, auth, requestMeta);
  }

  if (auth.sessionId || auth.session_id) {
    return sessionService.revokeSessionById(auth.sessionId || auth.session_id, auth, requestMeta);
  }

  return { success: true };
}

async function logoutAllDevices(auth = {}, requestMeta = {}) {
  const actorId = getActorId(auth);
  if (!actorId || !auth.actorType) {
    throw ApiError.unauthorized('Bạn chưa được xác thực.');
  }

  return sessionService.invalidateAllUserSessions(auth.actorType, actorId, requestMeta, {
    actorType: auth.actorType,
    actorId,
  });
}

module.exports = {
  validatePasswordPolicy: passwordService.validatePasswordPolicy,
  changePassword: passwordService.changePassword,

  invalidateAllUserSessions: sessionService.invalidateAllUserSessions,
  getCurrentSessionDetail: sessionService.getCurrentSessionDetail,
  getMySessions: sessionService.getMySessions,
  renameSessionDevice: sessionService.renameSessionDevice,
  revokeOtherSessions: sessionService.revokeOtherSessions,
  revokeExpiredSessions: sessionService.revokeExpiredSessions,
  cleanupExpiredSessions: sessionService.cleanupExpiredSessions,
  refreshAccessToken,
  revokeRefreshToken,
  logout,
  logoutAllDevices,

  loginStaff: staffAuthService.loginStaff,
  createStaffAccount: staffAuthService.createStaffAccount,
  updateStaffAccountStatus: staffAuthService.updateStaffAccountStatus,
  unlockStaffAccount: staffAuthService.unlockStaffAccount,
  activateStaffAccount: staffAuthService.activateStaffAccount,
  deactivateStaffAccount: staffAuthService.deactivateStaffAccount,
  resetStaffPassword: staffAuthService.resetStaffPassword,

  registerPatient: patientAuthService.registerPatient,
  loginPatient: patientAuthService.loginPatient,
  updatePatientAccountEmail: patientAuthService.updatePatientAccountEmail,
  updatePatientAccountPhone: patientAuthService.updatePatientAccountPhone,
  changePatientUsername: patientAuthService.changePatientUsername,
  deactivatePatientAccount: patientAuthService.deactivatePatientAccount,
  lockPatientAccount: patientAuthService.lockPatientAccount,
  unlockPatientAccount: patientAuthService.unlockPatientAccount,
  createPatientAccountForExistingPatient: patientAuthService.createPatientAccountForExistingPatient,

  requestPasswordReset: passwordResetService.requestPasswordReset,
  verifyPasswordResetToken: passwordResetService.verifyPasswordResetToken,
  resetPassword: passwordResetService.resetPassword,

  getCurrentProfile: currentProfileService.getCurrentProfile,
  getMyRoles: currentProfileService.getMyRoles,
  getMyPermissions: currentProfileService.getMyPermissions,
  updateMyProfile: currentProfileService.updateMyProfile,

  getLoginHistory: authAuditService.getLoginHistory,
  getAuditLogs: authAuditService.getAuditLogs,
};
