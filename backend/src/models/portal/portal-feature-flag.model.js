const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const PORTAL_FEATURE_FLAG_RISK_LEVEL = ['low', 'medium', 'high', 'critical'];

const portalFeatureFlagSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    group: { type: String, required: true, trim: true, lowercase: true },
    enabled: { type: Boolean, default: false, required: true },
    value: { type: Schema.Types.Mixed },
    rollout_percentage: { type: Number, min: 0, max: 100, default: 100 },
    scopes: {
      actor_types: [{ type: String, trim: true }],
      departments: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
      patient_segments: [{ type: String, trim: true }],
      user_ids: [{ type: Schema.Types.ObjectId }],
    },
    dependencies: [{ type: String, trim: true, lowercase: true }],
    risk_level: { type: String, enum: PORTAL_FEATURE_FLAG_RISK_LEVEL, default: 'medium' },
    last_value_snapshot: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'portal_feature_flags' },
);

portalFeatureFlagSchema.index({ group: 1, enabled: 1 });
portalFeatureFlagSchema.index({ risk_level: 1 });
portalFeatureFlagSchema.index({ updated_at: -1 });

module.exports = model('PortalFeatureFlag', portalFeatureFlagSchema);
