import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  Gauge,
  KeyRound,
  LayoutGrid,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../lib/api';
import { fetchWithAuth } from '../../lib/authSession';

const STATUS_LABELS = {
  active: 'Hoạt động',
  locked: 'Bị khóa',
  disabled: 'Vô hiệu hóa',
  suspended: 'Tạm ngưng',
  pending: 'Chờ xử lý',
  pending_activation: 'Chờ kích hoạt',
};

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
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError('');

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
        setLastUpdated(new Date().toISOString());
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      } finally {
        if (active) setIsLoading(false);
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
    const atRiskCount = Number(summary.locked || 0) + Number(summary.disabled || 0) + Number(summary.suspended || 0);
    const failedAuditCount = data.audit.filter((item) => item.status === 'failed').length;
    const departmentCoverage = data.departments.length
      ? Math.round(((data.departments.length - missingHeadsCount) / data.departments.length) * 100)
      : 0;
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
      atRiskCount,
      failedAuditCount,
      departmentCoverage,
      topDepartments,
      roleSegments,
      roleRing: buildRoleGradient(roleSegments),
      maxDepartmentCount,
      accountStatuses,
      maxStatusCount: Math.max(...accountStatuses.map((item) => item.value), 1),
      metricCards: [
        { label: 'Tổng nhân sự', value: formatNumber(summary.total), tone: 'indigo', meta: `+${Math.max(newCreatedCount, 0)} mới`, icon: UsersRound, key: 'total_staff' },
        { label: 'Đang hoạt động', value: formatNumber(summary.active), tone: 'green', meta: `${loginRate}% tổng tài khoản`, icon: UserCheck, key: 'active' },
        { label: 'Tài khoản rủi ro', value: formatNumber(atRiskCount), tone: 'red', meta: `${summary.locked || 0} bị khóa`, icon: AlertTriangle, key: 'locked' },
        { label: 'Vai trò hệ thống', value: formatNumber(data.roles.length), tone: 'amber', meta: 'RBAC đang dùng', icon: ShieldCheck, key: 'roles' },
        { label: 'Quyền khả dụng', value: formatNumber(data.permissions.length), tone: 'violet', meta: 'permission scope', icon: KeyRound, key: 'permissions' },
        { label: 'Khoa/Phòng', value: formatNumber(data.departments.length), tone: 'blue', meta: `${departmentCoverage}% có phụ trách`, icon: Building2, key: 'departments' },
        { label: 'Nhân sự mới', value: formatNumber(newCreatedCount), tone: 'pink', meta: 'từ nhật ký audit', icon: UserPlus, key: 'new_created' },
        { label: 'Tín hiệu đăng nhập', value: `${loginRate}%`, tone: 'teal', meta: 'active readiness', icon: Activity, key: 'login_rate' },
      ],
      healthSignals: [
        {
          label: 'Sẵn sàng vận hành',
          value: `${loginRate}%`,
          detail: `${formatNumber(summary.active)} / ${formatNumber(summary.total)} nhân sự active`,
          icon: Gauge,
          tone: loginRate >= 80 ? 'success' : loginRate >= 55 ? 'warning' : 'danger',
        },
        {
          label: 'Phủ trưởng khoa',
          value: `${departmentCoverage}%`,
          detail: `${formatNumber(missingHeadsCount)} khoa/phòng cần bổ sung`,
          icon: Building2,
          tone: missingHeadsCount === 0 ? 'success' : missingHeadsCount <= 2 ? 'warning' : 'danger',
        },
        {
          label: 'Audit bất thường',
          value: formatNumber(failedAuditCount),
          detail: failedAuditCount ? 'Có sự kiện cần rà soát' : 'Không ghi nhận lỗi gần đây',
          icon: FileClock,
          tone: failedAuditCount ? 'danger' : 'success',
        },
      ],
      priorityItems: [
        {
          label: 'Tài khoản bị khóa',
          value: formatNumber(summary.locked),
          detail: 'Ưu tiên mở khóa hoặc xác minh rủi ro',
          to: '/admin/staff?status=locked',
          tone: Number(summary.locked || 0) > 0 ? 'danger' : 'success',
        },
        {
          label: 'Khoa/phòng thiếu trưởng khoa',
          value: formatNumber(missingHeadsCount),
          detail: 'Bổ sung người phụ trách để hoàn thiện phân quyền',
          to: '/admin/facilities/heads',
          tone: missingHeadsCount > 0 ? 'warning' : 'success',
        },
        {
          label: 'Quyền đang khả dụng',
          value: formatNumber(data.permissions.length),
          detail: 'Kiểm tra scope trước khi gán vai trò mới',
          to: '/admin/permissions',
          tone: 'info',
        },
      ],
    };
  }, [data]);

  return (
    <div className="admin-overview-pro">
      <section className="admin-overview-hero">
        <div className="admin-overview-hero__copy">
          <span className="admin-overview-eyebrow">
            <LayoutGrid size={16} strokeWidth={2.3} aria-hidden="true" />
            Trung tâm quản trị
          </span>
          <h1>Tổng quan quản trị</h1>
          <p>
            Theo dõi sức khỏe nhân sự, vai trò, khoa phòng và tín hiệu bảo mật quan trọng trong một
            bảng điều khiển gọn, rõ và sẵn sàng vận hành.
          </p>
          <div className="admin-overview-hero__chips">
            <span><Activity size={15} strokeWidth={2.25} /> {view.loginRate}% tài khoản active</span>
            <span><Building2 size={15} strokeWidth={2.25} /> {view.departmentCoverage}% khoa/phòng có phụ trách</span>
            <span><FileClock size={15} strokeWidth={2.25} /> Cập nhật {formatCompactDate(lastUpdated)}</span>
          </div>
          {error ? (
            <p className="admin-overview-alert" role="alert">
              <AlertTriangle size={16} strokeWidth={2.35} aria-hidden="true" />
              {error}
            </p>
          ) : null}
        </div>

        <aside className="admin-overview-command" aria-label="Việc cần ưu tiên">
          <div className="admin-overview-command__head">
            <span><Sparkles size={16} strokeWidth={2.35} aria-hidden="true" /> Ưu tiên hôm nay</span>
            {isLoading ? <RefreshCw className="admin-overview-spin" size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
          </div>
          <div className="admin-overview-priority-list">
            {view.priorityItems.map((item) => (
              <Link key={item.label} to={item.to} className={`admin-overview-priority admin-overview-priority--${item.tone}`}>
                <span>{item.value}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
                <ArrowUpRight size={16} strokeWidth={2.3} aria-hidden="true" />
              </Link>
            ))}
          </div>
          <div className="admin-overview-actions">
            <Link to="/admin/staff/create" className="admin-overview-action admin-overview-action--primary">
              <UserPlus size={16} strokeWidth={2.3} aria-hidden="true" />
              Tạo nhân sự
            </Link>
            <Link to="/admin/roles/create" className="admin-overview-action">
              <ShieldCheck size={16} strokeWidth={2.3} aria-hidden="true" />
              Tạo vai trò
            </Link>
            <Link to="/admin/logs/audit" className="admin-overview-action">
              <FileClock size={16} strokeWidth={2.3} aria-hidden="true" />
              Xem audit
            </Link>
          </div>
        </aside>
      </section>

      <section className="admin-overview-health" aria-label="Tín hiệu hệ thống">
        {view.healthSignals.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={`admin-overview-health-card admin-overview-health-card--${item.tone}`}>
              <span className="admin-overview-health-card__icon"><Icon size={18} strokeWidth={2.35} aria-hidden="true" /></span>
              <div>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="admin-metrics admin-metrics--overview">
        {view.metricCards.map((item) => {
          const Icon = item.icon;
          const metricHref =
            item.key === 'total_staff'
              ? '/admin/staff'
              : item.key === 'active'
                ? '/admin/staff?status=active'
                : item.key === 'locked'
                  ? '/admin/staff?status=locked'
                  : item.key === 'new_created'
                    ? '/admin/staff?sort=created_at_desc'
                    : item.key === 'roles'
                      ? '/admin/roles'
                      : item.key === 'permissions'
                        ? '/admin/permissions'
                        : item.key === 'departments'
                          ? '/admin/facilities/departments'
                          : null;

          const content = (
            <>
              <div className="admin-metric-card__top">
                <span className="admin-metric-card__icon"><Icon size={20} strokeWidth={2.35} aria-hidden="true" /></span>
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

      <section className="admin-overview-grid">
        <article className="admin-overview-panel admin-overview-panel--table">
          <div className="admin-overview-panel__head">
            <h2>Nhân sự mới tạo</h2>
            <Link to="/admin/staff">Xem tất cả <ArrowUpRight size={14} strokeWidth={2.35} /></Link>
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
                <span className={`admin-status-badge admin-status-badge--${item.status || 'active'}`}>
                  {STATUS_LABELS[item.status] || item.status || 'Hoạt động'}
                </span>
              </div>
            ))}
            {!data.staff.length ? (
              <div className="admin-overview-empty">
                <UsersRound size={20} strokeWidth={2.25} aria-hidden="true" />
                <span>{isLoading ? 'Đang tải danh sách nhân sự...' : 'Chưa có nhân sự mới để hiển thị.'}</span>
              </div>
            ) : null}
          </div>
        </article>

        <article className="admin-overview-panel admin-overview-panel--activity">
          <div className="admin-overview-panel__head">
            <h2>Hoạt động gần đây</h2>
            <span>{formatNumber(data.audit.length)} sự kiện</span>
          </div>
          <div className="admin-activity-list">
            {data.audit.map((item, index) => (
              <div key={`${item._id || item.action}-${index}`} className="admin-activity-item">
                <div className={`admin-activity-item__icon admin-activity-item__icon--${item.status || 'success'}`}>
                  {item.status === 'failed' ? <AlertTriangle size={16} strokeWidth={2.35} /> : <ClipboardCheck size={16} strokeWidth={2.35} />}
                </div>
                <div>
                  <strong>{item.message || item.action}</strong>
                  <span>{formatCompactDate(item.created_at)} • {item.target_type || 'Hệ thống'}</span>
                </div>
              </div>
            ))}
            {!data.audit.length ? (
              <div className="admin-overview-empty admin-overview-empty--compact">
                <FileClock size={20} strokeWidth={2.25} aria-hidden="true" />
                <span>{isLoading ? 'Đang tải nhật ký...' : 'Chưa có hoạt động gần đây.'}</span>
              </div>
            ) : null}
          </div>
          <Link to="/admin/logs/audit" className="admin-overview-panel__ghost-link">
            Mở nhật ký audit <ArrowUpRight size={14} strokeWidth={2.35} />
          </Link>
        </article>
      </section>

      <section className="admin-overview-analytics">
        <article className="admin-overview-panel">
          <div className="admin-overview-panel__head"><h2>Nhân sự theo khoa/phòng</h2></div>
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
            {!view.topDepartments.length ? (
              <div className="admin-overview-empty admin-overview-empty--compact">
                <Building2 size={20} strokeWidth={2.25} aria-hidden="true" />
                <span>Chưa có dữ liệu phân bổ khoa/phòng.</span>
              </div>
            ) : null}
          </div>
        </article>

        <article className="admin-overview-panel">
          <div className="admin-overview-panel__head"><h2>Nhân sự theo vai trò</h2></div>
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
              {!view.roleSegments.length ? (
                <div>
                  <span style={{ backgroundColor: '#cbd5e1' }} />
                  <strong>Chưa có vai trò</strong>
                </div>
              ) : null}
            </div>
          </div>
        </article>

        <article className="admin-overview-panel">
          <div className="admin-overview-panel__head"><h2>Trạng thái tài khoản</h2></div>
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
            <div className="admin-status-chart__note"><Activity size={16} strokeWidth={2.35} /><strong>{view.loginRate}% tài khoản đang hoạt động</strong></div>
          </div>
        </article>
      </section>
    </div>
  );
}
