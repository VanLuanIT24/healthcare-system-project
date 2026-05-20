const express = require('express');
const diagnosticAlertController = require('../controllers/diagnostic-alert.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('alertId', validateObjectIdParam);

const diagnosticAlertReadPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.DIAGNOSTIC_ALERTS.READ,
  PERMISSION.DIAGNOSTIC_ALERTS.READ_OWN,
  PERMISSION.DIAGNOSTIC_ALERTS.READ_DEPARTMENT,
  PERMISSION.DIAGNOSTIC_ALERTS.READ_ASSIGNED,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.LAB_ORDERS.READ_OWN,
  PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
  PERMISSION.SPECIMENS.READ,
  PERMISSION.LAB_RESULTS.READ,
  PERMISSION.LAB_RESULTS.READ_FINAL,
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.IMAGING_ORDERS.READ_OWN,
  PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT,
  PERMISSION.IMAGING_REPORTS.READ,
  PERMISSION.IMAGING_REPORTS.READ_FINAL,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ_OWN,
  PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
  PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ,
  PERMISSION.ATTACHMENTS.READ,
  PERMISSION.ATTACHMENTS.READ_LAB,
  PERMISSION.ATTACHMENTS.READ_IMAGING,
  PERMISSION.ATTACHMENTS.READ_PROCEDURE,
].filter(Boolean);

const diagnosticAlertWritePermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.DIAGNOSTIC_ALERTS.ACKNOWLEDGE,
  PERMISSION.DIAGNOSTIC_ALERTS.ASSIGN,
  PERMISSION.DIAGNOSTIC_ALERTS.ESCALATE,
  PERMISSION.DIAGNOSTIC_ALERTS.RESOLVE,
  PERMISSION.DIAGNOSTIC_ALERTS.DISMISS,
  PERMISSION.DIAGNOSTIC_ALERTS.BULK_ACTION,
  PERMISSION.DIAGNOSTIC_ALERTS.MANAGE,
  PERMISSION.LAB_RESULTS.CRITICAL_ACKNOWLEDGE,
  PERMISSION.LAB_RESULTS.READ_FINAL,
  PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE,
  PERMISSION.IMAGING_REPORTS.READ_FINAL,
  PERMISSION.ORDERS.ACKNOWLEDGE,
  PERMISSION.ORDERS.UPDATE,
  PERMISSION.ATTACHMENTS.MANAGE,
].filter(Boolean);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/summary', authorize({ anyPermissions: diagnosticAlertReadPermissions }), diagnosticAlertController.summary);
router.get('/critical-open', authorize({ anyPermissions: diagnosticAlertReadPermissions }), diagnosticAlertController.criticalOpen);
router.get('/critical-overdue', authorize({ anyPermissions: diagnosticAlertReadPermissions }), diagnosticAlertController.criticalOverdue);
router.get('/rejected-specimens', authorize({ anyPermissions: diagnosticAlertReadPermissions }), diagnosticAlertController.rejectedSpecimens);
router.get('/overdue-orders', authorize({ anyPermissions: diagnosticAlertReadPermissions }), diagnosticAlertController.overdueOrders);
router.get('/missing-files', authorize({ anyPermissions: diagnosticAlertReadPermissions }), diagnosticAlertController.missingFiles);
router.get('/correction-needed', authorize({ anyPermissions: diagnosticAlertReadPermissions }), diagnosticAlertController.correctionNeeded);
router.get('/no-show-cancellations', authorize({ anyPermissions: diagnosticAlertReadPermissions }), diagnosticAlertController.noShowCancellations);

router.get('/', authorize({ anyPermissions: diagnosticAlertReadPermissions }), diagnosticAlertController.list);
router.post('/bulk-action', authorize({ anyPermissions: diagnosticAlertWritePermissions }), diagnosticAlertController.bulkAction);
router.get('/:alertId', authorize({ anyPermissions: diagnosticAlertReadPermissions }), diagnosticAlertController.detail);
router.post('/:alertId/acknowledge', authorize({ anyPermissions: diagnosticAlertWritePermissions }), diagnosticAlertController.acknowledge);
router.post('/:alertId/assign', authorize({ anyPermissions: diagnosticAlertWritePermissions }), diagnosticAlertController.assign);
router.post('/:alertId/escalate', authorize({ anyPermissions: diagnosticAlertWritePermissions }), diagnosticAlertController.escalate);
router.post('/:alertId/resolve', authorize({ anyPermissions: diagnosticAlertWritePermissions }), diagnosticAlertController.resolve);
router.post('/:alertId/dismiss', authorize({ anyPermissions: diagnosticAlertWritePermissions }), diagnosticAlertController.dismiss);

module.exports = router;
