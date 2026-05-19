const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const MONITORING_SOURCE_TYPE = {
  MANUAL: 'manual',
  ABNORMAL_VITAL: 'abnormal_vital',
  POST_PROCEDURE: 'post_procedure',
  POST_MEDICATION: 'post_medication',
  DOCTOR_REQUEST: 'doctor_request',
  LAB_CRITICAL: 'lab_critical',
  IMAGING_CRITICAL: 'imaging_critical',
};

const MONITORING_SOURCE_TYPES = Object.values(MONITORING_SOURCE_TYPE);

const MONITORING_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const MONITORING_PRIORITIES = Object.values(MONITORING_PRIORITY);

const MONITORING_STATUS = {
  ACTIVE: 'active',
  WATCHING: 'watching',
  DOCTOR_NOTIFIED: 'doctor_notified',
  DOCTOR_ACKNOWLEDGED: 'doctor_acknowledged',
  ESCALATED: 'escalated',
  STABLE: 'stable',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
};

const MONITORING_STATUSES = Object.values(MONITORING_STATUS);

const nursingMonitoringSessionSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    source_type: { type: String, enum: MONITORING_SOURCE_TYPES, default: MONITORING_SOURCE_TYPE.MANUAL, required: true },
    source_id: { type: Schema.Types.ObjectId },
    reason: { type: String, required: true, trim: true },
    priority: { type: String, enum: MONITORING_PRIORITIES, default: MONITORING_PRIORITY.MEDIUM, required: true },
    risk_score: { type: Number, min: 0, max: 100, default: 0 },
    status: { type: String, enum: MONITORING_STATUSES, default: MONITORING_STATUS.ACTIVE, required: true },
    assigned_nurse_id: { type: Schema.Types.ObjectId, ref: 'User' },
    attending_doctor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    started_at: { type: Date, default: Date.now },
    last_checked_at: { type: Date },
    next_check_at: { type: Date },
    sla_due_at: { type: Date },
    doctor_notified_at: { type: Date },
    doctor_acknowledged_at: { type: Date },
    escalated_at: { type: Date },
    resolved_at: { type: Date },
    cancelled_at: { type: Date },
    cancel_reason: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'nursing_monitoring_sessions' },
);

nursingMonitoringSessionSchema.index({ patient_id: 1, status: 1, started_at: -1 });
nursingMonitoringSessionSchema.index({ encounter_id: 1, status: 1 });
nursingMonitoringSessionSchema.index({ department_id: 1, status: 1, priority: 1 });
nursingMonitoringSessionSchema.index({ assigned_nurse_id: 1, status: 1, next_check_at: 1 });
nursingMonitoringSessionSchema.index({ attending_doctor_id: 1, status: 1 });
nursingMonitoringSessionSchema.index({ source_type: 1, source_id: 1 }, { sparse: true });
nursingMonitoringSessionSchema.index({ sla_due_at: 1, status: 1 });
nursingMonitoringSessionSchema.index({ next_check_at: 1, status: 1 });

nursingMonitoringSessionSchema.statics.STATUS = MONITORING_STATUS;
nursingMonitoringSessionSchema.statics.PRIORITY = MONITORING_PRIORITY;
nursingMonitoringSessionSchema.statics.SOURCE_TYPE = MONITORING_SOURCE_TYPE;

module.exports = model('NursingMonitoringSession', nursingMonitoringSessionSchema);
