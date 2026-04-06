const { model } = require('mongoose');
const { baseSchemaOptions, auditFields, Schema } = require('../common/base-model');

const rolePermissionSchema = new Schema(
  {
    role_id: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    permission_id: { type: Schema.Types.ObjectId, ref: 'Permission', required: true },
    is_active: { type: Boolean, default: true, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'role_permissions' },
);

rolePermissionSchema.index({ role_id: 1, permission_id: 1 }, { unique: true });
rolePermissionSchema.index({ role_id: 1 });
rolePermissionSchema.index({ permission_id: 1 });

module.exports = model('RolePermission', rolePermissionSchema);
