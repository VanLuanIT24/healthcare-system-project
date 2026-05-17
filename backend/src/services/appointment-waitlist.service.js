const { AppointmentWaitlist, ScheduleSlot } = require('../models');
const { APPOINTMENT_WAITLIST_STATUS } = require('../constants/statuses');
const { buildPagination, createError, getPagination, recordAuditLog } = require('./core.service');
const actorContext = require('../common/actors');

function patientId(actor = {}, payload = {}) {
  if (actorContext.getActorType(actor) === 'patient') return actorContext.getPatientId(actor);
  return payload.patient_id || payload.patientId;
}

async function createWaitlist(payload = {}, actor = {}, requestMeta = {}) {
  const pid = patientId(actor, payload);
  if (!pid) throw createError('patient_id là bắt buộc.', 422);
  const item = await AppointmentWaitlist.create({
    patient_id: pid,
    doctor_id: payload.doctor_id || payload.doctorId,
    department_id: payload.department_id || payload.departmentId,
    preferred_date: payload.preferred_date || payload.preferredDate,
    preferred_time_range: payload.preferred_time_range || payload.preferredTimeRange,
    reason: payload.reason,
    status: APPOINTMENT_WAITLIST_STATUS.WAITING,
    metadata: payload.metadata,
    created_by: actor.userId,
    updated_by: actor.userId,
  });
  await recordAuditLog({ actor, action: 'appointment_waitlist.create', targetType: 'appointment_waitlist', targetId: item._id, status: 'success', message: 'Tạo appointment waitlist.', requestMeta });
  return item.toObject();
}

async function listWaitlist(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (actorContext.getActorType(actor) === 'patient') filter.patient_id = actorContext.getPatientId(actor);
  for (const field of ['patient_id', 'doctor_id', 'department_id', 'status']) {
    if (query[field] && (field !== 'patient_id' || actorContext.getActorType(actor) !== 'patient')) filter[field] = query[field];
  }
  const [items, total] = await Promise.all([
    AppointmentWaitlist.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AppointmentWaitlist.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function offerSlot(waitlistId, payload = {}, actor = {}, requestMeta = {}) {
  const item = await AppointmentWaitlist.findById(waitlistId);
  if (!item) throw createError('Không tìm thấy waitlist.', 404);
  const slot = await ScheduleSlot.findById(payload.offered_slot_id || payload.offeredSlotId).lean();
  if (!slot) throw createError('Không tìm thấy offered slot.', 404);
  item.status = APPOINTMENT_WAITLIST_STATUS.OFFERED;
  item.offered_slot_id = slot._id;
  item.offered_until = payload.offered_until || payload.offeredUntil || new Date(Date.now() + 30 * 60 * 1000);
  item.updated_by = actor.userId;
  await item.save();
  await recordAuditLog({ actor, action: 'appointment_waitlist.offer_slot', targetType: 'appointment_waitlist', targetId: item._id, status: 'success', message: 'Offer slot appointment waitlist.', requestMeta });
  return item.toObject();
}

async function bookWaitlist(waitlistId, payload = {}, actor = {}, requestMeta = {}) {
  const item = await AppointmentWaitlist.findById(waitlistId);
  if (!item) throw createError('Không tìm thấy waitlist.', 404);
  if (actorContext.getActorType(actor) === 'patient' && String(item.patient_id) !== String(actorContext.getPatientId(actor))) {
    throw createError('Bạn không có quyền book waitlist này.', 403);
  }
  item.status = APPOINTMENT_WAITLIST_STATUS.BOOKED;
  item.booked_appointment_id = payload.appointment_id || payload.appointmentId;
  await item.save();
  await recordAuditLog({ actor, action: 'appointment_waitlist.book', targetType: 'appointment_waitlist', targetId: item._id, status: 'success', message: 'Book appointment waitlist.', requestMeta });
  return item.toObject();
}

async function cancelWaitlist(waitlistId, payload = {}, actor = {}, requestMeta = {}) {
  const item = await AppointmentWaitlist.findById(waitlistId);
  if (!item) throw createError('Không tìm thấy waitlist.', 404);
  if (actorContext.getActorType(actor) === 'patient' && String(item.patient_id) !== String(actorContext.getPatientId(actor))) {
    throw createError('Bạn không có quyền cancel waitlist này.', 403);
  }
  item.status = APPOINTMENT_WAITLIST_STATUS.CANCELLED;
  item.metadata = { ...(item.metadata || {}), cancel_reason: payload.reason || payload.cancel_reason };
  await item.save();
  await recordAuditLog({ actor, action: 'appointment_waitlist.cancel', targetType: 'appointment_waitlist', targetId: item._id, status: 'success', message: 'Cancel appointment waitlist.', requestMeta });
  return item.toObject();
}

module.exports = {
  createWaitlist,
  listWaitlist,
  offerSlot,
  bookWaitlist,
  cancelWaitlist,
};
