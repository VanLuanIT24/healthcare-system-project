import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

function isObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ''));
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

  return conflicts;
}

function normalizeConflict(item = {}, schedules = []) {
  const scheduleIds = safeArray(item.schedule_ids || item.schedules)
    .map((value) => value?.schedule_id || value?.id || value)
    .filter(Boolean);
  const matchedSchedules = scheduleIds
    .map((scheduleId) => schedules.find((schedule) => String(schedule.id) === String(scheduleId)))
    .filter(Boolean);
  const fallbackSchedule = matchedSchedules[0] || schedules.find((schedule) => (
    (item.doctor_id && String(schedule.doctorId) === String(item.doctor_id)) &&
    dateKey(schedule.date) === dateKey(item.work_date)
  ));

  return {
    id: item.id || `${item.type || 'conflict'}-${scheduleIds.join('-') || item.work_date || Date.now()}`,
    type: item.type || 'schedule_conflict',
    severity: item.severity || 'warning',
    doctor: item.doctor_name || fallbackSchedule?.doctor || 'Chưa xác định bác sĩ',
    department: item.department_name || fallbackSchedule?.department || 'Chưa xác định khoa',
    date: dateKey(item.work_date || fallbackSchedule?.date || new Date()),
    message: item.message || 'Backend phát hiện lịch cần rà soát.',
    action: item.action || (item.severity === 'critical' ? 'Mở lịch liên quan để xử lý' : 'Rà soát trước khi publish'),
    schedules: matchedSchedules.length ? matchedSchedules : (fallbackSchedule ? [fallbackSchedule] : []),
    raw: item,
  };
}

function buildScheduleQuery(filters = {}) {
  const date = filters.date || dateKey();
  const query = {
    date_from: addDays(date, -7),
    date_to: addDays(date, 21),
    limit: 200,
  };
  if (filters.departmentId && filters.departmentId !== 'all') {
    query.department_id = filters.departmentId;
  }
  return query;
}

function getSlotTime(slot = {}) {
  return slot.slot_time || slot.start_time || slot.start || '';
}

function getSlotStatus(slot = {}) {
  const status = String(slot.status || '').toLowerCase();
  if (slot.is_booked || status === 'booked') return 'booked';
  if (slot.is_blocked || ['blocked', 'cancelled', 'canceled'].includes(status)) return 'blocked';
  if (status === 'held') return 'held';
  return 'available';
}

function buildScheduleUpdatePayload(proposal) {
  return {
    work_date: proposal.date,
    shift_start: `${proposal.date}T${proposal.start}:00`,
    shift_end: `${proposal.date}T${proposal.end}:00`,
    slot_duration_minutes: Number(proposal.duration),
  };
}

function useDoctorScheduleCommandData() {
  const context = useSchedulingData();
  const [searchParams] = useSearchParams();
  const [remoteItems, setRemoteItems] = useState([]);
  const [remoteCalendar, setRemoteCalendar] = useState(null);
  const [remoteConflicts, setRemoteConflicts] = useState([]);
  const [remoteError, setRemoteError] = useState('');
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(searchParams.get('schedule') || '');
  const [filters, setFilters] = useState({
    date: searchParams.get('date') || dateKey(),
    departmentId: searchParams.get('department') || 'all',
  });
  const [detail, setDetail] = useState({ loading: false, summary: null, slots: [], booked: [], activity: [], future: [], canUpdate: null, canCancel: null, impact: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setRemoteLoading(true);
      setRemoteError('');
      const query = buildScheduleQuery(filters);
      const [listResult, calendarResult, conflictResult] = await Promise.allSettled([
        schedulingApi.getScheduleOperationalList(query),
        schedulingApi.getScheduleCalendar({ ...query, include_slots: true, include_warnings: true }),
        schedulingApi.getScheduleConflicts(query),
      ]);

      if (!active) return;
      setRemoteItems(listResult.status === 'fulfilled' ? safeArray(listResult.value?.items) : []);
      setRemoteCalendar(calendarResult.status === 'fulfilled' ? calendarResult.value : null);
      setRemoteConflicts(conflictResult.status === 'fulfilled' ? safeArray(conflictResult.value?.items) : []);
      setRemoteError(
        listResult.status === 'rejected'
          ? listResult.reason?.message || 'Không tải được danh sách lịch làm việc từ backend.'
          : conflictResult.status === 'rejected'
            ? conflictResult.reason?.message || 'Không tải được conflict từ backend.'
            : '',
      );
      setRemoteLoaded(true);
      setRemoteLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  const schedules = useMemo(() => {
    return (remoteLoaded ? remoteItems : []).map(normalizeSchedule);
  }, [remoteItems, remoteLoaded]);

  const resourcesLoaded = context.backendConnected || context.createResourcesLoaded;
  const doctors = resourcesLoaded ? context.doctors : [];
  const departments = resourcesLoaded ? context.departments : [];
  const scheduleTypes = resourcesLoaded ? context.scheduleTypes : [];

  useEffect(() => {
    if (!selectedId && schedules[0]?.id) setSelectedId(schedules[0].id);
  }, [schedules, selectedId]);

  const selectedSchedule = schedules.find((item) => String(item.id) === String(selectedId)) || schedules[0] || null;

  useEffect(() => {
    let active = true;
    if (!selectedSchedule?.id || !isObjectId(selectedSchedule.id)) {
      setDetail({ loading: false, summary: null, slots: [], booked: [], activity: [], future: [], canUpdate: null, canCancel: null, impact: null });
      return undefined;
    }

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
        slots: slotsResult.status === 'fulfilled' ? safeArray(slotsResult.value?.items || slotsResult.value?.slots?.items) : [],
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
  const conflicts = useMemo(() => {
    if (remoteConflicts.length) {
      return remoteConflicts.map((item) => normalizeConflict(item, schedules));
    }
    return detectConflicts(schedules);
  }, [remoteConflicts, schedules]);

  const refreshSchedules = useCallback(async () => {
    setReloadKey((current) => current + 1);
    await context.refresh();
  }, [context]);

  async function runAction(label, action, options = {}) {
    return runSchedulingAction({
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
    backendConnected: Boolean(context.backendConnected || (remoteLoaded && !remoteError)),
    conflicts,
    departments,
    detail,
    doctors,
    error: remoteError || context.error,
    filters,
    remoteCalendar,
    remoteError,
    remoteLoaded,
    remoteLoading,
    refresh: refreshSchedules,
    runAction,
    scheduleTypes,
    schedules,
    selectedId,
    selectedSchedule,
    setActionMessage,
    setFilters,
    setSelectedId,
    stats,
  };
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return <span className={`sched-doctor-status is-${meta.tone}`}>{meta.label}</span>;
}

function Header({ config, data }) {
  function updateFilter(name, value) {
    data.setFilters((current) => ({ ...current, [name]: value }));
  }

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
          <input type="date" value={data.filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
        </label>
        <label>
          <span>Khoa</span>
          <select value={data.filters.departmentId} onChange={(event) => updateFilter('departmentId', event.target.value)}>
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
        <i />{data.backendConnected ? 'Database live' : 'Chưa kết nối API/DB'}
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

function ScheduleFilters({ data, tab, setTab, query, setQuery, stats }) {
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
        <button type="button" onClick={() => data.setActionMessage('Bộ lọc nâng cao đang dùng ngày vận hành, khoa, tab trạng thái và tìm kiếm realtime từ backend.')}>
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
          <article
            key={item.id}
            role="button"
            tabIndex={0}
            className={`sched-doctor-row ${data.selectedSchedule?.id === item.id ? 'is-selected' : ''}`}
            onClick={() => data.setSelectedId(item.id)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') data.setSelectedId(item.id); }}
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
          </article>
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

  const slots = data.detail.slots.slice(0, 12);
  const finalSchedule = ['cancelled', 'canceled', 'completed'].includes(item.status);

  function handleSlotAction(slot) {
    const status = getSlotStatus(slot);
    const slotTime = getSlotTime(slot);
    if (!slotTime || !isObjectId(item.id) || status === 'booked' || status === 'held') return;
    if (status === 'blocked') {
      data.runAction(`Đã mở lại slot ${formatTime(slotTime)}.`, () => schedulingApi.reopenSlot(item.id, {
        slot_time: slotTime,
        reason: 'Mở lại từ drawer lịch bác sĩ',
      }), {
        confirm: { title: 'Mở lại slot', body: `Mở lại slot ${formatTime(slotTime)} cho ${item.doctor}.`, confirmLabel: 'mở lại slot' },
      });
      return;
    }
    data.runAction(`Đã chặn slot ${formatTime(slotTime)}.`, () => schedulingApi.blockSlot(item.id, {
      slot_time: slotTime,
      reason: 'Khóa từ drawer lịch bác sĩ',
    }), {
      confirm: { title: 'Chặn slot', body: `Chặn slot ${formatTime(slotTime)} của ${item.doctor}.`, confirmLabel: 'chặn slot' },
    });
  }

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
        <button type="button" disabled={!isObjectId(item.id) || finalSchedule} onClick={() => data.runAction('Đã generate slot.', () => schedulingApi.generateScheduleSlots(item.id), {
          confirm: { title: 'Generate slot', body: `Đồng bộ slot cho ${item.doctor} ngày ${formatDate(item.date)}.`, confirmLabel: 'generate slot' },
        })}><WandSparkles size={15} />Generate</button>
        <button type="button" disabled={!isObjectId(item.id) || finalSchedule} onClick={() => data.runAction('Đã publish lịch.', () => schedulingApi.publishSchedule(item.id), {
          confirm: { title: 'Publish lịch', body: `Công khai lịch ${item.doctor} ngày ${formatDate(item.date)} cho đặt hẹn.`, confirmLabel: 'publish lịch' },
        })}><Send size={15} />Publish</button>
        <button type="button" disabled={!isObjectId(item.id)} onClick={() => data.runAction('Đã nhân bản lịch.', () => schedulingApi.duplicateSchedule(item.id, { work_date: addDays(item.date, 7) }), {
          confirm: { title: 'Nhân bản lịch', body: `Nhân bản lịch này sang ${formatDate(addDays(item.date, 7))}.`, confirmLabel: 'nhân bản lịch' },
        })}><Copy size={15} />Duplicate</button>
        <button type="button" disabled={!isObjectId(item.id) || data.detail.canCancel?.can_cancel === false || finalSchedule} onClick={() => data.runAction('Đã hủy lịch làm việc.', () => schedulingApi.cancelSchedule(item.id), {
          confirm: { title: 'Hủy lịch làm việc', body: `Hủy lịch ${item.doctor} ngày ${formatDate(item.date)}. Backend sẽ chặn nếu lịch còn appointment active.`, confirmLabel: 'hủy lịch' },
        })}><Ban size={15} />Hủy</button>
        <button type="button" disabled={!isObjectId(item.id) || finalSchedule} onClick={() => data.runAction('Đã hoàn tất lịch làm việc.', () => schedulingApi.completeSchedule(item.id), {
          confirm: { title: 'Hoàn tất lịch', body: `Đánh dấu hoàn tất lịch ${item.doctor} ngày ${formatDate(item.date)}.`, confirmLabel: 'hoàn tất lịch' },
        })}><ClipboardCheck size={15} />Hoàn tất</button>
        <Link to={`/scheduling/doctor-schedules/impact?schedule=${item.id}`}><ShieldAlert size={15} />Impact</Link>
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
          {slots.map((slot, index) => {
            const status = getSlotStatus(slot);
            const slotTime = getSlotTime(slot);
            return (
            <span key={`${slotTime || index}-${index}`} className={`is-${status}`}>
              <b>{formatTime(slotTime)}</b>
              <em>{status}</em>
              {slot.block_reason ? <small>{slot.block_reason}</small> : null}
              <button type="button" disabled={finalSchedule || status === 'booked' || status === 'held'} onClick={() => handleSlotAction(slot)}>
                {status === 'blocked' ? 'Mở' : 'Khóa'}
              </button>
            </span>
            );
          })}
          {!slots.length ? (
            <span className="is-empty">
              <b>Chưa có slot từ backend</b>
              <small>Generate slot để đồng bộ từ ca làm việc.</small>
            </span>
          ) : null}
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
          {data.detail.activity.map((activity, index) => (
            <span key={`${activity.action}-${index}`}>
              <History size={14} />
              <strong>{activity.action || 'schedule.activity'}</strong>
              <small>{activity.message || activity.created_at || 'Cập nhật vận hành'}</small>
            </span>
          ))}
          {!data.detail.activity.length ? <span><History size={14} /><strong>Chưa có nhật ký</strong><small>Backend chưa trả sự kiện cho lịch này.</small></span> : null}
        </div>
      </section>
    </aside>
  );
}

function CalendarView({ data, schedules }) {
  const baseDate = data.filters?.date || dateKey();
  const days = Array.from({ length: 7 }, (_, index) => addDays(baseDate, index - 2));
  const scheduleDoctors = Array.from(new Map(schedules.map((item) => [item.doctorId || item.doctor, item])).values());
  const fallbackDoctors = data.doctors.slice(0, 6).map((doctor) => ({
    doctor: doctor.name,
    doctorId: doctor.id,
    department: doctor.department || 'Theo khoa hiện tại',
    departmentId: getDoctorDepartmentId(doctor),
  }));
  const doctorTones = [
    { accent: '#0f766e', soft: '#ecfdf5', border: '#99f6e4' },
    { accent: '#2563eb', soft: '#eff6ff', border: '#bfdbfe' },
    { accent: '#7c3aed', soft: '#f5f3ff', border: '#ddd6fe' },
    { accent: '#ea580c', soft: '#fff7ed', border: '#fed7aa' },
    { accent: '#0891b2', soft: '#ecfeff', border: '#a5f3fc' },
    { accent: '#be123c', soft: '#fff1f2', border: '#fecdd3' },
  ];
  const doctors = (scheduleDoctors.length ? scheduleDoctors : fallbackDoctors).slice(0, 6).map((doctor, index) => ({
    ...doctor,
    tone: doctorTones[index % doctorTones.length],
    order: index + 1,
  }));
  const active = data.selectedSchedule || schedules[0];
  const busiestDay = days
    .map((day) => {
      const daySchedules = schedules.filter((item) => item.date === day);
      const total = daySchedules.reduce((sum, item) => sum + item.totalSlots, 0);
      const booked = daySchedules.reduce((sum, item) => sum + item.bookedSlots, 0);
      return { day, total, booked, utilization: pct(booked, total), count: daySchedules.length };
    })
    .sort((a, b) => b.booked - a.booked || b.total - a.total)[0];
  const selectedImpactUrl = active ? `/scheduling/doctor-schedules/impact?schedule=${encodeURIComponent(active.id)}` : '/scheduling/doctor-schedules/impact';

  return (
    <section className="sched-calendar-v10">
      <header className="sched-calendar-v10__hero">
        <div>
          <p className="sched-section-eyebrow">Doctor weekly command board</p>
          <h2>Lịch trực quan bác sĩ</h2>
          <p>Board tuần dạng command center: mỗi bác sĩ có một màu riêng, lịch không còn đè panel và mọi ô lịch đều có thể mở chi tiết hoặc tạo lịch mới.</p>
        </div>
        <div className="sched-calendar-v10__actions">
          <Link to="/scheduling/doctor-schedules/create"><CalendarPlus size={16} />Tạo lịch</Link>
          <Link to={selectedImpactUrl}><ShieldAlert size={16} />Preview tác động</Link>
        </div>
      </header>

      <div className="sched-calendar-v10__metrics">
        <article><span>Tổng lịch tuần</span><strong>{schedules.length}</strong><small>{doctors.length} bác sĩ hiển thị</small></article>
        <article><span>Tổng slot</span><strong>{data.stats.slots}</strong><small>{data.stats.booked} slot đã đặt</small></article>
        <article><span>Booked / Blocked</span><strong>{data.stats.booked}/{data.stats.blocked}</strong><small>Đồng bộ backend</small></article>
        <article><span>Ngày tải cao</span><strong>{busiestDay ? formatDate(busiestDay.day) : '—'}</strong><small>{busiestDay ? `${busiestDay.booked}/${busiestDay.total} slot · ${Math.round(busiestDay.utilization)}%` : 'Chưa có dữ liệu'}</small></article>
      </div>

      <div className="sched-calendar-v10__legend" aria-label="Chú giải màu bác sĩ">
        {doctors.map((doctor) => (
          <span
            key={`legend-${doctor.doctorId || doctor.doctor}`}
            style={{ '--doctor-accent': doctor.tone.accent, '--doctor-soft': doctor.tone.soft, '--doctor-border': doctor.tone.border }}
          >
            <i />
            <b>{doctor.doctor}</b>
            <small>{doctor.department}</small>
          </span>
        ))}
      </div>

      <div className="sched-calendar-v10__boardWrap">
        <div className="sched-calendar-v10__board" style={{ '--doctor-columns': Math.max(1, doctors.length) }}>
          <div className="sched-calendar-v10__cell sched-calendar-v10__corner">Ngày / Bác sĩ</div>
          {doctors.map((doctor) => (
            <div
              className="sched-calendar-v10__cell sched-calendar-v10__doctor"
              key={doctor.doctorId || doctor.doctor}
              style={{ '--doctor-accent': doctor.tone.accent, '--doctor-soft': doctor.tone.soft, '--doctor-border': doctor.tone.border }}
            >
              <span>BS {doctor.order}</span>
              <strong>{doctor.doctor}</strong>
              <small>{doctor.department}</small>
            </div>
          ))}

          {days.map((day) => (
            <Fragment key={`row-${day}`}>
              <div className="sched-calendar-v10__cell sched-calendar-v10__day">
                <b>{formatDate(day)}</b>
                <small>{formatWeekday(day)}</small>
              </div>
              {doctors.map((doctor) => {
                const doctorKey = doctor.doctorId || doctor.doctor;
                const item = schedules.find((schedule) => schedule.date === day && (schedule.doctorId || schedule.doctor) === doctorKey);
                const style = { '--doctor-accent': doctor.tone.accent, '--doctor-soft': doctor.tone.soft, '--doctor-border': doctor.tone.border };
                if (item) {
                  return (
                    <button
                      key={`${day}-${doctorKey}`}
                      type="button"
                      style={style}
                      className={`sched-calendar-v10__event is-${item.status}`}
                      onClick={() => data.setSelectedId(item.id)}
                    >
                      <span>{item.status === 'published' ? 'Đã publish' : item.status === 'draft' ? 'Nháp' : 'Active'}</span>
                      <strong>{item.start} - {item.end}</strong>
                      <b>{item.scheduleType}</b>
                      <small>{item.bookedSlots}/{item.totalSlots} slot · {Math.round(item.utilization)}%</small>
                    </button>
                  );
                }
                return (
                  <Link
                    key={`${day}-${doctorKey}-empty`}
                    style={style}
                    className="sched-calendar-v10__empty"
                    to={`/scheduling/doctor-schedules/create?doctor=${encodeURIComponent(doctor.doctorId || '')}&department=${encodeURIComponent(doctor.departmentId || '')}&date=${encodeURIComponent(day)}`}
                  >
                    <CalendarPlus size={17} />
                    <span>Tạo lịch</span>
                  </Link>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <section className="sched-calendar-v10__insights">
        <article className="sched-calendar-v10__active">
          <p className="sched-section-eyebrow">Lịch đang chọn</p>
          <h3>{active ? active.doctor : 'Chọn một lịch để xem chi tiết'}</h3>
          <span>{active ? `${active.department} · ${formatDate(active.date)} · ${active.start}-${active.end}` : 'Click vào ô lịch để mở drawer chi tiết, kiểm tra slot và preview tác động.'}</span>
        </article>
        <article className="sched-calendar-v10__chart">
          <div className="sched-calendar-v10__chartHeader">
            <strong>Tải theo ngày</strong>
            <small>Booked / tổng slot</small>
          </div>
          <div className="sched-calendar-v10__bars">
            {days.map((day) => {
              const daySchedules = schedules.filter((item) => item.date === day);
              const total = daySchedules.reduce((sum, item) => sum + item.totalSlots, 0);
              const booked = daySchedules.reduce((sum, item) => sum + item.bookedSlots, 0);
              return <span key={day}><i style={{ height: `${Math.max(10, pct(booked, total))}%` }} /><small>{day.slice(8)}</small></span>;
            })}
          </div>
        </article>
        <article className="sched-calendar-v10__hint">
          <ShieldAlert size={18} />
          <div>
            <strong>Không còn chồng layout</strong>
            <span>Insight panel đã tách xuống dưới, calendar full-width có scroll riêng và màu sắc theo từng bác sĩ.</span>
          </div>
        </article>
      </section>
    </section>
  );
}

function CreateWizard({ data }) {
  const [searchParams] = useSearchParams();
  const queryDoctorId = searchParams.get('doctor') || '';
  const queryDepartmentId = searchParams.get('department') || '';
  const queryDate = searchParams.get('date') || dateKey();
  const firstDoctor = data.doctors[0] || {};
  const firstDepartment = data.departments[0] || {};
  const initialDepartmentId = queryDepartmentId || getDoctorDepartmentId(firstDoctor) || firstDepartment.id || '';
  const [form, setForm] = useState({
    doctor: queryDoctorId || firstDoctor.id || '',
    department: initialDepartmentId,
    date: queryDate,
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
  const [backendPreview, setBackendPreview] = useState({ loading: false, data: null, error: '' });
  const departmentDoctors = useMemo(
    () => data.doctors.filter((doctor) => doctorBelongsToDepartment(doctor, form.department, data.departments)),
    [data.departments, data.doctors, form.department],
  );
  const selectedDoctor = data.doctors.find((doctor) => String(doctor.id) === String(form.doctor)) || null;
  const doctorMatchesDepartment = selectedDoctor ? doctorBelongsToDepartment(selectedDoctor, form.department, data.departments) : false;
  const preview = useMemo(() => buildSlotPreview(form), [form]);
  const backendSlotsSummary = backendPreview.data?.slots_summary || {};
  const bookableSlots = safeNumber(backendSlotsSummary.total_slots) || preview.filter((item) => item.status === 'slot').length;
  const previewWarnings = safeArray(backendPreview.data?.warnings);
  const previewConflicts = safeArray(backendPreview.data?.conflicts);
  const baseCanSubmit = Boolean(form.department && form.doctor && doctorMatchesDepartment && timeToMinutes(form.end) > timeToMinutes(form.start));
  const canSubmit = baseCanSubmit && backendPreview.data?.can_create !== false;

  useEffect(() => {
    if (!data.doctors.length && !data.departments.length) return;
    setForm((current) => {
      const requestedDoctor = queryDoctorId ? data.doctors.find((doctor) => String(doctor.id) === String(queryDoctorId)) : null;
      const currentDoctor = requestedDoctor || data.doctors.find((doctor) => String(doctor.id) === String(current.doctor));
      const currentDepartment = queryDepartmentId || current.department || getDoctorDepartmentId(currentDoctor) || data.departments[0]?.id || '';
      if (currentDoctor && doctorBelongsToDepartment(currentDoctor, currentDepartment, data.departments)) {
        return current.department === currentDepartment && current.doctor === currentDoctor.id
          ? current
          : { ...current, doctor: currentDoctor.id, department: currentDepartment, date: queryDate || current.date };
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
        date: queryDate || current.date,
      };
    });
  }, [data.departments, data.doctors, queryDate, queryDepartmentId, queryDoctorId]);

  useEffect(() => {
    let active = true;
    if (!baseCanSubmit) {
      setBackendPreview({ loading: false, data: null, error: '' });
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setBackendPreview((current) => ({ ...current, loading: true, error: '' }));
      try {
        const result = await data.actions.previewCreateScheduleFromForm({
          ...form,
          breakWindows: form.hasBreak ? [{ start: form.breakStart, end: form.breakEnd, mode: 'break' }] : [],
        });
        if (active) setBackendPreview({ loading: false, data: result, error: '' });
      } catch (error) {
        if (active) setBackendPreview({ loading: false, data: null, error: error.message || 'Backend preview thất bại.' });
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [baseCanSubmit, data.actions, form]);

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
      data.setActionMessage(backendPreview.data?.can_create === false
        ? 'Backend preview đang báo lịch chưa thể tạo. Hãy xử lý xung đột hoặc đổi khung giờ.'
        : 'Chọn bác sĩ thuộc đúng khoa và khung giờ hợp lệ trước khi tạo lịch.');
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
          <label><span>Loại lịch</span><select value={form.scheduleType} onChange={(event) => update('scheduleType', event.target.value)}>{(data.scheduleTypes.length ? data.scheduleTypes : [{ value: 'specialist_consultation', label: 'Khám chuyên khoa' }]).map((type) => <option key={type.value || type.id || type.label} value={type.value || type.id || type.label}>{type.label || type.name || type.value}</option>)}</select></label>
          <label><span>Slot duration</span><input type="number" min="5" value={form.duration} onChange={(event) => update('duration', event.target.value)} /></label>
          <label><span>Max patients</span><input type="number" min="1" value={form.capacity} onChange={(event) => update('capacity', event.target.value)} /></label>
          <label><span>Nghỉ giữa ca</span><input type="time" value={form.breakStart} onChange={(event) => update('breakStart', event.target.value)} /></label>
          <label><span>Kết thúc nghỉ</span><input type="time" value={form.breakEnd} onChange={(event) => update('breakEnd', event.target.value)} /></label>
          <label className="sched-doctor-form-grid__wide"><span>Ghi chú nội bộ</span><textarea value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="Ví dụ: ưu tiên tái khám, giới hạn loại khám..." /></label>
        </div>
        <div className="sched-doctor-create__actions">
          <button type="button" onClick={() => submit('draft')} disabled={!canSubmit || backendPreview.loading}><Save size={15} />Lưu nháp</button>
          <button type="button" className="is-primary" onClick={() => submit('published')} disabled={!canSubmit || backendPreview.loading}><CheckCircle2 size={15} />Tạo và publish</button>
        </div>
      </main>
      <aside>
        <h2>Preview slot</h2>
        <p>{bookableSlots} slot từ backend · {form.duration} phút/slot · {form.start} - {form.end}</p>
        <div className="sched-doctor-preview-slots">
          {preview.map((slot, index) => <span key={`${slot.time}-${index}`} className={`is-${slot.status}`}>{slot.time}</span>)}
        </div>
        <section className="sched-doctor-readiness">
          {doctorMatchesDepartment ? <span><ShieldCheck size={14} />Bác sĩ thuộc khoa đã chọn</span> : <span><AlertTriangle size={14} />Bác sĩ chưa thuộc khoa đã chọn</span>}
          {backendPreview.loading ? <span><RefreshCw size={14} />Đang preview bằng backend</span> : null}
          {backendPreview.error ? <span><AlertTriangle size={14} />{backendPreview.error}</span> : null}
          {backendPreview.data?.can_create ? <span><ShieldCheck size={14} />Backend cho phép tạo lịch</span> : null}
          {previewWarnings.map((warning, index) => <span key={`warning-${index}`}><AlertTriangle size={14} />{warning.message || warning.type}</span>)}
          {previewConflicts.map((conflict, index) => <span key={`conflict-${index}`}><AlertTriangle size={14} />Trùng lịch: {formatDate(conflict.work_date)} {formatTime(conflict.shift_start)}-{formatTime(conflict.shift_end)}</span>)}
        </section>
      </aside>
    </section>
  );
}

function BulkCreateView({ data }) {
  const [selectedDoctors, setSelectedDoctors] = useState([]);
  const [selectedDays, setSelectedDays] = useState(['T2', 'T3', 'T4', 'T5', 'T6']);
  const [shift, setShift] = useState('morning');
  const [startDate, setStartDate] = useState(dateKey());
  const [bulkPreview, setBulkPreview] = useState({ loading: false, results: [], error: '' });
  const activeShift = SHIFT_PRESETS.find((item) => item.id === shift) || SHIFT_PRESETS[0];
  const dayOffsets = useMemo(() => Object.fromEntries(WEEK_DAYS.map((day, index) => [day, index + 1])), []);
  const plannedItems = useMemo(() => selectedDoctors.flatMap((doctorId) => {
    const doctor = data.doctors.find((item) => String(item.id) === String(doctorId)) || {};
    const departmentId = getDoctorDepartmentId(doctor) || data.departments.find((item) => item.name === doctor.department)?.id || '';
    return selectedDays.map((day) => {
      const workDate = addDays(startDate, dayOffsets[day] || 1);
      return {
        doctor_id: doctorId,
        department_id: departmentId,
        work_date: workDate,
        shift_start: `${workDate}T${activeShift.start}:00`,
        shift_end: `${workDate}T${activeShift.end}:00`,
        slot_duration_minutes: 30,
        max_patients: 1,
        schedule_type: 'Khám chuyên khoa',
        status: 'draft',
      };
    });
  }).filter((item) => item.doctor_id && item.department_id), [activeShift.end, activeShift.start, data.departments, data.doctors, dayOffsets, selectedDays, selectedDoctors, startDate]);
  const projected = plannedItems.length;

  useEffect(() => {
    if (!data.doctors.length) {
      setSelectedDoctors([]);
      return;
    }
    setSelectedDoctors((current) => {
      const valid = current.filter((id) => data.doctors.some((doctor) => String(doctor.id) === String(id)));
      return valid.length ? valid : data.doctors.slice(0, 4).map((doctor) => doctor.id);
    });
  }, [data.doctors]);

  useEffect(() => {
    let active = true;
    if (!plannedItems.length) {
      setBulkPreview({ loading: false, results: [], error: '' });
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setBulkPreview((current) => ({ ...current, loading: true, error: '' }));
      const results = await Promise.allSettled(plannedItems.map((item) => schedulingApi.previewCreateSchedule(item)));
      if (!active) return;
      setBulkPreview({
        loading: false,
        error: '',
        results: results.map((result, index) => {
          const dataResult = result.status === 'fulfilled' ? result.value : null;
          return {
            item: plannedItems[index],
            canCreate: result.status === 'fulfilled' && dataResult?.can_create === true,
            data: dataResult,
            error: result.status === 'rejected' ? result.reason?.message || 'Preview thất bại.' : '',
          };
        }),
      });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [plannedItems]);

  const validRows = bulkPreview.results.filter((item) => item.canCreate);
  const blockedRows = bulkPreview.results.filter((item) => !item.canCreate);
  const previewSlots = bulkPreview.results.reduce((sum, item) => sum + safeNumber(item.data?.slots_summary?.total_slots), 0);

  function submitBulk() {
    const items = validRows.map((row) => row.item);
    if (!items.length) {
      data.setActionMessage('Backend preview chưa có lịch hợp lệ để tạo hàng loạt.');
      return;
    }

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
            <label className="sched-doctor-bulk-date"><span>Tuần bắt đầu</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
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
          <div><span>Có thể tạo</span><strong>{validRows.length}</strong></div>
          <div><span>Conflict</span><strong>{blockedRows.length}</strong></div>
          <div><span>Slot dự kiến</span><strong>{previewSlots}</strong></div>
        </div>
        <div className="sched-doctor-bulk-preview-list">
          {bulkPreview.loading ? <span><RefreshCw size={14} />Backend đang preview batch...</span> : null}
          {blockedRows.slice(0, 6).map((row, index) => (
            <span key={`${row.item.doctor_id}-${row.item.work_date}-${index}`}>
              <AlertTriangle size={14} />
              {formatDate(row.item.work_date)} {formatTime(row.item.shift_start)}-{formatTime(row.item.shift_end)} · {row.error || row.data?.warnings?.[0]?.message || (row.data?.conflicts?.length ? 'Có xung đột' : 'Không thể tạo')}
            </span>
          ))}
          {!bulkPreview.loading && !blockedRows.length && validRows.length ? <span><ShieldCheck size={14} />Tất cả lịch preview đều hợp lệ.</span> : null}
        </div>
        <button type="button" className="sched-doctor-primary" onClick={submitBulk} disabled={bulkPreview.loading || !validRows.length}>
          <Sparkles size={16} />Tạo phần hợp lệ
        </button>
      </aside>
    </section>
  );
}

function PublishQueue({ data, schedules }) {
  const rows = schedules.filter((item) => item.status === 'draft' || item.warnings.length || item.status === 'published').slice(0, 14);
  const [selectedIds, setSelectedIds] = useState([]);
  const publishableIds = selectedIds.filter((id) => rows.some((item) => String(item.id) === String(id) && isObjectId(item.id) && !['published', 'active', 'cancelled', 'canceled', 'completed'].includes(item.status)));
  const rowIdKey = rows.map((item) => item.id).join('|');

  useEffect(() => {
    setSelectedIds((current) => {
      const next = current.filter((id) => rows.some((item) => String(item.id) === String(id)));
      return next.length === current.length ? current : next;
    });
  }, [rowIdKey]);

  function toggleRow(scheduleId) {
    setSelectedIds((current) => current.includes(scheduleId) ? current.filter((id) => id !== scheduleId) : [...current, scheduleId]);
  }

  return (
    <section className="sched-doctor-publish">
      <div className="sched-doctor-publish-toolbar">
        <strong>{rows.length} lịch trong hàng đợi</strong>
        <button type="button" disabled={!publishableIds.length} onClick={() => data.runAction(`Đã publish ${publishableIds.length} lịch.`, () => data.actions.bulkPublishSchedules(publishableIds), {
          confirm: { title: 'Publish hàng loạt', body: `Công khai ${publishableIds.length} lịch đã chọn. Backend sẽ generate slot và trả kết quả từng lịch.`, confirmLabel: 'publish hàng loạt' },
        })}><Send size={14} />Publish đã chọn</button>
        <button type="button" disabled={!selectedIds.length} onClick={() => data.runAction(`Đã generate ${selectedIds.length} lịch.`, () => Promise.all(selectedIds.map((id) => schedulingApi.generateScheduleSlots(id))), {
          confirm: { title: 'Generate hàng loạt', body: `Đồng bộ slot cho ${selectedIds.length} lịch đã chọn.`, confirmLabel: 'generate hàng loạt' },
        })}><WandSparkles size={14} />Generate đã chọn</button>
      </div>
      <div className="sched-doctor-readiness-grid">
        {rows.map((item) => {
          const ready = item.status === 'draft' && !item.warnings.some((warning) => warning.severity === 'critical');
          const finalSchedule = ['cancelled', 'canceled', 'completed'].includes(item.status);
          return (
            <article key={item.id} className={ready ? 'is-ready' : item.status === 'published' ? 'is-published' : 'is-blocked'}>
              <header>
                <label className="sched-doctor-publish-select">
                  <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleRow(item.id)} disabled={!isObjectId(item.id)} />
                  <StatusBadge status={item.status} />
                </label>
                <strong>{ready ? 'Ready' : item.status === 'published' ? 'Published' : 'Need check'}</strong>
              </header>
              <h3>{item.doctor}</h3>
              <p>{item.department} · {formatDate(item.date)} · {item.start}-{item.end}</p>
              <div><span>{item.totalSlots} slot</span><span>{item.warnings.length} cảnh báo</span><span>{Math.round(item.utilization)}%</span></div>
              <footer>
                <button type="button" disabled={!isObjectId(item.id) || finalSchedule} onClick={() => data.runAction('Đã generate slot.', () => schedulingApi.generateScheduleSlots(item.id), {
                  confirm: { title: 'Generate slot', body: `Đồng bộ slot cho lịch ${item.doctor}.`, confirmLabel: 'generate slot' },
                })}><WandSparkles size={14} />Generate</button>
                <button type="button" disabled={!isObjectId(item.id) || finalSchedule || ['published', 'active'].includes(item.status)} onClick={() => data.runAction('Đã publish lịch.', () => schedulingApi.publishSchedule(item.id), {
                  confirm: { title: 'Publish lịch', body: `Công khai lịch ${item.doctor} ngày ${formatDate(item.date)}.`, confirmLabel: 'publish lịch' },
                })}><Send size={14} />Publish</button>
              </footer>
            </article>
          );
        })}
        {!rows.length ? <div className="sched-doctor-empty"><Send size={24} /><strong>Không có lịch trong hàng đợi publish.</strong><span>Dữ liệu đang lấy trực tiếp từ backend theo bộ lọc hiện tại.</span></div> : null}
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
      <div className="sched-doctor-conflict-actions">
        <button type="button" onClick={data.refresh}><RefreshCw size={15} />Quét lại từ backend</button>
        <Link to="/scheduling/doctor-schedules/publish"><Send size={15} />Tới hàng đợi publish</Link>
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
        {!data.conflicts.length ? (
          <div className="sched-doctor-empty">
            <ShieldCheck size={24} />
            <strong>Backend chưa phát hiện xung đột trong bộ lọc này.</strong>
            <span>Dữ liệu conflict lấy từ endpoint /schedules/conflicts.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ImpactView({ data }) {
  const item = data.selectedSchedule || data.schedules[0];
  const [proposal, setProposal] = useState({ date: item?.date || dateKey(), start: item?.start || '08:00', end: item?.end || '12:00', duration: item?.slotDuration || 30 });
  const [impactPreview, setImpactPreview] = useState({ loading: false, data: null, error: '' });

  useEffect(() => {
    if (!item) return;
    setProposal({
      date: item.date || dateKey(),
      start: item.start || '08:00',
      end: item.end || '12:00',
      duration: item.slotDuration || 30,
    });
    setImpactPreview({ loading: false, data: null, error: '' });
  }, [item?.id]);

  if (!item) return <div className="sched-doctor-empty">Chưa có lịch để preview tác động.</div>;

  const oldSlots = Math.max(0, Math.floor((timeToMinutes(item.end) - timeToMinutes(item.start)) / item.slotDuration));
  const newSlots = Math.max(0, Math.floor((timeToMinutes(proposal.end) - timeToMinutes(proposal.start)) / safeNumber(proposal.duration || item.slotDuration)));
  const impacted = impactPreview.data
    ? safeNumber(impactPreview.data.impacted_appointments_count)
    : Math.max(0, item.bookedSlots - Math.min(item.bookedSlots, newSlots));
  const affectedBlocked = safeNumber(impactPreview.data?.affected_blocked_slots_count);
  const canApplyProposal = Boolean(impactPreview.data?.can_update_without_impact);

  async function runBackendPreview() {
    setImpactPreview({ loading: true, data: null, error: '' });
    try {
      const result = await schedulingApi.previewImpact(item.id, buildScheduleUpdatePayload(proposal));
      setImpactPreview({ loading: false, data: result, error: '' });
    } catch (error) {
      setImpactPreview({ loading: false, data: null, error: error.message || 'Backend preview-impact thất bại.' });
    }
  }

  async function applyProposal() {
    if (!impactPreview.data) {
      data.setActionMessage('Chạy preview backend trước khi cập nhật lịch.');
      return;
    }
    if (!canApplyProposal) {
      data.setActionMessage('Lịch đề xuất còn ảnh hưởng appointment/slot, backend sẽ không cho cập nhật trực tiếp.');
      return;
    }
    await data.runAction('Đã cập nhật lịch theo đề xuất.', () => schedulingApi.updateSchedule(item.id, buildScheduleUpdatePayload(proposal)), {
      confirm: {
        title: 'Cập nhật lịch làm việc',
        body: `Cập nhật lịch ${item.doctor} sang ${formatDate(proposal.date)} ${proposal.start}-${proposal.end}.`,
        confirmLabel: 'cập nhật lịch',
      },
    });
  }

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
          <label>Lịch cần xem tác động<select value={item.id} onChange={(event) => data.setSelectedId(event.target.value)}>{data.schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.doctor} · {formatDate(schedule.date)} · {schedule.start}-{schedule.end}</option>)}</select></label>
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
          <div><span>Slot khóa ảnh hưởng</span><strong>{affectedBlocked}</strong></div>
          <div><span>Risk</span><strong>{impacted > 0 || affectedBlocked > 0 ? 'High' : 'Low'}</strong></div>
        </div>
        {impactPreview.error ? <p className="sched-doctor-inline-error">{impactPreview.error}</p> : null}
        {impactPreview.data ? (
          <p className={canApplyProposal ? 'sched-doctor-inline-ok' : 'sched-doctor-inline-error'}>
            {canApplyProposal ? 'Backend cho phép cập nhật trực tiếp.' : 'Cần xử lý appointment/slot bị ảnh hưởng trước khi cập nhật.'}
          </p>
        ) : null}
        <button type="button" className="sched-doctor-primary" onClick={runBackendPreview} disabled={impactPreview.loading || !isObjectId(item.id)}>
          <ShieldCheck size={16} />Chạy preview backend
        </button>
        <button type="button" className="sched-doctor-primary" onClick={applyProposal} disabled={!impactPreview.data || !canApplyProposal || !isObjectId(item.id)}>
          <CheckCircle2 size={16} />Cập nhật lịch
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
          <ScheduleFilters data={data} tab={tab} setTab={setTab} query={query} setQuery={setQuery} stats={data.stats} />
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
