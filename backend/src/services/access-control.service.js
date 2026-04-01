const { Permission, Role, RolePermission, User, UserRole } = require('../models');

async function findActiveRolesByUserId(userId) {
  const userRoles = await UserRole.find({ user_id: userId, is_active: true }).lean();
  const roleIds = userRoles.map((item) => item.role_id);

  if (roleIds.length === 0) {
    return [];
  }

  return Role.find({
    _id: { $in: roleIds },
    status: 'active',
    is_deleted: false,
  }).lean();
}

async function buildUserPermissionMap(userId) {
  const roles = await findActiveRolesByUserId(userId);
  const roleIds = roles.map((role) => role._id);

  if (roleIds.length === 0) {
    return new Set();
  }

  const rolePermissions = await RolePermission.find({
    role_id: { $in: roleIds },
    is_active: true,
  }).lean();

  const permissionIds = [...new Set(rolePermissions.map((item) => String(item.permission_id)))];
  if (permissionIds.length === 0) {
    return new Set();
  }

  const permissions = await Permission.find({
    _id: { $in: permissionIds },
    is_deleted: false,
  }).lean();

  return new Set(permissions.map((permission) => permission.permission_code));
}

async function buildUserRoleDetails(userId) {
  const roles = await findActiveRolesByUserId(userId);

  return roles.map((role) => ({
    role_id: String(role._id),
    role_code: role.role_code,
    role_name: role.role_name,
    description: role.description,
    status: role.status,
  }));
}

function hasPermission(userContext, permissionCode) {
  return (userContext.permissions || []).includes(permissionCode);
}

function hasAnyPermission(userContext, permissionCodes = []) {
  return permissionCodes.some((permissionCode) => hasPermission(userContext, permissionCode));
}

function hasAllPermissions(userContext, permissionCodes = []) {
  return permissionCodes.every((permissionCode) => hasPermission(userContext, permissionCode));
}

function requireActorType(userContext, actorTypes = []) {
  if (actorTypes.length === 0) {
    return true;
  }

  return actorTypes.includes(userContext.actorType);
}

async function getCurrentUserContext(auth) {
  if (auth.actorType === 'patient') {
    return {
      userId: auth.patientAccountId,
      username: auth.account.username,
      actorType: 'patient',
      status: auth.account.status,
      departmentId: null,
      roles: ['patient'],
      permissions: ['patients.self.read', 'patients.self.update', 'appointments.self.read', 'appointments.self.create'],
    };
  }

  const user = await User.findById(auth.userId).lean();
  if (!user || user.is_deleted) {
    return null;
  }

  const roles = await buildUserRoleDetails(user._id);
  const permissions = [...(await buildUserPermissionMap(user._id))];

  return {
    userId: String(user._id),
    username: user.username,
    actorType: 'staff',
    status: user.status,
    departmentId: user.department_id ? String(user.department_id) : null,
    roles: roles.map((role) => role.role_code),
    permissions,
  };
}

async function checkPermission({ userId, permissionCode }) {
  const permissions = await buildUserPermissionMap(userId);
  return permissions.has(permissionCode);
}

module.exports = {
  findActiveRolesByUserId,
  buildUserPermissionMap,
  buildUserRoleDetails,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requireActorType,
  getCurrentUserContext,
  checkPermission,
};
