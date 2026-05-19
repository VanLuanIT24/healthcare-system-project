import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  HeartPulse,
  Loader2,
  MessageSquarePlus,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  Syringe,
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

const DEMO_COMMAND = {
  meta: { generated_at: nowIso(), realtime: true, refresh_seconds: 5, source: 'demo' },
  kpis: {
    total_monitoring: 48,
    critical: 3,
    needs_vital_recheck: 13,
    doctor_waiting: 9,
    sla_breached: 3,
    post_procedure: 12,
    post_medication: 18,
    medication_reactions: 2,
    emergency_open: 9,
  },
  monitoring: {
    items: [
      {
        id: 'demo-monitor-1',
        monitoring_session_id: 'demo-monitor-1',
        patient_id: 'p1',
        patient_code: 'BN0001',
        patient_name: 'Nguyễn Văn A',
        patient: { patient_name: 'Nguyễn Văn A', patient_code: 'BN0001', age: 62, gender: 'male' },
        encounter_id: 'e1',
        encounter_code: 'ENC-20260519-0008',
        department: { department_name: 'Nội tổng quát' },
        doctor: { full_name: 'BS Trần Minh' },
        assigned_nurse: { full_name: 'ĐD Hoa' },
        reason: 'Theo dõi SpO2 thấp sau thủ thuật',
        source_type: 'abnormal_vital',
        source_label: 'Sinh hiệu bất thường',
        priority: 'critical',
        risk_level: 'critical',
        risk_score: 96,
        status: 'doctor_notified',
        latest_vital: { spo2: 88, heart_rate: 126, systolic_bp: 90, diastolic_bp: 58, temperature: 38.7, respiratory_rate: 30, recorded_at: minutesAgo(6), requires_recheck: true },
        risk_flags: ['SpO2 thấp', 'Mạch nhanh', 'Dị ứng Penicillin nặng', 'COPD'],
        last_checked_at: minutesAgo(6),
        last_checked_minutes: 6,
        next_check_at: minutesAgo(2),
        next_check_minutes: -2,
        sla_due_at: minutesAgo(3),
        sla_minutes: -3,
        sla_breached: true,
        doctor_notified_at: minutesAgo(5),
        actions: ['record_vital', 'add_note', 'notify_doctor', 'create_emergency'],
      },
      {
        id: 'demo-monitor-2',
        patient_code: 'BN0002',
        patient_name: 'Trần Thị B',
        patient: { patient_name: 'Trần Thị B', patient_code: 'BN0002', age: 54, gender: 'female' },
        encounter_code: 'ENC-20260519-0012',
        department: { department_name: 'Tim mạch' },
        doctor: { full_name: 'BS Lê Hoàng' },
        reason: 'Tăng HA sau dùng thuốc',
        source_type: 'post_medication',
        source_label: 'Sau dùng thuốc',
        priority: 'high',
        risk_level: 'high',
        risk_score: 78,
        status: 'watching',
        latest_vital: { spo2: 94, heart_rate: 118, systolic_bp: 176, diastolic_bp: 102, temperature: 37.8, recorded_at: minutesAgo(18), requires_recheck: true },
        risk_flags: ['HA cao', 'Mạch nhanh'],
        last_checked_minutes: 18,
        next_check_minutes: 6,
        sla_minutes: 12,
        doctor_notified_at: null,
      },
      {
        id: 'demo-monitor-3',
        patient_code: 'BN0003',
        patient_name: 'Lê Văn C',
        patient: { patient_name: 'Lê Văn C', patient_code: 'BN0003', age: 47, gender: 'male' },
        encounter_code: 'ENC-20260519-0019',
        department: { department_name: 'Ngoại tổng quát' },
        doctor: { full_name: 'BS Nguyễn Phúc' },
        reason: 'Theo dõi đau sau tiểu phẫu',
        source_type: 'post_procedure',
        source_label: 'Sau thủ thuật',
        priority: 'medium',
        risk_level: 'medium',
        risk_score: 52,
        status: 'watching',
        latest_vital: { spo2: 97, heart_rate: 92, systolic_bp: 126, diastolic_bp: 78, temperature: 37.2, recorded_at: minutesAgo(22) },
        risk_flags: ['Đau 6/10'],
        last_checked_minutes: 22,
        next_check_minutes: 8,
        sla_minutes: 38,
      },
    ],
  },
  alerts: {
    items: [
      { id: 'alert-1', clinical_alert_id: 'alert-1', severity: 'critical', status: 'open', source_type: 'vital_sign', patient_name: 'Nguyễn Văn A', patient_code: 'BN0001', encounter_id: 'e1', title: 'Sinh hiệu nguy kịch', message: 'SpO2 88%, mạch 132, HA 90/58', created_at: minutesAgo(4), sla_minutes: 1, actions: ['acknowledge', 'notify_doctor', 'create_emergency'] },
      { id: 'alert-2', clinical_alert_id: 'alert-2', severity: 'high', status: 'acknowledged', source_type: 'lab_result', patient_name: 'Phạm Thị D', patient_code: 'BN0004', title: 'Xét nghiệm nguy kịch', message: 'Kali 2.7 mmol/L cần xác nhận', created_at: minutesAgo(12), sla_minutes: -2, sla_breached: true },
      { id: 'alert-3', clinical_alert_id: 'alert-3', severity: 'high', status: 'doctor_notified', source_type: 'medication_reaction', patient_name: 'Trần Thị B', patient_code: 'BN0002', title: 'Nghi phản ứng thuốc', message: 'Mẩn ngứa + khó thở nhẹ sau Ceftriaxone', created_at: minutesAgo(10), sla_minutes: 8 },
    ],
  },
  doctor_notifications: {
    items: [
      { id: 'dn-1', doctor_notification_request_id: 'dn-1', request_no: 'DNR-20260519-0007', priority: 'critical', status: 'sent', patient_name: 'Nguyễn Văn A', patient_code: 'BN0001', from_nurse: { full_name: 'ĐD Hoa' }, to_doctor: { full_name: 'BS Trần Minh' }, category: 'abnormal_vital', sbar: { situation: 'SpO2 88% sau thủ thuật', background: 'COPD, dị ứng Penicillin', assessment: 'Khó thở, HA thấp', recommendation: 'Bác sĩ đánh giá ngay tại giường' }, sent_at: minutesAgo(5), sla_minutes: -2, sla_breached: true },
      { id: 'dn-2', doctor_notification_request_id: 'dn-2', request_no: 'DNR-20260519-0008', priority: 'urgent', status: 'seen', patient_name: 'Trần Thị B', patient_code: 'BN0002', from_nurse: { full_name: 'ĐD Lan' }, to_doctor: { full_name: 'BS Lê Hoàng' }, category: 'post_medication', sbar: { situation: 'Mẩn ngứa sau Ceftriaxone', assessment: 'SpO2 93, mạch 118', recommendation: 'Xin chỉ định xử trí phản ứng thuốc' }, sent_at: minutesAgo(12), seen_at: minutesAgo(7), sla_minutes: 3 },
    ],
  },
  post_procedure: {
    items: [
      { id: 'pro-1', procedure_order_id: 'pro-1', patient_name: 'Nguyễn Văn A', patient_code: 'BN0001', patient: { patient_name: 'Nguyễn Văn A', age: 62, gender: 'male' }, encounter_id: 'e1', procedure_name: 'Nội soi phế quản', priority: 'stat', performer: { full_name: 'BS Phúc' }, completed_at: minutesAgo(18), minutes_after_completed: 18, latest_observation: { pain_score: 8, bleeding_level: 'moderate', wound_status: 'Chảy máu ít tại vị trí can thiệp', consciousness: 'alert', dyspnea: true, severity: 'urgent', status: 'doctor_notified', next_check_at: minutesAhead(4), doctor_notified: true }, severity: 'urgent', status: 'doctor_notified', next_check_at: minutesAhead(4) },
      { id: 'pro-2', procedure_order_id: 'pro-2', patient_name: 'Lê Văn C', patient_code: 'BN0003', patient: { patient_name: 'Lê Văn C', age: 47, gender: 'male' }, procedure_name: 'Khâu vết thương', priority: 'routine', performer: { full_name: 'BS An' }, completed_at: minutesAgo(42), minutes_after_completed: 42, latest_observation: { pain_score: 4, bleeding_level: 'none', wound_status: 'Khô sạch', consciousness: 'alert', severity: 'normal', status: 'stable', next_check_at: minutesAhead(24) }, severity: 'normal', status: 'stable', next_check_at: minutesAhead(24) },
    ],
  },
  post_medication: {
    items: [
      { id: 'ma-1', medication_administration_id: 'ma-1', patient_name: 'Trần Thị B', patient_code: 'BN0002', patient: { patient_name: 'Trần Thị B', age: 54, gender: 'female' }, medication_name: 'Ceftriaxone 1g', dose: '1g', route: 'IV', administered_by: { full_name: 'ĐD Lan' }, administered_at: minutesAgo(12), minutes_after_administered: 12, status: 'given', latest_reaction: { symptoms: ['Mẩn ngứa', 'Khó thở nhẹ'], severity: 'moderate', suspected_allergy: true, medication_stopped: true, status: 'observed' }, risk_level: 'medium' },
      { id: 'ma-2', medication_administration_id: 'ma-2', patient_name: 'Hoàng Văn E', patient_code: 'BN0005', patient: { patient_name: 'Hoàng Văn E', age: 69, gender: 'male' }, medication_name: 'Insulin regular', dose: '6 UI', route: 'SC', administered_by: { full_name: 'ĐD Mai' }, administered_at: minutesAgo(38), minutes_after_administered: 38, status: 'given', latest_reaction: null, risk_level: 'low' },
    ],
  },
  emergency: {
    items: [
      { id: 'ec-1', case_id: 'ec-1', case_code: 'SOS-20260519-0003', priority: 'critical', status: 'created', type: 'fall', patient_name: 'Nguyễn Văn A', patient_code: 'BN0001', patient: { patient_name: 'Nguyễn Văn A', age: 62, gender: 'male' }, location_text: 'Phòng 203', symptoms: 'Tụt HA, SpO2 thấp sau té ngã', note: 'Chưa có đội nhận', created_at: minutesAgo(2), sla_minutes: 2, escalation_level: 0 },
      { id: 'ec-2', case_id: 'ec-2', case_code: 'SOS-20260519-0004', priority: 'urgent', status: 'triaged', type: 'medical_emergency', patient_name: 'Phạm Thị D', patient_code: 'BN0004', patient: { patient_name: 'Phạm Thị D', age: 73, gender: 'female' }, location_text: 'Sảnh A', symptoms: 'Đau ngực, vã mồ hôi', note: 'Đã phân loại, chờ điều phối', created_at: minutesAgo(9), sla_minutes: -1, sla_breached: true, escalation_level: 1 },
    ],
  },
};

const severityLabel = {
  critical: 'Nguy kịch',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
  urgent: 'Khẩn',
  normal: 'Bình thường',
  watch: 'Theo dõi',
  routine: 'Thường quy',
  stat: 'STAT',
  info: 'Thông tin',
  warning: 'Cảnh báo',
};

const statusLabel = {
  active: 'Đang theo dõi',
  watching: 'Theo dõi sát',
  doctor_notified: 'Đã báo BS',
  doctor_acknowledged: 'BS đã nhận',
  escalated: 'Đã báo khẩn',
  stable: 'Ổn định',
  resolved: 'Đã xử lý',
  open: 'Mới phát hiện',
  acknowledged: 'Đã nhận',
  sent: 'Đã gửi',
  delivered: 'Đã tới',
  seen: 'Đã đọc',
  responded: 'Đã phản hồi',
  closed: 'Đã đóng',
  created: 'Chờ nhận',
  triaged: 'Đã phân loại',
  dispatched: 'Đã điều phối',
  given: 'Đã dùng',
  held: 'Tạm hoãn',
  refused: 'Từ chối',
  omitted: 'Bỏ liều',
  monitoring: 'Theo dõi',
};

const sourceTypeLabel = {
  vital_sign: 'Sinh hiệu',
  lab_result: 'Xét nghiệm',
  medication_reaction: 'Phản ứng thuốc',
  abnormal_vital: 'Sinh hiệu bất thường',
  post_procedure: 'Sau thủ thuật',
  post_medication: 'Sau dùng thuốc',
  lab_critical: 'Xét nghiệm nguy kịch',
  imaging_critical: 'CĐHA nguy kịch',
  manual: 'Nhập tay',
};

const emergencyTypeLabel = {
  fall: 'Té ngã',
  medical_emergency: 'Cấp cứu y khoa',
  panic: 'Hoảng loạn',
  sos: 'SOS',
  other: 'Khác',
};

function displayGender(gender) {
  return gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : 'Khác';
}

function formatTime(value) {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function minutesText(value) {
  if (value === null || value === undefined) return 'Chưa đặt';
  if (value < 0) return `quá ${Math.abs(value)} phút`;
  if (value === 0) return 'đến hạn';
  return `còn ${value} phút`;
}

function patientName(item) {
  return item.patient?.patient_name || item.patient_name || 'Chưa rõ bệnh nhân';
}

function patientCode(item) {
  return item.patient?.patient_code || item.patient_code || 'Chưa có mã';
}

function patientAgeGender(item) {
  const age = item.patient?.age;
  const gender = displayGender(item.patient?.gender);
  return [gender, age ? `${age}T` : null].filter(Boolean).join(' · ');
}

function getItems(payload, key) {
  if (Array.isArray(payload?.[key]?.items)) return payload[key].items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function useClinicalCommand() {
  const [state, setState] = useState({ data: DEMO_COMMAND, loading: true, error: null, demo: true });

  async function load() {
    setState((current) => ({ ...current, loading: true }));
    try {
      const data = await nurseMonitoringApi.getCommandCenter();
      setState({ data: data || DEMO_COMMAND, loading: false, error: null, demo: false });
    } catch (error) {
      setState({ data: DEMO_COMMAND, loading: false, error, demo: true });
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { ...state, refresh: load };
}

function SeverityBadge({ value }) {
  const normalized = value || 'medium';
  return <span className={`nurse-mr-badge nurse-mr-badge--${normalized}`}>{severityLabel[normalized] || normalized}</span>;
}

function StatusPill({ value }) {
  const normalized = value || 'active';
  return <span className={`nurse-mr-status nurse-mr-status--${normalized}`}>{statusLabel[normalized] || normalized}</span>;
}

function CommandHeader({ title, subtitle, kpis, loading, demo, onRefresh, actions = [] }) {
  return (
    <section className="nurse-mr-header">
      <div>
        <span className={demo ? 'nurse-mr-live nurse-mr-live--demo' : 'nurse-mr-live'}>
          {demo ? <Wifi size={15} /> : <Wifi size={15} />}
          {demo ? 'Dữ liệu mẫu · đang chờ API' : 'Thời gian thực · cập nhật liên tục'}
        </span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div className="nurse-mr-header__metrics">
          {kpis.map((item) => (
            <span key={item.label}><strong>{item.value}</strong> {item.label}</span>
          ))}
        </div>
      </div>
      <aside>
        <button type="button" onClick={onRefresh} className="nurse-mr-primary">
          {loading ? <Loader2 className="is-spinning" size={16} /> : <RefreshCw size={16} />}
          Làm mới
        </button>
        {actions.map(({ label, icon: Icon, onClick }) => (
          <button key={label} type="button" onClick={onClick}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </aside>
    </section>
  );
}

function KpiStrip({ items }) {
  return (
    <section className="nurse-mr-kpis">
      {items.map(({ label, value, hint, tone, icon: Icon }) => (
        <article key={label} className={`nurse-mr-kpi nurse-mr-kpi--${tone || 'teal'}`}>
          <Icon size={20} />
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{hint}</small>
        </article>
      ))}
    </section>
  );
}

function FilterBar({ search, setSearch, filters = [], children }) {
  return (
    <section className="nurse-mr-filters">
      <label className="nurse-mr-search-field">
        <span>Tìm kiếm</span>
        <div>
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, mã BN, lượt khám, lý do" />
        </div>
      </label>
      {filters.map((filter) => (
        <label key={filter.key}>
          <span>{filter.label}</span>
          <select value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ))}
      {children}
    </section>
  );
}

function LatestVitalStrip({ vital }) {
  if (!vital) return <span className="nurse-mr-muted">Chưa có sinh hiệu</span>;
  const bp = vital.systolic_bp && vital.diastolic_bp ? `${vital.systolic_bp}/${vital.diastolic_bp}` : '--';
  return (
    <div className="nurse-mr-vitals">
      <span>SpO2 <strong>{vital.spo2 ?? '--'}</strong></span>
      <span>Mạch <strong>{vital.heart_rate ?? '--'}</strong></span>
      <span>HA <strong>{bp}</strong></span>
      <span>T <strong>{vital.temperature ?? '--'}</strong></span>
      <small>{formatTime(vital.recorded_at)}</small>
    </div>
  );
}

function ActionBar({ actions = [], compact = false }) {
  const iconByAction = {
    record_vital: HeartPulse,
    add_note: FileText,
    notify_doctor: Send,
    create_emergency: ShieldAlert,
    mark_stable: CheckCircle2,
    open_timeline: Activity,
    acknowledge: UserCheck,
    escalate: Zap,
    resolve: CheckCircle2,
    dismiss: X,
    observe: ClipboardCheck,
    record_reaction: Pill,
    create_allergy: AlertTriangle,
  };
  const labelByAction = {
    record_vital: 'Đo lại',
    add_note: 'Ghi chú',
    notify_doctor: 'Báo BS',
    create_emergency: 'Báo khẩn',
    mark_stable: 'Ổn định',
    open_timeline: 'Dòng thời gian',
    acknowledge: 'Nhận xử lý',
    escalate: 'Báo khẩn',
    resolve: 'Xử lý xong',
    dismiss: 'Bỏ qua',
    observe: 'Kiểm tra',
    record_reaction: 'Ghi phản ứng',
    create_allergy: 'Tạo dị ứng',
  };
  return (
    <div className={compact ? 'nurse-mr-actions nurse-mr-actions--compact' : 'nurse-mr-actions'}>
      {actions.slice(0, compact ? 4 : 6).map((action) => {
        const Icon = iconByAction[action] || ChevronRight;
        return (
          <button key={action} type="button" title={labelByAction[action] || action}>
            <Icon size={14} />
            <span>{labelByAction[action] || action}</span>
          </button>
        );
      })}
    </div>
  );
}

function PatientDrawer({ item, onClose }) {
  const [tab, setTab] = useState('overview');
  if (!item) return null;
  const tabs = [
    ['overview', 'Tổng quan'],
    ['vitals', 'Sinh hiệu'],
    ['orders', 'Lệnh & kết quả'],
    ['notes', 'Ghi chú & SBAR'],
  ];
  return (
    <aside className="nurse-mr-drawer">
      <header>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết"><X size={18} /></button>
        <div>
          <SeverityBadge value={item.priority || item.risk_level} />
          <h2>{patientName(item)}</h2>
          <p>{patientCode(item)} · {patientAgeGender(item)} · {item.encounter_code || item.request_no || item.case_code || 'Chưa có lượt khám'}</p>
        </div>
      </header>
      <nav>
        {tabs.map(([value, label]) => (
          <button key={value} type="button" className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}>{label}</button>
        ))}
      </nav>
      <main>
        {tab === 'overview' ? (
          <section>
            <h3><Users size={16} /> Tổng quan nguy cơ</h3>
            <dl>
              <div><dt>Khoa/phòng</dt><dd>{item.department?.department_name || item.location_text || 'Chưa rõ'}</dd></div>
              <div><dt>Bác sĩ</dt><dd>{item.doctor?.full_name || item.to_doctor?.full_name || 'Chưa phân công'}</dd></div>
              <div><dt>Lý do</dt><dd>{item.reason || item.message || item.symptoms || 'Theo dõi lâm sàng'}</dd></div>
              <div><dt>Điểm nguy cơ</dt><dd>{item.risk_score ?? '--'}</dd></div>
              <div><dt>SLA</dt><dd>{minutesText(item.sla_minutes)}</dd></div>
              <div><dt>Trạng thái</dt><dd>{statusLabel[item.status] || item.status}</dd></div>
            </dl>
            <div className="nurse-mr-risk-list">
              {(item.risk_flags || item.latest_reaction?.symptoms || []).map((flag) => <span key={flag}>{flag}</span>)}
            </div>
          </section>
        ) : null}
        {tab === 'vitals' ? (
          <section>
            <h3><HeartPulse size={16} /> Sinh hiệu & diễn biến</h3>
            <LatestVitalStrip vital={item.latest_vital} />
            <div className="nurse-mr-trend-grid">
              {['SpO2', 'Mạch', 'HA', 'Nhiệt độ'].map((label, index) => (
                <div key={label}><span>{label}</span><em style={{ height: `${44 + index * 10}%` }} /></div>
              ))}
            </div>
          </section>
        ) : null}
        {tab === 'orders' ? (
          <section>
            <h3><ClipboardCheck size={16} /> Lệnh / thủ thuật / xét nghiệm</h3>
            <p className="nurse-mr-muted">Tóm tắt y lệnh, xét nghiệm nguy kịch, chẩn đoán hình ảnh nguy kịch và thủ thuật liên quan sẽ hiển thị từ tóm tắt hệ thống theo lượt khám.</p>
            <div className="nurse-mr-risk-list">
              <span>Xét nghiệm nguy kịch</span>
              <span>CĐHA nguy kịch</span>
              <span>Thủ thuật hoàn tất</span>
              <span>Đơn thuốc đang hiệu lực</span>
            </div>
          </section>
        ) : null}
        {tab === 'notes' ? (
          <section>
            <h3><MessageSquarePlus size={16} /> Ghi chú & báo bác sĩ</h3>
            <SBARMiniComposer item={item} />
          </section>
        ) : null}
      </main>
    </aside>
  );
}

function SBARMiniComposer({ item }) {
  return (
    <div className="nurse-mr-sbar-mini">
      <label><span>S</span><textarea defaultValue={item.sbar?.situation || item.reason || item.message || ''} /></label>
      <label><span>B</span><textarea defaultValue={item.sbar?.background || item.encounter_code || ''} /></label>
      <label><span>A</span><textarea defaultValue={item.sbar?.assessment || (item.latest_vital ? `SpO2 ${item.latest_vital.spo2 ?? '--'}, mạch ${item.latest_vital.heart_rate ?? '--'}` : '')} /></label>
      <label><span>R</span><textarea defaultValue={item.sbar?.recommendation || 'Bác sĩ vui lòng đánh giá và phản hồi hướng xử trí.'} /></label>
      <button type="button"><Send size={15} /> Gửi SBAR</button>
    </div>
  );
}

function MonitoringTable({ items, onSelect }) {
  return (
    <div className="nurse-mr-table-wrap">
      <table className="nurse-mr-table">
        <thead>
          <tr>
            <th>Ưu tiên</th>
            <th>Bệnh nhân</th>
            <th>Lượt khám</th>
            <th>Khoa/phòng</th>
            <th>Lý do theo dõi</th>
            <th>Sinh hiệu mới nhất</th>
            <th>Dấu hiệu nguy cơ</th>
            <th>Kiểm tra</th>
            <th>Báo bác sĩ</th>
            <th>SLA</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} onClick={() => onSelect(item)}>
              <td><SeverityBadge value={item.priority} /></td>
              <td><strong>{patientName(item)}</strong><small>{patientCode(item)} · {patientAgeGender(item)}</small></td>
              <td><strong>{item.encounter_code || item.encounter_id || '--'}</strong><small>{statusLabel[item.encounter_status] || item.encounter_status || item.source_label}</small></td>
              <td><strong>{item.department?.department_name || '--'}</strong><small>{item.doctor?.full_name || 'Chưa có bác sĩ'}</small></td>
              <td><strong>{item.reason}</strong><small>{item.source_label || sourceTypeLabel[item.source_type] || item.source_type}</small></td>
              <td><LatestVitalStrip vital={item.latest_vital} /></td>
              <td><div className="nurse-mr-risk-chips">{(item.risk_flags || []).slice(0, 3).map((flag) => <span key={flag}>{flag}</span>)}</div></td>
              <td><strong>{item.last_checked_minutes !== null && item.last_checked_minutes !== undefined ? `${item.last_checked_minutes} phút trước` : 'Chưa kiểm tra'}</strong><small>Tiếp theo: {minutesText(item.next_check_minutes)}</small></td>
              <td><StatusPill value={item.doctor_notified_at ? 'doctor_notified' : item.status} /></td>
              <td><span className={item.sla_breached ? 'nurse-mr-sla is-breached' : 'nurse-mr-sla'}>{minutesText(item.sla_minutes)}</span></td>
              <td><ActionBar actions={item.actions || ['record_vital', 'add_note', 'notify_doctor']} compact /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ title = 'Chưa có dữ liệu phù hợp' }) {
  return <div className="nurse-mr-empty"><Activity size={20} /> {title}</div>;
}

export function MonitoringPatientsPage() {
  const { data, loading, demo, refresh } = useClinicalCommand();
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState('all');
  const [source, setSource] = useState('all');
  const [selected, setSelected] = useState(null);
  const items = useMemo(() => {
    const query = search.toLowerCase().trim();
    return getItems(data, 'monitoring').filter((item) => {
      if (risk !== 'all' && item.priority !== risk && item.risk_level !== risk) return false;
      if (source !== 'all' && item.source_type !== source) return false;
      if (!query) return true;
      return `${patientName(item)} ${patientCode(item)} ${item.encounter_code || ''} ${item.reason || ''}`.toLowerCase().includes(query);
    });
  }, [data, search, risk, source]);
  const k = data.kpis || {};

  return (
    <section className="nurse-mr-page">
      <CommandHeader
        title="Bệnh nhân đang theo dõi"
        subtitle="Bảng điều phối cho các bệnh nhân cần điều dưỡng theo dõi sát, tái đo sinh hiệu, báo bác sĩ hoặc báo khẩn."
        loading={loading}
        demo={demo}
        onRefresh={refresh}
        kpis={[
          { label: 'đang theo dõi', value: k.total_monitoring ?? items.length },
          { label: 'nguy cơ cao', value: k.critical ?? 0 },
          { label: 'cần đo lại sinh hiệu', value: k.needs_vital_recheck ?? 0 },
          { label: 'chờ bác sĩ', value: k.doctor_waiting ?? 0 },
          { label: 'quá SLA', value: k.sla_breached ?? 0 },
        ]}
        actions={[
          { label: 'Tạo ghi chú', icon: MessageSquarePlus },
          { label: 'Đo sinh hiệu', icon: HeartPulse },
          { label: 'Báo bác sĩ', icon: Send },
          { label: 'Tạo ca khẩn', icon: ShieldAlert },
          { label: 'In danh sách', icon: Printer },
          { label: 'Xuất file', icon: Download },
        ]}
      />
      <KpiStrip
        items={[
          { label: 'Đang theo dõi', value: k.total_monitoring ?? 48, hint: '+6 so với ca trước', tone: 'teal', icon: Users },
          { label: 'Nguy kịch', value: k.critical ?? 3, hint: 'SpO2 thấp / tụt HA', tone: 'red', icon: ShieldAlert },
          { label: 'Cần đo lại', value: k.needs_vital_recheck ?? 13, hint: '5 ca quá 30 phút', tone: 'amber', icon: HeartPulse },
          { label: 'Chờ bác sĩ', value: k.doctor_waiting ?? 9, hint: '3 yêu cầu quá SLA', tone: 'blue', icon: Stethoscope },
          { label: 'Sau thủ thuật', value: k.post_procedure ?? 12, hint: '4 chưa check lần 1', tone: 'violet', icon: ClipboardCheck },
          { label: 'Sau dùng thuốc', value: k.post_medication ?? 18, hint: `${k.medication_reactions ?? 2} nghi phản ứng`, tone: 'green', icon: Pill },
        ]}
      />
      <FilterBar
        search={search}
        setSearch={setSearch}
        filters={[
          { key: 'risk', label: 'Mức nguy cơ', value: risk, onChange: setRisk, options: [{ value: 'all', label: 'Tất cả' }, { value: 'critical', label: 'Nguy kịch' }, { value: 'high', label: 'Cao' }, { value: 'medium', label: 'Trung bình' }, { value: 'low', label: 'Thấp' }] },
          { key: 'source', label: 'Nguồn theo dõi', value: source, onChange: setSource, options: [{ value: 'all', label: 'Tất cả' }, { value: 'abnormal_vital', label: 'Sinh hiệu' }, { value: 'post_procedure', label: 'Sau thủ thuật' }, { value: 'post_medication', label: 'Sau dùng thuốc' }, { value: 'lab_critical', label: 'Xét nghiệm nguy kịch' }, { value: 'imaging_critical', label: 'CĐHA nguy kịch' }] },
        ]}
      />
      {items.length ? <MonitoringTable items={items} onSelect={setSelected} /> : <EmptyState />}
      <PatientDrawer item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function ProcedureCard({ item, onSelect }) {
  const obs = item.latest_observation || {};
  return (
    <article className={`nurse-mr-procedure-card nurse-mr-procedure-card--${item.severity || 'watch'}`} onClick={() => onSelect(item)}>
      <header>
        <SeverityBadge value={item.severity || item.priority} />
        <StatusPill value={item.status} />
      </header>
      <h3>{patientName(item)}</h3>
      <p>{patientCode(item)} · {patientAgeGender(item)}</p>
      <div className="nurse-mr-procedure-card__body">
        <strong>{item.procedure_name}</strong>
        <span>Hoàn tất {item.minutes_after_completed ?? '--'} phút trước · {item.performer?.full_name || 'Chưa rõ người thực hiện'}</span>
      </div>
      <dl>
        <div><dt>Đau</dt><dd>{obs.pain_score ?? '--'}/10</dd></div>
        <div><dt>Chảy máu</dt><dd>{obs.bleeding_level || 'chưa kiểm tra'}</dd></div>
        <div><dt>Vết thương</dt><dd>{obs.wound_status || 'chưa ghi'}</dd></div>
        <div><dt>Ý thức</dt><dd>{obs.consciousness || 'chưa ghi'}</dd></div>
      </dl>
      <footer>
        <span>Lần kiểm tra tiếp: {minutesText(minutesUntilIso(item.next_check_at))}</span>
        <ActionBar actions={['observe', 'record_vital', 'notify_doctor', 'create_emergency', 'mark_stable']} compact />
      </footer>
    </article>
  );
}

function minutesUntilIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 60000);
}

export function PostProcedureMonitoringPage() {
  const { data, loading, demo, refresh } = useClinicalCommand();
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);
  const items = getItems(data, 'post_procedure').filter((item) => {
    if (tab === 'abnormal') return ['urgent', 'critical'].includes(item.severity);
    if (tab === 'stable') return item.status === 'stable';
    if (tab === 'doctor') return item.latest_observation?.doctor_notified || item.status === 'doctor_notified';
    if (tab === '0-15') return (item.minutes_after_completed || 0) <= 15;
    if (tab === '15-30') return (item.minutes_after_completed || 0) > 15 && (item.minutes_after_completed || 0) <= 30;
    if (tab === '30-60') return (item.minutes_after_completed || 0) > 30 && (item.minutes_after_completed || 0) <= 60;
    if (tab === '60+') return (item.minutes_after_completed || 0) > 60;
    return true;
  });
  const summary = data.post_procedure?.summary || {};
  return (
    <section className="nurse-mr-page">
      <CommandHeader
        title="Theo dõi sau thủ thuật"
        subtitle="Board hậu thủ thuật theo mốc thời gian, đau, chảy máu, ý thức, sinh hiệu và trạng thái báo bác sĩ."
        loading={loading}
        demo={demo}
        onRefresh={refresh}
        kpis={[
          { label: 'hoàn tất hôm nay', value: summary.total ?? items.length },
          { label: 'đang theo dõi', value: summary.monitoring ?? 0 },
          { label: 'nghi biến chứng', value: summary.suspected_complication ?? 0 },
          { label: 'cần kiểm tra 10 phút', value: summary.due_10_minutes ?? 0 },
          { label: 'đã báo bác sĩ', value: summary.doctor_notified ?? 0 },
        ]}
        actions={[
          { label: 'Ghi nhận hậu thủ thuật', icon: ClipboardCheck },
          { label: 'Đo sinh hiệu', icon: HeartPulse },
          { label: 'Báo bác sĩ', icon: Send },
          { label: 'Tạo ca khẩn', icon: ShieldAlert },
          { label: 'In bảng kiểm', icon: Printer },
        ]}
      />
      <div className="nurse-mr-tabs">
        {[
          ['all', 'Tất cả'],
          ['0-15', '0-15 phút'],
          ['15-30', '15-30 phút'],
          ['30-60', '30-60 phút'],
          ['60+', '> 60 phút'],
          ['abnormal', 'Bất thường'],
          ['stable', 'Ổn định'],
          ['doctor', 'Đã báo bác sĩ'],
        ].map(([value, label]) => <button key={value} type="button" className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      <section className="nurse-mr-card-grid">
        {items.map((item) => <ProcedureCard key={item.id} item={item} onSelect={setSelected} />)}
      </section>
      {!items.length ? <EmptyState /> : null}
      <PatientDrawer item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

export function PostMedicationMonitoringPage() {
  const { data, loading, demo, refresh } = useClinicalCommand();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);
  const items = getItems(data, 'post_medication').filter((item) => {
    const query = search.toLowerCase().trim();
    if (tab === 'reaction' && !item.latest_reaction) return false;
    if (tab === 'allergy' && !item.latest_reaction?.suspected_allergy) return false;
    if (tab === 'held' && !['held', 'refused', 'omitted'].includes(item.status)) return false;
    if (tab === '0-15' && (item.minutes_after_administered || 0) > 15) return false;
    if (tab === '15-30' && ((item.minutes_after_administered || 0) <= 15 || (item.minutes_after_administered || 0) > 30)) return false;
    if (tab === '30-60' && ((item.minutes_after_administered || 0) <= 30 || (item.minutes_after_administered || 0) > 60)) return false;
    if (!query) return true;
    return `${patientName(item)} ${patientCode(item)} ${item.medication_name || ''}`.toLowerCase().includes(query);
  });
  const summary = data.post_medication?.summary || {};
  return (
    <section className="nurse-mr-page">
      <CommandHeader
        title="Theo dõi sau dùng thuốc"
        subtitle="Theo dõi thuốc đã dùng, thuốc nguy cơ cao, triệu chứng sau dùng, nghi dị ứng và workflow báo bác sĩ."
        loading={loading}
        demo={demo}
        onRefresh={refresh}
        kpis={[
          { label: 'đã dùng hôm nay', value: summary.given ?? 112 },
          { label: 'cần theo dõi', value: summary.needs_follow_up ?? 26 },
          { label: 'nghi phản ứng', value: summary.suspected_reaction ?? 4 },
          { label: 'nghi dị ứng', value: summary.suspected_allergy ?? 2 },
          { label: 'hoãn/từ chối', value: summary.held_refused_omitted ?? 8 },
        ]}
        actions={[
          { label: 'Ghi phản ứng', icon: Pill },
          { label: 'Đo sinh hiệu', icon: HeartPulse },
          { label: 'Báo bác sĩ', icon: Send },
          { label: 'Tạo dị ứng', icon: AlertTriangle },
          { label: 'Báo khẩn', icon: ShieldAlert },
        ]}
      />
      <div className="nurse-mr-tabs">
        {[
          ['all', 'Tất cả'],
          ['0-15', '0-15 phút'],
          ['15-30', '15-30 phút'],
          ['30-60', '30-60 phút'],
          ['reaction', 'Nghi phản ứng'],
          ['allergy', 'Nghi dị ứng'],
          ['held', 'Hoãn / từ chối'],
        ].map(([value, label]) => <button key={value} type="button" className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      <FilterBar search={search} setSearch={setSearch} />
      <div className="nurse-mr-table-wrap">
        <table className="nurse-mr-table">
          <thead><tr><th>Ưu tiên</th><th>Bệnh nhân</th><th>Thuốc</th><th>Liều / đường</th><th>Thời gian</th><th>Dị ứng</th><th>Triệu chứng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} onClick={() => setSelected(item)}>
                <td><SeverityBadge value={item.risk_level === 'critical' ? 'critical' : item.latest_reaction ? 'high' : 'medium'} /></td>
                <td><strong>{patientName(item)}</strong><small>{patientCode(item)} · {patientAgeGender(item)}</small></td>
                <td><strong>{item.medication_name || '--'}</strong><small>{item.administered_by?.full_name || 'Chưa rõ người ghi nhận'}</small></td>
                <td><strong>{item.dose || '--'}</strong><small>{item.route || '--'}</small></td>
                <td><strong>{item.minutes_after_administered ?? '--'} phút trước</strong><small>{formatTime(item.administered_at || item.scheduled_at)}</small></td>
                <td>{item.latest_reaction?.suspected_allergy ? <SeverityBadge value="high" /> : <span className="nurse-mr-muted">Chưa ghi nhận</span>}</td>
                <td><div className="nurse-mr-risk-chips">{(item.latest_reaction?.symptoms || ['Không triệu chứng']).map((symptom) => <span key={symptom}>{symptom}</span>)}</div></td>
                <td><StatusPill value={item.status} /></td>
                <td><ActionBar actions={['record_reaction', 'record_vital', 'notify_doctor', 'create_allergy', 'create_emergency']} compact /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PatientDrawer item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

export function AbnormalAlertsCommandPage() {
  const { data, loading, demo, refresh } = useClinicalCommand();
  const [selected, setSelected] = useState(null);
  const items = getItems(data, 'alerts');
  const columns = [
    ['open', 'Mới phát hiện'],
    ['acknowledged', 'Đã nhận xử lý'],
    ['doctor_notified', 'Đã báo bác sĩ'],
    ['escalated', 'Đang theo dõi'],
    ['resolved', 'Đã xử lý'],
    ['dismissed', 'Bỏ qua hợp lệ'],
  ];
  const summary = data.alerts?.summary || {};
  return (
    <section className="nurse-mr-page">
      <CommandHeader
        title="Cảnh báo bất thường"
        subtitle="Radar điều dưỡng gom bất thường từ sinh hiệu, xét nghiệm, chẩn đoán hình ảnh, hậu thủ thuật, phản ứng thuốc và ca khẩn."
        loading={loading}
        demo={demo}
        onRefresh={refresh}
        kpis={[
          { label: 'nguy kịch', value: summary.critical ?? 6 },
          { label: 'cao', value: summary.high ?? 14 },
          { label: 'chờ xác nhận', value: summary.waiting_ack ?? 11 },
          { label: 'đã báo bác sĩ', value: summary.doctor_notified ?? 8 },
          { label: 'quá SLA', value: summary.breached ?? 3 },
        ]}
        actions={[
          { label: 'Nhận cảnh báo', icon: UserCheck },
          { label: 'Báo bác sĩ', icon: Send },
          { label: 'Tạo ca khẩn', icon: ShieldAlert },
          { label: 'Xử lý xong', icon: CheckCircle2 },
        ]}
      />
      <section className="nurse-mr-kanban">
        {columns.map(([status, label]) => {
          const columnItems = items.filter((item) => item.status === status || (status === 'open' && !item.status));
          return (
            <div key={status} className="nurse-mr-kanban__column">
              <header><strong>{label}</strong><span>{columnItems.length}</span></header>
              {columnItems.map((item) => (
                <button key={item.id} type="button" className={`nurse-mr-alert-card nurse-mr-alert-card--${item.severity}`} onClick={() => setSelected(item)}>
                  <SeverityBadge value={item.severity} />
                  <strong>{item.title}</strong>
                  <span>{patientName(item)} · {item.encounter_id || patientCode(item)}</span>
                  <p>{item.message}</p>
                  <footer><small>Nguồn: {sourceTypeLabel[item.source_type] || item.source_type}</small><em>SLA: {minutesText(item.sla_minutes)}</em></footer>
                  <ActionBar actions={['acknowledge', 'notify_doctor', 'create_emergency', 'resolve']} compact />
                </button>
              ))}
            </div>
          );
        })}
      </section>
      <PatientDrawer item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

export function UrgentCasesCommandPage() {
  const { data, loading, demo, refresh } = useClinicalCommand();
  const items = getItems(data, 'emergency');
  const [selectedId, setSelectedId] = useState(items[0]?.id || null);
  const selected = items.find((item) => item.id === selectedId) || items[0];
  const summary = data.emergency?.summary || {};
  useEffect(() => {
    if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
  }, [items, selectedId]);

  return (
    <section className="nurse-mr-page">
      <CommandHeader
        title="Ca cần báo khẩn"
        subtitle="Bảng phản ứng cấp cứu cho ca mới, ca chưa nhận, phân loại, điều phối, quá SLA và báo khẩn."
        loading={loading}
        demo={demo}
        onRefresh={refresh}
        kpis={[
          { label: 'đang mở', value: summary.open ?? items.length },
          { label: 'nguy kịch', value: summary.critical ?? 3 },
          { label: 'chờ nhận', value: summary.waiting_ack ?? 4 },
          { label: 'đã phân loại', value: summary.triaged ?? 2 },
          { label: 'quá SLA', value: summary.breached ?? 1 },
        ]}
        actions={[
          { label: 'Nhận ca', icon: UserCheck },
          { label: 'Phân loại', icon: ClipboardCheck },
          { label: 'Điều phối', icon: Zap },
          { label: 'Báo khẩn', icon: ShieldAlert },
        ]}
      />
      <section className="nurse-mr-split">
        <aside className="nurse-mr-case-list">
          {items.map((item) => (
            <button key={item.id} type="button" className={selected?.id === item.id ? 'is-active' : ''} onClick={() => setSelectedId(item.id)}>
              <SeverityBadge value={item.priority} />
              <strong>{emergencyTypeLabel[item.type] || item.type} / {item.symptoms}</strong>
              <span>{patientName(item)} · {item.location_text}</span>
              <small>Tạo {minutesText(-Math.abs(Math.round((Date.now() - new Date(item.created_at || Date.now()).getTime()) / 60000)))}</small>
            </button>
          ))}
        </aside>
        <main className="nurse-mr-case-detail">
          {selected ? (
            <>
              <header>
                <div><SeverityBadge value={selected.priority} /><StatusPill value={selected.status} /></div>
                <h2>{selected.case_code}</h2>
                <p>{patientName(selected)} · {selected.location_text}</p>
              </header>
              <dl>
                <div><dt>Loại ca</dt><dd>{emergencyTypeLabel[selected.type] || selected.type}</dd></div>
                <div><dt>Triệu chứng</dt><dd>{selected.symptoms}</dd></div>
                <div><dt>Người nhận</dt><dd>{selected.assigned_to?.full_name || 'Chưa ai nhận'}</dd></div>
                <div><dt>SLA</dt><dd>{minutesText(selected.sla_minutes)}</dd></div>
                <div><dt>Báo khẩn</dt><dd>Cấp {selected.escalation_level || 0}</dd></div>
                <div><dt>Lượt khám</dt><dd>{selected.related_encounter_id || '--'}</dd></div>
              </dl>
              <section className="nurse-mr-timeline">
                {['created', 'acknowledged', 'triaged', 'dispatched', 'resolved'].map((step) => (
                  <article key={step} className={step === selected.status ? 'is-active' : ''}>
                    <span />
                    <strong>{statusLabel[step]}</strong>
                    <small>{step === 'created' ? formatTime(selected.created_at) : 'Chờ cập nhật thời gian thực'}</small>
                  </article>
                ))}
              </section>
              <ActionBar actions={['acknowledge', 'notify_doctor', 'escalate', 'record_vital', 'add_note', 'resolve']} />
            </>
          ) : <EmptyState />}
        </main>
      </section>
    </section>
  );
}

export function DoctorReportingCommandPage() {
  const { data, loading, demo, refresh } = useClinicalCommand();
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState({ priority: 'urgent', category: 'abnormal_vital' });
  const items = getItems(data, 'doctor_notifications');
  const summary = data.doctor_notifications?.summary || {};
  const waiting = items.filter((item) => ['sent', 'delivered', 'seen', 'acknowledged', 'escalated'].includes(item.status));

  return (
    <section className="nurse-mr-page">
      <CommandHeader
        title="Báo bác sĩ"
        subtitle="Trung tâm trao đổi SBAR: tạo báo bác sĩ, gửi thời gian thực, theo dõi đã đọc, phản hồi, SLA và báo khẩn."
        loading={loading}
        demo={demo}
        onRefresh={refresh}
        kpis={[
          { label: 'chờ gửi', value: summary.drafts ?? 2 },
          { label: 'chờ đọc', value: summary.sent_waiting_read ?? 5 },
          { label: 'chờ phản hồi', value: summary.seen_waiting_response ?? 7 },
          { label: 'đã phản hồi', value: summary.responded ?? 16 },
          { label: 'quá SLA', value: summary.breached ?? 3 },
        ]}
        actions={[
          { label: 'Lưu nháp', icon: FileText },
          { label: 'Gửi bác sĩ', icon: Send },
          { label: 'Gửi khẩn', icon: ShieldAlert },
          { label: 'Tạo cảnh báo', icon: Bell },
        ]}
      />
      <section className="nurse-mr-doctor-grid">
        <form className="nurse-mr-sbar-composer">
          <header>
            <Stethoscope size={19} />
            <div><strong>Tạo SBAR</strong><span>Tự tổng hợp bối cảnh từ tóm tắt lượt khám, sinh hiệu, dị ứng, xét nghiệm/CĐHA nguy kịch.</span></div>
          </header>
          <div className="nurse-mr-form-row">
            <label><span>Bệnh nhân / lượt khám</span><input placeholder="Tìm tên, mã BN hoặc lượt khám" /></label>
            <label><span>Ưu tiên</span><select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}><option value="routine">Thường quy</option><option value="urgent">Khẩn</option><option value="stat">STAT</option><option value="critical">Nguy kịch</option></select></label>
            <label><span>Nguồn phát hiện</span><select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}><option value="abnormal_vital">Sinh hiệu</option><option value="post_procedure">Sau thủ thuật</option><option value="post_medication">Sau dùng thuốc</option><option value="lab_critical">Xét nghiệm</option><option value="imaging_critical">CĐHA</option><option value="manual">Nhập tay</option></select></label>
          </div>
          {['Tình huống', 'Bối cảnh', 'Đánh giá', 'Khuyến nghị'].map((label) => (
            <label key={label} className="nurse-mr-sbar-field">
              <span>{label[0]} — {label}</span>
              <textarea placeholder={`${label}...`} />
            </label>
          ))}
          <footer>
            <button type="button"><FileText size={15} /> Lưu nháp</button>
            <button type="button" className="nurse-mr-primary"><Send size={15} /> Gửi bác sĩ</button>
            <button type="button"><ShieldAlert size={15} /> Gửi khẩn</button>
          </footer>
        </form>
        <section className="nurse-mr-waiting-board">
          <header><strong>Chờ phản hồi</strong><span>{waiting.length} yêu cầu</span></header>
          {waiting.map((item) => (
            <button key={item.id} type="button" onClick={() => setSelected(item)}>
              <SeverityBadge value={item.priority === 'critical' ? 'critical' : item.priority === 'stat' ? 'high' : item.priority} />
              <div>
                <strong>{patientName(item)} · {item.request_no}</strong>
                <span>{item.sbar?.situation || sourceTypeLabel[item.category] || item.category}</span>
              </div>
              <em>{minutesText(item.sla_minutes)}</em>
            </button>
          ))}
        </section>
      </section>
      <div className="nurse-mr-table-wrap">
        <table className="nurse-mr-table">
          <thead><tr><th>Ưu tiên</th><th>Bệnh nhân</th><th>Người gửi</th><th>Bác sĩ nhận</th><th>Lý do</th><th>Đã đọc?</th><th>SLA</th><th>Phản hồi</th><th>Thao tác</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} onClick={() => setSelected(item)}>
                <td><SeverityBadge value={item.priority === 'critical' ? 'critical' : item.priority === 'stat' ? 'high' : item.priority} /></td>
                <td><strong>{patientName(item)}</strong><small>{patientCode(item)}</small></td>
                <td>{item.from_nurse?.full_name || '--'}</td>
                <td>{item.to_doctor?.full_name || '--'}</td>
                <td><strong>{item.sbar?.situation || sourceTypeLabel[item.category] || item.category}</strong><small>{formatTime(item.sent_at)}</small></td>
                <td><StatusPill value={item.seen_at ? 'seen' : item.status} /></td>
                <td><span className={item.sla_breached ? 'nurse-mr-sla is-breached' : 'nurse-mr-sla'}>{minutesText(item.sla_minutes)}</span></td>
                <td>{item.doctor_response || <span className="nurse-mr-muted">Chưa phản hồi</span>}</td>
                <td><ActionBar actions={['notify_doctor', 'escalate', 'add_note', 'create_emergency']} compact /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PatientDrawer item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
