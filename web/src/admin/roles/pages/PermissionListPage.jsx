import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getPermissionUsageSummary, listPermissions } from '../roleApi';
import {
  PERMISSION_ACTION_OPTIONS,
  PERMISSION_MODULE_OPTIONS,
  formatNumber,
  getPermissionActionTitle,
  getPermissionBrief,
  getPermissionModuleTitle,
  getPermissionTone,
  getPermissionUsageLevel,
} from '../roleUi';

function filterPermissions(items, filters) {
  return items
    .filter((item) => {
      if (filters.moduleKey && item.module_key !== filters.moduleKey) return false;
      if (filters.actionKey && item.action_key !== filters.actionKey) return false;
      return true;
    })
    .sort((left, right) => {
      if (filters.sortBy === 'name_desc') return right.permission_name.localeCompare(left.permission_name);
      if (filters.sortBy === 'module_asc') return left.module_key.localeCompare(right.module_key);
      if (filters.sortBy === 'usage_desc') return (right.roles_count || 0) - (left.roles_count || 0);
      return left.permission_name.localeCompare(right.permission_name);
    });
}

export function PermissionListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Math.max(Number(searchParams.get('page') || 1), 1);
  const [filters, setFilters] = useState({
    keyword: searchParams.get('keyword') || '',
    moduleKey: searchParams.get('module') || '',
    actionKey: searchParams.get('action') || '',
    sortBy: searchParams.get('sort') || 'name_asc',
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const permissionsData = await listPermissions(
          `limit=200${filters.keyword ? `&search=${encodeURIComponent(filters.keyword)}` : ''}${filters.moduleKey ? `&module_key=${filters.moduleKey}` : ''}`,
        );
        if (!active) return;

        const baseItems = permissionsData?.items || [];
        const usageEntries = await Promise.all(
          baseItems.map(async (item) => {
            try {
              const usage = await getPermissionUsageSummary(item.permission_id);
              return [item.permission_id, usage?.roles_count || 0];
            } catch {
              return [item.permission_id, 0];
            }
          }),
        );
        if (!active) return;

        const usageMap = new Map(usageEntries);
        const enriched = baseItems.map((item) => ({
          ...item,
          roles_count: usageMap.get(item.permission_id) || 0,
        }));
        setItems(filterPermissions(enriched, filters));
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
    const unused = items.filter((item) => item.roles_count === 0).length;
    const modules = new Set(items.map((item) => item.module_key)).size;
    const topUsed = [...items].sort((left, right) => right.roles_count - left.roles_count)[0];

    return [
      { label: 'Tổng số quyền', value: formatNumber(items.length), note: 'Toàn bộ registry', icon: '⌘', tone: 'indigo' },
      { label: 'Module đang có quyền', value: formatNumber(modules), note: 'Phạm vi hệ thống', icon: '▣', tone: 'teal' },
      { label: 'Dùng nhiều nhất', value: topUsed ? formatNumber(topUsed.roles_count) : '0', note: topUsed ? getPermissionBrief(topUsed) : 'Chưa có', icon: '↗', tone: 'amber' },
      { label: 'Chưa được vai trò dùng', value: formatNumber(unused), note: unused > 0 ? 'Cần rà soát' : 'Ổn định', icon: '◌', tone: 'red' },
    ];
  }, [items]);

  const paginatedItems = useMemo(() => {
    const pageSize = 8;
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [currentPage, items]);

  const totalPages = Math.max(Math.ceil(items.length / 8), 1);

  function updateFilters(next) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.keyword) params.set('keyword', next.keyword);
    if (next.moduleKey) params.set('module', next.moduleKey);
    if (next.actionKey) params.set('action', next.actionKey);
    if (next.sortBy) params.set('sort', next.sortBy);
    setSearchParams(params);
  }

  function setPage(nextPage) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(nextPage));
    setSearchParams(params);
  }

  return (
    <section className="role-page permission-page">
      <section className="role-hero permission-list-hero">
        <div className="role-hero__copy">
          <p className="admin-page-header__eyebrow">Admin / Vai trò & quyền / Danh sách quyền hạn</p>
          <h1>Danh sách Quyền hạn</h1>
          <p>Quản lý và cấu hình các quyền truy cập chi tiết cho hệ thống y tế nội bộ.</p>
        </div>

        <div className="role-hero__actions">
          <button type="button" className="staff-button staff-button--ghost role-hero__action">
            <span>⇩</span>
            <span>Xuất báo cáo</span>
          </button>
          <Link to="/admin/permissions/create" className="staff-button staff-button--primary role-hero__action">
            <span>⊕</span>
            <span>Thêm quyền mới</span>
          </Link>
        </div>
      </section>

      <section className="role-stats permission-stats">
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

      <section className="role-filters admin-panel permission-filters-panel">
        <div className="role-filters__bar permission-filters__bar">
          <label className="admin-search role-filters__search">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Tìm theo mã hoặc tên quyền..."
              value={filters.keyword}
              onChange={(event) => updateFilters({ ...filters, keyword: event.target.value })}
            />
          </label>

          <label className="role-filter-chip">
            <select value={filters.moduleKey} onChange={(event) => updateFilters({ ...filters, moduleKey: event.target.value })}>
              <option value="">Module: Tất cả</option>
              {PERMISSION_MODULE_OPTIONS.map((moduleKey) => (
                <option key={moduleKey} value={moduleKey}>
                  {getPermissionModuleTitle(moduleKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="role-filter-chip">
            <select value={filters.actionKey} onChange={(event) => updateFilters({ ...filters, actionKey: event.target.value })}>
              <option value="">Thao tác: Tất cả</option>
              {PERMISSION_ACTION_OPTIONS.map((actionKey) => (
                <option key={actionKey} value={actionKey}>
                  {getPermissionActionTitle(actionKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="role-filter-chip">
            <select value={filters.sortBy} onChange={(event) => updateFilters({ ...filters, sortBy: event.target.value })}>
              <option value="name_asc">Sắp theo tên</option>
              <option value="name_desc">Tên Z-A</option>
              <option value="module_asc">Theo module</option>
              <option value="usage_desc">Dùng nhiều nhất</option>
            </select>
          </label>

          <button type="button" className="permission-filter-button" onClick={() => updateFilters({ ...filters })} aria-label="Làm mới bộ lọc">
            <span>☰</span>
          </button>
        </div>
      </section>

      <section className="admin-panel">
        {loading ? <div className="staff-loading-panel">Đang tải danh sách quyền...</div> : null}
        {!loading && error ? <p className="form-message error">{error}</p> : null}

        {!loading && !error && items.length === 0 ? (
          <div className="staff-empty-state">
            <div className="staff-empty-state__art">⌘</div>
            <strong>Chưa có quyền nào trong hệ thống</strong>
            <p>Tạo quyền đầu tiên để mở rộng hệ thống phân quyền nội bộ cho bệnh viện.</p>
            <Link to="/admin/permissions/create" className="staff-button staff-button--primary">
              Tạo quyền đầu tiên
            </Link>
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="permission-table">
            <div className="permission-table__head">
              <span>Tên quyền</span>
              <span>Mã (code)</span>
              <span>Module</span>
              <span>Thao tác</span>
              <span>Role đang dùng</span>
              <span>Hành động</span>
            </div>

            {paginatedItems.map((item) => {
              const usageLevel = getPermissionUsageLevel(item.roles_count);
              return (
                <div key={item.permission_id} className="permission-table__row">
                  <div className="permission-table__identity">
                    <span className={`permission-table__dot permission-table__dot--${getPermissionTone(item.module_key)}`} />
                    <div>
                      <strong>{getPermissionBrief(item)}</strong>
                      <small>{item.description || item.permission_name || 'Quyền thao tác nghiệp vụ nội bộ của hệ thống.'}</small>
                    </div>
                  </div>

                  <code className="permission-code-badge">{item.permission_code}</code>
                  <span className={`permission-module-chip permission-module-chip--${getPermissionTone(item.module_key)}`}>{getPermissionModuleTitle(item.module_key)}</span>
                  <span className="permission-action-pill">{getPermissionActionTitle(item.action_key)}</span>
                  <div className="permission-usage">
                    <strong>
                      {formatNumber(item.roles_count)}
                  <span>{item.roles_count === 1 ? ' vai trò' : ' vai trò'}</span>
                    </strong>
                    <small className={`permission-usage-pill permission-usage-pill--${usageLevel.tone}`}>{usageLevel.label}</small>
                  </div>
                  <div className="staff-row-actions staff-row-actions--menu">
                    <button type="button">•••</button>
                    <div className="staff-row-actions__quick">
                      <button type="button" onClick={() => navigate(`/admin/permissions/${item.permission_id}`)}>Chi tiết</button>
                      <button type="button" onClick={() => navigate(`/admin/permissions/${item.permission_id}/edit`)}>Chỉnh sửa</button>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(item.permission_code)}>Sao chép code</button>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="role-table__footer">
              <span>
                Hiển thị {items.length === 0 ? 0 : (currentPage - 1) * 8 + 1}-{Math.min(currentPage * 8, items.length)} trong số {items.length} quyền hạn
              </span>
              <div className="role-pagination">
                <button type="button" disabled={currentPage <= 1} onClick={() => setPage(Math.max(currentPage - 1, 1))}>
                  ‹
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
                  ›
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
