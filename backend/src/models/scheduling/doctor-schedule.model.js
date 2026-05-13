const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { DEFAULT_SCHEDULE_TYPE } = require('../../constants/catalogs/schedule-types');
const { SCHEDULE_STATUS, SCHEDULE_STATUSES } = require('../../constants/statuses');

// Bảng doctor_schedules: Lưu ca làm việc tổng của bác sĩ theo ngày, khoa và khung giờ.

const doctorScheduleSchema = new Schema(
  {
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    work_date: { type: Date, required: true },
    shift_start: { type: Date, required: true },
    shift_end: { type: Date, required: true },
    slot_duration_minutes: { type: Number, default: 15, min: 5, required: true },
    max_patients: { type: Number, min: 0 },
    schedule_type: { type: String, trim: true, default: DEFAULT_SCHEDULE_TYPE },
    patient_portal_enabled: { type: Boolean, default: true },
    staff_only: { type: Boolean, default: false },
    return_visit_priority: { type: Boolean, default: false },
    early_booking_enabled: { type: Boolean, default: true },
    internal_note: { type: String, trim: true, maxlength: 500 },
    break_windows: [
      {
        start_time: { type: Date, required: true },
        end_time: { type: Date, required: true },
        mode: { type: String, trim: true },
      },
    ],
    status: { type: String, enum: SCHEDULE_STATUSES, default: SCHEDULE_STATUS.DRAFT, required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'doctor_schedules' },
);

doctorScheduleSchema.index({ doctor_id: 1 });
doctorScheduleSchema.index({ department_id: 1 });
doctorScheduleSchema.index({ work_date: 1 });
doctorScheduleSchema.index({ status: 1 });
doctorScheduleSchema.index(
  { doctor_id: 1, work_date: 1, shift_start: 1, shift_end: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false } },
);

module.exports = model('DoctorSchedule', doctorScheduleSchema);
