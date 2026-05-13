const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { DISPENSE_STATUS, DISPENSE_STATUSES } = require('../../constants/statuses');

// Bảng dispenses: Lưu phiếu cấp phát thuốc theo đơn và thông tin dược sĩ cấp phát.

const dispenseSchema = new Schema(
  {
    prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    dispense_no: { type: String, required: true, unique: true, trim: true },
    dispensed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    dispensed_at: { type: Date },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    note: { type: String },
    status: { type: String, enum: DISPENSE_STATUSES, default: DISPENSE_STATUS.DRAFT, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'dispenses' },
);

dispenseSchema.index({ prescription_id: 1 });
dispenseSchema.index({ patient_id: 1 });
dispenseSchema.index({ encounter_id: 1 });
dispenseSchema.index({ dispensed_by: 1 });
dispenseSchema.index({ dispensed_at: 1 });
dispenseSchema.index({ status: 1 });
dispenseSchema.index({ patient_id: 1, dispensed_at: 1 });

module.exports = model('Dispense', dispenseSchema);
