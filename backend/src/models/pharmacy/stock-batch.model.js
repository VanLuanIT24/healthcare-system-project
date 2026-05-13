const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { STOCK_BATCH_STATUS, STOCK_BATCH_STATUSES } = require('../../constants/statuses');

// Bảng stock_batches: Lưu lô thuốc, hạn dùng, tồn hiện tại và vị trí lưu kho.

const stockBatchSchema = new Schema(
  {
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    batch_no: { type: String, required: true, trim: true },
    lot_no: { type: String, trim: true },
    supplier_name: { type: String, trim: true },
    manufacture_date: { type: Date },
    expiry_date: { type: Date },
    received_date: { type: Date },
    quantity_received: { type: Number, default: 0, min: 0, required: true },
    quantity_on_hand: { type: Number, default: 0, min: 0, required: true },
    unit_cost: { type: Number, min: 0 },
    min_stock_level: { type: Number, default: 0, min: 0 },
    storage_location: { type: String, trim: true },
    status: { type: String, enum: STOCK_BATCH_STATUSES, default: STOCK_BATCH_STATUS.AVAILABLE, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'stock_batches' },
);

stockBatchSchema.index({ medication_id: 1 });
stockBatchSchema.index({ batch_no: 1 });
stockBatchSchema.index({ lot_no: 1 });
stockBatchSchema.index({ expiry_date: 1 });
stockBatchSchema.index({ status: 1 });
stockBatchSchema.index({ status: 1, quantity_on_hand: 1, expiry_date: 1 });
stockBatchSchema.index(
  { medication_id: 1, batch_no: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false } },
);
stockBatchSchema.index({ medication_id: 1, expiry_date: 1 });

module.exports = model('StockBatch', stockBatchSchema);
