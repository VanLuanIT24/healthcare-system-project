const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const EXPIRY_POLICY_SCOPE_TYPES = ['global', 'medication', 'dosage_form', 'storage_location', 'warehouse'];
const EXPIRY_PICKING_STRATEGIES = ['FEFO', 'FIFO', 'MANUAL'];
const EXPIRY_POLICY_STATUSES = ['active', 'inactive', 'draft'];

const pharmacyExpiryPolicySchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    scope_type: { type: String, enum: EXPIRY_POLICY_SCOPE_TYPES, default: 'global', required: true },
    scope_id: { type: Schema.Types.ObjectId },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster' },
    dosage_form_id: { type: Schema.Types.ObjectId, ref: 'DosageForm' },
    storage_location_id: { type: Schema.Types.ObjectId, ref: 'StorageLocation' },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    picking_strategy: { type: String, enum: EXPIRY_PICKING_STRATEGIES, default: 'FEFO', required: true },
    block_expired_batch: { type: Boolean, default: true },
    block_near_expiry_days: { type: Number, min: 0 },
    allow_no_expiry_date: { type: Boolean, default: true },
    allow_override: { type: Boolean, default: false },
    override_requires_reason: { type: Boolean, default: true },
    override_requires_approval: { type: Boolean, default: false },
    near_expiry_alert_days: { type: Number, default: 30, min: 0 },
    auto_mark_expired: { type: Boolean, default: false },
    status: { type: String, enum: EXPIRY_POLICY_STATUSES, default: 'active', required: true },
    description: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'pharmacy_expiry_policies' },
);

pharmacyExpiryPolicySchema.index({ code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
pharmacyExpiryPolicySchema.index({ scope_type: 1, status: 1 });
pharmacyExpiryPolicySchema.index({ medication_id: 1, status: 1 });
pharmacyExpiryPolicySchema.index({ dosage_form_id: 1, status: 1 });
pharmacyExpiryPolicySchema.index({ storage_location_id: 1, status: 1 });

module.exports = model('PharmacyExpiryPolicy', pharmacyExpiryPolicySchema);
