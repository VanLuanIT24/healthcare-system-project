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
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  passwordResetExpiresInMinutes: parsePositiveNumber(process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES, 15),
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
  corsOrigins: parseList(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
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
  superAdminUsername: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || '',
  superAdminFullName: process.env.SUPER_ADMIN_FULL_NAME || 'System Super Admin',
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || '',
};

validateConfig(env);

module.exports = env;
