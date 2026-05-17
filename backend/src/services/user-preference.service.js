const ApiError = require('../common/errors/api-error');
const actorContext = require('../common/actors');
const { UserPreference } = require('../models');

const DEFAULT_PREFERENCES = {
  language: 'vi',
  timezone: 'Asia/Ho_Chi_Minh',
  date_format: 'DD/MM/YYYY',
  notification_channels: ['in_app'],
  quiet_hours: { enabled: false },
  accessibility: {
    reduce_motion: false,
    high_contrast: false,
    large_text: false,
  },
  critical_notifications_enabled: true,
};

function preferenceActor(actor = {}) {
  const context = actorContext.buildActorContext(actor, { requireActorId: false });
  const actorType = context.actor_type;
  const actorId = context.actor_id;
  if (!actorType || !actorId) throw ApiError.unauthorized('Không xác định được actor preference.');
  return { actor_type: actorType, actor_id: actorId };
}

function sanitizePreferencePayload(payload = {}) {
  const output = {};
  for (const field of ['language', 'timezone', 'date_format', 'notification_channels', 'quiet_hours', 'accessibility', 'default_patient_profile_id']) {
    if (payload[field] !== undefined) output[field] = payload[field];
  }
  if (payload.critical_notifications_enabled === false) {
    throw ApiError.conflict('Không thể tắt hoàn toàn emergency/critical notifications.');
  }
  output.critical_notifications_enabled = true;
  return output;
}

async function getPreferences(actor = {}) {
  const identity = preferenceActor(actor);
  const preference = await UserPreference.findOne(identity).lean();
  return {
    preferences: {
      ...DEFAULT_PREFERENCES,
      ...(preference || {}),
      actor_type: identity.actor_type,
      actor_id: identity.actor_id,
      critical_notifications_enabled: true,
    },
  };
}

async function updatePreferences(payload = {}, actor = {}) {
  const identity = preferenceActor(actor);
  const preference = await UserPreference.findOneAndUpdate(
    identity,
    {
      $set: sanitizePreferencePayload(payload),
      $setOnInsert: identity,
    },
    { new: true, upsert: true },
  ).lean();
  return { preferences: preference };
}

module.exports = {
  getPreferences,
  updatePreferences,
};
