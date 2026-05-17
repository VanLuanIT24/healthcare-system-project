const { EmergencyCase } = require('../models');
const { EMERGENCY_STATUS, REALTIME_EVENT_TYPE } = require('../constants/statuses');
const { ROLE_CODE } = require('../constants/permissions');
const eventBus = require('../events/event-bus.service');

const ESCALATION_MINUTES = Number(process.env.EMERGENCY_ESCALATION_MINUTES || 5);

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

async function escalateOpenEmergencyCases({ limit = 50 } = {}) {
  const cutoff = new Date(Date.now() - ESCALATION_MINUTES * 60 * 1000);
  const cases = await EmergencyCase.find({
    status: EMERGENCY_STATUS.CREATED,
    created_at: { $lte: cutoff },
    $or: [
      { 'metadata.escalated_at': null },
      { 'metadata.escalated_at': { $exists: false } },
    ],
  }).sort({ created_at: 1 }).limit(Number(limit) || 50);

  for (const emergencyCase of cases) {
    emergencyCase.metadata = {
      ...(emergencyCase.metadata || {}),
      escalated_at: new Date(),
      escalation_reason: `not_acknowledged_after_${ESCALATION_MINUTES}_minutes`,
    };
    await emergencyCase.save();
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.EMERGENCY_ESCALATED,
      aggregateType: 'emergency_case',
      aggregateId: emergencyCase._id,
      recipientScope: {
        patient_id: emergencyCase.patient_id,
        emergency_case_id: emergencyCase._id,
        case_id: emergencyCase._id,
        department_id: emergencyCase.assigned_department_id,
        roles: [ROLE_CODE.NURSE, ROLE_CODE.ADMIN],
        user_id: emergencyCase.assigned_to_user_id,
        recipients: [{ recipient_type: 'patient', recipient_id: emergencyCase.patient_id, patient_id: emergencyCase.patient_id }],
      },
      payload: {
        emergency_case_id: toId(emergencyCase._id),
        patient_id: toId(emergencyCase.patient_id),
        status: emergencyCase.status,
        priority: emergencyCase.priority,
        notification: {
          dedupe_key: `emergency_escalated:${toId(emergencyCase._id)}`,
          title: 'SOS chưa được tiếp nhận',
          body: 'Một ca khẩn cấp chưa được acknowledge đúng hạn.',
          priority: 'critical',
          channels: ['in_app', 'socket', 'push', 'email'],
        },
      },
      idempotencyKey: `emergency_escalated:${toId(emergencyCase._id)}`,
    }, { publishImmediately: false });
  }

  return { escalated: cases.length, case_ids: cases.map((item) => toId(item._id)) };
}

module.exports = {
  escalateOpenEmergencyCases,
};
