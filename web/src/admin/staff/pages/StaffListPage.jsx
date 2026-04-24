import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  activateStaffAccount,
  deactivateStaffAccount,
  getAssignableRoles,
  getDepartments,
  getStaffAccounts,
  getStaffSummary,
  resetStaffPassword,
  unlockStaffAccount,
} from '../staffApi';
import { formatCompactDate, formatDateTime, formatNumber, getInitials, getStatusTone } from '../staffUi';
import { ResetPasswordDialog, StaffStatusDialog } from '../components/StaffDialogs';

function buildQuery(filters, page) {
  const params = new URLSearchParams();
  params.set('limit', '12');
  params.set('page', String(page));

  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.role_code) params.set('role_code', filters.role_code);
  if (filters.status) params.set('status', filters.status);

  return params.toString();
}

export function StaffListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    keyword: searchParams.get('keyword') || '',
    role_code: searchParams.get('role') || '',
    department_id: searchParams.get('department') || '',
    status: searchParams.get('status') || '',
    staff_type: '',
  });
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const modal = searchParams.get('modal');
    const userId = searchParams.get('userId');
    if (!modal || !userId || accounts.length === 0) return;
    const matched = accounts.find((item) => item.user_id === userId);
    if (matched) setDialog({ type: modal, staff: matched });
  }, [accounts, searchParams]);

  useEffect(() => {
    let active = true;

    async function loadMeta() {
      try {
        const [summaryData, rolesData, departmentsData] = await Promise.all([
          getStaffSummary(),
          getAssignableRoles(),
          getDepartments(),
        ]);

        if (!active) return;
        setSummary(summaryData);
        setRoles(rolesData?.items || []);
        setDepartments(departmentsData?.items || []);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      }
    }

    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAccounts() {
      setLoading(true);
      setError('');

      try {
        const result = await getStaffAccounts(buildQuery(filters, page));
        if (!active) return;

        let items = result?.items || [];

        if (filters.department_id) {
          items = items.filter((item) => item.department_id === filters.department_id);
        }

        if (filters.staff_type) {
          items = items.filter((item) => (item.roles || []).includes(filters.staff_type));
        }

        setAccounts(items);
        setPagination(result?.pagination || { page: 1, total_pages: 1, total: items.length });
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAccounts();
    return () => {
      active = false;
    };
  }, [filters, page]);

  const miniStats = useMemo(() => {
    const noRoleCount = accounts.filter((item) => !item.roles || item.roles.length === 0).length;
    const newCount = accounts.filter((item) => {
      if (!item.created_at) return false;
      return Date.now() - new Date(item.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    return [
    { label: 'Tổng nhân sự', value: formatNumber(summary?.total), icon: '◉', tone: 'indigo' },
    { label: 'Đang hoạt động', value: formatNumber(summary?.active), icon: '✓', tone: 'green' },
    { label: 'Bị khóa', value: formatNumber(summary?.locked), icon: '⌂', tone: 'red' },
    { label: 'Chưa có vai trò', value: formatNumber(noRoleCount), icon: '▲', tone: 'amber' },
    { label: 'Mới tạo', value: formatNumber(newCount), icon: '✦', tone: 'violet' },
    ];
  }, [accounts, summary]);

  async function handleStatusAction(action, staff) {
    setSubmitting(true);
    try {
      if (action === 'activate') await activateStaffAccount(staff.user_id);
      if (action === 'deactivate') await deactivateStaffAccount(staff.user_id);
      if (action === 'unlock') await unlockStaffAccount(staff.user_id);

      closeDialog();
      const refreshed = await getStaffAccounts(buildQuery(filters, page));
      setAccounts(refreshed?.items || []);
      setPagination(refreshed?.pagination || pagination);
      setSummary(await getStaffSummary());
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(payload) {
    if (!dialog?.staff) return;
    setSubmitting(true);
    try {
      await resetStaffPassword(dialog.staff.user_id, payload);
      closeDialog();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetFilters() {
    setFilters({ keyword: '', role_code: '', department_id: '', status: '', staff_type: '' });
    setPage(1);
    setSearchParams(new URLSearchParams());
  }

  function updateSearch(nextFilters) {
    const params = new URLSearchParams(searchParams);
    if (nextFilters.keyword) params.set('keyword', nextFilters.keyword);
    else params.delete('keyword');
    if (nextFilters.role_code) params.set('role', nextFilters.role_code);
    else params.delete('role');
    if (nextFilters.department_id) params.set('department', nextFilters.department_id);
    else params.delete('department');
    if (nextFilters.status) params.set('status', nextFilters.status);
    else params.delete('status');
    setSearchParams(params);
  }

  function openDialog(type, staff) {
    const params = new URLSearchParams(searchParams);
    params.set('modal', type);
    params.set('userId', staff.user_id);
    setSearchParams(params);
    setDialog({ type, staff });
  }

  function closeDialog() {
    const params = new URLSearchParams(searchParams);
    params.delete('modal');
    params.delete('userId');
    setSearchParams(params);
    setDialog(null);
  }

  return (
    <>
      <section className="staff-list-hero">
        <div className="staff-list-hero__copy">
          <h1>Danh sách nhân sự</h1>
          <p>Quản lý tài khoản nhân sự bệnh viện, vai trò và quyền truy cập theo khoa/phòng.</p>
        </div>

        <div className="staff-list-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={() => window.location.reload()}>
            <span>↻</span>
              <span>Làm mới</span>
          </button>
          <button type="button" className="staff-button staff-button--ghost">
            <span>⇩</span>
              <span>Xuất dữ liệu</span>
          </button>
          <Link to="/admin/staff/create" className="staff-button staff-button--primary">
            <span>＋</span>
            <span>Tạo nhân sự</span>
          </Link>
        </div>
      </section>

      <section className="staff-mini-stats staff-mini-stats--list">
        {miniStats.map((item) => (
          <article key={item.label} className={`staff-mini-stat staff-mini-stat--${item.tone}`}>
            <span>{item.icon}</span>
            <div>
              <small>{item.label}</small>
              <strong>{loading ? '...' : item.value}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="staff-filters staff-filters--list">
        <div className="staff-filters__search">
          <label className="staff-search-input">
            <span>⌕</span>
            <input
              type="search"
              value={filters.keyword}
              onChange={(event) => {
                const next = { ...filters, keyword: event.target.value };
                setFilters(next);
                updateSearch(next);
              }}
              placeholder="Search by name, email, or phone..."
            />
          </label>
        </div>

        <div className="staff-filters__controls">
          <label className="staff-filter-chip">
              <select value={filters.role_code} onChange={(event) => {
                const next = { ...filters, role_code: event.target.value };
                setFilters(next);
                updateSearch(next);
              }}>
              <option value="">Vai trò</option>
              {roles.map((item) => (
                <option key={item.role_code} value={item.role_code}>
                  {item.role_name}
                </option>
              ))}
            </select>
          </label>

          <label className="staff-filter-chip">
              <select value={filters.department_id} onChange={(event) => {
                const next = { ...filters, department_id: event.target.value };
                setFilters(next);
                updateSearch(next);
              }}>
              <option value="">Khoa/Phòng</option>
              {departments.map((item) => (
                <option key={item.department_id} value={item.department_id}>
                  {item.department_name}
                </option>
              ))}
            </select>
          </label>

          <label className="staff-filter-chip">
              <select value={filters.status} onChange={(event) => {
                const next = { ...filters, status: event.target.value };
                setFilters(next);
                updateSearch(next);
              }}>
              <option value="">Trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="locked">Bị khóa</option>
              <option value="disabled">Không hoạt động</option>
              <option value="suspended">Tạm ngưng</option>
            </select>
          </label>

          <label className="staff-filter-chip">
            <select value={filters.staff_type} onChange={(event) => setFilters((current) => ({ ...current, staff_type: event.target.value }))}>
              <option value="">Loại nhân sự</option>
              <option value="doctor">Bác sĩ</option>
              <option value="nurse">Điều dưỡng</option>
              <option value="receptionist">Lễ tân</option>
              <option value="pharmacist">Dược sĩ</option>
              <option value="manager">Quản lý</option>
            </select>
          </label>

          <button type="button" className="staff-filter-reset" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </section>

      <section className="staff-table-panel staff-table-panel--list">
        {error ? <p className="form-message error">{error}</p> : null}

        {accounts.length === 0 && !loading ? (
          <div className="staff-empty-state">
            <div className="staff-empty-state__art">⌕</div>
          <h3>Không tìm thấy nhân sự phù hợp</h3>
          <p>Thử thay đổi bộ lọc hoặc tạo mới một tài khoản nhân sự cho tổ chức của bạn.</p>
            <div className="admin-page-header__actions">
              <button type="button" className="staff-button staff-button--ghost" onClick={resetFilters}>
                Reset filter
              </button>
              <Link to="/admin/staff/create" className="staff-button staff-button--primary">
                Tạo staff mới
              </Link>
            </div>
          </div>
        ) : (
          <div className="staff-data-table staff-data-table--list">
            <div className="staff-data-table__head staff-data-table__head--list">
              <span className="staff-data-table__checkbox"><input type="checkbox" /></span>
              <span>Thông tin liên hệ</span>
              <span>Khoa/Phòng</span>
              <span>Vai trò</span>
              <span>Trạng thái</span>
              <span>Mức độ hoạt động</span>
              <span>Thao tác</span>
            </div>

            {accounts.map((item) => {
              const departmentName =
                departments.find((department) => department.department_id === item.department_id)?.department_name || 'Chưa gán';

              return (
                <div key={item.user_id} className="staff-data-table__row staff-data-table__row--list">
                  <span className="staff-data-table__checkbox">
                    <input type="checkbox" />
                  </span>

                  <button type="button" className="staff-data-table__identity staff-data-table__identity--list staff-data-table__identity--button" onClick={() => navigate(`/admin/staff/${item.user_id}`)}>
                    <div className="admin-avatar">{getInitials(item.full_name || item.username)}</div>
                    <div>
                      <strong>{item.full_name || item.username}</strong>
                      <small>{item.email || 'Chưa có email'}</small>
                      <small>{item.username}</small>
                    </div>
                  </button>

                  <button type="button" className="staff-department-cell staff-department-cell--button" onClick={() => {
                    const next = { ...filters, department_id: item.department_id || '' };
                    setFilters(next);
                    updateSearch(next);
                  }}>
                    <strong>{departmentName}</strong>
                    <small>{item.employee_code || 'Chưa gán mã/khoa'}</small>
                  </button>

                  <div className="staff-role-badges staff-role-badges--list">
                    {(item.roles || []).slice(0, 2).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          const next = { ...filters, role_code: role };
                          setFilters(next);
                          updateSearch(next);
                        }}
                      >
                        {role.replaceAll('_', ' ')}
                      </button>
                    ))}
                    {(item.roles || []).length > 2 ? <span>+{item.roles.length - 2}</span> : null}
                  </div>

                  <span className={`staff-status-dot staff-status-dot--${getStatusTone(item.status)}`}>
                    <span />
                    {item.status}
                  </span>

                  <div className="staff-engagement-cell">
                    <strong>Added: {formatCompactDate(item.created_at)}</strong>
                    <small>Last login: {formatDateTime(item.last_login_at)}</small>
                  </div>

                  <div className="staff-row-actions staff-row-actions--menu">
                    <button type="button" onClick={() => navigate(`/admin/staff/${item.user_id}`)} title="Xem chi tiết">
                      •••
                    </button>
                    <div className="staff-row-actions__quick">
                      <button type="button" onClick={() => navigate(`/admin/staff/${item.user_id}/edit`, { state: { returnTo: `/admin/staff${window.location.search}` } })}>
                        Sửa
                      </button>
                      <button type="button" onClick={() => openDialog('reset', item)}>
                        Reset
                      </button>
                      {item.status === 'locked' ? (
                        <button type="button" onClick={() => openDialog('unlock', item)}>
                          Unlock
                        </button>
                      ) : item.status === 'active' ? (
                        <button type="button" onClick={() => openDialog('deactivate', item)}>
                          Disable
                        </button>
                      ) : (
                        <button type="button" onClick={() => openDialog('activate', item)}>
                          Activate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <footer className="staff-pagination">
          <span>
            Trang {pagination.page} / {Math.max(pagination.total_pages || 1, 1)}
          </span>
          <div>
            <button type="button" className="staff-button staff-button--ghost" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Trước
            </button>
            <button
              type="button"
              className="staff-button staff-button--ghost"
              disabled={page >= (pagination.total_pages || 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Sau
            </button>
          </div>
        </footer>
      </section>

      {dialog?.type === 'reset' ? (
        <ResetPasswordDialog staff={dialog.staff} onClose={closeDialog} onSubmit={handleResetPassword} isSubmitting={submitting} />
      ) : null}

      {['activate', 'deactivate', 'unlock'].includes(dialog?.type) ? (
        <StaffStatusDialog
          action={dialog.type}
          staff={dialog.staff}
          onClose={closeDialog}
          onConfirm={() => handleStatusAction(dialog.type, dialog.staff)}
          isSubmitting={submitting}
        />
      ) : null}
    </>
  );
}
