import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

async function readPayload(response) {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text.slice(0, 300), raw: text };
  }
}

async function request(path, options = {}) {
  const response = await fetchWithAuth(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Không thể xử lý Security Center (${response.status}).`);
  }

  return payload?.data ?? payload ?? null;
}

function queryString(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function getSecurityDashboard() {
  return request('/security/dashboard');
}

export function listSecuritySessions(params = {}) {
  return request(`/security/sessions${queryString(params)}`);
}

export function getSecuritySession(sessionId) {
  return request(`/security/sessions/${encodeURIComponent(sessionId)}`);
}

export function revokeSecuritySession(sessionId, reason) {
  return request(`/security/sessions/${encodeURIComponent(sessionId)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function revokeSecuritySessionFamily(sessionId, reason) {
  return request(`/security/sessions/${encodeURIComponent(sessionId)}/revoke-family`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function previewBulkSessionRevoke(payload) {
  return request('/security/sessions/bulk-revoke/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function executeBulkSessionRevoke(payload) {
  return request('/security/sessions/bulk-revoke', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listSecurityLoginHistory(params = {}) {
  return request(`/security/login-history${queryString(params)}`);
}

export function getSecurityLoginSummary(params = {}) {
  return request(`/security/login-summary${queryString(params)}`);
}

export function listSuspiciousIps(params = {}) {
  return request(`/security/suspicious-ips${queryString(params)}`);
}

export function listSecurityDevices(params = {}) {
  return request(`/security/devices${queryString(params)}`);
}

export function listRiskyAccounts(params = {}) {
  return request(`/security/risky-accounts${queryString(params)}`);
}

export function listTokenFamilies(params = {}) {
  return request(`/security/token-families${queryString(params)}`);
}

export function getTokenFamily(familyId) {
  return request(`/security/token-families/${encodeURIComponent(familyId)}`);
}

export function revokeTokenFamily(familyId, reason) {
  return request(`/security/token-families/${encodeURIComponent(familyId)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function listRateLimitEvents(params = {}) {
  return request(`/security/rate-limit-events${queryString(params)}`);
}

export function getRateLimitSummary(params = {}) {
  return request(`/security/rate-limit-summary${queryString(params)}`);
}

export function listBreakGlassAccess(params = {}) {
  return request(`/security/break-glass${queryString(params)}`);
}

export function reviewBreakGlass(accessId, payload) {
  return request(`/security/break-glass/${encodeURIComponent(accessId)}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listSecurityConsents(params = {}) {
  return request(`/security/consents${queryString(params)}`);
}

export function getConsentSummary() {
  return request('/security/consents/summary');
}

export function revokeSecurityConsent(consentId, reason) {
  return request(`/security/consents/${encodeURIComponent(consentId)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function listSecurityPatientAuthorizations(params = {}) {
  return request(`/security/patient-authorizations${queryString(params)}`);
}

export function getPatientAuthorizationSummary() {
  return request('/security/patient-authorizations/summary');
}

export function approvePatientAuthorization(authorizationId) {
  return request(`/security/patient-authorizations/${encodeURIComponent(authorizationId)}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function revokePatientAuthorization(authorizationId, reason) {
  return request(`/security/patient-authorizations/${encodeURIComponent(authorizationId)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function listAccessDecisions(params = {}) {
  return request(`/security/access-decisions${queryString(params)}`);
}

export function listSensitiveAccessEvents(params = {}) {
  return request(`/security/sensitive-access-events${queryString(params)}`);
}

export function listDataAccessPolicies(params = {}) {
  return request(`/security/data-access-policies${queryString(params)}`);
}

export function createDataAccessPolicy(payload) {
  return request('/security/data-access-policies', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateDataAccessPolicy(policyId, payload) {
  return request(`/security/data-access-policies/${encodeURIComponent(policyId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function publishDataAccessPolicy(policyId) {
  return request(`/security/data-access-policies/${encodeURIComponent(policyId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function archiveDataAccessPolicy(policyId) {
  return request(`/security/data-access-policies/${encodeURIComponent(policyId)}/archive`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
