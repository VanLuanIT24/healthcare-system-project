const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { INVOICE_STATUS, INVOICE_STATUSES } = require('../../constants/statuses');

// Bảng invoices: Lưu hóa đơn tổng, số tiền, trạng thái phát hành và thanh toán.
const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const invoiceSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    invoice_no: { type: String, required: true, unique: true, trim: true },
    subtotal_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    discount_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    tax_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    insurance_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    total_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    paid_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    balance_due: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    currency: { type: String, default: 'VND', trim: true, uppercase: true },
    issued_at: { type: Date },
    issued_by: { type: Schema.Types.ObjectId, ref: 'User' },
    due_at: { type: Date },
    voided_by: { type: Schema.Types.ObjectId, ref: 'User' },
    voided_at: { type: Date },
    void_reason: { type: String },
    status: { type: String, enum: INVOICE_STATUSES, default: INVOICE_STATUS.DRAFT, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'invoices' },
);

invoiceSchema.index({ patient_id: 1 });
invoiceSchema.index({ encounter_id: 1 });
invoiceSchema.index({ admission_id: 1 });
invoiceSchema.index({ issued_at: 1 });
invoiceSchema.index({ due_at: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ patient_id: 1, issued_at: 1 });
invoiceSchema.index({ issued_at: 1, status: 1 });
invoiceSchema.index({ status: 1, balance_due: 1 });

module.exports = model('Invoice', invoiceSchema);
