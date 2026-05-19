const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { EMERGENCY_PRIORITIES } = require('../../constants/statuses');

const TRIAGE_STATUS = ['draft', 'in_progress', 'completed', 'signed', 'cancelled', 'entered_in_error'];
const TRIAGE_COLOR = ['red', 'orange', 'yellow', 'green', 'white'];
const ESI_LEVELS = [1, 2, 3, 4, 5];
const AVPU_LEVELS = ['alert', 'voice', 'pain', 'unresponsive'];

const emergencyTriageSchema = new Schema(
  {
    emergency_case_id: { type: Schema.Types.ObjectId, ref: 'EmergencyCase', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },

    triage_by: { type: Schema.Types.ObjectId, ref: 'User' },
    triage_started_at: { type: Date },
    triage_completed_at: { type: Date },

    chief_complaint: { type: String, trim: true },
    onset_time: { type: Date },
    mechanism_of_injury: { type: String, trim: true },
    symptoms: { type: String, trim: true },

    airway_status: { type: String, trim: true },
    breathing_status: { type: String, trim: true },
    circulation_status: { type: String, trim: true },
    disability_status: { type: String, trim: true },
    exposure_status: { type: String, trim: true },

    temperature: { type: Number, min: 25, max: 45 },
    heart_rate: { type: Number, min: 20, max: 250 },
    respiratory_rate: { type: Number, min: 5, max: 80 },
    systolic_bp: { type: Number, min: 40, max: 260 },
    diastolic_bp: { type: Number, min: 20, max: 160 },
    spo2: { type: Number, min: 50, max: 100 },
    pain_score: { type: Number, min: 0, max: 10 },
    gcs_eye: { type: Number, min: 1, max: 4 },
    gcs_verbal: { type: Number, min: 1, max: 5 },
    gcs_motor: { type: Number, min: 1, max: 6 },
    gcs_total: { type: Number, min: 3, max: 15 },
    avpu: { type: String, enum: AVPU_LEVELS },
    blood_glucose: { type: Number, min: 10, max: 1000 },
    oxygen_support: { type: String, trim: true },
    oxygen_flow_rate: { type: Number, min: 0, max: 80 },
    shock_index: { type: Number, min: 0, max: 5 },
    news2: { type: Number, min: 0, max: 30 },
    mews: { type: Number, min: 0, max: 30 },

    esi_level: { type: Number, enum: ESI_LEVELS },
    triage_color: { type: String, enum: TRIAGE_COLOR },
    final_priority: { type: String, enum: EMERGENCY_PRIORITIES },

    risk_flags: [{ type: String, trim: true }],
    recommended_actions: [{ type: String, trim: true }],
    disposition: { type: String, trim: true },

    doctor_required: { type: Boolean, default: false },
    dispatch_required: { type: Boolean, default: false },
    stat_lab_required: { type: Boolean, default: false },
    stat_imaging_required: { type: Boolean, default: false },
    admission_required: { type: Boolean, default: false },

    note: { type: String, trim: true },
    status: { type: String, enum: TRIAGE_STATUS, default: 'draft', required: true },

    signed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    signed_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'emergency_triages' },
);

emergencyTriageSchema.pre('save', function calculateEmergencyTriage(next) {
  if (this.gcs_eye && this.gcs_verbal && this.gcs_motor) {
    this.gcs_total = Number(this.gcs_eye) + Number(this.gcs_verbal) + Number(this.gcs_motor);
  }

  if (this.heart_rate && this.systolic_bp) {
    this.shock_index = Number((Number(this.heart_rate) / Number(this.systolic_bp)).toFixed(2));
  }

  next();
});

emergencyTriageSchema.index({ emergency_case_id: 1, created_at: -1 });
emergencyTriageSchema.index({ patient_id: 1, created_at: -1 });
emergencyTriageSchema.index({ encounter_id: 1, created_at: -1 });
emergencyTriageSchema.index({ status: 1, triage_started_at: -1 });
emergencyTriageSchema.index({ final_priority: 1, status: 1 });
emergencyTriageSchema.index({ triage_color: 1, status: 1 });

module.exports = model('EmergencyTriage', emergencyTriageSchema);
