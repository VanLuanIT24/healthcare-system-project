const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const ApiError = require('../../common/errors/api-error');
const { hashRefreshToken } = require('../../models');
const { AUTHENTICATED_ACTOR_TYPES, normalizeActorType } = require('../../constants/statuses');
const { TOKEN_TYPE } = require('./auth.policy');

function parseDurationToSeconds(value, fallbackSeconds) {
  if (typeof value === 'number') return value;
  const text = String(value || '').trim();
  const match = text.match(/^(\d+)([smhd])?$/i);
  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multiplier = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  }[unit];

  return amount * multiplier;
}

function assertJwtSecrets() {
  if (!env.jwtAccessSecret || !env.jwtRefreshSecret) {
    throw ApiError.internal('JWT secrets are not configured.');
  }
}

function assertActorType(actorType) {
  if (!AUTHENTICATED_ACTOR_TYPES.includes(normalizeActorType(actorType))) {
    throw ApiError.unauthorized('Loại tài khoản không hợp lệ.');
  }
}

function getAccessTokenExpiresInSeconds() {
  return parseDurationToSeconds(env.jwtAccessExpiresIn, 15 * 60);
}

function getRefreshTokenExpiresInSeconds() {
  return parseDurationToSeconds(env.jwtRefreshExpiresIn, 7 * 24 * 60 * 60);
}

function buildJwtVerifyOptions() {
  const options = {};

  if (typeof env.jwtIssuer === 'string' && env.jwtIssuer.trim()) {
    options.issuer = env.jwtIssuer.trim();
  }

  if (typeof env.jwtAudience === 'string' && env.jwtAudience.trim()) {
    options.audience = env.jwtAudience.trim();
  }

  return options;
}

function generateAccessToken({ actorId, actorType, sessionId, permissionVersion }) {
  assertJwtSecrets();
  assertActorType(actorType);
  const canonicalActorType = normalizeActorType(actorType);

  if (!actorId || !sessionId) {
    throw ApiError.internal('actorId and sessionId are required to generate access token.');
  }

  return jwt.sign(
    {
      sub: String(actorId),
      actor_id: String(actorId),
      actor_type: canonicalActorType,
      session_id: String(sessionId),
      token_type: TOKEN_TYPE.ACCESS,
      permission_version: permissionVersion === undefined ? undefined : Number(permissionVersion),
    },
    env.jwtAccessSecret,
    {
      expiresIn: env.jwtAccessExpiresIn,
      ...buildJwtVerifyOptions(),
    },
  );
}

function verifyAccessToken(token) {
  assertJwtSecrets();

  if (!token) {
    throw ApiError.unauthorized('Access token is missing.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtAccessSecret, {
      ...buildJwtVerifyOptions(),
    });
  } catch (error) {
    throw ApiError.unauthorized('Access token is invalid or expired.');
  }

  if (payload.token_type !== TOKEN_TYPE.ACCESS) {
    throw ApiError.unauthorized('Token type is invalid.');
  }

  const actorType = normalizeActorType(payload.actor_type);
  assertActorType(actorType);

  if (!payload.sub || !payload.session_id) {
    throw ApiError.unauthorized('Access token payload is incomplete.');
  }

  return {
    ...payload,
    actor_type: actorType,
    actor_type_raw: payload.actor_type,
    actor_id: payload.actor_id || payload.sub,
  };
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('base64url');
}

module.exports = {
  // parseDurationToSeconds: Chuyển chuỗi thời lượng cấu hình sang số giây.
  parseDurationToSeconds,
  // getAccessTokenExpiresInSeconds: Lấy truy cập token expires trong giây.
  getAccessTokenExpiresInSeconds,
  // getRefreshTokenExpiresInSeconds: Lấy thời gian hết hạn refresh token tính bằng giây.
  getRefreshTokenExpiresInSeconds,
  // generateAccessToken: Sinh/tạo access token.
  generateAccessToken,
  // verifyAccessToken: Xác minh access token.
  verifyAccessToken,
  // generateRefreshToken: Sinh/tạo refresh token.
  generateRefreshToken,
  // hashRefreshToken: Băm refresh token trước khi lưu hoặc so sánh an toàn.
  hashRefreshToken,
};
