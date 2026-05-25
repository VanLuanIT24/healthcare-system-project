const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const chatbotFallbackSchema = new Schema(
  {
    session_id: { type: Schema.Types.ObjectId, ref: 'ChatbotSession' },
    message_id: { type: Schema.Types.ObjectId, ref: 'ChatbotMessage' },
    user_text: { type: String, required: true },
    predicted_intent: { type: String, trim: true, default: 'unknown' },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    reason: { type: String, trim: true, default: 'low_confidence' },
    corrected_intent: { type: String, trim: true },
    corrected_entities: { type: Schema.Types.Mixed, default: {} },
    added_to_training: { type: Boolean, default: false, required: true },
    resolved_at: { type: Date },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'chatbot_fallbacks' },
);

chatbotFallbackSchema.index({ predicted_intent: 1, created_at: -1 });
chatbotFallbackSchema.index({ resolved_at: 1 });
chatbotFallbackSchema.index({ session_id: 1, created_at: -1 });

module.exports = model('ChatbotFallback', chatbotFallbackSchema);
