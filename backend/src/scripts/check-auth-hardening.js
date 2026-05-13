const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(relativePath, expected, message) {
  const content = read(relativePath);
  if (!content.includes(expected)) {
    throw new Error(`${message} (${relativePath})`);
  }
}

function main() {
  assertIncludes('src/routes/auth.routes.js', 'createAuthRateLimit', 'Auth routes must rate limit sensitive public endpoints.');
  assertIncludes('src/routes/auth.routes.js', 'authRequest.refreshToken', 'Auth routes must validate refresh-token payloads.');
  assertIncludes('src/routes/auth.routes.js', 'authRequest.resetPassword', 'Auth routes must validate reset-password payloads.');

  assertIncludes('src/services/auth/auth-session.service.js', 'AuthSession.findOneAndUpdate', 'Refresh rotation must be atomic.');
  assertIncludes('src/services/auth/auth-session.service.js', 'refresh_token_hash: previousHash', 'Refresh rotation must compare against the previous token hash.');
  assertIncludes('src/services/auth/auth-session.service.js', 'assertCanOwnSession', 'Session rename must be owner-only.');

  assertIncludes('src/services/auth/password-reset.service.js', 'PasswordResetToken.findOneAndUpdate', 'Password reset token consume must be atomic.');
  assertIncludes('src/services/auth/password-reset.service.js', 'used_at: new Date()', 'Password reset must mark tokens as used.');
  assertIncludes('src/services/auth/password-reset.service.js', 'identifier là bắt buộc', 'Code-only reset verification must be tied to an identifier.');

  assertIncludes('src/config/env.js', 'AUTH_EXPOSE_RESET_SECRETS must be false in production.', 'Env validation must block reset secret exposure in production.');
  assertIncludes('src/app.js', 'express.json({ limit: env.requestBodyLimit })', 'App must limit JSON body size.');
  assertIncludes('src/app.js', 'env.corsOrigins.includes(origin)', 'App must enforce configured CORS origins.');

  assertIncludes('src/models/iam/user.model.js', '{ phone: 1 }', 'User phone must have a unique index.');
  assertIncludes('src/models/auth/auth-session.model.js', '{ actor_type: 1, actor_id: 1, revoked_at: 1, expires_at: -1 }', 'Auth sessions need an active-session compound index.');
  assertIncludes('src/models/auth/password-reset-token.model.js', '{ actor_type: 1, actor_id: 1, used_at: 1, revoked_at: 1, expires_at: 1 }', 'Password reset tokens need a consume lookup index.');

  console.log('Auth hardening checks passed.');
}

main();
