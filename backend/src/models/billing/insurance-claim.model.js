const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { INSURANCE_CLAIM_STATUS, INSURANCE_CLAIM_STATUSES } = require('../../constants/statuses');

// Bảng insurance_claims: Lưu hồ sơ claim bảo hiểm, số tiền đề nghị/duyệt và quyết toán.
const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const insuranceClaimSchema = new Schema(
  {
    policy_id: { type: Schema.Types.ObjectId, ref: 'InsurancePolicy', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    claim_no: { type: String, required: true, unique: true, trim: true },
    submitted_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    approved_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    paid_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    submitted_at: { type: Date },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    settled_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    rejection_reason: { type: String },
    external_claim_ref: { type: String, trim: true },
    status: { type: String, enum: INSURANCE_CLAIM_STATUSES, default: INSURANCE_CLAIM_STATUS.DRAFT, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'insurance_claims' },
);

insuranceClaimSchema.index({ policy_id: 1 });
insuranceClaimSchema.index({ patient_id: 1 });
insuranceClaimSchema.index({ invoice_id: 1 });
insuranceClaimSchema.index({ submitted_at: 1 });
insuranceClaimSchema.index({ external_claim_ref: 1 });
insuranceClaimSchema.index({ status: 1 });
insuranceClaimSchema.index({ patient_id: 1, submitted_at: 1 });
insuranceClaimSchema.index({ status: 1, approved_amount: 1, paid_amount: 1 });

module.exports = model('InsuranceClaim', insuranceClaimSchema);
