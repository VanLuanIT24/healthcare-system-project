const pharmacyInpatientMedicationService = require('../services/pharmacy-inpatient-medication.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getScheduleBoard: wrap((req) => pharmacyInpatientMedicationService.getScheduleBoard(req.query, req.auth), 'Lấy lịch dùng thuốc nội trú thành công.'),
  getTodayCommandCenter: wrap((req) => pharmacyInpatientMedicationService.getTodayCommandCenter(req.query, req.auth), 'Lấy queue thuốc cần dùng hôm nay thành công.'),
  getConfirmWorkbench: wrap((req) => pharmacyInpatientMedicationService.getConfirmWorkbench(req.query, req.auth), 'Lấy workbench xác nhận dùng thuốc thành công.'),
  getExceptionCenter: wrap((req) => pharmacyInpatientMedicationService.getExceptionCenter(req.query, req.auth), 'Lấy ngoại lệ dùng thuốc thành công.'),
  listReactions: wrap((req) => pharmacyInpatientMedicationService.listMedicationReactions(req.query, req.auth), 'Lấy bất thường dùng thuốc thành công.'),
  getReactionDetail: wrap((req) => pharmacyInpatientMedicationService.getMedicationReactionDetail(req.params.reactionId, req.auth), 'Lấy chi tiết bất thường dùng thuốc thành công.'),
  pharmacistReviewReaction: wrap((req) => pharmacyInpatientMedicationService.updateReactionReview(req.params.reactionId, req.body, req.auth, requestMeta(req)), 'Dược sĩ review bất thường dùng thuốc thành công.'),
  resolveReaction: wrap((req) => pharmacyInpatientMedicationService.resolveReaction(req.params.reactionId, req.body, req.auth, requestMeta(req)), 'Đóng bất thường dùng thuốc thành công.'),
  createIntervention: wrap((req) => pharmacyInpatientMedicationService.createMedicationIntervention(req.body, req.auth, requestMeta(req)), 'Tạo can thiệp dược nội trú thành công.', 201),
};
