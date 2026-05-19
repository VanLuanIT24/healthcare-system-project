const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const DISPOSAL_TYPES = ['expired', 'damaged', 'lost', 'recall', 'discrepancy', 'temperature_excursion', 'other'];
const DISPOSAL_STATUSES = ['draft', 'pending_approval', 'approved', 'posted', 'rejected', 'cancelled'];

const inventoryDisposalSchema = new Schema(
  {
    disposal_no: { type: String, required: true, unique: true, trim: true },
    disposal_type: { type: String, enum: DISPOSAL_TYPES, default: 'other', required: true },
    status: { type: String, enum: DISPOSAL_STATUSES, default: 'draft', required: true },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    posted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    witness_user_ids: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reason: { type: String, required: true },
    note: { type: String },
    attachment_ids: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
    total_quantity: { type: Number, default: 0, min: 0 },
    total_value: { type: Number, default: 0, min: 0 },
    approved_at: { type: Date },
    posted_at: { type: Date },
    cancelled_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancel_reason: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'inventory_disposals' },
);

inventoryDisposalSchema.index({ status: 1, created_at: -1 });
inventoryDisposalSchema.index({ disposal_type: 1, status: 1 });
inventoryDisposalSchema.index({ warehouse_id: 1, status: 1 });

module.exports = model('InventoryDisposal', inventoryDisposalSchema);

