const procedureService = require('../services/procedure.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

module.exports = {
  listProcedureOrders: wrap((req) => procedureService.listProcedureOrders(req.query, req.auth), 'Lấy danh sách procedure order thành công.'),
  getProcedureOrderDetail: wrap((req) => procedureService.getProcedureOrderDetail(req.params.procedureOrderId, req.auth), 'Lấy chi tiết procedure order thành công.'),
  getProcedureTimeline: wrap((req) => procedureService.getProcedureTimeline(req.params.procedureOrderId, req.auth), 'Lấy procedure timeline thành công.'),

  scheduleProcedure: wrap((req) => procedureService.scheduleProcedure(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)), 'Schedule procedure thành công.'),
  startProcedure: wrap((req) => procedureService.startProcedure(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)), 'Start procedure thành công.'),
  completeProcedure: wrap((req) => procedureService.completeProcedure(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)), 'Complete procedure thành công.'),
  cancelProcedure: wrap((req) => procedureService.cancelProcedure(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)), 'Cancel procedure thành công.'),
  noShowProcedure: wrap((req) => procedureService.noShowProcedure(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)), 'Mark procedure no_show thành công.'),

  uploadProcedureAttachment: wrap((req) => procedureService.uploadProcedureAttachment(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)), 'Upload procedure attachment thành công.', 201),
  listProcedureAttachments: wrap((req) => procedureService.listProcedureAttachments(req.params.procedureOrderId, req.auth), 'Lấy procedure attachments thành công.'),

  createProcedureCharge: wrap((req) => procedureService.createProcedureCharge(req.params.procedureOrderId, req.body, req.auth, requestMeta(req)), 'Tạo procedure charge thành công.', 201),
  listProcedureCharges: wrap((req) => procedureService.listProcedureCharges(req.params.procedureOrderId, req.auth), 'Lấy procedure charges thành công.'),

  getEncounterProcedureSummary: wrap((req) => procedureService.getEncounterProcedureSummary(req.params.encounterId, req.auth), 'Lấy procedure summary của encounter thành công.'),
  getPatientProcedureHistory: wrap((req) => procedureService.getPatientProcedureHistory(req.params.patientId, req.query, req.auth), 'Lấy procedure history của patient thành công.'),
  getMyProcedureHistory: wrap((req) => procedureService.getPatientProcedureHistory(req.auth.patientId || req.auth.patient_id, req.query, req.auth), 'Lấy procedure history của tôi thành công.'),
  getProcedureDashboardSummary: wrap((req) => procedureService.getProcedureDashboardSummary(req.query, req.auth), 'Lấy procedure dashboard summary thành công.'),
};
