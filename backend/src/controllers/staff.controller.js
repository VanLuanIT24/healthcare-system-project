const staffService = require('../services/staff.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

async function createStaffAccount(req, res, next) {
  try {
    const result = await staffService.createStaffAccount(req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { statusCode: 201, message: 'Tạo tài khoản staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listStaffAccounts(req, res, next) {
  try {
    const result = await staffService.listStaffAccounts(req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy danh sách staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function searchStaffAccounts(req, res, next) {
  try {
    const result = await staffService.searchStaffAccounts(req.query, req.auth);
    return sendSuccess(res, { message: 'Tìm kiếm staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function filterStaffAccounts(req, res, next) {
  try {
    const result = await staffService.filterStaffAccounts(req.query, req.auth);
    return sendSuccess(res, { message: 'Lọc staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffAccountDetail(req, res, next) {
  try {
    const result = await staffService.getStaffAccountDetail(req.params.userId, req.auth);
    return sendSuccess(res, { message: 'Lấy chi tiết staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateStaffAccount(req, res, next) {
  try {
    const result = await staffService.updateStaffAccount(req.params.userId, req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateStaffAccountStatus(req, res, next) {
  try {
    const result = await staffService.updateStaffAccountStatus(req.params.userId, req.body.status, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật trạng thái staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function activateStaffAccount(req, res, next) {
  try {
    const result = await staffService.activateStaffAccount(req.params.userId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Kích hoạt tài khoản staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function deactivateStaffAccount(req, res, next) {
  try {
    const result = await staffService.deactivateStaffAccount(req.params.userId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Vô hiệu hóa tài khoản staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function unlockStaffAccount(req, res, next) {
  try {
    const result = await staffService.unlockStaffAccount(req.params.userId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Mở khóa tài khoản staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function resetStaffPassword(req, res, next) {
  try {
    const result = await staffService.resetStaffPassword(req.params.userId, req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Đặt lại mật khẩu staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function deleteStaffAccountSoft(req, res, next) {
  try {
    const result = await staffService.deleteStaffAccountSoft(req.params.userId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Xóa mềm tài khoản staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function assignRolesToStaff(req, res, next) {
  try {
    const result = await staffService.assignRolesToStaff(req.params.userId, req.body.role_codes || [], req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Gán role cho staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function removeRolesFromStaff(req, res, next) {
  try {
    const result = await staffService.removeRolesFromStaff(req.params.userId, req.body.role_codes || [], req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Gỡ role khỏi staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function syncStaffRoles(req, res, next) {
  try {
    const result = await staffService.syncStaffRoles(req.params.userId, req.body.role_codes || [], req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Đồng bộ role cho staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffRoles(req, res, next) {
  try {
    const result = await staffService.getStaffRoles(req.params.userId, req.auth);
    return sendSuccess(res, { message: 'Lấy role của staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffPermissions(req, res, next) {
  try {
    const result = await staffService.getStaffPermissions(req.params.userId, req.auth);
    return sendSuccess(res, { message: 'Lấy permission của staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function checkStaffPermission(req, res, next) {
  try {
    const result = await staffService.checkStaffPermission(req.params.userId, req.query.permission_code, req.auth);
    return sendSuccess(res, { message: 'Kiểm tra permission của staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getUsersByRole(req, res, next) {
  try {
    const result = await staffService.getUsersByRole(req.params.roleId, req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy danh sách staff theo role thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffByDepartment(req, res, next) {
  try {
    const result = await staffService.getStaffByDepartment(req.params.departmentId, req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy danh sách staff theo department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getDoctorsList(req, res, next) {
  try {
    const result = await staffService.getDoctorsList(req.query);
    return sendSuccess(res, { message: 'Lấy danh sách bác sĩ thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getAssignableStaffRoles(req, res, next) {
  try {
    const result = await staffService.getAssignableStaffRoles(req.auth);
    return sendSuccess(res, { message: 'Lấy danh sách role có thể gán thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffSummary(req, res, next) {
  try {
    const result = await staffService.getStaffSummary(req.auth);
    return sendSuccess(res, { message: 'Lấy tổng quan staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffLoginHistory(req, res, next) {
  try {
    const result = await staffService.getStaffLoginHistory(req.params.userId, req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy lịch sử đăng nhập của staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffAuditLogs(req, res, next) {
  try {
    const result = await staffService.getStaffAuditLogs(req.params.userId, req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy audit log của staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function forceLogoutStaff(req, res, next) {
  try {
    const result = await staffService.forceLogoutStaff(req.params.userId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Buộc đăng xuất staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
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
