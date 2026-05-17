const { Admission } = require('../models');
const { ADMISSION_STATUS } = require('../constants/statuses');
const actorContext = require('../common/actors');
const inpatientService = require('../services/inpatient.service');

function systemActor() {
  return actorContext.buildSystemActor({
    serviceName: 'daily-bed-charge-job',
    permissions: ['system.full_access'],
  });
}

async function dailyBedChargePosting({ limit = 100 } = {}) {
  const defaultServiceId = process.env.DAILY_BED_CHARGE_SERVICE_ID;
  if (!defaultServiceId) {
    return { skipped: true, reason: 'DAILY_BED_CHARGE_SERVICE_ID_missing' };
  }
  const admissions = await Admission.find({
    status: { $in: [ADMISSION_STATUS.ADMITTED, ADMISSION_STATUS.TRANSFERRED, ADMISSION_STATUS.DISCHARGED] },
  }).sort({ admitted_at: 1 }).limit(Number(limit) || 100).lean();

  let posted = 0;
  const failed = [];
  for (const admission of admissions) {
    try {
      await inpatientService.createRoomBedCharge(admission._id, {
        default_service_id: defaultServiceId,
        description: 'Daily room/bed charge posting',
      }, systemActor(), {});
      posted += 1;
    } catch (error) {
      failed.push({ admission_id: String(admission._id), error: error.message });
    }
  }
  return { processed: admissions.length, posted, failed };
}

module.exports = {
  dailyBedChargePosting,
};
