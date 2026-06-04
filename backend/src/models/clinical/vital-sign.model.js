const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { VITAL_SIGN_STATUS, VITAL_SIGN_STATUSES } = require('../../constants/statuses');
const { assessVitalSign } = require('../../services/vital-sign-assessment.service');

// Bảng vital_signs: Lưu sinh hiệu như mạch, nhiệt độ, huyết áp, SpO2, chiều cao/cân nặng.

const VITAL_SEVERITIES = ['normal', 'mild', 'warning', 'high', 'critical'];
const VITAL_CONTEXTS = ['pre_triage', 'encounter', 'inpatient', 'emergency'];

const vitalSignSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    queue_ticket_id: { type: Schema.Types.ObjectId, ref: 'QueueTicket' },
    appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    context: { type: String, enum: VITAL_CONTEXTS, default: 'encounter', required: true },
    recorded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    temperature: { type: Number, min: 25, max: 45 },
    heart_rate: { type: Number, min: 20, max: 250 },
    respiratory_rate: { type: Number, min: 5, max: 80 },
    systolic_bp: { type: Number, min: 40, max: 260 },
    diastolic_bp: { type: Number, min: 20, max: 160 },
    spo2: { type: Number, min: 50, max: 100 },
    weight: { type: Number, min: 0.5, max: 500 },
    height: { type: Number, min: 20, max: 250 },
    bmi: { type: Number, min: 0, max: 100 },
    pain_score: { type: Number, min: 0, max: 10 },
    blood_glucose: { type: Number, min: 10, max: 1000 },
    oxygen_device: {
      type: String,
      enum: [
        'room_air',
        'nasal_cannula',
        'simple_mask',
        'non_rebreather_mask',
        'venturi_mask',
        'high_flow',
        'ventilator',
      ],
    },
    oxygen_flow_rate: { type: Number, min: 0, max: 80 },
    consciousness_level: {
      type: String,
      enum: ['alert', 'voice', 'pain', 'unresponsive'],
    },
    gcs_eye: { type: Number, min: 1, max: 4 },
    gcs_verbal: { type: Number, min: 1, max: 5 },
    gcs_motor: { type: Number, min: 1, max: 6 },
    gcs_total: { type: Number, min: 3, max: 15 },
    measurement_position: {
      type: String,
      enum: ['sitting', 'lying', 'standing'],
    },
    temperature_site: {
      type: String,
      enum: ['oral', 'axillary', 'tympanic', 'rectal', 'forehead'],
    },
    bp_site: {
      type: String,
      enum: ['left_arm', 'right_arm', 'left_leg', 'right_leg'],
    },
    source: {
      type: String,
      enum: ['manual', 'device', 'imported'],
      default: 'manual',
    },
    device_id: { type: String, trim: true },
    note: { type: String, trim: true },
    map: { type: Number, min: 0, max: 250 },
    recorded_at: { type: Date, required: true },
    abnormal_flags: [{
      field: { type: String, trim: true },
      value: { type: Schema.Types.Mixed },
      threshold: { type: Schema.Types.Mixed },
      level: { type: String, enum: VITAL_SEVERITIES, default: 'warning' },
      severity: { type: String, enum: VITAL_SEVERITIES, default: 'warning' },
      message: { type: String, trim: true },
      recommendation: { type: String, trim: true },
    }],
    severity: { type: String, enum: VITAL_SEVERITIES, default: 'normal', required: true },
    overall_severity: { type: String, enum: VITAL_SEVERITIES, default: 'normal', required: true },
    requires_recheck: { type: Boolean, default: false },
    suggested_recheck_minutes: { type: Number, min: 1, max: 1440 },
    doctor_notification_required: { type: Boolean, default: false },
    requires_doctor_notification: { type: Boolean, default: false },
    acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledged_at: { type: Date },
    doctor_notified_by: { type: Schema.Types.ObjectId, ref: 'User' },
    doctor_notified_at: { type: Date },
    escalated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    escalated_at: { type: Date },
    escalation_reason: { type: String, trim: true },
    entered_in_error_by: { type: Schema.Types.ObjectId, ref: 'User' },
    entered_in_error_at: { type: Date },
    entered_in_error_reason: { type: String },
    related_task_id: { type: Schema.Types.ObjectId, ref: 'NursingTask' },
    related_alert_id: { type: Schema.Types.ObjectId, ref: 'VitalSignAlert' },
    status: { type: String, enum: VITAL_SIGN_STATUSES, default: VITAL_SIGN_STATUS.RECORDED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'vital_signs' },
);

vitalSignSchema.pre('save', function calculateBmi(next) {
  if (!this.encounter_id && !this.queue_ticket_id && !this.appointment_id) {
    next(new Error('VitalSign phải gắn với encounter_id, queue_ticket_id hoặc appointment_id.'));
    return;
  }

  if (!this.context) {
    this.context = this.encounter_id ? 'encounter' : 'pre_triage';
  }

  const assessment = assessVitalSign(this.toObject());
  if (assessment.calculated.bmi !== null) this.bmi = assessment.calculated.bmi;
  if (assessment.calculated.map !== null) this.map = assessment.calculated.map;
  if (assessment.calculated.gcs_total !== null) this.gcs_total = assessment.calculated.gcs_total;
  this.abnormal_flags = assessment.abnormal_flags;
  this.severity = assessment.severity;
  this.overall_severity = assessment.overall_severity;
  this.requires_recheck = assessment.requires_recheck;
  this.suggested_recheck_minutes = assessment.suggested_recheck_minutes;
  this.doctor_notification_required = assessment.doctor_notification_required;
  this.requires_doctor_notification = assessment.requires_doctor_notification;

  next();
});

vitalSignSchema.index({ patient_id: 1 });
vitalSignSchema.index({ encounter_id: 1 });
vitalSignSchema.index({ queue_ticket_id: 1 });
vitalSignSchema.index({ appointment_id: 1 });
vitalSignSchema.index({ context: 1 });
vitalSignSchema.index({ recorded_by: 1 });
vitalSignSchema.index({ recorded_at: 1 });
vitalSignSchema.index({ severity: 1 });
vitalSignSchema.index({ overall_severity: 1 });
vitalSignSchema.index({ requires_recheck: 1 });
vitalSignSchema.index({ requires_doctor_notification: 1, acknowledged_at: 1 });
vitalSignSchema.index({ doctor_notification_required: 1, doctor_notified_at: 1 });
vitalSignSchema.index({ encounter_id: 1, recorded_at: 1 });
vitalSignSchema.index({ patient_id: 1, recorded_at: 1 });
vitalSignSchema.index({ encounter_id: 1, status: 1, recorded_at: 1 });
vitalSignSchema.index({ queue_ticket_id: 1, status: 1, recorded_at: 1 });
vitalSignSchema.index({ appointment_id: 1, status: 1, recorded_at: 1 });

module.exports = model('VitalSign', vitalSignSchema);
