import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import {
  getDepartmentDetail,
  getDepartmentSummary,
  listDepartmentStaff,
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

function DepartmentStaffControlPage() {
  const [departments, setDepartments] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [staff, setStaff] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDepartments() {
    setLoading(true);
    setError('');
    try {
      const data = await listDepartments('limit=120');
      const items = data?.items || [];
      setDepartments(items);
      setSelectedDepartmentId((current) => current || items[0]?.department_id || '');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDepartmentContext(departmentId) {
    if (!departmentId) return;
    setError('');
    try {
      const [staffData, summaryData] = await Promise.all([
        listDepartmentStaff(departmentId, `limit=120${statusFilter ? `&status=${statusFilter}` : ''}`),
        getDepartmentSummary(departmentId).catch(() => null),
      ]);
      setStaff(staffData?.items || []);
      setSummary(summaryData);
    } catch (loadError) {
      setError(loadError.message);
      setStaff([]);
      setSummary(null);
    }
  }

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadDepartmentContext(selectedDepartmentId);
  }, [selectedDepartmentId, statusFilter]);

  const selectedDepartment = departments.find((item) => item.department_id === selectedDepartmentId);
  const filteredStaff = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return staff;
    return staff.filter((user) => `${user.full_name} ${user.username} ${user.email} ${user.employee_code}`.toLowerCase().includes(keyword));
  }, [search, staff]);

  const metrics = [
    { label: 'Nhân sự', value: summary?.staff?.total_staff ?? staff.length, icon: UsersRound, tone: 'blue' },
    { label: 'Active', value: summary?.active_staff_count ?? staff.filter((item) => item.status === 'active').length, icon: CheckCircle2, tone: 'green' },
    { label: 'Bác sĩ', value: summary?.doctors_count || 0, icon: Stethoscope, tone: 'violet' },
    { label: 'Lịch hôm nay', value: summary?.schedules_today || 0, icon: CalendarClock, tone: 'amber' },
    { label: 'Hẹn hôm nay', value: summary?.appointments_today || 0, icon: Activity, tone: 'cyan' },
    { label: 'Tương lai', value: (summary?.future_schedules_count || 0) + (summary?.future_appointments_count || 0), icon: AlertTriangle, tone: 'red' },
  ];

  return (
    <section className="dept-staff-pro-page">
      <section className="dept-staff-pro-hero">
        <div className="dept-staff-pro-hero__icon"><Building2 size={25} strokeWidth={2.25} /></div>
        <div>
          <span>Organization Control</span>
          <h1>Nhân sự theo khoa</h1>
          <p>Quan sát cơ cấu nhân sự theo khoa/phòng, trưởng khoa, lịch vận hành, lịch hẹn tương lai và trạng thái tài khoản.</p>
        </div>
        <div className="dept-staff-pro-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={loadDepartments}>
            <RefreshCw size={16} /> Làm mới
          </button>
          <Link to="/admin/staff/create" className="staff-button staff-button--primary">
            <UserCheck size={16} /> Thêm nhân sự
          </Link>
        </div>
      </section>

      {error ? <p className="form-message error">{error}</p> : null}

      <section className="dept-staff-pro-layout">
        <aside className="dept-staff-pro-sidebar">
          <label className="dept-staff-pro-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nhân sự trong khoa..." />
          </label>
          <div className="dept-staff-pro-dept-list">
            {departments.map((department) => (
              <button
                key={department.department_id}
                type="button"
                className={selectedDepartmentId === department.department_id ? 'is-active' : ''}
                onClick={() => setSelectedDepartmentId(department.department_id)}
              >
                <span>{department.department_code || 'KHOA'}</span>
                <div>
                  <strong>{department.department_name}</strong>
                  <small>{getDepartmentTypeLabel(department.department_type)} · {department.status}</small>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="dept-staff-pro-main">
          <section className="dept-staff-pro-summary">
            <div>
              <span>Khoa/phòng đang xem</span>
              <h2>{selectedDepartment?.department_name || 'Chọn khoa/phòng'}</h2>
              <p>{selectedDepartment?.department_code || 'Department scope'} · {getDepartmentTypeLabel(selectedDepartment?.department_type)}</p>
            </div>
            <div className="dept-staff-pro-summary__badges">
              <span>{selectedDepartment?.status || 'unknown'}</span>
              <span>{formatNumber(filteredStaff.length)} hiển thị</span>
            </div>
          </section>

          <section className="dept-staff-pro-metrics">
            {metrics.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className={`dept-staff-pro-metric dept-staff-pro-metric--${item.tone}`}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                  <strong>{formatNumber(item.value)}</strong>
                </article>
              );
            })}
          </section>

          <section className="dept-staff-pro-toolbar">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Mọi trạng thái</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="suspended">Suspended</option>
              <option value="disabled">Disabled</option>
            </select>
            <Link to={`/admin/staff/create?department=${selectedDepartmentId}`} className="staff-button staff-button--ghost">
              Tạo nhân sự trong khoa
            </Link>
          </section>

          <section className="dept-staff-pro-table">
            <div className="dept-staff-pro-table__head">
              <span>Nhân sự</span><span>Liên hệ</span><span>Trạng thái</span><span>Rủi ro</span><span>Actions</span>
            </div>
            {loading ? <div className="staff-loading-panel">Đang tải khoa/phòng...</div> : null}
            {filteredStaff.map((user) => (
              <div key={user.user_id} className="dept-staff-pro-table__row">
                <span>
                  <i>{getInitials(user.full_name || user.username)}</i>
                  <span><strong>{user.full_name || user.username}</strong><small>{user.employee_code || user.username || user.user_id}</small></span>
                </span>
                <span><strong>{user.email || 'Chưa có email'}</strong><small>{user.phone || 'Chưa có SĐT'}</small></span>
                <span className={`dept-staff-pro-status dept-staff-pro-status--${user.status}`}>{user.status}</span>
                <span className="dept-staff-pro-risk"><ShieldAlert size={14} /> {user.status === 'locked' ? 'high' : 'normal'}</span>
                <span>
                  <Link to={`/admin/staff/${user.user_id}`}>Staff 360</Link>
                </span>
              </div>
            ))}
            {!loading && filteredStaff.length === 0 ? (
              <div className="dept-staff-pro-empty">
                <UsersRound size={24} />
                <strong>Không có nhân sự phù hợp trong khoa/phòng này</strong>
              </div>
            ) : null}
          </section>
        </main>
      </section>
    </section>
  );
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
  const [appliedFilters, setAppliedFilters] = useState(filters);
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
        const data = await listDepartments(buildQuery(appliedFilters));
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
          if (appliedFilters.headState === 'with_head' && !item.head) return false;
          if (appliedFilters.headState === 'no_head' && item.head) return false;
          if (appliedFilters.futureState === 'future_only' && item.future_schedules_count + item.future_appointments_count === 0) return false;
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
  }, [appliedFilters]);

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
  }

  function applyFilters(next = filters) {
    setFilters(next);
    setAppliedFilters(next);
    const params = new URLSearchParams();
    if (next.keyword) params.set('keyword', next.keyword);
    if (next.status) params.set('status', next.status);
    if (next.departmentType) params.set('type', next.departmentType);
    if (next.headState) params.set('head', next.headState);
    if (next.futureState) params.set('future', next.futureState);
    setSearchParams(params);
  }

  if (searchParams.get('view') === 'staff') {
    return <DepartmentStaffControlPage />;
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
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyFilters();
              }}
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
            onClick={() => applyFilters({ keyword: '', status: '', departmentType: '', headState: '', futureState: '' })}
          >
            Reset
          </button>
          <button
            type="button"
            className="staff-button staff-button--primary department-directory-reset"
            onClick={() => applyFilters()}
            disabled={loading}
          >
            Áp dụng
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
