const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const { ACTOR_TYPES, CONSENT_STATUSES, CONSENT_STATUS, CONSENT_TYPES } = require('../../constants/statuses');

// Bảng consent_records: Lưu consent y tế/thanh toán/chia sẻ hồ sơ và chữ ký.

const consentRecordSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    actor_id: { type: Schema.Types.Mixed, required: true },
    consent_type: { type: String, enum: CONSENT_TYPES, required: true },
    status: { type: String, enum: CONSENT_STATUSES, default: CONSENT_STATUS.ACTIVE, required: true },
    signed_at: { type: Date },
    revoked_at: { type: Date },
    expires_at: { type: Date },
    document_attachment_id: { type: Schema.Types.ObjectId, ref: 'Attachment' },
    signature_data: { type: Schema.Types.Mixed },
    scope: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'consent_records' },
);

consentRecordSchema.index({ patient_id: 1, consent_type: 1, status: 1 });
consentRecordSchema.index({ actor_type: 1, actor_id: 1, created_at: -1 });
consentRecordSchema.index({ expires_at: 1, status: 1 });
consentRecordSchema.index({ document_attachment_id: 1 });

module.exports = model('ConsentRecord', consentRecordSchema);
