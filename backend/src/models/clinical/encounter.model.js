const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const {
  ENCOUNTER_STATUS,
  ENCOUNTER_STATUSES,
  ENCOUNTER_TYPES,
  NURSING_WORKFLOW_STATUS,
  NURSING_WORKFLOW_STATUSES,
} = require('../../constants/statuses');

// Bảng encounters: Lưu một lần khám hoặc lần điều trị của bệnh nhân.

const encounterSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    attending_doctor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    encounter_code: { type: String, required: true, unique: true, trim: true },
    encounter_type: { type: String, enum: ENCOUNTER_TYPES, required: true },
    start_time: { type: Date, required: true },
    end_time: { type: Date },
    chief_reason: { type: String },
    started_at: { type: Date },
    started_by: { type: Schema.Types.ObjectId, ref: 'User' },
    held_at: { type: Date },
    held_by: { type: Schema.Types.ObjectId, ref: 'User' },
    hold_reason: { type: String },
    resumed_at: { type: Date },
    resumed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancel_reason: { type: String },
    reopened_at: { type: Date },
    reopened_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reopen_reason: { type: String },
    nursing_status: {
      type: String,
      enum: NURSING_WORKFLOW_STATUSES,
      default: NURSING_WORKFLOW_STATUS.NOT_STARTED,
      required: true,
    },
    assigned_nurse_id: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_nurse_at: { type: Date },
    nursing_status_updated_at: { type: Date },
    nursing_status_updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    waiting_nurse_at: { type: Date },
    triage_started_at: { type: Date },
    triage_completed_at: { type: Date },
    vital_recorded_at: { type: Date },
    preparation_completed_at: { type: Date },
    ready_for_doctor_at: { type: Date },
    status: { type: String, enum: ENCOUNTER_STATUSES, default: ENCOUNTER_STATUS.PLANNED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'encounters' },
);

encounterSchema.index({ patient_id: 1 });
encounterSchema.index({ department_id: 1 });
encounterSchema.index({ attending_doctor_id: 1 });
encounterSchema.index({ start_time: 1 });
encounterSchema.index({ status: 1 });
encounterSchema.index({ nursing_status: 1 });
encounterSchema.index({ assigned_nurse_id: 1 });
encounterSchema.index({ encounter_type: 1 });
encounterSchema.index({ patient_id: 1, start_time: 1 });
encounterSchema.index({ appointment_id: 1, status: 1 });
encounterSchema.index(
  { appointment_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      appointment_id: { $exists: true },
      status: {
        $in: [
          ENCOUNTER_STATUS.PLANNED,
          ENCOUNTER_STATUS.ARRIVED,
          ENCOUNTER_STATUS.IN_PROGRESS,
          ENCOUNTER_STATUS.ON_HOLD,
          ENCOUNTER_STATUS.COMPLETED,
        ],
      },
    },
  },
);
encounterSchema.index({ attending_doctor_id: 1, status: 1, start_time: 1 });
encounterSchema.index({ department_id: 1, status: 1, start_time: 1 });
encounterSchema.index({ department_id: 1, nursing_status: 1, start_time: 1 });
encounterSchema.index({ department_id: 1, assigned_nurse_id: 1, start_time: 1 });
encounterSchema.index({ department_id: 1, start_time: 1 });
encounterSchema.index({ attending_doctor_id: 1, start_time: 1 });

module.exports = model('Encounter', encounterSchema);
