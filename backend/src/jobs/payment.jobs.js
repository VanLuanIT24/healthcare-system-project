const { PaymentIntent } = require('../models');
const { PAYMENT_INTENT_STATUS, REALTIME_EVENT_TYPE } = require('../constants/statuses');
const eventBus = require('../events/event-bus.service');

const EXPIRABLE_STATUSES = [
  PAYMENT_INTENT_STATUS.CREATED,
  PAYMENT_INTENT_STATUS.PENDING,
  PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
];

async function expirePaymentIntents({ limit = 100 } = {}) {
  const intents = await PaymentIntent.find({
    status: { $in: EXPIRABLE_STATUSES },
    expires_at: { $lte: new Date() },
  }).sort({ expires_at: 1 }).limit(limit);

  let expired_count = 0;
  for (const intent of intents) {
    intent.status = PAYMENT_INTENT_STATUS.EXPIRED;
    intent.failure_reason = intent.failure_reason || 'expired';
    await intent.save();
    expired_count += 1;
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.PAYMENT_INTENT_EXPIRED,
      aggregateType: 'payment_intent',
      aggregateId: intent._id,
      recipientScope: {
        patient_id: intent.patient_id,
        payment_intent_id: intent._id,
        invoice_id: intent.invoice_id,
        recipients: [{ recipient_type: 'patient', recipient_id: intent.patient_id, patient_id: intent.patient_id }],
      },
      payload: {
        payment_intent_id: String(intent._id),
        invoice_id: String(intent.invoice_id),
        notification: {
          title: 'Phiên thanh toán đã hết hạn',
          body: `Phiên ${intent.intent_code} đã hết hạn.`,
          priority: 'normal',
        },
      },
    });
  }

  return { expired_count, payment_intent_ids: intents.map((item) => String(item._id)) };
}

module.exports = {
  expirePaymentIntents,
};
