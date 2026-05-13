const { AuditLog, AuthSession, PasswordResetToken } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  auditLogRepository: AuditLog,
  authSessionRepository: AuthSession,
  passwordResetTokenRepository: PasswordResetToken,
});
