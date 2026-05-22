const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const ADMIN_TOOL_APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

const adminToolApprovalSchema = new Schema(
  {
    run_id: { type: Schema.Types.ObjectId, ref: 'AdminToolRun', required: true },
    tool_code: { type: String, required: true, trim: true },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: Object.values(ADMIN_TOOL_APPROVAL_STATUS), default: ADMIN_TOOL_APPROVAL_STATUS.PENDING, required: true },
    reason: { type: String, trim: true },
    approval_note: { type: String, trim: true },
    confirmation_text: { type: String, trim: true },
    requested_at: { type: Date, default: Date.now },
    decided_at: { type: Date },
    expires_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'admin_tool_approvals' },
);

adminToolApprovalSchema.index({ run_id: 1, status: 1 });
adminToolApprovalSchema.index({ tool_code: 1, status: 1, created_at: -1 });
adminToolApprovalSchema.index({ requested_by: 1, created_at: -1 });

module.exports = model('AdminToolApproval', adminToolApprovalSchema);
module.exports.ADMIN_TOOL_APPROVAL_STATUS = ADMIN_TOOL_APPROVAL_STATUS;
