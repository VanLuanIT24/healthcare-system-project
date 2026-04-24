const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.post('/staff/login', authController.staffLogin);

router.post('/patients/register', authController.registerPatient);  ///
router.post('/patients/login', authController.patientLogin);  ///
router.post('/forgot-password', authController.forgotPassword); ///
router.post('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/change-password', authenticate, authController.changePassword);
router.get('/me', authenticate, authController.me);
router.patch('/me', authenticate, authController.updateMyProfile);
router.get('/me/roles', authenticate, authController.myRoles);
router.get('/me/permissions', authenticate, authController.myPermissions);
router.get('/me/sessions', authenticate, authController.mySessions);
router.get('/me/login-history', authenticate, authController.myLoginHistory);
router.post('/logout-all-devices', authenticate, authController.logoutAllDevices);
router.post('/sessions/revoke', authenticate, authController.revokeRefreshToken);
router.get(
  '/audit-logs',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: ['auth.audit.read'] }),
  authController.getAuditLogs,
);

module.exports = router;
