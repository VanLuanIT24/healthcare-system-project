const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { DOCTOR_PROFILE_STATUS, DOCTOR_PROFILE_STATUSES } = require('../../constants/statuses');

// Bảng doctor_profiles: Lưu hồ sơ chuyên môn, giấy phép và thông tin hiển thị của bác sĩ.

const doctorProfileSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    license_number: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true },
    subspecialty: { type: String, trim: true },
    qualification: { type: String, trim: true },
    academic_title: { type: String, trim: true },
    years_of_experience: { type: Number, min: 0 },
    consultation_duration_minutes: { type: Number, min: 5, default: 15 },
    consultation_fee: { type: Number, min: 0 },
    avatar_url: { type: String, trim: true },
    biography: { type: String },
    languages: [{ type: String, trim: true }],
    public_profile_enabled: { type: Boolean, default: true, required: true },
    status: { type: String, enum: DOCTOR_PROFILE_STATUSES, default: DOCTOR_PROFILE_STATUS.ACTIVE, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'doctor_profiles' },
);

doctorProfileSchema.index({ user_id: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
doctorProfileSchema.index({ license_number: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
doctorProfileSchema.index({ department_id: 1 });
doctorProfileSchema.index({ specialty: 1 });
doctorProfileSchema.index({ status: 1 });
doctorProfileSchema.index({ department_id: 1, specialty: 1 });

module.exports = model('DoctorProfile', doctorProfileSchema);
