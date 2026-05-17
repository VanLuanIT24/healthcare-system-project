const env = require('../config/env');
const jobRunLog = require('./job-run-log.service');

const queues = new Map();
const workers = new Map();

function loadBullMq() {
  try {
    return require('bullmq');
  } catch (error) {
    return null;
  }
}

function isQueueEnabled() {
  return Boolean(env.redisUrl && env.jobsRedisEnabled && loadBullMq());
}

function connectionOptions() {
  if (!env.redisUrl) return null;
  try {
    const parsed = new URL(env.redisUrl);
    const db = parsed.pathname && parsed.pathname !== '/'
      ? Number(parsed.pathname.replace('/', ''))
      : undefined;
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      db: Number.isFinite(db) ? db : undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  } catch (error) {
    return {
      host: env.redisUrl,
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }
}

function getQueue(name, options = {}) {
  if (!isQueueEnabled()) return null;
  if (queues.has(name)) return queues.get(name);

  const { Queue } = loadBullMq();
  const queue = new Queue(name, {
    connection: connectionOptions(),
    defaultJobOptions: {
      attempts: options.attempts || 3,
      backoff: options.backoff || { type: 'exponential', delay: 5000 },
      removeOnComplete: options.removeOnComplete ?? 1000,
      removeOnFail: options.removeOnFail ?? 5000,
    },
  });
  queues.set(name, queue);
  return queue;
}

async function enqueueJob(queueName, jobName, payload = {}, options = {}) {
  const queue = getQueue(queueName, options);
  if (!queue) {
    return { queued: false, reason: env.redisUrl ? 'bullmq_unavailable' : 'redis_unconfigured' };
  }
  const job = await queue.add(jobName, payload, options.jobOptions || {});
  return { queued: true, queue: queueName, job_id: job.id };
}

function createWorker(queueName, processor, options = {}) {
  if (!isQueueEnabled()) return null;
  if (workers.has(queueName)) return workers.get(queueName);
  const { Worker } = loadBullMq();
  const worker = new Worker(queueName, jobRunLog.withJobRunLog(queueName, processor, { queueName }), {
    connection: connectionOptions(),
    concurrency: options.concurrency || env.jobWorkerConcurrency,
  });
  worker.on('failed', (job, error) => {
    console.warn(`BullMQ job failed: ${queueName}/${job?.name || 'unknown'} - ${error.message}`);
  });
  workers.set(queueName, worker);
  return worker;
}

async function closeQueues() {
  const activeWorkers = [...workers.values()];
  const activeQueues = [...queues.values()];
  await Promise.all(activeWorkers.map((worker) => worker.close()));
  await Promise.all(activeQueues.map((queue) => queue.close()));
  workers.clear();
  queues.clear();
}

module.exports = {
  isQueueEnabled,
  getQueue,
  enqueueJob,
  createWorker,
  closeQueues,
  jobRunLog,
};
