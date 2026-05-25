import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Activity,
  BellRing,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  Gauge,
  Layers3,
  ListOrdered,
  LoaderCircle,
  Megaphone,
  MonitorPlay,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Stethoscope,
  UsersRound,
  WandSparkles,
  Workflow,
} from 'lucide-react';
import { schedulingApi } from '../api/schedulingApi';
import { useSchedulingData } from '../context/SchedulingDataContext';
import { downloadJsonFile, runSchedulingAction } from '../utils/schedulingActions';

const VIEW_CONFIG = {
  dashboard: {
    eyebrow: 'Operations Command Center',
    title: 'Dashboard vận hành',
    copy: 'Một màn hình trả lời nhanh lịch hôm nay, tải khoa/bác sĩ, slot, queue, luồng bệnh nhân và cảnh báo cần xử lý.',
  },
  today: {
    eyebrow: 'Today Worklist',
    title: 'Lịch hôm nay',
    copy: 'Theo dõi lịch làm việc trong ngày theo khoa, bác sĩ, ca khám, trạng thái publish và các việc cần xử lý.',
  },
  queue: {
    eyebrow: 'Realtime Queue',
    title: 'Queue hiện tại',
    copy: 'Điều phối hàng đợi theo trạng thái waiting, called, skipped, in service, completed và no-show.',
  },
  load: {
    eyebrow: 'Resource Load',
    title: 'Tải khoa / bác sĩ / phòng',
    copy: 'Kiểm soát công suất vận hành theo khoa, bác sĩ và tài nguyên phòng khám.',
  },
  capacity: {
    eyebrow: 'Slot Capacity',
    title: 'Slot & công suất',
    copy: 'Theo dõi slot còn trống, slot kín, slot bị khóa và giờ cao điểm trong ngày.',
  },
  alerts: {
    eyebrow: 'Alert Inbox',
    title: 'Cảnh báo vận hành',
    copy: 'Trung tâm cảnh báo cho lịch, slot, queue, khoa, bác sĩ và no-show.',
  },
};

const QUEUE_COLUMNS = [
  { key: 'waiting', label: 'Đang chờ', icon: Clock3 },
  { key: 'called', label: 'Đã gọi', icon: Megaphone },
  { key: 'recalled', label: 'Gọi lại', icon: BellRing },
  { key: 'skipped', label: 'Bỏ qua', icon: AlertTriangle },
  { key: 'in_service', label: 'Đang phục vụ', icon: Stethoscope },
  { key: 'completed', label: 'Hoàn tất', icon: CheckCircle2 },
  { key: 'no_show', label: 'No-show', icon: ShieldAlert },
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

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(safeNumber(value));
}

function formatPercent(value) {
  return `${Math.round(safeNumber(value))}%`;
}

function formatClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 5) || '--:--';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getSettled(result, fallback = null) {
  return result?.status === 'fulfilled' ? result.value : fallback;
}

function getScheduleDate(schedule) {
  return schedule.date || String(schedule.raw?.work_date || '').slice(0, 10);
}

function isTerminalSchedule(schedule) {
  const value = normalizeText(schedule.status);
  return value === 'cancelled' || value === 'canceled' || value === 'completed';
}

function normalizeAppointment(item = {}) {
  return {
    id: item.appointment_id || item.id || item._id,
    patientName: item.patient_name || item.patient?.full_name || 'Bệnh nhân chưa rõ',
    patientCode: item.patient_code || item.patient?.patient_code || 'BN----',
    patientPhone: item.patient_phone || item.patient?.phone || '',
    doctorName: item.doctor_name || item.doctor?.full_name || 'Chưa phân bác sĩ',
    departmentName: item.department_name || item.department?.department_name || 'Chưa xác định khoa',
    doctorId: item.doctor_id,
    departmentId: item.department_id,
    appointmentTime: item.appointment_time || item.time || item.start,
    appointmentType: item.appointment_type || 'outpatient',
    status: item.status || 'booked',
    source: item.source || 'staff',
    reason: item.reason || 'Khám bệnh',
    queue: item.queue_ticket || item.queue || null,
    encounter: item.encounter || null,
    raw: item,
  };
}

function normalizeQueueTicket(item = {}) {
  return {
    id: item.queue_ticket_id || item.id || item._id,
    number: item.display_number || item.queue_number || 'Q---',
    type: item.queue_type || 'normal',
    status: item.status || 'waiting',
    patientName: item.patient_name || 'Bệnh nhân chưa rõ',
    patientCode: item.patient_code || 'BN----',
    doctorName: item.doctor_name || 'Chưa phân bác sĩ',
    departmentName: item.department_name || 'Chưa xác định khoa',
    departmentId: item.department_id,
    doctorId: item.doctor_id,
    appointmentId: item.appointment_id,
    encounterId: item.encounter_id,
    checkinTime: item.checkin_time || item.created_at,
    calledTime: item.called_time,
    serviceStartTime: item.service_start_time,
    completedTime: item.completed_time,
    raw: item,
  };
}

function getWaitMinutes(ticket) {
  const start = new Date(ticket.checkinTime).getTime();
  const end = ticket.serviceStartTime ? new Date(ticket.serviceStartTime).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 60000);
}

function getRiskLevel(utilization, waitMinutes = 0, alertsCount = 0) {
  if (utilization >= 98 || waitMinutes >= 30 || alertsCount >= 3) return 'critical';
  if (utilization >= 85 || waitMinutes >= 15 || alertsCount > 0) return 'warning';
  if (utilization <= 35) return 'low';
  return 'good';
}

function buildFallbackAppointments(schedules, date) {
  const todaySchedules = schedules.filter((item) => getScheduleDate(item) === date).slice(0, 16);
  const statuses = ['booked', 'confirmed', 'checked_in', 'in_consultation', 'completed', 'no_show', 'cancelled'];

  return todaySchedules.flatMap((schedule, scheduleIndex) => {
    const count = Math.min(Math.max(safeNumber(schedule.bookedSlots), 1), 4);
    return Array.from({ length: count }).map((_, index) => {
      const hour = String(Math.min(7 + scheduleIndex + index, 17)).padStart(2, '0');
      const status = statuses[(scheduleIndex + index) % statuses.length];
      return normalizeAppointment({
        appointment_id: `demo-apt-${schedule.id}-${index}`,
        patient_name: ['Nguyễn Văn An', 'Trần Minh Châu', 'Lê Hoàng Nam', 'Phạm Thu Hà'][index % 4],
        patient_code: `BN${String(scheduleIndex * 10 + index + 101).padStart(5, '0')}`,
        patient_phone: `09${String(scheduleIndex * 1000 + index * 11).padStart(8, '0')}`,
        doctor_name: schedule.doctor,
        department_name: schedule.department,
        doctor_id: schedule.doctorId,
        department_id: schedule.departmentId,
        appointment_time: `${date}T${hour}:${index % 2 ? '30' : '00'}:00`,
        appointment_type: index % 3 === 0 ? 'telemedicine' : 'outpatient',
        source: index % 2 ? 'portal' : 'staff',
        status,
        reason: index % 2 ? 'Tái khám' : 'Khám chuyên khoa',
      });
    });
  });
}

function buildFallbackQueue(appointments) {
  return appointments
    .filter((item) => ['checked_in', 'in_consultation', 'completed', 'no_show'].includes(item.status))
    .slice(0, 18)
    .map((item, index) => normalizeQueueTicket({
      queue_ticket_id: `demo-queue-${item.id}`,
      queue_number: `${String(item.departmentName || 'Q').slice(0, 2).toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
      queue_type: index % 5 === 0 ? 'priority' : 'normal',
      status: item.status === 'checked_in' ? 'waiting' : item.status === 'in_consultation' ? 'in_service' : item.status,
      patient_name: item.patientName,
      patient_code: item.patientCode,
      doctor_name: item.doctorName,
      department_name: item.departmentName,
      department_id: item.departmentId,
      doctor_id: item.doctorId,
      appointment_id: item.id,
      checkin_time: new Date(Date.now() - (index + 4) * 60000).toISOString(),
    }));
}

function buildSummaryFromAppointments(appointments) {
  const count = (status) => appointments.filter((item) => item.status === status).length;
  return {
    total: appointments.length,
    booked: count('booked'),
    confirmed: count('confirmed'),
    checked_in: count('checked_in'),
    in_consultation: count('in_consultation'),
    completed: count('completed'),
    cancelled: count('cancelled'),
    no_show: count('no_show'),
    rescheduled: count('rescheduled'),
    upcoming: appointments.filter((item) => ['booked', 'confirmed'].includes(item.status)).length,
    no_show_rate: appointments.length ? (count('no_show') / appointments.length) * 100 : 0,
    cancellation_rate: appointments.length ? (count('cancelled') / appointments.length) * 100 : 0,
  };
}

function buildQueueSummary(queueItems) {
  const count = (status) => queueItems.filter((item) => item.status === status).length;
  const waitMinutes = queueItems.map(getWaitMinutes);
  return {
    total: queueItems.length,
    waiting: count('waiting'),
    called: queueItems.filter((item) => ['called', 'recalled'].includes(item.status)).length,
    recalled: count('recalled'),
    in_service: count('in_service'),
    completed: count('completed'),
    cancelled: count('cancelled'),
    skipped: count('skipped'),
    no_show: count('no_show'),
    avg_wait_minutes: waitMinutes.length ? Math.round(waitMinutes.reduce((sum, value) => sum + value, 0) / waitMinutes.length) : 0,
    max_wait_minutes: waitMinutes.length ? Math.max(...waitMinutes) : 0,
    waiting_over_15m: waitMinutes.filter((value) => value >= 15).length,
    waiting_over_30m: waitMinutes.filter((value) => value >= 30).length,
  };
}

function buildDepartmentLoad(schedules, appointments, queueItems, departments) {
  const groups = new Map();
  departments.forEach((department) => {
    groups.set(String(department.id || department.name), {
      id: department.id || department.name,
      name: department.name,
      schedules: 0,
      doctors: new Set(),
      totalSlots: 0,
      bookedSlots: 0,
      availableSlots: 0,
      blockedSlots: 0,
      appointments: 0,
      queueWaiting: 0,
      avgWait: 0,
    });
  });

  schedules.forEach((schedule) => {
    const key = String(schedule.departmentId || schedule.department);
    const current = groups.get(key) || {
      id: key,
      name: schedule.department || 'Chưa xác định khoa',
      schedules: 0,
      doctors: new Set(),
      totalSlots: 0,
      bookedSlots: 0,
      availableSlots: 0,
      blockedSlots: 0,
      appointments: 0,
      queueWaiting: 0,
      avgWait: 0,
    };
    current.schedules += 1;
    if (schedule.doctorId || schedule.doctor) current.doctors.add(schedule.doctorId || schedule.doctor);
    current.totalSlots += safeNumber(schedule.totalSlots);
    current.bookedSlots += safeNumber(schedule.bookedSlots);
    current.availableSlots += safeNumber(schedule.availableSlots);
    current.blockedSlots += safeNumber(schedule.blockedSlots);
    groups.set(key, current);
  });

  appointments.forEach((appointment) => {
    const key = String(appointment.departmentId || appointment.departmentName);
    const current = groups.get(key);
    if (current) current.appointments += 1;
  });

  queueItems.forEach((ticket) => {
    const key = String(ticket.departmentId || ticket.departmentName);
    const current = groups.get(key);
    if (current && ['waiting', 'called', 'recalled', 'skipped'].includes(ticket.status)) {
      current.queueWaiting += 1;
      current.avgWait += getWaitMinutes(ticket);
    }
  });

  return Array.from(groups.values())
    .map((item) => {
      const utilization = item.totalSlots > 0 ? (item.bookedSlots / item.totalSlots) * 100 : 0;
      const avgWait = item.queueWaiting > 0 ? Math.round(item.avgWait / item.queueWaiting) : 0;
      return {
        ...item,
        doctorCount: item.doctors.size,
        utilization,
        avgWait,
        risk: getRiskLevel(utilization, avgWait, item.blockedSlots > 0 ? 1 : 0),
      };
    })
    .sort((first, second) => second.utilization - first.utilization);
}

function buildDoctorLoad(schedules, queueItems) {
  const groups = new Map();
  schedules.forEach((schedule) => {
    const key = String(schedule.doctorId || schedule.doctor);
    const current = groups.get(key) || {
      id: key,
      name: schedule.doctor,
      department: schedule.department,
      schedules: 0,
      totalSlots: 0,
      bookedSlots: 0,
      availableSlots: 0,
      blockedSlots: 0,
      queueWaiting: 0,
    };
    current.schedules += 1;
    current.totalSlots += safeNumber(schedule.totalSlots);
    current.bookedSlots += safeNumber(schedule.bookedSlots);
    current.availableSlots += safeNumber(schedule.availableSlots);
    current.blockedSlots += safeNumber(schedule.blockedSlots);
    groups.set(key, current);
  });

  queueItems.forEach((ticket) => {
    const current = groups.get(String(ticket.doctorId || ticket.doctorName));
    if (current && ['waiting', 'called', 'recalled', 'skipped'].includes(ticket.status)) current.queueWaiting += 1;
  });

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      utilization: item.totalSlots > 0 ? (item.bookedSlots / item.totalSlots) * 100 : 0,
    }))
    .sort((first, second) => second.utilization - first.utilization);
}

function buildHourlyFlow(appointments, queueItems, date) {
  return Array.from({ length: 12 }).map((_, index) => {
    const hour = index + 7;
    const hourKey = String(hour).padStart(2, '0');
    const inHour = (value) => String(value || '').startsWith(`${date}T${hourKey}`);
    return {
      hour: `${hourKey}:00`,
      appointments: appointments.filter((item) => inHour(item.appointmentTime)).length,
      checked_in: appointments.filter((item) => item.status === 'checked_in' && inHour(item.appointmentTime)).length,
      queue_waiting: queueItems.filter((item) => item.status === 'waiting' && inHour(item.checkinTime)).length,
      in_service: queueItems.filter((item) => item.status === 'in_service' && inHour(item.checkinTime)).length,
      completed: appointments.filter((item) => item.status === 'completed' && inHour(item.appointmentTime)).length,
      no_show: appointments.filter((item) => item.status === 'no_show' && inHour(item.appointmentTime)).length,
    };
  });
}

function buildAlerts(schedules, appointmentSummary, queueSummary, departmentLoad, operationAlerts) {
  const alerts = safeArray(operationAlerts).map((item, index) => ({
    id: `schedule-alert-${index}`,
    severity: item.tone === 'danger' ? 'critical' : item.tone === 'warning' ? 'warning' : 'info',
    type: 'schedule_slot',
    title: item.title,
    message: item.body,
    entity: 'Lịch / slot',
    action: 'Mở chi tiết',
    to: '/scheduling/tasks',
  }));

  schedules
    .filter((item) => item.publishStatus === 'Hidden' && !isTerminalSchedule(item))
    .slice(0, 4)
    .forEach((item) => alerts.push({
      id: `unpublished-${item.id}`,
      severity: 'warning',
      type: 'schedule_unpublished',
      title: 'Lịch chưa publish',
      message: `${item.doctor} - ${item.department} chưa sẵn sàng cho bệnh nhân đặt hẹn.`,
      entity: item.doctor,
      action: 'Duyệt lịch',
      to: '/scheduling/approvals',
    }));

  departmentLoad
    .filter((item) => item.risk === 'critical' || item.risk === 'warning')
    .slice(0, 5)
    .forEach((item) => alerts.push({
      id: `load-${item.id}`,
      severity: item.risk === 'critical' ? 'critical' : 'warning',
      type: 'department_load',
      title: `${item.name} có dấu hiệu quá tải`,
      message: `Utilization ${formatPercent(item.utilization)}, queue đang chờ ${item.queueWaiting}, chờ TB ${item.avgWait} phút.`,
      entity: item.name,
      action: 'Xem tải khoa',
      to: '/scheduling/load',
    }));

  if (safeNumber(queueSummary.max_wait_minutes) >= 30) {
    alerts.push({
      id: 'queue-wait-long',
      severity: 'critical',
      type: 'queue',
      title: 'Queue chờ quá lâu',
      message: `Thời gian chờ cao nhất ${queueSummary.max_wait_minutes} phút, cần điều phối ngay.`,
      entity: 'Queue',
      action: 'Mở queue board',
      to: '/scheduling/current-queue',
    });
  }

  if (safeNumber(appointmentSummary.no_show_rate) >= 5) {
    alerts.push({
      id: 'no-show-rate',
      severity: 'warning',
      type: 'no_show',
      title: 'No-show tăng cao',
      message: `Tỷ lệ no-show đang ở mức ${formatPercent(appointmentSummary.no_show_rate)}.`,
      entity: 'Lịch hẹn',
      action: 'Xem no-show',
      to: '/scheduling/appointments/no-show',
    });
  }

  return alerts;
}

function useOperationsData(date) {
  const scheduling = useSchedulingData();
  const [state, setState] = useState({ loading: true, error: '', remote: {} });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;
    setState((current) => ({ ...current, loading: true, error: '' }));

    async function load() {
      const results = await Promise.allSettled([
        schedulingApi.getOperationsDashboardToday({ date }),
        schedulingApi.getOperationsHourlyFlow({ date }),
        schedulingApi.getSystemSummary({ preset: 'today', date }),
        schedulingApi.getAppointmentSummary({ date }),
        schedulingApi.getTodayAppointments({ date, limit: 120 }),
        schedulingApi.getQueueSummaryToday({ date }),
        schedulingApi.listQueueTickets({ date, limit: 120 }),
        schedulingApi.getDepartmentSummary({ preset: 'today', date }),
      ]);

      if (!isActive) return;
      const firstError = results.find((item) => item.status === 'rejected')?.reason?.message || '';
      setState({
        loading: false,
        error: firstError && results.every((item) => item.status === 'rejected') ? firstError : '',
        remote: {
          dashboard: getSettled(results[0]),
          hourly: getSettled(results[1]),
          scheduleSummary: getSettled(results[2]),
          appointmentSummary: getSettled(results[3]),
          todayAppointments: getSettled(results[4]),
          queueSummary: getSettled(results[5]),
          queueTickets: getSettled(results[6]),
          departmentSummary: getSettled(results[7]),
        },
      });
    }

    load();
    return () => {
      isActive = false;
    };
  }, [date, reloadKey]);

  const derived = useMemo(() => {
    const schedules = scheduling.schedules.filter((item) => getScheduleDate(item) === date);
    const fallbackAppointments = buildFallbackAppointments(schedules.length ? schedules : scheduling.schedules, date);
    const appointments = safeArray(state.remote.todayAppointments?.items).length
      ? state.remote.todayAppointments.items.map(normalizeAppointment)
      : fallbackAppointments;
    const queueItems = safeArray(state.remote.queueTickets?.items).length
      ? state.remote.queueTickets.items.map(normalizeQueueTicket)
      : buildFallbackQueue(appointments);
    const appointmentSummary = state.remote.appointmentSummary || buildSummaryFromAppointments(appointments);
    const queueSummary = { ...buildQueueSummary(queueItems), ...(state.remote.queueSummary || {}) };
    const departmentLoad = buildDepartmentLoad(
      schedules.length ? schedules : scheduling.schedules,
      appointments,
      queueItems,
      scheduling.departments,
    );
    const doctorLoad = buildDoctorLoad(schedules.length ? schedules : scheduling.schedules, queueItems);
    const hourlyFlow = safeArray(state.remote.hourly?.items).length
      ? state.remote.hourly.items
      : buildHourlyFlow(appointments, queueItems, date);
    const alerts = buildAlerts(schedules, appointmentSummary, queueSummary, departmentLoad, scheduling.operationAlerts);
    const scheduleOverview = state.remote.scheduleSummary?.overview || scheduling.rawSummary?.overview || {};
    const slotTotals = {
      total: safeNumber(scheduleOverview.total_slots) || schedules.reduce((sum, item) => sum + safeNumber(item.totalSlots), 0),
      booked: safeNumber(scheduleOverview.booked_slots) || schedules.reduce((sum, item) => sum + safeNumber(item.bookedSlots), 0),
      available: safeNumber(scheduleOverview.available_slots) || schedules.reduce((sum, item) => sum + safeNumber(item.availableSlots), 0),
      blocked: safeNumber(scheduleOverview.blocked_slots) || schedules.reduce((sum, item) => sum + safeNumber(item.blockedSlots), 0),
    };
    const utilizationRate = slotTotals.total > 0 ? (slotTotals.booked / slotTotals.total) * 100 : 0;

    return {
      schedules,
      appointments,
      queueItems,
      appointmentSummary,
      queueSummary,
      departmentLoad,
      doctorLoad,
      hourlyFlow,
      alerts,
      slotTotals,
      utilizationRate,
      health: state.remote.dashboard?.health || {
        status: alerts.some((item) => item.severity === 'critical') ? 'warning' : 'healthy',
        score: Math.max(58, 100 - alerts.filter((item) => item.severity !== 'info').length * 6),
        critical_alerts: alerts.filter((item) => item.severity === 'critical').length,
        warning_alerts: alerts.filter((item) => item.severity === 'warning').length,
      },
      backendConnected: scheduling.backendConnected,
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

function CommandHeader({ config, date, setDate, data, loading, onRefresh }) {
  return (
    <section className="sched-ops-hero">
      <div>
        <span>{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.copy}</p>
      </div>
      <div className="sched-ops-hero__tools">
        <label>
          Ngày vận hành
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          Phạm vi
          <select defaultValue="system">
            <option value="system">Toàn hệ thống</option>
            <option value="department">Theo khoa</option>
            <option value="doctor">Theo bác sĩ</option>
          </select>
        </label>
        <span className={`sched-ops-sync is-${data.backendConnected ? 'online' : 'demo'}`}>
          <i />
          {data.backendConnected ? 'Đang đồng bộ backend' : 'Dữ liệu demo/fallback'}
        </span>
        <button type="button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={16} strokeWidth={2.3} aria-hidden="true" />
          Làm mới
        </button>
      </div>
    </section>
  );
}

function QuickActions() {
  return (
    <section className="sched-ops-actions" aria-label="Thao tác nhanh">
      <Link to="/scheduling/appointments/create"><CalendarPlus size={16} />Tạo lịch hẹn</Link>
      <Link to="/scheduling/create"><CalendarClock size={16} />Tạo lịch làm việc</Link>
      <Link to="/scheduling/slots/generate"><WandSparkles size={16} />Generate slot</Link>
      <Link to="/scheduling/current-queue"><MonitorPlay size={16} />Mở Queue board</Link>
      <Link to="/scheduling/alerts"><BellRing size={16} />Xem cảnh báo</Link>
      <Link to="/scheduling/utilization"><Download size={16} />Xuất báo cáo</Link>
    </section>
  );
}

function KpiStrip({ data }) {
  const kpis = [
    { label: 'Lịch làm việc hôm nay', value: data.schedules.length, hint: 'ca bác sĩ', icon: CalendarClock, tone: 'blue' },
    { label: 'Lịch hẹn hôm nay', value: data.appointmentSummary.total, hint: `${data.appointmentSummary.confirmed} đã xác nhận`, icon: CalendarCheck2, tone: 'cyan' },
    { label: 'Đã check-in', value: data.appointmentSummary.checked_in, hint: 'đã vào luồng tiếp nhận', icon: ClipboardCheck, tone: 'green' },
    { label: 'Queue đang chờ', value: data.queueSummary.waiting, hint: `max ${data.queueSummary.max_wait_minutes || 0} phút`, icon: ListOrdered, tone: 'amber' },
    { label: 'Slot còn trống', value: data.slotTotals.available, hint: `${formatPercent(data.utilizationRate)} lấp đầy`, icon: Clock3, tone: 'teal' },
    { label: 'No-show hôm nay', value: data.appointmentSummary.no_show, hint: formatPercent(data.appointmentSummary.no_show_rate), icon: ShieldAlert, tone: 'red' },
    { label: 'Cảnh báo cần xử lý', value: data.alerts.filter((item) => item.severity !== 'info').length, hint: `${data.health.critical_alerts || 0} critical`, icon: AlertTriangle, tone: 'violet' },
    { label: 'Health score', value: data.health.score, hint: data.health.status === 'healthy' ? 'ổn định' : 'cần theo dõi', icon: Gauge, tone: 'slate' },
  ];

  return (
    <section className="sched-ops-kpis">
      {kpis.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.label} className={`is-${item.tone}`}>
            <span><Icon size={17} strokeWidth={2.25} />{item.label}</span>
            <strong>{formatNumber(item.value)}</strong>
            <small>{item.hint}</small>
          </article>
        );
      })}
    </section>
  );
}

function PatientFlow({ data }) {
  const items = [
    { key: 'booked', label: 'Scheduled', value: data.appointmentSummary.booked },
    { key: 'confirmed', label: 'Confirmed', value: data.appointmentSummary.confirmed },
    { key: 'checked_in', label: 'Checked-in', value: data.appointmentSummary.checked_in },
    { key: 'waiting', label: 'Waiting queue', value: data.queueSummary.waiting },
    { key: 'called', label: 'Called', value: data.queueSummary.called },
    { key: 'in_service', label: 'In consultation', value: data.queueSummary.in_service || data.appointmentSummary.in_consultation },
    { key: 'completed', label: 'Completed', value: data.appointmentSummary.completed },
    { key: 'exceptions', label: 'No-show / cancelled', value: data.appointmentSummary.no_show + data.appointmentSummary.cancelled },
  ];
  const max = Math.max(...items.map((item) => safeNumber(item.value)), 1);

  return (
    <section className="sched-ops-panel sched-ops-flow">
      <header><span>Luồng vận hành hôm nay</span><h2>Patient flow</h2></header>
      <div>
        {items.map((item, index) => (
          <article key={item.key}>
            <b>{index + 1}</b>
            <strong>{item.label}</strong>
            <em>{formatNumber(item.value)}</em>
            <span><i style={{ width: `${Math.max(8, (safeNumber(item.value) / max) * 100)}%` }} /></span>
          </article>
        ))}
      </div>
    </section>
  );
}

function DepartmentHeatmap({ rows }) {
  return (
    <section className="sched-ops-panel">
      <header><span>Bản đồ tải</span><h2>Heatmap khoa</h2></header>
      <div className="sched-ops-heatmap">
        {rows.slice(0, 8).map((row) => (
          <article key={row.id || row.name} className={`is-${row.risk}`}>
            <div>
              <strong>{row.name}</strong>
              <span>{row.doctorCount} bác sĩ - {row.schedules} lịch - Queue {row.queueWaiting}</span>
            </div>
            <b>{formatPercent(row.utilization)}</b>
            <em><i style={{ width: `${Math.min(row.utilization, 120)}%` }} /></em>
            <small>Chờ TB {row.avgWait} phút - còn {row.availableSlots} slot</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function QueueMiniBoard({ queueItems, onSelect }) {
  const columns = QUEUE_COLUMNS.slice(0, 5).map((column) => ({
    ...column,
    items: queueItems.filter((item) => (column.key === 'called' ? ['called'].includes(item.status) : item.status === column.key)),
  }));

  return (
    <section className="sched-ops-panel sched-ops-queue-mini">
      <header><span>Queue & bottleneck</span><h2>Board hàng đợi hiện tại</h2></header>
      <div>
        {columns.map((column) => {
          const Icon = column.icon;
          return (
            <article key={column.key} className={`is-${column.key}`}>
              <h3><Icon size={15} />{column.label}<b>{column.items.length}</b></h3>
              {column.items.slice(0, 4).map((ticket) => (
                <button key={ticket.id} type="button" onClick={() => onSelect(ticket)}>
                  <strong>{ticket.number}</strong>
                  <span>{ticket.patientName}</span>
                  <small>{ticket.departmentName} - chờ {getWaitMinutes(ticket)} phút</small>
                </button>
              ))}
              {!column.items.length ? <p>Không có ticket.</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CapacityPanel({ data }) {
  const max = Math.max(...data.hourlyFlow.map((item) => item.appointments + item.queue_waiting + item.in_service), 1);
  return (
    <section className="sched-ops-panel sched-ops-capacity">
      <header><span>Slot & công suất</span><h2>Utilization theo giờ</h2></header>
      <div className="sched-ops-hourly">
        {data.hourlyFlow.map((item) => {
          const total = item.appointments + item.queue_waiting + item.in_service;
          return (
            <article key={item.hour}>
              <strong>{item.hour}</strong>
              <span>
                <i className="is-appointments" style={{ height: `${Math.max(6, (item.appointments / max) * 100)}%` }} />
                <i className="is-queue" style={{ height: `${Math.max(6, (item.queue_waiting / max) * 100)}%` }} />
                <i className="is-service" style={{ height: `${Math.max(6, (item.in_service / max) * 100)}%` }} />
              </span>
              <small>{total}</small>
            </article>
          );
        })}
      </div>
      <footer>
        <span><i className="is-appointments" />Lịch hẹn</span>
        <span><i className="is-queue" />Queue chờ</span>
        <span><i className="is-service" />Đang khám</span>
      </footer>
    </section>
  );
}

function AlertInbox({ alerts, dense = false }) {
  return (
    <section className={`sched-ops-panel sched-ops-alerts${dense ? ' is-dense' : ''}`}>
      <header><span>Cảnh báo & việc cần xử lý</span><h2>Alert inbox</h2></header>
      <div>
        {alerts.slice(0, dense ? 7 : 12).map((alert) => (
          <article key={alert.id} className={`is-${alert.severity}`}>
            <i />
            <div>
              <strong>{alert.title}</strong>
              <span>{alert.message}</span>
              <small>{alert.type} - {alert.entity}</small>
            </div>
            <Link to={alert.to || '/scheduling/alerts'}>{alert.action}<ChevronRight size={14} /></Link>
          </article>
        ))}
        {!alerts.length ? (
          <article className="is-info">
            <i />
            <div><strong>Không có cảnh báo mở</strong><span>Hệ thống vận hành ổn định theo dữ liệu hiện tại.</span></div>
            <Link to="/scheduling/dashboard">Tổng quan</Link>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function SchedulesToday({ schedules }) {
  return (
    <section className="sched-ops-panel sched-ops-schedule-list">
      <header><span>Worklist hôm nay</span><h2>Lịch bác sĩ</h2></header>
      <div>
        {schedules.map((schedule) => {
          const utilization = safeNumber(schedule.utilization) || (safeNumber(schedule.totalSlots) ? (safeNumber(schedule.bookedSlots) / safeNumber(schedule.totalSlots)) * 100 : 0);
          const risk = getRiskLevel(utilization, 0, schedule.publishStatus === 'Hidden' ? 1 : 0);
          return (
            <article key={schedule.id} className={`is-${risk}`}>
              <div>
                <time>{schedule.start} - {schedule.end}</time>
                <strong>{schedule.doctor}</strong>
                <span>{schedule.department} - {schedule.scheduleType}</span>
              </div>
              <div>
                <b>{schedule.bookedSlots}/{schedule.totalSlots}</b>
                <em><i style={{ width: `${Math.min(utilization, 100)}%` }} /></em>
                <small>{schedule.availableSlots} trống - {schedule.blockedSlots} khóa</small>
              </div>
              <Link to={`/scheduling/schedules/${schedule.id}`}>Chi tiết</Link>
            </article>
          );
        })}
        {!schedules.length ? <p className="sched-ops-empty">Chưa có lịch làm việc trong ngày được chọn.</p> : null}
      </div>
    </section>
  );
}

function DoctorLoadTable({ rows }) {
  return (
    <section className="sched-ops-panel sched-ops-doctor-table">
      <header><span>Tải bác sĩ</span><h2>Bác sĩ quá tải / còn slot</h2></header>
      <div>
        <div className="sched-ops-table-head">
          <span>Bác sĩ</span><span>Khoa</span><span>Slot</span><span>Queue</span><span>Utilization</span><span>Trạng thái</span>
        </div>
        {rows.slice(0, 12).map((row) => {
          const risk = getRiskLevel(row.utilization, row.queueWaiting, row.blockedSlots > 0 ? 1 : 0);
          return (
            <article key={row.id} className={`is-${risk}`}>
              <strong>{row.name}</strong>
              <span>{row.department}</span>
              <span>{row.bookedSlots}/{row.totalSlots} - còn {row.availableSlots}</span>
              <span>{row.queueWaiting}</span>
              <span><em><i style={{ width: `${Math.min(row.utilization, 100)}%` }} /></em>{formatPercent(row.utilization)}</span>
              <b>{risk === 'critical' ? 'Quá tải' : risk === 'warning' ? 'Cần theo dõi' : 'Ổn định'}</b>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function QueueBoard({ data, selectedTicket, setSelectedTicket, runAction }) {
  return (
    <section className="sched-ops-queue-layout">
      <div className="sched-ops-queue-board">
        {QUEUE_COLUMNS.map((column) => {
          const Icon = column.icon;
          const items = data.queueItems.filter((item) => (
            column.key === 'called' ? item.status === 'called' : item.status === column.key
          ));
          return (
            <article key={column.key} className={`is-${column.key}`}>
              <header><Icon size={16} /><strong>{column.label}</strong><span>{items.length}</span></header>
              <div>
                {items.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    className={selectedTicket?.id === ticket.id ? 'is-active' : ''}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <strong>{ticket.number}</strong>
                    <span>{ticket.patientName}</span>
                    <small>{ticket.departmentName} - {ticket.doctorName}</small>
                    <em>Chờ {getWaitMinutes(ticket)} phút</em>
                  </button>
                ))}
                {!items.length ? <p>Không có ticket.</p> : null}
              </div>
            </article>
          );
        })}
      </div>
      <aside className="sched-ops-detail">
        {selectedTicket ? (
          <>
            <header>
              <span>Chi tiết ticket</span>
              <h2>{selectedTicket.number}</h2>
              <p>{selectedTicket.patientName} - {selectedTicket.patientCode}</p>
            </header>
            <div className="sched-ops-detail__grid">
              <span>Khoa <b>{selectedTicket.departmentName}</b></span>
              <span>Bác sĩ <b>{selectedTicket.doctorName}</b></span>
              <span>Trạng thái <b>{selectedTicket.status}</b></span>
              <span>Chờ <b>{getWaitMinutes(selectedTicket)} phút</b></span>
            </div>
            <div className="sched-ops-detail__actions">
              <button type="button" onClick={() => runAction(() => schedulingApi.callQueueTicket(selectedTicket.id), {
                confirm: { title: 'Gọi queue', body: `Gọi ${selectedTicket.number} - ${selectedTicket.patientName}.`, confirmLabel: 'gọi' },
                successBody: `Đã gọi ${selectedTicket.number}.`,
              })}>Gọi</button>
              <button type="button" onClick={() => runAction(() => schedulingApi.recallQueueTicket(selectedTicket.id), {
                confirm: { title: 'Gọi lại queue', body: `Gọi lại ${selectedTicket.number}.`, confirmLabel: 'gọi lại' },
                successBody: `Đã gọi lại ${selectedTicket.number}.`,
              })}>Gọi lại</button>
              <button type="button" onClick={() => runAction(() => schedulingApi.skipQueueTicket(selectedTicket.id, { reason: 'Điều phối viên bỏ qua tạm thời' }), {
                confirm: { title: 'Bỏ qua queue', body: `Bỏ qua ${selectedTicket.number}.`, confirmLabel: 'bỏ qua' },
                successBody: `Đã bỏ qua ${selectedTicket.number}.`,
              })}>Bỏ qua</button>
              <button type="button" onClick={() => runAction(() => schedulingApi.startQueueService(selectedTicket.id), {
                confirm: { title: 'Bắt đầu khám', body: `Chuyển ${selectedTicket.number} sang đang phục vụ.`, confirmLabel: 'bắt đầu khám' },
                successBody: `Đã bắt đầu khám cho ${selectedTicket.number}.`,
              })}>Bắt đầu khám</button>
            </div>
          </>
        ) : (
          <div className="sched-ops-empty">
            <ClipboardList size={24} />
            <strong>Chọn một ticket</strong>
            <span>Xem timeline, appointment liên kết và thao tác queue.</span>
          </div>
        )}
      </aside>
    </section>
  );
}

export function OperationsCommandPage({ view = 'dashboard' }) {
  const [date, setDate] = useState(getTodayKey);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const data = useOperationsData(date);
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.dashboard;

  const filteredAlerts = useMemo(() => {
    if (!query) return data.alerts;
    const needle = normalizeText(query);
    return data.alerts.filter((item) => normalizeText(`${item.title} ${item.message} ${item.entity}`).includes(needle));
  }, [data.alerts, query]);

  async function runAction(callback, options = {}) {
    await runSchedulingAction({
      action: async () => {
        const result = await callback();
        await data.refresh();
        return result;
      },
      confirm: options.confirm,
      pendingMessage: 'Đang gửi thao tác...',
      successTitle: 'Vận hành đã cập nhật',
      successBody: options.successBody || 'Thao tác đã gửi thành công. Dữ liệu đang được làm mới.',
      errorTitle: 'Không xử lý được thao tác vận hành',
      errorBody: 'Không thể xử lý thao tác.',
      to: '/scheduling/overview',
      onStatus: setMessage,
    });
  }

  return (
    <main className={`sched-ops-page sched-ops-page--${view}`}>
      <CommandHeader config={config} date={date} setDate={setDate} data={data} loading={data.loading} onRefresh={data.refresh} />
      <QuickActions />
      {message ? <p className="sched-ops-toast">{message}</p> : null}
      {data.error ? <p className="sched-ops-notice">{data.error}</p> : null}
      {data.loading ? <p className="sched-ops-loading"><LoaderCircle size={16} />Đang tải dữ liệu vận hành...</p> : null}

      {view === 'dashboard' ? (
        <>
          <KpiStrip data={data} />
          <section className="sched-ops-grid sched-ops-grid--wide">
            <PatientFlow data={data} />
            <AlertInbox alerts={data.alerts} dense />
          </section>
          <section className="sched-ops-grid">
            <DepartmentHeatmap rows={data.departmentLoad} />
            <QueueMiniBoard queueItems={data.queueItems} onSelect={setSelectedTicket} />
          </section>
          <section className="sched-ops-grid">
            <CapacityPanel data={data} />
            <DoctorLoadTable rows={data.doctorLoad} />
          </section>
        </>
      ) : null}

      {view === 'today' ? (
        <>
          <KpiStrip data={data} />
          <section className="sched-ops-grid">
            <SchedulesToday schedules={data.schedules} />
            <DepartmentHeatmap rows={data.departmentLoad} />
          </section>
          <section className="sched-ops-grid">
            <PatientFlow data={data} />
            <AlertInbox alerts={data.alerts} dense />
          </section>
        </>
      ) : null}

      {view === 'queue' ? (
        <>
          <KpiStrip data={data} />
          <QueueBoard data={data} selectedTicket={selectedTicket} setSelectedTicket={setSelectedTicket} runAction={runAction} />
        </>
      ) : null}

      {view === 'load' ? (
        <>
          <section className="sched-ops-kpis sched-ops-kpis--compact">
            <article className="is-blue"><span><Building2 size={17} />Khoa hoạt động</span><strong>{data.departmentLoad.length}</strong><small>theo lịch hôm nay</small></article>
            <article className="is-green"><span><Stethoscope size={17} />Bác sĩ có lịch</span><strong>{data.doctorLoad.length}</strong><small>đang phục vụ</small></article>
            <article className="is-amber"><span><AlertTriangle size={17} />Khoa quá tải</span><strong>{data.departmentLoad.filter((item) => item.risk !== 'good').length}</strong><small>warning/critical</small></article>
            <article className="is-violet"><span><Gauge size={17} />Công suất TB</span><strong>{formatPercent(data.utilizationRate)}</strong><small>toàn hệ thống</small></article>
          </section>
          <section className="sched-ops-grid">
            <DepartmentHeatmap rows={data.departmentLoad} />
            <DoctorLoadTable rows={data.doctorLoad} />
          </section>
        </>
      ) : null}

      {view === 'capacity' ? (
        <>
          <KpiStrip data={data} />
          <section className="sched-ops-grid">
            <CapacityPanel data={data} />
            <section className="sched-ops-panel sched-ops-slot-summary">
              <header><span>Slot tổng quan</span><h2>Công suất slot</h2></header>
              {[
                ['Tổng slot', data.slotTotals.total, 'is-blue'],
                ['Đã đặt', data.slotTotals.booked, 'is-green'],
                ['Còn trống', data.slotTotals.available, 'is-teal'],
                ['Bị khóa', data.slotTotals.blocked, 'is-red'],
              ].map(([label, value, className]) => (
                <article key={label} className={className}>
                  <span>{label}</span>
                  <strong>{formatNumber(value)}</strong>
                  <em><i style={{ width: `${data.slotTotals.total ? (safeNumber(value) / data.slotTotals.total) * 100 : 0}%` }} /></em>
                </article>
              ))}
              <Link to="/scheduling/slots">Mở Khung giờ & slot<ChevronRight size={14} /></Link>
            </section>
          </section>
          <DepartmentHeatmap rows={data.departmentLoad} />
        </>
      ) : null}

      {view === 'alerts' ? (
        <>
          <section className="sched-ops-alert-toolbar">
            <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm cảnh báo theo khoa, bác sĩ, queue, slot..." /></label>
            <Link to="/scheduling/configuration/notifications"><Settings size={16} />Quy tắc cảnh báo</Link>
            <button type="button" onClick={() => {
              downloadJsonFile(`operation-alerts-${date}.json`, filteredAlerts);
              setMessage('Đã xuất danh sách cảnh báo theo bộ lọc.');
            }}><Download size={16} />Xuất alert</button>
          </section>
          <section className="sched-ops-kpis sched-ops-kpis--compact">
            <article className="is-red"><span><ShieldAlert size={17} />Critical</span><strong>{filteredAlerts.filter((item) => item.severity === 'critical').length}</strong><small>cần xử lý ngay</small></article>
            <article className="is-amber"><span><AlertTriangle size={17} />Warning</span><strong>{filteredAlerts.filter((item) => item.severity === 'warning').length}</strong><small>cần theo dõi</small></article>
            <article className="is-blue"><span><BellRing size={17} />Info</span><strong>{filteredAlerts.filter((item) => item.severity === 'info').length}</strong><small>thông tin vận hành</small></article>
            <article className="is-green"><span><CheckCircle2 size={17} />Open</span><strong>{filteredAlerts.length}</strong><small>alert đang mở</small></article>
          </section>
          <AlertInbox alerts={filteredAlerts} />
        </>
      ) : null}
    </main>
  );
}
