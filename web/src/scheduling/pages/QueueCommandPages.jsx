import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRightLeft,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  Filter,
  History,
  ListOrdered,
  Megaphone,
  MonitorPlay,
  MoreHorizontal,
  PhoneCall,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Timer,
  UserCheck,
  UserRoundX,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { schedulingApi } from '../api/schedulingApi';
import { useSchedulingData } from '../context/SchedulingDataContext';
import { downloadJsonFile, runSchedulingAction } from '../utils/schedulingActions';

const VIEW_CONFIG = {
  board: {
    eyebrow: 'Realtime Queue Command Board',
    title: 'Queue board',
    copy: 'Theo dõi hàng đợi khám realtime theo khoa, bác sĩ, phòng, trạng thái và SLA.',
  },
  today: {
    eyebrow: 'Today Queue Registry',
    title: 'Queue hôm nay',
    copy: 'Bảng tổng hợp toàn bộ lượt queue trong ngày, phục vụ lọc sâu, audit và export vận hành.',
  },
  call: {
    eyebrow: 'Call Console',
    title: 'Gọi bệnh nhân',
    copy: 'Màn hình gọi số chuyên dụng cho bác sĩ, điều dưỡng hoặc quầy gọi số với thao tác lớn và nhanh.',
  },
  transfer: {
    eyebrow: 'Transfer & Priority Control',
    title: 'Chuyển / ưu tiên queue',
    copy: 'Điều phối queue giữa bác sĩ, khoa, phòng và thiết lập ưu tiên/VIP có lý do rõ ràng.',
  },
  missed: {
    eyebrow: 'Missed Call & No-show Desk',
    title: 'Xử lý missed call / no-show',
    copy: 'Theo dõi skipped, recalled, called quá lâu và các lượt cần mark no-show hoặc gọi lại.',
  },
  public: {
    eyebrow: 'Public Queue Display',
    title: 'Public queue board',
    copy: 'Màn hình TV/kiosk public-safe cho khu vực chờ, chỉ hiển thị số queue và phòng gọi.',
  },
};

const QUEUE_COLUMNS = [
  ['waiting', 'Đang chờ', 'Bệnh nhân đã check-in, chờ gọi'],
  ['called', 'Đã gọi', 'Đã gọi số, chờ vào phòng'],
  ['skipped', 'Bỏ qua / missed', 'Gọi nhỡ hoặc bị bỏ qua'],
  ['in_service', 'Đang phục vụ', 'Đang khám hoặc đang xử lý'],
  ['completed', 'Hoàn tất', 'Queue đã hoàn tất'],
  ['no_show', 'No-show / hủy', 'Không đến hoặc đã hủy'],
];

const STATUS_META = {
  waiting: { label: 'Đang chờ', tone: 'blue' },
  called: { label: 'Đã gọi', tone: 'amber' },
  recalled: { label: 'Gọi lại', tone: 'orange' },
  skipped: { label: 'Bỏ qua', tone: 'orange' },
  in_service: { label: 'Đang phục vụ', tone: 'violet' },
  completed: { label: 'Hoàn tất', tone: 'green' },
  no_show: { label: 'No-show', tone: 'red' },
  cancelled: { label: 'Đã hủy', tone: 'gray' },
};

const TYPE_META = {
  normal: 'Normal',
  priority: 'Ưu tiên',
  vip: 'VIP',
  emergency: 'Cấp cứu',
};

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function minutesSince(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function formatTime(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }
  return String(value).slice(0, 5);
}

function formatMinutes(value) {
  const minutes = safeNumber(value);
  if (minutes < 60) return `${minutes} phút`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}p`;
}

function queueId(item, index = 0) {
  return item.queue_ticket_id || item.ticket_id || item.id || item._id || `queue-${index}`;
}

function normalizeTicket(item = {}, index = 0) {
  const status = String(item.status || 'waiting').toLowerCase();
  const checkin = item.checkin_time || item.checked_in_at || item.created_at || new Date().toISOString();
  const waitingMinutes = safeNumber(item.waiting_minutes ?? item.wait_minutes) || minutesSince(checkin);
  const serviceMinutes = safeNumber(item.service_minutes) || (item.service_start_time ? minutesSince(item.service_start_time) : 0);
  const type = String(item.queue_type || 'normal').toLowerCase();
  const queueNumber = item.display_number || item.queue_number || `Q-${String(index + 1).padStart(3, '0')}`;
  const nursingStage = item.nursing_stage || item.nursing?.stage || (status === 'waiting' ? 'waiting_nurse' : status === 'in_service' ? 'ready_for_doctor' : 'not_started');
  const slaBreached = Boolean(item.sla_breached_at) || waitingMinutes >= 30;

  return {
    id: queueId(item, index),
    appointmentId: item.appointment_id || item.appointment?.id || '',
    encounterId: item.encounter_id || item.encounter?.id || '',
    patientId: item.patient_id || item.patient?.id || '',
    patientCode: item.patient_code || item.patient?.code || `BN${String(index + 1001).padStart(6, '0')}`,
    patientName: item.patient_name || item.patient?.name || ['Nguyễn Văn An', 'Trần Thị Bích', 'Lê Quốc Tuấn', 'Phạm Thu Hương'][index % 4],
    doctorId: item.doctor_id || item.doctor?.id || '',
    doctorName: item.doctor_name || item.doctor?.name || 'Chưa phân bác sĩ',
    departmentId: item.department_id || item.department?.id || '',
    departmentName: item.department_name || item.department?.name || 'Chưa xác định khoa',
    queueNumber,
    queueType: type,
    status: status === 'recalled' ? 'called' : status,
    rawStatus: status,
    checkinTime: checkin,
    calledTime: item.called_time || '',
    serviceStartTime: item.service_start_time || '',
    completedTime: item.completed_time || '',
    skippedTime: item.skipped_at || '',
    noShowTime: item.no_show_at || '',
    estimatedCalledAt: item.estimated_called_at || '',
    counterId: item.counter_id || '',
    room: item.doctor_room_id || item.room_name || item.counter_name || `P. Khám ${(index % 4) + 1}`,
    nursingStage,
    readyForDoctorAt: item.ready_for_doctor_at || '',
    assignedNurse: item.assigned_nurse?.name || item.assigned_nurse_name || '',
    waitingMinutes,
    serviceMinutes,
    slaStatus: item.sla_status || (slaBreached ? 'breached' : waitingMinutes >= 20 ? 'warning' : 'ok'),
    riskTags: safeArray(item.risk_tags).length
      ? safeArray(item.risk_tags)
      : [
          type === 'vip' ? 'VIP' : '',
          type === 'priority' ? 'Ưu tiên' : '',
          slaBreached ? 'Quá SLA' : '',
          nursingStage === 'ready_for_doctor' ? 'Ready for doctor' : '',
        ].filter(Boolean),
    availableActions: item.available_actions || [],
    appointmentTime: item.appointment_time || item.appointment?.appointment_time || '',
    appointmentType: item.appointment_type || item.appointment?.appointment_type || 'outpatient',
  };
}

function fallbackTickets(appointments = []) {
  const seeds = appointments.length ? appointments.slice(0, 16) : Array.from({ length: 16 }, (_, index) => ({ index }));
  const statuses = ['waiting', 'waiting', 'called', 'skipped', 'in_service', 'completed', 'no_show'];
  const types = ['normal', 'priority', 'normal', 'vip'];

  return seeds.map((appointment, index) => {
    const status = statuses[index % statuses.length];
    const minutes = 8 + index * 5;
    const checkin = new Date(Date.now() - minutes * 60000).toISOString();
    return normalizeTicket({
      queue_ticket_id: `fallback-queue-${index}`,
      appointment_id: appointment.appointment_id || appointment.id || '',
      queue_number: `${index % 3 === 0 ? 'NTQ-P' : 'NTQ-N'}${String(index + 1).padStart(3, '0')}`,
      queue_type: types[index % types.length],
      status,
      checkin_time: checkin,
      called_time: ['called', 'skipped', 'in_service'].includes(status) ? new Date(Date.now() - Math.max(2, minutes - 4) * 60000).toISOString() : '',
      service_start_time: status === 'in_service' ? new Date(Date.now() - 18 * 60000).toISOString() : '',
      completed_time: status === 'completed' ? new Date(Date.now() - 6 * 60000).toISOString() : '',
      patient_name: appointment.patient?.full_name || appointment.patient_name,
      patient_code: appointment.patient_code,
      doctor_name: appointment.doctor_name || appointment.doctor?.name || ['BS. Trần Thanh Hải', 'BS. Lê Minh Tuấn', 'BS. Nguyễn Thị Lan'][index % 3],
      department_name: appointment.department_name || appointment.department?.name || ['Nội tổng quát', 'Tim mạch', 'Nhi khoa'][index % 3],
      nursing_stage: index % 4 === 0 ? 'ready_for_doctor' : index % 4 === 1 ? 'vital_done' : 'waiting_nurse',
      doctor_room_id: `P. Khám ${(index % 4) + 1}`,
    }, index);
  });
}

function buildSummary(tickets) {
  const summary = {
    total: tickets.length,
    waiting: 0,
    called: 0,
    skipped: 0,
    in_service: 0,
    completed: 0,
    no_show: 0,
    cancelled: 0,
    slaBreached: 0,
    avgWait: 0,
    maxWait: 0,
  };

  tickets.forEach((ticket) => {
    if (summary[ticket.status] !== undefined) summary[ticket.status] += 1;
    if (ticket.rawStatus === 'recalled') summary.called += ticket.status === 'called' ? 0 : 1;
    if (ticket.slaStatus === 'breached') summary.slaBreached += 1;
    summary.maxWait = Math.max(summary.maxWait, ticket.waitingMinutes);
  });

  summary.avgWait = tickets.length ? Math.round(tickets.reduce((sum, ticket) => sum + ticket.waitingMinutes, 0) / tickets.length) : 0;
  return summary;
}

function groupByColumns(tickets) {
  return QUEUE_COLUMNS.reduce((result, [key]) => {
    if (key === 'no_show') {
      result[key] = tickets.filter((ticket) => ['no_show', 'cancelled'].includes(ticket.status));
    } else {
      result[key] = tickets.filter((ticket) => ticket.status === key);
    }
    return result;
  }, {});
}

function useQueueCommandData() {
  const scheduling = useSchedulingData();
  const [remote, setRemote] = useState({ board: null, tickets: [], summary: null, publicBoard: null, todayAppointments: [] });
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState({ loading: false, ticket: null, timeline: [], nursing: null, actions: null });
  const [message, setMessage] = useState('');
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadingRemote(true);
      const today = dateKey();
      const [boardResult, queueResult, summaryResult, appointmentsResult, publicResult] = await Promise.allSettled([
        schedulingApi.getOperationsQueueBoard({ date: today, include_patient: true, include_appointment: true, include_nursing: true }),
        schedulingApi.listQueueTickets({ date: today, limit: 200 }),
        schedulingApi.getQueueSummaryToday({ date: today }),
        schedulingApi.getTodayAppointments({ date: today }),
        schedulingApi.getPublicQueueBoard({ date: today }),
      ]);

      if (!active) return;
      setRemote({
        board: boardResult.status === 'fulfilled' ? boardResult.value : null,
        tickets: queueResult.status === 'fulfilled' ? safeArray(queueResult.value?.items) : [],
        summary: summaryResult.status === 'fulfilled' ? summaryResult.value : null,
        todayAppointments: appointmentsResult.status === 'fulfilled' ? safeArray(appointmentsResult.value?.items || appointmentsResult.value) : [],
        publicBoard: publicResult.status === 'fulfilled' ? publicResult.value : null,
      });
      setLoadingRemote(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const tickets = useMemo(() => {
    const aggregateItems = remote.board?.lanes
      ? Object.values(remote.board.lanes).flatMap((items) => safeArray(items))
      : safeArray(remote.board?.items);
    const source = aggregateItems.length ? aggregateItems : remote.tickets.length ? remote.tickets : fallbackTickets(remote.todayAppointments);
    return source.map(normalizeTicket);
  }, [remote.board, remote.tickets, remote.todayAppointments]);

  useEffect(() => {
    if (!selectedId && tickets[0]?.id) setSelectedId(tickets[0].id);
  }, [selectedId, tickets]);

  const selectedTicket = tickets.find((ticket) => String(ticket.id) === String(selectedId)) || tickets[0] || null;

  useEffect(() => {
    let active = true;
    if (!selectedTicket?.id || String(selectedTicket.id).startsWith('fallback')) return undefined;

    async function loadDetail() {
      setDetail((current) => ({ ...current, loading: true }));
      const [ticketResult, timelineResult, nursingResult, actionsResult] = await Promise.allSettled([
        schedulingApi.getQueueTicket(selectedTicket.id),
        schedulingApi.getQueueTimeline(selectedTicket.id),
        schedulingApi.getNursingQueueContext(selectedTicket.id),
        schedulingApi.getNursingQueueAvailableActions(selectedTicket.id),
      ]);

      if (!active) return;
      setDetail({
        loading: false,
        ticket: ticketResult.status === 'fulfilled' ? ticketResult.value : null,
        timeline: timelineResult.status === 'fulfilled' ? safeArray(timelineResult.value?.items) : [],
        nursing: nursingResult.status === 'fulfilled' ? nursingResult.value : null,
        actions: actionsResult.status === 'fulfilled' ? actionsResult.value : null,
      });
    }

    loadDetail();
    return () => {
      active = false;
    };
  }, [selectedTicket?.id]);

  const summary = useMemo(() => {
    const computed = buildSummary(tickets);
    const api = remote.board?.summary || remote.summary || {};
    return {
      ...computed,
      total: safeNumber(api.total) || computed.total,
      waiting: safeNumber(api.waiting) || computed.waiting,
      called: safeNumber(api.called) || computed.called,
      in_service: safeNumber(api.in_service) || computed.in_service,
      completed: safeNumber(api.completed) || computed.completed,
      skipped: safeNumber(api.skipped) || computed.skipped,
      no_show: safeNumber(api.no_show) || computed.no_show,
      cancelled: safeNumber(api.cancelled) || computed.cancelled,
      slaBreached: safeNumber(api.sla_breached) || computed.slaBreached,
      avgWait: safeNumber(api.avg_waiting_minutes || api.average_wait_minutes) || computed.avgWait,
      maxWait: safeNumber(api.max_waiting_minutes || api.max_wait_minutes) || computed.maxWait,
    };
  }, [remote.board, remote.summary, tickets]);

  const refreshQueue = useCallback(async () => {
    setReloadKey((current) => current + 1);
    await scheduling.refresh();
  }, [scheduling]);

  async function runAction(label, action, options = {}) {
    await runSchedulingAction({
      action: async () => {
        const result = await action();
        await refreshQueue();
        return result;
      },
      confirm: options.confirm,
      pendingMessage: options.pendingMessage || 'Đang gửi thao tác queue...',
      successTitle: 'Queue đã cập nhật',
      successBody: label,
      errorTitle: 'Không xử lý được queue',
      errorBody: 'Thao tác queue không thành công.',
      to: '/scheduling/queue',
      onStatus: setMessage,
    });
  }

  return {
    ...scheduling,
    columns: groupByColumns(tickets),
    detail,
    loadingRemote,
    message,
    publicBoard: remote.publicBoard,
    refresh: refreshQueue,
    runAction,
    selectedId,
    selectedTicket,
    setMessage,
    setSelectedId,
    summary,
    tickets,
  };
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.waiting;
  return <span className={`sched-queue-status is-${meta.tone}`}>{meta.label}</span>;
}

function TypeBadge({ type }) {
  return <span className={`sched-queue-type is-${type}`}>{TYPE_META[type] || type}</span>;
}

function Header({ config, data }) {
  return (
    <section className="sched-queue-hero">
      <div>
        <span><ListOrdered size={16} />{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.copy}</p>
      </div>
      <div className="sched-queue-hero__tools">
        <label><span>Ngày</span><input type="date" defaultValue={dateKey()} /></label>
        <label><span>Khoa</span><select defaultValue="all"><option value="all">Tất cả khoa</option>{data.departments.map((item) => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Chế độ</span><select defaultValue="board"><option value="board">Board</option><option value="table">Table</option><option value="compact">Compact</option><option value="tv">TV Preview</option></select></label>
        <button type="button" onClick={data.refresh}><RefreshCw size={16} />Làm mới</button>
      </div>
    </section>
  );
}

function QuickActions({ data }) {
  return (
    <section className="sched-queue-actions">
      <button type="button" onClick={() => data.runAction('Đã gọi số tiếp theo.', () => schedulingApi.callNextQueue({}), {
        confirm: {
          title: 'Gọi số tiếp theo',
          body: 'Hệ thống sẽ chọn ticket phù hợp theo ưu tiên queue hiện tại.',
          confirmLabel: 'gọi số',
        },
      })}><Megaphone size={16} />Gọi số tiếp theo</button>
      <button type="button" onClick={() => {
        const appointmentId = window.prompt('Nhập appointment_id để tạo queue từ lịch hẹn hôm nay');
        if (!appointmentId) {
          data.setMessage('Cần appointment_id để tạo queue ticket an toàn.');
          return;
        }
        data.runAction('Đã tạo queue ticket từ lịch hẹn.', () => schedulingApi.createQueueFromAppointment(appointmentId), {
          confirm: {
            title: 'Tạo queue ticket',
            body: `Tạo queue từ appointment ${appointmentId}. Backend sẽ kiểm tra lịch trong ngày và queue active.`,
            confirmLabel: 'tạo queue',
          },
        });
      }}><CalendarClock size={16} />Tạo queue ticket</button>
      <Link to="/scheduling/appointments/check-in"><ClipboardCheck size={16} />Check-in từ lịch hẹn</Link>
      <Link to="/scheduling/queue/public-board"><MonitorPlay size={16} />Public board</Link>
      <button type="button" onClick={() => {
        downloadJsonFile(`queue-${dateKey()}.json`, data.tickets);
        data.setMessage('Đã xuất danh sách queue hôm nay.');
      }}><Download size={16} />Xuất danh sách</button>
      <span className={`sched-queue-sync ${data.backendConnected ? '' : 'is-demo'}`}><i />{data.backendConnected ? 'Realtime ready' : 'Demo/fallback data'}</span>
    </section>
  );
}

function Kpis({ summary }) {
  const cards = [
    ['total', 'Tổng queue', summary.total, ListOrdered, 'blue'],
    ['waiting', 'Đang chờ', summary.waiting, Clock3, 'cyan'],
    ['called', 'Đã gọi', summary.called, Megaphone, 'amber'],
    ['in_service', 'Đang phục vụ', summary.in_service, Stethoscope, 'violet'],
    ['skipped', 'Bỏ qua', summary.skipped, PhoneCall, 'orange'],
    ['completed', 'Hoàn tất', summary.completed, CheckCircle2, 'green'],
    ['no_show', 'No-show', summary.no_show, UserRoundX, 'red'],
    ['sla', 'Chờ quá SLA', summary.slaBreached, ShieldAlert, 'red'],
    ['avg', 'Chờ TB', formatMinutes(summary.avgWait), Timer, 'teal'],
    ['max', 'Chờ lâu nhất', formatMinutes(summary.maxWait), AlertTriangle, 'orange'],
  ];

  return (
    <section className="sched-queue-kpis">
      {cards.map(([id, label, value, Icon, tone]) => (
        <article key={id} className={`is-${tone}`}>
          <span>{label}<Icon size={18} /></span>
          <strong>{value}</strong>
          <small>{id === 'sla' ? 'ưu tiên xử lý ngay' : 'cập nhật realtime/polling'}</small>
        </article>
      ))}
    </section>
  );
}

function FilterChips({ active, setActive, tickets }) {
  const chips = [
    ['all', 'Tất cả'],
    ['waiting', 'Đang chờ'],
    ['called', 'Đã gọi'],
    ['skipped', 'Bỏ qua'],
    ['in_service', 'Đang phục vụ'],
    ['completed', 'Hoàn tất'],
    ['no_show', 'No-show'],
    ['vip', 'VIP'],
    ['priority', 'Ưu tiên'],
    ['sla', 'Chờ quá SLA'],
    ['ready', 'Ready for doctor'],
  ];

  function count(id) {
    if (id === 'all') return tickets.length;
    if (id === 'vip' || id === 'priority') return tickets.filter((ticket) => ticket.queueType === id).length;
    if (id === 'sla') return tickets.filter((ticket) => ticket.slaStatus === 'breached').length;
    if (id === 'ready') return tickets.filter((ticket) => ticket.nursingStage === 'ready_for_doctor').length;
    return tickets.filter((ticket) => ticket.status === id).length;
  }

  return (
    <section className="sched-queue-chips">
      {chips.map(([id, label]) => (
        <button key={id} type="button" className={active === id ? 'is-active' : ''} onClick={() => setActive(id)}>
          <i />{label}<strong>{count(id)}</strong>
        </button>
      ))}
    </section>
  );
}

function ticketMatches(ticket, filter, query) {
  const matchesFilter =
    filter === 'all' ||
    ticket.status === filter ||
    ticket.queueType === filter ||
    (filter === 'sla' && ticket.slaStatus === 'breached') ||
    (filter === 'ready' && ticket.nursingStage === 'ready_for_doctor');
  const text = [ticket.queueNumber, ticket.patientName, ticket.patientCode, ticket.doctorName, ticket.departmentName, ticket.room].join(' ').toLowerCase();
  return matchesFilter && (!query || text.includes(query.toLowerCase()));
}

function QueueTicketCard({ ticket, selected, onSelect, data }) {
  return (
    <article className={`sched-queue-card is-${ticket.status} ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
      <header>
        <strong>{ticket.queueNumber}</strong>
        <TypeBadge type={ticket.queueType} />
      </header>
      <h3>{ticket.patientName}</h3>
      <p>{ticket.patientCode} · {ticket.departmentName}</p>
      <div className="sched-queue-card__meta">
        <span><Stethoscope size={12} />{ticket.doctorName}</span>
        <span><Clock3 size={12} />Chờ {formatMinutes(ticket.waitingMinutes)}</span>
        <span><CalendarClock size={12} />{ticket.room}</span>
      </div>
      <div className="sched-queue-card__journey">
        {['checkin', 'nurse', 'ready', 'called', 'service'].map((step) => (
          <i key={step} className={
            (step === 'checkin') ||
            (step === 'nurse' && ticket.nursingStage !== 'not_started') ||
            (step === 'ready' && ticket.nursingStage === 'ready_for_doctor') ||
            (step === 'called' && ['called', 'in_service', 'completed'].includes(ticket.status)) ||
            (step === 'service' && ['in_service', 'completed'].includes(ticket.status))
              ? 'is-done' : ''
          } />
        ))}
      </div>
      <footer>
        <StatusBadge status={ticket.status} />
        {ticket.slaStatus === 'breached' ? <span className="sched-queue-sla">Quá SLA</span> : null}
      </footer>
      <div className="sched-queue-card__actions">
        {ticket.status === 'waiting' ? <button type="button" onClick={(event) => { event.stopPropagation(); data.runAction(`Đã gọi ${ticket.queueNumber}.`, () => schedulingApi.callQueueTicket(ticket.id), {
          confirm: { title: 'Gọi queue ticket', body: `Gọi ${ticket.queueNumber} - ${ticket.patientName}.`, confirmLabel: 'gọi bệnh nhân' },
        }); }}>Gọi</button> : null}
        {ticket.status === 'called' ? <button type="button" onClick={(event) => { event.stopPropagation(); data.runAction(`Bắt đầu phục vụ ${ticket.queueNumber}.`, () => schedulingApi.startQueueService(ticket.id), {
          confirm: { title: 'Bắt đầu phục vụ', body: `Chuyển ${ticket.queueNumber} sang trạng thái đang phục vụ.`, confirmLabel: 'bắt đầu' },
        }); }}>Bắt đầu</button> : null}
        {['waiting', 'called', 'skipped'].includes(ticket.status) ? <button type="button" onClick={(event) => { event.stopPropagation(); data.runAction(`Đã skip ${ticket.queueNumber}.`, () => schedulingApi.skipQueueTicket(ticket.id, { reason: 'Bỏ qua bởi điều phối viên' }), {
          confirm: { title: 'Bỏ qua queue', body: `Bỏ qua ${ticket.queueNumber}. Có thể gọi lại sau từ Missed/no-show.`, confirmLabel: 'bỏ qua' },
        }); }}>Bỏ qua</button> : null}
        <button type="button" onClick={(event) => { event.stopPropagation(); data.setSelectedId(ticket.id); }}><MoreHorizontal size={13} /></button>
      </div>
    </article>
  );
}

function QueueBoard({ data }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const visibleTickets = data.tickets.filter((ticket) => ticketMatches(ticket, filter, query));
  const columns = groupByColumns(visibleTickets);

  return (
    <>
      <section className="sched-queue-filterbar">
        <div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm số queue, bệnh nhân, bác sĩ, khoa, phòng..." /></div>
        <button type="button" onClick={() => data.setMessage('Bộ lọc nhanh đã có ở chip trạng thái. Bộ lọc nâng cao sẽ dùng cấu hình ngày/khoa/chế độ phía trên.')}>
          <Filter size={15} />Bộ lọc nâng cao
        </button>
      </section>
      <FilterChips active={filter} setActive={setFilter} tickets={data.tickets} />
      <section className="sched-queue-layout">
        <main className="sched-queue-board">
          {QUEUE_COLUMNS.map(([key, label, copy]) => (
            <section key={key} className="sched-queue-lane">
              <header>
                <div><strong>{label}</strong><small>{copy}</small></div>
                <span>{columns[key]?.length || 0}</span>
              </header>
              <div>
                {safeArray(columns[key]).map((ticket) => (
                  <QueueTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    selected={data.selectedTicket?.id === ticket.id}
                    onSelect={() => data.setSelectedId(ticket.id)}
                    data={data}
                  />
                ))}
                {!columns[key]?.length ? <p className="sched-queue-empty">Không có ticket.</p> : null}
              </div>
            </section>
          ))}
        </main>
        <QueueDrawer data={data} />
      </section>
    </>
  );
}

function QueueDrawer({ data }) {
  const ticket = data.selectedTicket;
  if (!ticket) return null;
  const timeline = data.detail.timeline.length ? data.detail.timeline : [
    ['queue.ticket_created', ticket.checkinTime],
    ticket.calledTime ? ['queue.called', ticket.calledTime] : null,
    ticket.serviceStartTime ? ['queue.service_started', ticket.serviceStartTime] : null,
    ticket.completedTime ? ['queue.completed', ticket.completedTime] : null,
  ].filter(Boolean).map(([action, time]) => ({ action, created_at: time }));

  return (
    <aside className="sched-queue-drawer">
      <header>
        <div>
          <span>Queue ticket</span>
          <h2>{ticket.queueNumber}</h2>
          <p>{ticket.patientName} · {ticket.patientCode}</p>
        </div>
        <StatusBadge status={ticket.status} />
      </header>
      <section className="sched-queue-info">
        <div><span>Queue type</span><strong>{TYPE_META[ticket.queueType] || ticket.queueType}</strong></div>
        <div><span>Khoa</span><strong>{ticket.departmentName}</strong></div>
        <div><span>Bác sĩ</span><strong>{ticket.doctorName}</strong></div>
        <div><span>Phòng</span><strong>{ticket.room}</strong></div>
        <div><span>Check-in</span><strong>{formatTime(ticket.checkinTime)}</strong></div>
        <div><span>Đã chờ</span><strong>{formatMinutes(ticket.waitingMinutes)}</strong></div>
        <div><span>Nursing</span><strong>{ticket.nursingStage}</strong></div>
        <div><span>SLA</span><strong>{ticket.slaStatus}</strong></div>
      </section>
      <section className="sched-queue-risk">
        {ticket.riskTags.map((tag) => <span key={tag}><AlertTriangle size={13} />{tag}</span>)}
        {!ticket.riskTags.length ? <span><ShieldAlert size={13} />Không có cảnh báo nổi bật</span> : null}
      </section>
      <section className="sched-queue-drawer-actions">
        <button type="button" onClick={() => data.runAction(`Đã gọi ${ticket.queueNumber}.`, () => schedulingApi.callQueueTicket(ticket.id), {
          confirm: { title: 'Gọi bệnh nhân', body: `Gọi ${ticket.queueNumber} - ${ticket.patientName}.`, confirmLabel: 'gọi' },
        })}><Megaphone size={14} />Gọi</button>
        <button type="button" onClick={() => data.runAction(`Đã gọi lại ${ticket.queueNumber}.`, () => schedulingApi.recallQueueTicket(ticket.id), {
          confirm: { title: 'Gọi lại', body: `Gọi lại ${ticket.queueNumber}.`, confirmLabel: 'gọi lại' },
        })}><PhoneCall size={14} />Gọi lại</button>
        <button type="button" onClick={() => data.runAction(`Bắt đầu phục vụ ${ticket.queueNumber}.`, () => schedulingApi.startQueueService(ticket.id), {
          confirm: { title: 'Bắt đầu phục vụ', body: `Chuyển ${ticket.queueNumber} sang đang phục vụ.`, confirmLabel: 'bắt đầu' },
        })}><UserCheck size={14} />Bắt đầu</button>
        <button type="button" onClick={() => data.runAction(`Đã đánh dấu no-show ${ticket.queueNumber}.`, () => schedulingApi.markQueueNoShow(ticket.id, { reason: 'Điều phối viên đánh dấu no-show' }), {
          confirm: { title: 'Đánh dấu no-show', body: `Chuyển ${ticket.queueNumber} sang no-show.`, confirmLabel: 'mark no-show' },
        })}><UserRoundX size={14} />No-show</button>
        <button type="button" onClick={() => data.runAction(`Đã tạo QR ${ticket.queueNumber}.`, () => schedulingApi.generateQueueQr(ticket.id))}><QrCode size={14} />QR</button>
      </section>
      <section className="sched-queue-timeline">
        <strong>Timeline</strong>
        {timeline.map((item, index) => (
          <span key={`${item.action}-${index}`}>
            <History size={13} />
            <b>{item.action}</b>
            <small>{formatTime(item.created_at)}</small>
          </span>
        ))}
      </section>
    </aside>
  );
}

function QueueToday({ data }) {
  return (
    <section className="sched-queue-today">
      <QueueTable data={data} tickets={data.tickets} />
      <QueueDrawer data={data} />
    </section>
  );
}

function QueueTable({ data, tickets }) {
  return (
    <main className="sched-queue-table">
      <div className="sched-queue-table__head">
        <span>Số queue</span><span>Bệnh nhân</span><span>Khoa</span><span>Bác sĩ</span><span>Trạng thái</span><span>Check-in</span><span>Chờ</span><span>Nursing</span><span>Thao tác</span>
      </div>
      {tickets.map((ticket) => (
        <button key={ticket.id} type="button" className={data.selectedTicket?.id === ticket.id ? 'is-selected' : ''} onClick={() => data.setSelectedId(ticket.id)}>
          <span><strong>{ticket.queueNumber}</strong><TypeBadge type={ticket.queueType} /></span>
          <span><strong>{ticket.patientName}</strong><small>{ticket.patientCode}</small></span>
          <span>{ticket.departmentName}</span>
          <span>{ticket.doctorName}</span>
          <span><StatusBadge status={ticket.status} /></span>
          <span>{formatTime(ticket.checkinTime)}</span>
          <span>{formatMinutes(ticket.waitingMinutes)}</span>
          <span>{ticket.nursingStage}</span>
          <span><Eye size={15} /></span>
        </button>
      ))}
    </main>
  );
}

function CallConsole({ data }) {
  const currentCalled = data.tickets.find((ticket) => ticket.status === 'called') || null;
  const inService = data.tickets.find((ticket) => ticket.status === 'in_service') || null;
  const waiting = data.tickets.filter((ticket) => ticket.status === 'waiting').sort((a, b) => {
    const priority = { vip: 0, priority: 1, normal: 2 };
    return (priority[a.queueType] ?? 2) - (priority[b.queueType] ?? 2) || b.waitingMinutes - a.waitingMinutes;
  });
  const skipped = data.tickets.filter((ticket) => ticket.status === 'skipped');

  return (
    <section className="sched-queue-call">
      <aside>
        <h2>Đang chờ</h2>
        {waiting.slice(0, 12).map((ticket) => (
          <button key={ticket.id} type="button" onClick={() => data.setSelectedId(ticket.id)}>
            <strong>{ticket.queueNumber}</strong>
            <span>{ticket.patientName}</span>
            <small>{formatMinutes(ticket.waitingMinutes)}</small>
          </button>
        ))}
      </aside>
      <main className="sched-queue-call-console">
        <span>SỐ ĐANG GỌI</span>
        <strong>{currentCalled?.queueNumber || '--'}</strong>
        <h2>{currentCalled?.patientName || 'Không có bệnh nhân đang được gọi'}</h2>
        <p>{currentCalled ? `${currentCalled.doctorName} · ${currentCalled.room}` : 'Bấm gọi số tiếp theo để bắt đầu.'}</p>
        <div>
          <button type="button" className="is-primary" onClick={() => data.runAction('Đã gọi số tiếp theo.', () => schedulingApi.callNextQueue({}), {
            confirm: { title: 'Gọi số tiếp theo', body: 'Gọi ticket tiếp theo theo thứ tự ưu tiên hiện tại.', confirmLabel: 'gọi số' },
          })}><Megaphone size={18} />Gọi số tiếp theo</button>
          <button type="button" disabled={!currentCalled} onClick={() => data.runAction('Đã gọi lại.', () => schedulingApi.recallQueueTicket(currentCalled.id), {
            confirm: { title: 'Gọi lại', body: `Gọi lại ${currentCalled?.queueNumber || 'ticket đang gọi'}.`, confirmLabel: 'gọi lại' },
          })}><PhoneCall size={18} />Gọi lại</button>
          <button type="button" disabled={!currentCalled} onClick={() => data.runAction('Đã bắt đầu phục vụ.', () => schedulingApi.startQueueService(currentCalled.id), {
            confirm: { title: 'Bắt đầu phục vụ', body: `Chuyển ${currentCalled?.queueNumber || 'ticket đang gọi'} sang đang phục vụ.`, confirmLabel: 'bắt đầu' },
          })}><UserCheck size={18} />Bắt đầu phục vụ</button>
          <button type="button" disabled={!currentCalled} onClick={() => data.runAction('Đã bỏ qua.', () => schedulingApi.skipQueueTicket(currentCalled.id, { reason: 'Bỏ qua từ call console' }), {
            confirm: { title: 'Bỏ qua ticket', body: `Bỏ qua ${currentCalled?.queueNumber || 'ticket đang gọi'}.`, confirmLabel: 'bỏ qua' },
          })}><XCircle size={18} />Bỏ qua</button>
        </div>
      </main>
      <aside>
        <h2>Đang phục vụ</h2>
        {inService ? <QueueTicketCard ticket={inService} selected={data.selectedTicket?.id === inService.id} onSelect={() => data.setSelectedId(inService.id)} data={data} /> : <p className="sched-queue-empty">Không có lượt đang phục vụ.</p>}
        <h2>Missed / skipped</h2>
        {skipped.slice(0, 4).map((ticket) => (
          <button key={ticket.id} type="button" onClick={() => data.runAction(`Đã gọi lại ${ticket.queueNumber}.`, () => schedulingApi.recallQueueTicket(ticket.id), {
            confirm: { title: 'Gọi lại missed call', body: `Gọi lại ${ticket.queueNumber} - ${ticket.patientName}.`, confirmLabel: 'gọi lại' },
          })}>
            <strong>{ticket.queueNumber}</strong>
            <span>{ticket.patientName}</span>
            <small>Gọi lại</small>
          </button>
        ))}
      </aside>
    </section>
  );
}

function TransferPriority({ data }) {
  const actionable = data.tickets.filter((ticket) => ['waiting', 'called', 'skipped'].includes(ticket.status));
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [targetDoctorId, setTargetDoctorId] = useState('');
  const [queueType, setQueueType] = useState(data.selectedTicket?.queueType || 'normal');
  const [reason, setReason] = useState('');
  const selectedTicket = data.selectedTicket;

  useEffect(() => {
    if (selectedTicket?.queueType) {
      setQueueType(selectedTicket.queueType);
    }
  }, [selectedTicket?.id, selectedTicket?.queueType]);

  return (
    <section className="sched-queue-transfer">
      <main>
        <h2>Cần điều phối</h2>
        <div className="sched-queue-transfer-list">
          {actionable.map((ticket) => (
            <button key={ticket.id} type="button" onClick={() => data.setSelectedId(ticket.id)} className={data.selectedTicket?.id === ticket.id ? 'is-selected' : ''}>
              <span><strong>{ticket.queueNumber}</strong><TypeBadge type={ticket.queueType} /></span>
              <span>{ticket.patientName}<small>{ticket.departmentName} · {ticket.doctorName}</small></span>
              <em>{ticket.waitingMinutes >= 30 ? 'Chờ lâu' : ticket.queueType !== 'normal' ? 'Ưu tiên' : 'Có thể chuyển'}</em>
            </button>
          ))}
        </div>
      </main>
      <aside>
        <h2>Transfer / Priority panel</h2>
        <p>{selectedTicket ? `${selectedTicket.queueNumber} · ${selectedTicket.patientName}` : 'Chọn một ticket để thao tác.'}</p>
        <div className="sched-queue-transfer-form">
          <label><span>Khoa mới</span><select value={targetDepartmentId} onChange={(event) => setTargetDepartmentId(event.target.value)}><option value="">Giữ nguyên khoa</option>{data.departments.map((item) => <option key={item.id || item.name} value={item.id || ''}>{item.name}</option>)}</select></label>
          <label><span>Bác sĩ mới</span><select value={targetDoctorId} onChange={(event) => setTargetDoctorId(event.target.value)}><option value="">Giữ nguyên bác sĩ</option>{data.doctors.map((item) => <option key={item.id || item.name} value={item.id || ''}>{item.name}</option>)}</select></label>
          <label><span>Queue type</span><select value={queueType} onChange={(event) => setQueueType(event.target.value)}><option value="normal">Normal</option><option value="priority">Ưu tiên</option><option value="vip">VIP</option></select></label>
          <label><span>Lý do</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do điều phối hoặc ưu tiên" /></label>
        </div>
        <button type="button" className="sched-queue-primary" disabled={!selectedTicket} onClick={() => data.runAction('Đã cập nhật ưu tiên queue.', () => schedulingApi.reorderQueuePriority(selectedTicket.id, {
          queue_type: queueType,
          priority_reason: reason || 'Điều phối từ queue board',
        }), {
          confirm: { title: 'Cập nhật ưu tiên queue', body: `Cập nhật ${selectedTicket?.queueNumber || 'ticket'} sang ${queueType}.`, confirmLabel: 'cập nhật ưu tiên' },
        })}>
          <ArrowRightLeft size={16} />Cập nhật ưu tiên
        </button>
        <button type="button" disabled={!selectedTicket || (!targetDepartmentId && !targetDoctorId)} onClick={() => data.runAction('Đã chuyển queue sang luồng mới.', () => schedulingApi.transferQueueTicket(selectedTicket.id, {
          department_id: targetDepartmentId || undefined,
          doctor_id: targetDoctorId || undefined,
          reason: reason || 'Điều chuyển từ queue board',
        }), {
          confirm: { title: 'Chuyển queue', body: `Chuyển ${selectedTicket?.queueNumber || 'ticket'} sang bác sĩ/khoa đã chọn.`, confirmLabel: 'chuyển queue' },
        })}>
          <ArrowRightLeft size={16} />Chuyển queue
        </button>
      </aside>
    </section>
  );
}

function MissedNoShow({ data }) {
  const rows = data.tickets.filter((ticket) =>
    ticket.status === 'skipped' ||
    ticket.status === 'no_show' ||
    (ticket.status === 'called' && ticket.waitingMinutes >= 10) ||
    (ticket.rawStatus === 'recalled')
  );

  return (
    <section className="sched-queue-missed">
      {rows.map((ticket) => (
        <article key={ticket.id} className={`is-${ticket.status}`} onClick={() => data.setSelectedId(ticket.id)}>
          <header><strong>{ticket.queueNumber}</strong><StatusBadge status={ticket.status} /></header>
          <h3>{ticket.patientName}</h3>
          <p>{ticket.departmentName} · {ticket.doctorName} · {ticket.room}</p>
          <div><span>Đã chờ/gọi</span><strong>{formatMinutes(ticket.waitingMinutes)}</strong></div>
          <footer>
            <button type="button" onClick={(event) => { event.stopPropagation(); data.runAction(`Đã gọi lại ${ticket.queueNumber}.`, () => schedulingApi.recallQueueTicket(ticket.id), {
              confirm: { title: 'Gọi lại missed call', body: `Gọi lại ${ticket.queueNumber} - ${ticket.patientName}.`, confirmLabel: 'gọi lại' },
            }); }}>Gọi lại</button>
            <button type="button" onClick={(event) => { event.stopPropagation(); data.runAction(`Đã mark no-show ${ticket.queueNumber}.`, () => schedulingApi.markQueueNoShow(ticket.id, { reason: 'Missed call quá SLA' }), {
              confirm: { title: 'Đánh dấu no-show', body: `Chuyển ${ticket.queueNumber} sang no-show.`, confirmLabel: 'mark no-show' },
            }); }}>No-show</button>
          </footer>
        </article>
      ))}
      {!rows.length ? <div className="sched-queue-empty">Không có missed call hoặc no-show candidate.</div> : null}
    </section>
  );
}

function PublicBoard({ data }) {
  const calling = data.tickets.filter((ticket) => ticket.status === 'called').slice(0, 3);
  const inService = data.tickets.filter((ticket) => ticket.status === 'in_service').slice(0, 5);
  const upcoming = data.tickets.filter((ticket) => ticket.status === 'waiting').slice(0, 8);

  return (
    <section className="sched-queue-public">
      <header>
        <div>
          <span>BẢNG GỌI SỐ</span>
          <h2>Khu vực khám ngoại trú</h2>
        </div>
        <strong>{formatTime(new Date())}</strong>
      </header>
      <main>
        <section className="sched-queue-public__calling">
          <span>ĐANG GỌI</span>
          <strong>{calling[0]?.queueNumber || '--'}</strong>
          <p>{calling[0]?.room || 'Vui lòng theo dõi màn hình'}</p>
        </section>
        <section>
          <h3>Đang phục vụ</h3>
          {inService.map((ticket) => <p key={ticket.id}><strong>{ticket.queueNumber}</strong><span>{ticket.room}</span></p>)}
        </section>
        <section>
          <h3>Sắp tới</h3>
          {upcoming.map((ticket) => <p key={ticket.id}><strong>{ticket.queueNumber}</strong><span>{ticket.room}</span></p>)}
        </section>
      </main>
      <footer>Quý khách vui lòng theo dõi số thứ tự. Khi đến lượt, vui lòng di chuyển đến đúng phòng khám.</footer>
    </section>
  );
}

export function QueueCommandPage({ view = 'board' }) {
  const data = useQueueCommandData();
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.board;

  return (
    <main className={`sched-queue-page ${view === 'public' ? 'is-public' : ''}`}>
      {view !== 'public' ? <Header config={config} data={data} /> : null}
      {(data.message || data.error) && view !== 'public' ? (
        <div className={`sched-queue-notice ${data.error ? 'is-warning' : 'is-success'}`}>{data.error || data.message}</div>
      ) : null}
      {view !== 'public' ? <QuickActions data={data} /> : null}
      {view !== 'public' ? <Kpis summary={data.summary} /> : null}

      {view === 'board' ? <QueueBoard data={data} /> : null}
      {view === 'today' ? <QueueToday data={data} /> : null}
      {view === 'call' ? <CallConsole data={data} /> : null}
      {view === 'transfer' ? <TransferPriority data={data} /> : null}
      {view === 'missed' ? <MissedNoShow data={data} /> : null}
      {view === 'public' ? <PublicBoard data={data} /> : null}
    </main>
  );
}
