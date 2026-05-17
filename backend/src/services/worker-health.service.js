const { EventOutbox, JobRunLog, NotificationDelivery } = require('../models');
const { EVENT_OUTBOX_STATUS, NOTIFICATION_DELIVERY_STATUS } = require('../constants/statuses');

async function countByStatus(Model, statuses = []) {
  const result = {};
  await Promise.all(statuses.map(async (status) => {
    result[status] = await Model.countDocuments({ status });
  }));
  return result;
}

async function getWorkerHealth() {
  const [outbox, deliveries, recentJobs] = await Promise.all([
    countByStatus(EventOutbox, [
      EVENT_OUTBOX_STATUS.PENDING,
      EVENT_OUTBOX_STATUS.FAILED,
      EVENT_OUTBOX_STATUS.DEAD_LETTER,
      EVENT_OUTBOX_STATUS.PROCESSING,
    ]),
    countByStatus(NotificationDelivery, [
      NOTIFICATION_DELIVERY_STATUS.PENDING,
      NOTIFICATION_DELIVERY_STATUS.FAILED,
      NOTIFICATION_DELIVERY_STATUS.SENT,
      NOTIFICATION_DELIVERY_STATUS.DELIVERED,
    ]),
    JobRunLog.find({})
      .sort({ started_at: -1 })
      .limit(20)
      .select('job_name queue_name status started_at finished_at duration_ms records_processed error_message')
      .lean(),
  ]);

  return {
    outbox,
    notification_delivery: deliveries,
    job_runs: recentJobs,
    checked_at: new Date().toISOString(),
  };
}

module.exports = {
  getWorkerHealth,
};
