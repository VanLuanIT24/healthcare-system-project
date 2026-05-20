const { Types } = require('mongoose');
const {
  Charge,
  InsuranceClaim,
  Invoice,
  Notification,
  Patient,
  Payment,
  PaymentIntent,
  PaymentRefund,
  Receipt,
  ReconciliationException,
} = require('../models');
const { PERMISSION, ROLE_CODE } = require('../constants/permissions');
const {
  CHARGE_STATUS,
  INSURANCE_CLAIM_STATUS,
  INVOICE_STATUS,
  PAYMENT_INTENT_STATUS,
  PAYMENT_STATUS,
} = require('../constants/statuses');
const billingCashierService = require('./billing-cashier.service');
const permissionService = require('./permission.service');
const workspaceAccessService = require('./workspace-access.service');
const { createError, escapeRegex, getEndOfDay, getStartOfDay, normalizeString } = require('./core.service');

const BILLING_WORKSPACE_READ_PERMISSIONS = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.INVOICES.READ,
  PERMISSION.INVOICES.READ_UNPAID,
  PERMISSION.PAYMENTS.READ,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
  PERMISSION.CHARGES.READ,
  PERMISSION.RECEIPTS.READ,
  PERMISSION.INSURANCE_CLAIMS.READ,
];

const QUICK_ACTIONS = [
  { id: 'collect_payment', label: 'Thu tiền', route: '/billing/cashier/collect', icon: 'WalletCards' },
  { id: 'pending_confirmation', label: 'Payment cần xác nhận', route: '/billing/cashier/transfer-confirmation', icon: 'BadgeCheck' },
  { id: 'unpaid_invoices', label: 'Hóa đơn chờ thu', route: '/billing/cashier/unpaid-invoices', icon: 'FileClock' },
  { id: 'partial_invoices', label: 'Thanh toán một phần', route: '/billing/cashier/partial-paid-invoices', icon: 'Receipt' },
  { id: 'print_receipt', label: 'In biên lai', route: '/billing/cashier/print-receipt', icon: 'Printer' },
];

const SEARCH_MENUS = [
  ...QUICK_ACTIONS,
  { id: 'payment_failed', label: 'Payment lỗi', route: '/billing/payments/failed-rejected' },
  { id: 'receivables', label: 'Công nợ', route: '/billing/ar/aging' },
  { id: 'charges_pending', label: 'Charge chờ post', route: '/billing/charges/pending' },
  { id: 'reconciliation_mismatch', label: 'Sai lệch đối soát', route: '/billing/reconciliation/payment-mismatch' },
  { id: 'insurance_claims', label: 'Claim BHYT', route: '/billing/insurance/claims' },
];

function toId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return String(value);
}

function actorId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || null;
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions);
}

function hasRole(actor = {}, roleCode) {
  return (actor.roles || actor.user?.roles || []).includes(roleCode);
}

function assertBillingWorkspaceAccess(actor = {}) {
  if ((actor.actorType || actor.actor_type) !== 'staff') throw createError('Chỉ staff được dùng Billing Workspace.', 403);
  if (
    !hasAnyPermission(actor, BILLING_WORKSPACE_READ_PERMISSIONS)
    && ![ROLE_CODE.SUPER_ADMIN, ROLE_CODE.ADMIN, ROLE_CODE.MANAGER].some((role) => hasRole(actor, role))
  ) {
    throw createError('Bạn không có quyền xem Billing Workspace.', 403);
  }
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function todayRange(query = {}) {
  const source = query.date ? new Date(query.date) : new Date();
  return { from: getStartOfDay(source), to: getEndOfDay(source) };
}

function mapPatient(patient) {
  if (!patient) return null;
  if (typeof patient !== 'object') return { id: toId(patient) };
  return {
    id: toId(patient),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    phone: patient.phone,
    gender: patient.gender,
  };
}

function mapInvoice(invoice) {
  if (!invoice) return null;
  const patient = mapPatient(invoice.patient_id);
  return {
    id: toId(invoice),
    invoice_no: invoice.invoice_no,
    status: invoice.status,
    total_amount: invoice.total_amount,
    paid_amount: invoice.paid_amount,
    balance_due: invoice.balance_due,
    insurance_amount: invoice.insurance_amount,
    issued_at: invoice.issued_at,
    due_at: invoice.due_at,
    patient,
  };
}

function mapPaymentIntent(intent) {
  if (!intent) return null;
  return {
    id: toId(intent),
    intent_code: intent.intent_code,
    provider: intent.provider,
    method: intent.method,
    status: intent.status,
    amount: intent.amount,
    expected_amount: intent.expected_amount,
    received_amount: intent.received_amount,
    difference_amount: intent.difference_amount,
    transaction_reference: intent.transaction_reference,
    provider_transaction_id: intent.provider_transaction_id,
    qr_image_url: intent.qr_image_url,
    invoice: mapInvoice(intent.invoice_id),
    patient: mapPatient(intent.patient_id),
    created_at: intent.created_at,
    expires_at: intent.expires_at,
  };
}

function mapReceipt(receipt) {
  return {
    id: toId(receipt),
    receipt_no: receipt.receipt_no,
    amount: receipt.amount,
    status: receipt.status,
    payment_method: receipt.payment_method,
    issued_at: receipt.issued_at || receipt.created_at,
    invoice: mapInvoice(receipt.invoice_id),
    patient: mapPatient(receipt.patient_id),
  };
}

function profile(actor = {}) {
  const user = actor.user || {};
  return {
    id: actorId(actor),
    display_name: user.full_name || actor.fullName || user.username || actor.username || 'Thu ngân',
    email: user.email,
    username: user.username || actor.username,
    roles: actor.roles || user.roles || [],
    permissions: actor.permissions || [],
  };
}

async function countOpenRefundRequests() {
  const refundStatuses = ['requested', 'under_review', 'approved', 'processing'];
  const [refundDocs, legacyPayments] = await Promise.all([
    PaymentRefund.countDocuments({ status: { $in: refundStatuses } }).catch(() => 0),
    Payment.countDocuments({ refund_status: { $in: refundStatuses } }).catch(() => 0),
  ]);
  return refundDocs + legacyPayments;
}

async function getCounters(query = {}, actor = {}) {
  const workbench = await billingCashierService.getWorkbench(query, actor);
  const range = todayRange(query);
  const [
    overdueInvoices,
    todayPayments,
    chargesPendingPost,
    chargesNotInvoiced,
    refundRequests,
    mismatchCount,
    rejectedClaims,
  ] = await Promise.all([
    Invoice.countDocuments({
      status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID] },
      balance_due: { $gt: 0 },
      due_at: { $lt: new Date() },
    }).catch(() => 0),
    Payment.countDocuments({
      status: PAYMENT_STATUS.COMPLETED,
      paid_at: { $gte: range.from, $lte: range.to },
    }).catch(() => 0),
    Charge.countDocuments({ status: { $in: [CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT] } }).catch(() => 0),
    Charge.countDocuments({ status: CHARGE_STATUS.POSTED, $or: [{ invoice_id: null }, { invoice_id: { $exists: false } }] }).catch(() => 0),
    countOpenRefundRequests(),
    ReconciliationException.countDocuments({ status: { $in: ['open', 'assigned'] } }).catch(() => 0),
    InsuranceClaim.countDocuments({ status: INSURANCE_CLAIM_STATUS.REJECTED }).catch(() => 0),
  ]);

  const counters = {
    unpaid_invoices: number(workbench.kpis?.unpaid_invoice_count),
    partially_paid_invoices: number(workbench.kpis?.partial_invoice_count),
    overdue_invoices: overdueInvoices,
    pending_bank_confirmations: number(workbench.kpis?.pending_qr_count) + number(workbench.kpis?.submitted_receipt_count) + number(workbench.kpis?.manual_review_count),
    failed_payments: number(workbench.kpis?.failed_payment_count),
    today_payments: todayPayments,
    today_revenue: number(workbench.kpis?.today_revenue),
    charges_pending_post: chargesPendingPost,
    charges_not_invoiced: chargesNotInvoiced,
    refund_requests: refundRequests,
    reconciliation_mismatches: mismatchCount,
    rejected_claims: rejectedClaims,
  };

  return { workbench, counters };
}

function buildAlertSummary(counters = {}) {
  const items = [
    { code: 'pending_bank_confirmation', label: 'Payment cần xác nhận', count: counters.pending_bank_confirmations, severity: 'high', route: '/billing/cashier/transfer-confirmation' },
    { code: 'failed_payments', label: 'Payment lỗi', count: counters.failed_payments, severity: 'high', route: '/billing/payments/failed-rejected' },
    { code: 'reconciliation_mismatch', label: 'Sai lệch chuyển khoản', count: counters.reconciliation_mismatches, severity: 'critical', route: '/billing/reconciliation/payment-mismatch' },
    { code: 'overdue_invoices', label: 'Hóa đơn quá hạn', count: counters.overdue_invoices, severity: 'warning', route: '/billing/invoices/overdue' },
    { code: 'partial_invoices', label: 'Hóa đơn thanh toán một phần', count: counters.partially_paid_invoices, severity: 'warning', route: '/billing/cashier/partial-paid-invoices' },
    { code: 'charges_not_invoiced', label: 'Charge chưa lên hóa đơn', count: counters.charges_not_invoiced, severity: 'warning', route: '/billing/charges/not-invoiced' },
    { code: 'refund_requests', label: 'Refund request', count: counters.refund_requests, severity: 'high', route: '/billing/refunds' },
    { code: 'rejected_claims', label: 'Claim BHYT bị từ chối', count: counters.rejected_claims, severity: 'warning', route: '/billing/insurance/claims/rejected' },
  ];
  return {
    alert_total: items.reduce((sum, item) => sum + number(item.count), 0),
    critical: items.filter((item) => item.severity === 'critical').reduce((sum, item) => sum + number(item.count), 0),
    high: items.filter((item) => item.severity === 'high').reduce((sum, item) => sum + number(item.count), 0),
    warning: items.filter((item) => item.severity === 'warning').reduce((sum, item) => sum + number(item.count), 0),
    items,
    last_updated_at: new Date(),
  };
}

async function getNotificationPreview(actor = {}) {
  const userId = actorId(actor);
  if (!userId || !Types.ObjectId.isValid(userId)) return [];
  const rows = await Notification.find({
    $or: [
      { recipient_user_id: userId },
      { recipient_actor_type: 'staff', recipient_actor_id: userId },
      { recipient_id: userId },
    ],
    archived_at: null,
  })
    .sort({ read_at: 1, priority: 1, created_at: -1 })
    .limit(10)
    .lean()
    .catch(() => []);
  return rows.map((row) => ({
    id: toId(row),
    title: row.title,
    message: row.message || row.body,
    priority: row.priority || 'normal',
    event_type: row.event_type,
    notification_type: row.notification_type,
    route: row.action_url || row.data?.route || row.payload?.route || '/billing/dashboard',
    read_at: row.read_at,
    created_at: row.created_at,
    data: row.data || row.payload || {},
  }));
}

async function getTopbarBootstrap(query = {}, actor = {}) {
  assertBillingWorkspaceAccess(actor);
  const [{ workbench, counters }, notifications] = await Promise.all([
    getCounters(query, actor),
    getNotificationPreview(actor),
  ]);
  const alertSummary = buildAlertSummary(counters);
  const workspaceSwitch = workspaceAccessService.getAvailableWorkspaces(actor, {
    current_workspace: 'billing',
    badges: { billing: { alerts: alertSummary.alert_total, tasks: counters.unpaid_invoices } },
  });
  return {
    profile: profile(actor),
    workspace: {
      code: 'billing',
      name: 'Viện phí & Thu tiền',
      cashier_counter: workbench.cashier?.counter_code || query.counter_code || 'Quầy thu 01',
      shift: workbench.cashier?.shift_code || 'Ca hiện tại',
      cash_session_status: workbench.cashier?.shift_status || 'not_open',
      realtime_status: 'connected',
      workspace_switcher: workspaceSwitch,
    },
    permissions: actor.permissions || [],
    counters,
    alert_summary: alertSummary,
    notification_preview: notifications,
    quick_actions: QUICK_ACTIONS,
    cashier: workbench.cashier,
    generated_at: new Date(),
  };
}

async function getAlertSummary(query = {}, actor = {}) {
  assertBillingWorkspaceAccess(actor);
  const { counters } = await getCounters(query, actor);
  return buildAlertSummary(counters);
}

async function getDashboardOverview(query = {}, actor = {}) {
  assertBillingWorkspaceAccess(actor);
  const [{ workbench, counters }, alertSummary] = await Promise.all([
    getCounters(query, actor),
    getAlertSummary(query, actor),
  ]);
  return { workbench, counters, alert_summary: alertSummary };
}

async function getCashierWorklist(query = {}, actor = {}) {
  assertBillingWorkspaceAccess(actor);
  const [unpaid, partial, manualPending, manualReview, failedIntents, recentReceipts] = await Promise.all([
    billingCashierService.listCashierInvoices({ ...query, status_group: 'unpaid', limit: query.limit || 30 }, actor),
    billingCashierService.listCashierInvoices({ ...query, status_group: 'partial', limit: query.limit || 30 }, actor),
    billingCashierService.listManualPayments({ status: `${PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION},${PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT}`, limit: 30 }, actor).catch(() => ({ items: [] })),
    billingCashierService.listManualPayments({ status: PAYMENT_INTENT_STATUS.MANUAL_REVIEW, limit: 30 }, actor).catch(() => ({ items: [] })),
    PaymentIntent.find({ status: { $in: [PAYMENT_INTENT_STATUS.FAILED, PAYMENT_INTENT_STATUS.REJECTED, PAYMENT_INTENT_STATUS.EXPIRED] } })
      .sort({ updated_at: -1, created_at: -1 })
      .limit(30)
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at patient_id')
      .populate('patient_id', 'patient_code full_name phone gender')
      .lean(),
    Receipt.find({})
      .sort({ issued_at: -1, created_at: -1 })
      .limit(20)
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at patient_id')
      .populate('patient_id', 'patient_code full_name phone gender')
      .lean(),
  ]);
  return {
    tabs: ['all', 'unpaid', 'partial', 'qr', 'confirmation', 'failed', 'receipts'],
    unpaid_invoices: unpaid.items || [],
    partial_invoices: partial.items || [],
    payment_confirmations: [...(manualPending.items || []), ...(manualReview.items || [])],
    failed_payment_intents: failedIntents.map(mapPaymentIntent),
    recent_receipts: recentReceipts.map(mapReceipt),
    summary: {
      unpaid: unpaid.summary?.count || 0,
      partial: partial.summary?.count || 0,
      confirmations: (manualPending.items || []).length + (manualReview.items || []).length,
      failed: failedIntents.length,
      receipts: recentReceipts.length,
    },
    updated_at: new Date(),
  };
}

async function getPaymentConfirmationQueue(query = {}, actor = {}) {
  assertBillingWorkspaceAccess(actor);
  return billingCashierService.listManualPayments({
    ...query,
    status: query.status || [
      PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
      PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
      PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
    ].join(','),
  }, actor);
}

function searchMenus(q = '') {
  const needle = normalizeString(q).toLowerCase();
  return SEARCH_MENUS
    .filter((item) => !needle || `${item.id} ${item.label}`.toLowerCase().includes(needle))
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      title: item.label,
      subtitle: 'Menu Viện phí & Thu tiền',
      route: item.route,
      actions: [{ label: 'Mở', route: item.route }],
    }));
}

async function searchBillingWorkspace(query = {}, actor = {}) {
  assertBillingWorkspaceAccess(actor);
  const q = normalizeString(query.q || query.search || query.keyword);
  if (!q || q.length < 2) {
    return {
      patients: [],
      invoices: [],
      charges: [],
      payments: [],
      payment_intents: [],
      receipts: [],
      insurance_claims: [],
      menus: searchMenus(q),
      quick_actions: QUICK_ACTIONS,
    };
  }
  const pattern = escapeRegex(q);
  const cashierResults = await billingCashierService.searchCashier({ ...query, q }, actor).catch(() => ({}));
  const [charges, receipts, claims] = await Promise.all([
    Charge.find({
      $or: [
        { charge_no: { $regex: pattern, $options: 'i' } },
        { description: { $regex: pattern, $options: 'i' } },
        { source_module: { $regex: pattern, $options: 'i' } },
        { status: { $regex: pattern, $options: 'i' } },
      ],
    })
      .sort({ charged_at: -1, created_at: -1 })
      .limit(10)
      .populate('patient_id', 'patient_code full_name phone gender')
      .lean(),
    Receipt.find({
      $or: [
        { receipt_no: { $regex: pattern, $options: 'i' } },
        { transaction_ref: { $regex: pattern, $options: 'i' } },
        { transaction_reference: { $regex: pattern, $options: 'i' } },
        { intent_code: { $regex: pattern, $options: 'i' } },
      ],
    })
      .sort({ issued_at: -1, created_at: -1 })
      .limit(10)
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
      .populate('patient_id', 'patient_code full_name phone gender')
      .lean(),
    InsuranceClaim.find({
      $or: [
        { claim_no: { $regex: pattern, $options: 'i' } },
        { status: { $regex: pattern, $options: 'i' } },
      ],
    })
      .sort({ submitted_at: -1, created_at: -1 })
      .limit(10)
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
      .populate('patient_id', 'patient_code full_name phone gender')
      .lean(),
  ]);

  return {
    patients: cashierResults.patients || [],
    invoices: cashierResults.invoices || [],
    charges: charges.map((charge) => ({
      id: toId(charge),
      title: charge.charge_no || charge.description,
      subtitle: `${charge.description || 'Charge'} · ${number(charge.total_amount).toLocaleString('vi-VN')} đ · ${charge.status}`,
      route: `/billing/charges/${toId(charge)}`,
      patient: mapPatient(charge.patient_id),
      actions: [
        { label: 'Post charge', route: `/billing/charges/pending?charge_id=${toId(charge)}` },
        { label: 'Void', route: `/billing/charges/voided?charge_id=${toId(charge)}` },
      ],
    })),
    payments: cashierResults.payments || [],
    payment_intents: cashierResults.payment_intents || cashierResults.intents || [],
    receipts: receipts.map((receipt) => ({
      id: toId(receipt),
      title: receipt.receipt_no,
      subtitle: `${number(receipt.amount).toLocaleString('vi-VN')} đ · ${receipt.payment_method || 'payment'} · ${receipt.status}`,
      route: `/billing/receipts/${toId(receipt)}`,
      patient: mapPatient(receipt.patient_id),
      invoice: mapInvoice(receipt.invoice_id),
      actions: [{ label: 'In lại', route: `/billing/cashier/print-receipt?receipt_id=${toId(receipt)}` }],
    })),
    insurance_claims: claims.map((claim) => ({
      id: toId(claim),
      title: claim.claim_no,
      subtitle: `${claim.status} · đề nghị ${number(claim.submitted_amount).toLocaleString('vi-VN')} đ`,
      route: `/billing/insurance/claims?claim_id=${toId(claim)}`,
      patient: mapPatient(claim.patient_id),
      invoice: mapInvoice(claim.invoice_id),
      actions: [{ label: 'Mở claim', route: `/billing/insurance/claims?claim_id=${toId(claim)}` }],
    })),
    menus: searchMenus(q),
    quick_actions: QUICK_ACTIONS,
  };
}

async function getReconciliationMismatches(query = {}, actor = {}) {
  assertBillingWorkspaceAccess(actor);
  const limit = Math.min(Number(query.limit || 30), 100);
  const rows = await ReconciliationException.find({ status: { $in: ['open', 'assigned'] } })
    .sort({ severity: -1, created_at: -1 })
    .limit(limit)
    .populate('invoice_id', 'invoice_no status total_amount balance_due patient_id')
    .populate('payment_intent_id', 'intent_code status amount provider transaction_reference difference_amount')
    .lean();
  return { items: rows, count: rows.length };
}

async function closeCurrentCashSession(payload = {}, actor = {}, requestMeta = {}) {
  const current = await billingCashierService.getCurrentShift(actor);
  const shiftId = current?.shift?._id || current?.shift?.id;
  if (!shiftId) throw createError('Không có phiên quỹ đang mở.', 404);
  return billingCashierService.closeShift(shiftId, payload, actor, requestMeta);
}

module.exports = {
  getTopbarBootstrap,
  getDashboardOverview,
  getCashierWorklist,
  getPaymentConfirmationQueue,
  getAlertSummary,
  searchBillingWorkspace,
  getReconciliationMismatches,
  getCurrentCashSession: billingCashierService.getCurrentShift,
  openCashSession: billingCashierService.openShift,
  closeCurrentCashSession,
  closeCashSession: billingCashierService.closeShift,
  getCashSessionReport: billingCashierService.getShiftSummary,
};
