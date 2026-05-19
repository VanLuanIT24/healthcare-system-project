import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
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
  Loader2,
  Monitor,
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
  Zap,
} from 'lucide-react';
import { nurseVitalsApi } from './nurseApi';

const severityLabels = {
  normal: 'Bình thường',
  mild: 'Nhẹ',
  warning: 'Cảnh báo',
  high: 'Cao',
  critical: 'Nguy kịch',
};

const statusLabels = {
  waiting: 'Đang chờ',
  pending: 'Đang chờ',
  todo: 'Chưa nhận',
  in_progress: 'Đang xử lý',
  completed: 'Hoàn tất',
  done: 'Hoàn tất',
  recorded: 'Đã ghi nhận',
  amended: 'Đã sửa',
  entered_in_error: 'Nhập sai',
  acknowledged: 'Đã xác nhận',
  doctor_notified: 'Đã báo bác sĩ',
  pending_review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  applied: 'Đã áp dụng',
  cancelled: 'Đã hủy',
};

const fieldLabels = {
  temperature: 'Nhiệt độ',
  heart_rate: 'Mạch',
  respiratory_rate: 'Nhịp thở',
  systolic_bp: 'HA tâm thu',
  diastolic_bp: 'HA tâm trương',
  spo2: 'SpO2',
  weight: 'Cân nặng',
  height: 'Chiều cao',
  bmi: 'BMI',
  pain_score: 'Đau',
  blood_glucose: 'Đường huyết',
  map: 'MAP',
};

const vitalUnits = {
  temperature: '°C',
  heart_rate: 'bpm',
  respiratory_rate: '/phút',
  systolic_bp: 'mmHg',
  diastolic_bp: 'mmHg',
  spo2: '%',
  weight: 'kg',
  height: 'cm',
  bmi: '',
  pain_score: '/10',
  blood_glucose: 'mg/dL',
  map: 'mmHg',
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
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((entry) => textValue(entry, '')).filter(Boolean).join(', ') || fallback;
  if (typeof value === 'object') {
    return value.full_name
      || value.patient_name
      || value.patient_code
      || value.department_name
      || value.employee_code
      || value.encounter_code
      || value.display_number
      || value.queue_number
      || value.title
      || value.name
      || fallback;
  }
  return fallback;
}

const mongoObjectIdPattern = /^[a-f\d]{24}$/i;

function rawId(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value !== 'object') return '';
  for (const key of ['_id', 'id', 'patient_id', 'encounter_id', 'queue_ticket_id', 'vital_sign_id']) {
    const candidate = value[key];
    if (candidate && candidate !== value) {
      const id = rawId(candidate);
      if (id) return id;
    }
  }
  return '';
}

function backendId(value) {
  const id = rawId(value);
  return mongoObjectIdPattern.test(id) ? id : '';
}

function listOf(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function unwrapVital(item = {}) {
  return item.vital_sign || item.latest_vital_sign || item.latest_vital || item;
}

function subjectId(item = {}) {
  return textValue(item.queue_ticket_id || item.task?.queue_ticket_id || item.source_id || item.id || item.patient_id || item.patient?.patient_id, '');
}

function patientName(item = {}) {
  return textValue(item.patient_name || item.patient?.patient_name || item.patient?.full_name || item.patient_id?.full_name || item.vital_sign?.patient_id?.full_name, 'Chưa rõ bệnh nhân');
}

function patientCode(item = {}) {
  return textValue(item.patient_code || item.patient?.patient_code || item.patient_id?.patient_code || item.vital_sign?.patient_id?.patient_code, '--');
}

function patientAgeGender(item = {}) {
  const age = item.age || item.patient?.age || item.patient_id?.age;
  const gender = item.gender || item.patient?.gender || item.patient_id?.gender;
  const genderLabel = gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : gender || '--';
  return `${age || '--'} tuổi · ${genderLabel}`;
}

function encounterId(item = {}) {
  return textValue(item.encounter_id || item.encounter?.encounter_id || item.encounter?._id || item.vital_sign?.encounter_id, '');
}

function encounterObjectId(item = {}) {
  return backendId(item.encounter_id || item.encounter || item.vital_sign?.encounter_id);
}

function patientObjectId(item = {}) {
  return backendId(item.patient_id || item.patient || item.vital_sign?.patient_id);
}

function queueTicketObjectId(item = {}) {
  return backendId(item.queue_ticket_id || item.queue_ticket || item.task?.queue_ticket_id);
}

function queueNumber(item = {}) {
  return textValue(item.queue_number || item.queue_ticket?.queue_number || item.queue_ticket?.display_number || item.metadata?.queue_number || item.task?.queue_number, '--');
}

function departmentName(item = {}) {
  return textValue(item.department_name || item.department?.department_name || item.encounter?.department_id || item.queue_ticket?.department_id, 'Khoa được phân quyền');
}

function doctorName(item = {}) {
  return textValue(item.doctor_name || item.doctor || item.encounter?.attending_doctor_id || item.queue_ticket?.doctor_id, '--');
}

function vitalText(vital = {}) {
  if (!vital || typeof vital !== 'object') return 'Chưa có sinh hiệu';
  const bp = vital.systolic_bp && vital.diastolic_bp ? `HA ${vital.systolic_bp}/${vital.diastolic_bp}` : null;
  return [
    vital.temperature ? `T ${vital.temperature}°C` : null,
    vital.heart_rate ? `M ${vital.heart_rate}` : null,
    vital.respiratory_rate ? `NT ${vital.respiratory_rate}` : null,
    bp,
    vital.spo2 ? `SpO2 ${vital.spo2}%` : null,
  ].filter(Boolean).join(' · ') || 'Chưa có sinh hiệu';
}

function calculateLocalAssessment(form = {}) {
  const flags = [];
  const push = (field, level, message, recommendation) => flags.push({ field, level, severity: level, value: form[field], message, recommendation });
  const spo2 = Number(form.spo2);
  const temp = Number(form.temperature);
  const hr = Number(form.heart_rate);
  const rr = Number(form.respiratory_rate);
  const sbp = Number(form.systolic_bp);
  const dbp = Number(form.diastolic_bp);
  const pain = Number(form.pain_score);
  if (spo2 && spo2 < 90) push('spo2', 'critical', 'SpO2 rất thấp', 'Đo lại ngay và báo bác sĩ.');
  else if (spo2 && spo2 < 94) push('spo2', 'warning', 'SpO2 thấp', 'Kiểm tra đầu dò và đo lại.');
  if (temp >= 40) push('temperature', 'critical', 'Sốt rất cao', 'Báo bác sĩ và theo dõi nhiễm trùng.');
  else if (temp >= 39) push('temperature', 'warning', 'Sốt cao', 'Theo dõi và đo lại.');
  if (hr >= 150 || (hr > 0 && hr < 40)) push('heart_rate', 'critical', 'Mạch nguy hiểm', 'Đánh giá triệu chứng và báo bác sĩ.');
  else if (hr >= 120 || (hr > 0 && hr < 50)) push('heart_rate', 'warning', 'Mạch bất thường', 'Theo dõi và đo lại.');
  if (rr >= 40 || (rr > 0 && rr < 8)) push('respiratory_rate', 'critical', 'Nhịp thở nguy hiểm', 'Đánh giá hô hấp và báo bác sĩ.');
  else if (rr >= 30) push('respiratory_rate', 'warning', 'Nhịp thở nhanh', 'Theo dõi hô hấp.');
  if (sbp >= 180 || (sbp > 0 && sbp < 90) || dbp >= 120) push('systolic_bp', 'critical', 'Huyết áp nguy hiểm', 'Đo lại và báo bác sĩ.');
  if (pain >= 8) push('pain_score', 'warning', 'Đau nhiều', 'Ghi chú vị trí đau và báo bác sĩ nếu cần.');
  const severity = flags.some((flag) => flag.level === 'critical') ? 'critical' : flags.some((flag) => flag.level === 'warning') ? 'warning' : 'normal';
  const bmi = Number(form.weight) && Number(form.height) ? Number((Number(form.weight) / ((Number(form.height) / 100) ** 2)).toFixed(2)) : null;
  const map = sbp && dbp && sbp > dbp ? Number(((sbp + (2 * dbp)) / 3).toFixed(1)) : null;
  return { severity, abnormal_flags: flags, requires_recheck: severity !== 'normal', doctor_notification_required: severity === 'critical', suggested_recheck_minutes: severity === 'critical' ? 5 : severity === 'warning' ? 15 : null, calculated: { bmi, map } };
}

const demoItems = [
  {
    id: 'demo-q-012',
    queue_ticket_id: 'demo-q-012',
    queue_number: 'Q-012',
    patient_id: 'demo-p-1',
    encounter_id: 'demo-e-1',
    patient_name: 'Nguyễn Văn A',
    patient_code: 'BN000123',
    age: 54,
    gender: 'male',
    doctor_name: 'BS Trần Minh',
    department_name: 'Nội tổng quát',
    waiting_minutes: 18,
    priority: 'high',
    status: 'waiting',
    reason: 'Đau ngực, khó thở',
    latest_vital_sign: null,
    active_allergies: [{ allergen: 'Penicillin', severity: 'severe' }],
    active_problems: [{ problem_name: 'Tăng huyết áp' }],
    sla: { state: 'warning', waiting_minutes: 18, due_at: new Date(Date.now() + 12 * 60000).toISOString() },
  },
  {
    id: 'demo-q-014',
    queue_ticket_id: 'demo-q-014',
    queue_number: 'Q-014',
    patient_id: 'demo-p-2',
    encounter_id: 'demo-e-2',
    patient_name: 'Trần Thị B',
    patient_code: 'BN000214',
    age: 32,
    gender: 'female',
    doctor_name: 'BS Nguyễn Lan',
    department_name: 'Nội tổng quát',
    waiting_minutes: 34,
    priority: 'critical',
    status: 'waiting',
    reason: 'Sốt cao, đau họng',
    latest_vital_sign: { temperature: 39.2, heart_rate: 124, respiratory_rate: 28, systolic_bp: 118, diastolic_bp: 72, spo2: 92, severity: 'warning', recorded_at: new Date(Date.now() - 50 * 60000).toISOString() },
    active_allergies: [],
    active_problems: [{ problem_name: 'Hen phế quản' }],
    sla: { state: 'breached', waiting_minutes: 34, due_at: new Date(Date.now() - 4 * 60000).toISOString() },
  },
  {
    id: 'demo-q-019',
    queue_ticket_id: 'demo-q-019',
    queue_number: 'Q-019',
    patient_id: 'demo-p-3',
    encounter_id: 'demo-e-3',
    patient_name: 'Lê Văn C',
    patient_code: 'BN000317',
    age: 66,
    gender: 'male',
    doctor_name: 'BS Hoàng Khoa',
    department_name: 'Tim mạch',
    waiting_minutes: 7,
    priority: 'normal',
    status: 'waiting',
    reason: 'Tái khám tim mạch',
    latest_vital_sign: { temperature: 36.8, heart_rate: 82, respiratory_rate: 18, systolic_bp: 132, diastolic_bp: 84, spo2: 97, severity: 'normal', recorded_at: new Date(Date.now() - 12 * 60000).toISOString() },
    active_allergies: [],
    active_problems: [{ problem_name: 'Suy tim' }],
    sla: { state: 'normal', waiting_minutes: 7, due_at: new Date(Date.now() + 23 * 60000).toISOString() },
  },
];

const demoVitals = [
  { _id: 'demo-v-1', patient_id: 'demo-p-2', encounter_id: 'demo-e-2', recorded_by: { full_name: 'ĐD Mai' }, temperature: 39.2, heart_rate: 124, respiratory_rate: 28, systolic_bp: 118, diastolic_bp: 72, spo2: 92, pain_score: 4, bmi: 22.6, severity: 'warning', overall_severity: 'warning', status: 'recorded', recorded_at: new Date(Date.now() - 50 * 60000).toISOString(), abnormal_flags: [{ field: 'temperature', value: 39.2, level: 'warning', message: 'Sốt cao', recommendation: 'Theo dõi và đo lại.' }] },
  { _id: 'demo-v-2', patient_id: 'demo-p-2', encounter_id: 'demo-e-2', recorded_by: { full_name: 'ĐD Lan' }, temperature: 38.3, heart_rate: 102, respiratory_rate: 22, systolic_bp: 122, diastolic_bp: 76, spo2: 95, pain_score: 3, bmi: 22.6, severity: 'normal', overall_severity: 'normal', status: 'recorded', recorded_at: new Date(Date.now() - 130 * 60000).toISOString(), abnormal_flags: [] },
  { _id: 'demo-v-3', patient_id: 'demo-p-2', encounter_id: 'demo-e-2', recorded_by: { full_name: 'ĐD Hạnh' }, temperature: 37.4, heart_rate: 88, respiratory_rate: 18, systolic_bp: 120, diastolic_bp: 78, spo2: 98, pain_score: 2, bmi: 22.5, severity: 'normal', overall_severity: 'normal', status: 'amended', recorded_at: new Date(Date.now() - 260 * 60000).toISOString(), abnormal_flags: [] },
];

const demoCorrections = [
  {
    _id: 'demo-c-1',
    patient_id: { full_name: 'Trần Thị B', patient_code: 'BN000214' },
    encounter_id: { encounter_code: 'ENC-2026-0002' },
    vital_sign_id: demoVitals[2],
    requested_by: { full_name: 'ĐD Lan' },
    requested_at: new Date(Date.now() - 42 * 60000).toISOString(),
    reason: 'Nhiệt độ nhập nhầm 39.4 thay vì 37.4',
    reason_category: 'wrong_value',
    current_values: { temperature: 39.4, heart_rate: 88 },
    proposed_values: { temperature: 37.4, heart_rate: 88 },
    status: 'pending',
  },
];

const demoNotes = [
  { _id: 'demo-note-1', title: 'Theo dõi sốt cao', note_type: 'nursing_abnormal_vital', content: 'Ghi nhận sốt cao, đã kiểm tra lại nhiệt kế và hướng dẫn uống nước. Theo dõi sinh hiệu sau 15 phút.', status: 'signed', priority: 'important', created_at: new Date(Date.now() - 30 * 60000).toISOString(), linked_vital_sign_ids: ['demo-v-1'] },
  { _id: 'demo-note-2', title: 'Sinh hiệu thường quy', note_type: 'nursing_vital_routine', content: 'Bệnh nhân tỉnh, tiếp xúc tốt. Sinh hiệu trong giới hạn tại thời điểm đo.', status: 'draft', priority: 'normal', created_at: new Date(Date.now() - 90 * 60000).toISOString(), linked_vital_sign_ids: [] },
];

function useVitalsData(loader, fallback, deps) {
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
        setError(loadError?.message || 'Không thể tải dữ liệu sinh hiệu.');
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

function VitalsHeader({ eyebrow, title, description, meta, isDemo, loading, actions }) {
  return (
    <header className="nurse-vitals-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="nurse-vitals-meta">
          <em>{meta?.department_name || 'Khoa được phân quyền'}</em>
          <em>{meta?.shift === 'morning' ? 'Ca sáng' : meta?.shift === 'afternoon' ? 'Ca chiều' : meta?.shift === 'night' ? 'Ca đêm' : 'Tất cả ca'}</em>
          <em>{formatDate(meta?.date)}</em>
          <em>{loading ? 'Đang đồng bộ' : 'Sẵn sàng thao tác'}</em>
        </div>
      </div>
      <aside>
        <span className={`nurse-realtime-badge${isDemo ? ' is-offline' : ''}`}>
          {isDemo ? <WifiOff size={15} /> : <Wifi size={15} />}
          {isDemo ? 'Dữ liệu mẫu' : 'Thời gian thực bật'}
        </span>
        <small>Cập nhật {formatTime(meta?.generated_at || new Date())}</small>
        <div className="nurse-vitals-actions">{actions}</div>
      </aside>
    </header>
  );
}

function DemoNotice({ isDemo, error }) {
  if (!isDemo || !error) return null;
  return (
    <div className="nurse-dashboard-demo-note">
      <AlertTriangle size={16} />
      API chưa phản hồi nên đang hiển thị dữ liệu mẫu. {error}
    </div>
  );
}

function VitalsFilters({ filters, setFilters, children }) {
  return (
    <section className="nurse-vitals-filters">
      <label><span>Ngày</span><input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} /></label>
      <label><span>Ca trực</span><select value={filters.shift} onChange={(event) => setFilters((current) => ({ ...current, shift: event.target.value }))}><option value="morning">Ca sáng</option><option value="afternoon">Ca chiều</option><option value="night">Ca đêm</option><option value="all">Tất cả</option></select></label>
      <label><span>Mức độ</span><select value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}><option value="all">Tất cả</option><option value="critical">Nguy kịch</option><option value="high">Cao</option><option value="warning">Cảnh báo</option><option value="normal">Bình thường</option></select></label>
      <label><span>Trạng thái</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Tất cả</option><option value="waiting">Đang chờ</option><option value="recorded">Đã ghi nhận</option><option value="amended">Đã sửa</option><option value="entered_in_error">Nhập sai</option></select></label>
      <label className="nurse-vitals-search"><span>Tìm kiếm</span><div><Search size={15} /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Tên, mã BN, số hàng đợi, lượt khám" /></div></label>
      {children}
    </section>
  );
}

function KpiStrip({ items }) {
  return (
    <section className="nurse-vitals-kpis">
      {items.map((item) => {
        const Icon = item.icon || Activity;
        return (
          <button key={item.label} type="button" className={`nurse-vitals-kpi nurse-vitals-kpi--${item.tone || 'teal'}`} onClick={item.onClick}>
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

function SeverityBadge({ value = 'normal' }) {
  return <span className={`nurse-vital-severity nurse-vital-severity--${value}`}>{severityLabels[value] || value}</span>;
}

function StatusBadge({ value = 'waiting' }) {
  return <span className={`nurse-status-pill nurse-vitals-status--${value}`}>{statusLabels[value] || value}</span>;
}

function SlaBadge({ state, minutes }) {
  const tone = state || (minutes >= 30 ? 'breached' : minutes >= 15 ? 'warning' : 'normal');
  return <span className={`nurse-sla-pill nurse-sla-pill--${tone}`}>{tone === 'breached' ? 'Quá SLA' : tone === 'warning' ? 'Sắp trễ' : 'Đúng hạn'}</span>;
}

function VitalMiniStrip({ vital = {} }) {
  const source = unwrapVital(vital) || {};
  const cells = [
    ['Nhiệt độ', source.temperature, '°C'],
    ['Mạch', source.heart_rate, ''],
    ['Nhịp thở', source.respiratory_rate, ''],
    ['HA', source.systolic_bp && source.diastolic_bp ? `${source.systolic_bp}/${source.diastolic_bp}` : null, ''],
    ['SpO2', source.spo2, '%'],
    ['BMI', source.bmi, ''],
  ];
  return (
    <div className="nurse-vital-mini-strip">
      {cells.map(([label, value, unit]) => (
        <span key={label}>
          <small>{label}</small>
          <strong>{value ?? '--'}{value ? unit : ''}</strong>
        </span>
      ))}
    </div>
  );
}

function PatientClinicalSidebar({ item, latestVital, actions }) {
  const vital = latestVital || item?.latest_vital_sign || item?.latest_vital || item?.vital_sign;
  const allergies = listOf(item?.active_allergies || item?.allergies);
  const problems = listOf(item?.active_problems || item?.problems);
  return (
    <aside className="nurse-vitals-patient-panel">
      <section>
        <span className="nurse-panel-eyebrow">Bối cảnh bệnh nhân</span>
        <h2>{patientName(item)}</h2>
        <p>{patientCode(item)} · {patientAgeGender(item)} · {textValue(item?.phone || item?.patient?.phone, 'Chưa có SĐT')}</p>
        <div className="nurse-vitals-patient-tags">
          <SlaBadge state={item?.sla?.state} minutes={item?.waiting_minutes || item?.sla?.waiting_minutes} />
          <SeverityBadge value={vital?.severity || vital?.overall_severity || item?.latest_vital_severity || 'normal'} />
        </div>
      </section>

      <section>
        <h3>Lượt khám hiện tại</h3>
        <dl>
          <div><dt>Lượt khám</dt><dd>{textValue(item?.encounter_code || item?.encounter?.encounter_code || encounterId(item), '--')}</dd></div>
          <div><dt>Hàng đợi</dt><dd>{queueNumber(item)}</dd></div>
          <div><dt>Khoa</dt><dd>{departmentName(item)}</dd></div>
          <div><dt>Bác sĩ</dt><dd>{doctorName(item)}</dd></div>
          <div><dt>Lý do khám</dt><dd>{textValue(item?.reason || item?.priority_reason, 'Chưa ghi nhận')}</dd></div>
          <div><dt>Chờ</dt><dd>{waitText(item?.waiting_minutes || item?.sla?.waiting_minutes)}</dd></div>
        </dl>
      </section>

      <section>
        <h3>An toàn lâm sàng</h3>
        <div className="nurse-vitals-risk-list">
          <article><span>Dị ứng đang hoạt động</span><strong>{allergies.length ? allergies.map((entry) => textValue(entry.allergen || entry.name || entry, '')).filter(Boolean).join(', ') : 'Không ghi nhận'}</strong></article>
          <article><span>Vấn đề đang có</span><strong>{problems.length ? problems.map((entry) => textValue(entry.problem_name || entry.name || entry, '')).filter(Boolean).join(', ') : 'Chưa ghi nhận'}</strong></article>
          <article><span>Nguy cơ cấp cứu</span><strong>{item?.priority === 'critical' ? 'Cần ưu tiên lâm sàng' : 'Chưa có cảnh báo khẩn'}</strong></article>
        </div>
      </section>

      <section>
        <h3>Sinh hiệu mới nhất</h3>
        <VitalMiniStrip vital={vital} />
        <p>{vital ? `Đo lúc ${formatTime(vital.recorded_at)} · ${textValue(vital.recorded_by, 'Người ghi nhận chưa rõ')}` : 'Chưa có bản ghi sinh hiệu gần nhất.'}</p>
      </section>

      <section>
        <h3>Thao tác nhanh</h3>
        <div className="nurse-row-actions nurse-row-actions--wrap">
          {(actions || ['Nhập sinh hiệu', 'Ghi chú', 'Báo bác sĩ', 'Dòng thời gian', 'Tạo việc đo lại']).map((label) => <button key={label} type="button">{label}</button>)}
        </div>
      </section>
    </aside>
  );
}

function PatientQueueCard({ item, selected, onSelect, mode = 'waiting' }) {
  const vital = item.latest_vital_sign || item.latest_vital || item.vital_sign;
  return (
    <article className={`nurse-vitals-patient-card nurse-vitals-patient-card--${item.priority || vital?.severity || 'normal'}${selected ? ' is-selected' : ''}`}>
      <button type="button" onClick={() => onSelect(item)}>
        <header>
          <div>
            <strong>{queueNumber(item)} · {patientName(item)}</strong>
            <span>{patientCode(item)} · {patientAgeGender(item)}</span>
          </div>
          <SeverityBadge value={vital?.severity || vital?.overall_severity || item.latest_vital_severity || (item.priority === 'critical' ? 'critical' : 'normal')} />
        </header>
        <p>{textValue(item.reason || item.priority_reason, mode === 'waiting' ? 'Chờ đo sinh hiệu trước khám' : 'Cần xử lý sinh hiệu')}</p>
        <VitalMiniStrip vital={vital} />
        <footer>
          <SlaBadge state={item.sla?.state} minutes={item.waiting_minutes || item.sla?.waiting_minutes} />
          <span>{doctorName(item)}</span>
          <span>{departmentName(item)}</span>
        </footer>
      </button>
      <div className="nurse-vitals-card-actions">
        <button type="button">Gọi đo</button>
        <button type="button">Nhập nhanh</button>
        <button type="button">Ghi chú</button>
        <button type="button">Báo BS</button>
      </div>
    </article>
  );
}

function TrendChart({ title, series = [], unit = '', tone = 'teal' }) {
  const points = series.filter((point) => point.value !== undefined && point.value !== null).slice(-12);
  const values = points.map((point) => Number(point.value));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = Math.max(1, max - min);
  const coords = points.map((point, index) => {
    const x = points.length <= 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 86 - ((Number(point.value) - min) / span) * 72;
    return `${x},${y}`;
  }).join(' ');
  return (
    <article className={`nurse-vitals-chart nurse-vitals-chart--${tone}`}>
      <header><strong>{title}</strong><span>{values.length ? `${values[values.length - 1]}${unit}` : '--'}</span></header>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={title}>
        <polyline points="0,86 100,86" />
        {coords ? <polyline points={coords} className="is-line" /> : null}
        {points.map((point, index) => {
          const x = points.length <= 1 ? 50 : (index / (points.length - 1)) * 100;
          const y = 86 - ((Number(point.value) - min) / span) * 72;
          return <circle key={`${point.time}-${index}`} cx={x} cy={y} r="2.4" />;
        })}
      </svg>
      <footer><span>{points[0] ? formatTime(points[0].time) : '--'}</span><span>{points[points.length - 1] ? formatTime(points[points.length - 1].time) : '--'}</span></footer>
    </article>
  );
}

function AbnormalFlagList({ flags = [] }) {
  if (!flags.length) return <div className="nurse-vitals-empty-inline">Không có chỉ số bất thường.</div>;
  return (
    <div className="nurse-vitals-flag-list">
      {flags.map((flag, index) => (
        <article key={`${flag.field}-${index}`} className={`nurse-vitals-flag nurse-vitals-flag--${flag.level || flag.severity || 'warning'}`}>
          <strong>{fieldLabels[flag.field] || flag.field}: {textValue(flag.value)}</strong>
          <span>{flag.message}</span>
          <small>{flag.recommendation || 'Theo dõi và đánh giá lại.'}</small>
        </article>
      ))}
    </div>
  );
}

function VitalTimelineTable({ items = [], onSelect }) {
  return (
    <div className="nurse-vitals-table-wrap">
      <table className="nurse-vitals-table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Người ghi</th>
            <th>Nhiệt độ</th>
            <th>Mạch</th>
            <th>Nhịp thở</th>
            <th>Huyết áp</th>
            <th>SpO2</th>
            <th>Đau</th>
            <th>BMI</th>
            <th>Mức độ</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => {
            const vital = unwrapVital(entry);
            return (
              <tr key={vital._id || vital.id || vital.recorded_at}>
                <td><strong>{formatTime(vital.recorded_at)}</strong><small>{formatDate(vital.recorded_at)}</small></td>
                <td>{textValue(vital.recorded_by || entry.recorded_by_user, '--')}</td>
                <td>{vital.temperature ?? '--'}</td>
                <td>{vital.heart_rate ?? '--'}</td>
                <td>{vital.respiratory_rate ?? '--'}</td>
                <td>{vital.systolic_bp && vital.diastolic_bp ? `${vital.systolic_bp}/${vital.diastolic_bp}` : '--'}</td>
                <td>{vital.spo2 ? `${vital.spo2}%` : '--'}</td>
                <td>{vital.pain_score ?? '--'}</td>
                <td>{vital.bmi ?? '--'}</td>
                <td><SeverityBadge value={vital.severity || vital.overall_severity || 'normal'} /></td>
                <td><StatusBadge value={vital.status || 'recorded'} /></td>
                <td><div className="nurse-row-actions"><button type="button" onClick={() => onSelect?.(entry)}>Chi tiết</button><button type="button">Sửa</button></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!items.length ? <div className="nurse-vitals-empty-inline">Chưa có bản ghi sinh hiệu phù hợp.</div> : null}
    </div>
  );
}

function filterItems(items, filters) {
  const query = String(filters.search || '').toLowerCase();
  return items.filter((item) => {
    const vital = unwrapVital(item);
    const severity = vital?.severity || vital?.overall_severity || item.latest_vital_severity || item.priority || 'normal';
    if (filters.severity !== 'all' && severity !== filters.severity) return false;
    if (filters.status !== 'all' && item.status !== filters.status && vital?.status !== filters.status) return false;
    if (query && !`${patientName(item)} ${patientCode(item)} ${queueNumber(item)} ${encounterId(item)}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

function baseFilters() {
  return { date: toLocalDateKey(), shift: 'morning', severity: 'all', status: 'all', search: '' };
}

function metaFrom(filters) {
  return { date: filters.date, shift: filters.shift, generated_at: new Date().toISOString(), department_name: 'Sinh hiệu & ghi nhận' };
}

function useWaitingVitals(filters, refresh) {
  const fallback = {
    meta: metaFrom(filters),
    summary: { total_waiting: 3, no_vitals: 1, overdue: 1, high_priority: 2, recheck_due: 1, abnormal_latest: 1 },
    items: demoItems,
  };
  return useVitalsData(
    () => nurseVitalsApi.getWaitingVitals({ date: filters.date, shift: filters.shift, status: filters.status === 'all' ? undefined : filters.status }),
    fallback,
    [filters.date, filters.shift, filters.status, refresh],
  );
}

export function WaitingVitalsPage() {
  const [filters, setFilters] = useState(baseFilters());
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(demoItems[0]);
  const { data, loading, isDemo, error } = useWaitingVitals(filters, refresh);
  const items = filterItems(listOf(data.items), filters);
  const summary = data.summary || {};

  useEffect(() => {
    if (!selected && items[0]) setSelected(items[0]);
  }, [items, selected]);

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Danh sách chờ, SLA và nguy cơ lâm sàng" title="Chờ đo sinh hiệu" description="Điều phối bệnh nhân cần đo sinh hiệu, phát hiện quá SLA, ưu tiên nguy cơ cao và mở thao tác nhanh trong một màn hình." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={loading} actions={<><button type="button"><Bell size={16} />Gọi bệnh nhân</button><button type="button"><HeartPulse size={16} />Nhập nhanh</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {loading ? <div className="nurse-operation-loading"><Loader2 className="is-spinning" size={18} />Đang tải danh sách sinh hiệu...</div> : null}
      <VitalsFilters filters={filters} setFilters={setFilters} />
      <KpiStrip items={[
        { label: 'Chờ đo', value: summary.total_waiting ?? summary.pending ?? items.length, detail: 'Bệnh nhân trong danh sách', icon: Clock3, tone: 'blue' },
        { label: 'Chưa từng đo', value: summary.no_vitals ?? items.filter((item) => !item.latest_vital_sign).length, detail: 'Cần nhập bộ đầu tiên', icon: HeartPulse, tone: 'cyan' },
        { label: 'Quá SLA', value: summary.overdue ?? items.filter((item) => item.sla?.state === 'breached').length, detail: 'Cần xử lý ngay', icon: AlertTriangle, tone: 'red' },
        { label: 'Cần đo lại', value: summary.recheck_due ?? 0, detail: 'Theo dõi sau bất thường', icon: RefreshCw, tone: 'amber' },
        { label: 'Nguy cơ cao', value: summary.high_priority ?? items.filter((item) => item.priority === 'critical' || item.priority === 'high').length, detail: 'Ưu tiên lâm sàng', icon: ShieldAlert, tone: 'violet' },
        { label: 'Bất thường', value: summary.abnormal_latest ?? items.filter((item) => item.latest_vital_sign?.severity && item.latest_vital_sign.severity !== 'normal').length, detail: 'Sinh hiệu mới cần xem', icon: Zap, tone: 'red' },
      ]} />
      <section className="nurse-vitals-shell">
        <aside className="nurse-vitals-buckets">
          {[
            ['Tất cả', items.length, LayoutGrid],
            ['Chưa từng đo', items.filter((item) => !item.latest_vital_sign).length, HeartPulse],
            ['Quá SLA', items.filter((item) => item.sla?.state === 'breached').length, Clock3],
            ['Cần đo lại', summary.recheck_due ?? 0, RefreshCw],
            ['Có nguy cơ', items.filter((item) => ['critical', 'high'].includes(item.priority)).length, ShieldAlert],
          ].map(([label, value, Icon]) => <button key={label} type="button"><Icon size={16} /><span>{label}</span><strong>{value}</strong></button>)}
        </aside>
        <main className="nurse-vitals-worklist">
          {items.map((item) => <PatientQueueCard key={subjectId(item)} item={item} selected={subjectId(item) === subjectId(selected)} onSelect={setSelected} />)}
        </main>
        <PatientClinicalSidebar item={selected || items[0]} />
      </section>
    </section>
  );
}

function VitalInputField({ label, field, unit, form, setForm, min, max, step = '0.1', quick = [] }) {
  return (
    <label className="nurse-vital-input-field">
      <span>{label}</span>
      <div>
        <input type="number" min={min} max={max} step={step} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} />
        <em>{unit}</em>
      </div>
      {quick.length ? <small>{quick.map((value) => <button key={value} type="button" onClick={() => setForm((current) => ({ ...current, [field]: value }))}>{value}</button>)}</small> : null}
    </label>
  );
}

const emptyVitalForm = {
  temperature: '36.8',
  heart_rate: '82',
  respiratory_rate: '18',
  systolic_bp: '120',
  diastolic_bp: '78',
  spo2: '98',
  weight: '',
  height: '',
  pain_score: '0',
  blood_glucose: '',
  oxygen_device: 'room_air',
  oxygen_flow_rate: '',
  consciousness_level: 'alert',
  measurement_position: 'sitting',
  temperature_site: 'axillary',
  bp_site: 'right_arm',
  note: '',
};

export function VitalEntryPage() {
  const [filters, setFilters] = useState(baseFilters());
  const [refresh, setRefresh] = useState(0);
  const { data, isDemo, error } = useWaitingVitals(filters, refresh);
  const waitingItems = filterItems(listOf(data.items), filters);
  const [selected, setSelected] = useState(waitingItems[0] || demoItems[0]);
  const [form, setForm] = useState(emptyVitalForm);
  const [preview, setPreview] = useState(calculateLocalAssessment(emptyVitalForm));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!waitingItems[0]) return;
    if (!selected || (!encounterObjectId(selected) && !queueTicketObjectId(selected))) setSelected(waitingItems[0]);
  }, [selected, waitingItems]);

  useEffect(() => {
    const localAssessment = calculateLocalAssessment(form);
    setPreview(localAssessment);
    const contextId = encounterObjectId(selected);
    const queueId = queueTicketObjectId(selected);
    if (!contextId && !queueId) return undefined;
    const handle = window.setTimeout(() => {
      nurseVitalsApi.previewVitalSigns({
        ...form,
        encounter_id: contextId || undefined,
        queue_ticket_id: queueId || undefined,
      }).then((payload) => {
        setPreview(payload?.assessment ? { ...payload.assessment, calculated: payload.calculated, deltas: payload.deltas } : localAssessment);
      }).catch(() => setPreview(localAssessment));
    }, 420);
    return () => window.clearTimeout(handle);
  }, [form, selected]);

  async function saveVitals(extra = {}) {
    setSaving(true);
    setNotice('');
    try {
      const context = encounterObjectId(selected);
      const queue = queueTicketObjectId(selected);
      if (!context && !queue) throw new Error('Chưa có lượt khám hoặc số hàng đợi hợp lệ từ hệ thống để lưu sinh hiệu.');
      await nurseVitalsApi.recordVitalSigns({
        ...form,
        encounter_id: context || undefined,
        queue_ticket_id: queue || undefined,
        context: context ? 'encounter' : 'pre_triage',
        ...extra,
      });
      setNotice('Đã lưu sinh hiệu và cập nhật trạng thái điều dưỡng.');
      setRefresh((value) => value + 1);
    } catch (saveError) {
      setNotice(saveError?.message || 'Không thể lưu sinh hiệu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Màn nhập sinh hiệu" title="Nhập sinh hiệu" description="Nhập nhanh, kiểm tra thời gian thực, so sánh lần trước, đánh giá bất thường và nối chuỗi thao tác ghi chú, báo bác sĩ, tạo đo lại." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={saving} actions={<><button type="button" onClick={() => saveVitals()} disabled={saving}><CheckCircle2 size={16} />Lưu</button><button type="button" onClick={() => saveVitals({ create_note: true })}><FileText size={16} />Lưu & ghi chú</button><button type="button" onClick={() => setForm(emptyVitalForm)}><RefreshCw size={16} />Đặt lại</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <section className="nurse-vitals-entry-layout">
        <aside className="nurse-vitals-selector">
          <VitalsFilters filters={filters} setFilters={setFilters} />
          <div className="nurse-vitals-selector-list">
            {waitingItems.slice(0, 10).map((item) => <PatientQueueCard key={subjectId(item)} item={item} selected={subjectId(item) === subjectId(selected)} onSelect={setSelected} />)}
          </div>
        </aside>

        <main className="nurse-vitals-entry-form">
          <header>
            <div>
              <span>Đang nhập</span>
              <h2>{patientName(selected)} · {patientCode(selected)} · {queueNumber(selected)}</h2>
              <p>{textValue(selected?.reason, 'Đo sinh hiệu trước khi gặp bác sĩ')}</p>
            </div>
            <SeverityBadge value={preview.severity || 'normal'} />
          </header>
          <section className="nurse-vital-form-grid">
            <VitalInputField label="Nhiệt độ" field="temperature" unit="°C" form={form} setForm={setForm} min="25" max="45" quick={['36.5', '37.5', '38.5', '39.0']} />
            <VitalInputField label="Mạch" field="heart_rate" unit="bpm" form={form} setForm={setForm} min="20" max="250" step="1" quick={['72', '88', '110', '128']} />
            <VitalInputField label="Nhịp thở" field="respiratory_rate" unit="/phút" form={form} setForm={setForm} min="5" max="80" step="1" quick={['16', '18', '22', '30']} />
            <VitalInputField label="HA tâm thu" field="systolic_bp" unit="mmHg" form={form} setForm={setForm} min="40" max="260" step="1" quick={['110', '120', '140', '180']} />
            <VitalInputField label="HA tâm trương" field="diastolic_bp" unit="mmHg" form={form} setForm={setForm} min="20" max="160" step="1" quick={['70', '80', '90', '110']} />
            <VitalInputField label="SpO2" field="spo2" unit="%" form={form} setForm={setForm} min="50" max="100" step="1" quick={['98', '95', '92', '88']} />
            <VitalInputField label="Cân nặng" field="weight" unit="kg" form={form} setForm={setForm} min="0.5" max="500" />
            <VitalInputField label="Chiều cao" field="height" unit="cm" form={form} setForm={setForm} min="20" max="250" />
            <VitalInputField label="Điểm đau" field="pain_score" unit="/10" form={form} setForm={setForm} min="0" max="10" step="1" quick={['0', '3', '6', '8']} />
            <VitalInputField label="Đường huyết" field="blood_glucose" unit="mg/dL" form={form} setForm={setForm} min="10" max="1000" step="1" />
          </section>
          <section className="nurse-vital-extension-grid">
            <label><span>Thiết bị oxy</span><select value={form.oxygen_device} onChange={(event) => setForm((current) => ({ ...current, oxygen_device: event.target.value }))}><option value="room_air">Khí phòng</option><option value="nasal_cannula">Gọng mũi</option><option value="simple_mask">Mặt nạ đơn giản</option><option value="non_rebreather_mask">Mặt nạ không thở lại</option><option value="venturi_mask">Mặt nạ Venturi</option><option value="high_flow">Oxy dòng cao</option><option value="ventilator">Máy thở</option></select></label>
            <label><span>Lưu lượng oxy</span><input type="number" value={form.oxygen_flow_rate} onChange={(event) => setForm((current) => ({ ...current, oxygen_flow_rate: event.target.value }))} placeholder="L/phút" /></label>
            <label><span>Ý thức AVPU</span><select value={form.consciousness_level} onChange={(event) => setForm((current) => ({ ...current, consciousness_level: event.target.value }))}><option value="alert">Tỉnh</option><option value="voice">Đáp ứng lời gọi</option><option value="pain">Đáp ứng đau</option><option value="unresponsive">Không đáp ứng</option></select></label>
            <label><span>Tư thế đo</span><select value={form.measurement_position} onChange={(event) => setForm((current) => ({ ...current, measurement_position: event.target.value }))}><option value="sitting">Ngồi</option><option value="lying">Nằm</option><option value="standing">Đứng</option></select></label>
            <label><span>Vị trí nhiệt độ</span><select value={form.temperature_site} onChange={(event) => setForm((current) => ({ ...current, temperature_site: event.target.value }))}><option value="axillary">Nách</option><option value="oral">Miệng</option><option value="tympanic">Tai</option><option value="rectal">Trực tràng</option><option value="forehead">Trán</option></select></label>
            <label><span>Vị trí HA</span><select value={form.bp_site} onChange={(event) => setForm((current) => ({ ...current, bp_site: event.target.value }))}><option value="right_arm">Tay phải</option><option value="left_arm">Tay trái</option><option value="right_leg">Chân phải</option><option value="left_leg">Chân trái</option></select></label>
          </section>
          <label className="nurse-vital-note"><span>Ghi chú điều dưỡng</span><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={4} placeholder="Ghi nhận triệu chứng, tư thế, thiết bị, thao tác đã thực hiện..." /></label>
          <footer>
            <button type="button" onClick={() => saveVitals()} disabled={saving}>{saving ? <Loader2 className="is-spinning" size={16} /> : <CheckCircle2 size={16} />}Lưu bản ghi</button>
            <button type="button" onClick={() => saveVitals({ mark_ready_for_doctor: true })}>Lưu & sẵn sàng gặp BS</button>
            <button type="button" onClick={() => saveVitals({ notify_doctor: true })}>Lưu & báo bác sĩ</button>
            <button type="button" onClick={() => saveVitals({ request_recheck: true })}>Lưu & tạo đo lại</button>
          </footer>
        </main>

        <aside className="nurse-vitals-intelligence">
          <section>
            <h3><Zap size={16} />Phân tích lâm sàng</h3>
            <div className={`nurse-vitals-score nurse-vitals-score--${preview.severity || 'normal'}`}>
              <strong>{severityLabels[preview.severity] || preview.severity}</strong>
              <span>{preview.requires_recheck ? `Đề xuất đo lại sau ${preview.suggested_recheck_minutes || 15} phút` : 'Không cần đo lại bắt buộc'}</span>
            </div>
            <AbnormalFlagList flags={preview.abnormal_flags || []} />
          </section>
          <section>
            <h3><Activity size={16} />Chỉ số tính toán</h3>
            <div className="nurse-vitals-calculated">
              <span><strong>{preview.calculated?.bmi ?? '--'}</strong>BMI dự kiến</span>
              <span><strong>{preview.calculated?.map ?? '--'}</strong>MAP</span>
              <span><strong>{preview.deltas?.spo2 ?? '--'}</strong>Chênh lệch SpO2</span>
            </div>
          </section>
          <PatientClinicalSidebar item={selected} latestVital={selected?.latest_vital_sign} actions={['Lịch sử', 'Ghi chú', 'Báo bác sĩ', 'Tạo đo lại']} />
        </aside>
      </section>
    </section>
  );
}

function normalizeHistoryItems(payload) {
  const rawItems = listOf(payload?.items);
  if (!rawItems.length) return demoVitals.map((vital) => ({ vital_sign: vital }));
  return rawItems.map((entry) => (entry.vital_sign ? entry : { vital_sign: entry }));
}

function seriesFromVitals(items, field) {
  return items
    .map((entry) => unwrapVital(entry))
    .filter((vital) => vital[field] !== undefined && vital[field] !== null)
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
    .map((vital) => ({ time: vital.recorded_at, value: vital[field] }));
}

export function VitalHistoryPage() {
  const [filters, setFilters] = useState(baseFilters());
  const [refresh, setRefresh] = useState(0);
  const { data: worklistData } = useWaitingVitals(filters, refresh);
  const selected = listOf(worklistData.items).find((item) => patientObjectId(item)) || demoItems[1];
  const targetPatientId = patientObjectId(selected);
  const fallback = { meta: metaFrom(filters), patient: selected.patient, summary: { total_records: demoVitals.length, abnormal_records: 1, critical_records: 0, amended_records: 1, entered_in_error_records: 0 }, items: demoVitals.map((vital) => ({ vital_sign: vital })) };
  const { data, loading, isDemo, error } = useVitalsData(
    () => (targetPatientId ? nurseVitalsApi.getPatientVitals(targetPatientId, { date_from: filters.date, abnormal_only: filters.severity === 'all' ? undefined : filters.severity !== 'normal' }) : Promise.reject(new Error('Chưa chọn patient_id'))),
    fallback,
    [filters.date, filters.severity, refresh, targetPatientId],
  );
  const items = normalizeHistoryItems(data);
  const latest = unwrapVital(items[0] || {});

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Dòng thời gian, xu hướng, so sánh và kiểm tra" title="Lịch sử sinh hiệu" description="Xem lịch sử sinh hiệu theo bệnh nhân/lượt khám, phân tích xu hướng, so sánh lần trước và mở kiểm tra/sửa khi cần." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={loading} actions={<><button type="button"><Download size={16} />Xuất</button><button type="button"><Table2 size={16} />In bảng</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      <VitalsFilters filters={filters} setFilters={setFilters} />
      <KpiStrip items={[
        { label: 'Tổng bản ghi', value: data.summary?.total_records ?? items.length, detail: 'Trong bộ lọc', icon: ClipboardList, tone: 'blue' },
        { label: 'Bất thường', value: data.summary?.abnormal_records ?? items.filter((entry) => unwrapVital(entry).overall_severity !== 'normal').length, detail: 'Có dấu hiệu bất thường', icon: AlertTriangle, tone: 'red' },
        { label: 'Nguy kịch', value: data.summary?.critical_records ?? 0, detail: 'Cần ưu tiên', icon: ShieldAlert, tone: 'red' },
        { label: 'Đã chỉnh sửa', value: data.summary?.amended_records ?? 0, detail: 'Đã sửa', icon: FileText, tone: 'amber' },
        { label: 'Nhập sai', value: data.summary?.entered_in_error_records ?? 0, detail: 'Đã vô hiệu', icon: AlertTriangle, tone: 'slate' },
        { label: 'Mới nhất', value: latest?.spo2 ? `${latest.spo2}%` : '--', detail: latest ? formatTime(latest.recorded_at) : 'Chưa có', icon: HeartPulse, tone: 'cyan' },
      ]} />
      <section className="nurse-vitals-history-layout">
        <main className="nurse-vitals-trend-panel">
          <section className="nurse-vitals-latest-snapshot">
            <div><span>Tóm tắt mới nhất</span><strong>{vitalText(latest)}</strong></div>
            <SeverityBadge value={latest?.severity || latest?.overall_severity || 'normal'} />
          </section>
          <div className="nurse-vitals-chart-grid">
            <TrendChart title="Xu hướng nhiệt độ" series={seriesFromVitals(items, 'temperature')} unit="°C" tone="red" />
            <TrendChart title="Xu hướng mạch" series={seriesFromVitals(items, 'heart_rate')} unit="" tone="amber" />
            <TrendChart title="Xu hướng SpO2" series={seriesFromVitals(items, 'spo2')} unit="%" tone="blue" />
            <TrendChart title="Huyết áp tâm thu" series={seriesFromVitals(items, 'systolic_bp')} unit=" mmHg" tone="violet" />
          </div>
          <VitalTimelineTable items={items} />
        </main>
        <PatientClinicalSidebar item={selected} latestVital={latest} />
      </section>
    </section>
  );
}

export function AbnormalVitalsPage() {
  const [filters, setFilters] = useState(baseFilters());
  const [refresh, setRefresh] = useState(0);
  const fallback = { meta: metaFrom(filters), summary: { abnormal: 1, critical: 0, high: 0, warning: 1, unacknowledged: 1, doctor_notified: 0 }, items: [{ ...demoItems[1], vital_sign_id: 'demo-v-1', vital_sign: demoVitals[0], message: 'Sốt cao 39.2°C · Mạch 124', severity: 'warning', created_at: demoVitals[0].recorded_at, actions: ['acknowledge', 'request_recheck', 'notify_doctor'] }] };
  const { data, loading, isDemo, error } = useVitalsData(() => nurseVitalsApi.getAbnormalVitals({ date: filters.date, shift: filters.shift }), fallback, [filters.date, filters.shift, refresh]);
  const items = filterItems(listOf(data.items), filters);
  const [selected, setSelected] = useState(items[0] || fallback.items[0]);
  const [notice, setNotice] = useState('');
  const active = selected || items[0] || fallback.items[0];
  const activeVital = unwrapVital(active);

  async function alertAction(action, item = active) {
    const vitalId = item.vital_sign_id || unwrapVital(item)._id;
    if (!vitalId) {
      setNotice('Bản ghi mẫu chưa có vital_sign_id thực.');
      return;
    }
    try {
      if (action === 'acknowledge') await nurseVitalsApi.acknowledgeVital(vitalId);
      if (action === 'notify_doctor') await nurseVitalsApi.notifyDoctorOfVital(vitalId);
      setNotice(action === 'acknowledge' ? 'Đã xác nhận cảnh báo sinh hiệu.' : 'Đã ghi nhận báo bác sĩ.');
      setRefresh((value) => value + 1);
    } catch (actionError) {
      setNotice(actionError?.message || 'Không thể cập nhật cảnh báo.');
    }
  }

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Bảng an toàn và quy trình báo khẩn" title="Sinh hiệu bất thường" description="Quản lý cảnh báo sinh hiệu theo mức độ, SLA xử lý, xác nhận đã xem, yêu cầu đo lại, báo bác sĩ và đóng luồng theo dõi." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={loading} actions={<><button type="button" onClick={() => alertAction('acknowledge')}><CheckCircle2 size={16} />Xác nhận</button><button type="button" onClick={() => alertAction('notify_doctor')}><Send size={16} />Báo bác sĩ</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <VitalsFilters filters={filters} setFilters={setFilters} />
      <KpiStrip items={[
        { label: 'Nguy kịch', value: data.summary?.critical ?? items.filter((item) => (unwrapVital(item).severity || item.severity) === 'critical').length, detail: 'Cần xử lý ngay', icon: ShieldAlert, tone: 'red' },
        { label: 'Cảnh báo', value: data.summary?.warning ?? data.summary?.high ?? items.length, detail: 'Cần theo dõi', icon: AlertTriangle, tone: 'amber' },
        { label: 'Chưa xử lý', value: data.summary?.unacknowledged ?? items.filter((item) => !unwrapVital(item).acknowledged_at).length, detail: 'Chờ xác nhận', icon: Bell, tone: 'blue' },
        { label: 'Đã báo BS', value: data.summary?.doctor_notified ?? items.filter((item) => unwrapVital(item).doctor_notified_at).length, detail: 'Có báo khẩn', icon: Send, tone: 'violet' },
        { label: 'Cần đo lại', value: items.filter((item) => unwrapVital(item).requires_recheck).length, detail: 'Theo bộ quy tắc', icon: RefreshCw, tone: 'cyan' },
        { label: 'Tổng bất thường', value: data.summary?.abnormal ?? items.length, detail: 'Trong ca', icon: HeartPulse, tone: 'red' },
      ]} />
      <section className="nurse-vitals-alert-layout">
        <aside className="nurse-vitals-alert-feed">
          {items.map((item) => {
            const vital = unwrapVital(item);
            return (
              <button key={item.vital_sign_id || vital._id || subjectId(item)} type="button" className={`nurse-vitals-alert-card nurse-vitals-alert-card--${item.severity || vital.severity || vital.overall_severity}`} onClick={() => setSelected(item)}>
                <header><SeverityBadge value={item.severity || vital.severity || vital.overall_severity || 'warning'} /><strong>{item.message || vitalText(vital)}</strong></header>
                <p>{patientName(item)} · {patientCode(item)} · {queueNumber(item)}</p>
                <small>{formatTime(vital.recorded_at || item.created_at)} · SLA {item.sla_status === 'breached' ? 'quá hạn' : 'đang theo dõi'}</small>
              </button>
            );
          })}
        </aside>
        <main className="nurse-vitals-alert-detail">
          <header>
            <SeverityBadge value={active.severity || activeVital.severity || activeVital.overall_severity || 'warning'} />
            <h2>{patientName(active)} · {vitalText(activeVital)}</h2>
            <p>{patientCode(active)} · {queueNumber(active)} · {doctorName(active)}</p>
          </header>
          <VitalMiniStrip vital={activeVital} />
          <AbnormalFlagList flags={activeVital.abnormal_flags || active.flags || []} />
          <section className="nurse-vitals-alert-workflow">
            {['Mới', 'Đã xác nhận', 'Yêu cầu đo lại', 'Đã báo bác sĩ', 'Đã báo khẩn', 'Đã xử lý'].map((step, index) => <span key={step} className={index <= (activeVital.doctor_notified_at ? 3 : activeVital.acknowledged_at ? 1 : 0) ? 'is-done' : ''}>{step}</span>)}
          </section>
          <footer>
            <button type="button" onClick={() => alertAction('acknowledge')}><CheckCircle2 size={16} />Xác nhận đã xem</button>
            <button type="button"><RefreshCw size={16} />Tạo việc đo lại</button>
            <button type="button" onClick={() => alertAction('notify_doctor')}><Send size={16} />Báo bác sĩ</button>
            <button type="button"><FileText size={16} />Tạo ghi chú</button>
            <button type="button"><ShieldAlert size={16} />Báo khẩn</button>
          </footer>
        </main>
        <PatientClinicalSidebar item={active} latestVital={activeVital} />
      </section>
    </section>
  );
}

export function VitalCorrectionsPage() {
  const [filters, setFilters] = useState(baseFilters());
  const [refresh, setRefresh] = useState(0);
  const fallback = { meta: metaFrom(filters), summary: { total: 1, pending: 1, approved: 0, applied: 0, rejected: 0, cancelled: 0 }, items: demoCorrections };
  const { data, loading, isDemo, error } = useVitalsData(() => nurseVitalsApi.getCorrections({ status: filters.status === 'all' ? undefined : filters.status }), fallback, [filters.status, refresh]);
  const items = listOf(data.items).filter((item) => !filters.search || `${patientName(item)} ${textValue(item.reason, '')}`.toLowerCase().includes(filters.search.toLowerCase()));
  const [selected, setSelected] = useState(items[0] || demoCorrections[0]);
  const [notice, setNotice] = useState('');
  const active = selected || items[0] || demoCorrections[0];

  async function updateCorrection(action) {
    if (!active?._id || String(active._id).startsWith('demo')) {
      setNotice('Bản ghi mẫu chưa thể thao tác trên hệ thống.');
      return;
    }
    try {
      if (action === 'approve') await nurseVitalsApi.approveCorrection(active._id, { review_note: 'Đồng ý sửa theo đề xuất.' });
      if (action === 'reject') await nurseVitalsApi.rejectCorrection(active._id, { review_note: 'Cần bổ sung lý do.' });
      if (action === 'apply') await nurseVitalsApi.applyCorrection(active._id);
      if (action === 'cancel') await nurseVitalsApi.cancelCorrection(active._id, { reason: 'Hủy theo yêu cầu điều dưỡng.' });
      setNotice('Đã cập nhật yêu cầu sửa sinh hiệu.');
      setRefresh((value) => value + 1);
    } catch (actionError) {
      setNotice(actionError?.message || 'Không thể cập nhật yêu cầu sửa.');
    }
  }

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Quy trình chất lượng dữ liệu, so sánh trước/sau và kiểm tra" title="Bản ghi cần sửa" description="Quản lý yêu cầu sửa sinh hiệu, duyệt sửa, áp dụng sửa, đánh dấu nhập sai và xem dòng thời gian kiểm tra." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={loading} actions={<><button type="button"><Plus size={16} />Tạo yêu cầu</button><button type="button" onClick={() => updateCorrection('approve')}><CheckCircle2 size={16} />Duyệt</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <VitalsFilters filters={filters} setFilters={setFilters} />
      <KpiStrip items={[
        { label: 'Cần kiểm tra', value: data.summary?.pending ?? 0, detail: 'Chờ duyệt', icon: Clock3, tone: 'amber' },
        { label: 'Chờ duyệt', value: data.summary?.approved ?? 0, detail: 'Đã duyệt, chưa áp dụng', icon: ClipboardCheck, tone: 'blue' },
        { label: 'Đã sửa', value: data.summary?.applied ?? 0, detail: 'Áp dụng hôm nay', icon: CheckCircle2, tone: 'green' },
        { label: 'Từ chối', value: data.summary?.rejected ?? 0, detail: 'Không hợp lệ', icon: AlertTriangle, tone: 'red' },
        { label: 'Đã hủy', value: data.summary?.cancelled ?? 0, detail: 'Không tiếp tục', icon: FileText, tone: 'slate' },
        { label: 'Tổng yêu cầu', value: data.summary?.total ?? items.length, detail: 'Trong bộ lọc', icon: ClipboardList, tone: 'violet' },
      ]} />
      <section className="nurse-vitals-correction-layout">
        <main className="nurse-vitals-correction-table">
          <div className="nurse-vitals-table-wrap">
            <table className="nurse-vitals-table">
              <thead><tr><th>Bệnh nhân</th><th>Lượt khám</th><th>Trường nghi sai</th><th>Người yêu cầu</th><th>Lý do</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>{items.map((item) => {
                const changed = Object.keys(item.proposed_values || {});
                return <tr key={item._id} onClick={() => setSelected(item)}><td><strong>{patientName(item)}</strong><small>{patientCode(item)}</small></td><td>{textValue(item.encounter_id, '--')}</td><td>{changed.map((field) => fieldLabels[field] || field).join(', ') || '--'}</td><td>{textValue(item.requested_by, '--')}</td><td>{item.reason}</td><td><StatusBadge value={item.status} /></td><td><div className="nurse-row-actions"><button type="button" onClick={(event) => { event.stopPropagation(); setSelected(item); }}>Xem</button><button type="button" onClick={(event) => { event.stopPropagation(); setSelected(item); updateCorrection('apply'); }}>Áp dụng</button></div></td></tr>;
              })}</tbody>
            </table>
          </div>
        </main>
        <aside className="nurse-vitals-correction-detail">
          <header><StatusBadge value={active?.status || 'pending'} /><h2>{patientName(active)}</h2><p>{active?.reason}</p></header>
          <section>
            <h3>Trước / Sau</h3>
            <div className="nurse-vitals-diff-list">
              {Object.keys(active?.proposed_values || {}).map((field) => <article key={field}><span>{fieldLabels[field] || field}</span><strong>{textValue(active.current_values?.[field])} → {textValue(active.proposed_values?.[field])}</strong></article>)}
            </div>
          </section>
          <section>
            <h3>Dòng thời gian kiểm tra</h3>
            <ol className="nurse-drawer-timeline">
              <li><span>{formatTime(active?.requested_at)}</span><strong>Đã yêu cầu sửa</strong></li>
              <li><span>{formatTime(active?.reviewed_at)}</span><strong>Đã duyệt</strong></li>
              <li><span>{formatTime(active?.applied_at)}</span><strong>Đã áp dụng</strong></li>
            </ol>
          </section>
          <footer>
            <button type="button" onClick={() => updateCorrection('approve')}>Duyệt</button>
            <button type="button" onClick={() => updateCorrection('reject')}>Từ chối</button>
            <button type="button" onClick={() => updateCorrection('apply')}>Áp dụng</button>
            <button type="button" onClick={() => updateCorrection('cancel')}>Hủy</button>
          </footer>
        </aside>
      </section>
    </section>
  );
}

const noteTemplates = [
  {
    key: 'routine',
    title: 'Sinh hiệu bình thường',
    content: 'Bệnh nhân tỉnh, tiếp xúc tốt. Sinh hiệu trong giới hạn. Không ghi nhận dấu hiệu bất thường tại thời điểm đo. Tiếp tục theo dõi theo quy trình.',
  },
  {
    key: 'abnormal',
    title: 'Theo dõi sinh hiệu bất thường',
    content: 'Ghi nhận [chỉ số] bất thường lúc [giờ]. Giá trị: [value]. Đã kiểm tra lại thiết bị/tư thế. Đã báo bác sĩ [tên] lúc [giờ]. Kế hoạch: đo lại sau [x] phút.',
  },
  {
    key: 'medication',
    title: 'Sau dùng thuốc',
    content: 'Sau dùng thuốc [tên thuốc] lúc [giờ]. Sinh hiệu sau dùng thuốc: ... Phản ứng bất lợi: không ghi nhận. Hướng xử trí: tiếp tục theo dõi.',
  },
  {
    key: 'procedure',
    title: 'Sau thủ thuật',
    content: 'Sau thủ thuật [tên thủ thuật]. Tình trạng: tỉnh, tiếp xúc tốt. Sinh hiệu: ... Theo dõi tiếp theo quy trình.',
  },
];

export function NursingNotesPage() {
  const [filters, setFilters] = useState(baseFilters());
  const [refresh, setRefresh] = useState(0);
  const { data: worklistData } = useWaitingVitals(filters, refresh);
  const selected = listOf(worklistData.items).find((item) => encounterObjectId(item)) || demoItems[1];
  const targetEncounterId = encounterObjectId(selected);
  const fallback = { meta: metaFrom(filters), items: demoNotes };
  const { data, loading, isDemo, error } = useVitalsData(() => (targetEncounterId ? nurseVitalsApi.getNursingNotes(targetEncounterId) : Promise.reject(new Error('Chưa chọn lượt khám'))), fallback, [targetEncounterId, refresh]);
  const [activeNote, setActiveNote] = useState(demoNotes[0]);
  const [form, setForm] = useState({ title: noteTemplates[0].title, note_type: 'nursing_vital_routine', priority: 'normal', content: noteTemplates[0].content });
  const [notice, setNotice] = useState('');
  const notes = listOf(data.items).filter((note) => !filters.search || `${note.title} ${note.content}`.toLowerCase().includes(filters.search.toLowerCase()));

  function applyTemplate(template) {
    setForm((current) => ({ ...current, title: template.title, content: template.content, note_type: template.key === 'abnormal' ? 'nursing_abnormal_vital' : `nursing_${template.key}` }));
  }

  async function saveNote(status = 'draft') {
    if (!targetEncounterId) {
      setNotice('Chưa có lượt khám hợp lệ từ hệ thống để lưu ghi chú.');
      return;
    }
    try {
      await nurseVitalsApi.createNursingNote(targetEncounterId, {
        ...form,
        status,
        linked_vital_sign_ids: [demoVitals[0]._id].filter(Boolean),
        tags: ['vital_sign', form.priority],
      });
      setNotice('Đã lưu ghi chú điều dưỡng.');
      setRefresh((value) => value + 1);
    } catch (saveError) {
      setNotice(saveError?.message || 'Không thể lưu ghi chú.');
    }
  }

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Ghi chú điều dưỡng, mẫu nhanh và sinh hiệu liên kết" title="Ghi chú điều dưỡng" description="Không gian ghi chú điều dưỡng có mẫu nhanh, liên kết sinh hiệu/cảnh báo, trạng thái ký và luồng báo bác sĩ." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={loading} actions={<><button type="button" onClick={() => saveNote('draft')}><FileText size={16} />Lưu nháp</button><button type="button" onClick={() => saveNote('signed')}><CheckCircle2 size={16} />Hoàn tất/ký</button><button type="button"><Send size={16} />Báo bác sĩ</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <VitalsFilters filters={filters} setFilters={setFilters} />
      <KpiStrip items={[
        { label: 'Hôm nay', value: notes.length, detail: 'Ghi chú trong bộ lọc', icon: FileText, tone: 'blue' },
        { label: 'Nháp', value: notes.filter((note) => note.status === 'draft').length, detail: 'Cần hoàn tất', icon: Clock3, tone: 'amber' },
        { label: 'Cần ký', value: notes.filter((note) => ['draft', 'in_progress'].includes(note.status)).length, detail: 'Chưa ký', icon: ClipboardCheck, tone: 'violet' },
        { label: 'Bất thường', value: notes.filter((note) => note.note_type?.includes('abnormal')).length, detail: 'Liên quan cảnh báo', icon: AlertTriangle, tone: 'red' },
        { label: 'Đã báo BS', value: notes.filter((note) => note.notified_doctor_id).length, detail: 'Có thông báo bác sĩ', icon: Send, tone: 'cyan' },
        { label: 'Sinh hiệu liên kết', value: notes.filter((note) => note.linked_vital_sign_ids?.length).length, detail: 'Có liên kết sinh hiệu', icon: HeartPulse, tone: 'green' },
      ]} />
      <section className="nurse-vitals-notes-layout">
        <aside className="nurse-vitals-note-timeline">
          {notes.map((note) => <button key={note._id} type="button" className={activeNote?._id === note._id ? 'is-active' : ''} onClick={() => setActiveNote(note)}><span>{formatTime(note.created_at)}</span><strong>{note.title || note.note_type}</strong><small>{statusLabels[note.status] || note.status} · {note.priority || 'normal'}</small></button>)}
        </aside>
        <main className="nurse-vitals-note-editor">
          <header><h2>{form.title}</h2><StatusBadge value={form.priority === 'urgent' ? 'doctor_notified' : 'draft'} /></header>
          <section className="nurse-vitals-template-grid">
            {noteTemplates.map((template) => <button key={template.key} type="button" onClick={() => applyTemplate(template)}><strong>{template.title}</strong><span>{template.content.slice(0, 72)}...</span></button>)}
          </section>
          <div className="nurse-vitals-note-fields">
            <label><span>Tiêu đề</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label><span>Loại ghi chú</span><select value={form.note_type} onChange={(event) => setForm((current) => ({ ...current, note_type: event.target.value }))}><option value="nursing_vital_routine">Sinh hiệu thường quy</option><option value="nursing_abnormal_vital">Sinh hiệu bất thường</option><option value="nursing_post_medication">Sau dùng thuốc</option><option value="nursing_post_procedure">Sau thủ thuật</option><option value="nursing_handover">Bàn giao ca</option></select></label>
            <label><span>Ưu tiên</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="normal">Bình thường</option><option value="important">Quan trọng</option><option value="urgent">Khẩn</option></select></label>
          </div>
          <label className="nurse-vitals-note-content"><span>Nội dung</span><textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} rows={12} /></label>
          <footer><button type="button" onClick={() => setForm((current) => ({ ...current, content: `${current.content}\nSinh hiệu mới nhất: ${vitalText(demoVitals[0])}.` }))}>Chèn sinh hiệu mới nhất</button><button type="button">Chèn dấu hiệu bất thường</button><button type="button" onClick={() => saveNote('draft')}>Lưu nháp</button><button type="button" onClick={() => saveNote('signed')}>Ký ghi chú</button></footer>
        </main>
        <PatientClinicalSidebar item={selected} latestVital={demoVitals[0]} />
      </section>
    </section>
  );
}
