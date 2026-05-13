const adminService = require('../services/admin.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

function pickRoleCodes(body = {}) {
  return body.role_codes || body.roleIds || body.role_ids || [];
}

async function getAdminOverview(req, res, next) {
  try {
    const result = await adminService.getAdminOverview(req.auth);
    return sendSuccess(res, { message: 'Lấy tổng quan admin thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffSummary(req, res, next) {
  try {
    const result = await adminService.getStaffSummary(req.auth);
    return sendSuccess(res, { message: 'Lấy tổng quan nhân sự thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getRecentAdminActivities(req, res, next) {
  try {
    const result = await adminService.getRecentAdminActivities(req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy hoạt động admin gần đây thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function createStaffAccount(req, res, next) {
  try {
    const result = await adminService.createStaffAccount(req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { statusCode: 201, message: 'Tạo tài khoản staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listStaffAccounts(req, res, next) {
  try {
    const result = await adminService.listStaffAccounts(req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy danh sách staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function searchStaffAccounts(req, res, next) {
  try {
    const result = await adminService.searchStaffAccounts(req.query, req.auth);
    return sendSuccess(res, { message: 'Tìm staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffAccountDetail(req, res, next) {
  try {
    const result = await adminService.getStaffAccountDetail(req.params.userId, req.auth);
    return sendSuccess(res, { message: 'Lấy chi tiết staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateStaffAccount(req, res, next) {
  try {
    const result = await adminService.updateStaffAccount(req.params.userId, req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateStaffAccountStatus(req, res, next) {
  try {
    const result = await adminService.updateStaffAccountStatus(req.params.userId, req.body.status, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật trạng thái staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function activateStaffAccount(req, res, next) {
  try {
    const result = await adminService.activateStaffAccount(req.params.userId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Kích hoạt staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function deactivateStaffAccount(req, res, next) {
  try {
    const result = await adminService.deactivateStaffAccount(req.params.userId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Vô hiệu hóa staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function unlockStaffAccount(req, res, next) {
  try {
    const result = await adminService.unlockStaffAccount(req.params.userId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Mở khóa staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function resetStaffPassword(req, res, next) {
  try {
    const result = await adminService.resetStaffPassword(req.params.userId, req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Reset mật khẩu staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function deleteStaffAccountSoft(req, res, next) {
  try {
    const result = await adminService.deleteStaffAccountSoft(req.params.userId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Xóa mềm staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function forceLogoutStaff(req, res, next) {
  try {
    const result = await adminService.forceLogoutStaff(req.params.userId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Buộc đăng xuất staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function transferStaffDepartment(req, res, next) {
  try {
    const result = await adminService.transferStaffDepartment(
      req.params.userId,
      req.body.department_id,
      req.auth,
      requestMeta(req),
    );
    return sendSuccess(res, { message: 'Chuyển department cho staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function assignRolesToStaff(req, res, next) {
  try {
    const result = await adminService.assignRolesToStaff(req.params.userId, pickRoleCodes(req.body), req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Gán role cho staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function syncStaffRoles(req, res, next) {
  try {
    const result = await adminService.syncStaffRoles(req.params.userId, pickRoleCodes(req.body), req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Đồng bộ role staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function removeRolesFromStaff(req, res, next) {
  try {
    const result = await adminService.removeRolesFromStaff(req.params.userId, pickRoleCodes(req.body), req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Gỡ role staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffRoles(req, res, next) {
  try {
    const result = await adminService.getStaffRoles(req.params.userId, req.auth);
    return sendSuccess(res, { message: 'Lấy role staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffPermissions(req, res, next) {
  try {
    const result = await adminService.getStaffPermissions(req.params.userId, req.auth);
    return sendSuccess(res, { message: 'Lấy permission staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffLoginHistory(req, res, next) {
  try {
    const result = await adminService.getStaffLoginHistory(req.params.userId, req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy login history staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getStaffAuditLogs(req, res, next) {
  try {
    const result = await adminService.getStaffAuditLogs(req.params.userId, req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy audit logs staff thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function createDepartment(req, res, next) {
  try {
    const result = await adminService.createDepartment(req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { statusCode: 201, message: 'Tạo department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listDepartments(req, res, next) {
  try {
    const result = await adminService.listDepartments(req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy danh sách department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getDepartmentDetail(req, res, next) {
  try {
    const result = await adminService.getDepartmentDetail(req.params.departmentId, req.auth);
    return sendSuccess(res, { message: 'Lấy chi tiết department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateDepartment(req, res, next) {
  try {
    const result = await adminService.updateDepartment(req.params.departmentId, req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateDepartmentStatus(req, res, next) {
  try {
    const result = await adminService.updateDepartmentStatus(req.params.departmentId, req.body.status, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật trạng thái department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function deleteDepartmentSoft(req, res, next) {
  try {
    const result = await adminService.deleteDepartmentSoft(req.params.departmentId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Xóa mềm department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function assignDepartmentHead(req, res, next) {
  try {
    const result = await adminService.assignDepartmentHead(req.params.departmentId, req.body.head_user_id, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Gán trưởng khoa/phòng thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getDepartmentSummary(req, res, next) {
  try {
    const result = await adminService.getDepartmentSummary(req.params.departmentId, req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy summary department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listDepartmentStaff(req, res, next) {
  try {
    const result = await adminService.listDepartmentStaff(req.params.departmentId, req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy staff trong department thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function createDoctorProfile(req, res, next) {
  try {
    const result = await adminService.createDoctorProfile(req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { statusCode: 201, message: 'Tạo doctor profile thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listDoctorProfiles(req, res, next) {
  try {
    const result = await adminService.listDoctorProfiles(req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy danh sách doctor profile thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getDoctorProfileDetail(req, res, next) {
  try {
    const result = await adminService.getDoctorProfileDetail(req.params.profileId, req.auth);
    return sendSuccess(res, { message: 'Lấy chi tiết doctor profile thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateDoctorProfile(req, res, next) {
  try {
    const result = await adminService.updateDoctorProfile(req.params.profileId, req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật doctor profile thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateDoctorProfileStatus(req, res, next) {
  try {
    const result = await adminService.updateDoctorProfileStatus(req.params.profileId, req.body.status, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật trạng thái doctor profile thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function deleteDoctorProfileSoft(req, res, next) {
  try {
    const result = await adminService.deleteDoctorProfileSoft(req.params.profileId, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Xóa mềm doctor profile thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getDoctorsList(req, res, next) {
  try {
    const result = await adminService.getDoctorsList(req.auth ? req.query : { ...req.query, public: 'true' });
    return sendSuccess(res, { message: 'Lấy danh sách bác sĩ thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function createSystemSetting(req, res, next) {
  try {
    const result = await adminService.createSystemSetting(req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { statusCode: 201, message: 'Tạo system setting thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listSystemSettings(req, res, next) {
  try {
    const result = await adminService.listSystemSettings(req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy danh sách system setting thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function listSystemSettingsGrouped(req, res, next) {
  try {
    const result = await adminService.listSystemSettingsGrouped(req.query, req.auth);
    return sendSuccess(res, { message: 'Lấy system setting theo nhóm thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getPublicSettings(req, res, next) {
  try {
    const result = await adminService.getPublicSettings(req.query);
    return sendSuccess(res, { message: 'Lấy public settings thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function getSystemSettingDetail(req, res, next) {
  try {
    const result = await adminService.getSystemSettingDetail(req.params.settingKey, req.auth);
    return sendSuccess(res, { message: 'Lấy chi tiết system setting thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

async function updateSystemSetting(req, res, next) {
  try {
    const result = await adminService.updateSystemSetting(req.params.settingKey, req.body, req.auth, requestMeta(req));
    return sendSuccess(res, { message: 'Cập nhật system setting thành công.', data: result });
  } catch (error) {
    return next(markLegacyControllerError(error));
  }
}

module.exports = {
  getAdminOverview,
  getStaffSummary,
  getRecentAdminActivities,
  createStaffAccount,
  listStaffAccounts,
  searchStaffAccounts,
  getStaffAccountDetail,
  updateStaffAccount,
  updateStaffAccountStatus,
  activateStaffAccount,
  deactivateStaffAccount,
  unlockStaffAccount,
  resetStaffPassword,
  deleteStaffAccountSoft,
  forceLogoutStaff,
  transferStaffDepartment,
  assignRolesToStaff,
  syncStaffRoles,
  removeRolesFromStaff,
  getStaffRoles,
  getStaffPermissions,
  getStaffLoginHistory,
  getStaffAuditLogs,
  createDepartment,
  listDepartments,
  getDepartmentDetail,
  updateDepartment,
  updateDepartmentStatus,
  deleteDepartmentSoft,
  assignDepartmentHead,
  getDepartmentSummary,
  listDepartmentStaff,
  createDoctorProfile,
  listDoctorProfiles,
  getDoctorProfileDetail,
  updateDoctorProfile,
  updateDoctorProfileStatus,
  deleteDoctorProfileSoft,
  getDoctorsList,
  createSystemSetting,
  listSystemSettings,
  listSystemSettingsGrouped,
  getPublicSettings,
  getSystemSettingDetail,
  updateSystemSetting,
};
