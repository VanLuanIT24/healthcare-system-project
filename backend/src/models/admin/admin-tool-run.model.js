const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const ADMIN_TOOL_RUN_MODE = {
  SCAN: 'scan',
  DRY_RUN: 'dry_run',
  APPLY: 'apply',
  EXPORT: 'export',
  DIAGNOSTIC: 'diagnostic',
};

const ADMIN_TOOL_RUN_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  SUCCESS_WITH_WARNINGS: 'success_with_warnings',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REQUIRES_APPROVAL: 'requires_approval',
  PARTIALLY_APPLIED: 'partially_applied',
};

const ADMIN_TOOL_RISK_LEVEL = {
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
  DANGER: 'danger',
};

const adminToolRunSchema = new Schema(
  {
    tool_code: { type: String, required: true, trim: true },
    tool_name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    mode: { type: String, enum: Object.values(ADMIN_TOOL_RUN_MODE), default: ADMIN_TOOL_RUN_MODE.SCAN, required: true },
    status: { type: String, enum: Object.values(ADMIN_TOOL_RUN_STATUS), default: ADMIN_TOOL_RUN_STATUS.QUEUED, required: true },
    risk_level: { type: String, enum: Object.values(ADMIN_TOOL_RISK_LEVEL), default: ADMIN_TOOL_RISK_LEVEL.INFO, required: true },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    input: { type: Schema.Types.Mixed },
    summary: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed },
    error_message: { type: String },
    error_stack: { type: String },
    environment: { type: String, trim: true },
    app_version: { type: String, trim: true },
    git_commit: { type: String, trim: true },
    started_at: { type: Date },
    finished_at: { type: Date },
    duration_ms: { type: Number, min: 0 },
    request_id: { type: String, trim: true },
    correlation_id: { type: String, trim: true },
  },
  { ...baseSchemaOptions, collection: 'admin_tool_runs' },
);

adminToolRunSchema.index({ tool_code: 1, created_at: -1 });
adminToolRunSchema.index({ status: 1, created_at: -1 });
adminToolRunSchema.index({ requested_by: 1, created_at: -1 });
adminToolRunSchema.index({ correlation_id: 1 });

module.exports = model('AdminToolRun', adminToolRunSchema);
module.exports.ADMIN_TOOL_RUN_MODE = ADMIN_TOOL_RUN_MODE;
module.exports.ADMIN_TOOL_RUN_STATUS = ADMIN_TOOL_RUN_STATUS;
module.exports.ADMIN_TOOL_RISK_LEVEL = ADMIN_TOOL_RISK_LEVEL;
