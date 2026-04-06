const { corePermissions, coreRoles, rolePermissionMap } = require('../constants/roles');
const { Permission, Role, RolePermission, User, UserRole } = require('../models');
const env = require('../config/env');
const { hashPassword } = require('../utils/password');

async function ensureCoreRoles() {
  await Promise.all(
    coreRoles.map((role) =>
      Role.updateOne(
        { role_code: role.role_code },
        {
          $set: {
            role_name: role.role_name,
            status: 'active',
          },
          $setOnInsert: {
            description: `${role.role_name} role`,
            is_deleted: false,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

async function ensureCorePermissions() {
  await Promise.all(
    corePermissions.map((permission) =>
      Permission.updateOne(
        { permission_code: permission.permission_code },
        {
          $set: {
            permission_name: permission.permission_name,
            module_key: permission.module_key,
          },
          $setOnInsert: {
            description: permission.permission_name,
            is_system: true,
            is_deleted: false,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

async function ensureRolePermissions() {
  const roles = await Role.find({ role_code: { $in: Object.keys(rolePermissionMap) } });
  const permissions = await Permission.find({
    permission_code: {
      $in: Object.values(rolePermissionMap).flat(),
    },
  });

  const roleByCode = new Map(roles.map((role) => [role.role_code, role]));
  const permissionByCode = new Map(permissions.map((permission) => [permission.permission_code, permission]));

  const upserts = [];
  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMap)) {
    const role = roleByCode.get(roleCode);
    if (!role) continue;

    for (const permissionCode of permissionCodes) {
      const permission = permissionByCode.get(permissionCode);
      if (!permission) continue;

      upserts.push(
        RolePermission.updateOne(
          {
            role_id: role._id,
            permission_id: permission._id,
          },
          {
            $set: { is_active: true },
          },
          { upsert: true },
        ),
      );
    }
  }

  await Promise.all(upserts);
}

async function ensureSuperAdmin() {
  if (!env.superAdminPassword || !env.jwtAccessSecret || !env.jwtRefreshSecret) {
    console.warn('Skipping super admin bootstrap because auth env variables are incomplete.');
    return;
  }

  const superAdminRole = await Role.findOne({ role_code: 'super_admin' });
  if (!superAdminRole) {
    throw new Error('super_admin role was not created.');
  }

  let superAdminUser = await User.findOne({ username: env.superAdminUsername });
  if (!superAdminUser) {
    superAdminUser = await User.create({
      username: env.superAdminUsername,
      password_hash: await hashPassword(env.superAdminPassword),
      full_name: env.superAdminFullName,
      email: env.superAdminEmail || undefined,
      status: 'active',
      must_change_password: false,
      password_changed_at: new Date(),
    });
  }

  const existingAssignment = await UserRole.findOne({
    user_id: superAdminUser._id,
    role_id: superAdminRole._id,
  });

  if (!existingAssignment) {
    await UserRole.create({
      user_id: superAdminUser._id,
      role_id: superAdminRole._id,
      is_active: true,
    });
  }
}

async function bootstrapSystemAccess() {
  await ensureCoreRoles();
  await ensureCorePermissions();
  await ensureRolePermissions();
  await ensureSuperAdmin();
}

module.exports = {
  bootstrapSystemAccess,
};
