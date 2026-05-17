const ERROR_CODE = require('../common/errors/error-codes');
const { CONVERSATION_STATUS } = require('../constants/statuses');
const { allow, deny, sameId, actorType, actorId } = require('./policy-decision');

function canReadConversation(actor = {}, conversation = {}, participant = null) {
  if (conversation.status === CONVERSATION_STATUS.DELETED) return deny('conversation_deleted');
  if (!participant) return deny('conversation_participant_required');
  if (!sameId(participant.actor_id, actorId(actor)) || participant.actor_type !== actorType(actor)) {
    return deny('conversation_scope_denied');
  }
  return allow();
}

function canSendMessage(actor = {}, conversation = {}, participant = null) {
  const readDecision = canReadConversation(actor, conversation, participant);
  if (!readDecision.allowed) return readDecision;
  if ([CONVERSATION_STATUS.CLOSED, CONVERSATION_STATUS.ARCHIVED].includes(conversation.status)) {
    return deny('conversation_closed', ERROR_CODE.CONVERSATION_CLOSED);
  }
  if (participant.left_at) return deny('participant_left_conversation');
  return allow();
}

module.exports = {
  canReadConversation,
  canSendMessage,
};
