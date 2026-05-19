const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const clinicalAlertRuleSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    source_type: { type: String, required: true, trim: true },
    condition: { type: Schema.Types.Mixed, required: true },
    severity: { type: String, enum: ['info', 'warning', 'high', 'critical'], default: 'warning', required: true },
    title_template: { type: String, required: true, trim: true },
    message_template: { type: String, required: true },
    suggested_action: { type: String, trim: true },
    enabled: { type: Boolean, default: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'clinical_alert_rules' },
);

clinicalAlertRuleSchema.index({ source_type: 1, enabled: 1 });
clinicalAlertRuleSchema.index({ department_id: 1, enabled: 1 });

module.exports = model('ClinicalAlertRule', clinicalAlertRuleSchema);
