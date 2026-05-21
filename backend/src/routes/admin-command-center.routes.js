const express = require('express');
const commandCenterController = require('../controllers/admin-command-center.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

const readPermissions = [
  PERMISSION.COMMAND_CENTER?.READ,
  PERMISSION.REPORTS.ADMIN_DASHBOARD_READ,
  PERMISSION.AUDIT_LOGS.READ,
  PERMISSION.USERS.READ,
  PERMISSION.SYSTEM.HEALTH_READ,
].filter(Boolean);

const opsPermissions = [
  PERMISSION.COMMAND_CENTER?.VIEW_OPS,
  PERMISSION.COMMAND_CENTER?.RETRY_OPS,
  PERMISSION.NOTIFICATIONS.MANAGE,
  PERMISSION.NOTIFICATIONS.RETRY,
  PERMISSION.SYSTEM.FULL_ACCESS,
].filter(Boolean);

const securityPermissions = [
  PERMISSION.COMMAND_CENTER?.VIEW_SECURITY,
  PERMISSION.COMMAND_CENTER?.FORCE_LOGOUT,
  PERMISSION.AUDIT_LOGS.READ_SECURITY,
  PERMISSION.USERS.FORCE_LOGOUT,
  PERMISSION.SYSTEM.FULL_ACCESS,
].filter(Boolean);

const alertPermissions = [
  PERMISSION.COMMAND_CENTER?.MANAGE_ALERTS,
  PERMISSION.COMMAND_CENTER?.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.NOTIFICATIONS.MANAGE,
].filter(Boolean);

router.get('/bootstrap', authorize({ anyPermissions: readPermissions }), commandCenterController.getBootstrap);
router.get('/dashboard', authorize({ anyPermissions: readPermissions }), commandCenterController.getDashboard);
router.get('/health', authorize({ anyPermissions: readPermissions }), commandCenterController.getHealth);
router.get('/work-items', authorize({ anyPermissions: readPermissions }), commandCenterController.getWorkItems);
router.get('/work-items/summary', authorize({ anyPermissions: readPermissions }), commandCenterController.getWorkItemsSummary);
router.get('/system-alerts', authorize({ anyPermissions: readPermissions }), commandCenterController.getSystemAlerts);
router.get('/security-alerts', authorize({ anyPermissions: readPermissions }), commandCenterController.getSecurityAlerts);
router.get('/recent-activities', authorize({ anyPermissions: readPermissions }), commandCenterController.getRecentActivities);
router.get('/sessions', authorize({ anyPermissions: readPermissions }), commandCenterController.getSessions);
router.get('/workers', authorize({ anyPermissions: readPermissions }), commandCenterController.getWorkers);
router.get('/realtime', authorize({ anyPermissions: readPermissions }), commandCenterController.getRealtime);
router.get('/workspace-map', authorize({ anyPermissions: readPermissions }), commandCenterController.getWorkspaceMap);
router.post('/export-snapshot', authorize({ anyPermissions: [PERMISSION.COMMAND_CENTER?.EXPORT, PERMISSION.REPORTS.EXPORT, PERMISSION.SYSTEM.FULL_ACCESS].filter(Boolean) }), commandCenterController.exportSnapshot);

router.post('/work-items/:id/acknowledge', authorize({ anyPermissions: alertPermissions }), commandCenterController.acknowledgeWorkItem);
router.post('/work-items/:id/assign', authorize({ anyPermissions: alertPermissions }), commandCenterController.assignWorkItem);
router.post('/work-items/:id/snooze', authorize({ anyPermissions: alertPermissions }), commandCenterController.snoozeWorkItem);
router.post('/work-items/:id/resolve', authorize({ anyPermissions: alertPermissions }), commandCenterController.resolveWorkItem);
router.post('/work-items/:id/dismiss', authorize({ anyPermissions: alertPermissions }), commandCenterController.dismissWorkItem);

router.post('/system-alerts/:id/acknowledge', authorize({ anyPermissions: alertPermissions }), commandCenterController.acknowledgeSystemAlert);
router.post('/system-alerts/:id/resolve', authorize({ anyPermissions: alertPermissions }), commandCenterController.resolveSystemAlert);
router.post('/security-alerts/:id/resolve', authorize({ anyPermissions: securityPermissions }), commandCenterController.resolveSecurityAlert);
router.post('/sessions/:sessionId/revoke', authorize({ anyPermissions: securityPermissions }), commandCenterController.revokeSession);
router.post('/events/:eventId/retry', authorize({ anyPermissions: opsPermissions }), commandCenterController.retryEvent);
router.post('/notifications/:deliveryId/retry', authorize({ anyPermissions: opsPermissions }), commandCenterController.retryNotification);
router.post('/realtime/test-self', authorize({ anyPermissions: readPermissions }), commandCenterController.testRealtimeSelf);

module.exports = router;
