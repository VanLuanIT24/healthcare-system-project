const {
  Allergy,
  Attachment,
  AuditLog,
  Charge,
  Encounter,
  ImagingOrder,
  ImagingReport,
  Order,
  Patient,
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
const notificationService = require('./notification.service');
const {
  ALLERGY_SEVERITY,
  ALLERGY_STATUS,
  ALLERGY_TYPE,
  ATTACHMENT_ENTITY_TYPE,
  ATTACHMENT_STATUS,
  CHARGE_STATUS,
  IMAGING_ORDER_STATUS,
  IMAGING_REPORT_STATUS,
  ORDER_STATUS,
  ORDER_TYPE,
} = require('../constants/statuses');
const {
  IMAGING_ORDER_TRANSITIONS,
  IMAGING_REPORT_TRANSITIONS,
  ORDER_TRANSITIONS,
} = require('../constants/transitions');
const { PERMISSION } = require('../constants/permissions');
const { assertTransition, canTransition } = require('../shared/utils/status-transition');
const { withOptionalTransaction } = require('../shared/utils/transaction');

const IMAGING_ORDER_TERMINAL_STATUSES = [
  IMAGING_ORDER_STATUS.COMPLETED,
  IMAGING_ORDER_STATUS.CANCELLED,
  IMAGING_ORDER_STATUS.NO_SHOW,
];

const FINAL_REPORT_STATUSES = [
  IMAGING_REPORT_STATUS.FINAL,
  IMAGING_REPORT_STATUS.AMENDED,
];

const ACTIVE_ATTACHMENT_STATUSES = [
  ATTACHMENT_STATUS.ACTIVE,
];

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

function normalizeString(value) {
  return String(value || '').trim();
}

function nonEmpty(value) {
  return normalizeString(value).length > 0;
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`);
  return date;
}

function assertStaffPermission(actor, permissions, message = 'Bạn không có quyền thao tác Imaging Module.') {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (!hasAnyPermission(actor, Array.isArray(permissions) ? permissions : [permissions])) {
    throw createError(message, 403);
  }
  return true;
}

function assertPatientActive(patient) {
  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (patient.status !== 'active') throw createError('Bệnh nhân không active.', 409);
}

function sanitizeAttachmentForActor(attachment, actor = {}) {
  if (actorType(actor) !== 'patient') return attachment;
  const {
    storage_path: _storagePath,
    checksum: _checksum,
    ...safeAttachment
  } = attachment;
  return safeAttachment;
}

async function generateImagingReportNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.IMAGING_REPORT, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

async function getImagingOrderOrThrow(imagingOrderId, session = null) {
  const imagingOrder = await withSession(ImagingOrder.findById(imagingOrderId), session);
  if (!imagingOrder) throw createError('Không tìm thấy imaging order.', 404);
  return imagingOrder;
}

async function getImagingReportOrThrow(reportId, session = null) {
  const report = await withSession(ImagingReport.findById(reportId), session);
  if (!report) throw createError('Không tìm thấy imaging report.', 404);
  return report;
}

async function loadImagingOrderContext(imagingOrder, session = null) {
  const [order, encounter, patient] = await Promise.all([
    withSession(Order.findById(imagingOrder.order_id).lean(), session),
    withSession(Encounter.findById(imagingOrder.encounter_id).lean(), session),
    withSession(Patient.findById(imagingOrder.patient_id).lean(), session),
  ]);
  if (!order) throw createError('Không tìm thấy order mẹ của imaging order.', 409);
  if (!encounter) throw createError('Không tìm thấy encounter của imaging order.', 409);
  assertPatientActive(patient);
  return { order, encounter, patient };
}

async function loadReportContext(report, session = null) {
  const imagingOrder = await withSession(ImagingOrder.findById(report.imaging_order_id), session);
  if (!imagingOrder) throw createError('Không tìm thấy imaging order của report.', 409);
  const context = await loadImagingOrderContext(imagingOrder, session);
  return { imagingOrder, ...context };
}

function readAccessPermissions() {
  return {
    global: [
      PERMISSION.IMAGING_ORDERS.READ,
      PERMISSION.IMAGING_REPORTS.READ,
      PERMISSION.IMAGING_REPORTS.READ_FINAL,
      PERMISSION.ORDERS.READ,
      PERMISSION.ORDERS.READ_IMAGING,
    ],
    own: [
      PERMISSION.IMAGING_ORDERS.READ_OWN,
      PERMISSION.ORDERS.READ_OWN,
      PERMISSION.ENCOUNTERS.READ_OWN,
    ],
    department: [
      PERMISSION.ORDERS.READ_DEPARTMENT,
      PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    ],
  };
}

function writeAccessPermissions(extra = []) {
  return {
    global: [
      PERMISSION.IMAGING_ORDERS.READ,
      PERMISSION.IMAGING_REPORTS.WRITE,
      PERMISSION.ORDERS.READ_IMAGING,
      ...extra,
    ],
    own: [PERMISSION.IMAGING_ORDERS.READ_OWN],
    department: [PERMISSION.ORDERS.READ_DEPARTMENT],
  };
}

function assertImagingOrderAccess(imagingOrder, context, actor = {}, permissions = {}) {
  if (!actorType(actor)) return true;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;

  if (actorType(actor) === 'patient') {
    if (sameId(imagingOrder.patient_id, actor.patientId || actor.patient_id)) return true;
    throw createError('Bạn không có quyền xem dữ liệu CĐHA này.', 403);
  }

  if (hasAnyPermission(actor, permissions.global || [])) return true;

  if (
    actor.userId
    && (
      sameId(imagingOrder.ordered_by, actor.userId)
      || sameId(context?.encounter?.attending_doctor_id, actor.userId)
      || sameId(context?.order?.ordered_by, actor.userId)
    )
    && hasAnyPermission(actor, permissions.own || [])
  ) {
    return true;
  }

  const departmentId = actorDepartmentId(actor);
  if (
    departmentId
    && (
      sameId(context?.order?.department_id, departmentId)
      || sameId(context?.encounter?.department_id, departmentId)
    )
    && hasAnyPermission(actor, permissions.department || [])
  ) {
    return true;
  }

  throw createError('Bạn không có quyền thao tác imaging order này.', 403);
}

function assertEncounterReadAccess(encounter, actor = {}) {
  if (!actorType(actor)) return true;
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.ENCOUNTERS.READ, PERMISSION.ORDERS.READ, PERMISSION.IMAGING_ORDERS.READ])) return true;
  if (actor.userId && sameId(encounter.attending_doctor_id, actor.userId) && hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.READ_OWN, PERMISSION.ORDERS.READ_OWN, PERMISSION.IMAGING_ORDERS.READ_OWN])) return true;
  const departmentId = actorDepartmentId(actor);
  if (departmentId && sameId(encounter.department_id, departmentId) && hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.READ_DEPARTMENT, PERMISSION.ORDERS.READ_DEPARTMENT])) return true;
  throw createError('Bạn không có quyền xem imaging summary của encounter này.', 403);
}

async function updateOrderStatus(orderId, nextStatus, actor, session = null) {
  const order = await withSession(Order.findById(orderId), session);
  if (!order) throw createError('Không tìm thấy order mẹ.', 409);
  if (order.status === nextStatus) return order;
  assertTransition(ORDER_TRANSITIONS, order.status, nextStatus, 'order');
  order.status = nextStatus;
  order.updated_by = actor?.userId;
  await order.save(sessionOptions(session));
  return order;
}

async function updateImagingOrderStatus(imagingOrder, nextStatus, actor, session = null, extra = {}) {
  if (imagingOrder.status === nextStatus) return imagingOrder;
  assertTransition(IMAGING_ORDER_TRANSITIONS, imagingOrder.status, nextStatus, 'imaging_order');
  imagingOrder.status = nextStatus;
  if (nextStatus === IMAGING_ORDER_STATUS.SCHEDULED) {
    imagingOrder.scheduled_by = actor?.userId;
    imagingOrder.scheduled_at = extra.scheduled_at || imagingOrder.scheduled_at;
  }
  if (nextStatus === IMAGING_ORDER_STATUS.IN_PROGRESS) {
    imagingOrder.started_by = actor?.userId;
    imagingOrder.started_at = extra.started_at || new Date();
  }
  if (nextStatus === IMAGING_ORDER_STATUS.COMPLETED) {
    imagingOrder.completed_by = actor?.userId;
    imagingOrder.completed_at = extra.completed_at || new Date();
  }
  if (nextStatus === IMAGING_ORDER_STATUS.CANCELLED) {
    imagingOrder.cancelled_by = actor?.userId;
    imagingOrder.cancelled_at = new Date();
    imagingOrder.cancel_reason = extra.reason || imagingOrder.cancel_reason;
  }
  if (nextStatus === IMAGING_ORDER_STATUS.NO_SHOW) {
    imagingOrder.no_show_at = new Date();
    imagingOrder.no_show_reason = extra.reason || imagingOrder.no_show_reason;
  }
  imagingOrder.updated_by = actor?.userId;
  await imagingOrder.save(sessionOptions(session));
  return imagingOrder;
}

async function buildScopedOrderIds(query = {}, actor = {}) {
  const orderFilter = { order_type: ORDER_TYPE.IMAGING };
  if (query.department_id) orderFilter.department_id = query.department_id;

  if (actorType(actor) && !hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.IMAGING_ORDERS.READ, PERMISSION.IMAGING_REPORTS.READ, PERMISSION.ORDERS.READ, PERMISSION.ORDERS.READ_IMAGING])) {
    if (actor.userId && hasAnyPermission(actor, [PERMISSION.IMAGING_ORDERS.READ_OWN, PERMISSION.ORDERS.READ_OWN])) {
      orderFilter.ordered_by = actor.userId;
    } else if (actorDepartmentId(actor) && hasAnyPermission(actor, [PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_DEPARTMENT])) {
      orderFilter.department_id = actorDepartmentId(actor);
    } else {
      throw createError('Bạn không có quyền xem danh sách imaging order.', 403);
    }
  }

  if (orderFilter.department_id || orderFilter.ordered_by) {
    const orders = await Order.find(orderFilter).select('_id').lean();
    return orders.map((order) => order._id);
  }
  return null;
}

function applyDateRange(filter, query = {}, fieldName, fromKey = 'date_from', toKey = 'date_to') {
  if (query[fromKey] || query[toKey]) {
    filter[fieldName] = {};
    if (query[fromKey]) filter[fieldName].$gte = parseDate(query[fromKey], fromKey);
    if (query[toKey]) filter[fieldName].$lte = parseDate(query[toKey], toKey);
  }
}

async function listImagingOrders(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  for (const field of ['status', 'modality', 'priority', 'patient_id', 'encounter_id', 'ordered_by', 'body_part']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.contrast_required !== undefined) filter.contrast_required = String(query.contrast_required) === 'true';
  applyDateRange(filter, query, 'ordered_at');
  applyDateRange(filter, query, 'scheduled_at', 'scheduled_from', 'scheduled_to');

  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [
      { imaging_order_no: { $regex: keyword, $options: 'i' } },
      { modality: { $regex: keyword, $options: 'i' } },
      { body_part: { $regex: keyword, $options: 'i' } },
    ];
  }

  const scopedOrderIds = await buildScopedOrderIds(query, actor);
  if (scopedOrderIds) filter.order_id = { $in: scopedOrderIds };

  const [items, total] = await Promise.all([
    ImagingOrder.find(filter)
      .sort({ scheduled_at: 1, ordered_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('encounter_id', 'encounter_code encounter_type status start_time')
      .populate('ordered_by', 'full_name username employee_code')
      .populate('order_id', 'order_no status priority department_id ordered_at')
      .lean(),
    ImagingOrder.countDocuments(filter),
  ]);

  const reports = await ImagingReport.find({
    imaging_order_id: { $in: items.map((item) => item._id) },
  }).sort({ verified_at: -1, reported_at: -1, created_at: -1 }).lean();
  const reportByOrder = new Map();
  for (const report of reports) {
    const key = String(report.imaging_order_id);
    if (!reportByOrder.has(key)) reportByOrder.set(key, report);
  }

  return {
    items: items.map((item) => ({
      ...item,
      report_status: reportByOrder.get(String(item._id))?.status || null,
      report_id: reportByOrder.get(String(item._id))?._id || null,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

function getAllowedImagingOrderActions(imagingOrder, actor = {}) {
  return {
    can_schedule: imagingOrder.status === IMAGING_ORDER_STATUS.ORDERED && hasPermission(actor, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS),
    can_start: [IMAGING_ORDER_STATUS.ORDERED, IMAGING_ORDER_STATUS.SCHEDULED].includes(imagingOrder.status) && hasPermission(actor, PERMISSION.IMAGING_ORDERS.START),
    can_complete: imagingOrder.status === IMAGING_ORDER_STATUS.IN_PROGRESS && hasPermission(actor, PERMISSION.IMAGING_ORDERS.COMPLETE),
    can_cancel: !IMAGING_ORDER_TERMINAL_STATUSES.includes(imagingOrder.status) && hasAnyPermission(actor, [PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.ORDERS.CANCEL]),
    can_upload_attachment: ![IMAGING_ORDER_STATUS.CANCELLED, IMAGING_ORDER_STATUS.NO_SHOW].includes(imagingOrder.status) && hasAnyPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD]),
    can_create_report: imagingOrder.status === IMAGING_ORDER_STATUS.COMPLETED && hasPermission(actor, PERMISSION.IMAGING_REPORTS.CREATE),
  };
}

async function getImagingOrderDetail(imagingOrderId, actor = {}) {
  const imagingOrder = await ImagingOrder.findById(imagingOrderId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time')
    .populate('ordered_by', 'full_name username employee_code')
    .populate('order_id', 'order_no status priority department_id ordered_at clinical_indication charge_id')
    .populate('scheduled_by', 'full_name username employee_code')
    .populate('started_by', 'full_name username employee_code')
    .populate('completed_by', 'full_name username employee_code')
    .lean();
  if (!imagingOrder) throw createError('Không tìm thấy imaging order.', 404);

  const rawImagingOrder = await ImagingOrder.findById(imagingOrderId).lean();
  const context = await loadImagingOrderContext(rawImagingOrder);
  assertImagingOrderAccess(rawImagingOrder, context, actor, readAccessPermissions());

  const [reports, attachments, charge, logs] = await Promise.all([
    ImagingReport.find({ imaging_order_id: imagingOrderId }).sort({ verified_at: -1, reported_at: -1, created_at: -1 }).lean(),
    Attachment.find({
      order_id: context.order._id,
      status: { $in: ACTIVE_ATTACHMENT_STATUSES },
    }).sort({ created_at: -1 }).lean(),
    Charge.findOne({ order_id: context.order._id }).lean(),
    AuditLog.find({
      $or: [
        { target_type: 'imaging_order', target_id: imagingOrderId },
        { target_type: 'order', target_id: context.order._id },
      ],
    }).sort({ created_at: -1 }).limit(20).lean(),
  ]);

  return {
    imaging_order: imagingOrder,
    reports,
    attachments,
    charge,
    activity: logs,
    allowed_actions: getAllowedImagingOrderActions(rawImagingOrder, actor),
  };
}

async function scheduleImagingOrder(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE]);
  const scheduledAt = parseDate(payload.scheduled_at, 'scheduled_at');
  if (!scheduledAt) throw createError('scheduled_at là bắt buộc.');
  if (scheduledAt < new Date() && !payload.allow_past_schedule) throw createError('scheduled_at không được ở quá khứ.', 409);

  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.UPDATE_STATUS, PERMISSION.ORDERS.ACKNOWLEDGE]));
    if (context.order.status === ORDER_STATUS.CANCELLED || context.order.status === ORDER_STATUS.ENTERED_IN_ERROR) {
      throw createError('Order mẹ đã cancelled/entered_in_error.', 409);
    }
    if (imagingOrder.status !== IMAGING_ORDER_STATUS.ORDERED) throw createError('Chỉ imaging order ordered mới được schedule.', 409);
    imagingOrder.room_id = payload.room_id || imagingOrder.room_id;
    await updateImagingOrderStatus(imagingOrder, IMAGING_ORDER_STATUS.SCHEDULED, actor, session, { scheduled_at: scheduledAt });
    await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.ACKNOWLEDGED, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_order.scheduled', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Schedule imaging order thành công.', requestMeta, metadata: { scheduled_at: scheduledAt } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function checkContrastAllergyRisk(imagingOrder, payload = {}) {
  if (!imagingOrder.contrast_required) return [];
  const allergies = await Allergy.find({
    patient_id: imagingOrder.patient_id,
    allergy_type: ALLERGY_TYPE.CONTRAST,
    status: ALLERGY_STATUS.ACTIVE,
  }).lean();
  if (allergies.length === 0) return [];
  const hasHighRisk = allergies.some((item) => [ALLERGY_SEVERITY.SEVERE, ALLERGY_SEVERITY.LIFE_THREATENING].includes(item.severity));
  if (hasHighRisk && !payload.override_contrast_allergy) {
    throw createError('Bệnh nhân có allergy contrast mức cao. Cần override_contrast_allergy và reason trước khi start.', 409, {
      allergies,
    });
  }
  if (hasHighRisk && !nonEmpty(payload.override_reason)) {
    throw createError('override_reason là bắt buộc khi override contrast allergy.', 409);
  }
  return allergies.map((item) => ({
    allergy_id: item._id,
    allergen: item.allergen,
    severity: item.severity,
  }));
}

async function startImagingOrder(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.START, PERMISSION.ORDERS.START]);
  let warnings = [];
  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.START, PERMISSION.ORDERS.START]));
    if (![IMAGING_ORDER_STATUS.ORDERED, IMAGING_ORDER_STATUS.SCHEDULED].includes(imagingOrder.status)) {
      throw createError('Imaging order phải ordered/scheduled trước khi start.', 409);
    }
    warnings = await checkContrastAllergyRisk(imagingOrder, payload);
    await updateImagingOrderStatus(imagingOrder, IMAGING_ORDER_STATUS.IN_PROGRESS, actor, session, { started_at: new Date() });
    await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_order.started', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Start imaging order thành công.', requestMeta, metadata: { contrast_warnings: warnings, override_reason: payload.override_reason } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function completeImagingOrder(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.COMPLETE, PERMISSION.ORDERS.START]);
  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.COMPLETE, PERMISSION.ORDERS.START]));
    if (imagingOrder.status !== IMAGING_ORDER_STATUS.IN_PROGRESS) throw createError('Chỉ imaging order in_progress mới được complete kỹ thuật.', 409);
    if (payload.require_attachment) {
      const attachmentExists = await withSession(Attachment.exists({
        order_id: imagingOrder.order_id,
        status: ATTACHMENT_STATUS.ACTIVE,
      }), session);
      if (!attachmentExists) throw createError('Cần ít nhất một imaging attachment trước khi complete kỹ thuật.', 409);
    }
    await updateImagingOrderStatus(imagingOrder, IMAGING_ORDER_STATUS.COMPLETED, actor, session, { completed_at: new Date() });
    if (context.order.status !== ORDER_STATUS.IN_PROGRESS) {
      await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.IN_PROGRESS, actor, session);
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_order.completed', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Complete technical imaging order thành công. Order mẹ vẫn chờ report final.', requestMeta });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function voidChargeForImagingOrder(orderId, reason, actor, session = null) {
  const charges = await withSession(Charge.find({
    order_id: orderId,
    status: { $nin: [CHARGE_STATUS.VOIDED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.REFUNDED] },
  }), session);
  for (const charge of charges) {
    if (charge.invoice_id || charge.status === CHARGE_STATUS.BILLED) {
      throw createError('Imaging order đã có charge lên invoice, cần Billing Module xử lý adjustment.', 409);
    }
    charge.status = CHARGE_STATUS.VOIDED;
    charge.voided_by = actor?.userId;
    charge.voided_at = new Date();
    charge.void_reason = reason;
    charge.updated_by = actor?.userId;
    await charge.save(sessionOptions(session));
  }
  return charges.length;
}

async function cancelImagingOrder(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.ORDERS.CANCEL]);
  const reason = payload.reason || payload.cancel_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi cancel imaging order.');
  let voidedCharges = 0;

  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.ORDERS.CANCEL]));
    if (IMAGING_ORDER_TERMINAL_STATUSES.includes(imagingOrder.status)) throw createError('Imaging order đã ở trạng thái kết thúc.', 409);
    const finalReportExists = await withSession(ImagingReport.exists({
      imaging_order_id: imagingOrder._id,
      status: { $in: FINAL_REPORT_STATUSES },
    }), session);
    if (finalReportExists) throw createError('Imaging order đã có report final/amended, không thể cancel thường.', 409);
    if (imagingOrder.status === IMAGING_ORDER_STATUS.IN_PROGRESS && !payload.force) {
      throw createError('Imaging order đang in_progress, cần force/override để cancel.', 409);
    }
    voidedCharges = await voidChargeForImagingOrder(imagingOrder.order_id, reason, actor, session);
    await updateImagingOrderStatus(imagingOrder, IMAGING_ORDER_STATUS.CANCELLED, actor, session, { reason });
    await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.CANCELLED, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_order.cancelled', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Cancel imaging order thành công.', requestMeta, metadata: { reason, voided_charges: voidedCharges } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

async function markImagingOrderNoShow(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS]);
  const reason = payload.reason || payload.no_show_reason || 'no_show';
  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY, PERMISSION.IMAGING_ORDERS.UPDATE_STATUS]));
    if (![IMAGING_ORDER_STATUS.ORDERED, IMAGING_ORDER_STATUS.SCHEDULED].includes(imagingOrder.status)) {
      throw createError('Chỉ ordered/scheduled imaging order mới được mark no_show.', 409);
    }
    await updateImagingOrderStatus(imagingOrder, IMAGING_ORDER_STATUS.NO_SHOW, actor, session, { reason });
    await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.CANCELLED, actor, session);
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_order.no_show', targetType: 'imaging_order', targetId: imagingOrderId, status: 'success', message: 'Mark imaging order no_show thành công.', requestMeta, metadata: { reason } });
  return getImagingOrderDetail(imagingOrderId, actor);
}

function validateAttachmentPayload(payload = {}) {
  if (!nonEmpty(payload.file_name)) throw createError('file_name là bắt buộc.');
  if (!nonEmpty(payload.storage_path)) throw createError('storage_path là bắt buộc.');
  const fileSize = payload.file_size !== undefined ? Number(payload.file_size) : undefined;
  if (fileSize !== undefined && (!Number.isFinite(fileSize) || fileSize < 0)) throw createError('file_size không hợp lệ.');
  return {
    file_name: normalizeString(payload.file_name),
    original_name: payload.original_name ? normalizeString(payload.original_name) : undefined,
    mime_type: payload.mime_type ? normalizeString(payload.mime_type) : undefined,
    file_size: fileSize,
    storage_path: normalizeString(payload.storage_path),
    checksum: payload.checksum ? normalizeString(payload.checksum) : undefined,
    category: normalizeString(payload.category) || 'imaging_image',
    description: payload.description,
  };
}

async function uploadImagingAttachment(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD]);
  const normalized = validateAttachmentPayload(payload);
  let attachmentId;
  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.ATTACHMENTS.UPLOAD_IMAGING, PERMISSION.ATTACHMENTS.UPLOAD_IMAGING_REPORT, PERMISSION.ATTACHMENTS.UPLOAD]));
    if ([IMAGING_ORDER_STATUS.CANCELLED, IMAGING_ORDER_STATUS.NO_SHOW].includes(imagingOrder.status)) {
      throw createError('Không upload attachment vào imaging order cancelled/no_show.', 409);
    }
    if (normalized.checksum) {
      const duplicate = await withSession(Attachment.exists({
        order_id: imagingOrder.order_id,
        checksum: normalized.checksum,
        status: ATTACHMENT_STATUS.ACTIVE,
      }), session);
      if (duplicate) throw createError('Attachment checksum đã tồn tại cho imaging order này.', 409);
    }
    const [attachment] = await Attachment.create([{
      patient_id: imagingOrder.patient_id,
      encounter_id: imagingOrder.encounter_id,
      order_id: imagingOrder.order_id,
      entity_type: ATTACHMENT_ENTITY_TYPE.IMAGING_ORDER,
      entity_id: imagingOrder._id,
      uploaded_by: actor?.userId,
      ...normalized,
      status: ATTACHMENT_STATUS.ACTIVE,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    attachmentId = attachment._id;
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_attachment.uploaded', targetType: 'attachment', targetId: attachmentId, status: 'success', message: 'Upload imaging attachment thành công.', requestMeta, metadata: { imaging_order_id: String(imagingOrderId) } });
  return Attachment.findById(attachmentId).lean();
}

async function listImagingAttachments(imagingOrderId, actor = {}) {
  const imagingOrder = await ImagingOrder.findById(imagingOrderId).lean();
  if (!imagingOrder) throw createError('Không tìm thấy imaging order.', 404);
  const context = await loadImagingOrderContext(imagingOrder);
  assertImagingOrderAccess(imagingOrder, context, actor, readAccessPermissions());
  const attachments = await Attachment.find({
    order_id: imagingOrder.order_id,
    status: ATTACHMENT_STATUS.ACTIVE,
  }).sort({ created_at: -1 }).lean();
  return { items: attachments };
}

async function deleteImagingAttachment(attachmentId, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.ARCHIVE]);
  await withOptionalTransaction(async (session) => {
    const attachment = await withSession(Attachment.findById(attachmentId), session);
    if (!attachment) throw createError('Không tìm thấy attachment.', 404);
    if (attachment.status !== ATTACHMENT_STATUS.ACTIVE) throw createError('Attachment không active.', 409);
    const imagingOrder = await withSession(ImagingOrder.findOne({ order_id: attachment.order_id }), session);
    if (!imagingOrder) throw createError('Attachment không thuộc imaging order hợp lệ.', 409);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.ATTACHMENTS.DELETE_SOFT, PERMISSION.ATTACHMENTS.ARCHIVE]));
    attachment.status = ATTACHMENT_STATUS.DELETED;
    attachment.deleted_by = actor?.userId;
    attachment.deleted_at = new Date();
    attachment.updated_by = actor?.userId;
    await attachment.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({ actor, action: 'imaging_attachment.deleted', targetType: 'attachment', targetId: attachmentId, status: 'success', message: 'Soft delete imaging attachment thành công.', requestMeta });
  return { deleted: true };
}

function validateReportPayload(payload = {}, options = {}) {
  if (options.requireImpression && !nonEmpty(payload.impression)) throw createError('impression là bắt buộc khi finalize imaging report.', 409);
  return {
    technician_id: payload.technician_id || undefined,
    findings: payload.findings,
    impression: payload.impression,
    recommendation: payload.recommendation,
    is_critical: Boolean(payload.is_critical),
    critical_note: payload.critical_note,
    status: payload.status || IMAGING_REPORT_STATUS.DRAFT,
  };
}

async function createImagingReport(imagingOrderId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.IMAGING_REPORTS.CREATE);
  let reportId;
  await withOptionalTransaction(async (session) => {
    const imagingOrder = await getImagingOrderOrThrow(imagingOrderId, session);
    const context = await loadImagingOrderContext(imagingOrder, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.CREATE]));
    if (imagingOrder.status !== IMAGING_ORDER_STATUS.COMPLETED) {
      throw createError('Imaging order phải completed kỹ thuật trước khi tạo report.', 409);
    }
    const activeReport = await withSession(ImagingReport.exists({
      imaging_order_id: imagingOrder._id,
      status: { $in: [IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY, IMAGING_REPORT_STATUS.FINAL, IMAGING_REPORT_STATUS.AMENDED] },
    }), session);
    if (activeReport) throw createError('Imaging order đã có report active.', 409);
    const normalized = validateReportPayload(payload);
    const reportNo = payload.report_no || await generateImagingReportNumber({ session });
    const [report] = await ImagingReport.create([{
      imaging_order_id: imagingOrder._id,
      patient_id: imagingOrder.patient_id,
      report_no: reportNo,
      radiologist_id: actor?.userId,
      technician_id: normalized.technician_id,
      findings: normalized.findings,
      impression: normalized.impression,
      recommendation: normalized.recommendation,
      reported_at: normalized.status === IMAGING_REPORT_STATUS.PRELIMINARY ? new Date() : undefined,
      is_critical: normalized.is_critical,
      critical_note: normalized.critical_note,
      status: normalized.status === IMAGING_REPORT_STATUS.PRELIMINARY ? IMAGING_REPORT_STATUS.PRELIMINARY : IMAGING_REPORT_STATUS.DRAFT,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    reportId = report._id;
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_report.created', targetType: 'imaging_report', targetId: reportId, status: 'success', message: 'Tạo imaging report thành công.', requestMeta, metadata: { imaging_order_id: String(imagingOrderId) } });
  return getImagingReportDetail(reportId, actor);
}

async function getImagingReportDetail(reportId, actor = {}) {
  const report = await ImagingReport.findById(reportId)
    .populate('imaging_order_id', 'imaging_order_no order_id encounter_id modality body_part status')
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('radiologist_id', 'full_name username employee_code')
    .populate('technician_id', 'full_name username employee_code')
    .populate('verified_by', 'full_name username employee_code')
    .lean();
  if (!report) throw createError('Không tìm thấy imaging report.', 404);

  const rawReport = await ImagingReport.findById(reportId).lean();
  const { imagingOrder, ...context } = await loadReportContext(rawReport);
  if (actorType(actor) === 'patient') {
    if (!sameId(rawReport.patient_id, actor.patientId || actor.patient_id)) throw createError('Bạn không có quyền xem report này.', 403);
    if (!rawReport.released_to_patient || !FINAL_REPORT_STATUSES.includes(rawReport.status)) {
      throw createError('Report chưa được release cho patient portal.', 403);
    }
  } else {
    assertImagingOrderAccess(imagingOrder, context, actor, readAccessPermissions());
  }

  const attachments = await Attachment.find({
    $or: [
      { entity_type: ATTACHMENT_ENTITY_TYPE.IMAGING_REPORT, entity_id: rawReport._id },
      { order_id: imagingOrder.order_id },
    ],
    status: ATTACHMENT_STATUS.ACTIVE,
  }).sort({ created_at: -1 }).lean();

  return {
    report,
    attachments: attachments.map((attachment) => sanitizeAttachmentForActor(attachment, actor)),
  };
}

async function buildScopedReportFilter(query = {}, actor = {}) {
  const filter = {};
  for (const field of ['patient_id', 'imaging_order_id', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  applyDateRange(filter, query, 'reported_at');

  if (query.encounter_id) {
    const imagingOrders = await ImagingOrder.find({ encounter_id: query.encounter_id }).select('_id').lean();
    filter.imaging_order_id = { $in: imagingOrders.map((order) => order._id) };
  }

  if (actorType(actor) === 'patient') {
    filter.patient_id = actor.patientId || actor.patient_id;
    filter.released_to_patient = true;
    filter.status = { $in: FINAL_REPORT_STATUSES };
    return filter;
  }

  if (!actorType(actor)) return filter;
  if (hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.IMAGING_REPORTS.READ, PERMISSION.IMAGING_REPORTS.READ_FINAL, PERMISSION.IMAGING_ORDERS.READ, PERMISSION.ORDERS.READ_IMAGING, PERMISSION.ORDERS.READ])) {
    return filter;
  }

  if (actor.userId && hasAnyPermission(actor, [PERMISSION.IMAGING_ORDERS.READ_OWN, PERMISSION.ORDERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_OWN])) {
    const imagingOrders = await ImagingOrder.find({ ordered_by: actor.userId }).select('_id').lean();
    filter.imaging_order_id = { $in: imagingOrders.map((order) => order._id) };
    return filter;
  }

  const departmentId = actorDepartmentId(actor);
  if (departmentId && hasAnyPermission(actor, [PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ_DEPARTMENT])) {
    const orders = await Order.find({ order_type: ORDER_TYPE.IMAGING, department_id: departmentId }).select('_id').lean();
    const imagingOrders = await ImagingOrder.find({ order_id: { $in: orders.map((order) => order._id) } }).select('_id').lean();
    filter.imaging_order_id = { $in: imagingOrders.map((order) => order._id) };
    return filter;
  }

  throw createError('Bạn không có quyền xem imaging reports.', 403);
}

async function listImagingReports(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = await buildScopedReportFilter(query, actor);
  const [items, total] = await Promise.all([
    ImagingReport.find(filter)
      .sort({ reported_at: -1, verified_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('imaging_order_id', 'imaging_order_no modality body_part status encounter_id order_id')
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('radiologist_id', 'full_name username employee_code')
      .populate('verified_by', 'full_name username employee_code')
      .lean(),
    ImagingReport.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function updateImagingReport(reportId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.UPDATE_OWN]);
  await withOptionalTransaction(async (session) => {
    const report = await getImagingReportOrThrow(reportId, session);
    const { imagingOrder, ...context } = await loadReportContext(report, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.WRITE, PERMISSION.IMAGING_REPORTS.UPDATE_OWN]));
    if (![IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY].includes(report.status)) {
      throw createError('Final/amended report không sửa trực tiếp, phải amend.', 409);
    }
    if (!sameId(report.radiologist_id, actor?.userId) && !hasPermission(actor, PERMISSION.IMAGING_REPORTS.WRITE)) {
      throw createError('Chỉ radiologist tạo report hoặc người có quyền write mới được sửa.', 403);
    }
    const before = report.toObject();
    const normalized = validateReportPayload(payload);
    if (payload.findings !== undefined) report.findings = normalized.findings;
    if (payload.impression !== undefined) report.impression = normalized.impression;
    if (payload.recommendation !== undefined) report.recommendation = normalized.recommendation;
    if (payload.is_critical !== undefined) report.is_critical = normalized.is_critical;
    if (payload.critical_note !== undefined) report.critical_note = normalized.critical_note;
    if (payload.status === IMAGING_REPORT_STATUS.PRELIMINARY && report.status === IMAGING_REPORT_STATUS.DRAFT) {
      assertTransition(IMAGING_REPORT_TRANSITIONS, report.status, IMAGING_REPORT_STATUS.PRELIMINARY, 'imaging_report');
      report.status = IMAGING_REPORT_STATUS.PRELIMINARY;
      report.reported_at = report.reported_at || new Date();
    }
    report.updated_by = actor?.userId;
    await report.save(sessionOptions(session));
    await recordAuditLog({ actor, action: 'imaging_report.updated', targetType: 'imaging_report', targetId: report._id, status: 'success', message: 'Cập nhật imaging report thành công.', requestMeta, before, after: report.toObject() });
  }, { fallbackToNoTransaction: true });
  return getImagingReportDetail(reportId, actor);
}

async function validateImagingReportBeforeFinalize(reportId, actor = {}, session = null) {
  assertStaffPermission(actor, PERMISSION.IMAGING_REPORTS.FINALIZE);
  const report = await getImagingReportOrThrow(reportId, session);
  const { imagingOrder, ...context } = await loadReportContext(report, session);
  assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.FINALIZE]));
  if (![IMAGING_REPORT_STATUS.DRAFT, IMAGING_REPORT_STATUS.PRELIMINARY].includes(report.status)) {
    throw createError('Chỉ draft/preliminary report mới được finalize.', 409);
  }
  if (imagingOrder.status !== IMAGING_ORDER_STATUS.COMPLETED) {
    throw createError('Imaging order phải completed kỹ thuật trước khi finalize report.', 409);
  }
  if (!nonEmpty(report.impression)) throw createError('impression là bắt buộc khi finalize imaging report.', 409);
  return {
    report,
    imagingOrder,
    context,
    warnings: report.is_critical ? [{ code: 'critical_imaging_finding', message: 'Report được đánh dấu critical.' }] : [],
  };
}

async function finalizeImagingReport(reportId, actor, requestMeta = {}) {
  let critical = false;
  await withOptionalTransaction(async (session) => {
    const validation = await validateImagingReportBeforeFinalize(reportId, actor, session);
    const before = validation.report.toObject();
    assertTransition(IMAGING_REPORT_TRANSITIONS, validation.report.status, IMAGING_REPORT_STATUS.FINAL, 'imaging_report');
    validation.report.status = IMAGING_REPORT_STATUS.FINAL;
    validation.report.verified_by = actor?.userId;
    validation.report.verified_at = new Date();
    validation.report.reported_at = validation.report.reported_at || new Date();
    validation.report.updated_by = actor?.userId;
    if (validation.report.is_critical) validation.report.critical_notified_at = new Date();
    await validation.report.save(sessionOptions(session));
    await updateOrderStatus(validation.imagingOrder.order_id, ORDER_STATUS.COMPLETED, actor, session);
    critical = validation.report.is_critical;
    await recordAuditLog({ actor, action: 'imaging_report.finalized', targetType: 'imaging_report', targetId: validation.report._id, status: 'success', message: 'Finalize imaging report thành công.', requestMeta, before, after: validation.report.toObject(), metadata: { warnings: validation.warnings } });
  }, { fallbackToNoTransaction: true });

  await notifyDoctorImagingFinal(reportId, actor, { critical });
  return getImagingReportDetail(reportId, actor);
}

async function amendImagingReport(reportId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.IMAGING_REPORTS.AMEND);
  const reason = payload.reason || payload.amend_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi amend imaging report.');

  await withOptionalTransaction(async (session) => {
    const report = await getImagingReportOrThrow(reportId, session);
    const { imagingOrder, ...context } = await loadReportContext(report, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.AMEND]));
    if (!FINAL_REPORT_STATUSES.includes(report.status)) throw createError('Chỉ final/amended report mới được amend.', 409);
    const before = report.toObject();
    if (report.status !== IMAGING_REPORT_STATUS.AMENDED) {
      assertTransition(IMAGING_REPORT_TRANSITIONS, report.status, IMAGING_REPORT_STATUS.AMENDED, 'imaging_report');
    }
    if (payload.findings !== undefined) report.findings = payload.findings;
    if (payload.impression !== undefined) report.impression = payload.impression;
    if (!nonEmpty(report.impression)) throw createError('impression là bắt buộc sau amend.', 409);
    if (payload.recommendation !== undefined) report.recommendation = payload.recommendation;
    if (payload.is_critical !== undefined) report.is_critical = Boolean(payload.is_critical);
    if (payload.critical_note !== undefined) report.critical_note = payload.critical_note;
    report.status = IMAGING_REPORT_STATUS.AMENDED;
    report.amended_by = actor?.userId;
    report.amended_at = new Date();
    report.amend_reason = reason;
    report.verified_by = actor?.userId;
    report.verified_at = new Date();
    report.updated_by = actor?.userId;
    if (report.is_critical && !report.critical_notified_at) report.critical_notified_at = new Date();
    await report.save(sessionOptions(session));
    if (context.order.status !== ORDER_STATUS.COMPLETED) {
      await updateOrderStatus(imagingOrder.order_id, ORDER_STATUS.COMPLETED, actor, session);
    }
    await recordAuditLog({ actor, action: 'imaging_report.amended', targetType: 'imaging_report', targetId: report._id, status: 'success', message: 'Amend imaging report thành công.', requestMeta, before, after: report.toObject(), metadata: { reason } });
  }, { fallbackToNoTransaction: true });

  await notifyDoctorImagingFinal(reportId, actor, { amended: true });
  return getImagingReportDetail(reportId, actor);
}

async function cancelImagingReport(reportId, payload = {}, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.IMAGING_REPORTS.CANCEL);
  const reason = payload.reason || payload.cancel_reason;
  if (!nonEmpty(reason)) throw createError('reason là bắt buộc khi cancel imaging report.');

  await withOptionalTransaction(async (session) => {
    const report = await getImagingReportOrThrow(reportId, session);
    const { imagingOrder, ...context } = await loadReportContext(report, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.CANCEL]));
    if (report.status === IMAGING_REPORT_STATUS.CANCELLED) throw createError('Report đã cancelled.', 409);
    if (FINAL_REPORT_STATUSES.includes(report.status)) {
      throw createError('Không cancel report final/amended bằng flow thường. Hãy dùng amend/correction để không lệch trạng thái order.', 409);
    }
    assertTransition(IMAGING_REPORT_TRANSITIONS, report.status, IMAGING_REPORT_STATUS.CANCELLED, 'imaging_report');
    report.status = IMAGING_REPORT_STATUS.CANCELLED;
    report.cancelled_by = actor?.userId;
    report.cancelled_at = new Date();
    report.cancel_reason = reason;
    report.updated_by = actor?.userId;
    await report.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'imaging_report.cancelled', targetType: 'imaging_report', targetId: reportId, status: 'success', message: 'Cancel imaging report thành công.', requestMeta, metadata: { reason } });
  return getImagingReportDetail(reportId, actor);
}

async function notifyDoctorImagingFinal(reportId, actor = {}, options = {}) {
  return notificationService.notifyImagingReportFinal(reportId, actor, options);
}

async function releaseImagingReportToPatient(reportId, actor, requestMeta = {}) {
  assertStaffPermission(actor, PERMISSION.IMAGING_REPORTS.RELEASE_TO_PATIENT);
  await withOptionalTransaction(async (session) => {
    const report = await getImagingReportOrThrow(reportId, session);
    const { imagingOrder, ...context } = await loadReportContext(report, session);
    assertImagingOrderAccess(imagingOrder, context, actor, writeAccessPermissions([PERMISSION.IMAGING_REPORTS.RELEASE_TO_PATIENT]));
    if (!FINAL_REPORT_STATUSES.includes(report.status)) throw createError('Chỉ final/amended report mới được release cho patient.', 409);
    report.released_to_patient = true;
    report.released_at = new Date();
    report.released_by = actor?.userId;
    report.updated_by = actor?.userId;
    await report.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });

  const report = await ImagingReport.findById(reportId).lean();
  await notificationService.notifyImagingReportFinal(report._id, actor, { released: true, patient_only: true });

  await recordAuditLog({ actor, action: 'imaging_report.released_to_patient', targetType: 'imaging_report', targetId: reportId, status: 'success', message: 'Release imaging report cho patient thành công.', requestMeta });
  return getImagingReportDetail(reportId, actor);
}

async function acknowledgeCriticalImagingReport(reportId, actor, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.IMAGING_REPORTS.CRITICAL_ACKNOWLEDGE, PERMISSION.IMAGING_REPORTS.READ_FINAL]);
  await withOptionalTransaction(async (session) => {
    const report = await getImagingReportOrThrow(reportId, session);
    const { imagingOrder, ...context } = await loadReportContext(report, session);
    assertImagingOrderAccess(imagingOrder, context, actor, readAccessPermissions());
    if (!report.is_critical) throw createError('Report không phải critical.', 409);
    report.critical_acknowledged_by = actor?.userId;
    report.critical_acknowledged_at = new Date();
    report.updated_by = actor?.userId;
    await report.save(sessionOptions(session));
  }, { fallbackToNoTransaction: true });
  await recordAuditLog({ actor, action: 'imaging_report.critical_acknowledged', targetType: 'imaging_report', targetId: reportId, status: 'success', message: 'Acknowledge critical imaging report thành công.', requestMeta });
  return getImagingReportDetail(reportId, actor);
}

async function getMyImagingReports(actor = {}, query = {}) {
  if (actorType(actor) !== 'patient') throw createError('Chỉ patient được gọi API này.', 403);
  if (!hasPermission(actor, PERMISSION.IMAGING_REPORTS.SELF_READ_RELEASED)) throw createError('Bạn không có quyền xem imaging reports.', 403);
  return listImagingReports(query, actor);
}

async function getEncounterImagingSummary(encounterId, actor = {}) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  assertEncounterReadAccess(encounter, actor);
  const rows = await ImagingOrder.aggregate([
    { $match: { encounter_id: encounter._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const reports = await ImagingReport.aggregate([
    {
      $lookup: {
        from: 'imaging_orders',
        localField: 'imaging_order_id',
        foreignField: '_id',
        as: 'imaging_order',
      },
    },
    { $unwind: '$imaging_order' },
    { $match: { 'imaging_order.encounter_id': encounter._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byStatus = {};
  const reportByStatus = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row._id] = row.count;
    total += row.count;
  }
  for (const row of reports) reportByStatus[row._id] = row.count;
  return {
    encounter_id: encounterId,
    total_imaging_orders: total,
    by_status: byStatus,
    report_by_status: reportByStatus,
  };
}

async function getImagingTimeline(imagingOrderId, actor = {}) {
  const detail = await getImagingOrderDetail(imagingOrderId, actor);
  const reportIds = (detail.reports || []).map((report) => report._id);
  const attachmentIds = (detail.attachments || []).map((attachment) => attachment._id);
  const logs = await AuditLog.find({
    $or: [
      { target_type: 'imaging_order', target_id: imagingOrderId },
      { target_type: 'imaging_report', target_id: { $in: reportIds } },
      { target_type: 'attachment', target_id: { $in: attachmentIds } },
      { target_type: 'order', target_id: detail.imaging_order.order_id?._id || detail.imaging_order.order_id },
    ],
  }).sort({ created_at: 1 }).lean();
  return {
    imaging_order_id: imagingOrderId,
    events: logs.map((log) => ({
      event_type: log.action,
      event_time: log.created_at,
      module: 'imaging',
      title: log.message || log.action,
      actor_type: log.actor_type,
      actor_id: log.actor_id,
      entity_type: log.target_type,
      entity_id: log.target_id,
      metadata: log.metadata,
    })),
  };
}

module.exports = {
  // generateImagingReportNumber: Sinh/tạo mã báo cáo chẩn đoán hình ảnh.
  generateImagingReportNumber,
  // listImagingOrders: Liệt kê chỉ định chẩn đoán hình ảnh.
  listImagingOrders,
  // getImagingOrderDetail: Lấy chi tiết chỉ định chẩn đoán hình ảnh.
  getImagingOrderDetail,
  // scheduleImagingOrder: Lên lịch cho chẩn đoán hình ảnh y lệnh.
  scheduleImagingOrder,
  // startImagingOrder: Bắt đầu chẩn đoán hình ảnh y lệnh.
  startImagingOrder,
  // completeImagingOrder: Hoàn tất chẩn đoán hình ảnh y lệnh.
  completeImagingOrder,
  // cancelImagingOrder: Hủy chẩn đoán hình ảnh y lệnh.
  cancelImagingOrder,
  // markImagingOrderNoShow: Đánh dấu ca chẩn đoán hình ảnh là bệnh nhân vắng mặt.
  markImagingOrderNoShow,
  // checkContrastAllergyRisk: Kiểm tra rủi ro dị ứng thuốc cản quang.
  checkContrastAllergyRisk,
  // uploadImagingAttachment: Tải lên tệp đính kèm chẩn đoán hình ảnh.
  uploadImagingAttachment,
  // listImagingAttachments: Liệt kê tệp đính kèm chẩn đoán hình ảnh.
  listImagingAttachments,
  // deleteImagingAttachment: Xóa tệp đính kèm chẩn đoán hình ảnh.
  deleteImagingAttachment,
  // createImagingReport: Tạo báo cáo chẩn đoán hình ảnh.
  createImagingReport,
  // getImagingReportDetail: Lấy chi tiết báo cáo chẩn đoán hình ảnh.
  getImagingReportDetail,
  // listImagingReports: Liệt kê báo cáo chẩn đoán hình ảnh.
  listImagingReports,
  // updateImagingReport: Cập nhật báo cáo chẩn đoán hình ảnh.
  updateImagingReport,
  // validateImagingReportBeforeFinalize: Kiểm tra tính hợp lệ của báo cáo chẩn đoán hình ảnh trước khi hoàn tất.
  validateImagingReportBeforeFinalize,
  // finalizeImagingReport: Hoàn tất báo cáo chẩn đoán hình ảnh.
  finalizeImagingReport,
  // amendImagingReport: Sửa đổi/bổ sung báo cáo chẩn đoán hình ảnh.
  amendImagingReport,
  // cancelImagingReport: Hủy báo cáo chẩn đoán hình ảnh.
  cancelImagingReport,
  // notifyDoctorImagingFinal: Gửi thông báo kết quả chẩn đoán hình ảnh cuối cùng cho bác sĩ.
  notifyDoctorImagingFinal,
  // releaseImagingReportToPatient: Phát hành báo cáo chẩn đoán hình ảnh cho bệnh nhân.
  releaseImagingReportToPatient,
  // acknowledgeCriticalImagingReport: Ghi nhận đã tiếp nhận báo cáo chẩn đoán hình ảnh nghiêm trọng.
  acknowledgeCriticalImagingReport,
  // getMyImagingReports: Lấy báo cáo chẩn đoán hình ảnh của người dùng hiện tại.
  getMyImagingReports,
  // getEncounterImagingSummary: Lấy tổng hợp chẩn đoán hình ảnh của lượt khám.
  getEncounterImagingSummary,
  // getImagingTimeline: Lấy dòng thời gian chẩn đoán hình ảnh.
  getImagingTimeline,
};
