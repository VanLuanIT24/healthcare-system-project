const express = require('express');
const clinicalBillingController = require('../controllers/clinical-billing.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('orderId', validateObjectIdParam);
router.param('labOrderId', validateObjectIdParam);
router.param('imagingOrderId', validateObjectIdParam);
router.param('encounterId', validateObjectIdParam);
router.param('invoiceId', validateObjectIdParam);

const clinicalBillingReadPermissions = [
  PERMISSION.CHARGES.READ,
  PERMISSION.CHARGES.MANAGE,
  PERMISSION.INVOICES.READ,
  PERMISSION.INVOICES.READ_UNPAID,
  PERMISSION.PAYMENTS.READ,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
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
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
];

const chargeCreatePermissions = [
  PERMISSION.ORDERS.CREATE_CHARGE,
  PERMISSION.CHARGES.CREATE,
  PERMISSION.CHARGES.REQUEST_CREATE,
  PERMISSION.CHARGES.MANAGE,
  PERMISSION.PROCEDURE_ORDERS.CHARGE_CREATE,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/dashboard', authorize({ anyPermissions: clinicalBillingReadPermissions }), clinicalBillingController.getDashboard);
router.get('/orders/charge-candidates', authorize({ anyPermissions: clinicalBillingReadPermissions }), clinicalBillingController.listChargeCandidates);
router.get('/orders/:orderId/billing-trace', authorize({ anyPermissions: clinicalBillingReadPermissions }), clinicalBillingController.getOrderBillingTrace);
router.post('/orders/:orderId/charge', authorize({ anyPermissions: chargeCreatePermissions }), idempotencyRequired({ route: '/api/clinical-billing/orders/:orderId/charge' }), clinicalBillingController.createChargeForOrder);
router.post('/lab-orders/:labOrderId/charge', authorize({ anyPermissions: chargeCreatePermissions }), idempotencyRequired({ route: '/api/clinical-billing/lab-orders/:labOrderId/charge' }), clinicalBillingController.createChargeForLabOrder);
router.post('/imaging-orders/:imagingOrderId/charge', authorize({ anyPermissions: chargeCreatePermissions }), idempotencyRequired({ route: '/api/clinical-billing/imaging-orders/:imagingOrderId/charge' }), clinicalBillingController.createChargeForImagingOrder);

router.get('/charges', authorize({ anyPermissions: clinicalBillingReadPermissions }), clinicalBillingController.listCharges);
router.get('/unbilled-charges', authorize({ anyPermissions: clinicalBillingReadPermissions }), clinicalBillingController.listUnbilledCharges);
router.get('/invoices', authorize({ anyPermissions: clinicalBillingReadPermissions }), clinicalBillingController.listInvoices);
router.post('/invoices/from-selected-charges', authorize({ anyPermissions: [PERMISSION.INVOICES.CREATE] }), idempotencyRequired({ route: '/api/clinical-billing/invoices/from-selected-charges' }), clinicalBillingController.createInvoiceFromSelectedCharges);
router.post('/invoices/from-encounter', authorize({ anyPermissions: [PERMISSION.INVOICES.CREATE] }), idempotencyRequired({ route: '/api/clinical-billing/invoices/from-encounter' }), clinicalBillingController.createInvoiceFromEncounter);
router.get('/invoices/:invoiceId/timeline', authorize({ anyPermissions: clinicalBillingReadPermissions }), clinicalBillingController.getInvoiceTimeline);

router.get('/encounters/:encounterId/billing-summary', authorize({ anyPermissions: clinicalBillingReadPermissions }), clinicalBillingController.getEncounterBillingSummary);
router.post('/encounters/:encounterId/invoices', authorize({ anyPermissions: [PERMISSION.INVOICES.CREATE] }), idempotencyRequired({ route: '/api/clinical-billing/encounters/:encounterId/invoices' }), (req, res, next) => {
  req.body = { ...req.body, encounter_id: req.params.encounterId };
  return clinicalBillingController.createInvoiceFromEncounter(req, res, next);
});

router.get('/reconciliation', authorize({ anyPermissions: clinicalBillingReadPermissions }), clinicalBillingController.getReconciliation);
router.get('/exceptions', authorize({ anyPermissions: clinicalBillingReadPermissions }), clinicalBillingController.listExceptions);

module.exports = router;
