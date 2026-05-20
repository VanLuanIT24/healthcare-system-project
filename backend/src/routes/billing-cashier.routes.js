const express = require('express');
const billingCashierController = require('../controllers/billing-cashier.controller');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');

const router = express.Router();

router.param('invoiceId', validateObjectIdParam);
router.param('paymentId', validateObjectIdParam);
router.param('shiftId', validateObjectIdParam);

const cashierReadPermissions = [
  PERMISSION.INVOICES.READ,
  PERMISSION.INVOICES.READ_UNPAID,
  PERMISSION.PAYMENTS.READ,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
];

const cashierCollectPermissions = [
  PERMISSION.PAYMENTS.CREATE,
];

const cashierManualPermissions = [
  PERMISSION.PAYMENTS.CREATE,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
];

router.get('/workbench', authorize({ anyPermissions: cashierReadPermissions }), billingCashierController.getWorkbench);
router.get('/search', authorize({ anyPermissions: cashierReadPermissions }), billingCashierController.search);
router.get('/invoices', authorize({ anyPermissions: cashierReadPermissions }), billingCashierController.listInvoices);
router.get('/unpaid-invoices', authorize({ anyPermissions: cashierReadPermissions }), billingCashierController.listUnpaidInvoices);
router.get('/partial-invoices', authorize({ anyPermissions: cashierReadPermissions }), billingCashierController.listPartialInvoices);

router.post('/invoices/:invoiceId/collect', authorize({ anyPermissions: cashierCollectPermissions }), idempotencyRequired({ route: '/api/billing/cashier/invoices/:invoiceId/collect' }), billingCashierController.collectPayment);

router.get('/manual-payments', authorize({ anyPermissions: [PERMISSION.PAYMENT_INTENTS.READ, PERMISSION.PAYMENT_RECONCILIATION.READ] }), billingCashierController.listManualPayments);
router.patch('/manual-payments/:paymentId/confirm', authorize({ anyPermissions: cashierManualPermissions }), billingCashierController.confirmManualPayment);
router.post('/manual-payments/:paymentId/confirm', authorize({ anyPermissions: cashierManualPermissions }), billingCashierController.confirmManualPayment);
router.patch('/manual-payments/:paymentId/reject', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_INTENTS.CANCEL] }), billingCashierController.rejectManualPayment);
router.post('/manual-payments/:paymentId/reject', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_INTENTS.CANCEL] }), billingCashierController.rejectManualPayment);
router.patch('/manual-payments/:paymentId/refund-manual', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND, PERMISSION.PAYMENT_RECONCILIATION.READ] }), billingCashierController.refundManualPayment);
router.post('/manual-payments/:paymentId/refund-manual', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND, PERMISSION.PAYMENT_RECONCILIATION.READ] }), billingCashierController.refundManualPayment);

router.get('/transaction-ref-check', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENT_RECONCILIATION.READ] }), billingCashierController.checkTransactionRef);

router.post('/shifts/open', authorize({ anyPermissions: cashierCollectPermissions }), billingCashierController.openShift);
router.get('/shifts/current', authorize({ anyPermissions: cashierReadPermissions }), billingCashierController.getCurrentShift);
router.post('/shifts/:shiftId/close', authorize({ anyPermissions: cashierCollectPermissions }), billingCashierController.closeShift);
router.get('/shifts/:shiftId/summary', authorize({ anyPermissions: cashierReadPermissions }), billingCashierController.getShiftSummary);

router.post('/payments/:paymentId/receipt/print-log', authorize({ anyPermissions: [PERMISSION.PAYMENTS.PRINT_RECEIPT, PERMISSION.PAYMENTS.READ] }), billingCashierController.createReceiptPrintLog);
router.get('/payments/:paymentId/receipt/print-logs', authorize({ anyPermissions: [PERMISSION.PAYMENTS.PRINT_RECEIPT, PERMISSION.PAYMENTS.READ] }), billingCashierController.listReceiptPrintLogs);

module.exports = router;
