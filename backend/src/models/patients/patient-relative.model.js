const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, optionalString, softDeleteFields } = require('../common/base-model');
const { RELATIVE_STATUS, RELATIVE_STATUSES } = require('../../constants/statuses');

// Bảng patient_relatives: Lưu thông tin người nhà, người liên hệ và liên hệ khẩn cấp của bệnh nhân.

const patientRelativeSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    full_name: { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, set: optionalString },
    email: { type: String, lowercase: true, trim: true, set: optionalString },
    national_id: { type: String, trim: true, set: optionalString },
    address: { type: String },
    is_emergency_contact: { type: Boolean, default: false, required: true },
    is_primary_contact: { type: Boolean, default: false, required: true },
    relationship_verified: { type: Boolean, default: false, required: true },
    verified_by: { type: Schema.Types.ObjectId, ref: 'User' },
    verified_at: { type: Date },
    status: { type: String, enum: RELATIVE_STATUSES, default: RELATIVE_STATUS.ACTIVE, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'patient_relatives' },
);

patientRelativeSchema.index({ patient_id: 1 });
patientRelativeSchema.index({ full_name: 1 });
patientRelativeSchema.index({ phone: 1 });
patientRelativeSchema.index({ patient_id: 1, relationship: 1 });
patientRelativeSchema.index({ patient_id: 1, is_emergency_contact: 1 });
patientRelativeSchema.index({ patient_id: 1, relationship_verified: 1 });

module.exports = model('PatientRelative', patientRelativeSchema);
