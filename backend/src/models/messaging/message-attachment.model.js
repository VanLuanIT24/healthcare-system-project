const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const { ACTOR_TYPES } = require('../../constants/statuses');

// Bảng message_attachments: Lưu metadata file gắn với tin nhắn, trỏ về attachment hiện có nếu đã upload qua records.

const messageAttachmentSchema = new Schema(
  {
    message_id: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    attachment_id: { type: Schema.Types.ObjectId, ref: 'Attachment' },
    file_name: { type: String, required: true, trim: true },
    mime_type: { type: String, trim: true },
    size: { type: Number, min: 0 },
    uploaded_by_actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    uploaded_by_actor_id: { type: Schema.Types.Mixed, required: true },
  },
  { ...baseSchemaOptions, collection: 'message_attachments' },
);

messageAttachmentSchema.index({ message_id: 1 });
messageAttachmentSchema.index({ attachment_id: 1 });
messageAttachmentSchema.index({ uploaded_by_actor_type: 1, uploaded_by_actor_id: 1, created_at: -1 });

module.exports = model('MessageAttachment', messageAttachmentSchema);
