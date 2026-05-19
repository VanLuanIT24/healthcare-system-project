const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const NURSING_INTAKE_STATUS = {
  WAITING: 'waiting',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const NURSING_INTAKE_STATUSES = Object.values(NURSING_INTAKE_STATUS);

const intakeChecklistSchema = new Schema(
  {
    identity_verified: { type: Boolean, default: false },
    appointment_verified: { type: Boolean, default: false },
    allergy_checked: { type: Boolean, default: false },
    reason_confirmed: { type: Boolean, default: false },
    consent_checked: { type: Boolean, default: false },
    vital_required: { type: Boolean, default: true },
    triage_required: { type: Boolean, default: false },
    problem_reviewed: { type: Boolean, default: false },
    medication_reviewed: { type: Boolean, default: false },
  },
  { _id: false },
);

const nursingIntakeSchema = new Schema(
  {
    queue_ticket_id: { type: Schema.Types.ObjectId, ref: 'QueueTicket', required: true },
    appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_nurse_id: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: NURSING_INTAKE_STATUSES, default: NURSING_INTAKE_STATUS.WAITING, required: true },
    started_at: { type: Date },
    completed_at: { type: Date },
    cancelled_at: { type: Date },
    released_at: { type: Date },
    checklist: { type: intakeChecklistSchema, default: () => ({}) },
    note: { type: String, trim: true },
    cancel_reason: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'nursing_intakes' },
);

nursingIntakeSchema.index({ queue_ticket_id: 1 }, { unique: true });
nursingIntakeSchema.index({ patient_id: 1, created_at: -1 });
nursingIntakeSchema.index({ department_id: 1, status: 1, created_at: -1 });
nursingIntakeSchema.index({ assigned_nurse_id: 1, status: 1, created_at: -1 });
nursingIntakeSchema.index({ encounter_id: 1 });
nursingIntakeSchema.index({ appointment_id: 1 });

module.exports = model('NursingIntake', nursingIntakeSchema);
