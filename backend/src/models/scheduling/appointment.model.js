const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { ACTIVE_APPOINTMENT_STATUSES, APPOINTMENT_STATUS, APPOINTMENT_STATUSES, APPOINTMENT_TYPE, APPOINTMENT_TYPES } = require('../../constants/statuses');

// Bảng appointments: Lưu lịch hẹn khám ngoại trú/nội trú, trạng thái và lịch sử hủy/đổi lịch.

const appointmentSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    doctor_schedule_id: { type: Schema.Types.ObjectId, ref: 'DoctorSchedule' },
    schedule_slot_id: { type: Schema.Types.ObjectId, ref: 'ScheduleSlot' },
    appointment_time: { type: Date, required: true },
    appointment_type: { type: String, enum: APPOINTMENT_TYPES, default: APPOINTMENT_TYPE.OUTPATIENT, required: true },
    reason: { type: String },
    source: { type: String, trim: true },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: APPOINTMENT_STATUS.BOOKED, required: true },
    notes: { type: String },
    confirmed_at: { type: Date },
    checked_in_at: { type: Date },
    completed_at: { type: Date },
    no_show_at: { type: Date },
    cancelled_by: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    rescheduled_from_appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    rescheduled_to_appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    rescheduled_at: { type: Date },
    reschedule_reason: { type: String },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'appointments' },
);

appointmentSchema.index({ patient_id: 1 });
appointmentSchema.index({ doctor_id: 1 });
appointmentSchema.index({ department_id: 1 });
appointmentSchema.index({ doctor_schedule_id: 1 });
appointmentSchema.index(
  { schedule_slot_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      is_deleted: false,
      schedule_slot_id: { $exists: true },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    },
  },
);
appointmentSchema.index({ appointment_time: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index(
  { doctor_id: 1, appointment_time: 1 },
  {
    unique: true,
    partialFilterExpression: {
      is_deleted: false,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    },
  },
);
appointmentSchema.index({ patient_id: 1, appointment_time: 1 });
appointmentSchema.index({ appointment_time: 1, status: 1 });
appointmentSchema.index({ department_id: 1, appointment_time: 1 });

module.exports = model('Appointment', appointmentSchema);
