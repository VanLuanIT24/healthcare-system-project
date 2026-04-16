import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const AUTH_WHITELIST = [
  '/auth/patients/login',
  '/auth/patients/register',
  '/auth/refresh-token',
  '/auth/forgot-password',
  '/auth/reset-password',
]

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise = null

function getStoredToken() {
  return localStorage.getItem('token')
}

function getStoredRefreshToken() {
  return localStorage.getItem('refreshToken')
}

function setStoredTokens(accessToken, refreshToken) {
  localStorage.setItem('token', accessToken)

  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken)
  }
}

function clearStoredAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
}

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return
  }

  if (window.location.pathname !== '/dang-nhap') {
    window.location.replace('/dang-nhap')
  }
}

function isAuthWhitelisted(url = '') {
  return AUTH_WHITELIST.some((path) => url.includes(path))
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split('.')

    if (!payload) {
      return null
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    return JSON.parse(window.atob(padded))
  } catch {
    return null
  }
}

function isTokenExpiringSoon(token, thresholdSeconds = 30) {
  const payload = decodeJwtPayload(token)

  if (!payload?.exp) {
    return false
  }

  const nowInSeconds = Math.floor(Date.now() / 1000)
  return payload.exp <= nowInSeconds + thresholdSeconds
}

async function requestTokenRefresh() {
  const refreshToken = getStoredRefreshToken()

  if (!refreshToken) {
    throw new Error('Thiếu refresh token.')
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/auth/refresh-token`,
        { refresh_token: refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
      .then((response) => {
        const tokens = response.data?.data

        if (!tokens?.access_token || !tokens?.refresh_token) {
          throw new Error('Không thể làm mới phiên đăng nhập.')
        }

        setStoredTokens(tokens.access_token, tokens.refresh_token)
        return tokens.access_token
      })
      .catch((error) => {
        clearStoredAuth()
        redirectToLogin()
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

api.interceptors.request.use(async (config) => {
  let token = getStoredToken()

  if (token && !isAuthWhitelisted(config.url) && isTokenExpiringSoon(token)) {
    token = await requestTokenRefresh()
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthWhitelisted(originalRequest.url)
    ) {
      try {
        originalRequest._retry = true
        const newToken = await requestTokenRefresh()
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        clearStoredAuth()
        redirectToLogin()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (login, password) => api.post('/auth/patients/login', { login, password }),
  register: (userData) => api.post('/auth/patients/register', userData),
  logout: (refreshToken) => api.post('/auth/logout', { refresh_token: refreshToken }),
  refreshToken: (refreshToken) => api.post('/auth/refresh-token', { refresh_token: refreshToken }),
  me: () => api.get('/auth/me'),
  updateMyProfile: (payload) => api.patch('/auth/my-profile', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
  getMySessions: () => api.get('/auth/my-sessions'),
  getLoginHistory: (params = {}) => api.get('/auth/login-history', { params }),
  revokeSession: (sessionId) => api.post('/auth/sessions/revoke', { session_id: sessionId }),
  logoutAllDevices: () => api.post('/auth/logout-all-devices'),
}

export default api
