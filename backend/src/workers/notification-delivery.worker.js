const { connectDatabase, mongoose } = require('../config/database');
require('../models');
const notificationJobs = require('../jobs/notification.jobs');

function pollIntervalMs() {
  const value = Number(process.env.NOTIFICATION_DELIVERY_POLL_INTERVAL_MS || 5000);
  return Number.isFinite(value) && value >= 1000 ? value : 5000;
}

function archiveIntervalMs() {
  const value = Number(process.env.NOTIFICATION_ARCHIVE_INTERVAL_MS || 60 * 60 * 1000);
  return Number.isFinite(value) && value >= 60 * 1000 ? value : 60 * 60 * 1000;
}

async function runOnce({ limit = Number(process.env.NOTIFICATION_DELIVERY_BATCH_SIZE || 50) } = {}) {
  const [queued, deliveries] = await Promise.all([
    notificationJobs.dispatchQueuedNotifications(limit),
    notificationJobs.dispatchNotificationDeliveries({ limit }),
  ]);
  return { queued, deliveries };
}

async function startNotificationDeliveryWorker(options = {}) {
  const intervalMs = options.intervalMs || pollIntervalMs();
  const archiveMs = options.archiveIntervalMs || archiveIntervalMs();
  const limit = options.limit || Number(process.env.NOTIFICATION_DELIVERY_BATCH_SIZE || 50);

  const pollTimer = setInterval(() => {
    runOnce({ limit }).catch((error) => {
      console.warn(`Notification delivery poll failed: ${error.message}`);
    });
  }, intervalMs);

  const archiveTimer = setInterval(() => {
    notificationJobs.archiveOldNotifications().catch((error) => {
      console.warn(`Notification archive job failed: ${error.message}`);
    });
  }, archiveMs);

  await runOnce({ limit });
  return { mode: 'interval', intervalMs, archiveMs, pollTimer, archiveTimer };
}

async function stopNotificationDeliveryWorker(handle) {
  if (handle?.pollTimer) clearInterval(handle.pollTimer);
  if (handle?.archiveTimer) clearInterval(handle.archiveTimer);
  await mongoose.disconnect();
}

if (require.main === module) {
  let handle;
  connectDatabase()
    .then(() => startNotificationDeliveryWorker())
    .then((started) => {
      handle = started;
      console.info(`Notification delivery worker started in ${started.mode} mode.`);
    })
    .catch((error) => {
      console.error(`Notification delivery worker failed to start: ${error.message}`);
      process.exitCode = 1;
    });

  const shutdown = async () => {
    await stopNotificationDeliveryWorker(handle);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  runOnce,
  startNotificationDeliveryWorker,
  stopNotificationDeliveryWorker,
};
