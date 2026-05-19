const { Types } = require('mongoose');
const {
  Allergy,
  AuditLog,
  Charge,
  Dispense,
  DispenseHold,
  DispenseItem,
  DispensePrintJob,
  DispenseReturn,
  DispenseReturnItem,
  Encounter,
  InventoryTransaction,
  MedicationLabelTemplate,
  MedicationMaster,
  Patient,
  Prescription,
  PrescriptionItem,
  StockBatch,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  ALLERGY_STATUS,
  CHARGE_STATUS,
  DISPENSE_ITEM_STATUS,
  DISPENSE_STATUS,
  INVENTORY_TRANSACTION_DIRECTION,
  INVENTORY_TRANSACTION_TYPE,
  PRESCRIPTION_ITEM_STATUS,
  PRESCRIPTION_STATUS,
  STOCK_BATCH_STATUS,
} = require('../constants/statuses');
const permissionService = require('./permission.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode, generateSequenceCode } = require('./code-generator.service');
const { withOptionalTransaction } = require('../shared/utils/transaction');

const DISPENSE_WORKFLOW_STAGES = ['created', 'assigned', 'picking', 'checking', 'ready_to_handover', 'blocked'];
const ACTIVE_HOLD_STATUSES = ['active'];
const OPEN_DISPENSE_STATUSES = [DISPENSE_STATUS.DRAFT, DISPENSE_STATUS.PARTIALLY_DISPENSED];
const DISPENSING_PRESCRIPTION_STATUSES = [PRESCRIPTION_STATUS.VERIFIED, PRESCRIPTION_STATUS.PARTIALLY_DISPENSED];
const ACTIVE_ITEM_STATUSES = [PRESCRIPTION_ITEM_STATUS.ACTIVE, PRESCRIPTION_ITEM_STATUS.HELD, PRESCRIPTION_ITEM_STATUS.COMPLETED];
const ACTIVE_CHARGE_STATUSES = [CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT, CHARGE_STATUS.POSTED];
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

const DEFAULT_CHECKLIST = [
  { code: 'patient_identity', label: 'Đối chiếu đúng bệnh nhân' },
  { code: 'prescription_verified', label: 'Đơn thuốc đã verified' },
  { code: 'allergy_review', label: 'Kiểm tra dị ứng' },
  { code: 'interaction_review', label: 'Kiểm tra tương tác thuốc' },
  { code: 'duplicate_review', label: 'Kiểm tra trùng hoạt chất' },
  { code: 'quantity_check', label: 'Kiểm tra số lượng' },
  { code: 'fefo_check', label: 'Kiểm tra lô FEFO' },
  { code: 'expiry_check', label: 'Kiểm tra hạn dùng' },
  { code: 'price_check', label: 'Kiểm tra charge / giá thuốc' },
  { code: 'label_printed', label: 'In nhãn thuốc' },
  { code: 'patient_counseling', label: 'Tư vấn bệnh nhân' },
  { code: 'ready_handover', label: 'Sẵn sàng bàn giao' },
];

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function actorId(actor = {}) {
  return actor.userId || actor.actorId || actor.actor_id || actor.id || null;
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions.filter(Boolean));
}

function assertStaff(actor = {}) {
  if (actorType(actor) !== 'staff') throw createError('Chỉ tài khoản nhân sự được thao tác cấp phát thuốc.', 403);
}

function assertPermissions(actor = {}, permissions = []) {
  assertStaff(actor);
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS])) return;
  if (!hasAnyPermission(actor, permissions)) throw createError('Bạn không có quyền thao tác cấp phát thuốc.', 403);
}

function sameId(left, right) {
  return String(left?._id || left || '') === String(right?._id || right || '');
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(value);
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(normalizeNumber(value) * factor) / factor;
}

function parseDate(value, fieldName = 'date') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`);
  return date;
}

function parsePositiveNumber(value, fieldName = 'quantity') {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw createError(`${fieldName} phải lớn hơn 0.`);
  return number;
}

function personName(person = {}, fallback = 'Chưa rõ') {
  if (!person) return fallback;
  return person.full_name || person.name || person.username || person.patient_code || fallback;
}

function medicationName(medication = {}) {
  if (!medication) return 'Thuốc';
  return [medication.brand_name || medication.generic_name, medication.strength].filter(Boolean).join(' ')
    || medication.medication_code
    || 'Thuốc';
}

function toPlainId(value) {
  return value ? String(value._id || value.id || value) : null;
}

function minutesBetween(start, end = new Date()) {
  if (!start) return 0;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(Math.floor((new Date(end).getTime() - date.getTime()) / 60000), 0);
}

function addMinutes(date, minutes) {
  return new Date(new Date(date || Date.now()).getTime() + Number(minutes || 0) * 60000);
}

function buildExpiryAvailableCondition(now = new Date()) {
  return {
    $or: [
      { expiry_date: { $exists: false } },
      { expiry_date: null },
      { expiry_date: { $gt: now } },
    ],
  };
}

function buildDateRange(query = {}) {
  const start = parseDate(query.date_from || query.from || query.created_from, 'date_from');
  const end = parseDate(query.date_to || query.to || query.created_to, 'date_to');
  return { start, end };
}

function applyDateRange(match, field, range = {}) {
  if (!range.start && !range.end) return;
  match[field] = {};
  if (range.start) match[field].$gte = range.start;
  if (range.end) match[field].$lte = range.end;
}

async function getDispenseOrThrow(dispenseId, session = null) {
  const dispense = await withSession(Dispense.findById(dispenseId), session);
  if (!dispense) throw createError('Không tìm thấy phiếu cấp phát.', 404);
  return dispense;
}

async function createInventoryTransaction(payload = {}, actor = {}, session = null) {
  const transactionNo = await generateBusinessCode(CODE_TYPE.INVENTORY_TRANSACTION, { session });
  const [transaction] = await InventoryTransaction.create([{
    ...payload,
    transaction_no: transactionNo,
    performed_by: actorId(actor),
    occurred_at: payload.occurred_at || new Date(),
    created_by: actorId(actor),
    updated_by: actorId(actor),
  }], sessionOptions(session));
  return transaction;
}

async function generateHoldNo(session = null) {
  return generateSequenceCode(DispenseHold, 'hold_no', 'DHD', { session, sequenceWidth: 4 });
}

async function generateReturnNo(session = null) {
  return generateSequenceCode(DispenseReturn, 'return_no', 'DRN', { session, sequenceWidth: 4 });
}

async function generatePrintJobNo(session = null) {
  return generateSequenceCode(DispensePrintJob, 'print_job_no', 'DPJ', { session, sequenceWidth: 4 });
}

function normalizeChecklist(items = []) {
  const incoming = new Map((Array.isArray(items) ? items : []).map((item) => [item.code, item]));
  return DEFAULT_CHECKLIST.map((template) => ({
    ...template,
    status: incoming.get(template.code)?.status || 'pending',
    checked_by: incoming.get(template.code)?.checked_by,
    checked_at: incoming.get(template.code)?.checked_at,
    note: incoming.get(template.code)?.note,
  }));
}

async function ensureDispenseChecklist(dispense, session = null) {
  if (Array.isArray(dispense.checklist) && dispense.checklist.length) return dispense.checklist;
  dispense.checklist = normalizeChecklist();
  dispense.checklist_status = 'pending';
  dispense.updated_by = actorId({});
  await dispense.save(sessionOptions(session));
  return dispense.checklist;
}

async function getMedicationStockEvidence(medicationId, neededQuantity, storageLocation) {
  const filter = {
    medication_id: medicationId,
    status: STOCK_BATCH_STATUS.AVAILABLE,
    quantity_on_hand: { $gt: 0 },
    is_deleted: false,
    ...buildExpiryAvailableCondition(),
  };
  if (storageLocation) filter.storage_location = storageLocation;
  const batches = await StockBatch.find(filter)
    .sort({ expiry_date: 1, received_date: 1, created_at: 1 })
    .select('batch_no lot_no expiry_date received_date quantity_on_hand min_stock_level storage_location status unit_cost')
    .lean();
  const availableQuantity = batches.reduce((sum, batch) => sum + normalizeNumber(batch.quantity_on_hand), 0);
  const nearExpiryLimit = new Date(Date.now() + 30 * 86400000);
  const fefo = batches[0] || null;
  return {
    available_quantity: round(availableQuantity),
    can_fulfill: availableQuantity >= normalizeNumber(neededQuantity),
    shortage: Math.max(round(normalizeNumber(neededQuantity) - availableQuantity), 0),
    fefo_batch: fefo ? {
      stock_batch_id: String(fefo._id),
      batch_no: fefo.batch_no,
      lot_no: fefo.lot_no,
      expiry_date: fefo.expiry_date,
      quantity_on_hand: fefo.quantity_on_hand,
      storage_location: fefo.storage_location,
      status: fefo.status,
    } : null,
    near_expiry_batches: batches
      .filter((batch) => batch.expiry_date && new Date(batch.expiry_date) <= nearExpiryLimit)
      .slice(0, 3)
      .map((batch) => ({
        stock_batch_id: String(batch._id),
        batch_no: batch.batch_no,
        expiry_date: batch.expiry_date,
        quantity_on_hand: batch.quantity_on_hand,
      })),
  };
}

async function buildQueueItem(prescription, options = {}) {
  const [items, dispenses, holds, allergies] = await Promise.all([
    PrescriptionItem.find({ prescription_id: prescription._id, status: { $in: ACTIVE_ITEM_STATUSES } })
      .populate('medication_id', 'medication_code generic_name brand_name strength dosage_form route_default unit sale_price service_id status min_stock_level')
      .lean(),
    Dispense.find({ prescription_id: prescription._id })
      .sort({ created_at: -1 })
      .limit(6)
      .populate('assigned_to', 'full_name username employee_code')
      .populate('dispensed_by', 'full_name username employee_code')
      .lean(),
    DispenseHold.find({ prescription_id: prescription._id, status: { $in: ACTIVE_HOLD_STATUSES } }).lean(),
    Allergy.find({ patient_id: prescription.patient_id?._id || prescription.patient_id, status: ALLERGY_STATUS.ACTIVE }).lean(),
  ]);

  const itemDetails = [];
  const shortageItems = [];
  const nearExpiryItems = [];
  const missingPriceItems = [];
  const allergyConflicts = [];
  const medicationKeys = new Map();
  let totalQuantity = 0;
  let dispensedQuantity = 0;

  for (const item of items) {
    const medication = item.medication_id || {};
    const remaining = Math.max(normalizeNumber(item.quantity) - normalizeNumber(item.dispensed_quantity), 0);
    totalQuantity += normalizeNumber(item.quantity);
    dispensedQuantity += normalizeNumber(item.dispensed_quantity);
    const stock = remaining > 0
      ? await getMedicationStockEvidence(medication._id || item.medication_id, remaining, options.storage_location)
      : { available_quantity: 0, can_fulfill: true, shortage: 0, near_expiry_batches: [], fefo_batch: null };

    if (!stock.can_fulfill) shortageItems.push({
      prescription_item_id: String(item._id),
      medication_id: toPlainId(medication),
      medication_name: medicationName(medication),
      needed_quantity: remaining,
      available_quantity: stock.available_quantity,
      shortage: stock.shortage,
    });
    if (stock.near_expiry_batches.length) nearExpiryItems.push({
      prescription_item_id: String(item._id),
      medication_id: toPlainId(medication),
      medication_name: medicationName(medication),
      batches: stock.near_expiry_batches,
    });
    if (!medication.service_id && normalizeNumber(medication.sale_price) <= 0) {
      missingPriceItems.push({
        prescription_item_id: String(item._id),
        medication_id: toPlainId(medication),
        medication_name: medicationName(medication),
      });
    }

    const haystack = [medication.generic_name, medication.brand_name, medication.medication_code].filter(Boolean).join(' ').toLowerCase();
    for (const allergy of allergies) {
      const allergen = String(allergy.allergen || '').toLowerCase();
      if (allergen && haystack.includes(allergen)) {
        allergyConflicts.push({
          allergy_id: String(allergy._id),
          allergen: allergy.allergen,
          severity: allergy.severity,
          medication_id: toPlainId(medication),
          medication_name: medicationName(medication),
        });
      }
    }

    const duplicateKey = String(medication.generic_name || medication.medication_code || item.medication_id).toLowerCase();
    medicationKeys.set(duplicateKey, (medicationKeys.get(duplicateKey) || 0) + 1);
    itemDetails.push({
      prescription_item_id: String(item._id),
      medication_id: toPlainId(medication),
      medication_name: medicationName(medication),
      medication_code: medication.medication_code,
      dose: item.dose,
      frequency: item.frequency,
      route: item.route,
      duration_days: item.duration_days,
      quantity: item.quantity,
      dispensed_quantity: item.dispensed_quantity,
      remaining_quantity: remaining,
      unit: item.unit,
      instructions: item.instructions,
      status: item.status,
      stock,
    });
  }

  const latestDispense = dispenses[0] || null;
  const duplicateCount = [...medicationKeys.values()].filter((count) => count > 1).length;
  const waitingMinutes = minutesBetween(prescription.verified_at || prescription.prescribed_at || prescription.created_at);
  const remainingQuantity = Math.max(totalQuantity - dispensedQuantity, 0);

  return {
    prescription: {
      prescription_id: String(prescription._id),
      prescription_no: prescription.prescription_no,
      status: prescription.status,
      prescribed_at: prescription.prescribed_at,
      verified_at: prescription.verified_at,
      note: prescription.note,
    },
    patient: prescription.patient_id,
    encounter: prescription.encounter_id,
    doctor: prescription.prescribed_by,
    verified_by: prescription.verified_by,
    dispense: latestDispense ? {
      dispense_id: String(latestDispense._id),
      dispense_no: latestDispense.dispense_no,
      status: latestDispense.status,
      workflow_stage: latestDispense.workflow_stage,
      assigned_to: latestDispense.assigned_to,
      locked_by: latestDispense.locked_by,
      priority: latestDispense.priority,
      active_hold_count: latestDispense.active_hold_count,
      created_at: latestDispense.created_at,
      completed_at: latestDispense.completed_at,
    } : null,
    dispenses: dispenses.map((dispense) => ({
      dispense_id: String(dispense._id),
      dispense_no: dispense.dispense_no,
      status: dispense.status,
      workflow_stage: dispense.workflow_stage,
      created_at: dispense.created_at,
      completed_at: dispense.completed_at,
    })),
    items_summary: {
      total_items: items.length,
      completed_items: items.filter((item) => item.status === PRESCRIPTION_ITEM_STATUS.COMPLETED).length,
      remaining_items: itemDetails.filter((item) => item.remaining_quantity > 0).length,
      total_quantity: round(totalQuantity),
      dispensed_quantity: round(dispensedQuantity),
      remaining_quantity: round(remainingQuantity),
    },
    item_details: itemDetails,
    stock_summary: {
      can_fulfill_all: shortageItems.length === 0,
      shortage_items: shortageItems,
      shortage_items_count: shortageItems.length,
      near_expiry_items: nearExpiryItems,
      near_expiry_items_count: nearExpiryItems.length,
      fefo_allocations: itemDetails.map((item) => item.stock?.fefo_batch).filter(Boolean),
    },
    safety_summary: {
      has_allergy_warning: allergyConflicts.length > 0,
      has_interaction_warning: itemDetails.length > 1,
      has_duplicate_warning: duplicateCount > 0,
      allergy_conflicts: allergyConflicts,
      duplicate_count: duplicateCount,
    },
    billing_summary: {
      can_create_charge: missingPriceItems.length === 0,
      missing_price_items: missingPriceItems,
      missing_price_count: missingPriceItems.length,
    },
    hold_summary: {
      active_hold_count: holds.length,
      types: [...new Set(holds.map((hold) => hold.hold_type))],
      latest_reason: holds[0]?.reason,
    },
    sla: {
      waiting_minutes: waitingMinutes,
      is_overdue: waitingMinutes >= 30,
      due_at: addMinutes(prescription.verified_at || prescription.prescribed_at || prescription.created_at, 30),
    },
    priority: waitingMinutes >= 90 || allergyConflicts.length || shortageItems.length ? 'high' : waitingMinutes >= 30 ? 'medium' : 'low',
  };
}

function applyQueueFilters(rows = [], query = {}) {
  const search = normalizeString(query.search || query.patient_keyword || query.q).toLowerCase();
  return rows.filter((row) => {
    if (query.risk === 'shortage' && row.stock_summary.shortage_items_count <= 0) return false;
    if (query.risk === 'allergy' && !row.safety_summary.has_allergy_warning) return false;
    if (query.risk === 'interaction' && !row.safety_summary.has_interaction_warning) return false;
    if (query.risk === 'missing_price' && row.billing_summary.missing_price_count <= 0) return false;
    if (query.status === 'not_created' && row.dispense) return false;
    if (query.status === 'draft' && row.dispense?.status !== DISPENSE_STATUS.DRAFT) return false;
    if (query.status === 'partially_dispensed' && row.prescription.status !== PRESCRIPTION_STATUS.PARTIALLY_DISPENSED) return false;
    if (!search) return true;
    return [
      row.prescription.prescription_no,
      row.dispense?.dispense_no,
      row.patient?.full_name,
      row.patient?.patient_code,
      row.patient?.phone,
      row.encounter?.encounter_code,
      row.doctor?.full_name,
    ].filter(Boolean).join(' ').toLowerCase().includes(search);
  });
}

async function getDispensingQueue(query = {}, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ, PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT]);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = { status: { $in: DISPENSING_PRESCRIPTION_STATUSES } };
  if (query.prescription_status) filter.status = query.prescription_status;
  if (query.department_id) {
    const encounters = await Encounter.find({ department_id: toObjectId(query.department_id, 'department_id') }).select('_id').lean();
    filter.encounter_id = { $in: encounters.map((encounter) => encounter._id) };
  }
  if (query.doctor_id) filter.prescribed_by = toObjectId(query.doctor_id, 'doctor_id');

  if (query.search || query.patient_keyword || query.q) {
    const keyword = escapeRegex(query.search || query.patient_keyword || query.q);
    const [patients, encounters] = await Promise.all([
      Patient.find({
        $or: [
          { full_name: { $regex: keyword, $options: 'i' } },
          { patient_code: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').limit(100).lean(),
      Encounter.find({ encounter_code: { $regex: keyword, $options: 'i' } }).select('_id').limit(100).lean(),
    ]);
    filter.$or = [
      { prescription_no: { $regex: keyword, $options: 'i' } },
      { patient_id: { $in: patients.map((patient) => patient._id) } },
      { encounter_id: { $in: encounters.map((encounter) => encounter._id) } },
    ];
  }

  const prescriptions = await Prescription.find(filter)
    .sort({ verified_at: 1, prescribed_at: 1, created_at: 1 })
    .limit(Math.max(skip + limit, 120))
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate({
      path: 'encounter_id',
      select: 'encounter_code encounter_type status start_time department_id attending_doctor_id',
      populate: { path: 'department_id', select: 'department_code department_name name' },
    })
    .populate('prescribed_by', 'full_name username employee_code')
    .populate('verified_by', 'full_name username employee_code')
    .lean();

  const rows = applyQueueFilters(
    await Promise.all(prescriptions.map((prescription) => buildQueueItem(prescription, {
      storage_location: query.storage_location,
    }))),
    query,
  );

  rows.sort((first, second) => {
    if (first.stock_summary.shortage_items_count !== second.stock_summary.shortage_items_count) {
      return second.stock_summary.shortage_items_count - first.stock_summary.shortage_items_count;
    }
    return second.sla.waiting_minutes - first.sla.waiting_minutes;
  });

  return {
    items: rows.slice(skip, skip + limit),
    pagination: buildPagination(page, limit, rows.length),
  };
}

async function getDispensingQueueSummary(query = {}, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ, PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT]);
  const queue = await getDispensingQueue({ ...query, page: 1, limit: 100 }, actor);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [draftDispenses, partialDispenses, completedToday, returnedToday, activeHolds, printJobs] = await Promise.all([
    Dispense.countDocuments({ status: DISPENSE_STATUS.DRAFT }),
    Dispense.countDocuments({ status: DISPENSE_STATUS.PARTIALLY_DISPENSED }),
    Dispense.countDocuments({ status: DISPENSE_STATUS.DISPENSED, completed_at: { $gte: todayStart } }),
    Dispense.countDocuments({ status: DISPENSE_STATUS.RETURNED, updated_at: { $gte: todayStart } }),
    DispenseHold.countDocuments({ status: 'active' }),
    DispensePrintJob.countDocuments({ status: 'queued' }),
  ]);
  const rows = queue.items || [];
  const waitingMinutes = rows.map((row) => row.sla.waiting_minutes);
  return {
    waiting_prescriptions: rows.length,
    draft_dispenses: draftDispenses,
    partially_dispensed: partialDispenses,
    stock_shortage: rows.filter((row) => row.stock_summary.shortage_items_count > 0).length,
    allergy_warning: rows.filter((row) => row.safety_summary.has_allergy_warning).length,
    missing_price: rows.filter((row) => row.billing_summary.missing_price_count > 0).length,
    over_sla: rows.filter((row) => row.sla.is_overdue).length,
    completed_today: completedToday,
    returned_today: returnedToday,
    active_holds: activeHolds,
    queued_print_jobs: printJobs,
    avg_wait_minutes: waitingMinutes.length ? round(waitingMinutes.reduce((sum, value) => sum + value, 0) / waitingMinutes.length, 1) : 0,
  };
}

async function assignDispense(dispenseId, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.CREATE, PERMISSION.DISPENSES.COMPLETE]);
  const assignedTo = payload.assigned_to || payload.user_id || actorId(actor);
  if (!assignedTo) throw createError('assigned_to là bắt buộc.', 400);
  const dispense = await getDispenseOrThrow(dispenseId);
  if (!OPEN_DISPENSE_STATUSES.includes(dispense.status)) throw createError('Chỉ phiếu đang mở mới được gán dược sĩ.', 409);
  dispense.assigned_to = toObjectId(assignedTo, 'assigned_to');
  dispense.assigned_at = new Date();
  dispense.workflow_stage = dispense.workflow_stage === 'created' ? 'assigned' : dispense.workflow_stage;
  dispense.priority = payload.priority || dispense.priority || 'medium';
  dispense.sla_due_at = payload.sla_due_at ? parseDate(payload.sla_due_at, 'sla_due_at') : dispense.sla_due_at || addMinutes(dispense.created_at, 30);
  dispense.updated_by = actorId(actor);
  await dispense.save();
  await recordAuditLog({ actor, action: 'dispense.assigned', targetType: 'dispense', targetId: dispense._id, status: 'success', message: 'Gán phiếu cấp phát thành công.', requestMeta });
  return { dispense };
}

async function startDispensePreparation(dispenseId, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE]);
  const dispense = await getDispenseOrThrow(dispenseId);
  if (!OPEN_DISPENSE_STATUSES.includes(dispense.status)) throw createError('Chỉ phiếu đang mở mới được bắt đầu chuẩn bị.', 409);
  if (!dispense.assigned_to) {
    dispense.assigned_to = actorId(actor);
    dispense.assigned_at = new Date();
  }
  dispense.preparation_started_at = dispense.preparation_started_at || new Date();
  dispense.workflow_stage = payload.stage || 'picking';
  dispense.updated_by = actorId(actor);
  await dispense.save();
  await recordAuditLog({ actor, action: 'dispense.preparation_started', targetType: 'dispense', targetId: dispense._id, status: 'success', message: 'Bắt đầu chuẩn bị phiếu cấp phát.', requestMeta });
  return { dispense };
}

async function changeDispenseStage(dispenseId, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE]);
  const stage = payload.workflow_stage || payload.stage;
  if (!DISPENSE_WORKFLOW_STAGES.includes(stage)) throw createError('workflow_stage không hợp lệ.', 400);
  const dispense = await getDispenseOrThrow(dispenseId);
  if (!OPEN_DISPENSE_STATUSES.includes(dispense.status)) throw createError('Chỉ phiếu đang mở mới được đổi stage.', 409);
  const beforeStage = dispense.workflow_stage;
  dispense.workflow_stage = stage;
  if (stage === 'picking') dispense.preparation_started_at = dispense.preparation_started_at || new Date();
  if (stage === 'ready_to_handover') dispense.preparation_completed_at = dispense.preparation_completed_at || new Date();
  if (payload.note) dispense.note = [dispense.note, payload.note].filter(Boolean).join('\n');
  dispense.updated_by = actorId(actor);
  await dispense.save();
  await recordAuditLog({ actor, action: 'dispense.stage_changed', targetType: 'dispense', targetId: dispense._id, status: 'success', message: 'Đổi stage phiếu cấp phát.', requestMeta, metadata: { from_stage: beforeStage, to_stage: stage } });
  return { dispense };
}

async function lockDispense(dispenseId, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE]);
  const dispense = await getDispenseOrThrow(dispenseId);
  const lockTtlMinutes = Number(payload.lock_ttl_minutes || 30);
  const isFreshLock = dispense.locked_by && dispense.locked_at && minutesBetween(dispense.locked_at) < lockTtlMinutes;
  if (isFreshLock && !sameId(dispense.locked_by, actorId(actor)) && !payload.force) {
    throw createError('Phiếu đang bị khóa bởi dược sĩ khác.', 409);
  }
  dispense.locked_by = actorId(actor);
  dispense.locked_at = new Date();
  dispense.updated_by = actorId(actor);
  await dispense.save();
  await recordAuditLog({ actor, action: 'dispense.locked', targetType: 'dispense', targetId: dispense._id, status: 'success', message: 'Khóa phiếu cấp phát.', requestMeta });
  return { dispense };
}

async function unlockDispense(dispenseId, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE]);
  const dispense = await getDispenseOrThrow(dispenseId);
  if (dispense.locked_by && !sameId(dispense.locked_by, actorId(actor)) && !payload.force && !hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Chỉ người đang khóa phiếu mới được mở khóa.', 409);
  }
  dispense.locked_by = undefined;
  dispense.locked_at = undefined;
  dispense.updated_by = actorId(actor);
  await dispense.save();
  await recordAuditLog({ actor, action: 'dispense.unlocked', targetType: 'dispense', targetId: dispense._id, status: 'success', message: 'Mở khóa phiếu cấp phát.', requestMeta });
  return { dispense };
}

async function getDispenseChecklist(dispenseId, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ]);
  const dispense = await getDispenseOrThrow(dispenseId);
  await ensureDispenseChecklist(dispense);
  return {
    dispense_id: String(dispense._id),
    status: dispense.checklist_status || 'pending',
    completed_by: dispense.checklist_completed_by,
    completed_at: dispense.checklist_completed_at,
    items: normalizeChecklist(dispense.checklist),
  };
}

async function updateDispenseChecklistItem(dispenseId, code, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE]);
  const dispense = await getDispenseOrThrow(dispenseId);
  await ensureDispenseChecklist(dispense);
  const checklist = normalizeChecklist(dispense.checklist);
  const item = checklist.find((entry) => entry.code === code);
  if (!item) throw createError('Không tìm thấy checklist code.', 404);
  const status = payload.status || 'checked';
  if (!['pending', 'checked', 'skipped', 'failed'].includes(status)) throw createError('Checklist status không hợp lệ.', 400);
  item.status = status;
  item.checked_by = status === 'pending' ? undefined : actorId(actor);
  item.checked_at = status === 'pending' ? undefined : new Date();
  item.note = payload.note;
  dispense.checklist = checklist;
  dispense.checklist_status = checklist.every((entry) => ['checked', 'skipped'].includes(entry.status)) ? 'completed' : 'pending';
  if (dispense.checklist_status === 'completed') {
    dispense.checklist_completed_by = actorId(actor);
    dispense.checklist_completed_at = new Date();
  }
  dispense.updated_by = actorId(actor);
  await dispense.save();
  await recordAuditLog({ actor, action: 'dispense.checklist_item_updated', targetType: 'dispense', targetId: dispense._id, status: 'success', message: 'Cập nhật checklist cấp phát.', requestMeta, metadata: { code, checklist_status: status } });
  return getDispenseChecklist(dispense._id, actor);
}

async function completeDispenseChecklist(dispenseId, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.COMPLETE]);
  const dispense = await getDispenseOrThrow(dispenseId);
  await ensureDispenseChecklist(dispense);
  const checklist = normalizeChecklist(dispense.checklist);
  const pending = checklist.filter((item) => item.status === 'pending' || item.status === 'failed');
  if (pending.length && !payload.override) {
    throw createError('Checklist còn mục chưa đạt, cần hoàn tất hoặc override.', 409, { pending_codes: pending.map((item) => item.code) });
  }
  dispense.checklist = checklist.map((item) => item.status === 'pending' ? { ...item, status: 'skipped', note: item.note || payload.override_reason || 'Override checklist.' } : item);
  dispense.checklist_status = 'completed';
  dispense.checklist_completed_by = actorId(actor);
  dispense.checklist_completed_at = new Date();
  dispense.preparation_completed_at = dispense.preparation_completed_at || new Date();
  dispense.workflow_stage = 'ready_to_handover';
  dispense.updated_by = actorId(actor);
  await dispense.save();
  await recordAuditLog({ actor, action: 'dispense.checklist_completed', targetType: 'dispense', targetId: dispense._id, status: 'success', message: 'Hoàn tất checklist cấp phát.', requestMeta });
  return getDispenseChecklist(dispense._id, actor);
}

async function createDispenseHold(dispenseId, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.CANCEL, PERMISSION.DISPENSES.COMPLETE]);
  const reason = normalizeString(payload.reason || payload.note);
  if (!reason) throw createError('reason là bắt buộc khi tạm giữ/từ chối.', 400);
  let holdId;
  await withOptionalTransaction(async (session) => {
    const dispense = await getDispenseOrThrow(dispenseId, session);
    const holdNo = await generateHoldNo(session);
    const [hold] = await DispenseHold.create([{
      hold_no: holdNo,
      dispense_id: dispense._id,
      prescription_id: dispense.prescription_id,
      prescription_item_id: payload.prescription_item_id || undefined,
      patient_id: dispense.patient_id,
      encounter_id: dispense.encounter_id,
      medication_id: payload.medication_id || undefined,
      hold_type: payload.hold_type || 'other',
      severity: payload.severity || 'medium',
      reason,
      note: payload.note,
      status: payload.status === 'rejected' ? 'rejected' : 'active',
      assigned_to: payload.assigned_to || actorId(actor),
      due_at: payload.due_at ? parseDate(payload.due_at, 'due_at') : addMinutes(new Date(), Number(payload.sla_minutes || 30)),
      created_by: actorId(actor),
      updated_by: actorId(actor),
    }], sessionOptions(session));
    holdId = hold._id;
    const activeHoldCount = await withSession(DispenseHold.countDocuments({ dispense_id: dispense._id, status: 'active' }), session);
    dispense.hold_count = normalizeNumber(dispense.hold_count) + 1;
    dispense.active_hold_count = activeHoldCount;
    dispense.last_hold_reason = reason;
    dispense.last_hold_at = new Date();
    dispense.workflow_stage = 'blocked';
    dispense.updated_by = actorId(actor);
    await dispense.save(sessionOptions(session));
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'dispense.hold_created', targetType: 'dispense_hold', targetId: holdId, status: 'success', message: 'Tạo hold cấp phát.', requestMeta });
  return getDispenseHoldDetail(holdId, actor);
}

async function listDispenseHolds(query = {}, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ]);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  for (const field of ['dispense_id', 'prescription_id', 'patient_id', 'medication_id', 'assigned_to']) {
    if (query[field]) filter[field] = toObjectId(query[field], field);
  }
  for (const field of ['hold_type', 'severity', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.open === 'true') filter.status = 'active';
  if (query.search) {
    const pattern = escapeRegex(query.search);
    filter.$or = [
      { hold_no: { $regex: pattern, $options: 'i' } },
      { reason: { $regex: pattern, $options: 'i' } },
      { note: { $regex: pattern, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    DispenseHold.find(filter)
      .sort({ status: 1, severity: 1, due_at: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('dispense_id', 'dispense_no status workflow_stage')
      .populate('prescription_id', 'prescription_no status')
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('medication_id', 'medication_code generic_name brand_name strength')
      .populate('assigned_to', 'full_name username employee_code')
      .populate('created_by', 'full_name username employee_code')
      .lean(),
    DispenseHold.countDocuments(filter),
  ]);
  const summary = {
    active: await DispenseHold.countDocuments({ status: 'active' }),
    rejected: await DispenseHold.countDocuments({ status: 'rejected' }),
    resolved_today: await DispenseHold.countDocuments({ status: 'resolved', resolved_at: { $gte: new Date(Date.now() - 86400000) } }),
    overdue: await DispenseHold.countDocuments({ status: 'active', due_at: { $lte: new Date() } }),
  };
  return { summary, items, pagination: buildPagination(page, limit, total) };
}

async function getDispenseHoldDetail(holdId, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ]);
  const hold = await DispenseHold.findById(holdId)
    .populate('dispense_id', 'dispense_no status workflow_stage')
    .populate('prescription_id', 'prescription_no status')
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('medication_id', 'medication_code generic_name brand_name strength')
    .populate('assigned_to', 'full_name username employee_code')
    .lean();
  if (!hold) throw createError('Không tìm thấy hold cấp phát.', 404);
  return { hold };
}

async function updateHoldStatus(holdId, payload = {}, actor = {}, requestMeta = {}, status) {
  assertPermissions(actor, [PERMISSION.DISPENSES.UPDATE, PERMISSION.DISPENSES.CANCEL, PERMISSION.DISPENSES.COMPLETE]);
  const hold = await DispenseHold.findById(holdId);
  if (!hold) throw createError('Không tìm thấy hold cấp phát.', 404);
  if (hold.status !== 'active') throw createError('Hold đã được xử lý.', 409);
  hold.status = status;
  hold.resolved_by = actorId(actor);
  hold.resolved_at = new Date();
  hold.resolution_type = payload.resolution_type || (status === 'rejected' ? 'rejected' : status === 'cancelled' ? 'cancelled' : 'continue_dispense');
  hold.resolution_note = payload.resolution_note || payload.note;
  hold.updated_by = actorId(actor);
  await hold.save();
  const activeHoldCount = await DispenseHold.countDocuments({ dispense_id: hold.dispense_id, status: 'active' });
  await Dispense.updateOne(
    { _id: hold.dispense_id },
    {
      $set: {
        active_hold_count: activeHoldCount,
        workflow_stage: activeHoldCount ? 'blocked' : 'picking',
        updated_by: actorId(actor),
      },
    },
  );
  await recordAuditLog({ actor, action: `dispense.hold_${status}`, targetType: 'dispense_hold', targetId: hold._id, status: 'success', message: 'Cập nhật hold cấp phát.', requestMeta });
  return getDispenseHoldDetail(hold._id, actor);
}

function resolveDispenseHold(holdId, payload = {}, actor = {}, requestMeta = {}) {
  return updateHoldStatus(holdId, payload, actor, requestMeta, 'resolved');
}

function rejectDispenseHold(holdId, payload = {}, actor = {}, requestMeta = {}) {
  return updateHoldStatus(holdId, payload, actor, requestMeta, 'rejected');
}

function cancelDispenseHold(holdId, payload = {}, actor = {}, requestMeta = {}) {
  return updateHoldStatus(holdId, payload, actor, requestMeta, 'cancelled');
}

async function getReturnableDispenseItems(dispenseId, session = null) {
  return withSession(DispenseItem.find({ dispense_id: dispenseId, status: { $in: [DISPENSE_ITEM_STATUS.DISPENSED, DISPENSE_ITEM_STATUS.RETURNED] } })
    .populate('medication_id', 'medication_code generic_name brand_name strength unit sale_price')
    .populate('stock_batch_id', 'batch_no lot_no expiry_date quantity_on_hand status storage_location unit_cost')
    .lean(), session);
}

function normalizeReturnRequests(items = [], payloadItems = []) {
  const byId = new Map(items.map((item) => [String(item._id), item]));
  const requested = Array.isArray(payloadItems) && payloadItems.length
    ? payloadItems
    : items
      .filter((item) => normalizeNumber(item.quantity) - normalizeNumber(item.returned_quantity) > 0)
      .map((item) => ({ dispense_item_id: item._id, quantity: normalizeNumber(item.quantity) - normalizeNumber(item.returned_quantity), disposition: 'restock' }));
  if (!requested.length) throw createError('Không còn dòng thuốc có thể hoàn trả.', 409);
  return requested.map((raw) => {
    const item = byId.get(String(raw.dispense_item_id));
    if (!item) throw createError('dispense_item_id không thuộc phiếu cấp phát.', 409);
    const quantity = parsePositiveNumber(raw.quantity, 'quantity');
    const returnable = Math.max(normalizeNumber(item.quantity) - normalizeNumber(item.returned_quantity), 0);
    if (quantity > returnable) throw createError('Số lượng hoàn vượt số lượng còn có thể hoàn.', 409);
    return {
      item,
      quantity,
      return_condition: raw.return_condition || 'unknown',
      disposition: raw.disposition || 'restock',
      note: raw.note,
    };
  });
}

async function previewDispenseReturn(dispenseId, payload = {}, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.RETURN]);
  const dispense = await Dispense.findById(dispenseId)
    .populate('patient_id', 'patient_code full_name')
    .populate('prescription_id', 'prescription_no status')
    .lean();
  if (!dispense) throw createError('Không tìm thấy phiếu cấp phát.', 404);
  if (dispense.status !== DISPENSE_STATUS.DISPENSED) throw createError('Chỉ phiếu đã cấp phát mới được hoàn trả.', 409);
  const billedCharge = await Charge.exists({ dispense_id: dispenseId, status: CHARGE_STATUS.BILLED });
  const items = await getReturnableDispenseItems(dispenseId);
  const requests = normalizeReturnRequests(items, payload.items);
  const stockImpact = requests.map(({ item, quantity, disposition }) => ({
    dispense_item_id: String(item._id),
    medication_id: toPlainId(item.medication_id),
    medication_name: medicationName(item.medication_id),
    stock_batch_id: toPlainId(item.stock_batch_id),
    batch_no: item.stock_batch_id?.batch_no,
    quantity,
    disposition,
    balance_before: normalizeNumber(item.stock_batch_id?.quantity_on_hand),
    balance_after: ['restock', 'quarantine'].includes(disposition)
      ? round(normalizeNumber(item.stock_batch_id?.quantity_on_hand) + quantity)
      : normalizeNumber(item.stock_batch_id?.quantity_on_hand),
  }));
  const chargeRows = await Charge.find({ dispense_id: dispenseId, status: { $in: ACTIVE_CHARGE_STATUSES } }).lean();
  return {
    can_return: !billedCharge,
    blocking_errors: billedCharge ? ['Phiếu có charge đã billed, cần xử lý invoice/refund trước.'] : [],
    dispense,
    items: requests.map(({ item, quantity, return_condition, disposition, note }) => ({
      dispense_item_id: String(item._id),
      medication_id: toPlainId(item.medication_id),
      medication_name: medicationName(item.medication_id),
      quantity,
      returnable_quantity: Math.max(normalizeNumber(item.quantity) - normalizeNumber(item.returned_quantity), 0),
      return_condition,
      disposition,
      note,
    })),
    stock_impact: stockImpact,
    charge_impact: chargeRows.map((charge) => ({
      charge_id: String(charge._id),
      charge_no: charge.charge_no,
      current_quantity: charge.quantity,
      current_total_amount: charge.total_amount,
      action: 'void_or_reduce_after_return',
    })),
  };
}

async function recalculatePrescriptionAfterReturn(prescriptionId, actor = {}, session = null) {
  const items = await withSession(PrescriptionItem.find({ prescription_id: prescriptionId, status: { $nin: [PRESCRIPTION_ITEM_STATUS.CANCELLED, PRESCRIPTION_ITEM_STATUS.STOPPED] } }), session);
  let anyDispensed = false;
  let allDispensed = items.length > 0;
  for (const item of items) {
    const rows = await withSession(DispenseItem.find({ prescription_item_id: item._id, status: DISPENSE_ITEM_STATUS.DISPENSED }).lean(), session);
    const dispensedQuantity = rows.reduce((sum, row) => sum + Math.max(normalizeNumber(row.quantity) - normalizeNumber(row.returned_quantity), 0), 0);
    item.dispensed_quantity = round(dispensedQuantity);
    item.status = dispensedQuantity >= normalizeNumber(item.quantity) ? PRESCRIPTION_ITEM_STATUS.COMPLETED : PRESCRIPTION_ITEM_STATUS.ACTIVE;
    item.updated_by = actorId(actor);
    await item.save(sessionOptions(session));
    anyDispensed = anyDispensed || dispensedQuantity > 0;
    allDispensed = allDispensed && dispensedQuantity >= normalizeNumber(item.quantity);
  }
  const prescription = await withSession(Prescription.findById(prescriptionId), session);
  if (!prescription) return null;
  prescription.status = allDispensed
    ? PRESCRIPTION_STATUS.FULLY_DISPENSED
    : anyDispensed
      ? PRESCRIPTION_STATUS.PARTIALLY_DISPENSED
      : PRESCRIPTION_STATUS.VERIFIED;
  prescription.updated_by = actorId(actor);
  await prescription.save(sessionOptions(session));
  return prescription;
}

async function adjustChargeForReturn(item, returnQuantity, actor = {}, session = null) {
  const charge = await withSession(Charge.findOne({
    dispense_item_id: item._id,
    status: { $in: ACTIVE_CHARGE_STATUSES },
  }), session);
  if (!charge) return 'none';
  const remainingQuantity = Math.max(normalizeNumber(charge.quantity) - normalizeNumber(returnQuantity), 0);
  if (remainingQuantity <= 0) {
    charge.status = CHARGE_STATUS.VOIDED;
    charge.voided_by = actorId(actor);
    charge.voided_at = new Date();
    charge.void_reason = 'Hoàn trả thuốc.';
    charge.updated_by = actorId(actor);
    await charge.save(sessionOptions(session));
    return 'voided';
  }
  charge.quantity = remainingQuantity;
  charge.total_amount = Math.round(remainingQuantity * normalizeNumber(charge.unit_price));
  charge.updated_by = actorId(actor);
  await charge.save(sessionOptions(session));
  return 'reduced';
}

async function processDispenseReturn(returnDoc, actor = {}, session = null) {
  const returnItems = await withSession(DispenseReturnItem.find({ dispense_return_id: returnDoc._id }), session);
  const dispense = await getDispenseOrThrow(returnDoc.dispense_id, session);
  const billedCharge = await withSession(Charge.exists({ dispense_id: dispense._id, status: CHARGE_STATUS.BILLED }), session);
  if (billedCharge) throw createError('Charge thuốc đã lên invoice; cần refund/void invoice trước khi return.', 409);
  const transactionIds = [];
  for (const returnItem of returnItems) {
    const item = await withSession(DispenseItem.findById(returnItem.dispense_item_id), session);
    if (!item) throw createError('Không tìm thấy dispense item để hoàn.', 409);
    const returnable = Math.max(normalizeNumber(item.quantity) - normalizeNumber(item.returned_quantity), 0);
    if (returnItem.quantity > returnable) throw createError('Số lượng hoàn vượt số lượng còn lại.', 409);

    let transaction = null;
    if (['restock', 'quarantine'].includes(returnItem.disposition) && item.stock_batch_id) {
      const batch = await withSession(StockBatch.findOneAndUpdate(
        { _id: item.stock_batch_id, is_deleted: false },
        {
          $inc: { quantity_on_hand: normalizeNumber(returnItem.quantity) },
          $set: { updated_by: actorId(actor) },
        },
        { new: true },
      ), session);
      if (!batch) throw createError('Không tìm thấy stock batch để hoàn kho.', 409);
      if (returnItem.disposition === 'restock' && batch.status === STOCK_BATCH_STATUS.DEPLETED && (!batch.expiry_date || batch.expiry_date > new Date())) {
        batch.status = STOCK_BATCH_STATUS.AVAILABLE;
        await batch.save(sessionOptions(session));
      }
      if (returnItem.disposition === 'quarantine') {
        batch.status = STOCK_BATCH_STATUS.QUARANTINED;
        await batch.save(sessionOptions(session));
      }
      transaction = await createInventoryTransaction({
        medication_id: item.medication_id,
        stock_batch_id: item.stock_batch_id,
        transaction_type: INVENTORY_TRANSACTION_TYPE.RETURN,
        direction: INVENTORY_TRANSACTION_DIRECTION.IN,
        quantity: returnItem.quantity,
        balance_after: batch.quantity_on_hand,
        unit_cost: batch.unit_cost,
        reference_type: 'dispense_return',
        reference_id: returnDoc._id,
        note: `partial_return:${returnItem._id}; disposition:${returnItem.disposition}; reason:${returnDoc.reason}`,
      }, actor, session);
      transactionIds.push(transaction._id);
    }

    item.returned_quantity = round(normalizeNumber(item.returned_quantity) + normalizeNumber(returnItem.quantity));
    if (item.returned_quantity >= normalizeNumber(item.quantity)) item.status = DISPENSE_ITEM_STATUS.RETURNED;
    item.updated_by = actorId(actor);
    await item.save(sessionOptions(session));
    returnItem.inventory_transaction_id = transaction?._id;
    returnItem.charge_action = await adjustChargeForReturn(item, returnItem.quantity, actor, session);
    returnItem.processed_by = actorId(actor);
    returnItem.processed_at = new Date();
    returnItem.updated_by = actorId(actor);
    await returnItem.save(sessionOptions(session));
  }

  returnDoc.status = 'completed';
  returnDoc.completed_by = actorId(actor);
  returnDoc.completed_at = new Date();
  returnDoc.updated_by = actorId(actor);
  await returnDoc.save(sessionOptions(session));

  const remainingItems = await withSession(DispenseItem.countDocuments({ dispense_id: dispense._id, status: DISPENSE_ITEM_STATUS.DISPENSED }), session);
  if (remainingItems === 0) {
    dispense.status = DISPENSE_STATUS.RETURNED;
    dispense.cancelled_by = actorId(actor);
    dispense.cancelled_at = new Date();
    dispense.cancel_reason = returnDoc.reason;
  }
  dispense.updated_by = actorId(actor);
  await dispense.save(sessionOptions(session));
  await recalculatePrescriptionAfterReturn(dispense.prescription_id, actor, session);
  return transactionIds;
}

async function createDispenseReturn(dispenseId, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.RETURN]);
  const reason = normalizeString(payload.reason || payload.note);
  if (!reason) throw createError('reason là bắt buộc khi hoàn trả.', 400);
  let returnId;
  await withOptionalTransaction(async (session) => {
    const dispense = await getDispenseOrThrow(dispenseId, session);
    if (dispense.status !== DISPENSE_STATUS.DISPENSED) throw createError('Chỉ phiếu đã cấp phát mới được hoàn trả.', 409);
    const preview = await previewDispenseReturn(dispenseId, payload, actor);
    if (!preview.can_return) throw createError(preview.blocking_errors[0], 409);
    const returnNo = await generateReturnNo(session);
    const [returnDoc] = await DispenseReturn.create([{
      dispense_id: dispense._id,
      return_no: returnNo,
      patient_id: dispense.patient_id,
      encounter_id: dispense.encounter_id,
      reason,
      status: payload.auto_complete === false ? 'requested' : 'approved',
      requested_by: actorId(actor),
      requested_at: new Date(),
      approved_by: payload.auto_complete === false ? undefined : actorId(actor),
      approved_at: payload.auto_complete === false ? undefined : new Date(),
      note: payload.note,
      created_by: actorId(actor),
      updated_by: actorId(actor),
    }], sessionOptions(session));
    returnId = returnDoc._id;
    const sourceItems = await getReturnableDispenseItems(dispenseId, session);
    const requests = normalizeReturnRequests(sourceItems, payload.items);
    await DispenseReturnItem.create(requests.map(({ item, quantity, return_condition, disposition, note }) => ({
      dispense_return_id: returnDoc._id,
      dispense_id: dispense._id,
      dispense_item_id: item._id,
      medication_id: item.medication_id?._id || item.medication_id,
      stock_batch_id: item.stock_batch_id?._id || item.stock_batch_id,
      quantity,
      return_condition,
      disposition,
      note,
      created_by: actorId(actor),
      updated_by: actorId(actor),
    })), sessionOptions(session));
    if (payload.auto_complete !== false) {
      await processDispenseReturn(returnDoc, actor, session);
    }
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'dispense.return_created', targetType: 'dispense_return', targetId: returnId, status: 'success', message: 'Tạo hoàn trả thuốc.', requestMeta, metadata: { dispense_id: dispenseId } });
  return getDispenseReturnDetail(returnId, actor);
}

async function listDispenseReturns(query = {}, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.RETURN]);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  for (const field of ['dispense_id', 'patient_id', 'encounter_id']) {
    if (query[field]) filter[field] = toObjectId(query[field], field);
  }
  if (query.status) filter.status = query.status;
  if (query.search) {
    const pattern = escapeRegex(query.search);
    filter.$or = [
      { return_no: { $regex: pattern, $options: 'i' } },
      { reason: { $regex: pattern, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    DispenseReturn.find(filter)
      .sort({ requested_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('dispense_id', 'dispense_no status')
      .populate('patient_id', 'patient_code full_name phone')
      .populate('requested_by', 'full_name username employee_code')
      .populate('completed_by', 'full_name username employee_code')
      .lean(),
    DispenseReturn.countDocuments(filter),
  ]);
  const summary = {
    total: total,
    requested: await DispenseReturn.countDocuments({ status: 'requested' }),
    completed_today: await DispenseReturn.countDocuments({ status: 'completed', completed_at: { $gte: new Date(Date.now() - 86400000) } }),
    cancelled: await DispenseReturn.countDocuments({ status: 'cancelled' }),
  };
  return { summary, items, pagination: buildPagination(page, limit, total) };
}

async function getDispenseReturnDetail(returnId, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.RETURN]);
  const dispenseReturn = await DispenseReturn.findById(returnId)
    .populate('dispense_id', 'dispense_no status')
    .populate('patient_id', 'patient_code full_name phone')
    .populate('requested_by', 'full_name username employee_code')
    .populate('approved_by', 'full_name username employee_code')
    .populate('completed_by', 'full_name username employee_code')
    .lean();
  if (!dispenseReturn) throw createError('Không tìm thấy phiếu hoàn trả.', 404);
  const items = await DispenseReturnItem.find({ dispense_return_id: returnId })
    .populate('dispense_item_id', 'quantity returned_quantity unit status')
    .populate('medication_id', 'medication_code generic_name brand_name strength')
    .populate('stock_batch_id', 'batch_no lot_no expiry_date storage_location status')
    .populate('inventory_transaction_id', 'transaction_no quantity balance_after occurred_at')
    .lean();
  return { return: dispenseReturn, items };
}

async function approveDispenseReturn(returnId, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.RETURN]);
  const doc = await DispenseReturn.findById(returnId);
  if (!doc) throw createError('Không tìm thấy phiếu hoàn trả.', 404);
  if (doc.status !== 'requested') throw createError('Chỉ phiếu requested mới được approve.', 409);
  doc.status = 'approved';
  doc.approved_by = actorId(actor);
  doc.approved_at = new Date();
  doc.note = payload.note || doc.note;
  doc.updated_by = actorId(actor);
  await doc.save();
  await recordAuditLog({ actor, action: 'dispense.return_approved', targetType: 'dispense_return', targetId: doc._id, status: 'success', message: 'Duyệt hoàn trả thuốc.', requestMeta });
  return getDispenseReturnDetail(doc._id, actor);
}

async function completeDispenseReturn(returnId, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.RETURN]);
  await withOptionalTransaction(async (session) => {
    const doc = await withSession(DispenseReturn.findById(returnId), session);
    if (!doc) throw createError('Không tìm thấy phiếu hoàn trả.', 404);
    if (doc.status === 'completed') return;
    if (!['requested', 'approved'].includes(doc.status)) throw createError('Phiếu hoàn trả không thể complete.', 409);
    if (doc.status === 'requested') {
      doc.status = 'approved';
      doc.approved_by = actorId(actor);
      doc.approved_at = new Date();
      await doc.save(sessionOptions(session));
    }
    if (payload.note) doc.note = payload.note;
    await processDispenseReturn(doc, actor, session);
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'dispense.return_completed', targetType: 'dispense_return', targetId: returnId, status: 'success', message: 'Hoàn tất hoàn trả thuốc.', requestMeta });
  return getDispenseReturnDetail(returnId, actor);
}

async function cancelDispenseReturn(returnId, payload = {}, actor = {}, requestMeta = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.RETURN]);
  const doc = await DispenseReturn.findById(returnId);
  if (!doc) throw createError('Không tìm thấy phiếu hoàn trả.', 404);
  if (doc.status === 'completed') throw createError('Phiếu hoàn trả đã completed không thể hủy.', 409);
  doc.status = 'cancelled';
  doc.cancelled_by = actorId(actor);
  doc.cancelled_at = new Date();
  doc.cancel_reason = payload.reason || payload.note;
  doc.updated_by = actorId(actor);
  await doc.save();
  await recordAuditLog({ actor, action: 'dispense.return_cancelled', targetType: 'dispense_return', targetId: doc._id, status: 'success', message: 'Hủy hoàn trả thuốc.', requestMeta });
  return getDispenseReturnDetail(doc._id, actor);
}

async function buildLabelPayload(dispenseId, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ]);
  const dispense = await Dispense.findById(dispenseId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('prescription_id', 'prescription_no status prescribed_at prescribed_by')
    .populate('encounter_id', 'encounter_code department_id encounter_type')
    .populate('dispensed_by', 'full_name username employee_code')
    .populate('completed_by', 'full_name username employee_code')
    .lean();
  if (!dispense) throw createError('Không tìm thấy phiếu cấp phát.', 404);
  const items = await DispenseItem.find({ dispense_id: dispenseId, status: { $in: [DISPENSE_ITEM_STATUS.DISPENSED, DISPENSE_ITEM_STATUS.PLANNED] } })
    .populate('prescription_item_id', 'dose frequency route duration_days quantity unit instructions')
    .populate('medication_id', 'medication_code generic_name brand_name strength dosage_form route_default unit')
    .populate('stock_batch_id', 'batch_no lot_no expiry_date storage_location')
    .lean();
  const defaultTemplate = await MedicationLabelTemplate.findOne({ status: 'active', is_default: true }).lean();
  const labels = items.map((item) => ({
    label_id: String(item._id),
    patient_name: personName(dispense.patient_id, 'Bệnh nhân'),
    patient_code: dispense.patient_id?.patient_code,
    medication_name: medicationName(item.medication_id),
    medication_code: item.medication_id?.medication_code,
    strength: item.medication_id?.strength,
    dosage_form: item.medication_id?.dosage_form,
    route: item.prescription_item_id?.route || item.medication_id?.route_default,
    dose: item.prescription_item_id?.dose,
    frequency: item.prescription_item_id?.frequency,
    quantity: Math.max(normalizeNumber(item.quantity) - normalizeNumber(item.returned_quantity), 0),
    unit: item.unit || item.medication_id?.unit,
    instructions: item.instructions || item.prescription_item_id?.instructions,
    dispensed_at: dispense.dispensed_at || dispense.completed_at || dispense.created_at,
    pharmacist_name: personName(dispense.completed_by || dispense.dispensed_by, 'Dược sĩ'),
    dispense_no: dispense.dispense_no,
    prescription_no: dispense.prescription_id?.prescription_no,
    batch_no: item.stock_batch_id?.batch_no,
    lot_no: item.stock_batch_id?.lot_no,
    expiry_date: item.stock_batch_id?.expiry_date,
    storage_location: item.stock_batch_id?.storage_location,
    qr_payload: `dispense:${dispense.dispense_no};item:${item._id}`,
  }));
  return {
    dispense,
    template: defaultTemplate || {
      template_code: 'DEFAULT_LABEL_70X45',
      name: 'Nhãn thuốc mặc định 70x45',
      paper_size: 'label_70x45',
      width_mm: 70,
      height_mm: 45,
    },
    labels,
    instruction_sheet: {
      patient_name: personName(dispense.patient_id, 'Bệnh nhân'),
      patient_code: dispense.patient_id?.patient_code,
      prescription_no: dispense.prescription_id?.prescription_no,
      dispense_no: dispense.dispense_no,
      items: labels.map((label) => ({
        medication_name: label.medication_name,
        route: label.route,
        dose: label.dose,
        frequency: label.frequency,
        instructions: label.instructions,
        quantity: label.quantity,
        unit: label.unit,
      })),
    },
  };
}

async function createPrintJob(dispenseId, payload = {}, actor = {}, requestMeta = {}, printType = 'label') {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.COMPLETE]);
  const snapshot = await buildLabelPayload(dispenseId, actor);
  const printJobNo = await generatePrintJobNo();
  const job = await DispensePrintJob.create({
    print_job_no: printJobNo,
    dispense_id: dispenseId,
    print_type: payload.print_type || printType,
    template_code: payload.template_code || snapshot.template.template_code,
    status: payload.status || 'printed',
    requested_by: actorId(actor),
    requested_at: new Date(),
    printed_by: payload.status === 'queued' ? undefined : actorId(actor),
    printed_at: payload.status === 'queued' ? undefined : new Date(),
    copy_count: Number(payload.copy_count || 1),
    payload_snapshot: snapshot,
    reprint_reason: payload.reprint_reason,
    created_by: actorId(actor),
    updated_by: actorId(actor),
  });
  await recordAuditLog({ actor, action: `dispense.${printType}_printed`, targetType: 'dispense_print_job', targetId: job._id, status: 'success', message: 'Tạo print job cấp phát.', requestMeta, metadata: { dispense_id: dispenseId, print_type: printType } });
  return { print_job: job, preview: snapshot };
}

function previewDispenseLabels(dispenseId, actor = {}) {
  return buildLabelPayload(dispenseId, actor);
}

function printDispenseLabels(dispenseId, payload = {}, actor = {}, requestMeta = {}) {
  return createPrintJob(dispenseId, payload, actor, requestMeta, 'label');
}

function printDispenseInstructions(dispenseId, payload = {}, actor = {}, requestMeta = {}) {
  return createPrintJob(dispenseId, payload, actor, requestMeta, 'instruction');
}

async function listDispensePrintJobs(query = {}, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ]);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  if (query.dispense_id) filter.dispense_id = toObjectId(query.dispense_id, 'dispense_id');
  if (query.print_type) filter.print_type = query.print_type;
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    DispensePrintJob.find(filter)
      .sort({ requested_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('dispense_id', 'dispense_no status')
      .populate('requested_by', 'full_name username employee_code')
      .populate('printed_by', 'full_name username employee_code')
      .lean(),
    DispensePrintJob.countDocuments(filter),
  ]);
  const summary = {
    queued: await DispensePrintJob.countDocuments({ status: 'queued' }),
    printed_today: await DispensePrintJob.countDocuments({ status: 'printed', printed_at: { $gte: new Date(Date.now() - 86400000) } }),
    failed: await DispensePrintJob.countDocuments({ status: 'failed' }),
  };
  return { summary, items, pagination: buildPagination(page, limit, total) };
}

async function getDispensePrintJobs(dispenseId, actor = {}) {
  return listDispensePrintJobs({ dispense_id: dispenseId, limit: 100 }, actor);
}

async function getDispenseTimeline(dispenseId, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ]);
  const dispense = await Dispense.findById(dispenseId).populate('prescription_id', 'prescription_no status prescribed_at verified_at').lean();
  if (!dispense) throw createError('Không tìm thấy phiếu cấp phát.', 404);
  const [items, transactions, charges, holds, returns, printJobs, audits] = await Promise.all([
    DispenseItem.find({ dispense_id: dispenseId }).lean(),
    InventoryTransaction.find({ $or: [{ reference_type: 'dispense', reference_id: dispenseId }, { note: { $regex: escapeRegex(String(dispenseId)), $options: 'i' } }] }).lean(),
    Charge.find({ dispense_id: dispenseId }).lean(),
    DispenseHold.find({ dispense_id: dispenseId }).lean(),
    DispenseReturn.find({ dispense_id: dispenseId }).lean(),
    DispensePrintJob.find({ dispense_id: dispenseId }).lean(),
    AuditLog.find({ target_type: { $in: ['dispense', 'dispense_hold', 'dispense_return', 'dispense_print_job'] }, target_id: { $in: [toObjectId(dispenseId, 'dispenseId')] } }).limit(80).lean().catch(() => []),
  ]);
  const events = [
    { at: dispense.created_at, type: 'dispense.created', title: 'Tạo phiếu cấp phát', ref: dispense.dispense_no },
    dispense.assigned_at ? { at: dispense.assigned_at, type: 'dispense.assigned', title: 'Gán dược sĩ', ref: dispense.dispense_no } : null,
    dispense.preparation_started_at ? { at: dispense.preparation_started_at, type: 'dispense.preparation_started', title: 'Bắt đầu soạn thuốc', ref: dispense.dispense_no } : null,
    dispense.preparation_completed_at ? { at: dispense.preparation_completed_at, type: 'dispense.ready_to_handover', title: 'Sẵn sàng bàn giao', ref: dispense.dispense_no } : null,
    dispense.completed_at ? { at: dispense.completed_at, type: 'dispense.completed', title: 'Hoàn tất cấp phát', ref: dispense.dispense_no } : null,
    dispense.cancelled_at ? { at: dispense.cancelled_at, type: dispense.status === DISPENSE_STATUS.RETURNED ? 'dispense.returned' : 'dispense.cancelled', title: dispense.status === DISPENSE_STATUS.RETURNED ? 'Hoàn trả toàn phiếu' : 'Hủy phiếu', ref: dispense.cancel_reason } : null,
    ...items.map((item) => ({ at: item.created_at, type: 'dispense.item', title: 'Tạo dòng cấp phát', ref: `${round(item.quantity)} ${item.unit || ''}` })),
    ...transactions.map((item) => ({ at: item.occurred_at, type: `inventory.${item.transaction_type}`, title: 'Giao dịch kho', ref: item.transaction_no })),
    ...charges.map((item) => ({ at: item.charged_at || item.created_at, type: 'billing.charge', title: 'Charge thuốc', ref: item.charge_no })),
    ...holds.map((item) => ({ at: item.created_at, type: 'dispense.hold', title: item.reason, ref: item.hold_no })),
    ...returns.map((item) => ({ at: item.completed_at || item.requested_at || item.created_at, type: 'dispense.return', title: item.reason, ref: item.return_no })),
    ...printJobs.map((item) => ({ at: item.printed_at || item.requested_at || item.created_at, type: `print.${item.print_type}`, title: 'In nhãn/hướng dẫn', ref: item.print_job_no })),
    ...audits.map((item) => ({ at: item.created_at, type: item.action, title: item.message || item.action, ref: item.status })),
  ].filter(Boolean).sort((first, second) => new Date(first.at || 0).getTime() - new Date(second.at || 0).getTime());
  return { dispense, events };
}

async function getDispensingAnalytics(query = {}, actor = {}) {
  assertPermissions(actor, [PERMISSION.DISPENSES.READ, PERMISSION.REPORTS.INVENTORY_READ, PERMISSION.REPORTS.READ]);
  const range = buildDateRange(query);
  const completedMatch = { status: DISPENSE_STATUS.DISPENSED };
  applyDateRange(completedMatch, 'completed_at', range);
  const returnMatch = { status: DISPENSE_STATUS.RETURNED };
  applyDateRange(returnMatch, 'updated_at', range);
  const [dispenses, items, charges, returnedCount, topMedications, byPharmacist, byHour] = await Promise.all([
    Dispense.countDocuments(completedMatch),
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
      { $match: { 'dispense.status': DISPENSE_STATUS.DISPENSED, ...(completedMatch.completed_at ? { 'dispense.completed_at': completedMatch.completed_at } : {}) } },
      { $group: { _id: null, count: { $sum: 1 }, quantity: { $sum: '$quantity' } } },
    ]),
    Charge.aggregate([
      { $match: { dispense_id: { $exists: true }, status: { $nin: [CHARGE_STATUS.VOIDED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.REFUNDED] } } },
      { $group: { _id: null, total_amount: { $sum: '$total_amount' }, count: { $sum: 1 } } },
    ]),
    Dispense.countDocuments(returnMatch),
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
      { $match: { 'dispense.status': DISPENSE_STATUS.DISPENSED, ...(completedMatch.completed_at ? { 'dispense.completed_at': completedMatch.completed_at } : {}) } },
      { $group: { _id: '$medication_id', quantity: { $sum: '$quantity' }, count: { $sum: 1 } } },
      { $sort: { quantity: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'medication_master', localField: '_id', foreignField: '_id', as: 'medication' } },
      { $unwind: { path: '$medication', preserveNullAndEmptyArrays: true } },
    ]),
    Dispense.aggregate([
      { $match: completedMatch },
      { $group: { _id: '$completed_by', dispensed_count: { $sum: 1 }, avg_minutes: { $avg: { $divide: [{ $subtract: ['$completed_at', '$created_at'] }, 60000] } } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'staff' } },
      { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
      { $sort: { dispensed_count: -1 } },
      { $limit: 20 },
    ]),
    Dispense.aggregate([
      { $match: completedMatch },
      { $group: { _id: { $dateToString: { format: '%H:00', date: '$completed_at', timezone: VIETNAM_TIMEZONE } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const itemRow = items[0] || {};
  const chargeRow = charges[0] || {};
  return {
    summary: {
      dispensed_count: dispenses,
      dispense_item_count: itemRow.count || 0,
      total_quantity: round(itemRow.quantity || 0),
      total_charge_amount: chargeRow.total_amount || 0,
      charge_count: chargeRow.count || 0,
      returned_count: returnedCount,
    },
    top_medications: topMedications.map((row) => ({
      medication_id: toPlainId(row._id),
      medication_name: medicationName(row.medication),
      quantity: round(row.quantity || 0),
      dispense_item_count: row.count || 0,
    })),
    by_pharmacist: byPharmacist.map((row) => ({
      pharmacist_id: toPlainId(row._id),
      pharmacist_name: personName(row.staff, 'Dược sĩ'),
      dispensed_count: row.dispensed_count,
      avg_minutes: round(row.avg_minutes || 0, 1),
    })),
    by_hour: byHour.map((row) => ({ hour: row._id, count: row.count })),
  };
}

module.exports = {
  getDispensingQueue,
  getDispensingQueueSummary,
  getDispensingAnalytics,
  getDispenseTimeline,
  assignDispense,
  startDispensePreparation,
  changeDispenseStage,
  lockDispense,
  unlockDispense,
  getDispenseChecklist,
  updateDispenseChecklistItem,
  completeDispenseChecklist,
  createDispenseHold,
  listDispenseHolds,
  getDispenseHoldDetail,
  resolveDispenseHold,
  rejectDispenseHold,
  cancelDispenseHold,
  previewDispenseReturn,
  createDispenseReturn,
  listDispenseReturns,
  getDispenseReturnDetail,
  approveDispenseReturn,
  completeDispenseReturn,
  cancelDispenseReturn,
  previewDispenseLabels,
  printDispenseLabels,
  printDispenseInstructions,
  listDispensePrintJobs,
  getDispensePrintJobs,
};
