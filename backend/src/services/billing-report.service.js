const { Types } = require('mongoose');
const {
  Charge,
  Department,
  Encounter,
  InsuranceClaim,
  Invoice,
  Payment,
  PaymentIntent,
  PaymentRefund,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  CHARGE_STATUS,
  INSURANCE_CLAIM_STATUS,
  INVOICE_STATUS,
  PAYMENT_REFUND_STATUS,
  PAYMENT_STATUS,
} = require('../constants/statuses');
const permissionService = require('./permission.service');
const {
  createError,
  getEndOfDay,
  getStartOfDay,
  normalizeString,
  recordAuditLog,
} = require('./core.service');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 24 * 60 * 60 * 1000;

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions);
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function actorId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || null;
}

function assertStaff(actor = {}) {
  if (actor.actorType !== 'staff' && actor.actor_type !== 'staff') {
    throw createError('Chỉ tài khoản nhân sự được xem báo cáo viện phí.', 403);
  }
}

function assertBillingReportPermission(actor = {}, extraPermissions = []) {
  assertStaff(actor);
  const allowed = [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.BILLING_READ,
    ...extraPermissions,
  ];
  if (!hasAnyPermission(actor, allowed)) {
    throw createError('Tài khoản hiện tại không có quyền xem báo cáo viện phí.', 403);
  }
}

function hasGlobalBillingScope(actor = {}) {
  return hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.REPORTS.READ_ALL,
  ]) || !actorDepartmentId(actor);
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(value);
}

function addObjectIdFilter(match, field, value, fieldName = field) {
  if (value) match[field] = toObjectId(value, fieldName);
}

function parseDate(value, fieldName) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeTimezone(timezone) {
  const value = normalizeString(timezone);
  if (!value) return DEFAULT_TIMEZONE;
  return /^[A-Za-z_/-]+$/.test(value) ? value : DEFAULT_TIMEZONE;
}

function normalizeBillingFilters(query = {}, { defaultRangeDays = 30 } = {}) {
  const date = parseDate(query.date, 'date');
  const explicitFrom = parseDate(query.date_from || query.from, 'date_from');
  const explicitTo = parseDate(query.date_to || query.to, 'date_to');
  const now = new Date();
  const dateFrom = date
    ? getStartOfDay(date)
    : explicitFrom
      ? getStartOfDay(explicitFrom)
      : defaultRangeDays
        ? getStartOfDay(addDays(now, -(defaultRangeDays - 1)))
        : null;
  const dateTo = date
    ? getEndOfDay(date)
    : explicitTo
      ? getEndOfDay(explicitTo)
      : defaultRangeDays
        ? getEndOfDay(now)
        : null;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw createError('date_from phải nhỏ hơn hoặc bằng date_to.', 400);
  }
  if (dateFrom && dateTo && (dateTo.getTime() - dateFrom.getTime()) / DAY_MS > 732) {
    throw createError('Khoảng thời gian báo cáo viện phí không được vượt quá 732 ngày.', 400);
  }

  return {
    date_from: dateFrom,
    date_to: dateTo,
    timezone: normalizeTimezone(query.timezone),
    department_id: normalizeString(query.department_id),
    patient_id: normalizeString(query.patient_id),
    payment_method: normalizeString(query.payment_method),
    provider: normalizeString(query.provider || query.payment_provider),
    cashier_id: normalizeString(query.cashier_id || query.received_by),
    status: normalizeString(query.status),
    service_type: normalizeString(query.service_type),
    group_by: normalizeString(query.group_by),
    attribution: normalizeString(query.attribution || 'service_department'),
    include_refunds: query.include_refunds !== 'false',
    compare_previous: query.compare_previous === 'true' || query.compare_previous === true,
  };
}

function serializeFilters(filters = {}) {
  return {
    ...filters,
    date_from: filters.date_from ? filters.date_from.toISOString() : null,
    date_to: filters.date_to ? filters.date_to.toISOString() : null,
  };
}

function applyDateRange(match, field, filters = {}) {
  if (!filters.date_from && !filters.date_to) return;
  match[field] = { ...(match[field] || {}) };
  if (filters.date_from) match[field].$gte = filters.date_from;
  if (filters.date_to) match[field].$lte = filters.date_to;
}

function roundNumber(value) {
  return Number((Number(value || 0) + Number.EPSILON).toFixed(2));
}

function rate(part, total) {
  return total ? Number(((Number(part || 0) / Number(total)) * 100).toFixed(2)) : 0;
}

function dayExpression(field, timezone) {
  return {
    $dateToString: {
      format: '%Y-%m-%d',
      date: `$${field}`,
      timezone,
    },
  };
}

function objectIdKey(value) {
  if (!value) return 'unassigned';
  return String(value);
}

async function hydrateDepartmentRows(rows = []) {
  const ids = rows
    .map((row) => row.department_id || row._id)
    .filter((id) => id && Types.ObjectId.isValid(String(id)))
    .map((id) => new Types.ObjectId(String(id)));
  const departments = ids.length
    ? await Department.find({ _id: { $in: ids } }).select('department_code department_name').lean()
    : [];
  const map = new Map(departments.map((department) => [String(department._id), department]));

  return rows.map((row) => {
    const id = row.department_id || row._id || null;
    const department = id ? map.get(String(id)) : null;
    return {
      ...row,
      department_id: id ? String(id) : null,
      department_code: department?.department_code || row.department_code || null,
      department_name: department?.department_name || row.department_name || (id ? 'Khoa chưa đặt tên' : 'Chưa phân khoa'),
    };
  });
}

async function resolveScopedMatches(filters = {}, actor = {}) {
  const paymentMatch = {};
  const intentMatch = {};
  const invoiceMatch = {};
  const chargeMatch = {};
  const claimMatch = {};
  const refundMatch = {};

  addObjectIdFilter(paymentMatch, 'patient_id', filters.patient_id, 'patient_id');
  addObjectIdFilter(intentMatch, 'patient_id', filters.patient_id, 'patient_id');
  addObjectIdFilter(invoiceMatch, 'patient_id', filters.patient_id, 'patient_id');
  addObjectIdFilter(chargeMatch, 'patient_id', filters.patient_id, 'patient_id');
  addObjectIdFilter(claimMatch, 'patient_id', filters.patient_id, 'patient_id');
  addObjectIdFilter(refundMatch, 'patient_id', filters.patient_id, 'patient_id');

  const requestedDepartmentId = filters.department_id;
  const actorDept = actorDepartmentId(actor);
  const effectiveDepartmentId = hasGlobalBillingScope(actor) ? requestedDepartmentId : actorDept;
  if (!hasGlobalBillingScope(actor) && requestedDepartmentId && String(requestedDepartmentId) !== String(actorDept)) {
    throw createError('Bạn không có quyền xem báo cáo viện phí ngoài khoa.', 403);
  }

  if (effectiveDepartmentId) {
    const encounterIds = (await Encounter.find({ department_id: toObjectId(effectiveDepartmentId, 'department_id') }).select('_id').lean())
      .map((encounter) => encounter._id);
    invoiceMatch.encounter_id = { $in: encounterIds };
    chargeMatch.encounter_id = { $in: encounterIds };
    const invoiceIds = (await Invoice.find({ encounter_id: { $in: encounterIds } }).select('_id').lean())
      .map((invoice) => invoice._id);
    paymentMatch.invoice_id = { $in: invoiceIds };
    intentMatch.invoice_id = { $in: invoiceIds };
    claimMatch.invoice_id = { $in: invoiceIds };
    refundMatch.invoice_id = { $in: invoiceIds };
  }

  return {
    paymentMatch,
    intentMatch,
    invoiceMatch,
    chargeMatch,
    claimMatch,
    refundMatch,
    effectiveDepartmentId: effectiveDepartmentId || null,
  };
}

function flattenStatusRows(rows = [], keyName = 'status') {
  return rows.map((row) => ({
    [keyName]: row._id || 'unknown',
    count: row.count || 0,
    amount: roundNumber(row.amount),
  }));
}

async function getBillingRevenueReport(query = {}, actor = {}) {
  assertBillingReportPermission(actor, [PERMISSION.REPORTS.REVENUE_READ]);
  const filters = normalizeBillingFilters(query);
  const {
    paymentMatch,
    invoiceMatch,
    chargeMatch,
    effectiveDepartmentId,
  } = await resolveScopedMatches(filters, actor);

  paymentMatch.status = PAYMENT_STATUS.COMPLETED;
  invoiceMatch.status = { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID, INVOICE_STATUS.PAID] };
  chargeMatch.status = { $in: [CHARGE_STATUS.POSTED, CHARGE_STATUS.BILLED] };
  applyDateRange(paymentMatch, 'paid_at', filters);
  applyDateRange(invoiceMatch, 'issued_at', filters);
  applyDateRange(chargeMatch, 'charged_at', filters);
  if (filters.payment_method) paymentMatch.payment_method = filters.payment_method;
  if (filters.provider) paymentMatch.$or = [{ payment_provider: filters.provider }, { provider: filters.provider }];
  if (filters.cashier_id) addObjectIdFilter(paymentMatch, 'received_by', filters.cashier_id, 'cashier_id');

  const refundBaseMatch = {
    ...(paymentMatch.invoice_id ? { invoice_id: paymentMatch.invoice_id } : {}),
    ...(paymentMatch.patient_id ? { patient_id: paymentMatch.patient_id } : {}),
  };
  const refundedDate = {};
  const voidedDate = {};
  applyDateRange(refundedDate, 'refunded_at', filters);
  applyDateRange(voidedDate, 'voided_at', filters);

  const [paymentTotals, paymentByMethod, revenueByDay, invoiceTotals, invoiceByStatus, chargeTotals, chargeByDay, revenueByDepartment, revenueByServiceType, refundTotals, topInvoices] = await Promise.all([
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: null, paid_amount: { $sum: '$amount' }, payment_count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: '$payment_method', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: dayExpression('paid_at', filters.timezone), count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $group: { _id: null, issued_invoice_amount: { $sum: '$total_amount' }, outstanding_amount: { $sum: '$balance_due' }, invoice_count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$total_amount' }, balance_due: { $sum: '$balance_due' } } },
      { $sort: { _id: 1 } },
    ]),
    Charge.aggregate([
      { $match: chargeMatch },
      { $group: { _id: null, gross_charges: { $sum: '$total_amount' }, charge_count: { $sum: 1 } } },
    ]),
    Charge.aggregate([
      { $match: chargeMatch },
      { $group: { _id: dayExpression('charged_at', filters.timezone), count: { $sum: 1 }, amount: { $sum: '$total_amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Charge.aggregate([
      { $match: chargeMatch },
      { $lookup: { from: 'service_catalog', localField: 'service_id', foreignField: '_id', as: 'service' } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$service.department_id', count: { $sum: 1 }, amount: { $sum: '$total_amount' } } },
      { $sort: { amount: -1 } },
    ]),
    Charge.aggregate([
      { $match: chargeMatch },
      { $lookup: { from: 'service_catalog', localField: 'service_id', foreignField: '_id', as: 'service' } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$service.service_type', count: { $sum: 1 }, amount: { $sum: '$total_amount' } } },
      { $sort: { amount: -1 } },
    ]),
    Payment.aggregate([
      {
        $match: {
          ...refundBaseMatch,
          $or: [
            { status: PAYMENT_STATUS.REFUNDED, ...(refundedDate.refunded_at ? { refunded_at: refundedDate.refunded_at } : {}) },
            { status: PAYMENT_STATUS.VOIDED, ...(voidedDate.voided_at ? { voided_at: voidedDate.voided_at } : {}) },
          ],
        },
      },
      { $group: { _id: '$status', amount: { $sum: { $ifNull: ['$refund_amount', '$amount'] } }, count: { $sum: 1 } } },
    ]),
    Invoice.find(invoiceMatch)
      .sort({ total_amount: -1, issued_at: -1 })
      .limit(12)
      .populate('patient_id', 'patient_code full_name phone')
      .select('invoice_no patient_id status total_amount paid_amount balance_due issued_at due_at')
      .lean(),
  ]);

  const paymentSummary = paymentTotals[0] || {};
  const invoiceSummary = invoiceTotals[0] || {};
  const chargeSummary = chargeTotals[0] || {};
  const refundMap = Object.fromEntries(refundTotals.map((row) => [row._id, row]));
  const refundAmount = roundNumber(refundMap[PAYMENT_STATUS.REFUNDED]?.amount);
  const voidedAmount = roundNumber(refundMap[PAYMENT_STATUS.VOIDED]?.amount);
  const paidAmount = roundNumber(paymentSummary.paid_amount);
  const issuedAmount = roundNumber(invoiceSummary.issued_invoice_amount);
  const grossCharges = roundNumber(chargeSummary.gross_charges);

  return {
    summary: {
      gross_charges: grossCharges,
      charge_count: chargeSummary.charge_count || 0,
      issued_invoice_amount: issuedAmount,
      invoice_count: invoiceSummary.invoice_count || 0,
      paid_amount: paidAmount,
      payment_count: paymentSummary.payment_count || 0,
      outstanding_amount: roundNumber(invoiceSummary.outstanding_amount),
      refund_amount: refundAmount,
      voided_amount: voidedAmount,
      net_revenue: roundNumber(paidAmount - refundAmount - voidedAmount),
      collection_rate: rate(paidAmount, issuedAmount),
      outstanding_rate: rate(invoiceSummary.outstanding_amount, issuedAmount),
      charge_to_invoice_rate: rate(issuedAmount, grossCharges),
    },
    breakdowns: {
      payment_by_method: paymentByMethod.map((row) => ({ payment_method: row._id || 'unknown', count: row.count, amount: roundNumber(row.amount) })),
      revenue_by_day: revenueByDay.map((row) => ({ date: row._id, count: row.count, paid_amount: roundNumber(row.amount) })),
      charge_by_day: chargeByDay.map((row) => ({ date: row._id, count: row.count, gross_charges: roundNumber(row.amount) })),
      invoice_by_status: invoiceByStatus.map((row) => ({ status: row._id, count: row.count, amount: roundNumber(row.amount), balance_due: roundNumber(row.balance_due) })),
      revenue_by_department: await hydrateDepartmentRows(revenueByDepartment.map((row) => ({ department_id: row._id, count: row.count, amount: roundNumber(row.amount) }))),
      revenue_by_service_type: revenueByServiceType.map((row) => ({ service_type: row._id || 'unknown', count: row.count, amount: roundNumber(row.amount) })),
    },
    top_lists: {
      top_invoices_by_amount: topInvoices,
    },
    filters: {
      ...serializeFilters(filters),
      department_id: effectiveDepartmentId ? String(effectiveDepartmentId) : filters.department_id || null,
    },
  };
}

async function getBillingReceivablesReport(query = {}, actor = {}) {
  assertBillingReportPermission(actor, [PERMISSION.INVOICES.READ, PERMISSION.INVOICES.READ_UNPAID]);
  const filters = normalizeBillingFilters(query, { defaultRangeDays: 0 });
  const { invoiceMatch, effectiveDepartmentId } = await resolveScopedMatches(filters, actor);
  invoiceMatch.status = { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID] };
  invoiceMatch.balance_due = { $gt: 0 };
  if (filters.date_from || filters.date_to) applyDateRange(invoiceMatch, 'issued_at', filters);

  const now = new Date();
  const ageProjection = {
    age_days: { $floor: { $divide: [{ $subtract: [now, { $ifNull: ['$issued_at', '$created_at'] }] }, DAY_MS] } },
    overdue_days: {
      $cond: [
        { $and: ['$due_at', { $lt: ['$due_at', now] }] },
        { $floor: { $divide: [{ $subtract: [now, '$due_at'] }, DAY_MS] } },
        0,
      ],
    },
  };

  const [summaryRows, agingRows, statusRows, departmentRows, patientRows, items] = await Promise.all([
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $addFields: ageProjection },
      {
        $group: {
          _id: null,
          total_outstanding: { $sum: '$balance_due' },
          invoice_count: { $sum: 1 },
          overdue_amount: { $sum: { $cond: [{ $gt: ['$overdue_days', 0] }, '$balance_due', 0] } },
          overdue_invoice_count: { $sum: { $cond: [{ $gt: ['$overdue_days', 0] }, 1, 0] } },
          total_invoice_amount: { $sum: '$total_amount' },
          total_paid_amount: { $sum: '$paid_amount' },
          average_days_outstanding: { $avg: '$age_days' },
          insurance_amount: { $sum: '$insurance_amount' },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $addFields: ageProjection },
      {
        $addFields: {
          aging_bucket: {
            $switch: {
              branches: [
                { case: { $lte: ['$age_days', 7] }, then: '0-7' },
                { case: { $lte: ['$age_days', 15] }, then: '8-15' },
                { case: { $lte: ['$age_days', 30] }, then: '16-30' },
                { case: { $lte: ['$age_days', 60] }, then: '31-60' },
              ],
              default: '>60',
            },
          },
        },
      },
      { $group: { _id: '$aging_bucket', amount: { $sum: '$balance_due' }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $group: { _id: '$status', amount: { $sum: '$balance_due' }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $lookup: { from: 'encounters', localField: 'encounter_id', foreignField: '_id', as: 'encounter' } },
      { $unwind: { path: '$encounter', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$encounter.department_id', amount: { $sum: '$balance_due' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $group: { _id: '$patient_id', amount: { $sum: '$balance_due' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'patients', localField: '_id', foreignField: '_id', as: 'patient' } },
      { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
    ]),
    Invoice.find(invoiceMatch)
      .sort({ due_at: 1, issued_at: -1, created_at: -1 })
      .limit(80)
      .populate('patient_id', 'patient_code full_name phone')
      .populate({ path: 'encounter_id', select: 'encounter_code department_id', populate: { path: 'department_id', select: 'department_code department_name' } })
      .select('invoice_no patient_id encounter_id issued_at due_at status total_amount paid_amount balance_due insurance_amount')
      .lean(),
  ]);

  const summary = summaryRows[0] || {};
  return {
    summary: {
      total_outstanding: roundNumber(summary.total_outstanding),
      invoice_count: summary.invoice_count || 0,
      overdue_amount: roundNumber(summary.overdue_amount),
      overdue_invoice_count: summary.overdue_invoice_count || 0,
      average_days_outstanding: roundNumber(summary.average_days_outstanding),
      collection_rate: rate(summary.total_paid_amount, summary.total_invoice_amount),
      insurance_receivable: roundNumber(summary.insurance_amount),
      patient_receivable: roundNumber(Number(summary.total_outstanding || 0) - Number(summary.insurance_amount || 0)),
    },
    aging: ['0-7', '8-15', '16-30', '31-60', '>60'].map((bucket) => {
      const row = agingRows.find((item) => item._id === bucket) || {};
      return { bucket, amount: roundNumber(row.amount), count: row.count || 0 };
    }),
    breakdowns: {
      by_status: flattenStatusRows(statusRows),
      by_department: await hydrateDepartmentRows(departmentRows.map((row) => ({ department_id: row._id, amount: roundNumber(row.amount), count: row.count }))),
      top_patients: patientRows.map((row) => ({
        patient_id: row._id ? String(row._id) : null,
        patient_code: row.patient?.patient_code || null,
        patient_name: row.patient?.full_name || 'Không rõ',
        count: row.count,
        amount: roundNumber(row.amount),
      })),
    },
    items: items.map((item) => {
      const issuedAt = item.issued_at || item.created_at;
      const dueAt = item.due_at;
      return {
        ...item,
        age_days: issuedAt ? Math.max(0, Math.floor((now - new Date(issuedAt)) / DAY_MS)) : 0,
        overdue_days: dueAt && new Date(dueAt) < now ? Math.floor((now - new Date(dueAt)) / DAY_MS) : 0,
      };
    }),
    filters: {
      ...serializeFilters(filters),
      department_id: effectiveDepartmentId ? String(effectiveDepartmentId) : filters.department_id || null,
    },
  };
}

async function getBillingPaymentMethodsReport(query = {}, actor = {}) {
  assertBillingReportPermission(actor, [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENT_INTENTS.READ]);
  const filters = normalizeBillingFilters(query);
  const { paymentMatch, intentMatch, effectiveDepartmentId } = await resolveScopedMatches(filters, actor);
  applyDateRange(paymentMatch, 'paid_at', filters);
  applyDateRange(intentMatch, 'created_at', filters);
  if (filters.payment_method) paymentMatch.payment_method = filters.payment_method;
  if (filters.provider) {
    paymentMatch.$or = [{ payment_provider: filters.provider }, { provider: filters.provider }];
    intentMatch.provider = filters.provider;
  }
  if (filters.cashier_id) addObjectIdFilter(paymentMatch, 'received_by', filters.cashier_id, 'cashier_id');

  const [summaryRows, methodRows, paymentDayRows, funnelRows, providerRows, reviewItems] = await Promise.all([
    Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: null,
          total_amount: { $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.COMPLETED] }, '$amount', 0] } },
          total_count: { $sum: 1 },
          completed_count: { $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.COMPLETED] }, 1, 0] } },
          failed_count: { $sum: { $cond: [{ $in: ['$status', [PAYMENT_STATUS.FAILED, PAYMENT_STATUS.REJECTED]] }, 1, 0] } },
          refunded_amount: { $sum: { $cond: [{ $in: ['$status', [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.REFUNDED_MANUAL]] }, { $ifNull: ['$refund_amount', '$amount'] }, 0] } },
          voided_amount: { $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.VOIDED] }, '$amount', 0] } },
          avg_confirmation_minutes: {
            $avg: {
              $cond: [
                { $and: ['$confirmed_at', { $ifNull: ['$paid_at', '$created_at'] }] },
                { $divide: [{ $subtract: ['$confirmed_at', { $ifNull: ['$paid_at', '$created_at'] }] }, 60000] },
                null,
              ],
            },
          },
        },
      },
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: { payment_method: '$payment_method', provider: { $ifNull: ['$payment_provider', '$provider'] } },
          payment_count: { $sum: 1 },
          completed_count: { $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.COMPLETED] }, 1, 0] } },
          completed_amount: { $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.COMPLETED] }, '$amount', 0] } },
          pending_count: { $sum: { $cond: [{ $in: ['$status', [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PENDING_MANUAL_CONFIRMATION, PAYMENT_STATUS.SUBMITTED_RECEIPT, PAYMENT_STATUS.CONFIRMED]] }, 1, 0] } },
          failed_count: { $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.FAILED] }, 1, 0] } },
          rejected_count: { $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.REJECTED] }, 1, 0] } },
          refunded_amount: { $sum: { $cond: [{ $in: ['$status', [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.REFUNDED_MANUAL]] }, { $ifNull: ['$refund_amount', '$amount'] }, 0] } },
          voided_amount: { $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.VOIDED] }, '$amount', 0] } },
          avg_confirmation_minutes: {
            $avg: {
              $cond: [
                { $and: ['$confirmed_at', { $ifNull: ['$paid_at', '$created_at'] }] },
                { $divide: [{ $subtract: ['$confirmed_at', { $ifNull: ['$paid_at', '$created_at'] }] }, 60000] },
                null,
              ],
            },
          },
        },
      },
      { $sort: { completed_amount: -1 } },
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: { date: dayExpression('paid_at', filters.timezone), payment_method: '$payment_method' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.date': 1 } },
    ]),
    PaymentIntent.aggregate([
      { $match: intentMatch },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    PaymentIntent.aggregate([
      { $match: intentMatch },
      { $group: { _id: { provider: '$provider', status: '$status' }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { '_id.provider': 1, count: -1 } },
    ]),
    PaymentIntent.find({
      ...intentMatch,
      status: { $in: ['pending_manual_confirmation', 'submitted_receipt', 'manual_review', 'rejected', 'failed', 'expired'] },
    })
      .sort({ updated_at: -1, created_at: -1 })
      .limit(40)
      .populate('invoice_id', 'invoice_no total_amount balance_due status')
      .populate('patient_id', 'patient_code full_name phone')
      .select('intent_code invoice_id patient_id provider method status amount created_at expires_at confirmed_at manual_review_reason manual_reject_reason transaction_reference')
      .lean(),
  ]);

  const summary = summaryRows[0] || {};
  const funnel = Object.fromEntries(funnelRows.map((row) => [row._id || 'unknown', { count: row.count, amount: roundNumber(row.amount) }]));
  return {
    summary: {
      total_collected: roundNumber(summary.total_amount),
      payment_count: summary.total_count || 0,
      completed_count: summary.completed_count || 0,
      failed_rejected_count: summary.failed_count || 0,
      refunded_amount: roundNumber(summary.refunded_amount),
      voided_amount: roundNumber(summary.voided_amount),
      success_rate: rate(summary.completed_count, summary.total_count),
      avg_confirmation_minutes: roundNumber(summary.avg_confirmation_minutes),
      manual_review_count: reviewItems.filter((item) => ['manual_review', 'submitted_receipt', 'pending_manual_confirmation'].includes(item.status)).length,
    },
    methods: methodRows.map((row) => ({
      payment_method: row._id.payment_method || 'unknown',
      provider: row._id.provider || 'unknown',
      payment_count: row.payment_count,
      completed_count: row.completed_count,
      completed_amount: roundNumber(row.completed_amount),
      pending_count: row.pending_count,
      failed_count: row.failed_count,
      rejected_count: row.rejected_count,
      refunded_amount: roundNumber(row.refunded_amount),
      voided_amount: roundNumber(row.voided_amount),
      success_rate: rate(row.completed_count, row.payment_count),
      avg_confirmation_minutes: roundNumber(row.avg_confirmation_minutes),
    })),
    funnel,
    breakdowns: {
      provider_status: providerRows.map((row) => ({ provider: row._id.provider || 'unknown', status: row._id.status || 'unknown', count: row.count, amount: roundNumber(row.amount) })),
      time_series: paymentDayRows.map((row) => ({ date: row._id.date, payment_method: row._id.payment_method || 'unknown', count: row.count, amount: roundNumber(row.amount) })),
    },
    items: reviewItems,
    filters: {
      ...serializeFilters(filters),
      department_id: effectiveDepartmentId ? String(effectiveDepartmentId) : filters.department_id || null,
    },
  };
}

async function getBillingDepartmentReport(query = {}, actor = {}) {
  assertBillingReportPermission(actor, [PERMISSION.REPORTS.REVENUE_READ, PERMISSION.INVOICES.READ, PERMISSION.PAYMENTS.READ]);
  const filters = normalizeBillingFilters(query);
  const { paymentMatch, invoiceMatch, chargeMatch, effectiveDepartmentId } = await resolveScopedMatches(filters, actor);
  paymentMatch.status = PAYMENT_STATUS.COMPLETED;
  invoiceMatch.status = { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID, INVOICE_STATUS.PAID] };
  chargeMatch.status = { $in: [CHARGE_STATUS.POSTED, CHARGE_STATUS.BILLED] };
  applyDateRange(paymentMatch, 'paid_at', filters);
  applyDateRange(invoiceMatch, 'issued_at', filters);
  applyDateRange(chargeMatch, 'charged_at', filters);

  const [chargeRows, invoiceRows, paymentRows, refundRows] = await Promise.all([
    Charge.aggregate([
      { $match: chargeMatch },
      { $lookup: { from: 'service_catalog', localField: 'service_id', foreignField: '_id', as: 'service' } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$service.department_id', charge_count: { $sum: 1 }, gross_charges: { $sum: '$total_amount' } } },
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $lookup: { from: 'encounters', localField: 'encounter_id', foreignField: '_id', as: 'encounter' } },
      { $unwind: { path: '$encounter', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$encounter.department_id', invoice_count: { $sum: 1 }, issued_amount: { $sum: '$total_amount' }, outstanding_amount: { $sum: '$balance_due' } } },
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $lookup: { from: 'invoices', localField: 'invoice_id', foreignField: '_id', as: 'invoice' } },
      { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'encounters', localField: 'invoice.encounter_id', foreignField: '_id', as: 'encounter' } },
      { $unwind: { path: '$encounter', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$encounter.department_id', payment_count: { $sum: 1 }, paid_amount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      {
        $match: {
          ...(paymentMatch.invoice_id ? { invoice_id: paymentMatch.invoice_id } : {}),
          status: { $in: [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.VOIDED] },
        },
      },
      { $lookup: { from: 'invoices', localField: 'invoice_id', foreignField: '_id', as: 'invoice' } },
      { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'encounters', localField: 'invoice.encounter_id', foreignField: '_id', as: 'encounter' } },
      { $unwind: { path: '$encounter', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$encounter.department_id', refund_void_amount: { $sum: '$amount' }, refund_void_count: { $sum: 1 } } },
    ]),
  ]);

  const map = new Map();
  function mergeRows(rows, mapper) {
    rows.forEach((row) => {
      const key = objectIdKey(row._id);
      map.set(key, { ...(map.get(key) || { department_id: row._id || null }), ...mapper(row) });
    });
  }
  mergeRows(chargeRows, (row) => ({ charge_count: row.charge_count, gross_charges: roundNumber(row.gross_charges) }));
  mergeRows(invoiceRows, (row) => ({ invoice_count: row.invoice_count, issued_amount: roundNumber(row.issued_amount), outstanding_amount: roundNumber(row.outstanding_amount) }));
  mergeRows(paymentRows, (row) => ({ payment_count: row.payment_count, paid_amount: roundNumber(row.paid_amount) }));
  mergeRows(refundRows, (row) => ({ refund_void_amount: roundNumber(row.refund_void_amount), refund_void_count: row.refund_void_count }));

  const departments = (await hydrateDepartmentRows([...map.values()].map((row) => ({
    department_id: row.department_id,
    charge_count: row.charge_count || 0,
    gross_charges: row.gross_charges || 0,
    invoice_count: row.invoice_count || 0,
    issued_amount: row.issued_amount || 0,
    payment_count: row.payment_count || 0,
    paid_amount: row.paid_amount || 0,
    outstanding_amount: row.outstanding_amount || 0,
    refund_void_amount: row.refund_void_amount || 0,
    refund_void_count: row.refund_void_count || 0,
    collection_rate: rate(row.paid_amount, row.issued_amount),
    avg_invoice_value: row.invoice_count ? roundNumber(row.issued_amount / row.invoice_count) : 0,
  })))).sort((a, b) => Number(b.paid_amount || b.gross_charges || 0) - Number(a.paid_amount || a.gross_charges || 0));

  const totals = departments.reduce((acc, row) => ({
    gross_charges: acc.gross_charges + Number(row.gross_charges || 0),
    issued_amount: acc.issued_amount + Number(row.issued_amount || 0),
    paid_amount: acc.paid_amount + Number(row.paid_amount || 0),
    outstanding_amount: acc.outstanding_amount + Number(row.outstanding_amount || 0),
    refund_void_amount: acc.refund_void_amount + Number(row.refund_void_amount || 0),
    charge_count: acc.charge_count + Number(row.charge_count || 0),
    invoice_count: acc.invoice_count + Number(row.invoice_count || 0),
    payment_count: acc.payment_count + Number(row.payment_count || 0),
  }), { gross_charges: 0, issued_amount: 0, paid_amount: 0, outstanding_amount: 0, refund_void_amount: 0, charge_count: 0, invoice_count: 0, payment_count: 0 });

  return {
    summary: {
      ...totals,
      department_count: departments.length,
      collection_rate: rate(totals.paid_amount, totals.issued_amount),
      top_department: departments[0] || null,
      highest_outstanding_department: [...departments].sort((a, b) => b.outstanding_amount - a.outstanding_amount)[0] || null,
    },
    departments,
    filters: {
      ...serializeFilters(filters),
      department_id: effectiveDepartmentId ? String(effectiveDepartmentId) : filters.department_id || null,
    },
  };
}

async function getBillingRefundVoidReport(query = {}, actor = {}) {
  assertBillingReportPermission(actor, [PERMISSION.PAYMENTS.READ, PERMISSION.PAYMENTS.REFUND, PERMISSION.INVOICES.READ, PERMISSION.CHARGES.READ]);
  const filters = normalizeBillingFilters(query);
  const { paymentMatch, invoiceMatch, chargeMatch, refundMatch, effectiveDepartmentId } = await resolveScopedMatches(filters, actor);

  applyDateRange(refundMatch, 'requested_at', filters);
  const voidPaymentMatch = { ...paymentMatch, status: PAYMENT_STATUS.VOIDED };
  const refundedPaymentMatch = { ...paymentMatch, status: { $in: [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.REFUNDED_MANUAL] } };
  const voidInvoiceMatch = { ...invoiceMatch, status: { $in: [INVOICE_STATUS.VOIDED, INVOICE_STATUS.CANCELLED, INVOICE_STATUS.REFUNDED] } };
  const voidChargeMatch = { ...chargeMatch, status: { $in: [CHARGE_STATUS.VOIDED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.REFUNDED] } };
  applyDateRange(voidPaymentMatch, 'voided_at', filters);
  applyDateRange(refundedPaymentMatch, 'refunded_at', filters);
  applyDateRange(voidInvoiceMatch, 'voided_at', filters);
  applyDateRange(voidChargeMatch, 'voided_at', filters);

  const [refundSummary, refundByStatus, refundByReason, riskRows, refunds, voidPayments, refundedPayments, voidInvoices, voidCharges] = await Promise.all([
    PaymentRefund.aggregate([
      { $match: refundMatch },
      { $group: { _id: null, count: { $sum: 1 }, requested_amount: { $sum: '$requested_amount' }, approved_amount: { $sum: '$approved_amount' }, processed_amount: { $sum: '$processed_amount' }, avg_risk_score: { $avg: '$risk_score' } } },
    ]),
    PaymentRefund.aggregate([
      { $match: refundMatch },
      { $group: { _id: '$refund_status', count: { $sum: 1 }, amount: { $sum: '$requested_amount' } } },
      { $sort: { count: -1 } },
    ]),
    PaymentRefund.aggregate([
      { $match: refundMatch },
      { $group: { _id: '$reason_category', count: { $sum: 1 }, amount: { $sum: '$requested_amount' } } },
      { $sort: { amount: -1 } },
      { $limit: 12 },
    ]),
    PaymentRefund.aggregate([
      { $match: refundMatch },
      { $unwind: { path: '$risk_flags', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$risk_flags', count: { $sum: 1 }, amount: { $sum: '$requested_amount' } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
    PaymentRefund.find(refundMatch)
      .sort({ requested_at: -1, created_at: -1 })
      .limit(60)
      .populate('payment_id', 'payment_no amount payment_method payment_provider status')
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
      .populate('patient_id', 'patient_code full_name phone')
      .lean(),
    Payment.find(voidPaymentMatch).sort({ voided_at: -1, created_at: -1 }).limit(30).populate('invoice_id', 'invoice_no').populate('patient_id', 'patient_code full_name').lean(),
    Payment.find(refundedPaymentMatch).sort({ refunded_at: -1, created_at: -1 }).limit(30).populate('invoice_id', 'invoice_no').populate('patient_id', 'patient_code full_name').lean(),
    Invoice.find(voidInvoiceMatch).sort({ voided_at: -1, created_at: -1 }).limit(30).populate('patient_id', 'patient_code full_name').lean(),
    Charge.find(voidChargeMatch).sort({ voided_at: -1, created_at: -1 }).limit(30).populate('patient_id', 'patient_code full_name').populate('invoice_id', 'invoice_no').lean(),
  ]);

  const refund = refundSummary[0] || {};
  const voidPaymentAmount = voidPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const refundedPaymentAmount = refundedPayments.reduce((sum, item) => sum + Number(item.refund_amount || item.amount || 0), 0);
  const voidInvoiceAmount = voidInvoices.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  const voidChargeAmount = voidCharges.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  const pendingStatuses = [PAYMENT_REFUND_STATUS.REQUESTED, PAYMENT_REFUND_STATUS.UNDER_REVIEW, PAYMENT_REFUND_STATUS.APPROVED, PAYMENT_REFUND_STATUS.PROCESSING];

  return {
    summary: {
      refund_request_count: refund.count || 0,
      requested_amount: roundNumber(refund.requested_amount),
      approved_amount: roundNumber(refund.approved_amount),
      processed_amount: roundNumber(refund.processed_amount),
      pending_refund_count: refunds.filter((item) => pendingStatuses.includes(item.refund_status)).length,
      voided_payment_count: voidPayments.length,
      voided_payment_amount: roundNumber(voidPaymentAmount),
      refunded_payment_count: refundedPayments.length,
      refunded_payment_amount: roundNumber(refundedPaymentAmount),
      voided_invoice_count: voidInvoices.length,
      voided_invoice_amount: roundNumber(voidInvoiceAmount),
      voided_charge_count: voidCharges.length,
      voided_charge_amount: roundNumber(voidChargeAmount),
      avg_risk_score: roundNumber(refund.avg_risk_score),
    },
    breakdowns: {
      refund_by_status: flattenStatusRows(refundByStatus, 'refund_status'),
      refund_by_reason: refundByReason.map((row) => ({ reason_category: row._id || 'unknown', count: row.count, amount: roundNumber(row.amount) })),
      risk_flags: riskRows.filter((row) => row._id).map((row) => ({ risk_flag: row._id, count: row.count, amount: roundNumber(row.amount) })),
    },
    items: {
      refunds,
      void_payments: voidPayments,
      refunded_payments: refundedPayments,
      void_invoices: voidInvoices,
      void_charges: voidCharges,
    },
    filters: {
      ...serializeFilters(filters),
      department_id: effectiveDepartmentId ? String(effectiveDepartmentId) : filters.department_id || null,
    },
  };
}

async function getBillingInsuranceReport(query = {}, actor = {}) {
  assertBillingReportPermission(actor, [PERMISSION.REPORTS.INSURANCE_READ, PERMISSION.INSURANCE_CLAIMS.READ]);
  const filters = normalizeBillingFilters(query);
  const { claimMatch, effectiveDepartmentId } = await resolveScopedMatches(filters, actor);
  applyDateRange(claimMatch, 'submitted_at', filters);
  if (filters.status) claimMatch.status = { $in: filters.status.split(',').map((item) => item.trim()).filter(Boolean) };
  if (query.has_outstanding === 'true') claimMatch.$expr = { $gt: ['$approved_amount', '$paid_amount'] };
  if (query.payer_name || query.payer_code) {
    const policyQuery = {};
    if (query.payer_name) policyQuery.payer_name = { $regex: String(query.payer_name).trim(), $options: 'i' };
    if (query.payer_code) policyQuery.payer_code = String(query.payer_code).trim();
    const policyIds = (await require('../models').InsurancePolicy.find({ ...policyQuery, is_deleted: false }).select('_id').limit(1000).lean()).map((policy) => policy._id);
    claimMatch.policy_id = { $in: policyIds };
  }

  const now = new Date();
  const [summaryRows, statusRows, payerRows, dayRows, agingRows, departmentRows, items] = await Promise.all([
    InsuranceClaim.aggregate([
      { $match: claimMatch },
      {
        $group: {
          _id: null,
          claim_count: { $sum: 1 },
          submitted_amount: { $sum: '$submitted_amount' },
          approved_amount: { $sum: '$approved_amount' },
          paid_amount: { $sum: '$paid_amount' },
          approved_count: { $sum: { $cond: [{ $in: ['$status', [INSURANCE_CLAIM_STATUS.APPROVED, INSURANCE_CLAIM_STATUS.PARTIALLY_APPROVED, INSURANCE_CLAIM_STATUS.SETTLED]] }, 1, 0] } },
          rejected_count: { $sum: { $cond: [{ $eq: ['$status', INSURANCE_CLAIM_STATUS.REJECTED] }, 1, 0] } },
          settled_count: { $sum: { $cond: [{ $eq: ['$status', INSURANCE_CLAIM_STATUS.SETTLED] }, 1, 0] } },
          avg_settlement_days: {
            $avg: {
              $cond: [
                { $and: ['$submitted_at', '$settled_at'] },
                { $divide: [{ $subtract: ['$settled_at', '$submitted_at'] }, DAY_MS] },
                null,
              ],
            },
          },
        },
      },
    ]),
    InsuranceClaim.aggregate([{ $match: claimMatch }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$submitted_amount' } } }]),
    InsuranceClaim.aggregate([
      { $match: claimMatch },
      { $lookup: { from: 'insurance_policies', localField: 'policy_id', foreignField: '_id', as: 'policy' } },
      { $unwind: { path: '$policy', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$policy.payer_name', count: { $sum: 1 }, submitted_amount: { $sum: '$submitted_amount' }, approved_amount: { $sum: '$approved_amount' }, paid_amount: { $sum: '$paid_amount' } } },
      { $sort: { submitted_amount: -1 } },
      { $limit: 12 },
    ]),
    InsuranceClaim.aggregate([
      { $match: claimMatch },
      { $group: { _id: dayExpression('submitted_at', filters.timezone), count: { $sum: 1 }, submitted_amount: { $sum: '$submitted_amount' }, approved_amount: { $sum: '$approved_amount' }, paid_amount: { $sum: '$paid_amount' } } },
      { $sort: { _id: 1 } },
    ]),
    InsuranceClaim.aggregate([
      { $match: claimMatch },
      { $addFields: { age_days: { $floor: { $divide: [{ $subtract: [now, { $ifNull: ['$submitted_at', '$created_at'] }] }, DAY_MS] } } } },
      {
        $addFields: {
          aging_bucket: {
            $switch: {
              branches: [
                { case: { $lte: ['$age_days', 7] }, then: '0-7' },
                { case: { $lte: ['$age_days', 15] }, then: '8-15' },
                { case: { $lte: ['$age_days', 30] }, then: '16-30' },
                { case: { $lte: ['$age_days', 60] }, then: '31-60' },
              ],
              default: '>60',
            },
          },
        },
      },
      { $group: { _id: '$aging_bucket', count: { $sum: 1 }, amount: { $sum: '$submitted_amount' } } },
    ]),
    InsuranceClaim.aggregate([
      { $match: claimMatch },
      { $lookup: { from: 'invoices', localField: 'invoice_id', foreignField: '_id', as: 'invoice' } },
      { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'encounters', localField: 'invoice.encounter_id', foreignField: '_id', as: 'encounter' } },
      { $unwind: { path: '$encounter', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$encounter.department_id', count: { $sum: 1 }, amount: { $sum: '$submitted_amount' } } },
      { $sort: { amount: -1 } },
    ]),
    InsuranceClaim.find(claimMatch)
      .sort({ submitted_at: -1, created_at: -1 })
      .limit(80)
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at')
      .populate('policy_id', 'payer_name payer_code policy_no member_no coverage_percent')
      .populate('patient_id', 'patient_code full_name phone')
      .lean(),
  ]);

  const summary = summaryRows[0] || {};
  return {
    summary: {
      claim_count: summary.claim_count || 0,
      submitted_amount: roundNumber(summary.submitted_amount),
      approved_amount: roundNumber(summary.approved_amount),
      paid_amount: roundNumber(summary.paid_amount),
      insurance_receivable: roundNumber(Number(summary.approved_amount || 0) - Number(summary.paid_amount || 0)),
      approval_rate: rate(summary.approved_count, summary.claim_count),
      rejection_rate: rate(summary.rejected_count, summary.claim_count),
      settlement_rate: rate(summary.settled_count, summary.claim_count),
      average_settlement_days: roundNumber(summary.avg_settlement_days),
    },
    breakdowns: {
      by_status: flattenStatusRows(statusRows),
      by_payer: payerRows.map((row) => ({ payer_name: row._id || 'Không rõ', count: row.count, submitted_amount: roundNumber(row.submitted_amount), approved_amount: roundNumber(row.approved_amount), paid_amount: roundNumber(row.paid_amount) })),
      by_day: dayRows.map((row) => ({ date: row._id, count: row.count, submitted_amount: roundNumber(row.submitted_amount), approved_amount: roundNumber(row.approved_amount), paid_amount: roundNumber(row.paid_amount) })),
      aging: ['0-7', '8-15', '16-30', '31-60', '>60'].map((bucket) => {
        const row = agingRows.find((item) => item._id === bucket) || {};
        return { bucket, count: row.count || 0, amount: roundNumber(row.amount) };
      }),
      by_department: await hydrateDepartmentRows(departmentRows.map((row) => ({ department_id: row._id, count: row.count, amount: roundNumber(row.amount) }))),
    },
    items,
    filters: {
      ...serializeFilters(filters),
      department_id: effectiveDepartmentId ? String(effectiveDepartmentId) : filters.department_id || null,
    },
  };
}

async function getBillingSummaryReport(query = {}, actor = {}) {
  assertBillingReportPermission(actor, [PERMISSION.REPORTS.REVENUE_READ, PERMISSION.PAYMENTS.READ, PERMISSION.INVOICES.READ]);
  const filters = normalizeBillingFilters(query);
  const queryWithRange = {
    ...query,
    date_from: filters.date_from?.toISOString(),
    date_to: filters.date_to?.toISOString(),
  };
  const [revenue, receivables, paymentMethods, refundsVoids, insurance] = await Promise.all([
    getBillingRevenueReport(queryWithRange, actor),
    getBillingReceivablesReport({ ...query, date_from: undefined, date_to: undefined }, actor),
    getBillingPaymentMethodsReport(queryWithRange, actor),
    getBillingRefundVoidReport(queryWithRange, actor),
    getBillingInsuranceReport(queryWithRange, actor).catch(() => ({ summary: {}, breakdowns: {}, items: [] })),
  ]);

  const alerts = [
    receivables.summary.overdue_amount > 0 ? { severity: 'danger', title: 'Công nợ quá hạn', value: receivables.summary.overdue_amount, action: 'open_receivables' } : null,
    paymentMethods.summary.failed_rejected_count > 0 ? { severity: 'warning', title: 'Thanh toán lỗi/từ chối', value: paymentMethods.summary.failed_rejected_count, action: 'open_payment_methods' } : null,
    refundsVoids.summary.pending_refund_count > 0 ? { severity: 'warning', title: 'Refund chờ xử lý', value: refundsVoids.summary.pending_refund_count, action: 'open_refunds' } : null,
    insurance.summary.insurance_receivable > 0 ? { severity: 'info', title: 'Bảo hiểm chưa settle', value: insurance.summary.insurance_receivable, action: 'open_insurance' } : null,
  ].filter(Boolean);

  return {
    cards: [
      { key: 'gross_charges', label: 'Charge phát sinh', value: revenue.summary.gross_charges, type: 'money' },
      { key: 'issued_invoice_amount', label: 'Hóa đơn phát hành', value: revenue.summary.issued_invoice_amount, type: 'money' },
      { key: 'paid_amount', label: 'Thực thu', value: revenue.summary.paid_amount, type: 'money' },
      { key: 'net_revenue', label: 'Net revenue', value: revenue.summary.net_revenue, type: 'money' },
      { key: 'outstanding_amount', label: 'Công nợ', value: receivables.summary.total_outstanding, type: 'money' },
      { key: 'insurance_receivable', label: 'Phải thu bảo hiểm', value: insurance.summary.insurance_receivable || 0, type: 'money' },
      { key: 'collection_rate', label: 'Tỷ lệ thu', value: revenue.summary.collection_rate, type: 'percent' },
      { key: 'manual_review_count', label: 'Manual review', value: paymentMethods.summary.manual_review_count, type: 'number' },
    ],
    alerts,
    trends: {
      revenue_by_day: revenue.breakdowns.revenue_by_day,
      payment_by_method: revenue.breakdowns.payment_by_method,
      receivable_aging: receivables.aging,
      claim_by_status: insurance.breakdowns.by_status || [],
    },
    pending_actions: [
      { key: 'overdue_invoices', label: 'Invoice quá hạn cần follow-up', count: receivables.summary.overdue_invoice_count },
      { key: 'manual_payments', label: 'Giao dịch cần rà soát', count: paymentMethods.summary.manual_review_count },
      { key: 'refund_requests', label: 'Yêu cầu refund chưa xong', count: refundsVoids.summary.pending_refund_count },
      { key: 'insurance_claims', label: 'Claim bảo hiểm chưa settle', count: insurance.summary.claim_count || 0 },
    ],
    linked_reports: { revenue, receivables, paymentMethods, refundsVoids, insurance },
    filters: serializeFilters(filters),
  };
}

async function getBillingDrilldownReport(query = {}, actor = {}) {
  assertBillingReportPermission(actor, [PERMISSION.REPORTS.BILLING_READ, PERMISSION.PAYMENTS.READ, PERMISSION.INVOICES.READ]);
  const filters = normalizeBillingFilters(query);
  const scoped = await resolveScopedMatches(filters, actor);
  const metric = normalizeString(query.metric || 'paid_amount');
  const limit = Math.min(Math.max(Number(query.limit || 80), 1), 200);
  let items = [];
  if (metric === 'paid_amount') {
    const match = { ...scoped.paymentMatch, status: PAYMENT_STATUS.COMPLETED };
    applyDateRange(match, 'paid_at', filters);
    items = await Payment.find(match).sort({ paid_at: -1, created_at: -1 }).limit(limit).populate('invoice_id', 'invoice_no status total_amount balance_due').populate('patient_id', 'patient_code full_name phone').lean();
  } else if (metric === 'outstanding') {
    const match = { ...scoped.invoiceMatch, status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID] }, balance_due: { $gt: 0 } };
    items = await Invoice.find(match).sort({ due_at: 1, issued_at: -1 }).limit(limit).populate('patient_id', 'patient_code full_name phone').lean();
  } else if (metric === 'refund' || metric === 'void') {
    const match = metric === 'refund'
      ? { ...scoped.refundMatch }
      : { ...scoped.paymentMatch, status: PAYMENT_STATUS.VOIDED };
    items = metric === 'refund'
      ? await PaymentRefund.find(match).sort({ requested_at: -1, created_at: -1 }).limit(limit).populate('payment_id', 'payment_no amount payment_method').populate('invoice_id', 'invoice_no').populate('patient_id', 'patient_code full_name').lean()
      : await Payment.find(match).sort({ voided_at: -1, created_at: -1 }).limit(limit).populate('invoice_id', 'invoice_no').populate('patient_id', 'patient_code full_name').lean();
  } else if (metric === 'claim') {
    const match = { ...scoped.claimMatch };
    applyDateRange(match, 'submitted_at', filters);
    items = await InsuranceClaim.find(match).sort({ submitted_at: -1, created_at: -1 }).limit(limit).populate('invoice_id', 'invoice_no').populate('policy_id', 'payer_name policy_no').populate('patient_id', 'patient_code full_name').lean();
  } else {
    const match = { ...scoped.chargeMatch };
    applyDateRange(match, 'charged_at', filters);
    items = await Charge.find(match).sort({ charged_at: -1, created_at: -1 }).limit(limit).populate('invoice_id', 'invoice_no').populate('patient_id', 'patient_code full_name').populate('service_id', 'service_code service_name service_type').lean();
  }
  return { metric, items, filters: serializeFilters(filters) };
}

const BILLING_REPORT_HANDLERS = {
  summary: getBillingSummaryReport,
  revenue: getBillingRevenueReport,
  receivables: getBillingReceivablesReport,
  debt: getBillingReceivablesReport,
  payment_methods: getBillingPaymentMethodsReport,
  'payment-methods': getBillingPaymentMethodsReport,
  departments: getBillingDepartmentReport,
  'by-department': getBillingDepartmentReport,
  refunds_voids: getBillingRefundVoidReport,
  'refunds-voids': getBillingRefundVoidReport,
  insurance: getBillingInsuranceReport,
  drilldown: getBillingDrilldownReport,
};

function flattenForCsv(section, value) {
  if (!Array.isArray(value)) return [];
  const keys = [...new Set(value.flatMap((row) => Object.keys(row || {})))];
  return [
    ['section', ...keys],
    ...value.map((row) => [section, ...keys.map((key) => {
      const cell = row?.[key];
      if (cell && typeof cell === 'object') return JSON.stringify(cell);
      return cell ?? '';
    })]),
  ];
}

function reportToCsv(report = {}) {
  const rows = [['section', 'key', 'value']];
  Object.entries(report.summary || {}).forEach(([key, value]) => rows.push(['summary', key, value]));
  Object.entries(report.cards || {}).forEach(([key, value]) => rows.push(['cards', key, JSON.stringify(value)]));
  Object.entries(report.breakdowns || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      rows.push([]);
      rows.push(...flattenForCsv(`breakdown.${key}`, value));
    } else {
      rows.push(['breakdown', key, JSON.stringify(value)]);
    }
  });
  ['aging', 'departments', 'methods', 'items'].forEach((key) => {
    const value = report[key];
    if (Array.isArray(value)) {
      rows.push([]);
      rows.push(...flattenForCsv(key, value));
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, childValue]) => {
        if (Array.isArray(childValue)) {
          rows.push([]);
          rows.push(...flattenForCsv(`${key}.${childKey}`, childValue));
        }
      });
    }
  });
  rows.push([]);
  rows.push(['metadata', 'generated_at', new Date().toISOString()]);
  Object.entries(report.filters || {}).forEach(([key, value]) => rows.push(['filter', key, value]));

  return rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

async function exportBillingReport(query = {}, actor = {}, requestMeta = {}) {
  assertStaff(actor);
  if (!hasAnyPermission(actor, [PERMISSION.REPORTS.EXPORT, PERMISSION.REPORTS.BILLING_EXPORT, PERMISSION.REPORTS.READ_ALL])) {
    throw createError('Tài khoản hiện tại không có quyền export báo cáo viện phí.', 403);
  }
  const rawType = normalizeString(query.report_type || query.type || 'revenue').toLowerCase();
  const reportType = rawType.replace(/^billing[_-]/, '').replace(/-/g, '_');
  const handler = BILLING_REPORT_HANDLERS[reportType];
  if (!handler || reportType === 'drilldown') throw createError('report_type viện phí không được hỗ trợ.', 400);
  const report = await handler(query, actor);
  const format = normalizeString(query.format || 'json').toLowerCase();

  await recordAuditLog({
    actor,
    action: 'reports.billing.export',
    targetType: 'billing_report',
    status: 'success',
    message: 'Export billing report.',
    requestMeta,
    metadata: { report_type: reportType, format, filters: query },
  });

  if (format === 'csv' || format === 'xlsx') {
    return {
      report_type: reportType,
      format: 'csv',
      requested_format: format,
      content_type: 'text/csv',
      filename: `billing_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`,
      content: reportToCsv(report),
      note: format === 'xlsx' ? 'XLSX job chưa được bật; backend trả CSV nhiều section để dùng ngay.' : undefined,
    };
  }

  return {
    report_type: reportType,
    format: 'json',
    content_type: 'application/json',
    data: report,
  };
}

module.exports = {
  getBillingSummaryReport,
  getBillingRevenueReport,
  getBillingReceivablesReport,
  getBillingPaymentMethodsReport,
  getBillingDepartmentReport,
  getBillingRefundVoidReport,
  getBillingInsuranceReport,
  getBillingDrilldownReport,
  exportBillingReport,
};
