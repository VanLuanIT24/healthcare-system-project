const { createHash, randomBytes } = require('crypto');
const { model } = require('mongoose');
const { baseSchemaOptions, Schema } = require('../common/base-model');

function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function generateResetToken() {
  return randomBytes(32).toString('hex');
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const passwordResetTokenSchema = new Schema(
  {
    actor_type: { type: String, enum: ['staff', 'patient'], required: true },
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
passwordResetTokenSchema.index({ expires_at: 1 });
passwordResetTokenSchema.index({ used_at: 1 });
passwordResetTokenSchema.index({ revoked_at: 1 });

module.exports = {
  PasswordResetToken: model('PasswordResetToken', passwordResetTokenSchema),
  hashResetToken,
  generateResetToken,
  generateResetCode,
};
