const receiptService = require('../services/receipt.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  listReceipts: wrap((req) => receiptService.listReceipts(req.query, req.auth), 'Lấy danh sách biên lai thành công.'),
  generateReceiptFromPayment: wrap((req) => receiptService.generateReceiptFromPayment(req.params.paymentId, req.body, req.auth, requestMeta(req)), 'Tạo biên lai từ payment thành công.', 201),
  getReceiptDetail: wrap((req) => receiptService.getReceiptDetail(req.params.receiptId, req.auth, { requestMeta: requestMeta(req) }), 'Lấy chi tiết biên lai thành công.'),
  getReceiptByPayment: wrap((req) => receiptService.getReceiptByPayment(req.params.paymentId, req.auth, requestMeta(req)), 'Lấy biên lai theo payment thành công.'),
  printReceipt: wrap((req) => receiptService.printReceipt(req.params.receiptId, req.body, req.auth, requestMeta(req)), 'Ghi nhận in biên lai thành công.'),
  reprintReceipt: wrap((req) => receiptService.reprintReceipt(req.params.receiptId, req.body, req.auth, requestMeta(req)), 'Ghi nhận in lại biên lai thành công.'),
  downloadReceipt: wrap((req) => receiptService.downloadReceipt(req.params.receiptId, req.auth, requestMeta(req)), 'Tải biên lai thành công.'),
  sendReceipt: wrap((req) => receiptService.sendReceipt(req.params.receiptId, req.body, req.auth, requestMeta(req)), 'Gửi biên lai thành công.'),
  listPrintLogs: wrap((req) => receiptService.listPrintLogs(req.params.receiptId, req.auth), 'Lấy lịch sử in biên lai thành công.'),
  getReceiptHistory: wrap((req) => receiptService.getReceiptHistory(req.params.receiptId, req.auth), 'Lấy lịch sử biên lai thành công.'),
  getPaymentReceiptHistory: wrap((req) => receiptService.getPaymentReceiptHistory(req.params.paymentId, req.auth), 'Lấy lịch sử biên lai payment thành công.'),
  listReceiptHistory: wrap((req) => receiptService.listReceiptHistory(req.query, req.auth), 'Lấy audit biên lai thành công.'),
  bulkPrintReceipts: wrap((req) => receiptService.bulkPrintReceipts(req.body, req.auth, requestMeta(req)), 'In hàng loạt biên lai thành công.'),
  exportReceipts: wrap((req) => receiptService.exportReceipts(req.body || req.query, req.auth, requestMeta(req)), 'Export biên lai thành công.'),
  getMyReceipts: wrap((req) => receiptService.getMyReceipts(req.query, req.auth), 'Lấy biên lai của tôi thành công.'),
  getMyReceiptDetail: wrap((req) => receiptService.getMyReceiptDetail(req.params.receiptId, req.auth), 'Lấy chi tiết biên lai của tôi thành công.'),
  downloadMyReceipt: wrap((req) => receiptService.downloadMyReceipt(req.params.receiptId, req.auth, requestMeta(req)), 'Tải biên lai của tôi thành công.'),
};
