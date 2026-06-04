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
router.param('sessionId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/doctors', authorize({
  anyPermissions: [
    PERMISSION.USERS.READ_LIMITED,
    PERMISSION.APPOINTMENTS.READ,
    PERMISSION.APPOINTMENTS.CREATE,
    PERMISSION.SCHEDULES.READ,
  ],
}), staffController.getDoctorsList);
router.get('/assignable-roles', authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }), staffController.getAssignableStaffRoles);
router.get('/summary', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.getStaffSummary);
router.get('/roles/:roleId/users', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.ROLES.READ] }), staffController.getUsersByRole);
router.get('/departments/:departmentId', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.getStaffByDepartment);

router.get('/accounts', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.listStaffAccounts);
router.get('/accounts/search', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT, PERMISSION.USERS.READ_LIMITED] }), staffController.searchStaffAccounts);
router.get('/accounts/filter', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.filterStaffAccounts);
router.get('/accounts/pending-activation', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.listPendingActivationAccounts);
router.get('/accounts/risk', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT, PERMISSION.AUDIT_LOGS.READ_SECURITY, PERMISSION.AUDIT_LOGS.READ] }), staffController.listRiskAccounts);
router.get('/accounts/login-history', authorize({ anyPermissions: [PERMISSION.AUDIT_LOGS.READ, PERMISSION.AUDIT_LOGS.READ_LIMITED, PERMISSION.AUDIT_LOGS.READ_SECURITY] }), staffController.getGlobalStaffLoginHistory);
router.get('/accounts/validate-unique', authorize({ anyPermissions: [PERMISSION.USERS.CREATE, PERMISSION.USERS.UPDATE] }), staffController.validateStaffUnique);
router.post('/accounts/generate-username', authorize({ permissions: [PERMISSION.USERS.CREATE] }), staffController.generateStaffUsername);
router.post('/accounts/generate-employee-code', authorize({ permissions: [PERMISSION.USERS.CREATE] }), staffController.generateStaffEmployeeCode);
router.post('/accounts/bulk-action', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE, PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.FORCE_LOGOUT, PERMISSION.USERS.ASSIGN_ROLES, PERMISSION.USERS.REMOVE_ROLES, PERMISSION.USERS.TRANSFER_DEPARTMENT] }), staffController.bulkStaffAction);
router.post('/accounts/bulk/status', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.UPDATE] }), (req, res, next) => {
  req.body.action = 'status';
  return staffController.bulkStaffAction(req, res, next);
});
router.post('/accounts/bulk/force-logout', authorize({ permissions: [PERMISSION.USERS.FORCE_LOGOUT] }), (req, res, next) => {
  req.body.action = 'force_logout';
  return staffController.bulkStaffAction(req, res, next);
});
router.post('/accounts/bulk/assign-roles', authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }), (req, res, next) => {
  req.body.action = 'assign_roles';
  return staffController.bulkStaffAction(req, res, next);
});
router.post('/accounts/bulk/remove-roles', authorize({ anyPermissions: [PERMISSION.USERS.REMOVE_ROLES, PERMISSION.USERS.ASSIGN_ROLES] }), (req, res, next) => {
  req.body.action = 'remove_roles';
  return staffController.bulkStaffAction(req, res, next);
});
router.post('/accounts/bulk/require-password-change', authorize({ permissions: [PERMISSION.USERS.RESET_PASSWORD] }), (req, res, next) => {
  req.body.action = 'require_password_change';
  return staffController.bulkStaffAction(req, res, next);
});
router.post('/accounts', authorize({ permissions: [PERMISSION.USERS.CREATE] }), staffController.createStaffAccount);
router.get('/accounts/:userId', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.getStaffAccountDetail);
router.patch('/accounts/:userId', authorize({ permissions: [PERMISSION.USERS.UPDATE] }), staffController.updateStaffAccount);
router.patch('/accounts/:userId/status', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.UPDATE] }), staffController.updateStaffAccountStatus);
router.post('/accounts/:userId/activate', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.UPDATE] }), staffController.activateStaffAccount);
router.post('/accounts/:userId/deactivate', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.UPDATE] }), staffController.deactivateStaffAccount);
router.post('/accounts/:userId/unlock', authorize({ permissions: [PERMISSION.USERS.UNLOCK] }), staffController.unlockStaffAccount);
router.post('/accounts/:userId/reset-password', authorize({ permissions: [PERMISSION.USERS.RESET_PASSWORD] }), staffController.resetStaffPassword);
router.post('/accounts/:userId/require-password-change', authorize({ permissions: [PERMISSION.USERS.RESET_PASSWORD] }), staffController.requirePasswordChange);
router.post('/accounts/:userId/transfer-department', authorize({ anyPermissions: [PERMISSION.USERS.TRANSFER_DEPARTMENT, PERMISSION.USERS.UPDATE] }), staffController.transferStaffDepartment);
router.delete('/accounts/:userId', authorize({ permissions: [PERMISSION.USERS.DELETE] }), staffController.deleteStaffAccountSoft);
router.get('/accounts/:userId/dependencies', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), staffController.getStaffDependencies);
router.get('/accounts/:userId/can-delete', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.DELETE] }), staffController.checkStaffCanBeDeleted);
router.get('/accounts/:userId/can-deactivate', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.UPDATE_STATUS] }), staffController.getStaffDependencies);
router.get('/accounts/:userId/can-transfer', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.TRANSFER_DEPARTMENT] }), staffController.getStaffDependencies);
router.get('/accounts/:userId/sessions', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.FORCE_LOGOUT, PERMISSION.USERS.RESET_PASSWORD] }), staffController.getStaffSessions);
router.delete('/accounts/:userId/sessions/:sessionId', authorize({ anyPermissions: [PERMISSION.USERS.FORCE_LOGOUT, PERMISSION.USERS.RESET_PASSWORD] }), staffController.revokeStaffSession);
router.post('/accounts/:userId/sessions/revoke-all', authorize({ anyPermissions: [PERMISSION.USERS.FORCE_LOGOUT, PERMISSION.USERS.RESET_PASSWORD] }), staffController.revokeAllStaffSessions);
router.get('/accounts/:userId/risk-profile', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT, PERMISSION.AUDIT_LOGS.READ_SECURITY, PERMISSION.AUDIT_LOGS.READ] }), staffController.getStaffRiskProfile);
router.post('/accounts/:userId/risk-reviewed', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE, PERMISSION.AUDIT_LOGS.READ_SECURITY, PERMISSION.AUDIT_LOGS.READ] }), staffController.markStaffRiskReviewed);
router.post('/accounts/:userId/security-action', authorize({ anyPermissions: [PERMISSION.USERS.UPDATE_STATUS, PERMISSION.USERS.FORCE_LOGOUT, PERMISSION.USERS.RESET_PASSWORD] }), staffController.runStaffSecurityAction);

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
