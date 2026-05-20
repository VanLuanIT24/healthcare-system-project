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
    critical_low: { type: Number },
    critical_high: { type: Number },
    text_range: { type: String, trim: true },
    unit: { type: String, trim: true },
    interpretation: { type: String, trim: true },
    method: { type: String, trim: true },
    instrument: { type: String, trim: true },
    pregnancy_status: { type: String, trim: true },
    effective_from: { type: Date },
    effective_to: { type: Date },
  },
  { _id: false },
);

const resultItemTemplateSchema = new Schema(
  {
    item_code: { type: String, trim: true },
    item_name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true },
    reference_range: { type: String, trim: true },
    critical_low: { type: Number },
    critical_high: { type: Number },
    display_order: { type: Number, default: 0 },
  },
  { _id: false },
);

const labTestCatalogSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    specimen_type: { type: String, trim: true },
    specimen_type_id: { type: Schema.Types.ObjectId, ref: 'SpecimenTypeCatalog' },
    container_type: { type: String, trim: true },
    collection_instruction: { type: String, trim: true },
    unit: { type: String, trim: true },
    reference_ranges: [referenceRangeSchema],
    result_items: [resultItemTemplateSchema],
    turnaround_minutes: { type: Number, min: 1 },
    price_service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog' },
    active: { type: Boolean, default: true, required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'lab_test_catalogs' },
);

labTestCatalogSchema.index({ category: 1, active: 1 });
labTestCatalogSchema.index({ specimen_type: 1 });
labTestCatalogSchema.index({ specimen_type_id: 1 });
labTestCatalogSchema.index({ price_service_id: 1 });
labTestCatalogSchema.index({ name: 1 });

module.exports = model('LabTestCatalog', labTestCatalogSchema);
