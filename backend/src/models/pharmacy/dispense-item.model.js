const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { DISPENSE_ITEM_STATUS, DISPENSE_ITEM_STATUSES } = require('../../constants/statuses');

// Bảng dispense_items: Lưu từng dòng thuốc đã cấp phát, số lượng và lô thuốc tương ứng.

const dispenseItemSchema = new Schema(
  {
    dispense_id: { type: Schema.Types.ObjectId, ref: 'Dispense', required: true },
    prescription_item_id: { type: Schema.Types.ObjectId, ref: 'PrescriptionItem', required: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true },
    instructions: { type: String },
    status: { type: String, enum: DISPENSE_ITEM_STATUSES, default: DISPENSE_ITEM_STATUS.PLANNED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'dispense_items' },
);

dispenseItemSchema.index({ dispense_id: 1 });
dispenseItemSchema.index({ prescription_item_id: 1 });
dispenseItemSchema.index({ medication_id: 1 });
dispenseItemSchema.index({ stock_batch_id: 1 });
dispenseItemSchema.index({ status: 1 });
dispenseItemSchema.index({ dispense_id: 1, medication_id: 1 });
dispenseItemSchema.index(
  { dispense_id: 1, prescription_item_id: 1, stock_batch_id: 1 },
  {
    unique: true,
    partialFilterExpression: { status: DISPENSE_ITEM_STATUS.DISPENSED },
  },
);

module.exports = model('DispenseItem', dispenseItemSchema);
