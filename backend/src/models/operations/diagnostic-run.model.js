const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const DIAGNOSTIC_RUN_STATUS = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
};

const diagnosticRunSchema = new Schema(
  {
    run_id: { type: String, required: true, trim: true, unique: true },
    check_name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(DIAGNOSTIC_RUN_STATUS),
      default: DIAGNOSTIC_RUN_STATUS.RUNNING,
      required: true,
    },
    started_at: { type: Date, default: Date.now, required: true },
    finished_at: { type: Date },
    duration_ms: { type: Number, min: 0 },
    findings_count: { type: Number, default: 0, min: 0 },
    critical_count: { type: Number, default: 0, min: 0 },
    warning_count: { type: Number, default: 0, min: 0 },
    result: { type: Schema.Types.Mixed, default: {} },
    error: { type: String },
    actor: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'diagnostic_runs' },
);

diagnosticRunSchema.index({ check_name: 1, started_at: -1 });
diagnosticRunSchema.index({ status: 1, started_at: -1 });

module.exports = model('DiagnosticRun', diagnosticRunSchema);
module.exports.DIAGNOSTIC_RUN_STATUS = DIAGNOSTIC_RUN_STATUS;
