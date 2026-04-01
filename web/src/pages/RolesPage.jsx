import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const initialRoleForm = {
  role_code: '',
  role_name: '',
  description: '',
  status: 'active',
};

export default function RolesPage() {
  const { session, profile } = useAuth();
  const accessToken = session?.accessToken;
  const [roles, setRoles] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [form, setForm] = useState(initialRoleForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadRoles() {
    try {
      const response = await api.listRoles(filters, accessToken);
      setRoles(response.data.items || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    if (accessToken) {
      loadRoles();
    }
  }, [accessToken]);

  function handleFilterChange(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleFormChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleCreateRole(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      const response = await api.createRole(form, accessToken);
      setSuccess(response.message);
      setForm(initialRoleForm);
      await loadRoles();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleSeedSystem() {
    setError('');
    setSuccess('');
    try {
      const response = await api.seedSystemAccess(accessToken);
      setSuccess(response.message);
      await loadRoles();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <section className="dashboard-page">
      <div className="page-headline">
        <span className="eyebrow">Role Management</span>
        <h1>Quản trị role</h1>
        <p>Tạo role mới, xem danh sách role, seed hệ thống mặc định và đi vào màn chi tiết để sửa role hoặc gán permission.</p>
      </div>

      <StatusMessage type="error">{error}</StatusMessage>
      <StatusMessage type="success">{success}</StatusMessage>

      <div className="dashboard-grid">
        <div className="glass-card">
          <div className="section-header-inline">
            <h2>Danh sách role</h2>
            {profile?.roles?.includes('super_admin') ? (
              <button className="button secondary-button" type="button" onClick={handleSeedSystem}>
                Seed hệ thống
              </button>
            ) : null}
          </div>
          <div className="form-grid compact-grid">
            <FormField label="Tìm kiếm" name="search" value={filters.search} onChange={handleFilterChange} />
            <FormField label="Trạng thái" name="status" value={filters.status} onChange={handleFilterChange}>
              <select className="field-input" name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">Tất cả</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </FormField>
          </div>
          <button className="button primary-button" type="button" onClick={loadRoles}>
            Lọc danh sách
          </button>

          <div className="staff-table top-gap">
            {roles.map((role) => (
              <article key={role.role_id} className="staff-card">
                <div className="staff-card-top">
                  <div>
                    <h3>{role.role_name}</h3>
                    <p>{role.role_code}</p>
                  </div>
                  <span className={`tag status-tag ${role.status === 'active' ? 'status-active' : 'status-disabled'}`}>{role.status}</span>
                </div>
                <div className="inline-note">Users: {role.users_count} | Permissions: {role.permissions_count}</div>
                <Link to={`/quan-tri/roles/${role.role_id}`} className="button ghost-button top-gap">
                  Xem chi tiết role
                </Link>
              </article>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <h2>Tạo role mới</h2>
          <form className="form-card compact-form" onSubmit={handleCreateRole}>
            <FormField label="Role code" name="role_code" value={form.role_code} onChange={handleFormChange} required />
            <FormField label="Role name" name="role_name" value={form.role_name} onChange={handleFormChange} required />
            <FormField label="Description" name="description" value={form.description} onChange={handleFormChange} />
            <FormField label="Status" name="status" value={form.status} onChange={handleFormChange}>
              <select className="field-input" name="status" value={form.status} onChange={handleFormChange}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </FormField>
            <button className="button primary-button" type="submit">Tạo role</button>
          </form>
        </div>
      </div>
    </section>
  );
}
