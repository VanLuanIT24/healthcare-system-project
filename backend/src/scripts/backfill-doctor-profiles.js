const { connectDatabase, mongoose } = require('../config/database');
require('../models');
const { Role, User, UserRole, DoctorProfile } = require('../models');
const { ensureDoctorProfileForUser } = require('../services/doctor-profile-provisioning.service');

const dryRun = !process.argv.includes('--apply');

async function main() {
  await connectDatabase();

  const doctorRole = await Role.findOne({ role_code: 'doctor', is_deleted: false }).lean();
  if (!doctorRole) {
    console.log(JSON.stringify({ success: true, mode: dryRun ? 'dry_run' : 'apply', missing: 0, created: 0 }, null, 2));
    await mongoose.connection.close();
    return;
  }

  const assignments = await UserRole.find({ role_id: doctorRole._id, is_active: true }).lean();
  const users = assignments.length
    ? await User.find({
      _id: { $in: assignments.map((item) => item.user_id) },
      is_deleted: false,
      status: 'active',
    }).select('_id full_name employee_code email department_id status').lean()
    : [];
  const profileUserIds = new Set(
    (await DoctorProfile.find({
      user_id: { $in: users.map((user) => user._id) },
      is_deleted: false,
    }).select('user_id').lean()).map((profile) => String(profile.user_id)),
  );
  const missingUsers = users.filter((user) => !profileUserIds.has(String(user._id)));
  const created = [];

  if (!dryRun) {
    for (const user of missingUsers) {
      // eslint-disable-next-line no-await-in-loop
      const profile = await ensureDoctorProfileForUser(user);
      if (profile) {
        created.push({
          user_id: String(user._id),
          doctor_profile_id: String(profile._id),
          full_name: user.full_name,
        });
      }
    }
  }

  console.log(JSON.stringify({
    success: true,
    mode: dryRun ? 'dry_run' : 'apply',
    doctor_role_users: users.length,
    missing: missingUsers.length,
    created: created.length,
    missing_users: dryRun
      ? missingUsers.map((user) => ({
        user_id: String(user._id),
        full_name: user.full_name,
        employee_code: user.employee_code,
      }))
      : undefined,
    created_profiles: dryRun ? undefined : created,
  }, null, 2));

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
