import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../Home/context/AuthContext'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
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

  const validateForm = () => {
    const newErrors = {}
    
    if (formData.fullName.length < 3) {
      newErrors.fullName = 'Tên phải có ít nhất 3 ký tự'
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ'
    }
    
    if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự'
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu không khớp'
    }
    
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'Bạn phải đồng ý với điều khoản'
    }
    
    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateForm()
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setIsLoading(true)

    try {
      await register({
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        confirm_password: formData.confirmPassword,
      })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setErrors({ submit: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-container register-container">
        <div className="auth-left">
          <div className="auth-brand">
            <div className="brand-icon">💚</div>
            <h2>Tạo Tài Khoản</h2>
            <p>Bắt đầu quản lý sức khỏe của bạn ngay hôm nay</p>
          </div>

          <div className="benefits-list">
            <div className="benefit-item">
              <div className="benefit-number">1</div>
              <div>
                <h4>Tạo tài khoản</h4>
                <p>Dễ dàng trong 2 phút</p>
              </div>
            </div>
            <div className="benefit-item">
              <div className="benefit-number">2</div>
              <div>
                <h4>Xác minh email</h4>
                <p>Bảo vệ tài khoản của bạn</p>
              </div>
            </div>
            <div className="benefit-item">
              <div className="benefit-number">3</div>
              <div>
                <h4>Bắt đầu sử dụng</h4>
                <p>Truy cập tất cả tính năng</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-right">
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-header">
              <h1>Đăng ký tài khoản</h1>
              <p>Tham gia cộng đồng chăm sóc sức khỏe của chúng tôi</p>
            </div>

            {errors.submit && (
              <div className="error-message">
                <span>⚠️</span> {errors.submit}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="fullName">Họ và tên *</label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Nguyễn Văn A"
                required
                className="form-input"
              />
              {errors.fullName && <span className="field-error">{errors.fullName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                required
                className="form-input"
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="phone">Số điện thoại</label>
              <input
                id="phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="09xxxxxxxx"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Mật khẩu *</label>
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
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Xác nhận mật khẩu *</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="form-input"
              />
              {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
            </div>

            <label className="form-checkbox">
              <input
                type="checkbox"
                name="agreeToTerms"
                checked={formData.agreeToTerms}
                onChange={handleChange}
                required
              />
              <span>Tôi đồng ý với <Link to="/terms" className="link-inline">điều khoản dịch vụ</Link> và <Link to="/privacy" className="link-inline">chính sách bảo mật</Link></span>
            </label>
            {errors.agreeToTerms && <span className="field-error">{errors.agreeToTerms}</span>}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-submit"
            >
              {isLoading ? (
                <>
                  <span className="spinner-small"></span>
                  Đang đăng ký...
                </>
              ) : (
                <>
                  Tạo tài khoản
                  <span className="btn-arrow">→</span>
                </>
              )}
            </button>

            <div className="form-footer">
              <p>Đã có tài khoản? <Link to="/dang-nhap" className="link-primary">Đăng nhập</Link></p>
            </div>
          </form>
        </div>
      </div>

      <div className="auth-bg-gradient"></div>
    </div>
  )
}
