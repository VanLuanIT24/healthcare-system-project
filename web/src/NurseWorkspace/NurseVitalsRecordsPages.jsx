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
  Eye,
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
import { nurseMonitoringApi, nurseOperationsApi, nurseTaskHandoverApi, nurseVitalsApi } from './nurseApi';
import {
  confirmNurseAction,
  downloadNurseJson,
  notifyNurse,
  printNurseView,
  promptNurseText,
  runNurseAction,
} from './nurseActions';

const severityLabels = {
  normal: 'Bình thường',
  mild: 'Nhẹ',
  warning: 'Cảnh báo',
  high: 'Cao',
  critical: 'Nguy kịch',
};

const statusLabels = {
  draft: 'Nháp',
  waiting: 'Đang chờ',
  pending: 'Đang chờ',
  todo: 'Chưa nhận',
  in_progress: 'Đang xử lý',
  completed: 'Hoàn tất',
  done: 'Hoàn tất',
  recorded: 'Đã ghi nhận',
  signed: 'Đã ký',
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
  oxygen_device: 'Thiết bị oxy',
  oxygen_flow_rate: 'Lưu lượng oxy',
  consciousness_level: 'Tri giác',
  gcs_eye: 'GCS mắt',
  gcs_verbal: 'GCS lời nói',
  gcs_motor: 'GCS vận động',
  gcs_total: 'Tổng GCS',
  measurement_position: 'Tư thế đo',
  temperature_site: 'Vị trí đo nhiệt',
  bp_site: 'Vị trí đo HA',
  source: 'Nguồn dữ liệu',
  device_id: 'Mã thiết bị',
  recorded_at: 'Thời điểm đo',
  note: 'Ghi chú',
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
  oxygen_flow_rate: 'L/phút',
  gcs_eye: '',
  gcs_verbal: '',
  gcs_motor: '',
  gcs_total: '',
};

const correctionFieldOptions = [
  'temperature',
  'heart_rate',
  'respiratory_rate',
  'systolic_bp',
  'diastolic_bp',
  'spo2',
  'pain_score',
  'blood_glucose',
  'oxygen_device',
  'oxygen_flow_rate',
  'consciousness_level',
  'gcs_eye',
  'gcs_verbal',
  'gcs_motor',
  'gcs_total',
  'measurement_position',
  'temperature_site',
  'bp_site',
  'source',
  'device_id',
  'recorded_at',
  'note',
  'weight',
  'height',
  'bmi',
];

const numericCorrectionFields = new Set([
  'temperature',
  'heart_rate',
  'respiratory_rate',
  'systolic_bp',
  'diastolic_bp',
  'spo2',
  'weight',
  'height',
  'bmi',
  'pain_score',
  'blood_glucose',
  'map',
  'oxygen_flow_rate',
  'gcs_eye',
  'gcs_verbal',
  'gcs_motor',
  'gcs_total',
]);

const correctionReasonOptions = [
  { value: 'wrong_value', label: 'Sai giá trị' },
  { value: 'wrong_time', label: 'Sai thời điểm' },
  { value: 'device_error', label: 'Lỗi thiết bị' },
  { value: 'wrong_patient', label: 'Sai bệnh nhân' },
  { value: 'duplicate', label: 'Trùng bản ghi' },
  { value: 'other', label: 'Khác' },
];

const correctionActionIcons = {
  approve: CheckCircle2,
  reject: AlertTriangle,
  apply: ClipboardCheck,
  cancel: FileText,
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

function safeItem(item) {
  return item && typeof item === 'object' ? item : {};
}

function unwrapVital(item = {}) {
  const value = safeItem(item);
  const vital = value.vital_sign || value.latest_vital_sign || value.latest_vital || value;
  return vital?.values ? { ...vital, ...vital.values } : vital;
}

function subjectId(item = {}) {
  const value = safeItem(item);
  return textValue(value.queue_ticket_id || value.task?.queue_ticket_id || value.source_id || value.id || value.patient_id || value.patient?.patient_id, '');
}

function patientName(item = {}) {
  const value = safeItem(item);
  return textValue(value.patient_name || value.patient?.patient_name || value.patient?.full_name || value.patient_id?.full_name || value.vital_sign?.patient_id?.full_name, 'Chưa rõ bệnh nhân');
}

function patientCode(item = {}) {
  const value = safeItem(item);
  return textValue(value.patient_code || value.patient?.patient_code || value.patient_id?.patient_code || value.vital_sign?.patient_id?.patient_code, '--');
}

function patientAgeGender(item = {}) {
  const value = safeItem(item);
  const age = value.age || value.patient?.age || value.patient_id?.age;
  const gender = value.gender || value.patient?.gender || value.patient_id?.gender;
  const genderLabel = gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : gender || '--';
  return `${age || '--'} tuổi · ${genderLabel}`;
}

function encounterId(item = {}) {
  const value = safeItem(item);
  return textValue(value.encounter_id || value.encounter?.encounter_id || value.encounter?._id || value.vital_sign?.encounter_id, '');
}

function encounterObjectId(item = {}) {
  const value = safeItem(item);
  return backendId(value.encounter_id || value.encounter || value.vital_sign?.encounter_id);
}

function patientObjectId(item = {}) {
  const value = safeItem(item);
  return backendId(value.patient_id || value.patient || value.vital_sign?.patient_id);
}

function queueTicketObjectId(item = {}) {
  const value = safeItem(item);
  return backendId(value.queue_ticket_id || value.queue_ticket || value.task?.queue_ticket_id);
}

function vitalObjectId(item = {}) {
  const value = safeItem(item);
  return backendId(value.vital_sign_id || value.vital_sign || value.latest_vital_sign || value.latest_vital || value);
}

function correctionRequestId(item = {}) {
  const value = safeItem(item);
  return backendId(value._id || value.id || value.correction_request_id || value.request_id);
}

function correctionStatus(item = {}) {
  return textValue(safeItem(item).status, 'pending');
}

function correctionWorkflow(item = {}) {
  const id = correctionRequestId(item);
  const status = correctionStatus(item);
  return {
    id,
    status,
    canApprove: Boolean(id && status === 'pending'),
    canReject: Boolean(id && status === 'pending'),
    canApply: Boolean(id && ['pending', 'approved'].includes(status)),
    canCancel: Boolean(id && ['pending', 'approved'].includes(status)),
  };
}

function correctionFieldSummary(item = {}) {
  const proposed = safeItem(item).proposed_values || {};
  return Object.keys(proposed)
    .map((field) => {
      const unit = vitalUnits[field] ? ` ${vitalUnits[field]}` : '';
      return `${fieldLabels[field] || field}: ${textValue(safeItem(item).current_values?.[field])} → ${textValue(proposed[field])}${unit}`;
    })
    .join(', ');
}

function normalizeCorrectionValue(field, value) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) throw new Error('Cần nhập giá trị mới.');
  if (field === 'recorded_at') {
    const parsedDate = new Date(rawValue);
    if (Number.isNaN(parsedDate.getTime())) throw new Error('Thời điểm đo không hợp lệ.');
    return parsedDate.toISOString();
  }
  if (!numericCorrectionFields.has(field)) return rawValue;
  const numericValue = Number(rawValue);
  if (Number.isNaN(numericValue)) throw new Error(`${fieldLabels[field] || field} phải là số.`);
  return numericValue;
}

function clinicalNoteId(item = {}) {
  const value = safeItem(item);
  return backendId(value.clinical_note_id || value.note_id || value._id || value.id);
}

function clinicalNoteIdFromResult(result = {}) {
  return clinicalNoteId(result?.clinical_note || result?.note || result);
}

function urlParam(name) {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) || '';
}

function goNursePath(path, title = 'Điều hướng') {
  notifyNurse({ tone: 'info', title, message: 'Đang mở màn hình phù hợp để tiếp tục thao tác.' });
  window.setTimeout(() => {
    window.location.assign(path);
  }, 80);
}

function withContextPath(path, item = {}) {
  const params = new URLSearchParams();
  const queueId = queueTicketObjectId(item);
  const encounter = encounterObjectId(item);
  const patient = patientObjectId(item);
  const vital = vitalObjectId(item);
  if (queueId) params.set('queue_ticket_id', queueId);
  if (encounter) params.set('encounter_id', encounter);
  if (patient) params.set('patient_id', patient);
  if (vital) params.set('vital_sign_id', vital);
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function queueNumber(item = {}) {
  const value = safeItem(item);
  return textValue(value.queue_number || value.queue_ticket?.queue_number || value.queue_ticket?.display_number || value.metadata?.queue_number || value.task?.queue_number, '--');
}

function departmentName(item = {}) {
  const value = safeItem(item);
  return textValue(value.department_name || value.department?.department_name || value.encounter?.department_id || value.queue_ticket?.department_id, 'Khoa được phân quyền');
}

function doctorName(item = {}) {
  const value = safeItem(item);
  return textValue(value.doctor_name || value.doctor || value.encounter?.attending_doctor_id || value.queue_ticket?.doctor_id, '--');
}

function vitalText(vital = {}) {
  const value = safeItem(vital);
  if (!Object.keys(value).length) return 'Chưa có sinh hiệu';
  const source = value.values ? { ...value, ...value.values } : value;
  const bp = source.systolic_bp && source.diastolic_bp ? `HA ${source.systolic_bp}/${source.diastolic_bp}` : null;
  return [
    source.temperature ? `T ${source.temperature}°C` : null,
    source.heart_rate ? `M ${source.heart_rate}` : null,
    source.respiratory_rate ? `NT ${source.respiratory_rate}` : null,
    bp,
    source.spo2 ? `SpO2 ${source.spo2}%` : null,
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

function emptyWaitingVitals(filters) {
  return {
    meta: metaFrom(filters),
    summary: { total_waiting: 0, pending: 0, no_vitals: 0, overdue: 0, high_priority: 0, recheck_due: 0, abnormal_latest: 0 },
    items: [],
  };
}

function emptyVitalHistory(filters) {
  return {
    meta: metaFrom(filters),
    patient: null,
    summary: { total_records: 0, abnormal_records: 0, critical_records: 0, amended_records: 0, entered_in_error_records: 0 },
    items: [],
  };
}

function emptyAbnormalVitals(filters) {
  return {
    meta: metaFrom(filters),
    summary: { abnormal: 0, critical: 0, high: 0, warning: 0, unacknowledged: 0, doctor_notified: 0 },
    items: [],
  };
}

function emptyCorrections(filters) {
  return {
    meta: metaFrom(filters),
    summary: { total: 0, pending: 0, approved: 0, applied: 0, rejected: 0, cancelled: 0 },
    items: [],
  };
}

function emptyNursingNotes(filters) {
  return {
    meta: metaFrom(filters),
    summary: { total: 0, draft: 0, unsigned: 0, abnormal: 0, doctor_notified: 0, linked_vitals: 0 },
    items: [],
  };
}

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
          {isDemo ? 'API chưa sẵn sàng' : 'Thời gian thực bật'}
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
      API chưa phản hồi nên chưa thể đồng bộ dữ liệu database. {error}
    </div>
  );
}

function VitalsFilters({ filters, setFilters, children, statusOptions }) {
  const availableStatusOptions = statusOptions || [
    { value: 'waiting', label: 'Đang chờ' },
    { value: 'recorded', label: 'Đã ghi nhận' },
    { value: 'amended', label: 'Đã sửa' },
    { value: 'entered_in_error', label: 'Nhập sai' },
  ];
  return (
    <section className="nurse-vitals-filters">
      <label><span>Ngày</span><input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} /></label>
      <label><span>Ca trực</span><select value={filters.shift} onChange={(event) => setFilters((current) => ({ ...current, shift: event.target.value }))}><option value="morning">Ca sáng</option><option value="afternoon">Ca chiều</option><option value="night">Ca đêm</option><option value="all">Tất cả</option></select></label>
      <label><span>Mức độ</span><select value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}><option value="all">Tất cả</option><option value="critical">Nguy kịch</option><option value="high">Cao</option><option value="warning">Cảnh báo</option><option value="normal">Bình thường</option></select></label>
      <label><span>Trạng thái</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Tất cả</option>{availableStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
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
          <button key={item.label} type="button" className={`nurse-vitals-kpi nurse-vitals-kpi--${item.tone || 'teal'}`} onClick={item.onClick || (() => notifyNurse({ title: item.label, message: item.detail || 'Đã chọn chỉ số để rà soát.' }))}>
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

function PatientClinicalSidebar({ item, latestVital, actions, onAction }) {
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
          {(actions || ['Nhập sinh hiệu', 'Ghi chú', 'Báo bác sĩ', 'Dòng thời gian', 'Tạo việc đo lại']).map((label) => (
            <button key={label} type="button" onClick={() => (onAction ? onAction(label, item) : notifyNurse({ title: label, message: 'Chọn bệnh nhân hoặc mở màn hình chi tiết để tiếp tục.' }))}>
              {label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

function PatientQueueCard({ item, selected, onSelect, onAction, mode = 'waiting' }) {
  const row = safeItem(item);
  const vital = row.latest_vital_sign || row.latest_vital || row.vital_sign;
  return (
    <article className={`nurse-vitals-patient-card nurse-vitals-patient-card--${row.priority || vital?.severity || 'normal'}${selected ? ' is-selected' : ''}`}>
      <button type="button" onClick={() => onSelect(item)}>
        <header>
          <div>
            <strong>{queueNumber(item)} · {patientName(item)}</strong>
            <span>{patientCode(item)} · {patientAgeGender(item)}</span>
          </div>
          <SeverityBadge value={vital?.severity || vital?.overall_severity || row.latest_vital_severity || (row.priority === 'critical' ? 'critical' : 'normal')} />
        </header>
        <p>{textValue(row.reason || row.priority_reason, mode === 'waiting' ? 'Chờ đo sinh hiệu trước khám' : 'Cần xử lý sinh hiệu')}</p>
        <VitalMiniStrip vital={vital} />
        <footer>
          <SlaBadge state={row.sla?.state} minutes={row.waiting_minutes || row.sla?.waiting_minutes} />
          <span>{doctorName(item)}</span>
          <span>{departmentName(item)}</span>
        </footer>
      </button>
      <div className="nurse-vitals-card-actions">
        <button type="button" onClick={() => onAction?.('call', item)}>Gọi đo</button>
        <button type="button" onClick={() => onAction?.('entry', item)}>Nhập nhanh</button>
        <button type="button" onClick={() => onAction?.('note', item)}>Ghi chú</button>
        <button type="button" onClick={() => onAction?.('notify_doctor', item)}>Báo BS</button>
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

function vitalAlertState(item = {}) {
  const vital = unwrapVital(item);
  const acknowledged = Boolean(vital.acknowledged_at || item.acknowledged_at);
  const recheckRequested = Boolean(vital.related_task_id || item.related_task_id || vital.requires_recheck || item.requires_recheck);
  const doctorNotified = Boolean(vital.doctor_notified_at || item.doctor_notified_at);
  const escalated = Boolean(vital.escalated_at || item.escalated_at || vital.emergency_notified_at || item.emergency_notified_at);
  return { acknowledged, recheckRequested, doctorNotified, escalated };
}

function resultTaskId(result = {}) {
  return rawId(result.related_task_id || result.task_id || result.task?.task_id || result.task?._id || result.nursing_task?.task_id || result.nursing_task?._id || result.data?.task?.task_id || result.data?.task?._id);
}

function VitalTimelineTable({ items = [], onSelect, onAction }) {
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
                <td>
                  <div className="nurse-row-actions">
                    <button type="button" onClick={() => onSelect?.(entry)}>Chi tiết</button>
                    <button type="button" onClick={() => onAction?.('request_correction', entry)}>Sửa</button>
                  </div>
                </td>
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
    if (!item || typeof item !== 'object') return false;
    const value = safeItem(item);
    const vital = unwrapVital(item);
    const severity = vital?.severity || vital?.overall_severity || value.latest_vital_severity || value.priority || 'normal';
    if (filters.severity !== 'all' && severity !== filters.severity) return false;
    if (filters.status !== 'all' && value.status !== filters.status && vital?.status !== filters.status) return false;
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
  const fallback = emptyWaitingVitals(filters);
  return useVitalsData(
    () => nurseVitalsApi.getWaitingVitals({ date: filters.date, shift: filters.shift, status: filters.status === 'all' ? undefined : filters.status }),
    fallback,
    [filters.date, filters.shift, filters.status, refresh],
  );
}

export function WaitingVitalsPage() {
  const [filters, setFilters] = useState(baseFilters());
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(null);
  const { data, loading, isDemo, error } = useWaitingVitals(filters, refresh);
  const items = filterItems(listOf(data.items), filters);
  const summary = data.summary || {};
  const active = selected || items[0] || null;

  useEffect(() => {
    if (!selected && items[0]) setSelected(items[0]);
  }, [items, selected]);

  async function handleWaitingAction(action, item = active) {
    if (!item) return;
    if (action === 'entry') {
      goNursePath(withContextPath('/nurse/vitals-records/entry', item), 'Nhập sinh hiệu');
      return;
    }
    if (action === 'note') {
      goNursePath(withContextPath('/nurse/vitals-records/nursing-notes', item), 'Ghi chú điều dưỡng');
      return;
    }
    const ticketId = queueTicketObjectId(item);
    const vitalId = vitalObjectId(item);
    if (action === 'call') {
      await runNurseAction({
        label: 'Gọi đo sinh hiệu',
        isDemo: isDemo || !ticketId,
        demoMessage: 'Bệnh nhân mẫu hoặc chưa có queue_ticket_id nên chưa thể gọi số.',
        confirm: { title: 'Gọi bệnh nhân đo sinh hiệu', message: `${patientName(item)} - ${queueNumber(item)} sẽ được gọi vào khu đo.` },
        run: () => nurseOperationsApi.callQueue(ticketId, { reason: 'vital_sign_measurement' }),
        successMessage: 'Đã gọi bệnh nhân vào khu đo sinh hiệu.',
        onSuccess: () => setRefresh((value) => value + 1),
      });
      return;
    }
    if (action === 'notify_doctor') {
      await runNurseAction({
        label: 'Báo bác sĩ',
        isDemo: isDemo || (!vitalId && !ticketId),
        demoMessage: 'Chưa có sinh hiệu hoặc queue hợp lệ để gửi báo bác sĩ.',
        confirm: { title: 'Báo bác sĩ', message: `Gửi cảnh báo lâm sàng cho ${patientName(item)}?` },
        run: () => (vitalId
          ? nurseVitalsApi.notifyDoctorOfVital(vitalId)
          : nurseOperationsApi.notifyDoctor(ticketId, { message: 'Bệnh nhân chờ đo sinh hiệu cần bác sĩ xem lại.' })),
        successMessage: 'Đã gửi thông báo bác sĩ.',
        onSuccess: () => setRefresh((value) => value + 1),
      });
    }
  }

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Danh sách chờ, SLA và nguy cơ lâm sàng" title="Chờ đo sinh hiệu" description="Điều phối bệnh nhân cần đo sinh hiệu, phát hiện quá SLA, ưu tiên nguy cơ cao và mở thao tác nhanh trong một màn hình." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={loading} actions={<><button type="button" onClick={() => handleWaitingAction('call')}><Bell size={16} />Gọi bệnh nhân</button><button type="button" onClick={() => handleWaitingAction('entry')}><HeartPulse size={16} />Nhập nhanh</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {loading ? <div className="nurse-operation-loading"><Loader2 className="is-spinning" size={18} />Đang tải danh sách sinh hiệu...</div> : null}
      <VitalsFilters filters={filters} setFilters={setFilters} />
      <KpiStrip items={[
        { label: 'Chờ đo', value: summary.total_waiting ?? summary.pending ?? items.length, detail: 'Bệnh nhân trong danh sách', icon: Clock3, tone: 'blue', onClick: () => setFilters((current) => ({ ...current, severity: 'all' })) },
        { label: 'Chưa từng đo', value: summary.no_vitals ?? items.filter((item) => !item.latest_vital_sign).length, detail: 'Cần nhập bộ đầu tiên', icon: HeartPulse, tone: 'cyan', onClick: () => notifyNurse({ title: 'Lọc nhanh', message: 'Các thẻ chưa từng đo đang được ưu tiên ở danh sách chính.' }) },
        { label: 'Quá SLA', value: summary.overdue ?? items.filter((item) => item.sla?.state === 'breached').length, detail: 'Cần xử lý ngay', icon: AlertTriangle, tone: 'red', onClick: () => notifyNurse({ tone: 'warning', title: 'Quá SLA', message: 'Ưu tiên gọi bệnh nhân đang quá SLA trong danh sách.' }) },
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
          ].map(([label, value, Icon]) => <button key={label} type="button" onClick={() => notifyNurse({ title: label, message: 'Đã chọn nhóm để điều dưỡng rà soát trong danh sách.' })}><Icon size={16} /><span>{label}</span><strong>{value}</strong></button>)}
        </aside>
        <main className="nurse-vitals-worklist">
          {items.map((item, index) => <PatientQueueCard key={subjectId(item) || index} item={item} selected={subjectId(item) === subjectId(selected)} onSelect={setSelected} onAction={handleWaitingAction} />)}
        </main>
        <PatientClinicalSidebar item={active || {}} onAction={(label, item) => handleWaitingAction(label === 'Báo bác sĩ' ? 'notify_doctor' : label === 'Ghi chú' ? 'note' : 'entry', item)} />
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
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyVitalForm);
  const [preview, setPreview] = useState(calculateLocalAssessment(emptyVitalForm));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const requestedQueueId = backendId(urlParam('queue_ticket_id'));
  const requestedEncounterId = backendId(urlParam('encounter_id'));
  const requestedPatientId = backendId(urlParam('patient_id'));

  useEffect(() => {
    if (selected && (encounterObjectId(selected) || queueTicketObjectId(selected))) return;
    const requested = waitingItems.find((item) => (
      (requestedQueueId && queueTicketObjectId(item) === requestedQueueId)
      || (requestedEncounterId && encounterObjectId(item) === requestedEncounterId)
      || (requestedPatientId && patientObjectId(item) === requestedPatientId)
    ));
    if (requested || waitingItems[0]) setSelected(requested || waitingItems[0]);
  }, [requestedEncounterId, requestedPatientId, requestedQueueId, selected, waitingItems]);

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
    if ((extra.notify_doctor || extra.mark_ready_for_doctor || extra.request_recheck) && !confirmNurseAction({
      title: 'Xác nhận lưu sinh hiệu',
      message: extra.notify_doctor
        ? 'Lưu bản ghi và gửi báo bác sĩ cho chỉ số này?'
        : extra.mark_ready_for_doctor
          ? 'Lưu bản ghi và đánh dấu bệnh nhân sẵn sàng gặp bác sĩ?'
          : 'Lưu bản ghi và tạo nhắc đo lại?',
    })) return;
    setSaving(true);
    setNotice('');
    try {
      const context = encounterObjectId(selected);
      const queue = queueTicketObjectId(selected);
      const patient = patientObjectId(selected);
      if (!context && !queue) throw new Error('Chưa có lượt khám hoặc số hàng đợi hợp lệ từ hệ thống để lưu sinh hiệu.');
      const saved = await nurseVitalsApi.recordVitalSigns({
        ...form,
        encounter_id: context || undefined,
        queue_ticket_id: queue || undefined,
        context: context ? 'encounter' : 'pre_triage',
      });
      const savedVitalId = vitalObjectId(saved?.vital_sign || saved);
      if (extra.mark_ready_for_doctor) {
        if (queue) await nurseOperationsApi.markReadyForDoctor(queue);
        else if (context) await nurseOperationsApi.markEncounterReadyForDoctor(context);
      }
      if (extra.notify_doctor && savedVitalId) {
        await nurseVitalsApi.notifyDoctorOfVital(savedVitalId);
      }
      if (extra.request_recheck && patient) {
        await nurseTaskHandoverApi.createTask({
          patient_id: patient,
          encounter_id: context || undefined,
          queue_ticket_id: queue || undefined,
          department_id: selected?.department_id || undefined,
          source_type: 'vital_sign',
          source_id: savedVitalId || undefined,
          task_type: 'vital_sign',
          title: `Đo lại sinh hiệu - ${patientName(selected)}`,
          description: vitalText(saved?.vital_sign || form),
          priority: preview.severity === 'critical' ? 'stat' : 'urgent',
          sla_minutes: preview.suggested_recheck_minutes || 15,
        });
      }
      setNotice('Đã lưu sinh hiệu và cập nhật trạng thái điều dưỡng.');
      notifyNurse({ tone: 'success', title: 'Lưu sinh hiệu', message: 'Đã lưu bản ghi và đồng bộ với backend.' });
      setRefresh((value) => value + 1);
      if (extra.create_note) {
        goNursePath(withContextPath('/nurse/vitals-records/nursing-notes', { ...selected, vital_sign_id: savedVitalId }), 'Ghi chú điều dưỡng');
      }
    } catch (saveError) {
      setNotice(saveError?.message || 'Không thể lưu sinh hiệu.');
      notifyNurse({ tone: 'danger', title: 'Lưu sinh hiệu', message: saveError?.message || 'Không thể lưu sinh hiệu.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Màn nhập sinh hiệu" title="Nhập sinh hiệu" description="Nhập nhanh, kiểm tra thời gian thực, so sánh lần trước, đánh giá bất thường và nối chuỗi thao tác ghi chú, báo bác sĩ, tạo đo lại." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={saving} actions={<><button type="button" onClick={() => saveVitals()} disabled={saving}><CheckCircle2 size={16} />Lưu</button><button type="button" onClick={() => saveVitals({ create_note: true })}><FileText size={16} />Lưu & ghi chú</button><button type="button" onClick={() => { if (confirmNurseAction({ title: 'Đặt lại biểu mẫu', message: 'Xóa các giá trị đang nhập và quay về mặc định?' })) setForm(emptyVitalForm); }}><RefreshCw size={16} />Đặt lại</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <section className="nurse-vitals-entry-layout">
        <aside className="nurse-vitals-selector">
          <VitalsFilters filters={filters} setFilters={setFilters} />
          <div className="nurse-vitals-selector-list">
            {waitingItems.slice(0, 10).map((item, index) => <PatientQueueCard key={subjectId(item) || index} item={item} selected={subjectId(item) === subjectId(selected)} onSelect={setSelected} onAction={(action, row) => {
              if (action === 'entry') setSelected(row);
              if (action === 'note') goNursePath(withContextPath('/nurse/vitals-records/nursing-notes', row), 'Ghi chú điều dưỡng');
              if (action === 'call') notifyNurse({ title: 'Đã chọn bệnh nhân', message: 'Bệnh nhân đã được đưa vào biểu mẫu nhập sinh hiệu.' });
              if (action === 'notify_doctor') saveVitals({ notify_doctor: true });
            }} />)}
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
          <PatientClinicalSidebar item={selected || {}} latestVital={selected?.latest_vital_sign} actions={['Lịch sử', 'Ghi chú', 'Báo bác sĩ', 'Tạo đo lại']} onAction={(label) => {
            if (label === 'Lịch sử') goNursePath(withContextPath('/nurse/vitals-records/history', selected), 'Lịch sử sinh hiệu');
            if (label === 'Ghi chú') goNursePath(withContextPath('/nurse/vitals-records/nursing-notes', selected), 'Ghi chú điều dưỡng');
            if (label === 'Báo bác sĩ') saveVitals({ notify_doctor: true });
            if (label === 'Tạo đo lại') saveVitals({ request_recheck: true });
          }} />
        </aside>
      </section>
    </section>
  );
}

function normalizeHistoryItems(payload) {
  const rawItems = listOf(payload?.items);
  if (!rawItems.length) return [];
  return rawItems
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => (entry.vital_sign ? entry : { vital_sign: entry }));
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
  const requestedPatientId = backendId(urlParam('patient_id'));
  const requestedEncounterId = backendId(urlParam('encounter_id'));
  const requestedQueueId = backendId(urlParam('queue_ticket_id'));
  const selected = listOf(worklistData.items).find((item) => (
    (requestedPatientId && patientObjectId(item) === requestedPatientId)
    || (requestedEncounterId && encounterObjectId(item) === requestedEncounterId)
    || (requestedQueueId && queueTicketObjectId(item) === requestedQueueId)
    || patientObjectId(item)
  )) || null;
  const targetPatientId = patientObjectId(selected);
  const fallback = emptyVitalHistory(filters);
  const { data, loading, isDemo, error } = useVitalsData(
    () => nurseVitalsApi.getVitalHistory({
      date: filters.date,
      shift: filters.shift,
      severity: filters.severity === 'all' ? undefined : filters.severity,
      status: filters.status === 'all' ? undefined : filters.status,
      patient_id: requestedPatientId || targetPatientId || undefined,
      encounter_id: requestedEncounterId || undefined,
      queue_ticket_id: requestedQueueId || undefined,
    }),
    fallback,
    [filters.date, filters.shift, filters.severity, filters.status, refresh, requestedEncounterId, requestedPatientId, requestedQueueId, targetPatientId],
  );
  const items = normalizeHistoryItems(data);
  const latest = unwrapVital(items[0] || {});
  const patientContext = data.patient || selected || items[0] || {};

  async function handleHistoryAction(action, entry) {
    const vital = unwrapVital(entry);
    const vitalId = vitalObjectId(vital);
    if (action !== 'request_correction') return;
    if (!vitalId) {
      notifyNurse({ tone: 'warning', title: 'Yêu cầu sửa', message: 'Bản ghi này chưa có vital_sign_id hợp lệ.' });
      return;
    }
    const input = promptNurseText({
      title: 'Yêu cầu sửa sinh hiệu',
      message: 'Nhập trường và giá trị mới theo dạng: temperature=37.2',
      defaultValue: 'temperature=',
    });
    if (!input) return;
    const [field, rawValue] = input.split('=').map((part) => part.trim());
    if (!field || rawValue === undefined || rawValue === '') {
      notifyNurse({ tone: 'warning', title: 'Yêu cầu sửa', message: 'Cần nhập đúng dạng field=value.' });
      return;
    }
    await runNurseAction({
      label: 'Yêu cầu sửa sinh hiệu',
      confirm: { title: 'Gửi yêu cầu sửa?', message: `${fieldLabels[field] || field}: ${rawValue}` },
      run: () => nurseVitalsApi.requestCorrection(vitalId, {
        reason: `Điều dưỡng yêu cầu sửa ${fieldLabels[field] || field}.`,
        reason_category: 'wrong_value',
        proposed_values: { [field]: Number.isNaN(Number(rawValue)) ? rawValue : Number(rawValue) },
      }),
      successMessage: 'Đã tạo yêu cầu sửa sinh hiệu.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
  }

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Dòng thời gian, xu hướng, so sánh và kiểm tra" title="Lịch sử sinh hiệu" description="Xem lịch sử sinh hiệu theo bệnh nhân/lượt khám, phân tích xu hướng, so sánh lần trước và mở kiểm tra/sửa khi cần." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={loading} actions={<><button type="button" onClick={() => downloadNurseJson('lich-su-sinh-hieu.json', { patient: patientContext, items })}><Download size={16} />Xuất</button><button type="button" onClick={() => printNurseView('In bảng sinh hiệu')}><Table2 size={16} />In bảng</button><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} />Làm mới</button></>} />
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
          <VitalTimelineTable items={items} onAction={handleHistoryAction} />
        </main>
        <PatientClinicalSidebar item={patientContext} latestVital={latest} onAction={(label) => {
          if (label === 'Báo bác sĩ') goNursePath(withContextPath('/nurse/vitals-records/abnormal', patientContext), 'Báo bác sĩ');
          else if (label === 'Ghi chú') goNursePath(withContextPath('/nurse/vitals-records/nursing-notes', patientContext), 'Ghi chú điều dưỡng');
          else notifyNurse({ title: label, message: 'Đang xem lịch sử sinh hiệu của bệnh nhân.' });
        }} />
      </section>
    </section>
  );
}

export function AbnormalVitalsPage() {
  const [filters, setFilters] = useState(baseFilters());
  const [refresh, setRefresh] = useState(0);
  const fallback = emptyAbnormalVitals(filters);
  const { data, loading, isDemo, error } = useVitalsData(() => nurseVitalsApi.getAbnormalVitals({ date: filters.date, shift: filters.shift }), fallback, [filters.date, filters.shift, refresh]);
  const items = filterItems(listOf(data.items), filters);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const active = selected || items[0] || {};
  const activeVital = unwrapVital(active);
  const activeVitalId = vitalObjectId(active);
  const activeState = vitalAlertState(active);
  const hasActiveVital = Boolean(activeVitalId);

  useEffect(() => {
    const requestedVitalId = backendId(urlParam('vital_sign_id') || urlParam('vital'));
    const match = requestedVitalId ? items.find((item) => vitalObjectId(item) === requestedVitalId) : null;
    const selectedVitalId = selected ? vitalObjectId(selected) : '';
    if (selectedVitalId) {
      const fresh = items.find((item) => vitalObjectId(item) === selectedVitalId);
      if (fresh && fresh !== selected) setSelected(fresh);
      if (!fresh && items[0]) setSelected(items[0]);
      return;
    }
    if (match || items[0]) setSelected(match || items[0]);
  }, [items, selected]);

  function patchSelectedVital(item, patch = {}) {
    const targetId = vitalObjectId(item);
    if (!targetId) return;
    setSelected((current) => {
      if (!current || vitalObjectId(current) !== targetId) return current;
      return {
        ...current,
        ...patch,
        values: { ...(current.values || {}), ...(patch.values || {}) },
        vital_sign: current.vital_sign ? { ...current.vital_sign, ...patch } : current.vital_sign,
      };
    });
  }

  function requestAlertAction(action, item = active) {
    if (action === 'emergency') {
      setConfirmAction({
        action,
        item,
        title: 'Báo khẩn sinh hiệu',
        message: `${patientName(item)} · ${vitalText(unwrapVital(item))}. Hệ thống sẽ báo bác sĩ và tạo việc đáp ứng khẩn.`,
      });
      return;
    }
    alertAction(action, item);
  }

  async function alertAction(action, item = active) {
    const vitalId = vitalObjectId(item);
    const state = vitalAlertState(item);
    if (!vitalId) {
      setNotice('Bản ghi này chưa có vital_sign_id hợp lệ từ hệ thống.');
      notifyNurse({ tone: 'warning', title: 'Sinh hiệu bất thường', message: 'Bản ghi này chưa có vital_sign_id hợp lệ từ hệ thống.' });
      return;
    }
    if (action === 'acknowledge' && state.acknowledged) {
      notifyNurse({ tone: 'info', title: 'Xác nhận cảnh báo', message: 'Cảnh báo này đã được xác nhận trước đó.' });
      return;
    }
    if (action === 'notify_doctor' && state.doctorNotified) {
      notifyNurse({ tone: 'info', title: 'Báo bác sĩ', message: 'Bác sĩ đã được thông báo cho cảnh báo này.' });
      return;
    }
    if (action === 'request_recheck' && state.recheckRequested) {
      notifyNurse({ tone: 'info', title: 'Tạo việc đo lại', message: 'Bản ghi này đã có việc đo lại đang theo dõi.' });
      return;
    }
    if (action === 'emergency' && state.escalated) {
      notifyNurse({ tone: 'info', title: 'Báo khẩn', message: 'Cảnh báo này đã được báo khẩn.' });
      return;
    }

    if (action === 'request_recheck') {
      await runNurseAction({
        label: 'Tạo việc đo lại',
        isDemo,
        demoMessage: 'Dữ liệu mẫu không có vital_sign_id thật để tạo việc đo lại.',
        setBusy: (busy) => setBusyAction(busy ? action : ''),
        run: () => nurseVitalsApi.requestVitalRecheck(vitalId, {
          title: `Đo lại sinh hiệu - ${patientName(item)}`,
          description: vitalText(unwrapVital(item)),
          sla_minutes: (item.severity || unwrapVital(item).severity) === 'critical' ? 5 : 15,
        }),
        successMessage: 'Đã tạo việc đo lại sinh hiệu.',
        onSuccess: (result) => {
          const taskId = resultTaskId(result);
          patchSelectedVital(item, { requires_recheck: true, related_task_id: taskId });
          setNotice('Đã tạo việc đo lại sinh hiệu và gắn vào cảnh báo.');
          setRefresh((value) => value + 1);
        },
      });
      return;
    }

    if (action === 'create_note') {
      await runNurseAction({
        label: 'Tạo ghi chú',
        isDemo,
        demoMessage: 'Dữ liệu mẫu không có vital_sign_id thật để tạo ghi chú điều dưỡng.',
        setBusy: (busy) => setBusyAction(busy ? action : ''),
        run: () => nurseVitalsApi.createVitalNursingNote(vitalId, {
          title: 'Theo dõi sinh hiệu bất thường',
          note_type: 'nursing_abnormal_vital',
          priority: (item.severity || unwrapVital(item).severity) === 'critical' ? 'urgent' : 'important',
          status: 'signed',
          content: `Sinh hiệu bất thường: ${vitalText(unwrapVital(item))}. Đã ghi nhận trên bảng cảnh báo điều dưỡng.`,
          linked_vital_sign_ids: [vitalId].filter(Boolean),
          tags: ['abnormal_vital', 'nursing'],
        }),
        successMessage: 'Đã tạo ghi chú điều dưỡng.',
        onSuccess: (result) => {
          setNotice(`Đã tạo ghi chú điều dưỡng${result?.clinical_note_id ? ` #${String(result.clinical_note_id).slice(-6)}` : ''}.`);
          setRefresh((value) => value + 1);
        },
      });
      return;
    }

    if (action === 'emergency') {
      await runNurseAction({
        label: 'Báo khẩn',
        isDemo,
        demoMessage: 'Cần vital_sign_id hợp lệ để báo khẩn.',
        setBusy: (busy) => setBusyAction(busy ? action : ''),
        run: () => nurseVitalsApi.escalateVital(vitalId, {
          reason: 'Điều dưỡng báo khẩn từ bảng sinh hiệu bất thường.',
          message: `${patientName(item)} có sinh hiệu bất thường: ${vitalText(unwrapVital(item))}. Cần bác sĩ phản hồi khẩn.`,
          sla_minutes: 5,
        }),
        successMessage: 'Đã báo khẩn, thông báo bác sĩ và tạo việc đáp ứng khẩn.',
        onSuccess: (result) => {
          patchSelectedVital(item, {
            acknowledged_at: result?.acknowledged_at || new Date().toISOString(),
            doctor_notified_at: result?.doctor_notified_at || new Date().toISOString(),
            escalated_at: result?.escalated_at || new Date().toISOString(),
            escalation_reason: result?.escalation_reason || 'Báo khẩn sinh hiệu bất thường.',
            requires_recheck: true,
            related_task_id: resultTaskId(result),
          });
          setNotice('Đã báo khẩn, bác sĩ nhận thông báo và hệ thống đã tạo việc đáp ứng khẩn.');
          setRefresh((value) => value + 1);
        },
      });
      return;
    }

    await runNurseAction({
      label: action === 'acknowledge' ? 'Xác nhận cảnh báo' : 'Báo bác sĩ',
      isDemo,
      demoMessage: 'Dữ liệu mẫu không có vital_sign_id thật để cập nhật cảnh báo.',
      setBusy: (busy) => setBusyAction(busy ? action : ''),
      run: () => (action === 'acknowledge' ? nurseVitalsApi.acknowledgeVital(vitalId) : nurseVitalsApi.notifyDoctorOfVital(vitalId)),
      successMessage: action === 'acknowledge' ? 'Đã xác nhận cảnh báo sinh hiệu.' : 'Đã ghi nhận báo bác sĩ.',
      onSuccess: (result) => {
        patchSelectedVital(item, action === 'acknowledge'
          ? { acknowledged_at: result?.acknowledged_at || new Date().toISOString() }
          : { doctor_notified_at: result?.doctor_notified_at || new Date().toISOString() });
        setNotice(action === 'acknowledge' ? 'Đã xác nhận cảnh báo sinh hiệu.' : 'Đã ghi nhận báo bác sĩ.');
        setRefresh((value) => value + 1);
      },
    });
  }

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Bảng an toàn và quy trình báo khẩn" title="Sinh hiệu bất thường" description="Quản lý cảnh báo sinh hiệu theo mức độ, SLA xử lý, xác nhận đã xem, yêu cầu đo lại, báo bác sĩ và đóng luồng theo dõi." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={loading || Boolean(busyAction)} actions={<><button type="button" onClick={() => requestAlertAction('acknowledge')} disabled={!hasActiveVital || activeState.acknowledged || Boolean(busyAction)}>{busyAction === 'acknowledge' ? <Loader2 className="is-spinning" size={16} /> : <CheckCircle2 size={16} />}{activeState.acknowledged ? 'Đã xác nhận' : 'Xác nhận'}</button><button type="button" onClick={() => requestAlertAction('notify_doctor')} disabled={!hasActiveVital || activeState.doctorNotified || Boolean(busyAction)}>{busyAction === 'notify_doctor' ? <Loader2 className="is-spinning" size={16} /> : <Send size={16} />}{activeState.doctorNotified ? 'Đã báo BS' : 'Báo bác sĩ'}</button><button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={Boolean(busyAction)}><RefreshCw size={16} />Làm mới</button></>} />
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
            {[
              ['Mới', true],
              ['Đã xác nhận', activeState.acknowledged],
              ['Yêu cầu đo lại', activeState.recheckRequested],
              ['Đã báo bác sĩ', activeState.doctorNotified],
              ['Đã báo khẩn', activeState.escalated],
              ['Đang theo dõi', activeState.recheckRequested || activeState.doctorNotified || activeState.escalated],
            ].map(([step, done]) => <span key={step} className={done ? 'is-done' : ''}>{step}</span>)}
          </section>
          <footer>
            <button type="button" onClick={() => requestAlertAction('acknowledge')} disabled={!hasActiveVital || activeState.acknowledged || Boolean(busyAction)}>{busyAction === 'acknowledge' ? <Loader2 className="is-spinning" size={16} /> : <CheckCircle2 size={16} />}{activeState.acknowledged ? 'Đã xác nhận' : 'Xác nhận đã xem'}</button>
            <button type="button" onClick={() => requestAlertAction('request_recheck')} disabled={!hasActiveVital || activeState.recheckRequested || Boolean(busyAction)}>{busyAction === 'request_recheck' ? <Loader2 className="is-spinning" size={16} /> : <RefreshCw size={16} />}{activeState.recheckRequested ? 'Đã tạo đo lại' : 'Tạo việc đo lại'}</button>
            <button type="button" onClick={() => requestAlertAction('notify_doctor')} disabled={!hasActiveVital || activeState.doctorNotified || Boolean(busyAction)}>{busyAction === 'notify_doctor' ? <Loader2 className="is-spinning" size={16} /> : <Send size={16} />}{activeState.doctorNotified ? 'Đã báo bác sĩ' : 'Báo bác sĩ'}</button>
            <button type="button" onClick={() => requestAlertAction('create_note')} disabled={!hasActiveVital || Boolean(busyAction)}>{busyAction === 'create_note' ? <Loader2 className="is-spinning" size={16} /> : <FileText size={16} />}Tạo ghi chú</button>
            <button type="button" className="is-danger" onClick={() => requestAlertAction('emergency')} disabled={!hasActiveVital || activeState.escalated || Boolean(busyAction)}>{busyAction === 'emergency' ? <Loader2 className="is-spinning" size={16} /> : <ShieldAlert size={16} />}{activeState.escalated ? 'Đã báo khẩn' : 'Báo khẩn'}</button>
          </footer>
        </main>
        <PatientClinicalSidebar item={active} latestVital={activeVital} onAction={(label) => {
          if (label === 'Báo bác sĩ') requestAlertAction('notify_doctor');
          else if (label === 'Tạo việc đo lại') requestAlertAction('request_recheck');
          else if (label === 'Ghi chú') requestAlertAction('create_note');
          else if (label === 'Dòng thời gian') goNursePath(withContextPath('/nurse/vitals-records/history', active), 'Dòng thời gian sinh hiệu');
          else goNursePath(withContextPath('/nurse/vitals-records/entry', active), 'Nhập sinh hiệu');
        }} />
      </section>
      {confirmAction ? (
        <div className="nurse-vitals-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmAction(null); }}>
          <section className="nurse-vitals-confirm" role="dialog" aria-modal="true" aria-labelledby="nurse-vitals-confirm-title">
            <ShieldAlert size={22} />
            <h2 id="nurse-vitals-confirm-title">{confirmAction.title}</h2>
            <p>{confirmAction.message}</p>
            <footer>
              <button type="button" onClick={() => setConfirmAction(null)}>Hủy</button>
              <button type="button" className="is-danger" onClick={() => { const next = confirmAction; setConfirmAction(null); alertAction(next.action, next.item); }}>Báo khẩn ngay</button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export function VitalCorrectionsPage() {
  const [filters, setFilters] = useState(baseFilters());
  const [refresh, setRefresh] = useState(0);
  const fallback = emptyCorrections(filters);
  const { data, loading, isDemo, error } = useVitalsData(() => nurseVitalsApi.getCorrections({ status: filters.status === 'all' ? undefined : filters.status }), fallback, [filters.status, refresh]);
  const items = listOf(data.items)
    .filter((item) => item && typeof item === 'object')
    .filter((item) => !filters.search || `${patientName(item)} ${textValue(item.reason, '')}`.toLowerCase().includes(filters.search.toLowerCase()));
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [busyCorrectionAction, setBusyCorrectionAction] = useState('');
  const [confirmCorrectionAction, setConfirmCorrectionAction] = useState(null);
  const [createCorrectionForm, setCreateCorrectionForm] = useState(null);
  const active = selected || items[0] || {};
  const activeWorkflow = correctionWorkflow(active);
  const actionBusy = Boolean(busyCorrectionAction);

  useEffect(() => {
    const selectedId = correctionRequestId(selected);
    if (selectedId) {
      const fresh = items.find((item) => correctionRequestId(item) === selectedId);
      if (fresh && fresh !== selected) {
        setSelected(fresh);
        return;
      }
      if (!fresh && items[0]) {
        setSelected(items[0]);
        return;
      }
      if (!fresh && !items.length) setSelected(null);
      return;
    }
    if (!selected && items[0]) setSelected(items[0]);
    if (selected && !items.length) setSelected(null);
  }, [items, selected]);

  const correctionActionDetails = {
    approve: {
      label: 'Duyệt',
      title: 'Duyệt yêu cầu sửa?',
      confirmLabel: 'Duyệt yêu cầu',
      noteLabel: 'Ghi chú duyệt',
      defaultNote: 'Đồng ý sửa theo đề xuất.',
      success: 'Đã duyệt yêu cầu sửa sinh hiệu.',
      blocked: 'Chỉ yêu cầu đang chờ mới được duyệt.',
      allowed: (workflow) => workflow.canApprove,
    },
    reject: {
      label: 'Từ chối',
      title: 'Từ chối yêu cầu sửa?',
      confirmLabel: 'Từ chối',
      noteLabel: 'Lý do từ chối',
      defaultNote: 'Cần bổ sung lý do hoặc kiểm tra lại dữ liệu.',
      success: 'Đã từ chối yêu cầu sửa sinh hiệu.',
      blocked: 'Chỉ yêu cầu đang chờ mới được từ chối.',
      allowed: (workflow) => workflow.canReject,
      danger: true,
      requiresNote: true,
    },
    apply: {
      label: 'Áp dụng',
      title: 'Áp dụng giá trị sửa?',
      confirmLabel: 'Áp dụng sửa',
      noteLabel: '',
      defaultNote: '',
      success: 'Đã áp dụng giá trị sửa vào bản ghi sinh hiệu.',
      blocked: 'Yêu cầu này không còn ở trạng thái có thể áp dụng.',
      allowed: (workflow) => workflow.canApply,
    },
    cancel: {
      label: 'Hủy',
      title: 'Hủy yêu cầu sửa?',
      confirmLabel: 'Hủy yêu cầu',
      noteLabel: 'Lý do hủy',
      defaultNote: 'Hủy theo yêu cầu điều dưỡng.',
      success: 'Đã hủy yêu cầu sửa sinh hiệu.',
      blocked: 'Chỉ yêu cầu đang chờ hoặc đã duyệt mới được hủy.',
      allowed: (workflow) => workflow.canCancel,
      danger: true,
      requiresNote: true,
    },
  };

  function refreshCorrections() {
    setRefresh((value) => value + 1);
    setNotice('Đang làm mới danh sách yêu cầu sửa sinh hiệu.');
  }

  function selectCorrection(item) {
    setSelected(item);
    setNotice(`Đang xem yêu cầu sửa của ${patientName(item)}.`);
  }

  function openCreateCorrectionRequest(target = active) {
    const vitalId = vitalObjectId(target);
    if (!vitalId) {
      notifyNurse({ tone: 'warning', title: 'Tạo yêu cầu sửa', message: 'Chọn một bản ghi sinh hiệu trong lịch sử trước khi tạo yêu cầu sửa.' });
      goNursePath(withContextPath('/nurse/vitals-records/history', target || {}), 'Tạo yêu cầu sửa');
      return;
    }
    setCreateCorrectionForm({
      target,
      field: correctionFieldOptions[0],
      value: '',
      reason_category: 'wrong_value',
      reason: 'Điều dưỡng yêu cầu sửa giá trị sinh hiệu sau khi kiểm tra lại.',
    });
  }

  async function submitCreateCorrectionRequest(event) {
    event.preventDefault();
    if (!createCorrectionForm || actionBusy) return;
    const target = createCorrectionForm.target || active;
    const vitalId = vitalObjectId(target);
    if (!vitalId) {
      setNotice('Bản ghi này chưa có mã sinh hiệu hợp lệ.');
      notifyNurse({ tone: 'warning', title: 'Tạo yêu cầu sửa', message: 'Bản ghi này chưa có mã sinh hiệu hợp lệ.' });
      return;
    }
    let parsedValue;
    try {
      parsedValue = normalizeCorrectionValue(createCorrectionForm.field, createCorrectionForm.value);
    } catch (validationError) {
      setNotice(validationError.message);
      notifyNurse({ tone: 'warning', title: 'Tạo yêu cầu sửa', message: validationError.message });
      return;
    }
    if (!String(createCorrectionForm.reason || '').trim()) {
      setNotice('Cần nhập lý do sửa sinh hiệu.');
      notifyNurse({ tone: 'warning', title: 'Tạo yêu cầu sửa', message: 'Cần nhập lý do sửa sinh hiệu.' });
      return;
    }
    setBusyCorrectionAction('create');
    try {
      const result = await nurseVitalsApi.requestCorrection(vitalId, {
        reason: createCorrectionForm.reason.trim(),
        reason_category: createCorrectionForm.reason_category,
        proposed_values: { [createCorrectionForm.field]: parsedValue },
      });
      setCreateCorrectionForm(null);
      setSelected(result || target);
      setNotice('Đã tạo yêu cầu sửa sinh hiệu.');
      notifyNurse({ tone: 'success', title: 'Tạo yêu cầu sửa', message: 'Đã tạo yêu cầu sửa sinh hiệu.' });
      setRefresh((value) => value + 1);
    } catch (actionError) {
      setNotice(actionError?.message || 'Không thể tạo yêu cầu sửa.');
      notifyNurse({ tone: 'danger', title: 'Tạo yêu cầu sửa', message: actionError?.message || 'Không thể tạo yêu cầu sửa.' });
    } finally {
      setBusyCorrectionAction('');
    }
  }

  function requestCorrectionAction(action, target = active) {
    const details = correctionActionDetails[action];
    const workflow = correctionWorkflow(target);
    if (!details) return;
    if (!workflow.id) {
      setNotice('Bản ghi này chưa có mã yêu cầu sửa hợp lệ từ hệ thống.');
      notifyNurse({ tone: 'warning', title: 'Sửa sinh hiệu', message: 'Bản ghi này chưa có mã yêu cầu sửa hợp lệ từ hệ thống.' });
      return;
    }
    if (!details.allowed(workflow)) {
      setNotice(details.blocked);
      notifyNurse({ tone: 'warning', title: details.label, message: details.blocked });
      return;
    }
    setSelected(target);
    setConfirmCorrectionAction({
      action,
      target,
      title: details.title,
      message: `${patientName(target)} · ${patientCode(target)}${correctionFieldSummary(target) ? `\n${correctionFieldSummary(target)}` : ''}`,
      note: details.defaultNote,
    });
  }

  async function updateCorrection() {
    if (!confirmCorrectionAction || actionBusy) return;
    const { action, target, note } = confirmCorrectionAction;
    const details = correctionActionDetails[action];
    const workflow = correctionWorkflow(target);
    if (!details || !workflow.id) return;
    if (details.requiresNote && !String(note || '').trim()) {
      setNotice('Cần nhập ghi chú cho thao tác này.');
      notifyNurse({ tone: 'warning', title: details.label, message: 'Cần nhập ghi chú cho thao tác này.' });
      return;
    }
    setBusyCorrectionAction(action);
    try {
      let result = null;
      if (action === 'approve') result = await nurseVitalsApi.approveCorrection(workflow.id, { review_note: note || details.defaultNote });
      if (action === 'reject') result = await nurseVitalsApi.rejectCorrection(workflow.id, { review_note: note || details.defaultNote });
      if (action === 'apply') result = await nurseVitalsApi.applyCorrection(workflow.id);
      if (action === 'cancel') result = await nurseVitalsApi.cancelCorrection(workflow.id, { reason: note || details.defaultNote });
      setConfirmCorrectionAction(null);
      setSelected(result || target);
      setNotice(details.success);
      notifyNurse({ tone: 'success', title: details.label, message: details.success });
      setRefresh((value) => value + 1);
    } catch (actionError) {
      setNotice(actionError?.message || 'Không thể cập nhật yêu cầu sửa.');
      notifyNurse({ tone: 'danger', title: details.label, message: actionError?.message || 'Không thể cập nhật yêu cầu sửa.' });
    } finally {
      setBusyCorrectionAction('');
    }
  }

  const ConfirmIcon = confirmCorrectionAction ? correctionActionIcons[confirmCorrectionAction.action] || ClipboardCheck : ClipboardCheck;
  const confirmDetails = confirmCorrectionAction ? correctionActionDetails[confirmCorrectionAction.action] : null;

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Quy trình chất lượng dữ liệu, so sánh trước/sau và kiểm tra" title="Bản ghi cần sửa" description="Quản lý yêu cầu sửa sinh hiệu, duyệt sửa, áp dụng sửa, đánh dấu nhập sai và xem dòng thời gian kiểm tra." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={loading} actions={<><button type="button" onClick={() => openCreateCorrectionRequest()} disabled={actionBusy}><Plus size={16} />Tạo yêu cầu</button><button type="button" onClick={() => requestCorrectionAction('approve')} disabled={!activeWorkflow.canApprove || actionBusy}>{busyCorrectionAction === 'approve' ? <Loader2 className="is-spinning" size={16} /> : <CheckCircle2 size={16} />}Duyệt</button><button type="button" onClick={refreshCorrections} disabled={loading || actionBusy}>{loading ? <Loader2 className="is-spinning" size={16} /> : <RefreshCw size={16} />}Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <VitalsFilters filters={filters} setFilters={setFilters} statusOptions={[
        { value: 'pending', label: 'Đang chờ' },
        { value: 'approved', label: 'Đã duyệt' },
        { value: 'applied', label: 'Đã áp dụng' },
        { value: 'rejected', label: 'Từ chối' },
        { value: 'cancelled', label: 'Đã hủy' },
      ]} />
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
              <tbody>{items.length ? items.map((item) => {
                const changed = Object.keys(item.proposed_values || {});
                const workflow = correctionWorkflow(item);
                const rowBusy = busyCorrectionAction && correctionRequestId(item) === correctionRequestId(confirmCorrectionAction?.target);
                return (
                  <tr key={item._id || item.id} onClick={() => selectCorrection(item)} className={correctionRequestId(active) === correctionRequestId(item) ? 'is-selected' : ''}>
                    <td><strong>{patientName(item)}</strong><small>{patientCode(item)}</small></td>
                    <td>{textValue(item.encounter_id, '--')}</td>
                    <td>{changed.map((field) => fieldLabels[field] || field).join(', ') || '--'}</td>
                    <td>{textValue(item.requested_by, '--')}</td>
                    <td>{item.reason}</td>
                    <td><StatusBadge value={item.status} /></td>
                    <td>
                      <div className="nurse-row-actions">
                        <button type="button" onClick={(event) => { event.stopPropagation(); selectCorrection(item); }}><Eye size={14} />Xem</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); requestCorrectionAction('apply', item); }} disabled={!workflow.canApply || Boolean(rowBusy)}>{rowBusy && busyCorrectionAction === 'apply' ? <Loader2 className="is-spinning" size={14} /> : <ClipboardCheck size={14} />}Áp dụng</button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7}><div className="nurse-empty-state">Chưa có yêu cầu sửa sinh hiệu trong bộ lọc hiện tại.</div></td></tr>
              )}</tbody>
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
            <button type="button" onClick={() => requestCorrectionAction('approve')} disabled={!activeWorkflow.canApprove || actionBusy}>{busyCorrectionAction === 'approve' ? <Loader2 className="is-spinning" size={15} /> : <CheckCircle2 size={15} />}Duyệt</button>
            <button type="button" className="is-danger" onClick={() => requestCorrectionAction('reject')} disabled={!activeWorkflow.canReject || actionBusy}>{busyCorrectionAction === 'reject' ? <Loader2 className="is-spinning" size={15} /> : <AlertTriangle size={15} />}Từ chối</button>
            <button type="button" onClick={() => requestCorrectionAction('apply')} disabled={!activeWorkflow.canApply || actionBusy}>{busyCorrectionAction === 'apply' ? <Loader2 className="is-spinning" size={15} /> : <ClipboardCheck size={15} />}Áp dụng</button>
            <button type="button" className="is-danger" onClick={() => requestCorrectionAction('cancel')} disabled={!activeWorkflow.canCancel || actionBusy}>{busyCorrectionAction === 'cancel' ? <Loader2 className="is-spinning" size={15} /> : <FileText size={15} />}Hủy</button>
          </footer>
        </aside>
      </section>
      {createCorrectionForm ? (
        <div className="nurse-vitals-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionBusy) setCreateCorrectionForm(null); }}>
          <form className="nurse-vitals-confirm nurse-vitals-correction-form" role="dialog" aria-modal="true" aria-labelledby="nurse-correction-create-title" onSubmit={submitCreateCorrectionRequest}>
            <Plus size={22} />
            <h2 id="nurse-correction-create-title">Tạo yêu cầu sửa sinh hiệu</h2>
            <p>{patientName(createCorrectionForm.target)} · {patientCode(createCorrectionForm.target)}</p>
            <div className="nurse-vitals-form-grid">
              <label>
                <span>Trường cần sửa</span>
                <select value={createCorrectionForm.field} onChange={(event) => setCreateCorrectionForm((form) => ({ ...form, field: event.target.value, value: '' }))}>
                  {correctionFieldOptions.map((field) => <option key={field} value={field}>{fieldLabels[field] || field}</option>)}
                </select>
              </label>
              <label>
                <span>Giá trị mới{vitalUnits[createCorrectionForm.field] ? ` (${vitalUnits[createCorrectionForm.field]})` : ''}</span>
                <input type={createCorrectionForm.field === 'recorded_at' ? 'datetime-local' : 'text'} value={createCorrectionForm.value} onChange={(event) => setCreateCorrectionForm((form) => ({ ...form, value: event.target.value }))} placeholder={createCorrectionForm.field === 'recorded_at' ? '2026-05-29T07:30' : 'Nhập giá trị đã kiểm tra'} />
              </label>
              <label>
                <span>Nhóm lý do</span>
                <select value={createCorrectionForm.reason_category} onChange={(event) => setCreateCorrectionForm((form) => ({ ...form, reason_category: event.target.value }))}>
                  {correctionReasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="is-wide">
                <span>Lý do sửa</span>
                <textarea rows={3} value={createCorrectionForm.reason} onChange={(event) => setCreateCorrectionForm((form) => ({ ...form, reason: event.target.value }))} />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setCreateCorrectionForm(null)} disabled={actionBusy}>Hủy</button>
              <button type="submit" disabled={actionBusy}>{busyCorrectionAction === 'create' ? <Loader2 className="is-spinning" size={16} /> : <Plus size={16} />}Gửi yêu cầu</button>
            </footer>
          </form>
        </div>
      ) : null}
      {confirmCorrectionAction && confirmDetails ? (
        <div className="nurse-vitals-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionBusy) setConfirmCorrectionAction(null); }}>
          <section className={`nurse-vitals-confirm ${confirmDetails.danger ? 'is-danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby="nurse-correction-action-title">
            <ConfirmIcon size={22} />
            <h2 id="nurse-correction-action-title">{confirmCorrectionAction.title}</h2>
            <p>{confirmCorrectionAction.message}</p>
            {confirmDetails.noteLabel ? (
              <label className="nurse-vitals-confirm-note">
                <span>{confirmDetails.noteLabel}</span>
                <textarea rows={3} value={confirmCorrectionAction.note} onChange={(event) => setConfirmCorrectionAction((current) => ({ ...current, note: event.target.value }))} />
              </label>
            ) : null}
            <footer>
              <button type="button" onClick={() => setConfirmCorrectionAction(null)} disabled={actionBusy}>Hủy</button>
              <button type="button" className={confirmDetails.danger ? 'is-danger' : ''} onClick={updateCorrection} disabled={actionBusy || (confirmDetails.requiresNote && !String(confirmCorrectionAction.note || '').trim())}>{busyCorrectionAction === confirmCorrectionAction.action ? <Loader2 className="is-spinning" size={16} /> : <ConfirmIcon size={16} />}{confirmDetails.confirmLabel}</button>
            </footer>
          </section>
        </div>
      ) : null}
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

function defaultNursingNoteForm(template = noteTemplates[0]) {
  return {
    title: template.title,
    note_type: template.key === 'abnormal' ? 'nursing_abnormal_vital' : `nursing_${template.key}`,
    priority: template.key === 'abnormal' ? 'important' : 'normal',
    content: template.content,
  };
}

function appendNoteContent(form, text) {
  const content = String(form.content || '').trim();
  return { ...form, content: content ? `${content}\n${text}` : text };
}

function editableNoteStatus(status) {
  return !status || ['draft', 'in_progress'].includes(status);
}

function notePrioritySeverity(note = {}) {
  const vital = unwrapVital(note.latest_vital_sign || note.latest_vital || note.vital_sign || {});
  const priority = String(note.priority || '').toLowerCase();
  if (vital?.overall_severity || vital?.severity) return vital.overall_severity || vital.severity;
  if (priority === 'urgent') return 'high';
  if (priority === 'important' || String(note.note_type || '').toLowerCase().includes('abnormal')) return 'warning';
  return 'normal';
}

function noteSearchContent(note = {}) {
  return [
    note.title,
    note.content,
    note.note_type,
    note.priority,
    patientName(note),
    patientCode(note),
    queueNumber(note),
    encounterId(note),
    note.encounter_code,
    note.department_name,
    note.doctor_name,
  ].map((value) => textValue(value, '')).join(' ').toLowerCase();
}

function noteMatchesQuickFilter(note = {}, quickFilter = 'all') {
  if (quickFilter === 'unsigned') return editableNoteStatus(note.status);
  if (quickFilter === 'abnormal') return String(note.note_type || '').toLowerCase().includes('abnormal') || notePrioritySeverity(note) !== 'normal';
  if (quickFilter === 'doctor_notified') return Boolean(note.notified_doctor_id || note.doctor_notified_at);
  if (quickFilter === 'linked') return Array.isArray(note.linked_vital_sign_ids) && note.linked_vital_sign_ids.length > 0;
  return true;
}

export function NursingNotesPage() {
  const [filters, setFilters] = useState(baseFilters());
  const [refresh, setRefresh] = useState(0);
  const { data: worklistData } = useWaitingVitals(filters, refresh);
  const worklistItems = listOf(worklistData.items);
  const requestedQueueId = backendId(urlParam('queue_ticket_id'));
  const requestedEncounterId = backendId(urlParam('encounter_id'));
  const requestedPatientId = backendId(urlParam('patient_id'));
  const requestedVitalId = backendId(urlParam('vital_sign_id'));
  const hasRequestedContext = Boolean(requestedQueueId || requestedEncounterId || requestedPatientId || requestedVitalId);
  const selectedFromWorklist = worklistItems.find((item) => (
    (requestedQueueId && queueTicketObjectId(item) === requestedQueueId)
    || (requestedEncounterId && encounterObjectId(item) === requestedEncounterId)
    || (requestedPatientId && patientObjectId(item) === requestedPatientId)
    || (hasRequestedContext && requestedVitalId && vitalObjectId(item) === requestedVitalId)
  )) || null;
  const fallbackWorklistContext = selectedFromWorklist || (!hasRequestedContext ? worklistItems[0] : null) || null;
  const fallback = emptyNursingNotes(filters);
  const { data, loading, isDemo, error } = useVitalsData(() => nurseVitalsApi.getNursingVitalNotes({
    date: filters.date,
    shift: filters.shift,
    status: filters.status === 'all' ? undefined : filters.status,
    encounter_id: requestedEncounterId || encounterObjectId(selectedFromWorklist) || undefined,
    patient_id: requestedPatientId || undefined,
    queue_ticket_id: requestedQueueId || undefined,
    vital_sign_id: requestedVitalId || undefined,
  }), fallback, [filters.date, filters.shift, filters.status, requestedEncounterId, requestedPatientId, requestedQueueId, requestedVitalId, selectedFromWorklist, refresh]);
  const [activeNote, setActiveNote] = useState(null);
  const [draftContext, setDraftContext] = useState(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [quickNoteFilter, setQuickNoteFilter] = useState('all');
  const [form, setForm] = useState(defaultNursingNoteForm());
  const [notice, setNotice] = useState('');
  const [busyNoteAction, setBusyNoteAction] = useState('');
  const [confirmNoteAction, setConfirmNoteAction] = useState(null);
  const notes = useMemo(() => listOf(data.items)
    .filter((note) => note && typeof note === 'object')
    .filter((note) => {
      const query = String(filters.search || '').trim().toLowerCase();
      if (query && !noteSearchContent(note).includes(query)) return false;
      if (filters.status !== 'all' && note.status !== filters.status) return false;
      if (filters.severity !== 'all' && notePrioritySeverity(note) !== filters.severity) return false;
      return noteMatchesQuickFilter(note, quickNoteFilter);
    }), [data.items, filters.search, filters.severity, filters.status, quickNoteFilter]);
  const selected = activeNote || draftContext || selectedFromWorklist || notes[0] || fallbackWorklistContext || {};
  const targetEncounterId = requestedEncounterId || encounterObjectId(selected);
  const latestVitalId = requestedVitalId || vitalObjectId(selected) || backendId(listOf(selected?.linked_vital_sign_ids)[0]);
  const latestVital = selected?.latest_vital_sign || selected?.latest_vital || selected?.vital_sign;
  const activeNoteId = clinicalNoteId(activeNote);
  const noteEditable = isCreatingNote || editableNoteStatus(activeNote?.status);
  const isBusy = Boolean(busyNoteAction);

  useEffect(() => {
    if (isCreatingNote) return;
    if (activeNote) {
      const activeId = clinicalNoteId(activeNote);
      const stillVisible = activeId && notes.some((note) => clinicalNoteId(note) === activeId);
      if (!stillVisible) setActiveNote(notes[0] || null);
      return;
    }
    if (notes[0]) setActiveNote(notes[0]);
  }, [activeNote, isCreatingNote, notes]);

  useEffect(() => {
    if (!activeNote) return;
    const note = safeItem(activeNote);
    setForm({
      title: note.title || noteTemplates[0].title,
      note_type: note.note_type || 'nursing_vital_routine',
      priority: note.priority || 'normal',
      content: note.content || noteTemplates[0].content,
    });
  }, [activeNote]);

  function applyTemplate(template) {
    if (!template) return;
    setIsCreatingNote((current) => current || !activeNote);
    setForm(defaultNursingNoteForm(template));
    setNotice(`Đã áp dụng mẫu "${template.title}".`);
  }

  function createNewNote() {
    const context = selected && Object.keys(safeItem(selected)).length
      ? selected
      : fallbackWorklistContext || notes[0] || {};
    setActiveNote(null);
    setDraftContext(context);
    setIsCreatingNote(true);
    setForm(defaultNursingNoteForm());
    setNotice('Đã mở ghi chú mới.');
  }

  function refreshNotes() {
    setRefresh((value) => value + 1);
    setNotice('Đang làm mới ghi chú điều dưỡng.');
  }

  function selectNote(note) {
    setIsCreatingNote(false);
    setDraftContext(null);
    setActiveNote(note);
    setNotice(`Đang xem ${textValue(note.title || note.note_type, 'ghi chú điều dưỡng')}.`);
  }

  function applyQuickNoteFilter(nextQuickFilter, nextFilters = {}, message = 'Đã áp dụng lọc nhanh ghi chú.') {
    setIsCreatingNote(false);
    setDraftContext(null);
    setActiveNote(null);
    setQuickNoteFilter(nextQuickFilter);
    setFilters((current) => ({ ...current, search: '', ...nextFilters }));
    setNotice(message);
    notifyNurse({ title: 'Lọc nhanh', message });
  }

  function validateNoteForm(options = {}) {
    const requireEncounter = options.requireEncounter !== false;
    if (!targetEncounterId) {
      if (requireEncounter || !latestVitalId) {
        throw new Error('Chưa có lượt khám hợp lệ. Hãy mở ghi chú từ bệnh nhân/lượt khám hoặc từ màn hình sinh hiệu.');
      }
    }
    if (!String(form.title || '').trim()) throw new Error('Cần nhập tiêu đề ghi chú.');
    if (!String(form.content || '').trim()) throw new Error('Cần nhập nội dung ghi chú.');
  }

  async function persistNote(status = 'draft', options = {}) {
    validateNoteForm();
    const actionKey = status === 'signed' ? 'signed' : 'draft';
    setBusyNoteAction(options.busyKey || actionKey);
    try {
      const existingNoteId = clinicalNoteId(activeNote);
      const editableExisting = existingNoteId && editableNoteStatus(activeNote?.status);
      const payload = {
        ...form,
        title: form.title.trim(),
        content: form.content.trim(),
        status: status === 'signed' ? 'draft' : status,
        linked_vital_sign_ids: [latestVitalId].filter(Boolean),
        tags: ['vital_sign', 'nursing', form.priority, form.note_type].filter(Boolean),
      };
      const saved = editableExisting
        ? await nurseVitalsApi.updateNursingNote(existingNoteId, payload)
        : await nurseVitalsApi.createNursingNote(targetEncounterId, payload);
      const savedNoteId = clinicalNoteIdFromResult(saved) || existingNoteId;
      let finalNote = saved;
      if (status === 'signed' && savedNoteId) finalNote = await nurseVitalsApi.signNursingNote(savedNoteId);
      setIsCreatingNote(false);
      setDraftContext(null);
      setActiveNote(finalNote?.clinical_note || finalNote || saved || activeNote);
      if (!options.silent) {
        const message = status === 'signed' ? 'Đã hoàn tất và ký ghi chú điều dưỡng.' : 'Đã lưu nháp ghi chú điều dưỡng.';
        setNotice(message);
        notifyNurse({ tone: 'success', title: 'Ghi chú điều dưỡng', message });
      }
      setRefresh((value) => value + 1);
      return finalNote || saved;
    } catch (saveError) {
      const message = saveError?.message || 'Không thể lưu ghi chú.';
      setNotice(message);
      notifyNurse({ tone: 'danger', title: 'Ghi chú điều dưỡng', message });
      return null;
    } finally {
      setBusyNoteAction('');
    }
  }

  async function saveDraft() {
    try {
      await persistNote('draft');
    } catch (saveError) {
      setNotice(saveError.message);
      notifyNurse({ tone: 'warning', title: 'Ghi chú điều dưỡng', message: saveError.message });
    }
  }

  function requestSignNote() {
    try {
      validateNoteForm();
      setConfirmNoteAction({
        action: 'sign',
        title: 'Hoàn tất và ký ghi chú?',
        message: 'Ghi chú sau khi ký sẽ được lưu chính thức vào hồ sơ lâm sàng và không sửa trực tiếp như nháp.',
        note: '',
      });
    } catch (validationError) {
      setNotice(validationError.message);
      notifyNurse({ tone: 'warning', title: 'Ký ghi chú', message: validationError.message });
    }
  }

  function requestNotifyDoctor() {
    try {
      validateNoteForm({ requireEncounter: false });
      if (!targetEncounterId && !latestVitalId) {
        throw new Error('Chưa có lượt khám hoặc sinh hiệu hợp lệ để báo bác sĩ.');
      }
      setConfirmNoteAction({
        action: 'notify',
        title: 'Báo bác sĩ về ghi chú?',
        message: `Tạo yêu cầu bác sĩ xem ghi chú cho ${patientName(selected)}.`,
        note: 'Bác sĩ vui lòng xem ghi chú điều dưỡng và phản hồi hướng xử trí.',
      });
    } catch (validationError) {
      setNotice(validationError.message);
      notifyNurse({ tone: 'warning', title: 'Báo bác sĩ', message: validationError.message });
    }
  }

  async function commitNoteAction() {
    if (!confirmNoteAction || isBusy) return;
    if (confirmNoteAction.action === 'sign') {
      setConfirmNoteAction(null);
      await persistNote('signed');
      return;
    }
    if (confirmNoteAction.action === 'notify') {
      setBusyNoteAction('notify');
      const recommendation = String(confirmNoteAction.note || '').trim() || 'Bác sĩ vui lòng xem ghi chú điều dưỡng và phản hồi hướng xử trí.';
      try {
        if (!targetEncounterId && latestVitalId) {
          await nurseVitalsApi.notifyDoctorOfVital(latestVitalId);
          setConfirmNoteAction(null);
          setNotice('Đã báo bác sĩ từ sinh hiệu liên kết.');
          notifyNurse({ tone: 'success', title: 'Báo bác sĩ', message: 'Đã báo bác sĩ từ sinh hiệu liên kết.' });
          setRefresh((value) => value + 1);
          return;
        }
        const saved = activeNoteId && !noteEditable
          ? activeNote
          : await persistNote('draft', { silent: true, busyKey: 'notify' });
        if (!saved) return;
        await nurseMonitoringApi.createDoctorNotification({
          encounter_id: targetEncounterId || undefined,
          patient_id: patientObjectId(selected) || undefined,
          priority: form.priority === 'urgent' ? 'urgent' : 'normal',
          category: 'nursing_note',
          latest_vital_sign_id: latestVitalId || undefined,
          clinical_note_id: clinicalNoteIdFromResult(saved) || activeNoteId || undefined,
          send: true,
          sbar: {
            situation: form.title,
            background: `Bệnh nhân ${patientName(selected)} - ${patientCode(selected)}.`,
            assessment: form.content,
            recommendation,
          },
        });
        setConfirmNoteAction(null);
        setNotice('Đã gửi yêu cầu báo bác sĩ.');
        notifyNurse({ tone: 'success', title: 'Báo bác sĩ', message: 'Đã gửi yêu cầu báo bác sĩ.' });
        setRefresh((value) => value + 1);
      } catch (notifyError) {
        setNotice(notifyError?.message || 'Không thể báo bác sĩ.');
        notifyNurse({ tone: 'danger', title: 'Báo bác sĩ', message: notifyError?.message || 'Không thể báo bác sĩ.' });
      } finally {
        setBusyNoteAction('');
      }
    }
  }

  function insertLatestVital() {
    const text = vitalText(latestVital);
    if (!latestVital || text === 'Chưa có sinh hiệu') {
      if (latestVitalId) {
        setForm((current) => appendNoteContent(current, `Sinh hiệu liên kết: ${latestVitalId}. Cần đối chiếu chi tiết trong lịch sử sinh hiệu.`));
        setNotice('Đã chèn mã sinh hiệu liên kết vào ghi chú.');
        return;
      }
      setNotice('Chưa có sinh hiệu mới nhất để chèn vào ghi chú.');
      notifyNurse({ tone: 'warning', title: 'Chèn sinh hiệu', message: 'Chưa có sinh hiệu mới nhất để chèn vào ghi chú.' });
      return;
    }
    setForm((current) => appendNoteContent(current, `Sinh hiệu mới nhất (${formatTime(latestVital.recorded_at)}): ${text}.`));
    setNotice('Đã chèn sinh hiệu mới nhất vào ghi chú.');
  }

  function insertAbnormalTemplate() {
    const flags = listOf(latestVital?.abnormal_flags);
    const flagText = flags.length
      ? flags.map((flag) => `${fieldLabels[flag.field] || flag.field}: ${textValue(flag.value)} - ${textValue(flag.message || flag.recommendation, '')}`).filter(Boolean).join('; ')
      : 'Chưa có cờ bất thường từ sinh hiệu liên kết. Cần ghi rõ chỉ số, giá trị, thời điểm và xử trí.';
    setForm((current) => appendNoteContent({
      ...current,
      note_type: 'nursing_abnormal_vital',
      priority: current.priority === 'normal' ? 'important' : current.priority,
    }, `Theo dõi sinh hiệu bất thường: ${flagText}`));
    setNotice('Đã chèn nội dung theo dõi bất thường.');
  }

  async function handleSidebarAction(label, item = selected) {
    const context = item && Object.keys(safeItem(item)).length ? item : selected;
    if (label === 'Nhập sinh hiệu') {
      goNursePath(withContextPath('/nurse/vitals-records/entry', context), 'Nhập sinh hiệu');
      return;
    }
    if (label === 'Ghi chú') {
      createNewNote();
      return;
    }
    if (label === 'Báo bác sĩ') {
      requestNotifyDoctor();
      return;
    }
    if (label === 'Dòng thời gian') {
      goNursePath(withContextPath('/nurse/vitals-records/history', context), 'Dòng thời gian sinh hiệu');
      return;
    }
    if (label === 'Tạo việc đo lại') {
      const vitalId = latestVitalId || vitalObjectId(context);
      if (!vitalId) {
        notifyNurse({ tone: 'warning', title: 'Tạo việc đo lại', message: 'Chưa có mã sinh hiệu hợp lệ để tạo việc đo lại.' });
        return;
      }
      await runNurseAction({
        label: 'Tạo việc đo lại',
        isDemo,
        setBusy: (busy) => setBusyNoteAction(busy ? 'recheck' : ''),
        run: () => nurseVitalsApi.requestVitalRecheck(vitalId, { reason: 'Điều dưỡng tạo việc đo lại từ ghi chú.' }),
        successMessage: 'Đã tạo việc đo lại sinh hiệu.',
        onSuccess: () => setRefresh((value) => value + 1),
      });
    }
  }

  const confirmIcon = confirmNoteAction?.action === 'notify' ? Send : CheckCircle2;
  const ConfirmIcon = confirmIcon;

  return (
    <section className="nurse-vitals-page">
      <VitalsHeader eyebrow="Ghi chú điều dưỡng, mẫu nhanh và sinh hiệu liên kết" title="Ghi chú điều dưỡng" description="Không gian ghi chú điều dưỡng có mẫu nhanh, liên kết sinh hiệu/cảnh báo, trạng thái ký và luồng báo bác sĩ." meta={data.meta || metaFrom(filters)} isDemo={isDemo} loading={loading} actions={<><button type="button" onClick={createNewNote} disabled={isBusy}><Plus size={16} />Tạo mới</button><button type="button" onClick={saveDraft} disabled={isBusy || !noteEditable}>{busyNoteAction === 'draft' ? <Loader2 className="is-spinning" size={16} /> : <FileText size={16} />}Lưu nháp</button><button type="button" onClick={requestSignNote} disabled={isBusy || !noteEditable}>{busyNoteAction === 'signed' ? <Loader2 className="is-spinning" size={16} /> : <CheckCircle2 size={16} />}Hoàn tất/ký</button><button type="button" onClick={requestNotifyDoctor} disabled={isBusy}>{busyNoteAction === 'notify' ? <Loader2 className="is-spinning" size={16} /> : <Send size={16} />}Báo bác sĩ</button><button type="button" onClick={refreshNotes} disabled={loading || isBusy}>{loading ? <Loader2 className="is-spinning" size={16} /> : <RefreshCw size={16} />}Làm mới</button></>} />
      <DemoNotice isDemo={isDemo} error={error} />
      {notice ? <div className="nurse-intake-toast">{notice}</div> : null}
      <VitalsFilters filters={filters} setFilters={setFilters} statusOptions={[
        { value: 'draft', label: 'Nháp' },
        { value: 'in_progress', label: 'Đang viết' },
        { value: 'signed', label: 'Đã ký' },
        { value: 'amended', label: 'Đã bổ sung' },
        { value: 'cancelled', label: 'Đã hủy' },
      ]} />
      <KpiStrip items={[
        { label: 'Hôm nay', value: data.summary?.total ?? notes.length, detail: 'Ghi chú trong bộ lọc', icon: FileText, tone: 'blue', onClick: () => applyQuickNoteFilter('all', { status: 'all', severity: 'all' }, 'Đã hiển thị toàn bộ ghi chú trong ngày.') },
        { label: 'Nháp', value: data.summary?.draft ?? notes.filter((note) => note.status === 'draft').length, detail: 'Cần hoàn tất', icon: Clock3, tone: 'amber', onClick: () => applyQuickNoteFilter('all', { status: 'draft', severity: 'all' }, 'Đã lọc các ghi chú nháp cần hoàn tất.') },
        { label: 'Cần ký', value: data.summary?.unsigned ?? notes.filter((note) => ['draft', 'in_progress'].includes(note.status)).length, detail: 'Chưa ký', icon: ClipboardCheck, tone: 'violet', onClick: () => applyQuickNoteFilter('unsigned', { status: 'all', severity: 'all' }, 'Đã lọc các ghi chú chưa ký.') },
        { label: 'Bất thường', value: data.summary?.abnormal ?? notes.filter((note) => note.note_type?.includes('abnormal')).length, detail: 'Liên quan cảnh báo', icon: AlertTriangle, tone: 'red', onClick: () => applyQuickNoteFilter('abnormal', { status: 'all', severity: 'all' }, 'Đã lọc ghi chú liên quan sinh hiệu bất thường.') },
        { label: 'Đã báo BS', value: data.summary?.doctor_notified ?? notes.filter((note) => note.notified_doctor_id || note.doctor_notified_at).length, detail: 'Có thông báo bác sĩ', icon: Send, tone: 'cyan', onClick: () => applyQuickNoteFilter('doctor_notified', { status: 'all', severity: 'all' }, 'Đã lọc các ghi chú đã báo bác sĩ.') },
        { label: 'Sinh hiệu liên kết', value: data.summary?.linked_vitals ?? notes.filter((note) => note.linked_vital_sign_ids?.length).length, detail: 'Có liên kết sinh hiệu', icon: HeartPulse, tone: 'green', onClick: () => applyQuickNoteFilter('linked', { status: 'all', severity: 'all' }, 'Đã lọc ghi chú có sinh hiệu liên kết.') },
      ]} />
      <section className="nurse-vitals-notes-layout">
        <aside className="nurse-vitals-note-timeline">
          <header className="nurse-vitals-note-timeline-header">
            <strong>Ghi chú gần đây</strong>
            <button type="button" onClick={createNewNote} disabled={isBusy}><Plus size={14} />Mới</button>
          </header>
          {notes.length ? notes.map((note, index) => {
            const row = safeItem(note);
            const rowNoteId = clinicalNoteId(row);
            const isActiveRow = !isCreatingNote && rowNoteId && clinicalNoteId(activeNote) === rowNoteId;
            return <button key={rowNoteId || row.created_at || row.title || `note-${index}`} type="button" className={isActiveRow ? 'is-active' : ''} onClick={() => selectNote(row)}><span>{formatTime(row.created_at)}</span><strong>{row.title || row.note_type || 'Ghi chú điều dưỡng'}</strong><small>{statusLabels[row.status] || row.status || 'draft'} · {row.priority || 'normal'}</small></button>;
          }) : <div className="nurse-vitals-note-empty">Chưa có ghi chú trong bộ lọc. Tạo ghi chú mới từ bệnh nhân/lượt khám đang chọn.</div>}
        </aside>
        <main className="nurse-vitals-note-editor">
          <header>
            <div>
              <h2>{form.title || 'Ghi chú điều dưỡng'}</h2>
              <p>{patientName(selected)} · {patientCode(selected)} · {targetEncounterId ? `Lượt khám ${textValue(selected.encounter_code || encounterId(selected), targetEncounterId)}` : 'Chưa chọn lượt khám'}</p>
            </div>
            <StatusBadge value={activeNote?.status || (form.priority === 'urgent' ? 'doctor_notified' : 'draft')} />
          </header>
          <section className="nurse-vitals-template-grid">
            {noteTemplates.map((template) => <button key={template.key} type="button" onClick={() => applyTemplate(template)} disabled={isBusy || !noteEditable}><strong>{template.title}</strong><span>{template.content.slice(0, 72)}...</span></button>)}
          </section>
          <div className="nurse-vitals-note-fields">
            <label><span>Tiêu đề</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} disabled={isBusy || !noteEditable} /></label>
            <label><span>Loại ghi chú</span><select value={form.note_type} onChange={(event) => setForm((current) => ({ ...current, note_type: event.target.value }))} disabled={isBusy || !noteEditable}><option value="nursing_vital_routine">Sinh hiệu thường quy</option><option value="nursing_abnormal_vital">Sinh hiệu bất thường</option><option value="nursing_post_medication">Sau dùng thuốc</option><option value="nursing_post_procedure">Sau thủ thuật</option><option value="nursing_handover">Bàn giao ca</option></select></label>
            <label><span>Ưu tiên</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} disabled={isBusy || !noteEditable}><option value="normal">Bình thường</option><option value="important">Quan trọng</option><option value="urgent">Khẩn</option></select></label>
          </div>
          <label className="nurse-vitals-note-content"><span>Nội dung</span><textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} rows={12} disabled={isBusy || !noteEditable} /></label>
          {!noteEditable ? <div className="nurse-vitals-note-lock"><CheckCircle2 size={16} />Ghi chú đã ký/đóng. Bấm Tạo mới để lập ghi chú bổ sung.</div> : null}
          <footer><button type="button" onClick={insertLatestVital} disabled={isBusy || !noteEditable}><HeartPulse size={16} />Chèn sinh hiệu mới nhất</button><button type="button" onClick={insertAbnormalTemplate} disabled={isBusy || !noteEditable}><AlertTriangle size={16} />Chèn dấu hiệu bất thường</button><button type="button" onClick={saveDraft} disabled={isBusy || !noteEditable}>{busyNoteAction === 'draft' ? <Loader2 className="is-spinning" size={16} /> : <FileText size={16} />}Lưu nháp</button><button type="button" onClick={requestSignNote} disabled={isBusy || !noteEditable}>{busyNoteAction === 'signed' ? <Loader2 className="is-spinning" size={16} /> : <CheckCircle2 size={16} />}Ký ghi chú</button></footer>
        </main>
        <PatientClinicalSidebar item={selected} latestVital={latestVital} onAction={handleSidebarAction} />
      </section>
      {confirmNoteAction ? (
        <div className="nurse-vitals-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isBusy) setConfirmNoteAction(null); }}>
          <section className={confirmNoteAction.action === 'notify' ? 'nurse-vitals-confirm' : 'nurse-vitals-confirm is-danger'} role="dialog" aria-modal="true" aria-labelledby="nurse-note-confirm-title">
            <ConfirmIcon size={22} />
            <h2 id="nurse-note-confirm-title">{confirmNoteAction.title}</h2>
            <p>{confirmNoteAction.message}</p>
            {confirmNoteAction.action === 'notify' ? (
              <label className="nurse-vitals-confirm-note">
                <span>Đề nghị gửi bác sĩ</span>
                <textarea rows={3} value={confirmNoteAction.note} onChange={(event) => setConfirmNoteAction((current) => ({ ...current, note: event.target.value }))} />
              </label>
            ) : null}
            <footer>
              <button type="button" onClick={() => setConfirmNoteAction(null)} disabled={isBusy}>Hủy</button>
              <button type="button" className={confirmNoteAction.action === 'sign' ? 'is-danger' : ''} onClick={commitNoteAction} disabled={isBusy}>{busyNoteAction === confirmNoteAction.action || (confirmNoteAction.action === 'sign' && busyNoteAction === 'signed') ? <Loader2 className="is-spinning" size={16} /> : <ConfirmIcon size={16} />}{confirmNoteAction.action === 'notify' ? 'Gửi bác sĩ' : 'Ký ghi chú'}</button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
