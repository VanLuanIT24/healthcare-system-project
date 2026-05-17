const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const {
  NOTIFICATION_DELIVERY_CHANNEL,
  NOTIFICATION_DELIVERY_CHANNELS,
  NOTIFICATION_DELIVERY_STATUS,
  NOTIFICATION_DELIVERY_STATUSES,
} = require('../../constants/statuses');

// Bảng notification_deliveries: Theo dõi delivery từng kênh như socket/email/push.

const notificationDeliverySchema = new Schema(
  {
    notification_id: { type: Schema.Types.ObjectId, ref: 'Notification', required: true },
    channel: { type: String, enum: NOTIFICATION_DELIVERY_CHANNELS, default: NOTIFICATION_DELIVERY_CHANNEL.IN_APP, required: true },
    provider: { type: String, trim: true },
    status: { type: String, enum: NOTIFICATION_DELIVERY_STATUSES, default: NOTIFICATION_DELIVERY_STATUS.PENDING, required: true },
    attempt_count: { type: Number, default: 0, min: 0 },
    max_attempt_count: { type: Number, default: 5, min: 0 },
    next_attempt_at: { type: Date },
    last_attempt_at: { type: Date },
    last_error: { type: String },
    sent_at: { type: Date },
    delivered_at: { type: Date },
    payload: { type: Schema.Types.Mixed },
  },
  { ...baseSchemaOptions, collection: 'notification_deliveries' },
);

notificationDeliverySchema.index({ notification_id: 1, channel: 1 });
notificationDeliverySchema.index({ status: 1, channel: 1, next_attempt_at: 1, created_at: 1 });
notificationDeliverySchema.index({ provider: 1, status: 1 });

module.exports = model('NotificationDelivery', notificationDeliverySchema);
