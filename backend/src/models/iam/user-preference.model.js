const { model } = require('mongoose');
const { Schema, baseSchemaOptions } = require('../common/base-model');
const { ACTOR_TYPES, NOTIFICATION_PREFERENCE_CHANNELS } = require('../../constants/statuses');

// Bảng user_preferences: Lưu tuỳ chọn trải nghiệm chung của actor.

const userPreferenceSchema = new Schema(
  {
    actor_type: { type: String, enum: ACTOR_TYPES, required: true },
    actor_id: { type: Schema.Types.Mixed, required: true },
    language: { type: String, trim: true, default: 'vi' },
    timezone: { type: String, trim: true, default: 'Asia/Ho_Chi_Minh' },
    date_format: { type: String, trim: true, default: 'DD/MM/YYYY' },
    notification_channels: [{ type: String, enum: NOTIFICATION_PREFERENCE_CHANNELS }],
    quiet_hours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, trim: true },
      end: { type: String, trim: true },
      timezone: { type: String, trim: true },
    },
    accessibility: {
      reduce_motion: { type: Boolean, default: false },
      high_contrast: { type: Boolean, default: false },
      large_text: { type: Boolean, default: false },
    },
    current_workspace: { type: String, trim: true, default: 'nursing' },
    workspace_preferences: { type: Schema.Types.Mixed, default: {} },
    default_patient_profile_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    critical_notifications_enabled: { type: Boolean, default: true, required: true },
  },
  { ...baseSchemaOptions, collection: 'user_preferences' },
);

userPreferenceSchema.pre('validate', function preventCriticalOptOut(next) {
  if (this.critical_notifications_enabled === false) {
    return next(new Error('critical_notifications_enabled cannot be disabled.'));
  }
  return next();
});

userPreferenceSchema.index({ actor_type: 1, actor_id: 1 }, { unique: true });
userPreferenceSchema.index({ default_patient_profile_id: 1 });

module.exports = model('UserPreference', userPreferenceSchema);
