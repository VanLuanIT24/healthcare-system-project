const { connectDatabase, mongoose } = require('../config/database');
const { Permission, Role, RolePermission } = require('../models');
const { PERMISSION_CODES, ROLE_PERMISSION_MAP } = require('../constants/permissions');

async function checkRbacIntegrity() {
  await connectDatabase();

  const [permissions, roles, rolePermissions] = await Promise.all([
    Permission.find({ is_deleted: false }).lean(),
    Role.find({ is_deleted: false }).lean(),
    RolePermission.find({ is_active: true }).lean(),
  ]);

  const permissionCodesInDb = new Set(permissions.map((permission) => permission.permission_code));
  const roleCodesInDb = new Set(roles.map((role) => role.role_code));
  const permissionIdsInDb = new Set(permissions.map((permission) => String(permission._id)));
  const roleIdsInDb = new Set(roles.map((role) => String(role._id)));

  const missingPermissions = PERMISSION_CODES.filter((code) => !permissionCodesInDb.has(code));
  const roleMapMissingRoles = Object.keys(ROLE_PERMISSION_MAP).filter((roleCode) => !roleCodesInDb.has(roleCode));
  const roleMapMissingPermissions = Object.entries(ROLE_PERMISSION_MAP).flatMap(([roleCode, permissionCodes]) => (
    permissionCodes
      .filter((permissionCode) => !PERMISSION_CODES.includes(permissionCode))
      .map((permissionCode) => ({ roleCode, permissionCode }))
  ));
  const danglingRolePermissions = rolePermissions.filter((item) => (
    !roleIdsInDb.has(String(item.role_id)) || !permissionIdsInDb.has(String(item.permission_id))
  ));

  const result = {
    permissions_in_constants: PERMISSION_CODES.length,
    permissions_in_db: permissions.length,
    roles_in_db: roles.length,
    active_role_permissions: rolePermissions.length,
    missing_permissions: missingPermissions,
    role_map_missing_roles: roleMapMissingRoles,
    role_map_unknown_permissions: roleMapMissingPermissions,
    dangling_role_permissions: danglingRolePermissions.map((item) => ({
      role_permission_id: String(item._id),
      role_id: String(item.role_id),
      permission_id: String(item.permission_id),
    })),
  };

  console.log(JSON.stringify(result, null, 2));

  const hasError = missingPermissions.length ||
    roleMapMissingRoles.length ||
    roleMapMissingPermissions.length ||
    danglingRolePermissions.length;
  if (hasError) process.exitCode = 1;
}

checkRbacIntegrity()
  .catch((error) => {
    console.error('RBAC integrity check failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
