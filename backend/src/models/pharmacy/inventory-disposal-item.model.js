const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const inventoryDisposalItemSchema = new Schema(
  {
    disposal_id: { type: Schema.Types.ObjectId, ref: 'InventoryDisposal', required: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch', required: true },
    inventory_transaction_id: { type: Schema.Types.ObjectId, ref: 'InventoryTransaction' },
    quantity: { type: Number, required: true, min: 0 },
    unit_cost: { type: Number, min: 0 },
    reason_code: { type: String, trim: true },
    line_status: { type: String, enum: ['draft', 'posted', 'cancelled'], default: 'draft' },
    note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'inventory_disposal_items' },
);

inventoryDisposalItemSchema.index({ disposal_id: 1 });
inventoryDisposalItemSchema.index({ medication_id: 1 });
inventoryDisposalItemSchema.index({ stock_batch_id: 1 });

module.exports = model('InventoryDisposalItem', inventoryDisposalItemSchema);

