const { Types } = require('mongoose');
const {
  AuditLog,
  Charge,
  Encounter,
  ImagingOrder,
  ImagingReport,
  InsuranceClaim,
  Invoice,
  InvoiceItem,
  LabOrder,
  LabResult,
  Order,
  Patient,
  Payment,
  PaymentIntent,
  ProcedureOrder,
  ServiceCatalog,
  Specimen,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  CHARGE_STATUS,
  IMAGING_ORDER_STATUS,
  IMAGING_REPORT_STATUS,
  INVOICE_STATUS,
  LAB_ORDER_STATUS,
  LAB_RESULT_STATUS,
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_INTENT_STATUS,
  PAYMENT_STATUS,
  PROCEDURE_STATUS,
  SERVICE_STATUS,
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
const orderService = require('./order.service');

const CLINICAL_SERVICE_TYPES = [
  SERVICE_TYPE.LAB,
  SERVICE_TYPE.IMAGING,
  SERVICE_TYPE.PROCEDURE,
];

const ACTIVE_CHARGE_STATUSES = [
  CHARGE_STATUS.PENDING,
  CHARGE_STATUS.DRAFT,
  CHARGE_STATUS.POSTED,
  CHARGE_STATUS.BILLED,
];

const TERMINAL_CHARGE_STATUSES = [
  CHARGE_STATUS.VOIDED,
  CHARGE_STATUS.CANCELLED,
  CHARGE_STATUS.REFUNDED,
];

const PAYABLE_INVOICE_STATUSES = [
  INVOICE_STATUS.ISSUED,
  INVOICE_STATUS.PARTIALLY_PAID,
];

const TERMINAL_INVOICE_STATUSES = [
  INVOICE_STATUS.VOIDED,
  INVOICE_STATUS.CANCELLED,
  INVOICE_STATUS.REFUNDED,
];

const PAYMENT_REVIEW_STATUSES = [
  PAYMENT_INTENT_STATUS.PENDING_MANUAL_CONFIRMATION,
  PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT,
  PAYMENT_INTENT_STATUS.MANUAL_REVIEW,
];

const CLINICAL_BILLING_READ_PERMISSIONS = [
  PERMISSION.CHARGES.READ,
  PERMISSION.CHARGES.MANAGE,
  PERMISSION.INVOICES.READ,
  PERMISSION.INVOICES.READ_UNPAID,
  PERMISSION.PAYMENTS.READ,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_DEPARTMENT,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.LAB_ORDERS.READ_DEPARTMENT,
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.IMAGING_ORDERS.READ_DEPARTMENT,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ_DEPARTMENT,
  PERMISSION.REPORTS.BILLING_READ,
  PERMISSION.REPORTS.REVENUE_READ,
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
];

const CLINICAL_BILLING_CREATE_CHARGE_PERMISSIONS = [
  PERMISSION.ORDERS.CREATE_CHARGE,
  PERMISSION.CHARGES.CREATE,
  PERMISSION.CHARGES.REQUEST_CREATE,
  PERMISSION.CHARGES.MANAGE,
  PERMISSION.PROCEDURE_ORDERS.CHARGE_CREATE,
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
  if (actor.actorType !== 'staff') throw createError('Chỉ tài khoản nhân sự được dùng clinical billing workspace.', 403);
  if (!hasAnyPermission(actor, CLINICAL_BILLING_READ_PERMISSIONS) && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    throw createError('Bạn không có quyền xem dữ liệu hóa đơn cận lâm sàng.', 403);
  }
}

function assertStaffChargeCreate(actor = {}) {
  if (actor.actorType !== 'staff') throw createError('Chỉ tài khoản nhân sự được tạo charge.', 403);
  if (!hasAnyPermission(actor, CLINICAL_BILLING_CREATE_CHARGE_PERMISSIONS) && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    throw createError('Bạn không có quyền tạo charge cận lâm sàng.', 403);
  }
}

function sameId(left, right) {
  if (!left || !right) return false;
  return String(left) === String(right);
}

function toObjectId(value) {
  if (!value || !Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
}

function getId(value) {
  return value?._id || value || null;
}

function compactObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ''));
}

function normalizeDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function addDateRange(filter, fieldName, query = {}, fromKey = 'date_from', toKey = 'date_to') {
  const from = normalizeDate(query[fromKey], fromKey);
  const to = normalizeDate(query[toKey], toKey);
  if (!from && !to) return filter;
  filter[fieldName] = { ...(filter[fieldName] || {}) };
  if (from) filter[fieldName].$gte = from;
  if (to) filter[fieldName].$lte = to;
  return filter;
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

function normalizeServiceTypes(query = {}) {
  const raw = query.service_types || query.service_type || query.source_type || query.order_type;
  const values = Array.isArray(raw)
    ? raw
    : String(raw || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const serviceTypes = values.length ? values : CLINICAL_SERVICE_TYPES;
  const invalid = serviceTypes.filter((item) => !CLINICAL_SERVICE_TYPES.includes(item));
  if (invalid.length) throw createError(`service_type không thuộc workspace cận lâm sàng: ${invalid.join(', ')}`, 400);
  return [...new Set(serviceTypes)];
}

async function clinicalServiceIds(query = {}) {
  const serviceTypes = normalizeServiceTypes(query);
  const filter = {
    is_deleted: false,
    service_type: { $in: serviceTypes },
  };
  if (query.billable_only === true || query.billable_only === 'true') filter.is_billable = true;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.service_status) filter.status = query.service_status;
  const services = await ServiceCatalog.find(filter).select('_id service_type service_code service_name unit_price is_billable status department_id').lean();
  return {
    serviceTypes,
    services,
    serviceIds: services.map((service) => service._id),
    serviceMap: new Map(services.map((service) => [String(service._id), service])),
  };
}

function serviceTypeOf(row) {
  const service = row?.service_id;
  if (service && typeof service === 'object' && service.service_type) return service.service_type;
  return row?.order_type || row?.source_type || row?.source_module || 'clinical';
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

function orderMini(order) {
  if (!order) return null;
  if (typeof order !== 'object') return { _id: order };
  return {
    _id: order._id,
    order_no: order.order_no,
    order_type: order.order_type,
    priority: order.priority,
    status: order.status,
    ordered_at: order.ordered_at,
    service_id: order.service_id,
    department_id: order.department_id,
    is_billable: order.is_billable,
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

function buildOrderQuery(query = {}, serviceTypes = CLINICAL_SERVICE_TYPES) {
  const filter = { order_type: { $in: serviceTypes } };
  for (const field of ['patient_id', 'encounter_id', 'admission_id', 'department_id', 'ordered_by', 'priority', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.order_status) filter.status = query.order_status;
  if (query.order_no) filter.order_no = { $regex: escapeRegex(query.order_no), $options: 'i' };
  addDateRange(filter, 'ordered_at', query);
  return filter;
}

async function applyOrderKeywordFilter(filter, query = {}) {
  const keyword = normalizeString(query.q || query.keyword || query.search || query.patient_keyword);
  if (!keyword) return filter;
  const pattern = escapeRegex(keyword);
  const [patients, childOrderIds] = await Promise.all([
    Patient.find({
      $or: [
        { patient_code: { $regex: pattern, $options: 'i' } },
        { full_name: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
      ],
    }).select('_id').limit(200).lean(),
    findClinicalChildOrderIds(keyword),
  ]);
  filter.$or = [
    { order_no: { $regex: pattern, $options: 'i' } },
    { patient_id: { $in: patients.map((patient) => patient._id) } },
    { _id: { $in: childOrderIds } },
  ];
  return filter;
}

async function findClinicalChildOrderIds(keyword) {
  const pattern = escapeRegex(keyword);
  const [labOrders, imagingOrders, procedureOrders] = await Promise.all([
    LabOrder.find({ $or: [{ lab_order_no: { $regex: pattern, $options: 'i' } }, { test_name: { $regex: pattern, $options: 'i' } }, { test_code: { $regex: pattern, $options: 'i' } }] }).select('order_id').limit(200).lean(),
    ImagingOrder.find({ $or: [{ imaging_order_no: { $regex: pattern, $options: 'i' } }, { body_part: { $regex: pattern, $options: 'i' } }, { modality: { $regex: pattern, $options: 'i' } }] }).select('order_id').limit(200).lean(),
    ProcedureOrder.find({ $or: [{ procedure_order_no: { $regex: pattern, $options: 'i' } }, { procedure_name: { $regex: pattern, $options: 'i' } }, { procedure_code: { $regex: pattern, $options: 'i' } }] }).select('order_id').limit(200).lean(),
  ]);
  return [...labOrders, ...imagingOrders, ...procedureOrders].map((item) => item.order_id).filter(Boolean);
}

async function loadClinicalChildren(orderIds = []) {
  if (!orderIds.length) {
    return {
      labByOrder: new Map(),
      imagingByOrder: new Map(),
      procedureByOrder: new Map(),
      latestSpecimenByLabOrder: new Map(),
      latestLabResultByLabOrder: new Map(),
      latestImagingReportByImagingOrder: new Map(),
    };
  }

  const [labOrders, imagingOrders, procedureOrders] = await Promise.all([
    LabOrder.find({ order_id: { $in: orderIds } }).lean(),
    ImagingOrder.find({ order_id: { $in: orderIds } }).lean(),
    ProcedureOrder.find({ order_id: { $in: orderIds } }).lean(),
  ]);
  const labIds = labOrders.map((item) => item._id);
  const imagingIds = imagingOrders.map((item) => item._id);
  const [specimens, labResults, imagingReports] = await Promise.all([
    labIds.length
      ? Specimen.find({ lab_order_id: { $in: labIds } }).sort({ received_at: -1, collected_at: -1, created_at: -1 }).lean()
      : [],
    labIds.length
      ? LabResult.find({ lab_order_id: { $in: labIds }, is_current: true }).sort({ verified_at: -1, reported_at: -1, created_at: -1 }).lean()
      : [],
    imagingIds.length
      ? ImagingReport.find({ imaging_order_id: { $in: imagingIds }, is_current: true }).sort({ verified_at: -1, reported_at: -1, created_at: -1 }).lean()
      : [],
  ]);

  const latestSpecimenByLabOrder = new Map();
  for (const specimen of specimens) {
    const key = String(specimen.lab_order_id);
    if (!latestSpecimenByLabOrder.has(key)) latestSpecimenByLabOrder.set(key, specimen);
  }
  const latestLabResultByLabOrder = new Map();
  for (const result of labResults) {
    const key = String(result.lab_order_id);
    if (!latestLabResultByLabOrder.has(key)) latestLabResultByLabOrder.set(key, result);
  }
  const latestImagingReportByImagingOrder = new Map();
  for (const report of imagingReports) {
    const key = String(report.imaging_order_id);
    if (!latestImagingReportByImagingOrder.has(key)) latestImagingReportByImagingOrder.set(key, report);
  }

  return {
    labByOrder: new Map(labOrders.map((item) => [String(item.order_id), item])),
    imagingByOrder: new Map(imagingOrders.map((item) => [String(item.order_id), item])),
    procedureByOrder: new Map(procedureOrders.map((item) => [String(item.order_id), item])),
    latestSpecimenByLabOrder,
    latestLabResultByLabOrder,
    latestImagingReportByImagingOrder,
  };
}

function childForOrder(order, childMaps) {
  if (order.order_type === ORDER_TYPE.LAB) {
    const labOrder = childMaps.labByOrder.get(String(order._id));
    return {
      source_order: labOrder || null,
      source_order_id: labOrder?._id,
      source_order_no: labOrder?.lab_order_no,
      execution_status: labOrder?.status || order.status,
      latest_specimen: labOrder ? childMaps.latestSpecimenByLabOrder.get(String(labOrder._id)) || null : null,
      latest_result: labOrder ? childMaps.latestLabResultByLabOrder.get(String(labOrder._id)) || null : null,
    };
  }
  if (order.order_type === ORDER_TYPE.IMAGING) {
    const imagingOrder = childMaps.imagingByOrder.get(String(order._id));
    return {
      source_order: imagingOrder || null,
      source_order_id: imagingOrder?._id,
      source_order_no: imagingOrder?.imaging_order_no,
      execution_status: imagingOrder?.status || order.status,
      latest_report: imagingOrder ? childMaps.latestImagingReportByImagingOrder.get(String(imagingOrder._id)) || null : null,
    };
  }
  const procedureOrder = childMaps.procedureByOrder.get(String(order._id));
  return {
    source_order: procedureOrder || null,
    source_order_id: procedureOrder?._id,
    source_order_no: procedureOrder?.procedure_order_no,
    execution_status: procedureOrder?.status || order.status,
  };
}

function evaluateChargeEligibility(order, childContext = {}, existingCharge = null, query = {}) {
  const service = order.service_id && typeof order.service_id === 'object' ? order.service_id : null;
  if (existingCharge) {
    return {
      can_create_charge: false,
      charge_block_reason: `Order đã có charge ${existingCharge.charge_no || ''}`.trim(),
      eligible_at: existingCharge.charged_at || existingCharge.created_at,
    };
  }
  if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.ENTERED_IN_ERROR].includes(order.status)) {
    return { can_create_charge: false, charge_block_reason: 'Order đã hủy hoặc nhập sai.', eligible_at: order.cancelled_at || order.updated_at };
  }
  if (!service) return { can_create_charge: false, charge_block_reason: 'Order chưa gắn service catalog.', eligible_at: null };
  if (service.status !== SERVICE_STATUS.ACTIVE) return { can_create_charge: false, charge_block_reason: 'Service catalog không active.', eligible_at: null };
  if (!service.is_billable) return { can_create_charge: false, charge_block_reason: 'Service catalog không billable.', eligible_at: null };
  if (service.service_type && service.service_type !== order.order_type) return { can_create_charge: false, charge_block_reason: 'Service catalog không khớp loại order.', eligible_at: null };

  if (order.order_type === ORDER_TYPE.LAB) {
    const labOrder = childContext.source_order;
    const specimen = childContext.latest_specimen;
    const result = childContext.latest_result;
    const eligible = [
      ORDER_STATUS.ACKNOWLEDGED,
      ORDER_STATUS.IN_PROGRESS,
      ORDER_STATUS.COMPLETED,
    ].includes(order.status)
      || [
        LAB_ORDER_STATUS.COLLECTED,
        LAB_ORDER_STATUS.RECEIVED,
        LAB_ORDER_STATUS.IN_PROGRESS,
        LAB_ORDER_STATUS.COMPLETED,
      ].includes(labOrder?.status)
      || specimen?.received_at
      || [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED].includes(result?.status);
    return {
      can_create_charge: Boolean(eligible),
      charge_block_reason: eligible ? null : 'Lab chưa đến mốc đủ điều kiện tính phí.',
      eligible_at: result?.verified_at || result?.reported_at || specimen?.received_at || specimen?.collected_at || labOrder?.collected_at || order.acknowledged_at || order.ordered_at,
    };
  }

  if (order.order_type === ORDER_TYPE.IMAGING) {
    const imagingOrder = childContext.source_order;
    const report = childContext.latest_report;
    if ([IMAGING_ORDER_STATUS.CANCELLED, IMAGING_ORDER_STATUS.NO_SHOW].includes(imagingOrder?.status)) {
      return { can_create_charge: false, charge_block_reason: 'Imaging order đã hủy hoặc no-show.', eligible_at: imagingOrder?.cancelled_at || imagingOrder?.no_show_at };
    }
    const eligible = [
      ORDER_STATUS.ACKNOWLEDGED,
      ORDER_STATUS.IN_PROGRESS,
      ORDER_STATUS.COMPLETED,
    ].includes(order.status)
      || [
        IMAGING_ORDER_STATUS.SCHEDULED,
        IMAGING_ORDER_STATUS.IN_PROGRESS,
        IMAGING_ORDER_STATUS.COMPLETED,
      ].includes(imagingOrder?.status)
      || [IMAGING_REPORT_STATUS.FINAL, IMAGING_REPORT_STATUS.AMENDED].includes(report?.status);
    return {
      can_create_charge: Boolean(eligible),
      charge_block_reason: eligible ? null : 'Imaging chưa đến mốc đủ điều kiện tính phí.',
      eligible_at: report?.verified_at || report?.reported_at || imagingOrder?.completed_at || imagingOrder?.started_at || imagingOrder?.scheduled_at || order.acknowledged_at || order.ordered_at,
    };
  }

  const procedureOrder = childContext.source_order;
  if ([PROCEDURE_STATUS.CANCELLED, PROCEDURE_STATUS.NO_SHOW].includes(procedureOrder?.status)) {
    return { can_create_charge: false, charge_block_reason: 'Procedure đã hủy hoặc no-show.', eligible_at: procedureOrder?.cancelled_at || procedureOrder?.no_show_at };
  }
  const allowBeforeComplete = query.allow_before_complete === true || query.allow_before_complete === 'true';
  const completed = procedureOrder?.status === PROCEDURE_STATUS.COMPLETED;
  return {
    can_create_charge: completed || allowBeforeComplete,
    charge_block_reason: completed || allowBeforeComplete ? null : 'Thủ thuật chưa completed.',
    eligible_at: procedureOrder?.completed_at || procedureOrder?.performed_end || procedureOrder?.performed_start || procedureOrder?.scheduled_start || order.ordered_at,
  };
}

async function listChargeCandidates(query = {}, actor = {}) {
  assertStaffRead(actor);
  const { page, limit } = getPagination(query, 25, 100);
  const serviceTypes = normalizeServiceTypes(query);
  const orderFilter = await applyOrderKeywordFilter(buildOrderQuery(query, serviceTypes), query);
  if (query.only_billable !== false && query.only_billable !== 'false') orderFilter.is_billable = true;

  const rawLimit = Math.max(page * limit * 3, 300);
  const orders = await Order.find(orderFilter)
    .sort({ ordered_at: -1, created_at: -1 })
    .limit(Math.min(rawLimit, 1500))
    .populate('patient_id', 'patient_code full_name phone gender date_of_birth')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
    .populate('department_id', 'department_code department_name')
    .populate('ordered_by', 'full_name username employee_code')
    .populate('service_id', 'service_code service_name service_type unit_price is_billable status department_id')
    .lean();

  const orderIds = orders.map((order) => order._id);
  const [childMaps, charges] = await Promise.all([
    loadClinicalChildren(orderIds),
    Charge.find({
      order_id: { $in: orderIds },
      status: { $in: ACTIVE_CHARGE_STATUSES },
    }).lean(),
  ]);
  const chargeByOrder = new Map(charges.map((charge) => [String(charge.order_id), charge]));

  let items = orders.map((order) => {
    const childContext = childForOrder(order, childMaps);
    const existingCharge = chargeByOrder.get(String(order._id)) || null;
    const eligibility = evaluateChargeEligibility(order, childContext, existingCharge, query);
    const service = serviceMini(order.service_id);
    return {
      order_id: order._id,
      order_no: order.order_no,
      source_type: order.order_type,
      source_order_id: childContext.source_order_id,
      source_order_no: childContext.source_order_no,
      source_order: childContext.source_order,
      patient: patientMini(order.patient_id),
      encounter: encounterMini(order.encounter_id),
      department: order.department_id,
      service,
      order_status: order.status,
      execution_status: childContext.execution_status,
      priority: order.priority,
      ordered_at: order.ordered_at,
      can_create_charge: eligibility.can_create_charge,
      charge_block_reason: eligibility.charge_block_reason,
      eligible_at: eligibility.eligible_at,
      suggested_price: service?.unit_price || 0,
      existing_charge: existingCharge,
      latest_specimen: childContext.latest_specimen,
      latest_result: childContext.latest_result,
      latest_report: childContext.latest_report,
    };
  });

  if (query.only_missing_charge === true || query.only_missing_charge === 'true' || query.missing_charge === true || query.missing_charge === 'true') {
    items = items.filter((item) => !item.existing_charge);
  }
  if (query.can_create_charge === true || query.can_create_charge === 'true') {
    items = items.filter((item) => item.can_create_charge);
  }
  if (query.execution_status) {
    items = items.filter((item) => item.execution_status === query.execution_status);
  }

  const total = items.length;
  const pageItems = items.slice((page - 1) * limit, page * limit);
  return { items: pageItems, pagination: buildPagination(page, limit, total) };
}

async function buildChargeQuery(query = {}) {
  const { serviceIds } = await clinicalServiceIds({ ...query, billable_only: query.billable_only });
  const filter = { service_id: { $in: serviceIds } };
  for (const field of ['patient_id', 'encounter_id', 'admission_id', 'order_id', 'invoice_id', 'service_id', 'status', 'source_module', 'source_id', 'review_status']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.charge_no) filter.charge_no = { $regex: escapeRegex(query.charge_no), $options: 'i' };
  if (query.has_invoice === 'false' || query.has_invoice === false) {
    filter.$or = [{ invoice_id: { $exists: false } }, { invoice_id: null }];
  }
  if (query.has_invoice === 'true' || query.has_invoice === true) {
    filter.invoice_id = { $exists: true, $ne: null };
  }
  if (query.amount_min !== undefined && query.amount_min !== '') filter.total_amount = { ...(filter.total_amount || {}), $gte: Number(query.amount_min) };
  if (query.amount_max !== undefined && query.amount_max !== '') filter.total_amount = { ...(filter.total_amount || {}), $lte: Number(query.amount_max) };
  addDateRange(filter, 'charged_at', query);

  const keyword = normalizeString(query.q || query.keyword || query.search);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    const [patients, orders] = await Promise.all([
      Patient.find({
        $or: [
          { patient_code: { $regex: pattern, $options: 'i' } },
          { full_name: { $regex: pattern, $options: 'i' } },
          { phone: { $regex: pattern, $options: 'i' } },
        ],
      }).select('_id').limit(200).lean(),
      Order.find({ order_no: { $regex: pattern, $options: 'i' } }).select('_id').limit(200).lean(),
    ]);
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { charge_no: { $regex: pattern, $options: 'i' } },
          { description: { $regex: pattern, $options: 'i' } },
          ...(patients.length ? [{ patient_id: { $in: patients.map((patient) => patient._id) } }] : []),
          ...(orders.length ? [{ order_id: { $in: orders.map((order) => order._id) } }] : []),
        ],
      },
    ];
  }
  return filter;
}

function enrichChargeRow(charge) {
  return {
    ...charge,
    patient: patientMini(charge.patient_id),
    encounter: encounterMini(charge.encounter_id),
    order: orderMini(charge.order_id),
    service: serviceMini(charge.service_id),
    invoice: charge.invoice_id && typeof charge.invoice_id === 'object' ? charge.invoice_id : null,
    service_type: serviceTypeOf(charge),
  };
}

function groupCharges(charges = []) {
  const patientGroups = new Map();
  const encounterGroups = new Map();
  for (const charge of charges) {
    const patientKey = String(charge.patient?._id || charge.patient_id?._id || charge.patient_id || 'unknown');
    const encounterKey = String(charge.encounter?._id || charge.encounter_id?._id || charge.encounter_id || 'none');
    const patientGroup = patientGroups.get(patientKey) || { patient: charge.patient || patientMini(charge.patient_id), count: 0, total_amount: 0 };
    patientGroup.count += 1;
    patientGroup.total_amount += Number(charge.total_amount || 0);
    patientGroups.set(patientKey, patientGroup);
    const encounterGroup = encounterGroups.get(encounterKey) || { encounter: charge.encounter || encounterMini(charge.encounter_id), patient: charge.patient || patientMini(charge.patient_id), count: 0, total_amount: 0 };
    encounterGroup.count += 1;
    encounterGroup.total_amount += Number(charge.total_amount || 0);
    encounterGroups.set(encounterKey, encounterGroup);
  }
  return {
    by_patient: Array.from(patientGroups.values()).sort((a, b) => b.total_amount - a.total_amount),
    by_encounter: Array.from(encounterGroups.values()).sort((a, b) => b.total_amount - a.total_amount),
  };
}

async function listClinicalCharges(query = {}, actor = {}) {
  assertStaffRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = await buildChargeQuery(query);
  const [items, total] = await Promise.all([
    Charge.find(filter)
      .sort({ charged_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('service_id', 'service_code service_name service_type unit_price is_billable status department_id')
      .populate('patient_id', 'patient_code full_name phone gender date_of_birth')
      .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
      .populate('order_id', 'order_no order_type priority status ordered_at service_id department_id is_billable')
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
      .lean(),
    Charge.countDocuments(filter),
  ]);
  const enriched = items.map(enrichChargeRow);
  return {
    items: enriched,
    groups: groupCharges(enriched),
    pagination: buildPagination(page, limit, total),
  };
}

async function listUnbilledCharges(query = {}, actor = {}) {
  return listClinicalCharges({
    ...query,
    status: query.status || CHARGE_STATUS.POSTED,
    has_invoice: false,
  }, actor);
}

async function clinicalInvoiceIds(query = {}) {
  const { serviceIds } = await clinicalServiceIds(query);
  if (!serviceIds.length) return [];
  const chargeFilter = {
    service_id: { $in: serviceIds },
    invoice_id: { $exists: true, $ne: null },
  };
  if (query.patient_id) chargeFilter.patient_id = query.patient_id;
  if (query.encounter_id) chargeFilter.encounter_id = query.encounter_id;
  if (query.admission_id) chargeFilter.admission_id = query.admission_id;
  if (query.order_id) chargeFilter.order_id = query.order_id;
  return Charge.distinct('invoice_id', chargeFilter);
}

async function buildInvoiceQuery(query = {}) {
  const invoiceIds = await clinicalInvoiceIds(query);
  const filter = { _id: { $in: invoiceIds } };
  for (const field of ['patient_id', 'encounter_id', 'admission_id', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  const invoiceNo = normalizeString(query.invoice_no);
  if (invoiceNo) filter.invoice_no = { $regex: escapeRegex(invoiceNo), $options: 'i' };

  const paymentState = normalizeString(query.payment_state || query.payment_status);
  if (paymentState === 'unpaid') {
    filter.status = INVOICE_STATUS.ISSUED;
    filter.paid_amount = 0;
    filter.balance_due = { ...(filter.balance_due || {}), $gt: 0 };
  } else if (['partial', 'partially_paid'].includes(paymentState)) {
    filter.status = INVOICE_STATUS.PARTIALLY_PAID;
    filter.balance_due = { ...(filter.balance_due || {}), $gt: 0 };
  } else if (paymentState === 'paid') {
    filter.status = INVOICE_STATUS.PAID;
    filter.balance_due = 0;
  } else if (paymentState === 'outstanding') {
    filter.status = { $in: PAYABLE_INVOICE_STATUSES };
    filter.balance_due = { ...(filter.balance_due || {}), $gt: 0 };
  }

  if (query.overdue === true || query.overdue === 'true') {
    filter.status = filter.status || { $in: PAYABLE_INVOICE_STATUSES };
    filter.balance_due = { ...(filter.balance_due || {}), $gt: 0 };
    filter.due_at = { ...(filter.due_at || {}), $lt: new Date() };
  }
  if (query.balance_due_gt !== undefined && query.balance_due_gt !== '') {
    filter.balance_due = { ...(typeof filter.balance_due === 'object' ? filter.balance_due : {}), $gt: Number(query.balance_due_gt) };
  }
  if (query.balance_due_lt !== undefined && query.balance_due_lt !== '') {
    filter.balance_due = { ...(typeof filter.balance_due === 'object' ? filter.balance_due : {}), $lt: Number(query.balance_due_lt) };
  }
  addDateRange(filter, query.date_field || 'created_at', query);

  const keyword = normalizeString(query.q || query.keyword || query.search || query.patient_keyword);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    const patients = await Patient.find({
      $or: [
        { patient_code: { $regex: pattern, $options: 'i' } },
        { full_name: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
      ],
    }).select('_id').limit(200).lean();
    filter.$or = [
      { invoice_no: { $regex: pattern, $options: 'i' } },
      ...(patients.length ? [{ patient_id: { $in: patients.map((patient) => patient._id) } }] : []),
    ];
  }
  return filter;
}

async function enrichInvoices(invoices = []) {
  if (!invoices.length) return [];
  const invoiceIds = invoices.map((invoice) => invoice._id);
  const [charges, itemAgg, latestIntents, latestPayments, claimAgg] = await Promise.all([
    Charge.find({ invoice_id: { $in: invoiceIds } })
      .populate('service_id', 'service_code service_name service_type unit_price is_billable status')
      .populate('order_id', 'order_no order_type priority status ordered_at')
      .lean(),
    InvoiceItem.aggregate([
      { $match: { invoice_id: { $in: invoiceIds } } },
      { $group: { _id: '$invoice_id', item_count: { $sum: 1 }, line_total: { $sum: '$line_total' } } },
    ]),
    PaymentIntent.find({ invoice_id: { $in: invoiceIds } }).sort({ created_at: -1 }).lean(),
    Payment.find({ invoice_id: { $in: invoiceIds } }).sort({ paid_at: -1, created_at: -1 }).lean(),
    InsuranceClaim.aggregate([
      { $match: { invoice_id: { $in: invoiceIds } } },
      { $group: { _id: '$invoice_id', claim_count: { $sum: 1 }, submitted_amount: { $sum: '$submitted_amount' }, approved_amount: { $sum: '$approved_amount' } } },
    ]),
  ]);
  const chargesByInvoice = new Map();
  for (const charge of charges) {
    const key = String(charge.invoice_id);
    const group = chargesByInvoice.get(key) || [];
    group.push(charge);
    chargesByInvoice.set(key, group);
  }
  const itemAggMap = new Map(itemAgg.map((row) => [String(row._id), row]));
  const latestIntentByInvoice = new Map();
  for (const intent of latestIntents) {
    const key = String(intent.invoice_id);
    if (!latestIntentByInvoice.has(key)) latestIntentByInvoice.set(key, intent);
  }
  const latestPaymentByInvoice = new Map();
  for (const payment of latestPayments) {
    const key = String(payment.invoice_id);
    if (!latestPaymentByInvoice.has(key)) latestPaymentByInvoice.set(key, payment);
  }
  const claimAggMap = new Map(claimAgg.map((row) => [String(row._id), row]));

  return invoices.map((invoice) => {
    const key = String(invoice._id);
    const invoiceCharges = chargesByInvoice.get(key) || [];
    const serviceAmounts = {};
    for (const charge of invoiceCharges) {
      const type = charge.service_id?.service_type || charge.order_id?.order_type || 'other';
      serviceAmounts[type] = (serviceAmounts[type] || 0) + Number(charge.total_amount || 0);
    }
    const now = Date.now();
    const dueAt = invoice.due_at ? new Date(invoice.due_at).getTime() : null;
    const isOverdue = Boolean(dueAt && dueAt < now && Number(invoice.balance_due || 0) > 0 && PAYABLE_INVOICE_STATUSES.includes(invoice.status));
    return {
      ...invoice,
      patient: patientMini(invoice.patient_id),
      encounter: encounterMini(invoice.encounter_id),
      clinical_charge_count: invoiceCharges.length,
      clinical_service_types: [...new Set(invoiceCharges.map((charge) => charge.service_id?.service_type || charge.order_id?.order_type).filter(Boolean))],
      service_amounts: serviceAmounts,
      item_count: itemAggMap.get(key)?.item_count || 0,
      item_total_amount: itemAggMap.get(key)?.line_total || 0,
      latest_payment_intent: latestIntentByInvoice.get(key) || null,
      latest_payment: latestPaymentByInvoice.get(key) || null,
      insurance_claim_summary: claimAggMap.get(key) || { claim_count: 0, submitted_amount: 0, approved_amount: 0 },
      is_overdue: isOverdue,
      overdue_days: isOverdue ? Math.max(Math.floor((now - dueAt) / 86400000), 0) : 0,
      has_submitted_receipt: latestIntents.some((intent) => sameId(intent.invoice_id, invoice._id) && intent.status === PAYMENT_INTENT_STATUS.SUBMITTED_RECEIPT),
    };
  });
}

async function listClinicalInvoices(query = {}, actor = {}) {
  assertStaffRead(actor);
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = await buildInvoiceQuery(query);
  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ issued_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone gender date_of_birth')
      .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
      .lean(),
    Invoice.countDocuments(filter),
  ]);
  return { items: await enrichInvoices(items), pagination: buildPagination(page, limit, total) };
}

async function createInvoiceFromSelectedCharges(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffRead(actor);
  if (!hasAnyPermission(actor, [PERMISSION.INVOICES.CREATE, PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Bạn không có quyền tạo invoice.', 403);
  }
  const chargeIds = Array.isArray(payload.charge_ids) ? payload.charge_ids.filter(Boolean) : [];
  if (!chargeIds.length) throw createError('charge_ids không được rỗng.', 400);
  const { serviceIds } = await clinicalServiceIds(payload);
  const chargeCount = await Charge.countDocuments({
    _id: { $in: chargeIds },
    service_id: { $in: serviceIds },
  });
  if (chargeCount !== chargeIds.length) throw createError('Có charge không thuộc workspace cận lâm sàng.', 409);
  return billingService.createInvoiceFromCharges(payload, actor, requestMeta);
}

async function createInvoiceFromEncounter(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffRead(actor);
  if (!hasAnyPermission(actor, [PERMISSION.INVOICES.CREATE, PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Bạn không có quyền tạo invoice theo encounter.', 403);
  }
  const encounterId = payload.encounter_id;
  if (!encounterId) throw createError('encounter_id là bắt buộc.', 400);
  const { serviceIds } = await clinicalServiceIds(payload);
  const chargeFilter = {
    encounter_id: encounterId,
    service_id: { $in: serviceIds },
    $or: [{ invoice_id: { $exists: false } }, { invoice_id: null }],
  };
  if (payload.include_posted_only !== false) chargeFilter.status = CHARGE_STATUS.POSTED;
  else chargeFilter.status = { $in: [CHARGE_STATUS.POSTED, CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT] };
  const charges = await Charge.find(chargeFilter).sort({ charged_at: 1, created_at: 1 }).lean();
  if (!charges.length) throw createError('Encounter không có charge CLS đủ điều kiện lập hóa đơn.', 409);
  return billingService.createInvoiceFromCharges({
    charge_ids: charges.map((charge) => String(charge._id)),
    encounter_id: encounterId,
    patient_id: payload.patient_id || charges[0].patient_id,
    admission_id: payload.admission_id,
    due_at: payload.due_at,
    discount_amount: payload.discount_amount,
    insurance_amount: payload.insurance_amount,
    tax_amount: payload.tax_amount,
    currency: payload.currency,
    allow_pending_charges: payload.include_posted_only === false,
  }, actor, requestMeta);
}

async function createChargeForClinicalOrder(orderId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffChargeCreate(actor);
  const order = await Order.findById(orderId).lean();
  if (!order) throw createError('Không tìm thấy order.', 404);
  if (!CLINICAL_SERVICE_TYPES.includes(order.order_type)) throw createError('Order không thuộc cận lâm sàng/thủ thuật.', 409);
  const childMaps = await loadClinicalChildren([order._id]);
  const childContext = childForOrder(order, childMaps);
  const orderWithService = await Order.findById(orderId)
    .populate('service_id', 'service_code service_name service_type unit_price is_billable status department_id')
    .lean();
  const existingCharge = await Charge.findOne({ order_id: order._id, status: { $in: ACTIVE_CHARGE_STATUSES } }).lean();
  const eligibility = evaluateChargeEligibility(orderWithService, childContext, existingCharge, payload);
  if (!eligibility.can_create_charge && payload.force !== true) {
    throw createError(eligibility.charge_block_reason || 'Order chưa đủ điều kiện tạo charge.', 409);
  }
  const result = await orderService.createChargeForExistingOrder(orderId, payload, actor, requestMeta);
  await recordAuditLog({
    actor,
    action: 'clinical_billing.charge_create',
    targetType: 'order',
    targetId: orderId,
    status: 'success',
    message: 'Tạo charge từ clinical billing workspace thành công.',
    requestMeta,
    metadata: { source_type: order.order_type },
  });
  return result;
}

async function createChargeForLabOrder(labOrderId, payload = {}, actor = {}, requestMeta = {}) {
  const labOrder = await LabOrder.findById(labOrderId).lean();
  if (!labOrder) throw createError('Không tìm thấy lab order.', 404);
  return createChargeForClinicalOrder(labOrder.order_id, { ...payload, source_type: SERVICE_TYPE.LAB }, actor, requestMeta);
}

async function createChargeForImagingOrder(imagingOrderId, payload = {}, actor = {}, requestMeta = {}) {
  const imagingOrder = await ImagingOrder.findById(imagingOrderId).lean();
  if (!imagingOrder) throw createError('Không tìm thấy imaging order.', 404);
  return createChargeForClinicalOrder(imagingOrder.order_id, { ...payload, source_type: SERVICE_TYPE.IMAGING }, actor, requestMeta);
}

async function loadOrderTrace(orderId, actor = {}) {
  assertStaffRead(actor);
  const detail = await orderService.getOrderDetail(orderId, actor);
  const order = detail.order;
  if (!CLINICAL_SERVICE_TYPES.includes(order.order_type)) throw createError('Order không thuộc cận lâm sàng/thủ thuật.', 409);
  const charges = await Charge.find({ order_id: order._id })
    .sort({ charged_at: -1, created_at: -1 })
    .populate('service_id', 'service_code service_name service_type unit_price is_billable status')
    .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
    .lean();
  const invoiceIds = [...new Set(charges.map((charge) => getId(charge.invoice_id)).filter(Boolean).map(String))];
  const [invoices, payments, paymentIntents, claims, auditLogs] = await Promise.all([
    invoiceIds.length ? Invoice.find({ _id: { $in: invoiceIds } }).sort({ created_at: -1 }).lean() : [],
    invoiceIds.length ? Payment.find({ invoice_id: { $in: invoiceIds } }).sort({ paid_at: -1, created_at: -1 }).lean() : [],
    invoiceIds.length ? PaymentIntent.find({ invoice_id: { $in: invoiceIds } }).sort({ created_at: -1 }).lean() : [],
    invoiceIds.length ? InsuranceClaim.find({ invoice_id: { $in: invoiceIds } }).sort({ created_at: -1 }).lean() : [],
    AuditLog.find({
      $or: [
        { target_type: 'order', target_id: order._id },
        { target_type: 'charge', target_id: { $in: charges.map((charge) => charge._id) } },
        ...(invoiceIds.length ? [{ target_type: 'invoice', target_id: { $in: invoiceIds.map((id) => toObjectId(id)).filter(Boolean) } }] : []),
        { 'metadata.order_id': String(order._id) },
      ],
    }).sort({ created_at: 1 }).lean(),
  ]);
  return {
    order,
    child: detail.child,
    charge: detail.charge,
    charges,
    invoices,
    payments,
    payment_intents: paymentIntents,
    insurance_claims: claims,
    timeline: buildTimeline({ order, child: detail.child, charges, invoices, payments, paymentIntents, claims, auditLogs }),
    reconciliation_status: reconcileOne(order, charges, invoices, payments),
  };
}

async function getEncounterBillingSummary(encounterId, actor = {}) {
  assertStaffRead(actor);
  const encounter = await Encounter.findById(encounterId)
    .populate('patient_id', 'patient_code full_name phone gender date_of_birth')
    .populate('department_id', 'department_code department_name')
    .populate('attending_doctor_id', 'full_name username employee_code')
    .lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  const { serviceIds } = await clinicalServiceIds({});
  const [orders, charges] = await Promise.all([
    Order.find({ encounter_id: encounterId, order_type: { $in: CLINICAL_SERVICE_TYPES } })
      .sort({ ordered_at: -1 })
      .populate('service_id', 'service_code service_name service_type unit_price is_billable status')
      .lean(),
    Charge.find({ encounter_id: encounterId, service_id: { $in: serviceIds } })
      .sort({ charged_at: -1, created_at: -1 })
      .populate('service_id', 'service_code service_name service_type unit_price is_billable status')
      .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
      .lean(),
  ]);
  const invoiceIds = [...new Set(charges.map((charge) => getId(charge.invoice_id)).filter(Boolean).map(String))];
  const [invoices, payments, claims] = await Promise.all([
    invoiceIds.length ? Invoice.find({ _id: { $in: invoiceIds } }).sort({ created_at: -1 }).lean() : [],
    invoiceIds.length ? Payment.find({ invoice_id: { $in: invoiceIds } }).sort({ paid_at: -1, created_at: -1 }).lean() : [],
    invoiceIds.length ? InsuranceClaim.find({ invoice_id: { $in: invoiceIds } }).sort({ created_at: -1 }).lean() : [],
  ]);
  const activeCharges = charges.filter((charge) => !TERMINAL_CHARGE_STATUSES.includes(charge.status));
  const chargeTotal = activeCharges.reduce((sum, charge) => sum + Number(charge.total_amount || 0), 0);
  const unbilledCharges = activeCharges.filter((charge) => charge.status === CHARGE_STATUS.POSTED && !charge.invoice_id);
  const billedCharges = activeCharges.filter((charge) => charge.invoice_id || charge.status === CHARGE_STATUS.BILLED);
  const completedPayments = payments.filter((payment) => payment.status === PAYMENT_STATUS.COMPLETED);
  return {
    encounter,
    patient: patientMini(encounter.patient_id),
    summary: {
      total_orders: orders.length,
      total_charges: activeCharges.length,
      charge_total_amount: chargeTotal,
      billed_charge_amount: billedCharges.reduce((sum, charge) => sum + Number(charge.total_amount || 0), 0),
      unbilled_charge_count: unbilledCharges.length,
      unbilled_charge_amount: unbilledCharges.reduce((sum, charge) => sum + Number(charge.total_amount || 0), 0),
      invoice_count: invoices.length,
      invoice_total_amount: invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0),
      paid_amount: completedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      balance_due: invoices.reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0),
      insurance_amount: invoices.reduce((sum, invoice) => sum + Number(invoice.insurance_amount || 0), 0),
      claim_count: claims.length,
    },
    orders,
    charges,
    invoices,
    payments,
    insurance_claims: claims,
  };
}

function buildTimeline({ order, child, charges = [], invoices = [], payments = [], paymentIntents = [], claims = [], auditLogs = [] }) {
  const events = [];
  const addEvent = (event) => {
    if (!event.event_time) return;
    events.push({
      severity: 'info',
      module: 'clinical_billing',
      ...event,
    });
  };

  addEvent({ event_type: 'order_created', event_time: order.created_at || order.ordered_at, title: `Tạo order ${order.order_no}`, entity_type: 'order', entity_id: order._id });
  addEvent({ event_type: 'order_ordered', event_time: order.ordered_at, title: `Chỉ định ${order.order_type}`, entity_type: 'order', entity_id: order._id });
  addEvent({ event_type: 'order_acknowledged', event_time: order.acknowledged_at, title: 'Order được tiếp nhận', entity_type: 'order', entity_id: order._id });
  addEvent({ event_type: 'order_cancelled', event_time: order.cancelled_at, title: 'Order đã hủy', entity_type: 'order', entity_id: order._id, severity: 'warning' });

  const clinicalChildren = Object.values(child || {}).filter((value) => value && typeof value === 'object' && !Array.isArray(value));
  for (const item of clinicalChildren) {
    addEvent({ event_type: 'clinical_completed', event_time: item.completed_at || item.verified_at || item.reported_at, title: 'Nguồn cận lâm sàng hoàn tất', entity_type: item.lab_order_no ? 'lab_order' : item.imaging_order_no ? 'imaging_order' : 'procedure_order', entity_id: item._id });
    addEvent({ event_type: 'clinical_no_show', event_time: item.no_show_at, title: 'Không đến thực hiện', entity_type: 'clinical_order', entity_id: item._id, severity: 'warning' });
  }
  for (const charge of charges) {
    addEvent({ event_type: 'charge_created', event_time: charge.charged_at || charge.created_at, title: `Tạo charge ${charge.charge_no}`, entity_type: 'charge', entity_id: charge._id, amount: charge.total_amount });
    addEvent({ event_type: 'charge_posted', event_time: charge.posted_at, title: `Post charge ${charge.charge_no}`, entity_type: 'charge', entity_id: charge._id, amount: charge.total_amount });
    addEvent({ event_type: 'charge_voided', event_time: charge.voided_at, title: `Void charge ${charge.charge_no}`, entity_type: 'charge', entity_id: charge._id, severity: 'warning', amount: charge.total_amount });
  }
  for (const invoice of invoices) {
    addEvent({ event_type: 'invoice_created', event_time: invoice.created_at, title: `Tạo invoice ${invoice.invoice_no}`, entity_type: 'invoice', entity_id: invoice._id, amount: invoice.total_amount });
    addEvent({ event_type: 'invoice_issued', event_time: invoice.issued_at, title: `Phát hành invoice ${invoice.invoice_no}`, entity_type: 'invoice', entity_id: invoice._id, amount: invoice.total_amount });
    addEvent({ event_type: 'invoice_voided', event_time: invoice.voided_at, title: `Void invoice ${invoice.invoice_no}`, entity_type: 'invoice', entity_id: invoice._id, severity: 'warning', amount: invoice.total_amount });
  }
  for (const intent of paymentIntents) {
    addEvent({ event_type: `payment_intent_${intent.status}`, event_time: intent.created_at || intent.confirmed_at || intent.paid_at, title: `Payment intent ${intent.intent_code || intent.status}`, entity_type: 'payment_intent', entity_id: intent._id, amount: intent.amount });
  }
  for (const payment of payments) {
    addEvent({ event_type: `payment_${payment.status}`, event_time: payment.paid_at || payment.created_at, title: `Payment ${payment.payment_no || payment.status}`, entity_type: 'payment', entity_id: payment._id, amount: payment.amount });
  }
  for (const claim of claims) {
    addEvent({ event_type: `claim_${claim.status}`, event_time: claim.submitted_at || claim.created_at || claim.settled_at, title: `Claim ${claim.claim_no || claim.status}`, entity_type: 'insurance_claim', entity_id: claim._id, amount: claim.submitted_amount });
  }
  for (const log of auditLogs) {
    addEvent({
      event_type: log.action,
      event_time: log.created_at,
      title: log.message || log.action,
      module: 'audit',
      entity_type: log.target_type,
      entity_id: log.target_id,
      actor_type: log.actor_type,
      actor_id: log.actor_id,
      severity: log.status === 'failure' ? 'warning' : 'info',
      metadata: log.metadata,
    });
  }
  return events.sort((a, b) => new Date(a.event_time) - new Date(b.event_time));
}

function reconcileOne(order, charges = [], invoices = [], payments = []) {
  const activeCharges = charges.filter((charge) => !TERMINAL_CHARGE_STATUSES.includes(charge.status));
  const hasCharge = activeCharges.length > 0;
  const hasBilledCharge = activeCharges.some((charge) => charge.invoice_id || charge.status === CHARGE_STATUS.BILLED);
  const activeInvoices = invoices.filter((invoice) => !TERMINAL_INVOICE_STATUSES.includes(invoice.status));
  const paid = activeInvoices.some((invoice) => invoice.status === INVOICE_STATUS.PAID)
    || payments.some((payment) => payment.status === PAYMENT_STATUS.COMPLETED);
  const orderCancelled = [ORDER_STATUS.CANCELLED, ORDER_STATUS.ENTERED_IN_ERROR].includes(order.status);

  if (orderCancelled && paid) return { state: 'cancelled_paid', label: 'Đã hủy nhưng đã thu tiền', severity: 'danger' };
  if (orderCancelled && hasBilledCharge) return { state: 'cancelled_billed', label: 'Đã hủy nhưng charge đã lên invoice', severity: 'danger' };
  if (orderCancelled && hasCharge) return { state: 'cancelled_charged', label: 'Đã hủy nhưng còn charge active', severity: 'warning' };
  if (order.status === ORDER_STATUS.COMPLETED && !hasCharge) return { state: 'completed_missing_charge', label: 'Hoàn tất nhưng chưa charge', severity: 'danger' };
  if (hasCharge && !hasBilledCharge) return { state: 'charged_unbilled', label: 'Đã charge, chờ lập hóa đơn', severity: 'warning' };
  if (hasBilledCharge && !activeInvoices.some((invoice) => invoice.status !== INVOICE_STATUS.DRAFT)) return { state: 'billed_draft', label: 'Invoice nháp chờ phát hành', severity: 'info' };
  if (activeInvoices.some((invoice) => PAYABLE_INVOICE_STATUSES.includes(invoice.status)) && !paid) return { state: 'issued_unpaid', label: 'Đã phát hành, chờ thu', severity: 'warning' };
  if (paid) return { state: 'paid', label: 'Đã thanh toán', severity: 'success' };
  return { state: 'tracking', label: 'Đang theo dõi', severity: 'neutral' };
}

async function getReconciliation(query = {}, actor = {}) {
  assertStaffRead(actor);
  const { page, limit } = getPagination(query, 25, 100);
  const serviceTypes = normalizeServiceTypes(query);
  const orderFilter = await applyOrderKeywordFilter(buildOrderQuery(query, serviceTypes), query);
  const orders = await Order.find(orderFilter)
    .sort({ ordered_at: -1, created_at: -1 })
    .limit(Math.min(Math.max(page * limit * 3, 300), 1500))
    .populate('patient_id', 'patient_code full_name phone gender date_of_birth')
    .populate('encounter_id', 'encounter_code encounter_type status start_time department_id')
    .populate('service_id', 'service_code service_name service_type unit_price is_billable status')
    .lean();
  const orderIds = orders.map((order) => order._id);
  const charges = await Charge.find({ order_id: { $in: orderIds } })
    .populate('invoice_id', 'invoice_no status total_amount paid_amount balance_due issued_at due_at')
    .lean();
  const invoiceIds = [...new Set(charges.map((charge) => getId(charge.invoice_id)).filter(Boolean).map(String))];
  const [invoices, payments] = await Promise.all([
    invoiceIds.length ? Invoice.find({ _id: { $in: invoiceIds } }).lean() : [],
    invoiceIds.length ? Payment.find({ invoice_id: { $in: invoiceIds } }).lean() : [],
  ]);
  const chargesByOrder = new Map();
  for (const charge of charges) {
    const key = String(charge.order_id);
    const group = chargesByOrder.get(key) || [];
    group.push(charge);
    chargesByOrder.set(key, group);
  }
  const invoiceById = new Map(invoices.map((invoice) => [String(invoice._id), invoice]));
  const paymentsByInvoice = new Map();
  for (const payment of payments) {
    const key = String(payment.invoice_id);
    const group = paymentsByInvoice.get(key) || [];
    group.push(payment);
    paymentsByInvoice.set(key, group);
  }

  let rows = orders.map((order) => {
    const orderCharges = chargesByOrder.get(String(order._id)) || [];
    const orderInvoices = orderCharges.map((charge) => invoiceById.get(String(getId(charge.invoice_id)))).filter(Boolean);
    const orderPayments = orderInvoices.flatMap((invoice) => paymentsByInvoice.get(String(invoice._id)) || []);
    return {
      order: orderMini(order),
      patient: patientMini(order.patient_id),
      encounter: encounterMini(order.encounter_id),
      service: serviceMini(order.service_id),
      charges: orderCharges,
      invoices: orderInvoices,
      payments: orderPayments,
      reconciliation: reconcileOne(order, orderCharges, orderInvoices, orderPayments),
    };
  });
  if (query.state) rows = rows.filter((row) => row.reconciliation.state === query.state);
  if (query.has_exception === true || query.has_exception === 'true') rows = rows.filter((row) => ['danger', 'warning'].includes(row.reconciliation.severity));
  const total = rows.length;
  return { items: rows.slice((page - 1) * limit, page * limit), pagination: buildPagination(page, limit, total) };
}

function exceptionRow({ severity = 'warning', type, entityType, entity, patient, encounter, amount = 0, detectedAt = new Date(), suggestion, owner = 'Billing manager' }) {
  return {
    id: `${type}:${String(entity?._id || entity?.id || Math.random())}`,
    severity,
    type,
    entity_type: entityType,
    entity_id: entity?._id || entity?.id,
    entity_no: entity?.order_no || entity?.charge_no || entity?.invoice_no || entity?.payment_no,
    patient: patientMini(patient || entity?.patient_id),
    encounter: encounterMini(encounter || entity?.encounter_id),
    amount,
    detected_at: detectedAt,
    owner,
    suggested_action: suggestion,
    raw: entity,
  };
}

async function listExceptions(query = {}, actor = {}) {
  assertStaffRead(actor);
  const { page, limit } = getPagination(query, 25, 100);
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const { serviceIds } = await clinicalServiceIds(query);
  const serviceTypes = normalizeServiceTypes(query);
  const [completedOrders, oldPostedCharges, draftInvoices, billedCharges, cancelledOrders, invoiceTotals, paidInvoices] = await Promise.all([
    Order.find({ order_type: { $in: serviceTypes }, status: ORDER_STATUS.COMPLETED })
      .sort({ updated_at: -1 })
      .limit(600)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('encounter_id', 'encounter_code status start_time')
      .lean(),
    Charge.find({
      service_id: { $in: serviceIds },
      status: CHARGE_STATUS.POSTED,
      $or: [{ invoice_id: { $exists: false } }, { invoice_id: null }],
      charged_at: { $lte: dayAgo },
    })
      .sort({ charged_at: 1 })
      .limit(300)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('encounter_id', 'encounter_code status start_time')
      .populate('order_id', 'order_no order_type status')
      .lean(),
    Invoice.find({ _id: { $in: await clinicalInvoiceIds(query) }, status: INVOICE_STATUS.DRAFT, created_at: { $lte: dayAgo } })
      .sort({ created_at: 1 })
      .limit(300)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('encounter_id', 'encounter_code status start_time')
      .lean(),
    Charge.find({ service_id: { $in: serviceIds }, status: CHARGE_STATUS.BILLED, invoice_id: { $exists: true, $ne: null } })
      .limit(800)
      .populate('invoice_id', 'invoice_no status total_amount balance_due')
      .populate('patient_id', 'patient_code full_name phone')
      .populate('encounter_id', 'encounter_code status start_time')
      .lean(),
    Order.find({ order_type: { $in: serviceTypes }, status: { $in: [ORDER_STATUS.CANCELLED, ORDER_STATUS.ENTERED_IN_ERROR] } })
      .sort({ updated_at: -1 })
      .limit(500)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('encounter_id', 'encounter_code status start_time')
      .lean(),
    InvoiceItem.aggregate([
      { $match: { invoice_id: { $in: await clinicalInvoiceIds(query) } } },
      { $group: { _id: '$invoice_id', item_total: { $sum: '$line_total' } } },
    ]),
    Invoice.find({ _id: { $in: await clinicalInvoiceIds(query) }, status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID, INVOICE_STATUS.PAID] } })
      .limit(500)
      .populate('patient_id', 'patient_code full_name phone')
      .populate('encounter_id', 'encounter_code status start_time')
      .lean(),
  ]);

  const completedOrderIds = completedOrders.map((order) => order._id);
  const [chargesForCompleted, chargesForCancelled, paymentSums] = await Promise.all([
    Charge.find({ order_id: { $in: completedOrderIds }, status: { $in: ACTIVE_CHARGE_STATUSES } }).select('order_id').lean(),
    Charge.find({ order_id: { $in: cancelledOrders.map((order) => order._id) }, status: { $in: ACTIVE_CHARGE_STATUSES } }).lean(),
    Payment.aggregate([
      { $match: { invoice_id: { $in: paidInvoices.map((invoice) => invoice._id) }, status: PAYMENT_STATUS.COMPLETED } },
      { $group: { _id: '$invoice_id', paid_amount: { $sum: '$amount' } } },
    ]),
  ]);
  const chargedCompletedSet = new Set(chargesForCompleted.map((charge) => String(charge.order_id)));
  const itemTotals = new Map(invoiceTotals.map((row) => [String(row._id), row.item_total]));
  const paidAmounts = new Map(paymentSums.map((row) => [String(row._id), row.paid_amount]));
  const chargesByCancelledOrder = new Map();
  for (const charge of chargesForCancelled) {
    const key = String(charge.order_id);
    const group = chargesByCancelledOrder.get(key) || [];
    group.push(charge);
    chargesByCancelledOrder.set(key, group);
  }

  const exceptions = [];
  for (const order of completedOrders) {
    if (!chargedCompletedSet.has(String(order._id))) {
      exceptions.push(exceptionRow({
        severity: 'danger',
        type: 'completed_order_missing_charge',
        entityType: 'order',
        entity: order,
        suggestion: 'Tạo charge hoặc đánh dấu không tính phí có audit.',
      }));
    }
  }
  for (const charge of oldPostedCharges) {
    exceptions.push(exceptionRow({
      severity: 'warning',
      type: 'posted_charge_stale_unbilled',
      entityType: 'charge',
      entity: charge,
      amount: charge.total_amount,
      detectedAt: charge.charged_at,
      suggestion: 'Gom charge vào invoice theo encounter hoặc bệnh nhân.',
    }));
  }
  for (const invoice of draftInvoices) {
    exceptions.push(exceptionRow({
      severity: 'warning',
      type: 'draft_invoice_stale',
      entityType: 'invoice',
      entity: invoice,
      amount: invoice.total_amount,
      detectedAt: invoice.created_at,
      suggestion: 'Issue invoice hoặc void draft và release charge.',
    }));
  }
  for (const charge of billedCharges) {
    const invoice = charge.invoice_id;
    if (invoice && TERMINAL_INVOICE_STATUSES.includes(invoice.status)) {
      exceptions.push(exceptionRow({
        severity: 'danger',
        type: 'billed_charge_invoice_terminal',
        entityType: 'charge',
        entity: charge,
        amount: charge.total_amount,
        suggestion: 'Release charge về posted hoặc tạo adjustment.',
      }));
    }
  }
  for (const order of cancelledOrders) {
    const activeCharges = chargesByCancelledOrder.get(String(order._id)) || [];
    for (const charge of activeCharges) {
      exceptions.push(exceptionRow({
        severity: charge.invoice_id || charge.status === CHARGE_STATUS.BILLED ? 'danger' : 'warning',
        type: 'cancelled_order_active_charge',
        entityType: 'order',
        entity: order,
        amount: charge.total_amount,
        suggestion: charge.invoice_id || charge.status === CHARGE_STATUS.BILLED ? 'Xử lý adjustment/refund qua Billing Module.' : 'Void charge vì order đã hủy/no-show.',
      }));
    }
  }
  for (const invoice of paidInvoices) {
    const itemTotal = itemTotals.get(String(invoice._id));
    if (itemTotal !== undefined && itemTotal !== invoice.subtotal_amount) {
      exceptions.push(exceptionRow({
        severity: 'danger',
        type: 'invoice_total_mismatch_items',
        entityType: 'invoice',
        entity: invoice,
        amount: Math.abs(Number(invoice.subtotal_amount || 0) - Number(itemTotal || 0)),
        suggestion: 'Recalculate invoice draft hoặc tạo adjustment nếu đã issue.',
      }));
    }
    const paidAmount = paidAmounts.get(String(invoice._id)) || 0;
    if (Number(invoice.paid_amount || 0) !== Number(paidAmount || 0)) {
      exceptions.push(exceptionRow({
        severity: 'danger',
        type: 'invoice_paid_mismatch_payments',
        entityType: 'invoice',
        entity: invoice,
        amount: Math.abs(Number(invoice.paid_amount || 0) - Number(paidAmount || 0)),
        suggestion: 'Chạy reconciliation để đồng bộ paid_amount/balance_due.',
      }));
    }
    if (Number(invoice.insurance_amount || 0) > Number(invoice.total_amount || 0)) {
      exceptions.push(exceptionRow({
        severity: 'danger',
        type: 'insurance_amount_exceeds_total',
        entityType: 'invoice',
        entity: invoice,
        amount: invoice.insurance_amount,
        suggestion: 'Sửa insurance amount hoặc tạo adjustment.',
      }));
    }
  }

  let filtered = exceptions;
  if (query.severity) filtered = filtered.filter((item) => item.severity === query.severity);
  if (query.type) filtered = filtered.filter((item) => item.type === query.type);
  const total = filtered.length;
  return { items: filtered.slice((page - 1) * limit, page * limit), pagination: buildPagination(page, limit, total) };
}

async function getDashboard(query = {}, actor = {}) {
  assertStaffRead(actor);
  const dateQuery = {
    date_from: query.date_from || startOfToday().toISOString(),
    date_to: query.date_to || endOfToday().toISOString(),
  };
  const { serviceIds, serviceMap, serviceTypes } = await clinicalServiceIds({ ...query, ...dateQuery });
  const orderFilter = buildOrderQuery({ ...query, ...dateQuery }, serviceTypes);
  const chargeBase = { service_id: { $in: serviceIds } };
  const todayChargeFilter = addDateRange({ ...chargeBase }, 'charged_at', dateQuery);
  const invoiceIds = await Charge.distinct('invoice_id', { ...chargeBase, invoice_id: { $exists: true, $ne: null } });
  const todayInvoiceIds = await Charge.distinct('invoice_id', { ...todayChargeFilter, invoice_id: { $exists: true, $ne: null } });
  const todayInvoiceFilter = { _id: { $in: todayInvoiceIds } };
  const clinicalInvoiceFilter = { _id: { $in: invoiceIds } };

  const [orders, billableOrders, activeChargeOrderIds, chargesUnbilled, draftInvoices, issuedInvoices, unpaidInvoices, paidInvoices, revenueAgg, outstandingAgg, paymentPendingReview, byChargeServiceAgg, invoiceItemsAgg, exceptionData] = await Promise.all([
    Order.countDocuments(orderFilter),
    Order.countDocuments({ ...orderFilter, is_billable: true }),
    Charge.distinct('order_id', { ...chargeBase, status: { $in: ACTIVE_CHARGE_STATUSES } }),
    Charge.countDocuments({ ...chargeBase, status: CHARGE_STATUS.POSTED, $or: [{ invoice_id: { $exists: false } }, { invoice_id: null }] }),
    Invoice.countDocuments({ ...todayInvoiceFilter, status: INVOICE_STATUS.DRAFT }),
    Invoice.countDocuments({ ...todayInvoiceFilter, status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID, INVOICE_STATUS.PAID] } }),
    Invoice.countDocuments({ ...clinicalInvoiceFilter, status: INVOICE_STATUS.ISSUED, balance_due: { $gt: 0 } }),
    Invoice.countDocuments({ ...todayInvoiceFilter, status: INVOICE_STATUS.PAID }),
    Payment.aggregate([
      { $match: { invoice_id: { $in: invoiceIds }, status: PAYMENT_STATUS.COMPLETED, paid_at: { $gte: normalizeDate(dateQuery.date_from, 'date_from'), $lte: normalizeDate(dateQuery.date_to, 'date_to') } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { ...clinicalInvoiceFilter, status: { $in: PAYABLE_INVOICE_STATUSES }, balance_due: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$balance_due' }, count: { $sum: 1 } } },
    ]),
    PaymentIntent.countDocuments({ invoice_id: { $in: invoiceIds }, status: { $in: PAYMENT_REVIEW_STATUSES } }),
    Charge.aggregate([
      { $match: todayChargeFilter },
      { $group: { _id: '$service_id', count: { $sum: 1 }, total_amount: { $sum: '$total_amount' }, unbilled: { $sum: { $cond: [{ $and: [{ $eq: ['$status', CHARGE_STATUS.POSTED] }, { $not: ['$invoice_id'] }] }, 1, 0] } } } },
    ]),
    InvoiceItem.aggregate([
      { $match: { service_id: { $in: serviceIds } } },
      { $group: { _id: '$service_id', invoice_line_amount: { $sum: '$line_total' }, invoice_line_count: { $sum: 1 } } },
    ]),
    listExceptions({ ...query, limit: 8 }, actor).catch(() => ({ items: [], pagination: { total: 0 } })),
  ]);

  const orderIdsForRange = await Order.find(orderFilter).select('_id').limit(2000).lean();
  const chargedInRangeSet = new Set(activeChargeOrderIds.map((id) => String(id)));
  const ordersWithoutCharge = orderIdsForRange.filter((order) => !chargedInRangeSet.has(String(order._id))).length;

  const byType = new Map(CLINICAL_SERVICE_TYPES.map((type) => [type, {
    service_type: type,
    revenue: 0,
    orders: 0,
    charges: 0,
    unbilled_charges: 0,
    invoices: 0,
  }]));
  const orderByTypeAgg = await Order.aggregate([
    { $match: orderFilter },
    { $group: { _id: '$order_type', count: { $sum: 1 } } },
  ]);
  for (const row of orderByTypeAgg) {
    const item = byType.get(row._id);
    if (item) item.orders = row.count;
  }
  for (const row of byChargeServiceAgg) {
    const service = serviceMap.get(String(row._id));
    const item = service ? byType.get(service.service_type) : null;
    if (!item) continue;
    item.charges += row.count;
    item.unbilled_charges += row.unbilled || 0;
  }
  for (const row of invoiceItemsAgg) {
    const service = serviceMap.get(String(row._id));
    const item = service ? byType.get(service.service_type) : null;
    if (!item) continue;
    item.revenue += Number(row.invoice_line_amount || 0);
    item.invoices += Number(row.invoice_line_count || 0);
  }

  return {
    kpis: {
      total_orders: orders,
      billable_orders: billableOrders,
      orders_with_charge: activeChargeOrderIds.length,
      orders_without_charge: ordersWithoutCharge,
      charges_unbilled: chargesUnbilled,
      draft_invoices: draftInvoices,
      issued_invoices: issuedInvoices,
      unpaid_invoices: unpaidInvoices,
      paid_invoices: paidInvoices,
      revenue_today: revenueAgg[0]?.total || 0,
      revenue_payment_count: revenueAgg[0]?.count || 0,
      outstanding_balance: outstandingAgg[0]?.total || 0,
      outstanding_invoice_count: outstandingAgg[0]?.count || 0,
      payment_pending_review: paymentPendingReview,
      billing_exceptions: exceptionData.pagination?.total || exceptionData.items?.length || 0,
    },
    by_service_type: Array.from(byType.values()),
    exceptions: exceptionData.items || [],
  };
}

async function getInvoiceTimeline(invoiceId, actor = {}) {
  assertStaffRead(actor);
  const invoice = await Invoice.findById(invoiceId)
    .populate('patient_id', 'patient_code full_name phone')
    .populate('encounter_id', 'encounter_code status start_time')
    .lean();
  if (!invoice) throw createError('Không tìm thấy invoice.', 404);
  const [charges, payments, paymentIntents, claims] = await Promise.all([
    Charge.find({ invoice_id: invoice._id }).populate('service_id', 'service_code service_name service_type').populate('order_id', 'order_no order_type status ordered_at').lean(),
    Payment.find({ invoice_id: invoice._id }).sort({ paid_at: -1, created_at: -1 }).lean(),
    PaymentIntent.find({ invoice_id: invoice._id }).sort({ created_at: -1 }).lean(),
    InsuranceClaim.find({ invoice_id: invoice._id }).sort({ created_at: -1 }).lean(),
  ]);
  const auditLogs = await AuditLog.find({
    $or: [
      { target_type: 'invoice', target_id: invoice._id },
      { target_type: 'charge', target_id: { $in: charges.map((charge) => charge._id) } },
      { 'metadata.invoice_id': String(invoice._id) },
    ],
  }).sort({ created_at: 1 }).lean();
  return {
    invoice,
    charges,
    payments,
    payment_intents: paymentIntents,
    insurance_claims: claims,
    timeline: buildTimeline({
      order: { _id: invoice._id, order_no: invoice.invoice_no, order_type: 'invoice', created_at: invoice.created_at },
      child: {},
      charges,
      invoices: [invoice],
      payments,
      paymentIntents,
      claims,
      auditLogs,
    }),
  };
}

module.exports = {
  getDashboard,
  listChargeCandidates,
  listClinicalCharges,
  listUnbilledCharges,
  listClinicalInvoices,
  createInvoiceFromSelectedCharges,
  createInvoiceFromEncounter,
  createChargeForClinicalOrder,
  createChargeForLabOrder,
  createChargeForImagingOrder,
  loadOrderTrace,
  getEncounterBillingSummary,
  getReconciliation,
  listExceptions,
  getInvoiceTimeline,
};
