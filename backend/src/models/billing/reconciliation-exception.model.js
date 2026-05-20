const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const reconciliationExceptionSchema = new Schema(
  {
    exception_no: { type: String, required: true, unique: true, trim: true },
    batch_id: { type: Schema.Types.ObjectId, ref: 'ReconciliationBatch' },
    bank_transaction_id: { type: Schema.Types.ObjectId, ref: 'BankStatementTransaction' },
    payment_intent_id: { type: Schema.Types.ObjectId, ref: 'PaymentIntent' },
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    type: {
      type: String,
      enum: [
        'missing_payment_intent',
        'amount_short',
        'amount_over',
        'duplicate_reference',
        'expired_intent',
        'wrong_invoice',
        'wrong_patient',
        'manual_review',
        'suspicious',
        'other',
      ],
      required: true,
    },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: { type: String, enum: ['open', 'assigned', 'resolved', 'ignored'], default: 'open' },
    expected_amount: { type: Number, default: 0 },
    received_amount: { type: Number, default: 0 },
    difference_amount: { type: Number, default: 0 },
    reason: { type: String, trim: true },
    assignee_id: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    resolution_note: { type: String, trim: true },
    audit_logs: [{ type: Schema.Types.Mixed }],
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'reconciliation_exceptions' },
);

reconciliationExceptionSchema.index({ status: 1, severity: 1, created_at: -1 });
reconciliationExceptionSchema.index({ batch_id: 1, status: 1 });
reconciliationExceptionSchema.index({ bank_transaction_id: 1 });

module.exports = model('ReconciliationException', reconciliationExceptionSchema);
