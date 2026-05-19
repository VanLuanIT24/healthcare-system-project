const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { STOCKTAKE_ITEM_STATUSES, STOCKTAKE_ITEM_STATUS } = require('../../constants/statuses');

const stocktakeItemSchema = new Schema(
  {
    stocktake_id: { type: Schema.Types.ObjectId, ref: 'StocktakeSession', required: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch', required: true },
    system_quantity: { type: Number, required: true, min: 0 },
    counted_quantity: { type: Number, min: 0 },
    variance_quantity: { type: Number, default: 0 },
    unit_cost: { type: Number, default: 0, min: 0 },
    variance_value: { type: Number, default: 0 },
    counted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    counted_at: { type: Date },
    variance_reason: { type: String },
    note: { type: String },
    status: { type: String, enum: STOCKTAKE_ITEM_STATUSES, default: STOCKTAKE_ITEM_STATUS.PENDING, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'stocktake_items' },
);

stocktakeItemSchema.index({ stocktake_id: 1, status: 1 });
stocktakeItemSchema.index({ stocktake_id: 1, stock_batch_id: 1 }, { unique: true });
stocktakeItemSchema.index({ medication_id: 1 });
stocktakeItemSchema.index({ stock_batch_id: 1 });

module.exports = model('StocktakeItem', stocktakeItemSchema);
