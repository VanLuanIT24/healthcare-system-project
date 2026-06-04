import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  HeartPulse,
  Loader2,
  Monitor,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  Users,
  UserX,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { nurseOperationsApi } from './nurseApi';
import { confirmNurseAction, notifyNurse, promptNurseText, runNurseAction } from './nurseActions';

const priorityLabels = {
  critical: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Bình thường',
  low: 'Thấp',
};

const queueTypeLabels = {
  normal: 'Thường',
  priority: 'Ưu tiên',
  vip: 'VIP',
};

const statusLabels = {
  waiting: 'Đang chờ',
  called: 'Đã gọi',
  recalled: 'Gọi lại',
  in_service: 'Đang phục vụ',
  skipped: 'Bỏ qua',
  completed: 'Hoàn tất',
  no_show: 'Không có mặt',
  cancelled: 'Đã hủy',
  not_started: 'Chưa bắt đầu',
  waiting_nurse: 'Chờ điều dưỡng',
  nurse_in_progress: 'Đang tiếp nhận',
  triage_pending: 'Chờ phân loại',
  triage_in_progress: 'Đang phân loại',
  triage_done: 'Đã phân loại',
  vital_pending: 'Chờ sinh hiệu',
  vital_done: 'Đã có sinh hiệu',
  preparation_pending: 'Chờ chuẩn bị',
  ready_for_doctor: 'Sẵn sàng gặp bác sĩ',
  breached: 'Quá SLA',
  warning: 'Cảnh báo',
  normal: 'Bình thường',
  draft: 'Nháp',
  in_progress: 'Đang làm',
};

const acuityLabels = {
  red: 'ĐỎ',
  orange: 'CAM',
  yellow: 'VÀNG',
  green: 'XANH LÁ',
  blue: 'XANH DƯƠNG',
};

const intakeActionPresentation = {
  claim: {
    label: 'Nhận xử lý',
    description: 'Gán bệnh nhân cho điều dưỡng hiện tại.',
    icon: UserCheck,
    tone: 'primary',
  },
  record_vital: {
    label: 'Nhập sinh hiệu',
    description: 'Mở phiếu đo sinh hiệu trước khám.',
    icon: HeartPulse,
    tone: 'cyan',
  },
  triage: {
    label: 'Phân loại',
    description: 'Mở phiếu phân loại nguy cơ lâm sàng.',
    icon: ClipboardCheck,
    tone: 'violet',
  },
  ready: {
    label: 'Sẵn sàng gặp bác sĩ',
    description: 'Chuyển bệnh nhân sang danh sách bác sĩ có thể gọi vào phòng.',
    confirmLabel: 'Đánh dấu sẵn sàng',
    icon: CheckCircle2,
    tone: 'success',
  },
  call: {
    label: 'Gọi số',
    description: 'Phát lệnh gọi bệnh nhân trên hàng đợi và màn hình phòng khám.',
    confirmLabel: 'Gọi bệnh nhân',
    icon: PhoneCall,
    tone: 'info',
  },
  skip: {
    label: 'Bỏ qua',
    description: 'Tạm bỏ qua lượt gọi hiện tại, vẫn giữ bệnh nhân trong hàng đợi.',
    confirmLabel: 'Bỏ qua lượt gọi',
    icon: Ban,
    tone: 'warning',
  },
  no_show: {
    label: 'Không có mặt',
    description: 'Đánh dấu bệnh nhân vắng mặt sau khi gọi nhưng không phản hồi.',
    confirmLabel: 'Đánh dấu vắng mặt',
    icon: UserX,
    tone: 'danger',
  },
  release: {
    label: 'Trả về chờ',
    description: 'Gỡ điều dưỡng phụ trách và đưa bệnh nhân về danh sách chờ.',
    confirmLabel: 'Trả về danh sách chờ',
    icon: Users,
    tone: 'warning',
  },
  priority: {
    label: 'Tăng ưu tiên',
    description: 'Đưa bệnh nhân vào luồng ưu tiên để xử lý sớm hơn.',
    confirmLabel: 'Tăng ưu tiên',
    icon: ShieldAlert,
    tone: 'danger',
  },
  transfer: {
    label: 'Chuyển tuyến',
    description: 'Chuyển bệnh nhân sang bác sĩ hoặc khoa phù hợp hơn.',
    confirmLabel: 'Chuyển tuyến',
    icon: ArrowRightLeft,
    tone: 'info',
  },
  notify_doctor: {
    label: 'Báo bác sĩ',
    description: 'Tạo thông báo cho bác sĩ phụ trách bệnh nhân này.',
    confirmLabel: 'Báo bác sĩ',
    icon: Send,
    tone: 'info',
  },
};

const demoMeta = {
  date: toLocalDateKey(),
  shift: 'morning',
  generated_at: new Date().toISOString(),
  department_name: 'Nội tổng quát',
};

const demoIntake = {
  meta: demoMeta,
  intake: {
    summary: {
      checked_in: 48,
      waiting_nurse: 16,
      nurse_in_progress: 4,
      triage_waiting: 12,
      triage_in_progress: 3,
      vital_pending: 26,
      abnormal_vitals: 5,
      ready_for_doctor: 9,
      sla_breached: 8,
    },
    checked_in_items: [
      {
        queue_ticket_id: 'demo-q-1',
        queue_number: 'A012',
        patient_name: 'Nguyễn Văn A',
        patient_code: 'BN000123',
        age: 54,
        gender: 'male',
        queue_type: 'priority',
        status: 'waiting',
        nursing_stage: 'triage_pending',
        doctor_name: 'BS Trần Minh',
        department_name: 'Nội tổng quát',
        waiting_minutes: 24,
        priority_reason: 'Đau ngực, khó thở',
        checkin_time: new Date(Date.now() - 24 * 60000).toISOString(),
      },
      {
        queue_ticket_id: 'demo-q-2',
        queue_number: 'A014',
        patient_name: 'Trần Thị B',
        patient_code: 'BN000214',
        age: 32,
        gender: 'female',
        queue_type: 'normal',
        status: 'waiting',
        nursing_stage: 'vital_pending',
        doctor_name: 'BS Nguyễn Lan',
        department_name: 'Nội tổng quát',
        waiting_minutes: 18,
        priority_reason: 'Sốt cao, đau họng',
        checkin_time: new Date(Date.now() - 18 * 60000).toISOString(),
      },
      {
        queue_ticket_id: 'demo-q-3',
        queue_number: 'V003',
        patient_name: 'Lê Văn C',
        patient_code: 'BN000317',
        age: 66,
        gender: 'male',
        queue_type: 'vip',
        status: 'called',
        nursing_stage: 'ready_for_doctor',
        doctor_name: 'BS Hoàng Khoa',
        department_name: 'Tim mạch',
        waiting_minutes: 7,
        priority_reason: 'Tái khám tim mạch',
        ready_for_doctor_at: new Date(Date.now() - 7 * 60000).toISOString(),
      },
    ],
    ready_items: [],
    triage_items: [],
    priority_lane: { immediate: [], longest_waiting: [], unassigned: [] },
  },
  queue: { table: [], board: {}, total: 3, waiting: 2, called: 1, in_service: 0, skipped: 0, completed: 0, no_show: 0 },
  vitals: { pending: 26, abnormal: 5, abnormal_items: [] },
  triage: { pending: 12, in_progress: 3, completed: 18, high_priority: 5, pending_items: [] },
  activity_feed: [
    { id: 'a1', title: 'Số A012 vừa tiếp nhận', message: 'Nguyễn Văn A · ưu tiên', priority: 'high', created_at: new Date().toISOString() },
    { id: 'a2', title: 'Sinh hiệu bất thường', message: 'SpO2 thấp cần xác nhận', priority: 'critical', created_at: new Date(Date.now() - 5 * 60000).toISOString() },
  ],
};
demoIntake.queue.table = demoIntake.intake.checked_in_items;
demoIntake.intake.ready_items = demoIntake.intake.checked_in_items.filter((item) => item.nursing_stage === 'ready_for_doctor');
demoIntake.intake.triage_items = demoIntake.intake.checked_in_items.filter((item) => item.nursing_stage === 'triage_pending');
demoIntake.triage.pending_items = demoIntake.intake.triage_items;

const emptyMeta = {
  date: toLocalDateKey(),
  shift: 'all',
  generated_at: null,
  department_name: 'Khoa được phân quyền',
};

const emptyIntakeDashboard = {
  meta: emptyMeta,
  intake: {
    summary: {
      checked_in: 0,
      waiting_nurse: 0,
      nurse_in_progress: 0,
      triage_waiting: 0,
      triage_in_progress: 0,
      vital_pending: 0,
      abnormal_vitals: 0,
      ready_for_doctor: 0,
      sla_breached: 0,
    },
    checked_in_items: [],
    ready_items: [],
    triage_items: [],
    priority_lane: { immediate: [], longest_waiting: [], unassigned: [] },
  },
  queue: { table: [], board: {}, total: 0, waiting: 0, called: 0, in_service: 0, skipped: 0, completed: 0, no_show: 0 },
  vitals: { pending: 0, abnormal: 0, abnormal_items: [], pending_items: [] },
  triage: { pending: 0, in_progress: 0, completed: 0, high_priority: 0, pending_items: [] },
  activity_feed: [],
  priority_alerts: [],
};

const emptyWorklist = {
  meta: emptyMeta,
  summary: emptyIntakeDashboard.intake.summary,
  lanes: {
    waiting_nurse: [],
    in_progress: [],
    vital_pending: [],
    triage_pending: [],
    ready_for_doctor: [],
  },
};

const emptyTriageWorklist = {
  meta: emptyMeta,
  summary: { pending: 0, in_progress: 0, completed: 0, high_priority: 0 },
  items: [],
};

const emptyReadyForDoctor = {
  meta: emptyMeta,
  summary: { total: 0, priority: 0, called: 0, in_service: 0, waiting_after_ready: 0 },
  items: [],
};

function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '--/--/----';
  return date.toLocaleDateString('vi-VN');
}

function waitText(value) {
  const minutes = Number(value || 0);
  if (minutes < 60) return `${minutes} phút`;
  return `${Math.floor(minutes / 60)}g ${minutes % 60}p`;
}

function textValue(value, fallback = '--') {
  if (value === undefined || value === null || value === '') {
    return fallback === undefined || fallback === null || fallback === '' || fallback === value
      ? '--'
      : textValue(fallback, '--');
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const output = value.map((item) => textValue(item, '')).filter(Boolean).join(', ');
    return output || fallback;
  }
  if (typeof value === 'object') {
    return (
      value.full_name ||
      value.patient_name ||
      value.department_name ||
      value.room_name ||
      value.employee_code ||
      value.patient_code ||
      value.display_number ||
      value.queue_number ||
      value.title ||
      value.label ||
      value.message ||
      value.reason ||
      value.name ||
      value.code ||
      value._id ||
      value.id ||
      fallback
    );
  }
  return fallback;
}

function listOf(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function safeItem(item) {
  return item && typeof item === 'object' ? item : {};
}

function rawId(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value !== 'object') return '';
  for (const key of ['_id', 'id', 'patient_id', 'encounter_id', 'queue_ticket_id', 'appointment_id', 'department_id', 'doctor_id']) {
    const candidate = value[key];
    if (candidate && candidate !== value) {
      const id = rawId(candidate);
      if (id) return id;
    }
  }
  return '';
}

function patientName(item = {}) {
  const value = safeItem(item);
  return textValue(value.patient_name || value.patient?.patient_name || value.patient?.full_name || value.raw_queue_ticket?.patient_id, 'Chưa rõ bệnh nhân');
}

function patientCode(item = {}) {
  const value = safeItem(item);
  return textValue(value.patient_code || value.patient?.patient_code || value.raw_queue_ticket?.patient_id?.patient_code, '--');
}

function queueId(item = {}) {
  const value = safeItem(item);
  const id = value.queue_ticket_id || value.source_id || value.id || value._id;
  return rawId(id);
}

function patientId(item = {}) {
  const value = safeItem(item);
  return rawId(value.patient_id || value.patient?.patient_id || value.patient);
}

function selectedQueueIdFromUrl() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('queue_ticket_id') || '';
}

function goToNursePath(path, label = 'Điều hướng') {
  if (typeof window === 'undefined') return;
  notifyNurse({ title: label, message: 'Đang mở màn hình liên quan.' });
  window.location.assign(path);
}

function queueNumber(item = {}) {
  const value = safeItem(item);
  return textValue(value.queue_number || value.display_number || value.raw_queue_ticket?.display_number || value.raw_queue_ticket?.queue_number, '--');
}

function doctorName(item = {}) {
  const value = safeItem(item);
  return textValue(value.doctor_name || value.doctor || value.doctor_id || value.raw_queue_ticket?.doctor_id, '--');
}

function departmentName(item = {}) {
  const value = safeItem(item);
  return textValue(value.department_name || value.department || value.department_id || value.raw_queue_ticket?.department_id, '--');
}

function reasonText(item = {}, fallback = 'Khám theo lịch') {
  const value = safeItem(item);
  return textValue(value.priority_reason || value.reason || value.chief_complaint || value.message || value.title, fallback);
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function queryParams(filters) {
  return {
    date: filters.date,
    shift: filters.shift,
    priority: filters.priority === 'all' ? undefined : filters.priority,
    status: filters.status === 'all' ? undefined : filters.status,
    type: filters.type === 'all' ? undefined : filters.type,
    queue_limit: 320,
  };
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function useNursingData(loader, fallback, deps) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((payload) => {
        if (cancelled) return;
        setData(payload || fallback);
        setIsDemo(false);
        setError('');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setData(fallback);
        setIsDemo(true);
        setError(loadError?.message || 'Không thể tải dữ liệu tiếp nhận.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, deps);

  return { data, loading, isDemo, error };
}

function IntakeHeader({ eyebrow, title, description, meta, isDemo, loading, actions }) {
  const now = useClock();

  return (
    <header className="nurse-intake-header">
      <div className="nurse-intake-header__copy">
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="nurse-intake-meta">
          <em>{meta?.department_name || 'Khoa được phân quyền'}</em>
          <em>{meta?.shift === 'morning' ? 'Ca sáng' : meta?.shift === 'afternoon' ? 'Ca chiều' : meta?.shift === 'night' ? 'Ca đêm' : 'Tất cả ca'}</em>
          <em>{formatDate(meta?.date)}</em>
          <em>{formatTime(now)}</em>
        </div>
      </div>
      <aside>
        <span className={`nurse-realtime-badge${isDemo ? ' is-offline' : ''}`}>
          {isDemo ? <WifiOff size={15} /> : <Wifi size={15} />}
          {isDemo ? 'API chưa sẵn sàng' : 'Thời gian thực bật'}
        </span>
        <small>{loading ? 'Đang đồng bộ' : `Cập nhật ${formatTime(meta?.generated_at)}`}</small>
        <div className="nurse-intake-actions">{actions}</div>
      </aside>
    </header>
  );
}

function DemoNotice({ isDemo, error }) {
  if (!isDemo || !error) return null;
  return (
    <div className="nurse-dashboard-demo-note">
      <AlertTriangle size={16} />
      API chưa phản hồi nên chưa thể đồng bộ dữ liệu database. {error}
    </div>
  );
}

function Filters({ filters, setFilters, extra }) {
  return (
    <section className="nurse-intake-filters">
      <label><span>Ngày</span><input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} /></label>
      <label><span>Ca trực</span><select value={filters.shift} onChange={(event) => setFilters((current) => ({ ...current, shift: event.target.value }))}><option value="morning">Ca sáng</option><option value="afternoon">Ca chiều</option><option value="night">Ca đêm</option><option value="all">Tất cả</option></select></label>
      <label><span>Ưu tiên</span><select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}><option value="all">Tất cả</option><option value="critical">Khẩn cấp</option><option value="high">Cao</option><option value="medium">Trung bình</option><option value="low">Thấp</option></select></label>
      <label><span>Trạng thái</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Tất cả</option><option value="waiting">Đang chờ</option><option value="called">Đã gọi</option><option value="in_service">Đang phục vụ</option><option value="skipped">Bỏ qua</option></select></label>
      <label className="nurse-intake-search"><span>Tìm kiếm</span><div><Search size={15} /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Tên, mã BN, số hàng đợi, SĐT" /></div></label>
      {extra}
    </section>
  );
}

function KpiStrip({ items }) {
  return (
    <section className="nurse-intake-kpis">
      {listOf(items).map((item) => {
        const Icon = item.icon || ActivityIcon;
        return (
          <button key={item.label} type="button" className={`nurse-intake-kpi nurse-intake-kpi--${item.tone || 'blue'}`} onClick={item.onClick || (() => notifyNurse({ title: item.label, message: item.detail || 'Đã chọn chỉ số tiếp nhận.' }))}>
            <Icon size={19} />
            <span>{item.label}</span>
            <strong>{item.value ?? 0}</strong>
            <small>{item.detail}</small>
          </button>
        );
      })}
    </section>
  );
}

function ActivityIcon(props) {
  return <ClipboardList {...props} />;
}

function QueueStatusBadge({ value }) {
  const safeValue = textValue(value, 'waiting');
  return <span className={`nurse-status-pill nurse-intake-status nurse-intake-status--${safeValue}`}>{statusLabels[safeValue] || safeValue || '--'}</span>;
}

function PriorityBadge({ item }) {
  const row = safeItem(item);
  const value = row.priority || (row.queue_type === 'vip' ? 'high' : row.queue_type === 'priority' ? 'high' : 'normal');
  const safeValue = textValue(value, 'normal');
  return <span className={`nurse-priority-pill nurse-priority-pill--${safeValue}`}>{queueTypeLabels[row.queue_type] || priorityLabels[safeValue] || safeValue}</span>;
}

function SlaBadge({ minutes }) {
  const tone = minutes >= 30 ? 'breached' : minutes >= 15 ? 'warning' : 'normal';
  return <span className={`nurse-sla-pill nurse-sla-pill--${tone}`}>{statusLabels[tone]}</span>;
}

function ClinicalRiskStrip({ item = {}, context = null }) {
  const row = safeItem(item);
  const tags = context?.risk_tags || [];
  const fallback = [
    row.queue_type === 'vip' ? { code: 'VIP', label: 'VIP', severity: 'high' } : null,
    row.queue_type === 'priority' ? { code: 'PRIORITY', label: 'Ưu tiên', severity: 'high' } : null,
    row.waiting_minutes >= 30 ? { code: 'SLA', label: 'Quá SLA', severity: 'warning' } : null,
    row.nursing_stage === 'vital_pending' ? { code: 'VITAL', label: 'Chưa sinh hiệu', severity: 'warning' } : null,
  ].filter(Boolean);
  const riskTags = tags.length ? tags : fallback;

  return (
    <div className="nurse-risk-strip">
      {riskTags.slice(0, 4).map((tag) => <span key={tag.code || tag.label} className={`is-${tag.severity || 'normal'}`}>{tag.label}</span>)}
      {!riskTags.length ? <span>Không có cảnh báo nổi bật</span> : null}
    </div>
  );
}

function IntakeQuickActions({ item, onAction }) {
  const actions = ['claim', 'record_vital', 'triage', 'ready', 'call', 'skip', 'no_show'];
  return (
    <div className="nurse-intake-action-grid">
      {actions.map((action) => {
        const meta = intakeActionPresentation[action] || {};
        const Icon = meta.icon || CheckCircle2;
        return (
          <button
            key={action}
            type="button"
            className={`nurse-intake-action nurse-intake-action--${meta.tone || 'primary'}`}
            onClick={() => onAction(action, item)}
          >
            <Icon size={18} />
            <span>
              <strong>{meta.label || action}</strong>
              <small>{meta.description || 'Thực hiện thao tác điều dưỡng.'}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PatientContextDrawer({ item, onClose, onAction }) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = queueId(item);
    if (!id) {
      setContext(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    nurseOperationsApi.getQueueContext(id)
      .then((payload) => {
        if (!cancelled) setContext(payload);
      })
      .catch(() => {
        if (!cancelled) setContext(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  if (!item) return null;
  const active = context?.queue_ticket || item;
  const raw = context?.raw_queue_ticket || {};

  return (
    <aside className="nurse-intake-drawer" aria-label="Tóm tắt lâm sàng">
      <header>
        <button type="button" onClick={onClose} aria-label="Đóng"><X size={16} /></button>
        <PriorityBadge item={active} />
        <h2>{patientName(active)}</h2>
        <p>{patientCode(active)} · {queueNumber(active)} · {textValue(active.age || active.patient?.age, '--')} tuổi</p>
        <ClinicalRiskStrip item={active} context={context} />
      </header>

      {loading ? <div className="nurse-operation-loading"><Loader2 className="is-spinning" size={16} />Đang tải hồ sơ nhanh...</div> : null}

      <section>
        <h3>Hàng đợi và lịch hẹn</h3>
        <dl>
          <div><dt>Số hàng đợi</dt><dd>{queueNumber(active)}</dd></div>
          <div><dt>Trạng thái</dt><dd>{statusLabels[textValue(active.status, '')] || textValue(active.status, '--')}</dd></div>
          <div><dt>Bước điều dưỡng</dt><dd>{statusLabels[textValue(active.nursing_stage, '')] || textValue(active.nursing_stage, '--')}</dd></div>
          <div><dt>Giờ hẹn</dt><dd>{formatTime(context?.appointment?.appointment_time)}</dd></div>
          <div><dt>Bác sĩ</dt><dd>{doctorName(active)}</dd></div>
          <div><dt>Khoa</dt><dd>{departmentName(active)}</dd></div>
        </dl>
      </section>

      <section>
        <h3>Tóm tắt lâm sàng</h3>
        <div className="nurse-intake-snapshot">
          <article><span>Lý do khám</span><strong>{reasonText({ ...active, reason: context?.appointment?.reason }, 'Chưa ghi nhận')}</strong></article>
          <article><span>Dị ứng</span><strong>{listOf(context?.allergies).length ? listOf(context?.allergies).map((item) => textValue(item.allergen || item.name || item, '')).filter(Boolean).join(', ') : 'Không có cảnh báo'}</strong></article>
          <article><span>Vấn đề đang có</span><strong>{listOf(context?.active_problems).length ? listOf(context?.active_problems).map((item) => textValue(item.problem_name || item.name || item, '')).filter(Boolean).join(', ') : 'Chưa ghi nhận'}</strong></article>
          <article><span>Sinh hiệu mới nhất</span><strong>{context?.latest_vital ? vitalText(context.latest_vital) : 'Chưa có sinh hiệu'}</strong></article>
        </div>
      </section>

      <section>
        <h3>Dòng thời gian xử lý</h3>
        <ol className="nurse-drawer-timeline">
          <li><span>{formatTime(active.checkin_time || raw.checkin_time)}</span><strong>Đã tiếp nhận tại quầy</strong></li>
          <li><span>{formatTime(raw.nurse_started_at)}</span><strong>Điều dưỡng nhận xử lý</strong></li>
          <li><span>{formatTime(raw.triage_completed_at)}</span><strong>Phân loại hoàn tất</strong></li>
          <li><span>{formatTime(raw.ready_for_doctor_at)}</span><strong>Sẵn sàng gặp bác sĩ</strong></li>
        </ol>
      </section>

      <section>
        <h3>Hành động nhanh</h3>
        <IntakeQuickActions item={active} onAction={onAction} />
      </section>
    </aside>
  );
}

function vitalText(vital = {}) {
  const values = [
    vital.temperature ? `${vital.temperature}°C` : null,
    vital.heart_rate ? `M ${vital.heart_rate}` : null,
    vital.systolic_bp && vital.diastolic_bp ? `HA ${vital.systolic_bp}/${vital.diastolic_bp}` : null,
    vital.spo2 ? `SpO2 ${vital.spo2}%` : null,
  ].filter(Boolean);
  return values.join(' · ') || 'Đã ghi nhận';
}

function QueueTable({ items, selectedId, onSelect, onAction, mode = 'full' }) {
  const rows = listOf(items);
  return (
    <div className="nurse-worklist-table-wrap">
      <table className="nurse-worklist-table nurse-worklist-table--wide nurse-intake-table">
        <thead>
          <tr>
            <th>Số hàng đợi</th>
            <th>Bệnh nhân</th>
            <th>Lý do khám</th>
            <th>Tiếp nhận</th>
            <th>Chờ</th>
            <th>Bác sĩ / khoa</th>
            <th>Loại</th>
            <th>Trạng thái</th>
            <th>Bước điều dưỡng</th>
            <th>Cảnh báo</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={queueId(item)} className={selectedId === queueId(item) ? 'is-selected' : ''} onClick={() => onSelect(item)}>
              <td><strong>{queueNumber(item)}</strong></td>
              <td><strong>{patientName(item)}</strong><small>{patientCode(item)} · {item.age || '--'}t</small></td>
              <td>{reasonText(item)}</td>
              <td>{formatTime(item.checkin_time)}</td>
              <td>{waitText(item.waiting_minutes)}</td>
              <td><strong>{doctorName(item)}</strong><small>{departmentName(item)}</small></td>
              <td><PriorityBadge item={item} /></td>
              <td><QueueStatusBadge value={item.status} /></td>
              <td>{statusLabels[textValue(item.nursing_stage, '')] || textValue(item.nursing_stage, '--')}</td>
              <td><SlaBadge minutes={item.waiting_minutes || 0} /></td>
              <td>
                <div className="nurse-row-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); onAction(mode === 'ready' ? 'call' : 'claim', item); }}>{mode === 'ready' ? 'Gọi' : 'Nhận'}</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onAction('triage', item); }}>Phân loại</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <div className="nurse-dashboard-empty">Không có bệnh nhân trong bộ lọc này.</div> : null}
    </div>
  );
}

function useIntakePageData(filters, refresh) {
  const params = queryParams(filters);
  return useNursingData(
    () => nurseOperationsApi.getIntakeDashboard(params),
    emptyIntakeDashboard,
    [filters.date, filters.shift, filters.priority, filters.status, filters.type, refresh],
  );
}

function filterQueueItems(items, filters) {
  const query = normalizeText(filters.search);
  return listOf(items).filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const row = safeItem(item);
    if (filters.status !== 'all' && row.status !== filters.status && row.nursing_stage !== filters.status) return false;
    if (filters.priority !== 'all') {
      const mappedPriority = row.queue_type === 'vip' || row.queue_type === 'priority' ? 'high' : 'medium';
      if (mappedPriority !== filters.priority && row.priority !== filters.priority) return false;
    }
    if (query) {
      const haystack = normalizeText(`${patientName(item)} ${patientCode(item)} ${queueNumber(item)} ${textValue(row.phone, '')}`);
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function IntakeActionConfirmDialog({ request, onCancel, onConfirm }) {
  const meta = intakeActionPresentation[request?.action] || {};
  const Icon = meta.icon || CheckCircle2;
  const tone = meta.tone || 'primary';
  const item = request?.item || {};

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onCancel();
      if (event.key === 'Enter') onConfirm();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, onConfirm]);

  return (
    <div className="nurse-modal" role="dialog" aria-modal="true" aria-label={meta.label || request?.title || 'Xác nhận thao tác'}>
      <div className="nurse-modal__backdrop" onClick={onCancel} />
      <section className={`nurse-action-confirm nurse-action-confirm--${tone}`}>
        <header>
          <span className="nurse-action-confirm__icon"><Icon size={22} /></span>
          <div>
            <span>Xác nhận thao tác</span>
            <h2>{meta.label || request?.title || 'Xác nhận'}</h2>
          </div>
          <button type="button" className="nurse-icon-button" onClick={onCancel} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="nurse-action-confirm__patient">
          <div>
            <span>{queueNumber(item)}</span>
            <strong>{patientName(item)}</strong>
            <small>{patientCode(item)} · {doctorName(item)} · {departmentName(item)}</small>
          </div>
          <PriorityBadge item={item} />
        </div>

        <p>{meta.description || request?.message || 'Xác nhận thao tác điều dưỡng cho bệnh nhân này.'}</p>

        <dl className="nurse-action-confirm__facts">
          <div><dt>Tiếp nhận</dt><dd>{formatTime(item.checkin_time)}</dd></div>
          <div><dt>Đang chờ</dt><dd>{waitText(item.waiting_minutes)}</dd></div>
          <div><dt>Bước hiện tại</dt><dd>{statusLabels[textValue(item.nursing_stage, '')] || textValue(item.nursing_stage, '--')}</dd></div>
        </dl>

        <footer>
          <button type="button" className="nurse-action-confirm__secondary" onClick={onCancel}>Hủy</button>
          <button type="button" className="nurse-action-confirm__primary" onClick={onConfirm}>
            <Icon size={17} />
            {meta.confirmLabel || request?.confirmLabel || 'Xác nhận'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function useIntakeActionConfirm() {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  function confirmAction(nextRequest) {
    if (resolverRef.current) resolverRef.current(false);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest(nextRequest);
    });
  }

  function settle(result) {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setRequest(null);
  }

  const confirmDialog = request
    ? <IntakeActionConfirmDialog request={request} onCancel={() => settle(false)} onConfirm={() => settle(true)} />
    : null;

  return { confirmAction, confirmDialog };
}

function useActionRunner(setRefresh) {
  const [notice, setNotice] = useState('');
  const { confirmAction, confirmDialog } = useIntakeActionConfirm();
  async function run(action, item, body = {}) {
    const id = queueId(item);
    if (!id) {
      const message = 'Chưa có queue_ticket_id hợp lệ để thao tác.';
      setNotice(message);
      notifyNurse({ tone: 'warning', title: 'Tiếp nhận điều dưỡng', message });
      return;
    }
    if (action === 'triage') {
      goToNursePath(`/nurse/reception-triage/create-triage?queue_ticket_id=${encodeURIComponent(id)}`, 'Mở phiếu phân loại');
      return;
    }
    if (action === 'record_vital') {
      goToNursePath(`/nurse/vitals-records/entry?queue_ticket_id=${encodeURIComponent(id)}`, 'Nhập sinh hiệu');
      return;
    }
    const actionNames = {
      claim: 'Nhận bệnh nhân',
      release: 'Trả về danh sách chờ',
      ready: 'Sẵn sàng gặp bác sĩ',
      call: 'Gọi bệnh nhân',
      skip: 'Bỏ qua',
      no_show: 'Không có mặt',
      start_service: 'Bắt đầu phục vụ',
      priority: 'Tăng ưu tiên',
      transfer: 'Chuyển tuyến',
      notify_doctor: 'Báo bác sĩ',
      note: 'Ghi chú tiếp nhận',
    };
    if (['release', 'ready', 'call', 'skip', 'no_show', 'priority', 'transfer', 'notify_doctor'].includes(action)) {
      const confirmed = await confirmAction({
        action,
        item,
        title: actionNames[action] || 'Xác nhận thao tác',
        message: `${queueNumber(item)} - ${patientName(item)}`,
      });
      if (!confirmed) return null;
    }
    await runNurseAction({
      label: actionNames[action] || 'Cập nhật tiếp nhận',
      run: async () => {
        if (action === 'claim') return nurseOperationsApi.claimIntake(id);
        if (action === 'release') return nurseOperationsApi.releaseIntake(id);
        if (action === 'ready') return nurseOperationsApi.markReadyForDoctor(id);
        if (action === 'call') return nurseOperationsApi.callQueue(id);
        if (action === 'skip') return nurseOperationsApi.skipQueue(id, { reason: 'Điều dưỡng bỏ qua từ trung tâm điều phối' });
        if (action === 'no_show') return nurseOperationsApi.markNoShow(id, { reason: 'Không có mặt khi gọi' });
        if (action === 'start_service') return nurseOperationsApi.startService(id);
        if (action === 'priority') return nurseOperationsApi.reorderPriority(id, body);
        if (action === 'transfer') return nurseOperationsApi.transferQueue(id, body);
        if (action === 'notify_doctor') return nurseOperationsApi.notifyDoctor(id, body);
        if (action === 'note') return nurseOperationsApi.addIntakeNote(id, body);
        return null;
      },
      successMessage: 'Đã cập nhật thao tác thành công.',
      onSuccess: () => {
        setNotice('Đã cập nhật thao tác thành công.');
        setRefresh((value) => value + 1);
      },
    });
  }
  return { notice, setNotice, run, confirmDialog };
}

export function CheckedInPatientsPage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', status: 'all', type: 'all', search: '' });
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useIntakePageData(filters, refresh);
  const { notice, run, confirmDialog } = useActionRunner(setRefresh);
  const items = useMemo(() => filterQueueItems(data.intake?.checked_in_items || data.queue?.table || [], filters), [data, filters]);
  const summary = data.intake?.summary || {};
  const active = selected || items[0];

  function selectPatient(item) {
    setSelected(item);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setSelected(null);
    setDrawerOpen(false);
  }

  async function callNextQueue() {
    await runNurseAction({
      label: 'Gọi số tiếp theo',
      confirm: { title: 'Gọi số tiếp theo?', message: 'Hệ thống sẽ gọi bệnh nhân tiếp theo trong hàng đợi điều dưỡng.' },
      run: () => nurseOperationsApi.callNextQueue({ department_id: active?.department_id, doctor_id: active?.doctor_id }),
      successMessage: 'Đã gọi số tiếp theo.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
  }

  return (
    <section className="nurse-intake-page">
      <IntakeHeader
        eyebrow="Trung tâm tiếp nhận điều dưỡng"
        title="Bệnh nhân đã đến"
        description="Theo dõi bệnh nhân đã đến cơ sở, đã vào hàng đợi, trạng thái điều dưỡng, sinh hiệu, phân loại và khả năng sẵn sàng gặp bác sĩ."
        meta={data.meta}
        isDemo={isDemo}
        loading={loading}
        actions={<><button type="button" onClick={() => run('claim', active)}><Plus size={16} />Tiếp nhận nhanh</button><button type="button" onClick={() => goToNursePath('/nurse/overview/realtime-queue', 'Màn hình hàng đợi')}><Monitor size={16} />Màn hình hàng đợi</button><button type="button" onClick={callNextQueue}><Zap size={16} />Gọi số tiếp theo</button><button type="button" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={16} />Làm mới</button></>}
      />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <Filters filters={filters} setFilters={setFilters} />
      <KpiStrip items={[
        { label: 'Đã tiếp nhận', value: summary.checked_in, detail: 'Trong ca đang xem', icon: Users, tone: 'blue' },
        { label: 'Chờ điều dưỡng', value: summary.waiting_nurse, detail: 'Cần nhận xử lý', icon: Stethoscope, tone: 'teal' },
        { label: 'Đang tiếp nhận', value: summary.nurse_in_progress, detail: 'Đã có điều dưỡng', icon: UserCheck, tone: 'indigo' },
        { label: 'Chờ phân loại', value: summary.triage_waiting, detail: `${summary.triage_in_progress || 0} đang phân loại`, icon: ClipboardCheck, tone: 'violet' },
        { label: 'Chưa sinh hiệu', value: summary.vital_pending, detail: 'Ưu tiên người chờ lâu', icon: HeartPulse, tone: 'cyan' },
        { label: 'Quá SLA', value: summary.sla_breached, detail: 'Cần điều phối lại', icon: Clock3, tone: 'amber' },
        { label: 'Bất thường', value: summary.abnormal_vitals, detail: 'Cần xác nhận', icon: ShieldAlert, tone: 'red' },
        { label: 'Sẵn sàng', value: summary.ready_for_doctor, detail: 'Có thể gọi vào phòng', icon: CheckCircle2, tone: 'green' },
      ]} />

      <section className="nurse-intake-command-grid">
        <main className="nurse-operation-table-card">
          <QueueTable items={items} selectedId={queueId(selected)} onSelect={selectPatient} onAction={run} />
        </main>
        <aside className="nurse-intake-sidefeed">
          <section>
            <h2><Bell size={16} />Sự kiện thời gian thực</h2>
            {listOf(data.activity_feed).slice(0, 8).map((event) => <article key={textValue(event.id || event.created_at, event.title)}><strong>{textValue(event.title, 'Sự kiện thời gian thực')}</strong><span>{textValue(event.message, '')}</span><small>{formatTime(event.created_at)}</small></article>)}
          </section>
          <section>
            <h2><ShieldAlert size={16} />Nguy cơ lâm sàng</h2>
            {listOf(data.priority_alerts).slice(0, 5).map((alert) => <article key={textValue(alert.id || alert.source_id, patientName(alert))}><strong>{patientName(alert)}</strong><span>{textValue(alert.message, 'Cần theo dõi')}</span><small>{priorityLabels[textValue(alert.severity, '')] || textValue(alert.severity, '')}</small></article>)}
          </section>
        </aside>
      </section>

      <PatientContextDrawer item={drawerOpen ? active : null} onClose={closeDrawer} onAction={run} />
      {confirmDialog}
    </section>
  );
}

export function WaitingNursePage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', status: 'all', type: 'all', search: '' });
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useNursingData(() => nurseOperationsApi.getIntakeWorklist(queryParams(filters)), {
    ...emptyWorklist,
  }, [filters.date, filters.shift, filters.priority, filters.status, refresh]);
  const { notice, run, confirmDialog } = useActionRunner(setRefresh);
  const lanes = data.lanes || {};
  const firstWaiting = listOf(lanes.waiting_nurse)[0] || listOf(lanes.vital_pending)[0] || listOf(lanes.triage_pending)[0];

  async function bulkClaimWaiting() {
    const targets = listOf(lanes.waiting_nurse).slice(0, 8);
    if (!targets.length) {
      notifyNurse({ title: 'Nhận hàng loạt', message: 'Không có bệnh nhân chờ điều dưỡng trong bộ lọc hiện tại.' });
      return;
    }
    if (!confirmNurseAction({ title: 'Nhận hàng loạt?', message: `Nhận ${targets.length} bệnh nhân đầu tiên trong danh sách chờ điều dưỡng.` })) return;
    for (const item of targets) await run('claim', item);
  }

  return (
    <section className="nurse-intake-page">
      <IntakeHeader eyebrow="Danh sách việc điều dưỡng" title="Chờ điều dưỡng" description="Nhận bệnh nhân, xác minh danh tính, kiểm tra dị ứng, ghi chú lý do khám và quyết định có cần sinh hiệu hoặc phân loại." meta={data.meta} isDemo={isDemo} loading={loading} actions={<><button type="button" onClick={bulkClaimWaiting}><UserCheck size={16} />Nhận hàng loạt</button><button type="button" onClick={() => {
        const note = promptNurseText({ title: 'Ghi chú tiếp nhận', message: patientName(firstWaiting), defaultValue: 'Đã rà soát thông tin tiếp nhận điều dưỡng.' });
        if (note) run('note', selected || firstWaiting, { note });
      }}><FileText size={16} />Tạo ghi chú</button><button type="button" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={16} />Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <Filters filters={filters} setFilters={setFilters} />
      <KpiStrip items={[
        { label: 'Chưa nhận', value: lanes.waiting_nurse?.length, detail: 'Đợi điều dưỡng nhận', icon: Users, tone: 'blue' },
        { label: 'Đang tiếp nhận', value: lanes.in_progress?.length, detail: 'Có điều dưỡng phụ trách', icon: UserCheck, tone: 'teal' },
        { label: 'Cần sinh hiệu', value: lanes.vital_pending?.length, detail: 'Đo trước khi khám', icon: HeartPulse, tone: 'cyan' },
        { label: 'Cần phân loại', value: lanes.triage_pending?.length, detail: 'Phân loại nguy cơ', icon: ClipboardCheck, tone: 'violet' },
        { label: 'Sẵn sàng', value: lanes.ready_for_doctor?.length, detail: 'Chuyển bước bác sĩ', icon: CheckCircle2, tone: 'green' },
      ]} />
      <section className="nurse-intake-kanban">
        {[
          ['waiting_nurse', 'Chưa nhận', Users],
          ['in_progress', 'Đang tiếp nhận', UserCheck],
          ['vital_pending', 'Cần đo sinh hiệu', HeartPulse],
          ['triage_pending', 'Cần phân loại', ClipboardCheck],
          ['ready_for_doctor', 'Sẵn sàng chuyển bước', CheckCircle2],
        ].map(([key, title, Icon]) => (
          <section key={key} className={`nurse-intake-lane nurse-intake-lane--${key}`}>
            <header><strong><Icon size={16} />{title}</strong><span>{listOf(lanes[key]).length}</span></header>
            {listOf(lanes[key]).slice(0, 12).map((item) => <PatientMiniCard key={queueId(item)} item={item} onSelect={setSelected} onAction={run} />)}
          </section>
        ))}
      </section>
      <PatientContextDrawer item={selected} onClose={() => setSelected(null)} onAction={run} />
      {confirmDialog}
    </section>
  );
}

function PatientMiniCard({ item, onSelect, onAction }) {
  const row = safeItem(item);
  return (
    <article className={`nurse-intake-card nurse-intake-card--${row.queue_type || row.priority || 'normal'}`}>
      <button type="button" onClick={() => onSelect(item)}>
        <header><strong>{queueNumber(item)} · {patientName(item)}</strong><PriorityBadge item={item} /></header>
        <p>{reasonText(item)}</p>
        <dl><div><dt>Chờ</dt><dd>{waitText(row.waiting_minutes)}</dd></div><div><dt>Bác sĩ</dt><dd>{doctorName(item)}</dd></div></dl>
        <ClinicalRiskStrip item={item} />
      </button>
      <footer>
        <button type="button" onClick={() => onAction('claim', item)}>Nhận</button>
        <button type="button" onClick={() => onAction('ready', item)}>Sẵn sàng</button>
      </footer>
    </article>
  );
}

export function WaitingTriagePage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', status: 'all', type: 'all', search: '' });
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useNursingData(() => nurseOperationsApi.getTriageWorklist(queryParams(filters)), emptyTriageWorklist, [filters.date, filters.shift, filters.priority, filters.status, refresh]);
  const { notice, run, confirmDialog } = useActionRunner(setRefresh);
  const items = filterQueueItems(data.items, filters);
  const active = selected || items[0];

  function selectPatient(item) {
    setSelected(item);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setSelected(null);
    setDrawerOpen(false);
  }

  return (
    <section className="nurse-intake-page">
      <IntakeHeader eyebrow="Phân loại nguy cơ lâm sàng" title="Chờ phân loại" description="Phân loại nguy cơ, theo dõi SLA phân loại, xem sinh hiệu mới nhất và quyết định ưu tiên lâm sàng." meta={data.meta} isDemo={isDemo} loading={loading} actions={<><button type="button" onClick={() => active ? run('triage', active) : goToNursePath('/nurse/reception-triage/create-triage', 'Tạo phiếu phân loại')}><ClipboardCheck size={16} />Tạo phiếu</button><button type="button" onClick={() => run('notify_doctor', active, { message: 'Bệnh nhân chờ phân loại có nguy cơ cần bác sĩ xem lại.' })}><ShieldAlert size={16} />Báo khẩn</button><button type="button" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={16} />Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <Filters filters={filters} setFilters={setFilters} />
      <KpiStrip items={[
        { label: 'Chờ phân loại', value: data.summary?.pending, detail: 'Cần phân loại', icon: Clock3, tone: 'violet' },
        { label: 'Đang phân loại', value: data.summary?.in_progress, detail: 'Điều dưỡng đang xử lý', icon: ClipboardCheck, tone: 'teal' },
        { label: 'Ưu tiên cao', value: data.summary?.high_priority, detail: 'Đỏ/cam/vàng', icon: ShieldAlert, tone: 'red' },
        { label: 'Đã phân loại', value: data.summary?.completed, detail: 'Trong ngày', icon: CheckCircle2, tone: 'green' },
      ]} />
      <section className="nurse-intake-command-grid nurse-intake-command-grid--wide">
        <main className="nurse-operation-table-card">
          <QueueTable items={items} selectedId={queueId(selected)} onSelect={selectPatient} onAction={run} />
        </main>
        <aside className="nurse-triage-risk-panel">
          <h2><Zap size={16} />Dải nguy cơ</h2>
          {items.slice(0, 6).map((item) => <PatientMiniCard key={queueId(item)} item={item} onSelect={selectPatient} onAction={run} />)}
        </aside>
      </section>
      <PatientContextDrawer item={drawerOpen ? active : null} onClose={closeDrawer} onAction={run} />
      {confirmDialog}
    </section>
  );
}

export function CreateTriagePage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', status: 'all', type: 'all', search: '' });
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useNursingData(() => nurseOperationsApi.getTriageWorklist(queryParams(filters)), emptyTriageWorklist, [filters.date, filters.shift, filters.priority, filters.status, refresh]);
  const [selected, setSelected] = useState(null);
  const { confirmAction, confirmDialog } = useIntakeActionConfirm();
  const [draftTriageId, setDraftTriageId] = useState('');
  const [form, setForm] = useState({
    chief_complaint: '',
    symptoms: '',
    pain_score: 0,
    consciousness: 'alert',
    breathing_status: 'normal',
    circulation_status: 'stable',
    mobility_status: 'walked',
    acuity_level: 'green',
    recommended_action: 'normal_queue',
    note: '',
  });
  const [notice, setNotice] = useState('');
  const requestedQueueId = selectedQueueIdFromUrl();
  const active = selected || listOf(data.items).find((item) => queueId(item) === requestedQueueId) || listOf(data.items)[0] || null;

  useEffect(() => {
    if (!requestedQueueId || selected) return;
    const match = listOf(data.items).find((item) => queueId(item) === requestedQueueId);
    if (match) setSelected(match);
  }, [data.items, requestedQueueId, selected]);

  useEffect(() => {
    setDraftTriageId(selected?.triage_id || '');
  }, [selected]);

  function buildTriagePayload(status = 'completed') {
    const priority = ['red', 'orange'].includes(form.acuity_level) ? 'critical' : form.acuity_level === 'yellow' ? 'high' : 'medium';
    return {
      patient_id: patientId(active),
      queue_ticket_id: queueId(active),
      encounter_id: active?.encounter_id || undefined,
      appointment_id: active?.appointment_id || undefined,
      department_id: active?.department_id || undefined,
      doctor_id: active?.doctor_id || undefined,
      status,
      ...form,
      priority,
      triage_level: form.acuity_level === 'red' ? 'emergency' : form.acuity_level === 'orange' ? 'urgent' : form.acuity_level === 'yellow' ? 'semi_urgent' : 'non_urgent',
      red_flags: redFlagList(form),
    };
  }

  async function triageQuickAction(action) {
    const id = queueId(active);
    if (action === 'vitals') {
      window.location.assign('/nurse/vitals-records/entry');
      return;
    }
    if (!id) {
      notifyNurse({ tone: 'warning', title: 'Phân loại', message: 'Chưa có queue_ticket_id hợp lệ.' });
      return;
    }
    await runNurseAction({
      label: action === 'notify_doctor' ? 'Báo bác sĩ' : 'Chuyển tuyến',
      confirm: { title: action === 'notify_doctor' ? 'Báo bác sĩ?' : 'Chuyển tuyến?', message: `${queueNumber(active)} - ${patientName(active)}` },
      run: () => (action === 'notify_doctor'
        ? nurseOperationsApi.notifyDoctor(id, { message: 'Bệnh nhân phân loại cần bác sĩ xem lại.' })
        : nurseOperationsApi.transferQueue(id, { reason: 'Chuyển tuyến từ màn phân loại điều dưỡng.' })),
      successMessage: 'Đã gửi thao tác phân loại.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
  }

  async function saveTriageDraft() {
    if (!patientId(active)) {
      setNotice('Chưa chọn bệnh nhân có patient_id hợp lệ.');
      return;
    }
    try {
      const payload = buildTriagePayload('draft');
      const triageId = draftTriageId || active?.triage_id;
      const saved = triageId
        ? await nurseOperationsApi.updateTriage(triageId, payload)
        : await nurseOperationsApi.createTriage(payload);
      setDraftTriageId(saved?.triage_id || saved?._id || saved?.id || triageId || '');
      setNotice('Đã lưu nháp phiếu phân loại vào database.');
      notifyNurse({ tone: 'success', title: 'Lưu nháp phân loại', message: 'Phiếu nháp đã được đồng bộ.' });
      setRefresh((value) => value + 1);
    } catch (saveError) {
      setNotice(saveError?.message || 'Không thể lưu nháp phiếu phân loại.');
      notifyNurse({ tone: 'danger', title: 'Lưu nháp phân loại', message: saveError?.message || 'Không thể lưu nháp phiếu phân loại.' });
    }
  }

  async function submitTriage(event) {
    event.preventDefault();
    if (!patientId(active)) {
      setNotice('Chưa chọn bệnh nhân có patient_id hợp lệ.');
      return;
    }
    if (!confirmNurseAction({ title: 'Hoàn tất phiếu phân loại?', message: `${patientName(active)} - mức ${acuityLabels[form.acuity_level]}` })) return;
    try {
      const triageId = draftTriageId || active?.triage_id;
      const payload = triageId
        ? await nurseOperationsApi.completeTriage(triageId, buildTriagePayload('completed'))
        : await nurseOperationsApi.createTriage(buildTriagePayload('completed'));
      if (queueId(active) && ['red', 'orange', 'yellow'].includes(form.acuity_level)) {
        await nurseOperationsApi.reorderPriority(queueId(active), { queue_type: 'priority', priority_reason: form.chief_complaint || form.note });
      }
      setNotice(`Đã tạo phiếu phân loại ${payload?.id || ''}`.trim());
      notifyNurse({ tone: 'success', title: 'Phân loại', message: 'Đã tạo phiếu phân loại và cập nhật ưu tiên nếu cần.' });
      setRefresh((value) => value + 1);
    } catch (submitError) {
      setNotice(submitError?.message || 'Không thể tạo phiếu phân loại.');
      notifyNurse({ tone: 'danger', title: 'Phân loại', message: submitError?.message || 'Không thể tạo phiếu phân loại.' });
    }
  }

  return (
    <section className="nurse-intake-page">
      <IntakeHeader eyebrow="Đánh giá phân loại" title="Tạo phiếu phân loại" description="Giao diện phân loại lâm sàng với banner bệnh nhân, thanh nguy cơ, biểu mẫu phân loại và bảng quyết định trong một màn hình." meta={data.meta} isDemo={isDemo} loading={loading} actions={<><button type="button" onClick={() => triageQuickAction('vitals')}><HeartPulse size={16} />Nhập sinh hiệu</button><button type="button" onClick={() => {
        const note = promptNurseText({ title: 'Ghi chú phân loại', message: patientName(active), defaultValue: form.note });
        if (note !== null) setForm((current) => ({ ...current, note }));
      }}><FileText size={16} />Ghi chú</button><button type="button" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={16} />Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <Filters filters={filters} setFilters={setFilters} />
      <section className="nurse-triage-builder">
        <aside className="nurse-triage-patient-list">
          <h2><Users size={16} />Danh sách chờ</h2>
          {listOf(data.items).slice(0, 12).map((item) => <PatientMiniCard key={queueId(item)} item={item} onSelect={setSelected} onAction={async (action, row) => {
            setSelected(row);
            if (action === 'claim') {
              await runNurseAction({
                label: 'Nhận bệnh nhân',
                run: () => nurseOperationsApi.claimIntake(queueId(row)),
                successMessage: 'Đã nhận bệnh nhân để phân loại.',
                onSuccess: () => setRefresh((value) => value + 1),
              });
              return;
            }
            if (action === 'ready') {
              const confirmed = await confirmAction({ action: 'ready', item: row });
              if (!confirmed) return;
              await runNurseAction({
                label: 'Sẵn sàng gặp bác sĩ',
                run: () => nurseOperationsApi.markReadyForDoctor(queueId(row)),
                successMessage: 'Đã đánh dấu bệnh nhân sẵn sàng gặp bác sĩ.',
                onSuccess: () => setRefresh((value) => value + 1),
              });
              return;
            }
            notifyNurse({ title: 'Đã chọn bệnh nhân', message: patientName(row) });
          }} />)}
        </aside>
        <form className="nurse-triage-form" onSubmit={submitTriage}>
          <header>
            <strong>{patientName(active)} · {patientCode(active)} · {queueNumber(active)}</strong>
            <ClinicalRiskStrip item={active} />
          </header>
          <div className="nurse-triage-form-grid">
            <label><span>Lý do điều dưỡng xác nhận</span><input value={form.chief_complaint} onChange={(event) => setForm((current) => ({ ...current, chief_complaint: event.target.value }))} placeholder="VD: đau ngực, khó thở" /></label>
            <label><span>Triệu chứng chính</span><input value={form.symptoms} onChange={(event) => setForm((current) => ({ ...current, symptoms: event.target.value }))} placeholder="Mô tả triệu chứng" /></label>
            <label><span>Mức đau</span><input type="number" min="0" max="10" value={form.pain_score} onChange={(event) => setForm((current) => ({ ...current, pain_score: Number(event.target.value) }))} /></label>
            <label><span>Ý thức</span><select value={form.consciousness} onChange={(event) => setForm((current) => ({ ...current, consciousness: event.target.value }))}><option value="alert">Tỉnh</option><option value="voice">Đáp ứng lời gọi</option><option value="pain">Đáp ứng đau</option><option value="unresponsive">Không đáp ứng</option></select></label>
            <label><span>Hô hấp</span><select value={form.breathing_status} onChange={(event) => setForm((current) => ({ ...current, breathing_status: event.target.value }))}><option value="normal">Bình thường</option><option value="distress">Khó thở</option><option value="severe_distress">Khó thở nặng</option></select></label>
            <label><span>Tuần hoàn</span><select value={form.circulation_status} onChange={(event) => setForm((current) => ({ ...current, circulation_status: event.target.value }))}><option value="stable">Ổn định</option><option value="unstable">Không ổn định</option></select></label>
            <label><span>Di chuyển</span><select value={form.mobility_status} onChange={(event) => setForm((current) => ({ ...current, mobility_status: event.target.value }))}><option value="walked">Tự đi</option><option value="wheelchair">Xe lăn</option><option value="stretcher">Cáng</option></select></label>
            <label><span>Quyết định</span><select value={form.recommended_action} onChange={(event) => setForm((current) => ({ ...current, recommended_action: event.target.value }))}><option value="normal_queue">Hàng đợi thường</option><option value="priority_queue">Tăng ưu tiên</option><option value="transfer_department">Chuyển khoa</option><option value="send_emergency">Chuyển cấp cứu</option><option value="direct_doctor">Báo bác sĩ ngay</option><option value="observe">Theo dõi thêm</option></select></label>
          </div>
          <section className="nurse-acuity-picker">
            {['red', 'orange', 'yellow', 'green', 'blue'].map((level) => <button key={level} type="button" className={form.acuity_level === level ? 'is-active' : ''} onClick={() => setForm((current) => ({ ...current, acuity_level: level }))}><strong>{acuityLabels[level]}</strong><span>{level === 'red' ? 'Cấp cứu ngay' : level === 'orange' ? 'Rất khẩn' : level === 'yellow' ? 'Ưu tiên' : level === 'green' ? 'Thường' : 'Không cấp thiết'}</span></button>)}
          </section>
          <label className="nurse-triage-note"><span>Ghi chú điều dưỡng</span><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={4} /></label>
          <footer><button type="submit"><CheckCircle2 size={16} />Hoàn tất phân loại</button><button type="button" onClick={saveTriageDraft}>Lưu nháp</button></footer>
        </form>
        <aside className="nurse-triage-decision">
          <h2><ShieldAlert size={16} />Bảng quyết định</h2>
          <strong>{acuityLabels[form.acuity_level]}</strong>
          <span>{form.recommended_action}</span>
          <p>{form.acuity_level === 'red' || form.recommended_action === 'send_emergency' ? 'Cần chuyển cấp cứu hoặc báo bác sĩ ngay.' : 'Có thể tiếp tục điều phối theo hàng đợi phòng khám.'}</p>
          <div className="nurse-row-actions"><button type="button" onClick={() => triageQuickAction('notify_doctor')}>Báo bác sĩ</button><button type="button" onClick={() => triageQuickAction('vitals')}>Yêu cầu đo lại</button><button type="button" onClick={() => triageQuickAction('transfer')}>Chuyển tuyến</button></div>
        </aside>
      </section>
      {confirmDialog}
    </section>
  );
}

function redFlagList(form) {
  return [
    form.breathing_status !== 'normal' ? 'breathing_distress' : null,
    form.circulation_status === 'unstable' ? 'unstable_circulation' : null,
    form.consciousness !== 'alert' ? 'altered_consciousness' : null,
    Number(form.pain_score) >= 8 ? 'severe_pain' : null,
  ].filter(Boolean);
}

export function PriorityTransferPage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', status: 'all', type: 'all', search: '' });
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useIntakePageData(filters, refresh);
  const { notice, run, confirmDialog } = useActionRunner(setRefresh);
  const items = filterQueueItems(data.intake?.checked_in_items || [], filters)
    .filter((item) => {
      const row = safeItem(item);
      return row.queue_type !== 'normal' || row.waiting_minutes >= 15 || ['triage_pending', 'vital_pending'].includes(row.nursing_stage);
    });
  const active = selected || items[0];

  function transferSelected(item = active) {
    const targetDepartmentId = promptNurseText({ title: 'Chuyển tuyến/khoa', message: 'Nhập department_id đích hoặc để trống để giữ khoa hiện tại.', defaultValue: item?.department_id || '' });
    if (targetDepartmentId === null) return;
    const targetDoctorId = promptNurseText({ title: 'Bác sĩ đích', message: 'Nhập doctor_id đích hoặc để trống để giữ bác sĩ hiện tại.', defaultValue: item?.doctor_id || '' });
    if (targetDoctorId === null) return;
    run('transfer', item, {
      department_id: targetDepartmentId || undefined,
      doctor_id: targetDoctorId || undefined,
      reason: 'Điều dưỡng yêu cầu chuyển tuyến/khoa.',
    });
  }

  return (
    <section className="nurse-intake-page">
      <IntakeHeader eyebrow="Điều phối ưu tiên và chuyển tuyến" title="Ưu tiên / chuyển tuyến" description="Điều phối hàng đợi cần tăng ưu tiên, đổi bác sĩ/khoa, xử lý SLA và cảnh báo bệnh nhân có nguy cơ." meta={data.meta} isDemo={isDemo} loading={loading} actions={<><button type="button" onClick={() => transferSelected()}><ArrowRightLeft size={16} />Chuyển tuyến</button><button type="button" onClick={() => run('priority', active, { queue_type: 'priority', priority_reason: 'Điều dưỡng tăng ưu tiên' })}><ShieldAlert size={16} />Tăng ưu tiên</button><button type="button" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={16} />Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <Filters filters={filters} setFilters={setFilters} />
      <section className="nurse-transfer-layout">
        <main className="nurse-transfer-list">
          {items.map((item) => <article key={queueId(item)} className="nurse-transfer-card" onClick={() => setSelected(item)}><header><strong>{queueNumber(item)} · {patientName(item)}</strong><PriorityBadge item={item} /></header><p>{reasonText(item, 'Cần điều phối')}</p><dl><div><dt>Chờ</dt><dd>{waitText(item.waiting_minutes)}</dd></div><div><dt>Khoa</dt><dd>{departmentName(item)}</dd></div><div><dt>Bác sĩ</dt><dd>{doctorName(item)}</dd></div></dl><footer><button type="button" onClick={(event) => { event.stopPropagation(); run('priority', item, { queue_type: 'priority', priority_reason: 'Điều dưỡng tăng ưu tiên' }); }}>Tăng ưu tiên</button><button type="button" onClick={(event) => { event.stopPropagation(); setSelected(item); transferSelected(item); }}>Chuyển</button></footer></article>)}
        </main>
        <aside className="nurse-capacity-panel">
          <h2><Monitor size={16} />Sức chứa</h2>
          <span><strong>{data.queue?.waiting || 0}</strong>Đang chờ</span>
          <span><strong>{data.queue?.called || 0}</strong>Đã gọi</span>
          <span><strong>{data.queue?.in_service || 0}</strong>Đang phục vụ</span>
          <span><strong>{data.queue?.skipped || 0}</strong>Bỏ qua</span>
          <p>Hàng đợi có lịch hẹn cần kiểm tra lịch trước khi chuyển bác sĩ hoặc khoa.</p>
        </aside>
      </section>
      <PatientContextDrawer item={selected} onClose={() => setSelected(null)} onAction={run} />
      {confirmDialog}
    </section>
  );
}

export function ReadyForDoctorPage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', status: 'all', type: 'all', search: '' });
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useNursingData(() => nurseOperationsApi.getReadyForDoctor(queryParams(filters)), emptyReadyForDoctor, [filters.date, filters.shift, filters.priority, filters.status, refresh]);
  const { notice, run, confirmDialog } = useActionRunner(setRefresh);
  const items = filterQueueItems(data.items, filters);
  const active = selected || items[0];

  return (
    <section className="nurse-intake-page">
      <IntakeHeader eyebrow="Sẵn sàng gặp bác sĩ" title="Sẵn sàng gặp bác sĩ" description="Danh sách bệnh nhân đã hoàn tất tiếp nhận, phân loại hoặc sinh hiệu và có thể gọi vào phòng khám." meta={data.meta} isDemo={isDemo} loading={loading} actions={<><button type="button" onClick={() => run('call', active)}><PhoneCall size={16} />Gọi vào phòng</button><button type="button" onClick={() => run('notify_doctor', active, { message: 'Bệnh nhân đã sẵn sàng gặp bác sĩ.' })}><Send size={16} />Báo bác sĩ</button><button type="button" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={16} />Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <Filters filters={filters} setFilters={setFilters} />
      <KpiStrip items={[
        { label: 'Sẵn sàng', value: data.summary?.total, detail: 'Có thể gọi', icon: CheckCircle2, tone: 'green' },
        { label: 'Ưu tiên/đặc biệt', value: data.summary?.priority, detail: 'Cần gọi trước', icon: ShieldAlert, tone: 'red' },
        { label: 'Đã gọi', value: data.summary?.called, detail: 'Đang vào phòng', icon: Bell, tone: 'violet' },
        { label: 'Đang phục vụ', value: data.summary?.in_service, detail: 'Bác sĩ đang khám', icon: Stethoscope, tone: 'teal' },
        { label: 'Chờ sau sẵn sàng', value: data.summary?.waiting_after_ready, detail: 'Cần nhắc bác sĩ', icon: Clock3, tone: 'amber' },
      ]} />
      <section className="nurse-ready-layout">
        <main className="nurse-operation-table-card">
          <QueueTable items={items} selectedId={queueId(selected)} onSelect={setSelected} onAction={run} mode="ready" />
        </main>
        <aside className="nurse-ready-checklist">
          <h2><ClipboardCheck size={16} />Bảng kiểm sẵn sàng</h2>
          {['Đã xác minh danh tính', 'Đã xác nhận lý do khám', 'Đã kiểm tra dị ứng', 'Đã ghi nhận bệnh nền', 'Đã đo sinh hiệu', 'Đã phân loại', 'Đã phân đúng bác sĩ/khoa'].map((item) => <span key={item}><CheckCircle2 size={15} />{item}</span>)}
        </aside>
      </section>
      <PatientContextDrawer item={selected} onClose={() => setSelected(null)} onAction={run} />
      {confirmDialog}
    </section>
  );
}
