const prescriptionService = require('../services/prescription.service');
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
  createPrescription: wrap((req) => prescriptionService.createPrescription(req.body, req.auth, requestMeta(req)), 'Tạo đơn thuốc thành công.', 201),
  listPrescriptions: wrap((req) => prescriptionService.listPrescriptions(req.query), 'Lấy danh sách đơn thuốc thành công.'),
  searchPrescriptions: wrap((req) => prescriptionService.searchPrescriptions(req.query), 'Tìm kiếm đơn thuốc thành công.'),
  getPrescriptionSummary: wrap((req) => prescriptionService.getPrescriptionSummary(req.params.prescriptionId), 'Lấy tóm tắt đơn thuốc thành công.'),
  getPrescriptionDetail: wrap((req) => prescriptionService.getPrescriptionDetail(req.params.prescriptionId), 'Lấy chi tiết đơn thuốc thành công.'),
  updatePrescription: wrap((req) => prescriptionService.updatePrescription(req.params.prescriptionId, req.body, req.auth, requestMeta(req)), 'Cập nhật đơn thuốc thành công.'),
  activatePrescription: wrap((req) => prescriptionService.activatePrescription(req.params.prescriptionId, req.auth, requestMeta(req)), 'Kích hoạt đơn thuốc thành công.'),
  cancelPrescription: wrap((req) => prescriptionService.cancelPrescription(req.params.prescriptionId, req.auth, requestMeta(req)), 'Hủy đơn thuốc thành công.'),
  completePrescription: wrap((req) => prescriptionService.completePrescription(req.params.prescriptionId, req.auth, requestMeta(req)), 'Hoàn tất đơn thuốc thành công.'),
  addPrescriptionItem: wrap((req) => prescriptionService.addPrescriptionItem(req.body, req.auth, requestMeta(req)), 'Thêm thuốc vào đơn thành công.', 201),
  listPrescriptionItems: wrap((req) => prescriptionService.listPrescriptionItems(req.params.prescriptionId), 'Lấy danh sách thuốc trong đơn thành công.'),
  getPrescriptionItemDetail: wrap((req) => prescriptionService.getPrescriptionItemDetail(req.params.itemId), 'Lấy chi tiết item thuốc thành công.'),
  updatePrescriptionItem: wrap((req) => prescriptionService.updatePrescriptionItem(req.params.itemId, req.body, req.auth, requestMeta(req)), 'Cập nhật item thuốc thành công.'),
  stopPrescriptionItem: wrap((req) => prescriptionService.stopPrescriptionItem(req.params.itemId, req.auth, requestMeta(req)), 'Dừng thuốc trong đơn thành công.'),
  cancelPrescriptionItem: wrap((req) => prescriptionService.cancelPrescriptionItem(req.params.itemId, req.auth, requestMeta(req)), 'Hủy thuốc trong đơn thành công.'),
  completePrescriptionItem: wrap((req) => prescriptionService.completePrescriptionItem(req.params.itemId, req.auth, requestMeta(req)), 'Hoàn tất item thuốc thành công.'),
  removePrescriptionItem: wrap((req) => prescriptionService.removePrescriptionItem(req.params.itemId, req.auth, requestMeta(req)), 'Gỡ item thuốc khỏi đơn thành công.'),
  createMedication: wrap((req) => prescriptionService.createMedication(req.body, req.auth, requestMeta(req)), 'Tạo thuốc thành công.', 201),
  listMedications: wrap((req) => prescriptionService.listMedications(req.query), 'Lấy danh sách thuốc thành công.'),
  searchMedications: wrap((req) => prescriptionService.searchMedications(req.query), 'Tìm kiếm thuốc thành công.'),
  getMedicationDetail: wrap((req) => prescriptionService.getMedicationDetail(req.params.medicationId), 'Lấy chi tiết thuốc thành công.'),
  updateMedication: wrap((req) => prescriptionService.updateMedication(req.params.medicationId, req.body, req.auth, requestMeta(req)), 'Cập nhật thuốc thành công.'),
  updateMedicationStatus: wrap((req) => prescriptionService.updateMedicationStatus(req.params.medicationId, req.body.status, req.auth, requestMeta(req)), 'Cập nhật trạng thái thuốc thành công.'),
  getEncounterPrescriptions: wrap((req) => prescriptionService.getEncounterPrescriptions(req.params.encounterId, req.query), 'Lấy đơn thuốc theo encounter thành công.'),
  getPatientPrescriptionHistory: wrap((req) => prescriptionService.getPatientPrescriptionHistory(req.params.patientId, req.query), 'Lấy lịch sử đơn thuốc của bệnh nhân thành công.'),
  getPatientActivePrescriptions: wrap((req) => prescriptionService.getPatientActivePrescriptions(req.params.patientId, req.query), 'Lấy đơn thuốc active của bệnh nhân thành công.'),
  getDoctorPrescriptions: wrap((req) => prescriptionService.getDoctorPrescriptions(req.params.doctorId, req.query), 'Lấy đơn thuốc theo bác sĩ thành công.'),
  duplicatePrescription: wrap(
    (req) => prescriptionService.duplicatePrescription(req.params.prescriptionId, req.body, req.auth, requestMeta(req)),
    'Nhân bản đơn thuốc thành công.',
    201,
  ),
  renewPrescription: wrap(
    (req) => prescriptionService.renewPrescription(req.params.prescriptionId, req.body, req.auth, requestMeta(req)),
    'Gia hạn đơn thuốc thành công.',
    201,
  ),
  checkDrugAllergyConflict: wrap((req) => prescriptionService.checkDrugAllergyConflict(req.body), 'Kiểm tra xung đột dị ứng thuốc thành công.'),
  checkDrugInteractionConflict: wrap((req) => prescriptionService.checkDrugInteractionConflict(req.body), 'Kiểm tra tương tác thuốc thành công.'),
  checkDuplicateMedicationInPrescription: wrap(
    (req) =>
      prescriptionService.checkDuplicateMedicationInPrescription(
        req.body.prescription_id,
        req.body.medication_id,
        req.body.exclude_item_id,
      ),
    'Kiểm tra thuốc trùng trong đơn thành công.',
  ),
  calculatePrescriptionItemQuantity: wrap(
    (req) => ({ quantity: prescriptionService.calculatePrescriptionItemQuantity(req.body) }),
    'Tính số lượng thuốc gợi ý thành công.',
  ),
};
