const patientService = require('../services/patient.service');
const { controllerHandler: wrap, markLegacyControllerError, requestMeta, sendSuccess } = require('../common/controllers');

function mergeIdsFromRequest(req) {
  return {
    source_patient_id: req.body.source_patient_id || req.body.sourcePatientId || req.query.source_patient_id,
    target_patient_id: req.body.target_patient_id || req.body.targetPatientId || req.query.target_patient_id,
    reason: req.body.reason || req.body.merge_reason,
    confirm_merge: req.body.confirm_merge,
    confirm: req.body.confirm,
  };
}

module.exports = {
  createPatient: wrap(
    (req) => patientService.createPatient(req.body, req.auth, requestMeta(req)),
    'Tạo bệnh nhân thành công.',
    201,
  ),
  listPatients: wrap(
    (req) => patientService.listPatients(req.query, req.auth),
    'Lấy danh sách bệnh nhân thành công.',
  ),
  searchPatients: wrap(
    (req) => patientService.searchPatients(req.query, req.auth),
    'Tìm kiếm bệnh nhân thành công.',
  ),
  detectDuplicatePatients: wrap(
    (req) => patientService.detectDuplicatePatients({ ...req.query, ...req.body }, req.auth),
    'Phát hiện hồ sơ trùng thành công.',
  ),
  getPatientDetail: wrap(
    (req) => patientService.getPatientDetail(req.params.patientId, req.auth),
    'Lấy chi tiết bệnh nhân thành công.',
  ),
  getPatientSummary: wrap(
    (req) => patientService.getPatientSummary(req.params.patientId, req.auth),
    'Lấy tổng quan bệnh nhân thành công.',
  ),
  getPatientTimeline: wrap(
    (req) => patientService.getPatientTimeline(req.params.patientId, req.query, req.auth),
    'Lấy timeline bệnh nhân thành công.',
  ),
  updatePatient: wrap(
    (req) => patientService.updatePatient(req.params.patientId, req.body, req.auth, requestMeta(req)),
    'Cập nhật bệnh nhân thành công.',
  ),
  updatePatientStatus: wrap(
    (req) => patientService.updatePatientStatus(req.params.patientId, req.body.status, req.auth, requestMeta(req)),
    'Cập nhật trạng thái bệnh nhân thành công.',
  ),
  archivePatient: wrap(
    (req) => patientService.archivePatient(req.params.patientId, req.body, req.auth, requestMeta(req)),
    'Lưu trữ hồ sơ bệnh nhân thành công.',
  ),
  checkPatientCanBeMerged: wrap(
    (req) => patientService.checkPatientCanBeMerged(
      req.query.source_patient_id,
      req.query.target_patient_id,
      req.auth,
    ),
    'Kiểm tra khả năng gộp hồ sơ bệnh nhân thành công.',
  ),
  previewPatientMerge: wrap(
    (req) => {
      const payload = mergeIdsFromRequest(req);
      return patientService.previewPatientMerge(payload.source_patient_id, payload.target_patient_id, req.auth);
    },
    'Xem trước dữ liệu gộp hồ sơ bệnh nhân thành công.',
  ),
  mergePatients: wrap(
    (req) => patientService.mergePatients(mergeIdsFromRequest(req), null, req.auth, requestMeta(req)),
    'Gộp hồ sơ bệnh nhân thành công.',
  ),
  checkPatientCanBookAppointment: wrap(
    (req) => patientService.checkPatientCanBookAppointment(req.params.patientId, { ...req.query, return_result_only: true }, req.auth),
    'Kiểm tra khả năng đặt lịch của bệnh nhân thành công.',
  ),

  addPatientIdentifier: wrap(
    (req) => patientService.addPatientIdentifier(req.params.patientId, req.body, req.auth, requestMeta(req)),
    'Thêm định danh bệnh nhân thành công.',
    201,
  ),
  listPatientIdentifiers: wrap(
    (req) => patientService.listPatientIdentifiers(req.params.patientId, req.auth),
    'Lấy danh sách định danh bệnh nhân thành công.',
  ),
  getPatientIdentifierDetail: wrap(
    (req) => patientService.getPatientIdentifierDetail(req.params.patientId, req.params.identifierId, req.auth),
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
    (req) => patientService.linkUserAccountToPatient(req.params.patientId, req.body, req.auth, requestMeta(req)),
    'Liên kết hoặc tạo tài khoản bệnh nhân thành công.',
  ),
  getMyPatientProfile: wrap(
    (req) => patientService.getMyPatientProfile(req.auth),
    'Lấy hồ sơ bệnh nhân của tôi thành công.',
  ),
  updateMyPatientProfile: wrap(
    (req) => patientService.updateMyPatientProfile(req.auth, req.body, requestMeta(req)),
    'Cập nhật hồ sơ bệnh nhân của tôi thành công.',
  ),

  addPatientRelative: wrap(
    (req) => patientService.addPatientRelative(req.params.patientId, req.body, req.auth, requestMeta(req)),
    'Thêm người nhà bệnh nhân thành công.',
    201,
  ),
  listPatientRelatives: wrap(
    (req) => patientService.listPatientRelatives(req.params.patientId, req.auth),
    'Lấy danh sách người nhà bệnh nhân thành công.',
  ),
  getPatientRelativeDetail: wrap(
    (req) => patientService.getPatientRelativeDetail(req.params.relativeId, req.auth),
    'Lấy chi tiết người nhà bệnh nhân thành công.',
  ),
  updatePatientRelative: wrap(
    (req) => patientService.updatePatientRelative(req.params.relativeId, req.body, req.auth, requestMeta(req)),
    'Cập nhật người nhà bệnh nhân thành công.',
  ),
  deletePatientRelativeSoft: wrap(
    (req) => patientService.deletePatientRelativeSoft(req.params.relativeId, req.auth, requestMeta(req)),
    'Xóa mềm người nhà bệnh nhân thành công.',
  ),

  createPatientAuthorization: wrap(
    (req) => patientService.createPatientAuthorization(
      req.params.patientId,
      req.body.relative_id || req.body.relativeId,
      req.body,
      req.auth,
      requestMeta(req),
    ),
    'Tạo ủy quyền người nhà thành công.',
    201,
  ),
  listPatientAuthorizations: wrap(
    (req) => patientService.listPatientAuthorizations(req.params.patientId, req.auth),
    'Lấy danh sách ủy quyền người nhà thành công.',
  ),
  checkRelativeAuthorization: wrap(
    (req) => patientService.checkRelativeAuthorization(
      req.params.relativeId,
      req.params.patientId,
      req.query.authorization_type || req.query.authorizationType,
    ).then((authorized) => ({ authorized })),
    'Kiểm tra ủy quyền người nhà thành công.',
  ),
  approvePatientAuthorization: wrap(
    (req) => patientService.approvePatientAuthorization(req.params.authorizationId, req.auth, requestMeta(req)),
    'Duyệt ủy quyền người nhà thành công.',
  ),
  revokePatientAuthorization: wrap(
    (req) => patientService.revokePatientAuthorization(
      req.params.authorizationId,
      req.body.reason || req.body.revoke_reason,
      req.auth,
      requestMeta(req),
    ),
    'Thu hồi ủy quyền người nhà thành công.',
  ),

  getPatientAppointmentHistory: wrap(
    (req) => patientService.getPatientAppointmentHistory(req.params.patientId, req.query, req.auth),
    'Lấy lịch sử lịch hẹn của bệnh nhân thành công.',
  ),
  getPatientEncounterHistory: wrap(
    (req) => patientService.getPatientEncounterHistory(req.params.patientId, req.query, req.auth),
    'Lấy lịch sử khám của bệnh nhân thành công.',
  ),
  getPatientPrescriptionHistory: wrap(
    (req) => patientService.getPatientPrescriptionHistory(req.params.patientId, req.query, req.auth),
    'Lấy lịch sử đơn thuốc của bệnh nhân thành công.',
  ),
  listPatientProblems: wrap(
    (req) => patientService.listPatientProblems(req.params.patientId, req.query, req.auth),
    'Lấy problem list của bệnh nhân thành công.',
  ),
  addPatientProblem: wrap(
    (req) => patientService.addPatientProblem(req.params.patientId, req.body, req.auth, requestMeta(req)),
    'Thêm problem cho bệnh nhân thành công.',
    201,
  ),
  updatePatientProblem: wrap(
    (req) => patientService.updatePatientProblem(req.params.patientId, req.params.problemId, req.body, req.auth, requestMeta(req)),
    'Cập nhật problem của bệnh nhân thành công.',
  ),
  resolvePatientProblem: wrap(
    (req) => patientService.resolvePatientProblem(req.params.patientId, req.params.problemId, req.auth, requestMeta(req)),
    'Đánh dấu resolved problem của bệnh nhân thành công.',
  ),
  listPatientAllergies: wrap(
    (req) => patientService.listPatientAllergies(req.params.patientId, req.query, req.auth),
    'Lấy danh sách dị ứng của bệnh nhân thành công.',
  ),
  addPatientAllergy: wrap(
    (req) => patientService.addPatientAllergy(req.params.patientId, req.body, req.auth, requestMeta(req)),
    'Thêm dị ứng cho bệnh nhân thành công.',
    201,
  ),
  updatePatientAllergy: wrap(
    (req) => patientService.updatePatientAllergy(req.params.patientId, req.params.allergyId, req.body, req.auth, requestMeta(req)),
    'Cập nhật dị ứng của bệnh nhân thành công.',
  ),
  removePatientAllergy: wrap(
    (req) => patientService.removePatientAllergy(req.params.patientId, req.params.allergyId, req.auth, requestMeta(req)),
    'Đánh dấu dị ứng nhập sai thành công.',
  ),

  getMyAppointments: wrap(
    (req) => patientService.getPatientAppointmentHistory(req.auth.patientId, req.query, req.auth),
    'Lấy lịch hẹn của tôi thành công.',
  ),
  getMyEncounters: wrap(
    (req) => patientService.getPatientEncounterHistory(req.auth.patientId, req.query, req.auth),
    'Lấy lịch sử khám của tôi thành công.',
  ),
  getMyPrescriptions: wrap(
    (req) => patientService.getPatientPrescriptionHistory(req.auth.patientId, req.query, req.auth),
    'Lấy đơn thuốc của tôi thành công.',
  ),
};
