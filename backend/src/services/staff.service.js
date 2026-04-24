const { randomBytes } = require('crypto');
const {
  Appointment,
  AuditLog,
  Department,
  DoctorSchedule,
  Encounter,
  Role,
  User,
  UserRole,
} = require('../models');
const authService = require('./auth.service');
const iamService = require('./iam.service');
const { buildUserPermissionMap, buildUserRoleDetails } = require('./access-control.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  normalizeHumanName,
  normalizeLower,
  normalizePhone,
  recordAuditLog,
} = require('./core.service');

const STAFF_STATUS_TRANSITIONS = {
  active: ['suspended', 'locked', 'disabled', 'active'],
  suspended: ['active', 'disabled', 'locked', 'suspended'],
  locked: ['active', 'disabled', 'suspended', 'locked'],
  disabled: ['active', 'disabled'],
};

function generateInitialStaffPassword() {
  return `Hcs@${randomBytes(4).toString('hex')}Aa1`;
}

function requirePasswordChangeOnFirstLogin() {
  return true;
}

async function validateStaffCreationPayload(payload) {
  const input = { ...payload };

  if (!input.password) {
    input.password = generateInitialStaffPassword();
  }

  input.must_change_password = input.must_change_password !== false ? requirePasswordChangeOnFirstLogin() : false;

  authService.validatePasswordPolicy({
    password: input.password,
    username: input.username,
    email: input.email,
    phone: input.phone,
  });

  return input;
}

function validateStaffStatusTransition(currentStatus, nextStatus) {
  const allowed = STAFF_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw createError(`Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}.`, 409);
  }
  return true;
}

async function getStaffAccountDetail(userId) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  const [roles, permissions, department] = await Promise.all([
    buildUserRoleDetails(user._id),
    buildUserPermissionMap(user._id),
    user.department_id ? Department.findById(user.department_id).lean() : null,
  ]);

  return {
    user: {
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      employee_code: user.employee_code,
      department_id: user.department_id ? String(user.department_id) : null,
      department_name: department?.department_name || null,
      status: user.status,
      must_change_password: user.must_change_password,
      failed_login_attempts: user.failed_login_attempts,
      password_changed_at: user.password_changed_at,
      locked_until: user.locked_until,
      last_login_at: user.last_login_at,
      last_login_ip: user.last_login_ip,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    roles,
    permissions: [...permissions],
  };
}

async function createStaffAccount(payload, actor, requestMeta = {}) {
  const validatedPayload = await validateStaffCreationPayload(payload);
  const result = await authService.createStaffAccount(validatedPayload, actor, requestMeta);

  return {
    ...result,
    initial_password: payload.password ? undefined : validatedPayload.password,
    must_change_password: validatedPayload.must_change_password,
  };
}

async function listStaffAccounts(query = {}) {
  return authService.listStaffAccounts(query);
}

async function searchStaffAccounts(query = {}) {
  return authService.listStaffAccounts(query);
}

async function filterStaffAccounts(query = {}) {
  return authService.listStaffAccounts(query);
}

async function updateStaffAccount(userId, payload, actor, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  const nextFullName = payload.full_name ? normalizeHumanName(payload.full_name) : user.full_name;
  const nextEmail = payload.email !== undefined ? normalizeLower(payload.email) || undefined : user.email;
  const nextPhone = payload.phone !== undefined ? normalizePhone(payload.phone) || undefined : user.phone;
  const nextEmployeeCode = payload.employee_code !== undefined ? payload.employee_code?.trim() || undefined : user.employee_code;
  const nextDepartmentId = payload.department_id !== undefined ? payload.department_id || null : user.department_id;

  if (payload.department_id) {
    const department = await Department.findById(payload.department_id).lean();
    if (!department || department.is_deleted) {
      throw createError('Department không tồn tại.', 404);
    }
  }

  if (nextEmail && nextEmail !== user.email) {
    const existed = await User.findOne({ _id: { $ne: user._id }, email: nextEmail, is_deleted: false }).lean();
    if (existed) {
      throw createError('Email đã được sử dụng bởi tài khoản khác.', 409);
    }
  }

  if (nextEmployeeCode && nextEmployeeCode !== user.employee_code) {
    const existed = await User.findOne({
      _id: { $ne: user._id },
      employee_code: nextEmployeeCode,
      is_deleted: false,
    }).lean();
    if (existed) {
      throw createError('Mã nhân viên đã tồn tại.', 409);
    }
  }

  user.full_name = nextFullName;
  user.email = nextEmail;
  user.phone = nextPhone;
  user.employee_code = nextEmployeeCode;
  user.department_id = nextDepartmentId;
  user.updated_by = actor.userId;
  await user.save();

  await recordAuditLog({
    actor,
    action: 'auth.staff.update',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Cập nhật tài khoản staff thành công.',
    requestMeta,
  });

  return getStaffAccountDetail(user._id);
}

async function updateStaffAccountStatus(userId, status, actor, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  validateStaffStatusTransition(user.status, status);

  return authService.updateStaffAccountStatus({ user_id: userId, status }, actor, requestMeta);
}

async function activateStaffAccount(userId, actor, requestMeta = {}) {
  return authService.activateStaffAccount({ user_id: userId }, actor, requestMeta);
}

async function deactivateStaffAccount(userId, actor, requestMeta = {}) {
  return authService.deactivateStaffAccount({ user_id: userId }, actor, requestMeta);
}

async function unlockStaffAccount(userId, actor, requestMeta = {}) {
  return authService.unlockStaffAccount({ user_id: userId }, actor, requestMeta);
}

async function resetStaffPassword(userId, payload = {}, actor, requestMeta = {}) {
  const nextPassword = payload.new_password || generateInitialStaffPassword();

  authService.validatePasswordPolicy({
    password: nextPassword,
    username: payload.username,
    email: payload.email,
    phone: payload.phone,
  });

  const result = await authService.resetStaffPassword(
    {
      user_id: userId,
      new_password: nextPassword,
      must_change_password: payload.must_change_password !== false,
    },
    actor,
    requestMeta,
  );

  return {
    ...result,
    temporary_password: payload.new_password ? undefined : nextPassword,
  };
}

async function deleteStaffAccountSoft(userId, actor, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  if (String(user._id) === String(actor.userId)) {
    throw createError('Bạn không được tự xóa mềm chính tài khoản của mình.', 403);
  }

  user.is_deleted = true;
  user.deleted_at = new Date();
  user.deleted_by = actor.userId;
  user.status = 'disabled';
  user.updated_by = actor.userId;
  await user.save();

  await authService.invalidateAllUserSessions('staff', user._id);

  await recordAuditLog({
    actor,
    action: 'auth.staff.soft_delete',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Xóa mềm tài khoản staff thành công.',
    requestMeta,
  });

  return { success: true };
}

async function assignRolesToStaff(userId, roleCodes, actor, requestMeta = {}) {
  return authService.assignRolesToStaff({ user_id: userId, role_codes: roleCodes }, actor, requestMeta);
}

async function removeRolesFromStaff(userId, roleCodes, actor, requestMeta = {}) {
  return iamService.removeRolesFromStaff(userId, { role_codes: roleCodes }, actor, requestMeta);
}

async function syncStaffRoles(userId, roleCodes, actor, requestMeta = {}) {
  return iamService.syncStaffRoles(userId, { role_codes: roleCodes }, actor, requestMeta);
}

async function getStaffRoles(userId) {
  return iamService.getStaffRoles(userId);
}

async function getStaffPermissions(userId) {
  return iamService.getStaffPermissions(userId);
}

async function checkStaffPermission(userId, permissionCode) {
  return iamService.checkStaffPermission(userId, permissionCode);
}

async function getUsersByRole(roleId, query = {}) {
  return iamService.getUsersByRole(roleId, query);
}

async function getStaffByDepartment(departmentId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const keyword = query.search ? escapeRegex(query.search) : null;
  const filter = {
    department_id: departmentId,
    is_deleted: false,
  };

  if (query.status) {
    filter.status = query.status;
  }

  if (keyword) {
    filter.$or = [
      { full_name: { $regex: keyword, $options: 'i' } },
      { username: { $regex: keyword, $options: 'i' } },
      { email: { $regex: keyword, $options: 'i' } },
      { phone: { $regex: keyword, $options: 'i' } },
      { employee_code: { $regex: keyword, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ full_name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map((user) => ({
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      employee_code: user.employee_code,
      status: user.status,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getDoctorsList(query = {}) {
  const doctorRole = await Role.findOne({ role_code: 'doctor', is_deleted: false }).lean();
  if (!doctorRole) {
    return { items: [] };
  }

  const assignments = await UserRole.find({ role_id: doctorRole._id, is_active: true }).lean();
  const userIds = assignments.map((item) => item.user_id);
  const filter = {
    _id: { $in: userIds },
    is_deleted: false,
    status: 'active',
  };

  if (query.department_id) {
    filter.department_id = query.department_id;
  }

  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [
      { full_name: { $regex: keyword, $options: 'i' } },
      { username: { $regex: keyword, $options: 'i' } },
      { employee_code: { $regex: keyword, $options: 'i' } },
    ];
  }

  const users = await User.find(filter).sort({ full_name: 1 }).lean();
  const departments = await Department.find({
    _id: { $in: users.map((item) => item.department_id).filter(Boolean) },
  }).lean();
  const departmentMap = new Map(departments.map((item) => [String(item._id), item.department_name]));

  return {
    items: users.map((user) => ({
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      employee_code: user.employee_code,
      department_id: user.department_id ? String(user.department_id) : null,
      department_name: user.department_id ? departmentMap.get(String(user.department_id)) || null : null,
    })),
  };
}

async function getAssignableStaffRoles(actor) {
  const filter = {
    is_deleted: false,
    status: 'active',
  };

  if (!actor.roles.includes('super_admin')) {
    filter.role_code = { $ne: 'super_admin' };
  }

  const roles = await Role.find(filter).sort({ role_code: 1 }).lean();
  return {
    items: roles.map((role) => ({
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      description: role.description,
    })),
  };
}

async function getStaffLoginHistory(userId, query = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  const { page, limit, skip } = getPagination(query);
  const filter = {
    actor_type: 'staff',
    actor_id: user._id,
    action: 'auth.staff.login',
  };

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    user_id: String(user._id),
    items,
    pagination: buildPagination(page, limit, total),
  };
}

async function getStaffAuditLogs(userId, query = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  const { page, limit, skip } = getPagination(query);
  const filter = {
    $or: [
      { actor_type: 'staff', actor_id: user._id },
      { target_type: 'user', target_id: user._id },
    ],
  };

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    user_id: String(user._id),
    items,
    pagination: buildPagination(page, limit, total),
  };
}

async function forceLogoutStaff(userId, actor, requestMeta = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  await authService.invalidateAllUserSessions('staff', user._id);

  await recordAuditLog({
    actor,
    action: 'auth.staff.force_logout',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Buộc đăng xuất toàn bộ phiên của staff thành công.',
    requestMeta,
  });

  return { success: true };
}

async function sendStaffAccountNotification() {
  return {
    delivered: false,
    message: 'MVP hiện chưa tích hợp gửi thông báo tạo tài khoản staff.',
  };
}

async function getStaffSummary() {
  const [total, active, locked, disabled, suspended, roles, departments] = await Promise.all([
    User.countDocuments({ is_deleted: false }),
    User.countDocuments({ is_deleted: false, status: 'active' }),
    User.countDocuments({ is_deleted: false, status: 'locked' }),
    User.countDocuments({ is_deleted: false, status: 'disabled' }),
    User.countDocuments({ is_deleted: false, status: 'suspended' }),
    Role.find({ is_deleted: false }).lean(),
    Department.find({ is_deleted: false }).lean(),
  ]);

  const role_breakdown = await Promise.all(
    roles.map(async (role) => ({
      role_code: role.role_code,
      count: await UserRole.countDocuments({ role_id: role._id, is_active: true }),
    })),
  );

  const department_breakdown = await Promise.all(
    departments.map(async (department) => ({
      department_id: String(department._id),
      department_name: department.department_name,
      count: await User.countDocuments({ department_id: department._id, is_deleted: false }),
    })),
  );

  return {
    total,
    active,
    locked,
    disabled,
    suspended,
    role_breakdown,
    department_breakdown,
  };
}

async function transferStaffDepartment(userId, departmentId, actor, requestMeta = {}) {
  return updateStaffAccount(userId, { department_id: departmentId }, actor, requestMeta);
}

async function checkStaffCanBeDeleted(userId) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  const [headDepartments, activeSchedules, futureAppointments, openEncounters] = await Promise.all([
    Department.countDocuments({ head_user_id: user._id, is_deleted: false }),
    DoctorSchedule.countDocuments({
      doctor_id: user._id,
      is_deleted: false,
      status: { $in: ['published', 'active'] },
    }),
    Appointment.countDocuments({
      doctor_id: user._id,
      is_deleted: false,
      appointment_time: { $gte: new Date() },
      status: { $in: ['booked', 'confirmed', 'checked_in', 'in_consultation'] },
    }),
    Encounter.countDocuments({
      attending_doctor_id: user._id,
      status: { $in: ['planned', 'arrived', 'in_progress', 'on_hold'] },
    }),
  ]);

  return {
    user_id: String(user._id),
    can_delete: headDepartments === 0 && activeSchedules === 0 && futureAppointments === 0 && openEncounters === 0,
    blockers: {
      head_departments: headDepartments,
      active_schedules: activeSchedules,
      future_appointments: futureAppointments,
      open_encounters: openEncounters,
    },
  };
}

module.exports = {
  generateInitialStaffPassword,
  requirePasswordChangeOnFirstLogin,
  validateStaffCreationPayload,
  validateStaffStatusTransition,
  createStaffAccount,
  listStaffAccounts,
  searchStaffAccounts,
  filterStaffAccounts,
  getStaffAccountDetail,
  updateStaffAccount,
  updateStaffAccountStatus,
  activateStaffAccount,
  deactivateStaffAccount,
  unlockStaffAccount,
  resetStaffPassword,
  deleteStaffAccountSoft,
  assignRolesToStaff,
  removeRolesFromStaff,
  syncStaffRoles,
  getStaffRoles,
  getStaffPermissions,
  checkStaffPermission,
  getUsersByRole,
  getStaffByDepartment,
  getDoctorsList,
  getAssignableStaffRoles,
  getStaffLoginHistory,
  getStaffAuditLogs,
  getStaffSummary,
  transferStaffDepartment,
  checkStaffCanBeDeleted,
  forceLogoutStaff,
  sendStaffAccountNotification,
};
