const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const {
  ACTOR_TYPES,
  CONVERSATION_CALL_PROVIDERS,
  CONVERSATION_CALL_PROVIDER,
  CONVERSATION_CALL_STATUSES,
  CONVERSATION_CALL_STATUS,
  CONVERSATION_CALL_TYPES,
  CONVERSATION_CALL_TYPE,
  VOICE_TRANSCRIPT_STATUSES,
  VOICE_TRANSCRIPT_STATUS,
} = require('../../constants/statuses');

// Bảng conversation_calls: Lưu cuộc gọi voice/video, recording, transcript và segment theo speaker trong conversation.

const transcriptSegmentSchema = new Schema(
  {
    speaker_actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    speaker_actor_id: { type: Schema.Types.Mixed, required: true },
    start_second: { type: Number, min: 0, required: true },
    end_second: { type: Number, min: 0, required: true },
    text: { type: String, required: true },
  },
  { _id: false },
);

const conversationCallSchema = new Schema(
  {
    conversation_id: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    call_type: {
      type: String,
      enum: CONVERSATION_CALL_TYPES,
      default: CONVERSATION_CALL_TYPE.VOICE,
      required: true,
    },
    provider: {
      type: String,
      enum: CONVERSATION_CALL_PROVIDERS,
      default: CONVERSATION_CALL_PROVIDER.INTERNAL,
      required: true,
    },
    started_by_actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    started_by_actor_id: { type: Schema.Types.Mixed, required: true },
    started_at: { type: Date },
    ended_at: { type: Date },
    duration_seconds: { type: Number, min: 0 },
    status: {
      type: String,
      enum: CONVERSATION_CALL_STATUSES,
      default: CONVERSATION_CALL_STATUS.SCHEDULED,
      required: true,
    },
    recording_url: { type: String, trim: true },
    recording_attachment_id: { type: Schema.Types.ObjectId, ref: 'Attachment' },
    transcript_status: {
      type: String,
      enum: VOICE_TRANSCRIPT_STATUSES,
      default: VOICE_TRANSCRIPT_STATUS.NONE,
      required: true,
    },
    transcript_text: { type: String },
    transcript_segments: [transcriptSegmentSchema],
    summary: { type: String },
    action_items: [{ type: String, trim: true }],
    consent_recorded: { type: Boolean, default: false, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'conversation_calls' },
);

conversationCallSchema.index({ conversation_id: 1, created_at: -1 });
conversationCallSchema.index({ status: 1, created_at: -1 });
conversationCallSchema.index({ transcript_status: 1, updated_at: -1 });
conversationCallSchema.index({ started_by_actor_type: 1, started_by_actor_id: 1, created_at: -1 });
conversationCallSchema.index({ recording_attachment_id: 1 });

module.exports = model('ConversationCall', conversationCallSchema);
