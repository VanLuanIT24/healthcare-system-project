const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const WAREHOUSE_TYPES = ['central', 'pharmacy', 'ward', 'emergency', 'department'];
const WAREHOUSE_STATUSES = ['active', 'inactive'];

const warehouseSchema = new Schema(
  {
    warehouse_code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: WAREHOUSE_TYPES, default: 'pharmacy', required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    status: { type: String, enum: WAREHOUSE_STATUSES, default: 'active', required: true },
    note: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'warehouses' },
);

warehouseSchema.index({ warehouse_code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
warehouseSchema.index({ type: 1, status: 1 });
warehouseSchema.index({ department_id: 1 });

module.exports = model('Warehouse', warehouseSchema);

