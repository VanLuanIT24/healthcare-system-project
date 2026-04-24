import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../Home/context/AuthContext'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { forgotPassword } = useAuth()
  const [formData, setFormData] = useState({
    actorType: 'patient',
    login: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsLoading(true)

    try {
      const result = await forgotPassword({
        actorType: formData.actorType,
        login: formData.login,
      })

      const expiresText = result?.expires_in_minutes
        ? `Yeu cau co hieu luc trong ${result.expires_in_minutes} phut.`
        : 'Yeu cau da duoc ghi nhan.'

      setMessage(
        `${expiresText} Backend hien xu ly qua kenh internal, neu can hay lien he quan tri vien hoac dung link reset da duoc cap.`,
      )
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <div className="auth-left">
          <div className="auth-brand">
            <div className="brand-icon">?</div>
            <h2>Quên mật khẩu</h2>
            <p>Trang này đã nối trực tiếp tới endpoint forgot-password của backend.</p>
          </div>
        </div>

        <div className="auth-right">
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-header">
              <h1>Tạo yêu cầu đặt lại mật khẩu</h1>
              <p>Chọn đúng loại tài khoản để frontend gửi đúng actor_type theo contract backend.</p>
            </div>

            {error && <div className="error-message">{error}</div>}
            {message && <div className="auth-success-message">{message}</div>}

            <div className="auth-type-switch" role="tablist" aria-label="Loai tai khoan">
              <button
                type="button"
                className={`auth-type-option ${formData.actorType === 'patient' ? 'active' : ''}`}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    actorType: 'patient',
                  }))
                }
              >
                Benh nhan
              </button>
              <button
                type="button"
                className={`auth-type-option ${formData.actorType === 'staff' ? 'active' : ''}`}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    actorType: 'staff',
                  }))
                }
              >
                Nhan su
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="login">
                {formData.actorType === 'staff' ? 'Username hoặc email nhân sự' : 'Email hoặc số điện thoại'}
              </label>
              <input
                id="login"
                type="text"
                name="login"
                value={formData.login}
                onChange={handleChange}
                className="form-input"
                placeholder={
                  formData.actorType === 'staff'
                    ? 'superadmin hoặc superadmin@healthcare.local'
                    : 'your@email.com hoặc 09xxxxxxxx'
                }
                required
              />
            </div>

            <button type="submit" disabled={isLoading} className="btn-submit">
              {isLoading ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu'}
            </button>

            <div className="form-footer auth-inline-actions">
              <Link to="/dang-nhap" className="link-primary">
                Quay lại đăng nhập
              </Link>
              <button
                type="button"
                className="auth-secondary-button"
                onClick={() => navigate('/dat-lai-mat-khau')}
              >
                Mở trang đặt lại mật khẩu
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="auth-bg-gradient"></div>
    </div>
  )
}
