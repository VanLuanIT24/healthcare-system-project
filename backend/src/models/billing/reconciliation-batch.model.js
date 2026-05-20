const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { RECONCILIATION_BATCH_STATUSES } = require('../../constants/statuses');

const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const reconciliationBatchSchema = new Schema(
  {
    batch_no: { type: String, required: true, unique: true, trim: true },
    provider: { type: String, required: true, trim: true },
    account_no: { type: String, trim: true },
    from_at: { type: Date },
    to_at: { type: Date },
    status: { type: String, enum: RECONCILIATION_BATCH_STATUSES, default: 'draft', required: true },
    total_transactions: { type: Number, default: 0, min: 0 },
    total_amount: { type: Number, default: 0, validate: integerMoneyValidator },
    matched_count: { type: Number, default: 0, min: 0 },
    matched_amount: { type: Number, default: 0, validate: integerMoneyValidator },
    unmatched_count: { type: Number, default: 0, min: 0 },
    unmatched_amount: { type: Number, default: 0, validate: integerMoneyValidator },
    mismatch_count: { type: Number, default: 0, min: 0 },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    closed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    closed_at: { type: Date },
    locked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    locked_at: { type: Date },
    notes: { type: String, trim: true },
    audit_logs: [{ type: Schema.Types.Mixed }],
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'reconciliation_batches' },
);

reconciliationBatchSchema.index({ provider: 1, from_at: -1 });
reconciliationBatchSchema.index({ status: 1, from_at: -1 });
reconciliationBatchSchema.index({ account_no: 1, from_at: -1 });

module.exports = model('ReconciliationBatch', reconciliationBatchSchema);
