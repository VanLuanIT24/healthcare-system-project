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

async function resetFailedAttempts(account, ipAddress) {
  account.failed_login_attempts = 0;
  account.locked_until = undefined;
  account.last_login_at = new Date();
  if (ipAddress) {
    account.last_login_ip = ipAddress;
  }
  await account.save();
}

async function registerFailedAttempt(account) {
  const nextAttempts = (account.failed_login_attempts || 0) + 1;
  account.failed_login_attempts = nextAttempts;
  if (nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    account.locked_until = calculateLockUntil();
  }
  await account.save();
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

  ensureAccountCanLogin(user, 'Tài khoản nhân sự');

  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    await registerFailedAttempt(user);
    await recordAuditLog({
      actorType: 'staff',
      actorId: user._id,
      action: 'auth.staff.login',
      targetType: 'user',
      targetId: user._id,
      status: 'failure',
      message: 'Đăng nhập nhân sự thất bại do sai mật khẩu.',
      requestMeta,
    });
    throw createError('Tên đăng nhập hoặc mật khẩu không đúng.', 401);
  }

  await resetFailedAttempts(user, requestMeta.ipAddress);

  const authorization = await getStaffAuthorization(user._id);
  const tokens = await createSession({
    actorType: 'staff',
    actorId: user._id,
    roles: authorization.roleCodes,
    permissions: authorization.permissionCodes,
    userAgent: requestMeta.userAgent,
    ipAddress: requestMeta.ipAddress,
  });

  await recordAuditLog({
    actorType: 'staff',
    actorId: user._id,
    action: 'auth.staff.login',
    targetType: 'user',
    targetId: user._id,
    status: 'success',
    message: 'Đăng nhập nhân sự thành công.',
    requestMeta,
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
  validatePasswordStrength(password);
  validateEmail(email);
  validatePhone(phone);
  validatePasswordAgainstIdentifiers(password, [username, email, phone]);

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

  await UserRole.updateMany({ user_id: user._id }, { $set: { is_active: false, updated_by: actor.userId } });
  await UserRole.insertMany(
    roles.map((role) => ({
      user_id: user._id,
      role_id: role._id,
      is_active: true,
      created_by: actor.userId,
    })),
  );

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
  validatePasswordStrength(password);
  validateEmail(email);
  validatePhone(phone);

  if (!email && !phone) {
    throw createError('Bệnh nhân cần có ít nhất email hoặc số điện thoại để đăng ký.');
  }

  if (confirm_password && confirm_password !== password) {
    throw createError('Xác nhận mật khẩu không khớp.');
  }

  validatePasswordAgainstIdentifiers(password, [email, phone]);

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

  ensureAccountCanLogin(account, 'Tài khoản bệnh nhân');

  const isValidPassword = await comparePassword(password, account.password_hash);
  if (!isValidPassword) {
    await registerFailedAttempt(account);
    await recordAuditLog({
      actorType: 'patient',
      actorId: account._id,
      action: 'auth.patient.login',
      targetType: 'patient_account',
      targetId: account._id,
      status: 'failure',
      message: 'Đăng nhập bệnh nhân thất bại do sai mật khẩu.',
      requestMeta,
    });
    throw createError('Thông tin đăng nhập hoặc mật khẩu không đúng.', 401);
  }

  await resetFailedAttempts(account, requestMeta.ipAddress);

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

  await recordAuditLog({
    actorType: 'patient',
    actorId: account._id,
    action: 'auth.patient.login',
    targetType: 'patient_account',
    targetId: account._id,
    status: 'success',
    message: 'Đăng nhập bệnh nhân thành công.',
    requestMeta,
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
  validatePasswordStrength(new_password);

  const user = await User.findById(user_id);
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  await ensureCanManageTargetUser(user._id, actor, 'đặt lại mật khẩu');

  validatePasswordAgainstIdentifiers(new_password, [user.username, user.email, user.phone]);

  user.password_hash = await hashPassword(new_password);
  user.password_changed_at = new Date();
  user.must_change_password = true;
  user.failed_login_attempts = 0;
  user.locked_until = undefined;
  user.status = 'active';
  user.updated_by = actor.userId;
  await user.save();

  await AuthSession.updateMany(
    { actor_type: 'staff', actor_id: user._id, revoked_at: null },
    { $set: { revoked_at: new Date() } },
  );

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

async function resetPassword({ reset_token, reset_code, new_password }, requestMeta = {}) {
  validateRequired(reset_token, 'Reset token');
  validateRequired(reset_code, 'Mã reset');
  validateRequired(new_password, 'Mật khẩu mới');
  validatePasswordStrength(new_password);

  const resetRecord = await PasswordResetToken.findOne({
    token_hash: hashResetToken(reset_token),
    used_at: null,
    revoked_at: null,
  });

  if (!resetRecord) {
    throw createError('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hiệu lực.', 400);
  }

  if (resetRecord.expires_at <= new Date()) {
    resetRecord.revoked_at = new Date();
    await resetRecord.save();
    throw createError('Token đặt lại mật khẩu đã hết hạn.', 400);
  }

  if (resetRecord.reset_code_hash !== hashResetToken(reset_code)) {
    await recordAuditLog({
      actorType: resetRecord.actor_type,
      actorId: resetRecord.actor_id,
      action: 'auth.password_reset.complete',
      targetType: resetRecord.actor_type === 'staff' ? 'user' : 'patient_account',
      targetId: resetRecord.actor_id,
      status: 'failure',
      message: 'Đặt lại mật khẩu thất bại do mã reset không đúng.',
      requestMeta,
    });
    throw createError('Mã reset không đúng.');
  }

  if (resetRecord.actor_type === 'staff') {
    const user = await User.findById(resetRecord.actor_id);
    if (!user || user.is_deleted) {
      throw createError('Không tìm thấy tài khoản nhân sự.', 404);
    }

    validatePasswordAgainstIdentifiers(new_password, [user.username, user.email, user.phone]);
    user.password_hash = await hashPassword(new_password);
    user.password_changed_at = new Date();
    user.must_change_password = false;
    user.failed_login_attempts = 0;
    user.locked_until = undefined;
    user.status = 'active';
    await user.save();

    await AuthSession.updateMany(
      { actor_type: 'staff', actor_id: user._id, revoked_at: null },
      { $set: { revoked_at: new Date() } },
    );
  } else {
    const account = await PatientAccount.findById(resetRecord.actor_id);
    if (!account || account.is_deleted) {
      throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);
    }

    validatePasswordAgainstIdentifiers(new_password, [account.username, account.email, account.phone]);
    account.password_hash = await hashPassword(new_password);
    account.password_changed_at = new Date();
    account.failed_login_attempts = 0;
    account.locked_until = undefined;
    account.status = 'active';
    await account.save();

    await AuthSession.updateMany(
      { actor_type: 'patient', actor_id: account._id, revoked_at: null },
      { $set: { revoked_at: new Date() } },
    );
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

  const currentSession = await revokeSessionByRefreshToken(refresh_token);

  if (payload.actor_type === 'staff') {
    const user = await User.findById(payload.sub);
    if (!user) throw createError('Không tìm thấy tài khoản nhân sự.', 404);
    ensureAccountCanLogin(user, 'Tài khoản nhân sự');
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
  ensureAccountCanLogin(account, 'Tài khoản bệnh nhân');

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

  validatePasswordStrength(new_password);

  if (auth.actorType === 'staff') {
    const user = await User.findById(auth.userId);
    if (!user) throw createError('Không tìm thấy tài khoản nhân sự.', 404);

    const isValid = await comparePassword(current_password, user.password_hash);
    if (!isValid) throw createError('Mật khẩu hiện tại không đúng.', 400);

    validatePasswordAgainstIdentifiers(new_password, [user.username, user.email, user.phone]);
    user.password_hash = await hashPassword(new_password);
    user.password_changed_at = new Date();
    user.must_change_password = false;
    await user.save();

    await AuthSession.updateMany(
      { actor_type: 'staff', actor_id: user._id, revoked_at: null },
      { $set: { revoked_at: new Date() } },
    );

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

  validatePasswordAgainstIdentifiers(new_password, [account.username, account.email, account.phone]);
  account.password_hash = await hashPassword(new_password);
  account.password_changed_at = new Date();
  await account.save();

  await AuthSession.updateMany(
    { actor_type: 'patient', actor_id: account._id, revoked_at: null },
    { $set: { revoked_at: new Date() } },
  );

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
  loginStaff,
  createStaffAccount,
  assignRolesToStaff,
  listStaffAccounts,
  updateStaffAccountStatus,
  resetStaffPassword,
  registerPatient,
  loginPatient,
  requestPasswordReset,
  resetPassword,
  refreshAccessToken,
  logout,
  changePassword,
  getCurrentProfile,
  getAuditLogs,
};
