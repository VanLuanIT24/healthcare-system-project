import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

async function request(path, options) {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/workspace-access${path}`, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể xử lý yêu cầu workspace access.');
  }

  return payload?.data;
}

export function getWorkspaceAccessOverview() {
  return request('/overview');
}

export function listWorkspaceRegistry() {
  return request('/workspaces');
}

export function getWorkspaceByActor() {
  return request('/by-actor');
}

export function getWorkspaceByRole() {
  return request('/by-role');
}

export function getWorkspaceByUser(query = 'limit=25') {
  return request(`/users?${query}`);
}

export function getWorkspaceByDepartment() {
  return request('/departments');
}

export function listWorkspacePolicies(query = 'limit=25') {
  return request(`/policies?${query}`);
}

export function createWorkspacePolicy(payload) {
  return request('/policies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function validateWorkspacePolicies() {
  return request('/policies/validate', { method: 'POST' });
}

export function updateWorkspacePolicy(policyId, payload) {
  return request(`/policies/${policyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteWorkspacePolicy(policyId) {
  return request(`/policies/${policyId}`, { method: 'DELETE' });
}

export function getWorkspaceConflicts() {
  return request('/conflicts');
}

export function getWorkspaceSidebars() {
  return request('/sidebars');
}

export function getWorkspaceNavigationRules() {
  return request('/navigation-rules');
}

export function getWorkspacePreferences(query = 'limit=25') {
  return request(`/preferences?${query}`);
}

export function getWorkspaceDiagnostics() {
  return request('/diagnostics');
}

export function runWorkspaceDiagnostics() {
  return request('/diagnostics/run', { method: 'POST' });
}

export function getWorkspaceAudit() {
  return request('/audit?limit=30');
}

export function explainWorkspaceAccess(payload) {
  return request('/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
