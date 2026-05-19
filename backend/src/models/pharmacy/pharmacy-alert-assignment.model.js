const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const pharmacyAlertAssignmentSchema = new Schema(
  {
    alert_id: { type: Schema.Types.ObjectId, ref: 'PharmacyAlert', required: true },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assigned_by: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_at: { type: Date, default: Date.now, required: true },
    status: { type: String, enum: ['active', 'superseded', 'released'], default: 'active', required: true },
    note: { type: String },
  },
  { ...baseSchemaOptions, collection: 'pharmacy_alert_assignments' },
);

pharmacyAlertAssignmentSchema.index({ alert_id: 1, status: 1 });
pharmacyAlertAssignmentSchema.index({ assigned_to: 1, status: 1 });

module.exports = model('PharmacyAlertAssignment', pharmacyAlertAssignmentSchema);
