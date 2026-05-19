const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const inventoryReturnItemSchema = new Schema(
  {
    return_id: { type: Schema.Types.ObjectId, ref: 'InventoryReturn', required: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch', required: true },
    inventory_transaction_id: { type: Schema.Types.ObjectId, ref: 'InventoryTransaction' },
    quantity_returned: { type: Number, required: true, min: 0 },
    quantity_accepted: { type: Number, min: 0 },
    condition_status: {
      type: String,
      enum: ['sealed', 'opened', 'damaged_packaging', 'temperature_excursion', 'expired', 'unknown_origin'],
      default: 'sealed',
    },
    decision: {
      type: String,
      enum: ['restock', 'quarantine', 'dispose', 'reject', 'supplier_return'],
      default: 'restock',
    },
    unit_cost: { type: Number, min: 0 },
    note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'inventory_return_items' },
);

inventoryReturnItemSchema.index({ return_id: 1 });
inventoryReturnItemSchema.index({ medication_id: 1 });
inventoryReturnItemSchema.index({ stock_batch_id: 1 });

module.exports = model('InventoryReturnItem', inventoryReturnItemSchema);

