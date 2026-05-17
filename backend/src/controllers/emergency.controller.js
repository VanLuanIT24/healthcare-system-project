const emergencyService = require('../services/emergency.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  createSos: wrap((req) => emergencyService.createSos(req.body, req.auth, requestMeta(req)), 'Tạo SOS thành công.', 201),
  listCases: wrap((req) => emergencyService.listCases(req.query, req.auth), 'Lấy danh sách emergency case thành công.'),
  getCase: wrap((req) => emergencyService.getCase(req.params.caseId, req.auth), 'Lấy emergency case thành công.'),
  acknowledgeCase: wrap((req) => emergencyService.acknowledgeCase(req.params.caseId, req.body, req.auth, requestMeta(req)), 'Acknowledge emergency case thành công.'),
  triageCase: wrap((req) => emergencyService.triageCase(req.params.caseId, req.body, req.auth, requestMeta(req)), 'Triage emergency case thành công.'),
  dispatchCase: wrap((req) => emergencyService.dispatchCase(req.params.caseId, req.body, req.auth, requestMeta(req)), 'Dispatch emergency case thành công.'),
  resolveCase: wrap((req) => emergencyService.resolveCase(req.params.caseId, req.body, req.auth, requestMeta(req)), 'Resolve emergency case thành công.'),
  cancelCase: wrap((req) => emergencyService.cancelCase(req.params.caseId, req.body, req.auth, requestMeta(req)), 'Cancel emergency case thành công.'),
};
