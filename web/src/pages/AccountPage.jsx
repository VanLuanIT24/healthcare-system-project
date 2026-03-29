import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { useAuth } from '../context/AuthContext';

export function AccountPage() {
  const auth = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '' });
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  async function handleChangePassword(event) {
    event.preventDefault();
    setFeedback({ error: '', success: '' });
    try {
      const response = await auth.changePassword(form);
      setFeedback({ error: '', success: response.message });
      setForm({ current_password: '', new_password: '' });
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  }

  return (
    <div>
      <PageHero
        eyebrow="Tài khoản"
        title={auth.authState.profile?.full_name || 'Khu vực tài khoản'}
        description="Trang riêng để xem hồ sơ đăng nhập hiện tại, làm mới phiên và đổi mật khẩu."
        secondaryLabel="Đăng xuất"
        secondaryTo="/dang-xuat"
      />
      <section className="section">
        <div className="auth-grid">
          <section className="auth-panel">
            <div className="auth-panel__head">
              <h3>Thông tin hồ sơ</h3>
              <p>Dữ liệu lấy trực tiếp từ endpoint `/auth/me`.</p>
            </div>
            <div className="auth-state">
              <pre>{JSON.stringify(auth.authState.profile, null, 2)}</pre>
            </div>
            <div className="auth-form">
              <button className="ghost-button" type="button" onClick={() => auth.loadProfile()}>
                Tải lại hồ sơ
              </button>
              <button className="ghost-button" type="button" onClick={() => auth.refreshToken()}>
                Làm mới phiên
              </button>
              {auth.hasAnyRole(['super_admin', 'admin']) ? (
                <Link className="cta-button" to="/quan-tri/tai-khoan-nhan-su">
                  Vào quản trị tài khoản nhân sự
                </Link>
              ) : null}
            </div>
          </section>

          <section className="auth-panel">
            <div className="auth-panel__head">
              <h3>Đổi mật khẩu</h3>
              <p>Đổi mật khẩu sẽ thu hồi các phiên cũ theo logic backend hiện tại.</p>
            </div>
            <form className="auth-form" onSubmit={handleChangePassword}>
              <label className="form-field">
                <span>Mật khẩu hiện tại</span>
                <input type="password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
              </label>
              <label className="form-field">
                <span>Mật khẩu mới</span>
                <input type="password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
              </label>
              <button className="cta-button" type="submit">Đổi mật khẩu</button>
              {feedback.success ? <div className="feedback feedback--success">{feedback.success}</div> : null}
              {feedback.error ? <div className="feedback feedback--error">{feedback.error}</div> : null}
            </form>
          </section>
        </div>
      </section>
    </div>
  );
}
