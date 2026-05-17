const { Appointment, QueueTicket, ScheduleSlot } = require('../models');
const {
  APPOINTMENT_STATUS,
  REALTIME_EVENT_TYPE,
  SCHEDULE_SLOT_STATUS,
} = require('../constants/statuses');
const eventBus = require('../events/event-bus.service');

const REMINDER_LOOKAHEAD_MINUTES = Number(process.env.APPOINTMENT_REMINDER_LOOKAHEAD_MINUTES || 24 * 60);
const NO_SHOW_GRACE_MINUTES = Number(process.env.APPOINTMENT_NO_SHOW_GRACE_MINUTES || 30);

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

async function sendAppointmentReminders({ limit = 100 } = {}) {
  const now = new Date();
  const until = new Date(now.getTime() + REMINDER_LOOKAHEAD_MINUTES * 60 * 1000);
  const appointments = await Appointment.find({
    status: { $in: [APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CONFIRMED] },
    appointment_time: { $gte: now, $lte: until },
    is_deleted: false,
  }).sort({ appointment_time: 1 }).limit(Number(limit) || 100).lean();

  for (const appointment of appointments) {
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.APPOINTMENT_REMINDER,
      aggregateType: 'appointment',
      aggregateId: appointment._id,
      recipientScope: {
        patient_id: appointment.patient_id,
        appointment_id: appointment._id,
        user_id: appointment.doctor_id,
        department_id: appointment.department_id,
        recipients: [{ recipient_type: 'patient', recipient_id: appointment.patient_id, patient_id: appointment.patient_id }],
      },
      payload: {
        appointment_id: toId(appointment._id),
        appointment_time: appointment.appointment_time,
        doctor_id: toId(appointment.doctor_id),
        department_id: toId(appointment.department_id),
        notification: {
          dedupe_key: `appointment_reminder:${toId(appointment._id)}`,
          title: 'Nhắc lịch hẹn',
          body: 'Bạn có lịch hẹn sắp tới. Vui lòng kiểm tra thông tin trước khi đến khám.',
          priority: 'normal',
        },
      },
      idempotencyKey: `appointment_reminder:${toId(appointment._id)}`,
    }, { publishImmediately: false });
  }

  return { processed: appointments.length, appointment_ids: appointments.map((item) => toId(item._id)) };
}

async function markNoShowAppointments({ limit = 100 } = {}) {
  const cutoff = new Date(Date.now() - NO_SHOW_GRACE_MINUTES * 60 * 1000);
  const appointments = await Appointment.find({
    status: { $in: [APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CONFIRMED] },
    appointment_time: { $lt: cutoff },
    is_deleted: false,
  }).sort({ appointment_time: 1 }).limit(Number(limit) || 100);

  let marked = 0;
  for (const appointment of appointments) {
    const activeQueue = await QueueTicket.exists({
      appointment_id: appointment._id,
      status: { $nin: ['completed', 'cancelled', 'no_show'] },
    });
    if (activeQueue) continue;
    appointment.status = APPOINTMENT_STATUS.NO_SHOW;
    appointment.no_show_at = new Date();
    appointment.updated_by = appointment.updated_by;
    await appointment.save();
    marked += 1;
    await eventBus.publishDomainEvent({
      eventType: REALTIME_EVENT_TYPE.APPOINTMENT_CANCELLED,
      aggregateType: 'appointment',
      aggregateId: appointment._id,
      recipientScope: {
        patient_id: appointment.patient_id,
        appointment_id: appointment._id,
        user_id: appointment.doctor_id,
        department_id: appointment.department_id,
      },
      payload: {
        appointment_id: toId(appointment._id),
        status: APPOINTMENT_STATUS.NO_SHOW,
      },
    }, { publishImmediately: false });
  }

  return { processed: appointments.length, marked_no_show: marked };
}

async function closeExpiredScheduleSlots() {
  const result = await ScheduleSlot.updateMany(
    {
      status: SCHEDULE_SLOT_STATUS.HELD,
      hold_expires_at: { $lte: new Date() },
      appointment_id: { $exists: false },
    },
    {
      $set: {
        status: SCHEDULE_SLOT_STATUS.AVAILABLE,
        booked_count: 0,
      },
      $unset: {
        patient_id: '',
        hold_expires_at: '',
      },
    },
  );
  return { released_slots: result.modifiedCount || 0 };
}

module.exports = {
  sendAppointmentReminders,
  markNoShowAppointments,
  closeExpiredScheduleSlots,
};
