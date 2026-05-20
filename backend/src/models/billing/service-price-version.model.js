const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const {
  SERVICE_PRICE_CHANGE_TYPES,
  SERVICE_PRICE_VERSION_STATUS,
  SERVICE_PRICE_VERSION_STATUSES,
} = require('../../constants/statuses');

const integerMoneyValidator = {
  validator: Number.isInteger,
  message: 'Money amount must use integer minor units.',
};

const servicePriceVersionSchema = new Schema(
  {
    service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog', required: true },
    version_code: { type: String, required: true, unique: true, trim: true },
    version_no: { type: Number, default: 1, min: 1 },
    unit_price: { type: Number, required: true, min: 0, validate: integerMoneyValidator },
    currency: { type: String, default: 'VND', trim: true, uppercase: true },
    effective_from: { type: Date, required: true },
    effective_to: { type: Date },
    status: {
      type: String,
      enum: SERVICE_PRICE_VERSION_STATUSES,
      default: SERVICE_PRICE_VERSION_STATUS.ACTIVE,
      required: true,
    },
    change_type: { type: String, enum: SERVICE_PRICE_CHANGE_TYPES, default: 'new' },
    reason: { type: String, trim: true },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    audit_logs: [{ type: Schema.Types.Mixed }],
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'service_price_versions' },
);

servicePriceVersionSchema.index({ service_id: 1, status: 1, effective_from: -1 });
servicePriceVersionSchema.index({ service_id: 1, effective_from: 1, effective_to: 1 });

module.exports = model('ServicePriceVersion', servicePriceVersionSchema);
