const { Types } = require('mongoose');
const {
  Dispense,
  InventoryTransaction,
  MedicationMaster,
  Notification,
  Patient,
  Prescription,
  PrescriptionRefillRequest,
  StockBatch,
  Warehouse,
} = require('../models');
const pharmacyAlertService = require('./pharmacy-alert.service');
const pharmacyDispensingService = require('./pharmacy-dispensing.service');
const pharmacyOverviewService = require('./pharmacy-overview.service');
const prescriptionService = require('./prescription.service');
const workspaceAccessService = require('./workspace-access.service');

const SEARCH_LIMIT = 6;

const PHARMACY_COMMAND_MENUS = [
  { id: 'overview', group: 'Tổng quan nhà thuốc', label: 'Bảng điều khiển nhà thuốc', route: '/pharmacy/overview', keywords: ['dashboard', 'tong quan'] },
  { id: 'approval', group: 'Đơn thuốc', label: 'Chờ duyệt dược', route: '/pharmacy/prescriptions/pharmacy-approval', keywords: ['duyet duoc', 'verify'] },
  { id: 'review-needed', group: 'Đơn thuốc', label: 'Cần kiểm tra', route: '/pharmacy/prescriptions/review-needed', keywords: ['di ung', 'tuong tac', 'thieu ton'] },
  { id: 'dispense-queue', group: 'Cấp phát thuốc', label: 'Hàng đợi cấp phát', route: '/pharmacy/dispensing/queue', keywords: ['cap phat', 'queue'] },
  { id: 'preparing', group: 'Cấp phát thuốc', label: 'Phiếu đang chuẩn bị', route: '/pharmacy/dispensing/preparing-slips', keywords: ['dang chuan bi', 'picking'] },
  { id: 'partial', group: 'Cấp phát thuốc', label: 'Cấp phát một phần', route: '/pharmacy/prescriptions/partial-dispense', keywords: ['partial', 'mot phan'] },
  { id: 'low-stock', group: 'Cảnh báo', label: 'Sắp hết thuốc', route: '/pharmacy/alerts/low-stock', keywords: ['ton kho thap', 'low stock'] },
  { id: 'expiring', group: 'Kho thuốc', label: 'Lô sắp hết hạn', route: '/pharmacy/inventory/expiring-batches', keywords: ['het han', 'expiry'] },
  { id: 'quarantine', group: 'Kho thuốc', label: 'Cách ly / thu hồi', route: '/pharmacy/inventory/quarantine-recall', keywords: ['recall', 'cach ly'] },
  { id: 'transactions', group: 'Nhập và xuất kho', label: 'Trung tâm giao dịch kho', route: '/pharmacy/transactions/center', keywords: ['nhap kho', 'xuat kho', 'transfer'] },
  { id: 'receive-stock', group: 'Nhập và xuất kho', label: 'Nhập kho', route: '/pharmacy/transactions/receive-stock', keywords: ['receipt', 'nhap hang'] },
  { id: 'refill', group: 'Đơn thuốc', label: 'Yêu cầu cấp lại thuốc', route: '/pharmacy/prescriptions/refill-requests', keywords: ['refill', 'cap lai'] },
];

function toId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return String(value);
  if (value._id) return toId(value._id);
  if (value.id) return toId(value.id);
  return typeof value.toString === 'function' ? value.toString() : null;
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || actor.user?.id || actor.user?._id || null;
}

function actorRoles(actor = {}) {
  return Array.isArray(actor.roles) ? actor.roles : actor.user?.roles || [];
}

function actorPermissions(actor = {}) {
  return Array.isArray(actor.permissions) ? actor.permissions : actor.user?.permissions || [];
}

function actorProfile(actor = {}) {
  const user = actor.user || {};
  return {
    user_id: toId(actorUserId(actor)),
    display_name: user.full_name || user.display_name || user.name || actor.full_name || actor.username || 'Dược sĩ',
    email: user.email || actor.email || actor.username || null,
    username: user.username || actor.username || null,
    roles: actorRoles(actor),
    department_id: toId(actor.departmentId || actor.department_id || user.department_id),
    department_name: actor.department_name || user.department_name || user.department_id?.name || null,
    online_status: 'online',
  };
}

function normalizeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function regexFor(search) {
  return new RegExp(escapeRegex(search), 'i');
}

function resolveShift(value) {
  const normalized = String(value || '').toLowerCase();
  if (['morning', 'afternoon', 'night'].includes(normalized)) return normalized;
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 22) return 'afternoon';
  return 'night';
}

function shiftLabel(shift) {
  if (shift === 'morning') return 'Ca sáng';
  if (shift === 'afternoon') return 'Ca chiều';
  if (shift === 'night') return 'Ca đêm';
  return 'Ca trực';
}

function compactError(result) {
  if (result.status !== 'rejected') return null;
  return result.reason?.message || 'Không thể tải dữ liệu.';
}

async function safeServiceCall(task) {
  try {
    return await task();
  } catch (error) {
    return { __error: error?.message || 'Không thể tải dữ liệu.' };
  }
}

async function resolveStore(query = {}) {
  const storeId = query.store_id || query.warehouse_id;
  if (storeId && Types.ObjectId.isValid(storeId)) {
    const store = await Warehouse.findById(storeId).lean();
    if (store) return store;
  }
  return Warehouse.findOne({ status: 'active', type: { $in: ['pharmacy', 'central'] }, is_deleted: { $ne: true } })
    .sort({ type: -1, name: 1 })
    .lean();
}

function normalizeAlertItems(alertSummary = {}, queueSummary = {}) {
  const byType = alertSummary.by_type || {};
  const items = [
    {
      code: 'low_stock',
      label: 'Tồn kho thấp',
      count: normalizeNumber(byType.low_stock),
      severity: 'high',
      route: '/pharmacy/alerts/low-stock',
    },
    {
      code: 'out_of_stock',
      label: 'Hết thuốc',
      count: normalizeNumber(byType.out_of_stock),
      severity: 'critical',
      route: '/pharmacy/alerts/out-of-stock',
    },
    {
      code: 'expiring_batches',
      label: 'Lô sắp hết hạn',
      count: normalizeNumber(byType.batch_expiring || byType.near_expiry),
      severity: 'warning',
      route: '/pharmacy/inventory/expiring-batches',
    },
    {
      code: 'expired_batches',
      label: 'Lô hết hạn',
      count: normalizeNumber(byType.batch_expired || byType.expired),
      severity: 'critical',
      route: '/pharmacy/inventory/expired-batches',
    },
    {
      code: 'recall_or_quarantine',
      label: 'Recall / cách ly',
      count: normalizeNumber(byType.recall || byType.recalled) + normalizeNumber(byType.quarantine || byType.quarantined),
      severity: 'critical',
      route: '/pharmacy/inventory/quarantine-recall',
    },
    {
      code: 'allergy_warnings',
      label: 'Dị ứng thuốc',
      count: normalizeNumber(byType.allergy_conflict || byType.allergy),
      severity: 'critical',
      route: '/pharmacy/alerts/allergy',
    },
    {
      code: 'interaction_warnings',
      label: 'Tương tác thuốc',
      count: normalizeNumber(byType.interaction),
      severity: 'high',
      route: '/pharmacy/alerts/interactions',
    },
    {
      code: 'over_sla',
      label: 'Đơn quá SLA',
      count: normalizeNumber(queueSummary.over_sla || byType.dispense_sla_breached),
      severity: 'warning',
      route: '/pharmacy/dispensing/queue?filter=overdue',
    },
    {
      code: 'refill_requests',
      label: 'Refill mới',
      count: normalizeNumber(queueSummary.refill_requests),
      severity: 'info',
      route: '/pharmacy/prescriptions/refill-requests',
    },
  ];

  const alertTotal = items.reduce((sum, item) => sum + item.count, 0);
  return {
    alert_total: alertTotal || normalizeNumber(alertSummary.total_open),
    critical: normalizeNumber(alertSummary.critical) || items.filter((item) => item.severity === 'critical').reduce((sum, item) => sum + item.count, 0),
    high: normalizeNumber(alertSummary.high) || items.filter((item) => item.severity === 'high').reduce((sum, item) => sum + item.count, 0),
    warning: items.filter((item) => item.severity === 'warning').reduce((sum, item) => sum + item.count, 0),
    items,
    last_updated_at: new Date(),
  };
}

function normalizeCounters(dashboard = {}, queueSummary = {}, alertSummary = {}, refillRequests = 0) {
  const kpis = dashboard.kpis || {};
  const byType = alertSummary.by_type || {};
  return {
    pending_verify: normalizeNumber(queueSummary.waiting_prescriptions || kpis.prescriptions_pending_verify),
    waiting_dispense: normalizeNumber(queueSummary.draft_dispenses || kpis.prescriptions_verified_waiting_dispense),
    preparing: normalizeNumber(queueSummary.preparing || queueSummary.assigned || kpis.dispense_draft),
    partially_dispensed: normalizeNumber(queueSummary.partially_dispensed || kpis.prescriptions_partially_dispensed),
    low_stock: normalizeNumber(byType.low_stock || dashboard.inventory_summary?.low_stock || kpis.low_stock),
    expiring_batches: normalizeNumber(byType.batch_expiring || byType.near_expiry || dashboard.inventory_summary?.near_expiry || kpis.near_expiry),
    recall_or_quarantine: normalizeNumber(byType.recall || byType.recalled) + normalizeNumber(byType.quarantine || byType.quarantined),
    refill_requests: normalizeNumber(refillRequests),
    allergy_warning: normalizeNumber(queueSummary.allergy_warning || byType.allergy_conflict || byType.allergy),
    stock_shortage: normalizeNumber(queueSummary.stock_shortage || byType.dispense_shortage || byType.insufficient_stock),
    over_sla: normalizeNumber(queueSummary.over_sla || byType.dispense_sla_breached || kpis.dispense_sla_breached),
  };
}

async function getNotificationPreview(actor = {}) {
  const userId = actorUserId(actor);
  if (!userId) return [];
  const filters = [{ recipient_actor_id: userId }];
  if (Types.ObjectId.isValid(userId)) filters.push({ recipient_user_id: new Types.ObjectId(userId) });

  const rows = await Notification.find({ $or: filters, archived_at: { $exists: false } })
    .sort({ read_at: 1, created_at: -1 })
    .limit(8)
    .lean();

  return rows.map((item) => ({
    notification_id: toId(item._id),
    title: item.title,
    body: item.body || item.message,
    priority: item.priority || 'normal',
    type: item.notification_type || item.event_type || 'system',
    action_url: item.action_url || item.data?.route || item.payload?.route || null,
    patient_id: toId(item.patient_id),
    read_at: item.read_at,
    created_at: item.created_at,
  }));
}

async function getTopbarBootstrap(query = {}, actor = {}) {
  const [dashboardResult, queueResult, alertResult, notificationResult, refillResult, storeResult] = await Promise.allSettled([
    safeServiceCall(() => pharmacyOverviewService.getDashboard(query, actor)),
    safeServiceCall(() => pharmacyDispensingService.getDispensingQueueSummary(query, actor)),
    safeServiceCall(() => pharmacyAlertService.getAlertSummary(query, actor)),
    safeServiceCall(() => getNotificationPreview(actor)),
    safeServiceCall(() => PrescriptionRefillRequest.countDocuments({ status: { $in: ['pending', 'submitted', 'under_review'] } })),
    safeServiceCall(() => resolveStore(query)),
  ]);

  const dashboard = dashboardResult.value?.__error ? {} : dashboardResult.value || {};
  const queueSummary = queueResult.value?.__error ? {} : queueResult.value || {};
  const alertSummary = alertResult.value?.__error ? {} : alertResult.value || {};
  const notifications = notificationResult.value?.__error ? [] : notificationResult.value || [];
  const refillRequests = refillResult.value?.__error ? 0 : normalizeNumber(refillResult.value);
  const store = storeResult.value?.__error ? null : storeResult.value;
  const shift = resolveShift(query.shift);
  const counters = normalizeCounters(dashboard, queueSummary, alertSummary, refillRequests);
  const alert_summary = normalizeAlertItems(alertSummary, { ...queueSummary, refill_requests: refillRequests });
  const workspaceAccess = workspaceAccessService.getAvailableWorkspaces(actor, {
    current_workspace: 'pharmacy',
    badges: {
      pharmacy: {
        alerts: alert_summary.alert_total,
        tasks: counters.waiting_dispense + counters.pending_verify,
      },
    },
  });

  return {
    profile: actorProfile(actor),
    workspace: {
      code: 'pharmacy',
      name: 'Nhà thuốc & Kho dược',
      current_store: store?.name || 'Quầy thuốc ngoại trú',
      current_store_id: toId(store?._id),
      current_shift: shiftLabel(shift),
      shift,
      available_workspaces: workspaceAccess.available_workspaces,
      current_workspace: workspaceAccess.current_workspace,
    },
    permissions: actorPermissions(actor),
    roles: actorRoles(actor),
    counters,
    shift_summary: alert_summary,
    alert_summary,
    notification_preview: notifications,
    quick_actions: [
      { code: 'dispense_queue', label: 'Hàng đợi cấp phát', route: '/pharmacy/dispensing/queue', count: counters.waiting_dispense },
      { code: 'verify', label: 'Chờ duyệt dược', route: '/pharmacy/prescriptions/pharmacy-approval', count: counters.pending_verify },
      { code: 'receive_stock', label: 'Nhập kho', route: '/pharmacy/transactions/receive-stock' },
      { code: 'low_stock', label: 'Tồn kho thấp', route: '/pharmacy/alerts/low-stock', count: counters.low_stock },
    ],
    data_sources: {
      dashboard: !dashboardResult.value?.__error,
      queue_summary: !queueResult.value?.__error,
      alert_summary: !alertResult.value?.__error,
      notifications: !notificationResult.value?.__error,
      errors: [dashboardResult, queueResult, alertResult, notificationResult, refillResult, storeResult].map(compactError).filter(Boolean),
    },
    generated_at: new Date(),
  };
}

async function getAlertSummary(query = {}, actor = {}) {
  const [alertSummary, queueSummary, refillRequests] = await Promise.all([
    pharmacyAlertService.getAlertSummary(query, actor),
    pharmacyDispensingService.getDispensingQueueSummary(query, actor).catch(() => ({})),
    PrescriptionRefillRequest.countDocuments({ status: { $in: ['pending', 'submitted', 'under_review'] } }).catch(() => 0),
  ]);
  return normalizeAlertItems(alertSummary, { ...queueSummary, refill_requests: refillRequests });
}

async function claimPrescriptionForDispense(prescriptionId, payload = {}, actor = {}, requestMeta = {}) {
  const assignedTo = payload.assigned_to || actorUserId(actor);
  let dispense = await Dispense.findOne({ prescription_id: prescriptionId, status: 'draft' })
    .sort({ created_at: -1 })
    .lean();

  if (!dispense) {
    const created = await prescriptionService.createDispense(prescriptionId, {
      ...payload,
      assigned_to: assignedTo,
      priority: payload.priority || 'medium',
    }, actor, requestMeta);
    dispense = created.dispense || created;
  } else {
    await pharmacyDispensingService.assignDispense(dispense._id, {
      assigned_to: assignedTo,
      priority: payload.priority,
      sla_due_at: payload.sla_due_at,
    }, actor, requestMeta);
  }

  await pharmacyDispensingService.lockDispense(dispense._id || dispense.dispense_id, {
    lock_ttl_minutes: payload.lock_ttl_minutes || 30,
    force: payload.force === true,
  }, actor, requestMeta);

  return prescriptionService.getDispenseDetail(dispense._id || dispense.dispense_id, actor);
}

function compactPatient(patient = {}) {
  return {
    patient_id: toId(patient._id || patient.patient_id),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    gender: patient.gender,
    phone: patient.phone,
    date_of_birth: patient.date_of_birth,
  };
}

function medicationResult(item = {}) {
  const id = toId(item._id);
  return {
    id,
    title: item.brand_name || item.generic_name || item.medication_code || 'Thuốc',
    meta: [item.generic_name, item.strength, item.dosage_form, item.route_default, item.unit].filter(Boolean).join(' · '),
    route: `/pharmacy/inventory/medication-catalog?medication_id=${id}`,
    status: item.status,
    actions: [
      { label: 'Xem tồn', route: `/pharmacy/inventory/current-stock?medication_id=${id}` },
      { label: 'Tạo nhập kho', route: `/pharmacy/transactions/receive-stock?medication_id=${id}` },
      { label: 'Lịch sử giao dịch', route: `/pharmacy/transactions/history?medication_id=${id}` },
    ],
  };
}

function prescriptionResult(item = {}) {
  const id = toId(item._id);
  const patient = compactPatient(item.patient_id);
  return {
    id,
    title: item.prescription_no || 'Đơn thuốc',
    meta: [patient.full_name, patient.patient_code, item.status].filter(Boolean).join(' · '),
    route: `/pharmacy/prescriptions/${id}`,
    status: item.status,
    patient,
    actions: [
      { label: 'Mở đơn', route: `/pharmacy/prescriptions/${id}` },
      { label: 'Nhận xử lý', route: `/pharmacy/dispensing/queue?prescription_id=${id}` },
      { label: 'Duyệt dược', route: `/pharmacy/prescriptions/pharmacy-approval?prescription_id=${id}` },
    ],
  };
}

function dispenseResult(item = {}) {
  const id = toId(item._id);
  const patient = compactPatient(item.patient_id);
  return {
    id,
    title: item.dispense_no || 'Phiếu cấp phát',
    meta: [item.prescription_id?.prescription_no, patient.full_name, item.status, item.workflow_stage].filter(Boolean).join(' · '),
    route: `/pharmacy/dispensing/queue?dispense_id=${id}`,
    status: item.status,
    patient,
    actions: [
      { label: 'Xem phiếu', route: `/pharmacy/dispensing/queue?dispense_id=${id}` },
      { label: 'Chuẩn bị thuốc', route: `/pharmacy/dispensing/preparing-slips?dispense_id=${id}` },
      { label: 'In nhãn', route: `/pharmacy/dispensing/labels-instructions?dispense_id=${id}` },
    ],
  };
}

function batchResult(item = {}) {
  const id = toId(item._id);
  const medication = item.medication_id || {};
  return {
    id,
    title: item.batch_no || item.lot_no || 'Lô thuốc',
    meta: [
      medication.brand_name || medication.generic_name,
      `Tồn: ${normalizeNumber(item.quantity_on_hand)}`,
      item.expiry_date ? `HSD: ${new Date(item.expiry_date).toLocaleDateString('vi-VN')}` : null,
      item.storage_location,
      item.status,
    ].filter(Boolean).join(' · '),
    route: `/pharmacy/inventory/batches?batch_id=${id}`,
    status: item.status,
    actions: [
      { label: 'Xem lô', route: `/pharmacy/inventory/batches?batch_id=${id}` },
      { label: 'Điều chỉnh', route: `/pharmacy/transactions/stock-adjustment?batch_id=${id}` },
      { label: 'Cách ly', route: `/pharmacy/inventory/quarantine-recall?batch_id=${id}` },
    ],
  };
}

function transactionResult(item = {}) {
  const id = toId(item._id);
  return {
    id,
    title: item.transaction_no || item.document_no || 'Giao dịch kho',
    meta: [item.transaction_type, item.direction, item.document_no, item.reference_type].filter(Boolean).join(' · '),
    route: `/pharmacy/transactions/history?transaction_id=${id}`,
    status: item.transaction_type,
    actions: [
      { label: 'Xem giao dịch', route: `/pharmacy/transactions/history?transaction_id=${id}` },
    ],
  };
}

function patientResult(item = {}) {
  const id = toId(item._id);
  return {
    id,
    title: item.full_name || 'Bệnh nhân',
    meta: [item.patient_code, item.gender, item.phone].filter(Boolean).join(' · '),
    route: `/pharmacy/patients/${id}`,
    status: item.status,
    actions: [
      { label: 'Mở hồ sơ', route: `/pharmacy/patients/${id}` },
      { label: 'Đơn gần nhất', route: `/pharmacy/prescriptions/history?patient_id=${id}` },
    ],
  };
}

function menuMatches(menu, search) {
  const haystack = normalizeText([menu.group, menu.label, ...(menu.keywords || [])].join(' '));
  return haystack.includes(normalizeText(search));
}

async function search(query = {}, actor = {}) {
  const searchText = String(query.q || query.search || '').trim();
  const limit = Math.min(Number(query.limit) || SEARCH_LIMIT, 20);
  const scope = String(query.scope || 'all').toLowerCase();
  if (searchText.length < 2) {
    return {
      medications: [],
      prescriptions: [],
      dispenses: [],
      stock_batches: [],
      inventory_transactions: [],
      patients: [],
      menus: PHARMACY_COMMAND_MENUS.slice(0, limit),
      quick_actions: [
        { id: 'open_queue', label: 'Mở hàng đợi cấp phát', route: '/pharmacy/dispensing/queue' },
        { id: 'receive_stock', label: 'Tạo phiếu nhập kho', route: '/pharmacy/transactions/receive-stock' },
      ],
    };
  }

  const pattern = regexFor(searchText);
  const shouldLoad = (group) => scope === 'all' || scope === group;

  const [
    medications,
    prescriptions,
    dispenses,
    batches,
    transactions,
    patients,
  ] = await Promise.all([
    shouldLoad('medications')
      ? MedicationMaster.find({
        is_deleted: { $ne: true },
        $or: [
          { medication_code: pattern },
          { generic_name: pattern },
          { brand_name: pattern },
          { strength: pattern },
          { dosage_form: pattern },
          { route_default: pattern },
        ],
      }).limit(limit).lean()
      : [],
    shouldLoad('prescriptions')
      ? Prescription.find({ prescription_no: pattern })
        .sort({ prescribed_at: -1, created_at: -1 })
        .limit(limit)
        .populate('patient_id', 'patient_code full_name gender phone')
        .lean()
      : [],
    shouldLoad('dispenses')
      ? Dispense.find({ dispense_no: pattern })
        .sort({ created_at: -1 })
        .limit(limit)
        .populate('patient_id', 'patient_code full_name gender phone')
        .populate('prescription_id', 'prescription_no status')
        .lean()
      : [],
    shouldLoad('stock_batches')
      ? StockBatch.find({
        is_deleted: { $ne: true },
        $or: [{ batch_no: pattern }, { lot_no: pattern }, { storage_location: pattern }],
      })
        .sort({ expiry_date: 1, created_at: -1 })
        .limit(limit)
        .populate('medication_id', 'medication_code generic_name brand_name strength unit')
        .lean()
      : [],
    shouldLoad('inventory_transactions')
      ? InventoryTransaction.find({
        $or: [
          { transaction_no: pattern },
          { document_no: pattern },
          { reference_type: pattern },
          { reason_code: pattern },
        ],
      })
        .sort({ occurred_at: -1 })
        .limit(limit)
        .lean()
      : [],
    shouldLoad('patients')
      ? Patient.find({
        is_deleted: { $ne: true },
        $or: [
          { patient_code: pattern },
          { full_name: pattern },
          { phone: pattern },
          { insurance_number: pattern },
          { national_id: pattern },
        ],
      })
        .limit(limit)
        .lean()
      : [],
  ]);

  const menus = PHARMACY_COMMAND_MENUS
    .filter((item) => menuMatches(item, searchText))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      title: item.label,
      meta: item.group,
      route: item.route,
      actions: [{ label: 'Mở', route: item.route }],
    }));

  return {
    medications: medications.map(medicationResult),
    prescriptions: prescriptions.map(prescriptionResult),
    dispenses: dispenses.map(dispenseResult),
    stock_batches: batches.map(batchResult),
    inventory_transactions: transactions.map(transactionResult),
    patients: patients.map(patientResult),
    menus,
    quick_actions: [
      { id: 'open_queue', title: 'Mở hàng đợi cấp phát', meta: 'Cấp phát thuốc', route: '/pharmacy/dispensing/queue' },
      { id: 'receive_stock', title: 'Tạo phiếu nhập kho', meta: 'Nhập và xuất kho', route: '/pharmacy/transactions/receive-stock' },
      { id: 'low_stock', title: 'Xem tồn kho thấp', meta: 'Cảnh báo', route: '/pharmacy/alerts/low-stock' },
    ].filter((item) => menuMatches({ group: item.meta, label: item.title, keywords: [] }, searchText)),
    generated_at: new Date(),
  };
}

module.exports = {
  claimPrescriptionForDispense,
  getAlertSummary,
  getTopbarBootstrap,
  search,
};
