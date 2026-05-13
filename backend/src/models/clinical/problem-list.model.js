const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { PROBLEM_SEVERITIES, PROBLEM_SEVERITY, PROBLEM_STATUS, PROBLEM_STATUSES } = require('../../constants/statuses');

// Bảng problem_list: Lưu bệnh nền và vấn đề sức khỏe dài hạn của bệnh nhân.

const problemListSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    diagnosis_id: { type: Schema.Types.ObjectId, ref: 'Diagnosis' },
    recorded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    icd10_code: { type: String, trim: true },
    problem_name: { type: String, required: true, trim: true },
    severity: { type: String, enum: PROBLEM_SEVERITIES, default: PROBLEM_SEVERITY.UNKNOWN },
    onset_date: { type: Date },
    resolved_at: { type: Date },
    notes: { type: String },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    entered_in_error_by: { type: Schema.Types.ObjectId, ref: 'User' },
    entered_in_error_at: { type: Date },
    entered_in_error_reason: { type: String },
    status: { type: String, enum: PROBLEM_STATUSES, default: PROBLEM_STATUS.ACTIVE, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'problem_list' },
);

problemListSchema.index({ patient_id: 1 });
problemListSchema.index({ encounter_id: 1 });
problemListSchema.index({ diagnosis_id: 1 });
problemListSchema.index({ recorded_by: 1 });
problemListSchema.index({ icd10_code: 1 });
problemListSchema.index({ status: 1 });
problemListSchema.index({ patient_id: 1, status: 1 });

module.exports = model('ProblemList', problemListSchema);
