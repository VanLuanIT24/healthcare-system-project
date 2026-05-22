const masterDataService = require('../services/master-data.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  getOverview: wrap(() => masterDataService.getOverview(), 'Lấy tổng quan Master Data thành công.'),
  getQualityDashboard: wrap(() => masterDataService.getQualityDashboard(), 'Lấy dashboard chất lượng Master Data thành công.'),
  runQualityCheck: wrap(() => masterDataService.runQualityCheck(), 'Chạy kiểm tra chất lượng Master Data thành công.'),
  getIssues: wrap((req) => masterDataService.getIssues(req.query), 'Lấy danh sách vấn đề Master Data thành công.'),
  getRecentChanges: wrap((req) => masterDataService.getRecentChanges(req.query), 'Lấy thay đổi Master Data gần đây thành công.'),
  getDependencyGraph: wrap(() => masterDataService.getDependencyGraph(), 'Lấy dependency graph Master Data thành công.'),
  listEntity: wrap((req) => masterDataService.listEntity(req.params.entity, req.query), 'Lấy dữ liệu entity Master Data thành công.'),
  getEntityDependencies: wrap((req) => masterDataService.getEntityDependencies(req.params.entity, req.params.id), 'Lấy dependency entity Master Data thành công.'),
};
