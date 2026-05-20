import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

export const clinicalOpsAPI = {
  topbarBootstrap: (params) => request('/clinical-ops/topbar/bootstrap', { params }).then(unwrap),
  worklistToday: (params) => request('/clinical-ops/worklist/today', { params }).then(unwrap),
  worklistSummary: (params) => request('/clinical-ops/worklist/summary', { params }).then(unwrap),
  safetySummary: (params) => request('/clinical-ops/safety-summary', { params }).then(unwrap),
  search: (params) => request('/clinical-ops/search', { params }).then(unwrap),
  claimWorklistItem: (itemId, body) => request(`/clinical-ops/worklist/${encodeURIComponent(itemId)}/claim`, { method: 'POST', body }).then(unwrap),
  releaseWorklistItem: (itemId, body) => request(`/clinical-ops/worklist/${encodeURIComponent(itemId)}/release`, { method: 'POST', body }).then(unwrap),
  sidebar: (params) => request('/clinical-operations/sidebar', { params }).then(unwrap),
  dashboard: (params) => request('/clinical-operations/overview/dashboard', { params }).then(unwrap),
  todayWorklist: (params) => request('/clinical-operations/overview/today-worklist', { params }).then(unwrap),
  statUrgent: (params) => request('/clinical-operations/overview/stat-urgent', { params }).then(unwrap),
  criticalResults: (params) => request('/clinical-operations/overview/critical-results', { params }).then(unwrap),
  pendingCompletion: (params) => request('/clinical-operations/overview/pending-completion', { params }).then(unwrap),
  pendingApproval: (params) => request('/clinical-operations/overview/pending-approval', { params }).then(unwrap),
  overdueOrders: (params) => request('/clinical-operations/overview/overdue-orders', { params }).then(unwrap),
  createEscalation: (body) => request('/clinical-operations/escalations', { method: 'POST', body }).then(unwrap),
  acknowledgeEscalation: (escalationId) =>
    request(`/clinical-operations/escalations/${encodeURIComponent(escalationId)}/acknowledge`, {
      method: 'POST',
      body: {},
    }).then(unwrap),
  resolveEscalation: (escalationId, body = {}) =>
    request(`/clinical-operations/escalations/${encodeURIComponent(escalationId)}/resolve`, {
      method: 'POST',
      body,
    }).then(unwrap),
  signResult: (body) => request('/clinical-operations/signatures/sign', { method: 'POST', body }).then(unwrap),
  revokeSignature: (signatureId, body = {}) =>
    request(`/clinical-operations/signatures/${encodeURIComponent(signatureId)}/revoke`, {
      method: 'POST',
      body,
    }).then(unwrap),
};

export function getClinicalOpsErrorMessage(error, fallback = 'Không thể tải dữ liệu Clinical Operations.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
