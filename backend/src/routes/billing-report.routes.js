const express = require('express');
const billingReportController = require('../controllers/billing-report.controller');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

const billingReportReadPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.REPORTS.BILLING_READ,
  PERMISSION.REPORTS.REVENUE_READ,
  PERMISSION.INVOICES.READ,
  PERMISSION.INVOICES.READ_UNPAID,
  PERMISSION.PAYMENTS.READ,
];

router.get('/summary', authorize({ anyPermissions: billingReportReadPermissions }), billingReportController.getSummary);
router.get('/revenue', authorize({ anyPermissions: billingReportReadPermissions }), billingReportController.getRevenue);
router.get('/receivables', authorize({ anyPermissions: billingReportReadPermissions }), billingReportController.getReceivables);
router.get('/debt', authorize({ anyPermissions: billingReportReadPermissions }), billingReportController.getReceivables);
router.get('/payment-methods', authorize({ anyPermissions: billingReportReadPermissions }), billingReportController.getPaymentMethods);
router.get('/departments', authorize({ anyPermissions: billingReportReadPermissions }), billingReportController.getDepartments);
router.get('/refunds-voids', authorize({ anyPermissions: billingReportReadPermissions }), billingReportController.getRefundsVoids);
router.get('/refund-cancel', authorize({ anyPermissions: billingReportReadPermissions }), billingReportController.getRefundsVoids);
router.get('/insurance', authorize({
  anyPermissions: [
    ...billingReportReadPermissions,
    PERMISSION.REPORTS.INSURANCE_READ,
    PERMISSION.INSURANCE_CLAIMS.READ,
  ],
}), billingReportController.getInsurance);
router.get('/drilldown', authorize({ anyPermissions: billingReportReadPermissions }), billingReportController.getDrilldown);
router.get('/export', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.EXPORT,
    PERMISSION.REPORTS.BILLING_EXPORT,
    PERMISSION.REPORTS.READ_ALL,
  ],
}), billingReportController.exportBillingReport);

module.exports = router;
