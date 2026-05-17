const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const {
  ACTOR_TYPES,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_PRIORITY,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_STATUS,
} = require('../../constants/statuses');

// Bảng support_tickets: Lưu ticket hỗ trợ, SLA và liên kết conversation dùng chung messaging.

const supportTicketSchema = new Schema(
  {
    ticket_code: { type: String, required: true, unique: true, trim: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    created_by_actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    created_by_actor_id: { type: Schema.Types.Mixed, required: true },
    category: { type: String, enum: SUPPORT_CATEGORIES, default: SUPPORT_CATEGORY.OTHER, required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String },
    priority: { type: String, enum: SUPPORT_TICKET_PRIORITIES, default: SUPPORT_TICKET_PRIORITY.NORMAL, required: true },
    status: { type: String, enum: SUPPORT_TICKET_STATUSES, default: SUPPORT_TICKET_STATUS.OPEN, required: true },
    assigned_department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
    assigned_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    conversation_id: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    sla_due_at: { type: Date },
    resolved_at: { type: Date },
    closed_at: { type: Date },
    satisfaction_rating: { type: Number, min: 1, max: 5 },
    satisfaction_comment: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'support_tickets' },
);

supportTicketSchema.index({ patient_id: 1, created_at: -1 });
supportTicketSchema.index({ category: 1, status: 1 });
supportTicketSchema.index({ priority: 1, status: 1 });
supportTicketSchema.index({ assigned_department_id: 1, status: 1 });
supportTicketSchema.index({ assigned_user_id: 1, status: 1 });
supportTicketSchema.index({ conversation_id: 1 }, { unique: true, sparse: true });
supportTicketSchema.index({ sla_due_at: 1, status: 1 });

module.exports = model('SupportTicket', supportTicketSchema);
