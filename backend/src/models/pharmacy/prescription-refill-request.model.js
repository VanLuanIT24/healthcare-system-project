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
    priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
    requested_items: [{
      prescription_item_id: { type: Schema.Types.ObjectId, ref: 'PrescriptionItem' },
      medication_id: { type: Schema.Types.ObjectId, ref: 'MedicationMaster' },
      medication_name: { type: String, trim: true },
      requested_quantity: { type: Number, min: 0 },
      unit: { type: String, trim: true },
      note: { type: String },
    }],
    last_dispensed_at: { type: Date },
    reason: { type: String },
    status: { type: String, enum: PRESCRIPTION_REFILL_REQUEST_STATUSES, default: PRESCRIPTION_REFILL_REQUEST_STATUS.PENDING, required: true },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_by_pharmacist: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_by_doctor: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    review_note: { type: String },
    decision_reason: { type: String },
    converted_prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    routed_to_doctor_at: { type: Date },
    routed_to_doctor_by: { type: Schema.Types.ObjectId, ref: 'User' },
    expired_at: { type: Date },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'prescription_refill_requests' },
);

prescriptionRefillRequestSchema.index({ patient_id: 1, created_at: -1 });
prescriptionRefillRequestSchema.index({ prescription_id: 1, status: 1 });
prescriptionRefillRequestSchema.index({ status: 1, created_at: -1 });

module.exports = model('PrescriptionRefillRequest', prescriptionRefillRequestSchema);
