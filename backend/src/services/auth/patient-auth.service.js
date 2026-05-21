const ApiError = require('../../common/errors/api-error');
const env = require('../../config/env');
const { normalizeLowercase, normalizePhone, normalizeString } = require('../../common/helpers/string.helper');
const { AUDIT_STATUS, PATIENT_ACCOUNT_STATUS, PATIENT_STATUS } = require('../../constants/statuses');
const { Patient, PatientAccount } = require('../../models');
const { CODE_TYPE, generateBusinessCode } = require('../code-generator.service');
const auditService = require('../audit.service');
const { withOptionalTransaction } = require('../../shared/utils/transaction');
const sessionService = require('./auth-session.service');
const {
  ACTOR_TYPE,
  AUTH_MESSAGES,
  PATIENT_PORTAL_PERMISSIONS,
  getActorId,
} = require('./auth.policy');
const loginSecurity = require('./login-security.service');
const passwordService = require('./password.service');
const rateLimitService = require('./rate-limit.service');
const tokenService = require('./token.service');

function sanitizePatient(patient, account) {
  const patientPlain = typeof patient.toObject === 'function' ? patient.toObject() : patient;
  const accountPlain = typeof account.toObject === 'function' ? account.toObject() : account;

  return {
    id: String(patientPlain._id || patientPlain.id),
    patient_id: String(patientPlain._id || patientPlain.id),
    patient_account_id: String(accountPlain._id || accountPlain.id),
    patient_code: patientPlain.patient_code,
    full_name: patientPlain.full_name,
    date_of_birth: patientPlain.date_of_birth,
    gender: patientPlain.gender,
    email: accountPlain.email || patientPlain.email,
    phone: accountPlain.phone || patientPlain.phone,
    auth_provider: accountPlain.auth_provider || 'local',
    avatar_url: accountPlain.avatar_url,
    email_verified: Boolean(accountPlain.email_verified || accountPlain.email_verified_at),
    status: accountPlain.status,
    roles: ['patient'],
    permissions: PATIENT_PORTAL_PERMISSIONS,
  };
}

function buildPatientIdentifierFilter(identifier) {
  const lower = normalizeLowercase(identifier);
  const phone = normalizePhone(identifier);
  const raw = normalizeString(identifier);

  return {
    is_deleted: false,
    $or: [
      { username: lower || raw },
      { email: lower },
      { phone },
    ].filter((item) => Object.values(item)[0]),
  };
}

async function findPatientAccountByIdentifier(identifier) {
  return PatientAccount.findOne(buildPatientIdentifierFilter(identifier));
}

const DUPLICATE_FIELD_MESSAGES = Object.freeze({
  email: 'Email đã được sử dụng.',
  phone: 'Số điện thoại đã được sử dụng.',
  username: 'Tên đăng nhập đã được sử dụng.',
  national_id: 'Số giấy tờ tùy thân đã tồn tại trong hệ thống.',
  insurance_number: 'Số bảo hiểm y tế đã tồn tại trong hệ thống.',
  patient_id: 'Hồ sơ bệnh nhân này đã có tài khoản.',
});

function buildDuplicateFieldDetail(field, context = {}) {
  if (field === 'username' && context.usernameProvided === false && (context.email || context.phone)) {
    return {
      field,
      message: 'Tên đăng nhập mặc định tạo từ email hoặc số điện thoại đã được sử dụng. Vui lòng nhập tên đăng nhập khác.',
    };
  }

  const message = DUPLICATE_FIELD_MESSAGES[field];
  return message ? { field, message } : null;
}

function dedupeConflictDetails(details = []) {
  const seen = new Set();
  return details.filter((item) => {
    if (!item?.field || !item?.message || seen.has(item.field)) return false;
    seen.add(item.field);
    return true;
  });
}

function buildConflictError(details = [], options = {}) {
  const normalizedDetails = dedupeConflictDetails(details);
  const fallbackMessage = options.fallbackMessage || 'Dữ liệu đã tồn tại trong hệ thống.';
  const singleMessage = options.singleMessage || fallbackMessage;
  const multipleMessage = options.multipleMessage || fallbackMessage;

  if (normalizedDetails.length === 1) {
    return ApiError.conflict(singleMessage, normalizedDetails);
  }

  if (normalizedDetails.length > 1) {
    return ApiError.conflict(multipleMessage, normalizedDetails);
  }

  return ApiError.conflict(fallbackMessage);
}

function extractDuplicateFields(error) {
  return [...new Set([
    ...Object.keys(error?.keyPattern || {}),
    ...Object.keys(error?.keyValue || {}),
  ])];
}

function buildPatientAccountConflictDetails(existingAccount, context = {}) {
  const details = [];
  const shouldReportUsername = Boolean(
    context.username && (context.usernameProvided || (!context.email && !context.phone)),
  );

  if (context.email && existingAccount?.email === context.email) {
    details.push(buildDuplicateFieldDetail('email', context));
  }
  if (context.phone && existingAccount?.phone === context.phone) {
    details.push(buildDuplicateFieldDetail('phone', context));
  }
  if (shouldReportUsername && existingAccount?.username === context.username) {
    details.push(buildDuplicateFieldDetail('username', context));
  }
  if (details.length === 0 && context.username && existingAccount?.username === context.username) {
    details.push(buildDuplicateFieldDetail('username', context));
  }

  return dedupeConflictDetails(details);
}

function normalizePatientAccountDuplicateError(error, context = {}) {
  if (error?.code !== 11000) return error;

  const details = dedupeConflictDetails(
    extractDuplicateFields(error)
      .map((field) => buildDuplicateFieldDetail(field, context))
      .filter(Boolean),
  );

  if (details.length > 0) {
    return buildConflictError(details, {
      fallbackMessage: 'Thông tin tài khoản đã được sử dụng.',
      singleMessage: 'Thông tin tài khoản đã được sử dụng.',
      multipleMessage: 'Một số thông tin tài khoản đã được sử dụng.',
    });
  }

  return buildConflictError([
    context.email ? buildDuplicateFieldDetail('email', context) : null,
    context.phone ? buildDuplicateFieldDetail('phone', context) : null,
    context.username ? buildDuplicateFieldDetail('username', context) : null,
  ], {
    fallbackMessage: 'Thông tin tài khoản đã được sử dụng.',
    singleMessage: 'Thông tin tài khoản đã được sử dụng.',
    multipleMessage: 'Một số thông tin tài khoản đã được sử dụng.',
  });
}

function normalizePatientRegistrationDuplicateError(error, context = {}) {
  if (error?.code !== 11000) return error;

  const details = dedupeConflictDetails(
    extractDuplicateFields(error)
      .map((field) => buildDuplicateFieldDetail(field, context))
      .filter(Boolean),
  );

  if (details.length > 0) {
    return buildConflictError(details, {
      fallbackMessage: 'Thông tin đăng ký đã bị trùng.',
      singleMessage: 'Thông tin đăng ký đã bị trùng.',
      multipleMessage: 'Một số thông tin đăng ký đã bị trùng.',
    });
  }

  return buildConflictError([
    context.email ? buildDuplicateFieldDetail('email', context) : null,
    context.phone ? buildDuplicateFieldDetail('phone', context) : null,
    context.username ? buildDuplicateFieldDetail('username', context) : null,
    context.nationalId ? buildDuplicateFieldDetail('national_id', context) : null,
    context.insuranceNumber ? buildDuplicateFieldDetail('insurance_number', context) : null,
  ], {
    fallbackMessage: 'Thông tin đăng ký đã bị trùng.',
    singleMessage: 'Thông tin đăng ký đã bị trùng.',
    multipleMessage: 'Một số thông tin đăng ký đã bị trùng.',
  });
}

async function createTokenResponse(account, patient, requestMeta = {}) {
  const refreshToken = tokenService.generateRefreshToken();
  const session = await sessionService.createAuthSession(ACTOR_TYPE.PATIENT, account._id, refreshToken, requestMeta);
  const accessToken = tokenService.generateAccessToken({
    actorType: ACTOR_TYPE.PATIENT,
    actorId: account._id,
    sessionId: session._id,
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: tokenService.getAccessTokenExpiresInSeconds(),
    actor_type: ACTOR_TYPE.PATIENT,
    patient: sanitizePatient(patient, account),
    roles: ['patient'],
    permissions: PATIENT_PORTAL_PERMISSIONS,
    tokens: {
      access_token: accessToken,
      refresh_token: refreshToken,
    },
  };
}

async function assertPatientRegistrationUnique({ email, phone, username, usernameProvided, nationalId, insuranceNumber }) {
  const accountOr = [
    ...(username ? [{ username }] : []),
    ...(email ? [{ email }] : []),
    ...(phone ? [{ phone }] : []),
  ];

  if (accountOr.length) {
    const existedAccount = await PatientAccount.findOne({
      is_deleted: false,
      $or: accountOr,
    }).lean();

    if (existedAccount) {
      throw buildConflictError(buildPatientAccountConflictDetails(existedAccount, {
        email,
        phone,
        username,
        usernameProvided,
      }), {
        fallbackMessage: 'Thông tin tài khoản đã được sử dụng.',
        singleMessage: 'Thông tin tài khoản đã được sử dụng.',
        multipleMessage: 'Một số thông tin tài khoản đã được sử dụng.',
      });
    }
  }

  const patientOr = [
    ...(nationalId ? [{ national_id: nationalId }] : []),
    ...(insuranceNumber ? [{ insurance_number: insuranceNumber }] : []),
  ];

  if (patientOr.length > 0) {
    const existedPatient = await Patient.findOne({
      is_deleted: false,
      $or: patientOr,
    }).lean();

    if (existedPatient) {
      throw buildConflictError([
        nationalId && existedPatient?.national_id === nationalId ? buildDuplicateFieldDetail('national_id') : null,
        insuranceNumber && existedPatient?.insurance_number === insuranceNumber
          ? buildDuplicateFieldDetail('insurance_number')
          : null,
      ], {
        fallbackMessage: 'Thông tin định danh đã tồn tại trong hệ thống.',
        singleMessage: 'Thông tin định danh đã tồn tại trong hệ thống.',
        multipleMessage: 'Một số thông tin định danh đã tồn tại trong hệ thống.',
      });
    }
  }
}

async function assertPatientAccountUnique({ email, phone, username, usernameProvided = Boolean(username) }, excludeAccountId = null) {
  const conditions = [
    ...(username ? [{ username }] : []),
    ...(email ? [{ email }] : []),
    ...(phone ? [{ phone }] : []),
  ];

  if (!conditions.length) return true;

  const existed = await PatientAccount.findOne({
    is_deleted: false,
    ...(excludeAccountId ? { _id: { $ne: excludeAccountId } } : {}),
    $or: conditions,
  }).lean();

  if (existed) {
    throw buildConflictError(buildPatientAccountConflictDetails(existed, {
      email,
      phone,
      username,
      usernameProvided,
    }), {
      fallbackMessage: 'Thông tin tài khoản đã được sử dụng.',
      singleMessage: 'Thông tin tài khoản đã được sử dụng.',
      multipleMessage: 'Một số thông tin tài khoản đã được sử dụng.',
    });
  }

  return true;
}

function resolveManagedAccountId(payload = {}, actor = {}) {
  return payload.account_id
    || payload.patient_account_id
    || payload.patientAccountId
    || (actor.actorType === ACTOR_TYPE.PATIENT ? getActorId(actor) : null);
}

async function getManagedPatientAccount(payload = {}, actor = {}) {
  const accountId = resolveManagedAccountId(payload, actor);
  if (!accountId) throw ApiError.validation('patient_account_id là bắt buộc.');

  const account = await PatientAccount.findById(accountId);
  if (!account || account.is_deleted) throw ApiError.notFound('Không tìm thấy tài khoản bệnh nhân.');

  if (actor.actorType === ACTOR_TYPE.PATIENT && String(account._id) !== String(getActorId(actor))) {
    throw ApiError.forbidden('Bạn chỉ được thao tác tài khoản bệnh nhân của chính mình.');
  }

  return account;
}

async function updatePatientAccountEmail(payload = {}, actor = {}, requestMeta = {}) {
  const email = normalizeLowercase(payload.email);
  if (!email) throw ApiError.validation('email là bắt buộc.');

  const account = await getManagedPatientAccount(payload, actor);
  await assertPatientAccountUnique({ email }, account._id);
  account.email = email;
  account.email_verified_at = undefined;
  account.updated_by = actor.actorType === ACTOR_TYPE.STAFF ? getActorId(actor) : undefined;
  try {
    await account.save();
  } catch (error) {
    throw normalizePatientAccountDuplicateError(error, { email, usernameProvided: false });
  }

  await auditService.recordAuditLog({
    actor,
    action: 'patient_account.update_email',
    targetType: 'patient_account',
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Patient account email updated.',
    requestMeta,
  });

  return { account: sanitizePatient(await Patient.findById(account.patient_id).lean(), account) };
}

async function updatePatientAccountPhone(payload = {}, actor = {}, requestMeta = {}) {
  const phone = normalizePhone(payload.phone);
  if (!phone) throw ApiError.validation('phone là bắt buộc.');

  const account = await getManagedPatientAccount(payload, actor);
  await assertPatientAccountUnique({ phone }, account._id);
  account.phone = phone;
  account.phone_verified_at = undefined;
  account.updated_by = actor.actorType === ACTOR_TYPE.STAFF ? getActorId(actor) : undefined;
  try {
    await account.save();
  } catch (error) {
    throw normalizePatientAccountDuplicateError(error, { phone, usernameProvided: false });
  }

  await auditService.recordAuditLog({
    actor,
    action: 'patient_account.update_phone',
    targetType: 'patient_account',
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Patient account phone updated.',
    requestMeta,
  });

  return { account: sanitizePatient(await Patient.findById(account.patient_id).lean(), account) };
}

async function changePatientUsername(payload = {}, actor = {}, requestMeta = {}) {
  const username = normalizeLowercase(payload.username);
  if (!username) throw ApiError.validation('username là bắt buộc.');

  const account = await getManagedPatientAccount(payload, actor);
  await assertPatientAccountUnique({ username }, account._id);
  account.username = username;
  account.updated_by = actor.actorType === ACTOR_TYPE.STAFF ? getActorId(actor) : undefined;
  try {
    await account.save();
  } catch (error) {
    throw normalizePatientAccountDuplicateError(error, { username, usernameProvided: true });
  }

  await auditService.recordAuditLog({
    actor,
    action: 'patient_account.change_username',
    targetType: 'patient_account',
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Patient account username changed.',
    requestMeta,
  });

  return { account: sanitizePatient(await Patient.findById(account.patient_id).lean(), account) };
}

async function updatePatientAccountStatus(payload = {}, status, actor = {}, requestMeta = {}) {
  const account = await getManagedPatientAccount(payload, actor);
  account.status = status;
  account.updated_by = actor.actorType === ACTOR_TYPE.STAFF ? getActorId(actor) : undefined;
  if (status === PATIENT_ACCOUNT_STATUS.ACTIVE) {
    account.locked_until = undefined;
    account.failed_login_attempts = 0;
  }
  if (status === PATIENT_ACCOUNT_STATUS.LOCKED && !account.locked_until) {
    account.locked_until = new Date(Date.now() + 15 * 60 * 1000);
  }
  await account.save();

  if (status !== PATIENT_ACCOUNT_STATUS.ACTIVE) {
    await sessionService.invalidateAllUserSessions(ACTOR_TYPE.PATIENT, account._id, requestMeta, {
      actorType: actor.actorType,
      actorId: getActorId(actor),
      reason: `patient_account_${status}`,
    });
  }

  await auditService.recordAuditLog({
    actor,
    action: `patient_account.${status}`,
    targetType: 'patient_account',
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: `Patient account status changed to ${status}.`,
    requestMeta,
  });

  return { account: sanitizePatient(await Patient.findById(account.patient_id).lean(), account) };
}

function deactivatePatientAccount(payload = {}, actor = {}, requestMeta = {}) {
  return updatePatientAccountStatus(payload, PATIENT_ACCOUNT_STATUS.DISABLED, actor, requestMeta);
}

function lockPatientAccount(payload = {}, actor = {}, requestMeta = {}) {
  return updatePatientAccountStatus(payload, PATIENT_ACCOUNT_STATUS.LOCKED, actor, requestMeta);
}

function unlockPatientAccount(payload = {}, actor = {}, requestMeta = {}) {
  return updatePatientAccountStatus(payload, PATIENT_ACCOUNT_STATUS.ACTIVE, actor, requestMeta);
}

async function createPatientAccountForExistingPatient(payload = {}, actor = {}, requestMeta = {}) {
  const patientId = payload.patient_id || payload.patientId;
  const password = payload.password || payload.temporary_password;
  const email = normalizeLowercase(payload.email);
  const phone = normalizePhone(payload.phone);
  const providedUsername = normalizeLowercase(payload.username);
  const username = providedUsername || email || phone;

  if (!patientId || !password || !username) {
    throw ApiError.validation('patient_id, username/email/phone và password là bắt buộc.');
  }

  const patient = await Patient.findById(patientId);
  if (!patient || patient.is_deleted) throw ApiError.notFound('Không tìm thấy hồ sơ bệnh nhân.');
  if (patient.status && patient.status !== PATIENT_STATUS.ACTIVE) {
    throw ApiError.conflict('Chỉ có thể tạo tài khoản cho hồ sơ bệnh nhân active.');
  }

  const existingAccount = await PatientAccount.findOne({ patient_id: patient._id, is_deleted: false }).lean();
  if (existingAccount) throw ApiError.conflict('Hồ sơ bệnh nhân này đã có tài khoản.');

  await assertPatientAccountUnique({ email, phone, username, usernameProvided: Boolean(providedUsername) });
  passwordService.validatePasswordPolicy({
    password,
    username,
    email,
    phone,
    actorType: ACTOR_TYPE.PATIENT,
  });

  let account;
  try {
    account = await PatientAccount.create({
      patient_id: patient._id,
      username,
      email,
      phone,
      password_hash: await passwordService.hashPassword(password),
      status: PATIENT_ACCOUNT_STATUS.ACTIVE,
      password_changed_at: new Date(),
      created_by: actor.actorType === ACTOR_TYPE.STAFF ? getActorId(actor) : undefined,
    });
  } catch (error) {
    throw normalizePatientAccountDuplicateError(error, {
      email,
      phone,
      username,
      usernameProvided: Boolean(providedUsername),
    });
  }

  await auditService.recordAuditLog({
    actor,
    action: 'patient_account.create_for_existing_patient',
    targetType: 'patient_account',
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Patient account created for existing patient.',
    requestMeta,
    metadata: { patient_id: String(patient._id) },
  });

  return { patient: sanitizePatient(patient, account) };
}

function linkExistingPatientToAccount(payload = {}, actor = {}, requestMeta = {}) {
  return createPatientAccountForExistingPatient(payload, actor, requestMeta);
}

async function registerPatient(payload = {}, requestMeta = {}) {
  const fullName = normalizeString(payload.full_name);
  const password = payload.password;
  const confirmPassword = payload.confirm_password;
  const email = normalizeLowercase(payload.email);
  const phone = normalizePhone(payload.phone);
  const providedUsername = normalizeLowercase(payload.username);
  const username = providedUsername || email || phone;
  const nationalId = normalizeString(payload.national_id);
  const insuranceNumber = normalizeString(payload.insurance_number);

  if (!fullName || !password) {
    throw ApiError.validation('full_name và password là bắt buộc.');
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw ApiError.validation('Mật khẩu xác nhận không khớp.');
  }

  if (!email && !phone && !username) {
    throw ApiError.validation('Cần có email, phone hoặc username để tạo tài khoản bệnh nhân.');
  }

  passwordService.validatePasswordPolicy({
    password,
    username,
    email,
    phone,
    actorType: ACTOR_TYPE.PATIENT,
  });

  await assertPatientRegistrationUnique({
    email,
    phone,
    username,
    usernameProvided: Boolean(providedUsername),
    nationalId,
    insuranceNumber,
  });

  let patient;
  let account;
  try {
    const created = await withOptionalTransaction(async (session) => {
      const patientCode = await generateBusinessCode(CODE_TYPE.PATIENT, { session });
      const [createdPatient] = await Patient.create(
        [{
          patient_code: patientCode,
          full_name: fullName,
          date_of_birth: payload.date_of_birth,
          gender: payload.gender,
          phone,
          email,
          address: payload.address,
          national_id: nationalId,
          insurance_number: insuranceNumber,
          emergency_contact_name: normalizeString(payload.emergency_contact_name),
          emergency_contact_phone: normalizePhone(payload.emergency_contact_phone),
          status: 'active',
        }],
        { session },
      );

      const [createdAccount] = await PatientAccount.create(
        [{
          patient_id: createdPatient._id,
          username,
          email,
          phone,
          password_hash: await passwordService.hashPassword(password),
          status: PATIENT_ACCOUNT_STATUS.ACTIVE,
          password_changed_at: new Date(),
        }],
        { session },
      );

      return {
        patient: createdPatient,
        account: createdAccount,
      };
    }, { fallbackToNoTransaction: env.nodeEnv !== 'production' });

    patient = created.patient;
    account = created.account;
  } catch (error) {
    throw normalizePatientRegistrationDuplicateError(error, {
      email,
      phone,
      username,
      usernameProvided: Boolean(providedUsername),
      nationalId,
      insuranceNumber,
    });
  }

  await auditService.recordAuditLog({
    actorType: ACTOR_TYPE.PATIENT,
    actorId: account._id,
    action: 'auth.patient.register',
    targetType: 'patient_account',
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Patient account registered.',
    requestMeta,
  });

  return {
    patient: sanitizePatient(patient, account),
  };
}

async function loginPatient(payload = {}, requestMeta = {}) {
  const identifier = payload.login || payload.username || payload.identifier || payload.email || payload.phone;
  const password = payload.password;

  if (!identifier || !password) {
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  rateLimitService.checkLoginRateLimitByIp(requestMeta.ipAddress || requestMeta.ip);
  rateLimitService.checkLoginRateLimitByIdentifier(identifier, ACTOR_TYPE.PATIENT);

  const account = await findPatientAccountByIdentifier(identifier);
  if (!account) {
    await loginSecurity.recordLoginFailure(null, ACTOR_TYPE.PATIENT, 'account_not_found', requestMeta);
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  try {
    await loginSecurity.checkAccountStatusBeforeLogin(account, ACTOR_TYPE.PATIENT);
  } catch (error) {
    await loginSecurity.recordLoginFailure(account, ACTOR_TYPE.PATIENT, `status_${account.status}`, requestMeta);
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  if (!account.password_hash) {
    await loginSecurity.recordLoginFailure(account, ACTOR_TYPE.PATIENT, 'password_login_not_available', requestMeta);
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  const isValidPassword = await passwordService.comparePassword(password, account.password_hash);
  if (!isValidPassword) {
    await loginSecurity.recordLoginFailure(account, ACTOR_TYPE.PATIENT, 'invalid_password', requestMeta);
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  const patient = await Patient.findById(account.patient_id);
  if (!patient || patient.is_deleted || patient.status !== PATIENT_STATUS.ACTIVE) {
    await loginSecurity.recordLoginFailure(account, ACTOR_TYPE.PATIENT, 'patient_profile_missing', requestMeta);
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  await loginSecurity.recordLoginSuccess(account, ACTOR_TYPE.PATIENT, requestMeta);
  return createTokenResponse(account, patient, requestMeta);
}

module.exports = {
  // PATIENT_PORTAL_PERMISSIONS: Định nghĩa hằng số/cấu hình patient portal permissions dùng chung trong service.
  PATIENT_PORTAL_PERMISSIONS,
  // sanitizePatient: Ẩn dữ liệu nhạy cảm trước khi trả thông tin bệnh nhân ra ngoài.
  sanitizePatient,
  // findPatientAccountByIdentifier: Tìm tài khoản bệnh nhân theo email, số điện thoại hoặc tên đăng nhập.
  findPatientAccountByIdentifier,
  // createTokenResponse: Tạo cặp access/refresh token cho tài khoản bệnh nhân.
  createTokenResponse,
  // registerPatient: Đăng ký tài khoản bệnh nhân mới.
  registerPatient,
  // loginPatient: Đăng nhập tài khoản bệnh nhân.
  loginPatient,
  // updatePatientAccountEmail: Cập nhật email tài khoản bệnh nhân.
  updatePatientAccountEmail,
  // updatePatientAccountPhone: Cập nhật số điện thoại tài khoản bệnh nhân.
  updatePatientAccountPhone,
  // changePatientUsername: Đổi tên đăng nhập của tài khoản bệnh nhân.
  changePatientUsername,
  // deactivatePatientAccount: Vô hiệu hóa tài khoản bệnh nhân.
  deactivatePatientAccount,
  // lockPatientAccount: Khóa tài khoản bệnh nhân.
  lockPatientAccount,
  // unlockPatientAccount: Mở khóa tài khoản bệnh nhân.
  unlockPatientAccount,
  // linkExistingPatientToAccount: Liên kết hồ sơ bệnh nhân hiện có với tài khoản đăng nhập.
  linkExistingPatientToAccount,
  // createPatientAccountForExistingPatient: Tạo tài khoản cho bệnh nhân đã tồn tại.
  createPatientAccountForExistingPatient,
};
