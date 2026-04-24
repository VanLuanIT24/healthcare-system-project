const {
  Appointment,
  Department,
  DoctorSchedule,
  Encounter,
  Patient,
  QueueTicket,
  User,
} = require('../models');
const patientService = require('./patient.service');
const {
  buildPagination,
  createError,
  generateCode,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const { AuditLog } = require('../models');
const scheduleService = require('./schedule.service');

const ACTIVE_APPOINTMENT_STATUSES = ['booked', 'confirmed', 'checked_in', 'in_consultation'];
const APPOINTMENT_STATUS_TRANSITIONS = {
  booked: ['confirmed', 'cancelled', 'rescheduled', 'checked_in'],
  confirmed: ['checked_in', 'cancelled', 'rescheduled', 'no_show', 'completed'],
  checked_in: ['in_consultation', 'completed', 'cancelled'],
  in_consultation: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
  rescheduled: [],
};

function validateAppointmentTime(appointmentTime) {
  const date = new Date(appointmentTime);
  if (Number.isNaN(date.getTime())) {
    throw createError('appointment_time không hợp lệ.');
  }
  if (date < new Date()) {
    throw createError('Không thể đặt lịch trong quá khứ.');
  }
  return date;
}

function validateAppointmentStatusTransition(currentStatus, nextStatus) {
  const allowed = APPOINTMENT_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw createError(`Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}.`, 409);
  }
  return true;
}

async function checkDoctorAvailability({ doctor_id, department_id, appointment_time, doctor_schedule_id = null }) {
  const appointmentTime = new Date(appointment_time);
  let schedule = null;

  if (doctor_schedule_id) {
    schedule = await DoctorSchedule.findById(doctor_schedule_id).lean();
    if (
      schedule &&
      (String(schedule.doctor_id) !== String(doctor_id) || String(schedule.department_id) !== String(department_id))
    ) {
      throw createError('doctor_schedule_id không khớp với bác sĩ hoặc department đã chọn.', 409);
    }
  } else {
    schedule = await DoctorSchedule.findOne({
      doctor_id,
      department_id,
      is_deleted: false,
      status: { $in: ['published', 'active'] },
      shift_start: { $lte: appointmentTime },
      shift_end: { $gt: appointmentTime },
    }).lean();
  }

  if (!schedule) {
    throw createError('Bác sĩ không có lịch làm việc ở thời điểm được chọn.', 409);
  }

  if (!['published', 'active'].includes(schedule.status)) {
    throw createError('Lịch làm việc chưa được mở để đặt khám.', 409);
  }

  return schedule;
}

async function validateAppointmentSlot({ doctor_id, department_id, appointment_time, doctor_schedule_id = null, excludeAppointmentId = null }) {
  const schedule = await checkDoctorAvailability({ doctor_id, department_id, appointment_time, doctor_schedule_id });
  const slotTime = new Date(appointment_time);

  const availableSlots = await scheduleService.getAvailableSlots(schedule._id);
  const matchedSlot = availableSlots.items.find((slot) => new Date(slot.slot_time).getTime() === slotTime.getTime());
  if (!matchedSlot) {
    throw createError('Thời gian đặt không khớp với slot của lịch làm việc.', 409);
  }

  if (matchedSlot.is_blocked) {
    throw createError('Slot này đang bị khóa, không thể đặt lịch.', 409);
  }

  const duplicateFilter = {
    doctor_id,
    appointment_time: slotTime,
    is_deleted: false,
    status: { $nin: ['cancelled', 'no_show', 'rescheduled'] },
  };
  if (excludeAppointmentId) {
    duplicateFilter._id = { $ne: excludeAppointmentId };
  }

  const duplicate = await Appointment.findOne(duplicateFilter).lean();
  if (duplicate) {
    throw createError('Slot này đã được đặt.', 409);
  }

  return schedule;
}

async function checkPatientDuplicateBooking({ patient_id, appointment_time, excludeAppointmentId = null }) {
  const appointmentTime = new Date(appointment_time);
  const rangeStart = new Date(appointmentTime.getTime() - 30 * 60 * 1000);
  const rangeEnd = new Date(appointmentTime.getTime() + 30 * 60 * 1000);
  const filter = {
    patient_id,
    appointment_time: { $gte: rangeStart, $lte: rangeEnd },
    is_deleted: false,
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
  };

  if (excludeAppointmentId) {
    filter._id = { $ne: excludeAppointmentId };
  }

  const existing = await Appointment.findOne(filter).lean();

  return {
    patient_id: String(patient_id),
    has_duplicate: Boolean(existing),
    appointment: existing || null,
  };
}

async function checkAppointmentConflictForDoctor(payload = {}) {
  try {
    const schedule = await validateAppointmentSlot(payload);
    return {
      has_conflict: false,
      schedule_id: String(schedule._id),
    };
  } catch (error) {
    if (error.statusCode === 409) {
      return {
        has_conflict: true,
        message: error.message,
      };
    }
    throw error;
  }
}

async function checkAppointmentConflictForPatient(payload = {}) {
  const duplicate = await checkPatientDuplicateBooking(payload);
  return {
    has_conflict: duplicate.has_duplicate,
    appointment: duplicate.appointment,
  };
}

function calculateAppointmentSource(payload = {}, actor = null) {
  if (payload.source) {
    return normalizeString(payload.source);
  }
  if (!actor) {
    return 'system';
  }
  return actor.actorType === 'patient' ? 'patient_portal' : 'staff';
}

async function buildAppointmentReferenceMaps(appointments = []) {
  const doctorIds = [...new Set(appointments.map((item) => String(item.doctor_id)).filter(Boolean))];
  const departmentIds = [...new Set(appointments.map((item) => String(item.department_id)).filter(Boolean))];

  const [doctors, departments] = await Promise.all([
    doctorIds.length
      ? User.find({ _id: { $in: doctorIds }, is_deleted: false }).select('full_name employee_code').lean()
      : [],
    departmentIds.length
      ? Department.find({ _id: { $in: departmentIds }, is_deleted: false })
          .select('department_name department_code')
          .lean()
      : [],
  ]);

  return {
    doctorMap: new Map(doctors.map((doctor) => [String(doctor._id), doctor])),
    departmentMap: new Map(departments.map((department) => [String(department._id), department])),
  };
}

async function ensurePatientAndDoctor(payload) {
  const [patient, doctor, department] = await Promise.all([
    Patient.findById(payload.patient_id).lean(),
    User.findById(payload.doctor_id).lean(),
    Department.findById(payload.department_id).lean(),
  ]);

  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (patient.status !== 'active') throw createError('Bệnh nhân hiện không ở trạng thái được phép đặt lịch.', 409);
  if (!doctor || doctor.is_deleted || doctor.status !== 'active') throw createError('Không tìm thấy bác sĩ khả dụng.', 404);
  if (!department || department.is_deleted || department.status !== 'active') throw createError('Department không khả dụng.', 404);

  return { patient, doctor, department };
}

async function createAppointment(payload, actor, requestMeta = {}) {
  const appointmentTime = validateAppointmentTime(payload.appointment_time);
  await patientService.checkPatientCanBookAppointment(payload.patient_id);
  await ensurePatientAndDoctor(payload);
  const schedule = await validateAppointmentSlot({
    doctor_id: payload.doctor_id,
    department_id: payload.department_id,
    appointment_time: appointmentTime,
    doctor_schedule_id: payload.doctor_schedule_id,
  });

  const duplicateCheck = await checkPatientDuplicateBooking({
    patient_id: payload.patient_id,
    appointment_time: appointmentTime,
  });
  if (duplicateCheck.has_duplicate) {
    throw createError('Bệnh nhân đang có lịch hẹn trùng hoặc quá gần khung giờ này.', 409);
  }

  const appointment = await Appointment.create({
    patient_id: payload.patient_id,
    doctor_id: payload.doctor_id,
    department_id: payload.department_id,
    doctor_schedule_id: schedule._id,
    appointment_time: appointmentTime,
    appointment_type: payload.appointment_type || 'outpatient',
    reason: payload.reason,
    source: calculateAppointmentSource(payload, actor),
    status: payload.status || 'booked',
    notes: payload.notes,
    created_by: actor?.userId,
  });

  await recordAuditLog({
    actor,
    action: 'appointment.create',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Tạo lịch hẹn thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointment._id);
}

async function createAppointmentFromPatientPortal(payload, actor, requestMeta = {}) {
  if (actor.actorType !== 'patient') {
    throw createError('Chỉ bệnh nhân mới được dùng luồng tự đặt lịch.', 403);
  }

  return createAppointment(
    {
      ...payload,
      patient_id: actor.patientId,
      source: 'patient_portal',
    },
    actor,
    requestMeta,
  );
}

async function createAppointmentByStaff(payload, actor, requestMeta = {}) {
  return createAppointment(
    {
      ...payload,
      source: payload.source || 'staff',
    },
    actor,
    requestMeta,
  );
}

async function listAppointments(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };

  if (query.patient_id) filter.patient_id = query.patient_id;
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.status) filter.status = query.status;
  if (query.date) {
    filter.appointment_time = { $gte: getStartOfDay(query.date), $lte: getEndOfDay(query.date) };
  }
  if (query.date_from || query.date_to) {
    filter.appointment_time = filter.appointment_time || {};
    if (query.date_from) filter.appointment_time.$gte = getStartOfDay(query.date_from);
    if (query.date_to) filter.appointment_time.$lte = getEndOfDay(query.date_to);
  }

  const [items, total] = await Promise.all([
    Appointment.find(filter).sort({ appointment_time: -1 }).skip(skip).limit(limit).lean(),
    Appointment.countDocuments(filter),
  ]);
  const { doctorMap, departmentMap } = await buildAppointmentReferenceMaps(items);

  return {
    items: items.map((item) => {
      const doctor = doctorMap.get(String(item.doctor_id));
      const department = departmentMap.get(String(item.department_id));

      return {
        appointment_id: String(item._id),
        patient_id: String(item.patient_id),
        doctor_id: String(item.doctor_id),
        doctor_name: doctor?.full_name || null,
        doctor_code: doctor?.employee_code || null,
        department_id: String(item.department_id),
        department_name: department?.department_name || null,
        department_code: department?.department_code || null,
        doctor_schedule_id: item.doctor_schedule_id ? String(item.doctor_schedule_id) : null,
        appointment_time: item.appointment_time,
        appointment_type: item.appointment_type,
        source: item.source,
        status: item.status,
        reason: item.reason,
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

async function searchAppointments(query = {}) {
  return listAppointments(query);
}

async function getAppointmentDetail(appointmentId) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) {
    throw createError('Không tìm thấy lịch hẹn.', 404);
  }

  const [queueTicket, encounter] = await Promise.all([
    QueueTicket.findOne({ appointment_id: appointment._id }).lean(),
    Encounter.findOne({ appointment_id: appointment._id }).lean(),
  ]);

  return {
    appointment: {
      appointment_id: String(appointment._id),
      patient_id: String(appointment.patient_id),
      doctor_id: String(appointment.doctor_id),
      department_id: String(appointment.department_id),
      doctor_schedule_id: appointment.doctor_schedule_id ? String(appointment.doctor_schedule_id) : null,
      appointment_time: appointment.appointment_time,
      appointment_type: appointment.appointment_type,
      reason: appointment.reason,
      source: appointment.source,
      status: appointment.status,
      notes: appointment.notes,
      created_at: appointment.created_at,
    },
    queue_ticket: queueTicket
      ? {
          queue_ticket_id: String(queueTicket._id),
          queue_number: queueTicket.queue_number,
          status: queueTicket.status,
          checkin_time: queueTicket.checkin_time,
        }
      : null,
    encounter: encounter
      ? {
          encounter_id: String(encounter._id),
          encounter_code: encounter.encounter_code,
          status: encounter.status,
          start_time: encounter.start_time,
        }
      : null,
  };
}

async function checkAppointmentCanBeUpdated(appointmentId) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  return {
    appointment_id: String(appointment._id),
    can_update: ['booked', 'confirmed'].includes(appointment.status),
    status: appointment.status,
  };
}

async function checkAppointmentCanBeCancelled(appointmentId) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  return {
    appointment_id: String(appointment._id),
    can_cancel: ['booked', 'confirmed'].includes(appointment.status),
    status: appointment.status,
  };
}

async function checkAppointmentCanBeRescheduled(appointmentId) {
  return checkAppointmentCanBeUpdated(appointmentId);
}

async function checkAppointmentCanBeCheckedIn(appointmentId) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  return {
    appointment_id: String(appointment._id),
    can_checkin: ['booked', 'confirmed'].includes(appointment.status),
    status: appointment.status,
  };
}

async function updateAppointment(appointmentId, payload, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) {
    throw createError('Không tìm thấy lịch hẹn.', 404);
  }

  const updateCheck = await checkAppointmentCanBeUpdated(appointment._id);
  if (!updateCheck.can_update) {
    throw createError('Lịch hẹn hiện không cho phép cập nhật.', 409);
  }

  const nextTime = payload.appointment_time ? validateAppointmentTime(payload.appointment_time) : appointment.appointment_time;
  const nextDoctorId = payload.doctor_id || appointment.doctor_id;
  const nextDepartmentId = payload.department_id || appointment.department_id;
  const nextScheduleId = payload.doctor_schedule_id || appointment.doctor_schedule_id;

  if (payload.appointment_time || payload.doctor_id || payload.department_id || payload.doctor_schedule_id) {
    await validateAppointmentSlot({
      doctor_id: nextDoctorId,
      department_id: nextDepartmentId,
      appointment_time: nextTime,
      doctor_schedule_id: nextScheduleId,
      excludeAppointmentId: appointment._id,
    });
  }

  appointment.doctor_id = nextDoctorId;
  appointment.department_id = nextDepartmentId;
  appointment.doctor_schedule_id = nextScheduleId;
  appointment.appointment_time = nextTime;
  appointment.appointment_type = payload.appointment_type || appointment.appointment_type;
  appointment.reason = payload.reason !== undefined ? payload.reason : appointment.reason;
  appointment.notes = payload.notes !== undefined ? payload.notes : appointment.notes;
  appointment.updated_by = actor.userId;
  await appointment.save();

  await recordAuditLog({
    actor,
    action: 'appointment.update',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Cập nhật lịch hẹn thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointment._id);
}

async function confirmAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  validateAppointmentStatusTransition(appointment.status, 'confirmed');
  appointment.status = 'confirmed';
  appointment.updated_by = actor.userId;
  await appointment.save();

  await recordAuditLog({
    actor,
    action: 'appointment.confirm',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Xác nhận lịch hẹn thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointment._id);
}

async function cancelAppointment(appointmentId, payload = {}, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  const canCancel = await checkAppointmentCanBeCancelled(appointment._id);
  if (!canCancel.can_cancel) throw createError('Lịch hẹn hiện không thể hủy.', 409);

  validateAppointmentStatusTransition(appointment.status, 'cancelled');
  appointment.status = 'cancelled';
  appointment.notes = payload.reason ? `${appointment.notes || ''}\nLý do hủy: ${payload.reason}`.trim() : appointment.notes;
  appointment.updated_by = actor.userId;
  await appointment.save();

  await recordAuditLog({
    actor,
    action: 'appointment.cancel',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Hủy lịch hẹn thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointment._id);
}

async function rescheduleAppointment(appointmentId, payload, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);

  const canReschedule = await checkAppointmentCanBeRescheduled(appointment._id);
  if (!canReschedule.can_update) throw createError('Lịch hẹn hiện không thể đổi giờ.', 409);

  const nextTime = validateAppointmentTime(payload.appointment_time);
  const nextDoctorId = payload.doctor_id || appointment.doctor_id;
  const nextDepartmentId = payload.department_id || appointment.department_id;
  const nextScheduleId = payload.doctor_schedule_id || appointment.doctor_schedule_id;

  await validateAppointmentSlot({
    doctor_id: nextDoctorId,
    department_id: nextDepartmentId,
    appointment_time: nextTime,
    doctor_schedule_id: nextScheduleId,
    excludeAppointmentId: appointment._id,
  });

  appointment.doctor_id = nextDoctorId;
  appointment.department_id = nextDepartmentId;
  appointment.doctor_schedule_id = nextScheduleId;
  appointment.appointment_time = nextTime;
  appointment.status = 'confirmed';
  appointment.updated_by = actor.userId;
  await appointment.save();

  await recordAuditLog({
    actor,
    action: 'appointment.reschedule',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Đổi lịch hẹn thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointment._id);
}

async function createQueueTicketFromAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);

  const existing = await QueueTicket.findOne({ appointment_id: appointment._id }).lean();
  if (existing) {
    return { queue_ticket: existing, created: false };
  }

  const todayStart = getStartOfDay(appointment.appointment_time);
  const todayEnd = getEndOfDay(appointment.appointment_time);
  const sequence =
    (await QueueTicket.countDocuments({
      department_id: appointment.department_id,
      created_at: { $gte: todayStart, $lte: todayEnd },
    })) + 1;

  const queueTicket = await QueueTicket.create({
    patient_id: appointment.patient_id,
    appointment_id: appointment._id,
    doctor_id: appointment.doctor_id,
    department_id: appointment.department_id,
    queue_number: `Q${String(sequence).padStart(3, '0')}`,
    queue_type: 'normal',
    status: 'waiting',
    checkin_time: new Date(),
    created_by: actor?.userId,
  });

  await recordAuditLog({
    actor,
    action: 'appointment.queue_ticket.create',
    targetType: 'queue_ticket',
    targetId: queueTicket._id,
    status: 'success',
    message: 'Sinh phiếu hàng đợi từ lịch hẹn thành công.',
    requestMeta,
  });

  return { queue_ticket: queueTicket, created: true };
}

async function createEncounterFromAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);

  const existing = await Encounter.findOne({ appointment_id: appointment._id }).lean();
  if (existing) {
    return { encounter: existing, created: false };
  }

  const encounter = await Encounter.create({
    patient_id: appointment.patient_id,
    appointment_id: appointment._id,
    department_id: appointment.department_id,
    attending_doctor_id: appointment.doctor_id,
    encounter_code: generateCode('ENC'),
    encounter_type: appointment.appointment_type === 'telemedicine' ? 'telemedicine' : 'outpatient',
    start_time: new Date(),
    chief_reason: appointment.reason,
    status: 'arrived',
    created_by: actor?.userId,
  });

  await recordAuditLog({
    actor,
    action: 'appointment.encounter.create',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Sinh encounter từ lịch hẹn thành công.',
    requestMeta,
  });

  return { encounter, created: true };
}

async function linkAppointmentToEncounter(appointmentId, encounterId, actor, requestMeta = {}) {
  const [appointment, encounter] = await Promise.all([Appointment.findById(appointmentId), Encounter.findById(encounterId)]);

  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);

  encounter.appointment_id = appointment._id;
  encounter.updated_by = actor?.userId;
  await encounter.save();

  await QueueTicket.updateMany({ appointment_id: appointment._id, encounter_id: null }, { $set: { encounter_id: encounter._id } });

  await recordAuditLog({
    actor,
    action: 'appointment.encounter.link',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Liên kết appointment với encounter thành công.',
    requestMeta,
    metadata: { encounter_id: encounterId },
  });

  return getAppointmentDetail(appointment._id);
}

async function checkInAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);

  const canCheckIn = await checkAppointmentCanBeCheckedIn(appointment._id);
  if (!canCheckIn.can_checkin) throw createError('Lịch hẹn hiện không thể check-in.', 409);

  appointment.status = 'checked_in';
  appointment.updated_by = actor.userId;
  await appointment.save();

  await createQueueTicketFromAppointment(appointment._id, actor, requestMeta);

  await recordAuditLog({
    actor,
    action: 'appointment.checkin',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Check-in lịch hẹn thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointment._id);
}

async function markAppointmentNoShow(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);

  validateAppointmentStatusTransition(appointment.status, 'no_show');
  appointment.status = 'no_show';
  appointment.updated_by = actor.userId;
  await appointment.save();

  await recordAuditLog({
    actor,
    action: 'appointment.no_show',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Đánh dấu no-show thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointment._id);
}

async function completeAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);

  if (!['confirmed', 'checked_in', 'in_consultation'].includes(appointment.status)) {
    throw createError('Lịch hẹn hiện không thể hoàn tất.', 409);
  }

  appointment.status = 'completed';
  appointment.updated_by = actor.userId;
  await appointment.save();

  await recordAuditLog({
    actor,
    action: 'appointment.complete',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Hoàn tất lịch hẹn thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointment._id);
}

async function listAppointmentsByPatient(patientId, query = {}) {
  return listAppointments({ ...query, patient_id: patientId });
}

async function listAppointmentsByDoctor(doctorId, query = {}) {
  return listAppointments({ ...query, doctor_id: doctorId });
}

async function listAppointmentsByDepartment(departmentId, query = {}) {
  return listAppointments({ ...query, department_id: departmentId });
}

async function listAppointmentsByDate(date, query = {}) {
  return listAppointments({ ...query, date });
}

async function listUpcomingAppointments(query = {}) {
  return listAppointments({ ...query, date_from: new Date().toISOString() });
}

async function listTodayAppointments(query = {}) {
  return listAppointments({ ...query, date: new Date().toISOString() });
}

async function getMyAppointments(auth, query = {}) {
  if (auth.actorType !== 'patient') {
    throw createError('Chỉ bệnh nhân mới dùng được chức năng này.', 403);
  }
  return listAppointments({ ...query, patient_id: auth.patientId });
}

async function autoConfirmAppointment() {
  return { applied: false, message: 'MVP hiện chưa bật auto-confirm riêng, bạn có thể gọi confirmAppointment sau khi tạo.' };
}

async function sendAppointmentConfirmation() {
  return { delivered: false, message: 'MVP hiện chưa tích hợp kênh gửi xác nhận lịch hẹn.' };
}

async function sendAppointmentReminder() {
  return { delivered: false, message: 'MVP hiện chưa tích hợp kênh gửi nhắc lịch hẹn.' };
}

async function cancelAppointmentsBySchedule(scheduleId, actor, requestMeta = {}) {
  const appointments = await Appointment.find({
    doctor_schedule_id: scheduleId,
    is_deleted: false,
    status: { $in: ['booked', 'confirmed'] },
  });

  const ids = [];
  for (const appointment of appointments) {
    appointment.status = 'cancelled';
    appointment.updated_by = actor?.userId;
    await appointment.save();
    ids.push(String(appointment._id));
  }

  await recordAuditLog({
    actor,
    action: 'appointment.cancel_by_schedule',
    targetType: 'doctor_schedule',
    targetId: scheduleId,
    status: 'success',
    message: 'Hủy hàng loạt lịch hẹn theo lịch làm việc thành công.',
    requestMeta,
    metadata: { appointment_ids: ids },
  });

  return { cancelled_count: ids.length, appointment_ids: ids };
}

async function rescheduleAppointmentsByScheduleChange() {
  throw createError('Tự động đổi lịch theo thay đổi schedule sẽ làm ở phase sau.', 501);
}

async function getAppointmentSummary(query = {}) {
  const filter = { is_deleted: false };
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.patient_id) filter.patient_id = query.patient_id;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.date) {
    filter.appointment_time = { $gte: getStartOfDay(query.date), $lte: getEndOfDay(query.date) };
  }

  const items = await Appointment.find(filter).lean();
  const summarize = (status) => items.filter((item) => item.status === status).length;

  return {
    total: items.length,
    booked: summarize('booked'),
    confirmed: summarize('confirmed'),
    checked_in: summarize('checked_in'),
    in_consultation: summarize('in_consultation'),
    completed: summarize('completed'),
    cancelled: summarize('cancelled'),
    no_show: summarize('no_show'),
    rescheduled: summarize('rescheduled'),
  };
}

async function bulkConfirmAppointments(appointmentIds = [], actor, requestMeta = {}) {
  if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
    throw createError('appointment_ids là mảng không rỗng.', 400);
  }

  const items = [];
  for (const appointmentId of [...new Set(appointmentIds)]) {
    items.push(await confirmAppointment(appointmentId, actor, requestMeta));
  }

  return {
    confirmed_count: items.length,
    items,
  };
}

async function bulkCancelAppointments(appointmentIds = [], payload = {}, actor, requestMeta = {}) {
  if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
    throw createError('appointment_ids là mảng không rỗng.', 400);
  }

  const items = [];
  for (const appointmentId of [...new Set(appointmentIds)]) {
    items.push(await cancelAppointment(appointmentId, payload, actor, requestMeta));
  }

  return {
    cancelled_count: items.length,
    items,
  };
}

async function getAppointmentTimeline(appointmentId, query = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) {
    throw createError('Không tìm thấy lịch hẹn.', 404);
  }

  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 300);
  const items = await AuditLog.find({
    $or: [
      { target_type: 'appointment', target_id: appointment._id },
      { target_type: 'queue_ticket', metadata: { $exists: true } },
    ],
  })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();

  return {
    appointment_id: String(appointment._id),
    items,
  };
}

module.exports = {
  createAppointment,
  listAppointments,
  searchAppointments,
  getAppointmentDetail,
  updateAppointment,
  confirmAppointment,
  cancelAppointment,
  rescheduleAppointment,
  checkInAppointment,
  markAppointmentNoShow,
  completeAppointment,
  validateAppointmentSlot,
  checkDoctorAvailability,
  checkPatientDuplicateBooking,
  calculateAppointmentSource,
  validateAppointmentTime,
  validateAppointmentStatusTransition,
  checkAppointmentCanBeUpdated,
  checkAppointmentCanBeCancelled,
  checkAppointmentCanBeRescheduled,
  checkAppointmentCanBeCheckedIn,
  listAppointmentsByPatient,
  listAppointmentsByDoctor,
  listAppointmentsByDepartment,
  listAppointmentsByDate,
  listUpcomingAppointments,
  listTodayAppointments,
  getMyAppointments,
  createAppointmentFromPatientPortal,
  createAppointmentByStaff,
  autoConfirmAppointment,
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  cancelAppointmentsBySchedule,
  rescheduleAppointmentsByScheduleChange,
  getAppointmentSummary,
  bulkConfirmAppointments,
  bulkCancelAppointments,
  getAppointmentTimeline,
  checkAppointmentConflictForDoctor,
  checkAppointmentConflictForPatient,
  createQueueTicketFromAppointment,
  createEncounterFromAppointment,
  linkAppointmentToEncounter,
};
