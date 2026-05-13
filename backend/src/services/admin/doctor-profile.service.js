const ApiError = require('../../common/errors/api-error');
const { normalizePagination, buildPaginationMeta } = require('../../common/helpers/pagination.helper');
const { buildRegexSearch } = require('../../common/helpers/query.helper');
const { normalizeString } = require('../../common/helpers/string.helper');
const { DOCTOR_PROFILE_STATUS, DOCTOR_PROFILE_STATUSES } = require('../../constants/statuses');
const { PERMISSION, ROLE_CODE } = require('../../constants/permissions');
const {
  Appointment,
  Department,
  DoctorProfile,
  DoctorSchedule,
  Role,
  User,
  UserRole,
} = require('../../models');
const auditService = require('../audit.service');
const { getActorId } = require('../auth/auth.policy');
const permissionService = require('../permission.service');

function serializeUser(user) {
  if (!user) return null;
  return {
    user_id: String(user._id || user.id),
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    employee_code: user.employee_code,
    department_id: user.department_id ? String(user.department_id) : null,
    status: user.status,
  };
}

function serializeDepartment(department) {
  if (!department) return null;
  return {
    department_id: String(department._id || department.id),
    department_code: department.department_code,
    department_name: department.department_name,
    department_type: department.department_type,
    status: department.status,
  };
}

function serializeDoctorProfile(profile, extras = {}) {
  const plain = typeof profile.toObject === 'function' ? profile.toObject() : profile;
  return {
    profile_id: String(plain._id || plain.id),
    doctor_profile_id: String(plain._id || plain.id),
    user_id: String(plain.user_id),
    department_id: String(plain.department_id),
    license_number: plain.license_number,
    specialty: plain.specialty,
    subspecialty: plain.subspecialty,
    qualification: plain.qualification,
    academic_title: plain.academic_title,
    years_of_experience: plain.years_of_experience,
    consultation_duration_minutes: plain.consultation_duration_minutes,
    consultation_fee: plain.consultation_fee,
    avatar_url: plain.avatar_url,
    biography: plain.biography,
    languages: plain.languages || [],
    public_profile_enabled: Boolean(plain.public_profile_enabled),
    status: plain.status,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
    ...extras,
  };
}

function serializePublicDepartment(department) {
  if (!department) return null;
  return {
    department_id: department.department_id,
    department_code: department.department_code,
    department_name: department.department_name,
    department_type: department.department_type,
  };
}

function serializePublicDoctorProfile(item) {
  return {
    doctor_profile_id: item.doctor_profile_id,
    full_name: item.user?.full_name,
    department: serializePublicDepartment(item.department),
    specialty: item.specialty,
    subspecialty: item.subspecialty,
    qualification: item.qualification,
    academic_title: item.academic_title,
    years_of_experience: item.years_of_experience,
    consultation_duration_minutes: item.consultation_duration_minutes,
    consultation_fee: item.consultation_fee,
    avatar_url: item.avatar_url,
    biography: item.biography,
    languages: item.languages,
  };
}

function getActorDepartmentId(actor = {}) {
  return actor.department_id || actor.departmentId || actor.user?.department_id || null;
}

function hasGlobalDoctorProfileAccess(actor = {}) {
  return permissionService.hasAnyPermission(actor.permissions || [], [
    PERMISSION.DOCTOR_PROFILES.READ,
    PERMISSION.DOCTOR_PROFILES.CREATE,
    PERMISSION.DOCTOR_PROFILES.UPDATE,
    PERMISSION.DOCTOR_PROFILES.UPDATE_STATUS,
    PERMISSION.DOCTOR_PROFILES.DELETE,
  ]);
}

function hasScopedDoctorProfileAccess(actor = {}) {
  return permissionService.hasAnyPermission(actor.permissions || [], [
    PERMISSION.DOCTOR_PROFILES.READ_DEPARTMENT,
    PERMISSION.REPORTS.DOCTOR_PERFORMANCE_READ,
  ]);
}

function hasOwnDoctorProfileAccess(actor = {}) {
  return permissionService.hasPermission(actor.permissions || [], PERMISSION.DOCTOR_PROFILES.READ_OWN);
}

function assertCanAccessDoctorProfile(profile = {}, actor = {}) {
  if (!actor || Object.keys(actor).length === 0 || hasGlobalDoctorProfileAccess(actor)) {
    return true;
  }

  if (hasScopedDoctorProfileAccess(actor) && String(getActorDepartmentId(actor)) === String(profile.department_id)) {
    return true;
  }

  if (hasOwnDoctorProfileAccess(actor) && String(getActorId(actor)) === String(profile.user_id)) {
    return true;
  }

  throw ApiError.forbidden('Bạn không được truy cập doctor_profile ngoài phạm vi của mình.');
}

function applyDoctorProfileScope(filter, actor = {}) {
  if (!actor || Object.keys(actor).length === 0 || hasGlobalDoctorProfileAccess(actor)) {
    return filter;
  }

  if (hasScopedDoctorProfileAccess(actor)) {
    const departmentId = getActorDepartmentId(actor);
    if (!departmentId) throw ApiError.forbidden('Tài khoản hiện tại chưa có department scope.');
    if (filter.department_id && String(filter.department_id) !== String(departmentId)) {
      throw ApiError.forbidden('Bạn không được xem doctor_profile ngoài department của mình.');
    }
    return { ...filter, department_id: departmentId };
  }

  if (hasOwnDoctorProfileAccess(actor)) {
    return { ...filter, user_id: getActorId(actor) };
  }

  return filter;
}

async function assertUserIsDoctor(userId) {
  const doctorRole = await Role.findOne({
    role_code: ROLE_CODE.DOCTOR,
    status: 'active',
    is_deleted: false,
  }).lean();

  if (!doctorRole) {
    throw ApiError.conflict('Role doctor chưa được seed hoặc đang inactive.');
  }

  const assignment = await UserRole.findOne({
    user_id: userId,
    role_id: doctorRole._id,
    is_active: true,
  }).lean();

  if (!assignment) {
    throw ApiError.conflict('User được chọn chưa có role doctor.');
  }
}

async function findActiveDepartment(departmentId) {
  const department = await Department.findById(departmentId).lean();
  if (!department || department.is_deleted || department.status !== 'active') {
    throw ApiError.notFound('Department không tồn tại hoặc không active.');
  }
  return department;
}

async function validateDoctorProfilePayload(payload = {}, options = {}) {
  const userId = payload.user_id;
  const departmentId = payload.department_id;
  const licenseNumber = normalizeString(payload.license_number);
  const specialty = normalizeString(payload.specialty);

  if (!userId) throw ApiError.validation('user_id là bắt buộc.');
  if (!departmentId) throw ApiError.validation('department_id là bắt buộc.');
  if (!licenseNumber) throw ApiError.validation('license_number là bắt buộc.');
  if (!specialty) throw ApiError.validation('specialty là bắt buộc.');

  const [user, department] = await Promise.all([
    User.findById(userId).lean(),
    findActiveDepartment(departmentId),
  ]);

  if (!user || user.is_deleted || user.status !== 'active') {
    throw ApiError.notFound('User bác sĩ không tồn tại hoặc không active.');
  }

  if (user.department_id && String(user.department_id) !== String(department._id)) {
    throw ApiError.conflict('department_id của doctor_profile phải khớp với department hiện tại của user bác sĩ.');
  }

  await assertUserIsDoctor(user._id);
  assertCanAccessDoctorProfile({ user_id: user._id, department_id: department._id }, options.actor);

  const duplicateUser = await DoctorProfile.findOne({
    _id: { $ne: options.excludeProfileId },
    user_id: user._id,
    is_deleted: false,
  }).lean();
  if (duplicateUser) {
    throw ApiError.conflict('User này đã có doctor_profile.');
  }

  const duplicateLicense = await DoctorProfile.findOne({
    _id: { $ne: options.excludeProfileId },
    license_number: licenseNumber,
    is_deleted: false,
  }).lean();
  if (duplicateLicense) {
    throw ApiError.conflict('license_number đã tồn tại.');
  }

  return {
    user,
    department,
    normalized: {
      user_id: user._id,
      department_id: department._id,
      license_number: licenseNumber,
      specialty,
    },
  };
}

async function hydrateDoctorProfiles(profiles = []) {
  const userIds = profiles.map((profile) => profile.user_id).filter(Boolean);
  const departmentIds = profiles.map((profile) => profile.department_id).filter(Boolean);
  const [users, departments] = await Promise.all([
    User.find({ _id: { $in: userIds }, is_deleted: false }).lean(),
    Department.find({ _id: { $in: departmentIds }, is_deleted: false }).lean(),
  ]);
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const departmentMap = new Map(departments.map((department) => [String(department._id), department]));

  return profiles.map((profile) => {
    const user = userMap.get(String(profile.user_id));
    const department = departmentMap.get(String(profile.department_id));
    return serializeDoctorProfile(profile, {
      user: serializeUser(user),
      department: serializeDepartment(department),
    });
  });
}

async function createDoctorProfile(payload = {}, actor = {}, requestMeta = {}) {
  const { normalized } = await validateDoctorProfilePayload(payload, { actor });

  const profile = await DoctorProfile.create({
    ...normalized,
    subspecialty: normalizeString(payload.subspecialty),
    qualification: normalizeString(payload.qualification),
    academic_title: normalizeString(payload.academic_title),
    years_of_experience: payload.years_of_experience,
    consultation_duration_minutes: payload.consultation_duration_minutes,
    consultation_fee: payload.consultation_fee,
    avatar_url: normalizeString(payload.avatar_url),
    biography: payload.biography,
    languages: Array.isArray(payload.languages) ? payload.languages.map(normalizeString).filter(Boolean) : [],
    public_profile_enabled: payload.public_profile_enabled !== false,
    status: payload.status || DOCTOR_PROFILE_STATUS.ACTIVE,
    created_by: getActorId(actor),
  });

  await auditService.recordAuditLog({
    actor,
    action: 'doctor_profiles.create',
    targetType: 'doctor_profile',
    targetId: profile._id,
    message: 'Doctor profile created.',
    requestMeta,
    after: profile,
  });

  return getDoctorProfileDetail(profile._id, actor);
}

async function buildDoctorProfileFilter(query = {}, publicOnly = false, actor = {}) {
  const filter = { is_deleted: false };
  if (query.department_id) filter.department_id = query.department_id;
  if (query.specialty) filter.specialty = buildRegexSearch(query.specialty);
  if (query.status) filter.status = query.status;
  if (query.language) filter.languages = query.language;
  if (query.min_experience) filter.years_of_experience = { $gte: Number(query.min_experience) || 0 };
  if (publicOnly) {
    filter.status = DOCTOR_PROFILE_STATUS.ACTIVE;
    filter.public_profile_enabled = true;
  }

  const keyword = normalizeString(query.keyword || query.search);
  const scopedFilter = publicOnly ? filter : applyDoctorProfileScope(filter, actor);
  const userIdSets = [];

  if (scopedFilter.user_id) {
    if (scopedFilter.user_id.$in) {
      userIdSets.push(scopedFilter.user_id.$in.map(String));
    } else {
      userIdSets.push([String(scopedFilter.user_id)]);
    }
    delete scopedFilter.user_id;
  }

  if (publicOnly) {
    const activeUsers = await User.find({
      is_deleted: false,
      status: 'active',
    }).select('_id').lean();
    userIdSets.push(activeUsers.map((user) => String(user._id)));
  }

  if (!keyword) {
    if (userIdSets.length) {
      const [firstSet, ...restSets] = userIdSets.map((items) => new Set(items));
      scopedFilter.user_id = { $in: [...firstSet].filter((item) => restSets.every((set) => set.has(item))) };
    }
    return scopedFilter;
  }

  const userSearchFields = publicOnly
    ? [{ full_name: buildRegexSearch(keyword) }]
    : [
      { full_name: buildRegexSearch(keyword) },
      { username: buildRegexSearch(keyword) },
      { email: buildRegexSearch(keyword) },
      { employee_code: buildRegexSearch(keyword) },
    ];

  const matchingUsers = await User.find({
    is_deleted: false,
    ...(publicOnly ? { status: 'active' } : {}),
    $or: userSearchFields,
  }).select('_id').lean();
  userIdSets.push(matchingUsers.map((user) => String(user._id)));

  if (userIdSets.length) {
    const [firstSet, ...restSets] = userIdSets.map((items) => new Set(items));
    const intersection = [...firstSet].filter((item) => restSets.every((set) => set.has(item)));
    scopedFilter.user_id = { $in: intersection };
  }

  scopedFilter.$or = [
    { specialty: buildRegexSearch(keyword) },
    { subspecialty: buildRegexSearch(keyword) },
    { qualification: buildRegexSearch(keyword) },
    { user_id: { $in: matchingUsers.map((user) => user._id) } },
  ];

  if (!publicOnly) {
    scopedFilter.$or.push({ license_number: buildRegexSearch(keyword) });
  }

  return scopedFilter;
}

async function listDoctorProfiles(query = {}, actor = {}, options = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const publicOnly = options.publicOnly || query.public === true || query.public === 'true';
  const filter = await buildDoctorProfileFilter(query, publicOnly, actor);

  const [profiles, total] = await Promise.all([
    DoctorProfile.find(filter).sort({ specialty: 1, created_at: -1 }).skip(skip).limit(limit).lean(),
    DoctorProfile.countDocuments(filter),
  ]);

  const hydrated = await hydrateDoctorProfiles(profiles);
  const items = publicOnly
    ? hydrated
        .filter((item) => item.user?.status === 'active')
        .map(serializePublicDoctorProfile)
    : hydrated;

  return {
    items,
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function getDoctorProfileDetail(profileId, actor = {}) {
  const profile = await DoctorProfile.findById(profileId).lean();
  if (!profile || profile.is_deleted) {
    throw ApiError.notFound('Không tìm thấy doctor_profile.');
  }
  assertCanAccessDoctorProfile(profile, actor);

  const [item] = await hydrateDoctorProfiles([profile]);
  const now = new Date();
  const [futureSchedulesCount, futureAppointmentsCount] = await Promise.all([
    DoctorSchedule.countDocuments({
      doctor_id: profile.user_id,
      is_deleted: false,
      work_date: { $gte: now },
      status: { $in: ['draft', 'published', 'active'] },
    }),
    Appointment.countDocuments({
      doctor_id: profile.user_id,
      is_deleted: false,
      appointment_time: { $gte: now },
      status: { $in: ['booked', 'confirmed', 'checked_in', 'in_consultation'] },
    }),
  ]);

  return {
    doctor_profile: item,
    usage: {
      future_schedules_count: futureSchedulesCount,
      future_appointments_count: futureAppointmentsCount,
    },
  };
}

async function assertDoctorProfileDepartmentChangeSafe(profile, nextDepartmentId) {
  if (String(profile.department_id) === String(nextDepartmentId)) return true;

  const [futureSchedulesCount, futureAppointmentsCount] = await Promise.all([
    DoctorSchedule.countDocuments({
      doctor_id: profile.user_id,
      is_deleted: false,
      work_date: { $gte: new Date() },
      status: { $in: ['draft', 'published', 'active'] },
    }),
    Appointment.countDocuments({
      doctor_id: profile.user_id,
      is_deleted: false,
      appointment_time: { $gte: new Date() },
      status: { $in: ['booked', 'confirmed', 'checked_in', 'in_consultation'] },
    }),
  ]);

  if (futureSchedulesCount || futureAppointmentsCount) {
    throw ApiError.conflict('Không thể chuyển department doctor_profile khi bác sĩ còn lịch/hẹn tương lai.');
  }

  return true;
}

async function updateDoctorProfile(profileId, payload = {}, actor = {}, requestMeta = {}) {
  const profile = await DoctorProfile.findById(profileId);
  if (!profile || profile.is_deleted) {
    throw ApiError.notFound('Không tìm thấy doctor_profile.');
  }
  assertCanAccessDoctorProfile(profile, actor);

  const before = profile.toObject();

  if (payload.user_id || payload.department_id || payload.license_number || payload.specialty) {
    if (payload.department_id) {
      await assertDoctorProfileDepartmentChangeSafe(profile, payload.department_id);
    }
    const { normalized } = await validateDoctorProfilePayload({
      user_id: payload.user_id || profile.user_id,
      department_id: payload.department_id || profile.department_id,
      license_number: payload.license_number || profile.license_number,
      specialty: payload.specialty || profile.specialty,
    }, { excludeProfileId: profile._id, actor });
    Object.assign(profile, normalized);
  }

  [
    'subspecialty',
    'qualification',
    'academic_title',
    'avatar_url',
    'biography',
  ].forEach((field) => {
    if (payload[field] !== undefined) profile[field] = normalizeString(payload[field]) || undefined;
  });

  if (payload.years_of_experience !== undefined) profile.years_of_experience = payload.years_of_experience;
  if (payload.consultation_duration_minutes !== undefined) profile.consultation_duration_minutes = payload.consultation_duration_minutes;
  if (payload.consultation_fee !== undefined) profile.consultation_fee = payload.consultation_fee;
  if (payload.public_profile_enabled !== undefined) profile.public_profile_enabled = Boolean(payload.public_profile_enabled);
  if (payload.languages !== undefined) {
    profile.languages = Array.isArray(payload.languages) ? payload.languages.map(normalizeString).filter(Boolean) : [];
  }
  profile.updated_by = getActorId(actor);
  await profile.save();

  await auditService.recordAuditLog({
    actor,
    action: 'doctor_profiles.update',
    targetType: 'doctor_profile',
    targetId: profile._id,
    before,
    after: profile,
    message: 'Doctor profile updated.',
    requestMeta,
  });

  return getDoctorProfileDetail(profile._id, actor);
}

async function assertDoctorProfileCanBeInactive(profile) {
  const [futureSchedulesCount, futureAppointmentsCount] = await Promise.all([
    DoctorSchedule.countDocuments({
      doctor_id: profile.user_id,
      is_deleted: false,
      work_date: { $gte: new Date() },
      status: { $in: ['published', 'active'] },
    }),
    Appointment.countDocuments({
      doctor_id: profile.user_id,
      is_deleted: false,
      appointment_time: { $gte: new Date() },
      status: { $in: ['booked', 'confirmed', 'checked_in', 'in_consultation'] },
    }),
  ]);

  if (futureSchedulesCount || futureAppointmentsCount) {
    throw ApiError.conflict('Bác sĩ còn lịch/hẹn tương lai active, cần xử lý trước khi inactive/suspend/retire.');
  }
}

async function updateDoctorProfileStatus(profileId, status, actor = {}, requestMeta = {}) {
  if (!DOCTOR_PROFILE_STATUSES.includes(status)) {
    throw ApiError.badRequest('Trạng thái doctor_profile không hợp lệ.');
  }

  const profile = await DoctorProfile.findById(profileId);
  if (!profile || profile.is_deleted) {
    throw ApiError.notFound('Không tìm thấy doctor_profile.');
  }
  assertCanAccessDoctorProfile(profile, actor);

  if (status !== DOCTOR_PROFILE_STATUS.ACTIVE) {
    await assertDoctorProfileCanBeInactive(profile);
  }

  const before = profile.toObject();
  profile.status = status;
  profile.updated_by = getActorId(actor);
  await profile.save();

  await auditService.recordAuditLog({
    actor,
    action: 'doctor_profiles.status_update',
    targetType: 'doctor_profile',
    targetId: profile._id,
    before,
    after: profile,
    message: 'Doctor profile status updated.',
    requestMeta,
    metadata: { status },
  });

  return getDoctorProfileDetail(profile._id, actor);
}

async function deleteDoctorProfileSoft(profileId, actor = {}, requestMeta = {}) {
  const profile = await DoctorProfile.findById(profileId);
  if (!profile || profile.is_deleted) {
    throw ApiError.notFound('Không tìm thấy doctor_profile.');
  }
  assertCanAccessDoctorProfile(profile, actor);

  await assertDoctorProfileCanBeInactive(profile);
  const before = profile.toObject();
  profile.is_deleted = true;
  profile.deleted_at = new Date();
  profile.deleted_by = getActorId(actor);
  profile.status = DOCTOR_PROFILE_STATUS.INACTIVE;
  await profile.save();

  await auditService.recordAuditLog({
    actor,
    action: 'doctor_profiles.delete_soft',
    targetType: 'doctor_profile',
    targetId: profile._id,
    before,
    after: profile,
    message: 'Doctor profile soft deleted.',
    requestMeta,
  });

  return { success: true };
}

async function getDoctorsList(query = {}) {
  return listDoctorProfiles(query, {}, { publicOnly: query.public === true || query.public === 'true' });
}

module.exports = {
  // createDoctorProfile: Tạo hồ sơ bác sĩ.
  createDoctorProfile,
  // listDoctorProfiles: Liệt kê hồ sơ bác sĩ.
  listDoctorProfiles,
  // getDoctorProfileDetail: Lấy bác sĩ hồ sơ chi tiết.
  getDoctorProfileDetail,
  // updateDoctorProfile: Cập nhật hồ sơ bác sĩ.
  updateDoctorProfile,
  // updateDoctorProfileStatus: Cập nhật bác sĩ hồ sơ trạng thái.
  updateDoctorProfileStatus,
  // deleteDoctorProfileSoft: Xóa mềm hồ sơ bác sĩ.
  deleteDoctorProfileSoft,
  // getDoctorsList: Lấy danh sách bác sĩ.
  getDoctorsList,
};
