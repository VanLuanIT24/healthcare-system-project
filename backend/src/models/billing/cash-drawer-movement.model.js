const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const CASH_DRAWER_MOVEMENT_TYPE = {
  CASH_IN: 'cash_in',
  CASH_OUT: 'cash_out',
  ADJUSTMENT: 'adjustment',
};

const cashDrawerMovementSchema = new Schema(
  {
    shift_id: { type: Schema.Types.ObjectId, ref: 'CashierShift', required: true },
    cashier_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    counter_id: { type: String, trim: true },
    type: { type: String, enum: Object.values(CASH_DRAWER_MOVEMENT_TYPE), required: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true },
    occurred_at: { type: Date, default: Date.now, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'cash_drawer_movements' },
);

cashDrawerMovementSchema.index({ shift_id: 1, occurred_at: -1 });
cashDrawerMovementSchema.index({ cashier_id: 1, occurred_at: -1 });

module.exports = model('CashDrawerMovement', cashDrawerMovementSchema);
module.exports.CASH_DRAWER_MOVEMENT_TYPE = CASH_DRAWER_MOVEMENT_TYPE;
