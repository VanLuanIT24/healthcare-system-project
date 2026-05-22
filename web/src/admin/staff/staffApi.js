import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

async function request(url, options) {
  const response = await fetchWithAuth(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể xử lý yêu cầu staff.');
  }

  return payload?.data;
}

export function getStaffSummary() {
  return request(`${API_BASE_URL}/staff/summary`);
}

export function getStaffAccounts(query = '') {
  return request(`${API_BASE_URL}/staff/accounts${query ? `?${query}` : ''}`);
}

export function getPendingActivationAccounts(query = '') {
  return request(`${API_BASE_URL}/staff/accounts/pending-activation${query ? `?${query}` : ''}`);
}

export function getRiskAccounts(query = '') {
  return request(`${API_BASE_URL}/staff/accounts/risk${query ? `?${query}` : ''}`);
}

export function getGlobalStaffLoginHistory(query = 'limit=20') {
  return request(`${API_BASE_URL}/staff/accounts/login-history?${query}`);
}

export function validateStaffUnique(query = '') {
  return request(`${API_BASE_URL}/staff/accounts/validate-unique${query ? `?${query}` : ''}`);
}

export function generateStaffUsername(payload) {
  return request(`${API_BASE_URL}/staff/accounts/generate-username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function generateStaffEmployeeCode(payload) {
  return request(`${API_BASE_URL}/staff/accounts/generate-employee-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getDepartments(query = 'limit=100') {
  return request(`${API_BASE_URL}/departments?${query}`);
}

export function getAssignableRoles() {
  return request(`${API_BASE_URL}/staff/assignable-roles`);
}

export function createStaffAccount(payload) {
  return request(`${API_BASE_URL}/staff/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getStaffAccountDetail(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}`);
}

export function updateStaffAccount(staffId, payload) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateStaffStatus(staffId, status) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export function getStaffRoles(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/roles`);
}

export function syncStaffRoles(staffId, roleCodes) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_codes: roleCodes }),
  });
}

export function getStaffPermissions(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/permissions`);
}

export function checkStaffPermission(staffId, permissionCode) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/check-permission?permission_code=${encodeURIComponent(permissionCode)}`);
}

export function getStaffLoginHistory(staffId, query = 'limit=10') {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/login-history?${query}`);
}

export function getStaffAuditLogs(staffId, query = 'limit=10') {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/audit-logs?${query}`);
}

export function getStaffSessions(staffId, query = 'limit=10') {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/sessions?${query}`);
}

export function revokeStaffSession(staffId, sessionId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/sessions/${sessionId}`, { method: 'DELETE' });
}

export function revokeAllStaffSessions(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/sessions/revoke-all`, { method: 'POST' });
}

export function getStaffDependencies(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/dependencies`);
}

export function getStaffRiskProfile(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/risk-profile`);
}

export function markStaffRiskReviewed(staffId, payload = {}) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/risk-reviewed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function runStaffSecurityAction(staffId, payload) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/security-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function requireStaffPasswordChange(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/require-password-change`, { method: 'POST' });
}

export function transferStaffDepartment(staffId, payload) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/transfer-department`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function bulkStaffAction(payload) {
  return request(`${API_BASE_URL}/staff/accounts/bulk-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function resetStaffPassword(staffId, payload) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function activateStaffAccount(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/activate`, { method: 'POST' });
}

export function deactivateStaffAccount(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/deactivate`, { method: 'POST' });
}

export function unlockStaffAccount(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/unlock`, { method: 'POST' });
}

export function deleteStaffSoft(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}`, { method: 'DELETE' });
}

export function forceLogoutStaff(staffId) {
  return request(`${API_BASE_URL}/staff/accounts/${staffId}/force-logout`, { method: 'POST' });
}
