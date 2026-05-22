const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const integrationLogSchema = new Schema(
  {
    source: { type: String, required: true, trim: true },
    provider: { type: String, trim: true },
    action: { type: String, required: true, trim: true },
    status: { type: String, enum: ['success', 'failed', 'skipped', 'warning', 'pending'], default: 'success' },
    severity: { type: String, enum: ['info', 'low', 'medium', 'high', 'critical'], default: 'info' },
    message: { type: String, trim: true },
    request_id: { type: String, trim: true },
    correlation_id: { type: String, trim: true },
    actor_type: { type: String, trim: true },
    actor_id: { type: Schema.Types.Mixed },
    target_type: { type: String, trim: true },
    target_id: { type: Schema.Types.Mixed },
    payload_masked: { type: Schema.Types.Mixed },
    error_code: { type: String, trim: true },
    error_message: { type: String },
    latency_ms: { type: Number, min: 0 },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'integration_logs' },
);

integrationLogSchema.index({ provider: 1, created_at: -1 });
integrationLogSchema.index({ source: 1, created_at: -1 });
integrationLogSchema.index({ status: 1, severity: 1, created_at: -1 });
integrationLogSchema.index({ action: 1, created_at: -1 });
integrationLogSchema.index({ request_id: 1 });
integrationLogSchema.index({ correlation_id: 1 });
integrationLogSchema.index({ target_type: 1, target_id: 1, created_at: -1 });

module.exports = model('IntegrationLog', integrationLogSchema);
