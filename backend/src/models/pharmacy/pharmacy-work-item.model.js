const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const PHARMACY_WORK_ITEM_TYPES = [
  'prescription_verification',
  'clinical_review',
  'dispense_waiting',
  'dispense_preparing',
  'stock_shortage',
  'near_expiry_batch',
  'expired_batch',
  'return_dispense',
  'refill_request',
];

const PHARMACY_WORK_ITEM_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const PHARMACY_WORK_ITEM_STATUSES = ['open', 'assigned', 'in_progress', 'on_hold', 'resolved', 'cancelled'];

const riskFlagsSchema = new Schema(
  {
    allergy: { type: Boolean, default: false },
    interaction: { type: Boolean, default: false },
    duplicate: { type: Boolean, default: false },
    insufficient_stock: { type: Boolean, default: false },
    near_expiry: { type: Boolean, default: false },
    expired: { type: Boolean, default: false },
    recalled: { type: Boolean, default: false },
  },
  { _id: false },
);

const pharmacyWorkItemSchema = new Schema(
  {
    work_item_code: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: PHARMACY_WORK_ITEM_TYPES, required: true },
    priority: { type: String, enum: PHARMACY_WORK_ITEM_PRIORITIES, default: 'medium', required: true },
    status: { type: String, enum: PHARMACY_WORK_ITEM_STATUSES, default: 'open', required: true },
    source_type: { type: String, trim: true },
    source_id: { type: Schema.Types.ObjectId },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    dispense_id: { type: Schema.Types.ObjectId, ref: 'Dispense' },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster' },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    assigned_at: { type: Date },
    due_at: { type: Date },
    sla_minutes: { type: Number, min: 0 },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    risk_flags: { type: riskFlagsSchema, default: () => ({}) },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'pharmacy_work_items' },
);

pharmacyWorkItemSchema.index({ status: 1, priority: 1, due_at: 1 });
pharmacyWorkItemSchema.index({ type: 1, status: 1 });
pharmacyWorkItemSchema.index({ assigned_to: 1, status: 1 });
pharmacyWorkItemSchema.index({ prescription_id: 1, status: 1 });
pharmacyWorkItemSchema.index({ dispense_id: 1, status: 1 });
pharmacyWorkItemSchema.index({ stock_batch_id: 1, status: 1 });

module.exports = model('PharmacyWorkItem', pharmacyWorkItemSchema);
