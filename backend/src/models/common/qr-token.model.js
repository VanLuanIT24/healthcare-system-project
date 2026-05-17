const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('./base-model');
const { ACTOR_TYPES, QR_TOKEN_TYPES, QR_TOKEN_TYPE } = require('../../constants/statuses');

// Bảng qr_tokens: Token QR dùng chung cho payment, check-in, verify đơn thuốc/kết quả/receipt.

const qrTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: QR_TOKEN_TYPES, default: QR_TOKEN_TYPE.PATIENT_CARD, required: true },
    target_type: { type: String, required: true, trim: true },
    target_id: { type: Schema.Types.ObjectId, required: true },
    actor_type: { type: String, enum: ACTOR_TYPES },
    actor_id: { type: Schema.Types.Mixed },
    expires_at: { type: Date },
    used_at: { type: Date },
    revoked_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'qr_tokens' },
);

qrTokenSchema.index({ type: 1, target_type: 1, target_id: 1 });
qrTokenSchema.index({ expires_at: 1 });
qrTokenSchema.index({ revoked_at: 1 });
qrTokenSchema.index({ actor_type: 1, actor_id: 1, created_at: -1 });

module.exports = model('QrToken', qrTokenSchema);
