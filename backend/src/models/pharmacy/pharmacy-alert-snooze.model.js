const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const pharmacyAlertSnoozeSchema = new Schema(
  {
    alert_id: { type: Schema.Types.ObjectId, ref: 'PharmacyAlert', required: true },
    snoozed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    snoozed_at: { type: Date, default: Date.now, required: true },
    snoozed_until: { type: Date, required: true },
    reason: { type: String },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active', required: true },
  },
  { ...baseSchemaOptions, collection: 'pharmacy_alert_snoozes' },
);

pharmacyAlertSnoozeSchema.index({ alert_id: 1, status: 1 });
pharmacyAlertSnoozeSchema.index({ snoozed_until: 1, status: 1 });

module.exports = model('PharmacyAlertSnooze', pharmacyAlertSnoozeSchema);
