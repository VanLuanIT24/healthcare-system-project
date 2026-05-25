import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CreditCard,
  Database,
  Globe2,
  KeyRound,
  Laptop,
  LayoutPanelTop,
  Link2,
  Lock,
  Mail,
  MapPin,
  Monitor,
  Palette,
  Phone,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Upload,
  User,
} from 'lucide-react';
import { receptionDataApi } from '../api/receptionDataApi';

const SETTINGS_CONFIG = {
  'settings-account': {
    title: 'Tài khoản',
    subtitle: 'Quản lý thông tin tài khoản và bảo mật',
  },
  'settings-ui': {
    title: 'Giao diện',
    subtitle: 'Tùy chỉnh hiển thị, ngôn ngữ và trải nghiệm sử dụng',
  },
  'settings-system': {
    title: 'Tùy chọn hệ thống',
    subtitle: 'Cấu hình thông tin phòng khám, quy trình và tích hợp',
  },
};

const THEME_COLORS = [
  '#1e79ff',
  '#10b4cf',
  '#21b85f',
  '#6d45e8',
  '#f97316',
  '#ef4444',
  '#ec407a',
  '#475569',
];

const DEFAULT_ACCOUNT_SETTINGS = {
  profile: {
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    avatar: '',
  },
  security: {
    twoFactor: false,
    loginNotice: false,
    sessionLimit: '',
  },
  sessions: [],
};

const DEFAULT_UI_SETTINGS = {
  theme: 'light',
  color: '#1e79ff',
  density: 'comfortable',
  fontSize: 50,
  language: 'Tiếng Việt',
  region: 'Việt Nam (GMT+7)',
  dateFormat: 'dd/mm/yyyy',
  timeFormat: '24 giờ',
  collapseSidebar: false,
  keepMenuOpen: true,
  sidebarPosition: 'Trái',
  contentWidth: 'Rộng',
  cardRadius: '8px',
  stickyHeader: true,
  stripedRows: true,
  pageSize: '20 dòng',
  showTopSearch: true,
  showQuickDate: true,
  notificationDesktop: true,
  notificationSound: false,
  notificationBadge: true,
  notificationPreview: true,
  appointmentAlerts: true,
  paymentAlerts: true,
  systemAlerts: true,
};

const DEFAULT_SYSTEM_SETTINGS = {
  clinicName: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  open: '',
  close: '',
  timezone: '',
  logo: '',
  onlineBooking: false,
  smsReminder: false,
  emailReminder: false,
  preCheckin: false,
  preCheckinMinutes: 0,
  queueScreen: false,
  integrations: {},
  backupLog: [],
};

function readFileAsDataUrl(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result || ''));
  reader.readAsDataURL(file);
}

const UI_SETTING_KEYS = ['reception.ui', 'reception.ui_settings', 'dashboard.reception_ui', 'settings.ui'];
const SYSTEM_SETTING_KEYS = ['reception.system', 'reception.system_settings', 'dashboard.reception_system', 'settings.system'];

function flattenGroupedSettings(payload = {}) {
  const grouped = payload.grouped || payload || {};
  return Object.values(grouped).reduce((acc, group) => {
    if (group && typeof group === 'object') {
      Object.entries(group).forEach(([key, value]) => {
        acc[key] = value;
      });
    }
    return acc;
  }, {});
}

function readSettingValue(setting) {
  if (!setting || typeof setting !== 'object') return setting;
  return setting.setting_value ?? setting.default_value;
}

function findSettingRecord(settingMap, keys) {
  const key = keys.find((candidate) => settingMap[candidate]);
  if (!key) return { key: '', value: null };
  return { key, value: readSettingValue(settingMap[key]) };
}

function formatSessionDetail(session = {}) {
  const browser = session.browser || 'Browser';
  const os = session.os || session.device_name || 'Device';
  const lastUsed = session.last_used_at || session.created_at || '';
  const time = lastUsed ? new Date(lastUsed).toLocaleString('vi-VN') : '';
  return [browser, os, time].filter(Boolean).join(' - ');
}

function normalizeCurrentProfile(payload = {}) {
  const profile = payload.profile || payload;
  const user = profile.user || {};
  const department = profile.department || {};
  return {
    name: user.full_name || user.username || DEFAULT_ACCOUNT_SETTINGS.profile.name,
    email: user.email || '',
    phone: user.phone || '',
    role: (profile.roles || user.roles || [])[0] || DEFAULT_ACCOUNT_SETTINGS.profile.role,
    department: department.department_name || department.name || DEFAULT_ACCOUNT_SETTINGS.profile.department,
    avatar: DEFAULT_ACCOUNT_SETTINGS.profile.avatar,
    username: user.username || '',
    status: user.status || 'active',
    lastLogin: user.last_login_at || '',
  };
}

function normalizeSessions(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return [];
  return items.map((session) => ({
    id: session.session_id,
    device: session.device_name || session.os || session.browser || 'Thiáº¿t bá»‹',
    detail: formatSessionDetail(session),
    status: session.is_current ? 'Hiá»‡n táº¡i' : (session.is_active ? 'Äang hoáº¡t Ä‘á»™ng' : 'ÄÃ£ thu há»“i'),
    current: Boolean(session.is_current),
  }));
}

function Field({ label, children }) {
  return (
    <label className="reception-settings-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      className={`reception-settings-toggle ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span />
    </button>
  );
}

function SettingsHero({ mode, onSave, savedMessage }) {
  const config = SETTINGS_CONFIG[mode] || SETTINGS_CONFIG['settings-account'];
  return (
    <section className="reception-settings-hero">
      <div>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
      </div>
      <div>
        {savedMessage ? <span>{savedMessage}</span> : null}
        <button type="button" className="reception-btn reception-btn--primary" onClick={onSave}>
          <Save size={17} />
          Lưu thay đổi
        </button>
      </div>
    </section>
  );
}

function TabButton({ active, icon: Icon, label, onClick }) {
  return (
    <button type="button" className={active ? 'is-active' : ''} onClick={onClick}>
      <Icon size={18} />
      {label}
    </button>
  );
}

function AccountPage({ account, setAccount, onMessage, onChangePassword, onRevokeSession }) {
  const [tab, setTab] = useState('profile');
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const profile = account.profile;
  const security = account.security;

  function updateProfile(key, value) {
    setAccount((current) => ({
      ...current,
      profile: { ...current.profile, [key]: value },
    }));
  }

  function updateSecurity(key, value) {
    setAccount((current) => ({
      ...current,
      security: { ...current.security, [key]: value },
    }));
  }

  async function removeSession(id) {
    setAccount((current) => ({
      ...current,
      sessions: current.sessions.filter((session) => session.id !== id || session.current),
    }));
    try {
      await onRevokeSession(id);
    } catch (error) {
      onMessage(error.message || 'Khong the dang xuat phien da chon');
      return;
    }
    onMessage('Đã đăng xuất phiên đã chọn');
  }

  async function handlePasswordUpdate() {
    if (!password.current || !password.next || !password.confirm) {
      onMessage('Vui lòng nhập đầy đủ thông tin mật khẩu');
      return;
    }
    if (password.next.length < 8 || !/[A-Z]/.test(password.next) || !/\d/.test(password.next)) {
      onMessage('Mật khẩu mới cần tối thiểu 8 ký tự, có chữ hoa và số');
      return;
    }
    if (password.next !== password.confirm) {
      onMessage('Xác nhận mật khẩu chưa khớp');
      return;
    }
    try {
      await onChangePassword({
        current_password: password.current,
        new_password: password.next,
      });
    } catch (error) {
      onMessage(error.message || 'Khong the cap nhat mat khau');
      return;
    }
    setPassword({ current: '', next: '', confirm: '' });
    onMessage('Đã cập nhật mật khẩu');
  }

  return (
    <section className="reception-settings-layout">
      <div className="reception-panel reception-settings-main">
        <div className="reception-settings-tabs">
          <TabButton active={tab === 'profile'} icon={User} label="Thông tin cá nhân" onClick={() => setTab('profile')} />
          <TabButton active={tab === 'password'} icon={Lock} label="Đổi mật khẩu" onClick={() => setTab('password')} />
          <TabButton active={tab === '2fa'} icon={ShieldCheck} label="Bảo mật 2 lớp" onClick={() => setTab('2fa')} />
          <TabButton active={tab === 'sessions'} icon={Monitor} label="Phiên đăng nhập" onClick={() => setTab('sessions')} />
        </div>

        {tab === 'profile' ? (
          <div className="reception-settings-form">
            <Field label="Họ và tên"><input value={profile.name} onChange={(event) => updateProfile('name', event.target.value)} /></Field>
            <Field label="Email"><input value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} /></Field>
            <Field label="Số điện thoại"><input value={profile.phone} onChange={(event) => updateProfile('phone', event.target.value)} /></Field>
            <Field label="Chức vụ">
              <select value={profile.role} onChange={(event) => updateProfile('role', event.target.value)}>
                <option>Receptionist</option>
                <option>Trưởng lễ tân</option>
                <option>Điều phối viên</option>
              </select>
            </Field>
            <Field label="Phòng ban">
              <select value={profile.department} onChange={(event) => updateProfile('department', event.target.value)}>
                <option>Phòng khám Đa khoa Bộ Y tế</option>
                <option>Quầy tiếp nhận tầng 1</option>
                <option>Quầy dịch vụ khách hàng</option>
              </select>
            </Field>
            <div className="reception-settings-upload">
              {profile.avatar ? (
                <img src={profile.avatar} alt="Ảnh đại diện" />
              ) : (
                <div className="reception-avatar-badge">TM</div>
              )}
              <label className="reception-settings-upload-button">
                <Upload size={18} />
                Nhấp để tải ảnh lên
                <span>JPG, PNG tối đa 2MB</span>
                <input type="file" accept="image/png,image/jpeg" onChange={(event) => readFileAsDataUrl(event.target.files?.[0], (value) => updateProfile('avatar', value))} />
              </label>
            </div>
          </div>
        ) : null}

        {tab === 'password' ? (
          <div className="reception-settings-form">
            <Field label="Mật khẩu hiện tại"><input type="password" value={password.current} onChange={(event) => setPassword({ ...password, current: event.target.value })} placeholder="Nhập mật khẩu hiện tại" /></Field>
            <Field label="Mật khẩu mới"><input type="password" value={password.next} onChange={(event) => setPassword({ ...password, next: event.target.value })} placeholder="Tối thiểu 8 ký tự" /></Field>
            <Field label="Xác nhận mật khẩu mới"><input type="password" value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} placeholder="Nhập lại mật khẩu mới" /></Field>
            <div className="reception-settings-note">Mật khẩu mạnh nên có chữ hoa, chữ thường, số và ký tự đặc biệt.</div>
            <button type="button" className="reception-btn reception-btn--primary reception-settings-fit" onClick={handlePasswordUpdate}>
              <KeyRound size={17} />
              Cập nhật mật khẩu
            </button>
          </div>
        ) : null}

        {tab === '2fa' ? (
          <div className="reception-settings-list">
            <div><span><ShieldCheck size={18} />Xác thực 2 lớp</span><Toggle checked={security.twoFactor} onChange={(value) => updateSecurity('twoFactor', value)} /></div>
            <div><span><Mail size={18} />Thông báo đăng nhập qua email</span><Toggle checked={security.loginNotice} onChange={(value) => updateSecurity('loginNotice', value)} /></div>
            <Field label="Giới hạn thiết bị đăng nhập">
              <select value={security.sessionLimit} onChange={(event) => updateSecurity('sessionLimit', event.target.value)}>
                <option>2 thiết bị</option>
                <option>3 thiết bị</option>
                <option>5 thiết bị</option>
              </select>
            </Field>
          </div>
        ) : null}

        {tab === 'sessions' ? (
          <div className="reception-settings-session-list">
            {account.sessions.map((session) => (
              <div key={session.id}>
                <Laptop size={20} />
                <span><strong>{session.device}</strong><small>{session.detail}</small></span>
                <em>{session.status}</em>
                {!session.current ? <button type="button" onClick={() => removeSession(session.id)}>Đăng xuất</button> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <aside className="reception-settings-side">
        <section className="reception-panel">
          <h2>Thông tin tài khoản</h2>
          <dl>
            <div><dt>Tên đăng nhập</dt><dd>receptionist</dd></div>
            <div><dt>Ngày tạo tài khoản</dt><dd>15/02/2024 10:30</dd></div>
            <div><dt>Đăng nhập cuối</dt><dd>16/05/2025 08:45</dd></div>
            <div><dt>Trạng thái</dt><dd><span className="reception-status-pill is-success">Đang hoạt động</span></dd></div>
          </dl>
        </section>
        <section className="reception-panel reception-settings-quick">
          <h2>Bảo mật nhanh</h2>
          <button type="button" onClick={() => setTab('password')}><CheckCircle2 size={18} />Mật khẩu mạnh<ChevronRight size={16} /></button>
          <button type="button" onClick={() => setTab('2fa')}><CheckCircle2 size={18} />{security.twoFactor ? 'Xác thực 2 lớp đã bật' : 'Bật xác thực 2 lớp'}<ChevronRight size={16} /></button>
          <button type="button" onClick={() => setTab('sessions')}><Laptop size={18} />{account.sessions.length} thiết bị đăng nhập gần đây<ChevronRight size={16} /></button>
        </section>
        <section className="reception-panel reception-settings-advice">
          <h2>Gợi ý bảo mật</h2>
          <p>Cập nhật số điện thoại và email để khôi phục tài khoản dễ dàng.</p>
          <p>Bật xác thực 2 lớp để tăng cường bảo mật tài khoản.</p>
        </section>
      </aside>
    </section>
  );
}

function InterfacePreview({ settings }) {
  return (
    <div className={`reception-settings-preview is-${settings.density}`}>
      <header><span /> <i /> <strong>TM</strong></header>
      <div>
        <aside>{[1, 2, 3, 4, 5].map((item) => <span key={item} />)}</aside>
        <main>
          <section>
            <b>Bệnh nhân hôm nay</b>
            <strong>128</strong>
          </section>
          <section>
            <b>Lịch hẹn hôm nay</b>
            <strong>24</strong>
          </section>
          <section>
            <b>Doanh thu hôm nay</b>
            <strong>12.450.000đ</strong>
          </section>
          <article />
          <article />
        </main>
      </div>
    </div>
  );
}

function UiPage({ settings, setSettings, onMessage }) {
  const [uiTab, setUiTab] = useState('display');

  function update(next) {
    setSettings((current) => ({ ...current, ...next }));
  }

  return (
    <section className="reception-settings-layout">
      <div className="reception-panel reception-settings-main">
        <div className="reception-settings-tabs">
          <TabButton active={uiTab === 'display'} icon={Palette} label="Hiển thị" onClick={() => setUiTab('display')} />
          <TabButton active={uiTab === 'locale'} icon={Globe2} label="Ngôn ngữ & khu vực" onClick={() => setUiTab('locale')} />
          <TabButton active={uiTab === 'layout'} icon={LayoutPanelTop} label="Bố cục" onClick={() => setUiTab('layout')} />
          <TabButton active={uiTab === 'notifications'} icon={Bell} label="Thông báo hiển thị" onClick={() => setUiTab('notifications')} />
        </div>

        {uiTab === 'display' ? (
          <>
            <div className="reception-settings-section">
              <h2>1. Chế độ giao diện</h2>
              <div className="reception-settings-option-grid">
                {[
                  ['light', Sun, 'Sáng', 'Nền sáng, chữ tối'],
                  ['dark', Monitor, 'Tối', 'Nền tối, chữ sáng'],
                  ['system', Laptop, 'Theo hệ thống', 'Tự động theo thiết bị'],
                ].map(([value, Icon, title, desc]) => (
                  <button type="button" className={settings.theme === value ? 'is-active' : ''} key={value} onClick={() => update({ theme: value })}>
                    <Icon size={28} />
                    <span><strong>{title}</strong><small>{desc}</small></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="reception-settings-section">
              <h2>2. Màu chủ đạo</h2>
              <div className="reception-settings-swatches">
                {THEME_COLORS.map((color) => (
                  <button type="button" key={color} className={settings.color === color ? 'is-active' : ''} style={{ background: color }} onClick={() => update({ color })}>
                    {settings.color === color ? <CheckCircle2 size={16} /> : null}
                  </button>
                ))}
              </div>
            </div>
            <div className="reception-settings-section">
              <h2>3. Mật độ hiển thị</h2>
              <div className="reception-settings-option-grid">
                {[
                  ['comfortable', 'Thoáng', 'Khoảng cách rộng rãi'],
                  ['standard', 'Tiêu chuẩn', 'Phù hợp cho hầu hết'],
                  ['compact', 'Gọn', 'Hiển thị nhiều thông tin'],
                ].map(([value, title, desc]) => (
                  <button type="button" className={settings.density === value ? 'is-active' : ''} key={value} onClick={() => update({ density: value })}>
                    <SlidersHorizontal size={24} />
                    <span><strong>{title}</strong><small>{desc}</small></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="reception-settings-section">
              <h2>4. Cỡ chữ giao diện</h2>
              <input type="range" min="0" max="100" value={settings.fontSize} onChange={(event) => update({ fontSize: event.target.value })} />
              <div className="reception-settings-scale"><span>Nhỏ</span><span>Vừa</span><span>Lớn</span></div>
            </div>
          </>
        ) : null}

        {uiTab === 'locale' ? (
          <div className="reception-settings-form">
            <div className="reception-settings-section">
              <h2>1. Ngôn ngữ</h2>
              <div className="reception-settings-option-grid">
                {[
                  ['Tiếng Việt', Globe2, 'Tiếng Việt', 'Ngôn ngữ mặc định'],
                  ['English', Globe2, 'English', 'English interface labels'],
                  ['Song ngữ', Globe2, 'Song ngữ', 'Hiển thị Việt - Anh'],
                ].map(([value, Icon, title, desc]) => (
                  <button type="button" className={settings.language === value ? 'is-active' : ''} key={value} onClick={() => update({ language: value })}>
                    <Icon size={24} />
                    <span><strong>{title}</strong><small>{desc}</small></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="reception-settings-two-col">
              <Field label="Khu vực">
                <select value={settings.region} onChange={(event) => update({ region: event.target.value })}>
                  <option>Việt Nam (GMT+7)</option>
                  <option>Singapore (GMT+8)</option>
                  <option>Thailand (GMT+7)</option>
                </select>
              </Field>
              <Field label="Định dạng ngày">
                <select value={settings.dateFormat} onChange={(event) => update({ dateFormat: event.target.value })}>
                  <option>dd/mm/yyyy</option>
                  <option>yyyy-mm-dd</option>
                  <option>mm/dd/yyyy</option>
                </select>
              </Field>
            </div>
            <div className="reception-settings-two-col">
              <Field label="Định dạng giờ">
                <select value={settings.timeFormat} onChange={(event) => update({ timeFormat: event.target.value })}>
                  <option>24 giờ</option>
                  <option>12 giờ AM/PM</option>
                </select>
              </Field>
              <Field label="Tiền tệ">
                <select value="VND" disabled>
                  <option>VND - Đồng Việt Nam</option>
                </select>
              </Field>
            </div>
            <div className="reception-settings-list">
              <div><span><MapPin size={18} />Tự động nhận diện múi giờ thiết bị</span><Toggle checked={settings.region.includes('GMT+7')} onChange={() => onMessage('Múi giờ đang dùng theo khu vực đã chọn')} /></div>
              <div><span><Globe2 size={18} />Dịch nhãn hệ thống theo ngôn ngữ</span><Toggle checked={settings.language !== 'Tiếng Việt'} onChange={(value) => update({ language: value ? 'Song ngữ' : 'Tiếng Việt' })} /></div>
            </div>
          </div>
        ) : null}

        {uiTab === 'layout' ? (
          <>
            <div className="reception-settings-section">
              <h2>1. Bố cục tổng thể</h2>
              <div className="reception-settings-option-grid">
                {[
                  ['Rộng', LayoutPanelTop, 'Rộng', 'Tận dụng toàn bộ vùng làm việc'],
                  ['Cân bằng', LayoutPanelTop, 'Cân bằng', 'Giữ khoảng trắng vừa phải'],
                  ['Tập trung', LayoutPanelTop, 'Tập trung', 'Giới hạn chiều rộng nội dung'],
                ].map(([value, Icon, title, desc]) => (
                  <button type="button" className={settings.contentWidth === value ? 'is-active' : ''} key={value} onClick={() => update({ contentWidth: value })}>
                    <Icon size={24} />
                    <span><strong>{title}</strong><small>{desc}</small></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="reception-settings-card-grid">
              <section>
                <h2>2. Sidebar</h2>
                <div><span>Thu gọn mặc định</span><Toggle checked={settings.collapseSidebar} onChange={(value) => update({ collapseSidebar: value })} /></div>
                <div><span>Giữ mở menu đang dùng</span><Toggle checked={settings.keepMenuOpen} onChange={(value) => update({ keepMenuOpen: value })} /></div>
                <Field label="Vị trí sidebar">
                  <select value={settings.sidebarPosition} onChange={(event) => update({ sidebarPosition: event.target.value })}>
                    <option>Trái</option>
                    <option>Phải</option>
                  </select>
                </Field>
              </section>
              <section>
                <h2>3. Bảng dữ liệu</h2>
                <div><span>Sticky header</span><Toggle checked={settings.stickyHeader} onChange={(value) => update({ stickyHeader: value })} /></div>
                <div><span>Hiển thị sọc dòng</span><Toggle checked={settings.stripedRows} onChange={(value) => update({ stripedRows: value })} /></div>
                <Field label="Số dòng mặc định mỗi trang">
                  <select value={settings.pageSize} onChange={(event) => update({ pageSize: event.target.value })}>
                    <option>10 dòng</option>
                    <option>20 dòng</option>
                    <option>50 dòng</option>
                  </select>
                </Field>
              </section>
            </div>
            <div className="reception-settings-list">
              <div><span><LayoutPanelTop size={18} />Hiển thị thanh tìm kiếm trên đầu</span><Toggle checked={settings.showTopSearch} onChange={(value) => update({ showTopSearch: value })} /></div>
              <div><span><CalendarDays size={18} />Hiển thị bộ chọn ngày nhanh</span><Toggle checked={settings.showQuickDate} onChange={(value) => update({ showQuickDate: value })} /></div>
            </div>
          </>
        ) : null}

        {uiTab === 'notifications' ? (
          <div className="reception-settings-list">
            <div><span><Bell size={18} />Thông báo desktop</span><Toggle checked={settings.notificationDesktop} onChange={(value) => update({ notificationDesktop: value })} /></div>
            <div><span><Bell size={18} />Âm thanh thông báo</span><Toggle checked={settings.notificationSound} onChange={(value) => update({ notificationSound: value })} /></div>
            <div><span><Bell size={18} />Hiển thị badge số chưa đọc</span><Toggle checked={settings.notificationBadge} onChange={(value) => update({ notificationBadge: value })} /></div>
            <div><span><Bell size={18} />Xem trước nội dung thông báo</span><Toggle checked={settings.notificationPreview} onChange={(value) => update({ notificationPreview: value })} /></div>
            <div><span><CalendarDays size={18} />Cảnh báo lịch hẹn</span><Toggle checked={settings.appointmentAlerts} onChange={(value) => update({ appointmentAlerts: value })} /></div>
            <div><span><CreditCard size={18} />Cảnh báo thanh toán</span><Toggle checked={settings.paymentAlerts} onChange={(value) => update({ paymentAlerts: value })} /></div>
            <div><span><ShieldCheck size={18} />Cảnh báo hệ thống</span><Toggle checked={settings.systemAlerts} onChange={(value) => update({ systemAlerts: value })} /></div>
            <div className="reception-settings-note">Các tuỳ chọn này kiểm soát cách thông báo hiển thị trong dashboard lễ tân.</div>
          </div>
        ) : null}
      </div>

      <aside className="reception-settings-side">
        <section className="reception-panel">
          <h2>Xem trước giao diện</h2>
          <InterfacePreview settings={settings} />
        </section>
        <section className="reception-panel">
          <h2>Thiết lập hiện tại</h2>
          <dl>
            <div><dt>Chế độ giao diện</dt><dd>{settings.theme === 'light' ? 'Sáng' : settings.theme === 'dark' ? 'Tối' : 'Theo hệ thống'}</dd></div>
            <div><dt>Màu chủ đạo</dt><dd style={{ color: settings.color }}>Xanh dương</dd></div>
            <div><dt>Mật độ hiển thị</dt><dd>{settings.density === 'compact' ? 'Gọn' : settings.density === 'standard' ? 'Tiêu chuẩn' : 'Thoáng'}</dd></div>
            <div><dt>Cỡ chữ giao diện</dt><dd>Vừa</dd></div>
            <div><dt>Ngôn ngữ</dt><dd>{settings.language}</dd></div>
            <div><dt>Khu vực</dt><dd>{settings.region}</dd></div>
            <div><dt>Định dạng ngày</dt><dd>{settings.dateFormat}</dd></div>
            <div><dt>Bố cục</dt><dd>{settings.contentWidth}</dd></div>
            <div><dt>Thông báo</dt><dd>{settings.notificationDesktop ? 'Đã bật' : 'Đã tắt'}</dd></div>
          </dl>
        </section>
        <section className="reception-panel reception-settings-advice">
          <h2>Gợi ý trải nghiệm</h2>
          <p>Chọn mật độ “Gọn” nếu bạn thường xuyên làm việc với bảng dữ liệu lớn.</p>
          <p>Giữ màu xanh dương để đảm bảo nhận diện và dễ đọc trong môi trường y tế.</p>
          <button type="button" onClick={() => { setSettings(DEFAULT_UI_SETTINGS); onMessage('Đã khôi phục giao diện mặc định'); }}>Khôi phục mặc định</button>
        </section>
      </aside>
    </section>
  );
}

function SystemPage({ settings, setSettings, onMessage }) {
  const [activeTab, setActiveTab] = useState('clinic');
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  const sideStatus = useMemo(() => [
    ['SMS', 'Hoạt động'],
    ['Email', 'Hoạt động'],
    ['Lịch nhắc hẹn', 'Hoạt động'],
    ['Sao lưu gần nhất', '1 giờ trước'],
  ], []);

  return (
    <section className="reception-settings-layout">
      <div className="reception-panel reception-settings-system">
        <aside>
          {[
            ['clinic', Database, 'Thông tin phòng khám'],
            ['schedule', CalendarDays, 'Lịch làm việc'],
            ['integrations', Link2, 'Tích hợp'],
            ['backup', Cloud, 'Sao lưu & khôi phục'],
          ].map(([key, Icon, label]) => (
            <button type="button" className={activeTab === key ? 'is-active' : ''} key={key} onClick={() => setActiveTab(key)}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </aside>
        <div className="reception-settings-form">
          {activeTab === 'clinic' ? (
            <>
              <Field label="Tên phòng khám"><input value={settings.clinicName} onChange={(event) => update('clinicName', event.target.value)} /></Field>
              <Field label="Địa chỉ"><input value={settings.address} onChange={(event) => update('address', event.target.value)} /></Field>
              <div className="reception-settings-two-col">
                <Field label="Số điện thoại"><input value={settings.phone} onChange={(event) => update('phone', event.target.value)} /></Field>
                <Field label="Email"><input value={settings.email} onChange={(event) => update('email', event.target.value)} /></Field>
              </div>
              <Field label="Website"><input value={settings.website} onChange={(event) => update('website', event.target.value)} /></Field>
              <div className="reception-settings-two-col">
                <Field label="Giờ mở cửa từ"><input type="time" value={settings.open} onChange={(event) => update('open', event.target.value)} /></Field>
                <Field label="Đến"><input type="time" value={settings.close} onChange={(event) => update('close', event.target.value)} /></Field>
              </div>
              <Field label="Múi giờ">
                <select value={settings.timezone} onChange={(event) => update('timezone', event.target.value)}>
                  <option>(GMT+07:00) Asia/Ho Chi Minh</option>
                  <option>(GMT+07:00) Asia/Bangkok</option>
                </select>
              </Field>
              <div className="reception-settings-upload is-logo">
                {settings.logo ? <img src={settings.logo} alt="Logo phòng khám" /> : <div className="reception-avatar-badge">+</div>}
                <label className="reception-settings-upload-button">
                  <Upload size={18} />
                  Nhấp để tải logo lên
                  <span>JPG, PNG, tối đa 2MB</span>
                  <input type="file" accept="image/png,image/jpeg" onChange={(event) => readFileAsDataUrl(event.target.files?.[0], (value) => update('logo', value))} />
                </label>
              </div>
            </>
          ) : null}

          {activeTab === 'schedule' ? (
            <div className="reception-settings-list">
              <div><span><CalendarDays size={18} />Cho phép đặt lịch online</span><Toggle checked={settings.onlineBooking} onChange={(value) => update('onlineBooking', value)} /></div>
              <div><span><Phone size={18} />Tự động gửi SMS nhắc lịch</span><Toggle checked={settings.smsReminder} onChange={(value) => update('smsReminder', value)} /></div>
              <div><span><Mail size={18} />Tự động gửi email nhắc lịch</span><Toggle checked={settings.emailReminder} onChange={(value) => update('emailReminder', value)} /></div>
              <div><span><Smartphone size={18} />Cho phép check-in trước</span><Toggle checked={settings.preCheckin} onChange={(value) => update('preCheckin', value)} /></div>
              <Field label="Thời gian check-in trước (phút)"><input type="number" min="0" value={settings.preCheckinMinutes} onChange={(event) => update('preCheckinMinutes', event.target.value)} /></Field>
              <div><span><Monitor size={18} />Hiển thị số thứ tự trên màn hình</span><Toggle checked={settings.queueScreen} onChange={(value) => update('queueScreen', value)} /></div>
            </div>
          ) : null}

          {activeTab === 'integrations' ? (
            <div className="reception-settings-session-list">
              {Object.keys(settings.integrations).map((name) => (
                <div key={name}>
                  <Link2 size={20} />
                  <span><strong>{name}</strong><small>{settings.integrations[name] ? 'Đã kết nối và sẵn sàng sử dụng' : 'Đang tắt kết nối'}</small></span>
                  <Toggle checked={settings.integrations[name]} onChange={(value) => setSettings((current) => ({ ...current, integrations: { ...current.integrations, [name]: value } }))} />
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'backup' ? (
            <div className="reception-settings-session-list">
              {settings.backupLog.map((name) => (
                <div key={name}>
                  <Cloud size={20} />
                  <span><strong>{name}</strong><small>Đang hoạt động</small></span>
                  <em>Hoạt động</em>
                </div>
              ))}
              <button type="button" className="reception-btn reception-btn--primary reception-settings-fit" onClick={() => {
                update('backupLog', [`Sao lưu thủ công - ${new Date().toLocaleString('vi-VN')}`, ...settings.backupLog]);
                onMessage('Đã tạo bản sao lưu thủ công');
              }}>
                <Cloud size={17} />
                Tạo sao lưu ngay
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="reception-settings-side">
        <section className="reception-panel reception-settings-quick">
          <h2>Tình trạng hệ thống</h2>
          {sideStatus.map(([label, value]) => (
            <button type="button" key={label}><ShieldCheck size={18} />{label}<span>{value}</span></button>
          ))}
        </section>
        <section className="reception-panel reception-settings-quick">
          <h2>Tích hợp nhanh</h2>
          {Object.entries(settings.integrations).map(([label, enabled]) => (
            <button type="button" key={label} onClick={() => setActiveTab('integrations')}><CheckCircle2 size={18} />{label}<span>{enabled ? 'Hoạt động' : 'Đang tắt'}</span></button>
          ))}
        </section>
        <section className="reception-panel reception-settings-advice">
          <h2>Khuyến nghị cấu hình</h2>
          <p>Kích hoạt nhắc lịch để giảm tỷ lệ bệnh nhân quên hẹn.</p>
          <p>Thiết lập sao lưu định kỳ hằng ngày để đảm bảo an toàn.</p>
          <p>Kết nối thanh toán online để rút ngắn thời gian thu ngân.</p>
        </section>
      </aside>
    </section>
  );
}

export function ReceptionSettingsPanel({ mode = 'settings-account' }) {
  const resolvedMode = mode === 'settings-permissions' ? 'settings-account' : mode;
  const storedSettings = useMemo(() => ({}), []);
  const [account, setAccount] = useState(() => ({
    ...DEFAULT_ACCOUNT_SETTINGS,
    ...(storedSettings.account || {}),
    profile: {
      ...DEFAULT_ACCOUNT_SETTINGS.profile,
      ...(storedSettings.account?.profile || {}),
    },
    security: {
      ...DEFAULT_ACCOUNT_SETTINGS.security,
      ...(storedSettings.account?.security || {}),
    },
    sessions: storedSettings.account?.sessions || DEFAULT_ACCOUNT_SETTINGS.sessions,
  }));
  const [uiSettings, setUiSettings] = useState(() => ({
    ...DEFAULT_UI_SETTINGS,
    ...(storedSettings.ui || {}),
  }));
  const [systemSettings, setSystemSettings] = useState(() => ({
    ...DEFAULT_SYSTEM_SETTINGS,
    ...(storedSettings.system || {}),
    integrations: {
      ...DEFAULT_SYSTEM_SETTINGS.integrations,
      ...(storedSettings.system?.integrations || {}),
    },
    backupLog: storedSettings.system?.backupLog || DEFAULT_SYSTEM_SETTINGS.backupLog,
  }));
  const [savedMessage, setSavedMessage] = useState('');
  const [settingSource, setSettingSource] = useState({ uiKey: '', systemKey: '' });
  const [settingsStatus, setSettingsStatus] = useState({ loading: false, error: '' });
  const [workspacePreferences, setWorkspacePreferences] = useState({});

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--reception-primary', uiSettings.color);
    root.style.setProperty('--reception-primary-soft', `${uiSettings.color}1a`);
    root.dataset.receptionDensity = uiSettings.density;
    root.dataset.receptionTheme = uiSettings.theme;
    root.style.setProperty('--reception-font-scale', `${0.95 + (Number(uiSettings.fontSize) / 100) * 0.12}`);
  }, [uiSettings]);

  useEffect(() => {
    let active = true;
    async function loadRemoteSettings() {
      setSettingsStatus({ loading: true, error: '' });
      try {
        const [profilePayload, sessionsPayload, groupedPayload, preferencesPayload] = await Promise.all([
          receptionDataApi.getMe().catch(() => null),
          receptionDataApi.listMySessions().catch(() => null),
          receptionDataApi.listSystemSettingsGrouped().catch(() => null),
          receptionDataApi.getMyPreferences().catch(() => null),
        ]);

        if (!active) return;

        if (profilePayload) {
          setAccount((current) => ({
            ...current,
            profile: {
              ...current.profile,
              ...normalizeCurrentProfile(profilePayload),
              avatar: current.profile.avatar,
            },
          }));
        }

        if (sessionsPayload) {
          setAccount((current) => ({
            ...current,
            sessions: normalizeSessions(sessionsPayload),
          }));
        }

        if (groupedPayload) {
          const settingMap = flattenGroupedSettings(groupedPayload);
          const uiRecord = findSettingRecord(settingMap, UI_SETTING_KEYS);
          const systemRecord = findSettingRecord(settingMap, SYSTEM_SETTING_KEYS);

          if (uiRecord.value && typeof uiRecord.value === 'object') {
            setUiSettings((current) => ({ ...current, ...uiRecord.value }));
          }
          if (systemRecord.value && typeof systemRecord.value === 'object') {
            setSystemSettings((current) => ({
              ...current,
              ...systemRecord.value,
              integrations: {
                ...current.integrations,
                ...(systemRecord.value.integrations || {}),
              },
              backupLog: systemRecord.value.backupLog || current.backupLog,
            }));
          }
          setSettingSource({ uiKey: uiRecord.key, systemKey: systemRecord.key });
        }

        if (preferencesPayload) {
          const preferences = preferencesPayload.preferences || preferencesPayload;
          const workspacePrefs = preferences.workspace_preferences || {};
          const receptionPrefs = workspacePrefs.reception || {};
          setWorkspacePreferences(workspacePrefs);
          if (receptionPrefs.ui && typeof receptionPrefs.ui === 'object') {
            setUiSettings((current) => ({ ...current, ...receptionPrefs.ui }));
          }
          if (receptionPrefs.system && typeof receptionPrefs.system === 'object') {
            setSystemSettings((current) => ({
              ...current,
              ...receptionPrefs.system,
              integrations: {
                ...current.integrations,
                ...(receptionPrefs.system.integrations || {}),
              },
              backupLog: receptionPrefs.system.backupLog || current.backupLog,
            }));
          }
          if (receptionPrefs.account?.security) {
            setAccount((current) => ({
              ...current,
              security: {
                ...current.security,
                ...receptionPrefs.account.security,
              },
            }));
          }
        }
        setSettingsStatus({ loading: false, error: '' });
      } catch (error) {
        if (!active) return;
        setSettingsStatus({ loading: false, error: error.message || 'Khong the tai cau hinh tu API' });
      }
    }

    loadRemoteSettings();
    return () => {
      active = false;
    };
  }, []);

  function showMessage(message) {
    setSavedMessage(message);
    window.setTimeout(() => setSavedMessage(''), 1800);
  }

  async function handleSave() {
    try {
      if (resolvedMode === 'settings-account') {
        await receptionDataApi.updateMe({
          email: account.profile.email,
          phone: account.profile.phone,
        });
      }
      if (resolvedMode === 'settings-ui' && settingSource.uiKey) {
        await receptionDataApi.updateSystemSetting(settingSource.uiKey, { setting_value: uiSettings });
      }
      if (resolvedMode === 'settings-system' && settingSource.systemKey) {
        await receptionDataApi.updateSystemSetting(settingSource.systemKey, { setting_value: systemSettings });
      }
      const nextWorkspacePreferences = {
        ...workspacePreferences,
        reception: {
          ...(workspacePreferences.reception || {}),
          account: {
            ...((workspacePreferences.reception || {}).account || {}),
            security: account.security,
          },
          ui: uiSettings,
          system: systemSettings,
        },
      };
      await receptionDataApi.updateMyPreferences({ workspace_preferences: nextWorkspacePreferences });
      setWorkspacePreferences(nextWorkspacePreferences);
    } catch (error) {
      showMessage(error.message || 'Khong the dong bo cau hinh len API');
      return;
    }
    showMessage('Đã lưu thay đổi');
  }

  return (
    <div className="reception-settings-page">
      <SettingsHero mode={resolvedMode} onSave={handleSave} savedMessage={savedMessage} />
      {settingsStatus.loading ? <div className="reception-inline-alert">Dang tai du lieu cau hinh tu API...</div> : null}
      {settingsStatus.error ? <div className="reception-inline-alert is-warning">{settingsStatus.error}</div> : null}
      {resolvedMode === 'settings-account' ? (
        <AccountPage
          account={account}
          setAccount={setAccount}
          onMessage={showMessage}
          onChangePassword={(body) => receptionDataApi.changePassword(body)}
          onRevokeSession={(sessionId) => receptionDataApi.revokeMySession(sessionId)}
        />
      ) : null}
      {resolvedMode === 'settings-ui' ? <UiPage settings={uiSettings} setSettings={setUiSettings} onMessage={showMessage} /> : null}
      {resolvedMode === 'settings-system' ? <SystemPage settings={systemSettings} setSettings={setSystemSettings} onMessage={showMessage} /> : null}
    </div>
  );
}
