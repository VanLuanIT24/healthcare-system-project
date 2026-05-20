const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const REQUIRED_DOCUMENT_MODULES = ['lab', 'imaging', 'procedure', 'medical_record'];
const REQUIRED_DOCUMENT_ENTITY_TYPES = ['lab_result', 'imaging_order', 'imaging_report', 'procedure_order', 'medical_record'];
const REQUIRED_DOCUMENT_SEVERITIES = ['low', 'medium', 'high', 'critical'];

const requiredDocumentRuleSchema = new Schema(
  {
    module: { type: String, enum: REQUIRED_DOCUMENT_MODULES, required: true, trim: true },
    entity_type: { type: String, enum: REQUIRED_DOCUMENT_ENTITY_TYPES, required: true, trim: true },
    trigger_status: { type: String, required: true, trim: true },
    required_category: { type: String, required: true, trim: true },
    expected_file_label: { type: String, trim: true },
    required_mime_types: [{ type: String, trim: true }],
    required_before_status: { type: String, trim: true },
    sla_minutes: { type: Number, default: 60, min: 0 },
    severity: { type: String, enum: REQUIRED_DOCUMENT_SEVERITIES, default: 'medium', required: true },
    responsible_role: { type: String, trim: true },
    active: { type: Boolean, default: true, required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'required_document_rules' },
);

requiredDocumentRuleSchema.index({ module: 1, entity_type: 1, trigger_status: 1, active: 1 });
requiredDocumentRuleSchema.index({ required_category: 1, active: 1 });

module.exports = model('RequiredDocumentRule', requiredDocumentRuleSchema);
