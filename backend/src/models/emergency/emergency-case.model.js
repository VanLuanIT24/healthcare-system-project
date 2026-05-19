const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const {
  ACTOR_TYPES,
  EMERGENCY_CASE_TYPES,
  EMERGENCY_CASE_TYPE,
  EMERGENCY_PRIORITIES,
  EMERGENCY_PRIORITY,
  EMERGENCY_STATUSES,
  EMERGENCY_STATUS,
} = require('../../constants/statuses');

// Bảng emergency_cases: Lưu ca SOS/emergency và trạng thái xử lý khẩn.

const emergencyCaseSchema = new Schema(
  {
    case_code: { type: String, required: true, unique: true, trim: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    triggered_by_actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    triggered_by_actor_id: { type: Schema.Types.Mixed, required: true },
    type: { type: String, enum: EMERGENCY_CASE_TYPES, default: EMERGENCY_CASE_TYPE.SOS, required: true },
    status: { type: String, enum: EMERGENCY_STATUSES, default: EMERGENCY_STATUS.CREATED, required: true },
    priority: { type: String, enum: EMERGENCY_PRIORITIES, default: EMERGENCY_PRIORITY.URGENT, required: true },
    location_lat: { type: Number, min: -90, max: 90 },
    location_lng: { type: Number, min: -180, max: 180 },
    location_text: { type: String },
    symptoms: { type: String },
    note: { type: String },
    assigned_to_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    primary_nurse_id: { type: Schema.Types.ObjectId, ref: 'User' },
    primary_doctor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    related_appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    related_encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    source: {
      type: String,
      enum: ['patient_app', 'relative_app', 'staff_created', 'inpatient', 'queue', 'procedure', 'medication', 'system'],
      default: 'patient_app',
    },
    triage_level: { type: String },
    triage_color: { type: String, enum: ['red', 'orange', 'yellow', 'green', 'white'] },
    esi_level: { type: Number, min: 1, max: 5 },
    doctor_notified_at: { type: Date },
    doctor_acknowledged_at: { type: Date },
    doctor_seen_at: { type: Date },
    first_response_due_at: { type: Date },
    triage_due_at: { type: Date },
    dispatch_due_at: { type: Date },
    resolved_due_at: { type: Date },
    acknowledged_at: { type: Date },
    triaged_at: { type: Date },
    dispatched_at: { type: Date },
    escalated_at: { type: Date },
    sla_status: { type: String, enum: ['on_time', 'at_risk', 'breached', 'escalated', 'recovered', 'closed'], default: 'on_time' },
    sla_next_due_at: { type: Date },
    sla_breached_at: { type: Date },
    escalation_level: { type: Number, min: 0, default: 0 },
    outcome: { type: String },
    disposition: { type: String },
    closed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    closed_at: { type: Date },
    close_reason: { type: String },
    resolved_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'emergency_cases' },
);

emergencyCaseSchema.index({ patient_id: 1, created_at: -1 });
emergencyCaseSchema.index({ status: 1, priority: 1, created_at: -1 });
emergencyCaseSchema.index({ assigned_department_id: 1, status: 1 });
emergencyCaseSchema.index({ assigned_to_user_id: 1, status: 1 });
emergencyCaseSchema.index({ primary_doctor_id: 1, status: 1 });
emergencyCaseSchema.index({ related_appointment_id: 1 });
emergencyCaseSchema.index({ related_encounter_id: 1 });
emergencyCaseSchema.index({ source: 1, created_at: -1 });
emergencyCaseSchema.index({ sla_status: 1, sla_next_due_at: 1 });
emergencyCaseSchema.index({ first_response_due_at: 1, status: 1 });
emergencyCaseSchema.index({ triage_due_at: 1, status: 1 });
emergencyCaseSchema.index({ dispatch_due_at: 1, status: 1 });
emergencyCaseSchema.index({ sla_breached_at: 1, status: 1 });

module.exports = model('EmergencyCase', emergencyCaseSchema);
