const service = require('../services/admin-tools.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getOverview: wrap((req) => service.getOverview(req.query, req.auth), 'Lấy Admin Tools overview thành công.'),
  listTools: wrap((req) => service.listTools(req.query, req.auth), 'Lấy danh sách Admin Tools thành công.'),
  getTool: wrap((req) => service.getToolDetail(req.params.toolCode, req.auth), 'Lấy chi tiết Admin Tool thành công.'),
  runTool: wrap((req) => service.runTool(req.params.toolCode, req.body, req.auth, requestMeta(req)), 'Chạy Admin Tool thành công.', 201),

  listRuns: wrap((req) => service.listRuns(req.query, req.auth), 'Lấy lịch sử chạy Admin Tools thành công.'),
  getRun: wrap((req) => service.getRun(req.params.runId, req.auth), 'Lấy chi tiết Admin Tool run thành công.'),
  listRunFindings: wrap((req) => service.listRunFindings(req.params.runId, req.query, req.auth), 'Lấy findings của run thành công.'),
  exportRun: wrap((req) => service.exportRun(req.params.runId, req.auth), 'Export run thành công.'),
  cancelRun: wrap((req) => service.cancelRun(req.params.runId, req.body, req.auth, requestMeta(req)), 'Cancel Admin Tool run thành công.'),
  approveRun: wrap((req) => service.approveRun(req.params.runId, req.body, req.auth, requestMeta(req)), 'Approve Admin Tool run thành công.'),
  applyRun: wrap((req) => service.applyRun(req.params.runId, req.body, req.auth, requestMeta(req)), 'Apply Admin Tool run thành công.', 201),

  listFindings: wrap((req) => service.listFindings(req.query, req.auth), 'Lấy Admin Tool findings thành công.'),
  resolveFinding: wrap((req) => service.updateFindingStatus(req.params.findingId, 'resolved', req.body, req.auth, requestMeta(req)), 'Resolve finding thành công.'),
  ignoreFinding: wrap((req) => service.updateFindingStatus(req.params.findingId, 'ignored', req.body, req.auth, requestMeta(req)), 'Ignore finding thành công.'),
  acceptRisk: wrap((req) => service.updateFindingStatus(req.params.findingId, 'accepted_risk', req.body, req.auth, requestMeta(req)), 'Accept risk finding thành công.'),
};
