const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const appointmentStatuses = ['booked', 'confirmed', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show', 'rescheduled'];
const appointmentTypes = ['outpatient', 'inpatient_followup', 'emergency', 'telemedicine', 'vaccination', 'procedure'];

const appointmentSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    doctor_schedule_id: { type: Schema.Types.ObjectId, ref: 'DoctorSchedule' },
    appointment_time: { type: Date, required: true },
    appointment_type: { type: String, enum: appointmentTypes, default: 'outpatient', required: true },
    reason: { type: String },
    source: { type: String, trim: true },
    status: { type: String, enum: appointmentStatuses, default: 'booked', required: true },
    notes: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'appointments' },
);

appointmentSchema.index({ patient_id: 1 });
appointmentSchema.index({ doctor_id: 1 });
appointmentSchema.index({ department_id: 1 });
appointmentSchema.index({ doctor_schedule_id: 1 });
appointmentSchema.index({ appointment_time: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ doctor_id: 1, appointment_time: 1 });
appointmentSchema.index({ patient_id: 1, appointment_time: 1 });

module.exports = model('Appointment', appointmentSchema);
