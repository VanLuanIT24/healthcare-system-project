const { mongoose } = require('../config/database');
const {
  Allergy,
  Charge,
  Dispense,
  DispenseItem,
  Encounter,
  InventoryTransaction,
  MedicationMaster,
  Order,
  Patient,
  Prescription,
  PrescriptionItem,
  PrescriptionRefillRequest,
  ServiceCatalog,
  StockBatch,
} = require('../models');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const permissionService = require('./permission.service');
const {
  ALLERGY_SEVERITY,
  ALLERGY_STATUS,
  ALLERGY_TYPE,
  CHARGE_STATUS,
  DISPENSE_ITEM_STATUS,
  DISPENSE_STATUS,
  ENCOUNTER_STATUS,
  INVENTORY_TRANSACTION_DIRECTION,
  INVENTORY_TRANSACTION_TYPE,
  MEDICATION_STATUS,
  MEDICATION_STATUSES,
  ORDER_STATUS,
  ORDER_TYPE,
  PRESCRIPTION_ITEM_STATUS,
  PRESCRIPTION_STATUS,
  PRESCRIPTION_REFILL_REQUEST_STATUS,
  SERVICE_STATUS,
  SERVICE_TYPE,
  STOCK_BATCH_STATUS,
} = require('../constants/statuses');
const {
  CHARGE_TRANSITIONS,
  DISPENSE_TRANSITIONS,
  ORDER_TRANSITIONS,
  PRESCRIPTION_ITEM_TRANSITIONS,
  PRESCRIPTION_TRANSITIONS,
  STOCK_BATCH_TRANSITIONS,
} = require('../constants/transitions');
const { PERMISSION } = require('../constants/permissions');
const ERROR_CODE = require('../common/errors/error-codes');
const { assertTransition, canTransition } = require('../shared/utils/status-transition');
const { withOptionalTransaction } = require('../shared/utils/transaction');

const PRESCRIPTION_EDITABLE_STATUSES = [
  PRESCRIPTION_STATUS.DRAFT,
];

const PRESCRIPTION_DISPENSABLE_STATUSES = [
  PRESCRIPTION_STATUS.VERIFIED,
  PRESCRIPTION_STATUS.PARTIALLY_DISPENSED,
];

const PRESCRIPTION_TERMINAL_STATUSES = [
  PRESCRIPTION_STATUS.CANCELLED,
  PRESCRIPTION_STATUS.COMPLETED,
];

const ACTIVE_PRESCRIPTION_ITEM_STATUSES = [
  PRESCRIPTION_ITEM_STATUS.ACTIVE,
];

const STOCK_ALLOCATABLE_STATUSES = [
  STOCK_BATCH_STATUS.AVAILABLE,
];

const ACTIVE_CHARGE_EXCLUDED_STATUSES = [
  CHARGE_STATUS.VOIDED,
  CHARGE_STATUS.CANCELLED,
  CHARGE_STATUS.REFUNDED,
];

const PRESCRIPTION_TO_ORDER_STATUS = {
  [PRESCRIPTION_STATUS.ACTIVE]: ORDER_STATUS.ORDERED,
  [PRESCRIPTION_STATUS.VERIFIED]: ORDER_STATUS.ACKNOWLEDGED,
  [PRESCRIPTION_STATUS.PARTIALLY_DISPENSED]: ORDER_STATUS.IN_PROGRESS,
  [PRESCRIPTION_STATUS.FULLY_DISPENSED]: ORDER_STATUS.COMPLETED,
  [PRESCRIPTION_STATUS.COMPLETED]: ORDER_STATUS.COMPLETED,
  [PRESCRIPTION_STATUS.CANCELLED]: ORDER_STATUS.CANCELLED,
};

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function sameId(left, right) {
  return String(left?._id || left || '') === String(right?._id || right || '');
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes.filter(Boolean));
}

function assertStaffPermission(actor, permissions, message = 'Bạn không có quyền thao tác Pharmacy Module.') {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (!hasAnyPermission(actor, Array.isArray(permissions) ? permissions : [permissions])) {
    throw createError(message, 403);
  }
  return true;
}

function assertActorUser(actor = {}) {
  if (!actor?.userId) throw createError('Actor hiện tại không phải staff user hợp lệ.', 403);
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
}

function nonEmpty(value) {
  return normalizeString(value).length > 0;
}

function booleanQuery(value) {
  return value === true || String(value || '').toLowerCase() === 'true' || String(value || '') === '1';
}

function isDuplicateKeyError(error) {
  return error?.code === 11000 || error?.name === 'MongoServerError' && error?.code === 11000;
}

function toObjectId(id, fieldName = 'id') {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(`${fieldName} không hợp lệ.`);
  return new mongoose.Types.ObjectId(id);
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`);
  return date;
}

function applyDateRangeFilter(filter, fieldName, fromValue, toValue, fromFieldName = `${fieldName}_from`, toFieldName = `${fieldName}_to`) {
  if (!fromValue && !toValue) return;
  filter[fieldName] = {};
  if (fromValue) filter[fieldName].$gte = parseDate(fromValue, fromFieldName);
  if (toValue) filter[fieldName].$lte = parseDate(toValue, toFieldName);
}

function parseNonNegativeNumber(value, fieldName, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw createError(`${fieldName} không hợp lệ.`);
  return number;
}

function parsePositiveNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw createError(`${fieldName} phải lớn hơn 0.`);
  return number;
}

function assertPatientActive(patient) {
  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (patient.status !== 'active') throw createError('Bệnh nhân không active.', 409);
}

function assertEncounterCanReceivePrescription(encounter) {
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  if ([ENCOUNTER_STATUS.COMPLETED, ENCOUNTER_STATUS.CANCELLED].includes(encounter.status)) {
    throw createError('Encounter đã completed/cancelled, không thể thao tác đơn thuốc.', 409);
  }
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

function readAccessPermissions() {
  return {
    global: [PERMISSION.PRESCRIPTIONS.READ],
    own: [PERMISSION.PRESCRIPTIONS.READ_OWN],
    department: [PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
  };
}

function writeAccessPermissions(extra = []) {
  return {
    global: [...extra],
    own: [PERMISSION.PRESCRIPTIONS.READ_OWN, PERMISSION.PRESCRIPTIONS.UPDATE_OWN, ...extra],
    department: [PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, ...extra],
  };
}

async function loadPrescriptionContext(prescription, session = null) {
  const [encounter, patient, order] = await Promise.all([
    withSession(Encounter.findById(prescription.encounter_id).lean(), session),
    withSession(Patient.findById(prescription.patient_id).lean(), session),
    prescription.order_id ? withSession(Order.findById(prescription.order_id).lean(), session) : Promise.resolve(null),
  ]);

  if (!encounter) throw createError('Không tìm thấy encounter của prescription.', 409);
  assertPatientActive(patient);
  if (order && order.order_type !== ORDER_TYPE.MEDICATION) throw createError('Order mẹ không phải medication order.', 409);
  return { encounter, patient, order };
}

function assertPrescriptionAccess(prescription, context, actor = {}, permissions = {}) {
  if (!actorType(actor)) return true;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;

  if (actorType(actor) === 'patient') {
    if (sameId(prescription.patient_id, actor.patientId || actor.patient_id) && hasPermission(actor, PERMISSION.PRESCRIPTIONS.SELF_READ)) {
      return true;
    }
    throw createError('Bạn không có quyền xem đơn thuốc này.', 403);
  }

  if (hasAnyPermission(actor, permissions.global || []) && !actorDepartmentId(actor)) return true;

  if (
    actor.userId
    && (
      sameId(prescription.prescribed_by, actor.userId)
      || sameId(context?.encounter?.attending_doctor_id, actor.userId)
      || sameId(context?.order?.ordered_by, actor.userId)
    )
    && hasAnyPermission(actor, permissions.own || [])
  ) return true;

  const departmentId = actorDepartmentId(actor);
  if (
    departmentId
    && (
      sameId(context?.encounter?.department_id, departmentId)
      || sameId(context?.order?.department_id, departmentId)
    )
    && hasAnyPermission(actor, permissions.department || [])
  ) return true;

  throw createError('Bạn không có quyền thao tác đơn thuốc này.', 403);
}

async function generatePrescriptionNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.PRESCRIPTION, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

async function generateDispenseNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.DISPENSE, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

async function generateInventoryTransactionNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.INVENTORY_TRANSACTION, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

async function generateChargeNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.CHARGE, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

function validatePrescriptionStatusTransition(currentStatus, nextStatus) {
  return assertTransition(PRESCRIPTION_TRANSITIONS, currentStatus, nextStatus, 'prescription');
}

function validatePrescriptionItemStatusTransition(currentStatus, nextStatus) {
  return assertTransition(PRESCRIPTION_ITEM_TRANSITIONS, currentStatus, nextStatus, 'prescription_item');
}

async function updateOrderStatus(orderId, nextStatus, actor, session = null) {
  if (!orderId) return null;
  const order = await withSession(Order.findById(orderId), session);
  if (!order) return null;
  if (order.status === nextStatus) return order;
  assertTransition(ORDER_TRANSITIONS, order.status, nextStatus, 'order');
  order.status = nextStatus;
  order.updated_by = actor?.userId;
  await order.save(sessionOptions(session));
  return order;
}

async function syncPrescriptionStatusToOrder(prescription, actor, session = null, options = {}) {
  if (!prescription.order_id) return null;
  const nextStatus = PRESCRIPTION_TO_ORDER_STATUS[prescription.status];
  if (!nextStatus) return null;
  if (options.allowReverseDispenseStatus) {
    const order = await withSession(Order.findById(prescription.order_id), session);
    if (!order) return null;
    if (order.status === nextStatus) return order;
    order.status = nextStatus;
    order.updated_by = actor?.userId;
    await order.save(sessionOptions(session));
    return order;
  }
  return updateOrderStatus(prescription.order_id, nextStatus, actor, session);
}

async function getPrescriptionOrThrow(prescriptionId, session = null) {
  const prescription = await withSession(Prescription.findById(prescriptionId), session);
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  return prescription;
}

async function getDispenseOrThrow(dispenseId, session = null) {
  const dispense = await withSession(Dispense.findById(dispenseId), session);
  if (!dispense) throw createError('Không tìm thấy dispense.', 404);
  return dispense;
}

async function validateMedicationActive(medicationId, session = null) {
  const medication = await withSession(MedicationMaster.findById(medicationId).lean(), session);
  if (!medication || medication.is_deleted) throw createError('Không tìm thấy thuốc.', 404);
  if (medication.status !== MEDICATION_STATUS.ACTIVE) throw createError('Thuốc hiện không active để kê/cấp phát.', 409);
  return medication;
}

async function validateMedicationAvailableForPrescription(medicationId, session = null) {
  return validateMedicationActive(medicationId, session);
}

async function validateMedicationMutableCode(medicationId) {
  const [stockExists, itemExists] = await Promise.all([
    StockBatch.exists({ medication_id: medicationId, is_deleted: false }),
    PrescriptionItem.exists({ medication_id: medicationId }),
  ]);
  if (stockExists || itemExists) {
    throw createError('Thuốc đã có phát sinh stock/prescription, không được sửa medication_code.', 409);
  }
}

async function createMedication(payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.MEDICATIONS.CREATE, PERMISSION.MEDICATIONS.MANAGE]);
  const medicationCode = payload.medication_code ? normalizeUpper(payload.medication_code) : null;
  if (!medicationCode) throw createError('medication_code là bắt buộc.');
  if (!nonEmpty(payload.generic_name)) throw createError('generic_name là bắt buộc.');
  if (payload.status && !MEDICATION_STATUSES.includes(payload.status)) throw createError('status thuốc không hợp lệ.');

  const existed = await MedicationMaster.exists({ medication_code: medicationCode, is_deleted: false });
  if (existed) throw createError('medication_code đã tồn tại.', 409);

  const medication = await MedicationMaster.create({
    medication_code: medicationCode,
    generic_name: normalizeString(payload.generic_name),
    brand_name: payload.brand_name ? normalizeString(payload.brand_name) : undefined,
    dosage_form: payload.dosage_form ? normalizeString(payload.dosage_form) : undefined,
    strength: payload.strength ? normalizeString(payload.strength) : undefined,
    route_default: payload.route_default ? normalizeString(payload.route_default) : undefined,
    unit: payload.unit ? normalizeString(payload.unit) : undefined,
    service_id: payload.service_id || undefined,
    sale_price: payload.sale_price !== undefined ? parseNonNegativeNumber(payload.sale_price, 'sale_price') : undefined,
    min_stock_level: parseNonNegativeNumber(payload.min_stock_level, 'min_stock_level', 0),
    status: payload.status || MEDICATION_STATUS.ACTIVE,
    created_by: actor?.userId,
    updated_by: actor?.userId,
  });

  await recordAuditLog({ actor, action: 'medication.create', targetType: 'medication', targetId: medication._id, status: 'success', message: 'Tạo thuốc trong danh mục thành công.', requestMeta });
  return getMedicationDetail(medication._id, actor);
}

async function getMedicationStockSummaries(medicationIds = []) {
  const ids = medicationIds.map((id) => toObjectId(id, 'medication_id'));
  if (!ids.length) return new Map();
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
  const rows = await StockBatch.aggregate([
    { $match: { medication_id: { $in: ids }, is_deleted: false } },
    {
      $group: {
        _id: '$medication_id',
        total_on_hand: { $sum: '$quantity_on_hand' },
        available_on_hand: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', STOCK_BATCH_STATUS.AVAILABLE] },
                  { $gt: ['$quantity_on_hand', 0] },
                  {
                    $or: [
                      { $eq: ['$expiry_date', null] },
                      { $gt: ['$expiry_date', now] },
                    ],
                  },
                ],
              },
              '$quantity_on_hand',
              0,
            ],
          },
        },
        batch_count: { $sum: 1 },
        available_batches: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', STOCK_BATCH_STATUS.AVAILABLE] }, { $gt: ['$quantity_on_hand', 0] }] },
              1,
              0,
            ],
          },
        },
        near_expiry_batches: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$expiry_date', null] },
                  { $gte: ['$expiry_date', now] },
                  { $lte: ['$expiry_date', thirtyDaysFromNow] },
                  { $gt: ['$quantity_on_hand', 0] },
                ],
              },
              1,
              0,
            ],
          },
        },
        expired_batches: {
          $sum: {
            $cond: [
              { $or: [{ $eq: ['$status', STOCK_BATCH_STATUS.EXPIRED] }, { $lt: ['$expiry_date', now] }] },
              1,
              0,
            ],
          },
        },
        recalled_batches: {
          $sum: { $cond: [{ $eq: ['$status', STOCK_BATCH_STATUS.RECALLED] }, 1, 0] },
        },
        quarantined_batches: {
          $sum: { $cond: [{ $eq: ['$status', STOCK_BATCH_STATUS.QUARANTINED] }, 1, 0] },
        },
        inventory_value: { $sum: { $multiply: ['$quantity_on_hand', { $ifNull: ['$unit_cost', 0] }] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
}

async function findMedicationIdsByStockFilters(baseFilter = {}, query = {}) {
  const needsStockFilter = booleanQuery(query.below_min_stock)
    || booleanQuery(query.without_stock)
    || booleanQuery(query.has_near_expiry);
  if (!needsStockFilter) return null;

  const now = new Date();
  const days = Math.min(Math.max(Number(query.near_expiry_days || 30), 1), 365);
  const nearExpiryTo = new Date(now.getTime() + days * 86400000);
  const conditions = [];
  if (booleanQuery(query.below_min_stock)) {
    conditions.push({ $expr: { $and: [{ $gt: ['$total_on_hand', 0] }, { $lte: ['$total_on_hand', '$min_stock_level'] }] } });
  }
  if (booleanQuery(query.without_stock)) {
    conditions.push({ available_on_hand: { $lte: 0 } });
  }
  if (booleanQuery(query.has_near_expiry)) {
    conditions.push({ near_expiry_batches: { $gt: 0 } });
  }

  const rows = await MedicationMaster.aggregate([
    { $match: baseFilter },
    {
      $lookup: {
        from: 'stock_batches',
        let: { medicationId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$medication_id', '$$medicationId'] }, is_deleted: false } },
          {
            $group: {
              _id: '$medication_id',
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
              near_expiry_batches: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$expiry_date', null] },
                        { $gte: ['$expiry_date', now] },
                        { $lte: ['$expiry_date', nearExpiryTo] },
                        { $gt: ['$quantity_on_hand', 0] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        as: 'stock',
      },
    },
    {
      $addFields: {
        total_on_hand: { $ifNull: [{ $first: '$stock.total_on_hand' }, 0] },
        available_on_hand: { $ifNull: [{ $first: '$stock.available_on_hand' }, 0] },
        near_expiry_batches: { $ifNull: [{ $first: '$stock.near_expiry_batches' }, 0] },
      },
    },
    { $match: { $and: conditions } },
    { $project: { _id: 1 } },
  ]);
  return rows.map((row) => row._id);
}

async function listMedications(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };
  for (const field of ['status', 'dosage_form', 'route_default']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.search || query.keyword) {
    const keyword = escapeRegex(query.search || query.keyword);
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { medication_code: { $regex: keyword, $options: 'i' } },
          { generic_name: { $regex: keyword, $options: 'i' } },
          { brand_name: { $regex: keyword, $options: 'i' } },
        ],
      },
    ];
  }
  if (booleanQuery(query.missing_price)) {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { sale_price: { $exists: false } },
          { sale_price: null },
          { sale_price: { $lte: 0 } },
        ],
      },
    ];
  }
  if (booleanQuery(query.missing_service)) {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { service_id: { $exists: false } },
          { service_id: null },
        ],
      },
    ];
  }

  const stockFilteredIds = await findMedicationIdsByStockFilters(filter, query);
  if (stockFilteredIds) filter._id = stockFilteredIds.length ? { $in: stockFilteredIds } : { $in: [] };

  const [items, total] = await Promise.all([
    MedicationMaster.find(filter).sort({ generic_name: 1, brand_name: 1 }).skip(skip).limit(limit).lean(),
    MedicationMaster.countDocuments(filter),
  ]);
  const stockSummaries = await getMedicationStockSummaries(items.map((item) => item._id));
  return {
    items: items.map((item) => ({
      ...item,
      stock_summary: stockSummaries.get(String(item._id)) || {
        total_on_hand: 0,
        available_on_hand: 0,
        batch_count: 0,
        available_batches: 0,
        near_expiry_batches: 0,
        expired_batches: 0,
        recalled_batches: 0,
        quarantined_batches: 0,
        inventory_value: 0,
      },
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function searchMedications(query = {}) {
  return listMedications(query);
}

async function getMedicationStockSummary(medicationId) {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [summary] = await StockBatch.aggregate([
    { $match: { medication_id: toObjectId(medicationId, 'medicationId'), is_deleted: false } },
    {
      $group: {
        _id: '$medication_id',
        total_on_hand: { $sum: '$quantity_on_hand' },
        available_batches: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', STOCK_BATCH_STATUS.AVAILABLE] }, { $gt: ['$quantity_on_hand', 0] }] },
              1,
              0,
            ],
          },
        },
        near_expiry_batches: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$expiry_date', null] }, { $lte: ['$expiry_date', thirtyDaysFromNow] }, { $gt: ['$quantity_on_hand', 0] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  return summary || { total_on_hand: 0, available_batches: 0, near_expiry_batches: 0 };
}

async function getMedicationDetail(medicationId) {
  const medication = await MedicationMaster.findById(medicationId).lean();
  if (!medication || medication.is_deleted) throw createError('Không tìm thấy thuốc.', 404);
  const stock_summary = await getMedicationStockSummary(medication._id);
  return { medication, stock_summary };
}

async function updateMedication(medicationId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.MEDICATIONS.UPDATE, PERMISSION.MEDICATIONS.MANAGE]);
  const medication = await MedicationMaster.findById(medicationId);
  if (!medication || medication.is_deleted) throw createError('Không tìm thấy thuốc.', 404);
  const before = medication.toObject();

  if (payload.medication_code !== undefined) {
    const nextCode = normalizeUpper(payload.medication_code);
    if (!nextCode) throw createError('medication_code không được rỗng.');
    if (nextCode !== medication.medication_code) {
      await validateMedicationMutableCode(medication._id);
      const existed = await MedicationMaster.exists({ medication_code: nextCode, _id: { $ne: medication._id }, is_deleted: false });
      if (existed) throw createError('medication_code đã tồn tại.', 409);
      medication.medication_code = nextCode;
    }
  }

  for (const field of ['generic_name', 'brand_name', 'dosage_form', 'strength', 'route_default', 'unit']) {
    if (payload[field] !== undefined) medication[field] = normalizeString(payload[field]) || undefined;
  }
  if (payload.service_id !== undefined) medication.service_id = payload.service_id || undefined;
  if (payload.sale_price !== undefined) medication.sale_price = parseNonNegativeNumber(payload.sale_price, 'sale_price');
  if (payload.min_stock_level !== undefined) medication.min_stock_level = parseNonNegativeNumber(payload.min_stock_level, 'min_stock_level');
  if (payload.status !== undefined) medication.status = payload.status;
  medication.updated_by = actor?.userId;
  await medication.save();

  await recordAuditLog({ actor, action: 'medication.update', targetType: 'medication', targetId: medication._id, status: 'success', message: 'Cập nhật thuốc thành công.', requestMeta, before, after: medication.toObject() });
  return getMedicationDetail(medication._id, actor);
}

async function updateMedicationStatus(medicationId, status, actor, requestMeta = {}) {
  return updateMedication(medicationId, { status }, actor, requestMeta);
}

async function retireMedication(medicationId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.MEDICATIONS.RETIRE, PERMISSION.MEDICATIONS.MANAGE]);
  const reason = payload.reason || payload.retire_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi retire thuốc.');
  const detail = await updateMedication(medicationId, { status: payload.status || MEDICATION_STATUS.DISCONTINUED }, actor, requestMeta);
  await recordAuditLog({ actor, action: 'medication.retired', targetType: 'medication', targetId: medicationId, status: 'success', message: 'Retire thuốc thành công.', requestMeta, metadata: { reason } });
  return detail;
}

async function validateStockBatchAvailable(batchId, quantity, session = null) {
  const batch = await withSession(StockBatch.findById(batchId).lean(), session);
  if (!batch || batch.is_deleted) throw createError('Không tìm thấy stock batch.', 404);
  if (!STOCK_ALLOCATABLE_STATUSES.includes(batch.status)) throw createError('Stock batch không available để cấp phát.', 409);
  if (batch.expiry_date && batch.expiry_date <= new Date()) throw createError('Stock batch đã hết hạn.', 409);
  if (Number(batch.quantity_on_hand || 0) < quantity) throw createError('Stock batch không đủ tồn.', 409);
  await validateMedicationActive(batch.medication_id, session);
  return batch;
}

function normalizeStockBatchStatus(quantityOnHand, expiryDate, currentStatus = STOCK_BATCH_STATUS.AVAILABLE) {
  if (expiryDate && expiryDate <= new Date()) return STOCK_BATCH_STATUS.EXPIRED;
  if (quantityOnHand <= 0 && currentStatus === STOCK_BATCH_STATUS.AVAILABLE) return STOCK_BATCH_STATUS.DEPLETED;
  if (currentStatus === STOCK_BATCH_STATUS.DEPLETED && quantityOnHand > 0) return STOCK_BATCH_STATUS.AVAILABLE;
  return currentStatus;
}

function applyDepletionMetadata(batch, actor, reason, transactionId = null) {
  if (!batch || Number(batch.quantity_on_hand || 0) > 0 || batch.status !== STOCK_BATCH_STATUS.DEPLETED) return;
  batch.depleted_at = batch.depleted_at || new Date();
  batch.depleted_by = batch.depleted_by || actor?.userId;
  batch.depleted_reason = batch.depleted_reason || reason;
  if (transactionId) batch.last_transaction_id = transactionId;
}

function validateStockBatchPayload(payload = {}, options = {}) {
  if (!payload.medication_id) throw createError('medication_id là bắt buộc.');
  if (!nonEmpty(payload.batch_no)) throw createError('batch_no là bắt buộc.');
  const manufactureDate = parseDate(payload.manufacture_date, 'manufacture_date');
  const expiryDate = parseDate(payload.expiry_date, 'expiry_date');
  if (manufactureDate && expiryDate && manufactureDate >= expiryDate) throw createError('manufacture_date phải nhỏ hơn expiry_date.');
  if (expiryDate && expiryDate <= new Date() && !options.allowExpiredBatch) throw createError('Không tạo/nhập batch đã hết hạn.', 409);

  const quantityReceived = parseNonNegativeNumber(payload.quantity_received, 'quantity_received', 0);
  const quantityOnHand = parseNonNegativeNumber(payload.quantity_on_hand, 'quantity_on_hand', quantityReceived);
  if (quantityOnHand > quantityReceived && !options.allowOnHandGreaterThanReceived) {
    throw createError('quantity_on_hand không được lớn hơn quantity_received.', 409);
  }

  return {
    medication_id: payload.medication_id,
    batch_no: normalizeString(payload.batch_no),
    lot_no: payload.lot_no ? normalizeString(payload.lot_no) : undefined,
    supplier_name: payload.supplier_name ? normalizeString(payload.supplier_name) : undefined,
    manufacture_date: manufactureDate,
    expiry_date: expiryDate,
    received_date: parseDate(payload.received_date, 'received_date') || new Date(),
    quantity_received: quantityReceived,
    quantity_on_hand: quantityOnHand,
    unit_cost: payload.unit_cost !== undefined ? parseNonNegativeNumber(payload.unit_cost, 'unit_cost') : undefined,
    min_stock_level: parseNonNegativeNumber(payload.min_stock_level, 'min_stock_level', 0),
    warehouse_id: payload.warehouse_id || undefined,
    storage_location_id: payload.storage_location_id || undefined,
    storage_location: payload.storage_location ? normalizeString(payload.storage_location) : undefined,
    status: payload.status || normalizeStockBatchStatus(quantityOnHand, expiryDate),
  };
}

async function createStockBatch(payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.STOCK_BATCHES.CREATE]);
  const normalized = validateStockBatchPayload(payload);
  await validateMedicationActive(normalized.medication_id);
  const exists = await StockBatch.exists({ medication_id: normalized.medication_id, batch_no: normalized.batch_no, is_deleted: false });
  if (exists) throw createError('Batch_no đã tồn tại cho thuốc này.', 409);

  let batchId;
  await withOptionalTransaction(async (session) => {
    const [batch] = await StockBatch.create([{
      ...normalized,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    batchId = batch._id;

    if (normalized.quantity_on_hand > 0) {
      await createInventoryTransaction({
        medication_id: normalized.medication_id,
        stock_batch_id: batch._id,
        transaction_type: INVENTORY_TRANSACTION_TYPE.RECEIPT,
        direction: INVENTORY_TRANSACTION_DIRECTION.IN,
        quantity: normalized.quantity_on_hand,
        balance_after: normalized.quantity_on_hand,
        unit_cost: normalized.unit_cost,
        reference_type: 'stock_batch_initial',
        reference_id: batch._id,
        note: payload.note,
      }, actor, session);
    }
  }, { fallbackToNoTransaction: false });

  await recordAuditLog({ actor, action: 'stock_batch.create', targetType: 'stock_batch', targetId: batchId, status: 'success', message: 'Tạo stock batch thành công.', requestMeta });
  return getStockBatchDetail(batchId);
}

async function listStockBatches(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };
  for (const field of ['medication_id', 'status', 'storage_location', 'supplier_name', 'warehouse_id', 'storage_location_id']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.search || query.keyword) {
    const keyword = escapeRegex(query.search || query.keyword);
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { batch_no: { $regex: keyword, $options: 'i' } },
          { lot_no: { $regex: keyword, $options: 'i' } },
          { supplier_name: { $regex: keyword, $options: 'i' } },
          { storage_location: { $regex: keyword, $options: 'i' } },
        ],
      },
    ];
  }
  if (query.expiry_from || query.expiry_to) {
    filter.expiry_date = {};
    if (query.expiry_from) filter.expiry_date.$gte = parseDate(query.expiry_from, 'expiry_from');
    if (query.expiry_to) filter.expiry_date.$lte = parseDate(query.expiry_to, 'expiry_to');
  }
  if (query.received_from || query.received_to) {
    filter.received_date = {};
    if (query.received_from) filter.received_date.$gte = parseDate(query.received_from, 'received_from');
    if (query.received_to) filter.received_date.$lte = parseDate(query.received_to, 'received_to');
  }
  if (String(query.near_expiry || '') === 'true') {
    const days = Number(query.near_expiry_days || 30);
    filter.expiry_date = { $lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000), $gte: new Date() };
  }
  if (booleanQuery(query.depleted)) {
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ status: STOCK_BATCH_STATUS.DEPLETED }, { quantity_on_hand: 0 }] },
    ];
  }
  if (booleanQuery(query.has_stock)) {
    filter.quantity_on_hand = { $gt: 0 };
  }
  if (booleanQuery(query.expired)) {
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ status: STOCK_BATCH_STATUS.EXPIRED }, { expiry_date: { $lt: new Date() } }] },
    ];
  }
  if (booleanQuery(query.valid)) {
    filter.status = STOCK_BATCH_STATUS.AVAILABLE;
    filter.quantity_on_hand = { $gt: 0 };
    filter.$and = [
      ...(filter.$and || []),
      buildExpiryAvailableCondition(new Date()),
    ];
  }
  const [items, total] = await Promise.all([
    StockBatch.find(filter)
      .sort({ expiry_date: 1, quantity_on_hand: -1 })
      .skip(skip)
      .limit(limit)
      .populate('medication_id', 'medication_code generic_name brand_name strength unit status')
      .lean(),
    StockBatch.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getStockBatchDetail(batchId) {
  const stock_batch = await StockBatch.findById(batchId)
    .populate('medication_id', 'medication_code generic_name brand_name strength unit status')
    .lean();
  if (!stock_batch || stock_batch.is_deleted) throw createError('Không tìm thấy stock batch.', 404);
  return { stock_batch };
}

async function updateStockBatch(batchId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.STOCK_BATCHES.UPDATE]);
  const batch = await StockBatch.findById(batchId);
  if (!batch || batch.is_deleted) throw createError('Không tìm thấy stock batch.', 404);
  if (payload.quantity_on_hand !== undefined || payload.quantity_received !== undefined) {
    throw createError('Không update tồn kho trực tiếp. Hãy dùng inventory receipt/adjustment.', 409);
  }
  const before = batch.toObject();
  for (const field of ['lot_no', 'supplier_name', 'storage_location']) {
    if (payload[field] !== undefined) batch[field] = normalizeString(payload[field]) || undefined;
  }
  if (payload.manufacture_date !== undefined) batch.manufacture_date = parseDate(payload.manufacture_date, 'manufacture_date');
  if (payload.expiry_date !== undefined) batch.expiry_date = parseDate(payload.expiry_date, 'expiry_date');
  if (payload.unit_cost !== undefined) batch.unit_cost = parseNonNegativeNumber(payload.unit_cost, 'unit_cost');
  if (payload.min_stock_level !== undefined) batch.min_stock_level = parseNonNegativeNumber(payload.min_stock_level, 'min_stock_level');
  if (payload.status !== undefined) batch.status = payload.status;
  batch.updated_by = actor?.userId;
  await batch.save();
  await recordAuditLog({ actor, action: 'stock_batch.update', targetType: 'stock_batch', targetId: batch._id, status: 'success', message: 'Cập nhật stock batch thành công.', requestMeta, before, after: batch.toObject() });
  return getStockBatchDetail(batch._id);
}

async function createInventoryTransaction(payload = {}, actor, session = null) {
  const quantity = parsePositiveNumber(payload.quantity, 'quantity');
  const transactionNo = payload.transaction_no || await generateInventoryTransactionNumber({ session });
  const [transaction] = await InventoryTransaction.create([{
    medication_id: payload.medication_id,
    stock_batch_id: payload.stock_batch_id,
    transaction_no: transactionNo,
    transaction_type: payload.transaction_type,
    direction: payload.direction,
    quantity,
    balance_before: payload.balance_before !== undefined ? parseNonNegativeNumber(payload.balance_before, 'balance_before') : undefined,
    balance_after: parseNonNegativeNumber(payload.balance_after, 'balance_after', 0),
    unit_cost: payload.unit_cost !== undefined ? parseNonNegativeNumber(payload.unit_cost, 'unit_cost') : undefined,
    warehouse_id: payload.warehouse_id,
    from_warehouse_id: payload.from_warehouse_id,
    to_warehouse_id: payload.to_warehouse_id,
    storage_location_id: payload.storage_location_id,
    from_storage_location_id: payload.from_storage_location_id,
    to_storage_location_id: payload.to_storage_location_id,
    reference_type: payload.reference_type,
    reference_id: payload.reference_id,
    reason_code: payload.reason_code,
    document_no: payload.document_no,
    approval_id: payload.approval_id,
    metadata: payload.metadata,
    performed_by: actor?.userId,
    occurred_at: payload.occurred_at || new Date(),
    note: payload.note,
    created_by: actor?.userId,
    updated_by: actor?.userId,
  }], sessionOptions(session));
  return transaction;
}

async function receiveInventory(payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_RECEIPT]);
  const quantity = parsePositiveNumber(payload.quantity, 'quantity');
  if (!payload.medication_id) throw createError('medication_id là bắt buộc.');
  if (!nonEmpty(payload.batch_no)) throw createError('batch_no là bắt buộc.');
  const reason = payload.reason || payload.note || payload.reference_type;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi receive inventory.');
  await validateMedicationActive(payload.medication_id);

  let batchId;
  let transactionId;
  await withOptionalTransaction(async (session) => {
    const existing = await withSession(StockBatch.findOne({
      medication_id: payload.medication_id,
      batch_no: normalizeString(payload.batch_no),
      is_deleted: false,
    }), session);

    let batch = existing;
    if (!batch) {
      const normalized = validateStockBatchPayload({
        ...payload,
        quantity_received: quantity,
        quantity_on_hand: quantity,
        received_date: payload.occurred_at || payload.received_date || new Date(),
      });
      [batch] = await StockBatch.create([{
        ...normalized,
        created_by: actor?.userId,
        updated_by: actor?.userId,
      }], sessionOptions(session));
    } else {
      if (batch.expiry_date && batch.expiry_date <= new Date() && !payload.allow_expired_receipt) {
        throw createError('Không nhập thêm vào batch đã hết hạn.', 409);
      }
      batch.quantity_received += quantity;
      batch.quantity_on_hand += quantity;
      if ([STOCK_BATCH_STATUS.DEPLETED, STOCK_BATCH_STATUS.AVAILABLE].includes(batch.status)) {
        batch.status = STOCK_BATCH_STATUS.AVAILABLE;
      }
      batch.depleted_at = undefined;
      batch.depleted_by = undefined;
      batch.depleted_reason = undefined;
      if (payload.unit_cost !== undefined) batch.unit_cost = parseNonNegativeNumber(payload.unit_cost, 'unit_cost');
      if (payload.storage_location !== undefined) batch.storage_location = normalizeString(payload.storage_location);
      batch.updated_by = actor?.userId;
      await batch.save(sessionOptions(session));
    }

    const transaction = await createInventoryTransaction({
      medication_id: batch.medication_id,
      stock_batch_id: batch._id,
      transaction_type: INVENTORY_TRANSACTION_TYPE.RECEIPT,
      direction: INVENTORY_TRANSACTION_DIRECTION.IN,
      quantity,
      balance_after: batch.quantity_on_hand,
      unit_cost: payload.unit_cost !== undefined ? payload.unit_cost : batch.unit_cost,
      reference_type: payload.reference_type || 'inventory_receipt',
      reference_id: payload.reference_id || batch._id,
      reason_code: payload.reason_code,
      document_no: payload.document_no,
      warehouse_id: payload.warehouse_id || batch.warehouse_id,
      storage_location_id: payload.storage_location_id || batch.storage_location_id,
      metadata: payload.metadata,
      occurred_at: parseDate(payload.occurred_at, 'occurred_at') || new Date(),
      note: reason,
    }, actor, session);
    batchId = batch._id;
    transactionId = transaction._id;
  }, { fallbackToNoTransaction: false });

  await recordAuditLog({ actor, action: 'inventory.receipt', targetType: 'stock_batch', targetId: batchId, status: 'success', message: 'Nhập kho thuốc thành công.', requestMeta, metadata: { transaction_id: transactionId, quantity, reason } });
  return {
    stock_batch: (await getStockBatchDetail(batchId)).stock_batch,
    transaction: await InventoryTransaction.findById(transactionId).lean(),
  };
}

async function adjustInventory(batchId, payload = {}, actor, requestMeta = {}) {
  const direction = payload.direction;
  if (![INVENTORY_TRANSACTION_DIRECTION.IN, INVENTORY_TRANSACTION_DIRECTION.OUT].includes(direction)) {
    throw createError('direction phải là in hoặc out.');
  }
  const requiredPermission = direction === INVENTORY_TRANSACTION_DIRECTION.IN
    ? PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_IN
    : PERMISSION.INVENTORY_TRANSACTIONS.CREATE_ADJUSTMENT_OUT;
  assertStaffPermission(actor, [requiredPermission]);
  const quantity = parsePositiveNumber(payload.adjustment_quantity || payload.quantity, 'adjustment_quantity');
  const reason = payload.reason || payload.note;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi adjustment.');

  let transactionId;
  await withOptionalTransaction(async (session) => {
    let batch = await withSession(StockBatch.findById(batchId), session);
    if (!batch || batch.is_deleted) throw createError('Không tìm thấy stock batch.', 404);
    const updateFilter = { _id: batch._id, is_deleted: false };
    if (direction === INVENTORY_TRANSACTION_DIRECTION.OUT) updateFilter.quantity_on_hand = { $gte: quantity };
    batch = await withSession(StockBatch.findOneAndUpdate(
      updateFilter,
      {
        $inc: { quantity_on_hand: direction === INVENTORY_TRANSACTION_DIRECTION.IN ? quantity : -quantity },
        $set: { updated_by: actor?.userId },
      },
      { new: true },
    ), session);
    if (!batch) throw createError('Adjustment out làm tồn kho âm.', 409);
    batch.status = normalizeStockBatchStatus(batch.quantity_on_hand, batch.expiry_date, batch.status);
    batch.updated_by = actor?.userId;
    await batch.save(sessionOptions(session));

    const transaction = await createInventoryTransaction({
      medication_id: batch.medication_id,
      stock_batch_id: batch._id,
      transaction_type: INVENTORY_TRANSACTION_TYPE.ADJUSTMENT,
      direction,
      quantity,
      balance_after: batch.quantity_on_hand,
      unit_cost: batch.unit_cost,
      reference_type: 'inventory_adjustment',
      reference_id: batch._id,
      occurred_at: parseDate(payload.occurred_at, 'occurred_at') || new Date(),
      note: reason,
    }, actor, session);
    transactionId = transaction._id;
    if (batch.status === STOCK_BATCH_STATUS.DEPLETED) {
      applyDepletionMetadata(batch, actor, 'adjustment', transaction._id);
      await batch.save(sessionOptions(session));
    }
  }, { fallbackToNoTransaction: false });

  await recordAuditLog({ actor, action: 'inventory.adjustment', targetType: 'stock_batch', targetId: batchId, status: 'success', message: 'Điều chỉnh tồn kho thành công.', requestMeta, metadata: { transaction_id: transactionId, direction, quantity, reason } });
  return {
    stock_batch: (await getStockBatchDetail(batchId)).stock_batch,
    transaction: await InventoryTransaction.findById(transactionId).lean(),
  };
}

async function listInventoryTransactions(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  for (const field of ['medication_id', 'stock_batch_id', 'transaction_type', 'direction', 'reference_type', 'performed_by']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.date_from || query.date_to) {
    filter.occurred_at = {};
    if (query.date_from) filter.occurred_at.$gte = parseDate(query.date_from, 'date_from');
    if (query.date_to) filter.occurred_at.$lte = parseDate(query.date_to, 'date_to');
  }
  const [items, total] = await Promise.all([
    InventoryTransaction.find(filter)
      .sort({ occurred_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('medication_id', 'medication_code generic_name brand_name strength unit')
      .populate('stock_batch_id', 'batch_no lot_no expiry_date storage_location')
      .lean(),
    InventoryTransaction.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function markBatchExpired(batchId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.STOCK_BATCHES.MARK_EXPIRED]);
  const reason = payload.reason || payload.expire_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi mark expired batch.');
  let transactionId = null;
  await withOptionalTransaction(async (session) => {
    const batch = await withSession(StockBatch.findById(batchId), session);
    if (!batch || batch.is_deleted) throw createError('Không tìm thấy stock batch.', 404);
    if (batch.status === STOCK_BATCH_STATUS.EXPIRED) return;
    if (batch.expiry_date && batch.expiry_date > new Date() && !payload.force) throw createError('Batch chưa hết hạn, cần force để mark expired.', 409);

    const quantityOut = batch.quantity_on_hand;
    batch.quantity_on_hand = 0;
    batch.status = STOCK_BATCH_STATUS.EXPIRED;
    batch.updated_by = actor?.userId;
    await batch.save(sessionOptions(session));

    if (quantityOut > 0) {
      const transaction = await createInventoryTransaction({
        medication_id: batch.medication_id,
        stock_batch_id: batch._id,
        transaction_type: INVENTORY_TRANSACTION_TYPE.EXPIRE,
        direction: INVENTORY_TRANSACTION_DIRECTION.OUT,
        quantity: quantityOut,
        balance_after: 0,
        unit_cost: batch.unit_cost,
        reference_type: 'stock_batch_expire',
        reference_id: batch._id,
        note: reason,
      }, actor, session);
      transactionId = transaction._id;
    }
  }, { fallbackToNoTransaction: false });

  await recordAuditLog({ actor, action: 'stock_batch.expired', targetType: 'stock_batch', targetId: batchId, status: 'success', message: 'Mark stock batch expired thành công.', requestMeta, metadata: { transaction_id: transactionId, reason } });
  return getStockBatchDetail(batchId);
}

async function recallStockBatch(batchId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.STOCK_BATCHES.RECALL]);
  const reason = payload.reason || payload.recall_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi recall batch.');
  let resolvedBatchId = batchId;
  let transactionId = null;
  await withOptionalTransaction(async (session) => {
    const batch = await withSession(StockBatch.findById(batchId), session);
    if (!batch || batch.is_deleted) throw createError('Không tìm thấy stock batch.', 404);
    resolvedBatchId = batch._id;
    if (batch.status === STOCK_BATCH_STATUS.RECALLED) return;
    assertTransition(STOCK_BATCH_TRANSITIONS, batch.status, STOCK_BATCH_STATUS.RECALLED, 'stock_batch');
    const quantityOut = Number(batch.quantity_on_hand || 0);
    batch.quantity_on_hand = 0;
    batch.status = STOCK_BATCH_STATUS.RECALLED;
    batch.recall_reason = reason;
    batch.recalled_by = actor?.userId;
    batch.recalled_at = new Date();
    batch.recall_reference_no = payload.recall_reference_no || payload.reference_no || batch.recall_reference_no;
    batch.recall_source = payload.recall_source || batch.recall_source;
    batch.recall_resolution_status = payload.recall_resolution_status || 'open';
    batch.updated_by = actor?.userId;
    await batch.save(sessionOptions(session));
    if (quantityOut > 0) {
      const transaction = await createInventoryTransaction({
        medication_id: batch.medication_id,
        stock_batch_id: batch._id,
        transaction_type: INVENTORY_TRANSACTION_TYPE.RECALL,
        direction: INVENTORY_TRANSACTION_DIRECTION.OUT,
        quantity: quantityOut,
        balance_after: 0,
        unit_cost: batch.unit_cost,
        reference_type: 'stock_batch_recall',
        reference_id: batch._id,
        note: reason,
      }, actor, session);
      transactionId = transaction._id;
    }
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'stock_batch.recalled', targetType: 'stock_batch', targetId: resolvedBatchId, status: 'success', message: 'Recall stock batch thành công.', requestMeta, metadata: { reason, transaction_id: transactionId } });
  return getStockBatchDetail(resolvedBatchId);
}

async function quarantineStockBatch(batchId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.STOCK_BATCHES.QUARANTINE]);
  const reason = payload.reason || payload.quarantine_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi quarantine batch.');
  const batch = await StockBatch.findById(batchId);
  if (!batch || batch.is_deleted) throw createError('Không tìm thấy stock batch.', 404);
  if (batch.status === STOCK_BATCH_STATUS.QUARANTINED) return getStockBatchDetail(batch._id);
  assertTransition(STOCK_BATCH_TRANSITIONS, batch.status, STOCK_BATCH_STATUS.QUARANTINED, 'stock_batch');
  const before = batch.toObject();
  batch.status = STOCK_BATCH_STATUS.QUARANTINED;
  batch.quarantine_reason = reason;
  batch.quarantined_by = actor?.userId;
  batch.quarantined_at = new Date();
  batch.release_reason = undefined;
  batch.released_by = undefined;
  batch.released_at = undefined;
  batch.updated_by = actor?.userId;
  await batch.save();
  await recordAuditLog({
    actor,
    action: 'stock_batch.quarantined',
    targetType: 'stock_batch',
    targetId: batch._id,
    status: 'success',
    message: 'Quarantine stock batch thành công.',
    requestMeta,
    before,
    after: batch.toObject(),
    metadata: { reason },
  });
  return getStockBatchDetail(batch._id);
}

async function releaseQuarantineStockBatch(batchId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.STOCK_BATCHES.QUARANTINE]);
  const reason = payload.reason || payload.release_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi release quarantine batch.');
  const batch = await StockBatch.findById(batchId);
  if (!batch || batch.is_deleted) throw createError('Không tìm thấy stock batch.', 404);
  if (batch.status !== STOCK_BATCH_STATUS.QUARANTINED) throw createError('Chỉ batch đang quarantined mới được release.', 409);
  if (batch.expiry_date && batch.expiry_date <= new Date()) throw createError('Batch đã hết hạn, không thể release về available.', 409);
  if (Number(batch.quantity_on_hand || 0) <= 0) throw createError('Batch không còn tồn, không thể release quarantine.', 409);
  assertTransition(STOCK_BATCH_TRANSITIONS, batch.status, STOCK_BATCH_STATUS.AVAILABLE, 'stock_batch');
  const before = batch.toObject();
  batch.status = STOCK_BATCH_STATUS.AVAILABLE;
  batch.release_reason = reason;
  batch.released_by = actor?.userId;
  batch.released_at = new Date();
  batch.updated_by = actor?.userId;
  await batch.save();
  await recordAuditLog({
    actor,
    action: 'stock_batch.quarantine_released',
    targetType: 'stock_batch',
    targetId: batch._id,
    status: 'success',
    message: 'Release quarantine stock batch thành công.',
    requestMeta,
    before,
    after: batch.toObject(),
    metadata: { reason },
  });
  return getStockBatchDetail(batch._id);
}

async function wasteStockBatch(batchId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INVENTORY_TRANSACTIONS.CREATE_DISPOSAL]);
  const quantity = parsePositiveNumber(payload.quantity, 'quantity');
  const reason = payload.reason || payload.waste_reason || payload.note;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi hủy/hao hụt batch.');
  let transactionId = null;

  await withOptionalTransaction(async (session) => {
    let batch = await withSession(StockBatch.findById(batchId), session);
    if (!batch || batch.is_deleted) throw createError('Không tìm thấy stock batch.', 404);
    if (Number(batch.quantity_on_hand || 0) < quantity) throw createError('Số lượng hủy/hao hụt vượt tồn hiện tại.', 409);
    if ([STOCK_BATCH_STATUS.RECALLED, STOCK_BATCH_STATUS.EXPIRED].includes(batch.status)) {
      throw createError('Batch đã expired/recalled, không tạo waste riêng.', 409);
    }
    batch.quantity_on_hand = Number(batch.quantity_on_hand || 0) - quantity;
    batch.status = normalizeStockBatchStatus(batch.quantity_on_hand, batch.expiry_date, batch.status);
    batch.updated_by = actor?.userId;
    await batch.save(sessionOptions(session));

    const transaction = await createInventoryTransaction({
      medication_id: batch.medication_id,
      stock_batch_id: batch._id,
      transaction_type: INVENTORY_TRANSACTION_TYPE.WASTE,
      direction: INVENTORY_TRANSACTION_DIRECTION.OUT,
      quantity,
      balance_after: batch.quantity_on_hand,
      unit_cost: batch.unit_cost,
      reference_type: payload.reference_type || 'stock_batch_waste',
      reference_id: batch._id,
      occurred_at: parseDate(payload.occurred_at, 'occurred_at') || new Date(),
      note: reason,
    }, actor, session);
    transactionId = transaction._id;

    if (batch.status === STOCK_BATCH_STATUS.DEPLETED) {
      applyDepletionMetadata(batch, actor, 'waste', transaction._id);
      await batch.save(sessionOptions(session));
    } else {
      batch.last_transaction_id = transaction._id;
      await batch.save(sessionOptions(session));
    }
  }, { fallbackToNoTransaction: false });

  await recordAuditLog({ actor, action: 'stock_batch.waste', targetType: 'stock_batch', targetId: batchId, status: 'success', message: 'Ghi nhận hủy/hao hụt batch thành công.', requestMeta, metadata: { transaction_id: transactionId, quantity, reason } });
  return {
    stock_batch: (await getStockBatchDetail(batchId)).stock_batch,
    transaction: transactionId ? await InventoryTransaction.findById(transactionId).lean() : null,
  };
}

async function transferStockBatchLocation(batchId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [
    PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_OUT,
    PERMISSION.INVENTORY_TRANSACTIONS.CREATE_TRANSFER_IN,
  ]);
  const toLocation = normalizeString(payload.to_location || payload.storage_location);
  if (!toLocation) throw createError('to_location là bắt buộc khi chuyển vị trí.');
  const quantity = parsePositiveNumber(payload.quantity, 'quantity');
  const reason = payload.reason || payload.note || 'Chuyển vị trí lưu kho';
  const transactionIds = [];
  let previousLocation = null;

  await withOptionalTransaction(async (session) => {
    const batch = await withSession(StockBatch.findById(batchId), session);
    if (!batch || batch.is_deleted) throw createError('Không tìm thấy stock batch.', 404);
    if (Number(batch.quantity_on_hand || 0) < quantity) throw createError('Số lượng chuyển vị trí vượt tồn hiện tại.', 409);
    if ([STOCK_BATCH_STATUS.RECALLED, STOCK_BATCH_STATUS.EXPIRED, STOCK_BATCH_STATUS.DEPLETED].includes(batch.status)) {
      throw createError('Batch không còn khả dụng để chuyển vị trí.', 409);
    }
    previousLocation = batch.storage_location || payload.from_location || '';
    if (payload.from_location && normalizeString(payload.from_location) !== normalizeString(batch.storage_location)) {
      throw createError('from_location không khớp vị trí hiện tại của batch.', 409);
    }

    const referenceType = 'stock_batch_transfer_location';
    const common = {
      medication_id: batch.medication_id,
      stock_batch_id: batch._id,
      transaction_type: INVENTORY_TRANSACTION_TYPE.TRANSFER,
      quantity,
      balance_after: batch.quantity_on_hand,
      unit_cost: batch.unit_cost,
      reference_type: referenceType,
      reference_id: batch._id,
      occurred_at: parseDate(payload.occurred_at, 'occurred_at') || new Date(),
    };
    const outTx = await createInventoryTransaction({
      ...common,
      direction: INVENTORY_TRANSACTION_DIRECTION.OUT,
      note: `${reason}. From: ${previousLocation || 'unknown'}; To: ${toLocation}`,
    }, actor, session);
    const inTx = await createInventoryTransaction({
      ...common,
      direction: INVENTORY_TRANSACTION_DIRECTION.IN,
      note: `${reason}. To: ${toLocation}; From: ${previousLocation || 'unknown'}`,
    }, actor, session);
    transactionIds.push(outTx._id, inTx._id);

    batch.storage_location = toLocation;
    batch.last_transaction_id = inTx._id;
    batch.updated_by = actor?.userId;
    await batch.save(sessionOptions(session));
  }, { fallbackToNoTransaction: false });

  await recordAuditLog({ actor, action: 'stock_batch.transfer_location', targetType: 'stock_batch', targetId: batchId, status: 'success', message: 'Chuyển vị trí batch thành công.', requestMeta, metadata: { quantity, from_location: previousLocation, to_location: toLocation, transaction_ids: transactionIds } });
  return {
    stock_batch: (await getStockBatchDetail(batchId)).stock_batch,
    transactions: await InventoryTransaction.find({ _id: { $in: transactionIds } }).sort({ occurred_at: 1 }).lean(),
  };
}

async function getStockBatchRecallImpact(batchId) {
  const { stock_batch } = await getStockBatchDetail(batchId);
  const dispenseItems = await DispenseItem.find({ stock_batch_id: batchId })
    .sort({ created_at: -1 })
    .populate({
      path: 'dispense_id',
      select: 'dispense_no status prescription_id patient_id completed_at dispensed_at',
      populate: [
        { path: 'patient_id', select: 'patient_code full_name phone date_of_birth gender' },
        { path: 'prescription_id', select: 'prescription_no status prescribed_at' },
      ],
    })
    .populate('prescription_item_id', 'dose frequency route instructions')
    .populate('medication_id', 'medication_code generic_name brand_name strength unit')
    .lean();

  const dispenses = [];
  const prescriptions = [];
  const patients = [];
  const seenDispense = new Set();
  const seenPrescription = new Set();
  const seenPatient = new Set();
  let affectedQuantity = 0;

  for (const item of dispenseItems) {
    affectedQuantity += Math.max(Number(item.quantity || 0) - Number(item.returned_quantity || 0), 0);
    const dispense = item.dispense_id;
    if (dispense?._id && !seenDispense.has(String(dispense._id))) {
      seenDispense.add(String(dispense._id));
      dispenses.push(dispense);
    }
    const prescription = dispense?.prescription_id;
    if (prescription?._id && !seenPrescription.has(String(prescription._id))) {
      seenPrescription.add(String(prescription._id));
      prescriptions.push(prescription);
    }
    const patient = dispense?.patient_id;
    if (patient?._id && !seenPatient.has(String(patient._id))) {
      seenPatient.add(String(patient._id));
      patients.push(patient);
    }
  }

  return {
    batch: stock_batch,
    dispense_items: dispenseItems,
    dispenses,
    prescriptions,
    patients,
    affected_patient_count: patients.length,
    affected_quantity: affectedQuantity,
    recommended_actions: [
      'notify_pharmacist',
      'notify_doctor',
      'notify_patient',
      'block_future_dispense',
    ],
  };
}

async function validatePrescriptionCreation(payload = {}, actor = {}, options = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PRESCRIPTIONS.CREATE]);
  if (!payload.encounter_id) throw createError('encounter_id là bắt buộc.');
  const encounter = await withSession(Encounter.findById(payload.encounter_id).lean(), options.session);
  assertEncounterCanReceivePrescription(encounter);
  const patient = await withSession(Patient.findById(encounter.patient_id).lean(), options.session);
  assertPatientActive(patient);

  if (payload.patient_id && !sameId(payload.patient_id, encounter.patient_id)) {
    throw createError('patient_id phải khớp patient của encounter.', 409);
  }
  if (payload.prescribed_by && !sameId(payload.prescribed_by, actor.userId) && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    throw createError('Không được tạo prescription thay bác sĩ khác.', 403);
  }

  const departmentId = actorDepartmentId(actor);
  const actorIsEncounterDoctor = actor.userId && sameId(encounter.attending_doctor_id, actor.userId);
  const actorInEncounterDepartment = departmentId && sameId(encounter.department_id, departmentId);
  if (!hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS) && !actorIsEncounterDoctor && !actorInEncounterDepartment) {
    throw createError('Bạn không có quyền kê đơn cho encounter này.', 403);
  }

  let order = null;
  if (payload.order_id) {
    order = await withSession(Order.findById(payload.order_id).lean(), options.session);
    if (!order) throw createError('Không tìm thấy medication order.', 404);
    if (order.order_type !== ORDER_TYPE.MEDICATION) throw createError('order_id không phải medication order.', 409);
    if (!sameId(order.encounter_id, encounter._id)) throw createError('order_id không cùng encounter.', 409);
    if (!sameId(order.patient_id, encounter.patient_id)) throw createError('order_id không cùng patient với encounter.', 409);
    if (order.ordered_by && payload.prescribed_by && !sameId(order.ordered_by, payload.prescribed_by)) {
      throw createError('Bác sĩ kê đơn phải khớp bác sĩ của medication order.', 409);
    }
    if (order.department_id && encounter.department_id && !sameId(order.department_id, encounter.department_id)) {
      throw createError('Khoa của medication order phải khớp khoa encounter.', 409);
    }
  }

  return { encounter, patient, order };
}

function calculatePrescriptionItemQuantity(payload = {}) {
  if (payload.quantity !== undefined && payload.quantity !== null && payload.quantity !== '') {
    return parsePositiveNumber(payload.quantity, 'quantity');
  }
  const duration = Number(payload.duration_days !== undefined ? payload.duration_days : payload.duration || 0);
  if (!Number.isFinite(duration) || duration < 0) throw createError('duration_days không hợp lệ.');
  return duration;
}

function validatePrescriptionItemPayload(payload = {}) {
  if (!payload.medication_id) throw createError('medication_id là bắt buộc.');
  const dose = normalizeString(payload.dosage || payload.dose);
  const frequency = normalizeString(payload.frequency);
  const route = normalizeString(payload.route);
  const unit = normalizeString(payload.unit);
  const durationInput = payload.duration_days !== undefined ? payload.duration_days : payload.duration;
  if (!dose) throw createError('dosage/dose là bắt buộc với prescription item.');
  if (!route) throw createError('route là bắt buộc với prescription item.');
  if (!frequency) throw createError('frequency là bắt buộc với prescription item.');
  if (durationInput === undefined || durationInput === null || durationInput === '') {
    throw createError('duration/duration_days là bắt buộc với prescription item.');
  }
  if (!unit) throw createError('unit là bắt buộc với prescription item.');
  const quantity = calculatePrescriptionItemQuantity(payload);
  if (quantity <= 0) throw createError('quantity phải lớn hơn 0.');
  const durationDays = Number(durationInput);
  if (!Number.isFinite(durationDays) || durationDays <= 0) throw createError('duration_days phải lớn hơn 0.');
  return {
    medication_id: payload.medication_id,
    dose,
    frequency,
    route,
    duration_days: durationDays,
    quantity,
    unit,
    instructions: payload.instructions,
    status: payload.status || PRESCRIPTION_ITEM_STATUS.ACTIVE,
  };
}

async function checkDrugAllergyConflict(input = {}, session = null) {
  let patientId = input.patient_id;
  let medicationIds = input.medication_ids || (input.medication_id ? [input.medication_id] : []);

  if (input.prescription_id) {
    const prescription = await withSession(Prescription.findById(input.prescription_id).lean(), session);
    if (!prescription) throw createError('Không tìm thấy prescription.', 404);
    patientId = prescription.patient_id;
    const items = await withSession(PrescriptionItem.find({
      prescription_id: prescription._id,
      status: { $nin: [PRESCRIPTION_ITEM_STATUS.CANCELLED, PRESCRIPTION_ITEM_STATUS.STOPPED] },
    }).lean(), session);
    medicationIds = items.map((item) => item.medication_id);
  }

  if (!patientId || medicationIds.length === 0) return { has_conflict: false, conflicts: [] };
  const [allergies, medications] = await Promise.all([
    withSession(Allergy.find({
      patient_id: patientId,
      allergy_type: ALLERGY_TYPE.MEDICATION,
      status: ALLERGY_STATUS.ACTIVE,
    }).lean(), session),
    withSession(MedicationMaster.find({ _id: { $in: medicationIds }, is_deleted: false }).lean(), session),
  ]);

  const conflicts = [];
  for (const allergy of allergies) {
    const allergen = normalizeString(allergy.allergen).toLowerCase();
    if (!allergen) continue;
    for (const medication of medications) {
      const names = [medication.generic_name, medication.brand_name, medication.medication_code]
        .map((value) => normalizeString(value).toLowerCase())
        .filter(Boolean);
      if (names.some((name) => name.includes(allergen) || allergen.includes(name))) {
        conflicts.push({
          allergy_id: allergy._id,
          medication_id: medication._id,
          allergen: allergy.allergen,
          medication_name: medication.brand_name || medication.generic_name,
          severity: allergy.severity,
        });
      }
    }
  }
  return { has_conflict: conflicts.length > 0, conflicts };
}

async function checkDrugInteractionConflict(input = {}, session = null) {
  let medicationIds = input.medication_ids || (input.medication_id ? [input.medication_id] : []);
  if (input.prescription_id) {
    const items = await withSession(PrescriptionItem.find({
      prescription_id: input.prescription_id,
      status: { $nin: [PRESCRIPTION_ITEM_STATUS.CANCELLED, PRESCRIPTION_ITEM_STATUS.STOPPED] },
    }).select('medication_id').lean(), session);
    medicationIds = items.map((item) => item.medication_id);
  }
  const uniqueMedicationIds = [...new Set(medicationIds.map((id) => String(id)).filter(Boolean))];
  const requiresOverride = uniqueMedicationIds.length > 1;
  return {
    has_conflict: false,
    conflicts: [],
    requires_override: requiresOverride,
    policy: 'drug_interaction_engine_unavailable_manual_review_required',
    message: 'MVP hiện chưa tích hợp cơ sở dữ liệu tương tác thuốc; đơn có nhiều thuốc cần manual review và override reason khi verify.',
  };
}

async function checkDuplicateMedicationInPrescription(prescriptionId, medicationId, excludeItemId = null, session = null) {
  const filter = {
    prescription_id: prescriptionId,
    medication_id: medicationId,
    status: { $nin: [PRESCRIPTION_ITEM_STATUS.CANCELLED] },
  };
  if (excludeItemId) filter._id = { $ne: excludeItemId };
  const existing = await withSession(PrescriptionItem.findOne(filter).lean(), session);
  return { has_duplicate: Boolean(existing), item: existing || null };
}

async function createPrescription(payload = {}, actor, requestMeta = {}) {
  let prescriptionId;
  await withOptionalTransaction(async (session) => {
    const validation = await validatePrescriptionCreation(payload, actor, { session });
    const prescriptionNo = payload.prescription_no || await generatePrescriptionNumber({ session });
    const initialStatus = payload.status || PRESCRIPTION_STATUS.DRAFT;
    if (![PRESCRIPTION_STATUS.DRAFT, PRESCRIPTION_STATUS.ACTIVE].includes(initialStatus)) {
      throw createError('Prescription mới chỉ được tạo ở draft/active; verified phải đi qua verify workflow.', 409);
    }
    const [prescription] = await Prescription.create([{
      order_id: payload.order_id,
      patient_id: validation.encounter.patient_id,
      encounter_id: validation.encounter._id,
      prescribed_by: payload.prescribed_by || actor?.userId,
      prescription_no: prescriptionNo,
      prescribed_at: parseDate(payload.prescribed_at, 'prescribed_at') || new Date(),
      amended_from: payload.amended_from,
      renewed_from: payload.renewed_from,
      version: payload.version || 1,
      is_current: payload.is_current !== false,
      status: initialStatus,
      note: payload.note,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    prescriptionId = prescription._id;

    const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.prescription_items) ? payload.prescription_items : [];
    if (items.length > 0) {
      await addPrescriptionItemsInternal(prescription, items, actor, session);
    }
    await syncPrescriptionStatusToOrder(prescription, actor, session);
  }, { fallbackToNoTransaction: false });

  await recordAuditLog({ actor, action: 'prescription.create', targetType: 'prescription', targetId: prescriptionId, status: 'success', message: 'Tạo đơn thuốc thành công.', requestMeta });
  return getPrescriptionDetail(prescriptionId, actor);
}

async function buildPrescriptionListScope(filter, actor = {}) {
  if (!actorType(actor)) return;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return;
  if (hasPermission(actor, PERMISSION.PRESCRIPTIONS.READ) && !actorDepartmentId(actor)) return;

  if (actorType(actor) === 'patient') {
    if (!hasPermission(actor, PERMISSION.PRESCRIPTIONS.SELF_READ)) throw createError('Bạn không có quyền xem đơn thuốc.', 403);
    filter.patient_id = actor.patientId || actor.patient_id;
    return;
  }

  const departmentId = actorDepartmentId(actor);
  if (departmentId && hasPermission(actor, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT)) {
    const encounters = await Encounter.find({ department_id: departmentId }).select('_id').lean();
    const encounterIds = encounters.map((encounter) => encounter._id);
    if (filter.encounter_id) {
      filter.encounter_id = encounterIds.some((id) => sameId(id, filter.encounter_id))
        ? filter.encounter_id
        : { $in: [] };
    } else {
      filter.encounter_id = { $in: encounterIds };
    }
    return;
  }

  if (actor.userId && hasPermission(actor, PERMISSION.PRESCRIPTIONS.READ_OWN)) {
    filter.prescribed_by = actor.userId;
    return;
  }

  throw createError('Bạn không có quyền xem danh sách đơn thuốc.', 403);
}

async function listPrescriptions(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  for (const field of ['encounter_id', 'patient_id', 'prescribed_by', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [{ prescription_no: { $regex: keyword, $options: 'i' } }];
  }
  await buildPrescriptionListScope(filter, actor);

  const [items, total] = await Promise.all([
    Prescription.find(filter)
      .sort({ prescribed_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
      .populate('prescribed_by', 'full_name username employee_code')
      .lean(),
    Prescription.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function searchPrescriptions(query = {}, actor = {}) {
  return listPrescriptions(query, actor);
}

async function getPrescriptionDetail(prescriptionId, actor = {}) {
  const prescription = await Prescription.findById(prescriptionId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
    .populate('prescribed_by', 'full_name username employee_code')
    .populate('verified_by', 'full_name username employee_code')
    .populate('cancelled_by', 'full_name username employee_code')
    .lean();
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  const rawPrescription = await Prescription.findById(prescriptionId).lean();
  const context = await loadPrescriptionContext(rawPrescription);
  assertPrescriptionAccess(rawPrescription, context, actor, readAccessPermissions());

  const [items, dispenses] = await Promise.all([
    PrescriptionItem.find({ prescription_id: rawPrescription._id })
      .sort({ created_at: 1 })
      .populate('medication_id', 'medication_code generic_name brand_name strength unit route_default status sale_price')
      .lean(),
    Dispense.find({ prescription_id: rawPrescription._id }).sort({ created_at: -1 }).lean(),
  ]);
  const chargeFilter = {
    $or: [
      rawPrescription.order_id ? { order_id: rawPrescription.order_id, medication_id: { $exists: true } } : null,
      dispenses.length > 0 ? { dispense_id: { $in: dispenses.map((dispense) => dispense._id) } } : null,
    ].filter(Boolean),
  };
  const charges = chargeFilter.$or.length > 0
    ? await Charge.find(chargeFilter).sort({ charged_at: -1 }).lean()
    : [];
  return { prescription, items, dispenses, charges };
}

async function checkPrescriptionEditable(prescriptionId, actor = {}) {
  const prescription = await Prescription.findById(prescriptionId).lean();
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  return {
    prescription_id: String(prescription._id),
    editable: PRESCRIPTION_EDITABLE_STATUSES.includes(prescription.status)
      && (!actor?.userId || sameId(prescription.prescribed_by, actor.userId) || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)),
    status: prescription.status,
  };
}

async function updatePrescription(prescriptionId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  const prescription = await getPrescriptionOrThrow(prescriptionId);
  const context = await loadPrescriptionContext(prescription);
  assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.PRESCRIPTIONS.UPDATE_OWN]));
  if (!PRESCRIPTION_EDITABLE_STATUSES.includes(prescription.status)) throw createError('Prescription hiện không thể chỉnh sửa.', 409);
  if (!sameId(prescription.prescribed_by, actor.userId) && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    throw createError('Chỉ người kê đơn hoặc admin mới được sửa prescription.', 403);
  }

  const before = prescription.toObject();
  if (payload.note !== undefined) prescription.note = payload.note;
  if (payload.prescribed_at !== undefined) prescription.prescribed_at = parseDate(payload.prescribed_at, 'prescribed_at');
  prescription.updated_by = actor?.userId;
  await prescription.save();
  await recordAuditLog({ actor, action: 'prescription.update', targetType: 'prescription', targetId: prescription._id, status: 'success', message: 'Cập nhật đơn thuốc thành công.', requestMeta, before, after: prescription.toObject() });
  return getPrescriptionDetail(prescription._id, actor);
}

async function addPrescriptionItemsInternal(prescription, items = [], actor, session = null) {
  const context = await loadPrescriptionContext(prescription, session);
  assertEncounterCanReceivePrescription(context.encounter);
  if (!PRESCRIPTION_EDITABLE_STATUSES.includes(prescription.status)) {
    throw createError('Prescription hiện không thể thêm item.', 409);
  }

  const docs = [];
  const seenMedicationIds = new Set();
  for (const rawItem of items) {
    const item = validatePrescriptionItemPayload(rawItem);
    const medication = await validateMedicationAvailableForPrescription(item.medication_id, session);
    if (!item.route) item.route = medication.route_default;
    if (!item.unit) item.unit = medication.unit;
    if (!nonEmpty(item.unit)) throw createError('unit là bắt buộc với prescription item.', 400);
    if (seenMedicationIds.has(String(item.medication_id))) throw createError('Payload có thuốc bị trùng.', 409);
    seenMedicationIds.add(String(item.medication_id));
    const duplicate = await checkDuplicateMedicationInPrescription(prescription._id, item.medication_id, null, session);
    if (duplicate.has_duplicate) throw createError('Thuốc này đã tồn tại trong đơn thuốc.', 409);
    docs.push({
      prescription_id: prescription._id,
      medication_id: item.medication_id,
      dose: item.dose,
      frequency: item.frequency,
      route: item.route,
      duration_days: item.duration_days,
      quantity: item.quantity,
      unit: item.unit,
      dispensed_quantity: 0,
      instructions: item.instructions,
      status: item.status,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    });
  }

  if (docs.length === 0) return [];
  try {
    return await PrescriptionItem.create(docs, sessionOptions(session));
  } catch (error) {
    if (isDuplicateKeyError(error)) throw createError('Thuốc này đã tồn tại trong đơn thuốc.', 409);
    throw error;
  }
}

async function addPrescriptionItem(payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  if (!payload.prescription_id) throw createError('prescription_id là bắt buộc.');
  let itemId;
  await withOptionalTransaction(async (session) => {
    const prescription = await getPrescriptionOrThrow(payload.prescription_id, session);
    const context = await loadPrescriptionContext(prescription, session);
    assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.PRESCRIPTIONS.UPDATE_OWN]));
    const [item] = await addPrescriptionItemsInternal(prescription, [payload], actor, session);
    itemId = item._id;
  }, { fallbackToNoTransaction: false });

  await recordAuditLog({ actor, action: 'prescription_item.create', targetType: 'prescription_item', targetId: itemId, status: 'success', message: 'Thêm thuốc vào đơn thành công.', requestMeta });
  return getPrescriptionItemDetail(itemId, actor);
}

async function addPrescriptionItems(prescriptionId, items = [], actor, requestMeta = {}) {
  assertActorUser(actor);
  if (!Array.isArray(items) || items.length === 0) throw createError('items là bắt buộc.');
  let itemIds = [];
  await withOptionalTransaction(async (session) => {
    const prescription = await getPrescriptionOrThrow(prescriptionId, session);
    const context = await loadPrescriptionContext(prescription, session);
    assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.PRESCRIPTIONS.UPDATE_OWN]));
    const created = await addPrescriptionItemsInternal(prescription, items, actor, session);
    itemIds = created.map((item) => item._id);
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'prescription_items.create', targetType: 'prescription', targetId: prescriptionId, status: 'success', message: 'Thêm nhiều thuốc vào đơn thành công.', requestMeta, metadata: { item_ids: itemIds } });
  return getPrescriptionDetail(prescriptionId, actor);
}

async function listPrescriptionItems(prescriptionId, actor = {}) {
  const prescription = await Prescription.findById(prescriptionId).lean();
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  const context = await loadPrescriptionContext(prescription);
  assertPrescriptionAccess(prescription, context, actor, readAccessPermissions());
  const items = await PrescriptionItem.find({ prescription_id: prescriptionId })
    .sort({ created_at: 1 })
    .populate('medication_id', 'medication_code generic_name brand_name strength unit route_default status')
    .lean();
  return { prescription_id: String(prescriptionId), items };
}

async function getPrescriptionItemDetail(itemId, actor = {}) {
  const item = await PrescriptionItem.findById(itemId)
    .populate('medication_id', 'medication_code generic_name brand_name strength unit route_default status')
    .lean();
  if (!item) throw createError('Không tìm thấy prescription item.', 404);
  const prescription = await Prescription.findById(item.prescription_id).lean();
  const context = await loadPrescriptionContext(prescription);
  assertPrescriptionAccess(prescription, context, actor, readAccessPermissions());
  return { prescription_item: item };
}

async function updatePrescriptionItem(itemId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  const item = await PrescriptionItem.findById(itemId);
  if (!item) throw createError('Không tìm thấy prescription item.', 404);
  const prescription = await getPrescriptionOrThrow(item.prescription_id);
  const context = await loadPrescriptionContext(prescription);
  assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.PRESCRIPTIONS.UPDATE_OWN]));
  if (!PRESCRIPTION_EDITABLE_STATUSES.includes(prescription.status)) throw createError('Prescription hiện không thể chỉnh sửa item.', 409);
  if (item.dispensed_quantity > 0) throw createError('Prescription item đã cấp phát một phần, không sửa trực tiếp.', 409);

  const before = item.toObject();
  if (payload.medication_id && !sameId(payload.medication_id, item.medication_id)) {
    await validateMedicationAvailableForPrescription(payload.medication_id);
    const duplicate = await checkDuplicateMedicationInPrescription(item.prescription_id, payload.medication_id, item._id);
    if (duplicate.has_duplicate) throw createError('Thuốc này đã tồn tại trong đơn thuốc.', 409);
    item.medication_id = payload.medication_id;
  }
  for (const field of ['dose', 'frequency', 'route', 'duration_days', 'instructions']) {
    if (payload[field] !== undefined) item[field] = payload[field];
  }
  if (payload.quantity !== undefined) item.quantity = calculatePrescriptionItemQuantity(payload);
  if (payload.unit !== undefined) {
    const unit = normalizeString(payload.unit);
    if (!unit) throw createError('unit là bắt buộc với prescription item.', 400);
    item.unit = unit;
  }
  if (payload.status !== undefined) item.status = payload.status;
  item.updated_by = actor?.userId;
  await item.save();
  await recordAuditLog({ actor, action: 'prescription_item.update', targetType: 'prescription_item', targetId: item._id, status: 'success', message: 'Cập nhật thuốc trong đơn thành công.', requestMeta, before, after: item.toObject() });
  return getPrescriptionItemDetail(item._id, actor);
}

async function changePrescriptionItemStatus(itemId, nextStatus, actor, requestMeta = {}) {
  assertActorUser(actor);
  const item = await PrescriptionItem.findById(itemId);
  if (!item) throw createError('Không tìm thấy prescription item.', 404);
  const prescription = await getPrescriptionOrThrow(item.prescription_id);
  const context = await loadPrescriptionContext(prescription);
  assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.PRESCRIPTIONS.UPDATE_OWN, PERMISSION.PRESCRIPTIONS.CANCEL_BY_POLICY]));
  validatePrescriptionItemStatusTransition(item.status, nextStatus);
  if (item.dispensed_quantity > 0 && [PRESCRIPTION_ITEM_STATUS.CANCELLED, PRESCRIPTION_ITEM_STATUS.STOPPED].includes(nextStatus)) {
    throw createError('Item đã cấp phát, cần return/correction flow thay vì hủy trực tiếp.', 409);
  }
  item.status = nextStatus;
  item.updated_by = actor?.userId;
  await item.save();
  await recordAuditLog({ actor, action: `prescription_item.${nextStatus}`, targetType: 'prescription_item', targetId: item._id, status: 'success', message: 'Cập nhật trạng thái prescription item thành công.', requestMeta });
  return getPrescriptionItemDetail(item._id, actor);
}

async function stopPrescriptionItem(itemId, actor, requestMeta = {}) {
  return changePrescriptionItemStatus(itemId, PRESCRIPTION_ITEM_STATUS.STOPPED, actor, requestMeta);
}

async function cancelPrescriptionItem(itemId, actor, requestMeta = {}) {
  return changePrescriptionItemStatus(itemId, PRESCRIPTION_ITEM_STATUS.CANCELLED, actor, requestMeta);
}

async function completePrescriptionItem(itemId, actor, requestMeta = {}) {
  return changePrescriptionItemStatus(itemId, PRESCRIPTION_ITEM_STATUS.COMPLETED, actor, requestMeta);
}

async function removePrescriptionItem(itemId, actor, requestMeta = {}) {
  return cancelPrescriptionItem(itemId, actor, requestMeta);
}

async function validatePrescriptionBeforeActivate(prescriptionId, actor = {}, session = null) {
  const prescription = await withSession(Prescription.findById(prescriptionId).lean(), session);
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  const context = await loadPrescriptionContext(prescription, session);
  assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.PRESCRIPTIONS.CREATE, PERMISSION.PRESCRIPTIONS.UPDATE_OWN]));
  const items = await withSession(PrescriptionItem.find({
    prescription_id: prescription._id,
    status: { $nin: [PRESCRIPTION_ITEM_STATUS.CANCELLED, PRESCRIPTION_ITEM_STATUS.STOPPED] },
  }).lean(), session);
  if (items.length === 0) throw createError('Prescription phải có ít nhất một item trước khi activate.', 409);
  for (const item of items) {
    if (!item.medication_id || !item.dose || !item.route || !item.frequency || !item.duration_days || !item.quantity || !item.unit) {
      throw createError('Prescription item thiếu medication_id/dosage/route/frequency/duration/quantity/unit.', 409);
    }
    await validateMedicationAvailableForPrescription(item.medication_id, session);
  }
  const allergyCheck = await checkDrugAllergyConflict({ prescription_id: prescription._id }, session);
  const interactionCheck = await checkDrugInteractionConflict({ prescription_id: prescription._id }, session);
  const highRisk = allergyCheck.conflicts.some((conflict) => [ALLERGY_SEVERITY.SEVERE, ALLERGY_SEVERITY.LIFE_THREATENING].includes(conflict.severity));
  if (highRisk) throw createError('Prescription có dị ứng thuốc mức cao, cần xử lý trước khi activate.', 409, { allergy_conflicts: allergyCheck.conflicts });
  return {
    prescription_id: String(prescription._id),
    can_activate: true,
    items_count: items.length,
    warnings: allergyCheck.conflicts,
    interaction_policy: interactionCheck.policy,
  };
}

async function activatePrescription(prescriptionId, actor, requestMeta = {}) {
  assertActorUser(actor);
  await withOptionalTransaction(async (session) => {
    const prescription = await getPrescriptionOrThrow(prescriptionId, session);
    await validatePrescriptionBeforeActivate(prescription._id, actor, session);
    validatePrescriptionStatusTransition(prescription.status, PRESCRIPTION_STATUS.ACTIVE);
    prescription.status = PRESCRIPTION_STATUS.ACTIVE;
    prescription.updated_by = actor?.userId;
    await prescription.save(sessionOptions(session));
    await syncPrescriptionStatusToOrder(prescription, actor, session);
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'prescription.activate', targetType: 'prescription', targetId: prescriptionId, status: 'success', message: 'Kích hoạt đơn thuốc thành công.', requestMeta });
  return getPrescriptionDetail(prescriptionId, actor);
}

async function checkPrescriptionCanVerify(prescriptionId, actor = {}, session = null) {
  assertStaffPermission(actor, [PERMISSION.PRESCRIPTIONS.VERIFY]);
  const prescription = await withSession(Prescription.findById(prescriptionId).lean(), session);
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  if (![PRESCRIPTION_STATUS.ACTIVE, PRESCRIPTION_STATUS.DRAFT].includes(prescription.status)) {
    throw createError('Prescription phải active/draft trước khi verify.', 409);
  }
  const context = await loadPrescriptionContext(prescription, session);
  assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.PRESCRIPTIONS.VERIFY]));
  const items = await withSession(PrescriptionItem.find({
    prescription_id: prescription._id,
    status: PRESCRIPTION_ITEM_STATUS.ACTIVE,
  }).lean(), session);
  if (items.length === 0) throw createError('Prescription phải có ít nhất một item active trước khi verify.', 409);
  for (const item of items) {
    if (!item.medication_id || !item.dose || !item.route || !item.frequency || !item.duration_days || !item.quantity || !item.unit) {
      throw createError('Prescription item thiếu medication_id/dosage/route/frequency/duration/quantity/unit.', 409);
    }
    if (!item.quantity || item.quantity <= 0) throw createError('Prescription item thiếu quantity hợp lệ.', 409);
    await validateMedicationAvailableForPrescription(item.medication_id, session);
  }
  const allergyCheck = await checkDrugAllergyConflict({ prescription_id: prescription._id }, session);
  const interactionCheck = await checkDrugInteractionConflict({ prescription_id: prescription._id }, session);
  const highRisk = allergyCheck.conflicts.some((conflict) => [ALLERGY_SEVERITY.SEVERE, ALLERGY_SEVERITY.LIFE_THREATENING].includes(conflict.severity));
  return { prescription, items, context, warnings: allergyCheck.conflicts, highRisk, interactionCheck };
}

async function verifyPrescription(prescriptionId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  let warnings = [];
  await withOptionalTransaction(async (session) => {
    const validation = await checkPrescriptionCanVerify(prescriptionId, actor, session);
    if (validation.highRisk && !payload.override_allergy) {
      throw createError('Prescription có dị ứng thuốc mức cao, cần override_allergy để verify.', 409, { allergy_conflicts: validation.warnings });
    }
    const interactionOverrideReason = normalizeString(payload.override_interaction_warning_reason || payload.interaction_override_reason);
    if (validation.interactionCheck?.requires_override && !interactionOverrideReason) {
      throw createError('Drug interaction engine chưa sẵn sàng; cần override_interaction_warning_reason sau khi manual review.', 409, {
        interaction_policy: validation.interactionCheck.policy,
      });
    }
    const prescription = await getPrescriptionOrThrow(prescriptionId, session);
    if (prescription.status === PRESCRIPTION_STATUS.DRAFT) {
      validatePrescriptionStatusTransition(prescription.status, PRESCRIPTION_STATUS.ACTIVE);
      prescription.status = PRESCRIPTION_STATUS.ACTIVE;
    }
    validatePrescriptionStatusTransition(prescription.status, PRESCRIPTION_STATUS.VERIFIED);
    prescription.status = PRESCRIPTION_STATUS.VERIFIED;
    prescription.verified_by = actor?.userId;
    prescription.verified_at = new Date();
    prescription.updated_by = actor?.userId;
    await prescription.save(sessionOptions(session));
    await syncPrescriptionStatusToOrder(prescription, actor, session);
    warnings = validation.warnings;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'prescription.verified',
    targetType: 'prescription',
    targetId: prescriptionId,
    status: 'success',
    message: 'Verify prescription thành công.',
    requestMeta,
    metadata: {
      warnings,
      override_allergy: Boolean(payload.override_allergy),
      interaction_policy: 'drug_interaction_engine_unavailable_manual_review_required',
      interaction_override_reason: normalizeString(payload.override_interaction_warning_reason || payload.interaction_override_reason),
    },
  });
  return getPrescriptionDetail(prescriptionId, actor);
}

async function cancelPrescription(prescriptionId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  const reason = payload.reason || payload.cancel_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi hủy đơn thuốc.');
  await withOptionalTransaction(async (session) => {
    const prescription = await getPrescriptionOrThrow(prescriptionId, session);
    const context = await loadPrescriptionContext(prescription, session);
    assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.PRESCRIPTIONS.CANCEL, PERMISSION.PRESCRIPTIONS.CANCEL_OWN, PERMISSION.PRESCRIPTIONS.CANCEL_BY_POLICY]));
    if (PRESCRIPTION_TERMINAL_STATUSES.includes(prescription.status)) throw createError('Prescription đã ở trạng thái kết thúc.', 409);
    const dispensedExists = await withSession(DispenseItem.exists({
      prescription_item_id: { $in: (await withSession(PrescriptionItem.find({ prescription_id: prescription._id }).select('_id').lean(), session)).map((item) => item._id) },
      status: DISPENSE_ITEM_STATUS.DISPENSED,
    }), session);
    if (dispensedExists && !payload.force) throw createError('Prescription đã có thuốc được cấp, cần return/correction flow hoặc force.', 409);
    validatePrescriptionStatusTransition(prescription.status, PRESCRIPTION_STATUS.CANCELLED);
    prescription.status = PRESCRIPTION_STATUS.CANCELLED;
    prescription.cancelled_by = actor?.userId;
    prescription.cancelled_at = new Date();
    prescription.cancel_reason = reason;
    prescription.updated_by = actor?.userId;
    await prescription.save(sessionOptions(session));
    await syncPrescriptionStatusToOrder(prescription, actor, session);
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'prescription.cancel', targetType: 'prescription', targetId: prescriptionId, status: 'success', message: 'Hủy đơn thuốc thành công.', requestMeta, metadata: { reason } });
  return getPrescriptionDetail(prescriptionId, actor);
}

async function completePrescription(prescriptionId, actor, requestMeta = {}) {
  assertActorUser(actor);
  await withOptionalTransaction(async (session) => {
    const prescription = await getPrescriptionOrThrow(prescriptionId, session);
    const context = await loadPrescriptionContext(prescription, session);
    assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.PRESCRIPTIONS.VERIFY]));
    if (prescription.status !== PRESCRIPTION_STATUS.FULLY_DISPENSED) {
      throw createError('Chỉ prescription fully_dispensed mới được complete.', 409);
    }
    validatePrescriptionStatusTransition(prescription.status, PRESCRIPTION_STATUS.COMPLETED);
    prescription.status = PRESCRIPTION_STATUS.COMPLETED;
    prescription.completed_by = actor?.userId;
    prescription.completed_at = new Date();
    prescription.updated_by = actor?.userId;
    await prescription.save(sessionOptions(session));
    await syncPrescriptionStatusToOrder(prescription, actor, session);
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'prescription.complete', targetType: 'prescription', targetId: prescriptionId, status: 'success', message: 'Hoàn tất đơn thuốc thành công.', requestMeta });
  return getPrescriptionDetail(prescriptionId, actor);
}

async function calculateDispensedQuantities(prescriptionItemIds, session = null) {
  if (prescriptionItemIds.length === 0) return new Map();
  const aggregate = DispenseItem.aggregate([
    {
      $match: {
        prescription_item_id: { $in: prescriptionItemIds.map((id) => toObjectId(id, 'prescription_item_id')) },
        status: DISPENSE_ITEM_STATUS.DISPENSED,
      },
    },
    {
      $project: {
        prescription_item_id: 1,
        effective_quantity: {
          $max: [
            { $subtract: ['$quantity', { $ifNull: ['$returned_quantity', 0] }] },
            0,
          ],
        },
      },
    },
    { $group: { _id: '$prescription_item_id', dispensed_quantity: { $sum: '$effective_quantity' } } },
  ]);
  if (session) aggregate.session(session);
  const rows = await aggregate;
  return new Map(rows.map((row) => [String(row._id), Number(row.dispensed_quantity || 0)]));
}

async function calculatePrescriptionDispenseStatus(prescriptionId, session = null) {
  const items = await withSession(PrescriptionItem.find({
    prescription_id: prescriptionId,
    status: { $nin: [PRESCRIPTION_ITEM_STATUS.CANCELLED, PRESCRIPTION_ITEM_STATUS.STOPPED] },
  }).lean(), session);
  const quantities = await calculateDispensedQuantities(items.map((item) => item._id), session);
  let anyDispensed = false;
  let allDispensed = items.length > 0;
  const itemStates = [];
  for (const item of items) {
    const dispensedQuantity = quantities.get(String(item._id)) || 0;
    anyDispensed = anyDispensed || dispensedQuantity > 0;
    allDispensed = allDispensed && dispensedQuantity >= Number(item.quantity || 0);
    itemStates.push({ item, dispensedQuantity });
  }
  const status = allDispensed
    ? PRESCRIPTION_STATUS.FULLY_DISPENSED
    : anyDispensed
      ? PRESCRIPTION_STATUS.PARTIALLY_DISPENSED
      : PRESCRIPTION_STATUS.VERIFIED;
  return { status, itemStates };
}

async function updatePrescriptionStatusAfterDispense(prescriptionId, actor, session = null, options = {}) {
  const prescription = await getPrescriptionOrThrow(prescriptionId, session);
  const result = await calculatePrescriptionDispenseStatus(prescriptionId, session);
  for (const state of result.itemStates) {
    const nextItemStatus = state.dispensedQuantity >= Number(state.item.quantity || 0)
      ? PRESCRIPTION_ITEM_STATUS.COMPLETED
      : state.item.status === PRESCRIPTION_ITEM_STATUS.COMPLETED
        ? PRESCRIPTION_ITEM_STATUS.ACTIVE
        : state.item.status;
    await withSession(PrescriptionItem.updateOne(
      { _id: state.item._id },
      {
        $set: {
          dispensed_quantity: state.dispensedQuantity,
          status: nextItemStatus,
          updated_by: actor?.userId,
        },
      },
    ), session);
  }
  if (prescription.status !== result.status) {
    if (!options.allowReverseDispenseStatus) {
      validatePrescriptionStatusTransition(prescription.status, result.status);
    }
    prescription.status = result.status;
  }
  prescription.updated_by = actor?.userId;
  await prescription.save(sessionOptions(session));
  await syncPrescriptionStatusToOrder(prescription, actor, session, options);
  return prescription;
}

async function checkPrescriptionCanDispense(prescriptionId, actor = {}, session = null) {
  assertStaffPermission(actor, [PERMISSION.DISPENSES.CREATE, PERMISSION.DISPENSES.COMPLETE]);
  const prescription = await withSession(Prescription.findById(prescriptionId).lean(), session);
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  if (!PRESCRIPTION_DISPENSABLE_STATUSES.includes(prescription.status)) {
    throw createError('Prescription phải verified/partially_dispensed trước khi dispense.', 409);
  }
  const context = await loadPrescriptionContext(prescription, session);
  assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.DISPENSES.CREATE, PERMISSION.DISPENSES.COMPLETE]));
  const items = await withSession(PrescriptionItem.find({ prescription_id: prescription._id, status: PRESCRIPTION_ITEM_STATUS.ACTIVE }).lean(), session);
  if (items.length === 0) throw createError('Prescription không còn item active để dispense.', 409);
  return { prescription, context, items };
}

async function createDispense(prescriptionId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.DISPENSES.CREATE]);
  let dispenseId;
  await withOptionalTransaction(async (session) => {
    const validation = await checkPrescriptionCanDispense(prescriptionId, actor, session);
    const openDraft = await withSession(Dispense.exists({
      prescription_id: prescriptionId,
      status: DISPENSE_STATUS.DRAFT,
    }), session);
    if (openDraft && !payload.allow_multiple_drafts) throw createError('Prescription đã có dispense draft.', 409);
    const dispenseNo = payload.dispense_no || await generateDispenseNumber({ session });
    const [dispense] = await Dispense.create([{
      prescription_id: validation.prescription._id,
      patient_id: validation.prescription.patient_id,
      encounter_id: validation.prescription.encounter_id,
      dispense_no: dispenseNo,
      note: payload.note,
      assigned_to: payload.assigned_to || undefined,
      assigned_at: payload.assigned_to ? new Date() : undefined,
      priority: payload.priority || 'medium',
      sla_due_at: payload.sla_due_at ? parseDate(payload.sla_due_at, 'sla_due_at') : undefined,
      workflow_stage: payload.assigned_to ? 'assigned' : 'created',
      status: DISPENSE_STATUS.DRAFT,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    dispenseId = dispense._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'dispense.create', targetType: 'dispense', targetId: dispenseId, status: 'success', message: 'Tạo dispense draft thành công.', requestMeta });
  return getDispenseDetail(dispenseId, actor);
}

async function applyDispenseListScope(filter, actor = {}) {
  if (!actorType(actor)) return;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return;
  if (actorType(actor) === 'patient') {
    if (!hasPermission(actor, PERMISSION.PRESCRIPTIONS.SELF_READ)) throw createError('Bạn không có quyền xem cấp phát thuốc.', 403);
    filter.patient_id = actor.patientId || actor.patient_id;
    return;
  }
  assertStaffPermission(actor, [PERMISSION.DISPENSES.READ, PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT]);
  const departmentId = actorDepartmentId(actor);
  if (!departmentId) return;
  const encounters = await Encounter.find({ department_id: departmentId }).select('_id').lean();
  const encounterIds = encounters.map((encounter) => encounter._id);
  if (filter.encounter_id) {
    filter.encounter_id = encounterIds.some((id) => sameId(id, filter.encounter_id))
      ? filter.encounter_id
      : { $in: [] };
  } else {
    filter.encounter_id = { $in: encounterIds };
  }
}

async function listDispenses(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  for (const field of ['prescription_id', 'patient_id', 'encounter_id', 'dispensed_by', 'assigned_to', 'locked_by']) {
    if (query[field]) filter[field] = query[field];
  }
  for (const field of ['status', 'workflow_stage', 'priority', 'checklist_status']) {
    if (query[field]) {
      const values = String(query[field]).split(',').map((item) => item.trim()).filter(Boolean);
      filter[field] = values.length > 1 ? { $in: values } : values[0];
    }
  }
  applyDateRangeFilter(filter, 'created_at', query.created_from || query.date_from, query.created_to || query.date_to, 'created_from', 'created_to');
  applyDateRangeFilter(filter, 'dispensed_at', query.dispensed_from, query.dispensed_to, 'dispensed_from', 'dispensed_to');
  applyDateRangeFilter(filter, 'completed_at', query.completed_from, query.completed_to, 'completed_from', 'completed_to');
  applyDateRangeFilter(filter, 'cancelled_at', query.cancelled_from, query.cancelled_to, 'cancelled_from', 'cancelled_to');
  await applyDispenseListScope(filter, actor);
  const [items, total] = await Promise.all([
    Dispense.find(filter)
      .sort({ dispensed_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('prescription_id', 'prescription_no status prescribed_at')
      .populate('patient_id', 'patient_code full_name date_of_birth gender')
      .populate('dispensed_by', 'full_name username employee_code')
      .populate('assigned_to', 'full_name username employee_code')
      .populate('locked_by', 'full_name username employee_code')
      .lean(),
    Dispense.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getDispenseDetail(dispenseId, actor = {}) {
  const dispense = await Dispense.findById(dispenseId)
    .populate('prescription_id', 'prescription_no status order_id prescribed_at')
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
    .populate('dispensed_by', 'full_name username employee_code')
    .populate('completed_by', 'full_name username employee_code')
    .populate('assigned_to', 'full_name username employee_code')
    .populate('locked_by', 'full_name username employee_code')
    .lean();
  if (!dispense) throw createError('Không tìm thấy dispense.', 404);
  const prescription = await Prescription.findById(dispense.prescription_id?._id || dispense.prescription_id).lean();
  const context = await loadPrescriptionContext(prescription);
  assertPrescriptionAccess(prescription, context, actor, readAccessPermissions());
  const [items, transactions, charges] = await Promise.all([
    DispenseItem.find({ dispense_id: dispenseId })
      .sort({ created_at: 1 })
      .populate('prescription_item_id', 'dose frequency route quantity dispensed_quantity instructions')
      .populate('medication_id', 'medication_code generic_name brand_name strength unit')
      .populate('stock_batch_id', 'batch_no lot_no expiry_date storage_location quantity_on_hand status')
      .lean(),
    InventoryTransaction.find({ reference_type: 'dispense', reference_id: dispenseId }).sort({ occurred_at: 1 }).lean(),
    Charge.find({ dispense_id: dispenseId }).sort({ charged_at: -1 }).lean(),
  ]);
  return { dispense, items, inventory_transactions: transactions, charges };
}

async function selectStockBatch(medicationId, quantityNeeded, options = {}) {
  const remainingTotal = parsePositiveNumber(quantityNeeded, 'quantityNeeded');
  await validateMedicationActive(medicationId, options.session || null);
  let remaining = remainingTotal;
  const allowPartial = options.allowPartial === true || String(options.allow_partial || options.allowPartial || '').toLowerCase() === 'true';
  const filter = {
    medication_id: medicationId,
    status: STOCK_BATCH_STATUS.AVAILABLE,
    quantity_on_hand: { $gt: 0 },
    is_deleted: false,
    ...buildExpiryAvailableCondition(),
  };
  if (options.storage_location) filter.storage_location = options.storage_location;
  const batches = await withSession(StockBatch.find(filter).sort({ expiry_date: 1, received_date: 1, created_at: 1 }).lean(), options.session || null);
  const allocations = [];
  for (const batch of batches) {
    if (remaining <= 0) break;
    const quantity = Math.min(Number(batch.quantity_on_hand || 0), remaining);
    if (quantity <= 0) continue;
    allocations.push({ stock_batch_id: batch._id, quantity });
    remaining -= quantity;
  }
  if (remaining > 0 && !allowPartial) throw createError('Không đủ tồn kho khả dụng theo FEFO.', 409, { medication_id: medicationId, quantity_needed: remainingTotal, shortage: remaining }, ERROR_CODE.INSUFFICIENT_STOCK);
  return allocations;
}

async function decrementStockBatchForDispense(batchId, quantity, actor, session = null) {
  const now = new Date();
  const updatedBatch = await withSession(StockBatch.findOneAndUpdate(
    {
      _id: batchId,
      status: STOCK_BATCH_STATUS.AVAILABLE,
      quantity_on_hand: { $gte: quantity },
      is_deleted: false,
      ...buildExpiryAvailableCondition(now),
    },
    {
      $inc: { quantity_on_hand: -quantity },
      $set: { updated_by: actor?.userId },
    },
    { new: true },
  ), session);
  if (!updatedBatch) throw createError('Không đủ tồn hoặc batch đã thay đổi, vui lòng chọn lại stock batch.', 409, null, ERROR_CODE.INSUFFICIENT_STOCK);
  if (updatedBatch.quantity_on_hand === 0) {
    updatedBatch.status = STOCK_BATCH_STATUS.DEPLETED;
    applyDepletionMetadata(updatedBatch, actor, 'dispense');
    updatedBatch.updated_by = actor?.userId;
    await updatedBatch.save(sessionOptions(session));
  }
  return updatedBatch;
}

async function buildDispenseCompletionPlan(dispense, payload = {}, actor, session = null) {
  const prescription = await getPrescriptionOrThrow(dispense.prescription_id, session);
  const context = await loadPrescriptionContext(prescription, session);
  assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.DISPENSES.COMPLETE]));
  if (![DISPENSE_STATUS.DRAFT, DISPENSE_STATUS.PARTIALLY_DISPENSED].includes(dispense.status)) {
    throw createError('Dispense phải draft/partially_dispensed trước khi complete.', 409);
  }
  if (!PRESCRIPTION_DISPENSABLE_STATUSES.includes(prescription.status)) {
    throw createError('Prescription phải verified/partially_dispensed trước khi complete dispense.', 409);
  }

  const activeItems = await withSession(PrescriptionItem.find({
    prescription_id: prescription._id,
    status: PRESCRIPTION_ITEM_STATUS.ACTIVE,
  }).lean(), session);
  if (activeItems.length === 0) throw createError('Prescription không còn item active để dispense.', 409);
  const activeItemById = new Map(activeItems.map((item) => [String(item._id), item]));
  const dispensedMap = await calculateDispensedQuantities(activeItems.map((item) => item._id), session);

  const requestedItems = Array.isArray(payload.items) && payload.items.length > 0
    ? payload.items
    : activeItems
      .map((item) => ({
        prescription_item_id: item._id,
        quantity: Number(item.quantity || 0) - (dispensedMap.get(String(item._id)) || 0),
      }))
      .filter((item) => item.quantity > 0);

  if (requestedItems.length === 0) throw createError('Không có dispense item cần cấp.', 409);

  const grouped = new Map();
  for (const raw of requestedItems) {
    if (!raw.prescription_item_id) throw createError('prescription_item_id là bắt buộc trong dispense item.');
    const key = String(raw.prescription_item_id);
    const quantity = parsePositiveNumber(raw.quantity, 'quantity');
    const current = grouped.get(key) || { prescription_item_id: raw.prescription_item_id, quantity: 0, stock_batch_id: raw.stock_batch_id };
    if (current.stock_batch_id && raw.stock_batch_id && !sameId(current.stock_batch_id, raw.stock_batch_id)) {
      throw createError('Một prescription_item không được map nhiều stock_batch_id trực tiếp trong cùng payload. Hãy tách bằng auto_select hoặc nhiều dispense.', 409);
    }
    current.quantity += quantity;
    current.stock_batch_id = current.stock_batch_id || raw.stock_batch_id;
    grouped.set(key, current);
  }

  const plan = [];
  for (const request of grouped.values()) {
    const prescriptionItem = activeItemById.get(String(request.prescription_item_id));
    if (!prescriptionItem) throw createError('prescription_item không thuộc prescription hoặc không active.', 409);
    await validateMedicationActive(prescriptionItem.medication_id, session);
    const alreadyDispensed = dispensedMap.get(String(prescriptionItem._id)) || 0;
    const remaining = Number(prescriptionItem.quantity || 0) - alreadyDispensed;
    if (request.quantity > remaining) throw createError('Số lượng cấp vượt số lượng còn lại của prescription item.', 409);

    let allocations = [];
    if (request.stock_batch_id) {
      const batch = await validateStockBatchAvailable(request.stock_batch_id, request.quantity, session);
      if (!sameId(batch.medication_id, prescriptionItem.medication_id)) throw createError('Stock batch không đúng medication của prescription item.', 409);
      allocations = [{ stock_batch_id: batch._id, quantity: request.quantity }];
    } else {
      allocations = await selectStockBatch(prescriptionItem.medication_id, request.quantity, {
        session,
        storage_location: payload.storage_location,
        allowPartial: false,
      });
    }

    plan.push({ prescriptionItem, requestedQuantity: request.quantity, allocations });
  }
  return { prescription, context, plan };
}

async function previewDispenseCompletionPlan(dispenseId, payload = {}, actor = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.DISPENSES.READ, PERMISSION.DISPENSES.COMPLETE]);
  const dispense = await getDispenseOrThrow(dispenseId);
  let validation;
  try {
    validation = await buildDispenseCompletionPlan(dispense, payload, actor, null);
  } catch (error) {
    if (error?.code === ERROR_CODE.INSUFFICIENT_STOCK) {
      return {
        can_complete: false,
        shortages: [{
          medication_id: error.details?.medication_id,
          requested_quantity: error.details?.quantity_needed,
          shortage: error.details?.shortage,
          message: error.message,
        }],
        allocations: [],
        charge_preview: { total_amount: 0, items: [] },
      };
    }
    throw error;
  }

  const medicationIds = [...new Set(validation.plan.map((item) => String(item.prescriptionItem.medication_id)))];
  const batchIds = [...new Set(validation.plan.flatMap((item) => item.allocations.map((allocation) => String(allocation.stock_batch_id))))];
  const [medications, batches] = await Promise.all([
    MedicationMaster.find({ _id: { $in: medicationIds } }).lean(),
    StockBatch.find({ _id: { $in: batchIds } }).lean(),
  ]);
  const medicationMap = new Map(medications.map((item) => [String(item._id), item]));
  const batchMap = new Map(batches.map((item) => [String(item._id), item]));

  const allocations = validation.plan.map((plannedItem) => {
    const medication = medicationMap.get(String(plannedItem.prescriptionItem.medication_id));
    return {
      prescription_item_id: String(plannedItem.prescriptionItem._id),
      medication_id: String(plannedItem.prescriptionItem.medication_id),
      medication_name: [medication?.brand_name || medication?.generic_name, medication?.strength].filter(Boolean).join(' ') || medication?.medication_code,
      requested_quantity: plannedItem.requestedQuantity,
      remaining_quantity: plannedItem.requestedQuantity,
      unit: plannedItem.prescriptionItem.unit,
      batches: plannedItem.allocations.map((allocation) => {
        const batch = batchMap.get(String(allocation.stock_batch_id));
        const before = Number(batch?.quantity_on_hand || 0);
        return {
          stock_batch_id: String(allocation.stock_batch_id),
          batch_no: batch?.batch_no,
          lot_no: batch?.lot_no,
          expiry_date: batch?.expiry_date,
          quantity: allocation.quantity,
          quantity_on_hand_before: before,
          quantity_on_hand_after: Math.max(before - Number(allocation.quantity || 0), 0),
          storage_location: batch?.storage_location,
          unit_cost: batch?.unit_cost,
        };
      }),
    };
  });

  const chargeItems = allocations.map((allocation) => {
    const medication = medicationMap.get(String(allocation.medication_id));
    const unitPrice = Number(medication?.sale_price ?? 0);
    return {
      prescription_item_id: allocation.prescription_item_id,
      medication_id: allocation.medication_id,
      medication_name: allocation.medication_name,
      quantity: allocation.requested_quantity,
      unit_price: unitPrice,
      total_amount: unitPrice * Number(allocation.requested_quantity || 0),
    };
  });

  return {
    can_complete: true,
    shortages: [],
    allocations,
    charge_preview: {
      total_amount: chargeItems.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
      items: chargeItems,
    },
  };
}

async function createMedicationChargesForDispense(dispense, actor, session = null, options = {}) {
  if (options.create_charge === false) return [];
  if (!hasAnyPermission(actor, [PERMISSION.CHARGES.CREATE, PERMISSION.CHARGES.REQUEST_CREATE_MEDICATION, PERMISSION.CHARGES.MANAGE, PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Bạn không có quyền tạo charge thuốc.', 403);
  }

  const prescription = await withSession(Prescription.findById(dispense.prescription_id).lean(), session);
  const dispenseItems = await withSession(DispenseItem.find({
    dispense_id: dispense._id,
    status: DISPENSE_ITEM_STATUS.DISPENSED,
  }).lean(), session);
  const createdCharges = [];

  for (const item of dispenseItems) {
    const duplicate = await withSession(Charge.exists({
      $or: [
        { dispense_item_id: item._id },
        { source_module: 'dispense_item', source_id: item._id },
      ],
      status: { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES },
    }), session);
    if (duplicate) continue;

    const [medication, batch] = await Promise.all([
      withSession(MedicationMaster.findById(item.medication_id).lean(), session),
      item.stock_batch_id ? withSession(StockBatch.findById(item.stock_batch_id).lean(), session) : Promise.resolve(null),
    ]);
    if (!medication) throw createError('Không tìm thấy thuốc khi tạo charge.', 409);

    let service = null;
    if (medication.service_id) {
      service = await withSession(ServiceCatalog.findById(medication.service_id).lean(), session);
      if (service && (service.is_deleted || service.status !== SERVICE_STATUS.ACTIVE)) throw createError('Service catalog của thuốc không active.', 409);
      if (service && service.service_type !== SERVICE_TYPE.PHARMACY) throw createError('service_type của thuốc không phải pharmacy.', 409);
    }
    if (!service) {
      service = await withSession(ServiceCatalog.findOne({
        service_code: medication.medication_code,
        service_type: SERVICE_TYPE.PHARMACY,
        status: SERVICE_STATUS.ACTIVE,
        is_deleted: false,
      }).lean(), session);
    }

    const unitPrice = Number(
      service?.unit_price
      ?? medication.sale_price
      ?? batch?.unit_cost
      ?? 0,
    );
    if (unitPrice <= 0 && !options.allow_zero_price_charge) {
      throw createError(`Chưa cấu hình giá bán cho thuốc ${medication.medication_code}.`, 409);
    }
    if (!Number.isInteger(unitPrice)) throw createError('Giá thuốc phải dùng integer minor units.', 409);
    const totalAmount = Number(item.quantity || 0) * unitPrice;
    if (!Number.isInteger(totalAmount)) throw createError('Tổng tiền thuốc phải dùng integer minor units.', 409);

    try {
      const chargeNo = await generateChargeNumber({ session });
      const [charge] = await Charge.create([{
        patient_id: dispense.patient_id,
        encounter_id: dispense.encounter_id,
        service_id: service?._id,
        order_id: prescription?.order_id,
        source_module: 'dispense_item',
        source_id: item._id,
        dispense_id: dispense._id,
        dispense_item_id: item._id,
        medication_id: item.medication_id,
        charge_no: chargeNo,
        description: `${medication.generic_name}${medication.strength ? ` ${medication.strength}` : ''}`,
        quantity: item.quantity,
        unit_price: unitPrice,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: totalAmount,
        charged_at: new Date(),
        status: CHARGE_STATUS.POSTED,
        created_by: actor?.userId,
        updated_by: actor?.userId,
      }], sessionOptions(session));
      createdCharges.push(charge);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existingCharge = await withSession(Charge.findOne({
        source_module: 'dispense_item',
        source_id: item._id,
        status: { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES },
      }), session);
      if (existingCharge) createdCharges.push(existingCharge);
    }
  }
  return createdCharges;
}

async function completeDispense(dispenseId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.DISPENSES.COMPLETE]);
  let createdDispenseItemIds = [];
  let transactionIds = [];
  let chargeIds = [];
  let prescriptionId = null;

  await withOptionalTransaction(async (session) => {
    const dispense = await getDispenseOrThrow(dispenseId, session);
    if (dispense.status === DISPENSE_STATUS.DISPENSED) {
      const prescription = await getPrescriptionOrThrow(dispense.prescription_id, session);
      const context = await loadPrescriptionContext(prescription, session);
      assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.DISPENSES.COMPLETE]));
      prescriptionId = prescription._id;
      const charges = await createMedicationChargesForDispense(dispense, actor, session, {
        create_charge: payload.create_charge !== false,
        allow_zero_price_charge: Boolean(payload.allow_zero_price_charge),
      });
      chargeIds = charges.map((charge) => charge._id);
      return;
    }
    const validation = await buildDispenseCompletionPlan(dispense, payload, actor, session);
    prescriptionId = validation.prescription._id;

    for (const plannedItem of validation.plan) {
      for (const allocation of plannedItem.allocations) {
        let dispenseItem;
        try {
          [dispenseItem] = await DispenseItem.create([{
            dispense_id: dispense._id,
            prescription_item_id: plannedItem.prescriptionItem._id,
            medication_id: plannedItem.prescriptionItem.medication_id,
            stock_batch_id: allocation.stock_batch_id,
            quantity: allocation.quantity,
            returned_quantity: 0,
            unit: plannedItem.prescriptionItem.unit,
            instructions: plannedItem.prescriptionItem.instructions,
            status: DISPENSE_ITEM_STATUS.DISPENSED,
            created_by: actor?.userId,
            updated_by: actor?.userId,
          }], sessionOptions(session));
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
          throw createError('Dispense item đã được complete bởi request khác, vui lòng tải lại.', 409);
        }
        createdDispenseItemIds.push(dispenseItem._id);

        const updatedBatch = await decrementStockBatchForDispense(allocation.stock_batch_id, allocation.quantity, actor, session);
        const transaction = await createInventoryTransaction({
          medication_id: plannedItem.prescriptionItem.medication_id,
          stock_batch_id: allocation.stock_batch_id,
          transaction_type: INVENTORY_TRANSACTION_TYPE.DISPENSE,
          direction: INVENTORY_TRANSACTION_DIRECTION.OUT,
          quantity: allocation.quantity,
          balance_after: updatedBatch.quantity_on_hand,
          unit_cost: updatedBatch.unit_cost,
          reference_type: 'dispense',
          reference_id: dispense._id,
          note: `dispense_item:${dispenseItem._id}`,
        }, actor, session);
        transactionIds.push(transaction._id);
        if (updatedBatch.status === STOCK_BATCH_STATUS.DEPLETED) {
          updatedBatch.last_transaction_id = transaction._id;
          await updatedBatch.save(sessionOptions(session));
        }
      }
    }

    dispense.status = DISPENSE_STATUS.DISPENSED;
    dispense.dispensed_by = actor?.userId;
    dispense.dispensed_at = new Date();
    dispense.completed_by = actor?.userId;
    dispense.completed_at = dispense.dispensed_at;
    dispense.updated_by = actor?.userId;
    await dispense.save(sessionOptions(session));

    await updatePrescriptionStatusAfterDispense(dispense.prescription_id, actor, session);
    const charges = await createMedicationChargesForDispense(dispense, actor, session, {
      create_charge: payload.create_charge !== false,
      allow_zero_price_charge: Boolean(payload.allow_zero_price_charge),
    });
    chargeIds = charges.map((charge) => charge._id);
  }, { fallbackToNoTransaction: false });

  await recordAuditLog({
    actor,
    action: 'dispense.completed',
    targetType: 'dispense',
    targetId: dispenseId,
    status: 'success',
    message: 'Complete dispense thành công.',
    requestMeta,
    metadata: {
      prescription_id: prescriptionId,
      dispense_item_ids: createdDispenseItemIds,
      inventory_transaction_ids: transactionIds,
      charge_ids: chargeIds,
    },
  });
  return getDispenseDetail(dispenseId, actor);
}

async function cancelDispense(dispenseId, payload = {}, actor, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.DISPENSES.CANCEL]);
  const reason = payload.reason || payload.cancel_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi cancel dispense.');
  const returnedItemIds = [];
  const transactionIds = [];
  const voidedChargeIds = [];
  await withOptionalTransaction(async (session) => {
    const dispense = await getDispenseOrThrow(dispenseId, session);
    const prescription = await getPrescriptionOrThrow(dispense.prescription_id, session);
    const context = await loadPrescriptionContext(prescription, session);
    assertPrescriptionAccess(prescription, context, actor, writeAccessPermissions([PERMISSION.DISPENSES.CANCEL, PERMISSION.DISPENSES.RETURN]));

    if (dispense.status === DISPENSE_STATUS.DRAFT) {
      assertTransition(DISPENSE_TRANSITIONS, dispense.status, DISPENSE_STATUS.CANCELLED, 'dispense');
      dispense.status = DISPENSE_STATUS.CANCELLED;
      dispense.cancelled_by = actor?.userId;
      dispense.cancelled_at = new Date();
      dispense.cancel_reason = reason;
      dispense.updated_by = actor?.userId;
      await dispense.save(sessionOptions(session));
      return;
    }

    if (dispense.status !== DISPENSE_STATUS.DISPENSED) {
      throw createError('Chỉ dispense draft hoặc dispensed mới được cancel/return.', 409);
    }
    if (!(payload.return_to_stock === true || payload.return === true)) {
      throw createError('Dispense đã cấp phát phải dùng return_to_stock=true để hoàn tồn kho.', 409);
    }
    assertTransition(DISPENSE_TRANSITIONS, dispense.status, DISPENSE_STATUS.RETURNED, 'dispense');
    const items = await withSession(DispenseItem.find({
      dispense_id: dispense._id,
      status: DISPENSE_ITEM_STATUS.DISPENSED,
    }), session);

    const billedCharge = await withSession(Charge.exists({
      dispense_id: dispense._id,
      status: CHARGE_STATUS.BILLED,
    }), session);
    if (billedCharge) {
      throw createError('Charge thuốc đã lên invoice; cần refund/void invoice trước khi return dispense.', 409);
    }

    for (const item of items) {
      let updatedBatch = null;
      if (item.stock_batch_id) {
        updatedBatch = await withSession(StockBatch.findOneAndUpdate(
          { _id: item.stock_batch_id, is_deleted: false },
          {
            $inc: { quantity_on_hand: Number(item.quantity || 0) },
            $set: { updated_by: actor?.userId },
          },
          { new: true },
        ), session);
        if (!updatedBatch) throw createError('Không tìm thấy stock batch để return.', 409);
        if (updatedBatch.status === STOCK_BATCH_STATUS.DEPLETED && (!updatedBatch.expiry_date || updatedBatch.expiry_date > new Date())) {
          updatedBatch.status = STOCK_BATCH_STATUS.AVAILABLE;
          await updatedBatch.save(sessionOptions(session));
        }
        const transaction = await createInventoryTransaction({
          medication_id: item.medication_id,
          stock_batch_id: item.stock_batch_id,
          transaction_type: INVENTORY_TRANSACTION_TYPE.RETURN,
          direction: INVENTORY_TRANSACTION_DIRECTION.IN,
          quantity: item.quantity,
          balance_after: updatedBatch.quantity_on_hand,
          unit_cost: updatedBatch.unit_cost,
          reference_type: 'dispense_return',
          reference_id: dispense._id,
          note: `return_dispense_item:${item._id}; reason:${reason}`,
        }, actor, session);
        transactionIds.push(transaction._id);
      }
      item.returned_quantity = item.quantity;
      item.status = DISPENSE_ITEM_STATUS.RETURNED;
      item.updated_by = actor?.userId;
      await item.save(sessionOptions(session));
      returnedItemIds.push(item._id);
    }

    const charges = await withSession(Charge.find({
      dispense_id: dispense._id,
      status: { $in: [CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT, CHARGE_STATUS.POSTED] },
    }), session);
    for (const charge of charges) {
      assertTransition(CHARGE_TRANSITIONS, charge.status, CHARGE_STATUS.VOIDED, 'charge');
      charge.status = CHARGE_STATUS.VOIDED;
      charge.voided_by = actor?.userId;
      charge.voided_at = new Date();
      charge.void_reason = reason;
      charge.updated_by = actor?.userId;
      await charge.save(sessionOptions(session));
      voidedChargeIds.push(charge._id);
    }

    dispense.status = DISPENSE_STATUS.RETURNED;
    dispense.cancelled_by = actor?.userId;
    dispense.cancelled_at = new Date();
    dispense.cancel_reason = reason;
    dispense.updated_by = actor?.userId;
    await dispense.save(sessionOptions(session));
    await updatePrescriptionStatusAfterDispense(dispense.prescription_id, actor, session, { allowReverseDispenseStatus: true });
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({
    actor,
    action: 'dispense.cancelled',
    targetType: 'dispense',
    targetId: dispenseId,
    status: 'success',
    message: 'Cancel/return dispense thành công.',
    requestMeta,
    metadata: { reason, returned_item_ids: returnedItemIds, inventory_transaction_ids: transactionIds, voided_charge_ids: voidedChargeIds },
  });
  return getDispenseDetail(dispenseId, actor);
}

async function getEncounterPrescriptions(encounterId, query = {}, actor = {}) {
  return listPrescriptions({ ...query, encounter_id: encounterId }, actor);
}

async function getPatientPrescriptionHistory(patientId, query = {}, actor = {}) {
  if (actorType(actor) === 'patient' && !sameId(patientId, actor.patientId || actor.patient_id)) {
    throw createError('Bạn không có quyền xem đơn thuốc của bệnh nhân khác.', 403);
  }
  return listPrescriptions({ ...query, patient_id: patientId }, actor);
}

async function getPatientActivePrescriptions(patientId, query = {}, actor = {}) {
  const patient = await Patient.findById(patientId).lean();
  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  return listPrescriptions({ ...query, patient_id: patient._id, status: PRESCRIPTION_STATUS.ACTIVE }, actor);
}

async function getDoctorPrescriptions(doctorId, query = {}, actor = {}) {
  if (
    actorType(actor)
    && actor.userId
    && !sameId(actor.userId, doctorId)
    && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)
    && !(hasPermission(actor, PERMISSION.PRESCRIPTIONS.READ) && !actorDepartmentId(actor))
  ) {
    throw createError('Bạn không có quyền xem đơn thuốc của bác sĩ khác.', 403);
  }
  return listPrescriptions({ ...query, prescribed_by: doctorId }, actor);
}

async function getPrescriptionSummary(prescriptionId, actor = {}) {
  const detail = await getPrescriptionDetail(prescriptionId, actor);
  return {
    prescription_id: String(detail.prescription._id),
    status: detail.prescription.status,
    items_count: detail.items.length,
    active_items_count: detail.items.filter((item) => item.status === PRESCRIPTION_ITEM_STATUS.ACTIVE).length,
    completed_items_count: detail.items.filter((item) => item.status === PRESCRIPTION_ITEM_STATUS.COMPLETED).length,
    total_medications: new Set(detail.items.map((item) => String(item.medication_id?._id || item.medication_id))).size,
    dispenses_count: detail.dispenses.length,
  };
}

async function duplicatePrescription(prescriptionId, payload = {}, actor, requestMeta = {}) {
  const detail = await getPrescriptionDetail(prescriptionId, actor);
  const reason = normalizeString(payload.reason || payload.amend_reason || payload.renew_reason);
  if (payload.amend === true && !reason) throw createError('reason là bắt buộc khi amend prescription.', 400);
  const created = await createPrescription({
    encounter_id: payload.encounter_id || detail.prescription.encounter_id?._id || detail.prescription.encounter_id,
    note: payload.note !== undefined ? payload.note : detail.prescription.note,
    status: PRESCRIPTION_STATUS.DRAFT,
    amended_from: payload.amend === true ? detail.prescription._id : undefined,
    renewed_from: payload.amend === true ? undefined : detail.prescription._id,
    version: Number(detail.prescription.version || 1) + 1,
    items: detail.items
      .filter((item) => item.status !== PRESCRIPTION_ITEM_STATUS.CANCELLED)
      .map((item) => ({
        medication_id: item.medication_id?._id || item.medication_id,
        dose: item.dose,
        frequency: item.frequency,
        route: item.route,
        duration_days: item.duration_days,
        quantity: item.quantity,
        unit: item.unit,
        instructions: item.instructions,
      })),
  }, actor, requestMeta);
  if (payload.amend === true) {
    await Prescription.updateOne(
      { _id: detail.prescription._id },
      {
        $set: {
          superseded_by: created.prescription?._id || created._id,
          is_current: false,
          updated_by: actor?.userId,
        },
      },
    );
    await recordAuditLog({
      actor,
      action: 'prescription.amend',
      targetType: 'prescription',
      targetId: created.prescription?._id || created._id,
      status: 'success',
      message: 'Amend prescription tạo version mới.',
      requestMeta,
      metadata: { amended_from: String(detail.prescription._id), reason },
    });
  }
  return created;
}

async function renewPrescription(prescriptionId, payload = {}, actor, requestMeta = {}) {
  const reason = normalizeString(payload.reason || payload.renew_reason);
  if (!reason) throw createError('reason là bắt buộc khi renew prescription.', 400);
  return duplicatePrescription(prescriptionId, { ...payload, reason, note: payload.note || 'Gia hạn từ đơn thuốc cũ.' }, actor, requestMeta);
}

async function listRefillRequests(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.patient_id) filter.patient_id = toObjectId(query.patient_id, 'patient_id');
  if (query.prescription_id) filter.prescription_id = toObjectId(query.prescription_id, 'prescription_id');
  applyDateRangeFilter(filter, 'created_at', query.created_from || query.date_from, query.created_to || query.date_to, 'created_from', 'created_to');

  if (actorType(actor) === 'patient') {
    if (!hasPermission(actor, PERMISSION.PRESCRIPTIONS.SELF_READ)) throw createError('Bạn không có quyền xem refill request.', 403);
    filter.patient_id = actor.patientId || actor.patient_id;
  } else if (actorType(actor)) {
    assertStaffPermission(actor, [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.PRESCRIPTIONS.VERIFY]);
  }

  if (query.search || query.q) {
    const keyword = escapeRegex(query.search || query.q);
    filter.$or = [
      { reason: { $regex: keyword, $options: 'i' } },
      { review_note: { $regex: keyword, $options: 'i' } },
      { decision_reason: { $regex: keyword, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    PrescriptionRefillRequest.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('prescription_id', 'prescription_no status prescribed_at prescribed_by')
      .populate('reviewed_by', 'full_name username employee_code')
      .populate('reviewed_by_pharmacist', 'full_name username employee_code')
      .populate('reviewed_by_doctor', 'full_name username employee_code')
      .populate('converted_prescription_id', 'prescription_no status')
      .lean(),
    PrescriptionRefillRequest.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getRefillRequestDetail(refillRequestId, actor = {}) {
  const request = await PrescriptionRefillRequest.findById(refillRequestId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('prescription_id', 'prescription_no status prescribed_at prescribed_by')
    .populate('reviewed_by', 'full_name username employee_code')
    .populate('reviewed_by_pharmacist', 'full_name username employee_code')
    .populate('reviewed_by_doctor', 'full_name username employee_code')
    .populate('converted_prescription_id', 'prescription_no status')
    .lean();
  if (!request) throw createError('Không tìm thấy yêu cầu cấp lại thuốc.', 404);
  if (actorType(actor) === 'patient' && !sameId(request.patient_id?._id || request.patient_id, actor.patientId || actor.patient_id)) {
    throw createError('Bạn không có quyền xem refill request này.', 403);
  }
  if (actorType(actor) === 'staff') {
    assertStaffPermission(actor, [PERMISSION.PRESCRIPTIONS.READ, PERMISSION.PRESCRIPTIONS.READ_DEPARTMENT, PERMISSION.PRESCRIPTIONS.VERIFY]);
  }
  return { refill_request: request };
}

async function createRefillRequest(prescriptionId, payload = {}, actor = {}, requestMeta = {}) {
  const prescription = await Prescription.findById(prescriptionId).lean();
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  if (actorType(actor) === 'patient' && !sameId(prescription.patient_id, actor.patientId || actor.patient_id)) {
    throw createError('Bạn không có quyền yêu cầu cấp lại đơn thuốc này.', 403);
  }

  const latestDispense = await Dispense.findOne({
    prescription_id: prescription._id,
    status: DISPENSE_STATUS.DISPENSED,
  }).sort({ completed_at: -1, dispensed_at: -1 }).lean();

  const request = await PrescriptionRefillRequest.create({
    patient_id: prescription.patient_id,
    prescription_id: prescription._id,
    requested_by_actor_type: actorType(actor) || payload.requested_by_actor_type || 'staff',
    requested_by_actor_id: actor.userId || actor.patientId || actor.actorId || payload.requested_by_actor_id,
    priority: payload.priority || 'medium',
    requested_items: payload.requested_items || [],
    last_dispensed_at: latestDispense?.completed_at || latestDispense?.dispensed_at,
    reason: payload.reason,
    expired_at: parseDate(payload.expired_at, 'expired_at'),
    created_by: actor?.userId,
    updated_by: actor?.userId,
  });
  await recordAuditLog({ actor, action: 'prescription_refill_request.create', targetType: 'prescription_refill_request', targetId: request._id, status: 'success', message: 'Tạo yêu cầu cấp lại thuốc thành công.', requestMeta });
  return getRefillRequestDetail(request._id, actor);
}

async function updateRefillDecision(refillRequestId, payload = {}, actor = {}, requestMeta = {}, decision) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PRESCRIPTIONS.VERIFY, PERMISSION.PRESCRIPTIONS.CREATE]);
  const request = await PrescriptionRefillRequest.findById(refillRequestId);
  if (!request) throw createError('Không tìm thấy yêu cầu cấp lại thuốc.', 404);
  if (request.status !== PRESCRIPTION_REFILL_REQUEST_STATUS.PENDING) {
    throw createError('Yêu cầu cấp lại thuốc đã được xử lý.', 409);
  }
  request.status = decision;
  request.reviewed_by = actor.userId;
  request.reviewed_by_pharmacist = actor.userId;
  request.reviewed_at = new Date();
  request.review_note = payload.review_note || payload.note;
  request.decision_reason = payload.decision_reason || payload.reason || payload.note;
  request.updated_by = actor.userId;
  await request.save();
  await recordAuditLog({ actor, action: `prescription_refill_request.${decision}`, targetType: 'prescription_refill_request', targetId: request._id, status: 'success', message: 'Cập nhật quyết định refill request thành công.', requestMeta });
  return getRefillRequestDetail(request._id, actor);
}

function approveRefillRequest(refillRequestId, payload = {}, actor = {}, requestMeta = {}) {
  return updateRefillDecision(refillRequestId, payload, actor, requestMeta, PRESCRIPTION_REFILL_REQUEST_STATUS.APPROVED);
}

function rejectRefillRequest(refillRequestId, payload = {}, actor = {}, requestMeta = {}) {
  return updateRefillDecision(refillRequestId, payload, actor, requestMeta, PRESCRIPTION_REFILL_REQUEST_STATUS.REJECTED);
}

async function sendRefillRequestToDoctor(refillRequestId, payload = {}, actor = {}, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PRESCRIPTIONS.VERIFY, PERMISSION.PRESCRIPTIONS.CREATE]);
  const request = await PrescriptionRefillRequest.findById(refillRequestId);
  if (!request) throw createError('Không tìm thấy yêu cầu cấp lại thuốc.', 404);
  if (request.status !== PRESCRIPTION_REFILL_REQUEST_STATUS.PENDING) throw createError('Chỉ yêu cầu pending mới gửi bác sĩ duyệt.', 409);
  request.review_note = payload.note || payload.review_note;
  request.routed_to_doctor_at = new Date();
  request.routed_to_doctor_by = actor.userId;
  request.reviewed_by_doctor = payload.doctor_id || undefined;
  request.updated_by = actor.userId;
  await request.save();
  await recordAuditLog({ actor, action: 'prescription_refill_request.send_to_doctor', targetType: 'prescription_refill_request', targetId: request._id, status: 'success', message: 'Đã gửi yêu cầu refill cho bác sĩ.', requestMeta });
  return getRefillRequestDetail(request._id, actor);
}

async function convertRefillRequestToPrescription(refillRequestId, payload = {}, actor = {}, requestMeta = {}) {
  assertActorUser(actor);
  assertStaffPermission(actor, [PERMISSION.PRESCRIPTIONS.CREATE]);
  const request = await PrescriptionRefillRequest.findById(refillRequestId);
  if (!request) throw createError('Không tìm thấy yêu cầu cấp lại thuốc.', 404);
  if (request.converted_prescription_id) return getRefillRequestDetail(request._id, actor);
  if (![PRESCRIPTION_REFILL_REQUEST_STATUS.PENDING, PRESCRIPTION_REFILL_REQUEST_STATUS.APPROVED].includes(request.status)) {
    throw createError('Chỉ yêu cầu pending/approved mới chuyển thành đơn thuốc.', 409);
  }
  const created = await renewPrescription(request.prescription_id, {
    ...payload,
    reason: payload.reason || request.reason || 'Chuyển yêu cầu cấp lại thuốc thành đơn mới.',
  }, actor, requestMeta);
  request.status = PRESCRIPTION_REFILL_REQUEST_STATUS.APPROVED;
  request.reviewed_by = actor.userId;
  request.reviewed_by_pharmacist = actor.userId;
  request.reviewed_at = new Date();
  request.converted_prescription_id = created.prescription?._id || created.prescription_id || created._id;
  request.decision_reason = payload.reason || request.reason;
  request.updated_by = actor.userId;
  await request.save();
  await recordAuditLog({ actor, action: 'prescription_refill_request.convert_to_prescription', targetType: 'prescription_refill_request', targetId: request._id, status: 'success', message: 'Đã chuyển refill request thành prescription.', requestMeta, metadata: { converted_prescription_id: String(request.converted_prescription_id) } });
  return getRefillRequestDetail(request._id, actor);
}

async function recordPrescriptionFailure({ actor, action, targetId, requestMeta, error }) {
  try {
    await recordAuditLog({
      actor,
      action,
      targetType: 'prescription',
      targetId,
      status: 'failure',
      message: error?.message || 'Prescription/pharmacy action failed.',
      requestMeta,
      metadata: { error_name: error?.name, error_code: error?.code },
    });
  } catch (_) {
    // Best-effort audit must not mask the original business error.
  }
}

function prescriptionFailureAuditContext(methodName, args = []) {
  const configs = {
    receiveInventory: { action: 'inventory.receipt', actorIndex: 1, requestMetaIndex: 2, targetIndex: null },
    adjustInventory: { action: 'inventory.adjustment', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    markBatchExpired: { action: 'stock_batch.expired', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    recallStockBatch: { action: 'stock_batch.recalled', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    quarantineStockBatch: { action: 'stock_batch.quarantined', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    releaseQuarantineStockBatch: { action: 'stock_batch.quarantine_released', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    wasteStockBatch: { action: 'stock_batch.waste', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    transferStockBatchLocation: { action: 'stock_batch.transfer_location', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    createPrescription: { action: 'prescription.create', actorIndex: 1, requestMetaIndex: 2, targetIndex: null },
    updatePrescription: { action: 'prescription.update', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    activatePrescription: { action: 'prescription.activate', actorIndex: 1, requestMetaIndex: 2, targetIndex: 0 },
    verifyPrescription: { action: 'prescription.verified', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    cancelPrescription: { action: 'prescription.cancel', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    completePrescription: { action: 'prescription.complete', actorIndex: 1, requestMetaIndex: 2, targetIndex: 0 },
    addPrescriptionItem: { action: 'prescription_item.create', actorIndex: 1, requestMetaIndex: 2, targetIndex: null },
    addPrescriptionItems: { action: 'prescription_items.create', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    updatePrescriptionItem: { action: 'prescription_item.update', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    createDispense: { action: 'dispense.create', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    completeDispense: { action: 'dispense.completed', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    cancelDispense: { action: 'dispense.cancelled', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    duplicatePrescription: { action: 'prescription.duplicate', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    renewPrescription: { action: 'prescription.renew', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
  };
  const config = configs[methodName];
  if (!config) return null;
  return {
    action: config.action,
    actor: args[config.actorIndex],
    requestMeta: args[config.requestMetaIndex],
    targetId: config.targetIndex === null ? null : args[config.targetIndex],
  };
}

function withPrescriptionFailureAudits(serviceExports) {
  return Object.fromEntries(Object.entries(serviceExports).map(([methodName, method]) => {
    if (typeof method !== 'function') return [methodName, method];
    if (!prescriptionFailureAuditContext(methodName, [])) return [methodName, method];
    return [methodName, async (...args) => {
      try {
        return await method(...args);
      } catch (error) {
        const context = prescriptionFailureAuditContext(methodName, args);
        await recordPrescriptionFailure({ ...context, error });
        throw error;
      }
    }];
  }));
}

const prescriptionServiceExports = {
  // createMedication: Tạo thuốc.
  createMedication,
  // listMedications: Liệt kê thuốc.
  listMedications,
  // searchMedications: Tìm kiếm thuốc.
  searchMedications,
  // getMedicationDetail: Lấy chi tiết thuốc.
  getMedicationDetail,
  // updateMedication: Cập nhật thuốc.
  updateMedication,
  // updateMedicationStatus: Cập nhật trạng thái thuốc.
  updateMedicationStatus,
  // retireMedication: Ngừng sử dụng thuốc.
  retireMedication,
  // validateMedicationAvailableForPrescription: Kiểm tra tính hợp lệ của điều kiện thuốc có thể kê đơn.
  validateMedicationAvailableForPrescription,
  // validateMedicationActive: Kiểm tra tính hợp lệ của trạng thái hoạt động của thuốc.
  validateMedicationActive,
  // createStockBatch: Tạo lô tồn kho.
  createStockBatch,
  // listStockBatches: Liệt kê lô tồn kho.
  listStockBatches,
  // getStockBatchDetail: Lấy chi tiết lô tồn kho.
  getStockBatchDetail,
  // updateStockBatch: Cập nhật lô tồn kho.
  updateStockBatch,
  // markBatchExpired: Đánh dấu lô tồn kho đã hết hạn nghiệp vụ tương ứng.
  markBatchExpired,
  // recallStockBatch: Thu hồi/gọi lại lô tồn kho.
  recallStockBatch,
  // quarantineStockBatch: Cách ly lô thuốc.
  quarantineStockBatch,
  // releaseQuarantineStockBatch: Mở cách ly lô thuốc.
  releaseQuarantineStockBatch,
  // wasteStockBatch: Ghi nhận hủy/hao hụt lô thuốc.
  wasteStockBatch,
  // transferStockBatchLocation: Chuyển vị trí lưu kho cho lô thuốc.
  transferStockBatchLocation,
  // getStockBatchRecallImpact: Lấy phạm vi ảnh hưởng của lô bị recall.
  getStockBatchRecallImpact,
  // receiveInventory: Tiếp nhận tồn kho.
  receiveInventory,
  // adjustInventory: Điều chỉnh tồn kho.
  adjustInventory,
  // listInventoryTransactions: Liệt kê giao dịch tồn kho.
  listInventoryTransactions,
  // createInventoryTransaction: Tạo giao dịch tồn kho.
  createInventoryTransaction,
  // createPrescription: Tạo đơn thuốc.
  createPrescription,
  // listPrescriptions: Liệt kê đơn thuốc.
  listPrescriptions,
  // searchPrescriptions: Tìm kiếm đơn thuốc.
  searchPrescriptions,
  // getPrescriptionDetail: Lấy chi tiết đơn thuốc.
  getPrescriptionDetail,
  // updatePrescription: Cập nhật đơn thuốc.
  updatePrescription,
  // activatePrescription: Kích hoạt đơn thuốc.
  activatePrescription,
  // verifyPrescription: Xác minh đơn thuốc.
  verifyPrescription,
  // cancelPrescription: Hủy đơn thuốc.
  cancelPrescription,
  // completePrescription: Hoàn tất đơn thuốc.
  completePrescription,
  // generatePrescriptionNumber: Sinh/tạo mã đơn thuốc.
  generatePrescriptionNumber,
  // validatePrescriptionCreation: Kiểm tra tính hợp lệ của điều kiện tạo đơn thuốc.
  validatePrescriptionCreation,
  // validatePrescriptionStatusTransition: Kiểm tra tính hợp lệ của chuyển trạng thái đơn thuốc.
  validatePrescriptionStatusTransition,
  // validatePrescriptionBeforeActivate: Kiểm tra tính hợp lệ của đơn thuốc trước khi kích hoạt.
  validatePrescriptionBeforeActivate,
  // checkPrescriptionCanVerify: Kiểm tra điều kiện duyệt đơn thuốc.
  checkPrescriptionCanVerify,
  // checkPrescriptionEditable: Kiểm tra điều kiện chỉnh sửa đơn thuốc.
  checkPrescriptionEditable,
  // addPrescriptionItem: Thêm dòng thuốc trong đơn thuốc.
  addPrescriptionItem,
  // addPrescriptionItems: Thêm dòng thuốc trong đơn.
  addPrescriptionItems,
  // listPrescriptionItems: Liệt kê dòng thuốc trong đơn.
  listPrescriptionItems,
  // getPrescriptionItemDetail: Lấy chi tiết dòng thuốc trong đơn.
  getPrescriptionItemDetail,
  // updatePrescriptionItem: Cập nhật dòng thuốc trong đơn thuốc.
  updatePrescriptionItem,
  // stopPrescriptionItem: Dừng một dòng thuốc trong đơn thuốc.
  stopPrescriptionItem,
  // cancelPrescriptionItem: Hủy dòng thuốc trong đơn thuốc.
  cancelPrescriptionItem,
  // completePrescriptionItem: Hoàn tất dòng thuốc trong đơn thuốc.
  completePrescriptionItem,
  // removePrescriptionItem: Gỡ/xóa dòng thuốc trong đơn thuốc.
  removePrescriptionItem,
  // validatePrescriptionItemPayload: Kiểm tra tính hợp lệ của dữ liệu dòng thuốc trong đơn.
  validatePrescriptionItemPayload,
  // checkDrugAllergyConflict: Kiểm tra xung đột dị ứng thuốc.
  checkDrugAllergyConflict,
  // checkDrugInteractionConflict: Kiểm tra xung đột tương tác thuốc.
  checkDrugInteractionConflict,
  // checkDuplicateMedicationInPrescription: Kiểm tra thuốc bị kê trùng trong đơn.
  checkDuplicateMedicationInPrescription,
  // calculatePrescriptionItemQuantity: Tính toán số lượng dòng thuốc trong đơn.
  calculatePrescriptionItemQuantity,
  // calculatePrescriptionDispenseStatus: Tính toán trạng thái cấp phát của đơn thuốc.
  calculatePrescriptionDispenseStatus,
  // createDispense: Tạo cấp phát thuốc.
  createDispense,
  // listDispenses: Liệt kê cấp phát thuốc.
  listDispenses,
  // getDispenseDetail: Lấy chi tiết cấp phát thuốc.
  getDispenseDetail,
  // selectStockBatch: Chọn lô tồn kho.
  selectStockBatch,
  // completeDispense: Hoàn tất cấp phát thuốc.
  completeDispense,
  // previewDispenseCompletionPlan: Xem trước kế hoạch FEFO, trừ tồn và charge trước khi hoàn tất cấp phát.
  previewDispenseCompletionPlan,
  // cancelDispense: Hủy cấp phát thuốc.
  cancelDispense,
  // createMedicationChargesForDispense: Tạo thuốc khoản phí cho cấp phát thuốc.
  createMedicationChargesForDispense,
  // getEncounterPrescriptions: Lấy đơn thuốc theo lượt khám.
  getEncounterPrescriptions,
  // getPatientPrescriptionHistory: Lấy lịch sử đơn thuốc của bệnh nhân.
  getPatientPrescriptionHistory,
  // getPatientActivePrescriptions: Lấy đơn thuốc đang hoạt động của bệnh nhân.
  getPatientActivePrescriptions,
  // getDoctorPrescriptions: Lấy đơn thuốc của bác sĩ.
  getDoctorPrescriptions,
  // getPrescriptionSummary: Lấy tổng hợp đơn thuốc.
  getPrescriptionSummary,
  // duplicatePrescription: Sao chép đơn thuốc.
  duplicatePrescription,
  // renewPrescription: Gia hạn/làm mới đơn thuốc.
  renewPrescription,
  // listRefillRequests: Liệt kê yêu cầu cấp lại thuốc.
  listRefillRequests,
  // getRefillRequestDetail: Lấy chi tiết yêu cầu cấp lại thuốc.
  getRefillRequestDetail,
  // createRefillRequest: Tạo yêu cầu cấp lại thuốc.
  createRefillRequest,
  // approveRefillRequest: Duyệt yêu cầu cấp lại thuốc.
  approveRefillRequest,
  // rejectRefillRequest: Từ chối yêu cầu cấp lại thuốc.
  rejectRefillRequest,
  // sendRefillRequestToDoctor: Gửi yêu cầu cấp lại thuốc cho bác sĩ.
  sendRefillRequestToDoctor,
  // convertRefillRequestToPrescription: Chuyển yêu cầu cấp lại thuốc thành đơn mới.
  convertRefillRequestToPrescription,
};

module.exports = withPrescriptionFailureAudits(prescriptionServiceExports);
