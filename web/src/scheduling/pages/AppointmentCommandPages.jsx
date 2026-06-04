import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BellRing,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  LoaderCircle,
  MessageSquareText,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  Stethoscope,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
} from 'lucide-react';
import { schedulingApi } from '../api/schedulingApi';
import { useSchedulingData } from '../context/SchedulingDataContext';
import { downloadJsonFile, runSchedulingAction } from '../utils/schedulingActions';

const VIEW_CONFIG = {
  list: {
    eyebrow: 'Appointment Cockpit',
    title: 'Quản lý lịch hẹn',
    copy: 'Bảng điều phối toàn bộ appointment với trạng thái, queue, encounter, cảnh báo và thao tác nhanh.',
  },
  calendar: {
    eyebrow: 'Calendar Resource View',
    title: 'Lịch hẹn trực quan',
    copy: 'Xem appointment theo ngày, bác sĩ, khoa và timeline vận hành.',
  },
  create: {
    eyebrow: 'Safe Booking Wizard',
    title: 'Tạo lịch hẹn',
    copy: 'Wizard đặt lịch an toàn với kiểm tra bệnh nhân, bác sĩ, slot và xung đột trước khi tạo.',
  },
  confirmation: {
    eyebrow: 'Confirmation Center',
    title: 'Xác nhận / nhắc lịch',
    copy: 'Quản lý lịch chờ xác nhận, lịch sắp đến và kịch bản nhắc lịch cho bệnh nhân.',
  },
  reschedule: {
    eyebrow: 'Change Control',
    title: 'Dời / hủy lịch',
    copy: 'Xử lý thay đổi lịch hẹn, hủy lịch và các appointment bị ảnh hưởng bởi vận hành.',
  },
  checkIn: {
    eyebrow: 'Front Desk Check-in',
    title: 'Check-in',
    copy: 'Xác nhận bệnh nhân đã đến, đưa vào queue và theo dõi điều kiện check-in trong ngày.',
  },
  noShow: {
    eyebrow: 'No-show Control',
    title: 'No-show',
    copy: 'Phát hiện ứng viên no-show, xử lý liên hệ lại, đánh dấu no-show hoặc dời lịch.',
  },
  waitlist: {
    eyebrow: 'Waitlist Matching',
    title: 'Danh sách chờ',
    copy: 'Quản lý bệnh nhân chờ slot, offer slot phù hợp và chuyển thành lịch hẹn.',
  },
};

const STATUS_META = {
  booked: { label: 'Chờ xác nhận', tone: 'amber' },
  confirmed: { label: 'Đã xác nhận', tone: 'blue' },
  checked_in: { label: 'Đã check-in', tone: 'green' },
  in_consultation: { label: 'Đang khám', tone: 'violet' },
  completed: { label: 'Hoàn tất', tone: 'teal' },
  cancelled: { label: 'Đã hủy', tone: 'slate' },
  no_show: { label: 'No-show', tone: 'red' },
  rescheduled: { label: 'Đã dời', tone: 'amber' },
};

const CALENDAR_STATUS_LEGEND = [
  { key: 'booked', label: 'Chờ xác nhận', hint: 'cần gọi / nhắc', tone: 'amber' },
  { key: 'confirmed', label: 'Đã xác nhận', hint: 'sẵn sàng đến khám', tone: 'blue' },
  { key: 'checked_in', label: 'Đã check-in', hint: 'đã có mặt', tone: 'green' },
  { key: 'in_consultation', label: 'Đang khám', hint: 'bác sĩ đang xử lý', tone: 'violet' },
  { key: 'completed', label: 'Hoàn tất', hint: 'đã kết thúc', tone: 'teal' },
  { key: 'no_show', label: 'No-show', hint: 'quá giờ chưa đến', tone: 'red' },
  { key: 'cancelled', label: 'Đã hủy', hint: 'không còn hiệu lực', tone: 'slate' },
];

const STATUS_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'today', label: 'Hôm nay' },
  { key: 'booked', label: 'Chờ xác nhận' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'checked_in', label: 'Đã check-in' },
  { key: 'in_consultation', label: 'Đang khám' },
  { key: 'completed', label: 'Hoàn tất' },
  { key: 'cancelled', label: 'Đã hủy' },
  { key: 'no_show', label: 'No-show' },
];

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getTodayKey() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(safeNumber(value));
}

function formatPercent(value) {
  return `${Math.round(safeNumber(value))}%`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--/--/----';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 5) || '--:--';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function getDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function parseLocalDateKey(value) {
  const [year, month, day] = String(value || getTodayKey()).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function addLocalDays(value, amount) {
  const date = value instanceof Date ? new Date(value) : parseLocalDateKey(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function getLocalDateKey(value) {
  const date = value instanceof Date ? value : parseLocalDateKey(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getWeekStart(value) {
  const date = parseLocalDateKey(value);
  const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
  date.setDate(date.getDate() - dayIndex);
  return date;
}

function getWeekRange(value) {
  const start = getWeekStart(value);
  const end = addLocalDays(start, 6);
  return {
    start,
    end,
    date_from: getLocalDateKey(start),
    date_to: getLocalDateKey(end),
  };
}

function getDateRange(startValue, amount = 0) {
  const start = startValue instanceof Date ? new Date(startValue) : parseLocalDateKey(startValue);
  return Array.from({ length: amount + 1 }, (_, index) => addLocalDays(start, index));
}

function getSettled(result, fallback = null) {
  return result?.status === 'fulfilled' ? result.value : fallback;
}

function normalizeAppointment(item = {}) {
  const patient = item.patient || item.patient_id || {};
  const doctor = item.doctor || item.doctor_id || {};
  const department = item.department || item.department_id || {};
  const queueTicket = item.queue_ticket || item.queue || (item.queue_ticket_id ? { queue_ticket_id: item.queue_ticket_id, queue_number: item.queue_number } : null);
  const encounter = item.encounter || (item.encounter_id ? { encounter_id: item.encounter_id, encounter_code: item.encounter_code } : null);
  return {
    id: item.appointment_id || item.id || item._id,
    patientId: item.patient_id || patient.patient_id || patient._id || patient.id,
    patientName: item.patient_name || patient.full_name || patient.patient_name || 'Bệnh nhân chưa rõ',
    patientCode: item.patient_code || patient.patient_code || 'BN----',
    patientPhone: item.patient_phone || patient.phone || '',
    doctorId: item.doctor_id || doctor.user_id || doctor._id || doctor.id,
    doctorName: item.doctor_name || doctor.full_name || doctor.name || 'Chưa phân bác sĩ',
    departmentId: item.department_id || department.department_id || department._id || department.id,
    departmentName: item.department_name || department.department_name || department.name || 'Chưa xác định khoa',
    scheduleId: item.doctor_schedule_id,
    slotId: item.schedule_slot_id,
    appointmentTime: item.appointment_time || item.time,
    appointmentType: item.appointment_type || 'outpatient',
    source: item.source || 'staff',
    status: item.status || 'booked',
    reason: item.reason || 'Khám bệnh',
    queue: queueTicket,
    encounter,
    raw: item,
  };
}

function buildSummary(items) {
  const count = (status) => items.filter((item) => item.status === status).length;
  return {
    total: items.length,
    booked: count('booked'),
    confirmed: count('confirmed'),
    checked_in: count('checked_in'),
    in_consultation: count('in_consultation'),
    completed: count('completed'),
    cancelled: count('cancelled'),
    no_show: count('no_show'),
    rescheduled: count('rescheduled'),
    upcoming: items.filter((item) => ['booked', 'confirmed'].includes(item.status)).length,
    no_show_rate: items.length ? (count('no_show') / items.length) * 100 : 0,
    cancellation_rate: items.length ? (count('cancelled') / items.length) * 100 : 0,
  };
}

function normalizeWaitlist(item = {}) {
  return {
    id: item.waitlist_id || item.appointment_waitlist_id || item.id || item._id,
    patientId: item.patient_id || item.patient?.patient_id || item.patient?._id || item.patient?.id,
    patientName: item.patient_name || item.patient?.full_name || 'Bệnh nhân chưa rõ',
    patientCode: item.patient_code || item.patient?.patient_code || 'BN----',
    patientPhone: item.patient_phone || item.patient?.phone || '',
    doctorId: item.doctor_id || item.doctor?.user_id || item.doctor?._id || item.doctor?.id || '',
    doctorName: item.doctor_name || item.doctor?.full_name || 'Bất kỳ bác sĩ phù hợp',
    departmentId: item.department_id || item.department?.department_id || item.department?._id || item.department?.id || '',
    departmentName: item.department_name || item.department?.department_name || 'Chưa xác định khoa',
    preferredDate: item.preferred_date,
    preferredTimeRange: item.preferred_time_range || 'Không giới hạn',
    reason: item.reason || 'Chờ slot phù hợp',
    status: item.status || 'waiting',
    offeredSlotId: item.offered_slot_id || item.offered_slot?.schedule_slot_id || '',
    offeredScheduleId: item.offered_slot?.doctor_schedule_id || '',
    offeredSlotStart: item.offered_slot?.start_time || '',
    offeredSlotEnd: item.offered_slot?.end_time || '',
    offeredUntil: item.offered_until,
    bookedAppointmentId: item.booked_appointment_id,
    waitHours: item.created_at ? Math.max(1, Math.round((Date.now() - new Date(item.created_at).getTime()) / 3600000)) : 0,
    raw: item,
  };
}

function buildAllowedActions(appointment) {
  const status = appointment.status;
  return {
    confirm: status === 'booked',
    checkIn: ['booked', 'confirmed'].includes(status),
    reschedule: ['booked', 'confirmed'].includes(status),
    cancel: ['booked', 'confirmed'].includes(status),
    noShow: status === 'confirmed',
    queue: status === 'checked_in' && !appointment.queue,
  };
}

function getLateMinutes(appointment) {
  const time = new Date(appointment.appointmentTime).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.round((Date.now() - time) / 60000));
}

function getTimeState(appointment) {
  const minutes = getLateMinutes(appointment);
  if (appointment.status === 'cancelled') return { label: 'Đã hủy', tone: 'slate' };
  if (appointment.status === 'no_show') return { label: 'No-show', tone: 'red' };
  if (appointment.status === 'completed') return { label: 'Hoàn tất', tone: 'green' };
  if (appointment.status === 'checked_in') return { label: 'Đã check-in', tone: 'green' };
  if (appointment.status === 'in_consultation') return { label: 'Đang khám', tone: 'violet' };
  if (minutes <= 0) return { label: 'Sắp đến', tone: 'blue' };
  if (minutes <= 20) return { label: `Trễ ${minutes} phút`, tone: 'amber' };
  return { label: `Quá giờ ${minutes} phút`, tone: 'red' };
}

function getTypeLabel(value) {
  const labels = {
    outpatient: 'Khám ngoại trú',
    inpatient_followup: 'Tái khám nội trú',
    emergency: 'Cấp cứu',
    telemedicine: 'Khám từ xa',
    vaccination: 'Tiêm chủng',
    procedure: 'Thủ thuật',
  };
  return labels[value] || value || '--';
}

function getSourceLabel(value) {
  const labels = {
    patient_portal: 'Cổng bệnh nhân',
    portal: 'Cổng bệnh nhân',
    staff: 'Nhân viên tạo',
    front_desk: 'Tại quầy',
    doctor_dashboard_seed: 'Bác sĩ tạo',
    system: 'Hệ thống',
  };
  return labels[value] || value || '--';
}

function getInitials(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'BN';
  return parts.slice(-2).map((part) => part[0]).join('').toUpperCase();
}

function getAppointmentShortId(appointment = {}) {
  return String(appointment.id || appointment.raw?.appointment_id || '').slice(-10).toUpperCase() || '--';
}

function getQueueLabel(appointment = {}) {
  return appointment.queue?.queue_number
    || appointment.queue?.display_number
    || appointment.queue?.queue_ticket_id
    || appointment.raw?.queue_number
    || '';
}

function getEncounterLabel(appointment = {}) {
  return appointment.encounter?.encounter_code
    || appointment.encounter?.encounter_id
    || appointment.raw?.encounter_code
    || appointment.raw?.encounter_id
    || '';
}

function useAppointmentData(date, rangeMode = 'day') {
  const scheduling = useSchedulingData();
  const [state, setState] = useState({ loading: true, error: '', remote: {} });
  const [reloadKey, setReloadKey] = useState(0);
  const appointmentQuery = useMemo(() => {
    if (rangeMode === 'week') {
      const range = getWeekRange(date);
      return { date_from: range.date_from, date_to: range.date_to };
    }
    return { date };
  }, [date, rangeMode]);

  useEffect(() => {
    let isActive = true;
    setState((current) => ({ ...current, loading: true, error: '' }));

    async function load() {
      const listLimit = rangeMode === 'week' ? 500 : 150;
      const results = await Promise.allSettled([
        schedulingApi.getAppointmentSummary(appointmentQuery),
        schedulingApi.getTodayAppointments({ date, limit: 150 }),
        schedulingApi.listAppointments({ ...appointmentQuery, limit: listLimit }),
        schedulingApi.getUpcomingAppointments({ limit: 80 }),
        schedulingApi.listAppointmentWaitlist({ limit: 80 }),
        schedulingApi.getCreateOptions(),
      ]);

      if (!isActive) return;
      const firstError = results.find((item) => item.status === 'rejected')?.reason?.message || '';
      setState({
        loading: false,
        error: firstError && results.every((item) => item.status === 'rejected') ? firstError : '',
        remote: {
          summary: getSettled(results[0]),
          today: getSettled(results[1]),
          list: getSettled(results[2]),
          upcoming: getSettled(results[3]),
          waitlist: getSettled(results[4]),
          options: getSettled(results[5]),
        },
      });
    }

    load();
    return () => {
      isActive = false;
    };
  }, [appointmentQuery, date, rangeMode, reloadKey]);

  const derived = useMemo(() => {
    const apiItems = safeArray(state.remote.list?.items).length
      ? state.remote.list.items
      : safeArray(state.remote.today?.items);
    const appointments = safeArray(apiItems).map(normalizeAppointment);
    const summary = state.remote.summary || buildSummary(appointments);
    const waitlistItems = safeArray(state.remote.waitlist?.items).map(normalizeWaitlist);
    const options = state.remote.options || {};
    const departments = safeArray(options.departments).length ? options.departments.map((item) => ({
      id: item.department_id || item.id,
      name: item.department_name || item.name || item.code,
    })) : (scheduling.backendConnected ? scheduling.departments : []);
    const doctors = safeArray(options.doctors).length ? options.doctors.map((item) => ({
      id: item.user_id || item.id,
      name: item.full_name || item.name || item.username,
      departmentId: item.department_id,
      department: item.department_name || item.department,
    })) : (scheduling.backendConnected ? scheduling.doctors : []);
    const patients = Array.from(new Map(appointments.map((item) => {
      const patientId = item.patientId || item.raw?.patient_id || item.raw?.patient?._id || item.raw?.patient?.id;
      return [patientId || item.patientCode, {
        id: patientId || '',
        name: item.patientName,
        code: item.patientCode,
        phone: item.patientPhone,
      }];
    })).values());

    return {
      appointments,
      summary,
      waitlistItems,
      patients,
      doctors,
      departments,
      schedules: scheduling.backendConnected ? scheduling.schedules : [],
      backendConnected: Boolean(state.remote.list || state.remote.today || state.remote.upcoming || state.remote.summary || state.remote.waitlist || state.remote.options),
    };
  }, [date, scheduling, state.remote]);

  const refresh = useCallback(async () => {
    setReloadKey((current) => current + 1);
    await scheduling.refresh();
  }, [scheduling]);

  return {
    ...derived,
    loading: state.loading || scheduling.loading,
    error: state.error || scheduling.error,
    refresh,
  };
}

function StatusBadge({ value }) {
  const meta = STATUS_META[value] || { label: value || 'Không rõ', tone: 'slate' };
  return <span className={`sched-appt-status is-${meta.tone}`}>{meta.label}</span>;
}

function Header({ config, date, setDate, data, loading, onRefresh }) {
  return (
    <section className="sched-appt-hero">
      <div>
        <span>{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.copy}</p>
      </div>
      <div className="sched-appt-hero__tools">
        <label>Ngày<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <span className={`sched-appt-sync is-${data.backendConnected ? 'online' : 'demo'}`}><i />{data.backendConnected ? 'Database live' : 'API/DB chưa sẵn sàng'}</span>
        <button type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={16} />Làm mới</button>
        <Link to="/scheduling/appointments/create"><CalendarPlus size={16} />Tạo lịch hẹn</Link>
      </div>
    </section>
  );
}


function AppointmentCommandStrip({ view, data, rows, date, onRefresh, onExport }) {
  const activeCount = rows.filter((item) => !['cancelled', 'no_show', 'completed'].includes(item.status)).length;
  const riskCount = rows.filter((item) => ['booked', 'no_show'].includes(item.status) || getTimeState(item).tone === 'red').length;
  const queueLinked = rows.filter((item) => getQueueLabel(item)).length;
  const navItems = [
    { to: '/scheduling/appointments', label: 'Danh sách' },
    { to: '/scheduling/appointments/calendar', label: 'Lịch tuần' },
    { to: '/scheduling/appointments/create', label: 'Tạo lịch' },
    { to: '/scheduling/appointments/confirmation', label: 'Xác nhận' },
    { to: '/scheduling/appointments/reschedule-cancel', label: 'Dời / hủy' },
    { to: '/scheduling/appointments/check-in', label: 'Check-in' },
    { to: '/scheduling/appointments/no-show', label: 'No-show' },
    { to: '/scheduling/appointments/waitlist', label: 'Waitlist' },
  ];
  return (
    <section className="sched-appt-command-strip" aria-label="Appointment command strip">
      <div className="sched-appt-command-strip__status">
        <span className={data.backendConnected ? 'is-online' : 'is-warning'}><i />{data.backendConnected ? 'DB live' : 'Đang dùng fallback'}</span>
        <span><CalendarCheck2 size={15} />{formatDate(date)}</span>
        <span><UsersRound size={15} />{formatNumber(activeCount)} ca đang vận hành</span>
        <span className={riskCount ? 'is-warning' : 'is-online'}><AlertTriangle size={15} />{formatNumber(riskCount)} cần chú ý</span>
        <span><ClipboardCheck size={15} />{formatNumber(queueLinked)} đã nối queue</span>
      </div>
      <div className="sched-appt-command-strip__nav">
        {navItems.map((item) => (
          <Link key={item.to} to={item.to} className={viewMatchesRoute(view, item.to) ? 'is-active' : ''}>{item.label}</Link>
        ))}
      </div>
      <div className="sched-appt-command-strip__actions">
        <button type="button" onClick={onRefresh}><RefreshCw size={15} />Đồng bộ</button>
        <button type="button" onClick={onExport}><Download size={15} />Xuất JSON</button>
      </div>
    </section>
  );
}

function viewMatchesRoute(view, to) {
  const map = {
    list: '/scheduling/appointments',
    calendar: '/scheduling/appointments/calendar',
    create: '/scheduling/appointments/create',
    confirmation: '/scheduling/appointments/confirmation',
    reschedule: '/scheduling/appointments/reschedule-cancel',
    checkIn: '/scheduling/appointments/check-in',
    noShow: '/scheduling/appointments/no-show',
    waitlist: '/scheduling/appointments/waitlist',
  };
  return map[view] === to;
}

function AppointmentKpis({ summary }) {
  const items = [
    { label: 'Tổng lịch hẹn', value: summary.total, hint: 'theo bộ lọc', icon: CalendarCheck2, tone: 'blue' },
    { label: 'Chờ xác nhận', value: summary.booked, hint: 'cần gọi / nhắc lịch', icon: BellRing, tone: 'amber' },
    { label: 'Đã xác nhận', value: summary.confirmed, hint: 'sẵn sàng check-in', icon: CheckCircle2, tone: 'cyan' },
    { label: 'Đã check-in', value: summary.checked_in, hint: 'đang trong flow', icon: ClipboardCheck, tone: 'green' },
    { label: 'Đang khám', value: summary.in_consultation, hint: 'in consultation', icon: Stethoscope, tone: 'violet' },
    { label: 'Hoàn tất', value: summary.completed, hint: 'completed', icon: UserRoundCheck, tone: 'teal' },
    { label: 'No-show', value: summary.no_show, hint: formatPercent(summary.no_show_rate), icon: UserRoundX, tone: 'red' },
    { label: 'Hủy / dời', value: summary.cancelled + summary.rescheduled, hint: `${formatPercent(summary.cancellation_rate)} hủy`, icon: CalendarX2, tone: 'slate' },
  ];

  return (
    <section className="sched-appt-kpis">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.label} className={`is-${item.tone}`}>
            <span><Icon size={17} />{item.label}</span>
            <strong>{formatNumber(item.value)}</strong>
            <small>{item.hint}</small>
          </article>
        );
      })}
    </section>
  );
}

function FilterBar({ query, setQuery, activeTab, setActiveTab }) {
  return (
    <section className="sched-appt-filter">
      <label><Search size={16} /><input value={query} placeholder="Tìm bệnh nhân, mã BN, SĐT, bác sĩ, khoa, lý do khám..." onChange={(event) => setQuery(event.target.value)} /></label>
      <div>
        {STATUS_TABS.map((tab) => (
          <button key={tab.key} type="button" className={activeTab === tab.key ? 'is-active' : ''} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function AppointmentTable({ rows, selected, onSelect, onAction, onExport }) {
  return (
    <section className="sched-appt-panel sched-appt-table">
      <header className="sched-appt-table__header">
        <div>
          <span>Command table</span>
          <h2>Danh sách lịch hẹn</h2>
          <p>{formatNumber(rows.length)} lịch theo bộ lọc hiện tại</p>
        </div>
        <div className="sched-appt-table__bulk">
          <button type="button" onClick={() => onAction('bulk-confirm', null, { rows })} disabled={!rows.some((item) => item.status === 'booked')}>Xác nhận nhanh</button>
          <button type="button" onClick={() => onAction('bulk-reminder', null, { rows })} disabled={!rows.some((item) => ['booked', 'confirmed'].includes(item.status))}>Nhắc lịch nhanh</button>
          <button type="button" onClick={onExport}><Download size={14} />Xuất lọc</button>
        </div>
      </header>
      <div className="sched-appt-table__head" aria-hidden="true">
        <span>Thời gian</span><span>Bệnh nhân</span><span>Chuyên môn</span><span>Vận hành</span><span>Trạng thái</span><span>Thao tác</span>
      </div>
      <div className="sched-appt-table__list">
      {rows.map((appointment) => {
        const actions = buildAllowedActions(appointment);
        const timeState = getTimeState(appointment);
        const queueLabel = getQueueLabel(appointment);
        const encounterLabel = getEncounterLabel(appointment);
        return (
          <article key={appointment.id} className={`${selected?.id === appointment.id ? 'is-selected' : ''} is-time-${timeState.tone}`} onClick={() => onSelect(appointment)}>
            <div className="sched-appt-time-cell">
              <strong>{formatClock(appointment.appointmentTime)}</strong>
              <span>{formatDate(appointment.appointmentTime)}</span>
              <small>{timeState.label}</small>
            </div>
            <div className="sched-appt-patient-cell">
              <b>{getInitials(appointment.patientName)}</b>
              <div>
                <strong>{appointment.patientName}</strong>
                <span>{appointment.patientCode}</span>
                <small><PhoneCall size={12} />{appointment.patientPhone || 'Chưa có SĐT'}</small>
              </div>
            </div>
            <div className="sched-appt-clinical-cell">
              <strong>{appointment.departmentName}</strong>
              <span>{appointment.doctorName}</span>
              <small>{appointment.reason || 'Chưa ghi lý do khám'}</small>
            </div>
            <div className="sched-appt-ops-cell">
              <span>{getTypeLabel(appointment.appointmentType)}</span>
              <span>{getSourceLabel(appointment.source)}</span>
              <small>#{getAppointmentShortId(appointment)}</small>
            </div>
            <div className="sched-appt-state-cell">
              <StatusBadge value={appointment.status} />
              <div className="sched-appt-flags">
                {timeState.tone === 'red' ? <span className="is-red">Quá giờ</span> : null}
                {!queueLabel && appointment.status === 'checked_in' ? <span className="is-amber">Chưa có queue</span> : null}
                {queueLabel ? <span className="is-green">Queue {queueLabel}</span> : null}
                {encounterLabel ? <span className="is-violet">Encounter</span> : null}
              </div>
            </div>
            <div className="sched-appt-row-actions" onClick={(event) => event.stopPropagation()}>
              {actions.confirm ? <button type="button" onClick={() => onAction('confirm', appointment)}>Xác nhận</button> : null}
              {actions.checkIn ? <button type="button" onClick={() => onAction('checkin', appointment)}>Check-in</button> : null}
              {actions.queue ? <button type="button" onClick={() => onAction('queue', appointment)}>Tạo queue</button> : null}
              {actions.reschedule ? <button type="button" onClick={() => onAction('reschedule', appointment)}>Dời</button> : null}
              {actions.noShow ? <button type="button" onClick={() => onAction('noshow', appointment)}>No-show</button> : null}
              {actions.cancel ? <button type="button" className="is-danger" onClick={() => onAction('cancel', appointment)}>Hủy</button> : null}
              {!Object.values(actions).some(Boolean) ? <button type="button" disabled>Đã khóa</button> : null}
            </div>
          </article>
        );
      })}
      </div>
      {!rows.length ? <p className="sched-appt-empty">Không có lịch hẹn phù hợp bộ lọc.</p> : null}
    </section>
  );
}

function DetailDrawer({ appointment }) {
  if (!appointment) {
    return (
      <aside className="sched-appt-drawer">
        <div className="sched-appt-empty"><Eye size={24} /><strong>Chọn một lịch hẹn</strong><span>Chi tiết sẽ hiển thị dữ liệu appointment thật, slot, queue, encounter và timeline.</span></div>
      </aside>
    );
  }

  const queueLabel = getQueueLabel(appointment);
  const encounterLabel = getEncounterLabel(appointment);
  const timeState = getTimeState(appointment);
  const timeline = [
    ['Tạo lịch', appointment.raw?.created_at],
    ['Xác nhận', appointment.raw?.confirmed_at],
    ['Check-in', appointment.raw?.checked_in_at],
    ['Vào khám', appointment.raw?.consultation_started_at || appointment.raw?.in_consultation_at],
    ['Hoàn tất', appointment.raw?.completed_at],
    ['Hủy / no-show', appointment.raw?.cancelled_at || appointment.raw?.no_show_at],
  ].filter(([, value]) => value);

  return (
    <aside className="sched-appt-drawer is-filled">
      <header>
        <span>Appointment detail</span>
        <h2>{appointment.patientName}</h2>
        <p>{appointment.patientCode} - {appointment.patientPhone || 'Chưa có SĐT'}</p>
        <StatusBadge value={appointment.status} />
      </header>
      <div className={`sched-appt-drawer__time is-${timeState.tone}`}>
        <Clock3 size={18} />
        <div>
          <strong>{formatClock(appointment.appointmentTime)} - {formatDate(appointment.appointmentTime)}</strong>
          <span>{timeState.label}</span>
        </div>
      </div>
      <div className="sched-appt-drawer__grid">
        <span>Khoa <b>{appointment.departmentName}</b></span>
        <span>Bác sĩ <b>{appointment.doctorName}</b></span>
        <span>Loại lịch <b>{getTypeLabel(appointment.appointmentType)}</b></span>
        <span>Nguồn <b>{getSourceLabel(appointment.source)}</b></span>
        <span>Mã lịch <b>#{getAppointmentShortId(appointment)}</b></span>
        <span>Schedule <b>{appointment.scheduleId || 'Chưa liên kết'}</b></span>
      </div>
      <section>
        <h3>Liên kết vận hành</h3>
        <p>Slot: {appointment.slotId || 'Chưa có slot detail'}</p>
        <p>Queue: {queueLabel || 'Chưa tạo queue'}</p>
        <p>Encounter: {encounterLabel || 'Chưa có encounter'}</p>
      </section>
      <section>
        <h3>Timeline</h3>
        {timeline.length ? timeline.map(([label, value]) => (
          <p key={label}><b>{label}</b><span>{formatClock(value)} - {formatDate(value)}</span></p>
        )) : <p><b>Chưa có timeline</b><span>Backend chưa trả mốc thao tác</span></p>}
        <p><b>Lý do khám</b><span>{appointment.reason || '--'}</span></p>
      </section>
    </aside>
  );
}

function CalendarView({ appointments, doctors, date }) {
  const weekRange = getWeekRange(date);
  const weekDays = getDateRange(weekRange.start, 6).map((day, index) => ({
    key: getLocalDateKey(day),
    label: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index],
    display: formatDate(day),
    isSelected: getLocalDateKey(day) === date,
  }));

  const weekAppointments = appointments.filter((appointment) => {
    const key = getDateKey(appointment.appointmentTime);
    return key >= weekRange.date_from && key <= weekRange.date_to;
  });

  const doctorMap = new Map();
  safeArray(doctors).forEach((doctor) => {
    if (!doctor?.id) return;
    doctorMap.set(String(doctor.id), {
      id: String(doctor.id),
      name: doctor.name || 'Chưa xác định bác sĩ',
      department: doctor.department || doctor.departmentName || 'Chưa gắn khoa',
      raw: doctor.raw || doctor,
      source: 'doctor-directory',
    });
  });

  weekAppointments.forEach((appointment) => {
    const id = appointment.doctorId || appointment.doctorName || 'unassigned';
    if (doctorMap.has(String(id))) return;
    doctorMap.set(String(id), {
      id: String(id),
      name: appointment.doctorName || 'Chưa phân bác sĩ',
      department: appointment.departmentName || 'Chưa gắn khoa',
      raw: appointment.raw?.doctor || {},
      source: 'appointment',
    });
  });

  const resources = Array.from(doctorMap.values()).map((doctor) => {
    const doctorAppointments = weekAppointments.filter((appointment) => {
      const resourceId = String(doctor.id);
      return String(appointment.doctorId || appointment.doctorName) === resourceId
        || (!appointment.doctorId && appointment.doctorName === doctor.name)
        || (doctor.id === 'unassigned' && !appointment.doctorId);
    });
    const byDay = Object.fromEntries(weekDays.map((day) => [day.key, doctorAppointments.filter((item) => getDateKey(item.appointmentTime) === day.key)]));
    const activeCount = doctorAppointments.filter((appointment) => !['cancelled', 'no_show'].includes(appointment.status)).length;
    const needsAction = doctorAppointments.filter((appointment) => ['booked', 'no_show', 'cancelled'].includes(appointment.status)).length;
    const completedCount = doctorAppointments.filter((appointment) => appointment.status === 'completed').length;
    return {
      ...doctor,
      appointments: doctorAppointments,
      byDay,
      total: doctorAppointments.length,
      activeCount,
      completedCount,
      needsAction,
    };
  }).sort((first, second) => second.total - first.total || first.name.localeCompare(second.name, 'vi'));

  const visibleResources = resources.length ? resources : [{ id: 'empty-resource', name: 'Chưa có bác sĩ', department: 'Chưa có dữ liệu', raw: {}, appointments: [], byDay: {}, total: 0, activeCount: 0, completedCount: 0, needsAction: 0 }];
  const maxDoctorAppointments = Math.max(1, ...visibleResources.map((doctor) => doctor.total));
  const confirmedFlow = weekAppointments.filter((appointment) => ['confirmed', 'checked_in', 'in_consultation', 'completed'].includes(appointment.status)).length;
  const needsActionTotal = weekAppointments.filter((appointment) => ['booked', 'no_show'].includes(appointment.status)).length;
  const activeDoctorCount = visibleResources.filter((doctor) => doctor.total > 0).length;
  const peakDay = weekDays
    .map((day) => ({ ...day, total: weekAppointments.filter((appointment) => getDateKey(appointment.appointmentTime) === day.key).length }))
    .sort((first, second) => second.total - first.total)[0];
  const busiestDoctor = visibleResources.slice().sort((first, second) => second.total - first.total)[0];

  function getStatusMeta(appointment) {
    const legend = CALENDAR_STATUS_LEGEND.find((item) => item.key === appointment.status);
    const fallback = STATUS_META[appointment.status] || { label: appointment.status || 'Không rõ', tone: 'slate' };
    return legend || { key: appointment.status, label: fallback.label, hint: '', tone: fallback.tone };
  }

  function getLoadTone(total) {
    if (total >= 10) return 'red';
    if (total >= 6) return 'amber';
    if (total > 0) return 'green';
    return 'slate';
  }

  return (
    <section className="sched-appt-panel sched-appt-calendar sched-appt-calendar-pro">
      <header className="sched-appt-calendar-pro__hero">
        <div>
          <span>Weekly doctor view · database driven</span>
          <h2>Lịch hẹn theo bác sĩ trong tuần</h2>
          <p>{formatDate(weekRange.start)} - {formatDate(weekRange.end)} · theo dõi tải bác sĩ, trạng thái appointment, queue/encounter và ca cần xử lý.</p>
        </div>
        <div className="sched-appt-calendar-pro__hero-actions">
          <article><span>Tổng lịch</span><strong>{formatNumber(weekAppointments.length)}</strong><small>appointment trong tuần</small></article>
          <article><span>Bác sĩ có lịch</span><strong>{formatNumber(activeDoctorCount)}</strong><small>{formatNumber(visibleResources.length)} resource</small></article>
          <article className={needsActionTotal ? 'is-warning' : 'is-ok'}><span>Cần xử lý</span><strong>{formatNumber(needsActionTotal)}</strong><small>chờ xác nhận / no-show</small></article>
          <article><span>Đang trong flow</span><strong>{formatNumber(confirmedFlow)}</strong><small>confirmed → completed</small></article>
        </div>
      </header>

      <div className="sched-appt-calendar-pro__insights">
        <article>
          <b>Ngày cao điểm</b>
          <strong>{peakDay?.label || '--'} · {peakDay?.display || '--'}</strong>
          <span>{formatNumber(peakDay?.total || 0)} lịch</span>
        </article>
        <article>
          <b>Bác sĩ tải cao nhất</b>
          <strong>{busiestDoctor?.name || 'Chưa có dữ liệu'}</strong>
          <span>{formatNumber(busiestDoctor?.total || 0)} lịch · {busiestDoctor?.department || 'chưa gắn khoa'}</span>
        </article>
        <article>
          <b>Chất lượng flow</b>
          <strong>{formatPercent(weekAppointments.length ? (confirmedFlow / weekAppointments.length) * 100 : 0)}</strong>
          <span>đã xác nhận / vào quy trình</span>
        </article>
      </div>

      <div className="sched-appt-calendar-pro__legend" aria-label="Chú giải màu trạng thái">
        {CALENDAR_STATUS_LEGEND.map((item) => (
          <span key={item.key} className={`is-${item.tone}`}>
            <i aria-hidden="true" />
            <b>{item.label}</b>
            <small>{item.hint}</small>
          </span>
        ))}
      </div>

      <div className="sched-appt-calendar-pro__board">
        <div className="sched-appt-calendar-pro__grid" style={{ '--week-days': weekDays.length }}>
          <div className="sched-appt-calendar-pro__doctor-head">
            <strong>Bác sĩ / tải tuần</strong>
            <span>DB resource + appointment</span>
          </div>
          {weekDays.map((day) => (
            <div key={day.key} className={`sched-appt-calendar-pro__day-head ${day.isSelected ? 'is-selected' : ''}`}>
              <strong>{day.label}</strong>
              <span>{day.display}</span>
              <small>{formatNumber(weekAppointments.filter((item) => getDateKey(item.appointmentTime) === day.key).length)} lịch</small>
            </div>
          ))}

          {visibleResources.map((doctor) => {
            const loadTone = getLoadTone(doctor.total);
            return (
              <div key={doctor.id} className="sched-appt-calendar-pro__resource-row">
                <aside className="sched-appt-calendar-pro__doctor-card">
                  <b>{getInitials(doctor.name)}</b>
                  <div>
                    <strong>{doctor.name}</strong>
                    <span>{doctor.department || 'Chưa gắn khoa'}</span>
                    <em className={`is-${loadTone}`} style={{ '--load': `${Math.round((doctor.total / maxDoctorAppointments) * 100)}%` }}><i /></em>
                    <small>{formatNumber(doctor.activeCount)} hiệu lực · {formatNumber(doctor.needsAction)} cần xử lý · {formatNumber(doctor.completedCount)} hoàn tất</small>
                  </div>
                </aside>

                {weekDays.map((day) => {
                  const matches = safeArray(doctor.byDay?.[day.key]);
                  const visibleMatches = matches.slice(0, 4);
                  return (
                    <div key={`${doctor.id}-${day.key}`} className={`sched-appt-calendar-pro__cell ${day.isSelected ? 'is-selected' : ''}`}>
                      {visibleMatches.map((appointment) => {
                        const meta = getStatusMeta(appointment);
                        const queueLabel = getQueueLabel(appointment);
                        return (
                          <article key={appointment.id} className={`sched-appt-calendar-pro-card is-${meta.tone}`} title={`${appointment.patientName} · ${meta.label}`}>
                            <header>
                              <time>{formatClock(appointment.appointmentTime)}</time>
                              <span>{meta.label}</span>
                            </header>
                            <strong>{appointment.patientName}</strong>
                            <small>{appointment.reason || getTypeLabel(appointment.appointmentType)}</small>
                            <footer>
                              <span>{appointment.patientCode}</span>
                              {queueLabel ? <b>{queueLabel}</b> : null}
                            </footer>
                          </article>
                        );
                      })}
                      {matches.length > visibleMatches.length ? <button type="button" className="sched-appt-calendar-pro__more">+{matches.length - visibleMatches.length} lịch khác</button> : null}
                      {!matches.length ? <span className="sched-appt-calendar-pro__empty">Trống</span> : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function normalizePatientOption(item = {}) {
  const patient = item.patient || item.patient_id || {};
  const id = item.patient_id || item.id || item._id || patient.patient_id || patient.id || patient._id;
  return {
    id,
    name: item.full_name || item.patient_name || item.name || patient.full_name || patient.patient_name || 'Bệnh nhân chưa rõ',
    code: item.patient_code || item.code || patient.patient_code || 'BN----',
    phone: item.phone || item.patient_phone || patient.phone || '',
    gender: item.gender || patient.gender || '',
    dateOfBirth: item.date_of_birth || patient.date_of_birth || '',
    status: item.status || patient.status || '',
    raw: item,
  };
}

function normalizeScheduleOption(item = {}) {
  const stats = item.slots_summary || {};
  const id = item.doctor_schedule_id || item.id || item._id;
  const workDate = getDateKey(item.work_date || item.date);
  return {
    id,
    doctorId: item.doctor_id || item.doctorId,
    doctor: item.doctor_name || item.doctor || 'Chưa xác định bác sĩ',
    departmentId: item.department_id || item.departmentId,
    department: item.department_name || item.department || 'Chưa xác định khoa',
    date: workDate,
    start: formatClock(item.shift_start || item.start_time || item.start),
    end: formatClock(item.shift_end || item.end_time || item.end),
    status: item.status || 'draft',
    totalSlots: safeNumber(stats.total_slots ?? item.totalSlots ?? item.total_slots, 0),
    bookedSlots: safeNumber(stats.booked_slots ?? item.bookedSlots ?? item.booked_slots, 0),
    availableSlots: safeNumber(stats.available_slots ?? item.availableSlots ?? item.available_slots, 0),
    utilization: safeNumber(item.utilization_rate ?? item.utilization, 0),
    slotDuration: safeNumber(item.slot_duration_minutes ?? item.slotDuration, 15),
    raw: item,
  };
}

function normalizeSlotOption(item = {}, schedule = {}) {
  const appointmentTime = item.slot_time || item.start_time || item.appointment_time;
  const endTime = item.slot_end || item.end_time;
  const scheduleSlotId = item.schedule_slot_id || item.id || item._id || '';
  return {
    key: scheduleSlotId || `${schedule.id || 'slot'}-${appointmentTime}`,
    scheduleSlotId,
    appointmentTime,
    endTime,
    time: formatClock(appointmentTime),
    end: formatClock(endTime),
    status: item.status || 'available',
    isAvailable: item.is_available !== false && item.is_booked !== true && item.is_blocked !== true,
    raw: item,
  };
}

function getPatientFacts(patient) {
  const raw = patient?.raw || {};
  return [
    { label: 'Mã BN', value: patient?.code || raw.patient_code || '--' },
    { label: 'SĐT', value: patient?.phone || raw.phone || raw.mobile || '--' },
    { label: 'Giới tính', value: patient?.gender || raw.gender || '--' },
    { label: 'Ngày sinh', value: formatDate(patient?.dateOfBirth || raw.date_of_birth || raw.dob) || '--' },
    { label: 'Trạng thái', value: patient?.status || raw.status || 'active' },
    { label: 'Bảo hiểm', value: raw.insurance_number || raw.health_insurance_no || raw.insurance?.policy_number || '--' },
  ];
}

function getDoctorFacts(doctor, schedules = []) {
  const raw = doctor?.raw || {};
  return [
    { label: 'Khoa', value: doctor?.department || raw.department_name || raw.department?.name || '--' },
    { label: 'Chuyên môn', value: raw.specialty || raw.specialization || raw.doctor_profile?.specialty || '--' },
    { label: 'Mã nhân sự', value: raw.employee_code || raw.staff_code || raw.code || '--' },
    { label: 'Lịch publish', value: `${formatNumber(schedules.length)} lịch` },
    { label: 'Slot trống', value: `${formatNumber(schedules.reduce((sum, item) => sum + safeNumber(item.availableSlots, 0), 0))} slot` },
    { label: 'Utilization TB', value: formatPercent(schedules.length ? schedules.reduce((sum, item) => sum + safeNumber(item.utilization, 0), 0) / schedules.length : 0) },
  ];
}

function CreateInfoCard({ type, title, subtitle, facts, emptyText }) {
  return (
    <aside className={`sched-appt-smart-card is-${type}`}>
      <header>
        <b>{type === 'patient' ? <UsersRound size={18} /> : <Stethoscope size={18} />}</b>
        <div>
          <span>{type === 'patient' ? 'Patient profile' : 'Doctor resource'}</span>
          <strong>{title || emptyText}</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
      </header>
      <div className="sched-appt-smart-card__facts">
        {safeArray(facts).map((fact) => (
          <span key={fact.label}><small>{fact.label}</small><b>{fact.value || '--'}</b></span>
        ))}
      </div>
    </aside>
  );
}

function CreateProcessRail({ logs, validationState, selectedPatient, selectedDoctor, selectedSchedule, selectedSlot }) {
  const checks = [
    { label: 'Hồ sơ bệnh nhân', ok: Boolean(selectedPatient?.id), hint: selectedPatient?.code || 'Chưa chọn' },
    { label: 'Bác sĩ/khoa', ok: Boolean(selectedDoctor?.id), hint: selectedDoctor?.name || 'Chưa chọn' },
    { label: 'Lịch làm việc', ok: Boolean(selectedSchedule?.id), hint: selectedSchedule ? `${formatDate(selectedSchedule.date)} · ${selectedSchedule.start}-${selectedSchedule.end}` : 'Chưa chọn' },
    { label: 'Slot trống', ok: Boolean(selectedSlot?.appointmentTime), hint: selectedSlot ? `${formatClock(selectedSlot.appointmentTime)} · ${formatDate(selectedSlot.appointmentTime)}` : 'Chưa chọn' },
    { label: 'Kiểm tra backend', ok: validationState.status === 'ok', warn: validationState.status === 'checking', error: validationState.status === 'error', hint: validationState.message },
  ];
  return (
    <aside className="sched-appt-create-console">
      <header>
        <span>Booking control tower</span>
        <h3>Thông báo xuyên suốt quá trình tạo</h3>
      </header>
      <div className="sched-appt-create-console__checks">
        {checks.map((item) => (
          <article key={item.label} className={item.error ? 'is-error' : item.ok ? 'is-ok' : item.warn ? 'is-warning' : ''}>
            <CheckCircle2 size={15} />
            <div><b>{item.label}</b><span>{item.hint}</span></div>
          </article>
        ))}
      </div>
      <div className="sched-appt-create-console__log">
        {logs.slice(-6).reverse().map((item) => (
          <p key={item.id}><time>{item.time}</time><span>{item.text}</span></p>
        ))}
      </div>
    </aside>
  );
}

function CreateWizard({ data, date, onAction }) {
  const [step, setStep] = useState(1);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientState, setPatientState] = useState({ loading: false, error: '', items: [] });
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [bookingDate, setBookingDate] = useState(() => date || getTodayKey());
  const [doctorId, setDoctorId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [appointmentType, setAppointmentType] = useState('outpatient');
  const [reason, setReason] = useState('Khám chuyên khoa');
  const [scheduleState, setScheduleState] = useState({ loading: false, error: '', items: [] });
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [slotState, setSlotState] = useState({ loading: false, error: '', items: [] });
  const [selectedSlotKey, setSelectedSlotKey] = useState('');
  const [validationState, setValidationState] = useState({ status: 'idle', message: 'Chọn đủ bệnh nhân, bác sĩ và slot để kiểm tra.' });
  const [localMessage, setLocalMessage] = useState('');
  const [logs, setLogs] = useState(() => [{ id: 'boot', time: formatClock(new Date()), text: 'Sẵn sàng tạo lịch hẹn an toàn với kiểm tra backend.' }]);

  const pushLog = useCallback((text) => {
    setLogs((current) => [...current.slice(-12), { id: `${Date.now()}-${Math.random()}`, time: formatClock(new Date()), text }]);
  }, []);

  const departments = useMemo(() => safeArray(data.departments).filter((item) => item.id), [data.departments]);
  const doctors = useMemo(() => safeArray(data.doctors).filter((item) => item.id), [data.doctors]);
  const visibleDoctors = useMemo(() => {
    if (!departmentId) return doctors;
    return doctors.filter((doctor) => String(doctor.departmentId || doctor.raw?.department_id || '') === String(departmentId));
  }, [departmentId, doctors]);
  const selectedDoctor = doctors.find((item) => String(item.id) === String(doctorId));
  const selectedDepartment = departments.find((item) => String(item.id) === String(departmentId));
  const selectedSchedule = scheduleState.items.find((item) => String(item.id) === String(selectedScheduleId)) || scheduleState.items[0];
  const selectedSlot = slotState.items.find((item) => String(item.key) === String(selectedSlotKey)) || slotState.items[0];
  const scheduleEndDate = getLocalDateKey(addLocalDays(bookingDate, 13));
  const canChooseDepartment = departments.length > 0;
  const canChooseDoctor = visibleDoctors.length > 0;

  const baseBookingPayload = useMemo(() => {
    if (!selectedPatient?.id || !doctorId || !departmentId || !selectedSchedule?.id || !selectedSlot?.appointmentTime) return null;
    return {
      patient_id: selectedPatient.id,
      doctor_id: doctorId,
      department_id: departmentId,
      doctor_schedule_id: selectedSchedule.id,
      ...(selectedSlot.scheduleSlotId ? { schedule_slot_id: selectedSlot.scheduleSlotId } : {}),
      appointment_time: selectedSlot.appointmentTime,
    };
  }, [departmentId, doctorId, selectedPatient, selectedSchedule, selectedSlot]);

  const canSubmit = Boolean(baseBookingPayload) && validationState.status === 'ok';
  const steps = [
    { label: 'Bệnh nhân', available: true, hint: selectedPatient?.code || 'Tra cứu DB' },
    { label: 'Khoa / bác sĩ', available: Boolean(selectedPatient?.id), hint: selectedDoctor?.name || 'Chọn resource' },
    { label: 'Chọn slot', available: Boolean(selectedPatient?.id && doctorId && departmentId), hint: selectedSlot ? `${selectedSlot.time}` : 'Slot active' },
    { label: 'Xác nhận', available: Boolean(baseBookingPayload), hint: validationState.status === 'ok' ? 'Đủ điều kiện' : 'Đang kiểm tra' },
  ];

  useEffect(() => { if (date) setBookingDate(date); }, [date]);

  useEffect(() => {
    let isActive = true;
    const timer = setTimeout(async () => {
      setPatientState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const payload = await schedulingApi.searchPatients({ search: patientQuery.trim() || undefined, status: 'active', limit: 12 });
        if (!isActive) return;
        const items = safeArray(payload?.items).map(normalizePatientOption).filter((patient) => patient.id);
        setPatientState({ loading: false, error: '', items });
        setSelectedPatient((current) => current || items[0] || null);
        pushLog(`${items.length ? 'Đã tải' : 'Không có'} ${formatNumber(items.length)} hồ sơ bệnh nhân từ database.`);
      } catch (error) {
        if (!isActive) return;
        setPatientState({ loading: false, error: error.message, items: [] });
        setSelectedPatient(null);
        pushLog(`Không tải được bệnh nhân: ${error.message}`);
      }
    }, patientQuery.trim() ? 280 : 0);
    return () => { isActive = false; clearTimeout(timer); };
  }, [patientQuery, pushLog]);

  useEffect(() => {
    if (!departmentId && departments[0]?.id) {
      const firstDoctorDepartment = doctors.find((doctor) => doctor.departmentId || doctor.raw?.department_id);
      setDepartmentId(firstDoctorDepartment?.departmentId || firstDoctorDepartment?.raw?.department_id || departments[0].id);
    }
  }, [departmentId, departments, doctors]);

  useEffect(() => {
    if (!departmentId) {
      if (!doctorId && doctors[0]?.id) setDoctorId(doctors[0].id);
      return;
    }
    const currentDoctorStillValid = visibleDoctors.some((doctor) => String(doctor.id) === String(doctorId));
    if (!currentDoctorStillValid) setDoctorId(visibleDoctors[0]?.id || '');
  }, [departmentId, doctorId, doctors, visibleDoctors]);

  useEffect(() => {
    let isActive = true;
    setSelectedScheduleId('');
    setSelectedSlotKey('');
    setSlotState({ loading: false, error: '', items: [] });
    if (!doctorId || !departmentId || !bookingDate) {
      setScheduleState({ loading: false, error: '', items: [] });
      return () => { isActive = false; };
    }
    async function loadSchedules() {
      setScheduleState({ loading: true, error: '', items: [] });
      pushLog('Đang tải lịch làm việc đã publish/active của bác sĩ...');
      try {
        const payload = await schedulingApi.listSchedules({ doctor_id: doctorId, department_id: departmentId, date_from: bookingDate, date_to: scheduleEndDate, status: 'published,active', limit: 80 });
        if (!isActive) return;
        const items = safeArray(payload?.items)
          .map(normalizeScheduleOption)
          .filter((schedule) => schedule.id && ['published', 'active'].includes(schedule.status))
          .sort((first, second) => `${first.date} ${first.start}`.localeCompare(`${second.date} ${second.start}`));
        setScheduleState({ loading: false, error: '', items });
        setSelectedScheduleId(items.find((schedule) => schedule.availableSlots > 0)?.id || items[0]?.id || '');
        pushLog(`Đã nhận ${formatNumber(items.length)} lịch làm việc phù hợp từ backend.`);
      } catch (error) {
        if (!isActive) return;
        setScheduleState({ loading: false, error: error.message, items: [] });
        pushLog(`Không tải được lịch bác sĩ: ${error.message}`);
      }
    }
    loadSchedules();
    return () => { isActive = false; };
  }, [bookingDate, departmentId, doctorId, scheduleEndDate, pushLog]);

  useEffect(() => {
    let isActive = true;
    setSelectedSlotKey('');
    if (!selectedSchedule?.id) {
      setSlotState({ loading: false, error: '', items: [] });
      return () => { isActive = false; };
    }
    async function loadSlots() {
      setSlotState({ loading: true, error: '', items: [] });
      pushLog('Đang tải slot còn trống của lịch đã chọn...');
      try {
        const payload = await schedulingApi.getScheduleSlotsAvailable(selectedSchedule.id, { only_available: 'true' });
        if (!isActive) return;
        const items = safeArray(payload?.items)
          .map((item) => normalizeSlotOption(item, selectedSchedule))
          .filter((slot) => slot.appointmentTime && slot.isAvailable)
          .sort((first, second) => new Date(first.appointmentTime) - new Date(second.appointmentTime));
        setSlotState({ loading: false, error: '', items });
        setSelectedSlotKey(items[0]?.key || '');
        pushLog(`Đã tải ${formatNumber(items.length)} slot khả dụng từ database.`);
      } catch (error) {
        if (!isActive) return;
        setSlotState({ loading: false, error: error.message, items: [] });
        pushLog(`Không tải được slot: ${error.message}`);
      }
    }
    loadSlots();
    return () => { isActive = false; };
  }, [selectedSchedule, pushLog]);

  useEffect(() => {
    let isActive = true;
    if (!baseBookingPayload) {
      setValidationState({ status: 'idle', message: 'Chọn đủ bệnh nhân, bác sĩ và slot để kiểm tra.' });
      return () => { isActive = false; };
    }
    async function validateBooking() {
      setValidationState({ status: 'checking', message: 'Đang kiểm tra bệnh nhân, lịch bác sĩ và slot...' });
      pushLog('Đang gọi backend kiểm tra eligibility, slot và lịch trùng...');
      try {
        const [patientEligibility, slotValidation, duplicateCheck] = await Promise.all([
          schedulingApi.checkPatientCanBookAppointment(baseBookingPayload.patient_id),
          schedulingApi.validateAppointmentSlot(baseBookingPayload),
          schedulingApi.checkPatientDuplicate(baseBookingPayload),
        ]);
        if (!isActive) return;
        if (patientEligibility?.can_book === false) throw new Error(patientEligibility.reasons?.[0] || 'Bệnh nhân chưa đủ điều kiện đặt lịch.');
        if (duplicateCheck?.has_duplicate) throw new Error('Bệnh nhân đang có lịch hẹn trùng hoặc quá gần khung giờ này.');
        setValidationState({ status: 'ok', message: slotValidation?.doctor_schedule_id ? 'Slot hợp lệ, bệnh nhân đủ điều kiện và không có lịch trùng.' : 'Slot hợp lệ và sẵn sàng tạo lịch hẹn.' });
        pushLog('Backend xác nhận có thể tạo lịch hẹn an toàn.');
      } catch (error) {
        if (!isActive) return;
        setValidationState({ status: 'error', message: error.message || 'Không kiểm tra được slot đặt lịch.' });
        pushLog(`Backend cảnh báo: ${error.message || 'Không kiểm tra được slot.'}`);
      }
    }
    validateBooking();
    return () => { isActive = false; };
  }, [baseBookingPayload, pushLog]);

  function choosePatient(patient) {
    setSelectedPatient(patient);
    pushLog(`Đã chọn bệnh nhân ${patient.name} · ${patient.code}.`);
  }

  function chooseDepartment(nextDepartmentId) {
    setDepartmentId(nextDepartmentId);
    const nextDepartment = departments.find((item) => String(item.id) === String(nextDepartmentId));
    const nextDoctor = doctors.find((doctor) => String(doctor.departmentId || doctor.raw?.department_id || '') === String(nextDepartmentId));
    setDoctorId(nextDoctor?.id || '');
    pushLog(`Đã chọn khoa ${nextDepartment?.name || nextDepartmentId}.`);
  }

  function chooseDoctor(nextDoctorId) {
    setDoctorId(nextDoctorId);
    const doctor = doctors.find((item) => String(item.id) === String(nextDoctorId));
    if (doctor?.departmentId && String(doctor.departmentId) !== String(departmentId)) setDepartmentId(doctor.departmentId);
    pushLog(`Đã chọn bác sĩ ${doctor?.name || nextDoctorId}.`);
  }

  async function submit(status) {
    if (!baseBookingPayload) { onAction('create-missing-data'); return; }
    if (!canSubmit) { setLocalMessage(validationState.message || 'Cần xử lý cảnh báo trước khi tạo lịch hẹn.'); return; }
    setLocalMessage('');
    pushLog(status === 'confirmed' ? 'Đang tạo lịch và xác nhận ngay...' : 'Đang tạo lịch ở trạng thái booked...');
    const result = await onAction('create', null, { ...baseBookingPayload, appointment_type: appointmentType, reason, status });
    if (result?.ok) pushLog('Tạo lịch thành công. Danh sách và KPI sẽ được làm mới.');
  }

  const patientFacts = getPatientFacts(selectedPatient);
  const doctorFacts = getDoctorFacts(selectedDoctor, scheduleState.items);

  return (
    <section className="sched-appt-create sched-appt-create-pro">
      <nav className="sched-appt-create-pro__steps">
        {steps.map((item, index) => (
          <button key={item.label} type="button" className={step === index + 1 ? 'is-active' : item.available ? 'is-ready' : ''} onClick={() => item.available && setStep(index + 1)} disabled={!item.available}>
            <b>{index + 1}</b><span>{item.label}</span><small>{item.hint}</small>
          </button>
        ))}
      </nav>

      <div className="sched-appt-create-pro__layout">
        <div className="sched-appt-create__body">
          {localMessage ? <p className="sched-appt-create__message is-warning">{localMessage}</p> : null}
          {step === 1 ? (
            <section>
              <div className="sched-appt-create__section-head">
                <div><h2>Chọn bệnh nhân</h2><p>{patientState.loading ? 'Đang tìm trong database...' : `${formatNumber(patientState.items.length)} hồ sơ khả dụng`}</p></div>
                {selectedPatient?.id ? <span className="is-green">Đã chọn {selectedPatient.code}</span> : <span>Chưa chọn</span>}
              </div>
              <label className="sched-appt-create-pro__search"><Search size={16} /><input value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Tên, mã BN, SĐT..." /></label>
              {patientState.error ? <p className="sched-appt-create__message is-warning">{patientState.error}</p> : null}
              <div className="sched-appt-create-pro__patient-grid">
                {patientState.items.map((patient) => (
                  <button key={patient.id || patient.code || patient.name} type="button" className={String(patient.id) === String(selectedPatient?.id) ? 'is-active' : ''} onClick={() => choosePatient(patient)} disabled={!patient.id}>
                    <strong>{patient.name}</strong>
                    <span>{patient.code}</span>
                    <small>{[patient.phone || 'Chưa có SĐT', patient.gender || 'chưa rõ giới tính', patient.status || 'active'].filter(Boolean).join(' · ')}</small>
                  </button>
                ))}
                {!patientState.loading && !patientState.items.length ? <p className="sched-appt-empty">Không tìm thấy hồ sơ bệnh nhân phù hợp trong database.</p> : null}
              </div>
              <div className="sched-appt-create__actions"><button type="button" className="is-primary" onClick={() => setStep(2)} disabled={!selectedPatient?.id}><ChevronRight size={16} />Tiếp tục</button></div>
            </section>
          ) : null}

          {step === 2 ? (
            <section>
              <div className="sched-appt-create__section-head">
                <div><h2>Chọn khoa, bác sĩ và loại lịch</h2><p>{canChooseDoctor ? `${formatNumber(visibleDoctors.length)} bác sĩ đang khả dụng trong khoa` : 'Chưa có bác sĩ khả dụng cho khoa này'}</p></div>
                <span>{selectedPatient?.name || 'Chưa chọn bệnh nhân'}</span>
              </div>
              <div className="sched-appt-form-grid">
                <label>Ngày đặt lịch<input type="date" value={bookingDate} onChange={(event) => { setBookingDate(event.target.value); pushLog(`Đổi ngày tìm slot sang ${formatDate(event.target.value)}.`); }} /></label>
                <label>Khoa<select value={departmentId} onChange={(event) => chooseDepartment(event.target.value)} disabled={!canChooseDepartment}>{departments.map((item) => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}</select></label>
                <label>Bác sĩ<select value={doctorId} onChange={(event) => chooseDoctor(event.target.value)} disabled={!canChooseDoctor}>{visibleDoctors.map((item) => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}</select></label>
                <label>Loại lịch<select value={appointmentType} onChange={(event) => { setAppointmentType(event.target.value); pushLog(`Loại lịch: ${getTypeLabel(event.target.value)}.`); }}><option value="outpatient">Khám ngoại trú</option><option value="telemedicine">Telehealth</option><option value="procedure">Thủ thuật</option><option value="vaccination">Tiêm chủng</option></select></label>
                <label className="is-wide">Lý do khám<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
              </div>
              <div className="sched-appt-doctor-picks">
                {visibleDoctors.slice(0, 8).map((doctor) => (
                  <button key={doctor.id} type="button" className={String(doctor.id) === String(doctorId) ? 'is-active' : ''} onClick={() => chooseDoctor(doctor.id)}>
                    <b>{getInitials(doctor.name)}</b><span><strong>{doctor.name}</strong><small>{doctor.department || 'Chưa gắn khoa'}</small></span>
                  </button>
                ))}
              </div>
              <div className="sched-appt-create__actions"><button type="button" onClick={() => setStep(1)}>Quay lại</button><button type="button" className="is-primary" onClick={() => setStep(3)} disabled={!doctorId || !departmentId}><ChevronRight size={16} />Tìm slot</button></div>
            </section>
          ) : null}

          {step === 3 ? (
            <section>
              <div className="sched-appt-create__section-head">
                <div><h2>Chọn slot phù hợp</h2><p>{formatDate(bookingDate)} - {formatDate(scheduleEndDate)}</p></div>
                <span>{selectedDoctor?.name || 'Chưa chọn bác sĩ'}</span>
              </div>
              {scheduleState.error ? <p className="sched-appt-create__message is-warning">{scheduleState.error}</p> : null}
              {slotState.error ? <p className="sched-appt-create__message is-warning">{slotState.error}</p> : null}
              <div className="sched-appt-create__slot-picker sched-appt-create-pro__slot-picker">
                <div><h3>Lịch làm việc</h3><div className="sched-appt-slot-cards">
                  {scheduleState.items.map((schedule) => (
                    <button key={schedule.id} type="button" className={String(selectedSchedule?.id) === String(schedule.id) ? 'is-active' : ''} onClick={() => { setSelectedScheduleId(schedule.id); pushLog(`Chọn lịch ${formatDate(schedule.date)} · ${schedule.start}-${schedule.end}.`); }}>
                      <strong>{formatDate(schedule.date)} · {schedule.start} - {schedule.end}</strong><span>{schedule.doctor}</span><small>{schedule.department} · còn {schedule.availableSlots} slot · {formatPercent(schedule.utilization)}</small>
                    </button>
                  ))}
                  {scheduleState.loading ? <p>Đang tải lịch làm việc từ database...</p> : null}
                  {!scheduleState.loading && !scheduleState.items.length ? <p>Không có lịch đã publish/active cho lựa chọn hiện tại.</p> : null}
                </div></div>
                <div><h3>Slot còn trống</h3><div className="sched-appt-slot-cards sched-appt-slot-cards--compact">
                  {slotState.items.map((slot) => (
                    <button key={slot.key} type="button" className={String(selectedSlot?.key) === String(slot.key) ? 'is-active' : ''} onClick={() => { setSelectedSlotKey(slot.key); pushLog(`Chọn slot ${slot.time} ngày ${formatDate(slot.appointmentTime)}.`); }}>
                      <strong>{slot.time} - {slot.end}</strong><span>{formatDate(slot.appointmentTime)}</span><small>{slot.scheduleSlotId ? 'Slot đã đồng bộ DB' : 'Slot lý thuyết'}</small>
                    </button>
                  ))}
                  {slotState.loading ? <p>Đang tải slot trống...</p> : null}
                  {!slotState.loading && selectedSchedule?.id && !slotState.items.length ? <p>Lịch này chưa còn slot khả dụng.</p> : null}
                </div></div>
              </div>
              <div className="sched-appt-create__actions"><button type="button" onClick={() => setStep(2)}>Quay lại</button><button type="button" className="is-primary" onClick={() => setStep(4)} disabled={!baseBookingPayload}><ChevronRight size={16} />Kiểm tra & xác nhận</button></div>
            </section>
          ) : null}

          {step === 4 ? (
            <section>
              <div className="sched-appt-create__section-head">
                <div><h2>Xác nhận đặt lịch</h2><p>{validationState.message}</p></div>
                <span className={`is-${validationState.status === 'ok' ? 'green' : validationState.status === 'error' ? 'red' : 'amber'}`}>{validationState.status === 'ok' ? 'Sẵn sàng tạo' : validationState.status === 'checking' ? 'Đang kiểm tra' : 'Cần kiểm tra'}</span>
              </div>
              <div className="sched-appt-create-pro__final">
                <CreateInfoCard type="patient" title={selectedPatient?.name} subtitle={selectedPatient?.code} facts={patientFacts} emptyText="Chưa chọn bệnh nhân" />
                <CreateInfoCard type="doctor" title={selectedDoctor?.name} subtitle={selectedDepartment?.name} facts={doctorFacts} emptyText="Chưa chọn bác sĩ" />
              </div>
              <div className="sched-appt-preview-checks">
                <p><CheckCircle2 size={16} /><span><b>Thời gian:</b> {selectedSlot ? `${formatClock(selectedSlot.appointmentTime)} - ${formatDate(selectedSlot.appointmentTime)}` : 'Chưa chọn slot'}</span></p>
                <p><CheckCircle2 size={16} /><span><b>Loại lịch:</b> {getTypeLabel(appointmentType)} · {reason || 'Chưa nhập lý do'}</span></p>
                <p className={`is-${validationState.status === 'error' ? 'red' : validationState.status === 'ok' ? 'green' : 'amber'}`}><AlertTriangle size={16} /><span><b>Kiểm tra hệ thống:</b> {validationState.message}</span></p>
              </div>
              <div className="sched-appt-create__actions"><button type="button" onClick={() => setStep(3)}>Quay lại</button><button type="button" onClick={() => submit('booked')} disabled={!canSubmit || validationState.status === 'checking'}><Send size={16} />Tạo booked</button><button type="button" className="is-primary" onClick={() => submit('confirmed')} disabled={!canSubmit || validationState.status === 'checking'}><CheckCircle2 size={16} />Tạo và xác nhận</button></div>
            </section>
          ) : null}
        </div>

        <aside className="sched-appt-create-pro__right">
          <CreateInfoCard type="patient" title={selectedPatient?.name} subtitle={selectedPatient ? `${selectedPatient.code} · ${selectedPatient.phone || 'chưa có SĐT'}` : ''} facts={patientFacts} emptyText="Chọn bệnh nhân để xem hồ sơ" />
          <CreateInfoCard type="doctor" title={selectedDoctor?.name} subtitle={selectedDepartment?.name || selectedDoctor?.department || ''} facts={doctorFacts} emptyText="Chọn bác sĩ để xem tải lịch" />
          <CreateProcessRail logs={logs} validationState={validationState} selectedPatient={selectedPatient} selectedDoctor={selectedDoctor} selectedSchedule={selectedSchedule} selectedSlot={selectedSlot} />
        </aside>
      </div>
    </section>
  );
}

function getWaitlistStatusLabel(value) {
  const labels = {
    waiting: 'Đang chờ',
    offered: 'Đã offer slot',
    booked: 'Đã đặt lịch',
    cancelled: 'Đã hủy',
  };
  return labels[value] || value || 'Không rõ';
}

function SlotMatcher({ data, target, targetDate, allowAnyDoctor = false, onSlotChange }) {
  const targetKey = target?.id || target?.patientId || 'slot-target';
  const defaultDate = getDateKey(target?.preferredDate || target?.appointmentTime || targetDate || getTodayKey());
  const departments = useMemo(() => safeArray(data.departments).filter((item) => item.id), [data.departments]);
  const doctors = useMemo(() => safeArray(data.doctors).filter((item) => item.id), [data.doctors]);
  const [bookingDate, setBookingDate] = useState(defaultDate);
  const [departmentId, setDepartmentId] = useState(target?.departmentId || '');
  const [doctorId, setDoctorId] = useState(target?.doctorId || '');
  const [scheduleState, setScheduleState] = useState({ loading: false, error: '', items: [] });
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [slotState, setSlotState] = useState({ loading: false, error: '', items: [] });
  const [selectedSlotKey, setSelectedSlotKey] = useState('');

  const visibleDoctors = useMemo(() => {
    if (!departmentId) return doctors;
    return doctors.filter((doctor) => String(doctor.departmentId || doctor.raw?.department_id || '') === String(departmentId));
  }, [departmentId, doctors]);
  const scheduleEndDate = getLocalDateKey(addLocalDays(bookingDate, 13));
  const selectedSchedule = scheduleState.items.find((item) => String(item.id) === String(selectedScheduleId)) || scheduleState.items[0];
  const selectedSlot = slotState.items.find((item) => String(item.key) === String(selectedSlotKey)) || slotState.items[0];

  useEffect(() => {
    setBookingDate(defaultDate);
    setDepartmentId(target?.departmentId || '');
    setDoctorId(target?.doctorId || '');
    setSelectedScheduleId('');
    setSelectedSlotKey('');
  }, [defaultDate, targetKey, target?.departmentId, target?.doctorId]);

  useEffect(() => {
    if (!departmentId && departments[0]?.id && !allowAnyDoctor) {
      setDepartmentId(target?.departmentId || departments[0].id);
    }
  }, [allowAnyDoctor, departmentId, departments, target?.departmentId]);

  useEffect(() => {
    if (!departmentId || allowAnyDoctor) return;
    const currentDoctorStillValid = visibleDoctors.some((doctor) => String(doctor.id) === String(doctorId));
    if (!currentDoctorStillValid) setDoctorId(visibleDoctors[0]?.id || '');
  }, [allowAnyDoctor, departmentId, doctorId, visibleDoctors]);

  useEffect(() => {
    let isActive = true;
    setSelectedScheduleId('');
    setSelectedSlotKey('');
    setSlotState({ loading: false, error: '', items: [] });

    if (!bookingDate || (!doctorId && !departmentId)) {
      setScheduleState({ loading: false, error: '', items: [] });
      return () => {
        isActive = false;
      };
    }

    async function loadSchedules() {
      setScheduleState({ loading: true, error: '', items: [] });
      try {
        const payload = await schedulingApi.listSchedules({
          ...(doctorId ? { doctor_id: doctorId } : {}),
          ...(departmentId ? { department_id: departmentId } : {}),
          date_from: bookingDate,
          date_to: scheduleEndDate,
          status: 'published,active',
          limit: 120,
        });
        if (!isActive) return;
        const items = safeArray(payload?.items)
          .map(normalizeScheduleOption)
          .filter((schedule) => schedule.id && ['published', 'active'].includes(schedule.status))
          .sort((first, second) => `${first.date} ${first.start}`.localeCompare(`${second.date} ${second.start}`));
        setScheduleState({ loading: false, error: '', items });
        setSelectedScheduleId(items.find((schedule) => schedule.availableSlots > 0)?.id || items[0]?.id || '');
      } catch (error) {
        if (!isActive) return;
        setScheduleState({ loading: false, error: error.message, items: [] });
      }
    }

    loadSchedules();
    return () => {
      isActive = false;
    };
  }, [bookingDate, departmentId, doctorId, scheduleEndDate]);

  useEffect(() => {
    let isActive = true;
    setSelectedSlotKey('');
    if (!selectedSchedule?.id) {
      setSlotState({ loading: false, error: '', items: [] });
      return () => {
        isActive = false;
      };
    }

    async function loadSlots() {
      setSlotState({ loading: true, error: '', items: [] });
      try {
        const payload = await schedulingApi.getScheduleSlotsAvailable(selectedSchedule.id, { only_available: 'true' });
        if (!isActive) return;
        const items = safeArray(payload?.items)
          .map((item) => normalizeSlotOption(item, selectedSchedule))
          .filter((slot) => slot.appointmentTime && slot.isAvailable)
          .sort((first, second) => new Date(first.appointmentTime) - new Date(second.appointmentTime));
        setSlotState({ loading: false, error: '', items });
        setSelectedSlotKey(items[0]?.key || '');
      } catch (error) {
        if (!isActive) return;
        setSlotState({ loading: false, error: error.message, items: [] });
      }
    }

    loadSlots();
    return () => {
      isActive = false;
    };
  }, [selectedSchedule]);

  useEffect(() => {
    if (!selectedSchedule?.id || !selectedSlot?.appointmentTime) {
      onSlotChange?.(null);
      return;
    }
    onSlotChange?.({
      doctor_id: selectedSchedule.doctorId || doctorId,
      department_id: selectedSchedule.departmentId || departmentId,
      doctor_schedule_id: selectedSchedule.id,
      schedule_slot_id: selectedSlot.scheduleSlotId,
      appointment_time: selectedSlot.appointmentTime,
      doctor_name: selectedSchedule.doctor,
      department_name: selectedSchedule.department,
      slot_label: `${formatClock(selectedSlot.appointmentTime)} - ${formatDate(selectedSlot.appointmentTime)}`,
    });
  }, [departmentId, doctorId, onSlotChange, selectedSchedule, selectedSlot]);

  function chooseDepartment(nextDepartmentId) {
    setDepartmentId(nextDepartmentId);
    if (!allowAnyDoctor) {
      const nextDoctor = doctors.find((doctor) => String(doctor.departmentId || doctor.raw?.department_id || '') === String(nextDepartmentId));
      setDoctorId(nextDoctor?.id || '');
    }
  }

  function chooseDoctor(nextDoctorId) {
    setDoctorId(nextDoctorId);
    const doctor = doctors.find((item) => String(item.id) === String(nextDoctorId));
    if (doctor?.departmentId && String(doctor.departmentId) !== String(departmentId)) {
      setDepartmentId(doctor.departmentId);
    }
  }

  return (
    <section className="sched-appt-slot-match">
      <header>
        <div>
          <span>Slot finder</span>
          <h3>Chọn slot trống từ lịch bác sĩ</h3>
        </div>
        <b>{selectedSlot ? `${formatClock(selectedSlot.appointmentTime)} · ${formatDate(selectedSlot.appointmentTime)}` : 'Chưa chọn slot'}</b>
      </header>
      <div className="sched-appt-field-grid">
        <label>Ngày bắt đầu<input type="date" value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} /></label>
        <label>Khoa<select value={departmentId} onChange={(event) => chooseDepartment(event.target.value)}>
          <option value="">Tất cả khoa</option>
          {departments.map((item) => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Bác sĩ<select value={doctorId} onChange={(event) => chooseDoctor(event.target.value)}>
          {allowAnyDoctor ? <option value="">Bất kỳ bác sĩ phù hợp</option> : null}
          {visibleDoctors.map((item) => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}
        </select></label>
      </div>
      <div className="sched-appt-slot-match__columns">
        <div>
          <h4>Lịch làm việc</h4>
          <div className="sched-appt-slot-cards sched-appt-slot-cards--compact">
            {scheduleState.items.map((schedule) => (
              <button key={schedule.id} type="button" className={String(selectedSchedule?.id) === String(schedule.id) ? 'is-active' : ''} onClick={() => setSelectedScheduleId(schedule.id)}>
                <strong>{formatDate(schedule.date)} · {schedule.start} - {schedule.end}</strong>
                <span>{schedule.doctor}</span>
                <small>{schedule.department} - còn {schedule.availableSlots} slot</small>
              </button>
            ))}
            {scheduleState.loading ? <p>Đang tải lịch làm việc...</p> : null}
            {!scheduleState.loading && !scheduleState.items.length ? <p>Không có lịch published/active trong khoảng này.</p> : null}
            {scheduleState.error ? <p className="sched-appt-inline-message is-warning">{scheduleState.error}</p> : null}
          </div>
        </div>
        <div>
          <h4>Slot khả dụng</h4>
          <div className="sched-appt-slot-cards sched-appt-slot-cards--compact">
            {slotState.items.map((slot) => (
              <button key={slot.key} type="button" className={String(selectedSlot?.key) === String(slot.key) ? 'is-active' : ''} onClick={() => setSelectedSlotKey(slot.key)}>
                <strong>{slot.time} - {slot.end}</strong>
                <span>{selectedSchedule?.doctor || '--'}</span>
                <small>{slot.scheduleSlotId ? 'Slot DB khả dụng' : 'Slot theo lịch làm việc'}</small>
              </button>
            ))}
            {slotState.loading ? <p>Đang tải slot trống...</p> : null}
            {!slotState.loading && selectedSchedule?.id && !slotState.items.length ? <p>Lịch này chưa còn slot khả dụng.</p> : null}
            {slotState.error ? <p className="sched-appt-inline-message is-warning">{slotState.error}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function ConfirmationCenter({ rows, onAction }) {
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('auto');
  const pending = useMemo(() => {
    const needle = normalizeText(query);
    return rows
      .filter((item) => ['booked', 'confirmed'].includes(item.status))
      .filter((item) => !needle || normalizeText(`${item.patientName} ${item.patientCode} ${item.patientPhone} ${item.doctorName} ${item.departmentName}`).includes(needle))
      .sort((first, second) => new Date(first.appointmentTime) - new Date(second.appointmentTime));
  }, [query, rows]);
  const bookedCount = pending.filter((item) => item.status === 'booked').length;
  const confirmedCount = pending.filter((item) => item.status === 'confirmed').length;

  return (
    <section className="sched-appt-panel sched-appt-comm">
      <header className="sched-appt-workbench__header">
        <div><span>Communication center</span><h2>Lịch cần xác nhận / nhắc</h2></div>
        <div className="sched-appt-toolbar">
          <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bệnh nhân, SĐT, bác sĩ..." /></label>
          <select value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="auto">Kênh tự động</option>
            <option value="sms">SMS</option>
            <option value="phone">Điện thoại</option>
            <option value="in_app">In-app</option>
          </select>
        </div>
      </header>
      <div className="sched-appt-summary-strip">
        <span><b>{formatNumber(pending.length)}</b>Cần xử lý</span>
        <span><b>{formatNumber(bookedCount)}</b>Chờ xác nhận</span>
        <span><b>{formatNumber(confirmedCount)}</b>Đã xác nhận cần nhắc</span>
      </div>
      <div className="sched-appt-action-list">
        {pending.map((appointment) => (
          <article key={appointment.id} className={`is-${STATUS_META[appointment.status]?.tone || 'slate'}`}>
            <div>
              <strong>{appointment.patientName}</strong>
              <span>{appointment.patientPhone || 'Không có SĐT'} · {formatClock(appointment.appointmentTime)} · {appointment.doctorName}</span>
              <small>{appointment.departmentName} · #{getAppointmentShortId(appointment)}</small>
            </div>
            <StatusBadge value={appointment.status} />
            <div className="sched-appt-row-actions">
              {appointment.status === 'booked' ? <button type="button" onClick={() => onAction('confirm', appointment)}><CheckCircle2 size={15} />Xác nhận</button> : null}
              <button type="button" onClick={() => onAction('reminder', appointment, { channel })}><MessageSquareText size={15} />Gửi nhắc</button>
              <button type="button" onClick={() => onAction('call-logged', appointment, { outcome: 'reached', note: 'Đã gọi xác nhận/nhắc lịch từ scheduling command.' })}><PhoneCall size={15} />Đã gọi</button>
            </div>
          </article>
        ))}
      </div>
      {!pending.length ? <p className="sched-appt-empty">Không có lịch cần xác nhận hoặc nhắc theo bộ lọc hiện tại.</p> : null}
    </section>
  );
}

function RescheduleCancelCenter({ rows, data, date, onAction }) {
  const candidates = useMemo(
    () => rows
      .filter((item) => ['booked', 'confirmed', 'cancelled', 'rescheduled'].includes(item.status))
      .sort((first, second) => new Date(first.appointmentTime) - new Date(second.appointmentTime)),
    [rows],
  );
  const [selectedId, setSelectedId] = useState('');
  const [slotPayload, setSlotPayload] = useState(null);
  const [cancelReason, setCancelReason] = useState('Bệnh nhân yêu cầu hủy/không thể đến đúng lịch.');
  const [rescheduleReason, setRescheduleReason] = useState('Điều phối sang slot phù hợp hơn.');
  const selected = candidates.find((item) => String(item.id) === String(selectedId)) || candidates[0];
  const canChange = selected && ['booked', 'confirmed'].includes(selected.status);

  useEffect(() => {
    if (!selectedId && candidates[0]?.id) setSelectedId(candidates[0].id);
    if (selectedId && !candidates.some((item) => String(item.id) === String(selectedId))) setSelectedId(candidates[0]?.id || '');
  }, [candidates, selectedId]);

  useEffect(() => {
    setSlotPayload(null);
  }, [selected?.id]);

  return (
    <section className="sched-appt-panel sched-appt-change">
      <header className="sched-appt-workbench__header">
        <div><span>Change control</span><h2>Dời / hủy lịch</h2></div>
        <div className="sched-appt-summary-strip is-compact">
          <span><b>{formatNumber(candidates.length)}</b>Trong hàng xử lý</span>
          <span><b>{formatNumber(candidates.filter((item) => ['booked', 'confirmed'].includes(item.status)).length)}</b>Có thể thao tác</span>
        </div>
      </header>
      <div className="sched-appt-workbench">
        <div className="sched-appt-workbench__list">
          {candidates.map((appointment) => (
            <button key={appointment.id} type="button" className={String(selected?.id) === String(appointment.id) ? 'is-selected' : ''} onClick={() => setSelectedId(appointment.id)}>
              <strong>{appointment.patientName}</strong>
              <span>{formatClock(appointment.appointmentTime)} · {appointment.departmentName}</span>
              <small>{appointment.doctorName}</small>
              <StatusBadge value={appointment.status} />
            </button>
          ))}
          {!candidates.length ? <p className="sched-appt-empty">Không có lịch dời/hủy trong ngày đang chọn.</p> : null}
        </div>
        <aside className="sched-appt-action-card">
          {selected ? (
            <>
              <header>
                <div><span>Appointment</span><h3>{selected.patientName}</h3></div>
                <StatusBadge value={selected.status} />
              </header>
              <div className="sched-appt-action-card__meta">
                <span>Hiện tại <b>{formatClock(selected.appointmentTime)} · {formatDate(selected.appointmentTime)}</b></span>
                <span>Bác sĩ <b>{selected.doctorName}</b></span>
                <span>Khoa <b>{selected.departmentName}</b></span>
              </div>
              <label>Lý do dời lịch<textarea value={rescheduleReason} onChange={(event) => setRescheduleReason(event.target.value)} /></label>
              <SlotMatcher data={data} target={selected} targetDate={date} onSlotChange={setSlotPayload} />
              <div className="sched-appt-create__actions">
                <button type="button" className="is-primary" disabled={!canChange || !slotPayload?.appointment_time} onClick={() => onAction('reschedule', selected, {
                  ...slotPayload,
                  appointment_type: selected.appointmentType,
                  reason: rescheduleReason,
                })}><CalendarClock size={16} />Dời sang slot đã chọn</button>
              </div>
              <label>Lý do hủy<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label>
              <div className="sched-appt-create__actions">
                <button type="button" className="is-danger" disabled={!canChange} onClick={() => onAction('cancel', selected, { reason: cancelReason })}><CalendarX2 size={16} />Hủy lịch</button>
              </div>
            </>
          ) : <p className="sched-appt-empty">Chọn một lịch hẹn để xử lý.</p>}
        </aside>
      </div>
    </section>
  );
}

function CheckInBoard({ rows, onAction }) {
  const [query, setQuery] = useState('');
  const candidates = useMemo(() => {
    const needle = normalizeText(query);
    return rows
      .filter((item) => ['booked', 'confirmed', 'checked_in'].includes(item.status))
      .filter((item) => !needle || normalizeText(`${item.patientName} ${item.patientCode} ${item.patientPhone} ${item.doctorName} ${item.departmentName}`).includes(needle))
      .sort((first, second) => new Date(first.appointmentTime) - new Date(second.appointmentTime));
  }, [query, rows]);

  return (
    <section className="sched-appt-panel sched-appt-checkin">
      <header className="sched-appt-workbench__header">
        <div><span>Check-in monitor</span><h2>Bệnh nhân chờ check-in</h2></div>
        <div className="sched-appt-toolbar">
          <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã BN, SĐT, tên..." /></label>
        </div>
      </header>
      <div className="sched-appt-action-list">
        {candidates.map((appointment) => {
          const timeState = getTimeState(appointment);
          const queueLabel = getQueueLabel(appointment);
          return (
            <article key={appointment.id} className={`is-${timeState.tone}`}>
              <time>{formatClock(appointment.appointmentTime)}</time>
              <div>
                <strong>{appointment.patientName}</strong>
                <span>{appointment.patientCode} · {appointment.patientPhone || 'Không có SĐT'}</span>
                <small>{appointment.departmentName} · {appointment.doctorName}</small>
              </div>
              <b>{queueLabel ? `Queue ${queueLabel}` : timeState.label}</b>
              <div className="sched-appt-row-actions">
                {['booked', 'confirmed'].includes(appointment.status) ? (
                  <button type="button" onClick={() => onAction('checkin', appointment)}><ClipboardCheck size={15} />Check-in</button>
                ) : null}
                {appointment.status === 'checked_in' && !queueLabel ? (
                  <button type="button" onClick={() => onAction('queue', appointment)}><UsersRound size={15} />Tạo queue</button>
                ) : null}
                <button type="button" onClick={() => onAction('call-logged', appointment, { outcome: 'frontdesk_contact', note: 'Quầy tiếp nhận đã liên hệ bệnh nhân trong luồng check-in.' })}><PhoneCall size={15} />Ghi nhận gọi</button>
              </div>
            </article>
          );
        })}
      </div>
      {!candidates.length ? <p className="sched-appt-empty">Không có bệnh nhân chờ check-in theo bộ lọc.</p> : null}
    </section>
  );
}

function NoShowBoard({ rows, data, date, onAction }) {
  const candidates = useMemo(
    () => rows
      .filter((item) => item.status === 'no_show' || (['booked', 'confirmed'].includes(item.status) && getLateMinutes(item) >= 15))
      .sort((first, second) => getLateMinutes(second) - getLateMinutes(first)),
    [rows],
  );
  const [selectedId, setSelectedId] = useState('');
  const [slotPayload, setSlotPayload] = useState(null);
  const [reason, setReason] = useState('Bệnh nhân không đến đúng giờ, điều phối lại sau khi liên hệ.');
  const selected = candidates.find((item) => String(item.id) === String(selectedId)) || candidates[0];
  const canMarkNoShow = selected && ['booked', 'confirmed'].includes(selected.status);

  useEffect(() => {
    if (!selectedId && candidates[0]?.id) setSelectedId(candidates[0].id);
    if (selectedId && !candidates.some((item) => String(item.id) === String(selectedId))) setSelectedId(candidates[0]?.id || '');
  }, [candidates, selectedId]);

  useEffect(() => {
    setSlotPayload(null);
  }, [selected?.id]);

  return (
    <section className="sched-appt-panel sched-appt-noshow">
      <header className="sched-appt-workbench__header">
        <div><span>No-show control</span><h2>Quá giờ chưa check-in</h2></div>
        <div className="sched-appt-summary-strip is-compact">
          <span><b>{formatNumber(candidates.length)}</b>Ứng viên no-show</span>
          <span><b>{formatNumber(candidates.filter((item) => item.status === 'no_show').length)}</b>Đã no-show</span>
        </div>
      </header>
      <div className="sched-appt-workbench">
        <div className="sched-appt-workbench__list">
          {candidates.map((appointment) => (
            <button key={appointment.id} type="button" className={String(selected?.id) === String(appointment.id) ? 'is-selected' : ''} onClick={() => setSelectedId(appointment.id)}>
              <strong>{appointment.patientName}</strong>
              <span>{formatClock(appointment.appointmentTime)} · trễ {getLateMinutes(appointment)} phút</span>
              <small>{appointment.departmentName} · {appointment.doctorName}</small>
              <StatusBadge value={appointment.status} />
            </button>
          ))}
          {!candidates.length ? <p className="sched-appt-empty">Chưa có lịch quá giờ cần xử lý.</p> : null}
        </div>
        <aside className="sched-appt-action-card">
          {selected ? (
            <>
              <header>
                <div><span>No-show case</span><h3>{selected.patientName}</h3></div>
                <b className={getLateMinutes(selected) >= 30 ? 'is-red' : 'is-amber'}>Trễ {getLateMinutes(selected)} phút</b>
              </header>
              <div className="sched-appt-action-card__meta">
                <span>Giờ hẹn <b>{formatClock(selected.appointmentTime)} · {formatDate(selected.appointmentTime)}</b></span>
                <span>Liên hệ <b>{selected.patientPhone || 'Chưa có SĐT'}</b></span>
                <span>Phụ trách <b>{selected.departmentName} · {selected.doctorName}</b></span>
              </div>
              <div className="sched-appt-create__actions">
                <button type="button" onClick={() => onAction('call-logged', selected, { outcome: 'no_show_followup', note: 'Đã gọi bệnh nhân quá giờ hẹn.' })}><PhoneCall size={16} />Gọi lại</button>
                <button type="button" disabled={!canMarkNoShow} onClick={() => onAction('reminder', selected, { channel: 'auto', note: 'Bạn đang quá giờ hẹn. Vui lòng phản hồi nếu vẫn đến khám.' })}><MessageSquareText size={16} />Nhắc khẩn</button>
                <button type="button" className="is-danger" disabled={!canMarkNoShow} onClick={() => onAction('noshow', selected)}><UserRoundX size={16} />Đánh dấu no-show</button>
              </div>
              <label>Lý do dời sau no-show<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
              <SlotMatcher data={data} target={selected} targetDate={date} onSlotChange={setSlotPayload} />
              <div className="sched-appt-create__actions">
                <button type="button" className="is-primary" disabled={!canMarkNoShow || !slotPayload?.appointment_time} onClick={() => onAction('reschedule', selected, {
                  ...slotPayload,
                  appointment_type: selected.appointmentType,
                  reason,
                })}><CalendarClock size={16} />Dời lịch thay vì no-show</button>
              </div>
            </>
          ) : <p className="sched-appt-empty">Chọn một ca quá giờ để xử lý.</p>}
        </aside>
      </div>
    </section>
  );
}

function WaitlistCreateForm({ data, onAction }) {
  const [patientQuery, setPatientQuery] = useState('');
  const [patientState, setPatientState] = useState({ loading: false, error: '', items: [] });
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [departmentId, setDepartmentId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [preferredDate, setPreferredDate] = useState(getTodayKey());
  const [preferredTimeRange, setPreferredTimeRange] = useState('Sáng hoặc đầu giờ chiều');
  const [reason, setReason] = useState('Chờ slot sớm hơn hoặc slot phù hợp.');

  const departments = useMemo(() => safeArray(data.departments).filter((item) => item.id), [data.departments]);
  const doctors = useMemo(() => safeArray(data.doctors).filter((item) => item.id), [data.doctors]);
  const visibleDoctors = useMemo(() => {
    if (!departmentId) return doctors;
    return doctors.filter((doctor) => String(doctor.departmentId || doctor.raw?.department_id || '') === String(departmentId));
  }, [departmentId, doctors]);

  useEffect(() => { if (!departmentId && departments[0]?.id) setDepartmentId(departments[0].id); }, [departmentId, departments]);
  useEffect(() => {
    const currentDoctorStillValid = visibleDoctors.some((doctor) => String(doctor.id) === String(doctorId));
    if (!currentDoctorStillValid) setDoctorId('');
  }, [doctorId, visibleDoctors]);

  useEffect(() => {
    let isActive = true;
    const timer = setTimeout(async () => {
      setPatientState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const payload = await schedulingApi.searchPatients({ search: patientQuery.trim() || undefined, status: 'active', limit: 8 });
        if (!isActive) return;
        const items = safeArray(payload?.items).map(normalizePatientOption).filter((patient) => patient.id);
        setPatientState({ loading: false, error: '', items });
        setSelectedPatient((current) => current || items[0] || null);
      } catch (error) {
        if (!isActive) return;
        setPatientState({ loading: false, error: error.message, items: [] });
        setSelectedPatient(null);
      }
    }, patientQuery.trim() ? 260 : 0);
    return () => { isActive = false; clearTimeout(timer); };
  }, [patientQuery]);

  async function submit() {
    if (!selectedPatient?.id || !departmentId) return;
    const result = await onAction('waitlist-create', null, {
      patient_id: selectedPatient.id,
      department_id: departmentId,
      ...(doctorId ? { doctor_id: doctorId } : {}),
      preferred_date: preferredDate,
      preferred_time_range: preferredTimeRange,
      reason,
    });
    if (result?.ok) { setPatientQuery(''); setSelectedPatient(null); }
  }

  return (
    <section className="sched-appt-waitlist-create sched-appt-waitlist-create-pro">
      <header>
        <div><span>New waitlist</span><h3>Thêm bệnh nhân vào danh sách chờ</h3><p>Tạo waitlist từ database bệnh nhân, gắn khoa/bác sĩ và điều kiện slot mong muốn.</p></div>
        <button type="button" className="is-primary" onClick={submit} disabled={!selectedPatient?.id || !departmentId}><CalendarPlus size={16} />Thêm vào waitlist</button>
      </header>
      <div className="sched-appt-waitlist-create-pro__grid">
        <div className="sched-appt-waitlist-create-pro__left">
          <label className="is-wide">Bệnh nhân<input value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Tên, mã BN, SĐT..." /></label>
          {patientState.error ? <p className="sched-appt-inline-message is-warning">{patientState.error}</p> : null}
          <div className="sched-appt-chip-list sched-appt-chip-list-pro">
            {patientState.items.map((patient) => (
              <button key={patient.id} type="button" className={String(patient.id) === String(selectedPatient?.id) ? 'is-selected' : ''} onClick={() => setSelectedPatient(patient)}>
                <strong>{patient.name}</strong><span>{patient.code} · {patient.phone || 'Chưa có SĐT'}</span>
              </button>
            ))}
            {patientState.loading ? <p>Đang tìm bệnh nhân...</p> : null}
          </div>
        </div>
        <div className="sched-appt-field-grid">
          <label>Khoa<select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>{departments.map((item) => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}</select></label>
          <label>Bác sĩ<select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}><option value="">Bất kỳ bác sĩ</option>{visibleDoctors.map((item) => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}</select></label>
          <label>Ngày mong muốn<input type="date" value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} /></label>
          <label>Khung giờ<input value={preferredTimeRange} onChange={(event) => setPreferredTimeRange(event.target.value)} /></label>
          <label className="is-wide">Lý do<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        </div>
      </div>
    </section>
  );
}

function WaitlistBoard({ rows, data, date, onAction }) {
  const [selectedId, setSelectedId] = useState('');
  const [slotPayload, setSlotPayload] = useState(null);
  const [offerMinutes, setOfferMinutes] = useState(30);
  const activeRows = useMemo(() => rows.slice().sort((first, second) => {
    const weight = { waiting: 0, offered: 1, booked: 2, cancelled: 3 };
    return (weight[first.status] ?? 9) - (weight[second.status] ?? 9) || second.waitHours - first.waitHours;
  }), [rows]);
  const selected = activeRows.find((item) => String(item.id) === String(selectedId)) || activeRows[0];
  const canOffer = selected && ['waiting', 'offered'].includes(selected.status) && slotPayload?.schedule_slot_id;
  const canBook = selected && ['waiting', 'offered'].includes(selected.status) && selected.patientId && slotPayload?.appointment_time;
  const waitingCount = rows.filter((item) => item.status === 'waiting').length;
  const offeredCount = rows.filter((item) => item.status === 'offered').length;
  const avgWait = rows.length ? Math.round(rows.reduce((sum, item) => sum + safeNumber(item.waitHours, 0), 0) / rows.length) : 0;

  useEffect(() => {
    if (!selectedId && activeRows[0]?.id) setSelectedId(activeRows[0].id);
    if (selectedId && !activeRows.some((item) => String(item.id) === String(selectedId))) setSelectedId(activeRows[0]?.id || '');
  }, [activeRows, selectedId]);
  useEffect(() => { setSlotPayload(null); }, [selected?.id]);

  return (
    <section className="sched-appt-panel sched-appt-waitlist sched-appt-waitlist-pro">
      <header className="sched-appt-workbench__header sched-appt-waitlist-pro__hero">
        <div><span>Waitlist matching · slot orchestration</span><h2>Danh sách chờ slot</h2><p>Ghép bệnh nhân đang chờ với slot bác sĩ còn trống, gửi offer và chuyển thành appointment thật.</p></div>
        <div className="sched-appt-summary-strip is-compact">
          <span><b>{formatNumber(waitingCount)}</b>Đang chờ</span><span><b>{formatNumber(offeredCount)}</b>Đã offer</span><span><b>{formatNumber(avgWait)}</b>Giờ chờ TB</span>
        </div>
      </header>
      <WaitlistCreateForm data={data} onAction={onAction} />
      <div className="sched-appt-waitlist-pro__workspace">
        <div className="sched-appt-workbench__list sched-appt-waitlist-pro__list">
          {activeRows.map((item) => (
            <button key={item.id} type="button" className={String(selected?.id) === String(item.id) ? 'is-selected' : ''} onClick={() => setSelectedId(item.id)}>
              <span className={`sched-appt-waitlist-pro__status is-${item.status}`}>{getWaitlistStatusLabel(item.status)}</span>
              <strong>{item.patientName}</strong>
              <span>{item.patientCode} · {item.patientPhone || 'chưa có SĐT'} · chờ {item.waitHours} giờ</span>
              <small>{formatDate(item.preferredDate)} · {item.preferredTimeRange} · {item.departmentName}</small>
            </button>
          ))}
          {!activeRows.length ? <p className="sched-appt-empty">Chưa có bệnh nhân trong danh sách chờ.</p> : null}
        </div>
        <aside className="sched-appt-action-card sched-appt-waitlist-pro__detail">
          {selected ? (
            <>
              <header>
                <div><span>Waitlist item</span><h3>{selected.patientName}</h3><p>{selected.reason}</p></div>
                <b>{getWaitlistStatusLabel(selected.status)}</b>
              </header>
              <div className="sched-appt-action-card__meta sched-appt-waitlist-pro__meta">
                <span>Bệnh nhân <b>{selected.patientCode} · {selected.patientPhone || 'Chưa có SĐT'}</b></span>
                <span>Nhu cầu <b>{formatDate(selected.preferredDate)} · {selected.preferredTimeRange}</b></span>
                <span>Khoa/Bác sĩ <b>{selected.departmentName} · {selected.doctorName}</b></span>
                <span>Thời gian chờ <b>{formatNumber(selected.waitHours)} giờ</b></span>
                {selected.offeredSlotStart ? <span>Slot đã offer <b>{formatClock(selected.offeredSlotStart)} · {formatDate(selected.offeredSlotStart)}</b></span> : null}
              </div>
              <SlotMatcher data={data} target={selected} targetDate={selected.preferredDate || date} allowAnyDoctor onSlotChange={setSlotPayload} />
              <div className="sched-appt-field-grid"><label>Giữ offer trong phút<input type="number" min="5" max="240" value={offerMinutes} onChange={(event) => setOfferMinutes(event.target.value)} /></label></div>
              <div className="sched-appt-create__actions">
                <button type="button" disabled={!canOffer} onClick={() => onAction('waitlist-offer', selected, { offered_slot_id: slotPayload.schedule_slot_id, offered_until: new Date(Date.now() + safeNumber(offerMinutes, 30) * 60000).toISOString() })}><Send size={16} />Offer slot</button>
                <button type="button" className="is-primary" disabled={!canBook} onClick={() => onAction('waitlist-book', selected, { ...slotPayload, patient_id: selected.patientId, appointment_type: 'outpatient', reason: selected.reason || 'Đặt lịch từ danh sách chờ', status: 'confirmed' })}><CheckCircle2 size={16} />Đặt lịch từ waitlist</button>
                <button type="button" className="is-danger" disabled={['booked', 'cancelled'].includes(selected.status)} onClick={() => onAction('waitlist-cancel', selected, { reason: 'Hủy khỏi danh sách chờ bởi điều phối viên.' })}><CalendarX2 size={16} />Hủy waitlist</button>
              </div>
            </>
          ) : <p className="sched-appt-empty">Chọn một bệnh nhân để tìm slot phù hợp.</p>}
        </aside>
      </div>
    </section>
  );
}

export function AppointmentCommandPage({ view = 'list' }) {
  const [date, setDate] = useState(getTodayKey);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [message, setMessage] = useState('');
  const data = useAppointmentData(date, view === 'calendar' ? 'week' : 'day');
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.list;

  const filteredRows = useMemo(() => {
    const needle = normalizeText(query);
    return data.appointments.filter((appointment) => {
      const sameTab = activeTab === 'all'
        || (activeTab === 'today' ? getDateKey(appointment.appointmentTime) === date : appointment.status === activeTab);
      if (!sameTab) return false;
      if (!needle) return true;
      return normalizeText(`${appointment.patientName} ${appointment.patientCode} ${appointment.patientPhone} ${appointment.doctorName} ${appointment.departmentName} ${appointment.reason}`).includes(needle);
    });
  }, [activeTab, data.appointments, date, query]);

  useEffect(() => {
    if (!filteredRows.length) {
      if (selectedAppointment) setSelectedAppointment(null);
      return;
    }
    if (!selectedAppointment || !filteredRows.some((item) => item.id === selectedAppointment.id)) {
      setSelectedAppointment(filteredRows[0]);
    }
  }, [filteredRows, selectedAppointment]);

  async function runAppointmentAction(action, appointment, payload = {}) {
    const appointmentLabel = appointment?.patientName ? `${appointment.patientName} (${appointment.patientCode})` : 'lịch hẹn';
    const setStatus = (message) => setMessage(message);

    if (action === 'create-missing-data') {
      setMessage('Cần chọn bệnh nhân, bác sĩ, khoa và lịch làm việc hợp lệ trước khi tạo lịch hẹn.');
      return;
    }


    if (action === 'bulk-confirm') {
      const targets = safeArray(payload.rows).filter((item) => item.status === 'booked').slice(0, 50);
      if (!targets.length) {
        setMessage('Không có lịch chờ xác nhận trong bộ lọc hiện tại.');
        return;
      }
      return runSchedulingAction({
        action: async () => {
          await schedulingApi.bulkConfirmAppointments(targets.map((item) => item.id));
          await data.refresh();
          return { count: targets.length };
        },
        confirm: {
          title: 'Xác nhận hàng loạt',
          body: `Xác nhận ${targets.length} lịch hẹn đang ở trạng thái chờ xác nhận.`,
          confirmLabel: 'xác nhận hàng loạt',
        },
        pendingMessage: 'Đang xác nhận hàng loạt lịch hẹn...',
        successTitle: 'Đã xác nhận hàng loạt',
        successBody: `Đã xác nhận ${targets.length} lịch hẹn và đồng bộ lại dữ liệu.`,
        errorTitle: 'Không xác nhận hàng loạt được',
        errorBody: 'Backend không xử lý được bulk confirm.',
        to: '/scheduling/appointments',
        onStatus: setStatus,
      });
    }

    if (action === 'bulk-reminder') {
      const targets = safeArray(payload.rows).filter((item) => ['booked', 'confirmed'].includes(item.status)).slice(0, 20);
      if (!targets.length) {
        setMessage('Không có lịch phù hợp để nhắc trong bộ lọc hiện tại.');
        return;
      }
      return runSchedulingAction({
        action: async () => {
          const results = [];
          for (const item of targets) {
            results.push(await schedulingApi.sendAppointmentReminder(item.id, { channel: 'auto', note: 'Nhắc lịch hàng loạt từ Appointment Cockpit.' }));
          }
          await data.refresh();
          return results;
        },
        confirm: {
          title: 'Gửi nhắc lịch hàng loạt',
          body: `Gửi nhắc lịch cho tối đa ${targets.length} lịch hẹn đang lọc.`,
          confirmLabel: 'gửi nhắc lịch',
        },
        pendingMessage: 'Đang gửi nhắc lịch hàng loạt...',
        successTitle: 'Đã gửi nhắc lịch',
        successBody: `Đã ghi nhận nhắc lịch cho ${targets.length} lịch hẹn.`,
        errorTitle: 'Không gửi nhắc lịch được',
        errorBody: 'Một hoặc nhiều lịch hẹn không gửi nhắc được.',
        to: '/scheduling/appointments',
        onStatus: setStatus,
      });
    }

    const actionConfig = {
      create: {
        pending: 'Đang tạo lịch hẹn...',
        success: 'Lịch hẹn đã được tạo và đồng bộ.',
        run: () => schedulingApi.createAppointmentByStaff(payload),
        confirm: {
          title: 'Xác nhận tạo lịch hẹn',
          body: `Tạo lịch cho ${payload.patient_id || 'bệnh nhân đã chọn'} lúc ${formatClock(payload.appointment_time)} ngày ${formatDate(payload.appointment_time)}.`,
          confirmLabel: 'tạo lịch hẹn',
        },
      },
      confirm: {
        pending: 'Đang xác nhận lịch hẹn...',
        success: `Đã xác nhận ${appointmentLabel}.`,
        run: () => schedulingApi.confirmAppointment(appointment.id),
      },
      reminder: {
        pending: 'Đang gửi nhắc lịch...',
        success: `Đã gửi nhắc lịch và ghi timeline cho ${appointmentLabel}.`,
        run: () => schedulingApi.sendAppointmentReminder(appointment.id, {
          channel: payload.channel || 'auto',
          note: payload.note,
        }),
      },
      'call-logged': {
        pending: 'Đang ghi nhận cuộc gọi...',
        success: `Đã ghi nhận cuộc gọi cho ${appointmentLabel}.`,
        run: () => schedulingApi.logAppointmentCall(appointment.id, {
          outcome: payload.outcome || 'reached',
          note: payload.note || 'Đã gọi bệnh nhân về lịch hẹn.',
          channel: 'phone',
        }),
      },
      checkin: {
        pending: 'Đang check-in bệnh nhân...',
        success: `Đã check-in ${appointmentLabel}.`,
        run: () => schedulingApi.checkInAppointment(appointment.id),
        confirm: {
          title: 'Xác nhận check-in',
          body: `Đưa ${appointmentLabel} vào luồng tiếp nhận trong ngày.`,
          confirmLabel: 'check-in',
        },
      },
      queue: {
        pending: 'Đang tạo queue từ lịch hẹn...',
        success: `Đã tạo queue cho ${appointmentLabel}.`,
        run: () => schedulingApi.createQueueFromAppointment(appointment.id, {
          queue_type: appointment.raw?.queue_type || 'normal',
          source: 'scheduling_appointment_command',
        }),
        confirm: {
          title: 'Tạo queue từ lịch hẹn',
          body: `Tạo số thứ tự tiếp nhận cho ${appointmentLabel}.`,
          confirmLabel: 'tạo queue',
        },
      },
      noshow: {
        pending: 'Đang đánh dấu no-show...',
        success: `Đã đánh dấu no-show cho ${appointmentLabel}.`,
        run: () => schedulingApi.markAppointmentNoShow(appointment.id),
        confirm: {
          title: 'Xác nhận no-show',
          body: `Thao tác này sẽ chuyển ${appointmentLabel} sang trạng thái no-show.`,
          confirmLabel: 'đánh dấu no-show',
        },
      },
      cancel: {
        pending: 'Đang hủy lịch hẹn...',
        success: `Đã hủy ${appointmentLabel}.`,
        run: () => schedulingApi.cancelAppointment(appointment.id, {
          cancel_reason: payload.reason || payload.cancel_reason || 'Hủy bởi điều phối viên',
          reason: payload.reason || payload.cancel_reason || 'Hủy bởi điều phối viên',
        }),
        confirm: {
          title: 'Xác nhận hủy lịch',
          body: `Hủy lịch hẹn của ${appointmentLabel}. Hành động này sẽ ảnh hưởng slot và queue liên quan.`,
          confirmLabel: 'hủy lịch',
        },
      },
      reschedule: {
        pending: 'Đang dời lịch hẹn...',
        success: `Đã dời lịch cho ${appointmentLabel}.`,
        run: () => {
          if (payload.appointment_time) {
            return schedulingApi.rescheduleAppointment(appointment.id, {
              doctor_id: payload.doctor_id,
              department_id: payload.department_id,
              doctor_schedule_id: payload.doctor_schedule_id,
              schedule_slot_id: payload.schedule_slot_id,
              appointment_time: payload.appointment_time,
              appointment_type: payload.appointment_type || appointment.appointmentType,
              reason: payload.reason || payload.reschedule_reason || 'Dời lịch bởi điều phối viên',
              reschedule_reason: payload.reason || payload.reschedule_reason || 'Dời lịch bởi điều phối viên',
            });
          }
          const nextTime = window.prompt('Nhập thời gian mới theo định dạng YYYY-MM-DDTHH:mm', getDateKey(appointment.appointmentTime) ? `${getDateKey(appointment.appointmentTime)}T${formatClock(appointment.appointmentTime)}` : '');
          if (!nextTime) return Promise.resolve({ skipped: true });
          return schedulingApi.rescheduleAppointment(appointment.id, {
            appointment_time: nextTime,
            reason: 'Dời lịch bởi điều phối viên',
          });
        },
        confirm: {
          title: 'Xác nhận dời lịch',
          body: `Chuẩn bị dời lịch của ${appointmentLabel}. Hệ thống sẽ kiểm tra xung đột trước khi ghi.`,
          confirmLabel: 'dời lịch',
        },
      },
      'waitlist-offer': {
        pending: 'Đang offer slot cho waitlist...',
        success: `Đã gửi offer slot cho ${appointment?.patientName || 'bệnh nhân waitlist'}.`,
        run: () => {
          const offeredSlotId = payload.offered_slot_id || appointment?.offeredSlotId;
          if (!offeredSlotId) {
            throw new Error('Chưa chọn slot phù hợp để offer cho waitlist.');
          }
          return schedulingApi.offerWaitlistSlot(appointment.id, {
            offered_slot_id: offeredSlotId,
            offered_until: payload.offered_until,
          });
        },
        confirm: {
          title: 'Xác nhận offer slot',
          body: `Gửi slot đang đề xuất cho ${appointment?.patientName || 'bệnh nhân waitlist'}.`,
          confirmLabel: 'offer slot',
        },
      },
      'waitlist-book': {
        pending: 'Đang đặt lịch từ waitlist...',
        success: `Đã chuyển ${appointment?.patientName || 'bệnh nhân'} từ waitlist thành lịch hẹn.`,
        run: async () => {
          if (!payload.patient_id || !payload.doctor_id || !payload.department_id || !payload.doctor_schedule_id || !payload.appointment_time) {
            throw new Error('Thiếu bệnh nhân hoặc slot DB để đặt lịch từ waitlist.');
          }
          const created = await schedulingApi.createAppointmentByStaff({
            patient_id: payload.patient_id,
            doctor_id: payload.doctor_id,
            department_id: payload.department_id,
            doctor_schedule_id: payload.doctor_schedule_id,
            ...(payload.schedule_slot_id ? { schedule_slot_id: payload.schedule_slot_id } : {}),
            appointment_time: payload.appointment_time,
            appointment_type: payload.appointment_type || 'outpatient',
            reason: payload.reason || 'Đặt lịch từ danh sách chờ',
            status: payload.status || 'confirmed',
          });
          const appointmentId = created?.appointment?.appointment_id || created?.appointment_id || created?.id;
          if (!appointmentId) throw new Error('Backend đã tạo lịch nhưng không trả mã appointment để đóng waitlist.');
          const waitlist = await schedulingApi.bookWaitlist(appointment.id, { appointment_id: appointmentId });
          return { created, waitlist };
        },
        confirm: {
          title: 'Xác nhận đặt lịch từ waitlist',
          body: `Tạo appointment thật cho ${appointment?.patientName || 'bệnh nhân'} từ slot đã chọn và đóng waitlist.`,
          confirmLabel: 'đặt lịch',
        },
      },
      'waitlist-create': {
        pending: 'Đang thêm bệnh nhân vào danh sách chờ...',
        success: 'Đã thêm bệnh nhân vào danh sách chờ.',
        run: () => schedulingApi.createAppointmentWaitlist(payload),
      },
      'waitlist-cancel': {
        pending: 'Đang hủy waitlist...',
        success: `Đã hủy waitlist của ${appointment?.patientName || 'bệnh nhân'}.`,
        run: () => schedulingApi.cancelWaitlist(appointment.id, {
          reason: payload.reason || payload.cancel_reason || 'Hủy khỏi danh sách chờ bởi điều phối viên.',
        }),
        confirm: {
          title: 'Xác nhận hủy waitlist',
          body: `Đóng yêu cầu chờ slot của ${appointment?.patientName || 'bệnh nhân'}.`,
          confirmLabel: 'hủy waitlist',
        },
      },
    }[action];

    if (!actionConfig) {
      setMessage('Thao tác lịch hẹn chưa được hỗ trợ trên màn hình này.');
      return;
    }

    return runSchedulingAction({
      action: async () => {
        const result = await actionConfig.run();
        await data.refresh();
        return result;
      },
      confirm: actionConfig.confirm,
      pendingMessage: actionConfig.pending,
      successTitle: 'Lịch hẹn đã cập nhật',
      successBody: actionConfig.success,
      errorTitle: 'Không xử lý được lịch hẹn',
      errorBody: 'Không thể xử lý thao tác lịch hẹn.',
      to: '/scheduling/appointments',
      onStatus: setStatus,
    });
  }

  return (
    <main className={`sched-appt-page sched-appt-v2 sched-appt-page--${view}`}>
      <Header config={config} date={date} setDate={setDate} data={data} loading={data.loading} onRefresh={data.refresh} />
      {message ? <p className="sched-appt-toast">{message}</p> : null}
      {data.error ? <p className="sched-appt-notice">{data.error}</p> : null}
      {data.loading ? <p className="sched-appt-loading"><LoaderCircle size={16} />Đang tải dữ liệu lịch hẹn...</p> : null}

      {view !== 'create' ? (
        <>
          <AppointmentCommandStrip
            view={view}
            data={data}
            rows={filteredRows}
            date={date}
            onRefresh={data.refresh}
            onExport={() => {
              downloadJsonFile(`appointments-${view}-${date}.json`, filteredRows);
              setMessage('Đã xuất dữ liệu lịch hẹn theo màn hình hiện tại.');
            }}
          />
          <AppointmentKpis summary={data.summary} />
        </>
      ) : null}

      {view === 'list' ? (
        <>
          <FilterBar query={query} setQuery={setQuery} activeTab={activeTab} setActiveTab={setActiveTab} />
          <section className="sched-appt-layout">
            <AppointmentTable
              rows={filteredRows}
              selected={selectedAppointment}
              onSelect={setSelectedAppointment}
              onAction={runAppointmentAction}
              onExport={() => {
                downloadJsonFile(`appointments-filtered-${date}.json`, filteredRows);
                setMessage('Đã xuất danh sách lịch hẹn đang lọc.');
              }}
            />
            <DetailDrawer appointment={selectedAppointment} />
          </section>
        </>
      ) : null}

      {view === 'calendar' ? <CalendarView appointments={filteredRows} doctors={data.doctors} date={date} /> : null}
      {view === 'create' ? <CreateWizard data={data} date={date} onAction={runAppointmentAction} /> : null}
      {view === 'confirmation' ? <ConfirmationCenter rows={data.appointments} onAction={runAppointmentAction} /> : null}
      {view === 'reschedule' ? <RescheduleCancelCenter rows={data.appointments} data={data} date={date} onAction={runAppointmentAction} /> : null}
      {view === 'checkIn' ? <CheckInBoard rows={data.appointments} onAction={runAppointmentAction} /> : null}
      {view === 'noShow' ? <NoShowBoard rows={data.appointments} data={data} date={date} onAction={runAppointmentAction} /> : null}
      {view === 'waitlist' ? <WaitlistBoard rows={data.waitlistItems} data={data} date={date} onAction={runAppointmentAction} /> : null}

      {view !== 'list' && view !== 'create' ? (
        <section className="sched-appt-secondary-actions">
          <Link to="/scheduling/appointments"><ClipboardCheck size={16} />Quản lý lịch hẹn</Link>
          <Link to="/scheduling/appointments/calendar"><CalendarClock size={16} />Lịch trực quan</Link>
          <Link to="/scheduling/appointments/create"><CalendarPlus size={16} />Tạo lịch hẹn</Link>
          <button type="button" onClick={() => {
            downloadJsonFile(`appointments-${date}.json`, filteredRows);
            setMessage('Đã xuất danh sách lịch hẹn đang lọc.');
          }}><Download size={16} />Xuất danh sách</button>
        </section>
      ) : null}
    </main>
  );
}
