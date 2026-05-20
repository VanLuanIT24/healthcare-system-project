const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const templateSectionSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['rich_text', 'structured_fields', 'table', 'signature', 'attachment'],
      default: 'rich_text',
    },
    required: { type: Boolean, default: false },
    default_content: { type: String },
    variables: [{ type: String, trim: true }],
    sort_order: { type: Number, default: 0 },
  },
  { _id: false },
);

const structuredFieldSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    value_type: {
      type: String,
      enum: ['text', 'number', 'boolean', 'datetime', 'select', 'multiselect', 'rich_text'],
      default: 'text',
    },
    required: { type: Boolean, default: false },
    options: [{ type: String, trim: true }],
    normal_values: { type: Schema.Types.Mixed },
    critical_values: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const resultReportTemplateSchema = new Schema(
  {
    template_code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    domain: { type: String, enum: ['lab', 'imaging', 'procedure'], required: true, index: true },
    modality: { type: String, trim: true },
    test_code: { type: String, trim: true, uppercase: true },
    procedure_code: { type: String, trim: true, uppercase: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    version: { type: Number, default: 1, min: 1 },
    status: { type: String, enum: ['draft', 'active', 'retired'], default: 'draft', required: true },
    is_default: { type: Boolean, default: false },
    sections: [templateSectionSchema],
    structured_fields: [structuredFieldSchema],
    print_layout: { type: Schema.Types.Mixed },
    patient_release_layout: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    published_by: { type: Schema.Types.ObjectId, ref: 'User' },
    published_at: { type: Date },
    retired_by: { type: Schema.Types.ObjectId, ref: 'User' },
    retired_at: { type: Date },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'result_report_templates' },
);

resultReportTemplateSchema.index({ domain: 1, status: 1, is_default: 1 });
resultReportTemplateSchema.index({ domain: 1, modality: 1, status: 1 });
resultReportTemplateSchema.index({ domain: 1, test_code: 1, status: 1 });
resultReportTemplateSchema.index({ domain: 1, procedure_code: 1, status: 1 });
resultReportTemplateSchema.index({ department_id: 1, status: 1 });

module.exports = model('ResultReportTemplate', resultReportTemplateSchema);
