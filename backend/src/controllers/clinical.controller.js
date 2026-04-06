const clinicalService = require('../services/clinical.service');
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
  createConsultation: wrap((req) => clinicalService.createConsultation(req.body, req.auth, requestMeta(req)), 'Tạo consultation thành công.', 201),
  listConsultations: wrap((req) => clinicalService.listConsultations(req.query), 'Lấy danh sách consultation thành công.'),
  getConsultationDetail: wrap((req) => clinicalService.getConsultationDetail(req.params.consultationId), 'Lấy chi tiết consultation thành công.'),
  updateConsultation: wrap((req) => clinicalService.updateConsultation(req.params.consultationId, req.body, req.auth, requestMeta(req)), 'Cập nhật consultation thành công.'),
  startConsultation: wrap((req) => clinicalService.startConsultation(req.params.consultationId, req.auth, requestMeta(req)), 'Bắt đầu consultation thành công.'),
  signConsultation: wrap((req) => clinicalService.signConsultation(req.params.consultationId, req.auth, requestMeta(req)), 'Ký consultation thành công.'),
  amendConsultation: wrap((req) => clinicalService.amendConsultation(req.params.consultationId, req.body, req.auth, requestMeta(req)), 'Sửa bổ sung consultation thành công.'),
  cancelConsultation: wrap((req) => clinicalService.cancelConsultation(req.params.consultationId, req.auth, requestMeta(req)), 'Hủy consultation thành công.'),
  getEncounterClinicalSummary: wrap((req) => clinicalService.getEncounterClinicalSummary(req.params.encounterId), 'Lấy tóm tắt lâm sàng của encounter thành công.'),
  addDiagnosis: wrap((req) => clinicalService.addDiagnosis(req.body, req.auth, requestMeta(req)), 'Thêm chẩn đoán thành công.', 201),
  listDiagnosesByEncounter: wrap((req) => clinicalService.listDiagnosesByEncounter(req.params.encounterId), 'Lấy danh sách chẩn đoán thành công.'),
  getDiagnosisDetail: wrap((req) => clinicalService.getDiagnosisDetail(req.params.diagnosisId), 'Lấy chi tiết diagnosis thành công.'),
  updateDiagnosis: wrap((req) => clinicalService.updateDiagnosis(req.params.diagnosisId, req.body, req.auth, requestMeta(req)), 'Cập nhật chẩn đoán thành công.'),
  resolveDiagnosis: wrap((req) => clinicalService.resolveDiagnosis(req.params.diagnosisId, req.auth, requestMeta(req)), 'Đánh dấu resolved diagnosis thành công.'),
  setPrimaryDiagnosis: wrap((req) => clinicalService.setPrimaryDiagnosis(req.params.diagnosisId, req.auth, requestMeta(req)), 'Đặt chẩn đoán chính thành công.'),
  removeDiagnosis: wrap((req) => clinicalService.removeDiagnosis(req.params.diagnosisId, req.auth, requestMeta(req)), 'Gỡ diagnosis thành công.'),
  recordVitalSigns: wrap((req) => clinicalService.recordVitalSigns(req.body, req.auth, requestMeta(req)), 'Ghi nhận vital signs thành công.', 201),
  listVitalSigns: wrap((req) => clinicalService.listVitalSigns(req.params.encounterId), 'Lấy danh sách vital signs thành công.'),
  getLatestVitalSigns: wrap((req) => clinicalService.getLatestVitalSigns(req.params.encounterId), 'Lấy vital signs mới nhất thành công.'),
  getVitalSignDetail: wrap((req) => clinicalService.getVitalSignDetail(req.params.vitalSignId), 'Lấy chi tiết vital sign thành công.'),
  updateVitalSigns: wrap((req) => clinicalService.updateVitalSigns(req.params.vitalSignId, req.body, req.auth, requestMeta(req)), 'Cập nhật vital signs thành công.'),
  deleteVitalSignsRecord: wrap((req) => clinicalService.deleteVitalSignsRecord(req.params.vitalSignId, req.auth, requestMeta(req)), 'Vô hiệu hóa vital sign thành công.'),
  createClinicalNote: wrap((req) => clinicalService.createClinicalNote(req.body, req.auth, requestMeta(req)), 'Tạo clinical note thành công.', 201),
  listClinicalNotes: wrap((req) => clinicalService.listClinicalNotes(req.query), 'Lấy danh sách clinical notes thành công.'),
  getClinicalNoteDetail: wrap((req) => clinicalService.getClinicalNoteDetail(req.params.noteId), 'Lấy chi tiết clinical note thành công.'),
  updateClinicalNote: wrap((req) => clinicalService.updateClinicalNote(req.params.noteId, req.body, req.auth, requestMeta(req)), 'Cập nhật clinical note thành công.'),
  startClinicalNote: wrap((req) => clinicalService.startClinicalNote(req.params.noteId, req.auth, requestMeta(req)), 'Bắt đầu clinical note thành công.'),
  completeClinicalNote: wrap((req) => clinicalService.completeClinicalNote(req.params.noteId, req.auth, requestMeta(req)), 'Hoàn tất clinical note thành công.'),
  signClinicalNote: wrap((req) => clinicalService.signClinicalNote(req.params.noteId, req.auth, requestMeta(req)), 'Ký clinical note thành công.'),
  amendClinicalNote: wrap((req) => clinicalService.amendClinicalNote(req.params.noteId, req.body, req.auth, requestMeta(req)), 'Sửa bổ sung clinical note thành công.'),
  cancelClinicalNote: wrap((req) => clinicalService.cancelClinicalNote(req.params.noteId, req.auth, requestMeta(req)), 'Hủy clinical note thành công.'),
};
