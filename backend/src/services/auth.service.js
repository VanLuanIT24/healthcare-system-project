const { mongoose } = require('../config/database');
const {
  AuthSession,
  Patient,
  PatientAccount,
  Permission,
  Role,
  RolePermission,
  User,
  UserRole,
  hashRefreshToken,
} = require('../models');
const { comparePassword, hashPassword } = require('../utils/password');
const { signAccessToken, signRefreshToken } = require('../utils/tokens');

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_IN_MINUTES = 15;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-\s]{8,20}$/;

function generatePatientCode() {
  return `PT${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function calculateLockUntil() {
  return new Date(Date.now() + LOCK_TIME_IN_MINUTES * 60 * 1000);
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

  if (value.length < 8) {
    throw createError('Mật khẩu phải có ít nhất 8 ký tự.');
  }

  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw createError('Mật khẩu phải gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
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
    roles: ['patient'],
    permissions: ['patients.self.read', 'patients.self.update'],
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

  const refreshPayload = JSON.parse(Buffer.from(refreshToken.split('.')[1], 'base64url').toString());

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

async function resetFailedAttempts(account) {
  account.failed_login_attempts = 0;
  account.locked_until = undefined;
  account.last_login_at = new Date();
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
  if (account.locked_until && account.locked_until > new Date()) {
    throw createError(`${label} đang tạm bị khóa do đăng nhập sai quá số lần cho phép.`, 423);
  }

  if (account.status !== 'active') {
    throw createError(`${label} hiện ${getStatusLabel(account.status)}.`, 403);
  }
}

async function loginStaff({ username, password }, requestMeta = {}) {
  const normalizedUsername = String(username || '').trim();
  validateRequired(normalizedUsername, 'Tên đăng nhập');
  validateRequired(password, 'Mật khẩu');
  const user = await User.findOne({ username: normalizedUsername, is_deleted: false });

  if (!user) {
    throw createError('Tên đăng nhập hoặc mật khẩu không đúng.', 401);
  }

  ensureAccountCanLogin(user, 'Tài khoản nhân sự');

  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    await registerFailedAttempt(user);
    throw createError('Tên đăng nhập hoặc mật khẩu không đúng.', 401);
  }

  await resetFailedAttempts(user);

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

async function createStaffAccount(payload, actor) {
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
          employee_code,
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

async function assignRolesToStaff({ user_id, role_codes }, actor) {
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

  const roles = await Role.find({ role_code: { $in: role_codes }, status: 'active' });
  if (roles.length !== role_codes.length) {
    throw createError('Có vai trò không hợp lệ hoặc đã bị vô hiệu hóa.');
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
  return {
    user: sanitizeStaff(user, authorization),
  };
}

async function registerPatient(payload, requestMeta = {}) {
  const {
    full_name,
    password,
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
      permissions: ['patients.self.read', 'patients.self.update'],
      userAgent: requestMeta.userAgent,
      ipAddress: requestMeta.ipAddress,
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
    throw createError('Thông tin đăng nhập hoặc mật khẩu không đúng.', 401);
  }

  ensureAccountCanLogin(account, 'Tài khoản bệnh nhân');

  const isValidPassword = await comparePassword(password, account.password_hash);
  if (!isValidPassword) {
    await registerFailedAttempt(account);
    throw createError('Thông tin đăng nhập hoặc mật khẩu không đúng.', 401);
  }

  await resetFailedAttempts(account);

  const patient = await Patient.findById(account.patient_id);
  if (!patient) {
    throw createError('Không tìm thấy hồ sơ bệnh nhân.', 404);
  }

  const tokens = await createSession({
    actorType: 'patient',
    actorId: account._id,
    roles: ['patient'],
    permissions: ['patients.self.read', 'patients.self.update'],
    userAgent: requestMeta.userAgent,
    ipAddress: requestMeta.ipAddress,
  });

  return {
    patient: sanitizePatient(patient, account),
    tokens,
  };
}

async function refreshAccessToken({ refresh_token }, requestMeta = {}) {
  if (!refresh_token) {
    throw createError('Thiếu refresh_token.', 400);
  }

  const { verify } = require('jsonwebtoken');
  const env = require('../config/env');
  let payload;
  try {
    payload = verify(refresh_token, env.jwtRefreshSecret);
  } catch (error) {
    throw createError('Refresh token không hợp lệ hoặc đã hết hạn.', 401);
  }

  const currentSession = await revokeSessionByRefreshToken(refresh_token);

  if (payload.actor_type === 'staff') {
    const user = await User.findById(payload.sub);
    if (!user) throw createError('Không tìm thấy tài khoản nhân sự.', 404);
    const authorization = await getStaffAuthorization(user._id);

    const tokens = await createSession({
      actorType: 'staff',
      actorId: user._id,
      roles: authorization.roleCodes,
      permissions: authorization.permissionCodes,
      userAgent: requestMeta.userAgent || currentSession.user_agent,
      ipAddress: requestMeta.ipAddress || currentSession.ip_address,
    });

    return {
      ...tokens,
    };
  }

  const account = await PatientAccount.findById(payload.sub);
  if (!account) throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);

  const tokens = await createSession({
    actorType: 'patient',
    actorId: account._id,
    roles: ['patient'],
    permissions: ['patients.self.read', 'patients.self.update'],
    userAgent: requestMeta.userAgent || currentSession.user_agent,
    ipAddress: requestMeta.ipAddress || currentSession.ip_address,
  });

  return tokens;
}

async function logout({ refresh_token }) {
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

  return { success: true };
}

async function changePassword(auth, payload) {
  const { current_password, new_password } = payload;

  if (!current_password || !new_password) {
    throw createError('current_password và new_password là bắt buộc.');
  }

  validatePasswordStrength(new_password);

  if (auth.actorType === 'staff') {
    const user = await User.findById(auth.userId);
    if (!user) throw createError('Không tìm thấy tài khoản nhân sự.', 404);

    const isValid = await comparePassword(current_password, user.password_hash);
    if (!isValid) throw createError('Mật khẩu hiện tại không đúng.', 400);

    user.password_hash = await hashPassword(new_password);
    user.password_changed_at = new Date();
    user.must_change_password = false;
    await user.save();

    await AuthSession.updateMany(
      { actor_type: 'staff', actor_id: user._id, revoked_at: null },
      { $set: { revoked_at: new Date() } },
    );

    return { success: true };
  }

  const account = await PatientAccount.findById(auth.patientAccountId);
  if (!account) throw createError('Không tìm thấy tài khoản bệnh nhân.', 404);

  const isValid = await comparePassword(current_password, account.password_hash);
  if (!isValid) throw createError('Mật khẩu hiện tại không đúng.', 400);

  account.password_hash = await hashPassword(new_password);
  account.password_changed_at = new Date();
  await account.save();

  await AuthSession.updateMany(
    { actor_type: 'patient', actor_id: account._id, revoked_at: null },
    { $set: { revoked_at: new Date() } },
  );

  return { success: true };
}

async function getCurrentProfile(auth) {
  if (auth.actorType === 'staff') {
    const authorization = await getStaffAuthorization(auth.user._id);
    return sanitizeStaff(auth.user, authorization);
  }

  return sanitizePatient(auth.patient, auth.account);
}

module.exports = {
  loginStaff,
  createStaffAccount,
  assignRolesToStaff,
  registerPatient,
  loginPatient,
  refreshAccessToken,
  logout,
  changePassword,
  getCurrentProfile,
};
