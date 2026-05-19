const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const CONTROLLED_DRUG_TYPES = ['narcotic', 'psychotropic', 'precursor', 'high_alert', 'other'];
const CONTROLLED_DRUG_POLICY_STATUSES = ['active', 'inactive', 'draft'];

const controlledDrugPolicySchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    controlled_type: { type: String, enum: CONTROLLED_DRUG_TYPES, default: 'high_alert', required: true },
    medication_ids: [{ type: Schema.Types.ObjectId, ref: 'MedicationMaster' }],
    requires_double_check: { type: Boolean, default: true },
    requires_witness: { type: Boolean, default: false },
    requires_locked_storage: { type: Boolean, default: false },
    requires_shift_count: { type: Boolean, default: false },
    requires_reason_for_adjustment: { type: Boolean, default: true },
    requires_approval_for_waste: { type: Boolean, default: true },
    outpatient_dispense_allowed: { type: Boolean, default: true },
    inpatient_administration_allowed: { type: Boolean, default: true },
    max_dispense_quantity: { type: Number, min: 0 },
    status: { type: String, enum: CONTROLLED_DRUG_POLICY_STATUSES, default: 'active', required: true },
    description: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'controlled_drug_policies' },
);

controlledDrugPolicySchema.index({ code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
controlledDrugPolicySchema.index({ controlled_type: 1, status: 1 });
controlledDrugPolicySchema.index({ medication_ids: 1 });

module.exports = model('ControlledDrugPolicy', controlledDrugPolicySchema);
