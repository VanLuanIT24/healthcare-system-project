const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const RETURN_SOURCES = ['dispense', 'department', 'ward_stock', 'patient', 'supplier', 'transfer', 'issue'];
const RETURN_STATUSES = ['draft', 'pending_inspection', 'accepted', 'quarantined', 'rejected', 'posted', 'cancelled'];

const inventoryReturnSchema = new Schema(
  {
    return_no: { type: String, required: true, unique: true, trim: true },
    return_source: { type: String, enum: RETURN_SOURCES, default: 'department', required: true },
    source_reference_type: { type: String, trim: true },
    source_reference_id: { type: Schema.Types.ObjectId },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    status: { type: String, enum: RETURN_STATUSES, default: 'draft', required: true },
    returned_by: { type: Schema.Types.ObjectId, ref: 'User' },
    returned_by_name: { type: String, trim: true },
    received_by: { type: Schema.Types.ObjectId, ref: 'User' },
    inspected_by: { type: Schema.Types.ObjectId, ref: 'User' },
    posted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, required: true },
    note: { type: String },
    attachment_ids: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
    inspected_at: { type: Date },
    posted_at: { type: Date },
    total_quantity_returned: { type: Number, default: 0, min: 0 },
    total_quantity_accepted: { type: Number, default: 0, min: 0 },
    total_value: { type: Number, default: 0, min: 0 },
    cancelled_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancel_reason: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'inventory_returns' },
);

inventoryReturnSchema.index({ status: 1, created_at: -1 });
inventoryReturnSchema.index({ return_source: 1, status: 1 });
inventoryReturnSchema.index({ warehouse_id: 1, status: 1 });

module.exports = model('InventoryReturn', inventoryReturnSchema);

