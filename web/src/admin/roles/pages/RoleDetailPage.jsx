import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getDepartments } from '../../staff/staffApi';
import {
  getAuditLogs,
  getRoleDetail,
  getRoleUsageSummary,
  getUsersByRole,
  listPermissions,
  removePermissionsFromRole,
  syncRolePermissions,
  updateRoleStatus,
} from '../roleApi';
import {
  formatCompactDate,
  formatDateTime,
  formatNumber,
  getPermissionBrief,
  getPermissionDetail,
  getPermissionModuleTitle,
  getPermissionTone,
  getRoleStatusTone,
  getRoleUsageLevel,
  groupPermissions,
  roleIcon,
} from '../roleUi';
import { RoleStatusDialog } from '../components/RoleDialogs';

const TABS = [
  { id: 'info', label: 'Thông tin vai trò' },
  { id: 'permissions', label: 'Quyền' },
  { id: 'staff', label: 'Nhân sự đang dùng' },
  { id: 'audit', label: 'Nhật ký / thay đổi gần đây' },
];

export function RoleDetailPage() {
  const { roleId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [roleDetail, setRoleDetail] = useState(null);
  const [usage, setUsage] = useState(null);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [staffItems, setStaffItems] = useState([]);
  const [auditItems, setAuditItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [permissionModuleFilter, setPermissionModuleFilter] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusDialog, setStatusDialog] = useState(null);

  const activeTab = searchParams.get('tab') || 'info';

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [detailData, usageData, permissionsData, usersData, auditData, departmentsData] = await Promise.all([
          getRoleDetail(roleId),
          getRoleUsageSummary(roleId),
          listPermissions('limit=500'),
          getUsersByRole(roleId, 'limit=50'),
          getAuditLogs('limit=100'),
          getDepartments('limit=100'),
        ]);

        if (!active) return;

        setRoleDetail(detailData);
        setUsage(usageData);
        setAllPermissions(permissionsData?.items || []);
        setSelectedPermissions((detailData?.permissions || []).map((item) => item.permission_code));
        setStaffItems(usersData?.items || []);
        setDepartments(departmentsData?.items || []);
        setAuditItems(
          (auditData?.items || []).filter((item) => item.target_type === 'role' && String(item.target_id) === String(detailData?.role?.role_id)),
        );
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
  }, [roleId]);

  const groupedSelectedPermissions = useMemo(() => {
    const filtered = allPermissions.filter((item) => {
      if (!selectedPermissions.includes(item.permission_code)) return false;
      if (permissionModuleFilter && item.module_key !== permissionModuleFilter) return false;
      if (!permissionSearch) return true;
      const keyword = permissionSearch.toLowerCase();
      return item.permission_code.toLowerCase().includes(keyword) || item.permission_name.toLowerCase().includes(keyword);
    });

    return groupPermissions(filtered);
  }, [allPermissions, permissionModuleFilter, permissionSearch, selectedPermissions]);

  const usageLevel = getRoleUsageLevel(usage?.users_count || roleDetail?.users_count || 0);
  const groupedRolePermissions = useMemo(() => groupPermissions(roleDetail?.permissions || []), [roleDetail]);
  const recentStaff = staffItems.slice(0, 2);
  const recentAudit = auditItems.slice(0, 3);

  function setTab(tabId) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tabId);
    setSearchParams(params);
  }

  async function handleSyncPermissions() {
    setSubmitting(true);
    try {
      await syncRolePermissions(roleId, selectedPermissions);
      const refreshed = await getRoleDetail(roleId);
      setRoleDetail(refreshed);
      setSelectedPermissions((refreshed?.permissions || []).map((item) => item.permission_code));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveSelected() {
    if (selectedRows.length === 0) return;

    setSubmitting(true);
    try {
      await removePermissionsFromRole(roleId, selectedRows);
      const nextSelected = selectedPermissions.filter((item) => !selectedRows.includes(item));
      setSelectedPermissions(nextSelected);
      setSelectedRows([]);
      const refreshed = await getRoleDetail(roleId);
      setRoleDetail(refreshed);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusConfirm() {
    if (!statusDialog) return;
    setSubmitting(true);
    try {
      await updateRoleStatus(roleId, statusDialog.action === 'activate' ? 'active' : 'inactive');
      setStatusDialog(null);
      const refreshed = await getRoleDetail(roleId);
      setRoleDetail(refreshed);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <section className="staff-loading-panel">Đang tải chi tiết vai trò...</section>;
  if (!roleDetail?.role) return <section className="staff-loading-panel">{error || 'Không tìm thấy vai trò.'}</section>;

  const role = roleDetail.role;

  return (
    <>
      <section className="role-page role-detail-page">
        <section className="role-detail-hero role-detail-hero--premium admin-panel">
          <div className="role-detail-hero__main">
            <p className="admin-page-header__eyebrow">Admin / Vai trò & quyền / Danh sách vai trò / Chi tiết vai trò</p>
            <div className="role-detail-hero__identity">
              <span>{roleIcon(role.role_code)}</span>
              <div>
                <h1>{role.role_name}</h1>
                <code>{role.role_code}</code>
                <div className="role-detail-hero__meta">
                  <span className={`admin-status-badge admin-status-badge--${getRoleStatusTone(role.status)}`}>
                    {role.status === 'active' ? 'Đang hoạt động' : 'Tạm ngưng'}
                  </span>
                  <small>Cập nhật lần cuối {formatDateTime(role.updated_at || role.created_at)}</small>
                </div>
                <p>{role.description || 'Vai trò truy cập chuyên biệt dành cho quản trị vận hành nội bộ.'}</p>
              </div>
            </div>
          </div>

          <div className="role-detail-hero__actions">
            <Link to={`/admin/roles/${role.role_id}/edit`} state={{ returnTo: `/admin/roles/${role.role_id}` }} className="staff-button staff-button--ghost">
              Sửa vai trò
            </Link>
            <Link to={`/admin/roles/${role.role_id}/permissions`} className="staff-button staff-button--ghost">
              Gán quyền
            </Link>
            <button type="button" className="staff-button staff-button--ghost" onClick={handleSyncPermissions} disabled={submitting}>
              Đồng bộ quyền
            </button>
            <button
              type="button"
              className="staff-button staff-button--primary"
              onClick={() => setStatusDialog({ action: role.status === 'active' ? 'deactivate' : 'activate' })}
            >
              {role.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'}
            </button>
          </div>
        </section>

        <section className="role-detail-metrics">
          <article className="role-detail-metric admin-panel">
            <span className="role-detail-metric__icon role-chip role-chip--indigo">⌘</span>
            <div>
              <small>Tổng quyền hạn</small>
              <strong>{formatNumber(usage?.permissions_count || roleDetail.permissions.length)}</strong>
            </div>
          </article>
          <article className="role-detail-metric admin-panel">
            <span className="role-detail-metric__icon role-chip role-chip--teal">◎</span>
            <div>
              <small>Nhân sự đang dùng</small>
              <strong>{formatNumber(usage?.users_count || roleDetail.users_count)}</strong>
            </div>
          </article>
          <article className="role-detail-metric admin-panel">
            <span className="role-detail-metric__icon role-chip role-chip--amber">↗</span>
            <div>
              <small>Mức độ sử dụng</small>
              <strong>{usageLevel.label}</strong>
            </div>
          </article>
        </section>

        <section className="staff-detail-tabsbar role-detail-tabs">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" className={activeTab === tab.id ? 'is-active' : ''} onClick={() => setTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </section>

        {error ? <p className="form-message error">{error}</p> : null}

        {activeTab === 'info' ? (
          <section className="role-detail-workspace">
            <article className="admin-panel role-detail-content">
              <div className="role-detail-content__head">
                <h2>Chi tiết cơ bản</h2>
              </div>

              <div className="role-detail-basic-grid">
                <div>
                  <span>Tên vai trò</span>
                  <strong>{role.role_name}</strong>
                </div>
                <div>
                  <span>Mã vai trò</span>
                  <strong>{role.role_code}</strong>
                </div>
                <div>
                  <span>Loại vai trò</span>
                  <strong>Hệ thống</strong>
                </div>
                <div>
                  <span>Ngày tạo</span>
                  <strong>{formatCompactDate(role.created_at)}</strong>
                </div>
                <div className="role-detail-basic-grid__full">
                  <span>Mô tả</span>
                  <p>{role.description || 'Vai trò cốt lõi dành cho vận hành truy cập nội bộ trong hệ thống bệnh viện.'}</p>
                </div>
              </div>

              <div className="role-detail-content__head role-detail-content__head--section">
                <h2>Danh sách quyền hạn</h2>
              </div>

              <div className="role-detail-permission-groups">
                {Object.entries(groupedRolePermissions).map(([moduleKey, items]) => (
                  <section key={moduleKey} className="role-detail-permission-group">
                    <header>
                      <strong>{getPermissionModuleTitle(moduleKey)}</strong>
                    </header>
                    <div className="role-detail-permission-chips">
                      {items.map((permission) => (
                        <span key={permission.permission_id || permission.permission_code} className={`role-chip role-chip--${getPermissionTone(permission.module_key)}`}>
                          {getPermissionBrief(permission)}
                        </span>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </article>

            <aside className="role-detail-side">
              <article className="admin-panel role-detail-side__card">
                <div className="admin-panel__heading">
                  <h2>Nhân sự ({formatNumber(staffItems.length)})</h2>
                  <button type="button" onClick={() => setTab('staff')}>Xem tất cả</button>
                </div>
                <div className="role-detail-side__staff">
                  {recentStaff.map((item) => (
                    <Link key={item.user_id} to={`/admin/staff/${item.user_id}`} className="role-side-person">
                      <span className="admin-avatar">{String(item.full_name || item.username || 'U').slice(0, 2).toUpperCase()}</span>
                      <div>
                        <strong>{item.full_name || item.username}</strong>
                        <span>{departments.find((department) => department.department_id === item.department_id)?.department_name || 'Chưa gán'}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </article>

              <article className="admin-panel role-detail-side__card">
                <div className="admin-panel__heading">
                  <h2>Nhật ký thay đổi</h2>
                </div>
                <div className="role-side-audit">
                  {recentAudit.map((item) => (
                    <div key={item._id || item.audit_log_id} className="role-side-audit__item">
                      <span />
                      <div>
                        <strong>{item.message || item.action}</strong>
                        <small>{formatDateTime(item.created_at)} • {item.actor_type}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </aside>
          </section>
        ) : null}

        {activeTab === 'permissions' ? (
          <section className="admin-panel role-permissions-panel">
            <div className="role-permissions-toolbar">
              <div>
                <h2>Tổng quan phân quyền</h2>
                <p>Đây là bản xem nhanh các quyền hiện có. Màn hình gán quyền riêng sẽ dùng để chỉnh sửa và đồng bộ sâu.</p>
              </div>
              <div className="role-permissions-toolbar__actions">
                <label className="admin-search">
                  <span>⌕</span>
                    <input
                    type="search"
                    placeholder="Tìm quyền"
                    value={permissionSearch}
                    onChange={(event) => setPermissionSearch(event.target.value)}
                  />
                </label>
                <select value={permissionModuleFilter} onChange={(event) => setPermissionModuleFilter(event.target.value)}>
                  <option value="">Tất cả module</option>
                  {Object.keys(groupPermissions(allPermissions)).map((moduleKey) => (
                    <option key={moduleKey} value={moduleKey}>
                      {moduleKey}
                    </option>
                  ))}
                </select>
                <Link to={`/admin/roles/${role.role_id}/permissions`} className="staff-button staff-button--primary">
                  Mở trung tâm quyền
                </Link>
              </div>
            </div>

            <div className="role-permission-groups">
              {Object.entries(groupedSelectedPermissions).map(([moduleKey, items]) => (
                <section key={moduleKey} className="role-permission-group">
                  <div className="role-permission-group__head role-permission-group__head--static">
                    <div>
                      <strong>{moduleKey}</strong>
                      <span>{items.length} quyền</span>
                    </div>
                  </div>
                  <div className="role-permission-grid">
                    {items.map((permission) => (
                      <label key={permission.permission_id} className="role-permission-card role-permission-card--selected role-permission-card--readonly">
                        <input type="checkbox" checked readOnly />
                        <div>
                          <strong>{getPermissionBrief(permission)}</strong>
                          <code className={`role-chip role-chip--${getPermissionTone(permission.module_key)}`}>{getPermissionModuleTitle(permission.module_key)}</code>
                          <p>{getPermissionDetail(permission)}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === 'staff' ? (
          <section className="admin-panel">
            <div className="admin-panel__heading">
              <h2>Nhân sự đang dùng vai trò này</h2>
              <button type="button" onClick={() => navigate('/admin/staff')}>
                Đi đến nhân sự
              </button>
            </div>

            <div className="role-staff-insights">
              <div>
                <span>Tổng nhân sự</span>
                <strong>{formatNumber(staffItems.length)}</strong>
              </div>
              <div>
                <span>Khoa/Phòng nhiều nhất</span>
                <strong>
                  {departments.find((department) => department.department_id === staffItems[0]?.department_id)?.department_name || 'N/A'}
                </strong>
              </div>
              <div>
                <span>Mức độ sử dụng</span>
                <strong>{usageLevel.label}</strong>
              </div>
            </div>

            <div className="role-staff-table">
              <div className="role-staff-table__head">
                <span>Avatar</span>
                <span>Họ tên</span>
                <span>Email</span>
                <span>Khoa/Phòng</span>
                <span>Trạng thái</span>
                <span>Lần gán</span>
                <span>Thao tác</span>
              </div>
              {staffItems.map((item) => (
                <div key={item.user_id} className="role-staff-table__row">
                  <span className="admin-avatar">{String(item.full_name || item.username || 'U').slice(0, 2).toUpperCase()}</span>
                  <strong>{item.full_name || item.username}</strong>
                  <span>{item.email || item.username}</span>
                  <span>{departments.find((department) => department.department_id === item.department_id)?.department_name || 'Chưa gán'}</span>
                  <span className={`admin-status-badge admin-status-badge--${getRoleStatusTone(item.status)}`}>{item.status}</span>
                  <span>{formatDateTime(item.assigned_at)}</span>
                  <Link to={`/admin/staff/${item.user_id}`} className="staff-button staff-button--ghost">
                    Xem nhân sự
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === 'audit' ? (
          <section className="admin-panel">
            <div className="admin-panel__heading">
              <h2>Nhật ký / thay đổi gần đây</h2>
              <button type="button" onClick={() => window.location.reload()}>
                Làm mới
              </button>
            </div>

            <div className="staff-audit-timeline">
              {auditItems.length === 0 ? (
                <div className="staff-empty-state">
                  <div className="staff-empty-state__art">◌</div>
                  <strong>Chưa có nhật ký kiểm toán riêng cho vai trò này</strong>
                  <p>Vai trò sẽ bắt đầu hiển thị lịch sử thay đổi khi có thao tác cập nhật, đổi trạng thái hoặc đồng bộ quyền.</p>
                </div>
              ) : (
                auditItems.map((item) => (
                  <div key={item._id || item.audit_log_id} className="staff-audit-timeline__item">
                    <span className="staff-audit-timeline__icon staff-audit-timeline__icon--info">◉</span>
                    <div className="staff-audit-timeline__content">
                      <strong>{item.message || item.action}</strong>
                      <p>{item.action}</p>
                      <div className="staff-audit-timeline__meta">
                        <span>{item.actor_type}</span>
                        <span>{item.status}</span>
                        <span>{formatDateTime(item.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}
      </section>

      {statusDialog ? (
        <RoleStatusDialog
          role={role}
          action={statusDialog.action}
          onClose={() => setStatusDialog(null)}
          onConfirm={handleStatusConfirm}
          isSubmitting={submitting}
        />
      ) : null}
    </>
  );
}
