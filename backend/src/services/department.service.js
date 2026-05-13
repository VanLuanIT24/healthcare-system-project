const {
  Appointment,
  Department,
  DoctorProfile,
  DoctorSchedule,
  Encounter,
  Role,
  User,
  UserRole,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const permissionService = require('./permission.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getEndOfDay,
  getPagination,
  getStartOfDay,
  normalizeHumanName,
  normalizeString,
  recordAuditLog,
} = require('./core.service');

const BLOCKING_SCHEDULE_STATUSES = ['draft', 'published', 'active'];

function getActorDepartmentId(actor = {}) {
  return actor.department_id || actor.departmentId || actor.user?.department_id || null;
}

function hasGlobalDepartmentRead(actor = {}) {
  return permissionService.hasPermission(actor.permissions || [], PERMISSION.DEPARTMENTS.READ);
}

function hasScopedDepartmentRead(actor = {}) {
  return permissionService.hasAnyPermission(actor.permissions || [], [
    PERMISSION.DEPARTMENTS.READ_OWN,
    PERMISSION.DEPARTMENTS.STAFF_READ,
    PERMISSION.USERS.READ_DEPARTMENT,
    PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ,
  ]);
}

function assertCanAccessDepartment(departmentId, actor = {}) {
  if (!actor || Object.keys(actor).length === 0 || hasGlobalDepartmentRead(actor)) return true;

  if (hasScopedDepartmentRead(actor) && String(getActorDepartmentId(actor)) === String(departmentId)) {
    return true;
  }

  throw createError('Bạn không được truy cập department ngoài phạm vi của mình.', 403);
}

function rejectUnknownFields(payload = {}, allowedFields = []) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(payload || {}).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw createError(`Trường không được phép: ${unknown.join(', ')}.`, 422);
  }
}

async function validateDepartmentCodeUnique(departmentCode, excludeId = null) {
  const filter = {
    department_code: normalizeString(departmentCode)?.toUpperCase(),
    is_deleted: false,
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const existing = await Department.findOne(filter).lean();
  if (existing) {
    throw createError('Mã khoa/phòng ban đã tồn tại.', 409);
  }

  return true;
}

async function validateDepartmentHeadEligible(userId, departmentId = null) {
  const user = await User.findById(userId).lean();
  if (!user || user.is_deleted) {
    throw createError('Không tìm thấy tài khoản nhân sự.', 404);
  }

  if (user.status !== 'active') {
    throw createError('Chỉ được gán trưởng khoa cho tài khoản staff đang active.', 409);
  }

  if (departmentId) {
    if (!user.department_id) {
      throw createError('Staff được chọn chưa thuộc department nào.', 409);
    }
    if (String(user.department_id) !== String(departmentId)) {
      throw createError('Staff được chọn không thuộc department này.', 409);
    }
  }

  const departmentHeadRole = await Role.findOne({ role_code: 'department_head', status: 'active', is_deleted: false }).lean();
  if (departmentHeadRole) {
    const hasHeadRole = await UserRole.exists({
      user_id: user._id,
      role_id: departmentHeadRole._id,
      is_active: true,
    });
    if (!hasHeadRole) {
      throw createError('Staff được chọn chưa có role department_head.', 409);
    }
  }

  return user;
}

async function createDepartment(payload, actor, requestMeta = {}) {
  rejectUnknownFields(payload, [
    'department_code',
    'department_name',
    'department_type',
    'location_note',
    'status',
  ]);

  if (payload.head_user_id !== undefined) {
    throw createError('Không được gán head khi tạo department. Hãy dùng endpoint assign head sau khi staff thuộc department.', 403);
  }

  const department_code = normalizeString(payload.department_code)?.toUpperCase();
  const department_name = normalizeHumanName(payload.department_name);

  if (!department_code) {
    throw createError('department_code là bắt buộc.');
  }
  if (!department_name) {
    throw createError('department_name là bắt buộc.');
  }

  await validateDepartmentCodeUnique(department_code);

  const department = await Department.create({
    department_code,
    department_name,
    department_type: normalizeString(payload.department_type) || undefined,
    location_note: normalizeString(payload.location_note) || undefined,
    status: payload.status || 'active',
    created_by: actor.userId,
  });

  await recordAuditLog({
    actor,
    action: 'departments.create',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Tạo department thành công.',
    requestMeta,
  });

  return getDepartmentDetail(department._id, actor);
}

async function listDepartments(query = {}, actor = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };
  const keyword = normalizeString(query.search);

  if (!hasGlobalDepartmentRead(actor) && hasScopedDepartmentRead(actor)) {
    const actorDepartmentId = getActorDepartmentId(actor);
    if (!actorDepartmentId) {
      throw createError('Tài khoản hiện tại chưa có department scope.', 403);
    }
    filter._id = actorDepartmentId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.department_type) {
    filter.department_type = query.department_type;
  }

  if (keyword) {
    const pattern = escapeRegex(keyword);
    filter.$or = [
      { department_code: { $regex: pattern, $options: 'i' } },
      { department_name: { $regex: pattern, $options: 'i' } },
      { department_type: { $regex: pattern, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Department.find(filter).sort({ department_name: 1 }).skip(skip).limit(limit).lean(),
    Department.countDocuments(filter),
  ]);

  return {
    items: items.map((department) => ({
      department_id: String(department._id),
      department_code: department.department_code,
      department_name: department.department_name,
      department_type: department.department_type,
      head_user_id: department.head_user_id ? String(department.head_user_id) : null,
      location_note: department.location_note,
      status: department.status,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function searchDepartments(query = {}) {
  return listDepartments(query);
}

async function listActiveDepartments() {
  const items = await Department.find({ is_deleted: false, status: 'active' }).sort({ department_name: 1 }).lean();
  return {
    items: items.map((department) => ({
      department_id: String(department._id),
      department_code: department.department_code,
      department_name: department.department_name,
      department_type: department.department_type,
    })),
  };
}

async function getDepartmentDetail(departmentId, actor = {}) {
  const department = await Department.findById(departmentId).lean();
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }
  assertCanAccessDepartment(department._id, actor);

  const [head, staffCount] = await Promise.all([
    department.head_user_id ? User.findById(department.head_user_id).lean() : null,
    User.countDocuments({ department_id: department._id, is_deleted: false }),
  ]);

  return {
    department: {
      department_id: String(department._id),
      department_code: department.department_code,
      department_name: department.department_name,
      department_type: department.department_type,
      location_note: department.location_note,
      status: department.status,
      head_user_id: department.head_user_id ? String(department.head_user_id) : null,
      created_at: department.created_at,
      updated_at: department.updated_at,
    },
    head: head
      ? {
          user_id: String(head._id),
          username: head.username,
          full_name: head.full_name,
          email: head.email,
          phone: head.phone,
          status: head.status,
        }
      : null,
    staff_count: staffCount,
  };
}

async function updateDepartment(departmentId, payload, actor, requestMeta = {}) {
  rejectUnknownFields(payload, [
    'department_code',
    'department_name',
    'department_type',
    'location_note',
  ]);

  const department = await Department.findById(departmentId);
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }

  const before = department.toObject();

  if (payload.department_code && payload.department_code !== department.department_code) {
    await validateDepartmentCodeUnique(payload.department_code, department._id);
    department.department_code = normalizeString(payload.department_code)?.toUpperCase();
  }

  if (payload.department_name) {
    department.department_name = normalizeHumanName(payload.department_name);
  }

  if (payload.department_type !== undefined) {
    department.department_type = normalizeString(payload.department_type) || undefined;
  }

  if (payload.location_note !== undefined) {
    department.location_note = normalizeString(payload.location_note) || undefined;
  }

  department.updated_by = actor.userId;
  await department.save();

  await recordAuditLog({
    actor,
    action: 'departments.update',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Cập nhật department thành công.',
    requestMeta,
    before,
    after: department.toObject(),
  });

  return getDepartmentDetail(department._id, actor);
}

async function checkDepartmentHasActiveStaff(departmentId) {
  const count = await User.countDocuments({
    department_id: departmentId,
    is_deleted: false,
    status: 'active',
  });

  return {
    department_id: String(departmentId),
    has_active_staff: count > 0,
    active_staff_count: count,
  };
}

async function checkDepartmentCanBeDeactivated(departmentId) {
  const now = new Date();
  const [activeStaff, activeSchedules, futureAppointments, openEncounters, activeDoctors] = await Promise.all([
    User.countDocuments({
      department_id: departmentId,
      is_deleted: false,
      status: 'active',
    }),
    DoctorSchedule.countDocuments({
      department_id: departmentId,
      is_deleted: false,
      work_date: { $gte: getStartOfDay(now) },
      status: { $in: BLOCKING_SCHEDULE_STATUSES },
    }),
    Appointment.countDocuments({
      department_id: departmentId,
      is_deleted: false,
      appointment_time: { $gte: now },
      status: { $in: ['booked', 'confirmed', 'checked_in', 'in_consultation'] },
    }),
    Encounter.countDocuments({
      department_id: departmentId,
      status: { $in: ['planned', 'arrived', 'in_progress', 'on_hold'] },
    }),
    DoctorProfile.countDocuments({
      department_id: departmentId,
      is_deleted: false,
      status: 'active',
    }),
  ]);

  return {
    department_id: String(departmentId),
    can_deactivate:
      activeStaff === 0 &&
      activeSchedules === 0 &&
      futureAppointments === 0 &&
      openEncounters === 0 &&
      activeDoctors === 0,
    active_staff_count: activeStaff,
    active_schedule_count: activeSchedules,
    future_appointment_count: futureAppointments,
    open_encounter_count: openEncounters,
    active_doctor_profile_count: activeDoctors,
  };
}

async function checkDepartmentHasFutureSchedules(departmentId) {
  const count = await DoctorSchedule.countDocuments({
    department_id: departmentId,
    is_deleted: false,
    work_date: { $gte: getStartOfDay(new Date()) },
    status: { $in: BLOCKING_SCHEDULE_STATUSES },
  });

  return {
    department_id: String(departmentId),
    has_future_schedules: count > 0,
    future_schedules_count: count,
  };
}

async function checkDepartmentHasFutureAppointments(departmentId) {
  const count = await Appointment.countDocuments({
    department_id: departmentId,
    is_deleted: false,
    appointment_time: { $gte: new Date() },
    status: { $in: ['booked', 'confirmed', 'checked_in', 'in_consultation'] },
  });

  return {
    department_id: String(departmentId),
    has_future_appointments: count > 0,
    future_appointments_count: count,
  };
}

async function checkDepartmentInUse(departmentId) {
  const [usersCount, schedulesCount, appointmentsCount, encountersCount] = await Promise.all([
    User.countDocuments({ department_id: departmentId, is_deleted: false }),
    DoctorSchedule.countDocuments({ department_id: departmentId, is_deleted: false }),
    Appointment.countDocuments({ department_id: departmentId, is_deleted: false }),
    Encounter.countDocuments({ department_id: departmentId }),
  ]);

  return {
    department_id: String(departmentId),
    in_use: usersCount > 0 || schedulesCount > 0 || appointmentsCount > 0 || encountersCount > 0,
    dependencies: {
      users_count: usersCount,
      schedules_count: schedulesCount,
      appointments_count: appointmentsCount,
      encounters_count: encountersCount,
    },
  };
}

async function updateDepartmentStatus(departmentId, status, actor, requestMeta = {}) {
  if (!['active', 'inactive'].includes(status)) {
    throw createError('Trạng thái department không hợp lệ.');
  }

  const department = await Department.findById(departmentId);
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }

  if (status === 'inactive') {
    const deactivationCheck = await checkDepartmentCanBeDeactivated(department._id);
    if (!deactivationCheck.can_deactivate) {
      throw createError('Department đang có staff/lịch/hẹn/encounter active nên chưa thể inactive.', 409);
    }
  }

  const before = department.toObject();
  department.status = status;
  department.updated_by = actor.userId;
  await department.save();

  await recordAuditLog({
    actor,
    action: 'departments.status_update',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Cập nhật trạng thái department thành công.',
    requestMeta,
    metadata: { status },
    before,
    after: department.toObject(),
  });

  return getDepartmentDetail(department._id, actor);
}

async function deleteDepartmentSoft(departmentId, actor, requestMeta = {}) {
  const department = await Department.findById(departmentId);
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }

  const usage = await checkDepartmentInUse(department._id);
  if (usage.in_use) {
    throw createError('Department vẫn đang được sử dụng, chưa thể xóa mềm.', 409);
  }

  const before = department.toObject();
  department.is_deleted = true;
  department.deleted_at = new Date();
  department.deleted_by = actor.userId;
  department.updated_by = actor.userId;
  department.status = 'inactive';
  await department.save();

  await recordAuditLog({
    actor,
    action: 'departments.delete_soft',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Xóa mềm department thành công.',
    requestMeta,
    before,
    after: department.toObject(),
  });

  return { success: true };
}

async function assignDepartmentHead(departmentId, userId, actor, requestMeta = {}) {
  const department = await Department.findById(departmentId);
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }

  await validateDepartmentHeadEligible(userId, department._id);
  const before = department.toObject();
  department.head_user_id = userId;
  department.updated_by = actor.userId;
  await department.save();

  await recordAuditLog({
    actor,
    action: 'departments.assign_head',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Gán trưởng khoa/phòng thành công.',
    requestMeta,
    metadata: { head_user_id: userId },
    before,
    after: department.toObject(),
  });

  return getDepartmentDetail(department._id, actor);
}

async function removeDepartmentHead(departmentId, actor, requestMeta = {}) {
  const department = await Department.findById(departmentId);
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }

  const before = department.toObject();
  department.head_user_id = undefined;
  department.updated_by = actor.userId;
  await department.save();

  await recordAuditLog({
    actor,
    action: 'departments.remove_head',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Gỡ trưởng khoa/phòng thành công.',
    requestMeta,
    before,
    after: department.toObject(),
  });

  return getDepartmentDetail(department._id, actor);
}

async function getDepartmentHead(departmentId, actor = {}) {
  const detail = await getDepartmentDetail(departmentId, actor);
  return {
    department_id: detail.department.department_id,
    head: detail.head,
  };
}

async function listDepartmentStaff(departmentId, query = {}, actor = {}) {
  const department = await Department.findById(departmentId).lean();
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }
  assertCanAccessDepartment(department._id, actor);

  const { page, limit, skip } = getPagination(query);
  const filter = { department_id: department._id, is_deleted: false };
  if (query.status) {
    filter.status = query.status;
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ full_name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  const canReadFullStaff = permissionService.hasPermission(actor.permissions || [], PERMISSION.USERS.READ);

  return {
    department: {
      department_id: String(department._id),
      department_name: department.department_name,
    },
    items: items.map((user) => {
      const base = {
        user_id: String(user._id),
        full_name: user.full_name,
        status: user.status,
      };
      if (!canReadFullStaff) return base;
      return {
        ...base,
        username: user.username,
        email: user.email,
        phone: user.phone,
        employee_code: user.employee_code,
      };
    }),
    pagination: buildPagination(page, limit, total),
  };
}

async function countDepartmentStaff(departmentId, actor = {}) {
  assertCanAccessDepartment(departmentId, actor);
  const total = await User.countDocuments({ department_id: departmentId, is_deleted: false });
  const active = await User.countDocuments({ department_id: departmentId, is_deleted: false, status: 'active' });
  return {
    department_id: String(departmentId),
    total_staff: total,
    active_staff: active,
  };
}

async function getDepartmentSummary(departmentId, query = {}, actor = {}) {
  const department = await Department.findById(departmentId).lean();
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }
  assertCanAccessDepartment(department._id, actor);

  const todayStart = getStartOfDay(query.date || new Date());
  const todayEnd = getEndOfDay(query.date || new Date());

  const [staff, doctorRole, schedulesToday, appointmentsToday, activeStaffCheck, futureSchedules, futureAppointments] =
    await Promise.all([
      countDepartmentStaff(department._id, actor),
      Role.findOne({ role_code: 'doctor', is_deleted: false }).lean(),
      DoctorSchedule.countDocuments({
        department_id: department._id,
        is_deleted: false,
        work_date: { $gte: todayStart, $lte: todayEnd },
      }),
      Appointment.countDocuments({
        department_id: department._id,
        is_deleted: false,
        appointment_time: { $gte: todayStart, $lte: todayEnd },
      }),
      checkDepartmentHasActiveStaff(department._id),
      checkDepartmentHasFutureSchedules(department._id),
      checkDepartmentHasFutureAppointments(department._id),
    ]);

  let doctorsCount = 0;
  if (doctorRole) {
    const departmentUserIds = await User.find({ department_id: department._id, is_deleted: false }).distinct('_id');
    const doctorAssignments = await User.countDocuments({
      _id: { $in: departmentUserIds },
      is_deleted: false,
      department_id: department._id,
    });
    const roleAssignments = await UserRole.countDocuments({
      role_id: doctorRole._id,
      is_active: true,
      user_id: { $in: departmentUserIds },
    });
    doctorsCount = Math.min(doctorAssignments, roleAssignments);
  }

  return {
    department: {
      department_id: String(department._id),
      department_code: department.department_code,
      department_name: department.department_name,
      department_type: department.department_type,
      status: department.status,
    },
    staff,
    active_staff_count: activeStaffCheck.active_staff_count,
    doctors_count: doctorsCount,
    schedules_today: schedulesToday,
    appointments_today: appointmentsToday,
    future_schedules_count: futureSchedules.future_schedules_count,
    future_appointments_count: futureAppointments.future_appointments_count,
  };
}

module.exports = {
  // createDepartment: Tạo khoa/phòng ban.
  createDepartment,
  // listDepartments: Liệt kê khoa/phòng ban.
  listDepartments,
  // searchDepartments: Tìm kiếm khoa/phòng ban.
  searchDepartments,
  // listActiveDepartments: Liệt kê khoa/phòng ban đang hoạt động.
  listActiveDepartments,
  // getDepartmentDetail: Lấy chi tiết khoa/phòng ban.
  getDepartmentDetail,
  // updateDepartment: Cập nhật khoa/phòng ban.
  updateDepartment,
  // updateDepartmentStatus: Cập nhật trạng thái khoa/phòng ban.
  updateDepartmentStatus,
  // deleteDepartmentSoft: Xóa mềm khoa/phòng ban.
  deleteDepartmentSoft,
  // assignDepartmentHead: Gán trưởng khoa/phòng ban.
  assignDepartmentHead,
  // removeDepartmentHead: Gỡ/xóa trưởng khoa/phòng ban.
  removeDepartmentHead,
  // getDepartmentHead: Lấy trưởng khoa/phòng ban.
  getDepartmentHead,
  // listDepartmentStaff: Liệt kê nhân sự thuộc khoa/phòng ban.
  listDepartmentStaff,
  // countDepartmentStaff: Đếm nhân sự thuộc khoa/phòng ban.
  countDepartmentStaff,
  // validateDepartmentCodeUnique: Kiểm tra tính hợp lệ của tính duy nhất của mã khoa/phòng ban.
  validateDepartmentCodeUnique,
  // validateDepartmentHeadEligible: Kiểm tra tính hợp lệ của điều kiện làm trưởng khoa/phòng ban.
  validateDepartmentHeadEligible,
  // assertCanAccessDepartment: Bảo đảm quyền truy cập khoa/phòng ban.
  assertCanAccessDepartment,
  // checkDepartmentHasActiveStaff: Kiểm tra khoa/phòng ban còn nhân sự đang hoạt động.
  checkDepartmentHasActiveStaff,
  // checkDepartmentCanBeDeactivated: Kiểm tra điều kiện vô hiệu hóa khoa/phòng ban.
  checkDepartmentCanBeDeactivated,
  // checkDepartmentHasFutureSchedules: Kiểm tra khoa/phòng ban có lịch làm việc tương lai.
  checkDepartmentHasFutureSchedules,
  // checkDepartmentHasFutureAppointments: Kiểm tra khoa/phòng ban có lịch hẹn tương lai.
  checkDepartmentHasFutureAppointments,
  // checkDepartmentInUse: Kiểm tra việc khoa/phòng ban đang được sử dụng.
  checkDepartmentInUse,
  // getDepartmentSummary: Lấy tổng hợp khoa/phòng ban.
  getDepartmentSummary,
};
