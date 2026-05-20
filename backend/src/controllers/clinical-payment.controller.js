const clinicalPaymentService = require('../services/clinical-payment.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getDashboard: wrap((req) => clinicalPaymentService.getDashboard(req.query, req.auth), 'Lấy dashboard payment CLS thành công.'),
  listOrders: wrap((req) => clinicalPaymentService.listOrders(req.query, req.auth), 'Lấy payment gate theo order thành công.'),
  listWaitingPayment: wrap((req) => clinicalPaymentService.listWaitingPayment(req.query, req.auth), 'Lấy danh sách chờ thanh toán CLS thành công.'),
  listReadyToPerform: wrap((req) => clinicalPaymentService.listReadyToPerform(req.query, req.auth), 'Lấy danh sách sẵn sàng thực hiện thành công.'),
  listWaitingConfirmation: wrap((req) => clinicalPaymentService.listWaitingConfirmation(req.query, req.auth), 'Lấy danh sách chờ xác nhận payment thành công.'),
  listManualReview: wrap((req) => clinicalPaymentService.listManualReview(req.query, req.auth), 'Lấy manual review payment thành công.'),
  listPaymentErrors: wrap((req) => clinicalPaymentService.listPaymentErrors(req.query, req.auth), 'Lấy payment lỗi CLS thành công.'),
  getOrderPaymentGate: wrap((req) => clinicalPaymentService.getOrderPaymentGate(req.params.orderId, req.auth), 'Lấy payment gate của order thành công.'),
  createPaymentFlow: wrap((req) => clinicalPaymentService.createPaymentFlow(req.params.orderId, req.body, req.auth, requestMeta(req)), 'Tạo payment flow CLS thành công.', 201),
  getEncounterPaymentSummary: wrap((req) => clinicalPaymentService.getEncounterPaymentSummary(req.params.encounterId, req.auth), 'Lấy payment theo encounter thành công.'),
  confirmIntent: wrap((req) => clinicalPaymentService.confirmIntent(req.params.intentId, req.body, req.auth, requestMeta(req)), 'Xác nhận payment intent CLS thành công.'),
  rejectIntent: wrap((req) => clinicalPaymentService.rejectIntent(req.params.intentId, req.body, req.auth, requestMeta(req)), 'Từ chối payment intent CLS thành công.'),
  manualReviewIntent: wrap((req) => clinicalPaymentService.manualReviewIntent(req.params.intentId, req.body, req.auth, requestMeta(req)), 'Đưa payment intent vào manual review thành công.'),
  createOverride: wrap((req) => clinicalPaymentService.createOverride(req.params.orderId, req.body, req.auth, requestMeta(req)), 'Tạo payment override CLS thành công.', 201),
  listOverrides: wrap((req) => clinicalPaymentService.listOverrides(req.query, req.auth), 'Lấy danh sách payment override thành công.'),
  revokeOverride: wrap((req) => clinicalPaymentService.revokeOverride(req.params.overrideId, req.body, req.auth, requestMeta(req)), 'Revoke payment override thành công.'),
  listRefundVoidCases: wrap((req) => clinicalPaymentService.listRefundVoidCases(req.query, req.auth), 'Lấy refund/void cases CLS thành công.'),
};
