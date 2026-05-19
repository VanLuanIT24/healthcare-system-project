const { Types } = require('mongoose');
const {
  ClinicalAlert,
  Dispense,
  InventoryTransaction,
  MedicationMaster,
  MedicationReactionObservation,
  PharmacyAlert,
  PharmacyAlertActionLog,
  PharmacyAlertAssignment,
  PharmacyAlertResolution,
  PharmacyAlertSnooze,
  PrescriptionItem,
  StockBatch,
} = require('../models');
const { PERMISSION, ROLE_CODE } = require('../constants/permissions');
const {
  INVENTORY_TRANSACTION_DIRECTION,
  INVENTORY_TRANSACTION_TYPE,
  MEDICATION_STATUS,
  PRESCRIPTION_ITEM_STATUS,
  PRESCRIPTION_STATUS,
  REALTIME_EVENT_TYPE,
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
  recordAuditLog,
} = require('./core.service');
const { generateSequenceCode } = require('./code-generator.service');
const eventBus = require('../events/event-bus.service');

const DEFAULT_LIMIT = 30;
const OPEN_ALERT_STATUSES = ['new', 'open', 'acknowledged', 'assigned', 'in_progress', 'snoozed', 'escalated'];
const CLOSED_ALERT_STATUSES = ['resolved', 'dismissed'];
const ALERT_RECIPIENT_ROLES = [ROLE_CODE.PHARMACIST, ROLE_CODE.INVENTORY_STAFF, ROLE_CODE.ADMIN].filter(Boolean);
const MEDICATION_SELECT = 'medication_code generic_name brand_name dosage_form strength route_default unit sale_price min_stock_level status high_alert_medication controlled_drug';
const BATCH_SELECT = 'batch_no lot_no supplier_name manufacture_date expiry_date received_date quantity_received quantity_on_hand unit_cost min_stock_level warehouse_id storage_location_id storage_location status recall_reason quarantine_reason';

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions.filter(Boolean));
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function actorId(actor = {}) {
  return actor.userId || actor.actorId || actor.actor_id || actor.user_id || actor.id || actor.user?.id || actor.user?._id || null;
}

function assertStaff(actor = {}) {
  if (actorType(actor) !== 'staff') {
    throw createError('Chỉ tài khoản nhân sự được truy cập cảnh báo dược.', 403);
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
    PERMISSION.MEDICATION_ADMINISTRATIONS.READ,
  ])) {
    throw createError('Tài khoản hiện tại không có quyền xem cảnh báo dược.', 403);
  }
}

function assertAlertManage(actor = {}) {
  assertStaff(actor);
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS])) return;
  if (!hasAnyPermission(actor, [
    PERMISSION.PRESCRIPTIONS.VERIFY,
    PERMISSION.DISPENSES.CREATE,
    PERMISSION.DISPENSES.COMPLETE,
    PERMISSION.STOCK_BATCHES.READ,
    PERMISSION.INVENTORY_TRANSACTIONS.READ,
    PERMISSION.INVENTORY_TRANSACTIONS.READ_RELATED,
  ])) {
    throw createError('Tài khoản hiện tại không có quyền xử lý cảnh báo dược.', 403);
  }
}

function normalizeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(normalizeNumber(value) * factor) / factor;
}

function cleanObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
}

function parseDate(value, fieldName = 'date') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function isObjectIdLike(value) {
  return value instanceof Types.ObjectId
    || Boolean(value && typeof value === 'object' && typeof value.toHexString === 'function');
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (isObjectIdLike(value)) return value;
  if (!Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(value);
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

function optionalObjectId(value) {
  const id = toPlainId(value);
  return id && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : undefined;
}

function preserveMissingRef(doc, id) {
  return doc || id || null;
}

function hasPopulatedDocument(value) {
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
  return person.full_name || person.name || person.patient_code || person.username || fallback;
}

function formatDateOnly(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const first = new Date(start);
  const second = new Date(end);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return null;
  return Math.ceil((second.getTime() - first.getTime()) / 86400000);
}

function buildRange(query = {}, defaultDays = 30) {
  const explicitStart = parseDate(query.date_from || query.from, 'date_from');
  const explicitEnd = parseDate(query.date_to || query.to, 'date_to');
  if (explicitStart || explicitEnd) return { start: explicitStart, end: explicitEnd || new Date() };

  if (query.date) {
    const date = parseDate(query.date, 'date');
    return { start: getStartOfDay(date), end: getEndOfDay(date) };
  }

  const range = String(query.range || '').toLowerCase();
  const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : range === '30d' ? 30 : Number(query.days || defaultDays);
  const end = new Date();
  const start = getStartOfDay(new Date(end.getTime() - (Math.max(days, 1) - 1) * 86400000));
  return { start, end };
}

function regexFilter(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return { $regex: escapeRegex(normalized), $options: 'i' };
}

function matchesSearch(parts = [], search = '') {
  const term = String(search || '').trim().toLowerCase();
  if (!term) return true;
  return parts.filter(Boolean).join(' ').toLowerCase().includes(term);
}

function severityRank(severity) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[severity] ?? 9;
}

function statusRank(status) {
  return {
    new: 0,
    open: 1,
    escalated: 2,
    assigned: 3,
    in_progress: 4,
    acknowledged: 5,
    snoozed: 6,
    resolved: 7,
    dismissed: 8,
  }[status] ?? 9;
}

function buildDueAt(severity, detectedAt = new Date()) {
  const minutes = { critical: 60, high: 240, medium: 1440, low: 4320 }[severity] || 1440;
  return new Date(new Date(detectedAt).getTime() + minutes * 60000);
}

function severityFromDays(days) {
  if (days !== null && days <= 0) return 'critical';
  if (days !== null && days <= 7) return 'critical';
  if (days !== null && days <= 30) return 'high';
  if (days !== null && days <= 90) return 'medium';
  return 'low';
}

function severityFromShortage({ available, minStock, pendingDemand = 0, daysLeft = null }) {
  if (available <= 0 && pendingDemand > 0) return 'critical';
  if (available <= 0) return 'high';
  if (daysLeft !== null && daysLeft <= 3) return 'critical';
  if (pendingDemand > available) return 'critical';
  if (minStock > 0 && available <= minStock * 0.5) return 'high';
  if (minStock > 0 && available <= minStock) return 'medium';
  return 'low';
}

function normalizeAlertType(type) {
  const map = {
    near_expiry: 'batch_expiring',
    expired: 'batch_expired',
    insufficient_stock: 'dispense_shortage',
    allergy: 'allergy_conflict',
    waste: 'waste_loss',
    recalled: 'recall',
    quarantined: 'quarantine',
  };
  return map[type] || type;
}

function legacyAlertType(type) {
  const map = {
    batch_expiring: 'near_expiry',
    batch_expired: 'expired',
    dispense_shortage: 'insufficient_stock',
    allergy_conflict: 'allergy',
    medication_reaction: 'allergy',
    waste_loss: 'waste',
    recall: 'recalled',
    quarantine: 'quarantined',
  };
  return map[type] || type;
}

function normalizeAlertDocument(alert = {}, snapshot = {}) {
  const plain = alert.toObject ? alert.toObject() : alert;
  const metadata = { ...(snapshot.metadata || {}), ...(plain.metadata || {}) };
  const metrics = { ...(snapshot.metrics || {}), ...(plain.metrics || {}) };
  return {
    ...snapshot,
    ...plain,
    id: toPlainId(plain._id || plain.id || snapshot.id),
    alert_id: toPlainId(plain._id || plain.id || snapshot.alert_id),
    alert_type: normalizeAlertType(plain.alert_type || snapshot.alert_type),
    legacy_alert_type: legacyAlertType(plain.alert_type || snapshot.alert_type),
    status: plain.status || snapshot.status || 'open',
    severity: plain.severity || snapshot.severity || 'medium',
    detected_at: plain.detected_at || snapshot.detected_at || plain.created_at || snapshot.created_at,
    due_at: plain.due_at || snapshot.due_at,
    medication_id: plain.medication_id || snapshot.medication_id,
    stock_batch_id: plain.stock_batch_id || snapshot.stock_batch_id,
    prescription_id: plain.prescription_id || snapshot.prescription_id,
    prescription_item_id: plain.prescription_item_id || snapshot.prescription_item_id,
    dispense_id: plain.dispense_id || snapshot.dispense_id,
    patient_id: plain.patient_id || snapshot.patient_id,
    metrics,
    metadata,
    persisted: true,
  };
}

async function publishAlertEvent(eventType, alert, actor = {}, payload = {}) {
  if (!eventType || !alert?._id) return;
  await eventBus.publishDomainEvent({
    eventType,
    aggregateType: 'pharmacy_alert',
    aggregateId: alert._id,
    actor: actorId(actor) ? { user_id: actorId(actor), actor_type: actorType(actor) } : undefined,
    recipientScope: { roles: ALERT_RECIPIENT_ROLES },
    payload: {
      alert_id: toPlainId(alert._id),
      alert_code: alert.alert_code,
      alert_type: normalizeAlertType(alert.alert_type),
      severity: alert.severity,
      status: alert.status,
      title: alert.title,
      ...payload,
    },
    idempotencyKey: `${eventType}:${toPlainId(alert._id)}:${alert.status}:${new Date(alert.updated_at || Date.now()).getTime()}`,
  }, { publishImmediately: false });
}

async function ensureMaterializedAlert(snapshot = {}, actor = {}) {
  if (!snapshot.dedupe_key) return snapshot;
  const now = new Date();
  const existing = await PharmacyAlert.findOne({ dedupe_key: snapshot.dedupe_key });
  const alertType = legacyAlertType(snapshot.alert_type);
  const update = cleanObject({
    alert_type: alertType,
    severity: snapshot.severity || 'medium',
    source_type: snapshot.source_type,
    source_module: snapshot.source_module || 'pharmacy_alerts',
    source_id: optionalObjectId(snapshot.source_id),
    medication_id: optionalObjectId(snapshot.medication_id),
    stock_batch_id: optionalObjectId(snapshot.stock_batch_id),
    prescription_id: optionalObjectId(snapshot.prescription_id),
    prescription_item_id: optionalObjectId(snapshot.prescription_item_id),
    dispense_id: optionalObjectId(snapshot.dispense_id),
    dispense_item_id: optionalObjectId(snapshot.dispense_item_id),
    patient_id: optionalObjectId(snapshot.patient_id),
    encounter_id: optionalObjectId(snapshot.encounter_id),
    admission_id: optionalObjectId(snapshot.admission_id),
    title: snapshot.title,
    message: snapshot.message,
    reason_code: snapshot.reason_code,
    detected_at: snapshot.detected_at || now,
    due_at: snapshot.due_at || buildDueAt(snapshot.severity, snapshot.detected_at || now),
    metrics: snapshot.metrics || {},
    metadata: snapshot.metadata || {},
    updated_by: actorId(actor),
  });

  if (existing) {
    const currentStatus = existing.status === 'snoozed' && existing.snoozed_until && existing.snoozed_until <= now
      ? 'open'
      : existing.status;
    Object.assign(existing, update, { status: currentStatus });
    await existing.save();
    return normalizeAlertDocument(existing, snapshot);
  }

  const alertCode = await generateSequenceCode(PharmacyAlert, 'alert_code', 'PAL', { sequenceWidth: 4 });
  try {
    const created = await PharmacyAlert.create({
      ...update,
      alert_code: alertCode,
      status: snapshot.status || 'open',
      dedupe_key: snapshot.dedupe_key,
      created_by: actorId(actor),
    });
    await publishAlertEvent(REALTIME_EVENT_TYPE.PHARMACY_ALERT_CREATED, created, actor);
    return normalizeAlertDocument(created, snapshot);
  } catch (error) {
    if (error?.code === 11000) {
      const duplicated = await PharmacyAlert.findOne({ dedupe_key: snapshot.dedupe_key });
      if (duplicated) return normalizeAlertDocument(duplicated, snapshot);
    }
    throw error;
  }
}

async function materializeSnapshots(snapshots = [], actor = {}, query = {}) {
  if (String(query.materialize || 'true') === 'false') {
    return snapshots.map((item) => ({ ...item, id: item.id || item.dedupe_key, persisted: false }));
  }
  const rows = [];
  for (const snapshot of snapshots) {
    rows.push(await ensureMaterializedAlert(snapshot, actor));
  }
  return rows;
}

function applyCommonFilters(items = [], query = {}) {
  const requestedType = normalizeAlertType(query.alert_type || query.type || '');
  const search = String(query.search || query.q || '').trim();
  return items.filter((item) => {
    if (requestedType && normalizeAlertType(item.alert_type) !== requestedType) return false;
    if (query.severity && item.severity !== query.severity) return false;
    if (query.status && item.status !== query.status) return false;
    if (String(query.open || '').toLowerCase() === 'true' && !OPEN_ALERT_STATUSES.includes(item.status)) return false;
    return matchesSearch([
      item.title,
      item.message,
      item.medication?.medication_code,
      item.medication?.generic_name,
      item.medication?.brand_name,
      item.batch?.batch_no,
      item.batch?.lot_no,
      item.patient?.patient_code,
      item.patient?.full_name,
      item.reference_no,
      item.metadata?.batch_no,
      item.metadata?.lot_no,
    ], search);
  });
}

function buildSummary(items = {}, extra = {}) {
  const now = new Date();
  const rows = Array.isArray(items) ? items : [];
  const openRows = rows.filter((item) => !CLOSED_ALERT_STATUSES.includes(item.status));
  return {
    total: rows.length,
    total_open: openRows.length,
    critical: rows.filter((item) => item.severity === 'critical').length,
    high: rows.filter((item) => item.severity === 'high').length,
    medium: rows.filter((item) => item.severity === 'medium').length,
    low: rows.filter((item) => item.severity === 'low').length,
    new: rows.filter((item) => ['new', 'open'].includes(item.status)).length,
    acknowledged: rows.filter((item) => item.status === 'acknowledged').length,
    assigned: rows.filter((item) => item.status === 'assigned').length,
    in_progress: rows.filter((item) => item.status === 'in_progress').length,
    snoozed: rows.filter((item) => item.status === 'snoozed').length,
    unresolved: rows.filter((item) => !CLOSED_ALERT_STATUSES.includes(item.status)).length,
    over_sla: rows.filter((item) => item.due_at && new Date(item.due_at) < now && !CLOSED_ALERT_STATUSES.includes(item.status)).length,
    resolved_today: rows.filter((item) => item.status === 'resolved' && item.resolved_at && new Date(item.resolved_at) >= getStartOfDay(now)).length,
    ...extra,
  };
}

function buildKanban(items = []) {
  const columns = {
    new: [],
    acknowledged: [],
    in_progress: [],
    waiting: [],
    resolved: [],
    dismissed: [],
  };
  for (const item of items) {
    if (['resolved'].includes(item.status)) columns.resolved.push(item);
    else if (['dismissed'].includes(item.status)) columns.dismissed.push(item);
    else if (['snoozed', 'assigned'].includes(item.status)) columns.waiting.push(item);
    else if (['in_progress', 'escalated'].includes(item.status)) columns.in_progress.push(item);
    else if (['acknowledged'].includes(item.status)) columns.acknowledged.push(item);
    else columns.new.push(item);
  }
  return columns;
}

function finalizeBoard(boardType, query = {}, items = [], extraSummary = {}, extra = {}) {
  const filtered = applyCommonFilters(items, { ...query, type: boardType })
    .sort((a, b) =>
      severityRank(a.severity) - severityRank(b.severity)
      || statusRank(a.status) - statusRank(b.status)
      || new Date(a.due_at || a.detected_at || 0).getTime() - new Date(b.due_at || b.detected_at || 0).getTime());
  const { page, limit, skip } = getPagination(query, DEFAULT_LIMIT, 100);
  const paginated = filtered.slice(skip, skip + limit);
  return {
    board_type: boardType,
    generated_at: new Date(),
    realtime: {
      active: true,
      events: [
        'pharmacy.alert.created',
        'pharmacy.alert.updated',
        'pharmacy.alert.acknowledged',
        'pharmacy.alert.assigned',
        'pharmacy.alert.resolved',
        'inventory.low_stock',
        'inventory.drug_expiring',
      ],
      rooms: ['role:pharmacist', 'role:inventory_staff', 'role:admin'],
    },
    summary: buildSummary(filtered, extraSummary),
    items: paginated,
    kanban: buildKanban(filtered),
    pagination: buildPagination(page, limit, filtered.length),
    ...extra,
  };
}

async function getUsageStatsByMedication() {
  const now = new Date();
  const start30 = new Date(now.getTime() - 30 * 86400000);
  const start7 = new Date(now.getTime() - 7 * 86400000);
  const today = getStartOfDay(now);
  const rows = await InventoryTransaction.aggregate([
    {
      $match: {
        direction: INVENTORY_TRANSACTION_DIRECTION.OUT,
        transaction_type: { $in: [INVENTORY_TRANSACTION_TYPE.DISPENSE, INVENTORY_TRANSACTION_TYPE.ISSUE] },
        occurred_at: { $gte: start30, $lte: now },
      },
    },
    {
      $group: {
        _id: '$medication_id',
        usage_today: { $sum: { $cond: [{ $gte: ['$occurred_at', today] }, '$quantity', 0] } },
        usage_7d: { $sum: { $cond: [{ $gte: ['$occurred_at', start7] }, '$quantity', 0] } },
        usage_30d: { $sum: '$quantity' },
      },
    },
  ]);
  return new Map(rows.map((row) => [toPlainId(row._id), {
    usage_today: normalizeNumber(row.usage_today),
    usage_7d: normalizeNumber(row.usage_7d),
    usage_30d: normalizeNumber(row.usage_30d),
    avg_daily_usage_7d: round(normalizeNumber(row.usage_7d) / 7, 2),
    avg_daily_usage_30d: round(normalizeNumber(row.usage_30d) / 30, 2),
  }]));
}

async function getPendingDemandByMedication() {
  const rows = await PrescriptionItem.aggregate([
    { $match: { status: { $in: [PRESCRIPTION_ITEM_STATUS.ACTIVE, PRESCRIPTION_ITEM_STATUS.HELD] } } },
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
        prescription_id: 1,
        patient_id: '$prescription.patient_id',
        remaining_quantity: {
          $cond: [
            { $gt: [{ $subtract: ['$quantity', '$dispensed_quantity'] }, 0] },
            { $subtract: ['$quantity', '$dispensed_quantity'] },
            0,
          ],
        },
      },
    },
    { $match: { remaining_quantity: { $gt: 0 } } },
    {
      $group: {
        _id: '$medication_id',
        pending_demand: { $sum: '$remaining_quantity' },
        affected_prescriptions: { $addToSet: '$prescription_id' },
        affected_patients: { $addToSet: '$patient_id' },
      },
    },
  ]);
  return new Map(rows.map((row) => [toPlainId(row._id), {
    pending_demand: normalizeNumber(row.pending_demand),
    affected_prescriptions: (row.affected_prescriptions || []).filter(Boolean).map(toPlainId),
    affected_patients: (row.affected_patients || []).filter(Boolean).map(toPlainId),
  }]));
}

function batchSnapshot(batch = {}) {
  const id = toPlainId(batch);
  if (!id) return null;
  if (!hasPopulatedDocument(batch)) return { id };
  return {
    id,
    batch_no: batch.batch_no,
    lot_no: batch.lot_no,
    expiry_date: batch.expiry_date,
    days_to_expiry: batch.expiry_date ? daysBetween(new Date(), batch.expiry_date) : null,
    quantity_on_hand: normalizeNumber(batch.quantity_on_hand),
    quantity_received: normalizeNumber(batch.quantity_received),
    unit_cost: normalizeNumber(batch.unit_cost),
    min_stock_level: normalizeNumber(batch.min_stock_level),
    value_at_risk: normalizeNumber(batch.quantity_on_hand) * normalizeNumber(batch.unit_cost),
    storage_location: batch.storage_location,
    supplier_name: batch.supplier_name,
    status: batch.status,
  };
}

async function loadMedicationStockContext(query = {}) {
  const batchFilter = { is_deleted: false };
  if (query.medication_id) batchFilter.medication_id = toObjectId(query.medication_id, 'medication_id');
  if (query.warehouse_id) batchFilter.warehouse_id = toObjectId(query.warehouse_id, 'warehouse_id');
  const locationRegex = regexFilter(query.storage_location || query.location);
  if (locationRegex) batchFilter.storage_location = locationRegex;
  const supplierRegex = regexFilter(query.supplier_name || query.supplier);
  if (supplierRegex) batchFilter.supplier_name = supplierRegex;

  const batches = await StockBatch.find(batchFilter)
    .limit(5000)
    .populate('medication_id', MEDICATION_SELECT)
    .lean();

  const groups = new Map();
  const now = new Date();
  for (const batch of batches) {
    const medication = batch.medication_id;
    const medicationId = toPlainId(medication?._id || medication);
    if (!medicationId || !medication?._id) continue;
    if (medication.status && medication.status !== MEDICATION_STATUS.ACTIVE) continue;
    if (!matchesSearch([
      medication.medication_code,
      medication.generic_name,
      medication.brand_name,
      medication.strength,
      batch.batch_no,
      batch.lot_no,
      batch.storage_location,
      batch.supplier_name,
    ], query.search || query.q)) continue;

    if (!groups.has(medicationId)) {
      groups.set(medicationId, {
        medication,
        medication_id: medicationId,
        batches: [],
        available_batches: [],
        blocked_batches: [],
        depleted_batches: [],
        total_on_hand: 0,
        available_on_hand: 0,
        blocked_on_hand: 0,
      });
    }
    const group = groups.get(medicationId);
    const quantity = normalizeNumber(batch.quantity_on_hand);
    const isAvailable = batch.status === STOCK_BATCH_STATUS.AVAILABLE
      && quantity > 0
      && (!batch.expiry_date || new Date(batch.expiry_date) >= now);
    const isBlocked = [
      STOCK_BATCH_STATUS.EXPIRED,
      STOCK_BATCH_STATUS.RECALLED,
      STOCK_BATCH_STATUS.QUARANTINED,
    ].includes(batch.status) || (batch.expiry_date && new Date(batch.expiry_date) < now);

    group.batches.push(batch);
    group.total_on_hand += quantity;
    if (isAvailable) {
      group.available_on_hand += quantity;
      group.available_batches.push(batch);
    } else if (isBlocked && quantity > 0) {
      group.blocked_on_hand += quantity;
      group.blocked_batches.push(batch);
    } else if (batch.status === STOCK_BATCH_STATUS.DEPLETED || quantity <= 0) {
      group.depleted_batches.push(batch);
    }
  }

  return [...groups.values()].map((group) => {
    const batchMin = Math.max(0, ...group.batches.map((batch) => normalizeNumber(batch.min_stock_level)));
    const minStock = normalizeNumber(group.medication?.min_stock_level) || batchMin;
    return {
      ...group,
      min_stock_level: minStock,
      available_batches: group.available_batches.sort((a, b) => new Date(a.expiry_date || '9999-12-31') - new Date(b.expiry_date || '9999-12-31')),
    };
  });
}

function buildStockMedicationItem(group, usage = {}, demand = {}, alertType = 'low_stock') {
  const medication = group.medication || {};
  const available = normalizeNumber(group.available_on_hand);
  const minStock = normalizeNumber(group.min_stock_level);
  const shortage = Math.max(minStock - available, 0);
  const avgDaily = normalizeNumber(usage.avg_daily_usage_30d) || normalizeNumber(usage.avg_daily_usage_7d);
  const daysLeft = avgDaily > 0 ? round(available / avgDaily, 1) : null;
  const pendingDemand = normalizeNumber(demand.pending_demand);
  const severity = severityFromShortage({ available, minStock, pendingDemand, daysLeft });
  const affectedPrescriptions = demand.affected_prescriptions || [];
  const batchRows = group.batches.map(batchSnapshot);
  const availableBatches = group.available_batches.map(batchSnapshot);
  const blockedBatches = group.blocked_batches.map(batchSnapshot);

  return {
    alert_type: alertType,
    severity,
    status: 'open',
    source_type: 'medication',
    source_module: 'pharmacy_inventory',
    source_id: group.medication_id,
    medication_id: group.medication_id,
    title: alertType === 'out_of_stock' ? 'Thuốc hết tồn khả dụng' : 'Thuốc dưới ngưỡng tồn',
    message: `${medicationName(medication)} còn ${available}, ngưỡng ${minStock || '--'}, nhu cầu chờ ${pendingDemand}.`,
    reason_code: alertType === 'out_of_stock' ? 'NO_AVAILABLE_STOCK' : 'LOW_STOCK_THRESHOLD',
    dedupe_key: `${alertType}:${group.medication_id}`,
    detected_at: new Date(),
    due_at: buildDueAt(severity),
    medication: {
      id: group.medication_id,
      medication_code: medication.medication_code,
      generic_name: medication.generic_name,
      brand_name: medication.brand_name,
      dosage_form: medication.dosage_form,
      strength: medication.strength,
      route_default: medication.route_default,
      unit: medication.unit,
      sale_price: medication.sale_price,
      status: medication.status,
      high_alert_medication: medication.high_alert_medication,
      controlled_drug: medication.controlled_drug,
    },
    inventory: {
      total_on_hand: group.total_on_hand,
      available_on_hand: available,
      blocked_on_hand: group.blocked_on_hand,
      min_stock_level: minStock,
      shortage_quantity: shortage,
      batches: batchRows,
      available_batches: availableBatches,
      blocked_batches: blockedBatches,
      depleted_batches: group.depleted_batches.map(batchSnapshot),
    },
    usage: {
      usage_today: normalizeNumber(usage.usage_today),
      usage_7d: normalizeNumber(usage.usage_7d),
      usage_30d: normalizeNumber(usage.usage_30d),
      avg_daily_usage_7d: normalizeNumber(usage.avg_daily_usage_7d),
      avg_daily_usage_30d: normalizeNumber(usage.avg_daily_usage_30d),
      days_of_stock_left: daysLeft,
    },
    impact: {
      pending_demand: pendingDemand,
      affected_prescription_count: affectedPrescriptions.length,
      affected_patient_count: (demand.affected_patients || []).length,
      affected_prescriptions: affectedPrescriptions.slice(0, 10),
    },
    metrics: {
      total_on_hand: group.total_on_hand,
      available_on_hand: available,
      blocked_on_hand: group.blocked_on_hand,
      min_stock_level: minStock,
      shortage_quantity: shortage,
      pending_demand: pendingDemand,
      days_of_stock_left: daysLeft,
      usage_today: normalizeNumber(usage.usage_today),
      usage_7d: normalizeNumber(usage.usage_7d),
      usage_30d: normalizeNumber(usage.usage_30d),
      avg_daily_usage_7d: normalizeNumber(usage.avg_daily_usage_7d),
      avg_daily_usage_30d: normalizeNumber(usage.avg_daily_usage_30d),
    },
    suggested_actions: alertType === 'out_of_stock'
      ? ['create_receipt', 'request_transfer', 'notify_prescriber', 'review_blocked_batches']
      : ['create_receipt', 'request_transfer', 'adjust_min_stock', 'notify_inventory_staff'],
    metadata: {
      medication_code: medication.medication_code,
      medication_name: medicationName(medication),
      unit: medication.unit,
    },
  };
}

async function getLowStockAlerts(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const [stockGroups, usageMap, demandMap] = await Promise.all([
    loadMedicationStockContext(query),
    getUsageStatsByMedication(),
    getPendingDemandByMedication(),
  ]);
  const snapshots = stockGroups
    .map((group) => buildStockMedicationItem(group, usageMap.get(group.medication_id) || {}, demandMap.get(group.medication_id) || {}, 'low_stock'))
    .filter((item) => {
      const available = normalizeNumber(item.metrics.available_on_hand);
      const minStock = normalizeNumber(item.metrics.min_stock_level);
      const pendingDemand = normalizeNumber(item.metrics.pending_demand);
      const daysLeft = item.metrics.days_of_stock_left;
      return available > 0 && (
        (minStock > 0 && available <= minStock)
        || (daysLeft !== null && daysLeft <= Number(query.days_left || 7))
        || pendingDemand > available
      );
    });
  const items = await materializeSnapshots(snapshots, actor, query);
  const shortageQuantity = items.reduce((sum, item) => sum + normalizeNumber(item.metrics?.shortage_quantity), 0);
  const atRiskValue = items.reduce((sum, item) => sum + normalizeNumber(item.metrics?.shortage_quantity) * normalizeNumber(item.medication?.sale_price), 0);
  return finalizeBoard('low_stock', query, items, {
    below_min_stock: items.length,
    under_3_days: items.filter((item) => item.metrics?.days_of_stock_left !== null && item.metrics.days_of_stock_left <= 3).length,
    under_7_days: items.filter((item) => item.metrics?.days_of_stock_left !== null && item.metrics.days_of_stock_left <= 7).length,
    with_pending_dispense: items.filter((item) => normalizeNumber(item.metrics?.pending_demand) > 0).length,
    shortage_quantity: shortageQuantity,
    replenishment_value_estimate: atRiskValue,
  });
}

async function getOutOfStockAlerts(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const [stockGroups, usageMap, demandMap] = await Promise.all([
    loadMedicationStockContext(query),
    getUsageStatsByMedication(),
    getPendingDemandByMedication(),
  ]);
  const completeGroups = [...stockGroups];
  if (!query.storage_location && !query.location && !query.supplier_name && !query.supplier) {
    const medicationFilter = { status: MEDICATION_STATUS.ACTIVE, is_deleted: false };
    if (query.medication_id) medicationFilter._id = toObjectId(query.medication_id, 'medication_id');
    const medications = await MedicationMaster.find(medicationFilter).limit(3000).lean();
    const existingMedicationIds = new Set(completeGroups.map((group) => group.medication_id));
    for (const medication of medications) {
      const medicationId = toPlainId(medication._id);
      if (existingMedicationIds.has(medicationId)) continue;
      if (!matchesSearch([
        medication.medication_code,
        medication.generic_name,
        medication.brand_name,
        medication.strength,
      ], query.search || query.q)) continue;
      completeGroups.push({
        medication,
        medication_id: medicationId,
        batches: [],
        available_batches: [],
        blocked_batches: [],
        depleted_batches: [],
        total_on_hand: 0,
        available_on_hand: 0,
        blocked_on_hand: 0,
        min_stock_level: normalizeNumber(medication.min_stock_level),
      });
    }
  }
  const snapshots = completeGroups
    .filter((group) => normalizeNumber(group.available_on_hand) <= 0)
    .map((group) => buildStockMedicationItem(group, usageMap.get(group.medication_id) || {}, demandMap.get(group.medication_id) || {}, 'out_of_stock'));
  const items = await materializeSnapshots(snapshots, actor, query);
  return finalizeBoard('out_of_stock', query, items, {
    system_out_of_stock: items.filter((item) => normalizeNumber(item.inventory?.total_on_hand) <= 0).length,
    blocked_stock_only: items.filter((item) => normalizeNumber(item.inventory?.blocked_on_hand) > 0).length,
    affected_prescriptions: items.reduce((sum, item) => sum + normalizeNumber(item.impact?.affected_prescription_count), 0),
    affected_patients: items.reduce((sum, item) => sum + normalizeNumber(item.impact?.affected_patient_count), 0),
  });
}

function buildBatchAlertItem(batch, alertType = 'batch_expiring') {
  const medication = batch.medication_id || {};
  const days = batch.expiry_date ? daysBetween(new Date(), batch.expiry_date) : null;
  const valueAtRisk = normalizeNumber(batch.quantity_on_hand) * normalizeNumber(batch.unit_cost);
  const isExpired = alertType === 'batch_expired';
  const severity = isExpired ? 'critical' : severityFromDays(days);
  return {
    alert_type: alertType,
    severity,
    status: 'open',
    source_type: 'stock_batch',
    source_module: 'pharmacy_inventory',
    source_id: toPlainId(batch._id),
    medication_id: toPlainId(medication._id || medication),
    stock_batch_id: toPlainId(batch._id),
    title: isExpired ? 'Lô thuốc đã hết hạn' : 'Lô thuốc sắp hết hạn',
    message: `${medicationName(medication)} - lô ${batch.batch_no || batch.lot_no || '--'} ${isExpired ? 'đã quá hạn' : `còn ${days} ngày`}, tồn ${normalizeNumber(batch.quantity_on_hand)}.`,
    reason_code: isExpired ? 'BATCH_EXPIRED' : 'BATCH_EXPIRING',
    dedupe_key: `${alertType}:${toPlainId(batch._id)}`,
    detected_at: new Date(),
    due_at: buildDueAt(severity),
    medication: {
      id: toPlainId(medication._id || medication),
      medication_code: medication.medication_code,
      generic_name: medication.generic_name,
      brand_name: medication.brand_name,
      dosage_form: medication.dosage_form,
      strength: medication.strength,
      route_default: medication.route_default,
      unit: medication.unit,
      status: medication.status,
    },
    batch: batchSnapshot(batch),
    metrics: {
      quantity_on_hand: normalizeNumber(batch.quantity_on_hand),
      days_to_expiry: days,
      value_at_risk: valueAtRisk,
    },
    inventory: {
      batches: [batchSnapshot(batch)],
    },
    suggested_actions: isExpired
      ? ['mark_expired', 'create_disposal', 'print_disposal_minutes', 'assign_owner']
      : ['prioritize_fefo', 'print_warning_label', 'request_transfer', 'notify_dispensing_counter'],
    metadata: {
      batch_no: batch.batch_no,
      lot_no: batch.lot_no,
      expiry_date: batch.expiry_date,
      storage_location: batch.storage_location,
      supplier_name: batch.supplier_name,
      recommended_action: isExpired ? 'dispose_or_mark_expired' : 'prioritize_fefo',
    },
  };
}

async function getExpiringBatchAlerts(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const days = Number(query.near_expiry_days || query.days || 90);
  const now = new Date();
  const until = new Date(now.getTime() + Math.max(days, 1) * 86400000);
  const filter = {
    status: STOCK_BATCH_STATUS.AVAILABLE,
    quantity_on_hand: { $gt: 0 },
    expiry_date: { $gte: now, $lte: until },
    is_deleted: false,
  };
  const locationRegex = regexFilter(query.storage_location || query.location);
  if (locationRegex) filter.storage_location = locationRegex;
  const supplierRegex = regexFilter(query.supplier_name || query.supplier);
  if (supplierRegex) filter.supplier_name = supplierRegex;
  const batches = await StockBatch.find(filter)
    .sort({ expiry_date: 1 })
    .limit(500)
    .populate('medication_id', MEDICATION_SELECT)
    .lean();
  const snapshots = batches
    .filter((batch) => matchesSearch([
      batch.batch_no,
      batch.lot_no,
      batch.supplier_name,
      batch.storage_location,
      batch.medication_id?.medication_code,
      batch.medication_id?.generic_name,
      batch.medication_id?.brand_name,
    ], query.search || query.q))
    .map((batch) => buildBatchAlertItem(batch, 'batch_expiring'));
  const items = await materializeSnapshots(snapshots, actor, query);
  return finalizeBoard('batch_expiring', query, items, {
    expiring_7d: items.filter((item) => normalizeNumber(item.metrics?.days_to_expiry) <= 7).length,
    expiring_30d: items.filter((item) => normalizeNumber(item.metrics?.days_to_expiry) <= 30).length,
    expiring_90d: items.filter((item) => normalizeNumber(item.metrics?.days_to_expiry) <= 90).length,
    total_value_at_risk: items.reduce((sum, item) => sum + normalizeNumber(item.metrics?.value_at_risk), 0),
    fefo_priority: items.filter((item) => normalizeNumber(item.metrics?.quantity_on_hand) > 0).length,
  }, {
    timeline: items.map((item) => ({
      id: item.id,
      label: item.batch?.batch_no || item.metadata?.batch_no,
      date: item.batch?.expiry_date || item.metadata?.expiry_date,
      value: item.metrics?.value_at_risk,
      severity: item.severity,
    })),
  });
}

async function getExpiredBatchAlerts(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const now = new Date();
  const filter = {
    $or: [
      { status: STOCK_BATCH_STATUS.EXPIRED },
      { expiry_date: { $lt: now } },
    ],
    is_deleted: false,
  };
  const locationRegex = regexFilter(query.storage_location || query.location);
  if (locationRegex) filter.storage_location = locationRegex;
  const supplierRegex = regexFilter(query.supplier_name || query.supplier);
  if (supplierRegex) filter.supplier_name = supplierRegex;
  const batches = await StockBatch.find(filter)
    .sort({ expiry_date: 1, updated_at: -1 })
    .limit(500)
    .populate('medication_id', MEDICATION_SELECT)
    .lean();
  const snapshots = batches
    .filter((batch) => matchesSearch([
      batch.batch_no,
      batch.lot_no,
      batch.supplier_name,
      batch.storage_location,
      batch.medication_id?.medication_code,
      batch.medication_id?.generic_name,
      batch.medication_id?.brand_name,
    ], query.search || query.q))
    .map((batch) => buildBatchAlertItem(batch, 'batch_expired'));
  const items = await materializeSnapshots(snapshots, actor, query);
  return finalizeBoard('batch_expired', query, items, {
    expired_batches: items.length,
    pending_processing: items.filter((item) => normalizeNumber(item.metrics?.quantity_on_hand) > 0 || item.batch?.status !== STOCK_BATCH_STATUS.EXPIRED).length,
    quantity_to_dispose: items.reduce((sum, item) => sum + normalizeNumber(item.metrics?.quantity_on_hand), 0),
    value_to_dispose: items.reduce((sum, item) => sum + normalizeNumber(item.metrics?.value_at_risk), 0),
    marked_expired: items.filter((item) => item.batch?.status === STOCK_BATCH_STATUS.EXPIRED).length,
  });
}

async function getDispenseShortageAlerts(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const [stockGroups, demandMap] = await Promise.all([
    loadMedicationStockContext(query),
    getPendingDemandByMedication(),
  ]);
  const stockMap = new Map(stockGroups.map((group) => [group.medication_id, group]));
  const items = await PrescriptionItem.find({ status: PRESCRIPTION_ITEM_STATUS.ACTIVE })
    .limit(1000)
    .populate({
      path: 'prescription_id',
      select: 'prescription_no status patient_id encounter_id prescribed_at verified_at',
      populate: { path: 'patient_id', select: 'patient_code full_name gender date_of_birth' },
    })
    .populate('medication_id', MEDICATION_SELECT)
    .lean();
  const prescriptionIds = items.map((item) => toPlainId(item.prescription_id?._id)).filter(Boolean);
  const dispenses = await Dispense.find({ prescription_id: { $in: prescriptionIds.map((id) => toObjectId(id, 'prescription_id')) } })
    .select('dispense_no status workflow_stage prescription_id patient_id')
    .sort({ created_at: -1 })
    .lean();
  const dispenseByPrescription = new Map();
  for (const dispense of dispenses) {
    const prescriptionId = toPlainId(dispense.prescription_id);
    if (!dispenseByPrescription.has(prescriptionId)) dispenseByPrescription.set(prescriptionId, dispense);
  }
  const snapshots = [];
  for (const item of items) {
    const prescription = item.prescription_id;
    if (!prescription || ![
      PRESCRIPTION_STATUS.ACTIVE,
      PRESCRIPTION_STATUS.VERIFIED,
      PRESCRIPTION_STATUS.PARTIALLY_DISPENSED,
    ].includes(prescription.status)) continue;
    const remaining = Math.max(normalizeNumber(item.quantity) - normalizeNumber(item.dispensed_quantity), 0);
    if (remaining <= 0) continue;
    const medicationId = toPlainId(item.medication_id?._id || item.medication_id);
    const group = stockMap.get(medicationId);
    const available = normalizeNumber(group?.available_on_hand);
    if (available >= remaining) continue;
    const medication = item.medication_id || {};
    if (!matchesSearch([
      prescription.prescription_no,
      prescription.patient_id?.patient_code,
      prescription.patient_id?.full_name,
      medication.medication_code,
      medication.generic_name,
      medication.brand_name,
    ], query.search || query.q)) continue;
    const shortage = remaining - available;
    const demand = demandMap.get(medicationId) || {};
    const dispense = dispenseByPrescription.get(toPlainId(prescription._id));
    const severity = prescription.encounter_id || demand.affected_patients?.length ? 'critical' : shortage >= remaining ? 'high' : 'medium';
    snapshots.push({
      alert_type: 'dispense_shortage',
      severity,
      status: 'open',
      source_type: 'prescription_item',
      source_module: 'pharmacy_dispensing',
      source_id: toPlainId(item._id),
      medication_id: medicationId,
      prescription_id: toPlainId(prescription._id),
      prescription_item_id: toPlainId(item._id),
      dispense_id: toPlainId(dispense?._id),
      patient_id: toPlainId(prescription.patient_id?._id || prescription.patient_id),
      encounter_id: toPlainId(prescription.encounter_id),
      title: 'Không đủ thuốc cấp phát',
      message: `${prescription.prescription_no || 'Đơn thuốc'} thiếu ${shortage} ${item.unit || medication.unit || ''} ${medicationName(medication)}.`,
      reason_code: available <= 0 ? 'NO_AVAILABLE_STOCK' : 'PARTIAL_SHORTAGE',
      dedupe_key: `dispense_shortage:${toPlainId(item._id)}`,
      detected_at: new Date(),
      due_at: buildDueAt(severity),
      medication: {
        id: medicationId,
        medication_code: medication.medication_code,
        generic_name: medication.generic_name,
        brand_name: medication.brand_name,
        strength: medication.strength,
        unit: medication.unit || item.unit,
      },
      prescription: {
        id: toPlainId(prescription._id),
        prescription_no: prescription.prescription_no,
        status: prescription.status,
        prescribed_at: prescription.prescribed_at,
        verified_at: prescription.verified_at,
      },
      dispense: dispense ? {
        id: toPlainId(dispense._id),
        dispense_no: dispense.dispense_no,
        status: dispense.status,
        workflow_stage: dispense.workflow_stage,
      } : null,
      patient: {
        id: toPlainId(prescription.patient_id?._id || prescription.patient_id),
        patient_code: prescription.patient_id?.patient_code,
        full_name: prescription.patient_id?.full_name,
        gender: prescription.patient_id?.gender,
      },
      inventory: {
        available_on_hand: available,
        blocked_on_hand: normalizeNumber(group?.blocked_on_hand),
        available_batches: (group?.available_batches || []).map(batchSnapshot),
        blocked_batches: (group?.blocked_batches || []).map(batchSnapshot),
      },
      impact: {
        required_quantity: remaining,
        available_quantity: available,
        shortage_quantity: shortage,
        affected_prescription_count: 1,
        affected_patient_count: 1,
      },
      metrics: {
        available_on_hand: available,
        blocked_on_hand: normalizeNumber(group?.blocked_on_hand),
        shortage_quantity: shortage,
        pending_demand: normalizeNumber(demand.pending_demand),
      },
      suggested_actions: ['partial_dispense', 'request_transfer', 'notify_prescriber', 'hold_prescription_item'],
      metadata: {
        prescription_no: prescription.prescription_no,
        dispense_no: dispense?.dispense_no,
        required_quantity: remaining,
        available_quantity: available,
        unit: item.unit || medication.unit,
      },
    });
  }
  const materialized = await materializeSnapshots(snapshots, actor, query);
  return finalizeBoard('dispense_shortage', query, materialized, {
    shortage_slips: materialized.length,
    total_shortage_quantity: materialized.reduce((sum, item) => sum + normalizeNumber(item.metrics?.shortage_quantity), 0),
    inpatient_critical: materialized.filter((item) => item.severity === 'critical').length,
    partial_possible: materialized.filter((item) => normalizeNumber(item.metrics?.available_on_hand) > 0).length,
    need_transfer: materialized.filter((item) => normalizeNumber(item.metrics?.blocked_on_hand) <= 0).length,
  });
}

function reactionSeverity(value) {
  return value === 'life_threatening' ? 'critical' : value === 'severe' ? 'high' : 'medium';
}

async function getAllergyAlerts(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const [reactions, clinicalAlerts] = await Promise.all([
    MedicationReactionObservation.find({
      status: { $ne: 'resolved' },
      $or: [
        { suspected_allergy: true },
        { severity: { $in: ['severe', 'life_threatening'] } },
      ],
    })
      .sort({ observed_at: -1 })
      .limit(200)
      .populate('patient_id', 'patient_code full_name gender date_of_birth')
      .populate('suspected_medication_id', MEDICATION_SELECT)
      .populate('medication_administration_id', 'scheduled_at administered_at status dose route medication_id stock_batch_id')
      .lean(),
    ClinicalAlert.find({
      source_type: 'medication_reaction',
      status: { $in: ['open', 'acknowledged', 'doctor_notified', 'escalated'] },
    })
      .sort({ created_at: -1 })
      .limit(200)
      .populate('patient_id', 'patient_code full_name gender date_of_birth')
      .lean(),
  ]);

  const snapshots = [];
  for (const reaction of reactions) {
    const medication = reaction.suspected_medication_id || {};
    if (!matchesSearch([
      reaction.patient_id?.patient_code,
      reaction.patient_id?.full_name,
      medication.medication_code,
      medication.generic_name,
      medication.brand_name,
      ...(reaction.symptoms || []),
    ], query.search || query.q)) continue;
    const severity = reactionSeverity(reaction.severity);
    snapshots.push({
      alert_type: reaction.suspected_allergy ? 'allergy_conflict' : 'medication_reaction',
      severity,
      status: 'open',
      source_type: 'medication_reaction',
      source_module: 'nursing',
      source_id: toPlainId(reaction._id),
      medication_id: toPlainId(medication._id || medication),
      patient_id: toPlainId(reaction.patient_id?._id || reaction.patient_id),
      encounter_id: toPlainId(reaction.encounter_id),
      admission_id: toPlainId(reaction.admission_id),
      title: reaction.suspected_allergy ? 'Nghi dị ứng thuốc sau dùng' : 'Phản ứng thuốc nặng',
      message: `${personName(reaction.patient_id, 'Bệnh nhân')} có phản ứng ${reaction.severity} sau dùng ${medicationName(medication)}.`,
      reason_code: reaction.suspected_allergy ? 'SUSPECTED_ALLERGY' : 'SEVERE_MEDICATION_REACTION',
      dedupe_key: `medication_reaction:${toPlainId(reaction._id)}`,
      detected_at: reaction.observed_at || reaction.created_at,
      due_at: buildDueAt(severity, reaction.observed_at || reaction.created_at),
      medication: {
        id: toPlainId(medication._id || medication),
        medication_code: medication.medication_code,
        generic_name: medication.generic_name,
        brand_name: medication.brand_name,
        strength: medication.strength,
      },
      patient: {
        id: toPlainId(reaction.patient_id?._id || reaction.patient_id),
        patient_code: reaction.patient_id?.patient_code,
        full_name: reaction.patient_id?.full_name,
        gender: reaction.patient_id?.gender,
      },
      reaction: {
        id: toPlainId(reaction._id),
        severity: reaction.severity,
        symptoms: reaction.symptoms || [],
        observed_at: reaction.observed_at,
        onset_at: reaction.onset_at,
        status: reaction.status,
        medication_stopped: reaction.medication_stopped,
        suspected_allergy: reaction.suspected_allergy,
      },
      impact: {
        affected_patient_count: 1,
        doctor_notified: Boolean(reaction.doctor_notification_request_id),
        allergy_recorded: Boolean(reaction.allergy_created_id),
      },
      metrics: {
        anomaly_score: severity === 'critical' ? 100 : severity === 'high' ? 80 : 50,
      },
      suggested_actions: ['acknowledge', 'notify_doctor', 'hold_medication', 'create_allergy_record', 'resolve'],
      metadata: {
        symptoms: reaction.symptoms || [],
        reaction_status: reaction.status,
      },
    });
  }

  for (const clinical of clinicalAlerts) {
    if (!matchesSearch([
      clinical.title,
      clinical.message,
      clinical.patient_id?.patient_code,
      clinical.patient_id?.full_name,
    ], query.search || query.q)) continue;
    snapshots.push({
      alert_type: 'medication_reaction',
      severity: clinical.severity === 'warning' ? 'medium' : clinical.severity,
      status: clinical.status === 'open' ? 'open' : 'acknowledged',
      source_type: 'clinical_alert',
      source_module: 'clinical_alerts',
      source_id: toPlainId(clinical._id),
      patient_id: toPlainId(clinical.patient_id?._id || clinical.patient_id),
      encounter_id: toPlainId(clinical.encounter_id),
      admission_id: toPlainId(clinical.admission_id),
      title: clinical.title,
      message: clinical.message,
      reason_code: clinical.rule_code || 'CLINICAL_MEDICATION_REACTION',
      dedupe_key: `clinical_medication_reaction:${toPlainId(clinical._id)}`,
      detected_at: clinical.created_at,
      due_at: clinical.sla_due_at || buildDueAt(clinical.severity === 'critical' ? 'critical' : 'high', clinical.created_at),
      patient: {
        id: toPlainId(clinical.patient_id?._id || clinical.patient_id),
        patient_code: clinical.patient_id?.patient_code,
        full_name: clinical.patient_id?.full_name,
        gender: clinical.patient_id?.gender,
      },
      impact: {
        affected_patient_count: 1,
        doctor_notified: Boolean(clinical.doctor_notified_at),
      },
      metrics: {
        anomaly_score: clinical.severity === 'critical' ? 100 : 75,
      },
      suggested_actions: ['acknowledge', 'notify_doctor', 'escalate', 'resolve'],
      metadata: clinical.metadata || {},
    });
  }

  const materialized = await materializeSnapshots(snapshots, actor, query);
  return finalizeBoard('allergy_conflict', query, materialized, {
    high_risk_allergy: materialized.filter((item) => item.alert_type === 'allergy_conflict' && ['critical', 'high'].includes(item.severity)).length,
    severe_reactions: materialized.filter((item) => item.alert_type === 'medication_reaction').length,
    suspected_anaphylaxis: materialized.filter((item) => item.severity === 'critical').length,
    doctor_notified: materialized.filter((item) => item.impact?.doctor_notified).length,
    allergy_recorded: materialized.filter((item) => item.impact?.allergy_recorded).length,
  });
}

async function getHighUsageAlerts(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const [stockGroups, usageMap] = await Promise.all([
    loadMedicationStockContext(query),
    getUsageStatsByMedication(),
  ]);
  const snapshots = [];
  for (const group of stockGroups) {
    const usage = usageMap.get(group.medication_id) || {};
    const usageToday = normalizeNumber(usage.usage_today);
    const avgDaily30 = normalizeNumber(usage.avg_daily_usage_30d);
    const available = normalizeNumber(group.available_on_hand);
    const daysLeft = avgDaily30 > 0 ? round(available / avgDaily30, 1) : null;
    const spikeRatio = avgDaily30 > 0 ? round(usageToday / avgDaily30, 2) : usageToday > 0 ? 99 : 0;
    if (usageToday <= 0 && normalizeNumber(usage.usage_7d) <= 0) continue;
    if (spikeRatio < Number(query.spike_ratio || 1.5) && !(daysLeft !== null && daysLeft <= 7)) continue;
    const severity = daysLeft !== null && daysLeft <= 3 ? 'critical' : spikeRatio >= 2 ? 'high' : 'medium';
    const medication = group.medication || {};
    snapshots.push({
      alert_type: 'high_usage',
      severity,
      status: 'open',
      source_type: 'medication_usage',
      source_module: 'inventory_transactions',
      source_id: group.medication_id,
      medication_id: group.medication_id,
      title: 'Thuốc dùng nhiều bất thường',
      message: `${medicationName(medication)} dùng hôm nay ${usageToday}, gấp ${spikeRatio} lần baseline 30 ngày.`,
      reason_code: 'HIGH_USAGE_SPIKE',
      dedupe_key: `high_usage:${group.medication_id}:${formatDateOnly(new Date())}`,
      detected_at: new Date(),
      due_at: buildDueAt(severity),
      medication: {
        id: group.medication_id,
        medication_code: medication.medication_code,
        generic_name: medication.generic_name,
        brand_name: medication.brand_name,
        strength: medication.strength,
        unit: medication.unit,
      },
      inventory: {
        available_on_hand: available,
        min_stock_level: group.min_stock_level,
        available_batches: group.available_batches.map(batchSnapshot),
      },
      usage: {
        ...usage,
        days_of_stock_left: daysLeft,
        spike_ratio: spikeRatio,
      },
      metrics: {
        available_on_hand: available,
        min_stock_level: group.min_stock_level,
        days_of_stock_left: daysLeft,
        usage_today: usageToday,
        usage_7d: normalizeNumber(usage.usage_7d),
        usage_30d: normalizeNumber(usage.usage_30d),
        avg_daily_usage_30d: avgDaily30,
        usage_ratio: spikeRatio,
      },
      suggested_actions: ['create_receipt', 'create_high_usage_rule', 'review_dispense_transactions', 'notify_inventory_staff'],
      metadata: {
        baseline: avgDaily30,
        spike_ratio: spikeRatio,
      },
    });
  }
  const materialized = await materializeSnapshots(snapshots, actor, query);
  return finalizeBoard('high_usage', query, materialized, {
    high_usage_today: materialized.length,
    spike_count: materialized.filter((item) => normalizeNumber(item.metrics?.usage_ratio) >= 2).length,
    risk_stockout_3d: materialized.filter((item) => item.metrics?.days_of_stock_left !== null && item.metrics.days_of_stock_left <= 3).length,
    usage_today: materialized.reduce((sum, item) => sum + normalizeNumber(item.metrics?.usage_today), 0),
    usage_30d: materialized.reduce((sum, item) => sum + normalizeNumber(item.metrics?.usage_30d), 0),
  });
}

async function getWasteLossAlerts(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const range = buildRange(query, 30);
  const filter = {
    direction: INVENTORY_TRANSACTION_DIRECTION.OUT,
    transaction_type: {
      $in: [
        INVENTORY_TRANSACTION_TYPE.WASTE,
        INVENTORY_TRANSACTION_TYPE.EXPIRE,
        INVENTORY_TRANSACTION_TYPE.RECALL,
        INVENTORY_TRANSACTION_TYPE.ADJUSTMENT,
      ],
    },
  };
  if (range.start || range.end) {
    filter.occurred_at = {};
    if (range.start) filter.occurred_at.$gte = range.start;
    if (range.end) filter.occurred_at.$lte = range.end;
  }
  if (query.transaction_type) filter.transaction_type = query.transaction_type;
  const transactions = await InventoryTransaction.find(filter)
    .sort({ occurred_at: -1 })
    .limit(500)
    .populate({ path: 'medication_id', select: MEDICATION_SELECT, transform: preserveMissingRef })
    .populate({ path: 'stock_batch_id', select: BATCH_SELECT, transform: preserveMissingRef })
    .populate('performed_by', 'full_name username employee_code')
    .lean();
  const snapshots = transactions
    .filter((tx) => matchesSearch([
      tx.transaction_no,
      tx.transaction_type,
      tx.note,
      tx.medication_id?.medication_code,
      tx.medication_id?.generic_name,
      tx.medication_id?.brand_name,
      tx.stock_batch_id?.batch_no,
      tx.stock_batch_id?.lot_no,
    ], query.search || query.q))
    .map((tx) => {
      const medication = tx.medication_id || {};
      const batch = tx.stock_batch_id || {};
      const medicationId = toPlainId(medication);
      const stockBatchId = toPlainId(batch);
      const value = normalizeNumber(tx.quantity) * normalizeNumber(tx.unit_cost || batch.unit_cost);
      const anomalyScore = Math.min(100, Math.round((value / 10000000) * 45 + (normalizeNumber(tx.quantity) / 100) * 25 + (tx.transaction_type === INVENTORY_TRANSACTION_TYPE.ADJUSTMENT ? 20 : 0)));
      const severity = value >= 10000000 || anomalyScore >= 75 ? 'high' : value >= 2000000 || anomalyScore >= 45 ? 'medium' : 'low';
      return {
        alert_type: 'waste_loss',
        severity,
        status: 'open',
        source_type: 'inventory_transaction',
        source_module: 'inventory_transactions',
        source_id: toPlainId(tx._id),
        medication_id: medicationId,
        stock_batch_id: stockBatchId,
        title: 'Hao hụt / hủy thuốc cần kiểm soát',
        message: `${tx.transaction_no || 'Giao dịch kho'} ${tx.transaction_type} ${normalizeNumber(tx.quantity)} ${medication.unit || ''} ${medicationName(medication)}.`,
        reason_code: tx.transaction_type === INVENTORY_TRANSACTION_TYPE.ADJUSTMENT ? 'NEGATIVE_ADJUSTMENT_REVIEW' : 'WASTE_LOSS_REVIEW',
        dedupe_key: `waste_loss:${toPlainId(tx._id)}`,
        detected_at: tx.occurred_at || tx.created_at,
        due_at: buildDueAt(severity, tx.occurred_at || tx.created_at),
        medication: {
          id: medicationId,
          medication_code: medication.medication_code,
          generic_name: medication.generic_name,
          brand_name: medication.brand_name,
          strength: medication.strength,
          unit: medication.unit,
          master_missing: !hasPopulatedDocument(medication),
        },
        batch: hasPopulatedDocument(batch) ? batchSnapshot(batch) : stockBatchId ? { id: stockBatchId, master_missing: true } : null,
        transaction: {
          id: toPlainId(tx._id),
          transaction_no: tx.transaction_no,
          transaction_type: tx.transaction_type,
          direction: tx.direction,
          quantity: tx.quantity,
          unit_cost: tx.unit_cost,
          balance_before: tx.balance_before,
          balance_after: tx.balance_after,
          occurred_at: tx.occurred_at,
          performed_by: personName(tx.performed_by, ''),
          note: tx.note,
        },
        metrics: {
          quantity_on_hand: batch.quantity_on_hand,
          value_at_risk: value,
          anomaly_score: anomalyScore,
        },
        suggested_actions: ['request_review', 'approve_loss', 'create_disposal_record', 'export_audit'],
        metadata: {
          transaction_no: tx.transaction_no,
          transaction_type: tx.transaction_type,
          reason_code: tx.reason_code,
          document_no: tx.document_no,
          suspicious: anomalyScore >= 65,
          medication_master_missing: !hasPopulatedDocument(medication),
          stock_batch_missing: Boolean(stockBatchId && !hasPopulatedDocument(batch)),
        },
      };
    });
  const materialized = await materializeSnapshots(snapshots, actor, query);
  return finalizeBoard('waste_loss', query, materialized, {
    transactions_today: materialized.filter((item) => item.detected_at && new Date(item.detected_at) >= getStartOfDay(new Date())).length,
    total_loss_quantity: materialized.reduce((sum, item) => sum + normalizeNumber(item.transaction?.quantity), 0),
    total_loss_value: materialized.reduce((sum, item) => sum + normalizeNumber(item.metrics?.value_at_risk), 0),
    expired_disposal: materialized.filter((item) => item.transaction?.transaction_type === INVENTORY_TRANSACTION_TYPE.EXPIRE).length,
    recall_disposal: materialized.filter((item) => item.transaction?.transaction_type === INVENTORY_TRANSACTION_TYPE.RECALL).length,
    suspicious_adjustments: materialized.filter((item) => item.metadata?.suspicious).length,
  });
}

async function listPharmacyAlerts(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const { page, limit, skip } = getPagination(query, DEFAULT_LIMIT, 100);
  const filter = {};
  const requestedType = query.alert_type ? legacyAlertType(query.alert_type) : '';
  if (requestedType) filter.alert_type = requestedType;
  if (query.severity) filter.severity = query.severity;
  if (query.status) filter.status = query.status;
  else if (String(query.open || 'true').toLowerCase() === 'true') filter.status = { $in: OPEN_ALERT_STATUSES };
  if (query.assigned_to === 'me') filter.assigned_to = actorId(actor);
  else if (query.assigned_to) filter.assigned_to = toObjectId(query.assigned_to, 'assigned_to');
  for (const field of ['medication_id', 'stock_batch_id', 'prescription_id', 'prescription_item_id', 'dispense_id', 'patient_id']) {
    if (query[field]) filter[field] = toObjectId(query[field], field);
  }
  if (query.search) {
    const pattern = escapeRegex(query.search);
    filter.$or = [
      { alert_code: { $regex: pattern, $options: 'i' } },
      { title: { $regex: pattern, $options: 'i' } },
      { message: { $regex: pattern, $options: 'i' } },
      { reason_code: { $regex: pattern, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    PharmacyAlert.find(filter)
      .sort({ severity: 1, due_at: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('medication_id', MEDICATION_SELECT)
      .populate('stock_batch_id', BATCH_SELECT)
      .populate('prescription_id', 'prescription_no status patient_id encounter_id')
      .populate('dispense_id', 'dispense_no status workflow_stage')
      .populate('patient_id', 'patient_code full_name gender')
      .populate('assigned_to', 'full_name username employee_code')
      .lean(),
    PharmacyAlert.countDocuments(filter),
  ]);
  const normalized = items.map((item) => normalizeAlertDocument(item, {
    medication: item.medication_id,
    batch: item.stock_batch_id ? batchSnapshot(item.stock_batch_id) : null,
  }));
  return {
    summary: buildSummary(normalized),
    items: normalized,
    kanban: buildKanban(normalized),
    pagination: buildPagination(page, limit, total),
  };
}

async function getAlertSummary(query = {}, actor = {}) {
  assertPharmacyRead(actor);
  const filter = {};
  if (query.status) filter.status = query.status;
  else filter.status = { $in: OPEN_ALERT_STATUSES };
  const rows = await PharmacyAlert.aggregate([
    { $match: filter },
    {
      $group: {
        _id: {
          alert_type: '$alert_type',
          severity: '$severity',
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
  ]);
  const summary = {
    total_open: 0,
    by_type: {},
    by_severity: {},
    by_status: {},
  };
  for (const row of rows) {
    const count = normalizeNumber(row.count);
    const type = normalizeAlertType(row._id.alert_type);
    summary.total_open += OPEN_ALERT_STATUSES.includes(row._id.status) ? count : 0;
    summary.by_type[type] = normalizeNumber(summary.by_type[type]) + count;
    summary.by_severity[row._id.severity] = normalizeNumber(summary.by_severity[row._id.severity]) + count;
    summary.by_status[row._id.status] = normalizeNumber(summary.by_status[row._id.status]) + count;
  }
  return {
    ...summary,
    critical: normalizeNumber(summary.by_severity.critical),
    high: normalizeNumber(summary.by_severity.high),
    medium: normalizeNumber(summary.by_severity.medium),
    low: normalizeNumber(summary.by_severity.low),
    generated_at: new Date(),
  };
}

async function getPharmacyAlertDetail(alertId, actor = {}) {
  assertPharmacyRead(actor);
  const alert = await PharmacyAlert.findById(alertId)
    .populate('medication_id', MEDICATION_SELECT)
    .populate('stock_batch_id', BATCH_SELECT)
    .populate('prescription_id', 'prescription_no status patient_id encounter_id prescribed_at verified_at')
    .populate('prescription_item_id', 'quantity dispensed_quantity unit dose frequency route status')
    .populate('dispense_id', 'dispense_no status workflow_stage assigned_to completed_at')
    .populate('dispense_item_id', 'quantity status returned_quantity')
    .populate('patient_id', 'patient_code full_name gender date_of_birth')
    .populate('assigned_to acknowledged_by resolved_by snoozed_by', 'full_name username employee_code')
    .lean();
  if (!alert) throw createError('Không tìm thấy cảnh báo dược.', 404);
  const [action_logs, recent_transactions] = await Promise.all([
    PharmacyAlertActionLog.find({ alert_id: alert._id })
      .sort({ occurred_at: -1 })
      .limit(20)
      .populate('actor_id', 'full_name username employee_code')
      .lean(),
    alert.medication_id?._id
      ? InventoryTransaction.find({ medication_id: alert.medication_id._id })
        .sort({ occurred_at: -1 })
        .limit(12)
        .populate('stock_batch_id', BATCH_SELECT)
        .populate('performed_by', 'full_name username employee_code')
        .lean()
      : [],
  ]);
  return {
    alert: normalizeAlertDocument(alert, {
      medication: alert.medication_id,
      batch: alert.stock_batch_id ? batchSnapshot(alert.stock_batch_id) : null,
      prescription: alert.prescription_id,
      dispense: alert.dispense_id,
      patient: alert.patient_id,
    }),
    action_logs,
    recent_transactions,
  };
}

async function logAlertAction(alert, action, actor = {}, payload = {}, fromStatus = null) {
  await PharmacyAlertActionLog.create({
    alert_id: alert._id,
    action,
    from_status: fromStatus,
    to_status: alert.status,
    actor_id: actorId(actor),
    note: payload.note || payload.reason || payload.resolution_note,
    metadata: payload.metadata || {},
  });
}

async function updateAlert(alertId, updates = {}, actor = {}, action = 'pharmacy.alert.updated', requestMeta = {}) {
  assertAlertManage(actor);
  const alert = await PharmacyAlert.findById(alertId);
  if (!alert) throw createError('Không tìm thấy cảnh báo dược.', 404);
  const fromStatus = alert.status;
  Object.assign(alert, updates, { updated_by: actorId(actor) });
  await alert.save();
  await logAlertAction(alert, action, actor, updates, fromStatus);
  await recordAuditLog({
    actor,
    action,
    targetType: 'pharmacy_alert',
    targetId: alert._id,
    status: 'success',
    message: 'Cập nhật cảnh báo dược thành công.',
    requestMeta,
    metadata: { from_status: fromStatus, to_status: alert.status },
  });
  const eventTypeMap = {
    'pharmacy.alert.acknowledged': REALTIME_EVENT_TYPE.PHARMACY_ALERT_ACKNOWLEDGED,
    'pharmacy.alert.assigned': REALTIME_EVENT_TYPE.PHARMACY_ALERT_ASSIGNED,
    'pharmacy.alert.resolved': REALTIME_EVENT_TYPE.PHARMACY_ALERT_RESOLVED,
    'pharmacy.alert.dismissed': REALTIME_EVENT_TYPE.PHARMACY_ALERT_RESOLVED,
    'pharmacy.alert.escalated': REALTIME_EVENT_TYPE.PHARMACY_ALERT_ESCALATED,
  };
  await publishAlertEvent(eventTypeMap[action] || REALTIME_EVENT_TYPE.PHARMACY_ALERT_UPDATED, alert, actor, { from_status: fromStatus });
  return getPharmacyAlertDetail(alert._id, actor);
}

function acknowledgePharmacyAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  return updateAlert(alertId, {
    status: 'acknowledged',
    acknowledged_by: actorId(actor),
    acknowledged_at: new Date(),
    resolution_note: payload.note,
  }, actor, 'pharmacy.alert.acknowledged', requestMeta);
}

async function assignPharmacyAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  const assignedTo = payload.assigned_to || payload.user_id || actorId(actor);
  if (!assignedTo) throw createError('assigned_to là bắt buộc.', 400);
  const result = await updateAlert(alertId, {
    status: 'assigned',
    assigned_to: toObjectId(assignedTo, 'assigned_to'),
  }, actor, 'pharmacy.alert.assigned', requestMeta);
  await PharmacyAlertAssignment.updateMany({ alert_id: alertId, status: 'active' }, { $set: { status: 'superseded' } });
  await PharmacyAlertAssignment.create({
    alert_id: alertId,
    assigned_to: toObjectId(assignedTo, 'assigned_to'),
    assigned_by: actorId(actor),
    note: payload.note,
  });
  return result;
}

function startPharmacyAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  return updateAlert(alertId, {
    status: 'in_progress',
    resolution_note: payload.note,
  }, actor, 'pharmacy.alert.updated', requestMeta);
}

async function snoozePharmacyAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  const minutes = Number(payload.minutes || payload.snooze_minutes || 240);
  const until = parseDate(payload.snoozed_until || payload.until, 'snoozed_until') || new Date(Date.now() + Math.max(minutes, 15) * 60000);
  const result = await updateAlert(alertId, {
    status: 'snoozed',
    snoozed_by: actorId(actor),
    snoozed_until: until,
    resolution_note: payload.reason || payload.note,
  }, actor, 'pharmacy.alert.updated', requestMeta);
  await PharmacyAlertSnooze.create({
    alert_id: alertId,
    snoozed_by: actorId(actor),
    snoozed_until: until,
    reason: payload.reason || payload.note,
  });
  return result;
}

async function resolvePharmacyAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  const result = await updateAlert(alertId, {
    status: 'resolved',
    resolved_by: actorId(actor),
    resolved_at: new Date(),
    resolution_note: payload.resolution_note || payload.note,
  }, actor, 'pharmacy.alert.resolved', requestMeta);
  await PharmacyAlertResolution.create({
    alert_id: alertId,
    resolution_type: payload.resolution_type || 'manual',
    resolved_by: actorId(actor),
    note: payload.resolution_note || payload.note,
    metadata: payload.metadata || {},
  });
  return result;
}

function dismissPharmacyAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  return updateAlert(alertId, {
    status: 'dismissed',
    resolved_by: actorId(actor),
    resolved_at: new Date(),
    resolution_note: payload.reason || payload.note,
  }, actor, 'pharmacy.alert.dismissed', requestMeta);
}

function escalatePharmacyAlert(alertId, payload = {}, actor = {}, requestMeta = {}) {
  return updateAlert(alertId, {
    status: 'escalated',
    resolution_note: payload.reason || payload.note,
  }, actor, 'pharmacy.alert.escalated', requestMeta);
}

async function bulkActionPharmacyAlerts(payload = {}, actor = {}, requestMeta = {}) {
  assertAlertManage(actor);
  const ids = Array.isArray(payload.alert_ids) ? payload.alert_ids : Array.isArray(payload.ids) ? payload.ids : [];
  if (!ids.length) throw createError('alert_ids là bắt buộc.', 400);
  const action = payload.action;
  const results = [];
  for (const id of ids) {
    if (action === 'acknowledge') results.push(await acknowledgePharmacyAlert(id, payload, actor, requestMeta));
    else if (action === 'assign') results.push(await assignPharmacyAlert(id, payload, actor, requestMeta));
    else if (action === 'start') results.push(await startPharmacyAlert(id, payload, actor, requestMeta));
    else if (action === 'snooze') results.push(await snoozePharmacyAlert(id, payload, actor, requestMeta));
    else if (action === 'resolve') results.push(await resolvePharmacyAlert(id, payload, actor, requestMeta));
    else if (action === 'dismiss') results.push(await dismissPharmacyAlert(id, payload, actor, requestMeta));
    else if (action === 'escalate') results.push(await escalatePharmacyAlert(id, payload, actor, requestMeta));
    else throw createError('action không hợp lệ.', 400);
  }
  return { action, processed: results.length, results };
}

module.exports = {
  acknowledgePharmacyAlert,
  assignPharmacyAlert,
  bulkActionPharmacyAlerts,
  dismissPharmacyAlert,
  escalatePharmacyAlert,
  getAlertSummary,
  getAllergyAlerts,
  getDispenseShortageAlerts,
  getExpiredBatchAlerts,
  getExpiringBatchAlerts,
  getHighUsageAlerts,
  getLowStockAlerts,
  getOutOfStockAlerts,
  getPharmacyAlertDetail,
  getWasteLossAlerts,
  listPharmacyAlerts,
  resolvePharmacyAlert,
  snoozePharmacyAlert,
  startPharmacyAlert,
};
