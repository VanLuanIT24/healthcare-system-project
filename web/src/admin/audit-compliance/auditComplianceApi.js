import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

async function request(path, options = {}) {
  const response = await fetchWithAuth(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers?.get?.('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().then((text) => (text ? { message: text } : null)).catch(() => null);

  if (!response.ok) {
    const message = payload?.message || payload?.error?.message || payload?.error || 'Không thể xử lý Audit & Compliance.';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) return payload.data;
  return payload ?? null;
}

function queryString(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => searchParams.append(key, item));
      return;
    }
    searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function listAuditLogs(params = {}) { return request(`/audit-logs${queryString(params)}`); }
export function getAuditLogDetail(auditLogId) { return request(`/audit-logs/${encodeURIComponent(auditLogId)}`); }
export function getAuditSummary(params = {}) { return request(`/audit-logs/summary${queryString(params)}`); }
export function getAuditFacets(params = {}) { return request(`/audit-logs/facets${queryString(params)}`); }
export function getRequestTimeline(requestId, params = {}) { return request(`/audit-logs/request/${encodeURIComponent(requestId)}/timeline${queryString(params)}`); }
export function getSessionTimeline(sessionId, params = {}) { return request(`/audit-logs/session/${encodeURIComponent(sessionId)}/timeline${queryString(params)}`); }
export function getActorAudit(actorType, actorId, params = {}) { return request(`/audit-logs/actor/${encodeURIComponent(actorType)}/${encodeURIComponent(actorId)}${queryString(params)}`); }
export function getEntityAudit(targetType, targetId, params = {}) { return request(`/audit-logs/entity/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}${queryString(params)}`); }
export function getComplianceDashboard(params = {}) { return request(`/compliance/dashboard${queryString(params)}`); }
export function listSensitiveAccess(params = {}) { return request(`/compliance/sensitive-access${queryString(params)}`); }
export function getSensitiveAccessSummary(params = {}) { return request(`/compliance/sensitive-access/summary${queryString(params)}`); }
export function getSensitiveRiskQueue(params = {}) { return request(`/compliance/sensitive-access/risk-queue${queryString(params)}`); }
export function reviewSensitiveAccess(auditLogId, payload) { return request(`/compliance/sensitive-access/${encodeURIComponent(auditLogId)}/review`, { method: 'POST', body: JSON.stringify(payload || {}) }); }
export function listBreakGlassAudit(params = {}) { return request(`/compliance/break-glass${queryString(params)}`); }
export function getBreakGlassSummary(params = {}) { return request(`/compliance/break-glass/summary${queryString(params)}`); }
export function getBreakGlassTimeline(accessId, params = {}) { return request(`/compliance/break-glass/${encodeURIComponent(accessId)}/timeline${queryString(params)}`); }
export function reviewBreakGlass(accessId, payload) { return request(`/compliance/break-glass/${encodeURIComponent(accessId)}/review`, { method: 'POST', body: JSON.stringify(payload || {}) }); }
export function getPatientAccessSummary(patientId, params = {}) { return request(`/compliance/patients/${encodeURIComponent(patientId)}/summary${queryString(params)}`); }
export function getPatientAccessTimeline(patientId, params = {}) { return request(`/compliance/patients/${encodeURIComponent(patientId)}/access-timeline${queryString(params)}`); }
export function getBillingSummary(params = {}) { return request(`/compliance/billing/summary${queryString(params)}`); }
export function listBillingAudit(params = {}) { return request(`/compliance/billing/audit${queryString(params)}`); }
export function getIamSummary(params = {}) { return request(`/compliance/iam/summary${queryString(params)}`); }
export function listIamAudit(params = {}) { return request(`/compliance/iam/audit${queryString(params)}`); }
export function getSettingsSummary(params = {}) { return request(`/compliance/settings/summary${queryString(params)}`); }
export function listSettingsAudit(params = {}) { return request(`/compliance/settings/audit${queryString(params)}`); }
export function previewAuditExportCount(payload) { return request('/compliance/audit-exports/preview-count', { method: 'POST', body: JSON.stringify(payload || {}) }); }
export function previewAuditExportSample(payload) { return request('/compliance/audit-exports/preview-sample', { method: 'POST', body: JSON.stringify(payload || {}) }); }
export function createAuditExport(payload) { return request('/compliance/audit-exports', { method: 'POST', body: JSON.stringify(payload || {}) }); }
export function listAuditExports(params = {}) { return request(`/compliance/audit-exports${queryString(params)}`); }
export function listComplianceReports(params = {}) { return request(`/compliance/reports${queryString(params)}`); }
export function generateComplianceReport(payload) { return request('/compliance/reports/generate', { method: 'POST', body: JSON.stringify(payload || {}) }); }
