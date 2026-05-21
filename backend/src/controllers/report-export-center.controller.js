const reportExportCenterService = require('../services/report-export-center.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  createExport: wrap(
    (req) => reportExportCenterService.createExport(req.body || {}, req.auth, requestMeta(req)),
    'Tạo export báo cáo thành công.',
  ),
  csv: wrap(
    (req) => reportExportCenterService.getCsvCenter(req.query, req.auth),
    'Lấy trung tâm export CSV thành công.',
  ),
  excel: wrap(
    (req) => reportExportCenterService.getExcelCenter(req.query, req.auth),
    'Lấy cấu hình export Excel thành công.',
  ),
  pdf: wrap(
    (req) => reportExportCenterService.getPdfCenter(req.query, req.auth),
    'Lấy cấu hình export PDF thành công.',
  ),
  history: wrap(
    (req) => reportExportCenterService.getExportHistory(req.query, req.auth),
    'Lấy lịch sử export báo cáo thành công.',
  ),
  processing: wrap(
    (req) => reportExportCenterService.getProcessingExports(req.query, req.auth),
    'Lấy export đang xử lý thành công.',
  ),
  failed: wrap(
    (req) => reportExportCenterService.getFailedExports(req.query, req.auth),
    'Lấy export thất bại thành công.',
  ),
  schedules: wrap(
    (req) => reportExportCenterService.getSchedules(req.query, req.auth),
    'Lấy lịch gửi định kỳ thành công.',
  ),
  saved: wrap(
    (req) => reportExportCenterService.getSavedReports(req.query, req.auth),
    'Lấy báo cáo đã lưu thành công.',
  ),
};
