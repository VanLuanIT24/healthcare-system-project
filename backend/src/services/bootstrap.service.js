const { corePermissions, coreRoles, rolePermissionMap } = require('../constants/roles');
const { Department, Permission, Role, RolePermission, User, UserRole } = require('../models');
const env = require('../config/env');
const { hashPassword } = require('../utils/password');

const sampleDepartments = [
  {
    department_code: 'CARD-01',
    department_name: 'Khoa Tim mach',
    department_type: 'clinical',
    location_note: 'Toa A - Tang 3 - Khu can thiep tim mach',
    status: 'active',
  },
  {
    department_code: 'PED-02',
    department_name: 'Khoa Nhi',
    department_type: 'clinical',
    location_note: 'Toa B - Tang 2 - Khu kham va dieu tri nhi',
    status: 'active',
  },
  {
    department_code: 'ER-03',
    department_name: 'Khoa Cap cuu',
    department_type: 'clinical',
    location_note: 'Tang tret - Khu tiep nhan cap cuu 24/7',
    status: 'active',
  },
  {
    department_code: 'NEUR-04',
    department_name: 'Khoa Than kinh',
    department_type: 'clinical',
    location_note: 'Toa A - Tang 5 - Khu noi tru than kinh',
    status: 'active',
  },
  {
    department_code: 'RAD-05',
    department_name: 'Chan doan hinh anh',
    department_type: 'imaging',
    location_note: 'Toa C - Tang 1 - MRI, CT, X-Quang',
    status: 'active',
  },
  {
    department_code: 'LAB-06',
    department_name: 'Trung tam Xet nghiem',
    department_type: 'lab',
    location_note: 'Toa C - Tang 2 - Hoa sinh, vi sinh, huyet hoc',
    status: 'active',
  },
  {
    department_code: 'PHA-07',
    department_name: 'Khoa Duoc',
    department_type: 'pharmacy',
    location_note: 'Toa D - Tang 1 - Nha thuoc noi bo va kho luu tru',
    status: 'active',
  },
  {
    department_code: 'SUR-08',
    department_name: 'Khoa Ngoai tong hop',
    department_type: 'clinical',
    location_note: 'Toa A - Tang 4 - Khu phau thuat tong hop',
    status: 'active',
  },
  {
    department_code: 'ADM-09',
    department_name: 'Phong Cong tac xa hoi',
    department_type: 'admin',
    location_note: 'Toa Hanh chinh - Tang 1 - Ho tro benh nhan va than nhan',
    status: 'inactive',
  },
  {
    department_code: 'HR-10',
    department_name: 'Phong Nhan su',
    department_type: 'non_clinical',
    location_note: 'Toa Hanh chinh - Tang 3 - Van phong nhan su',
    status: 'active',
  },
  {
    department_code: 'FIN-11',
    department_name: 'Phong Tai chinh Ke toan',
    department_type: 'non_clinical',
    location_note: 'Toa Hanh chinh - Tang 2 - Quan ly tai chinh va bao hiem',
    status: 'active',
  },
  {
    department_code: 'IT-12',
    department_name: 'Trung tam Cong nghe thong tin',
    department_type: 'admin',
    location_note: 'Toa Hanh chinh - Tang 4 - He thong HIS, LIS, PACS',
    status: 'active',
  },
];

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

async function ensureSampleDepartments() {
  await Promise.all(
    sampleDepartments.map((department) =>
      Department.updateOne(
        { department_code: department.department_code },
        {
          $setOnInsert: {
            ...department,
            is_deleted: false,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

async function bootstrapSystemAccess() {
  await ensureCoreRoles();
  await ensureCorePermissions();
  await ensureRolePermissions();
  await ensureSuperAdmin();
  await ensureSampleDepartments();
}

module.exports = {
  bootstrapSystemAccess,
};
