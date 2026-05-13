const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const ApiError = require('../../common/errors/api-error');
const { hashRefreshToken } = require('../../models');
const { ACTOR_TYPE, TOKEN_TYPE } = require('./auth.policy');

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
  if (![ACTOR_TYPE.STAFF, ACTOR_TYPE.PATIENT, ACTOR_TYPE.RELATIVE, ACTOR_TYPE.PATIENT_RELATIVE].includes(actorType)) {
    throw ApiError.unauthorized('Loại tài khoản không hợp lệ.');
  }
}

function getAccessTokenExpiresInSeconds() {
  return parseDurationToSeconds(env.jwtAccessExpiresIn, 15 * 60);
}

function getRefreshTokenExpiresInSeconds() {
  return parseDurationToSeconds(env.jwtRefreshExpiresIn, 7 * 24 * 60 * 60);
}

function generateAccessToken({ actorId, actorType, sessionId }) {
  assertJwtSecrets();
  assertActorType(actorType);

  if (!actorId || !sessionId) {
    throw ApiError.internal('actorId and sessionId are required to generate access token.');
  }

  return jwt.sign(
    {
      sub: String(actorId),
      actor_id: String(actorId),
      actor_type: actorType,
      session_id: String(sessionId),
      token_type: TOKEN_TYPE.ACCESS,
    },
    env.jwtAccessSecret,
    {
      expiresIn: env.jwtAccessExpiresIn,
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
    payload = jwt.verify(token, env.jwtAccessSecret);
  } catch (error) {
    throw ApiError.unauthorized('Access token is invalid or expired.');
  }

  if (payload.token_type !== TOKEN_TYPE.ACCESS) {
    throw ApiError.unauthorized('Token type is invalid.');
  }

  assertActorType(payload.actor_type);

  if (!payload.sub || !payload.session_id) {
    throw ApiError.unauthorized('Access token payload is incomplete.');
  }

  return {
    ...payload,
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
