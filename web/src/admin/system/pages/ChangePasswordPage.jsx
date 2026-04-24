import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { changeMyPassword, getMySessions, logoutAllMyDevices } from '../systemApi';
import { formatRelativeTime } from '../systemUi';

function getStrengthLabel(score) {
  if (score <= 2) return 'Yếu';
  if (score <= 4) return 'Trung bình';
  return 'Mạnh';
}

function getStrengthPercent(score) {
  return `${Math.max((score / 5) * 100, 6)}%`;
}

export function ChangePasswordPage() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current_password: false,
    new_password: false,
    confirm_password: false,
  });

  async function loadSessions() {
    const sessionsData = await getMySessions();
    setSessions(sessionsData?.items || []);
  }

  useEffect(() => {
    loadSessions().catch(() => setSessions([]));
  }, []);

  const checks = {
    minLength: form.new_password.length >= 8,
    upper: /[A-Z]/.test(form.new_password),
    lower: /[a-z]/.test(form.new_password),
    number: /\d/.test(form.new_password),
    special: /[^A-Za-z0-9]/.test(form.new_password),
  };

  const strength = Object.values(checks).filter(Boolean).length;
  const activeSessions = useMemo(() => sessions.filter((item) => item.is_active), [sessions]);

  async function handleSubmit() {
    if (form.new_password !== form.confirm_password) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await changeMyPassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setSuccess('Đổi mật khẩu thành công. Các phiên đăng nhập cũ đã bị thu hồi.');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
      await loadSessions().catch(() => {});
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogoutAll() {
    try {
      await logoutAllMyDevices();
      await loadSessions();
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  function renderPasswordField(name, label, placeholder) {
    return (
      <label className="security-password-field">
        <span>{label}</span>
        <div className="security-password-input">
          <input
            type={showPassword[name] ? 'text' : 'password'}
            value={form[name]}
            placeholder={placeholder}
            onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => ({ ...current, [name]: !current[name] }))}
            aria-label={showPassword[name] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword[name] ? '🙈' : '👁'}
          </button>
        </div>
      </label>
    );
  }

  return (
    <section className="role-page system-admin-page security-upgrade-page">
      <section className="role-hero security-upgrade-hero">
        <div className="role-hero__copy">
          <p className="admin-page-header__eyebrow">Admin / Bảo mật / Thiết lập bảo mật</p>
          <h1>Đổi mật khẩu</h1>
          <p>Bảo vệ tài khoản của bạn bằng cách sử dụng mật khẩu mạnh và thay đổi định kỳ để ngăn chặn các truy cập trái phép.</p>
        </div>
      </section>

      <section className="security-upgrade-layout">
        <article className="admin-panel security-upgrade-form">
          <div className="security-upgrade-form__header">
            <div>
              <h2>Cập nhật mật khẩu</h2>
              <p>Vui lòng nhập mật khẩu hiện tại để xác thực</p>
            </div>
            <span className="security-upgrade-form__icon">↻</span>
          </div>

          <div className="security-upgrade-form__body">
            {renderPasswordField('current_password', 'Mật khẩu hiện tại', 'Nhập mật khẩu hiện tại')}
            {renderPasswordField('new_password', 'Mật khẩu mới', 'Nhập mật khẩu mới')}

            <div className="security-strength-card">
              <div className="security-strength-card__meta">
                <span>Độ mạnh mật khẩu</span>
                <strong>{getStrengthLabel(strength)}</strong>
              </div>
              <div className="security-strength-card__track">
                {[0, 1, 2].map((item) => (
                  <span key={item} style={{ width: item === 0 ? getStrengthPercent(Math.min(strength, 2)) : item === 1 ? getStrengthPercent(Math.max(Math.min(strength - 2, 2), 0)) : getStrengthPercent(Math.max(strength - 4, 0)) }} />
                ))}
              </div>
              <small>Gợi ý: Thêm ít nhất một ký tự đặc biệt (!@#$).</small>
            </div>

            {renderPasswordField('confirm_password', 'Xác nhận mật khẩu mới', 'Nhập lại mật khẩu mới')}

            <div className="security-upgrade-form__actions">
              <button type="button" className="staff-button staff-button--primary security-save-button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Đang cập nhật...' : '🔒 Lưu thay đổi'}
              </button>
              <Link to="/admin/profile" className="staff-button staff-button--ghost security-cancel-button">Hủy</Link>
            </div>

            {error ? <p className="form-message error">{error}</p> : null}
            {success ? <p className="form-message success">{success}</p> : null}
          </div>
        </article>

        <aside className="security-upgrade-side">
          <article className="admin-panel security-tip-card">
            <div className="admin-panel__heading"><h2>Mẹo bảo mật</h2></div>
            <div className="security-tip-list">
              <div>
                <strong>Ký tự phức tạp</strong>
                <p>Sử dụng ít nhất 12 ký tự bao gồm chữ hoa, chữ thường, số và biểu tượng.</p>
              </div>
              <div>
                <strong>Tránh thông tin cá nhân</strong>
                <p>Không sử dụng ngày sinh, tên thú cưng hoặc số điện thoại trong mật khẩu.</p>
              </div>
              <div>
                <strong>Tính duy nhất</strong>
                <p>Đảm bảo mật khẩu này không được sử dụng cho bất kỳ tài khoản nào khác.</p>
              </div>
            </div>
          </article>

          <article className="admin-panel security-session-card">
            <div className="security-session-card__header">
              <h2>Tóm tắt an ninh</h2>
              <span className="role-chip role-chip--teal">Đang hoạt động</span>
            </div>
            <div className="security-session-list">
              {activeSessions.slice(0, 2).map((session, index) => (
                <div key={session.session_id} className="security-session-item">
                  <div>
                    <strong>{index === 0 ? 'MacBook Pro 16"' : 'iPhone 15 Pro Max'}</strong>
                    <small>{session.ip_address || 'N/A'} • {formatRelativeTime(session.last_seen_at)}</small>
                  </div>
                  <span className="security-session-item__dot" />
                </div>
              ))}
            </div>
            <button type="button" className="security-logout-button" onClick={handleLogoutAll}>↪ Đăng xuất tất cả thiết bị khác</button>
          </article>

          <article className="admin-panel security-ai-card">
            <small>Aura Lumina Protection</small>
            <strong>Dữ liệu của bạn được bảo mật bởi AI 24/7</strong>
          </article>
        </aside>
      </section>
    </section>
  );
}
