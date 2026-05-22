const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

// Dynamic policy draft/published records for sensitive data access governance.

const dataAccessPolicySchema = new Schema(
  {
    policy_key: { type: String, required: true, trim: true, unique: true },
    resource_type: { type: String, required: true, trim: true, index: true },
    action: { type: String, required: true, trim: true },
    required_permissions: [{ type: String, trim: true }],
    required_roles: [{ type: String, trim: true }],
    denied_roles: [{ type: String, trim: true }],
    denied_permissions: [{ type: String, trim: true }],
    require_consent: { type: Boolean, default: false },
    consent_types: [{ type: String, trim: true }],
    require_patient_authorization: { type: Boolean, default: false },
    authorization_types: [{ type: String, trim: true }],
    allow_break_glass: { type: Boolean, default: false },
    require_reason: { type: Boolean, default: false },
    audit_required: { type: Boolean, default: true },
    review_required: { type: Boolean, default: false },
    retention_days: { type: Number, default: 3650 },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    version: { type: Number, default: 1 },
    published_at: { type: Date },
    archived_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'security_data_access_policies' },
);

dataAccessPolicySchema.index({ resource_type: 1, action: 1, status: 1 });

module.exports = model('SecurityDataAccessPolicy', dataAccessPolicySchema);
