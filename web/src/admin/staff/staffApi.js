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
