const financeReportService = require('../services/finance-report.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  dashboard: wrap((req) => financeReportService.getDashboard(req.query, req.auth), 'Lấy dashboard tài chính thành công.'),
  revenue: wrap((req) => financeReportService.getRevenue(req.query, req.auth), 'Lấy báo cáo doanh thu tài chính thành công.'),
  accountsReceivable: wrap((req) => financeReportService.getAccountsReceivable(req.query, req.auth), 'Lấy báo cáo công nợ thành công.'),
  arAging: wrap((req) => financeReportService.getArAging(req.query, req.auth), 'Lấy aging công nợ thành công.'),
  invoices: wrap((req) => financeReportService.getInvoices(req.query, req.auth), 'Lấy báo cáo hóa đơn thành công.'),
  payments: wrap((req) => financeReportService.getPayments(req.query, req.auth), 'Lấy báo cáo thanh toán thành công.'),
  paymentMethods: wrap((req) => financeReportService.getPaymentMethods(req.query, req.auth), 'Lấy báo cáo payment method thành công.'),
  refundVoid: wrap((req) => financeReportService.getRefundVoid(req.query, req.auth), 'Lấy refund/void ledger thành công.'),
  reconciliation: wrap((req) => financeReportService.getReconciliation(req.query, req.auth), 'Lấy báo cáo đối soát thành công.'),
  insurance: wrap((req) => financeReportService.getInsurance(req.query, req.auth), 'Lấy báo cáo bảo hiểm thành công.'),
};

