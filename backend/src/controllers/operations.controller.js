const operationsService = require('../services/operations/operations.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

function actionMeta(req) {
  return {
    ...requestMeta(req),
    requestId: req.context?.request_id || req.headers?.['x-request-id'],
    reason: req.body?.reason,
  };
}

module.exports = {
  getDashboard: wrap(() => operationsService.getDashboard(), 'Lấy Operations Center dashboard thành công.'),
  getSchedulingDashboardToday: wrap((req) => operationsService.getSchedulingDashboardToday(req.query, req.auth), 'Lấy dashboard vận hành hôm nay thành công.'),
  getSchedulingHourlyFlow: wrap((req) => operationsService.getSchedulingHourlyFlow(req.query, req.auth), 'Lấy luồng vận hành theo giờ thành công.'),
  getHealth: wrap(() => operationsService.getHealth(), 'Lấy Operations Center health thành công.'),

  getJobs: wrap((req) => operationsService.getJobs(req.query), 'Lấy danh sách job thành công.'),
  runJobNow: wrap((req) => operationsService.runJobNow(req.params.jobName, req.body, req.auth, actionMeta(req)), 'Chạy job thủ công thành công.'),
  listJobRuns: wrap((req) => operationsService.listJobRuns(req.query), 'Lấy job run logs thành công.'),
  getJobRun: wrap((req) => operationsService.getJobRun(req.params.runId), 'Lấy chi tiết job run thành công.'),
  retryJobRun: wrap((req) => operationsService.retryJobRun(req.params.runId, req.body, req.auth, actionMeta(req)), 'Retry job run thành công.'),
  listQueues: wrap((req) => operationsService.listQueues(req.query), 'Lấy danh sách queue thành công.'),
  getQueueStats: wrap((req) => operationsService.getQueueStats(req.params.queueName), 'Lấy queue stats thành công.'),
  pauseQueue: wrap((req) => operationsService.queueAction(req.params.queueName, 'pause', req.auth, actionMeta(req)), 'Pause queue thành công.'),
  resumeQueue: wrap((req) => operationsService.queueAction(req.params.queueName, 'resume', req.auth, actionMeta(req)), 'Resume queue thành công.'),
  drainQueue: wrap((req) => operationsService.queueAction(req.params.queueName, 'drain', req.auth, actionMeta(req)), 'Drain queue thành công.'),

  listEventOutbox: wrap((req) => operationsService.listEventOutbox(req.query), 'Lấy event outbox thành công.'),
  getEventOutboxSummary: wrap(() => operationsService.getEventOutboxSummary(), 'Lấy tổng hợp event outbox thành công.'),
  getEventOutboxDetail: wrap((req) => operationsService.getEventOutboxDetail(req.params.eventId), 'Lấy chi tiết event outbox thành công.'),
  retryEvent: wrap((req) => operationsService.retryEvent(req.params.eventId, req.body, req.auth, actionMeta(req)), 'Retry event thành công.'),
  replayEvent: wrap((req) => operationsService.replayEvent(req.params.eventId, req.body, req.auth, actionMeta(req)), 'Replay event thành công.'),
  unlockEvent: wrap((req) => operationsService.unlockEvent(req.params.eventId, req.body, req.auth, actionMeta(req)), 'Unlock event thành công.'),
  markEventDeadLetter: wrap((req) => operationsService.markEventDeadLetter(req.params.eventId, req.body, req.auth, actionMeta(req)), 'Mark dead-letter event thành công.'),
  bulkRetryEvents: wrap((req) => operationsService.bulkRetryEvents(req.body, req.auth, actionMeta(req)), 'Bulk retry event thành công.'),
  listDeadLetterEvents: wrap((req) => operationsService.listDeadLetterEvents(req.query), 'Lấy dead-letter events thành công.'),
  retryPreview: wrap((req) => operationsService.retryPreview(req.body), 'Lấy retry preview thành công.'),
  retryConsole: wrap((req) => operationsService.retryEvent(req.body.event_id || req.body.eventId, req.body, req.auth, actionMeta(req)), 'Retry event từ console thành công.'),
  replayConsole: wrap((req) => operationsService.replayEvent(req.body.event_id || req.body.eventId, req.body, req.auth, actionMeta(req)), 'Replay event từ console thành công.'),
  dryRunEvent: wrap((req) => operationsService.retryPreview(req.body), 'Dry-run event thành công.'),

  listNotificationDeliveries: wrap((req) => operationsService.listNotificationDeliveries(req.query), 'Lấy notification delivery thành công.'),
  getNotificationDeliveriesSummary: wrap(() => operationsService.getNotificationDeliveriesSummary(), 'Lấy tổng hợp notification delivery thành công.'),
  getNotificationDeliveryDetail: wrap((req) => operationsService.getNotificationDeliveryDetail(req.params.deliveryId), 'Lấy chi tiết notification delivery thành công.'),
  retryNotificationDelivery: wrap((req) => operationsService.retryNotificationDelivery(req.params.deliveryId, req.body, req.auth, actionMeta(req)), 'Retry notification delivery thành công.'),
  bulkRetryNotificationDeliveries: wrap((req) => operationsService.bulkRetryNotificationDeliveries(req.body, req.auth, actionMeta(req)), 'Bulk retry notification delivery thành công.'),
  markNotificationDeliverySkipped: wrap((req) => operationsService.markNotificationDeliverySkipped(req.params.deliveryId, req.body, req.auth, actionMeta(req)), 'Mark notification delivery skipped thành công.'),
  getNotificationFailureGroups: wrap((req) => operationsService.getNotificationFailureGroups(req.query), 'Lấy nhóm lỗi notification thành công.'),
  retryNotificationFailureGroup: wrap((req) => operationsService.retryNotificationFailureGroup(req.params.groupKey, req.body, req.auth, actionMeta(req)), 'Retry nhóm lỗi notification thành công.'),

  getRealtimeStatus: wrap(() => operationsService.getRealtimeStatus(), 'Lấy realtime status thành công.'),
  listRealtimeRooms: wrap(() => ({ items: operationsService.listRealtimeRooms() }), 'Lấy realtime rooms thành công.'),
  resolveRealtimeRooms: wrap((req) => operationsService.resolveRealtimeRooms(req.body), 'Resolve realtime rooms thành công.'),
  testRealtimeEmit: wrap((req) => operationsService.testRealtimeEmit(req.body, req.auth, actionMeta(req)), 'Test realtime emit thành công.'),
  listSocketPresence: wrap((req) => operationsService.listSocketPresence(req.query), 'Lấy socket presence thành công.'),
  getSocketPresenceActor: wrap((req) => operationsService.listSocketPresence({ actor_type: req.params.actorType, actor_id: req.params.actorId }), 'Lấy presence actor thành công.'),
  disconnectSocket: wrap((req) => operationsService.disconnectSocket(req.params.socketId, req.body, req.auth, actionMeta(req)), 'Ngắt socket thành công.'),
  pruneSocketPresence: wrap(() => operationsService.pruneSocketPresence(), 'Prune stale presence thành công.'),

  listIdempotencyRecords: wrap((req) => operationsService.listIdempotencyRecords(req.query), 'Lấy idempotency records thành công.'),
  getIdempotencySummary: wrap(() => operationsService.getIdempotencySummary(), 'Lấy tổng hợp idempotency thành công.'),
  getIdempotencyRecord: wrap((req) => operationsService.getIdempotencyRecord(req.params.recordId), 'Lấy chi tiết idempotency record thành công.'),
  unlockIdempotencyRecord: wrap((req) => operationsService.unlockIdempotencyRecord(req.params.recordId, req.body, req.auth, actionMeta(req)), 'Unlock idempotency record thành công.'),
  expireIdempotencyRecord: wrap((req) => operationsService.expireIdempotencyRecord(req.params.recordId, req.body, req.auth, actionMeta(req)), 'Expire idempotency record thành công.'),
  cleanupExpiredIdempotencyRecords: wrap((req) => operationsService.cleanupExpiredIdempotencyRecords(req.body, req.auth, actionMeta(req)), 'Cleanup idempotency records thành công.'),

  listQrTokens: wrap((req) => operationsService.listQrTokens(req.query), 'Lấy QR tokens thành công.'),
  getQrTokensSummary: wrap(() => operationsService.getQrTokensSummary(), 'Lấy tổng hợp QR token thành công.'),
  getQrToken: wrap((req) => operationsService.getQrToken(req.params.qrTokenId), 'Lấy chi tiết QR token thành công.'),
  revokeQrToken: wrap((req) => operationsService.revokeQrToken(req.params.qrTokenId, req.body, req.auth, actionMeta(req)), 'Revoke QR token thành công.'),
  bulkRevokeQrTokens: wrap((req) => operationsService.bulkRevokeQrTokens(req.body, req.auth, actionMeta(req)), 'Bulk revoke QR tokens thành công.'),
  cleanupExpiredQrTokens: wrap((req) => operationsService.cleanupExpiredQrTokens(req.body, req.auth, actionMeta(req)), 'Cleanup QR tokens thành công.'),

  listFileScans: wrap((req) => operationsService.listFileScans(req.query), 'Lấy file scan status thành công.'),
  getFileScansSummary: wrap(() => operationsService.getFileScansSummary(), 'Lấy tổng hợp file scan thành công.'),
  getFileScanProviderHealth: wrap(() => operationsService.getFileScanProviderHealth(), 'Lấy file scan provider health thành công.'),
  bulkRescanFiles: wrap((req) => operationsService.bulkFileScanAction('rescan', req.body, req.auth, actionMeta(req)), 'Bulk rescan file thành công.'),
  bulkQuarantineFiles: wrap((req) => operationsService.bulkFileScanAction('quarantine', req.body, req.auth, actionMeta(req)), 'Bulk quarantine file thành công.'),

  getDiagnostics: wrap(() => operationsService.getDiagnostics(), 'Lấy diagnostics thành công.'),
  runDiagnostics: wrap((req) => operationsService.runDiagnostics(req.body, req.auth, actionMeta(req)), 'Chạy diagnostics thành công.'),
  runDiagnosticCheck: wrap((req) => operationsService.runDiagnostics({ ...req.body, check_name: req.params.checkName }, req.auth, actionMeta(req)), 'Chạy diagnostic check thành công.'),
  listDiagnosticRuns: wrap((req) => operationsService.listDiagnosticRuns(req.query), 'Lấy diagnostic runs thành công.'),
  getDiagnosticRun: wrap((req) => operationsService.getDiagnosticRun(req.params.runId), 'Lấy diagnostic run thành công.'),

  getMaintenance: wrap(() => operationsService.getMaintenance(), 'Lấy maintenance mode thành công.'),
  startMaintenance: wrap((req) => operationsService.startMaintenance(req.body, req.auth, actionMeta(req)), 'Bật maintenance mode thành công.'),
  endMaintenance: wrap((req) => operationsService.endMaintenance(req.params.maintenanceId || req.body.scope || 'global', req.body, req.auth, actionMeta(req)), 'Tắt maintenance mode thành công.'),
  updateMaintenance: wrap((req) => operationsService.updateMaintenance(req.params.maintenanceId, req.body, req.auth, actionMeta(req)), 'Cập nhật maintenance window thành công.'),
  previewMaintenance: wrap((req) => operationsService.previewMaintenance(req.body), 'Preview maintenance mode thành công.'),
};
