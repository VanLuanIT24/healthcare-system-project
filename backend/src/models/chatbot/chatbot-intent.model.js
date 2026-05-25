const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const chatbotIntentSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    examples: [{ type: String, trim: true }],
    enabled: { type: Boolean, default: true, required: true },
    priority: { type: Number, default: 10 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'chatbot_intents' },
);

chatbotIntentSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
chatbotIntentSchema.index({ enabled: 1, priority: -1 });

module.exports = model('ChatbotIntent', chatbotIntentSchema);
