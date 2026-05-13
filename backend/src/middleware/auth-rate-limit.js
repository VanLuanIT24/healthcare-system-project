const { createHash } = require('crypto');
const rateLimitService = require('../services/auth/rate-limit.service');

function hashKey(value) {
  if (!value) return '';
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}

function getRequestIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
}

function markLegacy(error) {
  if (error && typeof error === 'object') {
    error.legacyControllerResponse = true;
  }
  return error;
}

function createAuthRateLimit({
  scope,
  limit,
  windowMs,
  message,
  keyGenerator,
} = {}) {
  return function authRateLimitMiddleware(req, res, next) {
    try {
      const ip = getRequestIp(req);
      const extraKey = typeof keyGenerator === 'function' ? keyGenerator(req) : null;
      const key = extraKey ? `${ip}:${hashKey(extraKey)}` : ip;

      rateLimitService.checkRateLimit(`auth:${scope || 'public'}`, key, {
        limit,
        windowMs,
      }, message);

      return next();
    } catch (error) {
      return next(markLegacy(error));
    }
  };
}

module.exports = {
  createAuthRateLimit,
};
