const ApiError = require('../../common/errors/api-error');
const { PERMISSION, ROLE_CODE } = require('../../constants/permissions');
const { Permission, RolePermission, UserRole } = require('../../models');
const { withOptionalTransaction } = require('../../shared/utils/transaction');
const permissionHelper = require('../permission.service');
const sessionService = require('../auth/auth-session.service');
const { recordIamAudit } = require('./iam-audit.helper');
const {
  assertCanManageRole,
  getActorId,
  isSuperAdmin,
} = require('./iam.policy');
const roleService = require('./role.service');
const iamPermissionService = require('./permission.service');

async function getRolePermissions(roleIdOrCode, options = {}) {
  const role = await roleService.findRoleByIdOrCode(roleIdOrCode);
  const rolePermissions = await RolePermission.find({
    role_id: role._id,
    is_active: true,
  }).lean();

  const permissions = await Permission.find({
    _id: { $in: rolePermissions.map((item) => item.permission_id) },
    is_deleted: false,
  }).sort({ module_key: 1, permission_code: 1 }).lean();

  const grouped = {};
  permissions.forEach((permission) => {
    if (!grouped[permission.module_key]) grouped[permission.module_key] = [];
    grouped[permission.module_key].push(iamPermissionService.serializePermission(permission));
  });

  return {
    role_id: String(role._id),
    role_code: role.role_code,
    role_name: role.role_name,
    permissions: options.grouped === false
      ? permissions.map((permission) => iamPermissionService.serializePermission(permission))
      : grouped,
    permission_codes: permissions.map((permission) => permission.permission_code),
  };
}

async function validatePermissionAssignable(permissionCodesOrIds = [], actor = {}) {
  return iamPermissionService.validatePermissionAssignable(permissionCodesOrIds, actor);
}

async function assertRolePermissionMutationSafe(role, permissions, actor = {}, mode = 'assign') {
  assertCanManageRole(role, actor, `${mode} permission cho role`);

  if (role.role_code === ROLE_CODE.SUPER_ADMIN && !isSuperAdmin(actor)) {
    throw ApiError.forbidden('Chỉ super_admin mới được sửa permission của role super_admin.');
  }

  if (permissions.some((permission) => permission.permission_code === PERMISSION.SYSTEM.FULL_ACCESS) && !isSuperAdmin(actor)) {
    throw ApiError.forbidden('Chỉ super_admin mới được gán system.full_access.');
  }

  if (!isSuperAdmin(actor)) {
    const actorPermissions = actor.permissions || [];
    const illegal = permissions.find((permission) => !permissionHelper.hasPermission(actorPermissions, permission.permission_code));
    if (illegal) {
      throw ApiError.forbidden(`Bạn không được gán permission vượt quá quyền hiện có: ${illegal.permission_code}.`);
    }
  }
}

function assertCoreRolePermissionInvariant(role, nextPermissionCodes = []) {
  if (role.role_code === ROLE_CODE.SUPER_ADMIN && !nextPermissionCodes.includes(PERMISSION.SYSTEM.FULL_ACCESS)) {
    throw ApiError.conflict('Role super_admin bắt buộc phải giữ system.full_access.');
  }

  if (role.role_code === ROLE_CODE.ADMIN) {
    const requiredPermissions = [
      PERMISSION.ROLES.READ,
      PERMISSION.USERS.READ,
      PERMISSION.AUDIT_LOGS.READ,
    ];
    const missing = requiredPermissions.filter((permissionCode) => !nextPermissionCodes.includes(permissionCode));
    if (missing.length) {
      throw ApiError.conflict(`Role admin thiếu quyền lõi: ${missing.join(', ')}.`);
    }
  }
}

async function invalidateUsersByRole(roleId, requestMeta = {}, actor = {}) {
  const assignments = await UserRole.find({ role_id: roleId, is_active: true }).lean();
  const results = [];
  for (const assignment of assignments) {
    results.push(await sessionService.invalidateAllUserSessions('staff', assignment.user_id, requestMeta, {
      actorType: actor.actorType,
      actorId: getActorId(actor),
      audit: false,
    }));
  }
  return results.reduce((sum, item) => sum + (item.revoked_count || 0), 0);
}

async function assignPermissionsToRole(roleIdOrCode, payload = {}, actor = {}, requestMeta = {}) {
  const role = await roleService.findRoleByIdOrCode(roleIdOrCode);
  const permissionCodes = payload.permission_codes || payload.permissionIds || payload.permission_ids || [];
  const permissions = await validatePermissionAssignable(permissionCodes, actor);
  await assertRolePermissionMutationSafe(role, permissions, actor, 'assign');
  const before = await getRolePermissions(role._id, { grouped: false });

  await withOptionalTransaction(async (session) => {
    for (const permission of permissions) {
      await RolePermission.updateOne(
        { role_id: role._id, permission_id: permission._id },
        {
          $set: {
            is_active: true,
            updated_by: getActorId(actor),
          },
          $setOnInsert: {
            created_by: getActorId(actor),
          },
        },
        { upsert: true, session },
      );
    }
  }, { fallbackToNoTransaction: true });

  const after = await getRolePermissions(role._id, { grouped: false });
  const revokedCount = await invalidateUsersByRole(role._id, requestMeta, actor);

  await recordIamAudit({
    actor,
    action: 'role_permissions.assign',
    targetType: 'role',
    targetId: role._id,
    before,
    after,
    message: 'Gán permission cho role thành công.',
    requestMeta,
    metadata: {
      added_permission_codes: permissions.map((permission) => permission.permission_code),
      revoked_sessions: revokedCount,
    },
  });

  return getRolePermissions(role._id);
}

async function syncRolePermissions(roleIdOrCode, payload = {}, actor = {}, requestMeta = {}) {
  const role = await roleService.findRoleByIdOrCode(roleIdOrCode);
  const permissionCodes = payload.permission_codes || payload.permissionIds || payload.permission_ids || [];
  const permissions = permissionCodes.length ? await validatePermissionAssignable(permissionCodes, actor) : [];
  await assertRolePermissionMutationSafe(role, permissions, actor, 'sync');
  const nextPermissionCodes = permissions.map((permission) => permission.permission_code);
  assertCoreRolePermissionInvariant(role, nextPermissionCodes);

  if (!permissions.length && [ROLE_CODE.SUPER_ADMIN, ROLE_CODE.ADMIN].includes(role.role_code)) {
    throw ApiError.conflict('Không được sync rỗng permission của role quản trị lõi.');
  }

  const before = await getRolePermissions(role._id, { grouped: false });
  const targetPermissionIds = permissions.map((permission) => String(permission._id));

  await withOptionalTransaction(async (session) => {
    await RolePermission.updateMany(
      {
        role_id: role._id,
        permission_id: { $nin: permissions.map((permission) => permission._id) },
      },
      { $set: { is_active: false, updated_by: getActorId(actor) } },
      { session },
    );

    for (const permission of permissions) {
      await RolePermission.updateOne(
        { role_id: role._id, permission_id: permission._id },
        {
          $set: {
            is_active: true,
            updated_by: getActorId(actor),
          },
          $setOnInsert: {
            created_by: getActorId(actor),
          },
        },
        { upsert: true, session },
      );
    }
  }, { fallbackToNoTransaction: true });

  const after = await getRolePermissions(role._id, { grouped: false });
  const revokedCount = await invalidateUsersByRole(role._id, requestMeta, actor);

  await recordIamAudit({
    actor,
    action: 'role_permissions.sync',
    targetType: 'role',
    targetId: role._id,
    before,
    after,
    message: 'Đồng bộ permission cho role thành công.',
    requestMeta,
    metadata: {
      target_permission_ids: targetPermissionIds,
      revoked_sessions: revokedCount,
    },
  });

  return getRolePermissions(role._id);
}

async function removePermissionsFromRole(roleIdOrCode, payload = {}, actor = {}, requestMeta = {}) {
  const role = await roleService.findRoleByIdOrCode(roleIdOrCode);
  const permissionCodes = payload.permission_codes || payload.permissionIds || payload.permission_ids || [];
  const permissions = await iamPermissionService.validatePermissionRemovable(permissionCodes, actor);
  assertCanManageRole(role, actor, 'gỡ permission khỏi role');

  if (role.role_code === ROLE_CODE.SUPER_ADMIN && permissions.some((item) => item.permission_code === PERMISSION.SYSTEM.FULL_ACCESS)) {
    throw ApiError.conflict('Không được gỡ system.full_access khỏi role super_admin.');
  }

  const before = await getRolePermissions(role._id, { grouped: false });
  const removedPermissionCodes = permissions.map((permission) => permission.permission_code);
  const nextPermissionCodes = before.permission_codes.filter((permissionCode) => !removedPermissionCodes.includes(permissionCode));
  assertCoreRolePermissionInvariant(role, nextPermissionCodes);

  await RolePermission.updateMany(
    {
      role_id: role._id,
      permission_id: { $in: permissions.map((permission) => permission._id) },
    },
    { $set: { is_active: false, updated_by: getActorId(actor) } },
  );
  const after = await getRolePermissions(role._id, { grouped: false });
  const revokedCount = await invalidateUsersByRole(role._id, requestMeta, actor);

  await recordIamAudit({
    actor,
    action: 'role_permissions.remove',
    targetType: 'role',
    targetId: role._id,
    before,
    after,
    message: 'Gỡ permission khỏi role thành công.',
    requestMeta,
    metadata: {
      removed_permission_codes: removedPermissionCodes,
      revoked_sessions: revokedCount,
    },
  });

  return getRolePermissions(role._id);
}

module.exports = {
  // validatePermissionAssignable: Kiểm tra tính hợp lệ của điều kiện gán quyền.
  validatePermissionAssignable,
  // getRolePermissions: Lấy quyền của vai trò.
  getRolePermissions,
  // assignPermissionsToRole: Gán danh sách quyền cho vai trò.
  assignPermissionsToRole,
  // syncRolePermissions: Đồng bộ quyền của vai trò.
  syncRolePermissions,
  // removePermissionsFromRole: Gỡ/xóa quyền từ vai trò.
  removePermissionsFromRole,
  // invalidateUsersByRole: Vô hiệu hóa cache/ngữ cảnh quyền của các user thuộc vai trò.
  invalidateUsersByRole,
};
