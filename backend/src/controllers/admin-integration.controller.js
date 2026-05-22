const integrationService = require('../services/admin-integration.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getSummary: wrap(() => integrationService.getSummary(), 'Lấy tổng quan Integration Hub thành công.'),
  getHealth: wrap(() => integrationService.getHealth(), 'Lấy integration health thành công.'),
  runDiagnostics: wrap((req) => integrationService.runDiagnostics(req.body || {}, req.auth, requestMeta(req)), 'Chạy diagnostics integration thành công.', 201),
  listDiagnosticRuns: wrap((req) => integrationService.listDiagnosticRuns(req.query), 'Lấy lịch sử diagnostics integration thành công.'),
  getDiagnosticRun: wrap((req) => integrationService.getDiagnosticRun(req.params.runId), 'Lấy chi tiết diagnostics integration thành công.'),
  getFailures: wrap((req) => integrationService.getFailures(req.query), 'Lấy failure inbox integration thành công.'),

  listProviders: wrap(() => integrationService.listPaymentProviders(), 'Lấy registry provider thành công.'),
  getProvider: wrap((req) => integrationService.getProvider(req.params.providerCode), 'Lấy chi tiết provider thành công.'),
  getProviderConfig: wrap((req) => integrationService.getProviderConfig(req.params.providerCode), 'Lấy cấu hình provider thành công.'),
  testProvider: wrap((req) => {
    if (req.params.providerCode === 'email_smtp' || req.params.providerCode === 'email') {
      return integrationService.testEmail(req.body || {}, req.auth, requestMeta(req));
    }
    if (req.params.providerCode === 'push_http' || req.params.providerCode === 'push') {
      return integrationService.testPush(req.body || {}, req.auth, requestMeta(req));
    }
    if (req.params.providerCode === 'bank_qr' || req.params.providerCode === 'bank-qr') {
      return integrationService.previewBankQr(req.body || {});
    }
    if (req.params.providerCode === 'momo_personal_qr' || req.params.providerCode === 'momo-personal-qr') {
      return integrationService.previewMomo(req.body || {});
    }
    if (req.params.providerCode === 'google_oauth' || req.params.providerCode === 'google-oauth') {
      return integrationService.validateGoogleOAuth();
    }
    return integrationService.getProvider(req.params.providerCode);
  }, 'Test provider thành công.'),
  getProviderEvents: wrap((req) => integrationService.getProviderEvents(req.params.providerCode, req.query), 'Lấy provider events thành công.'),
  getProviderLogs: wrap((req) => integrationService.getProviderLogs(req.params.providerCode, req.query), 'Lấy provider logs thành công.'),

  getEmailHealth: wrap(() => integrationService.getProvider('email_smtp'), 'Lấy health email provider thành công.'),
  getEmailConfig: wrap(() => integrationService.getProviderConfig('email_smtp'), 'Lấy cấu hình email provider thành công.'),
  testEmail: wrap((req) => integrationService.testEmail(req.body || {}, req.auth, requestMeta(req)), 'Test email provider thành công.'),
  listEmailDeliveries: wrap((req) => integrationService.listDeliveries('email', req.query), 'Lấy email deliveries thành công.'),
  retryEmailDelivery: wrap((req) => integrationService.retryDelivery(req.params.deliveryId, req.auth, requestMeta(req)), 'Retry email delivery thành công.'),
  dispatchQueuedEmail: wrap((req) => integrationService.dispatchQueued('email', req.body || {}, req.auth, requestMeta(req)), 'Dispatch queued email thành công.'),

  getPushHealth: wrap(() => integrationService.getProvider('push_http'), 'Lấy health push provider thành công.'),
  getPushConfig: wrap(() => integrationService.getProviderConfig('push_http'), 'Lấy cấu hình push provider thành công.'),
  testPush: wrap((req) => integrationService.testPush(req.body || {}, req.auth, requestMeta(req)), 'Test push provider thành công.'),
  listPushDeliveries: wrap((req) => integrationService.listDeliveries('push', req.query), 'Lấy push deliveries thành công.'),
  retryPushDelivery: wrap((req) => integrationService.retryDelivery(req.params.deliveryId, req.auth, requestMeta(req)), 'Retry push delivery thành công.'),
  dispatchQueuedPush: wrap((req) => integrationService.dispatchQueued('push', req.body || {}, req.auth, requestMeta(req)), 'Dispatch queued push thành công.'),

  getBankQrHealth: wrap(() => integrationService.getProvider('bank_qr'), 'Lấy health Bank QR thành công.'),
  getBankQrConfig: wrap(() => integrationService.getProviderConfig('bank_qr'), 'Lấy cấu hình Bank QR thành công.'),
  previewBankQr: wrap((req) => integrationService.previewBankQr(req.body || {}), 'Preview Bank QR thành công.'),
  listBankQrIntents: wrap((req) => integrationService.listManualIntents('bank_qr', req.query), 'Lấy Bank QR intents thành công.'),
  getBankQrSummary: wrap(() => integrationService.getProvider('bank_qr'), 'Lấy summary Bank QR thành công.'),

  getMomoHealth: wrap(() => integrationService.getProvider('momo_personal_qr'), 'Lấy health MoMo QR thành công.'),
  getMomoConfig: wrap(() => integrationService.getProviderConfig('momo_personal_qr'), 'Lấy cấu hình MoMo QR thành công.'),
  previewMomo: wrap((req) => integrationService.previewMomo(req.body || {}), 'Preview MoMo QR thành công.'),
  listMomoIntents: wrap((req) => integrationService.listManualIntents('momo_personal_qr', req.query), 'Lấy MoMo intents thành công.'),

  listPaymentWebhooks: wrap((req) => integrationService.listProviderWebhookEvents(req.query), 'Lấy payment webhook events thành công.'),
  getPaymentWebhook: wrap((req) => integrationService.getProviderWebhookEvent(req.params.eventId), 'Lấy chi tiết payment webhook thành công.'),
  reprocessPaymentWebhook: wrap((req) => integrationService.reprocessWebhookEvent(req.params.eventId, req.body || {}, req.auth, requestMeta(req)), 'Reprocess payment webhook thành công.'),
  ignorePaymentWebhook: wrap((req) => integrationService.ignoreWebhookEvent(req.params.eventId, req.body || {}, req.auth, requestMeta(req)), 'Ignore payment webhook thành công.'),
  linkPaymentWebhook: wrap((req) => integrationService.linkWebhookEvent(req.params.eventId, req.body || {}, req.auth, requestMeta(req)), 'Link payment webhook thành công.'),

  listProviderWebhookEvents: wrap((req) => integrationService.listProviderWebhookEvents(req.query), 'Lấy provider webhook events thành công.'),
  getProviderWebhookEvent: wrap((req) => integrationService.getProviderWebhookEvent(req.params.eventId), 'Lấy chi tiết provider webhook event thành công.'),
  reprocessProviderWebhookEvent: wrap((req) => integrationService.reprocessWebhookEvent(req.params.eventId, req.body || {}, req.auth, requestMeta(req)), 'Reprocess provider webhook event thành công.'),
  ignoreProviderWebhookEvent: wrap((req) => integrationService.ignoreWebhookEvent(req.params.eventId, req.body || {}, req.auth, requestMeta(req)), 'Ignore provider webhook event thành công.'),
  linkProviderWebhookEvent: wrap((req) => integrationService.linkWebhookEvent(req.params.eventId, req.body || {}, req.auth, requestMeta(req)), 'Link provider webhook event thành công.'),

  listBankTransactions: wrap((req) => integrationService.listBankTransactions(req.query), 'Lấy bank statement transactions thành công.'),
  getBankTransaction: wrap((req) => integrationService.reconciliation.getTransactionDetail(req.params.transactionId, req.auth), 'Lấy chi tiết bank statement transaction thành công.'),
  getBankTransactionCandidates: wrap((req) => integrationService.reconciliation.getTransactionCandidates(req.params.transactionId, req.auth), 'Lấy candidates bank transaction thành công.'),
  matchTransactionToIntent: wrap((req) => integrationService.reconciliation.matchTransactionToIntent(req.params.transactionId, req.body || {}, req.auth, requestMeta(req)), 'Match transaction với intent thành công.'),
  matchTransactionToInvoice: wrap((req) => integrationService.reconciliation.matchTransactionToInvoice(req.params.transactionId, req.body || {}, req.auth, requestMeta(req)), 'Match transaction với invoice thành công.'),
  markTransactionUnmatched: wrap((req) => integrationService.reconciliation.markTransactionUnmatched(req.params.transactionId, req.body || {}, req.auth, requestMeta(req)), 'Đánh dấu unmatched thành công.'),
  ignoreTransaction: wrap((req) => integrationService.reconciliation.ignoreTransaction(req.params.transactionId, req.body || {}, req.auth, requestMeta(req)), 'Ignore transaction thành công.'),
  disputeTransaction: wrap((req) => integrationService.reconciliation.disputeTransaction(req.params.transactionId, req.body || {}, req.auth, requestMeta(req)), 'Dispute transaction thành công.'),

  getReconciliationOverview: wrap((req) => integrationService.reconciliation.getOverview(req.query, req.auth), 'Lấy tổng quan reconciliation thành công.'),
  listReconciliationBatches: wrap((req) => integrationService.listBatches(req.query), 'Lấy batch reconciliation thành công.'),
  createReconciliationBatch: wrap((req) => integrationService.reconciliation.createBatch(req.body || {}, req.auth, requestMeta(req)), 'Tạo reconciliation batch thành công.', 201),
  getReconciliationBatch: wrap((req) => integrationService.reconciliation.getBatchDetail(req.params.batchId, req.auth), 'Lấy reconciliation batch thành công.'),
  closeReconciliationBatch: wrap((req) => integrationService.reconciliation.closeBatch(req.params.batchId, req.body || {}, req.auth, requestMeta(req)), 'Đóng reconciliation batch thành công.'),
  lockReconciliationBatch: wrap((req) => integrationService.reconciliation.lockBatch(req.params.batchId, req.body || {}, req.auth, requestMeta(req)), 'Khóa reconciliation batch thành công.'),
  importReconciliationTransactions: wrap((req) => integrationService.reconciliation.importTransactions(req.body || {}, req.auth, requestMeta(req)), 'Import reconciliation transactions thành công.', 201),
  autoMatchReconciliation: wrap((req) => integrationService.reconciliation.autoMatch(req.body || {}, req.auth, requestMeta(req)), 'Auto-match reconciliation thành công.'),

  getGoogleOAuthHealth: wrap(() => integrationService.getProvider('google_oauth'), 'Lấy health Google OAuth thành công.'),
  getGoogleOAuthConfig: wrap(() => integrationService.getProviderConfig('google_oauth'), 'Lấy cấu hình Google OAuth thành công.'),
  validateGoogleOAuth: wrap(() => integrationService.validateGoogleOAuth(), 'Validate Google OAuth thành công.'),
  listGoogleOAuthLoginEvents: wrap((req) => integrationService.getGoogleLoginEvents(req.query), 'Lấy Google OAuth login events thành công.'),

  listLogs: wrap((req) => integrationService.listLogs(req.query), 'Lấy integration logs thành công.'),
  exportLogs: wrap((req) => integrationService.exportLogs(req.query, req.auth, requestMeta(req)), 'Export integration logs thành công.'),
};
