const billingReportService = require('../services/billing-report.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  getSummary: wrap(
    (req) => billingReportService.getBillingSummaryReport(req.query, req.auth),
    'Lấy tổng quan báo cáo viện phí thành công.',
  ),
  getRevenue: wrap(
    (req) => billingReportService.getBillingRevenueReport(req.query, req.auth),
    'Lấy báo cáo doanh thu viện phí thành công.',
  ),
  getReceivables: wrap(
    (req) => billingReportService.getBillingReceivablesReport(req.query, req.auth),
    'Lấy báo cáo công nợ viện phí thành công.',
  ),
  getPaymentMethods: wrap(
    (req) => billingReportService.getBillingPaymentMethodsReport(req.query, req.auth),
    'Lấy báo cáo phương thức thanh toán thành công.',
  ),
  getDepartments: wrap(
    (req) => billingReportService.getBillingDepartmentReport(req.query, req.auth),
    'Lấy báo cáo viện phí theo khoa thành công.',
  ),
  getRefundsVoids: wrap(
    (req) => billingReportService.getBillingRefundVoidReport(req.query, req.auth),
    'Lấy báo cáo hoàn tiền/hủy thành công.',
  ),
  getInsurance: wrap(
    (req) => billingReportService.getBillingInsuranceReport(req.query, req.auth),
    'Lấy báo cáo bảo hiểm viện phí thành công.',
  ),
  getDrilldown: wrap(
    (req) => billingReportService.getBillingDrilldownReport(req.query, req.auth),
    'Lấy drilldown báo cáo viện phí thành công.',
  ),
  exportBillingReport: wrap(
    (req) => billingReportService.exportBillingReport(req.query, req.auth, requestMeta(req)),
    'Export báo cáo viện phí thành công.',
  ),
};
