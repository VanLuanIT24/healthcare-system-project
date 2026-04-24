const patientService = require('../services/patient.service');
const { errorResponse, successResponse } = require('../utils/http-response');

function requestMeta(req) {
  return {
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  };
}

function wrap(serviceMethod, successMessage, statusCode = 200) {
  return async function wrapped(req, res) {
    try {
      const result = await serviceMethod(req, res);
      return successResponse(res, { statusCode, message: successMessage, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  };
}

module.exports = {
  createPatient: wrap((req) => patientService.createPatient(req.body, req.auth, requestMeta(req)), 'Tạo bệnh nhân thành công.', 201),
  listPatients: wrap((req) => patientService.listPatients(req.query), 'Lấy danh sách bệnh nhân thành công.'),
  searchPatients: wrap((req) => patientService.searchPatients(req.query), 'Tìm kiếm bệnh nhân thành công.'),
  getPatientDetail: wrap((req) => patientService.getPatientDetail(req.params.patientId), 'Lấy chi tiết bệnh nhân thành công.'),
  getPatientSummary: wrap((req) => patientService.getPatientSummary(req.params.patientId), 'Lấy tổng quan bệnh nhân thành công.'),
  getPatientTimeline: wrap((req) => patientService.getPatientTimeline(req.params.patientId, req.query), 'Lấy timeline bệnh nhân thành công.'),
  updatePatient: wrap((req) => patientService.updatePatient(req.params.patientId, req.body, req.auth, requestMeta(req)), 'Cập nhật bệnh nhân thành công.'),
  updatePatientStatus: wrap(
    (req) => patientService.updatePatientStatus(req.params.patientId, req.body.status, req.auth, requestMeta(req)),
    'Cập nhật trạng thái bệnh nhân thành công.',
  ),
  archivePatient: wrap((req) => patientService.archivePatient(req.params.patientId, req.auth, requestMeta(req)), 'Lưu trữ hồ sơ bệnh nhân thành công.'),
  mergePatients: wrap((req) => patientService.mergePatients(req.body, req.auth, requestMeta(req)), 'Gộp hồ sơ bệnh nhân thành công.'),
  checkPatientCanBeMerged: wrap(
    (req) => patientService.checkPatientCanBeMerged(req.query.source_patient_id, req.query.target_patient_id),
    'Kiểm tra khả năng gộp hồ sơ bệnh nhân thành công.',
  ),
  previewPatientMerge: wrap(
    (req) => patientService.previewPatientMerge(req.query.source_patient_id, req.query.target_patient_id),
    'Xem trước dữ liệu gộp hồ sơ bệnh nhân thành công.',
  ),
  detectDuplicatePatients: wrap((req) => patientService.detectDuplicatePatients(req.query), 'Phát hiện hồ sơ trùng thành công.'),
  checkPatientCanBookAppointment: wrap(
    (req) => patientService.checkPatientCanBookAppointment(req.params.patientId),
    'Kiểm tra khả năng đặt lịch của bệnh nhân thành công.',
  ),
  addPatientIdentifier: wrap(
    (req) => patientService.addPatientIdentifier(req.params.patientId, req.body, req.auth, requestMeta(req)),
    'Thêm định danh bệnh nhân thành công.',
    201,
  ),
  listPatientIdentifiers: wrap((req) => patientService.listPatientIdentifiers(req.params.patientId), 'Lấy danh sách định danh bệnh nhân thành công.'),
  getPatientIdentifierDetail: wrap(
    (req) => patientService.getPatientIdentifierDetail(req.params.patientId, req.params.identifierId),
    'Lấy chi tiết định danh bệnh nhân thành công.',
  ),
  updatePatientIdentifier: wrap(
    (req) => patientService.updatePatientIdentifier(req.params.patientId, req.params.identifierId, req.body, req.auth, requestMeta(req)),
    'Cập nhật định danh bệnh nhân thành công.',
  ),
  removePatientIdentifier: wrap(
    (req) => patientService.removePatientIdentifier(req.params.patientId, req.params.identifierId, req.auth, requestMeta(req)),
    'Xóa mềm định danh bệnh nhân thành công.',
  ),
  setPrimaryPatientIdentifier: wrap(
    (req) => patientService.setPrimaryPatientIdentifier(req.params.patientId, req.params.identifierId, req.auth, requestMeta(req)),
    'Đặt định danh chính thành công.',
  ),
  linkUserAccountToPatient: wrap(
    (req) => patientService.linkUserAccountToPatient(req.params.patientId, req.body.patient_account_id, req.auth, requestMeta(req)),
    'Liên kết tài khoản bệnh nhân thành công.',
  ),
  getMyPatientProfile: wrap((req) => patientService.getMyPatientProfile(req.auth), 'Lấy hồ sơ bệnh nhân của tôi thành công.'),
  updateMyPatientProfile: wrap(
    (req) => patientService.updateMyPatientProfile(req.auth, req.body, requestMeta(req)),
    'Cập nhật hồ sơ bệnh nhân của tôi thành công.',
  ),
  getMyPrescriptions: wrap(
    (req) => patientService.getPatientPrescriptionHistory(req.auth.patientId, req.query),
    'Láº¥y Ä‘Æ¡n thuá»‘c cá»§a tÃ´i thÃ nh cÃ´ng.',
  ),
  getPatientAppointmentHistory: wrap(
    (req) => patientService.getPatientAppointmentHistory(req.params.patientId, req.query),
    'Lấy lịch sử lịch hẹn của bệnh nhân thành công.',
  ),
  getPatientEncounterHistory: wrap(
    (req) => patientService.getPatientEncounterHistory(req.params.patientId, req.query),
    'Lấy lịch sử khám của bệnh nhân thành công.',
  ),
  getPatientPrescriptionHistory: wrap(
    (req) => patientService.getPatientPrescriptionHistory(req.params.patientId, req.query),
    'Lấy lịch sử đơn thuốc của bệnh nhân thành công.',
  ),
  listPatientProblems: wrap((req) => patientService.listPatientProblems(req.params.patientId, req.query), 'Lấy problem list của bệnh nhân thành công.'),
  addPatientProblem: wrap((req) => patientService.addPatientProblem(req.params.patientId, req.body, req.auth, requestMeta(req)), 'Thêm problem cho bệnh nhân thành công.', 201),
  updatePatientProblem: wrap(
    (req) => patientService.updatePatientProblem(req.params.patientId, req.params.problemId, req.body, req.auth, requestMeta(req)),
    'Cập nhật problem của bệnh nhân thành công.',
  ),
  resolvePatientProblem: wrap(
    (req) => patientService.resolvePatientProblem(req.params.patientId, req.params.problemId, req.auth, requestMeta(req)),
    'Đánh dấu resolved problem của bệnh nhân thành công.',
  ),
  listPatientAllergies: wrap((req) => patientService.listPatientAllergies(req.params.patientId, req.query), 'Lấy danh sách dị ứng của bệnh nhân thành công.'),
  addPatientAllergy: wrap((req) => patientService.addPatientAllergy(req.params.patientId, req.body, req.auth, requestMeta(req)), 'Thêm dị ứng cho bệnh nhân thành công.', 201),
  updatePatientAllergy: wrap(
    (req) => patientService.updatePatientAllergy(req.params.patientId, req.params.allergyId, req.body, req.auth, requestMeta(req)),
    'Cập nhật dị ứng của bệnh nhân thành công.',
  ),
  removePatientAllergy: wrap(
    (req) => patientService.removePatientAllergy(req.params.patientId, req.params.allergyId, req.auth, requestMeta(req)),
    'Xóa dị ứng của bệnh nhân thành công.',
  ),
  getMyAppointments: wrap((req) => patientService.getPatientAppointmentHistory(req.auth.patientId, req.query), 'Lấy lịch hẹn của tôi thành công.'),
  getMyEncounters: wrap((req) => patientService.getPatientEncounterHistory(req.auth.patientId, req.query), 'Lấy lịch sử khám của tôi thành công.'),
};
