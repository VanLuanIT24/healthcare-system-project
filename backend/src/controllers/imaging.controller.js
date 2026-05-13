const imagingService = require('../services/imaging.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

module.exports = {
  listImagingOrders: wrap((req) => imagingService.listImagingOrders(req.query, req.auth), 'Lấy danh sách imaging order thành công.'),
  getImagingOrderDetail: wrap((req) => imagingService.getImagingOrderDetail(req.params.imagingOrderId, req.auth), 'Lấy chi tiết imaging order thành công.'),
  scheduleImagingOrder: wrap((req) => imagingService.scheduleImagingOrder(req.params.imagingOrderId, req.body, req.auth, requestMeta(req)), 'Schedule imaging order thành công.'),
  startImagingOrder: wrap((req) => imagingService.startImagingOrder(req.params.imagingOrderId, req.body, req.auth, requestMeta(req)), 'Start imaging order thành công.'),
  completeImagingOrder: wrap((req) => imagingService.completeImagingOrder(req.params.imagingOrderId, req.body, req.auth, requestMeta(req)), 'Complete imaging order thành công.'),
  cancelImagingOrder: wrap((req) => imagingService.cancelImagingOrder(req.params.imagingOrderId, req.body, req.auth, requestMeta(req)), 'Cancel imaging order thành công.'),
  markImagingOrderNoShow: wrap((req) => imagingService.markImagingOrderNoShow(req.params.imagingOrderId, req.body, req.auth, requestMeta(req)), 'Mark imaging order no_show thành công.'),

  uploadImagingAttachment: wrap((req) => imagingService.uploadImagingAttachment(req.params.imagingOrderId, req.body, req.auth, requestMeta(req)), 'Upload imaging attachment thành công.', 201),
  listImagingAttachments: wrap((req) => imagingService.listImagingAttachments(req.params.imagingOrderId, req.auth), 'Lấy imaging attachments thành công.'),
  deleteImagingAttachment: wrap((req) => imagingService.deleteImagingAttachment(req.params.attachmentId, req.auth, requestMeta(req)), 'Delete imaging attachment thành công.'),

  createImagingReport: wrap((req) => imagingService.createImagingReport(req.params.imagingOrderId, req.body, req.auth, requestMeta(req)), 'Tạo imaging report thành công.', 201),
  listImagingReports: wrap((req) => imagingService.listImagingReports(req.query, req.auth), 'Lấy danh sách imaging report thành công.'),
  getImagingReportDetail: wrap((req) => imagingService.getImagingReportDetail(req.params.reportId, req.auth), 'Lấy chi tiết imaging report thành công.'),
  updateImagingReport: wrap((req) => imagingService.updateImagingReport(req.params.reportId, req.body, req.auth, requestMeta(req)), 'Cập nhật imaging report thành công.'),
  finalizeImagingReport: wrap((req) => imagingService.finalizeImagingReport(req.params.reportId, req.auth, requestMeta(req)), 'Finalize imaging report thành công.'),
  amendImagingReport: wrap((req) => imagingService.amendImagingReport(req.params.reportId, req.body, req.auth, requestMeta(req)), 'Amend imaging report thành công.'),
  cancelImagingReport: wrap((req) => imagingService.cancelImagingReport(req.params.reportId, req.body, req.auth, requestMeta(req)), 'Cancel imaging report thành công.'),
  releaseImagingReportToPatient: wrap((req) => imagingService.releaseImagingReportToPatient(req.params.reportId, req.auth, requestMeta(req)), 'Release imaging report cho patient thành công.'),
  acknowledgeCriticalImagingReport: wrap((req) => imagingService.acknowledgeCriticalImagingReport(req.params.reportId, req.auth, requestMeta(req)), 'Acknowledge critical imaging report thành công.'),

  getMyImagingReports: wrap((req) => imagingService.getMyImagingReports(req.auth, req.query), 'Lấy imaging reports của tôi thành công.'),
  getEncounterImagingSummary: wrap((req) => imagingService.getEncounterImagingSummary(req.params.encounterId, req.auth), 'Lấy imaging summary của encounter thành công.'),
  getImagingTimeline: wrap((req) => imagingService.getImagingTimeline(req.params.imagingOrderId, req.auth), 'Lấy imaging timeline thành công.'),
};
