const {
  Types,
} = require('mongoose');
const {
  Appointment,
  Department,
  DoctorProfile,
  DoctorSchedule,
  Encounter,
  Invoice,
  Consultation,
  Patient,
  PatientAuthorization,
  QueueTicket,
  ScheduleSlot,
  User,
} = require('../models');
const patientService = require('./patient.service');
const {
  ACTIVE_APPOINTMENT_STATUSES,
  ACTIVE_QUEUE_STATUSES,
  APPOINTMENT_STATUS,
  AUTHORIZATION_STATUS,
  AUTHORIZATION_TYPE,
  INVOICE_STATUS,
  SCHEDULE_SLOT_STATUS,
  DOCTOR_PROFILE_STATUS,
  QUEUE_STATUS,
} = require('../constants/statuses');
const { APPOINTMENT_TRANSITIONS } = require('../constants/transitions');
const { assertTransition } = require('../shared/utils/status-transition');
const { withOptionalTransaction } = require('../shared/utils/transaction');
const { PERMISSION } = require('../constants/permissions');
const ERROR_CODE = require('../common/errors/error-codes');
const permissionService = require('./permission.service');
const {
  buildPagination,
  createError,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeString,
  recordAuditLog,
} = require('./core.service');
const { AuditLog } = require('../models');
const scheduleService = require('./schedule.service');

const TERMINAL_APPOINTMENT_STATUSES = [
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.NO_SHOW,
  APPOINTMENT_STATUS.RESCHEDULED,
];
const APPOINTMENT_LIGHT_UPDATE_FIELDS = new Set(['reason', 'notes', 'appointment_type', 'source']);
const APPOINTMENT_RESCHEDULE_FIELDS = new Set(['doctor_id', 'department_id', 'doctor_schedule_id', 'schedule_slot_id', 'appointment_time']);
const CHECKIN_EARLY_MINUTES = 12 * 60;
const CHECKIN_LATE_MINUTES = 24 * 60;
const MAX_QUERY_DATE_RANGE_DAYS = 93;
const APPOINTMENT_WRITABLE_PATIENT_ACTIONS = new Set(['cancel', 'reschedule', 'checkin']);

function toId(value) {
  return value ? String(value) : null;
}

function actorRoles(actor = {}) {
  return Array.isArray(actor.roles) ? actor.roles : [];
}

function hasRole(actor = {}, roleCode) {
  return actorRoles(actor).includes(roleCode);
}

function isDoctorActor(actor = {}) {
  return hasRole(actor, 'doctor');
}

function hasGlobalAppointmentScope(actor = {}) {
  return hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.REPORTS.APPOINTMENTS_READ]);
}

function canUseSensitivePatientSearchFilters(actor = {}) {
  return hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENTS.UPDATE_SENSITIVE,
    PERMISSION.PATIENT_IDENTIFIERS.READ,
  ]);
}

function errorCodeFromError(error) {
  if (error?.code) return error.code;
  if (error?.statusCode === 403) return 'FORBIDDEN';
  if (error?.statusCode === 404) return 'NOT_FOUND';
  if (error?.statusCode === 409) return 'CONFLICT';
  if (error?.statusCode === 400) return 'BAD_REQUEST';
  return 'ERROR';
}

function normalizeDuplicateKeyError(error, message = 'Dữ liệu trùng với ràng buộc duy nhất.') {
  if (error?.code === 11000) {
    throw createError(message, 409);
  }
  throw error;
}

function validateDateRangeQuery(query = {}, { fromKey = 'date_from', toKey = 'date_to' } = {}) {
  if (!query[fromKey] && !query[toKey]) return null;
  const dateFrom = query[fromKey] ? getStartOfDay(query[fromKey]) : null;
  const dateTo = query[toKey] ? getEndOfDay(query[toKey]) : null;
  if ((dateFrom && Number.isNaN(dateFrom.getTime())) || (dateTo && Number.isNaN(dateTo.getTime()))) {
    throw createError('date_from/date_to không hợp lệ.', 400);
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw createError('date_from phải nhỏ hơn hoặc bằng date_to.', 400);
  }
  if (dateFrom && dateTo) {
    const rangeDays = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (24 * 60 * 60 * 1000));
    if (rangeDays > MAX_QUERY_DATE_RANGE_DAYS) {
      throw createError(`Khoảng ngày không được vượt quá ${MAX_QUERY_DATE_RANGE_DAYS} ngày.`, 400);
    }
  }
  return { dateFrom, dateTo };
}

function sessionOptions(session) {
  return session ? { session } : {};
}

function isPatientActor(actor = {}) {
  const source = actor || {};
  return source.actorType === 'patient' || source.actor_type === 'patient';
}

function isPatientRelativeActor(actor = {}) {
  const source = actor || {};
  return source.actorType === 'patient_relative' || source.actor_type === 'patient_relative';
}

function isPortalPatientActor(actor = {}) {
  return isPatientActor(actor) || isPatientRelativeActor(actor);
}

function assertPortalScheduleBookable(schedule = {}) {
  if (schedule.patient_portal_enabled === false || schedule.staff_only === true) {
    throw createError('Lịch này không mở cho bệnh nhân tự đặt.', 403);
  }
  return true;
}

function getPortalPatientId(actor = {}) {
  return actor.patientId || actor.patient_id || actor.patient?._id || actor.patient?.id || null;
}

function getPortalRelativeId(actor = {}) {
  return actor.relativeId || actor.relative_id || actor.patientRelativeId || actor.patient_relative_id || actor.actorId || actor.actor_id || null;
}

async function assertPortalAppointmentAuthorization(actor = {}, authorizationTypes = [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]) {
  if (isPatientActor(actor)) {
    if (!getPortalPatientId(actor)) throw createError('Không xác định được hồ sơ bệnh nhân.', 403);
    return true;
  }

  if (!isPatientRelativeActor(actor)) {
    return false;
  }

  const patientId = getPortalPatientId(actor);
  const relativeId = getPortalRelativeId(actor);
  if (!patientId || !relativeId) {
    throw createError('Không xác định được thông tin người thân được ủy quyền.', 403);
  }

  const now = new Date();
  const types = [...new Set([
    AUTHORIZATION_TYPE.FULL_ACCESS,
    AUTHORIZATION_TYPE.BOOK_APPOINTMENTS,
    AUTHORIZATION_TYPE.APPOINTMENT_MANAGE,
    ...(authorizationTypes || []),
  ].filter(Boolean))];
  const authorized = await PatientAuthorization.exists({
    patient_id: patientId,
    relative_id: relativeId,
    status: AUTHORIZATION_STATUS.ACTIVE,
    is_deleted: false,
    valid_from: { $lte: now },
    $and: [
      {
        $or: [
          { valid_to: null },
          { valid_to: { $exists: false } },
          { valid_to: { $gte: now } },
        ],
      },
      {
        $or: [
          { authorization_type: { $in: types } },
          { permissions: { $in: types } },
        ],
      },
    ],
  });

  if (!authorized) {
    throw createError('Người thân chưa có ủy quyền đặt lịch cho bệnh nhân này.', 403);
  }

  return true;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissionCodes = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissionCodes);
}

function applyAppointmentReadScope(filter, actor = {}) {
  if (!actor?.actorType && !actor?.actor_type) return filter;
  if (isPortalPatientActor(actor)) {
    filter.patient_id = getPortalPatientId(actor);
    return filter;
  }
  if (hasGlobalAppointmentScope(actor)) {
    return filter;
  }
  if (hasAnyPermission(actor, [PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT])) {
    const departmentId = actorDepartmentId(actor);
    if (!departmentId || (filter.department_id && String(filter.department_id) !== String(departmentId))) {
      filter._id = null;
      return filter;
    }
    filter.department_id = departmentId;
    return filter;
  }
  if (hasPermission(actor, PERMISSION.APPOINTMENTS.READ_OWN)) {
    if (!actor.userId || (filter.doctor_id && String(filter.doctor_id) !== String(actor.userId))) {
      filter._id = null;
      return filter;
    }
    filter.doctor_id = actor.userId;
    return filter;
  }
  filter._id = null;
  return filter;
}

function assertAppointmentReadable(appointment, actor = {}) {
  const filter = {
    patient_id: appointment.patient_id,
    doctor_id: appointment.doctor_id,
    department_id: appointment.department_id,
  };
  applyAppointmentReadScope(filter, actor);
  if (filter._id === null) throw createError('Bạn không có quyền xem lịch hẹn này.', 403);
  if (filter.patient_id && String(filter.patient_id) !== String(appointment.patient_id)) throw createError('Bạn không có quyền xem lịch hẹn này.', 403);
  if (filter.doctor_id && String(filter.doctor_id) !== String(appointment.doctor_id)) throw createError('Bạn không có quyền xem lịch hẹn này.', 403);
  if (filter.department_id && String(filter.department_id) !== String(appointment.department_id)) throw createError('Bạn không có quyền xem lịch hẹn này.', 403);
  return true;
}

function assertAppointmentWritable(appointment, actor = {}, action = 'update') {
  if (!actor?.actorType && !actor?.actor_type) {
    throw createError('Bạn chưa được xác thực.', 401);
  }

  if (isPortalPatientActor(actor)) {
    if (!APPOINTMENT_WRITABLE_PATIENT_ACTIONS.has(action) || String(appointment.patient_id) !== String(getPortalPatientId(actor))) {
      throw createError('Bạn không có quyền thao tác lịch hẹn này.', 403);
    }
    return true;
  }

  if (hasGlobalAppointmentScope(actor)) {
    return true;
  }

  if (isDoctorActor(actor) || hasPermission(actor, PERMISSION.APPOINTMENTS.READ_OWN)) {
    if (actor.userId && String(appointment.doctor_id) === String(actor.userId)) {
      return true;
    }
    throw createError('Bác sĩ chỉ được thao tác lịch hẹn của chính mình.', 403);
  }

  const departmentId = actorDepartmentId(actor);
  if (departmentId && String(appointment.department_id) === String(departmentId)) {
    return true;
  }

  throw createError('Bạn không có quyền thao tác lịch hẹn này.', 403);
}

function assertAppointmentCreateWritable(payload, actor = {}) {
  if (!actor?.actorType && !actor?.actor_type) {
    throw createError('Bạn chưa được xác thực.', 401);
  }

  if (isPortalPatientActor(actor)) {
    if (String(payload.patient_id) !== String(getPortalPatientId(actor))) {
      throw createError('Bệnh nhân chỉ được đặt lịch cho hồ sơ của chính mình.', 403);
    }
    return true;
  }

  if (hasGlobalAppointmentScope(actor)) {
    return true;
  }

  if (isDoctorActor(actor) || hasPermission(actor, PERMISSION.APPOINTMENTS.READ_OWN)) {
    if (actor.userId && String(payload.doctor_id) === String(actor.userId)) {
      return true;
    }
    throw createError('Bác sĩ chỉ được tạo lịch hẹn cho lịch của chính mình.', 403);
  }

  const departmentId = actorDepartmentId(actor);
  if (departmentId && String(payload.department_id) === String(departmentId)) {
    return true;
  }

  throw createError('Bạn không có quyền tạo lịch hẹn trong department này.', 403);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
  if (currentStatus === nextStatus) return true;
  return assertTransition(APPOINTMENT_TRANSITIONS, currentStatus, nextStatus, 'appointment');
}

async function checkDoctorAvailability({ doctor_id, department_id, appointment_time, doctor_schedule_id = null }, actor = null) {
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

  const portalActor = isPortalPatientActor(actor);
  if (actor && !portalActor && scheduleService.assertScheduleReadable) {
    scheduleService.assertScheduleReadable(schedule, actor);
  }

  if (!['published', 'active'].includes(schedule.status)) {
    throw createError('Lịch làm việc chưa được mở để đặt khám.', 409);
  }
  if (portalActor) {
    assertPortalScheduleBookable(schedule);
  }

  return schedule;
}

async function validateAppointmentSlot({
  doctor_id,
  department_id,
  appointment_time,
  doctor_schedule_id = null,
  schedule_slot_id = null,
  excludeAppointmentId = null,
  allow_held_slot = false,
  held_by = null,
}, actor = null) {
  const schedule = await checkDoctorAvailability({ doctor_id, department_id, appointment_time, doctor_schedule_id }, actor);
  const slotTime = new Date(appointment_time);
  if (schedule_slot_id) {
    const slot = await ScheduleSlot.findById(schedule_slot_id).lean();
    if (!slot || slot.is_deleted) throw createError('Không tìm thấy schedule slot.', 404);
    if (String(slot.doctor_schedule_id) !== String(schedule._id)) throw createError('schedule_slot_id không thuộc doctor_schedule đã chọn.', 409);
    if (String(slot.doctor_id) !== String(doctor_id) || String(slot.department_id) !== String(department_id)) {
      throw createError('schedule_slot_id không khớp bác sĩ hoặc department.', 409);
    }
    if (new Date(slot.start_time).getTime() !== slotTime.getTime()) {
      throw createError('appointment_time phải khớp với start_time của schedule slot.', 409);
    }
    if (slot.status === 'blocked' || slot.status === 'cancelled') {
      throw createError('Slot này đang bị khóa hoặc đã hủy.', 409, null, ERROR_CODE.APPOINTMENT_SLOT_FULL);
    }
    const heldByRequester = allow_held_slot
      && slot.status === SCHEDULE_SLOT_STATUS.HELD
      && (!held_by || slot.block_reason === held_by)
      && (!slot.hold_expires_at || new Date(slot.hold_expires_at) > new Date());
    if (slot.status === SCHEDULE_SLOT_STATUS.HELD && !heldByRequester) {
      throw createError('Slot này đang được giữ tạm bởi phiên đặt lịch khác.', 409, null, ERROR_CODE.APPOINTMENT_SLOT_FULL);
    }
    const bookedByCurrentAppointment = excludeAppointmentId
      && slot.appointment_id
      && String(slot.appointment_id) === String(excludeAppointmentId);
    if (slot.booked_count >= slot.capacity && !bookedByCurrentAppointment) {
      throw createError('Slot này đã hết sức chứa.', 409, null, ERROR_CODE.APPOINTMENT_SLOT_FULL);
    }
  }

  const availableSlots = await scheduleService.getAvailableSlots(
    schedule._id,
    isPortalPatientActor(actor) ? { publicView: true, onlyAvailable: true } : { actor },
  );
  const matchedSlot = availableSlots.items.find((slot) => new Date(slot.slot_time).getTime() === slotTime.getTime());
  if (!matchedSlot) {
    throw createError('Thời gian đặt không khớp với slot của lịch làm việc.', 409);
  }

  if (matchedSlot.is_blocked) {
    throw createError('Slot này đang bị khóa, không thể đặt lịch.', 409, null, ERROR_CODE.APPOINTMENT_SLOT_FULL);
  }
  const bookedByCurrentAppointment = excludeAppointmentId
    && matchedSlot.appointment_id
    && String(matchedSlot.appointment_id) === String(excludeAppointmentId);
  const matchedHeldByRequester = allow_held_slot
    && matchedSlot.status === SCHEDULE_SLOT_STATUS.HELD
    && (!held_by || matchedSlot.block_reason === held_by);
  if (
    (matchedSlot.is_booked && !bookedByCurrentAppointment)
    || (matchedSlot.is_available === false && !bookedByCurrentAppointment && !matchedHeldByRequester)
  ) {
    throw createError('Slot này không còn khả dụng để đặt lịch.', 409, null, ERROR_CODE.APPOINTMENT_SLOT_FULL);
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
    throw createError('Slot này đã được đặt.', 409, null, ERROR_CODE.APPOINTMENT_SLOT_FULL);
  }

  return schedule;
}

async function checkPatientDuplicateBooking({
  patient_id,
  appointment_time,
  doctor_id = null,
  department_id = null,
  schedule_slot_id = null,
  excludeAppointmentId = null,
}) {
  const appointmentTime = new Date(appointment_time);
  const rangeStart = new Date(appointmentTime.getTime() - 30 * 60 * 1000);
  const rangeEnd = new Date(appointmentTime.getTime() + 30 * 60 * 1000);
  const duplicateFilter = {
    patient_id,
    is_deleted: false,
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    $or: [
      { appointment_time: { $gte: rangeStart, $lte: rangeEnd } },
      ...(schedule_slot_id ? [{ schedule_slot_id }] : []),
    ],
  };

  if (excludeAppointmentId) {
    duplicateFilter._id = { $ne: excludeAppointmentId };
  }

  const existing = await Appointment.findOne(duplicateFilter).lean();

  return {
    patient_id: String(patient_id),
    has_duplicate: Boolean(existing),
    appointment: existing || null,
  };
}

async function checkAppointmentConflictForDoctor(payload = {}, actor = null) {
  try {
    const schedule = await validateAppointmentSlot(payload, actor);
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

async function checkAppointmentConflictForPatient(payload = {}, actor = null) {
  if (actor && payload.doctor_id && payload.department_id && payload.appointment_time) {
    await checkDoctorAvailability(payload, actor);
  }
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
  return isPortalPatientActor(actor) ? 'patient_portal' : 'staff';
}

async function buildAppointmentReferenceMaps(appointments = []) {
  const patientIds = [...new Set(appointments.map((item) => String(item.patient_id)).filter(Boolean))];
  const doctorIds = [...new Set(appointments.map((item) => String(item.doctor_id)).filter(Boolean))];
  const departmentIds = [...new Set(appointments.map((item) => String(item.department_id)).filter(Boolean))];

  const [patients, doctors, departments] = await Promise.all([
    patientIds.length
      ? Patient.find({ _id: { $in: patientIds }, is_deleted: false }).select('patient_code full_name phone date_of_birth gender').lean()
      : [],
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
    patientMap: new Map(patients.map((patient) => [String(patient._id), patient])),
    doctorMap: new Map(doctors.map((doctor) => [String(doctor._id), doctor])),
    departmentMap: new Map(departments.map((department) => [String(department._id), department])),
  };
}

async function ensurePatientAndDoctor(payload) {
  const [patient, doctor, department, doctorProfile] = await Promise.all([
    Patient.findById(payload.patient_id).lean(),
    User.findById(payload.doctor_id).lean(),
    Department.findById(payload.department_id).lean(),
    DoctorProfile.findOne({ user_id: payload.doctor_id, is_deleted: false }).lean(),
  ]);

  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  if (patient.status !== 'active') throw createError('Bệnh nhân hiện không ở trạng thái được phép đặt lịch.', 409);
  if (!doctor || doctor.is_deleted || doctor.status !== 'active') throw createError('Không tìm thấy bác sĩ khả dụng.', 404);
  if (!department || department.is_deleted || department.status !== 'active') throw createError('Department không khả dụng.', 404);
  if (!doctorProfile || doctorProfile.status !== DOCTOR_PROFILE_STATUS.ACTIVE) throw createError('Doctor profile không khả dụng.', 409);
  if (String(doctorProfile.department_id) !== String(department._id)) throw createError('Bác sĩ không thuộc department này.', 409);

  return { patient, doctor, department };
}

async function createAppointment(payload, actor, requestMeta = {}) {
  if (isPortalPatientActor(actor)) {
    payload = {
      ...payload,
      patient_id: getPortalPatientId(actor),
    };
  }
  assertAppointmentCreateWritable(payload, actor);
  const appointmentTime = validateAppointmentTime(payload.appointment_time);
  await patientService.checkPatientCanBookAppointment(payload.patient_id);
  await ensurePatientAndDoctor(payload);
  const schedule = await validateAppointmentSlot({
    doctor_id: payload.doctor_id,
    department_id: payload.department_id,
    appointment_time: appointmentTime,
    doctor_schedule_id: payload.doctor_schedule_id,
    schedule_slot_id: payload.schedule_slot_id,
    allow_held_slot: payload.allow_held_slot,
    held_by: payload.held_by,
  }, actor);
  if (isPortalPatientActor(actor)) {
    assertPortalScheduleBookable(schedule);
  }

  const duplicateCheck = await checkPatientDuplicateBooking({
    patient_id: payload.patient_id,
    appointment_time: appointmentTime,
    doctor_id: payload.doctor_id,
    department_id: payload.department_id,
    schedule_slot_id: payload.schedule_slot_id,
  });
  if (duplicateCheck.has_duplicate) {
    throw createError('Bệnh nhân đang có lịch hẹn trùng hoặc quá gần khung giờ này.', 409);
  }

  const initialStatus = payload.status === APPOINTMENT_STATUS.CONFIRMED
    ? APPOINTMENT_STATUS.CONFIRMED
    : APPOINTMENT_STATUS.BOOKED;
  const appointmentId = new Types.ObjectId();
  let reservedSlotId = null;
  try {
    await withOptionalTransaction(async (session) => {
      const appointmentDraft = {
        _id: appointmentId,
        patient_id: payload.patient_id,
        doctor_id: payload.doctor_id,
        department_id: payload.department_id,
        doctor_schedule_id: schedule._id,
        schedule_slot_id: payload.schedule_slot_id || undefined,
        appointment_time: appointmentTime,
      };
      const reservedSlot = await scheduleService.markSlotBookedForAppointment(appointmentDraft, actor, requestMeta, {
        session,
        requireUnassignedSlot: true,
      });
      reservedSlotId = reservedSlot?._id || payload.schedule_slot_id || null;

      const [appointment] = await Appointment.create([{
        _id: appointmentId,
        patient_id: payload.patient_id,
        doctor_id: payload.doctor_id,
        department_id: payload.department_id,
        doctor_schedule_id: schedule._id,
        schedule_slot_id: reservedSlotId || payload.schedule_slot_id || undefined,
        appointment_time: appointmentTime,
        appointment_type: payload.appointment_type || 'outpatient',
        reason: payload.reason,
        source: calculateAppointmentSource(payload, actor),
        status: initialStatus,
        confirmed_at: initialStatus === APPOINTMENT_STATUS.CONFIRMED ? new Date() : undefined,
        notes: payload.notes,
        created_by: actor?.userId,
      }], sessionOptions(session));
      if (reservedSlotId && String(appointment.schedule_slot_id || '') !== String(reservedSlotId)) {
        appointment.schedule_slot_id = reservedSlotId;
        await appointment.save(sessionOptions(session));
      }
    }, { fallbackToNoTransaction: true });
  } catch (error) {
    if (reservedSlotId) {
      await ScheduleSlot.updateOne(
        { _id: reservedSlotId, appointment_id: appointmentId },
        {
          $set: {
            status: 'available',
            booked_count: 0,
            updated_by: actor?.userId,
          },
          $unset: {
            appointment_id: '',
            patient_id: '',
            hold_expires_at: '',
          },
        },
      ).catch(() => null);
    }
    normalizeDuplicateKeyError(error, 'Slot này đã được đặt hoặc appointment bị trùng.');
  }

  await recordAuditLog({
    actor,
    action: 'appointment.create',
    targetType: 'appointment',
    targetId: appointmentId,
    status: 'success',
    message: 'Tạo lịch hẹn thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointmentId, actor);
}

async function createAppointmentFromPatientPortal(payload, actor, requestMeta = {}) {
  if (!isPortalPatientActor(actor)) {
    throw createError('Chỉ bệnh nhân hoặc người thân được ủy quyền mới được dùng luồng tự đặt lịch.', 403);
  }
  await assertPortalAppointmentAuthorization(actor, [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS, AUTHORIZATION_TYPE.APPOINTMENT_MANAGE]);

  return createAppointment(
    {
      ...payload,
      // Keep patient_id forced from auth context; legacy audit looks for "patient_id: actor.patientId".
      patient_id: getPortalPatientId(actor),
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

async function listAppointments(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };
  const range = validateDateRangeQuery(query);

  if (query.patient_id) filter.patient_id = query.patient_id;
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.status) filter.status = query.status;
  if (query.source) filter.source = query.source;
  if (query.appointment_type) filter.appointment_type = query.appointment_type;
  if (query.date) {
    filter.appointment_time = { $gte: getStartOfDay(query.date), $lte: getEndOfDay(query.date) };
  }
  if (range) {
    filter.appointment_time = filter.appointment_time || {};
    if (range.dateFrom) filter.appointment_time.$gte = range.dateFrom;
    if (range.dateTo) filter.appointment_time.$lte = range.dateTo;
  }
  applyAppointmentReadScope(filter, actor);

  const [items, total] = await Promise.all([
    Appointment.find(filter).sort({ appointment_time: -1 }).skip(skip).limit(limit).lean(),
    Appointment.countDocuments(filter),
  ]);
  const { patientMap, doctorMap, departmentMap } = await buildAppointmentReferenceMaps(items);

  return {
    items: items.map((item) => {
      const doctor = doctorMap.get(String(item.doctor_id));
      const department = departmentMap.get(String(item.department_id));
      const patient = patientMap.get(String(item.patient_id));

      return {
        appointment_id: String(item._id),
        patient_id: String(item.patient_id),
        patient_code: patient?.patient_code || null,
        patient_name: patient?.full_name || null,
        patient_phone: patient?.phone || null,
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

async function searchAppointments(query = {}, actor = {}) {
  const keyword = String(query.keyword || query.q || query.search || '').trim();
  if (query.national_id && !canUseSensitivePatientSearchFilters(actor)) {
    throw createError('Quyền hiện tại không được tìm kiếm lịch hẹn theo national_id.', 403);
  }
  if (!keyword) {
    return listAppointments(query, actor);
  }

  const regex = new RegExp(escapeRegex(keyword), 'i');
  const patientSearchFields = [
    { patient_code: regex },
    { full_name: regex },
    { phone: regex },
    { email: regex },
  ];
  if (canUseSensitivePatientSearchFilters(actor)) {
    patientSearchFields.push({ national_id: regex });
  }
  if (query.national_id) {
    patientSearchFields.push({ national_id: new RegExp(escapeRegex(query.national_id), 'i') });
  }
  const patients = await Patient.find({
    is_deleted: false,
    $or: patientSearchFields,
  }).select('_id').limit(100).lean();
  const patientIds = patients.map((patient) => patient._id);
  const filterQuery = {
    ...query,
    patient_id: undefined,
  };
  const { page, limit, skip } = getPagination(filterQuery);
  const filter = {
    is_deleted: false,
    $or: [
      ...(patientIds.length ? [{ patient_id: { $in: patientIds } }] : []),
      { reason: regex },
      { source: regex },
    ],
  };
  if (query.status) filter.status = query.status;
  if (query.date) filter.appointment_time = { $gte: getStartOfDay(query.date), $lte: getEndOfDay(query.date) };
  const range = validateDateRangeQuery(query);
  if (range) {
    filter.appointment_time = filter.appointment_time || {};
    if (range.dateFrom) filter.appointment_time.$gte = range.dateFrom;
    if (range.dateTo) filter.appointment_time.$lte = range.dateTo;
  }
  applyAppointmentReadScope(filter, actor);

  const [items, total] = await Promise.all([
    Appointment.find(filter).sort({ appointment_time: -1 }).skip(skip).limit(limit).lean(),
    Appointment.countDocuments(filter),
  ]);
  const { patientMap, doctorMap, departmentMap } = await buildAppointmentReferenceMaps(items);

  return {
    items: items.map((item) => {
      const patient = patientMap.get(String(item.patient_id));
      const doctor = doctorMap.get(String(item.doctor_id));
      const department = departmentMap.get(String(item.department_id));
      return {
        appointment_id: String(item._id),
        patient_id: String(item.patient_id),
        patient_code: patient?.patient_code || null,
        patient_name: patient?.full_name || null,
        patient_phone: patient?.phone || null,
        doctor_id: String(item.doctor_id),
        doctor_name: doctor?.full_name || null,
        department_id: String(item.department_id),
        department_name: department?.department_name || null,
        appointment_time: item.appointment_time,
        status: item.status,
        source: item.source,
        reason: item.reason,
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

async function getAppointmentDetail(appointmentId, actor = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) {
    throw createError('Không tìm thấy lịch hẹn.', 404);
  }
  if (isPatientRelativeActor(actor)) {
    await assertPortalAppointmentAuthorization(actor, [AUTHORIZATION_TYPE.APPOINTMENT_READ, AUTHORIZATION_TYPE.APPOINTMENT_MANAGE, AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]);
  }
  assertAppointmentReadable(appointment, actor);

  const [queueTicket, encounter, patient, doctor, department] = await Promise.all([
    QueueTicket.findOne({ appointment_id: appointment._id }).lean(),
    Encounter.findOne({ appointment_id: appointment._id }).lean(),
    Patient.findById(appointment.patient_id).select('patient_code full_name phone date_of_birth gender').lean(),
    User.findById(appointment.doctor_id).select('full_name employee_code').lean(),
    Department.findById(appointment.department_id).select('department_name department_code').lean(),
  ]);

  return {
    appointment: {
      appointment_id: String(appointment._id),
      patient_id: String(appointment.patient_id),
      patient_code: patient?.patient_code || null,
      patient_name: patient?.full_name || null,
      patient_phone: isPortalPatientActor(actor) ? undefined : patient?.phone || null,
      doctor_id: String(appointment.doctor_id),
      doctor_name: doctor?.full_name || null,
      doctor_code: doctor?.employee_code || null,
      department_id: String(appointment.department_id),
      department_name: department?.department_name || null,
      department_code: department?.department_code || null,
      doctor_schedule_id: appointment.doctor_schedule_id ? String(appointment.doctor_schedule_id) : null,
      schedule_slot_id: appointment.schedule_slot_id ? String(appointment.schedule_slot_id) : null,
      appointment_time: appointment.appointment_time,
      appointment_type: appointment.appointment_type,
      reason: appointment.reason,
      source: appointment.source,
      status: appointment.status,
      notes: isPortalPatientActor(actor) ? undefined : appointment.notes,
      confirmed_at: appointment.confirmed_at,
      checked_in_at: appointment.checked_in_at,
      completed_at: appointment.completed_at,
      no_show_at: appointment.no_show_at,
      cancelled_by: isPatientActor(actor) ? undefined : (appointment.cancelled_by ? String(appointment.cancelled_by) : null),
      cancelled_at: appointment.cancelled_at,
      cancel_reason: appointment.cancel_reason,
      rescheduled_from_appointment_id: appointment.rescheduled_from_appointment_id
        ? String(appointment.rescheduled_from_appointment_id)
        : null,
      rescheduled_to_appointment_id: appointment.rescheduled_to_appointment_id
        ? String(appointment.rescheduled_to_appointment_id)
        : null,
      rescheduled_at: appointment.rescheduled_at,
      reschedule_reason: appointment.reschedule_reason,
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

async function checkAppointmentCanBeUpdated(appointmentId, payload = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  const requestedFields = Object.keys(payload || {});
  const rescheduleFields = requestedFields.filter((field) => APPOINTMENT_RESCHEDULE_FIELDS.has(field));
  const invalidFields = requestedFields.filter(
    (field) => !APPOINTMENT_LIGHT_UPDATE_FIELDS.has(field) && !APPOINTMENT_RESCHEDULE_FIELDS.has(field),
  );
  const reasons = [];
  if (TERMINAL_APPOINTMENT_STATUSES.includes(appointment.status)) {
    reasons.push('Appointment đã ở trạng thái kết thúc nên không thể cập nhật thường.');
  }
  if ([APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_CONSULTATION].includes(appointment.status) && rescheduleFields.length > 0) {
    reasons.push('Appointment đã check-in/đang khám nên không thể đổi giờ hoặc slot.');
  }
  if (rescheduleFields.length > 0) {
    reasons.push('Đổi doctor/department/schedule/slot/time phải dùng rescheduleAppointment.');
  }
  if (invalidFields.length > 0) {
    reasons.push(`Field không được cập nhật trực tiếp: ${invalidFields.join(', ')}.`);
  }
  return {
    appointment_id: String(appointment._id),
    can_update: reasons.length === 0,
    status: appointment.status,
    reschedule_fields: rescheduleFields,
    invalid_fields: invalidFields,
    reasons,
  };
}

async function checkAppointmentCanBeCancelled(appointmentId) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  const activeQueue = await QueueTicket.findOne({
    appointment_id: appointment._id,
    status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED, QUEUE_STATUS.SKIPPED, QUEUE_STATUS.IN_SERVICE] },
  }).lean();
  const reasons = [];
  if (TERMINAL_APPOINTMENT_STATUSES.includes(appointment.status)) {
    reasons.push('Appointment đã ở trạng thái kết thúc.');
  }
  if (appointment.status === APPOINTMENT_STATUS.IN_CONSULTATION || activeQueue?.status === QUEUE_STATUS.IN_SERVICE) {
    reasons.push('Bệnh nhân đang được phục vụ, không thể hủy appointment thường.');
  }
  return {
    appointment_id: String(appointment._id),
    can_cancel: reasons.length === 0,
    status: appointment.status,
    active_queue_ticket_id: activeQueue ? String(activeQueue._id) : null,
    reasons,
  };
}

async function checkAppointmentCanBeRescheduled(appointmentId) {
  return checkAppointmentCanBeUpdated(appointmentId);
}

async function checkAppointmentCanBeCheckedIn(appointmentId) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  const now = new Date();
  const appointmentTime = new Date(appointment.appointment_time);
  const earliest = new Date(appointmentTime.getTime() - CHECKIN_EARLY_MINUTES * 60 * 1000);
  const latest = new Date(appointmentTime.getTime() + CHECKIN_LATE_MINUTES * 60 * 1000);
  const activeQueue = await QueueTicket.findOne({
    appointment_id: appointment._id,
    status: { $in: ACTIVE_QUEUE_STATUSES },
  }).lean();
  const reasons = [];
  if (![APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CONFIRMED].includes(appointment.status)) {
    reasons.push('Appointment không ở trạng thái cho phép check-in.');
  }
  if (now < earliest || now > latest) {
    reasons.push('Appointment không nằm trong khoảng thời gian được phép check-in.');
  }
  if (activeQueue) {
    reasons.push('Appointment đã có queue ticket active.');
  }
  return {
    appointment_id: String(appointment._id),
    can_checkin: reasons.length === 0,
    status: appointment.status,
    active_queue_ticket_id: activeQueue ? String(activeQueue._id) : null,
    reasons,
  };
}

async function updateAppointment(appointmentId, payload, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) {
    throw createError('Không tìm thấy lịch hẹn.', 404);
  }
  assertAppointmentReadable(appointment, actor);
  assertAppointmentWritable(appointment, actor, 'update');

  const updateCheck = await checkAppointmentCanBeUpdated(appointment._id, payload);
  if (!updateCheck.can_update) {
    throw createError(updateCheck.reasons[0] || 'Lịch hẹn hiện không cho phép cập nhật.', 409);
  }

  if (payload.appointment_type !== undefined) appointment.appointment_type = payload.appointment_type;
  if (payload.source !== undefined) appointment.source = normalizeString(payload.source);
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

  return getAppointmentDetail(appointment._id, actor);
}

async function confirmAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  assertAppointmentReadable(appointment, actor);
  assertAppointmentWritable(appointment, actor, 'confirm');
  validateAppointmentStatusTransition(appointment.status, 'confirmed');
  appointment.status = 'confirmed';
  appointment.confirmed_at = new Date();
  appointment.updated_by = actor.userId;
  await appointment.save();
  await scheduleService.markSlotBookedForAppointment(appointment, actor, requestMeta);

  await recordAuditLog({
    actor,
    action: 'appointment.confirm',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Xác nhận lịch hẹn thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointment._id, actor);
}

async function cancelAppointment(appointmentId, payload = {}, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  assertAppointmentReadable(appointment, actor);
  assertAppointmentWritable(appointment, actor, 'cancel');
  const canCancel = await checkAppointmentCanBeCancelled(appointment._id);
  if (!canCancel.can_cancel) throw createError('Lịch hẹn hiện không thể hủy.', 409);

  validateAppointmentStatusTransition(appointment.status, 'cancelled');
  await withOptionalTransaction(async (session) => {
    appointment.status = APPOINTMENT_STATUS.CANCELLED;
    appointment.cancelled_by = actor.userId;
    appointment.cancelled_at = new Date();
    appointment.cancel_reason = payload.reason || payload.cancel_reason;
    appointment.notes = payload.reason ? `${appointment.notes || ''}\nLý do hủy: ${payload.reason}`.trim() : appointment.notes;
    appointment.updated_by = actor.userId;
    await appointment.save(sessionOptions(session));
    await scheduleService.releaseSlotForAppointment(appointment, actor, requestMeta, undefined, { session });
    await QueueTicket.updateMany(
      {
        appointment_id: appointment._id,
        status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED, QUEUE_STATUS.SKIPPED] },
      },
      {
        $set: {
          status: QUEUE_STATUS.CANCELLED,
          completed_time: new Date(),
          updated_by: actor?.userId,
        },
      },
      sessionOptions(session),
    );
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'appointment.cancel',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Hủy lịch hẹn thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointment._id, actor);
}

async function rescheduleAppointment(appointmentId, payload, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  assertAppointmentReadable(appointment, actor);
  assertAppointmentWritable(appointment, actor, 'reschedule');

  const canReschedule = await checkAppointmentCanBeRescheduled(appointment._id);
  if (!canReschedule.can_update) throw createError('Lịch hẹn hiện không thể đổi giờ.', 409);
  validateAppointmentStatusTransition(appointment.status, 'rescheduled');

  const nextTime = validateAppointmentTime(payload.appointment_time);
  const nextDoctorId = payload.doctor_id || appointment.doctor_id;
  const nextDepartmentId = payload.department_id || appointment.department_id;
  const nextScheduleId = payload.doctor_schedule_id || appointment.doctor_schedule_id;

  const targetPayload = {
    patient_id: appointment.patient_id,
    doctor_id: nextDoctorId,
    department_id: nextDepartmentId,
  };
  assertAppointmentCreateWritable(targetPayload, actor);

  const nextSchedule = await validateAppointmentSlot({
    doctor_id: nextDoctorId,
    department_id: nextDepartmentId,
    appointment_time: nextTime,
    doctor_schedule_id: nextScheduleId,
    schedule_slot_id: payload.schedule_slot_id,
    excludeAppointmentId: appointment._id,
  }, actor);
  if (isPortalPatientActor(actor)) {
    assertPortalScheduleBookable(nextSchedule);
  }
  const duplicateCheck = await checkPatientDuplicateBooking({
    patient_id: appointment.patient_id,
    appointment_time: nextTime,
    doctor_id: nextDoctorId,
    department_id: nextDepartmentId,
    schedule_slot_id: payload.schedule_slot_id,
    excludeAppointmentId: appointment._id,
  });
  if (duplicateCheck.has_duplicate) {
    throw createError('Bệnh nhân đang có lịch hẹn trùng hoặc quá gần khung giờ mới.', 409);
  }

  const rescheduledAt = new Date();
  const nextAppointmentId = new Types.ObjectId();
  let reservedSlotId = null;
  try {
    await withOptionalTransaction(async (session) => {
      const appointmentDraft = {
        _id: nextAppointmentId,
        patient_id: appointment.patient_id,
        doctor_id: nextDoctorId,
        department_id: nextDepartmentId,
        doctor_schedule_id: nextScheduleId,
        schedule_slot_id: payload.schedule_slot_id || undefined,
        appointment_time: nextTime,
      };
      const reservedSlot = await scheduleService.markSlotBookedForAppointment(appointmentDraft, actor, requestMeta, {
        session,
        requireUnassignedSlot: true,
      });
      reservedSlotId = reservedSlot?._id || payload.schedule_slot_id || null;

      const [nextAppointment] = await Appointment.create([{
        _id: nextAppointmentId,
        patient_id: appointment.patient_id,
        doctor_id: nextDoctorId,
        department_id: nextDepartmentId,
        doctor_schedule_id: nextScheduleId,
        schedule_slot_id: reservedSlotId || payload.schedule_slot_id || undefined,
        appointment_time: nextTime,
        appointment_type: payload.appointment_type || appointment.appointment_type,
        reason: payload.reason || appointment.reason,
        source: appointment.source,
        status: APPOINTMENT_STATUS.CONFIRMED,
        notes: payload.notes || appointment.notes,
        confirmed_at: rescheduledAt,
        rescheduled_from_appointment_id: appointment._id,
        rescheduled_at: rescheduledAt,
        reschedule_reason: payload.reason || payload.reschedule_reason,
        created_by: actor.userId,
        updated_by: actor.userId,
      }], sessionOptions(session));

      appointment.status = APPOINTMENT_STATUS.RESCHEDULED;
      appointment.rescheduled_to_appointment_id = nextAppointment._id;
      appointment.rescheduled_at = rescheduledAt;
      appointment.reschedule_reason = payload.reason || payload.reschedule_reason;
      appointment.updated_by = actor.userId;
      await appointment.save(sessionOptions(session));
      await scheduleService.releaseSlotForAppointment(appointment, actor, requestMeta, undefined, { session });
    }, { fallbackToNoTransaction: true });
  } catch (error) {
    if (reservedSlotId) {
      await ScheduleSlot.updateOne(
        { _id: reservedSlotId, appointment_id: nextAppointmentId },
        {
          $set: {
            status: 'available',
            booked_count: 0,
            updated_by: actor?.userId,
          },
          $unset: {
            appointment_id: '',
            patient_id: '',
            hold_expires_at: '',
          },
        },
      ).catch(() => null);
    }
    normalizeDuplicateKeyError(error, 'Slot mới đã được đặt hoặc appointment bị trùng.');
  }

  await recordAuditLog({
    actor,
    action: 'appointment.reschedule',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Đổi lịch hẹn thành công.',
    requestMeta,
  });

  return getAppointmentDetail(nextAppointmentId, actor);
}

async function createQueueTicketFromAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  if (isPatientRelativeActor(actor)) {
    await assertPortalAppointmentAuthorization(actor, [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS, AUTHORIZATION_TYPE.APPOINTMENT_MANAGE]);
  }
  assertAppointmentReadable(appointment, actor);
  assertAppointmentWritable(appointment, actor, 'checkin');
  const queueService = require('./queue.service');
  return queueService.createQueueTicketFromAppointment(appointmentId, actor, requestMeta);
}

async function createEncounterFromAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  assertAppointmentReadable(appointment, actor);
  assertAppointmentWritable(appointment, actor, 'encounter');

  if (![APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_CONSULTATION].includes(appointment.status)) {
    throw createError('Chỉ tạo encounter từ appointment đã check-in hoặc đang khám.', 409);
  }
  const encounterService = require('./encounter.service');
  return encounterService.createEncounterFromAppointment(appointment._id, actor, requestMeta);
}

async function linkAppointmentToEncounter(appointmentId, encounterId, actor, requestMeta = {}) {
  const [appointment, encounter] = await Promise.all([Appointment.findById(appointmentId), Encounter.findById(encounterId)]);

  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  assertAppointmentReadable(appointment, actor);
  assertAppointmentWritable(appointment, actor, 'link_encounter');
  if (String(encounter.patient_id) !== String(appointment.patient_id)) {
    throw createError('Encounter không thuộc cùng bệnh nhân với appointment.', 409);
  }
  if (encounter.appointment_id && String(encounter.appointment_id) !== String(appointment._id)) {
    throw createError('Encounter đã được liên kết với appointment khác.', 409);
  }

  const encounterService = require('./encounter.service');
  await encounterService.linkAppointmentToEncounter(encounter._id, appointment._id, actor, requestMeta);
  return getAppointmentDetail(appointment._id, actor);
}

async function checkInAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  if (isPatientRelativeActor(actor)) {
    await assertPortalAppointmentAuthorization(actor, [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS, AUTHORIZATION_TYPE.APPOINTMENT_MANAGE]);
  }
  assertAppointmentReadable(appointment, actor);
  assertAppointmentWritable(appointment, actor, 'checkin');
  const beforeStatus = appointment.status;

  if ([APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW, APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.RESCHEDULED].includes(appointment.status)) {
    throw createError('Appointment đã kết thúc nên không thể check-in.', 409);
  }

  const existingQueue = await QueueTicket.findOne({
    appointment_id: appointment._id,
    status: { $in: ACTIVE_QUEUE_STATUSES },
  }).lean();
  if (existingQueue && [APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_CONSULTATION].includes(appointment.status)) {
    return getAppointmentDetail(appointment._id, actor);
  }

  const canCheckIn = await checkAppointmentCanBeCheckedIn(appointment._id);
  if (!canCheckIn.can_checkin && !existingQueue) throw createError(canCheckIn.reasons[0] || 'Lịch hẹn hiện không thể check-in.', 409);

  try {
    await withOptionalTransaction(async (session) => {
      const document = await Appointment.findById(appointment._id).session(session);
      if (!document || document.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
      if ([APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW, APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.RESCHEDULED].includes(document.status)) {
        throw createError('Appointment đã kết thúc nên không thể check-in.', 409);
      }

      const activeQueue = await QueueTicket.findOne({
        appointment_id: document._id,
        status: { $in: ACTIVE_QUEUE_STATUSES },
      }).session(session).lean();

      if (![APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_CONSULTATION].includes(document.status)) {
        if (document.status === APPOINTMENT_STATUS.BOOKED) {
          validateAppointmentStatusTransition(document.status, APPOINTMENT_STATUS.CONFIRMED);
          document.status = APPOINTMENT_STATUS.CONFIRMED;
          document.confirmed_at = document.confirmed_at || new Date();
        }

        validateAppointmentStatusTransition(document.status, APPOINTMENT_STATUS.CHECKED_IN);
        document.status = APPOINTMENT_STATUS.CHECKED_IN;
        document.checked_in_at = document.checked_in_at || new Date();
        document.updated_by = actor.userId;
        await document.save(sessionOptions(session));
        await scheduleService.markSlotBookedForAppointment(document, actor, requestMeta, { session });
      }

      if (!activeQueue) {
        const queueService = require('./queue.service');
        await queueService.createQueueTicketFromAppointment(document._id, actor, requestMeta, { session });
      }
    }, { fallbackToNoTransaction: true });
  } catch (error) {
    if (error?.code === 11000) {
      const queue = await QueueTicket.findOne({
        appointment_id: appointment._id,
        status: { $in: ACTIVE_QUEUE_STATUSES },
      }).lean();
      if (queue) {
        return getAppointmentDetail(appointment._id, actor);
      }
    }
    throw error;
  }

  await recordAuditLog({
    actor,
    action: 'appointment.checkin',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Check-in lịch hẹn thành công.',
    requestMeta,
    before: { status: beforeStatus },
    after: { status: APPOINTMENT_STATUS.CHECKED_IN },
  });

  return getAppointmentDetail(appointment._id, actor);
}

async function markAppointmentNoShow(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  assertAppointmentReadable(appointment, actor);
  assertAppointmentWritable(appointment, actor, 'no_show');

  validateAppointmentStatusTransition(appointment.status, 'no_show');
  await withOptionalTransaction(async (session) => {
    appointment.status = APPOINTMENT_STATUS.NO_SHOW;
    appointment.no_show_at = new Date();
    appointment.updated_by = actor.userId;
    await appointment.save(sessionOptions(session));
    await scheduleService.markSlotOutcomeForAppointment(appointment, APPOINTMENT_STATUS.NO_SHOW, actor, requestMeta, { session });
    await QueueTicket.updateMany(
      {
        appointment_id: appointment._id,
        status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED, QUEUE_STATUS.SKIPPED] },
      },
      {
        $set: {
          status: QUEUE_STATUS.CANCELLED,
          cancel_reason: 'Appointment no-show',
          cancelled_at: new Date(),
          updated_by: actor?.userId,
        },
      },
      sessionOptions(session),
    );
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'appointment.no_show',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Đánh dấu no-show thành công.',
    requestMeta,
  });

  return getAppointmentDetail(appointment._id, actor);
}

async function completeAppointment(appointmentId, actor, requestMeta = {}) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || appointment.is_deleted) throw createError('Không tìm thấy lịch hẹn.', 404);
  assertAppointmentReadable(appointment, actor);
  assertAppointmentWritable(appointment, actor, 'complete');
  const beforeStatus = appointment.status;

  const encounter = await Encounter.findOne({
    appointment_id: appointment._id,
    status: { $ne: 'cancelled' },
  }).lean();
  if (!encounter) {
    throw createError('Không thể hoàn tất appointment khi chưa có encounter hợp lệ.', 409);
  }
  const signedConsultation = await Consultation.findOne({
    encounter_id: encounter._id,
    status: 'signed',
  }).lean();
  if (encounter.status !== 'completed' && !signedConsultation) {
    throw createError('Encounter chưa hoàn tất hoặc chưa có consultation đã ký.', 409);
  }

  if (appointment.status === APPOINTMENT_STATUS.CONFIRMED) {
    validateAppointmentStatusTransition(appointment.status, APPOINTMENT_STATUS.CHECKED_IN);
    appointment.status = APPOINTMENT_STATUS.CHECKED_IN;
    appointment.checked_in_at = appointment.checked_in_at || new Date();
  }

  if (appointment.status === APPOINTMENT_STATUS.CHECKED_IN) {
    validateAppointmentStatusTransition(appointment.status, APPOINTMENT_STATUS.IN_CONSULTATION);
    appointment.status = APPOINTMENT_STATUS.IN_CONSULTATION;
  }

  validateAppointmentStatusTransition(appointment.status, APPOINTMENT_STATUS.COMPLETED);
  await withOptionalTransaction(async (session) => {
    appointment.status = APPOINTMENT_STATUS.COMPLETED;
    appointment.completed_at = new Date();
    appointment.updated_by = actor.userId;
    await appointment.save(sessionOptions(session));
    await scheduleService.markSlotOutcomeForAppointment(appointment, APPOINTMENT_STATUS.COMPLETED, actor, requestMeta, { session });
    await QueueTicket.updateMany(
      {
        appointment_id: appointment._id,
        status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED, QUEUE_STATUS.SKIPPED, QUEUE_STATUS.IN_SERVICE] },
      },
      {
        $set: {
          status: QUEUE_STATUS.COMPLETED,
          completed_time: new Date(),
          updated_by: actor?.userId,
        },
      },
      sessionOptions(session),
    );
  }, { fallbackToNoTransaction: true });

  await recordAuditLog({
    actor,
    action: 'appointment.complete',
    targetType: 'appointment',
    targetId: appointment._id,
    status: 'success',
    message: 'Hoàn tất lịch hẹn thành công.',
    requestMeta,
    before: { status: beforeStatus },
    after: { status: APPOINTMENT_STATUS.COMPLETED },
  });

  return getAppointmentDetail(appointment._id, actor);
}

async function listAppointmentsByPatient(patientId, query = {}, actor = {}) {
  return listAppointments({ ...query, patient_id: patientId }, actor);
}

async function listAppointmentsByDoctor(doctorId, query = {}, actor = {}) {
  return listAppointments({ ...query, doctor_id: doctorId }, actor);
}

async function listAppointmentsByDepartment(departmentId, query = {}, actor = {}) {
  return listAppointments({ ...query, department_id: departmentId }, actor);
}

async function listAppointmentsByDate(date, query = {}, actor = {}) {
  return listAppointments({ ...query, date }, actor);
}

async function listUpcomingAppointments(query = {}, actor = {}) {
  return listAppointments({ ...query, date_from: new Date().toISOString() }, actor);
}

async function listTodayAppointments(query = {}, actor = {}) {
  return listAppointments({ ...query, date: query.date || new Date().toISOString() }, actor);
}

async function getMyAppointments(auth, query = {}) {
  if (isPortalPatientActor(auth)) {
    if (isPatientRelativeActor(auth)) {
      await assertPortalAppointmentAuthorization(auth, [AUTHORIZATION_TYPE.BOOK_APPOINTMENTS, AUTHORIZATION_TYPE.APPOINTMENT_READ, AUTHORIZATION_TYPE.APPOINTMENT_MANAGE]);
    }
    return listAppointments({ ...query, patient_id: getPortalPatientId(auth) }, auth);
  }
  if (auth?.actorType === 'staff' || auth?.actor_type === 'staff') {
    return listAppointments({ ...query, doctor_id: auth.userId }, auth);
  }
  throw createError('Không xác định được actor.', 403);
}

async function getMyAppointmentSummary(auth, query = {}) {
  if (!isPortalPatientActor(auth)) throw createError('Chỉ bệnh nhân/người thân được ủy quyền được xem thống kê lịch hẹn cá nhân.', 403);
  if (isPatientRelativeActor(auth)) {
    await assertPortalAppointmentAuthorization(auth, [AUTHORIZATION_TYPE.APPOINTMENT_READ, AUTHORIZATION_TYPE.APPOINTMENT_MANAGE, AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]);
  }
  return getAppointmentSummary({ ...query, patient_id: getPortalPatientId(auth) }, auth);
}

async function getMyAppointmentTimeline(appointmentId, query = {}, auth = {}) {
  if (!isPortalPatientActor(auth)) throw createError('Chỉ bệnh nhân/người thân được ủy quyền được xem timeline lịch hẹn cá nhân.', 403);
  if (isPatientRelativeActor(auth)) {
    await assertPortalAppointmentAuthorization(auth, [AUTHORIZATION_TYPE.APPOINTMENT_READ, AUTHORIZATION_TYPE.APPOINTMENT_MANAGE, AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]);
  }
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    patient_id: getPortalPatientId(auth),
    is_deleted: false,
  }).lean();
  if (!appointment) throw createError('Không tìm thấy lịch hẹn của bạn.', 404);
  return getAppointmentTimeline(appointmentId, query, auth);
}

async function getMyAppointmentActions(appointmentId, auth = {}) {
  if (!isPortalPatientActor(auth)) throw createError('Chỉ bệnh nhân/người thân được ủy quyền được xem thao tác lịch hẹn cá nhân.', 403);
  if (isPatientRelativeActor(auth)) {
    await assertPortalAppointmentAuthorization(auth, [AUTHORIZATION_TYPE.APPOINTMENT_READ, AUTHORIZATION_TYPE.APPOINTMENT_MANAGE, AUTHORIZATION_TYPE.BOOK_APPOINTMENTS]);
  }
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    patient_id: getPortalPatientId(auth),
    is_deleted: false,
  }).lean();
  if (!appointment) throw createError('Không tìm thấy lịch hẹn của bạn.', 404);

  const now = new Date();
  const activeQueue = await QueueTicket.findOne({
    appointment_id: appointment._id,
    status: { $in: ACTIVE_QUEUE_STATUSES },
  }).lean();
  const encounter = await Encounter.findOne({
    appointment_id: appointment._id,
    patient_id: appointment.patient_id,
  }).lean();
  const unpaidInvoice = encounter
    ? await Invoice.findOne({
      patient_id: appointment.patient_id,
      encounter_id: encounter._id,
      balance_due: { $gt: 0 },
      status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PARTIALLY_PAID] },
    }).select('_id invoice_no balance_due currency').lean()
    : null;
  const checkIn = await checkAppointmentCanBeCheckedIn(appointment._id);
  const canCancel = !TERMINAL_APPOINTMENT_STATUSES.includes(appointment.status)
    && appointment.status !== APPOINTMENT_STATUS.IN_CONSULTATION
    && activeQueue?.status !== QUEUE_STATUS.IN_SERVICE;
  const canReschedule = [APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CONFIRMED].includes(appointment.status)
    && new Date(appointment.appointment_time) > now
    && !activeQueue;

  return {
    appointment_id: String(appointment._id),
    status: appointment.status,
    can_reschedule: canReschedule,
    can_cancel: canCancel,
    can_check_in: Boolean(checkIn.can_checkin),
    can_pay: Boolean(unpaidInvoice),
    can_view_queue: Boolean(activeQueue),
    can_view_visit: Boolean(encounter),
    can_book_again: [
      APPOINTMENT_STATUS.COMPLETED,
      APPOINTMENT_STATUS.CANCELLED,
      APPOINTMENT_STATUS.NO_SHOW,
      APPOINTMENT_STATUS.RESCHEDULED,
    ].includes(appointment.status),
    reasons: {
      check_in: checkIn.reasons || [],
      reschedule: canReschedule ? [] : ['Lịch hẹn hiện không ở trạng thái/khung thời gian cho phép dời lịch.'],
      cancel: canCancel ? [] : ['Lịch hẹn hiện không thể hủy qua cổng bệnh nhân.'],
    },
    active_queue_ticket_id: activeQueue ? String(activeQueue._id) : null,
    encounter_id: encounter ? String(encounter._id) : null,
    unpaid_invoice: unpaidInvoice
      ? {
          invoice_id: String(unpaidInvoice._id),
          invoice_no: unpaidInvoice.invoice_no,
          balance_due: unpaidInvoice.balance_due,
          currency: unpaidInvoice.currency,
        }
      : null,
  };
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
    status: { $in: [APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CHECKED_IN] },
  });

  const ids = [];
  for (const appointment of appointments) {
    appointment.status = APPOINTMENT_STATUS.CANCELLED;
    appointment.cancelled_by = actor?.userId;
    appointment.cancelled_at = new Date();
    appointment.cancel_reason = 'Hủy theo lịch làm việc';
    appointment.updated_by = actor?.userId;
    await appointment.save();
    await scheduleService.releaseSlotForAppointment(appointment, actor, requestMeta);
    await QueueTicket.updateMany(
      {
        appointment_id: appointment._id,
        status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED, QUEUE_STATUS.SKIPPED] },
      },
      {
        $set: {
          status: QUEUE_STATUS.CANCELLED,
          cancel_reason: 'Hủy theo lịch làm việc',
          cancelled_at: new Date(),
          updated_by: actor?.userId,
        },
      },
    );
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

async function getAppointmentSummary(query = {}, actor = {}) {
  const filter = { is_deleted: false };
  const range = validateDateRangeQuery(query);
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.patient_id) filter.patient_id = query.patient_id;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.date) {
    filter.appointment_time = { $gte: getStartOfDay(query.date), $lte: getEndOfDay(query.date) };
  }
  if (range) {
    filter.appointment_time = filter.appointment_time || {};
    if (range.dateFrom) filter.appointment_time.$gte = range.dateFrom;
    if (range.dateTo) filter.appointment_time.$lte = range.dateTo;
  }
  applyAppointmentReadScope(filter, actor);

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
    upcoming: items.filter((item) => new Date(item.appointment_time) >= new Date() && [APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CONFIRMED].includes(item.status)).length,
    no_show_rate: items.length ? Number(((summarize('no_show') / items.length) * 100).toFixed(2)) : 0,
    cancellation_rate: items.length ? Number(((summarize('cancelled') / items.length) * 100).toFixed(2)) : 0,
  };
}

async function bulkConfirmAppointments(appointmentIds = [], actor, requestMeta = {}) {
  if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
    throw createError('appointment_ids là mảng không rỗng.', 400);
  }

  const items = [];
  for (const appointmentId of [...new Set(appointmentIds)]) {
    try {
      const result = await confirmAppointment(appointmentId, actor, requestMeta);
      items.push({
        appointment_id: String(appointmentId),
        success: true,
        status: result?.appointment?.status || APPOINTMENT_STATUS.CONFIRMED,
      });
    } catch (error) {
      items.push({
        appointment_id: String(appointmentId),
        success: false,
        error_code: errorCodeFromError(error),
        message: error.message || 'Xác nhận lịch hẹn thất bại.',
      });
    }
  }
  const successCount = items.filter((item) => item.success).length;

  await recordAuditLog({
    actor,
    action: 'appointment.bulk_confirm',
    targetType: 'appointment',
    status: 'success',
    message: 'Xác nhận hàng loạt lịch hẹn hoàn tất.',
    requestMeta,
    metadata: {
      success_count: successCount,
      failed_count: items.length - successCount,
      appointment_ids: items.map((item) => item.appointment_id),
    },
  });

  return {
    success_count: successCount,
    failed_count: items.length - successCount,
    items,
  };
}

async function bulkCancelAppointments(appointmentIds = [], payload = {}, actor, requestMeta = {}) {
  if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
    throw createError('appointment_ids là mảng không rỗng.', 400);
  }

  const items = [];
  for (const appointmentId of [...new Set(appointmentIds)]) {
    try {
      const result = await cancelAppointment(appointmentId, payload, actor, requestMeta);
      items.push({
        appointment_id: String(appointmentId),
        success: true,
        status: result?.appointment?.status || APPOINTMENT_STATUS.CANCELLED,
      });
    } catch (error) {
      items.push({
        appointment_id: String(appointmentId),
        success: false,
        error_code: errorCodeFromError(error),
        message: error.message || 'Hủy lịch hẹn thất bại.',
      });
    }
  }
  const successCount = items.filter((item) => item.success).length;

  await recordAuditLog({
    actor,
    action: 'appointment.bulk_cancel',
    targetType: 'appointment',
    status: 'success',
    message: 'Hủy hàng loạt lịch hẹn hoàn tất.',
    requestMeta,
    metadata: {
      success_count: successCount,
      failed_count: items.length - successCount,
      appointment_ids: items.map((item) => item.appointment_id),
      reason: payload.reason || payload.cancel_reason,
    },
  });

  return {
    success_count: successCount,
    failed_count: items.length - successCount,
    items,
  };
}

async function getAppointmentTimeline(appointmentId, query = {}, actor = {}) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment || appointment.is_deleted) {
    throw createError('Không tìm thấy lịch hẹn.', 404);
  }
  assertAppointmentReadable(appointment, actor);

  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 300);
  const queueTicketIds = await QueueTicket.distinct('_id', { appointment_id: appointment._id });
  const items = await AuditLog.find({
    $or: [
      { target_type: 'appointment', target_id: { $in: [appointment._id, String(appointment._id)] } },
      { target_type: 'queue_ticket', target_id: { $in: queueTicketIds } },
    ],
  })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();

  return {
    appointment_id: String(appointment._id),
    items: items.map((item) => ({
      audit_log_id: String(item._id),
      action: item.action,
      target_type: item.target_type,
      status: item.status,
      message: item.message,
      actor_type: item.actor_type,
      actor_label: isPatientActor(actor)
        ? (item.actor_type === 'patient' ? 'Bệnh nhân' : 'Nhân viên bệnh viện')
        : item.actor_type,
      created_at: item.created_at,
    })),
  };
}

module.exports = {
  // createAppointment: Tạo lịch hẹn.
  createAppointment,
  // listAppointments: Liệt kê lịch hẹn.
  listAppointments,
  // searchAppointments: Tìm kiếm lịch hẹn.
  searchAppointments,
  // getAppointmentDetail: Lấy chi tiết lịch hẹn.
  getAppointmentDetail,
  // updateAppointment: Cập nhật lịch hẹn.
  updateAppointment,
  // confirmAppointment: Xác nhận lịch hẹn.
  confirmAppointment,
  // cancelAppointment: Hủy lịch hẹn.
  cancelAppointment,
  // rescheduleAppointment: Đổi lịch cho lịch hẹn.
  rescheduleAppointment,
  // checkInAppointment: Ghi nhận check-in cho lịch hẹn.
  checkInAppointment,
  // markAppointmentNoShow: Đánh dấu lịch hẹn là bệnh nhân vắng mặt.
  markAppointmentNoShow,
  // completeAppointment: Hoàn tất lịch hẹn.
  completeAppointment,
  // validateAppointmentSlot: Kiểm tra tính hợp lệ của khung giờ đặt lịch.
  validateAppointmentSlot,
  // checkDoctorAvailability: Kiểm tra lịch trống của bác sĩ.
  checkDoctorAvailability,
  // checkPatientDuplicateBooking: Kiểm tra việc bệnh nhân đặt lịch trùng.
  checkPatientDuplicateBooking,
  // calculateAppointmentSource: Tính toán nguồn đặt lịch hẹn.
  calculateAppointmentSource,
  // validateAppointmentTime: Kiểm tra tính hợp lệ của thời gian lịch hẹn.
  validateAppointmentTime,
  // validateAppointmentStatusTransition: Kiểm tra tính hợp lệ của chuyển trạng thái lịch hẹn.
  validateAppointmentStatusTransition,
  // checkAppointmentCanBeUpdated: Kiểm tra điều kiện được cập nhật lịch hẹn.
  checkAppointmentCanBeUpdated,
  // checkAppointmentCanBeCancelled: Kiểm tra điều kiện được hủy lịch hẹn.
  checkAppointmentCanBeCancelled,
  // checkAppointmentCanBeRescheduled: Kiểm tra điều kiện được đổi lịch hẹn.
  checkAppointmentCanBeRescheduled,
  // checkAppointmentCanBeCheckedIn: Kiểm tra điều kiện check-in lịch hẹn.
  checkAppointmentCanBeCheckedIn,
  // listAppointmentsByPatient: Liệt kê lịch hẹn theo bệnh nhân.
  listAppointmentsByPatient,
  // listAppointmentsByDoctor: Liệt kê lịch hẹn theo bác sĩ.
  listAppointmentsByDoctor,
  // listAppointmentsByDepartment: Liệt kê lịch hẹn theo khoa/phòng ban.
  listAppointmentsByDepartment,
  // listAppointmentsByDate: Liệt kê lịch hẹn theo ngày.
  listAppointmentsByDate,
  // listUpcomingAppointments: Liệt kê lịch hẹn sắp tới.
  listUpcomingAppointments,
  // listTodayAppointments: Liệt kê lịch hẹn trong ngày.
  listTodayAppointments,
  // getMyAppointments: Lấy lịch hẹn của người dùng hiện tại.
  getMyAppointments,
  getMyAppointmentSummary,
  getMyAppointmentTimeline,
  getMyAppointmentActions,
  // createAppointmentFromPatientPortal: Tạo lịch hẹn từ cổng bệnh nhân.
  createAppointmentFromPatientPortal,
  // createAppointmentByStaff: Tạo lịch hẹn do nhân sự tạo.
  createAppointmentByStaff,
  // autoConfirmAppointment: Tự động xác nhận lịch hẹn khi thỏa điều kiện.
  autoConfirmAppointment,
  // sendAppointmentConfirmation: Gửi thông báo xác nhận lịch hẹn.
  sendAppointmentConfirmation,
  // sendAppointmentReminder: Gửi thông báo nhắc lịch hẹn.
  sendAppointmentReminder,
  // cancelAppointmentsBySchedule: Hủy lịch hẹn thuộc lịch làm việc.
  cancelAppointmentsBySchedule,
  // rescheduleAppointmentsByScheduleChange: Đổi lịch cho lịch hẹn bị ảnh hưởng khi đổi lịch làm việc.
  rescheduleAppointmentsByScheduleChange,
  // getAppointmentSummary: Lấy thống kê/tổng hợp lịch hẹn.
  getAppointmentSummary,
  // bulkConfirmAppointments: Xác nhận nhiều lịch hẹn trong một thao tác.
  bulkConfirmAppointments,
  // bulkCancelAppointments: Hủy nhiều lịch hẹn trong một thao tác.
  bulkCancelAppointments,
  // getAppointmentTimeline: Lấy dòng thời gian lịch hẹn.
  getAppointmentTimeline,
  // checkAppointmentConflictForDoctor: Kiểm tra xung đột lịch hẹn của bác sĩ.
  checkAppointmentConflictForDoctor,
  // checkAppointmentConflictForPatient: Kiểm tra xung đột lịch hẹn của bệnh nhân.
  checkAppointmentConflictForPatient,
  // createQueueTicketFromAppointment: Tạo phiếu hàng đợi từ lịch hẹn.
  createQueueTicketFromAppointment,
  // createEncounterFromAppointment: Tạo lượt khám từ lịch hẹn.
  createEncounterFromAppointment,
  // linkAppointmentToEncounter: Liên kết lịch hẹn với lượt khám tương ứng.
  linkAppointmentToEncounter,
};
