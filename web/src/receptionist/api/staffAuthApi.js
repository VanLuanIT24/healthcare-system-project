import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

function buildUrl(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function request(path, { method = 'GET', params, body } = {}) {
  const response = await fetchWithAuth(buildUrl(path, params), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const apiError = new Error(payload?.message || 'Không thể tải thông tin phiên đăng nhập.');
    apiError.status = response.status;
    apiError.payload = payload;
    throw apiError;
  }

  return payload?.data || null;
}

export const staffAuthApi = {
  getMe: () => request('/auth/me'),
  getMyRoles: () => request('/auth/me/roles'),
  getMyPermissions: () => request('/auth/me/permissions'),
  getCurrentSession: () => request('/auth/me/session'),
  getMyLoginHistory: (params) => request('/auth/me/login-history', { params }),
  logout: (refreshToken) =>
    request('/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refresh_token: refreshToken } : {},
    }),
};
