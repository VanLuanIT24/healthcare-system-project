const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const CASHIER_SHIFT_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  RECONCILED: 'reconciled',
};

const cashierShiftSchema = new Schema(
  {
    cashier_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    counter_id: { type: String, trim: true },
    counter_code: { type: String, trim: true },
    shift_code: { type: String, required: true, unique: true, trim: true },
    opened_at: { type: Date, required: true },
    closed_at: { type: Date },
    opening_cash_amount: { type: Number, default: 0, min: 0 },
    closing_cash_expected: { type: Number, default: 0, min: 0 },
    closing_cash_actual: { type: Number, min: 0 },
    difference_amount: { type: Number, default: 0 },
    status: { type: String, enum: Object.values(CASHIER_SHIFT_STATUS), default: CASHIER_SHIFT_STATUS.OPEN, required: true },
    note: { type: String },
    opened_by: { type: Schema.Types.ObjectId, ref: 'User' },
    closed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'cashier_shifts' },
);

cashierShiftSchema.index({ cashier_id: 1, status: 1 });
cashierShiftSchema.index({ opened_at: -1 });
cashierShiftSchema.index({ counter_code: 1, status: 1 });

module.exports = model('CashierShift', cashierShiftSchema);
module.exports.CASHIER_SHIFT_STATUS = CASHIER_SHIFT_STATUS;
