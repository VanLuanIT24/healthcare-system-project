const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const diagnosisStatuses = ['active', 'resolved', 'entered_in_error'];
const diagnosisTypes = ['provisional', 'confirmed', 'discharge', 'secondary'];

const diagnosisSchema = new Schema(
  {
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    consultation_id: { type: Schema.Types.ObjectId, ref: 'Consultation' },
    recorded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    icd10_code: { type: String, trim: true },
    diagnosis_name: { type: String, required: true, trim: true },
    diagnosis_type: { type: String, enum: diagnosisTypes, default: 'provisional', required: true },
    is_primary: { type: Boolean, default: false, required: true },
    onset_date: { type: Date },
    notes: { type: String },
    status: { type: String, enum: diagnosisStatuses, default: 'active', required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'diagnoses' },
);

diagnosisSchema.index({ encounter_id: 1 });
diagnosisSchema.index({ consultation_id: 1 });
diagnosisSchema.index({ recorded_by: 1 });
diagnosisSchema.index({ icd10_code: 1 });
diagnosisSchema.index({ status: 1 });
diagnosisSchema.index({ encounter_id: 1, is_primary: 1 });

module.exports = model('Diagnosis', diagnosisSchema);
