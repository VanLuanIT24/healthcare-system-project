import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Fingerprint,
  History,
  KeyRound,
  Laptop,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  ShieldEllipsis,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { getDepartments } from '../../staff/staffApi';
import {
  getMyLoginHistory,
  getMyPermissions,
  getMyProfile,
  getMyRoles,
  getMySessions,
  logoutAllMyDevices,
  updateMyProfile,
} from '../systemApi';
import { formatCompactDate, formatDateTime, formatNumber, formatRelativeTime, getBrowserLabel, getDeviceLabel, getInitials } from '../systemUi';
import './myProfilePro.css';

function pickProfile(payload) {
  return payload?.profile || payload?.user || payload?.account || payload?.data?.profile || payload?.data?.user || payload?.data || payload || null;
}

function normalizeList(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getSecurityScore(profile, permissions, sessions) {
  let score = 58;
  if (profile?.status === 'active' || profile?.is_active) score += 10;
  if (!profile?.must_change_password) score += 12;
  if ((permissions?.length || 0) >= 20) score += 8;
  if ((sessions?.filter((item) => item.is_active).length || 0) <= 3) score += 8;
  if (profile?.last_login_at) score += 4;
  return Math.min(score, 100);
}

function getSecurityTone(score) {
  if (score >= 86) return 'Ổn định';
  if (score >= 70) return 'Tốt';
  if (score >= 50) return 'Cần theo dõi';
  return 'Rủi ro';
}

function getDisplayName(profile) {
  return profile?.full_name || profile?.name || profile?.display_name || profile?.username || 'Tài khoản quản trị';
}

function getRoleLabel(role) {
  return role?.role_name || role?.name || role?.role_code || role?.code || 'Vai trò hệ thống';
}

function getRoleCode(role) {
  return role?.role_code || role?.code || role?.id || getRoleLabel(role);
}

function getPermissionCode(permission) {
  return typeof permission === 'string' ? permission : permission?.permission_code || permission?.code || permission?.name || 'permission.unknown';
}

function groupPermissions(permissions) {
  return permissions.reduce((groups, item) => {
    const code = getPermissionCode(item);
    const moduleKey = code.split('.')[0] || 'general';
    groups[moduleKey] = groups[moduleKey] || [];
    groups[moduleKey].push(code);
    return groups;
  }, {});
}

function SessionCard({ session, index }) {
  const device = getDeviceLabel(session?.user_agent || '');
  const browser = getBrowserLabel(session?.user_agent || '');
  return (
    <article className="profile-session-card">
      <span className="profile-session-card__icon"><Laptop size={18} /></span>
      <div>
        <strong>{index === 0 ? 'Phiên hiện tại / gần nhất' : `${device} khác`}</strong>
        <small>{browser} · {session?.ip_address || 'IP chưa ghi nhận'}</small>
      </div>
      <span className={session?.is_active ? 'profile-status profile-status--green' : 'profile-status profile-status--slate'}>
        {session?.is_active ? 'Active' : 'Inactive'}
      </span>
    </article>
  );
}

export function MyProfilePage() {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState({
    profile: null,
    roles: [],
    permissions: [],
    sessions: [],
    departments: [],
    loginHistory: [],
  });
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });

  async function loadData() {
    setError('');
    setLoading(true);
    try {
      const [profileData, rolesData, permissionsData, sessionsData, departmentsData, loginHistoryData] = await Promise.all([
        getMyProfile(),
        getMyRoles().catch(() => ({ roles: [] })),
        getMyPermissions().catch(() => ({ permissions: [] })),
        getMySessions().catch(() => ({ items: [] })),
        getDepartments('limit=200').catch(() => ({ items: [] })),
        getMyLoginHistory('limit=8').catch(() => ({ items: [] })),
      ]);

      const profile = pickProfile(profileData);
      const roles = normalizeList(rolesData, 'roles');
      const permissions = normalizeList(permissionsData, 'permissions');
      const sessions = normalizeList(sessionsData, 'items');
      const departments = normalizeList(departmentsData, 'items');
      const loginHistory = normalizeList(loginHistoryData, 'items');

      setData({ profile, roles, permissions, sessions, departments, loginHistory });
      setForm({
        full_name: profile?.full_name || profile?.name || profile?.display_name || '',
        email: profile?.email || '',
        phone: profile?.phone || '',
      });
    } catch (loadError) {
      setError(loadError?.message || 'Không thể tải hồ sơ cá nhân.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const profile = data.profile;
  const displayName = getDisplayName(profile);
  const primaryRole = data.roles[0];
  const activeSessions = useMemo(() => data.sessions.filter((item) => item.is_active), [data.sessions]);
  const securityScore = useMemo(() => getSecurityScore(profile, data.permissions, data.sessions), [profile, data.permissions, data.sessions]);
  const permissionGroups = useMemo(() => groupPermissions(data.permissions), [data.permissions]);
  const topModules = Object.entries(permissionGroups).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  const departmentName = useMemo(() => {
    const id = profile?.department_id || profile?.department?._id || profile?.department?.department_id;
    return data.departments.find((item) => item.department_id === id || item._id === id)?.department_name
      || profile?.department_name
      || profile?.department?.department_name
      || 'System Control Plane';
  }, [data.departments, profile]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const result = await updateMyProfile(form);
      const updatedProfile = pickProfile(result) || { ...profile, ...form };
      setData((current) => ({ ...current, profile: updatedProfile }));
      setEditing(false);
    } catch (saveError) {
      setError(saveError?.message || 'Không thể lưu hồ sơ.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoutAll() {
    setError('');
    try {
      await logoutAllMyDevices();
      await loadData();
    } catch (logoutError) {
      setError(logoutError?.message || 'Không thể đăng xuất các thiết bị.');
    }
  }

  if (loading) {
    return (
      <section className="profile-pro-page">
        <div className="profile-pro-loading">
          <RefreshCw size={22} className="profile-pro-spin" />
          <strong>Đang tải hồ sơ quản trị...</strong>
          <span>Đồng bộ profile, vai trò, quyền, phiên và lịch sử đăng nhập.</span>
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="profile-pro-page">
        <div className="profile-pro-error">
          <ShieldEllipsis size={26} />
          <h1>Không thể hiển thị hồ sơ</h1>
          <p>{error || 'Backend chưa trả về thông tin tài khoản hiện tại.'}</p>
          <button type="button" onClick={loadData}>Tải lại</button>
        </div>
      </section>
    );
  }

  return (
    <section className="profile-pro-page">
      <section className="profile-pro-hero">
        <div className="profile-pro-hero__identity">
          <div className="profile-pro-avatar">
            <span>{getInitials(displayName)}</span>
            <i />
          </div>
          <div className="profile-pro-hero__copy">
            <span className="profile-pro-eyebrow">ADMIN PROFILE CENTER</span>
            <h1>{displayName}</h1>
            <p>{profile.email || profile.username || 'Tài khoản quản trị'} · {departmentName}</p>
            <div className="profile-pro-chipline">
              <span><BadgeCheck size={15} /> {getRoleLabel(primaryRole)}</span>
              <span><ShieldCheck size={15} /> {getSecurityTone(securityScore)} · {securityScore}%</span>
              <span><Clock3 size={15} /> {formatRelativeTime(profile.last_login_at)}</span>
            </div>
          </div>
        </div>
        <div className="profile-pro-hero__actions">
          <button type="button" className="profile-pro-btn profile-pro-btn--ghost" onClick={loadData}>
            <RefreshCw size={17} /> Làm mới
          </button>
          <button type="button" className="profile-pro-btn profile-pro-btn--primary" onClick={() => (editing ? handleSave() : setEditing(true))} disabled={saving}>
            {editing ? <Save size={17} /> : <UserRound size={17} />}
            {editing ? (saving ? 'Đang lưu...' : 'Lưu hồ sơ') : 'Chỉnh sửa hồ sơ'}
          </button>
          {editing ? (
            <button type="button" className="profile-pro-btn profile-pro-btn--ghost" onClick={() => setEditing(false)}>
              Hủy
            </button>
          ) : null}
        </div>
      </section>

      {error ? <div className="profile-pro-alert">{error}</div> : null}

      <section className="profile-pro-metrics">
        <article><Building2 size={20} /><span>Workspace</span><strong>{departmentName}</strong></article>
        <article><UsersRound size={20} /><span>Vai trò</span><strong>{formatNumber(data.roles.length)}</strong></article>
        <article><Fingerprint size={20} /><span>Quyền hiệu lực</span><strong>{formatNumber(data.permissions.length)}</strong></article>
        <article><Laptop size={20} /><span>Phiên active</span><strong>{formatNumber(activeSessions.length)}</strong></article>
      </section>

      <section className="profile-pro-tabs" role="tablist" aria-label="Hồ sơ quản trị">
        {[
          ['overview', 'Tổng quan', UserRound],
          ['access', 'Vai trò & quyền', ShieldCheck],
          ['security', 'Bảo mật & phiên', LockKeyhole],
          ['activity', 'Nhật ký', History],
        ].map(([key, label, Icon]) => (
          <button key={key} type="button" className={activeTab === key ? 'is-active' : ''} onClick={() => setActiveTab(key)}>
            <Icon size={17} /> {label}
          </button>
        ))}
      </section>

      <section className="profile-pro-grid">
        <main className="profile-pro-main">
          {activeTab === 'overview' ? (
            <article className="profile-pro-card">
              <div className="profile-pro-card__head">
                <div><span>PERSONAL RECORD</span><h2>Thông tin tài khoản</h2></div>
                <span className="profile-status profile-status--green">Đã xác thực</span>
              </div>
              <div className="profile-pro-formgrid">
                <label>
                  <span>Họ và tên</span>
                  {editing ? <input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} /> : <strong>{displayName}</strong>}
                </label>
                <label>
                  <span>Email</span>
                  {editing ? <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /> : <strong>{profile.email || 'Chưa cập nhật'}</strong>}
                </label>
                <label>
                  <span>Số điện thoại</span>
                  {editing ? <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /> : <strong>{profile.phone || 'Chưa cập nhật'}</strong>}
                </label>
                <label>
                  <span>Username</span>
                  <strong>{profile.username || 'Chưa cập nhật'}</strong>
                </label>
                <label>
                  <span>Mã nhân sự</span>
                  <strong>{profile.employee_code || profile.staff_code || 'Chưa gắn mã'}</strong>
                </label>
                <label>
                  <span>Ngày tạo</span>
                  <strong>{formatCompactDate(profile.created_at)}</strong>
                </label>
              </div>
            </article>
          ) : null}

          {activeTab === 'access' ? (
            <article className="profile-pro-card">
              <div className="profile-pro-card__head">
                <div><span>ACCESS SURFACE</span><h2>Vai trò & quyền hiệu lực</h2></div>
                <Link to="/admin/iam/effective" className="profile-pro-link">Xem IAM</Link>
              </div>
              <div className="profile-role-grid">
                {data.roles.length ? data.roles.map((role) => (
                  <div key={getRoleCode(role)} className="profile-role-card">
                    <strong>{getRoleLabel(role)}</strong>
                    <small>{getRoleCode(role)}</small>
                    <span>Priority {role.priority_level ?? role.priority ?? '—'}</span>
                  </div>
                )) : <p className="profile-pro-empty">Chưa có vai trò được gán.</p>}
              </div>
              <div className="profile-module-grid">
                {topModules.length ? topModules.map(([module, codes]) => (
                  <div key={module} className="profile-module-card">
                    <span>{module}</span>
                    <strong>{formatNumber(codes.length)}</strong>
                    <small>{codes.slice(0, 2).join(', ')}</small>
                  </div>
                )) : <p className="profile-pro-empty">Chưa có permission hiệu lực.</p>}
              </div>
            </article>
          ) : null}

          {activeTab === 'security' ? (
            <article className="profile-pro-card">
              <div className="profile-pro-card__head">
                <div><span>SESSION SECURITY</span><h2>Phiên đăng nhập & kiểm soát thiết bị</h2></div>
                <button type="button" className="profile-pro-link profile-pro-link--danger" onClick={handleLogoutAll}>Đăng xuất tất cả</button>
              </div>
              <div className="profile-security-score">
                <div><strong>{securityScore}%</strong><span>{getSecurityTone(securityScore)}</span></div>
                <progress value={securityScore} max="100" />
              </div>
              <div className="profile-session-list">
                {data.sessions.length ? data.sessions.slice(0, 5).map((session, index) => (
                  <SessionCard key={session.session_id || session._id || index} session={session} index={index} />
                )) : <p className="profile-pro-empty">Chưa có phiên đăng nhập được ghi nhận.</p>}
              </div>
            </article>
          ) : null}

          {activeTab === 'activity' ? (
            <article className="profile-pro-card">
              <div className="profile-pro-card__head">
                <div><span>AUDIT TIMELINE</span><h2>Lịch sử hoạt động gần đây</h2></div>
                <Link to="/admin/logs/login-history" className="profile-pro-link">Mở lịch sử</Link>
              </div>
              <div className="profile-timeline">
                {data.loginHistory.length ? data.loginHistory.map((item, index) => (
                  <div key={item.audit_log_id || item._id || index} className="profile-timeline__item">
                    <span />
                    <div>
                      <strong>{item.message || item.action || 'Hoạt động tài khoản'}</strong>
                      <small>{formatDateTime(item.created_at || item.time)} · {item.ip_address || item.ip || 'IP chưa ghi nhận'}</small>
                    </div>
                  </div>
                )) : <p className="profile-pro-empty">Chưa có lịch sử đăng nhập gần đây.</p>}
              </div>
            </article>
          ) : null}
        </main>

        <aside className="profile-pro-side">
          <article className="profile-pro-card profile-pro-card--compact">
            <div className="profile-pro-card__head"><div><span>QUICK ACTIONS</span><h2>Thao tác nhanh</h2></div></div>
            <div className="profile-action-list">
              <Link to="/admin/security/change-password"><KeyRound size={18} /><span>Đổi mật khẩu</span></Link>
              <Link to="/admin/system/my-sessions"><Laptop size={18} /><span>Thiết bị & phiên</span></Link>
              <Link to="/admin/iam/overview"><ShieldCheck size={18} /><span>IAM & phân quyền</span></Link>
              <Link to="/admin/logs/login-history"><History size={18} /><span>Lịch sử đăng nhập</span></Link>
            </div>
          </article>

          <article className="profile-pro-card profile-pro-card--compact">
            <div className="profile-pro-card__head"><div><span>CONTACT</span><h2>Liên hệ</h2></div></div>
            <div className="profile-contact-list">
              <div><Mail size={17} /><span>{profile.email || 'Chưa cập nhật email'}</span></div>
              <div><Phone size={17} /><span>{profile.phone || 'Chưa cập nhật số điện thoại'}</span></div>
              <div><MapPin size={17} /><span>{departmentName}</span></div>
              <div><CalendarDays size={17} /><span>Tham gia {formatCompactDate(profile.created_at)}</span></div>
            </div>
          </article>

          <article className="profile-pro-card profile-pro-card--compact profile-ai-card">
            <Sparkles size={22} />
            <h2>Security insight</h2>
            <p>{activeSessions.length > 3 ? 'Tài khoản có nhiều phiên active, nên kiểm tra thiết bị lạ.' : 'Tài khoản đang ổn định. Nên duy trì đổi mật khẩu định kỳ và kiểm tra audit log.'}</p>
          </article>
        </aside>
      </section>
    </section>
  );
}
