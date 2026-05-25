const {
  Appointment,
  Invoice,
  MissingDocumentTask,
  Patient,
  PatientProfileChangeRequest,
  PaymentIntent,
  SupportTicket,
} = require('../models');
const {
  APPOINTMENT_STATUS,
  INVOICE_STATUS,
  PATIENT_PROFILE_CHANGE_STATUS,
} = require('../constants/statuses');
const {
  buildPagination,
  createError,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  recordAuditLog,
} = require('./core.service');
const {
  patientMapFor,
  sanitizePatient,
  scopedDepartmentFilter,
} = require('./reception-dashboard.service');

const OPEN_INVOICE_STATUSES = [
  INVOICE_STATUS.DRAFT,
  INVOICE_STATUS.ISSUED,
  INVOICE_STATUS.PARTIALLY_PAID,
];

const PAYMENT_REVIEW_STATUSES = ['created', 'pending', 'pending_manual_confirmation', 'requires_review', 'manual_review'];
const OPEN_SUPPORT_STATUSES = ['open', 'pending', 'in_progress', 'waiting_patient'];

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || null;
}

function priorityRank(priority = 'normal') {
  const order = {
    critical: 5,
    urgent: 4,
    high: 3,
    normal: 2,
    medium: 2,
    low: 1,
  };
  return order[priority] || 2;
}

function dueState(dueAt) {
  if (!dueAt) return 'none';
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return 'none';
  const hours = (due - Date.now()) / 3600000;
  if (hours < 0) return 'overdue';
  if (hours <= 4) return 'due_soon';
  return 'open';
}

function buildItem({
  id,
  type,
  priority = 'normal',
  patient,
  title,
  description,
  source = 'system',
  sla_due_at = null,
  status = 'open',
  entity = null,
  actions = [],
  created_at = null,
}) {
  return {
    id: `${type}:${id}`,
    entity_id: toId(id),
    type,
    priority,
    priority_rank: priorityRank(priority),
    patient: sanitizePatient(patient),
    title,
    description,
    source,
    sla_due_at,
    sla_state: dueState(sla_due_at),
    status,
    entity,
    actions,
    created_at,
  };
}

async function missingDocumentItems(limit) {
  const tasks = await MissingDocumentTask.find({ status: { $in: ['open', 'overdue'] } })
    .sort({ due_at: 1, created_at: -1 })
    .limit(limit)
    .lean();
  const patientMap = await patientMapFor(tasks);
  return tasks.map((task) => buildItem({
    id: task._id,
    type: 'missing_document',
    priority: task.severity === 'critical' ? 'urgent' : task.severity || 'normal',
    patient: patientMap.get(toId(task.patient_id)),
    title: `Thiếu ${task.expected_file_label || task.required_category}`,
    description: task.entity_title || task.entity_code || 'Thiếu giấy tờ bắt buộc cho hồ sơ/dịch vụ.',
    source: task.module || 'records',
    sla_due_at: task.due_at,
    status: task.status,
    entity: {
      entity_type: task.entity_type,
      entity_id: toId(task.entity_id),
      rule_id: toId(task.rule_id),
    },
    actions: ['open_patient', 'request_document', 'upload_document', 'waive'],
    created_at: task.created_at,
  }));
}

async function profileChangeItems(limit) {
  const requests = await PatientProfileChangeRequest.find({ status: PATIENT_PROFILE_CHANGE_STATUS.PENDING })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();
  const patientMap = await patientMapFor(requests);
  return requests.map((item) => buildItem({
    id: item._id,
    type: 'profile_change_request',
    priority: item.change_type === 'identity' ? 'high' : 'normal',
    patient: patientMap.get(toId(item.patient_id)),
    title: 'Yêu cầu cập nhật hồ sơ',
    description: `Thay đổi ${item.change_type || 'thông tin hành chính'} đang chờ duyệt.`,
    source: item.requested_by_actor?.actor_type || 'portal',
    sla_due_at: item.created_at ? new Date(new Date(item.created_at).getTime() + 24 * 3600000) : null,
    status: item.status,
    entity: {
      change_type: item.change_type,
      old_value_snapshot: item.old_value_snapshot,
      new_value: item.new_value,
    },
    actions: ['open_patient', 'compare_change', 'approve', 'reject', 'request_more_info'],
    created_at: item.created_at,
  }));
}

async function appointmentConfirmationItems(limit, actor = {}) {
  const items = await Appointment.find(scopedDepartmentFilter({
    is_deleted: false,
    status: APPOINTMENT_STATUS.BOOKED,
    appointment_time: { $gte: getStartOfDay(new Date()), $lte: getEndOfDay(new Date()) },
  }, actor))
    .sort({ appointment_time: 1 })
    .limit(limit)
    .lean();
  const patientMap = await patientMapFor(items);
  return items.map((appointment) => buildItem({
    id: appointment._id,
    type: 'appointment_confirmation',
    priority: 'normal',
    patient: patientMap.get(toId(appointment.patient_id)),
    title: 'Lịch hẹn cần xác nhận',
    description: appointment.reason || 'Bệnh nhân có lịch hẹn hôm nay chưa xác nhận.',
    source: appointment.source || 'appointment',
    sla_due_at: appointment.appointment_time,
    status: appointment.status,
    entity: {
      appointment_id: toId(appointment._id),
      appointment_time: appointment.appointment_time,
      department_id: toId(appointment.department_id),
      doctor_id: toId(appointment.doctor_id),
    },
    actions: ['open_appointment', 'confirm', 'send_notification', 'reschedule', 'cancel'],
    created_at: appointment.created_at,
  }));
}

async function invoiceItems(limit) {
  const invoices = await Invoice.find({ status: { $in: OPEN_INVOICE_STATUSES }, balance_due: { $gt: 0 } })
    .sort({ due_at: 1, created_at: -1 })
    .limit(limit)
    .lean();
  const patientMap = await patientMapFor(invoices);
  return invoices.map((invoice) => buildItem({
    id: invoice._id,
    type: 'unpaid_invoice',
    priority: invoice.due_at && new Date(invoice.due_at) < new Date() ? 'high' : 'normal',
    patient: patientMap.get(toId(invoice.patient_id)),
    title: 'Hóa đơn chờ hướng dẫn thanh toán',
    description: `${invoice.invoice_no || 'Invoice'} còn ${invoice.balance_due || 0} ${invoice.currency || 'VND'}.`,
    source: 'billing',
    sla_due_at: invoice.due_at,
    status: invoice.status,
    entity: {
      invoice_id: toId(invoice._id),
      invoice_no: invoice.invoice_no,
      balance_due: invoice.balance_due,
      currency: invoice.currency,
    },
    actions: ['open_invoice', 'show_payment_qr', 'print_payment_guide', 'route_cashier'],
    created_at: invoice.created_at,
  }));
}

async function paymentReviewItems(limit) {
  const intents = await PaymentIntent.find({
    $or: [
      { status: { $in: PAYMENT_REVIEW_STATUSES } },
      { review_status: { $in: ['open', 'assigned'] } },
    ],
  })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();
  const patientMap = await patientMapFor(intents);
  return intents.map((intent) => buildItem({
    id: intent._id,
    type: 'payment_review',
    priority: intent.review_status === 'open' ? 'high' : 'normal',
    patient: patientMap.get(toId(intent.patient_id)),
    title: 'Payment cần xác nhận',
    description: `${intent.intent_code || 'Payment intent'} cần thu ngân rà soát.`,
    source: intent.provider || 'payment',
    sla_due_at: intent.expires_at,
    status: intent.review_status || intent.status,
    entity: {
      intent_id: toId(intent._id),
      invoice_id: toId(intent.invoice_id),
      amount: intent.amount,
      provider: intent.provider,
      status: intent.status,
    },
    actions: ['open_payment', 'route_cashier', 'send_payment_reminder'],
    created_at: intent.created_at,
  }));
}

async function supportItems(limit) {
  const tickets = await SupportTicket.find({ status: { $in: OPEN_SUPPORT_STATUSES } })
    .sort({ sla_due_at: 1, created_at: -1 })
    .limit(limit)
    .lean();
  const patientMap = await patientMapFor(tickets);
  return tickets.map((ticket) => buildItem({
    id: ticket._id,
    type: 'support_ticket',
    priority: ticket.priority || 'normal',
    patient: patientMap.get(toId(ticket.patient_id)),
    title: ticket.subject || 'Support ticket',
    description: ticket.description || ticket.category || 'Yêu cầu hỗ trợ bệnh nhân.',
    source: ticket.category || 'support',
    sla_due_at: ticket.sla_due_at,
    status: ticket.status,
    entity: {
      ticket_id: toId(ticket._id),
      ticket_code: ticket.ticket_code,
      conversation_id: toId(ticket.conversation_id),
    },
    actions: ['open_ticket', 'assign', 'reply', 'resolve'],
    created_at: ticket.created_at,
  }));
}

function filterItems(items = [], query = {}) {
  let output = items;
  if (query.type && query.type !== 'all') {
    output = output.filter((item) => item.type === query.type);
  }
  if (query.priority && query.priority !== 'all') {
    output = output.filter((item) => item.priority === query.priority);
  }
  if (query.sla === 'overdue') {
    output = output.filter((item) => item.sla_state === 'overdue');
  }
  if (query.sla === 'due_soon') {
    output = output.filter((item) => item.sla_state === 'due_soon');
  }
  if (query.source && query.source !== 'all') {
    output = output.filter((item) => item.source === query.source);
  }
  return output;
}

async function getWorklist(query = {}, actor = {}) {
  const { page, limit } = getPagination(query);
  const queryLimit = Math.max(limit * 2, 20);
  const groups = await Promise.all([
    missingDocumentItems(queryLimit),
    profileChangeItems(queryLimit),
    appointmentConfirmationItems(queryLimit, actor),
    invoiceItems(queryLimit),
    paymentReviewItems(queryLimit),
    supportItems(queryLimit),
  ]);
  const allItems = groups
    .flat()
    .sort((left, right) => {
      if (right.priority_rank !== left.priority_rank) return right.priority_rank - left.priority_rank;
      const leftDue = left.sla_due_at ? new Date(left.sla_due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.sla_due_at ? new Date(right.sla_due_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (leftDue !== rightDue) return leftDue - rightDue;
      return new Date(right.created_at || 0) - new Date(left.created_at || 0);
    });
  const filtered = filterItems(allItems, query);
  const start = (page - 1) * limit;
  return {
    items: filtered.slice(start, start + limit),
    pagination: buildPagination(page, limit, filtered.length),
  };
}

function parseWorklistId(itemId) {
  const [type, entityId] = String(itemId || '').split(':');
  if (!type || !entityId) throw createError('itemId không hợp lệ.', 400);
  return { type, entityId };
}

async function assignWorklistItem(itemId, payload = {}, actor = {}, requestMeta = {}) {
  const { type, entityId } = parseWorklistId(itemId);
  const assigneeId = payload.assigned_to || payload.assigned_user_id || actorUserId(actor);
  if (type === 'missing_document') {
    const task = await MissingDocumentTask.findByIdAndUpdate(
      entityId,
      { $set: { assigned_to: assigneeId, updated_by: actorUserId(actor) } },
      { new: true },
    ).lean();
    if (!task) throw createError('Không tìm thấy missing document task.', 404);
    await recordAuditLog({
      actor,
      action: 'reception.worklist.assign',
      targetType: 'missing_document_task',
      targetId: task._id,
      status: 'success',
      message: 'Giao việc missing document.',
      requestMeta,
    });
    return { assigned: true, item_id: itemId, assigned_to: toId(assigneeId) };
  }
  if (type === 'support_ticket') {
    const ticket = await SupportTicket.findByIdAndUpdate(
      entityId,
      { $set: { assigned_user_id: assigneeId, updated_by: actorUserId(actor) } },
      { new: true },
    ).lean();
    if (!ticket) throw createError('Không tìm thấy support ticket.', 404);
    return { assigned: true, item_id: itemId, assigned_to: toId(assigneeId) };
  }
  return { assigned: false, item_id: itemId, message: 'Loại việc này cần xử lý qua nghiệp vụ gốc.' };
}

async function resolveWorklistItem(itemId, payload = {}, actor = {}, requestMeta = {}) {
  const { type, entityId } = parseWorklistId(itemId);
  if (type === 'missing_document') {
    const task = await MissingDocumentTask.findByIdAndUpdate(
      entityId,
      {
        $set: {
          status: 'resolved',
          resolved_at: new Date(),
          resolved_by: actorUserId(actor),
          updated_by: actorUserId(actor),
          resolved_attachment_id: payload.attachment_id,
        },
      },
      { new: true },
    ).lean();
    if (!task) throw createError('Không tìm thấy missing document task.', 404);
    await recordAuditLog({
      actor,
      action: 'reception.worklist.resolve',
      targetType: 'missing_document_task',
      targetId: task._id,
      status: 'success',
      message: payload.note || 'Resolve missing document task.',
      requestMeta,
    });
    return { resolved: true, item_id: itemId };
  }
  return { resolved: false, item_id: itemId, message: 'Loại việc này cần được đóng bằng action nghiệp vụ gốc.' };
}

async function snoozeWorklistItem(itemId, payload = {}, actor = {}, requestMeta = {}) {
  const { type, entityId } = parseWorklistId(itemId);
  const snoozeUntil = payload.snooze_until ? new Date(payload.snooze_until) : new Date(Date.now() + 4 * 3600000);
  if (Number.isNaN(snoozeUntil.getTime())) throw createError('snooze_until không hợp lệ.', 400);
  if (type === 'missing_document') {
    const task = await MissingDocumentTask.findByIdAndUpdate(
      entityId,
      {
        $set: {
          due_at: snoozeUntil,
          updated_by: actorUserId(actor),
          metadata: {
            snoozed_reason: payload.reason || payload.note,
          },
        },
      },
      { new: true },
    ).lean();
    if (!task) throw createError('Không tìm thấy missing document task.', 404);
    await recordAuditLog({
      actor,
      action: 'reception.worklist.snooze',
      targetType: 'missing_document_task',
      targetId: task._id,
      status: 'success',
      message: 'Snooze missing document task.',
      requestMeta,
    });
    return { snoozed: true, item_id: itemId, snooze_until: snoozeUntil };
  }
  return { snoozed: false, item_id: itemId, message: 'Loại việc này không hỗ trợ snooze trực tiếp.' };
}

module.exports = {
  getWorklist,
  assignWorklistItem,
  resolveWorklistItem,
  snoozeWorklistItem,
};
