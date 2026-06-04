const { AppointmentWaitlist, Department, Patient, ScheduleSlot, User } = require('../models');
const { APPOINTMENT_WAITLIST_STATUS } = require('../constants/statuses');
const { buildPagination, createError, getPagination, recordAuditLog } = require('./core.service');
const actorContext = require('../common/actors');

function patientId(actor = {}, payload = {}) {
  if (actorContext.getActorType(actor) === 'patient') return actorContext.getPatientId(actor);
  return payload.patient_id || payload.patientId;
}

function toId(value) {
  return value ? String(value) : null;
}

async function buildWaitlistReferenceMaps(items = []) {
  const patientIds = [...new Set(items.map((item) => toId(item.patient_id)).filter(Boolean))];
  const doctorIds = [...new Set(items.map((item) => toId(item.doctor_id)).filter(Boolean))];
  const departmentIds = [...new Set(items.map((item) => toId(item.department_id)).filter(Boolean))];
  const offeredSlotIds = [...new Set(items.map((item) => toId(item.offered_slot_id)).filter(Boolean))];
  const [patients, doctors, departments, slots] = await Promise.all([
    patientIds.length ? Patient.find({ _id: { $in: patientIds } }).select('patient_code full_name phone').lean() : [],
    doctorIds.length ? User.find({ _id: { $in: doctorIds } }).select('full_name employee_code username').lean() : [],
    departmentIds.length ? Department.find({ _id: { $in: departmentIds } }).select('department_name department_code').lean() : [],
    offeredSlotIds.length ? ScheduleSlot.find({ _id: { $in: offeredSlotIds } }).select('doctor_schedule_id start_time end_time status').lean() : [],
  ]);

  return {
    patientMap: new Map(patients.map((item) => [toId(item._id), item])),
    doctorMap: new Map(doctors.map((item) => [toId(item._id), item])),
    departmentMap: new Map(departments.map((item) => [toId(item._id), item])),
    slotMap: new Map(slots.map((item) => [toId(item._id), item])),
  };
}

function waitlistDto(item = {}, maps = {}) {
  const patient = maps.patientMap?.get(toId(item.patient_id));
  const doctor = maps.doctorMap?.get(toId(item.doctor_id));
  const department = maps.departmentMap?.get(toId(item.department_id));
  const offeredSlot = maps.slotMap?.get(toId(item.offered_slot_id));
  return {
    waitlist_id: toId(item._id),
    patient_id: toId(item.patient_id),
    patient_code: patient?.patient_code || null,
    patient_name: patient?.full_name || null,
    patient_phone: patient?.phone || null,
    doctor_id: toId(item.doctor_id),
    doctor_name: doctor?.full_name || doctor?.username || null,
    doctor_code: doctor?.employee_code || null,
    department_id: toId(item.department_id),
    department_name: department?.department_name || null,
    department_code: department?.department_code || null,
    preferred_date: item.preferred_date,
    preferred_time_range: item.preferred_time_range,
    reason: item.reason,
    status: item.status,
    offered_slot_id: toId(item.offered_slot_id),
    offered_until: item.offered_until,
    offered_slot: offeredSlot ? {
      schedule_slot_id: toId(offeredSlot._id),
      doctor_schedule_id: toId(offeredSlot.doctor_schedule_id),
      start_time: offeredSlot.start_time,
      end_time: offeredSlot.end_time,
      status: offeredSlot.status,
    } : null,
    booked_appointment_id: toId(item.booked_appointment_id),
    metadata: item.metadata,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
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
  const maps = await buildWaitlistReferenceMaps(items);
  return { items: items.map((item) => waitlistDto(item, maps)), pagination: buildPagination(page, limit, total) };
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
