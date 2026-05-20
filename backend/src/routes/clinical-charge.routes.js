const express = require('express');
const clinicalChargeController = require('../controllers/clinical-charge.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('chargeId', validateObjectIdParam);
router.param('orderId', validateObjectIdParam);

const clinicalChargeReadPermissions = [
  PERMISSION.CHARGES.READ,
  PERMISSION.CHARGES.MANAGE,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
  PERMISSION.REPORTS.BILLING_READ,
  PERMISSION.REPORTS.REVENUE_READ,
];

const chargeCreatePermissions = [
  PERMISSION.ORDERS.CREATE_CHARGE,
  PERMISSION.CHARGES.CREATE,
  PERMISSION.CHARGES.REQUEST_CREATE,
  PERMISSION.CHARGES.MANAGE,
  PERMISSION.PROCEDURE_ORDERS.CHARGE_CREATE,
];

const chargeReviewPermissions = [
  PERMISSION.CHARGES.UPDATE,
  PERMISSION.CHARGES.ADJUST,
  PERMISSION.CHARGES.MANAGE,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/dashboard', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.getDashboard);
router.get('/action-queue', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.getActionQueue);
router.get('/missing', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.listMissing);
router.get('/by-order', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.listByOrder);
router.get('/lab', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.listLabCharges);
router.get('/imaging', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.listImagingCharges);
router.get('/procedure', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.listProcedureCharges);
router.get('/posted', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.listPosted);
router.get('/unbilled', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.listUnbilled);
router.get('/billed', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.listBilled);
router.get('/exceptions', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.listExceptions);
router.get('/reconciliation', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.getReconciliation);
router.get('/orders/:orderId/context', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.getOrderChargeContext);
router.get('/', authorize({ anyPermissions: clinicalChargeReadPermissions }), clinicalChargeController.listCharges);

router.post('/bulk-create-from-orders', authorize({ anyPermissions: chargeCreatePermissions }), idempotencyRequired({ route: '/api/clinical-charges/bulk-create-from-orders' }), clinicalChargeController.bulkCreateFromOrders);
router.post('/bulk-post', authorize({ anyPermissions: [PERMISSION.CHARGES.POST, PERMISSION.CHARGES.MANAGE] }), clinicalChargeController.bulkPost);
router.post('/bulk-void', authorize({ anyPermissions: [PERMISSION.CHARGES.VOID, PERMISSION.CHARGES.MANAGE] }), clinicalChargeController.bulkVoid);
router.post('/:chargeId/mark-review', authorize({ anyPermissions: chargeReviewPermissions }), clinicalChargeController.markReview);
router.post('/:chargeId/resolve', authorize({ anyPermissions: chargeReviewPermissions }), clinicalChargeController.resolveReview);
router.post('/:chargeId/send-to-billing-review', authorize({ anyPermissions: chargeReviewPermissions }), clinicalChargeController.sendToBillingReview);
router.post('/:chargeId/create-replacement', authorize({ anyPermissions: chargeReviewPermissions }), idempotencyRequired({ route: '/api/clinical-charges/:chargeId/create-replacement' }), clinicalChargeController.createReplacement);

module.exports = router;
