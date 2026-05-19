const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const inventoryReceiptItemSchema = new Schema(
  {
    receipt_id: { type: Schema.Types.ObjectId, ref: 'InventoryReceipt', required: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    inventory_transaction_id: { type: Schema.Types.ObjectId, ref: 'InventoryTransaction' },
    batch_no: { type: String, required: true, trim: true },
    lot_no: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit_cost: { type: Number, min: 0 },
    expiry_date: { type: Date },
    manufacture_date: { type: Date },
    storage_location_id: { type: Schema.Types.ObjectId, ref: 'StorageLocation' },
    storage_location: { type: String, trim: true },
    line_status: { type: String, enum: ['draft', 'posted', 'cancelled'], default: 'draft' },
    warning_flags: [{ type: String, trim: true }],
    note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'inventory_receipt_items' },
);

inventoryReceiptItemSchema.index({ receipt_id: 1 });
inventoryReceiptItemSchema.index({ medication_id: 1 });
inventoryReceiptItemSchema.index({ stock_batch_id: 1 });

module.exports = model('InventoryReceiptItem', inventoryReceiptItemSchema);

