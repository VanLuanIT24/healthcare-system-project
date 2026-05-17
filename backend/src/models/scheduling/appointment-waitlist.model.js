const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { APPOINTMENT_WAITLIST_STATUSES, APPOINTMENT_WAITLIST_STATUS } = require('../../constants/statuses');

// Bảng appointment_waitlists: Lưu yêu cầu chờ slot khám phù hợp.

const appointmentWaitlistSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    preferred_date: { type: Date },
    preferred_time_range: { type: String, trim: true },
    reason: { type: String },
    status: { type: String, enum: APPOINTMENT_WAITLIST_STATUSES, default: APPOINTMENT_WAITLIST_STATUS.WAITING, required: true },
    offered_slot_id: { type: Schema.Types.ObjectId, ref: 'ScheduleSlot' },
    offered_until: { type: Date },
    booked_appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'appointment_waitlists' },
);

appointmentWaitlistSchema.index({ patient_id: 1, created_at: -1 });
appointmentWaitlistSchema.index({ doctor_id: 1, status: 1 });
appointmentWaitlistSchema.index({ department_id: 1, status: 1 });
appointmentWaitlistSchema.index({ preferred_date: 1, status: 1 });
appointmentWaitlistSchema.index({ offered_slot_id: 1 });

module.exports = model('AppointmentWaitlist', appointmentWaitlistSchema);
