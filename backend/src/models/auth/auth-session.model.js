const { createHash } = require('crypto');
const { model } = require('mongoose');
const { baseSchemaOptions, Schema } = require('../common/base-model');
const { ACTOR_TYPE } = require('../../constants/statuses');

// Bảng auth_sessions: Lưu phiên đăng nhập và refresh token của nhân viên/bệnh nhân.

function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

const authSessionSchema = new Schema(
  {
    actor_type: {
      type: String,
      enum: [ACTOR_TYPE.STAFF, ACTOR_TYPE.PATIENT, ACTOR_TYPE.PATIENT_RELATIVE, ACTOR_TYPE.SERVICE_ACCOUNT],
      required: true,
    },
    actor_id: { type: Schema.Types.ObjectId, required: true },
    permission_version: { type: Number, default: 1, min: 1 },
    refresh_token_hash: { type: String, required: true, unique: true },
    refresh_token_history: [{
      token_hash: { type: String, required: true },
      rotated_at: { type: Date, default: Date.now },
      replayed_at: { type: Date },
    }],
    token_family_id: { type: String, trim: true },
    parent_session_id: { type: Schema.Types.ObjectId, ref: 'AuthSession' },
    device_id: { type: String, trim: true },
    device_name: { type: String, trim: true },
    browser: { type: String, trim: true },
    os: { type: String, trim: true },
    location: { type: Schema.Types.Mixed },
    login_method: { type: String, trim: true },
    created_ip: { type: String },
    last_ip: { type: String },
    user_agent: { type: String },
    ip_address: { type: String },
    expires_at: { type: Date, required: true },
    revoked_at: { type: Date },
    revoked_reason: { type: String, trim: true },
    revoked_by: { type: Schema.Types.ObjectId },
    last_used_at: { type: Date },
  },
  { ...baseSchemaOptions, collection: 'auth_sessions' },
);

authSessionSchema.index({ actor_type: 1, actor_id: 1 });
authSessionSchema.index({ actor_type: 1, actor_id: 1, revoked_at: 1, expires_at: -1 });
authSessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.index({ revoked_at: 1 });
authSessionSchema.index({ token_family_id: 1 });
authSessionSchema.index({ 'refresh_token_history.token_hash': 1 });
authSessionSchema.index({ device_id: 1 });

module.exports = {
  AuthSession: model('AuthSession', authSessionSchema),
  hashRefreshToken,
};
