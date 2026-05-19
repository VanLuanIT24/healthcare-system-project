const { Types } = require('mongoose');
const {
  Allergy,
  Attachment,
  ClinicalNote,
  ConsentRecord,
  Encounter,
  LabOrder,
  ImagingOrder,
  Order,
  Patient,
  PreparationActivity,
  PreparationChecklistItem,
  PreparationChecklistTemplate,
  ProblemList,
  ProcedureOrder,
  QueueTicket,
  ServicePreparation,
  Specimen,
  User,
  VitalSign,
} = require('../models');
const {
  ALLERGY_STATUS,
  ALLERGY_TYPE,
  ATTACHMENT_STATUS,
  CONSENT_STATUS,
  CONSENT_TYPE,
  NURSING_WORKFLOW_STATUS,
  ORDER_PRIORITY,
  ORDER_STATUS,
  ORDER_TYPE,
  PROBLEM_STATUS,
  QUEUE_STATUS,
  REALTIME_EVENT_TYPE,
  VITAL_SIGN_STATUS,
} = require('../constants/statuses');
const { PERMISSION } = require('../constants/permissions');
const permissionService = require('./permission.service');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const eventBus = require('../events/event-bus.service');
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

const SOURCE_TYPE = {
  PRE_EXAM: 'pre_exam',
  LAB: 'lab',
  IMAGING: 'imaging',
  PROCEDURE: 'procedure',
  SERVICE: 'service',
  NURSING: 'nursing',
  OTHER: 'other',
};

const PREPARATION_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  READY: 'ready',
  BLOCKED: 'blocked',
  TRANSFERRED: 'transferred',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const TERMINAL_STATUSES = [PREPARATION_STATUS.COMPLETED, PREPARATION_STATUS.CANCELLED];
const OPEN_STATUSES = [
  PREPARATION_STATUS.PENDING,
  PREPARATION_STATUS.ASSIGNED,
  PREPARATION_STATUS.IN_PROGRESS,
  PREPARATION_STATUS.READY,
  PREPARATION_STATUS.BLOCKED,
  PREPARATION_STATUS.TRANSFERRED,
];
const CHECKLIST_DONE_STATUSES = ['done', 'waived', 'not_applicable'];
const DEFAULT_LIMIT = 80;

const EVENT_BY_ACTION = {
  created: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_CREATED,
  assigned: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_ASSIGNED,
  started: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_STARTED,
  blocked: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_BLOCKED,
  unblocked: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_UNBLOCKED,
  ready: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_READY,
  transferred: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_TRANSFERRED,
  completed: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_COMPLETED,
  cancelled: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_CANCELLED,
  checklist_item_done: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_CHECKLIST_UPDATED,
  checklist_item_failed: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_CHECKLIST_UPDATED,
  checklist_item_waived: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_CHECKLIST_UPDATED,
  checklist_item_updated: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_CHECKLIST_UPDATED,
  evidence_attached: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_CHECKLIST_UPDATED,
  doctor_notified: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_ESCALATED,
  destination_notified: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_UPDATED,
  note_added: REALTIME_EVENT_TYPE.SERVICE_PREPARATION_UPDATED,
};

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session = null) {
  return session ? query.session(session) : query;
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.id || actor.user?._id || null;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function actorRoles(actor = {}) {
  return Array.isArray(actor.roles) ? actor.roles : actor.user?.roles || [];
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes.filter(Boolean));
}

function hasGlobalScope(actor = {}) {
  return hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.REPORTS.READ_ALL,
  ]) || actorRoles(actor).some((role) => ['super_admin', 'admin', 'manager', 'department_head'].includes(role));
}

function toObjectId(value, fieldName = 'id') {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(String(value))) throw createError(`${fieldName} không hợp lệ.`, 400);
  return new Types.ObjectId(String(value));
}

function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return String(value);
  if (value._id) return normalizeId(value._id);
  if (value.id) return normalizeId(value.id);
  return typeof value.toString === 'function' ? value.toString() : null;
}

function sameId(left, right) {
  return String(normalizeId(left) || '') === String(normalizeId(right) || '');
}

function parseDate(value, fieldName = 'date') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function addMinutes(value, minutes) {
  const date = value ? new Date(value) : new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function ageFromDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function userName(user = {}) {
  if (!user || typeof user !== 'object') return null;
  return user.full_name || user.employee_code || user.username || null;
}

function patientDto(patient = {}) {
  const value = patient && typeof patient === 'object' ? patient : {};
  return {
    id: normalizeId(value),
    patient_code: value.patient_code || null,
    full_name: value.full_name || value.patient_name || 'Chưa rõ bệnh nhân',
    gender: value.gender || null,
    date_of_birth: value.date_of_birth || null,
    age: ageFromDate(value.date_of_birth),
    phone: value.phone || null,
  };
}

function departmentDto(department = {}) {
  if (!department || typeof department !== 'object') return null;
  return {
    id: normalizeId(department),
    department_code: department.department_code || null,
    department_name: department.department_name || null,
  };
}

function encounterDto(encounter = {}) {
  if (!encounter || typeof encounter !== 'object') return null;
  return {
    id: normalizeId(encounter),
    encounter_code: encounter.encounter_code || null,
    status: encounter.status || null,
    encounter_type: encounter.encounter_type || null,
    start_time: encounter.start_time || null,
    attending_doctor: userName(encounter.attending_doctor_id),
    department: departmentDto(encounter.department_id),
  };
}

function queueDto(queue = {}, now = new Date()) {
  if (!queue || typeof queue !== 'object') return null;
  const waitingSince = queue.checkin_time || queue.created_at;
  return {
    id: normalizeId(queue),
    queue_no: queue.display_number || queue.queue_number || null,
    status: queue.status || null,
    nursing_stage: queue.nursing_stage || null,
    waiting_minutes: waitingSince ? Math.max(0, Math.floor((now - new Date(waitingSince)) / 60000)) : 0,
  };
}

function orderDto(order = {}) {
  if (!order || typeof order !== 'object') return null;
  return {
    id: normalizeId(order),
    order_no: order.order_no || null,
    order_type: order.order_type || null,
    status: order.status || null,
    priority: order.priority || null,
    clinical_indication: order.clinical_indication || null,
    ordered_at: order.ordered_at || null,
    ordered_by: userName(order.ordered_by),
  };
}

function prepSlaMinutes(sourceType, priority) {
  if (priority === ORDER_PRIORITY.STAT) return sourceType === SOURCE_TYPE.PRE_EXAM ? 10 : 15;
  if (priority === ORDER_PRIORITY.URGENT) return sourceType === SOURCE_TYPE.PRE_EXAM ? 20 : 45;
  if (sourceType === SOURCE_TYPE.PRE_EXAM) return 30;
  if (sourceType === SOURCE_TYPE.LAB) return 90;
  if (sourceType === SOURCE_TYPE.IMAGING) return 120;
  if (sourceType === SOURCE_TYPE.PROCEDURE) return 180;
  return 120;
}

function computeSlaLevel(slaDueAt, now = new Date()) {
  if (!slaDueAt) return 'normal';
  const due = new Date(slaDueAt);
  if (Number.isNaN(due.getTime())) return 'normal';
  if (due <= now) return 'breached';
  return due.getTime() - now.getTime() <= 15 * 60000 ? 'warning' : 'normal';
}

function sourceTitle(sourceType, child = {}, order = {}, encounter = {}) {
  if (sourceType === SOURCE_TYPE.PRE_EXAM) return `Chuẩn bị trước khám ${encounter.encounter_code || ''}`.trim();
  if (sourceType === SOURCE_TYPE.LAB) return child.test_name || order.order_no || 'Chuẩn bị xét nghiệm';
  if (sourceType === SOURCE_TYPE.IMAGING) {
    return [child.modality?.toUpperCase?.(), child.body_part].filter(Boolean).join(' - ') || 'Chuẩn bị CĐHA';
  }
  if (sourceType === SOURCE_TYPE.PROCEDURE) return child.procedure_name || 'Chuẩn bị thủ thuật';
  return order.order_no || 'Chuẩn bị dịch vụ';
}

function allowedActions(preparation = {}) {
  const status = preparation.status;
  const actions = ['open_checklist', 'add_note'];
  if (status === PREPARATION_STATUS.PENDING) actions.push('assign', 'start', 'block', 'cancel');
  if (status === PREPARATION_STATUS.ASSIGNED) actions.push('start', 'block', 'ready', 'cancel');
  if (status === PREPARATION_STATUS.IN_PROGRESS) actions.push('ready', 'block', 'transfer', 'cancel');
  if (status === PREPARATION_STATUS.BLOCKED) actions.push('unblock', 'notify_doctor', 'cancel');
  if (status === PREPARATION_STATUS.READY) actions.push('transfer', 'complete', 'block', 'notify_destination');
  if (status === PREPARATION_STATUS.TRANSFERRED) actions.push('complete', 'notify_destination');
  return actions;
}

function compactObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ''));
}

function activeConsentTypeForPreparation(preparation = {}, imagingOrder = {}) {
  if (preparation.source_type === SOURCE_TYPE.IMAGING && imagingOrder.contrast_required) {
    return CONSENT_TYPE.IMAGING_CONTRAST_CONSENT;
  }
  if (preparation.source_type === SOURCE_TYPE.PROCEDURE) return CONSENT_TYPE.PROCEDURE_CONSENT;
  return null;
}

function builtinChecklistItems(sourceType, context = {}) {
  const baseIdentity = [
    { code: 'identity_confirmed', label: 'Xác nhận đúng bệnh nhân', category: 'identity', required: true, critical: true },
  ];

  if (sourceType === SOURCE_TYPE.PRE_EXAM) {
    return [
      ...baseIdentity,
      { code: 'chief_reason_confirmed', label: 'Xác nhận lý do khám', category: 'clinical', required: true },
      { code: 'contact_verified', label: 'Xác nhận thông tin liên hệ', category: 'identity' },
      { code: 'vitals_recorded', label: 'Đo sinh hiệu', category: 'clinical', required: true, critical: true },
      { code: 'abnormal_vitals_reviewed', label: 'Kiểm tra sinh hiệu bất thường', category: 'safety', required: true },
      { code: 'allergy_reviewed', label: 'Kiểm tra dị ứng', category: 'safety', required: true },
      { code: 'problem_reviewed', label: 'Kiểm tra vấn đề đang active', category: 'clinical' },
      { code: 'nursing_note_added', label: 'Ghi chú điều dưỡng ban đầu', category: 'document' },
      { code: 'ready_for_doctor', label: 'Đánh dấu sẵn sàng gặp bác sĩ', category: 'handoff', required: true },
    ];
  }

  if (sourceType === SOURCE_TYPE.LAB) {
    return [
      ...baseIdentity,
      { code: 'right_test_confirmed', label: 'Xác nhận đúng xét nghiệm', category: 'clinical', required: true, critical: true },
      { code: 'specimen_type_confirmed', label: 'Xác nhận loại mẫu', category: 'specimen', required: true },
      { code: 'collection_time_confirmed', label: 'Xác nhận thời điểm lấy mẫu', category: 'specimen', required: true },
      { code: 'fasting_checked', label: 'Kiểm tra nhịn ăn nếu cần', category: 'instruction' },
      { code: 'container_prepared', label: 'Chuẩn bị tube/container', category: 'specimen', required: true },
      { code: 'barcode_printed', label: 'In barcode', category: 'specimen' },
      { code: 'barcode_applied', label: 'Dán barcode', category: 'specimen', required: true },
      { code: 'sample_collected', label: 'Lấy mẫu', category: 'specimen', required: true, critical: true },
      { code: 'lab_handoff_ready', label: 'Mẫu sẵn sàng bàn giao lab', category: 'handoff', required: true },
    ];
  }

  if (sourceType === SOURCE_TYPE.IMAGING) {
    const items = [
      ...baseIdentity,
      { code: 'right_imaging_order', label: 'Xác nhận đúng chỉ định', category: 'clinical', required: true, critical: true },
      { code: 'body_part_confirmed', label: 'Xác nhận đúng vùng chụp', category: 'imaging_safety', required: true },
      { code: 'allergy_checked', label: 'Kiểm tra dị ứng', category: 'safety', required: true },
      { code: 'procedure_explained', label: 'Giải thích quy trình', category: 'instruction' },
      { code: 'metal_removed', label: 'Tháo vật kim loại nếu cần', category: 'imaging_safety' },
      { code: 'transport_ready', label: 'Sẵn sàng chuyển phòng CĐHA', category: 'handoff', required: true },
    ];
    if (context.contrast_required) {
      items.splice(4, 0,
        { code: 'contrast_allergy_screened', label: 'Sàng lọc dị ứng thuốc cản quang', category: 'imaging_safety', required: true, critical: true },
        { code: 'renal_function_checked', label: 'Kiểm tra chức năng thận/eGFR nếu có', category: 'imaging_safety' },
        { code: 'iv_line_ready', label: 'Xác nhận đường truyền IV', category: 'imaging_safety', required: true },
        { code: 'contrast_consent_ready', label: 'Consent cản quang', category: 'document', required: true, critical: true },
      );
    }
    if (context.modality === 'mri') {
      items.splice(4, 0,
        { code: 'pacemaker_screened', label: 'Kiểm tra pacemaker', category: 'imaging_safety', required: true, critical: true },
        { code: 'metal_implant_screened', label: 'Kiểm tra implant kim loại', category: 'imaging_safety', required: true, critical: true },
        { code: 'pregnancy_screened', label: 'Xác nhận thai kỳ nếu cần', category: 'imaging_safety' },
        { code: 'claustrophobia_checked', label: 'Kiểm tra sợ không gian kín', category: 'imaging_safety' },
      );
    }
    return items;
  }

  if (sourceType === SOURCE_TYPE.PROCEDURE) {
    return [
      ...baseIdentity,
      { code: 'right_procedure_confirmed', label: 'Xác nhận đúng thủ thuật', category: 'procedure_safety', required: true, critical: true },
      { code: 'site_side_verified', label: 'Xác nhận đúng vị trí/bên thực hiện', category: 'procedure_safety', required: true, critical: true },
      { code: 'performer_confirmed', label: 'Xác nhận người thực hiện', category: 'procedure_safety' },
      { code: 'procedure_consent_ready', label: 'Xác nhận consent', category: 'document', required: true, critical: true },
      { code: 'latest_vitals_reviewed', label: 'Kiểm tra sinh hiệu gần nhất', category: 'clinical', required: true },
      { code: 'allergy_reviewed', label: 'Kiểm tra dị ứng', category: 'safety', required: true },
      { code: 'anticoagulant_screened', label: 'Kiểm tra thuốc chống đông nếu có', category: 'safety' },
      { code: 'fasting_checked', label: 'Kiểm tra nhịn ăn nếu cần', category: 'instruction' },
      { code: 'material_ready', label: 'Chuẩn bị dụng cụ/vật tư', category: 'material', required: true },
      { code: 'room_ready', label: 'Chuẩn bị phòng', category: 'material', required: true },
      { code: 'procedure_explained', label: 'Giải thích quy trình', category: 'instruction' },
      { code: 'ready_for_procedure', label: 'Sẵn sàng thủ thuật', category: 'handoff', required: true },
    ];
  }

  return [
    ...baseIdentity,
    { code: 'instruction_reviewed', label: 'Kiểm tra hướng dẫn dịch vụ', category: 'instruction', required: true },
    { code: 'document_ready', label: 'Tài liệu liên quan đã sẵn sàng', category: 'document' },
    { code: 'handoff_ready', label: 'Sẵn sàng bàn giao', category: 'handoff', required: true },
  ];
}

async function generatePreparationNo(options = {}) {
  return generateBusinessCode(CODE_TYPE.SERVICE_PREPARATION, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

function templateMatches(template = {}, context = {}) {
  if (template.order_type && template.order_type !== context.order_type) return false;
  if (template.modality && template.modality !== context.modality) return false;
  if (template.procedure_code && template.procedure_code !== context.procedure_code) return false;
  if (template.test_code && template.test_code !== context.test_code) return false;
  if (template.specimen_type && template.specimen_type !== context.specimen_type) return false;
  if (template.service_id && !sameId(template.service_id, context.service_id)) return false;
  if (template.department_id && !sameId(template.department_id, context.department_id)) return false;
  return true;
}

async function buildChecklistItems(sourceType, context = {}) {
  const templates = await PreparationChecklistTemplate.find({ source_type: sourceType, is_active: true })
    .sort({ is_default: -1, version: -1, updated_at: -1 })
    .lean();
  const matchedTemplates = templates.filter((template) => templateMatches(template, context));
  const sourceItems = matchedTemplates.length
    ? matchedTemplates.flatMap((template) => (template.items || []).map((item) => ({
      ...item,
      template_code: template.template_code,
      template_item_code: item.code,
    })))
    : builtinChecklistItems(sourceType, context);

  const byCode = new Map();
  sourceItems
    .filter((item) => item?.code && item?.label)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .forEach((item, index) => {
      if (byCode.has(item.code)) return;
      byCode.set(item.code, {
        code: item.code,
        label: item.label,
        description: item.description,
        category: item.category,
        required: Boolean(item.required),
        critical: Boolean(item.critical),
        value_type: item.value_type || 'boolean',
        value: item.default_value,
        template_code: item.template_code,
        template_item_code: item.template_item_code,
        sort_order: item.sort_order ?? (index + 1) * 10,
      });
    });
  return [...byCode.values()];
}

async function recomputePreparationStats(preparationId, session = null) {
  const preparation = await withSession(ServicePreparation.findById(preparationId), session);
  if (!preparation) return null;
  const items = await withSession(PreparationChecklistItem.find({ preparation_id: preparation._id }).lean(), session);
  const total = items.length;
  const done = items.filter((item) => CHECKLIST_DONE_STATUSES.includes(item.status)).length;
  const required = items.filter((item) => item.required);
  const requiredDone = required.filter((item) => CHECKLIST_DONE_STATUSES.includes(item.status)).length;
  const criticalFailed = items.filter((item) => item.critical && item.status === 'failed');
  const requiredFailed = items.filter((item) => item.required && item.status === 'failed');
  const denominator = required.length || total || 1;
  const numerator = required.length ? requiredDone : done;
  const readiness = Math.round((numerator / denominator) * 100);

  preparation.checklist_total = total;
  preparation.checklist_done = done;
  preparation.checklist_required_total = required.length;
  preparation.checklist_required_done = requiredDone;
  preparation.readiness_score = Math.max(0, Math.min(100, readiness));
  preparation.has_safety_risk = criticalFailed.length > 0 || requiredFailed.length > 0;
  preparation.safety_risk_codes = [...new Set([...criticalFailed, ...requiredFailed].map((item) => item.code))];
  preparation.sla_level = computeSlaLevel(preparation.sla_due_at);
  await preparation.save(sessionOptions(session));
  return preparation;
}

async function ensureChecklistForPreparation(preparation, context = {}, actor = {}, session = null) {
  const count = await withSession(PreparationChecklistItem.countDocuments({ preparation_id: preparation._id }), session);
  if (count > 0) return recomputePreparationStats(preparation._id, session);

  const items = await buildChecklistItems(preparation.source_type, {
    ...context,
    order_type: context.order?.order_type || context.order_type,
    modality: context.imaging_order?.modality || context.modality,
    contrast_required: context.imaging_order?.contrast_required ?? context.contrast_required,
    procedure_code: context.procedure_order?.procedure_code || context.procedure_code,
    test_code: context.lab_order?.test_code || context.test_code,
    specimen_type: context.lab_order?.specimen_type || context.specimen_type,
    service_id: context.order?.service_id || context.service_id,
    department_id: preparation.department_id || context.department_id,
  });

  if (items.length) {
    await PreparationChecklistItem.create(items.map((item) => ({
      preparation_id: preparation._id,
      ...item,
    })), sessionOptions(session));
  }

  return recomputePreparationStats(preparation._id, session);
}

async function createActivity(preparation, action, actor = {}, message = '', metadata = {}, session = null) {
  const actorId = actorUserId(actor);
  const [activity] = await PreparationActivity.create([{
    preparation_id: preparation._id,
    patient_id: preparation.patient_id,
    encounter_id: preparation.encounter_id,
    actor_id: actorId,
    action,
    message,
    metadata,
    created_at: new Date(),
  }], sessionOptions(session));
  await withSession(ServicePreparation.updateOne({ _id: preparation._id }, {
    $set: {
      last_activity_at: activity.created_at,
      updated_by: actorId || undefined,
    },
  }), session);
  return activity;
}

async function publishPreparationEvent(action, preparation, actor = {}, payload = {}, requestMeta = {}) {
  const eventType = EVENT_BY_ACTION[action] || REALTIME_EVENT_TYPE.SERVICE_PREPARATION_UPDATED;
  const prep = preparation.toObject ? preparation.toObject() : preparation;
  const rooms = [`encounter:${normalizeId(prep.encounter_id)}`].filter(Boolean);
  try {
    return eventBus.publishDomainEvent({
      eventType,
      aggregateType: 'service_preparation',
      aggregateId: prep._id,
      actor: {
        actor_type: actor.actorType || actor.actor_type || 'staff',
        actor_id: actorUserId(actor),
      },
      recipientScope: {
        rooms,
        patient_id: prep.patient_id,
        department_id: [prep.department_id, prep.destination_department_id].filter(Boolean),
        user_id: prep.assigned_nurse_id,
        role: [
          'nurse',
          'nurse_manager',
          'doctor',
          prep.source_type === SOURCE_TYPE.LAB ? 'lab_technician' : null,
          prep.source_type === SOURCE_TYPE.IMAGING ? 'radiologist' : null,
          prep.source_type === SOURCE_TYPE.PROCEDURE ? 'procedure_staff' : null,
        ].filter(Boolean),
      },
      requestId: requestMeta.requestId || requestMeta.request_id,
      payload: {
        preparation_id: normalizeId(prep),
        preparation_no: prep.preparation_no,
        source_type: prep.source_type,
        status: prep.status,
        priority: prep.priority,
        patient_id: normalizeId(prep.patient_id),
        encounter_id: normalizeId(prep.encounter_id),
        department_id: normalizeId(prep.department_id),
        assigned_nurse_id: normalizeId(prep.assigned_nurse_id),
        readiness_score: prep.readiness_score,
        ...payload,
      },
    });
  } catch (error) {
    return null;
  }
}

function applyPreparationScope(filter, actor = {}, query = {}) {
  const requestedDepartmentId = normalizeString(query.department_id || query.departmentId);
  if (requestedDepartmentId) filter.department_id = toObjectId(requestedDepartmentId, 'department_id');
  if (hasGlobalScope(actor)) return filter;

  const departmentId = actorDepartmentId(actor);
  if (!departmentId) throw createError('Không xác định được khoa/phòng của điều dưỡng hiện tại.', 403);
  if (requestedDepartmentId && !sameId(requestedDepartmentId, departmentId)) {
    throw createError('Bạn chỉ được xem chuẩn bị dịch vụ trong khoa/phòng được phân quyền.', 403);
  }
  filter.department_id = toObjectId(departmentId, 'department_id');
  return filter;
}

async function buildKeywordFilter(keyword) {
  const normalized = normalizeString(keyword);
  if (!normalized) return [];
  const pattern = escapeRegex(normalized);
  const regex = { $regex: pattern, $options: 'i' };
  const [patients, orders, labOrders, imagingOrders, procedureOrders] = await Promise.all([
    Patient.find({ $or: [{ patient_code: regex }, { full_name: regex }, { phone: regex }] }).select('_id').lean(),
    Order.find({ order_no: regex }).select('_id').lean(),
    LabOrder.find({ $or: [{ lab_order_no: regex }, { test_name: regex }, { test_code: regex }] }).select('_id order_id').lean(),
    ImagingOrder.find({ $or: [{ imaging_order_no: regex }, { modality: regex }, { body_part: regex }] }).select('_id order_id').lean(),
    ProcedureOrder.find({ $or: [{ procedure_order_no: regex }, { procedure_name: regex }, { procedure_code: regex }] }).select('_id order_id').lean(),
  ]);
  return [
    { preparation_no: regex },
    { title: regex },
    { description: regex },
    { last_note: regex },
    patients.length ? { patient_id: { $in: patients.map((item) => item._id) } } : null,
    orders.length ? { order_id: { $in: orders.map((item) => item._id) } } : null,
    labOrders.length ? { lab_order_id: { $in: labOrders.map((item) => item._id) } } : null,
    imagingOrders.length ? { imaging_order_id: { $in: imagingOrders.map((item) => item._id) } } : null,
    procedureOrders.length ? { procedure_order_id: { $in: procedureOrders.map((item) => item._id) } } : null,
  ].filter(Boolean);
}

async function buildWorklistFilter(query = {}, actor = {}) {
  const filter = {};
  applyPreparationScope(filter, actor, query);
  if (query.source_type) filter.source_type = query.source_type;
  if (query.status) filter.status = query.status;
  if (!query.include_completed && !query.status) filter.status = { $in: OPEN_STATUSES };
  if (query.priority) filter.priority = query.priority;
  if (query.sla) filter.sla_level = query.sla;
  if (query.has_safety_risk !== undefined) filter.has_safety_risk = String(query.has_safety_risk) === 'true';

  const assigned = normalizeString(query.assigned_nurse_id || query.assignedNurseId || query.assigned_to || query.assignedTo);
  if (assigned === 'me') filter.assigned_nurse_id = toObjectId(actorUserId(actor), 'assigned_nurse_id');
  else if (assigned === 'unassigned') filter.assigned_nurse_id = { $exists: false };
  else if (assigned) filter.assigned_nurse_id = toObjectId(assigned, 'assigned_nurse_id');

  const dateFrom = parseDate(query.date_from || query.dateFrom, 'date_from');
  const dateTo = parseDate(query.date_to || query.dateTo, 'date_to');
  const date = parseDate(query.date, 'date');
  if (date || dateFrom || dateTo) {
    filter.created_at = {};
    if (date) {
      filter.created_at.$gte = getStartOfDay(date);
      filter.created_at.$lte = getEndOfDay(date);
    }
    if (dateFrom) filter.created_at.$gte = dateFrom;
    if (dateTo) filter.created_at.$lte = dateTo;
  }

  const keywordClauses = await buildKeywordFilter(query.keyword || query.search);
  if (keywordClauses.length) filter.$or = keywordClauses;
  return filter;
}

async function buildRiskContext(preparations = []) {
  const patientIds = [...new Set(preparations.map((item) => normalizeId(item.patient_id)).filter(Boolean))];
  const encounterIds = [...new Set(preparations.map((item) => normalizeId(item.encounter_id)).filter(Boolean))];
  const orderIds = [...new Set(preparations.map((item) => normalizeId(item.order_id)).filter(Boolean))];

  const [allergies, vitals, consents, specimens, attachments] = await Promise.all([
    patientIds.length ? Allergy.find({ patient_id: { $in: patientIds }, status: ALLERGY_STATUS.ACTIVE }).lean() : [],
    encounterIds.length ? VitalSign.find({ encounter_id: { $in: encounterIds }, status: VITAL_SIGN_STATUS.RECORDED }).sort({ recorded_at: -1 }).lean() : [],
    patientIds.length ? ConsentRecord.find({ patient_id: { $in: patientIds }, status: CONSENT_STATUS.ACTIVE }).lean() : [],
    patientIds.length ? Specimen.find({ patient_id: { $in: patientIds } }).sort({ created_at: -1 }).lean() : [],
    orderIds.length ? Attachment.find({ order_id: { $in: orderIds }, status: ATTACHMENT_STATUS.ACTIVE }).select('_id order_id category').lean() : [],
  ]);

  const allergyByPatient = new Map();
  const contrastAllergyByPatient = new Map();
  allergies.forEach((item) => {
    const patientId = normalizeId(item.patient_id);
    if (!allergyByPatient.has(patientId)) allergyByPatient.set(patientId, []);
    allergyByPatient.get(patientId).push(item);
    if (item.allergy_type === ALLERGY_TYPE.CONTRAST) {
      if (!contrastAllergyByPatient.has(patientId)) contrastAllergyByPatient.set(patientId, []);
      contrastAllergyByPatient.get(patientId).push(item);
    }
  });

  const latestVitalByEncounter = new Map();
  vitals.forEach((item) => {
    const encounterId = normalizeId(item.encounter_id);
    if (!latestVitalByEncounter.has(encounterId)) latestVitalByEncounter.set(encounterId, item);
  });

  const consentByPatientType = new Map();
  consents.forEach((item) => {
    consentByPatientType.set(`${normalizeId(item.patient_id)}:${item.consent_type}`, item);
  });

  const specimenByLabOrder = new Map();
  specimens.forEach((item) => {
    const labOrderId = normalizeId(item.lab_order_id);
    if (!specimenByLabOrder.has(labOrderId)) specimenByLabOrder.set(labOrderId, []);
    specimenByLabOrder.get(labOrderId).push(item);
  });

  const attachmentByOrder = new Map();
  attachments.forEach((item) => {
    const orderId = normalizeId(item.order_id);
    if (!attachmentByOrder.has(orderId)) attachmentByOrder.set(orderId, []);
    attachmentByOrder.get(orderId).push(item);
  });

  return {
    allergyByPatient,
    contrastAllergyByPatient,
    latestVitalByEncounter,
    consentByPatientType,
    specimenByLabOrder,
    attachmentByOrder,
  };
}

function buildRisks(preparation = {}, riskContext = {}) {
  const patientId = normalizeId(preparation.patient_id);
  const encounterId = normalizeId(preparation.encounter_id);
  const labOrderId = normalizeId(preparation.lab_order_id);
  const orderId = normalizeId(preparation.order_id);
  const imagingOrder = preparation.imaging_order_id || {};
  const consentType = activeConsentTypeForPreparation(preparation, imagingOrder);
  const consent = consentType ? riskContext.consentByPatientType?.get(`${patientId}:${consentType}`) : null;
  const hasAllergy = Boolean(riskContext.allergyByPatient?.get(patientId)?.length);
  const contrastRisk = Boolean(imagingOrder.contrast_required && riskContext.contrastAllergyByPatient?.get(patientId)?.length);
  const missingVital = [SOURCE_TYPE.PRE_EXAM, SOURCE_TYPE.IMAGING, SOURCE_TYPE.PROCEDURE].includes(preparation.source_type)
    && !riskContext.latestVitalByEncounter?.get(encounterId);
  return {
    has_allergy: hasAllergy,
    has_contrast_risk: contrastRisk,
    missing_consent: Boolean(consentType && !consent),
    missing_vital_sign: missingVital,
    missing_attachment: [SOURCE_TYPE.IMAGING, SOURCE_TYPE.PROCEDURE].includes(preparation.source_type)
      && !(riskContext.attachmentByOrder?.get(orderId)?.length),
    specimen_created: Boolean(riskContext.specimenByLabOrder?.get(labOrderId)?.length),
    overdue: computeSlaLevel(preparation.sla_due_at) === 'breached',
    blocked: preparation.status === PREPARATION_STATUS.BLOCKED,
    critical_checklist_failed: Boolean(preparation.safety_risk_codes?.length),
  };
}

function labOrderDto(labOrder = {}) {
  if (!labOrder || typeof labOrder !== 'object') return null;
  return {
    id: normalizeId(labOrder),
    lab_order_no: labOrder.lab_order_no,
    test_code: labOrder.test_code,
    test_name: labOrder.test_name,
    specimen_type: labOrder.specimen_type,
    priority: labOrder.priority,
    ordered_at: labOrder.ordered_at,
    collected_at: labOrder.collected_at,
    status: labOrder.status,
  };
}

function imagingOrderDto(imagingOrder = {}) {
  if (!imagingOrder || typeof imagingOrder !== 'object') return null;
  return {
    id: normalizeId(imagingOrder),
    imaging_order_no: imagingOrder.imaging_order_no,
    modality: imagingOrder.modality,
    body_part: imagingOrder.body_part,
    contrast_required: Boolean(imagingOrder.contrast_required),
    priority: imagingOrder.priority,
    ordered_at: imagingOrder.ordered_at,
    scheduled_at: imagingOrder.scheduled_at,
    room_id: normalizeId(imagingOrder.room_id),
    status: imagingOrder.status,
  };
}

function procedureOrderDto(procedureOrder = {}) {
  if (!procedureOrder || typeof procedureOrder !== 'object') return null;
  return {
    id: normalizeId(procedureOrder),
    procedure_order_no: procedureOrder.procedure_order_no,
    procedure_code: procedureOrder.procedure_code,
    procedure_name: procedureOrder.procedure_name,
    priority: procedureOrder.priority,
    scheduled_start: procedureOrder.scheduled_start,
    scheduled_end: procedureOrder.scheduled_end,
    performer: userName(procedureOrder.performer_id),
    status: procedureOrder.status,
  };
}

function preparationDto(preparation = {}, riskContext = {}, now = new Date()) {
  const prep = preparation && typeof preparation.toObject === 'function' ? preparation.toObject() : preparation;
  return {
    id: normalizeId(prep),
    preparation_no: prep.preparation_no,
    source_type: prep.source_type,
    title: prep.title,
    description: prep.description,
    status: prep.status,
    priority: prep.priority,
    sla_due_at: prep.sla_due_at,
    sla_level: computeSlaLevel(prep.sla_due_at, now),
    readiness_score: prep.readiness_score || 0,
    checklist_done: prep.checklist_done || 0,
    checklist_total: prep.checklist_total || 0,
    checklist_required_done: prep.checklist_required_done || 0,
    checklist_required_total: prep.checklist_required_total || 0,
    patient: patientDto(prep.patient_id),
    encounter: encounterDto(prep.encounter_id),
    queue: queueDto(prep.queue_ticket_id, now),
    order: orderDto(prep.order_id),
    lab_order: labOrderDto(prep.lab_order_id),
    imaging_order: imagingOrderDto(prep.imaging_order_id),
    procedure_order: procedureOrderDto(prep.procedure_order_id),
    department: departmentDto(prep.department_id),
    destination_department: departmentDto(prep.destination_department_id),
    risks: buildRisks(prep, riskContext),
    assigned_nurse: prep.assigned_nurse_id ? {
      id: normalizeId(prep.assigned_nurse_id),
      full_name: userName(prep.assigned_nurse_id),
    } : null,
    blocked_reason_code: prep.blocked_reason_code || null,
    blocked_reason_text: prep.blocked_reason_text || null,
    last_note: prep.last_note || null,
    last_activity_at: prep.last_activity_at || prep.updated_at,
    metadata: prep.metadata || {},
    allowed_actions: allowedActions(prep),
  };
}

async function listPreparationsWorklist(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query, DEFAULT_LIMIT, 200);
  const filter = await buildWorklistFilter(query, actor);
  const sort = query.sort === 'oldest'
    ? { sla_due_at: 1, priority: -1, created_at: 1 }
    : { status: 1, priority: -1, sla_due_at: 1, created_at: -1 };

  const [items, total, statusRows] = await Promise.all([
    ServicePreparation.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
      .populate({
        path: 'encounter_id',
        select: 'encounter_code encounter_type status start_time attending_doctor_id department_id',
        populate: [
          { path: 'attending_doctor_id', select: 'full_name employee_code username' },
          { path: 'department_id', select: 'department_code department_name' },
        ],
      })
      .populate('queue_ticket_id', 'queue_number display_number status nursing_stage checkin_time created_at')
      .populate('order_id', 'order_no order_type status priority clinical_indication ordered_at ordered_by department_id service_id')
      .populate('lab_order_id', 'lab_order_no test_code test_name specimen_type priority ordered_at collected_at status')
      .populate('imaging_order_id', 'imaging_order_no modality body_part contrast_required priority ordered_at scheduled_at room_id status')
      .populate('procedure_order_id', 'procedure_order_no procedure_code procedure_name priority scheduled_start scheduled_end performer_id status')
      .populate('department_id', 'department_code department_name')
      .populate('destination_department_id', 'department_code department_name')
      .populate('assigned_nurse_id', 'full_name employee_code username')
      .lean(),
    ServicePreparation.countDocuments(filter),
    ServicePreparation.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const riskContext = await buildRiskContext(items);
  const now = new Date();
  const summary = statusRows.reduce((output, row) => ({ ...output, [row._id]: row.count }), {});
  return {
    items: items.map((item) => preparationDto(item, riskContext, now)),
    summary: {
      total,
      pending: summary.pending || 0,
      assigned: summary.assigned || 0,
      in_progress: summary.in_progress || 0,
      ready: summary.ready || 0,
      blocked: summary.blocked || 0,
      transferred: summary.transferred || 0,
      completed: summary.completed || 0,
      overdue: await ServicePreparation.countDocuments({ ...filter, status: { $nin: TERMINAL_STATUSES }, sla_due_at: { $lt: now } }),
      stat: await ServicePreparation.countDocuments({ ...filter, priority: ORDER_PRIORITY.STAT }),
      missing_required: await ServicePreparation.countDocuments({
        ...filter,
        $expr: { $lt: ['$checklist_required_done', '$checklist_required_total'] },
      }),
      safety_risk: await ServicePreparation.countDocuments({ ...filter, has_safety_risk: true }),
    },
    pagination: buildPagination(page, limit, total),
  };
}

async function getPreparationOrThrow(preparationId, actor = {}) {
  const preparation = await ServicePreparation.findById(preparationId)
    .populate('patient_id', 'patient_code full_name gender date_of_birth phone')
    .populate({
      path: 'encounter_id',
      select: 'encounter_code encounter_type status start_time chief_reason attending_doctor_id department_id nursing_status ready_for_doctor_at',
      populate: [
        { path: 'attending_doctor_id', select: 'full_name employee_code username' },
        { path: 'department_id', select: 'department_code department_name' },
      ],
    })
    .populate('queue_ticket_id', 'queue_number display_number status nursing_stage checkin_time ready_for_doctor_at doctor_id department_id')
    .populate('order_id', 'order_no order_type status priority clinical_indication ordered_at ordered_by department_id service_id')
    .populate('lab_order_id', 'lab_order_no test_code test_name specimen_type priority ordered_at collected_at completed_at clinical_note status')
    .populate('imaging_order_id', 'imaging_order_no modality body_part contrast_required clinical_indication priority ordered_at scheduled_at room_id status')
    .populate('procedure_order_id', 'procedure_order_no procedure_code procedure_name priority clinical_indication scheduled_start scheduled_end performer_id status')
    .populate('department_id', 'department_code department_name')
    .populate('destination_department_id', 'department_code department_name')
    .populate('assigned_nurse_id', 'full_name employee_code username')
    .lean();
  if (!preparation) throw createError('Không tìm thấy ca chuẩn bị dịch vụ.', 404);

  if (!hasGlobalScope(actor)) {
    const departmentId = actorDepartmentId(actor);
    if (departmentId && preparation.department_id && !sameId(preparation.department_id, departmentId)) {
      throw createError('Bạn không có quyền xem ca chuẩn bị dịch vụ này.', 403);
    }
  }
  return preparation;
}

async function getPreparationDetail(preparationId, actor = {}) {
  const preparation = await getPreparationOrThrow(preparationId, actor);
  const [checklist, timeline, riskContext] = await Promise.all([
    getPreparationChecklist(preparationId, actor),
    getPreparationTimeline(preparationId, actor),
    buildRiskContext([preparation]),
  ]);
  return {
    preparation: preparationDto(preparation, riskContext),
    checklist: checklist.items,
    timeline: timeline.events,
  };
}

async function getPreparationChecklist(preparationId, actor = {}) {
  await getPreparationOrThrow(preparationId, actor);
  const items = await PreparationChecklistItem.find({ preparation_id: preparationId })
    .sort({ sort_order: 1, created_at: 1 })
    .populate('completed_by', 'full_name employee_code username')
    .populate('failed_by', 'full_name employee_code username')
    .populate('waived_by', 'full_name employee_code username')
    .populate('doctor_confirmed_by', 'full_name employee_code username')
    .populate('evidence_attachment_id', 'file_name original_name mime_type preview_url category')
    .lean();
  return { items };
}

async function getPreparationTimeline(preparationId, actor = {}) {
  await getPreparationOrThrow(preparationId, actor);
  const activities = await PreparationActivity.find({ preparation_id: preparationId })
    .sort({ created_at: 1 })
    .populate('actor_id', 'full_name employee_code username')
    .lean();
  return {
    events: activities.map((activity) => ({
      id: normalizeId(activity),
      event_type: activity.action,
      event_time: activity.created_at,
      title: activity.message || activity.action,
      actor: activity.actor_id ? {
        id: normalizeId(activity.actor_id),
        full_name: userName(activity.actor_id),
      } : null,
      metadata: activity.metadata || {},
    })),
  };
}

async function getPreparationContext(preparationId, actor = {}) {
  const preparation = await getPreparationOrThrow(preparationId, actor);
  const patientId = normalizeId(preparation.patient_id);
  const encounterId = normalizeId(preparation.encounter_id);
  const orderId = normalizeId(preparation.order_id);
  const [latestVitalSigns, allergies, problems, orders, labOrders, imagingOrders, procedureOrders, notes, attachments, consents, queueTicket] = await Promise.all([
    VitalSign.findOne({ encounter_id: encounterId, status: VITAL_SIGN_STATUS.RECORDED }).sort({ recorded_at: -1 }).lean(),
    Allergy.find({ patient_id: patientId, status: ALLERGY_STATUS.ACTIVE }).sort({ severity: -1, created_at: -1 }).lean(),
    ProblemList.find({ patient_id: patientId, status: PROBLEM_STATUS.ACTIVE }).sort({ created_at: -1 }).lean(),
    Order.find({ encounter_id: encounterId }).sort({ ordered_at: -1 }).lean(),
    LabOrder.find({ encounter_id: encounterId }).sort({ ordered_at: -1 }).lean(),
    ImagingOrder.find({ encounter_id: encounterId }).sort({ ordered_at: -1 }).lean(),
    ProcedureOrder.find({ encounter_id: encounterId }).sort({ scheduled_start: 1, created_at: -1 }).lean(),
    ClinicalNote.find({ encounter_id: encounterId }).sort({ created_at: -1 }).limit(12).lean(),
    Attachment.find({
      $or: compactObject({
        patient_id: patientId,
        encounter_id: encounterId,
        order_id: orderId,
      }).order_id ? [
          { patient_id: patientId },
          { encounter_id: encounterId },
          { order_id: orderId },
        ] : [
          { patient_id: patientId },
          { encounter_id: encounterId },
        ],
      status: ATTACHMENT_STATUS.ACTIVE,
    }).sort({ created_at: -1 }).limit(30).lean(),
    ConsentRecord.find({ patient_id: patientId, status: CONSENT_STATUS.ACTIVE }).sort({ signed_at: -1, created_at: -1 }).lean(),
    preparation.queue_ticket_id ? QueueTicket.findById(preparation.queue_ticket_id).lean() : QueueTicket.findOne({ encounter_id: encounterId }).sort({ created_at: -1 }).lean(),
  ]);

  return {
    patient: patientDto(preparation.patient_id),
    encounter: encounterDto(preparation.encounter_id),
    queue: queueDto(queueTicket || preparation.queue_ticket_id),
    latest_vital_signs: latestVitalSigns,
    allergies,
    problems,
    orders,
    lab_summary: { total: labOrders.length, items: labOrders },
    imaging_summary: { total: imagingOrders.length, items: imagingOrders },
    procedure_summary: { total: procedureOrders.length, items: procedureOrders },
    clinical_notes: notes,
    attachments,
    consent_records: consents,
  };
}

async function loadOrderPreparationContext(orderId, session = null) {
  const order = await withSession(Order.findById(orderId).lean(), session);
  if (!order) throw createError('Không tìm thấy order.', 404);
  const [encounter, queueTicket, labOrder, imagingOrder, procedureOrder] = await Promise.all([
    withSession(Encounter.findById(order.encounter_id).lean(), session),
    withSession(QueueTicket.findOne({ encounter_id: order.encounter_id }).sort({ created_at: -1 }).lean(), session),
    order.order_type === ORDER_TYPE.LAB ? withSession(LabOrder.findOne({ order_id: order._id }).lean(), session) : null,
    order.order_type === ORDER_TYPE.IMAGING ? withSession(ImagingOrder.findOne({ order_id: order._id }).lean(), session) : null,
    order.order_type === ORDER_TYPE.PROCEDURE ? withSession(ProcedureOrder.findOne({ order_id: order._id }).lean(), session) : null,
  ]);
  return { order, encounter, queue_ticket: queueTicket, lab_order: labOrder, imaging_order: imagingOrder, procedure_order: procedureOrder };
}

function sourceTypeFromOrder(order = {}) {
  if (order.order_type === ORDER_TYPE.LAB) return SOURCE_TYPE.LAB;
  if (order.order_type === ORDER_TYPE.IMAGING) return SOURCE_TYPE.IMAGING;
  if (order.order_type === ORDER_TYPE.PROCEDURE) return SOURCE_TYPE.PROCEDURE;
  if (order.order_type === ORDER_TYPE.SERVICE) return SOURCE_TYPE.SERVICE;
  if (order.order_type === ORDER_TYPE.NURSING) return SOURCE_TYPE.NURSING;
  return SOURCE_TYPE.OTHER;
}

async function ensurePreparationForOrder(orderId, actor = {}, requestMeta = {}, session = null, payload = {}) {
  const context = await loadOrderPreparationContext(orderId, session);
  const { order, encounter, queue_ticket: queueTicket, lab_order: labOrder, imaging_order: imagingOrder, procedure_order: procedureOrder } = context;
  if (!order || order.status === ORDER_STATUS.DRAFT) throw createError('Order chưa sẵn sàng tạo chuẩn bị dịch vụ.', 409);
  const sourceType = sourceTypeFromOrder(order);
  const child = labOrder || imagingOrder || procedureOrder || {};
  const existing = await withSession(ServicePreparation.findOne({ order_id: order._id }), session);
  if (existing) {
    await ensureChecklistForPreparation(existing, context, actor, session);
    return existing;
  }
  const preparationNo = payload.preparation_no || await generatePreparationNo({ session });
  const requestedAt = order.requested_at || order.ordered_at || new Date();
  const [preparation] = await ServicePreparation.create([{
    preparation_no: preparationNo,
    patient_id: order.patient_id,
    encounter_id: order.encounter_id,
    admission_id: order.admission_id,
    source_type: sourceType,
    order_id: order._id,
    lab_order_id: labOrder?._id,
    imaging_order_id: imagingOrder?._id,
    procedure_order_id: procedureOrder?._id,
    queue_ticket_id: queueTicket?._id,
    department_id: order.department_id || encounter?.department_id || actorDepartmentId(actor),
    destination_department_id: payload.destination_department_id,
    room_id: imagingOrder?.room_id || payload.room_id,
    title: payload.title || sourceTitle(sourceType, child, order, encounter),
    description: payload.description || order.clinical_indication,
    priority: order.priority || ORDER_PRIORITY.ROUTINE,
    status: payload.status || PREPARATION_STATUS.PENDING,
    assigned_nurse_id: payload.assigned_nurse_id,
    assigned_at: payload.assigned_nurse_id ? new Date() : undefined,
    sla_due_at: payload.sla_due_at ? parseDate(payload.sla_due_at, 'sla_due_at') : addMinutes(requestedAt, prepSlaMinutes(sourceType, order.priority)),
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  }], sessionOptions(session));
  await ensureChecklistForPreparation(preparation, context, actor, session);
  await createActivity(preparation, 'created', actor, 'Tạo ca chuẩn bị dịch vụ từ order.', { order_id: normalizeId(order) }, session);
  await publishPreparationEvent('created', preparation, actor, {}, requestMeta);
  return preparation;
}

async function createPreparationFromOrder(orderId, payload = {}, actor = {}, requestMeta = {}) {
  const preparation = await ensurePreparationForOrder(orderId, actor, requestMeta, null, payload);
  await recordAuditLog({
    actor,
    action: 'nursing.service_preparation.create_from_order',
    targetType: 'service_preparation',
    targetId: preparation._id,
    status: 'success',
    message: 'Tạo ca chuẩn bị dịch vụ từ order.',
    requestMeta,
  });
  return getPreparationDetail(preparation._id, actor);
}

async function ensurePreExamPreparationForQueue(ticketId, actor = {}, requestMeta = {}, payload = {}) {
  const ticket = await QueueTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  if (!ticket.encounter_id) throw createError('Queue ticket chưa có encounter.', 409);
  const encounter = await Encounter.findById(ticket.encounter_id).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  const existing = await ServicePreparation.findOne({ source_type: SOURCE_TYPE.PRE_EXAM, encounter_id: encounter._id });
  if (existing) {
    await ensureChecklistForPreparation(existing, { encounter, queue_ticket: ticket }, actor);
    return existing;
  }
  const preparationNo = payload.preparation_no || await generatePreparationNo();
  const baseTime = ticket.checkin_time || encounter.start_time || ticket.created_at || new Date();
  const [preparation] = await ServicePreparation.create([{
    preparation_no: preparationNo,
    patient_id: ticket.patient_id || encounter.patient_id,
    encounter_id: encounter._id,
    source_type: SOURCE_TYPE.PRE_EXAM,
    queue_ticket_id: ticket._id,
    department_id: ticket.department_id || encounter.department_id || actorDepartmentId(actor),
    title: payload.title || sourceTitle(SOURCE_TYPE.PRE_EXAM, {}, {}, encounter),
    description: payload.description || encounter.chief_reason,
    priority: ticket.queue_type === 'priority' || ticket.queue_type === 'vip' ? ORDER_PRIORITY.URGENT : ORDER_PRIORITY.ROUTINE,
    status: PREPARATION_STATUS.PENDING,
    sla_due_at: payload.sla_due_at ? parseDate(payload.sla_due_at, 'sla_due_at') : addMinutes(baseTime, prepSlaMinutes(SOURCE_TYPE.PRE_EXAM, ORDER_PRIORITY.ROUTINE)),
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  }]);
  await ensureChecklistForPreparation(preparation, { encounter, queue_ticket: ticket }, actor);
  await createActivity(preparation, 'created', actor, 'Tạo ca chuẩn bị trước khám.', { queue_ticket_id: normalizeId(ticket) });
  await publishPreparationEvent('created', preparation, actor, {}, requestMeta);
  return preparation;
}

async function createPreExamFromEncounter(encounterId, payload = {}, actor = {}, requestMeta = {}) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  const queueTicket = await QueueTicket.findOne({ encounter_id: encounter._id }).sort({ created_at: -1 }).lean();
  if (queueTicket) {
    const preparation = await ensurePreExamPreparationForQueue(queueTicket._id, actor, requestMeta, payload);
    return getPreparationDetail(preparation._id, actor);
  }
  const existing = await ServicePreparation.findOne({ source_type: SOURCE_TYPE.PRE_EXAM, encounter_id: encounter._id });
  if (existing) return getPreparationDetail(existing._id, actor);
  const preparationNo = payload.preparation_no || await generatePreparationNo();
  const [preparation] = await ServicePreparation.create([{
    preparation_no: preparationNo,
    patient_id: encounter.patient_id,
    encounter_id: encounter._id,
    source_type: SOURCE_TYPE.PRE_EXAM,
    department_id: encounter.department_id || actorDepartmentId(actor),
    title: payload.title || sourceTitle(SOURCE_TYPE.PRE_EXAM, {}, {}, encounter),
    description: payload.description || encounter.chief_reason,
    priority: payload.priority || ORDER_PRIORITY.ROUTINE,
    status: PREPARATION_STATUS.PENDING,
    sla_due_at: payload.sla_due_at ? parseDate(payload.sla_due_at, 'sla_due_at') : addMinutes(encounter.start_time || new Date(), prepSlaMinutes(SOURCE_TYPE.PRE_EXAM, ORDER_PRIORITY.ROUTINE)),
    metadata: payload.metadata || {},
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  }]);
  await ensureChecklistForPreparation(preparation, { encounter }, actor);
  await createActivity(preparation, 'created', actor, 'Tạo ca chuẩn bị trước khám từ encounter.', { encounter_id: normalizeId(encounter) });
  await publishPreparationEvent('created', preparation, actor, {}, requestMeta);
  return getPreparationDetail(preparation._id, actor);
}

async function transitionPreparation(preparationId, action, payload = {}, actor = {}, requestMeta = {}) {
  const preparation = await ServicePreparation.findById(preparationId);
  if (!preparation) throw createError('Không tìm thấy ca chuẩn bị dịch vụ.', 404);
  if (TERMINAL_STATUSES.includes(preparation.status) && !['add_note'].includes(action)) {
    throw createError('Ca chuẩn bị dịch vụ đã kết thúc, không thể cập nhật.', 409);
  }

  const actorId = actorUserId(actor);
  const now = new Date();
  let message = '';
  let metadata = {};

  if (action === 'assign') {
    preparation.status = PREPARATION_STATUS.ASSIGNED;
    preparation.assigned_nurse_id = payload.assigned_nurse_id ? toObjectId(payload.assigned_nurse_id, 'assigned_nurse_id') : actorId;
    preparation.assigned_at = now;
    message = 'Nhận/phân công ca chuẩn bị dịch vụ.';
  } else if (action === 'start') {
    preparation.status = PREPARATION_STATUS.IN_PROGRESS;
    preparation.assigned_nurse_id = preparation.assigned_nurse_id || actorId;
    preparation.assigned_at = preparation.assigned_at || now;
    preparation.started_by = preparation.started_by || actorId;
    preparation.started_at = preparation.started_at || now;
    message = 'Bắt đầu chuẩn bị dịch vụ.';
  } else if (action === 'block') {
    preparation.status = PREPARATION_STATUS.BLOCKED;
    preparation.blocked_by = actorId;
    preparation.blocked_at = now;
    preparation.blocked_reason_code = payload.reason_code || payload.blocked_reason_code;
    preparation.blocked_reason_text = payload.reason || payload.blocked_reason_text || payload.note;
    message = 'Đánh dấu ca chuẩn bị bị block.';
    metadata = { reason_code: preparation.blocked_reason_code, reason: preparation.blocked_reason_text };
  } else if (action === 'unblock') {
    preparation.status = preparation.assigned_nurse_id ? PREPARATION_STATUS.ASSIGNED : PREPARATION_STATUS.PENDING;
    preparation.blocked_by = undefined;
    preparation.blocked_at = undefined;
    preparation.blocked_reason_code = undefined;
    preparation.blocked_reason_text = undefined;
    message = 'Gỡ block ca chuẩn bị dịch vụ.';
  } else if (action === 'ready') {
    const current = await recomputePreparationStats(preparation._id);
    if (current.checklist_required_done < current.checklist_required_total && !payload.allow_incomplete) {
      throw createError('Checklist bắt buộc chưa hoàn tất.', 409);
    }
    preparation.status = PREPARATION_STATUS.READY;
    preparation.ready_by = actorId;
    preparation.ready_at = now;
    message = 'Đánh dấu sẵn sàng chuyển bước.';
  } else if (action === 'transfer') {
    preparation.status = PREPARATION_STATUS.TRANSFERRED;
    if (payload.destination_department_id) preparation.destination_department_id = toObjectId(payload.destination_department_id, 'destination_department_id');
    if (payload.room_id) preparation.room_id = toObjectId(payload.room_id, 'room_id');
    preparation.transferred_by = actorId;
    preparation.transferred_at = now;
    message = 'Bàn giao/chuyển bệnh nhân sang điểm đến.';
    metadata = { destination_department_id: normalizeId(preparation.destination_department_id), room_id: normalizeId(preparation.room_id) };
  } else if (action === 'complete') {
    preparation.status = PREPARATION_STATUS.COMPLETED;
    preparation.completed_by = actorId;
    preparation.completed_at = now;
    message = 'Hoàn tất chuẩn bị dịch vụ.';
  } else if (action === 'cancel') {
    preparation.status = PREPARATION_STATUS.CANCELLED;
    preparation.cancelled_by = actorId;
    preparation.cancelled_at = now;
    preparation.cancel_reason = payload.reason || payload.cancel_reason;
    message = 'Hủy ca chuẩn bị dịch vụ.';
    metadata = { reason: preparation.cancel_reason };
  } else if (action === 'notify-doctor') {
    message = payload.message || 'Báo bác sĩ từ ca chuẩn bị dịch vụ.';
    metadata = { doctor_id: payload.doctor_id, message };
  } else if (action === 'notify-destination') {
    message = payload.message || 'Báo điểm đến từ ca chuẩn bị dịch vụ.';
    metadata = { destination_department_id: payload.destination_department_id || normalizeId(preparation.destination_department_id), message };
  } else if (action === 'add-note') {
    const note = payload.note || payload.message;
    if (!note) throw createError('note là bắt buộc.', 400);
    preparation.last_note = note;
    message = 'Thêm ghi chú chuẩn bị dịch vụ.';
    metadata = { note };
  } else {
    throw createError('Hành động chuẩn bị dịch vụ không được hỗ trợ.', 400);
  }

  preparation.sla_level = computeSlaLevel(preparation.sla_due_at);
  preparation.updated_by = actorId;
  await preparation.save();

  if (action === 'ready' && preparation.source_type === SOURCE_TYPE.PRE_EXAM) {
    await Promise.all([
      preparation.queue_ticket_id ? QueueTicket.updateOne({ _id: preparation.queue_ticket_id }, {
        $set: {
          nursing_stage: NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR,
          ready_for_doctor_at: now,
          ready_for_doctor_by: actorId,
          nursing_stage_updated_at: now,
          nursing_stage_updated_by: actorId,
        },
      }) : null,
      Encounter.updateOne({ _id: preparation.encounter_id }, {
        $set: {
          nursing_status: NURSING_WORKFLOW_STATUS.READY_FOR_DOCTOR,
          ready_for_doctor_at: now,
          nursing_status_updated_at: now,
          nursing_status_updated_by: actorId,
        },
      }),
    ].filter(Boolean));
  }

  if (action === 'complete') {
    await Encounter.updateOne({ _id: preparation.encounter_id }, {
      $set: {
        preparation_completed_at: now,
        nursing_status_updated_at: now,
        nursing_status_updated_by: actorId,
      },
    });
  }

  const activityAction = action.replace(/-/g, '_');
  await createActivity(preparation, activityAction, actor, message, metadata);
  await publishPreparationEvent(activityAction, preparation, actor, metadata, requestMeta);
  await recordAuditLog({
    actor,
    action: `nursing.service_preparation.${activityAction}`,
    targetType: 'service_preparation',
    targetId: preparation._id,
    status: 'success',
    message,
    requestMeta,
    metadata,
  });
  return getPreparationDetail(preparation._id, actor);
}

async function updateChecklistItem(preparationId, itemId, payload = {}, actor = {}, requestMeta = {}, forcedStatus = null) {
  const preparation = await ServicePreparation.findById(preparationId);
  if (!preparation) throw createError('Không tìm thấy ca chuẩn bị dịch vụ.', 404);
  if (TERMINAL_STATUSES.includes(preparation.status)) throw createError('Ca chuẩn bị đã kết thúc, không thể cập nhật checklist.', 409);
  const item = await PreparationChecklistItem.findOne({ _id: itemId, preparation_id: preparation._id });
  if (!item) throw createError('Không tìm thấy mục checklist.', 404);
  const actorId = actorUserId(actor);
  const now = new Date();
  const nextStatus = forcedStatus || payload.status || item.status;

  if (!PreparationChecklistItem.STATUSES.includes(nextStatus)) throw createError('Trạng thái checklist không hợp lệ.', 400);
  item.status = nextStatus;
  if (payload.value !== undefined) item.value = payload.value;
  if (payload.note !== undefined) item.note = payload.note;

  if (nextStatus === 'done') {
    item.value = payload.value !== undefined ? payload.value : true;
    item.completed_by = actorId;
    item.completed_at = now;
    item.failed_by = undefined;
    item.failed_at = undefined;
    item.failed_reason = undefined;
  }
  if (nextStatus === 'failed') {
    item.failed_by = actorId;
    item.failed_at = now;
    item.failed_reason = payload.reason || payload.failed_reason;
  }
  if (nextStatus === 'waived') {
    item.waived_by = actorId;
    item.waived_at = now;
    item.waived_reason = payload.reason || payload.waived_reason;
  }
  if (payload.evidence_attachment_id) {
    item.evidence_attachment_id = toObjectId(payload.evidence_attachment_id, 'evidence_attachment_id');
  }
  if (payload.doctor_confirmed) {
    item.doctor_confirmed_by = actorId;
    item.doctor_confirmed_at = now;
  }
  await item.save();

  const updatedPreparation = await recomputePreparationStats(preparation._id);
  if ([PREPARATION_STATUS.PENDING, PREPARATION_STATUS.ASSIGNED].includes(updatedPreparation.status) && updatedPreparation.checklist_done > 0) {
    updatedPreparation.status = PREPARATION_STATUS.IN_PROGRESS;
    updatedPreparation.started_by = updatedPreparation.started_by || actorId;
    updatedPreparation.started_at = updatedPreparation.started_at || now;
    await updatedPreparation.save();
  }

  const activityAction = nextStatus === 'done'
    ? 'checklist_item_done'
    : nextStatus === 'failed'
      ? 'checklist_item_failed'
      : nextStatus === 'waived'
        ? 'checklist_item_waived'
        : 'checklist_item_updated';
  await createActivity(updatedPreparation, activityAction, actor, `Cập nhật checklist: ${item.label}.`, {
    checklist_item_id: normalizeId(item),
    code: item.code,
    status: item.status,
  });
  await publishPreparationEvent(activityAction, updatedPreparation, actor, {
    checklist_item_id: normalizeId(item),
    code: item.code,
    status: item.status,
  }, requestMeta);
  return getPreparationDetail(preparation._id, actor);
}

async function attachChecklistEvidence(preparationId, itemId, payload = {}, actor = {}, requestMeta = {}) {
  if (!payload.attachment_id && !payload.evidence_attachment_id) throw createError('attachment_id là bắt buộc.', 400);
  const result = await updateChecklistItem(preparationId, itemId, {
    evidence_attachment_id: payload.attachment_id || payload.evidence_attachment_id,
    note: payload.note,
  }, actor, requestMeta);
  const preparation = await ServicePreparation.findById(preparationId).lean();
  await createActivity(preparation, 'evidence_attached', actor, 'Gắn bằng chứng cho checklist.', { item_id: itemId });
  return result;
}

async function updatePreparationMetadataAction(preparationId, action, payload = {}, actor = {}, requestMeta = {}) {
  const preparation = await ServicePreparation.findById(preparationId);
  if (!preparation) throw createError('Không tìm thấy ca chuẩn bị dịch vụ.', 404);
  const metadata = preparation.metadata || {};
  const actorId = actorUserId(actor);
  const now = new Date();
  const lab = metadata.lab || {};
  const consent = metadata.consent || {};
  let message = '';

  if (action === 'print_specimen_label') {
    lab.barcode_printed_at = now;
    lab.barcode_printed_by = actorId;
    lab.label_print_count = Number(lab.label_print_count || 0) + 1;
    message = 'In nhãn mẫu xét nghiệm.';
  } else if (action === 'scan_specimen_label') {
    lab.barcode_scanned_at = now;
    lab.barcode_scanned_by = actorId;
    lab.scanned_barcode = payload.barcode || payload.specimen_no;
    message = 'Quét nhãn mẫu xét nghiệm.';
  } else if (action === 'handoff_lab') {
    lab.handoff_to_lab_at = now;
    lab.handoff_to_lab_by = actorId;
    lab.transport_condition = payload.transport_condition;
    message = 'Bàn giao mẫu cho lab.';
  } else if (action === 'request_recollect') {
    lab.recollect_required = true;
    lab.recollect_reason = payload.reason || payload.recollect_reason;
    preparation.status = PREPARATION_STATUS.BLOCKED;
    preparation.blocked_by = actorId;
    preparation.blocked_at = now;
    preparation.blocked_reason_code = 'recollect_required';
    preparation.blocked_reason_text = lab.recollect_reason;
    message = 'Yêu cầu lấy lại mẫu.';
  } else if (action === 'link_consent') {
    consent.consent_record_id = payload.consent_record_id || payload.consent_id;
    consent.linked_at = now;
    consent.linked_by = actorId;
    message = 'Liên kết consent với ca chuẩn bị.';
  } else {
    throw createError('Hành động metadata không được hỗ trợ.', 400);
  }

  preparation.metadata = { ...metadata, lab, consent };
  preparation.updated_by = actorId;
  await preparation.save();
  await createActivity(preparation, action === 'request_recollect' ? 'blocked' : 'checklist_item_updated', actor, message, { action, payload });
  await publishPreparationEvent(action === 'request_recollect' ? 'blocked' : 'checklist_item_updated', preparation, actor, { action }, requestMeta);
  return getPreparationDetail(preparation._id, actor);
}

async function bulkAction(action, payload = {}, actor = {}, requestMeta = {}) {
  const ids = Array.isArray(payload.ids) ? payload.ids : payload.preparation_ids || [];
  if (!ids.length) throw createError('preparation_ids là bắt buộc.', 400);
  const results = [];
  for (const id of ids) {
    try {
      if (action === 'bulk-print') {
        const detail = await getPreparationDetail(id, actor);
        results.push({ id, status: 'ok', preparation: detail.preparation });
      } else {
        const normalizedAction = action.replace(/^bulk-/, '');
        const result = await transitionPreparation(id, normalizedAction, payload, actor, requestMeta);
        results.push({ id, status: 'ok', preparation: result.preparation });
      }
    } catch (error) {
      results.push({ id, status: 'failed', error: error.message });
    }
  }
  return {
    total: ids.length,
    success: results.filter((item) => item.status === 'ok').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results,
  };
}

async function getDashboardSummary(query = {}, actor = {}) {
  const data = await listPreparationsWorklist({ ...query, limit: 1 }, actor);
  return data.summary;
}

async function listChecklistTemplates(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query, 50, 200);
  const filter = {};
  if (query.source_type) filter.source_type = query.source_type;
  if (query.is_active !== undefined) filter.is_active = String(query.is_active) === 'true';
  if (query.keyword || query.search) {
    const regex = { $regex: escapeRegex(query.keyword || query.search), $options: 'i' };
    filter.$or = [{ template_code: regex }, { name: regex }, { test_code: regex }, { procedure_code: regex }];
  }
  applyPreparationScope(filter, actor, query);
  delete filter.department_id;
  const [items, total] = await Promise.all([
    PreparationChecklistTemplate.find(filter).sort({ source_type: 1, is_default: -1, version: -1 }).skip(skip).limit(limit).lean(),
    PreparationChecklistTemplate.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

function validateTemplatePayload(payload = {}, partial = false) {
  const required = ['template_code', 'name', 'source_type'];
  if (!partial) {
    for (const field of required) {
      if (!payload[field]) throw createError(`${field} là bắt buộc.`, 400);
    }
  }
  if (payload.items && !Array.isArray(payload.items)) throw createError('items phải là mảng.', 400);
  return payload;
}

async function createChecklistTemplate(payload = {}, actor = {}, requestMeta = {}) {
  validateTemplatePayload(payload);
  const template = await PreparationChecklistTemplate.create({
    template_code: payload.template_code,
    name: payload.name,
    source_type: payload.source_type,
    order_type: payload.order_type,
    modality: payload.modality,
    procedure_code: payload.procedure_code,
    test_code: payload.test_code,
    specimen_type: payload.specimen_type,
    service_id: payload.service_id,
    department_id: payload.department_id,
    version: payload.version || 1,
    is_default: Boolean(payload.is_default),
    is_active: payload.is_active !== false,
    items: payload.items || [],
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'nursing.preparation_template.create', targetType: 'preparation_checklist_template', targetId: template._id, status: 'success', message: 'Tạo template checklist chuẩn bị.', requestMeta });
  return template;
}

async function updateChecklistTemplate(templateId, payload = {}, actor = {}, requestMeta = {}) {
  validateTemplatePayload(payload, true);
  const template = await PreparationChecklistTemplate.findById(templateId);
  if (!template) throw createError('Không tìm thấy template checklist.', 404);
  [
    'name',
    'source_type',
    'order_type',
    'modality',
    'procedure_code',
    'test_code',
    'specimen_type',
    'service_id',
    'department_id',
    'version',
    'is_default',
    'is_active',
    'items',
  ].forEach((field) => {
    if (payload[field] !== undefined) template[field] = payload[field];
  });
  template.updated_by = actorUserId(actor);
  await template.save();
  await recordAuditLog({ actor, action: 'nursing.preparation_template.update', targetType: 'preparation_checklist_template', targetId: template._id, status: 'success', message: 'Cập nhật template checklist chuẩn bị.', requestMeta });
  return template;
}

async function cloneChecklistTemplate(templateId, payload = {}, actor = {}, requestMeta = {}) {
  const template = await PreparationChecklistTemplate.findById(templateId).lean();
  if (!template) throw createError('Không tìm thấy template checklist.', 404);
  return createChecklistTemplate({
    ...template,
    _id: undefined,
    template_code: payload.template_code || `${template.template_code}_COPY_${Date.now()}`,
    name: payload.name || `${template.name} - bản sao`,
    version: payload.version || 1,
    is_active: payload.is_active ?? true,
  }, actor, requestMeta);
}

async function previewChecklistTemplate(query = {}, actor = {}) {
  const sourceType = query.source_type || SOURCE_TYPE.PRE_EXAM;
  const items = await buildChecklistItems(sourceType, query);
  return { source_type: sourceType, items };
}

module.exports = {
  listPreparationsWorklist,
  getDashboardSummary,
  getPreparationDetail,
  getPreparationChecklist,
  getPreparationTimeline,
  getPreparationContext,
  createPreparationFromOrder,
  createPreExamFromEncounter,
  ensurePreparationForOrder,
  ensurePreExamPreparationForQueue,
  transitionPreparation,
  updateChecklistItem,
  attachChecklistEvidence,
  printSpecimenLabel: (id, payload, actor, requestMeta) => updatePreparationMetadataAction(id, 'print_specimen_label', payload, actor, requestMeta),
  scanSpecimenLabel: (id, payload, actor, requestMeta) => updatePreparationMetadataAction(id, 'scan_specimen_label', payload, actor, requestMeta),
  handoffLab: (id, payload, actor, requestMeta) => updatePreparationMetadataAction(id, 'handoff_lab', payload, actor, requestMeta),
  requestRecollect: (id, payload, actor, requestMeta) => updatePreparationMetadataAction(id, 'request_recollect', payload, actor, requestMeta),
  linkConsent: (id, payload, actor, requestMeta) => updatePreparationMetadataAction(id, 'link_consent', payload, actor, requestMeta),
  bulkAssign: (payload, actor, requestMeta) => bulkAction('bulk-assign', payload, actor, requestMeta),
  bulkStart: (payload, actor, requestMeta) => bulkAction('bulk-start', payload, actor, requestMeta),
  bulkReady: (payload, actor, requestMeta) => bulkAction('bulk-ready', payload, actor, requestMeta),
  bulkNotify: (payload, actor, requestMeta) => bulkAction('bulk-notify-doctor', payload, actor, requestMeta),
  bulkTransfer: (payload, actor, requestMeta) => bulkAction('bulk-transfer', payload, actor, requestMeta),
  bulkPrint: (payload, actor, requestMeta) => bulkAction('bulk-print', payload, actor, requestMeta),
  listChecklistTemplates,
  createChecklistTemplate,
  updateChecklistTemplate,
  cloneChecklistTemplate,
  previewChecklistTemplate,
};
