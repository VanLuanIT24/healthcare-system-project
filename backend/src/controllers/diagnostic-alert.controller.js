const diagnosticAlertService = require('../services/diagnostic-alert.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  list: wrap((req) => diagnosticAlertService.listDiagnosticAlerts(req.query, req.auth), 'Lấy danh sách Diagnostic Alert Center thành công.'),
  summary: wrap((req) => diagnosticAlertService.getDiagnosticAlertSummary(req.query, req.auth), 'Lấy summary Diagnostic Alert Center thành công.'),
  detail: wrap((req) => diagnosticAlertService.getDiagnosticAlertDetail(req.params.alertId, req.auth), 'Lấy chi tiết diagnostic alert thành công.'),

  criticalOpen: wrap((req) => diagnosticAlertService.getCriticalOpenAlerts(req.query, req.auth), 'Lấy critical results chưa xử lý thành công.'),
  criticalOverdue: wrap((req) => diagnosticAlertService.getCriticalOverdueAlerts(req.query, req.auth), 'Lấy critical quá hạn xác nhận thành công.'),
  rejectedSpecimens: wrap((req) => diagnosticAlertService.getRejectedSpecimenAlerts(req.query, req.auth), 'Lấy cảnh báo mẫu bị từ chối thành công.'),
  overdueOrders: wrap((req) => diagnosticAlertService.getOverdueOrderAlerts(req.query, req.auth), 'Lấy cảnh báo order quá hạn thành công.'),
  missingFiles: wrap((req) => diagnosticAlertService.getMissingFileAlerts(req.query, req.auth), 'Lấy cảnh báo thiếu/lỗi tệp kết quả thành công.'),
  correctionNeeded: wrap((req) => diagnosticAlertService.getCorrectionNeededAlerts(req.query, req.auth), 'Lấy cảnh báo kết quả cần sửa thành công.'),
  noShowCancellations: wrap((req) => diagnosticAlertService.getNoShowCancellationAlerts(req.query, req.auth), 'Lấy cảnh báo no-show/hủy bất thường thành công.'),

  acknowledge: wrap((req) => diagnosticAlertService.acknowledgeAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã acknowledge diagnostic alert.'),
  assign: wrap((req) => diagnosticAlertService.assignAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã assign diagnostic alert.'),
  escalate: wrap((req) => diagnosticAlertService.escalateAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã escalate diagnostic alert.'),
  resolve: wrap((req) => diagnosticAlertService.resolveAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã resolve diagnostic alert.'),
  dismiss: wrap((req) => diagnosticAlertService.dismissAlert(req.params.alertId, req.body, req.auth, requestMeta(req)), 'Đã dismiss diagnostic alert.'),
  bulkAction: wrap((req) => diagnosticAlertService.bulkAction(req.body, req.auth, requestMeta(req)), 'Đã xử lý hàng loạt diagnostic alert.'),
};
