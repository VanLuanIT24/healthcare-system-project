const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ORDER_PRIORITIES, ORDER_PRIORITY } = require('../../constants/statuses');

const CLINICAL_OPS_MODULES = ['lab', 'imaging', 'procedure'];

const clinicalOpsSlaRuleSchema = new Schema(
  {
    module: { type: String, enum: CLINICAL_OPS_MODULES, required: true, trim: true },
    stage: { type: String, required: true, trim: true },
    priority: { type: String, enum: ORDER_PRIORITIES, default: ORDER_PRIORITY.ROUTINE, required: true },
    threshold_minutes: { type: Number, min: 1, required: true },
    warning_minutes: { type: Number, min: 0, default: 15, required: true },
    active: { type: Boolean, default: true, required: true },
    description: { type: String, trim: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'clinical_ops_sla_rules' },
);

clinicalOpsSlaRuleSchema.index({ module: 1, stage: 1, priority: 1, active: 1 }, { unique: true });
clinicalOpsSlaRuleSchema.index({ active: 1 });

module.exports = model('ClinicalOpsSlaRule', clinicalOpsSlaRuleSchema);
