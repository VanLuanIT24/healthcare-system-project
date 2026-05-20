const {
  Charge,
  ClinicalPaymentOverride,
  Encounter,
  ImagingOrder,
  Invoice,
  LabOrder,
  Order,
  Patient,
  Payment,
  PaymentIntent,
  ProcedureOrder,
  ServiceCatalog,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  CHARGE_STATUS,
  INVOICE_STATUS,
  ORDER_TYPE,
  PAYMENT_INTENT_STATUS,
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
  SERVICE_TYPE,
} = require('../constants/statuses');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const billingService = require('./billing.service');
const clinicalBillingService = require('./clinical-billing.service');
const paymentIntentService = require('./payment-intent.service');

const CLINICAL_SERVICE_TYPES = [SERVICE_TYPE.LAB, SERVICE_TYPE.IMAGING, SERVICE_TYPE.PROCEDURE];

const ACTIVE_CHARGE_STATUSES = [
  CHARGE_STATUS.PENDING,
  CHARGE_STATUS.DRAFT,
  CHARGE_STATUS.POSTED,
  CHARGE_STATUS.BILLED,
];

const ACTIVE_INTENT_STATUSES = [
  PAYMENT_INTENT_STATUS.CREATED,
  PAYMENT_INTENT_STATUS.PENDING,
  PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
  PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
  PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
  PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
];

const WAITING_CONFIRMATION_STATUSES = [
  PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
  PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
];

const ERROR_INTENT_STATUSES = [
  PAYMENT_INTENT_STATUS.FAILED,
  PAYMENT_INTENT_STATUS.REJECTED,
  PAYMENT_INTENT_STATUS.EXPIRED,
  PAYMENT_INTENT_STATUS.CANCELLED,
];

const BAD_PAYMENT_STATUSES = [
  PAYMENT_STATUS.FAILED,
  PAYMENT_STATUS.REJECTED,
  PAYMENT_STATUS.EXPIRED,
  PAYMENT_STATUS.CANCELLED,
  PAYMENT_STATUS.REFUNDED,
  PAYMENT_STATUS.REFUNDED_MANUAL,
  PAYMENT_STATUS.VOIDED,
];

const READ_PERMISSIONS = [
  PERMISSION.PAYMENTS.READ,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
  PERMISSION.INVOICES.READ,
  PERMISSION.INVOICES.READ_UNPAID,
  PERMISSION.CHARGES.READ,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.REPORTS.BILLING_READ,
  PERMISSION.REPORTS.REVENUE_READ,
];

const FLOW_PERMISSIONS = [
  PERMISSION.PAYMENTS.CREATE,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.INVOICES.CREATE,
  PERMISSION.INVOICES.ISSUE,
  PERMISSION.CHARGES.CREATE,
  PERMISSION.CHARGES.MANAGE,
  PERMISSION.ORDERS.CREATE_CHARGE,
];

function actorPermissions(actor = {}) {
  return new Set(actor.permissions || []);
}

function hasPermission(actor = {}, permission) {
  const permissions = actorPermissions(actor);
  return permissions.has(permission) || permissions.has('*');
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissions.some((permission) => hasPermission(actor, permission));
}

function assertStaffRead(actor = {}) {
  if (actor.actorType !== 'staff') throw createError('Chỉ tài khoản nhân sự được dùng clinical payment workspace.', 403);
  if (!hasAnyPermission(actor, READ_PERMISSIONS) && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    throw createError('Bạn không có quyền xem clinical payments.', 403);
  }
}

function assertPaymentFlow(actor = {}) {
  if (actor.actorType !== 'staff') throw createError('Chỉ tài khoản nhân sự được tạo payment flow.', 403);
  if (!hasAnyPermission(actor, FLOW_PERMISSIONS) && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    throw createError('Bạn không có quyền tạo luồng thanh toán cận lâm sàng.', 403);
  }
}

function assertOverride(actor = {}) {
  if (actor.actorType !== 'staff') throw createError('Chỉ tài khoản nhân sự được override payment gate.', 403);
  if (!hasAnyPermission(actor, [PERMISSION.PAYMENTS.CREATE, PERMISSION.PAYMENT_RECONCILIATION.READ, PERMISSION.INVOICES.ISSUE, PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Bạn không có quyền cho phép thực hiện trước thanh toán.', 403);
  }
}

function getId(value) {
  return value?._id || value || null;
}

function sameId(left, right) {
  return left && right && String(left) === String(right);
}

function normalizeDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function patientMini(patient) {
  if (!patient) return null;
  if (typeof patient !== 'object') return { _id: patient };
  return {
    _id: patient._id,
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    phone: patient.phone,
    gender: patient.gender,
    date_of_birth: patient.date_of_birth,
  };
}

function encounterMini(encounter) {
  if (!encounter) return null;
  if (typeof encounter !== 'object') return { _id: encounter };
  return {
    _id: encounter._id,
    encounter_code: encounter.encounter_code,
    encounter_type: encounter.encounter_type,
    status: encounter.status,
    start_time: encounter.start_time,
    department_id: encounter.department_id,
  };
}

function serviceMini(service) {
  if (!service) return null;
  if (typeof service !== 'object') return { _id: service };
  return {
    _id: service._id,
    service_code: service.service_code,
    service_name: service.service_name,
    service_type: service.service_type,
    unit_price: service.unit_price,
    is_billable: service.is_billable,
    status: service.status,
    department_id: service.department_id,
  };
}

function orderMini(order) {
  return {
    _id: order._id,
    order_no: order.order_no,
    order_type: order.order_type,
    priority: order.priority,
    status: order.status,
    ordered_at: order.ordered_at,
    scheduled_at: order.scheduled_at,
    department_id: order.department_id,
    is_billable: order.is_billable,
    charge_id: order.charge_id,
  };
}

function childMini(order, childMaps = {}) {
  const key = String(order._id);
  if (order.order_type === ORDER_TYPE.LAB) {
    const child = childMaps.labByOrder?.get(key);
    if (!child) return null;
    return {
      _id: child._id,
      no: child.lab_order_no,
      name: child.test_name || child.test_code,
      status: child.status,
      priority: child.priority,
    };
  }
  if (order.order_type === ORDER_TYPE.IMAGING) {
    const child = childMaps.imagingByOrder?.get(key);
    if (!child) return null;
    return {
      _id: child._id,
      no: child.imaging_order_no,
      name: [child.modality, child.body_part].filter(Boolean).join(' - '),
      status: child.status,
      scheduled_at: child.scheduled_at,
      room_id: child.room_id,
    };
  }
  const child = childMaps.procedureByOrder?.get(key);
  if (!child) return null;
  return {
    _id: child._id,
    no: child.procedure_order_no,
    name: child.procedure_name || child.procedure_code,
    status: child.status,
    scheduled_at: child.scheduled_start,
    room_id: child.room_id,
    performer_id: child.performer_id,
  };
}

function isExpiredIntent(intent) {
  return intent?.expires_at && new Date(intent.expires_at).getTime() <= Date.now();
}

function firstByGroup(items = [], keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = String(keyFn(item));
    if (key && key !== 'undefined' && !map.has(key)) map.set(key, item);
  }
  return map;
}

async function loadChildOrders(orderIds = []) {
  if (!orderIds.length) return { labByOrder: new Map(), imagingByOrder: new Map(), procedureByOrder: new Map() };
  const [labOrders, imagingOrders, procedureOrders] = await Promise.all([
    LabOrder.find({ order_id: { $in: orderIds } }).lean(),
    ImagingOrder.find({ order_id: { $in: orderIds } }).lean(),
    ProcedureOrder.find({ order_id: { $in: orderIds } }).lean(),
  ]);
  return {
    labByOrder: new Map(labOrders.map((item) => [String(item.order_id), item])),
    imagingByOrder: new Map(imagingOrders.map((item) => [String(item.order_id), item])),
    procedureByOrder: new Map(procedureOrders.map((item) => [String(item.order_id), item])),
  };
}

function buildPaymentGate({ order, charge, invoice, activeIntent, latestIntent, latestPayment, override }) {
  const allowedActions = [];
  let status = 'unknown';
  let canPerform = false;
  let blockingReason = null;

  if (override) {
    status = 'ready_override';
    canPerform = true;
    allowedActions.push('revoke_override');
  } else if (!order.is_billable) {
    status = 'ready_non_billable';
    canPerform = true;
  } else if (!charge) {
    status = 'blocked_no_charge';
    blockingReason = 'Order chưa có charge.';
    allowedActions.push('create_payment_flow', 'create_charge');
  } else if ([CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT].includes(charge.status)) {
    status = 'blocked_charge_not_posted';
    blockingReason = 'Charge chưa post.';
    allowedActions.push('post_charge', 'create_payment_flow');
  } else if (!invoice) {
    status = 'blocked_no_invoice';
    blockingReason = 'Charge chưa lên hóa đơn.';
    allowedActions.push('create_invoice', 'create_payment_flow');
  } else if ([PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.REFUNDED_MANUAL, PAYMENT_STATUS.VOIDED].includes(latestPayment?.status)) {
    status = 'refunded_or_voided';
    blockingReason = 'Payment đã refund/void.';
    allowedActions.push('review_refund_void');
  } else if (Number(invoice.balance_due || 0) <= 0 || invoice.status === INVOICE_STATUS.PAID) {
    status = 'ready_paid';
    canPerform = true;
    allowedActions.push('open_receipt');
  } else if (invoice.status === INVOICE_STATUS.DRAFT) {
    status = 'blocked_invoice_draft';
    blockingReason = 'Invoice chưa phát hành.';
    allowedActions.push('issue_invoice', 'create_payment_flow');
  } else if (activeIntent?.status === PAYMENT_INTENT_STATUS.MANUAL_REVIEW) {
    status = 'manual_review';
    blockingReason = activeIntent.manual_review_reason || 'Payment cần manual review.';
    allowedActions.push('open_review', 'confirm_manual', 'reject_manual', 'override');
  } else if (activeIntent && WAITING_CONFIRMATION_STATUSES.includes(activeIntent.status)) {
    status = activeIntent.status === PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT ? 'submitted_receipt' : 'waiting_confirmation';
    blockingReason = 'Đang chờ xác nhận QR/chuyển khoản.';
    allowedActions.push('view_receipt', 'confirm_manual', 'reject_manual');
  } else if ((activeIntent && isExpiredIntent(activeIntent)) || ERROR_INTENT_STATUSES.includes(latestIntent?.status)) {
    status = 'payment_failed_or_expired';
    blockingReason = 'Payment lỗi, bị từ chối hoặc hết hạn.';
    allowedActions.push('recreate_payment_intent', 'create_payment_flow');
  } else {
    status = 'waiting_payment';
    blockingReason = 'Invoice còn balance due.';
    allowedActions.push('create_payment_intent', 'show_qr', 'request_payment');
  }

  return {
    status,
    can_perform: canPerform,
    blocking: !canPerform,
    blocking_reason: blockingReason,
    allowed_actions: allowedActions,
    required_amount: Number(invoice?.total_amount || charge?.total_amount || 0),
    paid_amount: Number(invoice?.paid_amount || 0),
    balance_due: Number(invoice?.balance_due || charge?.total_amount || 0),
  };
}

async function loadPaymentMaps(orderIds = []) {
  const now = new Date();
  const [charges, overrides, childMaps] = await Promise.all([
    Charge.find({ order_id: { $in: orderIds } })
      .sort({ created_at: -1 })
      .populate('service_id', 'service_code service_name service_type unit_price is_billable status department_id')
      .lean(),
    ClinicalPaymentOverride.find({
      order_id: { $in: orderIds },
      status: 'active',
      $or: [{ expires_at: { $exists: false } }, { expires_at: null }, { expires_at: { $gt: now } }],
    }).sort({ approved_at: -1, created_at: -1 }).lean(),
    loadChildOrders(orderIds),
  ]);
  const activeCharges = charges.filter((charge) => ACTIVE_CHARGE_STATUSES.includes(charge.status));
  const chargeByOrder = firstByGroup(activeCharges, (charge) => charge.order_id);
  const invoiceIds = [...new Set(activeCharges.map((charge) => getId(charge.invoice_id)).filter(Boolean).map(String))];
  const [invoices, intents, payments] = await Promise.all([
    invoiceIds.length ? Invoice.find({ _id: { $in: invoiceIds } }).lean() : [],
    invoiceIds.length ? PaymentIntent.find({ invoice_id: { $in: invoiceIds } }).sort({ created_at: -1 }).lean() : [],
    invoiceIds.length ? Payment.find({ invoice_id: { $in: invoiceIds } }).sort({ paid_at: -1, created_at: -1 }).lean() : [],
  ]);

  const invoiceById = new Map(invoices.map((invoice) => [String(invoice._id), invoice]));
  const latestIntentByInvoice = firstByGroup(intents, (intent) => intent.invoice_id);
  const latestPaymentByInvoice = firstByGroup(payments, (payment) => payment.invoice_id);
  const overrideByOrder = firstByGroup(overrides, (override) => override.order_id);
  const activeIntentByInvoice = new Map();
  for (const intent of intents) {
    const key = String(intent.invoice_id);
    if (!ACTIVE_INTENT_STATUSES.includes(intent.status)) continue;
    if (activeIntentByInvoice.has(key)) continue;
    activeIntentByInvoice.set(key, intent);
  }

  return {
    childMaps,
    chargeByOrder,
    invoiceById,
    latestIntentByInvoice,
    activeIntentByInvoice,
    latestPaymentByInvoice,
    overrideByOrder,
  };
}

function buildPaymentRow(order, maps) {
  const charge = maps.chargeByOrder.get(String(order._id)) || null;
  const invoiceId = getId(charge?.invoice_id);
  const invoice = invoiceId ? maps.invoiceById.get(String(invoiceId)) || null : null;
  const activeIntent = invoice ? maps.activeIntentByInvoice.get(String(invoice._id)) || null : null;
  const latestIntent = invoice ? maps.latestIntentByInvoice.get(String(invoice._id)) || null : null;
  const latestPayment = invoice ? maps.latestPaymentByInvoice.get(String(invoice._id)) || null : null;
  const override = maps.overrideByOrder.get(String(order._id)) || null;
  const paymentGate = buildPaymentGate({ order, charge, invoice, activeIntent, latestIntent, latestPayment, override });
  return {
    order: orderMini(order),
    clinical_order: childMini(order, maps.childMaps),
    patient: patientMini(order.patient_id),
    encounter: encounterMini(order.encounter_id),
    service: serviceMini(order.service_id),
    charge,
    invoice,
    payment_intent: activeIntent || latestIntent,
    payment: latestPayment,
    override,
    payment_gate: paymentGate,
  };
}

function addDateRange(filter, fieldName, query, fromKey = 'date_from', toKey = 'date_to') {
  const from = normalizeDate(query[fromKey], fromKey);
  const to = normalizeDate(query[toKey], toKey);
  if (!from && !to) return;
  filter[fieldName] = { ...(filter[fieldName] || {}) };
  if (from) filter[fieldName].$gte = from;
  if (to) filter[fieldName].$lte = to;
}

async function buildOrderFilter(query = {}) {
  const serviceType = query.service_type || query.order_type;
  const orderTypes = serviceType ? String(serviceType).split(',').map((item) => item.trim()).filter(Boolean) : CLINICAL_SERVICE_TYPES;
  const invalid = orderTypes.filter((type) => !CLINICAL_SERVICE_TYPES.includes(type));
  if (invalid.length) throw createError(`service_type không thuộc CLS: ${invalid.join(', ')}`, 400);
  const filter = { order_type: { $in: orderTypes } };
  if (query.order_id) filter._id = query.order_id;
  for (const field of ['patient_id', 'encounter_id', 'admission_id', 'department_id', 'priority', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.order_status) filter.status = query.order_status;
  if (query.is_billable !== undefined && query.is_billable !== '') filter.is_billable = query.is_billable === true || query.is_billable === 'true';
  addDateRange(filter, 'ordered_at', query);

  const keyword = normalizeString(query.q || query.keyword || query.search || query.patient_keyword);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    const [patients, encounters] = await Promise.all([
      Patient.find({
        $or: [
          { patient_code: { $regex: pattern, $options: 'i' } },
          { full_name: { $regex: pattern, $options: 'i' } },
          { phone: { $regex: pattern, $options: 'i' } },
        ],
      }).select('_id').limit(500).lean(),
      Encounter.find({ encounter_code: { $regex: pattern, $options: 'i' } }).select('_id').limit(500).lean(),
    ]);
    filter.$or = [
      { order_no: { $regex: pattern, $options: 'i' } },
      { clinical_indication: { $regex: pattern, $options: 'i' } },
      ...(patients.length ? [{ patient_id: { $in: patients.map((patient) => patient._id) } }] : []),
      ...(encounters.length ? [{ encounter_id: { $in: encounters.map((encounter) => encounter._id) } }] : []),
    ];
  }
  return filter;
}

function applyRowFilters(rows, query = {}) {
  let result = rows;
  if (query.gate_status) {
    const gates = String(query.gate_status).split(',').map((item) => item.trim()).filter(Boolean);
    result = result.filter((row) => gates.includes(row.payment_gate.status));
  }
  if (query.blocking_only === true || query.blocking_only === 'true') result = result.filter((row) => row.payment_gate.blocking);
  if (query.ready_only === true || query.ready_only === 'true') result = result.filter((row) => row.payment_gate.can_perform);
  if (query.intent_status) result = result.filter((row) => row.payment_intent?.status === query.intent_status);
  if (query.payment_status) result = result.filter((row) => row.payment?.status === query.payment_status);
  if (query.invoice_status) result = result.filter((row) => row.invoice?.status === query.invoice_status);
  if (query.charge_status) result = result.filter((row) => row.charge?.status === query.charge_status);
  if (query.has_receipt === true || query.has_receipt === 'true') result = result.filter((row) => Boolean(row.payment_intent?.receipt_image_url || row.payment?.receipt_image_url));
  if (query.has_manual_review === true || query.has_manual_review === 'true') result = result.filter((row) => row.payment_gate.status === 'manual_review');
  return result;
}

async function listOrders(query = {}, actor = {}) {
  assertStaffRead(actor);
  const { page, limit } = getPagination(query, 25, 500);
  const filter = await buildOrderFilter(query);
  const rawLimit = Math.min(Math.max(page * limit * 3, 250), 1500);
  const orders = await Order.find(filter)
    .sort({ ordered_at: -1, created_at: -1 })
    .limit(rawLimit)
    .populate('patient_id', 'patient_code full_name phone gender date_of_birth')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
    .populate('service_id', 'service_code service_name service_type unit_price is_billable status department_id')
    .lean();
  const maps = await loadPaymentMaps(orders.map((order) => order._id));
  const filteredRows = applyRowFilters(orders.map((order) => buildPaymentRow(order, maps)), query);
  const total = filteredRows.length;
  return {
    items: filteredRows.slice((page - 1) * limit, page * limit),
    pagination: buildPagination(page, limit, total),
  };
}

function listWaitingPayment(query = {}, actor = {}) {
  return listOrders({ ...query, blocking_only: true }, actor);
}

function listReadyToPerform(query = {}, actor = {}) {
  return listOrders({ ...query, ready_only: true }, actor);
}

function listWaitingConfirmation(query = {}, actor = {}) {
  return listOrders({ ...query, gate_status: 'waiting_confirmation,submitted_receipt' }, actor);
}

function listManualReview(query = {}, actor = {}) {
  return listOrders({ ...query, gate_status: 'manual_review' }, actor);
}

function listPaymentErrors(query = {}, actor = {}) {
  return listOrders({ ...query, gate_status: 'payment_failed_or_expired,refunded_or_voided' }, actor);
}

async function getOrderPaymentGate(orderId, actor = {}) {
  const data = await listOrders({ order_id: orderId, limit: 1 }, actor);
  let row = data.items.find((item) => sameId(item.order._id, orderId));
  if (!row) {
    const order = await Order.findById(orderId)
      .populate('patient_id', 'patient_code full_name phone gender date_of_birth')
      .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
      .populate('service_id', 'service_code service_name service_type unit_price is_billable status department_id')
      .lean();
    if (!order) throw createError('Không tìm thấy order.', 404);
    if (!CLINICAL_SERVICE_TYPES.includes(order.order_type)) throw createError('Order không thuộc cận lâm sàng/thủ thuật.', 409);
    const maps = await loadPaymentMaps([order._id]);
    row = buildPaymentRow(order, maps);
  }
  return row;
}

async function createPaymentFlow(orderId, payload = {}, actor = {}, requestMeta = {}) {
  assertPaymentFlow(actor);
  let row = await getOrderPaymentGate(orderId, actor);
  if (!row.order.is_billable) return { ...row, skipped: true, reason: 'Order không billable.' };

  if (!row.charge && payload.charge_policy !== 'skip') {
    await clinicalBillingService.createChargeForClinicalOrder(orderId, {
      ...(payload.charge || {}),
      status: payload.charge_status || CHARGE_STATUS.POSTED,
      post_immediately: payload.charge_status ? payload.charge_status === CHARGE_STATUS.POSTED : true,
    }, actor, requestMeta);
    row = await getOrderPaymentGate(orderId, actor);
  }

  if (row.charge && [CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT].includes(row.charge.status) && payload.post_charge !== false) {
    await billingService.postCharge(row.charge._id, actor, requestMeta);
    row = await getOrderPaymentGate(orderId, actor);
  }

  if (row.charge && row.charge.status === CHARGE_STATUS.POSTED && !row.invoice && payload.invoice_policy !== 'skip') {
    await billingService.createInvoiceFromCharges({
      charge_ids: [row.charge._id],
      patient_id: row.patient?._id,
      encounter_id: row.encounter?._id,
      issue_immediately: false,
    }, actor, requestMeta);
    row = await getOrderPaymentGate(orderId, actor);
  }

  if (row.invoice && row.invoice.status === INVOICE_STATUS.DRAFT && payload.issue_invoice !== false) {
    await billingService.issueInvoice(row.invoice._id, actor, requestMeta);
    row = await getOrderPaymentGate(orderId, actor);
  }

  let paymentIntent = row.payment_intent;
  if (row.invoice && Number(row.invoice.balance_due || 0) > 0 && [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID].includes(row.invoice.status)) {
    paymentIntent = await paymentIntentService.createPaymentIntent(row.invoice._id, {
      provider: payload.provider || PAYMENT_PROVIDER.BANK_QR_MANUAL,
      method: payload.method,
      force_new: payload.force_new_intent === true || payload.force_new === true,
      payment_note: payload.payment_note || payload.note || 'Thu tiền trước thực hiện CLS',
      amount: payload.amount,
      allow_partial: payload.allow_partial,
    }, actor, requestMeta);
  }
  const refreshed = await getOrderPaymentGate(orderId, actor);
  await recordAuditLog({
    actor,
    action: 'clinical_payment.payment_flow_created',
    targetType: 'order',
    targetId: orderId,
    status: 'success',
    message: 'Tạo luồng thanh toán cận lâm sàng thành công.',
    requestMeta,
    metadata: {
      charge_id: refreshed.charge?._id,
      invoice_id: refreshed.invoice?._id,
      payment_intent_id: paymentIntent?._id || paymentIntent?.payment_intent_id,
    },
  });
  return { ...refreshed, payment_intent: paymentIntent || refreshed.payment_intent };
}

async function getDashboard(query = {}, actor = {}) {
  assertStaffRead(actor);
  const rowsData = await listOrders({
    ...query,
    date_from: query.date_from || startOfToday().toISOString(),
    date_to: query.date_to || endOfToday().toISOString(),
    limit: 800,
  }, actor);
  const rows = rowsData.items || [];
  const summary = {
    total_orders: rows.length,
    billable_orders: rows.filter((row) => row.order.is_billable).length,
    no_charge_orders: rows.filter((row) => row.payment_gate.status === 'blocked_no_charge').length,
    unbilled_charges: rows.filter((row) => row.payment_gate.status === 'blocked_no_invoice').length,
    unpaid_invoices: rows.filter((row) => ['waiting_payment', 'waiting_confirmation', 'submitted_receipt', 'manual_review', 'payment_failed_or_expired'].includes(row.payment_gate.status)).length,
    ready_to_perform: rows.filter((row) => row.payment_gate.can_perform).length,
    waiting_payment: rows.filter((row) => row.payment_gate.status === 'waiting_payment').length,
    waiting_confirmation: rows.filter((row) => ['waiting_confirmation', 'submitted_receipt'].includes(row.payment_gate.status)).length,
    manual_review: rows.filter((row) => row.payment_gate.status === 'manual_review').length,
    failed_or_expired: rows.filter((row) => row.payment_gate.status === 'payment_failed_or_expired').length,
    total_amount: rows.reduce((sum, row) => sum + Number(row.invoice?.total_amount || row.charge?.total_amount || 0), 0),
    balance_due: rows.reduce((sum, row) => sum + Number(row.payment_gate.balance_due || 0), 0),
  };
  const byType = new Map(CLINICAL_SERVICE_TYPES.map((type) => [type, {
    service_type: type,
    orders: 0,
    paid: 0,
    waiting_payment: 0,
    waiting_confirmation: 0,
    manual_review: 0,
    failed_or_expired: 0,
    balance_due: 0,
  }]));
  for (const row of rows) {
    const item = byType.get(row.order.order_type);
    if (!item) continue;
    item.orders += 1;
    if (row.payment_gate.can_perform) item.paid += 1;
    if (row.payment_gate.status === 'waiting_payment') item.waiting_payment += 1;
    if (['waiting_confirmation', 'submitted_receipt'].includes(row.payment_gate.status)) item.waiting_confirmation += 1;
    if (row.payment_gate.status === 'manual_review') item.manual_review += 1;
    if (row.payment_gate.status === 'payment_failed_or_expired') item.failed_or_expired += 1;
    item.balance_due += Number(row.payment_gate.balance_due || 0);
  }
  const urgentQueue = rows
    .filter((row) => row.payment_gate.blocking && ['stat', 'urgent'].includes(String(row.order.priority || '').toLowerCase()))
    .slice(0, 10);
  return {
    summary,
    by_service_type: Array.from(byType.values()),
    urgent_queue: urgentQueue,
  };
}

async function getEncounterPaymentSummary(encounterId, actor = {}) {
  const rows = await listOrders({ encounter_id: encounterId, limit: 300 }, actor);
  const encounter = await Encounter.findById(encounterId)
    .populate('patient_id', 'patient_code full_name phone gender date_of_birth')
    .populate('department_id', 'department_code department_name')
    .lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  return {
    encounter,
    patient: patientMini(encounter.patient_id),
    summary: {
      total_orders: rows.items.length,
      ready_to_perform: rows.items.filter((row) => row.payment_gate.can_perform).length,
      blocked: rows.items.filter((row) => row.payment_gate.blocking).length,
      total_amount: rows.items.reduce((sum, row) => sum + Number(row.invoice?.total_amount || row.charge?.total_amount || 0), 0),
      paid_amount: rows.items.reduce((sum, row) => sum + Number(row.invoice?.paid_amount || 0), 0),
      balance_due: rows.items.reduce((sum, row) => sum + Number(row.payment_gate.balance_due || 0), 0),
    },
    rows: rows.items,
  };
}

async function confirmIntent(intentId, payload = {}, actor = {}, requestMeta = {}) {
  return paymentIntentService.confirmBankTransfer(intentId, payload, actor, requestMeta);
}

async function rejectIntent(intentId, payload = {}, actor = {}, requestMeta = {}) {
  return paymentIntentService.rejectBankTransfer(intentId, payload, actor, requestMeta);
}

async function manualReviewIntent(intentId, payload = {}, actor = {}, requestMeta = {}) {
  return paymentIntentService.markManualReview(intentId, payload, actor, requestMeta);
}

async function createOverride(orderId, payload = {}, actor = {}, requestMeta = {}) {
  assertOverride(actor);
  const row = await getOrderPaymentGate(orderId, actor);
  const reason = normalizeString(payload.reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  const override = await ClinicalPaymentOverride.create({
    order_id: row.order._id,
    encounter_id: row.encounter?._id,
    patient_id: row.patient?._id,
    invoice_id: row.invoice?._id,
    reason,
    override_type: payload.override_type || 'manager_approved',
    status: 'active',
    approved_by: actor.userId || actor.user_id,
    approved_at: new Date(),
    expires_at: normalizeDate(payload.expires_at, 'expires_at'),
    created_by: actor.userId || actor.user_id,
    updated_by: actor.userId || actor.user_id,
    audit_logs: [{
      action: 'clinical_payment.override_created',
      actor_type: actor.actorType,
      actor_id: actor.userId || actor.user_id,
      at: new Date(),
      reason,
    }],
  });
  await recordAuditLog({
    actor,
    action: 'clinical_payment.override_created',
    targetType: 'clinical_payment_override',
    targetId: override._id,
    status: 'success',
    message: 'Tạo payment override cận lâm sàng thành công.',
    requestMeta,
    metadata: { order_id: orderId },
  });
  return getOrderPaymentGate(orderId, actor);
}

async function listOverrides(query = {}, actor = {}) {
  assertStaffRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  for (const field of ['order_id', 'encounter_id', 'patient_id', 'invoice_id', 'status', 'override_type']) {
    if (query[field]) filter[field] = query[field];
  }
  const [items, total] = await Promise.all([
    ClinicalPaymentOverride.find(filter)
      .sort({ approved_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('order_id', 'order_no order_type priority status')
      .populate('encounter_id', 'encounter_code status start_time')
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
      .lean(),
    ClinicalPaymentOverride.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function revokeOverride(overrideId, payload = {}, actor = {}, requestMeta = {}) {
  assertOverride(actor);
  const override = await ClinicalPaymentOverride.findById(overrideId);
  if (!override) throw createError('Không tìm thấy payment override.', 404);
  if (override.status !== 'active') return override.toObject();
  override.status = 'revoked';
  override.revoked_by = actor.userId || actor.user_id;
  override.revoked_at = new Date();
  override.revoke_reason = normalizeString(payload.reason || payload.revoke_reason) || 'Revoked';
  override.updated_by = actor.userId || actor.user_id;
  override.audit_logs.push({
    action: 'clinical_payment.override_revoked',
    actor_type: actor.actorType,
    actor_id: actor.userId || actor.user_id,
    at: new Date(),
    reason: override.revoke_reason,
  });
  await override.save();
  await recordAuditLog({
    actor,
    action: 'clinical_payment.override_revoked',
    targetType: 'clinical_payment_override',
    targetId: override._id,
    status: 'success',
    message: 'Revoke payment override cận lâm sàng thành công.',
    requestMeta,
  });
  return override.toObject();
}

async function listRefundVoidCases(query = {}, actor = {}) {
  assertStaffRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const services = await ServiceCatalog.find({ service_type: { $in: CLINICAL_SERVICE_TYPES }, is_deleted: false }).select('_id').lean();
  const chargeFilter = { service_id: { $in: services.map((service) => service._id) } };
  const invoiceIds = await Charge.distinct('invoice_id', { ...chargeFilter, invoice_id: { $exists: true, $ne: null } });
  const paymentFilter = {
    invoice_id: { $in: invoiceIds },
    $or: [
      { status: { $in: [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.REFUNDED_MANUAL, PAYMENT_STATUS.VOIDED] } },
      { refund_status: { $in: ['requested', 'approved', 'processed', 'rejected'] } },
    ],
  };
  const [payments, total] = await Promise.all([
    Payment.find(paymentFilter)
      .sort({ updated_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
      .populate('patient_id', 'patient_code full_name phone')
      .lean(),
    Payment.countDocuments(paymentFilter),
  ]);
  return {
    items: payments.map((payment) => ({
      type: payment.status === PAYMENT_STATUS.VOIDED ? 'payment_void' : 'payment_refund',
      payment,
      invoice: payment.invoice_id,
      patient: patientMini(payment.patient_id),
      amount: payment.refund_amount || payment.amount,
      status: payment.refund_status || payment.status,
      reason: payment.refund_reason || payment.void_reason,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

module.exports = {
  getDashboard,
  listOrders,
  listWaitingPayment,
  listReadyToPerform,
  listWaitingConfirmation,
  listManualReview,
  listPaymentErrors,
  getOrderPaymentGate,
  createPaymentFlow,
  getEncounterPaymentSummary,
  confirmIntent,
  rejectIntent,
  manualReviewIntent,
  createOverride,
  listOverrides,
  revokeOverride,
  listRefundVoidCases,
};
