const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const TEMPLATE_STATUSES = ['active', 'inactive', 'retired'];

const templateChecklistItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    default_note: { type: String, trim: true },
  },
  { _id: true, versionKey: false },
);

const nursingTaskTemplateSchema = new Schema(
  {
    template_code: { type: String, unique: true, sparse: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    task_type: { type: String, default: 'other', trim: true },
    title_template: { type: String, required: true, trim: true },
    description_template: { type: String, trim: true },
    default_priority: { type: String, default: 'normal', trim: true },
    default_sla_minutes: { type: Number, min: 0 },
    source_module: { type: String, default: 'manual', trim: true },
    checklist_items: [templateChecklistItemSchema],
    metadata: { type: Schema.Types.Mixed },
    status: { type: String, enum: TEMPLATE_STATUSES, default: 'active', required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'nursing_task_templates' },
);

nursingTaskTemplateSchema.index({ department_id: 1, status: 1 });
nursingTaskTemplateSchema.index({ task_type: 1, status: 1 });
nursingTaskTemplateSchema.index({ status: 1, name: 1 });

module.exports = model('NursingTaskTemplate', nursingTaskTemplateSchema);
