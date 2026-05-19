import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPlus,
  Clock3,
  Crosshair,
  FileText,
  HeartPulse,
  Loader2,
  MapPin,
  MessageSquarePlus,
  Navigation,
  PhoneCall,
  Plus,
  RefreshCw,
  Route,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  Users,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { nurseMonitoringApi } from './nurseApi';

const nowIso = () => new Date().toISOString();
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
const minutesAhead = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();

const DEMO_CASES = [
  {
    id: 'demo-ec-1',
    case_id: 'demo-ec-1',
    case_code: 'SOS-20260519-0142',
    patient: { patient_name: 'Nguyễn Văn A', patient_code: 'BN0001', age: 62, gender: 'male', phone: '0901234567' },
    patient_name: 'Nguyễn Văn A',
    patient_code: 'BN0001',
    priority: 'critical',
    status: 'created',
    type: 'fall',
    source: 'inpatient',
    location_text: 'Phòng 203 · Nội tổng quát',
    location_lat: 10.776,
    location_lng: 106.701,
    symptoms: 'Tụt HA, khó thở, SpO2 thấp sau té ngã',
    note: 'Chưa có đội nhận',
    assigned_to: null,
    assigned_department: { department_name: 'Cấp cứu' },
    created_at: minutesAgo(4),
    risk_flags: ['Dị ứng Penicillin', 'COPD', 'SpO2 thấp', 'Té ngã', 'Nguy kịch'],
    latest_vital: { spo2: 86, heart_rate: 132, systolic_bp: 84, diastolic_bp: 52, respiratory_rate: 32, temperature: 38.4 },
    metadata: {
      patient_risk_snapshot: {
        allergies: [{ allergen: 'Penicillin', severity: 'severe', reaction: 'Khó thở' }],
        chronic_problems: [{ problem_name: 'COPD', severity: 'severe' }, { problem_name: 'Đái tháo đường type 2', severity: 'moderate' }],
      },
      triage_summary: { dispatch_required: true, doctor_required: true },
    },
    sla: { status: 'breached', next_due_seconds: -75, created_minutes: 4, acknowledge_due_at: minutesAgo(1) },
  },
  {
    id: 'demo-ec-2',
    case_id: 'demo-ec-2',
    case_code: 'SOS-20260519-0141',
    patient: { patient_name: 'Phạm Thị D', patient_code: 'BN0004', age: 73, gender: 'female', phone: '0918899000' },
    patient_name: 'Phạm Thị D',
    patient_code: 'BN0004',
    priority: 'urgent',
    status: 'triaged',
    type: 'medical_emergency',
    source: 'staff_created',
    location_text: 'Sảnh A · Khu chờ khám',
    symptoms: 'Đau ngực, vã mồ hôi, mạch nhanh',
    note: 'Đã phân loại, chờ điều phối',
    assigned_to: { full_name: 'ĐD Hoa' },
    assigned_department: { department_name: 'Cấp cứu' },
    created_at: minutesAgo(11),
    acknowledged_at: minutesAgo(9),
    triaged_at: minutesAgo(4),
    triage_color: 'orange',
    esi_level: 2,
    risk_flags: ['Người cao tuổi', 'Đau ngực', 'Bệnh tim mạch'],
    latest_vital: { spo2: 93, heart_rate: 118, systolic_bp: 152, diastolic_bp: 96, respiratory_rate: 24, temperature: 37.6 },
    metadata: { triage_summary: { dispatch_required: true, doctor_required: true, esi_level: 2, triage_color: 'orange' } },
    sla: { status: 'at_risk', next_due_seconds: 88, created_minutes: 11, dispatch_due_at: minutesAhead(2) },
  },
  {
    id: 'demo-ec-3',
    case_id: 'demo-ec-3',
    case_code: 'SOS-20260519-0138',
    patient: { patient_name: 'Lê Văn C', patient_code: 'BN0003', age: 47, gender: 'male', phone: '0933333311' },
    patient_name: 'Lê Văn C',
    patient_code: 'BN0003',
    priority: 'urgent',
    status: 'acknowledged',
    type: 'panic',
    source: 'patient_app',
    location_text: 'Cổng B',
    symptoms: 'Hoảng loạn, đau đầu, run tay',
    note: 'Gia đình đang đi cùng',
    assigned_to: { full_name: 'ĐD Minh' },
    assigned_department: { department_name: 'Cấp cứu' },
    created_at: minutesAgo(7),
    acknowledged_at: minutesAgo(5),
    risk_flags: ['Hoảng loạn', 'Có GPS'],
    latest_vital: { spo2: 98, heart_rate: 104, systolic_bp: 134, diastolic_bp: 82, respiratory_rate: 22, temperature: 37.1 },
    metadata: { patient_risk_snapshot: { allergies: [], chronic_problems: [] } },
    sla: { status: 'on_time', next_due_seconds: 420, created_minutes: 7 },
  },
];

const DEMO_TIMELINE = [
  { id: 'tl-1', event_type: 'created', note: 'Ca SOS được tạo', created_at: minutesAgo(11), actor: { full_name: 'Ứng dụng bệnh nhân' } },
  { id: 'tl-2', event_type: 'acknowledged', note: 'Điều dưỡng nhận ca', created_at: minutesAgo(9), actor: { full_name: 'ĐD Hoa' } },
  { id: 'tl-3', event_type: 'triage_completed', note: 'ESI 2 · cần bác sĩ ngay', created_at: minutesAgo(4), actor: { full_name: 'ĐD Hoa' } },
];

const DEMO_ESCALATIONS = [
  { id: 'esc-1', case: DEMO_CASES[0], case_id: 'demo-ec-1', case_code: DEMO_CASES[0].case_code, patient: DEMO_CASES[0].patient, priority: 'critical', case_status: 'created', reason: 'not_acknowledged_after_5_minutes', level: 2, status: 'open', overdue_seconds: 75, owner: null, department: { department_name: 'Cấp cứu' }, triggered_at: minutesAgo(2) },
];

const DEMO_TEAMS = [
  { team_code: 'ERT-01', name: 'Đội phản ứng nhanh 1', status: 'available', eta_minutes: 3, equipment: ['Oxy', 'Màn hình theo dõi', 'Cáng'] },
  { team_code: 'ERT-02', name: 'Đội cấp cứu nội viện', status: 'busy', eta_minutes: 8, equipment: ['Máy sốc điện', 'Xe cấp cứu'] },
  { team_code: 'ICU-LIAISON', name: 'Liên lạc ICU', status: 'available', eta_minutes: 5, equipment: ['Màn hình theo dõi', 'Bàn giao máy thở'] },
];

const labelPriority = { critical: 'Nguy kịch', urgent: 'Khẩn' };
const labelStatus = {
  created: 'Chờ nhận',
  acknowledged: 'Đã nhận',
  triaged: 'Đã phân loại',
  dispatched: 'Đã điều phối',
  resolved: 'Đã xử lý',
  cancelled: 'Đã hủy',
  false_alarm: 'Báo động giả',
};
const labelType = {
  sos: 'SOS',
  medical_emergency: 'Cấp cứu y khoa',
  panic: 'Hoảng loạn',
  fall: 'Té ngã',
  other: 'Khác',
};

const labelSource = {
  inpatient: 'Nội trú',
  staff_created: 'Nhân viên tạo',
  patient_app: 'Ứng dụng bệnh nhân',
  relative_app: 'Ứng dụng người nhà',
  device: 'Thiết bị',
  system: 'Hệ thống',
};

const labelEvent = {
  created: 'Đã tạo ca',
  acknowledged: 'Đã tiếp nhận',
  triage_completed: 'Đã phân loại',
  dispatched: 'Đã điều phối',
  resolved: 'Đã xử lý',
  escalated: 'Đã báo khẩn',
};

const labelEscalationReason = {
  not_acknowledged_after_5_minutes: 'Chưa tiếp nhận sau 5 phút',
  sla_breached: 'Quá SLA',
  priority_escalated: 'Tăng mức ưu tiên',
  manual_escalation: 'Báo khẩn thủ công',
};
const labelSla = {
  on_time: 'Đúng hạn',
  at_risk: 'Sắp quá hạn',
  breached: 'Quá SLA',
  escalated: 'Đã báo khẩn',
  recovered: 'Đã phục hồi',
  closed: 'Đã đóng',
};

const teamStatusLabels = {
  available: 'Sẵn sàng',
  busy: 'Đang bận',
  offline: 'Ngoài tuyến',
};

const dispatchStepLabels = {
  team_assigned: 'Đã phân đội',
  team_notified: 'Đã báo đội',
  en_route: 'Đang di chuyển',
  arrived_at_scene: 'Đã đến hiện trường',
  transporting: 'Đang chuyển bệnh nhân',
  arrived_er: 'Đã đến khu cấp cứu',
  handover_to_doctor: 'Bàn giao bác sĩ',
};

function itemId(item) {
  return item?.case_id || item?.id || item?._id;
}

function casePatient(item = {}) {
  return item.patient || item.patient_id || {};
}

function patientName(item = {}) {
  return item.patient_name || casePatient(item).patient_name || casePatient(item).full_name || 'Chưa rõ bệnh nhân';
}

function patientCode(item = {}) {
  return item.patient_code || casePatient(item).patient_code || 'Chưa có mã';
}

function patientAgeGender(item = {}) {
  const patient = casePatient(item);
  const gender = patient.gender === 'male' ? 'Nam' : patient.gender === 'female' ? 'Nữ' : 'Khác';
  return [gender, patient.age ? `${patient.age}T` : null, patient.phone].filter(Boolean).join(' · ');
}

function formatClock(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function elapsedText(value) {
  if (!value) return '--';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút`;
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}

function secondsText(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return 'Chưa đặt';
  const absolute = Math.abs(Number(seconds));
  const minutes = Math.floor(absolute / 60);
  const rest = absolute % 60;
  const value = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  if (seconds < 0) return `quá ${value}`;
  return `còn ${value}`;
}

function listFromPayload(payload, key = 'items') {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function normalizeEmergencyCase(item = {}) {
  const riskFromSnapshot = [
    ...(item.metadata?.patient_risk_snapshot?.allergies || []).map((entry) => `Dị ứng ${entry.allergen || ''}`.trim()),
    ...(item.metadata?.patient_risk_snapshot?.chronic_problems || []).map((entry) => entry.problem_name || entry.name).filter(Boolean),
  ];
  return {
    ...item,
    id: itemId(item),
    case_id: itemId(item),
    patient: casePatient(item),
    risk_flags: [...new Set([...(item.risk_flags || []), ...riskFromSnapshot].filter(Boolean))],
    sla: item.sla || {
      status: item.escalated_at ? 'escalated' : item.sla_breached_at ? 'breached' : 'on_time',
      next_due_seconds: null,
      created_minutes: null,
    },
  };
}

function applyCaseFilters(items, filters) {
  const query = String(filters.search || '').trim().toLowerCase();
  return items.filter((item) => {
    if (filters.priority !== 'all' && item.priority !== filters.priority) return false;
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.sla !== 'all' && item.sla?.status !== filters.sla) return false;
    if (filters.risk === 'allergy' && !item.risk_flags.some((flag) => flag.toLowerCase().includes('dị ứng'))) return false;
    if (filters.risk === 'chronic' && !item.risk_flags.some((flag) => ['copd', 'bệnh', 'đái tháo', 'tim'].some((key) => flag.toLowerCase().includes(key)))) return false;
    if (filters.risk === 'gps' && !(item.location_lat && item.location_lng)) return false;
    if (filters.assignment === 'unassigned' && item.assigned_to?.user_id) return false;
    if (!query) return true;
    return `${item.case_code} ${patientName(item)} ${patientCode(item)} ${item.location_text || ''} ${item.symptoms || ''} ${item.note || ''}`.toLowerCase().includes(query);
  });
}

function getKpis(items, summary = {}) {
  return [
    { key: 'open', label: 'Ca đang mở', value: summary.open ?? items.length, tone: 'blue', icon: ShieldAlert, filter: { status: 'all', sla: 'all', priority: 'all' } },
    { key: 'critical', label: 'Nguy kịch', value: summary.critical ?? items.filter((item) => item.priority === 'critical').length, tone: 'red', icon: AlertTriangle, filter: { priority: 'critical' } },
    { key: 'urgent', label: 'Khẩn', value: summary.urgent ?? items.filter((item) => item.priority === 'urgent').length, tone: 'amber', icon: Clock3, filter: { priority: 'urgent' } },
    { key: 'unassigned', label: 'Chưa nhận', value: summary.unassigned ?? items.filter((item) => !item.assigned_to?.user_id && !item.assigned_to?.full_name).length, tone: 'slate', icon: Users, filter: { assignment: 'unassigned' } },
    { key: 'triaged', label: 'Đã phân loại', value: summary.triaged ?? items.filter((item) => item.status === 'triaged').length, tone: 'green', icon: ClipboardCheck, filter: { status: 'triaged' } },
    { key: 'breached', label: 'Quá SLA', value: summary.breached ?? items.filter((item) => item.sla?.status === 'breached').length, tone: 'rose', icon: Zap, filter: { sla: 'breached' } },
  ];
}

function PriorityBadge({ value }) {
  const normalized = value || 'urgent';
  return <span className={`nurse-em-badge nurse-em-badge--${normalized}`}>{labelPriority[normalized] || normalized}</span>;
}

function StatusBadge({ value }) {
  const normalized = value || 'created';
  return <span className={`nurse-em-status nurse-em-status--${normalized}`}>{labelStatus[normalized] || normalized}</span>;
}

function SlaTimer({ item }) {
  const status = item?.sla?.status || 'on_time';
  return (
    <span className={`nurse-em-sla nurse-em-sla--${status}`}>
      <Clock3 size={14} />
      <strong>{labelSla[status] || status}</strong>
      <small>{secondsText(item?.sla?.next_due_seconds)}</small>
    </span>
  );
}

function RiskChips({ item, limit = 5 }) {
  const flags = (item?.risk_flags || []).filter(Boolean);
  if (!flags.length) return <span className="nurse-em-muted">Chưa có dấu hiệu nguy cơ</span>;
  return (
    <div className="nurse-em-risk-chips">
      {flags.slice(0, limit).map((flag) => <span key={flag}>{flag}</span>)}
      {flags.length > limit ? <em>+{flags.length - limit}</em> : null}
    </div>
  );
}

function VitalStrip({ vital }) {
  if (!vital) return <span className="nurse-em-muted">Chưa có sinh hiệu</span>;
  const bp = vital.systolic_bp && vital.diastolic_bp ? `${vital.systolic_bp}/${vital.diastolic_bp}` : '--';
  return (
    <div className="nurse-em-vitals">
      <span>SpO2 <strong>{vital.spo2 ?? '--'}</strong></span>
      <span>Mạch <strong>{vital.heart_rate ?? '--'}</strong></span>
      <span>HA <strong>{bp}</strong></span>
      <span>Nhịp thở <strong>{vital.respiratory_rate ?? '--'}</strong></span>
      <span>Nhiệt <strong>{vital.temperature ?? '--'}</strong></span>
    </div>
  );
}

function CommandHeader({ title, subtitle, loading, demo, onRefresh, onCreate, meta }) {
  return (
    <section className="nurse-em-header">
      <div>
        <span className={demo ? 'nurse-em-live nurse-em-live--demo' : 'nurse-em-live'}>
          <Wifi size={15} />
          {demo ? 'Dữ liệu mẫu' : 'Điều phối thời gian thực'}
        </span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div className="nurse-em-header__meta">
          {(meta || ['role:nurse', 'department:emergency', 'emergency:{caseId}']).map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
      <aside>
        <button type="button" onClick={onRefresh}>
          {loading ? <Loader2 className="is-spinning" size={16} /> : <RefreshCw size={16} />}
          Làm mới
        </button>
        {onCreate ? (
          <button type="button" className="nurse-em-primary" onClick={onCreate}>
            <Plus size={16} />
            Tạo ca
          </button>
        ) : null}
      </aside>
    </section>
  );
}

function KpiStrip({ items, onPick }) {
  return (
    <section className="nurse-em-kpis">
      {items.map(({ key, label, value, tone, icon: Icon, filter }) => (
        <button key={key || label} type="button" className={`nurse-em-kpi nurse-em-kpi--${tone || 'blue'}`} onClick={() => onPick?.(filter || {})}>
          <Icon size={19} />
          <span>{label}</span>
          <strong>{value}</strong>
        </button>
      ))}
    </section>
  );
}

function FilterBar({ filters, setFilters, compact = false }) {
  const options = {
    priority: [['all', 'Tất cả'], ['critical', 'Nguy kịch'], ['urgent', 'Khẩn']],
    status: [['all', 'Tất cả'], ['created', 'Mới tạo'], ['acknowledged', 'Đã tiếp nhận'], ['triaged', 'Đã phân loại'], ['dispatched', 'Đã điều phối'], ['resolved', 'Đã xử lý'], ['cancelled', 'Đã hủy'], ['false_alarm', 'Báo động giả']],
    type: [['all', 'Tất cả'], ['sos', 'SOS'], ['medical_emergency', 'Cấp cứu y khoa'], ['panic', 'Hoảng loạn'], ['fall', 'Té ngã'], ['other', 'Khác']],
    risk: [['all', 'Tất cả'], ['allergy', 'Có dị ứng'], ['chronic', 'Bệnh nền'], ['gps', 'Có GPS']],
    sla: [['all', 'Tất cả'], ['on_time', 'Đúng hạn'], ['at_risk', 'Sắp quá hạn'], ['breached', 'Quá hạn'], ['escalated', 'Đã báo khẩn']],
    assignment: [['all', 'Tất cả'], ['unassigned', 'Chưa phân công']],
  };
  const fields = compact ? ['priority', 'status', 'sla'] : ['priority', 'status', 'type', 'risk', 'assignment', 'sla'];
  return (
    <section className="nurse-em-filters">
      <label className="nurse-em-search">
        <span>Tìm kiếm</span>
        <div>
          <Search size={15} />
          <input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Mã ca, bệnh nhân, vị trí, triệu chứng"
          />
        </div>
      </label>
      {fields.map((field) => (
        <label key={field}>
          <span>{field === 'sla' ? 'SLA' : field === 'priority' ? 'Ưu tiên' : field === 'status' ? 'Trạng thái' : field === 'type' ? 'Loại ca' : field === 'risk' ? 'Nguy cơ' : field === 'assignment' ? 'Phân công' : field}</span>
          <select value={filters[field]} onChange={(event) => setFilters((current) => ({ ...current, [field]: event.target.value }))}>
            {options[field].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      ))}
    </section>
  );
}

function CaseCard({ item, active, onSelect, onAction }) {
  return (
    <button type="button" className={`nurse-em-case-card${active ? ' is-active' : ''}`} onClick={() => onSelect(item)}>
      <header>
        <PriorityBadge value={item.priority} />
        <StatusBadge value={item.status} />
        <SlaTimer item={item} />
      </header>
      <strong>{item.case_code}</strong>
      <span>{patientName(item)} · {patientCode(item)} · {patientAgeGender(item)}</span>
      <p>{item.symptoms || 'Chưa ghi triệu chứng'}</p>
      <div className="nurse-em-case-card__meta">
        <small><MapPin size={13} />{item.location_text || 'Chưa có vị trí'}</small>
        <small><Clock3 size={13} />{elapsedText(item.created_at)}</small>
      </div>
      <RiskChips item={item} limit={4} />
      <footer onClick={(event) => event.stopPropagation()}>
        <button type="button" title="Nhận ca" onClick={() => onAction('acknowledge', item)}><UserCheck size={14} /></button>
        <button type="button" title="Phân loại" onClick={() => onAction('triage', item)}><ClipboardPlus size={14} /></button>
        <button type="button" title="Báo bác sĩ" onClick={() => onAction('notify', item)}><Send size={14} /></button>
        <button type="button" title="Điều phối đội" onClick={() => onAction('dispatch', item)}><Navigation size={14} /></button>
      </footer>
    </button>
  );
}

function CaseList({ items, selected, setSelected, onAction }) {
  return (
    <aside className="nurse-em-case-list">
      <header>
        <strong>Danh sách ca thời gian thực</strong>
        <span>{items.length} ca</span>
      </header>
      <div>
        {items.map((item) => (
          <CaseCard
            key={itemId(item)}
            item={item}
            active={itemId(selected) === itemId(item)}
            onSelect={setSelected}
            onAction={onAction}
          />
        ))}
      </div>
    </aside>
  );
}

function ClinicalSnapshot({ item }) {
  const snapshot = item?.metadata?.patient_risk_snapshot || {};
  const allergies = snapshot.allergies || [];
  const problems = snapshot.chronic_problems || snapshot.problems || [];
  return (
    <section className="nurse-em-snapshot">
      <h3><HeartPulse size={16} /> Lâm sàng</h3>
      <VitalStrip vital={item?.latest_vital} />
      <div className="nurse-em-risk-grid">
        <article>
          <span>Dị ứng</span>
          <strong>{allergies.length || 0}</strong>
          <small>{allergies[0]?.allergen || 'Chưa ghi nhận'}</small>
        </article>
        <article>
          <span>Bệnh nền</span>
          <strong>{problems.length || 0}</strong>
          <small>{problems[0]?.problem_name || problems[0]?.name || 'Chưa ghi nhận'}</small>
        </article>
        <article>
          <span>ESI</span>
          <strong>{item?.esi_level || item?.metadata?.triage_summary?.esi_level || '--'}</strong>
          <small>{item?.triage_color || item?.metadata?.triage_summary?.triage_color || 'Chưa triage'}</small>
        </article>
      </div>
    </section>
  );
}

function LocationPanel({ item }) {
  return (
    <section className="nurse-em-location">
      <h3><MapPin size={16} /> Vị trí</h3>
      <div className="nurse-em-map">
        <span />
        <MapPin size={24} />
        <strong>{item?.location_text || 'Chưa có vị trí'}</strong>
        <small>{item?.location_lat && item?.location_lng ? `${item.location_lat}, ${item.location_lng}` : 'Chưa có GPS'}</small>
      </div>
    </section>
  );
}

function TimelinePanel({ items }) {
  const events = items?.length ? items : DEMO_TIMELINE;
  return (
    <section className="nurse-em-timeline">
      <h3><Activity size={16} /> Dòng thời gian</h3>
      {events.slice(0, 8).map((event) => (
        <article key={event.id || `${event.event_type}-${event.created_at}`}>
          <span>{formatClock(event.created_at)}</span>
          <div>
            <strong>{labelEvent[event.event_type] || event.event_type}</strong>
            <small>{event.note || event.description || event.title || 'Cập nhật ca'}</small>
          </div>
          <em>{event.actor?.full_name || event.actor?.employee_code || 'Hệ thống'}</em>
        </article>
      ))}
    </section>
  );
}

function CaseDetail({ item, timeline, activeTab, setActiveTab }) {
  if (!item) return <main className="nurse-em-detail nurse-em-empty">Chưa chọn ca cấp cứu.</main>;
  const tabs = ['Tổng quan', 'Lâm sàng', 'Phân loại', 'Sinh hiệu', 'Dòng thời gian', 'Giao tiếp'];
  return (
    <main className="nurse-em-detail">
      <header>
        <div>
          <PriorityBadge value={item.priority} />
          <StatusBadge value={item.status} />
          <SlaTimer item={item} />
        </div>
        <h2>{item.case_code}</h2>
        <p>{patientName(item)} · {patientCode(item)} · {item.location_text || 'Chưa có vị trí'}</p>
      </header>
      <nav className="nurse-em-tabs">
        {tabs.map((tab) => <button key={tab} type="button" className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>
      {activeTab === 'Tổng quan' ? (
        <section className="nurse-em-overview">
          <dl>
            <div><dt>Loại ca</dt><dd>{labelType[item.type] || item.type || '--'}</dd></div>
            <div><dt>Nguồn</dt><dd>{labelSource[item.source] || item.source || '--'}</dd></div>
            <div><dt>Thời điểm tạo</dt><dd>{formatDateTime(item.created_at)}</dd></div>
            <div><dt>Tiếp nhận</dt><dd>{formatDateTime(item.acknowledged_at)}</dd></div>
            <div><dt>Phân loại</dt><dd>{formatDateTime(item.triaged_at)}</dd></div>
            <div><dt>Điều phối</dt><dd>{formatDateTime(item.dispatched_at)}</dd></div>
            <div><dt>Điều dưỡng</dt><dd>{item.assigned_to?.full_name || item.primary_nurse?.full_name || 'Chưa phân công'}</dd></div>
            <div><dt>Khoa</dt><dd>{item.assigned_department?.department_name || '--'}</dd></div>
            <div><dt>Lượt khám</dt><dd>{item.related_encounter_id || '--'}</dd></div>
            <div><dt>Lịch hẹn</dt><dd>{item.related_appointment_id || '--'}</dd></div>
          </dl>
          <article>
            <h3>Triệu chứng</h3>
            <p>{item.symptoms || 'Chưa ghi nhận triệu chứng.'}</p>
            <h3>Ghi chú</h3>
            <p>{item.note || 'Chưa có ghi chú.'}</p>
          </article>
        </section>
      ) : null}
      {activeTab === 'Lâm sàng' ? <ClinicalSnapshot item={item} /> : null}
      {activeTab === 'Phân loại' ? <TriageSummary item={item} /> : null}
      {activeTab === 'Sinh hiệu' ? <VitalStrip vital={item.latest_vital} /> : null}
      {activeTab === 'Dòng thời gian' ? <TimelinePanel items={timeline} /> : null}
      {activeTab === 'Giao tiếp' ? <CommunicationPanel item={item} /> : null}
    </main>
  );
}

function TriageSummary({ item }) {
  const summary = item?.metadata?.triage_summary || {};
  return (
    <section className="nurse-em-triage-summary">
      {[
        ['ESI', item?.esi_level || summary.esi_level || '--'],
        ['Màu phân loại', item?.triage_color || summary.triage_color || '--'],
        ['Ưu tiên cuối', labelPriority[summary.final_priority || item?.priority] || summary.final_priority || item?.priority || '--'],
        ['Cần bác sĩ', summary.doctor_required ? 'Có' : 'Chưa'],
        ['Cần điều phối', summary.dispatch_required ? 'Có' : 'Chưa'],
      ].map(([label, value]) => (
        <article key={label}><span>{label}</span><strong>{value}</strong></article>
      ))}
      <RiskChips item={{ risk_flags: summary.risk_flags || item?.risk_flags || [] }} limit={8} />
    </section>
  );
}

function CommunicationPanel({ item }) {
  return (
    <section className="nurse-em-comms">
      <article><BellRing size={16} /><span>Đã báo bác sĩ</span><strong>{formatDateTime(item?.doctor_notified_at)}</strong></article>
      <article><CheckCircle2 size={16} /><span>Bác sĩ đã xác nhận</span><strong>{formatDateTime(item?.doctor_acknowledged_at)}</strong></article>
      <article><MessageSquarePlus size={16} /><span>Trao đổi</span><strong>{item?.metadata?.conversation_id || 'Chưa tạo'}</strong></article>
    </section>
  );
}

function ActionPanel({ item, onAction }) {
  if (!item) return null;
  const groups = [
    ['Nhận xử lý', [['acknowledge', 'Nhận ca', UserCheck], ['assign', 'Gán cho tôi', Users], ['notify', 'Báo bác sĩ', Send]]],
    ['Phân loại', [['triage-start', 'Bắt đầu phân loại', ClipboardPlus], ['critical', 'Nâng nguy kịch', AlertTriangle], ['vital', 'Sinh hiệu nhanh', HeartPulse]]],
    ['Điều phối', [['dispatch', 'Điều phối đội', Navigation], ['escalate', 'Báo khẩn', Zap], ['queue', 'Hàng đợi ưu tiên', Route]]],
    ['Kết thúc', [['resolve', 'Hoàn tất', CheckCircle2], ['cancel', 'Hủy ca', X]]],
  ];
  return (
    <aside className="nurse-em-action-panel">
      <ClinicalSnapshot item={item} />
      <LocationPanel item={item} />
      {groups.map(([title, actions]) => (
        <section key={title}>
          <h3>{title}</h3>
          <div>
            {actions.map(([key, label, Icon]) => (
              <button key={key} type="button" onClick={() => onAction(key, item)}>
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}

function CreateCaseModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ patient_id: '', type: 'medical_emergency', priority: 'urgent', location_text: '', symptoms: '', note: '', source: 'staff_created' });
  if (!open) return null;
  return (
    <div className="nurse-em-modal-backdrop">
      <form className="nurse-em-modal" onSubmit={(event) => { event.preventDefault(); onCreate(form); }}>
        <header>
          <div><ShieldAlert size={20} /><strong>Tạo ca cấp cứu</strong></div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>
        <label><span>Mã bệnh nhân</span><input value={form.patient_id} onChange={(event) => setForm((current) => ({ ...current, patient_id: event.target.value }))} required /></label>
        <div className="nurse-em-form-row">
          <label><span>Loại ca</span><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}><option value="medical_emergency">Cấp cứu y khoa</option><option value="fall">Té ngã</option><option value="panic">Hoảng loạn</option><option value="other">Khác</option></select></label>
          <label><span>Ưu tiên</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="urgent">Khẩn</option><option value="critical">Nguy kịch</option></select></label>
        </div>
        <label><span>Vị trí</span><input value={form.location_text} onChange={(event) => setForm((current) => ({ ...current, location_text: event.target.value }))} /></label>
        <label><span>Triệu chứng</span><textarea value={form.symptoms} onChange={(event) => setForm((current) => ({ ...current, symptoms: event.target.value }))} /></label>
        <label><span>Ghi chú</span><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></label>
        <footer>
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit" className="nurse-em-primary"><Plus size={15} /> Tạo ca</button>
        </footer>
      </form>
    </div>
  );
}

function useEmergencyOpenData() {
  const [state, setState] = useState({ items: DEMO_CASES, summary: {}, loading: true, demo: true, error: null });
  async function load() {
    setState((current) => ({ ...current, loading: true }));
    try {
      const [summary, cases] = await Promise.all([
        nurseMonitoringApi.getEmergencyOpenSummary(),
        nurseMonitoringApi.getEmergencyOpenCases({ limit: 200 }),
      ]);
      setState({
        items: listFromPayload(cases).map(normalizeEmergencyCase),
        summary: summary?.counters || summary?.summary || {},
        loading: false,
        demo: false,
        error: null,
      });
    } catch (error) {
      setState({ items: DEMO_CASES.map(normalizeEmergencyCase), summary: {}, loading: false, demo: true, error });
    }
  }
  useEffect(() => { load(); }, []);
  return { ...state, refresh: load };
}

function useTimeline(caseId, enabled) {
  const [timeline, setTimeline] = useState([]);
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!caseId || !enabled || String(caseId).startsWith('demo')) {
        setTimeline(DEMO_TIMELINE);
        return;
      }
      try {
        const payload = await nurseMonitoringApi.getEmergencyTimeline(caseId);
        if (alive) setTimeline(listFromPayload(payload));
      } catch {
        if (alive) setTimeline(DEMO_TIMELINE);
      }
    }
    load();
    return () => { alive = false; };
  }, [caseId, enabled]);
  return timeline;
}

function useEmergencyAction(refresh, setToast) {
  return async function runAction(action, item, payload = {}) {
    if (!item) return;
    const caseId = itemId(item);
    if (String(caseId).startsWith('demo')) {
      setToast(`${action} · ${item.case_code}`);
      return;
    }
    try {
      if (action === 'acknowledge' || action === 'assign') await nurseMonitoringApi.acknowledgeEmergency(caseId, payload);
      else if (action === 'triage' || action === 'triage-start') await nurseMonitoringApi.startEmergencyTriage(caseId, payload);
      else if (action === 'dispatch') await nurseMonitoringApi.dispatchEmergency(caseId, payload);
      else if (action === 'escalate') await nurseMonitoringApi.escalateEmergency(caseId, payload);
      else if (action === 'notify') await nurseMonitoringApi.notifyEmergencyDoctor(caseId, payload);
      else if (action === 'critical') await nurseMonitoringApi.updateEmergencyPriority(caseId, { priority: 'critical', reason: 'nurse_command_center' });
      else if (action === 'resolve') await nurseMonitoringApi.resolveEmergency(caseId, payload);
      else if (action === 'cancel') await nurseMonitoringApi.cancelEmergency(caseId, payload);
      setToast(`${labelStatus[action] || action} · ${item.case_code}`);
      await refresh();
    } catch (error) {
      setToast(error?.message || 'Không thể thao tác ca cấp cứu.');
    }
  };
}

function Toast({ value, onClose }) {
  if (!value) return null;
  return (
    <div className="nurse-em-toast">
      <span>{value}</span>
      <button type="button" onClick={onClose} aria-label="Đóng"><X size={14} /></button>
    </div>
  );
}

export function EmergencyOpenCasesPage() {
  const { items, summary, loading, demo, refresh } = useEmergencyOpenData();
  const [filters, setFilters] = useState({ search: '', priority: 'all', status: 'all', type: 'all', risk: 'all', assignment: 'all', sla: 'all' });
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('Tổng quan');
  const [toast, setToast] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const filtered = useMemo(() => applyCaseFilters(items, filters), [items, filters]);
  const selected = filtered.find((item) => itemId(item) === selectedId) || filtered[0] || items[0];
  const timeline = useTimeline(itemId(selected), Boolean(selected));
  const runAction = useEmergencyAction(refresh, setToast);

  useEffect(() => {
    if (!selectedId && filtered[0]) setSelectedId(itemId(filtered[0]));
  }, [filtered, selectedId]);

  async function handleCreate(form) {
    try {
      await nurseMonitoringApi.createEmergencyCase(form);
      setCreateOpen(false);
      setToast('Đã tạo ca cấp cứu');
      refresh();
    } catch (error) {
      setToast(error?.message || 'Không thể tạo ca cấp cứu.');
    }
  }

  return (
    <section className="nurse-em-page">
      <CommandHeader
        title="Trung tâm điều phối cấp cứu"
        subtitle="Ca đang mở, phân loại, điều phối, SLA, rủi ro lâm sàng và thao tác tiếp theo trong một màn hình."
        loading={loading}
        demo={demo}
        onRefresh={refresh}
        onCreate={() => setCreateOpen(true)}
      />
      <KpiStrip items={getKpis(items, summary)} onPick={(patch) => setFilters((current) => ({ ...current, ...patch }))} />
      <FilterBar filters={filters} setFilters={setFilters} />
      <section className="nurse-em-command-grid">
        <CaseList items={filtered} selected={selected} setSelected={(item) => setSelectedId(itemId(item))} onAction={runAction} />
        <CaseDetail item={selected} timeline={timeline} activeTab={activeTab} setActiveTab={setActiveTab} />
        <ActionPanel item={selected} onAction={runAction} />
      </section>
      <TimelinePanel items={timeline} />
      <CreateCaseModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />
      <Toast value={toast} onClose={() => setToast('')} />
    </section>
  );
}

function TriageForm({ selected, onComplete }) {
  const [form, setForm] = useState({
    chief_complaint: selected?.symptoms || '',
    airway_status: 'clear',
    breathing_status: 'normal',
    circulation_status: 'stable',
    disability_status: 'alert',
    exposure_status: 'none',
    pain_score: '',
    gcs_eye: 4,
    gcs_verbal: 5,
    gcs_motor: 6,
    avpu: 'alert',
    esi_level: 3,
    triage_color: 'yellow',
    final_priority: selected?.priority || 'urgent',
    doctor_required: false,
    dispatch_required: false,
    stat_lab_required: false,
    stat_imaging_required: false,
    admission_required: false,
    note: '',
  });

  useEffect(() => {
    setForm((current) => ({ ...current, chief_complaint: selected?.symptoms || current.chief_complaint, final_priority: selected?.priority || current.final_priority }));
  }, [selected]);

  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <form className="nurse-em-triage-form" onSubmit={(event) => { event.preventDefault(); onComplete(form); }}>
      <header>
        <ClipboardPlus size={18} />
        <div><strong>ABCDE + ESI</strong><span>{selected?.case_code || 'Chưa chọn ca'}</span></div>
      </header>
      <label><span>Lý do cấp cứu chính</span><textarea value={form.chief_complaint} onChange={set('chief_complaint')} /></label>
      <div className="nurse-em-abcde-grid">
        {[
          ['airway_status', 'Đường thở', [['clear', 'Thông thoáng'], ['obstructed', 'Tắc nghẽn'], ['needs_suction', 'Cần hút đờm'], ['needs_airway_support', 'Cần hỗ trợ đường thở']]],
          ['breathing_status', 'Hô hấp', [['normal', 'Bình thường'], ['dyspnea', 'Khó thở'], ['wheezing', 'Khò khè'], ['cyanosis', 'Tím tái'], ['apnea', 'Ngừng thở']]],
          ['circulation_status', 'Tuần hoàn', [['stable', 'Ổn định'], ['shock_signs', 'Dấu hiệu sốc'], ['bleeding', 'Chảy máu'], ['chest_pain', 'Đau ngực'], ['weak_pulse', 'Mạch yếu']]],
          ['disability_status', 'Thần kinh', [['alert', 'Tỉnh'], ['confused', 'Lú lẫn'], ['seizure', 'Co giật'], ['unconscious', 'Hôn mê']]],
          ['exposure_status', 'Toàn thân', [['none', 'Không ghi nhận'], ['trauma', 'Chấn thương'], ['burn', 'Bỏng'], ['rash', 'Phát ban'], ['hypothermia', 'Hạ thân nhiệt'], ['fever', 'Sốt']]],
        ].map(([field, label, values]) => (
          <label key={field}><span>{label}</span><select value={form[field]} onChange={set(field)}>{values.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}</select></label>
        ))}
      </div>
      <div className="nurse-em-form-row">
        <label><span>Đau</span><input type="number" min="0" max="10" value={form.pain_score} onChange={set('pain_score')} /></label>
        <label><span>GCS mở mắt</span><input type="number" min="1" max="4" value={form.gcs_eye} onChange={set('gcs_eye')} /></label>
        <label><span>GCS lời nói</span><input type="number" min="1" max="5" value={form.gcs_verbal} onChange={set('gcs_verbal')} /></label>
        <label><span>GCS vận động</span><input type="number" min="1" max="6" value={form.gcs_motor} onChange={set('gcs_motor')} /></label>
        <label><span>AVPU</span><select value={form.avpu} onChange={set('avpu')}><option value="alert">Tỉnh</option><option value="voice">Đáp ứng lời gọi</option><option value="pain">Đáp ứng đau</option><option value="unresponsive">Không đáp ứng</option></select></label>
      </div>
      <div className="nurse-em-form-row">
        <label><span>ESI</span><select value={form.esi_level} onChange={set('esi_level')}><option value="1">1 - Hồi sức ngay</option><option value="2">2 - Cấp cứu</option><option value="3">3 - Khẩn</option><option value="4">4 - Ít khẩn hơn</option><option value="5">5 - Không khẩn</option></select></label>
        <label><span>Màu</span><select value={form.triage_color} onChange={set('triage_color')}><option value="red">Đỏ</option><option value="orange">Cam</option><option value="yellow">Vàng</option><option value="green">Xanh</option><option value="white">Trắng</option></select></label>
        <label><span>Ưu tiên</span><select value={form.final_priority} onChange={set('final_priority')}><option value="urgent">Khẩn</option><option value="critical">Nguy kịch</option></select></label>
      </div>
      <div className="nurse-em-decision-grid">
        {[
          ['doctor_required', 'Cần bác sĩ ngay'],
          ['dispatch_required', 'Cần điều phối'],
          ['stat_lab_required', 'Xét nghiệm STAT'],
          ['stat_imaging_required', 'CĐHA STAT'],
          ['admission_required', 'Cần nhập viện'],
        ].map(([field, label]) => (
          <label key={field}><input type="checkbox" checked={form[field]} onChange={set(field)} /><span>{label}</span></label>
        ))}
      </div>
      <label><span>Kết luận</span><textarea value={form.note} onChange={set('note')} /></label>
      <footer>
        <button type="button"><FileText size={15} /> Lưu nháp</button>
        <button type="submit" className="nurse-em-primary"><CheckCircle2 size={15} /> Hoàn tất phân loại</button>
      </footer>
    </form>
  );
}

export function EmergencyTriagePage() {
  const [state, setState] = useState({ items: DEMO_CASES, summary: {}, loading: true, demo: true });
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');
  async function load() {
    setState((current) => ({ ...current, loading: true }));
    try {
      const payload = await nurseMonitoringApi.getEmergencyTriageQueue({ limit: 120 });
      setState({ items: listFromPayload(payload).map(normalizeEmergencyCase), summary: payload.summary || {}, loading: false, demo: false });
    } catch {
      setState({ items: DEMO_CASES.map(normalizeEmergencyCase), summary: {}, loading: false, demo: true });
    }
  }
  useEffect(() => { load(); }, []);
  const selected = state.items.find((item) => itemId(item) === selectedId) || state.items[0];
  const runAction = useEmergencyAction(load, setToast);

  async function completeTriage(form) {
    if (!selected) return;
    if (String(itemId(selected)).startsWith('demo')) {
      setToast(`Hoàn tất phân loại · ${selected.case_code}`);
      return;
    }
    await nurseMonitoringApi.completeEmergencyTriage(itemId(selected), {
      ...form,
      risk_flags: selected.risk_flags || [],
      recommended_actions: [
        form.doctor_required ? 'notify_doctor' : null,
        form.dispatch_required ? 'dispatch_team' : null,
        form.stat_lab_required ? 'stat_lab' : null,
        form.stat_imaging_required ? 'stat_imaging' : null,
      ].filter(Boolean),
    });
    setToast(`Hoàn tất phân loại · ${selected.case_code}`);
    load();
  }

  return (
    <section className="nurse-em-page">
      <CommandHeader title="Phân loại cấp cứu" subtitle="ABCDE, sinh hiệu, ESI, bộ quy tắc nguy cơ và quyết định xử trí." loading={state.loading} demo={state.demo} onRefresh={load} />
      <KpiStrip items={[
        { key: 'waiting', label: 'Chờ phân loại', value: state.summary.waiting ?? state.items.filter((item) => item.status === 'created').length, tone: 'amber', icon: Clock3 },
        { key: 'progress', label: 'Đang phân loại', value: state.summary.in_progress ?? 0, tone: 'blue', icon: ClipboardPlus },
        { key: 'critical', label: 'Nguy kịch', value: state.summary.critical ?? state.items.filter((item) => item.priority === 'critical').length, tone: 'red', icon: AlertTriangle },
        { key: 'sos', label: 'SOS từ bệnh nhân', value: state.items.filter((item) => ['patient_app', 'relative_app'].includes(item.source)).length, tone: 'green', icon: PhoneCall },
      ]} />
      <section className="nurse-em-triage-layout">
        <CaseList items={state.items} selected={selected} setSelected={(item) => setSelectedId(itemId(item))} onAction={runAction} />
        <TriageForm selected={selected} onComplete={completeTriage} />
        <aside className="nurse-em-decision-panel">
          <ClinicalSnapshot item={selected} />
          <TriageSummary item={selected} />
          <section>
            <h3><Zap size={16} /> Thao tác</h3>
            <button type="button" onClick={() => runAction('notify', selected)}><Send size={15} /> Báo bác sĩ</button>
            <button type="button" onClick={() => runAction('dispatch', selected)}><Navigation size={15} /> Điều phối đội</button>
            <button type="button" onClick={() => runAction('critical', selected)}><AlertTriangle size={15} /> Nâng nguy kịch</button>
          </section>
        </aside>
      </section>
      <Toast value={toast} onClose={() => setToast('')} />
    </section>
  );
}

export function EmergencyResponseCoordinationPage() {
  const [state, setState] = useState({ cases: DEMO_CASES, teams: DEMO_TEAMS, summary: {}, loading: true, demo: true });
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');
  async function load() {
    setState((current) => ({ ...current, loading: true }));
    try {
      const payload = await nurseMonitoringApi.getEmergencyDispatchBoard({ limit: 160 });
      setState({ cases: listFromPayload(payload, 'cases').map(normalizeEmergencyCase), teams: payload.teams || DEMO_TEAMS, summary: payload.summary || {}, loading: false, demo: false });
    } catch {
      setState({ cases: DEMO_CASES.map(normalizeEmergencyCase), teams: DEMO_TEAMS, summary: {}, loading: false, demo: true });
    }
  }
  useEffect(() => { load(); }, []);
  const selected = state.cases.find((item) => itemId(item) === selectedId) || state.cases[0];
  const runAction = useEmergencyAction(load, setToast);
  return (
    <section className="nurse-em-page">
      <CommandHeader title="Điều phối phản ứng" subtitle="Bảng điều phối cho ca cần đội phản ứng, thời gian đến dự kiến, thiết bị, vận chuyển và bàn giao." loading={state.loading} demo={state.demo} onRefresh={load} />
      <KpiStrip items={[
        { key: 'need', label: 'Cần điều phối', value: state.summary.need_dispatch ?? state.cases.length, tone: 'red', icon: Navigation },
        { key: 'active', label: 'Đã điều phối', value: state.summary.dispatched ?? state.cases.filter((item) => item.status === 'dispatched').length, tone: 'blue', icon: Activity },
        { key: 'team', label: 'Đội rảnh', value: state.teams.filter((team) => team.status === 'available').length, tone: 'green', icon: Users },
        { key: 'transport', label: 'Đang vận chuyển', value: state.summary.transporting ?? 0, tone: 'amber', icon: Route },
      ]} />
      <section className="nurse-em-dispatch-layout">
        <CaseList items={state.cases} selected={selected} setSelected={(item) => setSelectedId(itemId(item))} onAction={runAction} />
        <main className="nurse-em-dispatch-board">
          <header>
            <div><PriorityBadge value={selected?.priority} /><StatusBadge value={selected?.status} /></div>
            <h2>{selected?.case_code || 'Bảng điều phối'}</h2>
            <p>{selected ? `${patientName(selected)} · ${selected.location_text || 'Chưa có vị trí'}` : 'Chưa chọn ca'}</p>
          </header>
          <div className="nurse-em-route-map">
            <span className="is-origin"><Crosshair size={20} />Cấp cứu</span>
            <i />
            <span className="is-destination"><MapPin size={20} />{selected?.location_text || 'Ca cấp cứu'}</span>
          </div>
          <section className="nurse-em-dispatch-steps">
            {['team_assigned', 'team_notified', 'en_route', 'arrived_at_scene', 'transporting', 'arrived_er', 'handover_to_doctor'].map((step, index) => (
              <article key={step} className={index < 2 ? 'is-done' : ''}>
                <span>{index + 1}</span>
                <strong>{dispatchStepLabels[step] || step}</strong>
                <small>{index < 2 ? 'Đã ghi nhận' : 'Chờ cập nhật'}</small>
              </article>
            ))}
          </section>
          <footer>
            <button type="button" className="nurse-em-primary" onClick={() => runAction('dispatch', selected)}><Navigation size={15} /> Điều phối đội</button>
            <button type="button" onClick={() => runAction('notify', selected)}><Send size={15} /> Gửi thông báo</button>
            <button type="button" onClick={() => runAction('resolve', selected)}><CheckCircle2 size={15} /> Hoàn tất</button>
          </footer>
        </main>
        <aside className="nurse-em-team-panel">
          <header><strong>Đội phản ứng</strong><span>{state.teams.length}</span></header>
          {state.teams.map((team) => (
            <article key={team.team_code} className={`nurse-em-team nurse-em-team--${team.status}`}>
              <div><strong>{team.name}</strong><span>{team.team_code} · dự kiến {team.eta_minutes} phút</span></div>
              <em>{teamStatusLabels[team.status] || team.status}</em>
              <div className="nurse-em-risk-chips">{(team.equipment || []).map((item) => <span key={item}>{item}</span>)}</div>
            </article>
          ))}
        </aside>
      </section>
      <Toast value={toast} onClose={() => setToast('')} />
    </section>
  );
}

export function EmergencyEscalationPage() {
  const [state, setState] = useState({ items: DEMO_ESCALATIONS, summary: {}, loading: true, demo: true });
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');
  async function load() {
    setState((current) => ({ ...current, loading: true }));
    try {
      const payload = await nurseMonitoringApi.getEmergencyEscalations({ limit: 160 });
      setState({ items: listFromPayload(payload).map((item) => ({ ...item, case: normalizeEmergencyCase(item.case || item) })), summary: payload.summary || {}, loading: false, demo: false });
    } catch {
      setState({ items: DEMO_ESCALATIONS, summary: {}, loading: false, demo: true });
    }
  }
  useEffect(() => { load(); }, []);
  const selected = state.items.find((item) => item.id === selectedId) || state.items[0];
  const runAction = useEmergencyAction(load, setToast);
  return (
    <section className="nurse-em-page">
      <CommandHeader title="Báo khẩn" subtitle="Ca quá SLA, chưa có người phụ trách, chậm phân loại/điều phối và bác sĩ chưa phản hồi." loading={state.loading} demo={state.demo} onRefresh={load} />
      <KpiStrip items={[
        { key: 'open', label: 'Báo khẩn đang mở', value: state.summary.open ?? state.items.length, tone: 'red', icon: AlertTriangle },
        { key: 'unack', label: 'Chưa tiếp nhận', value: state.summary.unacknowledged ?? 0, tone: 'amber', icon: Clock3 },
        { key: 'triage', label: 'Chậm phân loại', value: state.summary.triage_delay ?? 0, tone: 'blue', icon: ClipboardPlus },
        { key: 'owner', label: 'Nguy kịch chưa phụ trách', value: state.summary.critical_no_owner ?? 0, tone: 'rose', icon: Users },
      ]} />
      <section className="nurse-em-escalation-layout">
        <div className="nurse-em-table-wrap">
          <table className="nurse-em-table">
            <thead><tr><th>Ca</th><th>Bệnh nhân</th><th>Ưu tiên</th><th>Lý do</th><th>Quá hạn</th><th>Phụ trách</th><th>Thao tác</th></tr></thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={item.id} className={selected?.id === item.id ? 'is-active' : ''} onClick={() => setSelectedId(item.id)}>
                  <td><strong>{item.case_code}</strong><small>{labelStatus[item.case_status] || item.case_status}</small></td>
                  <td><strong>{item.patient?.patient_name || patientName(item.case)}</strong><small>{item.patient?.patient_code || patientCode(item.case)}</small></td>
                  <td><PriorityBadge value={item.priority} /></td>
                  <td>{labelEscalationReason[item.reason] || item.reason}</td>
                  <td>{secondsText(-Number(item.overdue_seconds || 0))}</td>
                  <td>{item.owner?.full_name || 'Chưa có'}</td>
                  <td><button type="button" onClick={(event) => { event.stopPropagation(); runAction('escalate', item.case); }}><Zap size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="nurse-em-escalation-detail">
          <header><AlertTriangle size={18} /><div><strong>{selected?.case_code || 'Báo khẩn'}</strong><span>Cấp {selected?.level || 1}</span></div></header>
          {selected ? <CaseDetail item={selected.case} timeline={DEMO_TIMELINE} activeTab="Tổng quan" setActiveTab={() => {}} /> : null}
          <section>
            <button type="button" className="nurse-em-primary" onClick={() => runAction('acknowledge', selected?.case)}><UserCheck size={15} /> Nhận xử lý</button>
            <button type="button" onClick={() => runAction('notify', selected?.case)}><PhoneCall size={15} /> Gọi bác sĩ trực</button>
            <button type="button" onClick={() => runAction('dispatch', selected?.case)}><Navigation size={15} /> Điều phối</button>
          </section>
        </aside>
      </section>
      <Toast value={toast} onClose={() => setToast('')} />
    </section>
  );
}

export function EmergencyResponseCommitmentPage() {
  const [state, setState] = useState({ items: DEMO_CASES, analytics: {}, summary: {}, loading: true, demo: true });
  async function load() {
    setState((current) => ({ ...current, loading: true }));
    try {
      const payload = await nurseMonitoringApi.getEmergencySlaBoard({ limit: 220 });
      setState({ items: listFromPayload(payload).map(normalizeEmergencyCase), analytics: payload.analytics || {}, summary: payload.summary || {}, loading: false, demo: false });
    } catch {
      setState({ items: DEMO_CASES.map(normalizeEmergencyCase), analytics: {}, summary: {}, loading: false, demo: true });
    }
  }
  useEffect(() => { load(); }, []);
  const bySla = state.analytics.by_sla || ['on_time', 'at_risk', 'breached', 'escalated'].map((status) => ({ label: status, value: state.items.filter((item) => item.sla?.status === status).length }));
  return (
    <section className="nurse-em-page">
      <CommandHeader title="Theo dõi SLA phản ứng" subtitle="Từ tạo ca đến tiếp nhận, phân loại, điều phối, phản hồi bác sĩ và tỷ lệ đóng ca đúng hạn." loading={state.loading} demo={state.demo} onRefresh={load} />
      <KpiStrip items={[
        { key: 'compliance', label: 'Đúng hạn %', value: `${state.summary.compliance_percent ?? 82}%`, tone: 'green', icon: CheckCircle2 },
        { key: 'median', label: 'Trung vị tiếp nhận', value: state.summary.median_acknowledge_seconds ? secondsText(state.summary.median_acknowledge_seconds).replace('còn ', '') : '--', tone: 'blue', icon: Clock3 },
        { key: 'risk', label: 'Sắp quá hạn', value: state.summary.at_risk ?? 0, tone: 'amber', icon: AlertTriangle },
        { key: 'breach', label: 'Quá hạn', value: state.summary.breached ?? state.items.filter((item) => item.sla?.status === 'breached').length, tone: 'red', icon: Zap },
      ]} />
      <section className="nurse-em-sla-layout">
        <main className="nurse-em-table-wrap">
          <table className="nurse-em-table">
            <thead><tr><th>Mã ca</th><th>Bệnh nhân</th><th>Ưu tiên</th><th>Trạng thái</th><th>Hạn tiếp nhận</th><th>Thực tế</th><th>Mốc quá hạn kế tiếp</th><th>SLA</th></tr></thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={itemId(item)}>
                  <td><strong>{item.case_code}</strong><small>{formatDateTime(item.created_at)}</small></td>
                  <td><strong>{patientName(item)}</strong><small>{patientCode(item)}</small></td>
                  <td><PriorityBadge value={item.priority} /></td>
                  <td><StatusBadge value={item.status} /></td>
                  <td>{formatDateTime(item.sla?.acknowledge_due_at)}</td>
                  <td>{formatDateTime(item.acknowledged_at)}</td>
                  <td>{secondsText(item.sla?.next_due_seconds)}</td>
                  <td><SlaTimer item={item} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
        <aside className="nurse-em-analytics">
          <header><Activity size={17} /><strong>Phân tích SLA</strong></header>
          {bySla.map((bar) => {
            const total = Math.max(1, bySla.reduce((sum, item) => sum + Number(item.value || 0), 0));
            return (
              <article key={bar.label}>
                <span>{labelSla[bar.label] || bar.label}</span>
                <strong>{bar.value}</strong>
                <em><i style={{ width: `${Math.round((Number(bar.value || 0) / total) * 100)}%` }} /></em>
              </article>
            );
          })}
        </aside>
      </section>
    </section>
  );
}

export function EmergencyClosedCasesPage() {
  const [state, setState] = useState({ items: DEMO_CASES.map((item) => ({ ...item, status: 'resolved', resolved_at: nowIso(), sla: { ...item.sla, status: 'closed' } })), loading: true, demo: true });
  const [filters, setFilters] = useState({ search: '', priority: 'all', status: 'all', type: 'all', risk: 'all', assignment: 'all', sla: 'all' });
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('Tổng quan');
  async function load() {
    setState((current) => ({ ...current, loading: true }));
    try {
      const payload = await nurseMonitoringApi.getEmergencyClosedCases({ limit: 180 });
      setState({ items: listFromPayload(payload).map(normalizeEmergencyCase), loading: false, demo: false });
    } catch {
      setState({ items: DEMO_CASES.map((item) => normalizeEmergencyCase({ ...item, status: 'resolved', resolved_at: nowIso(), sla: { ...item.sla, status: 'closed' } })), loading: false, demo: true });
    }
  }
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => applyCaseFilters(state.items, filters), [state.items, filters]);
  const selected = filtered.find((item) => itemId(item) === selectedId) || filtered[0];
  const timeline = useTimeline(itemId(selected), Boolean(selected));
  return (
    <section className="nurse-em-page">
      <CommandHeader title="Ca đã kết thúc" subtitle="Rà soát, dòng thời gian, kết quả SLA, kết quả xử trí và hồ sơ liên kết." loading={state.loading} demo={state.demo} onRefresh={load} />
      <KpiStrip items={[
        { key: 'closed', label: 'Đã kết thúc', value: state.items.length, tone: 'green', icon: CheckCircle2 },
        { key: 'resolved', label: 'Đã xử lý', value: state.items.filter((item) => item.status === 'resolved').length, tone: 'blue', icon: ClipboardCheck },
        { key: 'cancelled', label: 'Đã hủy', value: state.items.filter((item) => item.status === 'cancelled').length, tone: 'slate', icon: X },
        { key: 'critical', label: 'Nguy kịch', value: state.items.filter((item) => item.priority === 'critical').length, tone: 'red', icon: AlertTriangle },
      ]} />
      <FilterBar filters={filters} setFilters={setFilters} compact />
      <section className="nurse-em-closed-layout">
        <main className="nurse-em-table-wrap">
          <table className="nurse-em-table">
            <thead><tr><th>Ca</th><th>Bệnh nhân</th><th>Loại ca</th><th>Ưu tiên</th><th>Trạng thái cuối</th><th>Tổng thời gian</th><th>SLA</th><th>Rà soát</th></tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={itemId(item)} className={itemId(selected) === itemId(item) ? 'is-active' : ''} onClick={() => setSelectedId(itemId(item))}>
                  <td><strong>{item.case_code}</strong><small>{formatDateTime(item.created_at)}</small></td>
                  <td><strong>{patientName(item)}</strong><small>{patientCode(item)}</small></td>
                  <td>{labelType[item.type] || item.type}</td>
                  <td><PriorityBadge value={item.priority} /></td>
                  <td><StatusBadge value={item.status} /></td>
                  <td>{elapsedText(item.created_at)}</td>
                  <td><SlaTimer item={item} /></td>
                  <td><span className="nurse-em-review-pill">Chờ rà soát</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
        <CaseDetail item={selected} timeline={timeline} activeTab={activeTab} setActiveTab={setActiveTab} />
      </section>
    </section>
  );
}
