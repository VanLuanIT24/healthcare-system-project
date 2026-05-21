const { Types } = require('mongoose');
const {
  AuditLog,
  Charge,
  Dispense,
  DispenseItem,
  InventoryDisposal,
  InventoryTransaction,
  MedicationAdministration,
  MedicationMaster,
  Prescription,
  PrescriptionItem,
  StockBatch,
  User,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  ADMINISTRATION_STATUS,
  DISPENSE_STATUS,
  INVENTORY_TRANSACTION_DIRECTION,
  INVENTORY_TRANSACTION_TYPE,
  MEDICATION_STATUS,
  PRESCRIPTION_STATUS,
  STOCK_BATCH_STATUS,
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
  recordAuditLog,
} = require('./core.service');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const MS_PER_DAY = 86400000;

const PHARMACY_REPORT_TYPE = {
  DASHBOARD: 'dashboard',
  INVENTORY_OVERVIEW: 'inventory_overview',
  INVENTORY_MOVEMENT: 'inventory_movement',
  DISPENSING: 'dispensing',
  EXPIRING_STOCK: 'expiring_stock',
  EXPIRED_RECALLED_BATCHES: 'expired_recalled_batches',
  LOW_STOCK: 'low_stock',
  STOCKOUT_RISK: 'stockout_risk',
  PRESCRIPTIONS: 'prescriptions',
  INVENTORY_VALUATION: 'inventory_valuation',
  HIGH_USAGE: 'high_usage_medications',
  TURNOVER: 'turnover',
  WASTE_DISPOSAL: 'waste_disposal',
};

const WASTE_TRANSACTION_TYPES = [
  INVENTORY_TRANSACTION_TYPE.WASTE,
  INVENTORY_TRANSACTION_TYPE.EXPIRE,
  INVENTORY_TRANSACTION_TYPE.RECALL,
];

function hasAnyPermission(actor = {}, permissions = []) {
  if (permissionService.hasPermission(actor.permissions || [], PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  return permissionService.hasAnyPermission(actor.permissions || [], permissions.filter(Boolean));
}

function actorId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || null;
}

function assertStaff(actor = {}) {
  const actorType = actor.actorType || actor.actor_type;
  if (actorType !== 'staff') {
    throw createError('Chỉ tài khoản nhân sự được xem báo cáo dược.', 403);
  }
}

function pharmacyReportPermissions(...specificPermissions) {
  return [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.INVENTORY_READ,
    PERMISSION.REPORTS.LOW_STOCK_READ,
    PERMISSION.REPORTS.EXPIRING_STOCK_READ,
    PERMISSION.STOCK_BATCHES.READ,
    PERMISSION.INVENTORY_TRANSACTIONS.READ,
    PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED,
    PERMISSION.DISPENSES.READ,
    ...(Object.values(PERMISSION.PHARMACY_REPORTS || {})),
    ...specificPermissions,
  ];
}

function assertPharmacyReportPermission(actor = {}, ...permissions) {
  assertStaff(actor);
  if (!hasAnyPermission(actor, pharmacyReportPermissions(...permissions))) {
    throw createError('Tài khoản hiện tại không có quyền xem báo cáo dược.', 403);
  }
}

function parseDate(value, fieldName) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(value);
}

function normalizeBoolean(value) {
  return value === true || ['true', '1', 'yes'].includes(String(value || '').toLowerCase());
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((normalizeNumber(value) + Number.EPSILON) * factor) / factor;
}

function percentage(part, total) {
  return total ? round((normalizeNumber(part) / normalizeNumber(total)) * 100, 2) : 0;
}

function average(values = []) {
  const valid = values.map((value) => normalizeNumber(value, null)).filter((value) => value !== null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function addDays(date, days) {
  return new Date(new Date(date).getTime() + Number(days || 0) * MS_PER_DAY);
}

function dateKey(date) {
  const value = new Date(date);
  return value.toISOString().slice(0, 10);
}

function dayExpression(field, timezone = DEFAULT_TIMEZONE) {
  return {
    $dateToString: {
      format: '%Y-%m-%d',
      date: `$${field}`,
      timezone,
    },
  };
}

function getRangeDates(start, end, maxDays = 60) {
  const first = getStartOfDay(start || addDays(new Date(), -29));
  const last = getStartOfDay(end || new Date());
  const days = Math.min(Math.max(Math.floor((last - first) / MS_PER_DAY) + 1, 1), maxDays);
  return Array.from({ length: days }, (_, index) => dateKey(addDays(first, index)));
}

function normalizeFilters(query = {}, { defaultRange = '30d' } = {}) {
  const now = new Date();
  const range = normalizeString(query.range || defaultRange).toLowerCase();
  let dateFrom = parseDate(query.date_from || query.from, 'date_from');
  let dateTo = parseDate(query.date_to || query.to, 'date_to');
  const date = parseDate(query.date, 'date');

  if (date) {
    dateFrom = getStartOfDay(date);
    dateTo = getEndOfDay(date);
  } else if (!dateFrom && !dateTo) {
    if (range === 'today') {
      dateFrom = getStartOfDay(now);
      dateTo = getEndOfDay(now);
    } else if (range === '7d') {
      dateFrom = getStartOfDay(addDays(now, -6));
      dateTo = getEndOfDay(now);
    } else if (range === 'month' || range === 'this_month') {
      dateFrom = getStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      dateTo = getEndOfDay(now);
    } else {
      dateFrom = getStartOfDay(addDays(now, -29));
      dateTo = getEndOfDay(now);
    }
  } else {
    if (dateFrom) dateFrom = getStartOfDay(dateFrom);
    if (dateTo) dateTo = getEndOfDay(dateTo);
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw createError('date_from phải nhỏ hơn hoặc bằng date_to.', 400);
  }

  const nearExpiryDays = Math.min(Math.max(Number(query.near_expiry_days || query.days || 30), 1), 730);
  const leadTimeDays = Math.min(Math.max(Number(query.lead_time_days || 14), 1), 180);
  const bufferDays = Math.min(Math.max(Number(query.buffer_days || 7), 0), 180);

  return {
    raw: query,
    range,
    date_from: dateFrom,
    date_to: dateTo,
    timezone: normalizeString(query.timezone) || DEFAULT_TIMEZONE,
    near_expiry_days: nearExpiryDays,
    lead_time_days: leadTimeDays,
    buffer_days: bufferDays,
    medication_id: toObjectId(query.medication_id || query.medicationId, 'medication_id'),
    stock_batch_id: toObjectId(query.stock_batch_id || query.batch_id || query.batchId, 'stock_batch_id'),
    warehouse_id: toObjectId(query.warehouse_id || query.warehouseId, 'warehouse_id'),
    storage_location_id: toObjectId(query.storage_location_id || query.storageLocationId, 'storage_location_id'),
    pharmacist_id: toObjectId(query.pharmacist_id || query.pharmacistId || query.dispensed_by, 'pharmacist_id'),
    doctor_id: toObjectId(query.doctor_id || query.doctorId, 'doctor_id'),
    department_id: toObjectId(query.department_id || query.departmentId, 'department_id'),
    medication_status: normalizeString(query.medication_status || query.medicationStatus),
    batch_status: normalizeString(query.batch_status || query.batchStatus),
    transaction_type: normalizeString(query.transaction_type || query.transactionType),
    direction: normalizeString(query.direction),
    supplier_name: normalizeString(query.supplier_name || query.supplier),
    storage_location: normalizeString(query.storage_location || query.storageLocation),
    dosage_form: normalizeString(query.dosage_form || query.dosageForm),
    route_default: normalizeString(query.route_default || query.routeDefault),
    group_by: normalizeString(query.group_by || query.groupBy),
    search: normalizeString(query.search || query.q),
    only_has_stock: normalizeBoolean(query.only_has_stock || query.has_stock || query.in_stock),
    only_low_stock: normalizeBoolean(query.only_low_stock || query.low_stock),
  };
}

function serializeFilters(filters = {}) {
  return {
    range: filters.range,
    date_from: filters.date_from ? filters.date_from.toISOString() : null,
    date_to: filters.date_to ? filters.date_to.toISOString() : null,
    timezone: filters.timezone,
    near_expiry_days: filters.near_expiry_days,
    lead_time_days: filters.lead_time_days,
    buffer_days: filters.buffer_days,
    medication_id: filters.medication_id ? String(filters.medication_id) : null,
    stock_batch_id: filters.stock_batch_id ? String(filters.stock_batch_id) : null,
    warehouse_id: filters.warehouse_id ? String(filters.warehouse_id) : null,
    storage_location_id: filters.storage_location_id ? String(filters.storage_location_id) : null,
    supplier_name: filters.supplier_name || null,
    storage_location: filters.storage_location || null,
    medication_status: filters.medication_status || null,
    batch_status: filters.batch_status || null,
    transaction_type: filters.transaction_type || null,
    direction: filters.direction || null,
    search: filters.search || null,
  };
}

function applyDateRange(match, field, filters) {
  if (!filters.date_from && !filters.date_to) return;
  match[field] = {};
  if (filters.date_from) match[field].$gte = filters.date_from;
  if (filters.date_to) match[field].$lte = filters.date_to;
}

function buildMedicationQuery(filters = {}) {
  const query = { is_deleted: false };
  if (filters.medication_id) query._id = filters.medication_id;
  if (filters.medication_status) query.status = filters.medication_status;
  if (filters.dosage_form) query.dosage_form = { $regex: escapeRegex(filters.dosage_form), $options: 'i' };
  if (filters.route_default) query.route_default = { $regex: escapeRegex(filters.route_default), $options: 'i' };
  if (filters.search) {
    const pattern = escapeRegex(filters.search);
    query.$or = [
      { medication_code: { $regex: pattern, $options: 'i' } },
      { generic_name: { $regex: pattern, $options: 'i' } },
      { brand_name: { $regex: pattern, $options: 'i' } },
      { strength: { $regex: pattern, $options: 'i' } },
      { dosage_form: { $regex: pattern, $options: 'i' } },
    ];
  }
  return query;
}

function buildBatchQuery(filters = {}, medicationIds = null) {
  const query = { is_deleted: false };
  if (filters.stock_batch_id) query._id = filters.stock_batch_id;
  if (filters.medication_id) query.medication_id = filters.medication_id;
  if (Array.isArray(medicationIds)) {
    if (!medicationIds.length) return null;
    query.medication_id = { $in: medicationIds };
  }
  if (filters.batch_status) query.status = filters.batch_status;
  if (filters.warehouse_id) query.warehouse_id = filters.warehouse_id;
  if (filters.storage_location_id) query.storage_location_id = filters.storage_location_id;
  if (filters.supplier_name) query.supplier_name = { $regex: escapeRegex(filters.supplier_name), $options: 'i' };
  if (filters.storage_location) query.storage_location = { $regex: escapeRegex(filters.storage_location), $options: 'i' };
  if (filters.only_has_stock) query.quantity_on_hand = { $gt: 0 };
  return query;
}

function batchMatchesSearch(batch = {}, search = '') {
  if (!search) return true;
  const normalized = search.toLowerCase();
  return [
    batch.batch_no,
    batch.lot_no,
    batch.supplier_name,
    batch.storage_location,
  ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized));
}

function medicationName(medication = {}) {
  return [
    medication.brand_name || medication.generic_name,
    medication.strength,
    medication.dosage_form,
  ].filter(Boolean).join(' ') || medication.medication_code || 'Thuốc';
}

function toMedicationPayload(medication = {}) {
  return {
    medication_id: medication._id ? String(medication._id) : null,
    medication_code: medication.medication_code || null,
    medication_name: medicationName(medication),
    generic_name: medication.generic_name || null,
    brand_name: medication.brand_name || null,
    strength: medication.strength || null,
    dosage_form: medication.dosage_form || null,
    route_default: medication.route_default || null,
    unit: medication.unit || null,
    sale_price: normalizeNumber(medication.sale_price),
    min_stock_level: normalizeNumber(medication.min_stock_level),
    status: medication.status || null,
  };
}

function getBatchRisk(batch = {}, now = new Date()) {
  const quantity = normalizeNumber(batch.quantity_on_hand);
  const expiryDate = batch.expiry_date ? new Date(batch.expiry_date) : null;
  const daysToExpiry = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / MS_PER_DAY) : null;
  const value = quantity * normalizeNumber(batch.unit_cost);
  let severity = 'normal';
  let suggestedAction = 'Theo dõi FEFO';

  if (batch.status === STOCK_BATCH_STATUS.RECALLED) {
    severity = 'critical';
    suggestedAction = 'Cách ly và xử lý recall';
  } else if (batch.status === STOCK_BATCH_STATUS.EXPIRED || (daysToExpiry !== null && daysToExpiry < 0)) {
    severity = 'critical';
    suggestedAction = 'Mark expired và lập biên bản hủy';
  } else if (daysToExpiry !== null && daysToExpiry <= 7) {
    severity = 'critical';
    suggestedAction = 'Ưu tiên FEFO ngay';
  } else if (daysToExpiry !== null && daysToExpiry <= 30) {
    severity = 'high';
    suggestedAction = 'Đẩy cảnh báo cấp phát FEFO';
  } else if (daysToExpiry !== null && daysToExpiry <= 60) {
    severity = 'medium';
    suggestedAction = 'Theo dõi kế hoạch tiêu thụ';
  }

  return {
    risk_value: round(value, 0),
    days_to_expiry: daysToExpiry,
    severity,
    suggested_action: suggestedAction,
  };
}

async function loadInventoryRows(filters = {}) {
  const medications = await MedicationMaster.find(buildMedicationQuery(filters))
    .select('medication_code generic_name brand_name dosage_form strength route_default unit sale_price min_stock_level status')
    .sort({ generic_name: 1, brand_name: 1 })
    .lean();
  const medicationIds = medications.map((item) => item._id);
  const medicationMap = new Map(medications.map((item) => [String(item._id), item]));
  const batchQuery = buildBatchQuery(filters, medicationIds);

  const batches = batchQuery
    ? await StockBatch.find(batchQuery)
      .select('medication_id batch_no lot_no supplier_name expiry_date received_date quantity_received quantity_on_hand unit_cost min_stock_level warehouse_id storage_location_id storage_location status last_transaction_id')
      .sort({ expiry_date: 1, received_date: -1 })
      .lean()
    : [];
  const searchedBatches = filters.search ? batches.filter((batch) => batchMatchesSearch(batch, filters.search)) : batches;
  const batchesByMedication = new Map();

  for (const batch of searchedBatches) {
    const key = String(batch.medication_id);
    if (!batchesByMedication.has(key)) batchesByMedication.set(key, []);
    batchesByMedication.get(key).push(batch);
  }

  const transactionRows = medicationIds.length
    ? await InventoryTransaction.aggregate([
      { $match: { medication_id: { $in: medicationIds } } },
      {
        $group: {
          _id: '$medication_id',
          last_transaction_at: { $max: '$occurred_at' },
          last_receipt_at: {
            $max: {
              $cond: [{ $eq: ['$transaction_type', INVENTORY_TRANSACTION_TYPE.RECEIPT] }, '$occurred_at', null],
            },
          },
          last_dispense_at: {
            $max: {
              $cond: [{ $eq: ['$transaction_type', INVENTORY_TRANSACTION_TYPE.DISPENSE] }, '$occurred_at', null],
            },
          },
        },
      },
    ])
    : [];
  const transactionMap = new Map(transactionRows.map((row) => [String(row._id), row]));
  const hasBatchSpecificFilter = Boolean(
    filters.stock_batch_id
      || filters.batch_status
      || filters.warehouse_id
      || filters.storage_location_id
      || filters.supplier_name
      || filters.storage_location
      || filters.only_has_stock,
  );

  return medications
    .map((medication) => {
      const id = String(medication._id);
      const medicationBatches = batchesByMedication.get(id) || [];
      if (hasBatchSpecificFilter && !medicationBatches.length) return null;

      const totalOnHand = medicationBatches.reduce((sum, batch) => sum + normalizeNumber(batch.quantity_on_hand), 0);
      const minStock = normalizeNumber(medication.min_stock_level);
      const value = medicationBatches.reduce(
        (sum, batch) => sum + normalizeNumber(batch.quantity_on_hand) * normalizeNumber(batch.unit_cost),
        0,
      );
      const now = new Date();
      const nearExpiryTo = addDays(now, filters.near_expiry_days);
      const availableBatches = medicationBatches.filter(
        (batch) => batch.status === STOCK_BATCH_STATUS.AVAILABLE && normalizeNumber(batch.quantity_on_hand) > 0,
      );
      const nearExpiryBatches = medicationBatches.filter(
        (batch) =>
          batch.expiry_date
          && new Date(batch.expiry_date) >= now
          && new Date(batch.expiry_date) <= nearExpiryTo
          && normalizeNumber(batch.quantity_on_hand) > 0
          && ![STOCK_BATCH_STATUS.EXPIRED, STOCK_BATCH_STATUS.RECALLED, STOCK_BATCH_STATUS.DEPLETED].includes(batch.status),
      );
      const expiredBatches = medicationBatches.filter(
        (batch) => batch.status === STOCK_BATCH_STATUS.EXPIRED || (batch.expiry_date && new Date(batch.expiry_date) < now),
      );
      const recalledBatches = medicationBatches.filter((batch) => batch.status === STOCK_BATCH_STATUS.RECALLED);
      const depletedBatches = medicationBatches.filter((batch) => batch.status === STOCK_BATCH_STATUS.DEPLETED);
      const lowStock = minStock > 0 && totalOnHand > 0 && totalOnHand <= minStock;
      const outOfStock = totalOnHand <= 0;
      const transaction = transactionMap.get(id) || {};
      const averageUnitCost = totalOnHand > 0 ? value / totalOnHand : 0;

      let stockStatus = 'normal';
      if (outOfStock) stockStatus = 'out';
      else if (lowStock) stockStatus = 'low';
      else if (nearExpiryBatches.length || recalledBatches.length || expiredBatches.length) stockStatus = 'risk';
      else if (minStock > 0 && totalOnHand <= minStock * 1.5) stockStatus = 'watch';

      return {
        ...toMedicationPayload(medicationMap.get(id) || medication),
        total_on_hand: round(totalOnHand, 2),
        min_stock_level: minStock,
        below_min_quantity: round(Math.max(minStock - totalOnHand, 0), 2),
        batch_count: medicationBatches.length,
        available_batch_count: availableBatches.length,
        near_expiry_batch_count: nearExpiryBatches.length,
        expired_batch_count: expiredBatches.length,
        recalled_batch_count: recalledBatches.length,
        depleted_batch_count: depletedBatches.length,
        inventory_value: round(value, 0),
        average_unit_cost: round(averageUnitCost, 2),
        stock_status: stockStatus,
        last_receipt_at: transaction.last_receipt_at || null,
        last_dispense_at: transaction.last_dispense_at || null,
        last_transaction_at: transaction.last_transaction_at || null,
        batches: medicationBatches,
      };
    })
    .filter(Boolean)
    .filter((row) => !filters.only_low_stock || row.stock_status === 'low' || row.stock_status === 'out')
    .filter((row) => !filters.only_has_stock || row.total_on_hand > 0);
}

function summarizeInventoryRows(rows = []) {
  return rows.reduce((summary, row) => {
    summary.total_medications += 1;
    summary.total_batches += row.batch_count;
    summary.available_batches += row.available_batch_count;
    summary.expired_batches += row.expired_batch_count;
    summary.recalled_batches += row.recalled_batch_count;
    summary.depleted_batches += row.depleted_batch_count;
    summary.near_expiry_batches += row.near_expiry_batch_count;
    summary.total_stock_on_hand += row.total_on_hand;
    summary.inventory_value += row.inventory_value;
    if (row.status === MEDICATION_STATUS.ACTIVE) summary.active_medications += 1;
    if (row.status === MEDICATION_STATUS.INACTIVE) summary.inactive_medications += 1;
    if (row.status === MEDICATION_STATUS.DISCONTINUED) summary.discontinued_medications += 1;
    if (row.stock_status === 'low') summary.low_stock_medication_count += 1;
    if (row.stock_status === 'out') summary.out_of_stock_medication_count += 1;
    return summary;
  }, {
    total_medications: 0,
    active_medications: 0,
    inactive_medications: 0,
    discontinued_medications: 0,
    total_batches: 0,
    available_batches: 0,
    expired_batches: 0,
    recalled_batches: 0,
    depleted_batches: 0,
    near_expiry_batches: 0,
    total_stock_on_hand: 0,
    inventory_value: 0,
    low_stock_medication_count: 0,
    out_of_stock_medication_count: 0,
  });
}

async function getTransactionBreakdowns(filters = {}) {
  const match = {};
  applyDateRange(match, 'occurred_at', filters);
  if (filters.medication_id) match.medication_id = filters.medication_id;
  if (filters.stock_batch_id) match.stock_batch_id = filters.stock_batch_id;
  if (filters.transaction_type) match.transaction_type = filters.transaction_type;
  if (filters.direction) match.direction = filters.direction;
  if (filters.warehouse_id) match.warehouse_id = filters.warehouse_id;

  const [byType, byDirection] = await Promise.all([
    InventoryTransaction.aggregate([
      { $match: match },
      { $group: { _id: '$transaction_type', count: { $sum: 1 }, quantity: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$quantity', { $ifNull: ['$unit_cost', 0] }] } } } },
      { $sort: { _id: 1 } },
    ]),
    InventoryTransaction.aggregate([
      { $match: match },
      { $group: { _id: '$direction', count: { $sum: 1 }, quantity: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$quantity', { $ifNull: ['$unit_cost', 0] }] } } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    by_type: byType.map((row) => ({
      transaction_type: row._id || 'unknown',
      count: row.count || 0,
      quantity: round(row.quantity, 2),
      value: round(row.value, 0),
    })),
    by_direction: byDirection.map((row) => ({
      direction: row._id || 'unknown',
      count: row.count || 0,
      quantity: round(row.quantity, 2),
      value: round(row.value, 0),
    })),
  };
}

async function getMovementTrend(filters = {}) {
  const match = {};
  applyDateRange(match, 'occurred_at', filters);
  if (filters.medication_id) match.medication_id = filters.medication_id;
  if (filters.stock_batch_id) match.stock_batch_id = filters.stock_batch_id;
  if (filters.warehouse_id) match.warehouse_id = filters.warehouse_id;

  const rows = await InventoryTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          date: dayExpression('occurred_at', filters.timezone),
          type: '$transaction_type',
          direction: '$direction',
        },
        quantity: { $sum: '$quantity' },
        value: { $sum: { $multiply: ['$quantity', { $ifNull: ['$unit_cost', 0] }] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);
  const byDate = new Map();
  for (const key of getRangeDates(filters.date_from, filters.date_to, 90)) {
    byDate.set(key, {
      date: key,
      receipt_quantity: 0,
      dispense_quantity: 0,
      return_quantity: 0,
      adjustment_in_quantity: 0,
      adjustment_out_quantity: 0,
      waste_quantity: 0,
      in_quantity: 0,
      out_quantity: 0,
      movement_value: 0,
      transaction_count: 0,
    });
  }
  for (const row of rows) {
    const entry = byDate.get(row._id.date) || {
      date: row._id.date,
      receipt_quantity: 0,
      dispense_quantity: 0,
      return_quantity: 0,
      adjustment_in_quantity: 0,
      adjustment_out_quantity: 0,
      waste_quantity: 0,
      in_quantity: 0,
      out_quantity: 0,
      movement_value: 0,
      transaction_count: 0,
    };
    const quantity = normalizeNumber(row.quantity);
    if (row._id.direction === INVENTORY_TRANSACTION_DIRECTION.IN) entry.in_quantity += quantity;
    if (row._id.direction === INVENTORY_TRANSACTION_DIRECTION.OUT) entry.out_quantity += quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.RECEIPT) entry.receipt_quantity += quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.DISPENSE) entry.dispense_quantity += quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.RETURN) entry.return_quantity += quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.WASTE) entry.waste_quantity += quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.ADJUSTMENT && row._id.direction === INVENTORY_TRANSACTION_DIRECTION.IN) entry.adjustment_in_quantity += quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.ADJUSTMENT && row._id.direction === INVENTORY_TRANSACTION_DIRECTION.OUT) entry.adjustment_out_quantity += quantity;
    entry.movement_value += normalizeNumber(row.value);
    entry.transaction_count += normalizeNumber(row.count);
    byDate.set(row._id.date, entry);
  }

  return Array.from(byDate.values()).map((item) => ({
    ...item,
    receipt_quantity: round(item.receipt_quantity, 2),
    dispense_quantity: round(item.dispense_quantity, 2),
    return_quantity: round(item.return_quantity, 2),
    adjustment_in_quantity: round(item.adjustment_in_quantity, 2),
    adjustment_out_quantity: round(item.adjustment_out_quantity, 2),
    waste_quantity: round(item.waste_quantity, 2),
    in_quantity: round(item.in_quantity, 2),
    out_quantity: round(item.out_quantity, 2),
    movement_value: round(item.movement_value, 0),
  }));
}

function paginateRows(rows = [], query = {}, defaultLimit = 30, maxLimit = 200) {
  const { page, limit, skip } = getPagination(query, defaultLimit, maxLimit);
  return {
    items: rows.slice(skip, skip + limit),
    pagination: buildPagination(page, limit, rows.length),
  };
}

async function getInventoryOverviewReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.INVENTORY_OVERVIEW_READ);
  const filters = normalizeFilters(query);
  const rows = await loadInventoryRows(filters);
  const sortKey = normalizeString(query.sort_by || 'inventory_value');
  const sorted = [...rows].sort((a, b) => normalizeNumber(b[sortKey]) - normalizeNumber(a[sortKey]));
  const { items, pagination } = paginateRows(sorted.map(({ batches, ...row }) => row), query);

  return {
    summary: summarizeInventoryRows(rows),
    items,
    pagination,
    filters: serializeFilters(filters),
  };
}

async function getExpiringStockReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.EXPIRING_STOCK_READ);
  const filters = normalizeFilters(query);
  const now = new Date();
  const nearExpiryTo = addDays(now, filters.near_expiry_days);
  const medications = await MedicationMaster.find(buildMedicationQuery(filters)).select('_id medication_code generic_name brand_name strength dosage_form route_default unit sale_price min_stock_level status').lean();
  const medicationIds = medications.map((item) => item._id);
  const medicationMap = new Map(medications.map((item) => [String(item._id), item]));
  const batchQuery = buildBatchQuery({ ...filters, only_has_stock: true }, medicationIds);
  if (!batchQuery) {
    return { summary: {}, items: [], pagination: buildPagination(1, Number(query.limit || 30), 0), filters: serializeFilters(filters) };
  }
  batchQuery.expiry_date = { $gte: now, $lte: nearExpiryTo };
  batchQuery.status = { $nin: [STOCK_BATCH_STATUS.EXPIRED, STOCK_BATCH_STATUS.RECALLED, STOCK_BATCH_STATUS.DEPLETED] };

  const batches = await StockBatch.find(batchQuery)
    .sort({ expiry_date: 1, quantity_on_hand: -1 })
    .lean();
  const searchedBatches = filters.search ? batches.filter((batch) => batchMatchesSearch(batch, filters.search)) : batches;
  const medIds = [...new Set(searchedBatches.map((batch) => String(batch.medication_id)))].map((id) => toObjectId(id, 'medication_id'));
  const lastTransactions = medIds.length
    ? await InventoryTransaction.aggregate([
      { $match: { medication_id: { $in: medIds } } },
      {
        $group: {
          _id: '$medication_id',
          last_transaction_at: { $max: '$occurred_at' },
          last_dispense_at: { $max: { $cond: [{ $eq: ['$transaction_type', INVENTORY_TRANSACTION_TYPE.DISPENSE] }, '$occurred_at', null] } },
        },
      },
    ])
    : [];
  const transactionMap = new Map(lastTransactions.map((row) => [String(row._id), row]));

  const rows = searchedBatches.map((batch) => {
    const medication = medicationMap.get(String(batch.medication_id)) || {};
    const risk = getBatchRisk(batch, now);
    const tx = transactionMap.get(String(batch.medication_id)) || {};
    return {
      ...toMedicationPayload(medication),
      batch_id: String(batch._id),
      batch_no: batch.batch_no,
      lot_no: batch.lot_no,
      supplier_name: batch.supplier_name || null,
      storage_location: batch.storage_location || null,
      quantity_on_hand: round(batch.quantity_on_hand, 2),
      unit_cost: normalizeNumber(batch.unit_cost),
      expiry_date: batch.expiry_date,
      status: batch.status,
      last_dispense_at: tx.last_dispense_at || null,
      last_transaction_at: tx.last_transaction_at || null,
      ...risk,
    };
  });

  const summary = rows.reduce((output, row) => {
    const days = normalizeNumber(row.days_to_expiry, 9999);
    if (days <= 7) output.expiring_7_days += 1;
    if (days <= 15) output.expiring_15_days += 1;
    if (days <= 30) output.expiring_30_days += 1;
    if (days <= 60) output.expiring_60_days += 1;
    if (days <= 90) output.expiring_90_days += 1;
    output.total_risk_quantity += row.quantity_on_hand;
    output.total_risk_value += row.risk_value;
    return output;
  }, {
    expiring_7_days: 0,
    expiring_15_days: 0,
    expiring_30_days: 0,
    expiring_60_days: 0,
    expiring_90_days: 0,
    total_risk_quantity: 0,
    total_risk_value: 0,
  });

  const { items, pagination } = paginateRows(rows, query);
  return {
    summary: {
      ...summary,
      total_risk_quantity: round(summary.total_risk_quantity, 2),
      total_risk_value: round(summary.total_risk_value, 0),
    },
    items,
    pagination,
    filters: serializeFilters(filters),
  };
}

async function getUsageMap(filters, days) {
  const end = filters.date_to || getEndOfDay(new Date());
  const start = getStartOfDay(addDays(end, -(days - 1)));
  const match = {
    transaction_type: INVENTORY_TRANSACTION_TYPE.DISPENSE,
    direction: INVENTORY_TRANSACTION_DIRECTION.OUT,
    occurred_at: { $gte: start, $lte: end },
  };
  if (filters.medication_id) match.medication_id = filters.medication_id;
  const rows = await InventoryTransaction.aggregate([
    { $match: match },
    { $group: { _id: '$medication_id', quantity: { $sum: '$quantity' } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), normalizeNumber(row.quantity) / days]));
}

async function getPendingDispenseMap(filters = {}) {
  const match = { status: { $in: ['active', 'held'] } };
  if (filters.medication_id) match.medication_id = filters.medication_id;
  const rows = await PrescriptionItem.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'prescriptions',
        localField: 'prescription_id',
        foreignField: '_id',
        as: 'prescription',
      },
    },
    { $unwind: '$prescription' },
    {
      $match: {
        'prescription.status': {
          $in: [PRESCRIPTION_STATUS.ACTIVE, PRESCRIPTION_STATUS.VERIFIED, PRESCRIPTION_STATUS.PARTIALLY_DISPENSED],
        },
      },
    },
    {
      $project: {
        medication_id: 1,
        remaining_quantity: {
          $max: [{ $subtract: ['$quantity', { $ifNull: ['$dispensed_quantity', 0] }] }, 0],
        },
      },
    },
    {
      $group: {
        _id: '$medication_id',
        pending_quantity: { $sum: '$remaining_quantity' },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), normalizeNumber(row.pending_quantity)]));
}

async function getLowStockReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.LOW_STOCK_READ);
  const filters = normalizeFilters(query);
  const [inventoryRows, usage7, usage30, pendingMap] = await Promise.all([
    loadInventoryRows({ ...filters, medication_status: filters.medication_status || MEDICATION_STATUS.ACTIVE }),
    getUsageMap(filters, 7),
    getUsageMap(filters, 30),
    getPendingDispenseMap(filters),
  ]);

  const rows = inventoryRows.map(({ batches, ...row }) => {
    const pending = pendingMap.get(String(row.medication_id)) || 0;
    const avg7 = usage7.get(String(row.medication_id)) || 0;
    const avg30 = usage30.get(String(row.medication_id)) || 0;
    const averageUsage = avg7 || avg30;
    const shortage = Math.max(row.min_stock_level - row.total_on_hand, pending - row.total_on_hand, 0);
    const daysRemaining = averageUsage > 0 ? row.total_on_hand / averageUsage : null;
    const suggested = Math.max(
      shortage,
      row.min_stock_level - row.total_on_hand,
      averageUsage * (filters.lead_time_days + filters.buffer_days) - row.total_on_hand,
      0,
    );
    let severity = 'medium';
    if (row.total_on_hand <= 0 || pending > row.total_on_hand) severity = 'critical';
    else if (row.stock_status === 'low' || (daysRemaining !== null && daysRemaining <= 3)) severity = 'high';
    else if (daysRemaining !== null && daysRemaining <= 7) severity = 'medium';
    else severity = 'watch';
    return {
      ...row,
      current_on_hand: row.total_on_hand,
      shortage_quantity: round(shortage, 2),
      pending_dispense_quantity: round(pending, 2),
      avg_daily_usage_7d: round(avg7, 2),
      avg_daily_usage_30d: round(avg30, 2),
      days_of_stock_remaining: daysRemaining === null ? null : round(daysRemaining, 1),
      suggested_reorder_quantity: round(suggested, 2),
      severity,
      supplier_name: batches?.[0]?.supplier_name || null,
    };
  }).filter((row) =>
    row.current_on_hand <= 0
    || row.current_on_hand <= row.min_stock_level
    || row.pending_dispense_quantity > row.current_on_hand
    || (row.days_of_stock_remaining !== null && row.days_of_stock_remaining <= 7),
  ).sort((a, b) => {
    const rank = { critical: 4, high: 3, medium: 2, watch: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0) || b.shortage_quantity - a.shortage_quantity;
  });

  const summary = rows.reduce((output, row) => {
    output.low_stock_count += row.current_on_hand > 0 && row.current_on_hand <= row.min_stock_level ? 1 : 0;
    output.out_of_stock_count += row.current_on_hand <= 0 ? 1 : 0;
    output.critical_shortage_count += row.severity === 'critical' ? 1 : 0;
    output.total_reorder_suggested_quantity += row.suggested_reorder_quantity;
    return output;
  }, {
    low_stock_count: 0,
    out_of_stock_count: 0,
    critical_shortage_count: 0,
    total_reorder_suggested_quantity: 0,
  });

  const { items, pagination } = paginateRows(rows, query);
  return {
    summary: {
      ...summary,
      total_reorder_suggested_quantity: round(summary.total_reorder_suggested_quantity, 2),
    },
    items,
    pagination,
    filters: serializeFilters(filters),
  };
}

async function getStockoutRiskReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.LOW_STOCK_READ, PERMISSION.REPORTS.LOW_STOCK_READ);
  const lowStock = await getLowStockReport({ ...query, limit: Math.min(Number(query.limit || 300), 1000) }, actor);
  const filters = normalizeFilters(query);
  const rows = (lowStock.items || []).map((row) => {
    const daysRemaining = row.days_of_stock_remaining === null || row.days_of_stock_remaining === undefined
      ? null
      : normalizeNumber(row.days_of_stock_remaining);
    const avgDailyUsage = normalizeNumber(row.avg_daily_usage_7d || row.avg_daily_usage_30d);
    const currentOnHand = normalizeNumber(row.current_on_hand);
    const pendingDemand = normalizeNumber(row.pending_dispense_quantity);
    const projected7dDemand = avgDailyUsage * 7 + pendingDemand;
    const projected14dDemand = avgDailyUsage * 14 + pendingDemand;
    const projected30dDemand = avgDailyUsage * 30 + pendingDemand;
    let riskLevel = 'watch';
    if (currentOnHand <= 0 || pendingDemand > currentOnHand || (daysRemaining !== null && daysRemaining <= 3)) riskLevel = 'critical';
    else if (daysRemaining !== null && daysRemaining <= 7) riskLevel = 'high';
    else if (daysRemaining !== null && daysRemaining <= 14) riskLevel = 'medium';
    return {
      ...row,
      avg_daily_usage: round(avgDailyUsage, 2),
      projected_7d_demand: round(projected7dDemand, 2),
      projected_14d_demand: round(projected14dDemand, 2),
      projected_30d_demand: round(projected30dDemand, 2),
      forecast_shortage_7d: round(Math.max(projected7dDemand - currentOnHand, 0), 2),
      forecast_shortage_14d: round(Math.max(projected14dDemand - currentOnHand, 0), 2),
      forecast_shortage_30d: round(Math.max(projected30dDemand - currentOnHand, 0), 2),
      risk_level: riskLevel,
      stockout_eta_days: daysRemaining,
      suggested_action: riskLevel === 'critical'
        ? 'Tao reorder khan va uu tien cap phat FEFO'
        : riskLevel === 'high'
          ? 'Tao de xuat nhap trong 7 ngay'
          : 'Theo doi va gom vao ke hoach mua hang',
    };
  }).sort((a, b) => {
    const rank = { critical: 4, high: 3, medium: 2, watch: 1 };
    return (rank[b.risk_level] || 0) - (rank[a.risk_level] || 0)
      || normalizeNumber(b.forecast_shortage_7d) - normalizeNumber(a.forecast_shortage_7d);
  });

  const summary = rows.reduce((output, row) => {
    output.risk_medication_count += 1;
    if (row.risk_level === 'critical') output.critical_stockout_count += 1;
    if (row.risk_level === 'high') output.high_stockout_count += 1;
    if (row.risk_level === 'medium') output.medium_stockout_count += 1;
    if (normalizeNumber(row.forecast_shortage_7d) > 0) output.forecast_stockout_7d_count += 1;
    if (normalizeNumber(row.forecast_shortage_14d) > 0) output.forecast_stockout_14d_count += 1;
    if (normalizeNumber(row.forecast_shortage_30d) > 0) output.forecast_stockout_30d_count += 1;
    output.total_forecast_shortage_7d += normalizeNumber(row.forecast_shortage_7d);
    output.total_forecast_shortage_14d += normalizeNumber(row.forecast_shortage_14d);
    output.total_forecast_shortage_30d += normalizeNumber(row.forecast_shortage_30d);
    output.total_suggested_reorder_quantity += normalizeNumber(row.suggested_reorder_quantity);
    return output;
  }, {
    risk_medication_count: 0,
    critical_stockout_count: 0,
    high_stockout_count: 0,
    medium_stockout_count: 0,
    forecast_stockout_7d_count: 0,
    forecast_stockout_14d_count: 0,
    forecast_stockout_30d_count: 0,
    total_forecast_shortage_7d: 0,
    total_forecast_shortage_14d: 0,
    total_forecast_shortage_30d: 0,
    total_suggested_reorder_quantity: 0,
  });
  const { items, pagination } = paginateRows(rows, query);

  return {
    summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, round(value, 2)])),
    breakdowns: {
      by_risk_level: ['critical', 'high', 'medium', 'watch'].map((riskLevel) => ({
        risk_level: riskLevel,
        count: rows.filter((row) => row.risk_level === riskLevel).length,
      })),
      forecast_windows: [
        { window: '7d', count: summary.forecast_stockout_7d_count, shortage_quantity: round(summary.total_forecast_shortage_7d, 2) },
        { window: '14d', count: summary.forecast_stockout_14d_count, shortage_quantity: round(summary.total_forecast_shortage_14d, 2) },
        { window: '30d', count: summary.forecast_stockout_30d_count, shortage_quantity: round(summary.total_forecast_shortage_30d, 2) },
      ],
    },
    items,
    pagination,
    filters: serializeFilters(filters),
    backend_todo: ['GET /api/reports/pharmacy/stockout-risk should include supplier lead time, pending purchase orders and budget constraints for procurement planning.'],
  };
}

async function getInventoryValuationReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.INVENTORY_VALUATION_READ);
  const filters = normalizeFilters(query);
  const rows = await loadInventoryRows({ ...filters, only_has_stock: true });
  const batchRows = rows.flatMap((row) => row.batches.map((batch) => ({
    ...batch,
    medication: row,
    value: normalizeNumber(batch.quantity_on_hand) * normalizeNumber(batch.unit_cost),
  })));

  const summary = batchRows.reduce((output, batch) => {
    const value = normalizeNumber(batch.value);
    output.total_value += value;
    if (batch.status === STOCK_BATCH_STATUS.AVAILABLE) output.available_value += value;
    if (batch.status === STOCK_BATCH_STATUS.EXPIRED) output.expired_value += value;
    if (batch.status === STOCK_BATCH_STATUS.RECALLED) output.recalled_value += value;
    if (batch.status === STOCK_BATCH_STATUS.DEPLETED) output.depleted_value += value;
    const risk = getBatchRisk(batch);
    if (['critical', 'high', 'medium'].includes(risk.severity)) output.near_expiry_value += value;
    return output;
  }, {
    total_value: 0,
    available_value: 0,
    near_expiry_value: 0,
    expired_value: 0,
    recalled_value: 0,
    depleted_value: 0,
  });

  function groupBy(keyGetter, labelKey) {
    const map = new Map();
    for (const batch of batchRows) {
      const key = keyGetter(batch) || 'Không rõ';
      if (!map.has(key)) map.set(key, { [labelKey]: key, batch_count: 0, quantity: 0, value: 0 });
      const item = map.get(key);
      item.batch_count += 1;
      item.quantity += normalizeNumber(batch.quantity_on_hand);
      item.value += normalizeNumber(batch.value);
    }
    return Array.from(map.values()).map((item) => ({
      ...item,
      quantity: round(item.quantity, 2),
      value: round(item.value, 0),
      value_percent: percentage(item.value, summary.total_value),
    })).sort((a, b) => b.value - a.value);
  }

  const byMedication = rows.map(({ batches, ...row }) => ({
    ...row,
    total_value_percent: percentage(row.inventory_value, summary.total_value),
  })).sort((a, b) => b.inventory_value - a.inventory_value);
  let runningValue = 0;
  const pareto = byMedication.map((row, index) => {
    runningValue += row.inventory_value;
    return {
      rank: index + 1,
      medication_id: row.medication_id,
      medication_code: row.medication_code,
      medication_name: row.medication_name,
      inventory_value: row.inventory_value,
      cumulative_value: round(runningValue, 0),
      cumulative_percent: percentage(runningValue, summary.total_value),
    };
  });

  const { items, pagination } = paginateRows(byMedication, query);
  return {
    summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, round(value, 0)])),
    by_medication: items,
    by_supplier: groupBy((batch) => batch.supplier_name, 'supplier_name'),
    by_storage_location: groupBy((batch) => batch.storage_location, 'storage_location'),
    by_batch_status: groupBy((batch) => batch.status, 'status'),
    pareto,
    pagination,
    filters: serializeFilters(filters),
  };
}

async function getInventoryMovementReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.INVENTORY_MOVEMENT_READ);
  const filters = normalizeFilters(query);
  const inventoryRows = await loadInventoryRows(filters);
  const medicationIds = inventoryRows.map((row) => toObjectId(row.medication_id, 'medication_id'));
  const transactionMatch = {};
  applyDateRange(transactionMatch, 'occurred_at', filters);
  if (filters.medication_id) transactionMatch.medication_id = filters.medication_id;
  if (filters.stock_batch_id) transactionMatch.stock_batch_id = filters.stock_batch_id;
  if (filters.transaction_type) transactionMatch.transaction_type = filters.transaction_type;
  if (filters.direction) transactionMatch.direction = filters.direction;
  if (filters.warehouse_id) transactionMatch.warehouse_id = filters.warehouse_id;

  const afterMatch = {};
  if (filters.date_to) afterMatch.occurred_at = { $gt: filters.date_to };
  if (medicationIds.length) afterMatch.medication_id = { $in: medicationIds };

  const [movementRows, afterRows, transactions, breakdowns, trend] = await Promise.all([
    InventoryTransaction.aggregate([
      { $match: { ...transactionMatch, medication_id: { $in: medicationIds } } },
      {
        $group: {
          _id: {
            medication_id: '$medication_id',
            type: '$transaction_type',
            direction: '$direction',
          },
          quantity: { $sum: '$quantity' },
          value: { $sum: { $multiply: ['$quantity', { $ifNull: ['$unit_cost', 0] }] } },
        },
      },
    ]),
    InventoryTransaction.aggregate([
      { $match: afterMatch },
      {
        $group: {
          _id: { medication_id: '$medication_id', direction: '$direction' },
          quantity: { $sum: '$quantity' },
        },
      },
    ]),
    InventoryTransaction.find(transactionMatch)
      .sort({ occurred_at: -1, created_at: -1 })
      .limit(Math.min(Number(query.transaction_limit || 80), 300))
      .populate('medication_id', 'medication_code generic_name brand_name strength unit')
      .populate('stock_batch_id', 'batch_no lot_no expiry_date storage_location status')
      .populate('performed_by', 'full_name username employee_code')
      .lean(),
    getTransactionBreakdowns(filters),
    getMovementTrend(filters),
  ]);

  const movementMap = new Map();
  for (const row of movementRows) {
    const key = String(row._id.medication_id);
    if (!movementMap.has(key)) movementMap.set(key, {});
    const item = movementMap.get(key);
    const quantity = normalizeNumber(row.quantity);
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.RECEIPT) item.receipt_quantity = quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.DISPENSE) item.dispense_quantity = quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.RETURN) item.return_quantity = quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.WASTE) item.waste_quantity = quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.EXPIRE) item.expired_quantity = quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.RECALL) item.recalled_quantity = quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.ADJUSTMENT && row._id.direction === INVENTORY_TRANSACTION_DIRECTION.IN) item.adjustment_in_quantity = quantity;
    if (row._id.type === INVENTORY_TRANSACTION_TYPE.ADJUSTMENT && row._id.direction === INVENTORY_TRANSACTION_DIRECTION.OUT) item.adjustment_out_quantity = quantity;
  }
  const afterMap = new Map();
  for (const row of afterRows) {
    const key = String(row._id.medication_id);
    if (!afterMap.has(key)) afterMap.set(key, { in: 0, out: 0 });
    afterMap.get(key)[row._id.direction] = normalizeNumber(row.quantity);
  }

  const rows = inventoryRows.map(({ batches, ...row }) => {
    const key = String(row.medication_id);
    const movement = movementMap.get(key) || {};
    const after = afterMap.get(key) || {};
    const closingQuantity = row.total_on_hand - normalizeNumber(after.in) + normalizeNumber(after.out);
    const inward = normalizeNumber(movement.receipt_quantity) + normalizeNumber(movement.return_quantity) + normalizeNumber(movement.adjustment_in_quantity);
    const outward = normalizeNumber(movement.dispense_quantity)
      + normalizeNumber(movement.waste_quantity)
      + normalizeNumber(movement.expired_quantity)
      + normalizeNumber(movement.recalled_quantity)
      + normalizeNumber(movement.adjustment_out_quantity);
    const openingQuantity = closingQuantity - inward + outward;
    return {
      ...row,
      opening_quantity: round(openingQuantity, 2),
      receipt_quantity: round(movement.receipt_quantity, 2),
      dispense_quantity: round(movement.dispense_quantity, 2),
      return_quantity: round(movement.return_quantity, 2),
      adjustment_in_quantity: round(movement.adjustment_in_quantity, 2),
      adjustment_out_quantity: round(movement.adjustment_out_quantity, 2),
      waste_quantity: round(normalizeNumber(movement.waste_quantity) + normalizeNumber(movement.expired_quantity) + normalizeNumber(movement.recalled_quantity), 2),
      closing_quantity: round(closingQuantity, 2),
      opening_value: round(openingQuantity * row.average_unit_cost, 0),
      closing_value: round(closingQuantity * row.average_unit_cost, 0),
      variance_quantity: round(closingQuantity - openingQuantity, 2),
    };
  }).filter((row) =>
    row.opening_quantity
    || row.closing_quantity
    || row.receipt_quantity
    || row.dispense_quantity
    || row.return_quantity
    || row.adjustment_in_quantity
    || row.adjustment_out_quantity
    || row.waste_quantity,
  ).sort((a, b) => b.closing_value - a.closing_value);
  const summary = rows.reduce((output, row) => {
    for (const key of [
      'opening_quantity',
      'receipt_quantity',
      'dispense_quantity',
      'return_quantity',
      'adjustment_in_quantity',
      'adjustment_out_quantity',
      'waste_quantity',
      'closing_quantity',
      'opening_value',
      'closing_value',
    ]) {
      output[key] += normalizeNumber(row[key]);
    }
    return output;
  }, {
    opening_quantity: 0,
    receipt_quantity: 0,
    dispense_quantity: 0,
    return_quantity: 0,
    adjustment_in_quantity: 0,
    adjustment_out_quantity: 0,
    waste_quantity: 0,
    closing_quantity: 0,
    opening_value: 0,
    closing_value: 0,
  });
  const { items, pagination } = paginateRows(rows, query);

  return {
    summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, round(value, key.includes('value') ? 0 : 2)])),
    items,
    transactions,
    breakdowns,
    trends: { inventory_movement_by_day: trend },
    pagination,
    filters: serializeFilters(filters),
  };
}

function buildDispenseMatch(filters = {}) {
  const match = {};
  const andConditions = [];
  const dateMatch = {};
  applyDateRange(dateMatch, 'created_at', filters);
  if (dateMatch.created_at) {
    andConditions.push({ $or: [
      { created_at: dateMatch.created_at },
      { dispensed_at: dateMatch.created_at },
      { completed_at: dateMatch.created_at },
    ] });
  }
  if (filters.pharmacist_id) {
    andConditions.push({ $or: [
      { dispensed_by: filters.pharmacist_id },
      { completed_by: filters.pharmacist_id },
      { assigned_to: filters.pharmacist_id },
    ] });
  }
  if (filters.raw.status) match.status = filters.raw.status;
  if (andConditions.length) match.$and = andConditions;
  return match;
}

function prefixMongoCondition(condition = {}, prefix = '') {
  if (condition.$or) {
    return { $or: condition.$or.map((item) => prefixMongoCondition(item, prefix)) };
  }
  if (condition.$and) {
    return { $and: condition.$and.map((item) => prefixMongoCondition(item, prefix)) };
  }
  return Object.fromEntries(Object.entries(condition).map(([key, value]) => [`${prefix}${key}`, value]));
}

async function getDispensingReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.DISPENSING_READ);
  const filters = normalizeFilters(query);
  const match = buildDispenseMatch(filters);
  const { page, limit, skip } = getPagination(query, 30, 200);
  const [dispenses, total, statusRows, byDay, byPharmacist, itemRows, chargeRows, returnedCount] = await Promise.all([
    Dispense.find(match)
      .sort({ completed_at: -1, dispensed_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name')
      .populate('prescription_id', 'prescription_no status prescribed_at')
      .populate('dispensed_by completed_by assigned_to', 'full_name username employee_code')
      .lean(),
    Dispense.countDocuments(match),
    Dispense.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Dispense.aggregate([
      { $match: match },
      { $group: { _id: dayExpression('completed_at', filters.timezone), count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Dispense.aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ['$completed_by', '$dispensed_by'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
    DispenseItem.aggregate([
      {
        $lookup: {
          from: 'dispenses',
          localField: 'dispense_id',
          foreignField: '_id',
          as: 'dispense',
        },
      },
      { $unwind: '$dispense' },
      { $match: prefixMongoCondition(match, 'dispense.') },
      {
        $group: {
          _id: '$medication_id',
          dispense_item_count: { $sum: 1 },
          total_dispensed_quantity: { $sum: '$quantity' },
          dispense_ids: { $addToSet: '$dispense_id' },
        },
      },
      { $sort: { total_dispensed_quantity: -1 } },
      { $limit: 20 },
    ]),
    Charge.aggregate([
      { $match: { dispense_id: { $ne: null } } },
      { $group: { _id: '$dispense_id', value: { $sum: '$total_amount' } } },
    ]),
    Dispense.countDocuments({ ...match, status: DISPENSE_STATUS.RETURNED }),
  ]);
  const dispenseIds = dispenses.map((item) => item._id);
  const [lineRows, medications, users] = await Promise.all([
    dispenseIds.length
      ? DispenseItem.find({ dispense_id: { $in: dispenseIds } })
        .populate('medication_id', 'medication_code generic_name brand_name strength unit sale_price')
        .populate('stock_batch_id', 'batch_no lot_no expiry_date')
        .lean()
      : [],
    itemRows.length
      ? MedicationMaster.find({ _id: { $in: itemRows.map((row) => row._id) } }).select('medication_code generic_name brand_name strength unit sale_price').lean()
      : [],
    byPharmacist.length
      ? User.find({ _id: { $in: byPharmacist.map((row) => row._id).filter(Boolean) } }).select('full_name username employee_code').lean()
      : [],
  ]);
  const chargeMap = new Map(chargeRows.map((row) => [String(row._id), normalizeNumber(row.value)]));
  const lineMap = new Map();
  for (const line of lineRows) {
    const key = String(line.dispense_id);
    if (!lineMap.has(key)) lineMap.set(key, []);
    lineMap.get(key).push(line);
  }
  const medicationMap = new Map(medications.map((item) => [String(item._id), item]));
  const userMap = new Map(users.map((item) => [String(item._id), item]));
  const rows = dispenses.map((dispense) => {
    const lines = lineMap.get(String(dispense._id)) || [];
    return {
      dispense_id: String(dispense._id),
      dispense_no: dispense.dispense_no,
      prescription_id: dispense.prescription_id?._id ? String(dispense.prescription_id._id) : null,
      prescription_no: dispense.prescription_id?.prescription_no || null,
      patient_id: dispense.patient_id?._id ? String(dispense.patient_id._id) : null,
      patient_code: dispense.patient_id?.patient_code || null,
      patient_name: dispense.patient_id?.full_name || null,
      encounter_id: dispense.encounter_id ? String(dispense.encounter_id) : null,
      status: dispense.status,
      line_count: lines.length,
      total_quantity: round(lines.reduce((sum, line) => sum + normalizeNumber(line.quantity), 0), 2),
      estimated_value: round(chargeMap.get(String(dispense._id)) || lines.reduce((sum, line) => sum + normalizeNumber(line.quantity) * normalizeNumber(line.medication_id?.sale_price), 0), 0),
      pharmacist_name: dispense.completed_by?.full_name || dispense.dispensed_by?.full_name || dispense.assigned_to?.full_name || null,
      dispensed_at: dispense.completed_at || dispense.dispensed_at || dispense.created_at,
      items: lines,
    };
  });
  const statusMap = new Map(statusRows.map((row) => [row._id, row.count]));
  const itemSummary = itemRows.reduce((output, row) => {
    output.dispense_item_count += row.dispense_item_count;
    output.total_dispensed_quantity += row.total_dispensed_quantity;
    return output;
  }, { dispense_item_count: 0, total_dispensed_quantity: 0 });
  const estimatedValue = rows.reduce((sum, row) => sum + row.estimated_value, 0);
  const medicationBreakdown = itemRows.map((row) => {
    const medication = medicationMap.get(String(row._id)) || {};
    return {
      ...toMedicationPayload(medication),
      dispense_count: row.dispense_ids?.length || 0,
      dispense_item_count: row.dispense_item_count,
      total_dispensed_quantity: round(row.total_dispensed_quantity, 2),
      estimated_value: round(normalizeNumber(row.total_dispensed_quantity) * normalizeNumber(medication.sale_price), 0),
    };
  });

  return {
    summary: {
      dispense_count: total,
      dispensed_count: statusMap.get(DISPENSE_STATUS.DISPENSED) || 0,
      partial_dispensed_count: statusMap.get(DISPENSE_STATUS.PARTIALLY_DISPENSED) || 0,
      cancelled_count: statusMap.get(DISPENSE_STATUS.CANCELLED) || 0,
      returned_count: returnedCount,
      dispense_item_count: itemSummary.dispense_item_count,
      total_dispensed_quantity: round(itemSummary.total_dispensed_quantity, 2),
      estimated_dispense_value: round(estimatedValue, 0),
      completion_rate: percentage(statusMap.get(DISPENSE_STATUS.DISPENSED) || 0, total),
      return_rate: percentage(returnedCount, total),
    },
    breakdowns: {
      by_status: statusRows.map((row) => ({ status: row._id || 'unknown', count: row.count })),
      by_day: byDay.filter((row) => row._id).map((row) => ({ date: row._id, count: row.count })),
      by_pharmacist: byPharmacist.map((row) => {
        const user = row._id ? userMap.get(String(row._id)) : null;
        return {
          pharmacist_id: row._id ? String(row._id) : null,
          pharmacist_name: user?.full_name || user?.username || 'Chưa gán',
          count: row.count,
        };
      }),
      by_medication: medicationBreakdown,
      by_department: [],
    },
    items: rows,
    line_items: lineRows,
    pagination: buildPagination(page, limit, total),
    filters: serializeFilters(filters),
  };
}

async function getHighUsageMedicationReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.HIGH_USAGE_READ);
  const filters = normalizeFilters(query);
  const match = buildDispenseMatch(filters);
  const groupBy = filters.group_by || 'quantity';
  const itemRows = await DispenseItem.aggregate([
    {
      $lookup: {
        from: 'dispenses',
        localField: 'dispense_id',
        foreignField: '_id',
        as: 'dispense',
      },
    },
    { $unwind: '$dispense' },
    { $match: prefixMongoCondition(match, 'dispense.') },
    {
      $group: {
        _id: '$medication_id',
        dispensed_quantity: { $sum: '$quantity' },
        dispense_ids: { $addToSet: '$dispense_id' },
        prescription_item_ids: { $addToSet: '$prescription_item_id' },
      },
    },
  ]);
  const medicationIds = itemRows.map((row) => row._id).filter(Boolean);
  const [medications, inventoryRows, adminRows] = await Promise.all([
    medicationIds.length ? MedicationMaster.find({ _id: { $in: medicationIds } }).select('medication_code generic_name brand_name strength dosage_form route_default unit sale_price min_stock_level status').lean() : [],
    loadInventoryRows(filters),
    medicationIds.length
      ? MedicationAdministration.aggregate([
        {
          $match: {
            medication_id: { $in: medicationIds },
            status: ADMINISTRATION_STATUS.GIVEN,
            administered_at: { $gte: filters.date_from, $lte: filters.date_to },
          },
        },
        { $group: { _id: '$medication_id', administration_count: { $sum: 1 }, patient_ids: { $addToSet: '$patient_id' } } },
      ])
      : [],
  ]);
  const medicationMap = new Map(medications.map((item) => [String(item._id), item]));
  const stockMap = new Map(inventoryRows.map((row) => [String(row.medication_id), row]));
  const adminMap = new Map(adminRows.map((row) => [String(row._id), row]));
  const days = Math.max(Math.ceil(((filters.date_to || new Date()) - (filters.date_from || addDays(new Date(), -29))) / MS_PER_DAY), 1);
  const previousStart = addDays(filters.date_from, -days);
  const previousEnd = addDays(filters.date_from, -1);
  const previousRows = medicationIds.length
    ? await InventoryTransaction.aggregate([
      {
        $match: {
          medication_id: { $in: medicationIds },
          transaction_type: INVENTORY_TRANSACTION_TYPE.DISPENSE,
          direction: INVENTORY_TRANSACTION_DIRECTION.OUT,
          occurred_at: { $gte: previousStart, $lte: previousEnd },
        },
      },
      { $group: { _id: '$medication_id', quantity: { $sum: '$quantity' } } },
    ])
    : [];
  const previousMap = new Map(previousRows.map((row) => [String(row._id), normalizeNumber(row.quantity)]));

  const rows = itemRows.map((row) => {
    const medication = medicationMap.get(String(row._id)) || {};
    const stock = stockMap.get(String(row._id)) || {};
    const admin = adminMap.get(String(row._id)) || {};
    const estimatedValue = normalizeNumber(row.dispensed_quantity) * normalizeNumber(medication.sale_price || stock.average_unit_cost);
    const avgDailyUsage = normalizeNumber(row.dispensed_quantity) / days;
    const previous = previousMap.get(String(row._id)) || 0;
    const trendPercent = previous > 0 ? ((row.dispensed_quantity - previous) / previous) * 100 : (row.dispensed_quantity > 0 ? 100 : 0);
    const daysRemaining = avgDailyUsage > 0 ? normalizeNumber(stock.total_on_hand) / avgDailyUsage : null;
    let severity = 'normal';
    if (daysRemaining !== null && daysRemaining <= 3) severity = 'critical';
    else if (daysRemaining !== null && daysRemaining <= 7) severity = 'high';
    else if (trendPercent >= 80) severity = 'medium';
    return {
      ...toMedicationPayload(medication),
      dispensed_quantity: round(row.dispensed_quantity, 2),
      dispense_count: row.dispense_ids?.length || 0,
      prescription_count: row.prescription_item_ids?.length || 0,
      patient_count: admin.patient_ids?.length || 0,
      administration_count: admin.administration_count || 0,
      estimated_value: round(estimatedValue, 0),
      current_on_hand: round(stock.total_on_hand, 2),
      avg_daily_usage: round(avgDailyUsage, 2),
      days_remaining: daysRemaining === null ? null : round(daysRemaining, 1),
      trend_percent: round(trendPercent, 2),
      severity,
    };
  });

  const sortMap = {
    value: 'estimated_value',
    prescription_count: 'prescription_count',
    patient_count: 'patient_count',
    quantity: 'dispensed_quantity',
  };
  rows.sort((a, b) => normalizeNumber(b[sortMap[groupBy] || 'dispensed_quantity']) - normalizeNumber(a[sortMap[groupBy] || 'dispensed_quantity']));
  rows.forEach((row, index) => { row.rank = index + 1; });
  const { items, pagination } = paginateRows(rows, query);

  return {
    summary: {
      total_dispensed_quantity: round(rows.reduce((sum, row) => sum + row.dispensed_quantity, 0), 2),
      total_dispense_value: round(rows.reduce((sum, row) => sum + row.estimated_value, 0), 0),
      medication_count: rows.length,
      abnormal_increase_count: rows.filter((row) => row.trend_percent >= 80).length,
    },
    items,
    pagination,
    filters: serializeFilters(filters),
  };
}

async function getWasteDisposalReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.WASTE_DISPOSAL_READ);
  const filters = normalizeFilters(query);
  const match = {
    $or: [
      { transaction_type: { $in: WASTE_TRANSACTION_TYPES } },
      { transaction_type: INVENTORY_TRANSACTION_TYPE.ADJUSTMENT, direction: INVENTORY_TRANSACTION_DIRECTION.OUT },
    ],
  };
  applyDateRange(match, 'occurred_at', filters);
  if (filters.medication_id) match.medication_id = filters.medication_id;
  if (filters.stock_batch_id) match.stock_batch_id = filters.stock_batch_id;
  if (filters.transaction_type) {
    if (filters.transaction_type === 'adjustment_out') {
      match.$or = [{ transaction_type: INVENTORY_TRANSACTION_TYPE.ADJUSTMENT, direction: INVENTORY_TRANSACTION_DIRECTION.OUT }];
    } else {
      match.$or = [{ transaction_type: filters.transaction_type }];
    }
  }
  if (filters.direction) match.direction = filters.direction;

  const { page, limit, skip } = getPagination(query, 30, 200);
  const [transactions, total, byType, byMedication, byPerformer, disposals] = await Promise.all([
    InventoryTransaction.find(match)
      .sort({ occurred_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('medication_id', 'medication_code generic_name brand_name strength unit')
      .populate('stock_batch_id', 'batch_no lot_no expiry_date storage_location status')
      .populate('performed_by', 'full_name username employee_code')
      .lean(),
    InventoryTransaction.countDocuments(match),
    InventoryTransaction.aggregate([
      { $match: match },
      { $group: { _id: '$transaction_type', count: { $sum: 1 }, quantity: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$quantity', { $ifNull: ['$unit_cost', 0] }] } } } },
      { $sort: { value: -1 } },
    ]),
    InventoryTransaction.aggregate([
      { $match: match },
      { $group: { _id: '$medication_id', count: { $sum: 1 }, quantity: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$quantity', { $ifNull: ['$unit_cost', 0] }] } } } },
      { $sort: { value: -1 } },
      { $limit: 20 },
    ]),
    InventoryTransaction.aggregate([
      { $match: match },
      { $group: { _id: '$performed_by', count: { $sum: 1 }, quantity: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$quantity', { $ifNull: ['$unit_cost', 0] }] } } } },
      { $sort: { value: -1 } },
      { $limit: 12 },
    ]),
    InventoryDisposal.find({ is_deleted: false })
      .sort({ created_at: -1 })
      .limit(20)
      .populate('requested_by approved_by posted_by', 'full_name username employee_code')
      .lean(),
  ]);
  const medicationIds = byMedication.map((row) => row._id).filter(Boolean);
  const performerIds = byPerformer.map((row) => row._id).filter(Boolean);
  const [medications, users] = await Promise.all([
    medicationIds.length ? MedicationMaster.find({ _id: { $in: medicationIds } }).select('medication_code generic_name brand_name strength unit').lean() : [],
    performerIds.length ? User.find({ _id: { $in: performerIds } }).select('full_name username employee_code').lean() : [],
  ]);
  const medicationMap = new Map(medications.map((item) => [String(item._id), item]));
  const userMap = new Map(users.map((item) => [String(item._id), item]));
  const rows = transactions.map((transaction) => ({
    transaction_id: String(transaction._id),
    transaction_no: transaction.transaction_no,
    occurred_at: transaction.occurred_at,
    transaction_type: transaction.transaction_type,
    direction: transaction.direction,
    reason_code: transaction.reason_code || transaction.metadata?.reason_code || transaction.metadata?.disposal_type || null,
    medication_id: transaction.medication_id?._id ? String(transaction.medication_id._id) : null,
    medication_code: transaction.medication_id?.medication_code || null,
    medication_name: medicationName(transaction.medication_id || {}),
    batch_id: transaction.stock_batch_id?._id ? String(transaction.stock_batch_id._id) : null,
    batch_no: transaction.stock_batch_id?.batch_no || null,
    lot_no: transaction.stock_batch_id?.lot_no || null,
    quantity: round(transaction.quantity, 2),
    unit_cost: normalizeNumber(transaction.unit_cost),
    value: round(normalizeNumber(transaction.quantity) * normalizeNumber(transaction.unit_cost), 0),
    performed_by: transaction.performed_by?.full_name || transaction.performed_by?.username || null,
    reference_type: transaction.reference_type || null,
    reference_id: transaction.reference_id ? String(transaction.reference_id) : null,
    note: transaction.note || null,
    severity: transaction.transaction_type === INVENTORY_TRANSACTION_TYPE.ADJUSTMENT ? 'medium' : 'high',
  }));
  const totalValue = byType.reduce((sum, row) => sum + normalizeNumber(row.value), 0);

  return {
    summary: {
      waste_transaction_count: total,
      waste_quantity: round(byType.reduce((sum, row) => sum + normalizeNumber(row.quantity), 0), 2),
      waste_value: round(totalValue, 0),
      expired_quantity: round(byType.find((row) => row._id === INVENTORY_TRANSACTION_TYPE.EXPIRE)?.quantity, 2),
      recall_quantity: round(byType.find((row) => row._id === INVENTORY_TRANSACTION_TYPE.RECALL)?.quantity, 2),
      adjustment_out_quantity: round(byType.find((row) => row._id === INVENTORY_TRANSACTION_TYPE.ADJUSTMENT)?.quantity, 2),
      posted_disposal_count: disposals.filter((item) => item.status === 'posted').length,
      pending_disposal_count: disposals.filter((item) => ['draft', 'pending_approval', 'approved'].includes(item.status)).length,
    },
    breakdowns: {
      by_type: byType.map((row) => ({
        transaction_type: row._id || 'unknown',
        count: row.count,
        quantity: round(row.quantity, 2),
        value: round(row.value, 0),
      })),
      by_medication: byMedication.map((row) => {
        const medication = medicationMap.get(String(row._id)) || {};
        return {
          ...toMedicationPayload(medication),
          count: row.count,
          quantity: round(row.quantity, 2),
          value: round(row.value, 0),
        };
      }),
      by_performer: byPerformer.map((row) => {
        const user = row._id ? userMap.get(String(row._id)) : null;
        return {
          user_id: row._id ? String(row._id) : null,
          user_name: user?.full_name || user?.username || 'Không rõ',
          count: row.count,
          quantity: round(row.quantity, 2),
          value: round(row.value, 0),
        };
      }),
    },
    items: rows,
    disposal_jobs: disposals,
    pagination: buildPagination(page, limit, total),
    filters: serializeFilters(filters),
  };
}

async function getExpiredRecalledBatchesReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.EXPIRING_STOCK_READ, PERMISSION.PHARMACY_REPORTS?.WASTE_DISPOSAL_READ);
  const filters = normalizeFilters(query);
  const medications = await MedicationMaster.find(buildMedicationQuery(filters))
    .select('medication_code generic_name brand_name strength dosage_form route_default unit sale_price min_stock_level status')
    .lean();
  const medicationIds = medications.map((item) => item._id);
  const medicationMap = new Map(medications.map((item) => [String(item._id), item]));
  const batchQuery = buildBatchQuery(filters, medicationIds);
  if (!batchQuery) {
    return { summary: {}, items: [], pagination: buildPagination(1, Number(query.limit || 30), 0), filters: serializeFilters(filters) };
  }
  const now = new Date();
  batchQuery.$or = [
    { status: { $in: [STOCK_BATCH_STATUS.EXPIRED, STOCK_BATCH_STATUS.RECALLED] } },
    { expiry_date: { $lt: now }, quantity_on_hand: { $gt: 0 } },
  ];

  const allBatches = await StockBatch.find(batchQuery)
    .sort({ status: 1, expiry_date: 1, quantity_on_hand: -1 })
    .lean();
  const batches = filters.search ? allBatches.filter((batch) => batchMatchesSearch(batch, filters.search)) : allBatches;
  const batchIds = batches.map((batch) => batch._id);
  const [impactRows, wasteRows] = await Promise.all([
    batchIds.length
      ? DispenseItem.aggregate([
        { $match: { stock_batch_id: { $in: batchIds } } },
        { $group: { _id: '$stock_batch_id', dispense_count: { $addToSet: '$dispense_id' }, patient_count: { $sum: 0 }, quantity: { $sum: '$quantity' } } },
      ])
      : [],
    batchIds.length
      ? InventoryTransaction.aggregate([
        { $match: { stock_batch_id: { $in: batchIds }, transaction_type: { $in: WASTE_TRANSACTION_TYPES } } },
        { $group: { _id: '$stock_batch_id', disposal_quantity: { $sum: '$quantity' }, disposal_value: { $sum: { $multiply: ['$quantity', { $ifNull: ['$unit_cost', 0] }] } } } },
      ])
      : [],
  ]);
  const impactMap = new Map(impactRows.map((row) => [String(row._id), row]));
  const wasteMap = new Map(wasteRows.map((row) => [String(row._id), row]));
  const rows = batches.map((batch) => {
    const medication = medicationMap.get(String(batch.medication_id)) || {};
    const risk = getBatchRisk(batch, now);
    const impact = impactMap.get(String(batch._id)) || {};
    const waste = wasteMap.get(String(batch._id)) || {};
    const valueImpact = normalizeNumber(batch.quantity_on_hand) * normalizeNumber(batch.unit_cost);
    const status = batch.status === STOCK_BATCH_STATUS.RECALLED ? STOCK_BATCH_STATUS.RECALLED : STOCK_BATCH_STATUS.EXPIRED;
    return {
      ...toMedicationPayload(medication),
      batch_id: String(batch._id),
      batch_no: batch.batch_no,
      lot_no: batch.lot_no,
      supplier_name: batch.supplier_name || null,
      storage_location: batch.storage_location || null,
      quantity_on_hand: round(batch.quantity_on_hand, 2),
      unit_cost: normalizeNumber(batch.unit_cost),
      value_impact: round(valueImpact, 0),
      expiry_date: batch.expiry_date,
      status,
      recall_reason: batch.recall_reason || null,
      recall_reference_no: batch.recall_reference_no || null,
      recall_resolution_status: batch.recall_resolution_status || null,
      recall_impact_dispenses: impact.dispense_count?.length || 0,
      recall_impact_quantity: round(impact.quantity, 2),
      disposal_quantity: round(waste.disposal_quantity, 2),
      disposal_value: round(waste.disposal_value, 0),
      disposal_status: waste.disposal_quantity ? 'posted' : 'pending',
      ...risk,
    };
  });

  const summary = rows.reduce((output, row) => {
    if (row.status === STOCK_BATCH_STATUS.EXPIRED) {
      output.expired_batch_count += 1;
      output.expired_quantity += row.quantity_on_hand;
      output.expired_value += row.value_impact;
    }
    if (row.status === STOCK_BATCH_STATUS.RECALLED) {
      output.recalled_batch_count += 1;
      output.recalled_quantity += row.quantity_on_hand;
      output.recalled_value += row.value_impact;
      output.recall_impact_dispenses += row.recall_impact_dispenses;
    }
    if (row.disposal_status === 'pending') output.disposal_pending += 1;
    if (row.disposal_status === 'posted') output.disposal_posted += 1;
    return output;
  }, {
    expired_batch_count: 0,
    recalled_batch_count: 0,
    expired_quantity: 0,
    recalled_quantity: 0,
    expired_value: 0,
    recalled_value: 0,
    disposal_pending: 0,
    disposal_posted: 0,
    recall_impact_dispenses: 0,
  });
  const byMedication = new Map();
  rows.forEach((row) => {
    const key = row.medication_id || row.medication_name;
    if (!byMedication.has(key)) byMedication.set(key, { medication_id: row.medication_id, medication_name: row.medication_name, count: 0, quantity: 0, value: 0 });
    const item = byMedication.get(key);
    item.count += 1;
    item.quantity += row.quantity_on_hand;
    item.value += row.value_impact;
  });
  const { items, pagination } = paginateRows(rows, query);
  return {
    summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, round(value, key.includes('value') ? 0 : 2)])),
    breakdowns: {
      by_medication: [...byMedication.values()].map((row) => ({ ...row, quantity: round(row.quantity, 2), value: round(row.value, 0) })).sort((a, b) => b.value - a.value),
      by_status: [
        { status: STOCK_BATCH_STATUS.EXPIRED, count: summary.expired_batch_count, value: round(summary.expired_value, 0) },
        { status: STOCK_BATCH_STATUS.RECALLED, count: summary.recalled_batch_count, value: round(summary.recalled_value, 0) },
      ],
    },
    items,
    pagination,
    filters: serializeFilters(filters),
  };
}

async function getPrescriptionPharmacyReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PRESCRIPTIONS.READ);
  const filters = normalizeFilters(query);
  const match = {};
  applyDateRange(match, 'prescribed_at', filters);
  if (filters.doctor_id) match.prescribed_by = filters.doctor_id;
  if (filters.raw.status) match.status = filters.raw.status;
  if (filters.search) match.prescription_no = { $regex: escapeRegex(filters.search), $options: 'i' };
  const { page, limit, skip } = getPagination(query, 30, 200);

  const [prescriptions, total, statusRows, byDoctorRows, itemsRows, dispenses] = await Promise.all([
    Prescription.find(match)
      .sort({ prescribed_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('encounter_id', 'encounter_code department_id status start_time')
      .populate('prescribed_by verified_by', 'full_name username employee_code')
      .lean(),
    Prescription.countDocuments(match),
    Prescription.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Prescription.aggregate([{ $match: match }, { $group: { _id: '$prescribed_by', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 12 }]),
    PrescriptionItem.aggregate([
      {
        $lookup: {
          from: 'prescriptions',
          localField: 'prescription_id',
          foreignField: '_id',
          as: 'prescription',
        },
      },
      { $unwind: '$prescription' },
      { $match: prefixMongoCondition(match, 'prescription.') },
      { $group: { _id: '$medication_id', item_count: { $sum: 1 }, quantity: { $sum: '$quantity' }, dispensed_quantity: { $sum: '$dispensed_quantity' } } },
      { $sort: { item_count: -1 } },
      { $limit: 20 },
    ]),
    Dispense.find({}).select('prescription_id status').lean(),
  ]);
  const prescriptionIds = prescriptions.map((item) => item._id);
  const medicationIds = itemsRows.map((row) => row._id).filter(Boolean);
  const doctorIds = byDoctorRows.map((row) => row._id).filter(Boolean);
  const [lineCounts, medications, doctors] = await Promise.all([
    prescriptionIds.length
      ? PrescriptionItem.aggregate([
        { $match: { prescription_id: { $in: prescriptionIds } } },
        { $group: { _id: '$prescription_id', item_count: { $sum: 1 }, quantity: { $sum: '$quantity' }, dispensed_quantity: { $sum: '$dispensed_quantity' } } },
      ])
      : [],
    medicationIds.length ? MedicationMaster.find({ _id: { $in: medicationIds } }).select('medication_code generic_name brand_name strength unit').lean() : [],
    doctorIds.length ? User.find({ _id: { $in: doctorIds } }).select('full_name username employee_code').lean() : [],
  ]);
  const lineMap = new Map(lineCounts.map((row) => [String(row._id), row]));
  const medicationMap = new Map(medications.map((row) => [String(row._id), row]));
  const doctorMap = new Map(doctors.map((row) => [String(row._id), row]));
  const dispenseMap = new Map();
  dispenses.forEach((dispense) => {
    const key = String(dispense.prescription_id);
    if (!dispenseMap.has(key)) dispenseMap.set(key, []);
    dispenseMap.get(key).push(dispense);
  });
  const rows = prescriptions.map((prescription) => {
    const line = lineMap.get(String(prescription._id)) || {};
    const relatedDispenses = dispenseMap.get(String(prescription._id)) || [];
    return {
      prescription_id: String(prescription._id),
      prescription_no: prescription.prescription_no,
      patient_id: prescription.patient_id?._id ? String(prescription.patient_id._id) : null,
      patient_code: prescription.patient_id?.patient_code || null,
      patient_name: prescription.patient_id?.full_name || null,
      encounter_id: prescription.encounter_id?._id ? String(prescription.encounter_id._id) : null,
      encounter_code: prescription.encounter_id?.encounter_code || null,
      doctor_id: prescription.prescribed_by?._id ? String(prescription.prescribed_by._id) : null,
      doctor_name: prescription.prescribed_by?.full_name || prescription.prescribed_by?.username || null,
      department_id: prescription.encounter_id?.department_id ? String(prescription.encounter_id.department_id) : null,
      status: prescription.status,
      prescribed_at: prescription.prescribed_at,
      verified_at: prescription.verified_at,
      item_count: line.item_count || 0,
      total_quantity: round(line.quantity, 2),
      dispensed_quantity: round(line.dispensed_quantity, 2),
      dispense_status: relatedDispenses.some((item) => item.status === DISPENSE_STATUS.DISPENSED) ? 'dispensed' : (relatedDispenses[0]?.status || prescription.status),
      risk_flags: [],
    };
  }).filter((row) => !filters.department_id || row.department_id === String(filters.department_id));
  const statusMap = new Map(statusRows.map((row) => [row._id, row.count]));
  return {
    summary: {
      prescription_count: total,
      draft_count: statusMap.get(PRESCRIPTION_STATUS.DRAFT) || 0,
      active_count: statusMap.get(PRESCRIPTION_STATUS.ACTIVE) || 0,
      verified_count: statusMap.get(PRESCRIPTION_STATUS.VERIFIED) || 0,
      partially_dispensed_count: statusMap.get(PRESCRIPTION_STATUS.PARTIALLY_DISPENSED) || 0,
      fully_dispensed_count: statusMap.get(PRESCRIPTION_STATUS.FULLY_DISPENSED) || 0,
      cancelled_count: statusMap.get(PRESCRIPTION_STATUS.CANCELLED) || 0,
      completed_count: statusMap.get(PRESCRIPTION_STATUS.COMPLETED) || 0,
      waiting_dispense_count: rows.filter((row) => ['active', 'verified', 'partially_dispensed'].includes(row.status)).length,
      risk_allergy_count: 0,
      risk_interaction_count: 0,
      risk_duplicate_count: 0,
    },
    breakdowns: {
      by_status: statusRows.map((row) => ({ status: row._id || 'unknown', count: row.count })),
      by_doctor: byDoctorRows.map((row) => {
        const doctor = row._id ? doctorMap.get(String(row._id)) : null;
        return { doctor_id: row._id ? String(row._id) : null, doctor_name: doctor?.full_name || doctor?.username || 'Không rõ', count: row.count };
      }),
      by_medication: itemsRows.map((row) => {
        const medication = medicationMap.get(String(row._id)) || {};
        return { ...toMedicationPayload(medication), item_count: row.item_count, quantity: round(row.quantity, 2), dispensed_quantity: round(row.dispensed_quantity, 2) };
      }),
      risk_breakdown: [
        { risk: 'allergy', count: 0 },
        { risk: 'interaction', count: 0 },
        { risk: 'duplicate', count: 0 },
      ],
    },
    items: rows,
    pagination: buildPagination(page, limit, total),
    filters: serializeFilters(filters),
    backend_todo: ['GET /api/reports/pharmacy/prescriptions should persist risk flags for allergy, interaction, duplicate medication and stock shortage by prescription.'],
  };
}

async function getInventoryTurnoverReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.HIGH_USAGE_READ, PERMISSION.PHARMACY_REPORTS?.INVENTORY_VALUATION_READ);
  const filters = normalizeFilters(query);
  const [highUsage, valuation, lowStock] = await Promise.all([
    getHighUsageMedicationReport({ ...query, limit: 300 }, actor),
    getInventoryValuationReport({ ...query, limit: 500 }, actor),
    getLowStockReport({ ...query, limit: 300 }, actor),
  ]);
  const valuationMap = new Map((valuation.by_medication || []).map((row) => [String(row.medication_id), row]));
  const lowStockMap = new Map((lowStock.items || []).map((row) => [String(row.medication_id), row]));
  const days = Math.max(Math.ceil(((filters.date_to || new Date()) - (filters.date_from || addDays(new Date(), -29))) / MS_PER_DAY), 1);
  const rows = (highUsage.items || []).map((row) => {
    const valueRow = valuationMap.get(String(row.medication_id)) || {};
    const low = lowStockMap.get(String(row.medication_id)) || {};
    const averageInventoryValue = normalizeNumber(valueRow.inventory_value || row.current_on_hand * row.sale_price);
    const turnoverRatio = averageInventoryValue > 0 ? normalizeNumber(row.estimated_value) / averageInventoryValue : 0;
    const daysInventoryOnHand = turnoverRatio > 0 ? days / turnoverRatio : null;
    let movementClass = 'normal_moving';
    if (row.days_remaining !== null && row.days_remaining <= 7) movementClass = 'fast_moving';
    if (turnoverRatio < 0.1 && averageInventoryValue > 0) movementClass = 'slow_moving';
    if (!normalizeNumber(row.dispensed_quantity) && averageInventoryValue > 0) movementClass = 'dead_stock';
    if (normalizeNumber(row.trend_percent) >= 80) movementClass = 'abnormal_increase';
    return {
      ...row,
      opening_value: round(averageInventoryValue, 0),
      closing_value: round(averageInventoryValue, 0),
      average_inventory_value: round(averageInventoryValue, 0),
      dispense_value: round(row.estimated_value, 0),
      turnover_ratio: round(turnoverRatio, 3),
      days_inventory_on_hand: daysInventoryOnHand === null ? null : round(daysInventoryOnHand, 1),
      movement_class: movementClass,
      suggested_action: movementClass === 'fast_moving' || low.severity === 'critical'
        ? 'Ưu tiên reorder và theo dõi stockout'
        : movementClass === 'slow_moving' || movementClass === 'dead_stock'
          ? 'Giảm nhập, rà soát chuyển kho/FEFO'
          : 'Theo dõi định kỳ',
    };
  });
  const noUsageValueRows = (valuation.by_medication || [])
    .filter((row) => !rows.some((item) => String(item.medication_id) === String(row.medication_id)) && normalizeNumber(row.inventory_value) > 0)
    .slice(0, 100)
    .map((row, index) => ({
      ...row,
      rank: rows.length + index + 1,
      dispensed_quantity: 0,
      estimated_value: 0,
      current_on_hand: row.total_on_hand,
      avg_daily_usage: 0,
      days_remaining: null,
      trend_percent: 0,
      severity: 'watch',
      average_inventory_value: round(row.inventory_value, 0),
      dispense_value: 0,
      turnover_ratio: 0,
      days_inventory_on_hand: null,
      movement_class: 'dead_stock',
      suggested_action: 'Rà soát tồn chậm/dead stock',
    }));
  const allRows = [...rows, ...noUsageValueRows].sort((a, b) => normalizeNumber(b.dispense_value) - normalizeNumber(a.dispense_value));
  const { items, pagination } = paginateRows(allRows, query);
  const totalDispenseValue = allRows.reduce((sum, row) => sum + normalizeNumber(row.dispense_value), 0);
  const averageInventoryValue = allRows.reduce((sum, row) => sum + normalizeNumber(row.average_inventory_value), 0);
  const turnoverRatio = averageInventoryValue > 0 ? totalDispenseValue / averageInventoryValue : 0;
  return {
    summary: {
      total_dispensed_quantity: round(allRows.reduce((sum, row) => sum + normalizeNumber(row.dispensed_quantity), 0), 2),
      total_dispense_value: round(totalDispenseValue, 0),
      medication_count: allRows.length,
      abnormal_increase_count: allRows.filter((row) => row.movement_class === 'abnormal_increase').length,
      average_days_remaining: round(average(allRows.map((row) => row.days_remaining).filter((value) => value !== null)), 1),
      slow_moving_count: allRows.filter((row) => row.movement_class === 'slow_moving').length,
      fast_moving_count: allRows.filter((row) => row.movement_class === 'fast_moving').length,
      dead_stock_count: allRows.filter((row) => row.movement_class === 'dead_stock').length,
      estimated_turnover_ratio: round(turnoverRatio, 3),
      estimated_days_inventory_on_hand: turnoverRatio > 0 ? round(days / turnoverRatio, 1) : null,
    },
    items,
    breakdowns: {
      movement_class: ['fast_moving', 'normal_moving', 'slow_moving', 'dead_stock', 'abnormal_increase'].map((key) => ({
        movement_class: key,
        count: allRows.filter((row) => row.movement_class === key).length,
      })),
    },
    pagination,
    filters: serializeFilters(filters),
    backend_todo: ['GET /api/reports/pharmacy/turnover should use COGS, opening/closing inventory snapshots and supplier/warehouse dimensions for audited inventory turnover.'],
  };
}

async function getPharmacyDashboardReport(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.DASHBOARD_READ);
  const filters = normalizeFilters(query, { defaultRange: query.range || '30d' });
  const [
    inventoryOverview,
    expiringStock,
    lowStock,
    valuation,
    dispensing,
    highUsage,
    waste,
    movementTrend,
    transactionBreakdowns,
  ] = await Promise.all([
    getInventoryOverviewReport({ ...query, limit: 8 }, actor),
    getExpiringStockReport({ ...query, limit: 8, near_expiry_days: query.near_expiry_days || 30 }, actor),
    getLowStockReport({ ...query, limit: 8 }, actor),
    getInventoryValuationReport({ ...query, limit: 10 }, actor),
    getDispensingReport({ ...query, limit: 8 }, actor),
    getHighUsageMedicationReport({ ...query, limit: 10 }, actor),
    getWasteDisposalReport({ ...query, limit: 8 }, actor),
    getMovementTrend(filters),
    getTransactionBreakdowns(filters),
  ]);

  const urgentWorklist = [
    ...(lowStock.items || []).map((item) => ({
      severity: item.severity,
      issue_type: item.current_on_hand <= 0 ? 'out_of_stock' : 'low_stock',
      issue: item.current_on_hand <= 0 ? 'Hết tồn' : 'Dưới tồn tối thiểu',
      medication_id: item.medication_id,
      medication_name: item.medication_name,
      batch_id: null,
      batch_no: null,
      quantity: item.current_on_hand,
      value: item.inventory_value,
      due_date: null,
      suggested_action: item.current_on_hand <= 0 ? 'Tạo đề xuất nhập ngay' : 'Tạo reorder suggestion',
      action: 'reorder',
    })),
    ...(expiringStock.items || []).map((item) => ({
      severity: item.severity,
      issue_type: 'near_expiry',
      issue: 'Sắp hết hạn',
      medication_id: item.medication_id,
      medication_name: item.medication_name,
      batch_id: item.batch_id,
      batch_no: item.batch_no,
      quantity: item.quantity_on_hand,
      value: item.risk_value,
      due_date: item.expiry_date,
      days_to_expiry: item.days_to_expiry,
      suggested_action: item.suggested_action,
      action: 'view_batch',
    })),
    ...(waste.items || []).slice(0, 4).map((item) => ({
      severity: item.severity,
      issue_type: 'waste',
      issue: item.transaction_type,
      medication_id: item.medication_id,
      medication_name: item.medication_name,
      batch_id: item.batch_id,
      batch_no: item.batch_no,
      quantity: item.quantity,
      value: item.value,
      due_date: item.occurred_at,
      suggested_action: 'Kiểm tra audit và chứng từ',
      action: 'view_transaction',
    })),
  ].sort((first, second) => {
    const rank = { critical: 4, high: 3, medium: 2, watch: 1, normal: 0 };
    return (rank[second.severity] || 0) - (rank[first.severity] || 0);
  }).slice(0, 16);

  const summary = {
    total_active_medications: inventoryOverview.summary.active_medications,
    total_batches: inventoryOverview.summary.total_batches,
    total_on_hand: round(inventoryOverview.summary.total_stock_on_hand, 2),
    inventory_value: round(inventoryOverview.summary.inventory_value, 0),
    low_stock_medication_count: lowStock.summary.low_stock_count,
    out_of_stock_medication_count: lowStock.summary.out_of_stock_count,
    near_expiry_batch_count: expiringStock.summary.expiring_30_days,
    expired_batch_count: inventoryOverview.summary.expired_batches,
    recalled_batch_count: inventoryOverview.summary.recalled_batches,
    receipt_quantity: movementTrend.reduce((sum, row) => sum + row.receipt_quantity, 0),
    dispense_quantity: movementTrend.reduce((sum, row) => sum + row.dispense_quantity, 0),
    return_quantity: movementTrend.reduce((sum, row) => sum + row.return_quantity, 0),
    adjustment_quantity: movementTrend.reduce((sum, row) => sum + row.adjustment_in_quantity + row.adjustment_out_quantity, 0),
    waste_quantity: waste.summary.waste_quantity,
    dispense_count: dispensing.summary.dispense_count,
    partial_dispense_count: dispensing.summary.partial_dispensed_count,
    returned_dispense_count: dispensing.summary.returned_count,
    estimated_waste_value: waste.summary.waste_value,
  };

  return {
    summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, round(value, key.includes('value') ? 0 : 2)])),
    trends: {
      inventory_movement_by_day: movementTrend,
      dispense_by_day: dispensing.breakdowns.by_day,
      inventory_value_by_day: movementTrend.map((row) => ({
        date: row.date,
        movement_value: row.movement_value,
        net_quantity: round(row.in_quantity - row.out_quantity, 2),
      })),
    },
    breakdowns: {
      transactions_by_type: transactionBreakdowns.by_type,
      transactions_by_direction: transactionBreakdowns.by_direction,
      batch_value_by_status: valuation.by_batch_status,
      dispense_by_status: dispensing.breakdowns.by_status,
    },
    top_lists: {
      top_dispensed_medications: highUsage.items,
      top_low_stock: lowStock.items,
      top_near_expiry_by_value: [...(expiringStock.items || [])].sort((a, b) => b.risk_value - a.risk_value).slice(0, 10),
      top_inventory_value: valuation.by_medication || [],
      top_adjustment_out: waste.breakdowns.by_medication || [],
    },
    urgent_worklist: urgentWorklist,
    filters: serializeFilters(filters),
  };
}

const REPORT_HANDLERS = {
  [PHARMACY_REPORT_TYPE.DASHBOARD]: getPharmacyDashboardReport,
  [PHARMACY_REPORT_TYPE.INVENTORY_OVERVIEW]: getInventoryOverviewReport,
  'inventory-overview': getInventoryOverviewReport,
  [PHARMACY_REPORT_TYPE.INVENTORY_MOVEMENT]: getInventoryMovementReport,
  stock_movement: getInventoryMovementReport,
  'stock-movement': getInventoryMovementReport,
  [PHARMACY_REPORT_TYPE.DISPENSING]: getDispensingReport,
  dispensed_medications: getDispensingReport,
  [PHARMACY_REPORT_TYPE.EXPIRING_STOCK]: getExpiringStockReport,
  expiring_medications: getExpiringStockReport,
  [PHARMACY_REPORT_TYPE.EXPIRED_RECALLED_BATCHES]: getExpiredRecalledBatchesReport,
  'expired-recalled-batches': getExpiredRecalledBatchesReport,
  [PHARMACY_REPORT_TYPE.LOW_STOCK]: getLowStockReport,
  below_minimum_stock: getLowStockReport,
  [PHARMACY_REPORT_TYPE.STOCKOUT_RISK]: getStockoutRiskReport,
  'stockout-risk': getStockoutRiskReport,
  [PHARMACY_REPORT_TYPE.PRESCRIPTIONS]: getPrescriptionPharmacyReport,
  prescription_analytics: getPrescriptionPharmacyReport,
  [PHARMACY_REPORT_TYPE.INVENTORY_VALUATION]: getInventoryValuationReport,
  stock_value: getInventoryValuationReport,
  [PHARMACY_REPORT_TYPE.HIGH_USAGE]: getHighUsageMedicationReport,
  high_usage: getHighUsageMedicationReport,
  [PHARMACY_REPORT_TYPE.TURNOVER]: getInventoryTurnoverReport,
  inventory_turnover: getInventoryTurnoverReport,
  [PHARMACY_REPORT_TYPE.WASTE_DISPOSAL]: getWasteDisposalReport,
  loss_waste: getWasteDisposalReport,
};

function reportToCsv(report = {}) {
  const rows = [['section', 'key', 'value']];
  Object.entries(report.summary || {}).forEach(([key, value]) => rows.push(['summary', key, value]));
  const items = report.items || report.by_medication || report.urgent_worklist || [];
  rows.push(['items', 'count', items.length]);
  items.forEach((item, index) => {
    rows.push(['item', index + 1, JSON.stringify(item)]);
  });
  return rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

async function exportPharmacyReport(query = {}, actor = {}, requestMeta = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.EXPORT);
  const reportType = normalizeString(query.report_type || query.type || PHARMACY_REPORT_TYPE.DASHBOARD).toLowerCase();
  const handler = REPORT_HANDLERS[reportType];
  if (!handler) throw createError('Loại báo cáo dược không được hỗ trợ.', 400);
  const report = await handler(query, actor);
  const format = normalizeString(query.format || 'json').toLowerCase();

  await recordAuditLog({
    actor,
    action: 'pharmacy_reports.export',
    targetType: 'pharmacy_report',
    status: 'success',
    message: 'Export báo cáo dược.',
    requestMeta,
    metadata: {
      report_type: reportType,
      format,
      filters: query,
    },
  });

  if (format === 'csv') {
    return {
      report_type: reportType,
      format: 'csv',
      content_type: 'text/csv',
      filename: `pharmacy_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`,
      content: reportToCsv(report),
    };
  }

  return {
    report_type: reportType,
    format: 'json',
    content_type: 'application/json',
    filename: `pharmacy_${reportType}_${new Date().toISOString().slice(0, 10)}.json`,
    data: report,
  };
}

async function getExportHistory(query = {}, actor = {}) {
  assertPharmacyReportPermission(actor, PERMISSION.PHARMACY_REPORTS?.EXPORT);
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = { action: 'pharmacy_reports.export' };
  if (query.report_type) filter['metadata.report_type'] = normalizeString(query.report_type).toLowerCase();
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  const actorIds = items
    .map((item) => item.actor_id)
    .filter((id) => Types.ObjectId.isValid(String(id)));
  const users = actorIds.length
    ? await User.find({ _id: { $in: actorIds } }).select('full_name username employee_code').lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  return {
    items: items.map((item) => ({
      export_id: String(item._id),
      report_type: item.metadata?.report_type || null,
      format: item.metadata?.format || null,
      status: item.status,
      exported_by: userMap.get(String(item.actor_id))?.full_name || userMap.get(String(item.actor_id))?.username || String(item.actor_id || ''),
      exported_at: item.created_at,
      filters: item.metadata?.filters || {},
      content_type: item.metadata?.format === 'csv' ? 'text/csv' : 'application/json',
      expires_at: addDays(item.created_at, 7),
    })),
    pagination: buildPagination(page, limit, total),
  };
}

module.exports = {
  getPharmacyDashboardReport,
  getInventoryOverviewReport,
  getInventoryMovementReport,
  getDispensingReport,
  getExpiringStockReport,
  getExpiredRecalledBatchesReport,
  getLowStockReport,
  getStockoutRiskReport,
  getPrescriptionPharmacyReport,
  getInventoryValuationReport,
  getHighUsageMedicationReport,
  getInventoryTurnoverReport,
  getWasteDisposalReport,
  exportPharmacyReport,
  getExportHistory,
};
