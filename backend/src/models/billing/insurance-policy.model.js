const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const {
  ACTOR_TYPES,
  INSURANCE_POLICY_SOURCE,
  INSURANCE_POLICY_SOURCES,
  INSURANCE_POLICY_STATUS,
  INSURANCE_POLICY_STATUSES,
  INSURANCE_VERIFICATION_STATUS,
  INSURANCE_VERIFICATION_STATUSES,
} = require('../../constants/statuses');

// Bảng insurance_policies: Lưu thông tin thẻ/chính sách bảo hiểm của bệnh nhân.

const insurancePolicySchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    payer_name: { type: String, required: true, trim: true },
    payer_code: { type: String, trim: true },
    policy_no: { type: String, required: true, trim: true },
    member_no: { type: String, trim: true },
    coverage_type: { type: String, trim: true },
    coverage_percent: { type: Number, min: 0, max: 100 },
    valid_from: { type: Date },
    valid_to: { type: Date },
    is_primary: { type: Boolean, default: false, required: true },
    source: { type: String, enum: INSURANCE_POLICY_SOURCES, default: INSURANCE_POLICY_SOURCE.STAFF_CREATED, required: true },
    verification_status: {
      type: String,
      enum: INSURANCE_VERIFICATION_STATUSES,
      default: INSURANCE_VERIFICATION_STATUS.VERIFIED,
      required: true,
    },
    submitted_by_actor_type: { type: String, enum: ACTOR_TYPES },
    submitted_by_actor_id: { type: Schema.Types.Mixed },
    submitted_at: { type: Date },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    rejection_reason: { type: String },
    front_card_attachment_id: { type: Schema.Types.ObjectId, ref: 'Attachment' },
    back_card_attachment_id: { type: Schema.Types.ObjectId, ref: 'Attachment' },
    status: { type: String, enum: INSURANCE_POLICY_STATUSES, default: INSURANCE_POLICY_STATUS.ACTIVE, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'insurance_policies' },
);

insurancePolicySchema.index({ patient_id: 1 });
insurancePolicySchema.index({ payer_name: 1 });
insurancePolicySchema.index({ policy_no: 1 });
insurancePolicySchema.index({ member_no: 1 });
insurancePolicySchema.index({ valid_from: 1, valid_to: 1 });
insurancePolicySchema.index({ status: 1 });
insurancePolicySchema.index({ source: 1 });
insurancePolicySchema.index({ verification_status: 1 });
insurancePolicySchema.index({ front_card_attachment_id: 1 });
insurancePolicySchema.index({ back_card_attachment_id: 1 });
insurancePolicySchema.index({ patient_id: 1, is_primary: 1 });
insurancePolicySchema.index(
  { patient_id: 1, policy_no: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false } },
);

module.exports = model('InsurancePolicy', insurancePolicySchema);
