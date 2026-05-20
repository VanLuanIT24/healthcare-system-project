import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function bodyRequest(path, method = 'POST', body = {}) {
  return request(path, { method, body }).then(unwrap);
}

export const clinicalChargeApi = {
  dashboard: (params) => request('/clinical-charges/dashboard', { params }).then(unwrap),
  actionQueue: (params) => request('/clinical-charges/action-queue', { params }).then(unwrap),
  missing: (params) => request('/clinical-charges/missing', { params }).then(unwrap),
  byOrder: (params) => request('/clinical-charges/by-order', { params }).then(unwrap),
  charges: (params) => request('/clinical-charges', { params }).then(unwrap),
  lab: (params) => request('/clinical-charges/lab', { params }).then(unwrap),
  imaging: (params) => request('/clinical-charges/imaging', { params }).then(unwrap),
  procedure: (params) => request('/clinical-charges/procedure', { params }).then(unwrap),
  posted: (params) => request('/clinical-charges/posted', { params }).then(unwrap),
  unbilled: (params) => request('/clinical-charges/unbilled', { params }).then(unwrap),
  billed: (params) => request('/clinical-charges/billed', { params }).then(unwrap),
  exceptions: (params) => request('/clinical-charges/exceptions', { params }).then(unwrap),
  reconciliation: (params) => request('/clinical-charges/reconciliation', { params }).then(unwrap),
  orderContext: (orderId) => request(`/clinical-charges/orders/${encodeURIComponent(orderId)}/context`).then(unwrap),

  bulkCreateFromOrders: (body = {}) => bodyRequest('/clinical-charges/bulk-create-from-orders', 'POST', body),
  bulkPost: (body = {}) => bodyRequest('/clinical-charges/bulk-post', 'POST', body),
  bulkVoid: (body = {}) => bodyRequest('/clinical-charges/bulk-void', 'POST', body),
  markReview: (chargeId, body = {}) => bodyRequest(`/clinical-charges/${encodeURIComponent(chargeId)}/mark-review`, 'POST', body),
  resolveReview: (chargeId, body = {}) => bodyRequest(`/clinical-charges/${encodeURIComponent(chargeId)}/resolve`, 'POST', body),
  sendToBillingReview: (chargeId, body = {}) => bodyRequest(`/clinical-charges/${encodeURIComponent(chargeId)}/send-to-billing-review`, 'POST', body),
  createReplacement: (chargeId, body = {}) => bodyRequest(`/clinical-charges/${encodeURIComponent(chargeId)}/create-replacement`, 'POST', body),

  createOrderCharge: (orderId, body = {}) => bodyRequest(`/clinical-billing/orders/${encodeURIComponent(orderId)}/charge`, 'POST', body),
  postCharge: (chargeId) => bodyRequest(`/billing/charges/${encodeURIComponent(chargeId)}/post`, 'POST'),
  voidCharge: (chargeId, body = {}) => bodyRequest(`/billing/charges/${encodeURIComponent(chargeId)}/void`, 'POST', body),
};

export function getClinicalChargeErrorMessage(error, fallback = 'Không thể xử lý dữ liệu charge cận lâm sàng.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
