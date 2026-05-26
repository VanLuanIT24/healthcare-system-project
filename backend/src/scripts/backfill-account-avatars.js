const { connectDatabase, mongoose } = require('../config/database');
const { buildInitialAvatar, normalizeText } = require('../common/avatar');
require('../models');
const {
  DoctorProfile,
  Patient,
  PatientAccount,
  User,
} = require('../models');

const dryRun = !process.argv.includes('--apply');
const force = process.argv.includes('--force');

function hasAvatar(document) {
  return Boolean(normalizeText(document?.avatar_url));
}

function nonDeletedFilter() {
  return { is_deleted: { $ne: true } };
}

function missingAvatarFilter() {
  return {
    ...nonDeletedFilter(),
    $or: [
      { avatar_url: { $exists: false } },
      { avatar_url: null },
      { avatar_url: '' },
      { avatar_url: /^\s*$/ },
    ],
  };
}

function shouldSetAvatar(document) {
  return force || !hasAvatar(document);
}

async function countMissingAvatars(Model) {
  return Model.countDocuments(missingAvatarFilter());
}

async function applyAvatarUpdates(Model, collection, documents, resolveAvatar) {
  const updatedAt = new Date();
  const operations = [];
  const sample = [];

  for (const document of documents) {
    if (!shouldSetAvatar(document)) {
      continue;
    }

    const avatar = resolveAvatar(document);
    operations.push({
      updateOne: {
        filter: { _id: document._id },
        update: {
          $set: {
            avatar_url: avatar,
            updated_at: updatedAt,
          },
        },
      },
    });

    if (sample.length < 5) {
      sample.push(String(document._id));
    }
  }

  if (!dryRun && operations.length) {
    await Model.bulkWrite(operations, { ordered: false });
  }

  return {
    collection,
    scanned: documents.length,
    changed: operations.length,
    sample,
  };
}

function userLabel(user) {
  return normalizeText(user.full_name || user.username || user.email || user.employee_code || user._id);
}

function patientAccountLabel(account, patientById) {
  const patient = patientById.get(String(account.patient_id));

  return normalizeText(
    patient?.full_name ||
      account.username ||
      account.email ||
      account.phone ||
      patient?.patient_code ||
      account._id,
  );
}

async function main() {
  await connectDatabase();

  const [users, patientAccounts, doctorProfiles] = await Promise.all([
    User.find(nonDeletedFilter()).select('_id full_name username email employee_code avatar_url').lean(),
    PatientAccount.find(nonDeletedFilter()).select('_id patient_id username email phone avatar_url').lean(),
    DoctorProfile.find(nonDeletedFilter()).select('_id user_id specialty avatar_url').lean(),
  ]);

  const patientIds = patientAccounts.map((account) => account.patient_id).filter(Boolean);
  const patients = await Patient.find({ _id: { $in: patientIds }, is_deleted: { $ne: true } })
    .select('_id full_name patient_code')
    .lean();
  const patientById = new Map(patients.map((patient) => [String(patient._id), patient]));
  const userAvatarById = new Map();

  const userResult = await applyAvatarUpdates(User, 'users', users, (user) => {
    const avatar = !force && hasAvatar(user)
      ? normalizeText(user.avatar_url)
      : buildInitialAvatar({ label: userLabel(user), seed: user._id, fallbackInitials: 'NV' });
    userAvatarById.set(String(user._id), avatar);
    return avatar;
  });

  for (const user of users) {
    if (!userAvatarById.has(String(user._id))) {
      userAvatarById.set(String(user._id), normalizeText(user.avatar_url));
    }
  }

  const patientAccountResult = await applyAvatarUpdates(
    PatientAccount,
    'patient_accounts',
    patientAccounts,
    (account) => buildInitialAvatar({
      label: patientAccountLabel(account, patientById),
      seed: account.patient_id || account._id,
      fallbackInitials: 'BN',
    }),
  );

  const doctorProfileResult = await applyAvatarUpdates(
    DoctorProfile,
    'doctor_profiles',
    doctorProfiles,
    (profile) => userAvatarById.get(String(profile.user_id)) ||
      buildInitialAvatar({
        label: profile.specialty || profile.user_id || profile._id,
        seed: profile.user_id || profile._id,
        fallbackInitials: 'BS',
      }),
  );

  const missingAfter = dryRun
    ? null
    : {
      users: await countMissingAvatars(User),
      patient_accounts: await countMissingAvatars(PatientAccount),
      doctor_profiles: await countMissingAvatars(DoctorProfile),
    };

  console.log(JSON.stringify({
    success: true,
    mode: dryRun ? 'dry_run' : 'apply',
    force,
    results: [userResult, patientAccountResult, doctorProfileResult],
    missing_after: missingAfter,
  }, null, 2));

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
