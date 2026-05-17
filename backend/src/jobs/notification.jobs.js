const eventPublisher = require('../events/event-publisher.worker');
const notificationService = require('../services/notification.service');
const notificationDeliveryWorker = require('../notifications/notification-delivery.worker');
const actorContext = require('../common/actors');
const { Notification } = require('../models');
const { NOTIFICATION_STATUS } = require('../constants/statuses');

function systemActor(serviceName) {
  return actorContext.buildSystemActor({
    serviceName,
    permissions: ['system.full_access'],
  });
}

async function publishOutboxEvents(options = {}) {
  return eventPublisher.runOnce(options);
}

async function dispatchQueuedNotifications(limit = 50) {
  return notificationService.dispatchQueuedNotifications(limit, systemActor('notification-jobs'));
}

async function dispatchNotificationDeliveries(options = {}) {
  return notificationDeliveryWorker.dispatchPendingDeliveries(options);
}

async function archiveOldNotifications({ olderThanDays = Number(process.env.NOTIFICATION_ARCHIVE_AFTER_DAYS || 180) } = {}) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await Notification.updateMany(
    {
      status: { $in: [NOTIFICATION_STATUS.READ, NOTIFICATION_STATUS.DELIVERED] },
      created_at: { $lte: cutoff },
    },
    {
      $set: {
        status: NOTIFICATION_STATUS.ARCHIVED,
        archived_at: new Date(),
      },
    },
  );
  return { archived_count: result.modifiedCount || 0, cutoff };
}

module.exports = {
  publishOutboxEvents,
  dispatchQueuedNotifications,
  dispatchNotificationDeliveries,
  archiveOldNotifications,
};
