const auditQueryService = require('../services/audit-query.service');
const { controllerHandler: wrap } = require('../common/controllers');

function requestMeta(req) {
  return {
    requestId: req.context?.request_id,
    sessionId: req.context?.session_id,
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  };
}

module.exports = {
  listAuditLogs: wrap(
    (req) => auditQueryService.listAuditLogs(req.query, req.auth),
    'Lấy danh sách audit logs thành công.',
  ),
  getAuditLogDetail: wrap(
    (req) => auditQueryService.getAuditLogDetail(req.params.auditLogId, req.auth),
    'Lấy chi tiết audit log thành công.',
  ),
  getAuditLogsByActor: wrap(
    (req) => auditQueryService.getAuditLogsByActor(req.params.actorType, req.params.actorId, req.query, req.auth),
    'Lấy audit logs theo actor thành công.',
  ),
  getAuditLogsByEntity: wrap(
    (req) => auditQueryService.getAuditLogsByEntity(req.params.targetType, req.params.targetId, req.query, req.auth),
    'Lấy audit logs theo entity thành công.',
  ),
  getLoginHistory: wrap(
    (req) => auditQueryService.getLoginHistory(req.params.actorType, req.params.actorId, req.query, req.auth),
    'Lấy lịch sử đăng nhập thành công.',
  ),
  exportAuditLogs: wrap(
    (req) => auditQueryService.exportAuditLogs(req.query, req.auth, requestMeta(req)),
    'Export audit logs thành công.',
  ),
};
