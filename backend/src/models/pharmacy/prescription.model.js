const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { PRESCRIPTION_STATUS, PRESCRIPTION_STATUSES } = require('../../constants/statuses');

// Bảng prescriptions: Lưu đơn thuốc theo bệnh nhân/encounter và trạng thái cấp phát.

const prescriptionSchema = new Schema(
  {
    order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    prescribed_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    prescription_no: { type: String, required: true, unique: true, trim: true },
    prescribed_at: { type: Date, required: true },
    verified_by: { type: Schema.Types.ObjectId, ref: 'User' },
    verified_at: { type: Date },
    amended_from: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    superseded_by: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    renewed_from: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    version: { type: Number, default: 1, min: 1, required: true },
    is_current: { type: Boolean, default: true, required: true },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },
    status: { type: String, enum: PRESCRIPTION_STATUSES, default: PRESCRIPTION_STATUS.DRAFT, required: true },
    note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'prescriptions' },
);

prescriptionSchema.index({ order_id: 1 }, { unique: true, sparse: true });
prescriptionSchema.index({ patient_id: 1 });
prescriptionSchema.index({ encounter_id: 1 });
prescriptionSchema.index({ prescribed_by: 1 });
prescriptionSchema.index({ prescribed_at: 1 });
prescriptionSchema.index({ status: 1 });
prescriptionSchema.index({ amended_from: 1 });
prescriptionSchema.index({ renewed_from: 1 });
prescriptionSchema.index({ is_current: 1 });
prescriptionSchema.index({ patient_id: 1, prescribed_at: 1 });
prescriptionSchema.index({ encounter_id: 1, prescribed_at: 1 });

module.exports = model('Prescription', prescriptionSchema);
