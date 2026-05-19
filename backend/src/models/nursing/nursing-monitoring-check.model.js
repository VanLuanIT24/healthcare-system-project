const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const MONITORING_CHECK_STATUS = {
  STABLE: 'stable',
  WATCHING: 'watching',
  WORSE: 'worse',
  CRITICAL: 'critical',
};

const MONITORING_CHECK_STATUSES = Object.values(MONITORING_CHECK_STATUS);

const nursingMonitoringCheckSchema = new Schema(
  {
    monitoring_session_id: { type: Schema.Types.ObjectId, ref: 'NursingMonitoringSession', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    checked_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    checked_at: { type: Date, default: Date.now, required: true },
    subjective_note: { type: String, trim: true },
    objective_note: { type: String, trim: true },
    intervention_note: { type: String, trim: true },
    vital_sign_id: { type: Schema.Types.ObjectId, ref: 'VitalSign' },
    pain_score: { type: Number, min: 0, max: 10 },
    consciousness: { type: String, trim: true },
    warning_flags: [{ type: String, trim: true }],
    next_check_at: { type: Date },
    need_doctor_notification: { type: Boolean, default: false },
    doctor_notification_request_id: { type: Schema.Types.ObjectId, ref: 'DoctorNotificationRequest' },
    status_after_check: { type: String, enum: MONITORING_CHECK_STATUSES, default: MONITORING_CHECK_STATUS.WATCHING, required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'nursing_monitoring_checks' },
);

nursingMonitoringCheckSchema.index({ monitoring_session_id: 1, checked_at: -1 });
nursingMonitoringCheckSchema.index({ patient_id: 1, checked_at: -1 });
nursingMonitoringCheckSchema.index({ encounter_id: 1, checked_at: -1 });
nursingMonitoringCheckSchema.index({ checked_by: 1, checked_at: -1 });
nursingMonitoringCheckSchema.index({ vital_sign_id: 1 });
nursingMonitoringCheckSchema.index({ doctor_notification_request_id: 1 });

nursingMonitoringCheckSchema.statics.STATUS = MONITORING_CHECK_STATUS;

module.exports = model('NursingMonitoringCheck', nursingMonitoringCheckSchema);
