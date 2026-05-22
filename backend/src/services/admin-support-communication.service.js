const { randomBytes } = require('crypto');
const {
  AuditLog,
  BankStatementTransaction,
  BroadcastCampaign,
  Conversation,
  ConversationParticipant,
  Department,
  Invoice,
  Message,
  Notification,
  NotificationDelivery,
  NotificationTemplate,
  Patient,
  PatientAccount,
  PatientAuthorization,
  PatientRelative,
  PaymentIntent,
  Role,
  SupportReplyTemplate,
  SupportTicket,
  User,
  UserRole,
} = require('../models');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const actorContext = require('../common/actors');
const messageService = require('./message.service');
const notificationService = require('./notification.service');
const supportTicketService = require('./support-ticket.service');
const templateRenderer = require('../notifications/notification-template.service');
const notificationDeliveryWorker = require('../notifications/notification-delivery.worker');
const { isValidObjectId, toObjectId } = require('../common/helpers/object-id.helper');
const {
  ACTOR_TYPE,
  CONVERSATION_PRIORITY,
  CONVERSATION_STATUS,
  CONVERSATION_TYPE,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_DELIVERY_STATUS,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_STATUS,
  SUPPORT_CATEGORY,
  SUPPORT_CATEGORIES,
  SUPPORT_TICKET_PRIORITY,
  SUPPORT_TICKET_STATUS,
} = require('../constants/statuses');

const ACTIVE_TICKET_STATUSES = [
  SUPPORT_TICKET_STATUS.OPEN,
  SUPPORT_TICKET_STATUS.WAITING_PATIENT,
  SUPPORT_TICKET_STATUS.WAITING_STAFF,
];

const CLOSED_TICKET_STATUSES = [
  SUPPORT_TICKET_STATUS.RESOLVED,
  SUPPORT_TICKET_STATUS.CLOSED,
  SUPPORT_TICKET_STATUS.CANCELLED,
];

const DEFAULT_REPLY_TEMPLATES = [
  {
    template_code: 'PAYMENT_TRANSFER_NOT_FOUND',
    name: 'Đã ghi nhận chuyển khoản, đang kiểm tra',
    category: SUPPORT_CATEGORY.BILLING,
    tone: 'calm',
    tags: ['bank_qr', 'manual_payment', 'reconciliation'],
    variables: ['intent_code'],
    body_template: 'Chúng tôi đã ghi nhận thông tin chuyển khoản của bạn. Bộ phận viện phí sẽ kiểm tra giao dịch theo mã nội dung chuyển khoản {{intent_code}} và phản hồi trong thời gian sớm nhất.',
  },
  {
    template_code: 'LOGIN_RESET_GUIDE',
    name: 'Hướng dẫn reset mật khẩu',
    category: SUPPORT_CATEGORY.TECHNICAL,
    tone: 'supportive',
    tags: ['account', 'login', 'password'],
    variables: ['support_contact'],
    body_template: 'Bạn vui lòng sử dụng chức năng Quên mật khẩu tại màn hình đăng nhập. Nếu vẫn không nhận được email, chúng tôi sẽ kiểm tra trạng thái tài khoản và hỗ trợ reset thủ công.',
  },
  {
    template_code: 'SLA_APOLOGY',
    name: 'Xin lỗi vì phản hồi chậm',
    category: SUPPORT_CATEGORY.COMPLAINT,
    tone: 'empathetic',
    tags: ['sla', 'complaint', 'apology'],
    variables: ['ticket_code'],
    body_template: 'Xin lỗi vì phản hồi chậm hơn dự kiến. Ticket {{ticket_code}} của bạn đã được ưu tiên xử lý và chuyển đến bộ phận phụ trách.',
  },
];

const DEFAULT_NOTIFICATION_TEMPLATES = [
  {
    template_code: 'SUPPORT_TICKET_CREATED',
    event_type: 'support_ticket.created',
    title_template: 'Ticket {{payload.ticket_code}} đã được tạo',
    body_template: '{{payload.subject}} đang chờ bộ phận hỗ trợ xử lý.',
    priority: NOTIFICATION_PRIORITY.NORMAL,
    channels: [NOTIFICATION_CHANNEL.IN_APP],
  },
  {
    template_code: 'SUPPORT_TICKET_ASSIGNED',
    event_type: 'support_ticket.assigned',
    title_template: 'Bạn được gán ticket {{payload.ticket_code}}',
    body_template: '{{payload.subject}}',
    priority: NOTIFICATION_PRIORITY.HIGH,
    channels: [NOTIFICATION_CHANNEL.IN_APP],
  },
  {
    template_code: 'SUPPORT_TICKET_SLA_BREACHED',
    event_type: 'support_ticket.sla_breached',
    title_template: 'Ticket quá SLA: {{payload.ticket_code}}',
    body_template: '{{payload.subject}} cần được xử lý ngay.',
    priority: NOTIFICATION_PRIORITY.URGENT,
    channels: [NOTIFICATION_CHANNEL.IN_APP],
  },
  {
    template_code: 'NOTIFICATION_DELIVERY_FAILED',
    event_type: 'notification.delivery_failed',
    title_template: 'Gửi thông báo thất bại',
    body_template: 'Kênh {{payload.channel}} lỗi: {{payload.last_error}}',
    priority: NOTIFICATION_PRIORITY.HIGH,
    channels: [NOTIFICATION_CHANNEL.IN_APP],
  },
];

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || null;
}

function withPermissions(actor = {}, permissions = []) {
  return {
    ...actor,
    permissions: [...new Set([...(actor.permissions || []), ...permissions])],
  };
}

function assertObjectId(value, fieldName = 'id') {
  if (!value) return undefined;
  if (!isValidObjectId(value)) throw createError(`${fieldName} không hợp lệ.`, 400);
  return toObjectId(value, fieldName);
}

function compactObject(source = {}) {
  return Object.entries(source).reduce((output, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') output[key] = value;
    return output;
  }, {});
}

function buildRegex(value) {
  return { $regex: escapeRegex(value), $options: 'i' };
}

function buildDateRange(query = {}, field = 'created_at') {
  const range = {};
  const from = parseDate(query.date_from || query.from, 'date_from');
  const to = parseDate(query.date_to || query.to, 'date_to');
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return Object.keys(range).length ? { [field]: range } : {};
}

function slaInfo(ticket = {}, now = new Date()) {
  const due = ticket.sla_due_at ? new Date(ticket.sla_due_at) : null;
  const breachedAt = ticket.metadata?.sla_breached_at ? new Date(ticket.metadata.sla_breached_at) : null;
  const closed = CLOSED_TICKET_STATUSES.includes(ticket.status);

  if (!due) return { sla_state: 'not_applicable', overdue_ms: 0, remaining_ms: null, sla_breached_at: breachedAt };
  if (closed) return { sla_state: 'resolved', overdue_ms: 0, remaining_ms: 0, sla_breached_at: breachedAt };

  const diff = due.getTime() - now.getTime();
  if (breachedAt || diff < 0) {
    return {
      sla_state: 'breached',
      overdue_ms: Math.abs(diff),
      remaining_ms: 0,
      sla_breached_at: breachedAt || due,
    };
  }
  if (diff <= 60 * 60 * 1000) {
    return { sla_state: 'warning', overdue_ms: 0, remaining_ms: diff, sla_breached_at: null };
  }
  return { sla_state: 'ok', overdue_ms: 0, remaining_ms: diff, sla_breached_at: null };
}

function decoratePatient(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    id: toId(value._id || value.id),
    patient_code: value.patient_code,
    full_name: value.full_name,
    phone: value.phone,
    email: value.email,
    status: value.status,
  };
}

function decorateUser(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    id: toId(value._id || value.id),
    full_name: value.full_name,
    username: value.username,
    employee_code: value.employee_code,
    email: value.email,
  };
}

function decorateDepartment(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    id: toId(value._id || value.id),
    department_code: value.department_code,
    department_name: value.department_name,
  };
}

function decorateTicket(ticket = {}) {
  const patient = decoratePatient(ticket.patient_id);
  const assignedUser = decorateUser(ticket.assigned_user_id);
  const department = decorateDepartment(ticket.assigned_department_id);
  return {
    ...ticket,
    id: toId(ticket._id || ticket.id),
    patient_id: patient?.id || toId(ticket.patient_id),
    patient,
    assigned_user_id: assignedUser?.id || toId(ticket.assigned_user_id),
    assigned_user: assignedUser,
    assigned_department_id: department?.id || toId(ticket.assigned_department_id),
    assigned_department: department,
    conversation_id: toId(ticket.conversation_id?._id || ticket.conversation_id),
    ...slaInfo(ticket),
  };
}

function ticketBaseFilter(query = {}) {
  const filter = {};
  for (const field of ['category', 'priority', 'status', 'assigned_department_id', 'assigned_user_id', 'patient_id']) {
    if (query[field]) filter[field] = field.endsWith('_id') ? assertObjectId(query[field], field) : query[field];
  }
  if (normalizeBoolean(query.unassigned)) {
    filter.$or = [
      { assigned_user_id: null },
      { assigned_user_id: { $exists: false } },
    ];
  }
  if (query.date_from || query.date_to || query.from || query.to) {
    Object.assign(filter, buildDateRange(query));
  }
  if (query.updated_from || query.updated_to) {
    const range = {};
    const from = parseDate(query.updated_from, 'updated_from');
    const to = parseDate(query.updated_to, 'updated_to');
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    filter.updated_at = range;
  }
  if (query.has_rating === 'true') filter.satisfaction_rating = { $ne: null };
  if (query.has_rating === 'false') {
    filter.$and = filter.$and || [];
    filter.$and.push({ $or: [{ satisfaction_rating: null }, { satisfaction_rating: { $exists: false } }] });
  }
  if (query.search) {
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { ticket_code: buildRegex(query.search) },
        { subject: buildRegex(query.search) },
        { description: buildRegex(query.search) },
        { 'metadata.intent_code': buildRegex(query.search) },
        { 'metadata.request_id': buildRegex(query.search) },
        { 'metadata.error_code': buildRegex(query.search) },
      ],
    });
  }
  return filter;
}

function applySlaFilter(filter, slaState, now = new Date()) {
  if (!slaState) return filter;
  if (slaState === 'breached') {
    return {
      ...filter,
      status: filter.status || { $in: ACTIVE_TICKET_STATUSES },
      $and: [
        ...(filter.$and || []),
        {
          $or: [
            { sla_due_at: { $lt: now } },
            { 'metadata.sla_breached_at': { $ne: null } },
          ],
        },
      ],
    };
  }
  if (slaState === 'warning') {
    return {
      ...filter,
      status: filter.status || { $in: ACTIVE_TICKET_STATUSES },
      sla_due_at: {
        $gte: now,
        $lte: new Date(now.getTime() + 60 * 60 * 1000),
      },
    };
  }
  if (slaState === 'ok') {
    return {
      ...filter,
      status: filter.status || { $in: ACTIVE_TICKET_STATUSES },
      sla_due_at: { $gt: new Date(now.getTime() + 60 * 60 * 1000) },
    };
  }
  if (slaState === 'resolved') return { ...filter, status: { $in: CLOSED_TICKET_STATUSES } };
  return filter;
}

async function populateTickets(queryBuilder) {
  return queryBuilder
    .populate('patient_id', 'patient_code full_name phone email status')
    .populate('assigned_user_id', 'full_name username employee_code email')
    .populate('assigned_department_id', 'department_name department_code')
    .lean();
}

async function listTickets(query = {}) {
  const { page, limit, skip } = getPagination(query, 25, 100);
  let filter = ticketBaseFilter(query);
  filter = applySlaFilter(filter, query.sla_state);
  const sort = query.sort === 'oldest_sla'
    ? { sla_due_at: 1, created_at: -1 }
    : { priority: -1, updated_at: -1, created_at: -1 };
  const [items, total] = await Promise.all([
    populateTickets(SupportTicket.find(filter).sort(sort).skip(skip).limit(limit)),
    SupportTicket.countDocuments(filter),
  ]);
  return {
    items: items.map(decorateTicket),
    pagination: buildPagination(page, limit, total),
  };
}

async function getTicket(ticketId) {
  const ticket = await populateTickets(SupportTicket.findById(ticketId));
  if (!ticket) throw createError('Không tìm thấy support ticket.', 404);
  const [conversation, messages, timeline, context] = await Promise.all([
    ticket.conversation_id ? Conversation.findById(ticket.conversation_id).lean() : null,
    ticket.conversation_id
      ? Message.find({ conversation_id: ticket.conversation_id, status: { $ne: MESSAGE_STATUS.DELETED } }).sort({ created_at: 1 }).limit(80).lean()
      : [],
    getTicketTimeline(ticketId),
    getTicketContext(ticketId),
  ]);
  return {
    ticket: decorateTicket(ticket),
    conversation,
    messages,
    timeline,
    context,
  };
}

async function getTicketTimeline(ticketId) {
  const ticket = await SupportTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy support ticket.', 404);
  const [auditLogs, messages] = await Promise.all([
    AuditLog.find({ target_type: 'support_ticket', target_id: ticket._id }).sort({ created_at: -1 }).limit(50).lean(),
    ticket.conversation_id
      ? Message.find({ conversation_id: ticket.conversation_id }).sort({ created_at: 1 }).select('message_type body sender_actor_type sender_actor_id is_internal_note created_at').lean()
      : [],
  ]);
  const systemEvents = [
    ['support.ticket_created', ticket.created_at, 'Ticket created'],
    ['support.sla_due', ticket.sla_due_at, 'SLA due'],
    ['support.sla_breached', ticket.metadata?.sla_breached_at, 'SLA breached'],
    ['support.resolved', ticket.resolved_at, 'Resolved'],
    ['support.closed', ticket.closed_at, 'Closed'],
  ].filter((item) => item[1]).map(([event_type, at, label]) => ({ event_type, at, label }));
  return {
    system_events: systemEvents,
    messages,
    audit_logs: auditLogs,
  };
}

async function getTicketContext(ticketId) {
  const ticket = await SupportTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy support ticket.', 404);
  const patientId = ticket.patient_id;
  const [patient, relatedTickets, account, relatives, authorizations, invoices, paymentIntents] = await Promise.all([
    patientId ? Patient.findById(patientId).lean() : null,
    patientId ? SupportTicket.find({ patient_id: patientId, _id: { $ne: ticket._id } }).sort({ created_at: -1 }).limit(8).lean() : [],
    patientId ? PatientAccount.findOne({ patient_id: patientId, is_deleted: false }).lean() : null,
    patientId ? PatientRelative.find({ patient_id: patientId, is_deleted: false }).limit(8).lean() : [],
    patientId ? PatientAuthorization.find({ patient_id: patientId, is_deleted: false }).sort({ created_at: -1 }).limit(8).lean() : [],
    patientId ? Invoice.find({ patient_id: patientId, is_deleted: false }).sort({ created_at: -1 }).limit(5).lean() : [],
    patientId ? PaymentIntent.find({ patient_id: patientId, is_deleted: false }).sort({ created_at: -1 }).limit(5).lean() : [],
  ]);
  return {
    patient: decoratePatient(patient),
    patient_account: account,
    relatives,
    authorizations,
    related_tickets: relatedTickets.map(decorateTicket),
    invoices,
    payment_intents: paymentIntents,
    risk_flags: buildTicketRiskFlags(ticket, account, invoices, paymentIntents),
  };
}

function buildTicketRiskFlags(ticket = {}, account = {}, invoices = [], paymentIntents = []) {
  const flags = [];
  const sla = slaInfo(ticket);
  if (sla.sla_state === 'breached') flags.push({ code: 'sla_breached', severity: 'critical', message: 'Ticket đã quá SLA.' });
  if ([SUPPORT_TICKET_PRIORITY.URGENT, SUPPORT_TICKET_PRIORITY.HIGH].includes(ticket.priority)) {
    flags.push({ code: 'high_priority', severity: ticket.priority === SUPPORT_TICKET_PRIORITY.URGENT ? 'critical' : 'warning', message: 'Priority cao.' });
  }
  if (ticket.category === SUPPORT_CATEGORY.BILLING && paymentIntents.some((item) => item.status && !['paid', 'confirmed', 'cancelled', 'expired'].includes(item.status))) {
    flags.push({ code: 'pending_payment', severity: 'warning', message: 'Có payment intent chưa hoàn tất.' });
  }
  if (account?.locked_until && new Date(account.locked_until) > new Date()) {
    flags.push({ code: 'locked_portal_account', severity: 'warning', message: 'Tài khoản portal đang bị khóa.' });
  }
  if (invoices.some((item) => Number(item.balance_due || 0) > 0)) {
    flags.push({ code: 'open_balance', severity: 'info', message: 'Bệnh nhân còn invoice chưa thanh toán.' });
  }
  return flags;
}

async function getOverview() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const activeFilter = { status: { $in: ACTIVE_TICKET_STATUSES } };
  const [
    todayTickets,
    openTickets,
    waitingStaff,
    waitingPatient,
    unassigned,
    overdue,
    urgentHigh,
    resolvedToday,
    conversationsOpen,
    unreadSystemMessages,
    queuedNotifications,
    failedNotifications,
    failedDeliveries,
    activeTemplates,
    activeReplyTemplates,
    broadcastDrafts,
  ] = await Promise.all([
    SupportTicket.countDocuments({ created_at: { $gte: today, $lt: tomorrow } }),
    SupportTicket.countDocuments(activeFilter),
    SupportTicket.countDocuments({ status: SUPPORT_TICKET_STATUS.WAITING_STAFF }),
    SupportTicket.countDocuments({ status: SUPPORT_TICKET_STATUS.WAITING_PATIENT }),
    SupportTicket.countDocuments({ ...activeFilter, $or: [{ assigned_user_id: null }, { assigned_user_id: { $exists: false } }] }),
    SupportTicket.countDocuments({ ...activeFilter, sla_due_at: { $lt: now } }),
    SupportTicket.countDocuments({ ...activeFilter, priority: { $in: [SUPPORT_TICKET_PRIORITY.URGENT, SUPPORT_TICKET_PRIORITY.HIGH] } }),
    SupportTicket.countDocuments({ resolved_at: { $gte: today, $lt: tomorrow } }),
    Conversation.countDocuments({ status: { $in: [CONVERSATION_STATUS.OPEN, CONVERSATION_STATUS.PENDING] } }),
    Message.countDocuments({ message_type: MESSAGE_TYPE.SYSTEM, status: { $ne: MESSAGE_STATUS.DELETED }, requires_acknowledgement: true }),
    Notification.countDocuments({ status: NOTIFICATION_STATUS.QUEUED }),
    Notification.countDocuments({ status: NOTIFICATION_STATUS.FAILED }),
    NotificationDelivery.countDocuments({ status: NOTIFICATION_DELIVERY_STATUS.FAILED }),
    NotificationTemplate.countDocuments({ active: true, is_deleted: false }),
    SupportReplyTemplate.countDocuments({ active: true, is_deleted: false }),
    BroadcastCampaign.countDocuments({ status: { $in: ['draft', 'pending_approval', 'scheduled'] }, is_deleted: false }),
  ]);

  const workQueue = [
    { type: 'support_tickets', label: 'Ticket đang mở', count: openTickets, sla_overdue: overdue, action: '/admin/support-communication/tickets' },
    { type: 'sla_breaches', label: 'Ticket quá SLA', count: overdue, sla_overdue: overdue, action: '/admin/support-communication/sla' },
    { type: 'unassigned', label: 'Ticket chưa gán', count: unassigned, sla_overdue: 0, action: '/admin/support-communication/tickets?unassigned=true' },
    { type: 'failed_notifications', label: 'Notification failed', count: failedNotifications + failedDeliveries, sla_overdue: 0, action: '/admin/support-communication/notifications' },
    { type: 'broadcast_drafts', label: 'Broadcast cần xử lý', count: broadcastDrafts, sla_overdue: 0, action: '/admin/support-communication/broadcast' },
  ];

  return {
    kpis: {
      today_tickets: todayTickets,
      open_tickets: openTickets,
      waiting_staff: waitingStaff,
      waiting_patient: waitingPatient,
      unassigned,
      overdue,
      urgent_high: urgentHigh,
      resolved_today: resolvedToday,
      open_conversations: conversationsOpen,
      system_messages_need_ack: unreadSystemMessages,
      queued_notifications: queuedNotifications,
      failed_notifications: failedNotifications,
      failed_deliveries: failedDeliveries,
      active_templates: activeTemplates,
      active_reply_templates: activeReplyTemplates,
    },
    work_queue: workQueue,
    health: {
      ticket_queue: overdue > 0 ? 'warning' : 'healthy',
      conversation: conversationsOpen > 200 ? 'warning' : 'healthy',
      notification: failedNotifications + failedDeliveries > 0 ? 'warning' : 'healthy',
      templates: activeTemplates > 0 ? 'healthy' : 'warning',
    },
    checked_at: now,
  };
}

async function getSlaOverview() {
  const now = new Date();
  const warningUntil = new Date(now.getTime() + 60 * 60 * 1000);
  const [breached, urgentBreached, highBreached, warning15, warning60, unassignedRisk, byCategory, byPriority, byDepartment] = await Promise.all([
    SupportTicket.countDocuments({ status: { $in: ACTIVE_TICKET_STATUSES }, sla_due_at: { $lt: now } }),
    SupportTicket.countDocuments({ status: { $in: ACTIVE_TICKET_STATUSES }, priority: SUPPORT_TICKET_PRIORITY.URGENT, sla_due_at: { $lt: now } }),
    SupportTicket.countDocuments({ status: { $in: ACTIVE_TICKET_STATUSES }, priority: SUPPORT_TICKET_PRIORITY.HIGH, sla_due_at: { $lt: now } }),
    SupportTicket.countDocuments({ status: { $in: ACTIVE_TICKET_STATUSES }, sla_due_at: { $gte: now, $lte: new Date(now.getTime() + 15 * 60 * 1000) } }),
    SupportTicket.countDocuments({ status: { $in: ACTIVE_TICKET_STATUSES }, sla_due_at: { $gte: now, $lte: warningUntil } }),
    SupportTicket.countDocuments({ status: { $in: ACTIVE_TICKET_STATUSES }, sla_due_at: { $gte: now, $lte: warningUntil }, $or: [{ assigned_user_id: null }, { assigned_user_id: { $exists: false } }] }),
    SupportTicket.aggregate([
      { $match: { status: { $in: ACTIVE_TICKET_STATUSES }, sla_due_at: { $lt: warningUntil } } },
      { $group: { _id: '$category', count: { $sum: 1 }, breached: { $sum: { $cond: [{ $lt: ['$sla_due_at', now] }, 1, 0] } } } },
      { $sort: { breached: -1, count: -1 } },
    ]),
    SupportTicket.aggregate([
      { $match: { status: { $in: ACTIVE_TICKET_STATUSES }, sla_due_at: { $lt: warningUntil } } },
      { $group: { _id: '$priority', count: { $sum: 1 }, breached: { $sum: { $cond: [{ $lt: ['$sla_due_at', now] }, 1, 0] } } } },
      { $sort: { breached: -1, count: -1 } },
    ]),
    SupportTicket.aggregate([
      { $match: { status: { $in: ACTIVE_TICKET_STATUSES }, sla_due_at: { $lt: warningUntil } } },
      { $group: { _id: '$assigned_department_id', count: { $sum: 1 }, breached: { $sum: { $cond: [{ $lt: ['$sla_due_at', now] }, 1, 0] } } } },
      { $sort: { breached: -1, count: -1 } },
      { $limit: 10 },
    ]),
  ]);
  return {
    kpis: {
      breached,
      urgent_breached: urgentBreached,
      high_breached: highBreached,
      warning_15m: warning15,
      warning_60m: warning60,
      unassigned_risk: unassignedRisk,
    },
    heatmap: {
      by_category: byCategory,
      by_priority: byPriority,
      by_department: byDepartment,
    },
    checked_at: now,
  };
}

async function listOverdueTickets(query = {}) {
  return listTickets({ ...query, sla_state: 'breached', sort: 'oldest_sla' });
}

async function listSlaRiskTickets(query = {}) {
  return listTickets({ ...query, sla_state: query.sla_state || 'warning', sort: 'oldest_sla' });
}

async function scanSla(payload = {}, actor = {}, requestMeta = {}) {
  const now = new Date();
  const limit = Math.min(Number(payload.limit || 200), 1000);
  const tickets = await SupportTicket.find({
    status: { $in: ACTIVE_TICKET_STATUSES },
    sla_due_at: { $lte: now },
    $or: [
      { 'metadata.sla_breached_at': null },
      { 'metadata.sla_breached_at': { $exists: false } },
    ],
  }).sort({ sla_due_at: 1 }).limit(limit);

  const ticketIds = [];
  for (const ticket of tickets) {
    ticket.metadata = {
      ...(ticket.metadata || {}),
      sla_breached_at: now,
      breach_reason: ticket.assigned_user_id ? 'overdue' : 'unassigned_overdue',
    };
    ticket.updated_by = actorUserId(actor);
    await ticket.save();
    ticketIds.push(String(ticket._id));
  }

  await recordAuditLog({
    actor,
    action: 'support.sla.scan',
    targetType: 'support_ticket',
    status: 'success',
    message: 'Quét SLA support ticket.',
    requestMeta,
    metadata: { breached_count: ticketIds.length },
  });
  return { breached_count: ticketIds.length, ticket_ids: ticketIds, checked_at: now };
}

async function bulkUpdateTickets(ticketIds = [], action, payload = {}, actor = {}, requestMeta = {}) {
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) throw createError('ticket_ids không được rỗng.', 400);
  const results = [];
  for (const rawId of ticketIds) {
    const ticketId = assertObjectId(rawId, 'ticket_id');
    try {
      let result;
      if (action === 'assign') result = await assignTicketAdmin(ticketId, payload, actor, requestMeta);
      if (action === 'priority') result = await supportTicketService.changePriority(ticketId, payload, actor, requestMeta);
      if (action === 'resolve') result = await supportTicketService.resolveTicket(ticketId, payload, actor, requestMeta);
      if (action === 'close') result = await supportTicketService.closeTicket(ticketId, payload, actor, requestMeta);
      if (!result) throw createError('Bulk action không hợp lệ.', 400);
      results.push({ ticket_id: toId(ticketId), status: 'success', result });
    } catch (error) {
      results.push({ ticket_id: toId(rawId), status: 'failed', error: error.message });
    }
  }
  return {
    success_count: results.filter((item) => item.status === 'success').length,
    failed_count: results.filter((item) => item.status === 'failed').length,
    results,
  };
}

async function assignTicketAdmin(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy support ticket.', 404);
  if ([SUPPORT_TICKET_STATUS.CLOSED, SUPPORT_TICKET_STATUS.CANCELLED].includes(ticket.status)) {
    throw createError('Ticket đã đóng/hủy, không thể assign.', 409);
  }
  const assignedUserId = payload.assigned_user_id || payload.assignedUserId;
  const assignedDepartmentId = payload.assigned_department_id || payload.assignedDepartmentId;
  ticket.assigned_user_id = assignedUserId ? assertObjectId(assignedUserId, 'assigned_user_id') : ticket.assigned_user_id;
  ticket.assigned_department_id = assignedDepartmentId ? assertObjectId(assignedDepartmentId, 'assigned_department_id') : ticket.assigned_department_id;
  ticket.status = SUPPORT_TICKET_STATUS.WAITING_STAFF;
  ticket.metadata = {
    ...(ticket.metadata || {}),
    first_assigned_at: ticket.metadata?.first_assigned_at || new Date(),
    reassignment_count: Number(ticket.metadata?.reassignment_count || 0) + 1,
    assignment_reason: payload.reason,
  };
  ticket.updated_by = actorUserId(actor);
  await ticket.save();
  if (ticket.conversation_id) {
    await Conversation.updateOne({ _id: ticket.conversation_id }, {
      $set: compactObject({
        assigned_user_id: ticket.assigned_user_id,
        assigned_department_id: ticket.assigned_department_id,
        status: CONVERSATION_STATUS.OPEN,
      }),
    });
  }
  await recordAuditLog({
    actor,
    action: 'support.ticket_admin_assign',
    targetType: 'support_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Admin assign support ticket.',
    requestMeta,
    metadata: {
      assigned_user_id: toId(ticket.assigned_user_id),
      assigned_department_id: toId(ticket.assigned_department_id),
      reason: payload.reason,
    },
  });
  return getTicket(ticket._id);
}

async function escalateTicket(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy support ticket.', 404);
  const escalationLevel = Number(ticket.metadata?.escalation_level || 0) + 1;
  ticket.priority = payload.priority || SUPPORT_TICKET_PRIORITY.URGENT;
  ticket.metadata = {
    ...(ticket.metadata || {}),
    escalation_level: escalationLevel,
    escalated_at: new Date(),
    escalation_reason: payload.reason || payload.escalation_reason,
  };
  ticket.updated_by = actorUserId(actor);
  await ticket.save();
  if (ticket.conversation_id) {
    await Conversation.updateOne({ _id: ticket.conversation_id }, {
      $set: {
        priority: payload.priority || CONVERSATION_PRIORITY.URGENT,
        'metadata.escalated_at': new Date(),
        'metadata.escalation_reason': payload.reason || payload.escalation_reason,
      },
    });
  }
  await recordAuditLog({
    actor,
    action: 'support.ticket_escalate',
    targetType: 'support_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Escalate support ticket.',
    requestMeta,
    metadata: { escalation_level: escalationLevel, reason: payload.reason || payload.escalation_reason },
  });
  return getTicket(ticket._id);
}

async function addInternalNote(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await SupportTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy support ticket.', 404);
  if (!ticket.conversation_id) throw createError('Ticket chưa có conversation.', 409);
  const context = actorContext.buildActorContext(actor);
  const now = new Date();
  const message = await Message.create({
    conversation_id: ticket.conversation_id,
    sender_actor_type: context.actor_type || ACTOR_TYPE.STAFF,
    sender_actor_id: context.actor_id,
    sender_role_code: context.roles?.[0],
    message_type: MESSAGE_TYPE.TEXT,
    body: normalizeString(payload.body || payload.note || payload.message),
    status: MESSAGE_STATUS.SENT,
    is_internal_note: true,
    is_clinical_advice: false,
    requires_acknowledgement: normalizeBoolean(payload.requires_acknowledgement),
  });
  await Conversation.updateOne({ _id: ticket.conversation_id }, { $set: { last_message_at: now } });
  await recordAuditLog({
    actor,
    action: 'support.ticket_internal_note',
    targetType: 'support_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Thêm internal note vào support ticket.',
    requestMeta,
    metadata: { message_id: toId(message._id) },
  });
  return message.toObject();
}

async function markFalseBreach(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy support ticket.', 404);
  ticket.metadata = {
    ...(ticket.metadata || {}),
    false_breach_reason: payload.reason,
    false_breach_marked_at: new Date(),
    false_breach_marked_by: actorUserId(actor),
  };
  ticket.updated_by = actorUserId(actor);
  await ticket.save();
  await recordAuditLog({
    actor,
    action: 'support.sla.false_breach',
    targetType: 'support_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Đánh dấu false SLA breach.',
    requestMeta,
    metadata: { reason: payload.reason },
  });
  return getTicket(ticket._id);
}

async function patchTicketMetadata(ticketId, patch = {}, action, actor = {}, requestMeta = {}) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy support ticket.', 404);
  ticket.metadata = { ...(ticket.metadata || {}), ...patch };
  ticket.updated_by = actorUserId(actor);
  await ticket.save();
  await recordAuditLog({
    actor,
    action,
    targetType: 'support_ticket',
    targetId: ticket._id,
    status: 'success',
    message: action,
    requestMeta,
    metadata: patch,
  });
  return getTicket(ticket._id);
}

async function getSpecializedTicketList(kind, query = {}) {
  if (kind === 'technical') {
    return listTickets({ ...query, category: SUPPORT_CATEGORY.TECHNICAL });
  }
  if (kind === 'account') {
    const filterQuery = {
      ...query,
      category: query.category || SUPPORT_CATEGORY.TECHNICAL,
      search: query.search,
    };
    const result = await listTickets(filterQuery);
    result.items = result.items.filter((ticket) => {
      const metadata = ticket.metadata || {};
      return ['account', 'permission', 'portal_account', 'oauth', 'login'].includes(metadata.module || metadata.issue_type)
        || /account|login|oauth|permission|password|portal/i.test(`${ticket.subject || ''} ${ticket.description || ''}`);
    });
    return result;
  }
  if (kind === 'billing') {
    return listTickets({ ...query, category: query.category || { $in: [SUPPORT_CATEGORY.BILLING, SUPPORT_CATEGORY.INSURANCE] } });
  }
  return listTickets(query);
}

async function getTechnicalOverview() {
  const base = { category: SUPPORT_CATEGORY.TECHNICAL, status: { $in: ACTIVE_TICKET_STATUSES } };
  const modules = ['auth', 'oauth', 'rbac', 'realtime', 'notification', 'payment', 'upload', 'patient_portal'];
  const counts = await Promise.all(modules.map((module) => SupportTicket.countDocuments({ ...base, 'metadata.module': module })));
  return {
    open: await SupportTicket.countDocuments(base),
    modules: modules.map((module, index) => ({ module, count: counts[index] })),
  };
}

async function getAccountContext(ticketId) {
  const context = await getTicketContext(ticketId);
  const account = context.patient_account;
  const [loginHistory, activeSessions] = await Promise.all([
    account ? AuditLog.find({ actor_type: ACTOR_TYPE.PATIENT, actor_id: account._id, action: /login/i }).sort({ created_at: -1 }).limit(20).lean() : [],
    account ? AuditLog.find({ actor_type: ACTOR_TYPE.PATIENT, actor_id: account._id, action: /session/i }).sort({ created_at: -1 }).limit(20).lean() : [],
  ]);
  return {
    ...context,
    login_history: loginHistory,
    active_sessions: activeSessions,
    recommended_actions: [
      account?.locked_until ? 'unlock_account' : null,
      account?.failed_login_attempts >= 3 ? 'reset_password' : null,
      'review_authorizations',
    ].filter(Boolean),
  };
}

async function getPaymentContext(ticketId) {
  const ticket = await SupportTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy support ticket.', 404);
  const metadata = ticket.metadata || {};
  const patientId = ticket.patient_id;
  const [invoice, paymentIntent, bankTransaction, patientInvoices, patientPaymentIntents] = await Promise.all([
    metadata.invoice_id && isValidObjectId(metadata.invoice_id) ? Invoice.findById(metadata.invoice_id).lean() : null,
    metadata.payment_intent_id && isValidObjectId(metadata.payment_intent_id) ? PaymentIntent.findById(metadata.payment_intent_id).lean() : null,
    metadata.bank_transaction_id && isValidObjectId(metadata.bank_transaction_id) ? BankStatementTransaction.findById(metadata.bank_transaction_id).lean() : null,
    patientId ? Invoice.find({ patient_id: patientId, is_deleted: false }).sort({ created_at: -1 }).limit(10).lean() : [],
    patientId ? PaymentIntent.find({ patient_id: patientId, is_deleted: false }).sort({ created_at: -1 }).limit(10).lean() : [],
  ]);
  return {
    ticket: decorateTicket(ticket),
    invoice,
    payment_intent: paymentIntent,
    bank_transaction: bankTransaction,
    patient_invoices: patientInvoices,
    patient_payment_intents: patientPaymentIntents,
  };
}

async function listConversations(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.patient_id) filter.patient_id = assertObjectId(query.patient_id, 'patient_id');
  if (query.assigned_user_id) filter.assigned_user_id = assertObjectId(query.assigned_user_id, 'assigned_user_id');
  if (query.assigned_department_id) filter.assigned_department_id = assertObjectId(query.assigned_department_id, 'assigned_department_id');
  if (query.search) {
    filter.$or = [
      { conversation_code: buildRegex(query.search) },
      { title: buildRegex(query.search) },
      { 'metadata.request_id': buildRegex(query.search) },
    ];
  }
  const [items, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ last_message_at: -1, updated_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name phone status')
      .populate('assigned_user_id', 'full_name username employee_code')
      .populate('assigned_department_id', 'department_name department_code')
      .lean(),
    Conversation.countDocuments(filter),
  ]);
  const ids = items.map((item) => item._id);
  const lastMessages = ids.length ? await Message.aggregate([
    { $match: { conversation_id: { $in: ids }, status: { $ne: MESSAGE_STATUS.DELETED } } },
    { $sort: { created_at: -1 } },
    { $group: { _id: '$conversation_id', last_message: { $first: '$$ROOT' }, unread_count: { $sum: { $cond: [{ $eq: ['$status', MESSAGE_STATUS.SENT] }, 1, 0] } } } },
  ]) : [];
  const messageMap = new Map(lastMessages.map((item) => [toId(item._id), item]));
  return {
    items: items.map((item) => ({
      ...item,
      id: toId(item._id),
      patient: decoratePatient(item.patient_id),
      assigned_user: decorateUser(item.assigned_user_id),
      assigned_department: decorateDepartment(item.assigned_department_id),
      last_message: messageMap.get(toId(item._id))?.last_message || null,
      unread_count: messageMap.get(toId(item._id))?.unread_count || 0,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getConversation(conversationId) {
  const [conversation, participants, messages] = await Promise.all([
    Conversation.findById(conversationId)
      .populate('patient_id', 'patient_code full_name phone status')
      .populate('assigned_user_id', 'full_name username employee_code')
      .populate('assigned_department_id', 'department_name department_code')
      .lean(),
    ConversationParticipant.find({ conversation_id: conversationId }).lean(),
    Message.find({ conversation_id: conversationId, status: { $ne: MESSAGE_STATUS.DELETED } }).sort({ created_at: 1 }).limit(120).lean(),
  ]);
  if (!conversation) throw createError('Không tìm thấy conversation.', 404);
  return { conversation, participants, messages };
}

async function listConversationMessages(conversationId, query = {}) {
  const { page, limit, skip } = getPagination(query, 80, 200);
  const filter = { conversation_id: assertObjectId(conversationId, 'conversation_id'), status: { $ne: MESSAGE_STATUS.DELETED } };
  if (query.message_type) filter.message_type = query.message_type;
  const [items, total] = await Promise.all([
    Message.find(filter).sort({ created_at: 1 }).skip(skip).limit(limit).lean(),
    Message.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function listSystemMessages(query = {}) {
  return listConversationMessagesByFilter({ ...query, message_type: MESSAGE_TYPE.SYSTEM });
}

async function listConversationMessagesByFilter(query = {}) {
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  if (query.message_type) filter.message_type = query.message_type;
  if (query.conversation_id) filter.conversation_id = assertObjectId(query.conversation_id, 'conversation_id');
  if (query.requires_acknowledgement !== undefined) filter.requires_acknowledgement = normalizeBoolean(query.requires_acknowledgement);
  if (query.search) filter.body = buildRegex(query.search);
  Object.assign(filter, buildDateRange(query));
  const [items, total] = await Promise.all([
    Message.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).populate('conversation_id', 'conversation_code type title status priority patient_id').lean(),
    Message.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function createSystemMessage(payload = {}, actor = {}, requestMeta = {}) {
  const conversationId = assertObjectId(payload.conversation_id || payload.conversationId, 'conversation_id');
  const conversation = await Conversation.findById(conversationId).lean();
  if (!conversation) throw createError('Không tìm thấy conversation.', 404);
  const context = actorContext.buildActorContext(actor);
  const message = await Message.create({
    conversation_id: conversationId,
    sender_actor_type: context.actor_type || ACTOR_TYPE.STAFF,
    sender_actor_id: context.actor_id,
    sender_role_code: context.roles?.[0],
    message_type: MESSAGE_TYPE.SYSTEM,
    body: normalizeString(payload.body || payload.message),
    status: MESSAGE_STATUS.SENT,
    is_internal_note: normalizeBoolean(payload.is_internal_note),
    is_clinical_advice: false,
    requires_acknowledgement: normalizeBoolean(payload.requires_acknowledgement),
  });
  await Conversation.updateOne({ _id: conversationId }, { $set: { last_message_at: new Date() } });
  await recordAuditLog({
    actor,
    action: 'message.system.create',
    targetType: 'message',
    targetId: message._id,
    status: 'success',
    message: 'Tạo system message.',
    requestMeta,
    metadata: { conversation_id: toId(conversationId) },
  });
  return message.toObject();
}

async function acknowledgeSystemMessage(messageId, payload = {}, actor = {}, requestMeta = {}) {
  const message = await Message.findById(messageId);
  if (!message) throw createError('Không tìm thấy message.', 404);
  message.requires_acknowledgement = false;
  message.metadata = {
    ...(message.metadata || {}),
    acknowledged_at: new Date(),
    acknowledged_by_actor_type: actorContext.getActorType(actor),
    acknowledged_by_actor_id: actorContext.getActorId(actor),
    acknowledgement_note: payload.note,
  };
  await message.save();
  await recordAuditLog({
    actor,
    action: 'message.system.ack',
    targetType: 'message',
    targetId: message._id,
    status: 'success',
    message: 'Acknowledge system message.',
    requestMeta,
  });
  return message.toObject();
}

async function getNotificationsOverview() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [
    createdToday,
    queued,
    unread,
    sent,
    delivered,
    read,
    failed,
    cancelled,
    deliveryStats,
  ] = await Promise.all([
    Notification.countDocuments({ created_at: { $gte: today } }),
    Notification.countDocuments({ status: NOTIFICATION_STATUS.QUEUED }),
    Notification.countDocuments({ status: NOTIFICATION_STATUS.UNREAD }),
    Notification.countDocuments({ status: NOTIFICATION_STATUS.SENT }),
    Notification.countDocuments({ status: NOTIFICATION_STATUS.DELIVERED }),
    Notification.countDocuments({ status: NOTIFICATION_STATUS.READ }),
    Notification.countDocuments({ status: NOTIFICATION_STATUS.FAILED }),
    Notification.countDocuments({ status: NOTIFICATION_STATUS.CANCELLED }),
    NotificationDelivery.aggregate([
      { $group: { _id: { channel: '$channel', status: '$status' }, count: { $sum: 1 } } },
    ]),
  ]);
  return {
    kpis: { created_today: createdToday, queued, unread, sent, delivered, read, failed, cancelled },
    channel_health: deliveryStats,
  };
}

async function listNotifications(query = {}, actor = {}) {
  return notificationService.listNotifications(query, withPermissions(actor, ['notifications.read', 'notifications.manage']));
}

async function getNotification(notificationId, actor = {}) {
  const [notification, deliveries] = await Promise.all([
    notificationService.getNotificationDetail(notificationId, withPermissions(actor, ['notifications.read', 'notifications.manage'])),
    NotificationDelivery.find({ notification_id: notificationId }).sort({ created_at: 1 }).lean(),
  ]);
  return { notification, deliveries };
}

async function listNotificationDeliveries(query = {}) {
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  for (const field of ['status', 'channel', 'provider', 'notification_id']) {
    if (query[field]) filter[field] = field.endsWith('_id') ? assertObjectId(query[field], field) : query[field];
  }
  if (query.search) filter.last_error = buildRegex(query.search);
  const [items, total] = await Promise.all([
    NotificationDelivery.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).populate('notification_id', 'title message recipient_type recipient_id status priority').lean(),
    NotificationDelivery.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function retryNotificationDelivery(deliveryId, payload = {}, actor = {}, requestMeta = {}) {
  const delivery = await NotificationDelivery.findById(deliveryId);
  if (!delivery) throw createError('Không tìm thấy notification delivery.', 404);
  delivery.status = NOTIFICATION_DELIVERY_STATUS.PENDING;
  delivery.next_attempt_at = payload.next_attempt_at ? parseDate(payload.next_attempt_at, 'next_attempt_at') : new Date();
  delivery.last_error = undefined;
  delivery.payload = {
    ...(delivery.payload || {}),
    retry_reason: payload.reason,
    retry_requested_by: actorUserId(actor),
    retry_requested_at: new Date(),
  };
  await delivery.save();
  await recordAuditLog({
    actor,
    action: 'notification.delivery.retry',
    targetType: 'notification_delivery',
    targetId: delivery._id,
    status: 'success',
    message: 'Retry notification delivery.',
    requestMeta,
    metadata: { reason: payload.reason },
  });
  if (normalizeBoolean(payload.dispatch_now)) {
    return notificationDeliveryWorker.dispatchDelivery(delivery._id);
  }
  return delivery.toObject();
}

async function cancelNotificationDelivery(deliveryId, payload = {}, actor = {}, requestMeta = {}) {
  const delivery = await NotificationDelivery.findById(deliveryId);
  if (!delivery) throw createError('Không tìm thấy notification delivery.', 404);
  delivery.status = NOTIFICATION_DELIVERY_STATUS.SKIPPED;
  delivery.last_error = payload.reason || 'cancelled_by_admin';
  await delivery.save();
  await recordAuditLog({
    actor,
    action: 'notification.delivery.cancel',
    targetType: 'notification_delivery',
    targetId: delivery._id,
    status: 'success',
    message: 'Cancel notification delivery.',
    requestMeta,
    metadata: { reason: payload.reason },
  });
  return delivery.toObject();
}

async function renderText(template = '', context = {}) {
  return templateRenderer.renderTemplate(template, { payload: context, data: context, ...context });
}

async function resolveBroadcastAudience(payload = {}) {
  const audience = payload.audience_query || payload.audience || {};
  if (Array.isArray(payload.recipients) && payload.recipients.length > 0) {
    return dedupeRecipients(payload.recipients);
  }
  if (Array.isArray(audience.recipients) && audience.recipients.length > 0) {
    return dedupeRecipients(audience.recipients);
  }

  const audienceType = payload.audience_type || audience.type || 'staff';
  if (audienceType === 'staff') {
    const filter = { is_deleted: false };
    if (audience.department_id) filter.department_id = assertObjectId(audience.department_id, 'department_id');
    let userIds = null;
    if (audience.role_code) {
      const role = await Role.findOne({ role_code: String(audience.role_code).toLowerCase(), is_deleted: false }).lean();
      if (role) {
        const assignments = await UserRole.find({ role_id: role._id, is_active: true }).select('user_id').lean();
        userIds = assignments.map((item) => item.user_id);
        filter._id = { $in: userIds };
      }
    }
    const users = await User.find(filter).sort({ full_name: 1 }).limit(Number(audience.limit || 500)).lean();
    return users.map((user) => ({
      recipient_type: 'staff',
      recipient_id: toId(user._id),
      recipient_user_id: toId(user._id),
      label: user.full_name || user.username,
    }));
  }

  if (audienceType === 'patient') {
    const filter = { is_deleted: false };
    if (audience.patient_id) filter.patient_id = assertObjectId(audience.patient_id, 'patient_id');
    const accounts = await PatientAccount.find(filter).sort({ created_at: -1 }).limit(Number(audience.limit || 500)).lean();
    return accounts.map((account) => ({
      recipient_type: 'patient',
      recipient_id: toId(account._id),
      patient_account_id: toId(account._id),
      patient_id: toId(account.patient_id),
      label: account.email || account.phone || account.username,
    }));
  }

  if (audienceType === 'relative') {
    const filter = { is_deleted: false };
    if (audience.patient_id) filter.patient_id = assertObjectId(audience.patient_id, 'patient_id');
    const relatives = await PatientRelative.find(filter).sort({ created_at: -1 }).limit(Number(audience.limit || 500)).lean();
    return relatives.map((relative) => ({
      recipient_type: 'relative',
      recipient_id: toId(relative._id),
      relative_id: toId(relative._id),
      patient_id: toId(relative.patient_id),
      label: relative.full_name,
    }));
  }

  return [];
}

function dedupeRecipients(recipients = []) {
  const map = new Map();
  recipients.forEach((recipient) => {
    const type = recipient.recipient_type || recipient.type;
    const id = recipient.recipient_id || recipient.recipient_user_id || recipient.patient_account_id || recipient.relative_id || recipient.id;
    if (!type || !id) return;
    map.set(`${type}:${id}`, { ...recipient, recipient_type: type, recipient_id: id });
  });
  return [...map.values()];
}

async function previewBroadcast(payload = {}) {
  const recipients = await resolveBroadcastAudience(payload);
  return {
    audience_type: payload.audience_type || payload.audience?.type || 'custom',
    recipient_count: recipients.length,
    sample_recipients: recipients.slice(0, 10),
    duplicate_count: Math.max(0, (payload.recipients || payload.audience?.recipients || []).length - recipients.length),
    safety: {
      has_title: Boolean(normalizeString(payload.title_template || payload.title)),
      has_body: Boolean(normalizeString(payload.body_template || payload.body || payload.message)),
      channels: payload.channels || [NOTIFICATION_CHANNEL.IN_APP],
      sensitive_payload_warning: JSON.stringify(payload.payload || {}).match(/password|token|secret/i) ? true : false,
    },
  };
}

async function createBroadcastCampaign(payload = {}, actor = {}, requestMeta = {}) {
  const recipients = await resolveBroadcastAudience(payload);
  const campaign = await BroadcastCampaign.create({
    campaign_code: await generateCampaignCode(),
    name: normalizeString(payload.name) || `Broadcast ${new Date().toISOString()}`,
    audience_type: payload.audience_type || payload.audience?.type || 'custom',
    audience_query: payload.audience_query || payload.audience || {},
    resolved_recipients: recipients,
    resolved_recipient_count: recipients.length,
    channels: payload.channels || [NOTIFICATION_CHANNEL.IN_APP],
    title_template: normalizeString(payload.title_template || payload.title),
    body_template: normalizeString(payload.body_template || payload.body || payload.message),
    priority: payload.priority || NOTIFICATION_PRIORITY.NORMAL,
    action_url: payload.action_url,
    payload: payload.payload || {},
    dedupe_key: payload.dedupe_key,
    status: payload.status || (payload.scheduled_at ? 'scheduled' : 'draft'),
    scheduled_at: payload.scheduled_at ? parseDate(payload.scheduled_at, 'scheduled_at') : undefined,
    approval_status: payload.approval_required ? 'pending' : 'not_required',
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({
    actor,
    action: 'notification.broadcast.create',
    targetType: 'broadcast_campaign',
    targetId: campaign._id,
    status: 'success',
    message: 'Tạo broadcast campaign.',
    requestMeta,
    metadata: { recipient_count: recipients.length },
  });
  return campaign.toObject();
}

async function generateCampaignCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `BC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
    if (!await BroadcastCampaign.exists({ campaign_code: code })) return code;
  }
  throw createError('Không thể sinh mã broadcast campaign.', 409);
}

async function listBroadcastCampaigns(query = {}) {
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = { is_deleted: false };
  if (query.status) filter.status = query.status;
  if (query.audience_type) filter.audience_type = query.audience_type;
  if (query.search) filter.$or = [{ campaign_code: buildRegex(query.search) }, { name: buildRegex(query.search) }];
  const [items, total] = await Promise.all([
    BroadcastCampaign.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    BroadcastCampaign.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getBroadcastCampaign(campaignId) {
  const campaign = await BroadcastCampaign.findById(campaignId).lean();
  if (!campaign || campaign.is_deleted) throw createError('Không tìm thấy broadcast campaign.', 404);
  return campaign;
}

async function approveBroadcastCampaign(campaignId, payload = {}, actor = {}, requestMeta = {}) {
  const campaign = await BroadcastCampaign.findById(campaignId);
  if (!campaign || campaign.is_deleted) throw createError('Không tìm thấy broadcast campaign.', 404);
  campaign.status = 'approved';
  campaign.approval_status = 'approved';
  campaign.approved_by = actorUserId(actor);
  campaign.approved_at = new Date();
  campaign.metadata = { ...(campaign.metadata || {}), approval_note: payload.note };
  campaign.updated_by = actorUserId(actor);
  await campaign.save();
  await recordAuditLog({ actor, action: 'notification.broadcast.approve', targetType: 'broadcast_campaign', targetId: campaign._id, status: 'success', message: 'Approve broadcast campaign.', requestMeta });
  return campaign.toObject();
}

async function sendBroadcastCampaign(campaignId, actor = {}, requestMeta = {}) {
  const campaign = await BroadcastCampaign.findById(campaignId);
  if (!campaign || campaign.is_deleted) throw createError('Không tìm thấy broadcast campaign.', 404);
  if (campaign.status === 'cancelled') throw createError('Campaign đã bị hủy.', 409);
  const recipients = dedupeRecipients(campaign.resolved_recipients || []);
  if (recipients.length === 0) throw createError('Campaign không có recipient.', 409);
  campaign.status = 'sending';
  campaign.started_at = new Date();
  await campaign.save();

  let createdCount = 0;
  let failedCount = 0;
  const channelResults = [];
  for (const channel of campaign.channels?.length ? campaign.channels : [NOTIFICATION_CHANNEL.IN_APP]) {
    try {
      const result = await notificationService.createBulkNotifications(recipients, {
        channel,
        title: campaign.title_template,
        message: campaign.body_template,
        body: campaign.body_template,
        priority: campaign.priority,
        action_url: campaign.action_url,
        payload: {
          ...(campaign.payload || {}),
          broadcast_campaign_id: toId(campaign._id),
          broadcast_campaign_code: campaign.campaign_code,
        },
        dedupe_key: campaign.dedupe_key || `broadcast:${campaign.campaign_code}:${channel}`,
        created_by_module: 'support_communication.broadcast',
        send_immediately: true,
      }, withPermissions(actor, ['notifications.create', 'notifications.create_system', 'notifications.broadcast', 'notifications.manage']), requestMeta);
      createdCount += Number(result.created_count || 0);
      channelResults.push({ channel, ...result });
    } catch (error) {
      failedCount += recipients.length;
      channelResults.push({ channel, status: 'failed', error: error.message });
    }
  }

  campaign.status = failedCount > 0 && createdCount === 0 ? 'failed' : 'sent';
  campaign.completed_at = new Date();
  campaign.result_summary = { created_count: createdCount, failed_count: failedCount, channel_results: channelResults };
  campaign.updated_by = actorUserId(actor);
  await campaign.save();
  await recordAuditLog({
    actor,
    action: 'notification.broadcast.send',
    targetType: 'broadcast_campaign',
    targetId: campaign._id,
    status: failedCount > 0 && createdCount === 0 ? 'failed' : 'success',
    message: 'Send broadcast campaign.',
    requestMeta,
    metadata: campaign.result_summary,
  });
  return campaign.toObject();
}

async function cancelBroadcastCampaign(campaignId, payload = {}, actor = {}, requestMeta = {}) {
  const campaign = await BroadcastCampaign.findById(campaignId);
  if (!campaign || campaign.is_deleted) throw createError('Không tìm thấy broadcast campaign.', 404);
  campaign.status = 'cancelled';
  campaign.metadata = { ...(campaign.metadata || {}), cancel_reason: payload.reason };
  campaign.updated_by = actorUserId(actor);
  await campaign.save();
  await recordAuditLog({ actor, action: 'notification.broadcast.cancel', targetType: 'broadcast_campaign', targetId: campaign._id, status: 'success', message: 'Cancel broadcast campaign.', requestMeta, metadata: { reason: payload.reason } });
  return campaign.toObject();
}

async function cloneBroadcastCampaign(campaignId, actor = {}, requestMeta = {}) {
  const existing = await getBroadcastCampaign(campaignId);
  return createBroadcastCampaign({
    name: `${existing.name} (copy)`,
    audience_type: existing.audience_type,
    audience_query: existing.audience_query,
    recipients: existing.resolved_recipients,
    channels: existing.channels,
    title_template: existing.title_template,
    body_template: existing.body_template,
    priority: existing.priority,
    action_url: existing.action_url,
    payload: existing.payload,
    status: 'draft',
  }, actor, requestMeta);
}

async function testBroadcastCampaign(campaignId, payload = {}, actor = {}, requestMeta = {}) {
  const campaign = await getBroadcastCampaign(campaignId);
  const context = actorContext.buildActorContext(actor);
  if (!context.user_id && !payload.recipient_user_id) throw createError('Không xác định được recipient test.', 400);
  return notificationService.createNotification({
    recipient_type: 'staff',
    recipient_id: payload.recipient_user_id || context.user_id,
    recipient_user_id: payload.recipient_user_id || context.user_id,
    channel: payload.channel || NOTIFICATION_CHANNEL.IN_APP,
    title: campaign.title_template,
    message: campaign.body_template,
    priority: campaign.priority,
    payload: { ...(campaign.payload || {}), test: true, broadcast_campaign_id: toId(campaign._id) },
    created_by_module: 'support_communication.broadcast_test',
    send_immediately: true,
  }, withPermissions(actor, ['notifications.create', 'notifications.create_system', 'notifications.manage']), requestMeta);
}

async function listNotificationTemplates(query = {}) {
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = { is_deleted: false };
  if (query.event_type) filter.event_type = query.event_type;
  if (query.language) filter.language = query.language;
  if (query.active !== undefined) filter.active = normalizeBoolean(query.active);
  if (query.search) filter.$or = [{ template_code: buildRegex(query.search) }, { event_type: buildRegex(query.search) }, { title_template: buildRegex(query.search) }];
  const [items, total] = await Promise.all([
    NotificationTemplate.find(filter).sort({ event_type: 1, language: 1 }).skip(skip).limit(limit).lean(),
    NotificationTemplate.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function createNotificationTemplate(payload = {}, actor = {}, requestMeta = {}) {
  const template = await NotificationTemplate.create({
    template_code: normalizeString(payload.template_code || payload.code),
    event_type: normalizeString(payload.event_type),
    language: normalizeString(payload.language) || 'vi',
    title_template: normalizeString(payload.title_template || payload.title),
    body_template: normalizeString(payload.body_template || payload.body),
    priority: payload.priority || NOTIFICATION_PRIORITY.NORMAL,
    channels: payload.channels || [NOTIFICATION_CHANNEL.IN_APP],
    active: payload.active !== undefined ? normalizeBoolean(payload.active) : true,
    metadata: payload.metadata,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'notification_template.create', targetType: 'notification_template', targetId: template._id, status: 'success', message: 'Tạo notification template.', requestMeta });
  return template.toObject();
}

async function getNotificationTemplate(templateId) {
  const template = await NotificationTemplate.findById(templateId).lean();
  if (!template || template.is_deleted) throw createError('Không tìm thấy notification template.', 404);
  return template;
}

async function updateNotificationTemplate(templateId, payload = {}, actor = {}, requestMeta = {}) {
  const template = await NotificationTemplate.findById(templateId);
  if (!template || template.is_deleted) throw createError('Không tìm thấy notification template.', 404);
  for (const field of ['template_code', 'event_type', 'language', 'title_template', 'body_template', 'priority', 'channels', 'metadata']) {
    if (payload[field] !== undefined) template[field] = payload[field];
  }
  if (payload.active !== undefined) template.active = normalizeBoolean(payload.active);
  template.updated_by = actorUserId(actor);
  await template.save();
  await recordAuditLog({ actor, action: 'notification_template.update', targetType: 'notification_template', targetId: template._id, status: 'success', message: 'Cập nhật notification template.', requestMeta });
  return template.toObject();
}

async function deleteNotificationTemplate(templateId, actor = {}, requestMeta = {}) {
  const template = await NotificationTemplate.findById(templateId);
  if (!template || template.is_deleted) throw createError('Không tìm thấy notification template.', 404);
  template.is_deleted = true;
  template.deleted_at = new Date();
  template.deleted_by = actorUserId(actor);
  template.active = false;
  await template.save();
  await recordAuditLog({ actor, action: 'notification_template.delete', targetType: 'notification_template', targetId: template._id, status: 'success', message: 'Xóa notification template.', requestMeta });
  return { deleted: true };
}

async function previewNotificationTemplate(templateId, payload = {}) {
  const template = await getNotificationTemplate(templateId);
  const context = payload.sample_payload || payload.payload || {};
  return {
    template,
    rendered: {
      title: await renderText(template.title_template, context),
      body: await renderText(template.body_template, context),
      priority: template.priority,
      channels: template.channels,
    },
  };
}

async function seedNotificationTemplates(actor = {}, requestMeta = {}) {
  const results = [];
  for (const item of DEFAULT_NOTIFICATION_TEMPLATES) {
    const template = await NotificationTemplate.findOneAndUpdate(
      { template_code: item.template_code },
      { $setOnInsert: { ...item, language: 'vi', created_by: actorUserId(actor) }, $set: { updated_by: actorUserId(actor), is_deleted: false } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    results.push(template);
  }
  await recordAuditLog({ actor, action: 'notification_template.seed_defaults', targetType: 'notification_template', status: 'success', message: 'Seed notification templates.', requestMeta, metadata: { count: results.length } });
  return { seeded_count: results.length, items: results };
}

async function validateNotificationTemplates() {
  const templates = await NotificationTemplate.find({ is_deleted: false }).lean();
  const findings = templates.map((template) => ({
    template_id: toId(template._id),
    template_code: template.template_code,
    event_type: template.event_type,
    status: template.title_template && template.body_template ? 'valid' : 'invalid',
    missing: [
      template.title_template ? null : 'title_template',
      template.body_template ? null : 'body_template',
      template.event_type ? null : 'event_type',
    ].filter(Boolean),
  }));
  return {
    total: findings.length,
    invalid_count: findings.filter((item) => item.status === 'invalid').length,
    findings,
  };
}

async function listReplyTemplates(query = {}) {
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = { is_deleted: false };
  if (query.category) filter.category = query.category;
  if (query.language) filter.language = query.language;
  if (query.active !== undefined) filter.active = normalizeBoolean(query.active);
  if (query.status) filter.status = query.status;
  if (query.search) filter.$or = [{ template_code: buildRegex(query.search) }, { name: buildRegex(query.search) }, { body_template: buildRegex(query.search) }];
  const [items, total] = await Promise.all([
    SupportReplyTemplate.find(filter).sort({ category: 1, usage_count: -1, updated_at: -1 }).skip(skip).limit(limit).lean(),
    SupportReplyTemplate.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function createReplyTemplate(payload = {}, actor = {}, requestMeta = {}) {
  const category = payload.category || SUPPORT_CATEGORY.OTHER;
  if (!SUPPORT_CATEGORIES.includes(category)) throw createError('category mẫu phản hồi không hợp lệ.', 422);
  const template = await SupportReplyTemplate.create({
    template_code: normalizeString(payload.template_code || payload.code),
    name: normalizeString(payload.name),
    category,
    language: normalizeString(payload.language) || 'vi',
    tone: normalizeString(payload.tone) || 'professional',
    subject_template: payload.subject_template,
    body_template: normalizeString(payload.body_template || payload.body),
    variables: payload.variables || [],
    tags: payload.tags || [],
    status: payload.status || 'active',
    active: payload.active !== undefined ? normalizeBoolean(payload.active) : true,
    approval_required: normalizeBoolean(payload.approval_required),
    metadata: payload.metadata,
    created_by: actorUserId(actor),
    updated_by: actorUserId(actor),
  });
  await recordAuditLog({ actor, action: 'support.reply_template.create', targetType: 'support_reply_template', targetId: template._id, status: 'success', message: 'Tạo support reply template.', requestMeta });
  return template.toObject();
}

async function getReplyTemplate(templateId) {
  const template = await SupportReplyTemplate.findById(templateId).lean();
  if (!template || template.is_deleted) throw createError('Không tìm thấy support reply template.', 404);
  return template;
}

async function updateReplyTemplate(templateId, payload = {}, actor = {}, requestMeta = {}) {
  const template = await SupportReplyTemplate.findById(templateId);
  if (!template || template.is_deleted) throw createError('Không tìm thấy support reply template.', 404);
  for (const field of ['template_code', 'name', 'category', 'language', 'tone', 'subject_template', 'body_template', 'variables', 'tags', 'status', 'metadata']) {
    if (payload[field] !== undefined) template[field] = payload[field];
  }
  if (payload.active !== undefined) template.active = normalizeBoolean(payload.active);
  if (payload.approval_required !== undefined) template.approval_required = normalizeBoolean(payload.approval_required);
  template.updated_by = actorUserId(actor);
  await template.save();
  await recordAuditLog({ actor, action: 'support.reply_template.update', targetType: 'support_reply_template', targetId: template._id, status: 'success', message: 'Cập nhật support reply template.', requestMeta });
  return template.toObject();
}

async function deleteReplyTemplate(templateId, actor = {}, requestMeta = {}) {
  const template = await SupportReplyTemplate.findById(templateId);
  if (!template || template.is_deleted) throw createError('Không tìm thấy support reply template.', 404);
  template.is_deleted = true;
  template.deleted_at = new Date();
  template.deleted_by = actorUserId(actor);
  template.active = false;
  await template.save();
  await recordAuditLog({ actor, action: 'support.reply_template.delete', targetType: 'support_reply_template', targetId: template._id, status: 'success', message: 'Xóa support reply template.', requestMeta });
  return { deleted: true };
}

async function previewReplyTemplate(templateId, payload = {}) {
  const template = await getReplyTemplate(templateId);
  const context = payload.sample_ticket || payload.ticket || payload.payload || {};
  return {
    template,
    rendered: {
      subject: template.subject_template ? await renderText(template.subject_template, context) : undefined,
      body: await renderText(template.body_template, context),
    },
  };
}

async function useReplyTemplate(templateId, payload = {}, actor = {}, requestMeta = {}) {
  const template = await SupportReplyTemplate.findById(templateId);
  if (!template || template.is_deleted) throw createError('Không tìm thấy support reply template.', 404);
  template.usage_count = Number(template.usage_count || 0) + 1;
  template.last_used_at = new Date();
  await template.save();
  const preview = await previewReplyTemplate(templateId, payload);
  await recordAuditLog({ actor, action: 'support.reply_template.use', targetType: 'support_reply_template', targetId: template._id, status: 'success', message: 'Dùng support reply template.', requestMeta, metadata: { ticket_id: payload.ticket_id } });
  return preview;
}

async function seedReplyTemplates(actor = {}, requestMeta = {}) {
  const results = [];
  for (const item of DEFAULT_REPLY_TEMPLATES) {
    const template = await SupportReplyTemplate.findOneAndUpdate(
      { template_code: item.template_code },
      { $setOnInsert: { ...item, created_by: actorUserId(actor) }, $set: { active: true, is_deleted: false, updated_by: actorUserId(actor) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    results.push(template);
  }
  await recordAuditLog({ actor, action: 'support.reply_template.seed_defaults', targetType: 'support_reply_template', status: 'success', message: 'Seed support reply templates.', requestMeta, metadata: { count: results.length } });
  return { seeded_count: results.length, items: results };
}

async function getLogs(query = {}) {
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  if (query.action) filter.action = query.action;
  if (query.target_type) filter.target_type = query.target_type;
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [{ action: buildRegex(query.search) }, { message: buildRegex(query.search) }, { request_id: buildRegex(query.search) }];
  }
  filter.$and = filter.$and || [];
  filter.$and.push({
    $or: [
      { action: /^support\./ },
      { action: /^message\./ },
      { action: /^notification\./ },
      { target_type: { $in: ['support_ticket', 'conversation', 'message', 'notification', 'notification_delivery', 'broadcast_campaign', 'notification_template', 'support_reply_template'] } },
    ],
  });
  Object.assign(filter, buildDateRange(query));
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

module.exports = {
  getOverview,
  listTickets,
  getTicket,
  getTicketTimeline,
  getTicketContext,
  getAccountContext,
  getPaymentContext,
  getTechnicalOverview,
  getSpecializedTicketList,
  getSlaOverview,
  listOverdueTickets,
  listSlaRiskTickets,
  scanSla,
  assignTicketAdmin,
  bulkUpdateTickets,
  escalateTicket,
  addInternalNote,
  markFalseBreach,
  patchTicketMetadata,
  listConversations,
  getConversation,
  listConversationMessages,
  listSystemMessages,
  createSystemMessage,
  acknowledgeSystemMessage,
  getNotificationsOverview,
  listNotifications,
  getNotification,
  listNotificationDeliveries,
  retryNotificationDelivery,
  cancelNotificationDelivery,
  previewBroadcast,
  createBroadcastCampaign,
  listBroadcastCampaigns,
  getBroadcastCampaign,
  testBroadcastCampaign,
  approveBroadcastCampaign,
  sendBroadcastCampaign,
  cancelBroadcastCampaign,
  cloneBroadcastCampaign,
  listNotificationTemplates,
  createNotificationTemplate,
  getNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  previewNotificationTemplate,
  seedNotificationTemplates,
  validateNotificationTemplates,
  listReplyTemplates,
  createReplyTemplate,
  getReplyTemplate,
  updateReplyTemplate,
  deleteReplyTemplate,
  previewReplyTemplate,
  useReplyTemplate,
  seedReplyTemplates,
  getLogs,
};
