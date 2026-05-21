const departmentsDoctorsReportService = require('../services/departments-doctors-report.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  overview: wrap((req) => departmentsDoctorsReportService.getOverview(req.query, req.auth), 'Lấy tổng quan khoa & bác sĩ thành công.'),
  departmentPerformance: wrap((req) => departmentsDoctorsReportService.getDepartmentPerformance(req.query, req.auth), 'Lấy hiệu suất khoa thành công.'),
  departmentLoad: wrap((req) => departmentsDoctorsReportService.getDepartmentLoad(req.query, req.auth), 'Lấy tải khoa thành công.'),
  departmentAppointments: wrap((req) => departmentsDoctorsReportService.getDepartmentAppointments(req.query, req.auth), 'Lấy lịch hẹn theo khoa thành công.'),
  departmentQueue: wrap((req) => departmentsDoctorsReportService.getDepartmentQueue(req.query, req.auth), 'Lấy queue theo khoa thành công.'),
  departmentRevenue: wrap((req) => departmentsDoctorsReportService.getDepartmentRevenue(req.query, req.auth), 'Lấy doanh thu theo khoa thành công.'),
  departmentStaff: wrap((req) => departmentsDoctorsReportService.getDepartmentStaff(req.query, req.auth), 'Lấy nhân sự theo khoa thành công.'),
  doctorPerformance: wrap((req) => departmentsDoctorsReportService.getDoctorPerformance(req.query, req.auth), 'Lấy hiệu suất bác sĩ thành công.'),
  doctorUtilization: wrap((req) => departmentsDoctorsReportService.getDoctorUtilization(req.query, req.auth), 'Lấy utilization bác sĩ thành công.'),
  doctorNoShow: wrap((req) => departmentsDoctorsReportService.getDoctorNoShow(req.query, req.auth), 'Lấy no-show theo bác sĩ thành công.'),
  followUp: wrap((req) => departmentsDoctorsReportService.getFollowUp(req.query, req.auth), 'Lấy follow-up thành công.'),
  personalReport: wrap((req) => departmentsDoctorsReportService.getPersonalReport(req.query, req.auth), 'Lấy báo cáo cá nhân thành công.'),
};
