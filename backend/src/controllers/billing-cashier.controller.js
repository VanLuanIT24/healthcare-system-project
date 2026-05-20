const billingCashierService = require('../services/billing-cashier.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getWorkbench: wrap((req) => billingCashierService.getWorkbench(req.query, req.auth), 'Lấy workbench quầy thu tiền thành công.'),
  search: wrap((req) => billingCashierService.searchCashier(req.query, req.auth), 'Tìm kiếm quầy thu tiền thành công.'),
  listInvoices: wrap((req) => billingCashierService.listCashierInvoices(req.query, req.auth), 'Lấy danh sách hóa đơn quầy thu thành công.'),
  listUnpaidInvoices: wrap((req) => billingCashierService.listCashierInvoices({ ...req.query, status_group: 'unpaid' }, req.auth), 'Lấy hóa đơn chưa thanh toán thành công.'),
  listPartialInvoices: wrap((req) => billingCashierService.listCashierInvoices({ ...req.query, status_group: 'partial' }, req.auth), 'Lấy hóa đơn thanh toán một phần thành công.'),
  collectPayment: wrap((req) => billingCashierService.collectInvoicePayment(req.params.invoiceId, req.body, req.auth, requestMeta(req)), 'Thu tiền hóa đơn thành công.', 201),
  listManualPayments: wrap((req) => billingCashierService.listManualPayments(req.query, req.auth), 'Lấy danh sách payment manual của quầy thu thành công.'),
  confirmManualPayment: wrap((req) => billingCashierService.confirmManualPayment(req.params.paymentId || req.params.intentId, req.body, req.auth, requestMeta(req)), 'Xác nhận payment manual thành công.'),
  rejectManualPayment: wrap((req) => billingCashierService.rejectManualPayment(req.params.paymentId || req.params.intentId, req.body, req.auth, requestMeta(req)), 'Từ chối payment manual thành công.'),
  refundManualPayment: wrap((req) => billingCashierService.refundManualPayment(req.params.paymentId || req.params.intentId, req.body, req.auth, requestMeta(req)), 'Ghi nhận hoàn tiền manual thành công.'),
  checkTransactionRef: wrap((req) => billingCashierService.checkTransactionRef(req.query, req.auth), 'Kiểm tra mã giao dịch thành công.'),
  getCurrentShift: wrap((req) => billingCashierService.getCurrentShift(req.auth), 'Lấy ca thu ngân hiện tại thành công.'),
  openShift: wrap((req) => billingCashierService.openShift(req.body, req.auth, requestMeta(req)), 'Mở ca thu ngân thành công.', 201),
  closeShift: wrap((req) => billingCashierService.closeShift(req.params.shiftId, req.body, req.auth, requestMeta(req)), 'Đóng ca thu ngân thành công.'),
  getShiftSummary: wrap((req) => billingCashierService.getShiftSummary(req.params.shiftId, req.auth), 'Lấy tổng kết ca thu ngân thành công.'),
  createReceiptPrintLog: wrap((req) => billingCashierService.createReceiptPrintLog(req.params.paymentId, req.body, req.auth, requestMeta(req)), 'Ghi nhận in biên lai thành công.', 201),
  listReceiptPrintLogs: wrap((req) => billingCashierService.listReceiptPrintLogs(req.params.paymentId, req.auth), 'Lấy log in biên lai thành công.'),
};
