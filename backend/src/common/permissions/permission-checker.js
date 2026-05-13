const {
  PERMISSION,
  PERMISSION_ALIASES,
  normalizePermissionCode,
  normalizePermissionCodes,
} = require('../../constants/permissions');
const ApiError = require('../errors/api-error');

function toPermissionArray(permissions = []) {
  if (permissions instanceof Set) return [...permissions];
  if (Array.isArray(permissions)) return permissions;
  return [];
}

function actorPermissions(actor = {}) {
  return toPermissionArray(actor.permissions || actor.permission_codes);
}

function buildPermissionSet(permissions = []) {
  return new Set(normalizePermissionCodes(toPermissionArray(permissions)));
}

function hasPermission(actorOrPermissions = {}, requiredPermission) {
  const permissions = Array.isArray(actorOrPermissions) || actorOrPermissions instanceof Set
    ? actorOrPermissions
    : actorPermissions(actorOrPermissions);
  const permissionSet = buildPermissionSet(permissions);
  const normalizedRequiredPermission = normalizePermissionCode(requiredPermission);

  return (
    permissionSet.has(PERMISSION.SYSTEM.FULL_ACCESS) ||
    permissionSet.has(normalizedRequiredPermission)
  );
}

function hasAnyPermission(actorOrPermissions = {}, requiredPermissions = []) {
  return requiredPermissions.some((permissionCode) => hasPermission(actorOrPermissions, permissionCode));
}

function hasAllPermissions(actorOrPermissions = {}, requiredPermissions = []) {
  return requiredPermissions.every((permissionCode) => hasPermission(actorOrPermissions, permissionCode));
}

function assertPermission(actorOrPermissions = {}, requiredPermission, message = 'Tài khoản hiện tại không có quyền truy cập chức năng này.') {
  if (!hasPermission(actorOrPermissions, requiredPermission)) {
    throw ApiError.forbidden(message, { requiredPermission });
  }
  return true;
}

function assertAnyPermission(actorOrPermissions = {}, requiredPermissions = [], message = 'Tài khoản hiện tại không có quyền truy cập chức năng này.') {
  if (!hasAnyPermission(actorOrPermissions, requiredPermissions)) {
    throw ApiError.forbidden(message, { requiredPermissions });
  }
  return true;
}

function assertAllPermissions(actorOrPermissions = {}, requiredPermissions = [], message = 'Tài khoản hiện tại chưa có đủ tất cả quyền yêu cầu.') {
  if (!hasAllPermissions(actorOrPermissions, requiredPermissions)) {
    throw ApiError.forbidden(message, { requiredPermissions });
  }
  return true;
}

function getEquivalentPermissionCodes(permissionCode) {
  return [permissionCode, normalizePermissionCode(permissionCode)]
    .filter(Boolean)
    .filter((code, index, codes) => codes.indexOf(code) === index);
}

function explainPermission(requiredPermission) {
  return {
    requested: requiredPermission,
    normalized: normalizePermissionCode(requiredPermission),
    alias_target: PERMISSION_ALIASES[requiredPermission] || null,
  };
}

module.exports = {
  toPermissionArray,
  actorPermissions,
  buildPermissionSet,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  assertPermission,
  assertAnyPermission,
  assertAllPermissions,
  getEquivalentPermissionCodes,
  explainPermission,
};
