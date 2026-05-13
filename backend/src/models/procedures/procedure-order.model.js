const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ORDER_PRIORITY, ORDER_PRIORITIES, PROCEDURE_STATUS, PROCEDURE_STATUSES } = require('../../constants/statuses');

// Bảng procedure_orders: Lưu chỉ định thủ thuật, người thực hiện và kết quả thủ thuật.

const procedureOrderSchema = new Schema(
  {
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performer_id: { type: Schema.Types.ObjectId, ref: 'User' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    procedure_order_no: { type: String, required: true, unique: true, trim: true },
    procedure_code: { type: String, trim: true },
    procedure_name: { type: String, required: true, trim: true },
    priority: { type: String, enum: ORDER_PRIORITIES, default: ORDER_PRIORITY.ROUTINE, required: true },
    clinical_indication: { type: String },
    scheduled_start: { type: Date },
    scheduled_end: { type: Date },
    scheduled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    scheduled_at: { type: Date },
    performed_start: { type: Date },
    performed_end: { type: Date },
    started_by: { type: Schema.Types.ObjectId, ref: 'User' },
    started_at: { type: Date },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },
    result_note: { type: String },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    no_show_by: { type: Schema.Types.ObjectId, ref: 'User' },
    no_show_at: { type: Date },
    no_show_reason: { type: String },
    status: { type: String, enum: PROCEDURE_STATUSES, default: PROCEDURE_STATUS.ORDERED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'procedure_orders' },
);

procedureOrderSchema.index({ order_id: 1 }, { unique: true });
procedureOrderSchema.index({ patient_id: 1 });
procedureOrderSchema.index({ encounter_id: 1 });
procedureOrderSchema.index({ requested_by: 1 });
procedureOrderSchema.index({ performer_id: 1 });
procedureOrderSchema.index({ department_id: 1 });
procedureOrderSchema.index({ procedure_code: 1 });
procedureOrderSchema.index({ status: 1 });
procedureOrderSchema.index({ scheduled_start: 1 });
procedureOrderSchema.index({ performed_start: 1 });
procedureOrderSchema.index({ completed_at: 1 });
procedureOrderSchema.index({ cancelled_at: 1 });
procedureOrderSchema.index({ no_show_at: 1 });
procedureOrderSchema.index({ patient_id: 1, scheduled_start: 1 });

module.exports = model('ProcedureOrder', procedureOrderSchema);
