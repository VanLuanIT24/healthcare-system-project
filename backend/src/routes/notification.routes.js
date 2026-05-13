const express = require('express');
const notificationController = require('../controllers/notification.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('notificationId', validateObjectIdParam);

const selfReadPermissions = [
  PERMISSION.NOTIFICATIONS.READ_OWN,
  PERMISSION.NOTIFICATIONS.READ,
  PERMISSION.NOTIFICATIONS.MARK_READ,
  PERMISSION.NOTIFICATIONS.SELF_READ,
  PERMISSION.NOTIFICATIONS.RELATIVE_READ,
];

const selfMarkReadPermissions = [
  PERMISSION.NOTIFICATIONS.MARK_READ,
  PERMISSION.NOTIFICATIONS.READ_OWN,
  PERMISSION.NOTIFICATIONS.SELF_MARK_READ,
  PERMISSION.NOTIFICATIONS.RELATIVE_READ,
];

const selfMarkAllReadPermissions = [
  PERMISSION.NOTIFICATIONS.MARK_ALL_READ,
  PERMISSION.NOTIFICATIONS.READ_OWN,
  PERMISSION.NOTIFICATIONS.SELF_MARK_ALL_READ,
  PERMISSION.NOTIFICATIONS.RELATIVE_READ,
];

const createPermissions = [
  PERMISSION.NOTIFICATIONS.CREATE,
  PERMISSION.NOTIFICATIONS.CREATE_SYSTEM,
  PERMISSION.NOTIFICATIONS.MANAGE,
];

const bulkCreatePermissions = [
  PERMISSION.NOTIFICATIONS.CREATE,
  PERMISSION.NOTIFICATIONS.CREATE_SYSTEM,
  PERMISSION.NOTIFICATIONS.BROADCAST,
  PERMISSION.NOTIFICATIONS.MANAGE,
];

router.use(authenticate);

router.get('/', authorize({ anyPermissions: selfReadPermissions }), notificationController.getMyNotifications);
router.get('/unread-count', authorize({ anyPermissions: selfReadPermissions }), notificationController.getUnreadCount);
router.post('/read-all', authorize({ anyPermissions: selfMarkAllReadPermissions }), notificationController.markAllNotificationsRead);

router.get('/admin', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.NOTIFICATIONS.READ, PERMISSION.NOTIFICATIONS.MANAGE] }), notificationController.listNotifications);
router.get('/admin/failed', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.NOTIFICATIONS.READ_FAILED, PERMISSION.NOTIFICATIONS.MANAGE] }), notificationController.listFailedNotifications);
router.post('/admin/dispatch-queued', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.NOTIFICATIONS.DISPATCH, PERMISSION.NOTIFICATIONS.MANAGE] }), notificationController.dispatchQueuedNotifications);

router.post('/', authorize({ actorTypes: ['staff'], anyPermissions: createPermissions }), notificationController.createNotification);
router.post('/bulk', authorize({ actorTypes: ['staff'], anyPermissions: bulkCreatePermissions }), notificationController.createBulkNotifications);

router.get('/:notificationId', authorize({ anyPermissions: selfReadPermissions }), notificationController.getNotificationDetail);
router.post('/:notificationId/read', authorize({ anyPermissions: selfMarkReadPermissions }), notificationController.markNotificationRead);
router.post('/:notificationId/cancel', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.NOTIFICATIONS.CANCEL, PERMISSION.NOTIFICATIONS.MANAGE] }), notificationController.cancelNotification);
router.post('/:notificationId/retry', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.NOTIFICATIONS.RETRY, PERMISSION.NOTIFICATIONS.MANAGE] }), notificationController.retryFailedNotification);
router.post('/:notificationId/dispatch', authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.NOTIFICATIONS.DISPATCH, PERMISSION.NOTIFICATIONS.MANAGE] }), notificationController.dispatchNotification);

module.exports = router;
