const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const auditExportRequestSchema = new Schema(
  {
    requested_by: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    export_type: {
      type: String,
      enum: ['general', 'actor', 'patient_access', 'payment', 'iam', 'system_config', 'break_glass', 'sensitive_access'],
      default: 'general',
      index: true,
    },
    filters: { type: Schema.Types.Mixed },
    format: { type: String, enum: ['csv', 'json', 'pdf', 'zip'], default: 'json' },
    include_options: { type: Schema.Types.Mixed },
    reason: { type: String, trim: true },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled', 'expired'],
      default: 'queued',
      index: true,
    },
    total_records: { type: Number, default: 0 },
    file_attachment_id: { type: Schema.Types.ObjectId },
    checksum: { type: String, trim: true },
    error_message: { type: String, trim: true },
    expires_at: { type: Date, index: true },
    completed_at: { type: Date },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'audit_export_requests' },
);

auditExportRequestSchema.index({ requested_by: 1, created_at: -1 });
auditExportRequestSchema.index({ export_type: 1, created_at: -1 });

module.exports = model('AuditExportRequest', auditExportRequestSchema);
