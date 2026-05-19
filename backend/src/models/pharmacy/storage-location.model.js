const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const STORAGE_LOCATION_TYPES = ['warehouse', 'shelf', 'cabinet', 'fridge', 'controlled_cabinet', 'quarantine', 'recall', 'disposal', 'bin', 'other'];
const STORAGE_LOCATION_STATUSES = ['active', 'maintenance', 'locked', 'inactive', 'quarantined'];

const storageLocationSchema = new Schema(
  {
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    location_code: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    name: { type: String, trim: true },
    parent_id: { type: Schema.Types.ObjectId, ref: 'StorageLocation' },
    location_type: { type: String, enum: STORAGE_LOCATION_TYPES, default: 'shelf', required: true },
    zone: { type: String, trim: true },
    shelf: { type: String, trim: true },
    bin: { type: String, trim: true },
    temperature_zone: { type: String, trim: true },
    temperature_min: { type: Number },
    temperature_max: { type: Number },
    humidity_min: { type: Number },
    humidity_max: { type: Number },
    capacity: { type: Number, min: 0 },
    qr_code: { type: String, trim: true },
    is_locked: { type: Boolean, default: false },
    allow_controlled_drug: { type: Boolean, default: false },
    allow_quarantine: { type: Boolean, default: false },
    allow_recalled_stock: { type: Boolean, default: false },
    status: { type: String, enum: STORAGE_LOCATION_STATUSES, default: 'active', required: true },
    note: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'storage_locations' },
);

storageLocationSchema.index(
  { warehouse_id: 1, location_code: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false } },
);
storageLocationSchema.index({ warehouse_id: 1, status: 1 });
storageLocationSchema.index({ code: 1, status: 1 });
storageLocationSchema.index({ parent_id: 1, status: 1 });
storageLocationSchema.index({ location_type: 1, status: 1 });
storageLocationSchema.index({ zone: 1, shelf: 1, bin: 1 });

module.exports = model('StorageLocation', storageLocationSchema);
