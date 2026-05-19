const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const inventoryTransferItemSchema = new Schema(
  {
    transfer_id: { type: Schema.Types.ObjectId, ref: 'InventoryTransfer', required: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    from_stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    to_stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    out_transaction_id: { type: Schema.Types.ObjectId, ref: 'InventoryTransaction' },
    in_transaction_id: { type: Schema.Types.ObjectId, ref: 'InventoryTransaction' },
    quantity_requested: { type: Number, required: true, min: 0 },
    quantity_dispatched: { type: Number, min: 0 },
    quantity_received: { type: Number, min: 0 },
    from_location_id: { type: Schema.Types.ObjectId, ref: 'StorageLocation' },
    to_location_id: { type: Schema.Types.ObjectId, ref: 'StorageLocation' },
    from_location: { type: String, trim: true },
    to_location: { type: String, trim: true },
    expiry_date: { type: Date },
    status: { type: String, enum: ['draft', 'dispatched', 'received', 'discrepancy', 'cancelled'], default: 'draft' },
    discrepancy_reason: { type: String },
    note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'inventory_transfer_items' },
);

inventoryTransferItemSchema.index({ transfer_id: 1 });
inventoryTransferItemSchema.index({ medication_id: 1 });
inventoryTransferItemSchema.index({ from_stock_batch_id: 1 });

module.exports = model('InventoryTransferItem', inventoryTransferItemSchema);

