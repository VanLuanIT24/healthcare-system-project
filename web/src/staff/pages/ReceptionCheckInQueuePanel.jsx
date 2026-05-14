import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  Phone,
  PlayCircle,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Shuffle,
  SkipForward,
  Stethoscope,
  Timer,
  Users,
  XCircle,
} from 'lucide-react';
import { receptionQueueApi } from '../api/receptionQueueApi';

const APPOINTMENT_STATUS_META = {
  booked: { label: 'Chưa xác nhận', tone: 'info' },
  confirmed: { label: 'Đã xác nhận', tone: 'success' },
  checked_in: { label: 'Đã check-in', tone: 'teal' },
  in_consultation: { label: 'Đang khám', tone: 'violet' },
  completed: { label: 'Hoàn tất', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'warning' },
  no_show: { label: 'No-show', tone: 'danger' },
  rescheduled: { label: 'Đã dời lịch', tone: 'violet' },
};

const QUEUE_STATUS_META = {
  waiting: { label: 'Đang chờ', tone: 'info' },
  called: { label: 'Đã gọi', tone: 'teal' },
  recalled: { label: 'Gọi lại', tone: 'violet' },
  in_service: { label: 'Đang phục vụ', tone: 'success' },
  completed: { label: 'Hoàn tất', tone: 'success' },
  skipped: { label: 'Bỏ qua', tone: 'danger' },
  cancelled: { label: 'Đã hủy', tone: 'warning' },
};

const QUEUE_TYPE_META = {
  normal: { label: 'Thường', tone: 'neutral' },
  priority: { label: 'Ưu tiên', tone: 'warning' },
  vip: { label: 'Khẩn / VIP', tone: 'danger' },
};

const CHECKIN_MODES = {
  quick: {
    title: 'Check-in nhanh',
    subtitle: 'Tìm bệnh nhân hoặc mã lịch để check-in trong vài giây tại quầy.',
  },
  waiting: {
    title: 'Danh sách chờ check-in',
    subtitle: 'Những bệnh nhân có lịch hôm nay nhưng chưa qua quầy tiếp nhận.',
  },
  done: {
    title: 'Đã check-in',
    subtitle: 'Theo dõi bệnh nhân đã qua quầy và đã có queue ticket hoặc encounter.',
  },
  print: {
    title: 'In phiếu tiếp nhận',
    subtitle: 'Tìm lại lịch hoặc số thứ tự để in phiếu cho bệnh nhân.',
  },
};

const QUEUE_MODES = {
  board: {
    title: 'Bảng hàng đợi',
    subtitle: 'Màn điều phối queue theo thời gian thực cho lễ tân.',
  },
  call: {
    title: 'Gọi số tiếp theo',
    subtitle: 'Màn thao tác nhanh để gọi bệnh nhân tiếp theo theo khoa hoặc bác sĩ.',
  },
  waiting: {
    title: 'Đang chờ',
    subtitle: 'Danh sách ticket đang chờ được gọi.',
    statuses: ['waiting'],
  },
  called: {
    title: 'Đang gọi',
    subtitle: 'Ticket đã được gọi hoặc gọi lại nhưng chưa bắt đầu phục vụ.',
    statuses: ['called', 'recalled'],
  },
  in_service: {
    title: 'Đang phục vụ',
    subtitle: 'Ticket đang trong phòng khám hoặc quầy phục vụ.',
    statuses: ['in_service'],
  },
  skipped: {
    title: 'Bỏ qua',
    subtitle: 'Ticket bị bỏ qua tạm thời và có thể gọi lại.',
    statuses: ['skipped'],
  },
  completed: {
    title: 'Đã hoàn tất',
    subtitle: 'Tra cứu ticket đã hoàn tất trong ngày hoặc theo bộ lọc.',
    statuses: ['completed'],
  },
  cancelled: {
    title: 'Đã hủy',
    subtitle: 'Tra cứu ticket đã hủy để đối soát thao tác hàng đợi.',
    statuses: ['cancelled'],
  },
  transfer: {
    title: 'Chuyển hàng đợi',
    subtitle: 'Chuyển ticket sang khoa, bác sĩ hoặc luồng phục vụ khác khi backend cho phép.',
  },
};

const QUEUE_BOARD_COLUMNS = [
  { key: 'waiting', label: 'Đang chờ' },
  { key: 'called', label: 'Đang gọi' },
  { key: 'in_service', label: 'Đang phục vụ' },
  { key: 'skipped', label: 'Bỏ qua' },
];

const WAITING_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'booked', label: 'Chưa xác nhận' },
  { key: 'late', label: 'Đã trễ' },
  { key: 'soon', label: 'Sắp tới' },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatInteger(value) {
  return new Intl.NumberFormat('vi-VN').format(toNumber(value));
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatTime(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '--';
  return `${formatTime(value)} · ${formatDate(value)}`;
}

function getMinutesSince(value, now = new Date()) {
  if (!value) return 0;
  const start = new Date(value).getTime();
  const end = new Date(now).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60000));
}

function formatMinutes(minutes) {
  const normalized = Math.max(0, Math.round(toNumber(minutes)));
  if (normalized >= 60) {
    const hours = Math.floor(normalized / 60);
    const rest = normalized % 60;
    return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
  }
  return `${normalized} phút`;
}

function getErrorMessage(error, fallback = 'Không thể xử lý yêu cầu.') {
  return error?.payload?.message || error?.message || fallback;
}

function getAppointmentId(item) {
  return item?.appointment_id || item?.appointment?.appointment_id || item?.id || item?._id || '';
}

function getQueueTicketId(item) {
  return item?.queue_ticket_id || item?.queue_ticket?.queue_ticket_id || item?.ticket_id || item?.id || item?._id || '';
}

function getStatusMeta(status, category = 'appointment') {
  const source = category === 'queue' ? QUEUE_STATUS_META : APPOINTMENT_STATUS_META;
  return source[status] || { label: status || '--', tone: 'neutral' };
}

function getQueueTypeMeta(type) {
  return QUEUE_TYPE_META[type] || { label: type || 'Thường', tone: 'neutral' };
}

function extractAppointment(data) {
  return data?.appointment || data || null;
}

function extractQueueTicket(data) {
  return data?.queue_ticket || data?.queueTicket || data || null;
}

function getCanCheckInFlag(data) {
  return Boolean(data?.can_checkin ?? data?.can_check_in);
}

function getAppointmentTimeState(item, now = new Date()) {
  const appointmentTime = new Date(item?.appointment_time).getTime();
  const currentTime = now.getTime();
  if (!Number.isFinite(appointmentTime) || !Number.isFinite(currentTime)) {
    return { key: 'unknown', label: '--', tone: 'neutral', minutes: 0 };
  }

  const diffMinutes = Math.round((appointmentTime - currentTime) / 60000);
  if (diffMinutes > 30) return { key: 'future', label: 'Sắp tới', tone: 'info', minutes: diffMinutes };
  if (diffMinutes > 0) return { key: 'soon', label: 'Sắp đến', tone: 'teal', minutes: diffMinutes };
  const lateMinutes = Math.abs(diffMinutes);
  if (lateMinutes > 60) return { key: 'very_late', label: `Trễ ${formatMinutes(lateMinutes)}`, tone: 'danger', minutes: lateMinutes };
  if (lateMinutes > 15) return { key: 'late', label: `Trễ ${lateMinutes} phút`, tone: 'warning', minutes: lateMinutes };
  return { key: 'due', label: 'Đến giờ', tone: 'success', minutes: lateMinutes };
}

function getQueueWaitState(ticket) {
  const minutes = getMinutesSince(ticket?.checkin_time || ticket?.created_at);
  if (minutes > 60) return { label: 'Cảnh báo', tone: 'danger', minutes };
  if (minutes >= 30) return { label: 'Chờ lâu', tone: 'warning', minutes };
  if (minutes >= 10) return { label: 'Đang chờ', tone: 'info', minutes };
  return { label: 'Bình thường', tone: 'success', minutes };
}

function getCombinedQueueBadge(appointment = {}, ticket = {}) {
  if (appointment.status === 'completed' || ticket.status === 'completed') {
    return { label: 'Hoàn tất', tone: 'success' };
  }
  if (appointment.status === 'in_consultation' || ticket.status === 'in_service') {
    return { label: 'Đang khám', tone: 'success' };
  }
  if (['called', 'recalled'].includes(ticket.status)) {
    return { label: 'Đã gọi', tone: 'teal' };
  }
  if (ticket.status === 'waiting' || appointment.status === 'checked_in') {
    return { label: 'Đang chờ gọi', tone: 'info' };
  }
  return getStatusMeta(ticket.status || appointment.status, ticket.status ? 'queue' : 'appointment');
}

function StatusBadge({ status, category = 'appointment', children }) {
  const meta = getStatusMeta(status, category);
  return (
    <span className={`reception-status-badge is-${meta.tone}`}>
      {children || meta.label}
    </span>
  );
}

function ToneBadge({ tone = 'neutral', children }) {
  return (
    <span className={`reception-status-badge is-${tone}`}>
      {children}
    </span>
  );
}

function InlineError({ message }) {
  if (!message) return null;
  return (
    <div className="reception-appointment-alert is-danger">
      <AlertCircle size={17} />
      <span>{message}</span>
    </div>
  );
}

function InlineSuccess({ message }) {
  if (!message) return null;
  return (
    <div className="reception-appointment-alert is-success">
      <CheckCircle2 size={17} />
      <span>{message}</span>
    </div>
  );
}

function LoadingBlock({ label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="reception-appointment-loading">
      <Loader2 size={20} />
      <span>{label}</span>
    </div>
  );
}

function ModuleHero({ title, subtitle, eyebrow, icon: Icon = CalendarDays, actions }) {
  return (
    <div className="reception-appointment-hero">
      <div>
        <span className="reception-appointment-eyebrow">
          <Icon size={16} />
          {eyebrow}
        </span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="reception-panel__actions">{actions}</div> : null}
    </div>
  );
}

function SummaryCard({ label, value, tone = 'neutral' }) {
  return (
    <article className={`reception-flow-stat is-${tone}`}>
      <span>{label}</span>
      <strong>{formatInteger(value)}</strong>
    </article>
  );
}

function useReceptionRefs() {
  const [refs, setRefs] = useState({ departments: [], doctors: [] });

  useEffect(() => {
    let mounted = true;

    async function loadRefs() {
      const [departmentsResult, doctorsResult] = await Promise.allSettled([
        receptionQueueApi.listDepartments({ limit: 100 }),
        receptionQueueApi.listDoctors({ limit: 100 }),
      ]);

      if (!mounted) return;
      setRefs({
        departments: departmentsResult.status === 'fulfilled'
          ? safeArray(departmentsResult.value?.items).map((item) => ({
              department_id: item?.department_id || item?.id || item?._id || '',
              department_name: item?.department_name || item?.name || 'Khoa/phòng',
            }))
          : [],
        doctors: doctorsResult.status === 'fulfilled'
          ? safeArray(doctorsResult.value?.items).map((item) => ({
              user_id: item?.user_id || item?.doctor_id || item?.id || item?._id || '',
              full_name: item?.full_name || item?.doctor_name || item?.name || 'Bác sĩ',
              department_id: item?.department_id || '',
              department_name: item?.department_name || '',
            }))
          : [],
      });
    }

    loadRefs();
    return () => {
      mounted = false;
    };
  }, []);

  return refs;
}

async function enrichQueueTickets(items = [], max = 80) {
  const source = safeArray(items).slice(0, max);
  const details = await Promise.allSettled(
    source.map((item) => receptionQueueApi.getQueueTicket(getQueueTicketId(item))),
  );

  return source.map((item, index) => {
    const detail = details[index].status === 'fulfilled'
      ? extractQueueTicket(details[index].value)
      : null;
    return detail ? { ...item, ...detail } : item;
  });
}

async function loadQueueTickets(params = {}, statuses = []) {
  if (statuses.length <= 1) {
    const data = await receptionQueueApi.listQueue({
      limit: 100,
      ...params,
      status: statuses[0] || params.status,
    });
    return enrichQueueTickets(safeArray(data?.items));
  }

  const results = await Promise.allSettled(
    statuses.map((status) => receptionQueueApi.listQueue({ limit: 100, ...params, status })),
  );
  const merged = results.flatMap((result) => (
    result.status === 'fulfilled' ? safeArray(result.value?.items) : []
  ));
  return enrichQueueTickets(merged);
}

async function ensureQueueAfterCheckIn(appointmentId, checkInData) {
  const detail = checkInData?.appointment ? checkInData : await receptionQueueApi.getAppointmentDetail(appointmentId);
  if (detail?.queue_ticket) return detail;

  await receptionQueueApi.createQueueFromAppointment(appointmentId).catch(() => null);
  return receptionQueueApi.getAppointmentDetail(appointmentId);
}

export function ReceptionCheckInQueuePanel({ mode = 'checkin-quick', onNavigate }) {
  const checkinMode = mode.startsWith('checkin-') ? mode.replace('checkin-', '') : null;
  const queueMode = mode.startsWith('queue-') ? mode.replace('queue-', '') : null;

  if (checkinMode === 'quick') return <QuickCheckInPanel onNavigate={onNavigate} />;
  if (checkinMode === 'waiting') return <WaitingCheckInPanel onNavigate={onNavigate} />;
  if (checkinMode === 'done') return <CheckedInPanel onNavigate={onNavigate} />;
  if (checkinMode === 'print') return <ReceiptPrintPanel onNavigate={onNavigate} />;

  if (queueMode === 'board') return <QueueBoardPanel onNavigate={onNavigate} />;
  if (queueMode === 'call') return <QueueCallNextPanel onNavigate={onNavigate} />;
  if (queueMode === 'transfer') return <QueueTransferPanel onNavigate={onNavigate} />;
  if (queueMode) return <QueueStatusPanel mode={queueMode} onNavigate={onNavigate} />;

  return null;
}

function QuickCheckInPanel({ onNavigate }) {
  const config = CHECKIN_MODES.quick;
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: false, error: '', items: [] });
  const [capabilities, setCapabilities] = useState({});
  const [busyId, setBusyId] = useState('');
  const [success, setSuccess] = useState(null);

  async function hydrateCapabilities(items) {
    const results = await Promise.allSettled(
      safeArray(items).map((item) => receptionQueueApi.getCanCheckIn(getAppointmentId(item))),
    );
    const next = {};
    safeArray(items).forEach((item, index) => {
      const appointmentId = getAppointmentId(item);
      const result = results[index];
      next[appointmentId] = result.status === 'fulfilled'
        ? result.value
        : { can_checkin: false, reasons: [getErrorMessage(result.reason, 'Không kiểm tra được quyền check-in.')] };
    });
    setCapabilities(next);
  }

  async function searchAppointments(event) {
    event?.preventDefault?.();
    const keyword = query.trim();
    if (!keyword) {
      setState({ loading: false, error: 'Vui lòng nhập SĐT, mã lịch, tên bệnh nhân hoặc CCCD.', items: [] });
      return;
    }

    setState({ loading: true, error: '', items: [] });
    setCapabilities({});
    try {
      const data = await receptionQueueApi.searchAppointments({
        q: keyword,
        date: todayKey(),
        limit: 20,
      });
      const items = safeArray(data?.items);
      setState({
        loading: false,
        error: items.length ? '' : 'Không tìm thấy lịch hôm nay phù hợp.',
        items,
      });
      hydrateCapabilities(items);
    } catch (error) {
      setState({
        loading: false,
        error: getErrorMessage(error, 'Không tìm được lịch hẹn hôm nay.'),
        items: [],
      });
    }
  }

  async function runCheckIn(item) {
    const appointmentId = getAppointmentId(item);
    if (!appointmentId) return;
    setBusyId(appointmentId);
    try {
      const canCheckIn = capabilities[appointmentId] || await receptionQueueApi.getCanCheckIn(appointmentId);
      if (!getCanCheckInFlag(canCheckIn)) {
        throw new Error(safeArray(canCheckIn?.reasons)[0] || 'Lịch hẹn chưa đủ điều kiện check-in.');
      }
      const checkedIn = await receptionQueueApi.checkInAppointment(appointmentId);
      const detail = await ensureQueueAfterCheckIn(appointmentId, checkedIn);
      setSuccess({
        appointment: extractAppointment(detail),
        queueTicket: detail?.queue_ticket,
      });
      setState((current) => ({
        ...current,
        items: current.items.map((row) => (
          getAppointmentId(row) === appointmentId
            ? { ...row, status: 'checked_in', checked_in_at: new Date().toISOString() }
            : row
        )),
      }));
      setCapabilities({});
    } catch (error) {
      window.alert(getErrorMessage(error, 'Check-in thất bại.'));
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="reception-appointment-module">
      <ModuleHero
        title={config.title}
        subtitle={config.subtitle}
        eyebrow="Check-in workflow"
        icon={CheckCircle2}
      />

      <form className="reception-flow-searchbar" onSubmit={searchAppointments}>
        <label className="reception-appointment-search">
          <Search size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nhập SĐT / mã lịch / tên bệnh nhân / CCCD"
          />
        </label>
        <button type="submit" className="reception-btn reception-btn--primary" disabled={state.loading}>
          {state.loading ? <Loader2 size={16} /> : <Search size={16} />}
          <span>Tìm kiếm</span>
        </button>
      </form>

      <InlineError message={state.error} />

      <article className="reception-panel">
        <header className="reception-panel__header reception-panel__header--compact">
          <div>
            <h2>Kết quả tìm kiếm</h2>
            <p>{state.items.length > 1 ? 'Bệnh nhân có nhiều lịch hôm nay, hãy chọn đúng giờ/khoa trước khi check-in.' : 'Card lịch hôm nay sẵn sàng để tiếp nhận.'}</p>
          </div>
        </header>
        {state.loading ? <LoadingBlock label="Đang tìm lịch hẹn hôm nay..." /> : null}
        {!state.loading && !state.items.length ? (
          <div className="reception-empty-panel">Không có kết quả để hiển thị.</div>
        ) : null}
        <div className="reception-flow-card-grid">
          {state.items.map((item) => {
            const appointmentId = getAppointmentId(item);
            const capability = capabilities[appointmentId];
            const canCheckIn = capability ? getCanCheckInFlag(capability) : false;
            const reason = safeArray(capability?.reasons)[0];
            return (
              <AppointmentResultCard
                key={appointmentId}
                item={item}
                capability={capability}
                busy={busyId === appointmentId}
                canCheckIn={canCheckIn}
                reason={reason}
                onCheckIn={() => runCheckIn(item)}
                onDetail={() => onNavigate?.('appointments-today')}
                onReschedule={() => onNavigate?.('appointments-reschedule')}
              />
            );
          })}
        </div>
      </article>

      <CheckInSuccessModal
        data={success}
        onClose={() => setSuccess(null)}
        onPrint={() => {
          setSuccess(null);
          onNavigate?.('checkin-print');
        }}
        onQueue={() => {
          setSuccess(null);
          onNavigate?.('queue-board');
        }}
        onNext={() => {
          setSuccess(null);
          setQuery('');
          setState({ loading: false, error: '', items: [] });
        }}
      />
    </section>
  );
}

function AppointmentResultCard({
  item,
  capability,
  busy,
  canCheckIn,
  reason,
  onCheckIn,
  onDetail,
  onReschedule,
}) {
  const statusWarning = getAppointmentWarning(item, reason);
  return (
    <article className="reception-flow-card">
      <div className="reception-flow-card__header">
        <div>
          <strong>{item.patient_name || 'Bệnh nhân'}</strong>
          <span>SĐT: {item.patient_phone || '--'}</span>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="reception-flow-card__meta">
        <div><span>Mã lịch</span><strong>{getAppointmentId(item).slice(-10).toUpperCase() || '--'}</strong></div>
        <div><span>Giờ hẹn</span><strong>{formatTime(item.appointment_time)}</strong></div>
        <div><span>Khoa</span><strong>{item.department_name || '--'}</strong></div>
        <div><span>Bác sĩ</span><strong>{item.doctor_name || '--'}</strong></div>
      </div>
      {statusWarning ? (
        <div className={`reception-flow-warning is-${statusWarning.tone}`}>
          <AlertCircle size={15} />
          <span>{statusWarning.label}</span>
        </div>
      ) : null}
      <div className="reception-flow-card__actions">
        <button
          type="button"
          className="reception-btn reception-btn--primary"
          disabled={busy || !capability || !canCheckIn}
          title={reason || ''}
          onClick={onCheckIn}
        >
          {busy ? <Loader2 size={16} /> : <CheckCircle2 size={16} />}
          <span>Check-in</span>
        </button>
        <button type="button" className="reception-btn reception-btn--ghost" onClick={onDetail}>
          <Eye size={16} />
          <span>Xem chi tiết</span>
        </button>
        <button type="button" className="reception-btn reception-btn--ghost" onClick={onReschedule}>
          <RotateCcw size={16} />
          <span>Dời lịch</span>
        </button>
      </div>
    </article>
  );
}

function getAppointmentWarning(item, fallbackReason) {
  if (item.status === 'cancelled') return { label: 'Lịch đã hủy', tone: 'danger' };
  if (item.status === 'checked_in') return { label: 'Lịch đã check-in', tone: 'info' };
  if (item.status === 'booked') return { label: 'Lịch chưa được xác nhận; backend sẽ xác nhận khi check-in nếu hợp lệ.', tone: 'warning' };
  if (item.status === 'no_show') return { label: 'Lịch đã no-show', tone: 'danger' };
  if (fallbackReason) return { label: fallbackReason, tone: 'warning' };
  return null;
}

function CheckInSuccessModal({ data, onClose, onPrint, onQueue, onNext }) {
  if (!data) return null;
  const appointment = data.appointment || {};
  const queueTicket = data.queueTicket || {};

  return (
    <div className="reception-modal-backdrop" role="presentation">
      <section className="reception-modal" role="dialog" aria-modal="true" aria-label="Check-in thành công">
        <header className="reception-modal__header">
          <div>
            <span className="reception-modal__eyebrow">Check-in thành công</span>
            <h3>{appointment.patient_name || 'Bệnh nhân'}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng">
            <XCircle size={20} />
          </button>
        </header>
        <div className="reception-preview-grid">
          <div><span>Bệnh nhân</span><strong>{appointment.patient_name || '--'}</strong></div>
          <div><span>Khoa</span><strong>{appointment.department_name || '--'}</strong></div>
          <div><span>Bác sĩ</span><strong>{appointment.doctor_name || '--'}</strong></div>
          <div><span>Số thứ tự</span><strong>{queueTicket.queue_number || '--'}</strong></div>
          <div><span>Trạng thái queue</span><strong>{getStatusMeta(queueTicket.status, 'queue').label}</strong></div>
          <div><span>Giờ check-in</span><strong>{formatDateTime(queueTicket.checkin_time || appointment.checked_in_at)}</strong></div>
        </div>
        <footer className="reception-modal__actions">
          <button type="button" className="reception-btn reception-btn--primary" onClick={onPrint}>
            <Printer size={16} />
            <span>In phiếu tiếp nhận</span>
          </button>
          <button type="button" className="reception-btn reception-btn--ghost" onClick={onQueue}>
            <Users size={16} />
            <span>Xem hàng đợi</span>
          </button>
          <button type="button" className="reception-btn reception-btn--ghost" onClick={onNext}>
            <Search size={16} />
            <span>Check-in bệnh nhân khác</span>
          </button>
        </footer>
      </section>
    </div>
  );
}

function WaitingCheckInPanel({ onNavigate }) {
  const config = CHECKIN_MODES.waiting;
  const refs = useReceptionRefs();
  const [filters, setFilters] = useState({ department_id: '', doctor_id: '' });
  const [tab, setTab] = useState('all');
  const [state, setState] = useState({ loading: true, error: '', items: [], summary: null });
  const [busyId, setBusyId] = useState('');
  const [success, setSuccess] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const params = {
          limit: 150,
          department_id: filters.department_id,
          doctor_id: filters.doctor_id,
        };
        const [todayData, summaryData] = await Promise.all([
          receptionQueueApi.getTodayAppointments(params),
          receptionQueueApi.getAppointmentSummary({ date: todayKey(), ...filters }).catch(() => null),
        ]);
        if (!mounted) return;
        setState({
          loading: false,
          error: '',
          items: safeArray(todayData?.items).filter((item) => ['booked', 'confirmed'].includes(item.status)),
          summary: summaryData,
        });
      } catch (error) {
        if (!mounted) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: getErrorMessage(error, 'Không tải được danh sách chờ check-in.'),
        }));
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [filters.department_id, filters.doctor_id, refreshToken]);

  const visibleItems = useMemo(() => {
    return state.items.filter((item) => {
      const timeState = getAppointmentTimeState(item);
      if (tab === 'all') return true;
      if (tab === 'late') return ['late', 'very_late'].includes(timeState.key);
      if (tab === 'soon') return ['future', 'soon', 'due'].includes(timeState.key);
      return item.status === tab;
    });
  }, [state.items, tab]);

  const stats = useMemo(() => {
    const confirmed = state.items.filter((item) => item.status === 'confirmed').length;
    const booked = state.items.filter((item) => item.status === 'booked').length;
    const late = state.items.filter((item) => ['late', 'very_late'].includes(getAppointmentTimeState(item).key)).length;
    const soon = state.items.filter((item) => ['future', 'soon', 'due'].includes(getAppointmentTimeState(item).key)).length;
    return { total: state.items.length, confirmed, booked, late, soon };
  }, [state.items]);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'department_id' ? { doctor_id: '' } : {}),
    }));
  }

  async function runAppointmentAction(type, item) {
    const appointmentId = getAppointmentId(item);
    if (!appointmentId) return;
    setBusyId(`${type}:${appointmentId}`);
    try {
      if (type === 'confirm') {
        await receptionQueueApi.confirmAppointment(appointmentId);
      }
      if (type === 'checkin') {
        const canCheckIn = await receptionQueueApi.getCanCheckIn(appointmentId);
        if (!getCanCheckInFlag(canCheckIn)) {
          throw new Error(safeArray(canCheckIn?.reasons)[0] || 'Lịch hẹn chưa đủ điều kiện check-in.');
        }
        const checkedIn = await receptionQueueApi.checkInAppointment(appointmentId);
        const detail = await ensureQueueAfterCheckIn(appointmentId, checkedIn);
        setSuccess({
          appointment: extractAppointment(detail),
          queueTicket: detail?.queue_ticket,
        });
      }
      if (type === 'cancel') {
        const reason = window.prompt('Nhập lý do hủy lịch hẹn:');
        if (reason === null) return;
        await receptionQueueApi.cancelAppointment(appointmentId, {
          reason: reason.trim() || 'Hủy từ danh sách chờ check-in.',
        });
      }
      if (type === 'reschedule') {
        const nextTime = window.prompt('Nhập thời gian mới theo định dạng YYYY-MM-DD HH:mm');
        if (!nextTime) return;
        const normalized = new Date(nextTime.replace(' ', 'T'));
        if (Number.isNaN(normalized.getTime())) throw new Error('Thời gian mới không hợp lệ.');
        await receptionQueueApi.rescheduleAppointment(appointmentId, {
          appointment_time: normalized.toISOString(),
          reason: 'Dời lịch từ màn chờ check-in.',
        });
      }
      setRefreshToken((current) => current + 1);
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="reception-appointment-module">
      <ModuleHero
        title={config.title}
        subtitle={config.subtitle}
        eyebrow="Check-in workflow"
        icon={Clock3}
        actions={(
          <>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setRefreshToken((current) => current + 1)}>
              <RefreshCw size={16} />
              <span>Làm mới</span>
            </button>
            <button type="button" className="reception-btn reception-btn--primary" onClick={() => onNavigate?.('checkin-quick')}>
              <CheckCircle2 size={16} />
              <span>Check-in nhanh</span>
            </button>
          </>
        )}
      />

      <div className="reception-flow-stats">
        <SummaryCard label="Tổng chờ check-in" value={stats.total} tone="info" />
        <SummaryCard label="Đã xác nhận" value={stats.confirmed} tone="success" />
        <SummaryCard label="Chưa xác nhận" value={stats.booked} tone="warning" />
        <SummaryCard label="Đã trễ" value={stats.late} tone="danger" />
        <SummaryCard label="Sắp đến" value={stats.soon} tone="teal" />
      </div>

      <div className="reception-appointment-toolbar reception-appointment-toolbar--compact">
        <div className="reception-filter-grid reception-filter-grid--wide">
          <select value={filters.department_id} onChange={(event) => updateFilter('department_id', event.target.value)}>
            <option value="">Tất cả khoa</option>
            {refs.departments.map((department) => (
              <option key={department.department_id} value={department.department_id}>{department.department_name}</option>
            ))}
          </select>
          <select value={filters.doctor_id} onChange={(event) => updateFilter('doctor_id', event.target.value)}>
            <option value="">Tất cả bác sĩ</option>
            {refs.doctors
              .filter((doctor) => !filters.department_id || doctor.department_id === filters.department_id)
              .map((doctor) => (
                <option key={doctor.user_id} value={doctor.user_id}>{doctor.full_name}</option>
              ))}
          </select>
        </div>
      </div>

      <div className="reception-appointment-tabs">
        {WAITING_TABS.map((item) => (
          <button key={item.key} type="button" className={tab === item.key ? 'is-active' : ''} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      <InlineError message={state.error} />

      <article className="reception-panel">
        <header className="reception-panel__header reception-panel__header--compact">
          <div>
            <h2>Lịch hôm nay chưa check-in</h2>
            <p>{formatInteger(visibleItems.length)} lịch theo bộ lọc hiện tại.</p>
          </div>
        </header>
        {state.loading ? <LoadingBlock /> : (
          <div className="reception-data-table-wrap">
            <table className="reception-data-table reception-flow-table">
              <thead>
                <tr>
                  <th>Giờ hẹn</th>
                  <th>Bệnh nhân</th>
                  <th>SĐT</th>
                  <th>Bác sĩ</th>
                  <th>Khoa</th>
                  <th>Trạng thái lịch</th>
                  <th>Tình trạng thời gian</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                  const appointmentId = getAppointmentId(item);
                  const timeState = getAppointmentTimeState(item);
                  return (
                    <tr key={appointmentId}>
                      <td><strong>{formatTime(item.appointment_time)}</strong><span>{formatDate(item.appointment_time)}</span></td>
                      <td>{item.patient_name || '--'}</td>
                      <td>
                        {item.patient_phone ? (
                          <a className="reception-phone-cell" href={`tel:${item.patient_phone}`}>
                            <Phone size={14} />
                            {item.patient_phone}
                          </a>
                        ) : '--'}
                      </td>
                      <td>{item.doctor_name || '--'}</td>
                      <td>{item.department_name || '--'}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td><ToneBadge tone={timeState.tone}>{timeState.label}</ToneBadge></td>
                      <td>
                        <div className="reception-row-actions">
                          {item.status === 'confirmed' ? (
                            <button type="button" className="reception-btn reception-btn--primary" disabled={busyId === `checkin:${appointmentId}`} onClick={() => runAppointmentAction('checkin', item)}>
                              {busyId === `checkin:${appointmentId}` ? <Loader2 size={15} /> : <CheckCircle2 size={15} />}
                              <span>Check-in</span>
                            </button>
                          ) : (
                            <button type="button" className="reception-btn reception-btn--ghost" disabled={busyId === `confirm:${appointmentId}`} onClick={() => runAppointmentAction('confirm', item)}>
                              <CheckCircle2 size={15} />
                              <span>Xác nhận</span>
                            </button>
                          )}
                          {item.patient_phone ? (
                            <a className="reception-btn reception-btn--ghost" href={`tel:${item.patient_phone}`}>
                              <Phone size={15} />
                              <span>Gọi</span>
                            </a>
                          ) : null}
                          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => runAppointmentAction('reschedule', item)}>
                            <RotateCcw size={15} />
                            <span>Dời</span>
                          </button>
                          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => runAppointmentAction('cancel', item)}>
                            <XCircle size={15} />
                            <span>Hủy</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!state.loading && !visibleItems.length ? (
          <div className="reception-empty-panel">Không có lịch nào đang chờ check-in.</div>
        ) : null}
      </article>

      <CheckInSuccessModal
        data={success}
        onClose={() => setSuccess(null)}
        onPrint={() => {
          setSuccess(null);
          onNavigate?.('checkin-print');
        }}
        onQueue={() => {
          setSuccess(null);
          onNavigate?.('queue-board');
        }}
        onNext={() => {
          setSuccess(null);
          onNavigate?.('checkin-quick');
        }}
      />
    </section>
  );
}

function CheckedInPanel({ onNavigate }) {
  const config = CHECKIN_MODES.done;
  const [state, setState] = useState({ loading: true, error: '', appointments: [], tickets: [], summary: null });
  const [timeline, setTimeline] = useState({ loading: false, error: '', ticket: null, items: [] });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const [appointmentsData, queueSummary, queueData] = await Promise.all([
          receptionQueueApi.getTodayAppointments({ limit: 200 }),
          receptionQueueApi.getQueueSummaryToday(),
          receptionQueueApi.listQueue({ limit: 200 }),
        ]);
        const tickets = await enrichQueueTickets(safeArray(queueData?.items));
        if (!mounted) return;
        setState({
          loading: false,
          error: '',
          appointments: safeArray(appointmentsData?.items).filter((item) => ['checked_in', 'in_consultation', 'completed'].includes(item.status)),
          tickets,
          summary: queueSummary,
        });
      } catch (error) {
        if (!mounted) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: getErrorMessage(error, 'Không tải được danh sách đã check-in.'),
        }));
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  const rows = useMemo(() => {
    const queueByAppointment = new Map(
      state.tickets
        .filter((ticket) => ticket.appointment_id)
        .map((ticket) => [String(ticket.appointment_id), ticket]),
    );
    return state.appointments.map((appointment) => ({
      appointment,
      ticket: queueByAppointment.get(getAppointmentId(appointment)) || {},
    }));
  }, [state.appointments, state.tickets]);

  async function openTimeline(ticket) {
    const ticketId = getQueueTicketId(ticket);
    if (!ticketId) return;
    setTimeline({ loading: true, error: '', ticket, items: [] });
    try {
      const data = await receptionQueueApi.getQueueTimeline(ticketId, { limit: 80 });
      setTimeline({
        loading: false,
        error: '',
        ticket,
        items: safeArray(data?.items),
      });
    } catch (error) {
      setTimeline({
        loading: false,
        error: getErrorMessage(error, 'Không tải được timeline queue.'),
        ticket,
        items: [],
      });
    }
  }

  return (
    <section className="reception-appointment-module">
      <ModuleHero
        title={config.title}
        subtitle={config.subtitle}
        eyebrow="Check-in workflow"
        icon={Users}
        actions={(
          <>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setRefreshToken((current) => current + 1)}>
              <RefreshCw size={16} />
              <span>Làm mới</span>
            </button>
            <button type="button" className="reception-btn reception-btn--primary" onClick={() => onNavigate?.('queue-board')}>
              <Users size={16} />
              <span>Chuyển sang bảng hàng đợi</span>
            </button>
          </>
        )}
      />

      <div className="reception-flow-stats">
        <SummaryCard label="Tổng đã check-in" value={rows.length} tone="info" />
        <SummaryCard label="Đang chờ queue" value={state.summary?.waiting} tone="warning" />
        <SummaryCard label="Đã gọi" value={state.summary?.called} tone="teal" />
        <SummaryCard label="Đang phục vụ" value={state.summary?.in_service} tone="success" />
        <SummaryCard label="Đã hoàn tất" value={state.summary?.completed} tone="success" />
      </div>

      <InlineError message={state.error} />

      <article className="reception-panel">
        <header className="reception-panel__header reception-panel__header--compact">
          <div>
            <h2>Bệnh nhân đã qua quầy tiếp nhận</h2>
            <p>{formatInteger(rows.length)} lượt check-in trong ngày.</p>
          </div>
        </header>
        {state.loading ? <LoadingBlock /> : (
          <div className="reception-data-table-wrap">
            <table className="reception-data-table reception-flow-table">
              <thead>
                <tr>
                  <th>Giờ check-in</th>
                  <th>Số thứ tự</th>
                  <th>Bệnh nhân</th>
                  <th>Khoa</th>
                  <th>Bác sĩ</th>
                  <th>Queue status</th>
                  <th>Encounter status</th>
                  <th>Thời gian chờ</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ appointment, ticket }) => {
                  const badge = getCombinedQueueBadge(appointment, ticket);
                  return (
                    <tr key={getAppointmentId(appointment)}>
                      <td>{formatDateTime(ticket.checkin_time || appointment.checked_in_at)}</td>
                      <td><strong>{ticket.queue_number || '--'}</strong></td>
                      <td>{appointment.patient_name || ticket.patient_name || '--'}</td>
                      <td>{appointment.department_name || ticket.department_name || '--'}</td>
                      <td>{appointment.doctor_name || ticket.doctor_name || '--'}</td>
                      <td><StatusBadge status={ticket.status} category="queue" /></td>
                      <td><ToneBadge tone={badge.tone}>{badge.label}</ToneBadge></td>
                      <td>{ticket.checkin_time ? formatMinutes(getMinutesSince(ticket.checkin_time)) : '--'}</td>
                      <td>
                        <div className="reception-row-actions">
                          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => openTimeline(ticket)} disabled={!getQueueTicketId(ticket)}>
                            <Timer size={15} />
                            <span>Timeline</span>
                          </button>
                          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => window.print()}>
                            <Printer size={15} />
                            <span>In lại</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!state.loading && !rows.length ? (
          <div className="reception-empty-panel">Chưa có bệnh nhân đã check-in trong ngày.</div>
        ) : null}
      </article>

      <QueueTimelineDrawer state={timeline} onClose={() => setTimeline({ loading: false, error: '', ticket: null, items: [] })} />
    </section>
  );
}

function ReceiptPrintPanel() {
  const config = CHECKIN_MODES.print;
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: false, error: '', appointments: [], tickets: [] });
  const [receipt, setReceipt] = useState(null);

  async function runSearch(event) {
    event?.preventDefault?.();
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      setState({ loading: false, error: 'Vui lòng nhập mã lịch, số thứ tự, tên bệnh nhân hoặc SĐT.', appointments: [], tickets: [] });
      return;
    }

    setState({ loading: true, error: '', appointments: [], tickets: [] });
    try {
      const [appointmentData, queueData] = await Promise.all([
        receptionQueueApi.searchAppointments({ q: query.trim(), date: todayKey(), limit: 20 }).catch(() => null),
        receptionQueueApi.listQueue({ limit: 200 }).catch(() => null),
      ]);
      const tickets = await enrichQueueTickets(
        safeArray(queueData?.items).filter((ticket) => {
          const haystack = [
            ticket.queue_number,
            ticket.patient_name,
            ticket.patient_phone,
            ticket.patient_code,
          ].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(keyword);
        }),
      );
      const appointments = safeArray(appointmentData?.items);
      setState({
        loading: false,
        error: appointments.length || tickets.length ? '' : 'Không tìm thấy phiếu tiếp nhận phù hợp.',
        appointments,
        tickets,
      });
    } catch (error) {
      setState({
        loading: false,
        error: getErrorMessage(error, 'Không tìm được dữ liệu phiếu.'),
        appointments: [],
        tickets: [],
      });
    }
  }

  async function selectAppointment(item) {
    const appointmentId = getAppointmentId(item);
    if (!appointmentId) return;
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const detail = await receptionQueueApi.getAppointmentDetail(appointmentId);
      let ticket = detail?.queue_ticket || null;
      if (ticket?.queue_ticket_id) {
        const ticketDetail = await receptionQueueApi.getQueueTicket(ticket.queue_ticket_id).catch(() => null);
        ticket = { ...ticket, ...extractQueueTicket(ticketDetail) };
      }
      setReceipt({ appointment: extractAppointment(detail), ticket });
    } catch (error) {
      window.alert(getErrorMessage(error, 'Không tải được chi tiết phiếu.'));
    } finally {
      setState((current) => ({ ...current, loading: false }));
    }
  }

  async function selectTicket(item) {
    const ticketId = getQueueTicketId(item);
    if (!ticketId) return;
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const ticketDetail = await receptionQueueApi.getQueueTicket(ticketId);
      const ticket = extractQueueTicket(ticketDetail);
      let appointment = null;
      if (ticket?.appointment_id) {
        const appointmentDetail = await receptionQueueApi.getAppointmentDetail(ticket.appointment_id).catch(() => null);
        appointment = extractAppointment(appointmentDetail);
      }
      setReceipt({ appointment, ticket });
    } catch (error) {
      window.alert(getErrorMessage(error, 'Không tải được queue ticket.'));
    } finally {
      setState((current) => ({ ...current, loading: false }));
    }
  }

  return (
    <section className="reception-appointment-module">
      <ModuleHero
        title={config.title}
        subtitle={config.subtitle}
        eyebrow="Check-in workflow"
        icon={Printer}
      />

      <form className="reception-flow-searchbar" onSubmit={runSearch}>
        <label className="reception-appointment-search">
          <Search size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Mã lịch / số thứ tự / tên bệnh nhân / SĐT"
          />
        </label>
        <button type="submit" className="reception-btn reception-btn--primary" disabled={state.loading}>
          {state.loading ? <Loader2 size={16} /> : <Search size={16} />}
          <span>Tìm kiếm</span>
        </button>
      </form>

      <InlineError message={state.error} />

      <div className="reception-print-layout">
        <article className="reception-panel">
          <header className="reception-panel__header reception-panel__header--compact">
            <div>
              <h2>Kết quả tìm kiếm</h2>
              <p>Chọn lịch hoặc queue ticket để xem preview phiếu.</p>
            </div>
          </header>
          {state.loading ? <LoadingBlock /> : null}
          <div className="reception-receipt-results">
            {state.appointments.map((item) => (
              <button key={getAppointmentId(item)} type="button" onClick={() => selectAppointment(item)}>
                <CalendarDays size={18} />
                <span>
                  <strong>{item.patient_name || 'Bệnh nhân'}</strong>
                  <small>{getAppointmentId(item).slice(-10).toUpperCase()} · {formatTime(item.appointment_time)} · {item.department_name || '--'}</small>
                </span>
              </button>
            ))}
            {state.tickets.map((item) => (
              <button key={getQueueTicketId(item)} type="button" onClick={() => selectTicket(item)}>
                <FileText size={18} />
                <span>
                  <strong>{item.queue_number || '--'} · {item.patient_name || 'Bệnh nhân'}</strong>
                  <small>{item.department_name || '--'} · {getStatusMeta(item.status, 'queue').label}</small>
                </span>
              </button>
            ))}
            {!state.loading && !state.appointments.length && !state.tickets.length ? (
              <div className="reception-empty-panel reception-empty-panel--compact">Chưa có kết quả.</div>
            ) : null}
          </div>
        </article>

        <article className="reception-panel reception-print-panel">
          <header className="reception-panel__header reception-panel__header--compact">
            <div>
              <h2>Preview phiếu</h2>
              <p>Phiếu tiếp nhận để bệnh nhân cầm đến phòng khám/quầy.</p>
            </div>
          </header>
          <ReceiptPreview receipt={receipt} />
          <div className="reception-print-actions">
            <button type="button" className="reception-btn reception-btn--primary" disabled={!receipt} onClick={() => window.print()}>
              <Printer size={16} />
              <span>In phiếu</span>
            </button>
            <button type="button" className="reception-btn reception-btn--ghost" disabled={!receipt} onClick={() => window.print()}>
              <Download size={16} />
              <span>Tải PDF</span>
            </button>
            <button type="button" className="reception-btn reception-btn--ghost" disabled={!receipt} onClick={() => window.print()}>
              <RotateCcw size={16} />
              <span>In lại</span>
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

function ReceiptPreview({ receipt }) {
  if (!receipt) {
    return <div className="reception-empty-panel">Chọn lịch hoặc queue ticket để xem phiếu tiếp nhận.</div>;
  }

  const appointment = receipt.appointment || {};
  const ticket = receipt.ticket || {};
  const patientName = appointment.patient_name || ticket.patient_name || '--';
  const departmentName = appointment.department_name || ticket.department_name || '--';
  const doctorName = appointment.doctor_name || ticket.doctor_name || '--';

  return (
    <div className="reception-receipt-preview">
      <div className="reception-receipt-preview__brand">
        <strong>MEDCARE HMS</strong>
        <span>PHIẾU TIẾP NHẬN</span>
      </div>
      <div className="reception-receipt-preview__queue">
        <span>Số thứ tự</span>
        <strong>{ticket.queue_number || '--'}</strong>
      </div>
      <div className="reception-receipt-preview__grid">
        <span>Mã bệnh nhân</span><strong>{appointment.patient_code || ticket.patient_code || '--'}</strong>
        <span>Bệnh nhân</span><strong>{patientName}</strong>
        <span>Khoa / phòng</span><strong>{departmentName}</strong>
        <span>Bác sĩ</span><strong>{doctorName}</strong>
        <span>Giờ hẹn</span><strong>{formatDateTime(appointment.appointment_time)}</strong>
        <span>Giờ check-in</span><strong>{formatDateTime(ticket.checkin_time || appointment.checked_in_at)}</strong>
        <span>Ghi chú</span><strong>{appointment.reason || appointment.notes || 'Vui lòng theo dõi bảng gọi số.'}</strong>
      </div>
      <div className="reception-receipt-preview__qr">
        <span>{ticket.queue_number || getAppointmentId(appointment).slice(-8).toUpperCase() || 'QUEUE'}</span>
      </div>
    </div>
  );
}

function QueueBoardPanel({ onNavigate }) {
  const config = QUEUE_MODES.board;
  const refs = useReceptionRefs();
  const [filters, setFilters] = useState({ date: todayKey(), department_id: '', doctor_id: '', status: '' });
  const [view, setView] = useState('board');
  const [state, setState] = useState({ loading: true, error: '', items: [], summary: null, lastUpdated: null });
  const [actionBusy, setActionBusy] = useState('');
  const [priorityTicket, setPriorityTicket] = useState(null);
  const [timeline, setTimeline] = useState({ loading: false, error: '', ticket: null, items: [] });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const params = {
          date: filters.date,
          department_id: filters.department_id,
          doctor_id: filters.doctor_id,
          status: filters.status,
        };
        const [summary, items] = await Promise.all([
          receptionQueueApi.getQueueSummaryToday(params).catch(() => null),
          loadQueueTickets(params),
        ]);
        if (!mounted) return;
        setState({
          loading: false,
          error: '',
          items,
          summary,
          lastUpdated: new Date(),
        });
      } catch (error) {
        if (!mounted) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: getErrorMessage(error, 'Không tải được bảng hàng đợi.'),
        }));
      }
    }

    loadData();
    const timer = window.setInterval(loadData, 20000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [filters.date, filters.department_id, filters.doctor_id, filters.status, refreshToken]);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'department_id' ? { doctor_id: '' } : {}),
    }));
  }

  async function runQueueAction(type, ticket) {
    const ticketId = getQueueTicketId(ticket);
    if (!ticketId) return;
    setActionBusy(`${type}:${ticketId}`);
    try {
      if (type === 'call') await receptionQueueApi.callQueueTicket(ticketId);
      if (type === 'recall') await receptionQueueApi.recallQueueTicket(ticketId);
      if (type === 'skip') {
        const reason = window.prompt('Lý do bỏ qua ticket:', 'Bệnh nhân chưa có mặt khi gọi số.');
        if (reason === null) return;
        await receptionQueueApi.skipQueueTicket(ticketId, { reason });
      }
      if (type === 'start') await receptionQueueApi.startQueueService(ticketId);
      if (type === 'complete') await receptionQueueApi.completeQueueTicket(ticketId);
      if (type === 'cancel') {
        const reason = window.prompt('Lý do hủy ticket:');
        if (reason === null) return;
        await receptionQueueApi.cancelQueueTicket(ticketId, { reason: reason.trim() || 'Hủy từ bảng hàng đợi.' });
      }
      setRefreshToken((current) => current + 1);
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      setActionBusy('');
    }
  }

  async function openTimeline(ticket) {
    const ticketId = getQueueTicketId(ticket);
    if (!ticketId) return;
    setTimeline({ loading: true, error: '', ticket, items: [] });
    try {
      const data = await receptionQueueApi.getQueueTimeline(ticketId, { limit: 80 });
      setTimeline({ loading: false, error: '', ticket, items: safeArray(data?.items) });
    } catch (error) {
      setTimeline({ loading: false, error: getErrorMessage(error), ticket, items: [] });
    }
  }

  const filteredItems = useMemo(() => {
    if (!filters.status) return state.items;
    return state.items.filter((item) => item.status === filters.status);
  }, [filters.status, state.items]);

  const grouped = useMemo(() => {
    return QUEUE_BOARD_COLUMNS.reduce((acc, column) => {
      acc[column.key] = filteredItems.filter((item) => (
        column.key === 'called'
          ? ['called', 'recalled'].includes(item.status)
          : item.status === column.key
      ));
      return acc;
    }, {});
  }, [filteredItems]);

  return (
    <section className="reception-appointment-module">
      <ModuleHero
        title={config.title}
        subtitle={config.subtitle}
        eyebrow="Queue workflow"
        icon={Users}
        actions={(
          <>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setRefreshToken((current) => current + 1)}>
              <RefreshCw size={16} />
              <span>Refresh</span>
            </button>
            <button type="button" className="reception-btn reception-btn--primary" onClick={() => onNavigate?.('queue-call')}>
              <Send size={16} />
              <span>Gọi số tiếp theo</span>
            </button>
          </>
        )}
      />

      <QueueFilters refs={refs} filters={filters} onChange={updateFilter} includeStatus />

      <div className="reception-flow-stats reception-flow-stats--queue">
        <SummaryCard label="Tổng ticket" value={state.summary?.total} tone="info" />
        <SummaryCard label="Đang chờ" value={state.summary?.waiting} tone="warning" />
        <SummaryCard label="Đang gọi" value={state.summary?.called} tone="teal" />
        <SummaryCard label="Đang phục vụ" value={state.summary?.in_service} tone="success" />
        <SummaryCard label="Bỏ qua" value={state.summary?.skipped} tone="danger" />
        <SummaryCard label="Hoàn tất" value={state.summary?.completed} tone="success" />
        <SummaryCard label="Đã hủy" value={state.summary?.cancelled} tone="warning" />
      </div>

      <div className="reception-view-switch">
        {[
          { key: 'board', label: 'Board view' },
          { key: 'table', label: 'Table view' },
          { key: 'doctor', label: 'Doctor board' },
          { key: 'department', label: 'Department board' },
        ].map((item) => (
          <button key={item.key} type="button" className={view === item.key ? 'is-active' : ''} onClick={() => setView(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      <InlineError message={state.error} />
      {state.lastUpdated ? (
        <div className="reception-refresh-note">
          <RefreshCw size={14} />
          <span>Cập nhật lần cuối {formatTime(state.lastUpdated)} · tự làm mới mỗi 20 giây</span>
        </div>
      ) : null}

      {state.loading ? <LoadingBlock /> : null}
      {!state.loading && view === 'board' ? (
        <QueueKanban
          grouped={grouped}
          actionBusy={actionBusy}
          onAction={runQueueAction}
          onPriority={setPriorityTicket}
          onTimeline={openTimeline}
          onTransfer={() => onNavigate?.('queue-transfer')}
        />
      ) : null}
      {!state.loading && view === 'table' ? (
        <QueueTable
          items={filteredItems}
          actionBusy={actionBusy}
          onAction={runQueueAction}
          onPriority={setPriorityTicket}
          onTimeline={openTimeline}
          onTransfer={() => onNavigate?.('queue-transfer')}
        />
      ) : null}
      {!state.loading && ['doctor', 'department'].includes(view) ? (
        <QueueBoardPlaceholder view={view} filters={filters} />
      ) : null}

      <PriorityModal
        ticket={priorityTicket}
        onClose={() => setPriorityTicket(null)}
        onSaved={() => {
          setPriorityTicket(null);
          setRefreshToken((current) => current + 1);
        }}
      />
      <QueueTimelineDrawer state={timeline} onClose={() => setTimeline({ loading: false, error: '', ticket: null, items: [] })} />
    </section>
  );
}

function QueueFilters({ refs, filters, onChange, includeStatus = false }) {
  return (
    <div className="reception-appointment-toolbar reception-appointment-toolbar--compact">
      <div className="reception-filter-grid reception-filter-grid--wide">
        <input type="date" value={filters.date || todayKey()} onChange={(event) => onChange('date', event.target.value)} aria-label="Ngày queue" />
        <select value={filters.department_id || ''} onChange={(event) => onChange('department_id', event.target.value)}>
          <option value="">Tất cả khoa</option>
          {refs.departments.map((department) => (
            <option key={department.department_id} value={department.department_id}>{department.department_name}</option>
          ))}
        </select>
        <select value={filters.doctor_id || ''} onChange={(event) => onChange('doctor_id', event.target.value)}>
          <option value="">Tất cả bác sĩ</option>
          {refs.doctors
            .filter((doctor) => !filters.department_id || doctor.department_id === filters.department_id)
            .map((doctor) => (
              <option key={doctor.user_id} value={doctor.user_id}>{doctor.full_name}</option>
            ))}
        </select>
        {includeStatus ? (
          <select value={filters.status || ''} onChange={(event) => onChange('status', event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(QUEUE_STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>{meta.label}</option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}

function QueueKanban({ grouped, actionBusy, onAction, onPriority, onTimeline, onTransfer }) {
  return (
    <div className="reception-queue-kanban">
      {QUEUE_BOARD_COLUMNS.map((column) => (
        <section key={column.key} className="reception-queue-column">
          <header>
            <strong>{column.label}</strong>
            <span>{formatInteger(grouped[column.key]?.length || 0)}</span>
          </header>
          <div className="reception-queue-column__body">
            {safeArray(grouped[column.key]).map((ticket) => (
              <QueueTicketCard
                key={getQueueTicketId(ticket)}
                ticket={ticket}
                actionBusy={actionBusy}
                onAction={onAction}
                onPriority={onPriority}
                onTimeline={onTimeline}
                onTransfer={onTransfer}
              />
            ))}
            {!safeArray(grouped[column.key]).length ? (
              <div className="reception-empty-panel reception-empty-panel--compact">Không có ticket.</div>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

function QueueTicketCard({ ticket, actionBusy, onAction, onPriority, onTimeline, onTransfer }) {
  const waitState = getQueueWaitState(ticket);
  const ticketId = getQueueTicketId(ticket);
  return (
    <article className="reception-queue-card">
      <div className="reception-queue-card__top">
        <strong>{ticket.queue_number || '--'}</strong>
        <StatusBadge status={ticket.status} category="queue" />
      </div>
      <h3>{ticket.patient_name || 'Bệnh nhân'}</h3>
      <p>{formatTime(ticket.checkin_time)} · {ticket.department_name || 'Khoa'} · {ticket.doctor_name || 'Bác sĩ'}</p>
      <div className="reception-queue-card__meta">
        <ToneBadge tone={getQueueTypeMeta(ticket.queue_type).tone}>{getQueueTypeMeta(ticket.queue_type).label}</ToneBadge>
        <ToneBadge tone={waitState.tone}>Chờ {formatMinutes(waitState.minutes)}</ToneBadge>
      </div>
      <QueueActionRow
        ticket={ticket}
        actionBusy={actionBusy}
        compact
        onAction={onAction}
        onPriority={onPriority}
        onTimeline={onTimeline}
        onTransfer={onTransfer}
      />
      {actionBusy.endsWith(`:${ticketId}`) ? <span className="reception-row-busy">Đang xử lý...</span> : null}
    </article>
  );
}

function QueueTable({ items, actionBusy, onAction, onPriority, onTimeline, onTransfer, mode = 'board' }) {
  return (
    <article className="reception-panel">
      <header className="reception-panel__header reception-panel__header--compact">
        <div>
          <h2>Danh sách ticket</h2>
          <p>{formatInteger(items.length)} ticket theo bộ lọc.</p>
        </div>
      </header>
      <div className="reception-data-table-wrap">
        <table className="reception-data-table reception-flow-table">
          <thead>
            <tr>
              <th>Số thứ tự</th>
              <th>Bệnh nhân</th>
              <th>Giờ check-in</th>
              <th>Khoa</th>
              <th>Bác sĩ</th>
              <th>Trạng thái</th>
              <th>Độ ưu tiên</th>
              <th>Thời gian chờ</th>
              {mode === 'completed' ? <th>Tổng thời gian</th> : null}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((ticket) => {
              const waitState = getQueueWaitState(ticket);
              const totalMinutes = ticket.completed_time && ticket.checkin_time
                ? getMinutesSince(ticket.checkin_time, new Date(ticket.completed_time))
                : waitState.minutes;
              return (
                <tr key={getQueueTicketId(ticket)}>
                  <td><strong>{ticket.queue_number || '--'}</strong></td>
                  <td>{ticket.patient_name || '--'}</td>
                  <td>{formatDateTime(ticket.checkin_time)}</td>
                  <td>{ticket.department_name || '--'}</td>
                  <td>{ticket.doctor_name || '--'}</td>
                  <td><StatusBadge status={ticket.status} category="queue" /></td>
                  <td><ToneBadge tone={getQueueTypeMeta(ticket.queue_type).tone}>{getQueueTypeMeta(ticket.queue_type).label}</ToneBadge></td>
                  <td><ToneBadge tone={waitState.tone}>{formatMinutes(waitState.minutes)}</ToneBadge></td>
                  {mode === 'completed' ? <td>{formatMinutes(totalMinutes)}</td> : null}
                  <td>
                    <QueueActionRow
                      ticket={ticket}
                      actionBusy={actionBusy}
                      onAction={onAction}
                      onPriority={onPriority}
                      onTimeline={onTimeline}
                      onTransfer={onTransfer}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!items.length ? <div className="reception-empty-panel">Không có ticket phù hợp.</div> : null}
    </article>
  );
}

function QueueActionRow({ ticket, actionBusy, onAction, onPriority, onTimeline, onTransfer, compact = false }) {
  const ticketId = getQueueTicketId(ticket);
  const busy = actionBusy.endsWith(`:${ticketId}`);
  return (
    <div className={`reception-row-actions ${compact ? 'is-compact' : ''}`}>
      {ticket.status === 'waiting' ? (
        <button type="button" className="reception-btn reception-btn--primary" disabled={busy} onClick={() => onAction('call', ticket)}>
          <Send size={15} />
          <span>Gọi</span>
        </button>
      ) : null}
      {['called', 'recalled', 'skipped'].includes(ticket.status) ? (
        <button type="button" className="reception-btn reception-btn--ghost" disabled={busy} onClick={() => onAction('recall', ticket)}>
          <RotateCcw size={15} />
          <span>Gọi lại</span>
        </button>
      ) : null}
      {['called', 'recalled'].includes(ticket.status) ? (
        <button type="button" className="reception-btn reception-btn--ghost" disabled={busy} onClick={() => onAction('start', ticket)}>
          <PlayCircle size={15} />
          <span>Bắt đầu</span>
        </button>
      ) : null}
      {ticket.status === 'in_service' ? (
        <button type="button" className="reception-btn reception-btn--ghost" disabled={busy} onClick={() => onAction('complete', ticket)}>
          <CheckCircle2 size={15} />
          <span>Hoàn tất</span>
        </button>
      ) : null}
      {['waiting', 'called', 'recalled'].includes(ticket.status) ? (
        <button type="button" className="reception-btn reception-btn--ghost" disabled={busy} onClick={() => onAction('skip', ticket)}>
          <SkipForward size={15} />
          <span>Bỏ qua</span>
        </button>
      ) : null}
      {['waiting', 'skipped'].includes(ticket.status) ? (
        <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onPriority(ticket)}>
          <Filter size={15} />
          <span>Ưu tiên</span>
        </button>
      ) : null}
      {['waiting', 'called', 'recalled', 'skipped'].includes(ticket.status) ? (
        <button type="button" className="reception-btn reception-btn--ghost" onClick={onTransfer}>
          <Shuffle size={15} />
          <span>Chuyển</span>
        </button>
      ) : null}
      <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onTimeline(ticket)}>
        <Timer size={15} />
        <span>Timeline</span>
      </button>
      {!['completed', 'cancelled'].includes(ticket.status) ? (
        <button type="button" className="reception-btn reception-btn--ghost" disabled={busy} onClick={() => onAction('cancel', ticket)}>
          <XCircle size={15} />
          <span>Hủy</span>
        </button>
      ) : null}
    </div>
  );
}

function QueueBoardPlaceholder({ view, filters }) {
  const missing = view === 'doctor' ? !filters.doctor_id : !filters.department_id;
  return (
    <article className="reception-panel">
      <header className="reception-panel__header reception-panel__header--compact">
        <div>
          <h2>{view === 'doctor' ? 'Doctor board' : 'Department board'}</h2>
          <p>Endpoint chuyên sâu có sẵn trong backend; chọn đúng bác sĩ/khoa để xem bảng riêng.</p>
        </div>
      </header>
      {missing ? (
        <div className="reception-empty-panel">Vui lòng chọn {view === 'doctor' ? 'bác sĩ' : 'khoa'} trong filter phía trên.</div>
      ) : (
        <SpecializedQueueBoard view={view} filters={filters} />
      )}
    </article>
  );
}

function SpecializedQueueBoard({ view, filters }) {
  const [state, setState] = useState({ loading: true, error: '', items: [], board: null });

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setState({ loading: true, error: '', items: [], board: null });
      try {
        const data = view === 'doctor'
          ? await receptionQueueApi.getDoctorQueueBoard(filters.doctor_id, { date: filters.date })
          : await receptionQueueApi.getDepartmentQueueBoard(filters.department_id, { date: filters.date });
        if (!mounted) return;
        const items = view === 'doctor'
          ? [
              ...safeArray(data?.waiting),
              ...safeArray(data?.called),
              ...safeArray(data?.in_service),
              ...safeArray(data?.completed),
            ]
          : safeArray(data?.items);
        setState({ loading: false, error: '', items, board: data });
      } catch (error) {
        if (!mounted) return;
        setState({ loading: false, error: getErrorMessage(error), items: [], board: null });
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [view, filters.doctor_id, filters.department_id, filters.date]);

  if (state.loading) return <LoadingBlock />;
  if (state.error) return <InlineError message={state.error} />;
  return (
    <div className="reception-special-board">
      {state.items.map((item) => (
        <div key={getQueueTicketId(item)} className="reception-special-board__item">
          <strong>{item.queue_number}</strong>
          <StatusBadge status={item.status} category="queue" />
        </div>
      ))}
      {!state.items.length ? <div className="reception-empty-panel reception-empty-panel--compact">Không có ticket.</div> : null}
    </div>
  );
}

function QueueCallNextPanel() {
  const config = QUEUE_MODES.call;
  const refs = useReceptionRefs();
  const [filters, setFilters] = useState({ department_id: '', doctor_id: '' });
  const [state, setState] = useState({ loading: true, error: '', items: [], summary: null, current: null });
  const [busy, setBusy] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const params = {
          department_id: filters.department_id,
          doctor_id: filters.doctor_id,
        };
        const [summary, items] = await Promise.all([
          receptionQueueApi.getQueueSummaryToday(params).catch(() => null),
          loadQueueTickets(params),
        ]);
        const current = items
          .filter((item) => ['called', 'recalled'].includes(item.status))
          .sort((left, right) => new Date(right.called_time || 0) - new Date(left.called_time || 0))[0] || null;
        if (!mounted) return;
        setState({ loading: false, error: '', items, summary, current });
      } catch (error) {
        if (!mounted) return;
        setState((current) => ({ ...current, loading: false, error: getErrorMessage(error, 'Không tải được queue gọi số.') }));
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [filters.department_id, filters.doctor_id, refreshToken]);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'department_id' ? { doctor_id: '' } : {}),
    }));
  }

  async function callNext() {
    setBusy('call-next');
    try {
      const data = await receptionQueueApi.callNextQueue({
        department_id: filters.department_id || undefined,
        doctor_id: filters.doctor_id || undefined,
      });
      setState((current) => ({
        ...current,
        current: extractQueueTicket(data),
      }));
      setRefreshToken((current) => current + 1);
    } catch (error) {
      window.alert(getErrorMessage(error, 'Không gọi được số tiếp theo.'));
    } finally {
      setBusy('');
    }
  }

  async function actionCurrent(type) {
    const ticketId = getQueueTicketId(state.current);
    if (!ticketId) return;
    setBusy(type);
    try {
      if (type === 'recall') await receptionQueueApi.recallQueueTicket(ticketId);
      if (type === 'skip') await receptionQueueApi.skipQueueTicket(ticketId, { reason: 'Bỏ qua từ màn gọi số tiếp theo.' });
      if (type === 'start') await receptionQueueApi.startQueueService(ticketId);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      setBusy('');
    }
  }

  const waitingItems = state.items.filter((item) => item.status === 'waiting').slice(0, 8);

  return (
    <section className="reception-appointment-module">
      <ModuleHero
        title={config.title}
        subtitle={config.subtitle}
        eyebrow="Queue workflow"
        icon={Send}
        actions={(
          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setRefreshToken((current) => current + 1)}>
            <RefreshCw size={16} />
            <span>Làm mới</span>
          </button>
        )}
      />
      <QueueFilters refs={refs} filters={{ ...filters, date: todayKey() }} onChange={updateFilter} />
      <InlineError message={state.error} />

      <div className="reception-call-layout">
        <article className="reception-call-current">
          <span>Số đang gọi</span>
          <strong>{state.current?.queue_number || '--'}</strong>
          <h3>{state.current?.patient_name || 'Chưa có ticket đang gọi'}</h3>
          <p>{state.current?.department_name || 'Khoa'} · {state.current?.doctor_name || 'Bác sĩ'}</p>
          <button type="button" className="reception-call-button" disabled={busy === 'call-next'} onClick={callNext}>
            {busy === 'call-next' ? <Loader2 size={26} /> : <Send size={26} />}
            <span>Gọi số tiếp theo</span>
          </button>
          <div className="reception-call-current__actions">
            <button type="button" className="reception-btn reception-btn--ghost" disabled={!state.current || busy === 'recall'} onClick={() => actionCurrent('recall')}>
              <RotateCcw size={16} />
              <span>Gọi lại</span>
            </button>
            <button type="button" className="reception-btn reception-btn--ghost" disabled={!state.current || busy === 'skip'} onClick={() => actionCurrent('skip')}>
              <SkipForward size={16} />
              <span>Bỏ qua</span>
            </button>
            <button type="button" className="reception-btn reception-btn--ghost" disabled={!state.current || busy === 'start'} onClick={() => actionCurrent('start')}>
              <PlayCircle size={16} />
              <span>Hoàn tất gọi</span>
            </button>
          </div>
        </article>

        <article className="reception-panel">
          <header className="reception-panel__header reception-panel__header--compact">
            <div>
              <h2>Tiếp theo trong hàng đợi</h2>
              <p>{formatInteger(state.summary?.waiting || waitingItems.length)} ticket đang chờ.</p>
            </div>
          </header>
          {state.loading ? <LoadingBlock /> : (
            <div className="reception-next-list">
              {waitingItems.map((ticket, index) => {
                const waitState = getQueueWaitState(ticket);
                return (
                  <div key={getQueueTicketId(ticket)} className="reception-next-list__item">
                    <strong>{index + 1}. {ticket.queue_number}</strong>
                    <span>{ticket.patient_name || 'Bệnh nhân'} · chờ {formatMinutes(waitState.minutes)}</span>
                  </div>
                );
              })}
              {!waitingItems.length ? <div className="reception-empty-panel reception-empty-panel--compact">Không còn bệnh nhân đang chờ.</div> : null}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function QueueStatusPanel({ mode, onNavigate }) {
  const config = QUEUE_MODES[mode] || QUEUE_MODES.waiting;
  const refs = useReceptionRefs();
  const [filters, setFilters] = useState({ date: todayKey(), department_id: '', doctor_id: '' });
  const [state, setState] = useState({ loading: true, error: '', items: [], summary: null });
  const [actionBusy, setActionBusy] = useState('');
  const [priorityTicket, setPriorityTicket] = useState(null);
  const [timeline, setTimeline] = useState({ loading: false, error: '', ticket: null, items: [] });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const params = {
          date: filters.date,
          department_id: filters.department_id,
          doctor_id: filters.doctor_id,
        };
        const [summary, items] = await Promise.all([
          receptionQueueApi.getQueueSummaryToday(params).catch(() => null),
          loadQueueTickets(params, config.statuses || []),
        ]);
        if (!mounted) return;
        setState({ loading: false, error: '', items, summary });
      } catch (error) {
        if (!mounted) return;
        setState((current) => ({ ...current, loading: false, error: getErrorMessage(error, 'Không tải được danh sách queue.') }));
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [mode, filters.date, filters.department_id, filters.doctor_id, refreshToken]);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'department_id' ? { doctor_id: '' } : {}),
    }));
  }

  async function runQueueAction(type, ticket) {
    const ticketId = getQueueTicketId(ticket);
    if (!ticketId) return;
    setActionBusy(`${type}:${ticketId}`);
    try {
      if (type === 'call') await receptionQueueApi.callQueueTicket(ticketId);
      if (type === 'recall') await receptionQueueApi.recallQueueTicket(ticketId);
      if (type === 'skip') await receptionQueueApi.skipQueueTicket(ticketId, { reason: 'Bỏ qua từ màn quản lý queue.' });
      if (type === 'start') await receptionQueueApi.startQueueService(ticketId);
      if (type === 'complete') await receptionQueueApi.completeQueueTicket(ticketId);
      if (type === 'cancel') {
        const reason = window.prompt('Lý do hủy ticket:');
        if (reason === null) return;
        await receptionQueueApi.cancelQueueTicket(ticketId, { reason: reason.trim() || 'Hủy từ màn quản lý queue.' });
      }
      setRefreshToken((current) => current + 1);
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      setActionBusy('');
    }
  }

  async function openTimeline(ticket) {
    const ticketId = getQueueTicketId(ticket);
    if (!ticketId) return;
    setTimeline({ loading: true, error: '', ticket, items: [] });
    try {
      const data = await receptionQueueApi.getQueueTimeline(ticketId, { limit: 80 });
      setTimeline({ loading: false, error: '', ticket, items: safeArray(data?.items) });
    } catch (error) {
      setTimeline({ loading: false, error: getErrorMessage(error), ticket, items: [] });
    }
  }

  const waitingStats = useMemo(() => {
    const waits = state.items.map((item) => getQueueWaitState(item).minutes);
    const over15 = waits.filter((minutes) => minutes > 15).length;
    const over30 = waits.filter((minutes) => minutes > 30).length;
    const priority = state.items.filter((item) => item.queue_type !== 'normal').length;
    const average = waits.length ? Math.round(waits.reduce((sum, item) => sum + item, 0) / waits.length) : 0;
    return { over15, over30, priority, average };
  }, [state.items]);

  const completedStats = useMemo(() => {
    const totalService = state.items
      .filter((item) => item.completed_time && item.service_start_time)
      .map((item) => getMinutesSince(item.service_start_time, new Date(item.completed_time)));
    const totalWait = state.items
      .filter((item) => item.called_time && item.checkin_time)
      .map((item) => getMinutesSince(item.checkin_time, new Date(item.called_time)));
    const avgService = totalService.length ? Math.round(totalService.reduce((sum, item) => sum + item, 0) / totalService.length) : 0;
    const avgWait = totalWait.length ? Math.round(totalWait.reduce((sum, item) => sum + item, 0) / totalWait.length) : 0;
    return { avgService, avgWait };
  }, [state.items]);

  return (
    <section className="reception-appointment-module">
      <ModuleHero
        title={config.title}
        subtitle={config.subtitle}
        eyebrow="Queue workflow"
        icon={Users}
        actions={(
          <>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setRefreshToken((current) => current + 1)}>
              <RefreshCw size={16} />
              <span>Làm mới</span>
            </button>
            <button type="button" className="reception-btn reception-btn--primary" onClick={() => onNavigate?.('queue-board')}>
              <Users size={16} />
              <span>Bảng hàng đợi</span>
            </button>
          </>
        )}
      />
      <QueueFilters refs={refs} filters={filters} onChange={updateFilter} />
      {mode === 'waiting' ? (
        <div className="reception-flow-stats">
          <SummaryCard label="Tổng đang chờ" value={state.items.length} tone="info" />
          <SummaryCard label="Chờ trên 15 phút" value={waitingStats.over15} tone="warning" />
          <SummaryCard label="Chờ trên 30 phút" value={waitingStats.over30} tone="danger" />
          <SummaryCard label="Ưu tiên" value={waitingStats.priority} tone="teal" />
          <article className="reception-flow-stat is-success">
            <span>Trung bình thời gian chờ</span>
            <strong>{formatMinutes(waitingStats.average)}</strong>
          </article>
        </div>
      ) : null}
      {mode === 'completed' ? (
        <div className="reception-flow-stats">
          <SummaryCard label="Tổng hoàn tất" value={state.items.length} tone="success" />
          <article className="reception-flow-stat is-info"><span>Thời gian chờ TB</span><strong>{formatMinutes(completedStats.avgWait)}</strong></article>
          <article className="reception-flow-stat is-success"><span>Thời gian phục vụ TB</span><strong>{formatMinutes(completedStats.avgService)}</strong></article>
          <SummaryCard label="Hoàn tất trong ngày" value={state.summary?.completed} tone="success" />
        </div>
      ) : null}
      <InlineError message={state.error} />
      {state.loading ? <LoadingBlock /> : (
        <QueueTable
          items={state.items}
          actionBusy={actionBusy}
          mode={mode}
          onAction={runQueueAction}
          onPriority={setPriorityTicket}
          onTimeline={openTimeline}
          onTransfer={() => onNavigate?.('queue-transfer')}
        />
      )}
      <PriorityModal
        ticket={priorityTicket}
        onClose={() => setPriorityTicket(null)}
        onSaved={() => {
          setPriorityTicket(null);
          setRefreshToken((current) => current + 1);
        }}
      />
      <QueueTimelineDrawer state={timeline} onClose={() => setTimeline({ loading: false, error: '', ticket: null, items: [] })} />
    </section>
  );
}

function PriorityModal({ ticket, onClose, onSaved }) {
  const [form, setForm] = useState({ queue_type: 'priority', reason: '' });
  const [state, setState] = useState({ loading: false, error: '' });

  useEffect(() => {
    if (ticket) {
      setForm({ queue_type: ticket.queue_type === 'vip' ? 'vip' : 'priority', reason: '' });
      setState({ loading: false, error: '' });
    }
  }, [ticket]);

  if (!ticket) return null;

  async function submit(event) {
    event.preventDefault();
    if (!form.reason.trim()) {
      setState({ loading: false, error: 'Vui lòng nhập lý do đổi ưu tiên.' });
      return;
    }
    setState({ loading: true, error: '' });
    try {
      await receptionQueueApi.reorderQueuePriority(getQueueTicketId(ticket), {
        queue_type: form.queue_type,
        reason: form.reason,
      });
      onSaved?.();
    } catch (error) {
      setState({ loading: false, error: getErrorMessage(error, 'Không đổi được ưu tiên.') });
    }
  }

  return (
    <div className="reception-modal-backdrop" role="presentation">
      <form className="reception-modal reception-modal--narrow" role="dialog" aria-modal="true" onSubmit={submit}>
        <header className="reception-modal__header">
          <div>
            <span className="reception-modal__eyebrow">Đổi ưu tiên</span>
            <h3>Ticket {ticket.queue_number}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng">
            <XCircle size={20} />
          </button>
        </header>
        <div className="reception-form-grid reception-form-grid--single">
          <label>
            <span>Priority</span>
            <select value={form.queue_type} onChange={(event) => setForm((current) => ({ ...current, queue_type: event.target.value }))}>
              <option value="normal">Thường</option>
              <option value="priority">Ưu tiên</option>
              <option value="vip">Khẩn / VIP</option>
            </select>
          </label>
          <label>
            <span>Lý do đổi ưu tiên *</span>
            <textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Người cao tuổi, trẻ em, cấp cứu nhẹ..." />
          </label>
        </div>
        <InlineError message={state.error} />
        <footer className="reception-modal__actions">
          <button type="submit" className="reception-btn reception-btn--primary" disabled={state.loading}>
            {state.loading ? <Loader2 size={16} /> : <CheckCircle2 size={16} />}
            <span>Lưu ưu tiên</span>
          </button>
          <button type="button" className="reception-btn reception-btn--ghost" onClick={onClose}>Hủy</button>
        </footer>
      </form>
    </div>
  );
}

function QueueTransferPanel({ onNavigate }) {
  const config = QUEUE_MODES.transfer;
  const refs = useReceptionRefs();
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: true, error: '', items: [] });
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ department_id: '', doctor_id: '', reason: '', keep_priority: true, create_new_number: true });
  const [submitState, setSubmitState] = useState({ loading: false, error: '', success: null });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const items = await loadQueueTickets({}, ['waiting', 'called', 'recalled', 'skipped']);
        if (!mounted) return;
        setState({ loading: false, error: '', items });
      } catch (error) {
        if (!mounted) return;
        setState({ loading: false, error: getErrorMessage(error, 'Không tải được ticket có thể chuyển.'), items: [] });
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return state.items.slice(0, 10);
    return state.items.filter((item) => {
      const haystack = [
        item.queue_number,
        item.patient_name,
        item.patient_phone,
        item.patient_code,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(keyword);
    }).slice(0, 12);
  }, [query, state.items]);

  function selectTicket(ticket) {
    setSelected(ticket);
    setForm({
      department_id: ticket.department_id || '',
      doctor_id: ticket.doctor_id || '',
      reason: '',
      keep_priority: true,
      create_new_number: true,
    });
    setSubmitState({ loading: false, error: '', success: null });
  }

  async function submitTransfer(event) {
    event.preventDefault();
    if (!selected) {
      setSubmitState({ loading: false, error: 'Vui lòng chọn ticket cần chuyển.', success: null });
      return;
    }
    if (!form.reason.trim()) {
      setSubmitState({ loading: false, error: 'Vui lòng nhập lý do chuyển.', success: null });
      return;
    }
    const targetDepartment = refs.departments.find((item) => item.department_id === form.department_id);
    const targetDoctor = refs.doctors.find((item) => item.user_id === form.doctor_id);
    const confirmed = window.confirm(`Bạn chắc chắn muốn chuyển ticket ${selected.queue_number} từ ${selected.department_name || '--'} - ${selected.doctor_name || '--'} sang ${targetDepartment?.department_name || '--'} - ${targetDoctor?.full_name || '--'}?`);
    if (!confirmed) return;

    setSubmitState({ loading: true, error: '', success: null });
    try {
      const data = await receptionQueueApi.transferQueueTicket(getQueueTicketId(selected), {
        department_id: form.department_id,
        doctor_id: form.doctor_id,
        reason: form.reason,
        keep_priority: form.keep_priority,
        create_new_number: form.create_new_number,
      });
      setSubmitState({
        loading: false,
        error: '',
        success: extractQueueTicket(data),
      });
      setRefreshToken((current) => current + 1);
    } catch (error) {
      setSubmitState({ loading: false, error: getErrorMessage(error, 'Chuyển hàng đợi thất bại.'), success: null });
    }
  }

  return (
    <section className="reception-appointment-module">
      <ModuleHero
        title={config.title}
        subtitle={config.subtitle}
        eyebrow="Queue workflow"
        icon={Shuffle}
        actions={(
          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onNavigate?.('queue-board')}>
            <Users size={16} />
            <span>Về bảng hàng đợi</span>
          </button>
        )}
      />

      <div className="reception-transfer-layout">
        <article className="reception-panel">
          <header className="reception-panel__header reception-panel__header--compact">
            <div>
              <h2>Tìm ticket</h2>
              <p>Nhập số thứ tự, tên bệnh nhân hoặc SĐT.</p>
            </div>
          </header>
          <label className="reception-appointment-search">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="A015 / Nguyễn Văn A / 090..." />
          </label>
          <InlineError message={state.error} />
          {state.loading ? <LoadingBlock /> : (
            <div className="reception-receipt-results">
              {results.map((ticket) => (
                <button key={getQueueTicketId(ticket)} type="button" className={getQueueTicketId(selected) === getQueueTicketId(ticket) ? 'is-selected' : ''} onClick={() => selectTicket(ticket)}>
                  <FileText size={18} />
                  <span>
                    <strong>{ticket.queue_number} · {ticket.patient_name || 'Bệnh nhân'}</strong>
                    <small>{ticket.department_name || '--'} · {ticket.doctor_name || '--'} · {getStatusMeta(ticket.status, 'queue').label}</small>
                  </span>
                </button>
              ))}
              {!results.length ? <div className="reception-empty-panel reception-empty-panel--compact">Không có ticket phù hợp.</div> : null}
            </div>
          )}
        </article>

        <form className="reception-panel" onSubmit={submitTransfer}>
          <header className="reception-panel__header reception-panel__header--compact">
            <div>
              <h2>Form chuyển</h2>
              <p>Ticket gắn appointment chỉ chuyển được nếu backend cho phép cùng bác sĩ/khoa hoặc đã reschedule trước.</p>
            </div>
          </header>
          {selected ? (
            <div className="reception-detail-grid">
              <div><span>Số thứ tự</span><strong>{selected.queue_number}</strong></div>
              <div><span>Bệnh nhân</span><strong>{selected.patient_name || '--'}</strong></div>
              <div><span>Khoa hiện tại</span><strong>{selected.department_name || '--'}</strong></div>
              <div><span>Bác sĩ hiện tại</span><strong>{selected.doctor_name || '--'}</strong></div>
              <div><span>Trạng thái hiện tại</span><strong>{getStatusMeta(selected.status, 'queue').label}</strong></div>
              <div><span>Thời gian chờ</span><strong>{formatMinutes(getQueueWaitState(selected).minutes)}</strong></div>
            </div>
          ) : (
            <div className="reception-empty-panel reception-empty-panel--compact">Chọn ticket để chuyển.</div>
          )}
          <div className="reception-form-grid">
            <label>
              <span>Chuyển đến khoa</span>
              <select value={form.department_id} onChange={(event) => setForm((current) => ({ ...current, department_id: event.target.value, doctor_id: '' }))}>
                <option value="">Chọn khoa</option>
                {refs.departments.map((department) => (
                  <option key={department.department_id} value={department.department_id}>{department.department_name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Chuyển đến bác sĩ</span>
              <select value={form.doctor_id} onChange={(event) => setForm((current) => ({ ...current, doctor_id: event.target.value }))}>
                <option value="">Chọn bác sĩ</option>
                {refs.doctors
                  .filter((doctor) => !form.department_id || doctor.department_id === form.department_id)
                  .map((doctor) => (
                    <option key={doctor.user_id} value={doctor.user_id}>{doctor.full_name}</option>
                  ))}
              </select>
            </label>
            <label className="is-span-2">
              <span>Lý do chuyển *</span>
              <textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Bệnh nhân cần khám chuyên khoa tim mạch..." />
            </label>
            <label className="reception-check-row">
              <input type="checkbox" checked={form.keep_priority} onChange={(event) => setForm((current) => ({ ...current, keep_priority: event.target.checked }))} />
              <span>Có giữ ưu tiên không?</span>
            </label>
            <label className="reception-check-row">
              <input type="checkbox" checked={form.create_new_number} onChange={(event) => setForm((current) => ({ ...current, create_new_number: event.target.checked }))} />
              <span>Có tạo số thứ tự mới không?</span>
            </label>
          </div>
          <InlineError message={submitState.error} />
          {submitState.success ? (
            <InlineSuccess message={`Chuyển hàng đợi thành công. Ticket mới: ${submitState.success.queue_number || '--'} · ${submitState.success.department_name || '--'} · ${submitState.success.doctor_name || '--'}`} />
          ) : null}
          <footer className="reception-modal__actions">
            <button type="submit" className="reception-btn reception-btn--primary" disabled={submitState.loading || !selected}>
              {submitState.loading ? <Loader2 size={16} /> : <Shuffle size={16} />}
              <span>Chuyển hàng đợi</span>
            </button>
            <button type="button" className="reception-btn reception-btn--ghost" disabled={!submitState.success} onClick={() => onNavigate?.('queue-board')}>
              <Eye size={16} />
              <span>Xem queue mới</span>
            </button>
            <button type="button" className="reception-btn reception-btn--ghost" disabled={!submitState.success} onClick={() => window.print()}>
              <Printer size={16} />
              <span>In lại phiếu</span>
            </button>
          </footer>
        </form>
      </div>
    </section>
  );
}

function QueueTimelineDrawer({ state, onClose }) {
  if (!state.loading && !state.error && !state.ticket) return null;
  return (
    <aside className="reception-appointment-drawer" aria-label="Timeline queue">
      <div className="reception-appointment-drawer__header">
        <div>
          <span>Timeline ticket</span>
          <h3>{state.ticket?.queue_number || 'Đang tải...'}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng timeline">
          <XCircle size={20} />
        </button>
      </div>
      {state.loading ? <LoadingBlock label="Đang tải timeline..." /> : null}
      <InlineError message={state.error} />
      <div className="reception-detail-timeline">
        {safeArray(state.items).map((item) => (
          <div key={item.audit_log_id} className="reception-detail-timeline__item">
            <span>{formatDateTime(item.created_at)}</span>
            <strong>{item.message || item.action}</strong>
            <small>{item.status || 'success'}</small>
          </div>
        ))}
        {!state.loading && !safeArray(state.items).length ? (
          <div className="reception-empty-panel reception-empty-panel--compact">Chưa có timeline.</div>
        ) : null}
      </div>
    </aside>
  );
}
