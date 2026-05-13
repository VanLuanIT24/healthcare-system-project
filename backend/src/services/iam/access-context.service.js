const ApiError = require('../../common/errors/api-error');
const { PERMISSION } = require('../../constants/permissions');
const { Permission, Role, RolePermission, User, UserRole } = require('../../models');
const permissionService = require('../permission.service');

function serializeStaffUser(user) {
  return {
    user_id: String(user._id || user.id),
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    employee_code: user.employee_code,
    department_id: user.department_id ? String(user.department_id) : null,
    status: user.status,
    must_change_password: Boolean(user.must_change_password),
  };
}

async function getActiveRolesForUser(userId) {
  const assignments = await UserRole.find({
    user_id: userId,
    is_active: true,
  }).lean();

  if (!assignments.length) return [];

  return Role.find({
    _id: { $in: assignments.map((item) => item.role_id) },
    status: 'active',
    is_deleted: false,
  }).lean();
}

async function getEffectivePermissionsForRoles(roleIds = []) {
  if (!roleIds.length) return [];

  const rolePermissions = await RolePermission.find({
    role_id: { $in: roleIds },
    is_active: true,
  }).lean();

  if (!rolePermissions.length) return [];

  const permissions = await Permission.find({
    _id: { $in: rolePermissions.map((item) => item.permission_id) },
    is_deleted: false,
  }).lean();

  return [...permissionService.buildPermissionSet(permissions.map((permission) => permission.permission_code))];
}

async function rebuildUserPermissionCache(userId) {
  const roles = await getActiveRolesForUser(userId);
  const permissions = await getEffectivePermissionsForRoles(roles.map((role) => role._id));

  return {
    user_id: String(userId),
    roles: roles.map((role) => role.role_code),
    permissions,
    has_full_access: permissionService.hasPermission(permissions, PERMISSION.SYSTEM.FULL_ACCESS),
    cache_rebuilt: false,
  };
}

async function buildStaffPermissionContext(userId) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted || user.status !== 'active') {
    throw ApiError.unauthorized('Tài khoản nhân sự không khả dụng.');
  }

  const permissionContext = await rebuildUserPermissionCache(user._id);

  return {
    actor_type: 'staff',
    actor_id: String(user._id),
    user: serializeStaffUser(user),
    department_id: user.department_id ? String(user.department_id) : null,
    roles: permissionContext.roles,
    permissions: permissionContext.permissions,
    has_full_access: permissionContext.has_full_access,
  };
}

function hasPermission(permissionCodes = [], requiredPermission) {
  return permissionService.hasPermission(permissionCodes, requiredPermission);
}

function hasAnyPermission(permissionCodes = [], requiredPermissions = []) {
  return permissionService.hasAnyPermission(permissionCodes, requiredPermissions);
}

function hasAllPermissions(permissionCodes = [], requiredPermissions = []) {
  return permissionService.hasAllPermissions(permissionCodes, requiredPermissions);
}

function hasRole(context = {}, roleCode) {
  return (context.roles || []).includes(roleCode);
}

async function checkStaffPermission(userId, permissionCode) {
  const context = await rebuildUserPermissionCache(userId);
  return {
    user_id: String(userId),
    permission_code: permissionCode,
    allowed: hasPermission(context.permissions, permissionCode),
    has_full_access: context.has_full_access,
  };
}

async function getStaffRoles(userId) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');
  }

  const roles = await getActiveRolesForUser(user._id);
  return {
    user: {
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      status: user.status,
      department_id: user.department_id ? String(user.department_id) : null,
    },
    roles: roles.map((role) => ({
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      description: role.description,
      status: role.status,
      is_system: role.is_system,
      priority_level: role.priority_level,
    })),
  };
}

async function getStaffPermissions(userId) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');
  }

  const context = await rebuildUserPermissionCache(user._id);
  return {
    user: {
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      status: user.status,
    },
    roles: context.roles,
    permissions: context.permissions,
    has_full_access: context.has_full_access,
  };
}

module.exports = {
  // serializeStaffUser: Chuẩn hóa dữ liệu người dùng nhân sự trước khi trả về API.
  serializeStaffUser,
  // getActiveRolesForUser: Lấy vai trò đang hoạt động của người dùng.
  getActiveRolesForUser,
  // getEffectivePermissionsForRoles: Lấy quyền hiệu lực từ các vai trò.
  getEffectivePermissionsForRoles,
  // rebuildUserPermissionCache: Dựng lại cache quyền hiệu lực của người dùng.
  rebuildUserPermissionCache,
  // buildStaffPermissionContext: Xây dựng ngữ cảnh quyền của nhân sự.
  buildStaffPermissionContext,
  // hasPermission: Kiểm tra người dùng/actor có một quyền cụ thể hay không.
  hasPermission,
  // hasAnyPermission: Kiểm tra người dùng/actor có ít nhất một quyền trong danh sách yêu cầu hay không.
  hasAnyPermission,
  // hasAllPermissions: Kiểm tra người dùng/actor có đầy đủ tất cả quyền được yêu cầu hay không.
  hasAllPermissions,
  // hasRole: Kiểm tra có vai trò.
  hasRole,
  // checkStaffPermission: Kiểm tra quyền của nhân sự.
  checkStaffPermission,
  // getStaffRoles: Lấy vai trò của nhân sự.
  getStaffRoles,
  // getStaffPermissions: Lấy quyền của nhân sự.
  getStaffPermissions,
};
