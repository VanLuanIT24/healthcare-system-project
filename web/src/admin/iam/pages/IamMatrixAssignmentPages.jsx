import '../iamControlPlanePro.css';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  TableProperties,
  UserCog,
  UsersRound,
  XCircle,
} from 'lucide-react';
import {
  applyRolePermissionMatrix,
  getIamMatrix,
  previewStaffRoleChange,
  syncIamStaffRoles,
} from '../../roles/roleApi';
import { getStaffAccounts } from '../../staff/staffApi';
import {
  formatNumber,
  getPermissionBrief,
  getPermissionModuleTitle,
  getPermissionTone,
} from '../../roles/roleUi';

function userIdOf(user = {}) {
  return user.user_id || user.id || user._id;
}

function roleCodesOf(user = {}) {
  const roles = user.roles || user.role_codes || [];
  return Array.isArray(roles)
    ? roles.map((role) => (typeof role === 'string' ? role : role.role_code)).filter(Boolean)
    : [];
}

function riskTone(level = 'low') {
  if (level === 'critical') return 'critical';
  if (level === 'high') return 'high';
  if (level === 'medium') return 'medium';
  return 'low';
}

function RiskBadge({ level }) {
  const labels = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', critical: 'Nghiêm trọng' };
  return <span className={`iam-pro-risk iam-pro-risk--${riskTone(level)}`}>{labels[level] || labels.low}</span>;
}

function PermissionModuleBar({ modules = [], active, onChange }) {
  return (
    <div className="iam-pro-module-bar">
      <button type="button" className={!active ? 'is-active' : ''} onClick={() => onChange('')}>
        Tất cả
      </button>
      {modules.map((module) => (
        <button key={module.module_key} type="button" className={active === module.module_key ? 'is-active' : ''} onClick={() => onChange(module.module_key)}>
          {getPermissionModuleTitle(module.module_key)}
          <span>{formatNumber(module.permission_count)}</span>
        </button>
      ))}
    </div>
  );
}

export function IamPermissionMatrixView() {
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [pending, setPending] = useState({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setMatrix(await getIamMatrix());
      setPending({});
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const roles = useMemo(() => {
    const keyword = roleSearch.trim().toLowerCase();
    const items = matrix?.roles || [];
    return keyword
      ? items.filter((role) => `${role.role_code} ${role.role_name}`.toLowerCase().includes(keyword))
      : items;
  }, [matrix, roleSearch]);

  const permissions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (matrix?.permissions || []).filter((permission) => {
      if (moduleFilter && permission.module_key !== moduleFilter) return false;
      if (!keyword) return true;
      return `${permission.permission_code} ${permission.permission_name} ${permission.module_key}`.toLowerCase().includes(keyword);
    });
  }, [matrix, moduleFilter, search]);

  const pendingItems = useMemo(() => Object.values(pending), [pending]);
  const addedCount = pendingItems.filter((item) => item.granted).length;
  const removedCount = pendingItems.filter((item) => !item.granted).length;
  const visibleRoleIds = roles.map((role) => role.role_id);

  function currentGranted(roleId, permissionCode) {
    const key = `${roleId}:${permissionCode}`;
    if (pending[key]) return pending[key].granted;
    return (matrix?.grants?.[roleId] || []).includes(permissionCode);
  }

  function toggleCell(role, permission) {
    const roleId = role.role_id;
    const permissionCode = permission.permission_code;
    const key = `${roleId}:${permissionCode}`;
    const originalGranted = (matrix?.grants?.[roleId] || []).includes(permissionCode);
    const nextGranted = !currentGranted(roleId, permissionCode);

    setPending((current) => {
      const next = { ...current };
      if (nextGranted === originalGranted) {
        delete next[key];
      } else {
        next[key] = {
          role_id: roleId,
          role_code: role.role_code,
          role_name: role.role_name,
          permission_code: permissionCode,
          permission_name: permission.permission_name,
          module_key: permission.module_key,
          granted: nextGranted,
        };
      }
      return next;
    });
  }

  async function applyChanges() {
    if (!pendingItems.length) return;
    setSaving(true);
    setError('');
    try {
      await applyRolePermissionMatrix({ changes: pendingItems });
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="iam-pro-loading">Đang tải ma trận quyền...</section>;
  }

  return (
    <section className="iam-pro-page">
      <section className="iam-pro-hero">
        <div className="iam-pro-hero__icon"><TableProperties size={25} strokeWidth={2.25} /></div>
        <div>
          <span>IAM & phân quyền</span>
          <h1>Ma trận quyền</h1>
          <p>Quản trị role-permission dạng spreadsheet: lọc module, thao tác cell, xem risk, preview diff và sync backend có audit/session revoke.</p>
        </div>
        <div className="iam-pro-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={load}>
            <RefreshCw size={16} /> Làm mới
          </button>
          <button type="button" className="staff-button staff-button--primary" onClick={applyChanges} disabled={saving || !pendingItems.length}>
            <Save size={16} /> {saving ? 'Đang sync...' : `Áp dụng ${pendingItems.length} thay đổi`}
          </button>
        </div>
      </section>

      {error ? <p className="form-message error">{error}</p> : null}

      <section className="iam-pro-metrics">
        <article><ShieldCheck size={18} /><span>Vai trò</span><strong>{formatNumber(matrix?.roles?.length)}</strong></article>
        <article><KeyRound size={18} /><span>Quyền</span><strong>{formatNumber(matrix?.permissions?.length)}</strong></article>
        <article><CheckCircle2 size={18} /><span>Đang chờ cấp</span><strong>{formatNumber(addedCount)}</strong></article>
        <article><XCircle size={18} /><span>Đang chờ gỡ</span><strong>{formatNumber(removedCount)}</strong></article>
      </section>

      <section className="iam-pro-toolbar">
        <label>
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm permission code, tên quyền, module..." />
        </label>
        <label>
          <UsersRound size={16} />
          <input value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder="Lọc role hiển thị..." />
        </label>
        <button type="button" onClick={() => setPending({})} disabled={!pendingItems.length}>
          Đặt lại diff
        </button>
      </section>

      <PermissionModuleBar modules={matrix?.modules || []} active={moduleFilter} onChange={setModuleFilter} />

      <section className="iam-pro-matrix-panel">
        <div className="iam-pro-matrix" style={{ '--iam-role-count': visibleRoleIds.length }}>
          <div className="iam-pro-matrix__row iam-pro-matrix__head">
            <span className="iam-pro-matrix__permission-col">Quyền</span>
            {roles.map((role) => (
              <span key={role.role_id} className="iam-pro-matrix__role-head" title={role.role_name}>
                <strong>{role.role_code}</strong>
                <small>P{role.priority_level} · {formatNumber(role.user_count)}</small>
              </span>
            ))}
          </div>

          {permissions.map((permission) => (
            <div key={permission.permission_id} className="iam-pro-matrix__row">
              <span className="iam-pro-matrix__permission-col">
                <span className={`iam-pro-module-dot iam-pro-module-dot--${getPermissionTone(permission.module_key)}`} />
                <span>
                  <strong>{getPermissionBrief(permission)}</strong>
                  <code>{permission.permission_code}</code>
                </span>
                <RiskBadge level={permission.risk?.level} />
              </span>
              {roles.map((role) => {
                const key = `${role.role_id}:${permission.permission_code}`;
                const granted = currentGranted(role.role_id, permission.permission_code);
                const changed = Boolean(pending[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`iam-pro-matrix-cell ${granted ? 'is-granted' : ''} ${changed ? 'is-changed' : ''}`}
                    onClick={() => toggleCell(role, permission)}
                    title={`${role.role_code} / ${permission.permission_code}`}
                  >
                    {granted ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="iam-pro-diff-panel">
        <div>
          <strong>Diff đang chờ áp dụng</strong>
          <span>{formatNumber(pendingItems.length)} thay đổi sẽ bump permission_version và revoke session theo backend role-permission sync.</span>
        </div>
        <div className="iam-pro-diff-list">
          {pendingItems.slice(0, 12).map((item) => (
            <code key={`${item.role_id}:${item.permission_code}`} className={item.granted ? 'is-added' : 'is-removed'}>
              {item.granted ? '+' : '-'} {item.role_code} / {item.permission_code}
            </code>
          ))}
          {pendingItems.length > 12 ? <small>+{pendingItems.length - 12} thay đổi khác</small> : null}
        </div>
      </section>
    </section>
  );
}

export function IamRoleAssignmentView() {
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleCodes, setSelectedRoleCodes] = useState([]);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [staffData, matrixData] = await Promise.all([
        getStaffAccounts('limit=160'),
        getIamMatrix('role_status=active'),
      ]);
      const users = staffData?.items || [];
      const activeRoles = matrixData?.roles || [];
      setStaff(users);
      setRoles(activeRoles);
      const firstUserId = selectedUserId || userIdOf(users[0]) || '';
      setSelectedUserId(firstUserId);
      setSelectedRoleCodes(roleCodesOf(users.find((user) => userIdOf(user) === firstUserId) || {}));
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
    setSelectedRoleCodes(roleCodesOf(user || {}));
    setPreview(null);
  }, [selectedUserId, staff]);

  const visibleStaff = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return staff;
    return staff.filter((user) => `${user.full_name} ${user.username} ${user.email} ${user.employee_code}`.toLowerCase().includes(keyword));
  }, [search, staff]);

  const selectedUser = staff.find((item) => userIdOf(item) === selectedUserId);
  const selectedRoles = roles.filter((role) => selectedRoleCodes.includes(role.role_code));
  const maxPriority = selectedRoles.reduce((max, role) => Math.max(max, Number(role.priority_level || 0)), 0);

  function toggleRole(roleCode) {
    setSelectedRoleCodes((current) =>
      current.includes(roleCode) ? current.filter((item) => item !== roleCode) : [...current, roleCode],
    );
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

  if (loading) {
    return <section className="iam-pro-loading">Đang tải staff và role...</section>;
  }

  return (
    <section className="iam-pro-page">
      <section className="iam-pro-hero">
        <div className="iam-pro-hero__icon"><UserCog size={25} strokeWidth={2.25} /></div>
        <div>
          <span>IAM & phân quyền</span>
          <h1>Gán vai trò</h1>
          <p>Gán role cho nhân sự với preview quyền hiệu lực, workspace impact, permission risk và session revoke trước khi sync.</p>
        </div>
        <div className="iam-pro-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={runPreview} disabled={!selectedUserId}>
            <ShieldAlert size={16} /> Xem trước
          </button>
          <button type="button" className="staff-button staff-button--primary" onClick={save} disabled={saving || !selectedUserId}>
            <Save size={16} /> {saving ? 'Đang sync...' : 'Đồng bộ vai trò'}
          </button>
        </div>
      </section>

      {error ? <p className="form-message error">{error}</p> : null}

      <section className="iam-pro-assignment-layout">
        <aside className="iam-pro-staff-column">
          <label className="iam-pro-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nhân sự..." />
          </label>
          <div className="iam-pro-staff-list">
            {visibleStaff.map((user) => (
              <button key={userIdOf(user)} type="button" className={selectedUserId === userIdOf(user) ? 'is-active' : ''} onClick={() => setSelectedUserId(userIdOf(user))}>
                <span>{String(user.full_name || user.username || 'U').slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{user.full_name || user.username}</strong>
                  <small>{user.email || user.employee_code || user.username}</small>
                </div>
                <em>{roleCodesOf(user).length}</em>
              </button>
            ))}
          </div>
        </aside>

        <main className="iam-pro-role-board">
          <article className="iam-pro-user-summary">
            <Fingerprint size={22} />
            <div>
              <span>Nhân sự đang cấu hình</span>
              <strong>{selectedUser?.full_name || selectedUser?.username || 'Chưa chọn'}</strong>
              <small>{selectedUser?.email || selectedUser?.employee_code || 'Chọn một nhân sự để gán role'}</small>
            </div>
            <div>
              <span>Vai trò đã chọn</span>
              <strong>{formatNumber(selectedRoleCodes.length)}</strong>
            </div>
            <div>
              <span>Ưu tiên cao nhất</span>
              <strong>{formatNumber(maxPriority)}</strong>
            </div>
          </article>

          <section className="iam-pro-role-grid">
            {roles.map((role) => (
              <button key={role.role_id} type="button" className={selectedRoleCodes.includes(role.role_code) ? 'is-selected' : ''} onClick={() => toggleRole(role.role_code)}>
                <div>
                  <strong>{role.role_name}</strong>
                  <code>{role.role_code}</code>
                  <small>{formatNumber(role.permission_count)} quyền · {formatNumber(role.user_count)} users</small>
                </div>
                <span>P{role.priority_level}</span>
                <RiskBadge level={role.risk?.max_level} />
              </button>
            ))}
          </section>
        </main>

        <aside className="iam-pro-impact-sidebar">
          <div className="iam-pro-impact-sidebar__head">
            <AlertTriangle size={18} />
            <strong>Effective preview</strong>
          </div>
          {preview ? (
            <>
              <div className="iam-pro-preview-grid">
                <div><span>Before permissions</span><strong>{formatNumber(preview.before?.permission_count)}</strong></div>
                <div><span>After permissions</span><strong>{formatNumber(preview.after?.permission_count)}</strong></div>
                <div><span>Added</span><strong>{formatNumber(preview.diff?.added_permissions?.length)}</strong></div>
                <div><span>Removed</span><strong>{formatNumber(preview.diff?.removed_permissions?.length)}</strong></div>
              </div>
              <div className="iam-pro-workspace-impact">
                {(preview.after?.workspaces || []).map((workspace) => (
                  <div key={workspace.code} className={workspace.allowed ? 'is-allowed' : ''}>
                    {workspace.allowed ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                    <span>{workspace.code}</span>
                    <small>{workspace.reason}</small>
                  </div>
                ))}
              </div>
              <div className="iam-pro-diff-list">
                {(preview.diff?.sensitive_added || []).slice(0, 10).map((item) => (
                  <code key={item.permission_code} className="is-added">+ {item.permission_code}</code>
                ))}
              </div>
            </>
          ) : (
            <p>Chạy preview để xem permission thêm/gỡ, workspace thay đổi và session revoke.</p>
          )}
        </aside>
      </section>
    </section>
  );
}
