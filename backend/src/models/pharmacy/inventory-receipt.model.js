const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const RECEIPT_STATUSES = ['draft', 'pending_review', 'posted', 'cancelled'];

const inventoryReceiptSchema = new Schema(
  {
    receipt_no: { type: String, required: true, unique: true, trim: true },
    supplier_id: { type: Schema.Types.ObjectId },
    supplier_name: { type: String, trim: true },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    received_at: { type: Date },
    received_by: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: RECEIPT_STATUSES, default: 'draft', required: true },
    invoice_no: { type: String, trim: true },
    purchase_order_no: { type: String, trim: true },
    total_quantity: { type: Number, default: 0, min: 0 },
    total_value: { type: Number, default: 0, min: 0 },
    attachment_ids: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
    note: { type: String },
    posted_at: { type: Date },
    posted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancel_reason: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'inventory_receipts' },
);

inventoryReceiptSchema.index({ status: 1, received_at: -1 });
inventoryReceiptSchema.index({ supplier_name: 1 });
inventoryReceiptSchema.index({ warehouse_id: 1, status: 1 });

module.exports = model('InventoryReceipt', inventoryReceiptSchema);

