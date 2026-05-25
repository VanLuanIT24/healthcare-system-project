const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');

const CHATBOT_APPOINTMENT_DRAFT_STATUS = ['draft', 'pending_confirmation', 'pending_staff_confirmation', 'confirmed', 'expired', 'cancelled'];

const chatbotAppointmentDraftSchema = new Schema(
  {
    session_id: { type: Schema.Types.ObjectId, ref: 'ChatbotSession', required: true },
    draft_code: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: CHATBOT_APPOINTMENT_DRAFT_STATUS,
      default: 'draft',
      required: true,
    },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    patient_name: { type: String, trim: true },
    phone: { type: String, trim: true },
    department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'User' },
    doctor_schedule_id: { type: Schema.Types.ObjectId, ref: 'DoctorSchedule' },
    schedule_slot_id: { type: Schema.Types.ObjectId, ref: 'ScheduleSlot' },
    appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    appointment_time: { type: Date },
    selected_slot: { type: Schema.Types.Mixed, default: {} },
    symptoms_note: { type: String, trim: true },
    confirmation_snapshot: { type: Schema.Types.Mixed, default: {} },
    expires_at: { type: Date },
    confirmed_at: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'chatbot_appointment_drafts' },
);

chatbotAppointmentDraftSchema.index({ draft_code: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
chatbotAppointmentDraftSchema.index({ session_id: 1, created_at: -1 });
chatbotAppointmentDraftSchema.index({ status: 1, expires_at: 1 });
chatbotAppointmentDraftSchema.index({ phone: 1, created_at: -1 });

module.exports = model('ChatbotAppointmentDraft', chatbotAppointmentDraftSchema);
