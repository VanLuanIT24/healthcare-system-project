import {
  authAPI,
  billingAPI,
  dashboardAPI,
  getApiErrorMessage,
  getApiErrorStatus,
  notificationAPI,
  orderAPI,
  patientAPI,
  preferenceAPI,
  pharmacyOverviewAPI,
  pharmacyReportAPI,
  prescriptionAPI,
  reportAPI,
  request,
  unwrapData,
} from '../utils/api';
import { readStoredAuth } from '../lib/storage';

export { getApiErrorMessage };

export const PHARMACY_PERMISSIONS = {
  prescriptionsRead: ['PRESCRIPTIONS.READ', 'PRESCRIPTIONS.READ_DEPARTMENT', 'PRESCRIPTIONS.READ_OWN'],
  prescriptionsVerify: ['PRESCRIPTIONS.VERIFY'],
  prescriptionsCancel: ['PRESCRIPTIONS.CANCEL', 'PRESCRIPTIONS.CANCEL_BY_POLICY', 'PRESCRIPTIONS.CANCEL_OWN'],
  dispensesRead: ['DISPENSES.READ'],
  dispensesCreate: ['DISPENSES.CREATE'],
  dispensesComplete: ['DISPENSES.COMPLETE'],
  dispensesCancel: ['DISPENSES.CANCEL', 'DISPENSES.CREATE'],
  medicationsRead: ['MEDICATIONS.READ'],
  medicationsCreate: ['MEDICATIONS.CREATE', 'MEDICATIONS.MANAGE'],
  stockBatchesRead: ['STOCK_BATCHES.READ'],
  stockBatchesRecall: ['STOCK_BATCHES.RECALL'],
  stockBatchesMarkExpired: ['STOCK_BATCHES.MARK_EXPIRED'],
  inventoryRead: ['INVENTORY_TRANSACTIONS.READ', 'INVENTORY_TRANSACTIONS.READ_RELATED'],
  inventoryReceipt: ['INVENTORY_TRANSACTIONS.CREATE_RECEIPT'],
  inventoryAdjust: [
    'INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN',
    'INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT',
  ],
  billingRead: ['CHARGES.READ', 'INVOICES.READ', 'PAYMENTS.READ', 'REPORTS.BILLING.READ'],
  notificationsRead: ['NOTIFICATIONS.READ', 'NOTIFICATIONS.READ_OWN', 'NOTIFICATIONS.SELF_READ'],
};

export function normalizePermissionCode(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function normalizePermissionCodes(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => {
    if (typeof value === 'string') return value;
    return value?.permission_code || value?.code || value?.name || value?.permission || '';
  }).map(normalizePermissionCode).filter(Boolean))];
}

export function normalizeRoleCodes(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => {
    if (typeof value === 'string') return value;
    return value?.role_code || value?.code || value?.name || value?.role_name || '';
  }).map((value) => String(value).trim()).filter(Boolean))];
}

export function hasAnyPermission(permissions = [], expected = []) {
  const normalized = normalizePermissionCodes(permissions);
  if (normalized.includes('system.full_access')) return true;

  return expected
    .map(normalizePermissionCode)
    .some((permission) => normalized.includes(permission));
}

export function readItems(response) {
  const payload = unwrapData(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.notifications)) return payload.notifications;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export function readTotal(response) {
  const payload = unwrapData(response);
  const pagination = payload?.pagination || payload?.meta || {};
  return Number(
    pagination.total_items ??
      pagination.totalItems ??
      pagination.total ??
      payload?.total ??
      payload?.count ??
      readItems(response).length ??
      0,
  );
}

export function getSettledPayload(result) {
  return result?.status === 'fulfilled' ? unwrapData(result.value) : null;
}

export function getSettledItems(result) {
  return result?.status === 'fulfilled' ? readItems(result.value) : [];
}

export function getSettledError(result, fallback) {
  if (result?.status !== 'rejected') return '';
  return getApiErrorMessage(result.reason, fallback);
}

export function getSettledStatus(result) {
  if (result?.status !== 'rejected') return 0;
  return getApiErrorStatus(result.reason);
}

export function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86400000 - 1);
  return {
    date: formatLocalDate(start),
    date_from: start.toISOString(),
    date_to: end.toISOString(),
  };
}

function formatLocalDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDateRangeForDate(dateValue) {
  const start = new Date(`${dateValue}T00:00:00`);
  const end = new Date(`${dateValue}T23:59:59.999`);
  return {
    range: 'custom',
    date: dateValue,
    date_from: start.toISOString(),
    date_to: end.toISOString(),
  };
}

export function getRangeQuery(rangeKey = 'today') {
  const now = new Date();
  const days = rangeKey === '30d' ? 30 : rangeKey === '7d' ? 7 : 1;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (days - 1));
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);

  return {
    range: rangeKey,
    date: rangeKey === 'today' ? formatLocalDate(start) : undefined,
    date_from: start.toISOString(),
    date_to: end.toISOString(),
  };
}

function parseDateValue(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function isInsideRange(value, range = {}) {
  const parsed = parseDateValue(value);
  if (!parsed) return true;

  const start = parseDateValue(range.date_from);
  const end = parseDateValue(range.date_to);
  if (start && parsed < start) return false;
  if (end && parsed > end) return false;
  return true;
}

function filterItemsByRange(items = [], range = {}, dateAccessor = (item) => item.created_at) {
  return items.filter((item) => isInsideRange(dateAccessor(item), range));
}

function uniqueItems(items = [], getKey = (item) => item?._id || item?.id) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(getKey(item) || '');
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPrescriptionDate(item) {
  return item.prescribed_at || item.created_at || item.updated_at;
}

function getDispenseDate(item) {
  return item.dispensed_at || item.completed_at || item.created_at || item.updated_at;
}

function getPrescriptionKey(item) {
  return item?.prescription_id || item?._id || item?.id || item?.prescription_no;
}

function getApiPrescriptionStatus(status) {
  const normalized = normalizePermissionCode(status);
  const statusMap = {
    pending: 'active',
    pending_verification: 'active',
    ready: 'verified',
    ready_to_dispense: 'verified',
    dispensed: 'fully_dispensed',
  };
  return statusMap[normalized] || status || undefined;
}

function isPendingPrescriptionStatus(status) {
  return ['draft', 'active', 'pending', 'pending_verification'].includes(String(status || '').toLowerCase());
}

function isReadyPrescriptionStatus(status) {
  return ['verified', 'ready_to_dispense'].includes(String(status || '').toLowerCase());
}

function isDispensedPrescriptionStatus(status) {
  return ['fully_dispensed', 'dispensed', 'completed'].includes(String(status || '').toLowerCase());
}

function extractPermissions(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.permissions)) return payload.permissions;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function extractRoles(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.roles)) return payload.roles;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export async function loadPharmacyIdentity() {
  const storedAuth = readStoredAuth();
  const [meResult, rolesResult, permissionsResult, sessionResult, unreadResult] = await Promise.allSettled([
    authAPI.getMe(),
    authAPI.getMyRoles(),
    authAPI.getMyPermissions(),
    authAPI.getMySession(),
    notificationAPI.unreadCount(),
  ]);

  const me = getSettledPayload(meResult) || storedAuth?.user || {};
  const roles = normalizeRoleCodes(extractRoles(getSettledPayload(rolesResult) || storedAuth?.user?.roles || []));
  const permissions = normalizePermissionCodes(
    extractPermissions(getSettledPayload(permissionsResult) || storedAuth?.user?.permissions || []),
  );
  const unreadPayload = getSettledPayload(unreadResult) || {};

  return {
    user: me?.user || me?.staff || me,
    roles,
    permissions,
    session: getSettledPayload(sessionResult),
    unreadCount: Number(unreadPayload.unread_count ?? unreadPayload.count ?? 0),
    errors: {
      me: getSettledError(meResult, 'Không thể tải hồ sơ dược sĩ.'),
      roles: getSettledError(rolesResult, 'Không thể tải vai trò.'),
      permissions: getSettledError(permissionsResult, 'Không thể tải quyền truy cập.'),
      session: getSettledError(sessionResult, 'Không thể tải phiên đăng nhập.'),
      notifications: getSettledError(unreadResult, 'Không thể tải thông báo.'),
    },
  };
}

export async function searchPharmacyWorkspace(query) {
  const search = String(query || '').trim();
  if (search.length < 2) {
    return [];
  }

  const [prescriptions, patients, medications, stockBatches, orders] = await Promise.allSettled([
    prescriptionAPI.search({ search, q: search, limit: 5 }),
    patientAPI.search({ search, q: search, limit: 5 }),
    prescriptionAPI.searchMedications(search, { limit: 5 }),
    prescriptionAPI.listStockBatches({ search, keyword: search, limit: 5 }),
    orderAPI.search({ search, q: search, type: 'medication', limit: 5 }),
  ]);

  return [
    {
      id: 'prescriptions',
      label: 'Đơn thuốc',
      items: getSettledItems(prescriptions).map((item) => ({
        id: item.prescription_id || item._id || item.id || item.prescription_no,
        title: item.prescription_no || item.code || 'Đơn thuốc',
        meta: [
          item.patient_id?.full_name || item.patient_name,
          item.status,
        ].filter(Boolean).join(' · '),
        to: `/pharmacy/prescriptions/${item.prescription_id || item._id || item.id || ''}`,
      })),
    },
    {
      id: 'patients',
      label: 'Bệnh nhân',
      items: getSettledItems(patients).map((item) => ({
        id: item.patient_id || item._id || item.id || item.patient_code,
        title: item.full_name || item.fullName || item.patient_name || 'Bệnh nhân',
        meta: [item.patient_code, item.phone, item.gender].filter(Boolean).join(' · '),
        to: `/pharmacy/patients/${item.patient_id || item._id || item.id || ''}`,
      })),
    },
    {
      id: 'medications',
      label: 'Thuốc',
      items: getSettledItems(medications).map((item) => ({
        id: item.medication_id || item._id || item.id || item.medication_code,
        title: item.brand_name || item.generic_name || 'Thuốc',
        meta: [item.medication_code, item.strength, item.unit].filter(Boolean).join(' · '),
        to: `/pharmacy/medications/${item.medication_id || item._id || item.id || ''}`,
      })),
    },
    {
      id: 'orders',
      label: 'Y lệnh',
      items: getSettledItems(orders).map((item) => ({
        id: item.order_id || item._id || item.id || item.order_code,
        title: item.order_code || item.title || 'Y lệnh thuốc',
        meta: [item.patient_name, item.status].filter(Boolean).join(' · '),
        to: `/pharmacy/orders/${item.order_id || item._id || item.id || ''}`,
      })),
    },
    {
      id: 'stock-batches',
      label: 'Lô thuốc',
      items: getSettledItems(stockBatches)
        .filter((item) =>
          [
            item.batch_no,
            item.lot_no,
            item.medication_id?.brand_name,
            item.medication_id?.generic_name,
            item.medication_name,
          ].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()),
        )
        .map((item) => ({
          id: item.stock_batch_id || item._id || item.id || item.batch_no || item.lot_no,
          title: item.batch_no || item.lot_no || 'Lô thuốc',
          meta: [
            item.medication_id?.brand_name || item.medication_id?.generic_name || item.medication_name,
            item.status,
          ].filter(Boolean).join(' · '),
          to: `/pharmacy/inventory/batches/${item.stock_batch_id || item._id || item.id || ''}`,
        })),
    },
  ].filter((group) => group.items.length);
}

export async function loadPharmacyOverviewData(filters = {}) {
  let range = getRangeQuery(filters.range);
  if (filters.date) {
    range = getDateRangeForDate(filters.date);
  }
  const prescriptionBaseParams = {
    ...range,
    limit: 100,
    warehouse_id: filters.warehouse || undefined,
    department_id: filters.department || undefined,
    prescribed_by: filters.pharmacist || undefined,
  };
  const prescriptionParams = {
    ...prescriptionBaseParams,
    status: getApiPrescriptionStatus(filters.prescriptionStatus),
  };
  const prescriptionStatusParams = (status) => ({
    ...prescriptionBaseParams,
    status,
  });
  const dispenseParams = { ...range, limit: 100 };
  const transactionParams = {
    limit: 10,
    warehouse_id: filters.warehouse || undefined,
    date_from: range.date_from,
    date_to: range.date_to,
  };
  const batchParams = {
    limit: 70,
    warehouse_id: filters.warehouse || undefined,
    status: filters.inventoryStatus || undefined,
  };

  const results = await Promise.allSettled([
    dashboardAPI.inventory(range),
    reportAPI.inventory(range),
    prescriptionAPI.list(prescriptionParams),
    prescriptionAPI.list(prescriptionStatusParams('draft')),
    prescriptionAPI.list(prescriptionStatusParams('active')),
    prescriptionAPI.list(prescriptionStatusParams('verified')),
    prescriptionAPI.list(prescriptionStatusParams('fully_dispensed')),
    prescriptionAPI.list(prescriptionStatusParams('completed')),
    prescriptionAPI.list(prescriptionStatusParams('cancelled')),
    prescriptionAPI.listDispenses(dispenseParams),
    prescriptionAPI.listInventoryTransactions(transactionParams),
    prescriptionAPI.listStockBatches(batchParams),
    prescriptionAPI.listStockBatches({
      near_expiry: true,
      near_expiry_days: 30,
      limit: 12,
      warehouse_id: filters.warehouse || undefined,
    }),
    prescriptionAPI.listMedications({ limit: 24 }),
    billingAPI.charges({ ...range, limit: 8 }),
    billingAPI.invoices({ ...range, limit: 8 }),
    billingAPI.payments({ ...range, limit: 8 }),
  ]);

  const [
    inventoryDashboard,
    inventoryReport,
    prescriptions,
    pendingDraftPrescriptions,
    pendingActivePrescriptions,
    readyPrescriptions,
    fullyDispensedPrescriptions,
    completedPrescriptions,
    cancelledPrescriptions,
    dispenses,
    transactions,
    stockBatches,
    expiringBatches,
    medications,
    charges,
    invoices,
    payments,
  ] = results;

  const visiblePrescriptions = filterItemsByRange(getSettledItems(prescriptions), range, getPrescriptionDate);
  const pendingPrescriptions = uniqueItems(
    [
      ...filterItemsByRange(getSettledItems(pendingDraftPrescriptions), range, getPrescriptionDate),
      ...filterItemsByRange(getSettledItems(pendingActivePrescriptions), range, getPrescriptionDate),
    ],
    getPrescriptionKey,
  );
  const readyPrescriptionRows = filterItemsByRange(getSettledItems(readyPrescriptions), range, getPrescriptionDate);
  const dispensedPrescriptionRows = uniqueItems(
    [
      ...filterItemsByRange(getSettledItems(fullyDispensedPrescriptions), range, getPrescriptionDate),
      ...filterItemsByRange(getSettledItems(completedPrescriptions), range, getPrescriptionDate),
    ],
    getPrescriptionKey,
  );
  const cancelledPrescriptionRows = filterItemsByRange(getSettledItems(cancelledPrescriptions), range, getPrescriptionDate);
  const prescriptionStatusTotals = {
    pending: pendingPrescriptions.length || visiblePrescriptions.filter((item) => isPendingPrescriptionStatus(item.status)).length,
    ready: readyPrescriptionRows.length || visiblePrescriptions.filter((item) => isReadyPrescriptionStatus(item.status)).length,
    dispensed: dispensedPrescriptionRows.length || visiblePrescriptions.filter((item) => isDispensedPrescriptionStatus(item.status)).length,
    cancelled: cancelledPrescriptionRows.length || visiblePrescriptions.filter((item) => String(item.status || '').toLowerCase() === 'cancelled').length,
    preparing: visiblePrescriptions.filter((item) => ['preparing', 'partially_dispensed'].includes(String(item.status || '').toLowerCase())).length,
  };
  const totalPrescriptionCount = visiblePrescriptions.length || Object.values(prescriptionStatusTotals).reduce((sum, value) => sum + Number(value || 0), 0);
  const visibleDispenses = filterItemsByRange(getSettledItems(dispenses), range, getDispenseDate);
  const prescriptionError = [
    prescriptions,
    pendingDraftPrescriptions,
    pendingActivePrescriptions,
    readyPrescriptions,
    fullyDispensedPrescriptions,
    completedPrescriptions,
    cancelledPrescriptions,
  ].map((result) => getSettledError(result, 'Không thể tải đơn thuốc.')).filter(Boolean)[0] || '';

  return {
    inventoryDashboard: getSettledPayload(inventoryDashboard),
    inventoryReport: getSettledPayload(inventoryReport),
    prescriptions: visiblePrescriptions,
    pendingPrescriptions,
    readyPrescriptions: readyPrescriptionRows,
    dispensedPrescriptions: dispensedPrescriptionRows,
    cancelledPrescriptions: cancelledPrescriptionRows,
    prescriptionStatusTotals,
    prescriptionsTotal: totalPrescriptionCount,
    dispenses: visibleDispenses,
    dispensesTotal: visibleDispenses.length || (dispenses.status === 'fulfilled' ? readTotal(dispenses.value) : 0),
    transactions: getSettledItems(transactions),
    stockBatches: getSettledItems(stockBatches),
    expiringBatches: getSettledItems(expiringBatches),
    medications: getSettledItems(medications),
    charges: filterItemsByRange(getSettledItems(charges), range, (item) => item.charged_at || item.created_at),
    invoices: filterItemsByRange(getSettledItems(invoices), range, (item) => item.issued_at || item.created_at),
    payments: filterItemsByRange(getSettledItems(payments), range, (item) => item.paid_at || item.payment_date || item.created_at),
    errors: {
      inventoryDashboard: getSettledError(inventoryDashboard, 'Không thể tải dashboard tồn kho.'),
      inventoryReport: getSettledError(inventoryReport, 'Không thể tải báo cáo tồn kho.'),
      prescriptions: prescriptionError,
      dispenses: getSettledError(dispenses, 'Không thể tải hàng chờ cấp phát.'),
      transactions: getSettledError(transactions, 'Không thể tải giao dịch kho.'),
      stockBatches: getSettledError(stockBatches, 'Không thể tải lô thuốc.'),
      expiringBatches: getSettledError(expiringBatches, 'Không thể tải lô sắp hết hạn.'),
      medications: getSettledError(medications, 'Không thể tải danh mục thuốc.'),
      billing: [charges, invoices, payments]
        .map((result) => getSettledError(result, 'Không thể tải dữ liệu thanh toán.'))
        .filter(Boolean)[0] || '',
    },
    statuses: {
      inventoryDashboard: getSettledStatus(inventoryDashboard),
      prescriptions: getSettledStatus(prescriptions),
      inventoryReport: getSettledStatus(inventoryReport),
    },
  };
}

export const pharmacyTopbarApi = {
  bootstrap: (params) => request('/pharmacy/topbar/bootstrap', { params }),
  search: (params) => request('/pharmacy/search', { params }),
  dispenseQueue: (params) => request('/pharmacy/dispense-queue', { params }),
  dispenseQueueSummary: (params) => request('/pharmacy/dispense-queue/summary', { params }),
  alertSummary: (params) => request('/pharmacy/alert-summary', { params }),
  notifications: (params) => notificationAPI.getMyNotifications(params),
  markNotificationRead: (notificationId) => notificationAPI.markRead(notificationId),
  markAllNotificationsRead: (params) => notificationAPI.markAllRead(params),
  claimPrescription: (prescriptionId, body = {}) =>
    request(`/pharmacy/prescriptions/${encodeURIComponent(prescriptionId)}/claim`, { method: 'POST', body }),
  verifyPrescription: (prescriptionId, body = {}) =>
    request(`/pharmacy/prescriptions/${encodeURIComponent(prescriptionId)}/verify`, { method: 'POST', body }),
  assignDispense: (dispenseId, body = {}) =>
    request(`/pharmacy/dispenses/${encodeURIComponent(dispenseId)}/assign`, { method: 'POST', body }),
  startPreparation: (dispenseId, body = {}) =>
    request(`/pharmacy/dispenses/${encodeURIComponent(dispenseId)}/start-preparation`, { method: 'POST', body }),
  changeStage: (dispenseId, body = {}) =>
    request(`/pharmacy/dispenses/${encodeURIComponent(dispenseId)}/change-stage`, { method: 'POST', body }),
  lockDispense: (dispenseId, body = {}) =>
    request(`/pharmacy/dispenses/${encodeURIComponent(dispenseId)}/lock`, { method: 'POST', body }),
  createHold: (dispenseId, body = {}) =>
    request(`/pharmacy/dispenses/${encodeURIComponent(dispenseId)}/holds`, { method: 'POST', body }),
  printLabels: (dispenseId, body = {}) =>
    request(`/pharmacy/dispenses/${encodeURIComponent(dispenseId)}/print-labels`, { method: 'POST', body }),
  printInstructions: (dispenseId, body = {}) =>
    request(`/pharmacy/dispenses/${encodeURIComponent(dispenseId)}/print-instructions`, { method: 'POST', body }),
  completeDispense: (dispenseId, body = {}) =>
    request(`/pharmacy/dispenses/${encodeURIComponent(dispenseId)}/complete`, { method: 'POST', body }),
  workspaces: () => request('/workspaces/available'),
  setCurrentWorkspace: (workspaceCode) =>
    request('/preferences/me/current-workspace', { method: 'PATCH', body: { current_workspace: workspaceCode } }),
  setDefaultStore: (storeId) =>
    preferenceAPI.updateMe({ workspace_preferences: { pharmacy: { default_store_id: storeId } } }),
};

export async function loadPharmacyCommandDashboard(filters = {}) {
  const range = filters.date ? getDateRangeForDate(filters.date) : getRangeQuery(filters.range || 'today');
  const response = await pharmacyOverviewAPI.dashboard({
    ...range,
    storage_location: filters.storageLocation || undefined,
    supplier_name: filters.supplier || undefined,
    status: filters.status || undefined,
    near_expiry_days: filters.nearExpiryDays || undefined,
  });
  return unwrapData(response);
}

export async function loadPrescriptionWorkbench(filters = {}) {
  const response = await pharmacyOverviewAPI.prescriptionWorkbench({
    status_group: filters.statusGroup || filters.status_group || undefined,
    search: filters.search || undefined,
    patient_id: filters.patientId || filters.patient_id || undefined,
    doctor_id: filters.doctorId || filters.doctor_id || undefined,
    department_id: filters.departmentId || filters.department_id || undefined,
    department: filters.department || undefined,
    encounter_id: filters.encounterId || filters.encounter_id || undefined,
    from: filters.dateFrom || filters.from || undefined,
    to: filters.dateTo || filters.to || undefined,
    priority: filters.priority || undefined,
    risk_type: filters.riskType || filters.risk_type || undefined,
    has_allergy_alert: filters.hasAllergy || undefined,
    has_interaction_warning: filters.hasInteraction || undefined,
    has_duplicate_medication: filters.hasDuplicate || undefined,
    has_stock_shortage: filters.hasStockShortage || undefined,
    has_unpriced_medication: filters.hasUnpriced || undefined,
    page: filters.page || 1,
    limit: filters.limit || 25,
    sort: filters.sort || undefined,
  });
  return unwrapData(response);
}

export async function loadPrescriptionRiskQueue(filters = {}) {
  const response = await pharmacyOverviewAPI.prescriptionRiskQueue({
    search: filters.search || undefined,
    priority: filters.priority || undefined,
    risk_type: filters.riskType || filters.risk_type || undefined,
    page: filters.page || 1,
    limit: filters.limit || 25,
    sort: filters.sort || 'risk',
  });
  return unwrapData(response);
}

export async function loadPharmacyWorkQueue(filters = {}) {
  const response = await pharmacyOverviewAPI.workQueue({
    type: filters.type || undefined,
    priority: filters.priority || undefined,
    status: filters.status || undefined,
    search: filters.search || undefined,
    assigned_to: filters.assignedTo || undefined,
    page: filters.page || 1,
    limit: filters.limit || 30,
  });
  return unwrapData(response);
}

export async function loadPharmacyDispensingToday(filters = {}) {
  const range = filters.date ? getDateRangeForDate(filters.date) : getRangeQuery(filters.range || 'today');
  const response = await pharmacyOverviewAPI.dispensingToday({
    ...range,
    status: filters.status || undefined,
  });
  return unwrapData(response);
}

export async function loadPharmacyAlerts(filters = {}) {
  const response = await pharmacyOverviewAPI.alertsOverview({
    alert_type: filters.alertType || undefined,
    severity: filters.severity || undefined,
    status: filters.status || undefined,
    search: filters.search || undefined,
    page: filters.page || 1,
    limit: filters.limit || 30,
  });
  return unwrapData(response);
}

function getAlertCommandParams(filters = {}) {
  return {
    search: filters.search || undefined,
    severity: filters.severity || undefined,
    status: filters.status || undefined,
    storage_location: filters.storageLocation || filters.storage_location || undefined,
    supplier_name: filters.supplier || filters.supplierName || filters.supplier_name || undefined,
    warehouse_id: filters.warehouseId || filters.warehouse_id || undefined,
    near_expiry_days: filters.nearExpiryDays || filters.near_expiry_days || undefined,
    days_left: filters.daysLeft || filters.days_left || undefined,
    spike_ratio: filters.spikeRatio || filters.spike_ratio || undefined,
    transaction_type: filters.transactionType || filters.transaction_type || undefined,
    range: filters.range || undefined,
    date: filters.date || undefined,
    date_from: filters.date_from || filters.dateFrom || undefined,
    date_to: filters.date_to || filters.dateTo || undefined,
    page: filters.page || 1,
    limit: filters.limit || 30,
  };
}

export async function loadPharmacyAlertCommandBoard(board = 'low-stock', filters = {}) {
  const params = getAlertCommandParams(filters);
  const loaders = {
    'low-stock': pharmacyOverviewAPI.lowStockAlerts,
    lowStock: pharmacyOverviewAPI.lowStockAlerts,
    'out-of-stock': pharmacyOverviewAPI.outOfStockAlerts,
    outOfStock: pharmacyOverviewAPI.outOfStockAlerts,
    'expiring-batches': pharmacyOverviewAPI.expiringBatchAlerts,
    expiringBatches: pharmacyOverviewAPI.expiringBatchAlerts,
    'expired-batches': pharmacyOverviewAPI.expiredBatchAlerts,
    expiredBatches: pharmacyOverviewAPI.expiredBatchAlerts,
    'dispense-shortage': pharmacyOverviewAPI.dispenseShortageAlerts,
    'insufficient-stock': pharmacyOverviewAPI.dispenseShortageAlerts,
    dispenseShortage: pharmacyOverviewAPI.dispenseShortageAlerts,
    allergy: pharmacyOverviewAPI.allergyAlerts,
    'high-usage': pharmacyOverviewAPI.highUsageAlerts,
    highUsage: pharmacyOverviewAPI.highUsageAlerts,
    'waste-loss': pharmacyOverviewAPI.wasteLossAlerts,
    'loss-waste': pharmacyOverviewAPI.wasteLossAlerts,
    wasteLoss: pharmacyOverviewAPI.wasteLossAlerts,
  };
  const loader = loaders[board] || pharmacyOverviewAPI.lowStockAlerts;
  return unwrapData(await loader(params));
}

export async function loadPharmacyPerformance(filters = {}) {
  const range = filters.date ? getDateRangeForDate(filters.date) : getRangeQuery(filters.range || 'today');
  const response = await pharmacyOverviewAPI.performance({
    ...range,
    storage_location: filters.storageLocation || undefined,
    supplier_name: filters.supplier || undefined,
  });
  return unwrapData(response);
}

function getReportDateParams(filters = {}) {
  const range = filters.date ? getDateRangeForDate(filters.date) : getRangeQuery(filters.range || '30d');
  return {
    ...range,
    search: filters.search || undefined,
    medication_id: filters.medicationId || filters.medication_id || undefined,
    stock_batch_id: filters.batchId || filters.stock_batch_id || undefined,
    warehouse_id: filters.warehouseId || filters.warehouse_id || undefined,
    storage_location_id: filters.storageLocationId || filters.storage_location_id || undefined,
    storage_location: filters.storageLocation || filters.storage_location || undefined,
    supplier_name: filters.supplier || filters.supplier_name || undefined,
    medication_status: filters.medicationStatus || filters.medication_status || undefined,
    batch_status: filters.batchStatus || filters.batch_status || undefined,
    transaction_type: filters.transactionType || filters.transaction_type || undefined,
    direction: filters.direction || undefined,
    pharmacist_id: filters.pharmacistId || filters.pharmacist_id || undefined,
    near_expiry_days: filters.nearExpiryDays || filters.near_expiry_days || undefined,
    group_by: filters.groupBy || filters.group_by || undefined,
    page: filters.page || 1,
    limit: filters.limit || 30,
  };
}

export async function loadPharmacyReport(view = 'dashboard', filters = {}) {
  const params = getReportDateParams(filters);
  const loaders = {
    dashboard: pharmacyReportAPI.dashboard,
    inventoryOverview: pharmacyReportAPI.inventoryOverview,
    stockMovement: pharmacyReportAPI.inventoryMovement,
    dispensing: pharmacyReportAPI.dispensing,
    expiringStock: pharmacyReportAPI.expiringStock,
    lowStock: pharmacyReportAPI.lowStock,
    inventoryValuation: pharmacyReportAPI.inventoryValuation,
    highUsage: pharmacyReportAPI.highUsageMedications,
    wasteDisposal: pharmacyReportAPI.wasteDisposal,
    exportHistory: pharmacyReportAPI.exportHistory,
  };
  const loader = loaders[view] || pharmacyReportAPI.dashboard;
  return unwrapData(await loader(params));
}

export async function exportPharmacyReport(view = 'dashboard', format = 'json', filters = {}) {
  const reportTypeMap = {
    dashboard: 'dashboard',
    inventoryOverview: 'inventory_overview',
    stockMovement: 'inventory_movement',
    dispensing: 'dispensing',
    expiringStock: 'expiring_stock',
    lowStock: 'low_stock',
    inventoryValuation: 'inventory_valuation',
    highUsage: 'high_usage_medications',
    wasteDisposal: 'waste_disposal',
  };
  const payload = {
    ...getReportDateParams(filters),
    report_type: reportTypeMap[view] || 'dashboard',
    format,
  };
  return unwrapData(await pharmacyReportAPI.export(payload));
}

export async function loadMedicationCatalog(filters = {}) {
  const [medications, summary] = await Promise.allSettled([
    prescriptionAPI.listMedications({
      search: filters.search || undefined,
      status: filters.status || undefined,
      dosage_form: filters.dosageForm || undefined,
      route_default: filters.routeDefault || undefined,
      below_min_stock: filters.belowMinStock || undefined,
      without_stock: filters.withoutStock || undefined,
      missing_price: filters.missingPrice || undefined,
      missing_service: filters.missingService || undefined,
      has_near_expiry: filters.hasNearExpiry || undefined,
      page: filters.page || 1,
      limit: filters.limit || 30,
    }),
    pharmacyOverviewAPI.medicationSummary({ near_expiry_days: filters.nearExpiryDays || 30 }),
  ]);
  return {
    medications: getSettledItems(medications),
    pagination: medications.status === 'fulfilled' ? (unwrapData(medications.value)?.pagination || {}) : {},
    summary: getSettledPayload(summary) || {},
    errors: {
      medications: getSettledError(medications, 'Không thể tải danh mục thuốc.'),
      summary: getSettledError(summary, 'Không thể tải KPI danh mục thuốc.'),
    },
  };
}

export async function loadCurrentStock(filters = {}) {
  const [currentStock, report, transactions] = await Promise.allSettled([
    pharmacyOverviewAPI.currentStock({
      search: filters.search || undefined,
      stock_status: filters.stockStatus || undefined,
      storage_location: filters.storageLocation || undefined,
      supplier_name: filters.supplier || undefined,
      near_expiry_days: filters.nearExpiryDays || 30,
      page: filters.page || 1,
      limit: filters.limit || 30,
    }),
    reportAPI.inventory({ near_expiry_days: filters.nearExpiryDays || 30 }),
    prescriptionAPI.listInventoryTransactions({ limit: 12 }),
  ]);
  return {
    items: getSettledItems(currentStock),
    pagination: currentStock.status === 'fulfilled' ? (unwrapData(currentStock.value)?.pagination || {}) : {},
    report: getSettledPayload(report) || {},
    transactions: getSettledItems(transactions),
    errors: {
      currentStock: getSettledError(currentStock, 'Không thể tải tồn kho hiện tại.'),
      report: getSettledError(report, 'Không thể tải KPI tồn kho.'),
      transactions: getSettledError(transactions, 'Không thể tải ledger tồn kho.'),
    },
  };
}

export async function loadStockBatchConsole(filters = {}) {
  const params = {
    search: filters.search || undefined,
    medication_id: filters.medicationId || undefined,
    status: filters.status || undefined,
    storage_location: filters.storageLocation || undefined,
    supplier_name: filters.supplier || undefined,
    near_expiry: filters.nearExpiry || undefined,
    near_expiry_days: filters.nearExpiryDays || 30,
    valid: filters.valid || undefined,
    expired: filters.expired || undefined,
    depleted: filters.depleted || undefined,
    has_stock: filters.hasStock || undefined,
    page: filters.page || 1,
    limit: filters.limit || 30,
  };
  const [batches, report, expiryRisk] = await Promise.allSettled([
    prescriptionAPI.listStockBatches(params),
    reportAPI.inventory({ near_expiry_days: filters.nearExpiryDays || 30 }),
    pharmacyOverviewAPI.expiryRisk({ days: filters.nearExpiryDays || 60, limit: 8 }),
  ]);
  return {
    batches: getSettledItems(batches),
    pagination: batches.status === 'fulfilled' ? (unwrapData(batches.value)?.pagination || {}) : {},
    report: getSettledPayload(report) || {},
    expiryRisk: getSettledPayload(expiryRisk) || {},
    errors: {
      batches: getSettledError(batches, 'Không thể tải lô thuốc.'),
      report: getSettledError(report, 'Không thể tải KPI kho.'),
      expiryRisk: getSettledError(expiryRisk, 'Không thể tải expiry risk.'),
    },
  };
}

export async function loadStockBatchDetail(batchId) {
  const [detail, transactions, impact] = await Promise.allSettled([
    prescriptionAPI.stockBatchDetail(batchId),
    prescriptionAPI.listInventoryTransactions({ stock_batch_id: batchId, limit: 25 }),
    prescriptionAPI.stockBatchRecallImpact(batchId),
  ]);
  return {
    detail: getSettledPayload(detail),
    transactions: getSettledItems(transactions),
    impact: getSettledPayload(impact),
    errors: {
      detail: getSettledError(detail, 'Không thể tải chi tiết lô.'),
      transactions: getSettledError(transactions, 'Không thể tải ledger lô.'),
      impact: getSettledError(impact, 'Không thể tải recall impact.'),
    },
  };
}

export async function loadMedicationDetail(medicationId) {
  const [detail, batches, transactions] = await Promise.allSettled([
    prescriptionAPI.medicationDetail(medicationId),
    prescriptionAPI.listStockBatches({ medication_id: medicationId, limit: 20 }),
    prescriptionAPI.listInventoryTransactions({ medication_id: medicationId, limit: 20 }),
  ]);
  return {
    detail: getSettledPayload(detail),
    batches: getSettledItems(batches),
    transactions: getSettledItems(transactions),
    errors: {
      detail: getSettledError(detail, 'Không thể tải chi tiết thuốc.'),
      batches: getSettledError(batches, 'Không thể tải lô liên quan.'),
      transactions: getSettledError(transactions, 'Không thể tải giao dịch thuốc.'),
    },
  };
}

export async function receiveInventoryFromConsole(body = {}) {
  return prescriptionAPI.receiveInventory(body);
}

export async function adjustBatchFromConsole(batchId, body = {}) {
  return prescriptionAPI.adjustStockBatch(batchId, body);
}

export async function expireBatchFromConsole(batchId, body = {}) {
  return prescriptionAPI.markStockBatchExpired(batchId, body);
}

export async function recallBatchFromConsole(batchId, body = {}) {
  return prescriptionAPI.recallStockBatch(batchId, body);
}

export async function quarantineBatchFromConsole(batchId, body = {}) {
  return prescriptionAPI.quarantineStockBatch(batchId, body);
}

export async function releaseQuarantineFromConsole(batchId, body = {}) {
  return prescriptionAPI.releaseQuarantineStockBatch(batchId, body);
}

export async function wasteBatchFromConsole(batchId, body = {}) {
  return prescriptionAPI.wasteStockBatch(batchId, body);
}

export async function transferBatchLocationFromConsole(batchId, body = {}) {
  return prescriptionAPI.transferStockBatchLocation(batchId, body);
}

export async function loadStocktakes(filters = {}) {
  const response = await pharmacyOverviewAPI.listStocktakes({
    search: filters.search || undefined,
    status: filters.status || undefined,
    page: filters.page || 1,
    limit: filters.limit || 20,
  });
  return unwrapData(response);
}

export async function loadStocktakeDetail(stocktakeId, filters = {}) {
  const response = await pharmacyOverviewAPI.stocktakeDetail(stocktakeId, filters);
  return unwrapData(response);
}

export async function createStocktakeFromConsole(body = {}) {
  return pharmacyOverviewAPI.createStocktake(body);
}

export async function startStocktakeFromConsole(stocktakeId, body = {}) {
  return pharmacyOverviewAPI.startStocktake(stocktakeId, body);
}

export async function generateStocktakeItemsFromConsole(stocktakeId, body = {}) {
  return pharmacyOverviewAPI.generateStocktakeItems(stocktakeId, body);
}

export async function countStocktakeItemFromConsole(stocktakeId, itemId, body = {}) {
  return pharmacyOverviewAPI.countStocktakeItem(stocktakeId, itemId, body);
}

export async function reviewStocktakeFromConsole(stocktakeId, body = {}) {
  return pharmacyOverviewAPI.reviewStocktake(stocktakeId, body);
}

export async function postStocktakeAdjustmentsFromConsole(stocktakeId, body = {}) {
  return pharmacyOverviewAPI.postStocktakeAdjustments(stocktakeId, body);
}

export async function loadDispensingQueue(filters = {}) {
  const response = await pharmacyOverviewAPI.dispensingQueue({
    status: filters.status || undefined,
    search: filters.search || undefined,
    risk: filters.risk || undefined,
    department_id: filters.departmentId || undefined,
    doctor_id: filters.doctorId || undefined,
    storage_location: filters.storageLocation || undefined,
    page: filters.page || 1,
    limit: filters.limit || 25,
  });
  return unwrapData(response);
}

export async function loadDispensingQueueSummary(filters = {}) {
  const response = await pharmacyOverviewAPI.dispensingQueueSummary({
    search: filters.search || undefined,
    risk: filters.risk || undefined,
    storage_location: filters.storageLocation || undefined,
  });
  return unwrapData(response);
}

export async function loadDispensingAnalytics(filters = {}) {
  const range = filters.date ? getDateRangeForDate(filters.date) : getRangeQuery(filters.range || 'today');
  const response = await pharmacyOverviewAPI.dispensingAnalytics(range);
  return unwrapData(response);
}

export async function loadDispenseHolds(filters = {}) {
  const response = await pharmacyOverviewAPI.listDispenseHolds({
    status: filters.status || undefined,
    hold_type: filters.holdType || filters.hold_type || undefined,
    severity: filters.severity || undefined,
    search: filters.search || undefined,
    page: filters.page || 1,
    limit: filters.limit || 25,
  });
  return unwrapData(response);
}

export async function loadDispenseReturns(filters = {}) {
  const response = await pharmacyOverviewAPI.listDispenseReturns({
    status: filters.status || undefined,
    search: filters.search || undefined,
    page: filters.page || 1,
    limit: filters.limit || 25,
  });
  return unwrapData(response);
}

export async function loadDispensePrintJobs(filters = {}) {
  const response = await pharmacyOverviewAPI.listPrintJobs({
    status: filters.status || undefined,
    print_type: filters.printType || filters.print_type || undefined,
    dispense_id: filters.dispenseId || filters.dispense_id || undefined,
    page: filters.page || 1,
    limit: filters.limit || 25,
  });
  return unwrapData(response);
}

export async function loadDispensesForCommand(filters = {}) {
  const response = await prescriptionAPI.listDispenses({
    status: filters.status || undefined,
    workflow_stage: filters.workflowStage || filters.workflow_stage || undefined,
    assigned_to: filters.assignedTo || filters.assigned_to || undefined,
    priority: filters.priority || undefined,
    date_from: filters.date_from || filters.dateFrom || undefined,
    date_to: filters.date_to || filters.dateTo || undefined,
    page: filters.page || 1,
    limit: filters.limit || 30,
  });
  return unwrapData(response);
}

export async function loadDispenseDetailForCommand(dispenseId) {
  const [detail, checklist, timeline, printJobs] = await Promise.allSettled([
    prescriptionAPI.dispenseDetail(dispenseId),
    prescriptionAPI.dispenseChecklist(dispenseId),
    pharmacyOverviewAPI.dispenseTimeline(dispenseId),
    prescriptionAPI.dispensePrintJobs(dispenseId),
  ]);
  return {
    detail: getSettledPayload(detail),
    checklist: getSettledPayload(checklist),
    timeline: getSettledPayload(timeline),
    printJobs: getSettledPayload(printJobs),
    errors: {
      detail: getSettledError(detail, 'Không thể tải phiếu cấp phát.'),
      checklist: getSettledError(checklist, 'Không thể tải checklist.'),
      timeline: getSettledError(timeline, 'Không thể tải timeline.'),
      printJobs: getSettledError(printJobs, 'Không thể tải lịch sử in.'),
    },
  };
}

export async function previewDispenseCompletionPlanFromOverview(dispenseId, body = {}) {
  return prescriptionAPI.previewDispenseCompletionPlan(dispenseId, body);
}

export async function acknowledgePharmacyAlert(alertId, body = {}) {
  return pharmacyOverviewAPI.acknowledgeAlert(alertId, body);
}

export async function assignPharmacyAlert(alertId, body = {}) {
  return pharmacyOverviewAPI.assignAlert(alertId, body);
}

export async function startPharmacyAlert(alertId, body = {}) {
  return pharmacyOverviewAPI.startAlert(alertId, body);
}

export async function snoozePharmacyAlert(alertId, body = {}) {
  return pharmacyOverviewAPI.snoozeAlert(alertId, body);
}

export async function resolvePharmacyAlert(alertId, body = {}) {
  return pharmacyOverviewAPI.resolveAlert(alertId, body);
}

export async function dismissPharmacyAlert(alertId, body = {}) {
  return pharmacyOverviewAPI.dismissAlert(alertId, body);
}

export async function escalatePharmacyAlert(alertId, body = {}) {
  return pharmacyOverviewAPI.escalateAlert(alertId, body);
}

export async function bulkActionPharmacyAlerts(body = {}) {
  return pharmacyOverviewAPI.bulkAlertAction(body);
}

export async function assignPharmacyWorkItem(workItemId, body = {}) {
  return pharmacyOverviewAPI.assignWorkItem(workItemId, body);
}

export async function resolvePharmacyWorkItem(workItemId, body = {}) {
  return pharmacyOverviewAPI.resolveWorkItem(workItemId, body);
}

export async function runPrescriptionSafetyChecks(prescriptionId) {
  const [allergy, interaction, itemsResult] = await Promise.allSettled([
    prescriptionAPI.checkAllergyConflict({ prescription_id: prescriptionId }),
    prescriptionAPI.checkInteractionConflict({ prescription_id: prescriptionId }),
    prescriptionAPI.listItems(prescriptionId),
  ]);

  const items = getSettledItems(itemsResult);
  const medicationIds = items
    .map((item) => item.medication_id?._id || item.medication_id || item.medicationId)
    .filter(Boolean);

  const duplicateResults = await Promise.allSettled(
    medicationIds.map((medicationId) =>
      prescriptionAPI.checkDuplicateMedication({ prescription_id: prescriptionId, medication_id: medicationId }),
    ),
  );

  const duplicateConflicts = duplicateResults
    .map(getSettledPayload)
    .filter((payload) => payload?.has_duplicate);

  const allergyPayload = getSettledPayload(allergy) || {};
  const interactionPayload = getSettledPayload(interaction) || {};

  return {
    allergy: allergyPayload,
    interaction: interactionPayload,
    duplicate: duplicateConflicts,
    findings: [
      ...(allergyPayload.conflicts || []).map((item) => ({
        tone: 'danger',
        title: 'Cảnh báo dị ứng',
        body: `${item.allergen || 'Dị ứng thuốc'} với ${item.medication_name || 'thuốc trong đơn'}`,
      })),
      ...(interactionPayload.requires_override || interactionPayload.has_conflict
        ? [{
            tone: interactionPayload.has_conflict ? 'danger' : 'warning',
            title: interactionPayload.has_conflict ? 'Cảnh báo tương tác thuốc' : 'Cần rà soát tương tác',
            body: interactionPayload.message || 'Đơn thuốc có nhiều thuốc, cần kiểm tra trước khi xác minh.',
          }]
        : []),
      ...duplicateConflicts.map((item) => ({
        tone: 'warning',
        title: 'Thuốc trùng trong đơn',
        body: item.item?.medication_id || 'Có thuốc bị kê trùng.',
      })),
    ],
    errors: {
      allergy: getSettledError(allergy, 'Không thể kiểm tra dị ứng.'),
      interaction: getSettledError(interaction, 'Không thể kiểm tra tương tác thuốc.'),
      items: getSettledError(itemsResult, 'Không thể tải danh sách thuốc trong đơn.'),
    },
  };
}

export async function verifyPrescriptionFromOverview(prescriptionId, body = {}) {
  return prescriptionAPI.verify(prescriptionId, body);
}

export async function cancelPrescriptionFromOverview(prescriptionId, body = {}) {
  return prescriptionAPI.cancel(prescriptionId, body);
}

export async function completeDispenseFromOverview(dispenseId, body = {}) {
  return prescriptionAPI.completeDispense(dispenseId, body);
}

export async function cancelDispenseFromOverview(dispenseId, body = {}) {
  return prescriptionAPI.cancelDispense(dispenseId, body);
}

export async function markStockBatchExpiredFromOverview(batchId, body = {}) {
  return prescriptionAPI.markStockBatchExpired(batchId, body);
}

export async function recallStockBatchFromOverview(batchId, body = {}) {
  return prescriptionAPI.recallStockBatch(batchId, body);
}
