const express = require('express');
const billingWorkspaceController = require('../controllers/billing-workspace.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('shiftId', validateObjectIdParam);

const billingWorkspaceReadPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.INVOICES.READ,
  PERMISSION.INVOICES.READ_UNPAID,
  PERMISSION.PAYMENTS.READ,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
  PERMISSION.CHARGES.READ,
  PERMISSION.RECEIPTS.READ,
  PERMISSION.INSURANCE_CLAIMS.READ,
];

const cashSessionWritePermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.PAYMENTS.CREATE,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/topbar/bootstrap', authorize({ anyPermissions: billingWorkspaceReadPermissions }), billingWorkspaceController.getTopbarBootstrap);
router.get('/dashboard/overview', authorize({ anyPermissions: billingWorkspaceReadPermissions }), billingWorkspaceController.getDashboardOverview);
router.get('/cashier-worklist', authorize({ anyPermissions: billingWorkspaceReadPermissions }), billingWorkspaceController.getCashierWorklist);
router.get('/payment-confirmation-queue', authorize({ anyPermissions: billingWorkspaceReadPermissions }), billingWorkspaceController.getPaymentConfirmationQueue);
router.get('/alert-summary', authorize({ anyPermissions: billingWorkspaceReadPermissions }), billingWorkspaceController.getAlertSummary);
router.get('/search', authorize({ anyPermissions: billingWorkspaceReadPermissions }), billingWorkspaceController.search);
router.get('/recent-items', authorize({ anyPermissions: billingWorkspaceReadPermissions }), billingWorkspaceController.getCashierWorklist);

router.get('/cash-session/current', authorize({ anyPermissions: billingWorkspaceReadPermissions }), billingWorkspaceController.getCurrentCashSession);
router.post('/cash-session/open', authorize({ anyPermissions: cashSessionWritePermissions }), billingWorkspaceController.openCashSession);
router.post('/cash-session/close', authorize({ anyPermissions: cashSessionWritePermissions }), billingWorkspaceController.closeCurrentCashSession);
router.post('/cash-session/:shiftId/close', authorize({ anyPermissions: cashSessionWritePermissions }), billingWorkspaceController.closeCashSession);
router.get('/cash-session/:shiftId/report', authorize({ anyPermissions: billingWorkspaceReadPermissions }), billingWorkspaceController.getCashSessionReport);

router.get('/reconciliation/mismatches', authorize({ anyPermissions: billingWorkspaceReadPermissions }), billingWorkspaceController.getReconciliationMismatches);

module.exports = router;
