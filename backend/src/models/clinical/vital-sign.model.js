const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { VITAL_SIGN_STATUS, VITAL_SIGN_STATUSES } = require('../../constants/statuses');

// Bảng vital_signs: Lưu sinh hiệu như mạch, nhiệt độ, huyết áp, SpO2, chiều cao/cân nặng.

const vitalSignSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    recorded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    temperature: { type: Number, min: 25, max: 45 },
    heart_rate: { type: Number, min: 20, max: 250 },
    respiratory_rate: { type: Number, min: 5, max: 80 },
    systolic_bp: { type: Number, min: 40, max: 260 },
    diastolic_bp: { type: Number, min: 20, max: 160 },
    spo2: { type: Number, min: 50, max: 100 },
    weight: { type: Number, min: 0.5, max: 500 },
    height: { type: Number, min: 20, max: 250 },
    bmi: { type: Number, min: 0, max: 100 },
    recorded_at: { type: Date, required: true },
    entered_in_error_by: { type: Schema.Types.ObjectId, ref: 'User' },
    entered_in_error_at: { type: Date },
    entered_in_error_reason: { type: String },
    status: { type: String, enum: VITAL_SIGN_STATUSES, default: VITAL_SIGN_STATUS.RECORDED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'vital_signs' },
);

vitalSignSchema.pre('save', function calculateBmi(next) {
  if (this.weight && this.height) {
    const heightInMeters = this.height / 100;
    this.bmi = Number((this.weight / (heightInMeters * heightInMeters)).toFixed(2));
  }
  next();
});

vitalSignSchema.index({ patient_id: 1 });
vitalSignSchema.index({ encounter_id: 1 });
vitalSignSchema.index({ recorded_by: 1 });
vitalSignSchema.index({ recorded_at: 1 });
vitalSignSchema.index({ encounter_id: 1, recorded_at: 1 });
vitalSignSchema.index({ patient_id: 1, recorded_at: 1 });
vitalSignSchema.index({ encounter_id: 1, status: 1, recorded_at: 1 });

module.exports = model('VitalSign', vitalSignSchema);
