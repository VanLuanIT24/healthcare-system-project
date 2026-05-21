const reportService = require('./report.service');
const billingService = require('./billing.service');
const paymentIntentService = require('./payment-intent.service');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const AR_STATUSES = ['issued', 'partially_paid'];

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function round(value) {
  return Number((number(value) + Number.EPSILON).toFixed(2));
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfWeek(value = new Date()) {
  const date = startOfDay(value);
  return addDays(date, -((date.getDay() + 6) % 7));
}

function startOfMonth(value = new Date()) {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
}

function startOfQuarter(value = new Date()) {
  const date = startOfDay(value);
  date.setMonth(Math.floor(date.getMonth() / 3) * 3, 1);
  return date;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildRange(query = {}) {
  const now = new Date();
  if (query.date_from || query.from || query.date_to || query.to) {
    return {
      start: startOfDay(query.date_from || query.from || now),
      end: endOfDay(query.date_to || query.to || query.date_from || query.from || now),
    };
  }
  const range = String(query.range || query.period || 'week').toLowerCase();
  if (range === 'today') return { start: startOfDay(query.date || now), end: endOfDay(query.date || now) };
  if (range === '7d') return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
  if (range === '30d') return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
  if (range === 'month') return { start: startOfMonth(now), end: endOfDay(now) };
  if (range === 'quarter') return { start: startOfQuarter(now), end: endOfDay(now) };
  return { start: startOfWeek(now), end: endOfDay(addDays(startOfWeek(now), 6)) };
}

function reportQuery(query = {}, range = buildRange(query)) {
  return {
    ...query,
    date_from: isoDate(range.start),
    date_to: isoDate(range.end),
    from: query.from || isoDate(range.start),
    to: query.to || isoDate(range.end),
    timezone: query.timezone || DEFAULT_TIMEZONE,
  };
}

function listQuery(query = {}, range = buildRange(query), overrides = {}) {
  return {
    ...reportQuery(query, range),
    page: query.page || 1,
    limit: Math.min(Number(query.limit || 30), 100),
    ...overrides,
  };
}

async function safe(key, fn) {
  try {
    return { key, ok: true, data: await fn() };
  } catch (error) {
    return {
      key,
      ok: false,
      data: null,
      error: {
        status: error.statusCode || error.status || 500,
        message: error.message || 'Không thể tải dữ liệu tài chính.',
      },
    };
  }
}

function collect(results = []) {
  return results.reduce((acc, result) => {
    acc[result.key] = result.data;
    if (!result.ok) acc.data_errors.push({ key: result.key, ...result.error });
    return acc;
  }, { data_errors: [] });
}

function itemsOf(list) {
  return Array.isArray(list?.items) ? list.items : [];
}

function patientName(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.full_name || value.patient_code || value.name || null;
}

function invoiceNo(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.invoice_no || value.code || null;
}

function groupSum(rows = [], key, amountKey = 'amount') {
  const map = new Map();
  rows.forEach((row) => {
    const label = row[key] || 'unknown';
    const current = map.get(label) || { label, key: label, count: 0, amount: 0 };
    current.count += 1;
    current.amount += number(row[amountKey]);
    map.set(label, current);
  });
  return [...map.values()].map((row) => ({ ...row, amount: round(row.amount), value: round(row.amount) }));
}

function daysSince(value) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function balanceDue(row = {}) {
  return Math.max(0, number(row.balance_due ?? row.total_amount - row.paid_amount));
}

function agingBucket(days) {
  if (days <= 7) return '0-7';
  if (days <= 15) return '8-15';
  if (days <= 30) return '16-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '>90';
}

function enrichInvoice(row = {}) {
  const days = daysSince(row.issued_at || row.created_at);
  const balance = balanceDue(row);
  return {
    ...row,
    patient_name: patientName(row.patient_id),
    days_outstanding: days,
    balance_due: balance,
    aging_bucket: agingBucket(days),
    risk_level: balance <= 0 ? 'safe' : days <= 7 ? 'normal' : days <= 30 ? 'warning' : 'danger',
  };
}

function buildAging(invoices = []) {
  const seed = ['0-7', '8-15', '16-30', '31-60', '61-90', '>90'].map((bucket) => ({
    bucket,
    label: bucket,
    invoice_count: 0,
    outstanding_amount: 0,
    largest_invoice: null,
  }));
  const map = new Map(seed.map((row) => [row.bucket, row]));
  invoices.forEach((invoice) => {
    const bucket = agingBucket(invoice.days_outstanding);
    const row = map.get(bucket);
    row.invoice_count += 1;
    row.outstanding_amount += balanceDue(invoice);
    if (!row.largest_invoice || balanceDue(invoice) > balanceDue(row.largest_invoice)) row.largest_invoice = invoice;
  });
  return [...map.values()].map((row) => ({
    ...row,
    count: row.invoice_count,
    amount: round(row.outstanding_amount),
    value: round(row.outstanding_amount),
    outstanding_amount: round(row.outstanding_amount),
    average_balance: row.invoice_count ? round(row.outstanding_amount / row.invoice_count) : 0,
  }));
}

function buildMethodAnalytics(payments = [], revenue = {}) {
  const fromRevenue = revenue.breakdowns?.payment_by_method || [];
  const base = fromRevenue.length
    ? fromRevenue.map((row) => ({
      payment_method: row.payment_method,
      label: row.payment_method,
      count: row.count,
      amount: number(row.amount),
    }))
    : groupSum(payments, 'payment_method');
  const total = base.reduce((sum, row) => sum + number(row.amount), 0);
  return base.map((row) => ({
    ...row,
    key: row.payment_method || row.key,
    label: row.payment_method || row.label,
    value: round(row.amount),
    amount: round(row.amount),
    share_percent: total ? round((number(row.amount) / total) * 100) : 0,
    average_amount: row.count ? round(number(row.amount) / number(row.count)) : 0,
  }));
}

function buildRefundVoidLedger({ payments = [], invoices = [], charges = [] }) {
  const paymentRows = payments
    .filter((row) => ['refunded', 'refunded_manual', 'voided'].includes(row.status))
    .map((row) => ({
      type: row.status === 'voided' ? 'payment_void' : 'payment_refund',
      ref_no: row.payment_no,
      payment_id: row._id,
      invoice_id: row.invoice_id?._id || row.invoice_id,
      invoice_no: invoiceNo(row.invoice_id),
      patient_id: row.patient_id,
      amount: number(row.amount),
      status: row.status,
      reason: row.refund_reason || row.void_reason || row.reason,
      occurred_at: row.refunded_at || row.voided_at || row.updated_at || row.created_at,
      actor: row.refunded_by || row.voided_by,
    }));
  const invoiceRows = invoices
    .filter((row) => ['voided', 'refunded'].includes(row.status))
    .map((row) => ({
      type: row.status === 'voided' ? 'invoice_void' : 'invoice_refund',
      ref_no: row.invoice_no,
      invoice_id: row._id,
      patient_id: row.patient_id,
      patient_name: patientName(row.patient_id),
      amount: number(row.total_amount),
      status: row.status,
      reason: row.void_reason || row.cancel_reason || row.reason,
      occurred_at: row.voided_at || row.updated_at || row.created_at,
      actor: row.voided_by,
    }));
  const chargeRows = charges
    .filter((row) => ['voided', 'refunded'].includes(row.status))
    .map((row) => ({
      type: row.status === 'voided' ? 'charge_void' : 'charge_refund',
      ref_no: row.charge_no,
      charge_id: row._id,
      invoice_id: row.invoice_id?._id || row.invoice_id,
      invoice_no: invoiceNo(row.invoice_id),
      patient_id: row.patient_id,
      patient_name: patientName(row.patient_id),
      amount: number(row.total_amount),
      status: row.status,
      reason: row.void_reason || row.reason,
      occurred_at: row.voided_at || row.updated_at || row.created_at,
      actor: row.voided_by,
    }));
  return [...paymentRows, ...invoiceRows, ...chargeRows]
    .sort((a, b) => new Date(b.occurred_at || 0) - new Date(a.occurred_at || 0));
}

function buildReconciliation(intents = [], payments = []) {
  const byId = new Map(payments.map((row) => [String(row._id), row]));
  const refCounts = payments.reduce((map, row) => {
    const ref = row.transaction_ref || row.provider_transaction_id;
    if (!ref) return map;
    map.set(ref, (map.get(ref) || 0) + 1);
    return map;
  }, new Map());
  return intents.map((intent) => {
    const payment = intent.payment_id ? byId.get(String(intent.payment_id)) : null;
    const ref = intent.transaction_ref || intent.provider_transaction_id || payment?.transaction_ref;
    const issues = [];
    if (['confirmed', 'completed', 'paid'].includes(intent.status) && !payment) issues.push('missing_payment');
    if (payment?.status === 'completed' && !ref && !['cash', 'insurance'].includes(payment.payment_method)) issues.push('missing_transaction_ref');
    if (intent.status === 'expired' && payment?.status === 'completed') issues.push('expired_paid');
    if (ref && refCounts.get(ref) > 1) issues.push('duplicate_transaction_ref');
    if (intent.status === 'pending_manual_confirmation') issues.push('pending_manual_confirmation');
    return {
      ...intent,
      payment,
      invoice_no: invoiceNo(intent.invoice_id || payment?.invoice_id),
      payment_status: payment?.status || null,
      transaction_ref: ref,
      reconciliation_status: issues.length ? 'warning' : payment ? 'matched' : 'pending',
      issues,
      issue_title: issues.join(', '),
    };
  });
}

function buildClaimAnalytics(claims = []) {
  const byStatus = groupSum(claims, 'status', 'submitted_amount');
  const submitted = claims.reduce((sum, row) => sum + number(row.submitted_amount), 0);
  const approved = claims.reduce((sum, row) => sum + number(row.approved_amount), 0);
  const paid = claims.reduce((sum, row) => sum + number(row.paid_amount || row.settled_amount), 0);
  const rejected = claims.filter((row) => row.status === 'rejected').reduce((sum, row) => sum + number(row.submitted_amount), 0);
  const terminal = claims.filter((row) => ['approved', 'partially_approved', 'rejected', 'settled'].includes(row.status)).length;
  return {
    by_status: byStatus,
    submitted_amount: round(submitted),
    approved_amount: round(approved),
    paid_amount: round(paid),
    rejected_amount: round(rejected),
    approval_rate: terminal ? round((claims.filter((row) => ['approved', 'partially_approved', 'settled'].includes(row.status)).length / terminal) * 100) : 0,
    settlement_rate: claims.length ? round((claims.filter((row) => row.status === 'settled').length / claims.length) * 100) : 0,
  };
}

function buildCards(type, context) {
  const { revenue, invoices, payments, intents, claims, aging, refundVoidLedger, methodAnalytics, reconciliation, claimAnalytics } = context;
  const summary = revenue.summary || {};
  const issuedAmount = number(summary.issued_invoice_amount);
  const paidAmount = number(summary.paid_amount);
  const outstandingAmount = number(summary.outstanding_amount);
  const collectionRate = issuedAmount ? round((paidAmount / issuedAmount) * 100) : 0;
  const refundRate = paidAmount ? round((number(summary.refund_amount) / paidAmount) * 100) : 0;
  const pendingManual = intents.filter((row) => row.status === 'pending_manual_confirmation').length;
  const invoiceStatusCount = (status) => invoices.filter((row) => row.status === status).length;
  const paymentStatusCount = (status) => payments.filter((row) => row.status === status).length;
  const claimStatusCount = (status) => claims.filter((row) => row.status === status).length;
  const base = [
    { key: 'paid_amount', label: 'Doanh thu thực thu', value: paidAmount, unit: 'currency', status: 'good' },
    { key: 'gross_charges', label: 'Tổng charge phát sinh', value: summary.gross_charges, unit: 'currency', status: 'neutral' },
    { key: 'issued_invoice_amount', label: 'Tổng tiền hóa đơn', value: issuedAmount, unit: 'currency', status: 'neutral' },
    { key: 'outstanding_amount', label: 'Công nợ còn lại', value: outstandingAmount, unit: 'currency', status: outstandingAmount > 0 ? 'warning' : 'good' },
    { key: 'payment_count', label: 'Tổng giao dịch', value: summary.payment_count || payments.length, status: 'neutral' },
    { key: 'refund_amount', label: 'Refund amount', value: summary.refund_amount, unit: 'currency', status: number(summary.refund_amount) > 0 ? 'danger' : 'good' },
    { key: 'voided_amount', label: 'Voided amount', value: summary.voided_amount, unit: 'currency', status: number(summary.voided_amount) > 0 ? 'danger' : 'good' },
    { key: 'collection_rate', label: 'Tỷ lệ thu tiền', value: collectionRate, unit: 'percent', status: collectionRate >= 85 ? 'good' : 'warning' },
    { key: 'pending_manual', label: 'Chờ xác nhận thủ công', value: pendingManual, status: pendingManual ? 'warning' : 'good' },
    { key: 'insurance_processing', label: 'Claim đang xử lý', value: claimStatusCount('submitted') + claimStatusCount('under_review'), status: 'warning' },
  ];

  const variants = {
    revenue: [
      ...base.slice(0, 8),
      { key: 'net_revenue', label: 'Net revenue tạm tính', value: paidAmount - number(summary.refund_amount) - number(summary.voided_amount), unit: 'currency', status: 'good' },
      { key: 'average_payment', label: 'Thanh toán TB', value: summary.payment_count ? paidAmount / number(summary.payment_count) : 0, unit: 'currency', status: 'neutral' },
    ],
    accounts_receivable: [
      { key: 'total_ar', label: 'Tổng công nợ', value: outstandingAmount, unit: 'currency', status: outstandingAmount ? 'warning' : 'good' },
      { key: 'ar_invoice_count', label: 'Hóa đơn còn công nợ', value: invoices.filter((row) => balanceDue(row) > 0).length, status: 'warning' },
      { key: 'issued_ar', label: 'Công nợ issued', value: invoices.filter((row) => row.status === 'issued').reduce((sum, row) => sum + balanceDue(row), 0), unit: 'currency', status: 'warning' },
      { key: 'partial_ar', label: 'Công nợ partially paid', value: invoices.filter((row) => row.status === 'partially_paid').reduce((sum, row) => sum + balanceDue(row), 0), unit: 'currency', status: 'warning' },
      { key: 'avg_ar', label: 'Công nợ TB / invoice', value: invoices.length ? outstandingAmount / invoices.length : 0, unit: 'currency', status: 'neutral' },
      { key: 'ar_rate', label: 'Tỷ lệ công nợ', value: issuedAmount ? (outstandingAmount / issuedAmount) * 100 : 0, unit: 'percent', status: 'warning' },
    ],
    ar_aging: aging.map((bucket) => ({
      key: bucket.bucket,
      label: `${bucket.bucket} ngày`,
      value: bucket.outstanding_amount,
      unit: 'currency',
      subtitle: `${bucket.invoice_count} invoice`,
      status: ['31-60', '61-90', '>90'].includes(bucket.bucket) ? 'danger' : 'warning',
    })),
    invoices: [
      { key: 'invoice_count', label: 'Tổng invoice', value: invoices.length || summary.invoice_count, status: 'neutral' },
      { key: 'draft', label: 'Draft', value: invoiceStatusCount('draft'), status: 'neutral' },
      { key: 'issued', label: 'Issued', value: invoiceStatusCount('issued'), status: 'warning' },
      { key: 'partially_paid', label: 'Partially paid', value: invoiceStatusCount('partially_paid'), status: 'warning' },
      { key: 'paid', label: 'Paid', value: invoiceStatusCount('paid'), status: 'good' },
      { key: 'voided', label: 'Voided', value: invoiceStatusCount('voided'), status: 'danger' },
      { key: 'refunded', label: 'Refunded', value: invoiceStatusCount('refunded'), status: 'danger' },
      { key: 'balance_due', label: 'Balance due', value: outstandingAmount, unit: 'currency', status: outstandingAmount ? 'warning' : 'good' },
    ],
    payments: [
      { key: 'payment_count', label: 'Tổng payment', value: payments.length || summary.payment_count, status: 'neutral' },
      { key: 'completed', label: 'Completed', value: paymentStatusCount('completed'), status: 'good' },
      { key: 'pending', label: 'Pending', value: paymentStatusCount('pending'), status: 'warning' },
      { key: 'pending_manual_confirmation', label: 'Chờ xác nhận thủ công', value: pendingManual, status: 'warning' },
      { key: 'failed', label: 'Failed', value: paymentStatusCount('failed'), status: 'danger' },
      { key: 'refunded', label: 'Refunded', value: paymentStatusCount('refunded') + paymentStatusCount('refunded_manual'), status: 'danger' },
      { key: 'voided', label: 'Voided', value: paymentStatusCount('voided'), status: 'danger' },
      { key: 'paid_amount', label: 'Total paid amount', value: paidAmount, unit: 'currency', status: 'good' },
    ],
    payment_methods: [
      { key: 'method_count', label: 'Phương thức đang dùng', value: methodAnalytics.length, status: 'neutral' },
      ...methodAnalytics.slice(0, 7).map((row) => ({ key: row.key, label: row.label, value: row.amount, unit: 'currency', status: 'neutral', subtitle: `${row.count} giao dịch` })),
    ],
    refund_void: [
      { key: 'refund_amount', label: 'Refund amount', value: summary.refund_amount, unit: 'currency', status: 'danger' },
      { key: 'refund_count', label: 'Refund count', value: refundVoidLedger.filter((row) => row.type.includes('refund')).length, status: 'danger' },
      { key: 'voided_amount', label: 'Voided amount', value: summary.voided_amount, unit: 'currency', status: 'danger' },
      { key: 'void_count', label: 'Void count', value: refundVoidLedger.filter((row) => row.type.includes('void')).length, status: 'danger' },
      { key: 'refund_rate', label: 'Refund rate', value: refundRate, unit: 'percent', status: refundRate > 5 ? 'danger' : 'good' },
      { key: 'revenue_impact', label: 'Tác động doanh thu', value: number(summary.refund_amount) + number(summary.voided_amount), unit: 'currency', status: 'danger' },
    ],
    reconciliation: [
      { key: 'intent_count', label: 'Tổng payment intents', value: intents.length, status: 'neutral' },
      { key: 'pending_manual', label: 'Pending manual', value: pendingManual, status: pendingManual ? 'warning' : 'good' },
      { key: 'matched', label: 'Đã khớp', value: reconciliation.filter((row) => row.reconciliation_status === 'matched').length, status: 'good' },
      { key: 'warning', label: 'Lệch cần kiểm tra', value: reconciliation.filter((row) => row.reconciliation_status === 'warning').length, status: 'danger' },
      { key: 'expired', label: 'Intent hết hạn', value: intents.filter((row) => row.status === 'expired').length, status: 'warning' },
      { key: 'rejected', label: 'Intent bị từ chối', value: intents.filter((row) => row.status === 'rejected').length, status: 'danger' },
    ],
    insurance: [
      { key: 'claim_count', label: 'Tổng claim', value: claims.length, status: 'neutral' },
      { key: 'submitted', label: 'Submitted', value: claimStatusCount('submitted'), status: 'warning' },
      { key: 'under_review', label: 'Under review', value: claimStatusCount('under_review'), status: 'warning' },
      { key: 'approved', label: 'Approved', value: claimStatusCount('approved'), status: 'good' },
      { key: 'settled', label: 'Settled', value: claimStatusCount('settled'), status: 'good' },
      { key: 'rejected', label: 'Rejected', value: claimStatusCount('rejected'), status: 'danger' },
      { key: 'submitted_amount', label: 'Submitted amount', value: claimAnalytics.submitted_amount, unit: 'currency', status: 'neutral' },
      { key: 'approval_rate', label: 'Approval rate', value: claimAnalytics.approval_rate, unit: 'percent', status: 'good' },
    ],
  };

  return variants[type] || base;
}

function buildHealth(summary = {}, context = {}) {
  const issued = number(summary.issued_invoice_amount);
  const paid = number(summary.paid_amount);
  const outstanding = number(summary.outstanding_amount);
  return [
    { key: 'revenue', label: 'Revenue health', score: issued ? round((paid / issued) * 100) : 0, status: paid >= outstanding ? 'good' : 'warning' },
    { key: 'collection', label: 'Collection health', score: issued ? round(100 - (outstanding / issued) * 100) : 0, status: outstanding > paid * 0.25 ? 'warning' : 'good' },
    { key: 'invoice', label: 'Invoice health', score: context.invoices?.length ? round((context.invoices.filter((row) => row.status === 'paid').length / context.invoices.length) * 100) : 0, status: 'neutral' },
    { key: 'refund_void', label: 'Refund/Void health', score: paid ? round(100 - ((number(summary.refund_amount) + number(summary.voided_amount)) / paid) * 100) : 100, status: number(summary.refund_amount) + number(summary.voided_amount) > 0 ? 'warning' : 'good' },
    { key: 'insurance', label: 'Insurance health', score: context.claimAnalytics?.approval_rate || 0, status: 'neutral' },
    { key: 'reconciliation', label: 'Reconciliation health', score: context.reconciliation?.length ? round((context.reconciliation.filter((row) => row.reconciliation_status !== 'warning').length / context.reconciliation.length) * 100) : 100, status: context.reconciliation?.some((row) => row.reconciliation_status === 'warning') ? 'warning' : 'good' },
  ];
}

function buildInsights(context) {
  const { revenue, methodAnalytics, aging, reconciliation, claimAnalytics, refundVoidLedger } = context;
  const summary = revenue.summary || {};
  const topMethod = methodAnalytics[0];
  const oldestBucket = aging.find((row) => row.bucket === '>90');
  const issues = reconciliation.filter((row) => row.reconciliation_status === 'warning').length;
  return [
    topMethod ? { title: 'Payment method chủ đạo', description: `${topMethod.label} chiếm ${topMethod.share_percent}% dòng tiền.`, status: 'neutral' } : null,
    number(summary.outstanding_amount) > 0 ? { title: 'Công nợ cần theo dõi', description: `Còn ${round(summary.outstanding_amount)} VND chưa thu.`, status: 'warning' } : null,
    oldestBucket?.outstanding_amount > 0 ? { title: 'Aging nghiêm trọng', description: `Bucket >90 ngày còn ${round(oldestBucket.outstanding_amount)} VND.`, status: 'danger' } : null,
    issues ? { title: 'Đối soát lệch', description: `${issues} payment intent/payment cần kiểm tra.`, status: 'danger' } : null,
    refundVoidLedger.length ? { title: 'Refund/Void phát sinh', description: `${refundVoidLedger.length} dòng ledger cần review lý do.`, status: 'warning' } : null,
    claimAnalytics.approval_rate ? { title: 'Insurance approval', description: `Tỷ lệ duyệt claim ${claimAnalytics.approval_rate}%.`, status: 'good' } : null,
  ].filter(Boolean);
}

async function baseData(query = {}, actor = {}, type = 'dashboard') {
  const range = buildRange(query);
  const rq = reportQuery(query, range);
  const lq = listQuery(query, range);
  const wide = { ...lq, limit: 100 };
  const results = await Promise.all([
    safe('billing_dashboard', () => reportService.getBillingDashboard(actor)),
    safe('revenue', () => reportService.getRevenueReport(rq, actor)),
    safe('departments', () => reportService.getDepartmentReport(rq, actor)),
    safe('invoices', () => billingService.listInvoices(wide, actor)),
    safe('payments', () => billingService.listPayments(wide, actor)),
    safe('payment_intents', () => paymentIntentService.listPaymentIntents(wide, actor)),
    safe('insurance_claims', () => billingService.listInsuranceClaims(wide, actor)),
    safe('charges', () => billingService.listCharges(wide, actor)),
    safe('service_catalog', () => billingService.listServiceCatalog({ ...wide, limit: 50 }, actor)),
    safe('providers', () => paymentIntentService.listAvailableProviders()),
    safe('issued_invoices', () => billingService.listInvoices({ ...wide, status: 'issued' }, actor)),
    safe('partial_invoices', () => billingService.listInvoices({ ...wide, status: 'partially_paid' }, actor)),
    safe('refunded_payments', () => billingService.listPayments({ ...wide, status: 'refunded' }, actor)),
    safe('voided_payments', () => billingService.listPayments({ ...wide, status: 'voided' }, actor)),
    safe('voided_invoices', () => billingService.listInvoices({ ...wide, status: 'voided' }, actor)),
    safe('refunded_invoices', () => billingService.listInvoices({ ...wide, status: 'refunded' }, actor)),
    safe('voided_charges', () => billingService.listCharges({ ...wide, status: 'voided' }, actor)),
    safe('refunded_charges', () => billingService.listCharges({ ...wide, status: 'refunded' }, actor)),
  ]);
  const data = collect(results);
  const revenue = data.revenue || { summary: {}, breakdowns: {} };
  const invoices = itemsOf(data.invoices).map(enrichInvoice);
  const arInvoices = [...itemsOf(data.issued_invoices), ...itemsOf(data.partial_invoices)].map(enrichInvoice).filter((row) => AR_STATUSES.includes(row.status) && balanceDue(row) > 0);
  const payments = itemsOf(data.payments);
  const intents = itemsOf(data.payment_intents);
  const claims = itemsOf(data.insurance_claims);
  const charges = itemsOf(data.charges);
  const methodAnalytics = buildMethodAnalytics(payments, revenue);
  const aging = buildAging(arInvoices);
  const refundVoidLedger = buildRefundVoidLedger({
    payments: [...payments, ...itemsOf(data.refunded_payments), ...itemsOf(data.voided_payments)],
    invoices: [...invoices, ...itemsOf(data.voided_invoices), ...itemsOf(data.refunded_invoices)],
    charges: [...charges, ...itemsOf(data.voided_charges), ...itemsOf(data.refunded_charges)],
  });
  const reconciliation = buildReconciliation(intents, payments);
  const claimAnalytics = buildClaimAnalytics(claims);
  const context = { revenue, invoices, arInvoices, payments, intents, claims, charges, methodAnalytics, aging, refundVoidLedger, reconciliation, claimAnalytics };

  return {
    type,
    summary_cards: buildCards(type, context),
    finance_health: buildHealth(revenue.summary, context),
    revenue,
    invoices,
    accounts_receivable: {
      items: arInvoices,
      aging_buckets: aging,
      total_outstanding: arInvoices.reduce((sum, row) => sum + balanceDue(row), 0),
      invoice_count: arInvoices.length,
    },
    payments,
    payment_intents: intents,
    insurance_claims: claims,
    charges,
    service_catalog: itemsOf(data.service_catalog),
    payment_providers: data.providers || [],
    payment_methods: methodAnalytics,
    refund_void_ledger: refundVoidLedger,
    reconciliation,
    insurance_analytics: claimAnalytics,
    reports: {
      billing_dashboard: data.billing_dashboard,
      departments: data.departments,
    },
    lists: {
      invoices: data.invoices,
      payments: data.payments,
      payment_intents: data.payment_intents,
      insurance_claims: data.insurance_claims,
      charges: data.charges,
    },
    charts: {
      revenue_by_day: revenue.breakdowns?.revenue_by_day || [],
      payment_by_method: methodAnalytics,
      invoice_by_status: revenue.breakdowns?.invoice_by_status || groupSum(invoices, 'status', 'total_amount'),
      revenue_by_department: revenue.breakdowns?.revenue_by_department || [],
      revenue_by_service_type: revenue.breakdowns?.revenue_by_service_type || [],
      aging_buckets: aging,
      payment_by_status: groupSum(payments, 'status', 'amount'),
      claim_by_status: claimAnalytics.by_status,
      refund_void_by_type: groupSum(refundVoidLedger, 'type', 'amount'),
    },
    insights: buildInsights(context),
    generated_at: new Date(),
    filters: { ...query, date_from: rq.date_from, date_to: rq.date_to, timezone: rq.timezone },
    data_errors: data.data_errors,
    backend_todo: [
      'GET /api/reports/finance/ar-aging: backend-owned aging buckets with overdue priority.',
      'GET /api/reports/finance/reconciliation: provider status diff, duplicate refs, missing payment checks.',
      'GET /api/reports/finance/refund-void: unified refund/void ledger with reason and actor.',
      'GET /api/reports/finance/insurance: payer analytics, processing time, rejected reasons, settlement SLA.',
      'POST /api/reports/exports and GET /api/reports/exports/:id/download for async Excel/PDF export.',
    ],
  };
}

module.exports = {
  getDashboard: (query, actor) => baseData(query, actor, 'dashboard'),
  getRevenue: (query, actor) => baseData(query, actor, 'revenue'),
  getAccountsReceivable: (query, actor) => baseData(query, actor, 'accounts_receivable'),
  getArAging: (query, actor) => baseData(query, actor, 'ar_aging'),
  getInvoices: (query, actor) => baseData(query, actor, 'invoices'),
  getPayments: (query, actor) => baseData(query, actor, 'payments'),
  getPaymentMethods: (query, actor) => baseData(query, actor, 'payment_methods'),
  getRefundVoid: (query, actor) => baseData(query, actor, 'refund_void'),
  getReconciliation: (query, actor) => baseData(query, actor, 'reconciliation'),
  getInsurance: (query, actor) => baseData(query, actor, 'insurance'),
};

