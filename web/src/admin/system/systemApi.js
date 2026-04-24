import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

async function request(url, options) {
  const response = await fetchWithAuth(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể xử lý yêu cầu hệ thống.');
  }

  return payload?.data;
}

export function listDepartments(query = '') {
  return request(`${API_BASE_URL}/departments${query ? `?${query}` : ''}`);
}

export function getDepartmentDetail(departmentId) {
  return request(`${API_BASE_URL}/departments/${departmentId}`);
}

export function createDepartment(payload) {
  return request(`${API_BASE_URL}/departments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateDepartment(departmentId, payload) {
  return request(`${API_BASE_URL}/departments/${departmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateDepartmentStatus(departmentId, status) {
  return request(`${API_BASE_URL}/departments/${departmentId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export function deleteDepartmentSoft(departmentId) {
  return request(`${API_BASE_URL}/departments/${departmentId}`, { method: 'DELETE' });
}

export function assignDepartmentHead(departmentId, headUserId) {
  return request(`${API_BASE_URL}/departments/${departmentId}/head`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ head_user_id: headUserId }),
  });
}

export function removeDepartmentHead(departmentId) {
  return request(`${API_BASE_URL}/departments/${departmentId}/head`, { method: 'DELETE' });
}

export function getDepartmentSummary(departmentId, query = '') {
  return request(`${API_BASE_URL}/departments/${departmentId}/summary${query ? `?${query}` : ''}`);
}

export function listDepartmentStaff(departmentId, query = 'limit=20') {
  return request(`${API_BASE_URL}/departments/${departmentId}/staff?${query}`);
}

export function checkDepartmentInUse(departmentId) {
  return request(`${API_BASE_URL}/departments/${departmentId}/dependencies`);
}

export function checkDepartmentCanBeDeactivated(departmentId) {
  return request(`${API_BASE_URL}/departments/${departmentId}/can-deactivate`);
}

export function checkDepartmentHasFutureSchedules(departmentId) {
  return request(`${API_BASE_URL}/departments/${departmentId}/future-schedules`);
}

export function checkDepartmentHasFutureAppointments(departmentId) {
  return request(`${API_BASE_URL}/departments/${departmentId}/future-appointments`);
}

export function listSchedulesByDepartment(departmentId, query = 'limit=12') {
  return request(`${API_BASE_URL}/schedules/department/${departmentId}?${query}`);
}

export function listAppointmentsByDepartment(departmentId, query = 'limit=12') {
  return request(`${API_BASE_URL}/appointments/department/${departmentId}?${query}`);
}

export function getMyProfile() {
  return request(`${API_BASE_URL}/auth/me`);
}

export function updateMyProfile(payload) {
  return request(`${API_BASE_URL}/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getMyRoles() {
  return request(`${API_BASE_URL}/auth/me/roles`);
}

export function getMyPermissions() {
  return request(`${API_BASE_URL}/auth/me/permissions`);
}

export function changeMyPassword(payload) {
  return request(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getMySessions() {
  return request(`${API_BASE_URL}/auth/me/sessions`);
}

export function revokeMySession(sessionId) {
  return request(`${API_BASE_URL}/auth/sessions/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function logoutAllMyDevices() {
  return request(`${API_BASE_URL}/auth/logout-all-devices`, { method: 'POST' });
}

export function getMyLoginHistory(query = 'limit=50') {
  return request(`${API_BASE_URL}/auth/me/login-history?${query}`);
}

export function getAuditLogs(query = 'limit=100') {
  return request(`${API_BASE_URL}/auth/audit-logs?${query}`);
}
