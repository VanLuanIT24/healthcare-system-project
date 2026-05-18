import { useCallback, useEffect, useMemo, useState } from 'react'
import { authAPI } from '../utils/api'
import { clearStoredAuth, readStoredAuth, writeStoredAuth } from '../lib/storage'

const AUTH_CHANGED_EVENT = 'doctor-auth-changed'

function getStoredUser(auth) {
  return auth?.user || auth?.profile || auth?.data?.user || null
}

function getProfileFromResponse(response) {
  const payload = response?.data?.data ?? response?.data ?? null
  const profile = payload?.profile || payload
  return profile?.user || profile?.patient_account || profile?.patient || profile
}

function emitAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export function useAuth() {
  const [auth, setAuth] = useState(() => readStoredAuth())

  useEffect(() => {
    function syncAuth() {
      setAuth(readStoredAuth())
    }

    window.addEventListener('storage', syncAuth)
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuth)

    return () => {
      window.removeEventListener('storage', syncAuth)
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const response = await authAPI.getMe()
    const profile = getProfileFromResponse(response)
    const currentAuth = readStoredAuth()

    if (currentAuth && profile) {
      const nextAuth = {
        ...currentAuth,
        user: {
          ...(currentAuth.user || {}),
          ...profile,
        },
      }

      writeStoredAuth(nextAuth)
      setAuth(nextAuth)
      emitAuthChanged()
    }

    return profile
  }, [])

  const logout = useCallback(async () => {
    const currentAuth = readStoredAuth()
    const refreshToken = currentAuth?.tokens?.refresh_token

    try {
      await authAPI.logout(refreshToken)
    } catch (error) {
      // Local logout must still clear a stale or expired session.
    } finally {
      clearStoredAuth()
      setAuth(null)
      emitAuthChanged()
    }
  }, [])

  return useMemo(() => ({
    auth,
    user: getStoredUser(auth),
    logout,
    refreshProfile,
  }), [auth, logout, refreshProfile])
}
