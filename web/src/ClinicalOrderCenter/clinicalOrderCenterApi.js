import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

export const clinicalOrderCenterAPI = {
  list: (params) => request('/clinical-order-center', { params }).then(unwrap),
  summary: (params) => request('/clinical-order-center/summary', { params }).then(unwrap),
  statusBoard: (params) => request('/clinical-order-center/status-board', { params }).then(unwrap),
  pending: (params) => request('/clinical-order-center/pending', { params }).then(unwrap),
  acknowledged: (params) => request('/clinical-order-center/acknowledged', { params }).then(unwrap),
  inProgress: (params) => request('/clinical-order-center/in-progress', { params }).then(unwrap),
  inProgressLive: (params) => request('/clinical-order-center/in-progress/live', { params }).then(unwrap),
  completed: (params) => request('/clinical-order-center/completed', { params }).then(unwrap),
  cancelled: (params) => request('/clinical-order-center/cancelled', { params }).then(unwrap),
  enteredInError: (params) => request('/clinical-order-center/entered-in-error', { params }).then(unwrap),
  missingFiles: (params) => request('/clinical-order-center/missing-files', { params }).then(unwrap),
  slaBoard: (params) => request('/clinical-order-center/sla-board', { params }).then(unwrap),
  fullDetail: (orderId) => request(`/clinical-order-center/${encodeURIComponent(orderId)}/full-detail`).then(unwrap),
  fullTimeline: (orderId, params) => request(`/clinical-order-center/${encodeURIComponent(orderId)}/full-timeline`, { params }).then(unwrap),
  accept: (orderId, body = {}) =>
    request(`/clinical-order-center/${encodeURIComponent(orderId)}/accept`, { method: 'POST', body }).then(unwrap),
  assign: (orderId, body = {}) =>
    request(`/clinical-order-center/${encodeURIComponent(orderId)}/assign`, { method: 'POST', body }).then(unwrap),
  notifyDoctor: (orderId, body = {}) =>
    request(`/clinical-order-center/${encodeURIComponent(orderId)}/notify-doctor`, { method: 'POST', body }).then(unwrap),
  bulkAction: (body = {}) => request('/clinical-order-center/bulk-action', { method: 'POST', body }).then(unwrap),
};

export function getClinicalOrderCenterError(error, fallback = 'Không thể tải dữ liệu Trung tâm order.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
