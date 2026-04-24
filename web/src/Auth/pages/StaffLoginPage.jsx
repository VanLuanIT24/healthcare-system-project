import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../lib/api';
import { getDefaultRouteForAuth, isStaffSession } from '../../lib/authSession';
import { readStoredAuth, writeStoredAuth } from '../../lib/storage';

export function StaffLoginPage() {
  const navigate = useNavigate();
  const [formState, setFormState] = useState({
    identifier: '',
    password: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const auth = readStoredAuth();
    if (isStaffSession(auth)) {
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
      const response = await fetch(`${API_BASE_URL}/auth/staff/login`, {
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
        throw new Error(payload?.message || 'Đăng nhập nhân sự thất bại.');
      }

      const authData = {
        actorType: 'staff',
        user: payload?.data?.user || null,
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
    <main className="login-shell login-shell--staff">
      <Link className="page-home-button" to="/home">
        Về trang chủ
      </Link>

      <div className="login-background login-background--staff" aria-hidden="true">
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
      </div>

      <section className="login-card login-card--staff" aria-label="Staff login form">
        <div className="card-highlight" aria-hidden="true" />
        <div className="card-frame" aria-hidden="true" />

        <div className="login-card__content">
          <p className="form-kicker">Staff Access</p>
          <h2>Đăng nhập nhân sự</h2>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Tên đăng nhập hoặc email</span>
              <input
                type="text"
                name="identifier"
                placeholder="superadmin hoặc nhansu@healthcare.local"
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

            <button type="submit" className="login-button login-button--staff" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Đang xác thực...' : 'Vào hệ thống quản trị'}
            </button>
          </form>

          <div className="login-links login-links--staff">
            <Link to="/forgot-password?actor_type=staff">Quên mật khẩu nhân sự</Link>
            <Link to="/login">Đăng nhập bệnh nhân</Link>
          </div>
        </div>
      </section>

      <section className="hero-panel hero-panel--staff">
        <div className="medical-cross medical-cross--staff" aria-hidden="true">
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

        <div className="hero-copy hero-copy--staff">
          <p className="eyebrow">Healthcare Staff Console</p>
          <h1>
            <span>Cổng đăng nhập</span>
            <span>dành cho nhân sự</span>
          </h1>
          <p>
            Truy cập hệ thống vận hành y tế, kiểm soát tài khoản và điều phối nghiệp vụ nội bộ
            trong một không gian đăng nhập riêng cho đội ngũ staff.
          </p>
          <div className="staff-login-highlights">
            <span>Super Admin</span>
            <span>Quản trị vai trò</span>
            <span>Giám sát truy cập</span>
          </div>
        </div>
      </section>
    </main>
  );
}
