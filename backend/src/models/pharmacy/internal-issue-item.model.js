const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const internalIssueItemSchema = new Schema(
  {
    issue_id: { type: Schema.Types.ObjectId, ref: 'InternalIssue', required: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    inventory_transaction_id: { type: Schema.Types.ObjectId, ref: 'InventoryTransaction' },
    quantity_requested: { type: Number, required: true, min: 0 },
    quantity_approved: { type: Number, min: 0 },
    quantity_dispatched: { type: Number, min: 0 },
    quantity_received: { type: Number, min: 0 },
    unit_cost: { type: Number, min: 0 },
    line_status: { type: String, enum: ['draft', 'approved', 'picked', 'dispatched', 'received', 'cancelled'], default: 'draft' },
    warning_flags: [{ type: String, trim: true }],
    note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'internal_issue_items' },
);

internalIssueItemSchema.index({ issue_id: 1 });
internalIssueItemSchema.index({ medication_id: 1 });
internalIssueItemSchema.index({ stock_batch_id: 1 });

module.exports = model('InternalIssueItem', internalIssueItemSchema);

