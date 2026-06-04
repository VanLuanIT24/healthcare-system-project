const {
  Appointment,
  AuditLog,
  Department,
  DoctorProfile,
  DoctorSchedule,
  Patient,
  Role,
  ScheduleSlot,
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
const {
  DEFAULT_SCHEDULE_TYPE,
  getScheduleTypeCatalog,
  getScheduleTypeDefinition,
  normalizeScheduleType,
} = require('../constants/catalogs/schedule-types');
const {
  ACTIVE_APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS,
  DOCTOR_PROFILE_STATUS,
  SCHEDULE_SLOT_STATUS,
  SCHEDULE_STATUS,
} = require('../constants/statuses');
const { PERMISSION } = require('../constants/permissions');
const permissionService = require('./permission.service');

const FINAL_SCHEDULE_STATUSES = [SCHEDULE_STATUS.CANCELLED, SCHEDULE_STATUS.COMPLETED];
const ACTIVE_SCHEDULE_STATUSES = [SCHEDULE_STATUS.PUBLISHED, SCHEDULE_STATUS.ACTIVE];
const TERMINAL_APPOINTMENT_STATUSES = [
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.NO_SHOW,
  APPOINTMENT_STATUS.RESCHEDULED,
];
const SCHEDULE_SAFE_UPDATE_FIELDS = new Set([
  'patient_portal_enabled',
  'staff_only',
  'return_visit_priority',
  'early_booking_enabled',
  'internal_note',
  'note',
  'schedule_type',
  'scheduleType',
]);
const SCHEDULE_DANGEROUS_UPDATE_FIELDS = new Set([
  'doctor_id',
  'department_id',
  'work_date',
  'shift_start',
  'shift_end',
  'slot_duration_minutes',
  'max_patients',
  'break_windows',
]);
const MAX_QUERY_DATE_RANGE_DAYS = 93;

function actorRoles(actor = {}) {
  return Array.isArray(actor.roles) ? actor.roles : [];
}

function hasRole(actor = {}, roleCode) {
  return actorRoles(actor).includes(roleCode);
}

function isDoctorActor(actor = {}) {
  return hasRole(actor, 'doctor');
}

function hasGlobalScheduleScope(actor = {}) {
  return hasAnyPermission(actor, [PERMISSION.SYSTEM.FULL_ACCESS, PERMISSION.SCHEDULES.READ]);
}

function hasAppointmentSlotSensitiveRead(actor = {}) {
  return hasAnyPermission(actor, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.APPOINTMENTS.READ,
    PERMISSION.APPOINTMENTS.READ_DEPARTMENT,
    PERMISSION.APPOINTMENTS.READ_OWN,
    PERMISSION.PATIENTS.READ,
    PERMISSION.PATIENTS.READ_ASSIGNED,
  ]);
}

function normalizeDuplicateKeyError(error, message = 'Dữ liệu trùng với ràng buộc duy nhất.') {
  if (error?.code === 11000) {
    throw createError(message, 409);
  }
  throw error;
}

function errorCodeFromError(error) {
  if (error?.code) return error.code;
  if (error?.statusCode === 403) return 'FORBIDDEN';
  if (error?.statusCode === 404) return 'NOT_FOUND';
  if (error?.statusCode === 409) return 'CONFLICT';
  if (error?.statusCode === 400) return 'BAD_REQUEST';
  return 'ERROR';
}

function validateDateRangeInput(dateFromValue, dateToValue) {
  if (!dateFromValue && !dateToValue) return null;
  const dateFrom = dateFromValue ? getStartOfDay(parseScheduleDate(dateFromValue)) : null;
  const dateTo = dateToValue ? getEndOfDay(parseScheduleDate(dateToValue)) : null;
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

function normalizeCreateScheduleStatus(status) {
  if (!status) return SCHEDULE_STATUS.DRAFT;
  if (status === SCHEDULE_STATUS.PUBLISHED || status === SCHEDULE_STATUS.DRAFT) return status;
  throw createError('Chỉ được tạo lịch ở trạng thái draft hoặc published.', 400);
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

function applyScheduleReadScope(filter, actor = {}) {
  if (!actor?.actorType && !actor?.actor_type) return filter;
  if (hasGlobalScheduleScope(actor)) {
    return filter;
  }

  if (hasPermission(actor, PERMISSION.APPOINTMENTS.CREATE)) {
    return filter;
  }

  if (isDoctorActor(actor) || hasAnyPermission(actor, [PERMISSION.SCHEDULES.READ_OWN, PERMISSION.APPOINTMENTS.READ_OWN])) {
    if (filter.doctor_id && String(filter.doctor_id) !== String(actor.userId)) {
      filter._id = null;
      return filter;
    }
    filter.doctor_id = actor.userId;
    return filter;
  }

  if (hasAnyPermission(actor, [PERMISSION.SCHEDULES.READ, PERMISSION.SCHEDULES.READ_DEPARTMENT, PERMISSION.APPOINTMENTS.READ, PERMISSION.APPOINTMENTS.READ_DEPARTMENT]) || actorDepartmentId(actor)) {
    const departmentId = actorDepartmentId(actor);
    if (!departmentId) {
      filter._id = null;
      return filter;
    }
    if (filter.department_id && String(filter.department_id) !== String(departmentId)) {
      filter._id = null;
      return filter;
    }
    filter.department_id = departmentId;
    return filter;
  }

  filter._id = null;
  return filter;
}

function sessionOptions(session) {
  return session ? { session } : {};
}

function parseScheduleDate(value) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  return new Date(value);
}

function localDateKey(value) {
  const date = value instanceof Date ? value : parseScheduleDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validateScheduleTimeRange(payload) {
  const shiftStart = parseScheduleDate(payload.shift_start);
  const shiftEnd = parseScheduleDate(payload.shift_end);
  const workDate = parseScheduleDate(payload.work_date || payload.shift_start);
  const slotDuration = Number(payload.slot_duration_minutes || 15);

  if (Number.isNaN(shiftStart.getTime()) || Number.isNaN(shiftEnd.getTime()) || Number.isNaN(workDate.getTime())) {
    throw createError('Thời gian lịch làm việc không hợp lệ.');
  }

  if (shiftStart >= shiftEnd) {
    throw createError('shift_start phải nhỏ hơn shift_end.');
  }

  const workDay = getStartOfDay(workDate);
  if (localDateKey(shiftStart) !== localDateKey(workDay) || localDateKey(shiftEnd) !== localDateKey(workDay)) {
    throw createError('shift_start và shift_end phải cùng ngày với work_date.', 400);
  }

  if (slotDuration < 5 || slotDuration > 240) {
    throw createError('slot_duration_minutes phải nằm trong khoảng 5 đến 240 phút.');
  }

  if (shiftEnd.getTime() - shiftStart.getTime() < slotDuration * 60 * 1000) {
    throw createError('Thời lượng ca phải lớn hơn hoặc bằng một slot.', 400);
  }

  if (payload.max_patients !== undefined && Number(payload.max_patients) < 0) {
    throw createError('max_patients không được nhỏ hơn 0.', 400);
  }

  return {
    workDate: workDay,
    shiftStart,
    shiftEnd,
    slotDuration,
  };
}

async function validateDoctorBelongsToDepartment(doctorId, departmentId) {
  const [doctor, department, doctorRole, doctorProfile] = await Promise.all([
    User.findById(doctorId).lean(),
    Department.findById(departmentId).lean(),
    Role.findOne({ role_code: 'doctor', is_deleted: false }).lean(),
    DoctorProfile.findOne({ user_id: doctorId, is_deleted: false }).lean(),
  ]);

  if (!doctor || doctor.is_deleted || doctor.status !== 'active') {
    throw createError('Không tìm thấy bác sĩ.', 404);
  }
  if (!department || department.is_deleted || department.status !== 'active') {
    throw createError('Department không tồn tại hoặc đang inactive.', 404);
  }
  if (!doctorProfile || doctorProfile.status !== DOCTOR_PROFILE_STATUS.ACTIVE) {
    throw createError('Hồ sơ chuyên môn của bác sĩ không tồn tại hoặc chưa active.', 409);
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
  if (String(doctorProfile.department_id) !== String(department._id)) {
    throw createError('Doctor profile không thuộc department này.', 409);
  }

  return { doctor, department, doctorProfile };
}

async function validateScheduleConflict({ doctor_id, work_date, shift_start, shift_end }, excludeId = null) {
  const conflicts = await findScheduleConflicts({ doctor_id, work_date, shift_start, shift_end }, excludeId);
  if (conflicts.length > 0) {
    throw createError('Bác sĩ đang bị trùng lịch trong khoảng thời gian này.', 409);
  }

  return true;
}

async function findScheduleConflicts({ doctor_id, work_date, shift_start, shift_end }, excludeId = null) {
  const filter = {
    doctor_id,
    is_deleted: false,
    work_date: getStartOfDay(work_date),
    status: { $nin: FINAL_SCHEDULE_STATUSES },
    shift_start: { $lt: new Date(shift_end) },
    shift_end: { $gt: new Date(shift_start) },
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return DoctorSchedule.find(filter).sort({ shift_start: 1 }).limit(10).lean();
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

function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return new Date(firstStart) < new Date(secondEnd) && new Date(secondStart) < new Date(firstEnd);
}

function slotOverlapsBreakWindow(slot, breakWindow) {
  return rangesOverlap(slot.slot_time, slot.slot_end, breakWindow.start_time, breakWindow.end_time);
}

function calculateBookableScheduleSlots(schedule) {
  const breakWindows = Array.isArray(schedule.break_windows) ? schedule.break_windows : [];
  return calculateScheduleSlots(schedule).filter(
    (slot) => !breakWindows.some((breakWindow) => slotOverlapsBreakWindow(slot, breakWindow)),
  );
}

function normalizeScheduleBreakWindows(schedule, payload = {}) {
  const rawWindows = Array.isArray(payload.break_windows) ? payload.break_windows : [];
  const windows = [];

  rawWindows.forEach((item) => {
    const startInput = item.start_time || item.start || item.range_start;
    const endInput = item.end_time || item.end || item.range_end;
    if (!startInput || !endInput) return;

    const startTime = parseScheduleSlotTime(startInput, schedule);
    const endTime = parseScheduleSlotTime(endInput, schedule);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || startTime >= endTime) {
      throw createError('Khoảng nghỉ giữa giờ không hợp lệ.', 400);
    }

    if (startTime < new Date(schedule.shift_start) || endTime > new Date(schedule.shift_end)) {
      throw createError('Khoảng nghỉ phải nằm trong khung giờ làm việc.', 400);
    }

    windows.push({
      start_time: startTime,
      end_time: endTime,
      mode: item.mode || item.break_slot_mode || '',
    });
  });

  windows.sort((first, second) => new Date(first.start_time) - new Date(second.start_time));
  for (let index = 1; index < windows.length; index += 1) {
    if (rangesOverlap(windows[index - 1].start_time, windows[index - 1].end_time, windows[index].start_time, windows[index].end_time)) {
      throw createError('Các khoảng nghỉ không được overlap nhau.', 400);
    }
  }

  return windows;
}

function buildBlockedSlotsFromBreakWindows(schedule, breakWindows = [], actor = {}) {
  if (!breakWindows.length) return [];

  const blocked = new Map();
  const theoreticalSlots = calculateScheduleSlots(schedule);

  breakWindows.forEach((window) => {
    theoreticalSlots.forEach((slot) => {
      const slotTime = new Date(slot.slot_time);
      if (slotOverlapsBreakWindow(slot, window)) {
        blocked.set(slotTime.toISOString(), {
          slot_time: slotTime,
          reason: 'Nghỉ giữa khung giờ',
          blocked_by: actor.userId,
          blocked_at: new Date(),
        });
      }
    });
  });

  return [...blocked.values()];
}

function getBreakWindowBlockedSlotMap(schedule) {
  return new Map(
    buildBlockedSlotsFromBreakWindows(schedule, schedule.break_windows || []).map((slot) => [
      new Date(slot.slot_time).toISOString(),
      slot,
    ]),
  );
}

async function getScheduleSlotStateMap(scheduleId) {
  const slots = await ScheduleSlot.find({
    doctor_schedule_id: scheduleId,
    is_deleted: false,
  }).lean();

  return new Map(slots.map((slot) => [new Date(slot.start_time).toISOString(), slot]));
}

function findTheoreticalScheduleSlot(schedule, slotTime) {
  return calculateBookableScheduleSlots(schedule).find((slot) => new Date(slot.slot_time).getTime() === slotTime.getTime());
}

async function upsertScheduleSlotState(schedule, slot, payload, actor, status) {
  const update = {
    doctor_id: schedule.doctor_id,
    department_id: schedule.department_id,
    start_time: slot.slot_time,
    end_time: slot.slot_end,
    capacity: 1,
    status,
    updated_by: actor?.userId,
  };

  if (status === 'blocked') {
    update.block_reason = payload.reason || payload.block_reason || 'Khóa khung giờ';
  }

  const unset = status === 'blocked' ? {} : { block_reason: '' };

  await ScheduleSlot.updateOne(
    {
      doctor_schedule_id: schedule._id,
      start_time: slot.slot_time,
      is_deleted: false,
    },
    {
      $set: update,
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
      $setOnInsert: {
        doctor_schedule_id: schedule._id,
        slot_number: calculateBookableScheduleSlots(schedule).findIndex((item) => new Date(item.slot_time).getTime() === new Date(slot.slot_time).getTime()) + 1,
        booked_count: 0,
        created_by: actor?.userId,
      },
    },
    { upsert: true },
  );
}

function formatTimeForSchedulePayload(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function normalizeScheduleIdList(value) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((scheduleId) => String(scheduleId || '').trim())
        .filter(Boolean),
    ),
  ];
}

function isSameScheduleDate(left, right) {
  return getStartOfDay(left).getTime() === getStartOfDay(right).getTime();
}

function scheduleOverlapsPreparedItem(schedule, preparedItem) {
  return (
    String(schedule.doctor_id) === String(preparedItem.item.doctor_id) &&
    isSameScheduleDate(schedule.work_date, preparedItem.normalized.workDate) &&
    new Date(schedule.shift_start) < preparedItem.normalized.shiftEnd &&
    new Date(schedule.shift_end) > preparedItem.normalized.shiftStart
  );
}

function scheduleExactlyMatchesPreparedItem(schedule, preparedItem) {
  return (
    scheduleOverlapsPreparedItem(schedule, preparedItem) &&
    new Date(schedule.shift_start).getTime() === preparedItem.normalized.shiftStart.getTime() &&
    new Date(schedule.shift_end).getTime() === preparedItem.normalized.shiftEnd.getTime()
  );
}

async function prepareBulkCreateItems(items = []) {
  const preparedItems = [];

  for (const item of items) {
    const normalized = validateScheduleTimeRange(item);
    await validateDoctorBelongsToDepartment(item.doctor_id, item.department_id);
    normalizeScheduleBreakWindows(
      {
        work_date: normalized.workDate,
        shift_start: normalized.shiftStart,
        shift_end: normalized.shiftEnd,
        slot_duration_minutes: normalized.slotDuration,
      },
      item,
    );
    preparedItems.push({ item, normalized });
  }

  return preparedItems;
}

async function buildScheduleDoctorMap(schedules = []) {
  const doctorIds = [...new Set(schedules.map((schedule) => String(schedule.doctor_id)).filter(Boolean))];

  if (doctorIds.length === 0) {
    return new Map();
  }

  const doctors = await User.find({ _id: { $in: doctorIds }, is_deleted: false })
    .select('full_name employee_code department_id avatar_url')
    .lean();

  return new Map(doctors.map((doctor) => [String(doctor._id), doctor]));
}

async function buildScheduleDepartmentMap(schedules = []) {
  const departmentIds = [...new Set(schedules.map((schedule) => String(schedule.department_id)).filter(Boolean))];

  if (departmentIds.length === 0) {
    return new Map();
  }

  const departments = await Department.find({ _id: { $in: departmentIds }, is_deleted: false })
    .select('department_name department_code location_note department_type')
    .lean();

  return new Map(departments.map((department) => [String(department._id), department]));
}

async function buildScheduleProfileMap(schedules = []) {
  const doctorIds = [...new Set(schedules.map((schedule) => String(schedule.doctor_id)).filter(Boolean))];

  if (doctorIds.length === 0) {
    return new Map();
  }

  const profiles = await DoctorProfile.find({
    user_id: { $in: doctorIds },
    is_deleted: false,
    status: DOCTOR_PROFILE_STATUS.ACTIVE,
    public_profile_enabled: { $ne: false },
  })
    .select('user_id specialty subspecialty qualification academic_title years_of_experience consultation_duration_minutes consultation_fee avatar_url status public_profile_enabled')
    .lean();

  return new Map(profiles.map((profile) => [String(profile.user_id), profile]));
}

function getScheduleSlotStats(schedule, bookedCount = 0) {
  const totalSlots = calculateBookableScheduleSlots(schedule).length;
  const blockedSlots = 0;
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

async function buildScheduleSlotStatsMap(schedules = []) {
  const scheduleIds = schedules.map((schedule) => schedule._id).filter(Boolean);
  if (scheduleIds.length === 0) {
    return new Map();
  }

  const rows = await ScheduleSlot.aggregate([
    {
      $match: {
        doctor_schedule_id: { $in: scheduleIds },
        is_deleted: false,
      },
    },
    {
      $group: {
        _id: { schedule_id: '$doctor_schedule_id', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ]);
  const statsMap = new Map();

  for (const schedule of schedules) {
    statsMap.set(String(schedule._id), {
      total_slots: 0,
      booked_slots: 0,
      available_slots: 0,
      blocked_slots: 0,
      completed_slots: 0,
      cancelled_slots: 0,
      no_show_slots: 0,
      utilization_rate: 0,
    });
  }

  for (const row of rows) {
    const scheduleId = String(row._id.schedule_id);
    const status = row._id.status;
    const stats = statsMap.get(scheduleId);
    if (!stats) continue;

    stats.total_slots += row.count;
    if (status === SCHEDULE_SLOT_STATUS.AVAILABLE) stats.available_slots += row.count;
    if (status === SCHEDULE_SLOT_STATUS.BOOKED) stats.booked_slots += row.count;
    if (status === SCHEDULE_SLOT_STATUS.BLOCKED) stats.blocked_slots += row.count;
    if (status === SCHEDULE_SLOT_STATUS.COMPLETED) {
      stats.completed_slots += row.count;
      stats.booked_slots += row.count;
    }
    if (status === SCHEDULE_SLOT_STATUS.CANCELLED) stats.cancelled_slots += row.count;
    if (status === SCHEDULE_SLOT_STATUS.NO_SHOW) {
      stats.no_show_slots += row.count;
      stats.booked_slots += row.count;
    }
    if (status === SCHEDULE_SLOT_STATUS.HELD) stats.held_slots = Number(stats.held_slots || 0) + row.count;
  }

  for (const [scheduleId, stats] of statsMap.entries()) {
    const schedule = schedules.find((item) => String(item._id) === scheduleId);
    if (stats.total_slots === 0 && schedule) {
      statsMap.set(scheduleId, getScheduleSlotStats(schedule));
      continue;
    }
    stats.utilization_rate = stats.total_slots > 0
      ? Number(((stats.booked_slots / stats.total_slots) * 100).toFixed(2))
      : 0;
  }

  return statsMap;
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
        status: { $nin: TERMINAL_APPOINTMENT_STATUSES },
      },
    },
    { $group: { _id: '$doctor_schedule_id', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), row.count]));
}

function getPublishStatus(schedule) {
  return ['active', 'published'].includes(schedule.status) ? 'visible' : 'hidden';
}

function formatDoctorSchedule(schedule, doctorMap = new Map(), departmentMap = new Map(), slotStats = null, options = {}) {
  const publicView = options.publicView === true;
  const doctor = doctorMap.get(String(schedule.doctor_id));
  const department = departmentMap.get(String(schedule.department_id));
  const profile = options.profileMap?.get(String(schedule.doctor_id));
  const stats = slotStats || getScheduleSlotStats(schedule);

  const formatted = {
    doctor_schedule_id: String(schedule._id),
    doctor_id: String(schedule.doctor_id),
    doctor_name: doctor?.full_name || null,
    doctor_code: doctor?.employee_code || null,
    doctor_avatar_url: profile?.avatar_url || doctor?.avatar_url || null,
    department_id: String(schedule.department_id),
    department_name: department?.department_name || null,
    department_code: department?.department_code || null,
    department_type: department?.department_type || null,
    location_note: department?.location_note || '',
    specialty: profile?.specialty || department?.department_name || null,
    subspecialty: profile?.subspecialty || '',
    qualification: profile?.qualification || '',
    academic_title: profile?.academic_title || '',
    years_of_experience: profile?.years_of_experience || 0,
    consultation_duration_minutes: profile?.consultation_duration_minutes || schedule.slot_duration_minutes || 15,
    consultation_fee: Number(profile?.consultation_fee || 0),
    work_date: schedule.work_date,
    shift_start: schedule.shift_start,
    shift_end: schedule.shift_end,
    slot_duration_minutes: schedule.slot_duration_minutes,
    max_patients: schedule.max_patients,
    schedule_type: normalizeScheduleType(schedule.schedule_type),
    patient_portal_enabled: schedule.patient_portal_enabled !== false,
    staff_only: schedule.staff_only === true,
    return_visit_priority: schedule.return_visit_priority === true,
    early_booking_enabled: schedule.early_booking_enabled !== false,
    internal_note: schedule.internal_note || '',
    break_windows: schedule.break_windows || [],
    blocked_slots_count: stats.blocked_slots,
    publish_status: getPublishStatus(schedule),
    slots_summary: stats,
    utilization_rate: stats.utilization_rate,
    status: schedule.status,
    created_at: schedule.created_at,
    updated_at: schedule.updated_at,
  };

  if (!publicView) {
    return formatted;
  }

  return {
    doctor_schedule_id: formatted.doctor_schedule_id,
    doctor_id: formatted.doctor_id,
    doctor_name: formatted.doctor_name,
    doctor_code: formatted.doctor_code,
    doctor_avatar_url: formatted.doctor_avatar_url,
    department_id: formatted.department_id,
    department_name: formatted.department_name,
    department_code: formatted.department_code,
    department_type: formatted.department_type,
    location_note: formatted.location_note,
    specialty: formatted.specialty,
    subspecialty: formatted.subspecialty,
    qualification: formatted.qualification,
    academic_title: formatted.academic_title,
    years_of_experience: formatted.years_of_experience,
    consultation_duration_minutes: formatted.consultation_duration_minutes,
    consultation_fee: formatted.consultation_fee,
    work_date: formatted.work_date,
    shift_start: formatted.shift_start,
    shift_end: formatted.shift_end,
    status: formatted.status,
    created_at: formatted.created_at,
    updated_at: formatted.updated_at,
  };
}

async function formatDoctorSchedulesWithStats(schedules = [], options = {}) {
  const [doctorMap, departmentMap, profileMap, bookedCountMap, slotStatsMap] = await Promise.all([
    buildScheduleDoctorMap(schedules),
    buildScheduleDepartmentMap(schedules),
    buildScheduleProfileMap(schedules),
    buildScheduleBookedCountMap(schedules),
    buildScheduleSlotStatsMap(schedules),
  ]);

  return schedules.map((schedule) => {
    const stats = slotStatsMap.get(String(schedule._id)) || getScheduleSlotStats(schedule, bookedCountMap.get(String(schedule._id)) || 0);
    return formatDoctorSchedule(schedule, doctorMap, departmentMap, stats, { ...options, profileMap });
  });
}

async function countScheduleAppointments(scheduleId) {
  return Appointment.countDocuments({
    doctor_schedule_id: scheduleId,
    is_deleted: false,
    status: { $nin: TERMINAL_APPOINTMENT_STATUSES },
  });
}

async function generateScheduleSlots(scheduleId, actor = {}, requestMeta = {}, options = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  if (options.skipWritable !== true) {
    assertScheduleReadable(schedule, actor);
    assertScheduleWritable(schedule, actor);
  }

  if (FINAL_SCHEDULE_STATUSES.includes(schedule.status) && options.allowFinalStatus !== true) {
    throw createError('Không thể generate slot cho lịch đã hủy hoặc hoàn tất.', 409);
  }

  const bookableSlots = calculateBookableScheduleSlots(schedule);
  const desiredKeys = new Set(bookableSlots.map((slot) => new Date(slot.slot_time).toISOString()));
  const operations = bookableSlots.map((slot, index) => ({
    updateOne: {
      filter: {
        doctor_schedule_id: schedule._id,
        start_time: slot.slot_time,
        is_deleted: false,
      },
      update: {
        $set: {
          doctor_id: schedule.doctor_id,
          department_id: schedule.department_id,
          slot_number: index + 1,
          start_time: slot.slot_time,
          end_time: slot.slot_end,
          capacity: 1,
          updated_by: actor?.userId,
        },
        $setOnInsert: {
          doctor_schedule_id: schedule._id,
          status: SCHEDULE_SLOT_STATUS.AVAILABLE,
          booked_count: 0,
          created_by: actor?.userId,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    try {
      await ScheduleSlot.bulkWrite(operations, { ordered: false });
    } catch (error) {
      if (error?.code !== 11000 && error?.writeErrors?.some((item) => item.code !== 11000)) {
        throw error;
      }
    }
  }

  const staleFilter = {
    doctor_schedule_id: schedule._id,
    is_deleted: false,
    start_time: { $nin: [...desiredKeys].map((value) => new Date(value)) },
    status: { $nin: [SCHEDULE_SLOT_STATUS.BOOKED, SCHEDULE_SLOT_STATUS.COMPLETED, SCHEDULE_SLOT_STATUS.NO_SHOW] },
  };
  const staleUpdate = await ScheduleSlot.updateMany(staleFilter, {
    $set: {
      status: SCHEDULE_SLOT_STATUS.CANCELLED,
      booked_count: 0,
      updated_by: actor?.userId,
    },
    $unset: {
      hold_expires_at: '',
      block_reason: '',
      appointment_id: '',
      patient_id: '',
    },
  });

  await recordAuditLog({
    actor,
    action: 'schedule.slots_generate',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: 'Đồng bộ slot lịch làm việc thành công.',
    requestMeta,
    metadata: {
      generated_slots: bookableSlots.length,
      cancelled_stale_slots: staleUpdate.modifiedCount || 0,
    },
  });

  return {
    schedule_id: String(schedule._id),
    generated_slots: bookableSlots.length,
    cancelled_stale_slots: staleUpdate.modifiedCount || 0,
  };
}

async function previewGenerateScheduleSlots(scheduleId, payload = {}, actor = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);

  const bookableSlots = calculateBookableScheduleSlots(schedule);
  const existingSlots = await ScheduleSlot.find({ doctor_schedule_id: schedule._id, is_deleted: false }).lean();
  const existingByTime = new Map(existingSlots.map((slot) => [new Date(slot.start_time).toISOString(), slot]));
  const desiredKeys = new Set(bookableSlots.map((slot) => new Date(slot.slot_time).toISOString()));
  const items = bookableSlots.map((slot, index) => {
    const key = new Date(slot.slot_time).toISOString();
    const existing = existingByTime.get(key);
    return {
      slot_time: slot.slot_time,
      start_time: slot.slot_time,
      end_time: slot.slot_end,
      slot_number: index + 1,
      status: existing?.status || 'available',
      operation: existing ? 'keep_or_update' : 'create',
      booked_count: existing?.booked_count || 0,
      capacity: existing?.capacity || 1,
      appointment_id: existing?.appointment_id ? String(existing.appointment_id) : null,
      patient_id: existing?.patient_id ? String(existing.patient_id) : null,
    };
  });
  const staleSlots = existingSlots.filter((slot) => {
    const key = new Date(slot.start_time).toISOString();
    return !desiredKeys.has(key) && !['booked', 'completed', 'no_show'].includes(slot.status);
  });

  return {
    schedule_id: String(schedule._id),
    items,
    stale_slots: staleSlots.map((slot) => ({
      slot_id: String(slot._id),
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: slot.status,
      operation: 'cancel_stale',
    })),
    summary: {
      desired_slots: items.length,
      new_slots: items.filter((item) => item.operation === 'create').length,
      existing_slots: items.filter((item) => item.operation === 'keep_or_update').length,
      booked_kept: items.filter((item) => item.booked_count > 0).length,
      stale_to_cancel: staleSlots.length,
    },
    data_source: 'database',
  };
}

async function getBookedSlots(scheduleId, actor = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);
  const canSeePatientData = hasAppointmentSlotSensitiveRead(actor);
  const items = await Appointment.find({
    doctor_schedule_id: scheduleId,
    is_deleted: false,
    status: { $nin: TERMINAL_APPOINTMENT_STATUSES },
  })
    .sort({ appointment_time: 1 })
    .lean();
  const patientIds = canSeePatientData ? [...new Set(items.map((item) => String(item.patient_id)).filter(Boolean))] : [];
  const patients = patientIds.length
    ? await Patient.find({ _id: { $in: patientIds }, is_deleted: false }).select('patient_code full_name phone').lean()
    : [];
  const patientMap = new Map(patients.map((patient) => [String(patient._id), patient]));

  return {
    schedule_id: String(scheduleId),
    items: items.map((appointment) => {
      const patient = patientMap.get(String(appointment.patient_id));
      return {
        appointment_id: canSeePatientData ? String(appointment._id) : undefined,
        appointment_time: appointment.appointment_time,
        patient_id: canSeePatientData ? String(appointment.patient_id) : undefined,
        patient_code: canSeePatientData ? patient?.patient_code || null : undefined,
        patient_name: canSeePatientData ? patient?.full_name || null : undefined,
        patient_phone: canSeePatientData ? patient?.phone || null : undefined,
        status: appointment.status,
        source: appointment.source,
      };
    }),
  };
}

async function getAvailableSlots(scheduleId, options = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const publicView = options.publicView === true;
  if (publicView) {
    if (!ACTIVE_SCHEDULE_STATUSES.includes(schedule.status) || schedule.patient_portal_enabled === false || schedule.staff_only === true) {
      return {
        items: [],
      };
    }
  } else if (options.actor) {
    assertScheduleReadable(schedule, options.actor);
  }
  const canSeeSlotSensitive = !publicView && hasAppointmentSlotSensitiveRead(options.actor || {});
  const canSeeOperationalSlotData = !publicView && hasAnyPermission(options.actor || {}, [
    PERMISSION.SYSTEM.FULL_ACCESS,
    PERMISSION.SCHEDULES.READ,
    PERMISSION.SCHEDULES.READ_DEPARTMENT,
    PERMISSION.SCHEDULES.READ_OWN,
    PERMISSION.SCHEDULE_SLOTS.BLOCK,
    PERMISSION.SCHEDULE_SLOTS.REOPEN,
  ]);

  const [booked, appointmentsCount] = await Promise.all([
    getBookedSlots(schedule._id, options.actor || {}),
    countScheduleAppointments(schedule._id),
  ]);

  const [slotStateMap] = await Promise.all([getScheduleSlotStateMap(schedule._id)]);
  const bookedSet = new Set(booked.items.map((item) => new Date(item.appointment_time).toISOString()));
  const theoreticalSlots = calculateBookableScheduleSlots(schedule);

  let items = theoreticalSlots.map((slot) => {
    const key = new Date(slot.slot_time).toISOString();
    const persistedSlot = slotStateMap.get(key);
    const holdExpired = persistedSlot?.status === SCHEDULE_SLOT_STATUS.HELD
      && persistedSlot.hold_expires_at
      && new Date(persistedSlot.hold_expires_at) <= new Date();
    const status = holdExpired ? SCHEDULE_SLOT_STATUS.AVAILABLE : persistedSlot?.status || SCHEDULE_SLOT_STATUS.AVAILABLE;
    const isBlocked = status === SCHEDULE_SLOT_STATUS.BLOCKED || status === SCHEDULE_SLOT_STATUS.CANCELLED;
    const isHeld = status === SCHEDULE_SLOT_STATUS.HELD;
    const isBooked = bookedSet.has(key)
      || [SCHEDULE_SLOT_STATUS.BOOKED, SCHEDULE_SLOT_STATUS.COMPLETED, SCHEDULE_SLOT_STATUS.NO_SHOW].includes(status);
    return {
      schedule_slot_id: publicView ? undefined : (persistedSlot ? String(persistedSlot._id) : null),
      appointment_id: canSeeSlotSensitive && persistedSlot?.appointment_id ? String(persistedSlot.appointment_id) : undefined,
      patient_id: canSeeSlotSensitive && persistedSlot?.patient_id ? String(persistedSlot.patient_id) : undefined,
      slot_time: slot.slot_time,
      slot_end: slot.slot_end,
      status: publicView ? undefined : status,
      block_reason: canSeeOperationalSlotData ? persistedSlot?.block_reason || null : undefined,
      is_blocked: publicView ? undefined : isBlocked,
      is_booked: publicView ? undefined : isBooked,
      is_available: !isBlocked && !isHeld && !isBooked && ACTIVE_SCHEDULE_STATUSES.includes(schedule.status),
    };
  });

  if (options.onlyAvailable || publicView) {
    items = items.filter((item) => item.is_available);
  }

  return {
    schedule_id: publicView ? undefined : String(schedule._id),
    status: publicView ? undefined : schedule.status,
    max_patients: publicView ? undefined : schedule.max_patients,
    appointments_count: publicView ? undefined : appointmentsCount,
    items,
  };
}

async function markSlotBookedForAppointment(appointment, actor = {}, requestMeta = {}, options = {}) {
  if (!appointment?.doctor_schedule_id) {
    return null;
  }
  const session = options.session || null;

  const schedule = await DoctorSchedule.findById(appointment.doctor_schedule_id).session(session).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc của appointment.', 404);
  }
  if (!ACTIVE_SCHEDULE_STATUSES.includes(schedule.status)) {
    throw createError('Lịch làm việc chưa được mở để đặt khám.', 409);
  }

  const slotTime = new Date(appointment.appointment_time);
  const targetSlot = findTheoreticalScheduleSlot(schedule, slotTime);
  if (!targetSlot) {
    throw createError('Appointment time không khớp với slot bookable của schedule.', 409);
  }

  const existingSlot = await ScheduleSlot.findOne({
    doctor_schedule_id: schedule._id,
    start_time: slotTime,
    is_deleted: false,
  }).session(session);

  if (existingSlot) {
    const bookedByOther = existingSlot.appointment_id
      && String(existingSlot.appointment_id) !== String(appointment._id)
      && [SCHEDULE_SLOT_STATUS.BOOKED, SCHEDULE_SLOT_STATUS.COMPLETED, SCHEDULE_SLOT_STATUS.NO_SHOW].includes(existingSlot.status);
    if (bookedByOther) {
      throw createError('Slot này đã được gắn với appointment khác.', 409);
    }
    if (existingSlot.status === SCHEDULE_SLOT_STATUS.BLOCKED || existingSlot.status === SCHEDULE_SLOT_STATUS.CANCELLED) {
      throw createError('Slot này đang bị khóa hoặc đã hủy.', 409);
    }
    if (options.requireUnassignedSlot && existingSlot.appointment_id && String(existingSlot.appointment_id) !== String(appointment._id)) {
      throw createError('Slot này đang được giữ bởi appointment khác.', 409);
    }
  }

  let slot;
  try {
    slot = await ScheduleSlot.findOneAndUpdate(
      {
        doctor_schedule_id: schedule._id,
        start_time: slotTime,
        is_deleted: false,
        $or: [
          {
            status: SCHEDULE_SLOT_STATUS.AVAILABLE,
            booked_count: { $lt: 1 },
            appointment_id: { $in: [null, appointment._id] },
          },
          {
            status: SCHEDULE_SLOT_STATUS.HELD,
            booked_count: { $lt: 1 },
            appointment_id: { $in: [null, appointment._id] },
          },
          {
            status: SCHEDULE_SLOT_STATUS.BOOKED,
            appointment_id: appointment._id,
          },
          {
            appointment_id: appointment._id,
          },
        ],
      },
      {
        $set: {
          doctor_id: appointment.doctor_id,
          department_id: appointment.department_id,
          start_time: targetSlot.slot_time,
          end_time: targetSlot.slot_end,
          capacity: 1,
          booked_count: 1,
          appointment_id: appointment._id,
          patient_id: appointment.patient_id,
          status: SCHEDULE_SLOT_STATUS.BOOKED,
          updated_by: actor?.userId,
        },
        $unset: {
          hold_expires_at: '',
          block_reason: '',
        },
        $setOnInsert: {
          doctor_schedule_id: schedule._id,
          slot_number: calculateBookableScheduleSlots(schedule).findIndex((item) => new Date(item.slot_time).getTime() === slotTime.getTime()) + 1,
          created_by: actor?.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, ...sessionOptions(session) },
    );
  } catch (error) {
    normalizeDuplicateKeyError(error, 'Slot vừa được đặt bởi giao dịch khác.');
  }
  if (!slot) {
    throw createError('Slot vừa được đặt bởi giao dịch khác.', 409);
  }

  if (appointment.schedule_slot_id === undefined || String(appointment.schedule_slot_id || '') !== String(slot._id)) {
    await Appointment.updateOne(
      { _id: appointment._id },
      { $set: { schedule_slot_id: slot._id, updated_by: actor?.userId } },
      sessionOptions(session),
    );
  }

  await recordAuditLog({
    actor,
    action: 'schedule.slot_book',
    targetType: 'schedule_slot',
    targetId: slot._id,
    status: 'success',
    message: 'Đồng bộ slot booked theo appointment thành công.',
    requestMeta,
    metadata: {
      doctor_schedule_id: String(schedule._id),
      appointment_id: String(appointment._id),
      patient_id: String(appointment.patient_id),
      slot_time: slotTime,
    },
  });

  return slot;
}

async function releaseSlotForAppointment(appointment, actor = {}, requestMeta = {}, finalSlotStatus = SCHEDULE_SLOT_STATUS.AVAILABLE, options = {}) {
  if (!appointment?.doctor_schedule_id) {
    return null;
  }
  const session = options.session || null;

  const slotTime = new Date(appointment.appointment_time);
  const slot = await ScheduleSlot.findOne({
    $or: [
      { appointment_id: appointment._id },
      {
        doctor_schedule_id: appointment.doctor_schedule_id,
        start_time: slotTime,
      },
    ],
    is_deleted: false,
  }).session(session);
  if (!slot) {
    return null;
  }

  const otherActiveAppointment = await Appointment.findOne({
    _id: { $ne: appointment._id },
    doctor_schedule_id: appointment.doctor_schedule_id,
    appointment_time: slot.start_time,
    is_deleted: false,
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
  }).session(session).lean();

  if (otherActiveAppointment) {
    slot.status = SCHEDULE_SLOT_STATUS.BOOKED;
    slot.booked_count = 1;
    slot.appointment_id = otherActiveAppointment._id;
    slot.patient_id = otherActiveAppointment.patient_id;
  } else if (finalSlotStatus === SCHEDULE_SLOT_STATUS.COMPLETED || finalSlotStatus === SCHEDULE_SLOT_STATUS.NO_SHOW) {
    slot.status = finalSlotStatus;
    slot.booked_count = 1;
    slot.appointment_id = appointment._id;
    slot.patient_id = appointment.patient_id;
  } else {
    slot.status = SCHEDULE_SLOT_STATUS.AVAILABLE;
    slot.booked_count = 0;
    slot.appointment_id = undefined;
    slot.patient_id = undefined;
  }
  slot.updated_by = actor?.userId;
  await slot.save(sessionOptions(session));

  await recordAuditLog({
    actor,
    action: 'schedule.slot_release',
    targetType: 'schedule_slot',
    targetId: slot._id,
    status: 'success',
    message: 'Đồng bộ slot sau khi appointment đổi trạng thái thành công.',
    requestMeta,
    metadata: {
      appointment_id: String(appointment._id),
      final_slot_status: slot.status,
    },
  });

  return slot;
}

async function markSlotOutcomeForAppointment(appointment, outcomeStatus, actor = {}, requestMeta = {}, options = {}) {
  const finalSlotStatus = outcomeStatus === APPOINTMENT_STATUS.NO_SHOW
    ? SCHEDULE_SLOT_STATUS.NO_SHOW
    : SCHEDULE_SLOT_STATUS.COMPLETED;
  return releaseSlotForAppointment(appointment, actor, requestMeta, finalSlotStatus, options);
}

async function validateScheduleBeforePublish(scheduleId) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  if (schedule.status !== SCHEDULE_STATUS.DRAFT && schedule.status !== SCHEDULE_STATUS.PUBLISHED) {
    throw createError('Chỉ lịch draft hoặc published mới được mở cho đặt lịch.', 409);
  }

  validateScheduleTimeRange(schedule);
  await validateDoctorBelongsToDepartment(schedule.doctor_id, schedule.department_id);
  await validateScheduleConflict(
    {
      doctor_id: schedule.doctor_id,
      work_date: schedule.work_date,
      shift_start: schedule.shift_start,
      shift_end: schedule.shift_end,
    },
    schedule._id,
  );

  const slotCount = await ScheduleSlot.countDocuments({
    doctor_schedule_id: schedule._id,
    is_deleted: false,
    status: { $ne: SCHEDULE_SLOT_STATUS.CANCELLED },
  });
  if (slotCount === 0) {
    throw createError('Không thể publish lịch chưa có slot.', 409);
  }

  return schedule;
}

async function checkScheduleCanBeUpdated(scheduleId, payload = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const appointmentsCount = await countScheduleAppointments(scheduleId);
  const activeAppointmentsCount = await Appointment.countDocuments(getActiveAppointmentFilter(scheduleId));
  const requestedFields = Object.keys(payload || {});
  const dangerousFields = requestedFields.filter((field) => SCHEDULE_DANGEROUS_UPDATE_FIELDS.has(field));
  const safeOnly = requestedFields.length === 0 || requestedFields.every((field) => SCHEDULE_SAFE_UPDATE_FIELDS.has(field));
  const reasons = [];

  if (FINAL_SCHEDULE_STATUSES.includes(schedule.status)) {
    reasons.push('Lịch đã hủy hoặc hoàn tất không thể cập nhật.');
  }
  if (activeAppointmentsCount > 0 && dangerousFields.length > 0) {
    reasons.push('Lịch đã có appointment active nên không thể sửa doctor/department/thời gian/duration/break.');
  }

  return {
    schedule_id: String(scheduleId),
    can_update: reasons.length === 0,
    appointments_count: appointmentsCount,
    active_appointments_count: activeAppointmentsCount,
    safe_update_only: safeOnly,
    blocked_fields: dangerousFields,
    reasons,
  };
}

async function checkScheduleCanBeCancelled(scheduleId) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }

  const appointmentsCount = await countScheduleAppointments(scheduleId);
  const activeAppointmentsCount = await Appointment.countDocuments(getActiveAppointmentFilter(scheduleId));
  const reasons = [];
  if (FINAL_SCHEDULE_STATUSES.includes(schedule.status)) {
    reasons.push('Lịch đã hủy hoặc hoàn tất.');
  }
  if (activeAppointmentsCount > 0) {
    reasons.push('Lịch còn appointment active, cần reschedule hoặc cancel appointment trước.');
  }

  return {
    schedule_id: String(scheduleId),
    can_cancel: reasons.length === 0,
    appointments_count: appointmentsCount,
    active_appointments_count: activeAppointmentsCount,
    reasons,
  };
}

async function checkDoctorHasFutureAppointmentsInSchedule(scheduleId, actor = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);
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
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
  };
}

async function getScheduleActivityLog(scheduleId, query = {}, actor = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);
  const { page, limit, skip } = getPagination(query, 20, 100);
  const slotIds = await ScheduleSlot.distinct('_id', { doctor_schedule_id: schedule._id, is_deleted: false });
  const filter = {
    $or: [
      { target_type: 'doctor_schedule', target_id: { $in: [scheduleId, schedule._id] } },
      { target_type: 'schedule_slot', target_id: { $in: slotIds } },
    ],
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

function applyCreateSchedulePayloadToExistingSchedule(schedule, payload, scheduleBase, breakWindows, actor = {}) {
  schedule.department_id = payload.department_id;
  schedule.work_date = scheduleBase.work_date;
  schedule.shift_start = scheduleBase.shift_start;
  schedule.shift_end = scheduleBase.shift_end;
  schedule.slot_duration_minutes = scheduleBase.slot_duration_minutes;
  schedule.max_patients = payload.max_patients;
  const scheduleType = getScheduleTypeDefinition(payload.schedule_type || payload.scheduleType || DEFAULT_SCHEDULE_TYPE);
  schedule.schedule_type = scheduleType.value;
  schedule.patient_portal_enabled = payload.patient_portal_enabled !== undefined ? payload.patient_portal_enabled !== false : scheduleType.patient_portal_enabled !== false;
  schedule.staff_only = payload.staff_only !== undefined ? payload.staff_only === true : scheduleType.staff_only === true;
  schedule.return_visit_priority = payload.return_visit_priority !== undefined ? payload.return_visit_priority === true : scheduleType.return_visit_priority === true;
  schedule.early_booking_enabled = payload.early_booking_enabled !== false;
  schedule.internal_note = payload.internal_note || payload.note || '';
  schedule.break_windows = breakWindows;
  schedule.status = normalizeCreateScheduleStatus(payload.status);
  if (actor.userId) {
    schedule.updated_by = actor.userId;
  }
  return schedule;
}

async function createDoctorScheduleInternal(payload, actor, requestMeta = {}) {
  const normalized = validateScheduleTimeRange(payload);
  const { doctor, department } = await validateDoctorBelongsToDepartment(payload.doctor_id, payload.department_id);
  assertScheduleTargetWritable({ doctor_id: payload.doctor_id, department_id: payload.department_id }, actor);
  const exactExistingSchedule = await DoctorSchedule.findOne({
    doctor_id: payload.doctor_id,
    work_date: normalized.workDate,
    shift_start: normalized.shiftStart,
    shift_end: normalized.shiftEnd,
    is_deleted: false,
  });
  await validateScheduleConflict(
    {
      doctor_id: payload.doctor_id,
      work_date: normalized.workDate,
      shift_start: normalized.shiftStart,
      shift_end: normalized.shiftEnd,
    },
    exactExistingSchedule?._id || null,
  );
  const scheduleBase = {
    work_date: normalized.workDate,
    shift_start: normalized.shiftStart,
    shift_end: normalized.shiftEnd,
    slot_duration_minutes: normalized.slotDuration,
  };
  const breakWindows = normalizeScheduleBreakWindows(scheduleBase, payload);
  const scheduleBaseWithBreaks = { ...scheduleBase, break_windows: breakWindows };
  const blockedSlots = buildBlockedSlotsFromBreakWindows(scheduleBaseWithBreaks, breakWindows, actor);
  const theoreticalSlotCount = calculateBookableScheduleSlots(scheduleBaseWithBreaks).length;
  const availableSlotCount = theoreticalSlotCount;
  const totalCapacity = availableSlotCount * Number(payload.max_patients || 1);
  const scheduleType = getScheduleTypeDefinition(payload.schedule_type || payload.scheduleType || DEFAULT_SCHEDULE_TYPE);

  let schedule;
  let reusedExistingSchedule = false;
  if (exactExistingSchedule) {
    if (payload.conflict_strategy !== 'update_existing') {
      throw createError('Lịch này đã tồn tại. Dùng conflict_strategy=update_existing nếu muốn cập nhật lịch hiện có.', 409);
    }
    assertScheduleWritable(exactExistingSchedule, actor);
    const existingAppointmentsCount = await countScheduleAppointments(exactExistingSchedule._id);
    if (existingAppointmentsCount > 0) {
      throw createError('Lịch này đã tồn tại và có appointment, không thể ghi đè bằng create.', 409);
    }
    applyCreateSchedulePayloadToExistingSchedule(
      exactExistingSchedule,
      payload,
      scheduleBase,
      breakWindows,
      actor,
    );
    schedule = await exactExistingSchedule.save();
    reusedExistingSchedule = true;
  } else {
    try {
      schedule = await DoctorSchedule.create({
        doctor_id: payload.doctor_id,
        department_id: payload.department_id,
        ...scheduleBase,
        max_patients: payload.max_patients,
        schedule_type: scheduleType.value,
        patient_portal_enabled:
          payload.patient_portal_enabled !== undefined
            ? payload.patient_portal_enabled !== false
            : scheduleType.patient_portal_enabled !== false,
        staff_only:
          payload.staff_only !== undefined
            ? payload.staff_only === true
            : scheduleType.staff_only === true,
        return_visit_priority:
          payload.return_visit_priority !== undefined
            ? payload.return_visit_priority === true
            : scheduleType.return_visit_priority === true,
        early_booking_enabled: payload.early_booking_enabled !== false,
        internal_note: payload.internal_note || payload.note || '',
        break_windows: breakWindows,
        status: normalizeCreateScheduleStatus(payload.status),
        created_by: actor.userId,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      if (payload.conflict_strategy !== 'update_existing') {
        throw createError('Lịch này đã tồn tại. Dùng conflict_strategy=update_existing nếu muốn cập nhật lịch hiện có.', 409);
      }

      const existingSchedule = await DoctorSchedule.findOne({
        doctor_id: payload.doctor_id,
        work_date: normalized.workDate,
        shift_start: normalized.shiftStart,
        shift_end: normalized.shiftEnd,
        is_deleted: false,
      });

      if (!existingSchedule) throw error;

      assertScheduleWritable(existingSchedule, actor);
      applyCreateSchedulePayloadToExistingSchedule(existingSchedule, payload, scheduleBase, breakWindows, actor);
      schedule = await existingSchedule.save();
      reusedExistingSchedule = true;
    }
  }
  await generateScheduleSlots(schedule._id, actor, requestMeta);
  const notification = {
    type: reusedExistingSchedule ? 'schedule.updated_existing' : 'schedule.created',
    title: reusedExistingSchedule
      ? 'Đã cập nhật lịch bác sĩ đã tồn tại'
      : schedule.status === 'published' ? 'Đã tạo và công khai lịch bác sĩ' : 'Đã lưu nháp lịch bác sĩ',
    message: `${doctor.full_name || 'Bác sĩ'} - ${department.department_name || 'Khoa'}: ${normalized.shiftStart.toISOString()} đến ${normalized.shiftEnd.toISOString()}.`,
    status: 'success',
    schedule_id: String(schedule._id),
    schedule_status: schedule.status,
    doctor_id: String(schedule.doctor_id),
    doctor_name: doctor.full_name || null,
    doctor_code: doctor.employee_code || null,
    department_id: String(schedule.department_id),
    department_name: department.department_name || null,
    department_code: department.department_code || null,
    work_date: normalized.workDate,
    shift_start: normalized.shiftStart,
    shift_end: normalized.shiftEnd,
    slot_duration_minutes: normalized.slotDuration,
    total_slots: theoreticalSlotCount,
    available_slots: availableSlotCount,
    blocked_slots: blockedSlots.length,
    max_patients_per_slot: Number(payload.max_patients || 1),
    total_capacity: totalCapacity,
    schedule_type: schedule.schedule_type,
    patient_portal_enabled: schedule.patient_portal_enabled,
    staff_only: schedule.staff_only,
    return_visit_priority: schedule.return_visit_priority,
    early_booking_enabled: schedule.early_booking_enabled,
    internal_note: schedule.internal_note || '',
    break_windows: breakWindows.map((window) => ({
      start_time: window.start_time,
      end_time: window.end_time,
      mode: window.mode || '',
    })),
    created_at: schedule.created_at,
  };

  await recordAuditLog({
    actor,
    action: 'schedule.create',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: notification.title,
    requestMeta,
    metadata: {
      notification,
      doctor_id: notification.doctor_id,
      doctor_name: notification.doctor_name,
      doctor_code: notification.doctor_code,
      department_id: notification.department_id,
      department_name: notification.department_name,
      department_code: notification.department_code,
      work_date: notification.work_date,
      shift_start: notification.shift_start,
      shift_end: notification.shift_end,
      slot_duration_minutes: notification.slot_duration_minutes,
      total_slots: notification.total_slots,
      available_slots: notification.available_slots,
      blocked_slots: notification.blocked_slots,
      max_patients_per_slot: notification.max_patients_per_slot,
      total_capacity: notification.total_capacity,
      schedule_status: notification.schedule_status,
      reused_existing_schedule: reusedExistingSchedule,
      break_windows_count: breakWindows.length,
      blocked_break_slots_count: blockedSlots.length,
      schedule_type: schedule.schedule_type,
      patient_portal_enabled: notification.patient_portal_enabled,
      staff_only: notification.staff_only,
      return_visit_priority: notification.return_visit_priority,
      early_booking_enabled: notification.early_booking_enabled,
      internal_note: notification.internal_note,
    },
  });

  const detail = await getDoctorScheduleDetail(schedule._id);
  return {
    ...detail,
    notification,
  };
}

async function recordCreateDoctorScheduleFailure(payload = {}, actor = {}, requestMeta = {}, error = {}) {
  try {
    await recordAuditLog({
      actor,
      action: 'schedule.create',
      targetType: 'doctor_schedule',
      status: 'failure',
      message: error.message || 'Tạo lịch làm việc bác sĩ thất bại.',
      requestMeta,
      metadata: {
        notification: {
          type: 'schedule.create_failed',
          title: 'Tạo lịch bác sĩ thất bại',
          message: error.message || 'Tạo lịch làm việc bác sĩ thất bại.',
          status: 'failure',
          doctor_id: payload?.doctor_id,
          department_id: payload?.department_id,
          work_date: payload?.work_date,
          shift_start: payload?.shift_start,
          shift_end: payload?.shift_end,
          slot_duration_minutes: payload?.slot_duration_minutes,
          max_patients_per_slot: payload?.max_patients,
          schedule_type: payload?.schedule_type,
        },
      },
    });
  } catch (_) {
    // Failure audit is best-effort and must not hide the original schedule error.
  }
}

async function createDoctorSchedule(payload, actor, requestMeta = {}) {
  try {
    return await createDoctorScheduleInternal(payload, actor, requestMeta);
  } catch (error) {
    await recordCreateDoctorScheduleFailure(payload, actor, requestMeta, error);
    throw error;
  }
}

async function listDoctorSchedules(query = {}, actor = {}, options = {}) {
  const publicView = options.publicView === true;
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };
  const range = validateDateRangeInput(query.date_from, query.date_to);

  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.department_id) filter.department_id = query.department_id;
  if (publicView) {
    const statuses = String(query.status || '')
      .split(',')
      .map((status) => status.trim())
      .filter((status) => ACTIVE_SCHEDULE_STATUSES.includes(status));
    filter.status = statuses.length > 0 ? { $in: statuses } : { $in: ACTIVE_SCHEDULE_STATUSES };
    filter.patient_portal_enabled = { $ne: false };
    filter.staff_only = { $ne: true };
  } else if (query.status) {
    const statuses = String(query.status)
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean);
    filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  if (range) {
    filter.work_date = {};
    if (range.dateFrom) filter.work_date.$gte = range.dateFrom;
    if (range.dateTo) filter.work_date.$lte = range.dateTo;
  }
  if (!publicView) {
    applyScheduleReadScope(filter, actor);
  }

  const [items, total] = await Promise.all([
    DoctorSchedule.find(filter)
      .sort({ work_date: -1, shift_start: -1, updated_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DoctorSchedule.countDocuments(filter),
  ]);
  const formattedItems = await formatDoctorSchedulesWithStats(items, { publicView });

  return {
    items: formattedItems,
    pagination: buildPagination(page, limit, total),
  };
}

function assertScheduleReadable(schedule, actor = {}) {
  if (!actor?.actorType && !actor?.actor_type) return true;
  const filter = {
    _id: schedule._id,
    doctor_id: schedule.doctor_id,
    department_id: schedule.department_id,
  };
  applyScheduleReadScope(filter, actor);
  if (filter._id === null) {
    throw createError('Bạn không có quyền xem lịch này.', 403);
  }
  if (filter.doctor_id && String(filter.doctor_id) !== String(schedule.doctor_id)) {
    throw createError('Bạn không có quyền xem lịch này.', 403);
  }
  if (filter.department_id && String(filter.department_id) !== String(schedule.department_id)) {
    throw createError('Bạn không có quyền xem lịch này.', 403);
  }
  return true;
}

function assertScheduleWritable(schedule, actor = {}) {
  if (!actor?.actorType && !actor?.actor_type) {
    throw createError('Bạn chưa được xác thực.', 401);
  }

  if (hasGlobalScheduleScope(actor)) {
    return true;
  }

  if (isDoctorActor(actor) || hasPermission(actor, PERMISSION.SCHEDULES.READ_OWN)) {
    if (actor.userId && String(schedule.doctor_id) === String(actor.userId)) {
      return true;
    }
    throw createError('Bác sĩ chỉ được thao tác lịch của chính mình.', 403);
  }

  const departmentId = actorDepartmentId(actor);
  if (departmentId && String(schedule.department_id) === String(departmentId)) {
    return true;
  }

  throw createError('Bạn không có quyền thao tác lịch này.', 403);
}

function assertScheduleTargetWritable({ doctor_id, department_id }, actor = {}) {
  return assertScheduleWritable({ doctor_id, department_id }, actor);
}

async function getDoctorScheduleDetail(scheduleId, actor = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);

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
      blocked_slots: availableSlots.items
        .filter((item) => item.is_blocked)
        .map((item) => ({
          schedule_slot_id: item.schedule_slot_id,
          slot_time: item.slot_time,
          reason: item.block_reason,
        })),
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
  assertScheduleReadable(schedule, actor);
  assertScheduleWritable(schedule, actor);

  const updateCheck = await checkScheduleCanBeUpdated(schedule._id, payload);
  if (!updateCheck.can_update) {
    throw createError(updateCheck.reasons[0] || 'Lịch hiện không thể cập nhật.', 409);
  }

  const hasDangerousChange = Object.keys(payload || {}).some((field) => SCHEDULE_DANGEROUS_UPDATE_FIELDS.has(field));
  let shouldRegenerateSlots = false;

  if (hasDangerousChange) {
    const mergedPayload = {
      work_date: payload.work_date || schedule.work_date,
      shift_start: payload.shift_start || schedule.shift_start,
      shift_end: payload.shift_end || schedule.shift_end,
      slot_duration_minutes: payload.slot_duration_minutes || schedule.slot_duration_minutes,
      max_patients: payload.max_patients !== undefined ? payload.max_patients : schedule.max_patients,
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

    const nextScheduleBase = {
      work_date: normalized.workDate,
      shift_start: normalized.shiftStart,
      shift_end: normalized.shiftEnd,
      slot_duration_minutes: normalized.slotDuration,
    };
    const shouldUpdateBreakWindows = Array.isArray(payload.break_windows);
    const nextBreakWindows = shouldUpdateBreakWindows
      ? normalizeScheduleBreakWindows(nextScheduleBase, payload)
      : schedule.break_windows || [];

    schedule.doctor_id = payload.doctor_id || schedule.doctor_id;
    schedule.department_id = payload.department_id || schedule.department_id;
    schedule.work_date = normalized.workDate;
    schedule.shift_start = normalized.shiftStart;
    schedule.shift_end = normalized.shiftEnd;
    schedule.slot_duration_minutes = normalized.slotDuration;
    schedule.max_patients = payload.max_patients !== undefined ? payload.max_patients : schedule.max_patients;
    if (shouldUpdateBreakWindows) {
      schedule.break_windows = nextBreakWindows;
    }
    shouldRegenerateSlots = true;
  }

  schedule.schedule_type = (payload.schedule_type || payload.scheduleType)
    ? normalizeScheduleType(payload.schedule_type || payload.scheduleType)
    : normalizeScheduleType(schedule.schedule_type);
  if (payload.patient_portal_enabled !== undefined) schedule.patient_portal_enabled = payload.patient_portal_enabled !== false;
  if (payload.staff_only !== undefined) schedule.staff_only = payload.staff_only === true;
  if (payload.return_visit_priority !== undefined) schedule.return_visit_priority = payload.return_visit_priority === true;
  if (payload.early_booking_enabled !== undefined) schedule.early_booking_enabled = payload.early_booking_enabled !== false;
  if (payload.internal_note !== undefined || payload.note !== undefined) schedule.internal_note = payload.internal_note || payload.note || '';
  schedule.updated_by = actor.userId;
  await schedule.save();

  if (shouldRegenerateSlots) {
    await generateScheduleSlots(schedule._id, actor, requestMeta);
  }

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
  const before = await DoctorSchedule.findById(scheduleId).lean();
  if (!before || before.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(before, actor);
  assertScheduleWritable(before, actor);
  await generateScheduleSlots(scheduleId, actor, requestMeta);
  const schedule = await validateScheduleBeforePublish(scheduleId);
  const document = await DoctorSchedule.findById(schedule._id);
  document.status = SCHEDULE_STATUS.PUBLISHED;
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
    before: { status: before.status },
    after: { status: document.status },
  });

  return getDoctorScheduleDetail(document._id);
}

async function cancelDoctorSchedule(scheduleId, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);
  assertScheduleWritable(schedule, actor);
  const beforeStatus = schedule.status;

  const cancellationCheck = await checkScheduleCanBeCancelled(schedule._id);
  if (!cancellationCheck.can_cancel) {
    throw createError('Lịch đang có appointment nên chưa thể hủy trực tiếp.', 409);
  }

  schedule.status = SCHEDULE_STATUS.CANCELLED;
  schedule.updated_by = actor.userId;
  await schedule.save();
  await ScheduleSlot.updateMany(
    {
      doctor_schedule_id: schedule._id,
      is_deleted: false,
      status: { $in: [SCHEDULE_SLOT_STATUS.AVAILABLE, SCHEDULE_SLOT_STATUS.HELD, SCHEDULE_SLOT_STATUS.BLOCKED] },
    },
    {
      $set: {
        status: SCHEDULE_SLOT_STATUS.CANCELLED,
        booked_count: 0,
        updated_by: actor?.userId,
      },
      $unset: {
        hold_expires_at: '',
        block_reason: '',
        appointment_id: '',
        patient_id: '',
      },
    },
  );

  await recordAuditLog({
    actor,
    action: 'schedule.cancel',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: 'Hủy lịch làm việc bác sĩ thành công.',
    requestMeta,
    before: { status: beforeStatus },
    after: { status: schedule.status },
  });

  return getDoctorScheduleDetail(schedule._id);
}

async function completeDoctorSchedule(scheduleId, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);
  assertScheduleWritable(schedule, actor);
  const beforeStatus = schedule.status;

  if (![SCHEDULE_STATUS.PUBLISHED, SCHEDULE_STATUS.ACTIVE].includes(schedule.status)) {
    throw createError('Chỉ lịch published hoặc active mới được hoàn tất.', 409);
  }
  const activeAppointmentsCount = await Appointment.countDocuments(getActiveAppointmentFilter(schedule._id));
  if (activeAppointmentsCount > 0) {
    throw createError('Lịch còn appointment active nên chưa thể hoàn tất.', 409);
  }

  schedule.status = SCHEDULE_STATUS.COMPLETED;
  schedule.updated_by = actor.userId;
  await schedule.save();
  await ScheduleSlot.updateMany(
    {
      doctor_schedule_id: schedule._id,
      is_deleted: false,
      status: { $in: [SCHEDULE_SLOT_STATUS.AVAILABLE, SCHEDULE_SLOT_STATUS.HELD, SCHEDULE_SLOT_STATUS.BLOCKED] },
    },
    {
      $set: {
        status: SCHEDULE_SLOT_STATUS.COMPLETED,
        updated_by: actor?.userId,
      },
      $unset: {
        hold_expires_at: '',
        block_reason: '',
      },
    },
  );

  await recordAuditLog({
    actor,
    action: 'schedule.complete',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: 'Hoàn tất lịch làm việc bác sĩ thành công.',
    requestMeta,
    before: { status: beforeStatus },
    after: { status: schedule.status },
  });

  return getDoctorScheduleDetail(schedule._id);
}

async function blockScheduleSlot(scheduleId, payload, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);
  assertScheduleWritable(schedule, actor);
  if (FINAL_SCHEDULE_STATUSES.includes(schedule.status)) {
    throw createError('Không thể chặn slot thuộc lịch đã hủy hoặc hoàn tất.', 409);
  }

  const slotTime = new Date(payload.slot_time);
  if (Number.isNaN(slotTime.getTime())) {
    throw createError('slot_time không hợp lệ.');
  }

  const targetSlot = findTheoreticalScheduleSlot(schedule, slotTime);
  if (!targetSlot) {
    throw createError('Slot cần chặn không thuộc lịch làm việc này.', 404);
  }

  const bookedAppointment = await Appointment.findOne({
    ...getActiveAppointmentFilter(schedule._id),
    appointment_time: slotTime,
  }).lean();
  if (bookedAppointment) {
    throw createError('Slot này đã có lịch hẹn nên không thể chặn.', 409);
  }

  const existingSlot = await ScheduleSlot.findOne({
    doctor_schedule_id: schedule._id,
    start_time: slotTime,
    is_deleted: false,
  }).lean();
  const beforeStatus = existingSlot?.status || SCHEDULE_SLOT_STATUS.AVAILABLE;
  const changed = existingSlot?.status !== SCHEDULE_SLOT_STATUS.BLOCKED;
  await upsertScheduleSlotState(schedule, targetSlot, payload, actor, SCHEDULE_SLOT_STATUS.BLOCKED);

  await recordAuditLog({
    actor,
    action: 'schedule.block_slot',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: 'Chặn slot lịch làm việc thành công.',
    requestMeta,
    before: { status: beforeStatus },
    after: { status: SCHEDULE_SLOT_STATUS.BLOCKED },
    metadata: { slot_time: slotTime, changed },
  });

  return getAvailableSlots(schedule._id);
}

async function reopenScheduleSlot(scheduleId, payload, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);
  assertScheduleWritable(schedule, actor);
  if (!ACTIVE_SCHEDULE_STATUSES.includes(schedule.status)) {
    throw createError('Chỉ mở lại slot khi lịch đã published hoặc active.', 409);
  }

  const slotTime = new Date(payload.slot_time);
  if (Number.isNaN(slotTime.getTime())) {
    throw createError('slot_time không hợp lệ.');
  }

  const targetSlot = findTheoreticalScheduleSlot(schedule, slotTime);
  if (!targetSlot) {
    throw createError('Slot cần mở lại không thuộc lịch làm việc này.', 404);
  }

  const bookedAppointment = await Appointment.findOne({
    ...getActiveAppointmentFilter(schedule._id),
    appointment_time: slotTime,
  }).lean();
  if (bookedAppointment) {
    throw createError('Slot đang có appointment active nên không thể mở lại bằng endpoint thường.', 409);
  }
  const existingSlot = await ScheduleSlot.findOne({
    doctor_schedule_id: schedule._id,
    start_time: slotTime,
    is_deleted: false,
  }).lean();
  const beforeStatus = existingSlot?.status || SCHEDULE_SLOT_STATUS.AVAILABLE;
  const changed = existingSlot?.status === SCHEDULE_SLOT_STATUS.BLOCKED;
  await upsertScheduleSlotState(schedule, targetSlot, payload, actor, SCHEDULE_SLOT_STATUS.AVAILABLE);

  await recordAuditLog({
    actor,
    action: 'schedule.reopen_slot',
    targetType: 'doctor_schedule',
    targetId: schedule._id,
    status: 'success',
    message: 'Mở lại slot lịch làm việc thành công.',
    requestMeta,
    before: { status: beforeStatus },
    after: { status: SCHEDULE_SLOT_STATUS.AVAILABLE },
    metadata: { slot_time: slotTime, changed },
  });

  return getAvailableSlots(schedule._id);
}

async function batchBlockScheduleSlots(scheduleId, payload, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);
  assertScheduleWritable(schedule, actor);
  if (FINAL_SCHEDULE_STATUSES.includes(schedule.status)) {
    throw createError('Không thể chặn slot thuộc lịch đã hủy hoặc hoàn tất.', 409);
  }

  const slotTimes = resolveSlotTimesFromPayload(schedule, payload);
  const existingSlotMap = await getScheduleSlotStateMap(schedule._id);
  const activeAppointments = await Appointment.find({
    ...getActiveAppointmentFilter(schedule._id),
    appointment_time: { $in: slotTimes },
  }).lean();
  const bookedSet = new Set(activeAppointments.map((appointment) => new Date(appointment.appointment_time).toISOString()));
  let changedCount = 0;
  const items = [];

  for (const slotTime of slotTimes) {
    const key = slotTime.toISOString();
    if (bookedSet.has(key)) {
      items.push({
        slot_time: slotTime,
        success: false,
        error_code: 'CONFLICT',
        message: 'Slot này đã có lịch hẹn nên không thể chặn.',
      });
      continue;
    }

    const targetSlot = findTheoreticalScheduleSlot(schedule, slotTime);
    if (!targetSlot) continue;

    if (existingSlotMap.get(key)?.status !== SCHEDULE_SLOT_STATUS.BLOCKED) changedCount += 1;
    await upsertScheduleSlotState(schedule, targetSlot, payload, actor, SCHEDULE_SLOT_STATUS.BLOCKED);
    items.push({
      slot_time: slotTime,
      success: true,
      status: SCHEDULE_SLOT_STATUS.BLOCKED,
    });
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
    success_count: items.filter((item) => item.success).length,
    failed_count: items.filter((item) => !item.success).length,
    items,
    slots: await getAvailableSlots(schedule._id),
  };
}

async function batchReopenScheduleSlots(scheduleId, payload, actor, requestMeta = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId);
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);
  assertScheduleWritable(schedule, actor);
  if (!ACTIVE_SCHEDULE_STATUSES.includes(schedule.status)) {
    throw createError('Chỉ mở lại slot khi lịch đã published hoặc active.', 409);
  }

  const slotTimes = resolveSlotTimesFromPayload(schedule, payload);
  const existingSlotMap = await getScheduleSlotStateMap(schedule._id);
  const activeAppointments = await Appointment.find({
    ...getActiveAppointmentFilter(schedule._id),
    appointment_time: { $in: slotTimes },
  }).lean();
  const bookedSet = new Set(activeAppointments.map((appointment) => new Date(appointment.appointment_time).toISOString()));
  let changedCount = 0;
  const items = [];

  for (const slotTime of slotTimes) {
    const key = slotTime.toISOString();
    const targetSlot = findTheoreticalScheduleSlot(schedule, slotTime);
    if (!targetSlot) continue;
    if (bookedSet.has(key)) {
      items.push({
        slot_time: slotTime,
        success: false,
        error_code: 'CONFLICT',
        message: 'Slot đang có appointment active nên không thể mở lại.',
      });
      continue;
    }

    if (existingSlotMap.get(key)?.status === SCHEDULE_SLOT_STATUS.BLOCKED) changedCount += 1;
    await upsertScheduleSlotState(schedule, targetSlot, payload, actor, SCHEDULE_SLOT_STATUS.AVAILABLE);
    items.push({
      slot_time: slotTime,
      success: true,
      status: SCHEDULE_SLOT_STATUS.AVAILABLE,
    });
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
    success_count: items.filter((item) => item.success).length,
    failed_count: items.filter((item) => !item.success).length,
    items,
    slots: await getAvailableSlots(schedule._id),
  };
}

async function listSchedulesByDoctor(doctorId, query = {}, actor = {}) {
  return listDoctorSchedules({ ...query, doctor_id: doctorId }, actor);
}

async function listSchedulesByDepartment(departmentId, query = {}, actor = {}) {
  return listDoctorSchedules({ ...query, department_id: departmentId }, actor);
}

async function listSchedulesByDateRange(dateFrom, dateTo, query = {}, actor = {}) {
  return listDoctorSchedules({ ...query, date_from: dateFrom, date_to: dateTo }, actor);
}

async function getDoctorCalendarView(doctorId, query = {}, actor = {}) {
  return listSchedulesByDoctor(doctorId, query, actor);
}

function buildScheduleCalendarEvent(item = {}) {
  const warnings = [];
  const stats = item.slots_summary || {};
  const totalSlots = Number(stats.total_slots || 0);
  const blockedSlots = Number(stats.blocked_slots || item.blocked_slots_count || 0);

  if (['published', 'active'].includes(item.status) && totalSlots === 0) {
    warnings.push({
      code: 'PUBLISHED_WITHOUT_SLOTS',
      severity: 'warning',
      message: 'Lịch đã mở nhưng chưa có slot.',
    });
  }
  if (blockedSlots > 0) {
    warnings.push({
      code: 'BLOCKED_SLOTS',
      severity: 'info',
      message: `${blockedSlots} slot đang bị khóa.`,
    });
  }

  return {
    id: item.doctor_schedule_id,
    title: [item.doctor_name, item.department_name].filter(Boolean).join(' - ') || 'Lịch làm việc',
    start: item.shift_start,
    end: item.shift_end,
    date: localDateKey(item.work_date),
    resource_id: item.doctor_id,
    doctor_id: item.doctor_id,
    doctor_name: item.doctor_name,
    department_id: item.department_id,
    department_name: item.department_name,
    status: item.status,
    schedule_type: item.schedule_type,
    utilization_rate: item.utilization_rate,
    slots_summary: stats,
    warnings,
  };
}

async function getScheduleOperationalList(query = {}, actor = {}) {
  return listDoctorSchedules(query, actor);
}

async function getScheduleCalendar(query = {}, actor = {}) {
  const result = await listDoctorSchedules(query, actor);
  return {
    ...result,
    events: result.items.map(buildScheduleCalendarEvent),
  };
}

function buildScheduleConflictItems(items = []) {
  const conflicts = [];

  items.forEach((item, index) => {
    const itemStart = new Date(item.shift_start);
    const itemEnd = new Date(item.shift_end);
    const itemStatus = String(item.status || '').toLowerCase();
    const itemStats = item.slots_summary || {};

    if (!FINAL_SCHEDULE_STATUSES.includes(itemStatus) && Number(itemStats.total_slots || 0) === 0 && ['published', 'active'].includes(itemStatus)) {
      conflicts.push({
        id: `${item.doctor_schedule_id}-published-without-slots`,
        type: 'published_without_slots',
        severity: 'warning',
        doctor_id: item.doctor_id,
        doctor_name: item.doctor_name,
        department_id: item.department_id,
        department_name: item.department_name,
        work_date: item.work_date,
        message: 'Lịch đã publish/active nhưng chưa có slot hợp lệ.',
        schedule_ids: [item.doctor_schedule_id],
      });
    }

    if (localDateKey(item.shift_start) !== localDateKey(item.work_date) || localDateKey(item.shift_end) !== localDateKey(item.work_date)) {
      conflicts.push({
        id: `${item.doctor_schedule_id}-date-mismatch`,
        type: 'date_mismatch',
        severity: 'critical',
        doctor_id: item.doctor_id,
        doctor_name: item.doctor_name,
        department_id: item.department_id,
        department_name: item.department_name,
        work_date: item.work_date,
        message: 'shift_start/shift_end không cùng ngày với work_date.',
        schedule_ids: [item.doctor_schedule_id],
      });
    }

    items.slice(index + 1).forEach((other) => {
      const otherStatus = String(other.status || '').toLowerCase();
      if (FINAL_SCHEDULE_STATUSES.includes(itemStatus) || FINAL_SCHEDULE_STATUSES.includes(otherStatus)) return;
      if (String(item.doctor_id) !== String(other.doctor_id)) return;
      if (localDateKey(item.work_date) !== localDateKey(other.work_date)) return;

      const otherStart = new Date(other.shift_start);
      const otherEnd = new Date(other.shift_end);
      if (itemStart < otherEnd && otherStart < itemEnd) {
        conflicts.push({
          id: `${item.doctor_schedule_id}-${other.doctor_schedule_id}-overlap`,
          type: 'schedule_overlap',
          severity: 'critical',
          doctor_id: item.doctor_id,
          doctor_name: item.doctor_name,
          department_id: item.department_id,
          department_name: item.department_name,
          work_date: item.work_date,
          message: 'Bác sĩ có hai lịch bị chồng thời gian.',
          schedule_ids: [item.doctor_schedule_id, other.doctor_schedule_id],
        });
      }
    });
  });

  return conflicts;
}

async function getScheduleConflicts(query = {}, actor = {}) {
  const result = await listDoctorSchedules(query, actor);
  const items = buildScheduleConflictItems(result.items);
  return {
    items,
    total: items.length,
    source_count: result.items.length,
  };
}

async function scanScheduleConflicts(payload = {}, actor = {}) {
  return getScheduleConflicts(payload.query || payload, actor);
}

async function getScheduleUtilization(scheduleId, actor = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);

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

async function getDoctorScheduleSummary(scheduleId, actor = {}) {
  const [detail, utilization, futureAppointments] = await Promise.all([
    getDoctorScheduleDetail(scheduleId, actor),
    getScheduleUtilization(scheduleId, actor),
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
    const range = validateDateRangeInput(query.date_from || now, query.date_to || query.date_from || now);
    return {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
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

function formatDepartmentOption(department) {
  return {
    id: String(department._id),
    department_id: String(department._id),
    code: department.department_code,
    name: department.department_name,
    department_name: department.department_name,
    type: department.department_type || '',
    location_note: department.location_note || '',
    status: department.status,
  };
}

async function getSchedulingCreateOptions(query = {}) {
  const [departments, doctorRole] = await Promise.all([
    Department.find({ is_deleted: false, status: 'active' }).sort({ department_name: 1 }).lean(),
    Role.findOne({ role_code: 'doctor', is_deleted: false }).lean(),
  ]);
  const departmentMap = new Map(departments.map((department) => [String(department._id), department]));

  if (!doctorRole) {
    return {
      departments: departments.map(formatDepartmentOption),
      doctors: [],
      schedule_types: getScheduleTypeCatalog(),
    };
  }

  const assignments = await UserRole.find({ role_id: doctorRole._id, is_active: true }).lean();
  const userIds = assignments.map((item) => item.user_id).filter(Boolean);
  const filter = {
    _id: { $in: userIds },
    is_deleted: false,
    status: 'active',
  };

  if (query.search) {
    const keyword = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { full_name: { $regex: keyword, $options: 'i' } },
      { username: { $regex: keyword, $options: 'i' } },
      { employee_code: { $regex: keyword, $options: 'i' } },
    ];
  }

  const users = await User.find(filter)
    .select('full_name username employee_code email phone department_id status')
    .sort({ full_name: 1 })
    .lean();
  const doctorIds = users.map((user) => user._id);
  const profiles = doctorIds.length
    ? await DoctorProfile.find({
        user_id: { $in: doctorIds },
        is_deleted: false,
        status: DOCTOR_PROFILE_STATUS.ACTIVE,
        ...(query.department_id ? { department_id: query.department_id } : {}),
      }).select('user_id department_id specialty consultation_duration_minutes status').lean()
    : [];
  const profileMap = new Map(profiles.map((profile) => [String(profile.user_id), profile]));
  const loadRows = doctorIds.length
    ? await DoctorSchedule.aggregate([
        {
          $match: {
            doctor_id: { $in: doctorIds },
            is_deleted: false,
            status: { $nin: ['cancelled', 'completed'] },
            work_date: { $gte: getStartOfDay(new Date()) },
          },
        },
        { $group: { _id: '$doctor_id', active_schedules_count: { $sum: 1 } } },
      ])
    : [];
  const loadMap = new Map(loadRows.map((row) => [String(row._id), row.active_schedules_count]));

  return {
    departments: departments.map(formatDepartmentOption),
    schedule_types: getScheduleTypeCatalog(),
    doctors: users
      .filter((user) => profileMap.has(String(user._id)))
      .map((user) => {
        const profile = profileMap.get(String(user._id));
        const department = profile?.department_id ? departmentMap.get(String(profile.department_id)) : null;
        return {
          id: String(user._id),
          user_id: String(user._id),
          name: user.full_name,
          full_name: user.full_name,
          username: user.username,
          employee_code: user.employee_code,
          email: user.email,
          phone: user.phone,
          department_id: profile?.department_id ? String(profile.department_id) : null,
          department_name: department?.department_name || null,
          department_code: department?.department_code || null,
          specialty: profile?.specialty || null,
          consultation_duration_minutes: profile?.consultation_duration_minutes || null,
          active_schedules_count: loadMap.get(String(user._id)) || 0,
          status: user.status,
        };
      }),
  };
}

function formatConflictSchedule(schedule) {
  return {
    schedule_id: String(schedule._id),
    work_date: schedule.work_date,
    shift_start: schedule.shift_start,
    shift_end: schedule.shift_end,
    status: schedule.status,
    slot_duration_minutes: schedule.slot_duration_minutes,
  };
}

async function previewCreateDoctorSchedule(payload = {}) {
  const normalized = validateScheduleTimeRange(payload);
  const { doctor, department } = await validateDoctorBelongsToDepartment(payload.doctor_id, payload.department_id);
  const scheduleBase = {
    work_date: normalized.workDate,
    shift_start: normalized.shiftStart,
    shift_end: normalized.shiftEnd,
    slot_duration_minutes: normalized.slotDuration,
  };
  const breakWindows = normalizeScheduleBreakWindows(scheduleBase, payload);
  const scheduleBaseWithBreaks = { ...scheduleBase, break_windows: breakWindows };
  const blockedBreakSlots = buildBlockedSlotsFromBreakWindows(scheduleBaseWithBreaks, breakWindows);
  const conflicts = await findScheduleConflicts({
    doctor_id: payload.doctor_id,
    work_date: normalized.workDate,
    shift_start: normalized.shiftStart,
    shift_end: normalized.shiftEnd,
  });
  const rawSlots = calculateScheduleSlots(scheduleBase).length;
  const totalSlots = calculateBookableScheduleSlots(scheduleBaseWithBreaks).length;
  const maxPatients = Number(payload.max_patients || 1);
  const warnings = [];

  if (conflicts.length > 0) {
    warnings.push({
      type: 'conflict',
      tone: 'danger',
      message: 'Bác sĩ đang có lịch trùng trong khung giờ đã chọn.',
    });
  }
  if (breakWindows.length > 0 && blockedBreakSlots.length === 0) {
    warnings.push({
      type: 'break_window',
      tone: 'warning',
      message: 'Khoảng nghỉ không khớp slot nào; kiểm tra lại thời lượng slot hoặc giờ nghỉ.',
    });
  }
  if (totalSlots === 0) {
    warnings.push({
      type: 'empty_slots',
      tone: 'danger',
      message: 'Khung giờ hiện tại không tạo được slot hợp lệ.',
    });
  }

  return {
    can_create: conflicts.length === 0 && totalSlots > 0,
    doctor: {
      user_id: String(doctor._id),
      full_name: doctor.full_name,
      employee_code: doctor.employee_code,
      department_id: doctor.department_id ? String(doctor.department_id) : null,
    },
    department: formatDepartmentOption(department),
    work_date: normalized.workDate,
    shift_start: normalized.shiftStart,
    shift_end: normalized.shiftEnd,
    slot_duration_minutes: normalized.slotDuration,
    schedule_type: normalizeScheduleType(payload.schedule_type || payload.scheduleType || DEFAULT_SCHEDULE_TYPE),
    break_windows: breakWindows,
    slots_summary: {
      total_slots: totalSlots,
      raw_slots: rawSlots,
      blocked_slots: blockedBreakSlots.length,
      available_slots: totalSlots,
      max_patients_per_slot: maxPatients,
      total_capacity: totalSlots * maxPatients,
    },
    conflicts: conflicts.map(formatConflictSchedule),
    warnings,
  };
}

async function getSchedulingSystemSummary(query = {}, actor = {}) {
  const { dateFrom, dateTo } = resolveSummaryDateRange(query);
  const filter = {
    is_deleted: false,
    work_date: { $gte: dateFrom, $lte: dateTo },
  };

  if (query.department_id) filter.department_id = query.department_id;
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  applyScheduleReadScope(filter, actor);

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

async function getScheduleSummaryByDepartment(query = {}, actor = {}) {
  const summary = await getSchedulingSystemSummary(query, actor);
  return {
    range: summary.range,
    items: summary.by_department,
  };
}

async function getScheduleSummaryByDateRange(query = {}, actor = {}) {
  const summary = await getSchedulingSystemSummary(query, actor);
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
  }, actor);
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
  }, actor);
}

async function previewRescheduleImpact(scheduleId, payload = {}, actor = {}) {
  const schedule = await DoctorSchedule.findById(scheduleId).lean();
  if (!schedule || schedule.is_deleted) {
    throw createError('Không tìm thấy lịch làm việc.', 404);
  }
  assertScheduleReadable(schedule, actor);

  const mergedPayload = {
    work_date: payload.work_date || schedule.work_date,
    shift_start: payload.shift_start || schedule.shift_start,
    shift_end: payload.shift_end || schedule.shift_end,
    slot_duration_minutes: payload.slot_duration_minutes || schedule.slot_duration_minutes,
  };
  if (!payload.work_date && localDateKey(mergedPayload.work_date) !== localDateKey(mergedPayload.shift_start)) {
    mergedPayload.work_date = mergedPayload.shift_start;
  }
  const normalized = validateScheduleTimeRange(mergedPayload);
  const proposedSchedule = {
    ...schedule,
    work_date: normalized.workDate,
    shift_start: normalized.shiftStart,
    shift_end: normalized.shiftEnd,
    slot_duration_minutes: normalized.slotDuration,
  };
  const proposedSlots = calculateBookableScheduleSlots(proposedSchedule);
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

  const blockedSlotDocs = await ScheduleSlot.find({
    doctor_schedule_id: schedule._id,
    status: 'blocked',
    is_deleted: false,
  }).lean();
  const affectedBlockedSlots = blockedSlotDocs
    .filter((slot) => !proposedSlotSet.has(new Date(slot.start_time).toISOString()))
    .map((slot) => ({
      schedule_slot_id: String(slot._id),
      slot_time: slot.start_time,
      reason: slot.block_reason,
    }));

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
  assertScheduleReadable(schedule, actor);
  assertScheduleWritable(schedule, actor);

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

  return createDoctorScheduleInternal(
    {
      doctor_id: payload.doctor_id || schedule.doctor_id,
      department_id: payload.department_id || schedule.department_id,
      work_date: baseDate,
      shift_start: shiftStart,
      shift_end: shiftEnd,
      slot_duration_minutes: payload.slot_duration_minutes || schedule.slot_duration_minutes,
      max_patients: payload.max_patients !== undefined ? payload.max_patients : schedule.max_patients,
      schedule_type: (payload.schedule_type || payload.scheduleType)
        ? normalizeScheduleType(payload.schedule_type || payload.scheduleType)
        : normalizeScheduleType(schedule.schedule_type),
      patient_portal_enabled:
        payload.patient_portal_enabled !== undefined ? payload.patient_portal_enabled : schedule.patient_portal_enabled,
      staff_only: payload.staff_only !== undefined ? payload.staff_only : schedule.staff_only,
      return_visit_priority:
        payload.return_visit_priority !== undefined ? payload.return_visit_priority : schedule.return_visit_priority,
      early_booking_enabled:
        payload.early_booking_enabled !== undefined ? payload.early_booking_enabled : schedule.early_booking_enabled,
      internal_note: payload.internal_note !== undefined ? payload.internal_note : schedule.internal_note,
      break_windows: Array.isArray(payload.break_windows)
        ? payload.break_windows
        : (schedule.break_windows || []).map((window) => ({
            start: formatTimeForSchedulePayload(window.start_time),
            end: formatTimeForSchedulePayload(window.end_time),
            mode: window.mode,
          })),
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

  const preparedItems = [];
  const preflightFailures = new Map();
  for (let index = 0; index < items.length; index += 1) {
    try {
      const [preparedItem] = await prepareBulkCreateItems([items[index]]);
      preparedItems.push({ ...preparedItem, index });
    } catch (error) {
      preflightFailures.set(index, {
        schedule_id: null,
        success: false,
        error_code: errorCodeFromError(error),
        message: error.message || 'Dữ liệu tạo lịch không hợp lệ.',
        doctor_id: items[index].doctor_id ? String(items[index].doctor_id) : null,
        department_id: items[index].department_id ? String(items[index].department_id) : null,
        work_date: items[index].work_date || null,
        shift_start: items[index].shift_start || null,
        shift_end: items[index].shift_end || null,
      });
    }
  }
  const conflictResolution = payload.conflict_resolution || {};
  const replaceScheduleIds = normalizeScheduleIdList([
    ...normalizeScheduleIdList(conflictResolution.replace_schedule_ids),
    ...items.flatMap((item) => normalizeScheduleIdList(item.replace_conflict_schedule_ids)),
  ]);
  const replacementSchedules = [];
  const cancelledConflictSchedules = [];
  const updatedConflictSchedules = [];

  for (const scheduleId of replaceScheduleIds) {
    const schedule = await DoctorSchedule.findById(scheduleId);
    if (!schedule || schedule.is_deleted) {
      throw createError(`Không tìm thấy lịch cần thay thế: ${scheduleId}.`, 404);
    }
    assertScheduleWritable(schedule, actor);

    const matchesBulkItem = preparedItems.some((preparedItem) => scheduleOverlapsPreparedItem(schedule, preparedItem));
    if (!matchesBulkItem) {
      throw createError(`Lịch ${scheduleId} không trùng với payload tạo lịch nên không thể thay thế tự động.`, 409);
    }

    const cancellationCheck = await checkScheduleCanBeCancelled(schedule._id);
    if (!cancellationCheck.can_cancel) {
      throw createError(
        `Lịch ${scheduleId} đang có ${cancellationCheck.appointments_count} appointment nên chưa thể thay thế tự động.`,
        409,
      );
    }

    replacementSchedules.push(schedule);
  }

  for (const schedule of replacementSchedules) {
    const scheduleId = String(schedule._id);
    const shouldUpdateExisting = preparedItems.some((preparedItem) => scheduleExactlyMatchesPreparedItem(schedule, preparedItem));
    if (shouldUpdateExisting) {
      updatedConflictSchedules.push({
        schedule_id: scheduleId,
        previous_status: schedule.status,
      });
      continue;
    }

    const previousStatus = schedule.status;
    if (schedule.status !== 'cancelled') {
      schedule.status = 'cancelled';
      schedule.internal_note = [schedule.internal_note, 'Đã hủy do xử lý xung đột từ tạo lịch hàng loạt.']
        .filter(Boolean)
        .join(' | ')
        .slice(0, 500);
      schedule.updated_by = actor.userId;
      await schedule.save();
    }

    cancelledConflictSchedules.push(scheduleId);

    await recordAuditLog({
      actor,
      action: 'schedule.bulk_conflict_replace',
      targetType: 'doctor_schedule',
      targetId: schedule._id,
      status: 'success',
      message: 'Hủy lịch hiện tại do được chọn thay thế khi tạo lịch hàng loạt.',
      requestMeta,
      metadata: {
        replacement_source: 'bulk_create_conflict_resolution',
        schedule_id: String(schedule._id),
        previous_status: previousStatus,
      },
    });
  }

  const results = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (preflightFailures.has(index)) {
      results.push(preflightFailures.get(index));
      continue;
    }
    try {
      const result = await createDoctorScheduleInternal(item, actor, requestMeta);
      results.push({
        schedule_id: result?.schedule?.doctor_schedule_id || result?.schedule?.schedule_id || null,
        success: true,
        status: result?.schedule?.status || null,
        data: result,
      });
    } catch (error) {
      results.push({
        schedule_id: null,
        success: false,
        error_code: errorCodeFromError(error),
        message: error.message || 'Tạo lịch thất bại.',
        doctor_id: item.doctor_id ? String(item.doctor_id) : null,
        department_id: item.department_id ? String(item.department_id) : null,
        work_date: item.work_date || null,
        shift_start: item.shift_start || null,
        shift_end: item.shift_end || null,
      });
    }
  }
  const successCount = results.filter((item) => item.success).length;

  for (const schedule of updatedConflictSchedules) {
    await recordAuditLog({
      actor,
      action: 'schedule.bulk_conflict_update_existing',
      targetType: 'doctor_schedule',
      targetId: schedule.schedule_id,
      status: 'success',
      message: 'Cập nhật lịch hiện tại do được chọn thay thế khi tạo lịch hàng loạt.',
      requestMeta,
      metadata: {
        replacement_source: 'bulk_create_conflict_resolution',
        schedule_id: schedule.schedule_id,
        previous_status: schedule.previous_status,
        updated_status: 'draft',
      },
    });
  }

  return {
    success_count: successCount,
    failed_count: results.length - successCount,
    created_count: successCount,
    cancelled_conflict_count: cancelledConflictSchedules.length,
    cancelled_conflict_schedule_ids: cancelledConflictSchedules,
    updated_conflict_count: updatedConflictSchedules.length,
    updated_conflict_schedule_ids: updatedConflictSchedules.map((schedule) => schedule.schedule_id),
    items: results,
  };
}

async function bulkPublishDoctorSchedules(scheduleIds = [], actor, requestMeta = {}) {
  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    throw createError('schedule_ids là mảng không rỗng.', 400);
  }

  const items = [];
  for (const scheduleId of [...new Set(scheduleIds)]) {
    try {
      const result = await publishDoctorSchedule(scheduleId, actor, requestMeta);
      items.push({
        schedule_id: String(scheduleId),
        success: true,
        status: result?.schedule?.status || SCHEDULE_STATUS.PUBLISHED,
      });
    } catch (error) {
      items.push({
        schedule_id: String(scheduleId),
        success: false,
        error_code: errorCodeFromError(error),
        message: error.message || 'Publish lịch thất bại.',
      });
    }
  }
  const successCount = items.filter((item) => item.success).length;

  await recordAuditLog({
    actor,
    action: 'schedule.bulk_publish',
    targetType: 'doctor_schedule',
    status: 'success',
    message: 'Publish hàng loạt lịch làm việc hoàn tất.',
    requestMeta,
    metadata: {
      success_count: successCount,
      failed_count: items.length - successCount,
      schedule_ids: items.map((item) => item.schedule_id),
    },
  });

  return {
    success_count: successCount,
    failed_count: items.length - successCount,
    items,
  };
}

module.exports = {
  // createDoctorSchedule: Tạo lịch làm việc của bác sĩ.
  createDoctorSchedule,
  // getSchedulingCreateOptions: Lấy tùy chọn tạo lịch làm việc.
  getSchedulingCreateOptions,
  // previewCreateDoctorSchedule: Xem trước việc tạo lịch làm việc của bác sĩ.
  previewCreateDoctorSchedule,
  // listDoctorSchedules: Liệt kê lịch làm việc của bác sĩ.
  listDoctorSchedules,
  // getScheduleOperationalList: Liệt kê lịch làm việc cho màn hình vận hành.
  getScheduleOperationalList,
  // getScheduleCalendar: Lấy dữ liệu calendar lịch làm việc.
  getScheduleCalendar,
  // getScheduleConflicts: Lấy xung đột lịch làm việc.
  getScheduleConflicts,
  // scanScheduleConflicts: Quét xung đột lịch làm việc theo bộ lọc.
  scanScheduleConflicts,
  // getDoctorScheduleDetail: Lấy chi tiết lịch làm việc của bác sĩ.
  getDoctorScheduleDetail,
  // updateDoctorSchedule: Cập nhật lịch làm việc của bác sĩ.
  updateDoctorSchedule,
  // publishDoctorSchedule: Công bố lịch làm việc của bác sĩ.
  publishDoctorSchedule,
  // cancelDoctorSchedule: Hủy lịch làm việc của bác sĩ.
  cancelDoctorSchedule,
  // completeDoctorSchedule: Hoàn tất lịch làm việc của bác sĩ.
  completeDoctorSchedule,
  // getAvailableSlots: Lấy khung giờ trống.
  getAvailableSlots,
  // generateScheduleSlots: Sinh/tạo khung giờ lịch làm việc.
  generateScheduleSlots,
  // previewGenerateScheduleSlots: Xem trước đồng bộ khung giờ lịch làm việc.
  previewGenerateScheduleSlots,
  // markSlotBookedForAppointment: Đánh dấu khung giờ đã được đặt bởi lịch hẹn.
  markSlotBookedForAppointment,
  // releaseSlotForAppointment: Giải phóng khung giờ khi lịch hẹn được hủy hoặc đổi.
  releaseSlotForAppointment,
  // markSlotOutcomeForAppointment: Cập nhật kết quả sử dụng khung giờ theo lịch hẹn.
  markSlotOutcomeForAppointment,
  // blockScheduleSlot: Khóa khung giờ lịch làm việc để không cho đặt lịch.
  blockScheduleSlot,
  // reopenScheduleSlot: Mở lại khung giờ lịch làm việc đã bị khóa.
  reopenScheduleSlot,
  // getBookedSlots: Lấy khung giờ đã đặt.
  getBookedSlots,
  // countScheduleAppointments: Đếm lịch hẹn thuộc lịch làm việc.
  countScheduleAppointments,
  // calculateScheduleSlots: Tính toán khung giờ lịch làm việc.
  calculateScheduleSlots,
  // calculateBookableScheduleSlots: Tính toán khung giờ lịch làm việc có thể đặt.
  calculateBookableScheduleSlots,
  // validateScheduleConflict: Kiểm tra tính hợp lệ của xung đột lịch làm việc.
  validateScheduleConflict,
  // validateDoctorBelongsToDepartment: Kiểm tra tính hợp lệ của bác sĩ thuộc khoa/phòng ban.
  validateDoctorBelongsToDepartment,
  // validateScheduleTimeRange: Kiểm tra tính hợp lệ của khoảng thời gian lịch làm việc.
  validateScheduleTimeRange,
  // validateScheduleBeforePublish: Kiểm tra tính hợp lệ của lịch làm việc trước khi công bố.
  validateScheduleBeforePublish,
  // checkScheduleCanBeUpdated: Kiểm tra điều kiện cập nhật lịch làm việc.
  checkScheduleCanBeUpdated,
  // checkScheduleCanBeCancelled: Kiểm tra điều kiện hủy lịch làm việc.
  checkScheduleCanBeCancelled,
  // getScheduleActivityLog: Lấy nhật ký hoạt động lịch làm việc.
  getScheduleActivityLog,
  // listSchedulesByDoctor: Liệt kê lịch làm việc theo bác sĩ.
  listSchedulesByDoctor,
  // listSchedulesByDepartment: Liệt kê lịch làm việc theo khoa/phòng ban.
  listSchedulesByDepartment,
  // listSchedulesByDateRange: Liệt kê lịch làm việc theo khoảng ngày.
  listSchedulesByDateRange,
  // getDoctorCalendarView: Lấy lịch hiển thị của bác sĩ.
  getDoctorCalendarView,
  // getScheduleUtilization: Lấy mức sử dụng của lịch làm việc.
  getScheduleUtilization,
  // duplicateDoctorSchedule: Sao chép lịch làm việc của bác sĩ.
  duplicateDoctorSchedule,
  // bulkCreateDoctorSchedules: Tạo nhiều lịch làm việc của bác sĩ trong một thao tác.
  bulkCreateDoctorSchedules,
  // bulkPublishDoctorSchedules: Công bố nhiều lịch làm việc của bác sĩ trong một thao tác.
  bulkPublishDoctorSchedules,
  // batchBlockScheduleSlots: Khóa nhiều khung giờ lịch làm việc trong một thao tác.
  batchBlockScheduleSlots,
  // batchReopenScheduleSlots: Mở lại nhiều khung giờ lịch làm việc trong một thao tác.
  batchReopenScheduleSlots,
  // getDoctorScheduleSummary: Lấy tổng hợp lịch làm việc của bác sĩ.
  getDoctorScheduleSummary,
  // getSchedulingSystemSummary: Lấy tổng hợp toàn hệ thống lập lịch.
  getSchedulingSystemSummary,
  // getScheduleSummaryByDepartment: Lấy tổng hợp lịch làm việc theo khoa/phòng ban.
  getScheduleSummaryByDepartment,
  // getScheduleSummaryByDateRange: Lấy tổng hợp lịch làm việc theo khoảng ngày.
  getScheduleSummaryByDateRange,
  // getMyTodaySchedule: Lấy lịch làm việc hôm nay của người dùng hiện tại.
  getMyTodaySchedule,
  // getMyWeekSchedule: Lấy lịch làm việc trong tuần của người dùng hiện tại.
  getMyWeekSchedule,
  // previewRescheduleImpact: Xem trước tác động khi đổi lịch.
  previewRescheduleImpact,
  // checkDoctorHasFutureAppointmentsInSchedule: Kiểm tra bác sĩ còn lịch hẹn tương lai trong lịch làm việc.
  checkDoctorHasFutureAppointmentsInSchedule,
  // assertScheduleReadable: Enforce read scope for schedule/slot probing.
  assertScheduleReadable,
  // assertScheduleWritable: Enforce write scope for schedule mutations.
  assertScheduleWritable,
};
