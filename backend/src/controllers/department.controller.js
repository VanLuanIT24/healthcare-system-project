const departmentService = require('../services/department.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

async function createDepartment(req, res, next) {
  try {
    const result = await departmentService.createDepartment(req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { statusCode: 201, message: 'Tạo department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listDepartments(req, res, next) {
  try {
    const result = await departmentService.listDepartments(req.query);
    return sendSuccess(res, { message: 'Lấy danh sách department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function searchDepartments(req, res, next) {
  try {
    const result = await departmentService.searchDepartments(req.query);
    return sendSuccess(res, { message: 'Tìm kiếm department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listActiveDepartments(req, res, next) {
  try {
    const result = await departmentService.listActiveDepartments();
    return sendSuccess(res, { message: 'Lấy danh sách department active thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getDepartmentDetail(req, res, next) {
  try {
    const result = await departmentService.getDepartmentDetail(req.params.departmentId, req.auth);
    return sendSuccess(res, { message: 'Lấy chi tiết department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateDepartment(req, res, next) {
  try {
    const result = await departmentService.updateDepartment(req.params.departmentId, req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateDepartmentStatus(req, res, next) {
  try {
    const result = await departmentService.updateDepartmentStatus(req.params.departmentId, req.body.status, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật trạng thái department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function deleteDepartmentSoft(req, res, next) {
  try {
    const result = await departmentService.deleteDepartmentSoft(req.params.departmentId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Xóa mềm department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function assignDepartmentHead(req, res, next) {
  try {
    const result = await departmentService.assignDepartmentHead(req.params.departmentId, req.body.head_user_id, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Gán trưởng khoa/phòng thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function removeDepartmentHead(req, res, next) {
  try {
    const result = await departmentService.removeDepartmentHead(req.params.departmentId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Gỡ trưởng khoa/phòng thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getDepartmentHead(req, res, next) {
  try {
    const result = await departmentService.getDepartmentHead(req.params.departmentId, req.auth);
    return sendSuccess(res, { message: 'Lấy trưởng khoa/phòng thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listDepartmentStaff(req, res, next) {
  try {
    const result = await departmentService.listDepartmentStaff(req.params.departmentId, req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy danh sách staff của department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function countDepartmentStaff(req, res, next) {
  try {
    const result = await departmentService.countDepartmentStaff(req.params.departmentId, req.auth);
    return sendSuccess(res, { message: 'Đếm staff của department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function checkDepartmentInUse(req, res, next) {
  try {
    const result = await departmentService.checkDepartmentInUse(req.params.departmentId);
    return sendSuccess(res, { message: 'Kiểm tra phụ thuộc department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getDepartmentSummary(req, res, next) {
  try {
    const result = await departmentService.getDepartmentSummary(req.params.departmentId, req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy tổng quan department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function checkDepartmentHasActiveStaff(req, res, next) {
  try {
    const result = await departmentService.checkDepartmentHasActiveStaff(req.params.departmentId);
    return sendSuccess(res, { message: 'Kiểm tra staff active của department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function checkDepartmentCanBeDeactivated(req, res, next) {
  try {
    const result = await departmentService.checkDepartmentCanBeDeactivated(req.params.departmentId);
    return sendSuccess(res, { message: 'Kiểm tra khả năng inactive department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function checkDepartmentHasFutureSchedules(req, res, next) {
  try {
    const result = await departmentService.checkDepartmentHasFutureSchedules(req.params.departmentId);
    return sendSuccess(res, { message: 'Kiểm tra lịch tương lai của department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function checkDepartmentHasFutureAppointments(req, res, next) {
  try {
    const result = await departmentService.checkDepartmentHasFutureAppointments(req.params.departmentId);
    return sendSuccess(res, { message: 'Kiểm tra lịch hẹn tương lai của department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

module.exports = {
  createDepartment,
  listDepartments,
  searchDepartments,
  listActiveDepartments,
  getDepartmentDetail,
  updateDepartment,
  updateDepartmentStatus,
  deleteDepartmentSoft,
  assignDepartmentHead,
  removeDepartmentHead,
  getDepartmentHead,
  listDepartmentStaff,
  countDepartmentStaff,
  checkDepartmentInUse,
  getDepartmentSummary,
  checkDepartmentHasActiveStaff,
  checkDepartmentCanBeDeactivated,
  checkDepartmentHasFutureSchedules,
  checkDepartmentHasFutureAppointments,
};
