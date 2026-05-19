const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const CORRECTION_REASON_CATEGORIES = [
  'wrong_patient',
  'wrong_value',
  'wrong_time',
  'device_error',
  'duplicate',
  'other',
];

const CORRECTION_STATUSES = ['pending', 'approved', 'rejected', 'applied', 'cancelled'];

const vitalSignCorrectionRequestSchema = new Schema(
  {
    vital_sign_id: { type: Schema.Types.ObjectId, ref: 'VitalSign', required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requested_at: { type: Date, default: Date.now, required: true },
    reason: { type: String, required: true, trim: true },
    reason_category: { type: String, enum: CORRECTION_REASON_CATEGORIES, default: 'other', required: true },
    current_values: { type: Schema.Types.Mixed, default: () => ({}) },
    proposed_values: { type: Schema.Types.Mixed, default: () => ({}) },
    status: { type: String, enum: CORRECTION_STATUSES, default: 'pending', required: true },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    review_note: { type: String, trim: true },
    applied_by: { type: Schema.Types.ObjectId, ref: 'User' },
    applied_at: { type: Date },
    replacement_vital_sign_id: { type: Schema.Types.ObjectId, ref: 'VitalSign' },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String, trim: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'vital_sign_correction_requests' },
);

vitalSignCorrectionRequestSchema.index({ vital_sign_id: 1, status: 1 });
vitalSignCorrectionRequestSchema.index({ patient_id: 1, requested_at: -1 });
vitalSignCorrectionRequestSchema.index({ encounter_id: 1, status: 1, requested_at: -1 });
vitalSignCorrectionRequestSchema.index({ department_id: 1, status: 1, requested_at: -1 });
vitalSignCorrectionRequestSchema.index({ requested_by: 1, status: 1, requested_at: -1 });

module.exports = model('VitalSignCorrectionRequest', vitalSignCorrectionRequestSchema);
