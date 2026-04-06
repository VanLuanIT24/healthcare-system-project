const {
  Appointment,
  Department,
  Patient,
  QueueTicket,
  User,
} = require('../models');
const {
  buildPagination,
  createError,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  recordAuditLog,
} = require('./core.service');
const { AuditLog, Encounter } = require('../models');

const ACTIVE_QUEUE_STATUSES = ['waiting', 'called', 'in_service', 'skipped', 'recalled'];
const QUEUE_STATUS_TRANSITIONS = {
  waiting: ['called', 'cancelled'],
  called: ['recalled', 'skipped', 'in_service', 'cancelled', 'completed'],
  recalled: ['in_service', 'skipped', 'cancelled', 'completed'],
  skipped: ['recalled', 'cancelled', 'completed'],
  in_service: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function validateQueueStatusTransition(currentStatus, nextStatus) {
  const allowed = QUEUE_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw createError(`Không thể chuyển trạng thái queue từ ${currentStatus} sang ${nextStatus}.`, 409);
  }
  return true;
}

async function generateQueueNumber({ department_id, doctor_id, checkin_date = new Date(), queue_type = 'normal' }) {
  const start = getStartOfDay(checkin_date);
  const end = getEndOfDay(checkin_date);
  const count = await QueueTicket.countDocuments({
    department_id,
    doctor_id,
    created_at: { $gte: start, $lte: end },
  });

  const prefixMap = {
    normal: 'N',
    priority: 'P',
    vip: 'V',
  };

  return `${prefixMap[queue_type] || 'N'}${String(count + 1).padStart(3, '0')}`;
}

async function validateQueueCreation(payload) {
  const [patient, doctor, department] = await Promise.all([
    Patient.findById(payload.patient_id).lean(),
    User.findById(payload.doctor_id).lean(),
    Department.findById(payload.department_id).lean(),
  ]);

  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (!doctor || doctor.is_deleted || doctor.status !== 'active') throw createError('Không tìm thấy bác sĩ hoặc staff phục vụ.', 404);
  if (!department || department.is_deleted || department.status !== 'active') throw createError('Department không khả dụng.', 404);

  let appointment = null;
  if (payload.appointment_id) {
    appointment = await Appointment.findById(payload.appointment_id).lean();
    if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment.', 404);
    if (String(appointment.patient_id) !== String(payload.patient_id)) throw createError('Appointment không thuộc bệnh nhân này.', 409);
    if (String(appointment.doctor_id) !== String(payload.doctor_id)) throw createError('Appointment không thuộc bác sĩ này.', 409);
    if (String(appointment.department_id) !== String(payload.department_id)) throw createError('Appointment không thuộc department này.', 409);

    const existing = await QueueTicket.findOne({
      appointment_id: appointment._id,
      status: { $in: ACTIVE_QUEUE_STATUSES },
    }).lean();
    if (existing) {
      throw createError('Appointment này đã có queue ticket còn hiệu lực.', 409);
    }
  }

  return { patient, doctor, department, appointment };
}

async function createQueueTicket(payload, actor, requestMeta = {}) {
  const queue_type = payload.queue_type || 'normal';
  const { appointment } = await validateQueueCreation({ ...payload, queue_type });
  const queueNumber = await generateQueueNumber({
    department_id: payload.department_id,
    doctor_id: payload.doctor_id,
    checkin_date: payload.checkin_time || new Date(),
    queue_type,
  });

  const ticket = await QueueTicket.create({
    patient_id: payload.patient_id,
    appointment_id: payload.appointment_id || undefined,
    encounter_id: payload.encounter_id || undefined,
    doctor_id: payload.doctor_id,
    department_id: payload.department_id,
    queue_number: queueNumber,
    queue_type,
    status: payload.status || 'waiting',
    checkin_time: payload.checkin_time ? new Date(payload.checkin_time) : new Date(),
    created_by: actor?.userId,
  });

  if (appointment && ['booked', 'confirmed'].includes(appointment.status)) {
    await Appointment.updateOne({ _id: appointment._id }, { $set: { status: 'checked_in', updated_by: actor?.userId } });
  }

  await recordAuditLog({
    actor,
    action: 'queue.create',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Tạo queue ticket thành công.',
    requestMeta,
  });

  return getQueueTicketDetail(ticket._id);
}

async function listQueueTickets(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.department_id) filter.department_id = query.department_id;
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.status) filter.status = query.status;
  if (query.date) {
    filter.created_at = { $gte: getStartOfDay(query.date), $lte: getEndOfDay(query.date) };
  }

  const [items, total] = await Promise.all([
    QueueTicket.find(filter).sort({ checkin_time: 1, queue_number: 1 }).skip(skip).limit(limit).lean(),
    QueueTicket.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => ({
      queue_ticket_id: String(item._id),
      patient_id: String(item.patient_id),
      appointment_id: item.appointment_id ? String(item.appointment_id) : null,
      encounter_id: item.encounter_id ? String(item.encounter_id) : null,
      doctor_id: String(item.doctor_id),
      department_id: String(item.department_id),
      queue_number: item.queue_number,
      queue_type: item.queue_type,
      status: item.status,
      checkin_time: item.checkin_time,
      called_time: item.called_time,
      completed_time: item.completed_time,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getQueueTicketDetail(ticketId) {
  const ticket = await QueueTicket.findById(ticketId).lean();
  if (!ticket) {
    throw createError('Không tìm thấy queue ticket.', 404);
  }

  return {
    queue_ticket: {
      queue_ticket_id: String(ticket._id),
      patient_id: String(ticket.patient_id),
      appointment_id: ticket.appointment_id ? String(ticket.appointment_id) : null,
      encounter_id: ticket.encounter_id ? String(ticket.encounter_id) : null,
      doctor_id: String(ticket.doctor_id),
      department_id: String(ticket.department_id),
      queue_number: ticket.queue_number,
      queue_type: ticket.queue_type,
      status: ticket.status,
      checkin_time: ticket.checkin_time,
      called_time: ticket.called_time,
      completed_time: ticket.completed_time,
      created_at: ticket.created_at,
    },
  };
}

async function callNextQueue({ department_id, doctor_id }, actor, requestMeta = {}) {
  const ticket = await getNextWaitingQueueTicket({ department_id, doctor_id });
  if (!ticket) {
    throw createError('Không còn bệnh nhân nào đang chờ.', 404);
  }

  validateQueueStatusTransition(ticket.status, 'called');
  ticket.status = 'called';
  ticket.called_time = new Date();
  ticket.updated_by = actor?.userId;
  await ticket.save();

  await recordAuditLog({
    actor,
    action: 'queue.call_next',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Gọi số tiếp theo thành công.',
    requestMeta,
  });

  return getQueueTicketDetail(ticket._id);
}

async function getNextWaitingQueueTicket({ department_id, doctor_id } = {}) {
  const filter = { status: 'waiting' };
  if (department_id) filter.department_id = department_id;
  if (doctor_id) filter.doctor_id = doctor_id;

  return QueueTicket.findOne(filter).sort({ queue_type: -1, checkin_time: 1, queue_number: 1 });
}

async function recallQueueTicket(ticketId, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  validateQueueStatusTransition(ticket.status, 'recalled');
  ticket.status = 'recalled';
  ticket.called_time = new Date();
  ticket.updated_by = actor?.userId;
  await ticket.save();

  await recordAuditLog({
    actor,
    action: 'queue.recall',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Gọi lại số thành công.',
    requestMeta,
  });

  return getQueueTicketDetail(ticket._id);
}

async function skipQueueTicket(ticketId, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  validateQueueStatusTransition(ticket.status, 'skipped');
  ticket.status = 'skipped';
  ticket.updated_by = actor?.userId;
  await ticket.save();

  await recordAuditLog({
    actor,
    action: 'queue.skip',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Bỏ qua tạm thời queue ticket thành công.',
    requestMeta,
  });

  return getQueueTicketDetail(ticket._id);
}

async function startQueueService(ticketId, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  validateQueueStatusTransition(ticket.status, 'in_service');
  ticket.status = 'in_service';
  ticket.updated_by = actor?.userId;
  await ticket.save();

  await recordAuditLog({
    actor,
    action: 'queue.start_service',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Bắt đầu phục vụ queue ticket thành công.',
    requestMeta,
  });

  return getQueueTicketDetail(ticket._id);
}

async function completeQueueTicket(ticketId, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  validateQueueStatusTransition(ticket.status, 'completed');
  ticket.status = 'completed';
  ticket.completed_time = new Date();
  ticket.updated_by = actor?.userId;
  await ticket.save();

  await recordAuditLog({
    actor,
    action: 'queue.complete',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Hoàn tất queue ticket thành công.',
    requestMeta,
  });

  return getQueueTicketDetail(ticket._id);
}

async function cancelQueueTicket(ticketId, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  validateQueueStatusTransition(ticket.status, 'cancelled');
  ticket.status = 'cancelled';
  ticket.updated_by = actor?.userId;
  await ticket.save();

  await recordAuditLog({
    actor,
    action: 'queue.cancel',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Hủy queue ticket thành công.',
    requestMeta,
  });

  return getQueueTicketDetail(ticket._id);
}

async function getDoctorQueueBoard(doctorId, query = {}) {
  const date = query.date || new Date();
  const items = await QueueTicket.find({
    doctor_id: doctorId,
    created_at: { $gte: getStartOfDay(date), $lte: getEndOfDay(date) },
  })
    .sort({ checkin_time: 1, queue_number: 1 })
    .lean();

  return {
    doctor_id: String(doctorId),
    waiting: items.filter((item) => item.status === 'waiting'),
    called: items.filter((item) => ['called', 'recalled'].includes(item.status)),
    in_service: items.filter((item) => item.status === 'in_service'),
    completed: items.filter((item) => item.status === 'completed'),
  };
}

async function getDepartmentQueueBoard(departmentId, query = {}) {
  const date = query.date || new Date();
  const items = await QueueTicket.find({
    department_id: departmentId,
    created_at: { $gte: getStartOfDay(date), $lte: getEndOfDay(date) },
  })
    .sort({ checkin_time: 1, queue_number: 1 })
    .lean();

  return {
    department_id: String(departmentId),
    items,
  };
}

async function getTodayQueueSummary(query = {}) {
  const date = query.date || new Date();
  const filter = {
    created_at: { $gte: getStartOfDay(date), $lte: getEndOfDay(date) },
  };
  if (query.department_id) filter.department_id = query.department_id;
  if (query.doctor_id) filter.doctor_id = query.doctor_id;

  const items = await QueueTicket.find(filter).lean();
  return {
    total: items.length,
    waiting: items.filter((item) => item.status === 'waiting').length,
    called: items.filter((item) => ['called', 'recalled'].includes(item.status)).length,
    in_service: items.filter((item) => item.status === 'in_service').length,
    completed: items.filter((item) => item.status === 'completed').length,
    cancelled: items.filter((item) => item.status === 'cancelled').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
  };
}

async function createQueueTicketFromAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment.', 404);

  return createQueueTicket(
    {
      patient_id: appointment.patient_id,
      appointment_id: appointment._id,
      doctor_id: appointment.doctor_id,
      department_id: appointment.department_id,
      queue_type: 'normal',
    },
    actor,
    requestMeta,
  );
}

async function checkInPatientToQueue(payload, actor, requestMeta = {}) {
  if (payload.appointment_id) {
    return createQueueTicketFromAppointment(payload.appointment_id, actor, requestMeta);
  }

  return createQueueTicket(
    {
      ...payload,
      checkin_time: new Date(),
    },
    actor,
    requestMeta,
  );
}

async function checkQueueTicketCanCreateEncounter(ticketId) {
  const ticket = await QueueTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  return {
    queue_ticket_id: String(ticket._id),
    can_create_encounter: ['called', 'recalled', 'in_service', 'completed'].includes(ticket.status),
    status: ticket.status,
  };
}

async function reorderQueuePriority(ticketId, payload = {}, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);

  ticket.queue_type = payload.queue_type || ticket.queue_type;
  ticket.updated_by = actor?.userId;
  await ticket.save();

  await recordAuditLog({
    actor,
    action: 'queue.reorder_priority',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Cập nhật mức ưu tiên queue ticket thành công.',
    requestMeta,
    metadata: { queue_type: ticket.queue_type },
  });

  return getQueueTicketDetail(ticket._id);
}

async function transferQueueTicket(ticketId, payload = {}, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);

  ticket.doctor_id = payload.doctor_id || ticket.doctor_id;
  ticket.department_id = payload.department_id || ticket.department_id;
  ticket.updated_by = actor?.userId;
  await ticket.save();

  await recordAuditLog({
    actor,
    action: 'queue.transfer',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Chuyển queue ticket sang luồng phục vụ khác thành công.',
    requestMeta,
    metadata: {
      doctor_id: ticket.doctor_id,
      department_id: ticket.department_id,
    },
  });

  return getQueueTicketDetail(ticket._id);
}

async function getQueueTimeline(ticketId, query = {}) {
  const ticket = await QueueTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);

  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 300);
  const items = await AuditLog.find({
    target_type: 'queue_ticket',
    target_id: ticket._id,
  })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();

  return {
    queue_ticket_id: String(ticket._id),
    items,
  };
}

async function completeQueueTicketByEncounter(encounterId, actor, requestMeta = {}) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);

  const ticket = await QueueTicket.findOne({ encounter_id: encounter._id }).lean();
  if (!ticket) {
    return { completed: false, message: 'Encounter này chưa gắn queue ticket.' };
  }

  if (ticket.status === 'completed') {
    return { completed: true, queue_ticket_id: String(ticket._id) };
  }

  return completeQueueTicket(ticket._id, actor, requestMeta);
}

module.exports = {
  createQueueTicket,
  listQueueTickets,
  getQueueTicketDetail,
  getNextWaitingQueueTicket,
  callNextQueue,
  recallQueueTicket,
  skipQueueTicket,
  startQueueService,
  completeQueueTicket,
  cancelQueueTicket,
  reorderQueuePriority,
  transferQueueTicket,
  getQueueTimeline,
  completeQueueTicketByEncounter,
  getDoctorQueueBoard,
  getDepartmentQueueBoard,
  getTodayQueueSummary,
  createQueueTicketFromAppointment,
  checkInPatientToQueue,
  validateQueueCreation,
  generateQueueNumber,
  validateQueueStatusTransition,
  checkQueueTicketCanCreateEncounter,
};
