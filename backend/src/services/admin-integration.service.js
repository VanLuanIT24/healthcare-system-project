const crypto = require('crypto');
const { Types } = require('mongoose');
const env = require('../config/env');
const {
  AuditLog,
  BankStatementTransaction,
  IntegrationDiagnosticRun,
  IntegrationHealthCheck,
  IntegrationLog,
  NotificationDelivery,
  PaymentIntent,
  ProviderWebhookEvent,
  ReconciliationBatch,
} = require('../models');
const {
  NOTIFICATION_DELIVERY_CHANNEL,
  NOTIFICATION_DELIVERY_STATUS,
  PAYMENT_INTENT_STATUS,
  PAYMENT_PROVIDER,
  RECONCILIATION_TRANSACTION_STATUS,
} = require('../constants/statuses');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const actorContext = require('../common/actors');
const bankQrProvider = require('../payments/providers/bank-qr.provider');
const momoPersonalQrProvider = require('../payments/providers/momo-personal-qr.provider');
const paymentProviderRegistry = require('../payments/payment-provider.registry');
const emailService = require('./email.service');
const pushProvider = require('../notifications/providers/push.provider');
const notificationDeliveryWorker = require('../notifications/notification-delivery.worker');
const notificationService = require('./notification.service');
const reconciliationService = require('./reconciliation.service');
const realtimeService = require('../realtime/realtime.service');
const presenceService = require('../realtime/presence.service');

const MANUAL_PROVIDER_GROUPS = {
  bank_qr: [PAYMENT_PROVIDER.BANK_QR_MANUAL, PAYMENT_PROVIDER.BANK_QR],
  momo_personal_qr: [PAYMENT_PROVIDER.MOMO_PERSONAL_QR],
  cash_manual: [PAYMENT_PROVIDER.CASH_MANUAL],
};

const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'secret',
  'client_secret',
  'token',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'set-cookie',
  'smtp_pass',
  'push_provider_token',
]);

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function nowIso() {
  return new Date().toISOString();
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function hoursAgo(hours) {
  return new Date(Date.now() - Number(hours || 24) * 60 * 60 * 1000);
}

function isConfigured(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function configState(value, { mask = false, showLast = 4 } = {}) {
  if (!isConfigured(value)) return { configured: false, value: 'missing' };
  if (!mask) return { configured: true, value };
  const text = String(value);
  return { configured: true, value: text.length <= showLast ? 'configured' : `***${text.slice(-showLast)}` };
}

function maskValue(value, key = '') {
  if (value === undefined || value === null) return value;
  const normalized = String(key || '').toLowerCase();
  if (SENSITIVE_KEYS.has(normalized) || normalized.endsWith('_secret') || normalized.endsWith('_token') || normalized.includes('password')) {
    return '********';
  }
  if (normalized.includes('account_no')) {
    const text = String(value);
    return text.length > 4 ? `${'*'.repeat(Math.max(text.length - 4, 0))}${text.slice(-4)}` : 'configured';
  }
  return value;
}

function maskPayload(value, seen) {
  const activeSeen = seen && typeof seen.has === 'function' && typeof seen.add === 'function' && typeof seen.delete === 'function'
    ? seen
    : new WeakSet();
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (typeof value.toHexString === 'function') return String(value);
  if (activeSeen.has(value)) return '[Circular]';
  activeSeen.add(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => maskPayload(item, activeSeen));
    activeSeen.delete(value);
    return items;
  }
  const output = {};
  Object.entries(value).forEach(([key, item]) => {
    output[key] = maskValue(maskPayload(item, activeSeen), key);
  });
  activeSeen.delete(value);
  return output;
}

function statusFrom({ enabled, configured, failed = 0, warning = false }) {
  if (!enabled) return 'disabled';
  if (!configured) return 'critical';
  if (failed > 0) return failed > 10 ? 'critical' : 'warning';
  if (warning) return 'warning';
  return 'healthy';
}

function addDateRange(filter, field, query = {}) {
  const from = query.from_at || query.date_from || query.created_from || query.received_from;
  const to = query.to_at || query.date_to || query.created_to || query.received_to;
  if (!from && !to) return;
  filter[field] = {};
  if (from) filter[field].$gte = new Date(from);
  if (to) filter[field].$lte = new Date(to);
}

function keywordRegex(query = {}) {
  const keyword = normalizeString(query.keyword || query.q || query.search);
  return keyword ? new RegExp(escapeRegex(keyword), 'i') : null;
}

function countMap(rows = []) {
  return Object.fromEntries(rows.map((row) => [row._id || 'unknown', { count: row.count || 0, amount: row.amount || 0 }]));
}

async function countStatuses(Model, match, field = 'status') {
  const rows = await Model.aggregate([
    { $match: match || {} },
    { $group: { _id: `$${field}`, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
  ]);
  return countMap(rows);
}

async function latest(Model, filter, sortField, projection = null) {
  let query = Model.findOne(filter || {}).sort({ [sortField || 'created_at']: -1 }).lean();
  if (projection) query = query.select(projection);
  return query;
}

async function listPaged(Model, filter, query, sort, populate = null) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  let itemsQuery = Model.find(filter).sort(sort || { created_at: -1 }).skip(skip).limit(limit).lean();
  if (populate) {
    populate.forEach((item) => {
      itemsQuery = itemsQuery.populate(item);
    });
  }
  const [items, total] = await Promise.all([itemsQuery, Model.countDocuments(filter)]);
  return { items: items.map((item) => maskPayload(item)), pagination: buildPagination(page, limit, total) };
}

function actorSnapshot(actor = {}) {
  return {
    actor_type: actorContext.getActorType(actor) || actor.actorType || actor.actor_type || 'system',
    actor_id: actorContext.getActorId(actor) || actor.actorId || actor.userId || actor.user_id,
    user_id: actor.userId || actor.user_id,
  };
}

async function recordIntegrationLog(payload = {}) {
  return IntegrationLog.create({
    source: payload.source || 'admin_integration',
    provider: payload.provider,
    action: payload.action,
    status: payload.status || 'success',
    severity: payload.severity || 'info',
    message: payload.message,
    request_id: payload.requestMeta?.requestId || payload.requestMeta?.request_id,
    correlation_id: payload.requestMeta?.correlationId || payload.requestMeta?.correlation_id,
    actor_type: payload.actorSnapshot?.actor_type,
    actor_id: payload.actorSnapshot?.actor_id,
    target_type: payload.targetType,
    target_id: payload.targetId,
    payload_masked: maskPayload(payload.payload || {}),
    error_code: payload.errorCode,
    error_message: payload.errorMessage,
    latency_ms: payload.latencyMs,
    metadata: maskPayload(payload.metadata || {}),
  }).catch(() => null);
}

async function deliveryStats(channel) {
  const match = { channel };
  const [byStatus, lastSuccess, lastFailure, pendingDue] = await Promise.all([
    countStatuses(NotificationDelivery, match),
    latest(NotificationDelivery, { ...match, status: { $in: [NOTIFICATION_DELIVERY_STATUS.SENT, NOTIFICATION_DELIVERY_STATUS.DELIVERED] } }, 'last_attempt_at'),
    latest(NotificationDelivery, { ...match, status: NOTIFICATION_DELIVERY_STATUS.FAILED }, 'last_attempt_at'),
    NotificationDelivery.countDocuments({
      ...match,
      status: NOTIFICATION_DELIVERY_STATUS.PENDING,
      $or: [{ next_attempt_at: null }, { next_attempt_at: { $exists: false } }, { next_attempt_at: { $lte: new Date() } }],
    }),
  ]);
  return {
    by_status: byStatus,
    pending: byStatus.pending?.count || 0,
    sent: byStatus.sent?.count || 0,
    delivered: byStatus.delivered?.count || 0,
    failed: byStatus.failed?.count || 0,
    skipped: byStatus.skipped?.count || 0,
    retry_due_now: pendingDue,
    last_success_at: lastSuccess?.last_attempt_at || lastSuccess?.sent_at || lastSuccess?.delivered_at || null,
    last_failure_at: lastFailure?.last_attempt_at || lastFailure?.updated_at || null,
    last_error: lastFailure?.last_error || null,
  };
}

async function manualPaymentStats(providers) {
  const match = { provider: { $in: providers } };
  const [byStatus, confirmedToday, rejectedToday, lastSuccess, lastFailure] = await Promise.all([
    countStatuses(PaymentIntent, match),
    PaymentIntent.countDocuments({ ...match, confirmed_at: { $gte: startOfToday() } }),
    PaymentIntent.countDocuments({ ...match, manual_rejected_at: { $gte: startOfToday() } }),
    latest(PaymentIntent, { ...match, status: { $in: [PAYMENT_INTENT_STATUS.CONFIRMED, PAYMENT_INTENT_STATUS.PAID] } }, 'confirmed_at'),
    latest(PaymentIntent, { ...match, status: { $in: [PAYMENT_INTENT_STATUS.REJECTED, PAYMENT_INTENT_STATUS.MANUAL_REVIEW] } }, 'updated_at'),
  ]);
  const pendingStatuses = [
    PAYMENT_INTENT_STATUS.PENDING,
    PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
    PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
    PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
  ];
  const pending = pendingStatuses.reduce((sum, status) => sum + (byStatus[status]?.count || 0), 0);
  const pendingAmount = pendingStatuses.reduce((sum, status) => sum + (byStatus[status]?.amount || 0), 0);
  return {
    by_status: byStatus,
    pending,
    pending_amount: pendingAmount,
    submitted_receipt: byStatus.submitted_receipt?.count || 0,
    manual_review: byStatus.manual_review?.count || 0,
    confirmed_today: confirmedToday,
    rejected_today: rejectedToday,
    last_success_at: lastSuccess?.confirmed_at || lastSuccess?.paid_at || null,
    last_failure_at: lastFailure?.updated_at || null,
    last_error: lastFailure?.failure_reason || lastFailure?.manual_review_reason || lastFailure?.manual_reject_reason || null,
  };
}

async function reconciliationStats() {
  const [byStatus, disputed, unmatched, lastMatched] = await Promise.all([
    countStatuses(BankStatementTransaction, {}, 'match_status'),
    BankStatementTransaction.countDocuments({ match_status: RECONCILIATION_TRANSACTION_STATUS.DISPUTED }),
    BankStatementTransaction.countDocuments({ match_status: RECONCILIATION_TRANSACTION_STATUS.UNMATCHED }),
    latest(BankStatementTransaction, { match_status: RECONCILIATION_TRANSACTION_STATUS.MATCHED }, 'reviewed_at'),
  ]);
  const total = Object.values(byStatus).reduce((sum, item) => sum + item.count, 0);
  const matched = byStatus.matched?.count || 0;
  return {
    by_status: byStatus,
    unmatched,
    disputed,
    failed: disputed,
    pending: unmatched,
    match_rate: total ? Math.round((matched / total) * 100) : 0,
    last_success_at: lastMatched?.reviewed_at || null,
    last_failure_at: disputed ? (await latest(BankStatementTransaction, { match_status: RECONCILIATION_TRANSACTION_STATUS.DISPUTED }, 'reviewed_at'))?.reviewed_at : null,
  };
}

async function webhookStats(provider = null) {
  const match = provider ? { provider } : {};
  const [byStatus, invalidSignature, lastSuccess, lastFailure] = await Promise.all([
    countStatuses(ProviderWebhookEvent, match),
    ProviderWebhookEvent.countDocuments({ ...match, signature_valid: false }),
    latest(ProviderWebhookEvent, { ...match, status: 'processed' }, 'processed_at'),
    latest(ProviderWebhookEvent, { ...match, status: 'failed' }, 'received_at'),
  ]);
  return {
    by_status: byStatus,
    pending: byStatus.received?.count || 0,
    failed: byStatus.failed?.count || 0,
    processed: byStatus.processed?.count || 0,
    ignored: byStatus.ignored?.count || 0,
    invalid_signature: invalidSignature,
    last_success_at: lastSuccess?.processed_at || null,
    last_failure_at: lastFailure?.received_at || null,
    last_error: lastFailure?.error_message || null,
  };
}

async function googleOAuthStats() {
  const match = { action: { $regex: /^auth\.google/ } };
  const [success, failed, lastSuccess, lastFailure] = await Promise.all([
    AuditLog.countDocuments({ ...match, status: 'success' }),
    AuditLog.countDocuments({ ...match, status: { $in: ['failed', 'failure'] } }),
    latest(AuditLog, { ...match, status: 'success' }, 'created_at'),
    latest(AuditLog, { ...match, status: { $in: ['failed', 'failure'] } }, 'created_at'),
  ]);
  return {
    success,
    failed,
    pending: null,
    last_success_at: lastSuccess?.created_at || null,
    last_failure_at: lastFailure?.created_at || null,
    last_error: lastFailure?.message || lastFailure?.metadata?.error || null,
  };
}

function providerCapabilities(providerCode) {
  const base = {
    create_payment: false,
    webhook: false,
    query_transaction: false,
    refund: false,
    reconciliation: false,
    test: true,
  };
  if (providerCode === 'bank_qr') {
    return { ...base, create_payment: true, reconciliation: true, qr_preview: true, manual_confirmation: true };
  }
  if (providerCode === 'momo_personal_qr') {
    return { ...base, create_payment: true, qr_preview: true, manual_confirmation: true };
  }
  if (providerCode === 'email_smtp') return { ...base, outbound_delivery: true, dispatch_queue: true, retry: true };
  if (providerCode === 'push_http') return { ...base, outbound_delivery: true, dispatch_queue: true, retry: true };
  if (providerCode === 'payment_webhook') return { ...base, webhook: true, reprocess: true };
  if (providerCode === 'reconciliation') return { ...base, reconciliation: true, auto_match: true, import_statement: true };
  if (providerCode === 'google_oauth') return { ...base, oauth: true, validate_config: true };
  if (providerCode === 'realtime_socket') return { ...base, realtime: true, presence: true };
  return base;
}

async function buildProviderRows() {
  const [
    email,
    push,
    bankQr,
    momo,
    webhook,
    reconciliation,
    google,
  ] = await Promise.all([
    deliveryStats(NOTIFICATION_DELIVERY_CHANNEL.EMAIL),
    deliveryStats(NOTIFICATION_DELIVERY_CHANNEL.PUSH),
    manualPaymentStats(MANUAL_PROVIDER_GROUPS.bank_qr),
    manualPaymentStats(MANUAL_PROVIDER_GROUPS.momo_personal_qr),
    webhookStats(),
    reconciliationStats(),
    googleOAuthStats(),
  ]);

  const emailConfigured = Boolean(env.smtpHost && env.smtpFromEmail);
  const pushConfigured = Boolean(env.pushProviderUrl && env.pushProviderToken);
  const bankQrConfigured = Boolean(env.bankQrBankBin && env.bankQrAccountNo);
  const momoConfigured = Boolean(env.momoPersonalQrImageUrl || env.momoPersonalQrImagePath);
  const googleConfigured = Boolean(env.googleClientId && env.googleClientSecret && env.googleCallbackUrl);
  const socketServer = realtimeService.getSocketServer();
  const presence = typeof presenceService.listPresence === 'function' ? presenceService.listPresence() : [];

  return [
    {
      code: 'email_smtp',
      name: 'Email SMTP',
      type: 'email',
      enabled: Boolean(env.smtpEnabled),
      configured: emailConfigured,
      health: statusFrom({ enabled: env.smtpEnabled, configured: emailConfigured, failed: email.failed }),
      mode: 'smtp',
      capabilities: providerCapabilities('email_smtp'),
      kpi: email,
      last_success_at: email.last_success_at,
      last_failure_at: email.last_failure_at,
      last_error: email.last_error,
    },
    {
      code: 'push_http',
      name: 'Push HTTP',
      type: 'push',
      enabled: pushProvider.isEnabled(),
      configured: pushConfigured,
      health: statusFrom({ enabled: pushProvider.isEnabled(), configured: pushConfigured, failed: push.failed }),
      mode: 'http',
      capabilities: providerCapabilities('push_http'),
      kpi: push,
      last_success_at: push.last_success_at,
      last_failure_at: push.last_failure_at,
      last_error: push.last_error,
    },
    {
      code: 'bank_qr',
      name: 'Bank QR',
      type: 'payment',
      enabled: bankQrProvider.isEnabled(),
      configured: bankQrConfigured,
      health: statusFrom({ enabled: env.manualPaymentEnabled, configured: bankQrConfigured, failed: bankQr.manual_review, warning: true }),
      mode: 'manual_qr',
      capabilities: providerCapabilities('bank_qr'),
      kpi: bankQr,
      last_success_at: bankQr.last_success_at,
      last_failure_at: bankQr.last_failure_at,
      last_error: bankQr.last_error,
    },
    {
      code: 'momo_personal_qr',
      name: 'MoMo Personal QR',
      type: 'payment',
      enabled: momoPersonalQrProvider.isEnabled(),
      configured: momoConfigured,
      health: statusFrom({ enabled: env.momoPersonalQrEnabled, configured: momoConfigured, failed: momo.manual_review }),
      mode: 'manual_static_qr',
      capabilities: providerCapabilities('momo_personal_qr'),
      kpi: momo,
      last_success_at: momo.last_success_at,
      last_failure_at: momo.last_failure_at,
      last_error: momo.last_error,
    },
    {
      code: 'payment_webhook',
      name: 'Payment Webhook',
      type: 'inbound',
      enabled: false,
      configured: false,
      health: webhook.failed || webhook.invalid_signature ? 'critical' : 'disabled',
      mode: 'webhook',
      capabilities: providerCapabilities('payment_webhook'),
      kpi: webhook,
      last_success_at: webhook.last_success_at,
      last_failure_at: webhook.last_failure_at,
      last_error: webhook.last_error,
    },
    {
      code: 'reconciliation',
      name: 'Reconciliation',
      type: 'payment_ops',
      enabled: Boolean(env.manualPaymentEnabled),
      configured: true,
      health: statusFrom({ enabled: env.manualPaymentEnabled, configured: true, failed: reconciliation.disputed, warning: reconciliation.unmatched > 0 }),
      mode: 'manual_qr_reconciliation',
      capabilities: providerCapabilities('reconciliation'),
      kpi: reconciliation,
      last_success_at: reconciliation.last_success_at,
      last_failure_at: reconciliation.last_failure_at,
      last_error: reconciliation.last_error,
    },
    {
      code: 'google_oauth',
      name: 'Google OAuth',
      type: 'oauth',
      enabled: Boolean(env.googleAuthEnabled),
      configured: googleConfigured,
      health: statusFrom({ enabled: env.googleAuthEnabled, configured: googleConfigured, failed: google.failed }),
      mode: 'oauth',
      capabilities: providerCapabilities('google_oauth'),
      kpi: google,
      last_success_at: google.last_success_at,
      last_failure_at: google.last_failure_at,
      last_error: google.last_error,
    },
    {
      code: 'realtime_socket',
      name: 'Realtime Socket',
      type: 'realtime',
      enabled: Boolean(socketServer),
      configured: true,
      health: socketServer ? 'healthy' : 'warning',
      mode: 'socket',
      capabilities: providerCapabilities('realtime_socket'),
      kpi: { online_actors: presence.length, connected_sockets: presence.reduce((sum, item) => sum + Number(item.socket_count || 0), 0) },
      last_success_at: socketServer ? nowIso() : null,
      last_failure_at: null,
    },
  ];
}

async function getSummary() {
  const [providers, failures, logs] = await Promise.all([
    buildProviderRows(),
    getFailures({ limit: 8 }),
    listLogs({ limit: 8 }),
  ]);
  const healthCounts = providers.reduce((acc, provider) => {
    acc[provider.health] = (acc[provider.health] || 0) + 1;
    return acc;
  }, {});
  const status = providers.some((provider) => provider.health === 'critical')
    ? 'critical'
    : providers.some((provider) => provider.health === 'warning')
      ? 'warning'
      : 'healthy';
  return {
    status,
    health_counts: healthCounts,
    providers,
    failure_inbox: failures.items,
    recent_logs: logs.items,
    generated_at: nowIso(),
  };
}

async function getHealth() {
  const providers = await buildProviderRows();
  const checks = providers.map((provider) => ({
    provider: provider.code,
    check_type: `${provider.code}.config_and_backlog`,
    status: provider.health,
    configured: provider.configured,
    enabled: provider.enabled,
    checked_at: new Date(),
    error_message: provider.last_error,
    recommendation: recommendationForProvider(provider),
    metadata: { kpi: provider.kpi, capabilities: provider.capabilities },
  }));
  await IntegrationHealthCheck.insertMany(checks, { ordered: false }).catch(() => null);
  return {
    status: providers.some((provider) => provider.health === 'critical')
      ? 'critical'
      : providers.some((provider) => provider.health === 'warning') ? 'warning' : 'healthy',
    checks,
    generated_at: nowIso(),
  };
}

function recommendationForProvider(provider = {}) {
  if (!provider.enabled) return `${provider.name} đang tắt; chỉ bật khi có quy trình vận hành rõ ràng.`;
  if (!provider.configured) return `Bổ sung cấu hình bắt buộc cho ${provider.name}; secret chỉ hiển thị dạng masked.`;
  if (provider.health === 'critical') return `Ưu tiên xử lý lỗi ${provider.name}, mở failure inbox và audit trước khi retry hàng loạt.`;
  if (provider.health === 'warning') return `${provider.name} có backlog hoặc manual review; kiểm tra các hàng đang chờ xử lý.`;
  return `${provider.name} đang sẵn sàng.`;
}

async function getProvider(providerCode) {
  const providers = await buildProviderRows();
  const provider = providers.find((item) => item.code === providerCode || item.name.toLowerCase().replace(/\s+/g, '_') === providerCode);
  if (!provider) throw createError('Không tìm thấy provider integration.', 404);
  return {
    ...provider,
    config: getProviderConfig(provider.code),
    warnings: providerWarnings(provider),
  };
}

function providerWarnings(provider = {}) {
  const warnings = [];
  if (!provider.configured) warnings.push({ severity: 'critical', message: `${provider.name} thiếu cấu hình bắt buộc.` });
  if (provider.code === 'bank_qr') warnings.push({ severity: 'medium', message: 'Bank QR là manual provider: không webhook, không query transaction, không refund API.' });
  if (provider.code === 'momo_personal_qr') warnings.push({ severity: 'medium', message: 'MoMo Personal QR là static QR manual, cần biên lai hoặc đối soát thủ công.' });
  if (provider.kpi?.failed) warnings.push({ severity: 'high', message: `${provider.kpi.failed} lỗi cần kiểm tra.` });
  if (provider.kpi?.manual_review) warnings.push({ severity: 'high', message: `${provider.kpi.manual_review} payment cần manual review.` });
  return warnings;
}

function getProviderConfig(providerCode) {
  const configs = {
    email_smtp: emailConfig(),
    push_http: pushConfig(),
    bank_qr: bankQrConfig(),
    momo_personal_qr: momoConfig(),
    google_oauth: googleConfig(),
    payment_webhook: {
      provider: 'payment_webhook',
      source: 'code',
      values: {
        enabled: { configured: false, value: false },
        route: { configured: false, value: '/api/billing/payment-webhooks/:provider (not mounted)' },
        signature_secret: { configured: false, value: 'missing' },
      },
    },
    reconciliation: {
      provider: 'reconciliation',
      source: 'service',
      values: {
        provider_mode: { configured: true, value: 'manual_qr_reconciliation' },
        statement_import_required: { configured: true, value: true },
        webhook_unavailable: { configured: true, value: true },
      },
    },
  };
  return configs[providerCode] || { provider: providerCode, source: 'unknown', values: {} };
}

function emailConfig() {
  return {
    provider: 'email_smtp',
    source: 'env',
    values: {
      SMTP_ENABLED: { configured: true, value: Boolean(env.smtpEnabled) },
      SMTP_HOST: configState(env.smtpHost),
      SMTP_PORT: { configured: true, value: env.smtpPort },
      SMTP_SECURE: { configured: true, value: Boolean(env.smtpSecure) },
      SMTP_USER: configState(env.smtpUser, { mask: true }),
      SMTP_PASS: configState(env.smtpPass, { mask: true }),
      SMTP_FROM_NAME: configState(env.smtpFromName),
      SMTP_FROM_EMAIL: configState(env.smtpFromEmail),
      SMTP_REPLY_TO: configState(env.smtpReplyTo),
    },
  };
}

function pushConfig() {
  return {
    provider: 'push_http',
    source: 'env',
    values: {
      PUSH_PROVIDER_URL: configState(env.pushProviderUrl, { mask: true, showLast: 12 }),
      PUSH_PROVIDER_TOKEN: configState(env.pushProviderToken, { mask: true }),
      auth_mode: { configured: true, value: 'bearer' },
      channel: { configured: true, value: 'push' },
      adapter: { configured: true, value: 'http-channel.provider.js' },
    },
    payload_contract: {
      notification_id: 'string',
      recipient_type: 'staff | patient | relative',
      recipient_id: 'string',
      title: 'string',
      body: 'string',
      data: {},
      delivery_payload: {},
    },
  };
}

function bankQrConfig() {
  return {
    provider: 'bank_qr',
    source: 'env',
    values: {
      MANUAL_PAYMENT_ENABLED: { configured: true, value: Boolean(env.manualPaymentEnabled) },
      BANK_QR_BANK_BIN: configState(env.bankQrBankBin, { mask: true }),
      BANK_QR_ACCOUNT_NO: configState(env.bankQrAccountNo, { mask: true }),
      BANK_QR_ACCOUNT_NAME: configState(env.bankQrAccountName, { mask: true }),
      BANK_QR_TEMPLATE: configState(env.bankQrTemplate),
      BANK_QR_INTENT_TTL_MINUTES: { configured: true, value: env.bankQrIntentTtlMinutes },
      provider_mode: { configured: true, value: 'vietqr_static_payload_generated' },
    },
  };
}

function momoConfig() {
  return {
    provider: 'momo_personal_qr',
    source: 'env',
    values: {
      MANUAL_PAYMENT_ENABLED: { configured: true, value: Boolean(env.manualPaymentEnabled) },
      MOMO_PERSONAL_QR_ENABLED: { configured: true, value: Boolean(env.momoPersonalQrEnabled) },
      MOMO_PERSONAL_QR_IMAGE_URL: configState(env.momoPersonalQrImageUrl, { mask: true, showLast: 16 }),
      MOMO_PERSONAL_QR_IMAGE_PATH: configState(env.momoPersonalQrImagePath, { mask: true, showLast: 16 }),
      MOMO_PERSONAL_PHONE: configState(env.momoPersonalPhone, { mask: true }),
      MOMO_PERSONAL_ACCOUNT_NAME: configState(env.momoPersonalAccountName, { mask: true }),
      MOMO_PERSONAL_NOTE_PREFIX: configState(env.momoPersonalNotePrefix),
    },
  };
}

function googleConfig() {
  return {
    provider: 'google_oauth',
    source: 'env',
    values: {
      GOOGLE_AUTH_ENABLED: { configured: true, value: Boolean(env.googleAuthEnabled) },
      GOOGLE_CLIENT_ID: configState(env.googleClientId, { mask: true, showLast: 8 }),
      GOOGLE_CLIENT_SECRET: configState(env.googleClientSecret, { mask: true }),
      GOOGLE_CALLBACK_URL: configState(env.googleCallbackUrl),
      FRONTEND_AUTH_SUCCESS_URL: configState(env.frontendAuthSuccessUrl),
      FRONTEND_AUTH_FAILURE_URL: configState(env.frontendAuthFailureUrl),
    },
  };
}

async function getFailures(query = {}) {
  const limit = Math.min(Number(query.limit || 30), 100);
  const [failedDeliveries, manualReviews, unmatchedTx, failedWebhook, googleFailures] = await Promise.all([
    NotificationDelivery.find({ status: NOTIFICATION_DELIVERY_STATUS.FAILED }).sort({ updated_at: -1 }).limit(limit).populate('notification_id', 'title recipient_type recipient_id priority').lean(),
    PaymentIntent.find({ status: PAYMENT_INTENT_STATUS.MANUAL_REVIEW }).sort({ updated_at: -1 }).limit(limit).lean(),
    BankStatementTransaction.find({ match_status: { $in: [RECONCILIATION_TRANSACTION_STATUS.UNMATCHED, RECONCILIATION_TRANSACTION_STATUS.DISPUTED] } }).sort({ transaction_at: -1 }).limit(limit).lean(),
    ProviderWebhookEvent.find({ $or: [{ status: 'failed' }, { signature_valid: false }] }).sort({ received_at: -1 }).limit(limit).lean(),
    AuditLog.find({ action: { $regex: /^auth\.google/ }, status: { $in: ['failed', 'failure'] } }).sort({ created_at: -1 }).limit(limit).lean(),
  ]);
  const items = [
    ...failedDeliveries.map((item) => ({
      id: toId(item._id),
      severity: item.channel === 'push' ? 'critical' : 'high',
      source: item.channel === 'email' ? 'Email SMTP' : 'Push Provider',
      object: `Delivery ${toId(item._id)}`,
      provider: item.provider || item.channel,
      status: item.status,
      error: item.last_error,
      age_at: item.updated_at || item.last_attempt_at,
      action: 'retry_delivery',
      raw: item,
    })),
    ...manualReviews.map((item) => ({
      id: toId(item._id),
      severity: 'high',
      source: item.provider === PAYMENT_PROVIDER.MOMO_PERSONAL_QR ? 'MoMo Personal QR' : 'Bank QR',
      object: item.intent_code,
      provider: item.provider,
      status: item.status,
      error: item.manual_review_reason || item.detected_reason || item.failure_reason,
      age_at: item.updated_at,
      action: 'review_payment',
      raw: item,
    })),
    ...unmatchedTx.map((item) => ({
      id: toId(item._id),
      severity: item.match_status === RECONCILIATION_TRANSACTION_STATUS.DISPUTED ? 'critical' : 'medium',
      source: 'Reconciliation',
      object: item.transaction_id,
      provider: item.provider,
      status: item.match_status,
      error: item.mismatch_reason || 'unmatched_bank_statement_transaction',
      age_at: item.transaction_at,
      action: 'match_transaction',
      raw: item,
    })),
    ...failedWebhook.map((item) => ({
      id: toId(item._id),
      severity: item.signature_valid === false ? 'critical' : 'high',
      source: 'Payment Webhook',
      object: item.event_id,
      provider: item.provider,
      status: item.status,
      error: item.signature_valid === false ? 'invalid_signature' : item.error_message,
      age_at: item.received_at,
      action: 'reprocess_webhook',
      raw: item,
    })),
    ...googleFailures.map((item) => ({
      id: toId(item._id),
      severity: 'medium',
      source: 'Google OAuth',
      object: item.request_id || toId(item._id),
      provider: 'google_oauth',
      status: item.status,
      error: item.message,
      age_at: item.created_at,
      action: 'view_oauth_log',
      raw: item,
    })),
  ].sort((left, right) => new Date(right.age_at || 0) - new Date(left.age_at || 0)).slice(0, limit);
  return { items: items.map((item) => maskPayload(item)), pagination: buildPagination(1, limit, items.length) };
}

async function listDeliveries(channel, query = {}) {
  const filter = { channel };
  if (query.status) filter.status = query.status;
  if (query.provider) filter.provider = query.provider;
  addDateRange(filter, 'created_at', query);
  const regex = keywordRegex(query);
  if (regex) filter.$or = [{ provider: regex }, { last_error: regex }];
  return listPaged(NotificationDelivery, filter, query, { updated_at: -1, created_at: -1 }, [{ path: 'notification_id', select: 'title message body recipient_type recipient_id priority status payload created_at' }]);
}

async function retryDelivery(deliveryId, actor = {}, requestMeta = {}) {
  const delivery = await NotificationDelivery.findById(deliveryId);
  if (!delivery) throw createError('Không tìm thấy notification delivery.', 404);
  delivery.status = NOTIFICATION_DELIVERY_STATUS.PENDING;
  delivery.next_attempt_at = new Date();
  delivery.last_error = undefined;
  delivery.payload = { ...(delivery.payload || {}), admin_retry_at: new Date(), admin_retry_by: actorSnapshot(actor) };
  await delivery.save();
  const result = await notificationDeliveryWorker.dispatchDelivery(delivery._id);
  await recordIntegrationLog({
    provider: delivery.channel,
    action: 'integration.delivery_retry',
    status: result?.status === NOTIFICATION_DELIVERY_STATUS.FAILED ? 'failed' : 'success',
    message: `Retry notification delivery ${delivery._id}`,
    actorSnapshot: actorSnapshot(actor),
    targetType: 'notification_delivery',
    targetId: delivery._id,
    requestMeta,
    metadata: { result },
  });
  return maskPayload(result);
}

async function dispatchQueued(channel, payload = {}, actor = {}, requestMeta = {}) {
  const limit = Math.min(Number(payload.limit || 50), 200);
  let result;
  if (channel) {
    const now = new Date();
    const deliveries = await NotificationDelivery.find({
      channel,
      status: NOTIFICATION_DELIVERY_STATUS.PENDING,
      $or: [
        { next_attempt_at: null },
        { next_attempt_at: { $exists: false } },
        { next_attempt_at: { $lte: now } },
      ],
    }).sort({ created_at: 1 }).limit(limit).lean();
    const processed = [];
    for (const delivery of deliveries) {
      processed.push(await notificationDeliveryWorker.dispatchDelivery(delivery._id));
    }
    result = {
      processed: processed.length,
      sent: processed.filter((item) => item?.status === NOTIFICATION_DELIVERY_STATUS.SENT).length,
      delivered: processed.filter((item) => item?.status === NOTIFICATION_DELIVERY_STATUS.DELIVERED).length,
      failed: processed.filter((item) => item?.status === NOTIFICATION_DELIVERY_STATUS.FAILED).length,
      skipped: processed.filter((item) => item?.skipped || item?.status === NOTIFICATION_DELIVERY_STATUS.SKIPPED).length,
      delivery_ids: deliveries.map((item) => toId(item._id)),
    };
  } else {
    result = await notificationDeliveryWorker.dispatchPendingDeliveries({ limit });
  }
  await recordIntegrationLog({
    provider: channel || 'notifications',
    action: 'integration.dispatch_queued',
    status: result.failed ? 'warning' : 'success',
    message: 'Dispatch queued notification deliveries',
    actorSnapshot: actorSnapshot(actor),
    requestMeta,
    metadata: { channel, result },
  });
  return result;
}

async function testEmail(payload = {}, actor = {}, requestMeta = {}) {
  const startedAt = Date.now();
  const health = {
    enabled: emailService.isEmailEnabled(),
    configured: Boolean(env.smtpHost && env.smtpFromEmail),
    config: emailConfig(),
  };
  let result = { dry_run: true, health };
  if (payload.send === true && payload.to) {
    result = {
      dry_run: false,
      health,
      provider_result: await emailService.sendMail({
        to: payload.to,
        subject: payload.subject || 'MedCare SMTP integration test',
        text: payload.text || 'SMTP integration test from Integration Hub.',
      }),
    };
  }
  await recordIntegrationLog({
    provider: 'email_smtp',
    action: 'integration.email_test',
    status: result.provider_result?.skipped ? 'skipped' : 'success',
    message: 'SMTP integration test completed.',
    actorSnapshot: actorSnapshot(actor),
    requestMeta,
    latencyMs: Date.now() - startedAt,
    metadata: result,
  });
  return maskPayload(result);
}

async function testPush(payload = {}, actor = {}, requestMeta = {}) {
  const startedAt = Date.now();
  const health = { enabled: pushProvider.isEnabled(), configured: Boolean(env.pushProviderUrl && env.pushProviderToken), config: pushConfig() };
  let result = { dry_run: true, health, payload_contract: pushConfig().payload_contract };
  if (payload.send === true) {
    const notification = {
      _id: payload.notification_id || 'integration-test',
      recipient_type: payload.recipient_type || 'staff',
      recipient_id: payload.recipient_id || 'integration-test',
      title: payload.title || 'MedCare push integration test',
      body: payload.body || 'HTTP push integration test from Integration Hub.',
      payload: { dry_run: Boolean(payload.dry_run ?? true), integration_test: true },
    };
    result = {
      dry_run: false,
      health,
      provider_result: await pushProvider.send(notification, { payload: payload.delivery_payload || {} }),
    };
  }
  await recordIntegrationLog({
    provider: 'push_http',
    action: 'integration.push_test',
    status: 'success',
    message: 'Push integration test completed.',
    actorSnapshot: actorSnapshot(actor),
    requestMeta,
    latencyMs: Date.now() - startedAt,
    metadata: result,
  });
  return maskPayload(result);
}

async function previewBankQr(payload = {}) {
  const amount = Number(payload.amount || 100000);
  const intent = {
    amount,
    payment_note: payload.payment_note || 'MEDCARE TEST',
    intent_code: payload.intent_code || 'MEDCARE-INV-TEST',
    provider_order_id: payload.provider_order_id || 'ORDER-MEDCARE-TEST',
  };
  const providerResult = await bankQrProvider.createPayment(intent, payload.provider_options || {});
  return maskPayload({
    provider: 'bank_qr',
    amount,
    qr: providerResult,
    config: bankQrConfig(),
    capabilities: providerCapabilities('bank_qr'),
  });
}

async function previewMomo(payload = {}) {
  const amount = Number(payload.amount || 100000);
  const intent = {
    amount,
    payment_note: payload.payment_note || `${env.momoPersonalNotePrefix || 'MEDCARE'} TEST`,
    intent_code: payload.intent_code || 'MEDCARE-MOMO-TEST',
    provider_order_id: payload.provider_order_id || 'ORDER-MOMO-TEST',
  };
  const providerResult = await momoPersonalQrProvider.createPayment(intent);
  return maskPayload({
    provider: 'momo_personal_qr',
    amount,
    qr: providerResult,
    config: momoConfig(),
    capabilities: providerCapabilities('momo_personal_qr'),
  });
}

async function listManualIntents(providerCode, query = {}) {
  const providers = MANUAL_PROVIDER_GROUPS[providerCode] || MANUAL_PROVIDER_GROUPS.bank_qr;
  const filter = { provider: { $in: providers } };
  if (query.status) filter.status = query.status;
  if (query.mismatch_type) filter.mismatch_type = query.mismatch_type;
  addDateRange(filter, 'created_at', query);
  const regex = keywordRegex(query);
  if (regex) {
    filter.$or = [
      { intent_code: regex },
      { payment_note: regex },
      { transaction_reference: regex },
      { provider_transaction_id: regex },
      { manual_review_reason: regex },
    ];
  }
  return listPaged(PaymentIntent, filter, query, { updated_at: -1, created_at: -1 }, [
    { path: 'invoice_id', select: 'invoice_no status total_amount balance_due paid_amount' },
    { path: 'patient_id', select: 'patient_code full_name phone email' },
    { path: 'payment_id', select: 'payment_no status amount transaction_ref paid_at' },
  ]);
}

async function providerWebhookFilter(query = {}) {
  const filter = {};
  if (query.provider) filter.provider = query.provider;
  if (query.status) filter.status = query.status;
  if (query.signature_valid !== undefined) filter.signature_valid = String(query.signature_valid) === 'true';
  addDateRange(filter, 'received_at', query);
  const regex = keywordRegex(query);
  if (regex) filter.$or = [{ event_id: regex }, { event_type: regex }, { transaction_ref: regex }, { error_message: regex }, { provider: regex }];
  return filter;
}

async function listProviderWebhookEvents(query = {}) {
  return listPaged(ProviderWebhookEvent, await providerWebhookFilter(query), query, { received_at: -1 }, [
    { path: 'payment_intent_id', select: 'intent_code status amount payment_note provider' },
    { path: 'payment_id', select: 'payment_no status amount transaction_ref' },
    { path: 'bank_transaction_id', select: 'transaction_id transaction_ref amount match_status' },
  ]);
}

async function getProviderWebhookEvent(eventId) {
  const event = await ProviderWebhookEvent.findById(eventId)
    .populate('payment_intent_id', 'intent_code status amount payment_note provider invoice_id patient_id')
    .populate('payment_id')
    .populate('bank_transaction_id')
    .lean();
  if (!event) throw createError('Không tìm thấy provider webhook event.', 404);
  return maskPayload(event);
}

async function reprocessWebhookEvent(eventId, payload = {}, actor = {}, requestMeta = {}) {
  const event = await ProviderWebhookEvent.findById(eventId);
  if (!event) throw createError('Không tìm thấy provider webhook event.', 404);
  event.status = payload.mark_received === false ? event.status : 'received';
  event.error_message = undefined;
  event.audit_logs = [
    ...(event.audit_logs || []),
    { action: 'integration.webhook_reprocess_requested', actor: actorSnapshot(actor), at: new Date(), reason: payload.reason },
  ];
  await event.save();
  await recordIntegrationLog({
    provider: event.provider,
    action: 'integration.webhook_reprocess_requested',
    status: 'pending',
    message: 'Webhook event queued for manual reprocess.',
    actorSnapshot: actorSnapshot(actor),
    targetType: 'provider_webhook_event',
    targetId: event._id,
    requestMeta,
    metadata: { event_id: event.event_id, reason: payload.reason, note: 'No automatic payment webhook processor is mounted for current manual providers.' },
  });
  return {
    event: maskPayload(event.toObject()),
    queued: true,
    processor_available: false,
    message: 'Event đã được mở lại để xử lý thủ công; provider manual hiện chưa có webhook processor tự động.',
  };
}

async function ignoreWebhookEvent(eventId, payload = {}, actor = {}, requestMeta = {}) {
  const event = await ProviderWebhookEvent.findById(eventId);
  if (!event) throw createError('Không tìm thấy provider webhook event.', 404);
  event.status = 'ignored';
  event.processed_at = new Date();
  event.error_message = normalizeString(payload.reason || payload.note) || event.error_message;
  event.audit_logs = [
    ...(event.audit_logs || []),
    { action: 'integration.webhook_ignored', actor: actorSnapshot(actor), at: new Date(), reason: payload.reason },
  ];
  await event.save();
  await recordIntegrationLog({
    provider: event.provider,
    action: 'integration.webhook_ignored',
    status: 'success',
    message: 'Webhook event ignored by admin.',
    actorSnapshot: actorSnapshot(actor),
    targetType: 'provider_webhook_event',
    targetId: event._id,
    requestMeta,
    metadata: { reason: payload.reason },
  });
  return maskPayload(event.toObject());
}

async function linkWebhookEvent(eventId, payload = {}, actor = {}, requestMeta = {}) {
  const event = await ProviderWebhookEvent.findById(eventId);
  if (!event) throw createError('Không tìm thấy provider webhook event.', 404);
  if (payload.payment_intent_id || payload.paymentIntentId) event.payment_intent_id = payload.payment_intent_id || payload.paymentIntentId;
  if (payload.payment_id || payload.paymentId) event.payment_id = payload.payment_id || payload.paymentId;
  if (payload.bank_transaction_id || payload.bankTransactionId) event.bank_transaction_id = payload.bank_transaction_id || payload.bankTransactionId;
  event.audit_logs = [
    ...(event.audit_logs || []),
    { action: 'integration.webhook_linked', actor: actorSnapshot(actor), at: new Date() },
  ];
  await event.save();
  await recordIntegrationLog({
    provider: event.provider,
    action: 'integration.webhook_linked',
    status: 'success',
    message: 'Webhook event linked to related object.',
    actorSnapshot: actorSnapshot(actor),
    targetType: 'provider_webhook_event',
    targetId: event._id,
    requestMeta,
    metadata: payload,
  });
  return maskPayload(event.toObject());
}

async function listBankTransactions(query = {}) {
  const filter = {};
  if (query.provider) filter.provider = query.provider;
  if (query.match_status || query.status) filter.match_status = query.match_status || query.status;
  if (query.direction) filter.direction = query.direction;
  addDateRange(filter, 'transaction_at', query);
  const regex = keywordRegex(query);
  if (regex) {
    filter.$or = [
      { transaction_id: regex },
      { transaction_ref: regex },
      { description: regex },
      { detected_intent_code: regex },
      { detected_invoice_no: regex },
      { detected_patient_code: regex },
      { counterparty_account_name: regex },
    ];
  }
  return listPaged(BankStatementTransaction, filter, query, { transaction_at: -1, created_at: -1 }, [
    { path: 'matched_payment_intent_id', select: 'intent_code status amount payment_note provider method' },
    { path: 'matched_payment_id', select: 'payment_no status amount transaction_ref' },
    { path: 'matched_invoice_id', select: 'invoice_no status total_amount balance_due' },
    { path: 'imported_batch_id', select: 'batch_no status provider account_no' },
  ]);
}

async function listBatches(query = {}) {
  const filter = {};
  if (query.provider) filter.provider = query.provider;
  if (query.status) filter.status = query.status;
  addDateRange(filter, 'created_at', query);
  const regex = keywordRegex(query);
  if (regex) filter.$or = [{ batch_no: regex }, { provider: regex }, { account_no: regex }, { notes: regex }];
  return listPaged(ReconciliationBatch, filter, query, { created_at: -1 });
}

async function getGoogleLoginEvents(query = {}) {
  const filter = { action: { $regex: /^auth\.google/ } };
  if (query.status) filter.status = query.status;
  addDateRange(filter, 'created_at', query);
  const regex = keywordRegex(query);
  if (regex) filter.$or = [{ message: regex }, { request_id: regex }, { 'metadata.email': regex }];
  return listPaged(AuditLog, filter, query, { created_at: -1 });
}

function validateGoogleOAuth() {
  const issues = [];
  if (env.googleAuthEnabled && !env.googleClientId) issues.push({ severity: 'critical', field: 'GOOGLE_CLIENT_ID', message: 'Google OAuth đang bật nhưng thiếu client ID.' });
  if (env.googleAuthEnabled && !env.googleClientSecret) issues.push({ severity: 'critical', field: 'GOOGLE_CLIENT_SECRET', message: 'Google OAuth đang bật nhưng thiếu client secret.' });
  if (env.googleAuthEnabled && !env.googleCallbackUrl) issues.push({ severity: 'critical', field: 'GOOGLE_CALLBACK_URL', message: 'Google OAuth đang bật nhưng thiếu callback URL.' });
  return {
    enabled: Boolean(env.googleAuthEnabled),
    configured: Boolean(env.googleClientId && env.googleClientSecret && env.googleCallbackUrl),
    callback_url: env.googleCallbackUrl,
    success_url: env.frontendAuthSuccessUrl,
    failure_url: env.frontendAuthFailureUrl,
    issues,
  };
}

async function listLogs(query = {}) {
  const filter = {};
  if (query.provider) filter.provider = query.provider;
  if (query.source) filter.source = query.source;
  if (query.status) filter.status = query.status;
  if (query.severity) filter.severity = query.severity;
  if (query.action) filter.action = query.action;
  addDateRange(filter, 'created_at', query);
  const regex = keywordRegex(query);
  if (regex) filter.$or = [{ provider: regex }, { source: regex }, { action: regex }, { message: regex }, { error_message: regex }, { request_id: regex }, { correlation_id: regex }];
  const { items, pagination } = await listPaged(IntegrationLog, filter, query, { created_at: -1 });
  if (items.length || query.integration_only === 'true') return { items, pagination };

  const auditFilter = {
    $or: [
      { action: { $regex: /payment|reconciliation|notification|auth\.google|webhook/i } },
      { module_key: { $in: ['billing', 'notifications', 'auth', 'integration'] } },
    ],
  };
  const audit = await listPaged(AuditLog, auditFilter, query, { created_at: -1 });
  return {
    items: audit.items.map((item) => ({
      id: toId(item._id),
      source: 'audit_log',
      provider: inferProviderFromAudit(item),
      action: item.action,
      status: item.status,
      severity: item.severity,
      message: item.message,
      request_id: item.request_id,
      actor_type: item.actor_type,
      actor_id: item.actor_id,
      target_type: item.target_type,
      target_id: item.target_id,
      created_at: item.created_at,
      raw: item,
    })),
    pagination: audit.pagination,
  };
}

function inferProviderFromAudit(item = {}) {
  const text = `${item.action || ''} ${item.target_type || ''} ${JSON.stringify(item.metadata || {})}`.toLowerCase();
  if (text.includes('google')) return 'google_oauth';
  if (text.includes('notification')) return 'notifications';
  if (text.includes('reconciliation')) return 'reconciliation';
  if (text.includes('payment')) return item.metadata?.provider || 'payment';
  return 'system';
}

async function exportLogs(query = {}, actor = {}, requestMeta = {}) {
  const logs = await listLogs({ ...query, limit: Math.min(Number(query.limit || 500), 1000) });
  await recordIntegrationLog({
    provider: 'integration_hub',
    action: 'integration.logs_exported',
    status: 'success',
    message: 'Integration logs exported.',
    actorSnapshot: actorSnapshot(actor),
    requestMeta,
    metadata: { count: logs.items.length, format: query.format || 'json' },
  });
  return { format: query.format || 'json', generated_at: new Date(), items: logs.items };
}

async function runDiagnostics(payload = {}, actor = {}, requestMeta = {}) {
  const runId = `INTEGRATION-DIAG-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const run = await IntegrationDiagnosticRun.create({
    run_id: runId,
    provider: payload.provider || 'all',
    check_name: payload.check_name || payload.checkName || 'full',
    status: 'running',
    actor: actorSnapshot(actor),
  });
  const started = Date.now();
  try {
    const health = await getHealth();
    const checks = payload.provider && payload.provider !== 'all'
      ? health.checks.filter((check) => check.provider === payload.provider)
      : health.checks;
    const findings = checks
      .filter((check) => ['critical', 'warning', 'disabled'].includes(check.status))
      .map((check) => ({
        severity: check.status === 'critical' ? 'critical' : 'warning',
        provider: check.provider,
        check: check.check_type,
        message: check.error_message || recommendationForProvider({ name: check.provider, health: check.status, configured: check.configured, enabled: check.enabled }),
        recommendation: check.recommendation,
        evidence: check.metadata,
      }));
    run.status = 'success';
    run.finished_at = new Date();
    run.duration_ms = Date.now() - started;
    run.findings_count = findings.length;
    run.critical_count = findings.filter((item) => item.severity === 'critical').length;
    run.warning_count = findings.filter((item) => item.severity === 'warning').length;
    run.result = { checks, findings };
    await run.save();
    await recordIntegrationLog({
      provider: 'integration_hub',
      action: 'integration.diagnostics_run',
      status: run.critical_count ? 'warning' : 'success',
      message: 'Integration diagnostics completed.',
      actorSnapshot: actorSnapshot(actor),
      requestMeta,
      latencyMs: run.duration_ms,
      metadata: { run_id: runId, findings_count: findings.length },
    });
    return maskPayload(run.toObject());
  } catch (error) {
    run.status = 'failed';
    run.finished_at = new Date();
    run.duration_ms = Date.now() - started;
    run.error = { message: error.message, code: error.code };
    await run.save();
    throw error;
  }
}

async function listDiagnosticRuns(query = {}) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.provider) filter.provider = query.provider;
  return listPaged(IntegrationDiagnosticRun, filter, query, { started_at: -1 });
}

async function getDiagnosticRun(runId) {
  const selectors = [{ run_id: runId }];
  if (Types.ObjectId.isValid(runId)) selectors.push({ _id: runId });
  const run = await IntegrationDiagnosticRun.findOne({ $or: selectors }).lean();
  if (!run) throw createError('Không tìm thấy diagnostics run.', 404);
  return maskPayload(run);
}

async function listPaymentProviders() {
  return {
    items: paymentProviderRegistry.listProviders({ includeDisabled: true, includePrivate: true }),
    registry: 'payment-provider.registry.js',
  };
}

async function getProviderEvents(providerCode, query = {}) {
  if (providerCode === 'email_smtp') return listDeliveries(NOTIFICATION_DELIVERY_CHANNEL.EMAIL, query);
  if (providerCode === 'push_http') return listDeliveries(NOTIFICATION_DELIVERY_CHANNEL.PUSH, query);
  if (providerCode === 'bank_qr') return listManualIntents('bank_qr', query);
  if (providerCode === 'momo_personal_qr') return listManualIntents('momo_personal_qr', query);
  if (providerCode === 'payment_webhook') return listProviderWebhookEvents(query);
  if (providerCode === 'reconciliation') return listBankTransactions(query);
  if (providerCode === 'google_oauth') return getGoogleLoginEvents(query);
  return { items: [], pagination: buildPagination(1, Number(query.limit || 20), 0) };
}

async function getProviderLogs(providerCode, query = {}) {
  return listLogs({ ...query, provider: providerCode });
}

module.exports = {
  dispatchQueued,
  exportLogs,
  getFailures,
  getHealth,
  getProvider,
  getProviderConfig,
  getProviderEvents,
  getProviderLogs,
  getProviderWebhookEvent,
  getSummary,
  getGoogleLoginEvents,
  linkWebhookEvent,
  listBankTransactions,
  listBatches,
  listDeliveries,
  listDiagnosticRuns,
  listLogs,
  listManualIntents,
  listPaymentProviders,
  listProviderWebhookEvents,
  previewBankQr,
  previewMomo,
  reprocessWebhookEvent,
  ignoreWebhookEvent,
  retryDelivery,
  runDiagnostics,
  testEmail,
  testPush,
  validateGoogleOAuth,
  getDiagnosticRun,
  reconciliation: reconciliationService,
  notification: notificationService,
};
