import { request, unwrapData } from '../../../utils/api';

const unwrap = (response) => unwrapData(response);

export const reportsFinanceApi = {
  dashboard: (params) => request('/reports/finance/dashboard', { params }).then(unwrap),
  revenue: (params) => request('/reports/finance/revenue', { params }).then(unwrap),
  accountsReceivable: (params) => request('/reports/finance/accounts-receivable', { params }).then(unwrap),
  arAging: (params) => request('/reports/finance/ar-aging', { params }).then(unwrap),
  invoices: (params) => request('/reports/finance/invoices', { params }).then(unwrap),
  payments: (params) => request('/reports/finance/payments', { params }).then(unwrap),
  paymentMethods: (params) => request('/reports/finance/payment-methods', { params }).then(unwrap),
  refundVoid: (params) => request('/reports/finance/refund-void', { params }).then(unwrap),
  reconciliation: (params) => request('/reports/finance/reconciliation', { params }).then(unwrap),
  insurance: (params) => request('/reports/finance/insurance', { params }).then(unwrap),
  exportReport: (params) => request('/reports/export', { params }).then(unwrap),
};

