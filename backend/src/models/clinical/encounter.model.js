const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const encounterStatuses = ['planned', 'arrived', 'in_progress', 'on_hold', 'completed', 'cancelled'];
const encounterTypes = ['outpatient', 'inpatient', 'emergency', 'telemedicine'];

const encounterSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    attending_doctor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    encounter_code: { type: String, required: true, unique: true, trim: true },
    encounter_type: { type: String, enum: encounterTypes, required: true },
    start_time: { type: Date, required: true },
    end_time: { type: Date },
    chief_reason: { type: String },
    status: { type: String, enum: encounterStatuses, default: 'planned', required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'encounters' },
);

encounterSchema.index({ patient_id: 1 });
encounterSchema.index({ appointment_id: 1 });
encounterSchema.index({ department_id: 1 });
encounterSchema.index({ attending_doctor_id: 1 });
encounterSchema.index({ start_time: 1 });
encounterSchema.index({ status: 1 });
encounterSchema.index({ encounter_type: 1 });
encounterSchema.index({ patient_id: 1, start_time: 1 });

module.exports = model('Encounter', encounterSchema);
