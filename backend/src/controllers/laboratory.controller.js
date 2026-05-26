const laboratoryService = require('../services/laboratory.service');
const clinicalBillingService = require('../services/clinical-billing.service');
const clinicalChargeService = require('../services/clinical-charge.service');
const recordsService = require('../services/records.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');
const { ATTACHMENT_ENTITY_TYPE } = require('../constants/statuses');

module.exports = {
  listLabOrders: wrap((req) => laboratoryService.listLabOrders(req.query, req.auth), 'Lấy danh sách lab order thành công.'),
  getLabOrderDetail: wrap((req) => laboratoryService.getLabOrderDetail(req.params.labOrderId, req.auth), 'Lấy chi tiết lab order thành công.'),
  listLabOrderCharges: wrap((req) => clinicalChargeService.listLabOrderCharges(req.params.labOrderId, req.auth), 'Lấy charge xét nghiệm thành công.'),
  acknowledgeLabOrder: wrap((req) => laboratoryService.acknowledgeLabOrder(req.params.labOrderId, req.auth, requestMeta(req)), 'Acknowledge lab order thành công.'),
  cancelLabOrder: wrap((req) => laboratoryService.cancelLabOrder(req.params.labOrderId, req.body, req.auth, requestMeta(req)), 'Hủy lab order thành công.'),
  createLabOrderCharge: wrap((req) => clinicalBillingService.createChargeForLabOrder(req.params.labOrderId, req.body, req.auth, requestMeta(req)), 'Tạo charge xét nghiệm thành công.', 201),

  createSpecimen: wrap((req) => laboratoryService.createSpecimen(req.params.labOrderId, req.body, req.auth, requestMeta(req)), 'Tạo specimen thành công.', 201),
  collectLabOrderSpecimen: wrap((req) => laboratoryService.collectSpecimen(req.params.labOrderId, req.body, req.auth, requestMeta(req)), 'Collect specimen thành công.'),
  listSpecimens: wrap((req) => laboratoryService.listSpecimens(req.query, req.auth), 'Lấy danh sách specimen thành công.'),
  getSpecimenStats: wrap((req) => laboratoryService.getSpecimenStats(req.query, req.auth), 'Lấy thống kê specimen thành công.'),
  lookupSpecimen: wrap((req) => laboratoryService.lookupSpecimen(req.query, req.auth), 'Tra cứu specimen thành công.'),
  getSpecimenDetail: wrap((req) => laboratoryService.getSpecimenDetail(req.params.specimenId, req.auth), 'Lấy chi tiết specimen thành công.'),
  getSpecimenTimeline: wrap((req) => laboratoryService.getSpecimenTimeline(req.params.specimenId, req.auth), 'Lấy timeline specimen thành công.'),
  getSpecimenCustody: wrap((req) => laboratoryService.getSpecimenCustody(req.params.specimenId, req.auth), 'Lấy custody specimen thành công.'),
  createSpecimenCustodyEvent: wrap((req) => laboratoryService.createSpecimenCustodyEvent(req.params.specimenId, req.body, req.auth, requestMeta(req)), 'Tạo custody event specimen thành công.', 201),
  receiveSpecimen: wrap((req) => laboratoryService.receiveSpecimen(req.params.specimenId, req.body, req.auth, requestMeta(req)), 'Receive specimen thành công.'),
  rejectSpecimen: wrap((req) => laboratoryService.rejectSpecimen(req.params.specimenId, req.body, req.auth, requestMeta(req)), 'Reject specimen thành công.'),
  processSpecimen: wrap((req) => laboratoryService.processSpecimen(req.params.specimenId, req.body, req.auth, requestMeta(req)), 'Process specimen thành công.'),
  storeSpecimen: wrap((req) => laboratoryService.storeSpecimen(req.params.specimenId, req.body, req.auth, requestMeta(req)), 'Store specimen thành công.'),
  disposeSpecimen: wrap((req) => laboratoryService.disposeSpecimen(req.params.specimenId, req.body, req.auth, requestMeta(req)), 'Dispose specimen thành công.'),
  printSpecimenLabel: wrap((req) => laboratoryService.printSpecimenLabel(req.params.specimenId, req.body, req.auth, requestMeta(req)), 'In nhãn specimen thành công.'),
  printSpecimenLabels: wrap((req) => laboratoryService.printSpecimenLabels(req.body, req.auth, requestMeta(req)), 'In nhãn specimen hàng loạt thành công.'),
  bulkReceiveSpecimens: wrap((req) => laboratoryService.bulkReceiveSpecimens(req.body, req.auth, requestMeta(req)), 'Receive specimen hàng loạt thành công.'),
  bulkRejectSpecimens: wrap((req) => laboratoryService.bulkRejectSpecimens(req.body, req.auth, requestMeta(req)), 'Reject specimen hàng loạt thành công.'),
  requestSpecimenRecollection: wrap((req) => laboratoryService.requestSpecimenRecollection(req.params.specimenId, req.body, req.auth, requestMeta(req)), 'Tạo yêu cầu lấy lại specimen thành công.'),
  getSpecimenLabelPdf: wrap((req) => laboratoryService.getSpecimenLabelPdf(req.params.specimenId, req.auth), 'Lấy nhãn specimen thành công.'),
  printLabOrderLabels: wrap((req) => laboratoryService.printLabOrderLabels(req.params.labOrderId, req.body, req.auth, requestMeta(req)), 'In nhãn lab order thành công.'),

  createLabResult: wrap((req) => laboratoryService.createLabResult(req.params.labOrderId, req.body, req.auth, requestMeta(req)), 'Tạo lab result thành công.', 201),
  listLabResults: wrap((req) => laboratoryService.listLabResults(req.query, req.auth), 'Lấy danh sách lab result thành công.'),
  getLabResultDetail: wrap((req) => laboratoryService.getLabResultDetail(req.params.resultId, req.auth), 'Lấy chi tiết lab result thành công.'),
  getLabResultVersions: wrap((req) => laboratoryService.getLabResultVersions(req.params.resultId, req.auth), 'Lấy version lab result thành công.'),
  getLabResultPdf: wrap((req) => laboratoryService.getLabResultPdf(req.params.resultId, req.auth), 'Lấy file in lab result thành công.'),
  printLabResult: wrap((req) => laboratoryService.printLabResult(req.params.resultId, req.body, req.auth, requestMeta(req)), 'In lab result thành công.'),
  updateLabResult: wrap((req) => laboratoryService.updateLabResult(req.params.resultId, req.body, req.auth, requestMeta(req)), 'Cập nhật lab result thành công.'),
  validateLabResultFinalize: wrap(async (req) => {
    const validation = await laboratoryService.validateLabResultBeforeFinalize(req.params.resultId, req.auth);
    return {
      can_finalize: true,
      blocking_errors: [],
      warnings: validation.warnings || [],
      checklist: {
        specimen_valid: true,
        has_items: validation.items?.length > 0,
        numeric_unit_valid: true,
        reference_range_valid: true,
        no_existing_final_result: true,
        critical_flagged: Boolean(validation.hasCritical),
      },
    };
  }, 'Validate finalize lab result thành công.'),
  finalizeLabResult: wrap((req) => laboratoryService.finalizeLabResult(req.params.resultId, req.auth, requestMeta(req)), 'Finalize lab result thành công.'),
  amendLabResult: wrap((req) => laboratoryService.amendLabResult(req.params.resultId, req.body, req.auth, requestMeta(req)), 'Amend lab result thành công.'),
  requestLabResultCorrection: wrap((req) => laboratoryService.requestLabResultCorrection(req.params.resultId, req.body, req.auth, requestMeta(req)), 'Tạo yêu cầu sửa lab result thành công.', 201),
  acknowledgeCriticalLabResult: wrap((req) => laboratoryService.acknowledgeCriticalLabResult(req.params.resultId, req.auth, requestMeta(req)), 'Acknowledge critical lab result thành công.'),
  cancelLabResult: wrap((req) => laboratoryService.cancelLabResult(req.params.resultId, req.body, req.auth, requestMeta(req)), 'Cancel lab result thành công.'),
  markLabResultEnteredInError: wrap((req) => laboratoryService.markLabResultEnteredInError(req.params.resultId, req.body, req.auth, requestMeta(req)), 'Đánh dấu lab result entered_in_error thành công.'),
  releaseLabResultToPatient: wrap((req) => laboratoryService.releaseLabResultToPatient(req.params.resultId, req.auth, requestMeta(req)), 'Release lab result cho patient thành công.'),
  listLabResultAttachments: wrap((req) => recordsService.getAttachmentsByEntity(ATTACHMENT_ENTITY_TYPE.LAB_RESULT, req.params.resultId, req.query, req.auth), 'Lấy file lab result thành công.'),
  uploadLabResultAttachment: wrap((req) => recordsService.uploadAttachment({
    ...req.body,
    entity_type: ATTACHMENT_ENTITY_TYPE.LAB_RESULT,
    entity_id: req.params.resultId,
  }, req.file || null, req.auth, requestMeta(req)), 'Upload file lab result thành công.', 201),

  createLabResultItem: wrap((req) => laboratoryService.createLabResultItem(req.params.resultId, req.body, req.auth, requestMeta(req)), 'Tạo lab result item thành công.', 201),
  updateLabResultItem: wrap((req) => laboratoryService.updateLabResultItem(req.params.itemId, req.body, req.auth, requestMeta(req)), 'Cập nhật lab result item thành công.'),
  removeLabResultItem: wrap((req) => laboratoryService.removeLabResultItem(req.params.itemId, req.auth, requestMeta(req)), 'Remove lab result item thành công.'),

  getMyLabResults: wrap((req) => laboratoryService.getMyLabResults(req.auth, req.query), 'Lấy lab results của tôi thành công.'),
  getMyLabResultsSummary: wrap((req) => laboratoryService.getMyLabResultsSummary(req.auth), 'Lấy tổng hợp lab results của tôi thành công.'),
  getMyLabResultItems: wrap((req) => laboratoryService.getMyLabResultItems(req.params.resultId, req.auth), 'Lấy chỉ số lab result của tôi thành công.'),
  markMyLabResultViewed: wrap((req) => laboratoryService.markMyLabResultViewed(req.params.resultId, req.auth, requestMeta(req)), 'Đã đánh dấu lab result là đã xem.'),
  compareMyLabResult: wrap((req) => laboratoryService.compareMyLabResult(req.params.resultId, req.auth), 'So sánh lab result thành công.'),
  getEncounterLabSummary: wrap((req) => laboratoryService.getEncounterLabSummary(req.params.encounterId, req.auth), 'Lấy lab summary của encounter thành công.'),
  getLabWorkspaceSummary: wrap((req) => laboratoryService.getLabWorkspaceSummary(req.query, req.auth), 'Lấy tổng hợp lab workspace thành công.'),
  getLabWorkspaceOverdue: wrap((req) => laboratoryService.getLabWorkspaceOverdue(req.query, req.auth), 'Lấy danh sách lab quá SLA thành công.'),

  listLabResultCorrections: wrap((req) => laboratoryService.listLabResultCorrections(req.query, req.auth), 'Lấy danh sách yêu cầu sửa lab result thành công.'),
  getLabResultCorrectionDetail: wrap((req) => laboratoryService.getLabResultCorrectionDetail(req.params.correctionId, req.auth), 'Lấy chi tiết yêu cầu sửa lab result thành công.'),
  resolveLabResultCorrection: wrap((req) => laboratoryService.resolveLabResultCorrection(req.params.correctionId, req.body, req.auth, requestMeta(req)), 'Resolve yêu cầu sửa lab result thành công.'),
  cancelLabResultCorrection: wrap((req) => laboratoryService.cancelLabResultCorrection(req.params.correctionId, req.body, req.auth, requestMeta(req)), 'Cancel yêu cầu sửa lab result thành công.'),

  listLabTestCatalog: wrap((req) => laboratoryService.listLabTestCatalog(req.query, req.auth), 'Lấy danh mục xét nghiệm thành công.'),
  getLabTestCatalogDetail: wrap((req) => laboratoryService.getLabTestCatalogDetail(req.params.catalogTestId, req.auth), 'Lấy chi tiết danh mục xét nghiệm thành công.'),
  createLabTestCatalog: wrap((req) => laboratoryService.createLabTestCatalog(req.body, req.auth, requestMeta(req)), 'Tạo danh mục xét nghiệm thành công.', 201),
  updateLabTestCatalog: wrap((req) => laboratoryService.updateLabTestCatalog(req.params.catalogTestId, req.body, req.auth, requestMeta(req)), 'Cập nhật danh mục xét nghiệm thành công.'),
  activateLabTestCatalog: wrap((req) => laboratoryService.setLabTestCatalogActive(req.params.catalogTestId, true, req.auth, requestMeta(req)), 'Kích hoạt danh mục xét nghiệm thành công.'),
  deactivateLabTestCatalog: wrap((req) => laboratoryService.setLabTestCatalogActive(req.params.catalogTestId, false, req.auth, requestMeta(req)), 'Ngưng kích hoạt danh mục xét nghiệm thành công.'),

  listLabSlaRules: wrap((req) => laboratoryService.listLabSlaRules(req.query, req.auth), 'Lấy rule SLA xét nghiệm thành công.'),
  createLabSlaRule: wrap((req) => laboratoryService.createLabSlaRule(req.body, req.auth, requestMeta(req)), 'Tạo rule SLA xét nghiệm thành công.', 201),
  updateLabSlaRule: wrap((req) => laboratoryService.updateLabSlaRule(req.params.slaRuleId, req.body, req.auth, requestMeta(req)), 'Cập nhật rule SLA xét nghiệm thành công.'),
};
