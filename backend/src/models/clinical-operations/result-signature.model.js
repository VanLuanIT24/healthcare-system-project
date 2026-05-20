const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const RESULT_SIGNATURE_ENTITY_TYPES = ['lab_result', 'imaging_report'];
const RESULT_SIGNATURE_METHODS = ['password', 'otp', 'certificate', 'system'];
const RESULT_SIGNATURE_STATUSES = ['active', 'revoked'];

const resultSignatureSchema = new Schema(
  {
    entity_type: { type: String, enum: RESULT_SIGNATURE_ENTITY_TYPES, required: true, trim: true },
    entity_id: { type: Schema.Types.ObjectId, required: true },
    signed_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    signed_at: { type: Date, default: Date.now, required: true },
    signature_method: { type: String, enum: RESULT_SIGNATURE_METHODS, default: 'system', required: true },
    signature_hash: { type: String, required: true, trim: true },
    signature_snapshot: { type: Schema.Types.Mixed },
    revoked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    revoked_at: { type: Date },
    revoke_reason: { type: String },
    status: { type: String, enum: RESULT_SIGNATURE_STATUSES, default: 'active', required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'result_signatures' },
);

resultSignatureSchema.index({ entity_type: 1, entity_id: 1, status: 1 });
resultSignatureSchema.index({ signed_by: 1, signed_at: -1 });
resultSignatureSchema.index({ signature_hash: 1 }, { unique: true });

module.exports = model('ResultSignature', resultSignatureSchema);
