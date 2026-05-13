const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const { ACTIVE_QUEUE_STATUSES, QUEUE_STATUS, QUEUE_STATUSES, QUEUE_TYPE, QUEUE_TYPES } = require('../../constants/statuses');

// Bảng queue_tickets: Lưu số thứ tự hàng đợi khám theo ngày, khoa và bác sĩ.

const queueTicketSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    queue_date: { type: Date, required: true },
    queue_number: { type: String, required: true, trim: true },
    queue_type: { type: String, enum: QUEUE_TYPES, default: QUEUE_TYPE.NORMAL, required: true },
    status: { type: String, enum: QUEUE_STATUSES, default: QUEUE_STATUS.WAITING, required: true },
    checkin_time: { type: Date },
    called_time: { type: Date },
    service_start_time: { type: Date },
    completed_time: { type: Date },
    skipped_at: { type: Date },
    skip_reason: { type: String },
    cancelled_at: { type: Date },
    cancel_reason: { type: String },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'queue_tickets' },
);

queueTicketSchema.index({ patient_id: 1 });
queueTicketSchema.index(
  { appointment_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      appointment_id: { $exists: true },
      status: { $in: ACTIVE_QUEUE_STATUSES },
    },
  },
);
queueTicketSchema.index({ encounter_id: 1 });
queueTicketSchema.index({ doctor_id: 1 });
queueTicketSchema.index({ department_id: 1 });
queueTicketSchema.index({ queue_date: 1 });
queueTicketSchema.index({ status: 1 });
queueTicketSchema.index({ checkin_time: 1 });
queueTicketSchema.index({ department_id: 1, queue_date: 1, queue_number: 1 }, { unique: true });
queueTicketSchema.index({ doctor_id: 1, queue_date: 1, queue_number: 1 }, { unique: true });
queueTicketSchema.index({ department_id: 1, created_at: 1 });
queueTicketSchema.index({ doctor_id: 1, status: 1, created_at: 1 });
queueTicketSchema.index({ department_id: 1, checkin_time: 1 });
queueTicketSchema.index({ doctor_id: 1, checkin_time: 1 });
queueTicketSchema.index({ status: 1, checkin_time: 1 });
queueTicketSchema.index({ department_id: 1, queue_date: 1 });
queueTicketSchema.index({ doctor_id: 1, queue_date: 1 });

module.exports = model('QueueTicket', queueTicketSchema);
