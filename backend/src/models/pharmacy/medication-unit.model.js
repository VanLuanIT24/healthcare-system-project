const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const MEDICATION_UNIT_TYPES = ['count', 'volume', 'mass', 'package', 'dose', 'other'];
const MEDICATION_UNIT_STATUSES = ['active', 'inactive', 'deprecated'];

const medicationUnitSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    symbol: { type: String, trim: true },
    english_name: { type: String, trim: true },
    unit_type: { type: String, enum: MEDICATION_UNIT_TYPES, default: 'count', required: true },
    allow_decimal: { type: Boolean, default: false },
    decimal_precision: { type: Number, default: 0, min: 0, max: 6 },
    is_prescribable: { type: Boolean, default: true },
    is_dispensable: { type: Boolean, default: true },
    is_inventory_unit: { type: Boolean, default: true },
    status: { type: String, enum: MEDICATION_UNIT_STATUSES, default: 'active', required: true },
    description: { type: String },
    aliases: [{ type: String, trim: true }],
    deprecated_replacement_id: { type: Schema.Types.ObjectId, ref: 'MedicationUnit' },
    deprecated_at: { type: Date },
    deprecated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'medication_units' },
);

medicationUnitSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
medicationUnitSchema.index({ name: 1, status: 1 });
medicationUnitSchema.index({ symbol: 1, status: 1 });
medicationUnitSchema.index({ unit_type: 1, status: 1 });

module.exports = model('MedicationUnit', medicationUnitSchema);
