const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const prescriptionStatuses = ['draft', 'active', 'verified', 'partially_dispensed', 'fully_dispensed', 'cancelled', 'completed'];

const prescriptionSchema = new Schema(
  {
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    prescribed_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    prescription_no: { type: String, required: true, unique: true, trim: true },
    prescribed_at: { type: Date, required: true },
    status: { type: String, enum: prescriptionStatuses, default: 'draft', required: true },
    note: { type: String },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { ...baseSchemaOptions, collection: 'prescriptions' },
);

prescriptionSchema.index({ encounter_id: 1 });
prescriptionSchema.index({ prescribed_by: 1 });
prescriptionSchema.index({ prescribed_at: 1 });
prescriptionSchema.index({ status: 1 });
prescriptionSchema.index({ encounter_id: 1, prescribed_at: 1 });

module.exports = model('Prescription', prescriptionSchema);
