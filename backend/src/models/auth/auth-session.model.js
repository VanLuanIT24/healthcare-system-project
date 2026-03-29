const { createHash } = require('crypto');
const { model } = require('mongoose');
const { baseSchemaOptions, Schema } = require('../common/base-model');

function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

const authSessionSchema = new Schema(
  {
    actor_type: { type: String, enum: ['staff', 'patient'], required: true },
    actor_id: { type: Schema.Types.ObjectId, required: true },
    refresh_token_hash: { type: String, required: true, unique: true },
    user_agent: { type: String },
    ip_address: { type: String },
    expires_at: { type: Date, required: true },
    revoked_at: { type: Date },
    last_used_at: { type: Date },
  },
  { ...baseSchemaOptions, collection: 'auth_sessions' },
);

authSessionSchema.index({ actor_type: 1, actor_id: 1 });
authSessionSchema.index({ expires_at: 1 });
authSessionSchema.index({ revoked_at: 1 });

module.exports = {
  AuthSession: model('AuthSession', authSessionSchema),
  hashRefreshToken,
};
