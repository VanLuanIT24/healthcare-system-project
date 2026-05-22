const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const PORTAL_PROFILE_POLICY_RISK_LEVEL = ['low', 'medium', 'high', 'critical'];

const portalProfileFieldPolicySchema = new Schema(
  {
    field_name: { type: String, required: true, trim: true, lowercase: true, unique: true },
    group: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, trim: true },
    patient_editable: { type: Boolean, default: false, required: true },
    requires_review: { type: Boolean, default: true, required: true },
    requires_attachment: { type: Boolean, default: false, required: true },
    sensitive: { type: Boolean, default: false, required: true },
    reviewer_permissions: [{ type: String, trim: true }],
    sla_hours: { type: Number, min: 1, default: 24 },
    lock_when_verified: { type: Boolean, default: false, required: true },
    enabled: { type: Boolean, default: true, required: true },
    notification_template_key: { type: String, trim: true },
    risk_level: { type: String, enum: PORTAL_PROFILE_POLICY_RISK_LEVEL, default: 'medium' },
    last_value_snapshot: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'portal_profile_field_policies' },
);

portalProfileFieldPolicySchema.index({ group: 1, enabled: 1 });
portalProfileFieldPolicySchema.index({ sensitive: 1, requires_review: 1 });
portalProfileFieldPolicySchema.index({ risk_level: 1 });

module.exports = model('PortalProfileFieldPolicy', portalProfileFieldPolicySchema);
