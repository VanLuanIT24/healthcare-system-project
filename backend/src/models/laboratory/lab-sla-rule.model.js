const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ORDER_PRIORITY, ORDER_PRIORITIES } = require('../../constants/statuses');

const labSlaRuleSchema = new Schema(
  {
    test_code: { type: String, trim: true, uppercase: true },
    category: { type: String, trim: true },
    priority: { type: String, enum: ORDER_PRIORITIES, default: ORDER_PRIORITY.ROUTINE, required: true },
    collect_due_minutes: { type: Number, min: 1, default: 120 },
    receive_due_minutes: { type: Number, min: 1, default: 180 },
    process_due_minutes: { type: Number, min: 1, default: 240 },
    result_due_minutes: { type: Number, min: 1, default: 360 },
    approval_due_minutes: { type: Number, min: 1, default: 480 },
    critical_ack_due_minutes: { type: Number, min: 1, default: 15 },
    active: { type: Boolean, default: true, required: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'lab_sla_rules' },
);

labSlaRuleSchema.index({ test_code: 1, priority: 1, active: 1 });
labSlaRuleSchema.index({ category: 1, priority: 1, active: 1 });
labSlaRuleSchema.index({ active: 1, priority: 1 });

module.exports = model('LabSlaRule', labSlaRuleSchema);
