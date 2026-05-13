const { createHash, randomBytes, randomInt } = require('crypto');
const { model } = require('mongoose');
const { baseSchemaOptions, Schema } = require('../common/base-model');
const { ACTOR_TYPE } = require('../../constants/statuses');

// Bảng password_reset_tokens: Lưu token và mã OTP khôi phục mật khẩu có thời hạn.

function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function hashResetCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

function generateResetToken() {
  return randomBytes(32).toString('hex');
}

function generateResetCode() {
  return String(randomInt(100000, 1000000));
}

const passwordResetTokenSchema = new Schema(
  {
    actor_type: { type: String, enum: [ACTOR_TYPE.STAFF, ACTOR_TYPE.PATIENT], required: true },
    actor_id: { type: Schema.Types.ObjectId, required: true },
    token_hash: { type: String, required: true, unique: true },
    reset_code_hash: { type: String, required: true },
    expires_at: { type: Date, required: true },
    used_at: { type: Date },
    revoked_at: { type: Date },
    requested_ip: { type: String },
    requested_user_agent: { type: String },
  },
  { ...baseSchemaOptions, collection: 'password_reset_tokens' },
);

passwordResetTokenSchema.index({ actor_type: 1, actor_id: 1 });
passwordResetTokenSchema.index({ actor_type: 1, actor_id: 1, used_at: 1, revoked_at: 1, expires_at: 1 });
passwordResetTokenSchema.index({ actor_type: 1, reset_code_hash: 1, expires_at: 1 });
passwordResetTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
passwordResetTokenSchema.index({ used_at: 1 });
passwordResetTokenSchema.index({ revoked_at: 1 });

module.exports = {
  PasswordResetToken: model('PasswordResetToken', passwordResetTokenSchema),
  hashResetToken,
  hashResetCode,
  generateResetToken,
  generateResetCode,
};
