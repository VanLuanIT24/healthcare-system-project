import { API_BASE_URL } from './api';
import { clearStoredAuth, readStoredAuth, writeStoredAuth } from './storage';
import { canAccessStaffPath, resolveStaffLandingPath } from '../receptionist/workspaceAccess';

let refreshPromise = null;

export function getAccessToken(auth = readStoredAuth()) {
  return auth?.tokens?.access_token || '';
}

export function hasRole(auth = readStoredAuth(), roleCode) {
  const roles = auth?.user?.roles || auth?.patient?.roles || auth?.roles || [];
  return Array.isArray(roles) && roles.includes(roleCode);
}

export function isStaffSession(auth = readStoredAuth()) {
  return auth?.actorType === 'staff' && !!getAccessToken(auth);
}

export function isPatientSession(auth = readStoredAuth()) {
  return ['patient', 'patient_relative'].includes(auth?.actorType) && !!getAccessToken(auth);
}

export function isSuperAdminSession(auth = readStoredAuth()) {
  return isStaffSession(auth) && hasRole(auth, 'super_admin');
}

export function getDefaultRouteForAuth(auth = readStoredAuth()) {
  if (isStaffSession(auth)) return resolveStaffLandingPath(auth);
  if (isPatientSession(auth)) return '/portal/dashboard';
  return '/login';
}

function isSafeInternalPath(target) {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//');
}

export function resolvePostLoginRedirect(target, auth = readStoredAuth()) {
  const fallback = getDefaultRouteForAuth(auth);
  if (!isSafeInternalPath(target)) return fallback;

  if (isPatientSession(auth)) {
    return target.startsWith('/portal') || target.startsWith('/patient') ? target : fallback;
  }

  if (isStaffSession(auth)) {
    if (auth?.user?.must_change_password) {
      return fallback;
    }
    return canAccessStaffPath(auth, target) ? target : fallback;
  }

  return fallback;
}

export function createLoginRedirectPath(location, actorType = 'patient') {
  const target = `${location?.pathname || ''}${location?.search || ''}${location?.hash || ''}` || '/portal/dashboard';
  const loginPath = actorType === 'staff' ? '/staff/login' : '/login';
  return `${loginPath}?redirect=${encodeURIComponent(target)}`;
}

export function createAuthHeaders(auth = readStoredAuth()) {
  const token = getAccessToken(auth);
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function isRefreshEndpoint(url = '') {
  return String(url).includes('/auth/refresh-token');
}

async function refreshStoredAuthTokens() {
  const currentAuth = readStoredAuth();
  const refreshToken = currentAuth?.tokens?.refresh_token;

  if (!refreshToken) {
    clearStoredAuth();
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok) {
        clearStoredAuth();
        const refreshError = new Error(payload?.message || 'Phiên đăng nhập đã hết hạn.');
        refreshError.response = { status: response.status, data: payload };
        throw refreshError;
      }

      const nextTokens = payload?.data || {};
      const nextAuth = {
        ...currentAuth,
        tokens: {
          ...(currentAuth?.tokens || {}),
          access_token: nextTokens.access_token,
          refresh_token: nextTokens.refresh_token || refreshToken,
        },
      };

      writeStoredAuth(nextAuth);
      return nextAuth;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function fetchWithAuth(url, options = {}) {
  const { skipRefresh = false, ...fetchOptions } = options;
  const auth = readStoredAuth();
  const headers = {
    ...(fetchOptions.headers || {}),
    ...createAuthHeaders(auth),
  };

  let response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (response.status !== 401 || skipRefresh || isRefreshEndpoint(url)) {
    if (response.status === 401 && isRefreshEndpoint(url)) {
      clearStoredAuth();
    }
    return response;
  }

  if (!auth?.tokens?.refresh_token) {
    clearStoredAuth();
    return response;
  }

  try {
    const refreshedAuth = await refreshStoredAuthTokens();
    if (!refreshedAuth?.tokens?.access_token) {
      clearStoredAuth();
      return response;
    }

    response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...(fetchOptions.headers || {}),
        ...createAuthHeaders(refreshedAuth),
      },
    });
  } catch (error) {
    clearStoredAuth();
    return response;
  }

  if (response.status === 401) {
    clearStoredAuth();
  }

  return response;
}
