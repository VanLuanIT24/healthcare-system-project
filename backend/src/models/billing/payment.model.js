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
    payment_no: { type: String, required: true, unique: true, trim: true },
    amount: { type: Number, required: true, min: 0, validate: integerMoneyValidator },
    currency: { type: String, default: 'VND', trim: true, uppercase: true },
    payment_method: { type: String, enum: PAYMENT_METHODS, required: true },
    transaction_ref: { type: String, trim: true },
    paid_at: { type: Date },
    received_by: { type: Schema.Types.ObjectId, ref: 'User' },
    voided_by: { type: Schema.Types.ObjectId, ref: 'User' },
    voided_at: { type: Date },
    void_reason: { type: String },
    refunded_by: { type: Schema.Types.ObjectId, ref: 'User' },
    refunded_at: { type: Date },
    refund_reason: { type: String },
    status: { type: String, enum: PAYMENT_STATUSES, default: PAYMENT_STATUS.PENDING, required: true },
    note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'payments' },
);

paymentSchema.index({ invoice_id: 1 });
paymentSchema.index({ patient_id: 1 });
paymentSchema.index({ payment_method: 1 });
paymentSchema.index({ transaction_ref: 1 });
paymentSchema.index({ paid_at: 1 });
paymentSchema.index({ received_by: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ patient_id: 1, paid_at: 1 });
paymentSchema.index({ paid_at: 1, status: 1 });
paymentSchema.index({ payment_method: 1, paid_at: 1 });
paymentSchema.index({ invoice_id: 1, status: 1, amount: 1 });

module.exports = model('Payment', paymentSchema);
