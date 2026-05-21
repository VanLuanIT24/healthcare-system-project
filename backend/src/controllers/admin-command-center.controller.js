const commandCenterService = require('../services/admin/command-center.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

function actionMeta(req) {
  return {
    ...requestMeta(req),
    requestId: req.context?.request_id,
    reason: req.body?.reason,
  };
}

module.exports = {
  getBootstrap: wrap((req) => commandCenterService.getBootstrap(req.auth), 'Lấy Command Center bootstrap thành công.'),
  getDashboard: wrap((req) => commandCenterService.getDashboard(req.auth), 'Lấy dashboard Command Center thành công.'),
  getHealth: wrap((req) => commandCenterService.getHealth(req.auth), 'Lấy sức khỏe hệ thống thành công.'),
  getWorkItems: wrap((req) => commandCenterService.getWorkItems(req.query, req.auth), 'Lấy việc cần xử lý thành công.'),
  getWorkItemsSummary: wrap((req) => commandCenterService.getWorkItemsSummary(req.query, req.auth), 'Lấy tổng hợp việc cần xử lý thành công.'),
  getSystemAlerts: wrap((req) => commandCenterService.getSystemAlerts(req.query, req.auth), 'Lấy cảnh báo hệ thống thành công.'),
  getSecurityAlerts: wrap((req) => commandCenterService.getSecurityAlerts(req.query, req.auth), 'Lấy cảnh báo bảo mật thành công.'),
  getRecentActivities: wrap((req) => commandCenterService.getRecentActivities(req.query, req.auth), 'Lấy hoạt động gần đây thành công.'),
  getSessions: wrap((req) => commandCenterService.getSessions(req.query, req.auth), 'Lấy phiên đăng nhập realtime thành công.'),
  getWorkers: wrap((req) => commandCenterService.getWorkers(req.query, req.auth), 'Lấy tình trạng worker/queue thành công.'),
  getRealtime: wrap((req) => commandCenterService.getRealtime(req.auth), 'Lấy tình trạng realtime thành công.'),
  getWorkspaceMap: wrap((req) => commandCenterService.getWorkspaceMap(req.auth), 'Lấy bản đồ workspace thành công.'),
  exportSnapshot: wrap((req) => commandCenterService.exportSnapshot(req.auth), 'Export Command Center snapshot thành công.'),

  acknowledgeWorkItem: wrap((req) => commandCenterService.acknowledgeVirtualItem(req.params.id, req.auth, actionMeta(req)), 'Acknowledge work item thành công.'),
  assignWorkItem: wrap((req) => commandCenterService.updateVirtualItem(req.params.id, 'assign', req.body, req.auth, actionMeta(req)), 'Assign work item thành công.'),
  snoozeWorkItem: wrap((req) => commandCenterService.updateVirtualItem(req.params.id, 'snooze', req.body, req.auth, actionMeta(req)), 'Snooze work item thành công.'),
  resolveWorkItem: wrap((req) => commandCenterService.updateVirtualItem(req.params.id, 'resolve', req.body, req.auth, actionMeta(req)), 'Resolve work item thành công.'),
  dismissWorkItem: wrap((req) => commandCenterService.updateVirtualItem(req.params.id, 'dismiss', req.body, req.auth, actionMeta(req)), 'Dismiss work item thành công.'),

  acknowledgeSystemAlert: wrap((req) => commandCenterService.updateVirtualAlert(req.params.id, 'acknowledge', req.body, req.auth, actionMeta(req)), 'Acknowledge system alert thành công.'),
  resolveSystemAlert: wrap((req) => commandCenterService.updateVirtualAlert(req.params.id, 'resolve', req.body, req.auth, actionMeta(req)), 'Resolve system alert thành công.'),
  resolveSecurityAlert: wrap((req) => commandCenterService.updateVirtualAlert(req.params.id, 'resolve', req.body, req.auth, actionMeta(req)), 'Resolve security alert thành công.'),
  revokeSession: wrap((req) => commandCenterService.revokeSession(req.params.sessionId, req.auth, actionMeta(req)), 'Revoke session thành công.'),
  retryEvent: wrap((req) => commandCenterService.retryEvent(req.params.eventId, req.auth, actionMeta(req)), 'Retry event thành công.'),
  retryNotification: wrap((req) => commandCenterService.retryNotificationDelivery(req.params.deliveryId, req.auth, actionMeta(req)), 'Retry notification delivery thành công.'),
  testRealtimeSelf: wrap((req) => commandCenterService.testRealtimeSelf(req.auth, actionMeta(req)), 'Test realtime self thành công.'),
};
