const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, optionalString, softDeleteFields } = require('../common/base-model');
const { buildInitialAvatar } = require('../../common/avatar');
const { PATIENT_ACCOUNT_STATUS, PATIENT_ACCOUNT_STATUSES } = require('../../constants/statuses');

// Bảng patient_accounts: Lưu tài khoản đăng nhập cổng bệnh nhân gắn với hồ sơ bệnh nhân.

const AUTH_PROVIDER = ['local', 'google', 'mixed'];

function buildPatientAccountAvatar(account) {
  return buildInitialAvatar({
    label: account.username || account.email || account.phone,
    seed: account.patient_id || account._id,
    fallbackInitials: 'BN',
  });
}

const patientAccountSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    username: { type: String, trim: true, set: optionalString },
    email: { type: String, lowercase: true, trim: true, set: optionalString },
    phone: { type: String, trim: true, set: optionalString },
    password_hash: {
      type: String,
      required() {
        return this.auth_provider !== 'google';
      },
    },
    status: { type: String, enum: PATIENT_ACCOUNT_STATUSES, default: PATIENT_ACCOUNT_STATUS.ACTIVE, required: true },
    last_login_at: { type: Date },
    last_login_ip: { type: String },
    password_changed_at: { type: Date },
    password_expired_at: { type: Date },
    password_history: [{
      password_hash: { type: String, required: true },
      changed_at: { type: Date, default: Date.now },
      changed_by: { type: Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String },
    }],
    failed_login_attempts: { type: Number, default: 0, required: true },
    locked_until: { type: Date },
    auth_provider: { type: String, enum: AUTH_PROVIDER, default: 'local', required: true },
    google_id: { type: String, trim: true, set: optionalString },
    avatar_url: {
      type: String,
      trim: true,
      set: optionalString,
      default() {
        return buildPatientAccountAvatar(this);
      },
    },
    email_verified: { type: Boolean, default: false, required: true },
    email_verified_at: { type: Date },
    phone_verified_at: { type: Date },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'patient_accounts' },
);

patientAccountSchema.pre('validate', function ensureAvatarUrl(next) {
  if (!this.avatar_url || !String(this.avatar_url).trim()) {
    this.avatar_url = buildPatientAccountAvatar(this);
  }

  next();
});

patientAccountSchema.index({ patient_id: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
patientAccountSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false, username: { $type: 'string' } } },
);
patientAccountSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false, email: { $type: 'string' } } },
);
patientAccountSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false, phone: { $type: 'string' } } },
);
patientAccountSchema.index({ status: 1 });
patientAccountSchema.index({ last_login_at: 1 });
patientAccountSchema.index({ password_expired_at: 1 });
patientAccountSchema.index(
  { google_id: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false, google_id: { $type: 'string' } } },
);
patientAccountSchema.index({ auth_provider: 1 });

module.exports = model('PatientAccount', patientAccountSchema);
