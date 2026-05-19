import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bed,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  FlaskConical,
  HeartPulse,
  Loader2,
  MessageSquarePlus,
  Monitor,
  Pill,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { nurseDashboardApi } from './nurseApi';

function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromPreset(preset) {
  const now = new Date();
  if (preset === 'yesterday') {
    now.setDate(now.getDate() - 1);
  }
  return toLocalDateKey(now);
}

const DEMO_DASHBOARD = {
  meta: {
    date: toLocalDateKey(),
    department_name: 'Khoa Khám tổng quát',
    department_code: 'KKB',
    shift: 'morning',
    nurse_on_shift: 8,
    generated_at: new Date().toISOString(),
    realtime_rooms: ['department:demo', 'nursing:department:demo', 'role:nurse'],
  },
  kpis: {
    checked_in: 36,
    waiting_nurse: 12,
    triage_pending: 5,
    vital_pending: 9,
    ready_for_doctor: 7,
    nursing_sla_waiting: 4,
    abnormal_vitals: 3,
    tasks_overdue: 4,
    preparation_pending: 7,
    open_emergency_cases: 2,
    active_inpatients: 18,
    medication_due_now: 6,
  },
  priority_alerts: [
    {
      id: 'alert-1',
      type: 'abnormal_vital',
      severity: 'critical',
      patient_name: 'Nguyễn Văn A',
      patient_code: 'BN0001',
      message: 'SpO2 88%',
      created_at: new Date(Date.now() - 3 * 60000).toISOString(),
      waiting_minutes: 3,
      actions: ['notify_doctor', 'acknowledge', 'open_patient'],
    },
    {
      id: 'alert-2',
      type: 'long_waiting',
      severity: 'high',
      patient_name: 'Trần Thị B',
      patient_code: 'BN0002',
      message: 'Chờ phân loại 24 phút · Hàng đợi A014',
      created_at: new Date(Date.now() - 24 * 60000).toISOString(),
      waiting_minutes: 24,
      actions: ['create_triage', 'record_vital', 'open_patient'],
    },
    {
      id: 'alert-3',
      type: 'emergency',
      severity: 'high',
      patient_name: 'Lê Văn C',
      patient_code: 'BN0003',
      message: 'Ca SOS mới tại sảnh A',
      created_at: new Date(Date.now() - 2 * 60000).toISOString(),
      waiting_minutes: 2,
      actions: ['acknowledge_emergency', 'open_case'],
    },
    {
      id: 'alert-4',
      type: 'task_overdue',
      severity: 'medium',
      patient_name: 'Phạm Thị D',
      patient_code: 'BN0004',
      message: 'Việc đo sinh hiệu quá hạn 12 phút',
      created_at: new Date(Date.now() - 12 * 60000).toISOString(),
      waiting_minutes: 12,
      actions: ['record_vital', 'assign_to_me'],
    },
  ],
  queue: {
    waiting: 12,
    called: 4,
    recalled: 1,
    in_service: 3,
    skipped: 1,
    completed: 22,
    no_show: 2,
    board: {
      waiting: [
        { queue_number: 'A012', patient_name: 'Nguyễn Văn A', waiting_minutes: 18, queue_type: 'normal', status: 'waiting' },
        { queue_number: 'A013', patient_name: 'Trần Thị B', waiting_minutes: 12, queue_type: 'priority', status: 'waiting' },
      ],
      called: [
        { queue_number: 'A010', patient_name: 'Lê Văn C', waiting_minutes: 2, status: 'called' },
      ],
      in_service: [
        { queue_number: 'A009', patient_name: 'Phạm Thị D', waiting_minutes: 0, status: 'in_service' },
      ],
      skipped: [
        { queue_number: 'A008', patient_name: 'Hoàng Văn E', waiting_minutes: 31, status: 'skipped' },
      ],
    },
    longest_waiting: [
      { queue_number: 'A008', patient_name: 'Hoàng Văn E', waiting_minutes: 31, status: 'skipped' },
      { queue_number: 'A012', patient_name: 'Nguyễn Văn A', waiting_minutes: 18, status: 'waiting' },
    ],
  },
  worklist: {
    summary: { total: 28, critical: 2, high: 6, overdue: 4 },
    items: [
      {
        id: 'w1',
        type: 'abnormal_vital',
        priority: 'critical',
        patient_code: 'BN0001',
        patient_name: 'Nguyễn Văn A',
        age: 45,
        gender: 'male',
        source_type: 'vital_sign',
        reason: 'SpO2 88% · cần báo bác sĩ',
        status: 'needs_attention',
        waiting_since: new Date(Date.now() - 3 * 60000).toISOString(),
        overdue_minutes: 3,
        location: 'Phòng Nội 01',
        assigned_to_name: 'Điều dưỡng Mai',
        metadata: { queue_number: 'A012' },
        actions: ['notify_doctor', 'acknowledge', 'open_patient'],
      },
      {
        id: 'w2',
        type: 'vital_pending',
        priority: 'high',
        patient_code: 'BN0002',
        patient_name: 'Trần Thị B',
        age: 31,
        gender: 'female',
        source_type: 'queue',
        reason: 'Đã tiếp nhận, chưa đo sinh hiệu',
        status: 'pending',
        waiting_since: new Date(Date.now() - 18 * 60000).toISOString(),
        overdue_minutes: 18,
        location: 'Hàng đợi A013',
        assigned_to_name: null,
        metadata: { queue_number: 'A013' },
        actions: ['record_vital', 'create_nursing_note', 'assign_to_me'],
      },
      {
        id: 'w3',
        type: 'emergency',
        priority: 'high',
        patient_code: 'BN0003',
        patient_name: 'Lê Văn C',
        age: 58,
        gender: 'male',
        source_type: 'emergency_case',
        reason: 'SOS mới · đau ngực',
        status: 'created',
        waiting_since: new Date(Date.now() - 2 * 60000).toISOString(),
        overdue_minutes: 2,
        location: 'Sảnh A',
        assigned_to_name: 'Đội phản ứng',
        metadata: { case_code: 'SOS-20260519-001' },
        actions: ['acknowledge_emergency', 'open_case'],
      },
      {
        id: 'w4',
        type: 'preparation_pending',
        priority: 'medium',
        patient_code: 'BN0004',
        patient_name: 'Phạm Thị D',
        age: 64,
        gender: 'female',
        source_type: 'order',
        reason: 'MRI · cần kiểm tra chống chỉ định',
        status: 'ordered',
        waiting_since: new Date(Date.now() - 10 * 60000).toISOString(),
        location: 'CĐHA',
        assigned_to_name: null,
        metadata: { order_no: 'ORD-0182' },
        actions: ['open_checklist', 'open_patient'],
      },
    ],
  },
  vitals: {
    pending: 9,
    recorded_today: 31,
    abnormal: 3,
    entered_in_error: 1,
    pending_items: [
      { patient_name: 'Trần Thị B', queue_number: 'A013', waiting_minutes: 18 },
      { patient_name: 'Võ Văn E', queue_number: 'A019', waiting_minutes: 13 },
    ],
    abnormal_items: [
      { patient_name: 'Nguyễn Văn A', message: 'SpO2 88%', severity: 'critical', recorded_at: new Date().toISOString() },
      { patient_name: 'Đỗ Thị F', message: 'HA 180/100', severity: 'high', recorded_at: new Date().toISOString() },
    ],
  },
  triage: {
    pending: 5,
    in_progress: 2,
    completed: 18,
    high_priority: 1,
    pending_items: [
      { patient_name: 'Nguyễn Văn A', queue_number: 'A012', reason: 'Đau ngực', waiting_minutes: 8 },
      { patient_name: 'Trần Thị B', queue_number: 'A013', reason: 'Sốt cao', waiting_minutes: 12 },
    ],
  },
  tasks: {
    assigned_to_me: 8,
    due_today: 28,
    overdue: 4,
    completed: 16,
    items: [
      { id: 't1', title: 'Đo sinh hiệu cho Nguyễn Văn A', status: 'overdue', priority: 'high', due_at: new Date().toISOString(), overdue_minutes: 12 },
      { id: 't2', title: 'Chuẩn bị xét nghiệm máu cho Trần Thị B', status: 'todo', priority: 'medium', due_at: new Date().toISOString() },
      { id: 't3', title: 'Theo dõi sau dùng thuốc cho Lê Văn C', status: 'in_progress', priority: 'medium', due_at: new Date().toISOString() },
    ],
  },
  service_preparation: {
    pending: 7,
    lab: 3,
    imaging: 2,
    procedure: 2,
    checklist_pending: 4,
    items: [
      { patient_name: 'Nguyễn Văn A', order_type: 'lab', reason: 'Xét nghiệm máu · cần lấy mẫu', status: 'pending', progress: { checked: 2, total: 5, percent: 40 } },
      { patient_name: 'Trần Thị B', order_type: 'imaging', reason: 'MRI · kiểm tra chống chỉ định', status: 'in_progress', progress: { checked: 1, total: 4, percent: 25 } },
      { patient_name: 'Lê Văn C', order_type: 'procedure', reason: 'Chờ ký cam kết thủ thuật', status: 'pending', progress: { checked: 0, total: 4, percent: 0 } },
    ],
  },
  emergency: {
    open: 2,
    new: 1,
    acknowledged: 1,
    triaged: 0,
    dispatched: 0,
    sla_breached: 0,
    items: [
      { case_code: 'SOS-20260519-001', patient_id: { full_name: 'Lê Văn C' }, symptoms: 'Đau ngực', location_text: 'Sảnh A', priority: 'urgent', created_at: new Date(Date.now() - 2 * 60000).toISOString() },
    ],
  },
  inpatient: {
    active_admissions: 18,
    pending_bed_assignment: 2,
    medication_due_now: 6,
    medication_overdue: 1,
    inpatient_tasks_overdue: 3,
    admissions: [
      { admission_no: 'IP-1001', patient: { patient_name: 'Bùi Văn H' }, bed: { room_name: 'P201', bed_number: 'G02' }, status: 'admitted' },
    ],
  },
  notifications: { unread: 5 },
  activity_feed: [
    { id: 'a1', type: 'queue', title: 'Hàng đợi A012 được gọi', message: 'Nguyễn Văn A · Đã gọi', created_at: new Date(Date.now() - 1 * 60000).toISOString(), priority: 'normal' },
    { id: 'a2', type: 'vital', title: 'Sinh hiệu bất thường', message: 'Nguyễn Văn A · SpO2 88%', created_at: new Date(Date.now() - 3 * 60000).toISOString(), priority: 'critical' },
    { id: 'a3', type: 'emergency', title: 'Ca SOS mới', message: 'Lê Văn C · Sảnh A', created_at: new Date(Date.now() - 5 * 60000).toISOString(), priority: 'high' },
  ],
};

const workTabs = [
  ['all', 'Tất cả'],
  ['mine', 'Của tôi'],
  ['triage_pending', 'Chờ phân loại'],
  ['vital_pending', 'Chờ sinh hiệu'],
  ['abnormal_vital', 'Bất thường'],
  ['preparation_pending', 'Chờ chuẩn bị'],
  ['task_overdue', 'Quá hạn'],
  ['inpatient', 'Nội trú'],
  ['emergency', 'Cấp cứu'],
];

const priorityLabels = {
  critical: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Bình thường',
  low: 'Thấp',
};

const genderLabels = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
  unknown: 'Chưa rõ',
};

const statusLabels = {
  waiting: 'Đang chờ',
  called: 'Đã gọi',
  recalled: 'Gọi lại',
  in_service: 'Đang phục vụ',
  skipped: 'Bỏ qua',
  completed: 'Hoàn tất',
  no_show: 'Vắng mặt',
  pending: 'Chờ xử lý',
  needs_attention: 'Cần xử lý',
  doctor_notified: 'Đã báo bác sĩ',
  created: 'Mới',
  acknowledged: 'Đã nhận',
  triaged: 'Đã phân loại',
  dispatched: 'Đã điều phối',
  ordered: 'Đã chỉ định',
  in_progress: 'Đang làm',
  todo: 'Cần làm',
  done: 'Hoàn tất',
  overdue: 'Quá hạn',
  cancelled: 'Đã hủy',
  entered_in_error: 'Nhập sai',
  ready_for_doctor: 'Sẵn sàng gặp bác sĩ',
  waiting_doctor: 'Chờ bác sĩ phản hồi',
  assigned: 'Đã phân công',
  unassigned: 'Chưa phân công',
};

const sourceLabels = {
  queue: 'Hàng đợi',
  vital_sign: 'Sinh hiệu',
  emergency_case: 'Cấp cứu',
  order: 'Dịch vụ',
  nursing_task: 'Việc điều dưỡng',
  inpatient_task: 'Nội trú',
  medication_administration: 'Thuốc',
  encounter: 'Lượt khám',
  admission: 'Nội trú',
  lab_order: 'Chỉ định xét nghiệm',
  imaging_order: 'Chỉ định chẩn đoán hình ảnh',
  procedure_order: 'Chỉ định thủ thuật',
  manual: 'Tạo thủ công',
};

const alertTypeLabels = {
  abnormal_vital: 'Sinh hiệu bất thường',
  long_waiting: 'Chờ quá lâu',
  emergency: 'Cấp cứu',
  waiting_nurse: 'Chờ điều dưỡng',
  triage_pending: 'Chờ phân loại',
  vital_pending: 'Chờ sinh hiệu',
  preparation_pending: 'Chờ chuẩn bị',
  medication_due: 'Thuốc đến giờ',
  task_overdue: 'Việc quá hạn',
  queue_skipped: 'Bị bỏ qua trong hàng đợi',
  medication_overdue: 'Thuốc quá giờ',
  queue_sla: 'Hàng đợi quá hạn',
  doctor_escalation: 'Cần báo bác sĩ',
  order_stat: 'Chỉ định khẩn',
  service_preparation: 'Chuẩn bị dịch vụ',
};

const queueTypeLabels = {
  normal: 'Thường',
  priority: 'Ưu tiên',
  vip: 'Ưu tiên đặc biệt',
};

function formatDateLabel(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'Hôm nay';
  return date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function minutesAgo(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'vừa xong';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  return `${Math.floor(minutes / 60)} giờ trước`;
}

function waitText(minutes) {
  const value = Number(minutes || 0);
  if (value <= 0) return '0p';
  if (value < 60) return `${value}p`;
  return `${Math.floor(value / 60)}g ${value % 60}p`;
}

function patientName(item) {
  return item?.patient_name || item?.patient?.patient_name || item?.patient_id?.full_name || 'Chưa rõ bệnh nhân';
}

function actionLabel(action) {
  return {
    record_vital: 'Nhập sinh hiệu',
    notify_doctor: 'Báo bác sĩ',
    acknowledge: 'Xác nhận',
    acknowledge_emergency: 'Nhận ca',
    open_patient: 'Hồ sơ',
    open_case: 'Mở ca',
    create_nursing_note: 'Ghi chú',
    mark_ready_for_doctor: 'Sẵn sàng',
    create_triage: 'Tạo phân loại',
    open_checklist: 'Bảng kiểm',
    complete_preparation: 'Hoàn tất',
    complete_task: 'Hoàn tất',
    start_task: 'Bắt đầu',
    assign_to_me: 'Giao tôi',
    cancel_task: 'Hủy việc',
    reopen_task: 'Mở lại',
    resolve: 'Đánh dấu đã xử lý',
    dismiss: 'Bỏ qua cảnh báo',
    administer_medication: 'Dùng thuốc',
  }[action] || 'Xử lý';
}

function PanelHeader({ icon: Icon, title, meta, action }) {
  return (
    <header className="nurse-panel-header">
      <div>
        <span className="nurse-panel-header__icon" aria-hidden="true">
          <Icon size={18} strokeWidth={2.2} />
        </span>
        <strong>{title}</strong>
      </div>
      {action || (meta ? <span>{meta}</span> : null)}
    </header>
  );
}

function KpiCard({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={`nurse-kpi-card nurse-kpi-card--${item.tone}${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span className="nurse-kpi-card__icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <span className="nurse-kpi-card__body">
        <span>{item.label}</span>
        <strong>{item.value}</strong>
        <small>{item.detail}</small>
      </span>
    </button>
  );
}

function EmptyState({ children }) {
  return <div className="nurse-dashboard-empty">{children}</div>;
}

export function NurseDashboardPage() {
  const navigate = useNavigate();
  const [datePreset, setDatePreset] = useState('today');
  const [date, setDate] = useState(toLocalDateKey());
  const [shift, setShift] = useState('morning');
  const [nurseFilter, setNurseFilter] = useState('all');
  const [priority, setPriority] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [workFilter, setWorkFilter] = useState('all');
  const [vitalTab, setVitalTab] = useState('pending');
  const [dashboard, setDashboard] = useState(DEMO_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (datePreset === 'custom') return;
    setDate(dateFromPreset(datePreset));
  }, [datePreset]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      try {
        const payload = await nurseDashboardApi.getOverview({
          date,
          shift,
          nurse_id: nurseFilter === 'me' ? 'me' : undefined,
          assigned_to: nurseFilter === 'unassigned' ? 'unassigned' : undefined,
          priority: priority === 'all' ? undefined : priority,
          type: typeFilter === 'all' ? undefined : typeFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
        });
        if (cancelled) return;
        setDashboard(payload || DEMO_DASHBOARD);
        setIsDemo(false);
        setError('');
      } catch (loadError) {
        if (cancelled) return;
        setDashboard(DEMO_DASHBOARD);
        setIsDemo(true);
        setError(loadError?.message || 'Không thể tải dữ liệu dashboard điều dưỡng.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [date, shift, nurseFilter, priority, typeFilter, statusFilter, refreshTick]);

  const kpis = dashboard?.kpis || {};
  const kpiRows = useMemo(() => [
    [
      { key: 'checked_in', label: 'Đã tiếp nhận', value: kpis.checked_in || 0, detail: '+8 so với ca trước', icon: Users, tone: 'blue', filter: 'all' },
      { key: 'waiting_nurse', label: 'Chờ điều dưỡng', value: kpis.waiting_nurse || 0, detail: 'Cần tiếp nhận trong ca', icon: Stethoscope, tone: 'teal', filter: 'waiting_nurse' },
      { key: 'triage_pending', label: 'Chờ phân loại', value: kpis.triage_pending || 0, detail: `${dashboard?.triage?.high_priority || 0} ưu tiên cao`, icon: ClipboardCheck, tone: 'violet', filter: 'triage_pending' },
      { key: 'vital_pending', label: 'Chờ sinh hiệu', value: kpis.vital_pending || 0, detail: 'Ưu tiên người chờ lâu', icon: HeartPulse, tone: 'cyan', filter: 'vital_pending' },
      { key: 'ready_for_doctor', label: 'Sẵn sàng gặp bác sĩ', value: kpis.ready_for_doctor || 0, detail: 'Đã qua bước điều dưỡng', icon: UserCheck, tone: 'emerald', filter: 'ready_for_doctor' },
      { key: 'nursing_sla_waiting', label: 'Chờ quá hạn', value: kpis.nursing_sla_waiting || 0, detail: 'Chờ trên 30 phút', icon: Clock3, tone: 'amber', filter: 'long_waiting' },
    ],
    [
      { key: 'abnormal_vitals', label: 'Sinh hiệu bất thường', value: kpis.abnormal_vitals || 0, detail: 'Cần xác nhận / báo bác sĩ', icon: AlertTriangle, tone: 'red', filter: 'abnormal_vital' },
      { key: 'tasks_overdue', label: 'Việc quá hạn', value: kpis.tasks_overdue || 0, detail: `${kpis.tasks_due_today || 0} việc trong ngày`, icon: ClipboardList, tone: 'amber', filter: 'task_overdue' },
      { key: 'preparation_pending', label: 'Chờ chuẩn bị dịch vụ', value: kpis.preparation_pending || 0, detail: 'Xét nghiệm, chẩn đoán hình ảnh, thủ thuật', icon: FlaskConical, tone: 'indigo', filter: 'preparation_pending' },
      { key: 'open_emergency_cases', label: 'Ca khẩn đang mở', value: kpis.open_emergency_cases || 0, detail: `${dashboard?.emergency?.sla_breached || 0} quá hạn`, icon: ShieldAlert, tone: 'rose', filter: 'emergency' },
      { key: 'active_inpatients', label: 'Nội trú chăm sóc', value: kpis.active_inpatients || 0, detail: `${dashboard?.inpatient?.pending_bed_assignment || 0} chờ giường`, icon: Bed, tone: 'slate', filter: 'inpatient' },
      { key: 'medication_due_now', label: 'Thuốc đến giờ', value: kpis.medication_due_now || 0, detail: `${dashboard?.inpatient?.medication_overdue || 0} quá giờ`, icon: Pill, tone: 'green', filter: 'medication_due' },
    ],
  ], [dashboard, kpis]);

  const workItems = useMemo(() => {
    const items = dashboard?.worklist?.items || [];
    if (workFilter === 'all') return items;
    if (workFilter === 'mine') return items.filter((item) => item.assigned_to || item.assigned_to_name);
    return items.filter((item) => item.type === workFilter || item.source_type === workFilter);
  }, [dashboard, workFilter]);

  const alertGroups = useMemo(() => {
    const alerts = dashboard?.priority_alerts || [];
    return {
      critical: alerts.filter((item) => item.severity === 'critical'),
      high: alerts.filter((item) => item.severity === 'high'),
      overdue: alerts.filter((item) => item.type?.includes('overdue')),
      needDoctor: alerts.filter((item) => item.actions?.includes('notify_doctor')),
      system: alerts.filter((item) => !['critical', 'high'].includes(item.severity) && !item.type?.includes('overdue')),
    };
  }, [dashboard]);

  function handleAction(action) {
    const routeByAction = {
      record_vital: '/nurse/vitals-records/entry',
      notify_doctor: '/nurse/monitoring-reporting/report-doctor',
      acknowledge: '/nurse/overview/priority-alerts',
      acknowledge_emergency: '/nurse/emergency/open-cases',
      open_case: '/nurse/emergency/open-cases',
      create_nursing_note: '/nurse/vitals-records/nursing-notes',
      create_note: '/nurse/vitals-records/nursing-notes',
      mark_ready_for_doctor: '/nurse/reception-triage/ready-for-doctor',
      create_triage: '/nurse/reception-triage/create-triage',
      open_checklist: '/nurse/service-preparation/checklist',
      complete_task: '/nurse/tasks-handover/assigned',
      start_task: '/nurse/tasks-handover/assigned',
      assign_to_me: '/nurse/tasks-handover/assigned',
      administer_medication: '/nurse/inpatient/bedside-medication',
      open_patient: '/nurse/patient-lookup/profile',
      create_task: '/nurse/tasks-handover/assigned',
      open_queue: '/nurse/overview/realtime-queue',
      handover: '/nurse/tasks-handover/shift-handover',
    };
    navigate(routeByAction[action] || '/nurse/dashboard');
  }

  function renderQueueColumn(key, label, icon) {
    const items = dashboard?.queue?.board?.[key] || [];
    return (
      <section className={`nurse-queue-column nurse-queue-column--${key}`}>
        <header>
          <span>{icon}</span>
          <strong>{label}</strong>
          <em>{items.length}</em>
        </header>
        <div>
          {items.slice(0, 4).map((item, index) => (
            <button key={`${key}-${item.queue_ticket_id || item.queue_number || index}`} type="button" onClick={() => handleAction('open_queue')}>
              <strong>{item.queue_number || `Q${index + 1}`}</strong>
              <span>{patientName(item)}</span>
              <small>{waitText(item.waiting_minutes)} · {queueTypeLabels[item.queue_type] || statusLabels[item.status] || item.status}</small>
            </button>
          ))}
          {!items.length ? <small className="nurse-queue-column__empty">Trống</small> : null}
        </div>
      </section>
    );
  }

  const vitalItems = vitalTab === 'abnormal'
    ? dashboard?.vitals?.abnormal_items || []
    : vitalTab === 'recent'
      ? dashboard?.vitals?.latest_by_encounter || []
      : dashboard?.vitals?.pending_items || [];

  return (
    <section className="nurse-dashboard-command nurse-dashboard-command--dense" aria-labelledby="nurse-dashboard-title">
      <header className="nurse-dashboard-hero nurse-dashboard-hero--command">
        <div className="nurse-dashboard-hero__copy">
          <span>Trung tâm điều phối điều dưỡng</span>
          <h1 id="nurse-dashboard-title">Bảng điều khiển điều dưỡng</h1>
          <p>Theo dõi hàng đợi, phân loại, sinh hiệu, việc điều dưỡng, nội trú và cảnh báo trong ca trực.</p>
          <div className="nurse-dashboard-hero__meta">
            <span>{dashboard?.meta?.department_name || 'Khoa/phòng của tôi'}</span>
            <span>{shift === 'morning' ? 'Ca sáng' : shift === 'afternoon' ? 'Ca chiều' : shift === 'night' ? 'Ca đêm' : 'Tất cả ca'}</span>
            <span>{formatDateLabel(date)}</span>
            <span>{dashboard?.meta?.nurse_on_shift || 8} điều dưỡng trực</span>
          </div>
        </div>

        <div className="nurse-dashboard-hero__actions">
          <div className="nurse-dashboard-status">
            <span className={`nurse-realtime-badge${isDemo ? ' is-offline' : ''}`}>
              {isDemo ? <WifiOff size={15} strokeWidth={2.2} /> : <Wifi size={15} strokeWidth={2.2} />}
              {isDemo ? 'Dữ liệu mẫu' : 'Đã kết nối thời gian thực'}
            </span>
            <small>Cập nhật {formatTime(dashboard?.meta?.generated_at)}</small>
          </div>
          <div className="nurse-quick-actions">
            <button type="button" onClick={() => handleAction('record_vital')}><HeartPulse size={16} />Nhập sinh hiệu</button>
            <button type="button" onClick={() => handleAction('create_nursing_note')}><MessageSquarePlus size={16} />Ghi chú</button>
            <button type="button" onClick={() => handleAction('notify_doctor')}><Send size={16} />Báo bác sĩ</button>
            <button type="button" onClick={() => handleAction('create_task')}><Plus size={16} />Tạo việc</button>
          </div>
        </div>
      </header>

      <section className="nurse-dashboard-filters nurse-dashboard-filters--wide" aria-label="Bộ lọc ca trực">
        <label>
          <span>Ngày</span>
          <select value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
            <option value="today">Hôm nay</option>
            <option value="yesterday">Hôm qua</option>
            <option value="week">Tuần này</option>
            <option value="custom">Chọn ngày</option>
          </select>
        </label>
        <label>
          <span>Ngày tùy chọn</span>
          <input type="date" value={date} onChange={(event) => { setDatePreset('custom'); setDate(event.target.value); }} />
        </label>
        <label>
          <span>Khoa/phòng</span>
          <select value="" onChange={() => {}}>
            <option value="">Khoa được phân quyền</option>
            <option value="general">Nội tổng quát</option>
            <option value="pediatric">Nhi</option>
            <option value="emergency">Cấp cứu</option>
          </select>
        </label>
        <label>
          <span>Ca trực</span>
          <select value={shift} onChange={(event) => setShift(event.target.value)}>
            <option value="morning">Ca sáng</option>
            <option value="afternoon">Ca chiều</option>
            <option value="night">Ca đêm</option>
            <option value="all">Tất cả</option>
          </select>
        </label>
        <label>
          <span>Điều dưỡng</span>
          <select value={nurseFilter} onChange={(event) => setNurseFilter(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="me">Của tôi</option>
            <option value="unassigned">Chưa phân công</option>
          </select>
        </label>
        <label>
          <span>Ưu tiên</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="critical">Khẩn cấp</option>
            <option value="high">Cao</option>
            <option value="medium">Trung bình</option>
            <option value="low">Thấp</option>
          </select>
        </label>
        <label>
          <span>Loại việc</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="queue">Hàng đợi</option>
            <option value="triage_pending">Phân loại</option>
            <option value="vital_pending">Sinh hiệu</option>
            <option value="preparation_pending">Chuẩn bị DV</option>
            <option value="inpatient">Nội trú</option>
            <option value="emergency">Cấp cứu</option>
            <option value="medication_due">Thuốc</option>
          </select>
        </label>
        <label>
          <span>Trạng thái</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="pending">Đang chờ</option>
            <option value="overdue">Quá hạn</option>
            <option value="needs_attention">Cần xử lý</option>
            <option value="in_progress">Đang làm</option>
          </select>
        </label>
        <button type="button" className="nurse-refresh-button" onClick={() => setRefreshTick((value) => value + 1)}>
          {loading ? <Loader2 className="is-spinning" size={17} strokeWidth={2.2} /> : <RefreshCw size={17} strokeWidth={2.2} />}
          Làm mới
        </button>
      </section>

      {isDemo && error ? (
        <div className="nurse-dashboard-demo-note">
          <AlertTriangle size={16} strokeWidth={2.2} />
          API chưa phản hồi nên đang hiển thị dữ liệu mẫu. {error}
        </div>
      ) : null}

      <section className="nurse-kpi-stack" aria-label="Chỉ số ca trực">
        {kpiRows.map((row, rowIndex) => (
          <div className="nurse-kpi-grid nurse-kpi-grid--six" key={rowIndex}>
            {row.map((item) => (
              <KpiCard
                key={item.key}
                item={item}
                active={workFilter === item.filter && item.filter !== 'all'}
                onClick={() => setWorkFilter(item.filter)}
              />
            ))}
          </div>
        ))}
      </section>

      <section className="nurse-main-command-grid">
        <div className="nurse-command-panel nurse-command-panel--priority">
          <PanelHeader icon={Zap} title="Cảnh báo ưu tiên" meta={`${dashboard?.priority_alerts?.length || 0} cảnh báo`} />
          <div className="nurse-alert-group-tabs">
            <span>Khẩn cấp {alertGroups.critical.length}</span>
            <span>Cao {alertGroups.high.length}</span>
            <span>Quá hạn {alertGroups.overdue.length}</span>
            <span>Cần báo bác sĩ {alertGroups.needDoctor.length}</span>
            <span>Hệ thống {alertGroups.system.length}</span>
          </div>
          <div className="nurse-alert-stack nurse-alert-stack--rich">
            {(dashboard?.priority_alerts || []).slice(0, 6).map((alert) => (
              <article key={alert.id} className={`nurse-alert-item nurse-alert-item--${alert.severity || 'medium'}`}>
                <div>
                  <span>{priorityLabels[alert.severity] || alert.severity || 'Cảnh báo'} · {alertTypeLabels[alert.type] || alert.type}</span>
                  <strong>{alert.patient_name || 'Chưa rõ bệnh nhân'} · {alert.message}</strong>
                  <small>{alert.patient_code || 'Chưa có mã'} · {waitText(alert.waiting_minutes)} · {minutesAgo(alert.created_at)}</small>
                </div>
                <div className="nurse-alert-actions">
                  {(alert.actions || ['open_patient']).slice(0, 3).map((action) => (
                    <button key={action} type="button" onClick={() => handleAction(action)}>{actionLabel(action)}</button>
                  ))}
                </div>
              </article>
            ))}
            {!(dashboard?.priority_alerts || []).length ? <EmptyState>Không có cảnh báo ưu tiên.</EmptyState> : null}
          </div>
        </div>

        <div className="nurse-command-panel nurse-command-panel--queue-board">
          <PanelHeader icon={Monitor} title="Hàng đợi thời gian thực" meta={`${dashboard?.queue?.waiting || 0} đang chờ · ${dashboard?.queue?.called || 0} đã gọi`} />
          <div className="nurse-queue-board">
            {renderQueueColumn('waiting', 'Đang chờ', 'C')}
            {renderQueueColumn('called', 'Đã gọi', 'G')}
            {renderQueueColumn('recalled', 'Gọi lại', 'L')}
            {renderQueueColumn('in_service', 'Đang phục vụ', 'P')}
            {renderQueueColumn('skipped', 'Bỏ qua', '!')}
            {renderQueueColumn('no_show', 'Không đến', 'K')}
          </div>
          <div className="nurse-longest-waiting">
            <strong>Chờ lâu nhất</strong>
            {(dashboard?.queue?.longest_waiting || []).slice(0, 4).map((item, index) => (
              <span key={`${item.queue_number || index}`}>{item.queue_number} · {patientName(item)} · {waitText(item.waiting_minutes)}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="nurse-worklist-panel nurse-worklist-panel--primary">
        <div className="nurse-worklist-toolbar">
          <PanelHeader icon={ClipboardList} title="Danh sách bệnh nhân cần xử lý" meta={`${dashboard?.worklist?.summary?.total || 0} việc · ${dashboard?.worklist?.summary?.overdue || 0} quá hạn`} />
          <div className="nurse-worklist-tabs" role="tablist" aria-label="Lọc worklist">
            {workTabs.map(([key, label]) => (
              <button key={key} type="button" className={workFilter === key ? 'is-active' : ''} onClick={() => setWorkFilter(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="nurse-worklist-table-wrap">
          <table className="nurse-worklist-table nurse-worklist-table--wide">
            <thead>
              <tr>
                <th>Ưu tiên</th>
                <th>Bệnh nhân</th>
                <th>Tuổi / giới</th>
                <th>Mã hàng đợi / lượt khám</th>
                <th>Nguồn việc</th>
                <th>Lý do cần xử lý</th>
                <th>Trạng thái</th>
                <th>Chờ từ</th>
                <th>Vị trí</th>
                <th>Phụ trách</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {workItems.slice(0, 12).map((item) => (
                <tr key={item.id}>
                  <td><span className={`nurse-priority-pill nurse-priority-pill--${item.priority || 'medium'}`}>{priorityLabels[item.priority] || item.priority}</span></td>
                  <td><strong>{item.patient_name}</strong><small>{item.patient_code || 'Chưa có mã'}</small></td>
                  <td>{item.age || '--'} · {genderLabels[item.gender] || item.gender || '--'}</td>
                  <td>{item.metadata?.queue_number || item.metadata?.case_code || item.metadata?.order_no || item.encounter_id || '--'}</td>
                  <td>{sourceLabels[item.source_type] || alertTypeLabels[item.type] || sourceLabels[item.type] || item.source_type || item.type}</td>
                  <td>{item.reason}</td>
                  <td><span className="nurse-status-pill">{statusLabels[item.status] || item.status || 'Đang chờ'}</span></td>
                  <td>{item.overdue_minutes ? `${item.overdue_minutes} phút` : minutesAgo(item.waiting_since)}</td>
                  <td>{item.location || 'Chưa gán'}</td>
                  <td>{item.assigned_to_name || item.assigned_to || 'Chưa phân công'}</td>
                  <td>
                    <div className="nurse-row-actions">
                      {(item.actions || ['open_patient']).slice(0, 3).map((action) => (
                        <button key={action} type="button" onClick={() => handleAction(action)}>{actionLabel(action)}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!workItems.length ? <EmptyState>Không có bệnh nhân trong bộ lọc này.</EmptyState> : null}
        </div>
      </section>

      <section className="nurse-secondary-grid">
        <div className="nurse-command-panel">
          <PanelHeader icon={HeartPulse} title="Sinh hiệu và phân loại" meta={`${dashboard?.vitals?.pending || 0} chờ đo · ${dashboard?.triage?.pending || 0} chờ phân loại`} />
          <div className="nurse-mini-metrics nurse-mini-metrics--four">
            <span><strong>{dashboard?.vitals?.pending || 0}</strong>Chờ đo</span>
            <span><strong>{dashboard?.vitals?.abnormal || 0}</strong>Bất thường</span>
            <span><strong>{dashboard?.triage?.pending || 0}</strong>Chờ phân loại</span>
            <span><strong>{dashboard?.triage?.high_priority || 0}</strong>Ưu tiên cao</span>
          </div>
          <div className="nurse-micro-tabs">
            {[
              ['pending', 'Chờ đo'],
              ['abnormal', 'Bất thường'],
              ['recent', 'Vừa ghi nhận'],
              ['triage', 'Phân loại'],
            ].map(([key, label]) => (
              <button key={key} type="button" className={vitalTab === key ? 'is-active' : ''} onClick={() => setVitalTab(key)}>{label}</button>
            ))}
          </div>
          <div className="nurse-vital-feed">
            {(vitalTab === 'triage' ? dashboard?.triage?.pending_items || [] : vitalItems).slice(0, 5).map((item, index) => (
              <article key={item.vital_sign_id || item.queue_ticket_id || item.triage_id || index} className={`nurse-vital-row nurse-vital-row--${item.severity || item.priority || 'medium'}`}>
                {vitalTab === 'triage' ? <ClipboardCheck size={16} /> : item.severity ? <AlertTriangle size={16} /> : <HeartPulse size={16} />}
                <div>
                  <strong>{patientName(item)}</strong>
                  <span>{item.message || item.reason || item.queue_number || `Ghi nhận ${formatTime(item.recorded_at)}`} · {item.waiting_minutes ? waitText(item.waiting_minutes) : ''}</span>
                </div>
                <button type="button" onClick={() => handleAction(vitalTab === 'triage' ? 'create_triage' : item.severity ? 'notify_doctor' : 'record_vital')}>
                  {vitalTab === 'triage' ? 'Phân loại' : item.severity ? 'Báo bác sĩ' : 'Nhập'}
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="nurse-command-panel">
          <PanelHeader icon={ClipboardCheck} title="Việc điều dưỡng hôm nay" meta={`${dashboard?.tasks?.overdue || 0} quá hạn`} />
          <div className="nurse-mini-metrics">
            <span><strong>{dashboard?.tasks?.assigned_to_me || 0}</strong>Của tôi</span>
            <span><strong>{dashboard?.tasks?.due_today || 0}</strong>Đến hạn</span>
            <span><strong>{dashboard?.tasks?.completed || 0}</strong>Hoàn tất</span>
          </div>
          <div className="nurse-task-feed">
            {(dashboard?.tasks?.items || []).slice(0, 6).map((task, index) => (
              <article key={task.id || index} className={task.status === 'overdue' ? 'is-overdue' : ''}>
                <span>{statusLabels[task.status] || task.status || 'Việc'}</span>
                <strong>{task.title}</strong>
                <small>{task.patient_name ? `${task.patient_name} · ` : ''}{task.overdue_minutes ? `quá ${task.overdue_minutes} phút` : `đến hạn ${formatTime(task.due_at)}`}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="nurse-command-panel">
          <PanelHeader icon={FlaskConical} title="Chuẩn bị dịch vụ" meta={`${dashboard?.service_preparation?.pending || 0} chờ chuẩn bị`} />
          <div className="nurse-mini-metrics">
            <span><strong>{dashboard?.service_preparation?.lab || 0}</strong>Xét nghiệm</span>
            <span><strong>{dashboard?.service_preparation?.imaging || 0}</strong>CĐHA</span>
            <span><strong>{dashboard?.service_preparation?.procedure || 0}</strong>Thủ thuật</span>
          </div>
          <div className="nurse-prep-feed">
            {(dashboard?.service_preparation?.items || []).slice(0, 5).map((item, index) => (
              <article key={item.checklist_id || item.order_id || index}>
                <div>
                  <strong>{patientName(item)}</strong>
                  <span>{item.reason || item.order_type || 'Chờ chuẩn bị'}</span>
                </div>
                <div className="nurse-prep-progress">
                  <span style={{ width: `${item.progress?.percent || 0}%` }} />
                </div>
                <button type="button" onClick={() => handleAction('open_checklist')}>Bảng kiểm</button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="nurse-bottom-command-grid">
        <div className="nurse-command-panel">
          <PanelHeader icon={Bed} title="Nội trú" meta={`${dashboard?.inpatient?.active_admissions || 0} đang chăm sóc`} />
          <div className="nurse-ops-summary">
            <span><strong>{dashboard?.inpatient?.pending_bed_assignment || 0}</strong>Chờ giường</span>
            <span><strong>{dashboard?.inpatient?.inpatient_tasks_overdue || 0}</strong>Việc quá hạn</span>
            <span><strong>{dashboard?.inpatient?.medication_due_now || 0}</strong>Thuốc đến giờ</span>
            <span><strong>{dashboard?.inpatient?.medication_overdue || 0}</strong>Thuốc quá giờ</span>
          </div>
          <div className="nurse-compact-feed">
            {(dashboard?.inpatient?.admissions || []).slice(0, 4).map((item, index) => (
              <button key={item.admission_id || index} type="button" onClick={() => navigate('/nurse/inpatient/list')}>
                <strong>{item.patient?.patient_name || item.patient_name || item.admission_no}</strong>
                <small>{item.bed?.room_name || 'Chưa có phòng'} · {item.bed?.bed_number || 'chờ giường'}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="nurse-command-panel">
          <PanelHeader icon={ShieldAlert} title="Cấp cứu" meta={`${dashboard?.emergency?.open || 0} ca đang mở`} />
          <div className="nurse-ops-summary">
            <span><strong>{dashboard?.emergency?.new || 0}</strong>Ca mới</span>
            <span><strong>{dashboard?.emergency?.acknowledged || 0}</strong>Đã nhận</span>
            <span><strong>{dashboard?.emergency?.triaged || 0}</strong>Đang phân loại</span>
            <span><strong>{dashboard?.emergency?.sla_breached || 0}</strong>Quá hạn</span>
          </div>
          <div className="nurse-emergency-feed">
            {(dashboard?.emergency?.items || []).slice(0, 3).map((item, index) => (
              <article key={item.case_code || index}>
                <span>{priorityLabels[item.priority] || item.priority || 'Khẩn'}</span>
                <strong>{item.case_code || 'SOS'} · {item.patient_id?.full_name || item.patient?.patient_name || 'Chưa rõ bệnh nhân'}</strong>
                <small>{item.symptoms || item.note || 'Ca khẩn'} · {item.location_text || 'Chưa rõ vị trí'} · {minutesAgo(item.created_at)}</small>
                <div className="nurse-row-actions">
                  <button type="button" onClick={() => handleAction('acknowledge_emergency')}>Xác nhận</button>
                  <button type="button" onClick={() => handleAction('open_case')}>Mở ca</button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="nurse-command-panel">
          <PanelHeader icon={Bell} title="Thông báo thời gian thực" meta={`${dashboard?.notifications?.unread || 0} chưa đọc`} />
          <div className="nurse-activity-feed">
            {(dashboard?.activity_feed || []).slice(0, 8).map((item, index) => (
              <article key={item.id || index} className={`nurse-activity-item nurse-activity-item--${item.priority || 'normal'}`}>
                <span />
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.message} · {minutesAgo(item.created_at)}</small>
                </div>
              </article>
            ))}
            {!(dashboard?.activity_feed || []).length ? <EmptyState>Chưa có hoạt động thời gian thực.</EmptyState> : null}
          </div>
        </div>
      </section>
    </section>
  );
}

export default NurseDashboardPage;
