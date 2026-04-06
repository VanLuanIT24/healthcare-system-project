const {
  AuditLog,
  Appointment,
  Consultation,
  Department,
  Diagnosis,
  Encounter,
  Patient,
  Prescription,
  QueueTicket,
  User,
  VitalSign,
} = require('../models');
const queueService = require('./queue.service');
const {
  buildPagination,
  createError,
  generateCode,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  recordAuditLog,
} = require('./core.service');

const ENCOUNTER_STATUS_TRANSITIONS = {
  planned: ['arrived', 'in_progress', 'cancelled'],
  arrived: ['in_progress', 'on_hold', 'completed', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function generateEncounterCode() {
  return generateCode('ENC');
}

function validateEncounterStatusTransition(currentStatus, nextStatus) {
  const allowed = ENCOUNTER_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw createError(`Không thể chuyển trạng thái encounter từ ${currentStatus} sang ${nextStatus}.`, 409);
  }
  return true;
}

async function validateEncounterCreation(payload) {
  const [patient, doctor, department] = await Promise.all([
    Patient.findById(payload.patient_id).lean(),
    User.findById(payload.attending_doctor_id).lean(),
    Department.findById(payload.department_id).lean(),
  ]);

  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (!doctor || doctor.is_deleted || doctor.status !== 'active') throw createError('Không tìm thấy bác sĩ.', 404);
  if (!department || department.is_deleted || department.status !== 'active') throw createError('Department không khả dụng.', 404);

  if (payload.appointment_id) {
    const appointment = await Appointment.findById(payload.appointment_id).lean();
    if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment.', 404);
  }

  if (payload.queue_ticket_id) {
    const queueTicket = await QueueTicket.findById(payload.queue_ticket_id).lean();
    if (!queueTicket) throw createError('Không tìm thấy queue ticket.', 404);
  }

  return { patient, doctor, department };
}

async function createEncounter(payload, actor, requestMeta = {}) {
  await validateEncounterCreation(payload);

  const encounter = await Encounter.create({
    patient_id: payload.patient_id,
    appointment_id: payload.appointment_id || undefined,
    department_id: payload.department_id,
    attending_doctor_id: payload.attending_doctor_id,
    encounter_code: payload.encounter_code || generateEncounterCode(),
    encounter_type: payload.encounter_type || 'outpatient',
    start_time: payload.start_time ? new Date(payload.start_time) : new Date(),
    chief_reason: payload.chief_reason,
    status: payload.status || 'planned',
    created_by: actor?.userId,
  });

  if (payload.queue_ticket_id) {
    await QueueTicket.updateOne(
      { _id: payload.queue_ticket_id },
      { $set: { encounter_id: encounter._id, updated_by: actor?.userId } },
    );
  }

  await recordAuditLog({
    actor,
    action: 'encounter.create',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Tạo encounter thành công.',
    requestMeta,
  });

  return getEncounterDetail(encounter._id);
}

async function createEncounterFromAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment.', 404);

  const existing = await Encounter.findOne({ appointment_id: appointment._id }).lean();
  if (existing) {
    return { encounter: existing, created: false };
  }

  return createEncounter(
    {
      patient_id: appointment.patient_id,
      appointment_id: appointment._id,
      department_id: appointment.department_id,
      attending_doctor_id: appointment.doctor_id,
      encounter_type: appointment.appointment_type === 'telemedicine' ? 'telemedicine' : 'outpatient',
      chief_reason: appointment.reason,
      status: 'arrived',
      start_time: new Date(),
    },
    actor,
    requestMeta,
  );
}

async function createEncounterFromQueueTicket(ticketId, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);

  const canCreate = await queueService.checkQueueTicketCanCreateEncounter(ticket._id);
  if (!canCreate.can_create_encounter) {
    throw createError('Queue ticket hiện chưa đủ điều kiện để tạo encounter.', 409);
  }

  const existing = ticket.encounter_id ? await Encounter.findById(ticket.encounter_id).lean() : null;
  if (existing) {
    return { encounter: existing, created: false };
  }

  return createEncounter(
    {
      patient_id: ticket.patient_id,
      appointment_id: ticket.appointment_id,
      queue_ticket_id: ticket._id,
      department_id: ticket.department_id,
      attending_doctor_id: ticket.doctor_id,
      encounter_type: 'outpatient',
      status: 'arrived',
      start_time: new Date(),
    },
    actor,
    requestMeta,
  );
}

async function attachQueueTicketToEncounter(encounterId, ticketId, actor, requestMeta = {}) {
  const [encounter, ticket] = await Promise.all([Encounter.findById(encounterId), QueueTicket.findById(ticketId)]);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);

  ticket.encounter_id = encounter._id;
  ticket.updated_by = actor?.userId;
  await ticket.save();

  await recordAuditLog({
    actor,
    action: 'encounter.attach_queue_ticket',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Liên kết queue ticket với encounter thành công.',
    requestMeta,
    metadata: { queue_ticket_id: ticketId },
  });

  return getEncounterDetail(encounter._id);
}

async function linkAppointmentToEncounter(encounterId, appointmentId, actor, requestMeta = {}) {
  const [encounter, appointment] = await Promise.all([Encounter.findById(encounterId), Appointment.findById(appointmentId)]);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment.', 404);

  encounter.appointment_id = appointment._id;
  encounter.updated_by = actor?.userId;
  await encounter.save();

  await recordAuditLog({
    actor,
    action: 'encounter.link_appointment',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Liên kết appointment với encounter thành công.',
    requestMeta,
    metadata: { appointment_id: appointmentId },
  });

  return getEncounterDetail(encounter._id);
}

async function listEncounters(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.patient_id) filter.patient_id = query.patient_id;
  if (query.doctor_id) filter.attending_doctor_id = query.doctor_id;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.status) filter.status = query.status;
  if (query.date_from || query.date_to) {
    filter.start_time = {};
    if (query.date_from) filter.start_time.$gte = getStartOfDay(query.date_from);
    if (query.date_to) filter.start_time.$lte = getEndOfDay(query.date_to);
  }

  const [items, total] = await Promise.all([
    Encounter.find(filter).sort({ start_time: -1 }).skip(skip).limit(limit).lean(),
    Encounter.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => ({
      encounter_id: String(item._id),
      encounter_code: item.encounter_code,
      patient_id: String(item.patient_id),
      appointment_id: item.appointment_id ? String(item.appointment_id) : null,
      department_id: String(item.department_id),
      attending_doctor_id: String(item.attending_doctor_id),
      encounter_type: item.encounter_type,
      start_time: item.start_time,
      end_time: item.end_time,
      chief_reason: item.chief_reason,
      status: item.status,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function searchEncounters(query = {}) {
  return listEncounters(query);
}

async function getEncounterDetail(encounterId) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);

  const [consultations, diagnoses, vitalSigns] = await Promise.all([
    Consultation.find({ encounter_id: encounter._id }).sort({ created_at: -1 }).lean(),
    Diagnosis.find({ encounter_id: encounter._id }).sort({ created_at: -1 }).lean(),
    VitalSign.find({ encounter_id: encounter._id }).sort({ recorded_at: -1 }).lean(),
  ]);

  return {
    encounter: {
      encounter_id: String(encounter._id),
      encounter_code: encounter.encounter_code,
      patient_id: String(encounter.patient_id),
      appointment_id: encounter.appointment_id ? String(encounter.appointment_id) : null,
      department_id: String(encounter.department_id),
      attending_doctor_id: String(encounter.attending_doctor_id),
      encounter_type: encounter.encounter_type,
      start_time: encounter.start_time,
      end_time: encounter.end_time,
      chief_reason: encounter.chief_reason,
      status: encounter.status,
    },
    consultations,
    diagnoses,
    vital_signs: vitalSigns,
  };
}

async function checkEncounterEditable(encounterId) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  return {
    encounter_id: String(encounter._id),
    editable: !['completed', 'cancelled'].includes(encounter.status),
    status: encounter.status,
  };
}

async function updateEncounter(encounterId, payload, actor, requestMeta = {}) {
  const encounter = await Encounter.findById(encounterId);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  const editable = await checkEncounterEditable(encounter._id);
  if (!editable.editable) throw createError('Encounter đã hoàn tất hoặc đã hủy nên không thể sửa.', 409);

  if (payload.department_id || payload.attending_doctor_id || payload.patient_id || payload.appointment_id) {
    await validateEncounterCreation({
      patient_id: payload.patient_id || encounter.patient_id,
      appointment_id: payload.appointment_id || encounter.appointment_id,
      department_id: payload.department_id || encounter.department_id,
      attending_doctor_id: payload.attending_doctor_id || encounter.attending_doctor_id,
    });
  }

  encounter.patient_id = payload.patient_id || encounter.patient_id;
  encounter.appointment_id = payload.appointment_id || encounter.appointment_id;
  encounter.department_id = payload.department_id || encounter.department_id;
  encounter.attending_doctor_id = payload.attending_doctor_id || encounter.attending_doctor_id;
  encounter.encounter_type = payload.encounter_type || encounter.encounter_type;
  if (payload.chief_reason !== undefined) encounter.chief_reason = payload.chief_reason;
  encounter.updated_by = actor?.userId;
  await encounter.save();

  await recordAuditLog({
    actor,
    action: 'encounter.update',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Cập nhật encounter thành công.',
    requestMeta,
  });

  return getEncounterDetail(encounter._id);
}

async function checkEncounterCanStart(encounterId) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  return {
    encounter_id: String(encounter._id),
    can_start: ['planned', 'arrived', 'on_hold'].includes(encounter.status),
    status: encounter.status,
  };
}

async function startEncounter(encounterId, actor, requestMeta = {}) {
  const encounter = await Encounter.findById(encounterId);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  const canStart = await checkEncounterCanStart(encounter._id);
  if (!canStart.can_start) throw createError('Encounter hiện không thể bắt đầu.', 409);

  if (encounter.status === 'planned') {
    validateEncounterStatusTransition(encounter.status, 'in_progress');
  }

  encounter.status = 'in_progress';
  if (!encounter.start_time) {
    encounter.start_time = new Date();
  }
  encounter.updated_by = actor?.userId;
  await encounter.save();

  await recordAuditLog({
    actor,
    action: 'encounter.start',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Bắt đầu encounter thành công.',
    requestMeta,
  });

  return getEncounterDetail(encounter._id);
}

async function arriveEncounter(encounterId, actor, requestMeta = {}) {
  const encounter = await Encounter.findById(encounterId);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  validateEncounterStatusTransition(encounter.status, 'arrived');
  encounter.status = 'arrived';
  encounter.updated_by = actor?.userId;
  await encounter.save();

  await recordAuditLog({
    actor,
    action: 'encounter.arrive',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Đánh dấu encounter đã đến khám thành công.',
    requestMeta,
  });

  return getEncounterDetail(encounter._id);
}

async function holdEncounter(encounterId, actor, requestMeta = {}) {
  const encounter = await Encounter.findById(encounterId);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  validateEncounterStatusTransition(encounter.status, 'on_hold');
  encounter.status = 'on_hold';
  encounter.updated_by = actor?.userId;
  await encounter.save();

  await recordAuditLog({
    actor,
    action: 'encounter.hold',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Tạm dừng encounter thành công.',
    requestMeta,
  });

  return getEncounterDetail(encounter._id);
}

async function checkEncounterCanComplete(encounterId) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);

  const [consultations, diagnoses, activePrescriptions] = await Promise.all([
    checkEncounterHasSignedConsultation(encounter._id),
    Diagnosis.countDocuments({ encounter_id: encounter._id, status: { $ne: 'entered_in_error' } }),
    checkEncounterHasActivePrescription(encounter._id),
  ]);

  return {
    encounter_id: String(encounter._id),
    can_complete: consultations.signed_consultations_count > 0 || diagnoses > 0 || activePrescriptions.active_prescriptions_count > 0,
    signed_consultations_count: consultations.signed_consultations_count,
    active_diagnoses_count: diagnoses,
    active_prescriptions_count: activePrescriptions.active_prescriptions_count,
    status: encounter.status,
  };
}

async function completeEncounter(encounterId, actor, requestMeta = {}) {
  const encounter = await Encounter.findById(encounterId);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);

  const completionCheck = await checkEncounterCanComplete(encounter._id);
  if (!completionCheck.can_complete) {
    throw createError('Encounter chưa đủ dữ liệu lâm sàng để hoàn tất.', 409);
  }

  validateEncounterStatusTransition(encounter.status, 'completed');
  encounter.status = 'completed';
  encounter.end_time = new Date();
  encounter.updated_by = actor?.userId;
  await encounter.save();

  await recordAuditLog({
    actor,
    action: 'encounter.complete',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Hoàn tất encounter thành công.',
    requestMeta,
  });

  return getEncounterDetail(encounter._id);
}

async function cancelEncounter(encounterId, actor, requestMeta = {}) {
  const encounter = await Encounter.findById(encounterId);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  validateEncounterStatusTransition(encounter.status, 'cancelled');
  encounter.status = 'cancelled';
  encounter.updated_by = actor?.userId;
  await encounter.save();

  await recordAuditLog({
    actor,
    action: 'encounter.cancel',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Hủy encounter thành công.',
    requestMeta,
  });

  return getEncounterDetail(encounter._id);
}

async function reopenEncounter(encounterId, actor, requestMeta = {}) {
  const encounter = await Encounter.findById(encounterId);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  if (encounter.status !== 'completed') {
    throw createError('Chỉ encounter đã completed mới được mở lại.', 409);
  }

  encounter.status = 'in_progress';
  encounter.end_time = undefined;
  encounter.updated_by = actor?.userId;
  await encounter.save();

  await recordAuditLog({
    actor,
    action: 'encounter.reopen',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Mở lại encounter thành công.',
    requestMeta,
  });

  return getEncounterDetail(encounter._id);
}

async function getPatientEncounterHistory(patientId, query = {}) {
  return listEncounters({ ...query, patient_id: patientId });
}

async function getDoctorEncounters(doctorId, query = {}) {
  return listEncounters({ ...query, doctor_id: doctorId });
}

async function getTodayEncounters(query = {}) {
  return listEncounters({ ...query, date_from: new Date().toISOString(), date_to: new Date().toISOString() });
}

async function getEncounterSummary(query = {}) {
  const filter = {};
  if (query.encounter_id) filter._id = query.encounter_id;
  if (query.doctor_id) filter.attending_doctor_id = query.doctor_id;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.date) {
    filter.start_time = { $gte: getStartOfDay(query.date), $lte: getEndOfDay(query.date) };
  }

  const items = await Encounter.find(filter).lean();
  const summarize = (status) => items.filter((item) => item.status === status).length;

  return {
    total: items.length,
    planned: summarize('planned'),
    arrived: summarize('arrived'),
    in_progress: summarize('in_progress'),
    on_hold: summarize('on_hold'),
    completed: summarize('completed'),
    cancelled: summarize('cancelled'),
  };
}

async function getEncounterTimeline(encounterId, query = {}) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);

  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 300);
  const items = await AuditLog.find({
    target_type: 'encounter',
    target_id: encounter._id,
  })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();

  return {
    encounter_id: String(encounter._id),
    items,
  };
}

async function checkEncounterHasSignedConsultation(encounterId) {
  const signed_consultations_count = await Consultation.countDocuments({
    encounter_id: encounterId,
    status: { $in: ['signed', 'amended'] },
  });

  return {
    encounter_id: String(encounterId),
    has_signed_consultation: signed_consultations_count > 0,
    signed_consultations_count,
  };
}

async function checkEncounterHasActivePrescription(encounterId) {
  const active_prescriptions_count = await Prescription.countDocuments({
    encounter_id: encounterId,
    status: { $in: ['active', 'verified', 'partially_dispensed', 'fully_dispensed'] },
  });

  return {
    encounter_id: String(encounterId),
    has_active_prescription: active_prescriptions_count > 0,
    active_prescriptions_count,
  };
}

module.exports = {
  createEncounter,
  listEncounters,
  getEncounterDetail,
  updateEncounter,
  arriveEncounter,
  startEncounter,
  holdEncounter,
  completeEncounter,
  cancelEncounter,
  reopenEncounter,
  createEncounterFromAppointment,
  createEncounterFromQueueTicket,
  linkAppointmentToEncounter,
  attachQueueTicketToEncounter,
  getPatientEncounterHistory,
  getDoctorEncounters,
  getTodayEncounters,
  searchEncounters,
  generateEncounterCode,
  validateEncounterCreation,
  validateEncounterStatusTransition,
  checkEncounterCanStart,
  checkEncounterCanComplete,
  checkEncounterEditable,
  getEncounterSummary,
  getEncounterTimeline,
  checkEncounterHasSignedConsultation,
  checkEncounterHasActivePrescription,
};
