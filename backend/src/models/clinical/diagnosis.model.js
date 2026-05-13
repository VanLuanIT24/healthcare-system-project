const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { DIAGNOSIS_STATUS, DIAGNOSIS_STATUSES, DIAGNOSIS_TYPE, DIAGNOSIS_TYPES } = require('../../constants/statuses');

// Bảng diagnoses: Lưu chẩn đoán theo encounter/consultation, gồm ICD-10 và mức độ xác nhận.

const diagnosisSchema = new Schema(
  {
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    consultation_id: { type: Schema.Types.ObjectId, ref: 'Consultation' },
    recorded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    icd10_code: { type: String, trim: true },
    diagnosis_name: { type: String, required: true, trim: true },
    diagnosis_type: { type: String, enum: DIAGNOSIS_TYPES, default: DIAGNOSIS_TYPE.PROVISIONAL, required: true },
    is_primary: { type: Boolean, default: false, required: true },
    onset_date: { type: Date },
    notes: { type: String },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    entered_in_error_by: { type: Schema.Types.ObjectId, ref: 'User' },
    entered_in_error_at: { type: Date },
    entered_in_error_reason: { type: String },
    status: { type: String, enum: DIAGNOSIS_STATUSES, default: DIAGNOSIS_STATUS.ACTIVE, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'diagnoses' },
);

diagnosisSchema.index({ encounter_id: 1 });
diagnosisSchema.index({ consultation_id: 1 });
diagnosisSchema.index({ recorded_by: 1 });
diagnosisSchema.index({ icd10_code: 1 });
diagnosisSchema.index({ status: 1 });
diagnosisSchema.index({ encounter_id: 1, status: 1, is_primary: 1 });
diagnosisSchema.index(
  { encounter_id: 1, is_primary: 1 },
  {
    unique: true,
    partialFilterExpression: {
      is_primary: true,
      status: DIAGNOSIS_STATUS.ACTIVE,
    },
  },
);

module.exports = model('Diagnosis', diagnosisSchema);
