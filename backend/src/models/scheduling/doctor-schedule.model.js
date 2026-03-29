const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const scheduleStatuses = ['draft', 'published', 'active', 'cancelled', 'completed'];

const doctorScheduleSchema = new Schema(
  {
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    work_date: { type: Date, required: true },
    shift_start: { type: Date, required: true },
    shift_end: { type: Date, required: true },
    slot_duration_minutes: { type: Number, default: 15, min: 5, required: true },
    max_patients: { type: Number, min: 0 },
    status: { type: String, enum: scheduleStatuses, default: 'draft', required: true },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'doctor_schedules' },
);

doctorScheduleSchema.index({ doctor_id: 1 });
doctorScheduleSchema.index({ department_id: 1 });
doctorScheduleSchema.index({ work_date: 1 });
doctorScheduleSchema.index({ status: 1 });
doctorScheduleSchema.index({ doctor_id: 1, work_date: 1, shift_start: 1, shift_end: 1 }, { unique: true });

module.exports = model('DoctorSchedule', doctorScheduleSchema);
