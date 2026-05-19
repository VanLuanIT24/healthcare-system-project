const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const MEDICATION_REACTION_SEVERITIES = ['mild', 'moderate', 'severe', 'life_threatening'];
const MEDICATION_REACTION_STATUSES = ['observed', 'doctor_notified', 'allergy_recorded', 'escalated', 'resolved'];

const medicationReactionObservationSchema = new Schema(
  {
    medication_administration_id: { type: Schema.Types.ObjectId, ref: 'MedicationAdministration', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    observed_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    observed_at: { type: Date, default: Date.now, required: true },
    symptoms: [{ type: String, trim: true }],
    onset_at: { type: Date },
    severity: { type: String, enum: MEDICATION_REACTION_SEVERITIES, default: 'mild', required: true },
    suspected_allergy: { type: Boolean, default: false },
    suspected_medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster' },
    vital_sign_id: { type: Schema.Types.ObjectId, ref: 'VitalSign' },
    intervention_note: { type: String, trim: true },
    medication_stopped: { type: Boolean, default: false },
    allergy_created_id: { type: Schema.Types.ObjectId, ref: 'Allergy' },
    doctor_notification_request_id: { type: Schema.Types.ObjectId, ref: 'DoctorNotificationRequest' },
    emergency_case_id: { type: Schema.Types.ObjectId, ref: 'EmergencyCase' },
    status: { type: String, enum: MEDICATION_REACTION_STATUSES, default: 'observed', required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'medication_reaction_observations' },
);

medicationReactionObservationSchema.index({ medication_administration_id: 1, observed_at: -1 });
medicationReactionObservationSchema.index({ patient_id: 1, observed_at: -1 });
medicationReactionObservationSchema.index({ encounter_id: 1, observed_at: -1 });
medicationReactionObservationSchema.index({ severity: 1, status: 1 });
medicationReactionObservationSchema.index({ suspected_allergy: 1, status: 1 });
medicationReactionObservationSchema.index({ doctor_notification_request_id: 1 });
medicationReactionObservationSchema.index({ emergency_case_id: 1 });

module.exports = model('MedicationReactionObservation', medicationReactionObservationSchema);
