const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { CHARGE_STATUS, CHARGE_STATUSES } = require('../../constants/statuses');

// Bảng charges: Lưu dòng phí phát sinh trước khi gom vào hóa đơn.
const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const chargeSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog' },
    price_version_id: { type: Schema.Types.ObjectId, ref: 'ServicePriceVersion' },
    price_source: { type: String, trim: true },
    base_unit_price: { type: Number, min: 0, validate: integerMoneyValidator },
    order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
    source_module: { type: String, trim: true },
    source_id: { type: Schema.Types.ObjectId },
    dispense_id: { type: Schema.Types.ObjectId, ref: 'Dispense' },
    dispense_item_id: { type: Schema.Types.ObjectId, ref: 'DispenseItem' },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster' },
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    charge_no: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 0, required: true },
    unit_price: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    discount_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    tax_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    total_amount: { type: Number, default: 0, min: 0, required: true, validate: integerMoneyValidator },
    charged_at: { type: Date, required: true },
    posted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    posted_at: { type: Date },
    billed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    billed_at: { type: Date },
    voided_by: { type: Schema.Types.ObjectId, ref: 'User' },
    voided_at: { type: Date },
    void_reason: { type: String },
    refunded_by: { type: Schema.Types.ObjectId, ref: 'User' },
    refunded_at: { type: Date },
    refund_reason: { type: String },
    review_status: {
      type: String,
      enum: ['none', 'needs_review', 'resolved', 'rejected'],
      default: 'none',
      required: true,
    },
    review_reason: { type: String, trim: true },
    review_notes: { type: String, trim: true },
    exception_codes: [{ type: String, trim: true }],
    billing_feedback: { type: String, trim: true },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    status: { type: String, enum: CHARGE_STATUSES, default: CHARGE_STATUS.PENDING, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'charges' },
);

chargeSchema.index({ patient_id: 1 });
chargeSchema.index({ encounter_id: 1 });
chargeSchema.index({ admission_id: 1 });
chargeSchema.index({ service_id: 1 });
chargeSchema.index({ price_version_id: 1 });
chargeSchema.index({ order_id: 1, status: 1 });
chargeSchema.index({ source_module: 1, source_id: 1, status: 1 });
chargeSchema.index(
  { source_module: 1, source_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      source_module: { $exists: true, $type: 'string' },
      source_id: { $exists: true },
      status: {
        $in: [
          CHARGE_STATUS.PENDING,
          CHARGE_STATUS.DRAFT,
          CHARGE_STATUS.POSTED,
          CHARGE_STATUS.BILLED,
        ],
      },
    },
  },
);
chargeSchema.index({ dispense_id: 1 });
chargeSchema.index({ dispense_item_id: 1 });
chargeSchema.index({ medication_id: 1 });
chargeSchema.index({ invoice_id: 1 });
chargeSchema.index({ charged_at: 1 });
chargeSchema.index({ status: 1 });
chargeSchema.index({ review_status: 1 });
chargeSchema.index({ billed_at: 1 });
chargeSchema.index({ patient_id: 1, charged_at: 1 });
chargeSchema.index({ charged_at: 1, status: 1 });

module.exports = model('Charge', chargeSchema);
