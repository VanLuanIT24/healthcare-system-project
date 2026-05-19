const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const DISPENSE_HOLD_TYPES = [
  'insufficient_stock',
  'allergy_risk',
  'interaction_risk',
  'duplicate_medication',
  'waiting_payment',
  'doctor_clarification',
  'patient_refused',
  'batch_recall',
  'batch_quarantine',
  'controlled_drug_policy',
  'other',
];

const DISPENSE_HOLD_SEVERITIES = ['critical', 'high', 'medium', 'low'];
const DISPENSE_HOLD_STATUSES = ['active', 'resolved', 'cancelled', 'rejected'];
const DISPENSE_HOLD_RESOLUTION_TYPES = [
  'continue_dispense',
  'partial_dispense',
  'substituted',
  'doctor_confirmed',
  'patient_cancelled',
  'stock_replenished',
  'rejected',
  'cancelled',
];

const dispenseHoldSchema = new Schema(
  {
    hold_no: { type: String, required: true, unique: true, trim: true },
    dispense_id: { type: Schema.Types.ObjectId, ref: 'Dispense', required: true },
    prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription', required: true },
    prescription_item_id: { type: Schema.Types.ObjectId, ref: 'PrescriptionItem' },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster' },
    hold_type: { type: String, enum: DISPENSE_HOLD_TYPES, default: 'other', required: true },
    severity: { type: String, enum: DISPENSE_HOLD_SEVERITIES, default: 'medium', required: true },
    reason: { type: String, required: true, trim: true },
    note: { type: String },
    status: { type: String, enum: DISPENSE_HOLD_STATUSES, default: 'active', required: true },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    due_at: { type: Date },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    resolution_type: { type: String, enum: DISPENSE_HOLD_RESOLUTION_TYPES },
    resolution_note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'dispense_holds' },
);

dispenseHoldSchema.index({ status: 1, severity: 1, due_at: 1 });
dispenseHoldSchema.index({ hold_type: 1, status: 1 });
dispenseHoldSchema.index({ dispense_id: 1, status: 1 });
dispenseHoldSchema.index({ prescription_id: 1, status: 1 });
dispenseHoldSchema.index({ patient_id: 1, status: 1 });
dispenseHoldSchema.index({ medication_id: 1, status: 1 });
dispenseHoldSchema.index({ assigned_to: 1, status: 1 });

module.exports = model('DispenseHold', dispenseHoldSchema);
