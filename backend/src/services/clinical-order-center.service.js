const mongoose = require('mongoose');
const {
  Attachment,
  AuditLog,
  Charge,
  ImagingOrder,
  ImagingReport,
  LabOrder,
  LabResult,
  LabResultItem,
  Order,
  ProcedureOrder,
  Specimen,
} = require('../models');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const orderService = require('./order.service');
const imagingService = require('./imaging.service');
const procedureService = require('./procedure.service');
const notificationService = require('./notification.service');
const permissionService = require('./permission.service');
const clinicalOrderCenterRepository = require('../repositories/clinical-order-center.repository');
const {
  ATTACHMENT_STATUS,
  CHARGE_STATUS,
  IMAGING_ORDER_STATUS,
  IMAGING_REPORT_STATUS,
  LAB_ORDER_STATUS,
  LAB_RESULT_STATUS,
  ORDER_PRIORITY,
  ORDER_STATUS,
  ORDER_TYPE,
  PROCEDURE_STATUS,
  SPECIMEN_STATUS,
} = require('../constants/statuses');
const { PERMISSION, ROLE_CODE } = require('../constants/permissions');

const CLINICAL_ORDER_TYPES = [ORDER_TYPE.LAB, ORDER_TYPE.IMAGING, ORDER_TYPE.PROCEDURE];
const ACTIVE_ATTACHMENT_STATUSES = [ATTACHMENT_STATUS.ACTIVE];
const ACTIVE_CHARGE_EXCLUDED_STATUSES = [CHARGE_STATUS.VOIDED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.REFUNDED];
const APPROVAL_STATUSES = [LAB_RESULT_STATUS.PRELIMINARY, IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY];
const FINAL_RESULT_STATUSES = [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED, IMAGING_REPORT_STATUS.FINAL, IMAGING_REPORT_STATUS.AMENDED];

const SLA_THRESHOLDS = {
  [ORDER_PRIORITY.STAT]: { minutes: 30, warning: 10 },
  [ORDER_PRIORITY.URGENT]: { minutes: 120, warning: 30 },
  [ORDER_PRIORITY.ROUTINE]: { minutes: 480, warning: 90 },
};

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

function hasRole(actor = {}, roleCode) {
  return (actor.roles || []).includes(roleCode)
    || (actor.roleDetails || []).some((role) => role.role_code === roleCode);
}

function sameId(left, right) {
  return String(left?._id || left || '') === String(right?._id || right || '');
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(normalizeString).filter(Boolean);
  return String(value || '')
    .split(',')
    .map(normalizeString)
    .filter(Boolean);
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return value === true || value === 'true' || value === '1' || value === 1;
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw createError(`${fieldName} không hợp lệ.`);
  return parsed;
}

function startOfDay(value = new Date()) {
  const date = parseDate(value, 'date') || new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = parseDate(value, 'date') || new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function asObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function addAnd(filter, condition) {
  if (!condition || !Object.keys(condition).length) return;
  if (!filter.$and) filter.$and = [];
  filter.$and.push(condition);
}

function addOrderIdConstraint(filter, ids = []) {
  const normalized = [...new Set((ids || []).filter(Boolean).map((id) => String(id)))];
  if (!normalized.length) {
    addAnd(filter, { _id: { $in: [] } });
    return;
  }
  addAnd(filter, { _id: { $in: normalized.map((id) => asObjectId(id)).filter(Boolean) } });
}

function firstByKey(items = [], keyGetter) {
  const map = new Map();
  for (const item of items) {
    const key = String(keyGetter(item) || '');
    if (key && !map.has(key)) map.set(key, item);
  }
  return map;
}

function groupByKey(items = [], keyGetter) {
  const map = new Map();
  for (const item of items) {
    const key = String(keyGetter(item) || '');
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function slimUser(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.id || user),
    full_name: user.full_name,
    name: user.full_name || user.username || user.employee_code,
    username: user.username,
    employee_code: user.employee_code,
  };
}

function slimDepartment(department) {
  if (!department) return null;
  return {
    id: String(department._id || department.id || department),
    department_code: department.department_code,
    department_name: department.department_name,
    name: department.department_name || department.department_code,
  };
}

function slimPatient(patient) {
  if (!patient) return null;
  return {
    id: String(patient._id || patient.id || patient),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    gender: patient.gender,
    date_of_birth: patient.date_of_birth,
    phone: patient.phone,
  };
}

function slimEncounter(encounter) {
  if (!encounter) return null;
  return {
    id: String(encounter._id || encounter.id || encounter),
    encounter_code: encounter.encounter_code,
    encounter_type: encounter.encounter_type,
    status: encounter.status,
    start_time: encounter.start_time,
  };
}

function resolveOrderTypeFilter(query = {}, actor = {}) {
  const requested = normalizeList(query.order_type || query.order_types || query.module).filter((type) => type !== 'all');
  const baseTypes = requested.length ? requested : CLINICAL_ORDER_TYPES;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS) || hasPermission(actor, PERMISSION.ORDERS.READ)) {
    return baseTypes.filter((type) => CLINICAL_ORDER_TYPES.includes(type));
  }

  const readable = [];
  if (hasAnyPermission(actor, [PERMISSION.ORDERS.READ_LAB, PERMISSION.LAB_ORDERS.READ, PERMISSION.LAB_RESULTS.READ])) readable.push(ORDER_TYPE.LAB);
  if (hasAnyPermission(actor, [PERMISSION.ORDERS.READ_IMAGING, PERMISSION.IMAGING_ORDERS.READ, PERMISSION.IMAGING_REPORTS.READ])) readable.push(ORDER_TYPE.IMAGING);
  if (hasAnyPermission(actor, [PERMISSION.ORDERS.READ_PROCEDURE, PERMISSION.PROCEDURE_ORDERS.READ])) readable.push(ORDER_TYPE.PROCEDURE);

  if (hasRole(actor, ROLE_CODE.LAB_TECHNICIAN)) readable.push(ORDER_TYPE.LAB);
  if (hasRole(actor, ROLE_CODE.IMAGING_TECHNICIAN) || hasRole(actor, ROLE_CODE.RADIOLOGIST)) readable.push(ORDER_TYPE.IMAGING);
  if (hasRole(actor, ROLE_CODE.PROCEDURE_STAFF)) readable.push(ORDER_TYPE.PROCEDURE);
  if (hasRole(actor, ROLE_CODE.DOCTOR) || hasRole(actor, ROLE_CODE.NURSE) || hasRole(actor, ROLE_CODE.LAB_MANAGER)) {
    readable.push(...CLINICAL_ORDER_TYPES);
  }

  const readableSet = new Set(readable);
  const scoped = baseTypes.filter((type) => readableSet.has(type) && CLINICAL_ORDER_TYPES.includes(type));
  return scoped.length ? scoped : baseTypes.filter((type) => CLINICAL_ORDER_TYPES.includes(type));
}

function applyActorScope(filter, query = {}, actor = {}) {
  if (!actorType(actor) || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return;
  const scope = normalizeString(query.scope || '').toLowerCase();
  const departmentId = actorDepartmentId(actor);

  if (scope === 'mine' && actor.userId) {
    addAnd(filter, { $or: [{ ordered_by: actor.userId }, { assigned_to: actor.userId }] });
    return;
  }

  if (scope === 'department' && departmentId) {
    addAnd(filter, { $or: [{ department_id: departmentId }, { assigned_department_id: departmentId }] });
    return;
  }

  if (scope === 'all' && hasAnyPermission(actor, [PERMISSION.ORDERS.READ, PERMISSION.REPORTS.READ_ALL])) return;

  if (departmentId && hasAnyPermission(actor, [PERMISSION.ORDERS.READ, PERMISSION.ORDERS.READ_DEPARTMENT])) {
    addAnd(filter, { $or: [{ department_id: departmentId }, { assigned_department_id: departmentId }] });
    return;
  }

  if (actor.userId && hasPermission(actor, PERMISSION.ORDERS.READ_OWN)) {
    addAnd(filter, { $or: [{ ordered_by: actor.userId }, { assigned_to: actor.userId }] });
  }
}

async function applySearchFilter(filter, query = {}) {
  const search = normalizeString(query.search || query.keyword);
  if (!search) return;
  const found = await clinicalOrderCenterRepository.findSearchOrderIds(search);
  addAnd(filter, {
    $or: [
      { order_no: { $regex: escapeRegex(search), $options: 'i' } },
      { patient_id: { $in: found.patientIds.map((id) => asObjectId(id)).filter(Boolean) } },
      { encounter_id: { $in: found.encounterIds.map((id) => asObjectId(id)).filter(Boolean) } },
      { _id: { $in: found.orderIds.map((id) => asObjectId(id)).filter(Boolean) } },
    ],
  });
}

function applyDateFilters(filter, query = {}) {
  if (query.date) {
    filter.ordered_at = { $gte: startOfDay(query.date), $lte: endOfDay(query.date) };
    return;
  }
  if (query.date_from || query.date_to) {
    filter.ordered_at = {};
    if (query.date_from) filter.ordered_at.$gte = parseDate(query.date_from, 'date_from');
    if (query.date_to) filter.ordered_at.$lte = parseDate(query.date_to, 'date_to');
  }
}

async function findOrderIdsForAdvancedFilters(query = {}) {
  const constraints = [];

  const childStatuses = normalizeList(query.child_status);
  const orderTypes = normalizeList(query.order_type || query.order_types || query.module).filter((type) => type !== 'all');
  const hasOrderType = (type) => !orderTypes.length || orderTypes.includes(type);

  if (childStatuses.length) {
    const childQueries = [];
    if (hasOrderType(ORDER_TYPE.LAB)) childQueries.push(LabOrder.find({ status: { $in: childStatuses } }).select('order_id').lean());
    if (hasOrderType(ORDER_TYPE.IMAGING)) childQueries.push(ImagingOrder.find({ status: { $in: childStatuses } }).select('order_id').lean());
    if (hasOrderType(ORDER_TYPE.PROCEDURE)) childQueries.push(ProcedureOrder.find({ status: { $in: childStatuses } }).select('order_id').lean());
    const rows = (await Promise.all(childQueries)).flat();
    constraints.push(rows.map((item) => item.order_id));
  }

  const specimenStatuses = normalizeList(query.specimen_status);
  if (specimenStatuses.length) {
    const specimens = await Specimen.find({ status: { $in: specimenStatuses } }).select('lab_order_id').lean();
    const labOrders = await LabOrder.find({ _id: { $in: specimens.map((item) => item.lab_order_id) } }).select('order_id').lean();
    constraints.push(labOrders.map((item) => item.order_id));
  }

  const resultStatuses = normalizeList(query.result_status);
  if (resultStatuses.length) {
    const results = await LabResult.find({ status: { $in: resultStatuses } }).select('lab_order_id').lean();
    const labOrders = await LabOrder.find({ _id: { $in: results.map((item) => item.lab_order_id) } }).select('order_id').lean();
    constraints.push(labOrders.map((item) => item.order_id));
  }

  const reportStatuses = normalizeList(query.report_status);
  if (reportStatuses.length) {
    const reports = await ImagingReport.find({ status: { $in: reportStatuses } }).select('imaging_order_id').lean();
    const imagingOrders = await ImagingOrder.find({ _id: { $in: reports.map((item) => item.imaging_order_id) } }).select('order_id').lean();
    constraints.push(imagingOrders.map((item) => item.order_id));
  }

  const hasAttachment = parseBoolean(query.has_attachment);
  if (hasAttachment !== undefined || query.scan_status || query.attachment_review_status) {
    const attachmentFilter = {
      status: { $in: ACTIVE_ATTACHMENT_STATUSES },
      order_id: { $exists: true },
    };
    if (query.scan_status) attachmentFilter.scan_status = { $in: normalizeList(query.scan_status) };
    if (query.attachment_review_status) attachmentFilter.review_status = { $in: normalizeList(query.attachment_review_status) };
    const attachments = await Attachment.find(attachmentFilter).select('order_id').lean();
    const ids = attachments.map((item) => item.order_id);
    constraints.push(hasAttachment === false ? await findInverseClinicalOrderIds(ids) : ids);
  }

  const hasCharge = parseBoolean(query.has_charge);
  if (hasCharge !== undefined || query.charge_status) {
    const chargeFilter = { order_id: { $exists: true } };
    if (query.charge_status) chargeFilter.status = { $in: normalizeList(query.charge_status) };
    else chargeFilter.status = { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES };
    const charges = await Charge.find(chargeFilter).select('order_id').lean();
    const ids = charges.map((item) => item.order_id);
    constraints.push(hasCharge === false ? await findInverseClinicalOrderIds(ids) : ids);
  }

  const hasResult = parseBoolean(query.has_result);
  const hasFinalResult = parseBoolean(query.has_final_result);
  if (hasResult !== undefined || hasFinalResult !== undefined || query.is_critical || query.critical_unacknowledged) {
    const critical = parseBoolean(query.is_critical);
    const criticalUnack = parseBoolean(query.critical_unacknowledged);
    const resultFilter = {};
    const reportFilter = {};
    if (hasFinalResult) {
      resultFilter.status = { $in: [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED] };
      reportFilter.status = { $in: [IMAGING_REPORT_STATUS.FINAL, IMAGING_REPORT_STATUS.AMENDED] };
    }
    if (critical !== undefined) {
      resultFilter.is_critical = critical;
      reportFilter.is_critical = critical;
    }
    if (criticalUnack) {
      resultFilter.is_critical = true;
      resultFilter.critical_acknowledged_at = null;
      reportFilter.is_critical = true;
      reportFilter.critical_acknowledged_at = null;
    }
    const [results, reports] = await Promise.all([
      LabResult.find(resultFilter).select('lab_order_id').lean(),
      ImagingReport.find(reportFilter).select('imaging_order_id').lean(),
    ]);
    const [labOrders, imagingOrders] = await Promise.all([
      LabOrder.find({ _id: { $in: results.map((item) => item.lab_order_id) } }).select('order_id').lean(),
      ImagingOrder.find({ _id: { $in: reports.map((item) => item.imaging_order_id) } }).select('order_id').lean(),
    ]);
    const ids = [...labOrders.map((item) => item.order_id), ...imagingOrders.map((item) => item.order_id)];
    constraints.push(hasResult === false ? await findInverseClinicalOrderIds(ids) : ids);
  }

  if (query.scheduled_from || query.scheduled_to || query.room_id || query.performer_id || query.radiologist_id || query.technician_id) {
    const scheduledFilter = {};
    if (query.scheduled_from || query.scheduled_to) {
      scheduledFilter.$or = [];
      const range = {};
      if (query.scheduled_from) range.$gte = parseDate(query.scheduled_from, 'scheduled_from');
      if (query.scheduled_to) range.$lte = parseDate(query.scheduled_to, 'scheduled_to');
      scheduledFilter.$or.push({ scheduled_at: range }, { scheduled_start: range });
    }
    const childIds = [];
    if (query.room_id) {
      const imagingOrders = await ImagingOrder.find({ room_id: query.room_id }).select('order_id').lean();
      childIds.push(...imagingOrders.map((item) => item.order_id));
    }
    if (query.performer_id) {
      const procedureOrders = await ProcedureOrder.find({ performer_id: query.performer_id }).select('order_id').lean();
      childIds.push(...procedureOrders.map((item) => item.order_id));
    }
    if (query.radiologist_id || query.technician_id) {
      const reportFilter = {};
      if (query.radiologist_id) reportFilter.radiologist_id = query.radiologist_id;
      if (query.technician_id) reportFilter.technician_id = query.technician_id;
      const reports = await ImagingReport.find(reportFilter).select('imaging_order_id').lean();
      const imagingOrders = await ImagingOrder.find({ _id: { $in: reports.map((item) => item.imaging_order_id) } }).select('order_id').lean();
      childIds.push(...imagingOrders.map((item) => item.order_id));
    }
    if (scheduledFilter.$or?.length) {
      const [imagingOrders, procedureOrders] = await Promise.all([
        ImagingOrder.find({ scheduled_at: scheduledFilter.$or[0].scheduled_at }).select('order_id').lean(),
        ProcedureOrder.find({ scheduled_start: scheduledFilter.$or[1].scheduled_start }).select('order_id').lean(),
      ]);
      childIds.push(...imagingOrders.map((item) => item.order_id), ...procedureOrders.map((item) => item.order_id));
    }
    constraints.push(childIds);
  }

  return constraints;
}

async function findInverseClinicalOrderIds(excludedIds = []) {
  const excluded = new Set((excludedIds || []).map((id) => String(id)));
  const rows = await Order.find({
    order_type: { $in: CLINICAL_ORDER_TYPES },
    _id: { $nin: [...excluded].map((id) => asObjectId(id)).filter(Boolean) },
  }).select('_id').lean();
  return rows.map((item) => item._id);
}

async function buildOrderFilter(query = {}, actor = {}) {
  const filter = { order_type: { $in: resolveOrderTypeFilter(query, actor) } };
  for (const field of ['patient_id', 'encounter_id', 'admission_id', 'department_id', 'ordered_by', 'priority', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  applyDateFilters(filter, query);
  if (query.sla_status) filter.sla_status = query.sla_status;
  await applySearchFilter(filter, query);
  applyActorScope(filter, query, actor);

  const constraints = await findOrderIdsForAdvancedFilters(query);
  for (const ids of constraints) addOrderIdConstraint(filter, ids);
  return filter;
}

async function loadOrderRows(filter, { skip = 0, limit = 30, sort = { ordered_at: -1, created_at: -1 } } = {}) {
  return Order.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time')
    .populate('department_id', 'department_code department_name')
    .populate('ordered_by', 'full_name username employee_code')
    .populate('acknowledged_by', 'full_name username employee_code')
    .populate('assigned_to', 'full_name username employee_code')
    .populate('assigned_department_id', 'department_code department_name')
    .populate('assigned_room_id', 'room_code room_name name')
    .lean();
}

async function loadRelatedMaps(orders = []) {
  const orderIds = orders.map((order) => order._id);
  const [labOrders, imagingOrders, procedureOrders, attachments, charges] = await Promise.all([
    LabOrder.find({ order_id: { $in: orderIds } }).sort({ created_at: -1 }).lean(),
    ImagingOrder.find({ order_id: { $in: orderIds } }).sort({ created_at: -1 }).lean(),
    ProcedureOrder.find({ order_id: { $in: orderIds } }).sort({ created_at: -1 }).lean(),
    Attachment.find({ order_id: { $in: orderIds }, status: { $in: ACTIVE_ATTACHMENT_STATUSES } }).sort({ created_at: -1 }).lean(),
    Charge.find({ order_id: { $in: orderIds } }).sort({ charged_at: -1, created_at: -1 }).lean(),
  ]);

  const labOrderIds = labOrders.map((item) => item._id);
  const imagingOrderIds = imagingOrders.map((item) => item._id);
  const [specimens, labResults, imagingReports] = await Promise.all([
    Specimen.find({ lab_order_id: { $in: labOrderIds } }).sort({ created_at: -1 }).lean(),
    LabResult.find({ lab_order_id: { $in: labOrderIds } }).sort({ is_current: -1, verified_at: -1, reported_at: -1, created_at: -1 }).lean(),
    ImagingReport.find({ imaging_order_id: { $in: imagingOrderIds } }).sort({ verified_at: -1, reported_at: -1, created_at: -1 }).lean(),
  ]);
  const labResultIds = labResults.map((item) => item._id);
  const resultItems = labResultIds.length
    ? await LabResultItem.find({ lab_result_id: { $in: labResultIds } }).sort({ display_order: 1, created_at: 1 }).lean()
    : [];

  return {
    labByOrder: firstByKey(labOrders, (item) => item.order_id),
    imagingByOrder: firstByKey(imagingOrders, (item) => item.order_id),
    procedureByOrder: firstByKey(procedureOrders, (item) => item.order_id),
    specimensByLab: groupByKey(specimens, (item) => item.lab_order_id),
    labResultsByLab: groupByKey(labResults, (item) => item.lab_order_id),
    resultItemsByResult: groupByKey(resultItems, (item) => item.lab_result_id),
    imagingReportsByOrder: groupByKey(imagingReports, (item) => item.imaging_order_id),
    attachmentsByOrder: groupByKey(attachments, (item) => item.order_id),
    chargesByOrder: groupByKey(charges, (item) => item.order_id),
  };
}

function latestLabResult(labResults = []) {
  return labResults.find((item) => item.is_current) || labResults[0] || null;
}

function latestImagingReport(reports = []) {
  return reports[0] || null;
}

function getCompletedAt(order, child, resultOrReport) {
  if (order.status !== ORDER_STATUS.COMPLETED) return null;
  if (order.order_type === ORDER_TYPE.LAB) return resultOrReport?.verified_at || child?.completed_at || resultOrReport?.reported_at || null;
  if (order.order_type === ORDER_TYPE.IMAGING) return resultOrReport?.verified_at || child?.completed_at || resultOrReport?.reported_at || null;
  if (order.order_type === ORDER_TYPE.PROCEDURE) return child?.completed_at || child?.performed_end || null;
  return null;
}

function computeSla(order, child, resultOrReport) {
  const now = new Date();
  const priority = order.priority || ORDER_PRIORITY.ROUTINE;
  const threshold = SLA_THRESHOLDS[priority] || SLA_THRESHOLDS[ORDER_PRIORITY.ROUTINE];
  const startedAt = order.sla_started_at || order.ordered_at || order.created_at;
  const dueAt = order.sla_due_at || (startedAt ? new Date(new Date(startedAt).getTime() + threshold.minutes * 60000) : null);
  const completedAt = order.sla_stopped_at || getCompletedAt(order, child, resultOrReport);
  if (!dueAt) return null;

  const reference = completedAt ? new Date(completedAt) : now;
  const diffMinutes = Math.ceil((new Date(dueAt).getTime() - reference.getTime()) / 60000);
  const breachedMinutes = diffMinutes < 0 ? Math.abs(diffMinutes) : 0;
  const state = completedAt
    ? (breachedMinutes > 0 ? 'completed_breached' : 'completed')
    : (breachedMinutes > 0 ? 'breached' : diffMinutes <= threshold.warning ? 'warning' : 'normal');
  return {
    started_at: startedAt,
    due_at: dueAt,
    completed_at: completedAt,
    remaining_minutes: Math.max(diffMinutes, 0),
    breached_minutes: breachedMinutes,
    warning_minutes: threshold.warning,
    status: state,
    state,
  };
}

function buildChildSummary(order, maps) {
  if (order.order_type === ORDER_TYPE.LAB) {
    const labOrder = maps.labByOrder.get(String(order._id));
    const specimens = labOrder ? maps.specimensByLab.get(String(labOrder._id)) || [] : [];
    const results = labOrder ? maps.labResultsByLab.get(String(labOrder._id)) || [] : [];
    const result = latestLabResult(results);
    const items = result ? maps.resultItemsByResult.get(String(result._id)) || [] : [];
    return {
      raw: labOrder,
      result,
      result_items: items,
      specimens,
      type: ORDER_TYPE.LAB,
      id: labOrder?._id ? String(labOrder._id) : null,
      no: labOrder?.lab_order_no,
      name: labOrder?.test_name,
      code: labOrder?.test_code,
      status: labOrder?.status,
      specimen_status: specimens[0]?.status || null,
      result_status: result?.status || null,
      details: {
        test_code: labOrder?.test_code,
        test_name: labOrder?.test_name,
        specimen_type: labOrder?.specimen_type,
        specimen_no: specimens[0]?.specimen_no,
        specimen_status: specimens[0]?.status || null,
        result_no: result?.result_no,
        result_status: result?.status || null,
        critical_items: items.filter((item) => item.is_critical).length,
        abnormal_items: items.filter((item) => !['normal', 'unknown', undefined, null].includes(item.abnormal_flag)).length,
        released_to_patient: Boolean(result?.released_to_patient),
        released_to_doctor: Boolean(result?.released_to_doctor),
      },
    };
  }
  if (order.order_type === ORDER_TYPE.IMAGING) {
    const imagingOrder = maps.imagingByOrder.get(String(order._id));
    const reports = imagingOrder ? maps.imagingReportsByOrder.get(String(imagingOrder._id)) || [] : [];
    const report = latestImagingReport(reports);
    return {
      raw: imagingOrder,
      result: report,
      reports,
      type: ORDER_TYPE.IMAGING,
      id: imagingOrder?._id ? String(imagingOrder._id) : null,
      no: imagingOrder?.imaging_order_no,
      name: [imagingOrder?.modality?.toUpperCase(), imagingOrder?.body_part].filter(Boolean).join(' '),
      status: imagingOrder?.status,
      report_status: report?.status || null,
      details: {
        modality: imagingOrder?.modality,
        body_part: imagingOrder?.body_part,
        contrast_required: Boolean(imagingOrder?.contrast_required),
        scheduled_at: imagingOrder?.scheduled_at,
        started_at: imagingOrder?.started_at,
        completed_at: imagingOrder?.completed_at,
        room_id: imagingOrder?.room_id,
        report_no: report?.report_no,
        report_status: report?.status || null,
        pacs_url: report?.pacs_url,
        critical_finding: report?.critical_finding,
        released_to_patient: Boolean(report?.released_to_patient),
        released_to_doctor: Boolean(report?.released_to_doctor),
      },
    };
  }
  const procedureOrder = maps.procedureByOrder.get(String(order._id));
  return {
    raw: procedureOrder,
    result: procedureOrder,
    type: ORDER_TYPE.PROCEDURE,
    id: procedureOrder?._id ? String(procedureOrder._id) : null,
    no: procedureOrder?.procedure_order_no,
    name: procedureOrder?.procedure_name,
    code: procedureOrder?.procedure_code,
    status: procedureOrder?.status,
    details: {
      procedure_code: procedureOrder?.procedure_code,
      procedure_name: procedureOrder?.procedure_name,
      scheduled_start: procedureOrder?.scheduled_start,
      scheduled_end: procedureOrder?.scheduled_end,
      performed_start: procedureOrder?.performed_start,
      performed_end: procedureOrder?.performed_end,
      completed_at: procedureOrder?.completed_at,
      performer_id: procedureOrder?.performer_id,
      result_note: procedureOrder?.result_note,
      no_show_reason: procedureOrder?.no_show_reason,
      released_to_doctor: Boolean(procedureOrder?.released_to_doctor),
    },
  };
}

function summarizeCharges(charges = []) {
  const active = charges.filter((charge) => !ACTIVE_CHARGE_EXCLUDED_STATUSES.includes(charge.status));
  return {
    has_charge: active.length > 0,
    charge_count: charges.length,
    active_charge_count: active.length,
    statuses: [...new Set(charges.map((charge) => charge.status).filter(Boolean))],
    total_amount: active.reduce((sum, charge) => sum + Number(charge.total_amount || 0), 0),
    has_invoiced_charge: charges.some((charge) => Boolean(charge.invoice_id) || charge.status === CHARGE_STATUS.BILLED),
  };
}

function summarizeAttachments(attachments = []) {
  return {
    has_attachment: attachments.length > 0,
    attachment_count: attachments.length,
    scan_statuses: [...new Set(attachments.map((item) => item.scan_status).filter(Boolean))],
    review_statuses: [...new Set(attachments.map((item) => item.review_status).filter(Boolean))],
    scan_issue_count: attachments.filter((item) => ['infected', 'failed'].includes(item.scan_status)).length,
    pending_review_count: attachments.filter((item) => item.review_status === 'pending').length,
    released_to_patient_count: attachments.filter((item) => item.released_to_patient).length,
  };
}

function buildFlags(order, child, attachments = [], charges = [], sla = null) {
  const result = child.result;
  const criticalFromItems = (child.result_items || []).some((item) => item.is_critical);
  const isCritical = Boolean(result?.is_critical || criticalFromItems);
  const criticalUnack = Boolean(isCritical && !result?.critical_acknowledged_at);
  const hasResult = Boolean(child.result || child.result_status || child.report_status || (order.order_type === ORDER_TYPE.PROCEDURE && child.details?.result_note));
  const hasFinalResult = Boolean(
    child.result?.status && FINAL_RESULT_STATUSES.includes(child.result.status),
  ) || (order.order_type === ORDER_TYPE.PROCEDURE && Boolean(child.details?.result_note));
  const attachmentSummary = summarizeAttachments(attachments);
  const chargeSummary = summarizeCharges(charges);
  const missingFile = [ORDER_TYPE.IMAGING, ORDER_TYPE.PROCEDURE].includes(order.order_type)
    && [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.COMPLETED].includes(order.status)
    && !attachmentSummary.has_attachment;
  const pendingApproval = child.result?.status && APPROVAL_STATUSES.includes(child.result.status);
  return {
    is_critical: isCritical,
    critical_unacknowledged: criticalUnack,
    has_result: hasResult,
    has_final_result: hasFinalResult,
    has_attachment: attachmentSummary.has_attachment,
    missing_file: missingFile,
    file_scan_issue: attachmentSummary.scan_issue_count > 0,
    file_pending_review: attachmentSummary.pending_review_count > 0,
    has_charge: chargeSummary.has_charge,
    has_invoiced_charge: chargeSummary.has_invoiced_charge,
    pending_approval: Boolean(pendingApproval),
    released_to_patient: Boolean(result?.released_to_patient || attachmentSummary.released_to_patient_count > 0),
    released_to_doctor: Boolean(result?.released_to_doctor),
    overdue: sla?.state === 'breached',
    sla_warning: sla?.state === 'warning',
  };
}

function determineNextAction(order, child, flags) {
  if (order.status === ORDER_STATUS.ORDERED) return 'acknowledge';
  if (order.status === ORDER_STATUS.ACKNOWLEDGED) {
    if (order.order_type === ORDER_TYPE.LAB) {
      if (!child.specimens?.length) return 'create_specimen';
      if ([SPECIMEN_STATUS.PLANNED].includes(child.details?.specimen_status)) return 'collect_specimen';
      if ([SPECIMEN_STATUS.COLLECTED].includes(child.details?.specimen_status)) return 'receive_specimen';
      if ([SPECIMEN_STATUS.RECEIVED].includes(child.details?.specimen_status)) return 'process_specimen';
    }
    if (order.order_type === ORDER_TYPE.IMAGING) {
      if (child.status === IMAGING_ORDER_STATUS.ORDERED) return 'schedule';
      return 'start';
    }
    if (order.order_type === ORDER_TYPE.PROCEDURE) {
      if (child.status === PROCEDURE_STATUS.ORDERED) return 'schedule';
      return 'start';
    }
  }
  if (order.status === ORDER_STATUS.IN_PROGRESS) {
    if (order.order_type === ORDER_TYPE.LAB) return flags.has_result ? 'finalize_result' : 'create_result';
    if (order.order_type === ORDER_TYPE.IMAGING) return child.status === IMAGING_ORDER_STATUS.IN_PROGRESS ? 'complete_technical' : 'create_report';
    if (order.order_type === ORDER_TYPE.PROCEDURE) return flags.has_final_result ? 'create_charge' : 'complete_procedure';
  }
  if (order.status === ORDER_STATUS.COMPLETED) {
    if (!flags.released_to_doctor) return 'release_to_doctor';
    if (!flags.released_to_patient) return 'release_to_patient';
    return 'view_result';
  }
  return 'timeline';
}

function allowedActions(order, child, flags, actor = {}) {
  const actions = ['view', 'timeline'];
  if (order.status === ORDER_STATUS.ORDERED) {
    actions.push('acknowledge', 'assign');
    if (hasAnyPermission(actor, [PERMISSION.ORDERS.START, PERMISSION.IMAGING_ORDERS.START, PERMISSION.PROCEDURE_ORDERS.START])) actions.push('start');
    if (order.order_type === ORDER_TYPE.IMAGING) actions.push('schedule');
    if (order.order_type === ORDER_TYPE.PROCEDURE) actions.push('schedule');
  }
  if (order.status === ORDER_STATUS.ACKNOWLEDGED) {
    actions.push('assign', 'start');
    if (order.order_type === ORDER_TYPE.LAB) actions.push('collect_specimen', 'receive_specimen', 'process_specimen');
    if (order.order_type === ORDER_TYPE.IMAGING) actions.push('schedule', 'start');
    if (order.order_type === ORDER_TYPE.PROCEDURE) actions.push('schedule', 'start', 'create_charge');
  }
  if (order.status === ORDER_STATUS.IN_PROGRESS) {
    if (order.order_type === ORDER_TYPE.LAB) actions.push('create_result', 'finalize_result');
    if (order.order_type === ORDER_TYPE.IMAGING) actions.push('complete_technical', 'upload_file', 'create_report', 'finalize_report');
    if (order.order_type === ORDER_TYPE.PROCEDURE) actions.push('complete_procedure', 'upload_file', 'create_charge');
  }
  if (order.status === ORDER_STATUS.COMPLETED) {
    actions.push('view_result', 'release_to_doctor', 'release_to_patient');
    if (order.order_type !== ORDER_TYPE.PROCEDURE) actions.push('amend');
  }
  if (![ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.ENTERED_IN_ERROR].includes(order.status)) {
    actions.push('cancel', 'entered_in_error');
  }
  if (flags.overdue || order.priority === ORDER_PRIORITY.STAT || order.priority === ORDER_PRIORITY.URGENT) actions.push('notify_doctor');
  return [...new Set(actions)];
}

function buildRow(order, maps, actor = {}) {
  const child = buildChildSummary(order, maps);
  const attachments = maps.attachmentsByOrder.get(String(order._id)) || [];
  const charges = maps.chargesByOrder.get(String(order._id)) || [];
  const sla = computeSla(order, child.raw, child.result);
  const flags = buildFlags(order, child, attachments, charges, sla);
  const nextAction = determineNextAction(order, child, flags);
  const attachmentSummary = summarizeAttachments(attachments);
  const chargeSummary = summarizeCharges(charges);

  return {
    order_id: String(order._id),
    order_no: order.order_no,
    order_type: order.order_type,
    priority: order.priority,
    status: order.status,
    clinical_indication: order.clinical_indication,
    requested_at: order.requested_at,
    ordered_at: order.ordered_at,
    acknowledged_at: order.acknowledged_at,
    cancelled_at: order.cancelled_at,
    cancel_reason: order.cancel_reason,
    entered_in_error_at: order.entered_in_error_at,
    entered_in_error_reason: order.entered_in_error_reason,
    patient: slimPatient(order.patient_id),
    encounter: slimEncounter(order.encounter_id),
    department: slimDepartment(order.department_id),
    ordered_by: slimUser(order.ordered_by),
    acknowledged_by: slimUser(order.acknowledged_by),
    owner: slimUser(order.assigned_to),
    assigned_to: slimUser(order.assigned_to),
    assigned_department: slimDepartment(order.assigned_department_id),
    assigned_room: order.assigned_room_id ? {
      id: String(order.assigned_room_id._id || order.assigned_room_id),
      room_code: order.assigned_room_id.room_code,
      room_name: order.assigned_room_id.room_name || order.assigned_room_id.name,
    } : null,
    child: {
      type: child.type,
      id: child.id,
      no: child.no,
      name: child.name,
      code: child.code,
      status: child.status,
      specimen_status: child.details?.specimen_status || null,
      result_status: child.details?.result_status || child.details?.report_status || null,
      details: child.details,
    },
    service_label: child.name || 'Dịch vụ cận lâm sàng',
    flags,
    file_summary: attachmentSummary,
    charge_summary: chargeSummary,
    sla,
    next_action: nextAction,
    allowed_actions: allowedActions(order, child, flags, actor),
    timestamps: {
      created_at: order.created_at,
      updated_at: order.updated_at,
      ordered_at: order.ordered_at,
      completed_at: getCompletedAt(order, child.raw, child.result),
    },
  };
}

function filterRowsPostQuery(rows = [], query = {}) {
  return rows.filter((row) => {
    if (query.overdue !== undefined && row.flags.overdue !== parseBoolean(query.overdue)) return false;
    if (query.sla_status && row.sla?.state !== query.sla_status && row.sla?.status !== query.sla_status) return false;
    if (query.missing_file !== undefined && row.flags.missing_file !== parseBoolean(query.missing_file)) return false;
    if (query.pending_approval !== undefined && row.flags.pending_approval !== parseBoolean(query.pending_approval)) return false;
    return true;
  });
}

async function getRows(query = {}, actor = {}, options = {}) {
  const { page, limit, skip } = getPagination(query, options.defaultLimit || 30, options.maxLimit || 200);
  const filter = await buildOrderFilter(query, actor);
  const sortBy = normalizeString(query.sort_by);
  const sort = sortBy === 'oldest'
    ? { ordered_at: 1, created_at: 1 }
    : sortBy === 'priority'
      ? { priority: -1, ordered_at: 1 }
      : { ordered_at: -1, created_at: -1 };

  const [orders, total] = await Promise.all([
    loadOrderRows(filter, { skip, limit, sort }),
    Order.countDocuments(filter),
  ]);
  const maps = await loadRelatedMaps(orders);
  const rows = filterRowsPostQuery(orders.map((order) => buildRow(order, maps, actor)), query);

  return {
    items: rows,
    pagination: buildPagination(page, limit, total),
  };
}

function summarizeRows(rows = []) {
  const summary = {
    total_orders: rows.length,
    stat: 0,
    urgent: 0,
    ordered: 0,
    acknowledged: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    entered_in_error: 0,
    lab: 0,
    imaging: 0,
    procedure: 0,
    critical: 0,
    critical_unacknowledged: 0,
    overdue: 0,
    missing_file: 0,
    pending_approval: 0,
    released_to_patient: 0,
  };
  for (const row of rows) {
    if (row.priority === ORDER_PRIORITY.STAT) summary.stat += 1;
    if (row.priority === ORDER_PRIORITY.URGENT) summary.urgent += 1;
    if (summary[row.status] !== undefined) summary[row.status] += 1;
    if (summary[row.order_type] !== undefined) summary[row.order_type] += 1;
    if (row.flags.is_critical) summary.critical += 1;
    if (row.flags.critical_unacknowledged) summary.critical_unacknowledged += 1;
    if (row.flags.overdue) summary.overdue += 1;
    if (row.flags.missing_file) summary.missing_file += 1;
    if (row.flags.pending_approval) summary.pending_approval += 1;
    if (row.flags.released_to_patient) summary.released_to_patient += 1;
  }
  return summary;
}

async function getSummary(query = {}, actor = {}) {
  const data = await getRows({ ...query, page: 1, limit: query.limit || 1000 }, actor, { maxLimit: 5000 });
  const summary = summarizeRows(data.items);
  return {
    ...summary,
    total: summary.total_orders,
    generated_at: new Date(),
  };
}

function boardBucket() {
  return { total: 0, stat: 0, urgent: 0, overdue: 0, critical: 0 };
}

async function getStatusBoard(query = {}, actor = {}) {
  const data = await getRows({ ...query, page: 1, limit: query.limit || 1000 }, actor, { maxLimit: 5000 });
  const board = {
    ordered: boardBucket(),
    acknowledged: boardBucket(),
    in_progress: boardBucket(),
    completed: boardBucket(),
    cancelled: boardBucket(),
    entered_in_error: boardBucket(),
  };
  for (const row of data.items) {
    const bucket = board[row.status];
    if (!bucket) continue;
    bucket.total += 1;
    if (row.priority === ORDER_PRIORITY.STAT) bucket.stat += 1;
    if (row.priority === ORDER_PRIORITY.URGENT) bucket.urgent += 1;
    if (row.flags.overdue) bucket.overdue += 1;
    if (row.flags.is_critical) bucket.critical += 1;
  }
  return {
    summary: summarizeRows(data.items),
    board,
  };
}

async function getClinicalOrderCenter(query = {}, actor = {}) {
  const [list, summary, statusBoard] = await Promise.all([
    getRows(query, actor),
    getSummary(query, actor),
    getStatusBoard(query, actor),
  ]);
  return {
    summary,
    status_board: statusBoard.board,
    items: list.items,
    pagination: list.pagination,
  };
}

async function getStatusList(status, query = {}, actor = {}) {
  return getClinicalOrderCenter({ ...query, status }, actor);
}

async function getInProgressLive(query = {}, actor = {}) {
  const data = await getStatusList(ORDER_STATUS.IN_PROGRESS, query, actor);
  return {
    ...data,
    items: data.items.map((row) => ({
      ...row,
      current_step: row.child?.status || row.status,
      elapsed_minutes: row.timestamps?.ordered_at
        ? Math.max(Math.floor((Date.now() - new Date(row.timestamps.ordered_at).getTime()) / 60000), 0)
        : null,
      sla_remaining_minutes: row.sla?.remaining_minutes,
      attachments_count: row.file_summary?.attachment_count || 0,
      blocking_reason: row.flags.missing_file ? 'missing_file' : row.flags.file_scan_issue ? 'file_scan_issue' : null,
      assigned_staff: row.assigned_to,
      room_id: row.assigned_room?.id || row.child?.details?.room_id || null,
      result_draft_id: row.order_type === ORDER_TYPE.LAB && row.child?.result_status === LAB_RESULT_STATUS.PRELIMINARY ? row.child.id : null,
      report_draft_id: row.order_type === ORDER_TYPE.IMAGING && [IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY].includes(row.child?.result_status) ? row.child.id : null,
    })),
  };
}

async function getOrderFullDetail(orderId, actor = {}) {
  const order = await Order.findById(orderId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone address')
    .populate('encounter_id', 'encounter_code encounter_type status start_time end_time attending_doctor_id')
    .populate('department_id', 'department_code department_name')
    .populate('ordered_by', 'full_name username employee_code phone email')
    .populate('acknowledged_by', 'full_name username employee_code')
    .populate('assigned_to', 'full_name username employee_code')
    .populate('assigned_department_id', 'department_code department_name')
    .populate('assigned_room_id', 'room_code room_name name')
    .lean();
  if (!order) throw createError('Không tìm thấy order.', 404);
  if (!CLINICAL_ORDER_TYPES.includes(order.order_type)) throw createError('Order không thuộc nhóm cận lâm sàng/thủ thuật.', 400);

  const maps = await loadRelatedMaps([order]);
  const row = buildRow(order, maps, actor);
  const child = buildChildSummary(order, maps);
  const attachments = maps.attachmentsByOrder.get(String(order._id)) || [];
  const charges = maps.chargesByOrder.get(String(order._id)) || [];

  let childDetail = {};
  if (order.order_type === ORDER_TYPE.LAB) {
    childDetail = {
      lab_order: child.raw,
      specimens: child.specimens || [],
      results: maps.labResultsByLab.get(String(child.raw?._id)) || [],
      result_items: child.result_items || [],
    };
  } else if (order.order_type === ORDER_TYPE.IMAGING) {
    childDetail = {
      imaging_order: child.raw,
      reports: child.reports || [],
    };
  } else {
    childDetail = {
      procedure_order: child.raw,
    };
  }

  const audit = await AuditLog.find({
    $or: [
      { target_type: 'order', target_id: order._id },
      { 'metadata.order_id': String(order._id) },
    ],
  }).sort({ created_at: -1 }).limit(30).lean();

  return {
    row,
    order,
    patient: row.patient,
    encounter: row.encounter,
    child: childDetail,
    attachments,
    charges,
    audit_summary: {
      total_recent_events: audit.length,
      latest_event: audit[0] || null,
    },
    allowed_actions: row.allowed_actions,
  };
}

function timelineCategory(log = {}) {
  const target = log.target_type || '';
  const action = log.action || '';
  if (target.includes('attachment') || action.includes('attachment') || action.includes('file')) return 'file';
  if (target.includes('charge') || action.includes('charge')) return 'charge';
  if (action.includes('critical')) return 'critical';
  if (action.includes('release')) return 'release';
  if (action.includes('cancel') || action.includes('error')) return 'cancel_error';
  if (target.includes('result') || target.includes('report')) return 'result_report';
  if (target.includes('specimen')) return 'specimen';
  return 'workflow';
}

async function getOrderFullTimeline(orderId, query = {}, actor = {}) {
  const detail = await getOrderFullDetail(orderId, actor);
  const orderObjectId = asObjectId(orderId);
  const childIds = [];
  const metadataKeys = ['order_id'];
  if (detail.child.lab_order?._id) {
    childIds.push(detail.child.lab_order._id);
    metadataKeys.push('lab_order_id');
  }
  if (detail.child.imaging_order?._id) {
    childIds.push(detail.child.imaging_order._id);
    metadataKeys.push('imaging_order_id');
  }
  if (detail.child.procedure_order?._id) {
    childIds.push(detail.child.procedure_order._id);
    metadataKeys.push('procedure_order_id');
  }
  childIds.push(...(detail.attachments || []).map((item) => item._id));
  childIds.push(...(detail.charges || []).map((item) => item._id));

  const metadataConditions = metadataKeys.map((key) => ({ [`metadata.${key}`]: String(orderId) }));
  const logs = await AuditLog.find({
    $or: [
      { target_type: 'order', target_id: orderObjectId },
      { target_id: { $in: childIds.filter(Boolean) } },
      ...metadataConditions,
    ],
  }).sort({ created_at: 1 }).lean();

  const filtered = normalizeList(query.category || query.categories);
  const events = logs
    .map((log) => ({
      event_id: String(log._id),
      event_type: log.action,
      event_time: log.created_at,
      category: timelineCategory(log),
      module: log.module_key || detail.row.order_type || 'orders',
      title: log.message || log.action,
      actor_type: log.actor_type,
      actor_id: log.actor_id,
      entity_type: log.target_type,
      entity_id: log.target_id,
      status: log.status,
      severity: log.severity,
      before: log.before,
      after: log.after,
      metadata: log.metadata,
      request: {
        request_id: log.request_id,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
      },
    }))
    .filter((event) => !filtered.length || filtered.includes(event.category));

  return {
    order: detail.row,
    events,
    groups: events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {}),
  };
}

async function updateAssignment(order, payload = {}, actor = {}, requestMeta = {}) {
  const before = order.toObject ? order.toObject() : order;
  const now = new Date();
  order.assigned_to = payload.assigned_to || payload.assigned_user_id || order.assigned_to;
  order.assigned_role = payload.assigned_role || order.assigned_role;
  order.assigned_department_id = payload.assigned_department_id || payload.department_id || order.assigned_department_id || actorDepartmentId(actor);
  order.assigned_room_id = payload.assigned_room_id || payload.room_id || order.assigned_room_id;
  order.assigned_by = actor?.userId || order.assigned_by;
  order.assigned_at = now;
  order.assignment_status = payload.assignment_status || 'assigned';
  order.updated_by = actor?.userId;
  await order.save();
  await recordAuditLog({
    actor,
    action: 'clinical_order_center.assign',
    targetType: 'order',
    targetId: order._id,
    status: 'success',
    message: 'Gán order trong Trung tâm order thành công.',
    requestMeta,
    before,
    after: order.toObject(),
    metadata: {
      assigned_to: order.assigned_to,
      assigned_role: order.assigned_role,
      assigned_department_id: order.assigned_department_id,
      assigned_room_id: order.assigned_room_id,
    },
  });
}

async function acceptOrder(orderId, payload = {}, actor = {}, requestMeta = {}) {
  let order = await Order.findById(orderId);
  if (!order) throw createError('Không tìm thấy order.', 404);
  if (!CLINICAL_ORDER_TYPES.includes(order.order_type)) throw createError('Order không thuộc nhóm cận lâm sàng/thủ thuật.', 400);
  if (order.status !== ORDER_STATUS.ORDERED) throw createError('Chỉ order chờ tiếp nhận mới được accept.', 409);

  if (order.order_type === ORDER_TYPE.IMAGING && payload.auto_schedule && payload.scheduled_at) {
    const imagingOrder = await ImagingOrder.findOne({ order_id: order._id }).lean();
    if (!imagingOrder) throw createError('Không tìm thấy imaging order.', 404);
    await imagingService.scheduleImagingOrder(imagingOrder._id, payload, actor, requestMeta);
  } else if (order.order_type === ORDER_TYPE.PROCEDURE && payload.auto_schedule && (payload.scheduled_start || payload.scheduled_at)) {
    const procedureOrder = await ProcedureOrder.findOne({ order_id: order._id }).lean();
    if (!procedureOrder) throw createError('Không tìm thấy procedure order.', 404);
    await procedureService.scheduleProcedure(procedureOrder._id, {
      ...payload,
      scheduled_start: payload.scheduled_start || payload.scheduled_at,
    }, actor, requestMeta);
  } else {
    await orderService.acknowledgeOrder(order._id, actor, requestMeta);
  }

  order = await Order.findById(orderId);
  order.acknowledged_by = actor?.userId || order.acknowledged_by;
  order.acknowledged_at = order.acknowledged_at || new Date();
  order.assignment_status = payload.assigned_to ? 'assigned' : 'accepted';
  if (payload.accept_note) order.sla_reason = payload.accept_note;
  await updateAssignment(order, payload, actor, requestMeta);

  if (payload.auto_start) {
    const refreshed = await Order.findById(orderId).lean();
    if (refreshed?.status === ORDER_STATUS.ACKNOWLEDGED) {
      await orderService.startOrder(orderId, actor, requestMeta);
    }
  }

  return getOrderFullDetail(orderId, actor);
}

async function assignOrder(orderId, payload = {}, actor = {}, requestMeta = {}) {
  const order = await Order.findById(orderId);
  if (!order) throw createError('Không tìm thấy order.', 404);
  if (!CLINICAL_ORDER_TYPES.includes(order.order_type)) throw createError('Order không thuộc nhóm cận lâm sàng/thủ thuật.', 400);
  await updateAssignment(order, payload, actor, requestMeta);
  return getOrderFullDetail(orderId, actor);
}

async function notifyDoctor(orderId, payload = {}, actor = {}, requestMeta = {}) {
  const order = await Order.findById(orderId).populate('ordered_by', 'full_name username').lean();
  if (!order) throw createError('Không tìm thấy order.', 404);
  const message = normalizeString(payload.message) || `Order ${order.order_no} cần được chú ý tại Trung tâm order.`;
  const notification = await notificationService.createStaffNotification(order.ordered_by?._id || order.ordered_by, {
    notification_type: 'system',
    priority: payload.priority || 'high',
    title: payload.title || `Cập nhật order ${order.order_no}`,
    message,
    payload: {
      entity_type: 'order',
      entity_id: String(order._id),
      order_no: order.order_no,
      order_type: order.order_type,
      department_id: String(order.department_id || ''),
    },
    action_url: `/clinical-order-center/${order._id}`,
    created_by_module: 'clinical_order_center',
  }, actor);

  await recordAuditLog({
    actor,
    action: 'clinical_order_center.notify_doctor',
    targetType: 'order',
    targetId: order._id,
    status: 'success',
    message: 'Gửi thông báo bác sĩ chỉ định từ Trung tâm order thành công.',
    requestMeta,
    metadata: { notification_id: notification?._id, message },
  });

  return { notification, order_id: String(order._id) };
}

async function bulkAction(payload = {}, actor = {}, requestMeta = {}) {
  const action = normalizeString(payload.action);
  const orderIds = normalizeList(payload.order_ids || payload.orderIds);
  if (!action) throw createError('action là bắt buộc.');
  if (!orderIds.length) throw createError('order_ids là bắt buộc.');

  const results = [];
  for (const orderId of orderIds) {
    try {
      let data;
      if (['acknowledge', 'accept', 'bulk_acknowledge'].includes(action)) {
        data = await acceptOrder(orderId, payload, actor, requestMeta);
      } else if (['assign', 'bulk_assign'].includes(action)) {
        data = await assignOrder(orderId, payload, actor, requestMeta);
      } else if (['notify', 'bulk_notify'].includes(action)) {
        data = await notifyDoctor(orderId, payload, actor, requestMeta);
      } else if (['cancel', 'bulk_cancel'].includes(action)) {
        data = await orderService.cancelOrder(orderId, { reason: payload.reason || payload.note || 'Bulk cancel từ Clinical Order Center.' }, actor, requestMeta);
      } else if (['print', 'bulk_print', 'export', 'bulk_export'].includes(action)) {
        data = { queued: true, action };
      } else {
        throw createError(`Bulk action ${action} chưa được hỗ trợ.`);
      }
      results.push({ order_id: orderId, success: true, data });
    } catch (error) {
      results.push({ order_id: orderId, success: false, error: error.message });
    }
  }
  return {
    action,
    requested: orderIds.length,
    succeeded: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
  };
}

async function getMissingFiles(query = {}, actor = {}) {
  const data = await getClinicalOrderCenter({ ...query, missing_file: true }, actor);
  return data;
}

async function getSlaBoard(query = {}, actor = {}) {
  const data = await getClinicalOrderCenter({ ...query, page: 1, limit: query.limit || 1000 }, actor);
  const buckets = {
    normal: 0,
    warning: 0,
    breached: 0,
    completed: 0,
  };
  for (const row of data.items) {
    const state = row.sla?.state || 'normal';
    if (buckets[state] !== undefined) buckets[state] += 1;
    else if (state === 'completed_breached') buckets.completed += 1;
  }
  return {
    summary: data.summary,
    buckets,
    items: data.items.filter((row) => ['warning', 'breached'].includes(row.sla?.state)),
  };
}

module.exports = {
  getClinicalOrderCenter,
  getSummary,
  getStatusBoard,
  getPending: (query, actor) => getStatusList(ORDER_STATUS.ORDERED, query, actor),
  getAcknowledged: (query, actor) => getStatusList(ORDER_STATUS.ACKNOWLEDGED, query, actor),
  getInProgress: (query, actor) => getStatusList(ORDER_STATUS.IN_PROGRESS, query, actor),
  getInProgressLive,
  getCompleted: (query, actor) => getStatusList(ORDER_STATUS.COMPLETED, query, actor),
  getCancelled: (query, actor) => getStatusList(ORDER_STATUS.CANCELLED, query, actor),
  getEnteredInError: (query, actor) => getStatusList(ORDER_STATUS.ENTERED_IN_ERROR, query, actor),
  getOrderFullDetail,
  getOrderFullTimeline,
  acceptOrder,
  assignOrder,
  notifyDoctor,
  bulkAction,
  getMissingFiles,
  getSlaBoard,
};
