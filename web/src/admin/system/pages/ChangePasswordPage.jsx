import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogOut,
  MonitorCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PasswordPolicyChecklist } from '../../../Auth/components/PasswordPolicyChecklist';
import { getDefaultRouteForAuth } from '../../../lib/authSession';
import { usePasswordPolicyValidation } from '../../../lib/passwordPolicy';
import { readStoredAuth, writeStoredAuth } from '../../../lib/storage';
import { changeMyPassword, getMySessions, logoutAllMyDevices } from '../systemApi';
import { formatRelativeTime, getBrowserLabel, getDeviceLabel } from '../systemUi';

function getStrengthLabel(score) {
  if (score <= 1) return 'Rất yếu';
  if (score <= 2) return 'Yếu';
  if (score <= 4) return 'Khá';
  return 'Mạnh';
}

function getStrengthTone(score) {
  if (score <= 2) return 'danger';
  if (score <= 4) return 'warning';
  return 'success';
}

function buildPasswordChecks(password, identity) {
  const identifiers = [identity.username, identity.email, identity.phone].filter(Boolean).map((item) => String(item).toLowerCase());
  const lowerPassword = String(password || '').toLowerCase();
  return [
    { label: 'Ít nhất 10 ký tự', ok: password.length >= 10 },
    { label: 'Có chữ thường', ok: /[a-z]/.test(password) },
    { label: 'Có chữ hoa', ok: /[A-Z]/.test(password) },
    { label: 'Có số', ok: /\d/.test(password) },
    { label: 'Có ký tự đặc biệt', ok: /[^A-Za-z0-9]/.test(password) },
    { label: 'Không chứa email / tên đăng nhập / SĐT', ok: !identifiers.some((item) => item && lowerPassword.includes(item.split('@')[0])) },
  ];
}

function normalizeSessions(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.sessions)) return data.sessions;
  return [];
}

export function ChangePasswordPage({ standalone = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = readStoredAuth();
  const actorType = auth?.actorType || 'staff';
  const identity = auth?.user || {};
  const isForcedFlow = standalone || new URLSearchParams(location.search).has('reason') || Boolean(auth?.user?.must_change_password);
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState({ current_password: false, new_password: false, confirm_password: false });

  const passwordPolicyValidation = usePasswordPolicyValidation({
    actorType,
    password: form.new_password,
    username: identity.username,
    email: identity.email,
    phone: identity.phone,
    clientApp: 'staff-portal',
    enabled: Boolean(form.new_password),
  });

  async function loadSessions() {
    const sessionsData = await getMySessions();
    setSessions(normalizeSessions(sessionsData));
  }

  useEffect(() => {
    loadSessions().catch(() => setSessions([]));
  }, []);

  const checks = useMemo(() => buildPasswordChecks(form.new_password, identity), [form.new_password, identity.email, identity.phone, identity.username]);
  const strength = checks.filter((item) => item.ok).length;
  const strengthPercent = Math.max(8, Math.round((strength / checks.length) * 100));
  const activeSessions = useMemo(() => sessions.filter((item) => item.is_active !== false && !item.revoked_at), [sessions]);
  const canSubmit = form.current_password && form.new_password && form.confirm_password && form.new_password === form.confirm_password && strength >= 4;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.current_password) return setError('Vui lòng nhập mật khẩu hiện tại.');
    if (!form.new_password) return setError('Vui lòng nhập mật khẩu mới.');
    if (!form.confirm_password) return setError('Vui lòng nhập lại mật khẩu mới.');
    if (form.new_password !== form.confirm_password) return setError('Xác nhận mật khẩu mới không khớp.');

    const validationResult = await passwordPolicyValidation.validateNow();
    if (!validationResult.valid) {
      setError(validationResult.messages[0] || 'Mật khẩu chưa đáp ứng chính sách bảo mật.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await changeMyPassword({ current_password: form.current_password, new_password: form.new_password });
      const nextAuth = auth
        ? {
            ...auth,
            mustChangePasswordReason: null,
            user: auth.user ? { ...auth.user, must_change_password: false } : auth.user,
          }
        : null;
      if (nextAuth) writeStoredAuth(nextAuth);
      setSuccess('Đổi mật khẩu thành công. Hệ thống đã ghi nhận audit và làm mới trạng thái phiên.');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
      await loadSessions().catch(() => {});
      if (isForcedFlow && nextAuth) navigate(getDefaultRouteForAuth(nextAuth), { replace: true });
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
      setSuccess('Đã gửi yêu cầu đăng xuất tất cả thiết bị khác.');
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  function renderPasswordField(name, label, placeholder) {
    return (
      <label className="account-security-field">
        <span>{label}</span>
        <div className="account-security-input">
          <input
            type={showPassword[name] ? 'text' : 'password'}
            value={form[name]}
            placeholder={placeholder}
            autoComplete={name === 'current_password' ? 'current-password' : 'new-password'}
            onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
            onBlur={name === 'new_password' ? () => passwordPolicyValidation.validateNow().catch(() => {}) : undefined}
          />
          <button type="button" onClick={() => setShowPassword((current) => ({ ...current, [name]: !current[name] }))}>
            {showPassword[name] ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>
    );
  }

  return (
    <section className="role-page system-admin-page account-security-page">
      <section className="account-security-hero">
        <div className="account-security-hero__icon"><KeyRound size={28} /></div>
        <div>
          <p className="admin-page-header__eyebrow">Admin / Bảo mật tài khoản / Đổi mật khẩu</p>
          <h1>{isForcedFlow ? 'Đổi mật khẩu để tiếp tục' : 'Đổi mật khẩu'}</h1>
          <p>Thay mật khẩu bằng luồng xác thực an toàn, kiểm tra policy thật từ backend và ghi nhận audit cho tài khoản quản trị.</p>
        </div>
        <div className="account-security-hero__status">
          <span><ShieldCheck size={16} /> Policy backend</span>
          <strong>{passwordPolicyValidation.status === 'valid' ? 'Đạt' : 'Đang kiểm tra'}</strong>
        </div>
      </section>

      <section className="account-security-grid">
        <form className="admin-panel account-security-card account-security-form" onSubmit={handleSubmit}>
          <div className="account-security-card__head">
            <div>
              <small>Credential rotation</small>
              <h2>Cập nhật mật khẩu</h2>
              <p>Xác thực mật khẩu hiện tại trước khi ghi mật khẩu mới.</p>
            </div>
            <span className="account-security-card__mark"><LockKeyhole size={22} /></span>
          </div>

          <div className="account-security-form__body">
            {renderPasswordField('current_password', 'Mật khẩu hiện tại', 'Nhập mật khẩu hiện tại')}
            {renderPasswordField('new_password', 'Mật khẩu mới', 'Nhập mật khẩu mới')}

            <div className={`account-security-strength account-security-strength--${getStrengthTone(strength)}`}>
              <div>
                <span>Độ mạnh mật khẩu</span>
                <strong>{getStrengthLabel(strength)}</strong>
              </div>
              <div className="account-security-strength__track"><span style={{ width: `${strengthPercent}%` }} /></div>
              <small>Khuyến nghị: tối thiểu 12 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.</small>
            </div>

            <div className="account-security-checks">
              {checks.map((item) => (
                <span key={item.label} className={item.ok ? 'is-ok' : ''}>
                  {item.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  {item.label}
                </span>
              ))}
            </div>

            <PasswordPolicyChecklist actorType={actorType} password={form.new_password} identifiers={[identity.username, identity.email, identity.phone]} />

            {passwordPolicyValidation.isChecking ? <p className="form-message">Đang kiểm tra chính sách mật khẩu với backend...</p> : null}
            {!passwordPolicyValidation.isChecking && passwordPolicyValidation.status === 'valid' && form.new_password ? <p className="form-message success">Mật khẩu đáp ứng chính sách backend.</p> : null}
            {!passwordPolicyValidation.isChecking && ['invalid', 'rate-limited', 'error'].includes(passwordPolicyValidation.status) ? <p className="form-message error">{passwordPolicyValidation.messages[0]}</p> : null}

            {renderPasswordField('confirm_password', 'Xác nhận mật khẩu mới', 'Nhập lại mật khẩu mới')}

            <div className="account-security-actions">
              <button type="submit" className="staff-button staff-button--primary" disabled={submitting || passwordPolicyValidation.isChecking || !canSubmit}>
                {submitting ? <RefreshCw size={17} className="spin" /> : <ShieldCheck size={17} />}
                {submitting ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
              </button>
              <Link to={isForcedFlow ? '/home' : '/admin/profile'} className="staff-button staff-button--ghost">Hủy</Link>
            </div>

            {error ? <p className="form-message error">{error}</p> : null}
            {success ? <p className="form-message success">{success}</p> : null}
          </div>
        </form>

        <aside className="account-security-side">
          <article className="admin-panel account-security-card">
            <div className="account-security-card__head">
              <div><small>Security tips</small><h2>Mẹo bảo mật</h2></div>
              <span className="account-security-card__mark"><Sparkles size={22} /></span>
            </div>
            <div className="account-security-tips">
              <div><strong>Ký tự phức tạp</strong><p>Không dùng mật khẩu đã từng dùng ở hệ thống khác hoặc có thông tin cá nhân.</p></div>
              <div><strong>Audit rõ ràng</strong><p>Mỗi lần đổi mật khẩu được ghi nhận vào nhật ký bảo mật.</p></div>
              <div><strong>Phiên đăng nhập</strong><p>Sau khi đổi mật khẩu, hãy kiểm tra và thu hồi các thiết bị lạ.</p></div>
            </div>
          </article>

          <article className="admin-panel account-security-card">
            <div className="account-security-card__head">
              <div><small>Active sessions</small><h2>Tóm tắt phiên</h2></div>
              <span className="account-security-card__mark"><MonitorCheck size={22} /></span>
            </div>
            <div className="account-security-session-list">
              {activeSessions.slice(0, 3).map((session, index) => (
                <div key={session.session_id || session._id || index}>
                  <span>{getDeviceLabel(session.user_agent)}</span>
                  <strong>{getBrowserLabel(session.user_agent)} · {session.ip_address || 'Chưa có IP'}</strong>
                  <small>{formatRelativeTime(session.last_seen_at || session.login_at || session.created_at)}</small>
                </div>
              ))}
              {!activeSessions.length ? <p className="muted-copy">Chưa có phiên hoạt động từ backend.</p> : null}
            </div>
            <button type="button" className="account-security-logout-all" onClick={handleLogoutAll}>
              <LogOut size={17} /> Đăng xuất thiết bị khác
            </button>
          </article>
        </aside>
      </section>
    </section>
  );
}
