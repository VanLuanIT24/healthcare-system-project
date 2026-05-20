const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const CLINICAL_OPS_SLA_EVENT_STATES = ['normal', 'warning', 'breached', 'completed'];

const clinicalOpsSlaEventSchema = new Schema(
  {
    entity_type: { type: String, required: true, trim: true },
    entity_id: { type: Schema.Types.ObjectId, required: true },
    module: { type: String, enum: ['lab', 'imaging', 'procedure'], required: true, trim: true },
    stage: { type: String, required: true, trim: true },
    priority: { type: String, trim: true },
    started_at: { type: Date, required: true },
    due_at: { type: Date, required: true },
    completed_at: { type: Date },
    breached_at: { type: Date },
    breach_minutes: { type: Number, min: 0, default: 0 },
    state: { type: String, enum: CLINICAL_OPS_SLA_EVENT_STATES, default: 'normal', required: true },
    owner_id: { type: Schema.Types.ObjectId, ref: 'User' },
    source_snapshot: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'clinical_ops_sla_events' },
);

clinicalOpsSlaEventSchema.index({ entity_type: 1, entity_id: 1, stage: 1 }, { unique: true });
clinicalOpsSlaEventSchema.index({ module: 1, state: 1, due_at: 1 });
clinicalOpsSlaEventSchema.index({ owner_id: 1, state: 1 });

module.exports = model('ClinicalOpsSlaEvent', clinicalOpsSlaEventSchema);
