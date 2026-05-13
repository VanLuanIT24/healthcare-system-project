const { DoctorProfile, SystemSetting } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  doctorProfileRepository: DoctorProfile,
  systemSettingRepository: SystemSetting,
});
