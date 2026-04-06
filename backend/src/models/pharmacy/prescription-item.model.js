const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const prescriptionItemStatuses = ['active', 'held', 'stopped', 'cancelled', 'completed'];

const prescriptionItemSchema = new Schema(
  {
    prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription', required: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    dose: { type: String, trim: true },
    frequency: { type: String, trim: true },
    route: { type: String, trim: true },
    duration_days: { type: Number, min: 0 },
    quantity: { type: Number, min: 0 },
    instructions: { type: String },
    status: { type: String, enum: prescriptionItemStatuses, default: 'active', required: true },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { ...baseSchemaOptions, collection: 'prescription_items' },
);

prescriptionItemSchema.index({ prescription_id: 1 });
prescriptionItemSchema.index({ medication_id: 1 });
prescriptionItemSchema.index({ status: 1 });
prescriptionItemSchema.index({ prescription_id: 1, medication_id: 1 });

module.exports = model('PrescriptionItem', prescriptionItemSchema);
