const billingOverviewService = require('../services/billing-overview.service');
const { controllerHandler: wrap } = require('../common/controllers');

module.exports = {
  getDashboard: wrap((req) => billingOverviewService.getBillingDashboardOverview(req.query, req.auth), 'Lấy tổng quan viện phí thành công.'),
  getTasks: wrap((req) => billingOverviewService.getBillingWorkQueue(req.query, req.auth), 'Lấy việc cần xử lý viện phí thành công.'),
  getTodayRevenue: wrap((req) => billingOverviewService.getTodayRevenueOverview(req.query, req.auth), 'Lấy doanh thu hôm nay thành công.'),
  getUnpaidInvoices: wrap((req) => billingOverviewService.getUnpaidInvoiceQueue(req.query, req.auth), 'Lấy hóa đơn chờ thu thành công.'),
  getPaymentConfirmations: wrap((req) => billingOverviewService.getPaymentConfirmationQueue(req.query, req.auth), 'Lấy payment cần xác nhận thành công.'),
  getPaymentErrors: wrap((req) => billingOverviewService.getPaymentErrorQueue(req.query, req.auth), 'Lấy payment lỗi thành công.'),
  getDebts: wrap((req) => billingOverviewService.getDebtAgingOverview(req.query, req.auth), 'Lấy công nợ thành công.'),
  getActivityFeed: wrap((req) => billingOverviewService.getRecentBillingActivity(req.query, req.auth), 'Lấy activity viện phí thành công.'),
};
