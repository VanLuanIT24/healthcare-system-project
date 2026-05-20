const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { RECONCILIATION_RULE_STATUSES } = require('../../constants/statuses');

const reconciliationRuleSchema = new Schema(
  {
    rule_code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    provider: { type: String, trim: true },
    account_no: { type: String, trim: true },
    status: { type: String, enum: RECONCILIATION_RULE_STATUSES, default: 'active', required: true },
    priority: { type: Number, default: 100, min: 0 },
    auto_confirm_threshold: { type: Number, default: 90, min: 0, max: 100 },
    manual_review_threshold: { type: Number, default: 40, min: 0, max: 100 },
    amount_tolerance: { type: Number, default: 0, min: 0 },
    time_window_minutes: { type: Number, default: 1440, min: 0 },
    require_intent_code: { type: Boolean, default: false },
    require_exact_amount: { type: Boolean, default: true },
    description_patterns: [{ type: String, trim: true }],
    negative_patterns: [{ type: String, trim: true }],
    notes: { type: String, trim: true },
    last_applied_at: { type: Date },
    audit_logs: [{ type: Schema.Types.Mixed }],
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'reconciliation_rules' },
);

reconciliationRuleSchema.index({ provider: 1, status: 1, priority: 1 });
reconciliationRuleSchema.index({ account_no: 1, status: 1 });

module.exports = model('ReconciliationRule', reconciliationRuleSchema);
