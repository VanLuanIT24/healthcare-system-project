import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'healthcare-auth';

function readStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() => readStoredAuth() || {
    accessToken: '',
    refreshToken: '',
    profile: null,
  });
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authState));
  }, [authState]);

  useEffect(() => {
    if (authState.accessToken && !authState.profile) {
      loadProfile(authState.accessToken).catch(() => {
        setAuthState({
          accessToken: '',
          refreshToken: '',
          profile: null,
        });
      });
    }
  }, [authState.accessToken, authState.profile]);

  async function loadProfile(accessToken = authState.accessToken) {
    if (!accessToken) return null;
    setLoadingProfile(true);
    try {
      const response = await api.request('/auth/me', {
        token: accessToken,
      });
      const profile = response.data.profile;
      setAuthState((current) => ({ ...current, profile }));
      return profile;
    } finally {
      setLoadingProfile(false);
    }
  }

  function saveAuth(data) {
    const nextState = {
      accessToken: data.tokens?.access_token || '',
      refreshToken: data.tokens?.refresh_token || '',
      profile: data.user || data.patient || null,
    };
    setAuthState(nextState);
    return nextState;
  }

  async function staffLogin(payload) {
    const response = await api.request('/auth/staff/login', {
      method: 'POST',
      body: payload,
    });
    saveAuth(response.data);
    return response;
  }

  async function patientLogin(payload) {
    const response = await api.request('/auth/patients/login', {
      method: 'POST',
      body: payload,
    });
    saveAuth(response.data);
    return response;
  }

  async function patientRegister(payload) {
    const response = await api.request('/auth/patients/register', {
      method: 'POST',
      body: payload,
    });
    saveAuth(response.data);
    return response;
  }

  async function refreshToken() {
    if (!authState.refreshToken) {
      throw new Error('Không có refresh token để làm mới phiên đăng nhập.');
    }

    const response = await api.request('/auth/refresh-token', {
      method: 'POST',
      body: {
        refresh_token: authState.refreshToken,
      },
    });

    setAuthState((current) => ({
      ...current,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
    }));

    return response;
  }

  async function logout() {
    if (authState.refreshToken) {
      try {
        await api.request('/auth/logout', {
          method: 'POST',
          body: {
            refresh_token: authState.refreshToken,
          },
        });
      } catch {
      }
    }

    setAuthState({
      accessToken: '',
      refreshToken: '',
      profile: null,
    });
  }

  async function changePassword(payload) {
    return api.request('/auth/change-password', {
      method: 'POST',
      token: authState.accessToken,
      body: payload,
    });
  }

  async function createStaffAccount(payload) {
    return api.request('/auth/staff/accounts', {
      method: 'POST',
      token: authState.accessToken,
      body: payload,
    });
  }

  async function assignRoles(payload) {
    return api.request('/auth/staff/accounts/roles', {
      method: 'PATCH',
      token: authState.accessToken,
      body: payload,
    });
  }

  function hasAnyRole(roles) {
    const currentRoles = authState.profile?.roles || [];
    return roles.some((role) => currentRoles.includes(role));
  }

  const value = useMemo(
    () => ({
      authState,
      isAuthenticated: Boolean(authState.accessToken),
      loadingProfile,
      loadProfile,
      staffLogin,
      patientLogin,
      patientRegister,
      refreshToken,
      logout,
      changePassword,
      createStaffAccount,
      assignRoles,
      hasAnyRole,
    }),
    [authState, loadingProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
