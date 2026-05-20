const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ORDER_PRIORITY, ORDER_PRIORITIES, ORDER_STATUS, ORDER_STATUSES, ORDER_TYPES } = require('../../constants/statuses');

// Bảng orders: Lưu chỉ định mẹ cho xét nghiệm, CĐHA, thủ thuật, thuốc và dịch vụ.

const orderSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    ordered_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog' },
    charge_id: { type: Schema.Types.ObjectId, ref: 'Charge' },
    order_no: { type: String, required: true, unique: true, trim: true },
    order_type: { type: String, enum: ORDER_TYPES, required: true },
    priority: { type: String, enum: ORDER_PRIORITIES, default: ORDER_PRIORITY.ROUTINE, required: true },
    is_billable: { type: Boolean, default: false, required: true },
    clinical_indication: { type: String },
    requested_at: { type: Date },
    ordered_at: { type: Date, required: true },
    acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledged_at: { type: Date },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_role: { type: String, trim: true },
    assigned_department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    assigned_room_id: { type: Schema.Types.ObjectId, ref: 'Room' },
    assigned_by: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_at: { type: Date },
    assignment_status: {
      type: String,
      enum: ['unassigned', 'assigned', 'accepted', 'in_progress', 'blocked', 'completed'],
      default: 'unassigned',
    },
    sla_policy_id: { type: Schema.Types.ObjectId },
    sla_started_at: { type: Date },
    sla_due_at: { type: Date },
    sla_stopped_at: { type: Date },
    sla_status: {
      type: String,
      enum: ['within_sla', 'warning', 'breached', 'paused', 'completed'],
    },
    sla_breach_minutes: { type: Number, min: 0 },
    sla_reason: { type: String },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    cancel_category: { type: String, trim: true },
    cancelled_from_status: { type: String, trim: true },
    charge_voided_count: { type: Number, default: 0, min: 0 },
    replacement_order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
    cancel_policy_code: { type: String, trim: true },
    entered_in_error_by: { type: Schema.Types.ObjectId, ref: 'User' },
    entered_in_error_at: { type: Date },
    entered_in_error_reason: { type: String },
    entered_in_error_category: { type: String, trim: true },
    entered_in_error_from_status: { type: String, trim: true },
    entered_in_error_review_status: {
      type: String,
      enum: ['not_required', 'pending', 'reviewed', 'rejected'],
      default: 'not_required',
    },
    entered_in_error_reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    entered_in_error_reviewed_at: { type: Date },
    entered_in_error_review_note: { type: String },
    status: { type: String, enum: ORDER_STATUSES, default: ORDER_STATUS.ORDERED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'orders' },
);

orderSchema.index({ patient_id: 1 });
orderSchema.index({ encounter_id: 1 });
orderSchema.index({ admission_id: 1 });
orderSchema.index({ department_id: 1 });
orderSchema.index({ ordered_by: 1 });
orderSchema.index({ service_id: 1 });
orderSchema.index({ charge_id: 1 });
orderSchema.index({ order_type: 1 });
orderSchema.index({ priority: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ ordered_at: 1 });
orderSchema.index({ acknowledged_at: 1 });
orderSchema.index({ assigned_to: 1 });
orderSchema.index({ assigned_department_id: 1 });
orderSchema.index({ assignment_status: 1 });
orderSchema.index({ sla_due_at: 1 });
orderSchema.index({ sla_status: 1 });
orderSchema.index({ cancelled_at: 1 });
orderSchema.index({ entered_in_error_at: 1 });
orderSchema.index({ patient_id: 1, ordered_at: 1 });
orderSchema.index({ encounter_id: 1, order_type: 1 });
orderSchema.index({ order_type: 1, status: 1, priority: 1 });

module.exports = model('Order', orderSchema);
