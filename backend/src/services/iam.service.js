const { mongoose } = require('../config/database');
const { Permission, Role, RolePermission, User, UserRole, AuditLog } = require('../models');
const { buildUserPermissionMap, buildUserRoleDetails, checkPermission } = require('./access-control.service');
const { bootstrapSystemAccess } = require('./bootstrap.service');

const ROLE_CODE_REGEX = /^[a-z][a-z0-9_]{2,49}$/;
const PERMISSION_CODE_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function recordAuditLog({
  actor,
  action,
  targetType,
  targetId,
  status,
  message,
  requestMeta,
  metadata,
}) {
  await AuditLog.create({
    actor_type: actor?.actorType || 'system',
    actor_id: actor?.userId || actor?.patientAccountId,
    action,
    target_type: targetType,
    target_id: targetId,
    status,
    message,
    ip_address: requestMeta?.ipAddress,
    user_agent: requestMeta?.userAgent,
    metadata,
  });
}

function validateRoleCode(roleCode) {
  if (!ROLE_CODE_REGEX.test(String(roleCode || ''))) {
    throw createError('role_code phải ở dạng lowercase hoặc snake_case, dài từ 3 đến 50 ký tự.');
  }
}

function deriveActionKey(permissionCode) {
  const parts = String(permissionCode || '').split('.');
  return parts[parts.length - 1] || null;
}

function validatePermissionCode(permissionCode) {
  if (!PERMISSION_CODE_REGEX.test(String(permissionCode || ''))) {
    throw createError('permission_code phải theo format module.resource.action hoặc module.action.');
  }
}

async function validateRoleAssignable(roleCodes = [], actor) {
  if (!Array.isArray(roleCodes) || roleCodes.length === 0) {
    throw createError('role_codes phải là mảng không rỗng.');
  }

  if (roleCodes.includes('super_admin') && !actor.roles.includes('super_admin')) {
    throw createError('Chỉ super_admin mới được gán vai trò super_admin.', 403);
  }

  const dedupedCodes = [...new Set(roleCodes)];
  const roles = await Role.find({
    role_code: { $in: dedupedCodes },
    status: 'active',
    is_deleted: false,
  });

  if (roles.length !== dedupedCodes.length) {
    throw createError('Có role không tồn tại, đã inactive hoặc đã bị xóa mềm.', 404);
  }

  return roles;
}

async function validatePermissionAssignable(permissionCodes = []) {
  if (!Array.isArray(permissionCodes) || permissionCodes.length === 0) {
    throw createError('permission_codes phải là mảng không rỗng.');
  }

  const dedupedCodes = [...new Set(permissionCodes)];
  const permissions = await Permission.find({
    permission_code: { $in: dedupedCodes },
    is_deleted: false,
  });

  if (permissions.length !== dedupedCodes.length) {
    throw createError('Có permission không tồn tại hoặc đã bị xóa mềm.', 404);
  }

  return permissions;
}

async function rebuildUserPermissionCache(userId) {
  const permissions = [...(await buildUserPermissionMap(userId))];
  return {
    user_id: String(userId),
    permissions,
    cache_rebuilt: false,
  };
}

async function createRole(payload, actor, requestMeta = {}) {
  const { role_code, role_name, description, status = 'active' } = payload;

  validateRoleCode(role_code);
  if (!String(role_name || '').trim()) {
    throw createError('role_name là bắt buộc.');
  }

  const existingRole = await Role.findOne({ role_code: String(role_code).trim(), is_deleted: false }).lean();
  if (existingRole) {
    throw createError('role_code đã tồn tại.', 409);
  }

  const role = await Role.create({
    role_code: String(role_code).trim(),
    role_name: String(role_name).trim(),
    description: description || undefined,
    status,
    created_by: actor.userId,
  });

  await recordAuditLog({
    actor,
    action: 'role.create',
    targetType: 'role',
    targetId: role._id,
    status: 'success',
    message: 'Tạo role thành công.',
    requestMeta,
  });

  return {
    role: {
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      description: role.description,
      status: role.status,
    },
  };
}

async function createPermission(payload, actor, requestMeta = {}) {
  const { permission_code, permission_name, module_key, action_key, description, is_system = false } = payload;

  validatePermissionCode(permission_code);
  if (!String(permission_name || '').trim()) {
    throw createError('permission_name là bắt buộc.');
  }
  if (!String(module_key || '').trim()) {
    throw createError('module_key là bắt buộc.');
  }

  const normalizedCode = String(permission_code).trim();
  const existingPermission = await Permission.findOne({
    permission_code: normalizedCode,
    is_deleted: false,
  }).lean();

  if (existingPermission) {
    throw createError('permission_code đã tồn tại.', 409);
  }

  const permission = await Permission.create({
    permission_code: normalizedCode,
    permission_name: String(permission_name).trim(),
    module_key: String(module_key).trim(),
    action_key: action_key ? String(action_key).trim() : deriveActionKey(normalizedCode),
    description: description || undefined,
    is_system: Boolean(is_system),
  });

  await recordAuditLog({
    actor,
    action: 'permission.create',
    targetType: 'permission',
    targetId: permission._id,
    status: 'success',
    message: 'Tạo permission thành công.',
    requestMeta,
  });

  return {
    permission: {
      permission_id: String(permission._id),
      permission_code: permission.permission_code,
      permission_name: permission.permission_name,
      module_key: permission.module_key,
      action_key: permission.action_key,
      description: permission.description,
      is_system: permission.is_system,
    },
  };
}

async function listRoles(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const skip = (page - 1) * limit;
  const keyword = String(query.search || '').trim();
  const filter = { is_deleted: false };

  if (query.status) {
    filter.status = query.status;
  }

  if (keyword) {
    filter.$or = [
      { role_code: { $regex: keyword, $options: 'i' } },
      { role_name: { $regex: keyword, $options: 'i' } },
    ];
  }

  const [roles, total] = await Promise.all([
    Role.find(filter).sort({ role_code: 1 }).skip(skip).limit(limit).lean(),
    Role.countDocuments(filter),
  ]);

  const items = await Promise.all(
    roles.map(async (role) => {
      const [permissionCount, userCount] = await Promise.all([
        RolePermission.countDocuments({ role_id: role._id, is_active: true }),
        UserRole.countDocuments({ role_id: role._id, is_active: true }),
      ]);

      return {
        role_id: String(role._id),
        role_code: role.role_code,
        role_name: role.role_name,
        description: role.description,
        status: role.status,
        permissions_count: permissionCount,
        users_count: userCount,
      };
    }),
  );

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

async function getRoleDetail(roleIdOrCode) {
  const clauses = [{ role_code: roleIdOrCode }];
  if (mongoose.Types.ObjectId.isValid(roleIdOrCode)) {
    clauses.push({ _id: roleIdOrCode });
  }

  const role = await Role.findOne({
    is_deleted: false,
    $or: clauses,
  }).lean();

  if (!role) {
    throw createError('Không tìm thấy role.', 404);
  }

  const rolePermissions = await RolePermission.find({ role_id: role._id, is_active: true }).lean();
  const permissionIds = rolePermissions.map((item) => item.permission_id);
  const permissions = await Permission.find({ _id: { $in: permissionIds }, is_deleted: false }).lean();
  const usersCount = await UserRole.countDocuments({ role_id: role._id, is_active: true });

  return {
    role: {
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      description: role.description,
      status: role.status,
    },
    permissions: permissions.map((permission) => ({
      permission_id: String(permission._id),
      permission_code: permission.permission_code,
      permission_name: permission.permission_name,
      module_key: permission.module_key,
    })),
    users_count: usersCount,
  };
}

async function updateRole(roleId, payload, actor, requestMeta = {}) {
  const { role_name, description } = payload;
  const role = await Role.findById(roleId);
  if (!role || role.is_deleted) {
    throw createError('Không tìm thấy role.', 404);
  }

  role.role_name = role_name || role.role_name;
  role.description = description !== undefined ? description : role.description;
  role.updated_by = actor.userId;
  await role.save();

  await recordAuditLog({
    actor,
    action: 'role.update',
    targetType: 'role',
    targetId: role._id,
    status: 'success',
    message: 'Cập nhật role thành công.',
    requestMeta,
  });

  return {
    role: {
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      description: role.description,
      status: role.status,
    },
  };
}

async function updateRoleStatus(roleId, payload, actor, requestMeta = {}) {
  const { status } = payload;
  if (!['active', 'inactive'].includes(status)) {
    throw createError('Trạng thái role không hợp lệ.');
  }

  const role = await Role.findById(roleId);
  if (!role || role.is_deleted) {
    throw createError('Không tìm thấy role.', 404);
  }

  role.status = status;
  role.updated_by = actor.userId;
  await role.save();

  await recordAuditLog({
    actor,
    action: 'role.update_status',
    targetType: 'role',
    targetId: role._id,
    status: 'success',
    message: 'Cập nhật trạng thái role thành công.',
    requestMeta,
    metadata: { status },
  });

  return {
    role: {
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      description: role.description,
      status: role.status,
    },
  };
}

async function assignPermissionsToRole(roleId, payload, actor, requestMeta = {}) {
  const { permission_codes = [], mode = 'replace' } = payload;
  const role = await Role.findById(roleId);
  if (!role || role.is_deleted) {
    throw createError('Không tìm thấy role.', 404);
  }

  const dedupedCodes = [...new Set(permission_codes)];
  const permissions = dedupedCodes.length > 0 ? await validatePermissionAssignable(dedupedCodes) : [];

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (mode === 'replace') {
      await RolePermission.updateMany(
        { role_id: role._id },
        { $set: { is_active: false, updated_by: actor.userId } },
        { session },
      );
    }

    for (const permission of permissions) {
      await RolePermission.updateOne(
        { role_id: role._id, permission_id: permission._id },
        {
          $set: {
            is_active: true,
            updated_by: actor.userId,
          },
          $setOnInsert: {
            created_by: actor.userId,
          },
        },
        { upsert: true, session },
      );
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  await recordAuditLog({
    actor,
    action: 'role.assign_permissions',
    targetType: 'role',
    targetId: role._id,
    status: 'success',
    message: 'Gán permission cho role thành công.',
    requestMeta,
    metadata: { permission_codes: dedupedCodes, mode },
  });

  return getRolePermissions(roleId);
}

async function syncRolePermissions(roleId, payload, actor, requestMeta = {}) {
  return assignPermissionsToRole(roleId, { ...payload, mode: 'replace' }, actor, requestMeta);
}

async function getRolePermissions(roleId) {
  const role = await Role.findById(roleId).lean();
  if (!role || role.is_deleted) {
    throw createError('Không tìm thấy role.', 404);
  }

  const rolePermissions = await RolePermission.find({ role_id: role._id, is_active: true }).lean();
  const permissionIds = rolePermissions.map((item) => item.permission_id);
  const permissions = await Permission.find({ _id: { $in: permissionIds }, is_deleted: false }).lean();

  const grouped = {};
  for (const permission of permissions) {
    if (!grouped[permission.module_key]) {
      grouped[permission.module_key] = [];
    }
    grouped[permission.module_key].push(permission.permission_code);
  }

  return {
    role_id: String(role._id),
    role_code: role.role_code,
    permissions: grouped,
  };
}

async function listPermissions(query = {}) {
  const filter = { is_deleted: false };
  const keyword = String(query.search || '').trim();

  if (query.module_key) {
    filter.module_key = query.module_key;
  }

  if (keyword) {
    filter.$or = [
      { permission_code: { $regex: keyword, $options: 'i' } },
      { permission_name: { $regex: keyword, $options: 'i' } },
    ];
  }

  const permissions = await Permission.find(filter).sort({ module_key: 1, permission_code: 1 }).lean();
  return {
    items: permissions.map((permission) => ({
      permission_id: String(permission._id),
      permission_code: permission.permission_code,
      permission_name: permission.permission_name,
      module_key: permission.module_key,
      action_key: permission.action_key,
      description: permission.description,
    })),
  };
}

async function getUsersByRole(roleIdOrCode, query = {}) {
  const clauses = [{ role_code: roleIdOrCode }];
  if (mongoose.Types.ObjectId.isValid(roleIdOrCode)) {
    clauses.push({ _id: roleIdOrCode });
  }

  const role = await Role.findOne({
    is_deleted: false,
    $or: clauses,
  }).lean();

  if (!role) {
    throw createError('Không tìm thấy role.', 404);
  }

  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const skip = (page - 1) * limit;

  const [assignments, total] = await Promise.all([
    UserRole.find({ role_id: role._id, is_active: true })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    UserRole.countDocuments({ role_id: role._id, is_active: true }),
  ]);

  const userIds = assignments.map((item) => item.user_id);
  const users = await User.find({
    _id: { $in: userIds },
    is_deleted: false,
  }).lean();

  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const items = assignments
    .map((assignment) => {
      const user = userMap.get(String(assignment.user_id));
      if (!user) {
        return null;
      }

      return {
        user_id: String(user._id),
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        employee_code: user.employee_code,
        department_id: user.department_id ? String(user.department_id) : null,
        status: user.status,
        assigned_at: assignment.created_at,
      };
    })
    .filter(Boolean);

  return {
    role: {
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      status: role.status,
    },
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

async function getPermissionDetail(permissionId) {
  const permission = await Permission.findById(permissionId).lean();
  if (!permission || permission.is_deleted) {
    throw createError('Không tìm thấy permission.', 404);
  }

  const rolesCount = await RolePermission.countDocuments({
    permission_id: permission._id,
    is_active: true,
  });

  return {
    permission: {
      permission_id: String(permission._id),
      permission_code: permission.permission_code,
      permission_name: permission.permission_name,
      module_key: permission.module_key,
      action_key: permission.action_key,
      description: permission.description,
      is_system: permission.is_system,
    },
    roles_count: rolesCount,
  };
}

async function updatePermission(permissionId, payload, actor, requestMeta = {}) {
  const { permission_name, module_key, action_key, description } = payload;
  const permission = await Permission.findById(permissionId);
  if (!permission || permission.is_deleted) {
    throw createError('Không tìm thấy permission.', 404);
  }

  permission.permission_name = permission_name || permission.permission_name;
  permission.module_key = module_key || permission.module_key;
  permission.action_key = action_key || permission.action_key || deriveActionKey(permission.permission_code);
  permission.description = description !== undefined ? description : permission.description;
  await permission.save();

  await recordAuditLog({
    actor,
    action: 'permission.update',
    targetType: 'permission',
    targetId: permission._id,
    status: 'success',
    message: 'Cập nhật permission thành công.',
    requestMeta,
  });

  return {
    permission: {
      permission_id: String(permission._id),
      permission_code: permission.permission_code,
      permission_name: permission.permission_name,
      module_key: permission.module_key,
      action_key: permission.action_key,
      description: permission.description,
      is_system: permission.is_system,
    },
  };
}

async function removePermissionsFromRole(roleId, payload, actor, requestMeta = {}) {
  const { permission_codes = [] } = payload;
  if (!Array.isArray(permission_codes) || permission_codes.length === 0) {
    throw createError('permission_codes phải là mảng không rỗng.');
  }

  const role = await Role.findById(roleId);
  if (!role || role.is_deleted) {
    throw createError('Không tìm thấy role.', 404);
  }

  const permissions = await Permission.find({
    permission_code: { $in: permission_codes },
    is_deleted: false,
  }).lean();

  await RolePermission.updateMany(
    {
      role_id: role._id,
      permission_id: { $in: permissions.map((item) => item._id) },
    },
    {
      $set: {
        is_active: false,
        updated_by: actor.userId,
      },
    },
  );

  await recordAuditLog({
    actor,
    action: 'role.remove_permissions',
    targetType: 'role',
    targetId: role._id,
    status: 'success',
    message: 'Gỡ permission khỏi role thành công.',
    requestMeta,
    metadata: { permission_codes },
  });

  return getRolePermissions(roleId);
}

async function removeRolesFromStaff(userId, payload, actor, requestMeta = {}) {
  const { role_codes = [] } = payload;
  if (!Array.isArray(role_codes) || role_codes.length === 0) {
    throw createError('role_codes phải là mảng không rỗng.');
  }

  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  if (String(user._id) === String(actor.userId)) {
    throw createError('Bạn không được tự gỡ role khỏi chính tài khoản của mình.', 403);
  }

  const roles = await Role.find({ role_code: { $in: role_codes }, is_deleted: false }).lean();
  const currentRoleCodes = (await buildUserRoleDetails(user._id)).map((role) => role.role_code);

  if (currentRoleCodes.includes('super_admin') && !actor.roles.includes('super_admin')) {
    throw createError('Chỉ super_admin mới được quản lý role của tài khoản super_admin.', 403);
  }

  if (currentRoleCodes.includes('super_admin') && role_codes.includes('super_admin')) {
    const superAdminRole = roles.find((role) => role.role_code === 'super_admin');
    if (superAdminRole) {
      const activeSuperAdminAssignments = await UserRole.countDocuments({
        role_id: superAdminRole._id,
        is_active: true,
      });

      if (activeSuperAdminAssignments <= 1) {
        throw createError('Không thể gỡ vai trò super_admin khỏi tài khoản super_admin cuối cùng của hệ thống.', 409);
      }
    }
  }

  const roleIds = roles.map((role) => role._id);
  await UserRole.updateMany(
    { user_id: user._id, role_id: { $in: roleIds } },
    { $set: { is_active: false, updated_by: actor.userId } },
  );

  await recordAuditLog({
    actor,
    action: 'auth.staff.remove_roles',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Gỡ role khỏi tài khoản nhân sự thành công.',
    requestMeta,
    metadata: { role_codes },
  });

  return getStaffRoles(userId);
}

async function syncStaffRoles(userId, payload, actor, requestMeta = {}) {
  const { role_codes = [] } = payload;
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  if (String(user._id) === String(actor.userId)) {
    throw createError('Bạn không được tự đồng bộ role cho chính tài khoản của mình.', 403);
  }

  const roles = await validateRoleAssignable(role_codes, actor);
  const currentRoleCodes = (await buildUserRoleDetails(user._id)).map((role) => role.role_code);

  if (currentRoleCodes.includes('super_admin') && !actor.roles.includes('super_admin')) {
    throw createError('Chỉ super_admin mới được quản lý role của tài khoản super_admin.', 403);
  }

  if (currentRoleCodes.includes('super_admin') && !role_codes.includes('super_admin')) {
    const activeSuperAdminRole = roles.find((role) => role.role_code === 'super_admin') || (await Role.findOne({ role_code: 'super_admin' }));
    if (activeSuperAdminRole) {
      const activeAssignments = await UserRole.countDocuments({ role_id: activeSuperAdminRole._id, is_active: true });
      if (activeAssignments <= 1) {
        throw createError('Không thể gỡ vai trò super_admin khỏi tài khoản super_admin cuối cùng của hệ thống.', 409);
      }
    }
  }

  const dedupedRoleCodes = [...new Set(role_codes)];
  const targetRoleIds = roles.map((role) => String(role._id));
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await UserRole.updateMany(
      {
        user_id: user._id,
        role_id: {
          $nin: roles.map((role) => role._id),
        },
      },
      { $set: { is_active: false, updated_by: actor.userId } },
      { session },
    );

    for (const role of roles) {
      await UserRole.updateOne(
        { user_id: user._id, role_id: role._id },
        {
          $set: {
            is_active: true,
            updated_by: actor.userId,
          },
          $setOnInsert: {
            created_by: actor.userId,
          },
        },
        { upsert: true, session },
      );
    }

    await UserRole.updateMany(
      {
        user_id: user._id,
        role_id: { $in: roles.map((role) => role._id) },
        is_active: false,
      },
      {
        $set: {
          is_active: true,
          updated_by: actor.userId,
        },
      },
      { session },
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  await recordAuditLog({
    actor,
    action: 'auth.staff.sync_roles',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Đồng bộ role cho staff thành công.',
    requestMeta,
    metadata: { role_codes: dedupedRoleCodes, role_ids: targetRoleIds },
  });

  return getStaffRoles(userId);
}

async function getStaffRoles(userId) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  return {
    user: {
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      status: user.status,
    },
    roles: await buildUserRoleDetails(user._id),
  };
}

async function getStaffPermissions(userId) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  return {
    user: {
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      status: user.status,
    },
    permissions: [...(await buildUserPermissionMap(user._id))],
  };
}

async function checkStaffPermission(userId, permissionCode) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  return {
    user_id: String(user._id),
    permission_code: permissionCode,
    allowed: await checkPermission({ userId: user._id, permissionCode }),
  };
}

async function seedSystemAccess(actor, requestMeta = {}) {
  await bootstrapSystemAccess();

  await recordAuditLog({
    actor,
    action: 'role.seed_system_access',
    targetType: 'system',
    status: 'success',
    message: 'Seed role và permission mặc định thành công.',
    requestMeta,
  });

  return { success: true };
}

module.exports = {
  validateRoleAssignable,
  validatePermissionAssignable,
  rebuildUserPermissionCache,
  createRole,
  createPermission,
  listRoles,
  getRoleDetail,
  updateRole,
  updateRoleStatus,
  assignPermissionsToRole,
  syncRolePermissions,
  getRolePermissions,
  listPermissions,
  getPermissionDetail,
  updatePermission,
  removePermissionsFromRole,
  removeRolesFromStaff,
  syncStaffRoles,
  getStaffRoles,
  getStaffPermissions,
  getUsersByRole,
  checkStaffPermission,
  seedSystemAccess,
};
