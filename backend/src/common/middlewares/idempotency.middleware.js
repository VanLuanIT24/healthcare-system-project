const crypto = require('crypto');
const ApiError = require('../errors/api-error');
const ERROR_CODE = require('../errors/error-codes');
const { IdempotencyRecord } = require('../../models');
const { IDEMPOTENCY_STATUS } = require('../../constants/statuses');

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function stableStringify(value) {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashRequest(req) {
  return crypto
    .createHash('sha256')
    .update(stableStringify({
      body: req.body || {},
      params: req.params || {},
      query: req.query || {},
    }))
    .digest('hex');
}

function headerValue(req, name) {
  const value = req.headers[String(name).toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function actorFingerprint(req) {
  const context = req.context || {};
  const actorType = context.actor_type || req.auth?.actorType || req.auth?.actor_type || 'anonymous';
  const actorId = context.actor_id || context.actor?.actor_id || req.auth?.userId || req.auth?.patientAccountId || req.auth?.relativeId || req.ip || 'anonymous';
  return `${actorType}:${actorId}`;
}

function routeKey(req, override) {
  return override || `${req.baseUrl || ''}${req.route?.path || req.path || ''}`;
}

function markLegacy(error) {
  if (error && typeof error === 'object') {
    error.legacyControllerResponse = true;
  }
  return error;
}

function idempotencyRequired(options = {}) {
  const ttlMs = Number(options.ttlMs || DEFAULT_TTL_MS);

  return async function idempotencyMiddleware(req, res, next) {
    if (String(req.method).toUpperCase() !== 'POST') return next();

    const key = headerValue(req, 'idempotency-key') || headerValue(req, 'x-idempotency-key');
    if (!key) {
      return next(markLegacy(ApiError.badRequest(
        'Idempotency-Key header is required for this operation.',
        { header: 'Idempotency-Key' },
        ERROR_CODE.IDEMPOTENCY_KEY_REQUIRED,
      )));
    }

    const actorKey = actorFingerprint(req);
    const [actor_type, actor_id] = actorKey.split(':');
    const route = routeKey(req, options.route);
    const method = String(req.method || 'POST').toUpperCase();
    const requestHash = hashRequest(req);
    const expiresAt = new Date(Date.now() + ttlMs);

    let record;
    try {
      record = await IdempotencyRecord.create({
        key,
        actor_type,
        actor_id,
        actor_fingerprint: actorKey,
        route,
        method,
        request_hash: requestHash,
        status: IDEMPOTENCY_STATUS.PROCESSING,
        locked_at: new Date(),
        expires_at: expiresAt,
      });
    } catch (error) {
      if (error?.code !== 11000) return next(error);
      record = await IdempotencyRecord.findOne({
        key,
        actor_fingerprint: actorKey,
        route,
        method,
        expires_at: { $gt: new Date() },
      }).lean();
      if (!record) return next(error);
      if (record.request_hash !== requestHash) {
        return next(markLegacy(ApiError.conflict(
          'Idempotency-Key was already used with a different request payload.',
          { route, method },
          ERROR_CODE.IDEMPOTENCY_REQUEST_MISMATCH,
        )));
      }
      if (record.status === IDEMPOTENCY_STATUS.COMPLETED && record.response_snapshot) {
        res.setHeader('Idempotency-Replayed', 'true');
        return res.status(record.status_code || 200).json({
          ...record.response_snapshot,
          meta: {
            ...(record.response_snapshot.meta || {}),
            idempotent_replay: true,
          },
        });
      }
      return next(markLegacy(ApiError.conflict(
        'A request with this Idempotency-Key is still processing.',
        { route, method },
        ERROR_CODE.IDEMPOTENCY_REQUEST_IN_PROGRESS,
      )));
    }

    req.idempotency = {
      key,
      record_id: record._id,
      request_hash: requestHash,
      route,
      method,
    };

    const originalJson = res.json.bind(res);
    res.json = function idempotentJson(body) {
      const statusCode = res.statusCode || 200;
      Promise.resolve(IdempotencyRecord.updateOne(
        { _id: record._id },
        {
          $set: {
            response_snapshot: body,
            status_code: statusCode,
            status: statusCode >= 500 ? IDEMPOTENCY_STATUS.FAILED : IDEMPOTENCY_STATUS.COMPLETED,
            completed_at: statusCode < 500 ? new Date() : undefined,
            failed_at: statusCode >= 500 ? new Date() : undefined,
          },
        },
      )).catch(() => {});
      return originalJson(body);
    };

    return next();
  };
}

module.exports = {
  idempotencyRequired,
  hashRequest,
};
