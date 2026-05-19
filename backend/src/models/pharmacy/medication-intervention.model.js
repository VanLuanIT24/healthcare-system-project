const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const INTERVENTION_TYPES = [
  'allergy_risk',
  'drug_interaction',
  'duplicate_therapy',
  'dose_adjustment',
  'renal_dose_adjustment',
  'route_issue',
  'timing_issue',
  'missed_dose',
  'adverse_reaction',
  'stock_substitution',
  'controlled_drug_issue',
];

const medicationInterventionSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    prescription_item_id: { type: Schema.Types.ObjectId, ref: 'PrescriptionItem' },
    medication_administration_id: { type: Schema.Types.ObjectId, ref: 'MedicationAdministration' },
    intervention_type: { type: String, enum: INTERVENTION_TYPES, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium', required: true },
    recommendation: { type: String, required: true },
    status: { type: String, enum: ['open', 'doctor_review', 'accepted', 'rejected', 'closed'], default: 'open', required: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_by_doctor: { type: Schema.Types.ObjectId, ref: 'User' },
    doctor_response: { type: String },
    accepted_at: { type: Date },
    rejected_reason: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'medication_interventions' },
);

medicationInterventionSchema.index({ medication_administration_id: 1, status: 1 });
medicationInterventionSchema.index({ patient_id: 1, status: 1 });
medicationInterventionSchema.index({ intervention_type: 1, severity: 1, status: 1 });

module.exports = model('MedicationIntervention', medicationInterventionSchema);

