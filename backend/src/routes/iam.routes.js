const express = require('express');
const iamController = require('../controllers/iam.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION, ROLE_CODE } = require('../constants/permissions');
const { validateObjectIdParam, iamRequest } = require('../common/validators');

const router = express.Router();

router.param('userId', validateObjectIdParam);
router.param('roleId', validateObjectIdParam);
router.param('permissionId', validateObjectIdParam);
router.param('denyPolicyId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/overview', authorize({ anyPermissions: [PERMISSION.ROLES.READ, PERMISSION.PERMISSIONS.READ, PERMISSION.USERS.READ] }), iamController.getIamOverview);
router.get('/matrix', authorize({ anyPermissions: [PERMISSION.ROLES.READ, PERMISSION.PERMISSIONS.READ] }), iamController.getIamMatrix);
router.post(
  '/matrix/preview',
  authorize({ permissions: [PERMISSION.ROLES.ASSIGN_PERMISSIONS], sensitive: true }),
  iamController.previewRolePermissionChange,
);
router.patch(
  '/matrix/apply',
  authorize({ permissions: [PERMISSION.ROLES.ASSIGN_PERMISSIONS], sensitive: true }),
  iamController.applyRolePermissionMatrix,
);
router.post(
  '/access-check/explain',
  authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.ROLES.READ, PERMISSION.PERMISSIONS.READ] }),
  iamController.explainAccess,
);
router.get('/cache/status', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.PERMISSIONS.READ] }), iamController.getCacheStatus);
router.post('/cache/rebuild/user/:userId', authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES], sensitive: true }), iamController.rebuildUserPermissionContext);
router.post('/cache/rebuild/role/:roleId', authorize({ permissions: [PERMISSION.ROLES.ASSIGN_PERMISSIONS], sensitive: true }), iamController.rebuildRolePermissionContext);
router.post('/cache/rebuild/all', authorize({ roles: [ROLE_CODE.SUPER_ADMIN], sensitive: true }), iamController.rebuildAllPermissionContexts);
router.get('/audit', authorize({ permissions: [PERMISSION.AUDIT_LOGS.READ] }), iamController.getIamAudit);

router.get('/deny-policies', authorize({ anyPermissions: [PERMISSION.ROLES.READ, PERMISSION.PERMISSIONS.READ] }), iamController.listDenyPolicies);
router.post('/deny-policies/preview', authorize({ permissions: [PERMISSION.PERMISSIONS.UPDATE], sensitive: true }), iamController.previewDenyPolicy);
router.post('/deny-policies', authorize({ permissions: [PERMISSION.PERMISSIONS.UPDATE], sensitive: true }), iamController.createDenyPolicy);
router.patch('/deny-policies/:denyPolicyId', authorize({ permissions: [PERMISSION.PERMISSIONS.UPDATE], sensitive: true }), iamController.updateDenyPolicy);
router.post('/deny-policies/:denyPolicyId/activate', authorize({ permissions: [PERMISSION.PERMISSIONS.UPDATE], sensitive: true }), iamController.activateDenyPolicy);
router.post('/deny-policies/:denyPolicyId/deactivate', authorize({ permissions: [PERMISSION.PERMISSIONS.UPDATE], sensitive: true }), iamController.deactivateDenyPolicy);
router.delete('/deny-policies/:denyPolicyId', authorize({ permissions: [PERMISSION.PERMISSIONS.DELETE], sensitive: true }), iamController.deleteDenyPolicySoft);

router.get('/permissions', authorize({ permissions: [PERMISSION.PERMISSIONS.READ] }), iamController.listPermissions);
router.get('/permissions/grouped', authorize({ permissions: [PERMISSION.PERMISSIONS.READ] }), iamController.listPermissionsGrouped);
router.post('/permissions', authorize({ permissions: [PERMISSION.PERMISSIONS.CREATE] }), iamRequest.createPermission, iamController.createPermission);
router.get('/permissions/:permissionId', authorize({ permissions: [PERMISSION.PERMISSIONS.READ] }), iamController.getPermissionDetail);
router.get('/permissions/:permissionId/usage', authorize({ permissions: [PERMISSION.PERMISSIONS.READ] }), iamController.getPermissionUsageSummary);
router.patch('/permissions/:permissionId', authorize({ permissions: [PERMISSION.PERMISSIONS.UPDATE] }), iamRequest.updatePermission, iamController.updatePermission);
router.delete('/permissions/:permissionId', authorize({ permissions: [PERMISSION.PERMISSIONS.DELETE] }), iamController.deletePermissionSoft);
router.post('/seed/system-access/dry-run', authorize({ roles: [ROLE_CODE.SUPER_ADMIN] }), iamController.seedSystemAccessDryRun);
router.post('/seed/system-access', authorize({ roles: [ROLE_CODE.SUPER_ADMIN], sensitive: true }), iamController.seedSystemAccess);

router.get('/roles', authorize({ permissions: [PERMISSION.ROLES.READ] }), iamController.listRoles);
router.post('/roles', authorize({ permissions: [PERMISSION.ROLES.CREATE] }), iamRequest.createRole, iamController.createRole);
router.get('/roles/:roleId', authorize({ permissions: [PERMISSION.ROLES.READ] }), iamController.getRoleDetail);
router.get('/roles/:roleId/usage', authorize({ permissions: [PERMISSION.ROLES.READ] }), iamController.getRoleUsageSummary);
router.patch('/roles/:roleId', authorize({ permissions: [PERMISSION.ROLES.UPDATE] }), iamRequest.updateRole, iamController.updateRole);
router.delete('/roles/:roleId', authorize({ permissions: [PERMISSION.ROLES.DELETE] }), iamController.deleteRoleSoft);
router.patch('/roles/:roleId/status', authorize({ permissions: [PERMISSION.ROLES.UPDATE] }), iamRequest.updateRoleStatus, iamController.updateRoleStatus);
router.get('/roles/:roleId/permissions', authorize({ anyPermissions: [PERMISSION.ROLES.READ, PERMISSION.PERMISSIONS.READ] }), iamController.getRolePermissions);
router.get('/roles/:roleId/users', authorize({ anyPermissions: [PERMISSION.ROLES.READ, PERMISSION.USERS.READ] }), iamController.getUsersByRole);
router.post(
  '/roles/:roleId/permissions',
  authorize({ permissions: [PERMISSION.ROLES.ASSIGN_PERMISSIONS] }),
  iamRequest.permissionCodes,
  iamController.assignPermissionsToRole,
);
router.put(
  '/roles/:roleId/permissions',
  authorize({ permissions: [PERMISSION.ROLES.ASSIGN_PERMISSIONS] }),
  iamRequest.permissionCodes,
  iamController.syncRolePermissions,
);
router.delete(
  '/roles/:roleId/permissions',
  authorize({ permissions: [PERMISSION.ROLES.ASSIGN_PERMISSIONS] }),
  iamRequest.permissionCodes,
  iamController.removePermissionsFromRole,
);

router.get('/staff/:userId/roles', authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.ROLES.READ] }), iamController.getStaffRoles);
router.get(
  '/staff/:userId/permissions',
  authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.PERMISSIONS.READ] }),
  iamController.getStaffPermissions,
);
router.get(
  '/staff/:userId/effective-permissions',
  authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.PERMISSIONS.READ, PERMISSION.ROLES.READ] }),
  iamController.getStaffEffectivePermissions,
);
router.get(
  '/staff/:userId/access-context',
  authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.PERMISSIONS.READ] }),
  iamController.getStaffAccessContext,
);
router.get(
  '/staff/:userId/check-permission',
  authorize({ anyPermissions: [PERMISSION.USERS.READ, PERMISSION.PERMISSIONS.READ, PERMISSION.ROLES.READ] }),
  iamController.checkStaffPermission,
);
router.put(
  '/staff/:userId/roles',
  authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }),
  iamRequest.roleCodes,
  iamController.syncStaffRoles,
);
router.post(
  '/staff/:userId/roles/preview',
  authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES], sensitive: true }),
  iamController.previewStaffRoleChange,
);
router.delete('/staff/:userId/roles', authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }), iamRequest.roleCodes, iamController.removeRolesFromStaff);
router.post(
  '/staff/:userId/rebuild-permissions',
  authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }),
  iamController.rebuildUserPermissionCache,
);

module.exports = router;
