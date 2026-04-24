import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../lib/api';
import { getDefaultRouteForAuth } from '../../lib/authSession';
import { readStoredAuth } from '../../lib/storage';
import { writeStoredAuth } from '../../lib/storage';
export function LoginPage() {
  const navigate = useNavigate();
  const [formState, setFormState] = useState({
    identifier: '',
    password: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const auth = readStoredAuth();
    if (auth?.tokens?.access_token) {
      navigate(getDefaultRouteForAuth(auth), { replace: true });
    }
  }, [navigate]);

  const canSubmit = useMemo(() => {
    return formState.identifier.trim() && formState.password.trim();
  }, [formState.identifier, formState.password]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/patients/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: formState.identifier.trim(),
          password: formState.password,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || 'Đăng nhập thất bại.');
      }

      const authData = {
        actorType: 'patient',
        patient: payload?.data?.patient || null,
        tokens: payload?.data?.tokens || null,
      };

      writeStoredAuth(authData);
      navigate(getDefaultRouteForAuth(authData), { replace: true });
    } catch (error) {
      setErrorMessage(error.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <Link className="page-home-button" to="/home">
        Về trang chủ
      </Link>

      <div className="login-background" aria-hidden="true">
        <div className="background-orb orb-left" />
        <div className="background-orb orb-right" />
        <div className="aurora-band aurora-band--one" />
        <div className="aurora-band aurora-band--two" />
        <div className="aurora-band aurora-band--three" />
        <div className="halo halo-left" />
        <div className="halo halo-right" />
        <div className="pulse-ring pulse-ring--one" />
        <div className="pulse-ring pulse-ring--two" />
        <div className="light-column light-column--one" />
        <div className="light-column light-column--two" />
        <div className="scanner scanner--one" />
        <div className="scanner scanner--two" />
        <div className="background-grid" />
        <div className="particle-cluster">
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              className="particle"
              style={{
                '--size': `${8 + (index % 4) * 4}px`,
                '--x': `${8 + (index % 6) * 11}%`,
                '--y': `${12 + Math.floor(index / 3) * 11}%`,
                '--delay': `${index * 0.35}s`,
              }}
            />
          ))}
        </div>
        <div className="spark-trail spark-trail--one" />
        <div className="spark-trail spark-trail--two" />
        <div className="micro-stars">
          {Array.from({ length: 14 }).map((_, index) => (
            <span
              key={`star-${index}`}
              className="micro-star"
              style={{
                '--star-x': `${4 + (index % 7) * 13}%`,
                '--star-y': `${8 + Math.floor(index / 2) * 11}%`,
                '--star-delay': `${index * 0.45}s`,
              }}
            />
          ))}
        </div>
      </div>

      <section className="login-card" aria-label="Login form">
        <div className="card-highlight" aria-hidden="true" />
        <div className="card-frame" aria-hidden="true" />

        <div className="login-card__content">
          <p className="form-kicker">Patient Access</p>

          <h2>Đăng nhập</h2>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Email hoặc số điện thoại</span>
              <input
                type="text"
                name="identifier"
                placeholder="benhnhan1@gmail.com"
                autoComplete="username"
                value={formState.identifier}
                onChange={handleChange}
              />
            </label>

            <label className="field">
              <span>Mật khẩu</span>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={formState.password}
                onChange={handleChange}
              />
            </label>

            {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

            <button type="submit" className="login-button" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="login-links">
            <Link to="/forgot-password">Quên mật khẩu</Link>
            <Link to="/register">Chưa có tài khoản? Đăng ký ngay</Link>
            <Link to="/staff/login">Đăng nhập nhân sự</Link>
          </div>
        </div>
      </section>

      <section className="hero-panel">
        <div className="medical-cross" aria-hidden="true">
          <span className="cross-shadow-layer" />
          <span className="cross-depth-layer cross-depth-layer--rear" />
          <span className="cross-depth-layer cross-depth-layer--mid" />
          <span className="cross-core" />
          <span className="cross-glow" />
          <span className="cross-ring cross-ring--one" />
          <span className="cross-ring cross-ring--two" />
          <span className="cross-flare cross-flare--one" />
          <span className="cross-flare cross-flare--two" />
        </div>

        <div className="hero-copy">
          <p className="eyebrow">Healthcare Portal</p>
          <h1>Chào mừng bạn quay trở lại</h1>
          <p>
            Truy cập hồ sơ sức khỏe và lịch hẹn của bạn chỉ với một bước đăng
            nhập.
          </p>
        </div>
      </section>
    </main>
  );
}
