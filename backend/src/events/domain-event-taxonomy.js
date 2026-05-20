const DOMAIN_EVENT_TYPE = {
  APPOINTMENT_BOOKED: 'appointment.appointment.booked',
  QUEUE_TICKET_CALLED: 'queue.ticket.called',
  BILLING_PAYMENT_INTENT_PAID: 'billing.payment_intent.paid',
  BILLING_INVOICE_PAID: 'billing.invoice.paid',
  BILLING_REFUND_REQUESTED: 'billing.refund.requested',
  BILLING_REFUND_APPROVED: 'billing.refund.approved',
  BILLING_REFUND_REJECTED: 'billing.refund.rejected',
  BILLING_REFUND_PROCESSED: 'billing.refund.processed',
  BILLING_PAYMENT_VOIDED: 'billing.payment.voided',
  BILLING_INVOICE_VOIDED: 'billing.invoice.voided',
  RECORDS_DOCUMENT_APPROVED: 'records.document.approved',
  LAB_RESULT_RELEASED: 'lab.result.released',
  IMAGING_REPORT_FINALIZED: 'imaging.report.finalized',
  MESSAGING_MESSAGE_SENT: 'messaging.message.sent',
  SUPPORT_TICKET_ESCALATED: 'support.ticket.escalated',
  EMERGENCY_CASE_CREATED: 'emergency.case.created',
  AUTH_SESSION_REVOKED: 'auth.session.revoked',
  COUNTER_UPDATED: 'counter.updated',
};

const DOMAIN_EVENT_TYPES = Object.values(DOMAIN_EVENT_TYPE);
const DOMAIN_EVENT_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

function isCanonicalEventType(eventType) {
  return DOMAIN_EVENT_PATTERN.test(String(eventType || ''));
}

function buildDomainEventEnvelope({
  event_id,
  event_type,
  aggregate_type,
  aggregate_id,
  actor = null,
  recipients = [],
  payload = {},
  occurred_at = new Date(),
  correlation_id = null,
  request_id = null,
} = {}) {
  return {
    event_id,
    event_type,
    aggregate_type,
    aggregate_id,
    actor,
    recipients,
    payload,
    occurred_at: occurred_at instanceof Date ? occurred_at.toISOString() : occurred_at,
    correlation_id,
    request_id,
  };
}

module.exports = {
  DOMAIN_EVENT_TYPE,
  DOMAIN_EVENT_TYPES,
  isCanonicalEventType,
  buildDomainEventEnvelope,
};
