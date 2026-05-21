const executiveReportService = require('../services/executive-report.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  overview: wrap((req) => executiveReportService.getOverview(req.query, req.auth), 'Lấy tổng quan điều hành thành công.'),
  kpiToday: wrap((req) => executiveReportService.getKpiToday(req.query, req.auth), 'Lấy KPI hôm nay thành công.'),
  kpiPeriod: wrap((req) => executiveReportService.getKpiPeriod(req.query, req.auth), 'Lấy KPI theo kỳ thành công.'),
  comparison: wrap((req) => executiveReportService.getComparison(req.query, req.auth), 'Lấy so sánh kỳ trước thành công.'),
  anomalies: wrap((req) => executiveReportService.getAnomalies(req.query, req.auth), 'Lấy cảnh báo bất thường thành công.'),
  trends: wrap((req) => executiveReportService.getTrends(req.query, req.auth), 'Lấy xu hướng chính thành công.'),
  actionItems: wrap((req) => executiveReportService.getActionItems(req.query, req.auth), 'Lấy việc cần chú ý thành công.'),
};
