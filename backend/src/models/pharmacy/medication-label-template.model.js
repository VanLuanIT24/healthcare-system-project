const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const medicationLabelTemplateSchema = new Schema(
  {
    template_code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    paper_size: { type: String, default: 'label_70x45', trim: true },
    width_mm: { type: Number, default: 70, min: 1 },
    height_mm: { type: Number, default: 45, min: 1 },
    fields: { type: Schema.Types.Mixed, default: () => ({}) },
    is_default: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'medication_label_templates' },
);

medicationLabelTemplateSchema.index({ status: 1, is_default: 1 });

module.exports = model('MedicationLabelTemplate', medicationLabelTemplateSchema);
