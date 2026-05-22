const { randomInt } = require('crypto');
const ApiError = require('../common/errors/api-error');
const { mongoose } = require('../config/database');
const {
  Appointment,
  AuthSession,
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

const HIGH_PRIVILEGE_ROLE_CODES = new Set([
  ROLE_CODE.SUPER_ADMIN,
  ROLE_CODE.ADMIN,
  ROLE_CODE.DEPARTMENT_HEAD,
].filter(Boolean));

const LOGIN_AUDIT_ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.refresh_token',
  'auth.session.revoke',
];

function parseBooleanFlag(value) {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return null;
}

function serializeStaffSession(session, currentSessionId = null) {
  const isActive = !session.revoked_at && session.expires_at > new Date();
  const riskFlags = [
    session.revoked_reason === 'refresh_token_reuse' ? 'refresh_token_reuse' : null,
    session.last_ip && session.created_ip && session.last_ip !== session.created_ip ? 'ip_changed' : null,
    isActive && session.expires_at < new Date(Date.now() + 24 * 60 * 60 * 1000) ? 'expires_soon' : null,
  ].filter(Boolean);

  return {
    session_id: String(session._id),
    actor_type: session.actor_type,
    actor_id: session.actor_id ? String(session.actor_id) : null,
    permission_version: session.permission_version || 1,
    device_id: session.device_id,
    device_name: session.device_name,
    browser: session.browser,
    os: session.os,
    location: session.location,
    login_method: session.login_method,
    created_ip: session.created_ip,
    last_ip: session.last_ip,
    ip_address: session.ip_address,
    user_agent: session.user_agent,
    created_at: session.created_at,
    last_used_at: session.last_used_at,
    expires_at: session.expires_at,
    revoked_at: session.revoked_at,
    revoked_reason: session.revoked_reason,
    is_current: currentSessionId ? String(session._id) === String(currentSessionId) : false,
    is_active: isActive,
    risk_flags: riskFlags,
  };
}

function riskLevelFromScore(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
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
    'status',
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
  if (input.status && !['active', 'suspended', 'disabled'].includes(input.status)) {
    throw ApiError.validation('Trạng thái ban đầu của staff không hợp lệ.');
  }

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

  if (query.status === 'pending_activation' || parseBooleanFlag(query.pending_activation) === true) {
    filter.status = 'active';
    filter.must_change_password = true;
    filter.last_login_at = null;
  } else if (query.status) {
    filter.status = query.status;
  }
  const mustChangePassword = parseBooleanFlag(query.must_change_password);
  if (mustChangePassword !== null) filter.must_change_password = mustChangePassword;
  const neverLoggedIn = parseBooleanFlag(query.never_logged_in);
  if (neverLoggedIn === true) filter.last_login_at = null;
  if (neverLoggedIn === false && !filter.last_login_at) filter.last_login_at = { $ne: null };
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
  const [departments, activeSessionCounts] = await Promise.all([
    Department.find({ _id: { $in: departmentIds }, is_deleted: false }).lean(),
    AuthSession.aggregate([
      {
        $match: {
          actor_type: 'staff',
          actor_id: { $in: users.map((user) => user._id) },
          revoked_at: null,
          expires_at: { $gt: new Date() },
        },
      },
      { $group: { _id: '$actor_id', count: { $sum: 1 } } },
    ]),
  ]);
  const departmentMap = new Map(departments.map((department) => [String(department._id), department]));
  const activeSessionMap = new Map(activeSessionCounts.map((item) => [String(item._id), item.count]));

  const items = await Promise.all(users.map(async (user) => {
    const roles = await buildUserRoleDetails(user._id);
    const department = user.department_id ? departmentMap.get(String(user.department_id)) : null;
    const roleCodes = roles.map((role) => role.role_code);
    const isPendingActivation = user.status === 'active' && user.must_change_password && !user.last_login_at;
    return {
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      employee_code: user.employee_code,
      department_id: user.department_id ? String(user.department_id) : null,
      department_name: department?.department_name || null,
      department: department ? {
        department_id: String(department._id),
        department_name: department.department_name,
        department_code: department.department_code,
      } : null,
      roles: roleCodes,
      role_details: roles,
      status: user.status,
      activation_status: isPendingActivation ? 'pending_activation' : 'activated',
      must_change_password: user.must_change_password,
      failed_login_attempts: user.failed_login_attempts || 0,
      locked_until: user.locked_until,
      last_login_at: user.last_login_at,
      last_login_ip: user.last_login_ip,
      auth_provider: user.auth_provider,
      active_session_count: activeSessionMap.get(String(user._id)) || 0,
      high_privilege: roleCodes.some((roleCode) => HIGH_PRIVILEGE_ROLE_CODES.has(roleCode)),
      created_at: user.created_at,
      updated_at: user.updated_at,
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
  const scopedUserIdsPromise = scope.department_id
    ? User.find({ department_id: scope.department_id, is_deleted: false }).distinct('_id')
    : Promise.resolve(null);

  const [
    total,
    active,
    locked,
    disabled,
    suspended,
    pendingActivation,
    mustChangePassword,
    neverLoggedIn,
    roles,
    departments,
    scopedUserIds,
  ] = await Promise.all([
    User.countDocuments({ is_deleted: false, ...scope }),
    User.countDocuments({ is_deleted: false, status: 'active', ...scope }),
    User.countDocuments({ is_deleted: false, status: 'locked', ...scope }),
    User.countDocuments({ is_deleted: false, status: 'disabled', ...scope }),
    User.countDocuments({ is_deleted: false, status: 'suspended', ...scope }),
    User.countDocuments({ is_deleted: false, status: 'active', must_change_password: true, last_login_at: null, ...scope }),
    User.countDocuments({ is_deleted: false, must_change_password: true, ...scope }),
    User.countDocuments({ is_deleted: false, last_login_at: null, ...scope }),
    Role.find({ is_deleted: false }).lean(),
    Department.find({ is_deleted: false, ...(scope.department_id ? { _id: scope.department_id } : {}) }).lean(),
    scopedUserIdsPromise,
  ]);

  const role_breakdown = await Promise.all(
    roles.map(async (role) => ({
      role_code: role.role_code,
      count: await UserRole.countDocuments({
        role_id: role._id,
        is_active: true,
        ...(scopedUserIds ? { user_id: { $in: scopedUserIds } } : {}),
      }),
    })),
  );

  const highPrivilegeRoleIds = roles
    .filter((role) => HIGH_PRIVILEGE_ROLE_CODES.has(role.role_code))
    .map((role) => role._id);
  const highPrivilegeUserIds = highPrivilegeRoleIds.length
    ? await UserRole.find({
      role_id: { $in: highPrivilegeRoleIds },
      is_active: true,
      ...(scopedUserIds ? { user_id: { $in: scopedUserIds } } : {}),
    }).distinct('user_id')
    : [];

  const [activeSessionActorIds, riskAccountCount] = await Promise.all([
    AuthSession.distinct('actor_id', {
      actor_type: 'staff',
      revoked_at: null,
      expires_at: { $gt: new Date() },
      ...(scopedUserIds ? { actor_id: { $in: scopedUserIds } } : {}),
    }),
    User.countDocuments({
      is_deleted: false,
      ...scope,
      $or: [
        { status: 'locked' },
        { failed_login_attempts: { $gte: 3 } },
        { locked_until: { $gt: new Date() } },
        { password_expired_at: { $lte: new Date() } },
        ...(highPrivilegeUserIds.length ? [{ _id: { $in: highPrivilegeUserIds } }] : []),
      ],
    }),
  ]);

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
    pending_activation_count: pendingActivation,
    must_change_password_count: mustChangePassword,
    never_logged_in_count: neverLoggedIn,
    active_session_count: activeSessionActorIds.length,
    high_privilege_count: highPrivilegeUserIds.length,
    risk_account_count: riskAccountCount,
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

async function getStaffDependencies(userId, actor = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  assertCanAccessStaff(user, actor);

  const [deleteCheck, doctorProfile, activeSessions, allSessions] = await Promise.all([
    checkStaffCanBeDeleted(user._id),
    DoctorProfile.findOne({ user_id: user._id, is_deleted: false }).lean(),
    AuthSession.countDocuments({
      actor_type: 'staff',
      actor_id: user._id,
      revoked_at: null,
      expires_at: { $gt: new Date() },
    }),
    AuthSession.countDocuments({ actor_type: 'staff', actor_id: user._id }),
  ]);

  return {
    user_id: String(user._id),
    can_delete: deleteCheck.can_delete,
    can_deactivate: deleteCheck.blockers.head_departments === 0,
    can_transfer: deleteCheck.can_delete,
    blocking_reasons: deleteCheck.blocking_reasons,
    blockers: {
      ...deleteCheck.blockers,
      active_sessions: activeSessions,
      all_sessions: allSessions,
      has_doctor_profile: Boolean(doctorProfile),
      doctor_profile_status: doctorProfile?.status || null,
    },
    recommendations: [
      activeSessions ? 'Thu hồi phiên đăng nhập trước khi xử lý tác vụ bảo mật nhạy cảm.' : null,
      deleteCheck.blockers.head_departments ? 'Gỡ hoặc đổi trưởng khoa/phòng trước khi chuyển/xóa nhân sự.' : null,
      deleteCheck.blockers.future_appointments || deleteCheck.blockers.active_schedules
        ? 'Hoàn tất hoặc điều phối lại lịch/hẹn trước khi điều chuyển.'
        : null,
    ].filter(Boolean),
  };
}

async function getStaffSessions(userId, query = {}, actor = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  assertCanAccessStaff(user, actor);

  const { page, limit, skip } = getPagination(query);
  const activeOnly = parseBooleanFlag(query.active_only);
  const filter = {
    actor_type: 'staff',
    actor_id: user._id,
  };
  if (activeOnly === true) {
    filter.revoked_at = null;
    filter.expires_at = { $gt: new Date() };
  }

  const [sessions, total, activeCount] = await Promise.all([
    AuthSession.find(filter).sort({ last_used_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    AuthSession.countDocuments(filter),
    AuthSession.countDocuments({
      actor_type: 'staff',
      actor_id: user._id,
      revoked_at: null,
      expires_at: { $gt: new Date() },
    }),
  ]);

  return {
    user_id: String(user._id),
    active_count: activeCount,
    items: sessions.map((session) => serializeStaffSession(session, actor.sessionId || actor.session_id)),
    pagination: buildPagination(page, limit, total),
  };
}

async function revokeStaffSession(userId, sessionId, actor = {}, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  await assertCanManageTargetStaff(user, actor, 'thu hồi phiên của');

  const session = await AuthSession.findById(sessionId).lean();
  if (!session || String(session.actor_id) !== String(user._id) || session.actor_type !== 'staff') {
    throw createError('Không tìm thấy phiên đăng nhập của nhân sự này.', 404);
  }

  return authService.revokeRefreshToken({ session_id: sessionId }, actor, requestMeta);
}

async function revokeAllStaffSessions(userId, actor = {}, requestMeta = {}) {
  return forceLogoutStaff(userId, actor, requestMeta);
}

async function validateStaffUnique(query = {}) {
  const username = normalizeLower(query.username);
  const email = normalizeLower(query.email);
  const phone = normalizePhone(query.phone);
  const employeeCode = query.employee_code ? String(query.employee_code).trim().toUpperCase() : '';
  const excludeId = query.exclude_user_id || query.user_id;

  const makeUserFilter = (field, value) => ({
    is_deleted: false,
    [field]: value,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

  const [usernameUser, emailUser, phoneUser, employeeUser, emailPatient, phonePatient] = await Promise.all([
    username ? User.findOne(makeUserFilter('username', username)).lean() : null,
    email ? User.findOne(makeUserFilter('email', email)).lean() : null,
    phone ? User.findOne(makeUserFilter('phone', phone)).lean() : null,
    employeeCode ? User.findOne(makeUserFilter('employee_code', employeeCode)).lean() : null,
    email ? PatientAccount.findOne({ email, is_deleted: false }).lean() : null,
    phone ? PatientAccount.findOne({ phone, is_deleted: false }).lean() : null,
  ]);

  return {
    username: { value: username, available: !username || !usernameUser, conflict_type: usernameUser ? 'staff' : null },
    email: {
      value: email,
      available: !email || (!emailUser && !emailPatient),
      conflict_type: emailUser ? 'staff' : emailPatient ? 'patient' : null,
    },
    phone: {
      value: phone,
      available: !phone || (!phoneUser && !phonePatient),
      conflict_type: phoneUser ? 'staff' : phonePatient ? 'patient' : null,
    },
    employee_code: {
      value: employeeCode,
      available: !employeeCode || !employeeUser,
      conflict_type: employeeUser ? 'staff' : null,
    },
  };
}

function normalizeUsernameBase(value = '') {
  const parts = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return `staff${randomInt(1000, 9999)}`;
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map((part) => part[0]).join('');
  return `${last}${initials}`.slice(0, 24);
}

async function generateStaffUsername(payload = {}) {
  const base = normalizeUsernameBase(payload.full_name || payload.email || payload.phone || 'staff');
  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? base : `${base}${index + 1}`;
    const exists = await User.exists({ username: candidate, is_deleted: false });
    if (!exists) return { username: candidate };
  }
  return { username: `${base}${randomInt(1000, 9999)}` };
}

async function generateStaffEmployeeCode(payload = {}) {
  let prefix = 'NV';
  if (payload.department_id && mongoose.Types.ObjectId.isValid(payload.department_id)) {
    const department = await Department.findById(payload.department_id).lean();
    if (department?.department_code) prefix = String(department.department_code).replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8) || prefix;
  }

  for (let index = 0; index < 30; index += 1) {
    const candidate = `${prefix}-${String(randomInt(1, 99999)).padStart(5, '0')}`;
    const exists = await User.exists({ employee_code: candidate, is_deleted: false });
    if (!exists) return { employee_code: candidate };
  }
  return { employee_code: `${prefix}-${Date.now().toString().slice(-6)}` };
}

async function buildStaffRiskProfile(user, actor = {}) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [roles, activeSessions, recentFailedLogins, recentRoleChanges, recentPasswordResets, recentForceLogouts] =
    await Promise.all([
      buildUserRoleDetails(user._id),
      AuthSession.find({
        actor_type: 'staff',
        actor_id: user._id,
        revoked_at: null,
        expires_at: { $gt: new Date() },
      }).sort({ last_used_at: -1 }).lean(),
      AuditLog.countDocuments({
        actor_type: 'staff',
        actor_id: user._id,
        action: 'auth.login_failed',
        created_at: { $gte: since24h },
      }),
      AuditLog.countDocuments({
        target_type: 'user',
        target_id: user._id,
        action: { $in: ['users.assign_roles', 'iam.user_roles.sync', 'users.remove_roles'] },
        created_at: { $gte: since7d },
      }),
      AuditLog.countDocuments({
        target_type: 'user',
        target_id: user._id,
        action: { $in: ['users.reset_password', 'auth.staff.reset_password'] },
        created_at: { $gte: since7d },
      }),
      AuditLog.countDocuments({
        target_type: 'user',
        target_id: user._id,
        action: { $in: ['auth.staff.force_logout', 'auth.sessions.invalidate_all'] },
        created_at: { $gte: since7d },
      }),
    ]);

  const roleCodes = roles.map((role) => role.role_code);
  const highPrivilege = roleCodes.some((roleCode) => HIGH_PRIVILEGE_ROLE_CODES.has(roleCode));
  const distinctIps = new Set(activeSessions.map((session) => session.last_ip || session.ip_address || session.created_ip).filter(Boolean));
  const passwordAgeDays = user.password_changed_at
    ? Math.floor((Date.now() - new Date(user.password_changed_at).getTime()) / (24 * 60 * 60 * 1000))
    : null;

  let score = 0;
  const reasons = [];
  if (user.status === 'locked' || (user.locked_until && user.locked_until > new Date())) {
    score += 28;
    reasons.push('Tài khoản đang bị khóa hoặc còn thời hạn khóa.');
  }
  if ((user.failed_login_attempts || 0) >= 5) {
    score += 24;
    reasons.push(`${user.failed_login_attempts} lần đăng nhập thất bại đang được ghi nhận.`);
  } else if ((user.failed_login_attempts || 0) >= 3) {
    score += 14;
    reasons.push(`${user.failed_login_attempts} lần đăng nhập thất bại gần đây.`);
  }
  if (recentFailedLogins >= 5) {
    score += 18;
    reasons.push(`${recentFailedLogins} login failed trong 24 giờ.`);
  }
  if (activeSessions.length >= 5) {
    score += 12;
    reasons.push(`${activeSessions.length} phiên active đồng thời.`);
  } else if (activeSessions.length >= 3) {
    score += 6;
    reasons.push(`${activeSessions.length} phiên active cần theo dõi.`);
  }
  if (distinctIps.size >= 3) {
    score += 12;
    reasons.push(`Phiên active từ ${distinctIps.size} IP khác nhau.`);
  }
  if (highPrivilege) {
    score += 12;
    reasons.push('Tài khoản có role nhạy cảm.');
  }
  if (recentRoleChanges > 0) {
    score += 10;
    reasons.push('Vai trò/quyền vừa thay đổi trong 7 ngày.');
  }
  if (recentPasswordResets >= 2) {
    score += 8;
    reasons.push('Có nhiều lần reset mật khẩu trong 7 ngày.');
  }
  if (recentForceLogouts > 0) {
    score += 5;
    reasons.push('Đã từng bị force logout gần đây.');
  }
  if (passwordAgeDays !== null && passwordAgeDays > 90) {
    score += 8;
    reasons.push(`Mật khẩu đã ${passwordAgeDays} ngày chưa đổi.`);
  }
  if (user.must_change_password && !user.last_login_at) {
    score += 6;
    reasons.push('Tài khoản mới chưa đăng nhập và đang phải đổi mật khẩu.');
  }

  score = Math.min(score, 100);
  const recommendedActions = [
    score >= 60 ? 'force_logout' : null,
    score >= 45 || user.must_change_password ? 'require_password_change' : null,
    score >= 75 ? 'review_roles' : null,
    user.status === 'locked' ? 'unlock_after_review' : null,
  ].filter(Boolean);

  return {
    user_id: String(user._id),
    risk_score: score,
    risk_level: riskLevelFromScore(score),
    reasons: reasons.length ? reasons : ['Không có tín hiệu rủi ro đáng kể từ dữ liệu hiện có.'],
    recommended_actions: [...new Set(recommendedActions)],
    signals: {
      failed_login_attempts: user.failed_login_attempts || 0,
      recent_failed_logins_24h: recentFailedLogins,
      active_session_count: activeSessions.length,
      distinct_active_ip_count: distinctIps.size,
      high_privilege: highPrivilege,
      recent_role_changes_7d: recentRoleChanges,
      recent_password_resets_7d: recentPasswordResets,
      recent_force_logouts_7d: recentForceLogouts,
      password_age_days: passwordAgeDays,
    },
    roles: roleCodes,
    sessions: activeSessions.slice(0, 5).map((session) => serializeStaffSession(session, actor.sessionId || actor.session_id)),
  };
}

async function getStaffRiskProfile(userId, actor = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  assertCanAccessStaff(user, actor);
  const [department, profile] = await Promise.all([
    user.department_id ? Department.findById(user.department_id).lean() : null,
    buildStaffRiskProfile(user, actor),
  ]);

  return {
    ...profile,
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
      last_login_at: user.last_login_at,
      last_login_ip: user.last_login_ip,
    },
  };
}

async function listRiskAccounts(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildStaffFilter(query, actor);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ updated_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const departmentIds = users.map((user) => user.department_id).filter(Boolean);
  const departments = await Department.find({ _id: { $in: departmentIds }, is_deleted: false }).lean();
  const departmentMap = new Map(departments.map((department) => [String(department._id), department.department_name]));
  const profiles = await Promise.all(users.map((user) => buildStaffRiskProfile(user, actor)));
  const minScore = Number(query.min_score || 0);
  const riskLevel = query.risk_level || query.risk;

  const paired = profiles.map((profile, index) => ({ profile, user: users[index] }));

  return {
    items: paired
      .filter(({ profile }) => profile.risk_score >= minScore)
      .filter(({ profile }) => !riskLevel || riskLevel === 'all' || profile.risk_level === riskLevel || (riskLevel === 'high' && ['high', 'critical'].includes(profile.risk_level)))
      .map(({ profile, user }) => {
        return {
          ...profile,
          user: {
            user_id: String(user._id),
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            employee_code: user.employee_code,
            department_id: user.department_id ? String(user.department_id) : null,
            department_name: user.department_id ? departmentMap.get(String(user.department_id)) || null : null,
            status: user.status,
            last_login_at: user.last_login_at,
          },
        };
      }),
    pagination: buildPagination(page, limit, total),
  };
}

async function listPendingActivationAccounts(query = {}, actor = {}) {
  const result = await listStaffAccounts({ ...query, status: 'pending_activation' }, actor);
  return {
    ...result,
    items: result.items.map((item) => ({
      ...item,
      invitation_status: 'not_configured',
      invitation_expires_at: null,
      activation_age_hours: item.created_at
        ? Math.floor((Date.now() - new Date(item.created_at).getTime()) / (60 * 60 * 1000))
        : null,
    })),
  };
}

async function getGlobalStaffLoginHistory(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {
    actor_type: 'staff',
    action: query.action || { $in: LOGIN_AUDIT_ACTIONS },
  };
  if (query.status) filter.status = query.status;
  if (query.ip) filter.ip_address = query.ip;
  if (query.from || query.to) {
    filter.created_at = {};
    if (query.from) filter.created_at.$gte = new Date(query.from);
    if (query.to) filter.created_at.$lte = new Date(query.to);
  }

  if (query.user_id) {
    const user = await User.findById(query.user_id).lean();
    if (!user || user.is_deleted) throw createError('Không tìm thấy tài khoản nhân sự.', 404);
    assertCanAccessStaff(user, actor);
    filter.actor_id = user._id;
  } else {
    const staffFilter = await buildStaffFilter({
      keyword: query.keyword || query.search,
      department_id: query.department_id,
      role_code: query.role_code,
    }, actor);
    const needsStaffFilter = Object.keys(staffFilter).some((key) => key !== 'is_deleted');
    if (needsStaffFilter) {
      const scopedUserIds = await User.find(staffFilter).distinct('_id');
      filter.actor_id = { $in: scopedUserIds };
    }
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const users = await User.find({ _id: { $in: items.map((item) => item.actor_id).filter(Boolean) } }).lean();
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return {
    items: items.map((item) => {
      const user = item.actor_id ? userMap.get(String(item.actor_id)) : null;
      return {
        ...item,
        actor: user ? {
          user_id: String(user._id),
          username: user.username,
          full_name: user.full_name,
          department_id: user.department_id ? String(user.department_id) : null,
          status: user.status,
        } : null,
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

async function markStaffRiskReviewed(userId, payload = {}, actor = {}, requestMeta = {}) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }
  assertCanAccessStaff(user, actor);
  await recordAuditLog({
    actor,
    action: 'users.risk_reviewed',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Đánh dấu risk profile của staff đã được rà soát.',
    requestMeta,
    metadata: {
      note: payload.note,
      risk_level: payload.risk_level,
      risk_score: payload.risk_score,
    },
  });
  return { success: true, reviewed_at: new Date() };
}

async function runStaffSecurityAction(userId, payload = {}, actor = {}, requestMeta = {}) {
  const action = payload.action;
  if (action === 'force_logout') return forceLogoutStaff(userId, actor, requestMeta);
  if (action === 'require_password_change') return requirePasswordChangeOnFirstLogin(userId, actor, requestMeta);
  if (action === 'lock') return updateStaffAccountStatus(userId, 'locked', actor, requestMeta);
  if (action === 'disable') return updateStaffAccountStatus(userId, 'disabled', actor, requestMeta);
  if (action === 'unlock') return unlockStaffAccount(userId, actor, requestMeta);
  if (action === 'activate') return activateStaffAccount(userId, actor, requestMeta);
  throw ApiError.validation('security action không được hỗ trợ.');
}

async function bulkStaffAction(payload = {}, actor = {}, requestMeta = {}) {
  const action = payload.action;
  const userIds = [...new Set((payload.user_ids || payload.userIds || []).map(String).filter(Boolean))];
  if (!action || userIds.length === 0) {
    throw ApiError.validation('action và user_ids là bắt buộc.');
  }
  if (userIds.length > 100) {
    throw ApiError.validation('Mỗi bulk action chỉ hỗ trợ tối đa 100 tài khoản.');
  }

  const results = [];
  for (const userId of userIds) {
    try {
      let data;
      if (action === 'activate') data = await activateStaffAccount(userId, actor, requestMeta);
      else if (action === 'deactivate') data = await deactivateStaffAccount(userId, actor, requestMeta);
      else if (action === 'unlock') data = await unlockStaffAccount(userId, actor, requestMeta);
      else if (action === 'force_logout') data = await forceLogoutStaff(userId, actor, requestMeta);
      else if (action === 'require_password_change') data = await requirePasswordChangeOnFirstLogin(userId, actor, requestMeta);
      else if (action === 'status') data = await updateStaffAccountStatus(userId, payload.status, actor, requestMeta);
      else if (action === 'assign_roles') data = await assignRolesToStaff(userId, payload.role_codes || [], actor, requestMeta);
      else if (action === 'remove_roles') data = await removeRolesFromStaff(userId, payload.role_codes || [], actor, requestMeta);
      else if (action === 'transfer_department') data = await transferStaffDepartment(userId, payload.department_id, actor, requestMeta);
      else throw ApiError.validation('bulk action không được hỗ trợ.');
      results.push({ user_id: userId, success: true, data });
    } catch (error) {
      results.push({ user_id: userId, success: false, message: error.message });
    }
  }

  await recordAuditLog({
    actor,
    action: 'users.bulk_action',
    targetType: 'user',
    status: 'success',
    message: 'Thực hiện bulk staff action.',
    requestMeta,
    metadata: {
      action,
      total: userIds.length,
      succeeded: results.filter((item) => item.success).length,
      failed: results.filter((item) => !item.success).length,
    },
  });

  return {
    action,
    total: userIds.length,
    succeeded: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
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
  // listPendingActivationAccounts: Liệt kê tài khoản đang chờ kích hoạt theo suy luận bảo mật hiện có.
  listPendingActivationAccounts,
  // validateStaffUnique: Kiểm tra trùng username/email/phone/employee_code cho UI realtime.
  validateStaffUnique,
  // generateStaffUsername: Gợi ý username duy nhất cho nhân sự.
  generateStaffUsername,
  // generateStaffEmployeeCode: Gợi ý mã nhân sự duy nhất.
  generateStaffEmployeeCode,
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
  // getStaffSessions: Lấy danh sách phiên đăng nhập của nhân sự.
  getStaffSessions,
  // revokeStaffSession: Thu hồi một phiên đăng nhập của nhân sự.
  revokeStaffSession,
  // revokeAllStaffSessions: Thu hồi toàn bộ phiên đăng nhập của nhân sự.
  revokeAllStaffSessions,
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
  // getGlobalStaffLoginHistory: Lấy lịch sử đăng nhập toàn hệ thống cho nhân sự.
  getGlobalStaffLoginHistory,
  // getStaffAuditLogs: Lấy nhật ký kiểm toán của nhân sự.
  getStaffAuditLogs,
  // getStaffSummary: Lấy tổng hợp nhân sự.
  getStaffSummary,
  // transferStaffDepartment: Chuyển nhân sự khoa/phòng ban.
  transferStaffDepartment,
  // getStaffDependencies: Preview phụ thuộc nghiệp vụ trước khi deactivate/delete/transfer.
  getStaffDependencies,
  // checkStaffCanBeDeleted: Kiểm tra điều kiện xóa nhân sự.
  checkStaffCanBeDeleted,
  // listRiskAccounts: Liệt kê tài khoản rủi ro.
  listRiskAccounts,
  // getStaffRiskProfile: Lấy risk profile cho một tài khoản.
  getStaffRiskProfile,
  // markStaffRiskReviewed: Đánh dấu risk profile đã rà soát.
  markStaffRiskReviewed,
  // runStaffSecurityAction: Chạy security action theo risk recommendation.
  runStaffSecurityAction,
  // bulkStaffAction: Thực hiện thao tác hàng loạt trên nhân sự.
  bulkStaffAction,
  // forceLogoutStaff: Buộc đăng xuất nhân sự.
  forceLogoutStaff,
  // sendStaffAccountNotification: Gửi thông báo liên quan đến tài khoản nhân sự.
  sendStaffAccountNotification,
};
