const ApiError = require('../../common/errors/api-error');
const { normalizeLowercase, normalizePhone, normalizeString } = require('../../common/helpers/string.helper');
const { AUDIT_STATUS } = require('../../constants/statuses');
const { Department, DoctorProfile, Patient, PatientAccount, User } = require('../../models');
const auditService = require('../audit.service');
const { buildUserPermissionMap, buildUserRoleDetails } = require('../access-control.service');
const {
  ACTOR_TYPE,
  PATIENT_PORTAL_PERMISSIONS,
  getActorId,
} = require('./auth.policy');
const { sanitizeStaff, getStaffAuthorization } = require('./staff-auth.service');
const { sanitizePatient } = require('./patient-auth.service');

async function getCurrentProfile(auth = {}) {
  if (auth.actorType === ACTOR_TYPE.STAFF) {
    const user = await User.findById(auth.userId).lean();
    if (!user || user.is_deleted) {
      throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');
    }

    const [authorization, department, doctorProfile] = await Promise.all([
      getStaffAuthorization(user._id),
      user.department_id ? Department.findById(user.department_id).lean() : null,
      DoctorProfile.findOne({ user_id: user._id, is_deleted: false }).lean(),
    ]);

    return {
      actor_type: ACTOR_TYPE.STAFF,
      user: sanitizeStaff(user, authorization),
      department,
      doctor_profile: doctorProfile,
      roles: authorization.roles,
      permissions: authorization.permissionCodes,
    };
  }

  const [account, patient] = await Promise.all([
    PatientAccount.findById(auth.patientAccountId).lean(),
    Patient.findById(auth.patientId).lean(),
  ]);

  if (!account || !patient || account.is_deleted || patient.is_deleted) {
    throw ApiError.notFound('Không tìm thấy tài khoản bệnh nhân.');
  }

  return {
    actor_type: ACTOR_TYPE.PATIENT,
    patient_account: {
      id: String(account._id),
      username: account.username,
      email: account.email,
      phone: account.phone,
      status: account.status,
      last_login_at: account.last_login_at,
    },
    patient,
    permissions: PATIENT_PORTAL_PERMISSIONS,
  };
}

async function getMyRoles(auth = {}) {
  if (auth.actorType === ACTOR_TYPE.PATIENT) {
    return {
      actor_type: ACTOR_TYPE.PATIENT,
      roles: [{ role_code: 'patient', role_name: 'Patient', description: 'Bệnh nhân' }],
    };
  }

  const roles = await buildUserRoleDetails(auth.userId);
  return {
    actor_type: ACTOR_TYPE.STAFF,
    roles,
  };
}

async function getMyPermissions(auth = {}) {
  if (auth.actorType === ACTOR_TYPE.PATIENT) {
    return {
      actor_type: ACTOR_TYPE.PATIENT,
      user_id: auth.patientAccountId,
      roles: ['patient'],
      permissions: PATIENT_PORTAL_PERMISSIONS,
    };
  }

  const roles = await buildUserRoleDetails(auth.userId);
  const permissions = [...(await buildUserPermissionMap(auth.userId))];

  return {
    actor_type: ACTOR_TYPE.STAFF,
    user_id: auth.userId,
    roles: roles.map((role) => role.role_code),
    permissions,
  };
}

async function updateStaffProfile(auth, payload = {}, requestMeta = {}) {
  const allowed = {
    email: payload.email,
    phone: payload.phone,
  };

  const user = await User.findById(auth.userId);
  if (!user || user.is_deleted) {
    throw ApiError.notFound('Không tìm thấy tài khoản nhân sự.');
  }

  const email = allowed.email !== undefined ? normalizeLowercase(allowed.email) : user.email;
  const phone = allowed.phone !== undefined ? normalizePhone(allowed.phone) : user.phone;

  if (email && email !== user.email) {
    const existed = await User.findOne({ _id: { $ne: user._id }, email, is_deleted: false }).lean();
    if (existed) throw ApiError.conflict('Email đã được sử dụng bởi tài khoản khác.');
  }

  if (phone && phone !== user.phone) {
    const existed = await User.findOne({ _id: { $ne: user._id }, phone, is_deleted: false }).lean();
    if (existed) throw ApiError.conflict('Số điện thoại đã được sử dụng bởi tài khoản khác.');
  }

  user.email = email;
  user.phone = phone;
  user.updated_by = getActorId(auth);
  await user.save();

  await auditService.recordAuditLog({
    actor: auth,
    action: 'auth.profile.update',
    targetType: 'user',
    targetId: user._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Staff profile updated.',
    requestMeta,
  });

  return {
    profile: sanitizeStaff(user, await getStaffAuthorization(user._id)),
  };
}

async function updatePatientProfile(auth, payload = {}, requestMeta = {}) {
  const [account, patient] = await Promise.all([
    PatientAccount.findById(auth.patientAccountId),
    Patient.findById(auth.patientId),
  ]);

  if (!account || !patient || account.is_deleted || patient.is_deleted) {
    throw ApiError.notFound('Không tìm thấy tài khoản bệnh nhân.');
  }

  const email = payload.email !== undefined ? normalizeLowercase(payload.email) : account.email;
  const phone = payload.phone !== undefined ? normalizePhone(payload.phone) : account.phone;

  if (email && email !== account.email) {
    const existed = await PatientAccount.findOne({ _id: { $ne: account._id }, email, is_deleted: false }).lean();
    if (existed) throw ApiError.conflict('Email đã được sử dụng bởi tài khoản khác.');
  }

  if (phone && phone !== account.phone) {
    const existed = await PatientAccount.findOne({ _id: { $ne: account._id }, phone, is_deleted: false }).lean();
    if (existed) throw ApiError.conflict('Số điện thoại đã được sử dụng bởi tài khoản khác.');
  }

  account.email = email;
  account.phone = phone;
  if (email) account.username = email;
  else if (phone) account.username = phone;

  if (payload.full_name !== undefined) patient.full_name = normalizeString(payload.full_name) || patient.full_name;
  if (payload.address !== undefined) patient.address = payload.address;
  patient.email = email;
  patient.phone = phone;

  await Promise.all([account.save(), patient.save()]);

  await auditService.recordAuditLog({
    actor: auth,
    action: 'auth.profile.update',
    targetType: 'patient_account',
    targetId: account._id,
    status: AUDIT_STATUS.SUCCESS,
    message: 'Patient profile updated.',
    requestMeta,
  });

  return {
    profile: sanitizePatient(patient, account),
  };
}

async function updateMyProfile(auth = {}, payload = {}, requestMeta = {}) {
  if (auth.actorType === ACTOR_TYPE.STAFF) {
    return updateStaffProfile(auth, payload, requestMeta);
  }

  return updatePatientProfile(auth, payload, requestMeta);
}

module.exports = {
  // getCurrentProfile: Lấy hồ sơ hiện tại.
  getCurrentProfile,
  // getMyRoles: Lấy vai trò của người dùng hiện tại.
  getMyRoles,
  // getMyPermissions: Lấy quyền của người dùng hiện tại.
  getMyPermissions,
  // updateMyProfile: Cập nhật hồ sơ của người dùng hiện tại.
  updateMyProfile,
};
