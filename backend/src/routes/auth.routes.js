const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam, authRequest } = require('../common/validators');
const { createAuthRateLimit } = require('../middleware/auth-rate-limit');

const router = express.Router();

router.param('sessionId', validateObjectIdParam);
router.param('accountId', validateObjectIdParam);

const passwordValidateLimit = createAuthRateLimit({
  scope: 'password-validate',
  limit: 20,
  windowMs: 15 * 60 * 1000,
  message: 'Quá nhiều yêu cầu kiểm tra mật khẩu. Vui lòng thử lại sau.',
});
const forgotPasswordLimit = createAuthRateLimit({
  scope: 'forgot-password',
  limit: 20,
  windowMs: 60 * 60 * 1000,
  message: 'Quá nhiều yêu cầu khôi phục mật khẩu từ IP này. Vui lòng thử lại sau.',
});
const verifyResetLimit = createAuthRateLimit({
  scope: 'verify-reset',
  limit: 10,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req) => req.body.reset_token || req.body.token || req.body.reset_code || req.body.code,
  message: 'Quá nhiều lần xác minh reset token. Vui lòng thử lại sau.',
});
const resetPasswordLimit = createAuthRateLimit({
  scope: 'reset-password',
  limit: 6,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req) => req.body.reset_token || req.body.token || req.body.reset_code || req.body.code,
  message: 'Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau.',
});
const refreshTokenLimit = createAuthRateLimit({
  scope: 'refresh-token',
  limit: 120,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req) => req.body.refresh_token,
  message: 'Quá nhiều yêu cầu làm mới phiên. Vui lòng thử lại sau.',
});
const logoutLimit = createAuthRateLimit({
  scope: 'logout',
  limit: 120,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req) => req.body.refresh_token,
  message: 'Quá nhiều yêu cầu đăng xuất. Vui lòng thử lại sau.',
});

router.post('/staff/login', authRequest.staffLogin, authController.staffLogin); ///\\\ Ui done

router.post('/patients/register', authRequest.patientRegister, authController.registerPatient);
router.post('/patients/login', authRequest.patientLogin, authController.patientLogin);
router.post('/patient/register', authRequest.patientRegister, authController.registerPatient); ///\\\ UI done
router.post('/patient/login', authRequest.patientLogin, authController.patientLogin); ///\\\ Ui done
router.post('/password/validate', passwordValidateLimit, authRequest.passwordValidate, authController.validatePasswordPolicy); ///\\\ UI done =>  Api phụ cho mấy UI nhập pass mới để chekc độ mạnh của pass mới
router.post('/forgot-password', forgotPasswordLimit, authRequest.forgotPassword, authController.forgotPassword); ///\\\ Ui done
router.post('/verify-reset-token', verifyResetLimit, authRequest.verifyResetToken, authController.verifyResetToken); ///\\\ UI done :))) Dùng để verify token trước khi hiện form nhập pass mới, tránh việc người dùng nhập pass mới rồi submit nhưng token đã hết hạn hoặc không hợp lệ nên phải verify token trước khi cho nhập pass mới, tránh mất công nhập lại pass mới nhiều lần :)))
router.post('/reset-password', resetPasswordLimit, authRequest.resetPassword, authController.resetPassword); ///\\\ UI done
router.post('/refresh-token', refreshTokenLimit, authRequest.refreshToken, authController.refreshToken); ///\\\ Ui done
router.post('/logout', logoutLimit, authRequest.logout, authController.logout); ///\\\ Ui done :)))
router.post('/change-password', authenticate, authRequest.changePassword, authController.changePassword);
router.get('/me', authenticate, authController.me);
router.patch('/me', authenticate, authController.updateMyProfile);
router.get('/me/roles', authenticate, authController.myRoles);
router.get('/me/permissions', authenticate, authController.myPermissions);
router.get('/me/session', authenticate, authController.currentSession);
router.get('/me/sessions', authenticate, authController.mySessions);
router.delete('/me/sessions/others', authenticate, authController.revokeOtherSessions);
router.patch('/me/sessions/:sessionId/device', authenticate, authRequest.renameSessionDevice, authController.renameMySessionDevice);
router.delete('/me/sessions/:sessionId', authenticate, authController.revokeMySession);
router.get('/me/login-history', authenticate, authController.myLoginHistory);
router.post('/logout-all-devices', authenticate, authController.logoutAllDevices);
router.post('/sessions/revoke', authenticate, authRequest.revokeSession, authController.revokeRefreshToken);
router.post(
  '/sessions/revoke-expired',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: [PERMISSION.AUDIT_LOGS.READ] }),
  authController.revokeExpiredSessions,
);
router.delete(
  '/sessions/expired',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: [PERMISSION.AUDIT_LOGS.READ] }),
  authController.cleanupExpiredSessions,
);
router.patch('/patient/account/email', authenticate, authorize({ actorTypes: ['patient'] }), authRequest.updatePatientEmail, authController.updatePatientAccountEmail);
router.patch('/patient/account/phone', authenticate, authorize({ actorTypes: ['patient'] }), authRequest.updatePatientPhone, authController.updatePatientAccountPhone);
router.patch('/patient/account/username', authenticate, authorize({ actorTypes: ['patient'] }), authRequest.updatePatientUsername, authController.changePatientUsername);
router.post(
  '/patient-accounts/existing',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: [PERMISSION.PATIENT_ACCOUNTS.CREATE] }),
  authRequest.createPatientAccount,
  authController.createPatientAccountForExistingPatient,
);
router.patch(
  '/patient-accounts/:accountId/email',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: [PERMISSION.PATIENT_ACCOUNTS.UPDATE] }),
  authRequest.updatePatientEmail,
  authController.updatePatientAccountEmail,
);
router.patch(
  '/patient-accounts/:accountId/phone',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: [PERMISSION.PATIENT_ACCOUNTS.UPDATE] }),
  authRequest.updatePatientPhone,
  authController.updatePatientAccountPhone,
);
router.patch(
  '/patient-accounts/:accountId/username',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: [PERMISSION.PATIENT_ACCOUNTS.UPDATE] }),
  authRequest.updatePatientUsername,
  authController.changePatientUsername,
);
router.post(
  '/patient-accounts/:accountId/deactivate',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: [PERMISSION.PATIENT_ACCOUNTS.UPDATE] }),
  authController.deactivatePatientAccount,
);
router.post(
  '/patient-accounts/:accountId/lock',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: [PERMISSION.PATIENT_ACCOUNTS.LOCK] }),
  authController.lockPatientAccount,
);
router.post(
  '/patient-accounts/:accountId/unlock',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: [PERMISSION.PATIENT_ACCOUNTS.UNLOCK] }),
  authController.unlockPatientAccount,
);
router.get(
  '/audit-logs',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: [PERMISSION.AUDIT_LOGS.READ] }),
  authController.getAuditLogs,
);

module.exports = router;
