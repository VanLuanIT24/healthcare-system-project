const { model } = require('mongoose');
const { baseSchemaOptions, softDeleteFields, Schema } = require('../common/base-model');

const permissionSchema = new Schema(
  {
    permission_code: { type: String, required: true, unique: true, trim: true },
    permission_name: { type: String, required: true, trim: true },
    module_key: { type: String, required: true, trim: true },
    description: { type: String },
    is_system: { type: Boolean, default: true, required: true },
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'permissions' },
);

permissionSchema.index({ module_key: 1 });

module.exports = model('Permission', permissionSchema);
