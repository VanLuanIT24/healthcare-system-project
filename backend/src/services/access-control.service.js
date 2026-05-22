const { Permission, Role, RolePermission, User, UserRole } = require('../models');
const { normalizeActorType } = require('../constants/statuses');
const {
  PERMISSION,
  ROLE_CODE,
} = require('../constants/permissions');
const permissionService = require('./permission.service');
const { PATIENT_PORTAL_PERMISSIONS, RELATIVE_PORTAL_PERMISSIONS } = require('./auth/auth.policy');

const AUTHORIZATION_CACHE_TTL_MS = 30 * 1000;
const authorizationCache = new Map();

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

function cloneAuthorizationSnapshot(snapshot = {}) {
  return {
    roles: [...(snapshot.roles || [])],
    roleDetails: (snapshot.roleDetails || []).map((role) => ({ ...role })),
    permissions: [...(snapshot.permissions || [])],
    permissionVersion: Number(snapshot.permissionVersion || 1),
  };
}

function cacheKeyForUser(userId, permissionVersion = 1) {
  return `${String(userId)}:${Number(permissionVersion || 1)}`;
}

function getCachedAuthorization(userId, permissionVersion) {
  const cached = authorizationCache.get(cacheKeyForUser(userId, permissionVersion));
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cloneAuthorizationSnapshot(cached.value);
}

function setCachedAuthorization(userId, permissionVersion, value) {
  authorizationCache.set(cacheKeyForUser(userId, permissionVersion), {
    expiresAt: Date.now() + AUTHORIZATION_CACHE_TTL_MS,
    value: cloneAuthorizationSnapshot(value),
  });
}

function clearUserAuthorizationCache(userId) {
  const prefix = `${String(userId)}:`;
  for (const key of authorizationCache.keys()) {
    if (key.startsWith(prefix)) authorizationCache.delete(key);
  }
}

function clearAllAuthorizationCache() {
  const size = authorizationCache.size;
  authorizationCache.clear();
  return size;
}

function getAuthorizationCacheStatus() {
  let expired = 0;
  for (const cached of authorizationCache.values()) {
    if (!cached || cached.expiresAt <= Date.now()) expired += 1;
  }

  return {
    ttl_ms: AUTHORIZATION_CACHE_TTL_MS,
    entries: authorizationCache.size,
    expired_entries: expired,
    strategy: 'in_memory_by_user_permission_version',
  };
}

async function buildUserAuthorizationSnapshot(userId, permissionVersion = 1) {
  const cached = getCachedAuthorization(userId, permissionVersion);
  if (cached) return cached;

  const [roleDetails, permissionSet] = await Promise.all([
    buildUserRoleDetails(userId),
    buildUserPermissionMap(userId),
  ]);
  const snapshot = {
    roles: roleDetails.map((role) => role.role_code),
    roleDetails,
    permissions: [...permissionSet],
    permissionVersion: Number(permissionVersion || 1),
  };
  setCachedAuthorization(userId, permissionVersion, snapshot);
  return cloneAuthorizationSnapshot(snapshot);
}

async function bumpUserPermissionVersion(userId) {
  if (!userId) return null;
  clearUserAuthorizationCache(userId);
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { permission_version: 1 } },
    { new: true, select: '_id permission_version' },
  ).lean();
  return updated ? Number(updated.permission_version || 1) : null;
}

async function bumpUsersPermissionVersion(userIds = []) {
  const uniqueUserIds = [...new Set(userIds.map(String).filter(Boolean))];
  if (!uniqueUserIds.length) return 0;
  uniqueUserIds.forEach(clearUserAuthorizationCache);
  const result = await User.updateMany(
    { _id: { $in: uniqueUserIds } },
    { $inc: { permission_version: 1 } },
  );
  return result.modifiedCount || 0;
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

  const actorType = normalizeActorType(userContext.actorType || userContext.actor_type);
  return actorTypes.map(normalizeActorType).includes(actorType);
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

  if (auth.actorType === 'patient_relative') {
    return {
      userId: auth.relativeId,
      username: auth.relative?.email || auth.relative?.phone || auth.relativeId,
      actorType: 'patient_relative',
      status: auth.relative?.status,
      departmentId: null,
      patientId: auth.patientId,
      roles: [ROLE_CODE.PATIENT_RELATIVE],
      permissions: RELATIVE_PORTAL_PERMISSIONS,
    };
  }

  const user = await User.findById(auth.userId).lean();
  if (!user || user.is_deleted) {
    return null;
  }

  const authorization = await buildUserAuthorizationSnapshot(user._id, user.permission_version);

  return {
    userId: String(user._id),
    username: user.username,
    actorType: 'staff',
    status: user.status,
    departmentId: user.department_id ? String(user.department_id) : null,
    roles: authorization.roles,
    permissions: authorization.permissions,
    permissionVersion: authorization.permissionVersion,
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
  // buildUserAuthorizationSnapshot: Lấy snapshot role/quyền có cache ngắn theo permission_version.
  buildUserAuthorizationSnapshot,
  // clearUserAuthorizationCache: Xóa cache quyền của một user.
  clearUserAuthorizationCache,
  // clearAllAuthorizationCache: Xóa toàn bộ cache quyền trong tiến trình hiện tại.
  clearAllAuthorizationCache,
  // getAuthorizationCacheStatus: Lấy trạng thái cache phân quyền trong tiến trình hiện tại.
  getAuthorizationCacheStatus,
  // bumpUserPermissionVersion: Tăng version quyền của một user để vô hiệu hóa cache/token cũ.
  bumpUserPermissionVersion,
  // bumpUsersPermissionVersion: Tăng version quyền của nhiều user.
  bumpUsersPermissionVersion,
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
