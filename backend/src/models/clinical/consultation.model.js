const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { CONSULTATION_STATUS, CONSULTATION_STATUSES } = require('../../constants/statuses');

// Bảng consultations: Lưu phiên khám, bệnh sử, thăm khám, đánh giá và kế hoạch điều trị.

const consultationSchema = new Schema(
  {
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    consultation_no: { type: String, required: true, unique: true, trim: true },
    chief_complaint: { type: String },
    history_present_illness: { type: String },
    physical_exam: { type: String },
    assessment: { type: String },
    plan: { type: String },
    signed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    signed_at: { type: Date },
    amended_by: { type: Schema.Types.ObjectId, ref: 'User' },
    amended_at: { type: Date },
    amend_reason: { type: String },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    status: { type: String, enum: CONSULTATION_STATUSES, default: CONSULTATION_STATUS.DRAFT, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'consultations' },
);

consultationSchema.index({ encounter_id: 1 });
consultationSchema.index({ doctor_id: 1 });
consultationSchema.index({ status: 1 });
consultationSchema.index({ created_at: 1 });
consultationSchema.index({ encounter_id: 1, created_at: 1 });
consultationSchema.index({ encounter_id: 1, status: 1 });
consultationSchema.index({ doctor_id: 1, status: 1 });

module.exports = model('Consultation', consultationSchema);
