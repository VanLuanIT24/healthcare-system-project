const {
  Invoice,
  Payment,
  PaymentIntent,
} = require('../models');
const env = require('../config/env');
const { PERMISSION } = require('../constants/permissions');
const {
  INVOICE_STATUS,
  PAYMENT_INTENT_METHOD,
  PAYMENT_INTENT_METHODS,
  PAYMENT_INTENT_STATUS,
  PAYMENT_INTENT_STATUSES,
  PAYMENT_METHOD,
  PAYMENT_PROVIDER,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUS,
  REALTIME_EVENT_TYPE,
} = require('../constants/statuses');
const { buildPagination, createError, getPagination, recordAuditLog } = require('./core.service');
const actorContext = require('../common/actors');
const billingService = require('./billing.service');
const eventBus = require('../events/event-bus.service');
const { isValidObjectId, toObjectId } = require('../common/helpers/object-id.helper');
const paymentProviderRegistry = require('../payments/payment-provider.registry');
const { generateSequenceCode } = require('./code-generator.service');

const PAYABLE_INVOICE_STATUSES = [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID];
const ACTIVE_INTENT_STATUSES = [
  PAYMENT_INTENT_STATUS.CREATED,
  PAYMENT_INTENT_STATUS.PENDING,
  PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
  PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
  PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
  PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
];

const MANUAL_PAYMENT_PROVIDERS = [
  PAYMENT_PROVIDER.BANK_QR_MANUAL,
  PAYMENT_PROVIDER.MOMO_PERSONAL_QR,
  PAYMENT_PROVIDER.CASH_MANUAL,
  PAYMENT_PROVIDER.BANK_QR,
];

const RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const RECEIPT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.pdf']);

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizeEnum(value, allowed, fallback, label) {
  const normalized = normalizeString(value) || fallback;
  if (!allowed.includes(normalized)) throw createError(`${label} không hợp lệ.`, 422);
  return normalized;
}

function normalizeMoney(value, label = 'amount') {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount <= 0) throw createError(`${label} phải là integer minor units và > 0.`, 422);
  return amount;
}

function normalizeDate(value, label) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${label} không hợp lệ.`, 422);
  return date;
}

function patientIdFromActor(actor = {}) {
  return actorContext.getPatientId(actor);
}

function assertPatientOwnsInvoice(actor = {}, invoice = {}) {
  if (actorContext.getActorType(actor) !== 'patient') return;
  if (toId(patientIdFromActor(actor)) !== toId(invoice.patient_id)) {
    throw createError('Bạn chỉ được thanh toán invoice của chính mình.', 403);
  }
}

async function generateIntentCode() {
  return generateSequenceCode(PaymentIntent, 'intent_code', 'MEDCARE-INV', {
    separator: '-',
    sequenceWidth: 4,
  });
}

function defaultExpiresAt(payload = {}) {
  if (payload.expires_at || payload.expiresAt) {
    const date = new Date(payload.expires_at || payload.expiresAt);
    if (Number.isNaN(date.getTime())) throw createError('expires_at không hợp lệ.', 422);
    return date;
  }
  return new Date(Date.now() + env.bankQrIntentTtlMinutes * 60 * 1000);
}

function buildProviderOrderId(intentCode) {
  return `ORDER-${intentCode}`;
}

function isManualPaymentProvider(provider) {
  return MANUAL_PAYMENT_PROVIDERS.includes(provider);
}

function defaultProvider(payload = {}) {
  return normalizeString(payload.provider) || PAYMENT_PROVIDER.BANK_QR_MANUAL;
}

function defaultMethodForProvider(provider, payload = {}) {
  if (payload.method) return payload.method;
  if ([PAYMENT_PROVIDER.BANK_QR_MANUAL, PAYMENT_PROVIDER.BANK_QR, PAYMENT_PROVIDER.MOMO_PERSONAL_QR].includes(provider)) {
    return PAYMENT_INTENT_METHOD.QR_MANUAL;
  }
  if (provider === PAYMENT_PROVIDER.CASH_MANUAL) return PAYMENT_INTENT_METHOD.CASH;
  return PAYMENT_INTENT_METHOD.QR;
}

function buildPaymentNote(intentCode, provider = PAYMENT_PROVIDER.BANK_QR_MANUAL) {
  const prefix = provider === PAYMENT_PROVIDER.MOMO_PERSONAL_QR
    ? env.momoPersonalNotePrefix
    : 'MEDCARE';
  const normalizedPrefix = normalizeString(prefix) || 'MEDCARE';
  const suffix = String(intentCode || '').startsWith(`${normalizedPrefix}-`)
    ? String(intentCode).slice(normalizedPrefix.length + 1)
    : intentCode;
  return `${normalizedPrefix} ${suffix}`;
}

function appendAuditLog(doc, action, actor = {}, metadata = {}, reason = null) {
  doc.audit_logs = [
    ...(doc.audit_logs || []),
    {
      action,
      actor_type: actorContext.getActorType(actor) || actor.actorType || actor.actor_type || 'system',
      actor_id: actorContext.getActorId(actor) || actor.userId || actor.user_id || actor.patientAccountId || actor.patient_account_id,
      at: new Date(),
      reason,
      metadata,
    },
  ];
}

function serializePaymentIntent(intent = {}) {
  const plain = typeof intent.toObject === 'function' ? intent.toObject() : intent;
  return {
    ...plain,
    payment_intent_id: toId(plain._id || plain.id),
    provider: plain.provider,
    method: plain.method,
    amount: plain.amount,
    currency: plain.currency,
    payment_note: plain.payment_note,
    qr_image_url: plain.qr_image_url,
    receiver_name: plain.receiver_name || plain.receiver_account_name,
    receiver_phone: plain.receiver_phone,
    receiver_bank_bin: plain.receiver_bank_bin,
    receiver_account_no: plain.receiver_account_no,
    receiver_account_name: plain.receiver_account_name,
    status: plain.status,
  };
}

function receiptFileFromPayload(payload = {}) {
  const file = payload.receipt_file || payload.receiptFile || {};
  return {
    imageUrl: normalizeString(
      payload.receipt_image_url
      || payload.receiptImageUrl
      || payload.receipt_image_path
      || payload.receiptImagePath
      || file.url
      || file.file_url
      || file.storage_path,
    ),
    fileName: normalizeString(payload.receipt_file_name || payload.receiptFileName || file.file_name || file.original_name),
    mimeType: normalizeString(payload.receipt_mime_type || payload.receiptMimeType || file.mime_type),
    fileSize: payload.receipt_file_size ?? payload.receiptFileSize ?? file.file_size,
  };
}

function validateReceiptPayload(payload = {}) {
  const transactionReference = normalizeString(
    payload.transaction_reference
    || payload.transactionReference
    || payload.transaction_ref
    || payload.transactionRef,
  );
  const receipt = receiptFileFromPayload(payload);
  if (!transactionReference && !receipt.imageUrl) {
    throw createError('Cần upload biên lai hoặc nhập transaction_reference.', 400);
  }
  if (receipt.imageUrl && !env.paymentReceiptUploadEnabled) {
    throw createError('Receipt upload is disabled.', 503);
  }
  if (receipt.imageUrl) {
    const fileName = receipt.fileName || receipt.imageUrl.split('?')[0].split('/').pop();
    const extension = fileName && fileName.includes('.') ? `.${fileName.split('.').pop().toLowerCase()}` : '';
    if (receipt.mimeType && !RECEIPT_MIME_TYPES.has(receipt.mimeType.toLowerCase())) {
      throw createError('Định dạng biên lai không được hỗ trợ.', 400);
    }
    if (extension && !RECEIPT_EXTENSIONS.has(extension)) {
      throw createError('Định dạng biên lai không được hỗ trợ.', 400);
    }
    if (receipt.fileSize !== undefined && receipt.fileSize !== null && receipt.fileSize !== '') {
      const fileSize = Number(receipt.fileSize);
      if (!Number.isFinite(fileSize) || fileSize <= 0) throw createError('receipt_file_size không hợp lệ.', 400);
      if (fileSize > env.paymentReceiptMaxSizeBytes) throw createError('Biên lai vượt quá dung lượng cho phép.', 400);
      receipt.fileSize = fileSize;
    }
  }
  return { transactionReference, receipt };
}

function assertManualPaymentsEnabled() {
  if (!env.manualPaymentEnabled) throw createError('Manual payment is disabled.', 503);
}

function assertManualIntent(intent = {}) {
  if (!isManualPaymentProvider(intent.provider)) {
    throw createError('Payment intent không phải manual payment.', 409);
  }
}

function manualPaymentMethodForProvider(provider) {
  if (provider === PAYMENT_PROVIDER.CASH_MANUAL) return PAYMENT_METHOD.CASH;
  if (provider === PAYMENT_PROVIDER.MOMO_PERSONAL_QR) return PAYMENT_METHOD.E_WALLET;
  return PAYMENT_METHOD.BANK_TRANSFER;
}

function hasPermission(actor = {}, permission) {
  const permissions = new Set(actor.permissions || []);
  return permissions.has(permission) || permissions.has(PERMISSION.SYSTEM.FULL_ACCESS) || permissions.has('*');
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissions.some((permission) => hasPermission(actor, permission));
}

function assertStaffCanConfirmBankTransfer(actor = {}) {
  if (actorContext.isSystem(actor)) return true;
  if (actorContext.getActorType(actor) !== 'staff') {
    throw createError('Chỉ cashier/admin mới được xác nhận chuyển khoản.', 403);
  }
  if (!hasAnyPermission(actor, [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND, PERMISSION.PAYMENT_RECONCILIATION.READ])) {
    throw createError('Tài khoản hiện tại không có quyền xác nhận chuyển khoản.', 403);
  }
  return true;
}

function providerOptionsForCreate(payload = {}, actor = {}) {
  const providerOptions = payload.provider_options || payload.providerOptions || {};
  const bankOverrideKeys = ['bank_bin', 'bankBin', 'account_no', 'accountNo', 'account_name', 'accountName', 'template'];
  const hasBankOverride = bankOverrideKeys.some((key) => providerOptions[key] !== undefined && providerOptions[key] !== null && providerOptions[key] !== '');
  if (hasBankOverride && !(actorContext.isSystem(actor) && env.nodeEnv !== 'production')) {
    throw createError('Không được override tài khoản nhận tiền của bank QR.', 403);
  }
  return providerOptions;
}

async function createPaymentIntent(invoiceId, payload = {}, actor = {}, requestMeta = {}) {
  if (!isValidObjectId(invoiceId)) throw createError('invoiceId không hợp lệ.', 422);
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) throw createError('Không tìm thấy invoice.', 404);
  assertPatientOwnsInvoice(actor, invoice);
  if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) throw createError('Invoice không ở trạng thái thanh toán online.', 409);
  if (invoice.balance_due <= 0) throw createError('Invoice đã thanh toán đủ.', 409);

  const existingIntent = await PaymentIntent.findOne({
    invoice_id: invoice._id,
    status: { $in: ACTIVE_INTENT_STATUSES },
    $or: [{ expires_at: null }, { expires_at: { $exists: false } }, { expires_at: { $gt: new Date() } }],
  }).lean();
  if (existingIntent && !payload.force_new) {
    return serializePaymentIntent(existingIntent);
  }

  const amount = payload.amount === undefined || payload.amount === null
    ? invoice.balance_due
    : normalizeMoney(payload.amount);
  if (amount !== invoice.balance_due && !payload.allow_partial) {
    throw createError('amount phải khớp balance_due nếu không bật allow_partial.', 409);
  }
  if (amount > invoice.balance_due) throw createError('amount không được vượt balance_due.', 409);

  const provider = normalizeEnum(defaultProvider(payload), PAYMENT_PROVIDERS, PAYMENT_PROVIDER.BANK_QR_MANUAL, 'provider');
  if (isManualPaymentProvider(provider)) assertManualPaymentsEnabled();
  const method = normalizeEnum(defaultMethodForProvider(provider, payload), PAYMENT_INTENT_METHODS, PAYMENT_INTENT_METHOD.QR_MANUAL, 'method');
  const providerAdapter = paymentProviderRegistry.getProvider(provider);
  const providerOptions = providerOptionsForCreate(payload, actor);
  const intentCode = await generateIntentCode();
  const paymentNote = normalizeString(payload.payment_note || payload.paymentNote) || buildPaymentNote(intentCode, provider);
  const providerOrderId = normalizeString(payload.provider_order_id || payload.providerOrderId) || buildProviderOrderId(intentCode);
  const intent = await PaymentIntent.create({
    intent_code: intentCode,
    invoice_id: invoice._id,
    patient_id: invoice.patient_id,
    amount,
    currency: invoice.currency || 'VND',
    provider,
    method,
    status: isManualPaymentProvider(provider)
      ? PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION
      : PAYMENT_INTENT_STATUS.PENDING,
    payment_note: paymentNote,
    checkout_url: normalizeString(payload.checkout_url || payload.checkoutUrl),
    qr_image_url: normalizeString(payload.qr_image_url || payload.qrImageUrl),
    provider_order_id: providerOrderId,
    expires_at: defaultExpiresAt(payload),
    raw_provider_response: payload.raw_provider_response || payload.rawProviderResponse,
    metadata: payload.metadata,
    created_by: actor.userId,
    updated_by: actor.userId,
  });
  const providerPayment = await providerAdapter.createPayment(intent.toObject ? intent.toObject() : intent, providerOptions);
  intent.status = providerPayment.status || intent.status;
  intent.checkout_url = normalizeString(payload.checkout_url || payload.checkoutUrl)
    || normalizeString(providerPayment.checkout_url || providerPayment.checkoutUrl);
  intent.qr_payload = payload.qr_payload || payload.qrPayload || providerPayment.qr_payload || providerPayment.qrPayload;
  intent.qr_image_url = normalizeString(payload.qr_image_url || payload.qrImageUrl)
    || normalizeString(providerPayment.qr_image_url || providerPayment.qrImageUrl);
  intent.payment_note = normalizeString(providerPayment.payment_note || providerPayment.paymentNote) || intent.payment_note;
  intent.receiver_name = normalizeString(providerPayment.receiver_name || providerPayment.receiverName);
  intent.receiver_phone = normalizeString(providerPayment.receiver_phone || providerPayment.receiverPhone);
  intent.receiver_bank_bin = normalizeString(providerPayment.receiver_bank_bin || providerPayment.receiverBankBin);
  intent.receiver_account_no = normalizeString(providerPayment.receiver_account_no || providerPayment.receiverAccountNo);
  intent.receiver_account_name = normalizeString(providerPayment.receiver_account_name || providerPayment.receiverAccountName);
  intent.provider_order_id = providerPayment.provider_order_id || providerPayment.providerOrderId || intent.provider_order_id;
  intent.raw_provider_response = providerPayment.raw_provider_response || providerPayment.rawProviderResponse || intent.raw_provider_response;
  appendAuditLog(intent, 'payment_intent.created', actor, { provider, method, invoice_id: toId(invoice._id), amount });
  await intent.save();

  await recordAuditLog({
    actor,
    action: 'payment.intent_created',
    targetType: 'payment_intent',
    targetId: intent._id,
    status: 'success',
    message: 'Tạo payment intent.',
    requestMeta,
    metadata: { invoice_id: toId(invoice._id), amount, provider, method },
  });

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.PAYMENT_INTENT_CREATED,
    aggregateType: 'payment_intent',
    aggregateId: intent._id,
    recipientScope: {
      patient_id: invoice.patient_id,
      payment_intent_id: intent._id,
      invoice_id: invoice._id,
      recipients: [{ recipient_type: 'patient', recipient_id: invoice.patient_id, patient_id: invoice.patient_id }],
    },
    payload: {
      payment_intent_id: toId(intent._id),
      invoice_id: toId(invoice._id),
      amount,
      currency: intent.currency,
      provider,
      method,
      notification: {
        title: 'Đã tạo phiên thanh toán',
        body: `Phiên thanh toán ${intent.intent_code} đang chờ xử lý.`,
        priority: 'normal',
      },
    },
  });

  return serializePaymentIntent(intent);
}

async function getPaymentIntent(intentId, actor = {}) {
  const intent = await PaymentIntent.findById(intentId)
    .populate('invoice_id', 'invoice_no status total_amount balance_due paid_amount')
    .populate('payment_id')
    .lean();
  if (!intent) throw createError('Không tìm thấy payment intent.', 404);
  if (actorContext.getActorType(actor) === 'patient' && toId(intent.patient_id) !== toId(patientIdFromActor(actor))) {
    throw createError('Bạn chỉ được xem payment intent của chính mình.', 403);
  }
  return serializePaymentIntent(intent);
}

async function queryProviderStatus(intentId, actor = {}, requestMeta = {}) {
  const intent = await PaymentIntent.findById(intentId).lean();
  if (!intent) throw createError('Không tìm thấy payment intent.', 404);
  if (actorContext.getActorType(actor) === 'patient' && toId(intent.patient_id) !== toId(patientIdFromActor(actor))) {
    throw createError('Bạn chỉ được kiểm tra payment intent của chính mình.', 403);
  }
  if (isManualPaymentProvider(intent.provider)) {
    return {
      payment_intent_id: toId(intent._id),
      provider: intent.provider,
      provider_order_id: intent.provider_order_id,
      provider_transaction_id: intent.provider_transaction_id,
      provider_status: {
        status: intent.status,
        manual_confirmation: true,
      },
    };
  }
  const providerAdapter = paymentProviderRegistry.getProvider(intent.provider);
  const providerStatus = await providerAdapter.queryTransaction(intent);
  await recordAuditLog({
    actor,
    action: 'payment.intent_provider_query',
    targetType: 'payment_intent',
    targetId: intent._id,
    status: 'success',
    message: 'Truy vấn trạng thái payment intent từ provider.',
    requestMeta,
    metadata: { provider: intent.provider, payment_intent_id: toId(intent._id) },
  });
  return {
    payment_intent_id: toId(intent._id),
    provider: intent.provider,
    provider_order_id: intent.provider_order_id,
    provider_transaction_id: intent.provider_transaction_id,
    provider_status: providerStatus,
  };
}

async function listPaymentIntents(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (actorContext.getActorType(actor) === 'patient') filter.patient_id = patientIdFromActor(actor);
  for (const field of ['invoice_id', 'patient_id', 'provider', 'method', 'status']) {
    if (query[field] && (field !== 'patient_id' || actorContext.getActorType(actor) !== 'patient')) filter[field] = query[field];
  }
  const [items, total] = await Promise.all([
    PaymentIntent.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    PaymentIntent.countDocuments(filter),
  ]);
  return { items: items.map(serializePaymentIntent), pagination: buildPagination(page, limit, total) };
}

function bankTransferMetadata(payload = {}, extra = {}) {
  return {
    transaction_ref: normalizeString(payload.transaction_ref || payload.transactionRef),
    received_amount: payload.received_amount ?? payload.receivedAmount,
    received_at: payload.received_at || payload.receivedAt,
    note: normalizeString(payload.note),
    ...extra,
  };
}

function withMergedIntentMetadata(intent = {}, key, value) {
  return {
    ...(intent.metadata && typeof intent.metadata === 'object' ? intent.metadata : {}),
    [key]: value,
  };
}

async function publishBankTransferConfirmedEvents(intent, payment, actor = {}) {
  const paymentId = toId(payment._id || payment.id);
  const invoiceId = toId(intent.invoice_id?._id || intent.invoice_id);
  const patientId = toId(intent.patient_id?._id || intent.patient_id);

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.PAYMENT_INTENT_PAID,
    aggregateType: 'payment_intent',
    aggregateId: intent._id,
    actor,
    recipientScope: {
      patient_id: intent.patient_id,
      payment_intent_id: intent._id,
      invoice_id: intent.invoice_id,
      recipients: [{ recipient_type: 'patient', recipient_id: intent.patient_id, patient_id: intent.patient_id }],
    },
    payload: {
      payment_intent_id: toId(intent._id),
      invoice_id: invoiceId,
      payment_id: paymentId,
      amount: intent.amount,
      status: PAYMENT_INTENT_STATUS.CONFIRMED,
      notification: {
        title: 'Thanh toán đã được xác nhận',
        body: `Giao dịch ${intent.intent_code} đã được thu ngân xác nhận.`,
        priority: 'high',
      },
    },
  });

  const invoiceStatus = payment.invoice_id?.status;
  if (invoiceStatus === INVOICE_STATUS.PAID || invoiceStatus === INVOICE_STATUS.PARTIALLY_PAID) {
    await eventBus.publishDomainEvent({
      eventType: invoiceStatus === INVOICE_STATUS.PAID
        ? REALTIME_EVENT_TYPE.INVOICE_PAID
        : REALTIME_EVENT_TYPE.INVOICE_PARTIALLY_PAID,
      aggregateType: 'invoice',
      aggregateId: intent.invoice_id,
      actor,
      recipientScope: {
        patient_id: intent.patient_id,
        invoice_id: intent.invoice_id,
        recipients: [{ recipient_type: 'patient', recipient_id: intent.patient_id, patient_id: intent.patient_id }],
      },
      payload: {
        invoice_id: invoiceId,
        payment_intent_id: toId(intent._id),
        payment_id: paymentId,
        patient_id: patientId,
        amount: intent.amount,
        invoice_status: invoiceStatus,
      },
    });
  }
}

async function moveIntentToManualReview(intent, payload = {}, actor = {}, requestMeta = {}, reason) {
  intent.status = PAYMENT_INTENT_STATUS.MANUAL_REVIEW;
  intent.manual_review_reason = reason;
  intent.metadata = withMergedIntentMetadata(intent, 'bank_transfer_review', bankTransferMetadata(payload, {
    reason,
    reviewed_at: new Date(),
    reviewed_by: actor.userId || actor.user_id,
  }));
  intent.updated_by = actor.userId || actor.user_id;
  await intent.save();

  await recordAuditLog({
    actor,
    action: 'payment.intent_manual_review',
    targetType: 'payment_intent',
    targetId: intent._id,
    status: 'success',
    message: 'Payment intent chuyển sang manual review.',
    requestMeta,
    metadata: {
      payment_intent_id: toId(intent._id),
      invoice_id: toId(intent.invoice_id),
      reason,
    },
  });

  return { payment_intent: intent.toObject(), manual_review: true, reason };
}

async function confirmBankTransfer(intentId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffCanConfirmBankTransfer(actor);
  if (!isValidObjectId(intentId)) throw createError('intentId không hợp lệ.', 422);

  const transactionRef = normalizeString(payload.transaction_ref || payload.transactionRef);
  if (!transactionRef) throw createError('transaction_ref là bắt buộc.', 400);
  const receivedAmount = normalizeMoney(payload.received_amount ?? payload.receivedAmount, 'received_amount');
  const receivedAt = normalizeDate(payload.received_at || payload.receivedAt, 'received_at') || new Date();
  const actorUserId = actor.userId || actor.user_id;

  const intent = await PaymentIntent.findById(intentId);
  if (!intent) throw createError('Không tìm thấy payment intent.', 404);
  if (![PAYMENT_PROVIDER.BANK_QR, PAYMENT_PROVIDER.BANK_QR_MANUAL].includes(intent.provider)) {
    throw createError('Chỉ bank_qr intent được xác nhận bằng chuyển khoản thủ công.', 409);
  }
  if ([PAYMENT_INTENT_STATUS.CONFIRMED, PAYMENT_INTENT_STATUS.PAID].includes(intent.status)) {
    return { payment_intent: intent.toObject(), already_confirmed: true };
  }
  if (![PAYMENT_INTENT_STATUS.PENDING, PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION, PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT, PAYMENT_INTENT_STATUS.MANUAL_REVIEW].includes(intent.status)) {
    throw createError('Payment intent không ở trạng thái chờ xác nhận.', 409);
  }
  if (receivedAmount !== intent.amount) {
    const relation = receivedAmount < intent.amount ? 'thiếu' : 'dư';
    return moveIntentToManualReview(
      intent,
      payload,
      actor,
      requestMeta,
      `Số tiền nhận ${relation} so với payment intent.`,
    );
  }

  const payment = await billingService.createPayment(intent.invoice_id, {
    amount: receivedAmount,
    payment_method: PAYMENT_METHOD.BANK_TRANSFER,
    transaction_ref: transactionRef,
    payment_intent_id: intent._id,
    payment_provider: intent.provider,
    provider_transaction_id: transactionRef,
    idempotency_key: `manual_bank_transfer:${toId(intent._id)}:${transactionRef}`,
    paid_at: receivedAt,
    confirmed_by: actorUserId,
    confirmed_at: new Date(),
    note: normalizeString(payload.note) || `Manual bank transfer ${intent.intent_code}`,
  }, actor, requestMeta, { internal: actorContext.isSystem(actor) });

  intent.status = PAYMENT_INTENT_STATUS.CONFIRMED;
  intent.payment_id = payment._id || payment.id;
  intent.provider_transaction_id = transactionRef;
  intent.paid_at = receivedAt;
  intent.confirmed_by = actorUserId;
  intent.confirmed_at = new Date();
  intent.failure_reason = undefined;
  intent.manual_review_reason = undefined;
  intent.metadata = withMergedIntentMetadata(intent, 'bank_transfer_confirmation', bankTransferMetadata(payload, {
    confirmed_at: intent.confirmed_at,
    confirmed_by: actorUserId,
  }));
  intent.updated_by = actorUserId;
  await intent.save();

  await recordAuditLog({
    actor,
    action: 'payment.intent_confirm_bank_transfer',
    targetType: 'payment_intent',
    targetId: intent._id,
    status: 'success',
    message: 'Xác nhận chuyển khoản ngân hàng thủ công.',
    requestMeta,
    metadata: {
      payment_id: toId(payment._id || payment.id),
      invoice_id: toId(intent.invoice_id),
      amount: receivedAmount,
      transaction_ref: transactionRef,
    },
  });

  await publishBankTransferConfirmedEvents(intent, payment, actor);

  return {
    payment_intent: intent.toObject(),
    payment,
  };
}

async function rejectBankTransfer(intentId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffCanConfirmBankTransfer(actor);
  if (!isValidObjectId(intentId)) throw createError('intentId không hợp lệ.', 422);
  const reason = normalizeString(payload.reason || payload.note || payload.failure_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);

  const intent = await PaymentIntent.findById(intentId);
  if (!intent) throw createError('Không tìm thấy payment intent.', 404);
  if ([PAYMENT_INTENT_STATUS.CONFIRMED, PAYMENT_INTENT_STATUS.PAID].includes(intent.status)) {
    throw createError('Payment intent đã được xác nhận, không thể từ chối.', 409);
  }
  if ([PAYMENT_INTENT_STATUS.FAILED, PAYMENT_INTENT_STATUS.CANCELLED].includes(intent.status)) {
    return { payment_intent: intent.toObject(), already_rejected: true };
  }

  const nextStatus = payload.status === PAYMENT_INTENT_STATUS.CANCELLED
    ? PAYMENT_INTENT_STATUS.CANCELLED
    : PAYMENT_INTENT_STATUS.FAILED;
  intent.status = nextStatus;
  intent.failure_reason = reason;
  intent.cancelled_by = nextStatus === PAYMENT_INTENT_STATUS.CANCELLED ? actor.userId || actor.user_id : undefined;
  intent.cancelled_at = nextStatus === PAYMENT_INTENT_STATUS.CANCELLED ? new Date() : undefined;
  intent.metadata = withMergedIntentMetadata(intent, 'bank_transfer_rejection', bankTransferMetadata(payload, {
    reason,
    rejected_at: new Date(),
    rejected_by: actor.userId || actor.user_id,
  }));
  intent.updated_by = actor.userId || actor.user_id;
  await intent.save();

  await recordAuditLog({
    actor,
    action: 'payment.intent_reject_bank_transfer',
    targetType: 'payment_intent',
    targetId: intent._id,
    status: 'success',
    message: 'Từ chối xác nhận chuyển khoản ngân hàng.',
    requestMeta,
    metadata: {
      invoice_id: toId(intent.invoice_id),
      status: nextStatus,
      reason,
    },
  });

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.PAYMENT_INTENT_FAILED,
    aggregateType: 'payment_intent',
    aggregateId: intent._id,
    actor,
    recipientScope: {
      patient_id: intent.patient_id,
      payment_intent_id: intent._id,
      invoice_id: intent.invoice_id,
      recipients: [{ recipient_type: 'patient', recipient_id: intent.patient_id, patient_id: intent.patient_id }],
    },
    payload: {
      payment_intent_id: toId(intent._id),
      invoice_id: toId(intent.invoice_id),
      status: nextStatus,
      reason,
      notification: {
        title: 'Thanh toán cần xử lý lại',
        body: reason,
        priority: 'high',
      },
    },
  });

  return { payment_intent: intent.toObject() };
}

async function resolveManualIntent(paymentOrIntentId) {
  if (!isValidObjectId(paymentOrIntentId)) throw createError('payment id không hợp lệ.', 422);
  let intent = await PaymentIntent.findById(paymentOrIntentId);
  if (intent) return intent;

  const payment = await Payment.findById(paymentOrIntentId).lean();
  if (!payment?.payment_intent_id) throw createError('Không tìm thấy manual payment.', 404);
  intent = await PaymentIntent.findById(payment.payment_intent_id);
  if (!intent) throw createError('Không tìm thấy payment intent của payment.', 404);
  return intent;
}

function assertCanAccessManualIntent(intent, actor = {}) {
  if (actorContext.getActorType(actor) === 'patient' && toId(intent.patient_id) !== toId(patientIdFromActor(actor))) {
    throw createError('Bạn chỉ được thao tác payment của chính mình.', 403);
  }
  return true;
}

async function submitManualReceipt(paymentOrIntentId, payload = {}, actor = {}, requestMeta = {}) {
  assertManualPaymentsEnabled();
  const intent = await resolveManualIntent(paymentOrIntentId);
  assertManualIntent(intent);
  assertCanAccessManualIntent(intent, actor);
  if (![PAYMENT_INTENT_STATUS.PENDING, PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION, PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT, PAYMENT_INTENT_STATUS.MANUAL_REVIEW, PAYMENT_INTENT_STATUS.REJECTED].includes(intent.status)) {
    throw createError('Payment không ở trạng thái có thể nộp biên lai.', 409);
  }

  const { transactionReference, receipt } = validateReceiptPayload(payload);
  intent.status = PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT;
  intent.receipt_image_url = receipt.imageUrl || intent.receipt_image_url;
  intent.receipt_file_name = receipt.fileName || intent.receipt_file_name;
  intent.receipt_mime_type = receipt.mimeType || intent.receipt_mime_type;
  intent.receipt_file_size = receipt.fileSize ?? intent.receipt_file_size;
  intent.transaction_reference = transactionReference || intent.transaction_reference;
  intent.failure_reason = undefined;
  intent.manual_reject_reason = undefined;
  intent.updated_by = actor.userId || actor.user_id;
  appendAuditLog(intent, 'manual_payment.receipt_submitted', actor, {
    transaction_reference: intent.transaction_reference,
    has_receipt: Boolean(intent.receipt_image_url),
  });
  await intent.save();

  await Payment.updateOne(
    { payment_intent_id: intent._id },
    {
      $set: {
        status: PAYMENT_STATUS.SUBMITTED_RECEIPT,
        receipt_image_url: intent.receipt_image_url,
        receipt_file_name: intent.receipt_file_name,
        receipt_mime_type: intent.receipt_mime_type,
        receipt_file_size: intent.receipt_file_size,
        transaction_reference: intent.transaction_reference,
        transaction_ref: intent.transaction_reference,
      },
      $push: {
        audit_logs: {
          action: 'manual_payment.receipt_submitted',
          actor_type: actorContext.getActorType(actor) || actor.actorType,
          actor_id: actorContext.getActorId(actor),
          at: new Date(),
        },
      },
    },
  ).catch(() => {});

  await recordAuditLog({
    actor,
    action: 'manual_payment.receipt_submitted',
    targetType: 'payment_intent',
    targetId: intent._id,
    status: 'success',
    message: 'Patient submitted manual payment receipt.',
    requestMeta,
    metadata: { transaction_reference: intent.transaction_reference },
  });

  return { payment_intent: serializePaymentIntent(intent) };
}

async function listManualPayments(query = {}, actor = {}) {
  if (actorContext.getActorType(actor) !== 'staff') throw createError('Chỉ staff được xem danh sách payment manual.', 403);
  const { page, limit, skip } = getPagination(query);
  const statuses = query.status
    ? String(query.status).split(',').map((item) => item.trim()).filter(Boolean)
    : [
      PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
      PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
      PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
    ];
  const filter = {
    provider: { $in: MANUAL_PAYMENT_PROVIDERS },
    status: { $in: statuses },
  };
  if (query.provider) filter.provider = query.provider;
  if (query.invoice_id) filter.invoice_id = query.invoice_id;
  if (query.patient_id) filter.patient_id = query.patient_id;
  const [items, total] = await Promise.all([
    PaymentIntent.find(filter)
      .sort({ updated_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
      .populate('patient_id', 'patient_code full_name')
      .populate('payment_id')
      .lean(),
    PaymentIntent.countDocuments(filter),
  ]);
  return { items: items.map(serializePaymentIntent), pagination: buildPagination(page, limit, total) };
}

async function confirmManualPayment(paymentOrIntentId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffCanConfirmBankTransfer(actor);
  assertManualPaymentsEnabled();
  const intent = await resolveManualIntent(paymentOrIntentId);
  assertManualIntent(intent);

  if ([PAYMENT_INTENT_STATUS.CONFIRMED, PAYMENT_INTENT_STATUS.PAID].includes(intent.status)) {
    return { payment_intent: serializePaymentIntent(intent), already_confirmed: true };
  }
  if (![PAYMENT_INTENT_STATUS.PENDING, PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION, PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT, PAYMENT_INTENT_STATUS.MANUAL_REVIEW].includes(intent.status)) {
    throw createError('Payment không ở trạng thái chờ admin xác nhận.', 409);
  }

  const receivedAmount = payload.received_amount === undefined && payload.receivedAmount === undefined
    ? intent.amount
    : normalizeMoney(payload.received_amount ?? payload.receivedAmount, 'received_amount');
  if (receivedAmount !== intent.amount) throw createError('received_amount phải khớp payment amount.', 409);

  const actorUserId = actor.userId || actor.user_id;
  const paidAt = normalizeDate(payload.paid_at || payload.paidAt || payload.received_at || payload.receivedAt, 'paid_at') || new Date();
  const transactionRef = normalizeString(
    payload.transaction_reference
    || payload.transactionReference
    || payload.transaction_ref
    || payload.transactionRef
    || intent.transaction_reference,
  ) || `manual:${intent.intent_code}`;

  const payment = await billingService.createPayment(intent.invoice_id, {
    amount: receivedAmount,
    payment_method: manualPaymentMethodForProvider(intent.provider),
    transaction_ref: transactionRef,
    payment_intent_id: intent._id,
    payment_provider: intent.provider,
    provider_transaction_id: transactionRef,
    idempotency_key: `manual_payment:${toId(intent._id)}:confirmed`,
    paid_at: paidAt,
    confirmed_by: actorUserId,
    confirmed_at: new Date(),
    note: normalizeString(payload.note) || `Manual payment ${intent.intent_code}`,
  }, actor, requestMeta, { internal: actorContext.isSystem(actor) });

  const paymentId = payment._id || payment.id;
  intent.status = PAYMENT_INTENT_STATUS.CONFIRMED;
  intent.payment_id = paymentId;
  intent.provider_transaction_id = transactionRef;
  intent.transaction_reference = transactionRef;
  intent.paid_at = paidAt;
  intent.confirmed_by = actorUserId;
  intent.confirmed_at = new Date();
  intent.manual_confirmed_by = actorUserId;
  intent.manual_confirmed_at = intent.confirmed_at;
  intent.failure_reason = undefined;
  intent.manual_review_reason = undefined;
  intent.manual_reject_reason = undefined;
  intent.updated_by = actorUserId;
  appendAuditLog(intent, 'manual_payment.confirmed', actor, { payment_id: toId(paymentId), transaction_reference: transactionRef });
  await intent.save();

  await Payment.findByIdAndUpdate(paymentId, {
    $set: {
      provider: intent.provider,
      method: intent.method,
      intent_code: intent.intent_code,
      payment_note: intent.payment_note,
      qr_image_url: intent.qr_image_url,
      receipt_image_url: intent.receipt_image_url,
      receipt_file_name: intent.receipt_file_name,
      receipt_mime_type: intent.receipt_mime_type,
      receipt_file_size: intent.receipt_file_size,
      transaction_reference: transactionRef,
      manual_confirmed_by: actorUserId,
      manual_confirmed_at: intent.manual_confirmed_at,
    },
    $push: {
      audit_logs: {
        action: 'manual_payment.confirmed',
        actor_type: actorContext.getActorType(actor) || actor.actorType,
        actor_id: actorContext.getActorId(actor) || actorUserId,
        at: intent.manual_confirmed_at,
        metadata: { payment_intent_id: toId(intent._id) },
      },
    },
  });

  await recordAuditLog({
    actor,
    action: 'manual_payment.confirmed',
    targetType: 'payment_intent',
    targetId: intent._id,
    status: 'success',
    message: 'Manual payment confirmed by staff.',
    requestMeta,
    metadata: { payment_id: toId(paymentId), transaction_reference: transactionRef },
  });

  await publishBankTransferConfirmedEvents(intent, payment, actor);

  return {
    payment_intent: serializePaymentIntent(intent),
    payment,
  };
}

async function rejectManualPayment(paymentOrIntentId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffCanConfirmBankTransfer(actor);
  const reason = normalizeString(payload.reason || payload.note || payload.failure_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const intent = await resolveManualIntent(paymentOrIntentId);
  assertManualIntent(intent);
  if ([PAYMENT_INTENT_STATUS.CONFIRMED, PAYMENT_INTENT_STATUS.PAID].includes(intent.status)) {
    throw createError('Payment đã được xác nhận, không thể reject.', 409);
  }

  const actorUserId = actor.userId || actor.user_id;
  intent.status = PAYMENT_INTENT_STATUS.REJECTED;
  intent.failure_reason = reason;
  intent.manual_reject_reason = reason;
  intent.manual_rejected_by = actorUserId;
  intent.manual_rejected_at = new Date();
  intent.updated_by = actorUserId;
  appendAuditLog(intent, 'manual_payment.rejected', actor, {}, reason);
  await intent.save();

  await Payment.updateOne(
    { payment_intent_id: intent._id },
    {
      $set: {
        status: PAYMENT_STATUS.REJECTED,
        manual_rejected_by: actorUserId,
        manual_rejected_at: intent.manual_rejected_at,
        manual_reject_reason: reason,
      },
      $push: {
        audit_logs: {
          action: 'manual_payment.rejected',
          actor_type: actorContext.getActorType(actor) || actor.actorType,
          actor_id: actorContext.getActorId(actor) || actorUserId,
          at: intent.manual_rejected_at,
          reason,
        },
      },
    },
  ).catch(() => {});

  await recordAuditLog({
    actor,
    action: 'manual_payment.rejected',
    targetType: 'payment_intent',
    targetId: intent._id,
    status: 'success',
    message: 'Manual payment rejected by staff.',
    requestMeta,
    metadata: { reason },
  });

  return { payment_intent: serializePaymentIntent(intent) };
}

async function refundManualPayment(paymentOrIntentId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffCanConfirmBankTransfer(actor);
  const reason = normalizeString(payload.reason || payload.refund_reason || payload.note);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const intent = await resolveManualIntent(paymentOrIntentId);
  assertManualIntent(intent);
  const paymentId = intent.payment_id;
  if (!paymentId) throw createError('Manual payment chưa có payment đã xác nhận.', 409);

  let payment = await Payment.findById(paymentId);
  if (!payment) throw createError('Không tìm thấy payment đã xác nhận.', 404);
  if (![PAYMENT_STATUS.COMPLETED, PAYMENT_STATUS.CONFIRMED, PAYMENT_STATUS.REFUNDED].includes(payment.status)) {
    throw createError('Payment không ở trạng thái có thể ghi nhận hoàn tiền thủ công.', 409);
  }

  if (payment.status !== PAYMENT_STATUS.REFUNDED) {
    await billingService.refundPayment(payment._id, { reason }, actor, requestMeta);
    payment = await Payment.findById(payment._id);
  }

  const actorUserId = actor.userId || actor.user_id;
  payment.status = PAYMENT_STATUS.REFUNDED_MANUAL;
  payment.refund_status = 'processed';
  payment.refunded_by = actorUserId;
  payment.refunded_at = new Date();
  payment.refund_reason = reason;
  payment.audit_logs = [
    ...(payment.audit_logs || []),
    {
      action: 'manual_payment.refunded_manual',
      actor_type: actorContext.getActorType(actor) || actor.actorType,
      actor_id: actorContext.getActorId(actor) || actorUserId,
      at: payment.refunded_at,
      reason,
    },
  ];
  await payment.save();

  intent.status = PAYMENT_INTENT_STATUS.REFUNDED_MANUAL;
  intent.updated_by = actorUserId;
  appendAuditLog(intent, 'manual_payment.refunded_manual', actor, { payment_id: toId(payment._id) }, reason);
  await intent.save();

  await recordAuditLog({
    actor,
    action: 'manual_payment.refunded_manual',
    targetType: 'payment',
    targetId: payment._id,
    status: 'success',
    message: 'Manual refund recorded without external provider API.',
    requestMeta,
    metadata: { payment_intent_id: toId(intent._id), reason },
  });

  return {
    payment_intent: serializePaymentIntent(intent),
    payment: payment.toObject(),
  };
}

function listAvailableProviders() {
  return paymentProviderRegistry.listProviders();
}

async function getPaymentReceipt(paymentId, actor = {}, requestMeta = {}) {
  const payment = await Payment.findById(paymentId).populate('invoice_id').lean();
  if (!payment) throw createError('Không tìm thấy payment.', 404);
  if (actorContext.getActorType(actor) === 'patient' && toId(payment.patient_id) !== toId(patientIdFromActor(actor))) {
    throw createError('Bạn chỉ được xem receipt của chính mình.', 403);
  }
  await recordAuditLog({ actor, action: 'record.download', targetType: 'payment', targetId: payment._id, status: 'success', message: 'Xem receipt payment.', requestMeta });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.RECEIPT_GENERATED,
    aggregateType: 'payment',
    aggregateId: payment._id,
    recipientScope: {
      patient_id: payment.patient_id,
      recipients: [{ recipient_type: 'patient', recipient_id: payment.patient_id, patient_id: payment.patient_id }],
    },
    payload: {
      payment_id: toId(payment._id),
      invoice_id: toId(payment.invoice_id?._id || payment.invoice_id),
      notification: {
        title: 'Biên nhận đã sẵn sàng',
        body: `Biên nhận ${payment.payment_no} đã được tạo.`,
        priority: 'normal',
      },
    },
  });
  return {
    payment,
    receipt: {
      receipt_no: payment.payment_no,
      issued_at: new Date(),
      receipt_url: `/billing/me/payments/${toId(payment._id)}/receipt`,
    },
  };
}

async function requestRefund(paymentId, payload = {}, actor = {}, requestMeta = {}) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw createError('Không tìm thấy payment.', 404);
  if (actorContext.getActorType(actor) === 'patient' && toId(payment.patient_id) !== toId(patientIdFromActor(actor))) {
    throw createError('Bạn chỉ được yêu cầu refund payment của chính mình.', 403);
  }
  if (payment.status !== PAYMENT_STATUS.COMPLETED) throw createError('Chỉ payment completed mới được yêu cầu refund.', 409);
  const amount = payload.refund_amount || payload.amount || payment.amount;
  if (normalizeMoney(amount, 'refund_amount') > payment.amount) throw createError('refund_amount không được vượt payment amount.', 409);
  payment.refund_status = 'requested';
  payment.refund_amount = Number(amount);
  payment.refund_reason = normalizeString(payload.reason || payload.refund_reason);
  payment.refund_requested_by = {
    actor_type: actorContext.getActorType(actor),
    actor_id: actorContext.getActorId(actor),
  };
  payment.refund_requested_at = new Date();
  await payment.save();
  await recordAuditLog({ actor, action: 'payment.refund_requested', targetType: 'payment', targetId: payment._id, status: 'success', message: 'Yêu cầu refund payment.', requestMeta });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.PAYMENT_REFUNDED,
    aggregateType: 'payment',
    aggregateId: payment._id,
    recipientScope: {
      patient_id: payment.patient_id,
      recipients: [{ recipient_type: 'patient', recipient_id: payment.patient_id, patient_id: payment.patient_id }],
    },
    payload: {
      payment_id: toId(payment._id),
      refund_status: payment.refund_status,
      refund_amount: payment.refund_amount,
      notification: {
        title: 'Đã ghi nhận yêu cầu hoàn tiền',
        body: 'Yêu cầu hoàn tiền của bạn đã được gửi đến bộ phận thanh toán.',
        priority: 'normal',
      },
    },
  });
  return payment.toObject();
}

module.exports = {
  createPaymentIntent,
  getPaymentIntent,
  queryProviderStatus,
  listPaymentIntents,
  confirmBankTransfer,
  rejectBankTransfer,
  submitManualReceipt,
  listManualPayments,
  confirmManualPayment,
  rejectManualPayment,
  refundManualPayment,
  listAvailableProviders,
  getPaymentReceipt,
  requestRefund,
};
