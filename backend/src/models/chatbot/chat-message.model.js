const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const SENDER_TYPES = ['user', 'bot', 'staff', 'system'];
const MESSAGE_TYPES = ['text', 'card', 'quick_reply', 'form', 'system'];

const chatMessageSchema = new Schema(
  {
    session_id: { type: Schema.Types.ObjectId, ref: 'ChatbotSession', required: true },
    sender_type: { type: String, enum: SENDER_TYPES, required: true },
    sender_id: { type: Schema.Types.ObjectId },
    message_type: { type: String, enum: MESSAGE_TYPES, default: 'text', required: true },
    content: { type: String, default: '' },
    structured_payload: { type: Schema.Types.Mixed, default: {} },
    ai_trace: { type: Schema.Types.Mixed, default: {} },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'chatbot_messages' },
);

chatMessageSchema.index({ session_id: 1, created_at: 1 });
chatMessageSchema.index({ sender_type: 1, created_at: -1 });
chatMessageSchema.index({ 'ai_trace.intent': 1, created_at: -1 });
chatMessageSchema.index({ 'ai_trace.risk_level': 1, created_at: -1 });

module.exports = model('ChatbotMessage', chatMessageSchema);
