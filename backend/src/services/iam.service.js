const roleService = require('./iam/role.service');
const permissionService = require('./iam/permission.service');
const rolePermissionService = require('./iam/role-permission.service');
const userRoleService = require('./iam/user-role.service');
const accessContextService = require('./iam/access-context.service');
const seedService = require('./iam/iam-seed.service');
const controlPlaneService = require('./iam/iam-control-plane.service');
const denyPolicyService = require('./iam/deny-policy.service');

module.exports = {
  // validateRoleAssignable: Kiểm tra tính hợp lệ của điều kiện gán vai trò.
  validateRoleAssignable: userRoleService.validateRoleAssignable,
  // validatePermissionAssignable: Kiểm tra tính hợp lệ của điều kiện gán quyền.
  validatePermissionAssignable: rolePermissionService.validatePermissionAssignable,

  // rebuildUserPermissionCache: Dựng lại cache quyền hiệu lực của người dùng.
  rebuildUserPermissionCache: accessContextService.rebuildUserPermissionCache,
  // buildStaffPermissionContext: Xây dựng ngữ cảnh quyền của nhân sự.
  buildStaffPermissionContext: accessContextService.buildStaffPermissionContext,
  // hasPermission: Kiểm tra người dùng/actor có một quyền cụ thể hay không.
  hasPermission: accessContextService.hasPermission,
  // hasAnyPermission: Kiểm tra người dùng/actor có ít nhất một quyền trong danh sách yêu cầu hay không.
  hasAnyPermission: accessContextService.hasAnyPermission,
  // hasAllPermissions: Kiểm tra người dùng/actor có đầy đủ tất cả quyền được yêu cầu hay không.
  hasAllPermissions: accessContextService.hasAllPermissions,
  // hasRole: Kiểm tra có vai trò.
  hasRole: accessContextService.hasRole,

  // createRole: Tạo vai trò.
  createRole: roleService.createRole,
  // listRoles: Liệt kê vai trò.
  listRoles: roleService.listRoles,
  // getRoleDetail: Lấy chi tiết vai trò.
  getRoleDetail: roleService.getRoleDetail,
  // updateRole: Cập nhật vai trò.
  updateRole: roleService.updateRole,
  // updateRoleStatus: Cập nhật trạng thái vai trò.
  updateRoleStatus: roleService.updateRoleStatus,
  // deleteRoleSoft: Xóa mềm vai trò.
  deleteRoleSoft: roleService.deleteRoleSoft,
  // getRoleUsageSummary: Lấy thống kê mức sử dụng vai trò.
  getRoleUsageSummary: roleService.getRoleUsageSummary,
  // getUsersByRole: Lấy người dùng theo vai trò.
  getUsersByRole: roleService.getUsersByRole,

  // createPermission: Tạo quyền.
  createPermission: permissionService.createPermission,
  // listPermissions: Liệt kê quyền.
  listPermissions: permissionService.listPermissions,
  // listPermissionsGrouped: Liệt kê quyền được nhóm theo phân hệ.
  listPermissionsGrouped: permissionService.listPermissionsGrouped,
  // getPermissionDetail: Lấy chi tiết quyền.
  getPermissionDetail: permissionService.getPermissionDetail,
  // updatePermission: Cập nhật quyền.
  updatePermission: permissionService.updatePermission,
  // deletePermissionSoft: Xóa mềm quyền.
  deletePermissionSoft: permissionService.deletePermissionSoft,
  // getPermissionUsageSummary: Lấy thống kê mức sử dụng quyền.
  getPermissionUsageSummary: permissionService.getPermissionUsageSummary,

  // getRolePermissions: Lấy quyền của vai trò.
  getRolePermissions: rolePermissionService.getRolePermissions,
  // assignPermissionsToRole: Gán danh sách quyền cho vai trò.
  assignPermissionsToRole: rolePermissionService.assignPermissionsToRole,
  // syncRolePermissions: Đồng bộ quyền của vai trò.
  syncRolePermissions: rolePermissionService.syncRolePermissions,
  // removePermissionsFromRole: Gỡ/xóa quyền từ vai trò.
  removePermissionsFromRole: rolePermissionService.removePermissionsFromRole,

  // syncStaffRoles: Đồng bộ vai trò của nhân sự.
  syncStaffRoles: userRoleService.syncStaffRoles,
  // removeRolesFromStaff: Gỡ/xóa vai trò từ nhân sự.
  removeRolesFromStaff: userRoleService.removeRolesFromStaff,
  // getStaffRoles: Lấy vai trò của nhân sự.
  getStaffRoles: userRoleService.getStaffRoles,
  // getStaffPermissions: Lấy quyền của nhân sự.
  getStaffPermissions: userRoleService.getStaffPermissions,
  // checkStaffPermission: Kiểm tra quyền của nhân sự.
  checkStaffPermission: accessContextService.checkStaffPermission,

  // seedSystemAccess: Khởi tạo dữ liệu hạt giống cho quyền truy cập hệ thống mặc định.
  seedSystemAccess: seedService.seedSystemAccess,

  // getIamOverview: Lấy tổng quan IAM control plane.
  getIamOverview: controlPlaneService.getIamOverview,
  // getIamMatrix: Lấy ma trận role-permission.
  getIamMatrix: controlPlaneService.getIamMatrix,
  // previewRolePermissionChange: Preview tác động đổi permission của role.
  previewRolePermissionChange: controlPlaneService.previewRolePermissionChange,
  // applyRolePermissionMatrix: Áp dụng thay đổi role-permission qua matrix.
  applyRolePermissionMatrix: controlPlaneService.applyRolePermissionMatrix,
  // getStaffEffectivePermissions: Lấy quyền hiệu lực kèm nguồn cấp theo user.
  getStaffEffectivePermissions: controlPlaneService.getStaffEffectivePermissions,
  // previewStaffRoleChange: Preview tác động đổi role user.
  previewStaffRoleChange: controlPlaneService.previewStaffRoleChange,
  // explainAccess: Giải thích quyết định allow/deny.
  explainAccess: controlPlaneService.explainAccess,
  // getCacheStatus: Lấy trạng thái cache quyền.
  getCacheStatus: controlPlaneService.getCacheStatus,
  // rebuildUserPermissionContext: Rebuild context quyền user.
  rebuildUserPermissionContext: controlPlaneService.rebuildUserPermissionContext,
  // rebuildRolePermissionContext: Rebuild context quyền theo role.
  rebuildRolePermissionContext: controlPlaneService.rebuildRolePermissionContext,
  // rebuildAllPermissionContexts: Rebuild context quyền toàn hệ thống.
  rebuildAllPermissionContexts: controlPlaneService.rebuildAllPermissionContexts,
  // seedSystemAccessDryRun: Preview seed system access.
  seedSystemAccessDryRun: controlPlaneService.seedSystemAccessDryRun,
  // getIamAudit: Lấy audit chuyên biệt IAM.
  getIamAudit: controlPlaneService.getIamAudit,

  // listDenyPolicies: Liệt kê deny policy.
  listDenyPolicies: denyPolicyService.listDenyPolicies,
  // previewDenyPolicy: Preview deny policy.
  previewDenyPolicy: denyPolicyService.previewDenyPolicy,
  // createDenyPolicy: Tạo deny policy.
  createDenyPolicy: denyPolicyService.createDenyPolicy,
  // updateDenyPolicy: Cập nhật deny policy.
  updateDenyPolicy: denyPolicyService.updateDenyPolicy,
  // setDenyPolicyStatus: Kích hoạt/vô hiệu hóa deny policy.
  setDenyPolicyStatus: denyPolicyService.setDenyPolicyStatus,
  // deleteDenyPolicySoft: Xóa mềm deny policy.
  deleteDenyPolicySoft: denyPolicyService.deleteDenyPolicySoft,
};
