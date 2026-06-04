const {
  Appointment,
  AuditLog,
  Counter,
  Department,
  DoctorProfile,
  Encounter,
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
const {
  ACTIVE_APPOINTMENT_STATUSES,
  ACTIVE_QUEUE_STATUSES,
  APPOINTMENT_STATUS,
  DOCTOR_PROFILE_STATUS,
  ENCOUNTER_STATUS,
  QUEUE_STATUS,
  QUEUE_TYPE,
  REALTIME_EVENT_TYPE,
} = require('../constants/statuses');
const { QUEUE_TRANSITIONS } = require('../constants/transitions');
const { assertTransition } = require('../shared/utils/status-transition');
const { withOptionalTransaction } = require('../shared/utils/transaction');
const { PERMISSION } = require('../constants/permissions');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const permissionService = require('./permission.service');
const scheduleService = require('./schedule.service');
const qrTokenService = require('./qr-token.service');
const eventBus = require('../events/event-bus.service');

const QUEUE_PRIORITY_WEIGHT = {
  [QUEUE_TYPE.VIP]: 3,
  [QUEUE_TYPE.PRIORITY]: 2,
  [QUEUE_TYPE.NORMAL]: 1,
};
const QUEUE_ACTIVE_SERVICE_STATUSES = [
  QUEUE_STATUS.WAITING,
  QUEUE_STATUS.CALLED,
  QUEUE_STATUS.RECALLED,
  QUEUE_STATUS.SKIPPED,
  QUEUE_STATUS.IN_SERVICE,
];
const QUEUE_WRITE_PERMISSIONS_BY_ACTION = {
  create: [PERMISSION.QUEUE.CREATE, PERMISSION.APPOINTMENTS.CHECKIN],
  update: [PERMISSION.QUEUE.UPDATE],
  call: [PERMISSION.QUEUE.CALL, PERMISSION.QUEUE.CALL_OWN],
  recall: [PERMISSION.QUEUE.RECALL, PERMISSION.QUEUE.CALL, PERMISSION.QUEUE.CALL_OWN],
  skip: [PERMISSION.QUEUE.SKIP],
  start_service: [PERMISSION.QUEUE.START_SERVICE, PERMISSION.QUEUE.START_SERVICE_OWN],
  complete: [PERMISSION.QUEUE.COMPLETE],
  cancel: [PERMISSION.QUEUE.CANCEL],
  transfer: [PERMISSION.QUEUE.UPDATE],
  reorder: [PERMISSION.QUEUE.UPDATE],
};
const QUEUE_OWN_WRITE_PERMISSIONS_BY_ACTION = {
  call: [PERMISSION.QUEUE.CALL_OWN],
  recall: [PERMISSION.QUEUE.CALL_OWN],
  start_service: [PERMISSION.QUEUE.START_SERVICE_OWN],
};
const TERMINAL_QUEUE_STATUSES = [QUEUE_STATUS.COMPLETED, QUEUE_STATUS.CANCELLED, QUEUE_STATUS.NO_SHOW];

async function publishQueueEvent(eventType, ticket, payload = {}) {
  if (!ticket) return null;
  return eventBus.publishDomainEvent({
    eventType,
    aggregateType: 'queue_ticket',
    aggregateId: ticket._id,
    recipientScope: {
      patient_id: ticket.patient_id,
      department_id: ticket.department_id,
      user_id: ticket.doctor_id,
      queue_id: ticket._id,
      queue_ticket_id: ticket._id,
      appointment_id: ticket.appointment_id,
      recipients: [{ recipient_type: 'patient', recipient_id: ticket.patient_id, patient_id: ticket.patient_id }],
    },
    payload: {
      ticket_id: String(ticket._id),
      queue_number: ticket.queue_number,
      display_number: ticket.display_number,
      status: ticket.status,
      ...payload,
    },
  });
}

function sessionOptions(session) {
  return session ? { session } : {};
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function actorRoles(actor = {}) {
  return Array.isArray(actor.roles) ? actor.roles : [];
}

function hasRole(actor = {}, roleCode) {
  return actorRoles(actor).includes(roleCode);
}

function isPatientActor(actor = {}) {
  return actorType(actor) === 'patient';
}

function isPatientRelativeActor(actor = {}) {
  return actorType(actor) === 'patient_relative';
}

function isPortalPatientActor(actor = {}) {
  return isPatientActor(actor) || isPatientRelativeActor(actor);
}

function getPortalPatientId(actor = {}) {
  return actor.patientId || actor.patient_id || actor.patient?._id || actor.patient?.id || null;
}

function isDoctorActor(actor = {}) {
  return hasRole(actor, 'doctor');
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes);
}

function hasGlobalQueueScope(actor = {}) {
  return hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS])
    || hasRole(actor, 'super_admin')
    || hasRole(actor, 'admin')
    || hasRole(actor, 'manager');
}

function sameId(left, right) {
  return String(left?._id || left || '') === String(right?._id || right || '');
}

function applyQueueReadScope(filter, actor = {}) {
  if (!actorType(actor)) return filter;
  if (isPortalPatientActor(actor)) {
    const patientId = getPortalPatientId(actor);
    if (!patientId) {
      filter._id = null;
      return filter;
    }
    if (filter.patient_id && !sameId(filter.patient_id, patientId)) {
      filter._id = null;
      return filter;
    }
    filter.patient_id = patientId;
    return filter;
  }
  if (hasGlobalQueueScope(actor)) return filter;
  if (isDoctorActor(actor) || hasPermission(actor, PERMISSION.QUEUE.READ_OWN)) {
    if (!actor.userId || (filter.doctor_id && String(filter.doctor_id) !== String(actor.userId))) {
      filter._id = null;
      return filter;
    }
    filter.doctor_id = actor.userId;
    return filter;
  }
  if (hasAnyPermission(actor, [PERMISSION.QUEUE.READ, PERMISSION.APPOINTMENTS.READ, PERMISSION.REPORTS.QUEUE_READ])) return filter;
  if (hasPermission(actor, PERMISSION.QUEUE.READ_DEPARTMENT)) {
    const departmentId = actorDepartmentId(actor);
    if (!departmentId || (filter.department_id && String(filter.department_id) !== String(departmentId))) {
      filter._id = null;
      return filter;
    }
    filter.department_id = departmentId;
    return filter;
  }
  filter._id = null;
  return filter;
}

function assertQueueReadable(ticket, actor = {}) {
  const filter = {
    doctor_id: ticket.doctor_id,
    department_id: ticket.department_id,
    patient_id: ticket.patient_id,
  };
  applyQueueReadScope(filter, actor);
  if (filter._id === null) throw createError('Bạn không có quyền xem queue ticket này.', 403);
  if (filter.doctor_id && String(filter.doctor_id) !== String(ticket.doctor_id)) throw createError('Bạn không có quyền xem queue ticket này.', 403);
  if (filter.department_id && String(filter.department_id) !== String(ticket.department_id)) throw createError('Bạn không có quyền xem queue ticket này.', 403);
  if (filter.patient_id && String(filter.patient_id) !== String(ticket.patient_id)) throw createError('Bạn không có quyền xem queue ticket này.', 403);
  return true;
}

function assertQueueTargetWritable(target = {}, actor = {}, action = 'update') {
  if (!actorType(actor)) return true;
  if (isPortalPatientActor(actor)) {
    if (action === 'create' && target.patient_id && sameId(target.patient_id, getPortalPatientId(actor))) {
      return true;
    }
    throw createError('Patient không có quyền thao tác queue.', 403);
  }

  const actionPermissions = QUEUE_WRITE_PERMISSIONS_BY_ACTION[action] || QUEUE_WRITE_PERMISSIONS_BY_ACTION.update;
  if (!hasAnyPermission(actor, actionPermissions) && !hasGlobalQueueScope(actor)) {
    throw createError('Bạn không có quyền thao tác queue.', 403);
  }
  if (hasGlobalQueueScope(actor)) return true;

  if (isDoctorActor(actor)) {
    if (target.doctor_id && actor.userId && sameId(target.doctor_id, actor.userId)) return true;
    throw createError('Bác sĩ chỉ được thao tác queue của chính mình.', 403);
  }

  const ownPermissions = QUEUE_OWN_WRITE_PERMISSIONS_BY_ACTION[action] || [];
  if (
    target.doctor_id
    && actor.userId
    && sameId(target.doctor_id, actor.userId)
    && (isDoctorActor(actor) || hasAnyPermission(actor, ownPermissions))
  ) {
    return true;
  }

  const departmentId = actorDepartmentId(actor);
  if (departmentId && target.department_id && sameId(target.department_id, departmentId)) return true;

  throw createError('Bạn không có quyền thao tác queue ngoài phạm vi được phân quyền.', 403);
}

function assertQueueWritable(ticket, actor = {}, action = 'update') {
  assertQueueReadable(ticket, actor);
  return assertQueueTargetWritable(ticket, actor, action);
}

function scopedQueueTarget(target = {}, actor = {}, action = 'call') {
  const scoped = { ...target };
  if (!actorType(actor) || hasGlobalQueueScope(actor)) return scoped;
  if (!scoped.doctor_id && (isDoctorActor(actor) || hasAnyPermission(actor, QUEUE_OWN_WRITE_PERMISSIONS_BY_ACTION[action] || []))) {
    scoped.doctor_id = actor.userId;
  }
  if (!scoped.department_id && !scoped.doctor_id) {
    const departmentId = actorDepartmentId(actor);
    if (departmentId) scoped.department_id = departmentId;
  }
  assertQueueTargetWritable(scoped, actor, action);
  return scoped;
}

function canSeeQueuePatientData(actor = {}) {
  if (!actorType(actor)) return true;
  if (isPortalPatientActor(actor)) return true;
  return hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.PATIENTS.READ,
    PERMISSION.APPOINTMENTS.READ,
    PERMISSION.APPOINTMENTS.READ_DEPARTMENT,
    PERMISSION.APPOINTMENTS.READ_OWN,
    PERMISSION.QUEUE.READ,
  ]);
}

function canSeeQueueClinicalLinks(actor = {}) {
  if (!actorType(actor)) return true;
  return hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.APPOINTMENTS.READ,
    PERMISSION.APPOINTMENTS.READ_DEPARTMENT,
    PERMISSION.APPOINTMENTS.READ_OWN,
    PERMISSION.ENCOUNTERS.READ,
    PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    PERMISSION.ENCOUNTERS.READ_OWN,
    PERMISSION.QUEUE.READ,
  ]);
}

function queueWaitMinutes(ticket = {}) {
  const start = new Date(ticket.checkin_time || ticket.created_at).getTime();
  const end = ticket.service_start_time ? new Date(ticket.service_start_time).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 60000);
}

function formatQueueTicket(ticket, actor = {}, related = {}, options = {}) {
  const includePatientData = options.includePatientData !== false && canSeeQueuePatientData(actor);
  const includeClinicalLinks = options.includeClinicalLinks !== false && canSeeQueueClinicalLinks(actor);
  const dto = {
    queue_ticket_id: String(ticket._id),
    doctor_id: String(ticket.doctor_id),
    department_id: String(ticket.department_id),
    queue_number: ticket.queue_number,
    queue_date: ticket.queue_date,
    queue_type: ticket.queue_type,
    status: ticket.status,
    checkin_time: ticket.checkin_time,
    called_time: ticket.called_time,
    service_start_time: ticket.service_start_time,
    completed_time: ticket.completed_time,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };
  if (includeClinicalLinks) {
    dto.appointment_id = ticket.appointment_id ? String(ticket.appointment_id) : null;
    dto.encounter_id = ticket.encounter_id ? String(ticket.encounter_id) : null;
  }
  if (includePatientData) {
    dto.patient_id = String(ticket.patient_id);
    dto.patient_code = related.patient?.patient_code || null;
    dto.patient_name = related.patient?.full_name || null;
  }
  if (options.includePatientPhone && includePatientData && canSeeQueuePatientData(actor) && hasPermission(actor, PERMISSION.PATIENTS.READ)) {
    dto.patient_phone = related.patient?.phone || null;
  }
  if (related.doctor) {
    dto.doctor_name = related.doctor.full_name || null;
    dto.doctor_code = related.doctor.employee_code || null;
  }
  if (related.department) {
    dto.department_name = related.department.department_name || null;
    dto.department_code = related.department.department_code || null;
  }
  return dto;
}

async function buildQueueReferenceMaps(items = []) {
  const uniqueIds = (values) => [...new Set(values.filter(Boolean).map((value) => String(value)))];
  const patientIds = uniqueIds(items.map((item) => item.patient_id));
  const doctorIds = uniqueIds(items.map((item) => item.doctor_id));
  const departmentIds = uniqueIds(items.map((item) => item.department_id));

  const [patients, doctors, departments] = await Promise.all([
    patientIds.length ? Patient.find({ _id: { $in: patientIds }, is_deleted: false }).select('patient_code full_name phone').lean() : [],
    doctorIds.length ? User.find({ _id: { $in: doctorIds }, is_deleted: false }).select('full_name employee_code username').lean() : [],
    departmentIds.length ? Department.find({ _id: { $in: departmentIds }, is_deleted: false }).select('department_name department_code').lean() : [],
  ]);

  return {
    patients: new Map(patients.map((patient) => [String(patient._id), patient])),
    doctors: new Map(doctors.map((doctor) => [String(doctor._id), doctor])),
    departments: new Map(departments.map((department) => [String(department._id), department])),
  };
}

function formatAuditTimelineItem(item) {
  return {
    audit_log_id: String(item._id),
    action: item.action,
    target_type: item.target_type,
    target_id: item.target_id ? String(item.target_id) : null,
    status: item.status,
    message: item.message,
    created_at: item.created_at,
  };
}

function isDuplicateQueueNumberError(error) {
  const keyPattern = error?.keyPattern || {};
  return error?.code === 11000
    && (keyPattern.queue_number || keyPattern.department_id || keyPattern.doctor_id || keyPattern.queue_date);
}

function validateQueueStatusTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  return assertTransition(QUEUE_TRANSITIONS, currentStatus, nextStatus, 'queue');
}

async function generateQueueNumber({ department_id, doctor_id, checkin_date = new Date(), queue_type = QUEUE_TYPE.NORMAL, session = null }) {
  const queueDate = getStartOfDay(checkin_date);
  const department = await Department.findById(department_id).select('department_code').session(session).lean();
  const dateKey = queueDate.toISOString().slice(0, 10).replace(/-/g, '');
  const counterKey = `queue:${department_id}:${doctor_id || 'department'}:${dateKey}`;
  const counter = await Counter.findOneAndUpdate(
    { key: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, ...sessionOptions(session) },
  );
  const prefixMap = {
    normal: 'N',
    priority: 'P',
    vip: 'V',
  };
  const departmentCode = String(department?.department_code || 'Q').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'Q';

  return `${departmentCode}-${prefixMap[queue_type] || 'N'}${String(counter.seq).padStart(3, '0')}`;
}

async function validateQueueCreation(payload, options = {}) {
  const session = options.session || null;
  const [patient, doctor, department, doctorProfile] = await Promise.all([
    Patient.findById(payload.patient_id).session(session).lean(),
    User.findById(payload.doctor_id).session(session).lean(),
    Department.findById(payload.department_id).session(session).lean(),
    DoctorProfile.findOne({ user_id: payload.doctor_id, is_deleted: false }).session(session).lean(),
  ]);

  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (patient.status !== 'active') throw createError('Bệnh nhân hiện không active.', 409);
  if (!doctor || doctor.is_deleted || doctor.status !== 'active') throw createError('Không tìm thấy bác sĩ hoặc staff phục vụ.', 404);
  if (!department || department.is_deleted || department.status !== 'active') throw createError('Department không khả dụng.', 404);
  if (!doctorProfile || doctorProfile.status !== DOCTOR_PROFILE_STATUS.ACTIVE) throw createError('Doctor profile không khả dụng.', 409);
  if (String(doctorProfile.department_id) !== String(department._id)) throw createError('Bác sĩ không thuộc department này.', 409);

  let appointment = null;
  if (payload.appointment_id) {
    appointment = await Appointment.findById(payload.appointment_id).session(session).lean();
    if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment.', 404);
    if (String(appointment.patient_id) !== String(payload.patient_id)) throw createError('Appointment không thuộc bệnh nhân này.', 409);
    if (String(appointment.doctor_id) !== String(payload.doctor_id)) throw createError('Appointment không thuộc bác sĩ này.', 409);
    if (String(appointment.department_id) !== String(payload.department_id)) throw createError('Appointment không thuộc department này.', 409);
    if (![APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CHECKED_IN].includes(appointment.status)) {
      throw createError('Appointment không ở trạng thái cho phép tạo queue.', 409);
    }

    const existing = await QueueTicket.findOne({
      appointment_id: appointment._id,
      status: { $in: ACTIVE_QUEUE_STATUSES },
    }).session(session).lean();
    if (existing) {
      throw createError('Appointment này đã có queue ticket còn hiệu lực.', 409);
    }
  }

  const queueDate = getStartOfDay(payload.checkin_time || new Date());
  const activePatientQueue = await QueueTicket.findOne({
    ...(payload.exclude_ticket_id ? { _id: { $ne: payload.exclude_ticket_id } } : {}),
    patient_id: payload.patient_id,
    department_id: payload.department_id,
    queue_date: queueDate,
    status: { $in: QUEUE_ACTIVE_SERVICE_STATUSES },
  }).session(session).lean();
  if (activePatientQueue) {
    throw createError('Bệnh nhân đang có queue active trong department này.', 409);
  }

  return { patient, doctor, department, appointment };
}

async function createQueueTicket(payload, actor, requestMeta = {}, options = {}) {
  const queue_type = payload.queue_type || QUEUE_TYPE.NORMAL;
  if (!Object.values(QUEUE_TYPE).includes(queue_type)) throw createError('queue_type không hợp lệ.', 400);
  const checkinTime = payload.checkin_time ? new Date(payload.checkin_time) : new Date();
  if (Number.isNaN(checkinTime.getTime())) throw createError('checkin_time không hợp lệ.', 400);
  const queueDate = getStartOfDay(checkinTime);
  let ticketId;
  const work = async (session) => {
    assertQueueTargetWritable({ doctor_id: payload.doctor_id, department_id: payload.department_id, patient_id: payload.patient_id }, actor, 'create');
    const { appointment } = await validateQueueCreation({ ...payload, queue_type, checkin_time: checkinTime }, { session });
    const queueNumber = await generateQueueNumber({
      department_id: payload.department_id,
      doctor_id: payload.doctor_id,
      checkin_date: checkinTime,
      queue_type,
      session,
    });

    const [ticket] = await QueueTicket.create([{
      patient_id: payload.patient_id,
      appointment_id: payload.appointment_id || undefined,
      encounter_id: payload.encounter_id || undefined,
      doctor_id: payload.doctor_id,
      department_id: payload.department_id,
      queue_date: queueDate,
      queue_number: queueNumber,
      queue_type,
      status: payload.status || QUEUE_STATUS.WAITING,
      checkin_time: checkinTime,
      created_by: actor?.userId,
    }], sessionOptions(session));
    ticketId = ticket._id;

    if (appointment && [APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CONFIRMED].includes(appointment.status)) {
      await Appointment.updateOne(
        { _id: appointment._id },
        { $set: { status: APPOINTMENT_STATUS.CHECKED_IN, checked_in_at: checkinTime, updated_by: actor?.userId } },
        sessionOptions(session),
      );
    }
  };
  if (options.session) {
    await work(options.session);
    return { queue_ticket_id: String(ticketId) };
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await withOptionalTransaction(work, { fallbackToNoTransaction: true });
      break;
    } catch (error) {
      if (error?.code === 11000 && payload.appointment_id) {
        const existing = await QueueTicket.findOne({
          appointment_id: payload.appointment_id,
          status: { $in: ACTIVE_QUEUE_STATUSES },
        }).lean();
        if (existing) return getQueueTicketDetail(existing._id, actor);
      }
      if (isDuplicateQueueNumberError(error) && attempt < 2) continue;
      if (isDuplicateQueueNumberError(error)) {
        throw createError('Queue number đã được cấp cho bác sĩ/khoa trong ngày này.', 409);
      }
      throw error;
    }
  }

  if (!ticketId && payload.appointment_id) {
    const existing = await QueueTicket.findOne({
      appointment_id: payload.appointment_id,
      status: { $in: ACTIVE_QUEUE_STATUSES },
    }).lean();
    if (existing) return getQueueTicketDetail(existing._id, actor);
  }

  if (!ticketId) {
    if (payload.appointment_id) {
      const existing = await QueueTicket.findOne({
        appointment_id: payload.appointment_id,
        status: { $in: ACTIVE_QUEUE_STATUSES },
      }).lean();
      if (existing) return getQueueTicketDetail(existing._id, actor);
    }
    throw createError('Không thể tạo queue ticket.', 409);
  }

  await recordAuditLog({
    actor,
    action: 'queue.create',
    targetType: 'queue_ticket',
    targetId: ticketId,
    status: 'success',
    message: 'Tạo queue ticket thành công.',
    requestMeta,
  });

  const createdTicket = await QueueTicket.findById(ticketId).lean();
  if (!payload.skip_service_preparation) {
    try {
      const nursingPreparationService = require('./nursing-preparation.service');
      await nursingPreparationService.ensurePreExamPreparationForQueue(ticketId, actor, requestMeta);
    } catch (error) {
      await recordAuditLog({
        actor,
        action: 'nursing.pre_exam_preparation.auto_create_failed',
        targetType: 'queue_ticket',
        targetId: ticketId,
        status: 'failure',
        message: error.message || 'Không thể tự tạo ca chuẩn bị trước khám.',
        requestMeta,
      });
    }
  }
  await publishQueueEvent(REALTIME_EVENT_TYPE.QUEUE_TICKET_CREATED, createdTicket, {
    notification: {
      title: 'Bạn đã được thêm vào hàng chờ',
      body: `Số thứ tự ${createdTicket?.display_number || createdTicket?.queue_number || ''}`.trim(),
      priority: 'normal',
    },
  });

  return getQueueTicketDetail(ticketId, actor);
}

async function listQueueTickets(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.department_id) filter.department_id = query.department_id;
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.status) filter.status = query.status;
  filter.queue_date = getStartOfDay(query.date || new Date());
  applyQueueReadScope(filter, actor);

  const [items, total] = await Promise.all([
    QueueTicket.find(filter).sort({ checkin_time: 1, queue_number: 1 }).skip(skip).limit(limit).lean(),
    QueueTicket.countDocuments(filter),
  ]);
  const refs = await buildQueueReferenceMaps(items);

  return {
    items: items.map((item) => formatQueueTicket(item, actor, {
      patient: refs.patients.get(String(item.patient_id)),
      doctor: refs.doctors.get(String(item.doctor_id)),
      department: refs.departments.get(String(item.department_id)),
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getQueueTicketDetail(ticketId, actor = {}) {
  const ticket = await QueueTicket.findById(ticketId).lean();
  if (!ticket) {
    throw createError('Không tìm thấy queue ticket.', 404);
  }
  assertQueueReadable(ticket, actor);
  const [patient, doctor, department] = await Promise.all([
    Patient.findById(ticket.patient_id).select('patient_code full_name phone').lean(),
    User.findById(ticket.doctor_id).select('full_name employee_code').lean(),
    Department.findById(ticket.department_id).select('department_name department_code').lean(),
  ]);

  return {
    queue_ticket: formatQueueTicket(ticket, actor, { patient, doctor, department }, { includePatientPhone: true }),
  };
}

async function callNextQueue({ department_id, doctor_id }, actor, requestMeta = {}) {
  const target = scopedQueueTarget({ department_id, doctor_id }, actor, 'call');
  const ticket = await getNextWaitingQueueTicket(target);
  if (!ticket) {
    throw createError('Không còn bệnh nhân nào đang chờ.', 404);
  }
  assertQueueWritable(ticket, actor, 'call');
  const activeInService = await QueueTicket.findOne({
    doctor_id: ticket.doctor_id,
    queue_date: ticket.queue_date,
    status: QUEUE_STATUS.IN_SERVICE,
    _id: { $ne: ticket._id },
  }).lean();
  if (activeInService) {
    throw createError('Bác sĩ đang có bệnh nhân in_service, chưa thể gọi số tiếp theo.', 409);
  }

  validateQueueStatusTransition(ticket.status, QUEUE_STATUS.CALLED);
  const now = new Date();
  const claimedTicket = await QueueTicket.findOneAndUpdate(
    { _id: ticket._id, status: QUEUE_STATUS.WAITING },
    { $set: { status: QUEUE_STATUS.CALLED, called_time: now, updated_by: actor?.userId } },
    { new: true },
  );
  if (!claimedTicket) {
    return callNextQueue(target, actor, requestMeta);
  }

  await QueueTicket.updateMany(
    {
      doctor_id: claimedTicket.doctor_id,
      queue_date: claimedTicket.queue_date,
      status: { $in: [QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED] },
      _id: { $ne: claimedTicket._id },
    },
    {
      $set: {
        status: QUEUE_STATUS.SKIPPED,
        updated_by: actor?.userId,
      },
    },
  );

  await recordAuditLog({
    actor,
    action: 'queue.call_next',
    targetType: 'queue_ticket',
    targetId: claimedTicket._id,
    status: 'success',
    message: 'Gọi số tiếp theo thành công.',
    requestMeta,
  });

  await publishQueueEvent(REALTIME_EVENT_TYPE.QUEUE_CALLED, claimedTicket, {
    called_time: claimedTicket.called_time,
    notification: {
      title: 'Đã tới lượt của bạn',
      body: `Số ${claimedTicket.display_number || claimedTicket.queue_number} đang được gọi.`,
      priority: 'urgent',
    },
  });

  return getQueueTicketDetail(claimedTicket._id, actor);
}

async function callQueueTicket(ticketId, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  assertQueueWritable(ticket, actor, 'call');
  validateQueueStatusTransition(ticket.status, QUEUE_STATUS.CALLED);
  const activeInService = await QueueTicket.findOne({
    doctor_id: ticket.doctor_id,
    queue_date: ticket.queue_date,
    status: QUEUE_STATUS.IN_SERVICE,
    _id: { $ne: ticket._id },
  }).lean();
  if (activeInService) {
    throw createError('Bác sĩ đang có bệnh nhân in_service, chưa thể gọi queue ticket này.', 409);
  }
  await QueueTicket.updateMany(
    {
      doctor_id: ticket.doctor_id,
      queue_date: ticket.queue_date,
      status: { $in: [QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED] },
      _id: { $ne: ticket._id },
    },
    { $set: { status: QUEUE_STATUS.SKIPPED, updated_by: actor?.userId } },
  );
  ticket.status = QUEUE_STATUS.CALLED;
  ticket.called_time = new Date();
  ticket.updated_by = actor?.userId;
  await ticket.save();

  await recordAuditLog({
    actor,
    action: 'queue.call',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Gọi queue ticket thành công.',
    requestMeta,
  });

  await publishQueueEvent(REALTIME_EVENT_TYPE.QUEUE_CALLED, ticket, {
    called_time: ticket.called_time,
    notification: {
      title: 'Đã tới lượt của bạn',
      body: `Số ${ticket.display_number || ticket.queue_number} đang được gọi.`,
      priority: 'urgent',
    },
  });

  return getQueueTicketDetail(ticket._id, actor);
}

async function getNextWaitingQueueTicket({ department_id, doctor_id } = {}) {
  const filter = {
    status: QUEUE_STATUS.WAITING,
    queue_date: getStartOfDay(new Date()),
  };
  if (department_id) filter.department_id = department_id;
  if (doctor_id) filter.doctor_id = doctor_id;

  const candidates = await QueueTicket.find(filter).sort({ checkin_time: 1, queue_number: 1 }).limit(50);
  return candidates.sort((left, right) => {
    const priorityDiff = (QUEUE_PRIORITY_WEIGHT[right.queue_type] || 0) - (QUEUE_PRIORITY_WEIGHT[left.queue_type] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(left.checkin_time || left.created_at) - new Date(right.checkin_time || right.created_at);
  })[0] || null;
}

async function recallQueueTicket(ticketId, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  assertQueueWritable(ticket, actor, 'recall');
  validateQueueStatusTransition(ticket.status, QUEUE_STATUS.RECALLED);
  ticket.status = QUEUE_STATUS.RECALLED;
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

  await publishQueueEvent(REALTIME_EVENT_TYPE.QUEUE_RECALLED, ticket, {
    called_time: ticket.called_time,
    notification: {
      title: 'Số thứ tự được gọi lại',
      body: `Số ${ticket.display_number || ticket.queue_number} đang được gọi lại.`,
      priority: 'urgent',
    },
  });

  return getQueueTicketDetail(ticket._id, actor);
}

async function skipQueueTicket(ticketId, payload = {}, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  assertQueueWritable(ticket, actor, 'skip');
  validateQueueStatusTransition(ticket.status, QUEUE_STATUS.SKIPPED);
  ticket.status = QUEUE_STATUS.SKIPPED;
  ticket.skipped_at = new Date();
  ticket.skip_reason = payload.reason || payload.skip_reason || ticket.skip_reason;
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

  await publishQueueEvent(REALTIME_EVENT_TYPE.QUEUE_SKIPPED, ticket, {
    skip_reason: ticket.skip_reason,
  });

  return getQueueTicketDetail(ticket._id, actor);
}

async function startQueueService(ticketId, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  assertQueueWritable(ticket, actor, 'start_service');
  if (![QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED].includes(ticket.status)) {
    throw createError('Chỉ queue ticket đã called/recalled mới được bắt đầu phục vụ.', 409);
  }
  validateQueueStatusTransition(ticket.status, QUEUE_STATUS.IN_SERVICE);
  let encounterId = ticket.encounter_id;
  try {
    await withOptionalTransaction(async (session) => {
    const activeInService = await QueueTicket.findOne({
      doctor_id: ticket.doctor_id,
      queue_date: ticket.queue_date,
      status: QUEUE_STATUS.IN_SERVICE,
      _id: { $ne: ticket._id },
    }).session(session).lean();
    if (activeInService) {
      throw createError('Bác sĩ đang có bệnh nhân in_service khác.', 409);
    }

    const activeEncounter = await Encounter.findOne({
      attending_doctor_id: ticket.doctor_id,
      ...(ticket.encounter_id ? { _id: { $ne: ticket.encounter_id } } : {}),
      status: { $in: [ENCOUNTER_STATUS.IN_PROGRESS, ENCOUNTER_STATUS.ON_HOLD] },
    }).session(session).lean();
    if (activeEncounter) {
      throw createError('Bác sĩ đang có encounter active khác.', 409);
    }

    let appointment = null;
    if (ticket.appointment_id) {
      appointment = await Appointment.findById(ticket.appointment_id).session(session);
      if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment của queue.', 404);
      if (![APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_CONSULTATION].includes(appointment.status)) {
        throw createError('Appointment chưa check-in hoặc không ở trạng thái khám.', 409);
      }
      if (appointment.status === APPOINTMENT_STATUS.CHECKED_IN) {
        appointment.status = APPOINTMENT_STATUS.IN_CONSULTATION;
        appointment.updated_by = actor?.userId;
        await appointment.save(sessionOptions(session));
        await scheduleService.markSlotBookedForAppointment(appointment, actor, requestMeta, { session });
      }
    }

    let encounter = encounterId
      ? await Encounter.findById(encounterId).session(session)
      : ticket.appointment_id
        ? await Encounter.findOne({ appointment_id: ticket.appointment_id }).session(session)
        : null;
    if (!encounter && appointment) {
      const encounterCode = await generateBusinessCode(CODE_TYPE.ENCOUNTER, { session });
      const now = new Date();
      encounter = await Encounter.create([{
        patient_id: ticket.patient_id,
        appointment_id: appointment._id,
        department_id: ticket.department_id,
        attending_doctor_id: ticket.doctor_id,
        encounter_code: encounterCode,
        encounter_type: appointment.appointment_type === 'telemedicine' ? 'telemedicine' : 'outpatient',
        start_time: now,
        started_at: now,
        started_by: actor?.userId,
        chief_reason: appointment.reason,
        status: ENCOUNTER_STATUS.IN_PROGRESS,
        created_by: actor?.userId,
      }], sessionOptions(session)).then((items) => items[0]);
    }
    if (encounter && encounter.status === ENCOUNTER_STATUS.CANCELLED) {
      throw createError('Encounter gắn với queue đã bị hủy.', 409);
    }
    if (encounter) {
      encounterId = encounter._id;
    }

    ticket.status = QUEUE_STATUS.IN_SERVICE;
    ticket.service_start_time = new Date();
    ticket.encounter_id = encounterId || ticket.encounter_id;
    ticket.updated_by = actor?.userId;
    await ticket.save(sessionOptions(session));
    }, { fallbackToNoTransaction: true });
  } catch (error) {
    if (error?.code === 11000) throw createError('Appointment/queue đã có encounter active.', 409);
    throw error;
  }

  await recordAuditLog({
    actor,
    action: 'queue.start_service',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Bắt đầu phục vụ queue ticket thành công.',
    requestMeta,
  });

  await publishQueueEvent(REALTIME_EVENT_TYPE.QUEUE_SERVICE_STARTED, ticket, {
    service_start_time: ticket.service_start_time,
    encounter_id: ticket.encounter_id,
    notification: {
      title: 'Lượt khám đã bắt đầu',
      body: `Số ${ticket.display_number || ticket.queue_number} đang được phục vụ.`,
      priority: 'normal',
    },
  });

  return getQueueTicketDetail(ticket._id, actor);
}

async function completeQueueTicket(ticketId, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  assertQueueWritable(ticket, actor, 'complete');
  validateQueueStatusTransition(ticket.status, QUEUE_STATUS.COMPLETED);
  await withOptionalTransaction(async (session) => {
    const encounter = ticket.encounter_id
      ? await Encounter.findById(ticket.encounter_id).session(session).lean()
      : ticket.appointment_id
        ? await Encounter.findOne({ appointment_id: ticket.appointment_id, status: { $ne: ENCOUNTER_STATUS.CANCELLED } }).session(session).lean()
        : null;
    if (!encounter) {
      throw createError('Không thể complete queue ticket khi chưa có encounter hợp lệ.', 409);
    }
    if (encounter.status !== ENCOUNTER_STATUS.COMPLETED) {
      throw createError('Encounter phải completed trước khi complete queue ticket.', 409);
    }

    ticket.status = QUEUE_STATUS.COMPLETED;
    ticket.completed_time = new Date();
    ticket.updated_by = actor?.userId;
    await ticket.save(sessionOptions(session));

    if (ticket.appointment_id) {
      const appointment = await Appointment.findById(ticket.appointment_id).session(session);
      if (appointment && !appointment.is_deleted && [APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_CONSULTATION].includes(appointment.status)) {
        appointment.status = APPOINTMENT_STATUS.COMPLETED;
        appointment.completed_at = appointment.completed_at || new Date();
        appointment.updated_by = actor?.userId;
        await appointment.save(sessionOptions(session));
        await scheduleService.markSlotOutcomeForAppointment(appointment, APPOINTMENT_STATUS.COMPLETED, actor, requestMeta, { session });
      }
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'queue.complete',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Hoàn tất queue ticket thành công.',
    requestMeta,
  });

  await publishQueueEvent(REALTIME_EVENT_TYPE.QUEUE_COMPLETED, ticket, {
    completed_time: ticket.completed_time,
  });

  return getQueueTicketDetail(ticket._id, actor);
}

async function cancelQueueTicket(ticketId, payload = {}, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  assertQueueWritable(ticket, actor, 'cancel');
  if (ticket.status === QUEUE_STATUS.IN_SERVICE) {
    throw createError('Queue đang in_service, cần xử lý encounter trước khi hủy.', 409);
  }
  validateQueueStatusTransition(ticket.status, QUEUE_STATUS.CANCELLED);
  await withOptionalTransaction(async (session) => {
    ticket.status = QUEUE_STATUS.CANCELLED;
    ticket.cancelled_at = new Date();
    ticket.cancel_reason = payload.reason || payload.cancel_reason;
    ticket.updated_by = actor?.userId;
    await ticket.save(sessionOptions(session));

    if (ticket.appointment_id && payload.cancel_appointment === true) {
      const appointment = await Appointment.findById(ticket.appointment_id).session(session);
      if (appointment && !appointment.is_deleted && ![APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW, APPOINTMENT_STATUS.RESCHEDULED].includes(appointment.status)) {
        appointment.status = APPOINTMENT_STATUS.CANCELLED;
        appointment.cancelled_by = actor?.userId;
        appointment.cancelled_at = new Date();
        appointment.cancel_reason = payload.reason || payload.cancel_reason || 'Hủy theo queue ticket';
        appointment.updated_by = actor?.userId;
        await appointment.save(sessionOptions(session));
        await scheduleService.releaseSlotForAppointment(appointment, actor, requestMeta, undefined, { session });
      }
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'queue.cancel',
    targetType: 'queue_ticket',
    targetId: ticket._id,
    status: 'success',
    message: 'Hủy queue ticket thành công.',
    requestMeta,
  });

  await publishQueueEvent(REALTIME_EVENT_TYPE.QUEUE_CANCELLED, ticket, {
    cancel_reason: ticket.cancel_reason,
    notification: {
      title: 'Lượt hàng chờ đã bị hủy',
      body: `Số ${ticket.display_number || ticket.queue_number} đã bị hủy.`,
      priority: 'high',
    },
  });

  return getQueueTicketDetail(ticket._id, actor);
}

async function getDoctorQueueBoard(doctorId, query = {}, actor = {}) {
  const date = query.date || new Date();
  const filter = {
    doctor_id: doctorId,
    queue_date: getStartOfDay(date),
  };
  applyQueueReadScope(filter, actor);
  const items = await QueueTicket.find(filter)
    .sort({ checkin_time: 1, queue_number: 1 })
    .lean();
  const boardItem = (item) => formatQueueTicket(item, actor, {}, { includePatientData: false, includeClinicalLinks: false });

  return {
    doctor_id: String(doctorId),
    waiting: items.filter((item) => item.status === QUEUE_STATUS.WAITING).map(boardItem),
    called: items.filter((item) => [QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED].includes(item.status)).map(boardItem),
    in_service: items.filter((item) => item.status === QUEUE_STATUS.IN_SERVICE).map(boardItem),
    completed: items.filter((item) => item.status === QUEUE_STATUS.COMPLETED).map(boardItem),
  };
}

async function getDepartmentQueueBoard(departmentId, query = {}, actor = {}) {
  const date = query.date || new Date();
  const filter = {
    department_id: departmentId,
    queue_date: getStartOfDay(date),
  };
  applyQueueReadScope(filter, actor);
  const items = await QueueTicket.find(filter)
    .sort({ checkin_time: 1, queue_number: 1 })
    .lean();

  return {
    department_id: String(departmentId),
    items: items.map((item) => formatQueueTicket(item, actor, {}, { includePatientData: false, includeClinicalLinks: false })),
  };
}

async function getTodayQueueSummary(query = {}, actor = {}) {
  const date = query.date || new Date();
  const filter = {
    queue_date: getStartOfDay(date),
  };
  if (query.department_id) filter.department_id = query.department_id;
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  applyQueueReadScope(filter, actor);

  const items = await QueueTicket.find(filter).lean();
  return {
    total: items.length,
    waiting: items.filter((item) => item.status === 'waiting').length,
    called: items.filter((item) => ['called', 'recalled'].includes(item.status)).length,
    in_service: items.filter((item) => item.status === 'in_service').length,
    completed: items.filter((item) => item.status === 'completed').length,
    cancelled: items.filter((item) => item.status === 'cancelled').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
    no_show: items.filter((item) => item.status === 'no_show').length,
    max_waiting_minutes: items.reduce((max, item) => Math.max(max, item.status === 'waiting' ? queueWaitMinutes(item) : 0), 0),
  };
}

async function createQueueTicketFromAppointment(appointmentId, actor, requestMeta = {}, options = {}) {
  const session = options.session || null;
  const existing = await QueueTicket.findOne({
    appointment_id: appointmentId,
    status: { $in: ACTIVE_QUEUE_STATUSES },
  }).session(session).lean();
  if (existing) {
    return session ? { queue_ticket_id: String(existing._id), existing: true } : getQueueTicketDetail(existing._id, actor);
  }

  const appointment = await Appointment.findById(appointmentId).session(session).lean();
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment.', 404);
  if ([APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW, APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.RESCHEDULED].includes(appointment.status)) {
    throw createError('Appointment đã kết thúc nên không thể tạo queue ticket.', 409);
  }
  const appointmentDay = getStartOfDay(appointment.appointment_time);
  const today = getStartOfDay(new Date());
  if (appointmentDay.getTime() !== today.getTime()) {
    throw createError('Chỉ được check-in queue cho appointment trong ngày khám.', 409);
  }

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
    options,
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
  const [patient, doctor, department, appointment, encounter] = await Promise.all([
    Patient.findById(ticket.patient_id).lean(),
    User.findById(ticket.doctor_id).lean(),
    Department.findById(ticket.department_id).lean(),
    ticket.appointment_id ? Appointment.findById(ticket.appointment_id).lean() : null,
    ticket.encounter_id ? Encounter.findById(ticket.encounter_id).lean() : null,
  ]);
  const reasons = [];
  if (!['called', 'recalled', 'in_service'].includes(ticket.status)) reasons.push('Queue chưa ở trạng thái có thể tạo encounter.');
  if (!patient || patient.is_deleted || patient.status !== 'active') reasons.push('Bệnh nhân không active.');
  if (!doctor || doctor.is_deleted || doctor.status !== 'active') reasons.push('Bác sĩ không active.');
  if (!department || department.is_deleted || department.status !== 'active') reasons.push('Department không active.');
  if (appointment && ![APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_CONSULTATION].includes(appointment.status)) reasons.push('Appointment chưa check-in hoặc không ở trạng thái khám.');
  if (encounter && ![ENCOUNTER_STATUS.CANCELLED].includes(encounter.status)) reasons.push('Queue đã có encounter.');
  return {
    queue_ticket_id: String(ticket._id),
    can_create_encounter: reasons.length === 0,
    status: ticket.status,
    reasons,
  };
}

async function reorderQueuePriority(ticketId, payload = {}, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  assertQueueWritable(ticket, actor, 'reorder');
  if (![QUEUE_STATUS.WAITING, QUEUE_STATUS.SKIPPED].includes(ticket.status)) {
    throw createError('Chỉ được đổi ưu tiên khi queue đang waiting hoặc skipped.', 409);
  }
  if (payload.queue_type && !Object.values(QUEUE_TYPE).includes(payload.queue_type)) {
    throw createError('queue_type không hợp lệ.', 400);
  }

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

  return getQueueTicketDetail(ticket._id, actor);
}

async function transferQueueTicket(ticketId, payload = {}, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  assertQueueWritable(ticket, actor, 'transfer');
  if (![QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.SKIPPED, QUEUE_STATUS.RECALLED].includes(ticket.status)) {
    throw createError('Không thể transfer queue đang in_service/completed/cancelled.', 409);
  }
  const targetDoctorId = payload.doctor_id || ticket.doctor_id;
  const targetDepartmentId = payload.department_id || ticket.department_id;
  assertQueueTargetWritable({ doctor_id: targetDoctorId, department_id: targetDepartmentId }, actor, 'transfer');
  if (ticket.appointment_id) {
    const appointment = await Appointment.findById(ticket.appointment_id).lean();
    if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment của queue ticket.', 404);
    if (!sameId(appointment.doctor_id, targetDoctorId) || !sameId(appointment.department_id, targetDepartmentId)) {
      throw createError('Không được transfer queue đã gắn appointment sang bác sĩ/khoa khác; cần reschedule appointment trước.', 409);
    }
  }
  await validateQueueCreation({
    patient_id: ticket.patient_id,
    appointment_id: undefined,
    doctor_id: targetDoctorId,
    department_id: targetDepartmentId,
    checkin_time: ticket.checkin_time || new Date(),
    exclude_ticket_id: ticket._id,
  });

  ticket.doctor_id = targetDoctorId;
  ticket.department_id = targetDepartmentId;
  ticket.queue_number = await generateQueueNumber({
    department_id: targetDepartmentId,
    doctor_id: targetDoctorId,
    checkin_date: ticket.checkin_time || new Date(),
    queue_type: ticket.queue_type,
  });
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

  await publishQueueEvent(REALTIME_EVENT_TYPE.QUEUE_TRANSFERRED, ticket, {
    doctor_id: ticket.doctor_id,
    department_id: ticket.department_id,
  });

  return getQueueTicketDetail(ticket._id, actor);
}

async function getQueueTimeline(ticketId, query = {}, actor = {}) {
  const ticket = await QueueTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  assertQueueReadable(ticket, actor);

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
    items: items.map(formatAuditTimelineItem),
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

async function getMyCurrentQueue(actor = {}) {
  const patientId = getPortalPatientId(actor);
  if (!patientId) throw createError('Không xác định được patient.', 403);
  return QueueTicket.findOne({
    patient_id: patientId,
    status: { $in: ACTIVE_QUEUE_STATUSES },
  }).sort({ queue_date: -1, created_at: -1 }).lean();
}

async function getMyCurrentQueueDetail(actor = {}) {
  const patientId = getPortalPatientId(actor);
  if (!patientId) throw createError('Không xác định được patient.', 403);
  const ticket = await getMyCurrentQueue(actor);
  if (!ticket) return null;

  const queueDateStart = getStartOfDay(ticket.queue_date || new Date());
  const queueDateEnd = getEndOfDay(ticket.queue_date || new Date());
  const queueScope = {
    department_id: ticket.department_id,
    queue_date: { $gte: queueDateStart, $lte: queueDateEnd },
  };
  if (ticket.doctor_id) queueScope.doctor_id = ticket.doctor_id;

  const [currentServing, peopleAhead, department, doctor, appointment] = await Promise.all([
    QueueTicket.findOne({
      ...queueScope,
      status: { $in: [QUEUE_STATUS.IN_SERVICE, QUEUE_STATUS.CALLED] },
    }).sort({ service_start_time: -1, called_time: -1, created_at: -1 }).lean(),
    QueueTicket.countDocuments({
      ...queueScope,
      status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED, QUEUE_STATUS.SKIPPED, QUEUE_STATUS.IN_SERVICE] },
      created_at: { $lt: ticket.created_at },
    }),
    Department.findById(ticket.department_id).select('department_name department_code location room floor building').lean(),
    User.findById(ticket.doctor_id).select('full_name employee_code').lean(),
    ticket.appointment_id ? Appointment.findById(ticket.appointment_id).select('appointment_time reason status').lean() : null,
  ]);

  const estimatedWaitMinutes = ticket.estimated_called_at
    ? Math.max(0, Math.round((new Date(ticket.estimated_called_at).getTime() - Date.now()) / 60000))
    : peopleAhead * 6;

  return {
    ...ticket,
    queue_ticket_id: String(ticket._id),
    ticket_no: ticket.display_number || ticket.queue_number,
    current_serving_no: currentServing ? currentServing.display_number || currentServing.queue_number : null,
    people_ahead: peopleAhead,
    estimated_wait_minutes: estimatedWaitMinutes,
    room: {
      name: ticket.doctor_room_id || department?.location || department?.room || '',
      floor: department?.floor || '',
      building: department?.building || '',
      department_name: department?.department_name || '',
      department_code: department?.department_code || '',
    },
    doctor: doctor
      ? {
          doctor_id: String(doctor._id),
          name: doctor.full_name,
          code: doctor.employee_code,
        }
      : null,
    appointment: appointment
      ? {
          appointment_id: String(appointment._id),
          appointment_time: appointment.appointment_time,
          reason: appointment.reason,
          status: appointment.status,
        }
      : null,
  };
}

async function getPublicQueueBoard(query = {}) {
  const filter = {
    status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED, QUEUE_STATUS.IN_SERVICE] },
  };
  if (query.department_id) filter.department_id = query.department_id;
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.date) {
    filter.queue_date = {
      $gte: getStartOfDay(query.date),
      $lte: getEndOfDay(query.date),
    };
  }
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), 100);
  const items = await QueueTicket.find(filter)
    .sort({ queue_date: 1, status: 1, created_at: 1 })
    .limit(limit)
    .select('queue_number display_number status department_id doctor_id estimated_called_at counter_id called_time')
    .lean();
  return { items };
}

async function generateQueueTicketQr(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  return qrTokenService.createQueueTicketQr(ticketId, payload, actor, requestMeta);
}

async function markQueueTicketNoShow(ticketId, payload = {}, actor = {}, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  assertQueueWritable(ticket, actor, 'cancel');
  if (TERMINAL_QUEUE_STATUSES.includes(ticket.status)) throw createError('Queue ticket đã ở trạng thái kết thúc.', 409);
  ticket.status = QUEUE_STATUS.NO_SHOW;
  ticket.no_show_at = new Date();
  ticket.no_show_reason = payload.reason || payload.no_show_reason;
  ticket.updated_by = actor.userId;
  await ticket.save();
  await recordAuditLog({ actor, action: 'queue.no_show', targetType: 'queue_ticket', targetId: ticket._id, status: 'success', message: 'Mark queue ticket no-show.', requestMeta });
  await publishQueueEvent(REALTIME_EVENT_TYPE.QUEUE_NO_SHOW, ticket, {
    no_show_reason: ticket.no_show_reason,
    notification: {
      title: 'Lượt hàng chờ đã bị đánh dấu vắng mặt',
      body: `Số ${ticket.display_number || ticket.queue_number} đã bị đánh dấu no-show.`,
      priority: 'high',
    },
  });
  return getQueueTicketDetail(ticket._id, actor);
}

module.exports = {
  // createQueueTicket: Tạo phiếu hàng đợi.
  createQueueTicket,
  // listQueueTickets: Liệt kê phiếu hàng đợi.
  listQueueTickets,
  // getQueueTicketDetail: Lấy chi tiết phiếu hàng đợi.
  getQueueTicketDetail,
  // getNextWaitingQueueTicket: Lấy phiếu hàng đợi tiếp theo đang chờ.
  getNextWaitingQueueTicket,
  // callQueueTicket: Gọi phiếu hàng đợi.
  callQueueTicket,
  // callNextQueue: Gọi lượt hàng đợi tiếp theo.
  callNextQueue,
  // recallQueueTicket: Thu hồi/gọi lại phiếu hàng đợi.
  recallQueueTicket,
  // skipQueueTicket: Bỏ qua phiếu hàng đợi.
  skipQueueTicket,
  // startQueueService: Bắt đầu phục vụ phiếu hàng đợi.
  startQueueService,
  // completeQueueTicket: Hoàn tất phiếu hàng đợi.
  completeQueueTicket,
  // cancelQueueTicket: Hủy phiếu hàng đợi.
  cancelQueueTicket,
  // reorderQueuePriority: Sắp xếp lại độ ưu tiên hàng đợi.
  reorderQueuePriority,
  // transferQueueTicket: Chuyển phiếu hàng đợi.
  transferQueueTicket,
  // getQueueTimeline: Lấy dòng thời gian hàng đợi.
  getQueueTimeline,
  // completeQueueTicketByEncounter: Hoàn tất phiếu hàng đợi theo lượt khám.
  completeQueueTicketByEncounter,
  // getDoctorQueueBoard: Lấy bảng hàng đợi của bác sĩ.
  getDoctorQueueBoard,
  // getDepartmentQueueBoard: Lấy bảng hàng đợi của khoa/phòng ban.
  getDepartmentQueueBoard,
  // getTodayQueueSummary: Lấy tổng hợp hàng đợi trong ngày.
  getTodayQueueSummary,
  // createQueueTicketFromAppointment: Tạo phiếu hàng đợi từ lịch hẹn.
  createQueueTicketFromAppointment,
  // checkInPatientToQueue: Ghi nhận check-in cho bệnh nhân vào hàng đợi.
  checkInPatientToQueue,
  // validateQueueCreation: Kiểm tra tính hợp lệ của điều kiện tạo phiếu hàng đợi.
  validateQueueCreation,
  // generateQueueNumber: Sinh/tạo số thứ tự hàng đợi.
  generateQueueNumber,
  // validateQueueStatusTransition: Kiểm tra tính hợp lệ của chuyển trạng thái hàng đợi.
  validateQueueStatusTransition,
  // checkQueueTicketCanCreateEncounter: Kiểm tra điều kiện tạo lượt khám từ phiếu hàng đợi.
  checkQueueTicketCanCreateEncounter,
  getMyCurrentQueue,
  getMyCurrentQueueDetail,
  getPublicQueueBoard,
  generateQueueTicketQr,
  markQueueTicketNoShow,
};
