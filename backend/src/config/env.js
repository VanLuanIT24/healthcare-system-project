const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || '',
  mongodbDbName: process.env.MONGODB_DB_NAME || '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || '',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  passwordResetExpiresInMinutes: Number(process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES || 15),
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
  exposeResetSecrets: String(process.env.AUTH_EXPOSE_RESET_SECRETS || 'false').toLowerCase() === 'true',
  superAdminUsername: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || '',
  superAdminFullName: process.env.SUPER_ADMIN_FULL_NAME || 'System Super Admin',
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || '',
};
