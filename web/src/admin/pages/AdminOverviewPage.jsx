import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatCompactDate(value) {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

function buildRoleGradient(roleSegments = []) {
  if (roleSegments.length === 0) return 'conic-gradient(#dbe8f6 0deg 360deg)';
  let current = 0;
  const palette = ['#4f46e5', '#38bdf8', '#fbbf24', '#10b981'];
  const total = roleSegments.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
  const stops = roleSegments.slice(0, 4).map((item, index) => {
    const next = current + (Number(item.count || 0) / total) * 360;
    const segment = `${palette[index]} ${current}deg ${next}deg`;
    current = next;
    return segment;
  });
  if (current < 360) stops.push(`#e6eef7 ${current}deg 360deg`);
  return `conic-gradient(${stops.join(', ')})`;
}

export function AdminOverviewPage() {
  const [data, setData] = useState({
    summary: null,
    roles: [],
    departments: [],
    staff: [],
    audit: [],
    permissions: [],
  });
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      async function fetchJson(url) {
        const response = await fetchWithAuth(url);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || 'Không thể tải tổng quan.');
        return payload?.data;
      }

      try {
        const [summary, roles, departments, staff, audit, permissions] = await Promise.all([
          fetchJson(`${API_BASE_URL}/staff/summary`),
          fetchJson(`${API_BASE_URL}/iam/roles?limit=20`),
          fetchJson(`${API_BASE_URL}/departments?limit=20`),
          fetchJson(`${API_BASE_URL}/staff/accounts?limit=4`),
          fetchJson(`${API_BASE_URL}/auth/audit-logs?limit=6`),
          fetchJson(`${API_BASE_URL}/auth/me/permissions`),
        ]);

        if (!active) return;
        setData({
          summary,
          roles: roles?.items || [],
          departments: departments?.items || [],
          staff: staff?.items || [],
          audit: audit?.items || [],
          permissions: permissions?.permissions || [],
        });
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const view = useMemo(() => {
    const summary = data.summary || {};
    const loginRate = summary.total ? Math.round((Number(summary.active || 0) / Number(summary.total || 1)) * 100) : 0;
    const missingHeadsCount = data.departments.filter((item) => !item.head_user_id).length;
    const newCreatedCount = data.audit.filter((item) => item.action === 'auth.staff.create').length;
    const topDepartments = [...(summary.department_breakdown || [])]
      .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
      .slice(0, 4);
    const roleSegments = (summary.role_breakdown || []).slice(0, 4);
    const maxDepartmentCount = Math.max(...topDepartments.map((item) => Number(item.count || 0)), 1);
    const accountStatuses = [
      { label: 'Đang hoạt động', value: Number(summary.active || 0), tone: 'green' },
      { label: 'Bị khóa', value: Number(summary.locked || 0), tone: 'amber' },
      { label: 'Vô hiệu hóa', value: Number(summary.disabled || 0), tone: 'red' },
      { label: 'Tạm ngưng', value: Number(summary.suspended || 0), tone: 'slate' },
    ];

    return {
      loginRate,
      missingHeadsCount,
      newCreatedCount,
      topDepartments,
      roleSegments,
      roleRing: buildRoleGradient(roleSegments),
      maxDepartmentCount,
      accountStatuses,
      maxStatusCount: Math.max(...accountStatuses.map((item) => item.value), 1),
      metricCards: [
        { label: 'Tổng nhân sự', value: formatNumber(summary.total), tone: 'indigo', meta: `+${Math.max(newCreatedCount, 1)} mới`, icon: '◉', key: 'total_staff' },
        { label: 'Đang hoạt động', value: formatNumber(summary.active), tone: 'green', meta: 'ổn định', icon: '✓', key: 'active' },
        { label: 'Bị khóa', value: formatNumber(summary.locked), tone: 'red', meta: `${summary.locked || 0} cảnh báo`, icon: '⌂', key: 'locked' },
        { label: 'Tổng vai trò', value: formatNumber(data.roles.length), tone: 'amber', meta: 'đang dùng', icon: '⌘', key: 'roles' },
        { label: 'Tổng quyền', value: formatNumber(data.permissions.length), tone: 'violet', meta: 'quyền khả dụng', icon: '⌁', key: 'permissions' },
        { label: 'Khoa/Phòng', value: formatNumber(data.departments.length), tone: 'blue', meta: `${missingHeadsCount} thiếu trưởng khoa`, icon: '▣', key: 'departments' },
        { label: 'Mới tạo', value: formatNumber(newCreatedCount), tone: 'pink', meta: 'từ nhật ký hệ thống', icon: '+', key: 'new_created' },
        { label: 'Tỷ lệ đăng nhập', value: `${loginRate}%`, tone: 'teal', meta: 'nhân sự đang active', icon: '↗', key: 'login_rate' },
      ],
    };
  }, [data]);

  return (
    <>
      <section className="admin-insight-bar">
        <div className="admin-insight-bar__title">
          <span>◉</span>
          <strong>Thông tin hệ thống:</strong>
        </div>
        <div className="admin-insight-bar__chips">
          <span>{formatNumber(data.summary?.locked)} tài khoản bị khóa</span>
          <span>{formatNumber(view.missingHeadsCount)} khoa/phòng thiếu trưởng khoa</span>
        </div>
        <button type="button">Xem chi tiết</button>
      </section>

      <section className="admin-hero">
        <div>
          <h1>Tổng quan hệ thống</h1>
          <p>
            Theo dõi nhanh nhân sự, vai trò, khoa phòng và các tín hiệu bảo mật gần đây của toàn hệ
            thống Aura Health.
          </p>
          {error ? <p className="form-message error">{error}</p> : null}
        </div>

        <div className="admin-hero__actions">
          <button type="button">Xem nhật ký</button>
          <button type="button">Tạo vai trò</button>
          <button type="button">Tạo khoa/phòng</button>
          <Link to="/admin/staff/create" className="admin-hero__actions-primary">
            Tạo nhân sự
          </Link>
        </div>
      </section>

      <section className="admin-metrics">
        {view.metricCards.map((item) => {
          const metricHref =
            item.key === 'total_staff'
              ? '/admin/staff'
              : item.key === 'active'
                ? '/admin/staff?status=active'
                : item.key === 'locked'
                  ? '/admin/staff?status=locked'
                  : item.key === 'new_created'
                    ? '/admin/staff?sort=created_at_desc'
                    : null;

          const content = (
            <>
              <div className="admin-metric-card__top">
                <span className="admin-metric-card__icon">{item.icon}</span>
                <small>{item.meta}</small>
              </div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </>
          );

          return metricHref ? (
            <Link key={item.label} to={metricHref} className={`admin-metric-card admin-metric-card--${item.tone}`}>
              {content}
            </Link>
          ) : (
            <article key={item.label} className={`admin-metric-card admin-metric-card--${item.tone}`}>
              {content}
            </article>
          );
        })}
      </section>

      <section className="admin-content-grid">
        <article className="admin-panel admin-panel--table">
          <div className="admin-panel__heading">
            <h2>Nhân sự mới tạo</h2>
            <Link to="/admin/staff">Xem tất cả</Link>
          </div>
          <div className="admin-staff-table">
            <div className="admin-staff-table__head">
              <span>Họ và tên</span>
              <span>Vai trò</span>
              <span>Khoa phòng</span>
              <span>Trạng thái</span>
            </div>
            {data.staff.map((item) => (
              <div key={item.user_id} className="admin-staff-table__row">
                <div className="admin-staff-table__person">
                  <div className="admin-avatar">{String(item.full_name || item.username).slice(0, 2).toUpperCase()}</div>
                  <div>
                    <Link to={`/admin/staff/${item.user_id}`}>{item.full_name || item.username}</Link>
                    <span>{item.email || item.username}</span>
                  </div>
                </div>
                <div className="admin-tag-list">
                  {(item.roles || []).slice(0, 2).map((role) => (
                    <span key={role}>{role}</span>
                  ))}
                </div>
                <strong className="admin-staff-table__department">
                  {data.departments.find((department) => department.department_id === item.department_id)?.department_name || 'Chưa gán'}
                </strong>
                <span className={`admin-status-badge admin-status-badge--${item.status || 'active'}`}>{item.status || 'active'}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-panel admin-panel--activity">
          <div className="admin-panel__heading">
            <h2>Hoạt động gần đây</h2>
          </div>
          <div className="admin-activity-list">
            {data.audit.map((item, index) => (
              <div key={`${item._id || item.action}-${index}`} className="admin-activity-item">
                <div className={`admin-activity-item__icon admin-activity-item__icon--${item.status || 'success'}`}>
                  {item.status === 'failed' ? '!' : '+'}
                </div>
                <div>
                  <strong>{item.message || item.action}</strong>
                  <span>{formatCompactDate(item.created_at)} • {item.target_type || 'Hệ thống'}</span>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="admin-panel__ghost-link">Tải thêm hoạt động</button>
        </article>
      </section>

      <section className="admin-analytics-grid">
        <article className="admin-panel">
          <div className="admin-panel__heading"><h2>Nhân sự theo khoa/phòng</h2></div>
          <div className="admin-progress-list">
            {view.topDepartments.map((item) => (
              <div key={item.department_id} className="admin-progress-item">
                <div className="admin-progress-item__meta">
                  <span>{item.department_name}</span>
                  <strong>{formatNumber(item.count)}</strong>
                </div>
                <div className="admin-progress-track">
                  <span style={{ width: `${Math.max((Number(item.count || 0) / view.maxDepartmentCount) * 100, 10)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-panel">
          <div className="admin-panel__heading"><h2>Nhân sự theo vai trò</h2></div>
          <div className="admin-role-chart">
            <div className="admin-role-chart__ring" style={{ background: view.roleRing }}>
              <div>
                <strong>{formatNumber(data.summary?.total)}</strong>
                <span>Tổng</span>
              </div>
            </div>
            <div className="admin-legend">
              {view.roleSegments.map((item, index) => (
                <div key={item.role_code}>
                  <span style={{ backgroundColor: ['#4f46e5', '#38bdf8', '#fbbf24', '#10b981'][index] }} />
                  <strong>{item.role_code}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="admin-panel">
          <div className="admin-panel__heading"><h2>Trạng thái tài khoản</h2></div>
          <div className="admin-status-chart">
            <div className="admin-status-chart__bars">
              {view.accountStatuses.map((item) => (
                <div key={item.label} className="admin-status-chart__bar-group">
                  <div className={`admin-status-chart__bar admin-status-chart__bar--${item.tone}`}>
                    <span style={{ height: `${Math.max((item.value / view.maxStatusCount) * 100, item.value > 0 ? 16 : 0)}%` }} />
                  </div>
                  <strong>{item.label}</strong>
                </div>
              ))}
            </div>
            <div className="admin-status-chart__note"><span>i</span><strong>{view.loginRate}% tài khoản đang hoạt động</strong></div>
          </div>
        </article>
      </section>
    </>
  );
}
