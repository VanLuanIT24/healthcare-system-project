const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { RECONCILIATION_TRANSACTION_STATUSES } = require('../../constants/statuses');

const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const bankStatementTransactionSchema = new Schema(
  {
    provider: { type: String, required: true, trim: true },
    bank_bin: { type: String, trim: true },
    account_no: { type: String, trim: true },
    transaction_id: { type: String, required: true, trim: true },
    transaction_ref: { type: String, trim: true },
    amount: { type: Number, required: true, validate: integerMoneyValidator },
    currency: { type: String, default: 'VND', trim: true, uppercase: true },
    direction: { type: String, enum: ['credit', 'debit'], default: 'credit' },
    transaction_at: { type: Date, required: true },
    value_date: { type: Date },
    description: { type: String, trim: true },
    counterparty_account_no: { type: String, trim: true },
    counterparty_account_name: { type: String, trim: true },
    raw_payload: { type: Schema.Types.Mixed },

    detected_intent_code: { type: String, trim: true },
    detected_invoice_no: { type: String, trim: true },
    detected_patient_code: { type: String, trim: true },

    match_status: { type: String, enum: RECONCILIATION_TRANSACTION_STATUSES, default: 'unmatched', required: true },
    matched_payment_intent_id: { type: Schema.Types.ObjectId, ref: 'PaymentIntent' },
    matched_payment_id: { type: Schema.Types.ObjectId, ref: 'Payment' },
    matched_invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    confidence_score: { type: Number, default: 0, min: 0, max: 100 },
    mismatch_reason: { type: String, trim: true },

    imported_batch_id: { type: Schema.Types.ObjectId, ref: 'ReconciliationBatch' },
    imported_by: { type: Schema.Types.ObjectId, ref: 'User' },
    imported_at: { type: Date },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    audit_logs: [{ type: Schema.Types.Mixed }],
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'bank_statement_transactions' },
);

bankStatementTransactionSchema.index({ provider: 1, transaction_id: 1 }, { unique: true });
bankStatementTransactionSchema.index({ transaction_ref: 1 });
bankStatementTransactionSchema.index({ transaction_at: -1 });
bankStatementTransactionSchema.index({ amount: 1, transaction_at: -1 });
bankStatementTransactionSchema.index({ match_status: 1, transaction_at: -1 });
bankStatementTransactionSchema.index({ detected_intent_code: 1 });
bankStatementTransactionSchema.index({ imported_batch_id: 1 });

module.exports = model('BankStatementTransaction', bankStatementTransactionSchema);
