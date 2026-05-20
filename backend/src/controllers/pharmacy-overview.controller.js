const pharmacyOverviewService = require('../services/pharmacy-overview.service');
const pharmacyTopbarService = require('../services/pharmacy-topbar.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getTopbarBootstrap: wrap((req) => pharmacyTopbarService.getTopbarBootstrap(req.query, req.auth), 'Lấy bootstrap topbar nhà thuốc thành công.'),
  searchWorkspace: wrap((req) => pharmacyTopbarService.search(req.query, req.auth), 'Tìm kiếm workspace nhà thuốc thành công.'),
  getAlertSummary: wrap((req) => pharmacyTopbarService.getAlertSummary(req.query, req.auth), 'Lấy tóm tắt cảnh báo ca dược thành công.'),
  claimPrescriptionForDispense: wrap((req) => pharmacyTopbarService.claimPrescriptionForDispense(req.params.prescriptionId, req.body, req.auth, requestMeta(req)), 'Nhận xử lý đơn cấp phát thành công.'),

  getDashboard: wrap((req) => pharmacyOverviewService.getDashboard(req.query, req.auth), 'Lấy dashboard nhà thuốc thành công.'),
  getPrescriptionWorkbench: wrap((req) => pharmacyOverviewService.getPrescriptionWorkbench(req.query, req.auth), 'Lấy prescription workbench thành công.'),
  getPrescriptionRiskQueue: wrap((req) => pharmacyOverviewService.getPrescriptionRiskQueue(req.query, req.auth), 'Lấy prescription risk queue thành công.'),
  getWorkQueue: wrap((req) => pharmacyOverviewService.getWorkQueue(req.query, req.auth), 'Lấy hàng việc nhà thuốc thành công.'),
  getDispensingToday: wrap((req) => pharmacyOverviewService.getDispensingToday(req.query, req.auth), 'Lấy bảng cấp phát hôm nay thành công.'),
  getAlertsOverview: wrap((req) => pharmacyOverviewService.getAlerts(req.query, req.auth), 'Lấy cảnh báo dược tổng quan thành công.'),
  getPerformance: wrap((req) => pharmacyOverviewService.getPerformance(req.query, req.auth), 'Lấy hiệu suất nhà thuốc thành công.'),
  getCurrentStock: wrap((req) => pharmacyOverviewService.getCurrentStock(req.query, req.auth), 'Lấy tồn kho hiện tại thành công.'),
  getMedicationSummary: wrap((req) => pharmacyOverviewService.getMedicationSummary(req.query, req.auth), 'Lấy summary danh mục thuốc thành công.'),
  getExpiryRisk: wrap((req) => pharmacyOverviewService.getExpiryRisk(req.query, req.auth), 'Lấy expiry risk thành công.'),

  listStocktakes: wrap((req) => pharmacyOverviewService.listStocktakes(req.query, req.auth), 'Lấy danh sách kỳ kiểm kê thành công.'),
  createStocktake: wrap((req) => pharmacyOverviewService.createStocktake(req.body, req.auth, requestMeta(req)), 'Tạo kỳ kiểm kê thành công.', 201),
  getStocktakeDetail: wrap((req) => pharmacyOverviewService.getStocktakeDetail(req.params.stocktakeId, req.auth, req.query), 'Lấy chi tiết kỳ kiểm kê thành công.'),
  startStocktake: wrap((req) => pharmacyOverviewService.startStocktake(req.params.stocktakeId, req.body, req.auth, requestMeta(req)), 'Bắt đầu kỳ kiểm kê thành công.'),
  generateStocktakeItems: wrap((req) => pharmacyOverviewService.generateStocktakeItems(req.params.stocktakeId, req.body, req.auth, requestMeta(req)), 'Sinh dòng kiểm kê thành công.'),
  countStocktakeItem: wrap((req) => pharmacyOverviewService.countStocktakeItem(req.params.stocktakeId, req.params.stocktakeItemId, req.body, req.auth, requestMeta(req)), 'Ghi nhận số đếm kiểm kê thành công.'),
  reviewStocktake: wrap((req) => pharmacyOverviewService.reviewStocktake(req.params.stocktakeId, req.body, req.auth, requestMeta(req)), 'Review kỳ kiểm kê thành công.'),
  postStocktakeAdjustments: wrap((req) => pharmacyOverviewService.postStocktakeAdjustments(req.params.stocktakeId, req.body, req.auth, requestMeta(req)), 'Post adjustment kiểm kê thành công.'),
  cancelStocktake: wrap((req) => pharmacyOverviewService.cancelStocktake(req.params.stocktakeId, req.body, req.auth, requestMeta(req)), 'Hủy kỳ kiểm kê thành công.'),

  createAlert: wrap((req) => pharmacyOverviewService.createAlert(req.body, req.auth, requestMeta(req)), 'Tạo cảnh báo dược thành công.', 201),
  listAlerts: wrap((req) => pharmacyOverviewService.listAlerts(req.query, req.auth), 'Lấy danh sách cảnh báo dược thành công.'),
  getAlertDetail: wrap((req) => pharmacyOverviewService.getAlertDetail(req.params.alertId, req.auth), 'Lấy chi tiết cảnh báo dược thành công.'),
  acknowledgeAlert: wrap((req) => pharmacyOverviewService.acknowledgeAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã xác nhận cảnh báo dược.'),
  assignAlert: wrap((req) => pharmacyOverviewService.assignAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã gán cảnh báo dược.'),
  startAlert: wrap((req) => pharmacyOverviewService.startAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã bắt đầu xử lý cảnh báo dược.'),
  resolveAlert: wrap((req) => pharmacyOverviewService.resolveAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã xử lý cảnh báo dược.'),
  dismissAlert: wrap((req) => pharmacyOverviewService.dismissAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã bỏ qua cảnh báo dược.'),

  createWorkItem: wrap((req) => pharmacyOverviewService.createWorkItem(req.body, req.auth, requestMeta(req)), 'Tạo việc nhà thuốc thành công.', 201),
  listWorkItems: wrap((req) => pharmacyOverviewService.listWorkItems(req.query, req.auth), 'Lấy danh sách việc nhà thuốc thành công.'),
  getWorkItemDetail: wrap((req) => pharmacyOverviewService.getWorkItemDetail(req.params.workItemId, req.auth), 'Lấy chi tiết việc nhà thuốc thành công.'),
  assignWorkItem: wrap((req) => pharmacyOverviewService.assignWorkItem(req.params.workItemId, req.body, req.auth, requestMeta(req)), 'Đã gán việc nhà thuốc.'),
  startWorkItem: wrap((req) => pharmacyOverviewService.startWorkItem(req.params.workItemId, req.body, req.auth, requestMeta(req)), 'Đã bắt đầu việc nhà thuốc.'),
  holdWorkItem: wrap((req) => pharmacyOverviewService.holdWorkItem(req.params.workItemId, req.body, req.auth, requestMeta(req)), 'Đã tạm giữ việc nhà thuốc.'),
  escalateWorkItem: wrap((req) => pharmacyOverviewService.escalateWorkItem(req.params.workItemId, req.body, req.auth, requestMeta(req)), 'Đã nâng mức việc nhà thuốc.'),
  resolveWorkItem: wrap((req) => pharmacyOverviewService.resolveWorkItem(req.params.workItemId, req.body, req.auth, requestMeta(req)), 'Đã xử lý việc nhà thuốc.'),
  cancelWorkItem: wrap((req) => pharmacyOverviewService.cancelWorkItem(req.params.workItemId, req.body, req.auth, requestMeta(req)), 'Đã hủy việc nhà thuốc.'),
};
