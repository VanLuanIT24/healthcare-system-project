const { randomBytes } = require('crypto');
const { Conversation, Patient, SupportTicket } = require('../models');
const {
  ACTOR_TYPE,
  CONVERSATION_TYPE,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_PRIORITY,
  SUPPORT_TICKET_SLA_MINUTES,
  SUPPORT_TICKET_STATUS,
  SUPPORT_TICKET_STATUSES,
  REALTIME_EVENT_TYPE,
} = require('../constants/statuses');
const { buildPagination, createError, getPagination, recordAuditLog } = require('./core.service');
const actorContext = require('../common/actors');
const messageService = require('./message.service');
const eventBus = require('../events/event-bus.service');
const { isValidObjectId, toObjectId } = require('../common/helpers/object-id.helper');

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizeEnum(value, allowed, fallback, label) {
  const normalized = normalizeString(value) || fallback;
  if (!allowed.includes(normalized)) throw createError(`${label} không hợp lệ.`, 422);
  return normalized;
}

function actorSnapshot(actor = {}) {
  const context = actorContext.buildActorContext(actor);
  return {
    actor_type: context.actor_type,
    actor_id: context.actor_id,
  };
}

function isStaff(actor = {}) {
  return actorContext.getActorType(actor) === ACTOR_TYPE.STAFF;
}

function requireStaff(actor = {}) {
  if (!isStaff(actor)) throw createError('Chỉ nhân sự được thao tác ticket này.', 403);
}

async function generateTicketCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const exists = await SupportTicket.exists({ ticket_code: code });
    if (!exists) return code;
  }
  throw createError('Không thể sinh mã ticket.', 409);
}

function slaDueAt(priority) {
  const minutes = SUPPORT_TICKET_SLA_MINUTES[priority] || SUPPORT_TICKET_SLA_MINUTES[SUPPORT_TICKET_PRIORITY.NORMAL];
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function resolvePatientId(payload = {}, actor = {}) {
  const actorType = actorContext.getActorType(actor);
  const patientId = actorType === ACTOR_TYPE.PATIENT || actorType === ACTOR_TYPE.PATIENT_RELATIVE
    ? actorContext.getPatientId(actor)
    : payload.patient_id || payload.patientId;
  if (!patientId || !isValidObjectId(patientId)) throw createError('patient_id không hợp lệ.', 422);
  const patient = await Patient.findOne({ _id: patientId, is_deleted: false }).lean();
  if (!patient) throw createError('Không tìm thấy patient.', 404);
  return toObjectId(patientId, 'patient_id');
}

function assertTicketAccess(ticket, actor = {}) {
  if (isStaff(actor)) return true;
  const patientId = actorContext.getPatientId(actor);
  if (patientId && toId(ticket.patient_id) === toId(patientId)) return true;
  throw createError('Bạn không có quyền truy cập ticket này.', 403);
}

async function createTicket(payload = {}, actor = {}, requestMeta = {}) {
  const patientId = await resolvePatientId(payload, actor);
  const category = normalizeEnum(payload.category, SUPPORT_CATEGORIES, SUPPORT_CATEGORY.OTHER, 'category');
  const priority = normalizeEnum(payload.priority, SUPPORT_TICKET_PRIORITIES, SUPPORT_TICKET_PRIORITY.NORMAL, 'priority');
  const subject = normalizeString(payload.subject);
  if (!subject) throw createError('subject là bắt buộc.', 422);
  const creator = actorSnapshot(actor);

  const conversation = await messageService.createConversation({
    type: CONVERSATION_TYPE.SUPPORT,
    patient_id: patientId,
    title: subject,
    priority,
    assigned_department_id: payload.assigned_department_id || payload.assignedDepartmentId,
    assigned_user_id: payload.assigned_user_id || payload.assignedUserId,
    initial_message: payload.description ? { body: payload.description } : undefined,
    metadata: {
      support_category: category,
      ...(payload.metadata || {}),
    },
  }, actor, requestMeta);

  const ticket = await SupportTicket.create({
    ticket_code: await generateTicketCode(),
    patient_id: patientId,
    created_by_actor_type: creator.actor_type,
    created_by_actor_id: creator.actor_id,
    category,
    subject,
    description: payload.description,
    priority,
    status: SUPPORT_TICKET_STATUS.OPEN,
    assigned_department_id: payload.assigned_department_id || payload.assignedDepartmentId,
    assigned_user_id: payload.assigned_user_id || payload.assignedUserId,
    conversation_id: conversation._id || conversation.id,
    sla_due_at: slaDueAt(priority),
    metadata: payload.metadata,
    created_by: actor.userId,
    updated_by: actor.userId,
  });

  await Conversation.findByIdAndUpdate(ticket.conversation_id, { $set: { ticket_id: ticket._id } });

  await recordAuditLog({
    actor,
    action: 'support.ticket_created',
    targetType: 'support_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Tạo support ticket.',
    requestMeta,
    metadata: { patient_id: toId(patientId), priority, category },
  });

  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.SUPPORT_TICKET_CREATED,
    aggregateType: 'support_ticket',
    aggregateId: ticket._id,
    recipientScope: {
      patient_id: patientId,
      department_id: ticket.assigned_department_id,
      user_id: ticket.assigned_user_id,
      support_ticket_id: ticket._id,
      conversation_id: ticket.conversation_id,
      role: ['admin', 'receptionist'],
      recipients: [{ recipient_type: 'patient', recipient_id: patientId, patient_id: patientId }],
    },
    payload: {
      ticket_id: toId(ticket._id),
      ticket_code: ticket.ticket_code,
      subject,
      priority,
      notification: {
        title: 'Ticket hỗ trợ đã được tạo',
        body: `Ticket ${ticket.ticket_code} đang chờ xử lý.`,
        priority,
      },
    },
  });

  return getTicket(ticket._id, actor);
}

async function listTickets(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (!isStaff(actor)) filter.patient_id = actorContext.getPatientId(actor);
  for (const field of ['patient_id', 'category', 'priority', 'status', 'assigned_department_id', 'assigned_user_id']) {
    if (query[field] && (isStaff(actor) || field !== 'patient_id')) filter[field] = query[field];
  }
  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ priority: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('assigned_user_id', 'full_name username employee_code')
      .populate('assigned_department_id', 'department_name department_code')
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getTicket(ticketId, actor = {}) {
  const ticket = await SupportTicket.findById(ticketId)
    .populate('conversation_id')
    .populate('assigned_user_id', 'full_name username employee_code')
    .populate('assigned_department_id', 'department_name department_code')
    .lean();
  if (!ticket) throw createError('Không tìm thấy ticket.', 404);
  assertTicketAccess(ticket, actor);
  return ticket;
}

async function replyTicket(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy ticket.', 404);
  assertTicketAccess(ticket, actor);
  if (!ticket.conversation_id) throw createError('Ticket chưa có conversation.', 409);
  const message = await messageService.sendMessage(ticket.conversation_id, payload, actor, requestMeta);
  ticket.status = isStaff(actor) ? SUPPORT_TICKET_STATUS.WAITING_PATIENT : SUPPORT_TICKET_STATUS.WAITING_STAFF;
  ticket.updated_by = actor.userId;
  await ticket.save();
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.SUPPORT_TICKET_REPLY_ADDED,
    aggregateType: 'support_ticket',
    aggregateId: ticket._id,
    recipientScope: {
      patient_id: ticket.patient_id,
      department_id: ticket.assigned_department_id,
      user_id: ticket.assigned_user_id,
      support_ticket_id: ticket._id,
      conversation_id: ticket.conversation_id,
      recipients: [{ recipient_type: 'patient', recipient_id: ticket.patient_id, patient_id: ticket.patient_id }],
    },
    payload: {
      ticket_id: toId(ticket._id),
      message_id: toId(message._id || message.id),
      notification: {
        title: 'Ticket hỗ trợ có phản hồi mới',
        body: ticket.subject,
        priority: ticket.priority,
      },
    },
  });
  return { ticket: ticket.toObject(), message };
}

async function assignTicket(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy ticket.', 404);
  ticket.assigned_department_id = payload.assigned_department_id || payload.assignedDepartmentId || ticket.assigned_department_id;
  ticket.assigned_user_id = payload.assigned_user_id || payload.assignedUserId || ticket.assigned_user_id;
  if ([SUPPORT_TICKET_STATUS.CLOSED, SUPPORT_TICKET_STATUS.CANCELLED].includes(ticket.status)) {
    throw createError('Ticket đã đóng/hủy, không thể assign.', 409);
  }
  ticket.status = SUPPORT_TICKET_STATUS.WAITING_STAFF;
  ticket.updated_by = actor.userId;
  await ticket.save();
  if (ticket.conversation_id) {
    await messageService.assignConversation(ticket.conversation_id, payload, actor, requestMeta);
  }
  await recordAuditLog({ actor, action: 'support.ticket_assign', targetType: 'support_ticket', targetId: ticket._id, status: 'success', message: 'Assign support ticket.', requestMeta });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.SUPPORT_TICKET_ASSIGNED,
    aggregateType: 'support_ticket',
    aggregateId: ticket._id,
    recipientScope: {
      patient_id: ticket.patient_id,
      department_id: ticket.assigned_department_id,
      user_id: ticket.assigned_user_id,
      support_ticket_id: ticket._id,
      recipients: ticket.assigned_user_id ? [{ recipient_type: 'staff', recipient_id: ticket.assigned_user_id, actor_type: 'staff', actor_id: ticket.assigned_user_id }] : [],
    },
    payload: {
      ticket_id: toId(ticket._id),
      assigned_user_id: toId(ticket.assigned_user_id),
      assigned_department_id: toId(ticket.assigned_department_id),
      notification: {
        title: 'Bạn được gán ticket hỗ trợ',
        body: ticket.subject,
        priority: ticket.priority,
      },
    },
  });
  return getTicket(ticket._id, actor);
}

async function changePriority(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  requireStaff(actor);
  const priority = normalizeEnum(payload.priority, SUPPORT_TICKET_PRIORITIES, null, 'priority');
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy ticket.', 404);
  ticket.priority = priority;
  ticket.sla_due_at = slaDueAt(priority);
  ticket.updated_by = actor.userId;
  await ticket.save();
  await recordAuditLog({ actor, action: 'support.ticket_priority_changed', targetType: 'support_ticket', targetId: ticket._id, status: 'success', message: 'Đổi priority support ticket.', requestMeta, metadata: { priority } });
  await eventBus.publishDomainEvent({
    eventType: REALTIME_EVENT_TYPE.SUPPORT_TICKET_PRIORITY_CHANGED,
    aggregateType: 'support_ticket',
    aggregateId: ticket._id,
    recipientScope: {
      patient_id: ticket.patient_id,
      department_id: ticket.assigned_department_id,
      user_id: ticket.assigned_user_id,
      support_ticket_id: ticket._id,
    },
    payload: { ticket_id: toId(ticket._id), priority },
  });
  return getTicket(ticket._id, actor);
}

async function transitionTicket(ticketId, nextStatus, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy ticket.', 404);
  assertTicketAccess(ticket, actor);
  if (!SUPPORT_TICKET_STATUSES.includes(nextStatus)) throw createError('status ticket không hợp lệ.', 422);
  if ([SUPPORT_TICKET_STATUS.RESOLVED, SUPPORT_TICKET_STATUS.CLOSED].includes(nextStatus)) requireStaff(actor);
  ticket.status = nextStatus;
  if (nextStatus === SUPPORT_TICKET_STATUS.RESOLVED) ticket.resolved_at = new Date();
  if (nextStatus === SUPPORT_TICKET_STATUS.CLOSED) ticket.closed_at = new Date();
  ticket.metadata = { ...(ticket.metadata || {}), last_transition_reason: payload.reason || payload.note };
  ticket.updated_by = actor.userId;
  await ticket.save();
  if (ticket.conversation_id && nextStatus === SUPPORT_TICKET_STATUS.CLOSED) {
    await messageService.closeConversation(ticket.conversation_id, payload, actor, requestMeta);
  }
  await recordAuditLog({ actor, action: `support.ticket_${nextStatus}`, targetType: 'support_ticket', targetId: ticket._id, status: 'success', message: 'Chuyển trạng thái support ticket.', requestMeta });
  await eventBus.publishDomainEvent({
    eventType: nextStatus === SUPPORT_TICKET_STATUS.RESOLVED
      ? REALTIME_EVENT_TYPE.SUPPORT_TICKET_RESOLVED
      : nextStatus === SUPPORT_TICKET_STATUS.OPEN
        ? REALTIME_EVENT_TYPE.SUPPORT_TICKET_REOPENED
        : `support_ticket.${nextStatus}`,
    aggregateType: 'support_ticket',
    aggregateId: ticket._id,
    recipientScope: {
      patient_id: ticket.patient_id,
      department_id: ticket.assigned_department_id,
      user_id: ticket.assigned_user_id,
      support_ticket_id: ticket._id,
      recipients: [{ recipient_type: 'patient', recipient_id: ticket.patient_id, patient_id: ticket.patient_id }],
    },
    payload: {
      ticket_id: toId(ticket._id),
      status: nextStatus,
      notification: {
        title: 'Ticket hỗ trợ được cập nhật',
        body: `${ticket.subject} - ${nextStatus}`,
        priority: ticket.priority,
      },
    },
  });
  return getTicket(ticket._id, actor);
}

async function resolveTicket(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  return transitionTicket(ticketId, SUPPORT_TICKET_STATUS.RESOLVED, payload, actor, requestMeta);
}

async function closeTicket(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  return transitionTicket(ticketId, SUPPORT_TICKET_STATUS.CLOSED, payload, actor, requestMeta);
}

async function reopenTicket(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  return transitionTicket(ticketId, SUPPORT_TICKET_STATUS.OPEN, payload, actor, requestMeta);
}

async function rateTicket(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy ticket.', 404);
  assertTicketAccess(ticket, actor);
  const rating = Number(payload.satisfaction_rating || payload.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw createError('rating phải từ 1 đến 5.', 422);
  ticket.satisfaction_rating = rating;
  ticket.satisfaction_comment = normalizeString(payload.satisfaction_comment || payload.comment);
  await ticket.save();
  await recordAuditLog({ actor, action: 'support.ticket_rating', targetType: 'support_ticket', targetId: ticket._id, status: 'success', message: 'Đánh giá support ticket.', requestMeta, metadata: { rating } });
  return getTicket(ticket._id, actor);
}

module.exports = {
  createTicket,
  listTickets,
  getTicket,
  replyTicket,
  assignTicket,
  changePriority,
  resolveTicket,
  closeTicket,
  reopenTicket,
  rateTicket,
};
