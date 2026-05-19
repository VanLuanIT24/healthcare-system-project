const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const TRANSFER_STATUSES = ['draft', 'pending_approval', 'approved', 'dispatched', 'in_transit', 'received', 'closed', 'cancelled', 'rejected'];

const inventoryTransferSchema = new Schema(
  {
    transfer_no: { type: String, required: true, unique: true, trim: true },
    from_warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    to_warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    status: { type: String, enum: TRANSFER_STATUSES, default: 'draft', required: true },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    dispatched_by: { type: Schema.Types.ObjectId, ref: 'User' },
    received_by: { type: Schema.Types.ObjectId, ref: 'User' },
    requested_at: { type: Date },
    approved_at: { type: Date },
    dispatched_at: { type: Date },
    received_at: { type: Date },
    reason: { type: String, required: true },
    note: { type: String },
    total_quantity_requested: { type: Number, default: 0, min: 0 },
    total_quantity_dispatched: { type: Number, default: 0, min: 0 },
    total_quantity_received: { type: Number, default: 0, min: 0 },
    total_value: { type: Number, default: 0, min: 0 },
    warning_flags: [{ type: String, trim: true }],
    cancelled_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancel_reason: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'inventory_transfers' },
);

inventoryTransferSchema.index({ status: 1, requested_at: -1 });
inventoryTransferSchema.index({ from_warehouse_id: 1, to_warehouse_id: 1, status: 1 });

module.exports = model('InventoryTransfer', inventoryTransferSchema);

