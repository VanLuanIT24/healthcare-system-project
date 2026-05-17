const {
  ConversationParticipant,
  DocumentExportRequest,
  Invoice,
  LabResult,
  Message,
  Notification,
  QueueTicket,
  SupportTicket,
} = require('../models');
const actorContext = require('../common/actors');
const realtimeService = require('../realtime/realtime.service');
const {
  ACTIVE_QUEUE_STATUSES,
  DOCUMENT_EXPORT_STATUS,
  INVOICE_STATUS,
  LAB_RESULT_STATUS,
  NOTIFICATION_STATUS,
  QUEUE_STATUS,
  REALTIME_EVENT_TYPE,
  SUPPORT_TICKET_STATUS,
} = require('../constants/statuses');

const UNREAD_NOTIFICATION_STATUSES = [
  NOTIFICATION_STATUS.UNREAD,
  NOTIFICATION_STATUS.QUEUED,
  NOTIFICATION_STATUS.SENT,
  NOTIFICATION_STATUS.DELIVERED,
];

function actorIds(actor = {}) {
  const context = actorContext.buildActorContext(actor, { requireActorId: false });
  return {
    actor_type: context.actor_type,
    actor_id: context.actor_id,
    user_id: context.user_id,
    patient_account_id: context.patient_account_id,
    patient_id: context.patient_id,
    relative_id: context.relative_id,
    department_id: context.department_id,
  };
}

function notificationFilter(identity) {
  if (identity.actor_type === 'staff') {
    return {
      status: { $in: UNREAD_NOTIFICATION_STATUSES },
      $or: [
        { recipient_user_id: identity.user_id },
        { recipient_id: identity.user_id },
        { recipient_actor_type: 'staff', recipient_actor_id: identity.user_id },
      ],
    };
  }
  if (identity.actor_type === 'patient') {
    return {
      status: { $in: UNREAD_NOTIFICATION_STATUSES },
      $or: [
        { patient_account_id: identity.patient_account_id },
        { patient_id: identity.patient_id },
        { recipient_actor_type: 'patient', recipient_actor_id: identity.patient_account_id },
      ],
    };
  }
  return {
    status: { $in: UNREAD_NOTIFICATION_STATUSES },
    $or: [
      { relative_id: identity.relative_id },
      { recipient_id: identity.relative_id },
      { recipient_actor_type: identity.actor_type, recipient_actor_id: identity.relative_id },
    ],
  };
}

async function countUnreadMessages(identity) {
  if (!identity.actor_type || !identity.actor_id) return 0;
  const participants = await ConversationParticipant.find({
    actor_type: identity.actor_type,
    actor_id: identity.actor_id,
    left_at: null,
    archived: false,
  }).select('conversation_id last_read_at').lean();
  if (!participants.length) return 0;

  const counts = await Promise.all(participants.map((participant) =>
    Message.countDocuments({
      conversation_id: participant.conversation_id,
      created_at: { $gt: participant.last_read_at || new Date(0) },
      sender_actor_id: { $ne: identity.actor_id },
      status: { $ne: 'deleted' },
    })));
  return counts.reduce((sum, count) => sum + count, 0);
}

async function getActorCounters(actor = {}) {
  const identity = actorIds(actor);
  const patientId = identity.patient_id;
  const staffUserId = identity.user_id || identity.actor_id;

  const [
    unreadNotifications,
    unreadMessages,
    openTickets,
    pendingDocuments,
    pendingLabResults,
    unpaidInvoices,
    queueTicket,
  ] = await Promise.all([
    Notification.countDocuments(notificationFilter(identity)),
    countUnreadMessages(identity),
    identity.actor_type === 'staff'
      ? SupportTicket.countDocuments({ status: { $in: [SUPPORT_TICKET_STATUS.OPEN, SUPPORT_TICKET_STATUS.WAITING_STAFF] }, $or: [{ assigned_user_id: staffUserId }, { assigned_department_id: identity.department_id }] })
      : SupportTicket.countDocuments({ patient_id: patientId, status: { $nin: [SUPPORT_TICKET_STATUS.RESOLVED, SUPPORT_TICKET_STATUS.CLOSED, SUPPORT_TICKET_STATUS.CANCELLED] } }),
    patientId
      ? DocumentExportRequest.countDocuments({ patient_id: patientId, status: { $in: [DOCUMENT_EXPORT_STATUS.PENDING, DOCUMENT_EXPORT_STATUS.PROCESSING, DOCUMENT_EXPORT_STATUS.READY] } })
      : 0,
    patientId
      ? LabResult.countDocuments({ patient_id: patientId, status: { $in: [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED] }, released_to_patient: true })
      : LabResult.countDocuments({ status: { $nin: [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED, LAB_RESULT_STATUS.CANCELLED, LAB_RESULT_STATUS.ENTERED_IN_ERROR] } }),
    patientId
      ? Invoice.countDocuments({ patient_id: patientId, status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID] }, balance_due: { $gt: 0 } })
      : 0,
    patientId
      ? QueueTicket.findOne({ patient_id: patientId, status: { $in: ACTIVE_QUEUE_STATUSES || [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED] } }).sort({ created_at: -1 }).select('queue_number status estimated_wait_minutes').lean()
      : null,
  ]);

  return {
    unread_notifications: unreadNotifications,
    unread_messages: unreadMessages,
    open_tickets: openTickets,
    pending_documents: pendingDocuments,
    pending_lab_results: pendingLabResults,
    unpaid_invoices: unpaidInvoices,
    queue_position: queueTicket ? {
      queue_number: queueTicket.queue_number,
      status: queueTicket.status,
      estimated_wait_minutes: queueTicket.estimated_wait_minutes,
    } : null,
  };
}

async function publishCounterUpdated(actor = {}, options = {}) {
  const counters = await getActorCounters(actor);
  const identity = actorIds(actor);
  realtimeService.emitToScope(REALTIME_EVENT_TYPE.COUNTER_UPDATED, counters, {
    actors: [{
      actor_type: identity.actor_type,
      actor_id: identity.actor_id,
      user_id: identity.user_id,
      patient_id: identity.patient_id,
      relative_id: identity.relative_id,
    }],
  }, {
    request_id: options.request_id || options.requestId,
  });
  return counters;
}

module.exports = {
  getActorCounters,
  publishCounterUpdated,
};
