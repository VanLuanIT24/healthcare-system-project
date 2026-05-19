const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const BLEEDING_LEVELS = ['none', 'mild', 'moderate', 'severe'];
const CONSCIOUSNESS_LEVELS = ['alert', 'drowsy', 'confused', 'unresponsive'];
const OBSERVATION_SEVERITIES = ['normal', 'watch', 'urgent', 'critical'];
const POST_PROCEDURE_STATUSES = ['monitoring', 'stable', 'doctor_notified', 'escalated', 'emergency', 'resolved'];

const postProcedureObservationSchema = new Schema(
  {
    procedure_order_id: { type: Schema.Types.ObjectId, ref: 'ProcedureOrder', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    observed_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    observed_at: { type: Date, default: Date.now, required: true },
    pain_score: { type: Number, min: 0, max: 10 },
    bleeding_level: { type: String, enum: BLEEDING_LEVELS, default: 'none' },
    wound_status: { type: String, trim: true },
    consciousness: { type: String, enum: CONSCIOUSNESS_LEVELS, default: 'alert' },
    nausea: { type: Boolean, default: false },
    vomiting: { type: Boolean, default: false },
    dizziness: { type: Boolean, default: false },
    dyspnea: { type: Boolean, default: false },
    pallor: { type: Boolean, default: false },
    vital_sign_id: { type: Schema.Types.ObjectId, ref: 'VitalSign' },
    intervention_note: { type: String, trim: true },
    patient_instruction: { type: String, trim: true },
    complication_flags: [{ type: String, trim: true }],
    severity: { type: String, enum: OBSERVATION_SEVERITIES, default: 'normal', required: true },
    next_check_at: { type: Date },
    doctor_notified: { type: Boolean, default: false },
    doctor_notification_request_id: { type: Schema.Types.ObjectId, ref: 'DoctorNotificationRequest' },
    emergency_case_id: { type: Schema.Types.ObjectId, ref: 'EmergencyCase' },
    status: { type: String, enum: POST_PROCEDURE_STATUSES, default: 'monitoring', required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'post_procedure_observations' },
);

postProcedureObservationSchema.index({ procedure_order_id: 1, observed_at: -1 });
postProcedureObservationSchema.index({ patient_id: 1, observed_at: -1 });
postProcedureObservationSchema.index({ encounter_id: 1, observed_at: -1 });
postProcedureObservationSchema.index({ severity: 1, status: 1 });
postProcedureObservationSchema.index({ next_check_at: 1, status: 1 });
postProcedureObservationSchema.index({ doctor_notification_request_id: 1 });
postProcedureObservationSchema.index({ emergency_case_id: 1 });

module.exports = model('PostProcedureObservation', postProcedureObservationSchema);
