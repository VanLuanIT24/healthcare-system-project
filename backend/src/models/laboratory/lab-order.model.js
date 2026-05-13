const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { LAB_ORDER_STATUS, LAB_ORDER_STATUSES, ORDER_PRIORITY, ORDER_PRIORITIES } = require('../../constants/statuses');

// Bảng lab_orders: Lưu chỉ định xét nghiệm chi tiết được tách từ order mẹ.

const labOrderSchema = new Schema(
  {
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    ordered_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lab_order_no: { type: String, required: true, unique: true, trim: true },
    test_code: { type: String, trim: true },
    test_name: { type: String, required: true, trim: true },
    specimen_type: { type: String, trim: true },
    priority: { type: String, enum: ORDER_PRIORITIES, default: ORDER_PRIORITY.ROUTINE, required: true },
    ordered_at: { type: Date, required: true },
    collected_at: { type: Date },
    completed_at: { type: Date },
    clinical_note: { type: String },
    status: { type: String, enum: LAB_ORDER_STATUSES, default: LAB_ORDER_STATUS.ORDERED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'lab_orders' },
);

labOrderSchema.index({ order_id: 1 }, { unique: true });
labOrderSchema.index({ patient_id: 1 });
labOrderSchema.index({ encounter_id: 1 });
labOrderSchema.index({ ordered_by: 1 });
labOrderSchema.index({ test_code: 1 });
labOrderSchema.index({ priority: 1 });
labOrderSchema.index({ status: 1 });
labOrderSchema.index({ ordered_at: 1 });
labOrderSchema.index({ encounter_id: 1, ordered_at: 1 });

module.exports = model('LabOrder', labOrderSchema);
