const express = require('express');
const iamController = require('../controllers/iam.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/permissions', authorize({ permissions: ['permission.read'] }), iamController.listPermissions);
router.post('/permissions', authorize({ permissions: ['permission.create'] }), iamController.createPermission);
router.get('/permissions/:permissionId', authorize({ permissions: ['permission.read'] }), iamController.getPermissionDetail);
router.patch('/permissions/:permissionId', authorize({ permissions: ['permission.update'] }), iamController.updatePermission);
router.post('/seed/system-access', authorize({ roles: ['super_admin'] }), iamController.seedSystemAccess);

router.get('/roles', authorize({ permissions: ['role.read'] }), iamController.listRoles);
router.post('/roles', authorize({ permissions: ['role.create'] }), iamController.createRole);
router.get('/roles/:roleId', authorize({ permissions: ['role.read'] }), iamController.getRoleDetail);
router.patch('/roles/:roleId', authorize({ permissions: ['role.update'] }), iamController.updateRole);
router.patch('/roles/:roleId/status', authorize({ permissions: ['role.update_status'] }), iamController.updateRoleStatus);
router.get('/roles/:roleId/permissions', authorize({ permissions: ['role.read'] }), iamController.getRolePermissions);
router.get('/roles/:roleId/users', authorize({ permissions: ['role.users.read'] }), iamController.getUsersByRole);
router.post(
  '/roles/:roleId/permissions',
  authorize({ permissions: ['role.assign_permissions'] }),
  iamController.assignPermissionsToRole,
);
router.put(
  '/roles/:roleId/permissions',
  authorize({ permissions: ['role.assign_permissions'] }),
  iamController.syncRolePermissions,
);
router.delete(
  '/roles/:roleId/permissions',
  authorize({ permissions: ['role.assign_permissions'] }),
  iamController.removePermissionsFromRole,
);

router.get('/staff/:userId/roles', authorize({ permissions: ['auth.staff.roles.read'] }), iamController.getStaffRoles);
router.get(
  '/staff/:userId/permissions',
  authorize({ permissions: ['auth.staff.permissions.read'] }),
  iamController.getStaffPermissions,
);
router.get(
  '/staff/:userId/check-permission',
  authorize({ anyPermissions: ['auth.staff.permissions.read', 'auth.staff.roles.read'] }),
  iamController.checkStaffPermission,
);
router.put(
  '/staff/:userId/roles',
  authorize({ permissions: ['auth.staff.manage_roles'] }),
  iamController.syncStaffRoles,
);
router.delete('/staff/:userId/roles', authorize({ permissions: ['auth.staff.manage_roles'] }), iamController.removeRolesFromStaff);
router.post(
  '/staff/:userId/rebuild-permissions',
  authorize({ anyPermissions: ['auth.staff.permissions.read', 'auth.staff.manage_roles'] }),
  iamController.rebuildUserPermissionCache,
);

module.exports = router;
