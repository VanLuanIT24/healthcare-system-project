const ApiError = require('../../common/errors/api-error');
const env = require('../../config/env');
const { normalizeLowercase, normalizePhone, normalizeString } = require('../../common/helpers/string.helper');
const { normalizePagination, buildPaginationMeta } = require('../../common/helpers/pagination.helper');
const { buildRegexSearch } = require('../../common/helpers/query.helper');
const { ROLE_CODE } = require('../../constants/permissions');
const { AUDIT_STATUS, REALTIME_EVENT_TYPE } = require('../../constants/statuses');
const { STAFF_TRANSITIONS } = require('../../constants/transitions');
const { PatientAccount, Permission, Role, RolePermission, User, UserRole } = require('../../models');
const { assertTransition } = require('../../shared/utils/status-transition');
const { withOptionalTransaction } = require('../../shared/utils/transaction');
const auditService = require('../audit.service');
const { buildUserPermissionMap, buildUserRoleDetails, bumpUserPermissionVersion } = require('../access-control.service');
const permissionService = require('../permission.service');
const sessionService = require('./auth-session.service');
const {
  ACTOR_TYPE,
  AUTH_MESSAGES,
  STAFF_MANAGED_STATUSES,
  getActorId,
  isSuperAdmin,
} = require('./auth.policy');
const loginSecurity = require('./login-security.service');
const passwordService = require('./password.service');
const rateLimitService = require('./rate-limit.service');
const tokenService = require('./token.service');
const eventBus = require('../../events/event-bus.service');

function buildStaffIdentifierFilter(identifier) {
  const raw = normalizeString(identifier);
  const lower = normalizeLowercase(identifier);
  const phone = normalizePhone(identifier);

  return {
    is_deleted: false,
    $or: [
      { username: raw },
      { email: lower },
      { employee_code: raw },
      { phone },
    ].filter((item) => Object.values(item)[0]),
  };
}

async function findStaffByIdentifier(identifier) {
  return User.findOne(buildStaffIdentifierFilter(identifier));
}

async function getStaffAuthorization(userId) {
  const [roles, permissionSet] = await Promise.all([
    buildUserRoleDetails(userId),
    buildUserPermissionMap(userId),
  ]);

  return {
    roles,
    roleCodes: roles.map((role) => role.role_code),
    permissionCodes: [...permissionSet],
  };
}

function sanitizeStaff(user, authorization = { roleCodes: [], permissionCodes: [] }) {
  const plain = typeof user.toObject === 'function' ? user.toObject() : user;

  return {
    id: String(plain._id || plain.id),
    user_id: String(plain._id || plain.id),
    username: plain.username,
    full_name: plain.full_name,
    email: plain.email,
    phone: plain.phone,
    avatar_url: plain.avatar_url,
    date_of_birth: plain.date_of_birth,
    gender: plain.gender,
    address: plain.address,
    employee_code: plain.employee_code,
    department_id: plain.department_id,
    status: plain.status,
    must_change_password: Boolean(plain.must_change_password),
    password_changed_at: plain.password_changed_at,
    last_login_at: plain.last_login_at,
    last_login_ip: plain.last_login_ip,
    roles: authorization.roleCodes || [],
    permissions: authorization.permissionCodes || [],
  };
}

function assertActorCanAssignRoles(roleCodes = [], actor = {}) {
  if (roleCodes.includes(ROLE_CODE.SUPER_ADMIN) && !isSuperAdmin(actor)) {
    throw ApiError.forbidden('Chỉ super_admin mới được gán vai trò super_admin.');
  }
}

async function countActiveSuperAdmins() {
  const superAdminRole = await Role.findOne({
    role_code: ROLE_CODE.SUPER_ADMIN,
    status: 'active',
    is_deleted: false,
  }).lean();

  if (!superAdminRole) return 0;

  const assignments = await UserRole.find({
    role_id: superAdminRole._id,
    is_active: true,
  }).lean();

  if (!assignments.length) return 0;

  return User.countDocuments({
    _id: { $in: assignments.map((item) => item.user_id) },
    status: 'active',
    is_deleted: false,
  });
}

function ensureNotSelfManagedTarget(targetUserId, actor, actionLabel) {
  if (String(targetUserId) === String(getActorId(actor))) {
    throw ApiError.forbidden(`Bạn không được phép ${actionLabel} cho chính tài khoản của mình.`);
  }
}

async function ensureCanManageTargetUser(targetUserId, actor, actionLabel) {
  ensureNotSelfManagedTarget(targetUserId, actor, actionLabel);

  const authorization = await getStaffAuthorization(targetUserId);
  if (authorization.roleCodes.includes(ROLE_CODE.SUPER_ADMIN) && !isSuperAdmin(actor)) {
    throw ApiError.forbidden(`Chỉ super_admin mới được phép ${actionLabel} cho tài khoản super_admin.`);
  }

  return authorization.roleCodes;
}

async function createTokenResponse(user, requestMeta = {}, options = {}) {
  const authorization = await getStaffAuthorization(user._id);
  const refreshToken = tokenService.generateRefreshToken();
  const permissionVersion = Number(user.permission_version || 1);
  const session = await sessionService.createAuthSession(ACTOR_TYPE.STAFF, user._id, refreshToken, requestMeta, {
    permissionVersion,
  });
  const accessToken = tokenService.generateAccessToken({
    actorType: ACTOR_TYPE.STAFF,
    actorId: user._id,
    sessionId: session._id,
    permissionVersion,
  });
  const staff = sanitizeStaff(user, authorization);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: tokenService.getAccessTokenExpiresInSeconds(),
    actor_type: ACTOR_TYPE.STAFF,
    user: staff,
    roles: authorization.roleCodes,
    permissions: authorization.permissionCodes,
    permission_version: permissionVersion,
    must_change_password: Boolean(user.must_change_password),
    must_change_password_reason: options.mustChangePasswordReason || (user.must_change_password ? 'required' : null),
    tokens: {
      access_token: accessToken,
      refresh_token: refreshToken,
    },
  };
}

async function loginStaff(payload = {}, requestMeta = {}) {
  const identifier = payload.login || payload.username || payload.identifier;
  const password = payload.password;

  if (!identifier || !password) {
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  rateLimitService.checkLoginRateLimitByIp(requestMeta.ipAddress || requestMeta.ip);
  rateLimitService.checkLoginRateLimitByIdentifier(identifier, ACTOR_TYPE.STAFF);

  const user = await findStaffByIdentifier(identifier);
  if (!user) {
    await loginSecurity.recordLoginFailure(null, ACTOR_TYPE.STAFF, 'account_not_found', requestMeta);
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  try {
    await loginSecurity.checkAccountStatusBeforeLogin(user, ACTOR_TYPE.STAFF);
  } catch (error) {
    await loginSecurity.recordLoginFailure(user, ACTOR_TYPE.STAFF, `status_${user.status}`, requestMeta);
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  const isValidPassword = await passwordService.comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    await loginSecurity.recordLoginFailure(user, ACTOR_TYPE.STAFF, 'invalid_password', requestMeta);
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  const passwordExpired = passwordService.isPasswordExpired(user);
  if (passwordExpired) {
    user.must_change_password = true;
    await user.save();
  }

  await loginSecurity.recordLoginSuccess(user, ACTOR_TYPE.STAFF, requestMeta);
  return createTokenResponse(user, requestMeta, {
    mustChangePasswordReason: passwordExpired ? 'expired' : (user.must_change_password ? 'required' : null),
  });
}

async function createStaffAccount(payload = {}, actor = {}, requestMeta = {}) {
  const username = normalizeString(payload.username);
  const fullName = normalizeString(payload.full_name);
  const email = normalizeLowercase(payload.email);
  const phone = normalizePhone(payload.phone);
  const employeeCode = normalizeString(payload.employee_code);
  const password = payload.password || payload.temporary_password;
  const roleCodes = payload.role_codes || [];

  if (!username || !fullName || !password) {
    throw ApiError.validation('Missing required staff account fields.');
  }

  if (!Array.isArray(roleCodes) || roleCodes.length === 0) {
    throw ApiError.validation('Phải chọn ít nhất một vai trò cho tài khoản nhân sự.');
  }

  assertActorCanAssignRoles(roleCodes, actor);
  passwordService.validatePasswordPolicy({
    password,
    username,
    email,
    phone,
    actorType: ACTOR_TYPE.STAFF,
  });

  const duplicateFilter = {
    is_deleted: false,
    $or: [
      { username },
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
      ...(employeeCode ? [{ employee_code: employeeCode }] : []),
    ],
  };
  const existed = await User.findOne(duplicateFilter).lean();
  if (existed) {
    throw ApiError.conflict('Tên đăng nhập, email, số điện thoại hoặc mã nhân viên đã tồn tại.');
  }
  if (email || phone) {
    const patientAccount = await PatientAccount.findOne({
      is_deleted: false,
      $or: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    }).lean();
    if (patientAccount) {
      throw ApiError.conflict('Email hoặc số điện thoại đã được sử dụng bởi tài khoản bệnh nhân.');
    }
  }

  const roles = await Role.find({
    role_code: { $in: roleCodes },
    status: 'active',
    is_deleted: false,
  });
  if (roles.length !== roleCodes.length) {
    throw ApiError.badRequest('Có vai trò không hợp lệ hoặc đã bị vô hiệu hóa.');
  }

  const user = await withOptionalTransaction(async (session) => {
    const [createdUser] = await User.create(
      [{
        username,
        password_hash: await passwordService.hashPassword(password),
        password_expired_at: passwordService.calculatePasswordExpiry(ACTOR_TYPE.STAFF),
        full_name: fullName,
        email,
        phone,
        employee_code: employeeCode,
        department_id: payload.department_id,
        status: payload.status || 'active',
        must_change_password: payload.must_change_password !== false,
        password_changed_at: null,
        created_by: getActorId(actor),
      }],
      { session },
    );

    await UserRole.insertMany(
      roles.map((role) => ({
        user_id: createdUser._id,
        role_id: role._id,
        is_active: true,
        created_by: getActorId(actor),
      })),
      { session },
    );

    return createdUser;
  }, { fallbackToNoTransaction: env.nodeEnv !== 'production' });

  await auditService.recordAuditLog({
    actor,
    action: 'users.create',
    targetType: 'user',
    targetId: user._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Staff account created.',
    requestMeta,
    metadata: { role_codes: roleCodes },
  });

  return {
    user: sanitizeStaff(user, {
      roleCodes,
      permissionCodes: [],
    }),
  };
}

async function assignRolesToStaff({ user_id: userId, role_codes: roleCodes = [] } = {}, actor = {}, requestMeta = {}) {
  if (!userId || !Array.isArray(roleCodes) || roleCodes.length === 0) {
    throw ApiError.validation('user_id và role_codes là bắt buộc.');
  }

  assertActorCanAssignRoles(roleCodes, actor);
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');
  }

  const currentRoleCodes = await ensureCanManageTargetUser(user._id, actor, 'cập nhật vai trò');
  if (currentRoleCodes.includes(ROLE_CODE.SUPER_ADMIN) && !roleCodes.includes(ROLE_CODE.SUPER_ADMIN)) {
    const count = await countActiveSuperAdmins();
    if (count <= 1) {
      throw ApiError.conflict('Không thể gỡ vai trò super_admin khỏi tài khoản super_admin cuối cùng.');
    }
  }

  const roles = await Role.find({ role_code: { $in: roleCodes }, status: 'active', is_deleted: false });
  if (roles.length !== roleCodes.length) {
    throw ApiError.badRequest('Có vai trò không hợp lệ hoặc đã bị vô hiệu hóa.');
  }

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
  }, { fallbackToNoTransaction: env.nodeEnv !== 'production' });

  await bumpUserPermissionVersion(user._id);

  await sessionService.invalidateAllUserSessions(ACTOR_TYPE.STAFF, user._id, requestMeta, {
    actorType: actor.actorType,
    actorId: getActorId(actor),
    reason: 'role_changed',
  });

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.USER_ROLE_CHANGED,
    aggregateType: 'user',
    aggregateId: user._id,
    recipientScope: {
      user_id: user._id,
      actors: [{ actor_type: ACTOR_TYPE.STAFF, actor_id: user._id }],
    },
    payload: {
      user_id: String(user._id),
      role_codes: roleCodes,
      notification: {
        title: 'Quyền truy cập đã thay đổi',
        body: 'Vai trò của tài khoản đã được cập nhật. Vui lòng đăng nhập lại.',
        priority: 'high',
      },
    },
    idempotencyKey: `user.role_changed:${user._id}:${Date.now()}`,
  });

  const authorization = await getStaffAuthorization(user._id);
  await auditService.recordAuditLog({
    actor,
    action: 'users.assign_roles',
    targetType: 'user',
    targetId: user._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Staff roles updated.',
    requestMeta,
    metadata: { role_codes: roleCodes },
  });

  return {
    user: sanitizeStaff(user, authorization),
  };
}

async function listStaffAccounts(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const keyword = normalizeString(query.keyword || query.search);
  const filter = { is_deleted: false };

  if (query.status) filter.status = query.status;
  if (query.department_id) filter.department_id = query.department_id;

  if (keyword) {
    const regex = buildRegexSearch(keyword);
    filter.$or = [
      { username: regex },
      { full_name: regex },
      { email: regex },
      { phone: regex },
      { employee_code: regex },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return {
    items: users.map((user) => sanitizeStaff(user)),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function updateStaffAccountStatus({ user_id: userId, status } = {}, actor = {}, requestMeta = {}) {
  if (!userId || !status) {
    throw ApiError.validation('user_id và status là bắt buộc.');
  }

  if (!STAFF_MANAGED_STATUSES.includes(status)) {
    throw ApiError.badRequest('Trạng thái tài khoản không hợp lệ.');
  }

  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');
  }

  assertTransition(STAFF_TRANSITIONS, user.status, status, 'staff');
  const targetRoleCodes = await ensureCanManageTargetUser(user._id, actor, 'cập nhật trạng thái');

  if (targetRoleCodes.includes(ROLE_CODE.SUPER_ADMIN) && status !== 'active') {
    const count = await countActiveSuperAdmins();
    if (count <= 1) {
      throw ApiError.conflict('Không thể khóa hoặc vô hiệu hóa tài khoản super_admin cuối cùng.');
    }
  }

  user.status = status;
  user.updated_by = getActorId(actor);
  if (status === 'active') {
    user.failed_login_attempts = 0;
    user.locked_until = undefined;
  }
  if (status === 'locked' && !user.locked_until) {
    user.locked_until = new Date(Date.now() + 15 * 60 * 1000);
  }
  await user.save();

  if (status !== 'active') {
    await sessionService.invalidateAllUserSessions(ACTOR_TYPE.STAFF, user._id, requestMeta, {
      actorType: actor.actorType,
      actorId: getActorId(actor),
      reason: `user_${status}`,
    });
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.USER_DISABLED,
      aggregateType: 'user',
      aggregateId: user._id,
      recipientScope: {
        user_id: user._id,
        actors: [{ actor_type: ACTOR_TYPE.STAFF, actor_id: user._id }],
      },
      payload: {
        user_id: String(user._id),
        status,
        notification: {
          title: 'Tài khoản đã bị vô hiệu hóa',
          body: 'Phiên đăng nhập của bạn đã bị thu hồi.',
          priority: 'critical',
        },
      },
      idempotencyKey: `user.disabled:${user._id}:${status}:${Date.now()}`,
    });
  }

  await auditService.recordAuditLog({
    actor,
    action: 'users.update_status',
    targetType: 'user',
    targetId: user._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Staff account status updated.',
    requestMeta,
    metadata: { status },
  });

  return {
    user: sanitizeStaff(user, await getStaffAuthorization(user._id)),
  };
}

async function unlockStaffAccount({ user_id: userId } = {}, actor = {}, requestMeta = {}) {
  return updateStaffAccountStatus({ user_id: userId, status: 'active' }, actor, requestMeta);
}

async function activateStaffAccount(payload = {}, actor = {}, requestMeta = {}) {
  return updateStaffAccountStatus({ ...payload, status: 'active' }, actor, requestMeta);
}

async function deactivateStaffAccount(payload = {}, actor = {}, requestMeta = {}) {
  return updateStaffAccountStatus({ ...payload, status: 'disabled' }, actor, requestMeta);
}

async function resetStaffPassword({ user_id: userId, new_password: newPassword, must_change_password = true } = {}, actor = {}, requestMeta = {}) {
  if (!userId || !newPassword) {
    throw ApiError.validation('user_id và new_password là bắt buộc.');
  }

  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');
  }

  await ensureCanManageTargetUser(user._id, actor, 'đặt lại mật khẩu');
  passwordService.validatePasswordPolicy({
    password: newPassword,
    username: user.username,
    email: user.email,
    phone: user.phone,
    actorType: ACTOR_TYPE.STAFF,
  });

  await passwordService.applyNewPassword(user, newPassword, ACTOR_TYPE.STAFF, {
    changedBy: getActorId(actor),
    reason: 'admin_reset_password',
    mustChangePassword: must_change_password !== false,
  });
  user.failed_login_attempts = 0;
  user.locked_until = undefined;
  if (user.status === 'locked') user.status = 'active';
  user.updated_by = getActorId(actor);
  await user.save();

  await sessionService.invalidateAllUserSessions(ACTOR_TYPE.STAFF, user._id, requestMeta, {
    actorType: actor.actorType,
    actorId: getActorId(actor),
  });

  await auditService.recordAuditLog({
    actor,
    action: 'users.reset_password',
    targetType: 'user',
    targetId: user._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Staff password reset.',
    requestMeta,
  });

  return {
    success: true,
    must_change_password: user.must_change_password,
  };
}

module.exports = {
  // getStaffAuthorization: Lấy thông tin phân quyền hiện tại của nhân sự.
  getStaffAuthorization,
  // sanitizeStaff: Ẩn dữ liệu nhạy cảm trước khi trả thông tin nhân sự ra ngoài.
  sanitizeStaff,
  // findStaffByIdentifier: Tìm tài khoản nhân sự theo email, số điện thoại hoặc tên đăng nhập.
  findStaffByIdentifier,
  // countActiveSuperAdmins: Đếm số tài khoản super admin đang hoạt động.
  countActiveSuperAdmins,
  // ensureCanManageTargetUser: Bảo đảm actor hiện tại được phép quản lý tài khoản đích.
  ensureCanManageTargetUser,
  // loginStaff: Đăng nhập tài khoản nhân sự.
  loginStaff,
  // createStaffAccount: Tạo tài khoản nhân sự.
  createStaffAccount,
  // assignRolesToStaff: Gán vai trò cho tài khoản nhân sự.
  assignRolesToStaff,
  // listStaffAccounts: Liệt kê tài khoản nhân sự.
  listStaffAccounts,
  // updateStaffAccountStatus: Cập nhật trạng thái tài khoản nhân sự.
  updateStaffAccountStatus,
  // unlockStaffAccount: Mở khóa tài khoản nhân sự.
  unlockStaffAccount,
  // activateStaffAccount: Kích hoạt tài khoản nhân sự.
  activateStaffAccount,
  // deactivateStaffAccount: Vô hiệu hóa tài khoản nhân sự.
  deactivateStaffAccount,
  // resetStaffPassword: Đặt lại mật khẩu nhân sự.
  resetStaffPassword,
  // hasPermission: Kiểm tra người dùng/actor có một quyền cụ thể hay không.
  hasPermission: permissionService.hasPermission,
};
