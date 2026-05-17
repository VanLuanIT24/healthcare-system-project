const ApiError = require('../common/errors/api-error');
const ERROR_CODE = require('../common/errors/error-codes');

function allow(reason = 'allowed') {
  return { allowed: true, reason };
}

function deny(reason = 'denied', code = ERROR_CODE.POLICY_DECISION_DENIED, details = null) {
  return { allowed: false, reason, code, details };
}

function assertAllowed(decision, message = 'Bạn không có quyền thao tác resource này.') {
  if (decision?.allowed) return true;
  throw ApiError.forbidden(message || decision?.reason, decision?.details || null, decision?.code || ERROR_CODE.POLICY_DECISION_DENIED);
}

function sameId(left, right) {
  if (!left || !right) return false;
  return String(left?._id || left) === String(right?._id || right);
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function actorId(actor = {}) {
  return actor.userId || actor.user_id || actor.patientAccountId || actor.patient_account_id || actor.relativeId || actor.relative_id || actor.actorId || actor.actor_id;
}

function hasPermission(actor = {}, permission) {
  return (actor.permissions || []).includes(permission);
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissions.some((permission) => hasPermission(actor, permission));
}

module.exports = {
  allow,
  deny,
  assertAllowed,
  sameId,
  actorType,
  actorId,
  hasPermission,
  hasAnyPermission,
};
