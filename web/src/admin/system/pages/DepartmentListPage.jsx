import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getDepartmentDetail,
  getDepartmentSummary,
  listDepartments,
} from '../systemApi';
import {
  formatCompactDate,
  formatNumber,
  getDepartmentTypeLabel,
  getInitials,
} from '../systemUi';

function buildQuery(filters) {
  const params = new URLSearchParams();
  params.set('limit', '80');
  if (filters.keyword) params.set('search', filters.keyword);
  if (filters.status) params.set('status', filters.status);
  if (filters.departmentType) params.set('department_type', filters.departmentType);
  return params.toString();
}

export function DepartmentListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    keyword: searchParams.get('keyword') || '',
    status: searchParams.get('status') || '',
    departmentType: searchParams.get('type') || '',
    headState: searchParams.get('head') || '',
    futureState: searchParams.get('future') || '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await listDepartments(buildQuery(filters));
        const baseItems = data?.items || [];
        const enriched = await Promise.all(
          baseItems.map(async (item) => {
            const [detail, summary] = await Promise.all([
              getDepartmentDetail(item.department_id).catch(() => null),
              getDepartmentSummary(item.department_id).catch(() => null),
            ]);

            return {
              ...item,
              head: detail?.head || null,
              staff_count: detail?.staff_count || summary?.staff?.total_staff || 0,
              active_staff_count: summary?.active_staff_count || 0,
              appointments_today: summary?.appointments_today || 0,
              future_schedules_count: summary?.future_schedules_count || 0,
              future_appointments_count: summary?.future_appointments_count || 0,
              updated_at: detail?.department?.updated_at || item.updated_at,
            };
          }),
        );

        if (!active) return;

        const filtered = enriched.filter((item) => {
          if (filters.headState === 'with_head' && !item.head) return false;
          if (filters.headState === 'no_head' && item.head) return false;
          if (filters.futureState === 'future_only' && item.future_schedules_count + item.future_appointments_count === 0) return false;
          return true;
        });

        setItems(filtered);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [filters]);

  const stats = useMemo(() => {
    const activeDepartments = items.filter((item) => item.status === 'active').length;
    const missingHeads = items.filter((item) => !item.head).length;
    const appointmentsToday = items.reduce((total, item) => total + (item.appointments_today || 0), 0);
    const totalDepartments = items.length;
    const activeRate = totalDepartments ? Math.round((activeDepartments / totalDepartments) * 100) : 0;
    return [
      { label: 'Tổng Khoa/Phòng', value: formatNumber(totalDepartments), icon: '▣', tone: 'indigo', meta: '+2 tháng này' },
      { label: 'Đang hoạt động', value: formatNumber(activeDepartments), icon: '✓', tone: 'green', meta: `${activeRate}% tỷ lệ` },
      { label: 'Thiếu trưởng khoa', value: formatNumber(missingHeads), icon: '◌', tone: 'red', meta: missingHeads ? 'Cần bổ sung' : 'Đã đủ' },
      { label: 'Lịch hẹn hôm nay', value: formatNumber(appointmentsToday), icon: '◫', tone: 'amber', meta: appointmentsToday > 100 ? 'Dự kiến cao' : 'Ổn định' },
    ];
  }, [items]);

  const departmentCards = useMemo(
    () =>
      items.map((item) => {
        const staffCount = Number(item.staff_count || 0);
        const activeStaffCount = Number(item.active_staff_count || 0);
        const futureTotal = Number(item.future_schedules_count || 0) + Number(item.future_appointments_count || 0);
        const headMissing = !item.head;
        const utilization = staffCount > 0 ? Math.round((activeStaffCount / staffCount) * 100) : 0;
        const statusLabel = item.status === 'active' ? 'Hoạt động' : 'Tạm ngưng';
        const statusTone = item.status === 'active' ? 'teal' : 'slate';
        const workloadTone = headMissing ? 'red' : futureTotal > 20 ? 'amber' : 'blue';
        const workloadLabel = headMissing
          ? 'Thiếu NS'
          : futureTotal > 20
            ? 'Dự kiến cao'
            : futureTotal > 0
              ? 'Ổn định'
              : 'Theo dõi';

        return {
          ...item,
          staffCount,
          activeStaffCount,
          futureTotal,
          utilization,
          headMissing,
          statusLabel,
          statusTone,
          workloadTone,
          workloadLabel,
        };
      }),
    [items],
  );

  function updateFilters(next) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.keyword) params.set('keyword', next.keyword);
    if (next.status) params.set('status', next.status);
    if (next.departmentType) params.set('type', next.departmentType);
    if (next.headState) params.set('head', next.headState);
    if (next.futureState) params.set('future', next.futureState);
    setSearchParams(params);
  }

  return (
    <section className="role-page system-admin-page department-directory-page">
      <section className="role-hero department-directory-hero">
        <div className="role-hero__copy">
          <p className="admin-page-header__eyebrow">Admin / Khoa phòng / Danh sách khoa-phòng</p>
          <h1>Danh sách Khoa/Phòng</h1>
          <p>Quản lý toàn bộ cơ cấu tổ chức, khoa phòng và nhân sự trực thuộc.</p>
        </div>
        <div className="role-hero__actions">
          <button type="button" className="staff-button staff-button--ghost department-directory-button">
            <span>⇪</span>
            <span>Xuất báo cáo</span>
          </button>
          <Link to="/admin/departments/create" className="staff-button staff-button--primary department-directory-button">
            <span>⊕</span>
            <span>Thêm khoa mới</span>
          </Link>
        </div>
      </section>

      <section className="role-stats department-directory-stats">
        {stats.map((item) => (
          <article key={item.label} className={`admin-metric-card admin-metric-card--${item.tone} department-directory-stat`}>
            <div className="admin-metric-card__top">
              <span className="admin-metric-card__icon">{item.icon}</span>
              <small>{item.meta}</small>
            </div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-panel system-filter-panel department-directory-filter-panel">
        <div className="system-filter-grid">
          <label className="admin-search role-filters__search">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Tìm theo tên khoa hoặc mã..."
              value={filters.keyword}
              onChange={(event) => updateFilters({ ...filters, keyword: event.target.value })}
            />
          </label>
          <label className="role-filter-chip department-directory-select">
            <select value={filters.departmentType} onChange={(event) => updateFilters({ ...filters, departmentType: event.target.value })}>
              <option value="">Loại khoa</option>
              <option value="clinical">Lâm sàng</option>
              <option value="admin">Quản trị</option>
              <option value="pharmacy">Dược</option>
              <option value="lab">Xét nghiệm</option>
              <option value="imaging">Chẩn đoán hình ảnh</option>
              <option value="non_clinical">Hành chính</option>
            </select>
          </label>
          <label className="role-filter-chip department-directory-select">
            <select value={filters.status} onChange={(event) => updateFilters({ ...filters, status: event.target.value })}>
              <option value="">Trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Tạm ngưng</option>
            </select>
          </label>
          <label className="role-filter-chip department-directory-select">
            <select value={filters.headState} onChange={(event) => updateFilters({ ...filters, headState: event.target.value })}>
              <option value="">Trưởng khoa</option>
              <option value="with_head">Đã bổ nhiệm</option>
              <option value="no_head">Đang thiếu</option>
            </select>
          </label>
          <button
            type="button"
            className="staff-button staff-button--ghost department-directory-reset"
            onClick={() => updateFilters({ keyword: '', status: '', departmentType: '', headState: '', futureState: '' })}
          >
            Reset
          </button>
        </div>
      </section>

      <section className="department-directory-grid">
        {loading ? <div className="staff-loading-panel">Đang tải danh sách khoa phòng...</div> : null}
        {!loading && error ? <p className="form-message error">{error}</p> : null}
        {!loading && !error ? (
          <>
            {departmentCards.map((item) => (
              <article key={item.department_id} className="admin-panel department-card">
                <div className="department-card__badges">
                  <code className="department-card__code">{item.department_code}</code>
                  <span className={`department-card__status department-card__status--${item.statusTone}`}>{item.statusLabel}</span>
                  <span className={`department-card__status department-card__status--${item.workloadTone}`}>{item.workloadLabel}</span>
                </div>

                <div className="department-card__heading">
                  <div>
                    <h3>{item.department_name}</h3>
                    <p>{getDepartmentTypeLabel(item.department_type)}</p>
                  </div>
                  <div className="department-card__mini-metric">
                    <span>{formatNumber(item.utilization)}%</span>
                    <small>Nhân sự active</small>
                  </div>
                </div>

                <div className="department-card__body">
                  <div className="department-card__row">
                    <span>Trưởng khoa:</span>
                    {item.head ? (
                      <div className="department-card__head">
                        <strong>{item.head.full_name || item.head.username}</strong>
                        <span className="admin-avatar department-card__avatar">{getInitials(item.head.full_name || item.head.username)}</span>
                      </div>
                    ) : (
                      <strong className="department-card__vacancy">Đang tìm ứng viên</strong>
                    )}
                  </div>

                  <div className="department-card__row">
                    <span>Nhân sự:</span>
                    <div className="department-card__people">
                      {item.staffCount > 0 ? (
                        <>
                          <span className="department-card__person">{getInitials(item.head?.full_name || item.department_name)}</span>
                          <span className="department-card__person department-card__person--muted">{Math.min(item.activeStaffCount, 99)}</span>
                          <span className="department-card__person department-card__person--count">
                            +{Math.max(item.staffCount - 2, 0)}
                          </span>
                        </>
                      ) : (
                        <span className="department-card__empty-count">0</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="department-card__meta">
                  <div>
                    <strong>{formatNumber(item.staffCount)} chuyên viên</strong>
                    <small>
                      {formatNumber(item.future_schedules_count)} lịch làm việc • {formatNumber(item.future_appointments_count)} lịch hẹn
                    </small>
                  </div>
                  <div className="department-card__actions">
            <button type="button" onClick={() => navigate(`/admin/departments/${item.department_id}`)}>Xem nhanh</button>
                    <button type="button" onClick={() => navigate(`/admin/departments/${item.department_id}/edit`)}>Chỉnh sửa</button>
                  </div>
                </div>

                <div className="department-card__footer">
                  <span>{item.location_note || 'Khu vận hành nội bộ'}</span>
                  <small>Cập nhật {formatCompactDate(item.updated_at)}</small>
                </div>
              </article>
            ))}

            <Link to="/admin/departments/create" className="admin-panel department-card department-card--create">
              <span className="department-card--create__icon">＋</span>
              <strong>Thêm Khoa Mới</strong>
              <p>Cập nhật sơ đồ tổ chức của bạn</p>
              <small>{todayLabel}</small>
            </Link>
          </>
        ) : null}
      </section>
    </section>
  );
}
