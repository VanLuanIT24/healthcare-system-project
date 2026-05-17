const os = require('os');
const { JobRunLog } = require('../models');

function processedCount(result) {
  if (!result || typeof result !== 'object') return 0;
  for (const key of ['processed', 'processed_count', 'expired_count', 'sent_count', 'updated_count', 'count']) {
    if (Number.isFinite(Number(result[key]))) return Number(result[key]);
  }
  return 0;
}

async function startJobRun({ jobName, queueName, jobId, attempt = 1, correlationId = null } = {}) {
  return JobRunLog.create({
    job_name: jobName || 'unknown',
    queue_name: queueName,
    job_id: jobId ? String(jobId) : undefined,
    attempt,
    worker_id: `${os.hostname()}:${process.pid}`,
    correlation_id: correlationId,
  });
}

async function finishJobRun(run, result = {}) {
  if (!run) return null;
  const finishedAt = new Date();
  run.status = 'success';
  run.finished_at = finishedAt;
  run.duration_ms = finishedAt.getTime() - new Date(run.started_at).getTime();
  run.records_processed = processedCount(result);
  run.result = result;
  await run.save();
  return run;
}

async function failJobRun(run, error) {
  if (!run) return null;
  const finishedAt = new Date();
  run.status = 'failed';
  run.finished_at = finishedAt;
  run.duration_ms = finishedAt.getTime() - new Date(run.started_at).getTime();
  run.error_message = error?.message || String(error);
  run.error_stack = error?.stack;
  await run.save();
  return run;
}

function withJobRunLog(jobName, processor, options = {}) {
  return async function loggedJobProcessor(job) {
    const run = await startJobRun({
      jobName: job?.name || jobName,
      queueName: options.queueName,
      jobId: job?.id,
      attempt: Number(job?.attemptsMade || 0) + 1,
      correlationId: job?.data?.correlation_id || job?.data?.correlationId,
    });
    try {
      const result = await processor(job);
      await finishJobRun(run, result);
      return result;
    } catch (error) {
      await failJobRun(run, error);
      throw error;
    }
  };
}

module.exports = {
  startJobRun,
  finishJobRun,
  failJobRun,
  withJobRunLog,
};
