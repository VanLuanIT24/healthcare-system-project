const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const pharmacyAlertResolutionSchema = new Schema(
  {
    alert_id: { type: Schema.Types.ObjectId, ref: 'PharmacyAlert', required: true },
    resolution_type: {
      type: String,
      enum: ['stock_replenished', 'transferred', 'disposed', 'clinical_confirmed', 'false_positive', 'manual', 'other'],
      default: 'manual',
      required: true,
    },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date, default: Date.now, required: true },
    note: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'pharmacy_alert_resolutions' },
);

pharmacyAlertResolutionSchema.index({ alert_id: 1, resolved_at: -1 });
pharmacyAlertResolutionSchema.index({ resolution_type: 1, resolved_at: -1 });

module.exports = model('PharmacyAlertResolution', pharmacyAlertResolutionSchema);
