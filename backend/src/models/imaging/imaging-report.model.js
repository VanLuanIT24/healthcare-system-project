const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { IMAGING_REPORT_STATUS, IMAGING_REPORT_STATUSES } = require('../../constants/statuses');

// Bảng imaging_reports: Lưu báo cáo CĐHA, kết luận và khuyến nghị của bác sĩ đọc phim.

const imagingReportSchema = new Schema(
  {
    imaging_order_id: { type: Schema.Types.ObjectId, ref: 'ImagingOrder', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    amended_from: { type: Schema.Types.ObjectId, ref: 'ImagingReport' },
    superseded_by: { type: Schema.Types.ObjectId, ref: 'ImagingReport' },
    is_current: { type: Boolean, default: true, required: true },
    report_no: { type: String, required: true, unique: true, trim: true },
    radiologist_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    technician_id: { type: Schema.Types.ObjectId, ref: 'User' },
    template_id: { type: Schema.Types.ObjectId },
    pacs_url: { type: String, trim: true },
    findings: { type: String },
    impression: { type: String },
    recommendation: { type: String },
    reported_at: { type: Date },
    verified_by: { type: Schema.Types.ObjectId, ref: 'User' },
    verified_at: { type: Date },
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
    amended_by: { type: Schema.Types.ObjectId, ref: 'User' },
    amended_at: { type: Date },
    amend_reason: { type: String },
    amendment_version: { type: Number, default: 0 },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    is_critical: { type: Boolean, default: false },
    critical_finding: { type: String },
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
imagingReportSchema.index({ amended_from: 1 });
imagingReportSchema.index({ superseded_by: 1 });
imagingReportSchema.index({ imaging_order_id: 1, is_current: 1, status: 1 });
imagingReportSchema.index({ radiologist_id: 1 });
imagingReportSchema.index({ reported_at: 1 });
imagingReportSchema.index({ released_to_doctor: 1 });
imagingReportSchema.index({ released_to_doctor_at: 1 });
imagingReportSchema.index({ doctor_acknowledged_at: 1 });
imagingReportSchema.index({ released_to_patient: 1 });
imagingReportSchema.index({ released_at: 1 });
imagingReportSchema.index({ release_revoked_at: 1 });
imagingReportSchema.index({ patient_viewed_at: 1 });
imagingReportSchema.index({ is_critical: 1 });
imagingReportSchema.index({ template_id: 1 });
imagingReportSchema.index({ status: 1 });
imagingReportSchema.index({ patient_id: 1, reported_at: 1 });
imagingReportSchema.index({ patient_id: 1, released_to_patient: 1, status: 1 });

module.exports = model('ImagingReport', imagingReportSchema);
