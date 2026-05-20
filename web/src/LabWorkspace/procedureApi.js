import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

function bodyRequest(path, method = 'POST', body = {}) {
  return request(path, { method, body }).then(unwrap);
}

export const procedureApi = {
  dashboardSummary: (params) => request('/procedures/dashboard/summary', { params }).then(unwrap),
  worklistCounts: (params) => request('/procedures/worklist-counts', { params }).then(unwrap),
  calendar: (params) => request('/procedures/calendar', { params }).then(unwrap),

  listOrders: (params) => request('/procedures/orders', { params }).then(unwrap),
  orderDetail: (id) => request(`/procedures/orders/${encodeURIComponent(id)}`).then(unwrap),
  orderTimeline: (id) => request(`/procedures/orders/${encodeURIComponent(id)}/timeline`).then(unwrap),
  scheduleOrder: (id, body = {}) => bodyRequest(`/procedures/orders/${encodeURIComponent(id)}/schedule`, 'POST', body),
  rescheduleOrder: (id, body = {}) => bodyRequest(`/procedures/orders/${encodeURIComponent(id)}/reschedule`, 'POST', body),
  assignPerformer: (id, body = {}) => bodyRequest(`/procedures/orders/${encodeURIComponent(id)}/assign-performer`, 'PATCH', body),
  startOrder: (id, body = {}) => bodyRequest(`/procedures/orders/${encodeURIComponent(id)}/start`, 'POST', body),
  completeOrder: (id, body = {}) => bodyRequest(`/procedures/orders/${encodeURIComponent(id)}/complete`, 'POST', body),
  cancelOrder: (id, body = {}) => bodyRequest(`/procedures/orders/${encodeURIComponent(id)}/cancel`, 'POST', body),
  markNoShow: (id, body = {}) => bodyRequest(`/procedures/orders/${encodeURIComponent(id)}/no-show`, 'POST', body),

  listAttachments: (orderId) => request(`/procedures/orders/${encodeURIComponent(orderId)}/attachments`).then(unwrap),
  uploadAttachment: (orderId, body = {}) => bodyRequest(`/procedures/orders/${encodeURIComponent(orderId)}/attachments`, 'POST', body),
  listFiles: (params) => request('/procedures/files', { params }).then(unwrap),
  reviewFile: (id, body = {}) => bodyRequest(`/procedures/files/${encodeURIComponent(id)}/review`, 'POST', body),
  releaseFile: (id, body = {}) => bodyRequest(`/procedures/files/${encodeURIComponent(id)}/release-to-patient`, 'POST', body),
  revokeFileRelease: (id, body = {}) => bodyRequest(`/procedures/files/${encodeURIComponent(id)}/revoke-release`, 'POST', body),
  archiveFile: (id, body = {}) => bodyRequest(`/procedures/files/${encodeURIComponent(id)}/archive`, 'POST', body),
  restoreFile: (id, body = {}) => bodyRequest(`/procedures/files/${encodeURIComponent(id)}/restore`, 'POST', body),
  deleteFile: (id) => bodyRequest(`/procedures/files/${encodeURIComponent(id)}`, 'DELETE', {}),

  listCharges: (params) => request('/procedures/charges', { params }).then(unwrap),
  orderCharges: (orderId) => request(`/procedures/orders/${encodeURIComponent(orderId)}/charges`).then(unwrap),
  createCharge: (orderId, body = {}) => bodyRequest(`/procedures/orders/${encodeURIComponent(orderId)}/charge`, 'POST', body),

  listResults: (params) => request('/procedures/results', { params }).then(unwrap),
  orderResult: (orderId) => request(`/procedures/orders/${encodeURIComponent(orderId)}/result`).then(unwrap),
  createResult: (orderId, body = {}) => bodyRequest(`/procedures/orders/${encodeURIComponent(orderId)}/result`, 'POST', body),
  resultDetail: (id) => request(`/procedures/results/${encodeURIComponent(id)}`).then(unwrap),
  updateResult: (id, body = {}) => bodyRequest(`/procedures/results/${encodeURIComponent(id)}`, 'PATCH', body),
  finalizeResult: (id) => bodyRequest(`/procedures/results/${encodeURIComponent(id)}/finalize`, 'POST', {}),
  signResult: (id) => bodyRequest(`/procedures/results/${encodeURIComponent(id)}/sign`, 'POST', {}),
  amendResult: (id, body = {}) => bodyRequest(`/procedures/results/${encodeURIComponent(id)}/amend`, 'POST', body),
  releaseResultToDoctor: (id, body = {}) => bodyRequest(`/procedures/results/${encodeURIComponent(id)}/release-to-doctor`, 'POST', body),
  releaseResultToPatient: (id, body = {}) => bodyRequest(`/procedures/results/${encodeURIComponent(id)}/release-to-patient`, 'POST', body),
  cancelResult: (id, body = {}) => bodyRequest(`/procedures/results/${encodeURIComponent(id)}/cancel`, 'POST', body),

  listPreparations: (params) => request('/nursing/preparations/worklist', { params: { source_type: 'procedure', ...params } }).then(unwrap),
  preparationDetail: (id) => request(`/nursing/preparations/${encodeURIComponent(id)}`).then(unwrap),
  preparationChecklist: (id) => request(`/nursing/preparations/${encodeURIComponent(id)}/checklist`).then(unwrap),
  preparationTimeline: (id) => request(`/nursing/preparations/${encodeURIComponent(id)}/timeline`).then(unwrap),
  startPreparation: (id, body = {}) => bodyRequest(`/nursing/preparations/${encodeURIComponent(id)}/start`, 'POST', body),
  readyPreparation: (id, body = {}) => bodyRequest(`/nursing/preparations/${encodeURIComponent(id)}/ready`, 'POST', body),
  blockPreparation: (id, body = {}) => bodyRequest(`/nursing/preparations/${encodeURIComponent(id)}/block`, 'POST', body),
  transferPreparation: (id, body = {}) => bodyRequest(`/nursing/preparations/${encodeURIComponent(id)}/transfer`, 'POST', body),
};

export function getProcedureErrorMessage(error, fallback = 'Không thể tải dữ liệu thủ thuật.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
