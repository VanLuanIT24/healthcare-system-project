const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const receiptPrintLogSchema = new Schema(
  {
    receipt_id: { type: Schema.Types.ObjectId, ref: 'Receipt' },
    payment_id: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    receipt_no: { type: String, required: true, trim: true },
    action: { type: String, enum: ['preview', 'print', 'reprint', 'download', 'send'], default: 'print' },
    copy_type: { type: String, enum: ['original', 'duplicate', 'refund_copy', 'void_copy'], default: 'original' },
    printed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    printed_at: { type: Date, default: Date.now, required: true },
    printer_name: { type: String, trim: true },
    counter_id: { type: String, trim: true },
    counter_code: { type: String, trim: true },
    cashier_shift_id: { type: Schema.Types.ObjectId, ref: 'CashierShift' },
    copy_no: { type: Number, default: 1, min: 1 },
    reason: { type: String, trim: true },
    ip: { type: String, trim: true },
    user_agent: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'receipt_print_logs' },
);

receiptPrintLogSchema.index({ receipt_id: 1, printed_at: -1 });
receiptPrintLogSchema.index({ payment_id: 1, printed_at: -1 });
receiptPrintLogSchema.index({ cashier_shift_id: 1, printed_at: -1 });
receiptPrintLogSchema.index({ patient_id: 1, printed_at: -1 });
receiptPrintLogSchema.index({ action: 1, printed_at: -1 });

module.exports = model('ReceiptPrintLog', receiptPrintLogSchema);
