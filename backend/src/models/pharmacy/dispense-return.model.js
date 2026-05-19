const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const DISPENSE_RETURN_STATUSES = ['requested', 'approved', 'completed', 'cancelled'];

const dispenseReturnSchema = new Schema(
  {
    dispense_id: { type: Schema.Types.ObjectId, ref: 'Dispense', required: true },
    return_no: { type: String, required: true, unique: true, trim: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: DISPENSE_RETURN_STATUSES, default: 'requested', required: true },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User' },
    requested_at: { type: Date },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    completed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    completed_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'dispense_returns' },
);

dispenseReturnSchema.index({ dispense_id: 1, status: 1 });
dispenseReturnSchema.index({ patient_id: 1, requested_at: -1 });
dispenseReturnSchema.index({ encounter_id: 1 });
dispenseReturnSchema.index({ status: 1, requested_at: -1 });

module.exports = model('DispenseReturn', dispenseReturnSchema);
