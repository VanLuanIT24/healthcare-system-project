const actorContext = require('../actors');

function buildRequestAuditContext(req = {}, overrides = {}) {
  const context = req.context || {};
  const actor = context.actor || actorContext.buildActorContext(req.auth || context);

  return {
    request_id: context.request_id || req.headers?.['x-request-id'] || null,
    correlation_id: context.correlation_id || req.headers?.['x-correlation-id'] || context.request_id || null,
    session_id: context.session?.session_id || context.session_id || req.auth?.sessionId || null,
    actor_type: actor.actor_type,
    actor_id: actor.actor_id,
    user_id: actor.user_id,
    patient_account_id: actor.patient_account_id,
    patient_id: actor.patient_id,
    relative_id: actor.relative_id,
    roles: actor.roles || [],
    permissions: actor.permissions || [],
    department_id: actor.department_id,
    ip: context.ip || req.ip,
    ipAddress: context.ip || req.ip,
    user_agent: context.user_agent || req.get?.('user-agent'),
    userAgent: context.user_agent || req.get?.('user-agent'),
    source: overrides.source || context.audit?.source || 'api',
    module: overrides.module || context.audit?.module || null,
    action: overrides.action || context.audit?.action || null,
  };
}

function attachAuditContext(req = {}, audit = {}) {
  req.context = req.context || {};
  req.context.audit = {
    source: 'api',
    module: null,
    action: null,
    ...req.context.audit,
    ...audit,
  };
  return req.context.audit;
}

module.exports = {
  buildRequestAuditContext,
  attachAuditContext,
};
