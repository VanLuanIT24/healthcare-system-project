const customReportService = require('../services/custom-report.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  datasets: wrap(
    (req) => customReportService.listDatasets(req.query, req.auth),
    'Lấy dataset báo cáo tùy chỉnh thành công.',
  ),
  datasetSchema: wrap(
    (req) => customReportService.getDatasetSchema(req.params.datasetKey),
    'Lấy schema dataset báo cáo tùy chỉnh thành công.',
  ),
  preview: wrap(
    (req) => customReportService.preview(req.body || {}, req.auth, requestMeta(req)),
    'Preview báo cáo tùy chỉnh thành công.',
  ),
  run: wrap(
    (req) => customReportService.run(req.body || {}, req.auth, requestMeta(req)),
    'Run báo cáo tùy chỉnh thành công.',
  ),
  reports: wrap(
    () => customReportService.emptyReportCollection('reports'),
    'Lấy danh sách báo cáo tùy chỉnh thành công.',
  ),
  myReports: wrap(
    () => customReportService.emptyReportCollection('my'),
    'Lấy báo cáo của tôi thành công.',
  ),
  sharedReports: wrap(
    () => customReportService.emptyReportCollection('shared'),
    'Lấy báo cáo dùng chung thành công.',
  ),
  pinnedReports: wrap(
    () => customReportService.emptyReportCollection('pinned'),
    'Lấy báo cáo được ghim thành công.',
  ),
  exports: wrap(
    () => customReportService.emptyReportCollection('exports'),
    'Lấy export báo cáo tùy chỉnh thành công.',
  ),
};
