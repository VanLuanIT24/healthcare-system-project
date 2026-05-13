const {
  CANONICAL_PERMISSION_CODES,
  CORE_ROLES,
  ROLE_PERMISSION_MAP,
  getPermissionDefinition,
} = require('./permissions');

const coreRoles = CORE_ROLES;
const corePermissions = CANONICAL_PERMISSION_CODES.map(getPermissionDefinition);
const rolePermissionMap = ROLE_PERMISSION_MAP;

module.exports = {
  coreRoles,
  corePermissions,
  rolePermissionMap,
};
