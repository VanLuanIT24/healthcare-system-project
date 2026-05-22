const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const auditReviewSchema = new Schema(
  {
    audit_log_id: { type: Schema.Types.ObjectId, ref: 'AuditLog', required: true, index: true },
    review_type: {
      type: String,
      enum: ['sensitive_access', 'break_glass', 'iam', 'billing', 'system_config', 'general'],
      default: 'general',
      index: true,
    },
    review_status: {
      type: String,
      enum: ['pending', 'legitimate', 'suspicious', 'escalated', 'dismissed', 'reviewed'],
      default: 'pending',
      index: true,
    },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    note: { type: String, trim: true },
    risk_score: { type: Number, default: 0 },
    risk_reasons: [{ type: String, trim: true }],
    requested_explanation_to: { type: Schema.Types.ObjectId, ref: 'User' },
    explanation: { type: String, trim: true },
    explanation_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'audit_reviews' },
);

auditReviewSchema.index({ audit_log_id: 1, review_type: 1 }, { unique: true });
auditReviewSchema.index({ review_status: 1, created_at: -1 });

module.exports = model('AuditReview', auditReviewSchema);
