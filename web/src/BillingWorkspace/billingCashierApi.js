import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function id(value) {
  return encodeURIComponent(value);
}

export const billingCashierAPI = {
  topbarBootstrap: (params) => request('/billing-workspace/topbar/bootstrap', { params }).then(unwrap),
  workspaceSearch: (params) => request('/billing-workspace/search', { params }).then(unwrap),
  cashierWorklist: (params) => request('/billing-workspace/cashier-worklist', { params }).then(unwrap),
  paymentConfirmationQueue: (params) => request('/billing-workspace/payment-confirmation-queue', { params }).then(unwrap),
  alertSummary: (params) => request('/billing-workspace/alert-summary', { params }).then(unwrap),
  currentCashSession: () => request('/billing-workspace/cash-session/current').then(unwrap),
  openCashSession: (body) => request('/billing-workspace/cash-session/open', { method: 'POST', body }).then(unwrap),
  closeCurrentCashSession: (body) => request('/billing-workspace/cash-session/close', { method: 'POST', body }).then(unwrap),
  workbench: (params) => request('/billing/cashier/workbench', { params }).then(unwrap),
  search: (params) => request('/billing/cashier/search', { params }).then(unwrap),
  invoices: (params) => request('/billing/cashier/invoices', { params }).then(unwrap),
  unpaidInvoices: (params) => request('/billing/cashier/unpaid-invoices', { params }).then(unwrap),
  partialInvoices: (params) => request('/billing/cashier/partial-invoices', { params }).then(unwrap),
  invoiceDetail: (invoiceId) => request(`/billing/invoices/${id(invoiceId)}`).then(unwrap),
  collectPayment: (invoiceId, body) =>
    request(`/billing/cashier/invoices/${id(invoiceId)}/collect`, { method: 'POST', body }).then(unwrap),
  createPaymentIntent: (invoiceId, body) =>
    request(`/billing/invoices/${id(invoiceId)}/payment-intents`, { method: 'POST', body }).then(unwrap),
  manualPayments: (params) => request('/billing/cashier/manual-payments', { params }).then(unwrap),
  confirmManualPayment: (paymentId, body) =>
    request(`/billing/cashier/manual-payments/${id(paymentId)}/confirm`, { method: 'PATCH', body }).then(unwrap),
  rejectManualPayment: (paymentId, body) =>
    request(`/billing/cashier/manual-payments/${id(paymentId)}/reject`, { method: 'PATCH', body }).then(unwrap),
  refundManualPayment: (paymentId, body) =>
    request(`/billing/cashier/manual-payments/${id(paymentId)}/refund-manual`, { method: 'PATCH', body }).then(unwrap),
  transactionRefCheck: (params) => request('/billing/cashier/transaction-ref-check', { params }).then(unwrap),
  currentShift: () => request('/billing/cashier/shifts/current').then(unwrap),
  openShift: (body) => request('/billing/cashier/shifts/open', { method: 'POST', body }).then(unwrap),
  closeShift: (shiftId, body) => request(`/billing/cashier/shifts/${id(shiftId)}/close`, { method: 'POST', body }).then(unwrap),
  shiftSummary: (shiftId) => request(`/billing/cashier/shifts/${id(shiftId)}/summary`).then(unwrap),
  payments: (params) => request('/billing/payments', { params }).then(unwrap),
  paymentDetail: (paymentId) => request(`/billing/payments/${id(paymentId)}`).then(unwrap),
  paymentReceipt: (paymentId) => request(`/billing/payments/${id(paymentId)}/receipt`).then(unwrap),
  createReceiptPrintLog: (paymentId, body) =>
    request(`/billing/cashier/payments/${id(paymentId)}/receipt/print-log`, { method: 'POST', body }).then(unwrap),
  receiptPrintLogs: (paymentId) => request(`/billing/cashier/payments/${id(paymentId)}/receipt/print-logs`).then(unwrap),
  voidPayment: (paymentId, body) => request(`/billing/payments/${id(paymentId)}/void`, { method: 'POST', body }).then(unwrap),
  refundPayment: (paymentId, body) => request(`/billing/payments/${id(paymentId)}/refund`, { method: 'POST', body }).then(unwrap),
};

export function getBillingCashierErrorMessage(error, fallback = 'Không thể xử lý dữ liệu quầy thu tiền.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
