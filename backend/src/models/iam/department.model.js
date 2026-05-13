const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { DEPARTMENT_STATUS, DEPARTMENT_STATUSES } = require('../../constants/statuses');

// Bảng departments: Lưu danh mục khoa, phòng ban và đơn vị nghiệp vụ trong bệnh viện.

const departmentSchema = new Schema(
  {
    department_code: { type: String, required: true, trim: true },
    department_name: { type: String, required: true, trim: true },
    department_type: { type: String, trim: true },
    head_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    location_note: { type: String, trim: true },
    status: { type: String, enum: DEPARTMENT_STATUSES, default: DEPARTMENT_STATUS.ACTIVE, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'departments' },
);

departmentSchema.index(
  { department_code: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false } },
);
departmentSchema.index({ department_name: 1 });
departmentSchema.index({ department_type: 1 });
departmentSchema.index({ status: 1 });
departmentSchema.index({ head_user_id: 1 });

module.exports = model('Department', departmentSchema);
