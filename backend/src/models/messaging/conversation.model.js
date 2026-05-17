const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const {
  ACTOR_TYPES,
  CONVERSATION_PRIORITIES,
  CONVERSATION_PRIORITY,
  CONVERSATION_STATUSES,
  CONVERSATION_STATUS,
  CONVERSATION_TYPES,
} = require('../../constants/statuses');

// Bảng conversations: Lưu luồng trao đổi giữa patient/relative/staff/system theo ngữ cảnh y tế.

const actorSnapshotSchema = new Schema(
  {
    actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    actor_id: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const conversationSchema = new Schema(
  {
    conversation_code: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: CONVERSATION_TYPES, required: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    encounter_id: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    prescription_id: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    ticket_id: { type: Schema.Types.ObjectId },
    title: { type: String, trim: true },
    status: { type: String, enum: CONVERSATION_STATUSES, default: CONVERSATION_STATUS.OPEN, required: true },
    priority: { type: String, enum: CONVERSATION_PRIORITIES, default: CONVERSATION_PRIORITY.NORMAL, required: true },
    created_by_actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    created_by_actor_id: { type: Schema.Types.Mixed, required: true },
    assigned_department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    assigned_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    last_message_at: { type: Date },
    closed_at: { type: Date },
    closed_by: { type: actorSnapshotSchema },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'conversations' },
);

conversationSchema.index({ type: 1, status: 1, last_message_at: -1 });
conversationSchema.index({ patient_id: 1, last_message_at: -1 });
conversationSchema.index({ appointment_id: 1 });
conversationSchema.index({ encounter_id: 1 });
conversationSchema.index({ invoice_id: 1 });
conversationSchema.index({ prescription_id: 1 });
conversationSchema.index({ ticket_id: 1 });
conversationSchema.index({ assigned_department_id: 1, status: 1 });
conversationSchema.index({ assigned_user_id: 1, status: 1 });
conversationSchema.index({ created_by_actor_type: 1, created_by_actor_id: 1 });

module.exports = model('Conversation', conversationSchema);
