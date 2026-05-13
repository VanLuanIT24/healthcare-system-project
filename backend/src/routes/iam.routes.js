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

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/permissions', authorize({ permissions: [PERMISSION.PERMISSIONS.READ] }), iamController.listPermissions);
router.get('/permissions/grouped', authorize({ permissions: [PERMISSION.PERMISSIONS.READ] }), iamController.listPermissionsGrouped);
router.post('/permissions', authorize({ permissions: [PERMISSION.PERMISSIONS.CREATE] }), iamRequest.createPermission, iamController.createPermission);
router.get('/permissions/:permissionId', authorize({ permissions: [PERMISSION.PERMISSIONS.READ] }), iamController.getPermissionDetail);
router.get('/permissions/:permissionId/usage', authorize({ permissions: [PERMISSION.PERMISSIONS.READ] }), iamController.getPermissionUsageSummary);
router.patch('/permissions/:permissionId', authorize({ permissions: [PERMISSION.PERMISSIONS.UPDATE] }), iamRequest.updatePermission, iamController.updatePermission);
router.delete('/permissions/:permissionId', authorize({ permissions: [PERMISSION.PERMISSIONS.DELETE] }), iamController.deletePermissionSoft);
router.post('/seed/system-access', authorize({ roles: [ROLE_CODE.SUPER_ADMIN] }), iamController.seedSystemAccess);

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
router.delete('/staff/:userId/roles', authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }), iamRequest.roleCodes, iamController.removeRolesFromStaff);
router.post(
  '/staff/:userId/rebuild-permissions',
  authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] }),
  iamController.rebuildUserPermissionCache,
);

module.exports = router;
