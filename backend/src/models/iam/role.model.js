const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const roleStatuses = ['active', 'inactive'];

const roleSchema = new Schema(
  {
    role_code: { type: String, required: true, unique: true, trim: true },
    role_name: { type: String, required: true, trim: true },
    description: { type: String },
    status: { type: String, enum: roleStatuses, default: 'active', required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'roles' },
);

roleSchema.index({ role_name: 1 });
roleSchema.index({ status: 1 });

module.exports = model('Role', roleSchema);
