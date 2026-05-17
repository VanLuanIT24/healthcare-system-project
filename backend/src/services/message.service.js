const { randomBytes } = require('crypto');
const {
  Appointment,
  Attachment,
  Conversation,
  ConversationCall,
  ConversationParticipant,
  Encounter,
  Message,
  MessageAttachment,
  Patient,
  PatientAccount,
  PatientRelative,
  Prescription,
  User,
} = require('../models');
const { PERMISSION, ROLE_CODE } = require('../constants/permissions');
const {
  ACTOR_TYPE,
  CLINICAL_NOTE_STATUS,
  CONVERSATION_CALL_PROVIDER,
  CONVERSATION_CALL_PROVIDERS,
  CONVERSATION_CALL_STATUS,
  CONVERSATION_CALL_STATUSES,
  CONVERSATION_CALL_TYPE,
  CONVERSATION_CALL_TYPES,
  CONVERSATION_PARTICIPANT_ROLE,
  CONVERSATION_PARTICIPANT_ROLES,
  CONVERSATION_PRIORITY,
  CONVERSATION_PRIORITIES,
  CONVERSATION_STATUS,
  CONVERSATION_TYPE,
  CONVERSATION_TYPES,
  ENCOUNTER_STATUS,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
  MESSAGE_TYPES,
  PRESCRIPTION_STATUS,
  REALTIME_EVENT_TYPE,
  VOICE_TRANSCRIPT_STATUS,
  VOICE_TRANSCRIPT_STATUSES,
  normalizeActorType,
} = require('../constants/statuses');
const { buildPagination, createError, getPagination, recordAuditLog } = require('./core.service');
const clinicalService = require('./clinical.service');
const actorContext = require('../common/actors');
const eventBus = require('../events/event-bus.service');
const ERROR_CODE = require('../common/errors/error-codes');
const { isValidObjectId, toObjectId } = require('../common/helpers/object-id.helper');

const ACTIVE_ENCOUNTER_STATUSES = [
  ENCOUNTER_STATUS.PLANNED,
  ENCOUNTER_STATUS.ARRIVED,
  ENCOUNTER_STATUS.IN_PROGRESS,
  ENCOUNTER_STATUS.ON_HOLD,
];

const ACTIVE_PRESCRIPTION_STATUSES = [
  PRESCRIPTION_STATUS.ACTIVE,
  PRESCRIPTION_STATUS.VERIFIED,
  PRESCRIPTION_STATUS.PARTIALLY_DISPENSED,
];

const OPEN_CONVERSATION_STATUSES = [
  CONVERSATION_STATUS.OPEN,
  CONVERSATION_STATUS.PENDING,
];

const STAFF_ROLE_ACTOR_ALIASES = {
  doctor: ROLE_CODE.DOCTOR,
  nurse: ROLE_CODE.NURSE,
  receptionist: ROLE_CODE.RECEPTIONIST,
  cashier: ROLE_CODE.CASHIER,
  pharmacist: ROLE_CODE.PHARMACIST,
  lab_staff: ROLE_CODE.LAB_TECHNICIAN,
  imaging_staff: ROLE_CODE.IMAGING_TECHNICIAN,
  support_agent: ROLE_CODE.RECEPTIONIST,
  admin: ROLE_CODE.ADMIN,
};

const PATIENT_BOUND_CONVERSATION_TYPES = [
  CONVERSATION_TYPE.DOCTOR_PATIENT,
  CONVERSATION_TYPE.CARE_TEAM_PATIENT,
  CONVERSATION_TYPE.SUPPORT,
  CONVERSATION_TYPE.BILLING,
  CONVERSATION_TYPE.INSURANCE,
  CONVERSATION_TYPE.PHARMACY,
  CONVERSATION_TYPE.LAB,
  CONVERSATION_TYPE.IMAGING,
  CONVERSATION_TYPE.EMERGENCY,
];

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function idsEqual(left, right) {
  return Boolean(left && right && toId(left) === toId(right));
}

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function assertObjectId(value, fieldName) {
  if (!value) return undefined;
  if (!isValidObjectId(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return toObjectId(value, fieldName);
}

function actorSnapshot(actor = {}) {
  const context = actorContext.buildActorContext(actor);
  return {
    actor_type: context.actor_type,
    actor_id: context.actor_id,
    actor_role_code: context.roles?.[0] || null,
  };
}

function actorType(actor = {}) {
  return actorContext.getActorType(actor);
}

function isStaff(actor = {}) {
  return actorType(actor) === ACTOR_TYPE.STAFF;
}

function isPatientOrRelative(actor = {}) {
  return [ACTOR_TYPE.PATIENT, ACTOR_TYPE.PATIENT_RELATIVE].includes(actorType(actor));
}

function requireStaff(actor = {}) {
  if (!isStaff(actor)) throw createError('Chỉ nhân sự được thực hiện thao tác này.', 403);
}

function hasPermission(actor = {}, permissionCode) {
  return (actor.permissions || []).includes(permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  const permissions = new Set(actor.permissions || []);
  return permissionCodes.some((permissionCode) => permissions.has(permissionCode));
}

function assertMessagingPermission(actor = {}, action = 'read') {
  const permissionGroups = {
    read: [
      PERMISSION.MESSAGES.SELF_READ,
      PERMISSION.MESSAGES.STAFF_READ,
      PERMISSION.MESSAGES.INTERNAL_READ,
      PERMISSION.MESSAGES.MANAGE,
    ],
    send: [
      PERMISSION.MESSAGES.SELF_SEND,
      PERMISSION.MESSAGES.STAFF_SEND,
      PERMISSION.MESSAGES.INTERNAL_SEND,
      PERMISSION.MESSAGES.MANAGE,
    ],
    moderate: [
      PERMISSION.MESSAGES.ASSIGN,
      PERMISSION.MESSAGES.CLOSE,
      PERMISSION.MESSAGES.MANAGE,
    ],
  };
  if (hasAnyPermission(actor, permissionGroups[action] || permissionGroups.read)) return true;
  throw createError('Tài khoản hiện tại không có quyền messaging phù hợp.', 403);
}

function normalizeCallType(callType) {
  const normalized = normalizeString(callType) || CONVERSATION_CALL_TYPE.VOICE;
  if (!CONVERSATION_CALL_TYPES.includes(normalized)) throw createError('call_type không hợp lệ.', 422);
  return normalized;
}

function normalizeCallProvider(provider) {
  const normalized = normalizeString(provider) || CONVERSATION_CALL_PROVIDER.INTERNAL;
  if (!CONVERSATION_CALL_PROVIDERS.includes(normalized)) throw createError('provider cuộc gọi không hợp lệ.', 422);
  return normalized;
}

function normalizeCallStatus(status, fallback = CONVERSATION_CALL_STATUS.SCHEDULED) {
  const normalized = normalizeString(status) || fallback;
  if (!CONVERSATION_CALL_STATUSES.includes(normalized)) throw createError('status cuộc gọi không hợp lệ.', 422);
  return normalized;
}

function normalizeTranscriptStatus(status, fallback = VOICE_TRANSCRIPT_STATUS.NONE) {
  const normalized = normalizeString(status) || fallback;
  if (!VOICE_TRANSCRIPT_STATUSES.includes(normalized)) throw createError('transcript_status không hợp lệ.', 422);
  return normalized;
}

function normalizeActionItems(items = []) {
  const list = Array.isArray(items) ? items : [items];
  return list.map(normalizeString).filter(Boolean);
}

function conversationRecipientScope(conversation = {}, extra = {}) {
  return {
    patient_id: conversation.patient_id,
    conversation_id: conversation._id,
    user_id: conversation.assigned_user_id,
    department_id: conversation.assigned_department_id,
    ...(extra || {}),
  };
}

function staffQueueTypesForActor(actor = {}) {
  const roles = new Set(actor.roles || []);
  const types = [];

  if (roles.has(ROLE_CODE.SUPER_ADMIN) || roles.has(ROLE_CODE.ADMIN) || roles.has(ROLE_CODE.MANAGER) || roles.has(ROLE_CODE.RECEPTIONIST)) {
    types.push(CONVERSATION_TYPE.SUPPORT);
  }
  if (roles.has(ROLE_CODE.CASHIER) || roles.has(ROLE_CODE.BILLING_STAFF)) {
    types.push(CONVERSATION_TYPE.BILLING);
  }
  if (roles.has(ROLE_CODE.INSURANCE_STAFF)) {
    types.push(CONVERSATION_TYPE.INSURANCE);
  }
  if (roles.has(ROLE_CODE.PHARMACIST)) {
    types.push(CONVERSATION_TYPE.PHARMACY);
  }
  if (roles.has(ROLE_CODE.LAB_TECHNICIAN) || roles.has(ROLE_CODE.LAB_MANAGER)) {
    types.push(CONVERSATION_TYPE.LAB);
  }
  if (roles.has(ROLE_CODE.RADIOLOGIST) || roles.has(ROLE_CODE.IMAGING_TECHNICIAN)) {
    types.push(CONVERSATION_TYPE.IMAGING);
  }
  if (roles.has(ROLE_CODE.DOCTOR) || roles.has(ROLE_CODE.NURSE)) {
    types.push(CONVERSATION_TYPE.CARE_TEAM_PATIENT, CONVERSATION_TYPE.EMERGENCY);
  }

  return [...new Set(types)];
}

function staffQueueAccessFilter(actor = {}) {
  if (!isStaff(actor)) return null;
  const clauses = [];
  const userId = actor.userId || actor.user_id || actor.actorId || actor.actor_id;
  const departmentId = actor.departmentId || actor.department_id || actor.user?.department_id;
  const queueTypes = staffQueueTypesForActor(actor);

  if (userId) clauses.push({ assigned_user_id: userId });
  if (departmentId) clauses.push({ assigned_department_id: departmentId });
  if (queueTypes.length > 0) {
    clauses.push({
      type: { $in: queueTypes },
      status: { $in: OPEN_CONVERSATION_STATUSES },
    });
  }

  return clauses.length > 0 ? { $or: clauses } : null;
}

function staffCanAccessConversation(conversation = {}, actor = {}) {
  if (!isStaff(actor)) return false;
  const userId = actor.userId || actor.user_id || actor.actorId || actor.actor_id;
  const departmentId = actor.departmentId || actor.department_id || actor.user?.department_id;

  if (userId && idsEqual(conversation.assigned_user_id, userId)) return true;
  if (departmentId && idsEqual(conversation.assigned_department_id, departmentId)) return true;

  return OPEN_CONVERSATION_STATUSES.includes(conversation.status)
    && staffQueueTypesForActor(actor).includes(conversation.type);
}

function notLeftFilter() {
  return {
    $or: [
      { left_at: null },
      { left_at: { $exists: false } },
    ],
  };
}

function normalizeConversationType(type) {
  const normalized = normalizeString(type) || CONVERSATION_TYPE.SUPPORT;
  if (!CONVERSATION_TYPES.includes(normalized)) throw createError('type conversation không hợp lệ.', 422);
  return normalized;
}

function normalizeConversationPriority(priority) {
  const normalized = normalizeString(priority) || CONVERSATION_PRIORITY.NORMAL;
  if (!CONVERSATION_PRIORITIES.includes(normalized)) throw createError('priority conversation không hợp lệ.', 422);
  return normalized;
}

function normalizeParticipantRole(role) {
  const normalized = normalizeString(role) || CONVERSATION_PARTICIPANT_ROLE.MEMBER;
  if (!CONVERSATION_PARTICIPANT_ROLES.includes(normalized)) {
    throw createError('role_in_conversation không hợp lệ.', 422);
  }
  return normalized;
}

function normalizeMessageType(type) {
  const normalized = normalizeString(type) || MESSAGE_TYPE.TEXT;
  if (!MESSAGE_TYPES.includes(normalized)) throw createError('message_type không hợp lệ.', 422);
  return normalized;
}

async function generateConversationCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `CNV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const exists = await Conversation.exists({ conversation_code: code });
    if (!exists) return code;
  }
  throw createError('Không thể sinh mã conversation.', 409);
}

async function ensurePatientExists(patientId) {
  if (!patientId) return null;
  const patient = await Patient.findOne({ _id: patientId, is_deleted: false }).lean();
  if (!patient) throw createError('Không tìm thấy bệnh nhân cho conversation.', 404);
  return patient;
}

async function ensureUserExists(userId, fieldName = 'assigned_user_id') {
  if (!userId) return null;
  const user = await User.findOne({ _id: userId, is_deleted: false }).lean();
  if (!user) throw createError(`Không tìm thấy ${fieldName}.`, 404);
  return user;
}

async function assertPatientCanStartDoctorConversation(patientId, doctorId) {
  if (!patientId || !doctorId) throw createError('doctor_patient cần patient_id và assigned_user_id.', 422);

  const [
    hadAppointment,
    openEncounter,
    activePrescription,
    doctorOpenedConversation,
  ] = await Promise.all([
    Appointment.exists({ patient_id: patientId, doctor_id: doctorId, is_deleted: false }),
    Encounter.exists({
      patient_id: patientId,
      attending_doctor_id: doctorId,
      status: { $in: ACTIVE_ENCOUNTER_STATUSES },
    }),
    Prescription.exists({
      patient_id: patientId,
      prescribed_by: doctorId,
      is_current: true,
      status: { $in: ACTIVE_PRESCRIPTION_STATUSES },
    }),
    Conversation.exists({
      patient_id: patientId,
      assigned_user_id: doctorId,
      type: { $in: [CONVERSATION_TYPE.DOCTOR_PATIENT, CONVERSATION_TYPE.CARE_TEAM_PATIENT] },
      status: { $in: OPEN_CONVERSATION_STATUSES },
      created_by_actor_type: ACTOR_TYPE.STAFF,
    }),
  ]);

  if (!hadAppointment && !openEncounter && !activePrescription && !doctorOpenedConversation) {
    throw createError('Bệnh nhân chỉ được nhắn bác sĩ khi đã có lịch hẹn/lượt khám/đơn thuốc hoặc bác sĩ đã mở conversation trước.', 403);
  }
}

function normalizeParticipantActor(participant = {}) {
  const rawType = normalizeString(participant.actor_type || participant.actorType);
  const aliasRole = STAFF_ROLE_ACTOR_ALIASES[rawType];
  const actor_type = aliasRole ? ACTOR_TYPE.STAFF : normalizeActorType(rawType);
  const actor_id = toId(participant.actor_id || participant.actorId || participant.user_id || participant.userId || participant.relative_id || participant.relativeId || participant.patient_account_id || participant.patientAccountId);

  if (![
    ACTOR_TYPE.STAFF,
    ACTOR_TYPE.PATIENT,
    ACTOR_TYPE.PATIENT_RELATIVE,
    ACTOR_TYPE.SYSTEM,
    ACTOR_TYPE.SERVICE_ACCOUNT,
  ].includes(actor_type)) {
    throw createError('actor_type participant không hợp lệ.', 422);
  }
  if (!actor_id) throw createError('actor_id participant là bắt buộc.', 422);

  return {
    actor_type,
    actor_id,
    actor_role_code: participant.actor_role_code || participant.role_code || aliasRole || null,
    role_in_conversation: normalizeParticipantRole(participant.role_in_conversation || participant.roleInConversation),
  };
}

async function addPatientParticipant(participants, patientId) {
  const account = await PatientAccount.findOne({ patient_id: patientId, is_deleted: false }).select('_id').lean();
  if (!account) return;
  participants.push({
    actor_type: ACTOR_TYPE.PATIENT,
    actor_id: toId(account._id),
    actor_role_code: null,
    role_in_conversation: CONVERSATION_PARTICIPANT_ROLE.MEMBER,
  });
}

function dedupeParticipants(participants = []) {
  const map = new Map();
  participants.forEach((participant) => {
    const key = `${participant.actor_type}:${participant.actor_id}`;
    const existing = map.get(key);
    if (!existing || existing.role_in_conversation === CONVERSATION_PARTICIPANT_ROLE.MEMBER) {
      map.set(key, participant);
    }
  });
  return [...map.values()];
}

async function buildConversationParticipants(conversation, payload = {}, actor = {}) {
  const snapshot = actorSnapshot(actor);
  const participants = [{
    ...snapshot,
    role_in_conversation: CONVERSATION_PARTICIPANT_ROLE.OWNER,
  }];

  if (conversation.patient_id) {
    await addPatientParticipant(participants, conversation.patient_id);
  }

  if (actorType(actor) === ACTOR_TYPE.PATIENT_RELATIVE) {
    participants.push({
      actor_type: ACTOR_TYPE.PATIENT_RELATIVE,
      actor_id: snapshot.actor_id,
      actor_role_code: null,
      role_in_conversation: CONVERSATION_PARTICIPANT_ROLE.MEMBER,
    });
  }

  if (conversation.assigned_user_id) {
    participants.push({
      actor_type: ACTOR_TYPE.STAFF,
      actor_id: toId(conversation.assigned_user_id),
      actor_role_code: payload.assigned_role_code || null,
      role_in_conversation: CONVERSATION_PARTICIPANT_ROLE.ASSIGNEE,
    });
  }

  if (Array.isArray(payload.participants)) {
    payload.participants.forEach((item) => participants.push(normalizeParticipantActor(item)));
  }

  return dedupeParticipants(participants);
}

async function upsertParticipant(conversationId, participant) {
  return ConversationParticipant.findOneAndUpdate(
    {
      conversation_id: conversationId,
      actor_type: participant.actor_type,
      actor_id: participant.actor_id,
    },
    {
      $set: {
        actor_role_code: participant.actor_role_code || undefined,
        role_in_conversation: participant.role_in_conversation,
        left_at: null,
        archived: false,
      },
      $setOnInsert: {
        joined_at: new Date(),
        muted: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function findParticipant(conversationId, actor = {}) {
  const snapshot = actorSnapshot(actor);
  return ConversationParticipant.findOne({
    conversation_id: conversationId,
    actor_type: snapshot.actor_type,
    actor_id: snapshot.actor_id,
    ...notLeftFilter(),
  }).lean();
}

async function requireConversationAccess(conversationId, actor = {}) {
  const conversation = await Conversation.findById(conversationId).lean();
  if (!conversation) throw createError('Không tìm thấy conversation.', 404);

  let participant = await findParticipant(conversation._id, actor);
  if (!participant && staffCanAccessConversation(conversation, actor)) {
    const snapshot = actorSnapshot(actor);
    const joined = await upsertParticipant(conversation._id, {
      ...snapshot,
      role_in_conversation: idsEqual(conversation.assigned_user_id, snapshot.actor_id)
        ? CONVERSATION_PARTICIPANT_ROLE.ASSIGNEE
        : CONVERSATION_PARTICIPANT_ROLE.MEMBER,
    });
    participant = joined.toObject ? joined.toObject() : joined;
  }
  if (!participant) throw createError('Bạn không phải participant của conversation này.', 403);

  return { conversation, participant };
}

function assertCanModerateConversation(participant, actor = {}) {
  if (isStaff(actor)) return true;
  if ([CONVERSATION_PARTICIPANT_ROLE.OWNER, CONVERSATION_PARTICIPANT_ROLE.ASSIGNEE].includes(participant.role_in_conversation)) {
    return true;
  }
  throw createError('Bạn không có quyền quản lý conversation này.', 403);
}

async function createConversation(payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'send');
  const type = normalizeConversationType(payload.type);
  const creator = actorSnapshot(actor);
  let patientId = payload.patient_id || payload.patientId;

  if (isPatientOrRelative(actor)) {
    patientId = actor.patientId || actor.patient_id;
  }

  if (PATIENT_BOUND_CONVERSATION_TYPES.includes(type) && !patientId) {
    throw createError('Conversation loại này cần patient_id.', 422);
  }

  const patientObjectId = patientId ? assertObjectId(patientId, 'patient_id') : undefined;
  await ensurePatientExists(patientObjectId);

  const assignedUserId = payload.assigned_user_id || payload.assignedUserId || payload.doctor_id || payload.doctorId;
  const assignedUserObjectId = assignedUserId ? assertObjectId(assignedUserId, 'assigned_user_id') : undefined;
  if (assignedUserObjectId) await ensureUserExists(assignedUserObjectId);

  if (type === CONVERSATION_TYPE.DOCTOR_PATIENT) {
    if (!assignedUserObjectId) throw createError('doctor_patient cần assigned_user_id.', 422);
    if (isPatientOrRelative(actor)) {
      await assertPatientCanStartDoctorConversation(patientObjectId, assignedUserObjectId);
    }
  }

  const conversation = await Conversation.create({
    conversation_code: await generateConversationCode(),
    type,
    patient_id: patientObjectId,
    appointment_id: assertObjectId(payload.appointment_id || payload.appointmentId, 'appointment_id'),
    encounter_id: assertObjectId(payload.encounter_id || payload.encounterId, 'encounter_id'),
    invoice_id: assertObjectId(payload.invoice_id || payload.invoiceId, 'invoice_id'),
    prescription_id: assertObjectId(payload.prescription_id || payload.prescriptionId, 'prescription_id'),
    ticket_id: assertObjectId(payload.ticket_id || payload.ticketId, 'ticket_id'),
    title: normalizeString(payload.title),
    status: payload.status && [CONVERSATION_STATUS.OPEN, CONVERSATION_STATUS.PENDING].includes(payload.status)
      ? payload.status
      : CONVERSATION_STATUS.OPEN,
    priority: normalizeConversationPriority(payload.priority),
    created_by_actor_type: creator.actor_type,
    created_by_actor_id: creator.actor_id,
    assigned_department_id: assertObjectId(payload.assigned_department_id || payload.assignedDepartmentId, 'assigned_department_id'),
    assigned_user_id: assignedUserObjectId,
    metadata: payload.metadata,
  });

  const participants = await buildConversationParticipants(conversation, payload, actor);
  await Promise.all(participants.map((participant) => upsertParticipant(conversation._id, participant)));

  await recordAuditLog({
    actor,
    action: 'message.conversation.create',
    targetType: 'conversation',
    targetId: conversation._id,
    status: 'success',
    message: 'Tạo conversation thành công.',
    requestMeta,
    metadata: {
      conversation_type: type,
      patient_id: toId(patientObjectId),
    },
  });

  if (payload.initial_message || payload.initialMessage) {
    await sendMessage(conversation._id, payload.initial_message || payload.initialMessage, actor, requestMeta);
  }

  return getConversation(conversation._id, actor);
}

async function countUnreadForParticipant(conversationId, participant, actor = {}) {
  const snapshot = actorSnapshot(actor);
  const filter = {
    conversation_id: conversationId,
    status: { $ne: MESSAGE_STATUS.DELETED },
    $or: [
      { sender_actor_type: { $ne: snapshot.actor_type } },
      { sender_actor_id: { $ne: snapshot.actor_id } },
    ],
  };
  if (!isStaff(actor)) filter.is_internal_note = false;
  if (participant.last_read_at) filter.created_at = { $gt: participant.last_read_at };
  return Message.countDocuments(filter);
}

async function decorateConversation(conversation, participant, actor = {}) {
  const [unreadCount, lastMessage] = await Promise.all([
    countUnreadForParticipant(conversation._id, participant, actor),
    Message.findOne({
      conversation_id: conversation._id,
      status: { $ne: MESSAGE_STATUS.DELETED },
      ...(isStaff(actor) ? {} : { is_internal_note: false }),
    }).sort({ created_at: -1 }).lean(),
  ]);

  return {
    ...conversation,
    unread_count: unreadCount,
    participant_state: participant,
    last_message: lastMessage,
  };
}

async function listConversations(query = {}, actor = {}) {
  assertMessagingPermission(actor, 'read');
  const snapshot = actorSnapshot(actor);
  const { page, limit, skip } = getPagination(query);
  const participantFilter = {
    actor_type: snapshot.actor_type,
    actor_id: snapshot.actor_id,
    ...notLeftFilter(),
  };
  if (!normalizeBoolean(query.include_archived)) participantFilter.archived = false;

  const participantDocs = await ConversationParticipant.find(participantFilter).lean();
  const participantByConversation = new Map(participantDocs.map((participant) => [toId(participant.conversation_id), participant]));
  const conversationIds = [...participantByConversation.keys()];

  const accessFilters = [];
  if (conversationIds.length > 0) accessFilters.push({ _id: { $in: conversationIds } });
  const queueFilter = staffQueueAccessFilter(actor);
  if (queueFilter) accessFilters.push(queueFilter);

  if (accessFilters.length === 0) {
    return { items: [], pagination: buildPagination(page, limit, 0) };
  }

  const filter = { $or: accessFilters };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.patient_id && isStaff(actor)) filter.patient_id = assertObjectId(query.patient_id, 'patient_id');

  const [items, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ last_message_at: -1, updated_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Conversation.countDocuments(filter),
  ]);

  return {
    items: await Promise.all(items.map((conversation) => decorateConversation(
      conversation,
      participantByConversation.get(toId(conversation._id)) || {
        conversation_id: conversation._id,
        actor_type: snapshot.actor_type,
        actor_id: snapshot.actor_id,
        last_read_at: null,
      },
      actor,
    ))),
    pagination: buildPagination(page, limit, total),
  };
}

async function getConversation(conversationId, actor = {}) {
  assertMessagingPermission(actor, 'read');
  const { conversation, participant } = await requireConversationAccess(conversationId, actor);
  const participants = await ConversationParticipant.find({ conversation_id: conversation._id }).lean();
  return {
    ...(await decorateConversation(conversation, participant, actor)),
    participants,
  };
}

async function listMessages(conversationId, query = {}, actor = {}) {
  assertMessagingPermission(actor, 'read');
  const { conversation } = await requireConversationAccess(conversationId, actor);
  const { page, limit, skip } = getPagination(query, 50, 100);
  const filter = {
    conversation_id: conversation._id,
    status: { $ne: MESSAGE_STATUS.DELETED },
  };
  if (!isStaff(actor)) filter.is_internal_note = false;
  if (query.message_type) filter.message_type = query.message_type;

  const [items, total] = await Promise.all([
    Message.find(filter).sort({ created_at: 1 }).skip(skip).limit(limit).lean(),
    Message.countDocuments(filter),
  ]);

  const messageIds = items.map((item) => item._id);
  const attachments = messageIds.length
    ? await MessageAttachment.find({ message_id: { $in: messageIds } }).lean()
    : [];
  const attachmentMap = attachments.reduce((map, attachment) => {
    const key = toId(attachment.message_id);
    const bucket = map.get(key) || [];
    bucket.push(attachment);
    map.set(key, bucket);
    return map;
  }, new Map());

  return {
    items: items.map((item) => ({
      ...item,
      attachments: attachmentMap.get(toId(item._id)) || [],
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function normalizeAttachmentPayload(attachment = {}, actor = {}) {
  let existingAttachment = null;
  if (attachment.attachment_id || attachment.attachmentId) {
    const attachmentId = assertObjectId(attachment.attachment_id || attachment.attachmentId, 'attachment_id');
    existingAttachment = await Attachment.findById(attachmentId).lean();
    if (!existingAttachment) throw createError('Không tìm thấy attachment.', 404);
  }

  const fileName = normalizeString(attachment.file_name || attachment.fileName || existingAttachment?.file_name || existingAttachment?.original_name);
  if (!fileName) throw createError('file_name attachment là bắt buộc.', 422);

  const snapshot = actorSnapshot(actor);
  return {
    attachment_id: existingAttachment?._id || undefined,
    file_name: fileName,
    mime_type: normalizeString(attachment.mime_type || attachment.mimeType || existingAttachment?.mime_type),
    size: attachment.size ?? attachment.file_size ?? existingAttachment?.file_size,
    uploaded_by_actor_type: snapshot.actor_type,
    uploaded_by_actor_id: snapshot.actor_id,
  };
}

async function createMessageAttachments(messageId, attachments = [], actor = {}) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const docs = [];
  for (const attachment of attachments) {
    docs.push({
      message_id: messageId,
      ...(await normalizeAttachmentPayload(attachment, actor)),
    });
  }
  return MessageAttachment.create(docs);
}

async function sendMessage(conversationId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'send');
  const { conversation, participant } = await requireConversationAccess(conversationId, actor);
  if ([CONVERSATION_STATUS.CLOSED, CONVERSATION_STATUS.ARCHIVED].includes(conversation.status)) {
    throw createError('Conversation đã đóng hoặc archived, không thể gửi tin nhắn.', 409, null, ERROR_CODE.CONVERSATION_CLOSED);
  }

  const messageType = normalizeMessageType(payload.message_type || payload.messageType);
  const body = normalizeString(payload.body || payload.text || payload.message);
  const isInternalNote = normalizeBoolean(payload.is_internal_note || payload.isInternalNote);
  const isClinicalAdvice = normalizeBoolean(payload.is_clinical_advice || payload.isClinicalAdvice);

  if (messageType === MESSAGE_TYPE.TEXT && !body) {
    throw createError('body là bắt buộc với tin nhắn text.', 422);
  }
  if (isInternalNote && !isStaff(actor)) {
    throw createError('Chỉ staff được gửi internal note.', 403);
  }
  if (isClinicalAdvice) {
    requireStaff(actor);
    if (!conversation.patient_id) throw createError('Tin nhắn tư vấn lâm sàng phải gắn với patient_id.', 422);
  }

  const snapshot = actorSnapshot(actor);
  const message = await Message.create({
    conversation_id: conversation._id,
    sender_actor_type: snapshot.actor_type,
    sender_actor_id: snapshot.actor_id,
    sender_role_code: snapshot.actor_role_code,
    message_type: messageType,
    body,
    voice_duration_seconds: payload.voice_duration_seconds || payload.voiceDurationSeconds,
    voice_transcript: payload.voice_transcript || payload.voiceTranscript,
    voice_transcript_status: payload.voice_transcript_status || payload.voiceTranscriptStatus || undefined,
    reply_to_message_id: assertObjectId(payload.reply_to_message_id || payload.replyToMessageId, 'reply_to_message_id'),
    is_internal_note: isInternalNote,
    is_clinical_advice: isClinicalAdvice,
    requires_acknowledgement: normalizeBoolean(payload.requires_acknowledgement || payload.requiresAcknowledgement),
  });

  const attachments = await createMessageAttachments(message._id, payload.attachments || [], actor);

  await Promise.all([
    Conversation.updateOne(
      { _id: conversation._id },
      { $set: { last_message_at: message.created_at || new Date() } },
    ),
    ConversationParticipant.updateOne(
      { _id: participant._id },
      { $set: { last_read_message_id: message._id, last_read_at: new Date(), archived: false } },
    ),
  ]);

  if (isClinicalAdvice) {
    await recordAuditLog({
      actor,
      action: 'message.clinical_advice.create',
      targetType: 'message',
      targetId: message._id,
      status: 'success',
      message: 'Gửi tin nhắn tư vấn lâm sàng.',
      requestMeta,
      metadata: {
        patient_id: toId(conversation.patient_id),
        conversation_id: toId(conversation._id),
      },
    });
  }

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.MESSAGE_SENT,
    aggregateType: 'message',
    aggregateId: message._id,
    recipientScope: conversationRecipientScope(conversation, {
      recipients: conversation.patient_id
        ? [{ recipient_type: 'patient', recipient_id: conversation.patient_id, patient_id: conversation.patient_id }]
        : [],
    }),
    payload: {
      conversation_id: toId(conversation._id),
      message_id: toId(message._id),
      message_type: message.message_type,
      sender_actor_type: message.sender_actor_type,
      sender_actor_id: toId(message.sender_actor_id),
      notification: isInternalNote ? undefined : {
        title: 'Tin nhắn mới',
        body: body || `Tin nhắn ${message.message_type}`,
        priority: conversation.priority || 'normal',
      },
    },
  });

  return {
    ...message.toObject(),
    attachments: attachments.map((item) => (typeof item.toObject === 'function' ? item.toObject() : item)),
  };
}

async function markConversationRead(conversationId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'read');
  const { conversation, participant } = await requireConversationAccess(conversationId, actor);
  const messageId = payload.message_id || payload.messageId;
  let message = null;

  if (messageId) {
    message = await Message.findOne({
      _id: assertObjectId(messageId, 'message_id'),
      conversation_id: conversation._id,
      ...(isStaff(actor) ? {} : { is_internal_note: false }),
    }).lean();
    if (!message) throw createError('Không tìm thấy message trong conversation.', 404);
  } else {
    message = await Message.findOne({
      conversation_id: conversation._id,
      status: { $ne: MESSAGE_STATUS.DELETED },
      ...(isStaff(actor) ? {} : { is_internal_note: false }),
    }).sort({ created_at: -1 }).lean();
  }

  const now = new Date();
  await ConversationParticipant.updateOne(
    { _id: participant._id },
    {
      $set: {
        last_read_message_id: message?._id,
        last_read_at: now,
        archived: false,
      },
    },
  );

  await recordAuditLog({
    actor,
    action: 'message.conversation.read',
    targetType: 'conversation',
    targetId: conversation._id,
    status: 'success',
    message: 'Đánh dấu conversation đã đọc.',
    requestMeta,
    metadata: {
      message_id: toId(message?._id),
      patient_id: toId(conversation.patient_id),
    },
  });

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.MESSAGE_READ,
    aggregateType: 'conversation',
    aggregateId: conversation._id,
    recipientScope: conversationRecipientScope(conversation),
    payload: {
      conversation_id: toId(conversation._id),
      message_id: toId(message?._id),
      read_by_actor_type: actorType(actor),
      read_at: now,
    },
  });

  return { conversation_id: toId(conversation._id), last_read_message_id: toId(message?._id), last_read_at: now };
}

async function archiveConversation(conversationId, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'read');
  const { conversation, participant } = await requireConversationAccess(conversationId, actor);
  await ConversationParticipant.updateOne({ _id: participant._id }, { $set: { archived: true } });

  await recordAuditLog({
    actor,
    action: 'message.conversation.archive',
    targetType: 'conversation',
    targetId: conversation._id,
    status: 'success',
    message: 'Archive conversation cho participant.',
    requestMeta,
  });

  return { conversation_id: toId(conversation._id), archived: true };
}

async function closeConversation(conversationId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'moderate');
  const { conversation, participant } = await requireConversationAccess(conversationId, actor);
  assertCanModerateConversation(participant, actor);

  if (conversation.status === CONVERSATION_STATUS.CLOSED) return conversation;

  const snapshot = actorSnapshot(actor);
  const updated = await Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $set: {
        status: CONVERSATION_STATUS.CLOSED,
        closed_at: new Date(),
        closed_by: {
          actor_type: snapshot.actor_type,
          actor_id: snapshot.actor_id,
        },
        metadata: {
          ...(conversation.metadata || {}),
          close_reason: payload.reason || payload.close_reason,
        },
      },
    },
    { new: true },
  ).lean();

  await recordAuditLog({
    actor,
    action: 'message.conversation.close',
    targetType: 'conversation',
    targetId: conversation._id,
    status: 'success',
    message: 'Đóng conversation.',
    requestMeta,
    metadata: { reason: payload.reason || payload.close_reason },
  });

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.CONVERSATION_CLOSED,
    aggregateType: 'conversation',
    aggregateId: conversation._id,
    recipientScope: conversationRecipientScope(conversation),
    payload: {
      conversation_id: toId(conversation._id),
      reason: payload.reason || payload.close_reason,
    },
  });

  return updated;
}

async function reopenConversation(conversationId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'moderate');
  requireStaff(actor);
  const { conversation } = await requireConversationAccess(conversationId, actor);

  const updated = await Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $set: {
        status: CONVERSATION_STATUS.OPEN,
        closed_at: null,
        closed_by: null,
        metadata: {
          ...(conversation.metadata || {}),
          reopen_reason: payload.reason || payload.reopen_reason,
        },
      },
    },
    { new: true },
  ).lean();

  await recordAuditLog({
    actor,
    action: 'message.conversation.reopen',
    targetType: 'conversation',
    targetId: conversation._id,
    status: 'success',
    message: 'Mở lại conversation.',
    requestMeta,
    metadata: { reason: payload.reason || payload.reopen_reason },
  });

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.CONVERSATION_REOPENED,
    aggregateType: 'conversation',
    aggregateId: conversation._id,
    recipientScope: conversationRecipientScope(updated),
    payload: {
      conversation_id: toId(conversation._id),
      reason: payload.reason || payload.reopen_reason,
      status: updated.status,
      notification: {
        title: 'Conversation đã được mở lại',
        body: updated.title || updated.conversation_code || 'Cuộc trò chuyện đã được mở lại.',
        priority: updated.priority || 'normal',
      },
    },
  });

  return updated;
}

async function assignConversation(conversationId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'moderate');
  requireStaff(actor);
  const { conversation } = await requireConversationAccess(conversationId, actor);
  const assignedUserId = assertObjectId(payload.assigned_user_id || payload.assignedUserId, 'assigned_user_id');
  if (!assignedUserId && !payload.assigned_department_id && !payload.assignedDepartmentId) {
    throw createError('Cần assigned_user_id hoặc assigned_department_id.', 422);
  }
  if (assignedUserId) await ensureUserExists(assignedUserId);
  const assignedDepartmentId = assertObjectId(payload.assigned_department_id || payload.assignedDepartmentId, 'assigned_department_id');

  const updated = await Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $set: {
        assigned_user_id: assignedUserId || conversation.assigned_user_id,
        assigned_department_id: assignedDepartmentId || conversation.assigned_department_id,
        status: conversation.status === CONVERSATION_STATUS.CLOSED ? CONVERSATION_STATUS.OPEN : conversation.status,
      },
    },
    { new: true },
  ).lean();

  if (assignedUserId) {
    await upsertParticipant(conversation._id, {
      actor_type: ACTOR_TYPE.STAFF,
      actor_id: toId(assignedUserId),
      actor_role_code: payload.assigned_role_code || null,
      role_in_conversation: CONVERSATION_PARTICIPANT_ROLE.ASSIGNEE,
    });
  }

  await recordAuditLog({
    actor,
    action: 'message.conversation.assign',
    targetType: 'conversation',
    targetId: conversation._id,
    status: 'success',
    message: 'Assign conversation.',
    requestMeta,
    metadata: {
      assigned_user_id: toId(assignedUserId),
      assigned_department_id: toId(assignedDepartmentId),
    },
  });

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.CONVERSATION_ASSIGNED,
    aggregateType: 'conversation',
    aggregateId: conversation._id,
    recipientScope: conversationRecipientScope(updated, {
      recipients: assignedUserId ? [{ recipient_type: 'staff', recipient_id: assignedUserId, actor_type: 'staff', actor_id: assignedUserId }] : [],
    }),
    payload: {
      conversation_id: toId(conversation._id),
      assigned_user_id: toId(assignedUserId),
      assigned_department_id: toId(assignedDepartmentId),
      notification: assignedUserId ? {
        title: 'Bạn được gán conversation',
        body: updated.title || updated.conversation_code,
        priority: updated.priority || 'normal',
      } : undefined,
    },
  });

  return updated;
}

async function escalateConversation(conversationId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'moderate');
  requireStaff(actor);
  const { conversation } = await requireConversationAccess(conversationId, actor);
  const priority = normalizeConversationPriority(payload.priority || CONVERSATION_PRIORITY.URGENT);
  if (![CONVERSATION_PRIORITY.HIGH, CONVERSATION_PRIORITY.URGENT].includes(priority)) {
    throw createError('Escalate chỉ nhận priority high hoặc urgent.', 422);
  }

  const assignedUserId = assertObjectId(payload.assigned_user_id || payload.assignedUserId, 'assigned_user_id');
  const assignedDepartmentId = assertObjectId(payload.assigned_department_id || payload.assignedDepartmentId, 'assigned_department_id');
  if (assignedUserId) await ensureUserExists(assignedUserId);

  const updated = await Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $set: {
        priority,
        status: CONVERSATION_STATUS.PENDING,
        assigned_user_id: assignedUserId || conversation.assigned_user_id,
        assigned_department_id: assignedDepartmentId || conversation.assigned_department_id,
        metadata: {
          ...(conversation.metadata || {}),
          escalation_reason: payload.reason || payload.escalation_reason,
          escalated_at: new Date(),
        },
      },
    },
    { new: true },
  ).lean();

  if (assignedUserId) {
    await upsertParticipant(conversation._id, {
      actor_type: ACTOR_TYPE.STAFF,
      actor_id: toId(assignedUserId),
      actor_role_code: payload.assigned_role_code || null,
      role_in_conversation: CONVERSATION_PARTICIPANT_ROLE.ASSIGNEE,
    });
  }

  await recordAuditLog({
    actor,
    action: 'message.conversation.escalate',
    targetType: 'conversation',
    targetId: conversation._id,
    status: 'success',
    message: 'Escalate conversation.',
    requestMeta,
    metadata: {
      priority,
      reason: payload.reason || payload.escalation_reason,
      assigned_user_id: toId(assignedUserId),
      assigned_department_id: toId(assignedDepartmentId),
    },
  });

  return updated;
}

async function addConversationAttachments(conversationId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'send');
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments
    : [payload];
  if (attachments.length === 0) throw createError('attachments không được rỗng.', 422);

  return sendMessage(conversationId, {
    message_type: MESSAGE_TYPE.FILE,
    body: payload.body,
    attachments,
    is_internal_note: payload.is_internal_note,
  }, actor, requestMeta);
}

function normalizeTranscriptSegments(segments = []) {
  if (!Array.isArray(segments)) throw createError('transcript_segments phải là array.', 422);

  return segments.map((segment, index) => {
    const speakerActorType = normalizeActorType(segment.speaker_actor_type || segment.speakerActorType);
    const speakerActorId = toId(segment.speaker_actor_id || segment.speakerActorId);
    const startSecond = Number(segment.start_second ?? segment.startSecond);
    const endSecond = Number(segment.end_second ?? segment.endSecond);
    const text = normalizeString(segment.text);

    if (!speakerActorType || !speakerActorId) {
      throw createError(`transcript_segments[${index}] thiếu speaker actor.`, 422);
    }
    if (!Number.isFinite(startSecond) || startSecond < 0) {
      throw createError(`transcript_segments[${index}].start_second không hợp lệ.`, 422);
    }
    if (!Number.isFinite(endSecond) || endSecond < startSecond) {
      throw createError(`transcript_segments[${index}].end_second không hợp lệ.`, 422);
    }
    if (!text) {
      throw createError(`transcript_segments[${index}].text là bắt buộc.`, 422);
    }

    return {
      speaker_actor_type: speakerActorType,
      speaker_actor_id: speakerActorId,
      start_second: startSecond,
      end_second: endSecond,
      text,
    };
  });
}

async function requireConversationCall(conversationId, callId, actor = {}) {
  const { conversation, participant } = await requireConversationAccess(conversationId, actor);
  const call = await ConversationCall.findOne({
    _id: callId,
    conversation_id: conversation._id,
  });
  if (!call) throw createError('Không tìm thấy cuộc gọi trong conversation.', 404);
  return { conversation, participant, call };
}

async function createConversationCall(conversationId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'send');
  const { conversation } = await requireConversationAccess(conversationId, actor);
  const snapshot = actorSnapshot(actor);
  const initialStatus = normalizeCallStatus(
    payload.status,
    normalizeBoolean(payload.start_now || payload.startNow)
      ? CONVERSATION_CALL_STATUS.ONGOING
      : CONVERSATION_CALL_STATUS.SCHEDULED,
  );
  const now = new Date();

  const call = await ConversationCall.create({
    conversation_id: conversation._id,
    call_type: normalizeCallType(payload.call_type || payload.callType),
    provider: normalizeCallProvider(payload.provider),
    started_by_actor_type: snapshot.actor_type,
    started_by_actor_id: snapshot.actor_id,
    started_at: initialStatus === CONVERSATION_CALL_STATUS.ONGOING ? now : payload.started_at,
    status: initialStatus,
    recording_url: normalizeString(payload.recording_url || payload.recordingUrl),
    recording_attachment_id: assertObjectId(payload.recording_attachment_id || payload.recordingAttachmentId, 'recording_attachment_id'),
    transcript_status: normalizeTranscriptStatus(payload.transcript_status || payload.transcriptStatus),
    transcript_text: payload.transcript_text || payload.transcriptText,
    transcript_segments: payload.transcript_segments ? normalizeTranscriptSegments(payload.transcript_segments) : [],
    summary: payload.summary,
    action_items: normalizeActionItems(payload.action_items || payload.actionItems),
    consent_recorded: normalizeBoolean(payload.consent_recorded || payload.consentRecorded),
    metadata: payload.metadata,
  });

  await recordAuditLog({
    actor,
    action: 'message.call.create',
    targetType: 'conversation_call',
    targetId: call._id,
    status: 'success',
    message: 'Tạo cuộc gọi trong conversation.',
    requestMeta,
    metadata: {
      conversation_id: toId(conversation._id),
      patient_id: toId(conversation.patient_id),
      call_type: call.call_type,
      provider: call.provider,
    },
  });

  if (call.status === CONVERSATION_CALL_STATUS.ONGOING) {
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.CALL_STARTED,
      aggregateType: 'conversation_call',
      aggregateId: call._id,
      recipientScope: conversationRecipientScope(conversation),
      payload: {
        conversation_id: toId(conversation._id),
        call_id: toId(call._id),
        call_type: call.call_type,
        provider: call.provider,
      },
    });
  }

  return call.toObject();
}

async function startConversationCall(conversationId, callId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'send');
  const { conversation, call } = await requireConversationCall(conversationId, callId, actor);
  if ([CONVERSATION_CALL_STATUS.COMPLETED, CONVERSATION_CALL_STATUS.MISSED, CONVERSATION_CALL_STATUS.FAILED].includes(call.status)) {
    throw createError('Cuộc gọi đã kết thúc, không thể start lại.', 409);
  }

  call.status = CONVERSATION_CALL_STATUS.ONGOING;
  call.started_at = call.started_at || new Date();
  call.metadata = {
    ...(call.metadata || {}),
    ...(payload.metadata || {}),
  };
  if (payload.consent_recorded !== undefined || payload.consentRecorded !== undefined) {
    call.consent_recorded = normalizeBoolean(payload.consent_recorded || payload.consentRecorded);
  }
  await call.save();

  await recordAuditLog({
    actor,
    action: 'message.call.start',
    targetType: 'conversation_call',
    targetId: call._id,
    status: 'success',
    message: 'Bắt đầu cuộc gọi trong conversation.',
    requestMeta,
    metadata: {
      conversation_id: toId(conversation._id),
      patient_id: toId(conversation.patient_id),
    },
  });

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.CALL_STARTED,
    aggregateType: 'conversation_call',
    aggregateId: call._id,
    recipientScope: conversationRecipientScope(conversation),
    payload: {
      conversation_id: toId(conversation._id),
      call_id: toId(call._id),
      call_type: call.call_type,
      provider: call.provider,
    },
  });

  return call.toObject();
}

async function endConversationCall(conversationId, callId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'send');
  const { conversation, call } = await requireConversationCall(conversationId, callId, actor);
  const finalStatus = normalizeCallStatus(payload.status, CONVERSATION_CALL_STATUS.COMPLETED);
  if (![CONVERSATION_CALL_STATUS.COMPLETED, CONVERSATION_CALL_STATUS.MISSED, CONVERSATION_CALL_STATUS.FAILED].includes(finalStatus)) {
    throw createError('Kết thúc cuộc gọi chỉ nhận status completed, missed hoặc failed.', 422);
  }
  if ([CONVERSATION_CALL_STATUS.COMPLETED, CONVERSATION_CALL_STATUS.MISSED, CONVERSATION_CALL_STATUS.FAILED].includes(call.status)) {
    throw createError('Cuộc gọi đã được kết thúc trước đó.', 409);
  }

  const endedAt = payload.ended_at ? new Date(payload.ended_at) : new Date();
  if (Number.isNaN(endedAt.getTime())) throw createError('ended_at không hợp lệ.', 422);

  call.status = finalStatus;
  call.ended_at = endedAt;
  if (payload.started_at && !call.started_at) {
    const startedAt = new Date(payload.started_at);
    if (Number.isNaN(startedAt.getTime())) throw createError('started_at không hợp lệ.', 422);
    call.started_at = startedAt;
  }
  call.duration_seconds = Number(payload.duration_seconds ?? payload.durationSeconds)
    || (call.started_at ? Math.max(0, Math.round((endedAt.getTime() - new Date(call.started_at).getTime()) / 1000)) : undefined);
  if (payload.recording_url || payload.recordingUrl) call.recording_url = normalizeString(payload.recording_url || payload.recordingUrl);
  if (payload.recording_attachment_id || payload.recordingAttachmentId) {
    call.recording_attachment_id = assertObjectId(payload.recording_attachment_id || payload.recordingAttachmentId, 'recording_attachment_id');
  }
  if (payload.transcript_status || payload.transcriptStatus) {
    call.transcript_status = normalizeTranscriptStatus(payload.transcript_status || payload.transcriptStatus);
  } else if ((call.recording_url || call.recording_attachment_id) && call.transcript_status === VOICE_TRANSCRIPT_STATUS.NONE) {
    call.transcript_status = VOICE_TRANSCRIPT_STATUS.PENDING;
  }
  call.metadata = {
    ...(call.metadata || {}),
    ...(payload.metadata || {}),
    end_reason: payload.reason || payload.end_reason || call.metadata?.end_reason,
  };
  await call.save();

  await recordAuditLog({
    actor,
    action: 'message.call.end',
    targetType: 'conversation_call',
    targetId: call._id,
    status: 'success',
    message: 'Kết thúc cuộc gọi trong conversation.',
    requestMeta,
    metadata: {
      conversation_id: toId(conversation._id),
      patient_id: toId(conversation.patient_id),
      call_status: call.status,
      duration_seconds: call.duration_seconds,
    },
  });

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.CALL_ENDED,
    aggregateType: 'conversation_call',
    aggregateId: call._id,
    recipientScope: conversationRecipientScope(conversation),
    payload: {
      conversation_id: toId(conversation._id),
      call_id: toId(call._id),
      status: call.status,
      duration_seconds: call.duration_seconds,
    },
  });

  if (call.transcript_status === VOICE_TRANSCRIPT_STATUS.COMPLETED) {
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.CALL_TRANSCRIPT_READY,
      aggregateType: 'conversation_call',
      aggregateId: call._id,
      recipientScope: conversationRecipientScope(conversation),
      payload: {
        conversation_id: toId(conversation._id),
        call_id: toId(call._id),
        segment_count: call.transcript_segments?.length || 0,
        notification: {
          title: 'Transcript cuộc gọi đã sẵn sàng',
          body: call.summary || 'Transcript cuộc gọi đã được xử lý.',
          priority: 'normal',
        },
      },
    });
  }

  return call.toObject();
}

async function updateConversationCallTranscript(conversationId, callId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'send');
  requireStaff(actor);
  const { conversation, call } = await requireConversationCall(conversationId, callId, actor);

  call.transcript_status = normalizeTranscriptStatus(
    payload.transcript_status || payload.transcriptStatus,
    VOICE_TRANSCRIPT_STATUS.COMPLETED,
  );
  if (payload.transcript_text !== undefined || payload.transcriptText !== undefined) {
    call.transcript_text = payload.transcript_text || payload.transcriptText;
  }
  if (payload.transcript_segments !== undefined || payload.transcriptSegments !== undefined) {
    call.transcript_segments = normalizeTranscriptSegments(payload.transcript_segments || payload.transcriptSegments);
  }
  if (payload.summary !== undefined) call.summary = payload.summary;
  if (payload.action_items !== undefined || payload.actionItems !== undefined) {
    call.action_items = normalizeActionItems(payload.action_items || payload.actionItems);
  }
  call.metadata = {
    ...(call.metadata || {}),
    ...(payload.metadata || {}),
  };
  await call.save();

  await recordAuditLog({
    actor,
    action: 'message.call.transcript_update',
    targetType: 'conversation_call',
    targetId: call._id,
    status: 'success',
    message: 'Cập nhật transcript cuộc gọi.',
    requestMeta,
    metadata: {
      conversation_id: toId(conversation._id),
      patient_id: toId(conversation.patient_id),
      transcript_status: call.transcript_status,
      segment_count: call.transcript_segments?.length || 0,
    },
  });

  if (call.transcript_status === VOICE_TRANSCRIPT_STATUS.COMPLETED) {
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.CALL_TRANSCRIPT_READY,
      aggregateType: 'conversation_call',
      aggregateId: call._id,
      recipientScope: conversationRecipientScope(conversation),
      payload: {
        conversation_id: toId(conversation._id),
        call_id: toId(call._id),
        segment_count: call.transcript_segments?.length || 0,
        notification: {
          title: 'Transcript cuộc gọi đã sẵn sàng',
          body: call.summary || 'Transcript cuộc gọi đã được xử lý.',
          priority: 'normal',
        },
      },
    });
  }

  return call.toObject();
}

async function getConversationCall(conversationId, callId, actor = {}) {
  assertMessagingPermission(actor, 'read');
  const { call } = await requireConversationCall(conversationId, callId, actor);
  return call.toObject ? call.toObject() : call;
}

function callNeedsDoctorConfirmation(conversation = {}, payload = {}) {
  if (payload.is_clinical_related !== undefined || payload.isClinicalRelated !== undefined) {
    return normalizeBoolean(payload.is_clinical_related || payload.isClinicalRelated);
  }
  return [
    CONVERSATION_TYPE.DOCTOR_PATIENT,
    CONVERSATION_TYPE.CARE_TEAM_PATIENT,
    CONVERSATION_TYPE.EMERGENCY,
  ].includes(conversation.type);
}

function assertDoctorConfirmedCall(conversation = {}, payload = {}, actor = {}) {
  if (!callNeedsDoctorConfirmation(conversation, payload)) return;
  if ((actor.roles || []).includes(ROLE_CODE.DOCTOR) || hasPermission(actor, PERMISSION.CLINICAL_NOTES.SIGN)) return;
  throw createError('Cuộc gọi liên quan điều trị cần bác sĩ xác nhận trước khi lưu vào clinical note.', 403);
}

function buildClinicalNoteContentFromCall(call, payload = {}) {
  const sections = [];
  const summary = normalizeString(payload.summary || call.summary);
  const actionItems = normalizeActionItems(payload.action_items || payload.actionItems || call.action_items || []);
  const transcriptText = normalizeString(payload.transcript_text || payload.transcriptText || call.transcript_text);
  const segments = payload.transcript_segments || payload.transcriptSegments || call.transcript_segments || [];

  if (summary) sections.push(`Summary:\n${summary}`);
  if (actionItems.length > 0) sections.push(`Action items:\n${actionItems.map((item) => `- ${item}`).join('\n')}`);
  if (transcriptText) sections.push(`Transcript:\n${transcriptText}`);
  if (!transcriptText && segments.length > 0) {
    const segmentLines = segments.map((segment) => {
      const speaker = `${segment.speaker_actor_type}:${toId(segment.speaker_actor_id)}`;
      return `[${segment.start_second}-${segment.end_second}s] ${speaker}: ${segment.text}`;
    });
    sections.push(`Transcript segments:\n${segmentLines.join('\n')}`);
  }

  return sections.join('\n\n') || 'Voice call note.';
}

async function saveConversationCallAsClinicalNote(conversationId, callId, payload = {}, actor = {}, requestMeta = {}) {
  assertMessagingPermission(actor, 'send');
  requireStaff(actor);
  const { conversation, call } = await requireConversationCall(conversationId, callId, actor);
  assertDoctorConfirmedCall(conversation, payload, actor);

  if (call.status !== CONVERSATION_CALL_STATUS.COMPLETED && !normalizeBoolean(payload.allow_incomplete_call || payload.allowIncompleteCall)) {
    throw createError('Chỉ cuộc gọi completed mới được lưu vào clinical note.', 409);
  }
  if (
    call.transcript_status !== VOICE_TRANSCRIPT_STATUS.COMPLETED
    && !normalizeBoolean(payload.allow_incomplete_transcript || payload.allowIncompleteTranscript)
  ) {
    throw createError('Transcript chưa completed, chưa thể lưu vào clinical note.', 409);
  }

  const encounterId = assertObjectId(payload.encounter_id || payload.encounterId || conversation.encounter_id, 'encounter_id');
  if (!encounterId) throw createError('Cần encounter_id để lưu cuộc gọi thành clinical note.', 422);

  const noteResult = await clinicalService.createClinicalNote({
    encounter_id: encounterId,
    consultation_id: payload.consultation_id || payload.consultationId,
    note_type: payload.note_type || 'voice_call_transcript',
    title: payload.title || `Voice call ${call.call_type} - ${conversation.conversation_code}`,
    content: buildClinicalNoteContentFromCall(call, payload),
    status: payload.status || CLINICAL_NOTE_STATUS.DRAFT,
  }, actor, requestMeta);

  const clinicalNoteId = noteResult?.clinical_note?._id || noteResult?.clinical_note?.id;
  call.metadata = {
    ...(call.metadata || {}),
    saved_as_clinical_note_id: clinicalNoteId ? toId(clinicalNoteId) : undefined,
    saved_as_clinical_note_at: new Date(),
    saved_as_clinical_note_by: actor.userId || actor.user_id,
  };
  await call.save();

  await recordAuditLog({
    actor,
    action: 'message.call.save_as_clinical_note',
    targetType: 'conversation_call',
    targetId: call._id,
    status: 'success',
    message: 'Lưu transcript cuộc gọi thành clinical note.',
    requestMeta,
    metadata: {
      conversation_id: toId(conversation._id),
      patient_id: toId(conversation.patient_id),
      encounter_id: toId(encounterId),
      clinical_note_id: clinicalNoteId ? toId(clinicalNoteId) : null,
    },
  });

  return {
    call: call.toObject(),
    clinical_note: noteResult?.clinical_note || noteResult,
  };
}

module.exports = {
  // createConversation: Tạo conversation messaging đa actor.
  createConversation,
  // listConversations: Liệt kê conversation mà actor hiện tại tham gia.
  listConversations,
  // getConversation: Lấy chi tiết conversation.
  getConversation,
  // listMessages: Liệt kê messages trong conversation.
  listMessages,
  // sendMessage: Gửi message vào conversation.
  sendMessage,
  // markConversationRead: Cập nhật trạng thái đọc trên participant.
  markConversationRead,
  // archiveConversation: Archive conversation theo participant.
  archiveConversation,
  // closeConversation: Đóng conversation.
  closeConversation,
  // reopenConversation: Mở lại conversation.
  reopenConversation,
  // assignConversation: Gán conversation cho user/department.
  assignConversation,
  // escalateConversation: Escalate conversation lên high/urgent.
  escalateConversation,
  // addConversationAttachments: Tạo message file và metadata attachment.
  addConversationAttachments,
  // createConversationCall: Tạo phiên voice/video call trong conversation.
  createConversationCall,
  // startConversationCall: Chuyển cuộc gọi sang ongoing.
  startConversationCall,
  // endConversationCall: Kết thúc cuộc gọi và lưu recording metadata nếu có.
  endConversationCall,
  // updateConversationCallTranscript: Cập nhật transcript, segments, summary và action items.
  updateConversationCallTranscript,
  // getConversationCall: Lấy chi tiết cuộc gọi trong conversation.
  getConversationCall,
  // saveConversationCallAsClinicalNote: Lưu transcript cuộc gọi thành clinical note qua clinical service.
  saveConversationCallAsClinicalNote,
};
