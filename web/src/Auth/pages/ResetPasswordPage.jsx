import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../lib/api';
export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const [formState, setFormState] = useState({
    actor_type: searchParams.get('actor_type') || 'patient',
    reset_token: searchParams.get('token') || '',
    reset_code: '',
    new_password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actor_type: formState.actor_type,
          reset_token: formState.reset_token.trim(),
          reset_code: formState.reset_code.trim(),
          new_password: formState.new_password,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'Đặt lại mật khẩu thất bại.');
      }

      setSuccessMessage(payload?.message || 'Đặt lại mật khẩu thành công.');
      window.setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (error) {
      setErrorMessage(error.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell assist-shell">
      <Link className="page-home-button" to="/login">
        Quay lại đăng nhập
      </Link>

      <div className="login-background" aria-hidden="true">
        <div className="background-orb orb-left" />
        <div className="background-orb orb-right" />
        <div className="aurora-band aurora-band--one" />
        <div className="aurora-band aurora-band--two" />
        <div className="halo halo-left" />
        <div className="halo halo-right" />
      </div>

      <section className="hero-panel assist-hero">
        <div className="hero-copy assist-copy">
          <p className="eyebrow">Reset Password</p>
          <h1>
            <span>Đặt lại</span>
            <span>mật khẩu</span>
          </h1>
          <p className="register-subcopy">
            Dùng `reset_token`, `reset_code` và mật khẩu mới theo đúng API backend `/auth/reset-password`.
          </p>
        </div>
      </section>

      <section className="login-card assist-card" aria-label="Reset password form">
        <div className="card-highlight" aria-hidden="true" />
        <div className="card-frame" aria-hidden="true" />

        <div className="login-card__content">
          <p className="form-kicker">Reset Password</p>
          <h2>Đặt lại mật khẩu</h2>

          <form className="login-form register-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Loại tài khoản</span>
              <select className="field-select" name="actor_type" value={formState.actor_type} onChange={handleChange}>
                <option value="patient">Bệnh nhân</option>
                <option value="staff">Nhân sự</option>
              </select>
            </label>

            <label className="field">
              <span>Reset token</span>
              <input
                type="text"
                name="reset_token"
                placeholder="Token đặt lại mật khẩu"
                value={formState.reset_token}
                onChange={handleChange}
              />
            </label>

            <label className="field">
              <span>Mã reset</span>
              <input
                type="text"
                name="reset_code"
                placeholder="Mã xác nhận reset"
                value={formState.reset_code}
                onChange={handleChange}
              />
            </label>

            <label className="field">
              <span>Mật khẩu mới</span>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="new_password"
                  placeholder="Mật khẩu mới"
                  value={formState.new_password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 102.8 2.8" />
                      <path d="M9.9 5.1A10.9 10.9 0 0112 5c5.2 0 9.3 4.1 10 7-.3 1.3-1.4 3.2-3.2 4.8" />
                      <path d="M6.2 6.3C4.1 7.7 2.7 9.8 2 12c.4 1.7 2.1 4.4 5 6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}
            {successMessage ? <p className="form-message success">{successMessage}</p> : null}

            <button
              type="submit"
              className="login-button"
              disabled={!formState.reset_token.trim() || !formState.reset_code.trim() || !formState.new_password.trim() || isSubmitting}
            >
              {isSubmitting ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
            </button>
          </form>

          <div className="login-links">
            <Link to="/forgot-password">Quay lại quên mật khẩu</Link>
            <Link to="/login">Đăng nhập</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
