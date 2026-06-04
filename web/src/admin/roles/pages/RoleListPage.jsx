import '../../iam/iamControlPlanePro.css';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TableProperties,
  UsersRound,
} from 'lucide-react';
import { getIamMatrix, listRoles, updateRoleStatus } from '../roleApi';
import { formatNumber, getRoleStatusTone } from '../roleUi';

function riskTone(level = 'low') {
  if (level === 'critical') return 'critical';
  if (level === 'high') return 'high';
  if (level === 'medium') return 'medium';
  return 'low';
}

function RiskBadge({ level }) {
  return <span className={`role-pro-risk role-pro-risk--${riskTone(level)}`}>{level || 'low'}</span>;
}

function StatusBadge({ status }) {
  return <span className={`admin-status-badge admin-status-badge--${getRoleStatusTone(status)}`}>{status || 'unknown'}</span>;
}

function mergeRoleData(listItems = [], matrixRoles = []) {
  const matrixByCode = new Map(matrixRoles.map((role) => [role.role_code, role]));
  return listItems.map((role) => {
    const matrix = matrixByCode.get(role.role_code) || {};
    return {
      ...role,
      permission_count: role.permission_count ?? role.permissions_count ?? matrix.permission_count ?? 0,
      user_count: role.user_count ?? role.users_count ?? matrix.user_count ?? 0,
      risk: matrix.risk || role.risk || { max_level: role.role_code === 'super_admin' ? 'critical' : 'low' },
      workspace_count: matrix.workspaces?.filter((workspace) => workspace.allowed).length || 0,
      matrix,
    };
  });
}

export function RoleListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    keyword: searchParams.get('keyword') || '',
    status: searchParams.get('status') || '',
    risk: searchParams.get('risk') || '',
    scope: searchParams.get('scope') || '',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [roles, setRoles] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ limit: '120' });
      if (appliedFilters.keyword) query.set('search', appliedFilters.keyword);
      if (appliedFilters.status) query.set('status', appliedFilters.status);
      const [rolesData, matrixData] = await Promise.all([listRoles(query.toString()), getIamMatrix()]);
      setMatrix(matrixData);
      setRoles(mergeRoleData(rolesData?.items || [], matrixData?.roles || []));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [appliedFilters.keyword, appliedFilters.status]);

  const visibleRoles = useMemo(() => roles.filter((role) => {
    if (appliedFilters.risk && riskTone(role.risk?.max_level) !== appliedFilters.risk) return false;
    if (appliedFilters.scope === 'system' && !role.is_system) return false;
    if (appliedFilters.scope === 'custom' && role.is_system) return false;
    if (appliedFilters.scope === 'locked' && role.is_mutable) return false;
    return true;
  }), [roles, appliedFilters]);

  const stats = useMemo(() => {
    const active = roles.filter((role) => role.status === 'active').length;
    const critical = roles.filter((role) => riskTone(role.risk?.max_level) === 'critical').length;
    const high = roles.filter((role) => ['critical', 'high'].includes(riskTone(role.risk?.max_level))).length;
    const broad = roles.filter((role) => role.permission_count >= 80 || role.workspace_count >= 5).length;
    return [
      { label: 'Tổng role', value: roles.length, icon: ShieldCheck, tone: 'blue' },
      { label: 'Active', value: active, icon: CheckCircle2, tone: 'green' },
      { label: 'Critical', value: critical, icon: ShieldAlert, tone: 'red' },
      { label: 'High risk', value: high, icon: AlertTriangle, tone: 'amber' },
      { label: 'Broad access', value: broad, icon: TableProperties, tone: 'violet' },
      { label: 'Users impacted', value: roles.reduce((sum, role) => sum + Number(role.user_count || 0), 0), icon: UsersRound, tone: 'cyan' },
    ];
  }, [roles]);

  function updateFilters(next) {
    setFilters(next);
  }

  function applyFilters(next = filters) {
    setFilters(next);
    setAppliedFilters(next);
    const params = new URLSearchParams();
    if (next.keyword) params.set('keyword', next.keyword);
    if (next.status) params.set('status', next.status);
    if (next.risk) params.set('risk', next.risk);
    if (next.scope) params.set('scope', next.scope);
    setSearchParams(params);
  }

  async function toggleStatus(role) {
    setSubmitting(true);
    setError('');
    try {
      await updateRoleStatus(role.role_id, role.status === 'active' ? 'inactive' : 'active');
      await load();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="role-pro-page">
      <section className="role-pro-hero">
        <div className="role-pro-hero__icon"><ShieldCheck size={26} strokeWidth={2.25} /></div>
        <div>
          <span>IAM Role Registry</span>
          <h1>Vai trò hệ thống</h1>
          <p>Quản trị vai trò theo priority, risk, user impact, permission coverage và workspace surface. Dữ liệu bám trực tiếp `/iam/roles` và `/iam/matrix`.</p>
        </div>
        <div className="role-pro-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={load}>
            <RefreshCw size={16} /> Làm mới
          </button>
          <Link to="/admin/roles/create" className="staff-button staff-button--primary">
            <Sparkles size={16} /> Tạo vai trò
          </Link>
        </div>
      </section>

      {error ? <p className="form-message error">{error}</p> : null}

      <section className="role-pro-metrics">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={`role-pro-metric role-pro-metric--${item.tone}`}>
              <Icon size={18} />
              <span>{item.label}</span>
              <strong>{formatNumber(item.value)}</strong>
            </article>
          );
        })}
      </section>

      <section className="role-pro-toolbar">
        <label>
          <Search size={16} />
          <input
            value={filters.keyword}
            onChange={(event) => updateFilters({ ...filters, keyword: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyFilters();
            }}
            placeholder="Tìm role_name hoặc role_code..."
          />
        </label>
        <select value={filters.status} onChange={(event) => updateFilters({ ...filters, status: event.target.value })}>
          <option value="">Mọi trạng thái</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={filters.risk} onChange={(event) => updateFilters({ ...filters, risk: event.target.value })}>
          <option value="">Mọi risk</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filters.scope} onChange={(event) => updateFilters({ ...filters, scope: event.target.value })}>
          <option value="">Mọi loại role</option>
          <option value="system">System</option>
          <option value="custom">Custom</option>
          <option value="locked">Locked</option>
        </select>
        <button type="button" className="staff-button staff-button--ghost" onClick={() => applyFilters()} disabled={loading}>
          Áp dụng
        </button>
      </section>

      <section className="role-pro-layout">
        <main className="role-pro-table-panel">
          {loading ? <div className="staff-loading-panel">Đang tải role registry...</div> : null}
          <div className="role-pro-table">
            <div className="role-pro-table__head">
              <span>Role</span><span>Priority</span><span>Usage</span><span>Permission</span><span>Workspace</span><span>Risk</span><span>Actions</span>
            </div>
            {visibleRoles.map((role) => (
              <div key={role.role_id} className="role-pro-table__row" onClick={() => setSelectedRole(role)}>
                <span className="role-pro-identity">
                  <i>{role.role_code?.slice(0, 2).toUpperCase()}</i>
                  <span>
                    <strong>{role.role_name}</strong>
                    <code>{role.role_code}</code>
                    <small>{role.description || 'Role vận hành nội bộ'}</small>
                  </span>
                </span>
                <span className="role-pro-priority">P{role.priority_level}</span>
                <span><strong>{formatNumber(role.user_count)}</strong><small>users</small></span>
                <span><strong>{formatNumber(role.permission_count)}</strong><small>permissions</small></span>
                <span><strong>{formatNumber(role.workspace_count)}</strong><small>workspaces</small></span>
                <RiskBadge level={role.risk?.max_level} />
                <span className="role-pro-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" title="Chi tiết" onClick={() => navigate(`/admin/roles/${role.role_id}`)}><Eye size={15} /></button>
                  <button type="button" title="Gán quyền" onClick={() => navigate(`/admin/roles/${role.role_id}/permissions`)}><KeyRound size={15} /></button>
                  <button type="button" title="Đổi trạng thái" disabled={submitting} onClick={() => toggleStatus(role)}><LockKeyhole size={15} /></button>
                </span>
              </div>
            ))}
          </div>
        </main>

        <aside className="role-pro-drawer">
          {selectedRole ? (
            <>
              <div className="role-pro-drawer__head">
                <span>{selectedRole.role_code}</span>
                <h2>{selectedRole.role_name}</h2>
                <StatusBadge status={selectedRole.status} />
              </div>
              <div className="role-pro-drawer__grid">
                <div><span>Priority</span><strong>{selectedRole.priority_level}</strong></div>
                <div><span>Users</span><strong>{formatNumber(selectedRole.user_count)}</strong></div>
                <div><span>Permissions</span><strong>{formatNumber(selectedRole.permission_count)}</strong></div>
                <div><span>Version</span><strong>{selectedRole.role_version || 1}</strong></div>
              </div>
              <div className="role-pro-workspaces">
                {(selectedRole.matrix?.workspaces || []).map((workspace) => (
                  <span key={workspace.code} className={workspace.allowed ? 'is-allowed' : ''}>{workspace.code}</span>
                ))}
              </div>
              <div className="role-pro-risk-box">
                <ShieldAlert size={18} />
                <div>
                  <strong>Risk summary</strong>
                  <p>{selectedRole.risk?.sensitive_count || 0} sensitive permission, level {selectedRole.risk?.max_level || 'low'}.</p>
                </div>
              </div>
              <button type="button" className="staff-button staff-button--primary" onClick={() => navigate(`/admin/roles/${selectedRole.role_id}/permissions`)}>
                Mở trung tâm quyền
              </button>
            </>
          ) : (
            <div className="role-pro-empty">
              <Database size={26} />
              <strong>Chọn một role để xem control drawer</strong>
            </div>
          )}
        </aside>
      </section>
    </section>
  );
}
