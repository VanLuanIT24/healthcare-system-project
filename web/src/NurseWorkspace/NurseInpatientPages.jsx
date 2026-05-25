import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Bed,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Filter,
  HeartPulse,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  ScanLine,
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
import { nurseInpatientApi } from './nurseApi';
import { confirmNurseAction, downloadNurseJson, notifyNurse, printNurseView, promptNurseText, runNurseAction } from './nurseActions';

const now = Date.now();

const shiftLabels = {
  morning: 'Ca sáng',
  afternoon: 'Ca chiều',
  night: 'Ca đêm',
  all: 'Tất cả ca',
};

const priorityLabels = {
  low: 'Thấp',
  normal: 'Bình thường',
  medium: 'Trung bình',
  high: 'Cao',
  urgent: 'Khẩn',
  stat: 'STAT',
  critical: 'Nguy kịch',
};

const statusLabels = {
  unknown: 'Chưa rõ',
  planned: 'Dự kiến',
  admitted: 'Đã nhập viện',
  transferred: 'Đã chuyển',
  discharged: 'Đã ra viện',
  cancelled: 'Đã hủy',
  available: 'Còn trống',
  occupied: 'Đang dùng',
  reserved: 'Đã giữ',
  maintenance: 'Bảo trì',
  blocked: 'Đang khóa',
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  overdue: 'Quá hạn',
  done: 'Hoàn tất',
  scheduled: 'Đã lên lịch',
  given: 'Đã dùng',
  held: 'Tạm hoãn',
  refused: 'Từ chối',
  omitted: 'Bỏ qua',
  prepared: 'Đã chuẩn bị',
  signed: 'Đã ký',
  acknowledged: 'Đã xác nhận',
  submitted: 'Đã gửi',
  accepted: 'Đã nhận',
  closed: 'Đã đóng',
};

const admissionTypeLabels = {
  elective: 'Chủ động',
  emergency: 'Cấp cứu',
  transfer: 'Chuyển viện',
  planned: 'Dự kiến',
};

const taskTypeLabels = {
  round: 'Đi buồng',
  vital_sign: 'Sinh hiệu',
  medication: 'Thuốc',
  discharge_checklist: 'Bảng kiểm ra viện',
};

function toLocalDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDate(value) {
  if (!value) return '--/--/----';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--/--/----';
  return date.toLocaleDateString('vi-VN');
}

function formatTime(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function minutesText(value = 0) {
  const minutes = Math.max(0, Math.round(Number(value || 0)));
  if (minutes < 60) return `${minutes} phút`;
  return `${Math.floor(minutes / 60)}g ${minutes % 60}p`;
}

function safeList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function patientName(item = {}) {
  return item.patient?.full_name
    || item.patient_id?.full_name
    || item.patient?.patient_name
    || item.patient_name
    || item.admission?.patient_id?.full_name
    || 'Chưa rõ bệnh nhân';
}

function admissionNo(item = {}) {
  return item.admission?.admission_no || item.admission_no || item.admission_id?.admission_no || '--';
}

function roomBedText(item = {}) {
  const room = item.room?.room_code || item.current_bed_assignment?.bed_id?.room_id?.room_code || item.room_id?.room_code || item.room_name;
  const bed = item.bed?.bed_code || item.current_bed_assignment?.bed_id?.bed_code || item.bed_id?.bed_code || item.bed_label;
  return [room, bed].filter(Boolean).join(' / ') || 'Chưa phân giường';
}

function dueStatus(value) {
  if (!value) return { label: 'Không SLA', tone: 'slate', minutes: null };
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (minutes < 0) return { label: `Quá ${minutesText(Math.abs(minutes))}`, tone: 'red', minutes };
  if (minutes <= 30) return { label: `Còn ${minutesText(minutes)}`, tone: 'amber', minutes };
  return { label: `Còn ${minutesText(minutes)}`, tone: 'green', minutes };
}

function useInpatientData(loader, fallback, deps) {
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
        setError(loadError?.message || 'Không thể tải dữ liệu nội trú.');
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

function PageFrame({ eyebrow, title, loading, isDemo, error, actions, children }) {
  return (
    <section className="nurse-ip-page">
      <header className="nurse-ip-header">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <div className="nurse-ip-header__meta">
            <em>Khoa/phòng theo phân quyền</em>
            <em>{formatDate(new Date())}</em>
            <em>{isDemo ? 'Dữ liệu mẫu' : 'API nội trú'}</em>
          </div>
        </div>
        <aside>
          <span className={`nurse-ip-live${isDemo ? ' is-offline' : ''}`}>
            {isDemo ? <WifiOff size={15} /> : <Wifi size={15} />}
            {isDemo ? 'Dữ liệu mẫu' : 'Thời gian thực sẵn sàng'}
          </span>
          <div className="nurse-ip-actions">{actions}</div>
        </aside>
      </header>
      {isDemo && error ? <div className="nurse-ip-demo"><AlertTriangle size={16} />{error}</div> : null}
      {loading ? <div className="nurse-ip-loading"><Loader2 className="is-spinning" size={18} />Đang đồng bộ dữ liệu...</div> : null}
      {children}
    </section>
  );
}

function Kpis({ items }) {
  return (
    <section className="nurse-ip-kpis">
      {items.map((item) => {
        const Icon = item.icon || Activity;
        return (
          <button key={item.label} type="button" className={`nurse-ip-kpi nurse-ip-kpi--${item.tone || 'blue'}`} onClick={item.onClick || (() => notifyNurse({ title: item.label, message: item.detail || 'Đã chọn chỉ số nội trú.' }))}>
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
    <section className="nurse-ip-filters">
      <label><span>Khoa</span><input value={filters.department_id || ''} onChange={(event) => setFilters((current) => ({ ...current, department_id: event.target.value }))} placeholder="Theo phân quyền" /></label>
      <label><span>Phòng</span><input value={filters.room || ''} onChange={(event) => setFilters((current) => ({ ...current, room: event.target.value }))} placeholder="VD: 301" /></label>
      <label><span>Trạng thái</span><select value={filters.status || 'all'} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Tất cả</option><option value="planned">Dự kiến</option><option value="admitted">Đã nhập viện</option><option value="transferred">Đã chuyển</option><option value="discharged">Đã ra viện</option><option value="cancelled">Đã hủy</option></select></label>
      <label className="nurse-ip-search"><span>Tìm kiếm</span><div><Search size={15} /><input value={filters.search || ''} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Tên, mã nhập viện, mã giường" /></div></label>
      {children}
    </section>
  );
}

function StatusPill({ value, type = 'status' }) {
  const normalized = String(value || 'unknown');
  const label = type === 'priority' ? priorityLabels[normalized] : statusLabels[normalized];
  return <span className={`nurse-ip-pill nurse-ip-pill--${type}-${normalized}`}>{label || normalized.replace(/_/g, ' ')}</span>;
}

function VitalsLine({ vitals }) {
  if (!vitals) return <span>Chưa có sinh hiệu</span>;
  return (
    <span>
      HA {vitals.systolic_bp ?? '--'}/{vitals.diastolic_bp ?? '--'} · Mạch {vitals.heart_rate ?? '--'} · SpO2 {vitals.spo2 ?? '--'}% · Nhiệt {vitals.temperature ?? '--'} · Đau {vitals.pain_score ?? '--'}
    </span>
  );
}

function RiskBadges({ values = [] }) {
  const items = Array.isArray(values) ? values : [];
  return (
    <div className="nurse-ip-badges">
      {items.slice(0, 5).map((item) => <span key={item.message || item.allergen || item.problem_name || item}>{item.message || item.allergen || item.problem_name || item}</span>)}
      {!items.length ? <span className="is-muted">Không cảnh báo</span> : null}
    </div>
  );
}

const demoWardBoard = {
  summary: {
    active_admissions: 42,
    pending_bed_assignment: 5,
    occupied_beds: 38,
    available_beds: 12,
    reserved_beds: 2,
    maintenance_beds: 1,
    abnormal_vitals: 6,
    high_risk_patients: 4,
    overdue_tasks: 9,
    medication_due_now: 11,
    medication_overdue: 3,
    planned_discharge_today: 4,
  },
  items: [
    {
      admission_id: 'adm-demo-1',
      admission: { admission_no: 'IP-2026-00012', status: 'admitted', admitted_at: new Date(now - 74 * 3600000).toISOString(), reason: 'Theo dõi tăng huyết áp', priority: 'critical' },
      patient: { patient_code: 'BN000123', full_name: 'Nguyễn Văn A', gender: 'male', date_of_birth: '1959-02-15' },
      department: { department_name: 'Khoa Nội tổng hợp' },
      attending_doctor: { full_name: 'BS Minh' },
      room: { room_code: '301', room_name: 'Phòng 301' },
      bed: { bed_code: '301-02', bed_type: 'standard', status: 'occupied' },
      latest_vitals: { systolic_bp: 165, diastolic_bp: 95, heart_rate: 110, spo2: 92, temperature: 38.1, pain_score: 3, severity: 'critical' },
      vital_alerts: [{ level: 'critical', message: 'SpO2 thấp và HA cao' }],
      allergies: [{ allergen: 'Penicillin', severity: 'severe' }],
      problems: [{ problem_name: 'Tăng huyết áp' }],
      open_tasks_count: 4,
      overdue_tasks_count: 1,
      medication_due_count: 2,
      medication_overdue_count: 1,
      charges_summary: { count: 2, total_amount: 1800000, pending_count: 1 },
      los_days: 3,
      high_risk: true,
    },
    {
      admission_id: 'adm-demo-2',
      admission: { admission_no: 'IP-2026-00013', status: 'admitted', admitted_at: new Date(now - 29 * 3600000).toISOString(), reason: 'Theo dõi thiếu máu', priority: 'routine', expected_discharge_at: new Date(now + 6 * 3600000).toISOString() },
      patient: { patient_code: 'BN000245', full_name: 'Trần Thị B', gender: 'female', date_of_birth: '1986-09-20' },
      department: { department_name: 'Khoa Nội tổng hợp' },
      attending_doctor: { full_name: 'BS Lan' },
      room: { room_code: '304', room_name: 'Phòng 304' },
      bed: { bed_code: '304-01', bed_type: 'standard', status: 'occupied' },
      latest_vitals: { systolic_bp: 118, diastolic_bp: 76, heart_rate: 78, spo2: 98, temperature: 36.8, pain_score: 1, severity: 'normal' },
      vital_alerts: [],
      allergies: [],
      problems: [{ problem_name: 'Thiếu máu' }],
      open_tasks_count: 3,
      overdue_tasks_count: 0,
      medication_due_count: 1,
      medication_overdue_count: 0,
      charges_summary: { count: 1, total_amount: 650000, pending_count: 0 },
      los_days: 1,
      high_risk: false,
    },
  ],
};

const demoWardMap = {
  summary: { total_rooms: 9, total_beds: 52, available: 12, occupied: 38, reserved: 2, maintenance: 1, blocked: 0, inactive: 0, data_mismatch_active_assignment_on_available_bed: 1 },
  buildings: [
    {
      building: 'A',
      floors: [
        {
          floor: '3',
          rooms: [
            {
              room: { room_id: 'room-301', room_code: '301', room_name: 'Phòng 301', room_type: 'ward', status: 'active', capacity: 4, department_id: { department_name: 'Khoa Nội tổng hợp' } },
              bed_summary: { total_beds: 4, occupied: 3, available: 1, reserved: 0, maintenance: 0, blocked: 0, inactive: 0 },
              beds: [
                { bed: { bed_id: 'bed-301-01', bed_code: '301-01', bed_type: 'standard', status: 'occupied' }, patient: { full_name: 'Nguyễn Văn A', patient_code: 'BN000123' }, admission: { admission_no: 'IP-2026-00012', admitted_at: new Date(now - 74 * 3600000).toISOString() }, warnings: [] },
                { bed: { bed_id: 'bed-301-02', bed_code: '301-02', bed_type: 'standard', status: 'available' }, patient: null, admission: null, warnings: ['active_assignment_on_available_bed'] },
                { bed: { bed_id: 'bed-301-03', bed_code: '301-03', bed_type: 'isolation', status: 'reserved' }, patient: null, admission: null, warnings: [] },
                { bed: { bed_id: 'bed-301-04', bed_code: '301-04', bed_type: 'standard', status: 'maintenance' }, patient: null, admission: null, warnings: [] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const demoTasks = {
  summary: { total: 18, todo: 7, in_progress: 4, done: 5, cancelled: 0, overdue: 2 },
  items: [
    { task_id: 'ipt-1', title: 'Đo lại sinh hiệu sau thuốc hạ áp', type: 'vital_sign', status: 'overdue', raw_status: 'todo', priority: 'urgent', patient: demoWardBoard.items[0].patient, admission: demoWardBoard.items[0].admission, room: demoWardBoard.items[0].room, bed: demoWardBoard.items[0].bed, due_at: new Date(now - 12 * 60000).toISOString(), overdue_minutes: 12, assigned_to_name: 'ĐD Mai' },
    { task_id: 'ipt-2', title: 'Chuẩn bị bảng kiểm xuất viện', type: 'discharge_checklist', status: 'todo', raw_status: 'todo', priority: 'high', patient: demoWardBoard.items[1].patient, admission: demoWardBoard.items[1].admission, room: demoWardBoard.items[1].room, bed: demoWardBoard.items[1].bed, due_at: new Date(now + 45 * 60000).toISOString(), assigned_to_name: null },
    { task_id: 'ipt-3', title: 'Đi buồng và đánh giá nguy cơ té ngã', type: 'round', status: 'in_progress', raw_status: 'in_progress', priority: 'normal', patient: demoWardBoard.items[0].patient, admission: demoWardBoard.items[0].admission, room: demoWardBoard.items[0].room, bed: demoWardBoard.items[0].bed, due_at: new Date(now + 90 * 60000).toISOString(), assigned_to_name: 'ĐD Hương' },
  ],
};

const demoMedications = {
  summary: { total: 24, due_now: 7, overdue: 2, given: 11, held: 1, refused: 1, omitted: 0 },
  items: [
    { administration_id: 'emar-1', scheduled_at: new Date(now - 35 * 60000).toISOString(), status: 'scheduled', dose: '1 viên', route: 'PO', site: '', patient: demoWardBoard.items[0].patient, admission: demoWardBoard.items[0].admission, medication: { name: 'Amlodipine', generic_name: 'Amlodipine 5mg' }, prescription_item: { instructions: 'Uống sau ăn sáng' }, is_overdue: true },
    { administration_id: 'emar-2', scheduled_at: new Date(now + 18 * 60000).toISOString(), status: 'scheduled', dose: '500mg', route: 'IV', site: 'Tay trái', patient: demoWardBoard.items[1].patient, admission: demoWardBoard.items[1].admission, medication: { name: 'Ceftriaxone', generic_name: 'Ceftriaxone' }, prescription_item: { instructions: 'Truyền tĩnh mạch' }, is_due_now: true },
    { administration_id: 'emar-3', scheduled_at: new Date(now - 90 * 60000).toISOString(), administered_at: new Date(now - 70 * 60000).toISOString(), status: 'given', dose: '1 viên', route: 'PO', patient: demoWardBoard.items[0].patient, admission: demoWardBoard.items[0].admission, medication: { name: 'Paracetamol', generic_name: 'Acetaminophen' } },
  ],
};

const demoHandovers = {
  summary: { total: 1, prepared: 1, signed: 0, acknowledged: 0, closed: 0, high_risk: 2, overdue_tasks: 3 },
  items: [
    {
      handover_id: 'iph-1',
      handover_no: 'IPH20260519001',
      status: 'prepared',
      shift_date: toLocalDateKey(),
      from_shift: 'morning',
      to_shift: 'afternoon',
      summary: 'Bàn giao 12 bệnh nhân, 2 nguy cơ cao, 3 việc quá hạn.',
      patient_count: 12,
      high_risk_count: 2,
      abnormal_vital_count: 1,
      overdue_task_count: 3,
      medication_due_count: 6,
      items: [
        {
          item_id: 'hi1',
          priority: 'critical',
          patient_id: 'p1',
          admission_id: 'adm-demo-1',
          bed_id: 'bed-301-01',
          situation: 'Nguyễn Văn A HA còn cao, SpO2 92%, đang nằm P301/G301-02.',
          background: 'Nhập viện theo dõi tăng huyết áp, dị ứng Penicillin.',
          assessment: 'Sinh hiệu nguy cơ, còn 1 việc quá hạn và 1 thuốc quá giờ.',
          recommendation: 'Đo lại sinh hiệu lúc 14:30, báo bác sĩ nếu HA > 160 hoặc SpO2 < 92%.',
          open_tasks: [{ count: 4, overdue: 1 }],
          medication_warnings: [{ due: 2, overdue: 1 }],
          vital_warnings: [{ message: 'SpO2 thấp và HA cao' }],
          acknowledged: false,
        },
      ],
    },
  ],
};

function PatientDrawer({ item, onClose, onAction }) {
  if (!item) return null;
  return (
    <aside className="nurse-ip-drawer">
      <header>
        <button type="button" onClick={onClose}><X size={15} /></button>
        <StatusPill value={item.admission?.priority || 'routine'} type="priority" />
        <h2>{patientName(item)}</h2>
        <p>{item.patient?.patient_code || '--'} · {admissionNo(item)} · {roomBedText(item)}</p>
      </header>
      <nav>
        {['Tổng quan', 'Lâm sàng', 'Việc cần làm', 'Thuốc', 'Giường', 'Chi phí', 'Dòng thời gian'].map((tab) => <span key={tab}>{tab}</span>)}
      </nav>
      <section><h3><HeartPulse size={16} />Sinh hiệu mới nhất</h3><div className="nurse-ip-vitals"><VitalsLine vitals={item.latest_vitals} /></div><RiskBadges values={item.vital_alerts} /></section>
      <section><h3><ShieldAlert size={16} />An toàn người bệnh</h3><RiskBadges values={[...(item.allergies || []), ...(item.problems || [])]} /></section>
      <section><h3><ClipboardList size={16} />Việc cần làm và thuốc</h3><dl><div><dt>Việc đang mở</dt><dd>{item.open_tasks_count}</dd></div><div><dt>Việc quá hạn</dt><dd>{item.overdue_tasks_count}</dd></div><div><dt>Thuốc đến giờ</dt><dd>{item.medication_due_count}</dd></div><div><dt>Thuốc quá giờ</dt><dd>{item.medication_overdue_count}</dd></div></dl></section>
      <section><h3><Bed size={16} />Giường và chi phí</h3><dl><div><dt>Vị trí</dt><dd>{roomBedText(item)}</dd></div><div><dt>Ngày nằm viện</dt><dd>{item.los_days || 0} ngày</dd></div><div><dt>Chi phí</dt><dd>{item.charges_summary?.count || 0} dòng · {(item.charges_summary?.total_amount || 0).toLocaleString('vi-VN')}đ</dd></div></dl></section>
      <footer>
        <button type="button" onClick={() => onAction?.('vitals', item)}><HeartPulse size={15} />Ghi sinh hiệu</button>
        <button type="button" onClick={() => onAction?.('task', item)}><ClipboardList size={15} />Tạo việc</button>
        <button type="button" onClick={() => onAction?.('medication', item)}><Pill size={15} />Cấp thuốc</button>
        <button type="button" onClick={() => onAction?.('notify', item)}><Bell size={15} />Báo BS</button>
      </footer>
    </aside>
  );
}

export function InpatientWardBoardPage() {
  const [filters, setFilters] = useState({ status: 'admitted,transferred,planned', search: '', department_id: '', room: '' });
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const params = { ...filters, status: filters.status === 'all' ? undefined : filters.status, search: filters.search || filters.room || undefined };
  const { data, loading, isDemo, error } = useInpatientData(() => nurseInpatientApi.getWardBoard(params), demoWardBoard, [filters.status, filters.search, filters.department_id, filters.room, refresh]);
  const items = safeList(data.items).filter((item) => !filters.search || `${patientName(item)} ${admissionNo(item)} ${roomBedText(item)}`.toLowerCase().includes(filters.search.toLowerCase()));
  const active = selected || items[0];

  async function runWardAction(action, item = active) {
    if (action === 'vitals') return window.location.assign('/nurse/vitals-records/entry');
    if (action === 'medication') return window.location.assign('/nurse/inpatient/bedside-medication');
    if (action === 'bed') return window.location.assign('/nurse/inpatient/bed-assignment-transfer');
    if (action === 'task') {
      const admissionId = item?.admission_id || item?.admission?._id || item?.admission?.id;
      const title = promptNurseText({ title: 'Tạo việc nội trú', message: patientName(item), defaultValue: 'Theo dõi sinh hiệu trong ca' });
      if (!title) return null;
      return runNurseAction({
        label: 'Tạo việc nội trú',
        isDemo: isDemo || !admissionId || String(admissionId).includes('demo'),
        demoMessage: 'Cần admission_id hợp lệ để tạo việc nội trú.',
        confirm: { title: 'Tạo việc?', message: title },
        run: () => nurseInpatientApi.createTask({ admission_id: admissionId, title, task_type: 'round', priority: 'normal' }),
        successMessage: 'Đã tạo việc nội trú.',
        onSuccess: () => setRefresh((value) => value + 1),
      });
    }
    if (action === 'notify') {
      notifyNurse({ title: 'Báo bác sĩ', message: `Đã ghi nhận yêu cầu báo bác sĩ cho ${patientName(item)}.` });
      return null;
    }
    return null;
  }

  return (
    <PageFrame eyebrow="Trung tâm điều phối nội trú" title="Danh sách nội trú" loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => {
      const encounterId = promptNurseText({ title: 'Tạo nhập viện', message: 'Nhập encounter_id để tạo nhập viện.', defaultValue: '' });
      if (encounterId) runNurseAction({ label: 'Tạo nhập viện', confirm: { title: 'Tạo nhập viện?', message: encounterId }, run: () => nurseInpatientApi.createAdmissionFromEncounter(encounterId, {}), successMessage: 'Đã tạo nhập viện.', onSuccess: () => setRefresh((value) => value + 1) });
    }}><Plus size={16} />Tạo nhập viện</button><button type="button" onClick={() => runWardAction('bed')}><Bed size={16} />Phân giường nhanh</button><button type="button" onClick={() => runWardAction('task')}><ClipboardList size={16} />Giao việc hàng loạt</button><button type="button" onClick={() => printNurseView('In danh sách buồng')}><Printer size={16} />In danh sách buồng</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      <Kpis items={[
        { label: 'Đang nội trú', value: data.summary?.active_admissions, detail: 'Đã nhập viện/chuyển', icon: Users, tone: 'blue' },
        { label: 'Chờ nhận giường', value: data.summary?.pending_bed_assignment, detail: 'Cần phân giường', icon: Clock3, tone: 'amber' },
        { label: 'Giường trống', value: data.summary?.available_beds, detail: 'Có thể phân', icon: Bed, tone: 'green' },
        { label: 'Đang sử dụng', value: data.summary?.occupied_beds, detail: 'Đang sử dụng', icon: Bed, tone: 'red' },
        { label: 'Đã giữ', value: data.summary?.reserved_beds, detail: 'Đã giữ', icon: CalendarDays, tone: 'violet' },
        { label: 'Bảo trì/khóa', value: data.summary?.maintenance_beds, detail: 'Không dùng', icon: ShieldAlert, tone: 'slate' },
        { label: 'Sinh hiệu bất thường', value: data.summary?.abnormal_vitals, detail: 'Có cảnh báo', icon: HeartPulse, tone: 'red' },
        { label: 'Nguy cơ cao', value: data.summary?.high_risk_patients, detail: 'Cao/nguy kịch', icon: AlertTriangle, tone: 'rose' },
        { label: 'Việc quá hạn', value: data.summary?.overdue_tasks, detail: 'Cần xử lý', icon: ClipboardList, tone: 'amber' },
        { label: 'Thuốc đến giờ', value: data.summary?.medication_due_now, detail: `${data.summary?.medication_overdue || 0} quá giờ`, icon: Pill, tone: 'green' },
        { label: 'Sắp ra viện', value: data.summary?.planned_discharge_today, detail: 'Hôm nay', icon: CheckCircle2, tone: 'blue' },
        { label: 'Chi phí chờ ghi nhận', value: items.reduce((sum, item) => sum + (item.charges_summary?.pending_count || 0), 0), detail: 'Phòng/giường', icon: FileText, tone: 'slate' },
      ]} />
      <FilterBar filters={filters} setFilters={setFilters}><label><span>Ca trực</span><select><option>Ca hiện tại</option><option>Ca sáng</option><option>Ca chiều</option><option>Ca đêm</option></select></label><label><span>Ngày trực</span><input type="date" defaultValue={toLocalDateKey()} /></label></FilterBar>
      <section className="nurse-ip-board-layout">
        <main className="nurse-ip-table-wrap">
          <table className="nurse-ip-table">
            <thead><tr><th>Ưu tiên</th><th>Nhập viện</th><th>Bệnh nhân</th><th>Khoa</th><th>Phòng/giường</th><th>Ngày nằm</th><th>Sinh hiệu</th><th>Cảnh báo</th><th>Việc</th><th>Thuốc</th><th>Chi phí</th><th>Thao tác</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.admission_id || admissionNo(item)} className={active?.admission_id === item.admission_id ? 'is-active' : ''} onClick={() => setSelected(item)}>
                  <td><StatusPill value={item.high_risk ? 'critical' : item.admission?.priority || 'routine'} type="priority" /></td>
                  <td><strong>{admissionNo(item)}</strong><small>{item.admission?.status}</small></td>
                  <td>{patientName(item)}<small>{item.patient?.patient_code || '--'}</small></td>
                  <td>{item.department?.department_name || '--'}</td>
                  <td>{roomBedText(item)}</td>
                  <td>{item.los_days || 0} ngày</td>
                  <td><VitalsLine vitals={item.latest_vitals} /></td>
                  <td><RiskBadges values={[...(item.vital_alerts || []), ...(item.allergies || [])]} /></td>
                  <td><strong>{item.open_tasks_count || 0}</strong><small>{item.overdue_tasks_count || 0} quá hạn</small></td>
                  <td><strong>{item.medication_due_count || 0}</strong><small>{item.medication_overdue_count || 0} quá giờ</small></td>
                  <td>{(item.charges_summary?.total_amount || 0).toLocaleString('vi-VN')}đ<small>{item.charges_summary?.pending_count || 0} chờ ghi nhận</small></td>
                  <td><div className="nurse-ip-row-actions"><button type="button" onClick={(event) => { event.stopPropagation(); runWardAction('vitals', item); }}><HeartPulse size={13} /></button><button type="button" onClick={(event) => { event.stopPropagation(); runWardAction('medication', item); }}><Pill size={13} /></button><button type="button" onClick={(event) => { event.stopPropagation(); runWardAction('bed', item); }}><ArrowRightLeft size={13} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      <PatientDrawer item={active} onClose={() => setSelected(null)} onAction={runWardAction} />
      </section>
    </PageFrame>
  );
}

export function InpatientAdmissionPage() {
  const [filters, setFilters] = useState({ status: 'all', search: '', department_id: '', room: '' });
  const [selected, setSelected] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useInpatientData(() => nurseInpatientApi.listAdmissions({ status: filters.status === 'all' ? undefined : filters.status, search: filters.search || undefined, limit: 100 }), { items: demoWardBoard.items.map((item) => ({ ...item.admission, patient_id: item.patient, current_bed_assignment: item.current_bed_assignment, room: item.room, bed: item.bed })) }, [filters.status, filters.search, refresh]);
  const admissions = safeList(data.items);
  const active = selected || admissions[0];

  async function checkReady(admission) {
    const id = admission?._id || admission?.admission_id;
    if (!id || isDemo) {
      setReadiness({ can_discharge: false, blockers: ['Dữ liệu mẫu: chưa gọi hệ thống.'], warnings: ['Hoàn tất bảng kiểm và eMAR trước khi ra viện.'], suggested_actions: ['Tạo chi phí phòng/giường', 'Bổ sung tóm tắt ra viện'] });
      return;
    }
    try {
      setReadiness(await nurseInpatientApi.getDischargeReadiness(id));
    } catch (readinessError) {
      setReadiness({ can_discharge: false, blockers: [readinessError?.message || 'Không kiểm tra được điều kiện ra viện.'], warnings: [], suggested_actions: [] });
    }
  }

  async function runAdmissionAction(label, admission = active) {
    const id = admission?._id || admission?.admission_id;
    if (label === 'Phân giường' || label === 'Chuyển giường') return window.location.assign('/nurse/inpatient/bed-assignment-transfer');
    if (label === 'In phiếu') return printNurseView('In phiếu nhập viện');
    if (label === 'Tạo chi phí phòng') {
      await runNurseAction({
        label,
        isDemo: isDemo || !id,
        demoMessage: 'Cần admission_id hợp lệ để tạo chi phí phòng.',
        confirm: { title: 'Tạo chi phí phòng?', message: admission?.admission_no || '' },
        run: () => nurseInpatientApi.createRoomBedCharge(id, { charge_note: 'Tạo từ workspace điều dưỡng.' }),
        successMessage: 'Đã tạo chi phí phòng/giường.',
        onSuccess: () => setRefresh((value) => value + 1),
      });
      return null;
    }
    await runNurseAction({
      label,
      isDemo: isDemo || !id,
      demoMessage: 'Cần admission_id hợp lệ để cập nhật nhập viện.',
      confirm: { title: label, message: admission?.admission_no || '' },
      run: async () => {
        if (label === 'Nhận viện') return nurseInpatientApi.admitAdmission(id, {});
        if (label === 'Ra viện') return nurseInpatientApi.dischargeAdmission(id, { discharge_note: 'Ra viện từ workspace điều dưỡng.' });
        if (label === 'Hủy') return nurseInpatientApi.cancelAdmission(id, { reason: 'Hủy từ workspace điều dưỡng.' });
        return nurseInpatientApi.getAdmission(id);
      },
      successMessage: 'Đã cập nhật nhập viện.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
    return null;
  }

  return (
    <PageFrame eyebrow="Vòng đời nhập viện" title="Nhập viện" loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => {
      const encounterId = promptNurseText({ title: 'Tạo nhập viện', message: 'Nhập encounter_id.', defaultValue: '' });
      if (encounterId) runNurseAction({ label: 'Tạo nhập viện', confirm: { title: 'Tạo nhập viện?', message: encounterId }, run: () => nurseInpatientApi.createAdmissionFromEncounter(encounterId, {}), successMessage: 'Đã tạo nhập viện.', onSuccess: () => setRefresh((value) => value + 1) });
    }}><Plus size={16} />Tạo nhập viện</button><button type="button" onClick={() => runAdmissionAction('Phân giường')}><Bed size={16} />Phân giường</button><button type="button" onClick={() => runAdmissionAction('Tạo chi phí phòng')}><FileText size={16} />Tạo chi phí phòng</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      <Kpis items={[
        { label: 'Dự kiến', value: admissions.filter((item) => item.status === 'planned').length, detail: 'Chờ nhận viện', icon: Clock3, tone: 'amber' },
        { label: 'Đã nhập viện', value: admissions.filter((item) => item.status === 'admitted').length, detail: 'Đang nằm viện', icon: UserCheck, tone: 'green' },
        { label: 'Đã chuyển', value: admissions.filter((item) => item.status === 'transferred').length, detail: 'Có chuyển giường', icon: ArrowRightLeft, tone: 'violet' },
        { label: 'Đã ra viện', value: admissions.filter((item) => item.status === 'discharged').length, detail: 'Đã ra viện', icon: CheckCircle2, tone: 'blue' },
        { label: 'Đã hủy', value: admissions.filter((item) => item.status === 'cancelled').length, detail: 'Đã hủy', icon: X, tone: 'slate' },
      ]} />
      <FilterBar filters={filters} setFilters={setFilters} />
      <section className="nurse-ip-admission-layout">
        <main className="nurse-ip-admission-list">
          {admissions.map((admission) => (
            <button key={admission._id || admission.admission_no} type="button" className={active === admission ? 'is-active' : ''} onClick={() => { setSelected(admission); setReadiness(null); }}>
              <StatusPill value={admission.status} />
              <strong>{admission.admission_no}</strong>
              <span>{patientName({ patient: admission.patient_id || admission.patient })}</span>
              <small>{admission.reason || 'Chưa ghi lý do'} · {formatDate(admission.admitted_at || admission.created_at)}</small>
            </button>
          ))}
        </main>
        <section className="nurse-ip-admission-detail">
          <header><StatusPill value={active?.status} /><h2>{active?.admission_no || '--'}</h2><p>{patientName({ patient: active?.patient_id || active?.patient })} · {admissionTypeLabels[active?.admission_type] || active?.admission_type || 'Chủ động'} · {formatDate(active?.admitted_at)}</p></header>
          <div className="nurse-ip-timeline">
            {[
              ['created_at', 'Đã tạo nhập viện'],
              ['admitted_at', 'Đã nhận viện'],
              ['expected_discharge_at', 'Dự kiến ra viện'],
              ['discharged_at', 'Đã ra viện'],
              ['cancelled_at', 'Đã hủy'],
            ].map(([key, label]) => <article key={key} className={active?.[key] ? 'is-done' : ''}><span>{active?.[key] ? formatTime(active[key]) : '--:--'}</span><strong>{label}</strong><small>{active?.[key] ? formatDate(active[key]) : 'Chờ cập nhật'}</small></article>)}
          </div>
          <section className="nurse-ip-action-panel">
            <h3>Thao tác được phép</h3>
            <div>
              {['Nhận viện', 'Phân giường', 'Chuyển giường', 'Tạo chi phí phòng', 'Ra viện', 'Hủy', 'In phiếu'].map((label) => <button key={label} type="button" onClick={() => runAdmissionAction(label)}>{label}</button>)}
            </div>
          </section>
        </section>
        <aside className="nurse-ip-readiness">
          <header><h3><ClipboardCheck size={16} />Điều kiện ra viện</h3><button type="button" onClick={() => checkReady(active)}>Kiểm tra</button></header>
          {readiness ? (
            <div>
              <StatusPill value={readiness.can_discharge ? 'ready' : 'blocked'} type="priority" />
              <h4>Điểm chặn</h4>{(readiness.blockers || []).map((item) => <p key={item}>{item}</p>)}
              <h4>Cảnh báo</h4>{(readiness.warnings || []).map((item) => <p key={item}>{item}</p>)}
              <h4>Gợi ý xử lý</h4>{(readiness.suggested_actions || []).map((item) => <p key={item}>{item}</p>)}
            </div>
          ) : <p>Chọn lượt nhập viện và kiểm tra trước khi ra viện.</p>}
        </aside>
      </section>
    </PageFrame>
  );
}

export function InpatientRoomsBedsPage() {
  const [filters, setFilters] = useState({ department_id: '', room: '', status: 'all', search: '' });
  const [selectedBed, setSelectedBed] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useInpatientData(() => nurseInpatientApi.getWardMap({ department_id: filters.department_id || undefined, status: filters.status === 'all' ? undefined : filters.status }), demoWardMap, [filters.department_id, filters.status, refresh]);
  const rooms = safeList(data.buildings).flatMap((building) => safeList(building.floors).flatMap((floor) => safeList(floor.rooms).map((room) => ({ ...room, building: building.building, floor: floor.floor }))));
  const selectedBedId = selectedBed?.bed?._id || selectedBed?.bed?.bed_id || selectedBed?.bed?.id;

  async function createRoomOrBed(kind) {
    const code = promptNurseText({ title: kind === 'room' ? 'Tạo phòng' : 'Tạo giường', message: 'Nhập mã định danh.', defaultValue: '' });
    if (!code) return;
    await runNurseAction({
      label: kind === 'room' ? 'Tạo phòng' : 'Tạo giường',
      confirm: { title: 'Xác nhận tạo mới?', message: code },
      run: () => (kind === 'room' ? nurseInpatientApi.createRoom({ room_code: code }) : nurseInpatientApi.createBed({ bed_code: code, room_id: selectedBed?.room?._id })),
      successMessage: kind === 'room' ? 'Đã tạo phòng.' : 'Đã tạo giường.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
  }

  async function updateSelectedBed(status) {
    await runNurseAction({
      label: status === 'maintenance' ? 'Bảo trì giường' : 'Cập nhật giường',
      isDemo: isDemo || !selectedBedId || String(selectedBedId).includes('demo'),
      demoMessage: 'Cần bed_id hợp lệ để cập nhật giường.',
      confirm: { title: 'Cập nhật trạng thái giường?', message: selectedBed?.bed?.bed_code || '' },
      run: () => nurseInpatientApi.updateBed(selectedBedId, { status }),
      successMessage: 'Đã cập nhật trạng thái giường.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
  }

  return (
    <PageFrame eyebrow="Bản đồ phòng giường" title="Phòng / giường" loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => createRoomOrBed('room')}><Plus size={16} />Tạo phòng</button><button type="button" onClick={() => createRoomOrBed('bed')}><Bed size={16} />Tạo giường</button><button type="button" onClick={() => updateSelectedBed('maintenance')}><ShieldAlert size={16} />Bảo trì</button><button type="button" onClick={() => printNurseView('In bản đồ giường')}><Printer size={16} />In bản đồ giường</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      <Kpis items={[
        { label: 'Tổng phòng', value: data.summary?.total_rooms || rooms.length, detail: 'Trong bộ lọc', icon: Building2, tone: 'blue' },
        { label: 'Tổng giường', value: data.summary?.total_beds, detail: 'Tất cả trạng thái', icon: Bed, tone: 'slate' },
        { label: 'Còn trống', value: data.summary?.available, detail: 'Có thể phân', icon: CheckCircle2, tone: 'green' },
        { label: 'Đang dùng', value: data.summary?.occupied, detail: 'Đang dùng', icon: Users, tone: 'red' },
        { label: 'Đã giữ', value: data.summary?.reserved, detail: 'Đã giữ', icon: CalendarDays, tone: 'violet' },
        { label: 'Bảo trì', value: data.summary?.maintenance, detail: 'Bảo trì', icon: ShieldAlert, tone: 'amber' },
        { label: 'Đang khóa', value: data.summary?.blocked, detail: 'Khóa', icon: X, tone: 'slate' },
        { label: 'Lệch dữ liệu', value: data.summary?.data_mismatch_active_assignment_on_available_bed, detail: 'Cần rà soát', icon: AlertTriangle, tone: 'rose' },
      ]} />
      <FilterBar filters={filters} setFilters={setFilters}><label><span>Tòa nhà</span><input placeholder="A/B/C" /></label><label><span>Tầng</span><input placeholder="3" /></label></FilterBar>
      <section className="nurse-ip-map-layout">
        <main className="nurse-ip-ward-map">
          {rooms.map((room) => (
            <article key={room.room?._id || room.room?.room_id || room.room?.room_code} className="nurse-ip-room-card">
              <header><div><strong>{room.room?.room_code}</strong><span>{room.room?.room_name} · Tầng {room.floor} · Khu {room.building}</span></div><StatusPill value={room.room?.status} /></header>
              <div className="nurse-ip-room-summary"><span>{room.bed_summary?.available || 0} trống</span><span>{room.bed_summary?.occupied || 0} đang dùng</span><span>{room.bed_summary?.reserved || 0} đã giữ</span><span>{room.bed_summary?.maintenance || 0} bảo trì</span></div>
              <div className="nurse-ip-bed-grid">
                {safeList(room.beds).map((entry) => (
                  <button key={entry.bed?._id || entry.bed?.bed_id || entry.bed?.bed_code} type="button" className={`nurse-ip-bed-card nurse-ip-bed-card--${entry.bed?.status}`} onClick={() => setSelectedBed({ ...entry, room: room.room })}>
                    <strong>{entry.bed?.bed_code}</strong>
                    <span>{entry.bed?.bed_type}</span>
                    <small>{entry.patient?.full_name || entry.patient?.patient_name || entry.admission?.patient_id?.full_name || entry.bed?.status}</small>
                    {entry.warnings?.length ? <em>!</em> : null}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </main>
        <aside className="nurse-ip-drawer nurse-ip-drawer--static">
          <header><h2>{selectedBed?.bed?.bed_code || 'Chọn giường'}</h2><p>{selectedBed?.room?.room_code || '--'} · {selectedBed?.bed?.bed_type || '--'}</p></header>
          <section><h3>Bệnh nhân hiện tại</h3><p>{selectedBed?.patient?.full_name || selectedBed?.admission?.patient_id?.full_name || 'Không có bệnh nhân đang nằm'}</p></section>
          <section><h3>Trạng thái</h3><StatusPill value={selectedBed?.bed?.status || 'available'} /></section>
          <section><h3>Cảnh báo dữ liệu</h3><RiskBadges values={selectedBed?.warnings || []} /></section>
          <footer><button type="button" onClick={() => window.location.assign('/nurse/inpatient/bed-assignment-transfer')}>Phân bệnh nhân</button><button type="button" onClick={() => updateSelectedBed('available')}>Chuyển khỏi giường</button><button type="button" onClick={() => updateSelectedBed('maintenance')}>Bảo trì</button></footer>
        </aside>
      </section>
    </PageFrame>
  );
}

export function InpatientBedAssignmentTransferPage() {
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [selectedBed, setSelectedBed] = useState(null);
  const [toast, setToast] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useInpatientData(async () => {
    const [admissions, beds, assignments] = await Promise.all([
      nurseInpatientApi.listAdmissions({ status: 'planned', limit: 100 }),
      nurseInpatientApi.getAvailableBeds({ limit: 100 }),
      nurseInpatientApi.listBedAssignments({ status: 'active', limit: 100 }),
    ]);
    return { admissions: safeList(admissions.items || admissions), beds: safeList(beds.items || beds), assignments: safeList(assignments.items || assignments) };
  }, { admissions: demoWardBoard.items.map((item) => item.admission), beds: demoWardMap.buildings[0].floors[0].rooms[0].beds.filter((entry) => entry.bed.status === 'available').map((entry) => ({ ...entry.bed, room_id: { room_code: '301', room_name: 'Phòng 301' } })), assignments: [] }, [refresh]);

  async function assign() {
    if (!selectedAdmission || !selectedBed) return setToast('Chưa chọn lượt nhập viện và giường.');
    if (isDemo) return setToast('Dữ liệu mẫu: thao tác chưa gửi hệ thống.');
    try {
      await nurseInpatientApi.assignBed(selectedAdmission._id || selectedAdmission.admission_id, { bed_id: selectedBed._id || selectedBed.bed_id, mode: 'reserve', admit_now: false, enforce_department_match: true });
      setToast('Đã phân giường.');
      setRefresh((value) => value + 1);
    } catch (updateError) {
      setToast(updateError?.message || 'Không phân giường được.');
    }
  }

  function transferBed() {
    if (!selectedAdmission || !selectedBed) {
      setToast('Chưa chọn lượt nhập viện và giường đích.');
      return;
    }
    assign();
  }

  async function releaseBed() {
    const assignmentId = data.assignments?.[0]?._id || data.assignments?.[0]?.assignment_id;
    await runNurseAction({
      label: 'Giải phóng giường',
      isDemo: isDemo || !assignmentId,
      demoMessage: 'Cần bed_assignment_id hợp lệ để giải phóng.',
      confirm: { title: 'Giải phóng giường?', message: data.assignments?.[0]?.bed_id?.bed_code || 'Giường đang chọn' },
      run: () => nurseInpatientApi.releaseBedAssignment(assignmentId, { reason: 'Giải phóng từ workspace điều dưỡng.' }),
      successMessage: 'Đã giải phóng giường.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
  }

  return (
    <PageFrame eyebrow="Điều phối giường" title="Phân giường / chuyển giường" loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={assign}><CheckCircle2 size={16} />Xác nhận phân giường</button><button type="button" onClick={transferBed}><ArrowRightLeft size={16} />Chuyển giường</button><button type="button" onClick={releaseBed}><X size={16} />Giải phóng</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      {toast ? <div className="nurse-ip-toast">{toast}<button type="button" onClick={() => setToast('')}><X size={14} /></button></div> : null}
      <section className="nurse-ip-bedops">
        <aside><header><h3>Bệnh nhân chờ giường</h3><span>{data.admissions.length}</span></header>{data.admissions.map((admission) => <button key={admission._id || admission.admission_no} type="button" className={selectedAdmission === admission ? 'is-active' : ''} onClick={() => setSelectedAdmission(admission)}><strong>{admission.admission_no}</strong><span>{patientName({ patient: admission.patient_id || admission.patient })}</span><small>{admission.reason || admission.admission_type || '--'}</small></button>)}</aside>
        <main><header><h3>Giường khả dụng</h3><span>{data.beds.length}</span></header><div className="nurse-ip-bedops-grid">{data.beds.map((bed) => <button key={bed._id || bed.bed_id || bed.bed_code} type="button" className={selectedBed === bed ? 'is-active' : ''} onClick={() => setSelectedBed(bed)}><Bed size={16} /><strong>{bed.bed_code}</strong><span>{bed.room_id?.room_code || bed.room?.room_code || '--'} · {bed.bed_type}</span><small>{bed.room_id?.floor || 'Tầng'} · {bed.room_id?.department_id?.department_name || 'Khoa'}</small></button>)}</div></main>
        <aside className="nurse-ip-preview"><header><h3>Xem trước phân giường</h3></header><dl><div><dt>Lượt nhập viện</dt><dd>{selectedAdmission?.admission_no || '--'}</dd></div><div><dt>Bệnh nhân</dt><dd>{patientName({ patient: selectedAdmission?.patient_id || selectedAdmission?.patient })}</dd></div><div><dt>Giường</dt><dd>{selectedBed?.bed_code || '--'}</dd></div><div><dt>Chế độ</dt><dd>Giữ giường</dd></div><div><dt>Khớp khoa</dt><dd>{selectedBed ? 'Hệ thống sẽ kiểm tra' : '--'}</dd></div></dl><button type="button" onClick={assign}><CheckCircle2 size={15} />Xác nhận</button></aside>
      </section>
    </PageFrame>
  );
}

export function InpatientTasksPage() {
  const [filters, setFilters] = useState({ status: 'all', search: '', department_id: '', room: '', type: 'all' });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useInpatientData(() => nurseInpatientApi.listTasks({ status: filters.status === 'all' ? undefined : filters.status, type: filters.type === 'all' ? undefined : filters.type, search: filters.search || undefined, limit: 100 }), demoTasks, [filters.status, filters.type, filters.search, refresh]);
  const tasks = safeList(data.items);
  const active = selected || tasks[0];

  async function run(action, task = active) {
    if (!task) return;
    const taskId = task.task_id || task.id || task._id;
    const assignee = action === 'assign' ? promptNurseText({ title: 'Giao lại việc', message: task.title, defaultValue: '' }) : null;
    if (action === 'assign' && !assignee) return;
    await runNurseAction({
      label: action === 'start' ? 'Bắt đầu việc' : action === 'complete' ? 'Hoàn tất việc' : 'Giao lại việc',
      isDemo: isDemo || !taskId,
      demoMessage: 'Dữ liệu mẫu hoặc thiếu task_id nên thao tác việc chưa gửi hệ thống.',
      confirm: action === 'complete' ? { title: 'Hoàn tất việc?', message: task.title } : null,
      run: async () => {
        if (action === 'start') return nurseInpatientApi.startTask(taskId);
        if (action === 'complete') return nurseInpatientApi.completeTask(taskId, { result_note: 'Hoàn tất từ bảng nội trú.' });
        return nurseInpatientApi.assignTask(taskId, { assigned_to: assignee });
      },
      successMessage: 'Đã cập nhật việc nội trú.',
      onSuccess: () => {
        setToast('Đã cập nhật việc nội trú.');
        setRefresh((value) => value + 1);
      },
    });
  }

  const columns = [
    ['todo', 'Chưa làm'],
    ['in_progress', 'Đang làm'],
    ['overdue', 'Quá hạn'],
    ['done', 'Hoàn tất'],
    ['cancelled', 'Đã hủy'],
  ];

  return (
    <PageFrame eyebrow="Bảng việc điều dưỡng" title="Việc nội trú" loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => {
      const title = promptNurseText({ title: 'Tạo việc nội trú', message: 'Nhập tên việc.', defaultValue: 'Đi buồng và ghi nhận tình trạng' });
      if (title) runNurseAction({ label: 'Tạo việc nội trú', confirm: { title: 'Tạo việc?', message: title }, run: () => nurseInpatientApi.createTask({ title, task_type: 'round', priority: 'normal' }), successMessage: 'Đã tạo việc nội trú.', onSuccess: () => setRefresh((value) => value + 1) });
    }}><Plus size={16} />Tạo việc</button><button type="button" onClick={() => run('assign')}><Users size={16} />Giao hàng loạt</button><button type="button" onClick={() => notifyNurse({ title: 'Bảng kiểm xuất viện', message: 'Mở bộ lọc loại việc "Bảng kiểm ra viện" để rà soát.' })}><ClipboardCheck size={16} />Bảng kiểm xuất viện</button><button type="button" onClick={() => printNurseView('In việc trong ca')}><Printer size={16} />In việc trong ca</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      {toast ? <div className="nurse-ip-toast">{toast}<button type="button" onClick={() => setToast('')}><X size={14} /></button></div> : null}
      <Kpis items={[
        { label: 'Việc hôm nay', value: data.summary?.total || tasks.length, detail: 'Trong bộ lọc', icon: ClipboardList, tone: 'blue' },
        { label: 'Chưa làm', value: data.summary?.todo, detail: 'Chưa làm', icon: Clock3, tone: 'amber' },
        { label: 'Đang làm', value: data.summary?.in_progress, detail: 'Đang xử lý', icon: Activity, tone: 'violet' },
        { label: 'Hoàn tất', value: data.summary?.done, detail: 'Đã xong', icon: CheckCircle2, tone: 'green' },
        { label: 'Quá hạn', value: data.summary?.overdue, detail: 'Quá SLA', icon: AlertTriangle, tone: 'red' },
        { label: 'Chưa giao', value: tasks.filter((task) => !task.assigned_to && !task.assigned_to_name).length, detail: 'Chưa có người nhận', icon: Users, tone: 'slate' },
      ]} />
      <FilterBar filters={filters} setFilters={setFilters}><label><span>Loại việc</span><select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="all">Tất cả</option><option value="round">Đi buồng</option><option value="vital_sign">Sinh hiệu</option><option value="medication">Thuốc</option><option value="discharge_checklist">Bảng kiểm ra viện</option></select></label></FilterBar>
      <section className="nurse-ip-task-layout">
        <main className="nurse-ip-kanban">
          {columns.map(([key, title]) => {
            const columnTasks = tasks.filter((task) => (task.status || task.raw_status) === key || (key === 'overdue' && task.status === 'overdue'));
            return <section key={key}><header><strong>{title}</strong><span>{columnTasks.length}</span></header>{columnTasks.map((task) => { const due = dueStatus(task.due_at); const taskType = task.type || task.task_type; return <article key={task.task_id || task.id} className={`nurse-ip-task-card nurse-ip-task-card--${task.priority}`} onClick={() => setSelected(task)}><header><StatusPill value={task.priority || 'normal'} type="priority" /><small className={`is-${due.tone}`}>{due.label}</small></header><h3>{task.title}</h3><p>{patientName(task)} · {roomBedText(task)}</p><footer><span>{taskTypeLabels[taskType] || taskType}</span><div><button type="button" onClick={(event) => { event.stopPropagation(); run('start', task); }}>Bắt đầu</button><button type="button" onClick={(event) => { event.stopPropagation(); run('complete', task); }}>Xong</button></div></footer></article>; })}</section>;
          })}
        </main>
        <aside className="nurse-ip-drawer nurse-ip-drawer--static"><header><h2>{active?.title || 'Chọn việc'}</h2><p>{patientName(active)} · {roomBedText(active)}</p></header><section><h3>Chi tiết</h3><dl><div><dt>Loại</dt><dd>{taskTypeLabels[active?.type || active?.task_type] || active?.type || active?.task_type}</dd></div><div><dt>Trạng thái</dt><dd>{statusLabels[active?.status] || active?.status}</dd></div><div><dt>Phụ trách</dt><dd>{active?.assigned_to_name || 'Chưa giao'}</dd></div><div><dt>Hạn xử lý</dt><dd>{formatTime(active?.due_at)}</dd></div></dl></section><section><h3>Dòng thời gian ca trực</h3><div className="nurse-ip-mini-timeline"><article><span>{formatTime(active?.created_at)}</span><strong>Đã tạo</strong></article><article><span>{formatTime(active?.started_at)}</span><strong>Đã bắt đầu</strong></article><article><span>{formatTime(active?.completed_at)}</span><strong>Đã hoàn tất</strong></article></div></section><footer><button type="button" onClick={() => run('start')}>Bắt đầu</button><button type="button" onClick={() => run('complete')}>Hoàn tất</button><button type="button" onClick={() => run('assign')}>Giao lại</button></footer></aside>
      </section>
    </PageFrame>
  );
}

export function InpatientBedsideMedicationPage() {
  const [filters, setFilters] = useState({ status: 'all', search: '', department_id: '', room: '', date: toLocalDateKey() });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useInpatientData(() => nurseInpatientApi.listMedicationAdministrations({ date: filters.date, status: filters.status === 'all' ? undefined : filters.status, search: filters.search || undefined, limit: 100 }), demoMedications, [filters.status, filters.date, filters.search, refresh]);
  const medications = safeList(data.items);
  const active = selected || medications[0];

  async function medicationAction(action, item = active) {
    if (!item) return;
    const id = item.administration_id || item.id || item._id;
    await runNurseAction({
      label: action === 'administer' ? 'Ghi nhận đã dùng' : action === 'hold' ? 'Tạm hoãn thuốc' : action === 'refuse' ? 'Từ chối thuốc' : action === 'omit' ? 'Bỏ qua thuốc' : 'Báo bác sĩ',
      isDemo: isDemo || !id,
      demoMessage: 'Dữ liệu mẫu hoặc thiếu administration_id nên chưa ghi nhận eMAR.',
      confirm: { title: 'Xác nhận eMAR', message: `${patientName(item)} - ${item.medication?.name || item.medication?.generic_name || ''}` },
      run: async () => {
        if (action === 'administer') return nurseInpatientApi.administerMedication(id, { dose: item.dose, route: item.route, site: item.site, note: 'Ghi nhận tại giường.' });
        if (action === 'hold') return nurseInpatientApi.holdMedication(id, { reason: 'Tạm hoãn từ eMAR điều dưỡng.' });
        if (action === 'refuse') return nurseInpatientApi.refuseMedication(id, { reason: 'Bệnh nhân từ chối dùng thuốc.' });
        if (action === 'omit') return nurseInpatientApi.omitMedication(id, { reason: 'Bỏ qua liều theo đánh giá điều dưỡng.' });
        return nurseInpatientApi.holdMedication(id, { reason: 'Cần bác sĩ xem lại trước khi dùng thuốc.' });
      },
      successMessage: 'Đã cập nhật eMAR.',
      onSuccess: () => {
        setToast('Đã cập nhật eMAR.');
        setRefresh((value) => value + 1);
      },
    });
  }

  return (
    <PageFrame eyebrow="Cấp thuốc tại giường eMAR" title="Cấp thuốc tại giường" loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => notifyNurse({ title: 'Quét QR bệnh nhân', message: 'Tính năng quét cần thiết bị đầu đọc hoặc camera trình duyệt.' })}><ScanLine size={16} />Quét QR bệnh nhân</button><button type="button" onClick={() => notifyNurse({ title: 'Quét mã thuốc', message: 'Tính năng quét cần thiết bị đầu đọc hoặc camera trình duyệt.' })}><Pill size={16} />Quét mã thuốc</button><button type="button" onClick={() => medicationAction('administer')}><CheckCircle2 size={16} />Ghi nhận đã dùng</button><button type="button" onClick={() => printNurseView('In phiếu MAR')}><Printer size={16} />In phiếu MAR</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      {toast ? <div className="nurse-ip-toast">{toast}<button type="button" onClick={() => setToast('')}><X size={14} /></button></div> : null}
      <Kpis items={[
        { label: 'Lịch hôm nay', value: data.summary?.total || medications.length, detail: 'Theo ngày', icon: CalendarDays, tone: 'blue' },
        { label: 'Đến giờ', value: data.summary?.due_now, detail: 'Trong khung giờ', icon: Clock3, tone: 'amber' },
        { label: 'Quá giờ', value: data.summary?.overdue, detail: 'Quá giờ', icon: AlertTriangle, tone: 'red' },
        { label: 'Đã dùng', value: data.summary?.given, detail: 'Đã dùng', icon: CheckCircle2, tone: 'green' },
        { label: 'Tạm hoãn', value: data.summary?.held, detail: 'Tạm hoãn', icon: ShieldAlert, tone: 'slate' },
        { label: 'Từ chối/bỏ qua', value: (data.summary?.refused || 0) + (data.summary?.omitted || 0), detail: 'Không dùng', icon: X, tone: 'rose' },
      ]} />
      <FilterBar filters={filters} setFilters={setFilters}><label><span>Ngày</span><input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} /></label></FilterBar>
      <section className="nurse-ip-emar-layout">
        <main className="nurse-ip-table-wrap">
          <table className="nurse-ip-table">
            <thead><tr><th>Giờ</th><th>Bệnh nhân</th><th>Thuốc</th><th>Liều</th><th>Đường dùng</th><th>Trạng thái</th><th>Cảnh báo</th><th>Thao tác</th></tr></thead>
            <tbody>{medications.map((item) => <tr key={item.administration_id || item.id} className={active === item ? 'is-active' : ''} onClick={() => setSelected(item)}><td><strong>{formatTime(item.scheduled_at)}</strong><small>{item.is_overdue ? 'Quá giờ' : item.is_due_now ? 'Đến giờ' : ''}</small></td><td>{patientName(item)}<small>{admissionNo(item)}</small></td><td>{item.medication?.name || item.medication?.generic_name || '--'}<small>{item.prescription_item?.instructions || item.medication?.generic_name}</small></td><td>{item.dose || '--'}</td><td>{item.route || '--'}</td><td><StatusPill value={item.status} /></td><td><RiskBadges values={item.is_overdue ? ['Quá giờ dùng thuốc'] : []} /></td><td><div className="nurse-ip-row-actions"><button type="button" onClick={(event) => { event.stopPropagation(); medicationAction('administer', item); }}><CheckCircle2 size={13} /></button><button type="button" onClick={(event) => { event.stopPropagation(); medicationAction('hold', item); }}><ShieldAlert size={13} /></button><button type="button" onClick={(event) => { event.stopPropagation(); medicationAction('omit', item); }}><X size={13} /></button></div></td></tr>)}</tbody>
          </table>
        </main>
        <aside className="nurse-ip-drawer nurse-ip-drawer--static"><header><h2>{active?.medication?.name || 'Chọn thuốc'}</h2><p>{patientName(active)} · {formatTime(active?.scheduled_at)}</p></header><section><h3><ScanLine size={16} />Năm đúng</h3>{['Đúng bệnh nhân', 'Đúng thuốc', 'Đúng liều', 'Đúng đường dùng', 'Đúng thời điểm'].map((label, index) => <div key={label} className="nurse-ip-right-check"><CheckCircle2 size={15} /><span>{label}</span><strong>{index < 3 ? 'Khớp' : 'Cần xác minh'}</strong></div>)}</section><section><h3>Không dùng thuốc</h3><div className="nurse-ip-action-grid"><button type="button" onClick={() => medicationAction('hold')}>Tạm hoãn</button><button type="button" onClick={() => medicationAction('refuse')}>Từ chối</button><button type="button" onClick={() => medicationAction('omit')}>Bỏ qua</button><button type="button" onClick={() => medicationAction('notify')}>Báo bác sĩ</button></div></section></aside>
      </section>
    </PageFrame>
  );
}

export function InpatientHandoverPage() {
  const [selected, setSelected] = useState(null);
  const [patientItem, setPatientItem] = useState(null);
  const [toast, setToast] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useInpatientData(() => nurseInpatientApi.listHandovers({ date: toLocalDateKey(), limit: 20 }), demoHandovers, [refresh]);
  const handovers = safeList(data.items);
  const active = selected || handovers[0];
  const activeItem = patientItem || safeList(active?.items)[0];
  const handoverId = active?.handover_id || active?.id || active?._id;

  async function run(action) {
    if (action === 'export') {
      downloadNurseJson('ban-giao-noi-tru.json', { handover: active, item: activeItem }, 'Đã xuất dữ liệu bàn giao.');
      printNurseView('In bàn giao nội trú');
      return;
    }
    const labels = {
      create: 'Tạo bàn giao',
      generate: 'Tự động tổng hợp bàn giao',
      sign: 'Ký bàn giao',
      ack: 'Xác nhận nhận ca',
      close: 'Đóng ca',
    };
    const needsId = action !== 'create';
    if (needsId && !handoverId) {
      notifyNurse({ tone: 'warning', title: labels[action] || 'Bàn giao nội trú', message: 'Chọn một bản bàn giao hợp lệ trước khi thao tác.' });
      return;
    }
    let createPayload = {};
    if (action === 'create') {
      const toShift = promptNurseText({ title: 'Tạo bàn giao', message: 'Nhập ca nhận (morning/afternoon/night).', defaultValue: active?.to_shift || 'afternoon' });
      if (toShift === null) return;
      createPayload = {
        shift_date: toLocalDateKey(),
        from_shift: active?.to_shift || 'morning',
        to_shift: toShift || 'afternoon',
        summary: 'Bàn giao nội trú tạo từ workspace điều dưỡng.',
      };
    }
    await runNurseAction({
      label: labels[action] || 'Cập nhật bàn giao',
      isDemo: isDemo || (needsId && !handoverId),
      demoMessage: 'Dữ liệu mẫu hoặc thiếu mã bàn giao nên chưa gửi hệ thống.',
      confirm: ['create', 'sign', 'ack', 'close'].includes(action)
        ? { title: labels[action] || 'Bàn giao nội trú', message: action === 'close' ? 'Đóng ca sau khi đã xác nhận đầy đủ?' : 'Xác nhận thực hiện thao tác này?' }
        : undefined,
      run: async () => {
        if (action === 'create') return nurseInpatientApi.createHandover(createPayload);
        if (action === 'generate') return nurseInpatientApi.generateHandover(handoverId, { summary: 'Tổng hợp SBAR tự động từ workspace điều dưỡng.' });
        if (action === 'sign') return nurseInpatientApi.signHandover(handoverId);
        if (action === 'ack') return nurseInpatientApi.acknowledgeHandover(handoverId);
        return nurseInpatientApi.closeHandover(handoverId);
      },
      successMessage: 'Đã cập nhật bàn giao nội trú.',
      errorMessage: 'Không cập nhật được bàn giao.',
      onSuccess: (result) => {
        setToast('Đã cập nhật bàn giao nội trú.');
        setSelected(result || null);
        setPatientItem(null);
        setRefresh((value) => value + 1);
      },
    });
  }

  return (
    <PageFrame eyebrow="Bàn giao ca SBAR" title="Bàn giao nội trú" loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => run('create')}><Plus size={16} />Tạo bàn giao</button><button type="button" onClick={() => run('generate')}><Zap size={16} />Tự động tổng hợp</button><button type="button" onClick={() => run('sign')}><Send size={16} />Ký bàn giao</button><button type="button" onClick={() => run('ack')}><CheckCircle2 size={16} />Xác nhận nhận ca</button><button type="button" onClick={() => run('export')}><Download size={16} />PDF</button></>}>
      {toast ? <div className="nurse-ip-toast">{toast}<button type="button" onClick={() => setToast('')}><X size={14} /></button></div> : null}
      <Kpis items={[
        { label: 'BN bàn giao', value: active?.patient_count, detail: 'Tổng bệnh nhân', icon: Users, tone: 'blue' },
        { label: 'Nguy cơ cao', value: active?.high_risk_count, detail: 'Cao/nguy kịch', icon: ShieldAlert, tone: 'rose' },
        { label: 'Sinh hiệu bất thường', value: active?.abnormal_vital_count, detail: 'Cần theo dõi', icon: HeartPulse, tone: 'red' },
        { label: 'Việc chưa xong', value: active?.overdue_task_count, detail: 'Quá hạn', icon: ClipboardList, tone: 'amber' },
        { label: 'Thuốc cần chú ý', value: active?.medication_due_count, detail: 'Đến giờ/quá giờ', icon: Pill, tone: 'green' },
        { label: 'Chưa xác nhận', value: safeList(active?.items).filter((item) => !item.acknowledged).length, detail: 'Người nhận', icon: UserCheck, tone: 'slate' },
      ]} />
      <section className="nurse-ip-handover-status"><strong>{active?.handover_no || '--'}</strong><span>{shiftLabels[active?.from_shift] || active?.from_shift || 'Ca sáng'} → {shiftLabels[active?.to_shift] || active?.to_shift || 'Ca chiều'} · {formatDate(active?.shift_date)}</span><StatusPill value={active?.status} /><p>{active?.summary}</p></section>
      <section className="nurse-ip-handover-layout">
        <aside className="nurse-ip-handover-list"><header><h3>Bệnh nhân</h3><span>{safeList(active?.items).length}</span></header>{safeList(active?.items).map((item, index) => <button key={item.item_id || index} type="button" className={activeItem === item ? 'is-active' : ''} onClick={() => setPatientItem(item)}><StatusPill value={item.priority || 'normal'} type="priority" /><strong>{item.patient?.full_name || `Nhập viện ${item.admission_id}`}</strong><small>{item.situation}</small><em>{item.acknowledged ? 'Đã xác nhận' : 'Chưa xác nhận'}</em></button>)}</aside>
        <main className="nurse-ip-sbar"><header><StatusPill value={activeItem?.priority || 'normal'} type="priority" /><h2>{activeItem?.patient?.full_name || 'SBAR bệnh nhân'}</h2><p>{activeItem?.admission_id || '--'}</p></header>{[['S', 'Tình huống', activeItem?.situation], ['B', 'Bối cảnh', activeItem?.background], ['A', 'Đánh giá', activeItem?.assessment], ['R', 'Khuyến nghị', activeItem?.recommendation]].map(([letter, label, value]) => <section key={letter}><strong>{letter}</strong><div><span>{label}</span><textarea value={value || ''} readOnly /></div></section>)}</main>
        <aside className="nurse-ip-drawer nurse-ip-drawer--static"><header><h2>Cảnh báo ca tới</h2><p>{activeItem?.acknowledged ? 'Đã xác nhận' : 'Chưa xác nhận'}</p></header><section><h3>Việc đang mở</h3>{safeList(activeItem?.open_tasks).map((item, index) => <p key={index}>Việc {item.count || 0} · quá hạn {item.overdue || 0}</p>)}</section><section><h3>Thuốc</h3>{safeList(activeItem?.medication_warnings).map((item, index) => <p key={index}>Đến giờ {item.due || 0} · quá giờ {item.overdue || 0}</p>)}</section><section><h3>Sinh hiệu</h3><RiskBadges values={activeItem?.vital_warnings || []} /></section><footer><button type="button" onClick={() => run('ack')}>Xác nhận toàn bộ</button><button type="button" onClick={() => run('close')}>Đóng ca</button></footer></aside>
      </section>
    </PageFrame>
  );
}
