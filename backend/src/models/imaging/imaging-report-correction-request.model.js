const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const CORRECTION_TYPES = ['text', 'file', 'critical_note', 'wrong_patient', 'wrong_body_part', 'quality', 'other'];
const CORRECTION_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const CORRECTION_STATUSES = ['open', 'in_progress', 'resolved', 'cancelled'];

const imagingReportCorrectionRequestSchema = new Schema(
  {
    report_id: { type: Schema.Types.ObjectId, ref: 'ImagingReport', required: true },
    imaging_order_id: { type: Schema.Types.ObjectId, ref: 'ImagingOrder', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requested_at: { type: Date, default: Date.now },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, required: true },
    correction_type: { type: String, enum: CORRECTION_TYPES, default: 'text', required: true },
    severity: { type: String, enum: CORRECTION_SEVERITIES, default: 'medium', required: true },
    status: { type: String, enum: CORRECTION_STATUSES, default: 'open', required: true },
    due_at: { type: Date },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    resolution_note: { type: String },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'imaging_report_correction_requests' },
);

imagingReportCorrectionRequestSchema.index({ report_id: 1, status: 1 });
imagingReportCorrectionRequestSchema.index({ imaging_order_id: 1, status: 1 });
imagingReportCorrectionRequestSchema.index({ assigned_to: 1, status: 1 });
imagingReportCorrectionRequestSchema.index({ patient_id: 1, requested_at: -1 });

module.exports = model('ImagingReportCorrectionRequest', imagingReportCorrectionRequestSchema);
