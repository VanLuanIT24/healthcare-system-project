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

export function getIamOverview(query = '') {
  return request(`${API_BASE_URL}/iam/overview${query ? `?${query}` : ''}`);
}

export function getIamMatrix(query = '') {
  return request(`${API_BASE_URL}/iam/matrix${query ? `?${query}` : ''}`);
}

export function previewRolePermissionChange(payload) {
  return request(`${API_BASE_URL}/iam/matrix/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function applyRolePermissionMatrix(payload) {
  return request(`${API_BASE_URL}/iam/matrix/apply`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getStaffEffectivePermissions(userId, query = 'includeSources=true') {
  return request(`${API_BASE_URL}/iam/staff/${userId}/effective-permissions${query ? `?${query}` : ''}`);
}

export function previewStaffRoleChange(userId, roleCodes) {
  return request(`${API_BASE_URL}/iam/staff/${userId}/roles/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_codes: roleCodes }),
  });
}

export function syncIamStaffRoles(userId, roleCodes) {
  return request(`${API_BASE_URL}/iam/staff/${userId}/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_codes: roleCodes }),
  });
}

export function explainAccess(payload) {
  return request(`${API_BASE_URL}/iam/access-check/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getIamCacheStatus() {
  return request(`${API_BASE_URL}/iam/cache/status`);
}

export function rebuildUserPermissionContext(userId, payload = {}) {
  return request(`${API_BASE_URL}/iam/cache/rebuild/user/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function rebuildRolePermissionContext(roleId, payload = {}) {
  return request(`${API_BASE_URL}/iam/cache/rebuild/role/${roleId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function rebuildAllPermissionContexts(payload = {}) {
  return request(`${API_BASE_URL}/iam/cache/rebuild/all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function seedSystemAccessDryRun() {
  return request(`${API_BASE_URL}/iam/seed/system-access/dry-run`, { method: 'POST' });
}

export function seedSystemAccess() {
  return request(`${API_BASE_URL}/iam/seed/system-access`, { method: 'POST' });
}

export function getIamAudit(query = 'limit=100') {
  return request(`${API_BASE_URL}/iam/audit${query ? `?${query}` : ''}`);
}

export function listDenyPolicies(query = '') {
  return request(`${API_BASE_URL}/iam/deny-policies${query ? `?${query}` : ''}`);
}

export function previewDenyPolicy(payload) {
  return request(`${API_BASE_URL}/iam/deny-policies/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function createDenyPolicy(payload) {
  return request(`${API_BASE_URL}/iam/deny-policies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateDenyPolicy(policyId, payload) {
  return request(`${API_BASE_URL}/iam/deny-policies/${policyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function activateDenyPolicy(policyId) {
  return request(`${API_BASE_URL}/iam/deny-policies/${policyId}/activate`, { method: 'POST' });
}

export function deactivateDenyPolicy(policyId) {
  return request(`${API_BASE_URL}/iam/deny-policies/${policyId}/deactivate`, { method: 'POST' });
}

export function deleteDenyPolicy(policyId) {
  return request(`${API_BASE_URL}/iam/deny-policies/${policyId}`, { method: 'DELETE' });
}
