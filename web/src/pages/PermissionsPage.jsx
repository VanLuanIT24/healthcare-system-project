import { useEffect, useState } from 'react';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function PermissionsPage() {
  const { session } = useAuth();
  const accessToken = session?.accessToken;
  const [filters, setFilters] = useState({ search: '', module_key: '' });
  const [permissions, setPermissions] = useState([]);
  const [error, setError] = useState('');

  async function loadPermissions() {
    try {
      const response = await api.listPermissions(filters, accessToken);
      setPermissions(response.data.items || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    if (accessToken) {
      loadPermissions();
    }
  }, [accessToken]);

  function handleChange(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <section className="dashboard-page">
      <div className="page-headline">
        <span className="eyebrow">Permission Catalog</span>
        <h1>Danh mục permissions</h1>
        <p>Dùng để quan sát toàn bộ permission hiện có trong hệ thống và hỗ trợ thao tác gán quyền cho role.</p>
      </div>

      <StatusMessage type="error">{error}</StatusMessage>

      <div className="glass-card">
        <div className="form-grid compact-grid">
          <FormField label="Tìm kiếm" name="search" value={filters.search} onChange={handleChange} />
          <FormField label="Module" name="module_key" value={filters.module_key} onChange={handleChange} />
        </div>
        <button className="button primary-button" type="button" onClick={loadPermissions}>
          Lọc permission
        </button>

        <div className="permissions-catalog top-gap">
          {permissions.map((permission) => (
            <article key={permission.permission_id} className="staff-card">
              <div className="staff-card-top">
                <div>
                  <h3>{permission.permission_code}</h3>
                  <p>{permission.permission_name}</p>
                </div>
                <span className="tag permission-tag">{permission.module_key}</span>
              </div>
              <div className="inline-note">{permission.description || 'Không có mô tả'}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
