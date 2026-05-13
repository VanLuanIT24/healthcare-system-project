const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { IMAGING_REPORT_STATUS, IMAGING_REPORT_STATUSES } = require('../../constants/statuses');

// Bảng imaging_reports: Lưu báo cáo CĐHA, kết luận và khuyến nghị của bác sĩ đọc phim.

const imagingReportSchema = new Schema(
  {
    imaging_order_id: { type: Schema.Types.ObjectId, ref: 'ImagingOrder', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    report_no: { type: String, required: true, unique: true, trim: true },
    radiologist_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    technician_id: { type: Schema.Types.ObjectId, ref: 'User' },
    findings: { type: String },
    impression: { type: String },
    recommendation: { type: String },
    reported_at: { type: Date },
    verified_by: { type: Schema.Types.ObjectId, ref: 'User' },
    verified_at: { type: Date },
    released_to_patient: { type: Boolean, default: false },
    released_at: { type: Date },
    released_by: { type: Schema.Types.ObjectId, ref: 'User' },
    amended_by: { type: Schema.Types.ObjectId, ref: 'User' },
    amended_at: { type: Date },
    amend_reason: { type: String },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    is_critical: { type: Boolean, default: false },
    critical_note: { type: String },
    critical_notified_at: { type: Date },
    critical_acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User' },
    critical_acknowledged_at: { type: Date },
    status: { type: String, enum: IMAGING_REPORT_STATUSES, default: IMAGING_REPORT_STATUS.DRAFT, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'imaging_reports' },
);

imagingReportSchema.index({ imaging_order_id: 1 });
imagingReportSchema.index({ patient_id: 1 });
imagingReportSchema.index({ radiologist_id: 1 });
imagingReportSchema.index({ reported_at: 1 });
imagingReportSchema.index({ released_to_patient: 1 });
imagingReportSchema.index({ released_at: 1 });
imagingReportSchema.index({ is_critical: 1 });
imagingReportSchema.index({ status: 1 });
imagingReportSchema.index({ patient_id: 1, reported_at: 1 });
imagingReportSchema.index({ patient_id: 1, released_to_patient: 1, status: 1 });

module.exports = model('ImagingReport', imagingReportSchema);
