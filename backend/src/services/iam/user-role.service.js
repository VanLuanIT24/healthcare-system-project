const ApiError = require('../../common/errors/api-error');
const { mongoose } = require('../../config/database');
const { PERMISSION, ROLE_CODE, ROLE_PRIORITY } = require('../../constants/permissions');
const { REALTIME_EVENT_TYPE } = require('../../constants/statuses');
const { Role, User, UserRole } = require('../../models');
const { withOptionalTransaction } = require('../../shared/utils/transaction');
const sessionService = require('../auth/auth-session.service');
const { recordIamAudit } = require('./iam-audit.helper');
const {
  assertCanAssignRole,
  assertCanManageRole,
  getActorMaxRolePriority,
  getActorId,
  isSuperAdmin,
} = require('./iam.policy');
const permissionService = require('../permission.service');
const { bumpUserPermissionVersion } = require('../access-control.service');
const accessContextService = require('./access-context.service');
const roleService = require('./role.service');
const eventBus = require('../../events/event-bus.service');

async function publishUserRoleChanged(user, roleCodes = [], actor = {}, requestMeta = {}) {
  return eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.USER_ROLE_CHANGED,
    aggregateType: 'user',
    aggregateId: user._id,
    recipientScope: {
      user_id: user._id,
      actors: [{ actor_type: 'staff', actor_id: user._id }],
    },
    payload: {
      user_id: String(user._id),
      role_codes: roleCodes,
      changed_by: getActorId(actor),
      notification: {
        title: 'Quyền truy cập đã thay đổi',
        body: 'Vai trò của tài khoản đã được cập nhật. Vui lòng đăng nhập lại.',
        priority: 'high',
      },
    },
    idempotencyKey: `user.role_changed:${user._id}:${Date.now()}`,
  });
}

async function validateRoleAssignable(roleCodesOrIds = [], actor = {}) {
  if (!Array.isArray(roleCodesOrIds) || roleCodesOrIds.length === 0) {
    throw ApiError.validation('role_codes hoặc role_ids phải là mảng không rỗng.');
  }

  const deduped = [...new Set(roleCodesOrIds.map(String))];
  const objectIds = deduped.filter((item) => mongoose.Types.ObjectId.isValid(item));
  const roles = await Role.find({
    status: 'active',
    is_deleted: false,
    $or: [
      { role_code: { $in: deduped } },
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
    ],
  });

  if (roles.length !== deduped.length) {
    throw ApiError.notFound('Có role không tồn tại, inactive hoặc đã bị xóa mềm.');
  }

  roles.forEach((role) => assertCanAssignRole(role, actor));
  return roles;
}

async function validateRoleRemovable(roleCodesOrIds = [], actor = {}) {
  if (!Array.isArray(roleCodesOrIds) || roleCodesOrIds.length === 0) {
    throw ApiError.validation('role_codes hoặc role_ids phải là mảng không rỗng.');
  }

  const deduped = [...new Set(roleCodesOrIds.map(String))];
  const objectIds = deduped.filter((item) => mongoose.Types.ObjectId.isValid(item));
  const roles = await Role.find({
    is_deleted: false,
    $or: [
      { role_code: { $in: deduped } },
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
    ],
  });

  if (roles.length !== deduped.length) {
    throw ApiError.notFound('Có role không tồn tại hoặc đã bị xóa mềm.');
  }

  roles.forEach((role) => assertCanManageRole(role, actor, 'gỡ role'));
  return roles;
}

async function getCurrentRoleCodes(userId) {
  const context = await accessContextService.rebuildUserPermissionCache(userId);
  return context.roles;
}

async function ensureSuperAdminNotRemoved(user, nextRoleCodes = []) {
  const currentRoleCodes = await getCurrentRoleCodes(user._id);
  if (!currentRoleCodes.includes(ROLE_CODE.SUPER_ADMIN) || nextRoleCodes.includes(ROLE_CODE.SUPER_ADMIN)) {
    return true;
  }

  const superAdminRole = await Role.findOne({ role_code: ROLE_CODE.SUPER_ADMIN, is_deleted: false }).lean();
  if (!superAdminRole) return true;

  const assignments = await UserRole.find({ role_id: superAdminRole._id, is_active: true }).lean();
  const activeSuperAdminCount = await User.countDocuments({
    _id: { $in: assignments.map((item) => item.user_id), $ne: user._id },
    status: 'active',
    is_deleted: false,
  });

  if (activeSuperAdminCount <= 0) {
    throw ApiError.conflict('Không thể gỡ vai trò super_admin khỏi tài khoản super_admin cuối cùng.');
  }

  return true;
}

function assertNotSelfRoleMutation(userId, actor = {}) {
  if (String(userId) === String(getActorId(actor))) {
    throw ApiError.forbidden('Bạn không được tự thay đổi role của chính tài khoản mình.');
  }
}

function assertCanAccessTargetStaffScope(user, actor = {}) {
  if (isSuperAdmin(actor) || permissionService.hasPermission(actor.permissions || [], PERMISSION.USERS.READ)) {
    return true;
  }

  const actorDepartmentId = actor.user?.department_id || actor.departmentId || actor.department_id;
  if (actorDepartmentId && String(actorDepartmentId) === String(user.department_id)) {
    return true;
  }

  throw ApiError.forbidden('Bạn không được thao tác role của staff ngoài phạm vi department của mình.');
}

async function assertCanManageTargetStaffRoles(user, actor = {}, actionLabel = 'quản lý role') {
  assertNotSelfRoleMutation(user._id, actor);
  assertCanAccessTargetStaffScope(user, actor);

  const targetRoles = await accessContextService.getActiveRolesForUser(user._id);
  const targetRoleCodes = targetRoles.map((role) => role.role_code);
  if (targetRoleCodes.includes(ROLE_CODE.SUPER_ADMIN) && !isSuperAdmin(actor)) {
    throw ApiError.forbidden('Chỉ super_admin mới được quản lý role của tài khoản super_admin.');
  }

  const targetMaxPriority = Math.max(
    0,
    ...targetRoles.map((role) => Number(role.priority_level ?? ROLE_PRIORITY[role.role_code] ?? 0)),
  );

  if (!isSuperAdmin(actor) && targetMaxPriority >= getActorMaxRolePriority(actor)) {
    throw ApiError.forbidden(`Bạn không được ${actionLabel} tài khoản có cấp quyền bằng hoặc cao hơn mình.`);
  }

  return targetRoleCodes;
}

async function syncStaffRoles(userId, payload = {}, actor = {}, requestMeta = {}) {
  const roleCodes = payload.role_codes || payload.roleIds || payload.role_ids || [];
  const user = await User.findById(userId);
  if (!user || user.is_deleted) throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');

  await assertCanManageTargetStaffRoles(user, actor, 'đồng bộ role của');

  const roles = await validateRoleAssignable(roleCodes, actor);
  const nextRoleCodes = roles.map((role) => role.role_code);
  await ensureSuperAdminNotRemoved(user, nextRoleCodes);
  const before = await accessContextService.getStaffRoles(user._id);

  await withOptionalTransaction(async (session) => {
    await UserRole.updateMany(
      {
        user_id: user._id,
        role_id: { $nin: roles.map((role) => role._id) },
      },
      { $set: { is_active: false, updated_by: getActorId(actor) } },
      { session },
    );

    for (const role of roles) {
      await UserRole.updateOne(
        { user_id: user._id, role_id: role._id },
        {
          $set: { is_active: true, updated_by: getActorId(actor) },
          $setOnInsert: { created_by: getActorId(actor) },
        },
        { upsert: true, session },
      );
    }
  }, { fallbackToNoTransaction: true });

  await bumpUserPermissionVersion(user._id);

  const after = await accessContextService.getStaffRoles(user._id);
  const revoked = await sessionService.invalidateAllUserSessions('staff', user._id, requestMeta, {
    actorType: actor.actorType,
    actorId: getActorId(actor),
    reason: 'role_changed',
    audit: false,
  });
  await publishUserRoleChanged(user, nextRoleCodes, actor, requestMeta);

  await recordIamAudit({
    actor,
    action: 'user_roles.sync',
    targetType: 'user',
    targetId: user._id,
    before,
    after,
    message: 'Đồng bộ role cho staff thành công.',
    requestMeta,
    metadata: {
      role_codes: nextRoleCodes,
      revoked_sessions: revoked.revoked_count || 0,
    },
  });

  return after;
}

async function removeRolesFromStaff(userId, payload = {}, actor = {}, requestMeta = {}) {
  const roleCodes = payload.role_codes || payload.roleIds || payload.role_ids || [];
  const user = await User.findById(userId);
  if (!user || user.is_deleted) throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');

  const currentRoleCodes = await assertCanManageTargetStaffRoles(user, actor, 'gỡ role của');
  const roles = await validateRoleRemovable(roleCodes, actor);

  const nextRoleCodes = currentRoleCodes.filter((roleCode) => !roles.some((role) => role.role_code === roleCode));
  await ensureSuperAdminNotRemoved(user, nextRoleCodes);
  const before = await accessContextService.getStaffRoles(user._id);

  await UserRole.updateMany(
    { user_id: user._id, role_id: { $in: roles.map((role) => role._id) } },
    { $set: { is_active: false, updated_by: getActorId(actor) } },
  );

  await bumpUserPermissionVersion(user._id);

  const after = await accessContextService.getStaffRoles(user._id);
  const revoked = await sessionService.invalidateAllUserSessions('staff', user._id, requestMeta, {
    actorType: actor.actorType,
    actorId: getActorId(actor),
    reason: 'role_changed',
    audit: false,
  });
  await publishUserRoleChanged(user, after.roles.map((role) => role.role_code), actor, requestMeta);

  await recordIamAudit({
    actor,
    action: 'user_roles.remove',
    targetType: 'user',
    targetId: user._id,
    before,
    after,
    message: 'Gỡ role khỏi staff thành công.',
    requestMeta,
    metadata: {
      removed_role_codes: roles.map((role) => role.role_code),
      revoked_sessions: revoked.revoked_count || 0,
    },
  });

  return after;
}

async function getUsersByRole(roleIdOrCode, query = {}) {
  return roleService.getUsersByRole(roleIdOrCode, query);
}

module.exports = {
  // validateRoleAssignable: Kiểm tra tính hợp lệ của điều kiện gán vai trò.
  validateRoleAssignable,
  // validateRoleRemovable: Kiểm tra tính hợp lệ của điều kiện gỡ vai trò.
  validateRoleRemovable,
  // assertCanManageTargetStaffRoles: Bảo đảm actor được phép thay đổi vai trò của staff đích.
  assertCanManageTargetStaffRoles,
  // syncStaffRoles: Đồng bộ vai trò của nhân sự.
  syncStaffRoles,
  // removeRolesFromStaff: Gỡ/xóa vai trò từ nhân sự.
  removeRolesFromStaff,
  // getStaffRoles: Lấy vai trò của nhân sự.
  getStaffRoles: accessContextService.getStaffRoles,
  // getStaffPermissions: Lấy quyền của nhân sự.
  getStaffPermissions: accessContextService.getStaffPermissions,
  // getUsersByRole: Lấy người dùng theo vai trò.
  getUsersByRole,
};
