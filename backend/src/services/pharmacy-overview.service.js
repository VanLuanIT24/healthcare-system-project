const { Types } = require('mongoose');
const {
  Allergy,
  Charge,
  Dispense,
  DispenseItem,
  InventoryTransaction,
  MedicationMaster,
  PharmacyAlert,
  PharmacyWorkItem,
  Prescription,
  PrescriptionRefillRequest,
  PrescriptionItem,
  StockBatch,
  StocktakeItem,
  StocktakeSession,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  ALLERGY_SEVERITY,
  ALLERGY_STATUS,
  ALLERGY_TYPE,
  CHARGE_STATUS,
  DISPENSE_STATUS,
  INVENTORY_TRANSACTION_DIRECTION,
  INVENTORY_TRANSACTION_TYPE,
  MEDICATION_STATUS,
  PRESCRIPTION_STATUS,
  PRESCRIPTION_REFILL_REQUEST_STATUS,
  STOCK_BATCH_STATUS,
  STOCKTAKE_ITEM_STATUS,
  STOCKTAKE_STATUS,
} = require('../constants/statuses');
const permissionService = require('./permission.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode, generateSequenceCode } = require('./code-generator.service');
const { withOptionalTransaction } = require('../shared/utils/transaction');

const DEFAULT_LIMIT = 50;
const OPEN_ALERT_STATUSES = ['open', 'acknowledged', 'assigned', 'in_progress'];
const OPEN_WORK_ITEM_STATUSES = ['open', 'assigned', 'in_progress', 'on_hold'];
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions);
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function actorId(actor = {}) {
  return actor.userId || actor.actorId || actor.actor_id || actor.id || null;
}

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function assertStaff(actor = {}) {
  if (actorType(actor) !== 'staff') {
    throw createError('Chỉ tài khoản nhân sự được truy cập Pharmacy Overview.', 403);
  }
}

function assertPharmacyRead(actor = {}) {
  assertStaff(actor);
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS])) return;
  if (!hasAnyPermission(actor, [
    PERMISSION.MEDICATIONS.READ,
    PERMISSION.PRESCRIPTIONS.READ,
    PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT,
    PERMISSION.DISPENSES.READ,
    PERMISSION.STOCK_BATCHES.READ,
    PERMISSION.INVENTORY_TRANSACTIONS.READ,
    PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED,
    PERMISSION.REPORTS.INVENTORY_READ,
    PERMISSION.REPORTS.LOW_STOCK_READ,
    PERMISSION.REPORTS.EXPIRING_STOCK_READ,
  ])) {
    throw createError('Tài khoản hiện tại không có quyền xem tổng quan nhà thuốc.', 403);
  }
}

function assertAlertManage(actor = {}) {
  assertStaff(actor);
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS])) return;
  if (!hasAnyPermission(actor, [
    PERMISSION.MEDICATIONS.READ,
    PERMISSION.STOCK_BATCHES.READ,
    PERMISSION.PRESCRIPTIONS.VERIFY,
    PERMISSION.INVENTORY_TRANSACTIONS.READ,
  ])) {
    throw createError('Tài khoản hiện tại không có quyền xử lý cảnh báo dược.', 403);
  }
}

function assertWorkItemManage(actor = {}) {
  assertStaff(actor);
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS])) return;
  if (!hasAnyPermission(actor, [
    PERMISSION.PRESCRIPTIONS.VERIFY,
    PERMISSION.DISPENSES.CREATE,
    PERMISSION.DISPENSES.COMPLETE,
    PERMISSION.STOCK_BATCHES.READ,
    PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED,
  ])) {
    throw createError('Tài khoản hiện tại không có quyền xử lý việc nhà thuốc.', 403);
  }
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(value);
}

function parseDate(value, fieldName = 'date') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`);
  return date;
}

function buildDateRange(query = {}, { defaultToday = true } = {}) {
  const start = parseDate(query.date_from || query.created_from || query.dispensed_from, 'date_from');
  const end = parseDate(query.date_to || query.created_to || query.dispensed_to, 'date_to');
  if (start || end) return { start, end, date: null };

  if (query.date) {
    const date = parseDate(query.date, 'date');
    return { start: getStartOfDay(date), end: getEndOfDay(date), date: query.date };
  }

  if (!defaultToday) return { start: null, end: null, date: null };

  const today = new Date();
  return { start: getStartOfDay(today), end: getEndOfDay(today), date: today.toISOString().slice(0, 10) };
}

function applyDateRange(match, field, range) {
  if (!range?.start && !range?.end) return;
  match[field] = {};
  if (range.start) match[field].$gte = range.start;
  if (range.end) match[field].$lte = range.end;
}

function rangeOr(fields = [], range) {
  if (!range?.start && !range?.end) return {};
  return {
    $or: fields.map((field) => {
      const value = {};
      if (range.start) value.$gte = range.start;
      if (range.end) value.$lte = range.end;
      return { [field]: value };
    }),
  };
}

function normalizeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(normalizeNumber(value) * factor) / factor;
}

function isObjectIdLike(value) {
  return value instanceof Types.ObjectId
    || Boolean(value && typeof value === 'object' && typeof value.toHexString === 'function');
}

function toPlainId(value) {
  if (!value) return null;
  if (isObjectIdLike(value)) return String(value);
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (value._id) return toPlainId(value._id);
  if (value.id) return toPlainId(value.id);
  return null;
}

function preserveMissingRef(doc, id) {
  return doc || id || null;
}

function hasPopulatedMedication(value) {
  return Boolean(value && typeof value === 'object' && !isObjectIdLike(value) && toPlainId(value));
}

function medicationName(medication = {}) {
  if (!medication || isObjectIdLike(medication) || typeof medication === 'string') return 'Thuốc không còn trong danh mục';
  return [medication.brand_name || medication.generic_name, medication.strength].filter(Boolean).join(' ')
    || medication.medication_code
    || 'Thuốc không còn trong danh mục';
}

function personName(person = {}, fallback = 'Chưa rõ') {
  if (!person) return fallback;
  return person.full_name || person.name || person.username || person.patient_code || fallback;
}

function minutesBetween(start, end = new Date()) {
  if (!start) return 0;
  const started = new Date(start);
  if (Number.isNaN(started.getTime())) return 0;
  return Math.max(Math.floor((new Date(end).getTime() - started.getTime()) / 60000), 0);
}

function addMinutes(date, minutes) {
  return new Date(new Date(date || Date.now()).getTime() + Number(minutes || 0) * 60000);
}

function ageFromDate(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDelta = now.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function booleanQuery(value) {
  return value === true || String(value || '').toLowerCase() === 'true' || String(value || '') === '1';
}

async function countNeedsClinicalReview() {
  const [row] = await PrescriptionItem.aggregate([
    {
      $lookup: {
        from: 'prescriptions',
        localField: 'prescription_id',
        foreignField: '_id',
        as: 'prescription',
      },
    },
    { $unwind: '$prescription' },
    { $match: { 'prescription.status': PRESCRIPTION_STATUS.ACTIVE, status: 'active' } },
    { $group: { _id: '$prescription_id', item_count: { $sum: 1 } } },
    { $match: { item_count: { $gt: 1 } } },
    { $count: 'count' },
  ]);
  return row?.count || 0;
}

async function getPrescriptionSummary(range) {
  const [
    drafts,
    active,
    needsReview,
    verified,
    partiallyDispensed,
    fullyDispensedToday,
    cancelledToday,
  ] = await Promise.all([
    Prescription.countDocuments({ status: PRESCRIPTION_STATUS.DRAFT }),
    Prescription.countDocuments({ status: PRESCRIPTION_STATUS.ACTIVE }),
    countNeedsClinicalReview(),
    Prescription.countDocuments({ status: PRESCRIPTION_STATUS.VERIFIED }),
    Prescription.countDocuments({ status: PRESCRIPTION_STATUS.PARTIALLY_DISPENSED }),
    Prescription.countDocuments({
      status: { $in: [PRESCRIPTION_STATUS.FULLY_DISPENSED, PRESCRIPTION_STATUS.COMPLETED] },
      ...rangeOr(['completed_at', 'updated_at'], range),
    }),
    Prescription.countDocuments({
      status: PRESCRIPTION_STATUS.CANCELLED,
      ...rangeOr(['cancelled_at', 'updated_at'], range),
    }),
  ]);

  return {
    pending_verification: drafts + active,
    needs_review: needsReview,
    verified_waiting_dispense: verified,
    partially_dispensed: partiallyDispensed,
    fully_dispensed_today: fullyDispensedToday,
    cancelled_today: cancelledToday,
  };
}

async function getDispenseSummary(range) {
  const todayFilter = {};
  applyDateRange(todayFilter, 'created_at', range);
  const completedFilter = {};
  applyDateRange(completedFilter, 'completed_at', range);
  const cancelledFilter = {};
  applyDateRange(cancelledFilter, 'cancelled_at', range);

  const [
    totalToday,
    preparing,
    partiallyDispensed,
    dispensedToday,
    returnedToday,
    cancelledToday,
    averageRows,
  ] = await Promise.all([
    Dispense.countDocuments(todayFilter),
    Dispense.countDocuments({ status: DISPENSE_STATUS.DRAFT, ...todayFilter }),
    Dispense.countDocuments({ status: DISPENSE_STATUS.PARTIALLY_DISPENSED, ...todayFilter }),
    Dispense.countDocuments({ status: DISPENSE_STATUS.DISPENSED, ...completedFilter }),
    Dispense.countDocuments({ status: DISPENSE_STATUS.RETURNED, ...rangeOr(['cancelled_at', 'updated_at'], range) }),
    Dispense.countDocuments({ status: DISPENSE_STATUS.CANCELLED, ...cancelledFilter }),
    Dispense.aggregate([
      {
        $match: {
          status: DISPENSE_STATUS.DISPENSED,
          created_at: { $exists: true },
          completed_at: { $exists: true },
          ...completedFilter,
        },
      },
      {
        $project: {
          minutes: { $divide: [{ $subtract: ['$completed_at', '$created_at'] }, 60000] },
        },
      },
      { $group: { _id: null, average_minutes: { $avg: '$minutes' } } },
    ]),
  ]);

  return {
    dispense_today: totalToday,
    preparing,
    waiting_completion: preparing + partiallyDispensed,
    partially_dispensed: partiallyDispensed,
    dispensed_today: dispensedToday,
    returned_today: returnedToday,
    cancelled_today: cancelledToday,
    average_minutes: round(averageRows[0]?.average_minutes || 0, 1),
  };
}

async function getInventorySummary(range, query = {}) {
  const now = new Date();
  const nearExpiryDays = Number(query.near_expiry_days || 30);
  const nearExpiryTo = new Date(now.getTime() + nearExpiryDays * 86400000);
  const baseBatchMatch = { is_deleted: false };
  if (query.storage_location) baseBatchMatch.storage_location = query.storage_location;
  if (query.supplier_name) baseBatchMatch.supplier_name = query.supplier_name;

  const [activeMedications, batchTotals, lowStock, nearExpiry, expired, recalled, quarantined, depleted, medicationStocks] = await Promise.all([
    MedicationMaster.countDocuments({ is_deleted: false, status: MEDICATION_STATUS.ACTIVE }),
    StockBatch.aggregate([
      { $match: baseBatchMatch },
      {
        $group: {
          _id: null,
          total_batches: { $sum: 1 },
          total_stock_on_hand: { $sum: '$quantity_on_hand' },
          inventory_value: { $sum: { $multiply: ['$quantity_on_hand', { $ifNull: ['$unit_cost', 0] }] } },
          available_batches: {
            $sum: { $cond: [{ $and: [{ $eq: ['$status', STOCK_BATCH_STATUS.AVAILABLE] }, { $gt: ['$quantity_on_hand', 0] }] }, 1, 0] },
          },
        },
      },
    ]),
    StockBatch.countDocuments({
      ...baseBatchMatch,
      quantity_on_hand: { $gt: 0 },
      $expr: { $lte: ['$quantity_on_hand', '$min_stock_level'] },
    }),
    StockBatch.countDocuments({
      ...baseBatchMatch,
      status: { $nin: [STOCK_BATCH_STATUS.EXPIRED, STOCK_BATCH_STATUS.RECALLED, STOCK_BATCH_STATUS.DEPLETED] },
      quantity_on_hand: { $gt: 0 },
      expiry_date: { $gte: now, $lte: nearExpiryTo },
    }),
    StockBatch.countDocuments({
      ...baseBatchMatch,
      $or: [{ status: STOCK_BATCH_STATUS.EXPIRED }, { expiry_date: { $lt: now } }],
    }),
    StockBatch.countDocuments({ ...baseBatchMatch, status: STOCK_BATCH_STATUS.RECALLED }),
    StockBatch.countDocuments({ ...baseBatchMatch, status: STOCK_BATCH_STATUS.QUARANTINED }),
    StockBatch.countDocuments({ ...baseBatchMatch, status: STOCK_BATCH_STATUS.DEPLETED }),
    StockBatch.aggregate([
      { $match: baseBatchMatch },
      {
        $group: {
          _id: '$medication_id',
          total_on_hand: { $sum: '$quantity_on_hand' },
          available_batches: {
            $sum: { $cond: [{ $and: [{ $eq: ['$status', STOCK_BATCH_STATUS.AVAILABLE] }, { $gt: ['$quantity_on_hand', 0] }] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const stockByMedication = new Map(medicationStocks.map((row) => [String(row._id), row]));
  const activeMedicationRows = await MedicationMaster.find({ is_deleted: false, status: MEDICATION_STATUS.ACTIVE })
    .select('_id min_stock_level')
    .lean();
  const outOfStockItems = activeMedicationRows.filter((medication) => normalizeNumber(stockByMedication.get(String(medication._id))?.total_on_hand) <= 0).length;
  const belowMedicationMinimum = activeMedicationRows.filter((medication) => {
    const onHand = normalizeNumber(stockByMedication.get(String(medication._id))?.total_on_hand);
    return onHand > 0 && onHand <= normalizeNumber(medication.min_stock_level);
  }).length;

  const transactionMatch = {};
  applyDateRange(transactionMatch, 'occurred_at', range);
  const [inTx, outTx] = await Promise.all([
    InventoryTransaction.aggregate([
      { $match: { ...transactionMatch, direction: INVENTORY_TRANSACTION_DIRECTION.IN } },
      { $group: { _id: null, quantity: { $sum: '$quantity' }, count: { $sum: 1 } } },
    ]),
    InventoryTransaction.aggregate([
      { $match: { ...transactionMatch, direction: INVENTORY_TRANSACTION_DIRECTION.OUT } },
      { $group: { _id: null, quantity: { $sum: '$quantity' }, count: { $sum: 1 } } },
    ]),
  ]);

  const totals = batchTotals[0] || {};
  return {
    total_active_medications: activeMedications,
    total_batches: totals.total_batches || 0,
    available_batches: totals.available_batches || 0,
    total_stock_on_hand: round(totals.total_stock_on_hand || 0, 2),
    low_stock_items: Math.max(lowStock, belowMedicationMinimum),
    out_of_stock_items: outOfStockItems,
    depleted_batches: depleted,
    near_expiry_batches: nearExpiry,
    expired_batches: expired,
    recalled_batches: recalled,
    quarantined_batches: quarantined,
    inventory_in_quantity: round(inTx[0]?.quantity || 0, 2),
    inventory_out_quantity: round(outTx[0]?.quantity || 0, 2),
    inventory_value: round(totals.inventory_value || 0, 0),
  };
}

async function getInsufficientStockCount() {
  const items = await PrescriptionItem.find({ status: 'active' })
    .populate({
      path: 'prescription_id',
      select: 'status',
      match: { status: { $in: [PRESCRIPTION_STATUS.VERIFIED, PRESCRIPTION_STATUS.PARTIALLY_DISPENSED] } },
    })
    .select('medication_id quantity dispensed_quantity')
    .lean();
  const activeItems = items.filter((item) => item.prescription_id);
  const medicationIds = [...new Set(activeItems.map((item) => toPlainId(item.medication_id)).filter(Boolean))]
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => toObjectId(id, 'medication_id'));
  if (!medicationIds.length) return 0;
  const stocks = await StockBatch.aggregate([
    {
      $match: {
        medication_id: { $in: medicationIds },
        status: STOCK_BATCH_STATUS.AVAILABLE,
        quantity_on_hand: { $gt: 0 },
        is_deleted: false,
        $or: [{ expiry_date: null }, { expiry_date: { $exists: false } }, { expiry_date: { $gt: new Date() } }],
      },
    },
    { $group: { _id: '$medication_id', available_quantity: { $sum: '$quantity_on_hand' } } },
  ]);
  const stockMap = new Map(stocks.map((row) => [String(row._id), normalizeNumber(row.available_quantity)]));
  return activeItems.filter((item) => {
    const medicationId = toPlainId(item.medication_id);
    const remaining = normalizeNumber(item.quantity) - normalizeNumber(item.dispensed_quantity);
    return medicationId && remaining > 0 && normalizeNumber(stockMap.get(medicationId)) < remaining;
  }).length;
}

async function getRiskSummary(range, inventorySummary = {}) {
  const [insufficientForDispensing, wasteToday] = await Promise.all([
    getInsufficientStockCount(),
    InventoryTransaction.aggregate([
      {
        $match: {
          transaction_type: { $in: [INVENTORY_TRANSACTION_TYPE.WASTE, INVENTORY_TRANSACTION_TYPE.EXPIRE, INVENTORY_TRANSACTION_TYPE.RECALL] },
          ...(() => {
            const match = {};
            applyDateRange(match, 'occurred_at', range);
            return match;
          })(),
        },
      },
      { $group: { _id: null, count: { $sum: 1 }, quantity: { $sum: '$quantity' } } },
    ]),
  ]);
  const pendingLong = await Prescription.countDocuments({
    status: { $in: [PRESCRIPTION_STATUS.DRAFT, PRESCRIPTION_STATUS.ACTIVE] },
    prescribed_at: { $lte: new Date(Date.now() - 60 * 60000) },
  });
  const dispenseLong = await Dispense.countDocuments({
    status: { $in: [DISPENSE_STATUS.DRAFT, DISPENSE_STATUS.PARTIALLY_DISPENSED] },
    created_at: { $lte: new Date(Date.now() - 45 * 60000) },
  });

  return {
    insufficient_for_dispensing: insufficientForDispensing,
    allergy_review: 0,
    interaction_review: await countNeedsClinicalReview(),
    abnormal_high_usage: 0,
    waste_today: wasteToday[0]?.count || 0,
    waste_quantity_today: round(wasteToday[0]?.quantity || 0, 2),
    prescription_sla_breached: pendingLong,
    dispense_sla_breached: dispenseLong,
    out_of_stock_items: inventorySummary.out_of_stock_items || 0,
  };
}

async function getPrescriptionFunnel() {
  const rows = await Prescription.aggregate([
    {
      $match: {
        status: {
          $in: [
            PRESCRIPTION_STATUS.ACTIVE,
            PRESCRIPTION_STATUS.VERIFIED,
            PRESCRIPTION_STATUS.PARTIALLY_DISPENSED,
            PRESCRIPTION_STATUS.FULLY_DISPENSED,
            PRESCRIPTION_STATUS.COMPLETED,
            PRESCRIPTION_STATUS.CANCELLED,
          ],
        },
      },
    },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const map = new Map(rows.map((row) => [row._id, row.count]));
  return [
    { status: PRESCRIPTION_STATUS.ACTIVE, count: map.get(PRESCRIPTION_STATUS.ACTIVE) || 0 },
    { status: PRESCRIPTION_STATUS.VERIFIED, count: map.get(PRESCRIPTION_STATUS.VERIFIED) || 0 },
    { status: PRESCRIPTION_STATUS.PARTIALLY_DISPENSED, count: map.get(PRESCRIPTION_STATUS.PARTIALLY_DISPENSED) || 0 },
    { status: PRESCRIPTION_STATUS.FULLY_DISPENSED, count: map.get(PRESCRIPTION_STATUS.FULLY_DISPENSED) || 0 },
    { status: PRESCRIPTION_STATUS.COMPLETED, count: map.get(PRESCRIPTION_STATUS.COMPLETED) || 0 },
    { status: PRESCRIPTION_STATUS.CANCELLED, count: map.get(PRESCRIPTION_STATUS.CANCELLED) || 0 },
  ];
}

async function getDispenseByHour(range) {
  const match = { status: DISPENSE_STATUS.DISPENSED };
  applyDateRange(match, 'dispensed_at', range);
  const rows = await Dispense.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%H:00', date: '$dispensed_at', timezone: VIETNAM_TIMEZONE } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({ hour: row._id, count: row.count }));
}

async function getTransactionsByType(range) {
  const match = {};
  applyDateRange(match, 'occurred_at', range);
  const rows = await InventoryTransaction.aggregate([
    { $match: match },
    { $group: { _id: '$transaction_type', count: { $sum: 1 }, quantity: { $sum: '$quantity' } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({
    transaction_type: row._id || 'unknown',
    count: row.count,
    quantity: round(row.quantity || 0, 2),
  }));
}

async function getTopDispensedMedications(range, limit = 10) {
  const dispenseMatch = { status: DISPENSE_STATUS.DISPENSED };
  applyDateRange(dispenseMatch, 'dispensed_at', range);
  const rows = await DispenseItem.aggregate([
    {
      $lookup: {
        from: 'dispenses',
        localField: 'dispense_id',
        foreignField: '_id',
        as: 'dispense',
      },
    },
    { $unwind: '$dispense' },
    { $match: { 'dispense.status': dispenseMatch.status, ...(dispenseMatch.dispensed_at ? { 'dispense.dispensed_at': dispenseMatch.dispensed_at } : {}) } },
    { $group: { _id: '$medication_id', quantity: { $sum: '$quantity' }, dispense_count: { $addToSet: '$dispense_id' } } },
    { $sort: { quantity: -1 } },
    { $limit: Number(limit) || 10 },
    {
      $lookup: {
        from: 'medication_master',
        localField: '_id',
        foreignField: '_id',
        as: 'medication',
      },
    },
    { $unwind: { path: '$medication', preserveNullAndEmptyArrays: true } },
  ]);
  return rows.map((row) => ({
    medication_id: String(row._id),
    medication_name: medicationName(row.medication),
    medication_code: row.medication?.medication_code,
    quantity: round(row.quantity || 0, 2),
    dispense_count: row.dispense_count?.length || 0,
  }));
}

async function getExpiryBuckets() {
  const now = new Date();
  const batches = await StockBatch.find({
    status: { $nin: [STOCK_BATCH_STATUS.RECALLED, STOCK_BATCH_STATUS.DEPLETED] },
    quantity_on_hand: { $gt: 0 },
    expiry_date: { $exists: true, $ne: null },
    is_deleted: false,
  }).select('expiry_date quantity_on_hand').lean();
  const buckets = [
    { label: '0-7 ngày', min: 0, max: 7, count: 0, quantity: 0 },
    { label: '8-14 ngày', min: 8, max: 14, count: 0, quantity: 0 },
    { label: '15-30 ngày', min: 15, max: 30, count: 0, quantity: 0 },
    { label: '31-60 ngày', min: 31, max: 60, count: 0, quantity: 0 },
  ];
  for (const batch of batches) {
    const days = Math.ceil((new Date(batch.expiry_date).getTime() - now.getTime()) / 86400000);
    const bucket = buckets.find((item) => days >= item.min && days <= item.max);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.quantity += normalizeNumber(batch.quantity_on_hand);
  }
  return buckets.map(({ min, max, ...bucket }) => ({ ...bucket, quantity: round(bucket.quantity, 2) }));
}

async function getCharts(range) {
  const [prescriptionFunnel, dispenseByHour, transactionsByType, topDispensedMedications, expiryBuckets] = await Promise.all([
    getPrescriptionFunnel(),
    getDispenseByHour(range),
    getTransactionsByType(range),
    getTopDispensedMedications(range),
    getExpiryBuckets(),
  ]);
  return {
    prescription_funnel: prescriptionFunnel,
    dispense_by_hour: dispenseByHour,
    transactions_by_type: transactionsByType,
    top_dispensed_medications: topDispensedMedications,
    expiry_buckets: expiryBuckets,
  };
}

function mapPrescriptionToWorkItem(prescription, type, priority = 'medium') {
  const waitMinutes = minutesBetween(prescription.prescribed_at || prescription.created_at);
  const slaMinutes = type === 'clinical_review' ? 20 : 30;
  return {
    id: `derived:${type}:${prescription._id}`,
    derived: true,
    type,
    priority: waitMinutes > 90 ? 'critical' : waitMinutes > 45 ? 'high' : priority,
    status: 'open',
    sla_minutes: slaMinutes,
    due_at: addMinutes(prescription.prescribed_at || prescription.created_at, slaMinutes),
    source_type: 'prescription',
    source_id: String(prescription._id),
    prescription_id: String(prescription._id),
    patient_id: toPlainId(prescription.patient_id),
    reference_no: prescription.prescription_no,
    patient_name: personName(prescription.patient_id, 'Bệnh nhân'),
    source_label: prescription.encounter_id?.encounter_code || 'Đơn thuốc',
    status_label: prescription.status,
    item_count: prescription.items_count,
    risk_flags: {
      allergy: false,
      interaction: type === 'clinical_review',
      duplicate: false,
      insufficient_stock: false,
    },
    title: type === 'clinical_review' ? 'Đơn cần rà soát tương tác' : 'Đơn chờ duyệt dược',
    description: `${prescription.prescription_no || 'Đơn thuốc'} - ${personName(prescription.patient_id, 'Bệnh nhân')}`,
    waiting_minutes: waitMinutes,
    updated_at: prescription.updated_at || prescription.created_at,
  };
}

function mapDispenseToWorkItem(dispense, type = 'dispense_preparing') {
  const waitMinutes = minutesBetween(dispense.created_at);
  return {
    id: `derived:${type}:${dispense._id}`,
    derived: true,
    type,
    priority: waitMinutes > 90 ? 'high' : 'medium',
    status: 'open',
    sla_minutes: 30,
    due_at: addMinutes(dispense.created_at, 30),
    source_type: 'dispense',
    source_id: String(dispense._id),
    prescription_id: toPlainId(dispense.prescription_id),
    dispense_id: String(dispense._id),
    patient_id: toPlainId(dispense.patient_id),
    reference_no: dispense.dispense_no,
    patient_name: personName(dispense.patient_id, 'Bệnh nhân'),
    source_label: dispense.prescription_id?.prescription_no || 'Phiếu cấp phát',
    status_label: dispense.status,
    item_count: dispense.items_count,
    risk_flags: {},
    title: type === 'return_dispense' ? 'Phiếu hoàn trả cần xử lý' : 'Phiếu cấp phát đang chuẩn bị',
    description: `${dispense.dispense_no || 'Phiếu'} - ${personName(dispense.patient_id, 'Bệnh nhân')}`,
    waiting_minutes: waitMinutes,
    updated_at: dispense.updated_at || dispense.created_at,
  };
}

function mapBatchToWorkItem(batch, type, priority) {
  const days = batch.expiry_date ? Math.ceil((new Date(batch.expiry_date).getTime() - Date.now()) / 86400000) : null;
  const med = batch.medication_id || {};
  return {
    id: `derived:${type}:${batch._id}`,
    derived: true,
    type,
    priority,
    status: 'open',
    sla_minutes: type === 'expired_batch' ? 0 : 1440,
    due_at: type === 'expired_batch' ? new Date() : addMinutes(new Date(), 1440),
    source_type: 'stock_batch',
    source_id: String(batch._id),
    medication_id: toPlainId(med),
    stock_batch_id: String(batch._id),
    reference_no: batch.batch_no || batch.lot_no,
    patient_name: '',
    source_label: medicationName(med),
    status_label: batch.status,
    available_quantity: batch.quantity_on_hand,
    risk_flags: {
      insufficient_stock: type === 'stock_shortage',
      near_expiry: type === 'near_expiry_batch',
      expired: type === 'expired_batch',
      recalled: batch.status === STOCK_BATCH_STATUS.RECALLED,
    },
    title: type === 'stock_shortage' ? 'Thuốc dưới ngưỡng tồn' : type === 'expired_batch' ? 'Lô đã hết hạn' : 'Lô sắp hết hạn',
    description: `${medicationName(med)} - ${batch.batch_no || batch.lot_no || 'lô thuốc'}${days !== null ? ` (${days} ngày)` : ''}`,
    waiting_minutes: 0,
    updated_at: batch.updated_at || batch.created_at,
  };
}

async function listDerivedWorkItems(query = {}) {
  const nearExpiryDays = Number(query.near_expiry_days || 30);
  const now = new Date();
  const until = new Date(now.getTime() + nearExpiryDays * 86400000);
  const [prescriptions, clinicalPrescriptions, verifiedPrescriptions, dispenses, lowStockBatches, nearExpiryBatches, expiredBatches] = await Promise.all([
    Prescription.find({ status: { $in: [PRESCRIPTION_STATUS.DRAFT, PRESCRIPTION_STATUS.ACTIVE] } })
      .sort({ prescribed_at: 1 })
      .limit(DEFAULT_LIMIT)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('encounter_id', 'encounter_code department_id')
      .lean(),
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
      { $match: { 'prescription.status': PRESCRIPTION_STATUS.ACTIVE, status: 'active' } },
      { $group: { _id: '$prescription_id', item_count: { $sum: 1 } } },
      { $match: { item_count: { $gt: 1 } } },
      { $limit: 30 },
    ]),
    Prescription.find({ status: PRESCRIPTION_STATUS.VERIFIED })
      .sort({ verified_at: 1, updated_at: 1 })
      .limit(DEFAULT_LIMIT)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('encounter_id', 'encounter_code department_id')
      .lean(),
    Dispense.find({ status: { $in: [DISPENSE_STATUS.DRAFT, DISPENSE_STATUS.PARTIALLY_DISPENSED, DISPENSE_STATUS.RETURNED] } })
      .sort({ created_at: 1 })
      .limit(DEFAULT_LIMIT)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('prescription_id', 'prescription_no status')
      .lean(),
    StockBatch.find({
      quantity_on_hand: { $gt: 0 },
      $expr: { $lte: ['$quantity_on_hand', '$min_stock_level'] },
      is_deleted: false,
    })
      .sort({ quantity_on_hand: 1 })
      .limit(40)
      .populate('medication_id', 'medication_code generic_name brand_name strength')
      .lean(),
    StockBatch.find({
      status: STOCK_BATCH_STATUS.AVAILABLE,
      quantity_on_hand: { $gt: 0 },
      expiry_date: { $gte: now, $lte: until },
      is_deleted: false,
    })
      .sort({ expiry_date: 1 })
      .limit(40)
      .populate('medication_id', 'medication_code generic_name brand_name strength')
      .lean(),
    StockBatch.find({
      quantity_on_hand: { $gt: 0 },
      $or: [{ status: STOCK_BATCH_STATUS.EXPIRED }, { expiry_date: { $lt: now } }],
      is_deleted: false,
    })
      .sort({ expiry_date: 1 })
      .limit(40)
      .populate('medication_id', 'medication_code generic_name brand_name strength')
      .lean(),
  ]);

  const clinicalIds = new Set(clinicalPrescriptions.map((row) => String(row._id)));
  const clinicalDocs = prescriptions.filter((prescription) => clinicalIds.has(String(prescription._id)));
  return [
    ...prescriptions.map((prescription) => mapPrescriptionToWorkItem(prescription, 'prescription_verification', 'medium')),
    ...clinicalDocs.map((prescription) => mapPrescriptionToWorkItem(prescription, 'clinical_review', 'high')),
    ...verifiedPrescriptions.map((prescription) => mapPrescriptionToWorkItem(prescription, 'dispense_waiting', 'medium')),
    ...dispenses.map((dispense) => mapDispenseToWorkItem(dispense, dispense.status === DISPENSE_STATUS.RETURNED ? 'return_dispense' : 'dispense_preparing')),
    ...lowStockBatches.map((batch) => mapBatchToWorkItem(batch, 'stock_shortage', 'high')),
    ...nearExpiryBatches.map((batch) => mapBatchToWorkItem(batch, 'near_expiry_batch', 'medium')),
    ...expiredBatches.map((batch) => mapBatchToWorkItem(batch, 'expired_batch', 'critical')),
  ];
}

function applyWorkQueueFilters(items = [], query = {}) {
  const normalizedSearch = String(query.search || query.q || '').trim().toLowerCase();
  return items.filter((item) => {
    if (query.type && item.type !== query.type) return false;
    if (query.priority && item.priority !== query.priority) return false;
    if (query.status && item.status !== query.status) return false;
    if (query.assigned_to === 'me' && String(item.assigned_to || '') !== String(query.actor_user_id || '')) return false;
    if (!normalizedSearch) return true;
    return [
      item.reference_no,
      item.patient_name,
      item.source_label,
      item.title,
      item.description,
    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch);
  });
}

async function getWorkQueue(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const persistedFilter = { status: { $in: OPEN_WORK_ITEM_STATUSES } };
  if (query.type) persistedFilter.type = query.type;
  if (query.priority) persistedFilter.priority = query.priority;
  if (query.status) persistedFilter.status = query.status;
  if (query.assigned_to === 'me') persistedFilter.assigned_to = actorId(actor);
  const [persisted, derived] = await Promise.all([
    PharmacyWorkItem.find(persistedFilter)
      .sort({ priority: 1, due_at: 1, created_at: -1 })
      .limit(100)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('prescription_id', 'prescription_no status')
      .populate('dispense_id', 'dispense_no status')
      .populate('medication_id', 'medication_code generic_name brand_name strength')
      .populate('stock_batch_id', 'batch_no lot_no expiry_date quantity_on_hand status')
      .populate('assigned_to', 'full_name username employee_code')
      .lean(),
    listDerivedWorkItems(query),
  ]);
  const persistedRows = persisted.map((item) => ({
    ...item,
    id: String(item._id),
    patient_name: personName(item.patient_id, ''),
    reference_no: item.prescription_id?.prescription_no || item.dispense_id?.dispense_no || item.stock_batch_id?.batch_no || item.work_item_code,
    source_label: item.title,
    waiting_minutes: minutesBetween(item.created_at),
  }));
  const rows = applyWorkQueueFilters([...persistedRows, ...derived], { ...query, actor_user_id: actorId(actor) })
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
        || new Date(a.due_at || a.created_at || 0).getTime() - new Date(b.due_at || b.created_at || 0).getTime();
    });
  const items = rows.slice(skip, skip + limit);
  const summary = {
    total_open: rows.length,
    critical: rows.filter((item) => item.priority === 'critical').length,
    high: rows.filter((item) => item.priority === 'high').length,
    overdue: rows.filter((item) => item.due_at && new Date(item.due_at) < new Date()).length,
    assigned_to_me: rows.filter((item) => String(item.assigned_to?._id || item.assigned_to || '') === String(actorId(actor))).length,
    unassigned: rows.filter((item) => !item.assigned_to).length,
  };
  return { summary, items, pagination: buildPagination(page, limit, rows.length) };
}

function mapPersistedAlert(alert) {
  return {
    ...alert,
    id: String(alert._id),
    object_label: alert.medication_id ? medicationName(alert.medication_id) : alert.stock_batch_id?.batch_no || alert.prescription_id?.prescription_no || alert.dispense_id?.dispense_no,
  };
}

function mapBatchAlert(batch, alertType, severity, title) {
  const med = batch.medication_id || {};
  const days = batch.expiry_date ? Math.ceil((new Date(batch.expiry_date).getTime() - Date.now()) / 86400000) : null;
  return {
    id: `derived:${alertType}:${batch._id}`,
    derived: true,
    alert_type: alertType,
    severity,
    status: 'open',
    source_type: 'stock_batch',
    source_id: String(batch._id),
    medication_id: toPlainId(med),
    stock_batch_id: String(batch._id),
    title,
    message: `${medicationName(med)} - lô ${batch.batch_no || batch.lot_no || '--'}${days !== null ? `, còn ${days} ngày` : ''}, tồn ${batch.quantity_on_hand}.`,
    object_label: medicationName(med),
    dedupe_key: `${alertType}:${batch._id}`,
    metadata: {
      batch_no: batch.batch_no,
      lot_no: batch.lot_no,
      expiry_date: batch.expiry_date,
      quantity_on_hand: batch.quantity_on_hand,
      min_stock_level: batch.min_stock_level,
      storage_location: batch.storage_location,
    },
    created_at: batch.updated_at || batch.created_at,
    updated_at: batch.updated_at || batch.created_at,
  };
}

async function buildDerivedAlerts(query = {}) {
  const nearExpiryDays = Number(query.near_expiry_days || 30);
  const now = new Date();
  const until = new Date(now.getTime() + nearExpiryDays * 86400000);
  const [lowStock, outOfStock, nearExpiry, expired, recalled, quarantined] = await Promise.all([
    StockBatch.find({
      status: STOCK_BATCH_STATUS.AVAILABLE,
      quantity_on_hand: { $gt: 0 },
      $expr: { $lte: ['$quantity_on_hand', '$min_stock_level'] },
      is_deleted: false,
    }).sort({ quantity_on_hand: 1 }).limit(50).populate('medication_id', 'medication_code generic_name brand_name strength').lean(),
    StockBatch.find({ status: STOCK_BATCH_STATUS.DEPLETED, is_deleted: false }).sort({ updated_at: -1 }).limit(40).populate('medication_id', 'medication_code generic_name brand_name strength').lean(),
    StockBatch.find({
      status: STOCK_BATCH_STATUS.AVAILABLE,
      quantity_on_hand: { $gt: 0 },
      expiry_date: { $gte: now, $lte: until },
      is_deleted: false,
    }).sort({ expiry_date: 1 }).limit(50).populate('medication_id', 'medication_code generic_name brand_name strength').lean(),
    StockBatch.find({
      quantity_on_hand: { $gt: 0 },
      $or: [{ status: STOCK_BATCH_STATUS.EXPIRED }, { expiry_date: { $lt: now } }],
      is_deleted: false,
    }).sort({ expiry_date: 1 }).limit(50).populate('medication_id', 'medication_code generic_name brand_name strength').lean(),
    StockBatch.find({ status: STOCK_BATCH_STATUS.RECALLED, is_deleted: false }).sort({ updated_at: -1 }).limit(40).populate('medication_id', 'medication_code generic_name brand_name strength').lean(),
    StockBatch.find({ status: STOCK_BATCH_STATUS.QUARANTINED, is_deleted: false }).sort({ updated_at: -1 }).limit(40).populate('medication_id', 'medication_code generic_name brand_name strength').lean(),
  ]);

  return [
    ...lowStock.map((batch) => mapBatchAlert(batch, 'low_stock', 'high', 'Cảnh báo tồn kho thấp')),
    ...outOfStock.map((batch) => mapBatchAlert(batch, 'out_of_stock', 'critical', 'Lô thuốc hết tồn')),
    ...nearExpiry.map((batch) => mapBatchAlert(batch, 'near_expiry', 'high', 'Thuốc sắp hết hạn')),
    ...expired.map((batch) => mapBatchAlert(batch, 'expired', 'critical', 'Lô đã hết hạn còn tồn')),
    ...recalled.map((batch) => mapBatchAlert(batch, 'recalled', 'critical', 'Lô đã thu hồi')),
    ...quarantined.map((batch) => mapBatchAlert(batch, 'quarantined', 'high', 'Lô đang cách ly')),
  ];
}

function applyAlertFilters(items = [], query = {}) {
  const search = String(query.search || query.q || '').trim().toLowerCase();
  return items.filter((item) => {
    if (query.alert_type && item.alert_type !== query.alert_type) return false;
    if (query.severity && item.severity !== query.severity) return false;
    if (query.status && item.status !== query.status) return false;
    if (!search) return true;
    return [item.title, item.message, item.object_label, item.metadata?.batch_no, item.metadata?.lot_no]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search);
  });
}

async function getAlerts(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const persistedFilter = {};
  if (query.status) persistedFilter.status = query.status;
  else persistedFilter.status = { $in: OPEN_ALERT_STATUSES };
  if (query.alert_type) persistedFilter.alert_type = query.alert_type;
  if (query.severity) persistedFilter.severity = query.severity;
  if (query.assigned_to === 'me') persistedFilter.assigned_to = actorId(actor);
  const [persisted, derived] = await Promise.all([
    PharmacyAlert.find(persistedFilter)
      .sort({ severity: 1, created_at: -1 })
      .limit(100)
      .populate('medication_id', 'medication_code generic_name brand_name strength')
      .populate('stock_batch_id', 'batch_no lot_no expiry_date quantity_on_hand status')
      .populate('prescription_id', 'prescription_no status')
      .populate('dispense_id', 'dispense_no status')
      .populate('patient_id', 'patient_code full_name')
      .populate('assigned_to', 'full_name username employee_code')
      .lean(),
    buildDerivedAlerts(query),
  ]);
  const rows = applyAlertFilters([...persisted.map(mapPersistedAlert), ...derived], query)
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
        || new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  const items = rows.slice(skip, skip + limit);
  const summary = {
    total_open: rows.filter((item) => OPEN_ALERT_STATUSES.includes(item.status)).length,
    critical: rows.filter((item) => item.severity === 'critical').length,
    high: rows.filter((item) => item.severity === 'high').length,
    medium: rows.filter((item) => item.severity === 'medium').length,
    low: rows.filter((item) => item.severity === 'low').length,
    acknowledged: rows.filter((item) => item.status === 'acknowledged').length,
    unresolved: rows.filter((item) => !['resolved', 'dismissed'].includes(item.status)).length,
    resolved_today: rows.filter((item) => item.status === 'resolved' && item.resolved_at && new Date(item.resolved_at) >= getStartOfDay(new Date())).length,
  };
  return { summary, items, pagination: buildPagination(page, limit, rows.length) };
}

async function getDashboard(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const range = buildDateRange(query);
  const [prescriptionSummary, dispenseSummary, inventorySummary] = await Promise.all([
    getPrescriptionSummary(range),
    getDispenseSummary(range),
    getInventorySummary(range, query),
  ]);
  const [riskSummary, workQueue, alerts, charts] = await Promise.all([
    getRiskSummary(range, inventorySummary),
    getWorkQueue({ ...query, limit: 8 }, actor),
    getAlerts({ ...query, limit: 8 }, actor),
    getCharts(range),
  ]);

  return {
    date: {
      date: range.date,
      date_from: range.start,
      date_to: range.end,
    },
    cards: {
      ...prescriptionSummary,
      dispense_draft: dispenseSummary.preparing,
      dispense_today: dispenseSummary.dispense_today,
      dispensed_today: dispenseSummary.dispensed_today,
      returned_today: dispenseSummary.returned_today,
      average_dispense_minutes: dispenseSummary.average_minutes,
      low_stock_items: inventorySummary.low_stock_items,
      out_of_stock_items: inventorySummary.out_of_stock_items,
      near_expiry_batches: inventorySummary.near_expiry_batches,
      expired_batches: inventorySummary.expired_batches,
      recalled_batches: inventorySummary.recalled_batches,
      quarantined_batches: inventorySummary.quarantined_batches,
      inventory_value: inventorySummary.inventory_value,
      insufficient_for_dispensing: riskSummary.insufficient_for_dispensing,
      interaction_review: riskSummary.interaction_review,
      dispense_sla_breached: riskSummary.dispense_sla_breached,
      prescription_sla_breached: riskSummary.prescription_sla_breached,
    },
    prescription_summary: prescriptionSummary,
    dispense_summary: dispenseSummary,
    inventory_summary: inventorySummary,
    risk_summary: riskSummary,
    work_queue_preview: workQueue.items,
    alerts_preview: alerts.items,
    alert_summary: alerts.summary,
    charts,
    realtime: {
      rooms: ['role:pharmacist', 'role:inventory_staff', 'role:admin'],
      events: [
        'inventory.low_stock',
        'inventory.drug_expiring',
        'pharmacy.prescription.verified',
        'pharmacy.dispense.completed',
        'pharmacy.alert.created',
        'pharmacy.work_item.created',
      ],
    },
  };
}

const WORKBENCH_STATUS_GROUPS = {
  pending_verification: [PRESCRIPTION_STATUS.DRAFT, PRESCRIPTION_STATUS.ACTIVE],
  need_review: [PRESCRIPTION_STATUS.DRAFT, PRESCRIPTION_STATUS.ACTIVE, PRESCRIPTION_STATUS.VERIFIED],
  waiting_dispense: [PRESCRIPTION_STATUS.VERIFIED],
  partially_dispensed: [PRESCRIPTION_STATUS.PARTIALLY_DISPENSED],
  dispensed: [PRESCRIPTION_STATUS.FULLY_DISPENSED, PRESCRIPTION_STATUS.COMPLETED],
  cancelled: [PRESCRIPTION_STATUS.CANCELLED],
  history: [],
};

function prescriptionStatusGroup(status) {
  if ([PRESCRIPTION_STATUS.DRAFT, PRESCRIPTION_STATUS.ACTIVE].includes(status)) return 'pending_verification';
  if (status === PRESCRIPTION_STATUS.VERIFIED) return 'waiting_dispense';
  if (status === PRESCRIPTION_STATUS.PARTIALLY_DISPENSED) return 'partially_dispensed';
  if ([PRESCRIPTION_STATUS.FULLY_DISPENSED, PRESCRIPTION_STATUS.COMPLETED].includes(status)) return 'dispensed';
  if (status === PRESCRIPTION_STATUS.CANCELLED) return 'cancelled';
  return 'history';
}

function medicationDisplayName(value = {}) {
  if (!value || isObjectIdLike(value) || typeof value === 'string') return 'Thuốc không còn trong danh mục';
  return [value.brand_name || value.generic_name, value.strength].filter(Boolean).join(' ')
    || value.medication_code
    || 'Thuốc không còn trong danh mục';
}

function buildPrescriptionWorkbenchFilter(query = {}) {
  const statusGroup = query.status_group || 'history';
  const filter = {};
  const groupStatuses = WORKBENCH_STATUS_GROUPS[statusGroup];
  if (query.status) filter.status = query.status;
  else if (Array.isArray(groupStatuses) && groupStatuses.length) filter.status = { $in: groupStatuses };

  for (const [queryField, modelField] of [
    ['patient_id', 'patient_id'],
    ['doctor_id', 'prescribed_by'],
    ['prescribed_by', 'prescribed_by'],
    ['encounter_id', 'encounter_id'],
  ]) {
    if (query[queryField]) filter[modelField] = toObjectId(query[queryField], queryField);
  }
  applyDateRange(filter, 'prescribed_at', {
    start: parseDate(query.from || query.date_from || query.prescribed_from, 'from'),
    end: parseDate(query.to || query.date_to || query.prescribed_to, 'to'),
  });
  return filter;
}

function getItemMap(items = []) {
  const map = new Map();
  for (const item of items) {
    const key = String(item.prescription_id?._id || item.prescription_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function getDispenseMap(dispenses = []) {
  const map = new Map();
  for (const dispense of dispenses) {
    const key = String(dispense.prescription_id?._id || dispense.prescription_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(dispense);
  }
  return map;
}

function getChargeMap(charges = [], dispenseToPrescription = new Map()) {
  const map = new Map();
  for (const charge of charges) {
    const prescriptionId = dispenseToPrescription.get(String(charge.dispense_id || ''));
    if (!prescriptionId) continue;
    if (!map.has(prescriptionId)) map.set(prescriptionId, []);
    map.get(prescriptionId).push(charge);
  }
  return map;
}

async function getWorkbenchStockStats(medicationIds = []) {
  const ids = [...new Set(medicationIds.map((id) => String(id)).filter(Boolean))]
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  if (!ids.length) return new Map();

  const now = new Date();
  const nearExpiryTo = new Date(now.getTime() + 30 * 86400000);
  const batches = await StockBatch.find({
    medication_id: { $in: ids },
    quantity_on_hand: { $gt: 0 },
    is_deleted: false,
  })
    .select('medication_id batch_no lot_no expiry_date quantity_on_hand storage_location status unit_cost')
    .sort({ expiry_date: 1, received_date: 1, created_at: 1 })
    .lean();

  const stats = new Map();
  for (const batch of batches) {
    const key = String(batch.medication_id);
    const current = stats.get(key) || {
      available_quantity: 0,
      available_batches_count: 0,
      near_expiry_batch_count: 0,
      fefo_batch: null,
      batches: [],
    };
    const isAvailable = batch.status === STOCK_BATCH_STATUS.AVAILABLE
      && (!batch.expiry_date || new Date(batch.expiry_date) > now);
    if (isAvailable) {
      current.available_quantity += normalizeNumber(batch.quantity_on_hand);
      current.available_batches_count += 1;
      if (batch.expiry_date && new Date(batch.expiry_date) <= nearExpiryTo) current.near_expiry_batch_count += 1;
      if (!current.fefo_batch) current.fefo_batch = batch;
    }
    current.batches.push(batch);
    stats.set(key, current);
  }
  return stats;
}

function getAllergyConflicts(patientAllergies = [], items = []) {
  const conflicts = [];
  for (const allergy of patientAllergies) {
    const allergen = String(allergy.allergen || '').trim().toLowerCase();
    if (!allergen) continue;
    for (const item of items) {
      const medication = item.medication_id || {};
      if (!hasPopulatedMedication(medication)) continue;
      const names = [medication.generic_name, medication.brand_name, medication.medication_code]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
      if (names.some((name) => name.includes(allergen) || allergen.includes(name))) {
        conflicts.push({
          allergy_id: String(allergy._id),
          medication_id: toPlainId(medication) || toPlainId(item.medication_id),
          allergen: allergy.allergen,
          medication_name: medicationDisplayName(medication),
          severity: allergy.severity,
        });
      }
    }
  }
  return conflicts;
}

function getDuplicateMedicationCount(items = []) {
  const seen = new Set();
  let duplicates = 0;
  for (const item of items) {
    if (item.status !== 'active') continue;
    const key = toPlainId(item.medication_id);
    if (!key) continue;
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  return duplicates;
}

function getMissingPrescriptionDataCount(items = []) {
  return items.filter((item) => item.status === 'active').reduce((count, item) => {
    const missing = !item.medication_id
      || !item.dose
      || !item.route
      || !item.frequency
      || !Number(item.duration_days || 0)
      || !Number(item.quantity || 0)
      || !item.unit;
    return count + (missing ? 1 : 0);
  }, 0);
}

function buildPrescriptionRiskSummary(prescription, items, stockStats, allergiesByPatient) {
  const activeItems = items.filter((item) => item.status === 'active');
  const patientAllergies = allergiesByPatient.get(String(prescription.patient_id?._id || prescription.patient_id)) || [];
  const allergyConflicts = getAllergyConflicts(patientAllergies, activeItems);
  const duplicateCount = getDuplicateMedicationCount(activeItems);
  const missingDataCount = getMissingPrescriptionDataCount(activeItems);
  let stockShortageCount = 0;
  let inactiveMedicationCount = 0;
  let unpricedMedicationCount = 0;
  let nearExpiryBatchCount = 0;
  let recalledMedicationCount = 0;
  let missingMedicationMasterCount = 0;

  for (const item of activeItems) {
    const medication = item.medication_id || {};
    const medicationId = toPlainId(medication) || toPlainId(item.medication_id);
    const remaining = Math.max(normalizeNumber(item.quantity) - normalizeNumber(item.dispensed_quantity), 0);
    const stock = stockStats.get(medicationId) || {};
    if (remaining > 0 && normalizeNumber(stock.available_quantity) < remaining) stockShortageCount += 1;
    if (!hasPopulatedMedication(medication)) {
      missingMedicationMasterCount += 1;
    } else {
      if (medication.status && medication.status !== MEDICATION_STATUS.ACTIVE) inactiveMedicationCount += 1;
      if (medication.status === MEDICATION_STATUS.RECALLED) recalledMedicationCount += 1;
      if (!medication.service_id && normalizeNumber(medication.sale_price) <= 0) unpricedMedicationCount += 1;
    }
    nearExpiryBatchCount += normalizeNumber(stock.near_expiry_batch_count);
  }

  const interactionCount = new Set(activeItems.map((item) => toPlainId(item.medication_id)).filter(Boolean)).size > 1 ? 1 : 0;
  const severeAllergyCount = allergyConflicts.filter((item) => [ALLERGY_SEVERITY.SEVERE, ALLERGY_SEVERITY.LIFE_THREATENING].includes(item.severity)).length;

  return {
    allergy_count: allergyConflicts.length,
    severe_allergy_count: severeAllergyCount,
    interaction_count: interactionCount,
    duplicate_count: duplicateCount,
    stock_shortage_count: stockShortageCount,
    inactive_medication_count: inactiveMedicationCount,
    recalled_medication_count: recalledMedicationCount,
    missing_medication_master_count: missingMedicationMasterCount,
    missing_data_count: missingDataCount,
    unpriced_medication_count: unpricedMedicationCount,
    near_expiry_batch_count: nearExpiryBatchCount,
    allergy_conflicts: allergyConflicts.slice(0, 5),
  };
}

function riskScore(summary = {}, waitMinutes = 0) {
  if (summary.severe_allergy_count) return 100;
  if (summary.recalled_medication_count) return 90;
  if (summary.interaction_count) return 85;
  if (summary.stock_shortage_count) return 75;
  if (summary.unpriced_medication_count) return 65;
  if (summary.missing_medication_master_count) return 65;
  if (summary.missing_data_count) return 55;
  if (summary.duplicate_count) return 40;
  if (waitMinutes >= 30) return 30;
  return 0;
}

function priorityFromRisk(score) {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function hasAnyRisk(summary = {}) {
  return Object.entries(summary)
    .filter(([key]) => key.endsWith('_count'))
    .some(([, value]) => normalizeNumber(value) > 0);
}

function getAvailableActions(prescription, riskSummary) {
  const status = prescription.status;
  if ([PRESCRIPTION_STATUS.DRAFT, PRESCRIPTION_STATUS.ACTIVE].includes(status)) {
    return [
      'verify',
      ...(riskSummary.allergy_count ? ['override_verify'] : []),
      'recheck',
      'manual_review',
      'request_correction',
      'hold',
      'cancel',
      'duplicate',
      'renew',
    ];
  }
  if (status === PRESCRIPTION_STATUS.VERIFIED) return ['create_dispense', 'dispense_preview', 'reserve_stock', 'cancel', 'print_label'];
  if (status === PRESCRIPTION_STATUS.PARTIALLY_DISPENSED) return ['create_dispense', 'complete_dispense', 'return_to_stock', 'request_correction'];
  if ([PRESCRIPTION_STATUS.FULLY_DISPENSED, PRESCRIPTION_STATUS.COMPLETED].includes(status)) return ['complete', 'return_to_stock', 'print_label', 'print_instruction', 'export_pdf', 'renew', 'duplicate'];
  if (status === PRESCRIPTION_STATUS.CANCELLED) return ['view_audit', 'duplicate', 'replacement_prescription'];
  return ['view_detail'];
}

function mapPrescriptionWorkbenchRow(prescription, context = {}) {
  const items = context.itemsByPrescription.get(String(prescription._id)) || [];
  const dispenses = context.dispensesByPrescription.get(String(prescription._id)) || [];
  const charges = context.chargesByPrescription.get(String(prescription._id)) || [];
  const riskSummary = buildPrescriptionRiskSummary(prescription, items, context.stockStats, context.allergiesByPatient);
  const waitStart = prescription.verified_at || prescription.prescribed_at || prescription.created_at;
  const waitingMinutes = minutesBetween(waitStart);
  const score = riskScore(riskSummary, waitingMinutes);
  const activeItems = items.filter((item) => item.status === 'active');
  const totalQuantity = activeItems.reduce((sum, item) => sum + normalizeNumber(item.quantity), 0);
  const dispensedQuantity = activeItems.reduce((sum, item) => sum + normalizeNumber(item.dispensed_quantity), 0);
  const remainingQuantity = Math.max(totalQuantity - dispensedQuantity, 0);
  const shortageItems = activeItems.filter((item) => {
    const medicationId = toPlainId(item.medication_id);
    const remaining = Math.max(normalizeNumber(item.quantity) - normalizeNumber(item.dispensed_quantity), 0);
    return remaining > 0 && normalizeNumber(context.stockStats.get(medicationId)?.available_quantity) < remaining;
  });

  return {
    prescription_id: String(prescription._id),
    prescription_no: prescription.prescription_no,
    status: prescription.status,
    status_group: prescriptionStatusGroup(prescription.status),
    priority: priorityFromRisk(score),
    risk_score: score,
    patient: {
      patient_id: toPlainId(prescription.patient_id),
      patient_code: prescription.patient_id?.patient_code,
      full_name: personName(prescription.patient_id, 'Bệnh nhân'),
      age: ageFromDate(prescription.patient_id?.date_of_birth),
      gender: prescription.patient_id?.gender,
      phone: prescription.patient_id?.phone,
    },
    encounter: {
      encounter_id: toPlainId(prescription.encounter_id),
      encounter_code: prescription.encounter_id?.encounter_code,
      encounter_type: prescription.encounter_id?.encounter_type,
      department_id: toPlainId(prescription.encounter_id?.department_id),
      department_name: prescription.encounter_id?.department_id?.department_name,
      room_name: prescription.encounter_id?.room_name,
    },
    doctor: {
      user_id: toPlainId(prescription.prescribed_by),
      full_name: personName(prescription.prescribed_by, 'Bác sĩ'),
      employee_code: prescription.prescribed_by?.employee_code,
    },
    prescribed_at: prescription.prescribed_at,
    verified_at: prescription.verified_at,
    cancelled_at: prescription.cancelled_at,
    completed_at: prescription.completed_at,
    waiting_minutes: waitingMinutes,
    sla_status: waitingMinutes >= 30 ? 'overdue' : waitingMinutes >= 15 ? 'warning' : 'on_track',
    items_count: items.length,
    active_items_count: activeItems.length,
    medication_names: activeItems.map((item) => medicationDisplayName(item.medication_id)).slice(0, 5),
    item_details: activeItems.map((item) => {
      const medicationId = toPlainId(item.medication_id);
      const stock = context.stockStats.get(medicationId) || {};
      const hasMedicationMaster = hasPopulatedMedication(item.medication_id);
      return {
        prescription_item_id: String(item._id),
        medication_id: medicationId,
        medication_name: medicationDisplayName(item.medication_id),
        medication_code: item.medication_id?.medication_code,
        dose: item.dose,
        route: item.route,
        frequency: item.frequency,
        duration_days: item.duration_days,
        quantity: item.quantity,
        dispensed_quantity: item.dispensed_quantity,
        remaining_quantity: Math.max(normalizeNumber(item.quantity) - normalizeNumber(item.dispensed_quantity), 0),
        unit: item.unit,
        instructions: item.instructions,
        sale_price: item.medication_id?.sale_price,
        medication_status: item.medication_id?.status,
        medication_master_missing: !hasMedicationMaster,
        available_quantity: stock.available_quantity || 0,
        fefo_batch: stock.fefo_batch ? {
          stock_batch_id: String(stock.fefo_batch._id),
          batch_no: stock.fefo_batch.batch_no,
          lot_no: stock.fefo_batch.lot_no,
          expiry_date: stock.fefo_batch.expiry_date,
          quantity_on_hand: stock.fefo_batch.quantity_on_hand,
          storage_location: stock.fefo_batch.storage_location,
        } : null,
      };
    }),
    dispense_progress: {
      total_quantity: round(totalQuantity, 2),
      dispensed_quantity: round(dispensedQuantity, 2),
      remaining_quantity: round(remainingQuantity, 2),
      percent: totalQuantity ? round((dispensedQuantity / totalQuantity) * 100, 1) : 0,
    },
    risk_summary: riskSummary,
    stock_summary: {
      can_dispense_full: shortageItems.length === 0 && activeItems.length > 0,
      can_dispense_partial: shortageItems.length < activeItems.length,
      shortage_items_count: shortageItems.length,
      near_expiry_batch_count: riskSummary.near_expiry_batch_count,
    },
    billing_summary: {
      estimated_amount: charges.reduce((sum, item) => sum + normalizeNumber(item.total_amount), 0),
      charge_count: charges.length,
      has_charge_error: riskSummary.unpriced_medication_count > 0 || charges.some((item) => [CHARGE_STATUS.CANCELLED, CHARGE_STATUS.VOIDED].includes(item.status)),
    },
    latest_dispense: dispenses[0] ? {
      dispense_id: String(dispenses[0]._id),
      dispense_no: dispenses[0].dispense_no,
      status: dispenses[0].status,
      completed_at: dispenses[0].completed_at,
    } : null,
    available_actions: getAvailableActions(prescription, riskSummary),
    note: prescription.note,
    cancel_reason: prescription.cancel_reason,
    version: prescription.version,
    is_current: prescription.is_current,
    amended_from: toPlainId(prescription.amended_from),
    renewed_from: toPlainId(prescription.renewed_from),
  };
}

function applyPrescriptionWorkbenchFilters(rows = [], query = {}) {
  const search = String(query.search || query.q || '').trim().toLowerCase();
  const riskType = String(query.risk_type || '').trim();
  return rows.filter((row) => {
    if (query.status_group === 'need_review' && !hasAnyRisk(row.risk_summary)) return false;
    if (query.priority && row.priority !== query.priority) return false;
    if (query.department_id && String(row.encounter.department_id || '') !== String(query.department_id)) return false;
    if (query.department && !String(row.encounter.department_name || '').toLowerCase().includes(String(query.department).toLowerCase())) return false;
    if (booleanQuery(query.has_allergy_alert) && row.risk_summary.allergy_count <= 0) return false;
    if (booleanQuery(query.has_interaction_warning) && row.risk_summary.interaction_count <= 0) return false;
    if (booleanQuery(query.has_duplicate_medication) && row.risk_summary.duplicate_count <= 0) return false;
    if (booleanQuery(query.has_stock_shortage) && row.risk_summary.stock_shortage_count <= 0) return false;
    if (booleanQuery(query.has_unpriced_medication) && row.risk_summary.unpriced_medication_count <= 0) return false;
    if (riskType && normalizeNumber(row.risk_summary[`${riskType}_count`]) <= 0) return false;
    if (!search) return true;
    return [
      row.prescription_no,
      row.patient.full_name,
      row.patient.patient_code,
      row.patient.phone,
      row.doctor.full_name,
      row.doctor.employee_code,
      row.encounter.encounter_code,
      row.encounter.department_name,
      ...(row.medication_names || []),
    ].filter(Boolean).join(' ').toLowerCase().includes(search);
  });
}

function sortWorkbenchRows(rows = [], sort = '') {
  const normalized = String(sort || '').toLowerCase();
  return [...rows].sort((a, b) => {
    if (normalized === 'risk') return normalizeNumber(b.risk_score) - normalizeNumber(a.risk_score);
    if (normalized === 'sla') return normalizeNumber(b.waiting_minutes) - normalizeNumber(a.waiting_minutes);
    if (normalized === 'oldest') return new Date(a.prescribed_at || 0).getTime() - new Date(b.prescribed_at || 0).getTime();
    return new Date(b.prescribed_at || b.created_at || 0).getTime() - new Date(a.prescribed_at || a.created_at || 0).getTime();
  });
}

function summarizeWorkbenchRows(rows = []) {
  return {
    total: rows.length,
    pending_verification: rows.filter((row) => row.status_group === 'pending_verification').length,
    waiting_dispense: rows.filter((row) => row.status_group === 'waiting_dispense').length,
    partially_dispensed: rows.filter((row) => row.status_group === 'partially_dispensed').length,
    dispensed: rows.filter((row) => row.status_group === 'dispensed').length,
    cancelled: rows.filter((row) => row.status_group === 'cancelled').length,
    overdue_sla: rows.filter((row) => row.sla_status === 'overdue').length,
    allergy_alerts: rows.reduce((sum, row) => sum + normalizeNumber(row.risk_summary.allergy_count), 0),
    interaction_warnings: rows.reduce((sum, row) => sum + normalizeNumber(row.risk_summary.interaction_count), 0),
    stock_shortages: rows.reduce((sum, row) => sum + normalizeNumber(row.risk_summary.stock_shortage_count), 0),
    unpriced_medications: rows.reduce((sum, row) => sum + normalizeNumber(row.risk_summary.unpriced_medication_count), 0),
    missing_medication_masters: rows.reduce((sum, row) => sum + normalizeNumber(row.risk_summary.missing_medication_master_count), 0),
    charge_errors: rows.filter((row) => row.billing_summary.has_charge_error).length,
    can_dispense_full: rows.filter((row) => row.stock_summary.can_dispense_full).length,
  };
}

async function getRefillWorkbench(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.patient_id) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  if (query.prescription_id) filter.prescription_id = toObjectId(query.prescription_id, 'prescription_id');
  applyDateRange(filter, 'created_at', {
    start: parseDate(query.from || query.date_from, 'from'),
    end: parseDate(query.to || query.date_to, 'to'),
  });

  const rows = await PrescriptionRefillRequest.find(filter)
    .sort({ created_at: -1 })
    .limit(500)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate({
      path: 'prescription_id',
      select: 'prescription_no status prescribed_at prescribed_by',
      populate: { path: 'prescribed_by', select: 'full_name employee_code username' },
    })
    .populate('reviewed_by', 'full_name employee_code username')
    .lean();

  const search = String(query.search || query.q || '').trim().toLowerCase();
  const filtered = rows.filter((request) => {
    if (!search) return true;
    return [
      request.prescription_id?.prescription_no,
      request.patient_id?.full_name,
      request.patient_id?.patient_code,
      request.reason,
    ].filter(Boolean).join(' ').toLowerCase().includes(search);
  });

  const items = filtered.slice(skip, skip + limit).map((request) => ({
    refill_request_id: String(request._id),
    prescription_id: toPlainId(request.prescription_id),
    prescription_no: request.prescription_id?.prescription_no,
    status: request.status,
    status_group: 'refill',
    priority: request.priority || 'medium',
    patient: {
      patient_id: toPlainId(request.patient_id),
      patient_code: request.patient_id?.patient_code,
      full_name: personName(request.patient_id, 'Bệnh nhân'),
      age: ageFromDate(request.patient_id?.date_of_birth),
      gender: request.patient_id?.gender,
      phone: request.patient_id?.phone,
    },
    doctor: {
      user_id: toPlainId(request.prescription_id?.prescribed_by),
      full_name: personName(request.prescription_id?.prescribed_by, 'Bác sĩ'),
      employee_code: request.prescription_id?.prescribed_by?.employee_code,
    },
    requested_at: request.created_at,
    prescribed_at: request.prescription_id?.prescribed_at,
    waiting_minutes: minutesBetween(request.created_at),
    sla_status: minutesBetween(request.created_at) > 240 ? 'overdue' : 'on_track',
    reason: request.reason,
    requested_items: request.requested_items || [],
    risk_summary: {
      allergy_count: 0,
      interaction_count: 0,
      duplicate_count: 0,
      stock_shortage_count: 0,
      inactive_medication_count: 0,
      unpriced_medication_count: 0,
    },
    dispense_progress: { total_quantity: 0, dispensed_quantity: 0, remaining_quantity: 0, percent: 0 },
    stock_summary: { can_dispense_full: false, can_dispense_partial: false, shortage_items_count: 0, near_expiry_batch_count: 0 },
    billing_summary: { estimated_amount: 0, charge_count: 0, has_charge_error: false },
    available_actions: ['approve_refill', 'reject_refill', 'send_to_doctor', 'convert_to_prescription'],
  }));

  return {
    status_group: 'refill',
    summary: {
      total: filtered.length,
      pending: filtered.filter((item) => item.status === PRESCRIPTION_REFILL_REQUEST_STATUS.PENDING).length,
      approved: filtered.filter((item) => item.status === PRESCRIPTION_REFILL_REQUEST_STATUS.APPROVED).length,
      rejected: filtered.filter((item) => item.status === PRESCRIPTION_REFILL_REQUEST_STATUS.REJECTED).length,
      overdue_sla: items.filter((item) => item.sla_status === 'overdue').length,
    },
    items,
    pagination: buildPagination(page, limit, filtered.length),
  };
}

async function getPrescriptionWorkbench(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  if (query.status_group === 'refill') return getRefillWorkbench(query, actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = buildPrescriptionWorkbenchFilter(query);
  const prescriptions = await Prescription.find(filter)
    .sort({ prescribed_at: -1, created_at: -1 })
    .limit(500)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate({
      path: 'encounter_id',
      select: 'encounter_code encounter_type status start_time department_id',
      populate: { path: 'department_id', select: 'department_code department_name location_note' },
    })
    .populate('prescribed_by', 'full_name username employee_code')
    .populate('verified_by', 'full_name username employee_code')
    .lean();

  const prescriptionIds = prescriptions.map((item) => item._id);
  const patientIds = [...new Set(prescriptions.map((item) => String(item.patient_id?._id || item.patient_id)).filter(Boolean))]
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  const [items, dispenses, allergies] = await Promise.all([
    PrescriptionItem.find({ prescription_id: { $in: prescriptionIds } })
      .sort({ created_at: 1 })
      .populate({
        path: 'medication_id',
        select: 'medication_code generic_name brand_name strength dosage_form route_default unit status sale_price service_id',
        transform: preserveMissingRef,
      })
      .lean(),
    Dispense.find({ prescription_id: { $in: prescriptionIds } })
      .sort({ created_at: -1 })
      .select('prescription_id dispense_no status dispensed_by dispensed_at completed_at cancelled_at cancel_reason created_at updated_at')
      .lean(),
    Allergy.find({
      patient_id: { $in: patientIds },
      allergy_type: ALLERGY_TYPE.MEDICATION,
      status: ALLERGY_STATUS.ACTIVE,
    }).lean(),
  ]);
  const dispenseIds = dispenses.map((item) => item._id);
  const charges = dispenseIds.length
    ? await Charge.find({ dispense_id: { $in: dispenseIds } }).select('dispense_id total_amount status charged_at').lean()
    : [];
  const medicationIds = items.map((item) => toPlainId(item.medication_id));
  const stockStats = await getWorkbenchStockStats(medicationIds);
  const allergiesByPatient = new Map();
  for (const allergy of allergies) {
    const key = String(allergy.patient_id);
    if (!allergiesByPatient.has(key)) allergiesByPatient.set(key, []);
    allergiesByPatient.get(key).push(allergy);
  }
  const dispenseToPrescription = new Map(dispenses.map((dispense) => [String(dispense._id), String(dispense.prescription_id)]));
  const context = {
    itemsByPrescription: getItemMap(items),
    dispensesByPrescription: getDispenseMap(dispenses),
    chargesByPrescription: getChargeMap(charges, dispenseToPrescription),
    stockStats,
    allergiesByPatient,
  };
  const rows = prescriptions.map((prescription) => mapPrescriptionWorkbenchRow(prescription, context));
  const filtered = sortWorkbenchRows(applyPrescriptionWorkbenchFilters(rows, query), query.sort || (query.status_group === 'need_review' ? 'risk' : ''));
  const paged = filtered.slice(skip, skip + limit);

  return {
    status_group: query.status_group || 'history',
    summary: summarizeWorkbenchRows(filtered),
    items: paged,
    pagination: buildPagination(page, limit, filtered.length),
    filters: {
      status_group: query.status_group || 'history',
      search: query.search || query.q || '',
      sort: query.sort || '',
    },
  };
}

async function getPrescriptionRiskQueue(query = {}, actor = {}) {
  const workbench = await getPrescriptionWorkbench({ ...query, status_group: 'need_review', sort: query.sort || 'risk' }, actor);
  return {
    summary: workbench.summary,
    items: workbench.items.map((item) => ({
      ...item,
      risk_types: Object.entries(item.risk_summary || {})
        .filter(([key, value]) => key.endsWith('_count') && normalizeNumber(value) > 0)
        .map(([key]) => key.replace(/_count$/, '')),
      recommendation: item.risk_summary.severe_allergy_count
        ? 'Không duyệt nếu chưa override dị ứng nghiêm trọng.'
        : item.risk_summary.stock_shortage_count
          ? 'Kiểm tra tồn FEFO hoặc gửi bác sĩ đổi thuốc.'
          : item.risk_summary.unpriced_medication_count
            ? 'Cấu hình giá/service pharmacy trước khi cấp phát.'
            : item.risk_summary.missing_medication_master_count
              ? 'Kiểm tra lại danh mục thuốc hoặc cập nhật medication_id cho đơn.'
              : 'Rà soát thủ công và ghi nhận quyết định.',
    })),
    pagination: workbench.pagination,
  };
}

function mapPrescriptionCard(prescription) {
  return {
    id: String(prescription._id),
    type: 'prescription',
    prescription_id: String(prescription._id),
    reference_no: prescription.prescription_no,
    patient_name: personName(prescription.patient_id, 'Bệnh nhân'),
    patient: prescription.patient_id,
    status: prescription.status,
    item_count: prescription.items_count,
    wait_minutes: minutesBetween(prescription.verified_at || prescription.prescribed_at || prescription.created_at),
    created_at: prescription.created_at,
    updated_at: prescription.updated_at,
  };
}

function mapDispenseCard(dispense) {
  return {
    id: String(dispense._id),
    type: 'dispense',
    dispense_id: String(dispense._id),
    prescription_id: toPlainId(dispense.prescription_id),
    reference_no: dispense.dispense_no,
    prescription_no: dispense.prescription_id?.prescription_no,
    patient_name: personName(dispense.patient_id, 'Bệnh nhân'),
    patient: dispense.patient_id,
    status: dispense.status,
    item_count: dispense.items_count,
    dispensed_by: dispense.dispensed_by,
    wait_minutes: minutesBetween(dispense.created_at),
    created_at: dispense.created_at,
    completed_at: dispense.completed_at,
    updated_at: dispense.updated_at,
  };
}

async function getDispensingToday(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const range = buildDateRange(query);
  const createdToday = {};
  applyDateRange(createdToday, 'created_at', range);
  const completedToday = {};
  applyDateRange(completedToday, 'completed_at', range);
  const [waiting, preparing, partially, dispensed, returned, cancelled, summary] = await Promise.all([
    Prescription.find({ status: PRESCRIPTION_STATUS.VERIFIED })
      .sort({ verified_at: 1, updated_at: 1 })
      .limit(80)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .lean(),
    Dispense.find({ status: DISPENSE_STATUS.DRAFT, ...createdToday })
      .sort({ created_at: 1 })
      .limit(80)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('prescription_id', 'prescription_no status')
      .populate('dispensed_by', 'full_name username employee_code')
      .lean(),
    Dispense.find({ status: DISPENSE_STATUS.PARTIALLY_DISPENSED, ...createdToday })
      .sort({ updated_at: 1 })
      .limit(80)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('prescription_id', 'prescription_no status')
      .populate('dispensed_by', 'full_name username employee_code')
      .lean(),
    Dispense.find({ status: DISPENSE_STATUS.DISPENSED, ...completedToday })
      .sort({ completed_at: -1 })
      .limit(80)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('prescription_id', 'prescription_no status')
      .populate('dispensed_by', 'full_name username employee_code')
      .lean(),
    Dispense.find({ status: DISPENSE_STATUS.RETURNED, ...rangeOr(['cancelled_at', 'updated_at'], range) })
      .sort({ updated_at: -1 })
      .limit(50)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('prescription_id', 'prescription_no status')
      .populate('dispensed_by', 'full_name username employee_code')
      .lean(),
    Dispense.find({ status: DISPENSE_STATUS.CANCELLED, ...rangeOr(['cancelled_at', 'updated_at'], range) })
      .sort({ updated_at: -1 })
      .limit(50)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('prescription_id', 'prescription_no status')
      .populate('dispensed_by', 'full_name username employee_code')
      .lean(),
    getDispenseSummary(range),
  ]);

  return {
    summary: {
      waiting: waiting.length,
      preparing: preparing.length,
      partially_dispensed: partially.length,
      dispensed: dispensed.length,
      returned: returned.length,
      cancelled: cancelled.length,
      average_minutes: summary.average_minutes,
      shortage: await getInsufficientStockCount(),
    },
    columns: {
      waiting: waiting.map(mapPrescriptionCard),
      preparing: preparing.map(mapDispenseCard),
      partially_dispensed: partially.map(mapDispenseCard),
      dispensed: dispensed.map(mapDispenseCard),
      returned: returned.map(mapDispenseCard),
      cancelled: cancelled.map(mapDispenseCard),
    },
  };
}

async function getPerformance(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const range = buildDateRange(query);
  const prescriptionMatch = {};
  const dispenseMatch = {};
  applyDateRange(prescriptionMatch, 'verified_at', range);
  applyDateRange(dispenseMatch, 'completed_at', range);
  const [summaryPrescriptions, summaryDispenses, byStaff, byHour, topMedications, stockRisk, slaRows] = await Promise.all([
    Prescription.aggregate([
      { $match: { verified_at: { $exists: true }, ...prescriptionMatch } },
      {
        $project: {
          status: 1,
          verify_minutes: { $divide: [{ $subtract: ['$verified_at', '$prescribed_at'] }, 60000] },
        },
      },
      { $group: { _id: null, total: { $sum: 1 }, average_verify_minutes: { $avg: '$verify_minutes' } } },
    ]),
    Dispense.aggregate([
      { $match: { completed_at: { $exists: true }, ...dispenseMatch } },
      {
        $project: {
          status: 1,
          dispense_minutes: { $divide: [{ $subtract: ['$completed_at', '$created_at'] }, 60000] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          average_dispense_minutes: { $avg: '$dispense_minutes' },
          returned: { $sum: { $cond: [{ $eq: ['$status', DISPENSE_STATUS.RETURNED] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', DISPENSE_STATUS.CANCELLED] }, 1, 0] } },
        },
      },
    ]),
    Dispense.aggregate([
      { $match: { completed_by: { $exists: true }, ...dispenseMatch } },
      {
        $group: {
          _id: '$completed_by',
          dispenses_completed: { $sum: 1 },
          average_dispense_minutes: { $avg: { $divide: [{ $subtract: ['$completed_at', '$created_at'] }, 60000] } },
          returns: { $sum: { $cond: [{ $eq: ['$status', DISPENSE_STATUS.RETURNED] }, 1, 0] } },
          cancels: { $sum: { $cond: [{ $eq: ['$status', DISPENSE_STATUS.CANCELLED] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'staff',
        },
      },
      { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
      { $sort: { dispenses_completed: -1 } },
      { $limit: 20 },
    ]),
    getDispenseByHour(range),
    getTopDispensedMedications(range, 10),
    getInventorySummary(range, query),
    Dispense.aggregate([
      { $match: { completed_at: { $exists: true }, ...dispenseMatch } },
      {
        $group: {
          _id: null,
          within_sla: {
            $sum: {
              $cond: [
                { $lte: [{ $divide: [{ $subtract: ['$completed_at', '$created_at'] }, 60000] }, 30] },
                1,
                0,
              ],
            },
          },
          total: { $sum: 1 },
        },
      },
    ]),
  ]);
  const prescription = summaryPrescriptions[0] || {};
  const dispense = summaryDispenses[0] || {};
  const sla = slaRows[0] || {};
  return {
    summary: {
      prescriptions_verified: prescription.total || 0,
      average_verify_minutes: round(prescription.average_verify_minutes || 0, 1),
      dispenses_completed: dispense.total || 0,
      average_dispense_minutes: round(dispense.average_dispense_minutes || 0, 1),
      returned: dispense.returned || 0,
      cancelled: dispense.cancelled || 0,
      stock_shortage_count: stockRisk.low_stock_items,
      inventory_value: stockRisk.inventory_value,
      near_expiry_batches: stockRisk.near_expiry_batches,
      waste_quantity: 0,
      dispense_sla_rate: sla.total ? round((sla.within_sla / sla.total) * 100, 1) : 0,
    },
    by_staff: byStaff.map((row) => ({
      staff_id: toPlainId(row._id),
      staff_name: personName(row.staff, 'Dược sĩ'),
      dispenses_completed: row.dispenses_completed,
      prescriptions_verified: 0,
      medication_quantity: 0,
      average_verify_minutes: 0,
      average_dispense_minutes: round(row.average_dispense_minutes || 0, 1),
      returns: row.returns || 0,
      cancels: row.cancels || 0,
      alerts_resolved: 0,
      sla_rate: 0,
    })),
    by_hour: byHour,
    top_medications: topMedications,
    stock_risk: stockRisk,
    sla: {
      dispense_within_sla: sla.within_sla || 0,
      dispense_total: sla.total || 0,
      dispense_sla_rate: sla.total ? round((sla.within_sla / sla.total) * 100, 1) : 0,
    },
  };
}

function buildBatchSearchMatch(query = {}) {
  const match = { is_deleted: false };
  if (query.medication_id) match.medication_id = toObjectId(query.medication_id, 'medication_id');
  if (query.status) match.status = query.status;
  if (query.storage_location) match.storage_location = query.storage_location;
  if (query.supplier_name) match.supplier_name = query.supplier_name;
  return match;
}

function getMedicationSearchStage(query = {}) {
  const search = String(query.search || query.keyword || '').trim();
  if (!search) return null;
  const pattern = escapeRegex(search);
  return {
    $or: [
      { 'medication.medication_code': { $regex: pattern, $options: 'i' } },
      { 'medication.generic_name': { $regex: pattern, $options: 'i' } },
      { 'medication.brand_name': { $regex: pattern, $options: 'i' } },
      { 'medication.strength': { $regex: pattern, $options: 'i' } },
      { storage_locations: { $regex: pattern, $options: 'i' } },
    ],
  };
}

function resolveStockStatus(item = {}) {
  const total = normalizeNumber(item.total_on_hand);
  const available = normalizeNumber(item.available_on_hand);
  const min = normalizeNumber(item.medication?.min_stock_level);
  if (total <= 0 || available <= 0) return 'out';
  if (min > 0 && total <= min) return 'low';
  if (normalizeNumber(item.expired_batch_count) > 0 || normalizeNumber(item.recalled_batch_count) > 0 || normalizeNumber(item.quarantined_batch_count) > 0) return 'risk';
  if (normalizeNumber(item.near_expiry_batch_count) > 0) return 'watch';
  return 'normal';
}

async function getCurrentStock(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const now = new Date();
  const nearExpiryDays = Math.min(Math.max(Number(query.near_expiry_days || 30), 1), 365);
  const nearExpiryTo = new Date(now.getTime() + nearExpiryDays * 86400000);
  const batchMatch = buildBatchSearchMatch(query);

  const pipeline = [
    { $match: batchMatch },
    {
      $lookup: {
        from: 'medication_master',
        localField: 'medication_id',
        foreignField: '_id',
        as: 'medication',
      },
    },
    { $unwind: '$medication' },
    { $match: { 'medication.is_deleted': false } },
    {
      $group: {
        _id: '$medication_id',
        medication: { $first: '$medication' },
        total_on_hand: { $sum: '$quantity_on_hand' },
        available_on_hand: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', STOCK_BATCH_STATUS.AVAILABLE] },
                  { $gt: ['$quantity_on_hand', 0] },
                  { $or: [{ $eq: ['$expiry_date', null] }, { $gt: ['$expiry_date', now] }] },
                ],
              },
              '$quantity_on_hand',
              0,
            ],
          },
        },
        batch_count: { $sum: 1 },
        available_batch_count: {
          $sum: { $cond: [{ $and: [{ $eq: ['$status', STOCK_BATCH_STATUS.AVAILABLE] }, { $gt: ['$quantity_on_hand', 0] }] }, 1, 0] },
        },
        near_expiry_batch_count: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$expiry_date', null] }, { $gte: ['$expiry_date', now] }, { $lte: ['$expiry_date', nearExpiryTo] }, { $gt: ['$quantity_on_hand', 0] }] },
              1,
              0,
            ],
          },
        },
        expired_batch_count: {
          $sum: { $cond: [{ $or: [{ $eq: ['$status', STOCK_BATCH_STATUS.EXPIRED] }, { $lt: ['$expiry_date', now] }] }, 1, 0] },
        },
        recalled_batch_count: {
          $sum: { $cond: [{ $eq: ['$status', STOCK_BATCH_STATUS.RECALLED] }, 1, 0] },
        },
        quarantined_batch_count: {
          $sum: { $cond: [{ $eq: ['$status', STOCK_BATCH_STATUS.QUARANTINED] }, 1, 0] },
        },
        depleted_batch_count: {
          $sum: { $cond: [{ $or: [{ $eq: ['$status', STOCK_BATCH_STATUS.DEPLETED] }, { $lte: ['$quantity_on_hand', 0] }] }, 1, 0] },
        },
        inventory_value: { $sum: { $multiply: ['$quantity_on_hand', { $ifNull: ['$unit_cost', 0] }] } },
        storage_locations: { $addToSet: '$storage_location' },
      },
    },
  ];
  const searchMatch = getMedicationSearchStage(query);
  if (searchMatch) pipeline.push({ $match: searchMatch });
  if (query.stock_status) {
    const stockStatus = String(query.stock_status).toLowerCase();
    if (stockStatus === 'out') pipeline.push({ $match: { available_on_hand: { $lte: 0 } } });
    if (stockStatus === 'low') pipeline.push({ $match: { $expr: { $and: [{ $gt: ['$total_on_hand', 0] }, { $lte: ['$total_on_hand', '$medication.min_stock_level'] }] } } });
    if (stockStatus === 'risk') pipeline.push({ $match: { $or: [{ expired_batch_count: { $gt: 0 } }, { recalled_batch_count: { $gt: 0 } }, { quarantined_batch_count: { $gt: 0 } }] } });
    if (stockStatus === 'watch') pipeline.push({ $match: { near_expiry_batch_count: { $gt: 0 } } });
  }
  pipeline.push({ $sort: { 'medication.generic_name': 1, 'medication.brand_name': 1 } });
  pipeline.push({
    $facet: {
      items: [{ $skip: skip }, { $limit: limit }],
      count: [{ $count: 'total' }],
    },
  });

  const [facet] = await StockBatch.aggregate(pipeline);
  const rawItems = facet?.items || [];
  const medicationIds = rawItems.map((item) => item._id);
  const fefoRows = medicationIds.length ? await StockBatch.aggregate([
    {
      $match: {
        medication_id: { $in: medicationIds },
        status: STOCK_BATCH_STATUS.AVAILABLE,
        quantity_on_hand: { $gt: 0 },
        is_deleted: false,
        $or: [{ expiry_date: null }, { expiry_date: { $gt: now } }],
      },
    },
    { $sort: { medication_id: 1, expiry_date: 1, received_date: 1, created_at: 1 } },
    {
      $group: {
        _id: '$medication_id',
        stock_batch_id: { $first: '$_id' },
        batch_no: { $first: '$batch_no' },
        lot_no: { $first: '$lot_no' },
        expiry_date: { $first: '$expiry_date' },
        quantity_on_hand: { $first: '$quantity_on_hand' },
        storage_location: { $first: '$storage_location' },
      },
    },
  ]) : [];
  const fefoMap = new Map(fefoRows.map((row) => [String(row._id), row]));
  const items = rawItems.map((item) => ({
    medication: item.medication,
    total_on_hand: round(item.total_on_hand || 0, 2),
    available_on_hand: round(item.available_on_hand || 0, 2),
    reserved_quantity: 0,
    min_stock_level: item.medication?.min_stock_level || 0,
    stock_status: resolveStockStatus(item),
    batch_count: item.batch_count || 0,
    available_batch_count: item.available_batch_count || 0,
    near_expiry_batch_count: item.near_expiry_batch_count || 0,
    expired_batch_count: item.expired_batch_count || 0,
    recalled_batch_count: item.recalled_batch_count || 0,
    quarantined_batch_count: item.quarantined_batch_count || 0,
    depleted_batch_count: item.depleted_batch_count || 0,
    fefo_batch: fefoMap.get(String(item._id)) || null,
    inventory_value: round(item.inventory_value || 0, 0),
    storage_locations: (item.storage_locations || []).filter(Boolean),
  }));

  return {
    items,
    pagination: buildPagination(page, limit, facet?.count?.[0]?.total || 0),
  };
}

async function getMedicationSummary(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const [statusRows, missingPrice, missingService, currentStock, noAvailableStock, belowMinimum, nearExpiry] = await Promise.all([
    MedicationMaster.aggregate([
      { $match: { is_deleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    MedicationMaster.countDocuments({ is_deleted: false, $or: [{ sale_price: { $exists: false } }, { sale_price: null }, { sale_price: { $lte: 0 } }] }),
    MedicationMaster.countDocuments({ is_deleted: false, $or: [{ service_id: { $exists: false } }, { service_id: null }] }),
    getCurrentStock({ ...query, limit: 1 }, actor),
    StockBatch.aggregate([
      { $match: { is_deleted: false, status: STOCK_BATCH_STATUS.AVAILABLE, quantity_on_hand: { $gt: 0 } } },
      { $group: { _id: '$medication_id', available: { $sum: '$quantity_on_hand' } } },
    ]),
    StockBatch.aggregate([
      { $match: { is_deleted: false } },
      { $group: { _id: '$medication_id', total_on_hand: { $sum: '$quantity_on_hand' } } },
      {
        $lookup: {
          from: 'medication_master',
          localField: '_id',
          foreignField: '_id',
          as: 'medication',
        },
      },
      { $unwind: '$medication' },
      { $match: { 'medication.is_deleted': false, $expr: { $and: [{ $gt: ['$total_on_hand', 0] }, { $lte: ['$total_on_hand', '$medication.min_stock_level'] }] } } },
      { $count: 'count' },
    ]),
    StockBatch.countDocuments({
      is_deleted: false,
      quantity_on_hand: { $gt: 0 },
      expiry_date: { $gte: new Date(), $lte: new Date(Date.now() + Number(query.near_expiry_days || 30) * 86400000) },
    }),
  ]);
  const statusMap = new Map(statusRows.map((row) => [row._id, row.count]));
  const availableIds = new Set(noAvailableStock.map((row) => String(row._id)));
  const activeMedicationRows = await MedicationMaster.find({ is_deleted: false, status: MEDICATION_STATUS.ACTIVE }).select('_id').lean();
  return {
    total_medications: statusRows.reduce((sum, row) => sum + row.count, 0),
    active: statusMap.get(MEDICATION_STATUS.ACTIVE) || 0,
    inactive: statusMap.get('inactive') || 0,
    discontinued: statusMap.get('discontinued') || 0,
    recalled: statusMap.get('recalled') || 0,
    missing_price: missingPrice,
    missing_service: missingService,
    below_min_stock: belowMinimum[0]?.count || 0,
    without_available_stock: activeMedicationRows.filter((item) => !availableIds.has(String(item._id))).length,
    near_expiry_batches: nearExpiry,
    stock_matrix_items: currentStock.pagination.total || 0,
  };
}

function getExpiryRiskLevel(daysLeft) {
  if (daysLeft <= 7) return 'critical';
  if (daysLeft <= 15) return 'high';
  if (daysLeft <= 30) return 'medium';
  return 'watch';
}

async function getExpiryRisk(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const now = new Date();
  const days = Math.min(Math.max(Number(query.near_expiry_days || query.days || 60), 1), 365);
  const until = new Date(now.getTime() + days * 86400000);
  const filter = {
    is_deleted: false,
    quantity_on_hand: { $gt: 0 },
    status: { $nin: [STOCK_BATCH_STATUS.EXPIRED, STOCK_BATCH_STATUS.RECALLED, STOCK_BATCH_STATUS.DEPLETED] },
    expiry_date: { $gte: now, $lte: until },
  };
  if (query.storage_location) filter.storage_location = query.storage_location;
  if (query.supplier_name) filter.supplier_name = query.supplier_name;
  if (query.medication_id) filter.medication_id = toObjectId(query.medication_id, 'medication_id');

  const [rows, total] = await Promise.all([
    StockBatch.find(filter)
      .sort({ expiry_date: 1, quantity_on_hand: -1 })
      .skip(skip)
      .limit(limit)
      .populate('medication_id', 'medication_code generic_name brand_name strength unit')
      .lean(),
    StockBatch.countDocuments(filter),
  ]);
  const allRiskRows = await StockBatch.find(filter).select('expiry_date quantity_on_hand unit_cost supplier_name medication_id').lean();
  const summary = {
    within_7_days: 0,
    within_15_days: 0,
    within_30_days: 0,
    within_60_days: 0,
    risk_quantity: 0,
    risk_value: 0,
  };
  const byMedication = new Map();
  const bySupplier = new Map();
  for (const row of allRiskRows) {
    const daysLeft = Math.ceil((new Date(row.expiry_date).getTime() - now.getTime()) / 86400000);
    if (daysLeft <= 7) summary.within_7_days += 1;
    if (daysLeft <= 15) summary.within_15_days += 1;
    if (daysLeft <= 30) summary.within_30_days += 1;
    if (daysLeft <= 60) summary.within_60_days += 1;
    summary.risk_quantity += normalizeNumber(row.quantity_on_hand);
    summary.risk_value += normalizeNumber(row.quantity_on_hand) * normalizeNumber(row.unit_cost);
    byMedication.set(String(row.medication_id), (byMedication.get(String(row.medication_id)) || 0) + normalizeNumber(row.quantity_on_hand));
    if (row.supplier_name) bySupplier.set(row.supplier_name, (bySupplier.get(row.supplier_name) || 0) + 1);
  }

  const items = rows.map((batch) => {
    const daysLeft = Math.ceil((new Date(batch.expiry_date).getTime() - now.getTime()) / 86400000);
    return {
      batch_id: String(batch._id),
      stock_batch: batch,
      medication: batch.medication_id,
      risk_level: getExpiryRiskLevel(daysLeft),
      days_left: daysLeft,
      risk_quantity: batch.quantity_on_hand,
      risk_value: normalizeNumber(batch.quantity_on_hand) * normalizeNumber(batch.unit_cost),
      suggestion: daysLeft <= 15
        ? 'Ưu tiên cấp phát FEFO, chuyển sang khu picking hoặc lập kế hoạch trả/hủy.'
        : 'Theo dõi và ưu tiên trong danh sách cấp phát trước.',
    };
  });

  return {
    summary: {
      ...summary,
      risk_value: round(summary.risk_value, 0),
      top_medication_ids: [...byMedication.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      top_suppliers: [...bySupplier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    },
    items,
    pagination: buildPagination(page, limit, total),
  };
}

async function refreshStocktakeCounters(stocktakeId, session = null) {
  const rows = await withSession(StocktakeItem.aggregate([
    { $match: { stocktake_id: toObjectId(stocktakeId, 'stocktake_id') } },
    {
      $group: {
        _id: null,
        item_count: { $sum: 1 },
        counted_count: { $sum: { $cond: [{ $in: ['$status', [STOCKTAKE_ITEM_STATUS.COUNTED, STOCKTAKE_ITEM_STATUS.REVIEWED, STOCKTAKE_ITEM_STATUS.POSTED]] }, 1, 0] } },
        variance_count: { $sum: { $cond: [{ $ne: ['$variance_quantity', 0] }, 1, 0] } },
        variance_value: { $sum: '$variance_value' },
      },
    },
  ]), session);
  const totals = rows[0] || {};
  await withSession(StocktakeSession.findByIdAndUpdate(stocktakeId, {
    item_count: totals.item_count || 0,
    counted_count: totals.counted_count || 0,
    variance_count: totals.variance_count || 0,
    variance_value: round(totals.variance_value || 0, 0),
  }), session);
}

async function listStocktakes(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  for (const field of ['status', 'scope_type', 'assigned_to']) {
    if (query[field]) filter[field] = field === 'assigned_to' ? toObjectId(query[field], field) : query[field];
  }
  if (query.search) {
    filter.stocktake_no = { $regex: escapeRegex(query.search), $options: 'i' };
  }
  const [items, total] = await Promise.all([
    StocktakeSession.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('created_by', 'full_name username employee_code')
      .populate('assigned_to', 'full_name username employee_code')
      .populate('reviewed_by', 'full_name username employee_code')
      .populate('posted_by', 'full_name username employee_code')
      .lean(),
    StocktakeSession.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getStocktakeDetail(stocktakeId, actor = {}, query = {}) {
  assertPharmacyRead(actor);
  const { page, limit, skip } = getPagination(query, 100, 500);
  const stocktake = await StocktakeSession.findById(stocktakeId)
    .populate('created_by', 'full_name username employee_code')
    .populate('assigned_to', 'full_name username employee_code')
    .populate('reviewed_by', 'full_name username employee_code')
    .populate('posted_by', 'full_name username employee_code')
    .lean();
  if (!stocktake) throw createError('Không tìm thấy kỳ kiểm kê.', 404);
  const itemFilter = { stocktake_id: toObjectId(stocktakeId, 'stocktake_id') };
  if (query.status) itemFilter.status = query.status;
  if (query.search) {
    const batchIds = await StockBatch.find({
      $or: [
        { batch_no: { $regex: escapeRegex(query.search), $options: 'i' } },
        { lot_no: { $regex: escapeRegex(query.search), $options: 'i' } },
        { storage_location: { $regex: escapeRegex(query.search), $options: 'i' } },
      ],
    }).select('_id').lean();
    itemFilter.stock_batch_id = { $in: batchIds.map((batch) => batch._id) };
  }
  const [items, total] = await Promise.all([
    StocktakeItem.find(itemFilter)
      .sort({ status: 1, created_at: 1 })
      .skip(skip)
      .limit(limit)
      .populate('medication_id', 'medication_code generic_name brand_name strength unit')
      .populate('stock_batch_id', 'batch_no lot_no expiry_date storage_location status quantity_on_hand')
      .populate('counted_by', 'full_name username employee_code')
      .lean(),
    StocktakeItem.countDocuments(itemFilter),
  ]);
  return { stocktake, items, pagination: buildPagination(page, limit, total) };
}

async function createStocktake(payload = {}, actor = {}, requestMeta = {}) {
  assertStaff(actor);
  if (!hasAnyPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.READ, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT, PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Tài khoản hiện tại không có quyền tạo kỳ kiểm kê.', 403);
  }
  const stocktakeNo = payload.stocktake_no || await generateSequenceCode(StocktakeSession, 'stocktake_no', 'STK', { sequenceWidth: 4 });
  const stocktake = await StocktakeSession.create({
    stocktake_no: stocktakeNo,
    scope_type: payload.scope_type || 'full',
    scope_value: payload.scope_value || payload.scope || undefined,
    status: STOCKTAKE_STATUS.DRAFT,
    assigned_to: payload.assigned_to || actorId(actor),
    note: payload.note,
    created_by: actorId(actor),
    updated_by: actorId(actor),
  });
  await recordAuditLog({ actor, action: 'stocktake.create', targetType: 'stocktake', targetId: stocktake._id, status: 'success', message: 'Tạo kỳ kiểm kê thành công.', requestMeta });
  return getStocktakeDetail(stocktake._id, actor);
}

async function startStocktake(stocktakeId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaff(actor);
  const stocktake = await StocktakeSession.findById(stocktakeId);
  if (!stocktake) throw createError('Không tìm thấy kỳ kiểm kê.', 404);
  if (![STOCKTAKE_STATUS.DRAFT, STOCKTAKE_STATUS.OPEN].includes(stocktake.status)) throw createError('Chỉ kỳ draft/open mới được bắt đầu.', 409);
  stocktake.status = STOCKTAKE_STATUS.COUNTING;
  stocktake.started_at = stocktake.started_at || new Date();
  stocktake.assigned_to = payload.assigned_to || stocktake.assigned_to || actorId(actor);
  stocktake.updated_by = actorId(actor);
  await stocktake.save();
  await recordAuditLog({ actor, action: 'stocktake.start', targetType: 'stocktake', targetId: stocktake._id, status: 'success', message: 'Bắt đầu kiểm kê thành công.', requestMeta });
  return getStocktakeDetail(stocktake._id, actor);
}

function buildStocktakeBatchFilter(stocktake, payload = {}) {
  const filter = { is_deleted: false };
  const scopeValue = payload.scope_value || stocktake.scope_value;
  if (stocktake.scope_type === 'location') filter.storage_location = payload.storage_location || scopeValue;
  if (stocktake.scope_type === 'selected_batches') {
    const ids = (payload.batch_ids || scopeValue || []).map((id) => toObjectId(id, 'batch_id'));
    filter._id = { $in: ids };
  }
  if (stocktake.scope_type === 'medication_group' && (payload.medication_ids || scopeValue)) {
    const ids = (payload.medication_ids || scopeValue || []).map((id) => toObjectId(id, 'medication_id'));
    filter.medication_id = { $in: ids };
  }
  return filter;
}

async function generateStocktakeItems(stocktakeId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaff(actor);
  const stocktake = await StocktakeSession.findById(stocktakeId);
  if (!stocktake) throw createError('Không tìm thấy kỳ kiểm kê.', 404);
  if ([STOCKTAKE_STATUS.POSTED, STOCKTAKE_STATUS.CANCELLED].includes(stocktake.status)) throw createError('Kỳ kiểm kê đã khóa.', 409);
  const batches = await StockBatch.find(buildStocktakeBatchFilter(stocktake, payload)).lean();
  const existingItems = await StocktakeItem.find({ stocktake_id: stocktake._id }).select('stock_batch_id').lean();
  const existingBatchIds = new Set(existingItems.map((item) => String(item.stock_batch_id)));
  const docs = batches
    .filter((batch) => !existingBatchIds.has(String(batch._id)))
    .map((batch) => ({
      stocktake_id: stocktake._id,
      medication_id: batch.medication_id,
      stock_batch_id: batch._id,
      system_quantity: normalizeNumber(batch.quantity_on_hand),
      counted_quantity: undefined,
      variance_quantity: 0,
      unit_cost: normalizeNumber(batch.unit_cost),
      variance_value: 0,
      status: STOCKTAKE_ITEM_STATUS.PENDING,
      created_by: actorId(actor),
      updated_by: actorId(actor),
    }));
  if (docs.length) await StocktakeItem.insertMany(docs, { ordered: false });
  await refreshStocktakeCounters(stocktake._id);
  await recordAuditLog({ actor, action: 'stocktake.items_generate', targetType: 'stocktake', targetId: stocktake._id, status: 'success', message: 'Sinh dòng kiểm kê thành công.', requestMeta, metadata: { generated_count: docs.length } });
  return getStocktakeDetail(stocktake._id, actor);
}

async function countStocktakeItem(stocktakeId, itemId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaff(actor);
  const stocktake = await StocktakeSession.findById(stocktakeId);
  if (!stocktake) throw createError('Không tìm thấy kỳ kiểm kê.', 404);
  if (![STOCKTAKE_STATUS.OPEN, STOCKTAKE_STATUS.COUNTING, STOCKTAKE_STATUS.REVIEW, STOCKTAKE_STATUS.DRAFT].includes(stocktake.status)) throw createError('Kỳ kiểm kê không còn nhận số đếm.', 409);
  const item = await StocktakeItem.findOne({ _id: itemId, stocktake_id: stocktake._id });
  if (!item) throw createError('Không tìm thấy dòng kiểm kê.', 404);
  const counted = Math.max(Number(payload.counted_quantity), 0);
  if (!Number.isFinite(counted)) throw createError('counted_quantity không hợp lệ.', 400);
  item.counted_quantity = counted;
  item.variance_quantity = counted - normalizeNumber(item.system_quantity);
  item.variance_value = item.variance_quantity * normalizeNumber(item.unit_cost);
  item.variance_reason = payload.variance_reason || payload.reason || item.variance_reason;
  item.note = payload.note || item.note;
  item.counted_by = actorId(actor);
  item.counted_at = new Date();
  item.status = STOCKTAKE_ITEM_STATUS.COUNTED;
  item.updated_by = actorId(actor);
  await item.save();
  if (stocktake.status === STOCKTAKE_STATUS.DRAFT) {
    stocktake.status = STOCKTAKE_STATUS.COUNTING;
    stocktake.started_at = stocktake.started_at || new Date();
    await stocktake.save();
  }
  await refreshStocktakeCounters(stocktake._id);
  await recordAuditLog({ actor, action: 'stocktake.item_count', targetType: 'stocktake_item', targetId: item._id, status: 'success', message: 'Ghi nhận số đếm kiểm kê thành công.', requestMeta });
  return getStocktakeDetail(stocktake._id, actor);
}

async function reviewStocktake(stocktakeId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaff(actor);
  const stocktake = await StocktakeSession.findById(stocktakeId);
  if (!stocktake) throw createError('Không tìm thấy kỳ kiểm kê.', 404);
  if (![STOCKTAKE_STATUS.COUNTING, STOCKTAKE_STATUS.OPEN, STOCKTAKE_STATUS.DRAFT].includes(stocktake.status)) throw createError('Kỳ kiểm kê không ở trạng thái review được.', 409);
  await StocktakeItem.updateMany({ stocktake_id: stocktake._id, status: STOCKTAKE_ITEM_STATUS.COUNTED }, { status: STOCKTAKE_ITEM_STATUS.REVIEWED, updated_by: actorId(actor) });
  stocktake.status = STOCKTAKE_STATUS.REVIEW;
  stocktake.reviewed_by = actorId(actor);
  stocktake.reviewed_at = new Date();
  stocktake.note = payload.note || stocktake.note;
  stocktake.updated_by = actorId(actor);
  await stocktake.save();
  await refreshStocktakeCounters(stocktake._id);
  await recordAuditLog({ actor, action: 'stocktake.review', targetType: 'stocktake', targetId: stocktake._id, status: 'success', message: 'Review kỳ kiểm kê thành công.', requestMeta });
  return getStocktakeDetail(stocktake._id, actor);
}

async function createStocktakeTransaction(item, batch, direction, quantity, actor, session) {
  const transactionNo = await generateBusinessCode(CODE_TYPE.INVENTORY_TRANSACTION, { session });
  const [transaction] = await InventoryTransaction.create([{
    medication_id: item.medication_id,
    stock_batch_id: item.stock_batch_id,
    transaction_no: transactionNo,
    transaction_type: INVENTORY_TRANSACTION_TYPE.ADJUSTMENT,
    direction,
    quantity,
    balance_after: batch.quantity_on_hand,
    unit_cost: batch.unit_cost,
    reference_type: 'stocktake',
    reference_id: item.stocktake_id,
    performed_by: actorId(actor),
    occurred_at: new Date(),
    note: item.variance_reason || 'Post adjustment từ kiểm kê',
    created_by: actorId(actor),
    updated_by: actorId(actor),
  }], sessionOptions(session));
  return transaction;
}

async function postStocktakeAdjustments(stocktakeId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaff(actor);
  if (!hasAnyPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN, PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT, PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Tài khoản hiện tại không có quyền post adjustment kiểm kê.', 403);
  }
  const transactionIds = [];
  await withOptionalTransaction(async (session) => {
    const stocktake = await withSession(StocktakeSession.findById(stocktakeId), session);
    if (!stocktake) throw createError('Không tìm thấy kỳ kiểm kê.', 404);
    if (stocktake.status === STOCKTAKE_STATUS.POSTED) throw createError('Kỳ kiểm kê đã post adjustment.', 409);
    if (stocktake.status === STOCKTAKE_STATUS.CANCELLED) throw createError('Kỳ kiểm kê đã hủy.', 409);
    const items = await withSession(StocktakeItem.find({
      stocktake_id: stocktake._id,
      status: { $in: [STOCKTAKE_ITEM_STATUS.COUNTED, STOCKTAKE_ITEM_STATUS.REVIEWED] },
      variance_quantity: { $ne: 0 },
    }), session);
    for (const item of items) {
      const batch = await withSession(StockBatch.findById(item.stock_batch_id), session);
      if (!batch || batch.is_deleted) throw createError('Không tìm thấy batch trong kỳ kiểm kê.', 404);
      const variance = normalizeNumber(item.variance_quantity);
      const nextQuantity = normalizeNumber(batch.quantity_on_hand) + variance;
      if (nextQuantity < 0) throw createError('Post kiểm kê làm tồn batch âm.', 409);
      batch.quantity_on_hand = nextQuantity;
      if (batch.quantity_on_hand <= 0 && batch.status === STOCK_BATCH_STATUS.AVAILABLE) {
        batch.status = STOCK_BATCH_STATUS.DEPLETED;
        batch.depleted_at = new Date();
        batch.depleted_by = actorId(actor);
        batch.depleted_reason = 'stocktake';
      }
      if (batch.quantity_on_hand > 0 && batch.status === STOCK_BATCH_STATUS.DEPLETED) {
        batch.status = STOCK_BATCH_STATUS.AVAILABLE;
        batch.depleted_at = undefined;
        batch.depleted_by = undefined;
        batch.depleted_reason = undefined;
      }
      batch.updated_by = actorId(actor);
      await batch.save(sessionOptions(session));
      const direction = variance > 0 ? INVENTORY_TRANSACTION_DIRECTION.IN : INVENTORY_TRANSACTION_DIRECTION.OUT;
      const transaction = await createStocktakeTransaction(item, batch, direction, Math.abs(variance), actor, session);
      transactionIds.push(transaction._id);
      batch.last_transaction_id = transaction._id;
      await batch.save(sessionOptions(session));
      item.status = STOCKTAKE_ITEM_STATUS.POSTED;
      item.updated_by = actorId(actor);
      await item.save(sessionOptions(session));
    }
    await StocktakeItem.updateMany(
      { stocktake_id: stocktake._id, status: { $in: [STOCKTAKE_ITEM_STATUS.COUNTED, STOCKTAKE_ITEM_STATUS.REVIEWED] }, variance_quantity: 0 },
      { status: STOCKTAKE_ITEM_STATUS.POSTED, updated_by: actorId(actor) },
      sessionOptions(session),
    );
    stocktake.status = STOCKTAKE_STATUS.POSTED;
    stocktake.posted_by = actorId(actor);
    stocktake.posted_at = new Date();
    stocktake.ended_at = new Date();
    stocktake.note = payload.note || stocktake.note;
    stocktake.updated_by = actorId(actor);
    await stocktake.save(sessionOptions(session));
    await refreshStocktakeCounters(stocktake._id, session);
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'stocktake.post_adjustments', targetType: 'stocktake', targetId: stocktakeId, status: 'success', message: 'Post adjustment kiểm kê thành công.', requestMeta, metadata: { transaction_ids: transactionIds } });
  return getStocktakeDetail(stocktakeId, actor);
}

async function cancelStocktake(stocktakeId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaff(actor);
  const stocktake = await StocktakeSession.findById(stocktakeId);
  if (!stocktake) throw createError('Không tìm thấy kỳ kiểm kê.', 404);
  if (stocktake.status === STOCKTAKE_STATUS.POSTED) throw createError('Không hủy kỳ kiểm kê đã post.', 409);
  stocktake.status = STOCKTAKE_STATUS.CANCELLED;
  stocktake.ended_at = new Date();
  stocktake.note = payload.reason || payload.note || stocktake.note;
  stocktake.updated_by = actorId(actor);
  await stocktake.save();
  await recordAuditLog({ actor, action: 'stocktake.cancel', targetType: 'stocktake', targetId: stocktake._id, status: 'success', message: 'Hủy kỳ kiểm kê thành công.', requestMeta });
  return getStocktakeDetail(stocktake._id, actor);
}

async function createAlert(payload = {}, actor = {}) {
  assertAlertManage(actor);
  const code = payload.alert_code || await generateSequenceCode(PharmacyAlert, 'alert_code', 'PAL', { sequenceWidth: 4 });
  const alert = await PharmacyAlert.create({
    ...payload,
    alert_code: code,
    created_by: actorId(actor),
    updated_by: actorId(actor),
  });
  await recordAuditLog({ actor, action: 'pharmacy_alert.create', targetType: 'pharmacy_alert', targetId: alert._id, status: 'success', message: 'Tạo cảnh báo dược thành công.' });
  return getAlertDetail(alert._id, actor);
}

async function listAlerts(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  for (const field of ['alert_type', 'severity', 'status', 'assigned_to', 'medication_id', 'stock_batch_id', 'prescription_id', 'dispense_id']) {
    if (query[field]) filter[field] = field.endsWith('_id') || field === 'assigned_to' ? toObjectId(query[field], field) : query[field];
  }
  if (query.open === 'true') filter.status = { $in: OPEN_ALERT_STATUSES };
  if (query.search) {
    const pattern = escapeRegex(query.search);
    filter.$or = [
      { alert_code: { $regex: pattern, $options: 'i' } },
      { title: { $regex: pattern, $options: 'i' } },
      { message: { $regex: pattern, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    PharmacyAlert.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('medication_id', 'medication_code generic_name brand_name strength')
      .populate('stock_batch_id', 'batch_no lot_no expiry_date quantity_on_hand status')
      .populate('prescription_id', 'prescription_no status')
      .populate('dispense_id', 'dispense_no status')
      .populate('patient_id', 'patient_code full_name')
      .populate('assigned_to', 'full_name username employee_code')
      .lean(),
    PharmacyAlert.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getAlertDetail(alertId, actor = {}) {
  assertPharmacyRead(actor);
  const alert = await PharmacyAlert.findById(alertId)
    .populate('medication_id', 'medication_code generic_name brand_name strength')
    .populate('stock_batch_id', 'batch_no lot_no expiry_date quantity_on_hand status')
    .populate('prescription_id', 'prescription_no status')
    .populate('dispense_id', 'dispense_no status')
    .populate('patient_id', 'patient_code full_name')
    .populate('assigned_to', 'full_name username employee_code')
    .populate('acknowledged_by', 'full_name username employee_code')
    .populate('resolved_by', 'full_name username employee_code')
    .lean();
  if (!alert) throw createError('Không tìm thấy cảnh báo dược.', 404);
  return { alert };
}

async function updateAlert(alertId, updates = {}, actor = {}, action = 'pharmacy_alert.update') {
  assertAlertManage(actor);
  const alert = await PharmacyAlert.findById(alertId);
  if (!alert) throw createError('Không tìm thấy cảnh báo dược.', 404);
  Object.assign(alert, updates, { updated_by: actorId(actor) });
  await alert.save();
  await recordAuditLog({ actor, action, targetType: 'pharmacy_alert', targetId: alert._id, status: 'success', message: 'Cập nhật cảnh báo dược thành công.' });
  return getAlertDetail(alert._id, actor);
}

function acknowledgeAlert(alertId, payload = {}, actor = {}) {
  return updateAlert(alertId, {
    status: 'acknowledged',
    acknowledged_by: actorId(actor),
    acknowledged_at: new Date(),
    resolution_note: payload.note,
  }, actor, 'pharmacy_alert.acknowledge');
}

function assignAlert(alertId, payload = {}, actor = {}) {
  const assignedTo = payload.assigned_to || payload.user_id || actorId(actor);
  if (!assignedTo) throw createError('assigned_to là bắt buộc.', 400);
  return updateAlert(alertId, {
    status: 'assigned',
    assigned_to: toObjectId(assignedTo, 'assigned_to'),
  }, actor, 'pharmacy_alert.assign');
}

function startAlert(alertId, payload = {}, actor = {}) {
  return updateAlert(alertId, { status: 'in_progress', resolution_note: payload.note }, actor, 'pharmacy_alert.start');
}

function resolveAlert(alertId, payload = {}, actor = {}) {
  return updateAlert(alertId, {
    status: 'resolved',
    resolved_by: actorId(actor),
    resolved_at: new Date(),
    resolution_note: payload.resolution_note || payload.note,
  }, actor, 'pharmacy_alert.resolve');
}

function dismissAlert(alertId, payload = {}, actor = {}) {
  return updateAlert(alertId, {
    status: 'dismissed',
    resolved_by: actorId(actor),
    resolved_at: new Date(),
    resolution_note: payload.reason || payload.note,
  }, actor, 'pharmacy_alert.dismiss');
}

async function createWorkItem(payload = {}, actor = {}) {
  assertWorkItemManage(actor);
  const code = payload.work_item_code || await generateSequenceCode(PharmacyWorkItem, 'work_item_code', 'PWI', { sequenceWidth: 4 });
  const item = await PharmacyWorkItem.create({
    ...payload,
    work_item_code: code,
    created_by: actorId(actor),
    updated_by: actorId(actor),
  });
  await recordAuditLog({ actor, action: 'pharmacy_work_item.create', targetType: 'pharmacy_work_item', targetId: item._id, status: 'success', message: 'Tạo việc nhà thuốc thành công.' });
  return getWorkItemDetail(item._id, actor);
}

async function listWorkItems(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  for (const field of ['type', 'priority', 'status', 'assigned_to', 'patient_id', 'prescription_id', 'dispense_id', 'medication_id', 'stock_batch_id']) {
    if (query[field]) filter[field] = field.endsWith('_id') || field === 'assigned_to' ? toObjectId(query[field], field) : query[field];
  }
  if (query.open === 'true') filter.status = { $in: OPEN_WORK_ITEM_STATUSES };
  if (query.search) {
    const pattern = escapeRegex(query.search);
    filter.$or = [
      { work_item_code: { $regex: pattern, $options: 'i' } },
      { title: { $regex: pattern, $options: 'i' } },
      { description: { $regex: pattern, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    PharmacyWorkItem.find(filter)
      .sort({ priority: 1, due_at: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('prescription_id', 'prescription_no status')
      .populate('dispense_id', 'dispense_no status')
      .populate('medication_id', 'medication_code generic_name brand_name strength')
      .populate('stock_batch_id', 'batch_no lot_no expiry_date quantity_on_hand status')
      .populate('assigned_to', 'full_name username employee_code')
      .lean(),
    PharmacyWorkItem.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getWorkItemDetail(workItemId, actor = {}) {
  assertPharmacyRead(actor);
  const work_item = await PharmacyWorkItem.findById(workItemId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender')
    .populate('prescription_id', 'prescription_no status')
    .populate('dispense_id', 'dispense_no status')
    .populate('medication_id', 'medication_code generic_name brand_name strength')
    .populate('stock_batch_id', 'batch_no lot_no expiry_date quantity_on_hand status')
    .populate('assigned_to', 'full_name username employee_code')
    .lean();
  if (!work_item) throw createError('Không tìm thấy việc nhà thuốc.', 404);
  return { work_item };
}

async function updateWorkItem(workItemId, updates = {}, actor = {}, action = 'pharmacy_work_item.update') {
  assertWorkItemManage(actor);
  const item = await PharmacyWorkItem.findById(workItemId);
  if (!item) throw createError('Không tìm thấy việc nhà thuốc.', 404);
  Object.assign(item, updates, { updated_by: actorId(actor) });
  await item.save();
  await recordAuditLog({ actor, action, targetType: 'pharmacy_work_item', targetId: item._id, status: 'success', message: 'Cập nhật việc nhà thuốc thành công.' });
  return getWorkItemDetail(item._id, actor);
}

function assignWorkItem(workItemId, payload = {}, actor = {}) {
  const assignedTo = payload.assigned_to || payload.user_id || actorId(actor);
  if (!assignedTo) throw createError('assigned_to là bắt buộc.', 400);
  return updateWorkItem(workItemId, {
    status: 'assigned',
    assigned_to: toObjectId(assignedTo, 'assigned_to'),
    assigned_at: new Date(),
  }, actor, 'pharmacy_work_item.assign');
}

function startWorkItem(workItemId, payload = {}, actor = {}) {
  return updateWorkItem(workItemId, { status: 'in_progress', metadata: { ...(payload.metadata || {}), start_note: payload.note } }, actor, 'pharmacy_work_item.start');
}

function holdWorkItem(workItemId, payload = {}, actor = {}) {
  return updateWorkItem(workItemId, { status: 'on_hold', metadata: { ...(payload.metadata || {}), hold_reason: payload.reason || payload.note } }, actor, 'pharmacy_work_item.hold');
}

function escalateWorkItem(workItemId, payload = {}, actor = {}) {
  return updateWorkItem(workItemId, { priority: payload.priority || 'critical', metadata: { ...(payload.metadata || {}), escalate_reason: payload.reason || payload.note } }, actor, 'pharmacy_work_item.escalate');
}

function resolveWorkItem(workItemId, payload = {}, actor = {}) {
  return updateWorkItem(workItemId, {
    status: 'resolved',
    resolved_by: actorId(actor),
    resolved_at: new Date(),
    metadata: { ...(payload.metadata || {}), resolution_note: payload.resolution_note || payload.note },
  }, actor, 'pharmacy_work_item.resolve');
}

function cancelWorkItem(workItemId, payload = {}, actor = {}) {
  return updateWorkItem(workItemId, {
    status: 'cancelled',
    resolved_by: actorId(actor),
    resolved_at: new Date(),
    metadata: { ...(payload.metadata || {}), cancel_reason: payload.reason || payload.note },
  }, actor, 'pharmacy_work_item.cancel');
}

module.exports = {
  getDashboard,
  getPrescriptionWorkbench,
  getPrescriptionRiskQueue,
  getWorkQueue,
  getDispensingToday,
  getAlerts,
  getPerformance,
  getCurrentStock,
  getMedicationSummary,
  getExpiryRisk,
  listStocktakes,
  getStocktakeDetail,
  createStocktake,
  startStocktake,
  generateStocktakeItems,
  countStocktakeItem,
  reviewStocktake,
  postStocktakeAdjustments,
  cancelStocktake,
  createAlert,
  listAlerts,
  getAlertDetail,
  acknowledgeAlert,
  assignAlert,
  startAlert,
  resolveAlert,
  dismissAlert,
  createWorkItem,
  listWorkItems,
  getWorkItemDetail,
  assignWorkItem,
  startWorkItem,
  holdWorkItem,
  escalateWorkItem,
  resolveWorkItem,
  cancelWorkItem,
};
