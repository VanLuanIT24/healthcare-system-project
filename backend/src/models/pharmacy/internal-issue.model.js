const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const ISSUE_STATUSES = ['draft', 'pending_approval', 'approved', 'picking', 'dispatched', 'received', 'rejected', 'cancelled'];
const ISSUE_PRIORITIES = ['routine', 'urgent', 'stat'];

const internalIssueSchema = new Schema(
  {
    issue_no: { type: String, required: true, unique: true, trim: true },
    from_warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    to_department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    to_warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    to_location_label: { type: String, trim: true },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    picked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    dispatched_by: { type: Schema.Types.ObjectId, ref: 'User' },
    received_by: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ISSUE_STATUSES, default: 'draft', required: true },
    priority: { type: String, enum: ISSUE_PRIORITIES, default: 'routine' },
    reason: { type: String, required: true },
    note: { type: String },
    requested_at: { type: Date },
    approved_at: { type: Date },
    picked_at: { type: Date },
    dispatched_at: { type: Date },
    received_at: { type: Date },
    cancelled_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancel_reason: { type: String },
    total_quantity_requested: { type: Number, default: 0, min: 0 },
    total_quantity_dispatched: { type: Number, default: 0, min: 0 },
    total_value: { type: Number, default: 0, min: 0 },
    warning_flags: [{ type: String, trim: true }],
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'internal_issues' },
);

internalIssueSchema.index({ status: 1, requested_at: -1 });
internalIssueSchema.index({ from_warehouse_id: 1, status: 1 });
internalIssueSchema.index({ to_department_id: 1, status: 1 });

module.exports = model('InternalIssue', internalIssueSchema);

