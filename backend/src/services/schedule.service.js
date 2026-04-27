const {
  Appointment,
  AuditLog,
  Department,
  DoctorSchedule,
  Patient,
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

async function buildScheduleDoctorMap(schedules = []) {
  const doctorIds = [...new Set(schedules.map((schedule) => String(schedule.doctor_id)).filter(Boolean))];

  if (doctorIds.length === 0) {
    return new Map();
  }

  const doctors = await User.find({ _id: { $in: doctorIds }, is_deleted: false })
    .select('full_name employee_code department_id')
    .lean();

  return new Map(doctors.map((doctor) => [String(doctor._id), doctor]));
}

async function buildScheduleDepartmentMap(schedules = []) {
  const departmentIds = [...new Set(schedules.map((schedule) => String(schedule.department_id)).filter(Boolean))];

  if (departmentIds.length === 0) {
    return new Map();
  }

  const departments = await Department.find({ _id: { $in: departmentIds }, is_deleted: false })
    .select('department_name department_code')
    .lean();

  return new Map(departments.map((department) => [String(department._id), department]));
}

function getScheduleSlotStats(schedule, bookedCount = 0) {
  const totalSlots = calculateScheduleSlots(schedule).length;
  const blockedSlots = (schedule.blocked_slots || []).length;
  const bookedSlots = Number(bookedCount || 0);
  const availableSlots = Math.max(totalSlots - bookedSlots - blockedSlots, 0);

  return {
    total_slots: totalSlots,
    booked_slots: bookedSlots,
    available_slots: availableSlots,
    blocked_slots: blockedSlots,
    utilization_rate: totalSlots > 0 ? Number(((bookedSlots / totalSlots) * 100).toFixed(2)) : 0,
  };
}

async function buildScheduleBookedCountMap(schedules = []) {
  const scheduleIds = schedules.map((schedule) => schedule._id).filter(Boolean);
  if (scheduleIds.length === 0) {
    return new Map();
  }

  const rows = await Appointment.aggregate([
    {
      $match: {
        doctor_schedule_id: { $in: scheduleIds },
        is_deleted: false,
        status: { $nin: ['cancelled', 'no_show'] },
      },
    },
    { $group: { _id: '$doctor_schedule_id', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), row.count]));
}

function getPublishStatus(schedule) {
  return ['active', 'published'].includes(schedule.status) ? 'visible' : 'hidden';
}

function formatDoctorSchedule(schedule, doctorMap = new Map(), departmentMap = new Map(), slotStats = null) {
  const doctor = doctorMap.get(String(schedule.doctor_id));
  const department = departmentMap.get(String(schedule.department_id));
  const stats = slotStats || getScheduleSlotStats(schedule);

  return {
    doctor_schedule_id: String(schedule._id),
    doctor_id: String(schedule.doctor_id),
    doctor_name: doctor?.full_name || null,
    doctor_code: doctor?.employee_code || null,
    department_id: String(schedule.department_id),
    department_name: department?.department_name || null,
    department_code: department?.department_code || null,
    work_date: schedule.work_date,
    shift_start: schedule.shift_start,
    shift_end: schedule.shift_end,
    slot_duration_minutes: schedule.slot_duration_minutes,
    max_patients: schedule.max_patients,
    blocked_slots_count: stats.blocked_slots,
    publish_status: getPublishStatus(schedule),
    slots_summary: stats,
    utilization_rate: stats.utilization_rate,
    status: schedule.status,
  };
}

async function formatDoctorSchedulesWithStats(schedules = []) {
  const [doctorMap, departmentMap, bookedCountMap] = await Promise.all([
    buildScheduleDoctorMap(schedules),
    buildScheduleDepartmentMap(schedules),
    buildScheduleBookedCountMap(schedules),
  ]);

  return schedules.map((schedule) => {
    const stats = getScheduleSlotStats(schedule, bookedCountMap.get(String(schedule._id)) || 0);
    return formatDoctorSchedule(schedule, doctorMap, departmentMap, stats);
  });
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
  const patientIds = [...new Set(items.map((item) => String(item.patient_id)).filter(Boolean))];
  const patients = patientIds.length
    ? await Patient.find({ _id: { $in: patientIds }, is_deleted: false }).select('patient_code full_name phone').lean()
    : [];
  const patientMap = new Map(patients.map((patient) => [String(patient._id), patient]));

  return {
    schedule_id: String(scheduleId),
    items: items.map((appointment) => {
      const patient = patientMap.get(String(appointment.patient_id));
      return {
        appointment_id: String(appointment._id),
        appointment_time: appointment.appointment_time,
        patient_id: String(appointment.patient_id),
        patient_code: patient?.patient_code || null,
        patient_name: patient?.full_name || null,
        patient_phone: patient?.phone || null,
        status: appointment.status,
        source: appointment.source,
      };
    }),
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

function parseScheduleSlotTime(value, schedule) {
  const text = String(value || '').trim();
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [hour, minute] = text.split(':').map(Number);
    const base = new Date(schedule.work_date || schedule.shift_start);
    base.setHours(hour, minute, 0, 0);
    return base;
  }
  return new Date(value);
}

function resolveSlotTimesFromPayload(schedule, payload = {}) {
  const theoreticalSlots = calculateScheduleSlots(schedule);
  const slotTimes = [];

  const rawSlotTimes = Array.isArray(payload.slot_times)
    ? payload.slot_times
    : payload.slot_time
      ? [payload.slot_time]
      : [];

  for (const rawSlotTime of rawSlotTimes) {
    const slotTime = parseScheduleSlotTime(rawSlotTime, schedule);
    if (!Number.isNaN(slotTime.getTime())) {
      slotTimes.push(slotTime);
    }
  }

  const rangeStartInput = payload.range_start || payload.from_time || payload.start_time;
  const rangeEndInput = payload.range_end || payload.to_time || payload.end_time;
  if (rangeStartInput && rangeEndInput) {
    const rangeStart = parseScheduleSlotTime(rangeStartInput, schedule);
    const rangeEnd = parseScheduleSlotTime(rangeEndInput, schedule);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart >= rangeEnd) {
      throw createError('Khoảng khung giờ không hợp lệ.', 400);
    }

    theoreticalSlots.forEach((slot) => {
      const slotTime = new Date(slot.slot_time);
      if (slotTime >= rangeStart && slotTime < rangeEnd) {
        slotTimes.push(slotTime);
      }
    });
  }

  const validSlotKeySet = new Set(theoreticalSlots.map((slot) => new Date(slot.slot_time).toISOString()));
  const uniqueSlotTimes = [...new Map(slotTimes.map((slotTime) => [slotTime.toISOString(), slotTime])).values()];
  const invalidSlotTimes = uniqueSlotTimes.filter((slotTime) => !validSlotKeySet.has(slotTime.toISOString()));

  if (invalidSlotTimes.length > 0) {
    throw createError('Có khung giờ không thuộc lịch làm việc này.', 404);
  }

  if (uniqueSlotTimes.length === 0) {
    throw createError('Cần truyền slot_time, slot_times hoặc khoảng thời gian cần xử lý.', 400);
  }

  return uniqueSlotTimes;
}

function getActiveAppointmentFilter(scheduleId) {
  return {
    doctor_schedule_id: scheduleId,
    is_deleted: false,
    status: { $in: ['booked', 'confirmed', 'checked_in', 'in_consultation'] },
  };
}

async function getScheduleActivityLog(scheduleId, query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = {
    target_type: 'doctor_schedule',
    target_id: scheduleId,
  };

  if (query.action) {
    filter.action = String(query.action);
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const actorIds = [...new Set(items.map((item) => String(item.actor_id || '')).filter(Boolean))];
  const actors = actorIds.length
    ? await User.find({ _id: { $in: actorIds }, is_deleted: false }).select('full_name username employee_code').lean()
    : [];
  const actorMap = new Map(actors.map((actor) => [String(actor._id), actor]));

  return {
    items: items.map((item) => {
      const actor = actorMap.get(String(item.actor_id));
      return {
        audit_log_id: String(item._id),
        action: item.action,
        actor_type: item.actor_type,
        actor_id: item.actor_id ? String(item.actor_id) : null,
        actor_name: actor?.full_name || actor?.username || (item.actor_type === 'system' ? 'Hệ thống' : null),
        actor_code: actor?.employee_code || null,
        status: item.status,
        message: item.message,
        metadata: item.metadata,
        ip_address: item.ip_address,
        user_agent: item.user_agent,
        created_at: item.created_at,
      };
    }),
    pagination: buildPagination(page, limit, total),
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
  if (query.status) {
    const statuses = String(query.status)
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean);
    filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  if (query.date_from || query.date_to) {
    filter.work_date = {};
    if (query.date_from) filter.work_date.$gte = getStartOfDay(query.date_from);
    if (query.date_to) filter.work_date.$lte = getEndOfDay(query.date_to);
  }

  const [items, total] = await Promise.all([
    DoctorSchedule.find(filter).sort({ work_date: 1, shift_start: 1 }).skip(skip).limit(limit).lean(),
    DoctorSchedule.countDocuments(filter),
  ]);
  const formattedItems = await formatDoctorSchedulesWithStats(items);

  return {
    items: formattedItems,
    pagination: buildPagination(page, limit, total),
  };
}

async function getDoctorScheduleDetail(scheduleId) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const [availableSlots, appointmentsCount, doctorMap, departmentMap] = await Promise.all([
    getAvailableSlots(schedule._id),
    countScheduleAppointments(schedule._id),
    buildScheduleDoctorMap([schedule]),
    buildScheduleDepartmentMap([schedule]),
  ]);
  const slotStats = {
    total_slots: availableSlots.items.length,
    available_slots: availableSlots.items.filter((item) => item.is_available).length,
    booked_slots: availableSlots.items.filter((item) => item.is_booked).length,
    blocked_slots: availableSlots.items.filter((item) => item.is_blocked).length,
    utilization_rate:
      availableSlots.items.length > 0
        ? Number(((availableSlots.items.filter((item) => item.is_booked).length / availableSlots.items.length) * 100).toFixed(2))
        : 0,
  };

  return {
    schedule: {
      ...formatDoctorSchedule(schedule, doctorMap, departmentMap, slotStats),
      blocked_slots: schedule.blocked_slots || [],
    },
    appointments_count: appointmentsCount,
    slots_summary: slotStats,
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

async function batchBlockScheduleSlots(scheduleId, payload, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const slotTimes = resolveSlotTimesFromPayload(schedule, payload);
  const existingBlockedSet = new Set((schedule.blocked_slots || []).map((item) => new Date(item.slot_time).toISOString()));
  let changedCount = 0;

  for (const slotTime of slotTimes) {
    const key = slotTime.toISOString();
    if (!existingBlockedSet.has(key)) {
      schedule.blocked_slots.push({
        slot_time: slotTime,
        reason: payload.reason,
        blocked_by: actor.userId,
        blocked_at: new Date(),
      });
      changedCount += 1;
    }
  }

  if (changedCount > 0) {
    schedule.updated_by = actor.userId;
    await schedule.save();
  }

  await recordAuditLog({
    actor,
    action: 'schedule.batch_block_slots',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: `Chặn ${changedCount} khung giờ lịch làm việc thành công.`,
    requestMeta,
    metadata: {
      slot_times: slotTimes.map((slotTime) => slotTime.toISOString()),
      changed_count: changedCount,
      reason: payload.reason,
    },
  });

  return {
    changed_count: changedCount,
    slots: await getAvailableSlots(schedule._id),
  };
}

async function batchReopenScheduleSlots(scheduleId, payload, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const slotTimes = resolveSlotTimesFromPayload(schedule, payload);
  const reopenSet = new Set(slotTimes.map((slotTime) => slotTime.toISOString()));
  const beforeCount = (schedule.blocked_slots || []).length;

  schedule.blocked_slots = (schedule.blocked_slots || []).filter(
    (item) => !reopenSet.has(new Date(item.slot_time).toISOString()),
  );
  const changedCount = beforeCount - schedule.blocked_slots.length;

  if (changedCount > 0) {
    schedule.updated_by = actor.userId;
    await schedule.save();
  }

  await recordAuditLog({
    actor,
    action: 'schedule.batch_reopen_slots',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: `Mở lại ${changedCount} khung giờ lịch làm việc thành công.`,
    requestMeta,
    metadata: {
      slot_times: slotTimes.map((slotTime) => slotTime.toISOString()),
      changed_count: changedCount,
    },
  });

  return {
    changed_count: changedCount,
    slots: await getAvailableSlots(schedule._id),
  };
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

function resolveSummaryDateRange(query = {}) {
  const now = new Date();
  if (query.date_from || query.date_to) {
    return {
      dateFrom: getStartOfDay(query.date_from || now),
      dateTo: getEndOfDay(query.date_to || query.date_from || now),
    };
  }

  const preset = String(query.preset || 'week').toLowerCase();
  if (preset === 'today' || preset === 'day') {
    return { dateFrom: getStartOfDay(now), dateTo: getEndOfDay(now) };
  }
  if (preset === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { dateFrom: getStartOfDay(firstDay), dateTo: getEndOfDay(lastDay) };
  }

  const dateTo = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { dateFrom: getStartOfDay(now), dateTo: getEndOfDay(dateTo) };
}

function createScheduleSummaryBucket(id, label) {
  return {
    id,
    label,
    schedules_count: 0,
    total_slots: 0,
    booked_slots: 0,
    available_slots: 0,
    blocked_slots: 0,
    utilization_rate: 0,
  };
}

function addScheduleToBucket(bucket, schedule) {
  const stats = schedule.slots_summary || {};
  bucket.schedules_count += 1;
  bucket.total_slots += Number(stats.total_slots || 0);
  bucket.booked_slots += Number(stats.booked_slots || 0);
  bucket.available_slots += Number(stats.available_slots || 0);
  bucket.blocked_slots += Number(stats.blocked_slots || 0);
  bucket.utilization_rate =
    bucket.total_slots > 0 ? Number(((bucket.booked_slots / bucket.total_slots) * 100).toFixed(2)) : 0;
}

function buildSummaryGroups(items = [], keyGetter, labelGetter) {
  const map = new Map();
  for (const item of items) {
    const id = keyGetter(item) || 'unknown';
    if (!map.has(id)) {
      map.set(id, createScheduleSummaryBucket(id, labelGetter(item) || 'Chưa xác định'));
    }
    addScheduleToBucket(map.get(id), item);
  }
  return [...map.values()].sort((first, second) => second.utilization_rate - first.utilization_rate);
}

function buildUtilizationSeries(items = []) {
  const map = new Map();
  for (const item of items) {
    const date = new Date(item.work_date);
    const key = date.toISOString().slice(0, 10);
    if (!map.has(key)) {
      map.set(key, createScheduleSummaryBucket(key, key));
    }
    addScheduleToBucket(map.get(key), item);
  }

  return [...map.values()]
    .sort((first, second) => new Date(first.id) - new Date(second.id))
    .map((item) => ({
      date: item.id,
      label: new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(new Date(item.id)),
      value: item.utilization_rate,
      total_slots: item.total_slots,
      booked_slots: item.booked_slots,
    }));
}

function buildOperationAlerts(items = []) {
  const alerts = [];
  const unpublished = items.filter((item) => !['active', 'published'].includes(item.status));
  const lowUtilization = items.filter((item) => Number(item.utilization_rate || 0) <= 35 && item.status !== 'cancelled');
  const fullSchedules = items.filter((item) => Number(item.utilization_rate || 0) >= 95);
  const heavyBlocked = items.filter((item) => Number(item.slots_summary?.blocked_slots || 0) >= 3);

  if (unpublished.length > 0) {
    alerts.push({
      type: 'unpublished',
      tone: 'warning',
      title: `${unpublished.length} lịch chưa công khai`,
      body: 'Cần duyệt trước khi cổng bệnh nhân hiển thị.',
      count: unpublished.length,
    });
  }
  if (lowUtilization.length > 0) {
    alerts.push({
      type: 'low_utilization',
      tone: 'info',
      title: `${lowUtilization.length} lịch có tỷ lệ lấp đầy thấp`,
      body: 'Nên điều phối thêm lượt đặt hoặc cân nhắc giảm lịch.',
      count: lowUtilization.length,
    });
  }
  if (fullSchedules.length > 0) {
    alerts.push({
      type: 'full_schedule',
      tone: 'danger',
      title: `${fullSchedules.length} lịch đã gần hoặc đã kín`,
      body: 'Cần cân nhắc mở thêm lịch hoặc tăng sức chứa.',
      count: fullSchedules.length,
    });
  }
  if (heavyBlocked.length > 0) {
    alerts.push({
      type: 'blocked_slots',
      tone: 'warning',
      title: `${heavyBlocked.length} lịch có nhiều khung giờ bị khóa`,
      body: 'Kiểm tra lý do khóa để tránh mất công suất khám.',
      count: heavyBlocked.length,
    });
  }

  return alerts;
}

async function getSchedulingSystemSummary(query = {}) {
  const { dateFrom, dateTo } = resolveSummaryDateRange(query);
  const filter = {
    is_deleted: false,
    work_date: { $gte: dateFrom, $lte: dateTo },
  };

  if (query.department_id) filter.department_id = query.department_id;
  if (query.doctor_id) filter.doctor_id = query.doctor_id;

  const schedules = await DoctorSchedule.find(filter).sort({ work_date: 1, shift_start: 1 }).lean();
  const items = await formatDoctorSchedulesWithStats(schedules);
  const todayStart = getStartOfDay(new Date());
  const todayEnd = getEndOfDay(new Date());
  const overview = createScheduleSummaryBucket('system', 'Toàn hệ thống');

  items.forEach((item) => addScheduleToBucket(overview, item));
  overview.unpublished_schedules = items.filter((item) => !['active', 'published'].includes(item.status)).length;
  overview.cancelled_schedules = items.filter((item) => item.status === 'cancelled').length;
  overview.today_schedules = items.filter((item) => {
    const workDate = new Date(item.work_date);
    return workDate >= todayStart && workDate <= todayEnd;
  }).length;

  return {
    range: {
      date_from: dateFrom,
      date_to: dateTo,
    },
    overview,
    items,
    today_schedules: items.filter((item) => {
      const workDate = new Date(item.work_date);
      return workDate >= todayStart && workDate <= todayEnd;
    }),
    publish_queue: items.filter((item) => !['active', 'published'].includes(item.status)).slice(0, 10),
    by_department: buildSummaryGroups(items, (item) => item.department_id, (item) => item.department_name),
    by_doctor: buildSummaryGroups(items, (item) => item.doctor_id, (item) => item.doctor_name),
    utilization_series: buildUtilizationSeries(items),
    operation_alerts: buildOperationAlerts(items),
  };
}

async function getScheduleSummaryByDepartment(query = {}) {
  const summary = await getSchedulingSystemSummary(query);
  return {
    range: summary.range,
    items: summary.by_department,
  };
}

async function getScheduleSummaryByDateRange(query = {}) {
  const summary = await getSchedulingSystemSummary(query);
  return {
    range: summary.range,
    overview: summary.overview,
    utilization_series: summary.utilization_series,
    items: summary.items,
  };
}

async function getMyTodaySchedule(actor, query = {}) {
  if (!actor?.userId) {
    throw createError('Không xác định được tài khoản bác sĩ.', 401);
  }
  const today = new Date();
  return listSchedulesByDoctor(actor.userId, {
    ...query,
    date_from: getStartOfDay(today),
    date_to: getEndOfDay(today),
    limit: query.limit || 100,
  });
}

async function getMyWeekSchedule(actor, query = {}) {
  if (!actor?.userId) {
    throw createError('Không xác định được tài khoản bác sĩ.', 401);
  }
  const start = getStartOfDay(new Date());
  const end = getEndOfDay(new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000));
  return listSchedulesByDoctor(actor.userId, {
    ...query,
    date_from: query.date_from || start,
    date_to: query.date_to || end,
    limit: query.limit || 100,
  });
}

async function previewRescheduleImpact(scheduleId, payload = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const mergedPayload = {
    work_date: payload.work_date || schedule.work_date,
    shift_start: payload.shift_start || schedule.shift_start,
    shift_end: payload.shift_end || schedule.shift_end,
    slot_duration_minutes: payload.slot_duration_minutes || schedule.slot_duration_minutes,
  };
  const normalized = validateScheduleTimeRange(mergedPayload);
  const proposedSchedule = {
    ...schedule,
    work_date: normalized.workDate,
    shift_start: normalized.shiftStart,
    shift_end: normalized.shiftEnd,
    slot_duration_minutes: normalized.slotDuration,
  };
  const proposedSlots = calculateScheduleSlots(proposedSchedule);
  const proposedSlotSet = new Set(proposedSlots.map((slot) => new Date(slot.slot_time).toISOString()));
  const appointments = await Appointment.find(getActiveAppointmentFilter(schedule._id)).sort({ appointment_time: 1 }).lean();

  const impactedAppointments = appointments
    .map((appointment) => {
      const appointmentTime = new Date(appointment.appointment_time);
      const isOutOfRange = appointmentTime < normalized.shiftStart || appointmentTime >= normalized.shiftEnd;
      const isMissingSlot = !proposedSlotSet.has(appointmentTime.toISOString());
      if (!isOutOfRange && !isMissingSlot) {
        return null;
      }

      return {
        appointment_id: String(appointment._id),
        patient_id: String(appointment.patient_id),
        appointment_time: appointment.appointment_time,
        status: appointment.status,
        reason: isOutOfRange ? 'Nằm ngoài khung giờ mới' : 'Không còn khớp khung giờ mới',
      };
    })
    .filter(Boolean);

  const affectedBlockedSlots = (schedule.blocked_slots || []).filter(
    (slot) => !proposedSlotSet.has(new Date(slot.slot_time).toISOString()),
  );

  return {
    schedule_id: String(schedule._id),
    can_update_without_impact: impactedAppointments.length === 0,
    current: {
      work_date: schedule.work_date,
      shift_start: schedule.shift_start,
      shift_end: schedule.shift_end,
      slot_duration_minutes: schedule.slot_duration_minutes,
      total_slots: calculateScheduleSlots(schedule).length,
    },
    proposed: {
      work_date: normalized.workDate,
      shift_start: normalized.shiftStart,
      shift_end: normalized.shiftEnd,
      slot_duration_minutes: normalized.slotDuration,
      total_slots: proposedSlots.length,
    },
    appointments_count: appointments.length,
    impacted_appointments_count: impactedAppointments.length,
    impacted_appointments: impactedAppointments,
    affected_blocked_slots_count: affectedBlockedSlots.length,
    affected_blocked_slots: affectedBlockedSlots,
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
  getScheduleActivityLog,
  listSchedulesByDoctor,
  listSchedulesByDepartment,
  listSchedulesByDateRange,
  getDoctorCalendarView,
  getScheduleUtilization,
  duplicateDoctorSchedule,
  bulkCreateDoctorSchedules,
  bulkPublishDoctorSchedules,
  batchBlockScheduleSlots,
  batchReopenScheduleSlots,
  getDoctorScheduleSummary,
  getSchedulingSystemSummary,
  getScheduleSummaryByDepartment,
  getScheduleSummaryByDateRange,
  getMyTodaySchedule,
  getMyWeekSchedule,
  previewRescheduleImpact,
  checkDoctorHasFutureAppointmentsInSchedule,
};
