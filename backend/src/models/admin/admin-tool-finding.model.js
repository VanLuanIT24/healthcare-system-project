const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const ADMIN_TOOL_FINDING_SEVERITY = {
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const ADMIN_TOOL_FINDING_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  IGNORED: 'ignored',
  ACCEPTED_RISK: 'accepted_risk',
  REGRESSED: 'regressed',
};

const adminToolFindingSchema = new Schema(
  {
    run_id: { type: Schema.Types.ObjectId, ref: 'AdminToolRun', required: true },
    tool_code: { type: String, required: true, trim: true },
    severity: { type: String, enum: Object.values(ADMIN_TOOL_FINDING_SEVERITY), default: ADMIN_TOOL_FINDING_SEVERITY.INFO, required: true },
    type: { type: String, required: true, trim: true },
    domain: { type: String, trim: true },
    module: { type: String, trim: true },
    file: { type: String, trim: true },
    line: { type: Number },
    method: { type: String, trim: true },
    route: { type: String, trim: true },
    object_type: { type: String, trim: true },
    object_id: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    evidence: { type: Schema.Types.Mixed },
    suggested_fix: { type: Schema.Types.Mixed },
    auto_fixable: { type: Boolean, default: false, required: true },
    status: { type: String, enum: Object.values(ADMIN_TOOL_FINDING_STATUS), default: ADMIN_TOOL_FINDING_STATUS.OPEN, required: true },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    accepted_risk_by: { type: Schema.Types.ObjectId, ref: 'User' },
    accepted_risk_reason: { type: String },
  },
  { ...baseSchemaOptions, collection: 'admin_tool_findings' },
);

adminToolFindingSchema.index({ run_id: 1, severity: 1 });
adminToolFindingSchema.index({ tool_code: 1, status: 1, severity: 1 });
adminToolFindingSchema.index({ type: 1, status: 1 });
adminToolFindingSchema.index({ object_type: 1, object_id: 1 });

module.exports = model('AdminToolFinding', adminToolFindingSchema);
module.exports.ADMIN_TOOL_FINDING_SEVERITY = ADMIN_TOOL_FINDING_SEVERITY;
module.exports.ADMIN_TOOL_FINDING_STATUS = ADMIN_TOOL_FINDING_STATUS;
