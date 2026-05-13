const reportService = require('../services/report.service');
const { controllerHandler: wrap } = require('../common/controllers');

function requestMeta(req) {
  return {
    requestId: req.context?.request_id,
    sessionId: req.context?.session_id,
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  };
}

module.exports = {
  getAppointmentReport: wrap(
    (req) => reportService.getAppointmentReport(req.query, req.auth),
    'Lấy báo cáo lịch hẹn thành công.',
  ),
  getQueueReport: wrap(
    (req) => reportService.getQueueReport(req.query, req.auth),
    'Lấy báo cáo hàng đợi thành công.',
  ),
  getEncounterReport: wrap(
    (req) => reportService.getEncounterReport(req.query, req.auth),
    'Lấy báo cáo encounter thành công.',
  ),
  getRevenueReport: wrap(
    (req) => reportService.getRevenueReport(req.query, req.auth),
    'Lấy báo cáo doanh thu thành công.',
  ),
  getInventoryReport: wrap(
    (req) => reportService.getInventoryReport(req.query, req.auth),
    'Lấy báo cáo kho thành công.',
  ),
  getDepartmentReport: wrap(
    (req) => reportService.getDepartmentReport(req.query, req.auth),
    'Lấy báo cáo khoa/phòng thành công.',
  ),
  getDoctorReport: wrap(
    (req) => reportService.getDoctorReport(req.query, req.auth),
    'Lấy báo cáo bác sĩ thành công.',
  ),
  exportReport: wrap(
    (req) => reportService.exportReport(req.query, req.auth, requestMeta(req)),
    'Export report thành công.',
  ),
};
