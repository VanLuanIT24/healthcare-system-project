import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Database,
  KeyRound,
  Layers3,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import {
  createRole,
  getIamMatrix,
  getRoleDetail,
  getRolePermissions,
  syncRolePermissions,
  updateRole,
  updateRoleStatus,
} from '../roleApi';
import {
  buildRoleCode,
  formatNumber,
  getPermissionActionTitle,
  getPermissionBrief,
  getPermissionModuleTitle,
  prettifyRoleCode,
} from '../roleUi';

const WORKSPACE_HINTS = [
  { code: 'admin', label: 'Quản trị', prefixes: ['system.', 'users.', 'roles.', 'permissions.', 'audit_logs.', 'settings.'] },
  { code: 'scheduling', label: 'Điều phối', prefixes: ['schedules.', 'appointments.', 'queues.', 'departments.'] },
  { code: 'reception', label: 'Lễ tân', prefixes: ['patients.', 'appointments.', 'queues.', 'patient_authorizations.'] },
  { code: 'doctor', label: 'Lâm sàng', prefixes: ['encounters.', 'diagnoses.', 'medical_records.', 'clinical_orders.', 'prescriptions.'] },
  { code: 'nursing', label: 'Điều dưỡng', prefixes: ['vitals.', 'nursing.', 'medications.', 'encounters.'] },
  { code: 'lab', label: 'Cận lâm sàng', prefixes: ['lab_', 'lab.', 'imaging_', 'procedure_', 'clinical_orders.'] },
  { code: 'pharmacy', label: 'Dược', prefixes: ['prescriptions.', 'dispenses.', 'stock_', 'inventory.', 'medications.'] },
  { code: 'billing', label: 'Viện phí', prefixes: ['invoices.', 'payments.', 'charges.', 'insurance_'] },
  { code: 'reports', label: 'Báo cáo', prefixes: ['reports.', 'analytics.', 'audit_logs.'] },
];

const RISK_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

function riskLevelOf(permission) {
  const code = String(permission?.permission_code || '').toLowerCase();
  if (permission?.risk?.level) return permission.risk.level;
  if (code === 'system.full_access' || code.includes('assign_roles') || code.includes('assign_permissions')) return 'critical';
  if (/^(payments|invoices|audit_logs|medical_records|settings|break_glass)\./.test(code)) return 'high';
  if (/^(reports|notifications|roles|users|departments)\.(create|update|delete|export|manage|update_status)/.test(code)) return 'medium';
  return 'low';
}

function RiskBadge({ level }) {
  return <span className={`role-create-pro-risk role-create-pro-risk--${level || 'low'}`}>{level || 'low'}</span>;
}

function permissionCodeOf(item) {
  return item?.permission_code || item;
}

function permissionMatchesWorkspace(permission, workspace) {
  const code = String(permissionCodeOf(permission) || '').toLowerCase();
  return workspace.prefixes.some((prefix) => code.startsWith(prefix) || code.includes(prefix));
}

function summarizeSelection(permissions = [], selectedCodes = []) {
  const selectedSet = new Set(selectedCodes);
  const selectedItems = permissions.filter((permission) => selectedSet.has(permission.permission_code));
  const byRisk = { critical: 0, high: 0, medium: 0, low: 0 };
  let maxLevel = 'low';

  selectedItems.forEach((permission) => {
    const level = riskLevelOf(permission);
    byRisk[level] = (byRisk[level] || 0) + 1;
    if (RISK_RANK[level] > RISK_RANK[maxLevel]) maxLevel = level;
  });

  return {
    selectedItems,
    total: selectedItems.length,
    modules: new Set(selectedItems.map((permission) => permission.module_key || 'general')).size,
    byRisk,
    maxLevel,
    workspaces: WORKSPACE_HINTS
      .map((workspace) => ({
        ...workspace,
        count: selectedItems.filter((permission) => permissionMatchesWorkspace(permission, workspace)).length,
      }))
      .filter((workspace) => workspace.count > 0)
      .sort((left, right) => right.count - left.count),
  };
}

function normalizePermissionData(matrix) {
  const permissions = matrix?.permissions || [];
  const modules = matrix?.modules || [];
  const moduleKeys = modules.length
    ? modules.map((item) => item.module_key)
    : [...new Set(permissions.map((permission) => permission.module_key || 'general'))];

  return { permissions, moduleKeys };
}

function RoleFormPage({ mode }) {
  const { roleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    role_name: '',
    role_code: '',
    description: '',
    status: 'active',
    priority_level: 10,
    change_reason: '',
  });
  const [matrix, setMatrix] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [selectedModule, setSelectedModule] = useState('all');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [sourceRoleId, setSourceRoleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const matrixData = await getIamMatrix();
      setMatrix(matrixData);

      if (isEdit && roleId) {
        const [detailData, permissionsData] = await Promise.all([getRoleDetail(roleId), getRolePermissions(roleId)]);
        const role = detailData?.role || {};
        setForm({
          role_name: role.role_name || '',
          role_code: role.role_code || '',
          description: role.description || '',
          status: role.status || 'active',
          priority_level: Number(role.priority_level ?? 10),
          change_reason: '',
        });
        setSelectedPermissions(permissionsData?.permission_codes || detailData?.permissions?.map((item) => item.permission_code) || []);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [isEdit, roleId]);

  const { permissions, moduleKeys } = useMemo(() => normalizePermissionData(matrix), [matrix]);
  const summary = useMemo(() => summarizeSelection(permissions, selectedPermissions), [permissions, selectedPermissions]);

  const filteredPermissions = useMemo(() => {
    const keyword = permissionSearch.trim().toLowerCase();
    return permissions.filter((permission) => {
      if (selectedModule !== 'all' && permission.module_key !== selectedModule) return false;
      if (!keyword) return true;
      return [
        permission.permission_code,
        permission.permission_name,
        permission.module_key,
        permission.action_key,
        permission.description,
      ].some((value) => String(value || '').toLowerCase().includes(keyword));
    });
  }, [permissionSearch, permissions, selectedModule]);

  const selectedSourceRole = useMemo(
    () => (matrix?.roles || []).find((role) => role.role_id === sourceRoleId),
    [matrix?.roles, sourceRoleId],
  );

  function updateField(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'role_name' && !isEdit && !current.role_code) next.role_code = buildRoleCode(value);
      return next;
    });
  }

  function togglePermission(code) {
    setSelectedPermissions((current) => (
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    ));
  }

  function toggleModule(moduleKey) {
    const moduleCodes = permissions
      .filter((permission) => permission.module_key === moduleKey)
      .map((permission) => permission.permission_code);
    const allSelected = moduleCodes.every((code) => selectedPermissions.includes(code));
    setSelectedPermissions((current) => {
      if (allSelected) return current.filter((code) => !moduleCodes.includes(code));
      return [...new Set([...current, ...moduleCodes])];
    });
  }

  function applySourceRole(roleIdToApply) {
    setSourceRoleId(roleIdToApply);
    const grants = matrix?.grants?.[roleIdToApply] || [];
    setSelectedPermissions(grants);
  }

  async function saveRole(openPermissions = false) {
    if (!form.role_name.trim() || !form.role_code.trim()) {
      setError('Tên vai trò và mã vai trò là bắt buộc.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      let resolvedRoleId = roleId;
      if (isEdit && roleId) {
        await updateRole(roleId, {
          role_name: form.role_name,
          description: form.description,
          priority_level: Number(form.priority_level),
        });
        await updateRoleStatus(roleId, form.status);
      } else {
        const created = await createRole({
          role_name: form.role_name,
          role_code: form.role_code,
          description: form.description,
          status: form.status,
          priority_level: Number(form.priority_level),
        });
        resolvedRoleId = created?.role?.role_id;
      }

      if (resolvedRoleId) await syncRolePermissions(resolvedRoleId, selectedPermissions);
      navigate(openPermissions && resolvedRoleId ? `/admin/roles/${resolvedRoleId}/permissions` : `/admin/roles/${resolvedRoleId || ''}`, { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="role-create-pro-page">
      <section className="role-create-pro-hero">
        <div className="role-create-pro-hero__icon"><Sparkles size={26} strokeWidth={2.25} /></div>
        <div>
          <span>IAM Role Builder</span>
          <h1>{isEdit ? 'Chỉnh sửa vai trò' : 'Tạo vai trò'}</h1>
          <p>Thiết kế vai trò theo priority, template, permission module, risk review và workspace impact. Mọi thay đổi quyền dùng đúng luồng backend sync role-permission.</p>
        </div>
        <div className="role-create-pro-hero__actions">
          <Link to={location.state?.returnTo || '/admin/roles'} className="staff-button staff-button--ghost">Hủy</Link>
          <button type="button" className="staff-button staff-button--ghost" disabled={submitting} onClick={() => saveRole(true)}>
            <KeyRound size={16} /> Lưu & mở quyền
          </button>
          <button type="button" className="staff-button staff-button--primary" disabled={submitting} onClick={() => saveRole(false)}>
            <ShieldCheck size={16} /> {submitting ? 'Đang lưu...' : 'Lưu vai trò'}
          </button>
        </div>
      </section>

      {error ? <p className="form-message error">{error}</p> : null}
      {loading ? <div className="staff-loading-panel">Đang tải IAM matrix...</div> : null}

      <section className="role-create-pro-layout">
        <main className="role-create-pro-main">
          <section className="role-create-pro-panel">
            <div className="role-create-pro-panel__head">
              <div><Database size={18} /><h2>Định danh vai trò</h2></div>
              <span>Step 1</span>
            </div>
            <div className="role-create-pro-grid">
              <label>
                <span>Tên vai trò</span>
                <input value={form.role_name} onChange={(event) => updateField('role_name', event.target.value)} placeholder="Điều phối viện phí nâng cao" />
              </label>
              <label>
                <span>Mã vai trò</span>
                <input value={form.role_code} disabled={isEdit} onChange={(event) => updateField('role_code', buildRoleCode(event.target.value))} placeholder="advanced_billing_operator" />
              </label>
              <label>
                <span>Priority level</span>
                <input type="number" min="0" max="100" value={form.priority_level} onChange={(event) => updateField('priority_level', event.target.value)} />
              </label>
              <label>
                <span>Trạng thái</span>
                <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="role-create-pro-grid__full">
                <span>Mô tả nghiệp vụ</span>
                <textarea rows="4" value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Mô tả phạm vi vận hành, nhóm nhân sự được gán và giới hạn trách nhiệm của vai trò này." />
              </label>
            </div>
          </section>

          <section className="role-create-pro-panel">
            <div className="role-create-pro-panel__head">
              <div><Copy size={18} /><h2>Template và baseline</h2></div>
              <span>Step 2</span>
            </div>
            <div className="role-create-pro-template-grid">
              <button type="button" className={!sourceRoleId ? 'is-active' : ''} onClick={() => { setSourceRoleId(''); setSelectedPermissions([]); }}>
                <strong>Role rỗng</strong>
                <small>Bắt đầu với 0 permission để cấu hình thủ công.</small>
              </button>
              {(matrix?.roles || []).slice(0, 12).map((role) => (
                <button key={role.role_id} type="button" className={sourceRoleId === role.role_id ? 'is-active' : ''} onClick={() => applySourceRole(role.role_id)}>
                  <strong>{role.role_name}</strong>
                  <small>{role.role_code} · {formatNumber(role.permission_count)} quyền · P{role.priority_level}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="role-create-pro-panel">
            <div className="role-create-pro-panel__head">
              <div><Layers3 size={18} /><h2>Chọn permission</h2></div>
              <span>{formatNumber(selectedPermissions.length)} selected</span>
            </div>
            <div className="role-create-pro-permission-layout">
              <aside className="role-create-pro-modules">
                <button type="button" className={selectedModule === 'all' ? 'is-active' : ''} onClick={() => setSelectedModule('all')}>
                  <strong>Tất cả module</strong><small>{formatNumber(permissions.length)}</small>
                </button>
                {moduleKeys.map((moduleKey) => {
                  const modulePermissions = permissions.filter((permission) => permission.module_key === moduleKey);
                  const selectedCount = modulePermissions.filter((permission) => selectedPermissions.includes(permission.permission_code)).length;
                  return (
                    <button key={moduleKey} type="button" className={selectedModule === moduleKey ? 'is-active' : ''} onClick={() => setSelectedModule(moduleKey)}>
                      <strong>{getPermissionModuleTitle(moduleKey)}</strong>
                      <small>{selectedCount}/{modulePermissions.length}</small>
                    </button>
                  );
                })}
              </aside>
              <div className="role-create-pro-permissions">
                <div className="role-create-pro-permission-toolbar">
                  <label>
                    <Search size={16} />
                    <input value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Tìm permission_code, module hoặc action..." />
                  </label>
                  {selectedModule !== 'all' ? (
                    <button type="button" className="staff-button staff-button--ghost" onClick={() => toggleModule(selectedModule)}>
                      Chọn/Bỏ module
                    </button>
                  ) : null}
                </div>
                <div className="role-create-pro-permission-list">
                  {filteredPermissions.map((permission) => {
                    const selected = selectedPermissions.includes(permission.permission_code);
                    const level = riskLevelOf(permission);
                    return (
                      <label key={permission.permission_id} className={`role-create-pro-permission ${selected ? 'is-selected' : ''}`}>
                        <input type="checkbox" checked={selected} onChange={() => togglePermission(permission.permission_code)} />
                        <span>
                          <strong>{permission.permission_code}</strong>
                          <small>{permission.permission_name || getPermissionBrief(permission)}</small>
                        </span>
                        <em>{getPermissionActionTitle(permission.action_key)}</em>
                        <RiskBadge level={level} />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside className="role-create-pro-sidebar">
          <section className="role-create-pro-preview">
            <div className="role-create-pro-preview__avatar">{String(form.role_code || 'RL').slice(0, 2).toUpperCase()}</div>
            <h2>{form.role_name || 'Vai trò mới'}</h2>
            <code>{form.role_code || 'role_code'}</code>
            <p>{form.description || 'Mô tả vai trò sẽ giúp audit và quản trị phân quyền rõ ràng hơn.'}</p>
            <div className="role-create-pro-preview__badges">
              <span>P{form.priority_level}</span>
              <span>{form.status}</span>
              {selectedSourceRole ? <span>Copy {selectedSourceRole.role_code}</span> : <span>Manual</span>}
            </div>
          </section>

          <section className="role-create-pro-card">
            <div className="role-create-pro-card__title"><ShieldAlert size={18} /><strong>Risk review</strong></div>
            <div className="role-create-pro-risk-grid">
              <div><span>Max risk</span><RiskBadge level={summary.maxLevel} /></div>
              <div><span>Permissions</span><strong>{formatNumber(summary.total)}</strong></div>
              <div><span>Modules</span><strong>{formatNumber(summary.modules)}</strong></div>
              <div><span>Sensitive</span><strong>{formatNumber(summary.byRisk.critical + summary.byRisk.high + summary.byRisk.medium)}</strong></div>
            </div>
            <div className="role-create-pro-risk-bars">
              {['critical', 'high', 'medium', 'low'].map((level) => (
                <span key={level}><i>{level}</i><b>{formatNumber(summary.byRisk[level])}</b></span>
              ))}
            </div>
          </section>

          <section className="role-create-pro-card">
            <div className="role-create-pro-card__title"><Workflow size={18} /><strong>Workspace impact</strong></div>
            <div className="role-create-pro-workspaces">
              {summary.workspaces.length ? summary.workspaces.map((workspace) => (
                <span key={workspace.code}>{workspace.label}<b>{workspace.count}</b></span>
              )) : <small>Chưa thấy workspace nào bị ảnh hưởng từ permission đã chọn.</small>}
            </div>
          </section>

          <section className="role-create-pro-card role-create-pro-card--warning">
            <AlertTriangle size={18} />
            <div>
              <strong>Guard backend đang bật</strong>
              <p>Backend sẽ chặn role priority vượt quyền actor, gán `system.full_access` trái phép và sync permission không nằm trong quyền của người thao tác.</p>
            </div>
          </section>

          <button type="button" className="staff-button staff-button--primary role-create-pro-submit" disabled={submitting} onClick={() => saveRole(false)}>
            <CheckCircle2 size={16} /> {submitting ? 'Đang ghi IAM...' : 'Xác nhận lưu vai trò'}
          </button>
          <button type="button" className="staff-button staff-button--ghost role-create-pro-submit" disabled={submitting} onClick={() => saveRole(true)}>
            Lưu và mở trung tâm quyền <ArrowRight size={15} />
          </button>
        </aside>
      </section>
    </section>
  );
}

export function RoleCreatePage() {
  return <RoleFormPage mode="create" />;
}

export function RoleEditPage() {
  return <RoleFormPage mode="edit" />;
}
