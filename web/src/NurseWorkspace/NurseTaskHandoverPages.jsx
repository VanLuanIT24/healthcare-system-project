import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Filter,
  HeartPulse,
  LayoutGrid,
  ListChecks,
  Loader2,
  MessageSquare,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  Table2,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { nurseTaskHandoverApi } from './nurseApi';
import { confirmNurseAction, downloadNurseJson, notifyNurse, printNurseView, promptNurseText, runNurseAction } from './nurseActions';

const priorityLabels = {
  low: 'Thấp',
  normal: 'Bình thường',
  medium: 'Trung bình',
  high: 'Cao',
  urgent: 'Khẩn',
  stat: 'STAT',
  critical: 'Nguy kịch',
};

const shiftLabels = {
  morning: 'Ca sáng',
  afternoon: 'Ca chiều',
  night: 'Ca đêm',
  all: 'Tất cả ca',
};

const roleLabels = {
  nurse: 'Điều dưỡng',
  doctor: 'Bác sĩ',
  team: 'Nhóm nhận',
};

const statusLabels = {
  draft: 'Nháp',
  assigned: 'Chưa nhận',
  accepted: 'Đã nhận',
  todo: 'Chưa nhận',
  in_progress: 'Đang làm',
  blocked: 'Bị chặn',
  waiting_doctor: 'Chờ bác sĩ',
  overdue: 'Quá hạn',
  done: 'Hoàn tất',
  cancelled: 'Đã hủy',
  submitted: 'Đã gửi',
  rejected: 'Từ chối',
  reopened: 'Mở lại',
  archived: 'Lưu trữ',
  pending_review: 'Chờ rà soát',
};

const typeLabels = {
  vital_sign: 'Sinh hiệu',
  vital: 'Sinh hiệu',
  medication_admin: 'Dùng thuốc',
  medication_monitoring: 'Sau dùng thuốc',
  post_medication_monitor: 'Sau dùng thuốc',
  pre_lab: 'Trước xét nghiệm',
  specimen_collection: 'Lấy mẫu',
  pre_imaging: 'Trước CĐHA',
  pre_procedure: 'Trước thủ thuật',
  post_procedure_monitor: 'Sau thủ thuật',
  doctor_report: 'Báo bác sĩ',
  patient_transport: 'Chuyển bệnh nhân',
  bedside_care: 'Chăm sóc tại giường',
  round: 'Đi buồng',
  handoff_followup: 'Theo bàn giao',
  handover: 'Bàn giao',
  emergency_response: 'Cấp cứu',
  preparation: 'Chuẩn bị',
  other: 'Khác',
};

const riskLabels = {
  allergy: 'Dị ứng',
  critical_vitals: 'Sinh hiệu nguy cơ',
  medication_attention: 'Thuốc cần chú ý',
  doctor_report_needed: 'Cần báo bác sĩ',
  overdue: 'Quá hạn',
  stat: 'STAT',
  urgent: 'Khẩn',
  fall_risk: 'Nguy cơ té ngã',
  isolation: 'Cách ly',
  post_procedure: 'Sau thủ thuật',
};

const sourceLabels = {
  manual: 'Thủ công',
  care_plan: 'Kế hoạch chăm sóc',
  encounter: 'Lượt khám',
  admission: 'Nội trú',
  queue: 'Hàng đợi',
  medication_administration: 'Dùng thuốc',
  lab_order: 'Xét nghiệm',
  imaging_order: 'CĐHA',
  procedure_order: 'Thủ thuật',
  emergency: 'Cấp cứu',
  handoff: 'Bàn giao',
  system: 'Hệ thống',
};

function toLocalDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatTime(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  if (!value) return '--/--/----';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--/--/----';
  return date.toLocaleDateString('vi-VN');
}

function minutesText(minutes = 0) {
  const value = Math.max(0, Number(minutes || 0));
  if (value < 60) return `${value} phút`;
  return `${Math.floor(value / 60)}g ${value % 60}p`;
}

function patientName(item = {}) {
  return item.patient_name || item.patient?.full_name || item.patient?.patient_name || 'Chưa rõ bệnh nhân';
}

function safeList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function queryParams(filters = {}) {
  return {
    date: filters.date,
    shift: filters.shift === 'all' ? undefined : filters.shift,
    priority: filters.priority === 'all' ? undefined : filters.priority,
    status: filters.status === 'all' ? undefined : filters.status,
    task_type: filters.type === 'all' ? undefined : filters.type,
    source_module: filters.source === 'all' ? undefined : filters.source,
    search: filters.search || undefined,
  };
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
        setError(loadError?.message || 'Không thể tải dữ liệu.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, deps);

  return { data, loading, isDemo, error, setData };
}

const now = Date.now();

const demoTasks = [
  {
    id: 'demo-task-1',
    task_code: 'NT202605190001',
    title: 'Đo lại sinh hiệu sau dùng thuốc hạ áp',
    description: 'BN còn chóng mặt nhẹ, cần đo lại và báo bác sĩ nếu HA > 160.',
    patient_name: 'Nguyễn Văn A',
    patient_code: 'BN000123',
    patient: { full_name: 'Nguyễn Văn A', patient_code: 'BN000123', gender: 'male', date_of_birth: '1959-02-15' },
    department_name: 'Khoa Nội tổng hợp',
    room_name: 'Phòng 302',
    bed_label: '302-B',
    assigned_to_name: 'ĐD Mai',
    source_module: 'medication_administration',
    task_type: 'post_medication_monitor',
    priority: 'stat',
    status: 'overdue',
    raw_status: 'assigned',
    due_at: new Date(now - 12 * 60000).toISOString(),
    overdue_minutes: 12,
    sla_minutes: 30,
    checklist: { done: 2, total: 4, required: 3, required_done: 2, completion_rate: 50 },
    checklist_items: [
      { id: 'c1', title: 'Xác nhận đúng bệnh nhân', required: true, status: 'done' },
      { id: 'c2', title: 'Đo HA, mạch, SpO2', required: true, status: 'done' },
      { id: 'c3', title: 'Ghi nhận triệu chứng chóng mặt', required: true, status: 'pending' },
      { id: 'c4', title: 'Báo bác sĩ nếu HA > 160', required: false, status: 'pending' },
    ],
    latest_vitals: { systolic_bp: 165, diastolic_bp: 95, heart_rate: 104, spo2: 94, temperature: 38.2, respiratory_rate: 22, pain_score: 3, severity: 'high', recorded_at: new Date(now - 18 * 60000).toISOString(), recorded_by: { full_name: 'ĐD Lan' } },
    flags: ['critical_vitals', 'medication_attention', 'doctor_report_needed', 'overdue'],
    latest_note: 'BN còn chóng mặt nhẹ.',
  },
  {
    id: 'demo-task-2',
    task_code: 'NT202605190002',
    title: 'Chuẩn bị xét nghiệm máu trước 10:30',
    patient_name: 'Trần Thị B',
    patient_code: 'BN000245',
    patient: { full_name: 'Trần Thị B', patient_code: 'BN000245', gender: 'female', date_of_birth: '1986-09-20' },
    department_name: 'Khoa Nội tổng hợp',
    room_name: 'Phòng 304',
    bed_label: '304-A',
    assigned_to_name: 'ĐD Mai',
    source_module: 'lab_order',
    task_type: 'pre_lab',
    priority: 'high',
    status: 'accepted',
    raw_status: 'accepted',
    due_at: new Date(now + 22 * 60000).toISOString(),
    sla_minutes: 45,
    checklist: { done: 1, total: 3, required: 2, required_done: 1, completion_rate: 33 },
    checklist_items: [
      { id: 'c1', title: 'Kiểm tra nhịn ăn', required: false, status: 'done' },
      { id: 'c2', title: 'Chuẩn bị ống mẫu', required: true, status: 'pending' },
      { id: 'c3', title: 'Dán nhãn mẫu', required: true, status: 'pending' },
    ],
    latest_vitals: { systolic_bp: 120, diastolic_bp: 75, heart_rate: 78, spo2: 98, temperature: 36.8, respiratory_rate: 18, pain_score: 1, severity: 'normal', recorded_at: new Date(now - 35 * 60000).toISOString(), recorded_by: { full_name: 'ĐD Quỳnh' } },
    flags: [],
  },
  {
    id: 'demo-task-3',
    task_code: 'NT202605190003',
    title: 'Báo bác sĩ về SpO2 thấp',
    patient_name: 'Lê Văn C',
    patient_code: 'BN000399',
    patient: { full_name: 'Lê Văn C', patient_code: 'BN000399', gender: 'male', date_of_birth: '1948-01-09' },
    department_name: 'Khoa Hô hấp',
    room_name: 'Phòng 210',
    bed_label: '210-C',
    assigned_to_name: null,
    source_module: 'system',
    task_type: 'doctor_report',
    priority: 'urgent',
    status: 'assigned',
    raw_status: 'assigned',
    due_at: new Date(now + 8 * 60000).toISOString(),
    checklist: { done: 0, total: 2, required: 2, required_done: 0, completion_rate: 0 },
    latest_vitals: { systolic_bp: 138, diastolic_bp: 86, heart_rate: 118, spo2: 89, temperature: 37.6, respiratory_rate: 28, pain_score: 4, severity: 'critical', recorded_at: new Date(now - 6 * 60000).toISOString(), recorded_by: { full_name: 'ĐD Hương' } },
    flags: ['critical_vitals', 'doctor_report_needed', 'urgent'],
  },
];

const demoAssigned = {
  items: demoTasks,
  summary: { total: 14, assigned: 5, accepted: 4, in_progress: 2, blocked: 1, overdue: 3, done: 8, urgent: 4, doctor_report: 3, medication: 5, vitals: 4, handoff: 2 },
  pagination: { page: 1, limit: 50, total: 14 },
};

const demoMatrix = {
  summary: { patients: 12, with_overdue: 3, high_risk: 4, pending_tasks: 42, medication_pending: 9, vital_pending: 8, doctor_report: 3, handoff: 7 },
  items: [
    { patient_id: 'p1', patient: demoTasks[0].patient, room_name: 'Phòng 302', bed_label: '302-B', acuity_level: 'critical', latest_vitals: demoTasks[0].latest_vitals, risk_tags: ['critical_vitals', 'allergy', 'overdue'], task_counts: { pending: 5, overdue: 2, medication: 2, vital: 2, lab: 0, imaging: 1, procedure: 0, monitoring: 2, doctor_report: 1, handoff: 1, done: 4 }, next_task: demoTasks[0], tasks: demoTasks },
    { patient_id: 'p2', patient: demoTasks[1].patient, room_name: 'Phòng 304', bed_label: '304-A', acuity_level: 'medium', latest_vitals: demoTasks[1].latest_vitals, risk_tags: [], task_counts: { pending: 3, overdue: 0, medication: 1, vital: 1, lab: 1, imaging: 0, procedure: 0, monitoring: 0, doctor_report: 0, handoff: 0, done: 2 }, next_task: demoTasks[1], tasks: [demoTasks[1]] },
  ],
};

const demoHandoff = {
  handoff_id: 'handoff-demo',
  handoff_code: 'NH202605190001',
  department_name: 'Khoa Nội tổng hợp',
  shift_date: toLocalDateKey(),
  from_shift: 'morning',
  to_shift: 'afternoon',
  from_user_name: 'ĐD Mai',
  to_user_name: 'ĐD Hương',
  to_team_role: 'nurse',
  status: 'submitted',
  summary: 'Bàn giao 8 bệnh nhân, ưu tiên 3 bệnh nhân nguy cơ cao.',
  risk_summary: '1 nguy kịch, 2 cao, 3 nhiệm vụ quá hạn, 4 thuốc cần chú ý.',
  summary_counts: { patients: 8, high_risk: 3, pending_tasks: 18, overdue_tasks: 3, pending_medications: 4, abnormal_vitals: 2, doctor_report_needed: 2, unacknowledged: 5 },
  patient_items: [
    {
      item_id: 'hi1',
      patient_id: 'p1',
      patient: demoTasks[0].patient,
      bed_label: '302-B',
      situation: 'HA còn cao sau dùng thuốc hạ áp, bệnh nhân chóng mặt nhẹ.',
      background: 'Nhập viện theo dõi tăng huyết áp và sốt.',
      assessment: 'Sinh hiệu mới nhất HA 165/95, mạch 104, SpO2 94%, nhiệt 38.2.',
      recommendation: 'Đo lại sinh hiệu lúc 14:30, báo bác sĩ nếu HA > 160 hoặc chóng mặt tăng.',
      acuity_level: 'critical',
      flags: { allergy: true, critical_vitals: true, medication_attention: true, doctor_report_needed: true },
      latest_vitals_snapshot: demoTasks[0].latest_vitals,
      pending_task_ids: [demoTasks[0]],
      overdue_task_ids: [demoTasks[0]],
      pending_medication_ids: ['med1'],
      receiver_acknowledged: false,
    },
    {
      item_id: 'hi2',
      patient_id: 'p2',
      patient: demoTasks[1].patient,
      bed_label: '304-A',
      situation: 'Chờ lấy mẫu xét nghiệm máu.',
      background: 'Theo dõi thiếu máu.',
      assessment: 'Sinh hiệu ổn định.',
      recommendation: 'Hoàn tất lấy mẫu trước 10:30 và gửi phòng xét nghiệm.',
      acuity_level: 'medium',
      flags: {},
      latest_vitals_snapshot: demoTasks[1].latest_vitals,
      pending_task_ids: [demoTasks[1]],
      overdue_task_ids: [],
      pending_medication_ids: [],
      receiver_acknowledged: true,
      acknowledged_at: new Date(now - 6 * 60000).toISOString(),
    },
  ],
};

const demoHandoffs = {
  items: [demoHandoff, { ...demoHandoff, handoff_id: 'handoff-demo-2', handoff_code: 'NH202605180003', status: 'accepted', accepted_at: new Date(now - 20 * 3600000).toISOString(), from_shift: 'night', to_shift: 'morning' }],
  summary: { total: 2, draft: 0, submitted: 1, accepted: 1, rejected: 0, high_risk: 6, overdue_tasks: 6 },
};

function CommandPage({ eyebrow, title, description, loading, isDemo, error, actions, children }) {
  return (
    <section className="nurse-th-page">
      <header className="nurse-th-hero">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="nurse-th-meta">
            <em>Khoa/phòng được phân quyền</em>
            <em>Ca trực hiện tại</em>
            <em>{formatDate(new Date())}</em>
            <em>{isDemo ? 'Dữ liệu mẫu' : 'API thời gian thực'}</em>
          </div>
        </div>
        <aside>
          <span className={`nurse-th-realtime${isDemo ? ' is-offline' : ''}`}>
            {isDemo ? <WifiOff size={15} /> : <Wifi size={15} />}
            {isDemo ? 'Dữ liệu mẫu' : 'Thời gian thực sẵn sàng'}
          </span>
          <div className="nurse-th-actions">{actions}</div>
        </aside>
      </header>
      {isDemo && error ? <div className="nurse-th-demo"><AlertTriangle size={16} />{error}</div> : null}
      {loading ? <div className="nurse-th-loading"><Loader2 className="is-spinning" size={18} />Đang đồng bộ dữ liệu...</div> : null}
      {children}
    </section>
  );
}

function KpiStrip({ items }) {
  return (
    <section className="nurse-th-kpis">
      {items.map((item) => {
        const Icon = item.icon || Activity;
        return (
          <button key={item.label} type="button" className={`nurse-th-kpi nurse-th-kpi--${item.tone || 'teal'}`} onClick={item.onClick || (() => notifyNurse({ title: item.label, message: item.detail || 'Đã chọn chỉ số để rà soát.' }))}>
            <Icon size={18} />
            <span>{item.label}</span>
            <strong>{item.value ?? 0}</strong>
            <small>{item.detail}</small>
          </button>
        );
      })}
    </section>
  );
}

function FilterBar({ filters, setFilters, children }) {
  return (
    <section className="nurse-th-filters">
      <label><span>Ngày</span><input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} /></label>
      <label><span>Ca trực</span><select value={filters.shift} onChange={(event) => setFilters((current) => ({ ...current, shift: event.target.value }))}><option value="morning">Ca sáng</option><option value="afternoon">Ca chiều</option><option value="night">Ca đêm</option><option value="all">Tất cả</option></select></label>
      <label><span>Ưu tiên</span><select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}><option value="all">Tất cả</option><option value="stat">STAT</option><option value="urgent">Khẩn</option><option value="high">Cao</option><option value="normal">Bình thường</option><option value="low">Thấp</option></select></label>
      <label><span>Tìm kiếm</span><div className="nurse-th-search"><Search size={15} /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Mã nhiệm vụ, bệnh nhân, nội dung" /></div></label>
      {children}
    </section>
  );
}

function RiskBadges({ flags = [] }) {
  const values = Array.isArray(flags) ? flags : Object.entries(flags).filter(([, value]) => value).map(([key]) => key);
  return (
    <div className="nurse-th-badges">
      {values.slice(0, 4).map((flag) => <span key={flag}>{riskLabels[flag] || flag}</span>)}
      {!values.length ? <span className="is-muted">Không cờ nguy cơ</span> : null}
    </div>
  );
}

function VitalsLine({ vitals }) {
  if (!vitals) return <span>Chưa có sinh hiệu mới</span>;
  return (
    <span>
      HA {vitals.systolic_bp ?? '--'}/{vitals.diastolic_bp ?? '--'} · Mạch {vitals.heart_rate ?? '--'} · SpO2 {vitals.spo2 ?? '--'}% · Nhiệt {vitals.temperature ?? '--'} · NT {vitals.respiratory_rate ?? '--'} · Đau {vitals.pain_score ?? '--'}
    </span>
  );
}

function SlaCountdown({ task }) {
  if (task.status === 'overdue') return <span className="nurse-th-sla is-overdue">Quá hạn {minutesText(task.overdue_minutes)}</span>;
  const due = task.due_at ? new Date(task.due_at).getTime() : 0;
  const left = due ? Math.ceil((due - Date.now()) / 60000) : null;
  if (left === null) return <span className="nurse-th-sla">Không SLA</span>;
  return <span className={`nurse-th-sla${left <= 10 ? ' is-warning' : ''}`}>Còn {minutesText(left)}</span>;
}

function TaskCard({ task, selected, onSelect, onAction, compact = false }) {
  return (
    <article className={`nurse-th-task-card nurse-th-task-card--${task.priority || 'normal'}${selected ? ' is-selected' : ''}${compact ? ' is-compact' : ''}`} onClick={() => onSelect?.(task)}>
      <header>
        <div>
          <span className={`nurse-th-priority nurse-th-priority--${task.priority || 'normal'}`}>{priorityLabels[task.priority] || task.priority}</span>
          <SlaCountdown task={task} />
          <span className="nurse-th-status">{statusLabels[task.status] || task.status}</span>
        </div>
        <small>{task.task_code || task.id}</small>
      </header>
      <h3>{task.title}</h3>
      <p>{patientName(task)} · {task.patient_code || task.patient?.patient_code || '--'}</p>
      <dl>
        <div><dt>Vị trí</dt><dd>{task.department_name || 'Khoa'} | {task.room_name || 'Phòng'} | {task.bed_label || 'Giường'}</dd></div>
        <div><dt>Nguồn</dt><dd>{sourceLabels[task.source_module] || sourceLabels[task.source_type] || task.source_module || '--'}</dd></div>
        <div><dt>Sinh hiệu</dt><dd><VitalsLine vitals={task.latest_vitals} /></dd></div>
      </dl>
      <RiskBadges flags={task.flags} />
      <footer>
        <span><strong>{task.checklist?.done ?? 0}/{task.checklist?.total ?? 0}</strong> bảng kiểm</span>
        <div>
          {(task.status === 'assigned' || task.status === 'todo') ? <button type="button" onClick={(event) => { event.stopPropagation(); onAction?.('accept', task); }}><UserCheck size={14} />Nhận</button> : null}
          {['assigned', 'todo', 'accepted'].includes(task.status) ? <button type="button" onClick={(event) => { event.stopPropagation(); onAction?.('start', task); }}><Zap size={14} />Bắt đầu</button> : null}
          {task.status !== 'done' ? <button type="button" onClick={(event) => { event.stopPropagation(); onAction?.('complete', task); }}><CheckCircle2 size={14} />Hoàn tất</button> : null}
        </div>
      </footer>
    </article>
  );
}

function TaskDrawer({ task, onClose, onAction }) {
  if (!task) return null;
  const timeline = [
    ['created_at', 'Đã tạo'],
    ['accepted_at', 'Đã nhận'],
    ['started_at', 'Đã bắt đầu'],
    ['escalated_at', 'Đã báo khẩn'],
    ['completed_at', 'Đã hoàn tất'],
  ].filter(([key]) => task[key]);
  return (
    <aside className="nurse-th-drawer">
      <header>
        <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        <span className={`nurse-th-priority nurse-th-priority--${task.priority}`}>{priorityLabels[task.priority] || task.priority}</span>
        <h2>{task.title}</h2>
        <p>{task.task_code} · {statusLabels[task.status] || task.status} · hạn {formatTime(task.due_at)}</p>
      </header>
      <section>
        <h3><Users size={16} /> Tóm tắt bệnh nhân</h3>
        <dl>
          <div><dt>Bệnh nhân</dt><dd>{patientName(task)} · {task.patient_code || task.patient?.patient_code || '--'}</dd></div>
          <div><dt>Vị trí</dt><dd>{task.room_name || '--'} · {task.bed_label || '--'}</dd></div>
          <div><dt>Nguồn</dt><dd>{sourceLabels[task.source_module] || task.source_module}</dd></div>
          <div><dt>Phụ trách</dt><dd>{task.assigned_to_name || 'Chưa phân công'}</dd></div>
        </dl>
      </section>
      <section>
        <h3><HeartPulse size={16} /> Tóm tắt lâm sàng</h3>
        <div className="nurse-th-vital-box"><VitalsLine vitals={task.latest_vitals} /><small>Đo lúc {formatTime(task.latest_vitals?.recorded_at)} bởi {task.latest_vitals?.recorded_by?.full_name || '--'}</small></div>
        <RiskBadges flags={task.flags} />
      </section>
      <section>
        <h3><ListChecks size={16} /> Bảng kiểm</h3>
        <div className="nurse-th-checklist">
          {safeList(task.checklist_items).map((item) => (
            <button key={item.id || item._id || item.title} type="button" className={item.status === 'done' ? 'is-done' : ''} onClick={() => onAction?.('check', task, item)}>
              <CheckCircle2 size={15} />
              <span>{item.title}</span>
              <em>{item.required ? 'Bắt buộc' : 'Tùy chọn'}</em>
            </button>
          ))}
          {!safeList(task.checklist_items).length ? <span className="nurse-th-empty-line">Nhiệm vụ chưa có bảng kiểm.</span> : null}
        </div>
      </section>
      <section>
        <h3><Clock3 size={16} /> Dòng thời gian</h3>
        <div className="nurse-th-timeline">
          {timeline.map(([key, label]) => <article key={key}><strong>{label}</strong><span>{formatTime(task[key])}</span></article>)}
          {!timeline.length ? <span className="nurse-th-empty-line">Chưa có dòng thời gian nghiệp vụ.</span> : null}
        </div>
      </section>
      <section>
        <h3><Activity size={16} /> Thao tác</h3>
        <div className="nurse-th-action-grid">
          <button type="button" onClick={() => onAction?.('complete', task)}><CheckCircle2 size={15} />Hoàn tất</button>
          <button type="button" onClick={() => onAction?.('block', task)}><ShieldAlert size={15} />Chặn</button>
          <button type="button" onClick={() => onAction?.('note', task)}><FileText size={15} />Ghi chú</button>
          <button type="button" onClick={() => onAction?.('doctor', task)}><Send size={15} />Báo bác sĩ</button>
          <button type="button" onClick={() => onAction?.('escalate', task)}><Bell size={15} />Báo khẩn</button>
          <button type="button" onClick={() => onAction?.('handoff', task)}><ArrowRightLeft size={15} />Bàn giao</button>
        </div>
      </section>
    </aside>
  );
}

function taskFilter(tasks, tab, filters) {
  return safeList(tasks).filter((task) => {
    if (tab === 'immediate' && !['overdue', 'assigned', 'accepted', 'in_progress'].includes(task.status)) return false;
    if (tab === 'unaccepted' && !['assigned', 'todo'].includes(task.status)) return false;
    if (tab === 'in_progress' && task.status !== 'in_progress') return false;
    if (tab === 'medication' && task.task_group !== 'medication' && !String(task.task_type).includes('medication')) return false;
    if (tab === 'vitals' && task.task_group !== 'vitals' && !String(task.task_type).includes('vital')) return false;
    if (tab === 'doctor' && !task.flags?.includes('doctor_report_needed') && task.task_type !== 'doctor_report') return false;
    if (tab === 'handoff' && !task.handoff_id && task.task_group !== 'handoff') return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.type !== 'all' && task.task_type !== filters.type) return false;
    if (filters.search) {
      const haystack = `${task.title} ${task.task_code} ${patientName(task)} ${task.patient_code}`.toLowerCase();
      if (!haystack.includes(filters.search.toLowerCase())) return false;
    }
    return true;
  });
}

function makeTaskAction(setRefresh, setToast, isDemo) {
  return async function handleAction(action, task, item) {
    const taskId = task?.id || task?.task_id || task?._id;
    if (!taskId) {
      const message = 'Chưa chọn nhiệm vụ hợp lệ để thao tác.';
      setToast(message);
      notifyNurse({ tone: 'warning', title: 'Nhiệm vụ điều dưỡng', message });
      return;
    }

    const actionNames = {
      accept: 'Nhận nhiệm vụ',
      start: 'Bắt đầu nhiệm vụ',
      complete: 'Hoàn tất nhiệm vụ',
      block: 'Chặn nhiệm vụ',
      note: 'Thêm ghi chú',
      doctor: 'Báo bác sĩ',
      escalate: 'Báo khẩn',
      handoff: 'Đưa vào bàn giao',
      check: 'Cập nhật checklist',
    };
    const confirmActions = ['complete', 'block', 'doctor', 'escalate', 'handoff'];
    const note = action === 'note'
      ? promptNurseText({ title: 'Ghi chú nhiệm vụ', message: task.title, defaultValue: task.latest_note || 'Ghi chú nhanh từ workspace điều dưỡng.' })
      : null;
    if (action === 'note' && !note) return;

    await runNurseAction({
      label: actionNames[action] || 'Cập nhật nhiệm vụ',
      isDemo,
      demoMessage: 'Dữ liệu mẫu: thao tác API chưa được gửi.',
      confirm: confirmActions.includes(action) ? { title: actionNames[action], message: `Thực hiện với nhiệm vụ: ${task.title}` } : null,
      run: async () => {
        if (action === 'accept') return nurseTaskHandoverApi.acceptTask(taskId);
        if (action === 'start') return nurseTaskHandoverApi.startTask(taskId);
        if (action === 'complete') return nurseTaskHandoverApi.completeTask(taskId, { result_note: 'Hoàn tất từ trung tâm điều phối điều dưỡng.' });
        if (action === 'block') return nurseTaskHandoverApi.blockTask(taskId, { blocked_reason: 'Cần thêm thông tin trước khi xử lý.' });
        if (action === 'note') return nurseTaskHandoverApi.addTaskNote(taskId, { note });
        if (action === 'doctor') return nurseTaskHandoverApi.reportDoctor(taskId, { message: task.description || task.title });
        if (action === 'escalate') return nurseTaskHandoverApi.escalateTask(taskId, { reason: 'Báo khẩn từ trung tâm điều phối điều dưỡng.' });
        if (action === 'handoff') return nurseTaskHandoverApi.addToHandoff(taskId, { reason: 'Đưa vào bàn giao từ workspace điều dưỡng.' });
        if (action === 'check' && item) return nurseTaskHandoverApi.checkChecklistItem(taskId, item.id || item._id);
        return nurseTaskHandoverApi.getTask(taskId);
      },
      successMessage: 'Đã cập nhật nhiệm vụ.',
      onSuccess: () => {
        setToast('Đã cập nhật nhiệm vụ.');
        setRefresh((value) => value + 1);
      },
    });
    if (!isDemo) {
      setToast((current) => current || 'Thao tác đã được gửi.');
    }
  };
}

export function AssignedTasksPage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', status: 'all', type: 'all', source: 'all', search: '' });
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState('');
  const { data, loading, isDemo, error } = useNursingData(() => nurseTaskHandoverApi.getMyTasks(queryParams(filters)), demoAssigned, [filters.date, filters.shift, filters.priority, filters.status, filters.type, filters.search, refresh]);
  const tasks = taskFilter(data.items, tab, filters);
  const activeTask = selected || tasks[0];
  const handleAction = makeTaskAction(setRefresh, setToast, isDemo);

  async function createQuickTask(kind = 'manual') {
    const baseTask = activeTask || {};
    const patientId = baseTask.patient_id?._id || baseTask.patient_id || baseTask.patient?._id || baseTask.patient?.id;
    if (isDemo || !patientId) {
      notifyNurse({ tone: 'warning', title: 'Tạo nhiệm vụ', message: 'Cần chọn bệnh nhân có patient_id hợp lệ để tạo nhiệm vụ.' });
      return;
    }
    const title = promptNurseText({
      title: kind === 'template' ? 'Tạo nhiệm vụ từ mẫu' : 'Tạo nhiệm vụ điều dưỡng',
      message: 'Nhập tiêu đề nhiệm vụ mới.',
      defaultValue: kind === 'template' ? 'Theo dõi lại sinh hiệu sau 15 phút' : '',
    });
    if (!title) return;
    await runNurseAction({
      label: 'Tạo nhiệm vụ',
      confirm: { title: 'Tạo nhiệm vụ mới?', message: title },
      run: () => nurseTaskHandoverApi.createTask({
        patient_id: patientId,
        encounter_id: baseTask.encounter_id || undefined,
        admission_id: baseTask.admission_id || undefined,
        queue_ticket_id: baseTask.queue_ticket_id || undefined,
        title,
        task_type: kind === 'template' ? 'vital_sign' : 'other',
        source_type: 'manual',
        priority: baseTask.priority || 'normal',
        sla_minutes: kind === 'template' ? 15 : 60,
      }),
      successMessage: 'Đã tạo nhiệm vụ điều dưỡng.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
  }

  return (
    <CommandPage eyebrow="Trung tâm điều phối điều dưỡng" title="Nhiệm vụ được giao" description="Bảng điều phối nhiệm vụ theo SLA, bệnh nhân, sinh hiệu, thuốc và bàn giao." loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => createQuickTask('manual')}><Plus size={16} />Tạo nhiệm vụ</button><button type="button" onClick={() => createQuickTask('template')}><ClipboardCheck size={16} />Từ mẫu</button><button type="button" onClick={() => handleAction('handoff', activeTask)}><ArrowRightLeft size={16} />Bàn giao nhanh</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      {toast ? <div className="nurse-th-toast">{toast}<button type="button" onClick={() => setToast('')}><X size={14} /></button></div> : null}
      <KpiStrip items={[
        { label: 'Tổng nhiệm vụ', value: data.summary?.total, detail: 'Trong ca', icon: ClipboardList, tone: 'blue' },
        { label: 'Chưa nhận', value: data.summary?.assigned, detail: 'Cần xác nhận', icon: UserCheck, tone: 'amber' },
        { label: 'Đang làm', value: data.summary?.in_progress, detail: 'Đã bắt đầu', icon: Activity, tone: 'teal' },
        { label: 'Quá hạn', value: data.summary?.overdue, detail: 'Cần xử lý ngay', icon: AlertTriangle, tone: 'red' },
        { label: 'STAT/khẩn', value: data.summary?.urgent, detail: 'Ưu tiên cao', icon: ShieldAlert, tone: 'violet' },
        { label: 'Cần báo BS', value: data.summary?.doctor_report, detail: 'Có báo khẩn', icon: Send, tone: 'rose' },
        { label: 'Thuốc', value: data.summary?.medication, detail: 'Liên quan thuốc', icon: Pill, tone: 'green' },
        { label: 'Hoàn tất', value: data.summary?.done, detail: 'Trong ngày', icon: CheckCircle2, tone: 'slate' },
      ]} />
      <section className="nurse-th-smart-strip">
        {[
          ['Thuốc tới giờ', data.summary?.medication, Pill],
          ['Sinh hiệu cần đo', data.summary?.vitals, HeartPulse],
          ['Sau thủ thuật', tasks.filter((task) => task.task_type === 'post_procedure_monitor').length, Stethoscope],
          ['Bệnh nhân nguy cơ cao', tasks.filter((task) => task.flags?.includes('critical_vitals')).length, ShieldAlert],
          ['Chưa có người nhận', tasks.filter((task) => !task.assigned_to).length, Users],
          ['Nhiệm vụ từ bàn giao', data.summary?.handoff, ArrowRightLeft],
        ].map(([label, value, Icon]) => <button key={label} type="button" onClick={() => setTab(label.includes('Thuốc') ? 'medication' : label.includes('Sinh hiệu') ? 'vitals' : label.includes('bác sĩ') ? 'doctor' : label.includes('bàn giao') ? 'handoff' : 'immediate')}><Icon size={16} /><span>{label}</span><strong>{value || 0}</strong></button>)}
      </section>
      <FilterBar filters={filters} setFilters={setFilters}>
        <label><span>Loại nhiệm vụ</span><select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="all">Tất cả</option><option value="vital_sign">Sinh hiệu</option><option value="medication_admin">Thuốc</option><option value="post_medication_monitor">Sau thuốc</option><option value="pre_lab">Xét nghiệm</option><option value="doctor_report">Báo bác sĩ</option><option value="handoff_followup">Bàn giao</option></select></label>
        <label><span>Trạng thái</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Tất cả</option><option value="assigned">Chưa nhận</option><option value="accepted">Đã nhận</option><option value="in_progress">Đang làm</option><option value="blocked">Bị chặn</option><option value="done">Hoàn tất</option></select></label>
      </FilterBar>
      <div className="nurse-th-tabs">{['all', 'immediate', 'unaccepted', 'in_progress', 'medication', 'vitals', 'doctor', 'handoff'].map((item) => <button key={item} type="button" className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>{item === 'all' ? 'Tất cả' : item === 'immediate' ? 'Cần làm ngay' : item === 'unaccepted' ? 'Chưa nhận' : item === 'in_progress' ? 'Đang thực hiện' : item === 'medication' ? 'Thuốc' : item === 'vitals' ? 'Sinh hiệu' : item === 'doctor' ? 'Báo bác sĩ' : 'Bàn giao'}</button>)}</div>
      <section className="nurse-th-task-layout">
        <aside className="nurse-th-side-filter">
          <h3><Filter size={16} /> Bộ lọc nhanh</h3>
          {['Có dị ứng', 'Sinh hiệu bất thường', 'Liên quan thuốc', 'Cần báo bác sĩ', 'Nằm trong bàn giao'].map((label) => <button key={label} type="button" onClick={() => setTab(label.includes('thuốc') ? 'medication' : label.includes('bác sĩ') ? 'doctor' : label.includes('bàn giao') ? 'handoff' : 'immediate')}>{label}</button>)}
        </aside>
        <main className="nurse-th-task-board">{tasks.map((task) => <TaskCard key={task.id || task.task_id} task={task} selected={(activeTask?.id || activeTask?.task_id) === (task.id || task.task_id)} onSelect={setSelected} onAction={handleAction} />)}</main>
        <TaskDrawer task={activeTask} onClose={() => setSelected(null)} onAction={handleAction} />
      </section>
    </CommandPage>
  );
}

export function PatientTasksPage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', status: 'all', type: 'all', source: 'all', search: '' });
  const [view, setView] = useState('matrix');
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useNursingData(() => nurseTaskHandoverApi.getPatientMatrix(queryParams(filters)), demoMatrix, [filters.date, filters.shift, filters.priority, filters.search, refresh]);
  const patients = safeList(data.items).filter((row) => !filters.search || `${row.patient?.full_name} ${row.patient?.patient_code}`.toLowerCase().includes(filters.search.toLowerCase()));
  const active = selected || patients[0];

  async function createPatientTask(template = false) {
    const patientId = active?.patient_id?._id || active?.patient_id || active?.patient?._id || active?.patient?.id;
    if (isDemo || !patientId) {
      notifyNurse({ tone: 'warning', title: 'Tạo nhiệm vụ theo bệnh nhân', message: 'Cần chọn bệnh nhân có patient_id hợp lệ.' });
      return;
    }
    const title = promptNurseText({
      title: template ? 'Tạo từ mẫu' : 'Tạo nhiệm vụ theo bệnh nhân',
      message: active?.patient?.full_name || 'Bệnh nhân đang chọn',
      defaultValue: template ? 'Theo dõi sinh hiệu định kỳ' : '',
    });
    if (!title) return;
    await runNurseAction({
      label: 'Tạo nhiệm vụ theo bệnh nhân',
      confirm: { title: 'Tạo nhiệm vụ?', message: title },
      run: () => nurseTaskHandoverApi.createTask({
        patient_id: patientId,
        title,
        task_type: template ? 'vital_sign' : 'other',
        priority: active?.acuity_level === 'critical' ? 'stat' : 'normal',
        source_type: 'manual',
        sla_minutes: template ? 30 : 60,
      }),
      successMessage: 'Đã tạo nhiệm vụ theo bệnh nhân.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
  }

  return (
    <CommandPage eyebrow="Danh sách việc theo bệnh nhân" title="Nhiệm vụ theo bệnh nhân" description="Ma trận nhiệm vụ theo bệnh nhân, phòng giường, nguy cơ và nhóm công việc." loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => createPatientTask(false)}><Plus size={16} />Tạo nhiệm vụ theo BN</button><button type="button" onClick={() => createPatientTask(true)}><ClipboardCheck size={16} />Từ mẫu</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      <KpiStrip items={[
        { label: 'BN có nhiệm vụ', value: data.summary?.patients, detail: 'Đang theo dõi', icon: Users, tone: 'blue' },
        { label: 'BN có quá hạn', value: data.summary?.with_overdue, detail: 'Cần ưu tiên', icon: AlertTriangle, tone: 'red' },
        { label: 'BN nguy cơ cao', value: data.summary?.high_risk, detail: 'Cao/nguy kịch', icon: ShieldAlert, tone: 'violet' },
        { label: 'Nhiệm vụ chờ', value: data.summary?.pending_tasks, detail: 'Chưa hoàn tất', icon: ClipboardList, tone: 'amber' },
        { label: 'Thuốc chờ xử lý', value: data.summary?.medication_pending, detail: 'Liên quan thuốc', icon: Pill, tone: 'green' },
        { label: 'Sinh hiệu', value: data.summary?.vital_pending, detail: 'Cần đo/theo dõi', icon: HeartPulse, tone: 'teal' },
      ]} />
      <FilterBar filters={filters} setFilters={setFilters}>
        <label><span>Chế độ xem</span><select value={view} onChange={(event) => setView(event.target.value)}><option value="matrix">Ma trận</option><option value="list">Danh sách</option><option value="timeline">Dòng thời gian</option></select></label>
      </FilterBar>
      <section className="nurse-th-patient-layout">
        <main className={`nurse-th-matrix is-${view}`}>
          <header><span>Bệnh nhân</span><span>Phòng/giường</span><span>Mức nguy cơ</span><span>Sinh hiệu</span><span>Thuốc</span><span>Xét nghiệm</span><span>CĐHA</span><span>Theo dõi</span><span>Báo BS</span><span>Chờ xử lý</span><span>Quá hạn</span></header>
          {patients.map((row) => <button key={row.patient_id} type="button" onClick={() => setSelected(row)} className={active?.patient_id === row.patient_id ? 'is-active' : ''}><strong>{row.patient?.full_name}<small>{row.patient?.patient_code}</small></strong><span>{row.room_name || '--'} · {row.bed_label || '--'}</span><em className={`is-${row.acuity_level}`}>{priorityLabels[row.acuity_level] || row.acuity_level}</em><span>{row.task_counts?.vital || 0}</span><span>{row.task_counts?.medication || 0}</span><span>{row.task_counts?.lab || 0}</span><span>{row.task_counts?.imaging || 0}</span><span>{row.task_counts?.monitoring || 0}</span><span>{row.task_counts?.doctor_report || 0}</span><span>{row.task_counts?.pending || 0}</span><b>{row.task_counts?.overdue || 0}</b></button>)}
        </main>
        <aside className="nurse-th-patient-drawer">
          <header><h2>{active?.patient?.full_name || 'Chưa chọn bệnh nhân'}</h2><p>{active?.patient?.patient_code || '--'} · {active?.room_name || '--'} · {active?.bed_label || '--'}</p><RiskBadges flags={active?.risk_tags || []} /></header>
          <section><h3>Tổng quan</h3><div className="nurse-th-vital-box"><VitalsLine vitals={active?.latest_vitals} /></div></section>
          <section><h3>Dòng thời gian nhiệm vụ</h3><div className="nurse-th-timeline">{safeList(active?.tasks).slice(0, 8).map((task) => <article key={task.id || task.task_id}><strong>{formatTime(task.due_at)}</strong><span>{task.title}</span><em>{statusLabels[task.status] || task.status}</em></article>)}</div></section>
          <section><h3>Bàn giao</h3><p>{active?.task_counts?.handoff ? 'Có nhiệm vụ nằm trong bàn giao hiện tại.' : 'Chưa gắn bàn giao.'}</p></section>
        </aside>
      </section>
    </CommandPage>
  );
}

export function OverdueTasksPage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', status: 'all', type: 'all', source: 'all', search: '' });
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState('');
  const fallback = { items: demoTasks.filter((task) => task.status === 'overdue'), summary: { total: 6, over_15: 4, over_30: 2, over_60: 1, stat: 2, medication: 3, no_assignee: 1 }, workload: { items: [{ full_name: 'ĐD A', total: 16, overdue: 5 }, { full_name: 'ĐD B', total: 4, overdue: 0 }] } };
  const { data, loading, isDemo, error } = useNursingData(async () => {
    const [tasks, workload] = await Promise.all([nurseTaskHandoverApi.getOverdueTasks(queryParams(filters)), nurseTaskHandoverApi.getWorkload(queryParams(filters))]);
    return { ...tasks, workload };
  }, fallback, [filters.date, filters.shift, filters.priority, filters.search, refresh]);
  const tasks = taskFilter(data.items, 'all', filters);
  const handleAction = makeTaskAction(setRefresh, setToast, isDemo);
  const active = selected || tasks[0];

  async function autoReassignOverdue() {
    const ids = tasks.slice(0, 10).map((task) => task.id || task.task_id).filter(Boolean);
    const assignee = promptNurseText({ title: 'Tự phân bổ nhiệm vụ quá hạn', message: 'Nhập user_id điều dưỡng nhận việc. Tối đa 10 nhiệm vụ quá hạn đầu tiên sẽ được phân bổ.', defaultValue: '' });
    if (!assignee) return;
    await runNurseAction({
      label: 'Tự phân bổ',
      isDemo: isDemo || !ids.length,
      demoMessage: 'Không có task_id hợp lệ để phân bổ.',
      confirm: { title: 'Xác nhận phân bổ?', message: `Phân bổ ${ids.length} nhiệm vụ cho ${assignee}.` },
      run: () => nurseTaskHandoverApi.bulkReassign({ task_ids: ids, assigned_to: assignee, reason: 'Tự phân bổ từ bảng nhiệm vụ quá hạn.' }),
      successMessage: 'Đã gửi phân bổ nhiệm vụ quá hạn.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
  }

  return (
    <CommandPage eyebrow="Trung tâm rủi ro thời gian thực" title="Nhiệm vụ quá hạn" description="Trung tâm kiểm soát rủi ro nhiệm vụ quá hạn, báo khẩn và phân bổ lại khối lượng công việc." loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button><button type="button" onClick={autoReassignOverdue}><ArrowRightLeft size={16} />Tự phân bổ</button><button type="button" onClick={() => downloadNurseJson('nhiem-vu-qua-han.json', { filters, summary: data.summary, items: tasks })}><Download size={16} />Xuất báo cáo</button></>}>
      {toast ? <div className="nurse-th-toast">{toast}<button type="button" onClick={() => setToast('')}><X size={14} /></button></div> : null}
      <KpiStrip items={[
        { label: 'Tổng quá hạn', value: data.summary?.total || tasks.length, detail: 'Đang mở', icon: AlertTriangle, tone: 'red' },
        { label: '> 15 phút', value: data.summary?.over_15 || tasks.filter((task) => task.overdue_minutes > 15).length, detail: 'Cảnh báo', icon: Clock3, tone: 'amber' },
        { label: '> 30 phút', value: data.summary?.over_30 || tasks.filter((task) => task.overdue_minutes > 30).length, detail: 'Nguy cơ', icon: ShieldAlert, tone: 'rose' },
        { label: 'STAT quá hạn', value: data.summary?.stat || tasks.filter((task) => ['stat', 'critical'].includes(task.priority)).length, detail: 'Xử lý ngay', icon: Zap, tone: 'violet' },
        { label: 'Thuốc quá hạn', value: data.summary?.medication || tasks.filter((task) => task.task_group === 'medication').length, detail: 'An toàn thuốc', icon: Pill, tone: 'green' },
        { label: 'Chưa có người nhận', value: data.summary?.no_assignee || tasks.filter((task) => !task.assigned_to).length, detail: 'Cần phân công', icon: Users, tone: 'slate' },
      ]} />
      <FilterBar filters={filters} setFilters={setFilters} />
      <section className="nurse-th-overdue-layout">
        <main className="nurse-th-overdue-table">
          <table>
            <thead><tr><th>Nguy cơ</th><th>Quá hạn</th><th>Bệnh nhân</th><th>Nhiệm vụ</th><th>Loại</th><th>Phụ trách</th><th>Báo khẩn</th><th>Thao tác</th></tr></thead>
            <tbody>{tasks.map((task) => <tr key={task.id || task.task_id} onClick={() => setSelected(task)}><td><span className={`nurse-th-priority nurse-th-priority--${task.priority}`}>{priorityLabels[task.priority]}</span></td><td><strong>{minutesText(task.overdue_minutes)}</strong></td><td>{patientName(task)}<small>{task.room_name || '--'} · {task.bed_label || '--'}</small></td><td>{task.title}<small><VitalsLine vitals={task.latest_vitals} /></small></td><td>{typeLabels[task.task_type] || task.task_type}</td><td>{task.assigned_to_name || 'Chưa phân công'}</td><td>{task.escalation_level || 0}</td><td><div><button type="button" onClick={(event) => { event.stopPropagation(); handleAction('escalate', task); }}><Bell size={14} />Báo khẩn</button><button type="button" onClick={(event) => { event.stopPropagation(); handleAction('complete', task); }}><CheckCircle2 size={14} />Xong</button></div></td></tr>)}</tbody>
          </table>
        </main>
        <aside className="nurse-th-analytics">
          <h3><Activity size={16} /> Phân tích quá hạn</h3>
          {safeList(data.workload?.items).slice(0, 5).map((item) => <article key={item.user_id || item.full_name}><strong>{item.full_name}</strong><span>{item.total} nhiệm vụ · {item.overdue} quá hạn</span><em style={{ width: `${Math.min(100, (item.overdue || 0) * 18)}%` }} /></article>)}
          <div className="nurse-th-recommendation">Gợi ý: chuyển bớt nhiệm vụ thường quy từ điều dưỡng có nhiều việc quá hạn sang người đang còn tải thấp.</div>
        </aside>
      </section>
      <TaskDrawer task={active} onClose={() => setSelected(null)} onAction={handleAction} />
    </CommandPage>
  );
}

export function CompletedTasksPage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', status: 'all', type: 'all', source: 'all', search: '' });
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const completedDemo = { ...demoAssigned, items: demoTasks.map((task) => ({ ...task, status: 'done', raw_status: 'done', completed_at: new Date(now - 20 * 60000).toISOString(), completed_by: { full_name: 'ĐD Mai' }, result_note: 'Đã hoàn tất và ghi nhận vào hồ sơ.' })), summary: { total: 87, done: 87, late: 9, review: 6, escalated: 3 } };
  const { data, loading, isDemo, error } = useNursingData(() => nurseTaskHandoverApi.getCompletedTasks(queryParams(filters)), completedDemo, [filters.date, filters.shift, filters.priority, filters.search, refresh]);
  const tasks = taskFilter(data.items, 'all', filters);
  const active = selected || tasks[0];

  async function requestQualityReview() {
    const taskId = active?.id || active?.task_id || active?._id;
    await runNurseAction({
      label: 'Rà soát chất lượng',
      isDemo: isDemo || !taskId,
      demoMessage: 'Cần chọn nhiệm vụ thật để yêu cầu rà soát.',
      confirm: { title: 'Yêu cầu rà soát?', message: active?.title || 'Nhiệm vụ đang chọn' },
      run: () => nurseTaskHandoverApi.requestReview(taskId, { reason: 'Rà soát chất lượng từ danh sách nhiệm vụ hoàn tất.' }),
      successMessage: 'Đã gửi yêu cầu rà soát chất lượng.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
  }

  return (
    <CommandPage eyebrow="Rà soát chất lượng và kiểm tra" title="Nhiệm vụ đã hoàn tất" description="Kiểm tra nhiệm vụ hoàn tất, đúng hạn/trễ, bằng chứng và rà soát chất lượng chăm sóc." loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => downloadNurseJson('nhiem-vu-hoan-tat.json', { filters, summary: data.summary, items: tasks })}><Download size={16} />Excel</button><button type="button" onClick={() => printNurseView('In nhiệm vụ hoàn tất')}><FileText size={16} />PDF</button><button type="button" onClick={requestQualityReview}><ClipboardCheck size={16} />Rà soát chất lượng</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      <KpiStrip items={[
        { label: 'Hoàn tất hôm nay', value: data.summary?.total || tasks.length, detail: 'Theo ngày/ca', icon: CheckCircle2, tone: 'green' },
        { label: 'Đúng hạn', value: (data.summary?.total || tasks.length) - (data.summary?.late || 0), detail: 'SLA đạt', icon: Clock3, tone: 'teal' },
        { label: 'Hoàn tất trễ', value: data.summary?.late || tasks.filter((task) => task.completed_late_reason).length, detail: 'Cần lý do', icon: AlertTriangle, tone: 'amber' },
        { label: 'Sau báo khẩn', value: data.summary?.escalated || tasks.filter((task) => task.escalation_level).length, detail: 'Có can thiệp', icon: Bell, tone: 'violet' },
        { label: 'Cần rà soát', value: data.summary?.review || tasks.filter((task) => task.quality_review_status === 'pending_review').length, detail: 'Điều dưỡng trưởng', icon: ClipboardCheck, tone: 'blue' },
      ]} />
      <FilterBar filters={filters} setFilters={setFilters} />
      <section className="nurse-th-completed-layout">
        <main className="nurse-th-overdue-table">
          <table><thead><tr><th>Hoàn tất</th><th>Bệnh nhân</th><th>Nhiệm vụ</th><th>Loại</th><th>Người làm</th><th>Hạn xử lý</th><th>Kết quả</th><th>Rà soát</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id || task.task_id} onClick={() => setSelected(task)}><td>{formatTime(task.completed_at)}</td><td>{patientName(task)}<small>{task.room_name || '--'} · {task.bed_label || '--'}</small></td><td>{task.title}<small>{task.task_code}</small></td><td>{typeLabels[task.task_type] || task.task_type}</td><td>{task.completed_by?.full_name || task.assigned_to_name || '--'}</td><td>{formatTime(task.due_at)}</td><td>{task.result_note || task.latest_note || '--'}</td><td>{statusLabels[task.quality_review_status] || task.quality_review_status || 'Không có'}</td></tr>)}</tbody></table>
        </main>
        <TaskDrawer task={active} onClose={() => setSelected(null)} />
      </section>
    </CommandPage>
  );
}

function HandoffSummaryKpis({ handoff }) {
  const counts = handoff?.summary_counts || {};
  return <KpiStrip items={[
    { label: 'BN bàn giao', value: counts.patients, detail: 'Tổng bệnh nhân', icon: Users, tone: 'blue' },
    { label: 'Nguy cơ cao', value: counts.high_risk, detail: 'Cao/nguy kịch', icon: ShieldAlert, tone: 'violet' },
    { label: 'Nhiệm vụ chờ', value: counts.pending_tasks, detail: 'Chưa hoàn tất', icon: ClipboardList, tone: 'amber' },
    { label: 'Nhiệm vụ quá hạn', value: counts.overdue_tasks, detail: 'Cần ưu tiên', icon: AlertTriangle, tone: 'red' },
    { label: 'Thuốc chú ý', value: counts.pending_medications, detail: 'Sắp tới giờ', icon: Pill, tone: 'green' },
    { label: 'Chưa xác nhận', value: counts.unacknowledged, detail: 'Người nhận', icon: UserCheck, tone: 'slate' },
  ]} />;
}

export function ShiftHandoverPage() {
  const [selectedHandoff, setSelectedHandoff] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState('');
  const { data, loading, isDemo, error } = useNursingData(() => nurseTaskHandoverApi.getActiveHandoffs({ date: toLocalDateKey() }), { items: [demoHandoff], summary: demoHandoffs.summary }, [refresh]);
  const handoff = selectedHandoff || safeList(data.items)[0] || demoHandoff;
  const patientItem = selectedPatient || handoff?.patient_items?.[0];

  async function run(action, item = patientItem) {
    const handoffId = handoff?.handoff_id || handoff?.id || handoff?._id;
    if (!handoffId && action !== 'generate') {
      const message = 'Chưa chọn bàn giao hợp lệ.';
      setToast(message);
      notifyNurse({ tone: 'warning', title: 'Bàn giao ca', message });
      return;
    }
    const reason = action === 'reject'
      ? promptNurseText({ title: 'Từ chối bàn giao', message: 'Nhập lý do từ chối để người giao bổ sung.', defaultValue: 'Cần bổ sung thông tin bàn giao.' })
      : null;
    if (action === 'reject' && !reason) return;
    await runNurseAction({
      label: action === 'generate' ? 'Tạo nháp bàn giao' : action === 'submit' ? 'Gửi bàn giao' : action === 'accept' ? 'Nhận bàn giao' : action === 'ack' ? 'Xác nhận bệnh nhân' : action === 'export' ? 'Xuất PDF bàn giao' : 'Từ chối bàn giao',
      isDemo,
      demoMessage: 'Dữ liệu mẫu: thao tác bàn giao chưa được gửi.',
      confirm: ['submit', 'accept', 'reject', 'ack'].includes(action) ? { title: 'Xác nhận bàn giao', message: statusLabels[handoff?.status] ? `${handoff.handoff_code} - ${statusLabels[handoff.status]}` : handoff?.handoff_code || 'Bàn giao đang chọn' } : null,
      run: async () => {
        if (action === 'generate') return nurseTaskHandoverApi.generateDraft({ shift_date: toLocalDateKey(), from_shift: 'morning', to_shift: 'afternoon' });
        if (action === 'submit') return nurseTaskHandoverApi.submitHandoff(handoffId);
        if (action === 'accept') return nurseTaskHandoverApi.acceptHandoff(handoffId);
        if (action === 'reject') return nurseTaskHandoverApi.rejectHandoff(handoffId, { rejection_reason: reason });
        if (action === 'ack') return nurseTaskHandoverApi.acknowledgePatient(handoffId, item.item_id, { note: 'Đã nhận thông tin bệnh nhân.' });
        if (action === 'export') return nurseTaskHandoverApi.exportHandoffPdf(handoffId);
        return null;
      },
      successMessage: 'Đã cập nhật bàn giao.',
      onSuccess: (result) => {
        if (action === 'generate') setSelectedHandoff(result);
        if (action === 'export') downloadNurseJson(`${handoff?.handoff_code || 'handoff'}.json`, result || handoff, 'Xuất bàn giao');
        setToast('Đã cập nhật bàn giao.');
        setRefresh((value) => value + 1);
      },
    });
    if (!isDemo) {
      setToast((current) => current || 'Thao tác bàn giao đã được gửi.');
    }
  }

  return (
    <CommandPage eyebrow="Không gian bàn giao SBAR" title="Bàn giao ca" description="SBAR theo từng bệnh nhân, nhiệm vụ chờ xử lý, cảnh báo và xác nhận người nhận." loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => run('generate')}><Zap size={16} />Tạo nháp tự động</button><button type="button" onClick={() => run('submit')}><Send size={16} />Gửi bàn giao</button><button type="button" onClick={() => run('accept')}><CheckCircle2 size={16} />Nhận toàn bộ</button><button type="button" onClick={() => run('export')}><Download size={16} />PDF</button></>}>
      {toast ? <div className="nurse-th-toast">{toast}<button type="button" onClick={() => setToast('')}><X size={14} /></button></div> : null}
      <HandoffSummaryKpis handoff={handoff} />
      <section className="nurse-th-handoff-status">
        <strong>{handoff?.handoff_code}</strong><span>{handoff?.from_user_name || 'Người giao'} → {handoff?.to_user_name || roleLabels[handoff?.to_team_role] || handoff?.to_team_role || 'Nhóm nhận'}</span><em>{statusLabels[handoff?.status] || handoff?.status}</em><p>{handoff?.risk_summary}</p>
      </section>
      <section className="nurse-th-handoff-layout">
        <aside className="nurse-th-handoff-patients">
          <header><h3>Danh sách bệnh nhân</h3><span>{handoff?.patient_items?.length || 0}</span></header>
          {safeList(handoff?.patient_items).map((item) => <button key={item.item_id} type="button" className={patientItem?.item_id === item.item_id ? 'is-active' : ''} onClick={() => setSelectedPatient(item)}><strong>{item.patient?.full_name || item.patient_id}</strong><small>{item.bed_label || '--'} · chờ {item.pending_task_ids?.length || 0} · quá hạn {item.overdue_task_ids?.length || 0}</small><RiskBadges flags={item.flags} /><em>{item.receiver_acknowledged ? 'Đã xác nhận' : 'Chưa xác nhận'}</em></button>)}
        </aside>
        <main className="nurse-th-sbar">
          <header><span className={`nurse-th-priority nurse-th-priority--${patientItem?.acuity_level === 'critical' ? 'stat' : patientItem?.acuity_level === 'high' ? 'urgent' : 'normal'}`}>{priorityLabels[patientItem?.acuity_level] || patientItem?.acuity_level}</span><h2>{patientItem?.patient?.full_name || 'Chưa chọn bệnh nhân'}</h2><p>{patientItem?.patient?.patient_code || '--'} · {patientItem?.bed_label || '--'}</p></header>
          {[['S', 'Tình huống', patientItem?.situation], ['B', 'Bối cảnh', patientItem?.background], ['A', 'Đánh giá', patientItem?.assessment], ['R', 'Khuyến nghị', patientItem?.recommendation]].map(([letter, label, value]) => <section key={letter}><strong>{letter}</strong><div><span>{label}</span><textarea value={value || ''} readOnly /></div></section>)}
        </main>
        <aside className="nurse-th-handoff-right">
          <section><h3><ClipboardList size={16} /> Nhiệm vụ chờ xử lý</h3>{safeList(patientItem?.pending_task_ids).slice(0, 8).map((task) => <article key={task.id || task.task_id || task}><strong>{task.title || task.task_code || task}</strong><span>{task.due_at ? formatTime(task.due_at) : '--'}</span></article>)}</section>
          <section><h3><AlertTriangle size={16} /> Cảnh báo</h3><RiskBadges flags={patientItem?.flags} /></section>
          <section><h3><UserCheck size={16} /> Xác nhận</h3><button type="button" onClick={() => run('ack', patientItem)}><CheckCircle2 size={15} />Xác nhận bệnh nhân này</button><button type="button" onClick={() => run('reject')}><X size={15} />Từ chối nhận</button></section>
        </aside>
      </section>
    </CommandPage>
  );
}

export function HandoverHistoryPage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'all', priority: 'all', status: 'all', type: 'all', source: 'all', search: '' });
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useNursingData(() => nurseTaskHandoverApi.getHandoffHistory({ date: filters.date, status: filters.status === 'all' ? undefined : filters.status }), demoHandoffs, [filters.date, filters.status, refresh]);
  const handoffs = safeList(data.items);
  const active = selected || handoffs[0];

  return (
    <CommandPage eyebrow="Lịch sử kiểm tra bàn giao" title="Lịch sử bàn giao" description="Truy vết bàn giao, xác nhận bệnh nhân, nhiệm vụ tồn và chất lượng ca trực." loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => downloadNurseJson('lich-su-ban-giao.json', { filters, summary: data.summary, items: handoffs })}><Download size={16} />Excel</button><button type="button" onClick={() => printNurseView('In lịch sử bàn giao')}><FileText size={16} />PDF</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      <KpiStrip items={[
        { label: 'Tổng bàn giao', value: data.summary?.total, detail: 'Theo bộ lọc', icon: ArrowRightLeft, tone: 'blue' },
        { label: 'Đã nhận', value: data.summary?.accepted, detail: 'Đã xác nhận', icon: CheckCircle2, tone: 'green' },
        { label: 'Đã gửi', value: data.summary?.submitted, detail: 'Chờ nhận', icon: Send, tone: 'amber' },
        { label: 'Bị từ chối', value: data.summary?.rejected, detail: 'Cần xem lại', icon: X, tone: 'red' },
        { label: 'Có nguy cơ', value: data.summary?.high_risk, detail: 'Cao/nguy kịch', icon: ShieldAlert, tone: 'violet' },
        { label: 'Nhiệm vụ quá hạn', value: data.summary?.overdue_tasks, detail: 'Trong bàn giao', icon: AlertTriangle, tone: 'rose' },
      ]} />
      <FilterBar filters={filters} setFilters={setFilters}><label><span>Trạng thái</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Tất cả</option><option value="submitted">Đã gửi</option><option value="accepted">Đã nhận</option><option value="rejected">Từ chối</option><option value="reopened">Mở lại</option></select></label></FilterBar>
      <section className="nurse-th-history-layout">
        <main className="nurse-th-overdue-table"><table><thead><tr><th>Mã</th><th>Ngày</th><th>Ca giao</th><th>Ca nhận</th><th>Khoa</th><th>Người giao</th><th>Người nhận</th><th>BN</th><th>Chờ xử lý</th><th>Quá hạn</th><th>Trạng thái</th></tr></thead><tbody>{handoffs.map((item) => <tr key={item.handoff_id} onClick={() => setSelected(item)}><td><strong>{item.handoff_code}</strong></td><td>{formatDate(item.shift_date)}</td><td>{shiftLabels[item.from_shift] || item.from_shift}</td><td>{shiftLabels[item.to_shift] || item.to_shift}</td><td>{item.department_name || '--'}</td><td>{item.from_user_name || '--'}</td><td>{item.to_user_name || roleLabels[item.to_team_role] || item.to_team_role || '--'}</td><td>{item.summary_counts?.patients || 0}</td><td>{item.summary_counts?.pending_tasks || 0}</td><td>{item.summary_counts?.overdue_tasks || 0}</td><td><span className="nurse-th-status">{statusLabels[item.status] || item.status}</span></td></tr>)}</tbody></table></main>
        <aside className="nurse-th-history-drawer"><header><h2>{active?.handoff_code || 'Chưa chọn bàn giao'}</h2><p>{shiftLabels[active?.from_shift] || active?.from_shift} → {shiftLabels[active?.to_shift] || active?.to_shift} · {statusLabels[active?.status] || active?.status}</p></header><section><h3>Danh sách bệnh nhân</h3>{safeList(active?.patient_items).slice(0, 6).map((item) => <article key={item.item_id}><strong>{item.patient?.full_name || item.patient_id}</strong><span>{priorityLabels[item.acuity_level] || item.acuity_level} · {item.receiver_acknowledged ? 'đã xác nhận' : 'chưa xác nhận'}</span></article>)}</section><section><h3>Nhật ký kiểm tra</h3><div className="nurse-th-timeline"><article><strong>Đã tạo</strong><span>{formatTime(active?.created_at)}</span></article>{active?.submitted_at ? <article><strong>Đã gửi</strong><span>{formatTime(active.submitted_at)}</span></article> : null}{active?.accepted_at ? <article><strong>Đã nhận</strong><span>{formatTime(active.accepted_at)}</span></article> : null}</div></section></aside>
      </section>
    </CommandPage>
  );
}
