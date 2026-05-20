import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function id(value) {
  return encodeURIComponent(value);
}

export const billingReconciliationAPI = {
  overview: (params) => request('/billing/reconciliation/overview', { params }).then(unwrap),
  paymentIntents: (params) => request('/billing/payment-intents', { params }).then(unwrap),
  intentDetail: (intentId) => request(`/billing/payment-intents/${id(intentId)}`).then(unwrap),
  manualPayments: (params) => request('/billing/manual-payments', { params }).then(unwrap),
  confirmManualPayment: (intentId, body) =>
    request(`/billing/manual-payments/${id(intentId)}/confirm`, { method: 'POST', body }).then(unwrap),
  rejectManualPayment: (intentId, body) =>
    request(`/billing/manual-payments/${id(intentId)}/reject`, { method: 'POST', body }).then(unwrap),
  confirmBankTransfer: (intentId, body) =>
    request(`/billing/payment-intents/${id(intentId)}/confirm-bank-transfer`, { method: 'POST', body }).then(unwrap),
  rejectBankTransfer: (intentId, body) =>
    request(`/billing/payment-intents/${id(intentId)}/reject-bank-transfer`, { method: 'POST', body }).then(unwrap),
  markManualReview: (intentId, body) =>
    request(`/billing/payment-intents/${id(intentId)}/manual-review`, { method: 'POST', body }).then(unwrap),
  invoiceDetail: (invoiceId) => request(`/billing/invoices/${id(invoiceId)}`).then(unwrap),
  paymentDetail: (paymentId) => request(`/billing/payments/${id(paymentId)}`).then(unwrap),
  paymentReceipt: (paymentId) => request(`/billing/payments/${id(paymentId)}/receipt`).then(unwrap),

  batches: (params) => request('/billing/reconciliation/batches', { params }).then(unwrap),
  createBatch: (body) => request('/billing/reconciliation/batches', { method: 'POST', body }).then(unwrap),
  batchDetail: (batchId) => request(`/billing/reconciliation/batches/${id(batchId)}`).then(unwrap),
  closeBatch: (batchId, body) =>
    request(`/billing/reconciliation/batches/${id(batchId)}/close`, { method: 'POST', body }).then(unwrap),
  lockBatch: (batchId, body) =>
    request(`/billing/reconciliation/batches/${id(batchId)}/lock`, { method: 'POST', body }).then(unwrap),
  importTransactions: (body) => request('/billing/reconciliation/import', { method: 'POST', body }).then(unwrap),
  transactions: (params) => request('/billing/reconciliation/transactions', { params }).then(unwrap),
  transactionDetail: (transactionId) => request(`/billing/reconciliation/transactions/${id(transactionId)}`).then(unwrap),
  transactionCandidates: (transactionId) =>
    request(`/billing/reconciliation/transactions/${id(transactionId)}/candidates`).then(unwrap),
  autoMatch: (body) => request('/billing/reconciliation/auto-match', { method: 'POST', body }).then(unwrap),
  matchIntent: (transactionId, body) =>
    request(`/billing/reconciliation/transactions/${id(transactionId)}/match-intent`, { method: 'POST', body }).then(unwrap),
  matchInvoice: (transactionId, body) =>
    request(`/billing/reconciliation/transactions/${id(transactionId)}/match-invoice`, { method: 'POST', body }).then(unwrap),
  markUnmatched: (transactionId, body) =>
    request(`/billing/reconciliation/transactions/${id(transactionId)}/mark-unmatched`, { method: 'POST', body }).then(unwrap),
  ignoreTransaction: (transactionId, body) =>
    request(`/billing/reconciliation/transactions/${id(transactionId)}/ignore`, { method: 'POST', body }).then(unwrap),
  disputeTransaction: (transactionId, body) =>
    request(`/billing/reconciliation/transactions/${id(transactionId)}/dispute`, { method: 'POST', body }).then(unwrap),
  dailyReport: (params) => request('/billing/reconciliation/reports/daily', { params }).then(unwrap),
  providerReport: (params) => request('/billing/reconciliation/reports/provider', { params }).then(unwrap),
  exportReport: (params) => request('/billing/reconciliation/reports/export', { params }).then(unwrap),
};

export function getReconciliationErrorMessage(error, fallback = 'Không thể xử lý dữ liệu đối soát.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
