const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const chatbotEntityDictionarySchema = new Schema(
  {
    entity_type: { type: String, required: true, trim: true, lowercase: true },
    canonical_value: { type: String, required: true, trim: true },
    synonyms: [{ type: String, trim: true }],
    mapped_id: { type: Schema.Types.ObjectId },
    mapped_model: { type: String, trim: true },
    enabled: { type: Boolean, default: true, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'chatbot_entity_dictionaries' },
);

chatbotEntityDictionarySchema.index(
  { entity_type: 1, canonical_value: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false } },
);
chatbotEntityDictionarySchema.index({ entity_type: 1, enabled: 1 });
chatbotEntityDictionarySchema.index({ synonyms: 1 });

module.exports = model('ChatbotEntityDictionary', chatbotEntityDictionarySchema);
