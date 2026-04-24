import { createContext, useContext, useEffect, useState } from 'react'
import { authAPI, getApiErrorStatus } from '../../utils/api'

const AUTH_CONTEXT_KEY = '__HEALTHCARE_AUTH_CONTEXT__'
const AuthContext = globalThis[AUTH_CONTEXT_KEY] || createContext(undefined)

if (!globalThis[AUTH_CONTEXT_KEY]) {
  globalThis[AUTH_CONTEXT_KEY] = AuthContext
}

function normalizeAuthProfile(profile = {}) {
  if (!profile || typeof profile !== 'object') {
    return null
  }

  const actorType = profile.actor_type || profile.actorType || (profile.user_id ? 'staff' : 'patient')
  const userId = profile.user_id || profile.userId || ''
  const patientId = profile.patient_id || profile.patientId || ''
  const patientAccountId = profile.patient_account_id || profile.patientAccountId || ''
  const departmentId = profile.department_id || profile.departmentId || ''
  const employeeCode = profile.employee_code || profile.employeeCode || ''
  const patientCode = profile.patient_code || profile.patientCode || ''
  const fullName = profile.full_name || profile.fullName || profile.username || profile.email || ''
  const lastLoginAt = profile.last_login_at || profile.lastLoginAt || null
  const roles = Array.isArray(profile.roles) ? profile.roles : []
  const permissions = Array.isArray(profile.permissions) ? profile.permissions : []

  return {
    ...profile,
    actorType,
    actor_type: actorType,
    id: userId || patientId || profile.id || '',
    userId,
    user_id: userId,
    patientId,
    patient_id: patientId,
    patientAccountId,
    patient_account_id: patientAccountId,
    departmentId,
    department_id: departmentId,
    employeeCode,
    employee_code: employeeCode,
    patientCode,
    patient_code: patientCode,
    fullName,
    full_name: fullName,
    username: profile.username || '',
    email: profile.email || '',
    phone: profile.phone || '',
    status: profile.status || '',
    lastLoginAt,
    last_login_at: lastLoginAt,
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

function buildNormalizedSession(result = {}) {
  const normalizedUser = normalizeAuthProfile(result.user || result.patient || result.profile)

  if (!normalizedUser) {
    throw new Error('Không thể đọc thông tin tài khoản.')
  }

  const accessToken = result.tokens?.access_token

  if (!accessToken) {
    throw new Error('Token không được nhận từ server.')
  }

  return {
    token: accessToken,
    refreshToken: result.tokens?.refresh_token,
    user: normalizedUser,
  }
}

async function attemptRoleAwareLogin(loginValue, password) {
  const attempts = [
    () => authAPI.loginPatient(loginValue, password),
    () => authAPI.loginStaff(loginValue, password),
  ]

  let lastError = null

  for (const request of attempts) {
    try {
      const response = await request()
      return buildNormalizedSession(response.data?.data)
    } catch (error) {
      lastError = error

      if (![400, 401, 403, 404].includes(getApiErrorStatus(error))) {
        throw error
      }
    }
  }

  throw lastError || new Error('Đăng nhập thất bại.')
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
    const normalizedProfile = normalizeAuthProfile(response.data?.data?.profile)

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
          const normalizedStoredUser = normalizeAuthProfile(JSON.parse(storedUser))

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
      const session = await attemptRoleAwareLogin(loginValue, password)

      persistAuthSession({
        accessToken: session.token,
        refreshToken: session.refreshToken,
        user: session.user,
      })

      setUser(session.user)
      return session
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
      const session = buildNormalizedSession(response.data?.data)

      persistAuthSession({
        accessToken: session.token,
        refreshToken: session.refreshToken,
        user: session.user,
      })

      setUser(session.user)
      return session
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

  const forgotPassword = async (payload) => {
    setError(null)

    try {
      const response = await authAPI.forgotPassword(payload)
      return response.data?.data || null
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Không thể gửi yêu cầu đặt lại mật khẩu.'
      setError(message)
      throw new Error(message)
    }
  }

  const resetPassword = async (payload) => {
    setError(null)

    try {
      const response = await authAPI.resetPassword(payload)
      return response.data?.data || null
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Không thể đặt lại mật khẩu.'
      setError(message)
      throw new Error(message)
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, register, logout, refreshProfile, forgotPassword, resetPassword }}
    >
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
