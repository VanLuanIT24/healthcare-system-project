const billingWorkspaceService = require('../services/billing-workspace.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getTopbarBootstrap: wrap(
    (req) => billingWorkspaceService.getTopbarBootstrap(req.query, req.auth),
    'Bootstrap Cashier Command Bar thành công.',
  ),
  getDashboardOverview: wrap(
    (req) => billingWorkspaceService.getDashboardOverview(req.query, req.auth),
    'Lấy tổng quan Billing Workspace thành công.',
  ),
  getCashierWorklist: wrap(
    (req) => billingWorkspaceService.getCashierWorklist(req.query, req.auth),
    'Lấy cashier worklist thành công.',
  ),
  getPaymentConfirmationQueue: wrap(
    (req) => billingWorkspaceService.getPaymentConfirmationQueue(req.query, req.auth),
    'Lấy hàng đợi xác nhận payment thành công.',
  ),
  getAlertSummary: wrap(
    (req) => billingWorkspaceService.getAlertSummary(req.query, req.auth),
    'Lấy Billing Risk Summary thành công.',
  ),
  search: wrap(
    (req) => billingWorkspaceService.searchBillingWorkspace(req.query, req.auth),
    'Tìm kiếm Billing Workspace thành công.',
  ),
  getReconciliationMismatches: wrap(
    (req) => billingWorkspaceService.getReconciliationMismatches(req.query, req.auth),
    'Lấy sai lệch đối soát thành công.',
  ),
  getCurrentCashSession: wrap(
    (req) => billingWorkspaceService.getCurrentCashSession(req.auth),
    'Lấy phiên quỹ hiện tại thành công.',
  ),
  openCashSession: wrap(
    (req) => billingWorkspaceService.openCashSession(req.body, req.auth, requestMeta(req)),
    'Mở phiên quỹ thành công.',
    201,
  ),
  closeCurrentCashSession: wrap(
    (req) => billingWorkspaceService.closeCurrentCashSession(req.body, req.auth, requestMeta(req)),
    'Đóng phiên quỹ hiện tại thành công.',
  ),
  closeCashSession: wrap(
    (req) => billingWorkspaceService.closeCashSession(req.params.shiftId, req.body, req.auth, requestMeta(req)),
    'Đóng phiên quỹ thành công.',
  ),
  getCashSessionReport: wrap(
    (req) => billingWorkspaceService.getCashSessionReport(req.params.shiftId, req.auth),
    'Lấy báo cáo phiên quỹ thành công.',
  ),
};
