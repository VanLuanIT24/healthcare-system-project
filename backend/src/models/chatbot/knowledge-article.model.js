const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const KNOWLEDGE_ARTICLE_STATUS = ['draft', 'published', 'archived'];

const knowledgeArticleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, lowercase: true },
    content: { type: String, required: true },
    keywords: [{ type: String, trim: true, lowercase: true }],
    branch_id: { type: Schema.Types.ObjectId, ref: 'FacilityLocation' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    status: { type: String, enum: KNOWLEDGE_ARTICLE_STATUS, default: 'draft', required: true },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    effective_from: { type: Date },
    effective_to: { type: Date },
    source_url: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'knowledge_articles' },
);

knowledgeArticleSchema.index({ title: 'text', content: 'text', keywords: 'text' });
knowledgeArticleSchema.index({ category: 1, status: 1 });
knowledgeArticleSchema.index({ branch_id: 1, status: 1 });
knowledgeArticleSchema.index({ department_id: 1, status: 1 });
knowledgeArticleSchema.index({ effective_from: 1, effective_to: 1 });

module.exports = model('KnowledgeArticle', knowledgeArticleSchema);
