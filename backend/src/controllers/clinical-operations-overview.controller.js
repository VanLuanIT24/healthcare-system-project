const clinicalOperationsOverviewService = require('../services/clinical-operations-overview.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getTopbarBootstrap: wrap(
    (req) => clinicalOperationsOverviewService.getTopbarBootstrap(req.query, req.auth),
    'Bootstrap Clinical Command Bar thành công.',
  ),
  getWorklistSummary: wrap(
    (req) => clinicalOperationsOverviewService.getWorklistSummary(req.query, req.auth),
    'Lấy summary worklist clinical operations thành công.',
  ),
  getSafetySummary: wrap(
    (req) => clinicalOperationsOverviewService.getSafetySummary(req.query, req.auth),
    'Lấy safety summary clinical operations thành công.',
  ),
  searchClinicalOps: wrap(
    (req) => clinicalOperationsOverviewService.searchClinicalOps(req.query, req.auth),
    'Tìm kiếm Clinical Operations thành công.',
  ),
  claimWorklistItem: wrap(
    (req) => clinicalOperationsOverviewService.claimWorklistItem(req.params.itemId, req.body, req.auth, requestMeta(req)),
    'Nhận xử lý work item thành công.',
  ),
  releaseWorklistItem: wrap(
    (req) => clinicalOperationsOverviewService.releaseWorklistItem(req.params.itemId, req.body, req.auth, requestMeta(req)),
    'Release work item thành công.',
  ),
  getDashboard: wrap(
    (req) => clinicalOperationsOverviewService.getDashboard(req.query, req.auth),
    'Lấy dashboard clinical operations thành công.',
  ),
  getTodayWorklist: wrap(
    (req) => clinicalOperationsOverviewService.getTodayWorklist(req.query, req.auth),
    'Lấy worklist clinical operations thành công.',
  ),
  getStatUrgent: wrap(
    (req) => clinicalOperationsOverviewService.getStatUrgent(req.query, req.auth),
    'Lấy STAT/Urgent board thành công.',
  ),
  getCriticalResults: wrap(
    (req) => clinicalOperationsOverviewService.getCriticalResults(req.query, req.auth),
    'Lấy critical result center thành công.',
  ),
  getPendingCompletion: wrap(
    (req) => clinicalOperationsOverviewService.getPendingCompletion(req.query, req.auth),
    'Lấy hàng đợi chờ hoàn tất thành công.',
  ),
  getPendingApproval: wrap(
    (req) => clinicalOperationsOverviewService.getPendingApproval(req.query, req.auth),
    'Lấy hàng đợi chờ duyệt/ký thành công.',
  ),
  getOverdueOrders: wrap(
    (req) => clinicalOperationsOverviewService.getOverdueOrders(req.query, req.auth),
    'Lấy order quá hạn thành công.',
  ),
  getSidebar: wrap(
    (req) => clinicalOperationsOverviewService.getSidebar(req.query, req.auth),
    'Lấy sidebar clinical operations thành công.',
  ),
  createEscalation: wrap(
    (req) => clinicalOperationsOverviewService.createEscalation(req.body, req.auth, requestMeta(req)),
    'Tạo escalation thành công.',
    201,
  ),
  acknowledgeEscalation: wrap(
    (req) => clinicalOperationsOverviewService.acknowledgeEscalation(req.params.escalationId, req.auth, requestMeta(req)),
    'Acknowledge escalation thành công.',
  ),
  resolveEscalation: wrap(
    (req) => clinicalOperationsOverviewService.resolveEscalation(req.params.escalationId, req.body, req.auth, requestMeta(req)),
    'Resolve escalation thành công.',
  ),
  signResult: wrap(
    (req) => clinicalOperationsOverviewService.signResult(req.body, req.auth, requestMeta(req)),
    'Ký kết quả thành công.',
    201,
  ),
  revokeSignature: wrap(
    (req) => clinicalOperationsOverviewService.revokeSignature(req.params.signatureId, req.body, req.auth, requestMeta(req)),
    'Thu hồi chữ ký thành công.',
  ),
};
