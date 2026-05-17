const { model } = require('mongoose');
const { baseSchemaOptions, auditFields, optionalString, softDeleteFields, Schema } = require('../common/base-model');
const { GENDER, GENDERS, PATIENT_STATUS, PATIENT_STATUSES } = require('../../constants/statuses');

// Bảng patients: Lưu hồ sơ hành chính và thông tin định danh chính của bệnh nhân.

const patientSchema = new Schema(
  {
    patient_code: { type: String, required: true, trim: true },
    full_name: { type: String, required: true, trim: true },
    date_of_birth: { type: Date },
    gender: { type: String, enum: GENDERS, default: GENDER.UNKNOWN },
    phone: { type: String, trim: true, set: optionalString },
    email: { type: String, lowercase: true, trim: true, set: optionalString },
    address: { type: String },
    national_id: { type: String, trim: true, set: optionalString },
    insurance_number: { type: String, trim: true, set: optionalString },
    identity_verified_at: { type: Date },
    identity_verified_by: { type: Schema.Types.ObjectId, ref: 'User' },
    emergency_contact_name: { type: String, trim: true },
    emergency_contact_phone: { type: String, trim: true },
    status: { type: String, enum: PATIENT_STATUSES, default: PATIENT_STATUS.ACTIVE, required: true },
    merged_into_patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    merged_at: { type: Date },
    merged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    merge_reason: { type: String },
    archived_at: { type: Date },
    archived_by: { type: Schema.Types.ObjectId, ref: 'User' },
    archive_reason: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'patients' },
);

patientSchema.index({ patient_code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
patientSchema.index({ full_name: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index(
  { national_id: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false, national_id: { $type: 'string' } } },
);
patientSchema.index(
  { insurance_number: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false, insurance_number: { $type: 'string' } } },
);
patientSchema.index({ status: 1 });
patientSchema.index({ created_at: 1 });
patientSchema.index({ full_name: 1, date_of_birth: 1 });
patientSchema.index({ merged_into_patient_id: 1 });

module.exports = model('Patient', patientSchema);
