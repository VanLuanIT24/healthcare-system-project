const clinicalDocumentFilesService = require('../services/clinical-document-files.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  listFiles: wrap((req) => clinicalDocumentFilesService.listFiles(req.query, req.auth), 'Lấy danh sách file lâm sàng thành công.'),
  getSummary: wrap((req) => clinicalDocumentFilesService.getSummary(req.query, req.auth), 'Lấy tổng hợp file lâm sàng thành công.'),
  listMissing: wrap((req) => clinicalDocumentFilesService.listMissingDocuments(req.query, req.auth), 'Lấy danh sách file thiếu thành công.'),
  recomputeMissing: wrap((req) => clinicalDocumentFilesService.recomputeMissingDocuments(req.body, req.auth, requestMeta(req)), 'Recompute file thiếu thành công.'),
  waiveMissing: wrap((req) => clinicalDocumentFilesService.waiveMissingTask(req.params.taskId, req.body, req.auth, requestMeta(req)), 'Waive file thiếu thành công.'),
  resolveMissing: wrap((req) => clinicalDocumentFilesService.resolveMissingTask(req.params.taskId, req.body, req.auth, requestMeta(req)), 'Resolve file thiếu thành công.'),
  assignMissing: wrap((req) => clinicalDocumentFilesService.assignMissingTask(req.params.taskId, req.body, req.auth, requestMeta(req)), 'Assign file thiếu thành công.'),
  getDetail: wrap((req) => clinicalDocumentFilesService.getDetail(req.params.attachmentId, req.auth), 'Lấy chi tiết file thành công.'),
  getAudit: wrap((req) => clinicalDocumentFilesService.getAudit(req.params.attachmentId, req.query, req.auth), 'Lấy audit file thành công.'),
  getAccessLogs: wrap((req) => clinicalDocumentFilesService.getAccessLogs(req.params.attachmentId, req.query, req.auth), 'Lấy access logs file thành công.'),
  updateMetadata: wrap((req) => clinicalDocumentFilesService.updateMetadata(req.params.attachmentId, req.body, req.auth, requestMeta(req)), 'Cập nhật metadata file thành công.'),
  reviewAttachment: wrap((req) => clinicalDocumentFilesService.reviewAttachment(req.params.attachmentId, req.body, req.auth, requestMeta(req)), 'Review file thành công.'),
  releaseFile: wrap((req) => clinicalDocumentFilesService.releaseFile(req.params.attachmentId, req.auth, requestMeta(req)), 'Release file thành công.'),
  revokeRelease: wrap((req) => clinicalDocumentFilesService.revokeRelease(req.params.attachmentId, req.body, req.auth, requestMeta(req)), 'Thu hồi release file thành công.'),
  archiveFile: wrap((req) => clinicalDocumentFilesService.archiveFile(req.params.attachmentId, req.body, req.auth, requestMeta(req)), 'Archive file thành công.'),
  restoreFile: wrap((req) => clinicalDocumentFilesService.restoreFile(req.params.attachmentId, req.auth, requestMeta(req)), 'Restore file thành công.'),
  deleteFile: wrap((req) => clinicalDocumentFilesService.deleteFile(req.params.attachmentId, req.body, req.auth, requestMeta(req)), 'Delete file thành công.'),
  rescanFile: wrap((req) => clinicalDocumentFilesService.rescanFile(req.params.attachmentId, req.body, req.auth, requestMeta(req)), 'Yêu cầu rescan file thành công.'),
  quarantineFile: wrap((req) => clinicalDocumentFilesService.quarantineFile(req.params.attachmentId, req.body, req.auth, requestMeta(req)), 'Quarantine file thành công.'),
  markScanSkipped: wrap((req) => clinicalDocumentFilesService.markScanSkipped(req.params.attachmentId, req.body, req.auth, requestMeta(req)), 'Mark scan skipped thành công.'),
  bulkAction: wrap((req) => clinicalDocumentFilesService.bulkAction(req.body, req.auth, requestMeta(req)), 'Bulk action file thành công.'),
};
