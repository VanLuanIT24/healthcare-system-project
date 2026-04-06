const {
  Appointment,
  Department,
  DoctorSchedule,
  Role,
  User,
  UserRole,
} = require('../models');
const {
  buildPagination,
  createError,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  recordAuditLog,
} = require('./core.service');

function validateScheduleTimeRange(payload) {
  const shiftStart = new Date(payload.shift_start);
  const shiftEnd = new Date(payload.shift_end);
  const workDate = new Date(payload.work_date || payload.shift_start);
  const slotDuration = Number(payload.slot_duration_minutes || 15);

  if (Number.isNaN(shiftStart.getTime()) || Number.isNaN(shiftEnd.getTime()) || Number.isNaN(workDate.getTime())) {
    throw createError('Thời gian lịch làm việc không hợp lệ.');
  }

  if (shiftStart >= shiftEnd) {
    throw createError('shift_start phải nhỏ hơn shift_end.');
  }

  if (slotDuration < 5 || slotDuration > 240) {
    throw createError('slot_duration_minutes phải nằm trong khoảng 5 đến 240 phút.');
  }

  return {
    workDate: getStartOfDay(workDate),
    shiftStart,
    shiftEnd,
    slotDuration,
  };
}

async function validateDoctorBelongsToDepartment(doctorId, departmentId) {
  const [doctor, department, doctorRole] = await Promise.all([
    User.findById(doctorId).lean(),
    Department.findById(departmentId).lean(),
    Role.findOne({ role_code: 'doctor', is_deleted: false }).lean(),
  ]);

  if (!doctor || doctor.is_deleted) {
    throw createError('Không tìm thấy bác sĩ.', 404);
  }
  if (!department || department.is_deleted || department.status !== 'active') {
    throw createError('Department không tồn tại hoặc đang inactive.', 404);
  }

  const hasDoctorRole = doctorRole
    ? await UserRole.exists({
        user_id: doctor._id,
        role_id: doctorRole._id,
        is_active: true,
      })
    : false;

  if (!hasDoctorRole) {
    throw createError('User được chọn không có role doctor.', 409);
  }

  if (doctor.department_id && String(doctor.department_id) !== String(department._id)) {
    throw createError('Bác sĩ không thuộc department này.', 409);
  }

  return { doctor, department };
}

async function validateScheduleConflict({ doctor_id, work_date, shift_start, shift_end }, excludeId = null) {
  const filter = {
    doctor_id,
    is_deleted: false,
    work_date: getStartOfDay(work_date),
    status: { $nin: ['cancelled'] },
    shift_start: { $lt: new Date(shift_end) },
    shift_end: { $gt: new Date(shift_start) },
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const existing = await DoctorSchedule.findOne(filter).lean();
  if (existing) {
    throw createError('Bác sĩ đang bị trùng lịch trong khoảng thời gian này.', 409);
  }

  return true;
}

function calculateScheduleSlots(schedule) {
  const slots = [];
  const duration = Number(schedule.slot_duration_minutes || 15);
  let cursor = new Date(schedule.shift_start);

  while (cursor < new Date(schedule.shift_end)) {
    const next = new Date(cursor.getTime() + duration * 60 * 1000);
    if (next <= new Date(schedule.shift_end)) {
      slots.push({
        slot_time: new Date(cursor),
        slot_end: next,
      });
    }
    cursor = next;
  }

  return slots;
}

async function countScheduleAppointments(scheduleId) {
  return Appointment.countDocuments({
    doctor_schedule_id: scheduleId,
    is_deleted: false,
    status: { $nin: ['cancelled', 'no_show'] },
  });
}

async function getBookedSlots(scheduleId) {
  const items = await Appointment.find({
    doctor_schedule_id: scheduleId,
    is_deleted: false,
    status: { $nin: ['cancelled', 'no_show'] },
  })
    .sort({ appointment_time: 1 })
    .lean();

  return {
    schedule_id: String(scheduleId),
    items: items.map((appointment) => ({
      appointment_id: String(appointment._id),
      appointment_time: appointment.appointment_time,
      patient_id: String(appointment.patient_id),
      status: appointment.status,
    })),
  };
}

async function getAvailableSlots(scheduleId) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const [booked, appointmentsCount] = await Promise.all([
    getBookedSlots(schedule._id),
    countScheduleAppointments(schedule._id),
  ]);

  const blockedSet = new Set((schedule.blocked_slots || []).map((item) => new Date(item.slot_time).toISOString()));
  const bookedSet = new Set(booked.items.map((item) => new Date(item.appointment_time).toISOString()));
  const theoreticalSlots = calculateScheduleSlots(schedule);

  const items = theoreticalSlots.map((slot) => {
    const key = new Date(slot.slot_time).toISOString();
    return {
      slot_time: slot.slot_time,
      slot_end: slot.slot_end,
      is_blocked: blockedSet.has(key),
      is_booked: bookedSet.has(key),
      is_available: !blockedSet.has(key) && !bookedSet.has(key),
    };
  });

  return {
    schedule_id: String(schedule._id),
    status: schedule.status,
    max_patients: schedule.max_patients,
    appointments_count: appointmentsCount,
    items,
  };
}

async function validateScheduleBeforePublish(scheduleId) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  if (!['draft', 'published'].includes(schedule.status)) {
    throw createError('Chỉ lịch draft hoặc published mới được mở cho đặt lịch.', 409);
  }

  return schedule;
}

async function checkScheduleCanBeUpdated(scheduleId) {
  const appointmentsCount = await countScheduleAppointments(scheduleId);
  return {
    schedule_id: String(scheduleId),
    can_update: appointmentsCount === 0,
    appointments_count: appointmentsCount,
  };
}

async function checkScheduleCanBeCancelled(scheduleId) {
  const appointmentsCount = await countScheduleAppointments(scheduleId);
  return {
    schedule_id: String(scheduleId),
    can_cancel: appointmentsCount === 0,
    appointments_count: appointmentsCount,
  };
}

async function checkDoctorHasFutureAppointmentsInSchedule(scheduleId) {
  const count = await Appointment.countDocuments({
    doctor_schedule_id: scheduleId,
    is_deleted: false,
    appointment_time: { $gte: new Date() },
    status: { $in: ['booked', 'confirmed', 'checked_in', 'in_consultation'] },
  });

  return {
    schedule_id: String(scheduleId),
    has_future_appointments: count > 0,
    future_appointments_count: count,
  };
}

async function createDoctorSchedule(payload, actor, requestMeta = {}) {
  const normalized = validateScheduleTimeRange(payload);
  await validateDoctorBelongsToDepartment(payload.doctor_id, payload.department_id);
  await validateScheduleConflict({
    doctor_id: payload.doctor_id,
    work_date: normalized.workDate,
    shift_start: normalized.shiftStart,
    shift_end: normalized.shiftEnd,
  });

  const schedule = await DoctorSchedule.create({
    doctor_id: payload.doctor_id,
    department_id: payload.department_id,
    work_date: normalized.workDate,
    shift_start: normalized.shiftStart,
    shift_end: normalized.shiftEnd,
    slot_duration_minutes: normalized.slotDuration,
    max_patients: payload.max_patients,
    blocked_slots: [],
    status: payload.status || 'draft',
    created_by: actor.userId,
  });

  await recordAuditLog({
    actor,
    action: 'schedule.create',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: 'Tạo lịch làm việc bác sĩ thành công.',
    requestMeta,
  });

  return getDoctorScheduleDetail(schedule._id);
}

async function listDoctorSchedules(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };

  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.status) filter.status = query.status;
  if (query.date_from || query.date_to) {
    filter.work_date = {};
    if (query.date_from) filter.work_date.$gte = getStartOfDay(query.date_from);
    if (query.date_to) filter.work_date.$lte = getEndOfDay(query.date_to);
  }

  const [items, total] = await Promise.all([
    DoctorSchedule.find(filter).sort({ work_date: 1, shift_start: 1 }).skip(skip).limit(limit).lean(),
    DoctorSchedule.countDocuments(filter),
  ]);

  return {
    items: items.map((schedule) => ({
      doctor_schedule_id: String(schedule._id),
      doctor_id: String(schedule.doctor_id),
      department_id: String(schedule.department_id),
      work_date: schedule.work_date,
      shift_start: schedule.shift_start,
      shift_end: schedule.shift_end,
      slot_duration_minutes: schedule.slot_duration_minutes,
      max_patients: schedule.max_patients,
      blocked_slots_count: (schedule.blocked_slots || []).length,
      status: schedule.status,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getDoctorScheduleDetail(scheduleId) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const [availableSlots, appointmentsCount] = await Promise.all([
    getAvailableSlots(schedule._id),
    countScheduleAppointments(schedule._id),
  ]);

  return {
    schedule: {
      doctor_schedule_id: String(schedule._id),
      doctor_id: String(schedule.doctor_id),
      department_id: String(schedule.department_id),
      work_date: schedule.work_date,
      shift_start: schedule.shift_start,
      shift_end: schedule.shift_end,
      slot_duration_minutes: schedule.slot_duration_minutes,
      max_patients: schedule.max_patients,
      blocked_slots: schedule.blocked_slots || [],
      status: schedule.status,
    },
    appointments_count: appointmentsCount,
    slots_summary: {
      total_slots: availableSlots.items.length,
      available_slots: availableSlots.items.filter((item) => item.is_available).length,
      booked_slots: availableSlots.items.filter((item) => item.is_booked).length,
      blocked_slots: availableSlots.items.filter((item) => item.is_blocked).length,
    },
  };
}

async function updateDoctorSchedule(scheduleId, payload, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const updateCheck = await checkScheduleCanBeUpdated(schedule._id);
  if (!updateCheck.can_update) {
    throw createError('Lịch đã có appointment nên không thể sửa mạnh.', 409);
  }

  const mergedPayload = {
    work_date: payload.work_date || schedule.work_date,
    shift_start: payload.shift_start || schedule.shift_start,
    shift_end: payload.shift_end || schedule.shift_end,
    slot_duration_minutes: payload.slot_duration_minutes || schedule.slot_duration_minutes,
  };

  const normalized = validateScheduleTimeRange(mergedPayload);
  await validateDoctorBelongsToDepartment(payload.doctor_id || schedule.doctor_id, payload.department_id || schedule.department_id);
  await validateScheduleConflict(
    {
      doctor_id: payload.doctor_id || schedule.doctor_id,
      work_date: normalized.workDate,
      shift_start: normalized.shiftStart,
      shift_end: normalized.shiftEnd,
    },
    schedule._id,
  );

  schedule.doctor_id = payload.doctor_id || schedule.doctor_id;
  schedule.department_id = payload.department_id || schedule.department_id;
  schedule.work_date = normalized.workDate;
  schedule.shift_start = normalized.shiftStart;
  schedule.shift_end = normalized.shiftEnd;
  schedule.slot_duration_minutes = normalized.slotDuration;
  schedule.max_patients = payload.max_patients !== undefined ? payload.max_patients : schedule.max_patients;
  schedule.updated_by = actor.userId;
  await schedule.save();

  await recordAuditLog({
    actor,
    action: 'schedule.update',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: 'Cập nhật lịch làm việc bác sĩ thành công.',
    requestMeta,
  });

  return getDoctorScheduleDetail(schedule._id);
}

async function publishDoctorSchedule(scheduleId, actor, requestMeta = {}) {
  const schedule = await validateScheduleBeforePublish(scheduleId);
  const document = await DoctorSchedule.findById(schedule._id);
  document.status = 'active';
  document.updated_by = actor.userId;
  await document.save();

  await recordAuditLog({
    actor,
    action: 'schedule.publish',
    targetType: 'doctor_schedule',
    targetId: document._id,
    status: 'success',
    message: 'Mở lịch làm việc cho đặt khám thành công.',
    requestMeta,
  });

  return getDoctorScheduleDetail(document._id);
}

async function cancelDoctorSchedule(scheduleId, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const cancellationCheck = await checkScheduleCanBeCancelled(schedule._id);
  if (!cancellationCheck.can_cancel) {
    throw createError('Lịch đang có appointment nên chưa thể hủy trực tiếp.', 409);
  }

  schedule.status = 'cancelled';
  schedule.updated_by = actor.userId;
  await schedule.save();

  await recordAuditLog({
    actor,
    action: 'schedule.cancel',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: 'Hủy lịch làm việc bác sĩ thành công.',
    requestMeta,
  });

  return getDoctorScheduleDetail(schedule._id);
}

async function completeDoctorSchedule(scheduleId, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  schedule.status = 'completed';
  schedule.updated_by = actor.userId;
  await schedule.save();

  await recordAuditLog({
    actor,
    action: 'schedule.complete',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: 'Hoàn tất lịch làm việc bác sĩ thành công.',
    requestMeta,
  });

  return getDoctorScheduleDetail(schedule._id);
}

async function blockScheduleSlot(scheduleId, payload, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const slotTime = new Date(payload.slot_time);
  if (Number.isNaN(slotTime.getTime())) {
    throw createError('slot_time không hợp lệ.');
  }

  const availableSlots = calculateScheduleSlots(schedule);
  const targetSlot = availableSlots.find((slot) => new Date(slot.slot_time).getTime() === slotTime.getTime());
  if (!targetSlot) {
    throw createError('Slot cần chặn không thuộc lịch làm việc này.', 404);
  }

  const exists = (schedule.blocked_slots || []).some((item) => new Date(item.slot_time).getTime() === slotTime.getTime());
  if (!exists) {
    schedule.blocked_slots.push({
      slot_time: slotTime,
      reason: payload.reason,
      blocked_by: actor.userId,
      blocked_at: new Date(),
    });
    schedule.updated_by = actor.userId;
    await schedule.save();
  }

  await recordAuditLog({
    actor,
    action: 'schedule.block_slot',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: 'Chặn slot lịch làm việc thành công.',
    requestMeta,
    metadata: { slot_time: slotTime },
  });

  return getAvailableSlots(schedule._id);
}

async function reopenScheduleSlot(scheduleId, payload, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const slotTime = new Date(payload.slot_time);
  schedule.blocked_slots = (schedule.blocked_slots || []).filter(
    (item) => new Date(item.slot_time).getTime() !== slotTime.getTime(),
  );
  schedule.updated_by = actor.userId;
  await schedule.save();

  await recordAuditLog({
    actor,
    action: 'schedule.reopen_slot',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: 'Mở lại slot lịch làm việc thành công.',
    requestMeta,
    metadata: { slot_time: slotTime },
  });

  return getAvailableSlots(schedule._id);
}

async function listSchedulesByDoctor(doctorId, query = {}) {
  return listDoctorSchedules({ ...query, doctor_id: doctorId });
}

async function listSchedulesByDepartment(departmentId, query = {}) {
  return listDoctorSchedules({ ...query, department_id: departmentId });
}

async function listSchedulesByDateRange(dateFrom, dateTo, query = {}) {
  return listDoctorSchedules({ ...query, date_from: dateFrom, date_to: dateTo });
}

async function getDoctorCalendarView(doctorId, query = {}) {
  return listSchedulesByDoctor(doctorId, query);
}

async function getScheduleUtilization(scheduleId) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const availableSlots = await getAvailableSlots(schedule._id);
  const total = availableSlots.items.length || 1;
  const booked = availableSlots.items.filter((item) => item.is_booked).length;

  return {
    schedule_id: String(schedule._id),
    total_slots: total,
    booked_slots: booked,
    available_slots: availableSlots.items.filter((item) => item.is_available).length,
    blocked_slots: availableSlots.items.filter((item) => item.is_blocked).length,
    utilization_rate: Number(((booked / total) * 100).toFixed(2)),
  };
}

async function getDoctorScheduleSummary(scheduleId) {
  const [detail, utilization, futureAppointments] = await Promise.all([
    getDoctorScheduleDetail(scheduleId),
    getScheduleUtilization(scheduleId),
    checkDoctorHasFutureAppointmentsInSchedule(scheduleId),
  ]);

  return {
    ...detail,
    utilization,
    future_appointments_count: futureAppointments.future_appointments_count,
  };
}

async function duplicateDoctorSchedule(scheduleId, payload = {}, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const targetDate = payload.work_date;
  if (!targetDate) {
    throw createError('work_date mới là bắt buộc khi sao chép lịch.', 400);
  }

  const originalStart = new Date(schedule.shift_start);
  const originalEnd = new Date(schedule.shift_end);
  const baseDate = new Date(targetDate);
  const shiftStart = new Date(baseDate);
  shiftStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), 0);
  const shiftEnd = new Date(baseDate);
  shiftEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), originalEnd.getSeconds(), 0);

  return createDoctorSchedule(
    {
      doctor_id: payload.doctor_id || schedule.doctor_id,
      department_id: payload.department_id || schedule.department_id,
      work_date: baseDate,
      shift_start: shiftStart,
      shift_end: shiftEnd,
      slot_duration_minutes: payload.slot_duration_minutes || schedule.slot_duration_minutes,
      max_patients: payload.max_patients !== undefined ? payload.max_patients : schedule.max_patients,
      status: payload.status || 'draft',
    },
    actor,
    requestMeta,
  );
}

async function bulkCreateDoctorSchedules(payload = {}, actor, requestMeta = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    throw createError('items là mảng không rỗng.', 400);
  }

  const results = [];
  for (const item of items) {
    results.push(await createDoctorSchedule(item, actor, requestMeta));
  }

  return {
    created_count: results.length,
    items: results,
  };
}

async function bulkPublishDoctorSchedules(scheduleIds = [], actor, requestMeta = {}) {
  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    throw createError('schedule_ids là mảng không rỗng.', 400);
  }

  const items = [];
  for (const scheduleId of [...new Set(scheduleIds)]) {
    items.push(await publishDoctorSchedule(scheduleId, actor, requestMeta));
  }

  return {
    published_count: items.length,
    items,
  };
}

module.exports = {
  createDoctorSchedule,
  listDoctorSchedules,
  getDoctorScheduleDetail,
  updateDoctorSchedule,
  publishDoctorSchedule,
  cancelDoctorSchedule,
  completeDoctorSchedule,
  getAvailableSlots,
  blockScheduleSlot,
  reopenScheduleSlot,
  getBookedSlots,
  countScheduleAppointments,
  calculateScheduleSlots,
  validateScheduleConflict,
  validateDoctorBelongsToDepartment,
  validateScheduleTimeRange,
  validateScheduleBeforePublish,
  checkScheduleCanBeUpdated,
  checkScheduleCanBeCancelled,
  listSchedulesByDoctor,
  listSchedulesByDepartment,
  listSchedulesByDateRange,
  getDoctorCalendarView,
  getScheduleUtilization,
  duplicateDoctorSchedule,
  bulkCreateDoctorSchedules,
  bulkPublishDoctorSchedules,
  getDoctorScheduleSummary,
  checkDoctorHasFutureAppointmentsInSchedule,
};
