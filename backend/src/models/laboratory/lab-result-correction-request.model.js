const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ORDER_PRIORITY, ORDER_PRIORITIES } = require('../../constants/statuses');

const LAB_RESULT_CORRECTION_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
};

const LAB_RESULT_CORRECTION_STATUSES = Object.values(LAB_RESULT_CORRECTION_STATUS);

const labResultCorrectionRequestSchema = new Schema(
  {
    lab_result_id: { type: Schema.Types.ObjectId, ref: 'LabResult', required: true },
    lab_order_id: { type: Schema.Types.ObjectId, ref: 'LabOrder', required: true },
    specimen_id: { type: Schema.Types.ObjectId, ref: 'Specimen' },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requested_at: { type: Date, default: Date.now, required: true },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    reason_code: { type: String, trim: true },
    reason_text: { type: String, required: true, trim: true },
    priority: { type: String, enum: ORDER_PRIORITIES, default: ORDER_PRIORITY.ROUTINE, required: true },
    due_at: { type: Date },
    status: { type: String, enum: LAB_RESULT_CORRECTION_STATUSES, default: LAB_RESULT_CORRECTION_STATUS.OPEN, required: true },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    resolution_note: { type: String, trim: true },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'lab_result_correction_requests' },
);

labResultCorrectionRequestSchema.index({ lab_result_id: 1, status: 1 });
labResultCorrectionRequestSchema.index({ lab_order_id: 1, status: 1, requested_at: -1 });
labResultCorrectionRequestSchema.index({ patient_id: 1, requested_at: -1 });
labResultCorrectionRequestSchema.index({ encounter_id: 1, status: 1, requested_at: -1 });
labResultCorrectionRequestSchema.index({ assigned_to: 1, status: 1, due_at: 1 });
labResultCorrectionRequestSchema.index({ status: 1, priority: 1, due_at: 1 });

module.exports = model('LabResultCorrectionRequest', labResultCorrectionRequestSchema);
