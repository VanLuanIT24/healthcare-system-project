const ApiError = require('../../common/errors/api-error');
const { mongoose } = require('../../config/database');
const { normalizePagination, buildPaginationMeta } = require('../../common/helpers/pagination.helper');
const { buildRegexSearch } = require('../../common/helpers/query.helper');
const { ROLE_CODE, ROLE_PRIORITY } = require('../../constants/permissions');
const { ROLE_STATUSES } = require('../../constants/statuses');
const { Permission, Role, RolePermission, User, UserRole } = require('../../models');
const { getEffectivePermissionsForRoles } = require('./access-context.service');
const { recordIamAudit } = require('./iam-audit.helper');
const sessionService = require('../auth/auth-session.service');
const { bumpUsersPermissionVersion } = require('../access-control.service');
const {
  PROTECTED_ROLE_CODES,
  assertCanManageRole,
  getActorMaxRolePriority,
  getActorId,
  isSuperAdmin,
  normalizeRoleCode,
  validateRoleCode,
} = require('./iam.policy');

function serializeRole(role, extra = {}) {
  const plain = typeof role.toObject === 'function' ? role.toObject() : role;
  return {
    role_id: String(plain._id || plain.id),
    id: String(plain._id || plain.id),
    role_code: plain.role_code,
    role_name: plain.role_name,
    description: plain.description,
    status: plain.status,
    is_system: Boolean(plain.is_system),
    is_mutable: plain.is_mutable !== false,
    role_version: Number(plain.role_version || 1),
    priority_level: plain.priority_level || 0,
    ...extra,
  };
}

async function findRoleByIdOrCode(roleIdOrCode, options = {}) {
  const clauses = [{ role_code: roleIdOrCode }];
  if (mongoose.Types.ObjectId.isValid(roleIdOrCode)) {
    clauses.push({ _id: roleIdOrCode });
  }

  const role = await Role.findOne({
    ...(options.includeDeleted ? {} : { is_deleted: false }),
    $or: clauses,
  });

  if (!role && options.required !== false) {
    throw ApiError.notFound('Không tìm thấy role.');
  }

  return role;
}

async function getRoleUsageSummary(roleIdOrCode) {
  const role = await findRoleByIdOrCode(roleIdOrCode);
  const assignments = await UserRole.find({ role_id: role._id, is_active: true }).lean();
  const userIds = assignments.map((item) => item.user_id);
  const [activeUserCount, disabledUserCount, permissionCount] = await Promise.all([
    User.countDocuments({ _id: { $in: userIds }, status: 'active', is_deleted: false }),
    User.countDocuments({ _id: { $in: userIds }, status: { $ne: 'active' }, is_deleted: false }),
    RolePermission.countDocuments({ role_id: role._id, is_active: true }),
  ]);

  return {
    role_id: String(role._id),
    role_code: role.role_code,
    user_count: assignments.length,
    active_user_count: activeUserCount,
    disabled_user_count: disabledUserCount,
    permission_count: permissionCount,
  };
}

async function createRole(payload = {}, actor = {}, requestMeta = {}) {
  const roleCode = normalizeRoleCode(payload.role_code);
  validateRoleCode(roleCode);

  if (roleCode === ROLE_CODE.SUPER_ADMIN && !isSuperAdmin(actor)) {
    throw ApiError.forbidden('Chỉ super_admin mới được tạo role super_admin.');
  }

  if (!payload.role_name || !String(payload.role_name).trim()) {
    throw ApiError.validation('role_name là bắt buộc.');
  }

  const existed = await Role.findOne({ role_code: roleCode, is_deleted: false }).lean();
  if (existed) {
    throw ApiError.conflict('role_code đã tồn tại.');
  }

  if (payload.status !== undefined && !ROLE_STATUSES.includes(payload.status)) {
    throw ApiError.validation('status không hợp lệ.');
  }

  const priorityLevel = Number(payload.priority_level ?? ROLE_PRIORITY[roleCode] ?? 0);
  if (!Number.isInteger(priorityLevel) || priorityLevel < 0 || priorityLevel > 100) {
    throw ApiError.validation('priority_level phải là số nguyên từ 0 đến 100.');
  }

  if (!isSuperAdmin(actor) && priorityLevel >= getActorMaxRolePriority(actor)) {
    throw ApiError.forbidden('Không được tạo role có priority bằng hoặc cao hơn mình.');
  }

  const role = await Role.create({
    role_code: roleCode,
    role_name: String(payload.role_name).trim(),
    description: payload.description,
    status: payload.status || 'active',
    is_system: false,
    priority_level: priorityLevel,
    created_by: getActorId(actor),
  });

  await recordIamAudit({
    actor,
    action: 'roles.create',
    targetType: 'role',
    targetId: role._id,
    after: role,
    message: 'Tạo role thành công.',
    requestMeta,
  });

  return { role: serializeRole(role) };
}

async function listRoles(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = {};

  if (!query.include_deleted) filter.is_deleted = false;
  if (query.status) filter.status = query.status;

  const keyword = query.keyword || query.search;
  if (keyword) {
    const regex = buildRegexSearch(keyword);
    filter.$or = [{ role_code: regex }, { role_name: regex }];
  }

  const [roles, total] = await Promise.all([
    Role.find(filter).sort({ priority_level: -1, role_code: 1 }).skip(skip).limit(limit).lean(),
    Role.countDocuments(filter),
  ]);

  const items = await Promise.all(roles.map(async (role) => {
    const [permissionCount, userCount] = await Promise.all([
      RolePermission.countDocuments({ role_id: role._id, is_active: true }),
      UserRole.countDocuments({ role_id: role._id, is_active: true }),
    ]);
    return serializeRole(role, {
      permission_count: permissionCount,
      user_count: userCount,
    });
  }));

  return {
    items,
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function getRoleDetail(roleIdOrCode) {
  const role = await findRoleByIdOrCode(roleIdOrCode);
  const rolePermissions = await RolePermission.find({ role_id: role._id, is_active: true }).lean();
  const permissions = await Permission.find({
    _id: { $in: rolePermissions.map((item) => item.permission_id) },
    is_deleted: false,
  }).sort({ module_key: 1, permission_code: 1 }).lean();
  const usage = await getRoleUsageSummary(role._id);

  return {
    role: serializeRole(role),
    permissions: permissions.map((permission) => ({
      permission_id: String(permission._id),
      permission_code: permission.permission_code,
      permission_name: permission.permission_name,
      module_key: permission.module_key,
      action_key: permission.action_key,
      is_system: permission.is_system,
    })),
    usage,
  };
}

async function updateRole(roleId, payload = {}, actor = {}, requestMeta = {}) {
  const role = await findRoleByIdOrCode(roleId);
  assertCanManageRole(role, actor, 'cập nhật role');
  const before = role.toObject();

  if (payload.role_code && payload.role_code !== role.role_code) {
    if (role.is_mutable === false || role.is_system || PROTECTED_ROLE_CODES.has(role.role_code)) {
      throw ApiError.forbidden('Không được đổi role_code của role hệ thống.');
    }
    const nextRoleCode = normalizeRoleCode(payload.role_code);
    validateRoleCode(nextRoleCode);
    const existed = await Role.findOne({ _id: { $ne: role._id }, role_code: nextRoleCode, is_deleted: false }).lean();
    if (existed) throw ApiError.conflict('role_code đã tồn tại.');
    role.role_code = nextRoleCode;
  }

  if (payload.role_name !== undefined) {
    const roleName = String(payload.role_name).trim();
    if (!roleName) throw ApiError.validation('role_name không được rỗng.');
    role.role_name = roleName;
  }
  if (payload.description !== undefined) role.description = payload.description;
  if (payload.is_mutable !== undefined) {
    if (!isSuperAdmin(actor)) throw ApiError.forbidden('Chỉ super_admin mới được đổi is_mutable của role.');
    role.is_mutable = payload.is_mutable !== false;
  }
  if (payload.priority_level !== undefined) {
    const nextPriority = Number(payload.priority_level);
    if (!Number.isInteger(nextPriority) || nextPriority < 0 || nextPriority > 100) {
      throw ApiError.validation('priority_level phải là số nguyên từ 0 đến 100.');
    }
    if (!isSuperAdmin(actor) && nextPriority >= getActorMaxRolePriority(actor)) {
      throw ApiError.forbidden('Không được nâng role lên cấp quyền bằng hoặc cao hơn mình.');
    }
    role.priority_level = nextPriority;
  }
  role.role_version = Number(role.role_version || 1) + 1;
  role.updated_by = getActorId(actor);
  await role.save();

  await recordIamAudit({
    actor,
    action: 'roles.update',
    targetType: 'role',
    targetId: role._id,
    before,
    after: role,
    message: 'Cập nhật role thành công.',
    requestMeta,
  });

  return { role: serializeRole(role) };
}

async function ensureAtLeastOneActiveSuperAdminRemains(excludingRoleId = null) {
  const superAdminRole = await Role.findOne({ role_code: ROLE_CODE.SUPER_ADMIN, is_deleted: false }).lean();
  if (!superAdminRole) return true;

  if (excludingRoleId && String(superAdminRole._id) === String(excludingRoleId)) {
    const activeSuperAdmins = await UserRole.countDocuments({ role_id: superAdminRole._id, is_active: true });
    if (activeSuperAdmins > 0) {
      throw ApiError.conflict('Không thể vô hiệu hóa/xóa role super_admin khi vẫn là role quản trị cao nhất.');
    }
  }

  const assignments = await UserRole.find({ role_id: superAdminRole._id, is_active: true }).lean();
  const count = await User.countDocuments({
    _id: { $in: assignments.map((item) => item.user_id) },
    status: 'active',
    is_deleted: false,
  });

  if (count <= 0) {
    throw ApiError.conflict('Hệ thống phải còn ít nhất một super_admin active.');
  }

  return true;
}

async function invalidateUsersByRole(roleId, actor = {}, requestMeta = {}) {
  const assignments = await UserRole.find({ role_id: roleId, is_active: true }).lean();
  let revokedSessions = 0;
  await bumpUsersPermissionVersion(assignments.map((assignment) => assignment.user_id));

  for (const assignment of assignments) {
    const result = await sessionService.invalidateAllUserSessions('staff', assignment.user_id, requestMeta, {
      actorType: actor.actorType,
      actorId: getActorId(actor),
      audit: false,
    });
    revokedSessions += result.revoked_count || 0;
  }

  return revokedSessions;
}

async function updateRoleStatus(roleId, payload = {}, actor = {}, requestMeta = {}) {
  const status = payload.status;
  if (!['active', 'inactive'].includes(status)) {
    throw ApiError.badRequest('Trạng thái role không hợp lệ.');
  }

  const role = await findRoleByIdOrCode(roleId);
  assertCanManageRole(role, actor, 'cập nhật trạng thái role');
  if (role.is_system && status !== 'active') {
    throw ApiError.forbidden('Không được vô hiệu hóa role hệ thống.');
  }
  if (role.role_code === ROLE_CODE.SUPER_ADMIN && status !== 'active') {
    await ensureAtLeastOneActiveSuperAdminRemains(role._id);
  }

  const before = role.toObject();
  role.status = status;
  role.role_version = Number(role.role_version || 1) + 1;
  role.updated_by = getActorId(actor);
  await role.save();
  const revokedSessions = status === 'inactive'
    ? await invalidateUsersByRole(role._id, actor, requestMeta)
    : 0;

  await recordIamAudit({
    actor,
    action: 'roles.status_update',
    targetType: 'role',
    targetId: role._id,
    before,
    after: role,
    message: 'Cập nhật trạng thái role thành công.',
    requestMeta,
    metadata: {
      status,
      revoked_sessions: revokedSessions,
    },
  });

  return { role: serializeRole(role) };
}

async function deleteRoleSoft(roleId, actor = {}, requestMeta = {}) {
  const role = await findRoleByIdOrCode(roleId);
  assertCanManageRole(role, actor, 'xóa role');

  if (role.is_system) {
    throw ApiError.forbidden('Không được xóa role hệ thống.');
  }

  if (PROTECTED_ROLE_CODES.has(role.role_code)) {
    throw ApiError.forbidden('Không được xóa mềm role hệ thống quan trọng.');
  }

  const usage = await getRoleUsageSummary(role._id);
  if (usage.active_user_count > 0) {
    throw ApiError.conflict('Role vẫn đang được gán cho user active, chưa thể xóa mềm.');
  }

  const before = role.toObject();
  role.is_deleted = true;
  role.deleted_at = new Date();
  role.deleted_by = getActorId(actor);
  role.status = 'inactive';
  role.role_version = Number(role.role_version || 1) + 1;
  role.updated_by = getActorId(actor);
  await role.save();

  await RolePermission.updateMany({ role_id: role._id }, { $set: { is_active: false, updated_by: getActorId(actor) } });

  await recordIamAudit({
    actor,
    action: 'roles.delete_soft',
    targetType: 'role',
    targetId: role._id,
    before,
    after: role,
    message: 'Xóa mềm role thành công.',
    requestMeta,
  });

  return { success: true };
}

async function getUsersByRole(roleIdOrCode, query = {}) {
  const role = await findRoleByIdOrCode(roleIdOrCode);
  const { page, limit, skip } = normalizePagination(query);
  const assignments = await UserRole.find({ role_id: role._id, is_active: true }).lean();
  const userFilter = {
    _id: { $in: assignments.map((item) => item.user_id) },
    is_deleted: false,
  };
  if (query.status) userFilter.status = query.status;
  if (query.department_id) userFilter.department_id = query.department_id;

  const [users, total] = await Promise.all([
    User.find(userFilter).sort({ full_name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(userFilter),
  ]);

  return {
    role: serializeRole(role),
    items: users.map((user) => ({
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      employee_code: user.employee_code,
      department_id: user.department_id ? String(user.department_id) : null,
      status: user.status,
    })),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function getRoleEffectivePermissions(roleIdOrCode) {
  const role = await findRoleByIdOrCode(roleIdOrCode);
  return getEffectivePermissionsForRoles([role._id]);
}

module.exports = {
  // serializeRole: Chuẩn hóa dữ liệu vai trò trước khi trả về API.
  serializeRole,
  // findRoleByIdOrCode: Tìm vai trò bằng id hoặc mã vai trò.
  findRoleByIdOrCode,
  // createRole: Tạo vai trò.
  createRole,
  // listRoles: Liệt kê vai trò.
  listRoles,
  // getRoleDetail: Lấy chi tiết vai trò.
  getRoleDetail,
  // updateRole: Cập nhật vai trò.
  updateRole,
  // updateRoleStatus: Cập nhật trạng thái vai trò.
  updateRoleStatus,
  // deleteRoleSoft: Xóa mềm vai trò.
  deleteRoleSoft,
  // getRoleUsageSummary: Lấy thống kê mức sử dụng vai trò.
  getRoleUsageSummary,
  // getUsersByRole: Lấy người dùng theo vai trò.
  getUsersByRole,
  // ensureAtLeastOneActiveSuperAdminRemains: Bảo đảm hệ thống luôn còn ít nhất một super admin đang hoạt động.
  ensureAtLeastOneActiveSuperAdminRemains,
  // getRoleEffectivePermissions: Lấy danh sách quyền hiệu lực của vai trò.
  getRoleEffectivePermissions,
};
