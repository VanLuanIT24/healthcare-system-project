const { Types } = require('mongoose');
const ApiError = require('../common/errors/api-error');
const actorContext = require('../common/actors');
const { APPROVAL_REQUEST_STATUS, APPROVAL_REQUEST_TYPES } = require('../constants/statuses');
const { ApprovalRequest } = require('../models');

function actorIdentity(actor = {}) {
  const context = actorContext.buildActorContext(actor, { requireActorId: false });
  if (!context.actor_type || !context.actor_id) throw ApiError.unauthorized('Không xác định được actor.');
  return context;
}

function requestCode() {
  return `APR-${Date.now()}-${new Types.ObjectId().toString().slice(-6).toUpperCase()}`;
}

async function createApprovalRequest(payload = {}, actor = {}) {
  if (!APPROVAL_REQUEST_TYPES.includes(payload.request_type)) throw ApiError.validation('request_type không hợp lệ.');
  if (!payload.target_type || !payload.target_id) throw ApiError.validation('target_type và target_id là bắt buộc.');
  if (!payload.reason) throw ApiError.validation('reason là bắt buộc.');

  const identity = actorIdentity(actor);
  const request = await ApprovalRequest.create({
    request_code: requestCode(),
    request_type: payload.request_type,
    target_type: payload.target_type,
    target_id: payload.target_id,
    requested_by_actor_type: identity.actor_type,
    requested_by_actor_id: identity.actor_id,
    assigned_to_user_id: payload.assigned_to_user_id,
    assigned_to_role_code: payload.assigned_to_role_code,
    reason: payload.reason,
    payload: payload.payload,
    expires_at: payload.expires_at,
  });
  return { approval_request: request };
}

async function decideApprovalRequest(requestId, decision = {}, actor = {}) {
  const request = await ApprovalRequest.findById(requestId);
  if (!request) throw ApiError.notFound('Không tìm thấy approval request.');
  if (request.status !== APPROVAL_REQUEST_STATUS.PENDING) throw ApiError.conflict('Approval request không còn pending.');
  if (![APPROVAL_REQUEST_STATUS.APPROVED, APPROVAL_REQUEST_STATUS.REJECTED].includes(decision.status)) {
    throw ApiError.validation('decision.status phải là approved hoặc rejected.');
  }
  const identity = actorIdentity(actor);
  request.status = decision.status;
  request.decision_note = decision.decision_note;
  request.decided_by = identity.user_id || identity.actor_id;
  request.decided_at = new Date();
  await request.save();
  return { approval_request: request };
}

module.exports = {
  createApprovalRequest,
  decideApprovalRequest,
};
