import { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DoorOpen,
  Filter,
  HeartPulse,
  MapPin,
  RefreshCw,
  Search,
  Stethoscope,
  Users,
  Wrench,
} from 'lucide-react';

const DEPARTMENTS = [
  { key: 'all', label: 'Tất cả khoa' },
  { key: 'cardiology', label: 'Tim mạch' },
  { key: 'internal', label: 'Nội tổng quát' },
  { key: 'pediatrics', label: 'Nhi khoa' },
  { key: 'obgyn', label: 'Sản phụ khoa' },
  { key: 'ent', label: 'Tai mũi họng' },
  { key: 'dermatology', label: 'Da liễu' },
  { key: 'eye', label: 'Mắt' },
];

const DEPARTMENT_STATS = [
  { key: 'internal', name: 'Nội tổng quát', doctors: 10, active: 5, total: 14, usage: 50 },
  { key: 'pediatrics', name: 'Nhi khoa', doctors: 6, active: 3, total: 8, usage: 50 },
  { key: 'cardiology', name: 'Tim mạch', doctors: 6, active: 3, total: 8, usage: 65 },
  { key: 'obgyn', name: 'Sản phụ khoa', doctors: 7, active: 4, total: 9, usage: 57 },
  { key: 'ent', name: 'Tai mũi họng', doctors: 5, active: 2, total: 6, usage: 33 },
  { key: 'dermatology', name: 'Da liễu', doctors: 3, active: 1, total: 4, usage: 33 },
];

const DOCTORS = [
  { id: 'na', name: 'BS. Nguyễn Văn An', initials: 'NA', department: 'Tim mạch', departmentKey: 'cardiology', room: 'P. Tim mạch 01', shift: 'Sáng', time: '07:00 - 11:30', status: 'active', current: 3, booked: 12, usage: 75, next: '09:15', patient: 'Trần Văn Nam' },
  { id: 'pb', name: 'BS. Phạm Quốc Bảo', initials: 'PB', department: 'Tim mạch', departmentKey: 'cardiology', room: 'P. Tim mạch 02', shift: 'Sáng', time: '07:30 - 11:30', status: 'active', current: 2, booked: 9, usage: 60, next: '09:30', patient: 'Nguyễn Minh Khang' },
  { id: 'td', name: 'BS. Trần Minh Đức', initials: 'TĐ', department: 'Tim mạch', departmentKey: 'cardiology', room: 'P. Tim mạch 01', shift: 'Chiều', time: '13:00 - 17:00', status: 'soon', current: 0, booked: 7, usage: 20, next: '13:00', patient: '--' },
  { id: 'lh', name: 'BS. Lê Thanh Hà', initials: 'LH', department: 'Tim mạch', departmentKey: 'cardiology', room: 'P. Tim mạch 03', shift: 'Chiều', time: '13:00 - 17:00', status: 'done', current: 0, booked: 10, usage: 100, next: '--', patient: '--' },
  { id: 'nh', name: 'BS. Nguyễn Văn Hùng', initials: 'NH', department: 'Nội tổng quát', departmentKey: 'internal', room: 'P. Nội 01', shift: 'Sáng', time: '07:30 - 11:30', status: 'active', current: 4, booked: 14, usage: 72, next: '09:17', patient: 'Trần Văn Nam' },
  { id: 'th', name: 'BS. Trần Thị Hoa', initials: 'TH', department: 'Tim mạch', departmentKey: 'cardiology', room: 'P. Tim 01', shift: 'Sáng', time: '07:45 - 11:00', status: 'active', current: 3, booked: 9, usage: 68, next: '09:00', patient: 'Lê Thị Mai' },
  { id: 'nt', name: 'BS. Nguyễn Thị Mai', initials: 'NM', department: 'Nhi khoa', departmentKey: 'pediatrics', room: 'P. Nhi 02', shift: 'Sáng', time: '07:30 - 11:30', status: 'active', current: 3, booked: 10, usage: 83, next: '09:10', patient: 'Hoàng Văn Tùng' },
  { id: 'lt', name: 'BS. Lê Thị Hạnh', initials: 'LT', department: 'Sản phụ khoa', departmentKey: 'obgyn', room: 'P. Sản 01', shift: 'Chiều', time: '13:00 - 16:30', status: 'soon', current: 0, booked: 8, usage: 50, next: '09:15', patient: '--' },
  { id: 'pm', name: 'BS. Phạm Minh Tuấn', initials: 'PM', department: 'Ngoại tổng quát', departmentKey: 'internal', room: 'P. Ngoại 02', shift: 'Chiều', time: '13:30 - 16:30', status: 'active', current: 2, booked: 6, usage: 55, next: '09:20', patient: 'Phạm Thị Hương' },
  { id: 'hd', name: 'BS. Hoàng Đức Duy', initials: 'HD', department: 'Ngoại tổng quát', departmentKey: 'internal', room: 'P. Ngoại 01', shift: 'Sáng', time: '09:00 - 12:00', status: 'soon', current: 0, booked: 5, usage: 30, next: '09:00', patient: '--' },
  { id: 'vh', name: 'BS. Vũ Hồng Phúc', initials: 'VH', department: 'Tai mũi họng', departmentKey: 'ent', room: 'P. TMH 01', shift: 'Sáng', time: '09:30 - 12:00', status: 'soon', current: 0, booked: 4, usage: 25, next: '09:30', patient: '--' },
  { id: 'pt', name: 'BS. Phạm Thị Lan', initials: 'PT', department: 'Mắt', departmentKey: 'eye', room: 'P. Mắt 01', shift: 'Sáng', time: '09:45 - 12:00', status: 'soon', current: 0, booked: 6, usage: 40, next: '09:45', patient: '--' },
];

const ROOMS = [
  { room: 'Phòng 101', area: 'Khu A', department: 'Nội tổng quát', doctor: 'BS. Nguyễn Văn Hùng', shift: 'Ca sáng', time: '07:30 - 11:30', status: 'active', usage: 75, booked: '9/12' },
  { room: 'Phòng 102', area: 'Khu A', department: 'Nội tổng quát', doctor: 'BS. Trần Văn Dũng', shift: 'Ca chiều', time: '13:30 - 17:00', status: 'active', usage: 66, booked: '8/12' },
  { room: 'Phòng 201', area: 'Khu B', department: 'Tim mạch', doctor: 'BS. Lê Thị Hạnh', shift: 'Ca sáng', time: '07:00 - 11:00', status: 'active', usage: 58, booked: '7/12' },
  { room: 'Phòng 202', area: 'Khu B', department: 'Tim mạch', doctor: 'BS. Phạm Minh Tuấn', shift: 'Ca chiều', time: '13:00 - 16:30', status: 'empty', usage: 0, booked: '0/12' },
  { room: 'Phòng 301', area: 'Khu C', department: 'Nhi khoa', doctor: 'BS. Nguyễn Thị Mai', shift: 'Ca sáng', time: '07:30 - 11:30', status: 'active', usage: 83, booked: '10/12' },
  { room: 'Phòng 302', area: 'Khu C', department: 'Nhi khoa', doctor: 'BS. Hoàng Quốc Bảo', shift: 'Ca chiều', time: '13:00 - 17:00', status: 'soon', usage: 25, booked: '3/12' },
  { room: 'Phòng 401', area: 'Khu D', department: 'Sản phụ khoa', doctor: 'BS. Trần Văn Dung', shift: 'Ca sáng', time: '07:00 - 11:00', status: 'active', usage: 50, booked: '6/12' },
  { room: 'Phòng 402', area: 'Khu D', department: 'Sản phụ khoa', doctor: 'BS. Lê Thị Hạnh', shift: 'Ca chiều', time: '13:30 - 16:30', status: 'empty', usage: 0, booked: '0/12' },
];

const UPCOMING = [
  ['09:30', 'BS. Nguyễn Thị Mai', 'Nhi khoa', 'P. Nhi 02', 'Khám thường'],
  ['09:40', 'BS. Trần Văn Dũng', 'Tim mạch', 'P. Tim mạch 01', 'Khám thường'],
  ['09:45', 'BS. Lê Thị Hạnh', 'Sản phụ khoa', 'P. Sản 01', 'Khám thai'],
  ['09:50', 'BS. Phạm Minh Tuấn', 'Ngoại tổng quát', 'P. Ngoại 02', 'Khám thường'],
  ['09:55', 'BS. Hoàng Quốc Bảo', 'Nội tổng quát', 'P. Nội 03', 'Tái khám'],
];

const TIMELINE_ROWS = [
  { doctor: 'BS. Nguyễn Văn Hùng', department: 'Nội tổng quát', initials: 'NH', blocks: [{ from: 12, span: 28, label: '07:30 - 11:30', tone: 'active' }, { from: 52, span: 30, label: '13:30 - 17:00', tone: 'active' }] },
  { doctor: 'BS. Lê Thị Hạnh', department: 'Sản phụ khoa', initials: 'LT', blocks: [{ from: 7, span: 30, label: '07:00 - 11:00', tone: 'active' }, { from: 52, span: 27, label: '13:00 - 16:30', tone: 'soon' }] },
  { doctor: 'BS. Trần Văn Dũng', department: 'Tim mạch', initials: 'TV', blocks: [{ from: 14, span: 24, label: '08:00 - 11:00', tone: 'active' }, { from: 52, span: 18, label: '13:30 - 15:30', tone: 'soon' }, { from: 75, span: 15, label: '15:30 - 17:00', tone: 'active' }] },
  { doctor: 'BS. Nguyễn Thị Mai', department: 'Nhi khoa', initials: 'NM', blocks: [{ from: 12, span: 28, label: '07:30 - 11:30', tone: 'active' }, { from: 52, span: 18, label: '13:00 - 15:00', tone: 'soon' }, { from: 75, span: 15, label: '15:00 - 17:00', tone: 'active' }] },
  { doctor: 'BS. Phạm Minh Tuấn', department: 'Ngoại tổng quát', initials: 'PM', blocks: [{ from: 18, span: 22, label: '08:30 - 11:30', tone: 'active' }, { from: 52, span: 26, label: '13:30 - 16:30', tone: 'active' }] },
];

const STATUS_META = {
  active: { label: 'Đang khám', tone: 'success' },
  soon: { label: 'Sắp bắt đầu', tone: 'warning' },
  done: { label: 'Đã kết thúc', tone: 'neutral' },
  empty: { label: 'Trống', tone: 'info' },
  off: { label: 'Nghỉ', tone: 'neutral' },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.off;
  return <span className={`reception-status-badge is-${meta.tone}`}>{meta.label}</span>;
}

function Progress({ value, tone = 'blue' }) {
  return (
    <span className="reception-doctor-progress">
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} className={`is-${tone}`} />
    </span>
  );
}

function DoctorAvatar({ initials }) {
  return <span className="reception-doctor-avatar">{initials}</span>;
}

function createDoctorFilters() {
  return {
    query: '',
    date: '2026-05-14',
    scope: 'assigned',
    showFilters: false,
  };
}

function textIncludes(value, keyword) {
  return String(value || '').toLowerCase().includes(keyword);
}

function doctorMatches(item, filters) {
  const keyword = String(filters.query || '').trim().toLowerCase();
  if (!keyword) return true;
  return textIncludes(item.name, keyword)
    || textIncludes(item.department, keyword)
    || textIncludes(item.room, keyword)
    || textIncludes(item.patient, keyword);
}

function roomMatches(item, filters) {
  const keyword = String(filters.query || '').trim().toLowerCase();
  if (!keyword) return true;
  return textIncludes(item.room, keyword)
    || textIncludes(item.department, keyword)
    || textIncludes(item.doctor, keyword)
    || textIncludes(item.area, keyword);
}

function DoctorHero({ title, subtitle, filters, onFiltersChange, onReset }) {
  const update = (field, value) => onFiltersChange?.({ ...filters, [field]: value });

  return (
    <section className="reception-doctor-hero">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="reception-doctor-toolbar">
        <label>
          <Search size={17} />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => update('query', event.target.value)}
            placeholder="Tìm bác sĩ, khoa, phòng..."
          />
        </label>
        <label className="reception-doctor-date-control">
          <CalendarDays size={16} />
          <input type="date" value={filters.date} onChange={(event) => update('date', event.target.value)} />
        </label>
        <select value={filters.scope} onChange={(event) => update('scope', event.target.value)}>
          <option value="assigned">Theo khoa phụ trách</option>
          <option value="all">Toàn hệ thống</option>
          <option value="active">Chỉ ca đang hoạt động</option>
        </select>
        <button type="button" onClick={onReset}><RefreshCw size={16} />Làm mới</button>
        <button type="button" className={filters.showFilters ? 'is-active' : ''} onClick={() => update('showFilters', !filters.showFilters)}>
          <Filter size={16} />Bộ lọc
        </button>
      </div>
    </section>
  );
}

function KpiCard({ icon: Icon, label, value, delta, tone = 'info' }) {
  return (
    <article className={`reception-doctor-kpi is-${tone}`}>
      <span><Icon size={24} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {delta ? <em>{delta}</em> : null}
      </div>
    </article>
  );
}

function SchedulePage() {
  const [filters, setFilters] = useState(createDoctorFilters);
  const [showAllDepartments, setShowAllDepartments] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  const filteredDoctors = useMemo(() => DOCTORS.filter((item) => doctorMatches(item, filters)), [filters]);
  const departmentRows = useMemo(() => {
    const keyword = filters.query.trim().toLowerCase();
    const rows = DEPARTMENT_STATS.filter((item) => !keyword || textIncludes(item.name, keyword));
    return showAllDepartments ? rows : rows.slice(0, 6);
  }, [filters.query, showAllDepartments]);
  const upcomingRows = useMemo(() => {
    const keyword = filters.query.trim().toLowerCase();
    const rows = UPCOMING.filter((row) => !keyword || row.some((cell) => textIncludes(cell, keyword)));
    return showAllUpcoming ? rows : rows.slice(0, 5);
  }, [filters.query, showAllUpcoming]);
  const timelineRows = useMemo(() => (
    TIMELINE_ROWS.filter((row) => !filters.query.trim()
      || textIncludes(row.doctor, filters.query.trim().toLowerCase())
      || textIncludes(row.department, filters.query.trim().toLowerCase()))
  ), [filters.query]);
  const visibleDoctorCount = filteredDoctors.length || DOCTORS.length;
  const activeCount = filteredDoctors.filter((item) => item.status === 'active').length;
  const soonCount = filteredDoctors.filter((item) => item.status === 'soon').length;
  const doneCount = filteredDoctors.filter((item) => item.status === 'done').length;

  return (
    <>
      <DoctorHero
        title="Lịch bác sĩ hôm nay"
        subtitle="Tổng quan lịch làm việc và tình trạng sử dụng trong ngày"
        filters={filters}
        onFiltersChange={setFilters}
        onReset={() => {
          setFilters(createDoctorFilters());
          setShowAllDepartments(false);
          setShowAllUpcoming(false);
        }}
      />
      {filters.showFilters ? (
        <section className="reception-doctor-filter-strip">
          <span>Đang xem ngày {filters.date}</span>
          <span>{filters.scope === 'assigned' ? 'Theo khoa phụ trách' : filters.scope === 'active' ? 'Chỉ ca đang hoạt động' : 'Toàn hệ thống'}</span>
          <button type="button" onClick={() => setFilters((current) => ({ ...current, query: '' }))}>Xóa từ khóa</button>
        </section>
      ) : null}
      <section className="reception-doctor-kpi-grid">
        <KpiCard icon={Users} label="Tổng bác sĩ trực" value={visibleDoctorCount} delta="+5 so với hôm qua" />
        <KpiCard icon={CalendarDays} label="Tổng ca làm việc" value={visibleDoctorCount + soonCount + doneCount} delta="+6 so với hôm qua" tone="success" />
        <KpiCard icon={Stethoscope} label="Đang khám" value={activeCount} delta="+3 so với hôm qua" tone="success" />
        <KpiCard icon={Clock3} label="Sắp bắt đầu" value={soonCount} delta="-1 so với hôm qua" tone="warning" />
        <KpiCard icon={CheckCircle2} label="Đã kết thúc" value={doneCount} delta="+4 so với hôm qua" tone="violet" />
      </section>

      <div className="reception-doctor-dashboard-grid">
        <section className="reception-panel">
          <div className="reception-panel__header">
            <div><h2>Tình trạng theo chuyên khoa</h2></div>
          </div>
          <table className="reception-doctor-table">
            <thead><tr><th>Khoa</th><th>Bác sĩ trực</th><th>Đang khám</th><th>Tỷ lệ sử dụng</th><th>Ca trong ngày</th></tr></thead>
            <tbody>
              {departmentRows.map((item) => (
                <tr key={item.key}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.doctors}</td>
                  <td>{item.active}</td>
                  <td><div className="reception-doctor-usage"><Progress value={item.usage} tone={item.usage > 55 ? 'orange' : 'blue'} /><span>{item.usage}%</span></div></td>
                  <td>{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="reception-doctor-link" onClick={() => setShowAllDepartments((current) => !current)}>
            {showAllDepartments ? 'Thu gọn' : 'Xem tất cả'} <ChevronRight size={16} />
          </button>
        </section>

        <section className="reception-panel">
          <div className="reception-panel__header">
            <div><h2>Lịch sắp bắt đầu <small>(trong 30 phút tới)</small></h2></div>
            <button type="button" className="reception-doctor-link" onClick={() => setShowAllUpcoming((current) => !current)}>
              {showAllUpcoming ? 'Thu gọn' : 'Xem tất cả'} <ChevronRight size={16} />
            </button>
          </div>
          <table className="reception-doctor-table">
            <thead><tr><th>Giờ</th><th>Bác sĩ</th><th>Khoa</th><th>Phòng</th><th>Loại lịch</th></tr></thead>
            <tbody>
              {upcomingRows.map((row) => (
                <tr key={`${row[0]}-${row[1]}`}>
                  <td><span className="reception-doctor-time">{row[0]}</span></td>
                  {row.slice(1).map((cell) => <td key={cell}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="reception-panel">
        <div className="reception-panel__header">
          <div><h2>Lịch bác sĩ theo giờ</h2></div>
          <div className="reception-doctor-legend">
            <span className="is-active">Đang khám</span>
            <span className="is-soon">Sắp bắt đầu</span>
            <span className="is-done">Đã kết thúc</span>
          </div>
        </div>
        <div className="reception-doctor-timeline">
          <div className="reception-doctor-timeline__head">
            {['Bác sĩ', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((item) => <span key={item}>{item}</span>)}
          </div>
          {timelineRows.map((row) => (
            <div key={row.doctor} className="reception-doctor-timeline__row">
              <div className="reception-doctor-timeline__doctor"><DoctorAvatar initials={row.initials} /><strong>{row.doctor}</strong><small>{row.department}</small></div>
              <div className="reception-doctor-timeline__track">
                {row.blocks.map((block) => (
                  <span key={block.label} className={`is-${block.tone}`} style={{ left: `${block.from}%`, width: `${block.span}%` }}>{block.label}</span>
                ))}
                <i className="reception-doctor-now" data-label="09:17" style={{ left: '32%' }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function DepartmentsPage() {
  const [selected, setSelected] = useState('cardiology');
  const [filters, setFilters] = useState(createDoctorFilters);
  const visibleDoctors = useMemo(() => (
    DOCTORS.filter((item) => (selected === 'all' || item.departmentKey === selected) && doctorMatches(item, filters))
  ), [filters, selected]);
  const currentDepartment = DEPARTMENTS.find((item) => item.key === selected) || DEPARTMENTS[0];
  const averageUsage = visibleDoctors.length
    ? Math.round(visibleDoctors.reduce((sum, item) => sum + item.usage, 0) / visibleDoctors.length)
    : 0;

  return (
    <>
      <DoctorHero
        title="Theo khoa"
        subtitle="Xem lịch làm việc theo từng chuyên khoa"
        filters={filters}
        onFiltersChange={setFilters}
        onReset={() => {
          setFilters(createDoctorFilters());
          setSelected('cardiology');
        }}
      />
      <div className="reception-doctor-tabs">
        {DEPARTMENTS.map((item) => (
          <button key={item.key} type="button" className={selected === item.key ? 'is-active' : ''} onClick={() => setSelected(item.key)}>
            {item.key === 'cardiology' ? <HeartPulse size={16} /> : null}{item.label}
          </button>
        ))}
      </div>
      <section className="reception-panel">
        <div className="reception-doctor-section-title">
          <span><HeartPulse size={28} /></span>
          <h2>{currentDepartment.label}</h2>
          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setFilters((current) => ({ ...current, showFilters: !current.showFilters }))}>
            <CalendarDays size={16} />Xem lịch theo ngày
          </button>
        </div>
        {filters.showFilters ? (
          <section className="reception-doctor-filter-strip">
            <span>Ngày đang chọn: {filters.date}</span>
            <button type="button" onClick={() => setSelected('all')}>Xem tất cả khoa</button>
            <button type="button" onClick={() => setFilters((current) => ({ ...current, query: '' }))}>Xóa từ khóa</button>
          </section>
        ) : null}
        <div className="reception-doctor-summary-strip">
          <KpiCard icon={Users} label="Bác sĩ trực" value={visibleDoctors.length} />
          <KpiCard icon={Stethoscope} label="Đang khám" value={visibleDoctors.filter((item) => item.status === 'active').length} tone="success" />
          <KpiCard icon={Clock3} label="Sắp bắt đầu" value={visibleDoctors.filter((item) => item.status === 'soon').length} tone="warning" />
          <KpiCard icon={CalendarDays} label="Ca trong ngày" value={visibleDoctors.length} />
          <KpiCard icon={CheckCircle2} label="Tỷ lệ sử dụng" value={`${averageUsage}%`} tone="violet" />
        </div>
        <DoctorsTable doctors={visibleDoctors} emptyText="Không có bác sĩ phù hợp với bộ lọc hiện tại." />
      </section>
    </>
  );
}

function RoomsPage() {
  const [filters, setFilters] = useState(createDoctorFilters);
  const [area, setArea] = useState('');
  const [status, setStatus] = useState('active');
  const rows = useMemo(() => (
    ROOMS.filter((item) => {
      const matchesKeyword = roomMatches(item, filters);
      const matchesArea = !area || item.area === area;
      const matchesStatus = !status || item.status === status;
      return matchesKeyword && matchesArea && matchesStatus;
    })
  ), [area, filters, status]);
  const totalRooms = rows.length;
  const activeRooms = rows.filter((item) => item.status === 'active').length;
  const emptyRooms = rows.filter((item) => item.status === 'empty').length;
  const soonRooms = rows.filter((item) => item.status === 'soon').length;
  const averageUsage = rows.length ? Math.round(rows.reduce((sum, item) => sum + item.usage, 0) / rows.length) : 0;

  return (
    <>
      <DoctorHero
        title="Theo phòng"
        subtitle="Xem lịch làm việc theo phòng khám"
        filters={filters}
        onFiltersChange={setFilters}
        onReset={() => {
          setFilters(createDoctorFilters());
          setArea('');
          setStatus('active');
        }}
      />
      <section className="reception-doctor-kpi-grid">
        <KpiCard icon={DoorOpen} label="Tổng phòng" value={totalRooms} />
        <KpiCard icon={Users} label="Đang sử dụng" value={activeRooms} delta="+2 so với hôm qua" tone="success" />
        <KpiCard icon={Stethoscope} label="Trống" value={emptyRooms} delta="-1 so với hôm qua" />
        <KpiCard icon={Wrench} label="Bảo trì / Nghỉ" value={soonRooms} delta="+1 so với hôm qua" tone="warning" />
        <KpiCard icon={CheckCircle2} label="Tỷ lệ sử dụng" value={`${averageUsage}%`} tone="violet" />
      </section>
      <section className="reception-doctor-filters">
        <select value={area} onChange={(event) => setArea(event.target.value)}>
          <option value="">Tất cả khu vực</option>
          <option>Khu A</option>
          <option>Khu B</option>
          <option>Khu C</option>
          <option>Khu D</option>
        </select>
        <div>
          {[
            { key: '', label: 'Tất cả trạng thái' },
            { key: 'active', label: 'Đang sử dụng' },
            { key: 'empty', label: 'Trống' },
            { key: 'soon', label: 'Sắp bắt đầu' },
            { key: 'off', label: 'Nghỉ' },
          ].map((item) => (
            <button key={item.key || 'all'} type="button" className={status === item.key ? 'is-active' : ''} onClick={() => setStatus(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <section className="reception-panel">
        <table className="reception-doctor-table reception-doctor-table--rooms">
          <thead><tr><th>Phòng</th><th>Khoa</th><th>Bác sĩ</th><th>Ca làm việc</th><th>Thời gian</th><th>Trạng thái</th><th>Tỉ lệ SD</th><th>Đặt trước</th></tr></thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.room}>
                <td><span className="reception-doctor-room"><DoorOpen size={16} />{item.room}</span></td>
                <td>{item.department}</td>
                <td>{item.doctor}</td>
                <td>{item.shift}</td>
                <td>{item.time}</td>
                <td><StatusBadge status={item.status} /></td>
                <td><div className="reception-doctor-usage"><span>{item.usage}%</span><Progress value={item.usage} /></div></td>
                <td>{item.booked}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr><td colSpan="8" className="reception-doctor-empty">Không có phòng phù hợp với bộ lọc hiện tại.</td></tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}

function DoctorsTable({ doctors, emptyText = 'Không có dữ liệu phù hợp.' }) {
  return (
    <table className="reception-doctor-table">
      <thead><tr><th>Bác sĩ</th><th>Phòng</th><th>Ca làm việc</th><th>Thời gian</th><th>Trạng thái</th><th>Đang khám</th><th>Đã đặt</th><th>Tỷ lệ SD</th></tr></thead>
      <tbody>
        {doctors.map((doctor) => (
          <tr key={doctor.id}>
            <td><div className="reception-doctor-name"><DoctorAvatar initials={doctor.initials} /><div><strong>{doctor.name}</strong><span>Chuyên khoa {doctor.department}</span></div></div></td>
            <td>{doctor.room}</td>
            <td>{doctor.shift}</td>
            <td>{doctor.time}</td>
            <td><StatusBadge status={doctor.status} /></td>
            <td>{doctor.current}</td>
            <td>{doctor.booked}</td>
            <td><div className="reception-doctor-usage"><span>{doctor.usage}%</span><Progress value={doctor.usage} /></div></td>
          </tr>
        ))}
        {!doctors.length ? (
          <tr><td colSpan="8" className="reception-doctor-empty">{emptyText}</td></tr>
        ) : null}
      </tbody>
    </table>
  );
}

function ActiveDoctorsPage() {
  const [filters, setFilters] = useState(createDoctorFilters);
  const [showAllActive, setShowAllActive] = useState(false);
  const [showAllSoon, setShowAllSoon] = useState(false);
  const filteredDoctors = useMemo(() => DOCTORS.filter((item) => doctorMatches(item, filters)), [filters]);
  const activeRows = filteredDoctors.filter((item) => item.status === 'active');
  const soonRows = filteredDoctors.filter((item) => item.status === 'soon');
  const active = showAllActive ? activeRows : activeRows.slice(0, 5);
  const soon = showAllSoon ? soonRows : soonRows.slice(0, 5);
  const doneCount = filteredDoctors.filter((item) => item.status === 'done').length;

  return (
    <>
      <DoctorHero
        title="Bác sĩ đang trực"
        subtitle="Danh sách bác sĩ đang trực và tình trạng khám"
        filters={filters}
        onFiltersChange={setFilters}
        onReset={() => {
          setFilters(createDoctorFilters());
          setShowAllActive(false);
          setShowAllSoon(false);
        }}
      />
      {filters.showFilters ? (
        <section className="reception-doctor-filter-strip">
          <span>{activeRows.length} đang khám</span>
          <span>{soonRows.length} sắp bắt đầu</span>
          <button type="button" onClick={() => setFilters((current) => ({ ...current, query: '' }))}>Xóa từ khóa</button>
        </section>
      ) : null}
      <div className="reception-doctor-active-grid">
        <section className="reception-panel">
          <div className="reception-panel__header"><div><h2><span className="reception-dot is-success" />Đang khám ({activeRows.length})</h2></div></div>
          <ActiveTable doctors={active} showPatient />
          <button type="button" className="reception-doctor-link" onClick={() => setShowAllActive((current) => !current)}>
            {showAllActive ? 'Thu gọn' : 'Xem tất cả'} <ChevronRight size={16} />
          </button>
        </section>
        <section className="reception-panel">
          <div className="reception-panel__header"><div><h2><span className="reception-dot is-warning" />Sắp bắt đầu ({soonRows.length})</h2></div></div>
          <ActiveTable doctors={soon} />
          <button type="button" className="reception-doctor-link" onClick={() => setShowAllSoon((current) => !current)}>
            {showAllSoon ? 'Thu gọn' : 'Xem tất cả'} <ChevronRight size={16} />
          </button>
        </section>
      </div>
      <div className="reception-doctor-active-grid reception-doctor-active-grid--bottom">
        <section className="reception-panel reception-doctor-donut-panel">
          <h2>Thống kê đang trực</h2>
          <div className="reception-doctor-donut"><span>Tổng<strong>{filteredDoctors.length}</strong></span></div>
          <div className="reception-doctor-donut-list">
            <p><span className="is-success" />Đang khám <strong>{activeRows.length}</strong><em>{filteredDoctors.length ? Math.round((activeRows.length / filteredDoctors.length) * 100) : 0}%</em></p>
            <p><span className="is-warning" />Sắp bắt đầu <strong>{soonRows.length}</strong><em>{filteredDoctors.length ? Math.round((soonRows.length / filteredDoctors.length) * 100) : 0}%</em></p>
            <p><span />Nghỉ <strong>0</strong><em>0%</em></p>
            <p><span />Đã kết thúc <strong>{doneCount}</strong><em>{filteredDoctors.length ? Math.round((doneCount / filteredDoctors.length) * 100) : 0}%</em></p>
          </div>
        </section>
        <section className="reception-panel">
          <div className="reception-panel__header"><div><h2>Hoạt động gần đây</h2></div></div>
          <div className="reception-doctor-feed">
            {[
              ['08:45', 'BS. Nguyễn Văn An đã bắt đầu khám bệnh nhân mới', 'Bệnh nhân: Trần Văn Nam - Khoa Nội tổng quát - P. Nội 01'],
              ['08:30', 'BS. Trần Thị Hoa kết thúc ca khám', 'Ca khám sáng - Khoa Tim mạch - P. Tim 01'],
              ['08:15', 'BS. Phạm Quốc Bảo bắt đầu khám bệnh nhân mới', 'Bệnh nhân: Nguyễn Minh Khang - Khoa Nhi - P. Nhi 02'],
              ['08:00', 'BS. Lê Minh Cường đã bắt đầu ca làm việc', 'Khoa Sản phụ khoa - P. Sản 01'],
            ].map((item) => (
              <div key={item[0]} className="reception-doctor-feed__item">
                <span>{item[0]}</span>
                <div><strong>{item[1]}</strong><p>{item[2]}</p></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function ActiveTable({ doctors, showPatient = false }) {
  return (
    <table className="reception-doctor-table reception-doctor-table--active">
      <thead><tr><th>Bác sĩ</th><th>Khoa</th><th>Phòng</th><th>Bắt đầu</th>{showPatient ? <th>Bệnh nhân hiện tại</th> : null}<th>{showPatient ? 'Tiếp theo' : 'Bắt đầu'}</th></tr></thead>
      <tbody>
        {doctors.map((doctor) => (
          <tr key={doctor.id}>
            <td><div className="reception-doctor-name"><DoctorAvatar initials={doctor.initials} /><div><strong>{doctor.name}</strong><span>{doctor.department}</span></div></div></td>
            <td>{doctor.department}</td>
            <td>{doctor.room}</td>
            <td>{doctor.time.split(' - ')[0]}</td>
            {showPatient ? <td>{doctor.patient}<br /><small>BN250514-0012</small></td> : null}
            <td><span className="reception-doctor-time">{showPatient ? doctor.next : doctor.time.split(' - ')[0]}</span></td>
          </tr>
        ))}
        {!doctors.length ? (
          <tr><td colSpan={showPatient ? 6 : 5} className="reception-doctor-empty">Không có bác sĩ phù hợp với bộ lọc hiện tại.</td></tr>
        ) : null}
      </tbody>
    </table>
  );
}

export function ReceptionDoctorsPanel({ mode = 'doctors-schedule' }) {
  return (
    <div className="reception-doctor-page">
      {mode === 'doctors-departments' ? <DepartmentsPage /> : null}
      {mode === 'doctors-rooms' ? <RoomsPage /> : null}
      {mode === 'doctors-active' ? <ActiveDoctorsPage /> : null}
      {mode === 'doctors-schedule' ? <SchedulePage /> : null}
    </div>
  );
}
