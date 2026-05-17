const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('./base-model');

const JOB_RUN_STATUS = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
};

const jobRunLogSchema = new Schema(
  {
    job_name: { type: String, required: true, trim: true },
    queue_name: { type: String, trim: true },
    job_id: { type: String, trim: true },
    status: { type: String, enum: Object.values(JOB_RUN_STATUS), default: JOB_RUN_STATUS.RUNNING, required: true },
    started_at: { type: Date, default: Date.now, required: true },
    finished_at: { type: Date },
    duration_ms: { type: Number, min: 0 },
    attempt: { type: Number, default: 1, min: 1 },
    records_processed: { type: Number, default: 0, min: 0 },
    result: { type: Schema.Types.Mixed },
    error_message: { type: String },
    error_stack: { type: String },
    worker_id: { type: String, trim: true },
    correlation_id: { type: String, trim: true },
  },
  { ...baseSchemaOptions, collection: 'job_run_logs' },
);

jobRunLogSchema.index({ job_name: 1, started_at: -1 });
jobRunLogSchema.index({ queue_name: 1, started_at: -1 });
jobRunLogSchema.index({ status: 1, started_at: -1 });
jobRunLogSchema.index({ correlation_id: 1 });

module.exports = model('JobRunLog', jobRunLogSchema);
module.exports.JOB_RUN_STATUS = JOB_RUN_STATUS;
