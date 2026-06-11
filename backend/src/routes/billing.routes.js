const express = require('express');
const billingCashierRoutes = require('./billing-cashier.routes');
const billingOverviewController = require('../controllers/billing-overview.controller');
const billingController = require('../controllers/billing.controller');
const insuranceSelfServiceController = require('../controllers/insurance-self-service.controller');
const paymentIntentController = require('../controllers/payment-intent.controller');
const reconciliationController = require('../controllers/reconciliation.controller');
const receiptController = require('../controllers/receipt.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { idempotencyRequired } = require('../common/middlewares/idempotency.middleware');
const { createActionRateLimit } = require('../middleware/action-rate-limit');
const domainValidators = require('../validators');

const router = express.Router();

router.param('invoiceId', validateObjectIdParam);
router.param('paymentId', validateObjectIdParam);
router.param('refundId', validateObjectIdParam);
router.param('intentId', validateObjectIdParam);
router.param('batchId', validateObjectIdParam);
router.param('transactionId', validateObjectIdParam);
router.param('policyId', validateObjectIdParam);
router.param('claimId', validateObjectIdParam);
router.param('receiptId', validateObjectIdParam);
router.param('serviceId', validateObjectIdParam);
router.param('chargeId', validateObjectIdParam);
router.param('patientId', validateObjectIdParam);

const chargeReadPermissions = [PERMISSION.CHARGES.READ, PERMISSION.CHARGES.MANAGE];
const invoiceReadPermissions = [PERMISSION.INVOICES.READ, PERMISSION.INVOICES.READ_UNPAID];
const paymentVoidPermissions = [PERMISSION.PAYMENTS.CANCEL_PENDING, PERMISSION.PAYMENTS.REVERSE, PERMISSION.PAYMENTS.REFUND];
const reconciliationReadPermissions = [PERMISSION.PAYMENT_RECONCILIATION.READ];
const reconciliationMatchPermissions = [PERMISSION.PAYMENT_RECONCILIATION.MATCH, PERMISSION.PAYMENT_RECONCILIATION.APPROVE];
const reconciliationRejectPermissions = [PERMISSION.PAYMENT_RECONCILIATION.REJECT, PERMISSION.PAYMENT_RECONCILIATION.UNMATCH];
const overviewReadPermissions = [
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
const paymentIntentLimit = createActionRateLimit({
  action: 'payment-intent-create',
  limit: 5,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req) => req.params.invoiceId,
  message: 'Quá nhiều yêu cầu tạo payment intent cho invoice này. Vui lòng thử lại sau.',
});


router.use(authenticate);

router.get('/me/invoices', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INVOICES.SELF_READ] }), billingController.getMyInvoices);
router.get('/me/invoices/:invoiceId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INVOICES.SELF_READ] }), billingController.getInvoiceDetail);
router.post('/me/invoices/:invoiceId/payment-intents', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PAYMENT_INTENTS.SELF_CREATE, PERMISSION.PAYMENTS.SELF_CREATE_ONLINE] }), domainValidators.billing.request.createPaymentIntent, paymentIntentLimit, idempotencyRequired({ route: '/api/billing/me/invoices/:invoiceId/payment-intents' }), paymentIntentController.createPaymentIntent);
router.get('/me/payment-intents', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PAYMENT_INTENTS.SELF_READ] }), paymentIntentController.listPaymentIntents);
router.get('/me/payment-intents/:intentId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PAYMENT_INTENTS.SELF_READ] }), paymentIntentController.getPaymentIntent);
router.post('/me/payment-intents/:intentId/demo-confirm', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PAYMENT_INTENTS.SELF_READ, PERMISSION.PAYMENTS.SELF_CREATE_ONLINE] }), idempotencyRequired({ route: '/api/billing/me/payment-intents/:intentId/demo-confirm' }), paymentIntentController.confirmDemoPayment);
router.get('/me/payments', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PAYMENTS.SELF_READ] }), billingController.getMyPayments);
router.get('/me/payments/:paymentId/receipt', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PAYMENTS.SELF_READ] }), paymentIntentController.getPaymentReceipt);
router.post('/payments/:paymentId/refund-request', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PAYMENTS.REFUND_REQUEST] }), paymentIntentController.requestRefund);
router.get('/me/payments/:paymentId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.PAYMENTS.SELF_READ] }), billingController.getPaymentDetail);
router.get('/me/receipts', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.RECEIPTS.SELF_READ, PERMISSION.PAYMENTS.SELF_READ] }), receiptController.getMyReceipts);
router.get('/me/receipts/:receiptId/download', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.RECEIPTS.SELF_DOWNLOAD, PERMISSION.RECEIPTS.SELF_READ, PERMISSION.PAYMENTS.SELF_READ] }), receiptController.downloadMyReceipt);
router.get('/me/receipts/:receiptId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.RECEIPTS.SELF_READ, PERMISSION.PAYMENTS.SELF_READ] }), receiptController.getMyReceiptDetail);
router.post('/me/insurance-policies', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_POLICIES.SELF_SUBMIT_INFO] }), insuranceSelfServiceController.createMyInsurancePolicy);
router.get('/me/insurance-policies', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_POLICIES.SELF_READ] }), insuranceSelfServiceController.listMyInsurancePolicies);
router.get('/me/insurance-policies/:policyId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_POLICIES.SELF_READ] }), billingController.getInsurancePolicyDetail);
router.patch('/me/insurance-policies/:policyId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_POLICIES.SELF_SUBMIT_INFO] }), insuranceSelfServiceController.updateMyInsurancePolicy);
router.post('/me/insurance-policies/:policyId/submit', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_POLICIES.SELF_SUBMIT_INFO] }), insuranceSelfServiceController.submitMyInsurancePolicy);
router.post('/me/insurance-policies/:policyId/attachments', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_POLICIES.SELF_SUBMIT_INFO] }), insuranceSelfServiceController.attachMyInsurancePolicyCard);
router.get('/me/insurance-claims', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_CLAIMS.SELF_READ] }), billingController.getMyInsuranceClaims);
router.get('/me/insurance-claims/:claimId', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INSURANCE_CLAIMS.SELF_READ] }), billingController.getInsuranceClaimDetail);
router.get('/me/summary', authorize({ actorTypes: ['patient'], anyPermissions: [PERMISSION.INVOICES.SELF_READ] }), billingController.getMyBillingSummary);

router.use(authorize({ actorTypes: ['staff'] }));

router.use('/cashier', billingCashierRoutes);

router.get('/service-catalog/summary', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.READ] }), billingController.getServiceCatalogSummary);
router.get('/service-catalog/department-summary', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.READ] }), billingController.getServiceCatalogDepartmentSummary);
router.get('/service-catalog/effective', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.READ] }), billingController.listEffectiveServiceCatalog);
router.post('/service-catalog/bulk-update', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.BULK_UPDATE, PERMISSION.SERVICE_CATALOG.UPDATE] }), billingController.bulkUpdateServiceCatalog);
router.post('/service-catalog/bulk-retire', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.BULK_UPDATE, PERMISSION.SERVICE_CATALOG.UPDATE, PERMISSION.SERVICE_CATALOG.DELETE] }), billingController.bulkRetireServiceCatalog);
router.get('/service-catalog', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.READ] }), billingController.listServiceCatalog);
router.post('/service-catalog', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.CREATE] }), billingController.createServiceCatalog);
router.get('/service-catalog/:serviceId/usage', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.READ] }), billingController.getServiceCatalogUsage);
router.get('/service-catalog/:serviceId/timeline', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.READ, PERMISSION.SERVICE_CATALOG.READ_AUDIT] }), billingController.getServiceCatalogTimeline);
router.get('/service-catalog/:serviceId/charges', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.READ, PERMISSION.CHARGES.READ] }), billingController.listServiceCatalogCharges);
router.get('/service-catalog/:serviceId/invoice-items', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.READ, PERMISSION.INVOICES.READ] }), billingController.listServiceCatalogInvoiceItems);
router.get('/service-catalog/:serviceId', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.READ] }), billingController.getServiceCatalogDetail);
router.patch('/service-catalog/:serviceId', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.UPDATE] }), billingController.updateServiceCatalog);
router.post('/service-catalog/:serviceId/new-version', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.UPDATE, PERMISSION.SERVICE_CATALOG.APPROVE_PRICE_CHANGE] }), billingController.createServiceCatalogNewVersion);
router.post('/service-catalog/:serviceId/retire', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.UPDATE, PERMISSION.SERVICE_CATALOG.DELETE] }), billingController.retireServiceCatalog);
router.post('/service-catalog/:serviceId/reactivate', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.REACTIVATE, PERMISSION.SERVICE_CATALOG.UPDATE] }), billingController.reactivateServiceCatalog);
router.post('/service-catalog/:serviceId/clone', authorize({ anyPermissions: [PERMISSION.SERVICE_CATALOG.CREATE] }), billingController.cloneServiceCatalog);

router.get('/charges', authorize({ anyPermissions: chargeReadPermissions }), billingController.listCharges);
router.post('/charges', authorize({ anyPermissions: [PERMISSION.CHARGES.CREATE, PERMISSION.CHARGES.REQUEST_CREATE, PERMISSION.CHARGES.MANAGE] }), idempotencyRequired({ route: '/api/billing/charges' }), billingController.createCharge);
router.get('/charges/:chargeId', authorize({ anyPermissions: chargeReadPermissions }), billingController.getChargeDetail);
router.post('/charges/:chargeId/post', authorize({ anyPermissions: [PERMISSION.CHARGES.POST, PERMISSION.CHARGES.MANAGE] }), billingController.postCharge);
router.post('/charges/:chargeId/void', authorize({ anyPermissions: [PERMISSION.CHARGES.VOID, PERMISSION.CHARGES.MANAGE] }), billingController.voidCharge);

router.get('/invoices', authorize({ anyPermissions: invoiceReadPermissions }), billingController.listInvoices);
router.post('/invoices/from-charges', authorize({ anyPermissions: [PERMISSION.INVOICES.CREATE] }), billingController.createInvoiceFromCharges);
router.get('/invoices/:invoiceId/items', authorize({ anyPermissions: invoiceReadPermissions }), billingController.getInvoiceDetail);
router.get('/invoices/:invoiceId/void-preview', authorize({ anyPermissions: [PERMISSION.INVOICES.READ, PERMISSION.INVOICES.VOID, PERMISSION.INVOICES.CANCEL] }), billingController.getInvoiceVoidPreview);
router.get('/invoices/:invoiceId', authorize({ anyPermissions: invoiceReadPermissions }), billingController.getInvoiceDetail);
router.post('/invoices/:invoiceId/issue', authorize({ anyPermissions: [PERMISSION.INVOICES.ISSUE] }), billingController.issueInvoice);
router.post('/invoices/:invoiceId/void', authorize({ anyPermissions: [PERMISSION.INVOICES.VOID, PERMISSION.INVOICES.VOID_BY_POLICY, PERMISSION.INVOICES.CANCEL] }), billingController.voidInvoice);
router.post('/invoices/:invoiceId/payments', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE] }), idempotencyRequired({ route: '/api/billing/invoices/:invoiceId/payments' }), billingController.createPayment);
router.post('/invoices/:invoiceId/payment-intents', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_INTENTS.READ, PERMISSION.PAYMENT_RECONCILIATION.READ] }), domainValidators.billing.request.createPaymentIntent, paymentIntentLimit, idempotencyRequired({ route: '/api/billing/invoices/:invoiceId/payment-intents' }), paymentIntentController.createPaymentIntent);
router.post('/invoices/:invoiceId/insurance-claims', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.CREATE] }), billingController.createInsuranceClaim);

router.get('/ar/aging', authorize({ anyPermissions: overviewReadPermissions }), billingOverviewController.getDebts);
router.get('/ar/invoices', authorize({ anyPermissions: overviewReadPermissions }), billingOverviewController.getDebts);
router.get('/activity-feed', authorize({ anyPermissions: overviewReadPermissions }), billingOverviewController.getActivityFeed);

router.get('/reconciliation/overview', authorize({ anyPermissions: reconciliationReadPermissions }), reconciliationController.getOverview);
router.get('/reconciliation/batches', authorize({ anyPermissions: reconciliationReadPermissions }), reconciliationController.listBatches);
router.post('/reconciliation/batches', authorize({ anyPermissions: [PERMISSION.PAYMENT_RECONCILIATION.IMPORT, PERMISSION.PAYMENT_RECONCILIATION.MATCH] }), reconciliationController.createBatch);
router.get('/reconciliation/batches/:batchId', authorize({ anyPermissions: reconciliationReadPermissions }), reconciliationController.getBatchDetail);
router.post('/reconciliation/batches/:batchId/close', authorize({ anyPermissions: reconciliationMatchPermissions }), reconciliationController.closeBatch);
router.post('/reconciliation/batches/:batchId/lock', authorize({ anyPermissions: [PERMISSION.PAYMENT_RECONCILIATION.LOCK_PERIOD] }), reconciliationController.lockBatch);
router.post('/reconciliation/import', authorize({ anyPermissions: [PERMISSION.PAYMENT_RECONCILIATION.IMPORT] }), reconciliationController.importTransactions);
router.get('/reconciliation/transactions', authorize({ anyPermissions: reconciliationReadPermissions }), reconciliationController.listTransactions);
router.get('/reconciliation/transactions/:transactionId', authorize({ anyPermissions: reconciliationReadPermissions }), reconciliationController.getTransactionDetail);
router.get('/reconciliation/transactions/:transactionId/candidates', authorize({ anyPermissions: reconciliationReadPermissions }), reconciliationController.getTransactionCandidates);
router.post('/reconciliation/auto-match', authorize({ anyPermissions: [PERMISSION.PAYMENT_RECONCILIATION.AUTO_MATCH, PERMISSION.PAYMENT_RECONCILIATION.MATCH] }), reconciliationController.autoMatch);
router.post('/reconciliation/transactions/:transactionId/match-intent', authorize({ anyPermissions: reconciliationMatchPermissions }), reconciliationController.matchTransactionToIntent);
router.post('/reconciliation/transactions/:transactionId/match-invoice', authorize({ anyPermissions: reconciliationMatchPermissions }), reconciliationController.matchTransactionToInvoice);
router.post('/reconciliation/transactions/:transactionId/mark-unmatched', authorize({ anyPermissions: [PERMISSION.PAYMENT_RECONCILIATION.UNMATCH] }), reconciliationController.markTransactionUnmatched);
router.post('/reconciliation/transactions/:transactionId/ignore', authorize({ anyPermissions: reconciliationRejectPermissions }), reconciliationController.ignoreTransaction);
router.post('/reconciliation/transactions/:transactionId/dispute', authorize({ anyPermissions: reconciliationRejectPermissions }), reconciliationController.disputeTransaction);
router.get('/reconciliation/reports/daily', authorize({ anyPermissions: reconciliationReadPermissions }), reconciliationController.getDailyReport);
router.get('/reconciliation/reports/provider', authorize({ anyPermissions: reconciliationReadPermissions }), reconciliationController.getProviderReport);
router.get('/reconciliation/reports/export', authorize({ anyPermissions: [PERMISSION.PAYMENT_RECONCILIATION.EXPORT, PERMISSION.PAYMENT_RECONCILIATION.READ] }), reconciliationController.exportReport);

router.get('/payments', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ] }), billingController.listPayments);
router.get('/refund-void/summary', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND, PERMISSION.INVOICES.READ] }), billingController.getRefundVoidSummary);
router.get('/refund-void/history', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND, PERMISSION.INVOICES.READ] }), billingController.getRefundVoidHistory);
router.get('/refunds/summary', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND] }), billingController.getRefundVoidSummary);
router.get('/refunds/history', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND, PERMISSION.INVOICES.READ] }), billingController.getRefundVoidHistory);
router.get('/refunds', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND] }), billingController.listRefunds);
router.get('/refunds/:refundId', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND] }), billingController.getRefundDetail);
router.post('/refunds/:refundId/review', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND] }), billingController.reviewRefund);
router.post('/refunds/:refundId/approve', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND] }), billingController.approveRefund);
router.post('/refunds/:refundId/reject', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND] }), billingController.rejectRefund);
router.post('/refunds/:refundId/process', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND] }), billingController.processRefund);
router.post('/refunds/:refundId/mark-paid', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND] }), billingController.markRefundPaid);
router.post('/refunds/:refundId/cancel', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND] }), billingController.cancelRefund);
router.post('/refunds/:refundId/evidence', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND, PERMISSION.ATTACHMENTS.UPLOAD] }), billingController.addRefundEvidence);
router.get('/receipts/history', authorize({ anyPermissions: [PERMISSION.RECEIPTS.VIEW_AUDIT, PERMISSION.RECEIPTS.READ, PERMISSION.PAYMENTS.READ] }), receiptController.listReceiptHistory);
router.get('/receipts', authorize({ anyPermissions: [PERMISSION.RECEIPTS.READ, PERMISSION.PAYMENTS.READ] }), receiptController.listReceipts);
router.post('/receipts/bulk-print', authorize({ anyPermissions: [PERMISSION.RECEIPTS.PRINT, PERMISSION.PAYMENTS.PRINT_RECEIPT] }), receiptController.bulkPrintReceipts);
router.post('/receipts/export', authorize({ anyPermissions: [PERMISSION.RECEIPTS.EXPORT, PERMISSION.RECEIPTS.READ] }), receiptController.exportReceipts);
router.get('/receipts/:receiptId/download', authorize({ anyPermissions: [PERMISSION.RECEIPTS.DOWNLOAD, PERMISSION.PAYMENTS.PRINT_RECEIPT, PERMISSION.PAYMENTS.READ] }), receiptController.downloadReceipt);
router.get('/receipts/:receiptId/print-logs', authorize({ anyPermissions: [PERMISSION.RECEIPTS.VIEW_AUDIT, PERMISSION.RECEIPTS.READ, PERMISSION.PAYMENTS.READ] }), receiptController.listPrintLogs);
router.get('/receipts/:receiptId/history', authorize({ anyPermissions: [PERMISSION.RECEIPTS.VIEW_AUDIT, PERMISSION.RECEIPTS.READ, PERMISSION.PAYMENTS.READ] }), receiptController.getReceiptHistory);
router.get('/receipts/:receiptId', authorize({ anyPermissions: [PERMISSION.RECEIPTS.READ, PERMISSION.PAYMENTS.READ] }), receiptController.getReceiptDetail);
router.post('/receipts/:receiptId/print', authorize({ anyPermissions: [PERMISSION.RECEIPTS.PRINT, PERMISSION.PAYMENTS.PRINT_RECEIPT] }), receiptController.printReceipt);
router.post('/receipts/:receiptId/reprint', authorize({ anyPermissions: [PERMISSION.RECEIPTS.REPRINT, PERMISSION.PAYMENTS.PRINT_RECEIPT] }), receiptController.reprintReceipt);
router.post('/receipts/:receiptId/send', authorize({ anyPermissions: [PERMISSION.RECEIPTS.SEND] }), receiptController.sendReceipt);
router.get('/payment-intents', authorize({ anyPermissions: [PERMISSION.PAYMENT_INTENTS.READ] }), paymentIntentController.listPaymentIntents);
router.get('/payment-intents/:intentId/provider-status', authorize({ anyPermissions: [PERMISSION.PAYMENT_INTENTS.READ, PERMISSION.PAYMENT_RECONCILIATION.READ] }), paymentIntentController.queryProviderStatus);
router.post('/payment-intents/:intentId/confirm-bank-transfer', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_RECONCILIATION.MATCH] }), paymentIntentController.confirmBankTransfer);
router.post('/payment-intents/:intentId/reject-bank-transfer', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_INTENTS.CANCEL, PERMISSION.PAYMENT_RECONCILIATION.REJECT] }), paymentIntentController.rejectBankTransfer);
router.post('/payment-intents/:intentId/manual-review', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_RECONCILIATION.MATCH] }), paymentIntentController.markManualReview);
router.get('/payment-intents/:intentId', authorize({ anyPermissions: [PERMISSION.PAYMENT_INTENTS.READ] }), paymentIntentController.getPaymentIntent);
router.get('/manual-payments', authorize({ anyPermissions: [PERMISSION.PAYMENT_INTENTS.READ, PERMISSION.PAYMENT_RECONCILIATION.READ] }), paymentIntentController.listManualPayments);
router.post('/manual-payments/:intentId/confirm', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_RECONCILIATION.MATCH] }), paymentIntentController.confirmManualPayment);
router.post('/manual-payments/:intentId/reject', authorize({ anyPermissions: [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_INTENTS.CANCEL, PERMISSION.PAYMENT_RECONCILIATION.REJECT] }), paymentIntentController.rejectManualPayment);
router.post('/manual-payments/:intentId/refund-manual', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND, PERMISSION.PAYMENT_RECONCILIATION.READ] }), paymentIntentController.refundManualPayment);
router.get('/payments/:paymentId/receipt', authorize({ anyPermissions: [PERMISSION.PAYMENTS.PRINT_RECEIPT, PERMISSION.PAYMENTS.READ] }), paymentIntentController.getPaymentReceipt);
router.post('/payments/:paymentId/receipts/generate', authorize({ anyPermissions: [PERMISSION.RECEIPTS.GENERATE, PERMISSION.PAYMENTS.PRINT_RECEIPT] }), receiptController.generateReceiptFromPayment);
router.get('/payments/:paymentId/receipt-history', authorize({ anyPermissions: [PERMISSION.RECEIPTS.VIEW_AUDIT, PERMISSION.RECEIPTS.READ, PERMISSION.PAYMENTS.READ] }), receiptController.getPaymentReceiptHistory);
router.get('/payments/:paymentId/receipts', authorize({ anyPermissions: [PERMISSION.RECEIPTS.READ, PERMISSION.PAYMENTS.READ] }), receiptController.getReceiptByPayment);
router.get('/payments/:paymentId/refund-preview', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND] }), billingController.getPaymentRefundPreview);
router.get('/payments/:paymentId/void-preview', authorize({ anyPermissions: paymentVoidPermissions }), billingController.getPaymentVoidPreview);
router.get('/payments/:paymentId', authorize({ anyPermissions: [PERMISSION.PAYMENTS.READ] }), billingController.getPaymentDetail);
router.post('/payments/:paymentId/refunds', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND] }), billingController.createRefundForPayment);
router.post('/payments/:paymentId/void', authorize({ anyPermissions: paymentVoidPermissions }), billingController.voidPayment);
router.post('/payments/:paymentId/refund', authorize({ anyPermissions: [PERMISSION.PAYMENTS.REFUND] }), idempotencyRequired({ route: '/api/billing/payments/:paymentId/refund' }), billingController.refundPayment);

router.get('/patients/:patientId/summary', authorize({ anyPermissions: [PERMISSION.INVOICES.READ, PERMISSION.CHARGES.READ, PERMISSION.PAYMENTS.READ] }), billingController.getPatientBillingSummary);
router.get('/patients/:patientId/insurance-policies', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.READ] }), billingController.listInsurancePolicies);
router.post('/patients/:patientId/insurance-policies', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.CREATE, PERMISSION.INSURANCE_POLICIES.CREATE_BASIC] }), billingController.createInsurancePolicy);

router.get('/insurance-policies/summary', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.READ] }), billingController.getInsurancePolicySummary);
router.get('/insurance-policies', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.READ] }), billingController.listAllInsurancePolicies);
router.get('/insurance-policies/:policyId', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.READ] }), billingController.getInsurancePolicyDetail);
router.patch('/insurance-policies/:policyId', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.UPDATE] }), billingController.updateInsurancePolicy);
router.post('/insurance-policies/:policyId/attachments', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.UPDATE, PERMISSION.ATTACHMENTS.UPLOAD_INSURANCE] }), billingController.attachInsurancePolicyCard);
router.post('/insurance-policies/:policyId/verify', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.VERIFY, PERMISSION.INSURANCE_POLICIES.UPDATE] }), insuranceSelfServiceController.verifyInsurancePolicy);
router.post('/insurance-policies/:policyId/reject', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.REJECT, PERMISSION.INSURANCE_POLICIES.UPDATE] }), insuranceSelfServiceController.rejectInsurancePolicy);
router.post('/insurance-policies/:policyId/cancel', authorize({ anyPermissions: [PERMISSION.INSURANCE_POLICIES.DEACTIVATE, PERMISSION.INSURANCE_POLICIES.UPDATE] }), billingController.cancelInsurancePolicy);

router.get('/insurance-claims/summary', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.READ] }), billingController.getInsuranceClaimSummary);
router.get('/insurance-claims', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.READ] }), billingController.listInsuranceClaims);
router.get('/insurance-claims/:claimId/readiness', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.READ] }), billingController.getInsuranceClaimReadiness);
router.get('/insurance-claims/:claimId/settlements', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.READ, PERMISSION.PAYMENTS.READ] }), billingController.getInsuranceClaimSettlements);
router.get('/insurance-claims/:claimId', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.READ] }), billingController.getInsuranceClaimDetail);
router.patch('/insurance-claims/:claimId', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.UPDATE] }), billingController.updateInsuranceClaim);
router.post('/insurance-claims/:claimId/submit', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.SUBMIT] }), billingController.submitClaim);
router.post('/insurance-claims/:claimId/under-review', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.MARK_UNDER_REVIEW, PERMISSION.INSURANCE_CLAIMS.UPDATE] }), billingController.markClaimUnderReview);
router.post('/insurance-claims/:claimId/approve', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.APPROVE, PERMISSION.INSURANCE_CLAIMS.PARTIALLY_APPROVE] }), billingController.approveClaim);
router.post('/insurance-claims/:claimId/reject', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.REJECT] }), billingController.rejectClaim);
router.post('/insurance-claims/:claimId/settle', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.SETTLE] }), billingController.settleClaim);
router.post('/insurance-claims/:claimId/cancel', authorize({ anyPermissions: [PERMISSION.INSURANCE_CLAIMS.CANCEL, PERMISSION.INSURANCE_CLAIMS.MANAGE] }), billingController.cancelClaim);

module.exports = router;
