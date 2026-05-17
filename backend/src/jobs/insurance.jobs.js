const { InsurancePolicy } = require('../models');
const {
  INSURANCE_POLICY_STATUS,
  INSURANCE_VERIFICATION_STATUS,
  REALTIME_EVENT_TYPE,
} = require('../constants/statuses');
const eventBus = require('../events/event-bus.service');

const EXPIRY_WINDOW_DAYS = Number(process.env.INSURANCE_EXPIRY_REMINDER_DAYS || 30);

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

async function sendInsuranceExpiryReminder({ limit = 100 } = {}) {
  const now = new Date();
  const until = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const policies = await InsurancePolicy.find({
    status: INSURANCE_POLICY_STATUS.ACTIVE,
    verification_status: INSURANCE_VERIFICATION_STATUS.VERIFIED,
    valid_to: { $gte: now, $lte: until },
    is_deleted: false,
  }).sort({ valid_to: 1 }).limit(Number(limit) || 100).lean();

  for (const policy of policies) {
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.INSURANCE_EXPIRING,
      aggregateType: 'insurance_policy',
      aggregateId: policy._id,
      recipientScope: {
        patient_id: policy.patient_id,
        recipients: [{ recipient_type: 'patient', recipient_id: policy.patient_id, patient_id: policy.patient_id }],
      },
      payload: {
        insurance_policy_id: toId(policy._id),
        patient_id: toId(policy.patient_id),
        valid_to: policy.valid_to,
        notification: {
          dedupe_key: `insurance_expiring:${toId(policy._id)}`,
          title: 'Bảo hiểm sắp hết hạn',
          body: `Chính sách bảo hiểm ${policy.policy_no} sắp hết hạn.`,
          priority: 'normal',
        },
      },
      idempotencyKey: `insurance_expiring:${toId(policy._id)}:${new Date(policy.valid_to).toISOString().slice(0, 10)}`,
    }, { publishImmediately: false });
  }

  return { processed: policies.length, policy_ids: policies.map((item) => toId(item._id)) };
}

module.exports = {
  sendInsuranceExpiryReminder,
};
