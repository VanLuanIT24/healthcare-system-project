const express = require('express');
const schedulingConfigController = require('../controllers/scheduling-config.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

const readPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.SETTINGS.READ,
  PERMISSION.SCHEDULES.READ,
  PERMISSION.SCHEDULES.READ_DEPARTMENT,
  PERMISSION.APPOINTMENTS.READ,
  PERMISSION.QUEUE.READ,
].filter(Boolean);

const writePermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.SETTINGS.UPDATE,
  PERMISSION.SCHEDULES.UPDATE,
].filter(Boolean);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/overview', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getOverview);
router.get('/settings', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getSettings);
router.patch('/settings', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateSettings);

router.get('/schedule-types', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getScheduleTypes);
router.post('/schedule-types', authorize({ anyPermissions: writePermissions }), schedulingConfigController.createScheduleType);
router.patch('/schedule-types/:scheduleTypeId', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateScheduleType);

router.get('/templates', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getTemplates);
router.post('/templates', authorize({ anyPermissions: writePermissions }), schedulingConfigController.createTemplate);
router.patch('/templates', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateTemplates);
router.post('/templates/:templateId/preview', authorize({ anyPermissions: readPermissions }), schedulingConfigController.previewTemplate);
router.post('/templates/:templateId/apply', authorize({ anyPermissions: writePermissions }), schedulingConfigController.applyTemplate);

router.get('/slot-rules', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getSlotRules);
router.patch('/slot-rules', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateSlotRules);
router.post('/slot-rules/test', authorize({ anyPermissions: readPermissions }), schedulingConfigController.testSlotRules);

router.get('/booking-rules', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getBookingRules);
router.patch('/booking-rules', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateBookingRules);
router.post('/booking-rules/test', authorize({ anyPermissions: readPermissions }), schedulingConfigController.testBookingRules);

router.get('/check-in-rules', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getCheckInRules);
router.patch('/check-in-rules', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateCheckInRules);
router.post('/check-in-rules/test', authorize({ anyPermissions: readPermissions }), schedulingConfigController.testCheckInRules);

router.get('/cancel-reschedule-no-show', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getCancelRules);
router.patch('/cancel-reschedule-no-show', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateCancelRules);
router.post('/cancel-reschedule-no-show/impact-preview', authorize({ anyPermissions: readPermissions }), schedulingConfigController.previewCancelRuleImpact);

router.get('/queue-rules', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getQueueRules);
router.patch('/queue-rules', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateQueueRules);
router.post('/queue-rules/simulate-call-next', authorize({ anyPermissions: readPermissions }), schedulingConfigController.simulateQueueRules);

router.get('/exceptions', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getExceptions);
router.post('/exceptions', authorize({ anyPermissions: writePermissions }), schedulingConfigController.createException);
router.patch('/exceptions', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateExceptions);
router.post('/exceptions/preview-impact', authorize({ anyPermissions: readPermissions }), schedulingConfigController.previewExceptionImpact);

router.get('/telehealth', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getTelehealth);
router.patch('/telehealth', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateTelehealth);
router.post('/telehealth/test-provider', authorize({ anyPermissions: readPermissions }), schedulingConfigController.testTelehealthProvider);

router.get('/notifications', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getNotifications);
router.patch('/notifications', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateNotifications);
router.post('/notifications/test', authorize({ anyPermissions: readPermissions }), schedulingConfigController.testNotification);

router.get('/advanced', authorize({ anyPermissions: readPermissions }), schedulingConfigController.getAdvanced);
router.patch('/advanced', authorize({ anyPermissions: writePermissions }), schedulingConfigController.updateAdvanced);

module.exports = router;
