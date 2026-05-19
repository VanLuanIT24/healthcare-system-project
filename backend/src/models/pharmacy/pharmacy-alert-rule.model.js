const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const PHARMACY_ALERT_RULE_SCOPE_TYPES = ['global', 'medication', 'storage_location', 'supplier', 'warehouse', 'location', 'controlled_drug'];

const pharmacyAlertRuleSchema = new Schema(
  {
    rule_code: { type: String, required: true, unique: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    name: { type: String, trim: true },
    alert_type: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true, required: true },
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'active' },
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium', required: true },
    scope_type: { type: String, enum: PHARMACY_ALERT_RULE_SCOPE_TYPES, default: 'global', required: true },
    scope_id: { type: Schema.Types.ObjectId },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster' },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    storage_location_id: { type: Schema.Types.ObjectId, ref: 'StorageLocation' },
    supplier_id: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    storage_location: { type: String, trim: true },
    supplier_name: { type: String, trim: true },
    condition_operator: { type: String, enum: ['lte', 'lt', 'eq', 'gte', 'gt'], default: 'lte' },
    threshold_value: { type: Number, min: 0 },
    threshold_unit: { type: String, enum: ['quantity', 'day', 'percent'], default: 'quantity' },
    threshold_quantity: { type: Number, min: 0 },
    threshold_days: { type: Number, min: 0 },
    threshold_ratio: { type: Number, min: 0 },
    window_days: { type: Number, min: 1 },
    sla_minutes: { type: Number, min: 0 },
    recipient_roles: [{ type: String, trim: true }],
    notify_roles: [{ type: String, trim: true }],
    notify_users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    channels: [{ type: String, enum: ['in_app', 'realtime', 'email', 'sms'] }],
    is_realtime_enabled: { type: Boolean, default: true },
    is_email_enabled: { type: Boolean, default: false },
    cooldown_minutes: { type: Number, default: 60, min: 0 },
    auto_create_alert: { type: Boolean, default: true },
    auto_resolve: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'pharmacy_alert_rules' },
);

pharmacyAlertRuleSchema.index({ alert_type: 1, enabled: 1 });
pharmacyAlertRuleSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false, code: { $exists: true, $type: 'string' } } },
);
pharmacyAlertRuleSchema.index({ status: 1, enabled: 1 });
pharmacyAlertRuleSchema.index({ scope_type: 1, enabled: 1 });
pharmacyAlertRuleSchema.index({ medication_id: 1, enabled: 1 });
pharmacyAlertRuleSchema.index({ storage_location: 1, enabled: 1 });
pharmacyAlertRuleSchema.index({ supplier_name: 1, enabled: 1 });

module.exports = model('PharmacyAlertRule', pharmacyAlertRuleSchema);
