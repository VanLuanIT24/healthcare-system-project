import { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '../systemUi';

const STORAGE_KEY = 'healthcare.admin.systemSettings';

const DEFAULT_SETTINGS = {
  hospital_name: 'Aura Lumina Medical Center',
  hotline: '1900 6868',
  email: 'contact@auralumina.vn',
  tax_code: '0312456789',
  address: 'Số 123 Đường Sáng Tạo, Khu Công Nghệ Cao, Quận 9, TP. Hồ Chí Minh',
  timezone: 'Asia/Ho_Chi_Minh',
  date_format: 'DD/MM/YYYY',
  language: 'vi',
  min_password_length: 8,
  password_rotation_days: 90,
  require_special: true,
  require_uppercase: true,
  require_lowercase: true,
  require_number: true,
  session_timeout_minutes: 30,
  max_sessions: 3,
  revoke_on_password_change: true,
  auto_logout_idle: true,
  default_staff_status: 'active',
  force_password_change_first_login: true,
  default_role: 'staff',
};

function hydrateSettings(rawValue) {
  if (!rawValue) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(rawValue);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function SettingToggle({ icon, label, description, checked, name, onChange }) {
  return (
    <label className="system-config-toggle">
      <div className="system-config-toggle__copy">
        <span className="system-config-toggle__icon">{icon}</span>
        <div>
          <strong>{label}</strong>
          {description ? <small>{description}</small> : null}
        </div>
      </div>
      <span className={`system-config-switch ${checked ? 'is-on' : ''}`}>
        <input name={name} type="checkbox" checked={checked} onChange={onChange} />
        <span />
      </span>
    </label>
  );
}

export function SystemSettingsPage() {
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState('');

  useEffect(() => {
    const hydrated = hydrateSettings(localStorage.getItem(STORAGE_KEY));
    setForm(hydrated);
    setLastSavedAt(localStorage.getItem(`${STORAGE_KEY}.updatedAt`) || '');
  }, []);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setSaved(false);
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function saveSettings() {
    const updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    localStorage.setItem(`${STORAGE_KEY}.updatedAt`, updatedAt);
    setLastSavedAt(updatedAt);
    setSaved(true);
  }

  function resetDefaults() {
    setForm(DEFAULT_SETTINGS);
    setSaved(false);
  }

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (Number(form.min_password_length) >= 8) score += 1;
    if (form.require_special) score += 1;
    if (form.require_uppercase && form.require_lowercase) score += 1;
    if (form.require_number) score += 1;
    return Math.min(score, 4);
  }, [form.min_password_length, form.require_special, form.require_uppercase, form.require_lowercase, form.require_number]);

  const strengthLabel = ['Yếu', 'Cơ bản', 'Khá', 'Mạnh'][Math.max(passwordStrength - 1, 0)];

  return (
    <section className="role-page system-admin-page system-config-page">
      <section className="role-hero system-config-hero">
        <div className="role-hero__copy">
          <p className="admin-page-header__eyebrow">Admin / Cấu hình hệ thống</p>
          <h1>Cấu hình hệ thống</h1>
          <p>Thiết lập các thông số nền tảng, bảo mật và mặc định vận hành cho toàn bộ trung tâm Aura Lumina.</p>
        </div>
        <div className="role-hero__actions system-config-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={resetDefaults}>
            ↻ Khôi phục mặc định
          </button>
          <button type="button" className="staff-button staff-button--primary" onClick={saveSettings}>
            ▣ Lưu thay đổi
          </button>
        </div>
      </section>

      <section className="system-config-layout">
        <article className="admin-panel system-config-card system-config-card--wide">
          <div className="system-config-card__heading">
            <span className="system-config-card__icon system-config-card__icon--indigo">✚</span>
            <div>
              <h2>Thông tin bệnh viện</h2>
            </div>
          </div>

          <div className="system-config-form-grid">
            <label className="system-config-field">
              <span>Tên đơn vị</span>
              <input name="hospital_name" value={form.hospital_name} onChange={handleChange} />
            </label>
            <label className="system-config-field">
              <span>Hotline chăm sóc</span>
              <input name="hotline" value={form.hotline} onChange={handleChange} />
            </label>
            <label className="system-config-field">
              <span>Email hệ thống</span>
              <input name="email" type="email" value={form.email} onChange={handleChange} />
            </label>
            <label className="system-config-field">
              <span>Mã số thuế</span>
              <input name="tax_code" value={form.tax_code} onChange={handleChange} />
            </label>
            <label className="system-config-field system-config-field--full">
              <span>Địa chỉ trụ sở</span>
              <textarea name="address" rows="2" value={form.address} onChange={handleChange} />
            </label>
          </div>
        </article>

        <article className="admin-panel system-config-card">
          <div className="system-config-card__heading">
            <span className="system-config-card__icon system-config-card__icon--mint">◎</span>
            <div>
              <h2>Ngôn ngữ & Thời gian</h2>
            </div>
          </div>

          <div className="system-config-stack">
            <label className="system-config-field">
              <span>Múi giờ hệ thống</span>
              <select name="timezone" value={form.timezone} onChange={handleChange}>
                <option value="Asia/Ho_Chi_Minh">(GMT+07:00) Asia/Ho_Chi_Minh</option>
                <option value="Asia/Bangkok">(GMT+07:00) Asia/Bangkok</option>
                <option value="UTC">(GMT+00:00) UTC</option>
              </select>
            </label>

            <label className="system-config-field">
              <span>Định dạng ngày</span>
              <select name="date_format" value={form.date_format} onChange={handleChange}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="DD/MM/YYYY HH:mm">DD/MM/YYYY HH:mm</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </label>

            <div className="system-config-field">
              <span>Ngôn ngữ mặc định</span>
              <div className="system-config-segmented">
                <button
                  type="button"
                  className={form.language === 'vi' ? 'is-active' : ''}
                  onClick={() => {
                    setSaved(false);
                    setForm((current) => ({ ...current, language: 'vi' }));
                  }}
                >
                  Tiếng Việt
                </button>
                <button
                  type="button"
                  className={form.language === 'en' ? 'is-active' : ''}
                  onClick={() => {
                    setSaved(false);
                    setForm((current) => ({ ...current, language: 'en' }));
                  }}
                >
                  Tiếng Anh
                </button>
              </div>
            </div>
          </div>
        </article>

        <article className="admin-panel system-config-card">
          <div className="system-config-card__heading">
            <span className="system-config-card__icon system-config-card__icon--rose">***</span>
            <div>
              <h2>Chính sách mật khẩu</h2>
            </div>
          </div>

          <div className="system-config-kpi-row">
            <label className="system-config-mini-field">
              <span>Độ dài tối thiểu</span>
              <div>
                <input name="min_password_length" type="number" min="6" max="32" value={form.min_password_length} onChange={handleChange} />
                <small>ký tự</small>
              </div>
            </label>
            <label className="system-config-mini-field">
              <span>Chu kỳ thay đổi</span>
              <div>
                <input name="password_rotation_days" type="number" min="0" max="365" value={form.password_rotation_days} onChange={handleChange} />
                <small>ngày</small>
              </div>
            </label>
          </div>

          <div className="system-config-password-meter">
            <div className="system-config-password-meter__label">
              <span>Độ mạnh chính sách</span>
              <strong>{strengthLabel}</strong>
            </div>
            <div className="system-config-password-meter__bars">
              {[0, 1, 2, 3].map((item) => (
                <span key={item} className={item < passwordStrength ? 'is-active' : ''} />
              ))}
            </div>
          </div>

          <div className="system-config-toggle-list">
            <SettingToggle icon="@" label="Yêu cầu ký tự đặc biệt" checked={form.require_special} name="require_special" onChange={handleChange} />
            <SettingToggle icon="Aa" label="Yêu cầu chữ hoa & chữ thường" checked={form.require_uppercase && form.require_lowercase} name="require_uppercase" onChange={(event) => {
              const checked = event.target.checked;
              setSaved(false);
              setForm((current) => ({ ...current, require_uppercase: checked, require_lowercase: checked }));
            }} />
            <SettingToggle icon="123" label="Yêu cầu ít nhất 1 chữ số" checked={form.require_number} name="require_number" onChange={handleChange} />
          </div>
        </article>

        <article className="admin-panel system-config-card">
          <div className="system-config-card__heading">
            <span className="system-config-card__icon system-config-card__icon--amber">◈</span>
            <div>
              <h2>Bảo mật phiên làm việc</h2>
            </div>
          </div>

          <div className="system-config-kpi-row">
            <label className="system-config-mini-field">
              <span>Thời gian chờ (timeout)</span>
              <div>
                <input name="session_timeout_minutes" type="number" min="5" max="240" value={form.session_timeout_minutes} onChange={handleChange} />
                <small>phút</small>
              </div>
            </label>
            <label className="system-config-mini-field">
              <span>Số phiên tối đa</span>
              <div>
                <input name="max_sessions" type="number" min="1" max="10" value={form.max_sessions} onChange={handleChange} />
                <small>phiên</small>
              </div>
            </label>
          </div>

          <div className="system-config-session-box">
            <div>
              <strong>Tự động đăng xuất khi treo máy</strong>
              <small>Ngắt kết nối sau khi hết thời gian chờ</small>
            </div>
            <span className={`system-config-switch ${form.auto_logout_idle ? 'is-on' : ''}`}>
              <input name="auto_logout_idle" type="checkbox" checked={form.auto_logout_idle} onChange={handleChange} />
              <span />
            </span>
          </div>
        </article>

        <article className="admin-panel system-config-card">
          <div className="system-config-card__heading">
            <span className="system-config-card__icon system-config-card__icon--violet">⚙</span>
            <div>
              <h2>Hành vi tài khoản mặc định</h2>
            </div>
          </div>

          <div className="system-config-stack">
            <div className="system-config-field">
              <span>Trạng thái khi tạo mới</span>
              <div className="system-config-segmented">
                <button
                  type="button"
                  className={form.default_staff_status === 'active' ? 'is-active' : ''}
                  onClick={() => {
                    setSaved(false);
                    setForm((current) => ({ ...current, default_staff_status: 'active' }));
                  }}
                >
                  Kích hoạt
                </button>
                <button
                  type="button"
                  className={form.default_staff_status === 'inactive' ? 'is-active' : ''}
                  onClick={() => {
                    setSaved(false);
                    setForm((current) => ({ ...current, default_staff_status: 'inactive' }));
                  }}
                >
                  Tạm khóa
                </button>
              </div>
            </div>

            <label className="system-config-field">
            <span>Vai trò mặc định</span>
              <select name="default_role" value={form.default_role} onChange={handleChange}>
              <option value="staff">Nhân viên tổng hợp</option>
              <option value="doctor">Bác sĩ</option>
                <option value="nurse">Điều dưỡng (Nurse)</option>
                <option value="receptionist">Lễ tân (Receptionist)</option>
              </select>
            </label>

            <SettingToggle
              icon="!"
              label="Buộc đổi mật khẩu ở lần đăng nhập đầu"
              description="Áp dụng cho các tài khoản được tạo mới trong hệ thống."
              checked={form.force_password_change_first_login}
              name="force_password_change_first_login"
              onChange={handleChange}
            />

            <SettingToggle
              icon="↺"
              label="Thu hồi phiên cũ khi đổi mật khẩu"
              description="Giảm nguy cơ chiếm quyền nếu thiết bị cũ còn đăng nhập."
              checked={form.revoke_on_password_change}
              name="revoke_on_password_change"
              onChange={handleChange}
            />
          </div>
        </article>
      </section>

      <section className="system-config-activity">
        <div className="system-config-activity__copy">
          <span className="system-config-activity__icon">⎘</span>
          <div>
            <strong>Lịch sử thay đổi hệ thống</strong>
            <p>
              {lastSavedAt
                ? `Lần cập nhật cuối cùng vào ${formatDateTime(lastSavedAt)}`
                : 'Chưa có bản ghi cập nhật nào trong trình duyệt hiện tại'}
              {saved ? ' bởi Admin Aura.' : '.'}
            </p>
          </div>
        </div>
        <button type="button" className="system-config-activity__action">
          Xem chi tiết nhật ký
        </button>
      </section>

      {saved ? <p className="form-message success">Đã lưu cấu hình hệ thống trên trình duyệt hiện tại.</p> : null}
    </section>
  );
}
