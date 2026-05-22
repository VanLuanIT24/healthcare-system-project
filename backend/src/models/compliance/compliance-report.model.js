const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const complianceReportSchema = new Schema(
  {
    report_type: {
      type: String,
      enum: [
        'daily_audit',
        'medical_record_access',
        'sensitive_access',
        'break_glass_review',
        'consent_coverage',
        'iam_changes',
        'payment_audit',
        'system_config_changes',
        'export_activity',
        'audit_retention',
      ],
      required: true,
      index: true,
    },
    period_from: { type: Date, required: true, index: true },
    period_to: { type: Date, required: true, index: true },
    scope: { type: Schema.Types.Mixed },
    generated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    generated_at: { type: Date, default: Date.now },
    status: { type: String, enum: ['draft', 'generated', 'approved', 'archived', 'failed'], default: 'generated', index: true },
    metrics: { type: Schema.Types.Mixed },
    findings: [{ type: Schema.Types.Mixed }],
    recommendations: [{ type: String, trim: true }],
    evidence_export_id: { type: Schema.Types.ObjectId, ref: 'AuditExportRequest' },
    attachment_id: { type: Schema.Types.ObjectId },
    checksum: { type: String, trim: true },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    archived_at: { type: Date },
  },
  { ...baseSchemaOptions, collection: 'compliance_reports' },
);

complianceReportSchema.index({ report_type: 1, generated_at: -1 });
complianceReportSchema.index({ status: 1, generated_at: -1 });

module.exports = model('ComplianceReport', complianceReportSchema);
