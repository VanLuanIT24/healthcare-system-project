const auditService = require('../audit.service');

function recordIamAudit({
  actor,
  action,
  targetType,
  targetId,
  requestMeta,
  before,
  after,
  metadata,
  message,
}) {
  return auditService.recordAuditLog({
    actor,
    action,
    targetType,
    targetId,
    status: 'success',
    message,
    requestMeta,
    before,
    after,
    metadata,
    strict: true,
  });
}

module.exports = {
  // recordIamAudit: Ghi nhận nhật ký kiểm toán IAM.
  recordIamAudit,
};
