const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const CLINICAL_OPS_ESCALATION_ENTITY_TYPES = [
  'order',
  'lab_order',
  'imaging_order',
  'procedure_order',
  'lab_result',
  'imaging_report',
];

const CLINICAL_OPS_ESCALATION_STATUS = {
  OPEN: 'open',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
};

const clinicalOpsEscalationSchema = new Schema(
  {
    entity_type: { type: String, enum: CLINICAL_OPS_ESCALATION_ENTITY_TYPES, required: true, trim: true },
    entity_id: { type: Schema.Types.ObjectId, required: true },
    module: { type: String, enum: ['lab', 'imaging', 'procedure', 'orders'], required: true, trim: true },
    escalation_level: { type: Number, min: 1, max: 5, default: 1, required: true },
    reason: { type: String, required: true, trim: true },
    note: { type: String },
    escalated_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    escalated_to: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    escalated_at: { type: Date, default: Date.now, required: true },
    acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledged_at: { type: Date },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    dismissed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    dismissed_at: { type: Date },
    status: {
      type: String,
      enum: Object.values(CLINICAL_OPS_ESCALATION_STATUS),
      default: CLINICAL_OPS_ESCALATION_STATUS.OPEN,
      required: true,
    },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'clinical_ops_escalations' },
);

clinicalOpsEscalationSchema.index({ entity_type: 1, entity_id: 1, status: 1 });
clinicalOpsEscalationSchema.index({ module: 1, status: 1, escalated_at: -1 });
clinicalOpsEscalationSchema.index({ escalated_by: 1, escalated_at: -1 });
clinicalOpsEscalationSchema.index({ escalated_to: 1, status: 1 });

module.exports = model('ClinicalOpsEscalation', clinicalOpsEscalationSchema);
