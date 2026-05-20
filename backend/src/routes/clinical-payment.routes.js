const express = require('express');
const clinicalPaymentController = require('../controllers/clinical-payment.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('orderId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('intentId', validateObjectIdParam);
router.param('overrideId', validateObjectIdParam);

const clinicalPaymentReadPermissions = [
  PERMISSION.PAYMENTS.READ,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
  PERMISSION.INVOICES.READ,
  PERMISSION.INVOICES.READ_UNPAID,
  PERMISSION.CHARGES.READ,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.REPORTS.BILLING_READ,
  PERMISSION.REPORTS.REVENUE_READ,
];

const paymentFlowPermissions = [
  PERMISSION.PAYMENTS.CREATE,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.INVOICES.CREATE,
  PERMISSION.INVOICES.ISSUE,
  PERMISSION.CHARGES.CREATE,
  PERMISSION.CHARGES.MANAGE,
  PERMISSION.ORDERS.CREATE_CHARGE,
];

const confirmationPermissions = [
  PERMISSION.PAYMENTS.CREATE,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/dashboard', authorize({ anyPermissions: clinicalPaymentReadPermissions }), clinicalPaymentController.getDashboard);
router.get('/orders', authorize({ anyPermissions: clinicalPaymentReadPermissions }), clinicalPaymentController.listOrders);
router.get('/waiting-payment', authorize({ anyPermissions: clinicalPaymentReadPermissions }), clinicalPaymentController.listWaitingPayment);
router.get('/ready-to-perform', authorize({ anyPermissions: clinicalPaymentReadPermissions }), clinicalPaymentController.listReadyToPerform);
router.get('/waiting-confirmation', authorize({ anyPermissions: clinicalPaymentReadPermissions }), clinicalPaymentController.listWaitingConfirmation);
router.get('/manual-review', authorize({ anyPermissions: clinicalPaymentReadPermissions }), clinicalPaymentController.listManualReview);
router.get('/errors', authorize({ anyPermissions: clinicalPaymentReadPermissions }), clinicalPaymentController.listPaymentErrors);
router.get('/refund-void-cases', authorize({ anyPermissions: clinicalPaymentReadPermissions }), clinicalPaymentController.listRefundVoidCases);
router.get('/overrides', authorize({ anyPermissions: clinicalPaymentReadPermissions }), clinicalPaymentController.listOverrides);
router.get('/encounters/:encounterId', authorize({ anyPermissions: clinicalPaymentReadPermissions }), clinicalPaymentController.getEncounterPaymentSummary);
router.get('/orders/:orderId/payment-gate', authorize({ anyPermissions: clinicalPaymentReadPermissions }), clinicalPaymentController.getOrderPaymentGate);

router.post('/orders/:orderId/payment-flow', authorize({ anyPermissions: paymentFlowPermissions }), idempotencyRequired({ route: '/api/clinical-payments/orders/:orderId/payment-flow' }), clinicalPaymentController.createPaymentFlow);
router.post('/orders/:orderId/override', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_RECONCILIATION.READ, PERMISSION.INVOICES.ISSUE] }), idempotencyRequired({ route: '/api/clinical-payments/orders/:orderId/override' }), clinicalPaymentController.createOverride);
router.post('/overrides/:overrideId/revoke', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_RECONCILIATION.READ, PERMISSION.INVOICES.ISSUE] }), clinicalPaymentController.revokeOverride);
router.post('/payment-intents/:intentId/confirm', authorize({ anyPermissions: confirmationPermissions }), clinicalPaymentController.confirmIntent);
router.post('/payment-intents/:intentId/reject', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_INTENTS.CANCEL] }), clinicalPaymentController.rejectIntent);
router.post('/payment-intents/:intentId/manual-review', authorize({ anyPermissions: confirmationPermissions }), clinicalPaymentController.manualReviewIntent);

module.exports = router;
