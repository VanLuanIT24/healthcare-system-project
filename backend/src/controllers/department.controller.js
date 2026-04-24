const departmentService = require('../services/department.service');
const { errorResponse, successResponse } = require('../utils/http-response');

function requestMeta(req) {
  return {
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  };
}

async function createDepartment(req, res) {
  try {
    const result = await departmentService.createDepartment(req.body, req.auth, requestMeta(req));
    return successResponse(res, { statusCode: 201, message: 'Tạo department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function listDepartments(req, res) {
  try {
    const result = await departmentService.listDepartments(req.query);
    return successResponse(res, { message: 'Lấy danh sách department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function searchDepartments(req, res) {
  try {
    const result = await departmentService.searchDepartments(req.query);
    return successResponse(res, { message: 'Tìm kiếm department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function listActiveDepartments(req, res) {
  try {
    const result = await departmentService.listActiveDepartments();
    return successResponse(res, { message: 'Lấy danh sách department active thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getDepartmentDetail(req, res) {
  try {
    const result = await departmentService.getDepartmentDetail(req.params.departmentId);
    return successResponse(res, { message: 'Lấy chi tiết department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function updateDepartment(req, res) {
  try {
    const result = await departmentService.updateDepartment(req.params.departmentId, req.body, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Cập nhật department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function updateDepartmentStatus(req, res) {
  try {
    const result = await departmentService.updateDepartmentStatus(req.params.departmentId, req.body.status, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Cập nhật trạng thái department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function deleteDepartmentSoft(req, res) {
  try {
    const result = await departmentService.deleteDepartmentSoft(req.params.departmentId, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Xóa mềm department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function assignDepartmentHead(req, res) {
  try {
    const result = await departmentService.assignDepartmentHead(req.params.departmentId, req.body.head_user_id, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Gán trưởng khoa/phòng thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function removeDepartmentHead(req, res) {
  try {
    const result = await departmentService.removeDepartmentHead(req.params.departmentId, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Gỡ trưởng khoa/phòng thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getDepartmentHead(req, res) {
  try {
    const result = await departmentService.getDepartmentHead(req.params.departmentId);
    return successResponse(res, { message: 'Lấy trưởng khoa/phòng thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function listDepartmentStaff(req, res) {
  try {
    const result = await departmentService.listDepartmentStaff(req.params.departmentId, req.query);
    return successResponse(res, { message: 'Lấy danh sách staff của department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function countDepartmentStaff(req, res) {
  try {
    const result = await departmentService.countDepartmentStaff(req.params.departmentId);
    return successResponse(res, { message: 'Đếm staff của department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function checkDepartmentInUse(req, res) {
  try {
    const result = await departmentService.checkDepartmentInUse(req.params.departmentId);
    return successResponse(res, { message: 'Kiểm tra phụ thuộc department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getDepartmentSummary(req, res) {
  try {
    const result = await departmentService.getDepartmentSummary(req.params.departmentId, req.query);
    return successResponse(res, { message: 'Lấy tổng quan department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function checkDepartmentHasActiveStaff(req, res) {
  try {
    const result = await departmentService.checkDepartmentHasActiveStaff(req.params.departmentId);
    return successResponse(res, { message: 'Kiểm tra staff active của department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function checkDepartmentCanBeDeactivated(req, res) {
  try {
    const result = await departmentService.checkDepartmentCanBeDeactivated(req.params.departmentId);
    return successResponse(res, { message: 'Kiểm tra khả năng inactive department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function checkDepartmentHasFutureSchedules(req, res) {
  try {
    const result = await departmentService.checkDepartmentHasFutureSchedules(req.params.departmentId);
    return successResponse(res, { message: 'Kiểm tra lịch tương lai của department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function checkDepartmentHasFutureAppointments(req, res) {
  try {
    const result = await departmentService.checkDepartmentHasFutureAppointments(req.params.departmentId);
    return successResponse(res, { message: 'Kiểm tra lịch hẹn tương lai của department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
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
