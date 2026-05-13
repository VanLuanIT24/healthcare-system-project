const { Permission, Role, RolePermission, User, UserRole } = require('../models');
const {
  PERMISSION,
  ROLE_CODE,
} = require('../constants/permissions');
const permissionService = require('./permission.service');
const { PATIENT_PORTAL_PERMISSIONS } = require('./auth/auth.policy');

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

  return permissionService.buildPermissionSet(permissions.map((permission) => permission.permission_code));
}

async function buildUserRoleDetails(userId) {
  const roles = await findActiveRolesByUserId(userId);

  return roles.map((role) => ({
    role_id: String(role._id),
    role_code: role.role_code,
    role_name: role.role_name,
    description: role.description,
    status: role.status,
    is_system: Boolean(role.is_system),
    priority_level: Number(role.priority_level || 0),
  }));
}

function getEquivalentPermissionCodes(permissionCode) {
  return permissionService.getEquivalentPermissionCodes(permissionCode);
}

function permissionSetHas(permissionSet, permissionCode) {
  return permissionService.hasPermission([...permissionSet], permissionCode);
}

function hasPermission(userContext, permissionCode) {
  return permissionService.hasPermission(userContext.permissions || [], permissionCode);
}

function hasAnyPermission(userContext, permissionCodes = []) {
  return permissionService.hasAnyPermission(userContext.permissions || [], permissionCodes);
}

function hasAllPermissions(userContext, permissionCodes = []) {
  return permissionService.hasAllPermissions(userContext.permissions || [], permissionCodes);
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
      roles: [ROLE_CODE.PATIENT],
      permissions: PATIENT_PORTAL_PERMISSIONS,
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
  return permissionSetHas(permissions, permissionCode);
}

module.exports = {
  // findActiveRolesByUserId: Tìm các vai trò đang hoạt động của người dùng theo user id.
  findActiveRolesByUserId,
  // buildUserPermissionMap: Tạo bản đồ quyền của người dùng để tra cứu phân quyền nhanh.
  buildUserPermissionMap,
  // buildUserRoleDetails: Tổng hợp chi tiết vai trò đang gán cho người dùng.
  buildUserRoleDetails,
  // hasPermission: Kiểm tra người dùng/actor có một quyền cụ thể hay không.
  hasPermission,
  // hasAnyPermission: Kiểm tra người dùng/actor có ít nhất một quyền trong danh sách yêu cầu hay không.
  hasAnyPermission,
  // hasAllPermissions: Kiểm tra người dùng/actor có đầy đủ tất cả quyền được yêu cầu hay không.
  hasAllPermissions,
  // requireActorType: Bảo đảm actor thuộc đúng loại tài khoản trước khi xử lý nghiệp vụ.
  requireActorType,
  // getCurrentUserContext: Lấy ngữ cảnh người dùng hiện tại gồm thông tin định danh, vai trò và quyền.
  getCurrentUserContext,
  // checkPermission: Kiểm tra quyền truy cập và trả lỗi khi actor không đủ quyền.
  checkPermission,
  // getEquivalentPermissionCodes: Lấy các mã quyền tương đương để hỗ trợ tương thích quyền cũ và mới.
  getEquivalentPermissionCodes,
};
