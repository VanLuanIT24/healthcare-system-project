import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

console.log('API_BASE_URL:', API_BASE_URL)

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  console.log('Request:', config.method?.toUpperCase(), config.url, config.data)
  return config
})

// Log responses
api.interceptors.response.use(
  (response) => {
    console.log('Response OK:', response.status, response.data)
    return response
  },
  (error) => {
    console.error('Response Error:', error.response?.status, error.response?.data, error.message)
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (login, password) => api.post('/auth/patients/login', { login, password }),
  register: (userData) => api.post('/auth/patients/register', userData),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh-token'),
}

export default api
