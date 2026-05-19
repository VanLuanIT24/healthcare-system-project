const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const DOCTOR_NOTIFICATION_PRIORITY = {
  ROUTINE: 'routine',
  URGENT: 'urgent',
  STAT: 'stat',
  CRITICAL: 'critical',
};

const DOCTOR_NOTIFICATION_PRIORITIES = Object.values(DOCTOR_NOTIFICATION_PRIORITY);

const DOCTOR_NOTIFICATION_CATEGORY = {
  ABNORMAL_VITAL: 'abnormal_vital',
  POST_PROCEDURE: 'post_procedure',
  POST_MEDICATION: 'post_medication',
  LAB_CRITICAL: 'lab_critical',
  IMAGING_CRITICAL: 'imaging_critical',
  PATIENT_COMPLAINT: 'patient_complaint',
  MANUAL: 'manual',
  EMERGENCY: 'emergency',
};

const DOCTOR_NOTIFICATION_CATEGORIES = Object.values(DOCTOR_NOTIFICATION_CATEGORY);

const DOCTOR_NOTIFICATION_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  DELIVERED: 'delivered',
  SEEN: 'seen',
  ACKNOWLEDGED: 'acknowledged',
  RESPONDED: 'responded',
  ESCALATED: 'escalated',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

const DOCTOR_NOTIFICATION_STATUSES = Object.values(DOCTOR_NOTIFICATION_STATUS);

const doctorNotificationRequestSchema = new Schema(
  {
    request_no: { type: String, required: true, unique: true, trim: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    from_nurse_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    to_doctor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    priority: { type: String, enum: DOCTOR_NOTIFICATION_PRIORITIES, default: DOCTOR_NOTIFICATION_PRIORITY.ROUTINE, required: true },
    category: { type: String, enum: DOCTOR_NOTIFICATION_CATEGORIES, default: DOCTOR_NOTIFICATION_CATEGORY.MANUAL, required: true },
    sbar: {
      situation: { type: String, trim: true },
      background: { type: String, trim: true },
      assessment: { type: String, trim: true },
      recommendation: { type: String, trim: true },
    },
    latest_vital_sign_id: { type: Schema.Types.ObjectId, ref: 'VitalSign' },
    related_note_id: { type: Schema.Types.ObjectId, ref: 'ClinicalNote' },
    response_note_id: { type: Schema.Types.ObjectId, ref: 'ClinicalNote' },
    related_order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
    related_procedure_order_id: { type: Schema.Types.ObjectId, ref: 'ProcedureOrder' },
    related_medication_administration_id: { type: Schema.Types.ObjectId, ref: 'MedicationAdministration' },
    related_lab_result_id: { type: Schema.Types.ObjectId, ref: 'LabResult' },
    related_imaging_report_id: { type: Schema.Types.ObjectId, ref: 'ImagingReport' },
    related_alert_id: { type: Schema.Types.ObjectId, ref: 'ClinicalAlert' },
    related_emergency_case_id: { type: Schema.Types.ObjectId, ref: 'EmergencyCase' },
    notification_id: { type: Schema.Types.ObjectId, ref: 'Notification' },
    status: { type: String, enum: DOCTOR_NOTIFICATION_STATUSES, default: DOCTOR_NOTIFICATION_STATUS.DRAFT, required: true },
    sent_at: { type: Date },
    delivered_at: { type: Date },
    seen_at: { type: Date },
    acknowledged_at: { type: Date },
    responded_at: { type: Date },
    closed_at: { type: Date },
    cancelled_at: { type: Date },
    cancel_reason: { type: String, trim: true },
    doctor_response: { type: String, trim: true },
    sla_due_at: { type: Date },
    breached_at: { type: Date },
    escalation_level: { type: Number, default: 0, min: 0 },
    escalated_to_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    escalated_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'doctor_notification_requests' },
);

doctorNotificationRequestSchema.index({ patient_id: 1, created_at: -1 });
doctorNotificationRequestSchema.index({ encounter_id: 1, status: 1, created_at: -1 });
doctorNotificationRequestSchema.index({ from_nurse_id: 1, status: 1, created_at: -1 });
doctorNotificationRequestSchema.index({ to_doctor_id: 1, status: 1, created_at: -1 });
doctorNotificationRequestSchema.index({ department_id: 1, status: 1, priority: 1 });
doctorNotificationRequestSchema.index({ sla_due_at: 1, status: 1 });
doctorNotificationRequestSchema.index({ notification_id: 1 });
doctorNotificationRequestSchema.index({ related_alert_id: 1 });

doctorNotificationRequestSchema.statics.STATUS = DOCTOR_NOTIFICATION_STATUS;
doctorNotificationRequestSchema.statics.PRIORITY = DOCTOR_NOTIFICATION_PRIORITY;
doctorNotificationRequestSchema.statics.CATEGORY = DOCTOR_NOTIFICATION_CATEGORY;

module.exports = model('DoctorNotificationRequest', doctorNotificationRequestSchema);
