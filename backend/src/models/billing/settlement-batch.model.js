const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const settlementBatchSchema = new Schema(
  {
    settlement_no: { type: String, required: true, unique: true, trim: true },
    provider: { type: String, required: true, trim: true },
    account_no: { type: String, trim: true },
    from_at: { type: Date },
    to_at: { type: Date },
    status: { type: String, enum: ['draft', 'reconciling', 'balanced', 'difference_found', 'closed', 'locked'], default: 'draft' },
    expected_amount: { type: Number, default: 0, validate: integerMoneyValidator },
    statement_amount: { type: Number, default: 0, validate: integerMoneyValidator },
    difference_amount: { type: Number, default: 0, validate: integerMoneyValidator },
    transaction_count: { type: Number, default: 0, min: 0 },
    payment_count: { type: Number, default: 0, min: 0 },
    reconciliation_batch_id: { type: Schema.Types.ObjectId, ref: 'ReconciliationBatch' },
    closed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    closed_at: { type: Date },
    locked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    locked_at: { type: Date },
    notes: { type: String, trim: true },
    audit_logs: [{ type: Schema.Types.Mixed }],
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'settlement_batches' },
);

settlementBatchSchema.index({ provider: 1, from_at: -1 });
settlementBatchSchema.index({ status: 1, from_at: -1 });
settlementBatchSchema.index({ reconciliation_batch_id: 1 });

module.exports = model('SettlementBatch', settlementBatchSchema);
