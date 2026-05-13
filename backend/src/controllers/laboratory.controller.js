const laboratoryService = require('../services/laboratory.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

module.exports = {
  listLabOrders: wrap((req) => laboratoryService.listLabOrders(req.query, req.auth), 'Lấy danh sách lab order thành công.'),
  getLabOrderDetail: wrap((req) => laboratoryService.getLabOrderDetail(req.params.labOrderId, req.auth), 'Lấy chi tiết lab order thành công.'),
  acknowledgeLabOrder: wrap((req) => laboratoryService.acknowledgeLabOrder(req.params.labOrderId, req.auth, requestMeta(req)), 'Acknowledge lab order thành công.'),
  cancelLabOrder: wrap((req) => laboratoryService.cancelLabOrder(req.params.labOrderId, req.body, req.auth, requestMeta(req)), 'Hủy lab order thành công.'),

  createSpecimen: wrap((req) => laboratoryService.createSpecimen(req.params.labOrderId, req.body, req.auth, requestMeta(req)), 'Tạo specimen thành công.', 201),
  collectLabOrderSpecimen: wrap((req) => laboratoryService.collectSpecimen(req.params.labOrderId, req.body, req.auth, requestMeta(req)), 'Collect specimen thành công.'),
  getSpecimenDetail: wrap((req) => laboratoryService.getSpecimenDetail(req.params.specimenId, req.auth), 'Lấy chi tiết specimen thành công.'),
  receiveSpecimen: wrap((req) => laboratoryService.receiveSpecimen(req.params.specimenId, req.auth, requestMeta(req)), 'Receive specimen thành công.'),
  rejectSpecimen: wrap((req) => laboratoryService.rejectSpecimen(req.params.specimenId, req.body, req.auth, requestMeta(req)), 'Reject specimen thành công.'),
  processSpecimen: wrap((req) => laboratoryService.processSpecimen(req.params.specimenId, req.auth, requestMeta(req)), 'Process specimen thành công.'),
  storeSpecimen: wrap((req) => laboratoryService.storeSpecimen(req.params.specimenId, req.body, req.auth, requestMeta(req)), 'Store specimen thành công.'),
  disposeSpecimen: wrap((req) => laboratoryService.disposeSpecimen(req.params.specimenId, req.body, req.auth, requestMeta(req)), 'Dispose specimen thành công.'),

  createLabResult: wrap((req) => laboratoryService.createLabResult(req.params.labOrderId, req.body, req.auth, requestMeta(req)), 'Tạo lab result thành công.', 201),
  listLabResults: wrap((req) => laboratoryService.listLabResults(req.query, req.auth), 'Lấy danh sách lab result thành công.'),
  getLabResultDetail: wrap((req) => laboratoryService.getLabResultDetail(req.params.resultId, req.auth), 'Lấy chi tiết lab result thành công.'),
  updateLabResult: wrap((req) => laboratoryService.updateLabResult(req.params.resultId, req.body, req.auth, requestMeta(req)), 'Cập nhật lab result thành công.'),
  finalizeLabResult: wrap((req) => laboratoryService.finalizeLabResult(req.params.resultId, req.auth, requestMeta(req)), 'Finalize lab result thành công.'),
  amendLabResult: wrap((req) => laboratoryService.amendLabResult(req.params.resultId, req.body, req.auth, requestMeta(req)), 'Amend lab result thành công.'),
  acknowledgeCriticalLabResult: wrap((req) => laboratoryService.acknowledgeCriticalLabResult(req.params.resultId, req.auth, requestMeta(req)), 'Acknowledge critical lab result thành công.'),
  cancelLabResult: wrap((req) => laboratoryService.cancelLabResult(req.params.resultId, req.body, req.auth, requestMeta(req)), 'Cancel lab result thành công.'),
  markLabResultEnteredInError: wrap((req) => laboratoryService.markLabResultEnteredInError(req.params.resultId, req.body, req.auth, requestMeta(req)), 'Đánh dấu lab result entered_in_error thành công.'),
  releaseLabResultToPatient: wrap((req) => laboratoryService.releaseLabResultToPatient(req.params.resultId, req.auth, requestMeta(req)), 'Release lab result cho patient thành công.'),

  createLabResultItem: wrap((req) => laboratoryService.createLabResultItem(req.params.resultId, req.body, req.auth, requestMeta(req)), 'Tạo lab result item thành công.', 201),
  updateLabResultItem: wrap((req) => laboratoryService.updateLabResultItem(req.params.itemId, req.body, req.auth, requestMeta(req)), 'Cập nhật lab result item thành công.'),
  removeLabResultItem: wrap((req) => laboratoryService.removeLabResultItem(req.params.itemId, req.auth, requestMeta(req)), 'Remove lab result item thành công.'),

  getMyLabResults: wrap((req) => laboratoryService.getMyLabResults(req.auth, req.query), 'Lấy lab results của tôi thành công.'),
  getEncounterLabSummary: wrap((req) => laboratoryService.getEncounterLabSummary(req.params.encounterId, req.auth), 'Lấy lab summary của encounter thành công.'),
};
