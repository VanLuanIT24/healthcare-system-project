const { createHash } = require('crypto');
const rateLimitService = require('../services/auth/rate-limit.service');
const rateLimitEventService = require('../services/security-rate-limit-event.service');

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
    let key = null;
    try {
      const ip = getRequestIp(req);
      const extraKey = typeof keyGenerator === 'function' ? keyGenerator(req) : null;
      key = extraKey ? `${ip}:${hashKey(extraKey)}` : ip;

      rateLimitService.checkRateLimit(`auth:${scope || 'public'}`, key, {
        limit,
        windowMs,
      }, message);

      return next();
    } catch (error) {
      if (error?.statusCode === 429) {
        rateLimitEventService.recordRateLimitBlocked({
          req,
          scope: `auth:${scope || 'public'}`,
          key,
          limit,
          windowMs,
          retryAfterSeconds: error.details?.retry_after_seconds,
          metadata: { limiter: 'auth' },
        }).catch(() => {});
      }
      return next(markLegacy(error));
    }
  };
}

module.exports = {
  createAuthRateLimit,
};
