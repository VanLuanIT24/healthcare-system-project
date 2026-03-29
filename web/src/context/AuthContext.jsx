import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const STORAGE_KEY = 'healthcare-auth-session';
const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());
  const [profile, setProfile] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  useEffect(() => {
    async function bootstrapProfile() {
      if (!session?.accessToken) {
        setProfile(null);
        setIsReady(true);
        return;
      }

      try {
        const response = await api.me(session.accessToken);
        setProfile(response.data.profile);
      } catch (error) {
        try {
          if (session.refreshToken) {
            const refreshed = await api.refreshToken({ refresh_token: session.refreshToken });
            const nextSession = {
              accessToken: refreshed.data.access_token,
              refreshToken: refreshed.data.refresh_token,
            };
            setSession(nextSession);
            const me = await api.me(nextSession.accessToken);
            setProfile(me.data.profile);
          } else {
            setSession(null);
            setProfile(null);
          }
        } catch {
          setSession(null);
          setProfile(null);
        }
      } finally {
        setIsReady(true);
      }
    }

    bootstrapProfile();
  }, [session?.accessToken, session?.refreshToken]);

  async function applyAuthResult(result) {
    const nextSession = {
      accessToken: result.tokens.access_token,
      refreshToken: result.tokens.refresh_token,
    };
    setSession(nextSession);
    setProfile(result.user || result.patient || null);
    return result;
  }

  async function loginStaff(payload) {
    const response = await api.staffLogin(payload);
    return applyAuthResult(response.data);
  }

  async function loginPatient(payload) {
    const response = await api.patientLogin(payload);
    return applyAuthResult(response.data);
  }

  async function registerPatient(payload) {
    const response = await api.patientRegister(payload);
    return applyAuthResult(response.data);
  }

  async function refreshProfile() {
    if (!session?.accessToken) {
      return null;
    }

    const response = await api.me(session.accessToken);
    setProfile(response.data.profile);
    return response.data.profile;
  }

  async function logout() {
    try {
      if (session?.refreshToken) {
        await api.logout({ refresh_token: session.refreshToken }, session.accessToken);
      }
    } finally {
      setSession(null);
      setProfile(null);
    }
  }

  async function changePassword(payload) {
    const response = await api.changePassword(payload, session?.accessToken);
    setSession(null);
    setProfile(null);
    return response;
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        isReady,
        isAuthenticated: Boolean(session?.accessToken && profile),
        loginStaff,
        loginPatient,
        registerPatient,
        logout,
        changePassword,
        refreshProfile,
        setSession,
        setProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth phải được dùng trong AuthProvider.');
  }

  return context;
}
