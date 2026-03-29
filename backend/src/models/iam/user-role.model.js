const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const userRoleSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role_id: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    is_active: { type: Boolean, default: true, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'user_roles' },
);

userRoleSchema.index({ user_id: 1, role_id: 1 }, { unique: true });
userRoleSchema.index({ user_id: 1 });
userRoleSchema.index({ role_id: 1 });
userRoleSchema.index({ is_active: 1 });

module.exports = model('UserRole', userRoleSchema);
