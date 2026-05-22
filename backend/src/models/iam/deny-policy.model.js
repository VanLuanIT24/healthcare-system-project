const { model } = require('mongoose');
const { auditFields, baseSchemaOptions, softDeleteFields, Schema } = require('../common/base-model');

// Bảng deny_policies: Lưu chính sách chặn quyền/vai trò động cho IAM control plane.

const DENY_POLICY_SUBJECT_TYPES = ['user', 'role', 'department', 'workspace'];
const DENY_POLICY_TYPES = ['permission', 'role', 'module', 'route', 'workspace'];
const DENY_POLICY_STATUSES = ['draft', 'active', 'inactive', 'expired'];
const DENY_POLICY_SEVERITIES = ['low', 'medium', 'high', 'critical'];

const denyPolicySchema = new Schema(
  {
    subject_type: { type: String, enum: DENY_POLICY_SUBJECT_TYPES, required: true, trim: true },
    subject_id: { type: String, required: true, trim: true },
    subject_label: { type: String, trim: true },
    deny_type: { type: String, enum: DENY_POLICY_TYPES, required: true, trim: true },
    deny_value: { type: String, required: true, trim: true, lowercase: true },
    scope: { type: Schema.Types.Mixed },
    reason: { type: String, required: true, trim: true },
    severity: { type: String, enum: DENY_POLICY_SEVERITIES, default: 'medium', required: true },
    status: { type: String, enum: DENY_POLICY_STATUSES, default: 'draft', required: true },
    effective_from: { type: Date },
    effective_to: { type: Date },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'deny_policies' },
);

denyPolicySchema.index({ subject_type: 1, subject_id: 1, status: 1 });
denyPolicySchema.index({ deny_type: 1, deny_value: 1, status: 1 });
denyPolicySchema.index({ effective_from: 1, effective_to: 1 });
denyPolicySchema.index({ severity: 1, status: 1 });

module.exports = model('DenyPolicy', denyPolicySchema);
