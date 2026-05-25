import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  FileClock,
  Fingerprint,
  KeyRound,
  LayoutGrid,
  Link2,
  MonitorCheck,
  Network,
  RefreshCw,
  Router,
  Search,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  SlidersHorizontal,
  TableProperties,
  UserCog,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminActionConfirmDialog } from '../../components/AdminActionConfirmDialog';
import {
  createWorkspacePolicy,
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
  validateWorkspacePolicies,
} from '../workspaceAccessApi';
import { formatDateTime, formatNumber } from '../../staff/staffUi';

const VIEW_META = {
  overview: { label: 'Tổng quan', title: 'Tổng quan workspace access', icon: LayoutGrid },
  list: { label: 'Workspace', title: 'Danh sách workspace', icon: MonitorCheck },
  actor: { label: 'Theo actor', title: 'Workspace theo actor', icon: UserRound },
  role: { label: 'Theo vai trò', title: 'Workspace theo vai trò', icon: ShieldCheck },
  user: { label: 'Theo người dùng', title: 'Workspace theo người dùng', icon: UsersRound },
  department: { label: 'Theo khoa', title: 'Workspace theo khoa', icon: Building2 },
  policies: { label: 'Chính sách truy cập', title: 'Quyền truy cập workspace', icon: KeyRound },
  sidebar: { label: 'Sidebar', title: 'Cấu hình sidebar theo actor', icon: SlidersHorizontal },
  navigation: { label: 'Điều hướng', title: 'Điều hướng cross-workspace', icon: Router },
  preferences: { label: 'Tùy chọn', title: 'Tùy chọn người dùng / workspace mặc định', icon: UserCog },
  check: { label: 'Mô phỏng', title: 'Kiểm tra khả dụng workspace', icon: CheckCircle2 },
  conflicts: { label: 'Xung đột', title: 'Xung đột chính sách truy cập', icon: AlertTriangle },
  diagnostics: { label: 'Chẩn đoán', title: 'Chẩn đoán workspace', icon: Activity },
  audit: { label: 'Audit', title: 'Workspace audit', icon: FileClock },
};

const VIEW_TABS = Object.entries(VIEW_META).map(([id, meta]) => ({ id, ...meta }));

function pickArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

function MetricCard({ label, value, hint, icon: Icon, tone = 'blue' }) {
  return (
    <article className={`workspace-access-metric workspace-access-metric--${tone}`}>
      <span className="workspace-access-metric__icon">
        <Icon size={19} strokeWidth={2.25} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{formatNumber(value)}</strong>
        <em>{hint}</em>
      </div>
    </article>
  );
}

function WorkspaceChip({ workspace, allowed = true, source }) {
  return (
    <span className={`workspace-access-chip${allowed ? ' is-allowed' : ' is-denied'}`}>
      {workspace?.code || workspace}
      {source ? <em>{source}</em> : null}
    </span>
  );
}

function Panel({ title, eyebrow, icon: Icon = Database, children, action }) {
  return (
    <section className="workspace-access-panel">
      <div className="workspace-access-panel__head">
        <div>
          <span>{eyebrow}</span>
          <strong>{title}</strong>
        </div>
        {action || <Icon size={18} strokeWidth={2.25} />}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ label = 'Chưa có dữ liệu' }) {
  return (
    <div className="workspace-access-empty">
      <Search size={24} strokeWidth={2.25} />
      <strong>{label}</strong>
    </div>
  );
}

function OverviewView({ overview }) {
  const summary = overview?.summary || {};
  const coverage = overview?.workspace_coverage || [];
  const risks = overview?.risk_items || [];
  const matrix = overview?.role_workspace_matrix || [];

  return (
    <>
      <section className="workspace-access-metrics">
        <MetricCard label="Workspace" value={summary.total_workspaces} hint="registry đang hoạt động" icon={MonitorCheck} />
        <MetricCard label="Vai trò" value={summary.role_count} hint="nguồn RBAC" icon={ShieldCheck} tone="green" />
        <MetricCard label="Policy cho phép" value={summary.policy_allow} hint="active/draft" icon={ShieldCheck} tone="cyan" />
        <MetricCard label="Policy chặn" value={summary.policy_deny} hint="deny/hide" icon={ShieldBan} tone="red" />
        <MetricCard label="Xung đột" value={summary.policy_conflicts} hint="kết quả quét" icon={AlertTriangle} tone="amber" />
        <MetricCard label="Preference lỗi" value={summary.invalid_preferences} hint="current/default" icon={UserCog} tone="violet" />
      </section>

      <section className="workspace-access-grid workspace-access-grid--two">
        <Panel title="Độ phủ workspace" eyebrow="Người dùng theo workspace" icon={Network}>
          <div className="workspace-access-coverage">
            {coverage.map((workspace) => (
              <div key={workspace.code}>
                <span>{workspace.code}</span>
                <div><i style={{ width: `${Math.min((workspace.user_count || 0) * 4, 100)}%` }} /></div>
                <strong>{formatNumber(workspace.user_count)}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Bảng rủi ro truy cập" eyebrow="Tư thế bảo mật" icon={ShieldAlert}>
          <div className="workspace-access-risk-list">
            {risks.length ? risks.map((item) => (
              <article key={`${item.type}-${item.subject}-${item.message}`}>
                <span className={`workspace-access-severity workspace-access-severity--${item.severity}`}>{item.severity}</span>
                <strong>{item.subject}</strong>
                <p>{item.message}</p>
                <small>{item.recommendation}</small>
              </article>
            )) : <EmptyState label="Không có rủi ro nổi bật" />}
          </div>
        </Panel>
      </section>

      <Panel title="Heatmap độ phủ vai trò" eyebrow="Vai trò x Workspace" icon={TableProperties}>
        <RoleMatrix rows={matrix} />
      </Panel>
    </>
  );
}

function WorkspaceRegistryView({ workspaces }) {
  return (
    <Panel title="Registry từ workspace-access.service.js" eyebrow="Danh sách workspace" icon={MonitorCheck}>
      <div className="workspace-access-registry">
        <div className="workspace-access-registry__head">
          <span>Workspace</span><span>Route</span><span>Vai trò</span><span>Quyền</span><span>Người dùng</span><span>Rủi ro</span>
        </div>
        {workspaces.map((workspace) => (
          <div key={workspace.code} className="workspace-access-registry__row">
            <span>
              <strong>{workspace.name}</strong>
              <small>{workspace.code} · {workspace.group_key}</small>
            </span>
            <code>{workspace.route}</code>
            <span>{formatNumber(workspace.roles?.length)} vai trò</span>
            <span>{formatNumber(workspace.permissions_any?.length)} direct · {formatNumber(workspace.permission_prefixes?.length)} prefix</span>
            <span>{formatNumber(workspace.user_count)}</span>
            <span className={`workspace-access-severity workspace-access-severity--${workspace.risk_level}`}>{workspace.risk_level}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ActorView({ data }) {
  return (
    <Panel title="Ma trận ranh giới actor" eyebrow="Actor x Workspace" icon={UserRound}>
      <div className="workspace-access-actor-grid">
        {(data?.actor_types || []).map((actor) => (
          <article key={actor.actor_type}>
            <h3>{actor.actor_type}</h3>
            <small>{actor.boundary}</small>
            <div className="workspace-access-chip-cloud">
              {actor.workspaces.map((workspace) => (
                <WorkspaceChip key={workspace.code} workspace={workspace.code} allowed={workspace.allowed} />
              ))}
            </div>
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
    <div className="workspace-access-matrix">
      <div className="workspace-access-matrix__row workspace-access-matrix__head" style={{ gridTemplateColumns: `220px repeat(${workspaceCodes.length}, 82px)` }}>
        <span>Vai trò</span>
        {workspaceCodes.map((code) => <span key={code}>{code}</span>)}
      </div>
      {rows.map((role) => (
        <div key={role.role_code} className="workspace-access-matrix__row" style={{ gridTemplateColumns: `220px repeat(${workspaceCodes.length}, 82px)` }}>
          <span>
            <strong>{role.role_code}</strong>
            <small>{role.workspace_count} workspace · {role.permission_count} quyền</small>
          </span>
          {role.workspaces.map((workspace) => (
            <span key={workspace.code} className={workspace.allowed ? 'is-allowed' : 'is-denied'} title={workspace.reason}>
              {workspace.allowed ? workspace.source : 'D'}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function RoleView({ data }) {
  return (
    <Panel title="Workspace theo vai trò" eyebrow="Ma trận vai trò x workspace" icon={ShieldCheck}>
      <RoleMatrix rows={data?.roles || []} />
    </Panel>
  );
}

function UserView({ data }) {
  const users = data?.items || [];
  return (
    <Panel title="Workspace hiệu lực theo người dùng" eyebrow="Truy cập người dùng" icon={UsersRound}>
      <div className="workspace-access-user-table">
        <div className="workspace-access-user-table__head">
          <span>Người dùng</span><span>Khoa</span><span>Vai trò</span><span>Hiện tại</span><span>Có thể dùng</span><span>Hợp lệ</span>
        </div>
        {users.map((user) => (
          <div key={user.user_id} className="workspace-access-user-table__row">
            <span>
              <strong>{user.full_name || user.username}</strong>
              <small>{user.employee_code || user.email || user.username}</small>
            </span>
            <span>{user.department_name || 'Chưa có'}</span>
            <span>{user.roles?.slice(0, 3).join(', ') || 'Không có vai trò'}</span>
            <WorkspaceChip workspace={user.current_workspace || 'none'} allowed={!user.invalid_current_workspace} />
            <span className="workspace-access-chip-cloud">
              {user.available_workspaces?.slice(0, 5).map((workspace) => <WorkspaceChip key={workspace.code} workspace={workspace.code} />)}
            </span>
            <span className={`workspace-access-severity workspace-access-severity--${user.invalid_current_workspace ? 'high' : 'low'}`}>
              {user.invalid_current_workspace ? 'Không hợp lệ' : 'Hợp lệ'}
            </span>
          </div>
        ))}
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
            <div>
              <strong>{department.department_name}</strong>
              <small>{department.department_code || department.department_type || 'department'} · {department.active_staff_count} active staff</small>
            </div>
            <WorkspaceChip workspace={department.default_workspace} />
            <div className="workspace-access-chip-cloud">
              {department.allowed_workspaces?.map((workspace) => <WorkspaceChip key={workspace.code} workspace={workspace.code} />)}
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function PolicyView({ policies, workspaces, onCreatePolicy, onValidate, submitting }) {
  const [form, setForm] = useState({
    policy_name: '',
    workspace_code: 'billing',
    subject_type: 'role',
    subject_code: 'cashier',
    effect: 'deny',
    priority: 500,
    reason: '',
  });

  return (
    <section className="workspace-access-grid workspace-access-grid--policy">
      <Panel title="Tạo chính sách nhanh" eyebrow="Chính sách cho phép / chặn" icon={KeyRound}>
        <div className="workspace-access-policy-form">
          <label><span>Tên chính sách</span><input value={form.policy_name} onChange={(event) => setForm({ ...form, policy_name: event.target.value })} placeholder="Chặn cashier khỏi billing tạm thời" /></label>
          <label><span>Workspace</span><select value={form.workspace_code} onChange={(event) => setForm({ ...form, workspace_code: event.target.value })}>{workspaces.map((workspace) => <option key={workspace.code} value={workspace.code}>{workspace.code}</option>)}</select></label>
          <label><span>Loại chủ thể</span><select value={form.subject_type} onChange={(event) => setForm({ ...form, subject_type: event.target.value })}><option value="role">Vai trò</option><option value="user">Người dùng</option><option value="department">Khoa/phòng</option><option value="permission">Quyền</option><option value="permission_prefix">Tiền tố quyền</option><option value="actor_type">Loại actor</option></select></label>
          <label><span>Mã chủ thể</span><input value={form.subject_code} onChange={(event) => setForm({ ...form, subject_code: event.target.value })} /></label>
          <label><span>Hiệu lực</span><select value={form.effect} onChange={(event) => setForm({ ...form, effect: event.target.value })}><option value="allow">Cho phép</option><option value="deny">Chặn</option><option value="hide">Ẩn</option><option value="readonly">Chỉ đọc</option></select></label>
          <label><span>Độ ưu tiên</span><input type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /></label>
          <label className="workspace-access-policy-form__wide"><span>Lý do</span><textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
          <button type="button" className="staff-button staff-button--primary" disabled={submitting} onClick={() => onCreatePolicy(form)}>
            <KeyRound size={16} strokeWidth={2.25} /> Tạo chính sách
          </button>
          <button type="button" className="staff-button staff-button--ghost" disabled={submitting} onClick={onValidate}>
            <CheckCircle2 size={16} strokeWidth={2.25} /> Kiểm tra xung đột
          </button>
        </div>
      </Panel>

      <Panel title="Bảng chính sách" eyebrow="WorkspaceAccessPolicy" icon={Database}>
        <div className="workspace-access-policy-list">
          {(policies?.items || []).map((policy) => (
            <article key={policy.policy_id}>
              <span className={`workspace-access-severity workspace-access-severity--${policy.effect === 'deny' ? 'high' : 'low'}`}>{policy.effect}</span>
              <strong>{policy.policy_name}</strong>
              <small>{policy.workspace_code} · {policy.subject_type}:{policy.subject_code || policy.subject_id} · priority {policy.priority}</small>
              <p>{policy.reason || 'Không có lý do.'}</p>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function SidebarView({ data }) {
  return (
    <Panel title="Xem trước cấu hình sidebar" eyebrow="WorkspaceSidebarConfig" icon={SlidersHorizontal}>
      <div className="workspace-access-sidebar-grid">
        {(data?.items || []).map((config) => (
          <article key={config.workspace_code}>
            <strong>{config.workspace_code}</strong>
            <small>{config.actor_type} · {config.status} · {config.version}</small>
            <div>
              {config.items?.map((item) => <span key={item.key}>{item.label}</span>)}
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function NavigationView({ data }) {
  return (
    <Panel title="Bản đồ điều hướng cross-workspace" eyebrow="Quy tắc điều hướng" icon={Router}>
      <div className="workspace-access-navigation-list">
        {(data?.items || []).map((rule) => (
          <article key={rule.rule_id}>
            <Link2 size={17} strokeWidth={2.25} />
            <div>
              <strong>{rule.from_workspace} → {rule.to_workspace}</strong>
              <small>{rule.source_entity_type} · {rule.action_key} · {rule.open_mode}</small>
              <code>{rule.route_template}</code>
            </div>
            <span className={`workspace-access-severity workspace-access-severity--${rule.risk_level}`}>{rule.risk_level}</span>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function PreferenceView({ data }) {
  return (
    <Panel title="Tùy chọn người dùng / workspace mặc định" eyebrow="Tính hợp lệ current_workspace" icon={UserCog}>
      <div className="workspace-access-user-table">
        <div className="workspace-access-user-table__head">
          <span>Người dùng</span><span>Hiện tại</span><span>Mặc định</span><span>Ghim</span><span>Ẩn</span><span>Hợp lệ</span>
        </div>
        {(data?.items || []).map((item) => (
          <div key={item.preference_id} className="workspace-access-user-table__row">
            <span><strong>{item.user?.full_name || item.user?.username || item.actor_id}</strong><small>{item.actor_type}</small></span>
            <WorkspaceChip workspace={item.current_workspace || 'none'} allowed={item.valid} />
            <WorkspaceChip workspace={item.default_workspace || 'none'} allowed={item.valid} />
            <span>{item.pinned_workspaces?.join(', ') || 'Không có'}</span>
            <span>{item.hidden_workspaces?.join(', ') || 'Không có'}</span>
            <span className={`workspace-access-severity workspace-access-severity--${item.valid ? 'low' : 'high'}`}>{item.valid ? 'Hợp lệ' : 'Không hợp lệ'}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CheckView({ workspaces }) {
  const [form, setForm] = useState({ workspace_code: 'billing', role_code: 'cashier', user_id: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCheck() {
    setLoading(true);
    setError('');
    try {
      setResult(await explainWorkspaceAccess(form.user_id ? { workspace_code: form.workspace_code, user_id: form.user_id } : form));
    } catch (checkError) {
      setError(checkError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="workspace-access-grid workspace-access-grid--two">
      <Panel title="Mô phỏng truy cập" eyebrow="Giải thích quyền workspace" icon={Fingerprint}>
        <div className="workspace-access-policy-form">
          <label><span>Workspace</span><select value={form.workspace_code} onChange={(event) => setForm({ ...form, workspace_code: event.target.value })}>{workspaces.map((workspace) => <option key={workspace.code} value={workspace.code}>{workspace.code}</option>)}</select></label>
          <label><span>Mã vai trò</span><input value={form.role_code} onChange={(event) => setForm({ ...form, role_code: event.target.value })} placeholder="cashier" /></label>
          <label><span>User ID thay thế</span><input value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })} placeholder="Mongo user id nếu muốn kiểm tra user thật" /></label>
          <button type="button" className="staff-button staff-button--primary" disabled={loading} onClick={handleCheck}>
            <Fingerprint size={16} strokeWidth={2.25} /> Kiểm tra
          </button>
        </div>
        {error ? <p className="form-message error">{error}</p> : null}
      </Panel>
      <Panel title="Cây quyết định" eyebrow={result?.final_decision || 'Chưa có kết quả'} icon={result?.allowed ? CheckCircle2 : ShieldAlert}>
        {result ? (
          <div className="workspace-access-explain">
            <span className={`workspace-access-decision ${result.allowed ? 'is-allowed' : 'is-denied'}`}>{result.final_decision}</span>
            <strong>{result.workspace?.name}</strong>
            <p>{result.reason}</p>
            <div className="workspace-access-chip-cloud">
              {result.matched_roles?.map((role) => <WorkspaceChip key={role} workspace={`role:${role}`} />)}
              {result.matched_permissions?.map((permission) => <WorkspaceChip key={permission} workspace={permission} />)}
              {result.matched_prefixes?.map((prefix) => <WorkspaceChip key={prefix} workspace={prefix} />)}
            </div>
            <ol>{result.explain?.map((line) => <li key={line}>{line}</li>)}</ol>
          </div>
        ) : <EmptyState label="Chưa chạy mô phỏng" />}
      </Panel>
    </section>
  );
}

function ConflictsView({ data }) {
  return (
    <Panel title="Xung đột chính sách truy cập" eyebrow="Bộ quét xung đột" icon={AlertTriangle}>
      <div className="workspace-access-policy-list">
        {(data?.items || []).length ? data.items.map((item) => (
          <article key={item.conflict_id}>
            <span className="workspace-access-severity workspace-access-severity--high">{item.severity}</span>
            <strong>{item.conflict_type} · {item.workspace_code}</strong>
            <small>{item.subject_type}:{item.subject} · final {item.final_decision}</small>
            <p>{item.recommendation}</p>
          </article>
        )) : <EmptyState label="Không phát hiện conflict policy" />}
      </div>
    </Panel>
  );
}

function DiagnosticsView({ data, onRun, submitting }) {
  const items = data?.items || [];
  return (
    <Panel
      title="Chẩn đoán workspace"
      eyebrow="Registry, IAM, tùy chọn, chính sách"
      icon={Activity}
      action={<button type="button" className="staff-button staff-button--ghost" disabled={submitting} onClick={onRun}><RefreshCw size={15} strokeWidth={2.25} /> Chạy</button>}
    >
      <section className="workspace-access-metrics workspace-access-metrics--compact">
        <MetricCard label="Lỗi" value={data?.summary?.failed} hint="cần sửa" icon={AlertTriangle} tone="red" />
        <MetricCard label="Cảnh báo" value={data?.summary?.warnings} hint="cần rà soát" icon={ShieldAlert} tone="amber" />
        <MetricCard label="OK" value={data?.summary?.ok} hint="đạt" icon={CheckCircle2} tone="green" />
      </section>
      <div className="workspace-access-diagnostics">
        {items.length ? items.map((item) => (
          <article key={item.check_key}>
            <span className={`workspace-access-severity workspace-access-severity--${item.severity}`}>{item.status}</span>
            <strong>{item.message}</strong>
            <small>{item.group} · {item.workspace_code}</small>
            <p>{item.recommendation}</p>
          </article>
        )) : <EmptyState label="Diagnostics không có lỗi" />}
      </div>
    </Panel>
  );
}

function AuditView({ data }) {
  return (
    <Panel title="Audit workspace" eyebrow="Sự kiện workspace.*" icon={FileClock}>
      <div className="workspace-access-audit-list">
        {(data || []).length ? data.map((item) => (
          <article key={item.audit_log_id}>
            <span>{formatDateTime(item.created_at)}</span>
            <strong>{item.action}</strong>
            <small>{item.actor_type}:{item.actor_id || 'system'} · {item.ip_address || 'no-ip'}</small>
            <p>{item.message || 'Không có message.'}</p>
          </article>
        )) : <EmptyState label="Chưa có workspace audit" />}
      </div>
    </Panel>
  );
}

export function WorkspaceAccessControlPlanePage({ view = 'overview' }) {
  const activeView = VIEW_META[view] ? view : 'overview';
  const meta = VIEW_META[activeView];
  const HeroIcon = meta.icon;
  const [data, setData] = useState({});
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmPolicy, setConfirmPolicy] = useState(null);

  async function loadView() {
    setLoading(true);
    setError('');
    try {
      const [registry, viewData] = await Promise.all([
        listWorkspaceRegistry(),
        activeView === 'overview' ? getWorkspaceAccessOverview()
          : activeView === 'list' ? listWorkspaceRegistry()
            : activeView === 'actor' ? getWorkspaceByActor()
              : activeView === 'role' ? getWorkspaceByRole()
                : activeView === 'user' ? getWorkspaceByUser()
                  : activeView === 'department' ? getWorkspaceByDepartment()
                    : activeView === 'policies' ? listWorkspacePolicies()
                      : activeView === 'sidebar' ? getWorkspaceSidebars()
                        : activeView === 'navigation' ? getWorkspaceNavigationRules()
                          : activeView === 'preferences' ? getWorkspacePreferences()
                            : activeView === 'conflicts' ? getWorkspaceConflicts()
                              : activeView === 'diagnostics' ? getWorkspaceDiagnostics()
                                : activeView === 'audit' ? getWorkspaceAudit()
                                  : getWorkspaceAccessOverview(),
      ]);
      setWorkspaces(registry?.items || []);
      setData(viewData || {});
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadView();
  }, [activeView]);

  const summary = activeView === 'overview' ? data?.summary : {};

  async function handleCreatePolicy(payload) {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await createWorkspacePolicy(payload);
      setMessage('Đã tạo workspace access policy.');
      await loadView();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function requestCreatePolicy(payload) {
    setConfirmPolicy({
      payload,
      title: 'Tạo chính sách truy cập workspace?',
      description: 'Chính sách mới có thể cho phép, chặn, ẩn hoặc giới hạn workspace đối với người dùng/vai trò. Hãy xác nhận phạm vi trước khi tạo.',
      confirmLabel: 'Tạo chính sách',
      tone: payload.effect === 'deny' || payload.effect === 'hide' ? 'danger' : 'warning',
      details: [
        { label: 'Workspace', value: payload.workspace_code },
        { label: 'Chủ thể', value: `${payload.subject_type}:${payload.subject_code || payload.subject_id || 'Chưa có'}` },
        { label: 'Hiệu lực', value: payload.effect },
        { label: 'Lý do', value: payload.reason || 'Chưa nhập' },
      ],
    });
  }

  async function handleValidatePolicies() {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const result = await validateWorkspacePolicies();
      setMessage(result?.valid ? 'Policy hợp lệ, chưa phát hiện conflict nghiêm trọng.' : 'Policy có conflict hoặc diagnostics cần xử lý.');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRunDiagnostics() {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      setData(await runWorkspaceDiagnostics());
      setMessage('Đã chạy workspace diagnostics.');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="workspace-access-hero">
        <div className="workspace-access-hero__icon"><HeroIcon size={24} strokeWidth={2.3} /></div>
        <div>
          <span>Quản trị hệ thống / Quyền truy cập workspace</span>
          <h1>{meta.title}</h1>
          <p>Quản trị registry workspace, truy cập theo vai trò/người dùng/khoa phòng, policy allow/deny, sidebar, điều hướng, tùy chọn, chẩn đoán và audit.</p>
        </div>
        <div className="workspace-access-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={loadView} disabled={loading}>
            <RefreshCw size={16} strokeWidth={2.25} /> Làm mới
          </button>
          <button type="button" className="staff-button staff-button--primary" onClick={handleValidatePolicies} disabled={submitting}>
            <CheckCircle2 size={16} strokeWidth={2.25} /> Kiểm tra policy
          </button>
        </div>
      </section>

      <section className="workspace-access-tabs">
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link key={tab.id} className={activeView === tab.id ? 'is-active' : ''} to={`/admin/workspace-access/${tab.id}`}>
              <Icon size={15} strokeWidth={2.25} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </section>

      {message ? <p className="workspace-access-banner workspace-access-banner--success">{message}</p> : null}
      {error ? <p className="workspace-access-banner workspace-access-banner--error">{error}</p> : null}
      {loading ? <p className="workspace-access-banner">Đang tải dữ liệu Workspace Access Control Plane...</p> : null}

      {activeView === 'overview' ? <OverviewView overview={data} summary={summary} /> : null}
      {activeView === 'list' ? <WorkspaceRegistryView workspaces={pickArray(data, ['items'])} /> : null}
      {activeView === 'actor' ? <ActorView data={data} /> : null}
      {activeView === 'role' ? <RoleView data={data} /> : null}
      {activeView === 'user' ? <UserView data={data} /> : null}
      {activeView === 'department' ? <DepartmentView data={data} /> : null}
      {activeView === 'policies' ? <PolicyView policies={data} workspaces={workspaces} onCreatePolicy={requestCreatePolicy} onValidate={handleValidatePolicies} submitting={submitting} /> : null}
      {activeView === 'sidebar' ? <SidebarView data={data} /> : null}
      {activeView === 'navigation' ? <NavigationView data={data} /> : null}
      {activeView === 'preferences' ? <PreferenceView data={data} /> : null}
      {activeView === 'check' ? <CheckView workspaces={workspaces} /> : null}
      {activeView === 'conflicts' ? <ConflictsView data={data} /> : null}
      {activeView === 'diagnostics' ? <DiagnosticsView data={data} onRun={handleRunDiagnostics} submitting={submitting} /> : null}
      {activeView === 'audit' ? <AuditView data={data} /> : null}
      <AdminActionConfirmDialog
        open={Boolean(confirmPolicy)}
        title={confirmPolicy?.title}
        description={confirmPolicy?.description}
        tone={confirmPolicy?.tone}
        confirmLabel={confirmPolicy?.confirmLabel}
        details={confirmPolicy?.details}
        reasonRequired={false}
        submitting={submitting}
        onCancel={() => setConfirmPolicy(null)}
        onConfirm={async () => {
          await handleCreatePolicy(confirmPolicy.payload);
          setConfirmPolicy(null);
        }}
      />
    </>
  );
}
