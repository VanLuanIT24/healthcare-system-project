const { Notification, NotificationDelivery } = require('../models');
const os = require('os');
const {
  NOTIFICATION_DELIVERY_CHANNEL,
  NOTIFICATION_DELIVERY_STATUS,
  REALTIME_EVENT_TYPE,
} = require('../constants/statuses');
const eventBus = require('../events/event-bus.service');
const emailProvider = require('./providers/email.provider');
const pushProvider = require('./providers/push.provider');

const PROVIDERS = {
  [NOTIFICATION_DELIVERY_CHANNEL.EMAIL]: emailProvider,
  [NOTIFICATION_DELIVERY_CHANNEL.PUSH]: pushProvider,
};

const DELIVERY_PROCESSING_LOCK_MS = 5 * 60 * 1000;

function nextAttemptDate(attemptCount) {
  const seconds = Math.min(900, 2 ** Math.min(Number(attemptCount || 0), 8) * 30);
  return new Date(Date.now() + seconds * 1000);
}

function notificationRecipientScope(notification = {}) {
  const recipients = [{
    recipient_type: notification.recipient_type,
    recipient_id: notification.recipient_id,
    actor_type: notification.recipient_actor_type,
    actor_id: notification.recipient_actor_id,
    recipient_user_id: notification.recipient_user_id,
    patient_account_id: notification.patient_account_id,
    patient_id: notification.patient_id,
    relative_id: notification.relative_id,
  }];
  return {
    recipients,
    user_id: notification.recipient_user_id,
    patient_id: notification.patient_id,
  };
}

async function emitDeliveryFailure(notification, delivery) {
  if (!notification) return null;
  return eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.NOTIFICATION_DELIVERY_FAILED,
    aggregateType: 'notification_delivery',
    aggregateId: delivery._id,
    recipientScope: notificationRecipientScope(notification),
    payload: {
      notification_id: String(notification._id),
      delivery_id: String(delivery._id),
      channel: delivery.channel,
      last_error: delivery.last_error,
      notification: {
        title: 'Gửi thông báo thất bại',
        body: `Không gửi được thông báo qua kênh ${delivery.channel}.`,
        priority: 'high',
      },
    },
  });
}

async function markFailure(delivery, notification, error) {
  delivery.attempt_count = Number(delivery.attempt_count || 0) + 1;
  delivery.last_attempt_at = new Date();
  delivery.last_error = error.message || String(error);
  delivery.payload = {
    ...(delivery.payload || {}),
    processing_at: null,
    processing_by: null,
  };
  if (delivery.attempt_count >= Number(delivery.max_attempt_count || 5)) {
    delivery.status = NOTIFICATION_DELIVERY_STATUS.FAILED;
    delivery.next_attempt_at = undefined;
    await delivery.save();
    await emitDeliveryFailure(notification, delivery);
    return delivery;
  }
  delivery.status = NOTIFICATION_DELIVERY_STATUS.PENDING;
  delivery.next_attempt_at = nextAttemptDate(delivery.attempt_count);
  await delivery.save();
  return delivery;
}

async function claimDeliveryForDispatch(deliveryId, workerId) {
  const now = new Date();
  const staleProcessingBefore = new Date(now.getTime() - DELIVERY_PROCESSING_LOCK_MS);
  return NotificationDelivery.findOneAndUpdate(
    {
      _id: deliveryId,
      status: NOTIFICATION_DELIVERY_STATUS.PENDING,
      $or: [
        { next_attempt_at: null },
        { next_attempt_at: { $exists: false } },
        { next_attempt_at: { $lte: now } },
      ],
      $and: [{
        $or: [
          { 'payload.processing_at': null },
          { 'payload.processing_at': { $exists: false } },
          { 'payload.processing_at': { $lte: staleProcessingBefore } },
          { 'payload.processing_by': workerId },
        ],
      }],
    },
    {
      $set: {
        'payload.processing_at': now,
        'payload.processing_by': workerId,
      },
    },
    { new: true },
  );
}

async function dispatchDelivery(deliveryId, { workerId = `${os.hostname()}:${process.pid}` } = {}) {
  const delivery = await claimDeliveryForDispatch(deliveryId, workerId);
  if (!delivery) return { skipped: true, reason: 'delivery_not_found' };
  if (delivery.status !== NOTIFICATION_DELIVERY_STATUS.PENDING) {
    return { skipped: true, reason: 'delivery_not_pending', status: delivery.status };
  }

  const notification = await Notification.findById(delivery.notification_id).lean();
  if (!notification) {
    delivery.status = NOTIFICATION_DELIVERY_STATUS.FAILED;
    delivery.last_error = 'notification_not_found';
    delivery.attempt_count = Number(delivery.attempt_count || 0) + 1;
    delivery.last_attempt_at = new Date();
    delivery.payload = {
      ...(delivery.payload || {}),
      processing_at: null,
      processing_by: null,
    };
    await delivery.save();
    return delivery.toObject();
  }

  if (delivery.channel === NOTIFICATION_DELIVERY_CHANNEL.IN_APP) {
    delivery.status = NOTIFICATION_DELIVERY_STATUS.DELIVERED;
    delivery.attempt_count = Number(delivery.attempt_count || 0) + 1;
    delivery.last_attempt_at = new Date();
    delivery.sent_at = delivery.sent_at || new Date();
    delivery.delivered_at = delivery.delivered_at || new Date();
    delivery.payload = {
      ...(delivery.payload || {}),
      processing_at: null,
      processing_by: null,
    };
    await delivery.save();
    return delivery.toObject();
  }

  const provider = PROVIDERS[delivery.channel];
  if (!provider) {
    return markFailure(delivery, notification, new Error(`provider_not_supported:${delivery.channel}`));
  }
  if (typeof provider.isEnabled === 'function' && !provider.isEnabled()) {
    return markFailure(delivery, notification, new Error(`provider_disabled:${delivery.channel}`));
  }

  try {
    const result = await provider.send(notification, delivery);
    delivery.status = result.delivered
      ? NOTIFICATION_DELIVERY_STATUS.DELIVERED
      : NOTIFICATION_DELIVERY_STATUS.SENT;
    delivery.attempt_count = Number(delivery.attempt_count || 0) + 1;
    delivery.last_attempt_at = new Date();
    delivery.sent_at = delivery.sent_at || new Date();
    if (result.delivered) delivery.delivered_at = new Date();
    delivery.last_error = undefined;
    delivery.payload = {
      ...(delivery.payload || {}),
      provider_result: result,
      processing_at: null,
      processing_by: null,
    };
    await delivery.save();
    return delivery.toObject();
  } catch (error) {
    return markFailure(delivery, notification, error);
  }
}

async function dispatchPendingDeliveries({ limit = 50 } = {}) {
  const now = new Date();
  const deliveries = await NotificationDelivery.find({
    status: NOTIFICATION_DELIVERY_STATUS.PENDING,
    $or: [
      { next_attempt_at: null },
      { next_attempt_at: { $exists: false } },
      { next_attempt_at: { $lte: now } },
    ],
  }).sort({ created_at: 1 }).limit(Number(limit) || 50).lean();

  let sent = 0;
  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  const delivery_ids = [];
  for (const delivery of deliveries) {
    const result = await dispatchDelivery(delivery._id);
    if (result?.skipped) continue;
    delivery_ids.push(String(delivery._id));
    if (result.status === NOTIFICATION_DELIVERY_STATUS.DELIVERED) delivered += 1;
    else if (result.status === NOTIFICATION_DELIVERY_STATUS.SENT) sent += 1;
    else if (result.status === NOTIFICATION_DELIVERY_STATUS.SKIPPED) skipped += 1;
    else if (result.status === NOTIFICATION_DELIVERY_STATUS.FAILED) failed += 1;
  }
  return { processed: delivery_ids.length, sent, delivered, skipped, failed, delivery_ids };
}

module.exports = {
  dispatchDelivery,
  dispatchPendingDeliveries,
};
