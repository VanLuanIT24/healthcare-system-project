const pharmacyDispensingService = require('../services/pharmacy-dispensing.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getQueue: wrap((req) => pharmacyDispensingService.getDispensingQueue(req.query, req.auth), 'Lấy queue cấp phát thành công.'),
  getQueueSummary: wrap((req) => pharmacyDispensingService.getDispensingQueueSummary(req.query, req.auth), 'Lấy tổng quan queue cấp phát thành công.'),
  getAnalytics: wrap((req) => pharmacyDispensingService.getDispensingAnalytics(req.query, req.auth), 'Lấy analytics cấp phát thành công.'),
  getTimeline: wrap((req) => pharmacyDispensingService.getDispenseTimeline(req.params.dispenseId, req.auth), 'Lấy timeline cấp phát thành công.'),

  assignDispense: wrap((req) => pharmacyDispensingService.assignDispense(req.params.dispenseId, req.body, req.auth, requestMeta(req)), 'Gán phiếu cấp phát thành công.'),
  startPreparation: wrap((req) => pharmacyDispensingService.startDispensePreparation(req.params.dispenseId, req.body, req.auth, requestMeta(req)), 'Bắt đầu chuẩn bị phiếu cấp phát thành công.'),
  changeStage: wrap((req) => pharmacyDispensingService.changeDispenseStage(req.params.dispenseId, req.body, req.auth, requestMeta(req)), 'Đổi stage phiếu cấp phát thành công.'),
  lockDispense: wrap((req) => pharmacyDispensingService.lockDispense(req.params.dispenseId, req.body, req.auth, requestMeta(req)), 'Khóa phiếu cấp phát thành công.'),
  unlockDispense: wrap((req) => pharmacyDispensingService.unlockDispense(req.params.dispenseId, req.body, req.auth, requestMeta(req)), 'Mở khóa phiếu cấp phát thành công.'),

  getChecklist: wrap((req) => pharmacyDispensingService.getDispenseChecklist(req.params.dispenseId, req.auth), 'Lấy checklist cấp phát thành công.'),
  updateChecklistItem: wrap((req) => pharmacyDispensingService.updateDispenseChecklistItem(req.params.dispenseId, req.params.code, req.body, req.auth, requestMeta(req)), 'Cập nhật checklist cấp phát thành công.'),
  completeChecklist: wrap((req) => pharmacyDispensingService.completeDispenseChecklist(req.params.dispenseId, req.body, req.auth, requestMeta(req)), 'Hoàn tất checklist cấp phát thành công.'),

  createHold: wrap((req) => pharmacyDispensingService.createDispenseHold(req.params.dispenseId, req.body, req.auth, requestMeta(req)), 'Tạo hold cấp phát thành công.', 201),
  listHolds: wrap((req) => pharmacyDispensingService.listDispenseHolds(req.query, req.auth), 'Lấy danh sách hold cấp phát thành công.'),
  getHoldDetail: wrap((req) => pharmacyDispensingService.getDispenseHoldDetail(req.params.holdId, req.auth), 'Lấy chi tiết hold cấp phát thành công.'),
  resolveHold: wrap((req) => pharmacyDispensingService.resolveDispenseHold(req.params.holdId, req.body, req.auth, requestMeta(req)), 'Gỡ hold cấp phát thành công.'),
  rejectHold: wrap((req) => pharmacyDispensingService.rejectDispenseHold(req.params.holdId, req.body, req.auth, requestMeta(req)), 'Từ chối hold cấp phát thành công.'),
  cancelHold: wrap((req) => pharmacyDispensingService.cancelDispenseHold(req.params.holdId, req.body, req.auth, requestMeta(req)), 'Hủy hold cấp phát thành công.'),

  previewReturn: wrap((req) => pharmacyDispensingService.previewDispenseReturn(req.params.dispenseId, req.body, req.auth), 'Preview hoàn trả thuốc thành công.'),
  createReturn: wrap((req) => pharmacyDispensingService.createDispenseReturn(req.params.dispenseId, req.body, req.auth, requestMeta(req)), 'Tạo hoàn trả thuốc thành công.', 201),
  listReturns: wrap((req) => pharmacyDispensingService.listDispenseReturns(req.query, req.auth), 'Lấy danh sách hoàn trả thuốc thành công.'),
  getReturnDetail: wrap((req) => pharmacyDispensingService.getDispenseReturnDetail(req.params.returnId, req.auth), 'Lấy chi tiết hoàn trả thuốc thành công.'),
  approveReturn: wrap((req) => pharmacyDispensingService.approveDispenseReturn(req.params.returnId, req.body, req.auth, requestMeta(req)), 'Duyệt hoàn trả thuốc thành công.'),
  completeReturn: wrap((req) => pharmacyDispensingService.completeDispenseReturn(req.params.returnId, req.body, req.auth, requestMeta(req)), 'Hoàn tất hoàn trả thuốc thành công.'),
  cancelReturn: wrap((req) => pharmacyDispensingService.cancelDispenseReturn(req.params.returnId, req.body, req.auth, requestMeta(req)), 'Hủy hoàn trả thuốc thành công.'),

  labelPreview: wrap((req) => pharmacyDispensingService.previewDispenseLabels(req.params.dispenseId, req.auth), 'Preview nhãn thuốc thành công.'),
  printLabels: wrap((req) => pharmacyDispensingService.printDispenseLabels(req.params.dispenseId, req.body, req.auth, requestMeta(req)), 'Tạo print job nhãn thuốc thành công.', 201),
  printInstructions: wrap((req) => pharmacyDispensingService.printDispenseInstructions(req.params.dispenseId, req.body, req.auth, requestMeta(req)), 'Tạo print job hướng dẫn thuốc thành công.', 201),
  getDispensePrintJobs: wrap((req) => pharmacyDispensingService.getDispensePrintJobs(req.params.dispenseId, req.auth), 'Lấy print job của phiếu cấp phát thành công.'),
  listPrintJobs: wrap((req) => pharmacyDispensingService.listDispensePrintJobs(req.query, req.auth), 'Lấy danh sách print job cấp phát thành công.'),
};
