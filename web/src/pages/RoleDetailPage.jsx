import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function RoleDetailPage() {
  const { roleId } = useParams();
  const { session } = useAuth();
  const accessToken = session?.accessToken;
  const [detail, setDetail] = useState(null);
  const [rolePermissions, setRolePermissions] = useState({});
  const [allPermissions, setAllPermissions] = useState([]);
  const [roleForm, setRoleForm] = useState({ role_name: '', description: '' });
  const [statusValue, setStatusValue] = useState('active');
  const [permissionCodes, setPermissionCodes] = useState('');
  const [removePermissionCodes, setRemovePermissionCodes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadRoleData() {
    try {
      const [detailRes, permissionsRes, catalogRes] = await Promise.all([
        api.getRoleDetail(roleId, accessToken),
        api.getRolePermissions(roleId, accessToken),
        api.listPermissions({}, accessToken),
      ]);
      setDetail(detailRes.data);
      setRolePermissions(permissionsRes.data.permissions || {});
      setAllPermissions(catalogRes.data.items || []);
      setRoleForm({
        role_name: detailRes.data.role.role_name || '',
        description: detailRes.data.role.description || '',
      });
      setStatusValue(detailRes.data.role.status || 'active');
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    if (accessToken) {
      loadRoleData();
    }
  }, [accessToken, roleId]);

  function handleFormChange(event) {
    setRoleForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleUpdateRole(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      const response = await api.updateRole(roleId, roleForm, accessToken);
      setSuccess(response.message);
      await loadRoleData();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleUpdateStatus() {
    setError('');
    setSuccess('');
    try {
      const response = await api.updateRoleStatus(roleId, { status: statusValue }, accessToken);
      setSuccess(response.message);
      await loadRoleData();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleAssignPermissions(mode = 'replace') {
    setError('');
    setSuccess('');
    try {
      const codes = permissionCodes.split(',').map((item) => item.trim()).filter(Boolean);
      const response = await api.assignPermissionsToRole(roleId, { permission_codes: codes, mode }, accessToken);
      setSuccess(response.message);
      setRolePermissions(response.data.permissions || {});
      setPermissionCodes('');
      await loadRoleData();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleRemovePermissions() {
    setError('');
    setSuccess('');
    try {
      const codes = removePermissionCodes.split(',').map((item) => item.trim()).filter(Boolean);
      const response = await api.removePermissionsFromRole(roleId, { permission_codes: codes }, accessToken);
      setSuccess(response.message);
      setRolePermissions(response.data.permissions || {});
      setRemovePermissionCodes('');
      await loadRoleData();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <section className="dashboard-page">
      <div className="section-header-inline">
        <div className="page-headline">
          <span className="eyebrow">Role Detail</span>
          <h1>Chi tiết role</h1>
          <p>Xem role, chỉnh metadata, đổi status, gán hoặc gỡ permission.</p>
        </div>
        <Link to="/quan-tri/roles" className="button secondary-button">
          Quay lại Roles
        </Link>
      </div>

      <StatusMessage type="error">{error}</StatusMessage>
      <StatusMessage type="success">{success}</StatusMessage>

      {detail ? (
        <div className="dashboard-grid three-column-grid">
          <div className="glass-card">
            <h2>Thông tin role</h2>
            <div className="profile-grid single-column-grid">
              <div><span>Role code</span><strong>{detail.role.role_code}</strong></div>
              <div><span>Role name</span><strong>{detail.role.role_name}</strong></div>
              <div><span>Status</span><strong>{detail.role.status}</strong></div>
              <div><span>Users count</span><strong>{detail.users_count}</strong></div>
            </div>
          </div>

          <div className="glass-card">
            <h2>Cập nhật role</h2>
            <form className="form-card compact-form" onSubmit={handleUpdateRole}>
              <FormField label="Role name" name="role_name" value={roleForm.role_name} onChange={handleFormChange} />
              <FormField label="Description" name="description" value={roleForm.description} onChange={handleFormChange} />
              <button className="button primary-button" type="submit">Lưu role</button>
            </form>
          </div>

          <div className="glass-card">
            <h2>Trạng thái role</h2>
            <FormField label="Status" name="statusValue" value={statusValue} onChange={(event) => setStatusValue(event.target.value)}>
              <select className="field-input" value={statusValue} onChange={(event) => setStatusValue(event.target.value)}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </FormField>
            <button className="button primary-button" type="button" onClick={handleUpdateStatus}>
              Cập nhật trạng thái
            </button>
          </div>

          <div className="glass-card span-two-columns">
            <h2>Permissions theo module</h2>
            <div className="permissions-group-list">
              {Object.entries(rolePermissions).map(([moduleKey, codes]) => (
                <div key={moduleKey} className="subpanel">
                  <strong>{moduleKey}</strong>
                  <div className="tag-cloud">
                    {codes.map((code) => (
                      <span key={code} className="tag permission-tag">{code}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card">
            <h2>Gán permission</h2>
            <FormField label="Permission codes">
              <textarea className="field-input tall-input" value={permissionCodes} onChange={(event) => setPermissionCodes(event.target.value)} placeholder="auth.staff.read, role.read, permission.read" />
            </FormField>
            <div className="inline-actions">
              <button className="button primary-button" type="button" onClick={() => handleAssignPermissions('replace')}>Replace</button>
              <button className="button secondary-button" type="button" onClick={() => handleAssignPermissions('add')}>Add</button>
            </div>
          </div>

          <div className="glass-card">
            <h2>Gỡ permission</h2>
            <FormField label="Permission codes">
              <textarea className="field-input tall-input" value={removePermissionCodes} onChange={(event) => setRemovePermissionCodes(event.target.value)} placeholder="role.update, role.assign_permissions" />
            </FormField>
            <button className="button ghost-button" type="button" onClick={handleRemovePermissions}>
              Gỡ permission
            </button>
          </div>

          <div className="glass-card span-three-columns">
            <h2>Danh mục permission</h2>
            <div className="tag-cloud">
              {allPermissions.map((permission) => (
                <span key={permission.permission_id} className="tag permission-tag">
                  {permission.permission_code}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="auth-loading">Đang tải role...</div>
      )}
    </section>
  );
}
