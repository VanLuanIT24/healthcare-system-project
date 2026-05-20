const clinicalChargeService = require('../services/clinical-charge.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getDashboard: wrap((req) => clinicalChargeService.getDashboard(req.query, req.auth), 'Lấy dashboard charge cận lâm sàng thành công.'),
  getActionQueue: wrap((req) => clinicalChargeService.getActionQueue(req.query, req.auth), 'Lấy charge action queue thành công.'),
  listMissing: wrap((req) => clinicalChargeService.listMissing(req.query, req.auth), 'Lấy danh sách chờ tạo charge thành công.'),
  listByOrder: wrap((req) => clinicalChargeService.listByOrder(req.query, req.auth), 'Lấy charge theo order thành công.'),
  listCharges: wrap((req) => clinicalChargeService.listCharges(req.query, req.auth), 'Lấy danh sách clinical charge thành công.'),
  listLabCharges: wrap((req) => clinicalChargeService.listLabCharges(req.query, req.auth), 'Lấy danh sách charge xét nghiệm thành công.'),
  listImagingCharges: wrap((req) => clinicalChargeService.listImagingCharges(req.query, req.auth), 'Lấy danh sách charge chẩn đoán hình ảnh thành công.'),
  listProcedureCharges: wrap((req) => clinicalChargeService.listProcedureCharges(req.query, req.auth), 'Lấy danh sách charge thủ thuật thành công.'),
  listPosted: wrap((req) => clinicalChargeService.listPosted(req.query, req.auth), 'Lấy charge đã post thành công.'),
  listUnbilled: wrap((req) => clinicalChargeService.listUnbilled(req.query, req.auth), 'Lấy charge chưa lên hóa đơn thành công.'),
  listBilled: wrap((req) => clinicalChargeService.listBilled(req.query, req.auth), 'Lấy charge đã lên hóa đơn thành công.'),
  listExceptions: wrap((req) => clinicalChargeService.listExceptions(req.query, req.auth), 'Lấy lỗi charge cận lâm sàng thành công.'),
  getReconciliation: wrap((req) => clinicalChargeService.getReconciliation(req.query, req.auth), 'Lấy đối soát charge thành công.'),
  getOrderChargeContext: wrap((req) => clinicalChargeService.getOrderChargeContext(req.params.orderId, req.auth), 'Lấy charge context của order thành công.'),

  bulkCreateFromOrders: wrap((req) => clinicalChargeService.bulkCreateFromOrders(req.body, req.auth, requestMeta(req)), 'Tạo charge hàng loạt thành công.', 201),
  bulkPost: wrap((req) => clinicalChargeService.bulkPost(req.body, req.auth, requestMeta(req)), 'Post charge hàng loạt thành công.'),
  bulkVoid: wrap((req) => clinicalChargeService.bulkVoid(req.body, req.auth, requestMeta(req)), 'Void charge hàng loạt thành công.'),
  markReview: wrap((req) => clinicalChargeService.markReview(req.params.chargeId, req.body, req.auth, requestMeta(req)), 'Đánh dấu charge cần review thành công.'),
  resolveReview: wrap((req) => clinicalChargeService.resolveReview(req.params.chargeId, req.body, req.auth, requestMeta(req)), 'Resolve review charge thành công.'),
  sendToBillingReview: wrap((req) => clinicalChargeService.sendToBillingReview(req.params.chargeId, req.body, req.auth, requestMeta(req)), 'Gửi charge sang Billing review thành công.'),
  createReplacement: wrap((req) => clinicalChargeService.createReplacement(req.params.chargeId, req.body, req.auth, requestMeta(req)), 'Tạo replacement charge thành công.', 201),
};
