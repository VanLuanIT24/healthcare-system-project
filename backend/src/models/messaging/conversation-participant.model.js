const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const {
  ACTOR_TYPES,
  CONVERSATION_PARTICIPANT_ROLE,
  CONVERSATION_PARTICIPANT_ROLES,
} = require('../../constants/statuses');

// Bảng conversation_participants: Lưu thành viên và trạng thái đọc/archive của mỗi actor trong conversation.

const conversationParticipantSchema = new Schema(
  {
    conversation_id: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    actor_id: { type: Schema.Types.Mixed, required: true },
    actor_role_code: { type: String, trim: true },
    role_in_conversation: {
      type: String,
      enum: CONVERSATION_PARTICIPANT_ROLES,
      default: CONVERSATION_PARTICIPANT_ROLE.MEMBER,
      required: true,
    },
    joined_at: { type: Date, default: Date.now, required: true },
    left_at: { type: Date },
    muted: { type: Boolean, default: false, required: true },
    archived: { type: Boolean, default: false, required: true },
    last_read_message_id: { type: Schema.Types.ObjectId, ref: 'Message' },
    last_read_at: { type: Date },
  },
  { ...baseSchemaOptions, collection: 'conversation_participants' },
);

conversationParticipantSchema.index({ conversation_id: 1 });
conversationParticipantSchema.index({ actor_type: 1, actor_id: 1, updated_at: -1 });
conversationParticipantSchema.index({ conversation_id: 1, actor_type: 1, actor_id: 1 }, { unique: true });
conversationParticipantSchema.index({ archived: 1, left_at: 1 });

module.exports = model('ConversationParticipant', conversationParticipantSchema);
