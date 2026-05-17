const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields, softDeleteFields } = require('../common/base-model');
const { NOTIFICATION_PRIORITIES, NOTIFICATION_PRIORITY } = require('../../constants/statuses');

// Bảng notification_templates: Template nội dung notification theo event_type/ngôn ngữ.

const notificationTemplateSchema = new Schema(
  {
    template_code: { type: String, required: true, unique: true, trim: true },
    event_type: { type: String, required: true, trim: true },
    language: { type: String, default: 'vi', trim: true },
    title_template: { type: String, required: true },
    body_template: { type: String, required: true },
    priority: { type: String, enum: NOTIFICATION_PRIORITIES, default: NOTIFICATION_PRIORITY.NORMAL, required: true },
    channels: [{ type: String, trim: true }],
    active: { type: Boolean, default: true, required: true },
    metadata: { type: Schema.Types.Mixed },
    ...auditFields(),
    ...softDeleteFields(),
  },
  { ...baseSchemaOptions, collection: 'notification_templates' },
);

notificationTemplateSchema.index({ event_type: 1, language: 1, active: 1 });
notificationTemplateSchema.index({ active: 1, created_at: -1 });

module.exports = model('NotificationTemplate', notificationTemplateSchema);
