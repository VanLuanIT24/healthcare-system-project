const express = require('express');
const staffController = require('../controllers/staff.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/doctors', authorize({ permissions: ['auth.staff.read'] }), staffController.getDoctorsList);
router.get('/assignable-roles', authorize({ permissions: ['auth.staff.manage_roles'] }), staffController.getAssignableStaffRoles);
router.get('/summary', authorize({ permissions: ['auth.staff.read'] }), staffController.getStaffSummary);
router.get('/roles/:roleId/users', authorize({ anyPermissions: ['role.users.read', 'auth.staff.read'] }), staffController.getUsersByRole);
router.get('/departments/:departmentId', authorize({ permissions: ['auth.staff.read'] }), staffController.getStaffByDepartment);

router.get('/accounts', authorize({ permissions: ['auth.staff.read'] }), staffController.listStaffAccounts);
router.get('/accounts/search', authorize({ permissions: ['auth.staff.read'] }), staffController.searchStaffAccounts);
router.get('/accounts/filter', authorize({ permissions: ['auth.staff.read'] }), staffController.filterStaffAccounts);
router.post('/accounts', authorize({ permissions: ['auth.staff.create'] }), staffController.createStaffAccount);
router.get('/accounts/:userId', authorize({ permissions: ['auth.staff.read'] }), staffController.getStaffAccountDetail);
router.patch('/accounts/:userId', authorize({ permissions: ['auth.staff.create'] }), staffController.updateStaffAccount);
router.patch('/accounts/:userId/status', authorize({ permissions: ['auth.staff.update_status'] }), staffController.updateStaffAccountStatus);
router.post('/accounts/:userId/activate', authorize({ permissions: ['auth.staff.update_status'] }), staffController.activateStaffAccount);
router.post('/accounts/:userId/deactivate', authorize({ permissions: ['auth.staff.update_status'] }), staffController.deactivateStaffAccount);
router.post('/accounts/:userId/unlock', authorize({ permissions: ['auth.staff.update_status'] }), staffController.unlockStaffAccount);
router.post('/accounts/:userId/reset-password', authorize({ permissions: ['auth.staff.reset_password'] }), staffController.resetStaffPassword);
router.delete('/accounts/:userId', authorize({ permissions: ['auth.staff.update_status'] }), staffController.deleteStaffAccountSoft);

router.post('/accounts/:userId/roles/assign', authorize({ permissions: ['auth.staff.manage_roles'] }), staffController.assignRolesToStaff);
router.delete('/accounts/:userId/roles', authorize({ permissions: ['auth.staff.manage_roles'] }), staffController.removeRolesFromStaff);
router.put('/accounts/:userId/roles', authorize({ permissions: ['auth.staff.manage_roles'] }), staffController.syncStaffRoles);
router.get('/accounts/:userId/roles', authorize({ permissions: ['auth.staff.roles.read'] }), staffController.getStaffRoles);
router.get('/accounts/:userId/permissions', authorize({ permissions: ['auth.staff.permissions.read'] }), staffController.getStaffPermissions);
router.get(
  '/accounts/:userId/check-permission',
  authorize({ anyPermissions: ['auth.staff.permissions.read', 'auth.staff.roles.read'] }),
  staffController.checkStaffPermission,
);
router.get('/accounts/:userId/login-history', authorize({ permissions: ['auth.audit.read'] }), staffController.getStaffLoginHistory);
router.get('/accounts/:userId/audit-logs', authorize({ permissions: ['auth.audit.read'] }), staffController.getStaffAuditLogs);
router.post('/accounts/:userId/force-logout', authorize({ permissions: ['auth.staff.reset_password'] }), staffController.forceLogoutStaff);

module.exports = router;
