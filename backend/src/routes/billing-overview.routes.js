const express = require('express');
const billingOverviewController = require('../controllers/billing-overview.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

const overviewPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.REPORTS.BILLING_READ,
  PERMISSION.REPORTS.REVENUE_READ,
  PERMISSION.INVOICES.READ,
  PERMISSION.INVOICES.READ_UNPAID,
  PERMISSION.PAYMENTS.READ,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'], anyPermissions: overviewPermissions }));

router.get('/dashboard', billingOverviewController.getDashboard);
router.get('/tasks', billingOverviewController.getTasks);
router.get('/today-revenue', billingOverviewController.getTodayRevenue);
router.get('/unpaid-invoices', billingOverviewController.getUnpaidInvoices);
router.get('/payment-confirmations', billingOverviewController.getPaymentConfirmations);
router.get('/payment-errors', billingOverviewController.getPaymentErrors);
router.get('/debts', billingOverviewController.getDebts);
router.get('/activity-feed', billingOverviewController.getActivityFeed);

module.exports = router;
