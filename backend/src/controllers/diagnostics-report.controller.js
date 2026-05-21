const diagnosticsReportService = require('../services/diagnostics-report.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  overview: wrap((req) => diagnosticsReportService.getOverview(req.query, req.auth), 'Lấy tổng quan cận lâm sàng thành công.'),
  labOrders: wrap((req) => diagnosticsReportService.getLabOrders(req.query, req.auth), 'Lấy báo cáo lab orders thành công.'),
  labTurnaroundTime: wrap((req) => diagnosticsReportService.getLabTurnaroundTime(req.query, req.auth), 'Lấy báo cáo Lab TAT thành công.'),
  specimens: wrap((req) => diagnosticsReportService.getSpecimens(req.query, req.auth), 'Lấy báo cáo specimen thành công.'),
  imagingOrders: wrap((req) => diagnosticsReportService.getImagingOrders(req.query, req.auth), 'Lấy báo cáo imaging orders thành công.'),
  imagingTurnaroundTime: wrap((req) => diagnosticsReportService.getImagingTurnaroundTime(req.query, req.auth), 'Lấy báo cáo Imaging TAT thành công.'),
  reportPending: wrap((req) => diagnosticsReportService.getReportPending(req.query, req.auth), 'Lấy report pending thành công.'),
  criticalResults: wrap((req) => diagnosticsReportService.getCriticalResults(req.query, req.auth), 'Lấy critical results thành công.'),
  procedureOrders: wrap((req) => diagnosticsReportService.getProcedureOrders(req.query, req.auth), 'Lấy báo cáo procedure orders thành công.'),
  overdueOrders: wrap((req) => diagnosticsReportService.getOverdueOrders(req.query, req.auth), 'Lấy order quá hạn thành công.'),
};
