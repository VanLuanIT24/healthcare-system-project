import '../iamControlPlanePro.css';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Database,
  FileClock,
  Fingerprint,
  Gauge,
  KeyRound,
  LockKeyhole,
  Play,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  TableProperties,
  UserCog,
  XCircle,
} from 'lucide-react';
import {
  activateDenyPolicy,
  applyRolePermissionMatrix,
  createDenyPolicy,
  deactivateDenyPolicy,
  explainAccess,
  getIamAudit,
  getIamCacheStatus,
  getIamMatrix,
  getIamOverview,
  getStaffEffectivePermissions,
  listDenyPolicies,
  listPermissions,
  listRoles,
  previewDenyPolicy,
  previewRolePermissionChange,
  previewStaffRoleChange,
  rebuildAllPermissionContexts,
  rebuildRolePermissionContext,
  rebuildUserPermissionContext,
  seedSystemAccess,
  seedSystemAccessDryRun,
  syncIamStaffRoles,
} from '../../roles/roleApi';
import { getStaffAccounts } from '../../staff/staffApi';
import {
  formatDateTime,
  formatNumber,
  getPermissionBrief,
  getPermissionModuleTitle,
  getPermissionTone,
  getRoleStatusTone,
  groupPermissions,
} from '../../roles/roleUi';
import { IamPermissionMatrixView, IamRoleAssignmentView } from './IamMatrixAssignmentPages';

const VIEW_META = {
  overview: {
    title: 'Trung tâm điều phối IAM',
    eyebrow: 'Admin / IAM & phân quyền / Tổng quan',
    description: 'Tình trạng role, permission, deny policy, cache, audit và rủi ro truy cập trong toàn hệ thống.',
    icon: Gauge,
  },
  matrix: {
    title: 'Ma trận quyền',
    eyebrow: 'Admin / IAM & phân quyền / Ma trận',
    description: 'Rà soát role-permission theo module, xem trước tác động và áp dụng bằng API đồng bộ có audit.',
    icon: TableProperties,
  },
  assignment: {
    title: 'Gán vai trò',
    eyebrow: 'Admin / IAM & phân quyền / Gán vai trò',
    description: 'Gán vai trò cho nhân sự với xem trước quyền hiệu lực, thay đổi workspace và tác động phiên.',
    icon: UserCog,
  },
  effective: {
    title: 'Quyền hiệu lực theo người dùng',
    eyebrow: 'Admin / IAM & phân quyền / Quyền hiệu lực',
    description: 'Xem permission thực tế của user, nguồn cấp từ role, deny policy và workspace được mở.',
    icon: Fingerprint,
  },
  accessCheck: {
    title: 'Kiểm tra quyền truy cập',
    eyebrow: 'Admin / IAM & phân quyền / Giải thích truy cập',
    description: 'Giải thích allow hoặc deny theo permission, role, workspace và deny policy.',
    icon: ShieldAlert,
  },
  context: {
    title: 'Trình xem ngữ cảnh truy cập',
    eyebrow: 'Admin / IAM & phân quyền / Context',
    description: 'Xem ngữ cảnh actor runtime: user, chi tiết vai trò, nguồn quyền, workspace và JSON gốc.',
    icon: KeyRound,
  },
  cache: {
    title: 'Vận hành cache quyền',
    eyebrow: 'Admin / IAM & phân quyền / Cache',
    description: 'Theo dõi cache authorization và rebuild permission context theo user, role hoặc toàn hệ thống.',
    icon: RefreshCw,
  },
  denyPermissions: {
    title: 'Chặn quyền',
    eyebrow: 'Admin / IAM & phân quyền / Chặn quyền',
    description: 'Tạo chính sách chặn permission/module theo user, vai trò hoặc khoa phòng, có xem trước tác động.',
    icon: Ban,
  },
  denyRoles: {
    title: 'Chặn vai trò',
    eyebrow: 'Admin / IAM & phân quyền / Chặn vai trò',
    description: 'Tạo chính sách chặn vai trò động theo chủ thể và thời gian hiệu lực.',
    icon: LockKeyhole,
  },
  audit: {
    title: 'Lịch sử thay đổi quyền',
    eyebrow: 'Admin / IAM & phân quyền / Audit',
    description: 'Timeline chuyên biệt cho role, permission, role-permission, user-role, deny policy và seed access.',
    icon: FileClock,
  },
  seed: {
    title: 'Seed quyền hệ thống',
    eyebrow: 'Admin / IAM & phân quyền / Seed',
    description: 'Chạy thử và seed role-permission chuẩn với báo cáo drift trước khi áp dụng.',
    icon: Database,
  },
};

const IAM_NAV = [
  { key: 'overview', label: 'Tổng quan', path: '/admin/iam/overview' },
  { key: 'matrix', label: 'Ma trận', path: '/admin/iam/matrix' },
  { key: 'assignment', label: 'Gán vai trò', path: '/admin/iam/assignment' },
  { key: 'effective', label: 'Quyền hiệu lực', path: '/admin/iam/effective' },
  { key: 'accessCheck', label: 'Kiểm tra truy cập', path: '/admin/iam/access-check' },
  { key: 'context', label: 'Ngữ cảnh', path: '/admin/iam/context' },
  { key: 'cache', label: 'Cache', path: '/admin/iam/cache' },
  { key: 'denyPermissions', label: 'Chặn quyền', path: '/admin/iam/deny-permissions' },
  { key: 'denyRoles', label: 'Chặn vai trò', path: '/admin/iam/deny-roles' },
  { key: 'audit', label: 'Audit', path: '/admin/iam/audit' },
  { key: 'seed', label: 'Seed', path: '/admin/iam/seed' },
];

const IAM_LABELS = {
  active: 'Đang hoạt động',
  inactive: 'Ngưng hoạt động',
  draft: 'Bản nháp',
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Nghiêm trọng',
  user: 'Người dùng',
  role: 'Vai trò',
  department: 'Khoa/phòng',
  workspace: 'Workspace',
  success: 'Thành công',
  failed: 'Lỗi',
};

function labelValue(value) {
  if (value === undefined || value === null || value === '') return 'Không rõ';
  return IAM_LABELS[String(value).toLowerCase()] || String(value).replace(/_/g, ' ');
}

const WORKSPACES = ['admin', 'scheduling', 'reception', 'doctor', 'nursing', 'lab', 'pharmacy', 'billing', 'reports'];

function makeQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  return search.toString();
}

function roleCodeList(user = {}) {
  const roles = user.roles || user.role_codes || [];
  return Array.isArray(roles) ? roles.map((role) => (typeof role === 'string' ? role : role.role_code)).filter(Boolean) : [];
}

function userIdOf(user = {}) {
  return user.user_id || user.id || user._id;
}

function riskTone(level = 'low') {
  if (level === 'critical') return 'critical';
  if (level === 'high') return 'high';
  if (level === 'medium') return 'medium';
  return 'low';
}

function StatusPill({ status }) {
  return <span className={`admin-status-badge admin-status-badge--${getRoleStatusTone(status)}`}>{labelValue(status)}</span>;
}

function RiskPill({ level }) {
  return <span className={`iam-risk-pill iam-risk-pill--${riskTone(level)}`}>{labelValue(level || 'low')}</span>;
}

function IamPageShell({ view, children, actions = null }) {
  const navigate = useNavigate();
  const meta = VIEW_META[view] || VIEW_META.overview;
  const Icon = meta.icon;

  return (
    <section className="iam-plane">
      <section className="iam-plane-hero">
        <div className="iam-plane-hero__copy">
          <p className="admin-page-header__eyebrow">{meta.eyebrow}</p>
          <div className="iam-plane-hero__title">
            <span><Icon size={24} strokeWidth={2.2} /></span>
            <h1>{meta.title}</h1>
          </div>
          <p>{meta.description}</p>
          <div className="iam-plane-hero__badges">
            <span>RBAC live</span>
            <span>Audit strict</span>
            <span>Permission versioned</span>
            <span>Session revoke enabled</span>
          </div>
        </div>
        <div className="iam-plane-hero__actions">
          {actions}
          <Link to="/admin/roles/create" className="staff-button staff-button--primary">
            <ShieldCheck size={17} />
            <span>Tạo vai trò</span>
          </Link>
        </div>
      </section>

      <nav className="iam-plane-tabs" aria-label="IAM control plane">
        {IAM_NAV.map((item) => (
          <button key={item.key} type="button" className={view === item.key ? 'is-active' : ''} onClick={() => navigate(item.path)}>
            {item.label}
          </button>
        ))}
      </nav>

      {children}
    </section>
  );
}

function LoadingBlock({ label = 'Đang tải dữ liệu IAM...' }) {
  return <section className="staff-loading-panel">{label}</section>;
}

function ErrorBlock({ message }) {
  if (!message) return null;
  return <p className="form-message error">{message}</p>;
}

function KpiCard({ icon: Icon, label, value, note, tone = 'indigo' }) {
  return (
    <article className={`admin-metric-card admin-metric-card--${tone} iam-kpi-card`}>
      <div className="admin-metric-card__top">
        <span className="admin-metric-card__icon">{Icon ? <Icon size={18} /> : null}</span>
        <small>{note}</small>
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function OverviewView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await getIamOverview('include_samples=true'));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <IamPageShell view="overview"><LoadingBlock /></IamPageShell>;

  const cards = [
    { label: 'Role active', value: formatNumber(data?.roles?.active), note: `${formatNumber(data?.roles?.total)} total`, icon: ShieldCheck, tone: 'indigo' },
    { label: 'Permissions', value: formatNumber(data?.permissions?.total), note: `${formatNumber(data?.permissions?.sensitive)} sensitive`, icon: KeyRound, tone: 'blue' },
    { label: 'User-role links', value: formatNumber(data?.assignments?.user_role_count), note: `${formatNumber(data?.assignments?.staff_without_role)} thiếu role`, icon: UserCog, tone: 'teal' },
    { label: 'Deny active', value: formatNumber(data?.risk?.active_deny_policies), note: `${formatNumber(data?.risk?.access_denied_today)} deny hôm nay`, icon: Ban, tone: 'red' },
    { label: 'Full access users', value: formatNumber(data?.assignments?.users_with_full_access), note: 'critical surface', icon: ShieldAlert, tone: 'amber' },
    { label: 'IAM changes 24h', value: formatNumber(data?.risk?.iam_changes_24h), note: 'audit stream', icon: FileClock, tone: 'violet' },
  ];

  return (
    <IamPageShell
      view="overview"
      actions={(
        <button type="button" className="staff-button staff-button--ghost" onClick={load}>
          <RefreshCw size={17} />
          <span>Làm mới</span>
        </button>
      )}
    >
      <ErrorBlock message={error} />
      <section className="iam-kpi-grid">
        {cards.map((card) => <KpiCard key={card.label} {...card} />)}
      </section>

      <section className="iam-overview-grid">
        <article className="admin-panel iam-risk-board">
          <div className="admin-panel__heading">
            <h2>Risk board</h2>
            <Link to="/admin/iam/matrix">Mở matrix</Link>
          </div>
          <div className="iam-risk-table">
            <div className="iam-risk-table__head">
              <span>Role</span>
              <span>Priority</span>
              <span>Users</span>
              <span>Permissions</span>
              <span>Risk</span>
            </div>
            {(data?.top_roles || []).map((role) => (
              <div key={role.role_id} className="iam-risk-table__row">
                <div>
                  <strong>{role.role_name}</strong>
                  <code>{role.role_code}</code>
                </div>
                <span>{role.priority_level}</span>
                <span>{formatNumber(role.user_count)}</span>
                <span>{formatNumber(role.permission_count)}</span>
                <RiskPill level={role.risk?.max_level} />
              </div>
            ))}
          </div>
        </article>

        <article className="admin-panel iam-module-board">
          <div className="admin-panel__heading">
            <h2>Module permission density</h2>
          </div>
          <div className="iam-module-list">
            {(data?.module_breakdown || []).slice(0, 14).map((item) => (
              <div key={item.module_key} className="iam-module-item">
                <div>
                  <strong>{getPermissionModuleTitle(item.module_key)}</strong>
                  <span>{item.module_key}</span>
                </div>
                <div className="iam-module-item__meter">
                  <span style={{ width: `${Math.min(100, Math.max(8, item.permission_count / Math.max(data?.permissions?.total || 1, 1) * 260))}%` }} />
                </div>
                <small>{formatNumber(item.permission_count)}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="iam-timeline-grid">
        <article className="admin-panel">
          <div className="admin-panel__heading"><h2>Recent IAM changes</h2></div>
          <AuditMiniList items={data?.recent_changes || []} empty="Chưa có thay đổi IAM trong 24h." />
        </article>
        <article className="admin-panel">
          <div className="admin-panel__heading"><h2>Access denied stream</h2></div>
          <AuditMiniList items={data?.recent_denied || []} empty="Chưa ghi nhận access denied gần đây." />
        </article>
      </section>
    </IamPageShell>
  );
}

function AuditMiniList({ items = [], empty }) {
  if (!items.length) return <p className="permission-side-empty">{empty}</p>;
  return (
    <div className="iam-audit-mini">
      {items.map((item) => (
        <div key={item.audit_log_id || `${item.action}-${item.created_at}`}>
          <span className={`iam-audit-dot iam-audit-dot--${item.status === 'failure' ? 'red' : 'green'}`} />
          <div>
            <strong>{item.message || item.action}</strong>
            <small>{item.action} · {formatDateTime(item.created_at)}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function MatrixView() {
  const [matrix, setMatrix] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [moduleFilter, setModuleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await getIamMatrix();
      setMatrix(result);
      const firstRoleId = selectedRoleId || result.roles?.[0]?.role_id || '';
      setSelectedRoleId(firstRoleId);
      setSelectedCodes(result.grants?.[firstRoleId] || []);
      setPreview(null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedRoleId || !matrix?.grants) return;
    setSelectedCodes(matrix.grants[selectedRoleId] || []);
    setPreview(null);
  }, [selectedRoleId, matrix]);

  const grouped = useMemo(() => {
    const items = (matrix?.permissions || []).filter((permission) => {
      if (moduleFilter && permission.module_key !== moduleFilter) return false;
      if (search && !`${permission.permission_code} ${permission.permission_name}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return groupPermissions(items);
  }, [matrix, search]);

  function toggleCode(code) {
    setSelectedCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
    setPreview(null);
  }

  async function runPreview() {
    setError('');
    try {
      setPreview(await previewRolePermissionChange({ role_id: selectedRoleId, permission_codes: selectedCodes }));
    } catch (previewError) {
      setError(previewError.message);
    }
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const result = await applyRolePermissionMatrix({ role_id: selectedRoleId, permission_codes: selectedCodes });
      setPreview(result.preview);
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <IamPageShell view="matrix"><LoadingBlock label="Đang tải ma trận role-permission..." /></IamPageShell>;

  const role = matrix?.roles?.find((item) => item.role_id === selectedRoleId);

  return (
    <IamPageShell
      view="matrix"
      actions={(
        <button type="button" className="staff-button staff-button--ghost" onClick={load}>
          <RefreshCw size={17} />
          <span>Làm mới</span>
        </button>
      )}
    >
      <ErrorBlock message={error} />
      <section className="admin-panel iam-matrix-toolbar">
        <label className="admin-search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} placeholder="Tìm permission code hoặc tên quyền" />
        </label>
        <select value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)}>
          {(matrix?.roles || []).map((item) => (
            <option key={item.role_id} value={item.role_id}>{item.role_name} · {item.role_code}</option>
          ))}
        </select>
        <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
          <option value="">Tất cả module</option>
          {(matrix?.modules || []).map((item) => <option key={item.module_key} value={item.module_key}>{getPermissionModuleTitle(item.module_key)}</option>)}
        </select>
        <button type="button" className="staff-button staff-button--ghost" onClick={runPreview}>
          <ShieldAlert size={17} />
          <span>Xem trước tác động</span>
        </button>
        <button type="button" className="staff-button staff-button--primary" onClick={save} disabled={saving}>
          <Save size={17} />
          <span>{saving ? 'Đang lưu...' : 'Áp dụng đồng bộ'}</span>
        </button>
      </section>

      <section className="iam-matrix-layout">
        <article className="admin-panel iam-permission-picker">
          <div className="iam-role-focus">
            <div>
              <strong>{role?.role_name || 'Role'}</strong>
              <code>{role?.role_code}</code>
            </div>
            <StatusPill status={role?.status} />
            <RiskPill level={role?.risk?.max_level} />
            <span>{formatNumber(selectedCodes.length)} quyền đang chọn</span>
          </div>
          <div className="iam-permission-groups">
            {Object.entries(grouped).map(([moduleKey, permissions]) => (
              <section key={moduleKey} className="iam-permission-module">
                <header>
                  <div>
                    <strong>{getPermissionModuleTitle(moduleKey)}</strong>
                    <span>{permissions.filter((item) => selectedCodes.includes(item.permission_code)).length}/{permissions.length}</span>
                  </div>
                  <button type="button" onClick={() => {
                    const codes = permissions.map((item) => item.permission_code);
                    const allSelected = codes.every((code) => selectedCodes.includes(code));
                    setSelectedCodes((current) => allSelected ? current.filter((code) => !codes.includes(code)) : [...new Set([...current, ...codes])]);
                    setPreview(null);
                  }}>
                    {permissions.every((item) => selectedCodes.includes(item.permission_code)) ? 'Bỏ module' : 'Chọn module'}
                  </button>
                </header>
                <div className="iam-permission-module__grid">
                  {permissions.map((permission) => (
                    <label key={permission.permission_id} className={`iam-permission-check ${selectedCodes.includes(permission.permission_code) ? 'is-selected' : ''}`}>
                      <input type="checkbox" checked={selectedCodes.includes(permission.permission_code)} onChange={() => toggleCode(permission.permission_code)} />
                      <div>
                        <strong>{getPermissionBrief(permission)}</strong>
                        <code>{permission.permission_code}</code>
                      </div>
                      <RiskPill level={permission.risk?.level} />
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>

        <aside className="admin-panel iam-impact-panel">
          <div className="admin-panel__heading"><h2>Xem trước tác động</h2></div>
          {preview ? (
            <>
              <div className="iam-impact-grid">
                <div><span>Thêm</span><strong>{formatNumber(preview.diff?.added_permission_codes?.length)}</strong></div>
                <div><span>Gỡ</span><strong>{formatNumber(preview.diff?.removed_permission_codes?.length)}</strong></div>
                <div><span>User ảnh hưởng</span><strong>{formatNumber(preview.impact?.affected_user_count)}</strong></div>
                <div><span>Phiên</span><strong>{formatNumber(preview.impact?.sessions_to_revoke_estimate)}</strong></div>
              </div>
              <PermissionDiff title="Quyền thêm" items={preview.diff?.added_permission_codes || []} />
              <PermissionDiff title="Quyền gỡ" items={preview.diff?.removed_permission_codes || []} tone="removed" />
            </>
          ) : (
            <p className="permission-side-empty">Chưa có preview cho tập thay đổi hiện tại.</p>
          )}
        </aside>
      </section>
    </IamPageShell>
  );
}

function PermissionDiff({ title, items = [], tone = 'added' }) {
  return (
    <div className={`iam-diff iam-diff--${tone}`}>
      <strong>{title}</strong>
      {items.length ? items.slice(0, 14).map((code) => <code key={code}>{code}</code>) : <span>Không có thay đổi</span>}
      {items.length > 14 ? <small>+{items.length - 14} quyền khác</small> : null}
    </div>
  );
}

function StaffSelector({ value, onChange, staff = [] }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Chọn nhân sự</option>
      {staff.map((user) => (
        <option key={userIdOf(user)} value={userIdOf(user)}>
          {user.full_name || user.username} · {user.email || user.employee_code || user.username}
        </option>
      ))}
    </select>
  );
}

function AssignmentView() {
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleCodes, setSelectedRoleCodes] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [staffData, rolesData] = await Promise.all([
        getStaffAccounts('limit=120'),
        listRoles('limit=100&status=active'),
      ]);
      const users = staffData?.items || [];
      setStaff(users);
      setRoles(rolesData?.items || []);
      const firstUser = selectedUserId || userIdOf(users[0]) || '';
      setSelectedUserId(firstUser);
      setSelectedRoleCodes(roleCodeList(users.find((user) => userIdOf(user) === firstUser) || {}));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const user = staff.find((item) => userIdOf(item) === selectedUserId);
    setSelectedRoleCodes(roleCodeList(user || {}));
    setPreview(null);
  }, [selectedUserId]);

  function toggleRole(roleCode) {
    setSelectedRoleCodes((current) => current.includes(roleCode) ? current.filter((item) => item !== roleCode) : [...current, roleCode]);
    setPreview(null);
  }

  async function runPreview() {
    if (!selectedUserId) return;
    setError('');
    try {
      setPreview(await previewStaffRoleChange(selectedUserId, selectedRoleCodes));
    } catch (previewError) {
      setError(previewError.message);
    }
  }

  async function save() {
    if (!selectedUserId) return;
    setSaving(true);
    setError('');
    try {
      await syncIamStaffRoles(selectedUserId, selectedRoleCodes);
      await runPreview();
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <IamPageShell view="assignment"><LoadingBlock label="Đang tải staff và role..." /></IamPageShell>;

  const user = staff.find((item) => userIdOf(item) === selectedUserId);

  return (
    <IamPageShell view="assignment">
      <ErrorBlock message={error} />
      <section className="iam-assignment-layout">
        <article className="admin-panel iam-assignment-main">
          <div className="iam-form-row">
            <label>
              <span>Nhân sự</span>
              <StaffSelector value={selectedUserId} onChange={setSelectedUserId} staff={staff} />
            </label>
            <button type="button" className="staff-button staff-button--ghost" onClick={runPreview}>
              <ShieldAlert size={17} />
              <span>Xem trước đổi vai trò</span>
            </button>
            <button type="button" className="staff-button staff-button--primary" onClick={save} disabled={saving || !selectedUserId}>
              <Save size={17} />
              <span>{saving ? 'Đang lưu...' : 'Đồng bộ vai trò'}</span>
            </button>
          </div>

          {user ? (
            <div className="iam-user-strip">
              <div className="admin-avatar">{String(user.full_name || user.username || 'U').slice(0, 2).toUpperCase()}</div>
              <div>
                <strong>{user.full_name || user.username}</strong>
                <span>{user.email || user.employee_code || user.phone || 'Không có định danh phụ'}</span>
              </div>
              <StatusPill status={user.status} />
              <span>permission_version {user.permission_version || 1}</span>
            </div>
          ) : null}

          <div className="iam-role-choice-grid">
            {roles.map((role) => (
              <button key={role.role_id} type="button" className={selectedRoleCodes.includes(role.role_code) ? 'is-selected' : ''} onClick={() => toggleRole(role.role_code)}>
                <div>
                  <strong>{role.role_name}</strong>
                  <code>{role.role_code}</code>
                </div>
                <span>P{role.priority_level}</span>
                <small>{formatNumber(role.permission_count || role.permissions_count)} quyền · {formatNumber(role.user_count || role.users_count)} users</small>
              </button>
            ))}
          </div>
        </article>

        <aside className="admin-panel iam-impact-panel">
          <div className="admin-panel__heading"><h2>Effective preview</h2></div>
          {preview ? (
            <>
              <div className="iam-impact-grid">
                <div><span>Before</span><strong>{formatNumber(preview.before?.permission_count)}</strong></div>
                <div><span>After</span><strong>{formatNumber(preview.after?.permission_count)}</strong></div>
                <div><span>Added</span><strong>{formatNumber(preview.diff?.added_permissions?.length)}</strong></div>
                <div><span>Removed</span><strong>{formatNumber(preview.diff?.removed_permissions?.length)}</strong></div>
              </div>
              <PermissionDiff title="Sensitive added" items={(preview.diff?.sensitive_added || []).map((item) => item.permission_code)} />
              <WorkspaceList items={preview.after?.workspaces || []} />
            </>
          ) : (
            <p className="permission-side-empty">Preview sẽ hiển thị quyền thêm/gỡ, workspace mở mới và session sẽ bị revoke.</p>
          )}
        </aside>
      </section>
    </IamPageShell>
  );
}

function WorkspaceList({ items = [] }) {
  return (
    <div className="iam-workspace-list">
      {items.map((workspace) => (
        <div key={workspace.code} className={workspace.allowed ? 'is-allowed' : ''}>
          {workspace.allowed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <div>
            <strong>{workspace.name || workspace.code}</strong>
            <small>{workspace.reason || workspace.route || 'N/A'}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function EffectiveView({ view = 'effective' }) {
  const [staff, setStaff] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [context, setContext] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const staffData = await getStaffAccounts('limit=120');
      const users = staffData?.items || [];
      setStaff(users);
      const firstUser = selectedUserId || userIdOf(users[0]) || '';
      setSelectedUserId(firstUser);
      if (firstUser) setContext(await getStaffEffectivePermissions(firstUser));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    getStaffEffectivePermissions(selectedUserId)
      .then(setContext)
      .catch((loadError) => setError(loadError.message));
  }, [selectedUserId]);

  const filteredPermissions = useMemo(() => {
    const items = context?.permissions || [];
    if (!search) return items;
    return items.filter((permission) => `${permission.permission_code} ${permission.permission_name}`.toLowerCase().includes(search.toLowerCase()));
  }, [context, search]);

  const grouped = useMemo(() => groupPermissions(filteredPermissions), [filteredPermissions]);

  if (loading) return <IamPageShell view={view}><LoadingBlock label="Đang tải access context..." /></IamPageShell>;

  return (
    <IamPageShell view={view}>
      <ErrorBlock message={error} />
      <section className="admin-panel iam-context-toolbar">
        <StaffSelector value={selectedUserId} onChange={setSelectedUserId} staff={staff} />
        <label className="admin-search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm permission hiệu lực" />
        </label>
        <button type="button" className="staff-button staff-button--ghost" onClick={() => selectedUserId && getStaffEffectivePermissions(selectedUserId).then(setContext).catch((err) => setError(err.message))}>
          <RefreshCw size={17} />
          <span>Làm mới</span>
        </button>
      </section>

      <section className="iam-context-layout">
        <article className="admin-panel iam-effective-permissions">
          <div className="iam-user-strip">
            <div className="admin-avatar">{String(context?.user?.full_name || context?.user?.username || 'U').slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{context?.user?.full_name || context?.user?.username || 'Chưa chọn user'}</strong>
              <span>{context?.roles?.map((role) => role.role_code).join(', ') || 'Không có role active'}</span>
            </div>
            <RiskPill level={context?.risk?.max_level} />
            {context?.has_full_access ? <span className="iam-full-access">system.full_access</span> : null}
          </div>

          {Object.entries(grouped).map(([moduleKey, items]) => (
            <section key={moduleKey} className="iam-effective-module">
              <header>
                <strong>{getPermissionModuleTitle(moduleKey)}</strong>
                <span>{formatNumber(items.length)} quyền</span>
              </header>
              <div>
                {items.map((permission) => (
                  <article key={permission.permission_code} className={`iam-effective-card ${permission.denied ? 'is-denied' : ''}`}>
                    <span className={`permission-table__dot permission-table__dot--${getPermissionTone(permission.module_key)}`} />
                    <div>
                      <strong>{getPermissionBrief(permission)}</strong>
                      <code>{permission.permission_code}</code>
                      <small>{(permission.granted_by_roles || []).map((role) => role.role_code).join(', ') || 'source unavailable'}</small>
                    </div>
                    <RiskPill level={permission.risk?.level} />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </article>

        <aside className="admin-panel iam-context-side">
          <div className="admin-panel__heading"><h2>{view === 'context' ? 'Raw context' : 'Workspace access'}</h2></div>
          <WorkspaceList items={context?.workspaces || []} />
          <div className="iam-deny-context">
            <strong>Deny context</strong>
            {(context?.deny_context?.policies || []).length ? context.deny_context.policies.map((policy) => (
              <div key={policy.deny_policy_id}>
                <Ban size={15} />
                <span>{policy.deny_type}:{policy.deny_value}</span>
              </div>
            )) : <small>Không có deny policy active.</small>}
          </div>
          {view === 'context' ? <pre className="iam-json">{JSON.stringify(context, null, 2)}</pre> : null}
        </aside>
      </section>
    </IamPageShell>
  );
}

function AccessCheckView() {
  const [staff, setStaff] = useState([]);
  const [payload, setPayload] = useState({ user_id: '', permission_code: '', workspace: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStaffAccounts('limit=120')
      .then((data) => {
        const users = data?.items || [];
        setStaff(users);
        setPayload((current) => ({ ...current, user_id: userIdOf(users[0]) || '' }));
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  async function run() {
    setError('');
    setResult(null);
    try {
      setResult(await explainAccess(payload));
    } catch (runError) {
      setError(runError.message);
    }
  }

  if (loading) return <IamPageShell view="accessCheck"><LoadingBlock label="Đang tải simulator..." /></IamPageShell>;

  return (
    <IamPageShell view="accessCheck">
      <ErrorBlock message={error} />
      <section className="iam-access-check-grid">
        <article className="admin-panel iam-access-form">
          <label><span>User</span><StaffSelector value={payload.user_id} onChange={(value) => setPayload((current) => ({ ...current, user_id: value }))} staff={staff} /></label>
          <label><span>Permission code</span><input value={payload.permission_code} onChange={(event) => setPayload((current) => ({ ...current, permission_code: event.target.value }))} placeholder="payments.refund" /></label>
          <label><span>Workspace</span><select value={payload.workspace} onChange={(event) => setPayload((current) => ({ ...current, workspace: event.target.value }))}><option value="">Không kiểm tra workspace</option>{WORKSPACES.map((workspace) => <option key={workspace} value={workspace}>{workspace}</option>)}</select></label>
          <button type="button" className="staff-button staff-button--primary" onClick={run} disabled={!payload.user_id || !payload.permission_code}>
            <Play size={17} />
            <span>Run explain</span>
          </button>
        </article>

        <article className={`admin-panel iam-access-result ${result?.allowed ? 'is-allow' : result ? 'is-deny' : ''}`}>
          <div className="iam-access-result__decision">
            {result?.allowed ? <CheckCircle2 size={28} /> : result ? <XCircle size={28} /> : <ShieldAlert size={28} />}
            <div>
              <strong>{result ? result.decision.toUpperCase() : 'NO DECISION'}</strong>
              <span>{result?.reason || 'Chưa chạy kiểm tra'}</span>
            </div>
          </div>
          {result ? (
            <>
              <div className="iam-impact-grid">
                <div><span>Matched</span><strong>{formatNumber(result.matched_permissions?.length)}</strong></div>
                <div><span>Missing</span><strong>{formatNumber(result.missing_permissions?.length)}</strong></div>
                <div><span>Denied by</span><strong>{formatNumber(result.denied_by?.length)}</strong></div>
                <div><span>Roles</span><strong>{formatNumber(result.roles?.length)}</strong></div>
              </div>
              <div className="iam-explain-tree">
                {(result.explain || []).map((line) => <div key={line}>{line}</div>)}
              </div>
            </>
          ) : null}
        </article>
      </section>
    </IamPageShell>
  );
}

function CacheView() {
  const [status, setStatus] = useState(null);
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const [cacheData, staffData, rolesData] = await Promise.all([
        getIamCacheStatus(),
        getStaffAccounts('limit=120'),
        listRoles('limit=100'),
      ]);
      setStatus(cacheData);
      const users = staffData?.items || [];
      const roleItems = rolesData?.items || [];
      setStaff(users);
      setRoles(roleItems);
      setSelectedUserId((current) => current || userIdOf(users[0]) || '');
      setSelectedRoleId((current) => current || roleItems[0]?.role_id || '');
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function run(action) {
    setError('');
    setResult(null);
    try {
      if (action === 'user') setResult(await rebuildUserPermissionContext(selectedUserId, { bump_version: true, force_logout: false }));
      if (action === 'role') setResult(await rebuildRolePermissionContext(selectedRoleId, { bump_version: true, force_logout: false }));
      if (action === 'all') setResult(await rebuildAllPermissionContexts({ bump_version: true }));
      await load();
    } catch (runError) {
      setError(runError.message);
    }
  }

  return (
    <IamPageShell view="cache">
      <ErrorBlock message={error} />
      <section className="iam-kpi-grid">
        <KpiCard icon={RefreshCw} label="Cache entries" value={formatNumber(status?.authorization_cache?.entries)} note={`${formatNumber(status?.authorization_cache?.ttl_ms)}ms TTL`} tone="blue" />
        <KpiCard icon={KeyRound} label="Entry hết hạn" value={formatNumber(status?.authorization_cache?.expired_entries)} note={status?.authorization_cache?.strategy} tone="amber" />
        <KpiCard icon={ShieldCheck} label="Phiên hoạt động" value={formatNumber(status?.sessions?.active_staff_sessions)} note="phiên nhân sự" tone="teal" />
      </section>
      <section className="iam-cache-grid">
        <article className="admin-panel iam-cache-action">
          <h2>Ngữ cảnh người dùng</h2>
          <StaffSelector value={selectedUserId} onChange={setSelectedUserId} staff={staff} />
          <button type="button" className="staff-button staff-button--primary" onClick={() => run('user')} disabled={!selectedUserId}><RefreshCw size={17} /> Tạo lại user</button>
        </article>
        <article className="admin-panel iam-cache-action">
          <h2>User theo vai trò</h2>
          <select value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)}>
            {roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.role_name} · {role.role_code}</option>)}
          </select>
          <button type="button" className="staff-button staff-button--primary" onClick={() => run('role')} disabled={!selectedRoleId}><RefreshCw size={17} /> Tạo lại vai trò</button>
        </article>
        <article className="admin-panel iam-cache-action iam-cache-action--danger">
          <h2>Làm mới toàn hệ thống</h2>
          <p>Clear in-memory authorization cache và bump permission_version cho mọi user đang tồn tại.</p>
          <button type="button" className="staff-button staff-button--danger" onClick={() => run('all')}><AlertTriangle size={17} /> Tạo lại toàn bộ</button>
        </article>
      </section>
      {result ? <pre className="iam-json iam-json--wide">{JSON.stringify(result, null, 2)}</pre> : null}
    </IamPageShell>
  );
}

function DenyPolicyView({ denyType = 'permission' }) {
  const isRole = denyType === 'role';
  const view = isRole ? 'denyRoles' : 'denyPermissions';
  const [items, setItems] = useState([]);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({
    subject_type: 'user',
    subject_id: '',
    deny_type: denyType,
    deny_value: '',
    reason: '',
    severity: isRole ? 'high' : 'medium',
    status: 'draft',
  });
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const [policiesData, staffData, rolesData, permissionsData] = await Promise.all([
        listDenyPolicies(makeQuery({ deny_type: denyType, limit: 100 })),
        getStaffAccounts('limit=120'),
        listRoles('limit=100'),
        isRole ? Promise.resolve({ items: [] }) : listPermissions('limit=300'),
      ]);
      setItems(policiesData?.items || []);
      setStaff(staffData?.items || []);
      setRoles(rolesData?.items || []);
      setPermissions(permissionsData?.items || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    load();
  }, [denyType]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value, deny_type: denyType }));
    setPreview(null);
  }

  async function runPreview() {
    setError('');
    try {
      setPreview(await previewDenyPolicy({ ...form, deny_type: denyType }));
    } catch (previewError) {
      setError(previewError.message);
    }
  }

  async function create() {
    setError('');
    try {
      await createDenyPolicy({ ...form, deny_type: denyType });
      setForm((current) => ({ ...current, deny_value: '', reason: '', status: 'draft' }));
      setPreview(null);
      await load();
    } catch (createError) {
      setError(createError.message);
    }
  }

  async function toggle(policy) {
    setError('');
    try {
      if (policy.status === 'active') await deactivateDenyPolicy(policy.deny_policy_id);
      else await activateDenyPolicy(policy.deny_policy_id);
      await load();
    } catch (toggleError) {
      setError(toggleError.message);
    }
  }

  return (
    <IamPageShell view={view}>
      <ErrorBlock message={error} />
      <section className="iam-deny-grid">
        <article className="admin-panel iam-deny-form">
          <div className="iam-form-row">
            <label><span>Loại chủ thể</span><select value={form.subject_type} onChange={(event) => updateForm('subject_type', event.target.value)}><option value="user">Người dùng</option><option value="role">Vai trò</option><option value="department">Khoa/phòng</option><option value="workspace">Workspace</option></select></label>
            <label><span>Chủ thể</span>{form.subject_type === 'user' ? <StaffSelector value={form.subject_id} onChange={(value) => updateForm('subject_id', value)} staff={staff} /> : form.subject_type === 'role' ? <select value={form.subject_id} onChange={(event) => updateForm('subject_id', event.target.value)}><option value="">Chọn vai trò</option>{roles.map((role) => <option key={role.role_id} value={role.role_code}>{role.role_name} · {role.role_code}</option>)}</select> : <input value={form.subject_id} onChange={(event) => updateForm('subject_id', event.target.value)} placeholder="ObjectId hoặc workspace code" />}</label>
          </div>
          <div className="iam-form-row">
            <label><span>{isRole ? 'Role bị chặn' : 'Permission/module bị chặn'}</span>{isRole ? <select value={form.deny_value} onChange={(event) => updateForm('deny_value', event.target.value)}><option value="">Chọn role</option>{roles.map((role) => <option key={role.role_id} value={role.role_code}>{role.role_code}</option>)}</select> : <input list="iam-permission-options" value={form.deny_value} onChange={(event) => updateForm('deny_value', event.target.value)} placeholder="payments.refund hoặc payments" />}</label>
            <datalist id="iam-permission-options">{permissions.map((permission) => <option key={permission.permission_id} value={permission.permission_code} />)}</datalist>
            <label><span>Mức độ</span><select value={form.severity} onChange={(event) => updateForm('severity', event.target.value)}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option><option value="critical">Nghiêm trọng</option></select></label>
            <label><span>Trạng thái</span><select value={form.status} onChange={(event) => updateForm('status', event.target.value)}><option value="draft">Bản nháp</option><option value="active">Đang hoạt động</option></select></label>
          </div>
          <label><span>Lý do</span><textarea value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} placeholder="Lý do kiểm soát truy cập" /></label>
          <div className="iam-form-actions">
            <button type="button" className="staff-button staff-button--ghost" onClick={runPreview}><ShieldAlert size={17} /> Xem trước tác động</button>
            <button type="button" className="staff-button staff-button--primary" onClick={create}><Save size={17} /> Tạo policy</button>
          </div>
          {preview ? (
            <div className="iam-impact-grid">
              <div><span>User ảnh hưởng</span><strong>{formatNumber(preview.impact?.affected_user_count)}</strong></div>
              <div><span>Cần refresh</span><strong>{preview.impact?.authorization_refresh_required ? 'Có' : 'Không'}</strong></div>
            </div>
          ) : null}
        </article>

        <article className="admin-panel iam-deny-table-panel">
          <div className="admin-panel__heading"><h2>{isRole ? 'Policy chặn vai trò' : 'Policy chặn quyền'}</h2></div>
          <div className="iam-deny-table">
            <div className="iam-deny-table__head"><span>Chủ thể</span><span>Chặn</span><span>Mức độ</span><span>Trạng thái</span><span>Tác động</span><span>Thao tác</span></div>
            {items.map((policy) => (
              <div key={policy.deny_policy_id} className="iam-deny-table__row">
                <div><strong>{policy.subject_type}</strong><small>{policy.subject_label || policy.subject_id}</small></div>
                <code>{policy.deny_value}</code>
                <RiskPill level={policy.severity} />
                <StatusPill status={policy.status} />
                <span>{formatNumber(policy.affected_user_count)} user</span>
                <button type="button" onClick={() => toggle(policy)}>{policy.status === 'active' ? 'Tắt' : 'Bật'}</button>
              </div>
            ))}
          </div>
        </article>
      </section>
    </IamPageShell>
  );
}

function AuditView() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ action: '', target_type: '', limit: 100 });
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const data = await getIamAudit(makeQuery(filters));
      setItems(data?.items || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <IamPageShell view="audit">
      <ErrorBlock message={error} />
      <section className="admin-panel iam-audit-toolbar">
        <input value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))} placeholder="action exact, ví dụ role_permissions.sync" />
        <select value={filters.target_type} onChange={(event) => setFilters((current) => ({ ...current, target_type: event.target.value }))}><option value="">Mọi target</option><option value="role">role</option><option value="permission">permission</option><option value="user">user</option><option value="deny_policy">deny_policy</option><option value="system">system</option></select>
        <button type="button" className="staff-button staff-button--primary" onClick={load}><Search size={17} /> Lọc audit</button>
      </section>
      <section className="admin-panel iam-audit-panel">
        <div className="iam-audit-table">
          <div className="iam-audit-table__head"><span>Thời gian</span><span>Actor</span><span>Hành động</span><span>Đích</span><span>Trạng thái</span><span>Thông báo</span></div>
          {items.map((item) => (
            <div key={item.audit_log_id} className="iam-audit-table__row">
              <span>{formatDateTime(item.created_at)}</span>
              <span>{item.actor_type} · {String(item.actor_id || 'system').slice(-8)}</span>
              <code>{item.action}</code>
              <span>{item.target_type || 'system'} · {String(item.target_id || '').slice(-8)}</span>
              <StatusPill status={item.status} />
              <strong>{item.message || 'Không có mô tả'}</strong>
            </div>
          ))}
        </div>
      </section>
    </IamPageShell>
  );
}

function SeedView() {
  const [dryRun, setDryRun] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  async function runDry() {
    setError('');
    try {
      setDryRun(await seedSystemAccessDryRun());
    } catch (runError) {
      setError(runError.message);
    }
  }

  async function runSeed() {
    setRunning(true);
    setError('');
    try {
      setResult(await seedSystemAccess());
      await runDry();
    } catch (runError) {
      setError(runError.message);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    runDry();
  }, []);

  return (
    <IamPageShell view="seed">
      <ErrorBlock message={error} />
      <section className="iam-seed-grid">
        <article className="admin-panel iam-seed-warning">
          <AlertTriangle size={24} />
          <div>
            <h2>Seed canonical IAM</h2>
            <p>Thao tác này upsert core roles, canonical permissions, retire legacy permissions và sync ROLE_PERMISSION_MAP.</p>
          </div>
          <div className="iam-form-actions">
            <button type="button" className="staff-button staff-button--ghost" onClick={runDry}><ShieldAlert size={17} /> Chạy thử</button>
            <button type="button" className="staff-button staff-button--danger" onClick={runSeed} disabled={running}><Database size={17} /> {running ? 'Đang seed...' : 'Chạy seed'}</button>
          </div>
        </article>
        <article className="admin-panel iam-seed-summary">
          <div className="admin-panel__heading"><h2>Tóm tắt chạy thử</h2></div>
          <div className="iam-impact-grid">
            {Object.entries(dryRun?.summary || {}).map(([key, value]) => <div key={key}><span>{key}</span><strong>{formatNumber(value)}</strong></div>)}
          </div>
        </article>
      </section>
      <section className="iam-seed-json-grid">
        <pre className="iam-json">{JSON.stringify(dryRun, null, 2)}</pre>
        {result ? <pre className="iam-json">{JSON.stringify(result, null, 2)}</pre> : null}
      </section>
    </IamPageShell>
  );
}

export function IamControlPlanePage({ view = 'overview' }) {
  if (view === 'overview') return <OverviewView />;
  if (view === 'matrix') return <IamPermissionMatrixView />;
  if (view === 'assignment') return <IamRoleAssignmentView />;
  if (view === 'effective') return <EffectiveView view="effective" />;
  if (view === 'accessCheck') return <AccessCheckView />;
  if (view === 'context') return <EffectiveView view="context" />;
  if (view === 'cache') return <CacheView />;
  if (view === 'denyPermissions') return <DenyPolicyView denyType="permission" />;
  if (view === 'denyRoles') return <DenyPolicyView denyType="role" />;
  if (view === 'audit') return <AuditView />;
  if (view === 'seed') return <SeedView />;
  return <OverviewView />;
}
