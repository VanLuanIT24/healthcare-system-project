const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.post('/staff/login', authController.staffLogin);
router.get('/my-roles', authenticate, authController.myRoles);
router.get('/my-permissions', authenticate, authController.myPermissions);
router.patch('/my-profile', authenticate, authController.updateMyProfile);
router.get('/my-sessions', authenticate, authController.mySessions);
router.get('/login-history', authenticate, authController.myLoginHistory);
router.post('/sessions/revoke', authenticate, authController.revokeRefreshToken);
router.post('/logout-all-devices', authenticate, authController.logoutAllDevices);
router.get(
  '/staff/accounts',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: ['auth.staff.read'] }),
  authController.listStaffAccounts,
);
router.post(
  '/staff/accounts',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: ['auth.staff.create'] }),
  authController.createStaffAccount,
);
router.patch(
  '/staff/accounts/roles',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: ['auth.staff.manage_roles'] }),
  authController.assignRoles,
);
router.patch(
  '/staff/accounts/status',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: ['auth.staff.update_status'] }),
  authController.updateStaffStatus,
);
router.post(
  '/staff/accounts/unlock',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: ['auth.staff.update_status'] }),
  authController.unlockStaffAccount,
);
router.post(
  '/staff/accounts/activate',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: ['auth.staff.update_status'] }),
  authController.activateStaffAccount,
);
router.post(
  '/staff/accounts/deactivate',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: ['auth.staff.update_status'] }),
  authController.deactivateStaffAccount,
);
router.post(
  '/staff/accounts/reset-password',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: ['auth.staff.reset_password'] }),
  authController.resetStaffPassword,
);

router.post('/patients/register', authController.registerPatient);
router.post('/patients/login', authController.patientLogin);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/change-password', authenticate, authController.changePassword);
router.get('/me', authenticate, authController.me);
router.get(
  '/audit-logs',
  authenticate,
  authorize({ actorTypes: ['staff'], permissions: ['auth.audit.read'] }),
  authController.getAuditLogs,
);

module.exports = router;
