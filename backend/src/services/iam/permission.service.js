const ApiError = require('../../common/errors/api-error');
const { mongoose } = require('../../config/database');
const { normalizePagination, buildPaginationMeta } = require('../../common/helpers/pagination.helper');
const { buildRegexSearch } = require('../../common/helpers/query.helper');
const {
  CANONICAL_PERMISSION_CODES,
  PERMISSION,
  PERMISSION_MODULES,
  getPermissionDefinition,
} = require('../../constants/permissions');
const { Permission, Role, RolePermission, User, UserRole } = require('../../models');
const { recordIamAudit } = require('./iam-audit.helper');
const {
  assertCanAssignPermission,
  getActorId,
  isSuperAdmin,
  normalizePermissionCode,
  parsePermissionParts,
  validatePermissionCode,
} = require('./iam.policy');

function serializePermission(permission, extra = {}) {
  const plain = typeof permission.toObject === 'function' ? permission.toObject() : permission;
  return {
    permission_id: String(plain._id || plain.id),
    id: String(plain._id || plain.id),
    permission_code: plain.permission_code,
    permission_name: plain.permission_name,
    module_key: plain.module_key,
    action_key: plain.action_key,
    description: plain.description,
    is_system: Boolean(plain.is_system),
    is_mutable: plain.is_mutable !== false,
    permission_version: Number(plain.permission_version || 1),
    deprecated_at: plain.deprecated_at,
    ...extra,
  };
}

function parseBooleanFlag(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

async function findPermissionByIdOrCode(permissionIdOrCode, options = {}) {
  const clauses = [{ permission_code: permissionIdOrCode }];
  if (mongoose.Types.ObjectId.isValid(permissionIdOrCode)) {
    clauses.push({ _id: permissionIdOrCode });
  }

  const permission = await Permission.findOne({
    ...(options.includeDeleted ? {} : { is_deleted: false }),
    $or: clauses,
  });

  if (!permission && options.required !== false) {
    throw ApiError.notFound('Không tìm thấy permission.');
  }

  return permission;
}

async function validatePermissionAssignable(permissionCodesOrIds = [], actor = {}) {
  if (!Array.isArray(permissionCodesOrIds) || permissionCodesOrIds.length === 0) {
    throw ApiError.validation('permission_codes hoặc permission_ids phải là mảng không rỗng.');
  }

  const deduped = [...new Set(permissionCodesOrIds.map(String))];
  const permissions = await Permission.find({
    is_deleted: false,
    $or: [
      { permission_code: { $in: deduped } },
      ...(deduped.some((item) => mongoose.Types.ObjectId.isValid(item))
        ? [{ _id: { $in: deduped.filter((item) => mongoose.Types.ObjectId.isValid(item)) } }]
        : []),
    ],
  });

  if (permissions.length !== deduped.length) {
    throw ApiError.notFound('Có permission không tồn tại hoặc đã bị xóa mềm.');
  }

  const deprecated = permissions.find((permission) => permission.deprecated_at && permission.deprecated_at <= new Date());
  if (deprecated) {
    throw ApiError.conflict(`Permission đã deprecated, không được gán mới: ${deprecated.permission_code}.`);
  }

  permissions.forEach((permission) => assertCanAssignPermission(permission, actor));
  return permissions;
}

async function validatePermissionRemovable(permissionCodesOrIds = [], actor = {}) {
  if (!Array.isArray(permissionCodesOrIds) || permissionCodesOrIds.length === 0) {
    throw ApiError.validation('permission_codes hoặc permission_ids phải là mảng không rỗng.');
  }

  const deduped = [...new Set(permissionCodesOrIds.map(String))];
  const objectIds = deduped.filter((item) => mongoose.Types.ObjectId.isValid(item));
  const permissions = await Permission.find({
    is_deleted: false,
    $or: [
      { permission_code: { $in: deduped } },
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
    ],
  });

  if (permissions.length !== deduped.length) {
    throw ApiError.notFound('Có permission không tồn tại hoặc đã bị xóa mềm.');
  }

  if (!isSuperAdmin(actor) && permissions.some((permission) => permission.permission_code === PERMISSION.SYSTEM.FULL_ACCESS)) {
    throw ApiError.forbidden('Chỉ super_admin mới được gỡ system.full_access.');
  }

  return permissions;
}

async function createPermission(payload = {}, actor = {}, requestMeta = {}) {
  const permissionCode = normalizePermissionCode(payload.permission_code);
  validatePermissionCode(permissionCode);
  const permissionName = String(payload.permission_name || '').trim();
  if (!permissionName) {
    throw ApiError.validation('permission_name là bắt buộc.');
  }
  const isSystem = parseBooleanFlag(payload.is_system, false);

  if (permissionCode === PERMISSION.SYSTEM.FULL_ACCESS && !isSuperAdmin(actor)) {
    throw ApiError.forbidden('Chỉ super_admin mới được tạo system.full_access.');
  }

  if (isSystem && !isSuperAdmin(actor)) {
    throw ApiError.forbidden('Chỉ super_admin mới được tạo system permission.');
  }

  if (isSystem && !CANONICAL_PERMISSION_CODES.includes(permissionCode)) {
    throw ApiError.badRequest('System permission phải nằm trong constants.');
  }

  const { module_key: parsedModuleKey, action_key: parsedActionKey } = parsePermissionParts(permissionCode);
  const moduleKey = payload.module_key || parsedModuleKey;
  const actionKey = payload.action_key || parsedActionKey;

  if (!PERMISSION_MODULES.includes(moduleKey)) {
    throw ApiError.badRequest('module_key không nằm trong danh sách module hợp lệ.');
  }

  const existed = await Permission.findOne({ permission_code: permissionCode, is_deleted: false }).lean();
  if (existed) throw ApiError.conflict('permission_code đã tồn tại.');

  const permission = await Permission.create({
    permission_code: permissionCode,
    permission_name: permissionName,
    module_key: moduleKey,
    action_key: actionKey,
    description: payload.description,
    is_system: isSystem,
    created_by: getActorId(actor),
  });

  await recordIamAudit({
    actor,
    action: 'permissions.create',
    targetType: 'permission',
    targetId: permission._id,
    after: permission,
    message: 'Tạo permission thành công.',
    requestMeta,
  });

  return { permission: serializePermission(permission) };
}

async function listPermissions(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = {};
  if (!query.include_deleted) filter.is_deleted = false;
  if (query.module_key) filter.module_key = query.module_key;
  if (query.action_key) filter.action_key = query.action_key;
  if (query.is_system !== undefined) filter.is_system = query.is_system === true || query.is_system === 'true';

  const keyword = query.keyword || query.search;
  if (keyword) {
    const regex = buildRegexSearch(keyword);
    filter.$or = [{ permission_code: regex }, { permission_name: regex }];
  }

  const [permissions, total] = await Promise.all([
    Permission.find(filter).sort({ module_key: 1, permission_code: 1 }).skip(skip).limit(limit).lean(),
    Permission.countDocuments(filter),
  ]);

  return {
    items: permissions.map((permission) => serializePermission(permission)),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function listPermissionsGrouped(query = {}) {
  const filter = {};
  if (!query.include_deleted) filter.is_deleted = false;
  if (query.module_key) filter.module_key = query.module_key;
  if (query.action_key) filter.action_key = query.action_key;
  if (query.is_system !== undefined) filter.is_system = query.is_system === true || query.is_system === 'true';

  const keyword = query.keyword || query.search;
  if (keyword) {
    const regex = buildRegexSearch(keyword);
    filter.$or = [{ permission_code: regex }, { permission_name: regex }];
  }

  const permissions = await Permission.find(filter).sort({ module_key: 1, permission_code: 1 }).lean();
  const grouped = {};
  permissions.map((permission) => serializePermission(permission)).forEach((permission) => {
    if (!grouped[permission.module_key]) grouped[permission.module_key] = [];
    grouped[permission.module_key].push(permission);
  });
  return {
    grouped,
    total: permissions.length,
  };
}

async function getPermissionUsageSummary(permissionIdOrCode) {
  const permission = await findPermissionByIdOrCode(permissionIdOrCode);
  const rolePermissions = await RolePermission.find({ permission_id: permission._id, is_active: true }).lean();
  const roles = await Role.find({
    _id: { $in: rolePermissions.map((item) => item.role_id) },
    status: 'active',
    is_deleted: false,
  }).lean();
  const userRoles = await UserRole.find({
    role_id: { $in: roles.map((role) => role._id) },
    is_active: true,
  }).lean();
  const affectedUserCount = await User.countDocuments({
    _id: { $in: userRoles.map((item) => item.user_id) },
    is_deleted: false,
  });

  return {
    permission_id: String(permission._id),
    permission_code: permission.permission_code,
    role_count: roles.length,
    affected_user_count: affectedUserCount,
    roles: roles.map((role) => ({
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      status: role.status,
    })),
  };
}

async function getPermissionDetail(permissionIdOrCode) {
  const permission = await findPermissionByIdOrCode(permissionIdOrCode);
  const usage = await getPermissionUsageSummary(permission._id);
  return {
    permission: serializePermission(permission),
    usage,
  };
}

async function updatePermission(permissionId, payload = {}, actor = {}, requestMeta = {}) {
  const permission = await findPermissionByIdOrCode(permissionId);
  const before = permission.toObject();

  if (permission.is_mutable === false && !isSuperAdmin(actor)) {
    throw ApiError.forbidden('Permission này đang bị khóa sửa, chỉ super_admin được cập nhật.');
  }

  if (permission.is_system && (payload.permission_code || payload.module_key || payload.action_key)) {
    throw ApiError.forbidden('Không được sửa permission_code/module_key/action_key của system permission.');
  }

  if (!permission.is_system && !payload.permission_code && (payload.module_key !== undefined || payload.action_key !== undefined)) {
    throw ApiError.validation('Chỉ được cập nhật module_key/action_key khi đổi permission_code.');
  }

  if (!permission.is_system && payload.permission_code && payload.permission_code !== permission.permission_code) {
    const nextCode = normalizePermissionCode(payload.permission_code);
    validatePermissionCode(nextCode);
    const existed = await Permission.findOne({ _id: { $ne: permission._id }, permission_code: nextCode, is_deleted: false }).lean();
    if (existed) throw ApiError.conflict('permission_code đã tồn tại.');
    permission.permission_code = nextCode;
    const parts = parsePermissionParts(nextCode);
    const moduleKey = payload.module_key || parts.module_key;
    if (!PERMISSION_MODULES.includes(moduleKey)) {
      throw ApiError.badRequest('module_key không nằm trong danh sách module hợp lệ.');
    }
    permission.module_key = moduleKey;
    permission.action_key = payload.action_key || parts.action_key;
  }

  if (payload.permission_name !== undefined) {
    const permissionName = String(payload.permission_name).trim();
    if (!permissionName) throw ApiError.validation('permission_name không được rỗng.');
    permission.permission_name = permissionName;
  }
  if (payload.description !== undefined) permission.description = payload.description;
  if (payload.is_mutable !== undefined) {
    if (!isSuperAdmin(actor)) throw ApiError.forbidden('Chỉ super_admin mới được đổi is_mutable của permission.');
    permission.is_mutable = payload.is_mutable !== false;
  }
  if (payload.deprecated_at !== undefined || payload.deprecatedAt !== undefined) {
    if (!isSuperAdmin(actor)) throw ApiError.forbidden('Chỉ super_admin mới được deprecated permission.');
    const value = payload.deprecated_at ?? payload.deprecatedAt;
    permission.deprecated_at = value ? new Date(value) : undefined;
  }
  permission.permission_version = Number(permission.permission_version || 1) + 1;
  permission.updated_by = getActorId(actor);
  await permission.save();

  await recordIamAudit({
    actor,
    action: 'permissions.update',
    targetType: 'permission',
    targetId: permission._id,
    before,
    after: permission,
    message: 'Cập nhật permission thành công.',
    requestMeta,
  });

  return { permission: serializePermission(permission) };
}

async function deletePermissionSoft(permissionId, actor = {}, requestMeta = {}) {
  const permission = await findPermissionByIdOrCode(permissionId);
  if (permission.permission_code === PERMISSION.SYSTEM.FULL_ACCESS) {
    throw ApiError.forbidden('Không được xóa system.full_access.');
  }

  if (permission.is_system) {
    throw ApiError.forbidden('Không được xóa system permission.');
  }

  const usage = await getPermissionUsageSummary(permission._id);
  if (usage.role_count > 0) {
    throw ApiError.conflict('Permission vẫn đang được gán cho role active, chưa thể xóa mềm.');
  }

  const before = permission.toObject();
  permission.is_deleted = true;
  permission.deleted_at = new Date();
  permission.deleted_by = getActorId(actor);
  permission.deprecated_at = permission.deprecated_at || new Date();
  permission.permission_version = Number(permission.permission_version || 1) + 1;
  permission.updated_by = getActorId(actor);
  await permission.save();

  await RolePermission.updateMany(
    { permission_id: permission._id },
    { $set: { is_active: false, updated_by: getActorId(actor) } },
  );

  await recordIamAudit({
    actor,
    action: 'permissions.delete_soft',
    targetType: 'permission',
    targetId: permission._id,
    before,
    after: permission,
    message: 'Xóa mềm permission thành công.',
    requestMeta,
  });

  return { success: true };
}

async function seedCanonicalPermissions(actor = {}, requestMeta = {}) {
  let upserted = 0;
  for (const code of CANONICAL_PERMISSION_CODES) {
    const definition = getPermissionDefinition(code);
    const result = await Permission.updateOne(
      { permission_code: definition.permission_code },
      {
        $set: {
          permission_name: definition.permission_name,
          module_key: definition.module_key,
          action_key: definition.action_key,
          is_system: true,
          is_deleted: false,
        },
        $setOnInsert: {
          created_by: getActorId(actor),
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount || result.modifiedCount) upserted += 1;
  }

  return { permissions_upserted: upserted };
}

module.exports = {
  // serializePermission: Chuẩn hóa dữ liệu quyền trước khi trả về API.
  serializePermission,
  // findPermissionByIdOrCode: Tìm quyền bằng id hoặc mã quyền.
  findPermissionByIdOrCode,
  // validatePermissionAssignable: Kiểm tra tính hợp lệ của điều kiện gán quyền.
  validatePermissionAssignable,
  // validatePermissionRemovable: Kiểm tra tính hợp lệ của điều kiện gỡ quyền.
  validatePermissionRemovable,
  // createPermission: Tạo quyền.
  createPermission,
  // listPermissions: Liệt kê quyền.
  listPermissions,
  // listPermissionsGrouped: Liệt kê quyền được nhóm theo phân hệ.
  listPermissionsGrouped,
  // getPermissionDetail: Lấy chi tiết quyền.
  getPermissionDetail,
  // updatePermission: Cập nhật quyền.
  updatePermission,
  // deletePermissionSoft: Xóa mềm quyền.
  deletePermissionSoft,
  // getPermissionUsageSummary: Lấy thống kê mức sử dụng quyền.
  getPermissionUsageSummary,
  // seedCanonicalPermissions: Khởi tạo dữ liệu hạt giống cho bộ quyền chuẩn của hệ thống.
  seedCanonicalPermissions,
};
