const { randomInt } = require('crypto');
const ApiError = require('../common/errors/api-error');
const { mongoose } = require('../config/database');
const {
  Appointment,
  AuditLog,
  Department,
  DoctorProfile,
  DoctorSchedule,
  Encounter,
  PatientAccount,
  Role,
  User,
  UserRole,
} = require('../models');
const authService = require('./auth.service');
const iamService = require('./iam.service');
const { buildUserPermissionMap, buildUserRoleDetails } = require('./access-control.service');
const permissionService = require('./permission.service');
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
const { PERMISSION, ROLE_CODE, ROLE_PRIORITY } = require('../constants/permissions');
const { STAFF_TRANSITIONS } = require('../constants/transitions');
const { assertTransition } = require('../shared/utils/status-transition');

function shuffleCharacters(value) {
  const chars = String(value).split('');
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const randomIndex = randomInt(0, index + 1);
    [chars[index], chars[randomIndex]] = [chars[randomIndex], chars[index]];
  }
  return chars.join('');
}

function pickRandom(charset) {
  return charset[randomInt(0, charset.length)];
}

function generateInitialStaffPassword(options = {}) {
  const length = Math.max(Number(options.length) || 12, 10);
  const groups = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%^&*',
  ];
  const allChars = groups.join('');
  let password = groups.map(pickRandom).join('');

  while (password.length < length) {
    password += pickRandom(allChars);
  }

  return shuffleCharacters(password);
}

function getActorId(actor = {}) {
  return actor.userId || actor.actor_id || actor.actorId;
}

function isActorSuperAdmin(actor = {}) {
  return (actor.roles || []).includes(ROLE_CODE.SUPER_ADMIN) ||
    permissionService.hasPermission(actor.permissions || [], PERMISSION.SYSTEM.FULL_ACCESS);
}

function getActorMaxRolePriority(actor = {}) {
  if (isActorSuperAdmin(actor)) return 100;
  const roleDetails = actor.roleDetails || actor.role_details || [];
  if (Array.isArray(roleDetails) && roleDetails.length) {
    return Math.max(0, ...roleDetails.map((role) => Number(role.priority_level ?? ROLE_PRIORITY[role.role_code] ?? 0)));
  }
  return Math.max(0, ...(actor.roles || []).map((roleCode) => ROLE_PRIORITY[roleCode] || 0));
}

async function getStaffRoleCodes(userId) {
  const roles = await buildUserRoleDetails(userId);
  return roles.map((role) => role.role_code);
}

async function assertCanManageTargetStaff(user, actor = {}, actionLabel = 'quản lý') {
  assertCanAccessStaff(user, actor);

  if (String(user._id) === String(getActorId(actor))) {
    throw ApiError.forbidden(`Bạn không được tự ${actionLabel} chính tài khoản của mình qua admin action.`);
  }

  const targetRoles = await buildUserRoleDetails(user._id);
  const targetRoleCodes = targetRoles.map((role) => role.role_code);
  if (targetRoleCodes.includes(ROLE_CODE.SUPER_ADMIN) && !isActorSuperAdmin(actor)) {
    throw ApiError.forbidden(`Chỉ super_admin mới được ${actionLabel} tài khoản super_admin.`);
  }

  const targetMaxPriority = Math.max(
    0,
    ...targetRoles.map((role) => Number(role.priority_level ?? ROLE_PRIORITY[role.role_code] ?? 0)),
  );
  if (!isActorSuperAdmin(actor) && targetMaxPriority >= getActorMaxRolePriority(actor)) {
    throw ApiError.forbidden(`Bạn không được ${actionLabel} tài khoản có cấp quyền bằng hoặc cao hơn mình.`);
  }

  return targetRoleCodes;
}

function shouldRequirePasswordChangeOnFirstLogin(payload = {}) {
  return payload.must_change_password !== false;
}

function rejectUnknownFields(payload = {}, allowedFields = []) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(payload || {}).filter((field) => !allowed.has(field));
  if (unknown.length) {
    throw ApiError.validation('Request chứa field không được phép.', unknown.map((field) => ({
      field,
      message: 'Unknown field is not allowed.',
    })));
  }
}

function assertCanUseDepartmentScope(departmentId, actor = {}, actionLabel = 'thao tác') {
  if (!departmentId || isActorSuperAdmin(actor)) return true;
  const canReadAll = permissionService.hasPermission(actor.permissions || [], PERMISSION.USERS.READ);
  if (canReadAll) return true;

  const actorDepartmentId = actor.user?.department_id || actor.department_id || actor.departmentId;
  if (!actorDepartmentId) {
    throw ApiError.forbidden('Tài khoản hiện tại chưa có department scope.');
  }

  if (String(actorDepartmentId) !== String(departmentId)) {
    throw ApiError.forbidden(`Bạn không được ${actionLabel} staff ngoài department của mình.`);
  }

  return true;
}

async function requirePasswordChangeOnFirstLogin(userId, actor = {}, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');
  }

  await assertCanManageTargetStaff(user, actor, 'bắt đổi mật khẩu');

  user.must_change_password = true;
  user.updated_by = getActorId(actor);
  await user.save();

  const revoked = await authService.invalidateAllUserSessions('staff', user._id, requestMeta, {
    actorType: actor.actorType,
    actorId: getActorId(actor),
    audit: false,
  });

  await recordAuditLog({
    actor,
    action: 'users.require_password_change',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Yêu cầu staff đổi mật khẩu lần đăng nhập tiếp theo.',
    requestMeta,
    metadata: {
      revoked_sessions: revoked.revoked_count || 0,
    },
  });

  return getStaffAccountDetail(user._id, actor);
}

async function validateStaffCreationPayload(payload, actor = {}) {
  rejectUnknownFields(payload, [
    'username',
    'full_name',
    'email',
    'phone',
    'employee_code',
    'department_id',
    'role_codes',
    'role_ids',
    'roleIds',
    'password',
    'temporary_password',
    'must_change_password',
  ]);

  const input = { ...payload };

  input.username = normalizeLower(input.username);
  input.email = normalizeLower(input.email) || undefined;
  input.phone = normalizePhone(input.phone) || undefined;
  input.employee_code = input.employee_code ? String(input.employee_code).trim().toUpperCase() : undefined;
  input.full_name = normalizeHumanName(input.full_name);

  if (!input.full_name) {
    throw ApiError.validation('full_name là bắt buộc.');
  }
  if (!input.username) {
    throw ApiError.validation('username là bắt buộc.');
  }

  const roleInput = input.role_codes || input.roleIds || input.role_ids || [];
  const roles = roleInput.length ? await iamService.validateRoleAssignable(roleInput, actor) : [];
  if (!roles.length) {
    throw ApiError.validation('Phải chọn ít nhất một role cho tài khoản staff.');
  }
  input.role_codes = roles.map((role) => role.role_code);

  if (input.department_id) {
    assertCanUseDepartmentScope(input.department_id, actor, 'tạo');
    const department = await Department.findById(input.department_id).lean();
    if (!department || department.is_deleted || department.status !== 'active') {
      throw ApiError.notFound('Department không tồn tại hoặc không active.');
    }
  }

  if (!input.password && !input.temporary_password) {
    input.password = generateInitialStaffPassword();
  } else if (!input.password && input.temporary_password) {
    input.password = input.temporary_password;
  }

  input.must_change_password = shouldRequirePasswordChangeOnFirstLogin(input);

  authService.validatePasswordPolicy({
    password: input.password,
    username: input.username,
    email: input.email,
    phone: input.phone,
  });

  return input;
}

function validateStaffStatusTransition(currentStatus, nextStatus) {
  return assertTransition(STAFF_TRANSITIONS, currentStatus, nextStatus, 'staff');
}

async function getStaffAccountDetail(userId, actor = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  assertCanAccessStaff(user, actor);

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
  const validatedPayload = await validateStaffCreationPayload(payload, actor);
  const result = await authService.createStaffAccount(validatedPayload, actor, requestMeta);

  return {
    ...result,
    initial_password: payload.password ? undefined : validatedPayload.password,
    must_change_password: validatedPayload.must_change_password,
  };
}

function getDepartmentScopeFilter(actor = {}) {
  const canReadAll = permissionService.hasPermission(actor.permissions || [], PERMISSION.USERS.READ);
  const canReadDepartment = permissionService.hasPermission(actor.permissions || [], PERMISSION.USERS.READ_DEPARTMENT);

  if (!canReadAll && canReadDepartment) {
    const departmentId = actor.user?.department_id || actor.department_id || actor.departmentId;
    if (!departmentId) {
      throw ApiError.forbidden('Tài khoản hiện tại chưa có department scope.');
    }
    return { department_id: departmentId };
  }

  return {};
}

function assertCanAccessStaff(user, actor = {}) {
  if (String(user._id) === String(actor.userId)) return true;
  const scope = getDepartmentScopeFilter(actor);
  if (scope.department_id && String(scope.department_id) !== String(user.department_id)) {
    throw ApiError.forbidden('Bạn không được thao tác trên staff ngoài department của mình.');
  }
  return true;
}

async function buildStaffFilter(query = {}, actor = {}) {
  const keyword = query.search || query.keyword ? escapeRegex(query.search || query.keyword) : null;
  const filter = {
    is_deleted: false,
    ...getDepartmentScopeFilter(actor),
  };

  if (query.status) filter.status = query.status;
  if (query.department_id) {
    if (filter.department_id && String(filter.department_id) !== String(query.department_id)) {
      throw ApiError.forbidden('Bạn không được xem staff ngoài department của mình.');
    }
    filter.department_id = query.department_id;
  }
  if (query.employee_code) filter.employee_code = String(query.employee_code).trim().toUpperCase();
  if (query.email) filter.email = normalizeLower(query.email);
  if (query.phone) filter.phone = normalizePhone(query.phone);
  if (query.created_from || query.created_to) {
    filter.created_at = {};
    if (query.created_from) filter.created_at.$gte = new Date(query.created_from);
    if (query.created_to) filter.created_at.$lte = new Date(query.created_to);
  }
  if (query.last_login_from || query.last_login_to) {
    filter.last_login_at = {};
    if (query.last_login_from) filter.last_login_at.$gte = new Date(query.last_login_from);
    if (query.last_login_to) filter.last_login_at.$lte = new Date(query.last_login_to);
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

  const roleKey = query.role_id || query.role_code;
  if (roleKey) {
    const roleClauses = [{ role_code: roleKey }];
    if (mongoose.Types.ObjectId.isValid(roleKey)) {
      roleClauses.push({ _id: roleKey });
    }
    const role = await Role.findOne({
      is_deleted: false,
      $or: roleClauses,
    }).lean();
    if (!role) throw ApiError.notFound('Không tìm thấy role filter.');
    const assignments = await UserRole.find({ role_id: role._id, is_active: true }).lean();
    filter._id = { $in: assignments.map((item) => item.user_id) };
  }

  return filter;
}

async function listStaffAccounts(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildStaffFilter(query, actor);
  const sortField = ['created_at', 'full_name', 'last_login_at', 'status'].includes(query.sort_by)
    ? query.sort_by
    : 'created_at';
  const sortOrder = query.sort_order === 'asc' ? 1 : -1;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  const departmentIds = users.map((user) => user.department_id).filter(Boolean);
  const departments = await Department.find({ _id: { $in: departmentIds }, is_deleted: false }).lean();
  const departmentMap = new Map(departments.map((department) => [String(department._id), department]));

  const items = await Promise.all(users.map(async (user) => {
    const roles = await buildUserRoleDetails(user._id);
    const department = user.department_id ? departmentMap.get(String(user.department_id)) : null;
    return {
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      employee_code: user.employee_code,
      department: department ? {
        department_id: String(department._id),
        department_name: department.department_name,
        department_code: department.department_code,
      } : null,
      roles: roles.map((role) => role.role_code),
      status: user.status,
      must_change_password: user.must_change_password,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    };
  }));

  return {
    items,
    pagination: buildPagination(page, limit, total),
  };
}

async function searchStaffAccounts(query = {}, actor = {}) {
  return listStaffAccounts({ ...query, limit: Math.min(Number(query.limit) || 20, 20), status: query.status || 'active' }, actor);
}

async function filterStaffAccounts(query = {}, actor = {}) {
  return listStaffAccounts(query, actor);
}

async function updateStaffAccount(userId, payload, actor, requestMeta = {}) {
  if (payload.department_id !== undefined) {
    throw ApiError.forbidden('Không được đổi department qua API update staff. Hãy dùng transfer-department.');
  }
  rejectUnknownFields(payload, ['full_name', 'email', 'phone', 'employee_code']);

  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  await assertCanManageTargetStaff(user, actor, 'cập nhật');

  const nextFullName = payload.full_name ? normalizeHumanName(payload.full_name) : user.full_name;
  const nextEmail = payload.email !== undefined ? normalizeLower(payload.email) || undefined : user.email;
  const nextPhone = payload.phone !== undefined ? normalizePhone(payload.phone) || undefined : user.phone;
  const nextEmployeeCode = payload.employee_code !== undefined ? payload.employee_code?.trim().toUpperCase() || undefined : user.employee_code;

  if (nextEmail && nextEmail !== user.email) {
    const existed = await User.findOne({ _id: { $ne: user._id }, email: nextEmail, is_deleted: false }).lean();
    if (existed) {
      throw createError('Email đã được sử dụng bởi tài khoản khác.', 409);
    }
    const patientAccount = await PatientAccount.findOne({ email: nextEmail, is_deleted: false }).lean();
    if (patientAccount) {
      throw createError('Email đã được sử dụng bởi tài khoản bệnh nhân.', 409);
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

  if (nextPhone && nextPhone !== user.phone) {
    const existed = await User.findOne({
      _id: { $ne: user._id },
      phone: nextPhone,
      is_deleted: false,
    }).lean();
    if (existed) {
      throw createError('Số điện thoại đã được sử dụng bởi tài khoản khác.', 409);
    }
    const patientAccount = await PatientAccount.findOne({ phone: nextPhone, is_deleted: false }).lean();
    if (patientAccount) {
      throw createError('Số điện thoại đã được sử dụng bởi tài khoản bệnh nhân.', 409);
    }
  }

  const before = user.toObject();
  user.full_name = nextFullName;
  user.email = nextEmail;
  user.phone = nextPhone;
  user.employee_code = nextEmployeeCode;
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
    before,
    after: user,
  });

  return getStaffAccountDetail(user._id, actor);
}

async function updateStaffAccountStatus(userId, status, actor, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  await assertCanManageTargetStaff(user, actor, 'cập nhật trạng thái');

  validateStaffStatusTransition(user.status, status);

  return authService.updateStaffAccountStatus({ user_id: userId, status }, actor, requestMeta);
}

async function activateStaffAccount(userId, actor, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  await assertCanManageTargetStaff(user, actor, 'kích hoạt');
  return authService.activateStaffAccount({ user_id: userId }, actor, requestMeta);
}

async function deactivateStaffAccount(userId, actor, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  await assertCanManageTargetStaff(user, actor, 'vô hiệu hóa');
  return authService.deactivateStaffAccount({ user_id: userId }, actor, requestMeta);
}

async function unlockStaffAccount(userId, actor, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  await assertCanManageTargetStaff(user, actor, 'mở khóa');
  return authService.unlockStaffAccount({ user_id: userId }, actor, requestMeta);
}

async function resetStaffPassword(userId, payload = {}, actor, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  await assertCanManageTargetStaff(user, actor, 'reset mật khẩu');

  const nextPassword = payload.new_password || generateInitialStaffPassword();

  authService.validatePasswordPolicy({
    password: nextPassword,
    username: user.username,
    email: user.email,
    phone: user.phone,
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
  await assertCanManageTargetStaff(user, actor, 'xóa mềm');

  const roles = await buildUserRoleDetails(user._id);
  if (roles.some((role) => role.role_code === ROLE_CODE.SUPER_ADMIN)) {
    const superAdminRole = await Role.findOne({ role_code: ROLE_CODE.SUPER_ADMIN, is_deleted: false }).lean();
    const assignments = superAdminRole
      ? await UserRole.find({ role_id: superAdminRole._id, is_active: true }).lean()
      : [];
    const activeOtherSuperAdmins = await User.countDocuments({
      _id: { $in: assignments.map((item) => item.user_id), $ne: user._id },
      status: 'active',
      is_deleted: false,
    });
    if (activeOtherSuperAdmins <= 0) {
      throw ApiError.conflict('Không được xóa mềm tài khoản super_admin active cuối cùng.');
    }
  }

  const canDelete = await checkStaffCanBeDeleted(user._id);
  if (!canDelete.can_delete) {
    throw ApiError.conflict('Staff vẫn còn phụ thuộc nghiệp vụ active, chưa thể xóa mềm.', canDelete);
  }

  user.is_deleted = true;
  user.deleted_at = new Date();
  user.deleted_by = actor.userId;
  user.status = 'disabled';
  user.updated_by = actor.userId;
  await user.save();

  await authService.invalidateAllUserSessions('staff', user._id, requestMeta, {
    actorType: actor.actorType,
    actorId: actor.userId,
  });

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
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  await assertCanManageTargetStaff(user, actor, 'gán role cho');

  const current = await iamService.getStaffRoles(userId);
  const currentCodes = current.roles.map((role) => role.role_code);
  const nextCodes = [...new Set([...currentCodes, ...roleCodes])];
  return iamService.syncStaffRoles(userId, { role_codes: nextCodes }, actor, requestMeta);
}

async function removeRolesFromStaff(userId, roleCodes, actor, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  await assertCanManageTargetStaff(user, actor, 'gỡ role của');

  return iamService.removeRolesFromStaff(userId, { role_codes: roleCodes }, actor, requestMeta);
}

async function syncStaffRoles(userId, roleCodes, actor, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  await assertCanManageTargetStaff(user, actor, 'đồng bộ role của');

  return iamService.syncStaffRoles(userId, { role_codes: roleCodes }, actor, requestMeta);
}

async function getStaffRoles(userId, actor = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  assertCanAccessStaff(user, actor);
  return iamService.getStaffRoles(userId);
}

async function getStaffPermissions(userId, actor = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  assertCanAccessStaff(user, actor);
  return iamService.getStaffPermissions(userId);
}

async function checkStaffPermission(userId, permissionCode, actor = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  assertCanAccessStaff(user, actor);
  return iamService.checkStaffPermission(userId, permissionCode);
}

async function getUsersByRole(roleId, query = {}, actor = {}) {
  const scopedQuery = { ...query };
  const scope = getDepartmentScopeFilter(actor);
  if (scope.department_id) {
    if (scopedQuery.department_id && String(scopedQuery.department_id) !== String(scope.department_id)) {
      throw ApiError.forbidden('Bạn không được xem staff ngoài department của mình.');
    }
    scopedQuery.department_id = scope.department_id;
  }
  return iamService.getUsersByRole(roleId, scopedQuery);
}

async function getStaffByDepartment(departmentId, query = {}, actor = {}) {
  const scope = getDepartmentScopeFilter(actor);
  if (scope.department_id && String(scope.department_id) !== String(departmentId)) {
    throw ApiError.forbidden('Bạn không được xem staff ngoài department của mình.');
  }

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
      full_name: user.full_name,
      department_id: user.department_id ? String(user.department_id) : null,
      department_name: user.department_id ? departmentMap.get(String(user.department_id)) || null : null,
    })),
  };
}

async function getAssignableStaffRoles(actor) {
  const filter = {
    is_deleted: false,
    status: 'active',
    role_code: { $nin: [ROLE_CODE.PATIENT, ROLE_CODE.PATIENT_RELATIVE] },
  };

  const actorMaxPriority = getActorMaxRolePriority(actor);

  if (!isActorSuperAdmin(actor)) {
    filter.priority_level = { $lt: actorMaxPriority };
  }

  const roles = await Role.find(filter).sort({ role_code: 1 }).lean();
  return {
    items: roles.map((role) => ({
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      description: role.description,
      priority_level: role.priority_level || 0,
    })),
  };
}

async function getStaffLoginHistory(userId, query = {}, actor = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  assertCanAccessStaff(user, actor);

  const { page, limit, skip } = getPagination(query);
  const filter = {
    actor_type: 'staff',
    actor_id: user._id,
    action: { $in: ['auth.login', 'auth.login_failed', 'auth.logout', 'auth.refresh_token', 'auth.session.revoke'] },
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

async function getStaffAuditLogs(userId, query = {}, actor = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  assertCanAccessStaff(user, actor);

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
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  await assertCanManageTargetStaff(user, actor, 'buộc đăng xuất');

  const result = await authService.invalidateAllUserSessions('staff', user._id, requestMeta, {
    actorType: actor.actorType,
    actorId: actor.userId,
  });

  await recordAuditLog({
    actor,
    action: 'auth.staff.force_logout',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Buộc đăng xuất toàn bộ phiên của staff thành công.',
    requestMeta,
  });

  return {
    success: true,
    revoked_count: result.revoked_count || 0,
  };
}

async function sendStaffAccountNotification() {
  return {
    delivered: false,
    message: 'MVP hiện chưa tích hợp gửi thông báo tạo tài khoản staff.',
  };
}

async function getStaffSummary(actor = {}) {
  const scope = getDepartmentScopeFilter(actor);
  const [total, active, locked, disabled, suspended, roles, departments] = await Promise.all([
    User.countDocuments({ is_deleted: false, ...scope }),
    User.countDocuments({ is_deleted: false, status: 'active', ...scope }),
    User.countDocuments({ is_deleted: false, status: 'locked', ...scope }),
    User.countDocuments({ is_deleted: false, status: 'disabled', ...scope }),
    User.countDocuments({ is_deleted: false, status: 'suspended', ...scope }),
    Role.find({ is_deleted: false }).lean(),
    Department.find({ is_deleted: false, ...(scope.department_id ? { _id: scope.department_id } : {}) }).lean(),
  ]);

  const role_breakdown = await Promise.all(
    roles.map(async (role) => ({
      role_code: role.role_code,
      count: await UserRole.countDocuments({
        role_id: role._id,
        is_active: true,
        ...(scope.department_id ? {
          user_id: {
            $in: await User.find({ department_id: scope.department_id, is_deleted: false }).distinct('_id'),
          },
        } : {}),
      }),
    })),
  );

  const department_breakdown = await Promise.all(
    departments.map(async (department) => ({
      department_id: String(department._id),
      department_name: department.department_name,
      count: await User.countDocuments({ department_id: department._id, is_deleted: false, ...scope }),
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
  if (!departmentId) {
    throw ApiError.validation('department_id là bắt buộc.');
  }
  assertCanUseDepartmentScope(departmentId, actor, 'chuyển');

  const [user, department] = await Promise.all([
    User.findById(userId),
    Department.findById(departmentId).lean(),
  ]);

  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  if (!department || department.is_deleted || department.status !== 'active') {
    throw createError('Department đích không tồn tại hoặc không active.', 404);
  }

  await assertCanManageTargetStaff(user, actor, 'chuyển department');

  if (String(user.department_id || '') === String(department._id)) {
    return getStaffAccountDetail(user._id, actor);
  }

  const headDepartmentCount = await Department.countDocuments({
    head_user_id: user._id,
    is_deleted: false,
    _id: { $ne: department._id },
  });
  if (headDepartmentCount > 0) {
    throw ApiError.conflict('Staff đang là trưởng khoa/phòng hiện tại, cần gỡ hoặc đổi trưởng khoa trước khi chuyển department.');
  }

  const roleCodes = await getStaffRoleCodes(user._id);
  if (roleCodes.includes(ROLE_CODE.DOCTOR)) {
    const [futureSchedules, futureAppointments, openEncounters] = await Promise.all([
      DoctorSchedule.countDocuments({
        doctor_id: user._id,
        is_deleted: false,
        work_date: { $gte: new Date() },
        status: { $in: ['draft', 'published', 'active'] },
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

    if (futureSchedules || futureAppointments || openEncounters) {
      throw ApiError.conflict('Không thể chuyển department bác sĩ khi còn lịch/hẹn/encounter active.', {
        future_schedules: futureSchedules,
        future_appointments: futureAppointments,
        open_encounters: openEncounters,
      });
    }
  }

  const before = user.toObject();
  user.department_id = department._id;
  user.permission_version = Number(user.permission_version || 1) + 1;
  user.updated_by = getActorId(actor);
  await user.save();

  await DoctorProfile.updateOne(
    { user_id: user._id, is_deleted: false },
    {
      $set: {
        department_id: department._id,
        updated_by: getActorId(actor),
      },
    },
  );

  await recordAuditLog({
    actor,
    action: 'users.transfer_department',
    targetType: 'user',
    targetId: user._id,
    before,
    after: user,
    status: 'success',
    message: 'Chuyển department staff thành công.',
    requestMeta,
    metadata: {
      from_department_id: before.department_id ? String(before.department_id) : null,
      to_department_id: String(department._id),
    },
  });

  await authService.invalidateAllUserSessions('staff', user._id, requestMeta, {
    actorType: actor.actorType,
    actorId: getActorId(actor),
    reason: 'department_changed',
  });

  return getStaffAccountDetail(user._id, actor);
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
    blocking_reasons: [
      headDepartments ? `Staff đang là trưởng khoa/phòng của ${headDepartments} department.` : null,
      activeSchedules ? `Staff đang có ${activeSchedules} lịch làm việc active/published.` : null,
      futureAppointments ? `Staff đang có ${futureAppointments} lịch hẹn tương lai.` : null,
      openEncounters ? `Staff đang có ${openEncounters} encounter chưa hoàn tất.` : null,
    ].filter(Boolean),
    blockers: {
      head_departments: headDepartments,
      active_schedules: activeSchedules,
      future_appointments: futureAppointments,
      open_encounters: openEncounters,
    },
    warnings: [
      'Nếu staff đã có dữ liệu lịch sử, hệ thống chỉ nên soft delete và giữ nguyên liên kết nghiệp vụ.',
    ],
  };
}

module.exports = {
  // generateInitialStaffPassword: Sinh/tạo mật khẩu ban đầu cho nhân sự.
  generateInitialStaffPassword,
  // requirePasswordChangeOnFirstLogin: Đánh dấu tài khoản phải đổi mật khẩu ở lần đăng nhập đầu tiên.
  requirePasswordChangeOnFirstLogin,
  // validateStaffCreationPayload: Kiểm tra tính hợp lệ của dữ liệu tạo nhân sự.
  validateStaffCreationPayload,
  // validateStaffStatusTransition: Kiểm tra tính hợp lệ của chuyển trạng thái nhân sự.
  validateStaffStatusTransition,
  // createStaffAccount: Tạo tài khoản nhân sự.
  createStaffAccount,
  // listStaffAccounts: Liệt kê tài khoản nhân sự.
  listStaffAccounts,
  // searchStaffAccounts: Tìm kiếm tài khoản nhân sự.
  searchStaffAccounts,
  // filterStaffAccounts: Lọc tài khoản nhân sự.
  filterStaffAccounts,
  // getStaffAccountDetail: Lấy chi tiết tài khoản nhân sự.
  getStaffAccountDetail,
  // updateStaffAccount: Cập nhật tài khoản nhân sự.
  updateStaffAccount,
  // updateStaffAccountStatus: Cập nhật trạng thái tài khoản nhân sự.
  updateStaffAccountStatus,
  // activateStaffAccount: Kích hoạt tài khoản nhân sự.
  activateStaffAccount,
  // deactivateStaffAccount: Vô hiệu hóa tài khoản nhân sự.
  deactivateStaffAccount,
  // unlockStaffAccount: Mở khóa tài khoản nhân sự.
  unlockStaffAccount,
  // resetStaffPassword: Đặt lại mật khẩu nhân sự.
  resetStaffPassword,
  // deleteStaffAccountSoft: Xóa mềm tài khoản nhân sự.
  deleteStaffAccountSoft,
  // assignRolesToStaff: Gán vai trò cho tài khoản nhân sự.
  assignRolesToStaff,
  // removeRolesFromStaff: Gỡ/xóa vai trò từ nhân sự.
  removeRolesFromStaff,
  // syncStaffRoles: Đồng bộ vai trò của nhân sự.
  syncStaffRoles,
  // getStaffRoles: Lấy vai trò của nhân sự.
  getStaffRoles,
  // getStaffPermissions: Lấy quyền của nhân sự.
  getStaffPermissions,
  // checkStaffPermission: Kiểm tra quyền của nhân sự.
  checkStaffPermission,
  // getUsersByRole: Lấy người dùng theo vai trò.
  getUsersByRole,
  // getStaffByDepartment: Lấy nhân sự theo khoa/phòng ban.
  getStaffByDepartment,
  // getDoctorsList: Lấy danh sách bác sĩ.
  getDoctorsList,
  // getAssignableStaffRoles: Lấy vai trò nhân sự có thể gán.
  getAssignableStaffRoles,
  // getStaffLoginHistory: Lấy nhân sự đăng nhập lịch sử.
  getStaffLoginHistory,
  // getStaffAuditLogs: Lấy nhật ký kiểm toán của nhân sự.
  getStaffAuditLogs,
  // getStaffSummary: Lấy tổng hợp nhân sự.
  getStaffSummary,
  // transferStaffDepartment: Chuyển nhân sự khoa/phòng ban.
  transferStaffDepartment,
  // checkStaffCanBeDeleted: Kiểm tra điều kiện xóa nhân sự.
  checkStaffCanBeDeleted,
  // forceLogoutStaff: Buộc đăng xuất nhân sự.
  forceLogoutStaff,
  // sendStaffAccountNotification: Gửi thông báo liên quan đến tài khoản nhân sự.
  sendStaffAccountNotification,
};
