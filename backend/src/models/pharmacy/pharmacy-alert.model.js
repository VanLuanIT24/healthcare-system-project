const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const PHARMACY_ALERT_TYPES = [
  'low_stock',
  'out_of_stock',
  'near_expiry',
  'batch_expiring',
  'expired',
  'batch_expired',
  'recalled',
  'recall',
  'quarantined',
  'quarantine',
  'insufficient_stock',
  'dispense_shortage',
  'allergy',
  'allergy_conflict',
  'medication_reaction',
  'interaction',
  'duplicate_medication',
  'high_usage',
  'waste',
  'waste_loss',
  'dispense_sla_breached',
  'verification_sla_breached',
];

const PHARMACY_ALERT_SEVERITIES = ['critical', 'high', 'medium', 'low'];
const PHARMACY_ALERT_STATUSES = [
  'new',
  'open',
  'acknowledged',
  'assigned',
  'in_progress',
  'snoozed',
  'resolved',
  'dismissed',
  'escalated',
];

const pharmacyAlertSchema = new Schema(
  {
    alert_code: { type: String, required: true, unique: true, trim: true },
    alert_type: { type: String, enum: PHARMACY_ALERT_TYPES, required: true },
    severity: { type: String, enum: PHARMACY_ALERT_SEVERITIES, default: 'medium', required: true },
    status: { type: String, enum: PHARMACY_ALERT_STATUSES, default: 'open', required: true },
    source_type: { type: String, trim: true },
    source_module: { type: String, trim: true },
    source_id: { type: Schema.Types.ObjectId },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster' },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    prescription_item_id: { type: Schema.Types.ObjectId, ref: 'PrescriptionItem' },
    dispense_id: { type: Schema.Types.ObjectId, ref: 'Dispense' },
    dispense_item_id: { type: Schema.Types.ObjectId, ref: 'DispenseItem' },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true },
    reason_code: { type: String, trim: true },
    detected_at: { type: Date, default: Date.now },
    due_at: { type: Date },
    dedupe_key: { type: String, trim: true },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledged_at: { type: Date },
    snoozed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    snoozed_until: { type: Date },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    resolution_note: { type: String },
    metrics: {
      quantity_on_hand: { type: Number },
      total_on_hand: { type: Number },
      available_on_hand: { type: Number },
      blocked_on_hand: { type: Number },
      min_stock_level: { type: Number },
      shortage_quantity: { type: Number },
      pending_demand: { type: Number },
      days_to_expiry: { type: Number },
      days_of_stock_left: { type: Number },
      value_at_risk: { type: Number },
      usage_today: { type: Number },
      usage_7d: { type: Number },
      usage_30d: { type: Number },
      avg_daily_usage_7d: { type: Number },
      avg_daily_usage_30d: { type: Number },
      usage_ratio: { type: Number },
      anomaly_score: { type: Number },
    },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'pharmacy_alerts' },
);

pharmacyAlertSchema.index({ status: 1, severity: 1, created_at: -1 });
pharmacyAlertSchema.index({ alert_type: 1, status: 1 });
pharmacyAlertSchema.index({ medication_id: 1, status: 1 });
pharmacyAlertSchema.index({ stock_batch_id: 1, status: 1 });
pharmacyAlertSchema.index({ prescription_id: 1, status: 1 });
pharmacyAlertSchema.index({ prescription_item_id: 1, status: 1 });
pharmacyAlertSchema.index({ dispense_id: 1, status: 1 });
pharmacyAlertSchema.index({ patient_id: 1, status: 1 });
pharmacyAlertSchema.index({ assigned_to: 1, status: 1 });
pharmacyAlertSchema.index({ due_at: 1, status: 1 });
pharmacyAlertSchema.index({ snoozed_until: 1, status: 1 });
pharmacyAlertSchema.index(
  { dedupe_key: 1 },
  { unique: true, sparse: true },
);

module.exports = model('PharmacyAlert', pharmacyAlertSchema);
