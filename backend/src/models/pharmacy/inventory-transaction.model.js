const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { INVENTORY_TRANSACTION_DIRECTIONS, INVENTORY_TRANSACTION_TYPES } = require('../../constants/statuses');

// Bảng inventory_transactions: Lưu nhật ký nhập/xuất/điều chỉnh kho thuốc theo nguyên tắc append-only.

const inventoryTransactionSchema = new Schema(
  {
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    transaction_no: { type: String, required: true, unique: true, trim: true },
    transaction_type: { type: String, enum: INVENTORY_TRANSACTION_TYPES, required: true },
    direction: { type: String, enum: INVENTORY_TRANSACTION_DIRECTIONS, required: true },
    quantity: { type: Number, required: true, min: 0 },
    balance_before: { type: Number, min: 0 },
    balance_after: { type: Number, min: 0 },
    unit_cost: { type: Number, min: 0 },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    from_warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    to_warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    storage_location_id: { type: Schema.Types.ObjectId, ref: 'StorageLocation' },
    from_storage_location_id: { type: Schema.Types.ObjectId, ref: 'StorageLocation' },
    to_storage_location_id: { type: Schema.Types.ObjectId, ref: 'StorageLocation' },
    reference_type: { type: String, trim: true },
    reference_id: { type: Schema.Types.ObjectId },
    reason_code: { type: String, trim: true },
    document_no: { type: String, trim: true },
    approval_id: { type: Schema.Types.ObjectId, ref: 'ApprovalRequest' },
    metadata: { type: Schema.Types.Mixed },
    performed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    occurred_at: { type: Date, required: true },
    note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'inventory_transactions' },
);

inventoryTransactionSchema.index({ medication_id: 1 });
inventoryTransactionSchema.index({ stock_batch_id: 1 });
inventoryTransactionSchema.index({ transaction_type: 1 });
inventoryTransactionSchema.index({ direction: 1 });
inventoryTransactionSchema.index({ reference_type: 1, reference_id: 1 });
inventoryTransactionSchema.index({ performed_by: 1 });
inventoryTransactionSchema.index({ occurred_at: 1 });
inventoryTransactionSchema.index({ warehouse_id: 1, occurred_at: 1 });
inventoryTransactionSchema.index({ document_no: 1 });
inventoryTransactionSchema.index({ medication_id: 1, occurred_at: 1 });
inventoryTransactionSchema.index({ occurred_at: 1, transaction_type: 1 });

module.exports = model('InventoryTransaction', inventoryTransactionSchema);
