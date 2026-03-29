const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');

const vitalSignStatuses = ['recorded', 'amended', 'entered_in_error'];

const vitalSignSchema = new Schema(
  {
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
    recorded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    temperature: { type: Number, min: 25, max: 45 },
    heart_rate: { type: Number, min: 0, max: 300 },
    respiratory_rate: { type: Number, min: 0, max: 120 },
    systolic_bp: { type: Number, min: 0, max: 400 },
    diastolic_bp: { type: Number, min: 0, max: 300 },
    spo2: { type: Number, min: 0, max: 100 },
    weight: { type: Number, min: 0, max: 1000 },
    height: { type: Number, min: 0, max: 300 },
    bmi: { type: Number, min: 0, max: 100 },
    recorded_at: { type: Date, required: true },
    status: { type: String, enum: vitalSignStatuses, default: 'recorded', required: true },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { ...baseSchemaOptions, collection: 'vital_signs' },
);

vitalSignSchema.index({ encounter_id: 1 });
vitalSignSchema.index({ recorded_by: 1 });
vitalSignSchema.index({ recorded_at: 1 });
vitalSignSchema.index({ encounter_id: 1, recorded_at: 1 });

module.exports = model('VitalSign', vitalSignSchema);
