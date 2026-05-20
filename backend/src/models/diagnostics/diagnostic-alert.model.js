const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ORDER_PRIORITY, ORDER_PRIORITIES } = require('../../constants/statuses');

const DIAGNOSTIC_ALERT_SOURCE_TYPE = {
  LAB_RESULT: 'lab_result',
  LAB_RESULT_ITEM: 'lab_result_item',
  IMAGING_REPORT: 'imaging_report',
  SPECIMEN: 'specimen',
  ORDER: 'order',
  LAB_ORDER: 'lab_order',
  IMAGING_ORDER: 'imaging_order',
  PROCEDURE_ORDER: 'procedure_order',
  ATTACHMENT: 'attachment',
  MISSING_DOCUMENT_TASK: 'missing_document_task',
  LAB_CORRECTION_REQUEST: 'lab_correction_request',
  IMAGING_CORRECTION_REQUEST: 'imaging_correction_request',
};

const DIAGNOSTIC_ALERT_SOURCE_TYPES = Object.values(DIAGNOSTIC_ALERT_SOURCE_TYPE);

const DIAGNOSTIC_ALERT_CATEGORY = {
  CRITICAL_RESULT_OPEN: 'critical_result_open',
  CRITICAL_ACK_OVERDUE: 'critical_ack_overdue',
  SPECIMEN_REJECTED: 'specimen_rejected',
  ORDER_OVERDUE: 'order_overdue',
  MISSING_RESULT_FILE: 'missing_result_file',
  RESULT_NEEDS_CORRECTION: 'result_needs_correction',
  NO_SHOW_OR_ABNORMAL_CANCEL: 'no_show_or_abnormal_cancel',
};

const DIAGNOSTIC_ALERT_CATEGORIES = Object.values(DIAGNOSTIC_ALERT_CATEGORY);

const DIAGNOSTIC_ALERT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const DIAGNOSTIC_ALERT_SEVERITIES = Object.values(DIAGNOSTIC_ALERT_SEVERITY);

const DIAGNOSTIC_ALERT_STATUS = {
  OPEN: 'open',
  ACKNOWLEDGED: 'acknowledged',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
};

const DIAGNOSTIC_ALERT_STATUSES = Object.values(DIAGNOSTIC_ALERT_STATUS);

const diagnosticAlertSchema = new Schema(
  {
    alert_no: { type: String, required: true, unique: true, trim: true, index: true },
    source_type: { type: String, enum: DIAGNOSTIC_ALERT_SOURCE_TYPES, required: true, trim: true },
    source_id: { type: Schema.Types.ObjectId, required: true },

    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', index: true },
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', index: true },

    category: { type: String, enum: DIAGNOSTIC_ALERT_CATEGORIES, required: true, trim: true, index: true },
    module: { type: String, enum: ['lab', 'imaging', 'procedure', 'records', 'orders'], trim: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String },
    severity: { type: String, enum: DIAGNOSTIC_ALERT_SEVERITIES, default: DIAGNOSTIC_ALERT_SEVERITY.WARNING, required: true, index: true },
    priority: { type: String, enum: ORDER_PRIORITIES, default: ORDER_PRIORITY.ROUTINE, required: true, index: true },
    status: { type: String, enum: DIAGNOSTIC_ALERT_STATUSES, default: DIAGNOSTIC_ALERT_STATUS.OPEN, required: true, index: true },

    assigned_to_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_to_role: { type: String, trim: true },

    first_detected_at: { type: Date, default: Date.now, required: true },
    last_seen_at: { type: Date },
    notified_at: { type: Date },
    acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledged_at: { type: Date },

    sla_due_at: { type: Date, index: true },
    breached_at: { type: Date },
    escalation_level: { type: Number, default: 0, min: 0 },
    last_escalated_at: { type: Date },

    resolution_note: { type: String },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    dismiss_reason: { type: String },
    dismissed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    dismissed_at: { type: Date },

    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'diagnostic_alerts' },
);

diagnosticAlertSchema.index({ category: 1, status: 1, severity: 1 });
diagnosticAlertSchema.index({ module: 1, status: 1, priority: 1 });
diagnosticAlertSchema.index({ patient_id: 1, created_at: -1 });
diagnosticAlertSchema.index({ encounter_id: 1, created_at: -1 });
diagnosticAlertSchema.index({ department_id: 1, status: 1 });
diagnosticAlertSchema.index({ source_type: 1, source_id: 1, category: 1 }, { unique: true });
diagnosticAlertSchema.index({ sla_due_at: 1, status: 1 });
diagnosticAlertSchema.index({ assigned_to_user_id: 1, status: 1 });

diagnosticAlertSchema.statics.CATEGORY = DIAGNOSTIC_ALERT_CATEGORY;
diagnosticAlertSchema.statics.STATUS = DIAGNOSTIC_ALERT_STATUS;
diagnosticAlertSchema.statics.SEVERITY = DIAGNOSTIC_ALERT_SEVERITY;
diagnosticAlertSchema.statics.SOURCE_TYPE = DIAGNOSTIC_ALERT_SOURCE_TYPE;

module.exports = model('DiagnosticAlert', diagnosticAlertSchema);
module.exports.DIAGNOSTIC_ALERT_CATEGORY = DIAGNOSTIC_ALERT_CATEGORY;
module.exports.DIAGNOSTIC_ALERT_CATEGORIES = DIAGNOSTIC_ALERT_CATEGORIES;
module.exports.DIAGNOSTIC_ALERT_SEVERITY = DIAGNOSTIC_ALERT_SEVERITY;
module.exports.DIAGNOSTIC_ALERT_SEVERITIES = DIAGNOSTIC_ALERT_SEVERITIES;
module.exports.DIAGNOSTIC_ALERT_STATUS = DIAGNOSTIC_ALERT_STATUS;
module.exports.DIAGNOSTIC_ALERT_STATUSES = DIAGNOSTIC_ALERT_STATUSES;
module.exports.DIAGNOSTIC_ALERT_SOURCE_TYPE = DIAGNOSTIC_ALERT_SOURCE_TYPE;
module.exports.DIAGNOSTIC_ALERT_SOURCE_TYPES = DIAGNOSTIC_ALERT_SOURCE_TYPES;
