const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const CHATBOT_SESSION_STATUS = ['active', 'handoff', 'closed', 'expired'];
const CHATBOT_RISK_LEVEL = ['low', 'medium', 'high', 'emergency'];

const chatSessionSchema = new Schema(
  {
    channel: { type: String, trim: true, default: 'website', required: true },
    source_page: { type: String, trim: true },
    anonymous_id: { type: String, trim: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },

    status: { type: String, enum: CHATBOT_SESSION_STATUS, default: 'active', required: true },
    current_intent: { type: String, trim: true },
    current_step: { type: String, trim: true },
    language: { type: String, trim: true, default: 'vi' },
    risk_level: { type: String, enum: CHATBOT_RISK_LEVEL, default: 'low', required: true },

    assigned_staff_id: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_queue: { type: String, trim: true },
    handoff_reason: { type: String, trim: true },

    context: { type: Schema.Types.Mixed, default: {} },
    metadata: { type: Schema.Types.Mixed, default: {} },
    last_message_at: { type: Date },
    expires_at: { type: Date },

    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'chatbot_sessions' },
);

chatSessionSchema.index({ anonymous_id: 1, status: 1 });
chatSessionSchema.index({ patient_id: 1, status: 1 });
chatSessionSchema.index({ status: 1, last_message_at: -1 });
chatSessionSchema.index({ current_intent: 1, created_at: -1 });
chatSessionSchema.index({ risk_level: 1, created_at: -1 });
chatSessionSchema.index({ expires_at: 1 });

module.exports = model('ChatbotSession', chatSessionSchema);
