const staffService = require('../services/staff.service');
const { errorResponse, successResponse } = require('../utils/http-response');

function requestMeta(req) {
  return {
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  };
}

async function createStaffAccount(req, res) {
  try {
    const result = await staffService.createStaffAccount(req.body, req.auth, requestMeta(req));
    return successResponse(res, { statusCode: 201, message: 'Tạo tài khoản staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function listStaffAccounts(req, res) {
  try {
    const result = await staffService.listStaffAccounts(req.query);
    return successResponse(res, { message: 'Lấy danh sách staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function searchStaffAccounts(req, res) {
  try {
    const result = await staffService.searchStaffAccounts(req.query);
    return successResponse(res, { message: 'Tìm kiếm staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function filterStaffAccounts(req, res) {
  try {
    const result = await staffService.filterStaffAccounts(req.query);
    return successResponse(res, { message: 'Lọc staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getStaffAccountDetail(req, res) {
  try {
    const result = await staffService.getStaffAccountDetail(req.params.userId);
    return successResponse(res, { message: 'Lấy chi tiết staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function updateStaffAccount(req, res) {
  try {
    const result = await staffService.updateStaffAccount(req.params.userId, req.body, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Cập nhật staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function updateStaffAccountStatus(req, res) {
  try {
    const result = await staffService.updateStaffAccountStatus(req.params.userId, req.body.status, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Cập nhật trạng thái staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function activateStaffAccount(req, res) {
  try {
    const result = await staffService.activateStaffAccount(req.params.userId, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Kích hoạt tài khoản staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function deactivateStaffAccount(req, res) {
  try {
    const result = await staffService.deactivateStaffAccount(req.params.userId, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Vô hiệu hóa tài khoản staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function unlockStaffAccount(req, res) {
  try {
    const result = await staffService.unlockStaffAccount(req.params.userId, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Mở khóa tài khoản staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function resetStaffPassword(req, res) {
  try {
    const result = await staffService.resetStaffPassword(req.params.userId, req.body, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Đặt lại mật khẩu staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function deleteStaffAccountSoft(req, res) {
  try {
    const result = await staffService.deleteStaffAccountSoft(req.params.userId, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Xóa mềm tài khoản staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function assignRolesToStaff(req, res) {
  try {
    const result = await staffService.assignRolesToStaff(req.params.userId, req.body.role_codes || [], req.auth, requestMeta(req));
    return successResponse(res, { message: 'Gán role cho staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function removeRolesFromStaff(req, res) {
  try {
    const result = await staffService.removeRolesFromStaff(req.params.userId, req.body.role_codes || [], req.auth, requestMeta(req));
    return successResponse(res, { message: 'Gỡ role khỏi staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function syncStaffRoles(req, res) {
  try {
    const result = await staffService.syncStaffRoles(req.params.userId, req.body.role_codes || [], req.auth, requestMeta(req));
    return successResponse(res, { message: 'Đồng bộ role cho staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getStaffRoles(req, res) {
  try {
    const result = await staffService.getStaffRoles(req.params.userId);
    return successResponse(res, { message: 'Lấy role của staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getStaffPermissions(req, res) {
  try {
    const result = await staffService.getStaffPermissions(req.params.userId);
    return successResponse(res, { message: 'Lấy permission của staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function checkStaffPermission(req, res) {
  try {
    const result = await staffService.checkStaffPermission(req.params.userId, req.query.permission_code);
    return successResponse(res, { message: 'Kiểm tra permission của staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getUsersByRole(req, res) {
  try {
    const result = await staffService.getUsersByRole(req.params.roleId, req.query);
    return successResponse(res, { message: 'Lấy danh sách staff theo role thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getStaffByDepartment(req, res) {
  try {
    const result = await staffService.getStaffByDepartment(req.params.departmentId, req.query);
    return successResponse(res, { message: 'Lấy danh sách staff theo department thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getDoctorsList(req, res) {
  try {
    const result = await staffService.getDoctorsList(req.query);
    return successResponse(res, { message: 'Lấy danh sách bác sĩ thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getAssignableStaffRoles(req, res) {
  try {
    const result = await staffService.getAssignableStaffRoles(req.auth);
    return successResponse(res, { message: 'Lấy danh sách role có thể gán thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getStaffSummary(req, res) {
  try {
    const result = await staffService.getStaffSummary();
    return successResponse(res, { message: 'Lấy tổng quan staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getStaffLoginHistory(req, res) {
  try {
    const result = await staffService.getStaffLoginHistory(req.params.userId, req.query);
    return successResponse(res, { message: 'Lấy lịch sử đăng nhập của staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getStaffAuditLogs(req, res) {
  try {
    const result = await staffService.getStaffAuditLogs(req.params.userId, req.query);
    return successResponse(res, { message: 'Lấy audit log của staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function forceLogoutStaff(req, res) {
  try {
    const result = await staffService.forceLogoutStaff(req.params.userId, req.auth, requestMeta(req));
    return successResponse(res, { message: 'Buộc đăng xuất staff thành công.', data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

module.exports = {
  createStaffAccount,
  listStaffAccounts,
  searchStaffAccounts,
  filterStaffAccounts,
  getStaffAccountDetail,
  updateStaffAccount,
  updateStaffAccountStatus,
  activateStaffAccount,
  deactivateStaffAccount,
  unlockStaffAccount,
  resetStaffPassword,
  deleteStaffAccountSoft,
  assignRolesToStaff,
  removeRolesFromStaff,
  syncStaffRoles,
  getStaffRoles,
  getStaffPermissions,
  checkStaffPermission,
  getUsersByRole,
  getStaffByDepartment,
  getDoctorsList,
  getAssignableStaffRoles,
  getStaffSummary,
  getStaffLoginHistory,
  getStaffAuditLogs,
  forceLogoutStaff,
};
