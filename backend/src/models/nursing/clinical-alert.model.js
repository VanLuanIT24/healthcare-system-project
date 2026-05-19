const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const CLINICAL_ALERT_SOURCE_TYPE = {
  VITAL_SIGN: 'vital_sign',
  LAB_RESULT: 'lab_result',
  LAB_RESULT_ITEM: 'lab_result_item',
  IMAGING_REPORT: 'imaging_report',
  PROCEDURE_OBSERVATION: 'procedure_observation',
  MEDICATION_REACTION: 'medication_reaction',
  EMERGENCY: 'emergency',
  MANUAL: 'manual',
};

const CLINICAL_ALERT_SOURCE_TYPES = Object.values(CLINICAL_ALERT_SOURCE_TYPE);

const CLINICAL_ALERT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const CLINICAL_ALERT_SEVERITIES = Object.values(CLINICAL_ALERT_SEVERITY);

const CLINICAL_ALERT_STATUS = {
  OPEN: 'open',
  ACKNOWLEDGED: 'acknowledged',
  DOCTOR_NOTIFIED: 'doctor_notified',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
};

const CLINICAL_ALERT_STATUSES = Object.values(CLINICAL_ALERT_STATUS);

const clinicalAlertSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    source_type: { type: String, enum: CLINICAL_ALERT_SOURCE_TYPES, required: true },
    source_id: { type: Schema.Types.ObjectId },
    rule_code: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    severity: { type: String, enum: CLINICAL_ALERT_SEVERITIES, default: CLINICAL_ALERT_SEVERITY.WARNING, required: true },
    status: { type: String, enum: CLINICAL_ALERT_STATUSES, default: CLINICAL_ALERT_STATUS.OPEN, required: true },
    assigned_to_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledged_at: { type: Date },
    doctor_notification_request_id: { type: Schema.Types.ObjectId, ref: 'DoctorNotificationRequest' },
    doctor_notified_at: { type: Date },
    escalated_at: { type: Date },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    dismissed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    dismissed_at: { type: Date },
    dismiss_reason: { type: String, trim: true },
    sla_due_at: { type: Date },
    breached_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'clinical_alerts' },
);

clinicalAlertSchema.index({ patient_id: 1, status: 1, created_at: -1 });
clinicalAlertSchema.index({ encounter_id: 1, status: 1, created_at: -1 });
clinicalAlertSchema.index({ department_id: 1, status: 1, severity: 1 });
clinicalAlertSchema.index({ source_type: 1, source_id: 1 }, { sparse: true });
clinicalAlertSchema.index({ severity: 1, status: 1, created_at: -1 });
clinicalAlertSchema.index({ sla_due_at: 1, status: 1 });
clinicalAlertSchema.index({ doctor_notification_request_id: 1 });

clinicalAlertSchema.statics.STATUS = CLINICAL_ALERT_STATUS;
clinicalAlertSchema.statics.SEVERITY = CLINICAL_ALERT_SEVERITY;
clinicalAlertSchema.statics.SOURCE_TYPE = CLINICAL_ALERT_SOURCE_TYPE;

module.exports = model('ClinicalAlert', clinicalAlertSchema);
