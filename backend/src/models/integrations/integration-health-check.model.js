const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const integrationHealthCheckSchema = new Schema(
  {
    provider: { type: String, required: true, trim: true },
    check_type: { type: String, required: true, trim: true },
    status: { type: String, enum: ['healthy', 'warning', 'critical', 'disabled', 'unknown'], default: 'unknown' },
    configured: { type: Boolean, default: false },
    enabled: { type: Boolean, default: false },
    latency_ms: { type: Number, min: 0 },
    checked_at: { type: Date, default: Date.now },
    error_code: { type: String, trim: true },
    error_message: { type: String },
    recommendation: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'integration_health_checks' },
);

integrationHealthCheckSchema.index({ provider: 1, check_type: 1, checked_at: -1 });
integrationHealthCheckSchema.index({ status: 1, checked_at: -1 });

module.exports = model('IntegrationHealthCheck', integrationHealthCheckSchema);
