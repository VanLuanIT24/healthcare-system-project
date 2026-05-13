const { model } = require('mongoose');
const { Schema, baseSchemaOptions, auditFields } = require('../common/base-model');
const {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_RECIPIENT_TYPES,
  NOTIFICATION_STATUS,
  NOTIFICATION_STATUSES,
} = require('../../constants/statuses');

// Bảng notifications: Lưu thông báo gửi tới nhân viên, bệnh nhân hoặc người nhà.

const notificationSchema = new Schema(
  {
    recipient_type: { type: String, enum: NOTIFICATION_RECIPIENT_TYPES, required: true },
    recipient_id: { type: Schema.Types.ObjectId, required: true },
    recipient_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    patient_account_id: { type: Schema.Types.ObjectId, ref: 'PatientAccount' },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    relative_id: { type: Schema.Types.ObjectId, ref: 'PatientRelative' },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, default: NOTIFICATION_CHANNEL.IN_APP, required: true },
    notification_type: { type: String, trim: true },
    priority: { type: String, enum: NOTIFICATION_PRIORITIES, default: NOTIFICATION_PRIORITY.NORMAL, required: true },
    dedupe_key: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    payload: { type: Schema.Types.Mixed },
    action_url: { type: String, trim: true },
    expires_at: { type: Date },
    created_by_module: { type: String, trim: true },
    scheduled_at: { type: Date },
    sent_at: { type: Date },
    delivered_at: { type: Date },
    read_at: { type: Date },
    failed_at: { type: Date },
    failure_reason: { type: String },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: NOTIFICATION_STATUS.QUEUED, required: true },
    ...auditFields(),
  },
  { ...baseSchemaOptions, collection: 'notifications' },
);

notificationSchema.index({ recipient_user_id: 1 });
notificationSchema.index({ patient_account_id: 1 });
notificationSchema.index({ patient_id: 1 });
notificationSchema.index({ relative_id: 1 });
notificationSchema.index({ recipient_type: 1 });
notificationSchema.index({ recipient_id: 1 });
notificationSchema.index({ channel: 1 });
notificationSchema.index({ notification_type: 1 });
notificationSchema.index({ priority: 1, created_at: -1 });
notificationSchema.index({ dedupe_key: 1 }, { unique: true, sparse: true });
notificationSchema.index({ scheduled_at: 1 });
notificationSchema.index({ sent_at: 1 });
notificationSchema.index({ read_at: 1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ recipient_user_id: 1, status: 1, created_at: -1 });
notificationSchema.index({ patient_account_id: 1, status: 1, created_at: -1 });
notificationSchema.index({ recipient_type: 1, recipient_id: 1, status: 1, created_at: -1 });
notificationSchema.index({ notification_type: 1, created_at: -1 });
notificationSchema.index({ scheduled_at: 1, status: 1 });

module.exports = model('Notification', notificationSchema);
