const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const {
  ACTOR_TYPES,
  MESSAGE_STATUS,
  MESSAGE_STATUSES,
  MESSAGE_TYPE,
  MESSAGE_TYPES,
  VOICE_TRANSCRIPT_STATUS,
  VOICE_TRANSCRIPT_STATUSES,
} = require('../../constants/statuses');

// Bảng messages: Lưu tin nhắn thực trong conversation, gồm ghi chú nội bộ và tư vấn lâm sàng.

const messageSchema = new Schema(
  {
    conversation_id: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender_actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    sender_actor_id: { type: Schema.Types.Mixed, required: true },
    sender_role_code: { type: String, trim: true },
    message_type: { type: String, enum: MESSAGE_TYPES, default: MESSAGE_TYPE.TEXT, required: true },
    body: { type: String },
    voice_duration_seconds: { type: Number, min: 0 },
    voice_transcript: { type: String },
    voice_transcript_status: {
      type: String,
      enum: VOICE_TRANSCRIPT_STATUSES,
      default: VOICE_TRANSCRIPT_STATUS.NONE,
      required: true,
    },
    status: { type: String, enum: MESSAGE_STATUSES, default: MESSAGE_STATUS.SENT, required: true },
    reply_to_message_id: { type: Schema.Types.ObjectId, ref: 'Message' },
    is_internal_note: { type: Boolean, default: false, required: true },
    is_clinical_advice: { type: Boolean, default: false, required: true },
    requires_acknowledgement: { type: Boolean, default: false, required: true },
    edited_at: { type: Date },
    deleted_at: { type: Date },
  },
  { ...baseSchemaOptions, collection: 'messages' },
);

messageSchema.index({ conversation_id: 1, created_at: -1 });
messageSchema.index({ conversation_id: 1, created_at: 1 });
messageSchema.index({ sender_actor_type: 1, sender_actor_id: 1, created_at: -1 });
messageSchema.index({ message_type: 1, created_at: -1 });
messageSchema.index({ status: 1, created_at: -1 });
messageSchema.index({ is_clinical_advice: 1, created_at: -1 });
messageSchema.index({ reply_to_message_id: 1 });

module.exports = model('Message', messageSchema);
