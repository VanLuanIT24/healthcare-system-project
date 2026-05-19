const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { IMAGING_MODALITIES } = require('../../constants/statuses');

const PREPARATION_TEMPLATE_SOURCE_TYPES = [
  'pre_exam',
  'lab',
  'imaging',
  'procedure',
  'service',
  'nursing',
  'other',
];

const PREPARATION_CHECKLIST_CATEGORIES = [
  'identity',
  'clinical',
  'safety',
  'document',
  'instruction',
  'specimen',
  'imaging_safety',
  'procedure_safety',
  'material',
  'handoff',
];

const PREPARATION_VALUE_TYPES = ['boolean', 'text', 'number', 'datetime', 'select', 'file', 'signature'];

const templateItemSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, enum: PREPARATION_CHECKLIST_CATEGORIES },
    required: { type: Boolean, default: false },
    critical: { type: Boolean, default: false },
    value_type: { type: String, enum: PREPARATION_VALUE_TYPES, default: 'boolean' },
    options: [{ type: String, trim: true }],
    default_value: { type: Schema.Types.Mixed },
    help_text: { type: String, trim: true },
    visible_when: { type: Schema.Types.Mixed },
    sort_order: { type: Number, default: 0 },
  },
  { _id: false },
);

const preparationChecklistTemplateSchema = new Schema(
  {
    template_code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    source_type: { type: String, enum: PREPARATION_TEMPLATE_SOURCE_TYPES, required: true },

    order_type: { type: String, trim: true },
    modality: { type: String, enum: IMAGING_MODALITIES },
    procedure_code: { type: String, trim: true },
    test_code: { type: String, trim: true },
    specimen_type: { type: String, trim: true },
    service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },

    version: { type: Number, default: 1, min: 1 },
    is_default: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    items: [templateItemSchema],

    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'preparation_checklist_templates' },
);

preparationChecklistTemplateSchema.index({ source_type: 1, is_active: 1, is_default: 1 });
preparationChecklistTemplateSchema.index({ source_type: 1, modality: 1, is_active: 1 });
preparationChecklistTemplateSchema.index({ source_type: 1, procedure_code: 1, is_active: 1 });
preparationChecklistTemplateSchema.index({ source_type: 1, test_code: 1, specimen_type: 1, is_active: 1 });
preparationChecklistTemplateSchema.index({ service_id: 1, is_active: 1 });
preparationChecklistTemplateSchema.index({ department_id: 1, is_active: 1 });

module.exports = model('PreparationChecklistTemplate', preparationChecklistTemplateSchema);
