const { connectDatabase, mongoose } = require('../config/database');
const { DoctorSchedule } = require('../models');
const { normalizeScheduleType } = require('../constants/catalogs/schedule-types');

async function migrateScheduleTypes() {
  await connectDatabase();

  const schedules = await DoctorSchedule.find({ is_deleted: false })
    .select('schedule_type')
    .lean();
  let changed = 0;

  for (const schedule of schedules) {
    const nextType = normalizeScheduleType(schedule.schedule_type);
    if (nextType !== schedule.schedule_type) {
      await DoctorSchedule.updateOne(
        { _id: schedule._id },
        { $set: { schedule_type: nextType } },
      );
      changed += 1;
    }
  }

  console.log(JSON.stringify({ checked: schedules.length, changed }));
}

migrateScheduleTypes()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
