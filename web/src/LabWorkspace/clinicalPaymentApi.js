import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function bodyRequest(path, method = 'POST', body = {}) {
  return request(path, { method, body }).then(unwrap);
}

export const clinicalPaymentApi = {
  dashboard: (params) => request('/clinical-payments/dashboard', { params }).then(unwrap),
  orders: (params) => request('/clinical-payments/orders', { params }).then(unwrap),
  waitingPayment: (params) => request('/clinical-payments/waiting-payment', { params }).then(unwrap),
  ready: (params) => request('/clinical-payments/ready-to-perform', { params }).then(unwrap),
  confirmation: (params) => request('/clinical-payments/waiting-confirmation', { params }).then(unwrap),
  manualReview: (params) => request('/clinical-payments/manual-review', { params }).then(unwrap),
  errors: (params) => request('/clinical-payments/errors', { params }).then(unwrap),
  refundVoid: (params) => request('/clinical-payments/refund-void-cases', { params }).then(unwrap),
  overrides: (params) => request('/clinical-payments/overrides', { params }).then(unwrap),
  encounter: (encounterId) => request(`/clinical-payments/encounters/${encodeURIComponent(encounterId)}`).then(unwrap),
  orderGate: (orderId) => request(`/clinical-payments/orders/${encodeURIComponent(orderId)}/payment-gate`).then(unwrap),
  createPaymentFlow: (orderId, body = {}) => bodyRequest(`/clinical-payments/orders/${encodeURIComponent(orderId)}/payment-flow`, 'POST', body),
  createOverride: (orderId, body = {}) => bodyRequest(`/clinical-payments/orders/${encodeURIComponent(orderId)}/override`, 'POST', body),
  revokeOverride: (overrideId, body = {}) => bodyRequest(`/clinical-payments/overrides/${encodeURIComponent(overrideId)}/revoke`, 'POST', body),
  confirmIntent: (intentId, body = {}) => bodyRequest(`/clinical-payments/payment-intents/${encodeURIComponent(intentId)}/confirm`, 'POST', body),
  rejectIntent: (intentId, body = {}) => bodyRequest(`/clinical-payments/payment-intents/${encodeURIComponent(intentId)}/reject`, 'POST', body),
  manualReviewIntent: (intentId, body = {}) => bodyRequest(`/clinical-payments/payment-intents/${encodeURIComponent(intentId)}/manual-review`, 'POST', body),
};

export function getClinicalPaymentErrorMessage(error, fallback = 'Không thể xử lý payment cận lâm sàng.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
