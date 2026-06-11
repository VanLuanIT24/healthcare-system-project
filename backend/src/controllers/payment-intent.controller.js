const paymentIntentService = require('../services/payment-intent.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  createPaymentIntent: wrap((req) => paymentIntentService.createPaymentIntent(req.params.invoiceId, req.body, req.auth, requestMeta(req)), 'Tạo payment intent thành công.', 201),
  getPaymentIntent: wrap((req) => paymentIntentService.getPaymentIntent(req.params.intentId, req.auth), 'Lấy payment intent thành công.'),
  queryProviderStatus: wrap((req) => paymentIntentService.queryProviderStatus(req.params.intentId, req.auth, requestMeta(req)), 'Truy vấn trạng thái provider thành công.'),
  listPaymentIntents: wrap((req) => paymentIntentService.listPaymentIntents(req.query, req.auth), 'Lấy danh sách payment intent thành công.'),
  confirmBankTransfer: wrap((req) => paymentIntentService.confirmBankTransfer(req.params.intentId, req.body, req.auth, requestMeta(req)), 'Xác nhận chuyển khoản thành công.'),
  confirmDemoPayment: wrap((req) => paymentIntentService.confirmDemoPayment(req.params.intentId, req.body, req.auth, requestMeta(req)), 'Thanh toán thử nghiệm thành công.'),
  rejectBankTransfer: wrap((req) => paymentIntentService.rejectBankTransfer(req.params.intentId, req.body, req.auth, requestMeta(req)), 'Từ chối chuyển khoản thành công.'),
  markManualReview: wrap((req) => paymentIntentService.markManualReview(req.params.intentId, req.body, req.auth, requestMeta(req)), 'Đưa payment vào manual review thành công.'),
  submitManualReceipt: wrap((req) => paymentIntentService.submitManualReceipt(req.params.paymentId, req.body, req.auth, requestMeta(req)), 'Gửi biên lai thanh toán thành công.'),
  listManualPayments: wrap((req) => paymentIntentService.listManualPayments(req.query, req.auth), 'Lấy danh sách payment manual thành công.'),
  confirmManualPayment: wrap((req) => paymentIntentService.confirmManualPayment(req.params.intentId || req.params.paymentId, req.body, req.auth, requestMeta(req)), 'Xác nhận payment manual thành công.'),
  rejectManualPayment: wrap((req) => paymentIntentService.rejectManualPayment(req.params.intentId || req.params.paymentId, req.body, req.auth, requestMeta(req)), 'Từ chối payment manual thành công.'),
  refundManualPayment: wrap((req) => paymentIntentService.refundManualPayment(req.params.intentId || req.params.paymentId, req.body, req.auth, requestMeta(req)), 'Ghi nhận hoàn tiền thủ công thành công.'),
  listAvailableProviders: wrap(() => paymentIntentService.listAvailableProviders(), 'Lấy danh sách provider thanh toán thành công.'),
  getPaymentReceipt: wrap((req) => paymentIntentService.getPaymentReceipt(req.params.paymentId, req.auth, requestMeta(req)), 'Lấy receipt payment thành công.'),
  requestRefund: wrap((req) => paymentIntentService.requestRefund(req.params.paymentId, req.body, req.auth, requestMeta(req)), 'Tạo yêu cầu refund thành công.', 201),
};
