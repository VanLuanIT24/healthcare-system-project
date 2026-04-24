import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

async function request(url, options) {
  const response = await fetchWithAuth(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể xử lý yêu cầu role.');
  }

  return payload?.data;
}

export function listRoles(query = '') {
  return request(`${API_BASE_URL}/iam/roles${query ? `?${query}` : ''}`);
}

export function getRoleDetail(roleId) {
  return request(`${API_BASE_URL}/iam/roles/${roleId}`);
}

export function getRoleUsageSummary(roleId) {
  return request(`${API_BASE_URL}/iam/roles/${roleId}/usage`);
}

export function createRole(payload) {
  return request(`${API_BASE_URL}/iam/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateRole(roleId, payload) {
  return request(`${API_BASE_URL}/iam/roles/${roleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateRoleStatus(roleId, status) {
  return request(`${API_BASE_URL}/iam/roles/${roleId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export function deleteRoleSoft(roleId) {
  return request(`${API_BASE_URL}/iam/roles/${roleId}`, { method: 'DELETE' });
}

export function getRolePermissions(roleId) {
  return request(`${API_BASE_URL}/iam/roles/${roleId}/permissions`);
}

export function syncRolePermissions(roleId, permissionCodes) {
  return request(`${API_BASE_URL}/iam/roles/${roleId}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permission_codes: permissionCodes }),
  });
}

export function removePermissionsFromRole(roleId, permissionCodes) {
  return request(`${API_BASE_URL}/iam/roles/${roleId}/permissions`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permission_codes: permissionCodes }),
  });
}

export function listPermissions(query = '') {
  return request(`${API_BASE_URL}/iam/permissions${query ? `?${query}` : ''}`);
}

export function createPermission(payload) {
  return request(`${API_BASE_URL}/iam/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getPermissionDetail(permissionId) {
  return request(`${API_BASE_URL}/iam/permissions/${permissionId}`);
}

export function getPermissionUsageSummary(permissionId) {
  return request(`${API_BASE_URL}/iam/permissions/${permissionId}/usage`);
}

export function updatePermission(permissionId, payload) {
  return request(`${API_BASE_URL}/iam/permissions/${permissionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deletePermissionSoft(permissionId) {
  return request(`${API_BASE_URL}/iam/permissions/${permissionId}`, {
    method: 'DELETE',
  });
}

export function getUsersByRole(roleId, query = '') {
  return request(`${API_BASE_URL}/iam/roles/${roleId}/users${query ? `?${query}` : ''}`);
}

export function getAuditLogs(query = '') {
  return request(`${API_BASE_URL}/auth/audit-logs${query ? `?${query}` : ''}`);
}
