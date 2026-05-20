const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const {
  PAYMENT_REFUND_METHODS,
  PAYMENT_REFUND_REQUEST_SOURCES,
  PAYMENT_REFUND_STATUSES,
  PAYMENT_REFUND_TYPES,
} = require('../../constants/statuses');

const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const refundAuditSchema = new Schema(
  {
    action: { type: String, trim: true },
    actor_type: { type: String, trim: true },
    actor_id: { type: Schema.Types.Mixed },
    at: { type: Date, default: Date.now },
    reason: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const evidenceFileSchema = new Schema(
  {
    file_id: { type: Schema.Types.ObjectId, ref: 'Attachment' },
    file_url: { type: String, trim: true },
    file_name: { type: String, trim: true },
    file_type: { type: String, trim: true },
    evidence_type: { type: String, trim: true },
    uploaded_by: { type: Schema.Types.ObjectId, ref: 'User' },
    uploaded_at: { type: Date, default: Date.now },
    note: { type: String, trim: true },
  },
  { _id: false },
);

const approvalStepSchema = new Schema(
  {
    level: { type: Number, min: 1 },
    role: { type: String, trim: true },
    status: { type: String, trim: true },
    actor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    acted_at: { type: Date },
    reason: { type: String, trim: true },
    override: { type: Boolean, default: false },
  },
  { _id: false },
);

const paymentRefundSchema = new Schema(
  {
    refund_no: { type: String, required: true, unique: true, trim: true },
    payment_id: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },

    original_payment_amount: { type: Number, required: true, min: 0, validate: integerMoneyValidator },
    requested_amount: { type: Number, required: true, min: 0, validate: integerMoneyValidator },
    approved_amount: { type: Number, min: 0, validate: integerMoneyValidator },
    processed_amount: { type: Number, min: 0, validate: integerMoneyValidator },
    currency: { type: String, default: 'VND', trim: true, uppercase: true },

    refund_type: { type: String, enum: PAYMENT_REFUND_TYPES, default: 'full' },
    refund_method: { type: String, enum: PAYMENT_REFUND_METHODS, default: 'original_method' },
    refund_status: { type: String, enum: PAYMENT_REFUND_STATUSES, default: 'requested', required: true },
    request_source: { type: String, enum: PAYMENT_REFUND_REQUEST_SOURCES, default: 'cashier' },
    reason_category: { type: String, trim: true },
    reason_detail: { type: String, trim: true },

    patient_bank_account: { type: Schema.Types.Mixed },
    receiver_name: { type: String, trim: true },
    receiver_phone: { type: String, trim: true },
    payout_transaction_ref: { type: String, trim: true },
    payout_provider: { type: String, trim: true },
    payout_at: { type: Date },

    requested_by: { type: Schema.Types.Mixed },
    requested_at: { type: Date },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    processed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    processed_at: { type: Date },
    rejected_by: { type: Schema.Types.ObjectId, ref: 'User' },
    rejected_at: { type: Date },
    reject_reason: { type: String, trim: true },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String, trim: true },

    evidence_files: [evidenceFileSchema],
    approval_steps: [approvalStepSchema],
    risk_score: { type: Number, default: 0, min: 0 },
    risk_flags: [{ type: String, trim: true }],
    audit_logs: [refundAuditSchema],
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'payment_refunds' },
);

paymentRefundSchema.index({ payment_id: 1, refund_status: 1 });
paymentRefundSchema.index({ invoice_id: 1, refund_status: 1 });
paymentRefundSchema.index({ patient_id: 1, requested_at: -1 });
paymentRefundSchema.index({ refund_status: 1, requested_at: -1 });
paymentRefundSchema.index({ request_source: 1, requested_at: -1 });
paymentRefundSchema.index({ payout_transaction_ref: 1 });
paymentRefundSchema.index({ created_at: -1 });

module.exports = model('PaymentRefund', paymentRefundSchema);
