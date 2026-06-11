const { Types } = require('mongoose');
const {
  Admission,
  CashDrawerMovement,
  CashierShift,
  Charge,
  Encounter,
  InsuranceClaim,
  Invoice,
  Patient,
  Payment,
  PaymentIntent,
  ReceiptPrintLog,
  User,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  CHARGE_STATUS,
  INVOICE_STATUS,
  INSURANCE_CLAIM_STATUS,
  PAYMENT_INTENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} = require('../constants/statuses');
const billingService = require('./billing.service');
const paymentIntentService = require('./payment-intent.service');
const permissionService = require('./permission.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const {
  applyRealInvoiceFilter,
  shouldIncludeDemoBillingData,
} = require('./billing-data-scope.helper');
const { generateSequenceCode } = require('./code-generator.service');
const { CASHIER_SHIFT_STATUS } = require('../models/billing/cashier-shift.model');
const { CASH_DRAWER_MOVEMENT_TYPE } = require('../models/billing/cash-drawer-movement.model');

const PAYABLE_INVOICE_STATUSES = [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID];
const ACTIVE_INTENT_STATUSES = [
  PAYMENT_INTENT_STATUS.CREATED,
  PAYMENT_INTENT_STATUS.PENDING,
  PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
  PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
  PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
  PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
];

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(value);
}

function actorId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || null;
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

function hasGlobalCashierScope(actor = {}) {
  return hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)
    || hasPermission(actor, PERMISSION.REPORTS.READ_ALL)
    || !actorDepartmentId(actor);
}

function shouldIncludeClosedInvoiceIntents(source = {}) {
  return source.include_closed_invoices === true
    || source.includeClosedInvoices === true
    || ['true', '1', 'yes', 'y'].includes(String(source.include_closed_invoices ?? source.includeClosedInvoices ?? '').trim().toLowerCase());
}

function assertCashierAccess(actor = {}, permissions = []) {
  if ((actor.actorType || actor.actor_type) !== 'staff') throw createError('Chỉ staff được dùng quầy thu tiền.', 403);
  const allowed = [
    PERMISSION.INVOICES.READ,
    PERMISSION.INVOICES.READ_UNPAID,
    PERMISSION.PAYMENTS.READ,
    PERMISSION.PAYMENTS.CREATE,
    PERMISSION.PAYMENT_INTENTS.READ,
    PERMISSION.PAYMENT_RECONCILIATION.READ,
    ...permissions,
  ];
  if (!hasAnyPermission(actor, allowed)) {
    throw createError('Tài khoản hiện tại không có quyền dùng quầy thu tiền.', 403);
  }
}

function parseDate(value, fieldName) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function normalizeFilters(query = {}, { defaultToday = false } = {}) {
  const date = parseDate(query.date, 'date');
  const from = parseDate(query.date_from || query.from, 'date_from');
  const to = parseDate(query.date_to || query.to, 'date_to');
  const now = new Date();
  const dateFrom = date ? getStartOfDay(date) : from ? getStartOfDay(from) : defaultToday ? getStartOfDay(now) : null;
  const dateTo = date ? getEndOfDay(date) : to ? getEndOfDay(to) : defaultToday ? getEndOfDay(now) : null;
  if (dateFrom && dateTo && dateFrom > dateTo) throw createError('date_from phải nhỏ hơn hoặc bằng date_to.', 400);
  return {
    date_from: dateFrom,
    date_to: dateTo,
    keyword: normalizeString(query.q || query.keyword || query.search),
    department_id: normalizeString(query.department_id),
    patient_id: normalizeString(query.patient_id),
    status_group: normalizeString(query.status_group),
    payment_method: normalizeString(query.payment_method || query.method),
    provider: normalizeString(query.provider),
    min_balance_due: query.min_balance_due || query.balance_due_gt,
    max_balance_due: query.max_balance_due || query.balance_due_lt,
    sort: normalizeString(query.sort || query.sort_by),
    include_demo: query.include_demo ?? query.includeDemo,
    include_closed_invoices: query.include_closed_invoices ?? query.includeClosedInvoices,
    data_scope: query.data_scope || query.dataScope || query.scope,
  };
}

function applyDate(match, field, filters = {}) {
  if (!filters.date_from && !filters.date_to) return;
  match[field] = {};
  if (filters.date_from) match[field].$gte = filters.date_from;
  if (filters.date_to) match[field].$lte = filters.date_to;
}

function addMatchCondition(match, condition) {
  if (!condition || !Object.keys(condition).length) return match;
  if (!match.$and) match.$and = [];
  match.$and.push(condition);
  return match;
}

async function getScopedDepartmentId(filters = {}, actor = {}) {
  if (hasGlobalCashierScope(actor)) return filters.department_id || null;
  const ownDepartmentId = actorDepartmentId(actor);
  if (!ownDepartmentId) throw createError('Không xác định được khoa của thu ngân.', 403);
  if (filters.department_id && String(filters.department_id) !== String(ownDepartmentId)) {
    throw createError('Bạn không có quyền xem dữ liệu quầy thu ngoài khoa.', 403);
  }
  return ownDepartmentId;
}

async function applyInvoiceScope(match = {}, filters = {}, actor = {}) {
  if (filters.patient_id) match.patient_id = toObjectId(filters.patient_id, 'patient_id');
  const departmentId = await getScopedDepartmentId(filters, actor);
  if (departmentId) {
    const scopedDepartmentId = toObjectId(departmentId, 'department_id');
    const [encounters, admissions] = await Promise.all([
      Encounter.find({ department_id: scopedDepartmentId }).select('_id').lean(),
      Admission.find({ department_id: scopedDepartmentId }).select('_id').lean(),
    ]);
    const scopeConditions = [];
    const encounterIds = encounters.map((encounter) => encounter._id);
    const admissionIds = admissions.map((admission) => admission._id);
    if (encounterIds.length) scopeConditions.push({ encounter_id: { $in: encounterIds } });
    if (admissionIds.length) scopeConditions.push({ admission_id: { $in: admissionIds } });
    addMatchCondition(match, scopeConditions.length ? { $or: scopeConditions } : { _id: { $in: [] } });
  }
  return applyRealInvoiceFilter(match, filters);
}

async function scopedInvoiceIds(filters = {}, actor = {}, extraMatch = {}) {
  const departmentId = await getScopedDepartmentId(filters, actor);
  const needsInvoiceScope = filters.patient_id || departmentId || !shouldIncludeDemoBillingData(filters);
  if (!needsInvoiceScope) return null;
  const match = await applyInvoiceScope({ ...extraMatch }, filters, actor);
  return (await Invoice.find(match).select('_id').lean()).map((invoice) => invoice._id);
}

async function patientIdsForKeyword(keyword) {
  if (!keyword) return [];
  const pattern = escapeRegex(keyword);
  return (await Patient.find({
    is_deleted: false,
    $or: [
      { patient_code: { $regex: pattern, $options: 'i' } },
      { full_name: { $regex: pattern, $options: 'i' } },
      { phone: { $regex: pattern, $options: 'i' } },
      { national_id: { $regex: pattern, $options: 'i' } },
      { insurance_number: { $regex: pattern, $options: 'i' } },
    ],
  }).select('_id').limit(200).lean()).map((patient) => patient._id);
}

function agingDays(invoice = {}, now = new Date()) {
  const anchor = invoice.due_at || invoice.issued_at || invoice.created_at;
  if (!anchor) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(anchor).getTime()) / 86400000));
}

function mapPatient(patient) {
  if (!patient) return null;
  if (typeof patient !== 'object') return { id: toId(patient) };
  return {
    id: toId(patient._id || patient.id),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    phone: patient.phone,
    gender: patient.gender,
    date_of_birth: patient.date_of_birth,
    national_id: patient.national_id,
  };
}

function mapDepartment(department) {
  if (!department) return null;
  if (typeof department !== 'object') return { id: toId(department) };
  return {
    id: toId(department._id || department.id),
    department_code: department.department_code,
    department_name: department.department_name,
  };
}

function mapInvoice(invoice) {
  if (!invoice) return null;
  return {
    id: toId(invoice._id || invoice.id),
    invoice_no: invoice.invoice_no,
    status: invoice.status,
    subtotal_amount: invoice.subtotal_amount,
    discount_amount: invoice.discount_amount,
    tax_amount: invoice.tax_amount,
    insurance_amount: invoice.insurance_amount,
    total_amount: invoice.total_amount,
    paid_amount: invoice.paid_amount,
    balance_due: invoice.balance_due,
    issued_at: invoice.issued_at,
    due_at: invoice.due_at,
    currency: invoice.currency,
  };
}

function mapPayment(payment) {
  if (!payment) return null;
  return {
    id: toId(payment._id || payment.id),
    payment_no: payment.payment_no,
    amount: payment.amount,
    payment_method: payment.payment_method,
    status: payment.status,
    paid_at: payment.paid_at,
    transaction_ref: payment.transaction_ref || payment.transaction_reference,
    refund_status: payment.refund_status,
  };
}

function mapIntent(intent) {
  if (!intent) return null;
  return {
    id: toId(intent._id || intent.id),
    intent_code: intent.intent_code,
    amount: intent.amount,
    provider: intent.provider,
    method: intent.method,
    status: intent.status,
    payment_note: intent.payment_note,
    qr_image_url: intent.qr_image_url,
    receiver_name: intent.receiver_name,
    receiver_bank_bin: intent.receiver_bank_bin,
    receiver_account_no: intent.receiver_account_no,
    receiver_account_name: intent.receiver_account_name,
    transaction_reference: intent.transaction_reference,
    receipt_image_url: intent.receipt_image_url,
    expires_at: intent.expires_at,
    manual_review_reason: intent.manual_review_reason,
    manual_reject_reason: intent.manual_reject_reason,
    failure_reason: intent.failure_reason,
  };
}

function invoiceSuggestedAction(invoice = {}, activeIntent = null) {
  if (activeIntent?.status === PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT) return 'confirm_transfer';
  if (activeIntent?.status === PAYMENT_INTENT_STATUS.MANUAL_REVIEW) return 'manual_review';
  if (activeIntent) return 'wait_payment';
  if (invoice.status === INVOICE_STATUS.PARTIALLY_PAID) return 'collect_remaining';
  return 'collect_payment';
}

function invoiceFlags(invoice = {}, activeIntent = null, claims = []) {
  const flags = [];
  if (invoice.due_at && new Date(invoice.due_at) < new Date()) flags.push('overdue');
  if (activeIntent) flags.push('has_active_intent');
  if (invoice.status === INVOICE_STATUS.PARTIALLY_PAID) flags.push('partial_paid');
  if (Number(invoice.balance_due || 0) >= 10000000) flags.push('high_amount');
  if (claims.some((claim) => ![INSURANCE_CLAIM_STATUS.SETTLED, INSURANCE_CLAIM_STATUS.REJECTED, INSURANCE_CLAIM_STATUS.CANCELLED].includes(claim.status))) flags.push('insurance_pending');
  return flags;
}

async function decorateInvoices(invoices = []) {
  const invoiceIds = invoices.map((invoice) => invoice._id);
  const [payments, intents, claims] = await Promise.all([
    Payment.find({ invoice_id: { $in: invoiceIds } }).sort({ paid_at: -1, created_at: -1 }).lean(),
    PaymentIntent.find({ invoice_id: { $in: invoiceIds }, status: { $in: ACTIVE_INTENT_STATUSES } }).sort({ updated_at: -1, created_at: -1 }).lean(),
    InsuranceClaim.find({ invoice_id: { $in: invoiceIds } }).sort({ updated_at: -1, created_at: -1 }).lean(),
  ]);
  const latestPaymentByInvoice = new Map();
  payments.forEach((payment) => {
    const key = toId(payment.invoice_id);
    if (!latestPaymentByInvoice.has(key)) latestPaymentByInvoice.set(key, payment);
  });
  const activeIntentByInvoice = new Map();
  intents.forEach((intent) => {
    const key = toId(intent.invoice_id);
    if (!activeIntentByInvoice.has(key)) activeIntentByInvoice.set(key, intent);
  });
  const claimsByInvoice = new Map();
  claims.forEach((claim) => {
    const key = toId(claim.invoice_id);
    claimsByInvoice.set(key, [...(claimsByInvoice.get(key) || []), claim]);
  });

  return invoices.map((invoice) => {
    const activeIntent = activeIntentByInvoice.get(toId(invoice._id));
    const invoiceClaims = claimsByInvoice.get(toId(invoice._id)) || [];
    return {
      invoice: mapInvoice(invoice),
      patient: mapPatient(invoice.patient_id),
      encounter: invoice.encounter_id ? {
        id: toId(invoice.encounter_id._id || invoice.encounter_id.id),
        encounter_code: invoice.encounter_id.encounter_code,
        encounter_type: invoice.encounter_id.encounter_type,
        status: invoice.encounter_id.status,
        department: mapDepartment(invoice.encounter_id.department_id),
      } : null,
      admission: invoice.admission_id ? {
        id: toId(invoice.admission_id._id || invoice.admission_id.id),
        admission_no: invoice.admission_id.admission_no,
        admission_type: invoice.admission_id.admission_type,
        status: invoice.admission_id.status,
        department: mapDepartment(invoice.admission_id.department_id),
      } : null,
      active_payment_intent: mapIntent(activeIntent),
      latest_payment: mapPayment(latestPaymentByInvoice.get(toId(invoice._id))),
      claim_summary: {
        count: invoiceClaims.length,
        pending_count: invoiceClaims.filter((claim) => ![INSURANCE_CLAIM_STATUS.SETTLED, INSURANCE_CLAIM_STATUS.REJECTED, INSURANCE_CLAIM_STATUS.CANCELLED].includes(claim.status)).length,
        statuses: [...new Set(invoiceClaims.map((claim) => claim.status))],
      },
      aging_days: agingDays(invoice),
      suggested_action: invoiceSuggestedAction(invoice, activeIntent),
      flags: invoiceFlags(invoice, activeIntent, invoiceClaims),
    };
  });
}

function sortForInvoiceQueue(sort) {
  if (sort === 'balance_due_desc') return { balance_due: -1, due_at: 1, issued_at: -1 };
  if (sort === 'due_at_asc') return { due_at: 1, balance_due: -1, issued_at: -1 };
  return { issued_at: -1, created_at: -1 };
}

async function listCashierInvoices(query = {}, actor = {}) {
  assertCashierAccess(actor, [PERMISSION.INVOICES.READ, PERMISSION.INVOICES.READ_UNPAID]);
  const filters = normalizeFilters(query);
  const { page, limit, skip } = getPagination(query, 20, 100);
  const match = await applyInvoiceScope({
    status: { $in: PAYABLE_INVOICE_STATUSES },
    balance_due: { $gt: 0 },
  }, filters, actor);

  if (filters.status_group === 'unpaid') match.status = INVOICE_STATUS.ISSUED;
  if (filters.status_group === 'partial') match.status = INVOICE_STATUS.PARTIALLY_PAID;
  if (filters.status_group === 'overdue') match.due_at = { $lt: new Date() };
  if (filters.min_balance_due !== undefined && filters.min_balance_due !== '') match.balance_due.$gte = Number(filters.min_balance_due);
  if (filters.max_balance_due !== undefined && filters.max_balance_due !== '') match.balance_due.$lte = Number(filters.max_balance_due);
  if (filters.date_from || filters.date_to) applyDate(match, 'issued_at', filters);
  if (filters.keyword) {
    const patientIds = await patientIdsForKeyword(filters.keyword);
    const pattern = escapeRegex(filters.keyword);
    addMatchCondition(match, { $or: [
      { invoice_no: { $regex: pattern, $options: 'i' } },
      ...(patientIds.length ? [{ patient_id: { $in: patientIds } }] : []),
    ] });
  }

  const [items, total, totals] = await Promise.all([
    Invoice.find(match)
      .sort(sortForInvoiceQueue(filters.sort))
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone gender date_of_birth national_id')
      .populate({ path: 'encounter_id', select: 'encounter_code encounter_type status department_id', populate: { path: 'department_id', select: 'department_code department_name' } })
      .populate({ path: 'admission_id', select: 'admission_no admission_type status department_id', populate: { path: 'department_id', select: 'department_code department_name' } })
      .lean(),
    Invoice.countDocuments(match),
    Invoice.aggregate([{ $match: match }, { $group: { _id: null, count: { $sum: 1 }, total_balance_due: { $sum: '$balance_due' }, total_amount: { $sum: '$total_amount' } } }]),
  ]);
  const decoratedItems = await decorateInvoices(items);
  const hasIntentCount = decoratedItems.filter((item) => item.active_payment_intent).length;
  const insurancePendingCount = decoratedItems.filter((item) => item.claim_summary.pending_count > 0).length;

  return {
    summary: {
      count: totals[0]?.count || 0,
      total_balance_due: totals[0]?.total_balance_due || 0,
      total_amount: totals[0]?.total_amount || 0,
      overdue_count: decoratedItems.filter((item) => item.flags.includes('overdue')).length,
      has_active_intent_count: hasIntentCount,
      insurance_pending_count: insurancePendingCount,
    },
    items: decoratedItems,
    pagination: buildPagination(page, limit, total),
  };
}

async function searchCashier(query = {}, actor = {}) {
  assertCashierAccess(actor);
  const filters = normalizeFilters(query);
  const q = filters.keyword;
  if (!q || q.length < 2) {
    return { patients: [], invoices: [], payments: [], payment_intents: [], encounters: [], admissions: [] };
  }
  const pattern = escapeRegex(q);
  const invoiceScope = await applyInvoiceScope({}, filters, actor);
  const scopedInvoices = Object.keys(invoiceScope).length
    ? await Invoice.find(invoiceScope).select('_id patient_id').lean()
    : null;
  const scopedInvoiceIds = scopedInvoices ? scopedInvoices.map((invoice) => invoice._id) : null;
  const scopedPatientIds = scopedInvoices
    ? [...new Set(scopedInvoices.map((invoice) => toId(invoice.patient_id)).filter(Boolean))]
    : null;
  const invoiceIdFilter = scopedInvoiceIds ? { invoice_id: { $in: scopedInvoiceIds } } : {};
  const patientScopeFilter = scopedPatientIds ? { _id: { $in: scopedPatientIds.map((id) => toObjectId(id, 'patient_id')) } } : {};

  const [patients, invoices, payments, intents, encounters, admissions] = await Promise.all([
    Patient.find({
      is_deleted: false,
      ...patientScopeFilter,
      $or: [
        { patient_code: { $regex: pattern, $options: 'i' } },
        { full_name: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
        { national_id: { $regex: pattern, $options: 'i' } },
        { insurance_number: { $regex: pattern, $options: 'i' } },
      ],
    }).limit(8).lean(),
    Invoice.find({ ...invoiceScope, invoice_no: { $regex: pattern, $options: 'i' } }).limit(8).populate('patient_id', 'patient_code full_name phone').lean(),
    Payment.find({
      ...invoiceIdFilter,
      $or: [
        { payment_no: { $regex: pattern, $options: 'i' } },
        { transaction_ref: { $regex: pattern, $options: 'i' } },
        { transaction_reference: { $regex: pattern, $options: 'i' } },
        { provider_transaction_id: { $regex: pattern, $options: 'i' } },
      ],
    }).limit(8).populate('patient_id', 'patient_code full_name phone').populate('invoice_id', 'invoice_no status balance_due total_amount').lean(),
    PaymentIntent.find({
      ...invoiceIdFilter,
      $or: [
        { intent_code: { $regex: pattern, $options: 'i' } },
        { transaction_reference: { $regex: pattern, $options: 'i' } },
        { provider_transaction_id: { $regex: pattern, $options: 'i' } },
        { provider_order_id: { $regex: pattern, $options: 'i' } },
      ],
    }).limit(8).populate('patient_id', 'patient_code full_name phone').populate('invoice_id', 'invoice_no status balance_due total_amount').lean(),
    Encounter.find({ encounter_code: { $regex: pattern, $options: 'i' } }).limit(6).populate('patient_id', 'patient_code full_name phone').populate('department_id', 'department_code department_name').lean(),
    Admission.find({ admission_no: { $regex: pattern, $options: 'i' } }).limit(6).populate('patient_id', 'patient_code full_name phone').populate('department_id', 'department_code department_name').lean(),
  ]);

  const patientSummaries = await Promise.all(patients.map(async (patient) => {
    const debtMatch = applyRealInvoiceFilter({
      patient_id: patient._id,
      status: { $in: PAYABLE_INVOICE_STATUSES },
      balance_due: { $gt: 0 },
    }, filters);
    const debt = await Invoice.aggregate([
      { $match: debtMatch },
      { $group: { _id: null, count: { $sum: 1 }, balance_due: { $sum: '$balance_due' } } },
    ]);
    return {
      patient: mapPatient(patient),
      debt: { invoice_count: debt[0]?.count || 0, balance_due: debt[0]?.balance_due || 0 },
    };
  }));

  return {
    patients: patientSummaries,
    invoices: (await decorateInvoices(invoices)).slice(0, 8),
    payments: payments.map((payment) => ({ payment: mapPayment(payment), patient: mapPatient(payment.patient_id), invoice: mapInvoice(payment.invoice_id) })),
    payment_intents: intents.map((intent) => ({ payment_intent: mapIntent(intent), patient: mapPatient(intent.patient_id), invoice: mapInvoice(intent.invoice_id) })),
    encounters: encounters.map((encounter) => ({
      id: toId(encounter._id),
      encounter_code: encounter.encounter_code,
      status: encounter.status,
      patient: mapPatient(encounter.patient_id),
      department: mapDepartment(encounter.department_id),
    })),
    admissions: admissions.map((admission) => ({
      id: toId(admission._id),
      admission_no: admission.admission_no,
      status: admission.status,
      patient: mapPatient(admission.patient_id),
      department: mapDepartment(admission.department_id),
    })),
  };
}

async function getCurrentShift(actor = {}) {
  assertCashierAccess(actor, [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENTS.READ]);
  const cashierId = actorId(actor);
  const shift = await CashierShift.findOne({ cashier_id: cashierId, status: CASHIER_SHIFT_STATUS.OPEN })
    .sort({ opened_at: -1 })
    .lean();
  return { shift };
}

async function generateShiftCode() {
  return generateSequenceCode(CashierShift, 'shift_code', 'CSH', { separator: '-', sequenceWidth: 4 });
}

async function openShift(payload = {}, actor = {}, requestMeta = {}) {
  assertCashierAccess(actor, [PERMISSION.PAYMENTS.CREATE]);
  const cashierId = actorId(actor);
  const existing = await CashierShift.findOne({ cashier_id: cashierId, status: CASHIER_SHIFT_STATUS.OPEN }).lean();
  if (existing) return { shift: existing, already_open: true };
  const openingCashAmount = Number(payload.opening_cash_amount || payload.openingCashAmount || 0);
  if (!Number.isFinite(openingCashAmount) || openingCashAmount < 0) throw createError('opening_cash_amount không hợp lệ.', 400);
  const shift = await CashierShift.create({
    cashier_id: cashierId,
    counter_id: normalizeString(payload.counter_id || payload.counterId),
    counter_code: normalizeString(payload.counter_code || payload.counterCode || payload.counter || 'COUNTER-01'),
    shift_code: await generateShiftCode(),
    opened_at: new Date(),
    opening_cash_amount: openingCashAmount,
    status: CASHIER_SHIFT_STATUS.OPEN,
    note: normalizeString(payload.note),
    opened_by: cashierId,
    created_by: cashierId,
    updated_by: cashierId,
  });
  if (openingCashAmount > 0) {
    await CashDrawerMovement.create({
      shift_id: shift._id,
      cashier_id: cashierId,
      counter_id: shift.counter_id,
      type: CASH_DRAWER_MOVEMENT_TYPE.CASH_IN,
      amount: openingCashAmount,
      reason: 'Opening cash amount',
      created_by: cashierId,
      updated_by: cashierId,
    });
  }
  await recordAuditLog({ actor, action: 'cashier_shift.open', targetType: 'cashier_shift', targetId: shift._id, status: 'success', message: 'Mở ca thu ngân.', requestMeta });
  return { shift: shift.toObject ? shift.toObject() : shift };
}

async function getShiftSummary(shiftId, actor = {}) {
  assertCashierAccess(actor, [PERMISSION.PAYMENTS.READ]);
  const shift = await CashierShift.findById(shiftId).lean();
  if (!shift) throw createError('Không tìm thấy ca thu ngân.', 404);
  if (!hasGlobalCashierScope(actor) && toId(shift.cashier_id) !== toId(actorId(actor))) {
    throw createError('Bạn chỉ được xem ca của mình.', 403);
  }
  const paymentMatch = { cashier_shift_id: shift._id, status: PAYMENT_STATUS.COMPLETED };
  const [payments, movements, printCount] = await Promise.all([
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: '$payment_method', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    CashDrawerMovement.find({ shift_id: shift._id }).sort({ occurred_at: 1 }).lean(),
    ReceiptPrintLog.countDocuments({ cashier_shift_id: shift._id }),
  ]);
  const paymentByMethod = payments.map((row) => ({ payment_method: row._id, count: row.count, amount: row.amount }));
  const cashAmount = paymentByMethod.find((row) => row.payment_method === PAYMENT_METHOD.CASH)?.amount || 0;
  const drawerAdjustments = movements.reduce((sum, movement) => {
    if (movement.type === CASH_DRAWER_MOVEMENT_TYPE.CASH_IN) return sum + Number(movement.amount || 0);
    if (movement.type === CASH_DRAWER_MOVEMENT_TYPE.CASH_OUT) return sum - Number(movement.amount || 0);
    return sum;
  }, 0);
  return {
    shift,
    summary: {
      payment_count: payments.reduce((sum, row) => sum + row.count, 0),
      payment_amount: payments.reduce((sum, row) => sum + row.amount, 0),
      cash_amount: cashAmount,
      expected_cash_amount: Number(shift.opening_cash_amount || 0) + cashAmount + drawerAdjustments,
      printed_receipt_count: printCount,
    },
    payment_by_method: paymentByMethod,
    movements,
  };
}

async function closeShift(shiftId, payload = {}, actor = {}, requestMeta = {}) {
  assertCashierAccess(actor, [PERMISSION.PAYMENTS.CREATE]);
  const summary = await getShiftSummary(shiftId, actor);
  const shift = await CashierShift.findById(shiftId);
  if (!shift) throw createError('Không tìm thấy ca thu ngân.', 404);
  if (shift.status !== CASHIER_SHIFT_STATUS.OPEN) return summary;
  const actual = Number(payload.closing_cash_actual ?? payload.closingCashActual ?? summary.summary.expected_cash_amount);
  if (!Number.isFinite(actual) || actual < 0) throw createError('closing_cash_actual không hợp lệ.', 400);
  shift.status = CASHIER_SHIFT_STATUS.CLOSED;
  shift.closed_at = new Date();
  shift.closed_by = actorId(actor);
  shift.closing_cash_expected = summary.summary.expected_cash_amount;
  shift.closing_cash_actual = actual;
  shift.difference_amount = actual - summary.summary.expected_cash_amount;
  shift.note = normalizeString(payload.note || shift.note);
  shift.updated_by = actorId(actor);
  await shift.save();
  await recordAuditLog({ actor, action: 'cashier_shift.close', targetType: 'cashier_shift', targetId: shift._id, status: 'success', message: 'Đóng ca thu ngân.', requestMeta });
  return getShiftSummary(shift._id, actor);
}

async function collectInvoicePayment(invoiceId, payload = {}, actor = {}, requestMeta = {}) {
  assertCashierAccess(actor, [PERMISSION.PAYMENTS.CREATE]);
  const currentShift = payload.cashier_shift_id || payload.cashierShiftId
    ? { shift: await CashierShift.findById(payload.cashier_shift_id || payload.cashierShiftId).lean() }
    : await getCurrentShift(actor);
  const shift = currentShift.shift;
  const body = {
    ...payload,
    cashier_shift_id: shift?._id,
    counter_id: payload.counter_id || shift?.counter_id,
    counter_code: payload.counter_code || shift?.counter_code,
    payment_source: payload.payment_source || 'cashier_counter',
    collection_note: payload.collection_note || payload.note,
    receipt_print_requested: Boolean(payload.print_receipt || payload.receipt_print_requested),
  };
  const payment = await billingService.createPayment(invoiceId, body, actor, requestMeta);
  if (body.receipt_print_requested) {
    await createReceiptPrintLog(payment._id || payment.id, {
      cashier_shift_id: shift?._id,
      counter_id: body.counter_id,
      counter_code: body.counter_code,
      reason: 'Thu và in biên lai tại quầy',
    }, actor, requestMeta).catch(() => {});
  }
  return payment;
}

async function checkTransactionRef(query = {}, actor = {}) {
  assertCashierAccess(actor, [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENT_RECONCILIATION.READ]);
  const filters = normalizeFilters(query);
  const transactionRef = normalizeString(query.transaction_ref || query.transactionReference || query.ref);
  if (!transactionRef) throw createError('transaction_ref là bắt buộc.', 400);
  const provider = normalizeString(query.provider);
  const scopedIds = await scopedInvoiceIds(filters, actor);
  const invoiceFilter = scopedIds ? [{ invoice_id: { $in: scopedIds } }] : [];
  const [payment, intent] = await Promise.all([
    Payment.findOne({
      $and: [
        {
          $or: [
            { transaction_ref: transactionRef },
            { transaction_reference: transactionRef },
            { provider_transaction_id: transactionRef },
          ],
        },
        ...(provider ? [{ $or: [{ provider }, { payment_provider: provider }] }] : []),
        ...invoiceFilter,
      ],
    }).populate('invoice_id', 'invoice_no status total_amount balance_due').lean(),
    PaymentIntent.findOne({
      $and: [
        {
          $or: [
            { transaction_reference: transactionRef },
            { provider_transaction_id: transactionRef },
          ],
        },
        ...(provider ? [{ provider }] : []),
        ...invoiceFilter,
      ],
    }).populate('invoice_id', 'invoice_no status total_amount balance_due').lean(),
  ]);
  return {
    exists: Boolean(payment || intent),
    payment: payment ? { ...mapPayment(payment), invoice: mapInvoice(payment.invoice_id) } : null,
    intent: intent ? { ...mapIntent(intent), invoice: mapInvoice(intent.invoice_id) } : null,
  };
}

async function createReceiptPrintLog(paymentId, payload = {}, actor = {}, requestMeta = {}) {
  assertCashierAccess(actor, [PERMISSION.PAYMENTS.PRINT_RECEIPT, PERMISSION.PAYMENTS.READ]);
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw createError('Không tìm thấy payment.', 404);
  const scopedIds = await scopedInvoiceIds({}, actor);
  if (scopedIds && !scopedIds.some((id) => toId(id) === toId(payment.invoice_id))) {
    throw createError('Bạn không có quyền ghi nhận in biên lai cho payment này.', 403);
  }
  const previousCount = await ReceiptPrintLog.countDocuments({ payment_id: payment._id });
  const log = await ReceiptPrintLog.create({
    payment_id: payment._id,
    invoice_id: payment.invoice_id,
    patient_id: payment.patient_id,
    receipt_no: payment.payment_no,
    printed_by: actorId(actor),
    printer_name: normalizeString(payload.printer_name || payload.printerName),
    counter_id: normalizeString(payload.counter_id || payload.counterId || payment.counter_id),
    counter_code: normalizeString(payload.counter_code || payload.counterCode || payment.counter_code),
    cashier_shift_id: payload.cashier_shift_id || payload.cashierShiftId || payment.cashier_shift_id,
    copy_no: previousCount + 1,
    reason: normalizeString(payload.reason),
    ip: requestMeta?.ipAddress,
    user_agent: requestMeta?.userAgent,
  });
  await recordAuditLog({ actor, action: 'receipt.print_log', targetType: 'payment', targetId: payment._id, status: 'success', message: 'Ghi nhận lượt in biên lai.', requestMeta, metadata: { copy_no: log.copy_no } });
  return log;
}

async function listReceiptPrintLogs(paymentId, actor = {}) {
  assertCashierAccess(actor, [PERMISSION.PAYMENTS.PRINT_RECEIPT, PERMISSION.PAYMENTS.READ]);
  const payment = await Payment.findById(paymentId).select('invoice_id').lean();
  if (!payment) throw createError('Không tìm thấy payment.', 404);
  const scopedIds = await scopedInvoiceIds({}, actor);
  if (scopedIds && !scopedIds.some((id) => toId(id) === toId(payment.invoice_id))) {
    throw createError('Bạn không có quyền xem log in biên lai cho payment này.', 403);
  }
  const logs = await ReceiptPrintLog.find({ payment_id: paymentId }).sort({ printed_at: -1 }).populate('printed_by', 'full_name username employee_code').lean();
  return { items: logs };
}

async function getWorkbench(query = {}, actor = {}) {
  assertCashierAccess(actor);
  const filters = normalizeFilters(query, { defaultToday: true });
  const cashierId = actorId(actor);
  const scopedIds = await scopedInvoiceIds(filters, actor);
  const scopedInvoiceFilter = scopedIds ? { invoice_id: { $in: scopedIds } } : {};
  const payableScopedIds = shouldIncludeClosedInvoiceIntents(filters)
    ? scopedIds
    : await scopedInvoiceIds(filters, actor, { status: { $in: PAYABLE_INVOICE_STATUSES }, balance_due: { $gt: 0 } });
  const payableInvoiceFilter = payableScopedIds ? { invoice_id: { $in: payableScopedIds } } : scopedInvoiceFilter;
  const [cashier, currentShift, unpaid, partial, allDue, todayPayments, pendingQr, submittedReceipt, manualReview, failedIntent, printedCount, recentPayments] = await Promise.all([
    cashierId ? User.findById(cashierId).select('full_name username employee_code department_id').lean() : null,
    getCurrentShift(actor),
    listCashierInvoices({ ...query, status_group: 'unpaid', limit: 6 }, actor),
    listCashierInvoices({ ...query, status_group: 'partial', limit: 6 }, actor),
    listCashierInvoices({ ...query, limit: 6, sort: 'due_at_asc' }, actor),
    (async () => {
      const match = { status: PAYMENT_STATUS.COMPLETED, ...scopedInvoiceFilter };
      applyDate(match, 'paid_at', filters);
      return Payment.aggregate([{ $match: match }, { $group: { _id: '$payment_method', count: { $sum: 1 }, amount: { $sum: '$amount' } } }]);
    })(),
    PaymentIntent.countDocuments({ ...payableInvoiceFilter, status: PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION }),
    PaymentIntent.countDocuments({ ...payableInvoiceFilter, status: PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT }),
    PaymentIntent.countDocuments({ ...payableInvoiceFilter, status: PAYMENT_INTENT_STATUS.MANUAL_REVIEW }),
    PaymentIntent.countDocuments({ ...scopedInvoiceFilter, status: { $in: [PAYMENT_INTENT_STATUS.FAILED, PAYMENT_INTENT_STATUS.REJECTED, PAYMENT_INTENT_STATUS.EXPIRED] } }),
    ReceiptPrintLog.countDocuments({ ...scopedInvoiceFilter, printed_at: { $gte: filters.date_from, $lte: filters.date_to } }),
    Payment.find({ ...scopedInvoiceFilter, status: PAYMENT_STATUS.COMPLETED, paid_at: { $gte: filters.date_from, $lte: filters.date_to } })
      .sort({ paid_at: -1, created_at: -1 })
      .limit(8)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
      .lean(),
  ]);
  const paymentMap = Object.fromEntries(todayPayments.map((row) => [row._id, row]));
  const todayRevenue = todayPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return {
    cashier: {
      user_id: cashierId,
      full_name: cashier?.full_name || actor.fullName || actor.username || 'Thu ngân',
      username: cashier?.username,
      counter_code: currentShift.shift?.counter_code || query.counter_code || 'COUNTER-01',
      shift_id: currentShift.shift?._id || null,
      shift_code: currentShift.shift?.shift_code || null,
      shift_status: currentShift.shift?.status || 'not_open',
    },
    kpis: {
      unpaid_invoice_count: unpaid.summary.count,
      partial_invoice_count: partial.summary.count,
      total_balance_due: allDue.summary.total_balance_due,
      today_revenue: todayRevenue,
      today_cash_amount: paymentMap[PAYMENT_METHOD.CASH]?.amount || 0,
      today_bank_transfer_amount: paymentMap[PAYMENT_METHOD.BANK_TRANSFER]?.amount || 0,
      pending_qr_count: pendingQr,
      submitted_receipt_count: submittedReceipt,
      manual_review_count: manualReview,
      failed_payment_count: failedIntent,
      printed_receipt_count: printedCount,
    },
    queues: {
      urgent_unpaid_invoices: allDue.items,
      pending_payment_intents: (await paymentIntentService.listManualPayments({ status: PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION, limit: 8 }, actor)).items,
      manual_review_items: (await paymentIntentService.listManualPayments({ status: PAYMENT_INTENT_STATUS.MANUAL_REVIEW, limit: 8 }, actor)).items,
      recent_payments: recentPayments.map((payment) => ({ payment: mapPayment(payment), patient: mapPatient(payment.patient_id), invoice: mapInvoice(payment.invoice_id) })),
    },
  };
}

module.exports = {
  getWorkbench,
  searchCashier,
  listCashierInvoices,
  collectInvoicePayment,
  checkTransactionRef,
  getCurrentShift,
  openShift,
  closeShift,
  getShiftSummary,
  createReceiptPrintLog,
  listReceiptPrintLogs,
  listManualPayments: paymentIntentService.listManualPayments,
  confirmManualPayment: paymentIntentService.confirmManualPayment,
  rejectManualPayment: paymentIntentService.rejectManualPayment,
  refundManualPayment: paymentIntentService.refundManualPayment,
};
