import { request, unwrapData } from '../utils/api';

function unwrap(response) {
  return unwrapData(response) || {};
}

export const diagnosticAlertsAPI = {
  list: (params) => request('/diagnostics/alerts', { params }).then(unwrap),
  summary: (params) => request('/diagnostics/alerts/summary', { params }).then(unwrap),
  criticalOpen: (params) => request('/diagnostics/alerts/critical-open', { params }).then(unwrap),
  criticalOverdue: (params) => request('/diagnostics/alerts/critical-overdue', { params }).then(unwrap),
  rejectedSpecimens: (params) => request('/diagnostics/alerts/rejected-specimens', { params }).then(unwrap),
  overdueOrders: (params) => request('/diagnostics/alerts/overdue-orders', { params }).then(unwrap),
  missingFiles: (params) => request('/diagnostics/alerts/missing-files', { params }).then(unwrap),
  correctionNeeded: (params) => request('/diagnostics/alerts/correction-needed', { params }).then(unwrap),
  noShowCancellations: (params) => request('/diagnostics/alerts/no-show-cancellations', { params }).then(unwrap),
  detail: (alertId) => request(`/diagnostics/alerts/${encodeURIComponent(alertId)}`).then(unwrap),
  acknowledge: (alertId, body = {}) =>
    request(`/diagnostics/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST', body }).then(unwrap),
  assign: (alertId, body = {}) =>
    request(`/diagnostics/alerts/${encodeURIComponent(alertId)}/assign`, { method: 'POST', body }).then(unwrap),
  escalate: (alertId, body = {}) =>
    request(`/diagnostics/alerts/${encodeURIComponent(alertId)}/escalate`, { method: 'POST', body }).then(unwrap),
  resolve: (alertId, body = {}) =>
    request(`/diagnostics/alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'POST', body }).then(unwrap),
  dismiss: (alertId, body = {}) =>
    request(`/diagnostics/alerts/${encodeURIComponent(alertId)}/dismiss`, { method: 'POST', body }).then(unwrap),
  bulkAction: (body = {}) => request('/diagnostics/alerts/bulk-action', { method: 'POST', body }).then(unwrap),
};

export function getDiagnosticAlertErrorMessage(error, fallback = 'Không thể tải Diagnostic Alert Center.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}
