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
  const { session } = useAuth();
  const accessToken = session?.accessToken;
  const [staffData, setStaffData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [roleEdits, setRoleEdits] = useState({});
  const [statusEdits, setStatusEdits] = useState({});
  const [resetPasswords, setResetPasswords] = useState({});

  async function loadStaffAccounts() {
    if (!accessToken) {
      return;
    }

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
    setCreateForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
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
    setError('');
    setFeedback('');

    try {
      const response = await api.updateStaffRoles(
        { user_id: userId, role_codes: roleEdits[userId] || [] },
        accessToken,
      );
      setFeedback(response.message);
      await loadStaffAccounts();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleUpdateStatus(userId) {
    setError('');
    setFeedback('');

    try {
      const response = await api.updateStaffStatus(
        { user_id: userId, status: statusEdits[userId] || 'active' },
        accessToken,
      );
      setFeedback(response.message);
      await loadStaffAccounts();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleResetPassword(userId) {
    setError('');
    setFeedback('');

    try {
      const response = await api.resetStaffPassword(
        { user_id: userId, new_password: resetPasswords[userId] || '' },
        accessToken,
      );
      setFeedback(response.message);
      setResetPasswords((current) => ({ ...current, [userId]: '' }));
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <section className="dashboard-page">
      <div className="page-headline">
        <span className="eyebrow">Staff Administration</span>
        <h1>Quản trị tài khoản nhân sự</h1>
        <p>Tạo staff account, gán role, khóa hoặc mở khóa tài khoản và reset mật khẩu đúng theo permission backend.</p>
      </div>

      <StatusMessage type="error">{error}</StatusMessage>
      <StatusMessage type="success">{feedback}</StatusMessage>

      <div className="dashboard-grid">
        <div className="glass-card">
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
                    <input
                      type="checkbox"
                      checked={createForm.role_codes.includes(role)}
                      onChange={() => toggleCreateRole(role)}
                    />
                    <span>{role}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="toggle-row field-span-full">
              <input
                type="checkbox"
                name="must_change_password"
                checked={createForm.must_change_password}
                onChange={handleCreateChange}
              />
              <span>Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên</span>
            </label>

            <button className="button primary-button wide-button" type="submit">
              Tạo tài khoản nhân sự
            </button>
          </form>
        </div>

        <div className="glass-card">
          <div className="section-header-inline">
            <h2>Danh sách staff</h2>
            <button className="button secondary-button" type="button" onClick={loadStaffAccounts}>
              Tải lại
            </button>
          </div>

          {loading ? (
            <div className="auth-loading">Đang tải danh sách tài khoản...</div>
          ) : (
            <div className="staff-table">
              {staffData.map((user) => (
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
                      <span key={role} className="tag role-tag">
                        {role}
                      </span>
                    ))}
                  </div>

                  <div className="admin-action-grid">
                    <FormField label="Cập nhật role">
                      <select
                        className="field-input"
                        value={(roleEdits[user.user_id] || user.roles)[0]}
                        onChange={(event) => setRoleDraft(user.user_id, event.target.value)}
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <button className="button secondary-button" type="button" onClick={() => handleUpdateRoles(user.user_id)}>
                      Lưu role
                    </button>

                    <FormField label="Trạng thái">
                      <select
                        className="field-input"
                        value={statusEdits[user.user_id] || user.status}
                        onChange={(event) => setStatusDraft(user.user_id, event.target.value)}
                      >
                        {staffStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <button className="button secondary-button" type="button" onClick={() => handleUpdateStatus(user.user_id)}>
                      Lưu trạng thái
                    </button>

                    <FormField
                      label="Mật khẩu tạm mới"
                      name={`reset-${user.user_id}`}
                      type="password"
                      value={resetPasswords[user.user_id] || ''}
                      onChange={(event) => setResetDraft(user.user_id, event.target.value)}
                    />
                    <button className="button ghost-button" type="button" onClick={() => handleResetPassword(user.user_id)}>
                      Reset mật khẩu
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
