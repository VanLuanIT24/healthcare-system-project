const {
  CORE_ROLES,
  PERMISSION_CODES,
  ROLE_CODES,
  ROLE_PERMISSION_MAP,
} = require('../constants/permissions');

function unique(values = []) {
  return [...new Set(values)];
}

function checkRbacConstants() {
  const coreRoleCodes = CORE_ROLES.map((role) => role.role_code);
  const duplicateCoreRoles = coreRoleCodes.filter((roleCode, index) => coreRoleCodes.indexOf(roleCode) !== index);
  const duplicateRoleMapKeys = Object.keys(ROLE_PERMISSION_MAP)
    .filter((roleCode, index, keys) => keys.indexOf(roleCode) !== index);

  const roleMapUnknownRoles = Object.keys(ROLE_PERMISSION_MAP).filter((roleCode) => !ROLE_CODES.includes(roleCode));
  const roleMapMissingCoreRoles = Object.keys(ROLE_PERMISSION_MAP).filter((roleCode) => !coreRoleCodes.includes(roleCode));
  const roleMapUnknownPermissions = Object.entries(ROLE_PERMISSION_MAP).flatMap(([roleCode, permissionCodes]) => (
    permissionCodes
      .filter((permissionCode) => !PERMISSION_CODES.includes(permissionCode))
      .map((permissionCode) => ({ roleCode, permissionCode }))
  ));

  const result = {
    mode: 'constants',
    roles_in_constants: ROLE_CODES.length,
    core_roles: coreRoleCodes.length,
    role_permission_roles: Object.keys(ROLE_PERMISSION_MAP).length,
    permissions_in_constants: PERMISSION_CODES.length,
    duplicate_core_roles: unique(duplicateCoreRoles),
    duplicate_role_map_keys: unique(duplicateRoleMapKeys),
    role_map_unknown_roles: roleMapUnknownRoles,
    role_map_missing_core_roles: roleMapMissingCoreRoles,
    role_map_unknown_permissions: roleMapUnknownPermissions,
  };

  const hasError = result.duplicate_core_roles.length ||
    result.duplicate_role_map_keys.length ||
    result.role_map_unknown_roles.length ||
    result.role_map_missing_core_roles.length ||
    result.role_map_unknown_permissions.length;

  return { result, hasError: Boolean(hasError) };
}

async function checkRbacIntegrity() {
  const { connectDatabase, mongoose } = require('../config/database');
  const { Permission, Role, RolePermission } = require('../models');

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
  const extraPermissionsInDb = permissions
    .map((permission) => permission.permission_code)
    .filter((code) => !PERMISSION_CODES.includes(code));
  const roleMapMissingRoles = Object.keys(ROLE_PERMISSION_MAP).filter((roleCode) => !roleCodesInDb.has(roleCode));
  const danglingRolePermissions = rolePermissions.filter((item) => (
    !roleIdsInDb.has(String(item.role_id)) || !permissionIdsInDb.has(String(item.permission_id))
  ));

  const result = {
    mode: 'database',
    permissions_in_constants: PERMISSION_CODES.length,
    permissions_in_db: permissions.length,
    roles_in_db: roles.length,
    active_role_permissions: rolePermissions.length,
    missing_permissions: missingPermissions,
    extra_permissions_in_db: extraPermissionsInDb,
    role_map_missing_roles: roleMapMissingRoles,
    dangling_role_permissions: danglingRolePermissions.map((item) => ({
      role_permission_id: String(item._id),
      role_id: String(item.role_id),
      permission_id: String(item.permission_id),
    })),
  };

  const hasError = missingPermissions.length ||
    extraPermissionsInDb.length ||
    roleMapMissingRoles.length ||
    danglingRolePermissions.length;

  return {
    result,
    hasError: Boolean(hasError),
    disconnect: () => mongoose.disconnect(),
  };
}

async function main() {
  const constantsOnly = process.argv.includes('--constants-only') || process.env.RBAC_CONSTANTS_ONLY === 'true';
  const constantsCheck = checkRbacConstants();

  if (constantsOnly || constantsCheck.hasError) {
    console.log(JSON.stringify(constantsCheck.result, null, 2));
    if (constantsCheck.hasError) process.exitCode = 1;
    return;
  }

  let dbCheck;
  try {
    dbCheck = await checkRbacIntegrity();
    console.log(JSON.stringify(dbCheck.result, null, 2));
    if (dbCheck.hasError) process.exitCode = 1;
  } catch (error) {
    console.error('RBAC database integrity check failed:', error.message);
    console.error('Constants check passed. Run with --constants-only to skip DB/package requirements.');
    process.exitCode = 1;
  } finally {
    if (dbCheck?.disconnect) await dbCheck.disconnect();
  }
}

main();
