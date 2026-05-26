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
  ShieldCheck,
  Stethoscope,
  UserCheck,
  UserCog,
  UserLock,
  UserPlus,
  UsersRound,
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

const VIEW_TABS = [
  { id: 'all', label: 'Tất cả', icon: UsersRound },
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

function StaffInspector({ inspector, activeTab, setActiveTab, onClose, onAction }) {
  if (!inspector) return null;

  const staff = inspector.staff || {};
  const detailUser = inspector.detail?.user || staff;
  const roles = inspector.detail?.roles || staff.role_details || staff.roles || [];
  const permissions = inspector.permissions?.permissions || inspector.detail?.permissions || [];
  const sessions = inspector.sessions?.items || [];
  const deps = inspector.dependencies;
  const risk = inspector.risk;
  const audit = inspector.audit?.items || [];
  const tabs = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'security', label: 'Bảo mật' },
    { id: 'roles', label: 'Vai trò & quyền' },
    { id: 'sessions', label: 'Session' },
    { id: 'dependencies', label: 'Phụ thuộc' },
    { id: 'audit', label: 'Audit' },
  ];

  return (
    <aside className="staff-inspector" aria-label="Staff detail drawer">
      <div className="staff-inspector__scrim" onClick={onClose} role="presentation" />
      <section className="staff-inspector__panel">
        <header className="staff-inspector__header">
          <div className="staff-inspector__identity">
            <div className="admin-avatar">{getInitials(detailUser.full_name || detailUser.username)}</div>
            <div>
              <small>Staff 360 Profile</small>
              <h2>{detailUser.full_name || detailUser.username}</h2>
              <span>{detailUser.username} · {detailUser.employee_code || 'Chưa có mã NV'}</span>
            </div>
          </div>
          <button type="button" className="staff-icon-button" onClick={onClose} aria-label="Đóng">
            <X size={18} strokeWidth={2.3} />
          </button>
        </header>

        <div className="staff-inspector__badges">
          <span className={`staff-status-dot staff-status-dot--${getStatusTone(detailUser.status)}`}>
            <span />
            {getStatusLabel(detailUser.status)}
          </span>
          <span>{detailUser.department_name || staff.department_name || 'Chưa gán khoa'}</span>
          {risk ? <span className={`staff-risk-chip staff-risk-chip--${getRiskTone(risk.risk_level)}`}>Risk {risk.risk_score}</span> : null}
        </div>

        <nav className="staff-inspector__tabs" aria-label="Staff drawer tabs">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={activeTab === tab.id ? 'is-active' : ''} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        {inspector.loading ? (
          <div className="staff-inspector__loading">Đang tải dữ liệu 360...</div>
        ) : (
          <div className="staff-inspector__body">
            {activeTab === 'overview' ? (
              <div className="staff-inspector-grid">
                {[
                  ['Email', detailUser.email || 'Chưa có'],
                  ['Số điện thoại', detailUser.phone || 'Chưa có'],
                  ['Khoa/phòng', detailUser.department_name || staff.department_name || 'Chưa gán'],
                  ['Auth provider', detailUser.auth_provider || staff.auth_provider || 'local'],
                  ['Lần đăng nhập cuối', formatDateTime(detailUser.last_login_at)],
                  ['Ngày tạo', formatDateTime(detailUser.created_at)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === 'security' ? (
              <div className="staff-inspector-stack">
                <div className="staff-risk-score-card">
                  <div>
                    <small>Risk score</small>
                    <strong>{risk?.risk_score ?? 0}</strong>
                    <span>{getRiskLabel(risk?.risk_level || 'low')}</span>
                  </div>
                  <ShieldAlert size={28} strokeWidth={2.2} />
                </div>
                <div className="staff-inspector-list">
                  {(risk?.reasons || ['Không có tín hiệu rủi ro đáng kể.']).map((reason) => (
                    <span key={reason}>{reason}</span>
                  ))}
                </div>
                <div className="staff-inspector-actions">
                  <button type="button" onClick={() => onAction('force_logout', staff)}>Force logout</button>
                  <button type="button" onClick={() => onAction('require_password_change', staff)}>Bắt đổi mật khẩu</button>
                </div>
              </div>
            ) : null}

            {activeTab === 'roles' ? (
              <div className="staff-inspector-stack">
                <div className="staff-inspector-list">
                  {(Array.isArray(roles) ? roles : []).map((role) => (
                    <span key={role.role_code || role}>{role.role_name || String(role).replaceAll('_', ' ')}</span>
                  ))}
                </div>
                <div className="staff-permission-cloud">
                  {permissions.slice(0, 36).map((permission) => (
                    <span key={permission}>{permission}</span>
                  ))}
                  {permissions.length > 36 ? <strong>+{permissions.length - 36} quyền</strong> : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'sessions' ? (
              <div className="staff-inspector-stack">
                <div className="staff-inspector-actions">
                  <button type="button" onClick={() => onAction('force_logout', staff)}>Thu hồi toàn bộ phiên</button>
                </div>
                {sessions.length ? sessions.map((session) => (
                  <div key={session.session_id} className="staff-session-row">
                    <MonitorMeta session={session} />
                    <span className={session.is_active ? 'is-active' : ''}>{session.is_active ? 'Active' : 'Revoked'}</span>
                  </div>
                )) : <p className="staff-muted-text">Chưa có session nào được backend trả về.</p>}
              </div>
            ) : null}

            {activeTab === 'dependencies' ? (
              <div className="staff-inspector-stack">
                <div className={`staff-dependency-verdict ${deps?.can_delete ? 'is-clear' : 'is-blocked'}`}>
                  <strong>{deps?.can_delete ? 'Không có blocker nghiệp vụ' : 'Có blocker cần xử lý'}</strong>
                  <span>Delete: {deps?.can_delete ? 'Có thể' : 'Không'} · Transfer: {deps?.can_transfer ? 'Có thể' : 'Không'}</span>
                </div>
                <div className="staff-inspector-grid">
                  {Object.entries(deps?.blockers || {}).map(([key, value]) => (
                    <div key={key}>
                      <span>{key.replaceAll('_', ' ')}</span>
                      <strong>{String(value ?? 0)}</strong>
                    </div>
                  ))}
                </div>
                <div className="staff-inspector-list">
                  {(deps?.blocking_reasons || deps?.recommendations || []).map((item) => <span key={item}>{item}</span>)}
                </div>
              </div>
            ) : null}

            {activeTab === 'audit' ? (
              <div className="staff-inspector-stack">
                {audit.length ? audit.slice(0, 8).map((item, index) => (
                  <div key={`${item._id || item.created_at}-${index}`} className="staff-audit-row">
                    <span>{formatDateTime(item.created_at)}</span>
                    <strong>{item.message || item.action}</strong>
                    <small>{item.action}</small>
                  </div>
                )) : <p className="staff-muted-text">Chưa có audit log hoặc chưa đủ quyền đọc audit.</p>}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </aside>
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
    ['keyword', 'role', 'role_code', 'department', 'department_id', 'status', 'risk'].forEach((key) => params.delete(key));
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
    setError('');
    try {
      if (action === 'force_logout') await forceLogoutStaff(staff.user_id);
      if (action === 'require_password_change') await requireStaffPasswordChange(staff.user_id);
      await refreshAccounts();
      if (inspector?.staff?.user_id === staff.user_id) await openInspector(staff);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
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
          <button type="button" className="staff-button staff-button--ghost">
            <Download size={16} strokeWidth={2.25} />
            <span>Export</span>
          </button>
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

        {accounts.length === 0 && !loading ? (
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
              <span>Session</span>
              <span>Last login</span>
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
                  <small>active</small>
                </div>

                <div className="staff-engagement-cell">
                  <strong>{formatDateTime(item.last_login_at)}</strong>
                  <small>Created: {formatCompactDate(item.created_at)}</small>
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
