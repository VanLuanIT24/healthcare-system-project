const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { PAYMENT_METHODS, PAYMENT_STATUS, PAYMENT_STATUSES } = require('../../constants/statuses');

// Bảng payments: Lưu giao dịch thanh toán, phương thức thu và trạng thái giao dịch.
const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const paymentSchema = new Schema(
  {
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    payment_intent_id: { type: Schema.Types.ObjectId, ref: 'PaymentIntent' },
    provider: { type: String, trim: true },
    method: { type: String, trim: true },
    payment_provider: { type: String, trim: true },
    provider_transaction_id: { type: String, trim: true },
    idempotency_key: { type: String, trim: true },
    payment_no: { type: String, required: true, unique: true, trim: true },
    amount: { type: Number, required: true, min: 0, validate: integerMoneyValidator },
    currency: { type: String, default: 'VND', trim: true, uppercase: true },
    payment_method: { type: String, enum: PAYMENT_METHODS, required: true },
    intent_code: { type: String, trim: true },
    payment_note: { type: String, trim: true },
    qr_image_url: { type: String, trim: true },
    receipt_image_url: { type: String, trim: true },
    receipt_file_name: { type: String, trim: true },
    receipt_mime_type: { type: String, trim: true },
    receipt_file_size: { type: Number, min: 0 },
    transaction_reference: { type: String, trim: true },
    transaction_ref: { type: String, trim: true },
    paid_at: { type: Date },
    received_by: { type: Schema.Types.ObjectId, ref: 'User' },
    confirmed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    confirmed_at: { type: Date },
    voided_by: { type: Schema.Types.ObjectId, ref: 'User' },
    voided_at: { type: Date },
    void_reason: { type: String },
    refunded_by: { type: Schema.Types.ObjectId, ref: 'User' },
    refunded_at: { type: Date },
    refund_reason: { type: String },
    refund_status: { type: String, enum: ['none', 'requested', 'approved', 'rejected', 'processed'], default: 'none' },
    refund_amount: { type: Number, min: 0, validate: integerMoneyValidator },
    refund_requested_by: { type: Schema.Types.Mixed },
    refund_requested_at: { type: Date },
    refund_approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    manual_confirmed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    manual_confirmed_at: { type: Date },
    manual_rejected_by: { type: Schema.Types.ObjectId, ref: 'User' },
    manual_rejected_at: { type: Date },
    manual_reject_reason: { type: String },
    status: { type: String, enum: PAYMENT_STATUSES, default: PAYMENT_STATUS.PENDING, required: true },
    note: { type: String },
    audit_logs: [{
      action: { type: String, trim: true },
      actor_type: { type: String, trim: true },
      actor_id: { type: Schema.Types.Mixed },
      at: { type: Date, default: Date.now },
      reason: { type: String },
      metadata: { type: Schema.Types.Mixed },
    }],
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'payments' },
);

paymentSchema.index({ invoice_id: 1 });
paymentSchema.index({ patient_id: 1 });
paymentSchema.index({ payment_intent_id: 1 }, { unique: true, sparse: true });
paymentSchema.index({ provider: 1 });
paymentSchema.index(
  { payment_provider: 1, provider_transaction_id: 1 },
  { unique: true, partialFilterExpression: { provider_transaction_id: { $exists: true, $type: 'string' } } },
);
paymentSchema.index({ idempotency_key: 1 }, { unique: true, sparse: true });
paymentSchema.index({ payment_method: 1 });
paymentSchema.index({ transaction_ref: 1 });
paymentSchema.index({ transaction_reference: 1 });
paymentSchema.index({ intent_code: 1 });
paymentSchema.index({ paid_at: 1 });
paymentSchema.index({ received_by: 1 });
paymentSchema.index({ confirmed_by: 1 });
paymentSchema.index({ manual_confirmed_at: 1 });
paymentSchema.index({ manual_rejected_at: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ refund_status: 1 });
paymentSchema.index({ patient_id: 1, paid_at: 1 });
paymentSchema.index({ paid_at: 1, status: 1 });
paymentSchema.index({ payment_method: 1, paid_at: 1 });
paymentSchema.index({ invoice_id: 1, status: 1, amount: 1 });

module.exports = model('Payment', paymentSchema);
