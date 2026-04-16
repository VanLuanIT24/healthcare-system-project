import { createContext, useContext, useEffect, useState } from 'react'
import { authAPI } from '../../utils/api'

const AUTH_CONTEXT_KEY = '__HEALTHCARE_AUTH_CONTEXT__'
const AuthContext =
  globalThis[AUTH_CONTEXT_KEY] || createContext(undefined)

if (!globalThis[AUTH_CONTEXT_KEY]) {
  globalThis[AUTH_CONTEXT_KEY] = AuthContext
}

function normalizePatientProfile(profile = {}) {
  if (!profile || typeof profile !== 'object') {
    return null
  }

  const patientId = profile.patient_id || profile.patientId || profile.id || ''
  const patientAccountId = profile.patient_account_id || profile.patientAccountId || ''
  const patientCode = profile.patient_code || profile.patientCode || ''
  const fullName = profile.full_name || profile.fullName || ''
  const lastLoginAt = profile.last_login_at || profile.lastLoginAt || null
  const actorType = profile.actor_type || profile.actorType || 'patient'
  const roles = Array.isArray(profile.roles) ? profile.roles : []
  const permissions = Array.isArray(profile.permissions) ? profile.permissions : []

  return {
    ...profile,
    id: patientId,
    actorType,
    patientId,
    patientAccountId,
    patientCode,
    fullName,
    email: profile.email || '',
    phone: profile.phone || '',
    status: profile.status || '',
    lastLoginAt,
    roles,
    permissions,
  }
}

function clearStoredAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
}

function persistAuthSession({ accessToken, refreshToken, user }) {
  localStorage.setItem('token', accessToken)

  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken)
  } else {
    localStorage.removeItem('refreshToken')
  }

  localStorage.setItem('user', JSON.stringify(user))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function refreshProfile() {
    const token = localStorage.getItem('token')

    if (!token) {
      setUser(null)
      return null
    }

    const response = await authAPI.me()
    const normalizedProfile = normalizePatientProfile(response.data?.data?.profile)

    if (!normalizedProfile) {
      throw new Error('Không thể đọc thông tin tài khoản.')
    }

    localStorage.setItem('user', JSON.stringify(normalizedProfile))
    setUser(normalizedProfile)
    return normalizedProfile
  }

  useEffect(() => {
    let isMounted = true

    async function bootstrapAuth() {
      const token = localStorage.getItem('token')
      const storedUser = localStorage.getItem('user')

      if (!token) {
        if (isMounted) {
          setLoading(false)
        }
        return
      }

      if (storedUser) {
        try {
          const normalizedStoredUser = normalizePatientProfile(JSON.parse(storedUser))

          if (normalizedStoredUser && isMounted) {
            setUser(normalizedStoredUser)
          }
        } catch {
          clearStoredAuth()
        }
      }

      try {
        await refreshProfile()
      } catch (err) {
        clearStoredAuth()

        if (isMounted) {
          setUser(null)
          setError(err.response?.data?.message || 'Phiên đăng nhập đã hết hạn.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    bootstrapAuth()

    return () => {
      isMounted = false
    }
  }, [])

  const login = async (loginValue, password) => {
    setError(null)

    try {
      const response = await authAPI.login(loginValue, password)
      const result = response.data?.data

      if (!result?.tokens?.access_token) {
        throw new Error('Token không được nhận từ server.')
      }

      const normalizedUser = normalizePatientProfile(result.patient)

      if (!normalizedUser) {
        throw new Error('Không thể đọc thông tin bệnh nhân.')
      }

      persistAuthSession({
        accessToken: result.tokens.access_token,
        refreshToken: result.tokens.refresh_token,
        user: normalizedUser,
      })

      setUser(normalizedUser)

      return {
        token: result.tokens.access_token,
        refreshToken: result.tokens.refresh_token,
        user: normalizedUser,
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Đăng nhập thất bại.'
      setError(message)
      throw new Error(message)
    }
  }

  const register = async (userData) => {
    setError(null)

    try {
      const response = await authAPI.register(userData)
      const result = response.data?.data

      if (!result?.tokens?.access_token) {
        throw new Error('Token không được nhận từ server.')
      }

      const normalizedUser = normalizePatientProfile(result.patient)

      if (!normalizedUser) {
        throw new Error('Không thể đọc thông tin bệnh nhân.')
      }

      persistAuthSession({
        accessToken: result.tokens.access_token,
        refreshToken: result.tokens.refresh_token,
        user: normalizedUser,
      })

      setUser(normalizedUser)

      return {
        token: result.tokens.access_token,
        refreshToken: result.tokens.refresh_token,
        user: normalizedUser,
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Đăng ký thất bại.'
      setError(message)
      throw new Error(message)
    }
  }

  const logout = async (options = {}) => {
    const { skipRequest = false } = options
    const refreshToken = localStorage.getItem('refreshToken')

    setError(null)

    try {
      if (!skipRequest && refreshToken) {
        await authAPI.logout(refreshToken)
      }
    } catch (err) {
      console.error('Logout request failed:', err)
    } finally {
      clearStoredAuth()
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
