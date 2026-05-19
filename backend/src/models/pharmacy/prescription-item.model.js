const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { PRESCRIPTION_ITEM_STATUS, PRESCRIPTION_ITEM_STATUSES } = require('../../constants/statuses');

// Bảng prescription_items: Lưu từng thuốc trong đơn, liều dùng, số lượng và hướng dẫn dùng thuốc.

const prescriptionItemSchema = new Schema(
  {
    prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription', required: true },
    medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster', required: true },
    dose: { type: String, trim: true },
    frequency: { type: String, trim: true },
    route: { type: String, trim: true },
    route_id: { type: Schema.Types.ObjectId, ref: 'AdministrationRoute' },
    duration_days: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    dispensed_quantity: { type: Number, default: 0, min: 0, required: true },
    instructions: { type: String },
    status: { type: String, enum: PRESCRIPTION_ITEM_STATUSES, default: PRESCRIPTION_ITEM_STATUS.ACTIVE, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'prescription_items' },
);

prescriptionItemSchema.index({ prescription_id: 1 });
prescriptionItemSchema.index({ medication_id: 1 });
prescriptionItemSchema.index({ route_id: 1 });
prescriptionItemSchema.index({ status: 1 });
prescriptionItemSchema.index(
  { prescription_id: 1, medication_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          PRESCRIPTION_ITEM_STATUS.ACTIVE,
          PRESCRIPTION_ITEM_STATUS.HELD,
          PRESCRIPTION_ITEM_STATUS.COMPLETED,
        ],
      },
    },
  },
);

module.exports = model('PrescriptionItem', prescriptionItemSchema);
