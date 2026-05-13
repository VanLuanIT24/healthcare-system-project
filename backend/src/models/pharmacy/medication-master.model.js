const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { MEDICATION_STATUS, MEDICATION_STATUSES } = require('../../constants/statuses');

// Bảng medication_master: Lưu danh mục thuốc, hoạt chất, dạng dùng và trạng thái lưu hành.
const optionalIntegerMoneyValidator = {
  validator(value) {
    return value === undefined || value === null || Number.isInteger(value);
  },
  message: 'Money amount must use integer minor units.',
};

const medicationMasterSchema = new Schema(
  {
    medication_code: { type: String, required: true, trim: true },
    generic_name: { type: String, required: true, trim: true },
    brand_name: { type: String, trim: true },
    dosage_form: { type: String, trim: true },
    strength: { type: String, trim: true },
    route_default: { type: String, trim: true },
    unit: { type: String, trim: true },
    service_id: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog' },
    sale_price: { type: Number, min: 0, validate: optionalIntegerMoneyValidator },
    min_stock_level: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: MEDICATION_STATUSES, default: MEDICATION_STATUS.ACTIVE, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'medication_master' },
);

medicationMasterSchema.index({ medication_code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
medicationMasterSchema.index({ generic_name: 1 });
medicationMasterSchema.index({ brand_name: 1 });
medicationMasterSchema.index({ dosage_form: 1 });
medicationMasterSchema.index({ service_id: 1 });
medicationMasterSchema.index({ status: 1 });
medicationMasterSchema.index({ generic_name: 1, strength: 1, dosage_form: 1 });

module.exports = model('MedicationMaster', medicationMasterSchema);
