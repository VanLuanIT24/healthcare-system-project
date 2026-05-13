const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { MEDICAL_RECORD_STATUS, MEDICAL_RECORD_STATUSES, RECORD_TYPES } = require('../../constants/statuses');

// Bảng medical_records: Lưu hồ sơ bệnh án tổng hợp, loại hồ sơ và trạng thái lưu trữ/niêm phong.

const medicalRecordSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    admission_id: { type: Schema.Types.ObjectId, ref: 'Admission' },
    custodian_department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    record_no: { type: String, required: true, unique: true, trim: true },
    record_type: { type: String, enum: RECORD_TYPES, required: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String },
    opened_at: { type: Date },
    closed_at: { type: Date },
    finalized_by: { type: Schema.Types.ObjectId, ref: 'User' },
    finalized_at: { type: Date },
    sealed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    sealed_at: { type: Date },
    archived_by: { type: Schema.Types.ObjectId, ref: 'User' },
    archived_at: { type: Date },
    archive_reason: { type: String },
    voided_by: { type: Schema.Types.ObjectId, ref: 'User' },
    voided_at: { type: Date },
    void_reason: { type: String },
    released_to_patient: { type: Boolean, default: false },
    released_at: { type: Date },
    released_by: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: MEDICAL_RECORD_STATUSES, default: MEDICAL_RECORD_STATUS.ACTIVE, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'medical_records' },
);

medicalRecordSchema.index({ patient_id: 1 });
medicalRecordSchema.index({ encounter_id: 1 }, { unique: true, sparse: true });
medicalRecordSchema.index({ admission_id: 1 });
medicalRecordSchema.index({ custodian_department_id: 1 });
medicalRecordSchema.index({ record_type: 1 });
medicalRecordSchema.index({ opened_at: 1 });
medicalRecordSchema.index({ status: 1 });
medicalRecordSchema.index({ released_to_patient: 1 });
medicalRecordSchema.index({ patient_id: 1, opened_at: 1 });
medicalRecordSchema.index({ patient_id: 1, released_to_patient: 1, status: 1 });

module.exports = model('MedicalRecord', medicalRecordSchema);
