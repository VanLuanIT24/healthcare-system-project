const reportService = require('../services/report.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

module.exports = {
  getSystemDashboard: wrap(
    (req) => reportService.getSystemDashboard(req.auth),
    'Lấy dashboard hệ thống thành công.',
  ),
  getDepartmentDashboard: wrap(
    (req) => reportService.getDepartmentDashboard(req.params.departmentId, req.auth),
    'Lấy dashboard khoa/phòng thành công.',
  ),
  getDoctorDashboard: wrap(
    (req) => reportService.getDoctorDashboard(req.query, req.auth),
    'Lấy dashboard bác sĩ thành công.',
  ),
  getBillingDashboard: wrap(
    (req) => reportService.getBillingDashboard(req.auth),
    'Lấy dashboard billing thành công.',
  ),
  getInventoryDashboard: wrap(
    (req) => reportService.getInventoryDashboard(req.auth),
    'Lấy dashboard kho thành công.',
  ),
};
