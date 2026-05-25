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
  FileClock,
  LoaderCircle,
  MessageSquareText,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
  WandSparkles,
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
  booked: { label: 'Chờ xác nhận', tone: 'slate' },
  confirmed: { label: 'Đã xác nhận', tone: 'blue' },
  checked_in: { label: 'Đã check-in', tone: 'green' },
  in_consultation: { label: 'Đang khám', tone: 'violet' },
  completed: { label: 'Hoàn tất', tone: 'teal' },
  cancelled: { label: 'Đã hủy', tone: 'red' },
  no_show: { label: 'No-show', tone: 'orange' },
  rescheduled: { label: 'Đã dời', tone: 'amber' },
};

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

function getSettled(result, fallback = null) {
  return result?.status === 'fulfilled' ? result.value : fallback;
}

function normalizeAppointment(item = {}) {
  return {
    id: item.appointment_id || item.id || item._id,
    patientId: item.patient_id,
    patientName: item.patient_name || item.patient?.full_name || 'Bệnh nhân chưa rõ',
    patientCode: item.patient_code || item.patient?.patient_code || 'BN----',
    patientPhone: item.patient_phone || item.patient?.phone || '',
    doctorId: item.doctor_id,
    doctorName: item.doctor_name || item.doctor?.full_name || 'Chưa phân bác sĩ',
    departmentId: item.department_id,
    departmentName: item.department_name || item.department?.department_name || 'Chưa xác định khoa',
    scheduleId: item.doctor_schedule_id,
    slotId: item.schedule_slot_id,
    appointmentTime: item.appointment_time || item.time,
    appointmentType: item.appointment_type || 'outpatient',
    source: item.source || 'staff',
    status: item.status || 'booked',
    reason: item.reason || 'Khám bệnh',
    queue: item.queue_ticket || item.queue || null,
    encounter: item.encounter || null,
    raw: item,
  };
}

function buildFallbackAppointments(schedules, date) {
  const sourceSchedules = schedules.filter((item) => item.date === date).length
    ? schedules.filter((item) => item.date === date)
    : schedules.slice(0, 8);
  const statuses = ['booked', 'confirmed', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show', 'rescheduled'];

  return sourceSchedules.flatMap((schedule, scheduleIndex) => {
    const count = Math.min(Math.max(safeNumber(schedule.bookedSlots), 2), 5);
    return Array.from({ length: count }).map((_, index) => {
      const hour = String(Math.min(7 + scheduleIndex + Math.floor(index / 2), 17)).padStart(2, '0');
      return normalizeAppointment({
        appointment_id: `apt-demo-${schedule.id}-${index}`,
        patient_name: ['Nguyễn Văn An', 'Trần Minh Châu', 'Lê Hoàng Nam', 'Phạm Thu Hà', 'Vũ Gia Bảo'][index % 5],
        patient_code: `BN${String(24000 + scheduleIndex * 20 + index).padStart(6, '0')}`,
        patient_phone: `09${String(12000000 + scheduleIndex * 100 + index * 13).slice(0, 8)}`,
        doctor_id: schedule.doctorId,
        doctor_name: schedule.doctor,
        department_id: schedule.departmentId,
        department_name: schedule.department,
        doctor_schedule_id: schedule.id,
        appointment_time: `${date}T${hour}:${index % 2 ? '30' : '00'}:00`,
        appointment_type: index % 4 === 0 ? 'telemedicine' : index % 5 === 0 ? 'procedure' : 'outpatient',
        source: index % 3 === 0 ? 'portal' : 'staff',
        status: statuses[(scheduleIndex + index) % statuses.length],
        reason: index % 2 ? 'Tái khám sau điều trị' : 'Khám chuyên khoa',
      });
    });
  });
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

function buildFallbackWaitlist(appointments, departments) {
  return appointments.slice(0, 8).map((appointment, index) => ({
    id: `wl-demo-${appointment.id}`,
    patientName: appointment.patientName,
    patientCode: appointment.patientCode,
    doctorName: index % 2 ? appointment.doctorName : 'Bất kỳ bác sĩ phù hợp',
    departmentName: appointment.departmentName || departments[index % Math.max(departments.length, 1)]?.name || 'Chưa xác định khoa',
    preferredDate: getDateKey(appointment.appointmentTime),
    preferredTimeRange: index % 2 ? '07:00 - 11:30' : '13:00 - 17:00',
    reason: appointment.reason,
    status: index % 4 === 0 ? 'offered' : index % 5 === 0 ? 'booked' : 'waiting',
    offeredUntil: new Date(Date.now() + (index + 1) * 3600000).toISOString(),
    waitHours: 6 + index * 3,
  }));
}

function normalizeWaitlist(item = {}) {
  return {
    id: item.waitlist_id || item.appointment_waitlist_id || item.id || item._id,
    patientName: item.patient_name || item.patient?.full_name || 'Bệnh nhân chưa rõ',
    patientCode: item.patient_code || item.patient?.patient_code || 'BN----',
    doctorName: item.doctor_name || item.doctor?.full_name || 'Bất kỳ bác sĩ phù hợp',
    departmentName: item.department_name || item.department?.department_name || 'Chưa xác định khoa',
    preferredDate: item.preferred_date,
    preferredTimeRange: item.preferred_time_range || 'Không giới hạn',
    reason: item.reason || 'Chờ slot phù hợp',
    status: item.status || 'waiting',
    offeredSlotId: item.offered_slot_id,
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
  if (appointment.status === 'checked_in') return { label: 'Đã check-in', tone: 'green' };
  if (minutes <= 0) return { label: 'Sắp đến', tone: 'blue' };
  if (minutes <= 20) return { label: `Trễ ${minutes} phút`, tone: 'amber' };
  return { label: `Quá giờ ${minutes} phút`, tone: 'red' };
}

function useAppointmentData(date) {
  const scheduling = useSchedulingData();
  const [state, setState] = useState({ loading: true, error: '', remote: {} });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;
    setState((current) => ({ ...current, loading: true, error: '' }));

    async function load() {
      const results = await Promise.allSettled([
        schedulingApi.getAppointmentSummary({ date }),
        schedulingApi.getTodayAppointments({ date, limit: 150 }),
        schedulingApi.listAppointments({ date, limit: 150 }),
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
  }, [date, reloadKey]);

  const derived = useMemo(() => {
    const apiItems = safeArray(state.remote.list?.items).length
      ? state.remote.list.items
      : safeArray(state.remote.today?.items);
    const fallbackAppointments = buildFallbackAppointments(scheduling.schedules, date);
    const appointments = safeArray(apiItems).length ? apiItems.map(normalizeAppointment) : fallbackAppointments;
    const summary = state.remote.summary || buildSummary(appointments);
    const waitlistItems = safeArray(state.remote.waitlist?.items).length
      ? state.remote.waitlist.items.map(normalizeWaitlist)
      : buildFallbackWaitlist(appointments, scheduling.departments);
    const options = state.remote.options || {};
    const departments = safeArray(options.departments).length ? options.departments.map((item) => ({
      id: item.department_id || item.id,
      name: item.department_name || item.name || item.code,
    })) : scheduling.departments;
    const doctors = safeArray(options.doctors).length ? options.doctors.map((item) => ({
      id: item.user_id || item.id,
      name: item.full_name || item.name || item.username,
      departmentId: item.department_id,
      department: item.department_name || item.department,
    })) : scheduling.doctors;
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
      schedules: scheduling.schedules,
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
        <span className={`sched-appt-sync is-${data.backendConnected ? 'online' : 'demo'}`}><i />{data.backendConnected ? 'Backend live' : 'Fallback data'}</span>
        <button type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={16} />Làm mới</button>
        <Link to="/scheduling/appointments/create"><CalendarPlus size={16} />Tạo lịch hẹn</Link>
      </div>
    </section>
  );
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

function AppointmentTable({ rows, selected, onSelect, onAction }) {
  return (
    <section className="sched-appt-panel sched-appt-table">
      <header><span>Command table</span><h2>Danh sách lịch hẹn</h2></header>
      <div className="sched-appt-table__head">
        <span>Thời gian</span><span>Bệnh nhân</span><span>Khoa / bác sĩ</span><span>Loại / nguồn</span><span>Trạng thái</span><span>Cảnh báo</span><span>Thao tác</span>
      </div>
      {rows.map((appointment) => {
        const actions = buildAllowedActions(appointment);
        const timeState = getTimeState(appointment);
        return (
          <article key={appointment.id} className={selected?.id === appointment.id ? 'is-selected' : ''} onClick={() => onSelect(appointment)}>
            <div><strong>{formatClock(appointment.appointmentTime)}</strong><span>{formatDate(appointment.appointmentTime)}</span><small>{timeState.label}</small></div>
            <div><strong>{appointment.patientName}</strong><span>{appointment.patientCode}</span><small>{appointment.patientPhone || 'Chưa có SĐT'}</small></div>
            <div><strong>{appointment.departmentName}</strong><span>{appointment.doctorName}</span><small>{appointment.scheduleId ? `Lịch ${appointment.scheduleId}` : 'Chưa rõ schedule'}</small></div>
            <div><strong>{appointment.appointmentType}</strong><span>{appointment.source}</span><small>{appointment.reason}</small></div>
            <div><StatusBadge value={appointment.status} /></div>
            <div className="sched-appt-flags">
              {timeState.tone === 'red' ? <span className="is-red">Quá giờ</span> : null}
              {!appointment.queue && appointment.status === 'checked_in' ? <span className="is-amber">Chưa có queue</span> : null}
              {appointment.queue ? <span className="is-green">Queue</span> : null}
              {appointment.encounter ? <span className="is-violet">Encounter</span> : null}
            </div>
            <div className="sched-appt-row-actions" onClick={(event) => event.stopPropagation()}>
              {actions.confirm ? <button type="button" onClick={() => onAction('confirm', appointment)}>Xác nhận</button> : null}
              {actions.checkIn ? <button type="button" onClick={() => onAction('checkin', appointment)}>Check-in</button> : null}
              {actions.noShow ? <button type="button" onClick={() => onAction('noshow', appointment)}>No-show</button> : null}
              {actions.cancel ? <button type="button" className="is-danger" onClick={() => onAction('cancel', appointment)}>Hủy</button> : null}
            </div>
          </article>
        );
      })}
      {!rows.length ? <p className="sched-appt-empty">Không có lịch hẹn phù hợp bộ lọc.</p> : null}
    </section>
  );
}

function DetailDrawer({ appointment }) {
  if (!appointment) {
    return (
      <aside className="sched-appt-drawer">
        <div className="sched-appt-empty"><Eye size={24} /><strong>Chọn một lịch hẹn</strong><span>Drawer sẽ hiển thị thông tin bệnh nhân, slot, queue, encounter và timeline.</span></div>
      </aside>
    );
  }

  return (
    <aside className="sched-appt-drawer">
      <header>
        <span>Appointment detail</span>
        <h2>{appointment.patientName}</h2>
        <p>{appointment.patientCode} - {appointment.patientPhone || 'Chưa có SĐT'}</p>
      </header>
      <div className="sched-appt-drawer__grid">
        <span>Thời gian <b>{formatClock(appointment.appointmentTime)} - {formatDate(appointment.appointmentTime)}</b></span>
        <span>Khoa <b>{appointment.departmentName}</b></span>
        <span>Bác sĩ <b>{appointment.doctorName}</b></span>
        <span>Loại lịch <b>{appointment.appointmentType}</b></span>
        <span>Nguồn <b>{appointment.source}</b></span>
        <span>Trạng thái <b><StatusBadge value={appointment.status} /></b></span>
      </div>
      <section>
        <h3>Liên kết vận hành</h3>
        <p>Slot: {appointment.slotId || 'Chưa có slot detail'}</p>
        <p>Queue: {appointment.queue?.queue_number || appointment.queue?.queue_ticket_id || 'Chưa tạo queue'}</p>
        <p>Encounter: {appointment.encounter?.encounter_code || appointment.encounter?.encounter_id || 'Chưa có encounter'}</p>
      </section>
      <section>
        <h3>Timeline</h3>
        {[
          ['Tạo lịch', appointment.raw?.created_at || appointment.appointmentTime],
          ['Trạng thái hiện tại', appointment.status],
          ['Lý do khám', appointment.reason],
        ].map(([label, value]) => (
          <p key={label}><b>{label}</b><span>{String(value || '--')}</span></p>
        ))}
      </section>
    </aside>
  );
}

function CalendarView({ appointments, doctors }) {
  const hours = Array.from({ length: 11 }).map((_, index) => `${String(index + 7).padStart(2, '0')}:00`);
  const resources = doctors.slice(0, 5);

  return (
    <section className="sched-appt-panel sched-appt-calendar">
      <header><span>Resource view</span><h2>Lịch hẹn theo bác sĩ</h2></header>
      <div className="sched-appt-calendar__grid" style={{ '--resource-count': resources.length || 1 }}>
        <div className="sched-appt-calendar__corner">Giờ</div>
        {resources.map((doctor) => <strong key={doctor.id || doctor.name}>{doctor.name}</strong>)}
        {hours.map((hour) => (
          <div key={hour} className="sched-appt-calendar__row">
            <time>{hour}</time>
            {resources.map((doctor) => {
              const matches = appointments.filter((item) => item.doctorId === doctor.id && formatClock(item.appointmentTime).startsWith(hour.slice(0, 2)));
              return (
                <span key={`${hour}-${doctor.id || doctor.name}`}>
                  {matches.slice(0, 2).map((appointment) => (
                    <em key={appointment.id} className={`is-${STATUS_META[appointment.status]?.tone || 'slate'}`}>
                      {formatClock(appointment.appointmentTime)} {appointment.patientName}
                    </em>
                  ))}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateWizard({ data, onAction }) {
  const [step, setStep] = useState(1);
  const [patientQuery, setPatientQuery] = useState('');
  const [doctorId, setDoctorId] = useState(data.doctors[0]?.id || '');
  const [departmentId, setDepartmentId] = useState(data.departments[0]?.id || '');
  const [patientId, setPatientId] = useState(data.patients.find((item) => item.id)?.id || '');
  const [appointmentType, setAppointmentType] = useState('outpatient');
  const [reason, setReason] = useState('Khám chuyên khoa');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const availableSchedules = data.schedules.filter((item) => !doctorId || item.doctorId === doctorId).slice(0, 6);
  const selectedDoctor = data.doctors.find((item) => item.id === doctorId);
  const selectedDepartment = data.departments.find((item) => item.id === departmentId);
  const selectedSchedule = availableSchedules.find((item) => String(item.id) === String(selectedScheduleId)) || availableSchedules[0];
  const selectedPatient = data.patients.find((item) => String(item.id) === String(patientId)) || data.patients[0];

  useEffect(() => {
    if (!selectedScheduleId && availableSchedules[0]?.id) {
      setSelectedScheduleId(availableSchedules[0].id);
    }
  }, [availableSchedules, selectedScheduleId]);

  function submit(status) {
    if (!selectedPatient?.id || !doctorId || !departmentId || !selectedSchedule?.id) {
      onAction('create-missing-data');
      return;
    }

    onAction('create', null, {
      patient_id: selectedPatient.id,
      doctor_id: doctorId,
      department_id: departmentId,
      doctor_schedule_id: selectedSchedule.id,
      appointment_time: `${selectedSchedule.date}T${selectedSchedule.start}:00`,
      appointment_type: appointmentType,
      reason,
      status,
    });
  }

  return (
    <section className="sched-appt-create">
      <nav>
        {['Bệnh nhân', 'Khoa / bác sĩ', 'Chọn slot', 'Xác nhận'].map((label, index) => (
          <button key={label} type="button" className={step === index + 1 ? 'is-active' : ''} onClick={() => setStep(index + 1)}>
            <b>{index + 1}</b>{label}
          </button>
        ))}
      </nav>
      <div className="sched-appt-create__body">
        {step === 1 ? (
          <section>
            <h2>Chọn bệnh nhân</h2>
            <label><Search size={16} /><input value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Tên, mã BN, SĐT..." /></label>
            <div className="sched-appt-slot-cards">
              {data.patients
                .filter((item) => !patientQuery || normalizeText(`${item.name} ${item.code} ${item.phone}`).includes(normalizeText(patientQuery)))
                .slice(0, 6)
                .map((patient) => (
                  <button
                    key={patient.code || patient.name}
                    type="button"
                    className={String(patient.id) === String(patientId) ? 'is-active' : ''}
                    onClick={() => setPatientId(patient.id)}
                    disabled={!patient.id}
                  >
                    <strong>{patient.name}</strong>
                    <span>{patient.code}</span>
                    <small>{patient.phone || 'Chưa có số điện thoại'}{patient.id ? '' : ' - cần hồ sơ bệnh nhân thật để ghi DB'}</small>
                  </button>
                ))}
              {!data.patients.length ? <p>Chưa có bệnh nhân trong dữ liệu hiện tại. Hãy tìm/chọn hồ sơ bệnh nhân thật trước khi tạo lịch.</p> : null}
            </div>
          </section>
        ) : null}
        {step === 2 ? (
          <section>
            <h2>Chọn khoa, bác sĩ và loại lịch</h2>
            <div className="sched-appt-form-grid">
              <label>Khoa<select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>{data.departments.map((item) => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}</select></label>
              <label>Bác sĩ<select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>{data.doctors.map((item) => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}</select></label>
              <label>Loại lịch<select value={appointmentType} onChange={(event) => setAppointmentType(event.target.value)}><option value="outpatient">Khám ngoại trú</option><option value="telemedicine">Telehealth</option><option value="procedure">Thủ thuật</option><option value="vaccination">Tiêm chủng</option></select></label>
              <label>Lý do khám<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            </div>
          </section>
        ) : null}
        {step === 3 ? (
          <section>
            <h2>Chọn slot phù hợp</h2>
            <div className="sched-appt-slot-cards">
              {availableSchedules.map((schedule) => (
                <button
                  key={schedule.id}
                  type="button"
                  className={String(selectedSchedule?.id) === String(schedule.id) ? 'is-active' : ''}
                  onClick={() => setSelectedScheduleId(schedule.id)}
                >
                  <strong>{schedule.start} - {schedule.end}</strong>
                  <span>{schedule.doctor}</span>
                  <small>{schedule.department} - còn {schedule.availableSlots} slot - {formatPercent(schedule.utilization)}</small>
                </button>
              ))}
              {!availableSchedules.length ? <p>Chưa có lịch phù hợp. Hãy đổi bác sĩ hoặc generate slot.</p> : null}
            </div>
          </section>
        ) : null}
        {step === 4 ? (
          <section>
            <h2>Xác nhận đặt lịch</h2>
            <div className="sched-appt-preview-checks">
              <p><CheckCircle2 size={16} />Bệnh nhân: {selectedPatient?.name || 'Chưa chọn bệnh nhân'}</p>
              <p><CheckCircle2 size={16} />Bác sĩ {selectedDoctor?.name || 'được chọn'} có lịch làm việc</p>
              <p><CheckCircle2 size={16} />Khoa {selectedDepartment?.name || 'được chọn'} còn slot phù hợp</p>
              <p><AlertTriangle size={16} />Backend sẽ validate slot, trùng lịch bệnh nhân và quyền trước khi ghi DB.</p>
            </div>
            <div className="sched-appt-create__actions">
              <button type="button" onClick={() => submit('booked')}><Send size={16} />Tạo ở trạng thái booked</button>
              <button type="button" className="is-primary" onClick={() => submit('confirmed')}><CheckCircle2 size={16} />Tạo và xác nhận</button>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function ConfirmationCenter({ rows, onAction }) {
  const pending = rows.filter((item) => ['booked', 'confirmed'].includes(item.status));
  return (
    <section className="sched-appt-panel sched-appt-comm">
      <header><span>Communication center</span><h2>Lịch cần xác nhận / nhắc</h2></header>
      <div>
        {pending.map((appointment) => (
          <article key={appointment.id}>
            <div><strong>{appointment.patientName}</strong><span>{appointment.patientPhone || 'Không có SĐT'} - {formatClock(appointment.appointmentTime)}</span></div>
            <StatusBadge value={appointment.status} />
            <div>
              <button type="button" onClick={() => onAction('confirm', appointment)}><CheckCircle2 size={15} />Xác nhận</button>
              <button type="button" onClick={() => onAction('reminder', appointment)}><MessageSquareText size={15} />Gửi nhắc</button>
              <button type="button" onClick={() => onAction('call-logged', appointment)}><PhoneCall size={15} />Đã gọi</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RescheduleCancelCenter({ rows, onAction }) {
  const candidates = rows.filter((item) => ['booked', 'confirmed', 'cancelled', 'rescheduled'].includes(item.status));
  return (
    <section className="sched-appt-panel sched-appt-change">
      <header><span>Change control</span><h2>Dời / hủy lịch</h2></header>
      <div>
        {candidates.map((appointment) => (
          <article key={appointment.id}>
            <div><strong>{appointment.patientName}</strong><span>{formatClock(appointment.appointmentTime)} - {appointment.departmentName}</span></div>
            <StatusBadge value={appointment.status} />
            <span>{appointment.doctorName}</span>
            <div>
              <button type="button" onClick={() => onAction('reschedule', appointment)}><CalendarClock size={15} />Dời lịch</button>
              {['booked', 'confirmed'].includes(appointment.status) ? <button type="button" className="is-danger" onClick={() => onAction('cancel', appointment)}><CalendarX2 size={15} />Hủy lịch</button> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CheckInBoard({ rows, onAction }) {
  const candidates = rows.filter((item) => ['booked', 'confirmed', 'checked_in'].includes(item.status));
  return (
    <section className="sched-appt-panel sched-appt-checkin">
      <header><span>Check-in monitor</span><h2>Bệnh nhân chờ check-in</h2></header>
      <div>
        {candidates.map((appointment) => {
          const timeState = getTimeState(appointment);
          return (
            <article key={appointment.id} className={`is-${timeState.tone}`}>
              <time>{formatClock(appointment.appointmentTime)}</time>
              <div><strong>{appointment.patientName}</strong><span>{appointment.patientCode} - {appointment.patientPhone || 'Không có SĐT'}</span></div>
              <span>{appointment.departmentName}<small>{appointment.doctorName}</small></span>
              <b>{timeState.label}</b>
              <button type="button" onClick={() => onAction('checkin', appointment)} disabled={appointment.status === 'checked_in'}>
                <ClipboardCheck size={15} />Check-in
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function NoShowBoard({ rows, onAction }) {
  const candidates = rows
    .filter((item) => item.status === 'no_show' || (['booked', 'confirmed'].includes(item.status) && getLateMinutes(item) >= 15))
    .sort((first, second) => getLateMinutes(second) - getLateMinutes(first));
  return (
    <section className="sched-appt-panel sched-appt-noshow">
      <header><span>No-show candidates</span><h2>Quá giờ chưa check-in</h2></header>
      <div>
        {candidates.map((appointment) => (
          <article key={appointment.id}>
            <strong>{appointment.patientName}</strong>
            <span>{formatClock(appointment.appointmentTime)} - trễ {getLateMinutes(appointment)} phút</span>
            <small>{appointment.departmentName} - {appointment.doctorName}</small>
            <StatusBadge value={appointment.status} />
            <div>
              <button type="button" onClick={() => onAction('call-logged', appointment)}><PhoneCall size={15} />Gọi lại</button>
              <button type="button" onClick={() => onAction('noshow', appointment)}><UserRoundX size={15} />Đánh dấu no-show</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function WaitlistBoard({ rows, onAction }) {
  return (
    <section className="sched-appt-panel sched-appt-waitlist">
      <header><span>Waitlist matching</span><h2>Danh sách chờ slot</h2></header>
      <div>
        {rows.map((item) => (
          <article key={item.id} className={`is-${item.status}`}>
            <div><strong>{item.patientName}</strong><span>{item.patientCode} - chờ {item.waitHours} giờ</span></div>
            <span>{item.departmentName}<small>{item.doctorName}</small></span>
            <span>{formatDate(item.preferredDate)}<small>{item.preferredTimeRange}</small></span>
            <b>{item.status}</b>
            <div>
              <button type="button" onClick={() => onAction('waitlist-find', item)}><WandSparkles size={15} />Tìm slot</button>
              <button type="button" onClick={() => onAction('waitlist-offer', item)}><Send size={15} />Offer slot</button>
            </div>
          </article>
        ))}
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
  const data = useAppointmentData(date);
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

  async function runAppointmentAction(action, appointment, payload = {}) {
    const appointmentLabel = appointment?.patientName ? `${appointment.patientName} (${appointment.patientCode})` : 'lịch hẹn';
    const setStatus = (message) => setMessage(message);

    if (action === 'create-missing-data') {
      setMessage('Cần chọn bệnh nhân, bác sĩ, khoa và lịch làm việc hợp lệ trước khi tạo lịch hẹn.');
      return;
    }

    if (action === 'reminder' || action === 'call-logged' || action === 'waitlist-find') {
      const messages = {
        reminder: `Đã ghi nhận yêu cầu nhắc lịch cho ${appointmentLabel}.`,
        'call-logged': `Đã ghi nhận cuộc gọi chăm sóc cho ${appointmentLabel}.`,
        'waitlist-find': `Đã lọc slot phù hợp cho ${appointment?.patientName || 'bệnh nhân waitlist'}.`,
      };
      setMessage(messages[action]);
      return;
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
        run: () => schedulingApi.cancelAppointment(appointment.id, { cancel_reason: 'Hủy bởi điều phối viên' }),
        confirm: {
          title: 'Xác nhận hủy lịch',
          body: `Hủy lịch hẹn của ${appointmentLabel}. Hành động này sẽ ảnh hưởng slot và queue liên quan.`,
          confirmLabel: 'hủy lịch',
        },
      },
      reschedule: {
        pending: 'Đang dời lịch hẹn...',
        success: `Đã gửi yêu cầu dời lịch cho ${appointmentLabel}.`,
        run: () => {
          const nextTime = window.prompt('Nhập thời gian mới theo định dạng YYYY-MM-DDTHH:mm', getDateKey(appointment.appointmentTime) ? `${getDateKey(appointment.appointmentTime)}T${formatClock(appointment.appointmentTime)}` : '');
          if (!nextTime) return Promise.resolve({ skipped: true });
          return schedulingApi.rescheduleAppointment(appointment.id, {
            new_appointment_time: nextTime,
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
          if (!appointment?.offeredSlotId) {
            throw new Error('Waitlist này chưa có offered_slot_id. Hãy chọn slot phù hợp trước khi offer.');
          }
          return schedulingApi.offerWaitlistSlot(appointment.id, { offered_slot_id: appointment.offeredSlotId });
        },
        confirm: {
          title: 'Xác nhận offer slot',
          body: `Gửi slot đang đề xuất cho ${appointment?.patientName || 'bệnh nhân waitlist'}.`,
          confirmLabel: 'offer slot',
        },
      },
    }[action];

    if (!actionConfig) {
      setMessage('Thao tác lịch hẹn chưa được hỗ trợ trên màn hình này.');
      return;
    }

    await runSchedulingAction({
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
    <main className={`sched-appt-page sched-appt-page--${view}`}>
      <Header config={config} date={date} setDate={setDate} data={data} loading={data.loading} onRefresh={data.refresh} />
      {message ? <p className="sched-appt-toast">{message}</p> : null}
      {data.error ? <p className="sched-appt-notice">{data.error}</p> : null}
      {data.loading ? <p className="sched-appt-loading"><LoaderCircle size={16} />Đang tải dữ liệu lịch hẹn...</p> : null}

      {view !== 'create' ? <AppointmentKpis summary={data.summary} /> : null}

      {view === 'list' ? (
        <>
          <FilterBar query={query} setQuery={setQuery} activeTab={activeTab} setActiveTab={setActiveTab} />
          <section className="sched-appt-layout">
            <AppointmentTable rows={filteredRows} selected={selectedAppointment} onSelect={setSelectedAppointment} onAction={runAppointmentAction} />
            <DetailDrawer appointment={selectedAppointment} />
          </section>
        </>
      ) : null}

      {view === 'calendar' ? <CalendarView appointments={filteredRows} doctors={data.doctors} /> : null}
      {view === 'create' ? <CreateWizard data={data} onAction={runAppointmentAction} /> : null}
      {view === 'confirmation' ? <ConfirmationCenter rows={data.appointments} onAction={runAppointmentAction} /> : null}
      {view === 'reschedule' ? <RescheduleCancelCenter rows={data.appointments} onAction={runAppointmentAction} /> : null}
      {view === 'checkIn' ? <CheckInBoard rows={data.appointments} onAction={runAppointmentAction} /> : null}
      {view === 'noShow' ? <NoShowBoard rows={data.appointments} onAction={runAppointmentAction} /> : null}
      {view === 'waitlist' ? <WaitlistBoard rows={data.waitlistItems} onAction={runAppointmentAction} /> : null}

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
