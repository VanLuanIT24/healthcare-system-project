const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const DISPENSE_RETURN_CONDITIONS = ['sealed', 'opened', 'damaged', 'expired', 'unknown'];
const DISPENSE_RETURN_DISPOSITIONS = ['restock', 'quarantine', 'waste', 'no_stock_movement'];

const dispenseReturnItemSchema = new Schema(
  {
    dispense_return_id: { type: Schema.Types.ObjectId, ref: 'DispenseReturn', required: true },
    dispense_id: { type: Schema.Types.ObjectId, ref: 'Dispense', required: true },
    dispense_item_id: { type: Schema.Types.ObjectId, ref: 'DispenseItem', required: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    quantity: { type: Number, required: true, min: 0 },
    return_condition: { type: String, enum: DISPENSE_RETURN_CONDITIONS, default: 'unknown', required: true },
    disposition: { type: String, enum: DISPENSE_RETURN_DISPOSITIONS, default: 'restock', required: true },
    note: { type: String },
    processed_at: { type: Date },
    processed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    inventory_transaction_id: { type: Schema.Types.ObjectId, ref: 'InventoryTransaction' },
    charge_action: { type: String, enum: ['none', 'reduced', 'voided'], default: 'none' },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'dispense_return_items' },
);

dispenseReturnItemSchema.index({ dispense_return_id: 1 });
dispenseReturnItemSchema.index({ dispense_id: 1 });
dispenseReturnItemSchema.index({ dispense_item_id: 1 });
dispenseReturnItemSchema.index({ medication_id: 1 });
dispenseReturnItemSchema.index({ stock_batch_id: 1 });

module.exports = model('DispenseReturnItem', dispenseReturnItemSchema);
