import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Filter,
  Fingerprint,
  KeyRound,
  ListChecks,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  UserCog,
  UserLock,
  UserPlus,
  UsersRound,
  Wifi,
  X,
} from 'lucide-react';
import {
  activateStaffAccount,
  bulkStaffAction,
  deactivateStaffAccount,
  forceLogoutStaff,
  getAssignableRoles,
  getDepartments,
  getPendingActivationAccounts,
  getRiskAccounts,
  getStaffAccounts,
  getStaffAccountDetail,
  getStaffAuditLogs,
  getStaffDependencies,
  getStaffPermissions,
  getStaffRiskProfile,
  getStaffSessions,
  getStaffSummary,
  requireStaffPasswordChange,
  resetStaffPassword,
  unlockStaffAccount,
} from '../staffApi';
import {
  formatCompactDate,
  formatDateTime,
  formatNumber,
  getInitials,
  getRiskLabel,
  getRiskTone,
  getStatusLabel,
  getStatusTone,
} from '../staffUi';
import { ResetPasswordDialog, StaffStatusDialog } from '../components/StaffDialogs';
import '../staffWorkforcePro.css';

const VIEW_TABS = [
  { id: 'all', label: 'Tất cả', icon: UsersRound },
  { id: 'profiles', label: 'Hồ sơ 360', icon: Fingerprint },
  { id: 'doctors', label: 'Bác sĩ', icon: Stethoscope },
  { id: 'pending', label: 'Chờ kích hoạt', icon: UserCheck },
  { id: 'locked', label: 'Bị khóa', icon: UserLock },
  { id: 'disabled', label: 'Vô hiệu hóa', icon: LockKeyhole },
  { id: 'risk', label: 'Rủi ro', icon: ShieldAlert },
];

const VIEW_COPY = {
  all: {
    eyebrow: 'Human Identity & Workforce Control Center',
    title: 'Tổ chức & nhân sự',
    subtitle: 'Kiểm soát tài khoản, vai trò, khoa/phòng, phiên đăng nhập, audit và rủi ro vận hành trong một màn hình.',
  },
  profiles: {
    eyebrow: 'Staff Profile Registry',
    title: 'Hồ sơ nhân sự 360',
    subtitle: 'Tập trung vào độ hoàn thiện hồ sơ, định danh, khoa/phòng, vai trò, liên hệ và credential readiness của từng nhân sự.',
  },
  doctors: {
    eyebrow: 'Clinical Workforce',
    title: 'Bác sĩ',
    subtitle: 'Lọc nhanh nhân sự có vai trò bác sĩ để kiểm tra khoa, hồ sơ chuyên môn, lịch và trạng thái tài khoản.',
  },
  pending: {
    eyebrow: 'Activation Queue',
    title: 'Tài khoản chờ kích hoạt',
    subtitle: 'Theo dõi tài khoản active nhưng chưa đăng nhập, còn bắt buộc đổi mật khẩu hoặc đang chờ bàn giao thông tin đăng nhập.',
  },
  locked: {
    eyebrow: 'Security Watch',
    title: 'Tài khoản bị khóa',
    subtitle: 'Tập trung xử lý failed login, locked_until, IP gần nhất và các hành động mở khóa/reset/force logout.',
  },
  disabled: {
    eyebrow: 'Dormant Identity',
    title: 'Tài khoản bị vô hiệu hóa',
    subtitle: 'Rà soát tài khoản suspended/disabled, dependency và audit trước khi kích hoạt lại hoặc xóa mềm.',
  },
  risk: {
    eyebrow: 'Risk Command',
    title: 'Tài khoản rủi ro',
    subtitle: 'Tổng hợp risk score từ failed login, phiên active, role nhạy cảm, thay đổi quyền và tuổi mật khẩu.',
  },
};

function resolveView(searchParams) {
  if (searchParams.get('risk')) return 'risk';
  if (searchParams.get('view') === 'profiles') return 'profiles';
  if (searchParams.get('role') === 'doctor' || searchParams.get('role_code') === 'doctor') return 'doctors';
  if (searchParams.get('status') === 'pending_activation') return 'pending';
  if (searchParams.get('status') === 'locked') return 'locked';
  if (['disabled', 'suspended'].includes(searchParams.get('status'))) return 'disabled';
  return 'all';
}

function buildQuery(filters, page, view) {
  const params = new URLSearchParams();
  params.set('limit', '12');
  params.set('page', String(page));
  params.set('sort_by', filters.sort_by || 'created_at');
  params.set('sort_order', filters.sort_order || 'desc');

  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.department_id) params.set('department_id', filters.department_id);
  if (filters.role_code) params.set('role_code', filters.role_code);
  if (filters.must_change_password) params.set('must_change_password', filters.must_change_password);
  if (filters.never_logged_in) params.set('never_logged_in', filters.never_logged_in);

  if (view === 'doctors' && !filters.role_code) params.set('role_code', 'doctor');
  if (view === 'locked') params.set('status', 'locked');
  if (view === 'disabled') params.set('status', filters.status || 'disabled');
  if (view === 'risk') {
    params.set('risk', filters.risk_level || 'high');
    params.set('min_score', filters.min_score || '35');
  } else if (filters.status && !['locked', 'disabled'].includes(view)) {
    params.set('status', filters.status);
  }

  return params.toString();
}

function normalizeAccount(item) {
  const source = item?.user || item || {};
  return {
    ...source,
    department_id: source.department_id || item?.department?.department_id || null,
    department_name: source.department_name || item?.department?.department_name || null,
    roles: item?.roles || source.roles || [],
    role_details: item?.role_details || source.role_details || [],
    active_session_count: source.active_session_count ?? item?.signals?.active_session_count ?? 0,
    failed_login_attempts: source.failed_login_attempts ?? item?.signals?.failed_login_attempts ?? 0,
    risk_profile: item?.risk_score !== undefined ? item : source.risk_profile,
    risk_level: item?.risk_level || source.risk_level,
    risk_score: item?.risk_score ?? source.risk_score,
  };
}

function departmentNameOf(staff, departments) {
  return staff.department_name ||
    staff.department?.department_name ||
    departments.find((department) => department.department_id === staff.department_id)?.department_name ||
    'Chưa gán khoa/phòng';
}


function roleNameOf(roleCode, roles = []) {
  const matched = roles.find((role) => role.role_code === roleCode);
  return matched?.role_name || String(roleCode || '').replaceAll('_', ' ') || 'Chưa gán';
}

function buildCsvValue(value) {
  const text = String(value ?? '').replaceAll('"', '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function DownloadCsvButton({ accounts, departments, disabled }) {
  function exportCurrentPageCsv() {
    const header = ['Họ tên', 'Username', 'Email', 'SĐT', 'Mã NV', 'Khoa/phòng', 'Vai trò', 'Trạng thái', 'Session active', 'Failed login', 'Last login', 'Ngày tạo'];
    const rows = accounts.map((item) => [
      item.full_name || item.username,
      item.username,
      item.email,
      item.phone,
      item.employee_code,
      departmentNameOf(item, departments),
      (item.roles || []).join('|'),
      isPendingActivation(item) ? 'pending_activation' : item.status,
      item.active_session_count || 0,
      item.failed_login_attempts || 0,
      item.last_login_at || '',
      item.created_at || '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(buildCsvValue).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `staff-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="staff-button staff-button--ghost" onClick={exportCurrentPageCsv} disabled={disabled || !accounts.length}>
      <Download size={16} strokeWidth={2.25} />
      <span>Export CSV</span>
    </button>
  );
}

function StaffCommandInsights({ summary, roles, departments, applyFilters }) {
  const roleRows = (summary?.role_breakdown || [])
    .filter((item) => Number(item.count) > 0)
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, 6);
  const departmentRows = (summary?.department_breakdown || [])
    .filter((item) => Number(item.count) > 0)
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, 6);
  const total = Math.max(Number(summary?.total || 0), 1);

  return (
    <section className="staff-command-intelligence">
      <article className="staff-command-intelligence__card staff-command-intelligence__card--blue">
        <div className="staff-intel-card__header">
          <span><Fingerprint size={16} strokeWidth={2.25} /> Identity health</span>
          <strong>{Math.round(((summary?.active || 0) / total) * 100)}%</strong>
        </div>
        <div className="staff-intel-progress"><span style={{ width: `${Math.min(((summary?.active || 0) / total) * 100, 100)}%` }} /></div>
        <div className="staff-intel-grid">
          <button type="button" onClick={() => applyFilters({ status: 'active' })}>Active <b>{formatNumber(summary?.active)}</b></button>
          <button type="button" onClick={() => applyFilters({ status: 'locked' })}>Locked <b>{formatNumber(summary?.locked)}</b></button>
          <button type="button" onClick={() => applyFilters({ status: 'disabled' })}>Disabled <b>{formatNumber(summary?.disabled)}</b></button>
          <button type="button" onClick={() => applyFilters({ never_logged_in: 'true' })}>Never login <b>{formatNumber(summary?.never_logged_in_count)}</b></button>
        </div>
      </article>

      <article className="staff-command-intelligence__card">
        <div className="staff-intel-card__header">
          <span><UserCog size={16} strokeWidth={2.25} /> Role coverage</span>
          <small>{roleRows.length} nhóm đang có người dùng</small>
        </div>
        <div className="staff-intel-list">
          {roleRows.length ? roleRows.map((item) => (
            <button key={item.role_code} type="button" onClick={() => applyFilters({ role_code: item.role_code })}>
              <span>{roleNameOf(item.role_code, roles)}</span>
              <b>{formatNumber(item.count)}</b>
            </button>
          )) : <p>Chưa có dữ liệu role từ backend.</p>}
        </div>
      </article>

      <article className="staff-command-intelligence__card">
        <div className="staff-intel-card__header">
          <span><Building2 size={16} strokeWidth={2.25} /> Department load</span>
          <small>{departments.length} khoa/phòng</small>
        </div>
        <div className="staff-intel-list">
          {departmentRows.length ? departmentRows.map((item) => (
            <button key={item.department_id} type="button" onClick={() => applyFilters({ department_id: item.department_id })}>
              <span>{item.department_name}</span>
              <b>{formatNumber(item.count)}</b>
            </button>
          )) : <p>Chưa có dữ liệu khoa/phòng từ backend.</p>}
        </div>
      </article>
    </section>
  );
}

function StaffTableSkeleton() {
  return (
    <div className="staff-table-skeleton" aria-label="Đang tải danh sách nhân sự">
      {Array.from({ length: 6 }).map((_, index) => <span key={index} />)}
    </div>
  );
}

function MiniMetric({ icon: Icon, label, value, tone = 'blue', hint }) {
  return (
    <article className={`staff-command-metric staff-command-metric--${tone}`}>
      <span className="staff-command-metric__icon" aria-hidden="true">
        <Icon size={19} strokeWidth={2.25} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {hint ? <em>{hint}</em> : null}
      </div>
    </article>
  );
}

function RoleChips({ roles = [], onClickRole }) {
  if (!roles.length) return <span className="staff-soft-badge staff-soft-badge--muted">Chưa gán role</span>;
  return (
    <div className="staff-role-badges staff-role-badges--list">
      {roles.slice(0, 3).map((role) => (
        <button key={role} type="button" onClick={() => onClickRole(role)}>
          {String(role).replaceAll('_', ' ')}
        </button>
      ))}
      {roles.length > 3 ? <span>+{roles.length - 3}</span> : null}
    </div>
  );
}

function SecurityStack({ staff }) {
  const riskTone = getRiskTone(staff.risk_level || staff.risk_profile?.risk_level);
  const riskLabel = staff.risk_score !== undefined ? `${getRiskLabel(staff.risk_level)} ${staff.risk_score}` : null;

  return (
    <div className="staff-security-stack">
      {riskLabel ? <span className={`staff-risk-chip staff-risk-chip--${riskTone}`}>{riskLabel}</span> : null}
      {staff.must_change_password ? <span>Phải đổi mật khẩu</span> : <span>Credential ổn định</span>}
      {(staff.failed_login_attempts || 0) > 0 ? <strong>{staff.failed_login_attempts} failed login</strong> : null}
    </div>
  );
}

function isPendingActivation(staff = {}) {
  return staff.activation_status === 'pending_activation';
}

function StaffInspector({ inspector, activeTab, setActiveTab, onClose, onAction, actionNotice, pendingAction }) {
  if (!inspector) return null;

  const staff = inspector.staff || {};
  const detailUser = inspector.detail?.user || staff;
  const roles = inspector.detail?.roles || staff.role_details || staff.roles || [];
  const permissions = inspector.permissions?.permissions || inspector.detail?.permissions || [];
  const sessions = inspector.sessions?.items || [];
  const deps = inspector.dependencies || {};
  const risk = inspector.risk || {};
  const audit = inspector.audit?.items || [];
  const activeSessions = sessions.filter((session) => session.is_active).length;
  const roleList = Array.isArray(roles) ? roles : [];
  const isForceLogoutBusy = pendingAction === `force_logout:${staff.user_id}`;
  const isPasswordBusy = pendingAction === `require_password_change:${staff.user_id}`;
  const tabs = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'security', label: 'Bảo mật' },
    { id: 'roles', label: 'Vai trò & quyền' },
    { id: 'sessions', label: 'Phiên đăng nhập' },
    { id: 'dependencies', label: 'Phụ thuộc' },
    { id: 'audit', label: 'Audit' },
  ];

  return (
    <aside className="staff-inspector staff-inspector--pro" aria-label="Staff detail drawer">
      <div className="staff-inspector__scrim" onClick={onClose} role="presentation" />
      <section className="staff-inspector__panel staff-inspector__panel--pro">
        <header className="staff-inspector-pro-head">
          <div className="staff-inspector-pro-head__identity">
            <div className="staff-inspector-pro-avatar">{getInitials(detailUser.full_name || detailUser.username)}</div>
            <div>
              <small>STAFF 360 COMMAND PROFILE</small>
              <h2>{detailUser.full_name || detailUser.username}</h2>
              <p>{detailUser.username} · {detailUser.employee_code || 'Chưa có mã nhân sự'}</p>
            </div>
          </div>
          <button type="button" className="staff-icon-button" onClick={onClose} aria-label="Đóng">
            <X size={18} strokeWidth={2.3} />
          </button>
        </header>

        <section className="staff-inspector-pro-summary">
          <div>
            <small>Trạng thái</small>
            <strong className={`staff-status-dot staff-status-dot--${getStatusTone(detailUser.status)}`}><span />{getStatusLabel(detailUser.status)}</strong>
          </div>
          <div>
            <small>Khoa/phòng</small>
            <strong>{detailUser.department_name || staff.department_name || 'Chưa gán'}</strong>
          </div>
          <div>
            <small>Vai trò</small>
            <strong>{roleList.length || staff.role_count || 0}</strong>
          </div>
          <div>
            <small>Risk</small>
            <strong className={`staff-risk-chip staff-risk-chip--${getRiskTone(risk.risk_level || 'low')}`}>{risk.risk_score ?? 0}</strong>
          </div>
          <div>
            <small>Active session</small>
            <strong>{activeSessions}</strong>
          </div>
        </section>

        <section className="staff-inspector-pro-actions">
          <Link to={`/admin/staff/${staff.user_id}`} className="staff-button staff-button--primary">Mở hồ sơ đầy đủ</Link>
          <button type="button" onClick={() => onAction('force_logout', staff)} disabled={isForceLogoutBusy}>
            <LogOut size={15} strokeWidth={2.25} />
            {isForceLogoutBusy ? 'Đang thu hồi...' : 'Force logout'}
          </button>
          <button type="button" onClick={() => onAction('require_password_change', staff)} disabled={isPasswordBusy}>
            <KeyRound size={15} strokeWidth={2.25} />
            {isPasswordBusy ? 'Đang cập nhật...' : 'Bắt đổi mật khẩu'}
          </button>
        </section>

        {actionNotice ? (
          <div className={`staff-inspector-pro-notice staff-inspector-pro-notice--${actionNotice.tone}`}>
            <CheckCircle2 size={18} strokeWidth={2.5} />
            <div>
              <strong>{actionNotice.title}</strong>
              <span>{actionNotice.message}</span>
            </div>
          </div>
        ) : null}

        <nav className="staff-inspector-pro-tabs" aria-label="Staff drawer tabs">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={activeTab === tab.id ? 'is-active' : ''} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        {inspector.loading ? (
          <div className="staff-inspector__loading">Đang tải dữ liệu 360...</div>
        ) : (
          <div className="staff-inspector-pro-body">
            {activeTab === 'overview' ? (
              <>
                <div className="staff-inspector-pro-section-title">
                  <h3>Thông tin định danh</h3>
                  <span>Dữ liệu trực tiếp từ backend staff account</span>
                </div>
                <div className="staff-inspector-pro-grid">
                  {[
                    ['Email', detailUser.email || 'Chưa có'],
                    ['Số điện thoại', detailUser.phone || 'Chưa có'],
                    ['Auth provider', detailUser.auth_provider || staff.auth_provider || 'local'],
                    ['Lần đăng nhập cuối', formatDateTime(detailUser.last_login_at)],
                    ['Ngày tạo', formatDateTime(detailUser.created_at)],
                    ['Bắt đổi mật khẩu', detailUser.must_change_password ? 'Có' : 'Không'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {activeTab === 'security' ? (
              <div className="staff-inspector-pro-stack">
                <div className={`staff-inspector-risk-card staff-inspector-risk-card--${getRiskTone(risk.risk_level || 'low')}`}>
                  <div>
                    <small>Risk score</small>
                    <strong>{risk.risk_score ?? 0}</strong>
                    <span>{getRiskLabel(risk.risk_level || 'low')}</span>
                  </div>
                  <ShieldAlert size={32} strokeWidth={2.1} />
                </div>
                <div className="staff-inspector-pro-list">
                  {(risk.reasons || ['Không có tín hiệu rủi ro đáng kể từ backend.']).map((reason) => (
                    <span key={reason}>{reason}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === 'roles' ? (
              <div className="staff-inspector-pro-stack">
                <div className="staff-inspector-pro-section-title">
                  <h3>Vai trò được gán</h3>
                  <span>{roleList.length} vai trò · {permissions.length} quyền hiệu lực</span>
                </div>
                <div className="staff-inspector-role-grid">
                  {roleList.map((role) => (
                    <div key={role.role_code || role}>
                      <strong>{role.role_name || String(role).replaceAll('_', ' ')}</strong>
                      <span>{role.role_code || 'role'}</span>
                    </div>
                  ))}
                </div>
                <div className="staff-permission-cloud staff-permission-cloud--pro">
                  {permissions.slice(0, 48).map((permission) => <span key={permission}>{permission}</span>)}
                  {permissions.length > 48 ? <strong>+{permissions.length - 48} quyền khác</strong> : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'sessions' ? (
              <div className="staff-inspector-pro-stack">
                <div className="staff-inspector-pro-section-title">
                  <h3>Phiên đăng nhập</h3>
                  <span>{activeSessions} phiên active / {sessions.length} phiên được trả về</span>
                </div>
                {sessions.length ? sessions.map((session) => (
                  <div key={session.session_id || session.created_at} className="staff-session-row staff-session-row--pro">
                    <MonitorMeta session={session} />
                    <span className={session.is_active ? 'is-active' : ''}>{session.is_active ? 'Active' : 'Revoked'}</span>
                  </div>
                )) : <p className="staff-empty-state">Backend chưa trả session nào cho nhân sự này.</p>}
              </div>
            ) : null}

            {activeTab === 'dependencies' ? (
              <div className="staff-inspector-pro-stack">
                <div className={`staff-dependency-verdict staff-dependency-verdict--pro ${deps?.can_delete ? 'is-clear' : 'is-blocked'}`}>
                  <strong>{deps?.can_delete ? 'Không có blocker nghiệp vụ' : 'Có blocker cần xử lý'}</strong>
                  <span>Delete: {deps?.can_delete ? 'Có thể' : 'Không'} · Transfer: {deps?.can_transfer ? 'Có thể' : 'Không'}</span>
                </div>
                <div className="staff-inspector-pro-grid">
                  {Object.entries(deps?.blockers || {}).map(([key, value]) => (
                    <div key={key}>
                      <span>{key.replaceAll('_', ' ')}</span>
                      <strong>{String(value ?? 0)}</strong>
                    </div>
                  ))}
                </div>
                <div className="staff-inspector-pro-list">
                  {(deps?.blocking_reasons || deps?.recommendations || ['Không có khuyến nghị bổ sung.']).map((item) => <span key={item}>{item}</span>)}
                </div>
              </div>
            ) : null}

            {activeTab === 'audit' ? (
              <div className="staff-inspector-pro-stack">
                {audit.length ? audit.slice(0, 10).map((item, index) => (
                  <div key={`${item._id || item.created_at}-${index}`} className="staff-audit-row staff-audit-row--pro">
                    <span>{formatDateTime(item.created_at)}</span>
                    <strong>{item.message || item.action}</strong>
                    <small>{item.action}</small>
                  </div>
                )) : <p className="staff-empty-state">Chưa có audit log hoặc tài khoản hiện tại chưa đủ quyền đọc audit.</p>}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </aside>
  );
}


function StaffViewDifferentiator({ view, accounts, summary, departments, applyFilters }) {
  const sample = accounts.slice(0, 6);
  const doctorCount = accounts.filter((item) => (item.roles || []).includes('doctor')).length;
  const pendingCount = accounts.filter(isPendingActivation).length;
  const lockedCount = accounts.filter((item) => item.status === 'locked').length;
  const riskCount = accounts.filter((item) => ['high', 'critical'].includes(item.risk_level || item.risk_profile?.risk_level)).length;

  if (view === 'profiles') {
    return (
      <section className="staff-view-signature staff-view-signature--profiles">
        <div className="staff-view-signature__intro">
          <span><Fingerprint size={16} /> Profile completeness</span>
          <h2>Bảng kiểm hồ sơ nhân sự 360</h2>
          <p>Màn hình này khác danh sách tổng: ưu tiên chất lượng hồ sơ, định danh, liên hệ, mã nhân viên, khoa/phòng và vai trò để chuẩn bị cho Staff 360.</p>
        </div>
        <div className="staff-profile-board">
          {sample.map((item) => {
            const scoreParts = [item.full_name, item.email, item.phone, item.employee_code, item.department_id, (item.roles || []).length].filter(Boolean).length;
            const score = Math.round((scoreParts / 6) * 100);
            return (
              <article key={item.user_id} className="staff-profile-card">
                <div className="staff-profile-card__head">
                  <div className="admin-avatar">{getInitials(item.full_name || item.username)}</div>
                  <div><strong>{item.full_name || item.username}</strong><small>{item.employee_code || 'Thiếu mã NV'}</small></div>
                  <b>{score}%</b>
                </div>
                <div className="staff-profile-card__meter"><span style={{ width: `${score}%` }} /></div>
                <div className="staff-profile-card__grid">
                  <span className={item.email ? 'is-ok' : 'is-missing'}>Email</span>
                  <span className={item.phone ? 'is-ok' : 'is-missing'}>SĐT</span>
                  <span className={item.department_id ? 'is-ok' : 'is-missing'}>Khoa</span>
                  <span className={(item.roles || []).length ? 'is-ok' : 'is-missing'}>Role</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  if (view === 'doctors') {
    return (
      <section className="staff-view-signature staff-view-signature--doctor">
        <div className="staff-view-signature__intro">
          <span><Stethoscope size={16} /> Clinical roster</span>
          <h2>Roster bác sĩ theo khoa và readiness lâm sàng</h2>
          <p>Tập trung vào bác sĩ: khoa đang công tác, trạng thái đăng nhập, session active và mức sẵn sàng vận hành phòng khám.</p>
        </div>
        <div className="staff-doctor-lanes">
          {departments.slice(0, 5).map((department) => {
            const count = accounts.filter((item) => item.department_id === department.department_id).length;
            return <button key={department.department_id} type="button" onClick={() => applyFilters({ department_id: department.department_id })}><Building2 size={16} /><span>{department.department_name}</span><strong>{formatNumber(count)}</strong></button>;
          })}
          <button type="button" onClick={() => applyFilters({ role_code: 'doctor' })}><Stethoscope size={16} /><span>Tất cả bác sĩ</span><strong>{formatNumber(doctorCount || summary?.doctor_count)}</strong></button>
        </div>
      </section>
    );
  }

  if (view === 'pending') {
    return (
      <section className="staff-view-signature staff-view-signature--pending">
        <div className="staff-view-signature__intro">
          <span><Clock3 size={16} /> Activation funnel</span>
          <h2>Luồng kích hoạt tài khoản mới</h2>
          <p>Ưu tiên tài khoản chưa từng đăng nhập, còn phải đổi mật khẩu, thiếu email/SĐT hoặc cần bàn giao thông tin đăng nhập.</p>
        </div>
        <div className="staff-activation-steps">
          <button type="button" onClick={() => applyFilters({ never_logged_in: 'true' })}><strong>{formatNumber(pendingCount || summary?.pending_activation_count)}</strong><span>Chưa login</span></button>
          <button type="button" onClick={() => applyFilters({ must_change_password: 'true' })}><strong>{formatNumber(summary?.must_change_password_count)}</strong><span>Phải đổi mật khẩu</span></button>
          <button type="button" onClick={() => applyFilters({ status: 'active' })}><strong>{formatNumber(summary?.active)}</strong><span>Đã active</span></button>
        </div>
      </section>
    );
  }

  if (view === 'locked' || view === 'risk') {
    return (
      <section className={`staff-view-signature staff-view-signature--${view}`}>
        <div className="staff-view-signature__intro">
          <span>{view === 'locked' ? <UserLock size={16} /> : <ShieldAlert size={16} />} Security queue</span>
          <h2>{view === 'locked' ? 'Bàn xử lý tài khoản bị khóa' : 'Bảng săn tài khoản rủi ro cao'}</h2>
          <p>Không chỉ là danh sách: gom failed login, session active, credential flag và hành động nhanh reset / unlock / force logout.</p>
        </div>
        <div className="staff-security-pulse">
          <div><UserLock size={18} /><span>Locked</span><strong>{formatNumber(lockedCount || summary?.locked)}</strong></div>
          <div><ShieldAlert size={18} /><span>High risk</span><strong>{formatNumber(riskCount || summary?.risk_account_count)}</strong></div>
          <div><KeyRound size={18} /><span>Credential review</span><strong>{formatNumber(summary?.must_change_password_count)}</strong></div>
        </div>
      </section>
    );
  }

  return (
    <section className="staff-view-signature staff-view-signature--all">
      <div className="staff-view-signature__intro">
        <span><UsersRound size={16} /> Workforce cockpit</span>
        <h2>Toàn cảnh nhân sự theo vai trò, khoa/phòng và trạng thái tài khoản</h2>
        <p>Dùng màn hình tổng để điều hướng nhanh sang hồ sơ 360, bác sĩ, hàng chờ kích hoạt, locked và risk queue.</p>
      </div>
      <div className="staff-workforce-snapshot">
        <button type="button" onClick={() => applyFilters({ status: 'active' })}><CheckCircle2 size={17} /> Active <b>{formatNumber(summary?.active)}</b></button>
        <button type="button" onClick={() => applyFilters({ status: 'locked' })}><UserLock size={17} /> Locked <b>{formatNumber(summary?.locked)}</b></button>
        <button type="button" onClick={() => applyFilters({ role_code: 'doctor' })}><Stethoscope size={17} /> Doctors <b>{formatNumber(doctorCount || summary?.doctor_count)}</b></button>
      </div>
    </section>
  );
}

function MonitorMeta({ session }) {
  return (
    <div>
      <strong>{session.device_name || session.browser || 'Thiết bị đăng nhập'}</strong>
      <small>
        {[session.os, session.last_ip || session.ip_address, formatDateTime(session.last_used_at || session.created_at)]
          .filter(Boolean)
          .join(' · ')}
      </small>
    </div>
  );
}

export function StaffListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = resolveView(searchParams);
  const copy = VIEW_COPY[view] || VIEW_COPY.all;
  const [filters, setFilters] = useState({
    keyword: searchParams.get('keyword') || '',
    role_code: searchParams.get('role') || searchParams.get('role_code') || '',
    department_id: searchParams.get('department') || searchParams.get('department_id') || '',
    status: ['locked', 'disabled', 'suspended'].includes(searchParams.get('status')) ? searchParams.get('status') : '',
    risk_level: searchParams.get('risk') || '',
    must_change_password: '',
    never_logged_in: '',
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [inspector, setInspector] = useState(null);
  const [inspectorTab, setInspectorTab] = useState('overview');
  const [actionNotice, setActionNotice] = useState(null);
  const [pendingAction, setPendingAction] = useState('');

  useEffect(() => {
    let active = true;

    async function loadMeta() {
      try {
        const [summaryData, rolesData, departmentsData] = await Promise.all([
          getStaffSummary(),
          getAssignableRoles(),
          getDepartments(),
        ]);

        if (!active) return;
        setSummary(summaryData);
        setRoles(rolesData?.items || []);
        setDepartments(departmentsData?.items || []);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      }
    }

    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const modal = searchParams.get('modal');
    const userId = searchParams.get('userId');
    if (!modal || !userId || accounts.length === 0) return;
    const matched = accounts.find((item) => item.user_id === userId);
    if (matched) setDialog({ type: modal, staff: matched });
  }, [accounts, searchParams]);

  useEffect(() => {
    let active = true;

    async function loadAccounts() {
      setLoading(true);
      setError('');

      try {
        const query = buildQuery(appliedFilters, page, view);
        const result = view === 'risk'
          ? await getRiskAccounts(query)
          : view === 'pending'
            ? await getPendingActivationAccounts(query)
            : await getStaffAccounts(query);

        if (!active) return;
        const items = (result?.items || []).map(normalizeAccount);
        setAccounts(items);
        setPagination(result?.pagination || { page: 1, total_pages: 1, total: items.length });
        setSelectedIds([]);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAccounts();
    return () => {
      active = false;
    };
  }, [appliedFilters, page, view]);

  const metrics = useMemo(() => [
    { label: 'Tổng nhân sự', value: formatNumber(summary?.total), icon: UsersRound, tone: 'blue', hint: 'toàn hệ thống' },
    { label: 'Active', value: formatNumber(summary?.active), icon: CheckCircle2, tone: 'green', hint: 'đang dùng' },
    { label: 'Locked', value: formatNumber(summary?.locked), icon: UserLock, tone: 'red', hint: 'cần xử lý' },
    { label: 'Chờ kích hoạt', value: formatNumber(summary?.pending_activation_count), icon: Clock3, tone: 'amber', hint: 'chưa login' },
    { label: 'Có session', value: formatNumber(summary?.active_session_count), icon: Activity, tone: 'cyan', hint: 'đang online' },
    { label: 'Role nhạy cảm', value: formatNumber(summary?.high_privilege_count), icon: ShieldCheck, tone: 'violet', hint: 'admin/head' },
    { label: 'Risk', value: formatNumber(summary?.risk_account_count), icon: ShieldAlert, tone: 'rose', hint: 'cần review' },
  ], [summary]);
  const totalPages = Math.max(pagination.total_pages || pagination.totalPages || 1, 1);

  function updateSearch(nextFilters) {
    const params = new URLSearchParams(searchParams);
    ['keyword', 'role', 'role_code', 'department', 'department_id', 'status', 'risk', 'view'].forEach((key) => params.delete(key));
    if (view === 'profiles') params.set('view', 'profiles');
    if (nextFilters.keyword) params.set('keyword', nextFilters.keyword);
    if (nextFilters.role_code) params.set('role', nextFilters.role_code);
    if (nextFilters.department_id) params.set('department', nextFilters.department_id);
    if (view === 'risk' && nextFilters.risk_level) params.set('risk', nextFilters.risk_level);
    if (nextFilters.status) params.set('status', nextFilters.status);
    setSearchParams(params);
  }

  function applyFilters(nextFilters = filters) {
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
    updateSearch(nextFilters);
  }

  function switchView(nextView) {
    const params = new URLSearchParams();
    if (nextView === 'profiles') params.set('view', 'profiles');
    if (nextView === 'doctors') params.set('role', 'doctor');
    if (nextView === 'pending') params.set('status', 'pending_activation');
    if (nextView === 'locked') params.set('status', 'locked');
    if (nextView === 'disabled') params.set('status', 'disabled');
    if (nextView === 'risk') params.set('risk', 'high');
    const nextFilters = {
      ...filters,
      role_code: nextView === 'doctors' ? 'doctor' : '',
      status: nextView === 'locked' ? 'locked' : nextView === 'disabled' ? 'disabled' : '',
      risk_level: nextView === 'risk' ? 'high' : '',
    };
    setPage(1);
    setSearchParams(params);
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }

  function resetFilters() {
    const nextFilters = {
      keyword: '',
      role_code: view === 'doctors' ? 'doctor' : '',
      department_id: '',
      status: view === 'locked' ? 'locked' : view === 'disabled' ? 'disabled' : '',
      risk_level: view === 'risk' ? 'high' : '',
      must_change_password: '',
      never_logged_in: '',
      sort_by: 'created_at',
      sort_order: 'desc',
    };
    const params = new URLSearchParams();
    if (view === 'profiles') params.set('view', 'profiles');
    if (view === 'doctors') params.set('role', 'doctor');
    if (view === 'pending') params.set('status', 'pending_activation');
    if (view === 'locked') params.set('status', 'locked');
    if (view === 'disabled') params.set('status', 'disabled');
    if (view === 'risk') params.set('risk', 'high');
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
    setSearchParams(params);
  }

  function openDialog(type, staff) {
    const params = new URLSearchParams(searchParams);
    params.set('modal', type);
    params.set('userId', staff.user_id);
    setSearchParams(params);
    setDialog({ type, staff });
  }

  function closeDialog() {
    const params = new URLSearchParams(searchParams);
    params.delete('modal');
    params.delete('userId');
    setSearchParams(params);
    setDialog(null);
  }

  async function refreshAccounts() {
    const result = view === 'risk'
      ? await getRiskAccounts(buildQuery(appliedFilters, page, view))
      : view === 'pending'
        ? await getPendingActivationAccounts(buildQuery(appliedFilters, page, view))
        : await getStaffAccounts(buildQuery(appliedFilters, page, view));
    setAccounts((result?.items || []).map(normalizeAccount));
    setPagination(result?.pagination || pagination);
    setSummary(await getStaffSummary());
  }

  async function handleStatusAction(action, staff) {
    setSubmitting(true);
    try {
      if (action === 'activate') await activateStaffAccount(staff.user_id);
      if (action === 'deactivate') await deactivateStaffAccount(staff.user_id);
      if (action === 'unlock') await unlockStaffAccount(staff.user_id);
      closeDialog();
      await refreshAccounts();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(payload) {
    if (!dialog?.staff) return;
    setSubmitting(true);
    try {
      await resetStaffPassword(dialog.staff.user_id, payload);
      closeDialog();
      await refreshAccounts();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDirectAction(action, staff) {
    setSubmitting(true);
    setPendingAction(`${action}:${staff.user_id}`);
    setError('');
    try {
      if (action === 'force_logout') await forceLogoutStaff(staff.user_id);
      if (action === 'require_password_change') await requireStaffPasswordChange(staff.user_id);
      await refreshAccounts();
      setActionNotice({ tone: 'success', title: action === 'force_logout' ? 'Đã force logout' : 'Đã yêu cầu đổi mật khẩu', message: action === 'force_logout' ? `Đã thu hồi phiên đăng nhập của ${staff.full_name || staff.username}.` : `Đã bật yêu cầu đổi mật khẩu cho ${staff.full_name || staff.username}.` });
      if (inspector?.staff?.user_id === staff.user_id) await openInspector(staff);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setPendingAction('');
      setSubmitting(false);
    }
  }

  async function handleBulk(action) {
    if (!selectedIds.length) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await bulkStaffAction({ action, user_ids: selectedIds });
      if (result?.failed) {
        const messages = (result.results || [])
          .filter((item) => !item.success)
          .map((item) => `${item.user_id}: ${item.message || 'Không rõ lỗi'}`)
          .join('; ');
        throw new Error(messages || `${result.failed} tài khoản xử lý thất bại.`);
      }
      setSelectedIds([]);
      await refreshAccounts();
      setActionNotice({ tone: 'success', title: 'Đã xử lý tác vụ hàng loạt', message: `${selectedIds.length} tài khoản đã được gửi lệnh ${action}.` });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function openInspector(staff) {
    setInspectorTab('overview');
    setInspector({ staff, loading: true });
    const loaders = await Promise.allSettled([
      getStaffAccountDetail(staff.user_id),
      getStaffSessions(staff.user_id, 'limit=8'),
      getStaffDependencies(staff.user_id),
      getStaffRiskProfile(staff.user_id),
      getStaffPermissions(staff.user_id),
      getStaffAuditLogs(staff.user_id, 'limit=8'),
    ]);
    setInspector({
      staff,
      loading: false,
      detail: loaders[0].status === 'fulfilled' ? loaders[0].value : null,
      sessions: loaders[1].status === 'fulfilled' ? loaders[1].value : null,
      dependencies: loaders[2].status === 'fulfilled' ? loaders[2].value : null,
      risk: loaders[3].status === 'fulfilled' ? loaders[3].value : staff.risk_profile || null,
      permissions: loaders[4].status === 'fulfilled' ? loaders[4].value : null,
      audit: loaders[5].status === 'fulfilled' ? loaders[5].value : null,
    });
  }

  function toggleSelected(userId) {
    setSelectedIds((current) => current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]);
  }

  function toggleAllVisible(checked) {
    setSelectedIds(checked ? accounts.map((item) => item.user_id) : []);
  }

  return (
    <>
      <section className="staff-command-hero">
        <div className="staff-command-hero__copy">
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>

        <div className="staff-command-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={refreshAccounts}>
            <RefreshCw size={16} strokeWidth={2.25} />
            <span>Làm mới</span>
          </button>
          <DownloadCsvButton accounts={accounts} departments={departments} disabled={loading} />
          <Link to="/admin/staff/create" className="staff-button staff-button--primary">
            <UserPlus size={16} strokeWidth={2.25} />
            <span>Tạo nhân sự</span>
          </Link>
        </div>
      </section>

      <section className="staff-command-tabs" aria-label="Organization staff views">
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" className={view === tab.id ? 'is-active' : ''} onClick={() => switchView(tab.id)}>
              <Icon size={16} strokeWidth={2.25} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </section>

      <section className="staff-command-metrics">
        {metrics.map((item) => <MiniMetric key={item.label} {...item} />)}
      </section>

      <StaffCommandInsights
        summary={summary}
        roles={roles}
        departments={departments}
        applyFilters={(partial) => applyFilters({ ...filters, ...partial })}
      />

      <StaffViewDifferentiator
        view={view}
        accounts={accounts}
        summary={summary}
        departments={departments}
        applyFilters={(partial) => applyFilters({ ...filters, ...partial })}
      />

      <section className="staff-command-filters">
        <label className="staff-command-search">
          <Search size={17} strokeWidth={2.2} />
          <input
            type="search"
            value={filters.keyword}
            onChange={(event) => {
              const next = { ...filters, keyword: event.target.value };
              setFilters(next);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyFilters();
            }}
            placeholder="Tìm tên, username, email, phone, mã nhân viên..."
          />
        </label>

        <div className="staff-command-filter-grid">
          <label>
            <Building2 size={15} strokeWidth={2.2} />
            <select value={filters.department_id} onChange={(event) => {
              const next = { ...filters, department_id: event.target.value };
              setFilters(next);
            }}>
              <option value="">Tất cả khoa/phòng</option>
              {departments.map((item) => <option key={item.department_id} value={item.department_id}>{item.department_name}</option>)}
            </select>
          </label>

          <label>
            <UserCog size={15} strokeWidth={2.2} />
            <select value={filters.role_code} onChange={(event) => {
              const next = { ...filters, role_code: event.target.value };
              setFilters(next);
            }}>
              <option value="">Tất cả vai trò</option>
              {roles.map((item) => <option key={item.role_code} value={item.role_code}>{item.role_name}</option>)}
            </select>
          </label>

          <label>
            <Filter size={15} strokeWidth={2.2} />
            <select value={filters.status} onChange={(event) => {
              const next = { ...filters, status: event.target.value };
              setFilters(next);
            }}>
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="locked">Bị khóa</option>
              <option value="suspended">Tạm ngưng</option>
              <option value="disabled">Vô hiệu hóa</option>
            </select>
          </label>

          <label>
            <ShieldAlert size={15} strokeWidth={2.2} />
            <select value={filters.risk_level} onChange={(event) => setFilters((current) => ({ ...current, risk_level: event.target.value }))}>
              <option value="">Risk bất kỳ</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label>
            <KeyRound size={15} strokeWidth={2.2} />
            <select value={filters.must_change_password} onChange={(event) => setFilters((current) => ({ ...current, must_change_password: event.target.value }))}>
              <option value="">Credential bất kỳ</option>
              <option value="true">Phải đổi mật khẩu</option>
              <option value="false">Đã ổn định</option>
            </select>
          </label>

          <label>
            <Wifi size={15} strokeWidth={2.2} />
            <select value={filters.never_logged_in} onChange={(event) => setFilters((current) => ({ ...current, never_logged_in: event.target.value }))}>
              <option value="">Login bất kỳ</option>
              <option value="true">Chưa từng login</option>
              <option value="false">Đã từng login</option>
            </select>
          </label>

          <label>
            <SlidersHorizontal size={15} strokeWidth={2.2} />
            <select value={`${filters.sort_by}:${filters.sort_order}`} onChange={(event) => {
              const [sort_by, sort_order] = event.target.value.split(':');
              setFilters((current) => ({ ...current, sort_by, sort_order }));
            }}>
              <option value="created_at:desc">Mới tạo trước</option>
              <option value="created_at:asc">Cũ tạo trước</option>
              <option value="full_name:asc">Tên A → Z</option>
              <option value="last_login_at:desc">Đăng nhập mới nhất</option>
              <option value="status:asc">Trạng thái</option>
            </select>
          </label>

          <button type="button" className="staff-filter-reset" onClick={resetFilters}>
            Reset
          </button>
          <button type="button" className="staff-button staff-button--primary" onClick={() => applyFilters()} disabled={loading}>
            <Search size={15} strokeWidth={2.2} />
            Áp dụng
          </button>
        </div>
      </section>

      {selectedIds.length ? (
        <section className="staff-bulk-bar">
          <strong>{selectedIds.length} tài khoản đã chọn</strong>
          <button type="button" onClick={() => handleBulk('force_logout')} disabled={submitting}>
            <LogOut size={15} strokeWidth={2.25} />
            Force logout
          </button>
          <button type="button" onClick={() => handleBulk('require_password_change')} disabled={submitting}>
            <KeyRound size={15} strokeWidth={2.25} />
            Bắt đổi mật khẩu
          </button>
          <button type="button" onClick={() => handleBulk('activate')} disabled={submitting}>
            <CheckCircle2 size={15} strokeWidth={2.25} />
            Kích hoạt
          </button>
          <button type="button" onClick={() => setSelectedIds([])}>
            <X size={15} strokeWidth={2.25} />
            Bỏ chọn
          </button>
        </section>
      ) : null}

      <section className="staff-command-table-panel">
        {error ? <p className="form-message error">{error}</p> : null}
        {actionNotice ? (
          <div className={`staff-action-notice staff-action-notice--${actionNotice.tone}`}>
            <strong>{actionNotice.title}</strong>
            <span>{actionNotice.message}</span>
            <button type="button" onClick={() => setActionNotice(null)}>×</button>
          </div>
        ) : null}

        {loading ? (
          <StaffTableSkeleton />
        ) : accounts.length === 0 ? (
          <div className="staff-empty-state">
            <div className="staff-empty-state__art"><Search size={30} strokeWidth={2.2} /></div>
            <h3>Không tìm thấy nhân sự phù hợp</h3>
            <p>Thử đổi bộ lọc hoặc tạo tài khoản nhân sự mới.</p>
          </div>
        ) : (
          <div className="staff-command-table">
            <div className="staff-command-table__head">
              <span><input type="checkbox" checked={accounts.length > 0 && selectedIds.length === accounts.length} onChange={(event) => toggleAllVisible(event.target.checked)} /></span>
              <span>Nhân sự</span>
              <span>Khoa/phòng</span>
              <span>Vai trò</span>
              <span>Trạng thái</span>
              <span>Bảo mật</span>
              <span>Session / Login</span>
              <span>Actions</span>
            </div>

            {accounts.map((item) => (
              <div key={item.user_id} className="staff-command-table__row">
                <span>
                  <input type="checkbox" checked={selectedIds.includes(item.user_id)} onChange={() => toggleSelected(item.user_id)} />
                </span>

                <button type="button" className="staff-command-identity" onClick={() => openInspector(item)}>
                  <div className="admin-avatar">{getInitials(item.full_name || item.username)}</div>
                  <div>
                    <strong>{item.full_name || item.username}</strong>
                    <small>{item.email || item.username}</small>
                    <small>{item.employee_code || 'Chưa có mã NV'}</small>
                  </div>
                </button>

                <button type="button" className="staff-command-department" onClick={() => {
                  const next = { ...filters, department_id: item.department_id || '' };
                  applyFilters(next);
                }}>
                  <strong>{departmentNameOf(item, departments)}</strong>
                  <small>{item.department?.department_code || 'Department scope'}</small>
                </button>

                <RoleChips roles={item.roles} onClickRole={(role) => {
                  const next = { ...filters, role_code: role };
                  applyFilters(next);
                }} />

                <span className={`staff-status-dot staff-status-dot--${getStatusTone(isPendingActivation(item) ? 'pending_activation' : item.status)}`}>
                  <span />
                  {isPendingActivation(item) ? 'Chờ kích hoạt' : getStatusLabel(item.status)}
                </span>

                <SecurityStack staff={item} />

                <div className="staff-session-indicator">
                  <strong>{item.active_session_count || 0}</strong>
                  <small>active sessions</small>
                  <em>{formatDateTime(item.last_login_at)}</em>
                </div>

                <div className="staff-command-actions">
                  <button type="button" title="Mở Staff 360" onClick={() => openInspector(item)}>
                    <Eye size={16} strokeWidth={2.25} />
                  </button>
                  <button type="button" title="Chi tiết đầy đủ" onClick={() => navigate(`/admin/staff/${item.user_id}`)}>
                    <MoreHorizontal size={16} strokeWidth={2.25} />
                  </button>
                  <button type="button" title="Reset mật khẩu" onClick={() => openDialog('reset', item)}>
                    <KeyRound size={16} strokeWidth={2.25} />
                  </button>
                  <button type="button" title="Force logout" onClick={() => handleDirectAction('force_logout', item)}>
                    <LogOut size={16} strokeWidth={2.25} />
                  </button>
                  {isPendingActivation(item) ? (
                    <button type="button" title="Kích hoạt" onClick={() => openDialog('activate', item)}>
                      <CheckCircle2 size={16} strokeWidth={2.25} />
                    </button>
                  ) : item.status === 'locked' ? (
                    <button type="button" title="Mở khóa" onClick={() => openDialog('unlock', item)}>
                      <ShieldCheck size={16} strokeWidth={2.25} />
                    </button>
                  ) : item.status === 'active' ? (
                    <button type="button" title="Vô hiệu hóa" onClick={() => openDialog('deactivate', item)}>
                      <AlertTriangle size={16} strokeWidth={2.25} />
                    </button>
                  ) : (
                    <button type="button" title="Kích hoạt" onClick={() => openDialog('activate', item)}>
                      <CheckCircle2 size={16} strokeWidth={2.25} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <footer className="staff-pagination">
          <span>
            Trang {pagination.page} / {totalPages} · {formatNumber(pagination.total)} bản ghi
          </span>
          <div>
            <button type="button" className="staff-button staff-button--ghost" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
              Trước
            </button>
            <button
              type="button"
              className="staff-button staff-button--ghost"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Sau
            </button>
          </div>
        </footer>
      </section>

      <StaffInspector
        inspector={inspector}
        activeTab={inspectorTab}
        setActiveTab={setInspectorTab}
        onClose={() => setInspector(null)}
        onAction={handleDirectAction}
        actionNotice={actionNotice}
        pendingAction={pendingAction}
      />

      {dialog?.type === 'reset' ? (
        <ResetPasswordDialog staff={dialog.staff} onClose={closeDialog} onSubmit={handleResetPassword} isSubmitting={submitting} />
      ) : null}

      {['activate', 'deactivate', 'unlock'].includes(dialog?.type) ? (
        <StaffStatusDialog
          action={dialog.type}
          staff={dialog.staff}
          onClose={closeDialog}
          onConfirm={() => handleStatusAction(dialog.type, dialog.staff)}
          isSubmitting={submitting}
        />
      ) : null}
    </>
  );
}
