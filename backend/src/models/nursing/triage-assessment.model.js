const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const TRIAGE_LEVEL = {
  EMERGENCY: 'emergency',
  URGENT: 'urgent',
  SEMI_URGENT: 'semi_urgent',
  NON_URGENT: 'non_urgent',
};

const TRIAGE_LEVELS = Object.values(TRIAGE_LEVEL);

const TRIAGE_PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

const TRIAGE_PRIORITIES = Object.values(TRIAGE_PRIORITY);

const TRIAGE_DESTINATION = {
  DOCTOR: 'doctor',
  EMERGENCY: 'emergency',
  OBSERVATION: 'observation',
  PROCEDURE: 'procedure',
};

const TRIAGE_DESTINATIONS = Object.values(TRIAGE_DESTINATION);

const TRIAGE_ACUITY = {
  RED: 'red',
  ORANGE: 'orange',
  YELLOW: 'yellow',
  GREEN: 'green',
  BLUE: 'blue',
};

const TRIAGE_ACUITIES = Object.values(TRIAGE_ACUITY);

const TRIAGE_RECOMMENDED_ACTION = {
  NORMAL_QUEUE: 'normal_queue',
  PRIORITY_QUEUE: 'priority_queue',
  TRANSFER_DEPARTMENT: 'transfer_department',
  SEND_EMERGENCY: 'send_emergency',
  DIRECT_DOCTOR: 'direct_doctor',
  OBSERVE: 'observe',
};

const TRIAGE_RECOMMENDED_ACTIONS = Object.values(TRIAGE_RECOMMENDED_ACTION);

const TRIAGE_STATUS = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ENTERED_IN_ERROR: 'entered_in_error',
};

const TRIAGE_STATUSES = Object.values(TRIAGE_STATUS);

const triageAssessmentSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    queue_ticket_id: { type: Schema.Types.ObjectId, ref: 'QueueTicket' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    nurse_id: { type: Schema.Types.ObjectId, ref: 'User' },
    triage_by: { type: Schema.Types.ObjectId, ref: 'User' },
    triage_at: { type: Date },
    chief_complaint: { type: String, trim: true },
    symptom_onset_at: { type: Date },
    symptoms: { type: Schema.Types.Mixed },
    pain_score: { type: Number, min: 0, max: 10 },
    consciousness: { type: String, enum: ['alert', 'voice', 'pain', 'unresponsive'] },
    consciousness_level: { type: String, trim: true },
    breathing_status: { type: String, enum: ['normal', 'distress', 'severe_distress'] },
    circulation_status: { type: String, enum: ['stable', 'unstable'] },
    mobility_status: { type: String, enum: ['walked', 'wheelchair', 'stretcher'] },
    acuity_level: { type: String, enum: TRIAGE_ACUITIES, default: TRIAGE_ACUITY.GREEN, required: true },
    priority_score: { type: Number, min: 0 },
    red_flags: [{ type: String, trim: true }],
    triage_level: { type: String, enum: TRIAGE_LEVELS, default: TRIAGE_LEVEL.NON_URGENT, required: true },
    priority: { type: String, enum: TRIAGE_PRIORITIES, default: TRIAGE_PRIORITY.MEDIUM, required: true },
    recommended_destination: { type: String, enum: TRIAGE_DESTINATIONS, default: TRIAGE_DESTINATION.DOCTOR },
    recommended_action: {
      type: String,
      enum: TRIAGE_RECOMMENDED_ACTIONS,
      default: TRIAGE_RECOMMENDED_ACTION.NORMAL_QUEUE,
    },
    recommended_department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    recommended_doctor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    infectious_screening: {
      fever: { type: Boolean, default: false },
      cough: { type: Boolean, default: false },
      rash: { type: Boolean, default: false },
      travel_history: { type: Boolean, default: false },
      isolation_required: { type: Boolean, default: false },
    },
    fall_risk_score: { type: Number, min: 0 },
    pregnancy_status: { type: String, enum: ['unknown', 'not_pregnant', 'pregnant', 'postpartum'], default: 'unknown' },
    allergy_reviewed: { type: Boolean, default: false },
    medication_reviewed: { type: Boolean, default: false },
    problem_reviewed: { type: Boolean, default: false },
    vital_sign_id: { type: Schema.Types.ObjectId, ref: 'VitalSign' },
    vital_snapshot: { type: Schema.Types.Mixed },
    status: { type: String, enum: TRIAGE_STATUSES, default: TRIAGE_STATUS.DRAFT, required: true },
    note: { type: String, trim: true },
    started_at: { type: Date },
    completed_at: { type: Date },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancel_reason: { type: String, trim: true },
    entered_in_error_by: { type: Schema.Types.ObjectId, ref: 'User' },
    entered_in_error_at: { type: Date },
    entered_in_error_reason: { type: String, trim: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'triage_assessments' },
);

triageAssessmentSchema.index({ patient_id: 1, created_at: -1 });
triageAssessmentSchema.index({ encounter_id: 1, status: 1 });
triageAssessmentSchema.index({ queue_ticket_id: 1, status: 1 });
triageAssessmentSchema.index({ appointment_id: 1, status: 1 });
triageAssessmentSchema.index({ department_id: 1, triage_at: -1 });
triageAssessmentSchema.index({ department_id: 1, status: 1, created_at: -1 });
triageAssessmentSchema.index({ priority: 1, status: 1 });
triageAssessmentSchema.index({ acuity_level: 1, status: 1 });
triageAssessmentSchema.index({ vital_sign_id: 1 });

module.exports = model('TriageAssessment', triageAssessmentSchema);
