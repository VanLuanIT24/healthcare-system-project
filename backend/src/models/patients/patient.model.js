const { model } = require('mongoose');
const { baseSchemaOptions, auditFields, softDeleteFields, Schema } = require('../common/base-model');

const genders = ['male', 'female', 'other', 'unknown'];
const patientStatuses = ['active', 'inactive', 'deceased', 'merged', 'archived'];

const patientSchema = new Schema(
  {
    patient_code: { type: String, required: true, unique: true, trim: true },
    full_name: { type: String, required: true, trim: true },
    date_of_birth: { type: Date },
    gender: { type: String, enum: genders, default: 'unknown' },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String },
    national_id: { type: String, trim: true },
    insurance_number: { type: String, trim: true },
    emergency_contact_name: { type: String, trim: true },
    emergency_contact_phone: { type: String, trim: true },
    status: { type: String, enum: patientStatuses, default: 'active', required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'patients' },
);

patientSchema.index({ full_name: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ national_id: 1 });
patientSchema.index({ insurance_number: 1 });
patientSchema.index({ status: 1 });
patientSchema.index({ created_at: 1 });
patientSchema.index({ full_name: 1, date_of_birth: 1 });

module.exports = model('Patient', patientSchema);
