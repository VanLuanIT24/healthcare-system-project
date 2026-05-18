const doctorProfileSelfService = require('../services/doctor-profile-self.service');
const { markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

async function getMyDoctorProfile(req, res, next) {
  try {
    const result = await doctorProfileSelfService.getMyDoctorProfile(req.auth);
    return sendSuccess(res, { message: 'Lấy hồ sơ bác sĩ đang đăng nhập thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateMyDoctorProfile(req, res, next) {
  try {
    const result = await doctorProfileSelfService.updateMyDoctorProfile(req.auth, req.body, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật hồ sơ bác sĩ đang đăng nhập thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

module.exports = {
  getMyDoctorProfile,
  updateMyDoctorProfile,
};
