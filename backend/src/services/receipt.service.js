const {
  AuditLog,
  Invoice,
  InvoiceItem,
  Patient,
  Payment,
  PaymentIntent,
  Receipt,
  ReceiptPrintLog,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  PAYMENT_STATUS,
  RECEIPT_STATUS,
  REALTIME_EVENT_TYPE,
} = require('../constants/statuses');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const { generateSequenceCode } = require('./code-generator.service');
const actorContext = require('../common/actors');
const eventBus = require('../events/event-bus.service');

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function actorId(actor = {}) {
  return actorContext.getActorId(actor) || actor.userId || actor.user_id || actor.patientAccountId || actor.patient_account_id || null;
}

function actorPermissions(actor = {}) {
  return new Set(actor.permissions || actor.permission_codes || []);
}

function hasPermission(actor = {}, permission) {
  const permissions = actorPermissions(actor);
  return permissions.has(permission) || permissions.has(PERMISSION.SYSTEM.FULL_ACCESS) || permissions.has('*');
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissions.some((permission) => hasPermission(actor, permission));
}

function assertStaffPermission(actor = {}, permissions = []) {
  if (actorContext.isSystem(actor)) return true;
  if (actorContext.getActorType(actor) !== 'staff') throw createError('Chỉ nhân sự được thao tác biên lai.', 403);
  if (!hasAnyPermission(actor, permissions)) throw createError('Tài khoản hiện tại không có quyền thao tác biên lai.', 403);
  return true;
}

function assertPatientPermission(actor = {}, permissions = []) {
  if (actorContext.getActorType(actor) !== 'patient') return false;
  if (!hasAnyPermission(actor, permissions)) throw createError('Tài khoản bệnh nhân không có quyền xem biên lai.', 403);
  return true;
}

function assertPatientOwns(patientId, actor = {}) {
  if (actorContext.getActorType(actor) !== 'patient') return true;
  if (toId(patientId) !== toId(actorContext.getPatientId(actor))) {
    throw createError('Bạn chỉ được xem biên lai của chính mình.', 403);
  }
  return true;
}

function canReadReceipt(actor = {}) {
  if (actorContext.getActorType(actor) === 'patient') {
    return assertPatientPermission(actor, [PERMISSION.RECEIPTS.SELF_READ, PERMISSION.PAYMENTS.SELF_READ]);
  }
  return assertStaffPermission(actor, [PERMISSION.RECEIPTS.READ, PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.PRINT_RECEIPT]);
}

function canGenerateReceipt(actor = {}) {
  return assertStaffPermission(actor, [PERMISSION.RECEIPTS.GENERATE, PERMISSION.PAYMENTS.PRINT_RECEIPT]);
}

function canPrintReceipt(actor = {}) {
  return assertStaffPermission(actor, [PERMISSION.RECEIPTS.PRINT, PERMISSION.PAYMENTS.PRINT_RECEIPT]);
}

function canReprintReceipt(actor = {}) {
  return assertStaffPermission(actor, [PERMISSION.RECEIPTS.REPRINT, PERMISSION.PAYMENTS.PRINT_RECEIPT]);
}

function canDownloadReceipt(actor = {}) {
  if (actorContext.getActorType(actor) === 'patient') {
    return assertPatientPermission(actor, [PERMISSION.RECEIPTS.SELF_DOWNLOAD, PERMISSION.RECEIPTS.SELF_READ, PERMISSION.PAYMENTS.SELF_READ]);
  }
  return assertStaffPermission(actor, [PERMISSION.RECEIPTS.DOWNLOAD, PERMISSION.PAYMENTS.PRINT_RECEIPT, PERMISSION.PAYMENTS.READ]);
}

function normalizeDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function normalizePositiveInteger(value, fieldName) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1) throw createError(`${fieldName} phải là số nguyên dương.`, 400);
  return numberValue;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function generateReceiptNumber(options = {}) {
  return generateSequenceCode(Receipt, 'receipt_no', 'RCT', {
    separator: '-',
    sequenceWidth: 5,
    ...options,
  });
}

function appendReceiptAudit(receipt, action, actor = {}, metadata = {}, reason = null) {
  receipt.audit_logs = [
    ...(receipt.audit_logs || []),
    {
      action,
      actor_type: actorContext.getActorType(actor) || actor.actorType || actor.actor_type || 'system',
      actor_id: actorId(actor),
      at: new Date(),
      reason,
      metadata,
    },
  ];
}

function buildReceiptHtml(payment = {}, receiptNo) {
  const invoice = payment.invoice_id && typeof payment.invoice_id === 'object' ? payment.invoice_id : {};
  const patient = payment.patient_id && typeof payment.patient_id === 'object' ? payment.patient_id : {};
  return [
    '<section class="receipt-snapshot">',
    '<header><strong>MEDCARE HEALTH SYSTEM</strong><span>BIEN LAI THU TIEN</span></header>',
    `<p><b>Receipt:</b> ${escapeHtml(receiptNo)}</p>`,
    `<p><b>Payment:</b> ${escapeHtml(payment.payment_no)}</p>`,
    `<p><b>Invoice:</b> ${escapeHtml(invoice.invoice_no || toId(payment.invoice_id))}</p>`,
    `<p><b>Patient:</b> ${escapeHtml(patient.full_name || toId(payment.patient_id))}</p>`,
    `<p><b>Amount:</b> ${escapeHtml(payment.amount)} ${escapeHtml(payment.currency || 'VND')}</p>`,
    `<p><b>Method:</b> ${escapeHtml(payment.payment_method)}</p>`,
    `<p><b>Transaction:</b> ${escapeHtml(payment.transaction_ref || payment.transaction_reference || '')}</p>`,
    '</section>',
  ].join('');
}

function receiptPayloadFromPayment(payment = {}, receiptNo, actor = {}, payload = {}) {
  return {
    receipt_no: receiptNo,
    payment_id: payment._id,
    invoice_id: payment.invoice_id?._id || payment.invoice_id,
    patient_id: payment.patient_id?._id || payment.patient_id,
    payment_intent_id: payment.payment_intent_id?._id || payment.payment_intent_id,
    receipt_type: payload.receipt_type || payload.receiptType || 'payment',
    status: RECEIPT_STATUS.GENERATED,
    amount: payment.amount,
    currency: payment.currency || 'VND',
    payment_method: payment.payment_method,
    payment_provider: payment.payment_provider || payment.provider,
    transaction_ref: payment.transaction_ref,
    transaction_reference: payment.transaction_reference,
    provider_transaction_id: payment.provider_transaction_id,
    intent_code: payment.intent_code,
    payment_note: payment.payment_note || payment.note,
    template_code: normalizeString(payload.template_code || payload.templateCode) || 'payment_receipt_a5',
    format: normalizeString(payload.format) || 'a5',
    pdf_url: normalizeString(payload.pdf_url || payload.pdfUrl),
    html_snapshot: normalizeString(payload.html_snapshot || payload.htmlSnapshot) || buildReceiptHtml(payment, receiptNo),
    original_receipt_image_url: payment.receipt_image_url,
    original_receipt_file_name: payment.receipt_file_name,
    original_receipt_mime_type: payment.receipt_mime_type,
    original_receipt_file_size: payment.receipt_file_size,
    issued_at: new Date(),
    issued_by: actor.userId || actor.user_id,
    metadata: {
      generated_from: 'payment',
      qr_image_url: payment.qr_image_url,
      payment_status: payment.status,
    },
    created_by: actor.userId || actor.user_id,
    updated_by: actor.userId || actor.user_id,
  };
}

function isReceiptEligiblePayment(payment = {}) {
  return [PAYMENT_STATUS.COMPLETED, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.REFUNDED_MANUAL, PAYMENT_STATUS.VOIDED].includes(payment.status);
}

async function getPaymentForReceipt(paymentId, actor = {}) {
  const payment = await Payment.findById(paymentId)
    .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
    .populate('patient_id', 'patient_code full_name phone date_of_birth')
    .populate('payment_intent_id', 'intent_code status provider method payment_note qr_image_url receipt_image_url receipt_file_name receipt_mime_type receipt_file_size transaction_reference receiver_bank_bin receiver_account_no receiver_account_name')
    .populate('received_by', 'full_name username employee_code')
    .populate('confirmed_by', 'full_name username employee_code')
    .lean();
  if (!payment) throw createError('Không tìm thấy payment.', 404);
  assertPatientOwns(payment.patient_id?._id || payment.patient_id, actor);
  return payment;
}

async function publishReceiptGenerated(receipt, payment, actor = {}) {
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.RECEIPT_GENERATED,
    aggregateType: 'receipt',
    aggregateId: receipt._id,
    actor,
    recipientScope: {
      patient_id: receipt.patient_id,
      recipients: [{ recipient_type: 'patient', recipient_id: receipt.patient_id, patient_id: receipt.patient_id }],
    },
    payload: {
      receipt_id: toId(receipt._id),
      receipt_no: receipt.receipt_no,
      payment_id: toId(payment._id || payment.id),
      invoice_id: toId(receipt.invoice_id),
      notification: {
        title: 'Biên lai đã sẵn sàng',
        body: `Biên lai ${receipt.receipt_no} đã được tạo.`,
        priority: 'normal',
      },
    },
  });
}

async function ensureReceiptForPayment(paymentId, actor = {}, requestMeta = {}, payload = {}) {
  const payment = await getPaymentForReceipt(paymentId, actor);
  if (!isReceiptEligiblePayment(payment)) {
    throw createError('Chỉ payment completed/refunded/voided mới có biên lai chính thức.', 409);
  }
  let receipt = await Receipt.findOne({ payment_id: payment._id });
  let generated = false;
  if (!receipt) {
    const receiptNo = payload.receipt_no || payload.receiptNo || await generateReceiptNumber();
    receipt = new Receipt(receiptPayloadFromPayment(payment, receiptNo, actor, payload));
    appendReceiptAudit(receipt, 'receipt.generated', actor, { payment_id: toId(payment._id), payment_no: payment.payment_no });
    await receipt.save();
    generated = true;
    await recordAuditLog({
      actor,
      action: 'receipt.generated',
      targetType: 'receipt',
      targetId: receipt._id,
      status: 'success',
      message: 'Tạo biên lai từ payment.',
      requestMeta,
      metadata: { payment_id: toId(payment._id), receipt_no: receipt.receipt_no },
    });
    await publishReceiptGenerated(receipt, payment, actor);
  }
  return {
    receipt: await getReceiptDetail(receipt._id, actor, { skipAudit: true }),
    payment,
    generated,
  };
}

async function generateReceiptFromPayment(paymentId, payload = {}, actor = {}, requestMeta = {}) {
  canGenerateReceipt(actor);
  return ensureReceiptForPayment(paymentId, actor, requestMeta, payload);
}

async function buildReceiptFilter(query = {}, actor = {}) {
  canReadReceipt(actor);
  const filter = {};
  if (actorContext.getActorType(actor) === 'patient') filter.patient_id = actorContext.getPatientId(actor);
  for (const field of ['payment_id', 'invoice_id', 'patient_id', 'status', 'payment_method', 'payment_provider']) {
    if (query[field] && (field !== 'patient_id' || actorContext.getActorType(actor) !== 'patient')) filter[field] = query[field];
  }
  if (query.receipt_no) filter.receipt_no = { $regex: escapeRegex(query.receipt_no), $options: 'i' };
  if (query.intent_code) filter.intent_code = { $regex: escapeRegex(query.intent_code), $options: 'i' };
  if (query.transaction_ref) filter.transaction_ref = { $regex: escapeRegex(query.transaction_ref), $options: 'i' };
  if (query.transaction_reference) filter.transaction_reference = { $regex: escapeRegex(query.transaction_reference), $options: 'i' };
  if (query.issued_from || query.issued_to) {
    filter.issued_at = {};
    const from = normalizeDate(query.issued_from, 'issued_from');
    const to = normalizeDate(query.issued_to, 'issued_to');
    if (from) filter.issued_at.$gte = from;
    if (to) filter.issued_at.$lte = to;
  }
  if (query.has_original_file === 'true') filter.original_receipt_image_url = { $exists: true, $ne: null };
  if (query.has_original_file === 'false') {
    filter.$or = [
      ...(filter.$or || []),
      { original_receipt_image_url: { $exists: false } },
      { original_receipt_image_url: null },
    ];
  }
  const keyword = normalizeString(query.keyword || query.q || query.search);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    const [payments, invoices, patients] = await Promise.all([
      Payment.find({
        $or: [
          { payment_no: { $regex: pattern, $options: 'i' } },
          { transaction_ref: { $regex: pattern, $options: 'i' } },
          { transaction_reference: { $regex: pattern, $options: 'i' } },
          { intent_code: { $regex: pattern, $options: 'i' } },
        ],
      }).select('_id').limit(500).lean(),
      Invoice.find({ invoice_no: { $regex: pattern, $options: 'i' } }).select('_id').limit(500).lean(),
      Patient.find({
        $or: [
          { patient_code: { $regex: pattern, $options: 'i' } },
          { full_name: { $regex: pattern, $options: 'i' } },
          { phone: { $regex: pattern, $options: 'i' } },
        ],
      }).select('_id').limit(500).lean(),
    ]);
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { receipt_no: { $regex: pattern, $options: 'i' } },
          { transaction_ref: { $regex: pattern, $options: 'i' } },
          { transaction_reference: { $regex: pattern, $options: 'i' } },
          { intent_code: { $regex: pattern, $options: 'i' } },
          ...(payments.length ? [{ payment_id: { $in: payments.map((payment) => payment._id) } }] : []),
          ...(invoices.length ? [{ invoice_id: { $in: invoices.map((invoice) => invoice._id) } }] : []),
          ...(patients.length ? [{ patient_id: { $in: patients.map((patient) => patient._id) } }] : []),
        ],
      },
    ];
  }
  return filter;
}

function populateReceiptQuery(query) {
  return query
    .populate('payment_id', 'payment_no status amount payment_method payment_provider transaction_ref transaction_reference provider_transaction_id intent_code paid_at confirmed_at refund_status void_reason refund_reason')
    .populate('invoice_id', 'invoice_no status total_amount balance_due')
    .populate('patient_id', 'patient_code full_name phone')
    .populate('issued_by', 'full_name username employee_code')
    .populate('last_printed_by', 'full_name username employee_code');
}

async function listReceipts(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildReceiptFilter(query, actor);
  const [items, total] = await Promise.all([
    populateReceiptQuery(Receipt.find(filter)).sort({ issued_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    Receipt.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getReceiptDetail(receiptId, actor = {}, options = {}) {
  canReadReceipt(actor);
  const receipt = await Receipt.findById(receiptId)
    .populate('payment_id', 'payment_no status amount currency payment_method payment_provider transaction_ref transaction_reference provider_transaction_id intent_code payment_note qr_image_url paid_at confirmed_at refund_status refund_amount refund_reason void_reason receipt_image_url receipt_file_name receipt_mime_type receipt_file_size')
    .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
    .populate('patient_id', 'patient_code full_name phone date_of_birth')
    .populate('payment_intent_id', 'intent_code status provider method payment_note qr_image_url receipt_image_url receipt_file_name receipt_mime_type receipt_file_size transaction_reference receiver_bank_bin receiver_account_no receiver_account_name')
    .populate('issued_by', 'full_name username employee_code')
    .populate('last_printed_by', 'full_name username employee_code')
    .lean();
  if (!receipt) throw createError('Không tìm thấy biên lai.', 404);
  assertPatientOwns(receipt.patient_id?._id || receipt.patient_id, actor);
  if (!options.skipAudit) {
    await recordAuditLog({
      actor,
      action: 'receipt.viewed',
      targetType: 'receipt',
      targetId: receipt._id,
      status: 'success',
      message: 'Xem chi tiết biên lai.',
      requestMeta: options.requestMeta,
    });
  }
  const invoiceId = receipt.invoice_id?._id || receipt.invoice_id;
  const invoiceItems = invoiceId
    ? await InvoiceItem.find({ invoice_id: invoiceId })
      .sort({ display_order: 1 })
      .populate('service_id', 'service_code service_name service_type')
      .populate({
        path: 'charge_id',
        select: 'charge_no source_module source_id medication_id dispense_id dispense_item_id status total_amount charged_at posted_at',
      })
      .lean()
    : [];
  return { ...receipt, invoice_items: invoiceItems };
}

async function getReceiptByPayment(paymentId, actor = {}, requestMeta = {}) {
  canReadReceipt(actor);
  const { receipt, generated } = await ensureReceiptForPayment(paymentId, actor, requestMeta);
  await recordAuditLog({
    actor,
    action: 'receipt.viewed',
    targetType: 'receipt',
    targetId: receipt._id,
    status: 'success',
    message: 'Xem biên lai payment.',
    requestMeta,
    metadata: { payment_id: toId(paymentId), generated },
  });
  return {
    payment: receipt.payment_id,
    receipt,
  };
}

async function createReceiptLog(receipt, payload = {}, actor = {}, requestMeta = {}, action = 'print') {
  const paymentId = receipt.payment_id?._id || receipt.payment_id;
  const previousCount = await ReceiptPrintLog.countDocuments({ receipt_id: receipt._id, action: { $in: ['print', 'reprint'] } });
  return ReceiptPrintLog.create({
    receipt_id: receipt._id,
    payment_id: paymentId,
    invoice_id: receipt.invoice_id?._id || receipt.invoice_id,
    patient_id: receipt.patient_id?._id || receipt.patient_id,
    receipt_no: receipt.receipt_no,
    action,
    copy_type: payload.copy_type || payload.copyType || (action === 'reprint' ? 'duplicate' : 'original'),
    printed_by: actor.userId || actor.user_id,
    printer_name: normalizeString(payload.printer_name || payload.printerName),
    counter_id: normalizeString(payload.counter_id || payload.counterId),
    counter_code: normalizeString(payload.counter_code || payload.counterCode),
    cashier_shift_id: payload.cashier_shift_id || payload.cashierShiftId,
    copy_no: previousCount + 1,
    reason: normalizeString(payload.reason),
    ip: requestMeta?.ipAddress,
    user_agent: requestMeta?.userAgent,
    metadata: payload.metadata,
  });
}

async function printReceipt(receiptId, payload = {}, actor = {}, requestMeta = {}) {
  canPrintReceipt(actor);
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) throw createError('Không tìm thấy biên lai.', 404);
  await createReceiptLog(receipt, payload, actor, requestMeta, 'print');
  receipt.status = RECEIPT_STATUS.PRINTED;
  receipt.print_count = Number(receipt.print_count || 0) + 1;
  receipt.last_printed_at = new Date();
  receipt.last_printed_by = actor.userId || actor.user_id;
  receipt.updated_by = actor.userId || actor.user_id;
  appendReceiptAudit(receipt, 'receipt.printed', actor, { printer_name: payload.printer_name || payload.printerName });
  await receipt.save();
  await recordAuditLog({ actor, action: 'receipt.printed', targetType: 'receipt', targetId: receipt._id, status: 'success', message: 'In biên lai.', requestMeta });
  return getReceiptDetail(receipt._id, actor, { skipAudit: true });
}

async function reprintReceipt(receiptId, payload = {}, actor = {}, requestMeta = {}) {
  canReprintReceipt(actor);
  const reason = normalizeString(payload.reason);
  if (!reason) throw createError('reason là bắt buộc khi in lại biên lai.', 400);
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) throw createError('Không tìm thấy biên lai.', 404);
  await createReceiptLog(receipt, { ...payload, reason, copy_type: payload.copy_type || payload.copyType || 'duplicate' }, actor, requestMeta, 'reprint');
  receipt.status = RECEIPT_STATUS.REISSUED;
  receipt.print_count = Number(receipt.print_count || 0) + 1;
  receipt.last_printed_at = new Date();
  receipt.last_printed_by = actor.userId || actor.user_id;
  receipt.updated_by = actor.userId || actor.user_id;
  appendReceiptAudit(receipt, 'receipt.reprinted', actor, { copy_type: payload.copy_type || payload.copyType || 'duplicate' }, reason);
  await receipt.save();
  await recordAuditLog({ actor, action: 'receipt.reprinted', targetType: 'receipt', targetId: receipt._id, status: 'success', message: 'In lại biên lai.', requestMeta, metadata: { reason } });
  return getReceiptDetail(receipt._id, actor, { skipAudit: true });
}

async function downloadReceipt(receiptId, actor = {}, requestMeta = {}) {
  canDownloadReceipt(actor);
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) throw createError('Không tìm thấy biên lai.', 404);
  assertPatientOwns(receipt.patient_id, actor);
  receipt.status = receipt.status === RECEIPT_STATUS.GENERATED ? RECEIPT_STATUS.DOWNLOADED : receipt.status;
  receipt.download_count = Number(receipt.download_count || 0) + 1;
  receipt.last_downloaded_at = new Date();
  receipt.last_downloaded_by = { actor_type: actorContext.getActorType(actor), actor_id: actorId(actor) };
  receipt.updated_by = actor.userId || actor.user_id;
  appendReceiptAudit(receipt, 'receipt.downloaded', actor, { pdf_url: receipt.pdf_url });
  await receipt.save();
  await createReceiptLog(receipt, { copy_type: 'duplicate' }, actor, requestMeta, 'download');
  await recordAuditLog({ actor, action: 'receipt.downloaded', targetType: 'receipt', targetId: receipt._id, status: 'success', message: 'Tải biên lai.', requestMeta });
  return {
    receipt: await getReceiptDetail(receipt._id, actor, { skipAudit: true }),
    download_url: receipt.pdf_url || `/api/billing/receipts/${toId(receipt._id)}`,
    content_type: receipt.pdf_url ? 'application/pdf' : 'application/json',
  };
}

async function sendReceipt(receiptId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.RECEIPTS.SEND]);
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) throw createError('Không tìm thấy biên lai.', 404);
  receipt.status = RECEIPT_STATUS.SENT;
  receipt.sent_count = Number(receipt.sent_count || 0) + 1;
  receipt.last_sent_at = new Date();
  receipt.last_sent_by = actor.userId || actor.user_id;
  receipt.updated_by = actor.userId || actor.user_id;
  appendReceiptAudit(receipt, 'receipt.sent', actor, { channel: payload.channel || 'patient_portal' });
  await receipt.save();
  await createReceiptLog(receipt, { ...payload, copy_type: 'duplicate' }, actor, requestMeta, 'send');
  await recordAuditLog({ actor, action: 'receipt.sent', targetType: 'receipt', targetId: receipt._id, status: 'success', message: 'Gửi biên lai.', requestMeta, metadata: { channel: payload.channel } });
  return getReceiptDetail(receipt._id, actor, { skipAudit: true });
}

async function listPrintLogs(receiptId, actor = {}) {
  canReadReceipt(actor);
  const receipt = await Receipt.findById(receiptId).select('patient_id').lean();
  if (!receipt) throw createError('Không tìm thấy biên lai.', 404);
  assertPatientOwns(receipt.patient_id, actor);
  const logs = await ReceiptPrintLog.find({ receipt_id: receiptId })
    .sort({ printed_at: -1, created_at: -1 })
    .populate('printed_by', 'full_name username employee_code')
    .lean();
  return { items: logs };
}

function normalizeEmbeddedAudit(items = [], source = {}) {
  return items.map((item) => ({
    action: item.action,
    at: item.at || item.created_at || item.printed_at,
    actor_type: item.actor_type,
    actor_id: item.actor_id || item.printed_by,
    source_type: source.type,
    source_id: source.id,
    reason: item.reason,
    metadata: item.metadata,
  }));
}

async function getReceiptHistory(receiptId, actor = {}) {
  canReadReceipt(actor);
  const receipt = await Receipt.findById(receiptId).lean();
  if (!receipt) throw createError('Không tìm thấy biên lai.', 404);
  assertPatientOwns(receipt.patient_id, actor);
  const [payment, intent, printLogs, auditLogs] = await Promise.all([
    Payment.findById(receipt.payment_id).lean(),
    receipt.payment_intent_id ? PaymentIntent.findById(receipt.payment_intent_id).lean() : null,
    ReceiptPrintLog.find({ receipt_id: receipt._id }).sort({ printed_at: -1 }).lean(),
    AuditLog.find({
      $or: [
        { target_type: 'receipt', target_id: receipt._id },
        { target_type: 'payment', target_id: receipt.payment_id },
        ...(receipt.payment_intent_id ? [{ target_type: 'payment_intent', target_id: receipt.payment_intent_id }] : []),
      ],
    }).sort({ created_at: -1 }).limit(200).lean(),
  ]);
  const timeline = [
    ...normalizeEmbeddedAudit(receipt.audit_logs, { type: 'receipt', id: toId(receipt._id) }),
    ...normalizeEmbeddedAudit(payment?.audit_logs || [], { type: 'payment', id: toId(payment?._id) }),
    ...normalizeEmbeddedAudit(intent?.audit_logs || [], { type: 'payment_intent', id: toId(intent?._id) }),
    ...printLogs.map((log) => ({
      action: `receipt.${log.action || 'print'}`,
      at: log.printed_at || log.created_at,
      actor_type: 'staff',
      actor_id: log.printed_by,
      source_type: 'receipt_print_log',
      source_id: toId(log._id),
      reason: log.reason,
      metadata: { copy_no: log.copy_no, copy_type: log.copy_type, printer_name: log.printer_name },
    })),
    ...auditLogs.map((log) => ({
      action: log.action,
      at: log.created_at,
      actor_type: log.actor_type,
      actor_id: log.actor_id,
      source_type: log.target_type,
      source_id: toId(log.target_id),
      reason: log.message,
      metadata: log.metadata,
    })),
  ].filter((item) => item.action && item.at)
    .sort((left, right) => new Date(right.at) - new Date(left.at));
  return { receipt, payment, payment_intent: intent, items: timeline };
}

async function getPaymentReceiptHistory(paymentId, actor = {}) {
  canReadReceipt(actor);
  const { receipt } = await ensureReceiptForPayment(paymentId, actor);
  return getReceiptHistory(receipt._id, actor);
}

async function listReceiptHistory(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.RECEIPTS.VIEW_AUDIT, PERMISSION.RECEIPTS.READ, PERMISSION.PAYMENTS.READ]);
  const { page, limit, skip } = getPagination(query);
  const filter = {
    action: query.action ? { $regex: escapeRegex(query.action), $options: 'i' } : { $regex: 'receipt|manual_payment|payment.intent|payments.', $options: 'i' },
  };
  if (query.date_from || query.date_to) {
    filter.created_at = {};
    const from = normalizeDate(query.date_from, 'date_from');
    const to = normalizeDate(query.date_to, 'date_to');
    if (from) filter.created_at.$gte = from;
    if (to) filter.created_at.$lte = to;
  }
  if (query.actor_type) filter.actor_type = query.actor_type;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function bulkPrintReceipts(payload = {}, actor = {}, requestMeta = {}) {
  canPrintReceipt(actor);
  const receiptIds = Array.isArray(payload.receipt_ids || payload.receiptIds) ? (payload.receipt_ids || payload.receiptIds) : [];
  if (!receiptIds.length) throw createError('receipt_ids là bắt buộc.', 400);
  const max = normalizePositiveInteger(payload.max || receiptIds.length, 'max');
  const selected = receiptIds.slice(0, max);
  const results = [];
  for (const receiptId of selected) {
    results.push(await printReceipt(receiptId, payload, actor, requestMeta));
  }
  return { items: results, count: results.length };
}

async function exportReceipts(query = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.RECEIPTS.EXPORT, PERMISSION.RECEIPTS.READ]);
  const result = await listReceipts({ ...query, limit: query.limit || 500 }, actor);
  await recordAuditLog({
    actor,
    action: 'receipt.export_requested',
    targetType: 'receipt',
    status: 'success',
    message: 'Export danh sách biên lai.',
    requestMeta,
    metadata: { count: result.items.length, filters: query },
  });
  return {
    status: 'completed_metadata',
    total_receipts: result.items.length,
    items: result.items,
  };
}

async function getMyReceipts(query = {}, actor = {}) {
  return listReceipts({ ...query, patient_id: actorContext.getPatientId(actor) }, actor);
}

async function getMyReceiptDetail(receiptId, actor = {}) {
  return getReceiptDetail(receiptId, actor);
}

async function downloadMyReceipt(receiptId, actor = {}, requestMeta = {}) {
  return downloadReceipt(receiptId, actor, requestMeta);
}

module.exports = {
  ensureReceiptForPayment,
  generateReceiptFromPayment,
  listReceipts,
  getReceiptDetail,
  getReceiptByPayment,
  printReceipt,
  reprintReceipt,
  downloadReceipt,
  sendReceipt,
  listPrintLogs,
  getReceiptHistory,
  getPaymentReceiptHistory,
  listReceiptHistory,
  bulkPrintReceipts,
  exportReceipts,
  getMyReceipts,
  getMyReceiptDetail,
  downloadMyReceipt,
};
