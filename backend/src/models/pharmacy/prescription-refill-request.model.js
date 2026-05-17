const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ACTOR_TYPES, PRESCRIPTION_REFILL_REQUEST_STATUSES, PRESCRIPTION_REFILL_REQUEST_STATUS } = require('../../constants/statuses');

// Bảng prescription_refill_requests: Patient yêu cầu refill đơn thuốc.

const prescriptionRefillRequestSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription', required: true },
    requested_by_actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    requested_by_actor_id: { type: Schema.Types.Mixed, required: true },
    reason: { type: String },
    status: { type: String, enum: PRESCRIPTION_REFILL_REQUEST_STATUSES, default: PRESCRIPTION_REFILL_REQUEST_STATUS.PENDING, required: true },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    review_note: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'prescription_refill_requests' },
);

prescriptionRefillRequestSchema.index({ patient_id: 1, created_at: -1 });
prescriptionRefillRequestSchema.index({ prescription_id: 1, status: 1 });
prescriptionRefillRequestSchema.index({ status: 1, created_at: -1 });

module.exports = model('PrescriptionRefillRequest', prescriptionRefillRequestSchema);
