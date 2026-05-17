import {
  authAPI,
  billingAPI,
  dashboardAPI,
  getApiErrorMessage,
  getApiErrorStatus,
  notificationAPI,
  orderAPI,
  patientAPI,
  prescriptionAPI,
  reportAPI,
  unwrapData,
} from '../utils/api';
import { readStoredAuth } from '../lib/storage';

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
    date: start.toISOString().slice(0, 10),
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
    date: rangeKey === 'today' ? start.toISOString().slice(0, 10) : undefined,
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
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(`${filters.date}T23:59:59.999`);
    range = {
      range: 'custom',
      date: filters.date,
      date_from: start.toISOString(),
      date_to: end.toISOString(),
    };
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
