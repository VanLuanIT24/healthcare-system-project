const { model } = require('mongoose');
const { auditFields, baseSchemaOptions, softDeleteFields, Schema } = require('../common/base-model');

// Bảng permissions: Lưu từng quyền thao tác theo module để gán vào vai trò.

const permissionSchema = new Schema(
  {
    permission_code: { type: String, required: true, trim: true, lowercase: true },
    permission_name: { type: String, required: true, trim: true },
    module_key: { type: String, required: true, trim: true, lowercase: true },
    action_key: { type: String, trim: true, lowercase: true },
    description: { type: String },
    is_system: { type: Boolean, default: false, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'permissions' },
);

permissionSchema.index({ permission_code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
permissionSchema.index({ module_key: 1 });
permissionSchema.index({ module_key: 1, action_key: 1 });

module.exports = model('Permission', permissionSchema);
