const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const consultationStatuses = ['draft', 'in_progress', 'signed', 'amended', 'cancelled'];

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
    status: { type: String, enum: consultationStatuses, default: 'draft', required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'consultations' },
);

consultationSchema.index({ encounter_id: 1 });
consultationSchema.index({ doctor_id: 1 });
consultationSchema.index({ status: 1 });
consultationSchema.index({ created_at: 1 });
consultationSchema.index({ encounter_id: 1, created_at: 1 });

module.exports = model('Consultation', consultationSchema);
