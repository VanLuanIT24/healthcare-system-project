const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { SCHEDULE_SLOT_STATUS, SCHEDULE_SLOT_STATUSES } = require('../../constants/statuses');

// Bảng schedule_slots: Lưu từng khung giờ khám cụ thể được sinh ra từ ca làm việc của bác sĩ.

const scheduleSlotSchema = new Schema(
  {
    doctor_schedule_id: { type: Schema.Types.ObjectId, ref: 'DoctorSchedule', required: true },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    slot_number: { type: Number, min: 1 },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    capacity: { type: Number, default: 1, min: 1, max: 1, required: true },
    booked_count: { type: Number, default: 0, min: 0, max: 1, required: true },
    appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    hold_expires_at: { type: Date },
    block_reason: { type: String, trim: true },
    status: { type: String, enum: SCHEDULE_SLOT_STATUSES, default: SCHEDULE_SLOT_STATUS.AVAILABLE, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'schedule_slots' },
);

scheduleSlotSchema.index({ doctor_schedule_id: 1 });
scheduleSlotSchema.index({ doctor_id: 1 });
scheduleSlotSchema.index({ department_id: 1 });
scheduleSlotSchema.index({ start_time: 1 });
scheduleSlotSchema.index({ status: 1 });
scheduleSlotSchema.index({ appointment_id: 1 }, { sparse: true });
scheduleSlotSchema.index({ doctor_id: 1, start_time: 1 });
scheduleSlotSchema.index(
  { doctor_schedule_id: 1, start_time: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false } },
);

module.exports = model('ScheduleSlot', scheduleSlotSchema);
