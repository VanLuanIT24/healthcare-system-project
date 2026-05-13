const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, optionalString, softDeleteFields } = require('../common/base-model');
const { USER_STATUS, USER_STATUSES } = require('../../constants/statuses');

// Bảng users: Lưu tài khoản đăng nhập, thông tin nhân viên và trạng thái bảo mật nội bộ.

const userSchema = new Schema(
  {
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    username: { type: String, required: true, trim: true },
    password_hash: { type: String, required: true },
    full_name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, set: optionalString },
    employee_code: { type: String, trim: true, set: optionalString },
    email: { type: String, lowercase: true, trim: true, set: optionalString },
    status: { type: String, enum: USER_STATUSES, default: USER_STATUS.ACTIVE, required: true },
    last_login_at: { type: Date },
    last_login_ip: { type: String },
    must_change_password: { type: Boolean, default: false, required: true },
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
  { ...baseSchemaOptions, collection: 'users' },
);

userSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
userSchema.index(
  { employee_code: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false, employee_code: { $type: 'string' } } },
);
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false, email: { $type: 'string' } } },
);
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false, phone: { $type: 'string' } } },
);
userSchema.index({ department_id: 1 });
userSchema.index({ status: 1 });
userSchema.index({ full_name: 1 });
userSchema.index({ last_login_at: 1 });
userSchema.index({ password_expired_at: 1 });

module.exports = model('User', userSchema);
