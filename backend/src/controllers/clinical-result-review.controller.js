const clinicalResultReviewService = require('../services/clinical-result-review.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getReviewSummary: wrap((req) => clinicalResultReviewService.getReviewSummary(req.query, req.auth), 'Lấy tổng hợp duyệt/trả kết quả thành công.'),
  getReviewWorklist: wrap((req) => clinicalResultReviewService.getReviewWorklist(req.query, req.auth), 'Lấy worklist duyệt/trả kết quả thành công.'),
  getReviewDetail: wrap((req) => clinicalResultReviewService.getReviewDetail(req.params.type, req.params.id, req.auth), 'Lấy chi tiết kết quả cần duyệt/trả thành công.'),
  validateFinalize: wrap((req) => clinicalResultReviewService.validateFinalize(req.params.type, req.params.id, req.auth), 'Validate finalize kết quả thành công.'),
  finalizeResult: wrap((req) => clinicalResultReviewService.finalizeResult(req.params.type, req.params.id, req.auth, requestMeta(req)), 'Finalize/ký kết quả thành công.'),
  releaseToDoctor: wrap((req) => clinicalResultReviewService.releaseToDoctor(req.params.type, req.params.id, req.auth, requestMeta(req)), 'Trả kết quả cho bác sĩ thành công.'),
  markDoctorRead: wrap((req) => clinicalResultReviewService.markDoctorRead(req.params.type, req.params.id, req.auth, requestMeta(req)), 'Ghi nhận bác sĩ đã xem kết quả thành công.'),
  doctorAcknowledge: wrap((req) => clinicalResultReviewService.doctorAcknowledge(req.params.type, req.params.id, req.auth, requestMeta(req)), 'Ghi nhận bác sĩ acknowledged kết quả thành công.'),
  releaseToPatient: wrap((req) => clinicalResultReviewService.releaseToPatient(req.params.type, req.params.id, req.auth, requestMeta(req)), 'Trả kết quả cho bệnh nhân thành công.'),
  revokePatientRelease: wrap((req) => clinicalResultReviewService.revokePatientRelease(req.params.type, req.params.id, req.body, req.auth, requestMeta(req)), 'Thu hồi release patient thành công.'),
  acknowledgeCritical: wrap((req) => clinicalResultReviewService.acknowledgeCritical(req.params.type, req.params.id, req.auth, requestMeta(req)), 'Acknowledge critical result thành công.'),
  requestAmend: wrap((req) => clinicalResultReviewService.requestAmend(req.params.type, req.params.id, req.body, req.auth, requestMeta(req)), 'Tạo yêu cầu amend result thành công.', 201),
  bulkAction: wrap((req) => clinicalResultReviewService.bulkAction(req.body, req.auth, requestMeta(req)), 'Thực hiện batch action kết quả thành công.'),
  getAuditTrail: wrap((req) => clinicalResultReviewService.getAuditTrail(req.query, req.auth), 'Lấy audit trail duyệt/trả kết quả thành công.'),
};
