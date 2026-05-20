import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

export const billingOverviewAPI = {
  dashboard: (params) => request('/billing-overview/dashboard', { params }).then(unwrap),
  tasks: (params) => request('/billing-overview/tasks', { params }).then(unwrap),
  todayRevenue: (params) => request('/billing-overview/today-revenue', { params }).then(unwrap),
  unpaidInvoices: (params) => request('/billing-overview/unpaid-invoices', { params }).then(unwrap),
  paymentConfirmations: (params) => request('/billing-overview/payment-confirmations', { params }).then(unwrap),
  paymentErrors: (params) => request('/billing-overview/payment-errors', { params }).then(unwrap),
  debts: (params) => request('/billing-overview/debts', { params }).then(unwrap),
  activityFeed: (params) => request('/billing-overview/activity-feed', { params }).then(unwrap),
  invoiceDetail: (invoiceId) => request(`/billing/invoices/${encodeURIComponent(invoiceId)}`).then(unwrap),
  paymentDetail: (paymentId) => request(`/billing/payments/${encodeURIComponent(paymentId)}`).then(unwrap),
  intentDetail: (intentId) => request(`/billing/payment-intents/${encodeURIComponent(intentId)}`).then(unwrap),
  createInvoicePayment: (invoiceId, body) =>
    request(`/billing/invoices/${encodeURIComponent(invoiceId)}/payments`, { method: 'POST', body }).then(unwrap),
  createPaymentIntent: (invoiceId, body) =>
    request(`/billing/invoices/${encodeURIComponent(invoiceId)}/payment-intents`, { method: 'POST', body }).then(unwrap),
  confirmManualPayment: (intentId, body) =>
    request(`/billing/manual-payments/${encodeURIComponent(intentId)}/confirm`, { method: 'POST', body }).then(unwrap),
  rejectManualPayment: (intentId, body) =>
    request(`/billing/manual-payments/${encodeURIComponent(intentId)}/reject`, { method: 'POST', body }).then(unwrap),
  markManualReview: (intentId, body) =>
    request(`/billing/payment-intents/${encodeURIComponent(intentId)}/manual-review`, { method: 'POST', body }).then(unwrap),
  refundManualPayment: (intentId, body) =>
    request(`/billing/manual-payments/${encodeURIComponent(intentId)}/refund-manual`, { method: 'POST', body }).then(unwrap),
};

export function getBillingOverviewErrorMessage(error, fallback = 'Không thể tải dữ liệu viện phí.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
