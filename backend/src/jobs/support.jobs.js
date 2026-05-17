const { SupportTicket } = require('../models');
const { SUPPORT_TICKET_STATUS, REALTIME_EVENT_TYPE } = require('../constants/statuses');
const eventBus = require('../events/event-bus.service');

const ACTIVE_SUPPORT_STATUSES = [
  SUPPORT_TICKET_STATUS.OPEN,
  SUPPORT_TICKET_STATUS.WAITING_PATIENT,
  SUPPORT_TICKET_STATUS.WAITING_STAFF,
];

async function expireSupportSla({ limit = 100 } = {}) {
  const tickets = await SupportTicket.find({
    status: { $in: ACTIVE_SUPPORT_STATUSES },
    sla_due_at: { $lte: new Date() },
    $or: [
      { 'metadata.sla_breached_at': null },
      { 'metadata.sla_breached_at': { $exists: false } },
    ],
  }).sort({ sla_due_at: 1 }).limit(limit);

  for (const ticket of tickets) {
    ticket.metadata = {
      ...(ticket.metadata || {}),
      sla_breached_at: new Date(),
    };
    await ticket.save();
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.SUPPORT_TICKET_SLA_BREACHED,
      aggregateType: 'support_ticket',
      aggregateId: ticket._id,
      recipientScope: {
        patient_id: ticket.patient_id,
        department_id: ticket.assigned_department_id,
        user_id: ticket.assigned_user_id,
        support_ticket_id: ticket._id,
        role: ['admin', 'manager', 'receptionist'],
      },
      payload: {
        ticket_id: String(ticket._id),
        ticket_code: ticket.ticket_code,
        priority: ticket.priority,
        sla_due_at: ticket.sla_due_at,
        notification: {
          title: 'Ticket quá hạn SLA',
          body: `${ticket.ticket_code} - ${ticket.subject}`,
          priority: 'urgent',
        },
      },
    });
  }

  return { breached_count: tickets.length, ticket_ids: tickets.map((item) => String(item._id)) };
}

module.exports = {
  expireSupportSla,
};
