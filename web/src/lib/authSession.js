import { clearStoredAuth, readStoredAuth } from './storage';

export function getAccessToken(auth = readStoredAuth()) {
  return auth?.tokens?.access_token || '';
}

export function hasRole(auth = readStoredAuth(), roleCode) {
  const roles = auth?.user?.roles || auth?.patient?.roles || [];
  return Array.isArray(roles) && roles.includes(roleCode);
}

export function isStaffSession(auth = readStoredAuth()) {
  return auth?.actorType === 'staff' && !!getAccessToken(auth);
}

export function isPatientSession(auth = readStoredAuth()) {
  return auth?.actorType === 'patient' && !!getAccessToken(auth);
}

export function isSuperAdminSession(auth = readStoredAuth()) {
  return isStaffSession(auth) && hasRole(auth, 'super_admin');
}

export function getDefaultRouteForAuth(auth = readStoredAuth()) {
  if (isSuperAdminSession(auth)) return '/admin/overview';
  if (isStaffSession(auth)) return '/staff/overview';
  if (isPatientSession(auth)) return '/patient';
  return '/login';
}

export function createAuthHeaders(auth = readStoredAuth()) {
  const token = getAccessToken(auth);
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

export async function fetchWithAuth(url, options = {}) {
  const auth = readStoredAuth();
  const headers = {
    ...(options.headers || {}),
    ...createAuthHeaders(auth),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearStoredAuth();
  }

  return response;
}
