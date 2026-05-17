const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const { ACTOR_TYPES, NOTIFICATION_PREFERENCE_CHANNELS, NOTIFICATION_PREFERENCE_CHANNEL } = require('../../constants/statuses');

// Bảng notification_preferences: Cấu hình nhận notification theo actor, event và channel.

const notificationPreferenceSchema = new Schema(
  {
    actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    actor_id: { type: Schema.Types.Mixed, required: true },
    channel: { type: String, enum: NOTIFICATION_PREFERENCE_CHANNELS, default: NOTIFICATION_PREFERENCE_CHANNEL.IN_APP, required: true },
    event_type: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true, required: true },
    quiet_hours: { type: Schema.Types.Mixed },
    language: { type: String, trim: true, default: 'vi' },
  },
  { ...baseSchemaOptions, collection: 'notification_preferences' },
);

notificationPreferenceSchema.index({ actor_type: 1, actor_id: 1, event_type: 1, channel: 1 }, { unique: true });
notificationPreferenceSchema.index({ event_type: 1, enabled: 1 });

module.exports = model('NotificationPreference', notificationPreferenceSchema);
