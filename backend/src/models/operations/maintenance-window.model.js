const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const MAINTENANCE_WINDOW_STATUS = {
  ACTIVE: 'active',
  ENDED: 'ended',
  SCHEDULED: 'scheduled',
  CANCELLED: 'cancelled',
};

const MAINTENANCE_SCOPE = {
  GLOBAL: 'global',
  PATIENT_PORTAL: 'patient_portal',
  BILLING: 'billing',
  CLINICAL: 'clinical',
  PHARMACY: 'pharmacy',
  SCHEDULING: 'scheduling',
  ADMIN: 'admin',
  REALTIME: 'realtime',
  PAYMENT_PROVIDER: 'payment_provider',
  FILE_UPLOAD: 'file_upload',
};

const maintenanceWindowSchema = new Schema(
  {
    scope: {
      type: String,
      enum: Object.values(MAINTENANCE_SCOPE),
      default: MAINTENANCE_SCOPE.GLOBAL,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(MAINTENANCE_WINDOW_STATUS),
      default: MAINTENANCE_WINDOW_STATUS.ACTIVE,
      required: true,
    },
    message: { type: String, trim: true },
    starts_at: { type: Date, default: Date.now, required: true },
    ends_at: { type: Date },
    allowed_actor_types: [{ type: String, trim: true }],
    allowed_roles: [{ type: String, trim: true }],
    allowed_permissions: [{ type: String, trim: true }],
    allow_webhooks: { type: Boolean, default: true },
    allow_health_check: { type: Boolean, default: true },
    allow_emergency: { type: Boolean, default: true },
    allow_admin_bypass: { type: Boolean, default: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    ended_by: { type: Schema.Types.ObjectId, ref: 'User' },
    ended_at: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { ...baseSchemaOptions, collection: 'maintenance_windows' },
);

maintenanceWindowSchema.index({ status: 1, scope: 1, starts_at: -1 });
maintenanceWindowSchema.index({ starts_at: 1, ends_at: 1 });

module.exports = model('MaintenanceWindow', maintenanceWindowSchema);
module.exports.MAINTENANCE_WINDOW_STATUS = MAINTENANCE_WINDOW_STATUS;
module.exports.MAINTENANCE_SCOPE = MAINTENANCE_SCOPE;
