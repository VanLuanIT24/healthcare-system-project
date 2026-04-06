const { mongoose } = require('../config/database');
const env = require('../config/env');
const {
  AuditLog,
  AuthSession,
  PasswordResetToken,
  Patient,
  PatientAccount,
  Permission,
  Role,
  RolePermission,
  User,
  UserRole,
  generateResetCode,
  generateResetToken,
  hashRefreshToken,
  hashResetToken,
} = require('../models');
const { comparePassword, hashPassword } = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_IN_MINUTES = 15;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-\s]{8,20}$/;
const STAFF_MANAGED_STATUSES = ['active', 'suspended', 'locked', 'disabled'];

function generatePatientCode() {
  return `PT${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function calculateLockUntil() {
  return new Date(Date.now() + LOCK_TIME_IN_MINUTES * 60 * 1000);
}

function calculateResetExpiry() {
  return new Date(Date.now() + env.passwordResetExpiresInMinutes * 60 * 1000);
}

function normalizeLogin(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').trim();
}

function verifyAccessToken(token) {
  const { decodeAndValidateJwt } = require('../utils/auth');
  return decodeAndValidateJwt(token);
}

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateRequired(value, fieldLabel) {
  if (!String(value || '').trim()) {
    throw createError(`${fieldLabel} là bắt buộc.`);
  }
}

function validatePasswordStrength(password) {
  const value = String(password || '');

  if (value.length < 8 || value.length > 32) {
    throw createError('Mật khẩu phải có từ 8 đến 32 ký tự.');
  }

  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw createError('Mật khẩu phải gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
  }
}

function validatePasswordPolicy({ password, username, email, phone }) {
  validatePasswordStrength(password);
  validatePasswordAgainstIdentifiers(password, [username, email, phone]);
  return true;
}

function validatePasswordAgainstIdentifiers(password, identifiers = []) {
  const normalizedPassword = String(password || '').trim().toLowerCase();

  const conflicted = identifiers.filter(Boolean).some((value) => normalizedPassword === String(value).trim().toLowerCase());
  if (conflicted) {
    throw createError('Mật khẩu không được trùng với email, số điện thoại hoặc tên đăng nhập.');
  }
}

function validateEmail(email) {
  if (email && !EMAIL_REGEX.test(email)) {
    throw createError('Email không đúng định dạng.');
  }
}

function validatePhone(phone) {
  if (phone && !PHONE_REGEX.test(phone)) {
    throw createError('Số điện thoại không đúng định dạng.');
  }
}

function getStatusLabel(status) {
  const map = {
    active: 'đang hoạt động',
    suspended: 'bị tạm ngưng',
    locked: 'bị khóa',
    disabled: 'đã vô hiệu hóa',
    pending_verification: 'đang chờ xác minh',
  };

  return map[status] || status;
}

function checkAccountStatusBeforeLogin(account, label) {
  ensureAccountCanLogin(account, label);
  return true;
}

async function recordAuditLog({
  actorType = 'system',
  actorId,
  action,
  targetType,
  targetId,
  status,
  message,
  requestMeta,
  metadata,
}) {
  try {
    await AuditLog.create({
      actor_type: actorType,
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      status,
      message,
      ip_address: requestMeta?.ipAddress,
      user_agent: requestMeta?.userAgent,
      metadata,
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}

async function getStaffAuthorization(userId) {
  const userRoles = await UserRole.find({ user_id: userId, is_active: true }).lean();
  const roleIds = userRoles.map((item) => item.role_id);

  if (roleIds.length === 0) {
    return { roleCodes: [], permissionCodes: [] };
  }

  const roles = await Role.find({ _id: { $in: roleIds }, status: 'active' }).lean();
  const activeRoleIds = roles.map((role) => role._id);

  const rolePermissions = await RolePermission.find({
    role_id: { $in: activeRoleIds },
    is_active: true,
  }).lean();

  const permissionIds = [...new Set(rolePermissions.map((item) => String(item.permission_id)))];
  const permissions = await Permission.find({ _id: { $in: permissionIds }, is_deleted: false }).lean();

  return {
    roleCodes: roles.map((role) => role.role_code),
    permissionCodes: permissions.map((permission) => permission.permission_code),
  };
}

async function getRoleCodesForUser(userId) {
  const authorization = await getStaffAuthorization(userId);
  return authorization.roleCodes;
}

async function countActiveSuperAdmins() {
  const superAdminRole = await Role.findOne({ role_code: 'super_admin', status: 'active' }).lean();

  if (!superAdminRole) {
    return 0;
  }

  return UserRole.countDocuments({
    role_id: superAdminRole._id,
    is_active: true,
  });
}

function ensureNotSelfManagedTarget(targetUserId, actor, actionLabel) {
  if (String(targetUserId) === String(actor.userId)) {
    throw createError(`Bạn không được phép ${actionLabel} cho chính tài khoản của mình.`, 403);
  }
}

async function ensureCanManageTargetUser(targetUserId, actor, actionLabel) {
  ensureNotSelfManagedTarget(targetUserId, actor, actionLabel);

  const targetRoles = await getRoleCodesForUser(targetUserId);
  if (targetRoles.includes('super_admin') && !actor.roles.includes('super_admin')) {
    throw createError(`Chỉ super_admin mới được phép ${actionLabel} cho tài khoản super_admin.`, 403);
  }

  return targetRoles;
}

function sanitizeStaff(user, authorization) {
  return {
    actor_type: 'staff',
    user_id: String(user._id),
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    department_id: user.department_id,
    employee_code: user.employee_code,
    status: user.status,
    last_login_at: user.last_login_at,
    must_change_password: user.must_change_password,
    roles: authorization.roleCodes,
    permissions: authorization.permissionCodes,
  };
}

function sanitizePatient(patient, account) {
  return {
    actor_type: 'patient',
    patient_id: String(patient._id),
    patient_account_id: String(account._id),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    email: account.email || patient.email,
    phone: account.phone || patient.phone,
    status: account.status,
    last_login_at: account.last_login_at,
    roles: ['patient'],
    permissions: ['patients.self.read', 'patients.self.update', 'appointments.self.read', 'appointments.self.create'],
  };
}

async function createSession({ actorType, actorId, roles, permissions, userAgent, ipAddress }) {
  const refreshToken = signRefreshToken({
    sub: String(actorId),
    actor_type: actorType,
    roles,
  });

  const accessToken = signAccessToken({
    sub: String(actorId),
    actor_type: actorType,
    roles,
    permissions,
  });

  const refreshPayload = verifyRefreshToken(refreshToken);

  await AuthSession.create({
    actor_type: actorType,
    actor_id: actorId,
    refresh_token_hash: hashRefreshToken(refreshToken),
    user_agent: userAgent,
    ip_address: ipAddress,
    expires_at: new Date(refreshPayload.exp * 1000),
    last_used_at: new Date(),
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

async function revokeSessionByRefreshToken(refreshToken) {
  const session = await AuthSession.findOne({
    refresh_token_hash: hashRefreshToken(refreshToken),
    revoked_at: null,
  });

  if (!session) {
    throw createError('Phiên đăng nhập không tồn tại hoặc đã bị đăng xuất.', 401);
  }

  session.revoked_at = new Date();
  await session.save();
  return session;
}

async function revokeSessionById(sessionId) {
  const session = await AuthSession.findById(sessionId);
  if (!session) {
    throw createError('Phiên đăng nhập không tồn tại.', 404);
  }

  if (!session.revoked_at) {
    session.revoked_at = new Date();
    await session.save();
  }

  return session;
}

async function getSessionByRefreshToken(refreshToken) {
  if (!refreshToken) {
    throw createError('Thiếu refresh_token.', 400);
  }

  return AuthSession.findOne({
    refresh_token_hash: hashRefreshToken(refreshToken),
  });
}

async function validateRefreshSession(refreshToken) {
  const session = await getSessionByRefreshToken(refreshToken);

  if (!session || session.revoked_at || session.expires_at <= new Date()) {
    throw createError('Refresh session không hợp lệ hoặc đã hết hiệu lực.', 401);
  }

  return session;
}

async function getCurrentSession({ refresh_token, session_id }) {
  if (session_id) {
    const session = await AuthSession.findById(session_id).lean();
    if (!session) {
      throw createError('Không tìm thấy session.', 404);
    }
    return session;
  }

  if (refresh_token) {
    const session = await getSessionByRefreshToken(refresh_token);
    if (!session) {
      throw createError('Không tìm thấy session.', 404);
    }
    return session;
  }

  throw createError('refresh_token hoặc session_id là bắt buộc.', 400);
}

async function invalidateAllUserSessions(actorType, actorId) {
  await AuthSession.updateMany(
    { actor_type: actorType, actor_id: actorId, revoked_at: null },
    { $set: { revoked_at: new Date() } },
  );

  return true;
}

async function resetFailedAttempts(account, ipAddress) {
  account.failed_login_attempts = 0;
  account.locked_until = undefined;
  account.last_login_at = new Date();
  if (ipAddress) {
    account.last_login_ip = ipAddress;
  }
  await account.save();
}

async function recordLoginSuccess(account, actorType, requestMeta = {}) {
  await resetFailedAttempts(account, requestMeta.ipAddress);

  await recordAuditLog({
    actorType,
    actorId: account._id,
    action: actorType === 'staff' ? 'auth.staff.login' : 'auth.patient.login',
    targetType: actorType === 'staff' ? 'user' : 'patient_account',
    targetId: account._id,
    status: 'success',
    message: actorType === 'staff' ? 'Đăng nhập nhân sự thành công.' : 'Đăng nhập bệnh nhân thành công.',
    requestMeta,
  });

  return true;
}

async function registerFailedAttempt(account) {
  const nextAttempts = (account.failed_login_attempts || 0) + 1;
  account.failed_login_attempts = nextAttempts;
  if (nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    account.locked_until = calculateLockUntil();
  }
  await account.save();
}

async function lockAccountAfterFailedAttempts(account) {
  const nextAttempts = (account.failed_login_attempts || 0) + 1;
  account.failed_login_attempts = nextAttempts;

  if (nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    account.locked_until = calculateLockUntil();
    account.status = 'locked';
  }

  await account.save();
  return account;
}

async function recordLoginFailure(account, actorType, requestMeta = {}, message = 'Đăng nhập thất bại.') {
  if (account) {
    await lockAccountAfterFailedAttempts(account);
  }

  await recordAuditLog({
    actorType: account ? actorType : 'system',
    actorId: account?._id,
    action: actorType === 'staff' ? 'auth.staff.login' : 'auth.patient.login',
    targetType: actorType === 'staff' ? 'user' : 'patient_account',
    targetId: account?._id,
    status: 'failure',
    message,
    requestMeta,
  });

  return true;
}

function ensureAccountCanLogin(account, label) {
  if (!account || account.is_deleted) {
    throw createError(`${label} không tồn tại hoặc đã bị xóa.`, 404);
  }

  if (account.locked_until && account.locked_until > new Date()) {
    throw createError(`${label} đang tạm bị khóa do đăng nhập sai quá số lần cho phép.`, 423);
  }

  if (account.status !== 'active') {
    throw createError(`${label} hiện ${getStatusLabel(account.status)}.`, 403);
  }
}

async function loginStaff({ login, username, password }, requestMeta = {}) {
  const loginValue = String(login || username || '').trim();
  validateRequired(loginValue, 'Tên đăng nhập hoặc email');
  validateRequired(password, 'Mật khẩu');
  const normalizedLoginValue = normalizeLogin(loginValue);
  const user = await User.findOne({
    is_deleted: false,
    $or: [{ username: loginValue }, { email: normalizedLoginValue }],
  });

  if (!user) {
    await recordAuditLog({
      action: 'auth.staff.login',
      status: 'failure',
      message: 'Đăng nhập nhân sự thất bại do sai thông tin đăng nhập.',
      requestMeta,
      metadata: { login: loginValue },
    });
    throw createError('Tên đăng nhập hoặc mật khẩu không đúng.', 401);
  }

  checkAccountStatusBeforeLogin(user, 'Tài khoản nhân sự');

  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    await recordLoginFailure(user, 'staff', requestMeta, 'Đăng nhập nhân sự thất bại do sai mật khẩu.');
    throw createError('Tên đăng nhập hoặc mật khẩu không đúng.', 401);
  }

  await recordLoginSuccess(user, 'staff', requestMeta);

  const authorization = await getStaffAuthorization(user._id);
  const tokens = await createSession({
    actorType: 'staff',
    actorId: user._id,
    roles: authorization.roleCodes,
    permissions: authorization.permissionCodes,
    userAgent: requestMeta.userAgent,
    ipAddress: requestMeta.ipAddress,
  });

  return {
    user: sanitizeStaff(user, authorization),
    tokens,
  };
}

async function createStaffAccount(payload, actor, requestMeta = {}) {
  const {
    username,
    password,
    full_name,
    email,
    phone,
    employee_code,
    department_id,
    role_codes = [],
    must_change_password = true,
  } = payload;

  validateRequired(username, 'Tên đăng nhập');
  validateRequired(password, 'Mật khẩu');
  validateRequired(full_name, 'Họ và tên');
  validatePasswordPolicy({ password, username, email, phone });
  validateEmail(email);
  validatePhone(phone);

  if (!Array.isArray(role_codes) || role_codes.length === 0) {
    throw createError('Phải chọn ít nhất một vai trò cho tài khoản nhân sự.');
  }

  if (role_codes.includes('super_admin') && !actor.roles.includes('super_admin')) {
    throw createError('Chỉ super_admin mới được gán vai trò super_admin.', 403);
  }

  const normalizedEmail = email ? normalizeLogin(email) : undefined;
  const normalizedPhone = phone ? normalizePhone(phone) : undefined;

  const existingUser = await User.findOne({
    $or: [
      { username: String(username).trim() },
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ...(employee_code ? [{ employee_code: String(employee_code).trim() }] : []),
    ],
  }).lean();

  if (existingUser) {
    throw createError('Tên đăng nhập, email hoặc mã nhân viên đã tồn tại.');
  }

  const roles = await Role.find({
    role_code: { $in: role_codes },
    status: 'active',
  });

  if (roles.length !== role_codes.length) {
    throw createError('Có vai trò không hợp lệ hoặc đã bị vô hiệu hóa.');
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const [user] = await User.create(
      [
        {
          username: String(username).trim(),
          password_hash: await hashPassword(password),
          full_name,
          email: normalizedEmail,
          phone: normalizedPhone,
          employee_code: employee_code ? String(employee_code).trim() : undefined,
          department_id,
          status: 'active',
          must_change_password,
          password_changed_at: new Date(),
          created_by: actor.userId,
        },
      ],
      { session },
    );

    await UserRole.insertMany(
      roles.map((role) => ({
        user_id: user._id,
        role_id: role._id,
        is_active: true,
        created_by: actor.userId,
      })),
      { session },
    );

    await session.commitTransaction();

    await recordAuditLog({
      actorType: 'staff',
      actorId: actor.userId,
      action: 'auth.staff.create',
      targetType: 'user',
      targetId: user._id,
      status: 'success',
      message: 'Tạo tài khoản nhân sự thành công.',
      requestMeta,
      metadata: { role_codes },
    });

    return {
      user: sanitizeStaff(user, {
        roleCodes: role_codes,
        permissionCodes: [],
      }),
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function assignRolesToStaff({ user_id, role_codes }, actor, requestMeta = {}) {
  if (!user_id || !Array.isArray(role_codes) || role_codes.length === 0) {
    throw createError('user_id và role_codes là bắt buộc.');
  }

  if (role_codes.includes('super_admin') && !actor.roles.includes('super_admin')) {
    throw createError('Chỉ super_admin mới được gán vai trò super_admin.', 403);
  }

  const user = await User.findById(user_id);
  if (!user) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  const currentRoleCodes = await ensureCanManageTargetUser(user._id, actor, 'cập nhật vai trò');

  const roles = await Role.find({ role_code: { $in: role_codes }, status: 'active' });
  if (roles.length !== role_codes.length) {
    throw createError('Có vai trò không hợp lệ hoặc đã bị vô hiệu hóa.');
  }

  if (currentRoleCodes.includes('super_admin') && !role_codes.includes('super_admin')) {
    const activeSuperAdminCount = await countActiveSuperAdmins();
    if (activeSuperAdminCount <= 1) {
      throw createError('Không thể gỡ vai trò super_admin khỏi tài khoản super_admin cuối cùng của hệ thống.', 409);
    }
  }

  await UserRole.updateMany(
    {
      user_id: user._id,
      role_id: {
        $nin: roles.map((role) => role._id),
      },
    },
    { $set: { is_active: false, updated_by: actor.userId } },
  );

  for (const role of roles) {
    await UserRole.updateOne(
      { user_id: user._id, role_id: role._id },
      {
        $set: {
          is_active: true,
          updated_by: actor.userId,
        },
        $setOnInsert: {
          created_by: actor.userId,
        },
      },
      { upsert: true },
    );
  }

  const authorization = await getStaffAuthorization(user._id);
  await recordAuditLog({
    actorType: 'staff',
    actorId: actor.userId,
    action: 'auth.staff.assign_roles',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Cập nhật vai trò cho tài khoản nhân sự thành công.',
    requestMeta,
    metadata: { role_codes },
  });

  return {
    user: sanitizeStaff(user, authorization),
  };
}

async function registerPatient(payload, requestMeta = {}) {
  const {
    full_name,
    password,
    confirm_password,
    email,
    phone,
    date_of_birth,
    gender,
    address,
    national_id,
    insurance_number,
    emergency_contact_name,
    emergency_contact_phone,
  } = payload;

  validateRequired(full_name, 'Họ và tên');
  validateRequired(password, 'Mật khẩu');
  validatePasswordPolicy({ password, email, phone });
  validateEmail(email);
  validatePhone(phone);

  if (!email && !phone) {
    throw createError('Bệnh nhân cần có ít nhất email hoặc số điện thoại để đăng ký.');
  }

  if (confirm_password && confirm_password !== password) {
    throw createError('Xác nhận mật khẩu không khớp.');
  }

  const normalizedEmail = email ? normalizeLogin(email) : undefined;
  const normalizedPhone = phone ? normalizePhone(phone) : undefined;

  const existingPatientAccount = await PatientAccount.findOne({
    $or: [
      ...(normalizedEmail ? [{ email: normalizedEmail }, { username: normalizedEmail }] : []),
      ...(normalizedPhone ? [{ phone: normalizedPhone }, { username: normalizedPhone }] : []),
    ],
  }).lean();

  if (existingPatientAccount) {
    throw createError('Email hoặc số điện thoại này đã được dùng để đăng ký bệnh nhân.');
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const [patient] = await Patient.create(
      [
        {
          patient_code: generatePatientCode(),
          full_name,
          date_of_birth,
          gender: gender || 'unknown',
          phone: normalizedPhone,
          email: normalizedEmail,
          address,
          national_id,
          insurance_number,
          emergency_contact_name,
          emergency_contact_phone,
          status: 'active',
        },
      ],
      { session },
    );

    const username = normalizedEmail || normalizedPhone;
    const [account] = await PatientAccount.create(
      [
        {
          patient_id: patient._id,
          username,
          email: normalizedEmail,
          phone: normalizedPhone,
          password_hash: await hashPassword(password),
          status: 'active',
          password_changed_at: new Date(),
        },
      ],
      { session },
    );

    await session.commitTransaction();

    const tokens = await createSession({
      actorType: 'patient',
      actorId: account._id,
      roles: ['patient'],
      permissions: ['patients.self.read', 'patients.self.update', 'appointments.self.read', 'appointments.self.create'],
      userAgent: requestMeta.userAgent,
      ipAddress: requestMeta.ipAddress,
    });

    await recordAuditLog({
      actorType: 'patient',
      actorId: account._id,
      action: 'auth.patient.register',
      targetType: 'patient_account',
      targetId: account._id,
      status: 'success',
      message: 'Đăng ký tài khoản bệnh nhân thành công.',
      requestMeta,
      metadata: { patient_id: String(patient._id) },
    });

    return {
      patient: sanitizePatient(patient, account),
      tokens,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function loginPatient({ login, password }, requestMeta = {}) {
  validateRequired(login, 'Thông tin đăng nhập');
  validateRequired(password, 'Mật khẩu');

  const normalizedLogin = normalizeLogin(login);
  const account = await PatientAccount.findOne({
    $or: [{ username: normalizedLogin }, { email: normalizedLogin }, { phone: String(login).trim() }],
    is_deleted: false,
  });

  if (!account) {
    await recordAuditLog({
      action: 'auth.patient.login',
      status: 'failure',
      message: 'Đăng nhập bệnh nhân thất bại do sai thông tin đăng nhập.',
      requestMeta,
      metadata: { login: String(login).trim() },
    });
    throw createError('Thông tin đăng nhập hoặc mật khẩu không đúng.', 401);
  }

  checkAccountStatusBeforeLogin(account, 'Tài khoản bệnh nhân');

  const isValidPassword = await comparePassword(password, account.password_hash);
  if (!isValidPassword) {
    await recordLoginFailure(account, 'patient', requestMeta, 'Đăng nhập bệnh nhân thất bại do sai mật khẩu.');
    throw createError('Thông tin đăng nhập hoặc mật khẩu không đúng.', 401);
  }

  await recordLoginSuccess(account, 'patient', requestMeta);

  const patient = await Patient.findById(account.patient_id);
  if (!patient) {
    throw createError('Không tìm thấy hồ sơ bệnh nhân.', 404);
  }

  const tokens = await createSession({
    actorType: 'patient',
    actorId: account._id,
    roles: ['patient'],
    permissions: ['patients.self.read', 'patients.self.update', 'appointments.self.read', 'appointments.self.create'],
    userAgent: requestMeta.userAgent,
    ipAddress: requestMeta.ipAddress,
  });

  return {
    patient: sanitizePatient(patient, account),
    tokens,
  };
}

async function listStaffAccounts(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const skip = (page - 1) * limit;
  const keyword = String(query.keyword || '').trim();
  const filter = { is_deleted: false };

  if (query.status) {
    filter.status = query.status;
  }

  if (keyword) {
    filter.$or = [
      { username: { $regex: keyword, $options: 'i' } },
      { full_name: { $regex: keyword, $options: 'i' } },
      { email: { $regex: keyword, $options: 'i' } },
      { employee_code: { $regex: keyword, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const mapped = await Promise.all(
    users.map(async (user) => {
      const authorization = await getStaffAuthorization(user._id);

      if (query.role_code && !authorization.roleCodes.includes(query.role_code)) {
        return null;
      }

      return sanitizeStaff(user, authorization);
    }),
  );

  return {
    items: mapped.filter(Boolean),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

async function updateStaffAccountStatus({ user_id, status }, actor, requestMeta = {}) {
  if (!user_id || !status) {
    throw createError('user_id và status là bắt buộc.');
  }

  if (!STAFF_MANAGED_STATUSES.includes(status)) {
    throw createError('Trạng thái tài khoản không hợp lệ.');
  }

  const user = await User.findById(user_id);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  const targetRoleCodes = await ensureCanManageTargetUser(user._id, actor, 'cập nhật trạng thái');

  if (targetRoleCodes.includes('super_admin') && status !== 'active') {
    const activeSuperAdminCount = await countActiveSuperAdmins();
    if (activeSuperAdminCount <= 1) {
      throw createError('Không thể khóa hoặc vô hiệu hóa tài khoản super_admin cuối cùng của hệ thống.', 409);
    }
  }

  user.status = status;
  user.updated_by = actor.userId;

  if (status === 'active') {
    user.failed_login_attempts = 0;
    user.locked_until = undefined;
  }

  if (status === 'locked') {
    user.locked_until = calculateLockUntil();
  }

  await user.save();

  if (status !== 'active') {
    await AuthSession.updateMany(
      { actor_type: 'staff', actor_id: user._id, revoked_at: null },
      { $set: { revoked_at: new Date() } },
    );
  }

  await recordAuditLog({
    actorType: 'staff',
    actorId: actor.userId,
    action: 'auth.staff.update_status',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Cập nhật trạng thái tài khoản nhân sự thành công.',
    requestMeta,
    metadata: { status },
  });

  return {
    user: sanitizeStaff(user, await getStaffAuthorization(user._id)),
  };
}

async function resetStaffPassword({ user_id, new_password }, actor, requestMeta = {}) {
  if (!user_id) {
    throw createError('user_id là bắt buộc.');
  }

  validateRequired(new_password, 'Mật khẩu mới');
  validatePasswordPolicy({ password: new_password });

  const user = await User.findById(user_id);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  await ensureCanManageTargetUser(user._id, actor, 'đặt lại mật khẩu');

  validatePasswordPolicy({ password: new_password, username: user.username, email: user.email, phone: user.phone });

  user.password_hash = await hashPassword(new_password);
  user.password_changed_at = new Date();
  user.must_change_password = true;
  user.failed_login_attempts = 0;
  user.locked_until = undefined;
  user.status = 'active';
  user.updated_by = actor.userId;
  await user.save();

  await invalidateAllUserSessions('staff', user._id);

  await recordAuditLog({
    actorType: 'staff',
    actorId: actor.userId,
    action: 'auth.staff.reset_password',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Admin đã đặt lại mật khẩu cho tài khoản nhân sự.',
    requestMeta,
  });

  return { success: true };
}

async function requestPasswordReset({ actor_type, login }, requestMeta = {}) {
  validateRequired(actor_type, 'Loại tài khoản');
  validateRequired(login, 'Thông tin nhận diện tài khoản');

  if (!['staff', 'patient'].includes(actor_type)) {
    throw createError('Loại tài khoản không hợp lệ.');
  }

  const normalizedLogin = normalizeLogin(login);
  const account =
    actor_type === 'staff'
      ? await User.findOne({
          is_deleted: false,
          $or: [{ username: String(login).trim() }, { email: normalizedLogin }],
        })
      : await PatientAccount.findOne({
          is_deleted: false,
          $or: [{ username: normalizedLogin }, { email: normalizedLogin }, { phone: String(login).trim() }],
        });

  if (!account) {
    await recordAuditLog({
      action: 'auth.password_reset.request',
      status: 'failure',
      message: 'Yêu cầu quên mật khẩu cho tài khoản không tồn tại.',
      requestMeta,
      metadata: { actor_type, login: String(login).trim() },
    });

    return {
      delivery_method: 'internal',
      expires_in_minutes: env.passwordResetExpiresInMinutes,
    };
  }

  await PasswordResetToken.updateMany(
    { actor_type, actor_id: account._id, used_at: null, revoked_at: null },
    { $set: { revoked_at: new Date() } },
  );

  const resetToken = generateResetToken();
  const resetCode = generateResetCode();

  await PasswordResetToken.create({
    actor_type,
    actor_id: account._id,
    token_hash: hashResetToken(resetToken),
    reset_code_hash: hashResetToken(resetCode),
    expires_at: calculateResetExpiry(),
    requested_ip: requestMeta.ipAddress,
    requested_user_agent: requestMeta.userAgent,
  });

  await recordAuditLog({
    actorType: actor_type,
    actorId: account._id,
    action: 'auth.password_reset.request',
    targetType: actor_type === 'staff' ? 'user' : 'patient_account',
    targetId: account._id,
    status: 'success',
    message: 'Tạo yêu cầu quên mật khẩu thành công.',
    requestMeta,
  });

  const result = {
    delivery_method: 'internal',
    expires_in_minutes: env.passwordResetExpiresInMinutes,
    reset_link: `${env.appBaseUrl}/dat-lai-mat-khau?token=${resetToken}&actor_type=${actor_type}`,
  };

  if (env.exposeResetSecrets) {
    result.reset_token = resetToken;
    result.reset_code = resetCode;
  }

  return result;
}

async function verifyPasswordResetToken({ reset_token, reset_code, actor_type }) {
  validateRequired(reset_token, 'Reset token');
  validateRequired(reset_code, 'Mã reset');

  const filter = {
    token_hash: hashResetToken(reset_token),
    used_at: null,
    revoked_at: null,
  };

  if (actor_type) {
    filter.actor_type = actor_type;
  }

  const resetRecord = await PasswordResetToken.findOne(filter);

  if (!resetRecord) {
    throw createError('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hiệu lực.', 400);
  }

  if (resetRecord.expires_at <= new Date()) {
    resetRecord.revoked_at = new Date();
    await resetRecord.save();
    throw createError('Token đặt lại mật khẩu đã hết hạn.', 400);
  }

  if (resetRecord.reset_code_hash !== hashResetToken(reset_code)) {
    throw createError('Mã reset không đúng.', 400);
  }

  return resetRecord;
}

async function resetPassword({ reset_token, reset_code, new_password }, requestMeta = {}) {
  validateRequired(reset_token, 'Reset token');
  validateRequired(reset_code, 'Mã reset');
  validateRequired(new_password, 'Mật khẩu mới');
  validatePasswordStrength(new_password);

  let resetRecord;
  try {
    resetRecord = await verifyPasswordResetToken({ reset_token, reset_code });
  } catch (error) {
    await recordAuditLog({
      actorType: 'system',
      action: 'auth.password_reset.complete',
      status: 'failure',
      message: error.message,
      requestMeta,
    });
    throw error;
  }

  if (resetRecord.actor_type === 'staff') {
    const user = await User.findById(resetRecord.actor_id);
    if (!user || user.is_deleted) {
      throw createError('Không tìm thấy tài khoản nhân sự.', 404);
    }

    validatePasswordPolicy({ password: new_password, username: user.username, email: user.email, phone: user.phone });
    user.password_hash = await hashPassword(new_password);
    user.password_changed_at = new Date();
    user.must_change_password = false;
    user.failed_login_attempts = 0;
    user.locked_until = undefined;
    user.status = 'active';
    await user.save();

    await invalidateAllUserSessions('staff', user._id);
  } else {
    const account = await PatientAccount.findById(resetRecord.actor_id);
    if (!account || account.is_deleted) {
      throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
    }

    validatePasswordPolicy({ password: new_password, username: account.username, email: account.email, phone: account.phone });
    account.password_hash = await hashPassword(new_password);
    account.password_changed_at = new Date();
    account.failed_login_attempts = 0;
    account.locked_until = undefined;
    account.status = 'active';
    await account.save();

    await invalidateAllUserSessions('patient', account._id);
  }

  resetRecord.used_at = new Date();
  await resetRecord.save();

  await PasswordResetToken.updateMany(
    {
      actor_type: resetRecord.actor_type,
      actor_id: resetRecord.actor_id,
      _id: { $ne: resetRecord._id },
      used_at: null,
      revoked_at: null,
    },
    { $set: { revoked_at: new Date() } },
  );

  await recordAuditLog({
    actorType: resetRecord.actor_type,
    actorId: resetRecord.actor_id,
    action: 'auth.password_reset.complete',
    targetType: resetRecord.actor_type === 'staff' ? 'user' : 'patient_account',
    targetId: resetRecord.actor_id,
    status: 'success',
    message: 'Đặt lại mật khẩu thành công.',
    requestMeta,
  });

  return { success: true };
}

async function refreshAccessToken({ refresh_token }, requestMeta = {}) {
  if (!refresh_token) {
    throw createError('Thiếu refresh_token.', 400);
  }

  let payload;
  try {
    payload = verifyRefreshToken(refresh_token);
  } catch (error) {
    throw createError('Refresh token không hợp lệ hoặc đã hết hạn.', 401);
  }

  const currentSession = await validateRefreshSession(refresh_token);
  currentSession.revoked_at = new Date();
  await currentSession.save();

  if (payload.actor_type === 'staff') {
    const user = await User.findById(payload.sub);
    if (!user) throw createError('Không tìm thấy tài khoản nhân sự.', 404);
    checkAccountStatusBeforeLogin(user, 'Tài khoản nhân sự');
    const authorization = await getStaffAuthorization(user._id);

    const tokens = await createSession({
      actorType: 'staff',
      actorId: user._id,
      roles: authorization.roleCodes,
      permissions: authorization.permissionCodes,
      userAgent: requestMeta.userAgent || currentSession.user_agent,
      ipAddress: requestMeta.ipAddress || currentSession.ip_address,
    });

    await recordAuditLog({
      actorType: 'staff',
      actorId: user._id,
      action: 'auth.refresh_token',
      targetType: 'user',
      targetId: user._id,
      status: 'success',
      message: 'Làm mới phiên đăng nhập thành công.',
      requestMeta,
    });

    return tokens;
  }

  const account = await PatientAccount.findById(payload.sub);
  if (!account) throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
  checkAccountStatusBeforeLogin(account, 'Tài khoản bệnh nhân');

  const tokens = await createSession({
    actorType: 'patient',
    actorId: account._id,
    roles: ['patient'],
    permissions: ['patients.self.read', 'patients.self.update', 'appointments.self.read', 'appointments.self.create'],
    userAgent: requestMeta.userAgent || currentSession.user_agent,
    ipAddress: requestMeta.ipAddress || currentSession.ip_address,
  });

  await recordAuditLog({
    actorType: 'patient',
    actorId: account._id,
    action: 'auth.refresh_token',
    targetType: 'patient_account',
    targetId: account._id,
    status: 'success',
    message: 'Làm mới phiên đăng nhập thành công.',
    requestMeta,
  });

  return tokens;
}

async function rotateRefreshToken(payload, requestMeta = {}) {
  return refreshAccessToken(payload, requestMeta);
}

async function logout({ refresh_token }, auth, requestMeta = {}) {
  if (!refresh_token) {
    throw createError('Thiếu refresh_token.', 400);
  }

  const session = await AuthSession.findOne({
    refresh_token_hash: hashRefreshToken(refresh_token),
    revoked_at: null,
  });

  if (!session) {
    throw createError('Phiên đăng nhập đã hết hiệu lực hoặc đã được đăng xuất trước đó.', 404);
  }

  session.revoked_at = new Date();
  await session.save();

  await recordAuditLog({
    actorType: auth?.actorType || session.actor_type,
    actorId: auth?.userId || auth?.patientAccountId || session.actor_id,
    action: 'auth.logout',
    targetType: session.actor_type === 'staff' ? 'user' : 'patient_account',
    targetId: session.actor_id,
    status: 'success',
    message: 'Đăng xuất thành công.',
    requestMeta,
  });

  return { success: true };
}

async function changePassword(auth, payload, requestMeta = {}) {
  const { current_password, new_password } = payload;

  if (!current_password || !new_password) {
    throw createError('current_password và new_password là bắt buộc.');
  }

  if (current_password === new_password) {
    throw createError('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
  }

  validatePasswordPolicy({ password: new_password });

  if (auth.actorType === 'staff') {
    const user = await User.findById(auth.userId);
    if (!user) throw createError('Không tìm thấy tài khoản nhân sự.', 404);

    const isValid = await comparePassword(current_password, user.password_hash);
    if (!isValid) throw createError('Mật khẩu hiện tại không đúng.', 400);

    validatePasswordPolicy({ password: new_password, username: user.username, email: user.email, phone: user.phone });
    user.password_hash = await hashPassword(new_password);
    user.password_changed_at = new Date();
    user.must_change_password = false;
    await user.save();

    await invalidateAllUserSessions('staff', user._id);

    await recordAuditLog({
      actorType: 'staff',
      actorId: user._id,
      action: 'auth.change_password',
      targetType: 'user',
      targetId: user._id,
      status: 'success',
      message: 'Đổi mật khẩu nhân sự thành công.',
      requestMeta,
    });

    return { success: true };
  }

  const account = await PatientAccount.findById(auth.patientAccountId);
  if (!account) throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);

  const isValid = await comparePassword(current_password, account.password_hash);
  if (!isValid) throw createError('Mật khẩu hiện tại không đúng.', 400);

    validatePasswordPolicy({ password: new_password, username: account.username, email: account.email, phone: account.phone });
  account.password_hash = await hashPassword(new_password);
  account.password_changed_at = new Date();
  await account.save();

    await invalidateAllUserSessions('patient', account._id);

  await recordAuditLog({
    actorType: 'patient',
    actorId: account._id,
    action: 'auth.change_password',
    targetType: 'patient_account',
    targetId: account._id,
    status: 'success',
    message: 'Đổi mật khẩu bệnh nhân thành công.',
    requestMeta,
  });

  return { success: true };
}

async function getCurrentProfile(auth) {
  if (auth.actorType === 'staff') {
    const authorization = await getStaffAuthorization(auth.user._id);
    return sanitizeStaff(auth.user, authorization);
  }

  return sanitizePatient(auth.patient, auth.account);
}

async function getMyRoles(auth) {
  if (auth.actorType === 'patient') {
    return {
      actor_type: 'patient',
      roles: [{ role_code: 'patient', role_name: 'Patient', description: 'Bệnh nhân' }],
    };
  }

  const userRoles = await UserRole.find({ user_id: auth.userId, is_active: true }).lean();
  const roleIds = userRoles.map((item) => item.role_id);
  const roles = await Role.find({
    _id: { $in: roleIds },
    status: 'active',
    is_deleted: false,
  }).lean();

  return {
    actor_type: 'staff',
    roles: roles.map((role) => ({
      role_id: String(role._id),
      role_code: role.role_code,
      role_name: role.role_name,
      description: role.description,
    })),
  };
}

async function getMyPermissions(auth) {
  if (auth.actorType === 'patient') {
    return {
      actor_type: 'patient',
      user_id: auth.patientAccountId,
      roles: ['patient'],
      permissions: ['patients.self.read', 'patients.self.update', 'appointments.self.read', 'appointments.self.create'],
    };
  }

  const authorization = await getStaffAuthorization(auth.userId);
  return {
    actor_type: 'staff',
    user_id: auth.userId,
    roles: authorization.roleCodes,
    permissions: authorization.permissionCodes,
  };
}

async function updateMyProfile(auth, payload, requestMeta = {}) {
  const { full_name, email, phone, address } = payload;

  validateEmail(email);
  validatePhone(phone);

  if (auth.actorType === 'staff') {
    const user = await User.findById(auth.userId);
    if (!user || user.is_deleted) {
      throw createError('Không tìm thấy tài khoản nhân sự.', 404);
    }

    const normalizedEmail = email ? normalizeLogin(email) : undefined;
    const normalizedPhone = phone ? normalizePhone(phone) : undefined;

    if (normalizedEmail && normalizedEmail !== user.email) {
      const existingEmail = await User.findOne({
        _id: { $ne: user._id },
        email: normalizedEmail,
        is_deleted: false,
      }).lean();

      if (existingEmail) {
        throw createError('Email đã được sử dụng bởi tài khoản khác.', 409);
      }
    }

    user.full_name = full_name || user.full_name;
    user.email = normalizedEmail || user.email;
    user.phone = normalizedPhone || user.phone;
    user.updated_by = user._id;
    await user.save();

    await recordAuditLog({
      actorType: 'staff',
      actorId: user._id,
      action: 'auth.profile.update',
      targetType: 'user',
      targetId: user._id,
      status: 'success',
      message: 'Cập nhật hồ sơ cá nhân thành công.',
      requestMeta,
    });

    return {
      profile: sanitizeStaff(user, await getStaffAuthorization(user._id)),
    };
  }

  const account = await PatientAccount.findById(auth.patientAccountId);
  const patient = await Patient.findById(auth.patientId);
  if (!account || !patient || account.is_deleted || patient.is_deleted) {
    throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
  }

  const normalizedEmail = email ? normalizeLogin(email) : undefined;
  const normalizedPhone = phone ? normalizePhone(phone) : undefined;

  if (normalizedEmail && normalizedEmail !== account.email) {
    const existingEmail = await PatientAccount.findOne({
      _id: { $ne: account._id },
      email: normalizedEmail,
      is_deleted: false,
    }).lean();

    if (existingEmail) {
      throw createError('Email đã được sử dụng bởi tài khoản khác.', 409);
    }
  }

  if (normalizedPhone && normalizedPhone !== account.phone) {
    const existingPhone = await PatientAccount.findOne({
      _id: { $ne: account._id },
      phone: normalizedPhone,
      is_deleted: false,
    }).lean();

    if (existingPhone) {
      throw createError('Số điện thoại đã được sử dụng bởi tài khoản khác.', 409);
    }
  }

  if (full_name) patient.full_name = full_name;
  if (normalizedEmail) {
    patient.email = normalizedEmail;
    account.email = normalizedEmail;
    account.username = normalizedEmail;
  }
  if (normalizedPhone) {
    patient.phone = normalizedPhone;
    account.phone = normalizedPhone;
    if (!normalizedEmail) {
      account.username = normalizedPhone;
    }
  }
  if (address !== undefined) {
    patient.address = address;
  }

  await Promise.all([patient.save(), account.save()]);

  await recordAuditLog({
    actorType: 'patient',
    actorId: account._id,
    action: 'auth.profile.update',
    targetType: 'patient_account',
    targetId: account._id,
    status: 'success',
    message: 'Cập nhật hồ sơ cá nhân thành công.',
    requestMeta,
  });

  return {
    profile: sanitizePatient(patient, account),
  };
}

async function revokeRefreshToken({ refresh_token, session_id }, auth, requestMeta = {}) {
  let session = null;

  if (refresh_token) {
    session = await AuthSession.findOne({
      refresh_token_hash: hashRefreshToken(refresh_token),
      revoked_at: null,
    });
  } else if (session_id) {
    session = await AuthSession.findById(session_id);
  } else {
    throw createError('refresh_token hoặc session_id là bắt buộc.', 400);
  }

  if (!session) {
    return { success: true };
  }

  const isOwner = String(session.actor_id) === String(auth.userId || auth.patientAccountId);
  const isAdminActor = auth.actorType === 'staff' && auth.permissions.includes('auth.staff.reset_password');

  if (!isOwner && !isAdminActor) {
    throw createError('Bạn không có quyền thu hồi phiên đăng nhập này.', 403);
  }

  if (!session.revoked_at) {
    session.revoked_at = new Date();
    await session.save();
  }

  await recordAuditLog({
    actorType: auth.actorType,
    actorId: auth.userId || auth.patientAccountId,
    action: 'auth.session.revoke',
    targetType: 'auth_session',
    targetId: session._id,
    status: 'success',
    message: 'Thu hồi refresh token thành công.',
    requestMeta,
  });

  return { success: true };
}

async function logoutAllDevices(auth, requestMeta = {}) {
  const actorId = auth.userId || auth.patientAccountId;
  const actorType = auth.actorType;

  await AuthSession.updateMany(
    { actor_type: actorType, actor_id: actorId, revoked_at: null },
    { $set: { revoked_at: new Date() } },
  );

  await recordAuditLog({
    actorType,
    actorId,
    action: 'auth.logout_all_devices',
    targetType: actorType === 'staff' ? 'user' : 'patient_account',
    targetId: actorId,
    status: 'success',
    message: 'Đăng xuất khỏi toàn bộ thiết bị thành công.',
    requestMeta,
  });

  return { success: true };
}

async function getMySessions(auth) {
  const actorId = auth.userId || auth.patientAccountId;
  const actorType = auth.actorType;
  const sessions = await AuthSession.find({
    actor_type: actorType,
    actor_id: actorId,
  })
    .sort({ created_at: -1 })
    .lean();

  return {
    items: sessions.map((session) => ({
      session_id: String(session._id),
      login_at: session.created_at,
      last_seen_at: session.last_used_at,
      ip_address: session.ip_address,
      user_agent: session.user_agent,
      expires_at: session.expires_at,
      revoked_at: session.revoked_at,
      is_active: !session.revoked_at && session.expires_at > new Date(),
    })),
  };
}

async function getLoginHistory(auth, query = {}) {
  const actorId = auth.userId || auth.patientAccountId;
  const actorType = auth.actorType;
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {
    actor_type: actorType,
    actor_id: actorId,
    action: {
      $in: actorType === 'staff' ? ['auth.staff.login'] : ['auth.patient.login'],
    },
  };

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => ({
      audit_log_id: String(item._id),
      action: item.action,
      status: item.status,
      message: item.message,
      ip_address: item.ip_address,
      user_agent: item.user_agent,
      created_at: item.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

async function unlockStaffAccount({ user_id }, actor, requestMeta = {}) {
  if (!user_id) {
    throw createError('user_id là bắt buộc.');
  }

  const user = await User.findById(user_id);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  await ensureCanManageTargetUser(user._id, actor, 'mở khóa tài khoản');

  if (user.status !== 'locked' && !(user.locked_until && user.locked_until > new Date())) {
    throw createError('Tài khoản này hiện không ở trạng thái bị khóa.', 409);
  }

  user.status = 'active';
  user.failed_login_attempts = 0;
  user.locked_until = undefined;
  user.updated_by = actor.userId;
  await user.save();

  await recordAuditLog({
    actorType: 'staff',
    actorId: actor.userId,
    action: 'auth.staff.unlock',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Mở khóa tài khoản nhân sự thành công.',
    requestMeta,
  });

  return {
    user: sanitizeStaff(user, await getStaffAuthorization(user._id)),
  };
}

async function activateStaffAccount(payload, actor, requestMeta = {}) {
  return updateStaffAccountStatus({ ...payload, status: 'active' }, actor, requestMeta);
}

async function deactivateStaffAccount(payload, actor, requestMeta = {}) {
  return updateStaffAccountStatus({ ...payload, status: 'disabled' }, actor, requestMeta);
}

async function getAuditLogs(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const skip = (page - 1) * limit;
  const filter = {};

  if (query.actor_type) {
    filter.actor_type = query.actor_type;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.action) {
    filter.action = query.action;
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  verifyAccessToken,
  validatePasswordPolicy,
  checkAccountStatusBeforeLogin,
  recordLoginSuccess,
  recordLoginFailure,
  lockAccountAfterFailedAttempts,
  invalidateAllUserSessions,
  getSessionByRefreshToken,
  validateRefreshSession,
  revokeSessionById,
  getCurrentSession,
  loginStaff,
  createStaffAccount,
  assignRolesToStaff,
  listStaffAccounts,
  updateStaffAccountStatus,
  unlockStaffAccount,
  activateStaffAccount,
  deactivateStaffAccount,
  resetStaffPassword,
  registerPatient,
  loginPatient,
  requestPasswordReset,
  verifyPasswordResetToken,
  resetPassword,
  refreshAccessToken,
  rotateRefreshToken,
  revokeRefreshToken,
  logout,
  logoutAllDevices,
  changePassword,
  getCurrentProfile,
  getMyRoles,
  getMyPermissions,
  updateMyProfile,
  getMySessions,
  getLoginHistory,
  getAuditLogs,
};
