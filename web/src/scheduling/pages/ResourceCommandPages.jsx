import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Gauge,
  Hospital,
  MapPin,
  MonitorUp,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  UsersRound,
} from 'lucide-react';

import { schedulingApi } from '../api/schedulingApi.js';
import { runSchedulingAction } from '../utils/schedulingActions.js';

const todayIso = () => new Date().toISOString().slice(0, 10);

const VIEW_CONFIG = {
  departments: {
    title: 'Khoa / phòng ban',
    eyebrow: 'Department Operations Board',
    subtitle: 'Theo dõi tải vận hành, lịch bác sĩ, slot, queue và cảnh báo theo từng khoa trong ngày.',
  },
  doctors: {
    title: 'Bác sĩ',
    eyebrow: 'Doctor Operations Board',
    subtitle: 'Theo dõi lịch làm việc, slot, appointment, queue và tải vận hành của từng bác sĩ.',
  },
  locations: {
    title: 'Phòng khám / địa điểm',
    eyebrow: 'Room & Location Directory',
    subtitle: 'Bản đồ phòng, địa điểm khám và trạng thái sử dụng tài nguyên trong ngày.',
  },
  doctorLoad: {
    title: 'Tải lịch bác sĩ',
    eyebrow: 'Doctor Load Matrix',
    subtitle: 'Phân tích tải lịch, slot, appointment và queue để cân bằng công suất bác sĩ.',
  },
  roomStatus: {
    title: 'Trạng thái phòng',
    eyebrow: 'Realtime Room Status Board',
    subtitle: 'Theo dõi phòng đang dùng, phòng rảnh, bảo trì, queue chờ và mapping lịch.',
  },
  attention: {
    title: 'Tài nguyên cần chú ý',
    eyebrow: 'Resource Attention Center',
    subtitle: 'Gom các khoa, bác sĩ, phòng và slot đang có rủi ro vận hành hoặc cần điều phối.',
  },
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.departments)) return value.departments;
  if (Array.isArray(value?.doctors)) return value.doctors;
  if (Array.isArray(value?.rooms)) return value.rooms;
  return [];
}

function unwrap(result) {
  return result?.status === 'fulfilled' ? result.value : null;
}

function firstArray(...values) {
  for (const value of values) {
    const items = asArray(value);
    if (items.length) return items;
  }
  return [];
}

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function pct(booked, total) {
  const denominator = safeNumber(total);
  if (!denominator) return 0;
  return Math.round((safeNumber(booked) / denominator) * 100);
}

function loadLevel(score) {
  if (score >= 90) return 'critical';
  if (score >= 75) return 'high';
  if (score <= 40) return 'low';
  return 'normal';
}

function departmentName(item = {}) {
  return item.department_name || item.name || item.department?.name || item.department_id?.name || item.label || 'Chưa rõ khoa';
}

function doctorName(item = {}) {
  return item.full_name || item.doctor_name || item.name || item.user_id?.full_name || item.user?.full_name || item.doctor?.name || 'Chưa rõ bác sĩ';
}

function normalizeDepartment(item = {}, index = 0) {
  const slots = item.slots || item.slot_summary || {};
  const today = item.today || {};
  const staff = item.staff || {};
  const totalSlots = safeNumber(slots.total ?? item.total_slots ?? item.slots_count);
  const bookedSlots = safeNumber(slots.booked ?? item.booked_slots ?? item.appointments_count);
  const utilization = safeNumber(slots.utilization_rate ?? item.utilization_rate, pct(bookedSlots, totalSlots));
  const score = safeNumber(item.load?.score, Math.max(utilization, safeNumber(today.queue_waiting || item.queue_waiting) * 3));
  return {
    id: item.department_id || item.id || item._id || `dept-${index}`,
    type: 'department',
    name: departmentName(item),
    code: item.department_code || item.code || `K${index + 1}`,
    departmentType: item.department_type || item.type || 'clinical',
    headName: item.head?.full_name || item.head_name || item.department_head?.full_name || 'Chưa gán trưởng khoa',
    status: item.status || 'active',
    schedules: safeNumber(today.schedules_count ?? item.schedules_count ?? item.today_schedules),
    published: safeNumber(today.published_schedules ?? item.published_schedules),
    unpublished: safeNumber(today.unpublished_schedules ?? item.unpublished_schedules),
    totalSlots,
    bookedSlots,
    availableSlots: safeNumber(slots.available ?? item.available_slots, Math.max(totalSlots - bookedSlots, 0)),
    blockedSlots: safeNumber(slots.blocked ?? item.blocked_slots),
    utilization,
    appointments: safeNumber(today.appointments_count ?? item.appointments_today ?? item.appointments_count),
    queueWaiting: safeNumber(today.queue_waiting ?? item.queue_waiting),
    queueInService: safeNumber(today.queue_in_service ?? item.queue_in_service),
    queueCompleted: safeNumber(today.queue_completed ?? item.queue_completed),
    queueLong: safeNumber(item.queue_long ?? item.waiting_over_30m),
    doctors: safeNumber(staff.doctors_count ?? item.doctor_count ?? item.doctors_count),
    staffCount: safeNumber(staff.total_staff ?? item.staff_count),
    rooms: safeNumber(item.rooms_active ?? item.room_count),
    loadScore: score,
    loadLevel: item.load?.level || item.risk_level || loadLevel(score),
    alerts: (item.alerts || item.warnings || []).map((alert) => alert.title || alert.type || alert.message || alert).slice(0, 4),
    raw: item,
  };
}

function normalizeDoctor(item = {}, index = 0) {
  const slots = item.slots || item.slot_summary || {};
  const today = item.today || {};
  const totalSlots = safeNumber(slots.total ?? item.total_slots ?? item.slots_count);
  const bookedSlots = safeNumber(slots.booked ?? item.booked_slots ?? item.appointments_count);
  const utilization = safeNumber(slots.utilization_rate ?? item.utilization_rate, pct(bookedSlots, totalSlots));
  const score = safeNumber(item.load?.score, Math.max(utilization, safeNumber(today.queue_waiting || item.queue_waiting) * 4));
  return {
    id: item.doctor_id || item.profile_id || item.id || item._id || `doc-${index}`,
    type: 'doctor',
    name: doctorName(item),
    avatar: item.avatar_url || item.avatar || item.user_id?.avatar_url || '',
    departmentName: item.department?.department_name || item.department?.name || item.department_name || item.department_id?.name || 'Chưa rõ khoa',
    specialty: item.specialty || item.subspecialty || item.qualification || 'Chuyên khoa',
    status: item.status || 'active',
    schedules: safeNumber(today.schedules_count ?? item.schedules_count ?? item.active_schedules_count),
    totalSlots,
    bookedSlots,
    availableSlots: safeNumber(slots.available ?? item.available_slots, Math.max(totalSlots - bookedSlots, 0)),
    blockedSlots: safeNumber(slots.blocked ?? item.blocked_slots),
    utilization,
    appointments: safeNumber(today.appointments_count ?? item.appointments_count),
    queueWaiting: safeNumber(today.queue_waiting ?? item.queue_waiting),
    queueInService: safeNumber(today.queue_in_service ?? item.queue_in_service),
    noShow: safeNumber(today.no_show_count ?? item.no_show_count),
    avgWait: safeNumber(item.queue?.avg_wait_minutes ?? item.avg_wait_minutes),
    maxWait: safeNumber(item.queue?.max_wait_minutes ?? item.max_wait_minutes),
    hourlyLoad: item.hourly_load || item.hourlyLoad || {},
    loadScore: score,
    loadLevel: item.load?.level || item.risk_level || loadLevel(score),
    alerts: (item.alerts || item.warnings || []).map((alert) => alert.title || alert.type || alert.message || alert).slice(0, 4),
    raw: item,
  };
}

function normalizeRoom(item = {}, index = 0) {
  const status = item.status || item.current_status || (item.active === false ? 'inactive' : item.maintenance_status === 'maintenance' ? 'maintenance' : 'available');
  return {
    id: item.room_id || item.location_id || item.id || item._id || `room-${index}`,
    type: item.resource_type || item.room_type || item.type || item.modality || 'clinic_room',
    name: item.room_name || item.name || item.location_name || `Phòng ${index + 1}`,
    code: item.room_code || item.code || item.location_code || `R${index + 1}`,
    departmentName: item.department?.name || item.department_name || item.department_id?.name || 'Chưa rõ khoa',
    building: item.building || item.address || item.location || 'Cơ sở chính',
    floor: item.floor || item.metadata?.floor || '—',
    capacity: safeNumber(item.capacity, 1),
    status,
    doctorName: item.doctor_name || item.current_doctor?.full_name || item.assigned_doctor_name || 'Chưa gán',
    queueWaiting: safeNumber(item.queue_waiting),
    appointmentsLeft: safeNumber(item.appointments_left || item.remaining_appointments),
    nextFreeAt: item.next_free_at || item.next_available_at || 'Không rõ',
    loadScore: safeNumber(item.load?.score, safeNumber(item.queue_waiting) * 8),
    alerts: (item.alerts || item.warnings || []).map((alert) => alert.title || alert.type || alert.message || alert).slice(0, 4),
    raw: item,
  };
}

function buildAttention({ departments, doctors, rooms, scheduleSummary }) {
  const alerts = asArray(scheduleSummary?.operation_alerts).map((alert, index) => ({
    id: alert.id || `schedule-alert-${index}`,
    type: alert.entity_type || 'schedule',
    title: alert.title || alert.message || 'Cảnh báo lịch / slot',
    message: alert.message || alert.description || 'Có lịch hoặc slot cần kiểm tra.',
    severity: alert.severity || 'warning',
    owner: alert.department_name || alert.doctor_name || 'Scheduling',
    action: 'Mở lịch liên quan',
  }));
  const departmentAttention = departments
    .filter((item) => ['high', 'critical'].includes(item.loadLevel) || item.alerts.length)
    .map((item) => ({
      id: `dept-${item.id}`,
      type: 'department',
      title: `${item.name} cần chú ý`,
      message: `Utilization ${item.utilization}% · Queue chờ ${item.queueWaiting} · ${item.alerts[0] || 'Tải vận hành cao'}`,
      severity: item.loadLevel === 'critical' ? 'critical' : 'high',
      owner: item.headName,
      action: 'Mở dashboard khoa',
      entity: item,
    }));
  const doctorAttention = doctors
    .filter((item) => ['high', 'critical'].includes(item.loadLevel) || item.queueWaiting > 8)
    .map((item) => ({
      id: `doc-${item.id}`,
      type: 'doctor',
      title: `${item.name} quá tải`,
      message: `Slot ${item.utilization}% · Queue chờ ${item.queueWaiting} · Còn ${item.availableSlots} slot`,
      severity: item.loadLevel === 'critical' ? 'critical' : 'high',
      owner: item.departmentName,
      action: 'Cân bằng tải bác sĩ',
      entity: item,
    }));
  const roomAttention = rooms
    .filter((item) => item.status === 'maintenance' || item.alerts.length || item.queueWaiting > 6)
    .map((item) => ({
      id: `room-${item.id}`,
      type: 'room',
      title: `${item.name} có vấn đề`,
      message: `${item.status} · ${item.alerts[0] || `${item.queueWaiting} queue đang chờ`}`,
      severity: item.status === 'maintenance' ? 'high' : 'warning',
      owner: item.departmentName,
      action: 'Kiểm tra phòng',
      entity: item,
    }));
  return [...alerts, ...departmentAttention, ...doctorAttention, ...roomAttention];
}

export function ResourceCommandPage({ view = 'departments' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.departments;
  const [filters, setFilters] = useState({ date: todayIso(), query: '', load: 'all' });
  const [state, setState] = useState({
    loading: true,
    error: null,
    resources: null,
    departments: null,
    doctors: null,
    rooms: null,
    doctorLoad: null,
    roomStatus: null,
    attention: null,
    systemSummary: null,
    departmentSummary: null,
    activeDepartments: null,
    options: null,
    doctorProfiles: null,
    facilityLocations: null,
    inpatientRooms: null,
    imagingRooms: null,
  });
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      const params = { date: filters.date };
      const results = await Promise.allSettled([
        schedulingApi.getOperationsResourcesLoad(params),
        schedulingApi.getOperationsResourceDepartments(params),
        schedulingApi.getOperationsResourceDoctors(params),
        schedulingApi.getOperationsResourceRooms(params),
        schedulingApi.getOperationsDoctorLoad(params),
        schedulingApi.getOperationsRoomStatus(params),
        schedulingApi.getOperationsResourceAttention(params),
        schedulingApi.getSystemSummary({ preset: 'today' }),
        schedulingApi.getDepartmentSummary({ preset: 'today' }),
        schedulingApi.listActiveDepartments(),
        schedulingApi.getCreateOptions(),
        schedulingApi.listDoctorProfiles({ limit: 200 }),
        schedulingApi.listFacilityLocations({ limit: 200 }),
        schedulingApi.listInpatientRooms({ limit: 200 }),
        schedulingApi.listImagingRooms({ limit: 200 }),
      ]);
      if (!active) return;
      const [
        resources,
        departments,
        doctors,
        rooms,
        doctorLoad,
        roomStatus,
        attention,
        systemSummary,
        departmentSummary,
        activeDepartments,
        options,
        doctorProfiles,
        facilityLocations,
        inpatientRooms,
        imagingRooms,
      ] = results.map(unwrap);
      const hasLegacy = systemSummary || departmentSummary || activeDepartments || options;
      const firstError = hasLegacy ? null : results.find((item) => item.status === 'rejected')?.reason?.message;
      setState({
        loading: false,
        error: firstError || null,
        resources,
        departments,
        doctors,
        rooms,
        doctorLoad,
        roomStatus,
        attention,
        systemSummary,
        departmentSummary,
        activeDepartments,
        options,
        doctorProfiles,
        facilityLocations,
        inpatientRooms,
        imagingRooms,
      });
    }
    load();
    return () => {
      active = false;
    };
  }, [filters.date, reloadKey]);

  const departments = useMemo(() => {
    const source = firstArray(
      state.departments?.items,
      state.departments,
      state.resources?.departments,
      state.departmentSummary?.items,
      state.departmentSummary?.by_department,
      state.systemSummary?.by_department,
      state.activeDepartments,
    );
    return source.map(normalizeDepartment).map((item) => ({
      ...item,
      alerts: item.alerts.length ? item.alerts : item.loadLevel === 'critical' ? ['Quá tải'] : item.unpublished ? ['Lịch chưa publish'] : [],
    }));
  }, [state.activeDepartments, state.departmentSummary, state.departments, state.resources, state.systemSummary]);

  const doctors = useMemo(() => {
    const source = firstArray(
      state.doctorLoad?.items,
      state.doctors?.items,
      state.doctors,
      state.resources?.doctors,
      state.systemSummary?.by_doctor,
      state.options?.doctors,
      state.doctorProfiles,
    );
    return source.map(normalizeDoctor);
  }, [state.doctorLoad, state.doctorProfiles, state.doctors, state.options, state.resources, state.systemSummary]);

  const rooms = useMemo(() => {
    const source = firstArray(
      state.roomStatus?.items,
      state.rooms?.items,
      state.rooms,
      state.resources?.rooms,
      state.facilityLocations,
      state.inpatientRooms,
      state.imagingRooms,
    );
    return source.map(normalizeRoom);
  }, [state.facilityLocations, state.imagingRooms, state.inpatientRooms, state.resources, state.roomStatus, state.rooms]);

  const attention = useMemo(() => {
    const source = firstArray(state.attention?.items, state.attention);
    if (source.length) {
      return source.map((item, index) => ({
        id: item.id || item.attention_id || `attention-${index}`,
        type: item.type || item.resource_type || 'resource',
        title: item.title || item.message || 'Tài nguyên cần chú ý',
        message: item.message || item.description || 'Cần điều phối viên kiểm tra.',
        severity: item.severity || 'warning',
        owner: item.owner_name || item.department_name || item.doctor_name || 'Operations',
        action: item.suggested_actions?.[0]?.label || 'Xem chi tiết',
        raw: item,
      }));
    }
    return [];
  }, [departments, doctors, rooms, state.attention, state.systemSummary]);

  const visible = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const match = (item) => {
      const text = `${item.name || item.title} ${item.code || ''} ${item.departmentName || ''} ${item.owner || ''}`.toLowerCase();
      return (!query || text.includes(query)) && (filters.load === 'all' || item.loadLevel === filters.load || item.severity === filters.load);
    };
    if (view === 'departments') return departments.filter(match);
    if (view === 'doctors' || view === 'doctorLoad') return doctors.filter(match);
    if (view === 'locations' || view === 'roomStatus') return rooms.filter(match);
    return attention.filter(match);
  }, [attention, departments, doctors, filters.load, filters.query, rooms, view]);

  const summary = useMemo(() => ({
    departments: departments.length,
    activeDepartments: departments.filter((item) => item.status !== 'inactive').length,
    doctors: doctors.length,
    doctorsWithSchedule: doctors.filter((item) => item.schedules > 0).length,
    rooms: rooms.length,
    roomsInUse: rooms.filter((item) => item.status === 'in_use').length,
    overloaded: [...departments, ...doctors].filter((item) => ['high', 'critical'].includes(item.loadLevel)).length,
    attention: attention.length,
  }), [attention, departments, doctors, rooms]);

  const refreshResources = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  const runAttentionAction = async (item, action) => {
    const label = action === 'ack' ? 'acknowledge' : 'resolve';
    await runSchedulingAction({
      action: async () => {
        if (action === 'ack') return schedulingApi.acknowledgeResourceAttention(item.id, {});
        if (action === 'resolve') return schedulingApi.resolveResourceAttention(item.id, {});
        throw new Error('Hành động tài nguyên chưa được hỗ trợ.');
      },
      confirm: action === 'resolve' ? {
        title: 'Resolve cảnh báo tài nguyên',
        body: `Resolve "${item.title}".`,
        confirmLabel: 'resolve',
      } : null,
      pendingMessage: `Đang ${label} tài nguyên...`,
      successTitle: 'Tài nguyên đã cập nhật',
      successBody: `Đã ${label} cảnh báo tài nguyên.`,
      errorTitle: 'Không xử lý được tài nguyên',
      errorBody: 'Không xử lý được tài nguyên.',
      to: '/scheduling/resources/attention',
      onStatus: setMessage,
      onSuccess: refreshResources,
    });
  };

  return (
    <main className="sched-resource-page">
      <ResourceHeader config={config} filters={filters} setFilters={setFilters} loading={state.loading} error={state.error} />
      {message ? <div className="sched-resource-notice">{message}</div> : null}
      <ResourceKpis summary={summary} />
      <ResourceToolbar filters={filters} setFilters={setFilters} />

      {view === 'departments' ? <DepartmentBoard items={visible} loading={state.loading} onSelect={setSelected} /> : null}
      {view === 'doctors' ? <DoctorBoard items={visible} loading={state.loading} onSelect={setSelected} /> : null}
      {view === 'locations' ? <RoomBoard items={visible} loading={state.loading} onSelect={setSelected} mode="directory" /> : null}
      {view === 'doctorLoad' ? <DoctorLoadMatrix items={visible} loading={state.loading} onSelect={setSelected} /> : null}
      {view === 'roomStatus' ? <RoomBoard items={visible} loading={state.loading} onSelect={setSelected} mode="status" /> : null}
      {view === 'attention' ? <AttentionCenter items={visible} loading={state.loading} onSelect={setSelected} runAction={runAttentionAction} /> : null}

      {selected ? <ResourceDrawer item={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

function ResourceHeader({ config, filters, setFilters, loading, error }) {
  return (
    <section className="sched-resource-hero">
      <div>
        <span>{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
        <small><i />{loading ? 'Đang đồng bộ tài nguyên' : 'Realtime/polling sẵn sàng'}{error ? ` · ${error}` : ''}</small>
      </div>
      <div className="sched-resource-hero__tools">
        <label><span>Ngày</span><input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} /></label>
        <button type="button" onClick={() => setFilters((current) => ({ ...current, date: todayIso() }))}><RefreshCw size={16} />Hôm nay</button>
        <Link to="/scheduling/overview"><MonitorUp size={16} />Command center</Link>
      </div>
    </section>
  );
}

function ResourceKpis({ summary }) {
  const cards = [
    ['Khoa active', summary.activeDepartments, Building2, 'blue'],
    ['Bác sĩ', summary.doctors, Stethoscope, 'teal'],
    ['Có lịch hôm nay', summary.doctorsWithSchedule, CalendarClock, 'green'],
    ['Phòng', summary.rooms, Hospital, 'purple'],
    ['Phòng đang dùng', summary.roomsInUse, DoorOpen, 'amber'],
    ['Quá tải', summary.overloaded, Gauge, 'red'],
    ['Cần chú ý', summary.attention, ShieldAlert, 'red'],
  ];
  return (
    <section className="sched-resource-kpis">
      {cards.map(([label, value, Icon, tone]) => (
        <article className={`is-${tone}`} key={label}>
          <span><Icon size={18} /></span>
          <div><strong>{value}</strong><small>{label}</small></div>
        </article>
      ))}
    </section>
  );
}

function ResourceToolbar({ filters, setFilters }) {
  return (
    <section className="sched-resource-toolbar">
      <div><Search size={16} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Tìm khoa, bác sĩ, phòng, cảnh báo..." /></div>
      <select value={filters.load} onChange={(event) => setFilters((current) => ({ ...current, load: event.target.value }))}>
        <option value="all">Tất cả mức tải</option>
        <option value="critical">Critical</option>
        <option value="high">Cao</option>
        <option value="normal">Bình thường</option>
        <option value="low">Thấp</option>
      </select>
    </section>
  );
}

function DepartmentBoard({ items, loading, onSelect }) {
  if (loading) return <ResourceSkeleton />;
  return (
    <section className="sched-resource-grid is-departments">
      {items.map((item) => <DepartmentCard item={item} key={item.id} onSelect={onSelect} />)}
    </section>
  );
}

function DepartmentCard({ item, onSelect }) {
  return (
    <article className={`sched-resource-card is-${item.loadLevel}`} onClick={() => onSelect(item)}>
      <header>
        <div><strong>{item.name}</strong><small>{item.code} · {item.departmentType} · {item.headName}</small></div>
        <LoadBadge level={item.loadLevel} score={item.loadScore} />
      </header>
      <ResourceProgress value={item.utilization} label="Utilization slot" />
      <div className="sched-resource-metrics">
        <span><b>{item.schedules}</b>Lịch</span>
        <span><b>{item.totalSlots}</b>Slot</span>
        <span><b>{item.bookedSlots}</b>Đã đặt</span>
        <span><b>{item.queueWaiting}</b>Queue chờ</span>
        <span><b>{item.doctors}</b>Bác sĩ</span>
        <span><b>{item.rooms}</b>Phòng</span>
      </div>
      <footer>
        {(item.alerts.length ? item.alerts : ['Ổn định']).map((alert) => <em key={alert}>{alert}</em>)}
      </footer>
    </article>
  );
}

function DoctorBoard({ items, loading, onSelect }) {
  if (loading) return <ResourceSkeleton />;
  return (
    <section className="sched-resource-grid is-doctors">
      {items.map((item) => <DoctorCard item={item} key={item.id} onSelect={onSelect} />)}
    </section>
  );
}

function DoctorCard({ item, onSelect }) {
  return (
    <article className={`sched-resource-card sched-resource-doctor is-${item.loadLevel}`} onClick={() => onSelect(item)}>
      <header>
        <div className="sched-resource-avatar">{item.avatar ? <img src={item.avatar} alt="" /> : item.name.slice(0, 2).toUpperCase()}</div>
        <div><strong>{item.name}</strong><small>{item.specialty} · {item.departmentName}</small></div>
        <LoadBadge level={item.loadLevel} score={item.loadScore} />
      </header>
      <ResourceProgress value={item.utilization} label={`${item.bookedSlots}/${item.totalSlots} slot đã đặt`} />
      <div className="sched-resource-metrics">
        <span><b>{item.schedules}</b>Ca</span>
        <span><b>{item.availableSlots}</b>Còn slot</span>
        <span><b>{item.appointments}</b>Lịch hẹn</span>
        <span><b>{item.queueWaiting}</b>Queue</span>
        <span><b>{item.queueInService}</b>Đang khám</span>
        <span><b>{item.noShow}</b>No-show</span>
      </div>
      <footer>
        {(item.alerts.length ? item.alerts : [item.availableSlots ? 'Còn slot' : 'Kín lịch']).map((alert) => <em key={alert}>{alert}</em>)}
      </footer>
    </article>
  );
}

function RoomBoard({ items, loading, onSelect, mode }) {
  if (loading) return <ResourceSkeleton />;
  return (
    <section className={`sched-room-grid is-${mode}`}>
      {items.map((item) => (
        <article className={`sched-room-tile is-${item.status}`} key={item.id} onClick={() => onSelect(item)}>
          <header>
            <span>{item.code}</span>
            <RoomStatus status={item.status} />
          </header>
          <strong>{item.name}</strong>
          <small>{item.departmentName} · {item.building} · {item.floor}</small>
          <div className="sched-room-tile__body">
            <span><Stethoscope size={14} />{item.doctorName}</span>
            <span><UsersRound size={14} />Queue chờ {item.queueWaiting}</span>
            <span><Clock3 size={14} />Rảnh tiếp: {item.nextFreeAt}</span>
          </div>
          <footer>{(item.alerts.length ? item.alerts : ['Không có cảnh báo']).map((alert) => <em key={alert}>{alert}</em>)}</footer>
        </article>
      ))}
    </section>
  );
}

function DoctorLoadMatrix({ items, loading, onSelect }) {
  if (loading) return <ResourceSkeleton />;
  const hours = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
  return (
    <section className="sched-load-matrix">
      <header>
        <span>Bác sĩ</span>
        {hours.map((hour) => <span key={hour}>{hour}</span>)}
        <span>Queue</span>
      </header>
      {items.map((item, index) => (
        <button type="button" key={item.id} onClick={() => onSelect(item)}>
          <strong>{item.name}<small>{item.departmentName}</small></strong>
          {hours.map((hour, hourIndex) => {
            const value = Math.max(0, Math.min(110, safeNumber(item.hourlyLoad?.[hour], 0)));
            return <span className={`is-${loadLevel(value)}`} key={hour}>{Math.round(value)}%</span>;
          })}
          <em>{item.queueWaiting} chờ</em>
        </button>
      ))}
    </section>
  );
}

function AttentionCenter({ items, loading, onSelect, runAction }) {
  if (loading) return <ResourceSkeleton />;
  return (
    <section className="sched-attention-board">
      {['critical', 'high', 'warning'].map((severity) => {
        const rows = items.filter((item) => item.severity === severity || (severity === 'warning' && !['critical', 'high'].includes(item.severity)));
        return (
          <div className="sched-attention-lane" key={severity}>
            <header><strong>{severity}</strong><span>{rows.length}</span></header>
            {rows.map((item) => (
              <article key={item.id} onClick={() => onSelect(item.entity || item)}>
                <span>{item.type}</span>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <small>{item.owner}</small>
                <footer>
                  <button type="button" onClick={(event) => { event.stopPropagation(); runAction(item, 'ack'); }}>Đã xem</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); runAction(item, 'resolve'); }}>Resolve</button>
                </footer>
              </article>
            ))}
            {!rows.length ? <div className="sched-resource-empty">Không có tài nguyên ở mức này</div> : null}
          </div>
        );
      })}
    </section>
  );
}

function ResourceDrawer({ item, onClose }) {
  const title = item.name || item.title;
  const subtitle = item.departmentName || item.owner || item.headName || item.type;
  return (
    <aside className="sched-resource-drawer">
      <header>
        <div><span>{item.type || 'resource'}</span><h2>{title}</h2><p>{subtitle}</p></div>
        <button type="button" onClick={onClose}>Đóng</button>
      </header>
      <section>
        <h3>Tổng quan vận hành</h3>
        <dl>
          <div><dt>Mức tải</dt><dd>{item.loadLevel || item.severity || item.status || 'normal'}</dd></div>
          <div><dt>Điểm tải</dt><dd>{item.loadScore ?? '—'}</dd></div>
          <div><dt>Utilization</dt><dd>{item.utilization ?? '—'}%</dd></div>
          <div><dt>Queue chờ</dt><dd>{item.queueWaiting ?? '—'}</dd></div>
          <div><dt>Slot còn</dt><dd>{item.availableSlots ?? '—'}</dd></div>
          <div><dt>Cảnh báo</dt><dd>{item.alerts?.length || 0}</dd></div>
        </dl>
      </section>
      <section>
        <h3>Hành động nhanh</h3>
        <div className="sched-resource-drawer__actions">
          <Link to="/scheduling/today"><CalendarClock size={15} />Xem lịch hôm nay</Link>
          <Link to="/scheduling/queue"><UsersRound size={15} />Mở queue</Link>
          <Link to="/scheduling/alerts"><AlertTriangle size={15} />Cảnh báo</Link>
        </div>
      </section>
      <section>
        <h3>Gợi ý điều phối</h3>
        <ul>
          <li>Kiểm tra slot còn trống và queue đang chờ trước khi dời bệnh nhân.</li>
          <li>Nếu utilization trên 90%, ưu tiên mở thêm ca hoặc chuyển queue sang bác sĩ còn tải.</li>
          <li>Nếu phòng chưa mapping lịch, gán phòng trước giờ mở khám.</li>
        </ul>
      </section>
    </aside>
  );
}

function ResourceProgress({ value, label }) {
  const current = Math.max(0, Math.min(110, safeNumber(value)));
  return (
    <div className="sched-resource-progress">
      <div><span>{label}</span><strong>{Math.round(current)}%</strong></div>
      <i><b style={{ width: `${Math.min(current, 100)}%` }} /></i>
    </div>
  );
}

function LoadBadge({ level, score }) {
  return <span className={`sched-load-badge is-${level}`}>{level} · {Math.round(safeNumber(score))}</span>;
}

function RoomStatus({ status }) {
  const labels = {
    in_use: 'Đang dùng',
    available: 'Rảnh',
    maintenance: 'Bảo trì',
    inactive: 'Inactive',
    occupied: 'Đang dùng',
  };
  return <span className={`sched-room-status is-${status}`}>{labels[status] || status || 'Không rõ'}</span>;
}

function ResourceSkeleton() {
  return (
    <section className="sched-resource-grid">
      {Array.from({ length: 6 }, (_, index) => <div className="sched-resource-skeleton" key={index} />)}
    </section>
  );
}
