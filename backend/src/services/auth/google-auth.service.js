const crypto = require('crypto');
const ApiError = require('../../common/errors/api-error');
const env = require('../../config/env');
const { normalizeLowercase, normalizeString } = require('../../common/helpers/string.helper');
const { AUDIT_STATUS, PATIENT_ACCOUNT_STATUS, PATIENT_STATUS } = require('../../constants/statuses');
const { Patient, PatientAccount } = require('../../models');
const { CODE_TYPE, generateBusinessCode } = require('../code-generator.service');
const auditService = require('../audit.service');
const { withOptionalTransaction } = require('../../shared/utils/transaction');
const patientAuthService = require('./patient-auth.service');
const loginSecurity = require('./login-security.service');
const { ACTOR_TYPE } = require('./auth.policy');

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const STATE_TTL_SECONDS = 10 * 60;

function assertGoogleConfigured() {
  if (!env.googleAuthEnabled) throw ApiError.withCode(503, 'GOOGLE_AUTH_DISABLED', 'Google login is disabled.');
  if (!env.googleClientId || !env.googleClientSecret || !env.googleCallbackUrl) {
    throw ApiError.withCode(503, 'GOOGLE_AUTH_DISABLED', 'Google login is not configured.');
  }
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signStatePayload(payload) {
  return crypto
    .createHmac('sha256', env.jwtRefreshSecret || env.jwtAccessSecret)
    .update(payload)
    .digest('base64url');
}

function createOAuthState() {
  assertGoogleConfigured();
  const payload = base64UrlJson({
    nonce: crypto.randomBytes(24).toString('base64url'),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  });
  return `${payload}.${signStatePayload(payload)}`;
}

function verifyOAuthState(state) {
  const [payload, signature] = String(state || '').split('.');
  if (!payload || !signature) throw ApiError.unauthorized('Google OAuth state is invalid.');
  const expected = signStatePayload(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw ApiError.unauthorized('Google OAuth state is invalid.');
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
    throw ApiError.unauthorized('Google OAuth state has expired.');
  }
  return parsed;
}

function buildAuthorizationUrl(state) {
  assertGoogleConfigured();
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', env.googleClientId);
  url.searchParams.set('redirect_uri', env.googleCallbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

async function fetchGoogleToken(code) {
  if (typeof fetch !== 'function') throw ApiError.internal('fetch is not available.');
  const body = new URLSearchParams({
    code,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    redirect_uri: env.googleCallbackUrl,
    grant_type: 'authorization_code',
  });
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw ApiError.unauthorized('Google authorization code is invalid.');
  return response.json();
}

async function fetchGoogleProfile(accessToken) {
  if (typeof fetch !== 'function') throw ApiError.internal('fetch is not available.');
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw ApiError.unauthorized('Unable to fetch Google profile.');
  return response.json();
}

function normalizeGoogleProfile(profile = {}) {
  const email = normalizeLowercase(profile.email);
  const googleId = normalizeString(profile.sub);
  if (!email || !googleId || profile.email_verified !== true) {
    throw ApiError.unauthorized('Google profile does not include a verified email.');
  }
  return {
    email,
    googleId,
    fullName: normalizeString(profile.name) || email,
    avatarUrl: normalizeString(profile.picture),
    emailVerified: true,
  };
}

async function findAccountByGoogleIdentity({ email, googleId }) {
  return PatientAccount.findOne({
    is_deleted: false,
    $or: [
      { google_id: googleId },
      { email },
    ],
  });
}

function nextProviderForLinkedAccount(account = {}) {
  if (account.auth_provider === 'google') return 'google';
  if (account.auth_provider === 'mixed') return 'mixed';
  return account.password_hash ? 'mixed' : 'google';
}

async function upsertGooglePatientAccount(googleProfile, requestMeta = {}) {
  let account = await findAccountByGoogleIdentity(googleProfile);
  if (account) {
    if (account.google_id && account.google_id !== googleProfile.googleId) {
      throw ApiError.conflict('Email này đã liên kết với tài khoản Google khác.');
    }
    account.google_id = account.google_id || googleProfile.googleId;
    account.auth_provider = nextProviderForLinkedAccount(account);
    account.avatar_url = googleProfile.avatarUrl || account.avatar_url;
    account.email_verified = googleProfile.emailVerified;
    account.email_verified_at = account.email_verified_at || new Date();
    await account.save();

    const patient = await Patient.findById(account.patient_id);
    if (!patient || patient.is_deleted || patient.status !== PATIENT_STATUS.ACTIVE) {
      throw ApiError.unauthorized('Không tìm thấy hồ sơ bệnh nhân.');
    }
    if (!patient.email) {
      patient.email = googleProfile.email;
      await patient.save();
    }
    return { account, patient, created: false };
  }

  const created = await withOptionalTransaction(async (session) => {
    const patientCode = await generateBusinessCode(CODE_TYPE.PATIENT, { session });
    const [patient] = await Patient.create(
      [{
        patient_code: patientCode,
        full_name: googleProfile.fullName,
        email: googleProfile.email,
        status: PATIENT_STATUS.ACTIVE,
      }],
      { session },
    );
    const [patientAccount] = await PatientAccount.create(
      [{
        patient_id: patient._id,
        username: googleProfile.email,
        email: googleProfile.email,
        status: PATIENT_ACCOUNT_STATUS.ACTIVE,
        auth_provider: 'google',
        google_id: googleProfile.googleId,
        avatar_url: googleProfile.avatarUrl,
        email_verified: googleProfile.emailVerified,
        email_verified_at: new Date(),
      }],
      { session },
    );
    return { patient, account: patientAccount };
  }, { fallbackToNoTransaction: env.nodeEnv !== 'production' });

  await auditService.recordAuditLog({
    actorType: ACTOR_TYPE.PATIENT,
    actorId: created.account._id,
    action: 'auth.google.register',
    targetType: 'patient_account',
    targetId: created.account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Patient account registered with Google.',
    requestMeta,
  });

  return { ...created, created: true };
}

async function completeGoogleLogin({ code, state, expectedState } = {}, requestMeta = {}) {
  assertGoogleConfigured();
  if (!code) throw ApiError.badRequest('Google authorization code is required.');
  if (!state || !expectedState || state !== expectedState) {
    throw ApiError.unauthorized('Google OAuth state is invalid.');
  }
  verifyOAuthState(state);

  const token = await fetchGoogleToken(code);
  const googleProfile = normalizeGoogleProfile(await fetchGoogleProfile(token.access_token));
  const { account, patient } = await upsertGooglePatientAccount(googleProfile, requestMeta);

  await loginSecurity.checkAccountStatusBeforeLogin(account, ACTOR_TYPE.PATIENT);
  await loginSecurity.recordLoginSuccess(account, ACTOR_TYPE.PATIENT, {
    ...requestMeta,
    loginMethod: 'google',
  });

  return patientAuthService.createTokenResponse(account, patient, {
    ...requestMeta,
    loginMethod: 'google',
  });
}

module.exports = {
  STATE_TTL_SECONDS,
  createOAuthState,
  buildAuthorizationUrl,
  completeGoogleLogin,
};
