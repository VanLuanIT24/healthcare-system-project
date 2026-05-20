const { randomBytes } = require('crypto');
const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const {
  PAYMENT_METHODS,
  RECEIPT_STATUSES,
  RECEIPT_STATUS,
  RECEIPT_TYPES,
} = require('../../constants/statuses');

function defaultVerifyToken() {
  return randomBytes(18).toString('hex');
}

const receiptSchema = new Schema(
  {
    receipt_no: { type: String, required: true, unique: true, trim: true },
    payment_id: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    payment_intent_id: { type: Schema.Types.ObjectId, ref: 'PaymentIntent' },

    receipt_type: { type: String, enum: RECEIPT_TYPES, default: 'payment' },
    status: { type: String, enum: RECEIPT_STATUSES, default: RECEIPT_STATUS.GENERATED },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'VND', trim: true, uppercase: true },

    payment_method: { type: String, enum: PAYMENT_METHODS },
    payment_provider: { type: String, trim: true },
    transaction_ref: { type: String, trim: true },
    transaction_reference: { type: String, trim: true },
    provider_transaction_id: { type: String, trim: true },
    intent_code: { type: String, trim: true },
    payment_note: { type: String, trim: true },

    template_code: { type: String, default: 'payment_receipt_a5', trim: true },
    format: { type: String, enum: ['a4', 'a5', 'thermal_80'], default: 'a5' },
    pdf_url: { type: String, trim: true },
    html_snapshot: { type: String },
    qr_verify_url: { type: String, trim: true },
    verify_token: { type: String, trim: true, default: defaultVerifyToken },

    original_receipt_image_url: { type: String, trim: true },
    original_receipt_file_name: { type: String, trim: true },
    original_receipt_mime_type: { type: String, trim: true },
    original_receipt_file_size: { type: Number, min: 0 },

    issued_at: { type: Date },
    issued_by: { type: Schema.Types.ObjectId, ref: 'User' },
    print_count: { type: Number, default: 0, min: 0 },
    download_count: { type: Number, default: 0, min: 0 },
    sent_count: { type: Number, default: 0, min: 0 },
    last_printed_at: { type: Date },
    last_printed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    last_downloaded_at: { type: Date },
    last_downloaded_by: { type: Schema.Types.Mixed },
    last_sent_at: { type: Date },
    last_sent_by: { type: Schema.Types.ObjectId, ref: 'User' },
    voided_at: { type: Date },
    voided_by: { type: Schema.Types.ObjectId, ref: 'User' },
    void_reason: { type: String },
    metadata: { type: Schema.Types.Mixed },

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
  { ...baseSchemaOptions, collection: 'receipts' },
);

receiptSchema.index({ payment_id: 1 }, { unique: true });
receiptSchema.index({ invoice_id: 1 });
receiptSchema.index({ patient_id: 1 });
receiptSchema.index({ status: 1 });
receiptSchema.index({ issued_at: -1 });
receiptSchema.index({ payment_method: 1, issued_at: -1 });
receiptSchema.index({ transaction_ref: 1 });
receiptSchema.index({ transaction_reference: 1 });
receiptSchema.index({ intent_code: 1 });
receiptSchema.index({ verify_token: 1 }, { unique: true, sparse: true });

module.exports = model('Receipt', receiptSchema);
