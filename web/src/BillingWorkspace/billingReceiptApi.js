import { getApiErrorMessage, request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function id(value) {
  return encodeURIComponent(value);
}

export const billingReceiptAPI = {
  payments: (params) => request('/billing/payments', { params }).then(unwrap),
  paymentDetail: (paymentId) => request(`/billing/payments/${id(paymentId)}`).then(unwrap),
  paymentReceipt: (paymentId) => request(`/billing/payments/${id(paymentId)}/receipts`).then(unwrap),
  generateReceipt: (paymentId, body = {}) =>
    request(`/billing/payments/${id(paymentId)}/receipts/generate`, { method: 'POST', body }).then(unwrap),
  paymentReceiptHistory: (paymentId) => request(`/billing/payments/${id(paymentId)}/receipt-history`).then(unwrap),

  receipts: (params) => request('/billing/receipts', { params }).then(unwrap),
  receiptDetail: (receiptId) => request(`/billing/receipts/${id(receiptId)}`).then(unwrap),
  receiptHistory: (receiptId) => request(`/billing/receipts/${id(receiptId)}/history`).then(unwrap),
  printLogs: (receiptId) => request(`/billing/receipts/${id(receiptId)}/print-logs`).then(unwrap),
  printReceipt: (receiptId, body = {}) =>
    request(`/billing/receipts/${id(receiptId)}/print`, { method: 'POST', body }).then(unwrap),
  reprintReceipt: (receiptId, body = {}) =>
    request(`/billing/receipts/${id(receiptId)}/reprint`, { method: 'POST', body }).then(unwrap),
  downloadReceipt: (receiptId) => request(`/billing/receipts/${id(receiptId)}/download`).then(unwrap),
  sendReceipt: (receiptId, body = {}) =>
    request(`/billing/receipts/${id(receiptId)}/send`, { method: 'POST', body }).then(unwrap),
  receiptAudit: (params) => request('/billing/receipts/history', { params }).then(unwrap),
  bulkPrint: (body = {}) => request('/billing/receipts/bulk-print', { method: 'POST', body }).then(unwrap),
  exportReceipts: (body = {}) => request('/billing/receipts/export', { method: 'POST', body }).then(unwrap),

  paymentIntents: (params) => request('/billing/payment-intents', { params }).then(unwrap),
  paymentIntentDetail: (intentId) => request(`/billing/payment-intents/${id(intentId)}`).then(unwrap),
  providerStatus: (intentId) => request(`/billing/payment-intents/${id(intentId)}/provider-status`).then(unwrap),
  confirmBankTransfer: (intentId, body) =>
    request(`/billing/payment-intents/${id(intentId)}/confirm-bank-transfer`, { method: 'POST', body }).then(unwrap),
  rejectBankTransfer: (intentId, body) =>
    request(`/billing/payment-intents/${id(intentId)}/reject-bank-transfer`, { method: 'POST', body }).then(unwrap),
  markManualReview: (intentId, body) =>
    request(`/billing/payment-intents/${id(intentId)}/manual-review`, { method: 'POST', body }).then(unwrap),
};

export function getBillingReceiptErrorMessage(error, fallback = 'Không thể xử lý dữ liệu biên lai.') {
  return getApiErrorMessage(error, fallback);
}
