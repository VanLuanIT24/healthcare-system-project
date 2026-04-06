import { createContext, useState, useContext, useEffect } from 'react'
import { authAPI } from '../../utils/api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (token && userData) {
      setUser(JSON.parse(userData))
    }
    setLoading(false)
  }, [])

  const login = async (login, password) => {
    setError(null)
    try {
      const response = await authAPI.login(login, password)
      // Backend returns: { ok: true, message: "...", data: { tokens: { access_token, refresh_token }, patient }, ... }
      const result = response.data
      
      if (!result.data || !result.data.tokens || !result.data.tokens.access_token) {
        throw new Error('Token không được nhận từ server')
      }
      
      const { tokens, patient } = result.data
      const token = tokens.access_token
      const refreshToken = tokens.refresh_token
      
      localStorage.setItem('token', token)
      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('user', JSON.stringify(patient))
      setUser(patient)
      
      return { token, refreshToken, user: patient }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Đăng nhập thất bại'
      setError(message)
      throw new Error(message)
    }
  }

  const register = async (userData) => {
    setError(null)
    try {
      const response = await authAPI.register(userData)
      // Backend returns: { ok: true, message: "...", data: { tokens: { access_token, refresh_token }, patient }, ... }
      const result = response.data
      
      if (!result.data || !result.data.tokens || !result.data.tokens.access_token) {
        throw new Error('Token không được nhận từ server')
      }
      
      const { tokens, patient } = result.data
      const token = tokens.access_token
      const refreshToken = tokens.refresh_token
      
      localStorage.setItem('token', token)
      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('user', JSON.stringify(patient))
      setUser(patient)
      
      return { token, refreshToken, user: patient }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Đăng ký thất bại'
      setError(message)
      throw new Error(message)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
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
