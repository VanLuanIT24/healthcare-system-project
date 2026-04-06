const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const medicationStatuses = ['active', 'inactive', 'recalled', 'discontinued'];

const medicationMasterSchema = new Schema(
  {
    medication_code: { type: String, required: true, unique: true, trim: true },
    generic_name: { type: String, required: true, trim: true },
    brand_name: { type: String, trim: true },
    dosage_form: { type: String, trim: true },
    strength: { type: String, trim: true },
    route_default: { type: String, trim: true },
    unit: { type: String, trim: true },
    status: { type: String, enum: medicationStatuses, default: 'active', required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'medication_master' },
);

medicationMasterSchema.index({ generic_name: 1 });
medicationMasterSchema.index({ brand_name: 1 });
medicationMasterSchema.index({ dosage_form: 1 });
medicationMasterSchema.index({ status: 1 });
medicationMasterSchema.index({ generic_name: 1, strength: 1, dosage_form: 1 });

module.exports = model('MedicationMaster', medicationMasterSchema);
