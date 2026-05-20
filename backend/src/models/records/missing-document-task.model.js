const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const MISSING_DOCUMENT_MODULES = ['lab', 'imaging', 'procedure', 'medical_record'];
const MISSING_DOCUMENT_STATUSES = ['open', 'resolved', 'waived', 'overdue'];
const MISSING_DOCUMENT_SEVERITIES = ['low', 'medium', 'high', 'critical'];

const missingDocumentTaskSchema = new Schema(
  {
    module: { type: String, enum: MISSING_DOCUMENT_MODULES, required: true, trim: true },
    entity_type: { type: String, required: true, trim: true },
    entity_id: { type: Schema.Types.ObjectId, required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
    rule_id: { type: Schema.Types.ObjectId, ref: 'RequiredDocumentRule' },

    required_category: { type: String, required: true, trim: true },
    expected_file_label: { type: String, trim: true },
    entity_code: { type: String, trim: true },
    entity_title: { type: String, trim: true },
    trigger_status: { type: String, trim: true },

    severity: { type: String, enum: MISSING_DOCUMENT_SEVERITIES, default: 'medium', required: true },
    status: { type: String, enum: MISSING_DOCUMENT_STATUSES, default: 'open', required: true },
    responsible_role: { type: String, trim: true },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    due_at: { type: Date },

    resolved_at: { type: Date },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_attachment_id: { type: Schema.Types.ObjectId, ref: 'Attachment' },

    waived_by: { type: Schema.Types.ObjectId, ref: 'User' },
    waived_at: { type: Date },
    waive_reason: { type: String },
    last_checked_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'missing_document_tasks' },
);

missingDocumentTaskSchema.index({ module: 1, status: 1, due_at: 1 });
missingDocumentTaskSchema.index({ entity_type: 1, entity_id: 1, required_category: 1, status: 1 });
missingDocumentTaskSchema.index({ patient_id: 1, status: 1, due_at: 1 });
missingDocumentTaskSchema.index({ assigned_to: 1, status: 1 });

module.exports = model('MissingDocumentTask', missingDocumentTaskSchema);
