const { normalizePagination, buildPaginationMeta } = require('../../common/helpers/pagination.helper');
const { buildDateRangeFilter } = require('../../common/helpers/query.helper');
const { ROLE_CODE } = require('../../constants/permissions');
const {
  AuditLog,
  AuthSession,
  Department,
  DoctorProfile,
  Permission,
  Role,
  User,
  UserRole,
} = require('../../models');

function getDepartmentScope(auth = {}) {
  const roles = auth.roles || [];
  if (roles.includes(ROLE_CODE.SUPER_ADMIN) || roles.includes(ROLE_CODE.ADMIN) || roles.includes(ROLE_CODE.MANAGER)) {
    return {};
  }

  if (roles.includes(ROLE_CODE.DEPARTMENT_HEAD) && auth.user?.department_id) {
    return { department_id: auth.user.department_id };
  }

  return {};
}

async function countUsersByStatus(userScope = {}) {
  const [total, active, locked, suspended, disabled] = await Promise.all([
    User.countDocuments({ is_deleted: false, ...userScope }),
    User.countDocuments({ is_deleted: false, status: 'active', ...userScope }),
    User.countDocuments({ is_deleted: false, status: 'locked', ...userScope }),
    User.countDocuments({ is_deleted: false, status: 'suspended', ...userScope }),
    User.countDocuments({ is_deleted: false, status: 'disabled', ...userScope }),
  ]);

  return {
    total_staff: total,
    active_staff: active,
    locked_staff: locked,
    suspended_staff: suspended,
    disabled_staff: disabled,
  };
}

async function getStaffSummary(auth = {}) {
  const scope = getDepartmentScope(auth);
  const [statusSummary, departments, roles] = await Promise.all([
    countUsersByStatus(scope),
    Department.find({ is_deleted: false, ...(scope.department_id ? { _id: scope.department_id } : {}) }).lean(),
    Role.find({ is_deleted: false }).lean(),
  ]);

  const [staffByDepartment, staffByRole] = await Promise.all([
    Promise.all(departments.map(async (department) => ({
      department_id: String(department._id),
      department_name: department.department_name,
      active_staff: await User.countDocuments({ department_id: department._id, is_deleted: false, status: 'active' }),
      total_staff: await User.countDocuments({ department_id: department._id, is_deleted: false }),
    }))),
    Promise.all(roles.map(async (role) => {
      const assignments = await UserRole.find({ role_id: role._id, is_active: true }).lean();
      const userFilter = {
        _id: { $in: assignments.map((item) => item.user_id) },
        is_deleted: false,
        ...scope,
      };
      return {
        role_code: role.role_code,
        role_name: role.role_name,
        count: await User.countDocuments(userFilter),
      };
    })),
  ]);

  return {
    ...statusSummary,
    staff_by_department: staffByDepartment,
    staff_by_role: staffByRole.filter((item) => item.count > 0),
  };
}

async function buildScopedAuditFilter(auth = {}) {
  const scope = getDepartmentScope(auth);
  if (!scope.department_id) return {};

  const departmentUserIds = await User.find({
    department_id: scope.department_id,
    is_deleted: false,
  }).distinct('_id');

  return {
    $or: [
      { actor_type: 'staff', actor_id: { $in: departmentUserIds } },
      { target_type: 'user', target_id: { $in: departmentUserIds } },
      { target_type: 'department', target_id: scope.department_id },
      { target_type: 'doctor_profile', target_id: { $in: await DoctorProfile.find({ department_id: scope.department_id, is_deleted: false }).distinct('_id') } },
    ],
  };
}

async function getRecentAdminActivities(query = {}, auth = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
  const actions = [
    'users.create',
    'users.update',
    'users.update_status',
    'users.reset_password',
    'users.assign_roles',
    'role_permissions.assign',
    'role_permissions.sync',
    'departments.create',
    'departments.update',
    'departments.status_update',
    'doctor_profiles.create',
    'doctor_profiles.update',
    'settings.create',
    'settings.update',
  ];

  const items = await AuditLog.find({
    action: { $in: actions },
    ...(await buildScopedAuditFilter(auth)),
  }).sort({ created_at: -1 }).limit(limit).lean();

  return { items };
}

async function getAdminOverview(auth = {}) {
  const scope = getDepartmentScope(auth);
  const scopedStaffIds = scope.department_id
    ? await User.find({ department_id: scope.department_id, is_deleted: false }).distinct('_id')
    : null;
  const [staff, totalDepartments, activeDepartments, totalDoctors, activeDoctors, totalRoles, totalPermissions, activeSessions, recentActivities] =
    await Promise.all([
      countUsersByStatus(scope),
      Department.countDocuments({ is_deleted: false, ...(scope.department_id ? { _id: scope.department_id } : {}) }),
      Department.countDocuments({ is_deleted: false, status: 'active', ...(scope.department_id ? { _id: scope.department_id } : {}) }),
      DoctorProfile.countDocuments({ is_deleted: false, ...(scope.department_id ? { department_id: scope.department_id } : {}) }),
      DoctorProfile.countDocuments({ is_deleted: false, status: 'active', ...(scope.department_id ? { department_id: scope.department_id } : {}) }),
      Role.countDocuments({ is_deleted: false }),
      Permission.countDocuments({ is_deleted: false }),
      AuthSession.countDocuments({
        revoked_at: null,
        expires_at: { $gt: new Date() },
        actor_type: 'staff',
        ...(scopedStaffIds ? { actor_id: { $in: scopedStaffIds } } : {}),
      }),
      getRecentAdminActivities({ limit: 10 }, auth),
    ]);

  return {
    ...staff,
    total_departments: totalDepartments,
    active_departments: activeDepartments,
    total_doctors: totalDoctors,
    active_doctors: activeDoctors,
    total_roles: totalRoles,
    total_permissions: totalPermissions,
    active_staff_sessions: activeSessions,
    recent_activities: recentActivities.items,
  };
}

async function getStaffAuditLogs(userId, query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = {
    $or: [
      { actor_id: userId },
      { target_type: 'user', target_id: userId },
    ],
    ...buildDateRangeFilter('created_at', query.from, query.to),
  };

  if (query.action) filter.action = query.action;
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    user_id: String(userId),
    items,
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

module.exports = {
  // getAdminOverview: Lấy tổng quan quản trị hệ thống.
  getAdminOverview,
  // getStaffSummary: Lấy tổng hợp nhân sự.
  getStaffSummary,
  // getRecentAdminActivities: Lấy các hoạt động quản trị gần đây.
  getRecentAdminActivities,
  // getStaffAuditLogs: Lấy nhật ký kiểm toán của nhân sự.
  getStaffAuditLogs,
};
