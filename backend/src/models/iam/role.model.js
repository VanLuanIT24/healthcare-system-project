const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { ROLE_STATUS, ROLE_STATUSES } = require('../../constants/statuses');

// Bảng roles: Lưu vai trò hệ thống dùng để phân quyền cho người dùng.

const roleSchema = new Schema(
  {
    role_code: { type: String, required: true, trim: true, lowercase: true },
    role_name: { type: String, required: true, trim: true },
    description: { type: String },
    is_system: { type: Boolean, default: false, required: true },
    priority_level: { type: Number, default: 0, required: true, min: 0 },
    status: { type: String, enum: ROLE_STATUSES, default: ROLE_STATUS.ACTIVE, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'roles' },
);

roleSchema.index({ role_code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
roleSchema.index({ role_name: 1 });
roleSchema.index({ status: 1 });
roleSchema.index({ is_system: 1 });
roleSchema.index({ priority_level: -1 });

module.exports = model('Role', roleSchema);
