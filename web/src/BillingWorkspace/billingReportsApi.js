import { getApiErrorMessage, request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

export const billingReportsAPI = {
  summary: (params) => request('/reports/billing/summary', { params }).then(unwrap),
  revenue: (params) => request('/reports/billing/revenue', { params }).then(unwrap),
  receivables: (params) => request('/reports/billing/receivables', { params }).then(unwrap),
  paymentMethods: (params) => request('/reports/billing/payment-methods', { params }).then(unwrap),
  departments: (params) => request('/reports/billing/departments', { params }).then(unwrap),
  refundsVoids: (params) => request('/reports/billing/refunds-voids', { params }).then(unwrap),
  insurance: (params) => request('/reports/billing/insurance', { params }).then(unwrap),
  drilldown: (params) => request('/reports/billing/drilldown', { params }).then(unwrap),
  export: (params) => request('/reports/billing/export', { params }).then(unwrap),
};

export function getBillingReportErrorMessage(error, fallback = 'Không thể tải báo cáo viện phí.') {
  return getApiErrorMessage(error, fallback);
}
