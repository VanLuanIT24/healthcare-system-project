const ApiError = require('../common/errors/api-error');
const { normalizeString } = require('../common/helpers/string.helper');
const { ACTOR_TYPE } = require('../constants/statuses');
const { AUDIT_STATUS } = require('../constants/statuses');
const { Department, DoctorProfile } = require('../models');
const auditService = require('./audit.service');
const { getActorId } = require('./auth/auth.policy');

function assertStaffActor(auth = {}) {
  if (auth.actorType !== ACTOR_TYPE.STAFF) {
    throw ApiError.forbidden('Chỉ tài khoản nhân sự mới có hồ sơ bác sĩ.');
  }
}

function serializeDepartment(department) {
  if (!department) return null;
  return {
    department_id: String(department._id || department.department_id || department.id),
    department_code: department.department_code,
    department_name: department.department_name || department.name,
    name: department.name || department.department_name,
    status: department.status,
  };
}

function serializeDoctorProfile(profile, department = null) {
  if (!profile) return null;
  const plain = typeof profile.toObject === 'function' ? profile.toObject() : profile;
  return {
    profile_id: String(plain._id || plain.id),
    doctor_profile_id: String(plain._id || plain.id),
    user_id: String(plain.user_id),
    department_id: plain.department_id ? String(plain.department_id) : null,
    department: serializeDepartment(department),
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
  };
}

async function getMyDoctorProfile(auth = {}) {
  assertStaffActor(auth);

  const profile = await DoctorProfile.findOne({ user_id: auth.userId, is_deleted: false });
  if (!profile) {
    throw ApiError.notFound('Không tìm thấy hồ sơ chuyên môn của bác sĩ đang đăng nhập.');
  }

  const department = profile.department_id ? await Department.findById(profile.department_id).lean() : null;
  return { doctor_profile: serializeDoctorProfile(profile, department) };
}

async function updateMyDoctorProfile(auth = {}, payload = {}, requestMeta = {}) {
  assertStaffActor(auth);

  const profile = await DoctorProfile.findOne({ user_id: auth.userId, is_deleted: false });
  if (!profile) {
    throw ApiError.notFound('Không tìm thấy hồ sơ chuyên môn của bác sĩ đang đăng nhập.');
  }

  const before = profile.toObject();
  [
    'specialty',
    'license_number',
    'subspecialty',
    'qualification',
    'academic_title',
    'avatar_url',
    'biography',
  ].forEach((field) => {
    if (payload[field] !== undefined) {
      const nextValue = normalizeString(payload[field]);
      if (['specialty', 'license_number'].includes(field) && !nextValue) {
        return;
      }
      profile[field] = nextValue || undefined;
    }
  });

  if (payload.years_of_experience !== undefined) {
    const years = payload.years_of_experience === '' || payload.years_of_experience === null
      ? undefined
      : Number(payload.years_of_experience);
    if (years !== undefined && (!Number.isFinite(years) || years < 0)) {
      throw ApiError.validation('Kinh nghiệm không hợp lệ.');
    }
    profile.years_of_experience = years;
  }

  if (payload.languages !== undefined) {
    profile.languages = Array.isArray(payload.languages)
      ? payload.languages.map(normalizeString).filter(Boolean)
      : [];
  }

  profile.updated_by = getActorId(auth);
  await profile.save();

  await auditService.recordAuditLog({
    actor: auth,
    action: 'doctor_profiles.self_update',
    targetType: 'doctor_profile',
    targetId: profile._id,
    before,
    after: profile,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Doctor self profile updated.',
    requestMeta,
  });

  return getMyDoctorProfile(auth);
}

module.exports = {
  getMyDoctorProfile,
  updateMyDoctorProfile,
};
