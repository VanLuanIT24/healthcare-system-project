const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const medicationAdministrationPolicySchema = new Schema(
  {
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    route: { type: String, trim: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster' },
    high_alert_medication: { type: Boolean, default: false },
    early_minutes_allowed: { type: Number, default: 60, min: 0 },
    late_minutes_allowed: { type: Number, default: 30, min: 0 },
    requires_patient_scan: { type: Boolean, default: true },
    requires_medication_scan: { type: Boolean, default: true },
    requires_double_check: { type: Boolean, default: false },
    requires_vital_before: { type: Boolean, default: false },
    requires_vital_after: { type: Boolean, default: false },
    requires_blood_glucose: { type: Boolean, default: false },
    requires_pain_score: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    note: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'medication_administration_policies' },
);

medicationAdministrationPolicySchema.index({ department_id: 1, medication_id: 1, status: 1 });
medicationAdministrationPolicySchema.index({ medication_id: 1, status: 1 });
medicationAdministrationPolicySchema.index({ route: 1, status: 1 });

module.exports = model('MedicationAdministrationPolicy', medicationAdministrationPolicySchema);

