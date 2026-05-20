const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const overrideSchema = new Schema(
  {
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', index: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    reason: { type: String, required: true, trim: true },
    override_type: {
      type: String,
      enum: ['emergency', 'inpatient_bill_later', 'insurance_pending', 'manager_approved', 'clinical_exception'],
      default: 'manager_approved',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
      required: true,
      index: true,
    },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    revoked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    revoked_at: { type: Date },
    revoke_reason: { type: String, trim: true },
    expires_at: { type: Date },
    audit_logs: [{
      action: { type: String, trim: true },
      actor_type: { type: String, trim: true },
      actor_id: { type: Schema.Types.Mixed },
      at: { type: Date, default: Date.now },
      reason: { type: String },
      metadata: { type: Schema.Types.Mixed },
    }],
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'clinical_payment_overrides' },
);

overrideSchema.index({ order_id: 1, status: 1 });
overrideSchema.index({ encounter_id: 1, status: 1 });
overrideSchema.index({ expires_at: 1, status: 1 });

module.exports = model('ClinicalPaymentOverride', overrideSchema);
