const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const rejectReasonSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    label: { type: String, required: true, trim: true },
    severity: { type: String, enum: ['low', 'normal', 'high', 'critical'], default: 'normal' },
    requires_recollect: { type: Boolean, default: true },
  },
  { _id: false },
);

const specimenTypeCatalogSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    description: { type: String, trim: true },
    container_type: { type: String, trim: true },
    tube_color: { type: String, trim: true },
    additive: { type: String, trim: true },
    min_volume_ml: { type: Number, min: 0 },
    max_volume_ml: { type: Number, min: 0 },
    storage_temperature: { type: String, trim: true },
    transport_max_minutes: { type: Number, min: 0 },
    stability_minutes: { type: Number, min: 0 },
    barcode_prefix: { type: String, trim: true, uppercase: true },
    label_template: { type: String, trim: true },
    reject_reasons: [rejectReasonSchema],
    disposal_policy: { type: String, trim: true },
    active: { type: Boolean, default: true, required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'specimen_type_catalogs' },
);

specimenTypeCatalogSchema.index({ active: 1, name: 1 });
specimenTypeCatalogSchema.index({ category: 1, active: 1 });
specimenTypeCatalogSchema.index({ container_type: 1 });
specimenTypeCatalogSchema.index({ barcode_prefix: 1 });

module.exports = model('SpecimenTypeCatalog', specimenTypeCatalogSchema);
