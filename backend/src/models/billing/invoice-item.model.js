const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

// Bảng invoice_items: Lưu chi tiết hóa đơn và snapshot dịch vụ tại thời điểm xuất hóa đơn.
const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const invoiceItemSchema = new Schema(
  {
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    charge_id: { type: Schema.Types.ObjectId, ref: 'Charge' },
    service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog' },
    charge_no: { type: String, trim: true },
    service_code: { type: String, trim: true },
    service_name: { type: String, trim: true },
    description: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 0, required: true },
    unit_price: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    discount_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    tax_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    line_total: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    display_order: { type: Number, default: 0 },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'invoice_items' },
);

invoiceItemSchema.index({ invoice_id: 1 });
invoiceItemSchema.index({ charge_id: 1 });
invoiceItemSchema.index({ service_id: 1 });
invoiceItemSchema.index({ charge_no: 1 });
invoiceItemSchema.index({ service_code: 1 });
invoiceItemSchema.index({ invoice_id: 1, display_order: 1 });

module.exports = model('InvoiceItem', invoiceItemSchema);
