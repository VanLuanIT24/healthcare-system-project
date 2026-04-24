import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RecoveryActorSelect } from '../components/RecoveryActorSelect';
import { API_BASE_URL } from '../../lib/api';
export function ForgotPasswordPage() {
  const [formState, setFormState] = useState({
    actor_type: 'patient',
    login: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setResetLink('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actor_type: formState.actor_type,
          login: formState.login.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'Không thể gửi yêu cầu khôi phục mật khẩu.');
      }

      setSuccessMessage(payload?.message || 'Yêu cầu quên mật khẩu đã được ghi nhận.');
      setResetLink(payload?.data?.reset_link || '');
    } catch (error) {
      setErrorMessage(error.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="recovery-shell">
      <header className="recovery-topbar">
        <Link className="recovery-brand" to="/home">
          Healthcare
        </Link>

        <nav className="recovery-nav">
          <Link to="/support">Hỗ trợ</Link>
          <Link to="/terms">Điều khoản</Link>
          <Link to="/login">Quay lại đăng nhập</Link>
          <Link className="recovery-nav__cta" to="/register">
            Tạo tài khoản mới
          </Link>
        </nav>
      </header>

      <section className="recovery-layout">
        <div className="recovery-side">
          <p className="recovery-kicker">Healthcare Recovery</p>
          <h1>Khôi phục mật khẩu</h1>
          <span className="recovery-rule" />
          <p className="recovery-description">
            Chúng tôi cam kết bảo mật thông tin y tế của bạn. Hãy làm theo các bước sau để đặt lại quyền truy cập vào hồ sơ của mình.
          </p>

          <div className="recovery-points">
            <article className="recovery-point">
              <span className="recovery-point__icon">🛡</span>
              <div>
                <h3>Xác thực danh tính</h3>
                <p>Hệ thống hỗ trợ khôi phục thông qua email hoặc số điện thoại đã đăng ký.</p>
              </div>
            </article>
            <article className="recovery-point">
              <span className="recovery-point__icon">✦</span>
              <div>
                <h3>Bảo mật nâng cao</h3>
                <p>Sử dụng luồng backend hiện có để ghi nhận yêu cầu và cấp liên kết đặt lại mật khẩu.</p>
              </div>
            </article>
            <article className="recovery-point">
              <span className="recovery-point__icon">↺</span>
              <div>
                <h3>Chuyển hướng an toàn</h3>
                <p>Sau khi gửi yêu cầu, bạn có thể mở liên kết reset do backend trả về để tiếp tục.</p>
              </div>
            </article>
          </div>
        </div>

        <div className="recovery-panel">
          <div className="recovery-panel__backdrop" aria-hidden="true" />
          <section className="recovery-card" aria-label="Forgot password form">
            <div className="recovery-card__inner">
              <p className="form-kicker">Account Recovery</p>
              <h2>Quên mật khẩu</h2>

              <form className="login-form recovery-form" onSubmit={handleSubmit}>
                <label className="field recovery-field">
                  <span>Loại tài khoản</span>
                  <RecoveryActorSelect value={formState.actor_type} onChange={handleChange} />
                </label>

                <label className="field recovery-field">
                  <span>Email / Phonesố điện thoại</span>
                  <div className="recovery-input-wrap">
                    <span className="recovery-input__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <rect x="3" y="5" width="18" height="14" rx="2.5" />
                        <path d="M4.5 7l7.5 6 7.5-6" />
                      </svg>
                    </span>
                    <input
                      className="recovery-input"
                      type="text"
                      name="login"
                      placeholder="benhnhan@gmail.com hoặc 0337..."
                      value={formState.login}
                      onChange={handleChange}
                    />
                  </div>
                </label>

                {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}
                {successMessage ? <p className="form-message success">{successMessage}</p> : null}
                {resetLink ? (
                  <div className="assist-result">
                    <p>Liên kết đặt lại mật khẩu đã được backend trả về.</p>
                    <a href={resetLink}>Mở trang đặt lại mật khẩu</a>
                  </div>
                ) : null}

                <button type="submit" className="recovery-submit" disabled={!formState.login.trim() || isSubmitting}>
                  <span>{isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu khôi phục'}</span>
                  <span aria-hidden="true">➜</span>
                </button>
              </form>

              <div className="recovery-links">
                <Link to="/login">← Quay lại đăng nhập</Link>
                <span>----</span>
                <Link to="/register">Tạo tài khoản mới</Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
