const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const {
  PAYMENT_INTENT_METHODS,
  PAYMENT_INTENT_STATUS,
  PAYMENT_INTENT_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER,
} = require('../../constants/statuses');

const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

// Bảng payment_intents: Lưu phiên thanh toán online/QR và dữ liệu provider.

const paymentIntentSchema = new Schema(
  {
    intent_code: { type: String, required: true, unique: true, trim: true },
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    payment_id: { type: Schema.Types.ObjectId, ref: 'Payment' },
    amount: { type: Number, required: true, min: 0, validate: integerMoneyValidator },
    currency: { type: String, default: 'VND', trim: true, uppercase: true },
    provider: { type: String, enum: PAYMENT_PROVIDERS, default: PAYMENT_PROVIDER.BANK_QR_MANUAL, required: true },
    method: { type: String, enum: PAYMENT_INTENT_METHODS, required: true },
    status: { type: String, enum: PAYMENT_INTENT_STATUSES, default: PAYMENT_INTENT_STATUS.CREATED, required: true },
    payment_note: { type: String, trim: true },
    checkout_url: { type: String, trim: true },
    qr_payload: { type: String },
    qr_image_url: { type: String, trim: true },
    receiver_name: { type: String, trim: true },
    receiver_phone: { type: String, trim: true },
    receiver_bank_bin: { type: String, trim: true },
    receiver_account_no: { type: String, trim: true },
    receiver_account_name: { type: String, trim: true },
    receipt_image_url: { type: String, trim: true },
    receipt_file_name: { type: String, trim: true },
    receipt_mime_type: { type: String, trim: true },
    receipt_file_size: { type: Number, min: 0 },
    transaction_reference: { type: String, trim: true },
    provider_transaction_id: { type: String, trim: true },
    provider_order_id: { type: String, trim: true },
    expires_at: { type: Date },
    paid_at: { type: Date },
    confirmed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    confirmed_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    failure_reason: { type: String },
    manual_review_reason: { type: String },
    mismatch_type: {
      type: String,
      enum: [
        'amount_short',
        'amount_over',
        'wrong_note',
        'wrong_invoice',
        'wrong_patient',
        'duplicate_reference',
        'expired_intent',
        'missing_bank_transaction',
        'other',
      ],
    },
    expected_amount: { type: Number, min: 0, validate: integerMoneyValidator },
    received_amount: { type: Number, min: 0, validate: integerMoneyValidator },
    difference_amount: { type: Number, validate: integerMoneyValidator },
    detected_reason: { type: String, trim: true },
    review_status: { type: String, enum: ['open', 'assigned', 'resolved', 'rejected'] },
    review_assignee_id: { type: Schema.Types.ObjectId, ref: 'User' },
    manual_confirmed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    manual_confirmed_at: { type: Date },
    manual_rejected_by: { type: Schema.Types.ObjectId, ref: 'User' },
    manual_rejected_at: { type: Date },
    manual_reject_reason: { type: String },
    audit_logs: [{
      action: { type: String, trim: true },
      actor_type: { type: String, trim: true },
      actor_id: { type: Schema.Types.Mixed },
      at: { type: Date, default: Date.now },
      reason: { type: String },
      metadata: { type: Schema.Types.Mixed },
    }],
    raw_provider_response: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'payment_intents' },
);

paymentIntentSchema.index({ invoice_id: 1, status: 1 });
paymentIntentSchema.index({ patient_id: 1, created_at: -1 });
paymentIntentSchema.index({ provider: 1, provider_order_id: 1 }, { unique: true, sparse: true });
paymentIntentSchema.index(
  { provider: 1, provider_transaction_id: 1 },
  { unique: true, partialFilterExpression: { provider_transaction_id: { $exists: true, $type: 'string' } } },
);
paymentIntentSchema.index({ expires_at: 1, status: 1 });
paymentIntentSchema.index({ payment_id: 1 });
paymentIntentSchema.index({ confirmed_at: 1 });
paymentIntentSchema.index({ manual_confirmed_at: 1 });
paymentIntentSchema.index({ manual_rejected_at: 1 });
paymentIntentSchema.index({ transaction_reference: 1 });
paymentIntentSchema.index({ mismatch_type: 1, status: 1 });
paymentIntentSchema.index({ review_status: 1, updated_at: -1 });

module.exports = model('PaymentIntent', paymentIntentSchema);
