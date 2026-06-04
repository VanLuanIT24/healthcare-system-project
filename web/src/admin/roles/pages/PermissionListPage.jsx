import '../../iam/iamControlPlanePro.css';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Copy,
  Database,
  Eye,
  FileWarning,
  KeyRound,
  Layers3,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { getIamMatrix } from '../roleApi';
import {
  formatNumber,
  getPermissionActionTitle,
  getPermissionBrief,
  getPermissionModuleTitle,
} from '../roleUi';

const RISK_TONES = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};
const RISK_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

function riskLevelOf(permission) {
  return permission?.risk?.level || permission?.risk_level || 'low';
}

function RiskBadge({ level }) {
  const tone = RISK_TONES[level] || 'low';
  return <span className={`permission-pro-risk permission-pro-risk--${tone}`}>{level || 'low'}</span>;
}

function normalizeWorkspaceList(permission) {
  const workspaces = permission?.workspaces || [];
  return workspaces.map((item) => (typeof item === 'string' ? item : item.code || item.workspace_code)).filter(Boolean);
}

function PermissionDrawer({ permission, onEdit }) {
  if (!permission) {
    return (
      <aside className="permission-pro-drawer permission-pro-drawer--empty">
        <Database size={28} />
        <strong>Chọn một permission</strong>
        <p>Drawer sẽ hiển thị usage, workspace impact, module/action và rủi ro để admin rà soát nhanh.</p>
      </aside>
    );
  }

  const workspaces = normalizeWorkspaceList(permission);
  return (
    <aside className="permission-pro-drawer">
      <div className="permission-pro-drawer__head">
        <span>{permission.module_key}</span>
        <h2>{permission.permission_code}</h2>
        <RiskBadge level={riskLevelOf(permission)} />
      </div>
      <p>{permission.description || permission.permission_name || getPermissionBrief(permission)}</p>
      <div className="permission-pro-drawer__grid">
        <div><span>Module</span><strong>{getPermissionModuleTitle(permission.module_key)}</strong></div>
        <div><span>Action</span><strong>{getPermissionActionTitle(permission.action_key)}</strong></div>
        <div><span>Roles using</span><strong>{formatNumber(permission.role_count)}</strong></div>
        <div><span>Type</span><strong>{permission.is_system ? 'System' : 'Custom'}</strong></div>
      </div>
      <section className="permission-pro-workspace-box">
        <strong>Workspace impact</strong>
        <div>
          {workspaces.length ? workspaces.map((workspace) => <span key={workspace}>{workspace}</span>) : <small>Chưa map workspace trực tiếp.</small>}
        </div>
      </section>
      <section className="permission-pro-risk-box">
        <ShieldAlert size={18} />
        <div>
          <strong>Guard note</strong>
          <p>{permission.risk?.reasons?.[0] || 'Permission này được backend matrix phân loại để hỗ trợ review trước khi gán cho role.'}</p>
        </div>
      </section>
      <div className="permission-pro-drawer__actions">
        <button type="button" className="staff-button staff-button--ghost" onClick={() => navigator.clipboard?.writeText(permission.permission_code)}>
          <Copy size={15} /> Copy code
        </button>
        <button type="button" className="staff-button staff-button--primary" onClick={() => onEdit(permission)}>
          Chỉnh sửa
        </button>
      </div>
    </aside>
  );
}

export function PermissionListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    keyword: searchParams.get('keyword') || '',
    module: searchParams.get('module') || 'all',
    risk: searchParams.get('risk') || 'all',
    usage: searchParams.get('usage') || 'all',
    sort: searchParams.get('sort') || 'module',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [selectedPermissionCode, setSelectedPermissionCode] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getIamMatrix();
      setMatrix(data);
      if (!selectedPermissionCode && data?.permissions?.length) setSelectedPermissionCode(data.permissions[0].permission_code);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const permissions = matrix?.permissions || [];
  const modules = useMemo(() => {
    const grouped = permissions.reduce((accumulator, permission) => {
      const key = permission.module_key || 'general';
      if (!accumulator[key]) accumulator[key] = { module_key: key, permission_count: 0, critical: 0, orphan: 0 };
      accumulator[key].permission_count += 1;
      if (['critical', 'high'].includes(riskLevelOf(permission))) accumulator[key].critical += 1;
      if (!permission.role_count) accumulator[key].orphan += 1;
      return accumulator;
    }, {});
    return Object.values(grouped).sort((left, right) => left.module_key.localeCompare(right.module_key));
  }, [permissions]);

  const visiblePermissions = useMemo(() => {
    const keyword = appliedFilters.keyword.trim().toLowerCase();
    return permissions
      .filter((permission) => {
        if (appliedFilters.module !== 'all' && permission.module_key !== appliedFilters.module) return false;
        if (appliedFilters.risk !== 'all' && riskLevelOf(permission) !== appliedFilters.risk) return false;
        if (appliedFilters.usage === 'orphan' && Number(permission.role_count || 0) > 0) return false;
        if (appliedFilters.usage === 'used' && Number(permission.role_count || 0) === 0) return false;
        if (!keyword) return true;
        return [
          permission.permission_code,
          permission.permission_name,
          permission.description,
          permission.module_key,
          permission.action_key,
        ].some((value) => String(value || '').toLowerCase().includes(keyword));
      })
      .sort((left, right) => {
        if (appliedFilters.sort === 'risk') return (RISK_RANK[riskLevelOf(right)] || 1) - (RISK_RANK[riskLevelOf(left)] || 1);
        if (appliedFilters.sort === 'usage') return Number(right.role_count || 0) - Number(left.role_count || 0);
        return `${left.module_key}.${left.permission_code}`.localeCompare(`${right.module_key}.${right.permission_code}`);
      });
  }, [appliedFilters, permissions]);

  const selectedPermission = useMemo(
    () => permissions.find((permission) => permission.permission_code === selectedPermissionCode) || visiblePermissions[0],
    [permissions, selectedPermissionCode, visiblePermissions],
  );

  const stats = useMemo(() => {
    const highRisk = permissions.filter((permission) => ['critical', 'high'].includes(riskLevelOf(permission))).length;
    const orphan = permissions.filter((permission) => !permission.role_count).length;
    const deprecated = permissions.filter((permission) => permission.deprecated_at).length;
    return [
      { label: 'Tổng permission', value: permissions.length, icon: KeyRound, tone: 'blue' },
      { label: 'Module', value: modules.length, icon: Layers3, tone: 'cyan' },
      { label: 'High/Critical', value: highRisk, icon: ShieldAlert, tone: 'red' },
      { label: 'Orphan', value: orphan, icon: FileWarning, tone: 'amber' },
      { label: 'System', value: permissions.filter((permission) => permission.is_system).length, icon: ShieldCheck, tone: 'green' },
      { label: 'Deprecated', value: deprecated, icon: AlertTriangle, tone: 'violet' },
    ];
  }, [modules.length, permissions]);

  function updateFilters(next) {
    setFilters(next);
  }

  function applyFilters(next = filters) {
    setFilters(next);
    setAppliedFilters(next);
    const params = new URLSearchParams();
    if (next.keyword) params.set('keyword', next.keyword);
    if (next.module !== 'all') params.set('module', next.module);
    if (next.risk !== 'all') params.set('risk', next.risk);
    if (next.usage !== 'all') params.set('usage', next.usage);
    if (next.sort !== 'module') params.set('sort', next.sort);
    setSearchParams(params);
  }

  return (
    <section className="permission-pro-page">
      <section className="permission-pro-hero">
        <div className="permission-pro-hero__icon"><KeyRound size={26} strokeWidth={2.25} /></div>
        <div>
          <span>IAM Permission Catalog</span>
          <h1>Quyền hệ thống</h1>
          <p>Catalog permission theo module, action, usage, orphan state, risk và workspace impact. Trang này dùng dữ liệu tổng hợp từ `/iam/matrix` để tránh gọi hàng trăm request usage.</p>
        </div>
        <div className="permission-pro-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={load}><RefreshCw size={16} /> Làm mới</button>
          <Link to="/admin/permissions/create" className="staff-button staff-button--primary"><Sparkles size={16} /> Thêm quyền</Link>
        </div>
      </section>

      {error ? <p className="form-message error">{error}</p> : null}

      <section className="permission-pro-metrics">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={`permission-pro-metric permission-pro-metric--${item.tone}`}>
              <Icon size={18} />
              <span>{item.label}</span>
              <strong>{formatNumber(item.value)}</strong>
            </article>
          );
        })}
      </section>

      <section className="permission-pro-layout">
        <aside className="permission-pro-modules">
          <button type="button" className={filters.module === 'all' ? 'is-active' : ''} onClick={() => applyFilters({ ...filters, module: 'all' })}>
            <strong>Tất cả module</strong><span>{formatNumber(permissions.length)}</span>
          </button>
          {modules.map((module) => (
            <button key={module.module_key} type="button" className={filters.module === module.module_key ? 'is-active' : ''} onClick={() => applyFilters({ ...filters, module: module.module_key })}>
              <strong>{getPermissionModuleTitle(module.module_key)}</strong>
              <span>{formatNumber(module.permission_count)}</span>
              {module.critical ? <small>{formatNumber(module.critical)} risk</small> : null}
            </button>
          ))}
        </aside>

        <main className="permission-pro-main">
          <section className="permission-pro-toolbar">
            <label>
              <Search size={16} />
              <input
                value={filters.keyword}
                onChange={(event) => updateFilters({ ...filters, keyword: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyFilters();
                }}
                placeholder="Tìm permission_code, tên quyền, module..."
              />
            </label>
            <select value={filters.risk} onChange={(event) => updateFilters({ ...filters, risk: event.target.value })}>
              <option value="all">Mọi risk</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={filters.usage} onChange={(event) => updateFilters({ ...filters, usage: event.target.value })}>
              <option value="all">Mọi usage</option>
              <option value="used">Đang được role dùng</option>
              <option value="orphan">Chưa role nào dùng</option>
            </select>
            <select value={filters.sort} onChange={(event) => updateFilters({ ...filters, sort: event.target.value })}>
              <option value="module">Module/code</option>
              <option value="usage">Dùng nhiều nhất</option>
              <option value="risk">Risk trước</option>
            </select>
            <button type="button" className="staff-button staff-button--ghost" onClick={() => applyFilters()} disabled={loading}>
              Áp dụng
            </button>
          </section>

          {loading ? <div className="staff-loading-panel">Đang tải permission catalog...</div> : null}

          <section className="permission-pro-table">
            <div className="permission-pro-table__head">
              <span>Permission</span><span>Module / Action</span><span>Usage</span><span>Workspace</span><span>Risk</span><span>Actions</span>
            </div>
            {visiblePermissions.map((permission) => {
              const workspaces = normalizeWorkspaceList(permission);
              return (
                <div key={permission.permission_id} className="permission-pro-table__row" onClick={() => setSelectedPermissionCode(permission.permission_code)}>
                  <span className="permission-pro-identity">
                    <i>{String(permission.module_key || 'P').slice(0, 2).toUpperCase()}</i>
                    <span>
                      <strong>{permission.permission_code}</strong>
                      <small>{permission.permission_name || getPermissionBrief(permission)}</small>
                    </span>
                  </span>
                  <span className="permission-pro-module">
                    <strong>{getPermissionModuleTitle(permission.module_key)}</strong>
                    <small>{getPermissionActionTitle(permission.action_key)}</small>
                  </span>
                  <span><strong>{formatNumber(permission.role_count)}</strong><small>roles</small></span>
                  <span className="permission-pro-workspace-inline">
                    {workspaces.slice(0, 3).map((workspace) => <b key={workspace}>{workspace}</b>)}
                    {workspaces.length > 3 ? <small>+{workspaces.length - 3}</small> : null}
                  </span>
                  <RiskBadge level={riskLevelOf(permission)} />
                  <span className="permission-pro-actions" onClick={(event) => event.stopPropagation()}>
                    <button type="button" title="Chi tiết" onClick={() => navigate(`/admin/permissions/${permission.permission_id}`)}><Eye size={15} /></button>
                    <button type="button" title="Copy code" onClick={() => navigator.clipboard?.writeText(permission.permission_code)}><Clipboard size={15} /></button>
                  </span>
                </div>
              );
            })}
          </section>
        </main>

        <PermissionDrawer permission={selectedPermission} onEdit={(permission) => navigate(`/admin/permissions/${permission.permission_id}/edit`)} />
      </section>
    </section>
  );
}
