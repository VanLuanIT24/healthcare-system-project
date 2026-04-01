const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

function buildHeaders(accessToken, headers = {}) {
  const result = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (accessToken) {
    result.Authorization = `Bearer ${accessToken}`;
  }

  return result;
}

async function request(path, { method = 'GET', body, accessToken, headers } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(accessToken, headers),
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({
    success: false,
    message: 'Không thể đọc phản hồi từ máy chủ.',
  }));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Yêu cầu thất bại.');
    error.status = response.status;
    error.data = payload.data;
    throw error;
  }

  return payload;
}

export const api = {
  staffLogin(body) {
    return request('/auth/staff/login', { method: 'POST', body });
  },
  patientLogin(body) {
    return request('/auth/patients/login', { method: 'POST', body });
  },
  patientRegister(body) {
    return request('/auth/patients/register', { method: 'POST', body });
  },
  forgotPassword(body) {
    return request('/auth/forgot-password', { method: 'POST', body });
  },
  resetPassword(body) {
    return request('/auth/reset-password', { method: 'POST', body });
  },
  refreshToken(body) {
    return request('/auth/refresh-token', { method: 'POST', body });
  },
  logout(body, accessToken) {
    return request('/auth/logout', { method: 'POST', body, accessToken });
  },
  changePassword(body, accessToken) {
    return request('/auth/change-password', { method: 'POST', body, accessToken });
  },
  me(accessToken) {
    return request('/auth/me', { accessToken });
  },
  getMyRoles(accessToken) {
    return request('/auth/my-roles', { accessToken });
  },
  getMyPermissions(accessToken) {
    return request('/auth/my-permissions', { accessToken });
  },
  updateMyProfile(body, accessToken) {
    return request('/auth/my-profile', { method: 'PATCH', body, accessToken });
  },
  getMySessions(accessToken) {
    return request('/auth/my-sessions', { accessToken });
  },
  getLoginHistory(params, accessToken) {
    const search = new URLSearchParams(params).toString();
    return request(`/auth/login-history${search ? `?${search}` : ''}`, { accessToken });
  },
  revokeSession(body, accessToken) {
    return request('/auth/sessions/revoke', { method: 'POST', body, accessToken });
  },
  logoutAllDevices(accessToken) {
    return request('/auth/logout-all-devices', { method: 'POST', accessToken });
  },
  getStaffAccounts(params, accessToken) {
    const search = new URLSearchParams(params).toString();
    return request(`/auth/staff/accounts${search ? `?${search}` : ''}`, { accessToken });
  },
  createStaffAccount(body, accessToken) {
    return request('/auth/staff/accounts', { method: 'POST', body, accessToken });
  },
  updateStaffRoles(body, accessToken) {
    return request('/auth/staff/accounts/roles', { method: 'PATCH', body, accessToken });
  },
  updateStaffStatus(body, accessToken) {
    return request('/auth/staff/accounts/status', { method: 'PATCH', body, accessToken });
  },
  unlockStaffAccount(body, accessToken) {
    return request('/auth/staff/accounts/unlock', { method: 'POST', body, accessToken });
  },
  activateStaffAccount(body, accessToken) {
    return request('/auth/staff/accounts/activate', { method: 'POST', body, accessToken });
  },
  deactivateStaffAccount(body, accessToken) {
    return request('/auth/staff/accounts/deactivate', { method: 'POST', body, accessToken });
  },
  resetStaffPassword(body, accessToken) {
    return request('/auth/staff/accounts/reset-password', { method: 'POST', body, accessToken });
  },
  getAuditLogs(params, accessToken) {
    const search = new URLSearchParams(params).toString();
    return request(`/auth/audit-logs${search ? `?${search}` : ''}`, { accessToken });
  },
  getStaffRoles(userId, accessToken) {
    return request(`/iam/staff/${userId}/roles`, { accessToken });
  },
  getStaffPermissions(userId, accessToken) {
    return request(`/iam/staff/${userId}/permissions`, { accessToken });
  },
  checkStaffPermission(userId, permissionCode, accessToken) {
    const search = new URLSearchParams({ permission_code: permissionCode }).toString();
    return request(`/iam/staff/${userId}/check-permission?${search}`, { accessToken });
  },
  removeRolesFromStaff(userId, body, accessToken) {
    return request(`/iam/staff/${userId}/roles`, { method: 'DELETE', body, accessToken });
  },
  listRoles(params, accessToken) {
    const search = new URLSearchParams(params).toString();
    return request(`/iam/roles${search ? `?${search}` : ''}`, { accessToken });
  },
  createRole(body, accessToken) {
    return request('/iam/roles', { method: 'POST', body, accessToken });
  },
  getRoleDetail(roleId, accessToken) {
    return request(`/iam/roles/${roleId}`, { accessToken });
  },
  updateRole(roleId, body, accessToken) {
    return request(`/iam/roles/${roleId}`, { method: 'PATCH', body, accessToken });
  },
  updateRoleStatus(roleId, body, accessToken) {
    return request(`/iam/roles/${roleId}/status`, { method: 'PATCH', body, accessToken });
  },
  getRolePermissions(roleId, accessToken) {
    return request(`/iam/roles/${roleId}/permissions`, { accessToken });
  },
  assignPermissionsToRole(roleId, body, accessToken) {
    return request(`/iam/roles/${roleId}/permissions`, { method: 'POST', body, accessToken });
  },
  removePermissionsFromRole(roleId, body, accessToken) {
    return request(`/iam/roles/${roleId}/permissions`, { method: 'DELETE', body, accessToken });
  },
  listPermissions(params, accessToken) {
    const search = new URLSearchParams(params).toString();
    return request(`/iam/permissions${search ? `?${search}` : ''}`, { accessToken });
  },
  seedSystemAccess(accessToken) {
    return request('/iam/seed/system-access', { method: 'POST', accessToken });
  },
};
