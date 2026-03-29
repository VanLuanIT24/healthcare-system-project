const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.post('/staff/login', authController.staffLogin);
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

router.post('/patients/register', authController.registerPatient);
router.post('/patients/login', authController.patientLogin);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/change-password', authenticate, authController.changePassword);
router.get('/me', authenticate, authController.me);

module.exports = router;
