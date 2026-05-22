const facilityAdminService = require('../services/facility-admin.service');
const { markLegacyControllerError, sendSuccess } = require('../common/controllers');

async function getOverview(req, res, next) {
  try {
    const result = await facilityAdminService.getFacilityOverview(req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy tổng quan cơ sở vận hành thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function createDepartmentWithDefaults(req, res, next) {
  try {
    const result = await facilityAdminService.createDepartmentWithDefaults(req.body, req.auth, { request_id: req.id });
    return sendSuccess(res, { statusCode: 201, message: 'Tạo khoa/phòng kèm cấu hình mặc định thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getDepartmentOperationsBoard(req, res, next) {
  try {
    const result = await facilityAdminService.buildDepartmentOperationsBoard(req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy operations board khoa/phòng thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getDepartmentOperationalProfile(req, res, next) {
  try {
    const result = await facilityAdminService.getDepartmentOperationalProfile(req.params.departmentId, req.auth);
    return sendSuccess(res, { message: 'Lấy operational profile khoa/phòng thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getResourceBoard(req, res, next) {
  try {
    const result = await facilityAdminService.getFacilityResourceBoard(req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy resource board cơ sở vận hành thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getOperationalStatus(req, res, next) {
  try {
    const result = await facilityAdminService.getOperationalStatus(req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy trạng thái hoạt động cơ sở vận hành thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

module.exports = {
  createDepartmentWithDefaults,
  getOverview,
  getDepartmentOperationsBoard,
  getDepartmentOperationalProfile,
  getResourceBoard,
  getOperationalStatus,
};
