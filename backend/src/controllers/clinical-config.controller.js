const clinicalConfigService = require('../services/clinical-config.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  overview: wrap((req) => clinicalConfigService.overview(req.query, req.auth), 'Lấy Clinical Config Command Center thành công.'),
  serviceOptions: wrap((req) => clinicalConfigService.serviceOptions(req.query, req.auth), 'Lấy danh sách dịch vụ gắn giá thành công.'),

  listLabTests: wrap((req) => clinicalConfigService.listLabTests(req.query, req.auth), 'Lấy lab test catalog thành công.'),
  getLabTest: wrap((req) => clinicalConfigService.getLabTest(req.params.id, req.auth), 'Lấy chi tiết lab test catalog thành công.'),
  createLabTest: wrap((req) => clinicalConfigService.createLabTest(req.body, req.auth, requestMeta(req)), 'Tạo lab test catalog thành công.', 201),
  updateLabTest: wrap((req) => clinicalConfigService.updateLabTest(req.params.id, req.body, req.auth, requestMeta(req)), 'Cập nhật lab test catalog thành công.'),
  cloneLabTest: wrap((req) => clinicalConfigService.cloneLabTest(req.params.id, req.body, req.auth, requestMeta(req)), 'Clone lab test catalog thành công.', 201),
  retireLabTest: wrap((req) => clinicalConfigService.retireLabTest(req.params.id, req.auth, requestMeta(req)), 'Retire lab test catalog thành công.'),
  linkLabTestService: wrap((req) => clinicalConfigService.linkLabTestService(req.params.id, req.body, req.auth, requestMeta(req)), 'Gắn giá dịch vụ cho lab test thành công.'),

  listSpecimenTypes: wrap((req) => clinicalConfigService.listSpecimenTypes(req.query, req.auth), 'Lấy specimen type catalog thành công.'),
  getSpecimenType: wrap((req) => clinicalConfigService.getSpecimenType(req.params.id, req.auth), 'Lấy chi tiết specimen type thành công.'),
  createSpecimenType: wrap((req) => clinicalConfigService.createSpecimenType(req.body, req.auth, requestMeta(req)), 'Tạo specimen type thành công.', 201),
  updateSpecimenType: wrap((req) => clinicalConfigService.updateSpecimenType(req.params.id, req.body, req.auth, requestMeta(req)), 'Cập nhật specimen type thành công.'),
  cloneSpecimenType: wrap((req) => clinicalConfigService.cloneSpecimenType(req.params.id, req.body, req.auth, requestMeta(req)), 'Clone specimen type thành công.', 201),
  retireSpecimenType: wrap((req) => clinicalConfigService.retireSpecimenType(req.params.id, req.auth, requestMeta(req)), 'Retire specimen type thành công.'),

  listImagingModalities: wrap((req) => clinicalConfigService.listImagingModalities(req.query, req.auth), 'Lấy imaging modalities thành công.'),
  createImagingModality: wrap((req) => clinicalConfigService.createImagingModality(req.body, req.auth, requestMeta(req)), 'Tạo imaging modality thành công.', 201),
  updateImagingModality: wrap((req) => clinicalConfigService.updateImagingModality(req.params.id, req.body, req.auth, requestMeta(req)), 'Cập nhật imaging modality thành công.'),
  cloneImagingModality: wrap((req) => clinicalConfigService.cloneImagingModality(req.params.id, req.body, req.auth, requestMeta(req)), 'Clone imaging modality thành công.', 201),
  retireImagingModality: wrap((req) => clinicalConfigService.retireImagingModality(req.params.id, req.auth, requestMeta(req)), 'Retire imaging modality thành công.'),

  listImagingRoomsEquipment: wrap((req) => clinicalConfigService.listImagingRoomsEquipment(req.query, req.auth), 'Lấy phòng/thiết bị CĐHA thành công.'),
  createImagingRoom: wrap((req) => clinicalConfigService.createImagingRoom(req.body, req.auth, requestMeta(req)), 'Tạo phòng CĐHA thành công.', 201),
  updateImagingRoom: wrap((req) => clinicalConfigService.updateImagingRoom(req.params.id, req.body, req.auth, requestMeta(req)), 'Cập nhật phòng CĐHA thành công.'),
  createImagingEquipment: wrap((req) => clinicalConfigService.createImagingEquipment(req.body, req.auth, requestMeta(req)), 'Tạo thiết bị CĐHA thành công.', 201),
  updateImagingEquipment: wrap((req) => clinicalConfigService.updateImagingEquipment(req.params.id, req.body, req.auth, requestMeta(req)), 'Cập nhật thiết bị CĐHA thành công.'),
  markEquipmentDown: wrap((req) => clinicalConfigService.markEquipmentDown(req.params.id, req.body, req.auth, requestMeta(req)), 'Đánh dấu thiết bị hỏng/offline thành công.'),
  restoreEquipment: wrap((req) => clinicalConfigService.restoreEquipment(req.params.id, req.body, req.auth, requestMeta(req)), 'Khôi phục thiết bị CĐHA thành công.'),

  listProcedures: wrap((req) => clinicalConfigService.listProcedures(req.query, req.auth), 'Lấy procedure catalog thành công.'),
  getProcedure: wrap((req) => clinicalConfigService.getProcedure(req.params.id, req.auth), 'Lấy chi tiết procedure catalog thành công.'),
  createProcedure: wrap((req) => clinicalConfigService.createProcedure(req.body, req.auth, requestMeta(req)), 'Tạo procedure catalog thành công.', 201),
  updateProcedure: wrap((req) => clinicalConfigService.updateProcedure(req.params.id, req.body, req.auth, requestMeta(req)), 'Cập nhật procedure catalog thành công.'),
  cloneProcedure: wrap((req) => clinicalConfigService.cloneProcedure(req.params.id, req.body, req.auth, requestMeta(req)), 'Clone procedure catalog thành công.', 201),
  retireProcedure: wrap((req) => clinicalConfigService.retireProcedure(req.params.id, req.auth, requestMeta(req)), 'Retire procedure catalog thành công.'),
  linkProcedureService: wrap((req) => clinicalConfigService.linkProcedureService(req.params.id, req.body, req.auth, requestMeta(req)), 'Gắn giá dịch vụ cho procedure thành công.'),
  linkProcedureChecklist: wrap((req) => clinicalConfigService.linkProcedureChecklist(req.params.id, req.body, req.auth, requestMeta(req)), 'Gắn checklist cho procedure thành công.'),

  listChecklistTemplates: wrap((req) => clinicalConfigService.listChecklistTemplates(req.query, req.auth), 'Lấy checklist templates thành công.'),
  createChecklistTemplate: wrap((req) => clinicalConfigService.createChecklistTemplate(req.body, req.auth, requestMeta(req)), 'Tạo checklist template thành công.', 201),
  updateChecklistTemplate: wrap((req) => clinicalConfigService.updateChecklistTemplate(req.params.id, req.body, req.auth, requestMeta(req)), 'Cập nhật checklist template thành công.'),
  cloneChecklistTemplate: wrap((req) => clinicalConfigService.cloneChecklistTemplate(req.params.id, req.body, req.auth, requestMeta(req)), 'Clone checklist template thành công.', 201),
  previewChecklistTemplate: wrap((req) => clinicalConfigService.previewChecklistTemplate(req.query, req.auth), 'Preview checklist template thành công.'),

  listSlaRules: wrap((req) => clinicalConfigService.listSlaRules(req.query, req.auth), 'Lấy SLA rules thành công.'),
  createSlaRule: wrap((req) => clinicalConfigService.createSlaRule(req.body, req.auth, requestMeta(req)), 'Tạo SLA rule thành công.', 201),
  updateSlaRule: wrap((req) => clinicalConfigService.updateSlaRule(req.params.id, req.body, req.auth, requestMeta(req)), 'Cập nhật SLA rule thành công.'),
  simulateSlaRule: wrap((req) => clinicalConfigService.simulateSlaRule(req.params.id, req.body, req.auth), 'Simulate SLA rule thành công.'),
  slaDashboard: wrap((req) => clinicalConfigService.slaDashboard(req.query, req.auth), 'Lấy SLA dashboard thành công.'),

  listReportTemplates: wrap((req) => clinicalConfigService.listReportTemplates(req.query, req.auth), 'Lấy result report templates thành công.'),
  createReportTemplate: wrap((req) => clinicalConfigService.createReportTemplate(req.body, req.auth, requestMeta(req)), 'Tạo report template thành công.', 201),
  updateReportTemplate: wrap((req) => clinicalConfigService.updateReportTemplate(req.params.id, req.body, req.auth, requestMeta(req)), 'Cập nhật report template thành công.'),
  cloneReportTemplate: wrap((req) => clinicalConfigService.cloneReportTemplate(req.params.id, req.body, req.auth, requestMeta(req)), 'Clone report template thành công.', 201),
  publishReportTemplate: wrap((req) => clinicalConfigService.publishReportTemplate(req.params.id, req.auth, requestMeta(req)), 'Publish report template thành công.'),
  retireReportTemplate: wrap((req) => clinicalConfigService.retireReportTemplate(req.params.id, req.auth, requestMeta(req)), 'Retire report template thành công.'),
  setDefaultReportTemplate: wrap((req) => clinicalConfigService.setDefaultReportTemplate(req.params.id, req.auth, requestMeta(req)), 'Set default report template thành công.'),
  previewReportTemplate: wrap((req) => clinicalConfigService.previewReportTemplate(req.params.id, req.body, req.auth), 'Preview report template thành công.'),
};
