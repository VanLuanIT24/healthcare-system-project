const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isPlaceholderSecret(value) {
  const text = String(value || '').trim().toLowerCase();
  return !text || text.includes('replace_with') || text.includes('change_me') || text === 'secret';
}

function validateConfig(config) {
  const errors = [];
  const isProduction = config.nodeEnv === 'production';

  if (!config.mongodbUri) errors.push('MONGODB_URI is required.');
  if (!config.jwtAccessSecret) errors.push('JWT_ACCESS_SECRET is required.');
  if (!config.jwtRefreshSecret) errors.push('JWT_REFRESH_SECRET is required.');
  if (config.jwtAccessSecret && config.jwtAccessSecret === config.jwtRefreshSecret) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.');
  }

  if (isProduction) {
    if (isPlaceholderSecret(config.jwtAccessSecret)) {
      errors.push('JWT_ACCESS_SECRET must be a strong production secret.');
    }
    if (isPlaceholderSecret(config.jwtRefreshSecret)) {
      errors.push('JWT_REFRESH_SECRET must be a strong production secret.');
    }
    if (isPlaceholderSecret(config.superAdminPassword)) {
      errors.push('SUPER_ADMIN_PASSWORD must be set to a strong production password.');
    }
    if (config.exposeResetSecrets) {
      errors.push('AUTH_EXPOSE_RESET_SECRETS must be false in production.');
    }
    if (!config.corsOrigins.length) {
      errors.push('CORS_ORIGINS must contain at least one origin in production.');
    }
    if (config.corsOrigins.includes('*')) {
      errors.push('CORS_ORIGINS must not contain wildcard "*" in production.');
    }
    if (config.googleAuthEnabled) {
      if (!config.googleClientId) errors.push('GOOGLE_CLIENT_ID is required when GOOGLE_AUTH_ENABLED=true.');
      if (!config.googleClientSecret) errors.push('GOOGLE_CLIENT_SECRET is required when GOOGLE_AUTH_ENABLED=true.');
      if (!config.googleCallbackUrl) errors.push('GOOGLE_CALLBACK_URL is required when GOOGLE_AUTH_ENABLED=true.');
    }
    if (config.momoPersonalQrEnabled && !config.momoPersonalQrImageUrl && !config.momoPersonalQrImagePath) {
      errors.push('MOMO_PERSONAL_QR_IMAGE_URL or MOMO_PERSONAL_QR_IMAGE_PATH is required when MOMO_PERSONAL_QR_ENABLED=true.');
    }
  }

  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
  }
}

const env = {
  port: parsePositiveNumber(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || '',
  mongodbDbName: process.env.MONGODB_DB_NAME || '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || '',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
  jwtIssuer: process.env.JWT_ISSUER || '',
  jwtAudience: process.env.JWT_AUDIENCE || '',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  passwordResetExpiresInMinutes: parsePositiveNumber(process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES, 15),
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
  corsOrigins: parseList(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
  redisUrl: process.env.REDIS_URL || '',
  realtimeRedisEnabled: parseBoolean(process.env.REALTIME_REDIS_ENABLED, Boolean(process.env.REDIS_URL)),
  jobsRedisEnabled: parseBoolean(process.env.JOBS_REDIS_ENABLED, Boolean(process.env.REDIS_URL)),
  jobWorkerConcurrency: parsePositiveNumber(process.env.JOB_WORKER_CONCURRENCY, 5),
  exposeResetSecrets: parseBoolean(process.env.AUTH_EXPOSE_RESET_SECRETS, false),
  smtpEnabled: parseBoolean(
    process.env.SMTP_ENABLED,
    Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM_EMAIL),
  ),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parsePositiveNumber(process.env.SMTP_PORT, 587),
  smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFromName: process.env.SMTP_FROM_NAME || 'MedCare Portal',
  smtpFromEmail: process.env.SMTP_FROM_EMAIL || '',
  smtpReplyTo: process.env.SMTP_REPLY_TO || '',
  pushProviderUrl: process.env.PUSH_PROVIDER_URL || '',
  pushProviderToken: process.env.PUSH_PROVIDER_TOKEN || '',
  bankQrBankBin: process.env.BANK_QR_BANK_BIN || '',
  bankQrAccountNo: process.env.BANK_QR_ACCOUNT_NO || '',
  bankQrAccountName: process.env.BANK_QR_ACCOUNT_NAME || '',
  bankQrTemplate: process.env.BANK_QR_TEMPLATE || 'compact2',
  bankQrIntentTtlMinutes: parsePositiveNumber(process.env.BANK_QR_INTENT_TTL_MINUTES, 30),
  googleAuthEnabled: parseBoolean(process.env.GOOGLE_AUTH_ENABLED, false),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  frontendAuthSuccessUrl: process.env.FRONTEND_AUTH_SUCCESS_URL || 'http://localhost:5173/auth/success',
  frontendAuthFailureUrl: process.env.FRONTEND_AUTH_FAILURE_URL || 'http://localhost:5173/auth/failure',
  manualPaymentEnabled: parseBoolean(process.env.MANUAL_PAYMENT_ENABLED, true),
  paymentReceiptUploadEnabled: parseBoolean(process.env.PAYMENT_RECEIPT_UPLOAD_ENABLED, true),
  paymentReceiptMaxSizeBytes: parsePositiveNumber(process.env.PAYMENT_RECEIPT_MAX_SIZE_BYTES, 5 * 1024 * 1024),
  momoPersonalQrEnabled: parseBoolean(process.env.MOMO_PERSONAL_QR_ENABLED, false),
  momoPersonalQrImageUrl: process.env.MOMO_PERSONAL_QR_IMAGE_URL || '',
  momoPersonalQrImagePath: process.env.MOMO_PERSONAL_QR_IMAGE_PATH || 'uploads/payment/momo-qr.png',
  momoPersonalPhone: process.env.MOMO_PERSONAL_PHONE || '',
  momoPersonalAccountName: process.env.MOMO_PERSONAL_ACCOUNT_NAME || '',
  momoPersonalNotePrefix: process.env.MOMO_PERSONAL_NOTE_PREFIX || 'MEDCARE',
  superAdminUsername: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || '',
  superAdminFullName: process.env.SUPER_ADMIN_FULL_NAME || 'System Super Admin',
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || '',
};

validateConfig(env);

module.exports = env;
