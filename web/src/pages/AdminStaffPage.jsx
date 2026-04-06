import { useEffect, useState } from 'react';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const roleOptions = ['admin', 'doctor', 'receptionist', 'nurse', 'pharmacist', 'lab_technician'];
const staffStatuses = ['active', 'suspended', 'locked', 'disabled'];

const initialCreateForm = {
  username: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  employee_code: '',
  role_codes: ['doctor'],
  must_change_password: true,
};

export default function AdminStaffPage() {
  const { session, profile } = useAuth();
  const accessToken = session?.accessToken;
  const [staffData, setStaffData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [roleEdits, setRoleEdits] = useState({});
  const [statusEdits, setStatusEdits] = useState({});
  const [resetPasswords, setResetPasswords] = useState({});
  const [staffMeta, setStaffMeta] = useState({});
  const [permissionChecks, setPermissionChecks] = useState({});

  async function loadStaffAccounts() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await api.getStaffAccounts({}, accessToken);
      setStaffData(response.data.items);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaffAccounts();
  }, [accessToken]);

  function handleCreateChange(event) {
    const { name, value, type, checked } = event.target;
    setCreateForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function toggleCreateRole(role) {
    setCreateForm((current) => {
      const hasRole = current.role_codes.includes(role);
      return {
        ...current,
        role_codes: hasRole ? current.role_codes.filter((item) => item !== role) : [...current.role_codes, role],
      };
    });
  }

  async function handleCreateStaff(event) {
    event.preventDefault();
    setError('');
    setFeedback('');
    try {
      const response = await api.createStaffAccount(createForm, accessToken);
      setFeedback(response.message);
      setCreateForm(initialCreateForm);
      await loadStaffAccounts();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  function setRoleDraft(userId, role) {
    setRoleEdits((current) => ({ ...current, [userId]: [role] }));
  }

  function setStatusDraft(userId, status) {
    setStatusEdits((current) => ({ ...current, [userId]: status }));
  }

  function setResetDraft(userId, password) {
    setResetPasswords((current) => ({ ...current, [userId]: password }));
  }

  async function handleUpdateRoles(userId) {
    try {
      const response = await api.updateStaffRoles({ user_id: userId, role_codes: roleEdits[userId] || [] }, accessToken);
      setFeedback(response.message);
      await loadStaffAccounts();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleUpdateStatus(userId) {
    try {
      const response = await api.updateStaffStatus({ user_id: userId, status: statusEdits[userId] || 'active' }, accessToken);
      setFeedback(response.message);
      await loadStaffAccounts();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleQuickAction(type, userId) {
    try {
      let response;
      if (type === 'unlock') response = await api.unlockStaffAccount({ user_id: userId }, accessToken);
      if (type === 'activate') response = await api.activateStaffAccount({ user_id: userId }, accessToken);
      if (type === 'deactivate') response = await api.deactivateStaffAccount({ user_id: userId }, accessToken);
      setFeedback(response.message);
      await loadStaffAccounts();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleResetPassword(userId) {
    try {
      const response = await api.resetStaffPassword({ user_id: userId, new_password: resetPasswords[userId] || '' }, accessToken);
      setFeedback(response.message);
      setResetPasswords((current) => ({ ...current, [userId]: '' }));
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleLoadMeta(userId) {
    try {
      const [rolesRes, permissionsRes] = await Promise.all([
        api.getStaffRoles(userId, accessToken),
        api.getStaffPermissions(userId, accessToken),
      ]);
      setStaffMeta((current) => ({
        ...current,
        [userId]: {
          roles: rolesRes.data.roles || [],
          permissions: permissionsRes.data.permissions || [],
        },
      }));
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleCheckPermission(userId) {
    try {
      const permissionCode = permissionChecks[userId];
      if (!permissionCode) return;
      const response = await api.checkStaffPermission(userId, permissionCode, accessToken);
      setFeedback(`Kiểm tra quyền: ${response.data.permission_code} = ${response.data.allowed ? 'có' : 'không'}`);
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleRemoveRoles(userId) {
    try {
      const response = await api.removeRolesFromStaff(userId, { role_codes: roleEdits[userId] || [] }, accessToken);
      setFeedback(response.message);
      setStaffMeta((current) => ({ ...current, [userId]: { ...(current[userId] || {}), roles: response.data.roles } }));
      await loadStaffAccounts();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <section className="dashboard-page">
      <div className="page-headline">
        <span className="eyebrow">Staff Administration</span>
        <h1>Quản trị tài khoản nhân sự</h1>
        <p>Trang này đã phủ gần hết các API quản trị staff: tạo account, role, status, unlock, activate, deactivate, reset password, xem roles và permissions.</p>
      </div>

      <StatusMessage type="error">{error}</StatusMessage>
      <StatusMessage type="success">{feedback}</StatusMessage>

      <div className="dashboard-grid three-column-grid">
        <div className="glass-card span-two-columns">
          <h2>Tạo tài khoản nhân sự</h2>
          <form className="form-card form-grid" onSubmit={handleCreateStaff}>
            <FormField label="Username" name="username" value={createForm.username} onChange={handleCreateChange} required />
            <FormField label="Mật khẩu" name="password" type="password" value={createForm.password} onChange={handleCreateChange} required />
            <FormField label="Họ và tên" name="full_name" value={createForm.full_name} onChange={handleCreateChange} required />
            <FormField label="Email" name="email" value={createForm.email} onChange={handleCreateChange} />
            <FormField label="Số điện thoại" name="phone" value={createForm.phone} onChange={handleCreateChange} />
            <FormField label="Mã nhân viên" name="employee_code" value={createForm.employee_code} onChange={handleCreateChange} />

            <div className="field field-span-full">
              <span>Vai trò</span>
              <div className="check-grid">
                {roleOptions.map((role) => (
                  <label key={role} className="check-pill">
                    <input type="checkbox" checked={createForm.role_codes.includes(role)} onChange={() => toggleCreateRole(role)} />
                    <span>{role}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="toggle-row field-span-full">
              <input type="checkbox" name="must_change_password" checked={createForm.must_change_password} onChange={handleCreateChange} />
              <span>Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên</span>
            </label>

            <button className="button primary-button wide-button" type="submit">
              Tạo tài khoản nhân sự
            </button>
          </form>
        </div>

        <div className="glass-card">
          <h2>Người đang đăng nhập</h2>
          <div className="profile-grid single-column-grid">
            <div><span>Họ tên</span><strong>{profile?.full_name}</strong></div>
            <div><span>Roles</span><strong>{(profile?.roles || []).join(', ')}</strong></div>
            <div><span>Permissions</span><strong>{profile?.permissions?.length || 0}</strong></div>
          </div>
        </div>

        <div className="glass-card span-three-columns">
          <div className="section-header-inline">
            <h2>Danh sách staff</h2>
            <button className="button secondary-button" type="button" onClick={loadStaffAccounts}>Tải lại</button>
          </div>

          {loading ? (
            <div className="auth-loading">Đang tải danh sách tài khoản...</div>
          ) : (
            <div className="staff-table">
              {staffData.map((user) => {
                const meta = staffMeta[user.user_id] || {};
                const isSelf = user.user_id === profile?.user_id;

                return (
                  <article key={user.user_id} className="staff-card">
                    <div className="staff-card-top">
                      <div>
                        <h3>{user.full_name}</h3>
                        <p>{user.username}</p>
                      </div>
                      <span className={`tag status-tag status-${user.status}`}>{user.status}</span>
                    </div>

                    <div className="tag-cloud">
                      {user.roles.map((role) => (
                        <span key={role} className="tag role-tag">{role}</span>
                      ))}
                    </div>

                    {isSelf ? <div className="inline-note">Chính tài khoản đang đăng nhập. Các thao tác tự phá quyền đã bị chặn ở backend.</div> : null}

                    <div className="admin-action-grid triple-action-grid">
                      <FormField label="Cập nhật role">
                        <select className="field-input" value={(roleEdits[user.user_id] || user.roles)[0]} onChange={(event) => setRoleDraft(user.user_id, event.target.value)}>
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </FormField>
                      <button className="button secondary-button" type="button" onClick={() => handleUpdateRoles(user.user_id)} disabled={isSelf}>Lưu role</button>
                      <button className="button ghost-button" type="button" onClick={() => handleRemoveRoles(user.user_id)} disabled={isSelf}>Gỡ role</button>

                      <FormField label="Trạng thái">
                        <select className="field-input" value={statusEdits[user.user_id] || user.status} onChange={(event) => setStatusDraft(user.user_id, event.target.value)}>
                          {staffStatuses.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </FormField>
                      <button className="button secondary-button" type="button" onClick={() => handleUpdateStatus(user.user_id)} disabled={isSelf}>Lưu trạng thái</button>
                      <div className="inline-actions">
                        <button className="button ghost-button small-button" type="button" onClick={() => handleQuickAction('unlock', user.user_id)} disabled={isSelf}>Unlock</button>
                        <button className="button ghost-button small-button" type="button" onClick={() => handleQuickAction('activate', user.user_id)} disabled={isSelf}>Activate</button>
                        <button className="button ghost-button small-button" type="button" onClick={() => handleQuickAction('deactivate', user.user_id)} disabled={isSelf}>Deactivate</button>
                      </div>

                      <FormField label="Mật khẩu tạm mới" name={`reset-${user.user_id}`} type="password" value={resetPasswords[user.user_id] || ''} onChange={(event) => setResetPasswords((current) => ({ ...current, [user.user_id]: event.target.value }))} />
                      <button className="button ghost-button" type="button" onClick={() => handleResetPassword(user.user_id)} disabled={isSelf}>Reset mật khẩu</button>
                      <button className="button secondary-button" type="button" onClick={() => handleLoadMeta(user.user_id)}>Xem role/quyền</button>

                      <FormField label="Check permission">
                        <input className="field-input" value={permissionChecks[user.user_id] || ''} onChange={(event) => setPermissionChecks((current) => ({ ...current, [user.user_id]: event.target.value }))} placeholder="role.read hoặc auth.staff.read" />
                      </FormField>
                      <button className="button secondary-button" type="button" onClick={() => handleCheckPermission(user.user_id)}>Kiểm tra</button>
                    </div>

                    {meta.roles?.length ? (
                      <div className="subpanel">
                        <strong>Roles chi tiết</strong>
                        <div className="tag-cloud">
                          {meta.roles.map((role) => (
                            <span key={role.role_id} className="tag role-tag">{role.role_code}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {meta.permissions?.length ? (
                      <div className="subpanel">
                        <strong>Permissions thực tế</strong>
                        <div className="tag-cloud">
                          {meta.permissions.map((permission) => (
                            <span key={permission} className="tag permission-tag">{permission}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
