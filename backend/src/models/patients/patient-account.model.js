const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, optionalString, softDeleteFields } = require('../common/base-model');
const { PATIENT_ACCOUNT_STATUS, PATIENT_ACCOUNT_STATUSES } = require('../../constants/statuses');

// Bảng patient_accounts: Lưu tài khoản đăng nhập cổng bệnh nhân gắn với hồ sơ bệnh nhân.

const patientAccountSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    username: { type: String, trim: true, set: optionalString },
    email: { type: String, lowercase: true, trim: true, set: optionalString },
    phone: { type: String, trim: true, set: optionalString },
    password_hash: { type: String, required: true },
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
    email_verified_at: { type: Date },
    phone_verified_at: { type: Date },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'patient_accounts' },
);

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

module.exports = model('PatientAccount', patientAccountSchema);
