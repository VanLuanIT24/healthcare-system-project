const { createHash } = require('crypto');
const rateLimitService = require('../services/auth/rate-limit.service');
const rateLimitEventService = require('../services/security-rate-limit-event.service');

function hashKey(value) {
  return createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 32);
}

function actorKey(req) {
  const context = req.context || {};
  const actorType = context.actor_type || req.auth?.actorType || 'anonymous';
  const actorId = context.actor_id || context.actor?.actor_id || req.auth?.userId || req.auth?.patientAccountId || req.auth?.relativeId || req.ip;
  return `${actorType}:${actorId || req.ip}`;
}

function markLegacy(error) {
  if (error && typeof error === 'object') {
    error.legacyControllerResponse = true;
  }
  return error;
}

function createActionRateLimit({
  action,
  limit,
  windowMs,
  message,
  keyGenerator,
} = {}) {
  return function actionRateLimit(req, res, next) {
    let key = null;
    try {
      const extra = typeof keyGenerator === 'function' ? keyGenerator(req) : '';
      key = `${actorKey(req)}:${hashKey(extra)}`;
      rateLimitService.checkRateLimit(`action:${action || 'generic'}`, key, {
        limit,
        windowMs,
      }, message);
      return next();
    } catch (error) {
      if (error?.statusCode === 429) {
        rateLimitEventService.recordRateLimitBlocked({
          req,
          scope: `action:${action || 'generic'}`,
          key,
          limit,
          windowMs,
          retryAfterSeconds: error.details?.retry_after_seconds,
          metadata: { limiter: 'action' },
        }).catch(() => {});
      }
      return next(markLegacy(error));
    }
  };
}

module.exports = {
  createActionRateLimit,
};
