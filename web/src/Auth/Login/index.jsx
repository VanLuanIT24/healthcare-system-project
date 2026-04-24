import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../Home/context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    login: '',
    password: '',
    rememberMe: false,
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    try {
      await login(formData.login, formData.password)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setErrors({ submit: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <div className="auth-left">
          <div className="auth-brand">
            <div className="brand-icon">⚕️</div>
            <h2>HealthCare System</h2>
            <p>Nền tảng quản lý sức khỏe toàn diện</p>
          </div>

          <div className="features-list">
            <div className="feature-item">
              <span className="feature-icon">🏥</span>
              <div>
                <h4>Chăm sóc toàn diện</h4>
                <p>Quản lý tất cả thông tin y tế tại một nơi</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔒</span>
              <div>
                <h4>Bảo mật tối đa</h4>
                <p>Mã hóa end-to-end cho mọi dữ liệu</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📱</span>
              <div>
                <h4>Truy cập mọi lúc</h4>
                <p>Sử dụng trên mobile, tablet hay máy tính</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-right">
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-header">
              <h1>Đăng nhập</h1>
              <p>Truy cập tài khoản của bạn ngay</p>
            </div>

            {errors.submit && (
              <div className="error-message">
                <span>⚠️</span> {errors.submit}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="login">Email hoặc số điện thoại</label>
              <input
                id="login"
                type="text"
                name="login"
                value={formData.login}
                onChange={handleChange}
                placeholder="your@email.com hoặc 09xxxxxxxx"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Mật khẩu</label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="form-input"
              />
            </div>

            <div className="form-remember">
              <label>
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                />
                <span>Nhớ mật khẩu</span>
              </label>
              <Link to="/quen-mat-khau" className="forgot-link">Quên mật khẩu?</Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-submit"
            >
              {isLoading ? (
                <>
                  <span className="spinner-small"></span>
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  Đăng nhập
                  <span className="btn-arrow">→</span>
                </>
              )}
            </button>

            <div className="form-footer">
              <p>Chưa có tài khoản? <Link to="/dang-ky" className="link-primary">Đăng ký ngay</Link></p>
            </div>
          </form>
        </div>
      </div>

      <div className="auth-bg-gradient"></div>
    </div>
  )
}
