const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const CONTROLLED_LEDGER_ACTION_TYPES = ['receive', 'dispense', 'return', 'waste', 'adjustment', 'transfer', 'count', 'double_check', 'waste_approval'];

const controlledDrugLedgerSchema = new Schema(
  {
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    stock_batch_id: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
    transaction_id: { type: Schema.Types.ObjectId, ref: 'InventoryTransaction' },
    prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    dispense_id: { type: Schema.Types.ObjectId, ref: 'Dispense' },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    action_type: { type: String, enum: CONTROLLED_LEDGER_ACTION_TYPES, required: true },
    quantity: { type: Number, default: 0, min: 0 },
    balance_after: { type: Number, min: 0 },
    performed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    witnessed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, trim: true },
    occurred_at: { type: Date, default: Date.now, required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'controlled_drug_ledgers' },
);

controlledDrugLedgerSchema.index({ medication_id: 1, occurred_at: -1 });
controlledDrugLedgerSchema.index({ stock_batch_id: 1, occurred_at: -1 });
controlledDrugLedgerSchema.index({ transaction_id: 1 });
controlledDrugLedgerSchema.index({ action_type: 1, occurred_at: -1 });
controlledDrugLedgerSchema.index({ performed_by: 1, occurred_at: -1 });

module.exports = model('ControlledDrugLedger', controlledDrugLedgerSchema);
