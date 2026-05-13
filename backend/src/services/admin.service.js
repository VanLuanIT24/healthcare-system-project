const departmentService = require('./department.service');
const staffService = require('./staff.service');
const doctorProfileService = require('./admin/doctor-profile.service');
const systemSettingService = require('./admin/system-setting.service');
const adminDashboardService = require('./admin/admin-dashboard.service');

module.exports = {
  getAdminOverview: adminDashboardService.getAdminOverview,
  getStaffSummary: adminDashboardService.getStaffSummary,
  getRecentAdminActivities: adminDashboardService.getRecentAdminActivities,
  getStaffAuditLogs: adminDashboardService.getStaffAuditLogs,

  createStaffAccount: staffService.createStaffAccount,
  listStaffAccounts: staffService.listStaffAccounts,
  searchStaffAccounts: staffService.searchStaffAccounts,
  getStaffAccountDetail: staffService.getStaffAccountDetail,
  updateStaffAccount: staffService.updateStaffAccount,
  updateStaffAccountStatus: staffService.updateStaffAccountStatus,
  activateStaffAccount: staffService.activateStaffAccount,
  deactivateStaffAccount: staffService.deactivateStaffAccount,
  unlockStaffAccount: staffService.unlockStaffAccount,
  resetStaffPassword: staffService.resetStaffPassword,
  deleteStaffAccountSoft: staffService.deleteStaffAccountSoft,
  forceLogoutStaff: staffService.forceLogoutStaff,
  transferStaffDepartment: staffService.transferStaffDepartment,
  assignRolesToStaff: staffService.assignRolesToStaff,
  syncStaffRoles: staffService.syncStaffRoles,
  removeRolesFromStaff: staffService.removeRolesFromStaff,
  getStaffRoles: staffService.getStaffRoles,
  getStaffPermissions: staffService.getStaffPermissions,
  getStaffLoginHistory: staffService.getStaffLoginHistory,

  createDepartment: departmentService.createDepartment,
  listDepartments: departmentService.listDepartments,
  getDepartmentDetail: departmentService.getDepartmentDetail,
  updateDepartment: departmentService.updateDepartment,
  updateDepartmentStatus: departmentService.updateDepartmentStatus,
  deleteDepartmentSoft: departmentService.deleteDepartmentSoft,
  assignDepartmentHead: departmentService.assignDepartmentHead,
  getDepartmentSummary: departmentService.getDepartmentSummary,
  listDepartmentStaff: departmentService.listDepartmentStaff,

  createDoctorProfile: doctorProfileService.createDoctorProfile,
  listDoctorProfiles: doctorProfileService.listDoctorProfiles,
  getDoctorProfileDetail: doctorProfileService.getDoctorProfileDetail,
  updateDoctorProfile: doctorProfileService.updateDoctorProfile,
  updateDoctorProfileStatus: doctorProfileService.updateDoctorProfileStatus,
  deleteDoctorProfileSoft: doctorProfileService.deleteDoctorProfileSoft,
  getDoctorsList: doctorProfileService.getDoctorsList,

  createSystemSetting: systemSettingService.createSystemSetting,
  listSystemSettings: systemSettingService.listSystemSettings,
  listSystemSettingsGrouped: systemSettingService.listSystemSettingsGrouped,
  getPublicSettings: systemSettingService.getPublicSettings,
  getSystemSettingDetail: systemSettingService.getSystemSettingDetail,
  updateSystemSetting: systemSettingService.updateSystemSetting,
};
