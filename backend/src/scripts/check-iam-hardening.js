const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(relativePath, expected, message) {
  if (!read(relativePath).includes(expected)) {
    throw new Error(`${message} (${relativePath})`);
  }
}

function assertNotIncludes(relativePath, unexpected, message) {
  if (read(relativePath).includes(unexpected)) {
    throw new Error(`${message} (${relativePath})`);
  }
}

function main() {
  assertIncludes('src/routes/iam.routes.js', "router.param('roleId', validateObjectIdParam)", 'IAM roleId route param must be ObjectId-validated.');
  assertIncludes('src/routes/iam.routes.js', "router.param('permissionId', validateObjectIdParam)", 'IAM permissionId route param must be ObjectId-validated.');
  assertIncludes('src/routes/iam.routes.js', 'iamRequest.createRole', 'IAM role create route must validate body.');
  assertIncludes('src/routes/iam.routes.js', 'iamRequest.permissionCodes', 'IAM role-permission routes must validate body.');
  assertIncludes('src/routes/iam.routes.js', 'authorize({ permissions: [PERMISSION.USERS.ASSIGN_ROLES] })', 'IAM rebuild-permissions route must require assign-roles.');

  assertIncludes('src/services/iam/user-role.service.js', 'assertCanManageTargetStaffRoles', 'Staff role mutation must check target role priority.');
  assertIncludes('src/services/iam/user-role.service.js', 'targetMaxPriority >= getActorMaxRolePriority(actor)', 'Staff role mutation must block equal-or-higher target priority.');
  assertNotIncludes('src/services/iam/user-role.service.js', "roles: [ROLE_CODE.SUPER_ADMIN]", 'Staff role removal must not fake super-admin actor.');

  assertIncludes('src/services/iam/role-permission.service.js', 'assertCoreRolePermissionInvariant', 'Role-permission sync/remove must keep core role invariants.');
  assertNotIncludes('src/services/iam/role-permission.service.js', "permissions: [PERMISSION.SYSTEM.FULL_ACCESS]", 'Permission removal must not fake full-access actor.');

  assertIncludes('src/services/iam/role.service.js', 'priorityLevel >= getActorMaxRolePriority(actor)', 'Role create must block priority equal-or-higher than actor.');
  assertIncludes('src/services/iam/role.service.js', 'nextPriority >= getActorMaxRolePriority(actor)', 'Role update must block priority equal-or-higher than actor.');
  assertIncludes('src/services/iam/role.service.js', 'role.is_system', 'System roles must be protected.');

  assertIncludes('src/services/iam/permission.service.js', 'is_system: isSystem', 'Permission create must not default new permissions to system.');
  assertIncludes('src/services/iam/permission.service.js', 'Không được xóa system permission', 'System permissions must not be deleted.');

  console.log('IAM hardening checks passed.');
}

main();
