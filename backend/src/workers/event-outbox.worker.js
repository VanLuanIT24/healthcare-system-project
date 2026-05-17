const jobQueue = require('../jobs/job-queue.service');
const eventPublisher = require('../events/event-publisher.worker');
const { connectDatabase } = require('../config/database');
require('../models');

const QUEUE_NAME = 'event-outbox';
const JOB_NAME = 'publish-pending-events';

function pollIntervalMs() {
  const value = Number(process.env.EVENT_OUTBOX_POLL_INTERVAL_MS || 5000);
  return Number.isFinite(value) && value >= 1000 ? value : 5000;
}

async function startEventOutboxWorker(options = {}) {
  const intervalMs = options.intervalMs || pollIntervalMs();
  const limit = options.limit || 50;

  if (jobQueue.isQueueEnabled()) {
    const worker = jobQueue.createWorker(QUEUE_NAME, async (job) => {
      if (job.name !== JOB_NAME) return { skipped: true, reason: 'unknown_job' };
      return eventPublisher.runOnce({ limit: job.data?.limit || limit });
    });
    const schedule = await jobQueue.enqueueJob(QUEUE_NAME, JOB_NAME, { limit }, {
      jobOptions: {
        jobId: `${JOB_NAME}:repeat`,
        repeat: { every: intervalMs },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    });
    return { mode: 'bullmq', queue: QUEUE_NAME, schedule, worker };
  }

  const timer = setInterval(() => {
    eventPublisher.runOnce({ limit }).catch((error) => {
      console.warn(`Event outbox poll failed: ${error.message}`);
    });
  }, intervalMs);
  return { mode: 'interval', intervalMs, timer };
}

async function stopEventOutboxWorker(handle) {
  if (handle?.timer) clearInterval(handle.timer);
  await jobQueue.closeQueues();
}

if (require.main === module) {
  let handle;
  connectDatabase()
    .then(() => startEventOutboxWorker())
    .then((started) => {
      handle = started;
      console.info(`Event outbox worker started in ${started.mode} mode.`);
    })
    .catch((error) => {
      console.error(`Event outbox worker failed to start: ${error.message}`);
      process.exitCode = 1;
    });

  const shutdown = async () => {
    await stopEventOutboxWorker(handle);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  QUEUE_NAME,
  JOB_NAME,
  startEventOutboxWorker,
  stopEventOutboxWorker,
};
