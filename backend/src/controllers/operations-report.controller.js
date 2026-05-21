const operationsReportService = require('../services/operations-report.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  overview: wrap((req) => operationsReportService.getOverview(req.query, req.auth), 'Lấy tổng quan vận hành khám bệnh thành công.'),
  encounters: wrap((req) => operationsReportService.getEncounters(req.query, req.auth), 'Lấy báo cáo encounter thành công.'),
  appointments: wrap((req) => operationsReportService.getAppointments(req.query, req.auth), 'Lấy báo cáo lịch hẹn thành công.'),
  checkIn: wrap((req) => operationsReportService.getCheckIn(req.query, req.auth), 'Lấy báo cáo check-in thành công.'),
  queue: wrap((req) => operationsReportService.getQueue(req.query, req.auth), 'Lấy báo cáo queue thành công.'),
  noShow: wrap((req) => operationsReportService.getNoShow(req.query, req.auth), 'Lấy báo cáo no-show thành công.'),
  waitTime: wrap((req) => operationsReportService.getWaitTime(req.query, req.auth), 'Lấy báo cáo thời gian chờ thành công.'),
  departmentLoad: wrap((req) => operationsReportService.getDepartmentLoad(req.query, req.auth), 'Lấy báo cáo tải khoa/phòng thành công.'),
  slotEfficiency: wrap((req) => operationsReportService.getSlotEfficiency(req.query, req.auth), 'Lấy báo cáo hiệu suất slot thành công.'),
  patientFlow: wrap((req) => operationsReportService.getPatientFlow(req.query, req.auth), 'Lấy báo cáo luồng bệnh nhân thành công.'),
};
