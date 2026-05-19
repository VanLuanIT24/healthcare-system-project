const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { STOCK_BATCH_STATUS, STOCK_BATCH_STATUSES } = require('../../constants/statuses');

// Bảng stock_batches: Lưu lô thuốc, hạn dùng, tồn hiện tại và vị trí lưu kho.

const stockBatchSchema = new Schema(
  {
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    batch_no: { type: String, required: true, trim: true },
    lot_no: { type: String, trim: true },
    supplier_id: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    supplier_name: { type: String, trim: true },
    manufacture_date: { type: Date },
    expiry_date: { type: Date },
    received_date: { type: Date },
    quantity_received: { type: Number, default: 0, min: 0, required: true },
    quantity_on_hand: { type: Number, default: 0, min: 0, required: true },
    unit_cost: { type: Number, min: 0 },
    min_stock_level: { type: Number, default: 0, min: 0 },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    storage_location_id: { type: Schema.Types.ObjectId, ref: 'StorageLocation' },
    storage_location: { type: String, trim: true },
    status: { type: String, enum: STOCK_BATCH_STATUSES, default: STOCK_BATCH_STATUS.AVAILABLE, required: true },
    quarantine_reason: { type: String },
    quarantined_by: { type: Schema.Types.ObjectId, ref: 'User' },
    quarantined_at: { type: Date },
    released_by: { type: Schema.Types.ObjectId, ref: 'User' },
    released_at: { type: Date },
    release_reason: { type: String },
    recall_reason: { type: String },
    recalled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    recalled_at: { type: Date },
    recall_reference_no: { type: String, trim: true },
    recall_source: { type: String, trim: true },
    recall_resolution_status: { type: String, enum: ['open', 'investigating', 'resolved', 'closed'], default: undefined },
    depleted_at: { type: Date },
    depleted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    depleted_reason: { type: String, trim: true },
    last_transaction_id: { type: Schema.Types.ObjectId, ref: 'InventoryTransaction' },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'stock_batches' },
);

stockBatchSchema.index({ medication_id: 1 });
stockBatchSchema.index({ batch_no: 1 });
stockBatchSchema.index({ lot_no: 1 });
stockBatchSchema.index({ supplier_id: 1, status: 1 });
stockBatchSchema.index({ supplier_name: 1, status: 1 });
stockBatchSchema.index({ expiry_date: 1 });
stockBatchSchema.index({ status: 1 });
stockBatchSchema.index({ warehouse_id: 1, status: 1 });
stockBatchSchema.index({ storage_location_id: 1, status: 1 });
stockBatchSchema.index({ storage_location: 1, status: 1 });
stockBatchSchema.index({ depleted_at: 1 });
stockBatchSchema.index({ status: 1, quantity_on_hand: 1, expiry_date: 1 });
stockBatchSchema.index(
  { medication_id: 1, batch_no: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false } },
);
stockBatchSchema.index({ medication_id: 1, expiry_date: 1 });

module.exports = model('StockBatch', stockBatchSchema);
