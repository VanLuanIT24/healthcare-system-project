const express = require('express');
const staffController = require('../controllers/staff.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('departmentId', validateObjectIdParam);
router.param('userId', validateObjectIdParam);
router.param('roleId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/doctors', authorize({ permissions: [PERMISSION.USERS.READ_LIMITED] }), staffController.getDoctorsList);
router.get('/assignable-roles', authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }), staffController.getAssignableStaffRoles);
router.get('/summary', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.getStaffSummary);
router.get('/roles/:roleId/users', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.ROLES.READ] }), staffController.getUsersByRole);
router.get('/departments/:departmentId', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.getStaffByDepartment);

router.get('/accounts', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.listStaffAccounts);
router.get('/accounts/search', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT, PERMISSION.USERS.READ_LIMITED] }), staffController.searchStaffAccounts);
router.get('/accounts/filter', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.filterStaffAccounts);
router.post('/accounts', authorize({ permissions: [PERMISSION.USERS.CREATE] }), staffController.createStaffAccount);
router.get('/accounts/:userId', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.getStaffAccountDetail);
router.patch('/accounts/:userId', authorize({ permissions: [PERMISSION.USERS.UPDATE] }), staffController.updateStaffAccount);
router.patch('/accounts/:userId/status', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.UPDATE] }), staffController.updateStaffAccountStatus);
router.post('/accounts/:userId/activate', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.UPDATE] }), staffController.activateStaffAccount);
router.post('/accounts/:userId/deactivate', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.UPDATE] }), staffController.deactivateStaffAccount);
router.post('/accounts/:userId/unlock', authorize({ permissions: [PERMISSION.USERS.UNLOCK] }), staffController.unlockStaffAccount);
router.post('/accounts/:userId/reset-password', authorize({ permissions: [PERMISSION.USERS.RESET_PASSWORD] }), staffController.resetStaffPassword);
router.delete('/accounts/:userId', authorize({ permissions: [PERMISSION.USERS.DELETE] }), staffController.deleteStaffAccountSoft);

router.post('/accounts/:userId/roles/assign', authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }), staffController.assignRolesToStaff);
router.delete('/accounts/:userId/roles', authorize({ anyPermissions: [PERMISSION.USERS.REMOVE_ROLES, PERMISSION.USERS.ASSIGN_ROLES] }), staffController.removeRolesFromStaff);
router.put('/accounts/:userId/roles', authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }), staffController.syncStaffRoles);
router.get('/accounts/:userId/roles', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.ROLES.READ] }), staffController.getStaffRoles);
router.get('/accounts/:userId/permissions', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.PERMISSIONS.READ] }), staffController.getStaffPermissions);
router.get(
  '/accounts/:userId/check-permission',
  authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.PERMISSIONS.READ, PERMISSION.ROLES.READ] }),
  staffController.checkStaffPermission,
);
router.get('/accounts/:userId/login-history', authorize({ anyPermissions: [PERMISSION.AUDIT_LOGS.READ, PERMISSION.AUDIT_LOGS.READ_LIMITED] }), staffController.getStaffLoginHistory);
router.get('/accounts/:userId/audit-logs', authorize({ permissions: [PERMISSION.AUDIT_LOGS.READ] }), staffController.getStaffAuditLogs);
router.post('/accounts/:userId/force-logout', authorize({ anyPermissions: [PERMISSION.USERS.FORCE_LOGOUT, PERMISSION.USERS.RESET_PASSWORD] }), staffController.forceLogoutStaff);

module.exports = router;
