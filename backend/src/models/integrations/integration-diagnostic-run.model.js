const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const integrationDiagnosticRunSchema = new Schema(
  {
    run_id: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ['running', 'success', 'failed'], default: 'running' },
    provider: { type: String, trim: true },
    check_name: { type: String, trim: true },
    started_at: { type: Date, default: Date.now },
    finished_at: { type: Date },
    duration_ms: { type: Number, min: 0 },
    findings_count: { type: Number, default: 0, min: 0 },
    critical_count: { type: Number, default: 0, min: 0 },
    warning_count: { type: Number, default: 0, min: 0 },
    result: { type: Schema.Types.Mixed },
    error: { type: Schema.Types.Mixed },
    actor: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'integration_diagnostic_runs' },
);

integrationDiagnosticRunSchema.index({ status: 1, started_at: -1 });
integrationDiagnosticRunSchema.index({ provider: 1, started_at: -1 });
integrationDiagnosticRunSchema.index({ check_name: 1, started_at: -1 });

module.exports = model('IntegrationDiagnosticRun', integrationDiagnosticRunSchema);
