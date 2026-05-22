const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { SUPPORT_CATEGORIES } = require('../../constants/statuses');

const SUPPORT_REPLY_TEMPLATE_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  NEEDS_REVIEW: 'needs_review',
  DISABLED: 'disabled',
};

const SUPPORT_REPLY_TEMPLATE_STATUSES = Object.values(SUPPORT_REPLY_TEMPLATE_STATUS);

const supportReplyTemplateSchema = new Schema(
  {
    template_code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: SUPPORT_CATEGORIES, default: 'other', required: true },
    language: { type: String, default: 'vi', trim: true },
    tone: { type: String, default: 'professional', trim: true },
    subject_template: { type: String, trim: true },
    body_template: { type: String, required: true },
    variables: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: SUPPORT_REPLY_TEMPLATE_STATUSES,
      default: SUPPORT_REPLY_TEMPLATE_STATUS.ACTIVE,
      required: true,
    },
    active: { type: Boolean, default: true, required: true },
    usage_count: { type: Number, default: 0, min: 0 },
    last_used_at: { type: Date },
    approval_required: { type: Boolean, default: false, required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'support_reply_templates' },
);

supportReplyTemplateSchema.index({ category: 1, active: 1, language: 1 });
supportReplyTemplateSchema.index({ status: 1, updated_at: -1 });
supportReplyTemplateSchema.index({ tags: 1 });

module.exports = model('SupportReplyTemplate', supportReplyTemplateSchema);
module.exports.SUPPORT_REPLY_TEMPLATE_STATUS = SUPPORT_REPLY_TEMPLATE_STATUS;
module.exports.SUPPORT_REPLY_TEMPLATE_STATUSES = SUPPORT_REPLY_TEMPLATE_STATUSES;
