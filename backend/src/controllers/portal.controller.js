const portalService = require('../services/portal.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getMyDashboard: wrap(
    (req) => portalService.getMyDashboard(req.auth, req.query),
    'Lấy dashboard portal thành công.',
  ),
  createProfileChangeRequest: wrap(
    (req) => portalService.createProfileChangeRequest(req.auth, req.body, requestMeta(req)),
    'Tạo yêu cầu thay đổi hồ sơ thành công.',
    201,
  ),
  listProfileChangeRequests: wrap(
    (req) => portalService.listProfileChangeRequests(req.auth, req.query),
    'Lấy danh sách yêu cầu thay đổi hồ sơ thành công.',
  ),
  approveProfileChangeRequest: wrap(
    (req) => portalService.approveProfileChangeRequest(
      req.params.patientId,
      req.params.profileChangeRequestId,
      req.auth,
      req.body,
      requestMeta(req),
    ),
    'Duyệt yêu cầu thay đổi hồ sơ thành công.',
  ),
  rejectProfileChangeRequest: wrap(
    (req) => portalService.rejectProfileChangeRequest(
      req.params.patientId,
      req.params.profileChangeRequestId,
      req.auth,
      req.body,
      requestMeta(req),
    ),
    'Từ chối yêu cầu thay đổi hồ sơ thành công.',
  ),
  cancelProfileChangeRequest: wrap(
    (req) => portalService.cancelProfileChangeRequest(
      req.auth,
      req.params.profileChangeRequestId,
      req.body,
      requestMeta(req),
    ),
    'Hủy yêu cầu thay đổi hồ sơ thành công.',
  ),
  getMyAccessLogs: wrap(
    (req) => portalService.getMyAccessLogs(req.auth, req.query, requestMeta(req)),
    'Lấy nhật ký truy cập hồ sơ thành công.',
  ),
  uploadMyDocument: wrap(
    (req) => portalService.uploadMyDocument(req.auth, req.body, requestMeta(req)),
    'Upload document portal thành công.',
    201,
  ),
  listMyDocuments: wrap(
    (req) => portalService.listMyDocuments(req.auth, req.query),
    'Lấy documents portal thành công.',
  ),
  getMyDocument: wrap(
    (req) => portalService.getMyDocument(req.auth, req.params.documentId),
    'Lấy document portal thành công.',
  ),
  archiveMyDocument: wrap(
    (req) => portalService.archiveMyDocument(req.auth, req.params.documentId, req.body, requestMeta(req)),
    'Archive document portal thành công.',
  ),
  restoreMyDocument: wrap(
    (req) => portalService.restoreMyDocument(req.auth, req.params.documentId, requestMeta(req)),
    'Restore document portal thành công.',
  ),
  deleteMyDocument: wrap(
    (req) => portalService.deleteMyDocument(req.auth, req.params.documentId, req.body, requestMeta(req)),
    'Delete document portal thành công.',
  ),
  submitMyDocumentReview: wrap(
    (req) => portalService.submitMyDocumentReview(req.auth, req.params.documentId, requestMeta(req)),
    'Submit review document portal thành công.',
  ),
  approvePatientDocument: wrap(
    (req) => portalService.reviewPatientDocument(req.params.documentId, true, req.body, req.auth, requestMeta(req)),
    'Approve patient document thành công.',
  ),
  rejectPatientDocument: wrap(
    (req) => portalService.reviewPatientDocument(req.params.documentId, false, req.body, req.auth, requestMeta(req)),
    'Reject patient document thành công.',
  ),
  createDocumentExport: wrap(
    (req) => portalService.createDocumentExport(req.auth, req.body, requestMeta(req)),
    'Tạo document export thành công.',
    201,
  ),
  getDocumentExport: wrap(
    (req) => portalService.getDocumentExport(req.auth, req.params.exportId),
    'Lấy document export thành công.',
  ),
  downloadDocumentExport: wrap(
    (req) => portalService.downloadDocumentExport(req.auth, req.params.exportId, requestMeta(req)),
    'Download document export thành công.',
  ),
};
