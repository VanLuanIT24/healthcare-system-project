import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DoorOpen,
  Filter,
  HeartPulse,
  RefreshCw,
  Search,
  Stethoscope,
  Users,
  Wrench,
} from 'lucide-react';
import { receptionDataApi } from '../api/receptionDataApi';

const STATUS_META = {
  active: { label: 'Dang kham', tone: 'success' },
  soon: { label: 'Sap bat dau', tone: 'warning' },
  done: { label: 'Da ket thuc', tone: 'neutral' },
  empty: { label: 'Trong', tone: 'info' },
  off: { label: 'Nghi', tone: 'neutral' },
};

function todayInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateBounds(date) {
  return { date_from: date, date_to: date };
}

function timeText(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 5);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function initials(name) {
  return String(name || 'BS')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'BS';
}

function doctorName(name) {
  if (!name) return 'BS. Chua gan';
  return /^BS\./i.test(name) ? name : `BS. ${name}`;
}

function shiftName(start) {
  const hour = Number(timeText(start).slice(0, 2));
  if (Number.isNaN(hour)) return 'Ca lam viec';
  if (hour < 12) return 'Ca sang';
  if (hour < 17) return 'Ca chieu';
  return 'Ca toi';
}

function normalizeStatus(status, start, end) {
  const value = String(status || '').toLowerCase();
  if (['completed', 'finished', 'done'].includes(value)) return 'done';
  if (['cancelled', 'canceled', 'off', 'inactive'].includes(value)) return 'off';
  const now = Date.now();
  const startMs = start ? new Date(start).getTime() : 0;
  const endMs = end ? new Date(end).getTime() : 0;
  if (startMs && now < startMs) return 'soon';
  if (endMs && now > endMs) return 'done';
  if (['active', 'published', 'in_progress'].includes(value) || startMs) return 'active';
  return 'soon';
}

function normalizeSchedule(item) {
  const slots = item.slots_summary || {};
  const totalSlots = Number(slots.total_slots ?? item.max_patients ?? 0);
  const bookedSlots = Number(slots.booked_slots ?? item.booked_slots ?? 0);
  const usage = Math.round(Number(item.utilization_rate ?? slots.utilization_rate ?? (totalSlots ? (bookedSlots / totalSlots) * 100 : 0)));
  const room = item.room_name || item.room || item.clinic_room || 'Chua gan phong';

  return {
    id: item.doctor_schedule_id || item._id || `${item.doctor_id || item.doctor_name}-${item.shift_start}`,
    doctorId: item.doctor_id || '',
    name: doctorName(item.doctor_name),
    initials: initials(item.doctor_name),
    department: item.department_name || 'Chua gan khoa',
    departmentKey: item.department_id || item.department_code || item.department_name || 'unknown',
    room,
    area: item.area || item.location || 'Khu chua gan',
    shift: item.shift_name || shiftName(item.shift_start),
    start: item.shift_start,
    end: item.shift_end,
    time: `${timeText(item.shift_start)} - ${timeText(item.shift_end)}`,
    status: normalizeStatus(item.status, item.shift_start, item.shift_end),
    current: bookedSlots,
    booked: totalSlots,
    usage,
    next: timeText(item.shift_start),
    patient: item.current_patient_name || '--',
    scheduleType: item.schedule_type || 'Kham thuong',
  };
}

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

function DoctorAvatar({ initials: value }) {
  return <span className="reception-doctor-avatar">{value}</span>;
}

function createDoctorFilters() {
  return { query: '', date: todayInput(), scope: 'assigned', showFilters: false };
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
    || textIncludes(item.name, keyword)
    || textIncludes(item.area, keyword);
}

function useDoctorSchedules(filters) {
  const [state, setState] = useState({ rows: [], loading: false, error: '' });

  useEffect(() => {
    let ignore = false;
    async function load() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const response = await receptionDataApi.listSchedules({
          ...dateBounds(filters.date || todayInput()),
          limit: 200,
        });
        const rows = (response?.items || []).map(normalizeSchedule);
        if (!ignore) setState({ rows, loading: false, error: '' });
      } catch (error) {
        if (!ignore) setState({ rows: [], loading: false, error: error.message || 'Khong tai duoc lich bac si.' });
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [filters.date]);

  return state;
}

function buildDepartmentRows(rows) {
  const map = new Map();
  rows.forEach((item) => {
    const key = item.departmentKey;
    const row = map.get(key) || {
      key,
      name: item.department,
      doctorSet: new Set(),
      doctors: 0,
      active: 0,
      total: 0,
      usageTotal: 0,
      usage: 0,
    };
    row.doctorSet.add(item.doctorId || item.name);
    row.active += item.status === 'active' ? 1 : 0;
    row.total += 1;
    row.usageTotal += item.usage;
    row.doctors = row.doctorSet.size;
    row.usage = row.total ? Math.round(row.usageTotal / row.total) : 0;
    map.set(key, row);
  });
  return [...map.values()];
}

function buildRoomRows(rows) {
  return rows.map((item) => ({
    room: item.room,
    area: item.area,
    department: item.department,
    doctor: item.name,
    shift: item.shift,
    time: item.time,
    status: item.status === 'off' ? 'empty' : item.status,
    usage: item.usage,
    booked: `${item.current}/${item.booked || 0}`,
  }));
}

function buildTimelineRows(rows) {
  return rows.slice(0, 12).map((item) => {
    const startHour = Number(timeText(item.start).slice(0, 2));
    const endHour = Number(timeText(item.end).slice(0, 2));
    const startMinute = Number(timeText(item.start).slice(3, 5));
    const endMinute = Number(timeText(item.end).slice(3, 5));
    const start = Number.isNaN(startHour) ? 7 : startHour + (startMinute || 0) / 60;
    const end = Number.isNaN(endHour) ? start + 4 : endHour + (endMinute || 0) / 60;
    const from = Math.max(0, ((start - 7) / 10) * 100);
    const span = Math.max(8, ((end - start) / 10) * 100);
    return {
      doctor: item.name,
      department: item.department,
      initials: item.initials,
      blocks: [{ from, span, label: item.time, tone: item.status }],
    };
  });
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
            placeholder="Tim bac si, khoa, phong..."
          />
        </label>
        <label className="reception-doctor-date-control">
          <CalendarDays size={16} />
          <input type="date" value={filters.date} onChange={(event) => update('date', event.target.value)} />
        </label>
        <select value={filters.scope} onChange={(event) => update('scope', event.target.value)}>
          <option value="assigned">Theo khoa phu trach</option>
          <option value="all">Toan he thong</option>
          <option value="active">Chi ca dang hoat dong</option>
        </select>
        <button type="button" onClick={onReset}><RefreshCw size={16} />Lam moi</button>
        <button type="button" className={filters.showFilters ? 'is-active' : ''} onClick={() => update('showFilters', !filters.showFilters)}>
          <Filter size={16} />Bo loc
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

function LoadNotice({ loading, error }) {
  if (loading) return <section className="reception-inline-alert">Dang tai du lieu tu API...</section>;
  if (error) return <section className="reception-inline-alert is-danger">{error}</section>;
  return null;
}

function SchedulePage() {
  const [filters, setFilters] = useState(createDoctorFilters);
  const [showAllDepartments, setShowAllDepartments] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const { rows, loading, error } = useDoctorSchedules(filters);
  const filteredDoctors = useMemo(() => rows.filter((item) => doctorMatches(item, filters)), [rows, filters]);
  const allDepartmentRows = useMemo(() => buildDepartmentRows(filteredDoctors), [filteredDoctors]);
  const departmentRows = showAllDepartments ? allDepartmentRows : allDepartmentRows.slice(0, 6);
  const allUpcomingRows = filteredDoctors
    .filter((item) => item.status === 'soon')
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const upcomingRows = showAllUpcoming ? allUpcomingRows : allUpcomingRows.slice(0, 5);
  const timelineRows = useMemo(() => buildTimelineRows(filteredDoctors), [filteredDoctors]);
  const activeCount = filteredDoctors.filter((item) => item.status === 'active').length;
  const soonCount = filteredDoctors.filter((item) => item.status === 'soon').length;
  const doneCount = filteredDoctors.filter((item) => item.status === 'done').length;

  return (
    <>
      <DoctorHero
        title="Lich bac si hom nay"
        subtitle="Tong quan lich lam viec va tinh trang su dung trong ngay"
        filters={filters}
        onFiltersChange={setFilters}
        onReset={() => {
          setFilters(createDoctorFilters());
          setShowAllDepartments(false);
          setShowAllUpcoming(false);
        }}
      />
      <LoadNotice loading={loading} error={error} />
      {filters.showFilters ? (
        <section className="reception-doctor-filter-strip">
          <span>Dang xem ngay {filters.date}</span>
          <span>{filters.scope === 'assigned' ? 'Theo khoa phu trach' : filters.scope === 'active' ? 'Chi ca dang hoat dong' : 'Toan he thong'}</span>
          <button type="button" onClick={() => setFilters((current) => ({ ...current, query: '' }))}>Xoa tu khoa</button>
        </section>
      ) : null}
      <section className="reception-doctor-kpi-grid">
        <KpiCard icon={Users} label="Tong bac si truc" value={filteredDoctors.length} />
        <KpiCard icon={CalendarDays} label="Tong ca lam viec" value={filteredDoctors.length} tone="success" />
        <KpiCard icon={Stethoscope} label="Dang kham" value={activeCount} tone="success" />
        <KpiCard icon={Clock3} label="Sap bat dau" value={soonCount} tone="warning" />
        <KpiCard icon={CheckCircle2} label="Da ket thuc" value={doneCount} tone="violet" />
      </section>
      <div className="reception-doctor-dashboard-grid">
        <section className="reception-panel">
          <div className="reception-panel__header"><div><h2>Tinh trang theo chuyen khoa</h2></div></div>
          <table className="reception-doctor-table">
            <thead><tr><th>Khoa</th><th>Bac si truc</th><th>Dang kham</th><th>Ty le su dung</th><th>Ca trong ngay</th></tr></thead>
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
              {!departmentRows.length ? <tr><td colSpan="5" className="reception-doctor-empty">Khong co du lieu.</td></tr> : null}
            </tbody>
          </table>
          <button type="button" className="reception-doctor-link" onClick={() => setShowAllDepartments((current) => !current)}>
            {showAllDepartments ? 'Thu gon' : 'Xem tat ca'} <ChevronRight size={16} />
          </button>
        </section>
        <section className="reception-panel">
          <div className="reception-panel__header">
            <div><h2>Lich sap bat dau <small>(trong ngay)</small></h2></div>
            <button type="button" className="reception-doctor-link" onClick={() => setShowAllUpcoming((current) => !current)}>
              {showAllUpcoming ? 'Thu gon' : 'Xem tat ca'} <ChevronRight size={16} />
            </button>
          </div>
          <table className="reception-doctor-table">
            <thead><tr><th>Gio</th><th>Bac si</th><th>Khoa</th><th>Phong</th><th>Loai lich</th></tr></thead>
            <tbody>
              {upcomingRows.map((item) => (
                <tr key={item.id}>
                  <td><span className="reception-doctor-time">{item.next}</span></td>
                  <td>{item.name}</td>
                  <td>{item.department}</td>
                  <td>{item.room}</td>
                  <td>{item.scheduleType}</td>
                </tr>
              ))}
              {!upcomingRows.length ? <tr><td colSpan="5" className="reception-doctor-empty">Khong co lich sap bat dau.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
      <section className="reception-panel">
        <div className="reception-panel__header">
          <div><h2>Lich bac si theo gio</h2></div>
          <div className="reception-doctor-legend"><span className="is-active">Dang kham</span><span className="is-soon">Sap bat dau</span><span className="is-done">Da ket thuc</span></div>
        </div>
        <div className="reception-doctor-timeline">
          <div className="reception-doctor-timeline__head">
            {['Bac si', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((item) => <span key={item}>{item}</span>)}
          </div>
          {timelineRows.map((row) => (
            <div key={row.doctor} className="reception-doctor-timeline__row">
              <div className="reception-doctor-timeline__doctor"><DoctorAvatar initials={row.initials} /><strong>{row.doctor}</strong><small>{row.department}</small></div>
              <div className="reception-doctor-timeline__track">
                {row.blocks.map((block) => <span key={block.label} className={`is-${block.tone}`} style={{ left: `${block.from}%`, width: `${block.span}%` }}>{block.label}</span>)}
              </div>
            </div>
          ))}
          {!timelineRows.length ? <div className="reception-doctor-empty">Khong co lich trong ngay.</div> : null}
        </div>
      </section>
    </>
  );
}

function DepartmentsPage() {
  const [filters, setFilters] = useState(createDoctorFilters);
  const { rows, loading, error } = useDoctorSchedules(filters);
  const departments = useMemo(() => [{ key: 'all', label: 'Tat ca khoa' }, ...buildDepartmentRows(rows).map((item) => ({ key: item.key, label: item.name }))], [rows]);
  const [selected, setSelected] = useState('all');
  const visibleDoctors = useMemo(() => rows.filter((item) => (selected === 'all' || item.departmentKey === selected) && doctorMatches(item, filters)), [rows, filters, selected]);
  const averageUsage = visibleDoctors.length ? Math.round(visibleDoctors.reduce((sum, item) => sum + item.usage, 0) / visibleDoctors.length) : 0;
  const currentDepartment = departments.find((item) => item.key === selected) || departments[0];

  return (
    <>
      <DoctorHero title="Theo khoa" subtitle="Xem lich lam viec theo tung chuyen khoa" filters={filters} onFiltersChange={setFilters} onReset={() => { setFilters(createDoctorFilters()); setSelected('all'); }} />
      <LoadNotice loading={loading} error={error} />
      <div className="reception-doctor-tabs">
        {departments.map((item) => (
          <button key={item.key} type="button" className={selected === item.key ? 'is-active' : ''} onClick={() => setSelected(item.key)}>
            {item.key !== 'all' ? <HeartPulse size={16} /> : null}{item.label}
          </button>
        ))}
      </div>
      <section className="reception-panel">
        <div className="reception-doctor-section-title">
          <span><HeartPulse size={28} /></span>
          <h2>{currentDepartment.label}</h2>
          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setFilters((current) => ({ ...current, showFilters: !current.showFilters }))}>
            <CalendarDays size={16} />Xem lich theo ngay
          </button>
        </div>
        <div className="reception-doctor-summary-strip">
          <KpiCard icon={Users} label="Bac si truc" value={visibleDoctors.length} />
          <KpiCard icon={Stethoscope} label="Dang kham" value={visibleDoctors.filter((item) => item.status === 'active').length} tone="success" />
          <KpiCard icon={Clock3} label="Sap bat dau" value={visibleDoctors.filter((item) => item.status === 'soon').length} tone="warning" />
          <KpiCard icon={CalendarDays} label="Ca trong ngay" value={visibleDoctors.length} />
          <KpiCard icon={CheckCircle2} label="Ty le su dung" value={`${averageUsage}%`} tone="violet" />
        </div>
        <DoctorsTable doctors={visibleDoctors} emptyText="Khong co bac si phu hop voi bo loc hien tai." />
      </section>
    </>
  );
}

function RoomsPage() {
  const [filters, setFilters] = useState(createDoctorFilters);
  const [area, setArea] = useState('');
  const [status, setStatus] = useState('active');
  const { rows: schedules, loading, error } = useDoctorSchedules(filters);
  const roomRows = useMemo(() => buildRoomRows(schedules), [schedules]);
  const areaOptions = useMemo(() => [...new Set(roomRows.map((item) => item.area).filter(Boolean))], [roomRows]);
  const rows = useMemo(() => roomRows.filter((item) => {
    const matchesKeyword = roomMatches({ ...item, name: item.doctor }, filters);
    const matchesArea = !area || item.area === area;
    const matchesStatus = !status || item.status === status;
    return matchesKeyword && matchesArea && matchesStatus;
  }), [area, filters, roomRows, status]);
  const totalRooms = rows.length;
  const activeRooms = rows.filter((item) => item.status === 'active').length;
  const emptyRooms = rows.filter((item) => item.status === 'empty').length;
  const soonRooms = rows.filter((item) => item.status === 'soon').length;
  const averageUsage = rows.length ? Math.round(rows.reduce((sum, item) => sum + item.usage, 0) / rows.length) : 0;

  return (
    <>
      <DoctorHero title="Theo phong" subtitle="Xem lich lam viec theo phong kham" filters={filters} onFiltersChange={setFilters} onReset={() => { setFilters(createDoctorFilters()); setArea(''); setStatus('active'); }} />
      <LoadNotice loading={loading} error={error} />
      <section className="reception-doctor-kpi-grid">
        <KpiCard icon={DoorOpen} label="Tong phong" value={totalRooms} />
        <KpiCard icon={Users} label="Dang su dung" value={activeRooms} tone="success" />
        <KpiCard icon={Stethoscope} label="Trong" value={emptyRooms} />
        <KpiCard icon={Wrench} label="Bao tri / Nghi" value={soonRooms} tone="warning" />
        <KpiCard icon={CheckCircle2} label="Ty le su dung" value={`${averageUsage}%`} tone="violet" />
      </section>
      <section className="reception-doctor-filters">
        <select value={area} onChange={(event) => setArea(event.target.value)}>
          <option value="">Tat ca khu vuc</option>
          {areaOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div>
          {[
            { key: '', label: 'Tat ca trang thai' },
            { key: 'active', label: 'Dang su dung' },
            { key: 'empty', label: 'Trong' },
            { key: 'soon', label: 'Sap bat dau' },
            { key: 'off', label: 'Nghi' },
          ].map((item) => (
            <button key={item.key || 'all'} type="button" className={status === item.key ? 'is-active' : ''} onClick={() => setStatus(item.key)}>{item.label}</button>
          ))}
        </div>
      </section>
      <section className="reception-panel">
        <table className="reception-doctor-table reception-doctor-table--rooms">
          <thead><tr><th>Phong</th><th>Khoa</th><th>Bac si</th><th>Ca lam viec</th><th>Thoi gian</th><th>Trang thai</th><th>Ti le SD</th><th>Dat truoc</th></tr></thead>
          <tbody>
            {rows.map((item) => (
              <tr key={`${item.room}-${item.doctor}-${item.time}`}>
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
            {!rows.length ? <tr><td colSpan="8" className="reception-doctor-empty">Khong co phong phu hop voi bo loc hien tai.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </>
  );
}

function DoctorsTable({ doctors, emptyText = 'Khong co du lieu phu hop.' }) {
  return (
    <table className="reception-doctor-table">
      <thead><tr><th>Bac si</th><th>Phong</th><th>Ca lam viec</th><th>Thoi gian</th><th>Trang thai</th><th>Dang kham</th><th>Da dat</th><th>Ty le SD</th></tr></thead>
      <tbody>
        {doctors.map((doctor) => (
          <tr key={doctor.id}>
            <td><div className="reception-doctor-name"><DoctorAvatar initials={doctor.initials} /><div><strong>{doctor.name}</strong><span>Chuyen khoa {doctor.department}</span></div></div></td>
            <td>{doctor.room}</td>
            <td>{doctor.shift}</td>
            <td>{doctor.time}</td>
            <td><StatusBadge status={doctor.status} /></td>
            <td>{doctor.current}</td>
            <td>{doctor.booked}</td>
            <td><div className="reception-doctor-usage"><span>{doctor.usage}%</span><Progress value={doctor.usage} /></div></td>
          </tr>
        ))}
        {!doctors.length ? <tr><td colSpan="8" className="reception-doctor-empty">{emptyText}</td></tr> : null}
      </tbody>
    </table>
  );
}

function ActiveTable({ doctors, showPatient = false }) {
  return (
    <table className="reception-doctor-table reception-doctor-table--active">
      <thead><tr><th>Bac si</th><th>Khoa</th><th>Phong</th><th>Bat dau</th>{showPatient ? <th>Benh nhan hien tai</th> : null}<th>{showPatient ? 'Tiep theo' : 'Bat dau'}</th></tr></thead>
      <tbody>
        {doctors.map((doctor) => (
          <tr key={doctor.id}>
            <td><div className="reception-doctor-name"><DoctorAvatar initials={doctor.initials} /><div><strong>{doctor.name}</strong><span>{doctor.department}</span></div></div></td>
            <td>{doctor.department}</td>
            <td>{doctor.room}</td>
            <td>{doctor.time.split(' - ')[0]}</td>
            {showPatient ? <td>{doctor.patient}<br /><small>{doctor.id}</small></td> : null}
            <td><span className="reception-doctor-time">{showPatient ? doctor.next : doctor.time.split(' - ')[0]}</span></td>
          </tr>
        ))}
        {!doctors.length ? <tr><td colSpan={showPatient ? 6 : 5} className="reception-doctor-empty">Khong co bac si phu hop voi bo loc hien tai.</td></tr> : null}
      </tbody>
    </table>
  );
}

function ActiveDoctorsPage() {
  const [filters, setFilters] = useState(createDoctorFilters);
  const [showAllActive, setShowAllActive] = useState(false);
  const [showAllSoon, setShowAllSoon] = useState(false);
  const { rows, loading, error } = useDoctorSchedules(filters);
  const filteredDoctors = useMemo(() => rows.filter((item) => doctorMatches(item, filters)), [rows, filters]);
  const activeRows = filteredDoctors.filter((item) => item.status === 'active');
  const soonRows = filteredDoctors.filter((item) => item.status === 'soon');
  const active = showAllActive ? activeRows : activeRows.slice(0, 5);
  const soon = showAllSoon ? soonRows : soonRows.slice(0, 5);
  const doneCount = filteredDoctors.filter((item) => item.status === 'done').length;

  return (
    <>
      <DoctorHero title="Bac si dang truc" subtitle="Danh sach bac si dang truc va tinh trang kham" filters={filters} onFiltersChange={setFilters} onReset={() => { setFilters(createDoctorFilters()); setShowAllActive(false); setShowAllSoon(false); }} />
      <LoadNotice loading={loading} error={error} />
      {filters.showFilters ? (
        <section className="reception-doctor-filter-strip">
          <span>{activeRows.length} dang kham</span>
          <span>{soonRows.length} sap bat dau</span>
          <button type="button" onClick={() => setFilters((current) => ({ ...current, query: '' }))}>Xoa tu khoa</button>
        </section>
      ) : null}
      <div className="reception-doctor-active-grid">
        <section className="reception-panel">
          <div className="reception-panel__header"><div><h2><span className="reception-dot is-success" />Dang kham ({activeRows.length})</h2></div></div>
          <ActiveTable doctors={active} showPatient />
          <button type="button" className="reception-doctor-link" onClick={() => setShowAllActive((current) => !current)}>{showAllActive ? 'Thu gon' : 'Xem tat ca'} <ChevronRight size={16} /></button>
        </section>
        <section className="reception-panel">
          <div className="reception-panel__header"><div><h2><span className="reception-dot is-warning" />Sap bat dau ({soonRows.length})</h2></div></div>
          <ActiveTable doctors={soon} />
          <button type="button" className="reception-doctor-link" onClick={() => setShowAllSoon((current) => !current)}>{showAllSoon ? 'Thu gon' : 'Xem tat ca'} <ChevronRight size={16} /></button>
        </section>
      </div>
      <div className="reception-doctor-active-grid reception-doctor-active-grid--bottom">
        <section className="reception-panel reception-doctor-donut-panel">
          <h2>Thong ke dang truc</h2>
          <div className="reception-doctor-donut"><span>Tong<strong>{filteredDoctors.length}</strong></span></div>
          <div className="reception-doctor-donut-list">
            <p><span className="is-success" />Dang kham <strong>{activeRows.length}</strong><em>{filteredDoctors.length ? Math.round((activeRows.length / filteredDoctors.length) * 100) : 0}%</em></p>
            <p><span className="is-warning" />Sap bat dau <strong>{soonRows.length}</strong><em>{filteredDoctors.length ? Math.round((soonRows.length / filteredDoctors.length) * 100) : 0}%</em></p>
            <p><span />Nghi <strong>{filteredDoctors.filter((item) => item.status === 'off').length}</strong><em>0%</em></p>
            <p><span />Da ket thuc <strong>{doneCount}</strong><em>{filteredDoctors.length ? Math.round((doneCount / filteredDoctors.length) * 100) : 0}%</em></p>
          </div>
        </section>
        <section className="reception-panel">
          <div className="reception-panel__header"><div><h2>Hoat dong gan day</h2></div></div>
          <div className="reception-doctor-feed">
            {filteredDoctors.slice(0, 4).map((item) => (
              <div key={item.id} className="reception-doctor-feed__item">
                <span>{item.time.split(' - ')[0]}</span>
                <div><strong>{item.name} - {STATUS_META[item.status]?.label || item.status}</strong><p>{item.department} - {item.room}</p></div>
              </div>
            ))}
            {!filteredDoctors.length ? <div className="reception-doctor-empty">Chua co hoat dong trong ngay.</div> : null}
          </div>
        </section>
      </div>
    </>
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
