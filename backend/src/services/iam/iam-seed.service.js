const {
  CANONICAL_PERMISSION_CODES,
  CORE_ROLES,
  LEGACY_PERMISSION_CODES,
  ROLE_PERMISSION_MAP,
  getPermissionDefinition,
} = require('../../constants/permissions');
const { Permission, Role, RolePermission } = require('../../models');
const { withOptionalTransaction } = require('../../shared/utils/transaction');
const { recordIamAudit } = require('./iam-audit.helper');
const { getActorId } = require('./iam.policy');

async function seedSystemAccess(actor = {}, requestMeta = {}) {
  const summary = {
    roles_upserted: 0,
    permissions_upserted: 0,
    role_permissions_upserted: 0,
    legacy_permissions_retired: 0,
    legacy_role_permissions_deactivated: 0,
  };

  await withOptionalTransaction(async (session) => {
    const actorId = getActorId(actor);

    for (const role of CORE_ROLES) {
      const result = await Role.updateOne(
        { role_code: role.role_code },
        {
          $set: {
            role_name: role.role_name,
            status: 'active',
            is_system: true,
            priority_level: role.priority_level || 0,
            is_deleted: false,
            updated_by: actorId,
          },
          $setOnInsert: {
            description: `${role.role_name} role`,
            created_by: actorId,
          },
        },
        { upsert: true, session },
      );
      if (result.upsertedCount || result.modifiedCount) summary.roles_upserted += 1;
    }

    for (const permissionCode of CANONICAL_PERMISSION_CODES) {
      const permission = getPermissionDefinition(permissionCode);
      const result = await Permission.updateOne(
        { permission_code: permission.permission_code },
        {
          $set: {
            permission_name: permission.permission_name,
            module_key: permission.module_key,
            action_key: permission.action_key,
            is_system: true,
            is_deleted: false,
            updated_by: actorId,
          },
          $setOnInsert: {
            description: permission.permission_name,
            created_by: actorId,
          },
        },
        { upsert: true, session },
      );
      if (result.upsertedCount || result.modifiedCount) summary.permissions_upserted += 1;
    }

    if (LEGACY_PERMISSION_CODES.length > 0) {
      const legacyPermissions = await Permission.find({
        permission_code: { $in: LEGACY_PERMISSION_CODES },
        is_deleted: false,
      })
        .select('_id')
        .session(session);

      if (legacyPermissions.length > 0) {
        const legacyPermissionIds = legacyPermissions.map((permission) => permission._id);
        const now = new Date();
        const retirePermissionData = {
          is_deleted: true,
          deleted_at: now,
          updated_by: actorId,
        };
        if (actorId) retirePermissionData.deleted_by = actorId;

        const retiredPermissions = await Permission.updateMany(
          { _id: { $in: legacyPermissionIds } },
          { $set: retirePermissionData },
          { session },
        );

        const deactivatedRolePermissions = await RolePermission.updateMany(
          {
            permission_id: { $in: legacyPermissionIds },
            is_active: true,
          },
          {
            $set: {
              is_active: false,
              updated_by: actorId,
            },
          },
          { session },
        );

        summary.legacy_permissions_retired += retiredPermissions.modifiedCount || 0;
        summary.legacy_role_permissions_deactivated += deactivatedRolePermissions.modifiedCount || 0;
      }
    }

    const roles = await Role.find({ role_code: { $in: Object.keys(ROLE_PERMISSION_MAP) } }).session(session);
    const permissions = await Permission.find({
      permission_code: { $in: Object.values(ROLE_PERMISSION_MAP).flat() },
      is_deleted: false,
    }).session(session);

    const roleByCode = new Map(roles.map((role) => [role.role_code, role]));
    const permissionByCode = new Map(permissions.map((permission) => [permission.permission_code, permission]));

    for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSION_MAP)) {
      const role = roleByCode.get(roleCode);
      if (!role) continue;

      for (const permissionCode of permissionCodes) {
        const permission = permissionByCode.get(permissionCode);
        if (!permission) continue;

        const result = await RolePermission.updateOne(
          { role_id: role._id, permission_id: permission._id },
          {
            $set: {
              is_active: true,
              updated_by: actorId,
            },
            $setOnInsert: {
              created_by: actorId,
            },
          },
          { upsert: true, session },
        );
        if (result.upsertedCount || result.modifiedCount) summary.role_permissions_upserted += 1;
      }
    }
  }, { fallbackToNoTransaction: true });

  await recordIamAudit({
    actor,
    action: 'iam.seed_system_access',
    targetType: 'system',
    message: 'Seed role và permission mặc định thành công.',
    requestMeta,
    metadata: summary,
  });

  return summary;
}

module.exports = {
  // seedSystemAccess: Khởi tạo dữ liệu hạt giống cho quyền truy cập hệ thống mặc định.
  seedSystemAccess,
};
