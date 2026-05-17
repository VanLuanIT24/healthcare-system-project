const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

// Bảng lab_test_catalogs: Danh mục xét nghiệm, specimen, unit, reference ranges và service giá.

const referenceRangeSchema = new Schema(
  {
    gender: { type: String, trim: true },
    age_min: { type: Number, min: 0 },
    age_max: { type: Number, min: 0 },
    min: { type: Number },
    max: { type: Number },
    unit: { type: String, trim: true },
  },
  { _id: false },
);

const labTestCatalogSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    specimen_type: { type: String, trim: true },
    unit: { type: String, trim: true },
    reference_ranges: [referenceRangeSchema],
    price_service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog' },
    active: { type: Boolean, default: true, required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'lab_test_catalogs' },
);

labTestCatalogSchema.index({ category: 1, active: 1 });
labTestCatalogSchema.index({ specimen_type: 1 });
labTestCatalogSchema.index({ price_service_id: 1 });
labTestCatalogSchema.index({ name: 1 });

module.exports = model('LabTestCatalog', labTestCatalogSchema);
