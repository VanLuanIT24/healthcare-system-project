import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function id(value) {
  return encodeURIComponent(value);
}

export const billingRefundVoidAPI = {
  summary: (params) => request('/billing/refund-void/summary', { params }).then(unwrap),
  history: (params) => request('/billing/refund-void/history', { params }).then(unwrap),
  refunds: (params) => request('/billing/refunds', { params }).then(unwrap),
  refundDetail: (refundId) => request(`/billing/refunds/${id(refundId)}`).then(unwrap),
  createRefund: (paymentId, body) =>
    request(`/billing/payments/${id(paymentId)}/refunds`, { method: 'POST', body }).then(unwrap),
  reviewRefund: (refundId, body = {}) =>
    request(`/billing/refunds/${id(refundId)}/review`, { method: 'POST', body }).then(unwrap),
  approveRefund: (refundId, body = {}) =>
    request(`/billing/refunds/${id(refundId)}/approve`, { method: 'POST', body }).then(unwrap),
  rejectRefund: (refundId, body = {}) =>
    request(`/billing/refunds/${id(refundId)}/reject`, { method: 'POST', body }).then(unwrap),
  processRefund: (refundId, body = {}) =>
    request(`/billing/refunds/${id(refundId)}/process`, { method: 'POST', body }).then(unwrap),
  markRefundPaid: (refundId, body = {}) =>
    request(`/billing/refunds/${id(refundId)}/mark-paid`, { method: 'POST', body }).then(unwrap),
  cancelRefund: (refundId, body = {}) =>
    request(`/billing/refunds/${id(refundId)}/cancel`, { method: 'POST', body }).then(unwrap),
  addEvidence: (refundId, body = {}) =>
    request(`/billing/refunds/${id(refundId)}/evidence`, { method: 'POST', body }).then(unwrap),
  paymentRefundPreview: (paymentId) => request(`/billing/payments/${id(paymentId)}/refund-preview`).then(unwrap),
  paymentVoidPreview: (paymentId) => request(`/billing/payments/${id(paymentId)}/void-preview`).then(unwrap),
  invoiceVoidPreview: (invoiceId) => request(`/billing/invoices/${id(invoiceId)}/void-preview`).then(unwrap),
  payments: (params) => request('/billing/payments', { params }).then(unwrap),
  paymentDetail: (paymentId) => request(`/billing/payments/${id(paymentId)}`).then(unwrap),
  voidPayment: (paymentId, body = {}) =>
    request(`/billing/payments/${id(paymentId)}/void`, { method: 'POST', body }).then(unwrap),
  invoices: (params) => request('/billing/invoices', { params }).then(unwrap),
  invoiceDetail: (invoiceId) => request(`/billing/invoices/${id(invoiceId)}`).then(unwrap),
  voidInvoice: (invoiceId, body = {}) =>
    request(`/billing/invoices/${id(invoiceId)}/void`, { method: 'POST', body }).then(unwrap),
};

export function getRefundVoidErrorMessage(error, fallback = 'Không thể xử lý dữ liệu hoàn tiền / hủy.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
