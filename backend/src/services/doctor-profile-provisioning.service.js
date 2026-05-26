const { Department, DoctorProfile, User } = require('../models');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildLicenseNumber(user = {}) {
  const base = normalizeText(user.employee_code) || `AUTO-${String(user._id || '').slice(-8)}`;

  return base || `AUTO-${Date.now()}`;
}

async function buildUniqueLicenseNumber(user) {
  const base = buildLicenseNumber(user);
  let licenseNumber = base;
  let attempt = 0;

  // DoctorProfile has a unique license index; keep deterministic values while avoiding collisions.
  while (await DoctorProfile.findOne({
    license_number: licenseNumber,
    user_id: { $ne: user._id },
    is_deleted: false,
  }).lean()) {
    attempt += 1;
    licenseNumber = `${base}-${String(user._id).slice(-4)}${attempt > 1 ? `-${attempt}` : ''}`;
  }

  return licenseNumber;
}

async function ensureDoctorProfileForUser(userOrId, options = {}) {
  const user = typeof userOrId === 'object' && userOrId?._id
    ? userOrId
    : await User.findById(userOrId);

  if (!user || user.is_deleted || user.status !== 'active') {
    return null;
  }

  const existingProfile = await DoctorProfile.findOne({ user_id: user._id, is_deleted: false });
  if (existingProfile) {
    return existingProfile;
  }

  if (!user.department_id) {
    return null;
  }

  const department = await Department.findOne({
    _id: user.department_id,
    is_deleted: false,
    status: 'active',
  }).lean();

  if (!department) {
    return null;
  }

  return DoctorProfile.create({
    user_id: user._id,
    department_id: department._id,
    license_number: await buildUniqueLicenseNumber(user),
    specialty: department.department_name || 'Khám tổng quát',
    qualification: 'Bác sĩ',
    consultation_duration_minutes: 20,
    consultation_fee: 350000,
    public_profile_enabled: true,
    status: 'active',
    created_by: options.actorId,
    updated_by: options.actorId,
  });
}

module.exports = {
  ensureDoctorProfileForUser,
};
