const { Types } = require('mongoose');
const {
  AuditLog,
  Charge,
  Encounter,
  EventOutbox,
  InsuranceClaim,
  Invoice,
  Payment,
  PaymentIntent,
  User,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  CHARGE_STATUS,
  INVOICE_STATUS,
  INSURANCE_CLAIM_STATUS,
  PAYMENT_STATUS,
  PAYMENT_INTENT_STATUS,
} = require('../constants/statuses');
const permissionService = require('./permission.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeString,
} = require('./core.service');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const PAYABLE_INVOICE_STATUSES = [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID];
const ACTIVE_INTENT_STATUSES = [
  PAYMENT_INTENT_STATUS.CREATED,
  PAYMENT_INTENT_STATUS.PENDING,
  PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
  PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
  PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
  PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
];
const CONFIRMATION_INTENT_STATUSES = [
  PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
  PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
  PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
];
const ERROR_INTENT_STATUSES = [
  PAYMENT_INTENT_STATUS.FAILED,
  PAYMENT_INTENT_STATUS.REJECTED,
  PAYMENT_INTENT_STATUS.EXPIRED,
  PAYMENT_INTENT_STATUS.CANCELLED,
];
const ERROR_PAYMENT_STATUSES = [
  PAYMENT_STATUS.FAILED,
  PAYMENT_STATUS.REJECTED,
  PAYMENT_STATUS.EXPIRED,
  PAYMENT_STATUS.CANCELLED,
];

function roundNumber(value) {
  return Number((Number(value || 0) + Number.EPSILON).toFixed(2));
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(value);
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function hasPermission(actor = {}, permission) {
  return permissionService.hasPermission(actor.permissions || [], permission);
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions);
}

function hasGlobalBillingScope(actor = {}) {
  return hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)
    || hasPermission(actor, PERMISSION.REPORTS.READ_ALL)
    || !actorDepartmentId(actor);
}

function assertBillingOverviewAccess(actor = {}) {
  if ((actor.actorType || actor.actor_type) !== 'staff') {
    throw createError('Chỉ tài khoản nhân sự được xem tổng quan viện phí.', 403);
  }
  if (!hasAnyPermission(actor, [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.BILLING_READ,
    PERMISSION.REPORTS.REVENUE_READ,
    PERMISSION.INVOICES.READ,
    PERMISSION.INVOICES.READ_UNPAID,
    PERMISSION.PAYMENTS.READ,
    PERMISSION.PAYMENT_INTENTS.READ,
    PERMISSION.PAYMENT_RECONCILIATION.READ,
  ])) {
    throw createError('Tài khoản hiện tại không có quyền xem tổng quan viện phí.', 403);
  }
}

function parseDate(value, fieldName) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function normalizeTimezone(value) {
  const timezone = normalizeString(value);
  if (!timezone || !/^[A-Za-z_/-]+$/.test(timezone)) return DEFAULT_TIMEZONE;
  return timezone;
}

function normalizeFilters(query = {}, { defaultToday = true } = {}) {
  const explicitDate = parseDate(query.date, 'date');
  const explicitFrom = parseDate(query.date_from || query.from, 'date_from');
  const explicitTo = parseDate(query.date_to || query.to, 'date_to');
  const now = new Date();
  const dateFrom = explicitDate
    ? getStartOfDay(explicitDate)
    : explicitFrom
      ? getStartOfDay(explicitFrom)
      : defaultToday
        ? getStartOfDay(now)
        : null;
  const dateTo = explicitDate
    ? getEndOfDay(explicitDate)
    : explicitTo
      ? getEndOfDay(explicitTo)
      : defaultToday
        ? getEndOfDay(now)
        : null;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw createError('date_from phải nhỏ hơn hoặc bằng date_to.', 400);
  }

  return {
    date_from: dateFrom,
    date_to: dateTo,
    timezone: normalizeTimezone(query.timezone),
    department_id: normalizeString(query.department_id),
    patient_id: normalizeString(query.patient_id),
    invoice_id: normalizeString(query.invoice_id),
    cashier_id: normalizeString(query.cashier_id || query.received_by),
    payment_method: normalizeString(query.payment_method || query.method),
    provider: normalizeString(query.provider),
    keyword: normalizeString(query.keyword || query.search || query.q),
  };
}

function applyDateRange(match, field, filters = {}) {
  if (!filters.date_from && !filters.date_to) return;
  match[field] = {};
  if (filters.date_from) match[field].$gte = filters.date_from;
  if (filters.date_to) match[field].$lte = filters.date_to;
}

function dateExpression(field, format, timezone) {
  return {
    $dateToString: {
      format,
      date: `$${field}`,
      timezone,
    },
  };
}

function serializeFilters(filters = {}) {
  return {
    ...filters,
    date_from: filters.date_from ? filters.date_from.toISOString() : null,
    date_to: filters.date_to ? filters.date_to.toISOString() : null,
  };
}

async function getScopedDepartmentId(filters = {}, actor = {}) {
  const requestedDepartmentId = filters.department_id;
  if (hasGlobalBillingScope(actor)) return requestedDepartmentId || null;
  const ownDepartmentId = actorDepartmentId(actor);
  if (!ownDepartmentId) throw createError('Không xác định được khoa của tài khoản hiện tại.', 403);
  if (requestedDepartmentId && String(requestedDepartmentId) !== String(ownDepartmentId)) {
    throw createError('Bạn không có quyền xem dữ liệu viện phí ngoài khoa.', 403);
  }
  return ownDepartmentId;
}

async function getEncounterIdsForDepartment(departmentId) {
  if (!departmentId) return null;
  return (await Encounter.find({ department_id: toObjectId(departmentId, 'department_id') }).select('_id').lean())
    .map((encounter) => encounter._id);
}

async function applyInvoiceScope(match = {}, filters = {}, actor = {}) {
  if (filters.patient_id) match.patient_id = toObjectId(filters.patient_id, 'patient_id');
  if (filters.invoice_id) match._id = toObjectId(filters.invoice_id, 'invoice_id');
  const departmentId = await getScopedDepartmentId(filters, actor);
  const encounterIds = await getEncounterIdsForDepartment(departmentId);
  if (encounterIds) match.encounter_id = { $in: encounterIds };
  return match;
}

async function invoiceIdsForScopedInvoices(filters = {}, actor = {}, extraMatch = {}) {
  const invoiceMatch = await applyInvoiceScope({ ...extraMatch }, filters, actor);
  const invoices = await Invoice.find(invoiceMatch).select('_id').lean();
  return invoices.map((invoice) => invoice._id);
}

async function applyPaymentScope(match = {}, filters = {}, actor = {}) {
  if (filters.patient_id) match.patient_id = toObjectId(filters.patient_id, 'patient_id');
  if (filters.invoice_id) match.invoice_id = toObjectId(filters.invoice_id, 'invoice_id');
  if (filters.payment_method) match.payment_method = filters.payment_method;
  if (filters.cashier_id) match.received_by = toObjectId(filters.cashier_id, 'cashier_id');

  const departmentId = await getScopedDepartmentId(filters, actor);
  if (departmentId) {
    const invoiceIds = await invoiceIdsForScopedInvoices({ ...filters, department_id: departmentId }, actor);
    if (match.invoice_id) {
      match.invoice_id = invoiceIds.some((id) => String(id) === String(match.invoice_id)) ? match.invoice_id : { $in: [] };
    } else {
      match.invoice_id = { $in: invoiceIds };
    }
  }
  return match;
}

async function applyPaymentIntentScope(match = {}, filters = {}, actor = {}) {
  if (filters.patient_id) match.patient_id = toObjectId(filters.patient_id, 'patient_id');
  if (filters.invoice_id) match.invoice_id = toObjectId(filters.invoice_id, 'invoice_id');
  if (filters.provider) match.provider = filters.provider;
  const departmentId = await getScopedDepartmentId(filters, actor);
  if (departmentId) {
    const invoiceIds = await invoiceIdsForScopedInvoices({ ...filters, department_id: departmentId }, actor);
    if (match.invoice_id) {
      match.invoice_id = invoiceIds.some((id) => String(id) === String(match.invoice_id)) ? match.invoice_id : { $in: [] };
    } else {
      match.invoice_id = { $in: invoiceIds };
    }
  }
  return match;
}

async function applyChargeScope(match = {}, filters = {}, actor = {}) {
  if (filters.patient_id) match.patient_id = toObjectId(filters.patient_id, 'patient_id');
  const departmentId = await getScopedDepartmentId(filters, actor);
  const encounterIds = await getEncounterIdsForDepartment(departmentId);
  if (encounterIds) match.encounter_id = { $in: encounterIds };
  return match;
}

async function patientIdsForKeyword(keyword) {
  if (!keyword) return null;
  const pattern = escapeRegex(keyword);
  return (await require('../models').Patient.find({
    $or: [
      { patient_code: { $regex: pattern, $options: 'i' } },
      { full_name: { $regex: pattern, $options: 'i' } },
      { phone: { $regex: pattern, $options: 'i' } },
    ],
  }).select('_id').limit(200).lean()).map((patient) => patient._id);
}

function moneySummary(rows = []) {
  return rows[0] || {};
}

function mapPatient(patient) {
  if (!patient) return null;
  if (typeof patient !== 'object') return { id: String(patient) };
  return {
    id: String(patient._id || patient.id),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    phone: patient.phone,
  };
}

function mapInvoice(invoice) {
  if (!invoice) return null;
  if (typeof invoice !== 'object') return { id: String(invoice) };
  return {
    id: String(invoice._id || invoice.id),
    invoice_no: invoice.invoice_no,
    status: invoice.status,
    total_amount: invoice.total_amount,
    paid_amount: invoice.paid_amount,
    balance_due: invoice.balance_due,
    due_at: invoice.due_at,
    issued_at: invoice.issued_at,
  };
}

function agingDays(invoice = {}, now = new Date()) {
  const anchor = invoice.due_at || invoice.issued_at || invoice.created_at;
  if (!anchor) return 0;
  const diff = now.getTime() - new Date(anchor).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function agingBucket(days) {
  if (days <= 7) return '0-7';
  if (days <= 30) return '8-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '>90';
}

function invoicePriority(invoice = {}, now = new Date()) {
  if (invoice.due_at && new Date(invoice.due_at) < now) return 'high';
  if (Number(invoice.balance_due || 0) >= 10000000) return 'high';
  if (invoice.status === INVOICE_STATUS.PARTIALLY_PAID) return 'normal';
  return 'normal';
}

function intentPriority(intent = {}) {
  if (intent.status === PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT) return 'high';
  if (intent.status === PAYMENT_INTENT_STATUS.MANUAL_REVIEW) return 'high';
  if (intent.expires_at && new Date(intent.expires_at).getTime() - Date.now() < 30 * 60 * 1000) return 'high';
  return 'normal';
}

function taskFromInvoice(invoice = {}, type = 'invoice_collect') {
  const now = new Date();
  return {
    id: `invoice:${invoice._id}`,
    type,
    source_type: 'invoice',
    source_id: String(invoice._id),
    priority: invoicePriority(invoice, now),
    status: invoice.status,
    patient: mapPatient(invoice.patient_id),
    invoice: mapInvoice(invoice),
    amount: invoice.balance_due,
    reason: invoice.due_at && new Date(invoice.due_at) < now ? 'Quá hạn thanh toán' : 'Invoice còn số dư phải thu',
    due_at: invoice.due_at,
    aging_days: agingDays(invoice, now),
    last_activity_at: invoice.updated_at || invoice.issued_at || invoice.created_at,
    actions: ['collect_payment', 'create_qr', 'view_invoice', 'print_invoice'],
  };
}

function taskFromIntent(intent = {}, type = 'payment_confirmation') {
  return {
    id: `intent:${intent._id}`,
    type,
    source_type: 'payment_intent',
    source_id: String(intent._id),
    priority: intentPriority(intent),
    status: intent.status,
    patient: mapPatient(intent.patient_id),
    invoice: mapInvoice(intent.invoice_id),
    intent: {
      id: String(intent._id),
      intent_code: intent.intent_code,
      provider: intent.provider,
      method: intent.method,
      amount: intent.amount,
      status: intent.status,
      receipt_image_url: intent.receipt_image_url,
      transaction_reference: intent.transaction_reference,
      expires_at: intent.expires_at,
      failure_reason: intent.failure_reason,
      manual_review_reason: intent.manual_review_reason,
      manual_reject_reason: intent.manual_reject_reason,
    },
    amount: intent.amount,
    reason: intent.manual_review_reason || intent.manual_reject_reason || intent.failure_reason || 'Payment cần thu ngân xử lý',
    due_at: intent.expires_at,
    last_activity_at: intent.updated_at || intent.created_at,
    actions: intent.status === PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT
      ? ['view_receipt', 'confirm_transfer', 'reject_transfer', 'manual_review']
      : ['confirm_transfer', 'reject_transfer', 'view_invoice'],
  };
}

function taskFromPayment(payment = {}, type = 'payment_error') {
  return {
    id: `payment:${payment._id}`,
    type,
    source_type: 'payment',
    source_id: String(payment._id),
    priority: payment.refund_status === 'requested' ? 'high' : 'normal',
    status: payment.status,
    patient: mapPatient(payment.patient_id),
    invoice: mapInvoice(payment.invoice_id),
    payment: {
      id: String(payment._id),
      payment_no: payment.payment_no,
      payment_method: payment.payment_method,
      transaction_ref: payment.transaction_ref || payment.transaction_reference,
      amount: payment.amount,
      status: payment.status,
      refund_status: payment.refund_status,
      refund_reason: payment.refund_reason,
    },
    amount: payment.refund_amount || payment.amount,
    reason: payment.manual_reject_reason || payment.refund_reason || payment.void_reason || 'Payment cần xử lý',
    last_activity_at: payment.updated_at || payment.paid_at || payment.created_at,
    actions: payment.refund_status === 'requested'
      ? ['view_payment', 'refund_payment', 'view_invoice']
      : ['view_payment', 'view_invoice', 'copy_transaction_ref'],
  };
}

function taskFromCharge(charge = {}) {
  return {
    id: `charge:${charge._id}`,
    type: 'charge_waiting_invoice',
    source_type: 'charge',
    source_id: String(charge._id),
    priority: 'normal',
    status: charge.status,
    patient: mapPatient(charge.patient_id),
    amount: charge.total_amount,
    reason: 'Charge đã post nhưng chưa lên hóa đơn',
    last_activity_at: charge.posted_at || charge.updated_at || charge.created_at,
    actions: ['create_invoice', 'view_charge'],
  };
}

function taskFromClaim(claim = {}) {
  return {
    id: `claim:${claim._id}`,
    type: 'insurance_claim',
    source_type: 'insurance_claim',
    source_id: String(claim._id),
    priority: claim.status === INSURANCE_CLAIM_STATUS.SUBMITTED ? 'normal' : 'low',
    status: claim.status,
    patient: mapPatient(claim.patient_id),
    invoice: mapInvoice(claim.invoice_id),
    amount: claim.submitted_amount,
    reason: 'Claim bảo hiểm chờ xử lý',
    last_activity_at: claim.submitted_at || claim.updated_at || claim.created_at,
    actions: ['view_claim', 'review_claim', 'view_invoice'],
  };
}

async function getUnpaidInvoiceQueue(query = {}, actor = {}) {
  assertBillingOverviewAccess(actor);
  const filters = normalizeFilters(query, { defaultToday: false });
  const { page, limit, skip } = getPagination(query, 20, 100);
  const match = await applyInvoiceScope({
    status: { $in: query.status ? String(query.status).split(',').map((item) => item.trim()).filter(Boolean) : PAYABLE_INVOICE_STATUSES },
    balance_due: { $gt: Number(query.balance_due_gt || -1) },
  }, filters, actor);

  if (query.overdue === 'true' || query.overdue === true) {
    match.due_at = { $lt: new Date() };
  }
  if (query.due_before) {
    match.due_at = { ...(match.due_at || {}), $lte: parseDate(query.due_before, 'due_before') };
  }
  if (query.date_from || query.date_to || query.date) applyDateRange(match, 'issued_at', filters);
  if (filters.keyword) {
    const patientIds = await patientIdsForKeyword(filters.keyword);
    const pattern = escapeRegex(filters.keyword);
    match.$or = [
      { invoice_no: { $regex: pattern, $options: 'i' } },
      ...(patientIds?.length ? [{ patient_id: { $in: patientIds } }] : []),
    ];
  }

  const [items, total] = await Promise.all([
    Invoice.find(match)
      .sort({ due_at: 1, balance_due: -1, issued_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .lean(),
    Invoice.countDocuments(match),
  ]);
  const invoiceIds = items.map((invoice) => invoice._id);
  const [latestPayments, activeIntents, claims] = await Promise.all([
    Payment.find({ invoice_id: { $in: invoiceIds } })
      .sort({ paid_at: -1, created_at: -1 })
      .select('invoice_id payment_no amount payment_method paid_at status')
      .lean(),
    PaymentIntent.find({ invoice_id: { $in: invoiceIds }, status: { $in: ACTIVE_INTENT_STATUSES } })
      .sort({ updated_at: -1, created_at: -1 })
      .select('invoice_id intent_code provider method amount status expires_at')
      .lean(),
    InsuranceClaim.find({ invoice_id: { $in: invoiceIds } })
      .sort({ updated_at: -1, created_at: -1 })
      .select('invoice_id claim_no status submitted_amount approved_amount paid_amount')
      .lean(),
  ]);
  const paymentByInvoice = new Map();
  latestPayments.forEach((payment) => {
    const key = String(payment.invoice_id);
    if (!paymentByInvoice.has(key)) paymentByInvoice.set(key, payment);
  });
  const intentByInvoice = new Map();
  activeIntents.forEach((intent) => {
    const key = String(intent.invoice_id);
    if (!intentByInvoice.has(key)) intentByInvoice.set(key, intent);
  });
  const claimsByInvoice = new Map();
  claims.forEach((claim) => {
    const key = String(claim.invoice_id);
    claimsByInvoice.set(key, [...(claimsByInvoice.get(key) || []), claim]);
  });

  return {
    items: items.map((invoice) => ({
      ...taskFromInvoice(invoice),
      last_payment: paymentByInvoice.get(String(invoice._id)) || null,
      active_payment_intent: intentByInvoice.get(String(invoice._id)) || null,
      insurance_claims: claimsByInvoice.get(String(invoice._id)) || [],
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getPaymentConfirmationQueue(query = {}, actor = {}) {
  assertBillingOverviewAccess(actor);
  const filters = normalizeFilters(query, { defaultToday: false });
  const { page, limit, skip } = getPagination(query, 20, 100);
  const statuses = query.status
    ? String(query.status).split(',').map((item) => item.trim()).filter(Boolean)
    : CONFIRMATION_INTENT_STATUSES;
  const match = await applyPaymentIntentScope({ status: { $in: statuses } }, filters, actor);
  if (query.date_from || query.date_to || query.date) applyDateRange(match, 'created_at', filters);
  if (filters.keyword) {
    const patientIds = await patientIdsForKeyword(filters.keyword);
    const pattern = escapeRegex(filters.keyword);
    match.$or = [
      { intent_code: { $regex: pattern, $options: 'i' } },
      { transaction_reference: { $regex: pattern, $options: 'i' } },
      ...(patientIds?.length ? [{ patient_id: { $in: patientIds } }] : []),
    ];
  }
  const [items, total] = await Promise.all([
    PaymentIntent.find(match)
      .sort({ status: -1, updated_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
      .populate('payment_id', 'payment_no status amount payment_method transaction_ref paid_at')
      .lean(),
    PaymentIntent.countDocuments(match),
  ]);
  return {
    items: items.map((intent) => taskFromIntent(intent)),
    pagination: buildPagination(page, limit, total),
  };
}

async function getPaymentErrorQueue(query = {}, actor = {}) {
  assertBillingOverviewAccess(actor);
  const filters = normalizeFilters(query, { defaultToday: false });
  const { page, limit } = getPagination(query, 20, 100);
  const intentMatch = await applyPaymentIntentScope({
    status: { $in: query.status ? String(query.status).split(',').map((item) => item.trim()).filter(Boolean) : ERROR_INTENT_STATUSES },
  }, filters, actor);
  const paymentMatch = await applyPaymentScope({
    status: { $in: ERROR_PAYMENT_STATUSES },
  }, filters, actor);
  if (query.date_from || query.date_to || query.date) {
    applyDateRange(intentMatch, 'updated_at', filters);
    applyDateRange(paymentMatch, 'updated_at', filters);
  }
  const [intents, intentTotal, payments, paymentTotal] = await Promise.all([
    PaymentIntent.find(intentMatch)
      .sort({ updated_at: -1, created_at: -1 })
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
      .lean(),
    PaymentIntent.countDocuments(intentMatch),
    Payment.find(paymentMatch)
      .sort({ updated_at: -1, paid_at: -1, created_at: -1 })
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
      .lean(),
    Payment.countDocuments(paymentMatch),
  ]);
  const items = [
    ...intents.map((intent) => taskFromIntent(intent, 'payment_intent_error')),
    ...payments.map((payment) => taskFromPayment(payment, 'payment_error')),
  ].sort((a, b) => new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0)).slice(0, limit);
  return {
    items,
    pagination: buildPagination(page, limit, intentTotal + paymentTotal),
  };
}

async function getRefundRequestQueue(query = {}, actor = {}) {
  assertBillingOverviewAccess(actor);
  const filters = normalizeFilters(query, { defaultToday: false });
  const { page, limit, skip } = getPagination(query, 20, 100);
  const match = await applyPaymentScope({ refund_status: 'requested' }, filters, actor);
  const [items, total] = await Promise.all([
    Payment.find(match)
      .sort({ refund_requested_at: -1, updated_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
      .lean(),
    Payment.countDocuments(match),
  ]);
  return { items: items.map((payment) => taskFromPayment(payment, 'refund_request')), pagination: buildPagination(page, limit, total) };
}

async function getDebtAgingOverview(query = {}, actor = {}) {
  assertBillingOverviewAccess(actor);
  const filters = normalizeFilters(query, { defaultToday: false });
  const { page, limit, skip } = getPagination(query, 20, 100);
  const match = await applyInvoiceScope({
    status: { $in: PAYABLE_INVOICE_STATUSES },
    balance_due: { $gt: 0 },
  }, filters, actor);
  if (query.overdue === 'true' || query.overdue === true) match.due_at = { $lt: new Date() };
  if (filters.keyword) {
    const patientIds = await patientIdsForKeyword(filters.keyword);
    const pattern = escapeRegex(filters.keyword);
    match.$or = [
      { invoice_no: { $regex: pattern, $options: 'i' } },
      ...(patientIds?.length ? [{ patient_id: { $in: patientIds } }] : []),
    ];
  }

  const [allDebts, pageItems] = await Promise.all([
    Invoice.find(match).select('patient_id total_amount paid_amount balance_due due_at issued_at created_at status').lean(),
    Invoice.find(match)
      .sort({ due_at: 1, balance_due: -1, issued_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .lean(),
  ]);
  const now = new Date();
  const bucketMap = new Map(['0-7', '8-30', '31-60', '61-90', '>90'].map((bucket) => [bucket, { bucket, count: 0, amount: 0 }]));
  allDebts.forEach((invoice) => {
    const bucket = agingBucket(agingDays(invoice, now));
    const row = bucketMap.get(bucket);
    row.count += 1;
    row.amount += Number(invoice.balance_due || 0);
  });
  const overdueDebts = allDebts.filter((invoice) => invoice.due_at && new Date(invoice.due_at) < now);
  const patientCount = new Set(allDebts.map((invoice) => String(invoice.patient_id))).size;

  return {
    summary: {
      total_outstanding: roundNumber(allDebts.reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0)),
      invoice_count: allDebts.length,
      patient_count: patientCount,
      overdue_amount: roundNumber(overdueDebts.reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0)),
      overdue_count: overdueDebts.length,
      partial_paid_amount: roundNumber(allDebts.filter((invoice) => invoice.status === INVOICE_STATUS.PARTIALLY_PAID).reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0)),
      partial_paid_count: allDebts.filter((invoice) => invoice.status === INVOICE_STATUS.PARTIALLY_PAID).length,
    },
    aging_buckets: Array.from(bucketMap.values()).map((row) => ({ ...row, amount: roundNumber(row.amount) })),
    items: pageItems.map((invoice) => taskFromInvoice(invoice, 'debt')),
    pagination: buildPagination(page, limit, allDebts.length),
  };
}

async function getTodayRevenueOverview(query = {}, actor = {}) {
  assertBillingOverviewAccess(actor);
  const filters = normalizeFilters(query, { defaultToday: true });
  const paymentMatch = await applyPaymentScope({ status: PAYMENT_STATUS.COMPLETED }, filters, actor);
  const invoiceMatch = await applyInvoiceScope({ status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID, INVOICE_STATUS.PAID] } }, filters, actor);
  const chargeMatch = await applyChargeScope({ status: { $in: [CHARGE_STATUS.POSTED, CHARGE_STATUS.BILLED] } }, filters, actor);
  const refundMatch = await applyPaymentScope({ status: { $in: [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.REFUNDED_MANUAL, PAYMENT_STATUS.VOIDED] } }, filters, actor);
  applyDateRange(paymentMatch, 'paid_at', filters);
  applyDateRange(invoiceMatch, 'issued_at', filters);
  applyDateRange(chargeMatch, 'charged_at', filters);
  applyDateRange(refundMatch, 'updated_at', filters);

  const [
    paymentTotals,
    invoiceTotals,
    chargeTotals,
    refundTotals,
    revenueByHour,
    revenueByCashier,
    paymentByMethod,
    revenueByServiceType,
    topServices,
    topInvoices,
    completedPayments,
  ] = await Promise.all([
    Payment.aggregate([{ $match: paymentMatch }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Invoice.aggregate([{ $match: invoiceMatch }, { $group: { _id: null, amount: { $sum: '$total_amount' }, count: { $sum: 1 }, outstanding: { $sum: '$balance_due' } } }]),
    Charge.aggregate([{ $match: chargeMatch }, { $group: { _id: null, amount: { $sum: '$total_amount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: refundMatch }, { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: dateExpression('paid_at', '%H:00', filters.timezone), count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: '$received_by', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
      { $limit: 12 },
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: '$payment_method', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
    ]),
    Charge.aggregate([
      { $match: chargeMatch },
      { $lookup: { from: 'service_catalog', localField: 'service_id', foreignField: '_id', as: 'service' } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$service.service_type', count: { $sum: 1 }, amount: { $sum: '$total_amount' } } },
      { $sort: { amount: -1 } },
    ]),
    Charge.aggregate([
      { $match: chargeMatch },
      { $lookup: { from: 'service_catalog', localField: 'service_id', foreignField: '_id', as: 'service' } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$service_id', service_code: { $first: '$service.service_code' }, service_name: { $first: '$service.service_name' }, service_type: { $first: '$service.service_type' }, count: { $sum: 1 }, amount: { $sum: '$total_amount' } } },
      { $sort: { amount: -1 } },
      { $limit: 8 },
    ]),
    Invoice.find(invoiceMatch)
      .sort({ total_amount: -1, issued_at: -1 })
      .limit(8)
      .populate('patient_id', 'patient_code full_name phone')
      .lean(),
    Payment.find(paymentMatch)
      .sort({ paid_at: -1, created_at: -1 })
      .limit(Number(query.limit || 30))
      .populate('patient_id', 'patient_code full_name phone')
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
      .populate('received_by', 'full_name username employee_code')
      .populate('confirmed_by', 'full_name username employee_code')
      .lean(),
  ]);
  const cashierIds = revenueByCashier.map((row) => row._id).filter(Boolean);
  const cashiers = cashierIds.length
    ? await User.find({ _id: { $in: cashierIds } }).select('full_name username employee_code').lean()
    : [];
  const cashierMap = new Map(cashiers.map((cashier) => [String(cashier._id), cashier]));
  const refundMap = Object.fromEntries(refundTotals.map((row) => [row._id, row]));
  const payments = moneySummary(paymentTotals);
  const invoices = moneySummary(invoiceTotals);
  const charges = moneySummary(chargeTotals);

  return {
    summary: {
      paid_amount: roundNumber(payments.amount),
      payment_count: payments.count || 0,
      issued_invoice_amount: roundNumber(invoices.amount),
      invoice_count: invoices.count || 0,
      gross_charges: roundNumber(charges.amount),
      charge_count: charges.count || 0,
      outstanding_amount: roundNumber(invoices.outstanding),
      refund_amount: roundNumber((refundMap[PAYMENT_STATUS.REFUNDED]?.amount || 0) + (refundMap[PAYMENT_STATUS.REFUNDED_MANUAL]?.amount || 0)),
      refund_count: (refundMap[PAYMENT_STATUS.REFUNDED]?.count || 0) + (refundMap[PAYMENT_STATUS.REFUNDED_MANUAL]?.count || 0),
      voided_amount: roundNumber(refundMap[PAYMENT_STATUS.VOIDED]?.amount),
      voided_count: refundMap[PAYMENT_STATUS.VOIDED]?.count || 0,
    },
    revenue_by_hour: revenueByHour.map((row) => ({ hour: row._id, count: row.count, amount: roundNumber(row.amount) })),
    revenue_by_cashier: revenueByCashier.map((row) => ({
      cashier_id: row._id ? String(row._id) : null,
      cashier: row._id ? cashierMap.get(String(row._id)) || null : null,
      count: row.count,
      amount: roundNumber(row.amount),
    })),
    revenue_by_department: [],
    revenue_by_service_type: revenueByServiceType.map((row) => ({ service_type: row._id || 'unknown', count: row.count, amount: roundNumber(row.amount) })),
    payment_by_method: paymentByMethod.map((row) => ({ payment_method: row._id || 'unknown', count: row.count, amount: roundNumber(row.amount) })),
    top_services: topServices.map((row) => ({
      service_id: row._id ? String(row._id) : null,
      service_code: row.service_code,
      service_name: row.service_name || 'Dịch vụ không xác định',
      service_type: row.service_type || 'unknown',
      count: row.count,
      amount: roundNumber(row.amount),
    })),
    top_invoices: topInvoices.map((invoice) => ({ ...mapInvoice(invoice), patient: mapPatient(invoice.patient_id) })),
    completed_payments: completedPayments.map((payment) => ({
      id: String(payment._id),
      payment_no: payment.payment_no,
      paid_at: payment.paid_at,
      patient: mapPatient(payment.patient_id),
      invoice: mapInvoice(payment.invoice_id),
      amount: payment.amount,
      payment_method: payment.payment_method,
      transaction_ref: payment.transaction_ref || payment.transaction_reference,
      received_by: payment.received_by || null,
      confirmed_by: payment.confirmed_by || null,
      status: payment.status,
      receipt_image_url: payment.receipt_image_url,
    })),
    filters: serializeFilters(filters),
  };
}

async function getBillingWorkQueue(query = {}, actor = {}) {
  assertBillingOverviewAccess(actor);
  const filters = normalizeFilters(query, { defaultToday: false });
  const [
    invoicesToCollect,
    partialPaidInvoices,
    pendingConfirmations,
    submittedReceipts,
    manualReviews,
    paymentErrors,
    refundRequests,
    overdueDebts,
    chargesWaitingInvoice,
    claimRows,
  ] = await Promise.all([
    getUnpaidInvoiceQueue({ ...query, status: INVOICE_STATUS.ISSUED, limit: 12 }, actor),
    getUnpaidInvoiceQueue({ ...query, status: INVOICE_STATUS.PARTIALLY_PAID, limit: 12 }, actor),
    getPaymentConfirmationQueue({ ...query, status: PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION, limit: 12 }, actor),
    getPaymentConfirmationQueue({ ...query, status: PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT, limit: 12 }, actor),
    getPaymentConfirmationQueue({ ...query, status: PAYMENT_INTENT_STATUS.MANUAL_REVIEW, limit: 12 }, actor),
    getPaymentErrorQueue({ ...query, limit: 12 }, actor),
    getRefundRequestQueue({ ...query, limit: 12 }, actor),
    getUnpaidInvoiceQueue({ ...query, overdue: true, limit: 12 }, actor),
    (async () => {
      const match = await applyChargeScope({ status: CHARGE_STATUS.POSTED, invoice_id: { $exists: false } }, filters, actor);
      const items = await Charge.find(match)
        .sort({ posted_at: -1, charged_at: -1, created_at: -1 })
        .limit(12)
        .populate('patient_id', 'patient_code full_name phone')
        .lean();
      return { items: items.map(taskFromCharge) };
    })(),
    (async () => {
      const invoiceIds = await invoiceIdsForScopedInvoices(filters, actor);
      const match = {
        status: { $in: [INSURANCE_CLAIM_STATUS.SUBMITTED, INSURANCE_CLAIM_STATUS.UNDER_REVIEW] },
        ...(invoiceIds.length || await getScopedDepartmentId(filters, actor) ? { invoice_id: { $in: invoiceIds } } : {}),
      };
      const items = await InsuranceClaim.find(match)
        .sort({ submitted_at: -1, updated_at: -1 })
        .limit(12)
        .populate('patient_id', 'patient_code full_name phone')
        .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
        .lean();
      return items.map(taskFromClaim);
    })(),
  ]);

  const allItems = [
    ...invoicesToCollect.items,
    ...partialPaidInvoices.items,
    ...pendingConfirmations.items,
    ...submittedReceipts.items,
    ...manualReviews.items,
    ...paymentErrors.items,
    ...refundRequests.items,
    ...overdueDebts.items,
    ...chargesWaitingInvoice.items,
    ...claimRows,
  ];

  return {
    summary: {
      total: allItems.length,
      high_priority: allItems.filter((item) => item.priority === 'high').length,
      overdue_sla: allItems.filter((item) => item.type === 'debt' || item.reason?.includes('Quá hạn')).length,
      payment_confirmations: pendingConfirmations.pagination?.total || pendingConfirmations.items.length,
      payment_errors: paymentErrors.pagination?.total || paymentErrors.items.length,
      refund_requests: refundRequests.pagination?.total || refundRequests.items.length,
    },
    groups: {
      invoices_to_collect: invoicesToCollect.items,
      partial_paid_invoices: partialPaidInvoices.items,
      pending_confirmations: pendingConfirmations.items,
      submitted_receipts: submittedReceipts.items,
      manual_reviews: manualReviews.items,
      payment_errors: paymentErrors.items,
      refund_requests: refundRequests.items,
      overdue_debts: overdueDebts.items,
      charges_waiting_invoice: chargesWaitingInvoice.items,
      insurance_claims: claimRows,
    },
    items: allItems.sort((a, b) => new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0)),
    filters: serializeFilters(filters),
  };
}

function activityActions(type) {
  if (type.includes('payment_completed')) return ['view_payment', 'print_receipt'];
  if (type.includes('receipt_submitted')) return ['view_receipt', 'confirm_transfer', 'reject_transfer'];
  if (type.includes('payment_failed') || type.includes('rejected')) return ['view_payment', 'retry_intent'];
  if (type.includes('invoice')) return ['view_invoice'];
  if (type.includes('refund')) return ['view_payment'];
  return ['view_detail'];
}

function severityForStatus(status) {
  if ([PAYMENT_STATUS.COMPLETED, PAYMENT_INTENT_STATUS.CONFIRMED, PAYMENT_INTENT_STATUS.PAID, INVOICE_STATUS.PAID, INSURANCE_CLAIM_STATUS.SETTLED].includes(status)) return 'success';
  if ([PAYMENT_STATUS.FAILED, PAYMENT_STATUS.REJECTED, PAYMENT_INTENT_STATUS.FAILED, PAYMENT_INTENT_STATUS.REJECTED].includes(status)) return 'danger';
  if ([PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.VOIDED, PAYMENT_STATUS.REFUNDED_MANUAL, INVOICE_STATUS.VOIDED, INVOICE_STATUS.REFUNDED].includes(status)) return 'warning';
  return 'info';
}

async function getRecentBillingActivity(query = {}, actor = {}) {
  assertBillingOverviewAccess(actor);
  const filters = normalizeFilters(query, { defaultToday: false });
  const limit = Math.min(Math.max(Number(query.limit || 40), 1), 100);
  const canReadGlobalAuditTrail = hasGlobalBillingScope(actor);
  const paymentMatch = await applyPaymentScope({}, filters, actor);
  const intentMatch = await applyPaymentIntentScope({}, filters, actor);
  const invoiceMatch = await applyInvoiceScope({}, filters, actor);
  const invoiceIds = await invoiceIdsForScopedInvoices(filters, actor);
  const scopedClaimMatch = invoiceIds.length || await getScopedDepartmentId(filters, actor)
    ? { invoice_id: { $in: invoiceIds } }
    : {};
  if (query.date_from || query.date_to || query.date) {
    applyDateRange(paymentMatch, 'updated_at', filters);
    applyDateRange(intentMatch, 'updated_at', filters);
    applyDateRange(invoiceMatch, 'updated_at', filters);
    applyDateRange(scopedClaimMatch, 'updated_at', filters);
  }

  const [payments, intents, invoices, claims, outboxEvents, auditEvents] = await Promise.all([
    Payment.find(paymentMatch)
      .sort({ updated_at: -1, paid_at: -1, created_at: -1 })
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due')
      .lean(),
    PaymentIntent.find(intentMatch)
      .sort({ updated_at: -1, created_at: -1 })
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due')
      .lean(),
    Invoice.find(invoiceMatch)
      .sort({ updated_at: -1, issued_at: -1, created_at: -1 })
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .lean(),
    InsuranceClaim.find(scopedClaimMatch)
      .sort({ updated_at: -1, submitted_at: -1, created_at: -1 })
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due')
      .lean(),
    canReadGlobalAuditTrail
      ? EventOutbox.find({ aggregate_type: { $in: ['payment', 'payment_intent', 'invoice', 'insurance_claim'] } })
        .sort({ occurred_at: -1, created_at: -1 })
        .limit(Math.ceil(limit / 2))
        .lean()
      : Promise.resolve([]),
    canReadGlobalAuditTrail
      ? AuditLog.find({ target_type: { $in: ['payment', 'payment_intent', 'invoice', 'insurance_claim', 'billing'] } })
        .sort({ created_at: -1 })
        .limit(Math.ceil(limit / 2))
        .select('action target_type target_id status severity message created_at actor_type actor_id metadata')
        .lean()
      : Promise.resolve([]),
  ]);

  const items = [
    ...payments.map((payment) => ({
      id: `payment:${payment._id}:${payment.updated_at || payment.paid_at}`,
      type: payment.refund_status === 'requested' ? 'payment_refund_requested' : `payment_${payment.status}`,
      at: payment.updated_at || payment.paid_at || payment.created_at,
      severity: severityForStatus(payment.status),
      patient: mapPatient(payment.patient_id),
      invoice: mapInvoice(payment.invoice_id),
      payment: {
        id: String(payment._id),
        payment_no: payment.payment_no,
        status: payment.status,
        payment_method: payment.payment_method,
      },
      amount: payment.amount,
      actor: payment.received_by ? { id: String(payment.received_by) } : null,
      message: payment.refund_status === 'requested' ? 'Payment có yêu cầu hoàn tiền' : `Payment ${payment.payment_no} ${payment.status}`,
      actions: activityActions(`payment_${payment.status}`),
    })),
    ...intents.map((intent) => ({
      id: `intent:${intent._id}:${intent.updated_at || intent.created_at}`,
      type: intent.status === PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT ? 'receipt_submitted' : `payment_intent_${intent.status}`,
      at: intent.updated_at || intent.created_at,
      severity: severityForStatus(intent.status),
      patient: mapPatient(intent.patient_id),
      invoice: mapInvoice(intent.invoice_id),
      payment_intent: {
        id: String(intent._id),
        intent_code: intent.intent_code,
        status: intent.status,
        provider: intent.provider,
        method: intent.method,
      },
      amount: intent.amount,
      actor: intent.updated_by ? { id: String(intent.updated_by) } : null,
      message: `Payment intent ${intent.intent_code} ${intent.status}`,
      actions: activityActions(intent.status === PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT ? 'receipt_submitted' : `payment_intent_${intent.status}`),
    })),
    ...invoices.map((invoice) => ({
      id: `invoice:${invoice._id}:${invoice.updated_at || invoice.issued_at}`,
      type: `invoice_${invoice.status}`,
      at: invoice.updated_at || invoice.issued_at || invoice.created_at,
      severity: severityForStatus(invoice.status),
      patient: mapPatient(invoice.patient_id),
      invoice: mapInvoice(invoice),
      amount: invoice.total_amount,
      actor: invoice.updated_by ? { id: String(invoice.updated_by) } : null,
      message: `Invoice ${invoice.invoice_no} ${invoice.status}`,
      actions: activityActions(`invoice_${invoice.status}`),
    })),
    ...claims.map((claim) => ({
      id: `claim:${claim._id}:${claim.updated_at || claim.submitted_at}`,
      type: `insurance_claim_${claim.status}`,
      at: claim.updated_at || claim.submitted_at || claim.created_at,
      severity: severityForStatus(claim.status),
      patient: mapPatient(claim.patient_id),
      invoice: mapInvoice(claim.invoice_id),
      insurance_claim: {
        id: String(claim._id),
        claim_no: claim.claim_no,
        status: claim.status,
      },
      amount: claim.paid_amount || claim.approved_amount || claim.submitted_amount,
      actor: claim.updated_by ? { id: String(claim.updated_by) } : null,
      message: `Insurance claim ${claim.claim_no} ${claim.status}`,
      actions: activityActions(`insurance_claim_${claim.status}`),
    })),
    ...outboxEvents.map((event) => ({
      id: `event:${event.event_id}`,
      type: event.event_type,
      at: event.occurred_at || event.created_at,
      severity: 'info',
      patient: event.payload?.patient || null,
      invoice: event.payload?.invoice_id ? { id: String(event.payload.invoice_id) } : null,
      amount: event.payload?.amount,
      actor: event.actor || null,
      message: event.payload?.notification?.body || event.event_type,
      actions: activityActions(event.event_type),
    })),
    ...auditEvents.map((event) => ({
      id: `audit:${event._id}`,
      type: event.action,
      at: event.created_at,
      severity: event.severity || (event.status === 'failure' ? 'danger' : 'info'),
      actor: { actor_type: event.actor_type, actor_id: event.actor_id },
      amount: event.metadata?.amount,
      message: event.message || event.action,
      actions: activityActions(event.action),
    })),
  ]
    .filter((item) => (query.type ? item.type.includes(query.type) : true))
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    .slice(0, limit);

  return { items, filters: serializeFilters(filters) };
}

async function getBillingDashboardOverview(query = {}, actor = {}) {
  assertBillingOverviewAccess(actor);
  const filters = normalizeFilters(query, { defaultToday: true });
  const paymentMatch = await applyPaymentScope({ status: PAYMENT_STATUS.COMPLETED }, filters, actor);
  const invoiceTodayMatch = await applyInvoiceScope({ status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID, INVOICE_STATUS.PAID] } }, filters, actor);
  const unpaidMatch = await applyInvoiceScope({ status: { $in: PAYABLE_INVOICE_STATUSES }, balance_due: { $gt: 0 } }, { ...filters, date_from: null, date_to: null }, actor);
  const overdueMatch = { ...unpaidMatch, due_at: { $lt: new Date() } };
  const pendingManualMatch = await applyPaymentIntentScope({ status: PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION }, filters, actor);
  const submittedReceiptMatch = await applyPaymentIntentScope({ status: PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT }, filters, actor);
  const manualReviewMatch = await applyPaymentIntentScope({ status: PAYMENT_INTENT_STATUS.MANUAL_REVIEW }, filters, actor);
  const failedIntentMatch = await applyPaymentIntentScope({ status: { $in: ERROR_INTENT_STATUSES } }, filters, actor);
  const refundMatch = await applyPaymentScope({ refund_status: 'requested' }, filters, actor);
  applyDateRange(paymentMatch, 'paid_at', filters);
  applyDateRange(invoiceTodayMatch, 'issued_at', filters);

  const todayRevenue = await getTodayRevenueOverview(query, actor);
  const [
    invoiceTotals,
    unpaidTotals,
    overdueTotals,
    pendingManualCount,
    submittedReceiptCount,
    manualReviewCount,
    failedPaymentCount,
    refundRequestCount,
    invoiceByStatus,
    chargePosted,
    intentCreated,
    receiptSubmitted,
    dashboardUnpaid,
    dashboardConfirmations,
    dashboardErrors,
    dashboardRefunds,
    dashboardDebts,
    recentActivity,
  ] = await Promise.all([
    Invoice.aggregate([{ $match: invoiceTodayMatch }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$total_amount' } } }]),
    Invoice.aggregate([{ $match: unpaidMatch }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$balance_due' } } }]),
    Invoice.aggregate([{ $match: overdueMatch }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$balance_due' } } }]),
    PaymentIntent.countDocuments(pendingManualMatch),
    PaymentIntent.countDocuments(submittedReceiptMatch),
    PaymentIntent.countDocuments(manualReviewMatch),
    PaymentIntent.countDocuments(failedIntentMatch),
    Payment.countDocuments(refundMatch),
    Invoice.aggregate([
      { $match: invoiceTodayMatch },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$total_amount' }, balance_due: { $sum: '$balance_due' } } },
      { $sort: { _id: 1 } },
    ]),
    (async () => {
      const match = await applyChargeScope({ status: { $in: [CHARGE_STATUS.POSTED, CHARGE_STATUS.BILLED] } }, filters, actor);
      applyDateRange(match, 'charged_at', filters);
      return Charge.aggregate([{ $match: match }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$total_amount' } } }]);
    })(),
    (async () => {
      const match = await applyPaymentIntentScope({}, filters, actor);
      applyDateRange(match, 'created_at', filters);
      return PaymentIntent.aggregate([{ $match: match }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }]);
    })(),
    (async () => {
      const match = await applyPaymentIntentScope({ status: PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT }, filters, actor);
      applyDateRange(match, 'updated_at', filters);
      return PaymentIntent.aggregate([{ $match: match }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }]);
    })(),
    getUnpaidInvoiceQueue({ ...query, limit: 6 }, actor),
    getPaymentConfirmationQueue({ ...query, limit: 6 }, actor),
    getPaymentErrorQueue({ ...query, limit: 6 }, actor),
    getRefundRequestQueue({ ...query, limit: 6 }, actor),
    getDebtAgingOverview({ ...query, overdue: true, limit: 6 }, actor),
    getRecentBillingActivity({ ...query, limit: 16 }, actor),
  ]);
  const invoices = moneySummary(invoiceTotals);
  const unpaid = moneySummary(unpaidTotals);
  const overdue = moneySummary(overdueTotals);
  const posted = moneySummary(chargePosted);
  const intent = moneySummary(intentCreated);
  const receipt = moneySummary(receiptSubmitted);

  return {
    kpi: {
      today_revenue: todayRevenue.summary.paid_amount,
      today_payment_count: todayRevenue.summary.payment_count,
      issued_invoice_amount_today: roundNumber(invoices.amount),
      issued_invoice_count_today: invoices.count || 0,
      unpaid_invoice_count: unpaid.count || 0,
      unpaid_balance_total: roundNumber(unpaid.amount),
      overdue_invoice_count: overdue.count || 0,
      overdue_balance_total: roundNumber(overdue.amount),
      pending_manual_payment_count: pendingManualCount,
      submitted_receipt_count: submittedReceiptCount,
      manual_review_count: manualReviewCount,
      failed_payment_count: failedPaymentCount,
      refund_requested_count: refundRequestCount,
    },
    charts: {
      revenue_by_hour: todayRevenue.revenue_by_hour,
      payment_by_method: todayRevenue.payment_by_method,
      invoice_by_status: invoiceByStatus.map((row) => ({ status: row._id, count: row.count, amount: roundNumber(row.amount), balance_due: roundNumber(row.balance_due) })),
      collection_funnel: [
        { stage: 'charge_posted', count: posted.count || 0, amount: roundNumber(posted.amount) },
        { stage: 'invoice_issued', count: invoices.count || 0, amount: roundNumber(invoices.amount) },
        { stage: 'payment_intent_created', count: intent.count || 0, amount: roundNumber(intent.amount) },
        { stage: 'receipt_submitted', count: receipt.count || 0, amount: roundNumber(receipt.amount) },
        { stage: 'payment_completed', count: todayRevenue.summary.payment_count, amount: todayRevenue.summary.paid_amount },
      ],
    },
    priority_queues: {
      unpaid_invoices: dashboardUnpaid.items,
      payment_confirmations: dashboardConfirmations.items,
      payment_errors: dashboardErrors.items,
      refund_requests: dashboardRefunds.items,
      overdue_debts: dashboardDebts.items,
    },
    recent_activity: recentActivity.items,
    filters: serializeFilters(filters),
  };
}

module.exports = {
  getBillingDashboardOverview,
  getBillingWorkQueue,
  getTodayRevenueOverview,
  getUnpaidInvoiceQueue,
  getPaymentConfirmationQueue,
  getPaymentErrorQueue,
  getDebtAgingOverview,
  getRecentBillingActivity,
};
