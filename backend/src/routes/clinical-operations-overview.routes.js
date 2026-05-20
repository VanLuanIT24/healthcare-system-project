const express = require('express');
const clinicalOperationsOverviewController = require('../controllers/clinical-operations-overview.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('escalationId', validateObjectIdParam);
router.param('signatureId', validateObjectIdParam);

const overviewReadPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.LAB_ORDERS.READ_OWN,
  PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
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
  PERMISSION.SPECIMENS.READ,
];

const escalationWritePermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.ORDERS.READ,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/sidebar', authorize({ anyPermissions: overviewReadPermissions }), clinicalOperationsOverviewController.getSidebar);

router.get('/overview/dashboard', authorize({ anyPermissions: overviewReadPermissions }), clinicalOperationsOverviewController.getDashboard);
router.get('/overview/today-worklist', authorize({ anyPermissions: overviewReadPermissions }), clinicalOperationsOverviewController.getTodayWorklist);
router.get('/overview/stat-urgent', authorize({ anyPermissions: overviewReadPermissions }), clinicalOperationsOverviewController.getStatUrgent);
router.get('/overview/critical-results', authorize({ anyPermissions: overviewReadPermissions }), clinicalOperationsOverviewController.getCriticalResults);
router.get('/overview/pending-completion', authorize({ anyPermissions: overviewReadPermissions }), clinicalOperationsOverviewController.getPendingCompletion);
router.get('/overview/pending-approval', authorize({ anyPermissions: overviewReadPermissions }), clinicalOperationsOverviewController.getPendingApproval);
router.get('/overview/overdue-orders', authorize({ anyPermissions: overviewReadPermissions }), clinicalOperationsOverviewController.getOverdueOrders);

router.post('/escalations', authorize({ anyPermissions: escalationWritePermissions }), clinicalOperationsOverviewController.createEscalation);
router.post('/escalations/:escalationId/acknowledge', authorize({ anyPermissions: escalationWritePermissions }), clinicalOperationsOverviewController.acknowledgeEscalation);
router.post('/escalations/:escalationId/resolve', authorize({ anyPermissions: escalationWritePermissions }), clinicalOperationsOverviewController.resolveEscalation);

router.post('/signatures/sign', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.FINALIZE, PERMISSION.IMAGING_REPORTS.FINALIZE] }), clinicalOperationsOverviewController.signResult);
router.post('/signatures/:signatureId/revoke', authorize({ anyPermissions: [PERMISSION.LAB_RESULTS.AMEND, PERMISSION.IMAGING_REPORTS.AMEND, PERMISSION.SYSTEM.FULL_ACCESS] }), clinicalOperationsOverviewController.revokeSignature);

module.exports = router;
