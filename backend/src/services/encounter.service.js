const {
  Appointment,
  AuditLog,
  ClinicalNote,
  Consultation,
  Department,
  Diagnosis,
  Encounter,
  MedicalRecord,
  Order,
  Patient,
  Prescription,
  QueueTicket,
  User,
  VitalSign,
} = require('../models');
const {
  buildPagination,
  createError,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const {
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  CLINICAL_NOTE_STATUS,
  CONSULTATION_STATUS,
  DIAGNOSIS_STATUS,
  ENCOUNTER_STATUS,
  ENCOUNTER_TYPES,
  MEDICAL_RECORD_STATUS,
  ORDER_STATUS,
  PATIENT_STATUS,
  PRESCRIPTION_STATUS,
  QUEUE_STATUS,
  RECORD_TYPE,
} = require('../constants/statuses');
const { ENCOUNTER_TRANSITIONS } = require('../constants/transitions');
const { assertTransition } = require('../shared/utils/status-transition');
const { withOptionalTransaction } = require('../shared/utils/transaction');
const { PERMISSION } = require('../constants/permissions');
const permissionService = require('./permission.service');
const scheduleService = require('./schedule.service');
const billingService = require('./billing.service');

const ACTIVE_ENCOUNTER_STATUSES = [
  ENCOUNTER_STATUS.PLANNED,
  ENCOUNTER_STATUS.ARRIVED,
  ENCOUNTER_STATUS.IN_PROGRESS,
  ENCOUNTER_STATUS.ON_HOLD,
];

const STARTABLE_ENCOUNTER_STATUSES = [
  ENCOUNTER_STATUS.PLANNED,
  ENCOUNTER_STATUS.ARRIVED,
  ENCOUNTER_STATUS.ON_HOLD,
];

const COMPLETABLE_ENCOUNTER_STATUSES = [
  ENCOUNTER_STATUS.IN_PROGRESS,
  ENCOUNTER_STATUS.ON_HOLD,
];

const TERMINAL_ENCOUNTER_STATUSES = [
  ENCOUNTER_STATUS.COMPLETED,
  ENCOUNTER_STATUS.CANCELLED,
];

const QUEUE_CAN_START_ENCOUNTER_STATUSES = [
  QUEUE_STATUS.CALLED,
  QUEUE_STATUS.RECALLED,
  QUEUE_STATUS.IN_SERVICE,
];

const APPOINTMENT_CAN_CREATE_ENCOUNTER_STATUSES = [
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.CHECKED_IN,
  APPOINTMENT_STATUS.IN_CONSULTATION,
];

const BLOCKING_PRESCRIPTION_STATUSES = [PRESCRIPTION_STATUS.DRAFT];
const ACTIVE_PRESCRIPTION_STATUSES = [
  PRESCRIPTION_STATUS.ACTIVE,
  PRESCRIPTION_STATUS.VERIFIED,
  PRESCRIPTION_STATUS.PARTIALLY_DISPENSED,
];
const BLOCKING_ORDER_STATUSES = [
  ORDER_STATUS.DRAFT,
  ORDER_STATUS.ORDERED,
  ORDER_STATUS.ACKNOWLEDGED,
  ORDER_STATUS.IN_PROGRESS,
];

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function sameId(left, right) {
  return String(left?._id || left || '') === String(right?._id || right || '');
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function isPatientActor(actor = {}) {
  return actorType(actor) === 'patient';
}

function actorRoles(actor = {}) {
  return Array.isArray(actor.roles) ? actor.roles : [];
}

function hasRole(actor = {}, roleCode) {
  return actorRoles(actor).includes(roleCode);
}

function hasGlobalEncounterScope(actor = {}) {
  return hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS])
    || hasRole(actor, 'super_admin')
    || hasRole(actor, 'admin')
    || hasRole(actor, 'manager');
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes);
}

function normalizeDuplicateKeyError(error, message = 'Encounter trùng với ràng buộc duy nhất.') {
  if (error?.code === 11000) throw createError(message, 409);
  throw error;
}

function assertEncounterTargetWritable(target = {}, actor = {}, permissions = []) {
  if (!actorType(actor)) return true;
  if (isPatientActor(actor)) throw createError('Patient không có quyền tạo/sửa encounter.', 403);
  if (!hasAnyPermission(actor, permissions) && !hasGlobalEncounterScope(actor)) {
    throw createError('Bạn không có quyền thao tác encounter.', 403);
  }
  if (hasGlobalEncounterScope(actor)) return true;

  if (hasRole(actor, 'doctor')) {
    if (actor.userId && target.attending_doctor_id && sameId(target.attending_doctor_id, actor.userId)) return true;
    throw createError('Bác sĩ chỉ được thao tác encounter của chính mình.', 403);
  }

  const departmentId = actorDepartmentId(actor);
  if (departmentId && target.department_id && sameId(target.department_id, departmentId)) return true;
  if (actor.userId && target.attending_doctor_id && sameId(target.attending_doctor_id, actor.userId)) return true;

  throw createError('Bạn không có quyền thao tác encounter ngoài phạm vi được phân quyền.', 403);
}

async function assertNoOtherInProgressEncounterForDoctor(doctorId, excludeEncounterId = null, session = null) {
  const existing = await withSession(
    Encounter.findOne({
      attending_doctor_id: doctorId,
      ...(excludeEncounterId ? { _id: { $ne: excludeEncounterId } } : {}),
      status: { $in: [ENCOUNTER_STATUS.IN_PROGRESS, ENCOUNTER_STATUS.ON_HOLD] },
    }).lean(),
    session,
  );
  if (existing) throw createError('Bác sĩ đang có encounter active khác.', 409);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactPatient(patient) {
  if (!patient) return null;
  return {
    patient_id: String(patient._id),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    date_of_birth: patient.date_of_birth,
    gender: patient.gender,
    phone: patient.phone,
    status: patient.status,
  };
}

function compactUser(user) {
  if (!user) return null;
  return {
    user_id: String(user._id),
    full_name: user.full_name,
    employee_code: user.employee_code,
    department_id: user.department_id ? String(user.department_id) : null,
    status: user.status,
  };
}

function compactDepartment(department) {
  if (!department) return null;
  return {
    department_id: String(department._id),
    department_code: department.department_code,
    department_name: department.department_name,
    status: department.status,
  };
}

function serializeEncounter(encounter) {
  return {
    encounter_id: String(encounter._id),
    encounter_code: encounter.encounter_code,
    patient_id: String(encounter.patient_id?._id || encounter.patient_id),
    appointment_id: encounter.appointment_id ? String(encounter.appointment_id?._id || encounter.appointment_id) : null,
    department_id: String(encounter.department_id?._id || encounter.department_id),
    attending_doctor_id: String(encounter.attending_doctor_id?._id || encounter.attending_doctor_id),
    encounter_type: encounter.encounter_type,
    start_time: encounter.start_time,
    end_time: encounter.end_time,
    chief_reason: encounter.chief_reason,
    status: encounter.status,
    started_at: encounter.started_at,
    held_at: encounter.held_at,
    hold_reason: encounter.hold_reason,
    resumed_at: encounter.resumed_at,
    cancelled_at: encounter.cancelled_at,
    cancel_reason: encounter.cancel_reason,
    reopened_at: encounter.reopened_at,
    reopen_reason: encounter.reopen_reason,
    created_at: encounter.created_at,
    updated_at: encounter.updated_at,
    patient: compactPatient(encounter.patient_id?._id ? encounter.patient_id : null),
    attending_doctor: compactUser(encounter.attending_doctor_id?._id ? encounter.attending_doctor_id : null),
    department: compactDepartment(encounter.department_id?._id ? encounter.department_id : null),
  };
}

function serializeAuditTimelineItem(item) {
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

function mapAppointmentTypeToEncounterType(appointmentType) {
  if (appointmentType === APPOINTMENT_TYPE.TELEMEDICINE) return 'telemedicine';
  if (appointmentType === APPOINTMENT_TYPE.EMERGENCY) return 'emergency';
  if (appointmentType === APPOINTMENT_TYPE.INPATIENT_FOLLOWUP) return 'inpatient';
  return 'outpatient';
}

function validateEncounterStatusTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  return assertTransition(ENCOUNTER_TRANSITIONS, currentStatus, nextStatus, 'encounter');
}

async function generateEncounterCode(options = {}) {
  return generateBusinessCode(CODE_TYPE.ENCOUNTER, {
    date: options.date || new Date(),
    session: options.session || null,
  });
}

function applyEncounterReadScope(filter, actor = {}) {
  if (!actorType(actor)) return filter;

  if (isPatientActor(actor)) {
    filter.patient_id = actor.patientId;
    filter.status = ENCOUNTER_STATUS.COMPLETED;
    return filter;
  }

  if (hasGlobalEncounterScope(actor)) {
    return filter;
  }

  if (hasRole(actor, 'doctor') || hasPermission(actor, PERMISSION.ENCOUNTERS.READ_OWN)) {
    if (!actor.userId || (filter.attending_doctor_id && !sameId(filter.attending_doctor_id, actor.userId))) {
      filter._id = null;
      return filter;
    }
    filter.attending_doctor_id = actor.userId;
    return filter;
  }

  if (hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.READ, PERMISSION.REPORTS.ENCOUNTERS_READ])) {
    return filter;
  }

  if (hasAnyPermission(actor, [
    PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    PERMISSION.ENCOUNTERS.READ_ASSIGNED,
  ])) {
    const departmentId = actorDepartmentId(actor);
    if (departmentId) {
      if (filter.department_id && !sameId(filter.department_id, departmentId)) {
        filter._id = null;
        return filter;
      }
      filter.department_id = departmentId;
      return filter;
    }
  }

  filter._id = null;
  return filter;
}

function assertEncounterScoped(encounter, actor = {}, options = {}) {
  if (!actorType(actor)) return true;

  const globalPermissions = [
    PERMISSION.ENCOUNTERS.READ,
    PERMISSION.SYSTEM.FULL_ACCESS,
    ...(options.globalPermissions || []),
  ].filter(Boolean);

  if (hasGlobalEncounterScope(actor)) return true;

  if (isPatientActor(actor)) {
    if (!sameId(encounter.patient_id, actor.patientId)) {
      throw createError('Bạn không có quyền truy cập encounter này.', 403);
    }
    if (encounter.status !== ENCOUNTER_STATUS.COMPLETED) {
      throw createError('Bệnh nhân chỉ được xem encounter đã hoàn tất.', 403);
    }
    return true;
  }

  if (hasRole(actor, 'doctor')) {
    if (
      actor.userId
      && sameId(encounter.attending_doctor_id, actor.userId)
      && hasAnyPermission(actor, [
        PERMISSION.ENCOUNTERS.READ_OWN,
        PERMISSION.ENCOUNTERS.READ_ASSIGNED,
        PERMISSION.ENCOUNTERS.UPDATE_OWN,
        PERMISSION.ENCOUNTERS.COMPLETE_OWN,
        PERMISSION.ENCOUNTERS.CANCEL_OWN,
        ...(options.ownPermissions || []),
      ])
    ) {
      return true;
    }
    throw createError('Bác sĩ chỉ được truy cập encounter của chính mình.', 403);
  }

  if (hasAnyPermission(actor, globalPermissions)) return true;

  const departmentId = actorDepartmentId(actor);
  if (
    departmentId
    && sameId(encounter.department_id, departmentId)
    && hasAnyPermission(actor, [
      PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
      PERMISSION.ENCOUNTERS.READ_ASSIGNED,
      PERMISSION.ENCOUNTERS.UPDATE_NURSING_STATUS,
      ...(options.departmentPermissions || []),
    ])
  ) {
    return true;
  }

  if (
    actor.userId
    && sameId(encounter.attending_doctor_id, actor.userId)
    && hasAnyPermission(actor, [
      PERMISSION.ENCOUNTERS.READ_OWN,
      PERMISSION.ENCOUNTERS.READ_ASSIGNED,
      PERMISSION.ENCOUNTERS.UPDATE_OWN,
      PERMISSION.ENCOUNTERS.COMPLETE_OWN,
      PERMISSION.ENCOUNTERS.CANCEL_OWN,
      ...(options.ownPermissions || []),
    ])
  ) {
    return true;
  }

  throw createError('Bạn không có quyền truy cập encounter này.', 403);
}

async function findEncounterById(encounterId, session = null) {
  const encounter = await withSession(Encounter.findById(encounterId), session);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  return encounter;
}

async function findLinkedQueueTicket(encounter, session = null) {
  const filter = encounter.appointment_id
    ? { $or: [{ encounter_id: encounter._id }, { appointment_id: encounter.appointment_id }] }
    : { encounter_id: encounter._id };
  return withSession(QueueTicket.findOne(filter), session);
}

async function validateEncounterCreation(payload, actor = {}, options = {}) {
  const session = options.session || null;
  const patientId = payload.patient_id;
  const departmentId = payload.department_id;
  const doctorId = payload.attending_doctor_id;

  if (!patientId) throw createError('patient_id là bắt buộc.');
  if (!departmentId) throw createError('department_id là bắt buộc.');
  if (!doctorId) throw createError('attending_doctor_id là bắt buộc.');

  const encounterType = payload.encounter_type || ENCOUNTER_TYPES[0];
  if (!ENCOUNTER_TYPES.includes(encounterType)) {
    throw createError('encounter_type không hợp lệ.');
  }

  const [patient, department, doctor] = await Promise.all([
    withSession(Patient.findById(patientId).lean(), session),
    withSession(Department.findById(departmentId).lean(), session),
    withSession(User.findById(doctorId).lean(), session),
  ]);

  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (patient.status !== PATIENT_STATUS.ACTIVE) {
    throw createError('Chỉ được tạo encounter cho bệnh nhân active.', 409);
  }
  if (!department || department.is_deleted || department.status !== 'active') {
    throw createError('Department không tồn tại hoặc đang inactive.', 404);
  }
  if (!doctor || doctor.is_deleted || doctor.status !== 'active') {
    throw createError('Không tìm thấy bác sĩ active.', 404);
  }

  await scheduleService.validateDoctorBelongsToDepartment(doctorId, departmentId);
  assertEncounterTargetWritable(
    { department_id: departmentId, attending_doctor_id: doctorId },
    actor,
    [
      PERMISSION.ENCOUNTERS.CREATE,
      PERMISSION.ENCOUNTERS.CREATE_FROM_CHECKIN,
      PERMISSION.APPOINTMENTS.CHECKIN,
      PERMISSION.QUEUE.START_SERVICE,
    ],
  );

  let appointment = null;
  let queueTicket = null;
  let normalizedAppointmentId = payload.appointment_id || null;

  if (payload.queue_ticket_id) {
    queueTicket = await withSession(QueueTicket.findById(payload.queue_ticket_id).lean(), session);
    if (!queueTicket) throw createError('Không tìm thấy queue ticket.', 404);
    if (!sameId(queueTicket.patient_id, patientId)) throw createError('Queue ticket không thuộc bệnh nhân này.', 409);
    if (!sameId(queueTicket.doctor_id, doctorId)) throw createError('Queue ticket không thuộc bác sĩ này.', 409);
    if (!sameId(queueTicket.department_id, departmentId)) throw createError('Queue ticket không thuộc department này.', 409);
    if (!QUEUE_CAN_START_ENCOUNTER_STATUSES.includes(queueTicket.status)) {
      throw createError('Queue ticket chưa ở trạng thái có thể tạo encounter.', 409);
    }
    if (queueTicket.encounter_id) {
      const existingQueueEncounter = await withSession(
        Encounter.findOne({ _id: queueTicket.encounter_id, status: { $ne: ENCOUNTER_STATUS.CANCELLED } }).lean(),
        session,
      );
      if (existingQueueEncounter) throw createError('Queue ticket đã gắn encounter khác.', 409);
    }
    normalizedAppointmentId = normalizedAppointmentId || queueTicket.appointment_id || null;
  }

  if (normalizedAppointmentId) {
    appointment = await withSession(Appointment.findById(normalizedAppointmentId).lean(), session);
    if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment.', 404);
    if (!sameId(appointment.patient_id, patientId)) throw createError('Appointment không thuộc bệnh nhân này.', 409);
    if (!sameId(appointment.doctor_id, doctorId)) throw createError('Appointment không thuộc bác sĩ này.', 409);
    if (!sameId(appointment.department_id, departmentId)) throw createError('Appointment không thuộc department này.', 409);
    if (!APPOINTMENT_CAN_CREATE_ENCOUNTER_STATUSES.includes(appointment.status)) {
      throw createError('Appointment phải confirmed, checked_in hoặc in_consultation mới tạo encounter.', 409);
    }
    if (queueTicket?.appointment_id && !sameId(queueTicket.appointment_id, appointment._id)) {
      throw createError('Queue ticket và appointment không khớp.', 409);
    }
    const existingAppointmentEncounter = await withSession(
      Encounter.findOne({ appointment_id: appointment._id, status: { $ne: ENCOUNTER_STATUS.CANCELLED } }).lean(),
      session,
    );
    if (existingAppointmentEncounter) {
      throw createError('Appointment đã có encounter active.', 409);
    }
  }

  if (!normalizedAppointmentId && !payload.queue_ticket_id) {
    const activeDuplicate = await withSession(
      Encounter.findOne({
        patient_id: patientId,
        department_id: departmentId,
        attending_doctor_id: doctorId,
        status: { $in: ACTIVE_ENCOUNTER_STATUSES },
      }).lean(),
      session,
    );
    if (activeDuplicate) {
      throw createError('Bệnh nhân đang có encounter active với bác sĩ/khoa này.', 409);
    }
  }

  return {
    patient,
    department,
    doctor,
    appointment,
    queueTicket,
    normalized: {
      patient_id: patientId,
      appointment_id: normalizedAppointmentId,
      queue_ticket_id: payload.queue_ticket_id || null,
      department_id: departmentId,
      attending_doctor_id: doctorId,
      encounter_type: encounterType,
      chief_reason: payload.chief_reason,
      start_time: payload.start_time ? new Date(payload.start_time) : new Date(),
    },
  };
}

function resolveInitialEncounterStatus(payload, appointment, queueTicket) {
  if (payload.status && [ENCOUNTER_STATUS.PLANNED, ENCOUNTER_STATUS.ARRIVED, ENCOUNTER_STATUS.IN_PROGRESS].includes(payload.status)) {
    return payload.status;
  }
  if (payload.start_now || queueTicket?.status === QUEUE_STATUS.IN_SERVICE) return ENCOUNTER_STATUS.IN_PROGRESS;
  if (appointment || queueTicket) return ENCOUNTER_STATUS.ARRIVED;
  return ENCOUNTER_STATUS.PLANNED;
}

function advanceAppointmentForEncounter(appointment, targetEncounterStatus, actor) {
  if (!appointment) return false;

  if (targetEncounterStatus === ENCOUNTER_STATUS.IN_PROGRESS) {
    if ([APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CHECKED_IN].includes(appointment.status)) {
      appointment.status = APPOINTMENT_STATUS.IN_CONSULTATION;
      appointment.checked_in_at = appointment.checked_in_at || new Date();
      appointment.updated_by = actor?.userId;
      return true;
    }
    return false;
  }

  if (targetEncounterStatus === ENCOUNTER_STATUS.ARRIVED && appointment.status === APPOINTMENT_STATUS.CONFIRMED) {
    appointment.status = APPOINTMENT_STATUS.CHECKED_IN;
    appointment.checked_in_at = appointment.checked_in_at || new Date();
    appointment.updated_by = actor?.userId;
    return true;
  }

  return false;
}

async function createEncounter(payload, actor, requestMeta = {}, options = {}) {
  let createdEncounterId = null;

  const work = async (session) => {
    const validation = await validateEncounterCreation(payload, actor, { session });
    const { normalized, appointment, queueTicket } = validation;
    const initialStatus = resolveInitialEncounterStatus(payload, appointment, queueTicket);
    const startTime = normalized.start_time;
    if (Number.isNaN(startTime.getTime())) throw createError('start_time không hợp lệ.');
    if (initialStatus === ENCOUNTER_STATUS.IN_PROGRESS) {
      await assertNoOtherInProgressEncounterForDoctor(normalized.attending_doctor_id, null, session);
    }

    const encounterCode = payload.encounter_code || await generateEncounterCode({ date: startTime, session });
    const [encounter] = await Encounter.create([{
      patient_id: normalized.patient_id,
      appointment_id: normalized.appointment_id || undefined,
      department_id: normalized.department_id,
      attending_doctor_id: normalized.attending_doctor_id,
      encounter_code: encounterCode,
      encounter_type: normalized.encounter_type,
      start_time: startTime,
      started_at: initialStatus === ENCOUNTER_STATUS.IN_PROGRESS ? new Date() : undefined,
      started_by: initialStatus === ENCOUNTER_STATUS.IN_PROGRESS ? actor?.userId : undefined,
      chief_reason: normalized.chief_reason,
      status: initialStatus,
      created_by: actor?.userId,
    }], sessionOptions(session));

    if (appointment) {
      const appointmentDoc = await withSession(Appointment.findById(appointment._id), session);
      if (advanceAppointmentForEncounter(appointmentDoc, initialStatus, actor)) {
        await appointmentDoc.save(sessionOptions(session));
      }
    }

    if (queueTicket) {
      const queueDoc = await withSession(QueueTicket.findById(queueTicket._id), session);
      queueDoc.encounter_id = encounter._id;
      if (initialStatus === ENCOUNTER_STATUS.IN_PROGRESS && queueDoc.status !== QUEUE_STATUS.IN_SERVICE) {
        queueDoc.status = QUEUE_STATUS.IN_SERVICE;
        queueDoc.service_start_time = queueDoc.service_start_time || new Date();
      }
      queueDoc.updated_by = actor?.userId;
      await queueDoc.save(sessionOptions(session));
    } else if (appointment) {
      await withSession(
        QueueTicket.updateMany(
          { appointment_id: appointment._id, encounter_id: { $exists: false } },
          { $set: { encounter_id: encounter._id, updated_by: actor?.userId } },
        ),
        session,
      );
      await withSession(
        QueueTicket.updateMany(
          { appointment_id: appointment._id, encounter_id: null },
          { $set: { encounter_id: encounter._id, updated_by: actor?.userId } },
        ),
        session,
      );
    }

    createdEncounterId = encounter._id;
    return encounter;
  };

  if (options.session) {
    try {
      await work(options.session);
    } catch (error) {
      normalizeDuplicateKeyError(error, 'Appointment đã có encounter active.');
    }
  } else {
    try {
      await withOptionalTransaction(work, { fallbackToNoTransaction: true });
    } catch (error) {
      normalizeDuplicateKeyError(error, 'Appointment đã có encounter active.');
    }
  }

  await recordAuditLog({
    actor,
    action: 'encounter.create',
    targetType: 'encounter',
    targetId: createdEncounterId,
    status: 'success',
    message: 'Tạo encounter thành công.',
    requestMeta,
    metadata: {
      appointment_id: payload.appointment_id || null,
      queue_ticket_id: payload.queue_ticket_id || null,
    },
  });

  return getEncounterDetail(createdEncounterId, actor);
}

async function createEncounterFromAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment.', 404);

  const existing = await Encounter.findOne({
    appointment_id: appointment._id,
    status: { $ne: ENCOUNTER_STATUS.CANCELLED },
  }).lean();
  if (existing) {
    throw createError('Appointment đã có encounter active.', 409);
  }

  const detail = await createEncounter(
    {
      patient_id: appointment.patient_id,
      appointment_id: appointment._id,
      department_id: appointment.department_id,
      attending_doctor_id: appointment.doctor_id,
      encounter_type: mapAppointmentTypeToEncounterType(appointment.appointment_type),
      chief_reason: appointment.reason,
      status: appointment.status === APPOINTMENT_STATUS.IN_CONSULTATION ? ENCOUNTER_STATUS.IN_PROGRESS : ENCOUNTER_STATUS.ARRIVED,
      start_time: new Date(),
    },
    actor,
    requestMeta,
  );

  return { encounter: detail, created: true };
}

async function createEncounterFromQueueTicket(ticketId, actor, requestMeta = {}) {
  const ticket = await QueueTicket.findById(ticketId).lean();
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);

  if (ticket.encounter_id) {
    const existing = await Encounter.findOne({
      _id: ticket.encounter_id,
      status: { $ne: ENCOUNTER_STATUS.CANCELLED },
    }).lean();
    if (existing) {
      throw createError('Queue ticket đã có encounter active.', 409);
    }
  }

  const appointment = ticket.appointment_id ? await Appointment.findById(ticket.appointment_id).lean() : null;
  const detail = await createEncounter(
    {
      patient_id: ticket.patient_id,
      appointment_id: ticket.appointment_id || undefined,
      queue_ticket_id: ticket._id,
      department_id: ticket.department_id,
      attending_doctor_id: ticket.doctor_id,
      encounter_type: appointment ? mapAppointmentTypeToEncounterType(appointment.appointment_type) : 'outpatient',
      chief_reason: appointment?.reason,
      status: ticket.status === QUEUE_STATUS.IN_SERVICE ? ENCOUNTER_STATUS.IN_PROGRESS : ENCOUNTER_STATUS.ARRIVED,
      start_time: new Date(),
    },
    actor,
    requestMeta,
  );

  return { encounter: detail, created: true };
}

async function attachQueueTicketToEncounter(encounterId, ticketId, actor, requestMeta = {}) {
  const [encounter, ticket] = await Promise.all([Encounter.findById(encounterId), QueueTicket.findById(ticketId)]);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  if (!ticket) throw createError('Không tìm thấy queue ticket.', 404);
  assertEncounterScoped(encounter, actor, { globalPermissions: [PERMISSION.ENCOUNTERS.UPDATE], ownPermissions: [PERMISSION.ENCOUNTERS.UPDATE_OWN] });

  if (!sameId(ticket.patient_id, encounter.patient_id)) throw createError('Queue ticket và encounter khác bệnh nhân.', 409);
  if (!sameId(ticket.doctor_id, encounter.attending_doctor_id)) throw createError('Queue ticket và encounter khác bác sĩ.', 409);
  if (!sameId(ticket.department_id, encounter.department_id)) throw createError('Queue ticket và encounter khác department.', 409);
  if (ticket.encounter_id && !sameId(ticket.encounter_id, encounter._id)) {
    throw createError('Queue ticket đã gắn encounter khác.', 409);
  }

  ticket.encounter_id = encounter._id;
  if (encounter.status === ENCOUNTER_STATUS.IN_PROGRESS && ticket.status !== QUEUE_STATUS.IN_SERVICE) {
    if (!QUEUE_CAN_START_ENCOUNTER_STATUSES.includes(ticket.status)) {
      throw createError('Queue ticket không thể chuyển sang in_service.', 409);
    }
    ticket.status = QUEUE_STATUS.IN_SERVICE;
    ticket.service_start_time = ticket.service_start_time || new Date();
  }
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
    metadata: { queue_ticket_id: String(ticket._id) },
  });

  return getEncounterDetail(encounter._id, actor);
}

async function linkAppointmentToEncounter(encounterId, appointmentId, actor, requestMeta = {}) {
  const [encounter, appointment] = await Promise.all([Encounter.findById(encounterId), Appointment.findById(appointmentId)]);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy appointment.', 404);
  assertEncounterScoped(encounter, actor, { globalPermissions: [PERMISSION.ENCOUNTERS.UPDATE], ownPermissions: [PERMISSION.ENCOUNTERS.UPDATE_OWN] });

  if (!sameId(appointment.patient_id, encounter.patient_id)) throw createError('Appointment và encounter khác bệnh nhân.', 409);
  if (!sameId(appointment.doctor_id, encounter.attending_doctor_id)) throw createError('Appointment và encounter khác bác sĩ.', 409);
  if (!sameId(appointment.department_id, encounter.department_id)) throw createError('Appointment và encounter khác department.', 409);
  if (!APPOINTMENT_CAN_CREATE_ENCOUNTER_STATUSES.includes(appointment.status)) {
    throw createError('Appointment phải confirmed, checked_in hoặc in_consultation mới link encounter.', 409);
  }

  const existing = await Encounter.findOne({
    appointment_id: appointment._id,
    _id: { $ne: encounter._id },
    status: { $ne: ENCOUNTER_STATUS.CANCELLED },
  }).lean();
  if (existing) throw createError('Appointment đã gắn encounter khác.', 409);

  encounter.appointment_id = appointment._id;
  encounter.updated_by = actor?.userId;
  await encounter.save();

  const appointmentTargetStatus = encounter.status === ENCOUNTER_STATUS.IN_PROGRESS
    ? ENCOUNTER_STATUS.IN_PROGRESS
    : ENCOUNTER_STATUS.ARRIVED;
  if (advanceAppointmentForEncounter(appointment, appointmentTargetStatus, actor)) {
    await appointment.save();
  }

  await QueueTicket.updateMany(
    { appointment_id: appointment._id },
    { $set: { encounter_id: encounter._id, updated_by: actor?.userId } },
  );

  await recordAuditLog({
    actor,
    action: 'encounter.link_appointment',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Liên kết appointment với encounter thành công.',
    requestMeta,
    metadata: { appointment_id: String(appointment._id) },
  });

  return getEncounterDetail(encounter._id, actor);
}

async function listEncounters(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.patient_id) filter.patient_id = query.patient_id;
  if (Array.isArray(query.patient_ids) && query.patient_ids.length > 0) filter.patient_id = { $in: query.patient_ids };
  if (query.doctor_id) filter.attending_doctor_id = query.doctor_id;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.status) filter.status = query.status;
  if (query.encounter_type) filter.encounter_type = query.encounter_type;
  if (query.keyword_or) {
    const pattern = new RegExp(escapeRegex(query.keyword_or), 'i');
    filter.$or = [
      { encounter_code: pattern },
      { chief_reason: pattern },
      ...(Array.isArray(query.patient_ids) && query.patient_ids.length > 0 ? [{ patient_id: { $in: query.patient_ids } }] : []),
    ];
    if (filter.patient_id?.$in) delete filter.patient_id;
  }
  if (query.date_from || query.date_to) {
    filter.start_time = {};
    if (query.date_from) filter.start_time.$gte = getStartOfDay(query.date_from);
    if (query.date_to) filter.start_time.$lte = getEndOfDay(query.date_to);
  }

  applyEncounterReadScope(filter, actor);

  const findQuery = Encounter.find(filter)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone status')
    .populate('attending_doctor_id', 'full_name employee_code department_id status')
    .populate('department_id', 'department_code department_name status')
    .sort({ start_time: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const [items, total] = await Promise.all([
    findQuery,
    Encounter.countDocuments(filter),
  ]);

  return {
    items: items.map(serializeEncounter),
    pagination: buildPagination(page, limit, total),
  };
}

async function searchEncounters(query = {}, actor = {}) {
  const keyword = String(query.keyword || query.search || '').trim();
  if (!keyword) return listEncounters(query, actor);

  const pattern = new RegExp(escapeRegex(keyword), 'i');
  const patients = await Patient.find({
    is_deleted: false,
    $or: [
      { patient_code: pattern },
      { full_name: pattern },
      { phone: pattern },
    ],
  }).select('_id').limit(50).lean();

  return listEncounters({
    ...query,
    keyword: undefined,
    search: undefined,
    patient_ids: patients.map((patient) => patient._id),
    keyword_or: keyword,
  }, actor);
}

async function getEncounterDetail(encounterId, actor = {}) {
  const encounter = await Encounter.findById(encounterId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender phone status')
    .populate('attending_doctor_id', 'full_name employee_code department_id status')
    .populate('department_id', 'department_code department_name status')
    .lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  assertEncounterScoped(encounter, actor);

  const [consultations, diagnoses, vitalSigns, appointment, queueTicket, medicalRecord] = await Promise.all([
    Consultation.find({ encounter_id: encounter._id }).sort({ created_at: -1 }).lean(),
    Diagnosis.find({ encounter_id: encounter._id }).sort({ created_at: -1 }).lean(),
    VitalSign.find({ encounter_id: encounter._id }).sort({ recorded_at: -1 }).lean(),
    encounter.appointment_id ? Appointment.findById(encounter.appointment_id).lean() : null,
    QueueTicket.findOne({
      $or: [
        { encounter_id: encounter._id },
        ...(encounter.appointment_id ? [{ appointment_id: encounter.appointment_id }] : []),
      ],
    }).lean(),
    MedicalRecord.findOne({ encounter_id: encounter._id }).lean(),
  ]);

  return {
    encounter: serializeEncounter(encounter),
    appointment,
    queue_ticket: queueTicket,
    medical_record: medicalRecord,
    consultations,
    diagnoses,
    vital_signs: vitalSigns,
    allowed_actions: buildAllowedActions(encounter, actor),
  };
}

function buildAllowedActions(encounter, actor = {}) {
  const canStartStatus = STARTABLE_ENCOUNTER_STATUSES.includes(encounter.status);
  const canCompleteStatus = COMPLETABLE_ENCOUNTER_STATUSES.includes(encounter.status);
  const canEditStatus = !TERMINAL_ENCOUNTER_STATUSES.includes(encounter.status);
  return {
    can_update: canEditStatus && (hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.UPDATE, PERMISSION.ENCOUNTERS.UPDATE_OWN]) || !actorType(actor)),
    can_start: canStartStatus && (hasPermission(actor, PERMISSION.ENCOUNTERS.START) || !actorType(actor)),
    can_hold: [ENCOUNTER_STATUS.ARRIVED, ENCOUNTER_STATUS.IN_PROGRESS].includes(encounter.status),
    can_resume: encounter.status === ENCOUNTER_STATUS.ON_HOLD,
    can_complete: canCompleteStatus && (hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.COMPLETE, PERMISSION.ENCOUNTERS.COMPLETE_OWN]) || !actorType(actor)),
    can_cancel: !TERMINAL_ENCOUNTER_STATUSES.includes(encounter.status),
    can_reopen: encounter.status === ENCOUNTER_STATUS.COMPLETED && hasAnyPermission(actor, [PERMISSION.ENCOUNTERS.UPDATE, PERMISSION.ENCOUNTERS.UPDATE_OWN]),
  };
}

async function checkEncounterEditable(encounterId, actor = {}) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  assertEncounterScoped(encounter, actor, { globalPermissions: [PERMISSION.ENCOUNTERS.UPDATE], ownPermissions: [PERMISSION.ENCOUNTERS.UPDATE_OWN] });
  const editable = !TERMINAL_ENCOUNTER_STATUSES.includes(encounter.status);
  const started = [ENCOUNTER_STATUS.IN_PROGRESS, ENCOUNTER_STATUS.ON_HOLD, ENCOUNTER_STATUS.COMPLETED].includes(encounter.status);
  return {
    encounter_id: String(encounter._id),
    editable,
    status: encounter.status,
    allowed_fields: editable
      ? ['chief_reason', 'encounter_type', ...(!started ? ['department_id', 'attending_doctor_id', 'start_time'] : [])]
      : [],
  };
}

async function updateEncounter(encounterId, payload, actor, requestMeta = {}) {
  const encounter = await Encounter.findById(encounterId);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  assertEncounterScoped(encounter, actor, { globalPermissions: [PERMISSION.ENCOUNTERS.UPDATE], ownPermissions: [PERMISSION.ENCOUNTERS.UPDATE_OWN] });

  const editable = await checkEncounterEditable(encounter._id, actor);
  if (!editable.editable) throw createError('Encounter đã hoàn tất hoặc đã hủy nên không thể sửa.', 409);

  const before = encounter.toObject();
  const started = [ENCOUNTER_STATUS.IN_PROGRESS, ENCOUNTER_STATUS.ON_HOLD].includes(encounter.status);

  if (payload.patient_id || payload.appointment_id || payload.status || payload.encounter_code || payload.end_time) {
    throw createError('Không được cập nhật trực tiếp patient, appointment, code, status hoặc end_time của encounter.', 409);
  }

  if (payload.department_id || payload.attending_doctor_id) {
    if (started) throw createError('Không được đổi department/bác sĩ khi encounter đã bắt đầu.', 409);
    const targetDoctorId = payload.attending_doctor_id || encounter.attending_doctor_id;
    const targetDepartmentId = payload.department_id || encounter.department_id;
    await scheduleService.validateDoctorBelongsToDepartment(targetDoctorId, targetDepartmentId);
    assertEncounterTargetWritable(
      { department_id: targetDepartmentId, attending_doctor_id: targetDoctorId },
      actor,
      [PERMISSION.ENCOUNTERS.UPDATE, PERMISSION.ENCOUNTERS.UPDATE_OWN],
    );
  }

  if (payload.encounter_type !== undefined) {
    if (!ENCOUNTER_TYPES.includes(payload.encounter_type)) throw createError('encounter_type không hợp lệ.');
    encounter.encounter_type = payload.encounter_type;
  }
  if (payload.department_id !== undefined) encounter.department_id = payload.department_id;
  if (payload.attending_doctor_id !== undefined) encounter.attending_doctor_id = payload.attending_doctor_id;
  if (payload.start_time !== undefined) {
    if (started) throw createError('Không được đổi start_time khi encounter đã bắt đầu.', 409);
    const startTime = new Date(payload.start_time);
    if (Number.isNaN(startTime.getTime())) throw createError('start_time không hợp lệ.');
    encounter.start_time = startTime;
  }
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
    before,
    after: encounter.toObject(),
  });

  return getEncounterDetail(encounter._id, actor);
}

async function arriveEncounter(encounterId, actor, requestMeta = {}) {
  const encounter = await findEncounterById(encounterId);
  assertEncounterScoped(encounter, actor, { globalPermissions: [PERMISSION.ENCOUNTERS.UPDATE, PERMISSION.ENCOUNTERS.START], ownPermissions: [PERMISSION.ENCOUNTERS.UPDATE_OWN] });
  validateEncounterStatusTransition(encounter.status, ENCOUNTER_STATUS.ARRIVED);

  const before = encounter.toObject();
  await withOptionalTransaction(async (session) => {
    encounter.status = ENCOUNTER_STATUS.ARRIVED;
    encounter.updated_by = actor?.userId;
    await encounter.save(sessionOptions(session));

    if (encounter.appointment_id) {
      const appointment = await withSession(Appointment.findById(encounter.appointment_id), session);
      if (appointment && appointment.status === APPOINTMENT_STATUS.CONFIRMED) {
        appointment.status = APPOINTMENT_STATUS.CHECKED_IN;
        appointment.checked_in_at = appointment.checked_in_at || new Date();
        appointment.updated_by = actor?.userId;
        await appointment.save(sessionOptions(session));
      }
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'encounter.arrive',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Đánh dấu encounter đã đến khám thành công.',
    requestMeta,
    before,
    after: await Encounter.findById(encounter._id).lean(),
  });

  return getEncounterDetail(encounter._id, actor);
}

async function checkEncounterCanStart(encounterId, actor = {}) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  assertEncounterScoped(encounter, actor, { globalPermissions: [PERMISSION.ENCOUNTERS.START], ownPermissions: [PERMISSION.ENCOUNTERS.UPDATE_OWN] });

  const [patient, doctor, department, appointment, queueTicket] = await Promise.all([
    Patient.findById(encounter.patient_id).lean(),
    User.findById(encounter.attending_doctor_id).lean(),
    Department.findById(encounter.department_id).lean(),
    encounter.appointment_id ? Appointment.findById(encounter.appointment_id).lean() : null,
    QueueTicket.findOne({ encounter_id: encounter._id }).lean(),
  ]);

  const reasons = [];
  if (!STARTABLE_ENCOUNTER_STATUSES.includes(encounter.status)) reasons.push('Encounter không ở trạng thái có thể bắt đầu.');
  if (!patient || patient.is_deleted || patient.status !== PATIENT_STATUS.ACTIVE) reasons.push('Bệnh nhân không active.');
  if (!doctor || doctor.is_deleted || doctor.status !== 'active') reasons.push('Bác sĩ không active.');
  if (!department || department.is_deleted || department.status !== 'active') reasons.push('Department không active.');
  if (appointment && !APPOINTMENT_CAN_CREATE_ENCOUNTER_STATUSES.includes(appointment.status)) {
    reasons.push('Appointment chưa checked_in hoặc không ở trạng thái khám.');
  }
  if (queueTicket && !QUEUE_CAN_START_ENCOUNTER_STATUSES.includes(queueTicket.status)) {
    reasons.push('Queue ticket chưa được gọi hoặc chưa vào phục vụ.');
  }
  const activeDoctorEncounter = await Encounter.findOne({
    attending_doctor_id: encounter.attending_doctor_id,
    _id: { $ne: encounter._id },
    status: { $in: [ENCOUNTER_STATUS.IN_PROGRESS, ENCOUNTER_STATUS.ON_HOLD] },
  }).lean();
  if (activeDoctorEncounter) reasons.push('Bác sĩ đang có encounter active khác.');

  return {
    encounter_id: String(encounter._id),
    can_start: reasons.length === 0,
    status: encounter.status,
    reasons,
  };
}

async function startEncounter(encounterId, actor, requestMeta = {}) {
  const encounter = await findEncounterById(encounterId);
  assertEncounterScoped(encounter, actor, { globalPermissions: [PERMISSION.ENCOUNTERS.START], ownPermissions: [PERMISSION.ENCOUNTERS.UPDATE_OWN] });

  const canStart = await checkEncounterCanStart(encounter._id, actor);
  if (!canStart.can_start) throw createError(canStart.reasons.join(' ') || 'Encounter hiện không thể bắt đầu.', 409);
  validateEncounterStatusTransition(encounter.status, ENCOUNTER_STATUS.IN_PROGRESS);

  const before = encounter.toObject();
  await withOptionalTransaction(async (session) => {
    const now = new Date();
    await assertNoOtherInProgressEncounterForDoctor(encounter.attending_doctor_id, encounter._id, session);
    encounter.status = ENCOUNTER_STATUS.IN_PROGRESS;
    encounter.start_time = encounter.start_time || now;
    encounter.started_at = encounter.started_at || now;
    encounter.started_by = encounter.started_by || actor?.userId;
    encounter.updated_by = actor?.userId;
    await encounter.save(sessionOptions(session));

    if (encounter.appointment_id) {
      const appointment = await withSession(Appointment.findById(encounter.appointment_id), session);
      if (advanceAppointmentForEncounter(appointment, ENCOUNTER_STATUS.IN_PROGRESS, actor)) {
        await appointment.save(sessionOptions(session));
      }
    }

    const queueTicket = await findLinkedQueueTicket(encounter, session);
    if (queueTicket) {
      queueTicket.encounter_id = encounter._id;
      if (queueTicket.status !== QUEUE_STATUS.IN_SERVICE) {
        queueTicket.status = QUEUE_STATUS.IN_SERVICE;
        queueTicket.service_start_time = queueTicket.service_start_time || now;
      }
      queueTicket.updated_by = actor?.userId;
      await queueTicket.save(sessionOptions(session));
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'encounter.start',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Bắt đầu encounter thành công.',
    requestMeta,
    before,
    after: await Encounter.findById(encounter._id).lean(),
  });

  return getEncounterDetail(encounter._id, actor);
}

async function holdEncounter(encounterId, payload = {}, actor, requestMeta = {}) {
  const encounter = await findEncounterById(encounterId);
  assertEncounterScoped(encounter, actor, { globalPermissions: [PERMISSION.ENCOUNTERS.UPDATE], ownPermissions: [PERMISSION.ENCOUNTERS.UPDATE_OWN] });
  validateEncounterStatusTransition(encounter.status, ENCOUNTER_STATUS.ON_HOLD);
  const before = encounter.toObject();

  encounter.status = ENCOUNTER_STATUS.ON_HOLD;
  encounter.held_at = new Date();
  encounter.held_by = actor?.userId;
  encounter.hold_reason = payload.reason || payload.hold_reason || encounter.hold_reason;
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
    before,
    after: encounter.toObject(),
    metadata: { reason: encounter.hold_reason || null },
  });

  return getEncounterDetail(encounter._id, actor);
}

async function resumeEncounter(encounterId, actor, requestMeta = {}) {
  const encounter = await findEncounterById(encounterId);
  assertEncounterScoped(encounter, actor, { globalPermissions: [PERMISSION.ENCOUNTERS.UPDATE], ownPermissions: [PERMISSION.ENCOUNTERS.UPDATE_OWN] });
  validateEncounterStatusTransition(encounter.status, ENCOUNTER_STATUS.IN_PROGRESS);
  const before = encounter.toObject();

  encounter.status = ENCOUNTER_STATUS.IN_PROGRESS;
  encounter.resumed_at = new Date();
  encounter.resumed_by = actor?.userId;
  encounter.updated_by = actor?.userId;
  await encounter.save();

  await recordAuditLog({
    actor,
    action: 'encounter.resume',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Tiếp tục encounter thành công.',
    requestMeta,
    before,
    after: encounter.toObject(),
  });

  return getEncounterDetail(encounter._id, actor);
}

async function checkEncounterHasSignedConsultation(encounterId) {
  const [consultations_count, signed_consultations_count] = await Promise.all([
    Consultation.countDocuments({
      encounter_id: encounterId,
      status: { $ne: CONSULTATION_STATUS.CANCELLED },
    }),
    Consultation.countDocuments({
      encounter_id: encounterId,
      status: { $in: [CONSULTATION_STATUS.SIGNED, CONSULTATION_STATUS.AMENDED] },
    }),
  ]);

  return {
    encounter_id: String(encounterId),
    has_signed_consultation: signed_consultations_count > 0,
    consultations_count,
    signed_consultations_count,
  };
}

async function checkEncounterHasActivePrescription(encounterId) {
  const [draftCount, activeCount] = await Promise.all([
    Prescription.countDocuments({ encounter_id: encounterId, status: { $in: BLOCKING_PRESCRIPTION_STATUSES } }),
    Prescription.countDocuments({ encounter_id: encounterId, status: { $in: ACTIVE_PRESCRIPTION_STATUSES } }),
  ]);

  return {
    encounter_id: String(encounterId),
    has_active_prescription: activeCount > 0,
    has_draft_prescription: draftCount > 0,
    draft_prescriptions_count: draftCount,
    active_prescriptions_count: activeCount,
  };
}

async function checkEncounterHasBlockingOrders(encounterId) {
  const blockingOrdersCount = await Order.countDocuments({
    encounter_id: encounterId,
    status: { $in: BLOCKING_ORDER_STATUSES },
  });
  return {
    encounter_id: String(encounterId),
    has_blocking_orders: blockingOrdersCount > 0,
    blocking_orders_count: blockingOrdersCount,
  };
}

async function checkEncounterCanComplete(encounterId, actor = {}) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  assertEncounterScoped(encounter, actor, {
    globalPermissions: [PERMISSION.ENCOUNTERS.COMPLETE],
    ownPermissions: [PERMISSION.ENCOUNTERS.COMPLETE_OWN],
  });

  const [consultationSummary, signedClinicalNoteCount, primaryDiagnosisCount, diagnosisCount, draftConsultationCount, prescriptionSummary, orderSummary] = await Promise.all([
    checkEncounterHasSignedConsultation(encounter._id),
    ClinicalNote.countDocuments({
      encounter_id: encounter._id,
      status: { $in: [CLINICAL_NOTE_STATUS.SIGNED, CLINICAL_NOTE_STATUS.AMENDED] },
    }),
    Diagnosis.countDocuments({
      encounter_id: encounter._id,
      is_primary: true,
      status: { $ne: DIAGNOSIS_STATUS.ENTERED_IN_ERROR },
    }),
    Diagnosis.countDocuments({
      encounter_id: encounter._id,
      status: { $ne: DIAGNOSIS_STATUS.ENTERED_IN_ERROR },
    }),
    Consultation.countDocuments({
      encounter_id: encounter._id,
      status: { $in: [CONSULTATION_STATUS.DRAFT, CONSULTATION_STATUS.IN_PROGRESS] },
    }),
    checkEncounterHasActivePrescription(encounter._id),
    checkEncounterHasBlockingOrders(encounter._id),
  ]);

  const blockingReasons = [];
  const warnings = [];
  if (!COMPLETABLE_ENCOUNTER_STATUSES.includes(encounter.status) && !STARTABLE_ENCOUNTER_STATUSES.includes(encounter.status)) {
    blockingReasons.push('Encounter phải đang khám, tạm dừng hoặc có thể bắt đầu khám mới được hoàn tất.');
  }
  if (signedClinicalNoteCount === 0) {
    blockingReasons.push('Encounter chưa có clinical note đã ký.');
  }
  if (primaryDiagnosisCount === 0) {
    blockingReasons.push('Encounter chưa có chẩn đoán chính.');
  }
  if (draftConsultationCount > 0) {
    blockingReasons.push('Encounter còn consultation draft/in_progress.');
  }
  if (prescriptionSummary.has_draft_prescription) {
    blockingReasons.push('Encounter còn đơn thuốc draft.');
  }
  if (orderSummary.has_blocking_orders) {
    blockingReasons.push('Encounter còn order active chưa hoàn tất/hủy.');
  }
  if (diagnosisCount === 0) warnings.push('Encounter chưa có diagnosis nào.');
  if (prescriptionSummary.has_active_prescription) warnings.push('Encounter có đơn thuốc active/verified chưa hoàn tất cấp phát.');

  return {
    encounter_id: String(encounter._id),
    can_complete: blockingReasons.length === 0,
    status: encounter.status,
    blocking_reasons: blockingReasons,
    warnings,
    consultations_count: consultationSummary.consultations_count,
    signed_consultations_count: consultationSummary.signed_consultations_count,
    signed_clinical_notes_count: signedClinicalNoteCount,
    primary_diagnoses_count: primaryDiagnosisCount,
    active_diagnoses_count: diagnosisCount,
    draft_consultations_count: draftConsultationCount,
    draft_prescriptions_count: prescriptionSummary.draft_prescriptions_count,
    active_prescriptions_count: prescriptionSummary.active_prescriptions_count,
    blocking_orders_count: orderSummary.blocking_orders_count,
  };
}

async function ensureMedicalRecordForEncounter(encounter, actor, session = null) {
  const existing = await withSession(MedicalRecord.findOne({ encounter_id: encounter._id }), session);
  if (existing) return existing;

  const recordNo = await generateBusinessCode(CODE_TYPE.MEDICAL_RECORD, { date: encounter.start_time || new Date(), session });
  const recordType = Object.values(RECORD_TYPE).includes(encounter.encounter_type)
    ? encounter.encounter_type
    : RECORD_TYPE.OTHER;
  const [record] = await MedicalRecord.create([{
    patient_id: encounter.patient_id,
    encounter_id: encounter._id,
    custodian_department_id: encounter.department_id,
    record_no: recordNo,
    record_type: recordType,
    title: `Encounter ${encounter.encounter_code}`,
    opened_at: encounter.start_time || new Date(),
    closed_at: new Date(),
    status: MEDICAL_RECORD_STATUS.ACTIVE,
    created_by: actor?.userId,
  }], sessionOptions(session));
  return record;
}

async function completeEncounter(encounterId, payload = {}, actor, requestMeta = {}) {
  const encounter = await findEncounterById(encounterId);
  assertEncounterScoped(encounter, actor, {
    globalPermissions: [PERMISSION.ENCOUNTERS.COMPLETE],
    ownPermissions: [PERMISSION.ENCOUNTERS.COMPLETE_OWN],
  });

  const completionCheck = await checkEncounterCanComplete(encounter._id, actor);
  if (!completionCheck.can_complete) {
    throw createError(`Encounter chưa đủ điều kiện hoàn tất: ${completionCheck.blocking_reasons.join(' ')}`, 409);
  }
  const shouldAutoStartBeforeComplete = STARTABLE_ENCOUNTER_STATUSES.includes(encounter.status)
    && !COMPLETABLE_ENCOUNTER_STATUSES.includes(encounter.status);
  if (shouldAutoStartBeforeComplete) {
    validateEncounterStatusTransition(encounter.status, ENCOUNTER_STATUS.IN_PROGRESS);
    validateEncounterStatusTransition(ENCOUNTER_STATUS.IN_PROGRESS, ENCOUNTER_STATUS.COMPLETED);
  } else {
    validateEncounterStatusTransition(encounter.status, ENCOUNTER_STATUS.COMPLETED);
  }

  const before = encounter.toObject();
  let autoBillingResult = null;
  let autoBillingError = null;
  await withOptionalTransaction(async (session) => {
    const now = new Date();
    if (shouldAutoStartBeforeComplete) {
      encounter.start_time = encounter.start_time || now;
      encounter.started_at = encounter.started_at || now;
      encounter.started_by = encounter.started_by || actor?.userId;
    }
    encounter.status = ENCOUNTER_STATUS.COMPLETED;
    encounter.end_time = now;
    encounter.completed_by = actor?.userId;
    encounter.updated_by = actor?.userId;
    await encounter.save(sessionOptions(session));

    if (encounter.appointment_id) {
      const appointment = await withSession(Appointment.findById(encounter.appointment_id), session);
      if (appointment && [APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_CONSULTATION].includes(appointment.status)) {
        appointment.status = APPOINTMENT_STATUS.COMPLETED;
        appointment.completed_at = appointment.completed_at || now;
        appointment.updated_by = actor?.userId;
        await appointment.save(sessionOptions(session));
        await scheduleService.markSlotOutcomeForAppointment(appointment, APPOINTMENT_STATUS.COMPLETED, actor, requestMeta, { session });
      }
    }

    const queueTicket = await findLinkedQueueTicket(encounter, session);
    if (queueTicket && queueTicket.status !== QUEUE_STATUS.COMPLETED) {
      queueTicket.status = QUEUE_STATUS.COMPLETED;
      queueTicket.completed_time = queueTicket.completed_time || now;
      queueTicket.updated_by = actor?.userId;
      await queueTicket.save(sessionOptions(session));
    }

    await ensureMedicalRecordForEncounter(encounter, actor, session);
  }, { fallbackToNoTransaction: true });

  try {
    autoBillingResult = await billingService.createConsultationInvoiceForEncounter(encounter._id, {}, requestMeta);
  } catch (error) {
    autoBillingError = error.message || 'Không thể tự tạo hóa đơn phí khám.';
  }

  await recordAuditLog({
    actor,
    action: 'encounter.complete',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Hoàn tất encounter thành công.',
    requestMeta,
    before,
    after: await Encounter.findById(encounter._id).lean(),
    metadata: {
      warnings: completionCheck.warnings,
      complete_note: payload.note || null,
      auto_billing_invoice_id: autoBillingResult?._id || autoBillingResult?.id || autoBillingResult?.invoice_id || null,
      auto_billing_error: autoBillingError,
    },
  });

  return getEncounterDetail(encounter._id, actor);
}

async function cancelEncounter(encounterId, payload = {}, actor, requestMeta = {}) {
  const encounter = await findEncounterById(encounterId);
  assertEncounterScoped(encounter, actor, {
    globalPermissions: [PERMISSION.ENCOUNTERS.CANCEL],
    ownPermissions: [PERMISSION.ENCOUNTERS.CANCEL_OWN],
  });
  if (TERMINAL_ENCOUNTER_STATUSES.includes(encounter.status)) {
    throw createError('Encounter đã terminal, không thể hủy.', 409);
  }

  const [signedConsultationCount, prescriptionCount, blockingOrderCount] = await Promise.all([
    Consultation.countDocuments({ encounter_id: encounter._id, status: { $in: [CONSULTATION_STATUS.SIGNED, CONSULTATION_STATUS.AMENDED] } }),
    Prescription.countDocuments({ encounter_id: encounter._id, status: { $ne: PRESCRIPTION_STATUS.CANCELLED } }),
    Order.countDocuments({ encounter_id: encounter._id, status: { $in: BLOCKING_ORDER_STATUSES } }),
  ]);
  if ((signedConsultationCount > 0 || prescriptionCount > 0 || blockingOrderCount > 0) && !payload.force) {
    throw createError('Encounter đã có dữ liệu lâm sàng/đơn thuốc/order active, cần force và audit lý do nếu muốn hủy.', 409);
  }

  validateEncounterStatusTransition(encounter.status, ENCOUNTER_STATUS.CANCELLED);
  const before = encounter.toObject();
  await withOptionalTransaction(async (session) => {
    const now = new Date();
    encounter.status = ENCOUNTER_STATUS.CANCELLED;
    encounter.end_time = encounter.end_time || now;
    encounter.cancelled_at = now;
    encounter.cancelled_by = actor?.userId;
    encounter.cancel_reason = payload.reason || payload.cancel_reason;
    encounter.updated_by = actor?.userId;
    await encounter.save(sessionOptions(session));

    if (encounter.appointment_id && payload.cancel_appointment !== false) {
      const appointment = await withSession(Appointment.findById(encounter.appointment_id), session);
      if (appointment && [APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_CONSULTATION].includes(appointment.status)) {
        appointment.status = APPOINTMENT_STATUS.CANCELLED;
        appointment.cancelled_at = now;
        appointment.cancelled_by = actor?.userId;
        appointment.cancel_reason = encounter.cancel_reason;
        appointment.updated_by = actor?.userId;
        await appointment.save(sessionOptions(session));
        await scheduleService.releaseSlotForAppointment(appointment, actor, requestMeta, undefined, { session });
      }
    }

    const queueTicket = await findLinkedQueueTicket(encounter, session);
    if (queueTicket && ![QUEUE_STATUS.COMPLETED, QUEUE_STATUS.CANCELLED].includes(queueTicket.status)) {
      queueTicket.status = QUEUE_STATUS.CANCELLED;
      queueTicket.cancelled_at = now;
      queueTicket.cancel_reason = encounter.cancel_reason;
      queueTicket.updated_by = actor?.userId;
      await queueTicket.save(sessionOptions(session));
    }
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'encounter.cancel',
    targetType: 'encounter',
    targetId: encounter._id,
    status: 'success',
    message: 'Hủy encounter thành công.',
    requestMeta,
    before,
    after: await Encounter.findById(encounter._id).lean(),
    metadata: {
      reason: payload.reason || payload.cancel_reason || null,
      forced: Boolean(payload.force),
      blocking_orders_count: blockingOrderCount,
    },
  });

  return getEncounterDetail(encounter._id, actor);
}

async function reopenEncounter(encounterId, payload = {}, actor, requestMeta = {}) {
  const encounter = await findEncounterById(encounterId);
  assertEncounterScoped(encounter, actor, { globalPermissions: [PERMISSION.ENCOUNTERS.UPDATE], ownPermissions: [PERMISSION.ENCOUNTERS.UPDATE_OWN] });
  if (encounter.status !== ENCOUNTER_STATUS.COMPLETED) {
    throw createError('Chỉ encounter đã completed mới được mở lại.', 409);
  }

  const medicalRecord = await MedicalRecord.findOne({ encounter_id: encounter._id }).lean();
  if (medicalRecord?.status === MEDICAL_RECORD_STATUS.SEALED && !payload.force) {
    throw createError('Medical record đã sealed, cần force/unseal workflow trước khi reopen encounter.', 409);
  }

  const before = encounter.toObject();
  await assertNoOtherInProgressEncounterForDoctor(encounter.attending_doctor_id, encounter._id);
  encounter.status = ENCOUNTER_STATUS.IN_PROGRESS;
  encounter.end_time = undefined;
  encounter.reopened_at = new Date();
  encounter.reopened_by = actor?.userId;
  encounter.reopen_reason = payload.reason || payload.reopen_reason;
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
    before,
    after: encounter.toObject(),
    metadata: {
      reason: encounter.reopen_reason || null,
      forced: Boolean(payload.force),
    },
  });

  return getEncounterDetail(encounter._id, actor);
}

async function getPatientEncounterHistory(patientId, query = {}, actor = {}) {
  return listEncounters({ ...query, patient_id: patientId }, actor);
}

async function getDoctorEncounters(doctorId, query = {}, actor = {}) {
  return listEncounters({ ...query, doctor_id: doctorId }, actor);
}

async function getTodayEncounters(query = {}, actor = {}) {
  return listEncounters({ ...query, date_from: new Date().toISOString(), date_to: new Date().toISOString() }, actor);
}

async function getDoctorActiveEncounter(doctorId, actor = {}) {
  const result = await listEncounters({
    doctor_id: doctorId,
    status: { $in: [ENCOUNTER_STATUS.ARRIVED, ENCOUNTER_STATUS.IN_PROGRESS, ENCOUNTER_STATUS.ON_HOLD] },
    limit: 20,
  }, actor);
  return result.items;
}

async function getSingleEncounterSummary(encounter, actor = {}) {
  assertEncounterScoped(encounter, actor, { globalPermissions: [PERMISSION.ENCOUNTERS.READ_SUMMARY] });
  const [signedConsultations, diagnoses, prescriptions, queueTicket, medicalRecord] = await Promise.all([
    Consultation.countDocuments({ encounter_id: encounter._id, status: { $in: [CONSULTATION_STATUS.SIGNED, CONSULTATION_STATUS.AMENDED] } }),
    Diagnosis.countDocuments({ encounter_id: encounter._id, status: { $ne: DIAGNOSIS_STATUS.ENTERED_IN_ERROR } }),
    Prescription.countDocuments({ encounter_id: encounter._id, status: { $ne: PRESCRIPTION_STATUS.CANCELLED } }),
    QueueTicket.findOne({ encounter_id: encounter._id }).select('status queue_number completed_time').lean(),
    MedicalRecord.findOne({ encounter_id: encounter._id }).select('record_no status closed_at sealed_at').lean(),
  ]);
  return {
    encounter: serializeEncounter(encounter),
    signed_consultations_count: signedConsultations,
    diagnoses_count: diagnoses,
    prescriptions_count: prescriptions,
    queue_ticket: queueTicket,
    medical_record: medicalRecord,
  };
}

async function getEncounterSummary(query = {}, actor = {}) {
  if (query.encounter_id) {
    const encounter = await Encounter.findById(query.encounter_id)
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone status')
      .populate('attending_doctor_id', 'full_name employee_code department_id status')
      .populate('department_id', 'department_code department_name status')
      .lean();
    if (!encounter) throw createError('Không tìm thấy encounter.', 404);
    return getSingleEncounterSummary(encounter, actor);
  }

  const filter = {};
  if (query.doctor_id) filter.attending_doctor_id = query.doctor_id;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.date) filter.start_time = { $gte: getStartOfDay(query.date), $lte: getEndOfDay(query.date) };
  if (query.date_from || query.date_to) {
    filter.start_time = {};
    if (query.date_from) filter.start_time.$gte = getStartOfDay(query.date_from);
    if (query.date_to) filter.start_time.$lte = getEndOfDay(query.date_to);
  }
  applyEncounterReadScope(filter, actor);

  const items = await Encounter.find(filter).lean();
  const summarize = (status) => items.filter((item) => item.status === status).length;
  return {
    total: items.length,
    planned: summarize(ENCOUNTER_STATUS.PLANNED),
    arrived: summarize(ENCOUNTER_STATUS.ARRIVED),
    in_progress: summarize(ENCOUNTER_STATUS.IN_PROGRESS),
    on_hold: summarize(ENCOUNTER_STATUS.ON_HOLD),
    completed: summarize(ENCOUNTER_STATUS.COMPLETED),
    cancelled: summarize(ENCOUNTER_STATUS.CANCELLED),
  };
}

async function getEncounterTimeline(encounterId, query = {}, actor = {}) {
  const encounter = await Encounter.findById(encounterId).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  assertEncounterScoped(encounter, actor);

  const queueTicket = await QueueTicket.findOne({ encounter_id: encounter._id }).lean();
  const targetFilters = [
    { target_type: 'encounter', target_id: encounter._id },
  ];
  if (encounter.appointment_id) targetFilters.push({ target_type: 'appointment', target_id: encounter.appointment_id });
  if (queueTicket) targetFilters.push({ target_type: 'queue_ticket', target_id: queueTicket._id });

  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 300);
  const items = await AuditLog.find({ $or: targetFilters })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();

  return {
    encounter_id: String(encounter._id),
    items: items.map(serializeAuditTimelineItem),
  };
}

module.exports = {
  // createEncounter: Tạo lượt khám.
  createEncounter,
  // listEncounters: Liệt kê lượt khám.
  listEncounters,
  // getEncounterDetail: Lấy chi tiết lượt khám.
  getEncounterDetail,
  // updateEncounter: Cập nhật lượt khám.
  updateEncounter,
  // arriveEncounter: Ghi nhận đến khám cho lượt khám.
  arriveEncounter,
  // startEncounter: Bắt đầu lượt khám.
  startEncounter,
  // holdEncounter: Tạm giữ lượt khám.
  holdEncounter,
  // resumeEncounter: Tiếp tục lượt khám.
  resumeEncounter,
  // completeEncounter: Hoàn tất lượt khám.
  completeEncounter,
  // cancelEncounter: Hủy lượt khám.
  cancelEncounter,
  // reopenEncounter: Mở lại lượt khám.
  reopenEncounter,
  // createEncounterFromAppointment: Tạo lượt khám từ lịch hẹn.
  createEncounterFromAppointment,
  // createEncounterFromQueueTicket: Tạo lượt khám từ phiếu hàng đợi.
  createEncounterFromQueueTicket,
  // linkAppointmentToEncounter: Liên kết lịch hẹn với lượt khám tương ứng.
  linkAppointmentToEncounter,
  // attachQueueTicketToEncounter: Gắn phiếu hàng đợi vào lượt khám.
  attachQueueTicketToEncounter,
  // getPatientEncounterHistory: Lấy lịch sử lượt khám của bệnh nhân.
  getPatientEncounterHistory,
  // getDoctorEncounters: Lấy lượt khám của bác sĩ.
  getDoctorEncounters,
  // getTodayEncounters: Lấy lượt khám trong ngày.
  getTodayEncounters,
  // getDoctorActiveEncounter: Lấy lượt khám đang hoạt động của bác sĩ.
  getDoctorActiveEncounter,
  // searchEncounters: Tìm kiếm lượt khám.
  searchEncounters,
  // generateEncounterCode: Sinh/tạo mã lượt khám.
  generateEncounterCode,
  // validateEncounterCreation: Kiểm tra tính hợp lệ của điều kiện tạo lượt khám.
  validateEncounterCreation,
  // validateEncounterStatusTransition: Kiểm tra tính hợp lệ của chuyển trạng thái lượt khám.
  validateEncounterStatusTransition,
  // checkEncounterCanStart: Kiểm tra điều kiện bắt đầu lượt khám.
  checkEncounterCanStart,
  // checkEncounterCanComplete: Kiểm tra điều kiện hoàn tất lượt khám.
  checkEncounterCanComplete,
  // checkEncounterEditable: Kiểm tra điều kiện chỉnh sửa lượt khám.
  checkEncounterEditable,
  // getEncounterSummary: Lấy tổng hợp lượt khám.
  getEncounterSummary,
  // getEncounterTimeline: Lấy dòng thời gian lượt khám.
  getEncounterTimeline,
  // checkEncounterHasSignedConsultation: Kiểm tra lượt khám có phiên khám đã ký.
  checkEncounterHasSignedConsultation,
  // checkEncounterHasActivePrescription: Kiểm tra lượt khám có đơn thuốc đang hoạt động.
  checkEncounterHasActivePrescription,
  // checkEncounterHasBlockingOrders: Kiểm tra lượt khám còn order chưa xử lý.
  checkEncounterHasBlockingOrders,
};
