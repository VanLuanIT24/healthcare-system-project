const {
  Appointment,
  Department,
  DoctorSchedule,
  Encounter,
  Role,
  User,
  UserRole,
} = require('../models');
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

async function validateDepartmentCodeUnique(departmentCode, excludeId = null) {
  const filter = {
    department_code: normalizeString(departmentCode),
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

  if (departmentId && user.department_id && String(user.department_id) !== String(departmentId)) {
    throw createError('Staff được chọn không thuộc department này.', 409);
  }

  return user;
}

async function createDepartment(payload, actor, requestMeta = {}) {
  const department_code = normalizeString(payload.department_code);
  const department_name = normalizeHumanName(payload.department_name);

  if (!department_code) {
    throw createError('department_code là bắt buộc.');
  }
  if (!department_name) {
    throw createError('department_name là bắt buộc.');
  }

  await validateDepartmentCodeUnique(department_code);

  if (payload.head_user_id) {
    await validateDepartmentHeadEligible(payload.head_user_id);
  }

  const department = await Department.create({
    department_code,
    department_name,
    department_type: normalizeString(payload.department_type) || undefined,
    head_user_id: payload.head_user_id || undefined,
    location_note: normalizeString(payload.location_note) || undefined,
    status: payload.status || 'active',
    created_by: actor.userId,
  });

  await recordAuditLog({
    actor,
    action: 'department.create',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Tạo department thành công.',
    requestMeta,
  });

  return getDepartmentDetail(department._id);
}

async function listDepartments(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };
  const keyword = normalizeString(query.search);

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

async function getDepartmentDetail(departmentId) {
  const department = await Department.findById(departmentId).lean();
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }

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
  const department = await Department.findById(departmentId);
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }

  if (payload.department_code && payload.department_code !== department.department_code) {
    await validateDepartmentCodeUnique(payload.department_code, department._id);
    department.department_code = normalizeString(payload.department_code);
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

  if (payload.head_user_id !== undefined) {
    if (payload.head_user_id) {
      await validateDepartmentHeadEligible(payload.head_user_id, department._id);
      department.head_user_id = payload.head_user_id;
    } else {
      department.head_user_id = undefined;
    }
  }

  department.updated_by = actor.userId;
  await department.save();

  await recordAuditLog({
    actor,
    action: 'department.update',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Cập nhật department thành công.',
    requestMeta,
  });

  return getDepartmentDetail(department._id);
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
  const activeSchedules = await DoctorSchedule.countDocuments({
    department_id: departmentId,
    is_deleted: false,
    work_date: { $gte: getStartOfDay(now) },
    status: { $in: ['published', 'active'] },
  });

  return {
    department_id: String(departmentId),
    can_deactivate: activeSchedules === 0,
    active_schedule_count: activeSchedules,
  };
}

async function checkDepartmentHasFutureSchedules(departmentId) {
  const count = await DoctorSchedule.countDocuments({
    department_id: departmentId,
    is_deleted: false,
    work_date: { $gte: getStartOfDay(new Date()) },
    status: { $in: ['draft', 'published', 'active'] },
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
      throw createError('Department đang có lịch làm việc active/published nên chưa thể inactive.', 409);
    }
  }

  department.status = status;
  department.updated_by = actor.userId;
  await department.save();

  await recordAuditLog({
    actor,
    action: 'department.update_status',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Cập nhật trạng thái department thành công.',
    requestMeta,
    metadata: { status },
  });

  return getDepartmentDetail(department._id);
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

  department.is_deleted = true;
  department.deleted_at = new Date();
  department.deleted_by = actor.userId;
  department.updated_by = actor.userId;
  department.status = 'inactive';
  await department.save();

  await recordAuditLog({
    actor,
    action: 'department.soft_delete',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Xóa mềm department thành công.',
    requestMeta,
  });

  return { success: true };
}

async function assignDepartmentHead(departmentId, userId, actor, requestMeta = {}) {
  const department = await Department.findById(departmentId);
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }

  await validateDepartmentHeadEligible(userId, department._id);
  department.head_user_id = userId;
  department.updated_by = actor.userId;
  await department.save();

  await recordAuditLog({
    actor,
    action: 'department.assign_head',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Gán trưởng khoa/phòng thành công.',
    requestMeta,
    metadata: { head_user_id: userId },
  });

  return getDepartmentDetail(department._id);
}

async function removeDepartmentHead(departmentId, actor, requestMeta = {}) {
  const department = await Department.findById(departmentId);
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }

  department.head_user_id = undefined;
  department.updated_by = actor.userId;
  await department.save();

  await recordAuditLog({
    actor,
    action: 'department.remove_head',
    targetType: 'department',
    targetId: department._id,
    status: 'success',
    message: 'Gỡ trưởng khoa/phòng thành công.',
    requestMeta,
  });

  return getDepartmentDetail(department._id);
}

async function getDepartmentHead(departmentId) {
  const detail = await getDepartmentDetail(departmentId);
  return {
    department_id: detail.department.department_id,
    head: detail.head,
  };
}

async function listDepartmentStaff(departmentId, query = {}) {
  const department = await Department.findById(departmentId).lean();
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }

  const { page, limit, skip } = getPagination(query);
  const filter = { department_id: department._id, is_deleted: false };
  if (query.status) {
    filter.status = query.status;
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ full_name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return {
    department: {
      department_id: String(department._id),
      department_name: department.department_name,
    },
    items: items.map((user) => ({
      user_id: String(user._id),
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      employee_code: user.employee_code,
      status: user.status,
    })),
    pagination: buildPagination(page, limit, total),
  };
}

async function countDepartmentStaff(departmentId) {
  const total = await User.countDocuments({ department_id: departmentId, is_deleted: false });
  const active = await User.countDocuments({ department_id: departmentId, is_deleted: false, status: 'active' });
  return {
    department_id: String(departmentId),
    total_staff: total,
    active_staff: active,
  };
}

async function getDepartmentSummary(departmentId, query = {}) {
  const department = await Department.findById(departmentId).lean();
  if (!department || department.is_deleted) {
    throw createError('Không tìm thấy department.', 404);
  }

  const todayStart = getStartOfDay(query.date || new Date());
  const todayEnd = getEndOfDay(query.date || new Date());

  const [staff, doctorRole, schedulesToday, appointmentsToday, activeStaffCheck, futureSchedules, futureAppointments] =
    await Promise.all([
      countDepartmentStaff(department._id),
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
  createDepartment,
  listDepartments,
  searchDepartments,
  listActiveDepartments,
  getDepartmentDetail,
  updateDepartment,
  updateDepartmentStatus,
  deleteDepartmentSoft,
  assignDepartmentHead,
  removeDepartmentHead,
  getDepartmentHead,
  listDepartmentStaff,
  countDepartmentStaff,
  validateDepartmentCodeUnique,
  validateDepartmentHeadEligible,
  checkDepartmentHasActiveStaff,
  checkDepartmentCanBeDeactivated,
  checkDepartmentHasFutureSchedules,
  checkDepartmentHasFutureAppointments,
  checkDepartmentInUse,
  getDepartmentSummary,
};
