function buildPendingScanResult() {
  return {
    scan_status: 'pending',
    scan_result: {
      provider: process.env.FILE_SCAN_PROVIDER || 'manual',
      queued_at: new Date(),
    },
  };
}

function assertCleanForRelease(attachment = {}) {
  if (attachment.scan_status === 'infected') {
    const error = new Error('Attachment scan failed: infected file.');
    error.statusCode = 409;
    throw error;
  }
  if (!['clean', 'skipped'].includes(attachment.scan_status)) {
    const error = new Error('Attachment chưa scan sạch.');
    error.statusCode = 409;
    throw error;
  }
  return true;
}

module.exports = {
  buildPendingScanResult,
  assertCleanForRelease,
};
