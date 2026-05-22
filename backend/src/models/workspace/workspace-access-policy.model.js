const { model } = require('mongoose');
const { Schema, auditFields, baseSchemaOptions, softDeleteFields } = require('../common/base-model');

const WORKSPACE_POLICY_EFFECTS = ['allow', 'deny', 'hide', 'readonly', 'maintenance_bypass'];
const WORKSPACE_POLICY_SUBJECT_TYPES = [
  'actor_type',
  'role',
  'user',
  'department',
  'permission',
  'permission_prefix',
];
const WORKSPACE_POLICY_STATUSES = ['draft', 'active', 'disabled', 'expired'];

const workspaceAccessPolicySchema = new Schema(
  {
    policy_name: { type: String, required: true, trim: true },
    workspace_code: { type: String, required: true, trim: true, lowercase: true },
    subject_type: { type: String, enum: WORKSPACE_POLICY_SUBJECT_TYPES, required: true },
    subject_id: { type: Schema.Types.Mixed },
    subject_code: { type: String, trim: true, lowercase: true },
    effect: { type: String, enum: WORKSPACE_POLICY_EFFECTS, required: true },
    priority: { type: Number, default: 100, required: true },
    conditions: { type: Schema.Types.Mixed, default: {} },
    reason: { type: String, trim: true },
    valid_from: { type: Date },
    valid_to: { type: Date },
    status: { type: String, enum: WORKSPACE_POLICY_STATUSES, default: 'active', required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'workspace_access_policies' },
);

workspaceAccessPolicySchema.index({ workspace_code: 1, status: 1 });
workspaceAccessPolicySchema.index({ subject_type: 1, subject_code: 1 });
workspaceAccessPolicySchema.index({ subject_type: 1, subject_id: 1 });
workspaceAccessPolicySchema.index({ effect: 1, priority: -1 });
workspaceAccessPolicySchema.index({ valid_from: 1, valid_to: 1 });

module.exports = model('WorkspaceAccessPolicy', workspaceAccessPolicySchema);
