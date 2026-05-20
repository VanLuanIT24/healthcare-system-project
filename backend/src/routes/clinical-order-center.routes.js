const express = require('express');
const clinicalOrderCenterController = require('../controllers/clinical-order-center.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('orderId', validateObjectIdParam);

const readPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_OWN,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.ORDERS.SUMMARY_READ,
  PERMISSION.ORDERS.TIMELINE_READ,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.LAB_RESULTS.READ,
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.IMAGING_REPORTS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ,
];

const workflowPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.ORDERS.ACKNOWLEDGE,
  PERMISSION.ORDERS.START,
  PERMISSION.ORDERS.UPDATE,
  PERMISSION.ORDERS.CANCEL,
  PERMISSION.ORDERS.ENTERED_IN_ERROR,
  PERMISSION.LAB_ORDERS.ACKNOWLEDGE,
  PERMISSION.LAB_ORDERS.COLLECT,
  PERMISSION.IMAGING_ORDERS.UPDATE_STATUS,
  PERMISSION.IMAGING_ORDERS.START,
  PERMISSION.PROCEDURE_ORDERS.SCHEDULE,
  PERMISSION.PROCEDURE_ORDERS.START,
  PERMISSION.PROCEDURE_ORDERS.UPDATE,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.list);
router.get('/summary', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.summary);
router.get('/status-board', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.statusBoard);
router.get('/pending', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.pending);
router.get('/acknowledged', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.acknowledged);
router.get('/in-progress', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.inProgress);
router.get('/in-progress/live', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.inProgressLive);
router.get('/completed', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.completed);
router.get('/cancelled', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.cancelled);
router.get('/entered-in-error', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.enteredInError);
router.get('/missing-files', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.missingFiles);
router.get('/sla-board', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.slaBoard);

router.get('/:orderId/full-detail', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.fullDetail);
router.get('/:orderId/full-timeline', authorize({ anyPermissions: readPermissions }), clinicalOrderCenterController.fullTimeline);

router.post('/:orderId/accept', authorize({ anyPermissions: workflowPermissions }), clinicalOrderCenterController.accept);
router.post('/:orderId/assign', authorize({ anyPermissions: workflowPermissions }), clinicalOrderCenterController.assign);
router.post('/:orderId/notify-doctor', authorize({ anyPermissions: workflowPermissions }), clinicalOrderCenterController.notifyDoctor);
router.post('/bulk-action', authorize({ anyPermissions: workflowPermissions }), clinicalOrderCenterController.bulkAction);

module.exports = router;
