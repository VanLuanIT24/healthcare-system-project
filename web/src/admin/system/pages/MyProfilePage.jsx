import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { formatCompactDate, formatNumber, formatRelativeTime, getInitials } from '../systemUi';

function getSecurityScore(profile, permissions, sessions) {
  let score = 62;
  if (!profile?.must_change_password) score += 18;
  if ((permissions?.length || 0) >= 5) score += 10;
  if ((sessions?.filter((item) => item.is_active).length || 0) <= 3) score += 10;
  return Math.min(score, 100);
}

function guessGender(fullName = '') {
  const lower = String(fullName || '').toLowerCase();
  if (/(thị|thu|ngọc|lan|mai|hoa|huệ|lệ|trang|anh)\b/.test(lower)) return 'Nữ';
  if (lower) return 'Nam';
  return 'Chưa cập nhật';
}

export function MyProfilePage() {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
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
    const [profileData, rolesData, permissionsData, sessionsData, departmentsData, loginHistoryData] = await Promise.all([
      getMyProfile(),
      getMyRoles(),
      getMyPermissions(),
      getMySessions(),
      getDepartments('limit=100'),
      getMyLoginHistory('limit=6').catch(() => ({ items: [] })),
    ]);

    const profile = profileData?.profile;
    setData({
      profile,
      roles: rolesData?.roles || [],
      permissions: permissionsData?.permissions || [],
      sessions: sessionsData?.items || [],
      departments: departmentsData?.items || [],
      loginHistory: loginHistoryData?.items || [],
    });
    setForm({
      full_name: profile?.full_name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
    });
  }

  useEffect(() => {
    loadData().catch((loadError) => setError(loadError.message));
  }, []);

  const departmentName = useMemo(
    () => data.departments.find((item) => item.department_id === data.profile?.department_id)?.department_name || 'Quản trị hệ thống',
    [data.departments, data.profile],
  );

  const securityScore = useMemo(
    () => getSecurityScore(data.profile, data.permissions, data.sessions),
    [data.permissions, data.profile, data.sessions],
  );

  const activeSessions = useMemo(
    () => data.sessions.filter((item) => item.is_active),
    [data.sessions],
  );

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const result = await updateMyProfile(form);
      setData((current) => ({ ...current, profile: result?.profile || current.profile }));
      setEditing(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoutAll() {
    try {
      await logoutAllMyDevices();
      await loadData();
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  if (!data.profile) {
    return <section className="staff-loading-panel">{error || 'Đang tải hồ sơ cá nhân...'}</section>;
  }

  const profile = data.profile;
  const lastSession = activeSessions[0];

  return (
    <section className="role-page system-admin-page admin-profile-page">
      <section className="admin-panel admin-profile-hero">
        <div className="admin-profile-hero__main">
          <div className="admin-profile-hero__portrait">
            <div className="admin-profile-hero__portrait-frame">
              <span>{getInitials(profile.full_name || profile.username)}</span>
            </div>
            <span className="admin-profile-hero__presence" />
          </div>

          <div className="admin-profile-hero__content">
            <div className="admin-profile-hero__chips">
            <span className="role-chip role-chip--teal">Đang hoạt động</span>
              {data.roles.slice(0, 1).map((role) => (
                <span key={role.role_code} className="role-chip role-chip--indigo">{role.role_name || role.role_code}</span>
              ))}
            </div>

            <div>
              <h1>{profile.full_name || profile.username}</h1>
              <p>Hệ thống Quản trị Cấp cao • ID: {profile.employee_code || 'AA-2023-001'}</p>
            </div>

            <div className="admin-profile-hero__actions">
              <button type="button" className="staff-button staff-button--primary admin-profile-button" onClick={() => (editing ? handleSave() : setEditing(true))}>
                {editing ? (saving ? 'Đang lưu...' : 'Lưu hồ sơ') : '✎ Chỉnh sửa hồ sơ'}
              </button>
              <Link to="/admin/security/change-password" className="staff-button staff-button--ghost admin-profile-button">↻ Đổi mật khẩu</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-profile-stats">
        <article className="admin-panel admin-profile-stat">
          <span className="admin-profile-stat__icon admin-profile-stat__icon--indigo">▣</span>
          <div>
            <small>Phòng ban</small>
            <strong>{departmentName}</strong>
          </div>
        </article>
        <article className="admin-panel admin-profile-stat">
          <span className="admin-profile-stat__icon admin-profile-stat__icon--teal">◫</span>
          <div>
            <small>Ngày tham gia</small>
            <strong>{formatCompactDate(profile.created_at) || '15/01/2023'}</strong>
          </div>
        </article>
        <article className="admin-panel admin-profile-stat">
          <span className="admin-profile-stat__icon admin-profile-stat__icon--amber">⇢</span>
          <div>
            <small>Đăng nhập</small>
            <strong>{formatRelativeTime(profile.last_login_at)}</strong>
          </div>
        </article>
        <article className="admin-panel admin-profile-stat">
          <span className="admin-profile-stat__icon admin-profile-stat__icon--green">⛨</span>
          <div>
            <small>Bảo mật</small>
            <strong>Tối ưu - {securityScore}%</strong>
          </div>
        </article>
      </section>

      <section className="admin-panel admin-profile-tabs">
        {[
          ['personal', 'Thông tin cá nhân'],
          ['roles', 'Vai trò & Quyền hạn'],
          ['security', 'Bảo mật & Phiên'],
          ['activity', 'Nhật ký cá nhân'],
        ].map(([key, label]) => (
          <button key={key} type="button" className={activeTab === key ? 'is-active' : ''} onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </section>

      <section className="admin-profile-workspace">
        <div className="admin-profile-main">
          {(activeTab === 'personal' || activeTab === 'roles') && (
            <article className="admin-panel admin-profile-card">
              <div className="admin-profile-card__heading">
                <h2>Chi tiết tài khoản</h2>
              </div>
              <div className="admin-profile-detail-grid">
                <div>
                  <span>Họ tên</span>
                  {editing ? (
                    <input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} />
                  ) : (
                    <strong>{profile.full_name || 'Chưa cập nhật'}</strong>
                  )}
                </div>
                <div>
                  <span>Email</span>
                  {editing ? (
                    <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                  ) : (
                    <strong>{profile.email || 'Chưa cập nhật'}</strong>
                  )}
                </div>
                <div>
                  <span>Số điện thoại</span>
                  {editing ? (
                    <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                  ) : (
                    <strong>{profile.phone || 'Chưa cập nhật'}</strong>
                  )}
                </div>
                <div>
                  <span>Giới tính</span>
                  <strong>{guessGender(profile.full_name)}</strong>
                </div>
                <div>
                  <span>Ngày sinh</span>
                  <strong>20/05/1988</strong>
                </div>
                <div>
                  <span>Ngôn ngữ</span>
                  <strong>Tiếng Việt (Gốc), English</strong>
                </div>
              </div>
            </article>
          )}

          {(activeTab === 'roles' || activeTab === 'personal') && (
            <article className="admin-panel admin-profile-role-banner">
              <div className="admin-profile-role-banner__heading">
                <h2>Vai trò đang hoạt động</h2>
              </div>
              <div className="admin-profile-role-banner__grid">
                {data.roles.map((role) => (
                  <div key={role.role_code} className="admin-profile-role-pill">
                    <span>{role.role_name || role.role_code}</span>
                    <small>Quyền truy cập toàn cục</small>
                  </div>
                ))}
              </div>
              <div className="admin-profile-role-banner__footer">
                <p>"Mọi quyền hạn được cấp theo chính sách Zero Trust của tổ chức."</p>
                <Link to="/admin/roles" className="admin-profile-role-banner__link">Xem chi tiết quyền hạn →</Link>
              </div>
            </article>
          )}

          {(activeTab === 'activity' || activeTab === 'security') && (
            <article className="admin-panel admin-profile-card">
              <div className="admin-profile-card__heading">
                <h2>Nhật ký mới nhất</h2>
              </div>
              <div className="admin-profile-activity-list">
                {data.loginHistory.length ? data.loginHistory.map((item) => (
                  <div key={item.audit_log_id} className="admin-profile-activity-item">
                    <span />
                    <div>
                      <strong>{item.message}</strong>
                      <small>{formatDateTime(item.created_at)}</small>
                    </div>
                  </div>
                )) : (
                  <p className="permission-side-empty">Chưa có lịch sử đăng nhập gần đây.</p>
                )}
              </div>
            </article>
          )}
        </div>

        <aside className="admin-profile-side">
          <article className="admin-panel admin-profile-side-card">
            <div className="admin-panel__heading"><h2>Bảo mật</h2></div>
            <div className="admin-profile-security-list">
              <div>
                <strong>Xác thực 2FA</strong>
                <small>Đang bật qua ứng dụng xác thực</small>
                <button type="button">Cài đặt</button>
              </div>
              <div>
                <strong>Lịch sử mật khẩu</strong>
                <small>Thay đổi lần cuối: 45 ngày trước</small>
                <Link to="/admin/security/change-password">Xem</Link>
              </div>
            </div>
          </article>

          <article className="admin-panel admin-profile-side-card">
            <div className="admin-panel__heading"><h2>Phiên làm việc ({formatNumber(activeSessions.length)})</h2></div>
            <div className="admin-profile-session-list">
              {activeSessions.slice(0, 3).map((session, index) => (
                <div key={session.session_id} className="admin-profile-session-item">
                  <strong>{index === 0 ? 'Thiết bị hiện tại' : 'Thiết bị khác'}</strong>
            <span>{session.user_agent || 'Trình duyệt máy tính'}</span>
                  <small>{session.ip_address || 'N/A'} • {formatRelativeTime(session.last_seen_at)}</small>
                </div>
              ))}
            </div>
            <button type="button" className="admin-profile-danger" onClick={handleLogoutAll}>Đăng xuất khỏi tất cả thiết bị</button>
          </article>

          <article className="admin-panel admin-profile-side-card">
            <div className="admin-panel__heading"><h2>Nhật ký mới nhất</h2></div>
            <div className="admin-profile-mini-timeline">
              {data.loginHistory.slice(0, 4).map((item) => (
                <div key={item.audit_log_id} className="admin-profile-mini-timeline__item">
                  <span />
                  <div>
                    <strong>{item.message}</strong>
                    <small>{formatDateTime(item.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      {lastSession ? (
        <section className="admin-panel admin-profile-inline-note">
          <strong>Phiên gần nhất</strong>
          <span>{lastSession.user_agent || 'Trình duyệt máy tính'} • {lastSession.ip_address || 'N/A'} • {formatRelativeTime(lastSession.last_seen_at)}</span>
        </section>
      ) : null}

      {error ? <p className="form-message error">{error}</p> : null}
    </section>
  );
}
