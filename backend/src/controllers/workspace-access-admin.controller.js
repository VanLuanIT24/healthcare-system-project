const workspaceAccessAdminService = require('../services/workspace-access-admin.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getOverview: wrap((req) => workspaceAccessAdminService.getOverview(req.query, req.auth), 'Lấy tổng quan workspace access thành công.'),
  listWorkspaces: wrap((req) => workspaceAccessAdminService.listWorkspaces(req.query, req.auth), 'Lấy danh sách workspace thành công.'),
  getWorkspaceDetail: wrap((req) => workspaceAccessAdminService.getWorkspaceDetail(req.params.workspaceCode, req.auth), 'Lấy chi tiết workspace thành công.'),
  getByActor: wrap((req) => workspaceAccessAdminService.getByActor(req.query, req.auth), 'Lấy workspace theo actor thành công.'),
  getByRole: wrap((req) => workspaceAccessAdminService.getByRole(req.query, req.auth), 'Lấy workspace theo role thành công.'),
  getByUser: wrap((req) => workspaceAccessAdminService.listUsersAccess(req.query, req.auth), 'Lấy workspace theo người dùng thành công.'),
  getByDepartment: wrap((req) => workspaceAccessAdminService.getByDepartment(req.query, req.auth), 'Lấy workspace theo khoa/phòng thành công.'),
  listPolicies: wrap((req) => workspaceAccessAdminService.listPolicies(req.query, req.auth), 'Lấy workspace access policy thành công.'),
  createPolicy: wrap((req) => workspaceAccessAdminService.createPolicy(req.body, req.auth, requestMeta(req)), 'Tạo workspace access policy thành công.', 201),
  updatePolicy: wrap((req) => workspaceAccessAdminService.updatePolicy(req.params.policyId, req.body, req.auth, requestMeta(req)), 'Cập nhật workspace access policy thành công.'),
  deletePolicy: wrap((req) => workspaceAccessAdminService.deletePolicy(req.params.policyId, req.auth, requestMeta(req)), 'Xóa workspace access policy thành công.'),
  validatePolicies: wrap((req) => workspaceAccessAdminService.validatePolicies(req.body, req.auth), 'Validate workspace access policy thành công.'),
  getConflicts: wrap((req) => workspaceAccessAdminService.getConflicts(req.query, req.auth), 'Lấy workspace policy conflicts thành công.'),
  getSidebarConfigs: wrap((req) => workspaceAccessAdminService.getSidebarConfigs(req.query, req.auth), 'Lấy cấu hình sidebar workspace thành công.'),
  getNavigationRules: wrap((req) => workspaceAccessAdminService.getNavigationRules(req.query, req.auth), 'Lấy cross-workspace navigation rules thành công.'),
  listPreferences: wrap((req) => workspaceAccessAdminService.listPreferences(req.query, req.auth), 'Lấy workspace preferences thành công.'),
  getDiagnostics: wrap((req) => workspaceAccessAdminService.getDiagnostics(req.query, req.auth), 'Lấy workspace diagnostics thành công.'),
  runDiagnostics: wrap((req) => workspaceAccessAdminService.getDiagnostics(req.body, req.auth), 'Chạy workspace diagnostics thành công.'),
  getAudit: wrap((req) => workspaceAccessAdminService.getAudit(req.query, req.auth), 'Lấy workspace audit thành công.'),
  checkAccess: wrap((req) => workspaceAccessAdminService.checkAccess(req.body, req.auth), 'Kiểm tra khả dụng workspace thành công.'),
  explainAccess: wrap((req) => workspaceAccessAdminService.explainWorkspaceAccess(req.body, req.auth), 'Explain workspace access thành công.'),
};
