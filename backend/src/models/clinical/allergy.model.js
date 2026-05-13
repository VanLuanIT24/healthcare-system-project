const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ALLERGY_SEVERITIES, ALLERGY_SEVERITY, ALLERGY_STATUS, ALLERGY_STATUSES, ALLERGY_TYPE, ALLERGY_TYPES } = require('../../constants/statuses');

// Bảng allergies: Lưu dị ứng, tác nhân gây dị ứng, phản ứng và mức độ nghiêm trọng.

const allergySchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    recorded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    allergy_type: { type: String, enum: ALLERGY_TYPES, default: ALLERGY_TYPE.UNKNOWN, required: true },
    allergen: { type: String, required: true, trim: true },
    reaction: { type: String },
    severity: { type: String, enum: ALLERGY_SEVERITIES, default: ALLERGY_SEVERITY.UNKNOWN },
    onset_date: { type: Date },
    notes: { type: String },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
    entered_in_error_by: { type: Schema.Types.ObjectId, ref: 'User' },
    entered_in_error_at: { type: Date },
    entered_in_error_reason: { type: String },
    status: { type: String, enum: ALLERGY_STATUSES, default: ALLERGY_STATUS.ACTIVE, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'allergies' },
);

allergySchema.index({ patient_id: 1 });
allergySchema.index({ encounter_id: 1 });
allergySchema.index({ recorded_by: 1 });
allergySchema.index({ allergen: 1 });
allergySchema.index({ status: 1 });
allergySchema.index({ patient_id: 1, status: 1 });

module.exports = model('Allergy', allergySchema);
