const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const pharmacyAlertActionLogSchema = new Schema(
  {
    alert_id: { type: Schema.Types.ObjectId, ref: 'PharmacyAlert', required: true },
    action: { type: String, required: true, trim: true },
    from_status: { type: String, trim: true },
    to_status: { type: String, trim: true },
    actor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String },
    metadata: { type: Schema.Types.Mixed },
    occurred_at: { type: Date, default: Date.now, required: true },
  },
  { ...baseSchemaOptions, collection: 'pharmacy_alert_action_logs' },
);

pharmacyAlertActionLogSchema.index({ alert_id: 1, occurred_at: -1 });
pharmacyAlertActionLogSchema.index({ action: 1, occurred_at: -1 });
pharmacyAlertActionLogSchema.index({ actor_id: 1, occurred_at: -1 });

module.exports = model('PharmacyAlertActionLog', pharmacyAlertActionLogSchema);
