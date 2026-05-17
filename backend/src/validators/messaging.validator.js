const ApiError = require('../common/errors/api-error');
const ERROR_CODE = require('../common/errors/error-codes');
const { CONVERSATION_STATUS } = require('../constants/statuses');

function assertConversationOpen(conversation) {
  if (!conversation) throw ApiError.notFound('Không tìm thấy conversation.');
  if ([CONVERSATION_STATUS.CLOSED, CONVERSATION_STATUS.ARCHIVED].includes(conversation.status)) {
    throw ApiError.conflict('Conversation đã đóng, không thể gửi tin nhắn.', {
      conversation_id: String(conversation._id || conversation.id),
      status: conversation.status,
    }, ERROR_CODE.CONVERSATION_CLOSED);
  }
  return true;
}

function assertConversationParticipant(actor = {}, participant) {
  if (!participant || participant.left_at) {
    throw ApiError.forbidden('Bạn không thuộc conversation này.', null, ERROR_CODE.POLICY_DECISION_DENIED);
  }
  const actorType = actor.actorType || actor.actor_type;
  const actorId = actor.userId || actor.patientAccountId || actor.relativeId || actor.actor_id;
  if (String(participant.actor_type) !== String(actorType) || String(participant.actor_id) !== String(actorId)) {
    throw ApiError.forbidden('Bạn không thuộc conversation này.', null, ERROR_CODE.POLICY_DECISION_DENIED);
  }
  return true;
}

module.exports = {
  state: {
    assertConversationOpen,
  },
  scope: {
    assertConversationParticipant,
  },
};
