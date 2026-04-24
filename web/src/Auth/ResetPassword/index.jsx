import { Link, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../Home/context/AuthContext'

function isStrongPassword(password) {
  return (
    password.length >= 8 &&
    password.length <= 32 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const [searchParams] = useSearchParams()
  const resetTokenFromUrl = searchParams.get('token') || ''
  const actorTypeFromUrl = searchParams.get('actor_type') || ''
  const [formData, setFormData] = useState({
    resetToken: resetTokenFromUrl,
    resetCode: '',
    newPassword: '',
    confirmPassword: '',
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

    if (!formData.resetToken.trim()) {
      setError('Thiếu reset token.')
      return
    }

    if (!formData.resetCode.trim()) {
      setError('Cần nhập mã reset được backend cấp.')
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.')
      return
    }

    if (!isStrongPassword(formData.newPassword)) {
      setError('Mật khẩu mới phải đúng password policy 8-32 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.')
      return
    }

    setIsLoading(true)

    try {
      await resetPassword({
        resetToken: formData.resetToken.trim(),
        resetCode: formData.resetCode.trim(),
        newPassword: formData.newPassword,
      })

      setMessage('Đặt lại mật khẩu thành công. Bạn có thể quay lại màn hình đăng nhập.')
      setFormData((prev) => ({
        ...prev,
        resetCode: '',
        newPassword: '',
        confirmPassword: '',
      }))
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
            <div className="brand-icon">#</div>
            <h2>Đặt lại mật khẩu</h2>
            <p>
              Route này khớp với reset link backend sinh ra:
              {' '}
              <code>/dat-lai-mat-khau</code>
              {actorTypeFromUrl ? ` cho actor_type=${actorTypeFromUrl}` : ''}.
            </p>
          </div>
        </div>

        <div className="auth-right">
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-header">
              <h1>Đặt lại mật khẩu</h1>
              <p>Nhập reset token, mã reset và mật khẩu mới theo đúng contract backend.</p>
            </div>

            {error && <div className="error-message">{error}</div>}
            {message && <div className="auth-success-message">{message}</div>}

            <div className="form-group">
              <label htmlFor="resetToken">Reset token *</label>
              <input
                id="resetToken"
                type="text"
                name="resetToken"
                value={formData.resetToken}
                onChange={handleChange}
                className="form-input"
                placeholder="Token từ link reset"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="resetCode">Mã reset *</label>
              <input
                id="resetCode"
                type="text"
                name="resetCode"
                value={formData.resetCode}
                onChange={handleChange}
                className="form-input"
                placeholder="Mã reset được cấp bởi backend"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">Mật khẩu mới *</label>
              <input
                id="newPassword"
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className="form-input"
                placeholder="Nhập mật khẩu mới"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Xác nhận mật khẩu mới *</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="form-input"
                placeholder="Nhập lại mật khẩu mới"
                required
              />
            </div>

            <button type="submit" disabled={isLoading} className="btn-submit">
              {isLoading ? 'Đang đặt lại mật khẩu...' : 'Đặt lại mật khẩu'}
            </button>

            <div className="form-footer">
              <p>
                Quay lại{' '}
                <Link to="/dang-nhap" className="link-primary">
                  đăng nhập
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      <div className="auth-bg-gradient"></div>
    </div>
  )
}
