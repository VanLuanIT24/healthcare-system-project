const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');

const queueStatuses = ['waiting', 'called', 'in_service', 'skipped', 'recalled', 'completed', 'cancelled'];
const queueTypes = ['normal', 'priority', 'vip'];

const queueTicketSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    queue_number: { type: String, required: true, trim: true },
    queue_type: { type: String, enum: queueTypes, default: 'normal', required: true },
    status: { type: String, enum: queueStatuses, default: 'waiting', required: true },
    checkin_time: { type: Date },
    called_time: { type: Date },
    completed_time: { type: Date },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'queue_tickets' },
);

queueTicketSchema.index({ patient_id: 1 });
queueTicketSchema.index({ appointment_id: 1 });
queueTicketSchema.index({ encounter_id: 1 });
queueTicketSchema.index({ doctor_id: 1 });
queueTicketSchema.index({ department_id: 1 });
queueTicketSchema.index({ status: 1 });
queueTicketSchema.index({ checkin_time: 1 });
queueTicketSchema.index({ department_id: 1, created_at: 1 });
queueTicketSchema.index({ doctor_id: 1, status: 1, created_at: 1 });

module.exports = model('QueueTicket', queueTicketSchema);
