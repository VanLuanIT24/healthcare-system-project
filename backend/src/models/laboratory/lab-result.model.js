const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { LAB_RESULT_STATUS, LAB_RESULT_STATUSES } = require('../../constants/statuses');

// Bảng lab_results: Lưu phiếu kết quả xét nghiệm tổng và trạng thái xác nhận.

const labResultSchema = new Schema(
  {
    lab_order_id: { type: Schema.Types.ObjectId, ref: 'LabOrder', required: true },
    specimen_id: { type: Schema.Types.ObjectId, ref: 'Specimen' },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    amended_from: { type: Schema.Types.ObjectId, ref: 'LabResult' },
    superseded_by: { type: Schema.Types.ObjectId, ref: 'LabResult' },
    is_current: { type: Boolean, default: true, required: true },
    result_no: { type: String, required: true, unique: true, trim: true },
    performed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    verified_by: { type: Schema.Types.ObjectId, ref: 'User' },
    verified_at: { type: Date },
    reported_at: { type: Date },
    released_to_doctor: { type: Boolean, default: false },
    released_to_doctor_at: { type: Date },
    released_to_doctor_by: { type: Schema.Types.ObjectId, ref: 'User' },
    doctor_viewed_at: { type: Date },
    doctor_acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    doctor_acknowledged_at: { type: Date },
    released_to_patient: { type: Boolean, default: false },
    released_at: { type: Date },
    released_by: { type: Schema.Types.ObjectId, ref: 'User' },
    release_revoked_at: { type: Date },
    release_revoked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    release_revoke_reason: { type: String },
    patient_viewed_at: { type: Date },
    patient_downloaded_at: { type: Date },
    patient_download_count: { type: Number, default: 0, min: 0 },
    is_critical: { type: Boolean, default: false },
    critical_notified_at: { type: Date },
    critical_acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    critical_acknowledged_at: { type: Date },
    amended_by: { type: Schema.Types.ObjectId, ref: 'User' },
    amended_at: { type: Date },
    amend_reason: { type: String },
    amendment_version: { type: Number, default: 0 },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    entered_in_error_by: { type: Schema.Types.ObjectId, ref: 'User' },
    entered_in_error_at: { type: Date },
    entered_in_error_reason: { type: String },
    interpretation: { type: String },
    notes: { type: String },
    status: { type: String, enum: LAB_RESULT_STATUSES, default: LAB_RESULT_STATUS.PRELIMINARY, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'lab_results' },
);

labResultSchema.index({ specimen_id: 1 });
labResultSchema.index({ patient_id: 1 });
labResultSchema.index({ amended_from: 1 });
labResultSchema.index({ superseded_by: 1 });
labResultSchema.index({ lab_order_id: 1, is_current: 1, status: 1 });
labResultSchema.index(
  { lab_order_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      is_current: true,
      status: { $in: [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED] },
    },
  },
);
labResultSchema.index({ performed_by: 1 });
labResultSchema.index({ verified_by: 1 });
labResultSchema.index({ reported_at: 1 });
labResultSchema.index({ released_to_doctor: 1 });
labResultSchema.index({ released_to_doctor_at: 1 });
labResultSchema.index({ doctor_acknowledged_at: 1 });
labResultSchema.index({ released_to_patient: 1 });
labResultSchema.index({ released_at: 1 });
labResultSchema.index({ release_revoked_at: 1 });
labResultSchema.index({ patient_viewed_at: 1 });
labResultSchema.index({ is_critical: 1 });
labResultSchema.index({ critical_acknowledged_at: 1 });
labResultSchema.index({ status: 1 });
labResultSchema.index({ patient_id: 1, reported_at: 1 });
labResultSchema.index({ patient_id: 1, released_to_patient: 1, status: 1 });

module.exports = model('LabResult', labResultSchema);
