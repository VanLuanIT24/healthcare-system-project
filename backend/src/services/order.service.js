const {
  Allergy,
  AuditLog,
  Charge,
  Encounter,
  ImagingOrder,
  ImagingReport,
  LabOrder,
  MedicationMaster,
  Order,
  Patient,
  Prescription,
  PrescriptionItem,
  ProcedureOrder,
  ServiceCatalog,
} = require('../models');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const {
  ALLERGY_SEVERITY,
  ALLERGY_STATUS,
  ALLERGY_TYPE,
  CHARGE_STATUS,
  ENCOUNTER_STATUS,
  IMAGING_MODALITIES,
  IMAGING_ORDER_STATUS,
  IMAGING_REPORT_STATUS,
  LAB_ORDER_STATUS,
  MEDICATION_STATUS,
  ORDER_PRIORITY,
  ORDER_PRIORITIES,
  ORDER_STATUS,
  ORDER_STATUSES,
  ORDER_TYPE,
  ORDER_TYPES,
  PRESCRIPTION_STATUS,
  PRESCRIPTION_STATUSES,
  PROCEDURE_STATUS,
  SERVICE_STATUS,
  SERVICE_TYPE,
} = require('../constants/statuses');
const {
  IMAGING_ORDER_TRANSITIONS,
  LAB_ORDER_TRANSITIONS,
  ORDER_TRANSITIONS,
  PROCEDURE_TRANSITIONS,
} = require('../constants/transitions');
const { PERMISSION, ROLE_CODE } = require('../constants/permissions');
const permissionService = require('./permission.service');
const { assertTransition, canTransition } = require('../shared/utils/status-transition');
const { withOptionalTransaction } = require('../shared/utils/transaction');

const ENCOUNTER_CAN_RECEIVE_ORDER_STATUSES = [
  ENCOUNTER_STATUS.ARRIVED,
  ENCOUNTER_STATUS.IN_PROGRESS,
  ENCOUNTER_STATUS.ON_HOLD,
];

const ORDER_TERMINAL_STATUSES = [
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.ENTERED_IN_ERROR,
];

const ORDER_EDITABLE_STATUSES = [
  ORDER_STATUS.DRAFT,
  ORDER_STATUS.ORDERED,
];

const INITIAL_CHILD_STATUS_BY_TYPE = {
  [ORDER_TYPE.LAB]: LAB_ORDER_STATUS.ORDERED,
  [ORDER_TYPE.IMAGING]: IMAGING_ORDER_STATUS.ORDERED,
  [ORDER_TYPE.PROCEDURE]: PROCEDURE_STATUS.ORDERED,
};

const CHILD_CANCEL_TRANSITIONS = {
  [ORDER_TYPE.LAB]: LAB_ORDER_TRANSITIONS,
  [ORDER_TYPE.IMAGING]: IMAGING_ORDER_TRANSITIONS,
  [ORDER_TYPE.PROCEDURE]: PROCEDURE_TRANSITIONS,
};

const TYPE_READ_PERMISSION = {
  [ORDER_TYPE.LAB]: PERMISSION.ORDERS.READ_LAB,
  [ORDER_TYPE.IMAGING]: PERMISSION.ORDERS.READ_IMAGING,
  [ORDER_TYPE.PROCEDURE]: PERMISSION.ORDERS.READ_PROCEDURE,
  [ORDER_TYPE.MEDICATION]: PERMISSION.ORDERS.READ_MEDICATION,
  [ORDER_TYPE.SERVICE]: PERMISSION.ORDERS.READ_SERVICE,
};

const TYPE_CREATE_PERMISSION = {
  [ORDER_TYPE.LAB]: PERMISSION.ORDERS.CREATE_LAB,
  [ORDER_TYPE.IMAGING]: PERMISSION.ORDERS.CREATE_IMAGING,
  [ORDER_TYPE.PROCEDURE]: PERMISSION.ORDERS.CREATE_PROCEDURE,
  [ORDER_TYPE.MEDICATION]: PERMISSION.ORDERS.CREATE_MEDICATION,
  [ORDER_TYPE.SERVICE]: PERMISSION.ORDERS.CREATE_SERVICE,
};

const TYPE_WORKFLOW_PERMISSIONS = {
  [ORDER_TYPE.LAB]: [
    PERMISSION.LAB_ORDERS.ACKNOWLEDGE,
    PERMISSION.LAB_ORDERS.PROCESS,
    PERMISSION.LAB_ORDERS.UPDATE_STATUS,
  ],
  [ORDER_TYPE.IMAGING]: [
    PERMISSION.IMAGING_ORDERS.START,
    PERMISSION.IMAGING_ORDERS.COMPLETE,
    PERMISSION.IMAGING_ORDERS.UPDATE_STATUS,
    PERMISSION.IMAGING_ORDERS.CANCEL_BY_POLICY,
  ],
  [ORDER_TYPE.PROCEDURE]: [
    PERMISSION.PROCEDURE_ORDERS.SCHEDULE,
    PERMISSION.PROCEDURE_ORDERS.START,
    PERMISSION.PROCEDURE_ORDERS.UPDATE,
    PERMISSION.PROCEDURE_ORDERS.COMPLETE,
    PERMISSION.PROCEDURE_ORDERS.CANCEL,
  ],
  [ORDER_TYPE.MEDICATION]: [
    PERMISSION.PRESCRIPTIONS.VERIFY,
    PERMISSION.PRESCRIPTIONS.CANCEL_BY_POLICY,
  ],
};

const SERVICE_TYPE_BY_ORDER_TYPE = {
  [ORDER_TYPE.LAB]: SERVICE_TYPE.LAB,
  [ORDER_TYPE.IMAGING]: SERVICE_TYPE.IMAGING,
  [ORDER_TYPE.PROCEDURE]: SERVICE_TYPE.PROCEDURE,
  [ORDER_TYPE.MEDICATION]: SERVICE_TYPE.PHARMACY,
  [ORDER_TYPE.SERVICE]: null,
  [ORDER_TYPE.NURSING]: SERVICE_TYPE.NURSING,
  [ORDER_TYPE.OTHER]: SERVICE_TYPE.OTHER,
};

const COMMON_CREATE_ORDER_FIELDS = new Set([
  'encounter_id',
  'admission_id',
  'department_id',
  'ordered_by',
  'order_no',
  'order_type',
  'priority',
  'service_id',
  'clinical_indication',
  'requested_at',
  'ordered_at',
  'save_as_draft',
  'dispatch_draft',
  'create_charge_on_order',
  'charge_policy',
  'quantity',
  'discount_amount',
  'tax_amount',
  'charge_no',
  'charge_description',
  'confirm_safety_warning',
  'override_safety_warning',
]);

const ORDER_TYPE_ALLOWED_FIELDS = {
  [ORDER_TYPE.LAB]: new Set(['lab_order_no', 'test_code', 'test_name', 'specimen_type', 'clinical_note']),
  [ORDER_TYPE.IMAGING]: new Set(['imaging_order_no', 'modality', 'body_part', 'contrast_required']),
  [ORDER_TYPE.PROCEDURE]: new Set(['procedure_order_no', 'performer_id', 'procedure_code', 'procedure_name', 'scheduled_start', 'scheduled_end']),
  [ORDER_TYPE.MEDICATION]: new Set(['prescription_no', 'prescription_note', 'note', 'prescription_status', 'prescription_items']),
  [ORDER_TYPE.SERVICE]: new Set([]),
  [ORDER_TYPE.NURSING]: new Set([]),
  [ORDER_TYPE.OTHER]: new Set([]),
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

function hasRole(actor = {}, roleCode) {
  return (actor.roles || []).includes(roleCode)
    || (actor.roleDetails || []).some((role) => role.role_code === roleCode);
}

function assertActorUser(actor = {}) {
  if (!actor?.userId) throw createError('Actor hiện tại không phải staff user hợp lệ.', 403);
}

function normalizeString(value) {
  return String(value || '').trim();
}

function nonEmpty(value) {
  return normalizeString(value).length > 0;
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

function ensureEnum(value, allowedValues, fieldName) {
  if (value !== undefined && value !== null && value !== '' && !allowedValues.includes(value)) {
    throw createError(`${fieldName} không hợp lệ.`);
  }
}

function assertNoUnsupportedOrderFields(orderType, payload = {}) {
  const allowed = new Set([
    ...COMMON_CREATE_ORDER_FIELDS,
    ...(ORDER_TYPE_ALLOWED_FIELDS[orderType] || []),
  ]);
  const unsupported = Object.keys(payload).filter((field) => !allowed.has(field));
  if (unsupported.length > 0) {
    throw createError(`Payload có field không hỗ trợ với order_type ${orderType}: ${unsupported.join(', ')}.`);
  }
}

function addScopedFilterValue(filter, field, value, message) {
  if (filter[field] && !sameId(filter[field], value)) {
    throw createError(message, 403);
  }
  filter[field] = value;
}

function orderWithinActorScope(order, actor = {}, options = {}) {
  const { allowOwn = true, allowDepartment = true } = options;
  if (!actorType(actor)) return true;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (allowOwn && actor.userId && sameId(order.ordered_by, actor.userId)) return true;
  const departmentId = actorDepartmentId(actor);
  if (allowDepartment && departmentId && sameId(order.department_id, departmentId)) return true;
  return false;
}

function assertOrderScopedPermission(order, actor = {}, permissionCodes = [], message = 'Bạn không có quyền thao tác order này.') {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (!hasAnyPermission(actor, permissionCodes)) return false;
  if (!actorDepartmentId(actor)) return true;
  if (!orderWithinActorScope(order, actor)) throw createError(message, 403);
  return true;
}

function assertChildMatchesOrder(child, order, childName = 'order con') {
  if (!child) return;
  if (!sameId(child.order_id, order._id)) throw createError(`${childName} không thuộc parent order.`, 409);
  if (!sameId(child.patient_id, order.patient_id)) throw createError(`${childName} không cùng patient với parent order.`, 409);
  if (!sameId(child.encounter_id, order.encounter_id)) throw createError(`${childName} không cùng encounter với parent order.`, 409);
  if (child.ordered_by && !sameId(child.ordered_by, order.ordered_by)) throw createError(`${childName} không cùng bác sĩ chỉ định với parent order.`, 409);
  if (child.requested_by && !sameId(child.requested_by, order.ordered_by)) throw createError(`${childName} không cùng bác sĩ yêu cầu với parent order.`, 409);
  if (child.prescribed_by && !sameId(child.prescribed_by, order.ordered_by)) throw createError(`${childName} không cùng bác sĩ kê đơn với parent order.`, 409);
  if (child.department_id && order.department_id && !sameId(child.department_id, order.department_id)) throw createError(`${childName} không cùng khoa với parent order.`, 409);
}

function assertOrderStatusActionPermission(order, nextStatus, actor = {}) {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return;
  const permissionByStatus = {
    [ORDER_STATUS.ACKNOWLEDGED]: PERMISSION.ORDERS.ACKNOWLEDGE,
    [ORDER_STATUS.IN_PROGRESS]: PERMISSION.ORDERS.START,
    [ORDER_STATUS.COMPLETED]: PERMISSION.ORDERS.COMPLETE,
  };
  const requiredPermission = permissionByStatus[nextStatus];
  if (!requiredPermission) return;
  if (hasPermission(actor, requiredPermission)) return;
  if (hasAnyPermission(actor, TYPE_WORKFLOW_PERMISSIONS[order.order_type] || [])) return;
  throw createError('Bạn không có quyền chuyển trạng thái order này.', 403);
}

function canSeeOrderTimelineMetadata(actor = {}) {
  return hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.ORDERS.TIMELINE_READ,
  ]);
}

function sanitizeOrderTimelineMetadata(metadata, actor = {}) {
  if (!metadata || !canSeeOrderTimelineMetadata(actor)) return undefined;
  const allowed = {};
  for (const field of ['order_id', 'lab_order_id', 'imaging_order_id', 'procedure_order_id', 'prescription_id', 'charge_id', 'reason', 'voided_charges', 'warnings']) {
    if (metadata[field] !== undefined) allowed[field] = metadata[field];
  }
  return Object.keys(allowed).length > 0 ? allowed : undefined;
}

async function recordOrderFailure({ actor, action, targetId, requestMeta, error, metadata = {} }) {
  try {
    await recordAuditLog({
      actor,
      action,
      targetType: 'order',
      targetId,
      status: 'failure',
      message: error?.message || 'Order action failed.',
      requestMeta,
      metadata: {
        ...metadata,
        error_name: error?.name,
        error_code: error?.code,
      },
    });
  } catch (_) {
    // Best-effort audit must not mask the original business error.
  }
}

function orderFailureAuditContext(methodName, args = []) {
  const configs = {
    createOrder: { action: 'order.create', actorIndex: 2, requestMetaIndex: 3, targetIndex: null },
    updateOrder: { action: 'order.update', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    dispatchExistingOrder: { action: 'order.dispatch', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    acknowledgeOrder: { action: 'order.acknowledge', actorIndex: 1, requestMetaIndex: 2, targetIndex: 0 },
    startOrder: { action: 'order.start', actorIndex: 1, requestMetaIndex: 2, targetIndex: 0 },
    completeOrder: { action: 'order.complete', actorIndex: 1, requestMetaIndex: 2, targetIndex: 0 },
    cancelOrder: { action: 'order.cancel', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    markOrderEnteredInError: { action: 'order.entered_in_error', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
    createChargeForExistingOrder: { action: 'order.charge_create', actorIndex: 2, requestMetaIndex: 3, targetIndex: 0 },
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

function withOrderFailureAudits(serviceExports) {
  return Object.fromEntries(Object.entries(serviceExports).map(([methodName, method]) => {
    if (typeof method !== 'function') return [methodName, method];
    const config = orderFailureAuditContext(methodName, []);
    if (!config) return [methodName, method];
    return [methodName, async (...args) => {
      try {
        return await method(...args);
      } catch (error) {
        const context = orderFailureAuditContext(methodName, args);
        await recordOrderFailure({
          actor: context.actor,
          action: context.action,
          targetId: context.targetId,
          requestMeta: context.requestMeta,
          error,
        });
        throw error;
      }
    }];
  }));
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`);
  return date;
}

async function generateOrderNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.ORDER, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

async function generateChildOrderNumber(type, options = {}) {
  const codeTypeByOrderType = {
    [ORDER_TYPE.LAB]: CODE_TYPE.LAB_ORDER,
    [ORDER_TYPE.IMAGING]: CODE_TYPE.IMAGING_ORDER,
    [ORDER_TYPE.PROCEDURE]: CODE_TYPE.PROCEDURE_ORDER,
    [ORDER_TYPE.MEDICATION]: CODE_TYPE.PRESCRIPTION,
  };
  const codeType = codeTypeByOrderType[type];
  if (!codeType) throw createError(`Không hỗ trợ sinh mã cho order_type ${type}.`);
  return generateBusinessCode(codeType, {
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

function validateOrderStatusTransition(currentStatus, nextStatus) {
  return assertTransition(ORDER_TRANSITIONS, currentStatus, nextStatus, 'order');
}

async function getEncounterOrThrow(encounterId, session = null) {
  const encounter = await withSession(Encounter.findById(encounterId).lean(), session);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  return encounter;
}

async function getOrderOrThrow(orderId, session = null) {
  const order = await withSession(Order.findById(orderId), session);
  if (!order) throw createError('Không tìm thấy order.', 404);
  return order;
}

async function getPatientActive(patientId, session = null) {
  const patient = await withSession(Patient.findById(patientId).lean(), session);
  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (patient.status !== 'active') throw createError('Bệnh nhân không active.', 409);
  return patient;
}

function assertEncounterAccess(encounter, actor = {}, options = {}) {
  if (!actorType(actor)) return true;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (hasAnyPermission(actor, options.globalPermissions || [])) return true;

  if (
    actor.userId
    && sameId(encounter.attending_doctor_id, actor.userId)
    && hasAnyPermission(actor, options.ownPermissions || [])
  ) {
    return true;
  }

  const departmentId = actorDepartmentId(actor);
  if (
    departmentId
    && sameId(encounter.department_id, departmentId)
    && hasAnyPermission(actor, options.departmentPermissions || [])
  ) {
    return true;
  }

  throw createError('Bạn không có quyền thao tác order trong encounter này.', 403);
}

function assertOrderAccess(order, actor = {}, action = 'read') {
  if (!actorType(actor)) return true;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;

  if (actorType(actor) === 'patient') {
    if (sameId(order.patient_id, actor.patientId || actor.patient_id) && hasPermission(actor, PERMISSION.ORDERS.SELF_READ)) {
      return true;
    }
    throw createError('Bạn không có quyền xem order này.', 403);
  }

  if (action === 'read') {
    if (hasPermission(actor, PERMISSION.ORDERS.READ) && (!actorDepartmentId(actor) || orderWithinActorScope(order, actor))) return true;
    if (hasPermission(actor, TYPE_READ_PERMISSION[order.order_type]) && (!actorDepartmentId(actor) || orderWithinActorScope(order, actor))) return true;
    if (actor.userId && sameId(order.ordered_by, actor.userId) && hasPermission(actor, PERMISSION.ORDERS.READ_OWN)) return true;
    const departmentId = actorDepartmentId(actor);
    if (departmentId && sameId(order.department_id, departmentId) && hasPermission(actor, PERMISSION.ORDERS.READ_DEPARTMENT)) return true;
  }

  if (action === 'cancel') {
    if (hasPermission(actor, PERMISSION.ORDERS.CANCEL) && (!actorDepartmentId(actor) || orderWithinActorScope(order, actor))) return true;
    if (actor.userId && sameId(order.ordered_by, actor.userId) && hasPermission(actor, PERMISSION.ORDERS.CANCEL_OWN)) return true;
    const departmentId = actorDepartmentId(actor);
    if (departmentId && sameId(order.department_id, departmentId) && hasPermission(actor, PERMISSION.ORDERS.CANCEL_DEPARTMENT)) return true;
  }

  if (action === 'write') {
    if (assertOrderScopedPermission(order, actor, [PERMISSION.ORDERS.UPDATE, PERMISSION.ORDERS.DISPATCH, PERMISSION.ORDERS.ACKNOWLEDGE, PERMISSION.ORDERS.START, PERMISSION.ORDERS.COMPLETE])) return true;
    if (assertOrderScopedPermission(order, actor, TYPE_WORKFLOW_PERMISSIONS[order.order_type] || [])) return true;
    if (assertOrderScopedPermission(order, actor, [PERMISSION.CHARGES.CREATE, PERMISSION.CHARGES.MANAGE, PERMISSION.ORDERS.CREATE_CHARGE])) return true;
    if (actor.userId && sameId(order.ordered_by, actor.userId) && hasPermission(actor, PERMISSION.ORDERS.CREATE)) return true;
  }

  throw createError('Bạn không có quyền thao tác order này.', 403);
}

async function applyOrderListScope(filter, actor = {}) {
  if (!actorType(actor)) return;
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return;

  if (actorType(actor) === 'patient') {
    const patientId = actor.patientId || actor.patient_id;
    if (!patientId || !hasPermission(actor, PERMISSION.ORDERS.SELF_READ)) {
      throw createError('Bạn không có quyền xem danh sách order.', 403);
    }
    filter.patient_id = patientId;
    filter.status = ORDER_STATUS.COMPLETED;
    return;
  }

  const typeScopes = Object.entries(TYPE_READ_PERMISSION)
    .filter(([, permission]) => hasPermission(actor, permission))
    .map(([type]) => type);
  const departmentId = actorDepartmentId(actor);
  const canReadDepartment = departmentId && hasAnyPermission(actor, [PERMISSION.ORDERS.READ, PERMISSION.ORDERS.READ_DEPARTMENT]);
  const canReadOwn = actor.userId && hasPermission(actor, PERMISSION.ORDERS.READ_OWN);

  if (canReadDepartment) {
    addScopedFilterValue(filter, 'department_id', departmentId, 'Bạn không có quyền xem order khoa khác.');
  } else if (canReadOwn) {
    addScopedFilterValue(filter, 'ordered_by', actor.userId, 'Bạn không có quyền xem order của bác sĩ khác.');
  }

  if (typeScopes.length > 0) {
    if (filter.order_type && !typeScopes.includes(filter.order_type)) {
      throw createError('Bạn không có quyền xem order_type được yêu cầu.', 403);
    }
    if (departmentId) {
      addScopedFilterValue(filter, 'department_id', departmentId, 'Bạn không có quyền xem order khoa khác.');
    } else if (canReadOwn) {
      addScopedFilterValue(filter, 'ordered_by', actor.userId, 'Bạn không có quyền xem order của bác sĩ khác.');
    }
    filter.order_type = filter.order_type || { $in: typeScopes };
    return;
  }

  if (canReadDepartment || canReadOwn) {
    return;
  }

  throw createError('Bạn không có quyền xem danh sách order.', 403);
}

function assertCreatePermission(orderType, actor = {}) {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return;
  if (hasPermission(actor, PERMISSION.ORDERS.CREATE)) return;
  if (hasPermission(actor, TYPE_CREATE_PERMISSION[orderType])) return;
  if (orderType === ORDER_TYPE.MEDICATION && hasPermission(actor, PERMISSION.PRESCRIPTIONS.CREATE)) return;
  throw createError('Bạn không có quyền tạo order loại này.', 403);
}

function validateOrderTypePayload(orderType, payload = {}) {
  assertNoUnsupportedOrderFields(orderType, payload);
  switch (orderType) {
    case ORDER_TYPE.LAB:
      if (!nonEmpty(payload.test_name)) throw createError('test_name là bắt buộc với lab order.');
      return {
        test_code: payload.test_code ? normalizeString(payload.test_code).toUpperCase() : undefined,
        test_name: normalizeString(payload.test_name),
        specimen_type: payload.specimen_type ? normalizeString(payload.specimen_type) : undefined,
        clinical_note: payload.clinical_note || payload.clinical_indication,
      };
    case ORDER_TYPE.IMAGING:
      ensureEnum(payload.modality, IMAGING_MODALITIES, 'modality');
      if (!payload.modality) throw createError('modality là bắt buộc với imaging order.');
      if (!nonEmpty(payload.body_part)) throw createError('body_part là bắt buộc với imaging order.');
      return {
        modality: payload.modality,
        body_part: normalizeString(payload.body_part),
        contrast_required: Boolean(payload.contrast_required),
        clinical_indication: payload.clinical_indication,
      };
    case ORDER_TYPE.PROCEDURE: {
      if (!nonEmpty(payload.procedure_name)) throw createError('procedure_name là bắt buộc với procedure order.');
      const scheduledStart = parseDate(payload.scheduled_start, 'scheduled_start');
      const scheduledEnd = parseDate(payload.scheduled_end, 'scheduled_end');
      if (scheduledStart && scheduledEnd && scheduledStart >= scheduledEnd) {
        throw createError('scheduled_start phải nhỏ hơn scheduled_end.');
      }
      return {
        performer_id: payload.performer_id || undefined,
        department_id: payload.department_id || undefined,
        procedure_code: payload.procedure_code ? normalizeString(payload.procedure_code).toUpperCase() : undefined,
        procedure_name: normalizeString(payload.procedure_name),
        clinical_indication: payload.clinical_indication,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
      };
    }
    case ORDER_TYPE.MEDICATION: {
      const items = Array.isArray(payload.prescription_items) ? payload.prescription_items : [];
      if (items.length === 0) throw createError('prescription_items là bắt buộc với medication order.');
      ensureEnum(payload.prescription_status, PRESCRIPTION_STATUSES, 'prescription_status');
      return {
        prescription_note: payload.prescription_note || payload.note,
        prescription_status: payload.prescription_status || PRESCRIPTION_STATUS.ACTIVE,
        prescription_items: items.map((item) => {
          if (!item.medication_id) throw createError('Mỗi prescription item phải có medication_id.');
          if (!nonEmpty(item.dose)) throw createError('dose là bắt buộc với prescription item.');
          if (!nonEmpty(item.frequency)) throw createError('frequency là bắt buộc với prescription item.');
          if (!nonEmpty(item.route)) throw createError('route là bắt buộc với prescription item.');
          if (!nonEmpty(item.unit)) throw createError('unit là bắt buộc với prescription item.');
          const quantity = item.quantity !== undefined && item.quantity !== null && item.quantity !== ''
            ? Number(item.quantity)
            : Number(item.duration_days || 0);
          if (!Number.isFinite(quantity) || quantity <= 0) throw createError('quantity phải lớn hơn 0.');
          return {
            medication_id: item.medication_id,
            dose: normalizeString(item.dose),
            frequency: normalizeString(item.frequency),
            route: normalizeString(item.route),
            duration_days: item.duration_days,
            quantity,
            unit: normalizeString(item.unit),
            instructions: item.instructions,
            status: item.status || 'active',
          };
        }),
      };
    }
    case ORDER_TYPE.SERVICE:
      if (!payload.service_id) throw createError('service_id là bắt buộc với service order.');
      return {};
    case ORDER_TYPE.NURSING:
      if (!payload.service_id) throw createError('service_id là bắt buộc với nursing order.');
      return {};
    case ORDER_TYPE.OTHER:
      if (!payload.service_id) throw createError('service_id là bắt buộc với other order.');
      return {};
    default:
      throw createError('order_type không được hỗ trợ.');
  }
}

async function resolveServiceForOrder(orderType, payload = {}, session = null) {
  if (!payload.service_id) return null;
  const service = await withSession(ServiceCatalog.findById(payload.service_id).lean(), session);
  if (!service || service.is_deleted) throw createError('Không tìm thấy service catalog.', 404);
  if (service.status !== SERVICE_STATUS.ACTIVE) throw createError('Service catalog không active.', 409);

  const expectedType = SERVICE_TYPE_BY_ORDER_TYPE[orderType];
  if (expectedType && service.service_type !== expectedType) {
    throw createError(`service_type không tương thích với order_type ${orderType}.`, 409);
  }
  return service;
}

async function checkSafetyWarnings(orderType, encounter, normalizedTypePayload, payload = {}) {
  const warnings = [];
  if (orderType === ORDER_TYPE.IMAGING && normalizedTypePayload.contrast_required) {
    const allergies = await Allergy.find({
      patient_id: encounter.patient_id,
      allergy_type: ALLERGY_TYPE.CONTRAST,
      status: ALLERGY_STATUS.ACTIVE,
    }).lean();
    if (allergies.length > 0) {
      warnings.push({
        code: 'contrast_allergy',
        severity: allergies.some((item) => [ALLERGY_SEVERITY.SEVERE, ALLERGY_SEVERITY.LIFE_THREATENING].includes(item.severity))
          ? 'high'
          : 'warning',
        message: 'Bệnh nhân có allergy contrast active.',
      });
    }
  }

  if (orderType === ORDER_TYPE.MEDICATION) {
    const medicationAllergies = await Allergy.find({
      patient_id: encounter.patient_id,
      allergy_type: 'medication',
      status: ALLERGY_STATUS.ACTIVE,
    }).lean();
    if (medicationAllergies.length > 0) {
      warnings.push({
        code: 'medication_allergy',
        severity: 'warning',
        message: 'Bệnh nhân có allergy thuốc active; cần kiểm tra trước khi kê.',
      });
    }
  }

  const highRisk = warnings.some((warning) => warning.severity === 'high');
  if (highRisk && !payload.confirm_safety_warning && !payload.override_safety_warning) {
    throw createError('Order có cảnh báo an toàn mức cao, cần xác nhận trước khi tạo.', 409, { warnings });
  }
  return warnings;
}

async function validateOrderCreation(encounterId, payload, actor = {}, options = {}) {
  assertActorUser(actor);
  if (!encounterId) throw createError('encounter_id là bắt buộc.');
  const orderType = payload.order_type;
  ensureEnum(orderType, ORDER_TYPES, 'order_type');
  if (!orderType) throw createError('order_type là bắt buộc.');
  ensureEnum(payload.priority, ORDER_PRIORITIES, 'priority');
  assertCreatePermission(orderType, actor);

  const encounter = await getEncounterOrThrow(encounterId, options.session);
  if (!ENCOUNTER_CAN_RECEIVE_ORDER_STATUSES.includes(encounter.status)) {
    throw createError('Encounter không ở trạng thái nhận order.', 409);
  }
  if (
    hasRole(actor, ROLE_CODE.DOCTOR)
    && !sameId(encounter.attending_doctor_id, actor.userId)
    && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)
  ) {
    throw createError('Doctor ngoài encounter không được tạo order.', 403);
  }
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [],
    ownPermissions: [PERMISSION.ORDERS.CREATE, TYPE_CREATE_PERMISSION[orderType], PERMISSION.PRESCRIPTIONS.CREATE],
    departmentPermissions: [PERMISSION.ORDERS.CREATE, TYPE_CREATE_PERMISSION[orderType]],
  });
  if (payload.ordered_by && !sameId(payload.ordered_by, actor.userId) && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    throw createError('Không được tạo order thay bác sĩ khác.', 403);
  }
  if (payload.department_id && !sameId(payload.department_id, encounter.department_id) && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    throw createError('department_id của order phải cùng khoa với encounter.', 403);
  }

  const patient = await getPatientActive(encounter.patient_id, options.session);
  const normalizedTypePayload = validateOrderTypePayload(orderType, payload);
  if ([ORDER_TYPE.LAB, ORDER_TYPE.IMAGING, ORDER_TYPE.PROCEDURE].includes(orderType) && !nonEmpty(payload.clinical_indication)) {
    throw createError('clinical_indication là bắt buộc với lab/imaging/procedure order.');
  }

  const service = await resolveServiceForOrder(orderType, payload, options.session);
  const warnings = await checkSafetyWarnings(orderType, encounter, normalizedTypePayload, payload);
  const orderedAt = payload.ordered_at ? parseDate(payload.ordered_at, 'ordered_at') : new Date();
  const requestedAt = payload.requested_at ? parseDate(payload.requested_at, 'requested_at') : undefined;
  const status = payload.save_as_draft ? ORDER_STATUS.DRAFT : ORDER_STATUS.ORDERED;

  return {
    encounter,
    patient,
    service,
    warnings,
    normalized: {
      order_type: orderType,
      priority: payload.priority || ORDER_PRIORITY.ROUTINE,
      clinical_indication: payload.clinical_indication,
      requested_at: requestedAt,
      ordered_at: orderedAt,
      status,
      service_id: service?._id || undefined,
      is_billable: Boolean(service?.is_billable),
      ordered_by: hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS) && payload.ordered_by ? payload.ordered_by : actor.userId,
      department_id: hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS) && payload.department_id ? payload.department_id : encounter.department_id,
      type_payload: normalizedTypePayload,
    },
  };
}

async function createLabOrderFromOrder(order, payload, actor, session = null) {
  if (order.order_type !== ORDER_TYPE.LAB) throw createError('Order không phải lab order.', 409);
  const existing = await withSession(LabOrder.findOne({ order_id: order._id }), session);
  if (existing) {
    assertChildMatchesOrder(existing, order, 'lab_order');
    return existing;
  }
  const labOrderNo = payload.lab_order_no || await generateChildOrderNumber(ORDER_TYPE.LAB, { session });
  try {
    const [child] = await LabOrder.create([{
      order_id: order._id,
      patient_id: order.patient_id,
      encounter_id: order.encounter_id,
      ordered_by: order.ordered_by,
      lab_order_no: labOrderNo,
      test_code: payload.test_code,
      test_name: payload.test_name,
      specimen_type: payload.specimen_type,
      priority: order.priority,
      ordered_at: order.ordered_at,
      clinical_note: payload.clinical_note || order.clinical_indication,
      status: INITIAL_CHILD_STATUS_BY_TYPE[ORDER_TYPE.LAB],
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    assertChildMatchesOrder(child, order, 'lab_order');
    return child;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const duplicate = await withSession(LabOrder.findOne({ order_id: order._id }), session);
    if (!duplicate) throw createError('Lab order đã được dispatch bởi request khác, vui lòng tải lại.', 409);
    assertChildMatchesOrder(duplicate, order, 'lab_order');
    return duplicate;
  }
}

async function createImagingOrderFromOrder(order, payload, actor, session = null) {
  if (order.order_type !== ORDER_TYPE.IMAGING) throw createError('Order không phải imaging order.', 409);
  const existing = await withSession(ImagingOrder.findOne({ order_id: order._id }), session);
  if (existing) {
    assertChildMatchesOrder(existing, order, 'imaging_order');
    return existing;
  }
  const imagingOrderNo = payload.imaging_order_no || await generateChildOrderNumber(ORDER_TYPE.IMAGING, { session });
  try {
    const [child] = await ImagingOrder.create([{
      order_id: order._id,
      patient_id: order.patient_id,
      encounter_id: order.encounter_id,
      ordered_by: order.ordered_by,
      imaging_order_no: imagingOrderNo,
      modality: payload.modality,
      body_part: payload.body_part,
      contrast_required: payload.contrast_required,
      clinical_indication: payload.clinical_indication || order.clinical_indication,
      priority: order.priority,
      ordered_at: order.ordered_at,
      status: INITIAL_CHILD_STATUS_BY_TYPE[ORDER_TYPE.IMAGING],
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    assertChildMatchesOrder(child, order, 'imaging_order');
    return child;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const duplicate = await withSession(ImagingOrder.findOne({ order_id: order._id }), session);
    if (!duplicate) throw createError('Imaging order đã được dispatch bởi request khác, vui lòng tải lại.', 409);
    assertChildMatchesOrder(duplicate, order, 'imaging_order');
    return duplicate;
  }
}

async function createProcedureOrderFromOrder(order, payload, actor, session = null) {
  if (order.order_type !== ORDER_TYPE.PROCEDURE) throw createError('Order không phải procedure order.', 409);
  const existing = await withSession(ProcedureOrder.findOne({ order_id: order._id }), session);
  if (existing) {
    assertChildMatchesOrder(existing, order, 'procedure_order');
    return existing;
  }
  const procedureOrderNo = payload.procedure_order_no || await generateChildOrderNumber(ORDER_TYPE.PROCEDURE, { session });
  try {
    const [child] = await ProcedureOrder.create([{
      order_id: order._id,
      patient_id: order.patient_id,
      encounter_id: order.encounter_id,
      requested_by: order.ordered_by,
      performer_id: payload.performer_id,
      department_id: payload.department_id || order.department_id,
      procedure_order_no: procedureOrderNo,
      procedure_code: payload.procedure_code,
      procedure_name: payload.procedure_name,
      priority: order.priority,
      clinical_indication: payload.clinical_indication || order.clinical_indication,
      scheduled_start: payload.scheduled_start,
      scheduled_end: payload.scheduled_end,
      status: INITIAL_CHILD_STATUS_BY_TYPE[ORDER_TYPE.PROCEDURE],
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    assertChildMatchesOrder(child, order, 'procedure_order');
    return child;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const duplicate = await withSession(ProcedureOrder.findOne({ order_id: order._id }), session);
    if (!duplicate) throw createError('Procedure order đã được dispatch bởi request khác, vui lòng tải lại.', 409);
    assertChildMatchesOrder(duplicate, order, 'procedure_order');
    return duplicate;
  }
}

async function createPrescriptionFromOrder(order, payload, actor, session = null) {
  if (order.order_type !== ORDER_TYPE.MEDICATION) throw createError('Order không phải medication order.', 409);
  const existing = await withSession(Prescription.findOne({ order_id: order._id }), session);
  if (existing) {
    assertChildMatchesOrder(existing, order, 'prescription');
    const items = await withSession(PrescriptionItem.find({ prescription_id: existing._id }).sort({ created_at: 1 }), session);
    return { prescription: existing, items };
  }

  for (const item of payload.prescription_items) {
    const medication = await withSession(MedicationMaster.findById(item.medication_id).lean(), session);
    if (!medication || medication.is_deleted) throw createError('Không tìm thấy thuốc.', 404);
    if (medication.status !== MEDICATION_STATUS.ACTIVE) throw createError('Thuốc hiện không active.', 409);
  }

  const prescriptionNo = payload.prescription_no || await generateChildOrderNumber(ORDER_TYPE.MEDICATION, { session });
  try {
    const [prescription] = await Prescription.create([{
      order_id: order._id,
      patient_id: order.patient_id,
      encounter_id: order.encounter_id,
      prescribed_by: order.ordered_by,
      prescription_no: prescriptionNo,
      prescribed_at: order.ordered_at,
      status: payload.prescription_status || PRESCRIPTION_STATUS.ACTIVE,
      note: payload.prescription_note || order.clinical_indication,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));

    const items = await PrescriptionItem.create(payload.prescription_items.map((item) => ({
      prescription_id: prescription._id,
      medication_id: item.medication_id,
      dose: item.dose,
      frequency: item.frequency,
      route: item.route,
      duration_days: item.duration_days,
      quantity: item.quantity,
      unit: item.unit,
      instructions: item.instructions,
      status: item.status || 'active',
      created_by: actor?.userId,
      updated_by: actor?.userId,
    })), sessionOptions(session));
    assertChildMatchesOrder(prescription, order, 'prescription');
    return { prescription, items };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const prescription = await withSession(Prescription.findOne({ order_id: order._id }), session);
    if (!prescription) throw createError('Prescription đã được dispatch bởi request khác, vui lòng tải lại.', 409);
    assertChildMatchesOrder(prescription, order, 'prescription');
    const items = prescription ? await withSession(PrescriptionItem.find({ prescription_id: prescription._id }).sort({ created_at: 1 }), session) : [];
    return { prescription, items };
  }
}

async function dispatchOrder(order, payload = {}, actor, session = null) {
  const plainOrder = typeof order.toObject === 'function' ? order.toObject() : order;
  let child = null;
  switch (plainOrder.order_type) {
    case ORDER_TYPE.LAB:
      child = await createLabOrderFromOrder(plainOrder, payload, actor, session);
      break;
    case ORDER_TYPE.IMAGING:
      child = await createImagingOrderFromOrder(plainOrder, payload, actor, session);
      break;
    case ORDER_TYPE.PROCEDURE:
      child = await createProcedureOrderFromOrder(plainOrder, payload, actor, session);
      break;
    case ORDER_TYPE.MEDICATION:
      child = await createPrescriptionFromOrder(plainOrder, payload, actor, session);
      break;
    case ORDER_TYPE.SERVICE:
    case ORDER_TYPE.NURSING:
    case ORDER_TYPE.OTHER:
      child = null;
      break;
    default:
      throw createError('order_type không hỗ trợ dispatch.', 409);
  }
  return child;
}

async function getExistingDispatchChild(order, session = null) {
  if (order.order_type === ORDER_TYPE.LAB) {
    const child = await withSession(LabOrder.findOne({ order_id: order._id }), session);
    assertChildMatchesOrder(child, order, 'lab_order');
    return child;
  }
  if (order.order_type === ORDER_TYPE.IMAGING) {
    const child = await withSession(ImagingOrder.findOne({ order_id: order._id }), session);
    assertChildMatchesOrder(child, order, 'imaging_order');
    return child;
  }
  if (order.order_type === ORDER_TYPE.PROCEDURE) {
    const child = await withSession(ProcedureOrder.findOne({ order_id: order._id }), session);
    assertChildMatchesOrder(child, order, 'procedure_order');
    return child;
  }
  if (order.order_type === ORDER_TYPE.MEDICATION) {
    const prescription = await withSession(Prescription.findOne({ order_id: order._id }), session);
    if (!prescription) return null;
    assertChildMatchesOrder(prescription, order, 'prescription');
    const items = await withSession(PrescriptionItem.find({ prescription_id: prescription._id }).sort({ created_at: 1 }), session);
    return { prescription, items };
  }
  return null;
}

async function createChargeForOrder(order, service, payload = {}, actor, session = null) {
  if (!service?.is_billable) return null;
  const existing = await withSession(Charge.findOne({
    order_id: order._id,
    status: { $nin: [CHARGE_STATUS.VOIDED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.REFUNDED] },
  }), session);
  if (existing) {
    if (!sameId(order.charge_id, existing._id)) {
      await withSession(Order.updateOne({ _id: order._id }, {
        $set: {
          charge_id: existing._id,
          is_billable: true,
          updated_by: actor?.userId,
        },
      }), session);
    }
    return existing;
  }

  const quantity = Number(payload.quantity || 1);
  if (quantity <= 0) throw createError('quantity tính phí phải lớn hơn 0.');
  const canOverridePrice = hasAnyPermission(actor, [
    PERMISSION.CHARGES.UPDATE,
    PERMISSION.CHARGES.MANAGE,
    PERMISSION.SYSTEM.FULL_ACCESS,
  ]);
  const unitPrice = payload.unit_price !== undefined && canOverridePrice
    ? Number(payload.unit_price || 0)
    : Number(service.unit_price || 0);
  const discountAmount = Number(payload.discount_amount || 0);
  const taxAmount = Number(payload.tax_amount || 0);
  const totalAmount = Math.max((quantity * unitPrice) - discountAmount + taxAmount, 0);
  const status = payload.status || (payload.post_immediately === false ? CHARGE_STATUS.PENDING : CHARGE_STATUS.POSTED);
  if (![CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT, CHARGE_STATUS.POSTED].includes(status)) {
    throw createError('Charge mới từ order chỉ được tạo ở pending/draft/posted.', 409);
  }
  const chargeNo = payload.charge_no || await generateChargeNumber({ session });
  let charge;
  try {
    [charge] = await Charge.create([{
      patient_id: order.patient_id,
      encounter_id: order.encounter_id,
      admission_id: order.admission_id,
      service_id: service._id,
      order_id: order._id,
      source_module: 'order',
      source_id: order._id,
      charge_no: chargeNo,
      description: payload.charge_description || service.service_name,
      quantity,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      charged_at: new Date(),
      posted_by: status === CHARGE_STATUS.POSTED ? actor?.userId : undefined,
      posted_at: status === CHARGE_STATUS.POSTED ? new Date() : undefined,
      status,
      review_status: payload.review_status,
      review_reason: payload.review_reason,
      review_notes: payload.review_notes || payload.override_reason,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const duplicate = await withSession(Charge.findOne({
      order_id: order._id,
      status: { $nin: [CHARGE_STATUS.VOIDED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.REFUNDED] },
    }), session);
    if (duplicate) {
      await withSession(Order.updateOne({ _id: order._id }, {
        $set: {
          charge_id: duplicate._id,
          is_billable: true,
          updated_by: actor?.userId,
        },
      }), session);
      return duplicate;
    }
    throw createError('Order đã có charge active nhưng không đọc lại được charge.', 409);
  }

  await withSession(Order.updateOne({ _id: order._id }, {
    $set: {
      charge_id: charge._id,
      is_billable: true,
      updated_by: actor?.userId,
    },
  }), session);

  return charge;
}

async function createOrder(encounterId, payload, actor, requestMeta = {}) {
  let createdOrderId;
  let childResult = null;
  let chargeId = null;
  let safetyWarnings = [];

  await withOptionalTransaction(async (session) => {
    const validation = await validateOrderCreation(encounterId, payload, actor, { session });
    safetyWarnings = validation.warnings;
    const orderNo = payload.order_no || await generateOrderNumber({ session });
    const [order] = await Order.create([{
      patient_id: validation.encounter.patient_id,
      encounter_id: validation.encounter._id,
      admission_id: payload.admission_id,
      department_id: validation.normalized.department_id,
      ordered_by: validation.normalized.ordered_by,
      service_id: validation.normalized.service_id,
      order_no: orderNo,
      order_type: validation.normalized.order_type,
      priority: validation.normalized.priority,
      is_billable: validation.normalized.is_billable,
      clinical_indication: validation.normalized.clinical_indication,
      requested_at: validation.normalized.requested_at,
      ordered_at: validation.normalized.ordered_at,
      status: validation.normalized.status,
      created_by: actor?.userId,
      updated_by: actor?.userId,
    }], sessionOptions(session));
    createdOrderId = order._id;

    if (order.status !== ORDER_STATUS.DRAFT || payload.dispatch_draft) {
      childResult = await dispatchOrder(order, validation.normalized.type_payload, actor, session);
      const shouldCreateChargeImmediately = validation.service && (
        ![ORDER_TYPE.PROCEDURE, ORDER_TYPE.MEDICATION].includes(order.order_type)
        || payload.create_charge_on_order === true
        || payload.charge_policy === 'on_order'
      );
      if (shouldCreateChargeImmediately) {
        const charge = await createChargeForOrder(order, validation.service, payload, actor, session);
        chargeId = charge?._id || null;
      }
    }
  }, { fallbackToNoTransaction: true });

  const createdOrderAfter = createdOrderId ? await Order.findById(createdOrderId).lean() : null;
  await recordAuditLog({
    actor,
    action: 'order.create',
    targetType: 'order',
    targetId: createdOrderId,
    status: 'success',
    message: 'Tạo order thành công.',
    requestMeta,
    before: null,
    after: createdOrderAfter,
    metadata: {
      order_type: payload.order_type,
      dispatched: Boolean(childResult),
      charge_id: chargeId,
      safety_warnings: safetyWarnings,
    },
  });

  if (
    createdOrderId
    && [
      ORDER_TYPE.LAB,
      ORDER_TYPE.IMAGING,
      ORDER_TYPE.PROCEDURE,
      ORDER_TYPE.SERVICE,
      ORDER_TYPE.NURSING,
    ].includes(payload.order_type)
    && !payload.skip_service_preparation
  ) {
    try {
      const nursingPreparationService = require('./nursing-preparation.service');
      await nursingPreparationService.ensurePreparationForOrder(createdOrderId, actor, requestMeta);
    } catch (error) {
      await recordAuditLog({
        actor,
        action: 'nursing.service_preparation.auto_create_failed',
        targetType: 'order',
        targetId: createdOrderId,
        status: 'failure',
        message: error.message || 'Không thể tự tạo ca chuẩn bị dịch vụ.',
        requestMeta,
      });
    }
  }

  return getOrderDetail(createdOrderId, actor);
}

async function getOrderChild(order) {
  switch (order.order_type) {
    case ORDER_TYPE.LAB:
      return { lab_order: await LabOrder.findOne({ order_id: order._id }).lean() };
    case ORDER_TYPE.IMAGING:
      {
        const imagingOrder = await ImagingOrder.findOne({ order_id: order._id }).lean();
        const imagingReport = imagingOrder
          ? await ImagingReport.findOne({
            imaging_order_id: imagingOrder._id,
            status: { $in: [IMAGING_REPORT_STATUS.FINAL, IMAGING_REPORT_STATUS.AMENDED] },
          }).sort({ verified_at: -1, reported_at: -1, created_at: -1 }).lean()
          : null;
        return { imaging_order: imagingOrder, imaging_report: imagingReport };
      }
    case ORDER_TYPE.PROCEDURE:
      return { procedure_order: await ProcedureOrder.findOne({ order_id: order._id }).lean() };
    case ORDER_TYPE.MEDICATION: {
      const prescription = await Prescription.findOne({ order_id: order._id }).lean();
      const items = prescription ? await PrescriptionItem.find({ prescription_id: prescription._id }).sort({ created_at: 1 }).lean() : [];
      return { prescription, prescription_items: items };
    }
    default:
      return {};
  }
}

async function getOrderDetail(orderId, actor = {}) {
  const order = await Order.findById(orderId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
    .populate('encounter_id', 'encounter_code encounter_type status start_time')
    .populate('department_id', 'department_code department_name')
    .populate('ordered_by', 'full_name username employee_code')
    .lean();
  if (!order) throw createError('Không tìm thấy order.', 404);
  assertOrderAccess(order, actor, 'read');
  const [child, charge] = await Promise.all([
    getOrderChild(order),
    Charge.findOne({ order_id: order._id }).lean(),
  ]);
  return { order, child, charge };
}

async function listOrders(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  for (const field of ['patient_id', 'encounter_id', 'admission_id', 'department_id', 'ordered_by', 'order_type', 'priority', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.date_from || query.date_to) {
    filter.ordered_at = {};
    if (query.date_from) filter.ordered_at.$gte = parseDate(query.date_from, 'date_from');
    if (query.date_to) filter.ordered_at.$lte = parseDate(query.date_to, 'date_to');
  }
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [{ order_no: { $regex: keyword, $options: 'i' } }];
  }
  await applyOrderListScope(filter, actor);

  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ ordered_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone')
      .populate('ordered_by', 'full_name username employee_code')
      .populate('department_id', 'department_code department_name')
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function searchOrders(query = {}, actor = {}) {
  const keyword = normalizeString(query.keyword || query.search);
  if (!keyword) return listOrders(query, actor);
  const patientIds = await Patient.find({
    $or: [
      { patient_code: { $regex: escapeRegex(keyword), $options: 'i' } },
      { full_name: { $regex: escapeRegex(keyword), $options: 'i' } },
      { phone: { $regex: escapeRegex(keyword), $options: 'i' } },
    ],
  }).select('_id').lean();
  const childOrderIds = await findChildOrderIds(keyword);
  const filter = {
    $or: [
      { order_no: { $regex: escapeRegex(keyword), $options: 'i' } },
      { patient_id: { $in: patientIds.map((patient) => patient._id) } },
      { _id: { $in: childOrderIds } },
    ],
  };
  await applyOrderListScope(filter, actor);
  const { page, limit, skip } = getPagination(query);
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ ordered_at: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function findChildOrderIds(keyword) {
  const pattern = escapeRegex(keyword);
  const [labOrders, imagingOrders, procedureOrders] = await Promise.all([
    LabOrder.find({ $or: [{ test_name: { $regex: pattern, $options: 'i' } }, { test_code: { $regex: pattern, $options: 'i' } }] }).select('order_id').lean(),
    ImagingOrder.find({ $or: [{ body_part: { $regex: pattern, $options: 'i' } }, { modality: { $regex: pattern, $options: 'i' } }] }).select('order_id').lean(),
    ProcedureOrder.find({ $or: [{ procedure_name: { $regex: pattern, $options: 'i' } }, { procedure_code: { $regex: pattern, $options: 'i' } }] }).select('order_id').lean(),
  ]);
  return [...labOrders, ...imagingOrders, ...procedureOrders].map((item) => item.order_id).filter(Boolean);
}

async function listOrdersByEncounter(encounterId, query = {}, actor = {}) {
  const encounter = await getEncounterOrThrow(encounterId);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [],
    ownPermissions: [PERMISSION.ORDERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_OWN],
    departmentPermissions: [PERMISSION.ORDERS.READ, PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
  });
  const { page, limit, skip } = getPagination(query);
  const filter = { encounter_id: encounterId };
  if (query.order_type) filter.order_type = query.order_type;
  if (query.priority) filter.priority = query.priority;
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ ordered_at: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function listOrdersByPatient(patientId, query = {}, actor = {}) {
  await getPatientActive(patientId);
  return listOrders({ ...query, patient_id: patientId }, actor);
}

async function listOrdersByDoctor(doctorId, query = {}, actor = {}) {
  if (
    actorType(actor)
    && actor.userId
    && !sameId(actor.userId, doctorId)
    && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)
  ) {
    throw createError('Bạn không có quyền xem order của bác sĩ khác.', 403);
  }
  return listOrders({ ...query, ordered_by: doctorId }, actor);
}

async function listOrdersByDepartment(departmentId, query = {}, actor = {}) {
  const scopedDepartmentId = actorDepartmentId(actor);
  if (
    actorType(actor)
    && scopedDepartmentId
    && !sameId(scopedDepartmentId, departmentId)
    && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)
  ) {
    throw createError('Bạn không có quyền xem order khoa khác.', 403);
  }
  return listOrders({ ...query, department_id: departmentId }, actor);
}

async function updateOrder(orderId, payload, actor, requestMeta = {}) {
  const order = await getOrderOrThrow(orderId);
  assertOrderAccess(order, actor, 'write');
  if (!ORDER_EDITABLE_STATUSES.includes(order.status)) throw createError('Order hiện không thể sửa trực tiếp.', 409);
  if (!sameId(order.ordered_by, actor?.userId) && !hasAnyPermission(actor, [PERMISSION.ORDERS.UPDATE, PERMISSION.SYSTEM.FULL_ACCESS])) {
    throw createError('Chỉ người tạo hoặc người có quyền override mới được sửa order.', 403);
  }

  const before = order.toObject();
  if (payload.priority !== undefined) {
    ensureEnum(payload.priority, ORDER_PRIORITIES, 'priority');
    order.priority = payload.priority;
  }
  if (payload.clinical_indication !== undefined) order.clinical_indication = payload.clinical_indication;
  if (payload.requested_at !== undefined) order.requested_at = parseDate(payload.requested_at, 'requested_at');
  if (payload.service_id !== undefined) {
    const service = await resolveServiceForOrder(order.order_type, payload);
    order.service_id = service?._id || undefined;
    order.is_billable = Boolean(service?.is_billable);
  }
  order.updated_by = actor?.userId;
  await order.save();

  await recordAuditLog({
    actor,
    action: 'order.update',
    targetType: 'order',
    targetId: order._id,
    status: 'success',
    message: 'Cập nhật order thành công.',
    requestMeta,
    before,
    after: order.toObject(),
  });
  return getOrderDetail(order._id, actor);
}

async function dispatchExistingOrder(orderId, payload = {}, actor, requestMeta = {}) {
  let child = null;
  let before = null;
  let after = null;
  await withOptionalTransaction(async (session) => {
    const order = await getOrderOrThrow(orderId, session);
    assertOrderAccess(order, actor, 'write');
    if (![ORDER_STATUS.DRAFT, ORDER_STATUS.ORDERED].includes(order.status)) {
      throw createError('Chỉ draft/ordered order mới được dispatch.', 409);
    }
    before = order.toObject();
    child = await getExistingDispatchChild(order, session);
    if (!child) {
      const normalizedTypePayload = validateOrderTypePayload(order.order_type, { ...payload, clinical_indication: payload.clinical_indication || order.clinical_indication });
      child = await dispatchOrder(order, normalizedTypePayload, actor, session);
    }
    if (order.status === ORDER_STATUS.DRAFT) {
      validateOrderStatusTransition(order.status, ORDER_STATUS.ORDERED);
      order.status = ORDER_STATUS.ORDERED;
      order.ordered_at = order.ordered_at || new Date();
      order.updated_by = actor?.userId;
      await order.save(sessionOptions(session));
    }
    after = order.toObject();
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'order.dispatch', targetType: 'order', targetId: orderId, status: 'success', message: 'Dispatch order thành công.', requestMeta, before, after });
  return { ...(await getOrderDetail(orderId, actor)), dispatched_child: child };
}

async function changeOrderStatus(orderId, nextStatus, actor, requestMeta = {}, payload = {}) {
  const order = await getOrderOrThrow(orderId);
  assertOrderAccess(order, actor, nextStatus === ORDER_STATUS.CANCELLED ? 'cancel' : 'write');
  assertOrderStatusActionPermission(order, nextStatus, actor);
  validateOrderStatusTransition(order.status, nextStatus);

  if (nextStatus === ORDER_STATUS.COMPLETED) {
    const childCheck = await checkChildCompletion(order);
    if (!childCheck.completed) {
      throw createError(`Order con chưa completed: ${childCheck.reason}`, 409);
    }
  }

  const before = order.toObject();
  order.status = nextStatus;
  order.updated_by = actor?.userId;
  await order.save();

  await recordAuditLog({
    actor,
    action: `order.${nextStatus}`,
    targetType: 'order',
    targetId: order._id,
    status: 'success',
    message: `Chuyển trạng thái order sang ${nextStatus} thành công.`,
    requestMeta,
    before,
    after: order.toObject(),
  });
  return getOrderDetail(order._id, actor);
}

async function acknowledgeOrder(orderId, actor, requestMeta = {}) {
  return changeOrderStatus(orderId, ORDER_STATUS.ACKNOWLEDGED, actor, requestMeta);
}

async function startOrder(orderId, actor, requestMeta = {}) {
  return changeOrderStatus(orderId, ORDER_STATUS.IN_PROGRESS, actor, requestMeta);
}

async function completeOrder(orderId, actor, requestMeta = {}, payload = {}) {
  return changeOrderStatus(orderId, ORDER_STATUS.COMPLETED, actor, requestMeta, payload);
}

async function checkChildCompletion(order) {
  const child = await getOrderChild(order);
  if (order.order_type === ORDER_TYPE.LAB) return { completed: child.lab_order?.status === LAB_ORDER_STATUS.COMPLETED, reason: 'lab_order chưa completed' };
  if (order.order_type === ORDER_TYPE.IMAGING) {
    return {
      completed: child.imaging_order?.status === IMAGING_ORDER_STATUS.COMPLETED
        && [IMAGING_REPORT_STATUS.FINAL, IMAGING_REPORT_STATUS.AMENDED].includes(child.imaging_report?.status),
      reason: 'imaging_order chưa completed hoặc imaging_report chưa final/amended',
    };
  }
  if (order.order_type === ORDER_TYPE.PROCEDURE) return { completed: child.procedure_order?.status === PROCEDURE_STATUS.COMPLETED, reason: 'procedure_order chưa completed' };
  if (order.order_type === ORDER_TYPE.MEDICATION) {
    return {
      completed: [PRESCRIPTION_STATUS.FULLY_DISPENSED, PRESCRIPTION_STATUS.COMPLETED].includes(child.prescription?.status),
      reason: 'prescription chưa hoàn tất/cấp phát đủ',
    };
  }
  return { completed: true, reason: null };
}

async function getMutableChildForCancel(order, session = null) {
  if (order.order_type === ORDER_TYPE.LAB) return withSession(LabOrder.findOne({ order_id: order._id }), session);
  if (order.order_type === ORDER_TYPE.IMAGING) return withSession(ImagingOrder.findOne({ order_id: order._id }), session);
  if (order.order_type === ORDER_TYPE.PROCEDURE) return withSession(ProcedureOrder.findOne({ order_id: order._id }), session);
  if (order.order_type === ORDER_TYPE.MEDICATION) return withSession(Prescription.findOne({ order_id: order._id }), session);
  return null;
}

async function assertChildCanBeCancelled(order, child, force = false) {
  if (!child) return;
  const status = child.status;
  const completedStatuses = [
    LAB_ORDER_STATUS.COMPLETED,
    IMAGING_ORDER_STATUS.COMPLETED,
    PROCEDURE_STATUS.COMPLETED,
    PRESCRIPTION_STATUS.COMPLETED,
    PRESCRIPTION_STATUS.FULLY_DISPENSED,
  ];
  if (completedStatuses.includes(status)) throw createError('Order con đã hoàn tất/final, không thể hủy order mẹ.', 409);
  if (order.order_type === ORDER_TYPE.MEDICATION) {
    if (!['draft', 'active', 'verified'].includes(status) && !force) {
      throw createError('Prescription đang xử lý/cấp phát, cần quyền override để hủy.', 409);
    }
    return;
  }
  const transitions = CHILD_CANCEL_TRANSITIONS[order.order_type];
  if (transitions && !canTransition(transitions, status, 'cancelled') && !force) {
    throw createError('Order con không ở trạng thái hủy an toàn.', 409);
  }
}

async function syncChildCancel(order, child, actor, session = null) {
  if (!child) return;
  if (order.order_type === ORDER_TYPE.MEDICATION) {
    child.status = PRESCRIPTION_STATUS.CANCELLED;
  } else {
    child.status = 'cancelled';
  }
  child.updated_by = actor?.userId;
  await child.save(sessionOptions(session));
}

async function voidChargeForCancelledOrder(order, reason, actor, session = null) {
  const charges = await withSession(Charge.find({
    order_id: order._id,
    status: { $nin: [CHARGE_STATUS.VOIDED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.REFUNDED] },
  }), session);
  for (const charge of charges) {
    if (charge.invoice_id || charge.status === CHARGE_STATUS.BILLED) {
      throw createError('Order đã có charge lên invoice, cần Billing Module xử lý adjustment.', 409);
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

async function cancelOrder(orderId, payload = {}, actor, requestMeta = {}) {
  if (!nonEmpty(payload.reason || payload.cancel_reason)) throw createError('reason là bắt buộc khi hủy order.');
  let voidedCharges = 0;
  let before = null;
  let after = null;
  await withOptionalTransaction(async (session) => {
    const order = await getOrderOrThrow(orderId, session);
    assertOrderAccess(order, actor, 'cancel');
    if (ORDER_TERMINAL_STATUSES.includes(order.status)) throw createError('Order đã ở trạng thái kết thúc.', 409);
    if (order.status === ORDER_STATUS.IN_PROGRESS && !hasPermission(actor, PERMISSION.ORDERS.OVERRIDE_CANCEL_IN_PROGRESS) && !payload.force) {
      throw createError('Order đang in_progress, cần quyền override để hủy.', 409);
    }
    validateOrderStatusTransition(order.status, ORDER_STATUS.CANCELLED);
    before = order.toObject();
    const child = await getMutableChildForCancel(order, session);
    await assertChildCanBeCancelled(order, child, payload.force);
    voidedCharges = await voidChargeForCancelledOrder(order, payload.reason || payload.cancel_reason, actor, session);
    await syncChildCancel(order, child, actor, session);

    order.status = ORDER_STATUS.CANCELLED;
    order.cancelled_by = actor?.userId;
    order.cancelled_at = new Date();
    order.cancel_reason = payload.reason || payload.cancel_reason;
    order.updated_by = actor?.userId;
    await order.save(sessionOptions(session));
    after = order.toObject();
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'order.cancel',
    targetType: 'order',
    targetId: orderId,
    status: 'success',
    message: 'Hủy order thành công.',
    requestMeta,
    before,
    after,
    metadata: { reason: payload.reason || payload.cancel_reason, voided_charges: voidedCharges },
  });
  return getOrderDetail(orderId, actor);
}

async function markOrderEnteredInError(orderId, payload = {}, actor, requestMeta = {}) {
  if (!nonEmpty(payload.reason || payload.entered_in_error_reason)) throw createError('reason là bắt buộc khi đánh dấu entered_in_error.');
  let before = null;
  let after = null;
  await withOptionalTransaction(async (session) => {
    const order = await getOrderOrThrow(orderId, session);
    assertOrderAccess(order, actor, 'write');
    if (!hasAnyPermission(actor, [PERMISSION.ORDERS.ENTERED_IN_ERROR, PERMISSION.SYSTEM.FULL_ACCESS])) {
      throw createError('Bạn không có quyền đánh dấu order entered_in_error.', 403);
    }
    if (order.status === ORDER_STATUS.COMPLETED) throw createError('Order completed không được entered_in_error thường.', 409);
    validateOrderStatusTransition(order.status, ORDER_STATUS.ENTERED_IN_ERROR);
    before = order.toObject();
    const child = await getMutableChildForCancel(order, session);
    await assertChildCanBeCancelled(order, child, payload.force);
    await voidChargeForCancelledOrder(order, payload.reason || payload.entered_in_error_reason, actor, session);
    await syncChildCancel(order, child, actor, session);
    order.status = ORDER_STATUS.ENTERED_IN_ERROR;
    order.entered_in_error_by = actor?.userId;
    order.entered_in_error_at = new Date();
    order.entered_in_error_reason = payload.reason || payload.entered_in_error_reason;
    order.updated_by = actor?.userId;
    await order.save(sessionOptions(session));
    after = order.toObject();
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'order.entered_in_error',
    targetType: 'order',
    targetId: orderId,
    status: 'success',
    message: 'Đánh dấu order entered_in_error thành công.',
    requestMeta,
    before,
    after,
    metadata: { reason: payload.reason || payload.entered_in_error_reason },
  });
  return getOrderDetail(orderId, actor);
}

async function createChargeForExistingOrder(orderId, payload = {}, actor, requestMeta = {}) {
  let chargeId = null;
  let before = null;
  let after = null;
  await withOptionalTransaction(async (session) => {
    const order = await getOrderOrThrow(orderId, session);
    assertOrderAccess(order, actor, 'write');
    if (!hasAnyPermission(actor, [PERMISSION.ORDERS.CREATE_CHARGE, PERMISSION.CHARGES.CREATE, PERMISSION.CHARGES.MANAGE, PERMISSION.SYSTEM.FULL_ACCESS])) {
      throw createError('Bạn không có quyền tạo charge cho order.', 403);
    }
    before = order.toObject();
    const service = await resolveServiceForOrder(order.order_type, { service_id: payload.service_id || order.service_id }, session);
    if (!service) throw createError('Order chưa có service_id để tạo charge.', 409);
    const charge = await createChargeForOrder(order, service, payload, actor, session);
    chargeId = charge?._id || null;
    const refreshedOrder = await getOrderOrThrow(orderId, session);
    after = refreshedOrder.toObject();
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({ actor, action: 'order.charge_create', targetType: 'order', targetId: orderId, status: 'success', message: 'Tạo charge cho order thành công.', requestMeta, before, after, metadata: { charge_id: chargeId } });
  return getOrderDetail(orderId, actor);
}

async function getEncounterOrderSummary(encounterId, actor = {}) {
  const encounter = await getEncounterOrThrow(encounterId);
  assertEncounterAccess(encounter, actor, {
    globalPermissions: [],
    ownPermissions: [PERMISSION.ORDERS.READ_OWN, PERMISSION.ENCOUNTERS.READ_OWN],
    departmentPermissions: [PERMISSION.ORDERS.SUMMARY_READ, PERMISSION.ORDERS.READ, PERMISSION.ORDERS.READ_DEPARTMENT, PERMISSION.ENCOUNTERS.READ, PERMISSION.ENCOUNTERS.READ_DEPARTMENT],
  });
  const rows = await Order.aggregate([
    { $match: { encounter_id: encounter._id } },
    { $group: { _id: { order_type: '$order_type', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const byType = {};
  const byStatus = {};
  let total = 0;
  for (const row of rows) {
    const { order_type: orderType, status } = row._id;
    byType[orderType] = (byType[orderType] || 0) + row.count;
    byStatus[status] = (byStatus[status] || 0) + row.count;
    total += row.count;
  }
  return { encounter_id: String(encounter._id), total_orders: total, by_type: byType, by_status: byStatus };
}

async function getOrderTimeline(orderId, actor = {}) {
  const detail = await getOrderDetail(orderId, actor);
  const childIds = [];
  for (const value of Object.values(detail.child || {})) {
    if (Array.isArray(value)) continue;
    if (value?._id) childIds.push(value._id);
  }
  const logs = await AuditLog.find({
    $or: [
      { target_type: 'order', target_id: detail.order._id },
      { target_id: { $in: childIds } },
      { 'metadata.order_id': String(detail.order._id) },
    ],
  }).sort({ created_at: 1 }).lean();

  return {
    order_id: String(detail.order._id),
    events: logs.map((log) => ({
      event_type: log.action,
      event_time: log.created_at,
      module: 'orders',
      title: log.message || log.action,
      actor_type: log.actor_type,
      actor_id: log.actor_id,
      entity_type: log.target_type,
      entity_id: log.target_id,
      metadata: sanitizeOrderTimelineMetadata(log.metadata, actor),
    })),
  };
}

const orderServiceExports = {
  // generateOrderNumber: Sinh/tạo mã y lệnh.
  generateOrderNumber,
  // validateOrderCreation: Kiểm tra tính hợp lệ của điều kiện tạo y lệnh.
  validateOrderCreation,
  // validateOrderTypePayload: Kiểm tra tính hợp lệ của dữ liệu theo loại y lệnh.
  validateOrderTypePayload,
  // validateOrderStatusTransition: Kiểm tra tính hợp lệ của chuyển trạng thái y lệnh.
  validateOrderStatusTransition,
  // createOrder: Tạo y lệnh.
  createOrder,
  // dispatchOrder: Điều phối/gửi y lệnh.
  dispatchOrder,
  // dispatchExistingOrder: Điều phối/gửi y lệnh hiện có.
  dispatchExistingOrder,
  // createLabOrderFromOrder: Tạo chỉ định xét nghiệm từ y lệnh.
  createLabOrderFromOrder,
  // createImagingOrderFromOrder: Tạo chỉ định chẩn đoán hình ảnh từ y lệnh.
  createImagingOrderFromOrder,
  // createProcedureOrderFromOrder: Tạo chỉ định thủ thuật từ y lệnh.
  createProcedureOrderFromOrder,
  // createPrescriptionFromOrder: Tạo đơn thuốc từ y lệnh.
  createPrescriptionFromOrder,
  // createChargeForOrder: Tạo khoản phí cho y lệnh.
  createChargeForOrder,
  // createChargeForExistingOrder: Tạo khoản phí cho y lệnh hiện có.
  createChargeForExistingOrder,
  // listOrders: Liệt kê y lệnh.
  listOrders,
  // searchOrders: Tìm kiếm y lệnh.
  searchOrders,
  // getOrderDetail: Lấy chi tiết y lệnh.
  getOrderDetail,
  // listOrdersByEncounter: Liệt kê y lệnh theo lượt khám.
  listOrdersByEncounter,
  // listOrdersByPatient: Liệt kê y lệnh theo bệnh nhân.
  listOrdersByPatient,
  // listOrdersByDoctor: Liệt kê y lệnh theo bác sĩ.
  listOrdersByDoctor,
  // listOrdersByDepartment: Liệt kê y lệnh theo khoa/phòng ban.
  listOrdersByDepartment,
  // updateOrder: Cập nhật y lệnh.
  updateOrder,
  // acknowledgeOrder: Ghi nhận đã tiếp nhận y lệnh.
  acknowledgeOrder,
  // startOrder: Bắt đầu y lệnh.
  startOrder,
  // completeOrder: Hoàn tất y lệnh.
  completeOrder,
  // cancelOrder: Hủy y lệnh.
  cancelOrder,
  // markOrderEnteredInError: Đánh dấu y lệnh là nhập sai.
  markOrderEnteredInError,
  // getEncounterOrderSummary: Lấy tổng hợp y lệnh của lượt khám.
  getEncounterOrderSummary,
  // getOrderTimeline: Lấy dòng thời gian y lệnh.
  getOrderTimeline,
};

module.exports = withOrderFailureAudits(orderServiceExports);
