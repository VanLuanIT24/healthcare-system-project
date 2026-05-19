const pharmacyAlertService = require('../services/pharmacy-alert.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  summary: wrap((req) => pharmacyAlertService.getAlertSummary(req.query, req.auth), 'Lấy summary cảnh báo dược thành công.'),
  list: wrap((req) => pharmacyAlertService.listPharmacyAlerts(req.query, req.auth), 'Lấy danh sách cảnh báo dược thành công.'),
  detail: wrap((req) => pharmacyAlertService.getPharmacyAlertDetail(req.params.alertId, req.auth), 'Lấy chi tiết cảnh báo dược thành công.'),

  lowStock: wrap((req) => pharmacyAlertService.getLowStockAlerts(req.query, req.auth), 'Lấy cảnh báo sắp hết thuốc thành công.'),
  outOfStock: wrap((req) => pharmacyAlertService.getOutOfStockAlerts(req.query, req.auth), 'Lấy cảnh báo hết thuốc thành công.'),
  expiringBatches: wrap((req) => pharmacyAlertService.getExpiringBatchAlerts(req.query, req.auth), 'Lấy cảnh báo lô sắp hết hạn thành công.'),
  expiredBatches: wrap((req) => pharmacyAlertService.getExpiredBatchAlerts(req.query, req.auth), 'Lấy cảnh báo lô đã hết hạn thành công.'),
  dispenseShortage: wrap((req) => pharmacyAlertService.getDispenseShortageAlerts(req.query, req.auth), 'Lấy cảnh báo không đủ thuốc cấp phát thành công.'),
  allergy: wrap((req) => pharmacyAlertService.getAllergyAlerts(req.query, req.auth), 'Lấy cảnh báo dị ứng thuốc thành công.'),
  highUsage: wrap((req) => pharmacyAlertService.getHighUsageAlerts(req.query, req.auth), 'Lấy cảnh báo thuốc dùng nhiều thành công.'),
  wasteLoss: wrap((req) => pharmacyAlertService.getWasteLossAlerts(req.query, req.auth), 'Lấy cảnh báo hao hụt/hủy thuốc thành công.'),

  acknowledge: wrap((req) => pharmacyAlertService.acknowledgePharmacyAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã xác nhận cảnh báo dược.'),
  assign: wrap((req) => pharmacyAlertService.assignPharmacyAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã gán cảnh báo dược.'),
  start: wrap((req) => pharmacyAlertService.startPharmacyAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã bắt đầu xử lý cảnh báo dược.'),
  snooze: wrap((req) => pharmacyAlertService.snoozePharmacyAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã snooze cảnh báo dược.'),
  resolve: wrap((req) => pharmacyAlertService.resolvePharmacyAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã xử lý cảnh báo dược.'),
  dismiss: wrap((req) => pharmacyAlertService.dismissPharmacyAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã bỏ qua cảnh báo dược.'),
  escalate: wrap((req) => pharmacyAlertService.escalatePharmacyAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã nâng mức cảnh báo dược.'),
  bulkAction: wrap((req) => pharmacyAlertService.bulkActionPharmacyAlerts(req.body, req.auth, requestMeta(req)), 'Đã xử lý hàng loạt cảnh báo dược.'),
};
