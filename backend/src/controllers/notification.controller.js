const notificationService = require('../services/notification.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

module.exports = {
  getMyNotifications: wrap((req) => notificationService.getMyNotifications(req.query, req.auth), 'Lấy notifications thành công.'),
  getUnreadCount: wrap((req) => notificationService.getUnreadCount(req.auth), 'Lấy unread count thành công.'),
  getNotificationDetail: wrap((req) => notificationService.getNotificationDetail(req.params.notificationId, req.auth), 'Lấy chi tiết notification thành công.'),
  markNotificationRead: wrap((req) => notificationService.markNotificationRead(req.params.notificationId, req.auth, requestMeta(req)), 'Mark notification read thành công.'),
  markAllNotificationsRead: wrap((req) => notificationService.markAllNotificationsRead(req.auth, req.body || req.query, requestMeta(req)), 'Mark all notifications read thành công.'),

  createNotification: wrap((req) => notificationService.createNotification(req.body, req.auth, requestMeta(req)), 'Tạo notification thành công.', 201),
  createBulkNotifications: wrap((req) => notificationService.createBulkNotifications(req.body.recipients || [], req.body.payload || req.body, req.auth, requestMeta(req)), 'Tạo bulk notifications thành công.', 201),
  listNotifications: wrap((req) => notificationService.listNotifications(req.query, req.auth), 'Lấy danh sách notifications thành công.'),
  listFailedNotifications: wrap((req) => notificationService.listFailedNotifications(req.query, req.auth), 'Lấy failed notifications thành công.'),
  cancelNotification: wrap((req) => notificationService.cancelNotification(req.params.notificationId, req.body, req.auth, requestMeta(req)), 'Cancel notification thành công.'),
  retryFailedNotification: wrap((req) => notificationService.retryFailedNotification(req.params.notificationId, req.auth, requestMeta(req)), 'Retry notification thành công.'),
  dispatchNotification: wrap((req) => notificationService.dispatchNotification(req.params.notificationId, req.auth, requestMeta(req)), 'Dispatch notification thành công.'),
  dispatchQueuedNotifications: wrap((req) => notificationService.dispatchQueuedNotifications(req.body.limit || req.query.limit, req.auth), 'Dispatch queued notifications thành công.'),
};
