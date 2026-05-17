const { Types } = require('mongoose');
const {
  Notification,
  NotificationDelivery,
  PatientAccount,
} = require('../models');
const {
  NOTIFICATION_DELIVERY_CHANNEL,
  NOTIFICATION_DELIVERY_STATUS,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_STATUS,
  REALTIME_EVENT_TYPE,
} = require('../constants/statuses');
const realtimeService = require('../realtime/realtime.service');
const { buildRoomsFromScope } = require('../realtime/room-naming');
const templateService = require('./notification-template.service');
const { buildDomainEventEnvelope } = require('../events/domain-event-taxonomy');
const emailProvider = require('./providers/email.provider');
const pushProvider = require('./providers/push.provider');

const OPTIONAL_CHANNEL_PROVIDERS = {
  [NOTIFICATION_DELIVERY_CHANNEL.EMAIL]: emailProvider,
  [NOTIFICATION_DELIVERY_CHANNEL.PUSH]: pushProvider,
};

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function isObjectId(value) {
  return Boolean(value && Types.ObjectId.isValid(String(value)));
}

function mapActorTypeToRecipientType(actorType) {
  if (actorType === 'staff') return 'staff';
  if (actorType === 'patient') return 'patient';
  if (actorType === 'patient_relative') return 'relative';
  if (actorType === 'relative') return 'relative';
  return null;
}

function normalizeRecipient(recipient = {}) {
  const recipientType = recipient.recipient_type || recipient.recipientType || mapActorTypeToRecipientType(recipient.actor_type || recipient.actorType);
  const recipientId = recipient.recipient_id || recipient.recipientId || recipient.actor_id || recipient.actorId;
  if (!recipientType || !isObjectId(recipientId)) return null;
  return {
    recipient_type: recipientType,
    recipient_id: recipientId,
    recipient_actor_type: recipient.actor_type || recipient.actorType || recipientType,
    recipient_actor_id: recipient.actor_id || recipient.actorId || recipientId,
    recipient_user_id: recipient.recipient_user_id || recipient.user_id || recipient.userId || (recipientType === 'staff' ? recipientId : undefined),
    patient_account_id: recipient.patient_account_id || recipient.patientAccountId || (recipientType === 'patient' ? recipientId : undefined),
    patient_id: recipient.patient_id || recipient.patientId,
    relative_id: recipient.relative_id || recipient.relativeId || (recipientType === 'relative' ? recipientId : undefined),
  };
}

function recipientsFromScope(scope = {}) {
  const recipients = [];
  const explicit = scope.recipients || scope.notification_recipients || scope.notificationRecipients;
  if (explicit) {
    (Array.isArray(explicit) ? explicit : [explicit]).forEach((item) => {
      const recipient = normalizeRecipient(item);
      if (recipient) recipients.push(recipient);
    });
  }
  const actors = scope.actors || scope.actor;
  if (actors) {
    (Array.isArray(actors) ? actors : [actors]).forEach((actor) => {
      const recipient = normalizeRecipient(actor);
      if (recipient) recipients.push(recipient);
    });
  }
  const userIds = scope.user_id || scope.userId || scope.user_ids || scope.userIds;
  (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).forEach((id) => {
    const recipient = normalizeRecipient({ recipient_type: 'staff', recipient_id: id, actor_type: 'staff', actor_id: id });
    if (recipient) recipients.push(recipient);
  });
  const patientIds = scope.patient_id || scope.patientId || scope.patient_ids || scope.patientIds;
  (Array.isArray(patientIds) ? patientIds : [patientIds]).filter(Boolean).forEach((id) => {
    const recipient = normalizeRecipient({ recipient_type: 'patient', recipient_id: id, actor_type: 'patient', actor_id: id, patient_id: id });
    if (recipient) recipients.push(recipient);
  });

  const seen = new Set();
  return recipients.filter((recipient) => {
    const key = `${recipient.recipient_type}:${toId(recipient.recipient_id)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function notificationSpec(event = {}) {
  return event.payload?.notification || event.payload?.notify || null;
}

function notificationRecipientScope(notification = {}) {
  return {
    recipients: [{
      recipient_type: notification.recipient_type,
      recipient_id: notification.recipient_id,
      actor_type: notification.recipient_actor_type,
      actor_id: notification.recipient_actor_id,
      recipient_user_id: notification.recipient_user_id,
      patient_account_id: notification.patient_account_id,
      patient_id: notification.patient_id,
      relative_id: notification.relative_id,
    }],
    user_id: notification.recipient_user_id,
    patient_id: notification.patient_id,
  };
}

async function createNotificationForRecipient(event, recipient) {
  const spec = notificationSpec(event);
  if (!spec) return null;
  const resolvedRecipient = { ...recipient };
  if (resolvedRecipient.recipient_type === 'patient') {
    const patientId = resolvedRecipient.patient_id || resolvedRecipient.recipient_id;
    const account = patientId
      ? await PatientAccount.findOne({ patient_id: patientId, is_deleted: false, status: 'active' }).select('_id patient_id').lean()
      : null;
    if (account) {
      resolvedRecipient.recipient_id = account._id;
      resolvedRecipient.patient_account_id = account._id;
      resolvedRecipient.patient_id = account.patient_id;
      resolvedRecipient.recipient_actor_id = account._id;
    }
  }
  const rendered = await templateService.renderNotificationContent({
    eventType: event.event_type,
    payload: event.payload || {},
    language: spec.language || 'vi',
    fallback: {
      title: spec.title,
      body: spec.body || spec.message,
      priority: spec.priority,
      channels: spec.channels,
    },
  });
  if (!rendered.title || !rendered.body) return null;
  const dedupeKey = spec.dedupe_key ? `${spec.dedupe_key}:${recipient.recipient_type}:${toId(recipient.recipient_id)}` : undefined;
  const notificationPayload = {
    recipient_type: resolvedRecipient.recipient_type,
    recipient_id: resolvedRecipient.recipient_id,
    recipient_actor_type: resolvedRecipient.recipient_actor_type,
    recipient_actor_id: resolvedRecipient.recipient_actor_id,
    recipient_user_id: resolvedRecipient.recipient_user_id,
    patient_account_id: resolvedRecipient.patient_account_id,
    patient_id: resolvedRecipient.patient_id,
    relative_id: resolvedRecipient.relative_id,
    channel: 'in_app',
    notification_type: event.event_type,
    event_type: event.event_type,
    priority: rendered.priority || NOTIFICATION_PRIORITY.NORMAL,
    dedupe_key: dedupeKey,
    title: rendered.title,
    message: rendered.body,
    body: rendered.body,
    payload: event.payload,
    data: event.payload?.data || event.payload,
    action_url: spec.action_url || spec.actionUrl,
    status: NOTIFICATION_STATUS.UNREAD,
    created_by_module: 'event-dispatcher',
  };

  try {
    const doc = await Notification.create(notificationPayload);
    return doc.toObject ? doc.toObject() : doc;
  } catch (error) {
    if (error?.code === 11000 && dedupeKey) {
      const existing = await Notification.findOne({ dedupe_key: dedupeKey }).lean();
      return existing ? { ...existing, _dedupe_existing: true } : null;
    }
    throw error;
  }
}

async function createDelivery(notification, channel, payload = {}) {
  if (!notification?._id && !notification?.id) return null;
  return NotificationDelivery.create({
    notification_id: notification._id || notification.id,
    channel,
    provider: payload.provider,
    status: NOTIFICATION_DELIVERY_STATUS.PENDING,
    payload,
  });
}

function emitNotificationCreated(notification, event = {}) {
  if (!notification) return null;
  return realtimeService.emitToScope(REALTIME_EVENT_TYPE.NOTIFICATION_CREATED, {
    notification_id: toId(notification._id || notification.id),
    event_type: event.event_type,
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
    title: notification.title,
    priority: notification.priority,
    status: notification.status,
    created_at: notification.created_at,
  }, notificationRecipientScope(notification), {
    request_id: event.request_id,
  });
}

function channelIsEnabled(channel) {
  const provider = OPTIONAL_CHANNEL_PROVIDERS[channel];
  if (!provider) return false;
  return typeof provider.isEnabled === 'function' ? provider.isEnabled() : true;
}

async function markDelivery(delivery, status, error = null) {
  if (!delivery) return null;
  delivery.status = status;
  delivery.attempt_count = Number(delivery.attempt_count || 0) + 1;
  if (status === NOTIFICATION_DELIVERY_STATUS.SENT) delivery.sent_at = new Date();
  if (status === NOTIFICATION_DELIVERY_STATUS.DELIVERED) {
    delivery.sent_at = delivery.sent_at || new Date();
    delivery.delivered_at = new Date();
  }
  if (error) delivery.last_error = error.message || String(error);
  await delivery.save();
  return delivery;
}

async function dispatchDomainEvent(event = {}) {
  const recipientScope = event.recipient_scope || event.recipientScope || {};
  const rooms = buildRoomsFromScope(recipientScope);
  const envelope = buildDomainEventEnvelope({
    event_id: event.event_id || toId(event._id),
    event_type: event.event_type,
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
    actor: event.actor || null,
    recipients: Array.isArray(event.recipients) && event.recipients.length
      ? event.recipients
      : recipientsFromScope(recipientScope),
    payload: event.payload || {},
    occurred_at: event.occurred_at || event.created_at || new Date(),
    correlation_id: event.correlation_id,
    request_id: event.request_id,
  });
  const realtimeResult = realtimeService.emitToRooms(event.event_type, envelope, rooms, {
    request_id: event.request_id,
  });

  const recipients = recipientsFromScope(recipientScope);
  const notifications = [];
  const deliveries = [];

  for (const recipient of recipients) {
    const notification = await createNotificationForRecipient(event, recipient);
    if (!notification) continue;
    notifications.push(notification);
    if (notification._dedupe_existing) continue;
    emitNotificationCreated(notification, event);

    const inAppDelivery = await createDelivery(notification, NOTIFICATION_DELIVERY_CHANNEL.IN_APP, { event_type: event.event_type });
    await markDelivery(inAppDelivery, NOTIFICATION_DELIVERY_STATUS.DELIVERED);
    deliveries.push(inAppDelivery);

    const socketDelivery = await createDelivery(notification, NOTIFICATION_DELIVERY_CHANNEL.SOCKET, { rooms, event_type: event.event_type });
    await markDelivery(
      socketDelivery,
      realtimeResult.delivered ? NOTIFICATION_DELIVERY_STATUS.DELIVERED : NOTIFICATION_DELIVERY_STATUS.SKIPPED,
      realtimeResult.delivered ? null : new Error(realtimeResult.reason || 'socket_not_delivered'),
    );
    deliveries.push(socketDelivery);

    const spec = notificationSpec(event) || {};
    const fallbackChannels = (spec.channels || []).filter((channel) => ![
      NOTIFICATION_DELIVERY_CHANNEL.IN_APP,
      NOTIFICATION_DELIVERY_CHANNEL.SOCKET,
    ].includes(channel) && channelIsEnabled(channel));
    for (const channel of fallbackChannels) {
      const delivery = await createDelivery(notification, channel, {
        event_type: event.event_type,
        provider: spec.providers?.[channel],
      });
      deliveries.push(delivery);
    }
  }

  return {
    realtime: realtimeResult,
    notification_count: notifications.length,
    delivery_count: deliveries.length,
    delivery_channels: [
      ...new Set([
        ...(realtimeResult.delivered ? [NOTIFICATION_DELIVERY_CHANNEL.SOCKET] : []),
        ...deliveries.map((item) => item.channel).filter(Boolean),
      ]),
    ],
    notification_ids: notifications.map((item) => toId(item._id || item.id)),
  };
}

module.exports = {
  dispatchDomainEvent,
  recipientsFromScope,
};
