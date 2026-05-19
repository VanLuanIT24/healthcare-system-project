const pharmacyReportService = require('../services/pharmacy-report.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getDashboard: wrap(
    (req) => pharmacyReportService.getPharmacyDashboardReport(req.query, req.auth),
    'Lấy dashboard báo cáo dược thành công.',
  ),
  getInventoryOverview: wrap(
    (req) => pharmacyReportService.getInventoryOverviewReport(req.query, req.auth),
    'Lấy báo cáo tổng quan tồn kho thành công.',
  ),
  getInventoryMovement: wrap(
    (req) => pharmacyReportService.getInventoryMovementReport(req.query, req.auth),
    'Lấy báo cáo nhập xuất tồn thành công.',
  ),
  getDispensing: wrap(
    (req) => pharmacyReportService.getDispensingReport(req.query, req.auth),
    'Lấy báo cáo cấp phát thuốc thành công.',
  ),
  getExpiringStock: wrap(
    (req) => pharmacyReportService.getExpiringStockReport(req.query, req.auth),
    'Lấy báo cáo thuốc sắp hết hạn thành công.',
  ),
  getLowStock: wrap(
    (req) => pharmacyReportService.getLowStockReport(req.query, req.auth),
    'Lấy báo cáo thuốc dưới tồn tối thiểu thành công.',
  ),
  getInventoryValuation: wrap(
    (req) => pharmacyReportService.getInventoryValuationReport(req.query, req.auth),
    'Lấy báo cáo giá trị tồn kho thành công.',
  ),
  getHighUsageMedications: wrap(
    (req) => pharmacyReportService.getHighUsageMedicationReport(req.query, req.auth),
    'Lấy báo cáo thuốc dùng nhiều thành công.',
  ),
  getWasteDisposal: wrap(
    (req) => pharmacyReportService.getWasteDisposalReport(req.query, req.auth),
    'Lấy báo cáo hao hụt/hủy thuốc thành công.',
  ),
  exportReport: wrap(
    (req) => pharmacyReportService.exportPharmacyReport(req.body && Object.keys(req.body).length ? req.body : req.query, req.auth, requestMeta(req)),
    'Export báo cáo dược thành công.',
  ),
  getExportHistory: wrap(
    (req) => pharmacyReportService.getExportHistory(req.query, req.auth),
    'Lấy lịch sử export báo cáo dược thành công.',
  ),
};
