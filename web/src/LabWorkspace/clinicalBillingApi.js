import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function bodyRequest(path, method = 'POST', body = {}) {
  return request(path, { method, body }).then(unwrap);
}

export const clinicalBillingApi = {
  dashboard: (params) => request('/clinical-billing/dashboard', { params }).then(unwrap),
  chargeCandidates: (params) => request('/clinical-billing/orders/charge-candidates', { params }).then(unwrap),
  charges: (params) => request('/clinical-billing/charges', { params }).then(unwrap),
  unbilledCharges: (params) => request('/clinical-billing/unbilled-charges', { params }).then(unwrap),
  invoices: (params) => request('/clinical-billing/invoices', { params }).then(unwrap),
  exceptions: (params) => request('/clinical-billing/exceptions', { params }).then(unwrap),
  reconciliation: (params) => request('/clinical-billing/reconciliation', { params }).then(unwrap),
  orderTrace: (orderId) => request(`/clinical-billing/orders/${encodeURIComponent(orderId)}/billing-trace`).then(unwrap),
  invoiceTimeline: (invoiceId) => request(`/clinical-billing/invoices/${encodeURIComponent(invoiceId)}/timeline`).then(unwrap),
  encounterSummary: (encounterId) => request(`/clinical-billing/encounters/${encodeURIComponent(encounterId)}/billing-summary`).then(unwrap),
  createOrderCharge: (orderId, body = {}) => bodyRequest(`/clinical-billing/orders/${encodeURIComponent(orderId)}/charge`, 'POST', body),
  createInvoiceFromCharges: (body = {}) => bodyRequest('/clinical-billing/invoices/from-selected-charges', 'POST', body),
  createInvoiceFromEncounter: (body = {}) => bodyRequest('/clinical-billing/invoices/from-encounter', 'POST', body),

  invoiceDetail: (invoiceId) => request(`/billing/invoices/${encodeURIComponent(invoiceId)}`).then(unwrap),
  issueInvoice: (invoiceId, body = {}) => bodyRequest(`/billing/invoices/${encodeURIComponent(invoiceId)}/issue`, 'POST', body),
  voidInvoice: (invoiceId, body = {}) => bodyRequest(`/billing/invoices/${encodeURIComponent(invoiceId)}/void`, 'POST', body),
  createPayment: (invoiceId, body = {}) => bodyRequest(`/billing/invoices/${encodeURIComponent(invoiceId)}/payments`, 'POST', body),
  createPaymentIntent: (invoiceId, body = {}) => bodyRequest(`/billing/invoices/${encodeURIComponent(invoiceId)}/payment-intents`, 'POST', body),
  voidCharge: (chargeId, body = {}) => bodyRequest(`/billing/charges/${encodeURIComponent(chargeId)}/void`, 'POST', body),
};

export function getClinicalBillingErrorMessage(error, fallback = 'Không thể xử lý dữ liệu hóa đơn cận lâm sàng.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
