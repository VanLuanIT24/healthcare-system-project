const { createHash } = require('crypto');
const { SecurityRateLimitEvent } = require('../models');
const { normalizePagination, buildPaginationMeta } = require('../common/helpers/pagination.helper');
const { buildRegexSearch } = require('../common/helpers/query.helper');

function hashKey(value) {
  return createHash('sha256').update(String(value || 'unknown')).digest('hex');
}

function actorFromRequest(req = {}) {
  const context = req.context || {};
  return {
    actor_type: context.actor_type || req.auth?.actorType || req.auth?.actor_type || 'anonymous',
    actor_id: context.actor_id || context.actor?.actor_id || req.auth?.userId || req.auth?.patientAccountId || req.auth?.relativeId || null,
  };
}

function ipFromRequest(req = {}) {
  return req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || null;
}

async function recordRateLimitBlocked({
  req,
  scope,
  key,
  limit,
  windowMs,
  retryAfterSeconds,
  metadata,
} = {}) {
  const actor = actorFromRequest(req);
  return SecurityRateLimitEvent.create({
    scope: scope || 'unknown',
    key_hash: hashKey(key),
    actor_type: actor.actor_type,
    actor_id: actor.actor_id,
    ip_address: ipFromRequest(req),
    method: req?.method,
    path: req?.originalUrl || req?.url,
    user_agent: req?.get?.('user-agent') || req?.headers?.['user-agent'],
    request_id: req?.context?.request_id || req?.headers?.['x-request-id'],
    limit,
    window_ms: windowMs,
    retry_after_seconds: retryAfterSeconds,
    blocked_at: new Date(),
    metadata,
  });
}

function buildFilter(query = {}) {
  const filter = {};
  if (query.scope) filter.scope = query.scope;
  if (query.actor_type) filter.actor_type = query.actor_type;
  if (query.actor_id) filter.actor_id = query.actor_id;
  if (query.ip_address) filter.ip_address = query.ip_address;
  if (query.path) filter.path = buildRegexSearch(query.path);
  if (query.from || query.to) {
    filter.blocked_at = {};
    if (query.from) filter.blocked_at.$gte = new Date(query.from);
    if (query.to) filter.blocked_at.$lte = new Date(query.to);
  }

  const keyword = query.keyword || query.search || query.q;
  if (keyword) {
    const regex = buildRegexSearch(keyword);
    filter.$or = [{ scope: regex }, { path: regex }, { ip_address: regex }, { request_id: regex }];
  }
  return filter;
}

async function listRateLimitEvents(query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = buildFilter(query);
  const [items, total] = await Promise.all([
    SecurityRateLimitEvent.find(filter).sort({ blocked_at: -1 }).skip(skip).limit(limit).lean(),
    SecurityRateLimitEvent.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => ({
      rate_limit_event_id: String(item._id),
      ...item,
      _id: undefined,
    })),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function getRateLimitSummary(query = {}) {
  const filter = buildFilter(query);
  const [total, byScope, byIp] = await Promise.all([
    SecurityRateLimitEvent.countDocuments(filter),
    SecurityRateLimitEvent.aggregate([
      { $match: filter },
      { $group: { _id: '$scope', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    SecurityRateLimitEvent.aggregate([
      { $match: filter },
      { $group: { _id: '$ip_address', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  return { total, by_scope: byScope, by_ip: byIp };
}

module.exports = {
  recordRateLimitBlocked,
  listRateLimitEvents,
  getRateLimitSummary,
};
