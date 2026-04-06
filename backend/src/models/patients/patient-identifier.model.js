const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const identifierTypes = ['mrn', 'national_id', 'passport', 'insurance_no', 'external_system_id'];

const patientIdentifierSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    identifier_type: { type: String, enum: identifierTypes, required: true },
    identifier_value: { type: String, required: true, trim: true },
    issued_by: { type: String, trim: true },
    valid_from: { type: Date },
    valid_to: { type: Date },
    is_primary: { type: Boolean, default: false, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'patient_identifiers' },
);

patientIdentifierSchema.index({ identifier_type: 1, identifier_value: 1 }, { unique: true });
patientIdentifierSchema.index({ patient_id: 1 });
patientIdentifierSchema.index({ patient_id: 1, is_primary: 1 });

module.exports = model('PatientIdentifier', patientIdentifierSchema);
