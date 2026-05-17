const {
  Appointment,
  Attachment,
  AuditLog,
  Conversation,
  ConversationParticipant,
  DocumentExportRequest,
  ImagingReport,
  InsurancePolicy,
  Invoice,
  LabResult,
  Message,
  Notification,
  Patient,
  PatientAccount,
  PatientAuthorization,
  PatientProfileChangeRequest,
  PatientRelative,
  Prescription,
  QueueTicket,
  User,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  ACTIVE_APPOINTMENT_STATUSES,
  ACTIVE_QUEUE_STATUSES,
  ACTOR_TYPE,
  ATTACHMENT_ENTITY_TYPE,
  ATTACHMENT_STATUS,
  AUTHORIZATION_STATUS,
  AUTHORIZATION_TYPE,
  CONVERSATION_STATUS,
  CONVERSATION_TYPE,
  DOCUMENT_EXPORT_STATUS,
  DOCUMENT_EXPORT_TYPE,
  DOCUMENT_REVIEW_STATUS,
  DOCUMENT_SOURCE,
  DOCUMENT_VISIBILITY,
  REALTIME_EVENT_TYPE,
  GENDERS,
  IMAGING_REPORT_STATUS,
  INSURANCE_POLICY_STATUS,
  INVOICE_STATUS,
  LAB_RESULT_STATUS,
  MESSAGE_STATUS,
  NOTIFICATION_STATUS,
  PATIENT_PROFILE_CHANGE_STATUS,
  PATIENT_PROFILE_CHANGE_TYPE,
  PATIENT_PROFILE_CHANGE_TYPES,
  PRESCRIPTION_STATUS,
} = require('../constants/statuses');
const { buildPagination, createError, getPagination, recordAuditLog } = require('./core.service');
const { generateDateCode } = require('./code-generator.service');
const actorContext = require('../common/actors');
const eventBus = require('../events/event-bus.service');
const permissionService = require('./permission.service');
const patientService = require('./patient.service');
const { isValidObjectId, toObjectId } = require('../common/helpers/object-id.helper');

const UNREAD_NOTIFICATION_STATUSES = [
  NOTIFICATION_STATUS.QUEUED,
  NOTIFICATION_STATUS.SENT,
  NOTIFICATION_STATUS.DELIVERED,
];

const OPEN_CONVERSATION_STATUSES = [
  CONVERSATION_STATUS.OPEN,
  CONVERSATION_STATUS.PENDING,
];

const ACTIVE_PRESCRIPTION_STATUSES = [
  PRESCRIPTION_STATUS.ACTIVE,
  PRESCRIPTION_STATUS.VERIFIED,
  PRESCRIPTION_STATUS.PARTIALLY_DISPENSED,
];

const RELEASED_LAB_RESULT_STATUSES = [
  LAB_RESULT_STATUS.FINAL,
  LAB_RESULT_STATUS.AMENDED,
];

const RELEASED_IMAGING_REPORT_STATUSES = [
  IMAGING_REPORT_STATUS.FINAL,
  IMAGING_REPORT_STATUS.AMENDED,
];

const PROFILE_CHANGE_FIELDS = {
  [PATIENT_PROFILE_CHANGE_TYPE.BASIC_INFO]: ['full_name', 'date_of_birth', 'gender'],
  [PATIENT_PROFILE_CHANGE_TYPE.CONTACT]: ['phone', 'email'],
  [PATIENT_PROFILE_CHANGE_TYPE.ADDRESS]: ['address'],
  [PATIENT_PROFILE_CHANGE_TYPE.IDENTITY]: ['national_id', 'insurance_number'],
  [PATIENT_PROFILE_CHANGE_TYPE.EMERGENCY_CONTACT]: ['emergency_contact_name', 'emergency_contact_phone'],
};

const ACCESS_LOG_TARGET_TYPES = [
  'patient',
  'appointment',
  'encounter',
  'lab_result',
  'imaging_report',
  'prescription',
  'medical_record',
  'attachment',
  'invoice',
  'payment',
  'insurance_claim',
];

const RELATIVE_AUTHORIZATION_SCOPE_ALIASES = {
  [AUTHORIZATION_TYPE.VIEW_RECORDS]: [
    AUTHORIZATION_TYPE.VIEW_RECORDS,
    AUTHORIZATION_TYPE.RECORD_READ,
    AUTHORIZATION_TYPE.LAB_RESULT_READ,
    AUTHORIZATION_TYPE.IMAGING_REPORT_READ,
    AUTHORIZATION_TYPE.PRESCRIPTION_READ,
  ],
  [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]: [
    AUTHORIZATION_TYPE.BOOK_APPOINTMENTS,
    AUTHORIZATION_TYPE.APPOINTMENT_READ,
    AUTHORIZATION_TYPE.APPOINTMENT_MANAGE,
  ],
  [AUTHORIZATION_TYPE.BILLING]: [
    AUTHORIZATION_TYPE.BILLING,
    AUTHORIZATION_TYPE.BILLING_READ,
    AUTHORIZATION_TYPE.BILLING_PAY,
  ],
};

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function hasOwn(payload, field) {
  return Object.prototype.hasOwnProperty.call(payload || {}, field);
}

function compactObject(payload = {}) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function normalizeScope(value) {
  return value ? String(value).trim() : value;
}

function expandAuthorizationScopes(scopeOrScopes = AUTHORIZATION_TYPE.VIEW_RECORDS) {
  const requested = Array.isArray(scopeOrScopes) ? scopeOrScopes : [scopeOrScopes];
  const scopes = new Set([AUTHORIZATION_TYPE.FULL_ACCESS]);
  requested.map(normalizeScope).filter(Boolean).forEach((scope) => {
    scopes.add(scope);
    (RELATIVE_AUTHORIZATION_SCOPE_ALIASES[scope] || []).forEach((alias) => scopes.add(alias));
  });
  return [...scopes];
}

function actorType(actor = {}) {
  return actorContext.getActorType(actor);
}

function actorId(actor = {}) {
  return actorContext.getActorId(actor);
}

function isRelativeActor(actor = {}) {
  return actorType(actor) === ACTOR_TYPE.PATIENT_RELATIVE;
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function buildActorSnapshot(actor = {}) {
  const context = actorContext.buildActorContext(actor);
  return {
    actor_type: context.actor_type,
    actor_id: context.actor_id,
    session_id: isValidObjectId(context.session_id) ? context.session_id : undefined,
  };
}

async function hasRelativeAuthorization(relativeId, patientId, authorizationTypes = [AUTHORIZATION_TYPE.VIEW_RECORDS]) {
  if (!relativeId || !patientId) return false;
  const now = new Date();
  const types = expandAuthorizationScopes(authorizationTypes);

  return Boolean(await PatientAuthorization.exists({
    patient_id: patientId,
    relative_id: relativeId,
    status: AUTHORIZATION_STATUS.ACTIVE,
    is_deleted: false,
    valid_from: { $lte: now },
    $and: [
      {
        $or: [
          { valid_to: null },
          { valid_to: { $exists: false } },
          { valid_to: { $gte: now } },
        ],
      },
      {
        $or: [
          { authorization_type: { $in: types } },
          { permissions: { $in: types } },
        ],
      },
    ],
  }));
}

async function resolvePortalPatient(actor = {}, authorizationTypes = [AUTHORIZATION_TYPE.VIEW_RECORDS]) {
  const type = actorType(actor);
  const patientId = actor.patientId || actor.patient_id;

  if (!patientId) {
    throw createError('Không xác định được hồ sơ bệnh nhân của phiên portal.', 403);
  }

  const patient = await Patient.findOne({ _id: patientId, is_deleted: false }).lean();
  if (!patient) throw createError('Không tìm thấy hồ sơ bệnh nhân.', 404);

  if (type === ACTOR_TYPE.PATIENT) {
    return patient;
  }

  if (type === ACTOR_TYPE.PATIENT_RELATIVE) {
    const relativeId = actor.relativeId || actor.relative_id || actorId(actor);
    const authorized = await hasRelativeAuthorization(relativeId, patient._id, authorizationTypes);
    if (!authorized) {
      throw createError('Người nhà chưa có ủy quyền phù hợp để truy cập portal của bệnh nhân này.', 403);
    }
    return patient;
  }

  throw createError('Chỉ tài khoản bệnh nhân/người nhà được dùng portal cá nhân.', 403);
}

function notificationRecipientFilter(actor = {}) {
  if (actorType(actor) === ACTOR_TYPE.PATIENT) {
    const accountId = actor.patientAccountId || actor.patient_account_id || actorId(actor);
    return {
      recipient_type: 'patient',
      $or: [
        { recipient_id: accountId },
        { patient_account_id: accountId },
      ],
    };
  }

  if (isRelativeActor(actor)) {
    const relativeId = actor.relativeId || actor.relative_id || actorId(actor);
    return {
      recipient_type: 'relative',
      $or: [
        { recipient_id: relativeId },
        { relative_id: relativeId },
      ],
    };
  }

  return { _id: null };
}

async function countUnreadMessages(actor = {}) {
  const snapshot = buildActorSnapshot(actor);
  const participants = await ConversationParticipant.find({
    actor_type: snapshot.actor_type,
    actor_id: snapshot.actor_id,
    archived: false,
    $or: [
      { left_at: null },
      { left_at: { $exists: false } },
    ],
  }).lean();

  if (participants.length === 0) return 0;

  const counts = await Promise.all(participants.map((participant) => {
    const filter = {
      conversation_id: participant.conversation_id,
      status: { $ne: MESSAGE_STATUS.DELETED },
      sender_actor_type: { $ne: snapshot.actor_type },
      is_internal_note: false,
    };
    if (participant.last_read_at) filter.created_at = { $gt: participant.last_read_at };
    return Message.countDocuments(filter);
  }));

  return counts.reduce((sum, count) => sum + count, 0);
}

function dashboardLimit(value, fallback = 5) {
  const limit = Number(value || fallback);
  return Math.min(Math.max(limit || fallback, 1), 20);
}

async function getMyDashboard(actor = {}, query = {}) {
  const patient = await resolvePortalPatient(actor);
  const patientId = patient._id;
  const now = new Date();
  const limit = dashboardLimit(query.limit);
  const insuranceExpiryTo = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

  const [
    upcomingAppointments,
    currentQueueTicket,
    unpaidInvoices,
    newLabResults,
    newImagingReports,
    activePrescriptions,
    unreadNotifications,
    openSupportConversations,
    unreadMessagesCount,
    expiringInsurancePolicies,
  ] = await Promise.all([
    Appointment.find({
      patient_id: patientId,
      is_deleted: false,
      appointment_time: { $gte: now },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    }).sort({ appointment_time: 1 }).limit(limit).lean(),
    QueueTicket.findOne({
      patient_id: patientId,
      status: { $in: ACTIVE_QUEUE_STATUSES },
    }).sort({ queue_date: -1, created_at: -1 }).lean(),
    Invoice.find({
      patient_id: patientId,
      balance_due: { $gt: 0 },
      status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID] },
    }).sort({ due_at: 1, issued_at: -1 }).limit(limit).lean(),
    LabResult.find({
      patient_id: patientId,
      released_to_patient: true,
      status: { $in: RELEASED_LAB_RESULT_STATUSES },
    }).sort({ released_at: -1, reported_at: -1, created_at: -1 }).limit(limit).lean(),
    ImagingReport.find({
      patient_id: patientId,
      released_to_patient: true,
      status: { $in: RELEASED_IMAGING_REPORT_STATUSES },
    }).sort({ released_at: -1, reported_at: -1, created_at: -1 }).limit(limit).lean(),
    Prescription.find({
      patient_id: patientId,
      is_current: true,
      status: { $in: ACTIVE_PRESCRIPTION_STATUSES },
    }).sort({ prescribed_at: -1 }).limit(limit).lean(),
    Notification.countDocuments({
      ...notificationRecipientFilter(actor),
      status: { $in: UNREAD_NOTIFICATION_STATUSES },
      read_at: null,
    }),
    Conversation.countDocuments({
      patient_id: patientId,
      type: CONVERSATION_TYPE.SUPPORT,
      status: { $in: OPEN_CONVERSATION_STATUSES },
    }),
    countUnreadMessages(actor),
    InsurancePolicy.find({
      patient_id: patientId,
      is_deleted: false,
      status: INSURANCE_POLICY_STATUS.ACTIVE,
      valid_to: { $gte: now, $lte: insuranceExpiryTo },
    }).sort({ valid_to: 1 }).limit(limit).lean(),
  ]);

  return {
    patient_id: toId(patientId),
    generated_at: now,
    upcoming_appointments: upcomingAppointments,
    current_queue_ticket: currentQueueTicket,
    unpaid_invoices: unpaidInvoices,
    new_lab_results: newLabResults,
    new_imaging_reports: newImagingReports,
    active_prescriptions: activePrescriptions,
    unread_notifications_count: unreadNotifications,
    open_support_tickets_count: openSupportConversations,
    open_support_conversations_count: openSupportConversations,
    unread_messages_count: unreadMessagesCount,
    expiring_insurance_policies: expiringInsurancePolicies,
  };
}

function normalizeProfileChangeValue(changeType, payload = {}) {
  if (!PATIENT_PROFILE_CHANGE_TYPES.includes(changeType)) {
    throw createError('change_type không hợp lệ.', 422);
  }

  const source = payload.new_value && typeof payload.new_value === 'object'
    ? payload.new_value
    : payload;
  const allowedFields = PROFILE_CHANGE_FIELDS[changeType] || [];
  const value = {};

  for (const field of allowedFields) {
    if (hasOwn(source, field)) value[field] = source[field];
  }

  if (changeType === PATIENT_PROFILE_CHANGE_TYPE.BASIC_INFO && hasOwn(value, 'gender') && !GENDERS.includes(value.gender)) {
    throw createError('gender không hợp lệ.', 422);
  }

  if (Object.keys(value).length === 0) {
    throw createError('new_value không có trường hợp lệ cho change_type đã chọn.', 422);
  }

  return value;
}

function pickPatientFields(patient = {}, fields = []) {
  return compactObject(Object.fromEntries(fields.map((field) => [field, patient[field]])));
}

async function createProfileChangeRequest(actor = {}, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const changeType = payload.change_type || payload.changeType;
  const newValue = normalizeProfileChangeValue(changeType, payload);
  const oldValueSnapshot = pickPatientFields(patient, PROFILE_CHANGE_FIELDS[changeType]);
  const changedFields = Object.keys(newValue);

  const pendingRequests = await PatientProfileChangeRequest.find({
    patient_id: patient._id,
    change_type: changeType,
    status: PATIENT_PROFILE_CHANGE_STATUS.PENDING,
  }).select('_id new_value').lean();
  const duplicate = pendingRequests.find((request) => {
    const pendingValue = request.new_value || {};
    return changedFields.some((field) => hasOwn(pendingValue, field));
  });
  if (duplicate) {
    throw createError('Đã có yêu cầu thay đổi pending cho một trong các trường này.', 409);
  }

  const request = await PatientProfileChangeRequest.create({
    patient_id: patient._id,
    requested_by_actor: buildActorSnapshot(actor),
    change_type: changeType,
    old_value_snapshot: oldValueSnapshot,
    new_value: newValue,
    status: PATIENT_PROFILE_CHANGE_STATUS.PENDING,
    reason: payload.reason,
  });

  await recordAuditLog({
    actor,
    action: 'portal.profile_change_request.create',
    targetType: 'patient_profile_change_request',
    targetId: request._id,
    status: 'success',
    message: 'Tạo yêu cầu thay đổi hồ sơ bệnh nhân.',
    requestMeta,
    metadata: {
      patient_id: toId(patient._id),
      change_type: changeType,
    },
    after: request.toObject(),
  });

  return request.toObject();
}

async function listProfileChangeRequests(actor = {}, query = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const { page, limit, skip } = getPagination(query);
  const filter = { patient_id: patient._id };
  if (query.status) filter.status = query.status;
  if (query.change_type) filter.change_type = query.change_type;

  const [items, total] = await Promise.all([
    PatientProfileChangeRequest.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    PatientProfileChangeRequest.countDocuments(filter),
  ]);

  return { items, pagination: buildPagination(page, limit, total) };
}

function assertCanReviewProfileChange(changeRequest, actor = {}) {
  if (changeRequest.change_type === PATIENT_PROFILE_CHANGE_TYPE.IDENTITY) {
    if (!hasPermission(actor, PERMISSION.PATIENTS.UPDATE_SENSITIVE)) {
      throw createError('Duyệt thay đổi định danh cần quyền patients.update_sensitive.', 403);
    }
    return;
  }

  if (!permissionService.hasAnyPermission(actor.permissions || [], [
    PERMISSION.PATIENTS.UPDATE,
    PERMISSION.PATIENTS.UPDATE_BASIC,
    PERMISSION.PATIENTS.UPDATE_SENSITIVE,
  ])) {
    throw createError('Tài khoản hiện tại không có quyền duyệt thay đổi hồ sơ bệnh nhân.', 403);
  }
}

async function approveProfileChangeRequest(patientId, requestId, actor = {}, payload = {}, requestMeta = {}) {
  const changeRequest = await PatientProfileChangeRequest.findOne({
    _id: requestId,
    patient_id: patientId,
  });

  if (!changeRequest) throw createError('Không tìm thấy yêu cầu thay đổi hồ sơ.', 404);
  if (changeRequest.status !== PATIENT_PROFILE_CHANGE_STATUS.PENDING) {
    throw createError('Chỉ yêu cầu pending mới được duyệt.', 409);
  }

  assertCanReviewProfileChange(changeRequest, actor);

  const before = changeRequest.toObject();
  await patientService.updatePatient(patientId, changeRequest.new_value, {
    ...actor,
    allowVerifiedIdentityOverride: true,
  }, requestMeta);

  changeRequest.status = PATIENT_PROFILE_CHANGE_STATUS.APPROVED;
  changeRequest.reviewed_by = buildActorSnapshot(actor);
  changeRequest.reviewed_at = new Date();
  changeRequest.reason = payload.reason || changeRequest.reason;
  await changeRequest.save();

  await recordAuditLog({
    actor,
    action: 'portal.profile_change_request.approve',
    targetType: 'patient_profile_change_request',
    targetId: changeRequest._id,
    status: 'success',
    message: 'Duyệt yêu cầu thay đổi hồ sơ bệnh nhân.',
    requestMeta,
    before,
    after: changeRequest.toObject(),
    metadata: {
      patient_id: toId(patientId),
      change_type: changeRequest.change_type,
    },
  });

  return changeRequest.toObject();
}

async function rejectProfileChangeRequest(patientId, requestId, actor = {}, payload = {}, requestMeta = {}) {
  const changeRequest = await PatientProfileChangeRequest.findOne({
    _id: requestId,
    patient_id: patientId,
  });

  if (!changeRequest) throw createError('Không tìm thấy yêu cầu thay đổi hồ sơ.', 404);
  if (changeRequest.status !== PATIENT_PROFILE_CHANGE_STATUS.PENDING) {
    throw createError('Chỉ yêu cầu pending mới được từ chối.', 409);
  }

  assertCanReviewProfileChange(changeRequest, actor);
  const reason = payload.reason || payload.reject_reason;
  if (!reason) {
    throw createError('reject_reason là bắt buộc khi từ chối yêu cầu thay đổi hồ sơ.', 422);
  }

  const before = changeRequest.toObject();
  changeRequest.status = PATIENT_PROFILE_CHANGE_STATUS.REJECTED;
  changeRequest.reviewed_by = buildActorSnapshot(actor);
  changeRequest.reviewed_at = new Date();
  changeRequest.reason = reason;
  await changeRequest.save();

  await recordAuditLog({
    actor,
    action: 'portal.profile_change_request.reject',
    targetType: 'patient_profile_change_request',
    targetId: changeRequest._id,
    status: 'success',
    message: 'Từ chối yêu cầu thay đổi hồ sơ bệnh nhân.',
    requestMeta,
    before,
    after: changeRequest.toObject(),
    metadata: {
      patient_id: toId(patientId),
      change_type: changeRequest.change_type,
    },
  });

  return changeRequest.toObject();
}

async function cancelProfileChangeRequest(actor = {}, requestId, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const changeRequest = await PatientProfileChangeRequest.findOne({
    _id: requestId,
    patient_id: patient._id,
  });

  if (!changeRequest) throw createError('Không tìm thấy yêu cầu thay đổi hồ sơ.', 404);
  if (changeRequest.status !== PATIENT_PROFILE_CHANGE_STATUS.PENDING) {
    throw createError('Chỉ yêu cầu pending mới được hủy.', 409);
  }

  const before = changeRequest.toObject();
  changeRequest.status = PATIENT_PROFILE_CHANGE_STATUS.CANCELLED;
  changeRequest.reviewed_by = buildActorSnapshot(actor);
  changeRequest.reviewed_at = new Date();
  changeRequest.reason = payload.reason || payload.cancel_reason || changeRequest.reason;
  await changeRequest.save();

  await recordAuditLog({
    actor,
    action: 'portal.profile_change_request.cancel',
    targetType: 'patient_profile_change_request',
    targetId: changeRequest._id,
    status: 'success',
    message: 'Hủy yêu cầu thay đổi hồ sơ bệnh nhân.',
    requestMeta,
    before,
    after: changeRequest.toObject(),
    metadata: {
      patient_id: toId(patient._id),
      change_type: changeRequest.change_type,
    },
  });

  return changeRequest.toObject();
}

function buildPatientAccessLogFilter(patientId) {
  const objectId = isValidObjectId(patientId) ? toObjectId(patientId, 'patientId') : patientId;
  const ids = [...new Set([patientId, objectId].filter(Boolean))];

  return {
    $or: [
      { target_type: 'patient', target_id: objectId },
      { target_type: { $in: ACCESS_LOG_TARGET_TYPES }, 'metadata.patient_id': { $in: ids } },
      { target_type: { $in: ACCESS_LOG_TARGET_TYPES }, 'metadata.patientId': { $in: ids } },
      { 'metadata.patient_id': { $in: ids } },
      { 'metadata.patientId': { $in: ids } },
    ],
  };
}

function inferAccessVerb(action = '') {
  if (action.includes('download')) return 'downloaded';
  if (action.includes('export')) return 'exported';
  if (action.includes('read') || action.includes('view') || action.includes('detail')) return 'viewed';
  if (action.includes('create')) return 'created';
  if (action.includes('update')) return 'updated';
  return 'accessed';
}

function humanizeTarget(targetType = 'record') {
  return String(targetType || 'record').replace(/_/g, ' ');
}

async function buildActorLabelMaps(logs = []) {
  const staffIds = [];
  const patientAccountIds = [];
  const relativeIds = [];

  logs.forEach((log) => {
    const id = toId(log.actor_id);
    if (!id || !isValidObjectId(id)) return;
    if (log.actor_type === ACTOR_TYPE.STAFF) staffIds.push(id);
    if (log.actor_type === ACTOR_TYPE.PATIENT) patientAccountIds.push(id);
    if (log.actor_type === ACTOR_TYPE.PATIENT_RELATIVE) relativeIds.push(id);
  });

  const [staff, accounts, relatives] = await Promise.all([
    staffIds.length ? User.find({ _id: { $in: [...new Set(staffIds)] } }).select('full_name employee_code').lean() : [],
    patientAccountIds.length ? PatientAccount.find({ _id: { $in: [...new Set(patientAccountIds)] } }).select('username email phone').lean() : [],
    relativeIds.length ? PatientRelative.find({ _id: { $in: [...new Set(relativeIds)] } }).select('full_name relationship').lean() : [],
  ]);

  return {
    staff: new Map(staff.map((item) => [toId(item._id), item])),
    patient_accounts: new Map(accounts.map((item) => [toId(item._id), item])),
    relatives: new Map(relatives.map((item) => [toId(item._id), item])),
  };
}

function actorLabel(log, maps) {
  const id = toId(log.actor_id);
  if (log.actor_type === ACTOR_TYPE.STAFF) {
    const staff = maps.staff.get(id);
    return staff?.full_name || staff?.employee_code || `staff ${id}`;
  }
  if (log.actor_type === ACTOR_TYPE.PATIENT) {
    const account = maps.patient_accounts.get(id);
    return account?.username || account?.email || account?.phone || 'patient';
  }
  if (log.actor_type === ACTOR_TYPE.PATIENT_RELATIVE) {
    const relative = maps.relatives.get(id);
    return relative?.full_name || 'relative';
  }
  return log.actor_type || 'system';
}

function serializeAccessLog(log, maps) {
  const label = actorLabel(log, maps);
  const verb = inferAccessVerb(log.action);
  const target = humanizeTarget(log.target_type);

  return {
    log_id: toId(log._id),
    occurred_at: log.created_at,
    actor_type: log.actor_type,
    actor_id: toId(log.actor_id),
    actor_label: label,
    action: log.action,
    target_type: log.target_type,
    target_id: toId(log.target_id),
    summary: `${label} ${verb} ${target}`.trim(),
    message: log.message,
  };
}

async function getMyAccessLogs(actor = {}, query = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor);
  const { page, limit, skip } = getPagination(query);
  const filter = buildPatientAccessLogFilter(toId(patient._id));
  if (query.action) filter.action = String(query.action).trim();
  if (query.target_type) filter.target_type = String(query.target_type).trim();

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const maps = await buildActorLabelMaps(logs);

  await recordAuditLog({
    actor,
    action: 'portal.access_logs.read',
    targetType: 'patient',
    targetId: patient._id,
    status: 'success',
    message: 'Bệnh nhân xem nhật ký truy cập hồ sơ.',
    requestMeta,
    metadata: { patient_id: toId(patient._id) },
  });

  return {
    items: logs.map((log) => serializeAccessLog(log, maps)),
    pagination: buildPagination(page, limit, total),
  };
}

function requirePatientUploadAttachment(attachment = {}, patientId) {
  if (!attachment) throw createError('Không tìm thấy document.', 404);
  if (toId(attachment.patient_id) !== toId(patientId)) throw createError('Document không thuộc patient hiện tại.', 403);
  if (attachment.source !== DOCUMENT_SOURCE.PATIENT_UPLOAD) {
    throw createError('Patient chỉ được archive/delete document do chính mình upload.', 403);
  }
}

function normalizeDocumentUploadPayload(payload = {}) {
  const fileName = normalizeString(payload.file_name || payload.fileName || payload.original_name || payload.originalName);
  const storagePath = normalizeString(payload.storage_path || payload.storagePath || payload.url || payload.file_url);
  if (!fileName) throw createError('file_name là bắt buộc.', 422);
  if (!storagePath) throw createError('storage_path là bắt buộc.', 422);
  return {
    file_name: fileName,
    original_name: normalizeString(payload.original_name || payload.originalName) || fileName,
    mime_type: normalizeString(payload.mime_type || payload.mimeType),
    file_size: payload.file_size || payload.fileSize,
    storage_path: storagePath,
    storage_provider: normalizeString(payload.storage_provider || payload.storageProvider) || 'local',
    storage_key: normalizeString(payload.storage_key || payload.storageKey) || storagePath,
    checksum: normalizeString(payload.checksum),
    checksum_sha256: normalizeString(payload.checksum_sha256 || payload.checksumSha256 || payload.sha256),
    scan_status: 'pending',
    category: normalizeString(payload.category) || 'other',
    description: payload.description,
  };
}

async function uploadMyDocument(actor = {}, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const normalized = normalizeDocumentUploadPayload(payload);
  const attachment = await Attachment.create({
    patient_id: patient._id,
    entity_type: ATTACHMENT_ENTITY_TYPE.PATIENT,
    entity_id: patient._id,
    ...normalized,
    source: DOCUMENT_SOURCE.PATIENT_UPLOAD,
    review_status: DOCUMENT_REVIEW_STATUS.PENDING,
    submitted_for_review_at: new Date(),
    visibility: DOCUMENT_VISIBILITY.PATIENT_VISIBLE,
    released_to_patient: true,
    released_at: new Date(),
    status: ATTACHMENT_STATUS.ACTIVE,
  });
  await recordAuditLog({
    actor,
    action: 'attachment.upload_patient',
    targetType: 'attachment',
    targetId: attachment._id,
    status: 'success',
    message: 'Patient upload document.',
    requestMeta,
    metadata: { patient_id: toId(patient._id), category: attachment.category },
  });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.DOCUMENT_UPLOADED,
    aggregateType: 'attachment',
    aggregateId: attachment._id,
    recipientScope: {
      patient_id: patient._id,
      recipients: [{ recipient_type: 'patient', recipient_id: patient._id, patient_id: patient._id }],
    },
    payload: {
      attachment_id: toId(attachment._id),
      category: attachment.category,
      notification: {
        title: 'Tài liệu đã được tải lên',
        body: attachment.original_name || attachment.file_name,
        priority: 'normal',
      },
    },
  });
  return attachment.toObject();
}

async function listMyDocuments(actor = {}, query = {}) {
  const patient = await resolvePortalPatient(actor);
  const { page, limit, skip } = getPagination(query);
  const filter = {
    patient_id: patient._id,
    status: query.include_archived ? { $in: [ATTACHMENT_STATUS.ACTIVE, ATTACHMENT_STATUS.ARCHIVED] } : ATTACHMENT_STATUS.ACTIVE,
    $or: [
      { released_to_patient: true },
      { source: DOCUMENT_SOURCE.PATIENT_UPLOAD },
    ],
  };
  for (const field of ['category', 'review_status', 'source', 'visibility']) {
    if (query[field]) filter[field] = query[field];
  }
  const [items, total] = await Promise.all([
    Attachment.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Attachment.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getMyDocument(actor = {}, attachmentId) {
  const patient = await resolvePortalPatient(actor);
  const attachment = await Attachment.findOne({
    _id: attachmentId,
    patient_id: patient._id,
    status: { $ne: ATTACHMENT_STATUS.DELETED },
    $or: [{ released_to_patient: true }, { source: DOCUMENT_SOURCE.PATIENT_UPLOAD }],
  }).lean();
  if (!attachment) throw createError('Không tìm thấy document.', 404);
  return attachment;
}

async function archiveMyDocument(actor = {}, attachmentId, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const attachment = await Attachment.findById(attachmentId);
  requirePatientUploadAttachment(attachment, patient._id);
  attachment.status = ATTACHMENT_STATUS.ARCHIVED;
  attachment.archived_by_patient = true;
  attachment.archived_at = new Date();
  attachment.archive_reason = payload.reason || payload.archive_reason;
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachment.archive_patient', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Patient archive document.', requestMeta });
  return attachment.toObject();
}

async function restoreMyDocument(actor = {}, attachmentId, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const attachment = await Attachment.findById(attachmentId);
  requirePatientUploadAttachment(attachment, patient._id);
  attachment.status = ATTACHMENT_STATUS.ACTIVE;
  attachment.archived_by_patient = false;
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachment.restore_patient', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Patient restore document.', requestMeta });
  return attachment.toObject();
}

async function deleteMyDocument(actor = {}, attachmentId, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const attachment = await Attachment.findById(attachmentId);
  requirePatientUploadAttachment(attachment, patient._id);
  attachment.status = ATTACHMENT_STATUS.DELETED;
  attachment.deleted_at = new Date();
  attachment.delete_reason = payload.reason || payload.delete_reason || 'patient_deleted';
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachment.delete_patient', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Patient soft-delete document.', requestMeta });
  return { deleted: true, attachment_id: toId(attachment._id) };
}

async function submitMyDocumentReview(actor = {}, attachmentId, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor, [AUTHORIZATION_TYPE.FULL_ACCESS]);
  const attachment = await Attachment.findById(attachmentId);
  requirePatientUploadAttachment(attachment, patient._id);
  attachment.review_status = DOCUMENT_REVIEW_STATUS.PENDING;
  attachment.submitted_for_review_at = new Date();
  await attachment.save();
  await recordAuditLog({ actor, action: 'attachment.submit_review', targetType: 'attachment', targetId: attachment._id, status: 'success', message: 'Patient submit document for review.', requestMeta });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.DOCUMENT_REVIEW_REQUESTED,
    aggregateType: 'attachment',
    aggregateId: attachment._id,
    recipientScope: {
      patient_id: patient._id,
      role: ['medical_record_staff', 'admin'],
    },
    payload: {
      attachment_id: toId(attachment._id),
      patient_id: toId(patient._id),
      category: attachment.category,
    },
  });
  return attachment.toObject();
}

async function reviewPatientDocument(attachmentId, accepted, payload = {}, actor = {}, requestMeta = {}) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw createError('Không tìm thấy document.', 404);
  attachment.review_status = accepted ? DOCUMENT_REVIEW_STATUS.ACCEPTED : DOCUMENT_REVIEW_STATUS.REJECTED;
  attachment.review_note = payload.review_note || payload.reason || payload.note;
  attachment.reviewed_by = actor.userId;
  attachment.reviewed_at = new Date();
  attachment.archived_by_staff = false;
  if (accepted) {
    attachment.visibility = payload.visibility || DOCUMENT_VISIBILITY.PATIENT_VISIBLE;
  }
  await attachment.save();
  await recordAuditLog({
    actor,
    action: accepted ? 'attachment.approve' : 'attachment.reject',
    targetType: 'attachment',
    targetId: attachment._id,
    status: 'success',
    message: accepted ? 'Approve patient document.' : 'Reject patient document.',
    requestMeta,
    metadata: { patient_id: toId(attachment.patient_id) },
  });
  await eventBus.publishDomainEvent({
    eventType: accepted ? REALTIME_EVENT_TYPE.DOCUMENT_APPROVED : REALTIME_EVENT_TYPE.DOCUMENT_REJECTED,
    aggregateType: 'attachment',
    aggregateId: attachment._id,
    recipientScope: {
      patient_id: attachment.patient_id,
      recipients: [{ recipient_type: 'patient', recipient_id: attachment.patient_id, patient_id: attachment.patient_id }],
    },
    payload: {
      attachment_id: toId(attachment._id),
      review_status: attachment.review_status,
      review_note: attachment.review_note,
      notification: {
        title: accepted ? 'Tài liệu đã được duyệt' : 'Tài liệu bị từ chối',
        body: attachment.review_note || attachment.original_name || attachment.file_name,
        priority: accepted ? 'normal' : 'high',
      },
    },
  });
  return attachment.toObject();
}

async function createDocumentExport(actor = {}, payload = {}, requestMeta = {}) {
  const patient = await resolvePortalPatient(actor);
  const attachmentIds = Array.isArray(payload.selected_attachment_ids || payload.selectedAttachmentIds)
    ? (payload.selected_attachment_ids || payload.selectedAttachmentIds)
    : [];
  if (attachmentIds.length === 0) throw createError('selected_attachment_ids không được rỗng.', 422);
  const attachments = await Attachment.find({
    _id: { $in: attachmentIds },
    patient_id: patient._id,
    status: ATTACHMENT_STATUS.ACTIVE,
    $or: [{ released_to_patient: true }, { source: DOCUMENT_SOURCE.PATIENT_UPLOAD }],
  }).lean();
  if (attachments.length !== attachmentIds.length) {
    throw createError('Có document không thuộc quyền tải của patient.', 403);
  }
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const request = await DocumentExportRequest.create({
    request_code: generateDateCode('DEX'),
    patient_id: patient._id,
    requested_by_actor_type: actorType(actor),
    requested_by_actor_id: actorId(actor),
    export_type: payload.export_type || DOCUMENT_EXPORT_TYPE.ATTACHMENTS_ZIP,
    selected_attachment_ids: attachmentIds,
    status: payload.file_url ? DOCUMENT_EXPORT_STATUS.READY : DOCUMENT_EXPORT_STATUS.PROCESSING,
    file_url: payload.file_url,
    expires_at: expiresAt,
    metadata: {
      attachment_count: attachments.length,
      mode: payload.file_url ? 'external_file' : 'zip_worker_required',
    },
  });
  await recordAuditLog({ actor, action: 'record.export_zip', targetType: 'document_export_request', targetId: request._id, status: 'success', message: 'Patient request document export zip.', requestMeta, metadata: { patient_id: toId(patient._id), attachment_count: attachments.length } });
  await eventBus.publishDomainEvent({
    eventType: payload.file_url ? REALTIME_EVENT_TYPE.DOCUMENT_EXPORT_READY : REALTIME_EVENT_TYPE.DOCUMENT_EXPORT_REQUESTED,
    aggregateType: 'document_export_request',
    aggregateId: request._id,
    recipientScope: {
      patient_id: patient._id,
      recipients: [{ recipient_type: 'patient', recipient_id: patient._id, patient_id: patient._id }],
    },
    payload: {
      export_id: toId(request._id),
      status: request.status,
      attachment_count: attachments.length,
      notification: {
        title: payload.file_url ? 'Gói tài liệu đã sẵn sàng' : 'Đang chuẩn bị gói tài liệu',
        body: payload.file_url ? 'Bạn có thể tải file ZIP tài liệu.' : 'Hệ thống đang xử lý yêu cầu xuất ZIP.',
        priority: 'normal',
      },
    },
  });
  return request.toObject();
}

async function getDocumentExport(actor = {}, requestId) {
  const patient = await resolvePortalPatient(actor);
  const request = await DocumentExportRequest.findOne({ _id: requestId, patient_id: patient._id }).lean();
  if (!request) throw createError('Không tìm thấy document export.', 404);
  return request;
}

async function downloadDocumentExport(actor = {}, requestId, requestMeta = {}) {
  const request = await getDocumentExport(actor, requestId);
  if (request.expires_at && request.expires_at < new Date()) throw createError('Document export đã hết hạn.', 410);
  if (request.status !== DOCUMENT_EXPORT_STATUS.READY) throw createError('Document export chưa ready.', 409);
  await recordAuditLog({ actor, action: 'record.download', targetType: 'document_export_request', targetId: request._id, status: 'success', message: 'Download document export zip.', requestMeta, metadata: { patient_id: toId(request.patient_id) } });
  return { export: request, download_url: request.file_url };
}

module.exports = {
  // getMyDashboard: Tổng hợp dashboard portal từ các module hiện có.
  getMyDashboard,
  // createProfileChangeRequest: Tạo yêu cầu thay đổi hồ sơ bệnh nhân chờ duyệt.
  createProfileChangeRequest,
  // listProfileChangeRequests: Liệt kê yêu cầu thay đổi hồ sơ của bệnh nhân hiện tại.
  listProfileChangeRequests,
  // approveProfileChangeRequest: Duyệt yêu cầu thay đổi hồ sơ bệnh nhân.
  approveProfileChangeRequest,
  // rejectProfileChangeRequest: Từ chối yêu cầu thay đổi hồ sơ bệnh nhân.
  rejectProfileChangeRequest,
  // cancelProfileChangeRequest: Bệnh nhân/người nhà hủy yêu cầu thay đổi hồ sơ đang pending.
  cancelProfileChangeRequest,
  // getMyAccessLogs: Trả về nhật ký truy cập hồ sơ ở dạng đơn giản cho portal.
  getMyAccessLogs,
  uploadMyDocument,
  listMyDocuments,
  getMyDocument,
  archiveMyDocument,
  restoreMyDocument,
  deleteMyDocument,
  submitMyDocumentReview,
  reviewPatientDocument,
  createDocumentExport,
  getDocumentExport,
  downloadDocumentExport,
};
