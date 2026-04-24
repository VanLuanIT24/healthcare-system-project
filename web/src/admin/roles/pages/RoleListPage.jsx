import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getRoleDetail, listPermissions, listRoles, updateRoleStatus } from '../roleApi';
import {
  formatNumber,
  getPermissionTone,
  getRoleStatusTone,
  getRoleUsageLevel,
  roleIcon,
} from '../roleUi';
import { RoleQuickPreviewDialog, RoleStatusDialog } from '../components/RoleDialogs';

function filterRoles(items, filters) {
  return items
    .filter((item) => {
      if (filters.permissionBucket === 'many' && item.permissions_count < 10) return false;
      if (filters.permissionBucket === 'few' && item.permissions_count >= 10) return false;
      if (filters.staffBucket === 'high' && item.users_count < 10) return false;
      if (filters.staffBucket === 'low' && item.users_count >= 10) return false;
      return true;
    })
    .sort((left, right) => {
      if (filters.sortBy === 'name_asc') return left.role_name.localeCompare(right.role_name);
      if (filters.sortBy === 'name_desc') return right.role_name.localeCompare(left.role_name);
      if (filters.sortBy === 'permissions_desc') return right.permissions_count - left.permissions_count;
      if (filters.sortBy === 'users_desc') return right.users_count - left.users_count;
      return left.role_name.localeCompare(right.role_name);
    });
}

export function RoleListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Math.max(Number(searchParams.get('page') || 1), 1);
  const [filters, setFilters] = useState({
    keyword: searchParams.get('keyword') || '',
    status: searchParams.get('status') || '',
    permissionBucket: searchParams.get('permission_bucket') || '',
    staffBucket: searchParams.get('staff_bucket') || '',
    sortBy: searchParams.get('sort') || 'name_asc',
  });
  const [viewMode, setViewMode] = useState(searchParams.get('view') || 'table');
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [statusDialog, setStatusDialog] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const [rolesData, permissionsData] = await Promise.all([
          listRoles(`limit=100${filters.keyword ? `&search=${encodeURIComponent(filters.keyword)}` : ''}${filters.status ? `&status=${filters.status}` : ''}`),
          listPermissions('limit=200'),
        ]);

        if (!active) return;
        setRoles(filterRoles(rolesData?.items || [], filters));
        setPermissions(permissionsData?.items || []);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [filters]);

  const stats = useMemo(() => {
    const activeCount = roles.filter((item) => item.status === 'active').length;
    const topRole = [...roles].sort((left, right) => right.users_count - left.users_count)[0];
    const underPermissioned = roles.filter((item) => item.permissions_count <= 2).length;

    return [
      { label: 'Tổng số vai trò', value: formatNumber(roles.length), note: '+2 tháng này', icon: '⌘', tone: 'indigo' },
      { label: 'Vai trò đang hoạt động', value: formatNumber(activeCount), note: roles.length ? `${Math.round((activeCount / roles.length) * 100)}% hoạt động` : '0% hoạt động', icon: '✓', tone: 'green' },
      { label: 'Vai trò dùng nhiều nhất', value: topRole ? `${formatNumber(topRole.users_count)} người dùng` : 'N/A', note: topRole?.role_name || 'Chưa có', icon: '↗', tone: 'amber' },
      { label: 'Vai trò thiếu quyền', value: formatNumber(underPermissioned), note: underPermissioned > 0 ? 'Cần rà soát' : 'Ổn định', icon: '▲', tone: 'red' },
    ];
  }, [roles]);

  const paginatedRoles = useMemo(() => {
    const pageSize = 4;
    const start = (currentPage - 1) * pageSize;
    return roles.slice(start, start + pageSize);
  }, [currentPage, roles]);

  const totalPages = Math.max(Math.ceil(roles.length / 4), 1);

  function updateFilters(next) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.keyword) params.set('keyword', next.keyword);
    if (next.status) params.set('status', next.status);
    if (next.permissionBucket) params.set('permission_bucket', next.permissionBucket);
    if (next.staffBucket) params.set('staff_bucket', next.staffBucket);
    if (next.sortBy) params.set('sort', next.sortBy);
    if (viewMode) params.set('view', viewMode);
    setSearchParams(params);
    setSelectedRoleIds([]);
  }

  function setPage(nextPage) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(nextPage));
    setSearchParams(params);
  }

  function changeView(nextView) {
    setViewMode(nextView);
    const params = new URLSearchParams(searchParams);
    params.set('view', nextView);
    setSearchParams(params);
  }

  function toggleRoleSelection(roleId) {
    setSelectedRoleIds((current) =>
      current.includes(roleId) ? current.filter((item) => item !== roleId) : [...current, roleId],
    );
  }

  function toggleAllVisibleRoles() {
    const visibleIds = paginatedRoles.map((item) => item.role_id);
    const allSelected = visibleIds.every((roleId) => selectedRoleIds.includes(roleId));

    setSelectedRoleIds((current) => {
      if (allSelected) {
        return current.filter((roleId) => !visibleIds.includes(roleId));
      }

      return [...new Set([...current, ...visibleIds])];
    });
  }

  function renderUsageAvatars(role) {
    const seed = role.role_name || role.role_code || 'R';
    const avatars = Array.from({ length: Math.min(role.users_count || 0, 3) }, (_, index) => `${seed}${index + 1}`);
    const remainder = Math.max((role.users_count || 0) - avatars.length, 0);

    return (
      <div className="role-user-cluster">
        <div className="role-user-cluster__avatars">
          {avatars.map((avatar, index) => (
            <span key={avatar} style={{ zIndex: avatars.length - index }}>
              {avatar.slice(0, 2).toUpperCase()}
            </span>
          ))}
        </div>
        <div className="role-user-cluster__meta">
          <strong>{formatNumber(role.users_count)}</strong>
          <small>{remainder > 0 ? `+${remainder} nhân sự` : role.users_count > 0 ? 'nhân sự' : 'Không còn sử dụng'}</small>
        </div>
      </div>
    );
  }

  async function openPreview(role) {
    try {
      const detail = await getRoleDetail(role.role_id);
      setPreview({
        role,
        permissions: detail?.permissions || [],
      });
    } catch (previewError) {
      setError(previewError.message);
    }
  }

  async function handleStatusConfirm() {
    if (!statusDialog?.role) return;

    setSubmitting(true);
    try {
      await updateRoleStatus(statusDialog.role.role_id, statusDialog.action === 'activate' ? 'active' : 'inactive');
      setStatusDialog(null);
      const refreshed = await listRoles(`limit=100${filters.keyword ? `&search=${encodeURIComponent(filters.keyword)}` : ''}${filters.status ? `&status=${filters.status}` : ''}`);
      setRoles(filterRoles(refreshed?.items || [], filters));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="role-page">
        <section className="role-hero">
          <div className="role-hero__copy">
            <p className="admin-page-header__eyebrow">Admin / Vai trò & quyền / Danh sách vai trò</p>
            <h1>Danh sách vai trò</h1>
            <p>Quản lý các vai trò truy cập trong hệ thống, theo dõi mức sử dụng và phân quyền cho từng nhóm người dùng.</p>
          </div>

          <div className="role-hero__actions">
            <button type="button" className="staff-button staff-button--ghost role-hero__action" onClick={() => updateFilters({ ...filters })}>
              <span>⟳</span>
              <span>Làm mới</span>
            </button>
            <button type="button" className="staff-button staff-button--ghost role-hero__action">
              <span>⇩</span>
              <span>Xuất danh sách</span>
            </button>
            <Link to="/admin/roles/create" className="staff-button staff-button--primary role-hero__action">
              <span>⊕</span>
              <span>Tạo vai trò mới</span>
            </Link>
          </div>
        </section>

        <section className="role-stats">
          {stats.map((item) => (
            <article key={item.label} className={`admin-metric-card admin-metric-card--${item.tone} role-stat-card`}>
              <div className="admin-metric-card__top">
                <span className="admin-metric-card__icon">{item.icon}</span>
                <small>{item.note}</small>
              </div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="role-filters admin-panel">
          <div className="role-filters__bar">
            <label className="admin-search role-filters__search">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Tìm theo tên vai trò hoặc mã code"
                value={filters.keyword}
                onChange={(event) => updateFilters({ ...filters, keyword: event.target.value })}
              />
            </label>

            <label className="role-filter-chip">
              <select value={filters.status} onChange={(event) => updateFilters({ ...filters, status: event.target.value })}>
                <option value="">Trạng thái: Tất cả</option>
                <option value="active">Trạng thái: Đang hoạt động</option>
                <option value="inactive">Trạng thái: Không hoạt động</option>
              </select>
            </label>

            <label className="role-filter-chip">
              <select value={filters.permissionBucket} onChange={(event) => updateFilters({ ...filters, permissionBucket: event.target.value })}>
                <option value="">Số quyền: Tăng dần</option>
                <option value="many">Số quyền: Nhiều</option>
                <option value="few">Số quyền: Ít</option>
              </select>
            </label>

            <label className="role-filter-chip">
              <select value={filters.sortBy} onChange={(event) => updateFilters({ ...filters, sortBy: event.target.value })}>
                <option value="users_desc">Lượt dùng: Nhiều nhất</option>
                <option value="permissions_desc">Lượt dùng: Nhiều quyền nhất</option>
                <option value="name_asc">Lượt dùng: Tên A-Z</option>
                <option value="name_desc">Lượt dùng: Tên Z-A</option>
              </select>
            </label>

            <div className="role-view-toggle" aria-label="Chế độ hiển thị">
              <button type="button" className={viewMode === 'table' ? 'is-active' : ''} onClick={() => changeView('table')}>
                ☷
              </button>
              <button type="button" className={viewMode === 'compact' ? 'is-active' : ''} onClick={() => changeView('compact')}>
                ◫
              </button>
            </div>
          </div>
        </section>

        <section className="admin-panel">
          {loading ? <div className="staff-loading-panel">Đang tải danh sách vai trò...</div> : null}
          {!loading && error ? <p className="form-message error">{error}</p> : null}

          {!loading && !error && roles.length === 0 ? (
            <div className="staff-empty-state">
              <div className="staff-empty-state__art">⌘</div>
              <strong>Chưa có vai trò nào trong hệ thống</strong>
              <p>Tạo vai trò đầu tiên để bắt đầu cấu hình phân quyền cho nền tảng bệnh viện.</p>
              <Link to="/admin/roles/create" className="staff-button staff-button--primary">
                Tạo vai trò đầu tiên
              </Link>
            </div>
          ) : null}

          {!loading && !error && roles.length > 0 ? (
            <div className="role-table">
              <div className="role-table__head">
                <label className="role-table__checkbox">
                  <input
                    type="checkbox"
                    checked={paginatedRoles.length > 0 && paginatedRoles.every((item) => selectedRoleIds.includes(item.role_id))}
                    onChange={toggleAllVisibleRoles}
                  />
                </label>
                <span>Vai trò & mã</span>
                <span>Mô tả</span>
                <span>Trạng thái</span>
                <span>Quyền</span>
                <span>Nhân sự đang dùng</span>
                <span>Thao tác</span>
              </div>

              {paginatedRoles.map((role) => {
                const usage = getRoleUsageLevel(role.users_count);
                return (
                  <div key={role.role_id} className="role-table__row">
                    <label className="role-table__checkbox">
                      <input
                        type="checkbox"
                        checked={selectedRoleIds.includes(role.role_id)}
                        onChange={() => toggleRoleSelection(role.role_id)}
                      />
                    </label>

                    <div className="role-table__identity">
                      <button type="button" className="role-table__icon" onClick={() => navigate(`/admin/roles/${role.role_id}`)}>
                        {roleIcon(role.role_code)}
                      </button>
                      <div>
                        <strong>{role.role_name}</strong>
                        <code className="role-code-badge">{role.role_code.toUpperCase()}</code>
                      </div>
                    </div>

                    <p className="role-table__description">{role.description || 'Vai trò nền tảng cho vận hành nội bộ.'}</p>

                    <span className={`admin-status-badge admin-status-badge--${getRoleStatusTone(role.status)}`}>{role.status}</span>

                    <button type="button" className="role-inline-stat" onClick={() => navigate(`/admin/roles/${role.role_id}/permissions`)}>
                      <span className={`role-chip role-chip--${getPermissionTone(role.role_code)}`}>🛡</span>
                      <strong>{role.permissions_count === permissions.length ? `Tất cả (${formatNumber(role.permissions_count)})` : formatNumber(role.permissions_count)}</strong>
                    </button>

                    <button type="button" className="role-inline-stat role-inline-stat--usage" onClick={() => navigate(`/admin/roles/${role.role_id}?tab=staff`)}>
                      {renderUsageAvatars(role)}
                      <small className={`role-usage role-usage--${usage.tone}`}>{usage.label}</small>
                    </button>

                    <div className="staff-row-actions staff-row-actions--menu">
                      <button type="button">•••</button>
                      <div className="staff-row-actions__quick">
                        <button type="button" onClick={() => openPreview(role)}>Xem nhanh</button>
                        <button type="button" onClick={() => navigate(`/admin/roles/${role.role_id}`)}>Chi tiết</button>
                        <button type="button" onClick={() => navigate(`/admin/roles/${role.role_id}/edit`)}>Chỉnh sửa</button>
                        <button type="button" onClick={() => navigate(`/admin/roles/${role.role_id}/permissions`)}>Gán quyền</button>
                        <button type="button" onClick={() => setStatusDialog({ action: role.status === 'active' ? 'deactivate' : 'activate', role })}>
                          {role.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="role-table__footer">
                <span>Đang hiển thị {paginatedRoles.length} trong tổng số {roles.length} vai trò</span>
                <div className="role-pagination">
                  <button type="button" disabled={currentPage <= 1} onClick={() => setPage(Math.max(currentPage - 1, 1))}>
                    Trước
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      className={pageNumber === currentPage ? 'is-active' : ''}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(Math.min(currentPage + 1, totalPages))}>
                    Sau
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </section>

      {preview ? (
        <RoleQuickPreviewDialog role={preview.role} permissions={preview.permissions} onClose={() => setPreview(null)} />
      ) : null}

      {statusDialog ? (
        <RoleStatusDialog
          role={statusDialog.role}
          action={statusDialog.action}
          onClose={() => setStatusDialog(null)}
          onConfirm={handleStatusConfirm}
          isSubmitting={submitting}
        />
      ) : null}
    </>
  );
}
