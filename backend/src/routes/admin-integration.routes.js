const express = require('express');
const controller = require('../controllers/admin-integration.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('deliveryId', validateObjectIdParam);
router.param('eventId', validateObjectIdParam);
router.param('transactionId', validateObjectIdParam);
router.param('batchId', validateObjectIdParam);

const integrationReadPermissions = [
  PERMISSION.INTEGRATIONS.READ,
  PERMISSION.INTEGRATIONS.HEALTH_CHECK,
  PERMISSION.INTEGRATIONS.LOG_READ,
  PERMISSION.COMMAND_CENTER.READ,
  PERMISSION.SETTINGS.READ,
  PERMISSION.AUDIT_LOGS.READ,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
  PERMISSION.NOTIFICATIONS.READ,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const integrationManagePermissions = [
  PERMISSION.INTEGRATIONS.MANAGE,
  PERMISSION.INTEGRATIONS.TEST,
  PERMISSION.COMMAND_CENTER.MANAGE,
  PERMISSION.SETTINGS.UPDATE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const integrationRetryPermissions = [
  PERMISSION.INTEGRATIONS.MANAGE,
  PERMISSION.INTEGRATIONS.WEBHOOK_REPROCESS,
  PERMISSION.NOTIFICATIONS.RETRY,
  PERMISSION.PAYMENT_RECONCILIATION.MATCH,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

const reconciliationManagePermissions = [
  PERMISSION.PAYMENT_RECONCILIATION.IMPORT,
  PERMISSION.PAYMENT_RECONCILIATION.MATCH,
  PERMISSION.PAYMENT_RECONCILIATION.AUTO_MATCH,
  PERMISSION.PAYMENT_RECONCILIATION.APPROVE,
  PERMISSION.INTEGRATIONS.MANAGE,
  PERMISSION.SYSTEM.FULL_ACCESS,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'], anyPermissions: integrationReadPermissions }));

router.get('/summary', controller.getSummary);
router.get('/health', controller.getHealth);
router.post('/diagnostics/run', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.HEALTH_CHECK, PERMISSION.INTEGRATIONS.TEST, PERMISSION.SYSTEM.FULL_ACCESS] }), controller.runDiagnostics);
router.get('/diagnostics/runs', controller.listDiagnosticRuns);
router.get('/diagnostics/runs/:runId', controller.getDiagnosticRun);
router.get('/failures', controller.getFailures);

router.get('/providers', controller.listProviders);
router.get('/providers/:providerCode', controller.getProvider);
router.get('/providers/:providerCode/config', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.CONFIG_READ, ...integrationReadPermissions] }), controller.getProviderConfig);
router.post('/providers/:providerCode/test', authorize({ anyPermissions: integrationManagePermissions }), controller.testProvider);
router.get('/providers/:providerCode/events', controller.getProviderEvents);
router.get('/providers/:providerCode/logs', controller.getProviderLogs);

router.get('/email/health', controller.getEmailHealth);
router.get('/email/config', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.CONFIG_READ, ...integrationReadPermissions] }), controller.getEmailConfig);
router.post('/email/test', authorize({ anyPermissions: integrationManagePermissions }), controller.testEmail);
router.get('/email/deliveries', controller.listEmailDeliveries);
router.post('/email/deliveries/:deliveryId/retry', authorize({ anyPermissions: integrationRetryPermissions }), controller.retryEmailDelivery);
router.post('/email/dispatch-queued', authorize({ anyPermissions: integrationManagePermissions }), controller.dispatchQueuedEmail);

router.get('/push/health', controller.getPushHealth);
router.get('/push/config', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.CONFIG_READ, ...integrationReadPermissions] }), controller.getPushConfig);
router.post('/push/test', authorize({ anyPermissions: integrationManagePermissions }), controller.testPush);
router.get('/push/deliveries', controller.listPushDeliveries);
router.post('/push/deliveries/:deliveryId/retry', authorize({ anyPermissions: integrationRetryPermissions }), controller.retryPushDelivery);
router.post('/push/dispatch-queued', authorize({ anyPermissions: integrationManagePermissions }), controller.dispatchQueuedPush);

router.get('/bank-qr/health', controller.getBankQrHealth);
router.get('/bank-qr/config', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.CONFIG_READ, ...integrationReadPermissions] }), controller.getBankQrConfig);
router.post('/bank-qr/preview', authorize({ anyPermissions: integrationManagePermissions }), controller.previewBankQr);
router.get('/bank-qr/intents', controller.listBankQrIntents);
router.get('/bank-qr/summary', controller.getBankQrSummary);

router.get('/momo-personal-qr/health', controller.getMomoHealth);
router.get('/momo-personal-qr/config', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.CONFIG_READ, ...integrationReadPermissions] }), controller.getMomoConfig);
router.post('/momo-personal-qr/preview', authorize({ anyPermissions: integrationManagePermissions }), controller.previewMomo);
router.get('/momo-personal-qr/intents', controller.listMomoIntents);

router.get('/payment-webhooks', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.WEBHOOK_READ, ...integrationReadPermissions] }), controller.listPaymentWebhooks);
router.get('/payment-webhooks/:eventId', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.WEBHOOK_READ, ...integrationReadPermissions] }), controller.getPaymentWebhook);
router.post('/payment-webhooks/:eventId/reprocess', authorize({ anyPermissions: integrationRetryPermissions }), controller.reprocessPaymentWebhook);
router.post('/payment-webhooks/:eventId/ignore', authorize({ anyPermissions: integrationManagePermissions }), controller.ignorePaymentWebhook);
router.post('/payment-webhooks/:eventId/link-payment-intent', authorize({ anyPermissions: integrationManagePermissions }), controller.linkPaymentWebhook);

router.get('/provider-webhook-events', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.WEBHOOK_READ, ...integrationReadPermissions] }), controller.listProviderWebhookEvents);
router.get('/provider-webhook-events/:eventId', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.WEBHOOK_READ, ...integrationReadPermissions] }), controller.getProviderWebhookEvent);
router.post('/provider-webhook-events/:eventId/reprocess', authorize({ anyPermissions: integrationRetryPermissions }), controller.reprocessProviderWebhookEvent);
router.post('/provider-webhook-events/:eventId/ignore', authorize({ anyPermissions: integrationManagePermissions }), controller.ignoreProviderWebhookEvent);
router.post('/provider-webhook-events/:eventId/link', authorize({ anyPermissions: integrationManagePermissions }), controller.linkProviderWebhookEvent);

router.get('/bank-statement-transactions', controller.listBankTransactions);
router.get('/bank-statement-transactions/:transactionId', controller.getBankTransaction);
router.get('/bank-statement-transactions/:transactionId/candidates', controller.getBankTransactionCandidates);
router.post('/bank-statement-transactions/:transactionId/match-intent', authorize({ anyPermissions: reconciliationManagePermissions }), controller.matchTransactionToIntent);
router.post('/bank-statement-transactions/:transactionId/match-invoice', authorize({ anyPermissions: reconciliationManagePermissions }), controller.matchTransactionToInvoice);
router.post('/bank-statement-transactions/:transactionId/mark-unmatched', authorize({ anyPermissions: reconciliationManagePermissions }), controller.markTransactionUnmatched);
router.post('/bank-statement-transactions/:transactionId/ignore', authorize({ anyPermissions: reconciliationManagePermissions }), controller.ignoreTransaction);
router.post('/bank-statement-transactions/:transactionId/dispute', authorize({ anyPermissions: reconciliationManagePermissions }), controller.disputeTransaction);

router.get('/reconciliation/overview', controller.getReconciliationOverview);
router.get('/reconciliation/batches', controller.listReconciliationBatches);
router.post('/reconciliation/batches', authorize({ anyPermissions: reconciliationManagePermissions }), controller.createReconciliationBatch);
router.get('/reconciliation/batches/:batchId', controller.getReconciliationBatch);
router.post('/reconciliation/batches/:batchId/close', authorize({ anyPermissions: reconciliationManagePermissions }), controller.closeReconciliationBatch);
router.post('/reconciliation/batches/:batchId/lock', authorize({ anyPermissions: reconciliationManagePermissions }), controller.lockReconciliationBatch);
router.post('/reconciliation/import', authorize({ anyPermissions: reconciliationManagePermissions }), controller.importReconciliationTransactions);
router.post('/reconciliation/auto-match', authorize({ anyPermissions: reconciliationManagePermissions }), controller.autoMatchReconciliation);

router.get('/google-oauth/health', controller.getGoogleOAuthHealth);
router.get('/google-oauth/config', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.CONFIG_READ, ...integrationReadPermissions] }), controller.getGoogleOAuthConfig);
router.post('/google-oauth/validate', authorize({ anyPermissions: integrationManagePermissions }), controller.validateGoogleOAuth);
router.get('/google-oauth/login-events', controller.listGoogleOAuthLoginEvents);

router.get('/logs', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.LOG_READ, ...integrationReadPermissions] }), controller.listLogs);
router.get('/logs/export', authorize({ anyPermissions: [PERMISSION.INTEGRATIONS.EXPORT, PERMISSION.AUDIT_LOGS.EXPORT, PERMISSION.SYSTEM.FULL_ACCESS] }), controller.exportLogs);

module.exports = router;
