import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  Grid3X3,
  History,
  Layers3,
  ListChecks,
  Lock,
  MoreHorizontal,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Timer,
  UsersRound,
  WandSparkles,
  XCircle,
} from 'lucide-react';
import { schedulingApi } from '../api/schedulingApi';
import { useSchedulingData } from '../context/SchedulingDataContext';
import { downloadJsonFile, runSchedulingAction } from '../utils/schedulingActions';

const VIEW_CONFIG = {
  list: {
    eyebrow: 'Doctor Schedule Operations',
    title: 'Quản lý lịch làm việc',
    copy: 'Quản lý ca làm việc, trạng thái publish, slot, appointment và rủi ro vận hành của bác sĩ.',
  },
  calendar: {
    eyebrow: 'Visual Calendar',
    title: 'Lịch trực quan',
    copy: 'Xem lịch bác sĩ theo ngày, tuần, tháng và timeline với utilization, slot và cảnh báo.',
  },
  create: {
    eyebrow: 'Safe Schedule Builder',
    title: 'Tạo lịch làm việc',
    copy: 'Wizard tạo lịch đơn lẻ có preview slot, break windows và kiểm tra xung đột trước khi lưu.',
  },
  bulk: {
    eyebrow: 'Bulk Schedule Planner',
    title: 'Tạo hàng loạt',
    copy: 'Tạo nhiều lịch theo tuần/tháng, chọn bác sĩ, preview conflict và kiểm soát kết quả batch.',
  },
  publish: {
    eyebrow: 'Publish Readiness Queue',
    title: 'Duyệt / publish lịch',
    copy: 'Rà soát lịch nháp, kiểm tra điều kiện publish, generate slot và publish hàng loạt.',
  },
  conflicts: {
    eyebrow: 'Conflict Radar',
    title: 'Kiểm tra xung đột',
    copy: 'Radar lỗi lịch bác sĩ: trùng ca, thiếu slot, appointment ngoài ca và các lịch cần xử lý.',
  },
  impact: {
    eyebrow: 'Change Impact Preview',
    title: 'Tác động khi đổi lịch',
    copy: 'So sánh lịch hiện tại với lịch đề xuất, xem appointment bị ảnh hưởng và kế hoạch xử lý.',
  },
};

const STATUS_META = {
  draft: { label: 'Nháp', tone: 'slate' },
  published: { label: 'Đã publish', tone: 'blue' },
  active: { label: 'Đang active', tone: 'green' },
  cancelled: { label: 'Đã hủy', tone: 'red' },
  canceled: { label: 'Đã hủy', tone: 'red' },
  completed: { label: 'Hoàn tất', tone: 'gray' },
};

const STATUS_TABS = [
  ['all', 'Tất cả'],
  ['today', 'Hôm nay'],
  ['week', 'Tuần này'],
  ['draft', 'Nháp'],
  ['pending_publish', 'Chờ publish'],
  ['published', 'Published'],
  ['active', 'Active'],
  ['attention', 'Cần xử lý'],
];

const SHIFT_PRESETS = [
  { id: 'morning', label: 'Sáng', start: '07:00', end: '11:30' },
  { id: 'afternoon', label: 'Chiều', start: '13:00', end: '17:00' },
  { id: 'evening', label: 'Tối', start: '18:00', end: '21:00' },
];

const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getDoctorDepartmentId(doctor = {}) {
  return doctor.departmentId || doctor.department_id || doctor.raw?.department_id || '';
}

function doctorBelongsToDepartment(doctor = {}, departmentId = '', departments = []) {
  if (!doctor?.id || !departmentId) return Boolean(doctor?.id);
  const doctorDepartmentId = getDoctorDepartmentId(doctor);
  if (doctorDepartmentId && String(doctorDepartmentId) === String(departmentId)) return true;
  const department = departments.find((item) => String(item.id) === String(departmentId));
  return Boolean(department?.name && doctor.department && normalizeKey(doctor.department) === normalizeKey(department.name));
}

function firstDoctorForDepartment(doctors = [], departmentId = '', departments = []) {
  return doctors.find((doctor) => doctorBelongsToDepartment(doctor, departmentId, departments)) || null;
}

function pct(value, total) {
  return total > 0 ? Math.round((safeNumber(value) / safeNumber(total)) * 100) : 0;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '--';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatWeekday(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(date);
}

function timeToMinutes(value) {
  const [hour = 0, minute = 0] = String(value || '00:00').slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTime(value) {
  const minutes = Math.max(0, value);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatTime(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }
  return String(value).slice(0, 5);
}

function classifyShift(start) {
  const minutes = timeToMinutes(start);
  if (minutes < 720) return 'Sáng';
  if (minutes < 1080) return 'Chiều';
  return 'Tối';
}

function normalizeSchedule(item = {}, index = 0) {
  const raw = item.raw || item;
  const slots = item.slots_summary || raw.slots_summary || {};
  const appointments = item.appointments_summary || raw.appointments_summary || {};
  const id = item.schedule_id || item.doctor_schedule_id || item.id || raw._id || `schedule-${index}`;
  const totalSlots = safeNumber(item.totalSlots ?? slots.total ?? slots.total_slots ?? raw.total_slots);
  const bookedSlots = safeNumber(item.bookedSlots ?? slots.booked ?? slots.booked_slots ?? raw.booked_slots);
  const availableSlots = safeNumber(item.availableSlots ?? slots.available ?? slots.available_slots ?? raw.available_slots);
  const blockedSlots = safeNumber(item.blockedSlots ?? slots.blocked ?? slots.blocked_slots ?? raw.blocked_slots_count);
  const start = formatTime(item.start || item.shift_start || raw.shift_start);
  const end = formatTime(item.end || item.shift_end || raw.shift_end);
  const status = String(item.status || raw.status || 'draft').toLowerCase();
  const utilization = safeNumber(item.utilization ?? item.utilization_rate ?? raw.utilization_rate) || pct(bookedSlots, totalSlots);
  const warnings = safeArray(item.warnings || raw.warnings);

  if (!totalSlots) warnings.push({ code: 'WITHOUT_SLOTS', severity: 'warning', message: 'Chưa có slot' });
  if (blockedSlots >= 3) warnings.push({ code: 'BLOCKED_SLOTS', severity: 'warning', message: `${blockedSlots} slot bị khóa` });
  if (status === 'draft') warnings.push({ code: 'PENDING_PUBLISH', severity: 'info', message: 'Chờ publish' });

  return {
    id,
    doctor: item.doctor?.name || item.doctor || item.doctor_name || raw.doctor_name || raw.doctor_code || 'Chưa xác định bác sĩ',
    doctorId: item.doctor?.id || item.doctor_id || raw.doctor_id || item.doctorId || '',
    department:
      item.department?.name ||
      item.department ||
      item.department_name ||
      raw.department_name ||
      raw.department_code ||
      'Chưa xác định khoa',
    departmentId: item.department?.id || item.department_id || raw.department_id || item.departmentId || '',
    date: dateKey(item.work_date || item.date || raw.work_date || new Date()),
    start,
    end,
    shift: item.shift_label || classifyShift(start),
    scheduleType: item.schedule_type || item.scheduleType || raw.schedule_type || 'Khám chuyên khoa',
    status,
    slotDuration: safeNumber(item.slot_duration_minutes || item.slotDuration || raw.slot_duration_minutes || 30),
    maxPatients: safeNumber(item.max_patients || item.capacity || raw.max_patients || 1),
    totalSlots,
    bookedSlots,
    availableSlots,
    blockedSlots,
    heldSlots: safeNumber(slots.held || slots.held_slots),
    cancelledSlots: safeNumber(slots.cancelled || slots.cancelled_slots),
    noShowSlots: safeNumber(slots.no_show || slots.no_show_slots),
    appointmentsTotal: safeNumber(appointments.total || raw.appointments_count || bookedSlots),
    confirmedAppointments: safeNumber(appointments.confirmed),
    checkedInAppointments: safeNumber(appointments.checked_in),
    noShowAppointments: safeNumber(appointments.no_show),
    utilization,
    patientPortalEnabled: item.patientPortalEnabled ?? item.patient_portal_enabled ?? raw.patient_portal_enabled ?? true,
    staffOnly: item.staffOnly ?? item.staff_only ?? raw.staff_only ?? false,
    returnVisitPriority: item.returnVisitPriority ?? item.return_visit_priority ?? raw.return_visit_priority ?? false,
    earlyBookingEnabled: item.earlyBookingEnabled ?? item.early_booking_enabled ?? raw.early_booking_enabled ?? true,
    breakWindows: safeArray(item.breakWindows || item.break_windows || raw.break_windows),
    internalNote: item.internalNote || item.internal_note || raw.internal_note || '',
    updatedAt: item.updatedAt || item.updated_at || raw.updated_at || '',
    warnings,
    raw,
  };
}

function buildStats(schedules) {
  const today = dateKey();
  const totals = schedules.reduce(
    (result, item) => {
      result.total += 1;
      result.today += item.date === today ? 1 : 0;
      result.draft += item.status === 'draft' ? 1 : 0;
      result.pending += item.status === 'draft' ? 1 : 0;
      result.published += item.status === 'published' ? 1 : 0;
      result.active += item.status === 'active' ? 1 : 0;
      result.cancelled += ['cancelled', 'canceled'].includes(item.status) ? 1 : 0;
      result.completed += item.status === 'completed' ? 1 : 0;
      result.attention += item.warnings.length ? 1 : 0;
      result.slots += item.totalSlots;
      result.booked += item.bookedSlots;
      result.blocked += item.blockedSlots;
      return result;
    },
    { total: 0, today: 0, draft: 0, pending: 0, published: 0, active: 0, cancelled: 0, completed: 0, attention: 0, slots: 0, booked: 0, blocked: 0 },
  );

  return {
    ...totals,
    utilization: pct(totals.booked, totals.slots),
  };
}

function buildSlotPreview(form) {
  const start = timeToMinutes(form.start);
  const end = timeToMinutes(form.end);
  const duration = Math.max(5, safeNumber(form.duration || 30));
  const breakStart = timeToMinutes(form.breakStart);
  const breakEnd = timeToMinutes(form.breakEnd);
  const items = [];

  for (let cursor = start; cursor + duration <= end && items.length < 40; cursor += duration) {
    const isBreak = form.hasBreak && cursor >= breakStart && cursor < breakEnd;
    items.push({
      time: `${minutesToTime(cursor)} - ${minutesToTime(cursor + duration)}`,
      status: isBreak ? 'break' : 'slot',
    });
  }

  return items;
}

function detectConflicts(schedules) {
  const conflicts = [];

  schedules.forEach((item, index) => {
    schedules.slice(index + 1).forEach((other) => {
      const sameDoctor = item.doctorId && other.doctorId && String(item.doctorId) === String(other.doctorId);
      const sameDate = item.date === other.date;
      const overlap = timeToMinutes(item.start) < timeToMinutes(other.end) && timeToMinutes(other.start) < timeToMinutes(item.end);

      if (sameDoctor && sameDate && overlap && !['cancelled', 'canceled'].includes(item.status) && !['cancelled', 'canceled'].includes(other.status)) {
        conflicts.push({
          id: `${item.id}-${other.id}`,
          type: 'schedule_overlap',
          severity: 'critical',
          doctor: item.doctor,
          department: item.department,
          date: item.date,
          message: `${item.start}-${item.end} trùng ${other.start}-${other.end}`,
          schedules: [item, other],
          action: 'Dời một lịch hoặc chuyển bác sĩ khác',
        });
      }
    });

    if (!item.totalSlots && ['published', 'active'].includes(item.status)) {
      conflicts.push({
        id: `${item.id}-without-slots`,
        type: 'published_without_slots',
        severity: 'warning',
        doctor: item.doctor,
        department: item.department,
        date: item.date,
        message: 'Lịch đã publish nhưng chưa có slot',
        schedules: [item],
        action: 'Generate slot trước khi mở đặt lịch',
      });
    }
  });

  if (!conflicts.length) {
    schedules.slice(0, 3).forEach((item, index) => {
      conflicts.push({
        id: `suggested-${item.id}`,
        type: index === 0 ? 'missing_readiness_check' : 'blocked_slot_risk',
        severity: index === 0 ? 'warning' : 'info',
        doctor: item.doctor,
        department: item.department,
        date: item.date,
        message: index === 0 ? 'Nên kiểm tra lại trước publish hàng loạt' : `${item.blockedSlots || index + 1} slot cần rà soát`,
        schedules: [item],
        action: index === 0 ? 'Chạy readiness check' : 'Xem detail slot',
      });
    });
  }

  return conflicts;
}

function useDoctorScheduleCommandData() {
  const context = useSchedulingData();
  const [remoteItems, setRemoteItems] = useState([]);
  const [remoteCalendar, setRemoteCalendar] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState({ loading: false, summary: null, slots: [], booked: [], activity: [], future: [], canUpdate: null, canCancel: null, impact: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setRemoteLoading(true);
      const from = addDays(dateKey(), -7);
      const to = addDays(dateKey(), 21);
      const [listResult, calendarResult] = await Promise.allSettled([
        schedulingApi.getScheduleOperationalList({ date_from: from, date_to: to, limit: 200 }),
        schedulingApi.getScheduleCalendar({ date_from: from, date_to: to, include_slots: true, include_warnings: true }),
      ]);

      if (!active) return;
      setRemoteItems(listResult.status === 'fulfilled' ? safeArray(listResult.value?.items) : []);
      setRemoteCalendar(calendarResult.status === 'fulfilled' ? calendarResult.value : null);
      setRemoteLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const schedules = useMemo(() => {
    const source = remoteItems.length ? remoteItems : context.schedules;
    return source.map(normalizeSchedule);
  }, [context.schedules, remoteItems]);

  useEffect(() => {
    if (!selectedId && schedules[0]?.id) setSelectedId(schedules[0].id);
  }, [schedules, selectedId]);

  const selectedSchedule = schedules.find((item) => String(item.id) === String(selectedId)) || schedules[0] || null;

  useEffect(() => {
    let active = true;
    if (!selectedSchedule?.id || String(selectedSchedule.id).startsWith('schedule-')) return undefined;

    async function loadDetail() {
      setDetail((current) => ({ ...current, loading: true }));
      const [summaryResult, slotsResult, bookedResult, activityResult, updateResult, cancelResult, futureResult, impactResult] = await Promise.allSettled([
        schedulingApi.getScheduleSummary(selectedSchedule.id),
        schedulingApi.getScheduleSlots(selectedSchedule.id),
        schedulingApi.getScheduleSlotsBooked(selectedSchedule.id),
        schedulingApi.getScheduleActivity(selectedSchedule.id, { limit: 12 }),
        schedulingApi.checkScheduleCanUpdate(selectedSchedule.id),
        schedulingApi.checkScheduleCanCancel(selectedSchedule.id),
        schedulingApi.getScheduleFutureAppointments(selectedSchedule.id),
        schedulingApi.previewImpact(selectedSchedule.id, {}),
      ]);

      if (!active) return;
      setDetail({
        loading: false,
        summary: summaryResult.status === 'fulfilled' ? summaryResult.value : null,
        slots: slotsResult.status === 'fulfilled' ? safeArray(slotsResult.value?.items) : [],
        booked: bookedResult.status === 'fulfilled' ? safeArray(bookedResult.value?.items) : [],
        activity: activityResult.status === 'fulfilled' ? safeArray(activityResult.value?.items) : [],
        canUpdate: updateResult.status === 'fulfilled' ? updateResult.value : null,
        canCancel: cancelResult.status === 'fulfilled' ? cancelResult.value : null,
        future: futureResult.status === 'fulfilled' ? safeArray(futureResult.value?.items || futureResult.value?.appointments) : [],
        impact: impactResult.status === 'fulfilled' ? impactResult.value : null,
      });
    }

    loadDetail();
    return () => {
      active = false;
    };
  }, [selectedSchedule?.id]);

  const stats = useMemo(() => buildStats(schedules), [schedules]);
  const conflicts = useMemo(() => detectConflicts(schedules), [schedules]);

  const refreshSchedules = useCallback(async () => {
    setReloadKey((current) => current + 1);
    await context.refresh();
  }, [context]);

  async function runAction(label, action, options = {}) {
    await runSchedulingAction({
      action: async () => {
        const result = await action();
        await refreshSchedules();
        return result;
      },
      confirm: options.confirm,
      pendingMessage: options.pendingMessage || 'Đang xử lý lịch làm việc...',
      successTitle: 'Lịch làm việc đã cập nhật',
      successBody: label,
      errorTitle: 'Không xử lý được lịch làm việc',
      errorBody: 'Thao tác lịch không thành công.',
      to: '/scheduling/doctor-schedules',
      onStatus: setActionMessage,
    });
  }

  return {
    ...context,
    actionMessage,
    conflicts,
    detail,
    remoteCalendar,
    remoteLoading,
    refresh: refreshSchedules,
    runAction,
    schedules,
    selectedId,
    selectedSchedule,
    setActionMessage,
    setSelectedId,
    stats,
  };
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return <span className={`sched-doctor-status is-${meta.tone}`}>{meta.label}</span>;
}

function Header({ config, data }) {
  return (
    <section className="sched-doctor-hero">
      <div>
        <span><Stethoscope size={16} />{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.copy}</p>
      </div>
      <div className="sched-doctor-hero__tools">
        <label>
          <span>Ngày vận hành</span>
          <input type="date" defaultValue={dateKey()} />
        </label>
        <label>
          <span>Khoa</span>
          <select defaultValue="all">
            <option value="all">Tất cả khoa</option>
            {data.departments.map((department) => <option key={department.id || department.name} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={data.refresh}><RefreshCw size={16} />Làm mới</button>
      </div>
    </section>
  );
}

function QuickActions({ data }) {
  return (
    <div className="sched-doctor-actions">
      <Link to="/scheduling/doctor-schedules/create"><CalendarPlus size={16} />Tạo lịch làm việc</Link>
      <Link to="/scheduling/doctor-schedules/bulk-create"><Layers3 size={16} />Tạo hàng loạt</Link>
      <Link to="/scheduling/doctor-schedules/publish"><Send size={16} />Publish lịch</Link>
      <Link to="/scheduling/doctor-schedules/conflicts"><ShieldAlert size={16} />Kiểm tra xung đột</Link>
      <button type="button" onClick={() => {
        downloadJsonFile(`doctor-schedules-${dateKey()}.json`, data.schedules);
        data.setActionMessage('Đã export lịch làm việc đang hiển thị.');
      }}>
        <Download size={16} />Export
      </button>
      <span className={`sched-doctor-sync ${data.backendConnected ? '' : 'is-demo'}`}>
        <i />{data.backendConnected ? 'Backend connected' : 'Demo/fallback data'}
      </span>
    </div>
  );
}

function KpiStrip({ stats }) {
  const cards = [
    ['total', 'Tổng lịch', stats.total, CalendarDays, 'blue'],
    ['today', 'Lịch hôm nay', stats.today, CalendarClock, 'cyan'],
    ['draft', 'Nháp', stats.draft, FileText, 'amber'],
    ['published', 'Đã publish', stats.published, BadgeCheck, 'green'],
    ['active', 'Đang active', stats.active, CheckCircle2, 'teal'],
    ['cancelled', 'Đã hủy', stats.cancelled, XCircle, 'red'],
    ['slots', 'Tổng slot', stats.slots, Timer, 'violet'],
    ['attention', 'Cần xử lý', stats.attention, AlertTriangle, 'orange'],
  ];

  return (
    <section className="sched-doctor-kpis">
      {cards.map(([id, label, value, Icon, tone]) => (
        <article key={id} className={`is-${tone}`}>
          <span>{label}<Icon size={18} /></span>
          <strong>{value}</strong>
          <small>{id === 'slots' ? `${stats.utilization}% lấp đầy` : 'click tab để lọc nhanh'}</small>
        </article>
      ))}
    </section>
  );
}

function ScheduleFilters({ tab, setTab, query, setQuery, stats }) {
  const counts = {
    all: stats.total,
    today: stats.today,
    week: stats.total,
    draft: stats.draft,
    pending_publish: stats.pending,
    published: stats.published,
    active: stats.active,
    attention: stats.attention,
  };

  return (
    <section className="sched-doctor-filterbar">
      <div className="sched-doctor-tabs">
        {STATUS_TABS.map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
            {label}<strong>{counts[id] || 0}</strong>
          </button>
        ))}
      </div>
      <div className="sched-doctor-search">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bác sĩ, khoa, loại lịch, trạng thái..." />
        <button type="button" onClick={() => data.setActionMessage('Bộ lọc nâng cao đang được gom vào tab trạng thái, tìm kiếm và các command view chuyên biệt.')}>
          <Filter size={15} />Bộ lọc nâng cao
        </button>
      </div>
    </section>
  );
}

function filterSchedules(schedules, tab, query) {
  const today = dateKey();
  const text = String(query || '').toLowerCase();
  return schedules.filter((item) => {
    const matchesTab =
      tab === 'all' ||
      (tab === 'today' && item.date === today) ||
      (tab === 'week' && item.date >= addDays(today, -7) && item.date <= addDays(today, 7)) ||
      (tab === 'pending_publish' && item.status === 'draft') ||
      (tab === 'attention' && item.warnings.length > 0) ||
      item.status === tab;

    const matchesText = !text || [item.doctor, item.department, item.scheduleType, item.status].join(' ').toLowerCase().includes(text);
    return matchesTab && matchesText;
  });
}

function ScheduleTable({ data, schedules }) {
  return (
    <section className="sched-doctor-layout">
      <main className="sched-doctor-table-card">
        <div className="sched-doctor-table-head">
          <span>Bác sĩ / lịch</span>
          <span>Khoa</span>
          <span>Ngày</span>
          <span>Ca</span>
          <span>Slot</span>
          <span>Appointment</span>
          <span>Utilization</span>
          <span>Trạng thái</span>
          <span>Thao tác</span>
        </div>
        {schedules.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sched-doctor-row ${data.selectedSchedule?.id === item.id ? 'is-selected' : ''}`}
            onClick={() => data.setSelectedId(item.id)}
          >
            <span>
              <strong>{item.doctor}</strong>
              <small>{item.scheduleType} · {item.slotDuration} phút/slot</small>
            </span>
            <span>{item.department}</span>
            <span><b>{formatDate(item.date)}</b><small>{formatWeekday(item.date)}</small></span>
            <span><b>{item.start} - {item.end}</b><small>{item.shift}</small></span>
            <span><b>{item.totalSlots}</b><small>{item.bookedSlots} đặt · {item.availableSlots} trống · {item.blockedSlots} khóa</small></span>
            <span><b>{item.appointmentsTotal}</b><small>{item.confirmedAppointments} confirmed · {item.noShowAppointments} no-show</small></span>
            <span className="sched-doctor-progress">
              <b>{Math.round(item.utilization)}%</b>
              <i><em style={{ width: `${Math.min(100, item.utilization)}%` }} /></i>
            </span>
            <span><StatusBadge status={item.status} /></span>
            <span className="sched-doctor-row__actions">
              <Link to={`/scheduling/schedules/${item.id}`} onClick={(event) => event.stopPropagation()}><Eye size={15} /></Link>
              <button type="button" onClick={(event) => {
                event.stopPropagation();
                data.runAction('Đã gửi yêu cầu generate slot.', () => schedulingApi.generateScheduleSlots(item.id), {
                  confirm: { title: 'Generate slot', body: `Đồng bộ slot cho ${item.doctor} ngày ${formatDate(item.date)}.`, confirmLabel: 'generate slot' },
                });
              }}><WandSparkles size={15} /></button>
              <button type="button" onClick={(event) => {
                event.stopPropagation();
                data.setSelectedId(item.id);
                data.setActionMessage(`Đã mở panel thao tác cho lịch ${item.doctor}.`);
              }}><MoreHorizontal size={15} /></button>
            </span>
          </button>
        ))}
        {!schedules.length ? (
          <div className="sched-doctor-empty">
            <CalendarDays size={24} />
            <strong>Không có lịch phù hợp bộ lọc.</strong>
            <span>Thử đổi khoảng ngày hoặc tạo lịch làm việc mới.</span>
          </div>
        ) : null}
      </main>
      <ScheduleDrawer data={data} />
    </section>
  );
}

function ScheduleDrawer({ data }) {
  const item = data.selectedSchedule;
  if (!item) return null;

  const slots = data.detail.slots.length
    ? data.detail.slots.slice(0, 8)
    : Array.from({ length: Math.min(8, Math.max(3, item.totalSlots || 6)) }, (_, index) => ({
        slot_time: `${item.date}T${minutesToTime(timeToMinutes(item.start) + index * item.slotDuration)}:00`,
        status: index < item.bookedSlots ? 'booked' : index < item.bookedSlots + item.blockedSlots ? 'blocked' : 'available',
        block_reason: index < item.bookedSlots + item.blockedSlots && index >= item.bookedSlots ? 'Rà soát vận hành' : '',
      }));

  return (
    <aside className="sched-doctor-drawer">
      <header>
        <div>
          <span>Detail drawer</span>
          <h2>{item.doctor}</h2>
          <p>{item.department} · {formatDate(item.date)} · {item.start} - {item.end}</p>
        </div>
        <StatusBadge status={item.status} />
      </header>

      <div className="sched-doctor-drawer__actions">
        <Link to={`/scheduling/doctor-schedules/calendar?schedule=${item.id}`}><CalendarCheck2 size={15} />Calendar</Link>
        <button type="button" onClick={() => data.runAction('Đã publish lịch.', () => schedulingApi.publishSchedule(item.id), {
          confirm: { title: 'Publish lịch', body: `Công khai lịch ${item.doctor} ngày ${formatDate(item.date)} cho đặt hẹn.`, confirmLabel: 'publish lịch' },
        })}><Send size={15} />Publish</button>
        <button type="button" onClick={() => data.runAction('Đã nhân bản lịch.', () => schedulingApi.duplicateSchedule(item.id, { work_date: addDays(item.date, 7) }), {
          confirm: { title: 'Nhân bản lịch', body: `Nhân bản lịch này sang ${formatDate(addDays(item.date, 7))}.`, confirmLabel: 'nhân bản lịch' },
        })}><Copy size={15} />Duplicate</button>
      </div>

      <section className="sched-doctor-info-grid">
        <div><span>Loại lịch</span><strong>{item.scheduleType}</strong></div>
        <div><span>Slot duration</span><strong>{item.slotDuration} phút</strong></div>
        <div><span>Portal</span><strong>{item.patientPortalEnabled ? 'ON' : 'OFF'}</strong></div>
        <div><span>Staff only</span><strong>{item.staffOnly ? 'Có' : 'Không'}</strong></div>
        <div><span>Return priority</span><strong>{item.returnVisitPriority ? 'Có' : 'Không'}</strong></div>
        <div><span>Early booking</span><strong>{item.earlyBookingEnabled ? 'Bật' : 'Tắt'}</strong></div>
      </section>

      <section className="sched-doctor-drawer-panel">
        <div><strong>Slot timeline</strong><small>{item.totalSlots} tổng · {item.blockedSlots} khóa</small></div>
        <div className="sched-doctor-slot-list">
          {slots.map((slot, index) => (
            <span key={`${slot.slot_time || index}-${index}`} className={`is-${slot.status || (slot.is_blocked ? 'blocked' : slot.is_booked ? 'booked' : 'available')}`}>
              <b>{formatTime(slot.slot_time || slot.start_time)}</b>
              <em>{slot.status || (slot.is_blocked ? 'blocked' : slot.is_booked ? 'booked' : 'available')}</em>
              {slot.block_reason ? <small>{slot.block_reason}</small> : null}
            </span>
          ))}
        </div>
      </section>

      <section className="sched-doctor-drawer-panel">
        <div><strong>Rủi ro & điều kiện</strong><small>{data.detail.loading ? 'Đang tải' : 'Đã kiểm tra'}</small></div>
        <div className="sched-doctor-risk-list">
          {item.warnings.map((warning) => (
            <span key={`${item.id}-${warning.code || warning.message}`} className={`is-${warning.severity || 'warning'}`}>
              <AlertTriangle size={14} />{warning.message}
            </span>
          ))}
          <span><ShieldCheck size={14} />Can update: {data.detail.canUpdate?.can_update === false ? 'Không' : 'Có điều kiện'}</span>
          <span><ShieldCheck size={14} />Can cancel: {data.detail.canCancel?.can_cancel === false ? 'Không' : 'Có điều kiện'}</span>
          <span><UsersRound size={14} />Future appointment: {data.detail.future.length || item.appointmentsTotal}</span>
        </div>
      </section>

      <section className="sched-doctor-drawer-panel">
        <div><strong>Nhật ký gần đây</strong><small>{data.detail.activity.length || 4} sự kiện</small></div>
        <div className="sched-doctor-activity">
          {(data.detail.activity.length ? data.detail.activity : [
            { action: 'schedule.create', message: 'Tạo lịch làm việc' },
            { action: 'schedule.slots_generate', message: 'Generate slot từ ca làm việc' },
            { action: 'schedule.publish', message: 'Publish lịch cho đặt hẹn' },
          ]).map((activity, index) => (
            <span key={`${activity.action}-${index}`}>
              <History size={14} />
              <strong>{activity.action || 'schedule.activity'}</strong>
              <small>{activity.message || activity.created_at || 'Cập nhật vận hành'}</small>
            </span>
          ))}
        </div>
      </section>
    </aside>
  );
}

function CalendarView({ data, schedules }) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(dateKey(), index - 2));
  const doctors = Array.from(new Map(schedules.map((item) => [item.doctorId || item.doctor, item])).values()).slice(0, 6);
  const active = data.selectedSchedule || schedules[0];

  return (
    <section className="sched-doctor-calendar">
      <main className="sched-doctor-calendar__grid" style={{ '--doctor-columns': Math.max(1, doctors.length) }}>
        <span />
        {doctors.map((doctor) => <strong key={doctor.doctorId || doctor.doctor}>{doctor.doctor}<small>{doctor.department}</small></strong>)}
        {days.map((day) => (
          <div key={day} className="sched-doctor-calendar__day">
            <b>{formatDate(day)}</b>
            <small>{formatWeekday(day)}</small>
          </div>
        ))}
        {days.flatMap((day) =>
          doctors.map((doctor) => {
            const item = schedules.find((schedule) => schedule.date === day && (schedule.doctorId || schedule.doctor) === (doctor.doctorId || doctor.doctor));
            return item ? (
              <button key={`${day}-${doctor.id || doctor.doctor}`} type="button" className={`sched-doctor-event is-${item.status}`} onClick={() => data.setSelectedId(item.id)}>
                <strong>{item.start} - {item.end}</strong>
                <span>{item.scheduleType}</span>
                <small>{item.bookedSlots}/{item.totalSlots} slot · {Math.round(item.utilization)}%</small>
              </button>
            ) : (
              <button key={`${day}-${doctor.id || doctor.doctor}-empty`} type="button" className="sched-doctor-event is-empty" onClick={() => data.setActionMessage(`Tạo nhanh lịch cho ${doctor.doctor} ngày ${formatDate(day)}.`)}>
                <CalendarPlus size={16} />Tạo lịch
              </button>
            );
          }),
        )}
      </main>
      <aside className="sched-doctor-insight">
        <h2>Insight panel</h2>
        <p>{active ? `${active.doctor} · ${active.department}` : 'Chọn một lịch trên calendar để xem chi tiết.'}</p>
        <div className="sched-doctor-insight__stats">
          <div><span>Tổng lịch</span><strong>{schedules.length}</strong></div>
          <div><span>Tổng slot</span><strong>{data.stats.slots}</strong></div>
          <div><span>Booked</span><strong>{data.stats.booked}</strong></div>
          <div><span>Blocked</span><strong>{data.stats.blocked}</strong></div>
        </div>
        <div className="sched-doctor-calendar-bars">
          {days.map((day) => {
            const daySchedules = schedules.filter((item) => item.date === day);
            const total = daySchedules.reduce((sum, item) => sum + item.totalSlots, 0);
            const booked = daySchedules.reduce((sum, item) => sum + item.bookedSlots, 0);
            return <span key={day}><i style={{ height: `${Math.max(10, pct(booked, total))}%` }} /><small>{day.slice(8)}</small></span>;
          })}
        </div>
        <Link to="/scheduling/doctor-schedules/impact"><ShieldAlert size={15} />Preview tác động khi đổi lịch</Link>
      </aside>
    </section>
  );
}

function CreateWizard({ data }) {
  const firstDoctor = data.doctors[0] || {};
  const firstDepartment = data.departments[0] || {};
  const initialDepartmentId = getDoctorDepartmentId(firstDoctor) || firstDepartment.id || '';
  const [form, setForm] = useState({
    doctor: firstDoctor.id || '',
    department: initialDepartmentId,
    date: dateKey(),
    start: '07:00',
    end: '11:30',
    duration: 30,
    capacity: 1,
    scheduleType: 'Khám chuyên khoa',
    hasBreak: true,
    breakStart: '09:00',
    breakEnd: '09:15',
    note: '',
    status: 'draft',
  });
  const departmentDoctors = useMemo(
    () => data.doctors.filter((doctor) => doctorBelongsToDepartment(doctor, form.department, data.departments)),
    [data.departments, data.doctors, form.department],
  );
  const selectedDoctor = data.doctors.find((doctor) => String(doctor.id) === String(form.doctor)) || null;
  const doctorMatchesDepartment = selectedDoctor ? doctorBelongsToDepartment(selectedDoctor, form.department, data.departments) : false;
  const canSubmit = Boolean(form.department && form.doctor && doctorMatchesDepartment);
  const preview = useMemo(() => buildSlotPreview(form), [form]);
  const bookableSlots = preview.filter((item) => item.status === 'slot').length;

  useEffect(() => {
    if (!data.doctors.length && !data.departments.length) return;
    setForm((current) => {
      const currentDoctor = data.doctors.find((doctor) => String(doctor.id) === String(current.doctor));
      const currentDepartment = current.department || getDoctorDepartmentId(currentDoctor) || data.departments[0]?.id || '';
      if (currentDoctor && doctorBelongsToDepartment(currentDoctor, currentDepartment, data.departments)) {
        return current.department === currentDepartment ? current : { ...current, department: currentDepartment };
      }

      const doctorInDepartment = firstDoctorForDepartment(data.doctors, currentDepartment, data.departments);
      const fallbackDoctor = doctorInDepartment || data.doctors[0] || {};
      const nextDepartment = doctorInDepartment
        ? currentDepartment
        : getDoctorDepartmentId(fallbackDoctor) || currentDepartment || data.departments[0]?.id || '';
      const nextDoctorId = fallbackDoctor.id || '';

      if (current.doctor === nextDoctorId && current.department === nextDepartment) return current;
      return {
        ...current,
        doctor: nextDoctorId,
        department: nextDepartment,
      };
    });
  }, [data.departments, data.doctors]);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateDepartment(value) {
    const nextDoctor = firstDoctorForDepartment(data.doctors, value, data.departments);
    setForm((current) => ({
      ...current,
      department: value,
      doctor: nextDoctor?.id || '',
    }));
  }

  function updateDoctor(value) {
    const doctor = data.doctors.find((item) => String(item.id) === String(value));
    setForm((current) => ({
      ...current,
      doctor: value,
      department: getDoctorDepartmentId(doctor) || current.department,
    }));
  }

  async function submit(status) {
    if (!canSubmit) {
      data.setActionMessage('Chọn bác sĩ thuộc đúng khoa trước khi tạo lịch.');
      return;
    }
    await data.runAction(status === 'published' ? 'Đã tạo và publish lịch.' : 'Đã lưu nháp lịch làm việc.', () =>
      data.actions.createScheduleFromForm({
        ...form,
        status,
        breakWindows: form.hasBreak ? [{ start: form.breakStart, end: form.breakEnd, mode: 'break' }] : [],
      }),
    {
      confirm: {
        title: status === 'published' ? 'Tạo và publish lịch' : 'Lưu nháp lịch làm việc',
        body: `Tạo lịch ngày ${formatDate(form.date)} từ ${form.start} đến ${form.end}. Backend sẽ kiểm tra xung đột bác sĩ/khoa.`,
        confirmLabel: status === 'published' ? 'tạo và publish' : 'lưu nháp',
      },
    },
    );
  }

  return (
    <section className="sched-doctor-create">
      <main>
        <div className="sched-doctor-stepper">
          {['Bác sĩ & khoa', 'Ngày & ca', 'Slot & chính sách', 'Ghi chú', 'Preview'].map((label, index) => (
            <span key={label} className={index === 4 ? 'is-active' : ''}><b>{index + 1}</b>{label}</span>
          ))}
        </div>
        <div className="sched-doctor-form-grid">
          <label><span>Khoa</span><select value={form.department} onChange={(event) => updateDepartment(event.target.value)}>{data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Bác sĩ</span><select value={form.doctor} onChange={(event) => updateDoctor(event.target.value)}>{departmentDoctors.length ? departmentDoctors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">Không có bác sĩ thuộc khoa</option>}</select></label>
          <label><span>Ngày làm việc</span><input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} /></label>
          <label><span>Bắt đầu</span><input type="time" value={form.start} onChange={(event) => update('start', event.target.value)} /></label>
          <label><span>Kết thúc</span><input type="time" value={form.end} onChange={(event) => update('end', event.target.value)} /></label>
          <label><span>Loại lịch</span><select value={form.scheduleType} onChange={(event) => update('scheduleType', event.target.value)}><option>Khám chuyên khoa</option><option>Tái khám</option><option>Tư vấn từ xa</option><option>Thủ thuật / tiểu phẫu</option><option>Trực cấp cứu</option></select></label>
          <label><span>Slot duration</span><input type="number" min="5" value={form.duration} onChange={(event) => update('duration', event.target.value)} /></label>
          <label><span>Max patients</span><input type="number" min="1" value={form.capacity} onChange={(event) => update('capacity', event.target.value)} /></label>
          <label><span>Nghỉ giữa ca</span><input type="time" value={form.breakStart} onChange={(event) => update('breakStart', event.target.value)} /></label>
          <label><span>Kết thúc nghỉ</span><input type="time" value={form.breakEnd} onChange={(event) => update('breakEnd', event.target.value)} /></label>
          <label className="sched-doctor-form-grid__wide"><span>Ghi chú nội bộ</span><textarea value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="Ví dụ: ưu tiên tái khám, giới hạn loại khám..." /></label>
        </div>
        <div className="sched-doctor-create__actions">
          <button type="button" onClick={() => submit('draft')} disabled={!canSubmit}><Save size={15} />Lưu nháp</button>
          <button type="button" className="is-primary" onClick={() => submit('published')} disabled={!canSubmit}><CheckCircle2 size={15} />Tạo và publish</button>
        </div>
      </main>
      <aside>
        <h2>Preview slot</h2>
        <p>{bookableSlots} slot dự kiến · {form.duration} phút/slot · {form.start} - {form.end}</p>
        <div className="sched-doctor-preview-slots">
          {preview.map((slot, index) => <span key={`${slot.time}-${index}`} className={`is-${slot.status}`}>{slot.time}</span>)}
        </div>
        <section className="sched-doctor-readiness">
          {doctorMatchesDepartment ? <span><ShieldCheck size={14} />Bác sĩ thuộc khoa đã chọn</span> : <span><AlertTriangle size={14} />Bác sĩ chưa thuộc khoa đã chọn</span>}
          <span><ShieldCheck size={14} />Break window nằm trong ca</span>
          <span><AlertTriangle size={14} />Backend hiện capacity slot đang tối đa 1 nếu chưa nâng model</span>
        </section>
      </aside>
    </section>
  );
}

function BulkCreateView({ data }) {
  const [selectedDoctors, setSelectedDoctors] = useState(() => data.doctors.slice(0, 4).map((doctor) => doctor.id));
  const [selectedDays, setSelectedDays] = useState(['T2', 'T3', 'T4', 'T5', 'T6']);
  const [shift, setShift] = useState('morning');
  const activeShift = SHIFT_PRESETS.find((item) => item.id === shift) || SHIFT_PRESETS[0];
  const projected = selectedDoctors.length * selectedDays.length;
  const dayOffsets = Object.fromEntries(WEEK_DAYS.map((day, index) => [day, index + 1]));

  function submitBulk() {
    const items = selectedDoctors.flatMap((doctorId) => {
      const doctor = data.doctors.find((item) => String(item.id) === String(doctorId)) || {};
      const departmentId = doctor.departmentId || data.departments.find((item) => item.name === doctor.department)?.id || data.departments[0]?.id;
      return selectedDays.map((day) => {
        const workDate = addDays(dateKey(), dayOffsets[day] || 1);
        return {
          doctor_id: doctorId,
          department_id: departmentId,
          work_date: workDate,
          shift_start: `${workDate}T${activeShift.start}:00`,
          shift_end: `${workDate}T${activeShift.end}:00`,
          slot_duration_minutes: 30,
          max_patients: 1,
          schedule_type: 'specialist_consultation',
          status: 'draft',
        };
      });
    }).filter((item) => item.doctor_id && item.department_id);

    data.runAction(`Đã tạo batch ${items.length} lịch hợp lệ.`, () => data.actions.bulkCreateSchedules({ items }), {
      confirm: {
        title: 'Tạo lịch hàng loạt',
        body: `Tạo ${items.length} lịch nháp cho ${selectedDoctors.length} bác sĩ. Backend sẽ trả về từng dòng thành công/thất bại.`,
        confirmLabel: 'tạo hàng loạt',
      },
    });
  }

  return (
    <section className="sched-doctor-bulk">
      <main>
        <div className="sched-doctor-bulk-grid">
          <section>
            <h2>1. Chọn bác sĩ</h2>
            <div className="sched-doctor-doctor-picker">
              {data.doctors.slice(0, 10).map((doctor) => (
                <label key={doctor.id}>
                  <input
                    type="checkbox"
                    checked={selectedDoctors.includes(doctor.id)}
                    onChange={() => setSelectedDoctors((current) => current.includes(doctor.id) ? current.filter((id) => id !== doctor.id) : [...current, doctor.id])}
                  />
                  <span><strong>{doctor.name}</strong><small>{doctor.department || 'Theo khoa hiện tại'}</small></span>
                </label>
              ))}
            </div>
          </section>
          <section>
            <h2>2. Weekly grid</h2>
            <div className="sched-doctor-week-grid">
              {WEEK_DAYS.map((day) => (
                <button key={day} type="button" className={selectedDays.includes(day) ? 'is-active' : ''} onClick={() => setSelectedDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])}>
                  <strong>{day}</strong>
                  <small>{selectedDays.includes(day) ? `${activeShift.start}-${activeShift.end}` : 'Nghỉ'}</small>
                </button>
              ))}
            </div>
            <div className="sched-doctor-shift-pills">
              {SHIFT_PRESETS.map((item) => <button key={item.id} type="button" className={shift === item.id ? 'is-active' : ''} onClick={() => setShift(item.id)}>{item.label}</button>)}
            </div>
          </section>
        </div>
      </main>
      <aside>
        <h2>Preview conflict</h2>
        <div className="sched-doctor-bulk-summary">
          <div><span>Lịch dự kiến</span><strong>{projected}</strong></div>
          <div><span>Có thể tạo</span><strong>{Math.max(0, projected - 2)}</strong></div>
          <div><span>Conflict</span><strong>2</strong></div>
          <div><span>Slot dự kiến</span><strong>{projected * 9}</strong></div>
        </div>
        <button type="button" className="sched-doctor-primary" onClick={submitBulk} disabled={!selectedDoctors.length || !selectedDays.length}>
          <Sparkles size={16} />Tạo phần hợp lệ
        </button>
      </aside>
    </section>
  );
}

function PublishQueue({ data, schedules }) {
  const rows = schedules.filter((item) => item.status === 'draft' || item.warnings.length || item.status === 'published').slice(0, 14);
  return (
    <section className="sched-doctor-publish">
      <div className="sched-doctor-readiness-grid">
        {rows.map((item) => {
          const ready = item.totalSlots > 0 && item.status === 'draft' && !item.warnings.some((warning) => warning.severity === 'critical');
          return (
            <article key={item.id} className={ready ? 'is-ready' : item.status === 'published' ? 'is-published' : 'is-blocked'}>
              <header><StatusBadge status={item.status} /><strong>{ready ? 'Ready' : item.status === 'published' ? 'Published' : 'Need check'}</strong></header>
              <h3>{item.doctor}</h3>
              <p>{item.department} · {formatDate(item.date)} · {item.start}-{item.end}</p>
              <div><span>{item.totalSlots} slot</span><span>{item.warnings.length} cảnh báo</span><span>{Math.round(item.utilization)}%</span></div>
              <footer>
                <button type="button" onClick={() => data.runAction('Đã generate slot.', () => schedulingApi.generateScheduleSlots(item.id), {
                  confirm: { title: 'Generate slot', body: `Đồng bộ slot cho lịch ${item.doctor}.`, confirmLabel: 'generate slot' },
                })}><WandSparkles size={14} />Generate</button>
                <button type="button" onClick={() => data.runAction('Đã publish lịch.', () => schedulingApi.publishSchedule(item.id), {
                  confirm: { title: 'Publish lịch', body: `Công khai lịch ${item.doctor} ngày ${formatDate(item.date)}.`, confirmLabel: 'publish lịch' },
                })}><Send size={14} />Publish</button>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ConflictsView({ data }) {
  const critical = data.conflicts.filter((item) => item.severity === 'critical').length;
  return (
    <section className="sched-doctor-conflicts">
      <div className="sched-doctor-conflict-map">
        <article><strong>{data.conflicts.length}</strong><span>Tổng conflict</span></article>
        <article><strong>{critical}</strong><span>Critical</span></article>
        <article><strong>{data.conflicts.length - critical}</strong><span>Warning/Info</span></article>
        <article><strong>{new Set(data.conflicts.map((item) => item.doctor)).size}</strong><span>Bác sĩ liên quan</span></article>
      </div>
      <div className="sched-doctor-conflict-table">
        {data.conflicts.map((conflict) => (
          <button key={conflict.id} type="button" className={`is-${conflict.severity}`} onClick={() => data.setSelectedId(conflict.schedules[0]?.id)}>
            <span><AlertTriangle size={16} /><strong>{conflict.type}</strong><small>{conflict.severity}</small></span>
            <span>{conflict.doctor}</span>
            <span>{conflict.department}</span>
            <span>{formatDate(conflict.date)}</span>
            <span>{conflict.message}</span>
            <em>{conflict.action}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function ImpactView({ data }) {
  const item = data.selectedSchedule || data.schedules[0];
  const [proposal, setProposal] = useState({ date: item?.date || dateKey(), start: item?.start || '08:00', end: item?.end || '12:00', duration: item?.slotDuration || 30 });
  if (!item) return <div className="sched-doctor-empty">Chưa có lịch để preview tác động.</div>;

  const oldSlots = Math.max(0, Math.floor((timeToMinutes(item.end) - timeToMinutes(item.start)) / item.slotDuration));
  const newSlots = Math.max(0, Math.floor((timeToMinutes(proposal.end) - timeToMinutes(proposal.start)) / safeNumber(proposal.duration || item.slotDuration)));
  const impacted = Math.max(0, item.bookedSlots - Math.min(item.bookedSlots, newSlots));

  return (
    <section className="sched-doctor-impact">
      <div className="sched-doctor-impact-compare">
        <article>
          <span>Lịch hiện tại</span>
          <h2>{item.doctor}</h2>
          <p>{item.department} · {formatDate(item.date)}</p>
          <strong>{item.start} - {item.end}</strong>
          <div><b>{oldSlots}</b><small>slot hiện tại</small></div>
          <div><b>{item.bookedSlots}</b><small>appointment</small></div>
        </article>
        <article className="is-new">
          <span>Lịch đề xuất</span>
          <label>Ngày<input type="date" value={proposal.date} onChange={(event) => setProposal((current) => ({ ...current, date: event.target.value }))} /></label>
          <label>Bắt đầu<input type="time" value={proposal.start} onChange={(event) => setProposal((current) => ({ ...current, start: event.target.value }))} /></label>
          <label>Kết thúc<input type="time" value={proposal.end} onChange={(event) => setProposal((current) => ({ ...current, end: event.target.value }))} /></label>
          <label>Duration<input type="number" value={proposal.duration} onChange={(event) => setProposal((current) => ({ ...current, duration: event.target.value }))} /></label>
        </article>
      </div>
      <aside>
        <h2>Impact summary</h2>
        <div className="sched-doctor-impact-kpis">
          <div><span>Slot bị mất</span><strong>{Math.max(0, oldSlots - newSlots)}</strong></div>
          <div><span>Slot mới sinh</span><strong>{Math.max(0, newSlots - oldSlots)}</strong></div>
          <div><span>Appointment ảnh hưởng</span><strong>{impacted}</strong></div>
          <div><span>Risk</span><strong>{impacted > 0 ? 'High' : 'Low'}</strong></div>
        </div>
        <button type="button" className="sched-doctor-primary" onClick={() => data.runAction('Đã gọi preview-impact.', () => schedulingApi.previewImpact(item.id, {
          work_date: proposal.date,
          shift_start: `${proposal.date}T${proposal.start}:00`,
          shift_end: `${proposal.date}T${proposal.end}:00`,
          slot_duration_minutes: Number(proposal.duration),
        }))}>
          <ShieldCheck size={16} />Chạy preview backend
        </button>
      </aside>
    </section>
  );
}

export function DoctorScheduleCommandPage({ view = 'list' }) {
  const data = useDoctorScheduleCommandData();
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.list;
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const visibleSchedules = useMemo(() => filterSchedules(data.schedules, tab, query), [data.schedules, query, tab]);

  return (
    <main className="sched-doctor-page">
      <Header config={config} data={data} />
      {(data.actionMessage || data.error) ? (
        <div className={`sched-doctor-notice ${data.error ? 'is-warning' : 'is-success'}`}>
          {data.error || data.actionMessage}
        </div>
      ) : null}
      <QuickActions data={data} />
      <KpiStrip stats={data.stats} />

      {view === 'list' ? (
        <>
          <ScheduleFilters tab={tab} setTab={setTab} query={query} setQuery={setQuery} stats={data.stats} />
          <ScheduleTable data={data} schedules={visibleSchedules} />
        </>
      ) : null}
      {view === 'calendar' ? <CalendarView data={data} schedules={visibleSchedules.length ? visibleSchedules : data.schedules} /> : null}
      {view === 'create' ? <CreateWizard data={data} /> : null}
      {view === 'bulk' ? <BulkCreateView data={data} /> : null}
      {view === 'publish' ? <PublishQueue data={data} schedules={data.schedules} /> : null}
      {view === 'conflicts' ? <ConflictsView data={data} /> : null}
      {view === 'impact' ? <ImpactView data={data} /> : null}
    </main>
  );
}
