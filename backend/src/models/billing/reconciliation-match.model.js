const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { RECONCILIATION_MATCH_STATUSES, RECONCILIATION_MATCH_TYPES } = require('../../constants/statuses');

const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const reconciliationMatchSchema = new Schema(
  {
    bank_transaction_id: { type: Schema.Types.ObjectId, ref: 'BankStatementTransaction', required: true },
    payment_intent_id: { type: Schema.Types.ObjectId, ref: 'PaymentIntent' },
    payment_id: { type: Schema.Types.ObjectId, ref: 'Payment' },
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    match_type: { type: String, enum: RECONCILIATION_MATCH_TYPES, default: 'manual' },
    match_status: { type: String, enum: RECONCILIATION_MATCH_STATUSES, default: 'proposed' },
    confidence_score: { type: Number, default: 0, min: 0, max: 100 },
    matched_amount: { type: Number, default: 0, validate: integerMoneyValidator },
    difference_amount: { type: Number, default: 0, validate: integerMoneyValidator },
    reasons: [{ type: String, trim: true }],
    confirmed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    confirmed_at: { type: Date },
    rejected_by: { type: Schema.Types.ObjectId, ref: 'User' },
    rejected_at: { type: Date },
    reversed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reversed_at: { type: Date },
    audit_logs: [{ type: Schema.Types.Mixed }],
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'reconciliation_matches' },
);

reconciliationMatchSchema.index({ bank_transaction_id: 1, match_status: 1 });
reconciliationMatchSchema.index({ payment_intent_id: 1, match_status: 1 });
reconciliationMatchSchema.index({ invoice_id: 1, match_status: 1 });
reconciliationMatchSchema.index({ confidence_score: -1, created_at: -1 });

module.exports = model('ReconciliationMatch', reconciliationMatchSchema);
