import {
  Activity,
  Command,
  Eye,
  LockKeyhole,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Database,
  FileClock,
  Fingerprint,
  Gauge,
  KeyRound,
  Layers3,
  LayoutGrid,
  Link2,
  MonitorCheck,
  Network,
  RefreshCw,
  Router,
  Workflow,
  Search,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TableProperties,
  Trash2,
  UserCog,
  UserRound,
  UsersRound,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminActionConfirmDialog } from '../../components/AdminActionConfirmDialog';
import {
  createWorkspacePolicy,
  deleteWorkspacePolicy,
  explainWorkspaceAccess,
  getWorkspaceAccessOverview,
  getWorkspaceAudit,
  getWorkspaceByActor,
  getWorkspaceByDepartment,
  getWorkspaceByRole,
  getWorkspaceByUser,
  getWorkspaceConflicts,
  getWorkspaceDiagnostics,
  getWorkspaceNavigationRules,
  getWorkspacePreferences,
  getWorkspaceSidebars,
  listWorkspacePolicies,
  listWorkspaceRegistry,
  runWorkspaceDiagnostics,
  updateWorkspacePolicy,
  validateWorkspacePolicies,
} from '../workspaceAccessApi';
import { formatDateTime, formatNumber } from '../../staff/staffUi';
import '../workspace-access-wow.css';

const VIEW_META = {
  overview: { label: 'Tổng quan', title: 'Workspace Access Command Center', icon: LayoutGrid, desc: 'Bức tranh điều hành truy cập workspace, policy, rủi ro, coverage và trạng thái vận hành.' },
  list: { label: 'Workspace', title: 'Workspace Registry', icon: MonitorCheck, desc: 'Quản lý danh mục workspace, route, role, permission, policy và trạng thái rủi ro.' },
  actor: { label: 'Theo actor', title: 'Actor Boundary Map', icon: UserRound, desc: 'Kiểm soát ranh giới staff, patient, service account và khả năng mở workspace.' },
  role: { label: 'Theo vai trò', title: 'Role × Workspace Matrix', icon: ShieldCheck, desc: 'Heatmap quyền truy cập workspace theo role và permission hiệu lực.' },
  user: { label: 'Theo user', title: 'User Effective Workspace', icon: UsersRound, desc: 'Danh sách nhân sự, khoa, role, workspace hiện tại và workspace có thể sử dụng.' },
  department: { label: 'Theo khoa', title: 'Department Workspace Mapping', icon: Building2, desc: 'Mapping workspace mặc định theo khoa/phòng, quy mô nhân sự và phạm vi vận hành.' },
  policies: { label: 'Policy', title: 'Workspace Access Policies', icon: KeyRound, desc: 'Tạo, kiểm tra, vô hiệu hóa và rà soát chính sách allow/deny/hide/readonly.' },
  sidebar: { label: 'Sidebar', title: 'Sidebar Configuration Preview', icon: SlidersHorizontal, desc: 'Xem trước menu sidebar được sinh từ workspace registry và quyền hiển thị.' },
  navigation: { label: 'Điều hướng', title: 'Cross-Workspace Navigation', icon: Router, desc: 'Bản đồ điều hướng liên workspace, route template, open mode và quyền yêu cầu.' },
  preferences: { label: 'Tùy chọn', title: 'Workspace Preferences', icon: UserCog, desc: 'Theo dõi workspace mặc định, workspace đang chọn, pin/ẩn và tính hợp lệ.' },
  check: { label: 'Mô phỏng', title: 'Access Decision Simulator', icon: Fingerprint, desc: 'Mô phỏng quyết định cho phép/chặn workspace theo role hoặc user thật.' },
  conflicts: { label: 'Xung đột', title: 'Policy Conflict Scanner', icon: AlertTriangle, desc: 'Phát hiện allow/deny mâu thuẫn, policy hết hạn và phạm vi ảnh hưởng.' },
  diagnostics: { label: 'Chẩn đoán', title: 'Workspace Diagnostics', icon: Activity, desc: 'Kiểm tra registry, IAM mapping, preference, policy và permission prefix rủi ro.' },
  audit: { label: 'Audit', title: 'Workspace Audit Timeline', icon: FileClock, desc: 'Timeline các sự kiện workspace.* để truy vết thay đổi và vận hành.' },
};

const VIEW_TABS = Object.entries(VIEW_META).map(([id, meta]) => ({ id, ...meta }));
const STATUS_TONES = { critical: 'critical', high: 'high', failed: 'high', medium: 'medium', warning: 'medium', amber: 'medium', ok: 'low', low: 'low', active: 'low', published: 'low', allow: 'low', deny: 'high', hide: 'high', readonly: 'medium' };

function pickArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function textIncludes(value, query) {
  return String(value ?? '').toLowerCase().includes(String(query || '').trim().toLowerCase());
}

function StatCard({ label, value, hint, icon: Icon, tone = 'blue' }) {
  return (
    <article className={`workspace-access-metric workspace-access-metric--${tone}`}>
      <span className="workspace-access-metric__icon"><Icon size={19} strokeWidth={2.25} /></span>
      <div><small>{label}</small><strong>{formatNumber(value || 0)}</strong><em>{hint}</em></div>
    </article>
  );
}

function Severity({ value = 'low' }) {
  const tone = STATUS_TONES[value] || value;
  return <span className={`workspace-access-severity workspace-access-severity--${tone}`}>{value}</span>;
}

function WorkspaceChip({ workspace, allowed = true, source }) {
  const label = workspace?.code || workspace || 'none';
  return <span className={`workspace-access-chip${allowed ? ' is-allowed' : ' is-denied'}`}>{label}{source ? <em>{source}</em> : null}</span>;
}

function Toolbar({ query, onQuery, right }) {
  return (
    <div className="workspace-access-toolbar">
      <label><Search size={16} strokeWidth={2.25} /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Tìm nhanh theo mã, tên, route, role, user..." /></label>
      {right}
    </div>
  );
}

function Panel({ title, eyebrow, icon: Icon = Database, children, action, className = '' }) {
  return (
    <section className={`workspace-access-panel ${className}`.trim()}>
      <div className="workspace-access-panel__head">
        <div><span>{eyebrow}</span><strong>{title}</strong></div>
        {action || <Icon size={18} strokeWidth={2.25} />}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ label = 'Chưa có dữ liệu', hint = 'Dữ liệu sẽ hiển thị sau khi backend trả kết quả.' }) {
  return <div className="workspace-access-empty"><Search size={24} strokeWidth={2.25} /><strong>{label}</strong><span>{hint}</span></div>;
}


function getViewSnapshot(activeView, data, workspaces) {
  const summary = data?.summary || {};
  const items = pickArray(data, ['items', 'departments', 'roles', 'actor_types']);
  const registryTotal = workspaces?.length || data?.workspaces?.length || summary.total_workspaces || summary.active_workspaces || 0;
  const conflictTotal = summary.policy_conflicts || summary.total_conflicts || summary.failed || data?.diagnostics?.summary?.failed || 0;
  const policyTotal = summary.policy_allow + summary.policy_deny || data?.pagination?.total || items.length || 0;
  const validTotal = summary.ok || summary.role_count || summary.active_staff || summary.valid_preferences || 0;
  const map = {
    overview: { primary: registryTotal, primaryLabel: 'Workspace đang quản trị', second: summary.role_count, secondLabel: 'Role liên kết', risk: conflictTotal, riskLabel: 'Điểm cần xử lý' },
    list: { primary: items.length, primaryLabel: 'Workspace trong registry', second: registryTotal, secondLabel: 'Registry cache', risk: items.filter((item) => item.risk_level && item.risk_level !== 'low').length, riskLabel: 'Workspace rủi ro' },
    actor: { primary: data?.actor_types?.length || 0, primaryLabel: 'Actor boundary', second: registryTotal, secondLabel: 'Workspace khả dụng', risk: 0, riskLabel: 'Boundary cần chú ý' },
    role: { primary: data?.roles?.length || 0, primaryLabel: 'Role trong ma trận', second: data?.workspaces?.length || registryTotal, secondLabel: 'Workspace đối chiếu', risk: data?.roles?.filter((role) => !role.workspace_count).length || 0, riskLabel: 'Role chưa phủ' },
    user: { primary: data?.pagination?.total || data?.items?.length || 0, primaryLabel: 'User đang kiểm tra', second: data?.items?.filter((user) => !user.invalid_current_workspace).length || 0, secondLabel: 'Current hợp lệ', risk: data?.items?.filter((user) => user.invalid_current_workspace).length || 0, riskLabel: 'User lệch workspace' },
    department: { primary: data?.departments?.length || 0, primaryLabel: 'Khoa/phòng', second: data?.departments?.reduce((sum, dep) => sum + Number(dep.active_staff_count || 0), 0) || 0, secondLabel: 'Nhân sự active', risk: data?.departments?.filter((dep) => !dep.default_workspace).length || 0, riskLabel: 'Thiếu mặc định' },
    policies: { primary: data?.pagination?.total || data?.items?.length || 0, primaryLabel: 'Policy', second: data?.items?.filter((policy) => policy.effect === 'allow').length || 0, secondLabel: 'Allow active', risk: data?.items?.filter((policy) => ['deny', 'hide'].includes(policy.effect)).length || 0, riskLabel: 'Deny / hide' },
    sidebar: { primary: data?.items?.length || 0, primaryLabel: 'Sidebar config', second: data?.items?.reduce((sum, item) => sum + Number(item.item_count || item.items?.length || 0), 0) || 0, secondLabel: 'Menu item', risk: data?.items?.filter((item) => item.status && item.status !== 'active').length || 0, riskLabel: 'Config bất thường' },
    navigation: { primary: data?.items?.length || 0, primaryLabel: 'Navigation rule', second: data?.items?.filter((rule) => rule.open_mode === 'same_tab').length || 0, secondLabel: 'Same tab', risk: data?.items?.filter((rule) => ['high', 'critical'].includes(rule.risk_level)).length || 0, riskLabel: 'Rule rủi ro' },
    preferences: { primary: data?.pagination?.total || data?.items?.length || 0, primaryLabel: 'Preference', second: data?.items?.filter((item) => item.valid).length || 0, secondLabel: 'Hợp lệ', risk: data?.items?.filter((item) => !item.valid).length || 0, riskLabel: 'Sai current/default' },
    check: { primary: registryTotal, primaryLabel: 'Workspace có thể test', second: summary.role_count, secondLabel: 'Role tham chiếu', risk: conflictTotal, riskLabel: 'Rủi ro nền' },
    conflicts: { primary: summary.total_conflicts || data?.items?.length || 0, primaryLabel: 'Conflict', second: summary.expired_active_policies, secondLabel: 'Policy hết hạn', risk: summary.duplicate_policies, riskLabel: 'Duplicate' },
    diagnostics: { primary: summary.ok, primaryLabel: 'Check OK', second: summary.warnings, secondLabel: 'Cảnh báo', risk: summary.failed, riskLabel: 'Lỗi cần sửa' },
    audit: { primary: data?.length || 0, primaryLabel: 'Audit event', second: data?.filter?.((item) => item.status === 'success').length || 0, secondLabel: 'Success', risk: data?.filter?.((item) => item.status && item.status !== 'success').length || 0, riskLabel: 'Bất thường' },
  };
  return map[activeView] || map.overview;
}

function WorkspaceAccessCommandHero({ meta, activeView, data, workspaces, loading, submitting, onRefresh, onValidate }) {
  const snapshot = getViewSnapshot(activeView, data, workspaces);
  const HeroIcon = meta?.icon || LayoutGrid;
  return (
    <section className="workspace-access-wow-hero">
      <div className="workspace-access-wow-hero__aurora" />
      <div className="workspace-access-wow-hero__main">
        <div className="workspace-access-wow-kicker"><Command size={15} strokeWidth={2.4} /> Workspace Access Control Plane</div>
        <div className="workspace-access-wow-title-row">
          <span className="workspace-access-wow-hero__icon"><HeroIcon size={27} strokeWidth={2.35} /></span>
          <div>
            <h1>{meta.title}</h1>
            <p>{meta.desc}</p>
          </div>
        </div>
        <div className="workspace-access-wow-actions">
          <button type="button" className="staff-button staff-button--primary" onClick={onValidate} disabled={submitting}><ShieldCheck size={16} strokeWidth={2.25} /> Validate policy graph</button>
          <button type="button" className="staff-button staff-button--ghost" onClick={onRefresh} disabled={loading}><RefreshCw size={16} strokeWidth={2.25} /> Sync dữ liệu</button>
        </div>
      </div>
      <div className="workspace-access-wow-insights">
        <article><small>{snapshot.primaryLabel}</small><strong>{formatNumber(snapshot.primary || 0)}</strong><span><MonitorCheck size={14} /> registry</span></article>
        <article><small>{snapshot.secondLabel}</small><strong>{formatNumber(snapshot.second || 0)}</strong><span><CheckCircle2 size={14} /> healthy</span></article>
        <article className={snapshot.risk ? 'is-hot' : ''}><small>{snapshot.riskLabel}</small><strong>{formatNumber(snapshot.risk || 0)}</strong><span><ShieldAlert size={14} /> risk</span></article>
      </div>
      <div className="workspace-access-wow-status-strip">
        <span><Zap size={14} /> Live RBAC snapshot</span>
        <span><LockKeyhole size={14} /> Policy priority engine</span>
        <span><Workflow size={14} /> Navigation graph</span>
        <span><Eye size={14} /> Audit-ready UI</span>
      </div>
    </section>
  );
}

function WorkspaceAccessCommandTabs({ activeView }) {
  const groups = [
    { label: 'Bản đồ truy cập', items: ['overview', 'list', 'actor', 'role', 'user', 'department'] },
    { label: 'Điều khiển', items: ['policies', 'sidebar', 'navigation', 'preferences', 'check'] },
    { label: 'Giám sát', items: ['conflicts', 'diagnostics', 'audit'] },
  ];
  return (
    <section className="workspace-access-wow-tabs">
      {groups.map((group) => (
        <div key={group.label} className="workspace-access-wow-tabs__group">
          <strong>{group.label}</strong>
          <div>
            {group.items.map((id) => {
              const tab = VIEW_META[id];
              const Icon = tab.icon;
              return <Link key={id} className={activeView === id ? 'is-active' : ''} to={`/admin/workspace-access/${id}`}><Icon size={15} strokeWidth={2.25} /><span>{tab.label}</span></Link>;
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function OverviewView({ overview }) {
  const summary = overview?.summary || {};
  const coverage = overview?.workspace_coverage || [];
  const risks = overview?.risk_items || [];
  const diagnostics = overview?.diagnostics || {};
  return (
    <>
      <section className="workspace-access-metrics">
        <StatCard label="Workspace active" value={summary.active_workspaces || summary.total_workspaces} hint="registry khả dụng" icon={MonitorCheck} />
        <StatCard label="Role registry" value={summary.role_count} hint="nguồn RBAC" icon={ShieldCheck} tone="green" />
        <StatCard label="Policy allow" value={summary.policy_allow} hint="đang cho phép" icon={ShieldCheck} tone="cyan" />
        <StatCard label="Policy deny/hide" value={summary.policy_deny} hint="đang chặn" icon={ShieldBan} tone="red" />
        <StatCard label="Conflict" value={summary.policy_conflicts} hint="policy cần xử lý" icon={AlertTriangle} tone="amber" />
        <StatCard label="Preference lỗi" value={summary.invalid_preferences} hint="current/default sai" icon={UserCog} tone="violet" />
      </section>

      <section className="workspace-access-grid workspace-access-grid--two">
        <Panel title="Độ phủ workspace theo người dùng" eyebrow="Coverage realtime từ RBAC" icon={Network}>
          <div className="workspace-access-coverage">
            {coverage.length ? coverage.map((workspace) => (
              <div key={workspace.code}><span>{workspace.code}</span><div><i style={{ width: `${Math.min((workspace.user_count || 0) * 4, 100)}%` }} /></div><strong>{formatNumber(workspace.user_count)}</strong></div>
            )) : <EmptyState label="Chưa có coverage" />}
          </div>
        </Panel>
        <Panel title="Bảng rủi ro ưu tiên" eyebrow="Security posture" icon={ShieldAlert}>
          <div className="workspace-access-risk-list">
            {risks.length ? risks.map((item) => (
              <article key={`${item.type}-${item.subject}-${item.message}`}><Severity value={item.severity} /><strong>{item.subject}</strong><p>{item.message}</p><small>{item.recommendation}</small></article>
            )) : <EmptyState label="Không có rủi ro nổi bật" />}
          </div>
        </Panel>
      </section>

      <section className="workspace-access-metrics workspace-access-metrics--compact">
        <StatCard label="Diagnostics failed" value={diagnostics?.summary?.failed} hint="lỗi bắt buộc sửa" icon={AlertTriangle} tone="red" />
        <StatCard label="Diagnostics warning" value={diagnostics?.summary?.warnings} hint="cần rà soát" icon={ShieldAlert} tone="amber" />
        <StatCard label="Diagnostics OK" value={diagnostics?.summary?.ok} hint="đạt kiểm tra" icon={CheckCircle2} tone="green" />
      </section>

      <Panel title="Heatmap role x workspace" eyebrow="Ai có thể mở workspace nào" icon={TableProperties}>
        <RoleMatrix rows={overview?.role_workspace_matrix || []} />
      </Panel>
    </>
  );
}

function WorkspaceRegistryView({ workspaces }) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => workspaces.filter((workspace) => [workspace.code, workspace.name, workspace.route, workspace.group_key, workspace.roles?.join(' ')].some((value) => textIncludes(value, query))), [workspaces, query]);
  return (
    <Panel title="Registry workspace từ backend" eyebrow={`${rows.length}/${workspaces.length} workspace`} icon={MonitorCheck}>
      <Toolbar query={query} onQuery={setQuery} right={<span className="workspace-access-toolbar__badge"><Layers3 size={14} /> Có route + IAM + policy</span>} />
      <div className="workspace-access-registry">
        <div className="workspace-access-registry__head"><span>Workspace</span><span>Route</span><span>IAM</span><span>Policy</span><span>User</span><span>Risk</span></div>
        {rows.length ? rows.map((workspace) => (
          <div key={workspace.code} className="workspace-access-registry__row">
            <span><strong>{workspace.name}</strong><small>{workspace.code} · {workspace.group_key} · {workspace.status}</small></span>
            <code>{workspace.route}</code>
            <span>{formatNumber(workspace.roles?.length)} role · {formatNumber(workspace.permissions_any?.length + workspace.permission_prefixes?.length)} quyền</span>
            <span>{formatNumber(workspace.policy_count)} policy · {formatNumber(workspace.deny_policy_count)} deny</span>
            <span>{formatNumber(workspace.user_count)}</span>
            <Severity value={workspace.risk_level} />
          </div>
        )) : <EmptyState label="Không tìm thấy workspace phù hợp" />}
      </div>
    </Panel>
  );
}

function ActorView({ data }) {
  return (
    <Panel title="Ranh giới actor" eyebrow="Actor boundary" icon={UserRound}>
      <div className="workspace-access-actor-grid">
        {(data?.actor_types || []).map((actor) => (
          <article key={actor.actor_type} className={actor.boundary === 'internal-workspace' ? 'is-primary' : ''}>
            <div className="workspace-access-card-title"><UserRound size={16} /><h3>{actor.actor_type}</h3><Severity value={actor.boundary === 'internal-workspace' ? 'low' : 'medium'} /></div>
            <small>{actor.boundary}</small>
            <div className="workspace-access-chip-cloud">{actor.workspaces.map((workspace) => <WorkspaceChip key={workspace.code} workspace={workspace.code} allowed={workspace.allowed} />)}</div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function RoleMatrix({ rows = [] }) {
  const workspaceCodes = rows[0]?.workspaces?.map((workspace) => workspace.code) || [];
  if (!rows.length) return <EmptyState />;
  return (
    <div className="workspace-access-matrix-wrap">
      <div className="workspace-access-matrix">
        <div className="workspace-access-matrix__row workspace-access-matrix__head" style={{ gridTemplateColumns: `240px repeat(${workspaceCodes.length}, 92px)` }}><span>Vai trò</span>{workspaceCodes.map((code) => <span key={code}>{code}</span>)}</div>
        {rows.map((role) => (
          <div key={role.role_code} className="workspace-access-matrix__row" style={{ gridTemplateColumns: `240px repeat(${workspaceCodes.length}, 92px)` }}>
            <span><strong>{role.role_code}</strong><small>{role.workspace_count} workspace · {role.permission_count} quyền</small></span>
            {role.workspaces.map((workspace) => <span key={workspace.code} className={workspace.allowed ? 'is-allowed' : 'is-denied'} title={workspace.reason}>{workspace.allowed ? (workspace.source || 'A') : '—'}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleView({ data }) {
  const rows = data?.roles || [];
  const top = rows.slice().sort((a, b) => (b.workspace_count || 0) - (a.workspace_count || 0)).slice(0, 4);
  return <><section className="workspace-access-metrics workspace-access-metrics--compact"><StatCard label="Role có workspace" value={rows.length} hint="đang được rà soát" icon={ShieldCheck} /><StatCard label="Mở rộng nhất" value={top[0]?.workspace_count || 0} hint={top[0]?.role_code || 'n/a'} icon={Gauge} tone="amber" /><StatCard label="Workspace" value={data?.workspaces?.length} hint="trong registry" icon={MonitorCheck} tone="green" /></section><Panel title="Workspace theo vai trò" eyebrow="Matrix quyền hiệu lực" icon={ShieldCheck}><RoleMatrix rows={rows} /></Panel></>;
}

function UserView({ data }) {
  const [query, setQuery] = useState('');
  const users = useMemo(() => (data?.items || []).filter((user) => [user.full_name, user.username, user.email, user.employee_code, user.department_name, user.roles?.join(' ')].some((value) => textIncludes(value, query))), [data, query]);
  return (
    <Panel title="Workspace hiệu lực theo người dùng" eyebrow={`${users.length}/${data?.pagination?.total || data?.items?.length || 0} nhân sự`} icon={UsersRound}>
      <Toolbar query={query} onQuery={setQuery} right={<span className="workspace-access-toolbar__badge"><CheckCircle2 size={14} /> kiểm tra current_workspace</span>} />
      <div className="workspace-access-user-table">
        <div className="workspace-access-user-table__head"><span>Người dùng</span><span>Khoa</span><span>Vai trò</span><span>Hiện tại</span><span>Có thể dùng</span><span>Hợp lệ</span></div>
        {users.length ? users.map((user) => (
          <div key={user.user_id} className="workspace-access-user-table__row">
            <span><strong>{user.full_name || user.username}</strong><small>{user.employee_code || user.email || user.username}</small></span>
            <span>{user.department_name || 'Chưa có'}</span>
            <span>{user.roles?.slice(0, 4).join(', ') || 'Không có vai trò'}{user.roles?.length > 4 ? ` +${user.roles.length - 4}` : ''}</span>
            <WorkspaceChip workspace={user.current_workspace || 'none'} allowed={!user.invalid_current_workspace} />
            <span className="workspace-access-chip-cloud">{user.available_workspaces?.slice(0, 6).map((workspace) => <WorkspaceChip key={workspace.code} workspace={workspace.code} />)}</span>
            <Severity value={user.invalid_current_workspace ? 'high' : 'low'} />
          </div>
        )) : <EmptyState label="Không tìm thấy nhân sự" />}
      </div>
    </Panel>
  );
}

function DepartmentView({ data }) {
  return (
    <Panel title="Workspace theo khoa/phòng" eyebrow="Department mapping" icon={Building2}>
      <div className="workspace-access-department-grid">
        {(data?.departments || []).map((department) => (
          <article key={department.department_id}>
            <div className="workspace-access-card-title"><Building2 size={16} /><strong>{department.department_name}</strong><Severity value={department.status || 'active'} /></div>
            <small>{department.department_code || department.department_type || 'department'} · {formatNumber(department.active_staff_count)} active / {formatNumber(department.staff_count)} total</small>
            <div className="workspace-access-department-default"><span>Mặc định</span><WorkspaceChip workspace={department.default_workspace} /></div>
            <div className="workspace-access-chip-cloud">{department.allowed_workspaces?.map((workspace) => <WorkspaceChip key={workspace.code} workspace={workspace.code} />)}</div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function PolicyView({ policies, workspaces, onCreatePolicy, onValidate, onDisablePolicy, onDeletePolicy, submitting }) {
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ policy_name: '', workspace_code: workspaces[0]?.code || 'admin', subject_type: 'role', subject_code: 'cashier', effect: 'deny', priority: 500, reason: '' });
  useEffect(() => { if (!workspaces.some((item) => item.code === form.workspace_code) && workspaces[0]) setForm((current) => ({ ...current, workspace_code: workspaces[0].code })); }, [workspaces]);
  const rows = useMemo(() => (policies?.items || []).filter((policy) => [policy.policy_name, policy.workspace_code, policy.subject_type, policy.subject_code, policy.effect, policy.reason, policy.status].some((value) => textIncludes(value, query))), [policies, query]);
  return (
    <section className="workspace-access-grid workspace-access-grid--policy">
      <Panel title="Tạo chính sách nhanh" eyebrow="Allow / deny / hide / readonly" icon={KeyRound}>
        <div className="workspace-access-policy-form">
          <label><span>Tên chính sách</span><input value={form.policy_name} onChange={(event) => setForm({ ...form, policy_name: event.target.value })} placeholder="VD: Chặn cashier khỏi reports" /></label>
          <label><span>Workspace</span><select value={form.workspace_code} onChange={(event) => setForm({ ...form, workspace_code: event.target.value })}>{workspaces.map((workspace) => <option key={workspace.code} value={workspace.code}>{workspace.code} · {workspace.name}</option>)}</select></label>
          <label><span>Loại chủ thể</span><select value={form.subject_type} onChange={(event) => setForm({ ...form, subject_type: event.target.value })}><option value="role">Vai trò</option><option value="user">Người dùng</option><option value="department">Khoa/phòng</option><option value="permission">Quyền</option><option value="permission_prefix">Tiền tố quyền</option><option value="actor_type">Loại actor</option></select></label>
          <label><span>Mã chủ thể</span><input value={form.subject_code} onChange={(event) => setForm({ ...form, subject_code: event.target.value })} placeholder="role_code / username / permission" /></label>
          <label><span>Hiệu lực</span><select value={form.effect} onChange={(event) => setForm({ ...form, effect: event.target.value })}><option value="allow">Cho phép</option><option value="deny">Chặn</option><option value="hide">Ẩn</option><option value="readonly">Chỉ đọc</option></select></label>
          <label><span>Độ ưu tiên</span><input type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /></label>
          <label className="workspace-access-policy-form__wide"><span>Lý do</span><textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Ghi rõ lý do nghiệp vụ để audit dễ hiểu." /></label>
          <button type="button" className="staff-button staff-button--primary" disabled={submitting || !form.policy_name || !form.subject_code} onClick={() => onCreatePolicy(form)}><KeyRound size={16} strokeWidth={2.25} /> Tạo chính sách</button>
          <button type="button" className="staff-button staff-button--ghost" disabled={submitting} onClick={onValidate}><CheckCircle2 size={16} strokeWidth={2.25} /> Kiểm tra conflict</button>
        </div>
      </Panel>
      <Panel title="Bảng chính sách" eyebrow={`${rows.length}/${policies?.pagination?.total || policies?.items?.length || 0} policy`} icon={Database}>
        <Toolbar query={query} onQuery={setQuery} right={<span className="workspace-access-toolbar__badge"><ShieldAlert size={14} /> ưu tiên cao thắng</span>} />
        <div className="workspace-access-policy-list workspace-access-policy-list--pro">
          {rows.length ? rows.map((policy) => (
            <article key={policy.policy_id}>
              <div><Severity value={policy.effect} /><Severity value={policy.status || 'active'} /></div>
              <strong>{policy.policy_name}</strong>
              <small>{policy.workspace_code} · {policy.subject_type}:{policy.subject_code || policy.subject_id} · priority {policy.priority}</small>
              <p>{policy.reason || 'Không có lý do.'}</p>
              <footer><button type="button" className="staff-button staff-button--ghost" disabled={submitting || policy.status !== 'active'} onClick={() => onDisablePolicy(policy)}>Vô hiệu hóa</button><button type="button" className="staff-button staff-button--danger" disabled={submitting} onClick={() => onDeletePolicy(policy)}><Trash2 size={15} /> Xóa mềm</button></footer>
            </article>
          )) : <EmptyState label="Không tìm thấy policy" />}
        </div>
      </Panel>
    </section>
  );
}

function SidebarView({ data }) {
  return <Panel title="Xem trước cấu hình sidebar" eyebrow="Generated sidebar config" icon={SlidersHorizontal}><div className="workspace-access-sidebar-grid">{(data?.items || []).map((config) => <article key={config.workspace_code}><div className="workspace-access-card-title"><SlidersHorizontal size={16} /><strong>{config.workspace_name || config.workspace_code}</strong><Severity value={config.status} /></div><small>{config.actor_type} · {config.version} · {formatNumber(config.item_count || config.items?.length)} items</small><div>{config.items?.map((item) => <span key={item.key}>{item.label}<small>{item.route}</small></span>)}</div></article>)}</div></Panel>;
}

function NavigationView({ data }) {
  return <Panel title="Bản đồ điều hướng cross-workspace" eyebrow="Navigation rules" icon={Router}><div className="workspace-access-navigation-list">{(data?.items || []).map((rule) => <article key={rule.rule_id}><Link2 size={17} strokeWidth={2.25} /><div><strong>{rule.from_workspace} <ChevronRight size={14} /> {rule.to_workspace}</strong><small>{rule.source_entity_type} → {rule.target_entity_type} · {rule.action_key} · {rule.open_mode}</small><code>{rule.route_template}</code></div><Severity value={rule.risk_level} /></article>)}</div></Panel>;
}

function PreferenceView({ data }) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => (data?.items || []).filter((item) => [item.user?.full_name, item.user?.username, item.actor_id, item.current_workspace, item.default_workspace, item.pinned_workspaces?.join(' ')].some((value) => textIncludes(value, query))), [data, query]);
  return <Panel title="Tùy chọn người dùng / workspace mặc định" eyebrow={`${rows.length}/${data?.pagination?.total || data?.items?.length || 0} preference`} icon={UserCog}><Toolbar query={query} onQuery={setQuery} right={<span className="workspace-access-toolbar__badge"><UserCog size={14} /> current/default/pinned</span>} /><div className="workspace-access-user-table workspace-access-user-table--preferences"><div className="workspace-access-user-table__head"><span>Người dùng</span><span>Hiện tại</span><span>Mặc định</span><span>Ghim</span><span>Ẩn</span><span>Hợp lệ</span></div>{rows.length ? rows.map((item) => <div key={item.preference_id} className="workspace-access-user-table__row"><span><strong>{item.user?.full_name || item.user?.username || item.actor_id}</strong><small>{item.actor_type} · cập nhật {formatDateTime(item.updated_at)}</small></span><WorkspaceChip workspace={item.current_workspace || 'none'} allowed={item.valid} /><WorkspaceChip workspace={item.default_workspace || 'none'} allowed={item.valid} /><span>{item.pinned_workspaces?.join(', ') || 'Không có'}</span><span>{item.hidden_workspaces?.join(', ') || 'Không có'}</span><Severity value={item.valid ? 'low' : 'high'} /></div>) : <EmptyState label="Không tìm thấy preference" />}</div></Panel>;
}

function CheckView({ workspaces }) {
  const [form, setForm] = useState({ workspace_code: workspaces[0]?.code || 'admin', role_code: 'cashier', user_id: '', permissions: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (!workspaces.some((item) => item.code === form.workspace_code) && workspaces[0]) setForm((current) => ({ ...current, workspace_code: workspaces[0].code })); }, [workspaces]);
  async function handleCheck() {
    setLoading(true); setError('');
    try {
      const payload = form.user_id ? { workspace_code: form.workspace_code, user_id: form.user_id } : { workspace_code: form.workspace_code, roles: form.role_code.split(',').map((item) => item.trim()).filter(Boolean), permissions: form.permissions.split(',').map((item) => item.trim()).filter(Boolean) };
      setResult(await explainWorkspaceAccess(payload));
    } catch (checkError) { setError(checkError.message); } finally { setLoading(false); }
  }
  return <section className="workspace-access-grid workspace-access-grid--two"><Panel title="Mô phỏng truy cập" eyebrow="Decision input" icon={Fingerprint}><div className="workspace-access-policy-form"><label><span>Workspace</span><select value={form.workspace_code} onChange={(event) => setForm({ ...form, workspace_code: event.target.value })}>{workspaces.map((workspace) => <option key={workspace.code} value={workspace.code}>{workspace.code} · {workspace.name}</option>)}</select></label><label><span>Role code</span><input value={form.role_code} onChange={(event) => setForm({ ...form, role_code: event.target.value })} placeholder="cashier, doctor" /></label><label className="workspace-access-policy-form__wide"><span>Permission code bổ sung</span><input value={form.permissions} onChange={(event) => setForm({ ...form, permissions: event.target.value })} placeholder="users.read, reports.read" /></label><label className="workspace-access-policy-form__wide"><span>User ID thay thế</span><input value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })} placeholder="Mongo user id nếu muốn kiểm tra user thật" /></label><button type="button" className="staff-button staff-button--primary" disabled={loading} onClick={handleCheck}><Fingerprint size={16} strokeWidth={2.25} /> Kiểm tra</button></div>{error ? <p className="form-message error">{error}</p> : null}</Panel><Panel title="Cây quyết định" eyebrow={result?.final_decision || 'Chưa có kết quả'} icon={result?.allowed ? CheckCircle2 : ShieldAlert}>{result ? <div className="workspace-access-explain"><span className={`workspace-access-decision ${result.allowed ? 'is-allowed' : 'is-denied'}`}>{result.final_decision}</span><strong>{result.workspace?.name || result.workspace_code}</strong><p>{result.reason}</p><div className="workspace-access-chip-cloud">{result.matched_roles?.map((role) => <WorkspaceChip key={role} workspace={`role:${role}`} />)}{result.matched_permissions?.map((permission) => <WorkspaceChip key={permission} workspace={permission} />)}{result.matched_prefixes?.map((prefix) => <WorkspaceChip key={prefix} workspace={prefix} />)}</div><ol>{result.explain?.map((line) => <li key={line}>{line}</li>)}</ol></div> : <EmptyState label="Chưa chạy mô phỏng" hint="Nhập role hoặc user id rồi nhấn kiểm tra." />}</Panel></section>;
}

function ConflictsView({ data }) {
  const summary = data?.summary || {};
  return <><section className="workspace-access-metrics workspace-access-metrics--compact"><StatCard label="Conflict" value={summary.total_conflicts} hint="allow vs deny" icon={AlertTriangle} tone="red" /><StatCard label="Policy hết hạn" value={summary.expired_active_policies} hint="vẫn active" icon={FileClock} tone="amber" /><StatCard label="Duplicate" value={summary.duplicate_policies} hint="cần dọn" icon={Layers3} /></section><Panel title="Xung đột chính sách truy cập" eyebrow="Conflict scanner" icon={AlertTriangle}><div className="workspace-access-policy-list">{(data?.items || []).length ? data.items.map((item) => <article key={item.conflict_id}><Severity value={item.severity} /><strong>{item.conflict_type} · {item.workspace_code}</strong><small>{item.subject_type}:{item.subject} · final {item.final_decision}</small><p>{item.recommendation}</p></article>) : <EmptyState label="Không phát hiện conflict policy" hint="Backend chưa thấy allow/deny mâu thuẫn trong policy active." />}</div></Panel></>;
}

function DiagnosticsView({ data, onRun, submitting }) {
  const items = data?.items || [];
  return <Panel title="Chẩn đoán workspace" eyebrow="Registry, IAM, preference, policy" icon={Activity} action={<button type="button" className="staff-button staff-button--ghost" disabled={submitting} onClick={onRun}><RefreshCw size={15} strokeWidth={2.25} /> Chạy diagnostics</button>}><section className="workspace-access-metrics workspace-access-metrics--compact"><StatCard label="Lỗi" value={data?.summary?.failed} hint="cần sửa" icon={AlertTriangle} tone="red" /><StatCard label="Cảnh báo" value={data?.summary?.warnings} hint="cần rà soát" icon={ShieldAlert} tone="amber" /><StatCard label="OK" value={data?.summary?.ok} hint="đạt" icon={CheckCircle2} tone="green" /></section><div className="workspace-access-diagnostics">{items.length ? items.map((item) => <article key={item.check_key}><Severity value={item.severity} /><strong>{item.message}</strong><small>{item.group} · {item.workspace_code}</small><p>{item.recommendation}</p></article>) : <EmptyState label="Diagnostics không có lỗi" />}</div></Panel>;
}

function AuditView({ data }) {
  return <Panel title="Audit workspace" eyebrow="workspace.* event timeline" icon={FileClock}><div className="workspace-access-audit-list">{(data || []).length ? data.map((item) => <article key={item.audit_log_id}><span>{formatDateTime(item.created_at)}</span><strong>{item.action}</strong><small>{item.actor_type}:{item.actor_id || 'system'} · {item.ip_address || 'no-ip'} · {item.status}</small><p>{item.message || 'Không có message.'}</p></article>) : <EmptyState label="Chưa có workspace audit" />}</div></Panel>;
}

export function WorkspaceAccessControlPlanePage({ view = 'overview' }) {
  const activeView = VIEW_META[view] ? view : 'overview';
  const meta = VIEW_META[activeView];
  const [data, setData] = useState({});
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmPolicy, setConfirmPolicy] = useState(null);

  const viewLoaders = useMemo(() => ({ overview: getWorkspaceAccessOverview, list: listWorkspaceRegistry, actor: getWorkspaceByActor, role: getWorkspaceByRole, user: () => getWorkspaceByUser('limit=80'), department: getWorkspaceByDepartment, policies: () => listWorkspacePolicies('limit=80'), sidebar: getWorkspaceSidebars, navigation: getWorkspaceNavigationRules, preferences: () => getWorkspacePreferences('limit=80'), check: getWorkspaceAccessOverview, conflicts: getWorkspaceConflicts, diagnostics: getWorkspaceDiagnostics, audit: getWorkspaceAudit }), []);

  async function loadView() {
    setLoading(true); setError('');
    try {
      const [registry, viewData] = await Promise.all([listWorkspaceRegistry(), (viewLoaders[activeView] || getWorkspaceAccessOverview)()]);
      setWorkspaces(registry?.items || []); setData(viewData || {});
    } catch (loadError) { setError(loadError.message); } finally { setLoading(false); }
  }
  useEffect(() => { loadView(); }, [activeView]);

  async function handleCreatePolicy(payload) { setSubmitting(true); setError(''); setMessage(''); try { await createWorkspacePolicy(payload); setMessage('Đã tạo workspace access policy.'); await loadView(); } catch (submitError) { setError(submitError.message); } finally { setSubmitting(false); } }
  function requestCreatePolicy(payload) { setConfirmPolicy({ type: 'create', payload, title: 'Tạo chính sách truy cập workspace?', description: 'Chính sách mới có thể cho phép, chặn, ẩn hoặc giới hạn workspace đối với user/role/khoa. Hãy xác nhận phạm vi trước khi tạo.', confirmLabel: 'Tạo chính sách', tone: payload.effect === 'deny' || payload.effect === 'hide' ? 'danger' : 'warning', details: [{ label: 'Workspace', value: payload.workspace_code }, { label: 'Chủ thể', value: `${payload.subject_type}:${payload.subject_code || payload.subject_id || 'Chưa có'}` }, { label: 'Hiệu lực', value: payload.effect }, { label: 'Lý do', value: payload.reason || 'Chưa nhập' }] }); }
  function requestDisablePolicy(policy) { setConfirmPolicy({ type: 'disable', policy, title: 'Vô hiệu hóa policy?', description: 'Policy sẽ được chuyển sang trạng thái inactive nhưng vẫn giữ lại audit/truy vết.', confirmLabel: 'Vô hiệu hóa', tone: 'warning', details: [{ label: 'Policy', value: policy.policy_name }, { label: 'Workspace', value: policy.workspace_code }, { label: 'Hiệu lực', value: policy.effect }] }); }
  function requestDeletePolicy(policy) { setConfirmPolicy({ type: 'delete', policy, title: 'Xóa mềm policy?', description: 'Policy sẽ bị xóa mềm khỏi danh sách active. Audit vẫn được ghi lại ở backend.', confirmLabel: 'Xóa mềm', tone: 'danger', details: [{ label: 'Policy', value: policy.policy_name }, { label: 'Workspace', value: policy.workspace_code }, { label: 'Chủ thể', value: `${policy.subject_type}:${policy.subject_code || policy.subject_id}` }] }); }
  async function handlePolicyAction() { const item = confirmPolicy; if (!item) return; setSubmitting(true); setError(''); setMessage(''); try { if (item.type === 'create') { await createWorkspacePolicy(item.payload); setMessage('Đã tạo workspace access policy.'); } if (item.type === 'disable') { await updateWorkspacePolicy(item.policy.policy_id, { ...item.policy, status: 'inactive' }); setMessage('Đã vô hiệu hóa policy.'); } if (item.type === 'delete') { await deleteWorkspacePolicy(item.policy.policy_id); setMessage('Đã xóa mềm policy.'); } setConfirmPolicy(null); await loadView(); } catch (submitError) { setError(submitError.message); } finally { setSubmitting(false); } }
  async function handleValidatePolicies() { setSubmitting(true); setError(''); setMessage(''); try { const result = await validateWorkspacePolicies(); setMessage(result?.valid ? 'Policy hợp lệ, chưa phát hiện conflict nghiêm trọng.' : 'Policy có conflict hoặc diagnostics cần xử lý.'); } catch (submitError) { setError(submitError.message); } finally { setSubmitting(false); } }
  async function handleRunDiagnostics() { setSubmitting(true); setError(''); setMessage(''); try { setData(await runWorkspaceDiagnostics()); setMessage('Đã chạy workspace diagnostics.'); } catch (submitError) { setError(submitError.message); } finally { setSubmitting(false); } }

  return (
    <div className="workspace-access-page">
      <WorkspaceAccessCommandHero meta={meta} activeView={activeView} data={data} workspaces={workspaces} loading={loading} submitting={submitting} onRefresh={loadView} onValidate={handleValidatePolicies} />

      <WorkspaceAccessCommandTabs activeView={activeView} />
      {message ? <p className="workspace-access-banner workspace-access-banner--success">{message}</p> : null}
      {error ? <p className="workspace-access-banner workspace-access-banner--error">{error}</p> : null}
      {loading ? <p className="workspace-access-banner">Đang tải dữ liệu Workspace Access Control Plane...</p> : null}

      {activeView === 'overview' ? <OverviewView overview={data} /> : null}
      {activeView === 'list' ? <WorkspaceRegistryView workspaces={pickArray(data, ['items'])} /> : null}
      {activeView === 'actor' ? <ActorView data={data} /> : null}
      {activeView === 'role' ? <RoleView data={data} /> : null}
      {activeView === 'user' ? <UserView data={data} /> : null}
      {activeView === 'department' ? <DepartmentView data={data} /> : null}
      {activeView === 'policies' ? <PolicyView policies={data} workspaces={workspaces} onCreatePolicy={requestCreatePolicy} onValidate={handleValidatePolicies} onDisablePolicy={requestDisablePolicy} onDeletePolicy={requestDeletePolicy} submitting={submitting} /> : null}
      {activeView === 'sidebar' ? <SidebarView data={data} /> : null}
      {activeView === 'navigation' ? <NavigationView data={data} /> : null}
      {activeView === 'preferences' ? <PreferenceView data={data} /> : null}
      {activeView === 'check' ? <CheckView workspaces={workspaces} /> : null}
      {activeView === 'conflicts' ? <ConflictsView data={data} /> : null}
      {activeView === 'diagnostics' ? <DiagnosticsView data={data} onRun={handleRunDiagnostics} submitting={submitting} /> : null}
      {activeView === 'audit' ? <AuditView data={data} /> : null}
      <AdminActionConfirmDialog open={Boolean(confirmPolicy)} title={confirmPolicy?.title} description={confirmPolicy?.description} tone={confirmPolicy?.tone} confirmLabel={confirmPolicy?.confirmLabel} details={confirmPolicy?.details} reasonRequired={false} submitting={submitting} onCancel={() => setConfirmPolicy(null)} onConfirm={handlePolicyAction} />
    </div>
  );
}
