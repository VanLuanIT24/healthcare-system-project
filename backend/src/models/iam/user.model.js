const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const userStatuses = ['active', 'suspended', 'locked', 'disabled'];

const userSchema = new Schema(
  {
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    username: { type: String, required: true, unique: true, trim: true },
    password_hash: { type: String, required: true },
    full_name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    employee_code: { type: String, trim: true, unique: true, sparse: true },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    status: { type: String, enum: userStatuses, default: 'active', required: true },
    last_login_at: { type: Date },
    last_login_ip: { type: String },
    must_change_password: { type: Boolean, default: false, required: true },
    password_changed_at: { type: Date },
    failed_login_attempts: { type: Number, default: 0, required: true },
    locked_until: { type: Date },
    email_verified_at: { type: Date },
    phone_verified_at: { type: Date },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'users' },
);

userSchema.index({ department_id: 1 });
userSchema.index({ status: 1 });
userSchema.index({ full_name: 1 });
userSchema.index({ last_login_at: 1 });

module.exports = model('User', userSchema);
