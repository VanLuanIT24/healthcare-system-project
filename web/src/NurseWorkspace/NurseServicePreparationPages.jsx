import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  FlaskConical,
  HeartPulse,
  LayoutGrid,
  ListChecks,
  Loader2,
  MapPin,
  MessageSquarePlus,
  PanelRightOpen,
  PauseCircle,
  Play,
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
  X,
} from 'lucide-react';
import { nursePreparationApi } from './nurseApi';
import { confirmNurseAction, downloadNurseJson, notifyNurse, printNurseView, promptNurseText, runNurseAction } from './nurseActions';

const modeConfig = {
  waiting: {
    eyebrow: 'Điều dưỡng > Chuẩn bị dịch vụ',
    title: 'Chờ chuẩn bị',
    sourceType: '',
    icon: ClipboardCheck,
    tone: 'teal',
  },
  pre_exam: {
    eyebrow: 'Chuẩn bị dịch vụ',
    title: 'Trước khám',
    sourceType: 'pre_exam',
    icon: HeartPulse,
    tone: 'blue',
  },
  lab: {
    eyebrow: 'Chuẩn bị dịch vụ',
    title: 'Trước xét nghiệm',
    sourceType: 'lab',
    icon: FlaskConical,
    tone: 'cyan',
  },
  imaging: {
    eyebrow: 'Chuẩn bị dịch vụ',
    title: 'Trước CĐHA',
    sourceType: 'imaging',
    icon: ScanLine,
    tone: 'violet',
  },
  procedure: {
    eyebrow: 'Chuẩn bị dịch vụ',
    title: 'Trước thủ thuật',
    sourceType: 'procedure',
    icon: Stethoscope,
    tone: 'amber',
  },
  checklists: {
    eyebrow: 'Chuẩn bị dịch vụ',
    title: 'Bảng kiểm chuẩn bị',
    sourceType: '',
    icon: ClipboardList,
    tone: 'green',
  },
};

const priorityLabels = {
  routine: 'Thường quy',
  urgent: 'Khẩn',
  stat: 'STAT',
  high: 'Cao',
  medium: 'Trung bình',
};

const statusLabels = {
  pending: 'Chờ nhận',
  assigned: 'Đã nhận',
  in_progress: 'Đang chuẩn bị',
  ready: 'Sẵn sàng',
  blocked: 'Bị chặn',
  transferred: 'Đã chuyển',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  ordered: 'Đã chỉ định',
  scheduled: 'Đã lên lịch',
  collected: 'Đã lấy mẫu',
  received: 'Xét nghiệm đã nhận',
  no_show: 'Không đến',
  failed: 'Không đạt',
  waived: 'Được miễn',
  not_applicable: 'Không áp dụng',
  done: 'Đã xong',
};

const sourceLabels = {
  pre_exam: 'Trước khám',
  lab: 'Xét nghiệm',
  imaging: 'CĐHA',
  procedure: 'Thủ thuật',
  service: 'Dịch vụ',
  nursing: 'Điều dưỡng',
  other: 'Khác',
};

const slaLabels = {
  normal: 'Đúng hạn',
  warning: 'Sắp quá SLA',
  breached: 'Quá SLA',
};

const actionLabels = {
  assign: 'Nhận ca',
  start: 'Bắt đầu',
  ready: 'Sẵn sàng',
  block: 'Chặn',
  unblock: 'Gỡ chặn',
  transfer: 'Chuyển',
  complete: 'Hoàn tất',
  notify_doctor: 'Báo bác sĩ',
  notify_destination: 'Báo điểm đến',
  add_note: 'Ghi chú',
  open_checklist: 'Bảng kiểm',
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
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--/--/----';
  return date.toLocaleDateString('vi-VN');
}

function waitText(value) {
  const minutes = Number(value || 0);
  if (minutes < 60) return `${minutes}p`;
  return `${Math.floor(minutes / 60)}g ${minutes % 60}p`;
}

function patientName(item = {}) {
  return item.patient?.full_name || item.patient_name || 'Chưa rõ bệnh nhân';
}

function patientCode(item = {}) {
  return item.patient?.patient_code || item.patient_code || '--';
}

function serviceName(item = {}) {
  return item.title
    || item.lab_order?.test_name
    || [item.imaging_order?.modality?.toUpperCase?.(), item.imaging_order?.body_part].filter(Boolean).join(' - ')
    || item.procedure_order?.procedure_name
    || item.order?.order_no
    || 'Chuẩn bị dịch vụ';
}

function checklistPercent(item = {}) {
  const total = Number(item.checklist_total || 0);
  if (!total) return 0;
  return Math.round((Number(item.checklist_done || 0) / total) * 100);
}

function riskChips(item = {}) {
  const risks = item.risks || {};
  return [
    risks.has_allergy ? 'Dị ứng' : null,
    risks.has_contrast_risk ? 'Cản quang' : null,
    risks.missing_consent ? 'Thiếu phiếu đồng ý' : null,
    risks.missing_vital_sign ? 'Thiếu sinh hiệu' : null,
    risks.missing_attachment ? 'Thiếu tài liệu' : null,
    risks.critical_checklist_failed ? 'Mục bắt buộc không đạt' : null,
    risks.blocked ? 'Đang chặn' : null,
    risks.overdue ? 'Quá SLA' : null,
  ].filter(Boolean);
}

const demoWorklist = {
  items: [
    {
      id: 'demo-prep-1',
      preparation_no: 'PREP202605190001',
      source_type: 'lab',
      status: 'in_progress',
      priority: 'stat',
      title: 'Công thức máu + CRP',
      sla_due_at: new Date(Date.now() + 9 * 60000).toISOString(),
      sla_level: 'warning',
      readiness_score: 62,
      checklist_done: 5,
      checklist_total: 8,
      checklist_required_done: 4,
      checklist_required_total: 6,
      patient: { full_name: 'Nguyễn Minh Anh', patient_code: 'BN000128', gender: 'female', age: 34, phone: '0901 222 333' },
      encounter: { encounter_code: 'ENC202605190014', encounter_type: 'outpatient', status: 'arrived', attending_doctor: 'BS. Trần Quốc Minh', department: { department_name: 'Nội tổng quát' } },
      queue: { queue_no: 'A014', status: 'waiting', waiting_minutes: 18 },
      order: { order_no: 'ORD202605190021', order_type: 'lab', status: 'ordered', clinical_indication: 'Sốt cao chưa rõ nguyên nhân', ordered_at: new Date(Date.now() - 18 * 60000).toISOString(), ordered_by: 'BS. Trần Quốc Minh' },
      lab_order: { lab_order_no: 'LAB202605190018', test_name: 'CBC + CRP', specimen_type: 'Máu tĩnh mạch', status: 'ordered' },
      risks: { has_allergy: true, missing_consent: false, missing_vital_sign: false, overdue: false },
      assigned_nurse: { full_name: 'ĐD. Lan' },
      allowed_actions: ['open_checklist', 'ready', 'block', 'notify_doctor'],
    },
    {
      id: 'demo-prep-2',
      preparation_no: 'PREP202605190002',
      source_type: 'imaging',
      status: 'blocked',
      priority: 'urgent',
      title: 'CT bụng có cản quang',
      sla_due_at: new Date(Date.now() - 6 * 60000).toISOString(),
      sla_level: 'breached',
      readiness_score: 48,
      checklist_done: 6,
      checklist_total: 13,
      checklist_required_done: 4,
      checklist_required_total: 9,
      patient: { full_name: 'Lê Hoàng Nam', patient_code: 'BN000143', gender: 'male', age: 58, phone: '0912 444 555' },
      encounter: { encounter_code: 'ENC202605190019', encounter_type: 'emergency', status: 'in_progress', attending_doctor: 'BS. Phạm Hạnh', department: { department_name: 'Cấp cứu' } },
      imaging_order: { imaging_order_no: 'IMG202605190007', modality: 'ct', body_part: 'Bụng', contrast_required: true, scheduled_at: new Date(Date.now() + 22 * 60000).toISOString(), status: 'scheduled' },
      order: { order_no: 'ORD202605190026', order_type: 'imaging', status: 'acknowledged', clinical_indication: 'Đau bụng cấp', ordered_at: new Date(Date.now() - 42 * 60000).toISOString(), ordered_by: 'BS. Phạm Hạnh' },
      risks: { has_allergy: true, has_contrast_risk: true, missing_consent: true, missing_vital_sign: false, blocked: true, overdue: true },
      assigned_nurse: { full_name: 'ĐD. Quỳnh' },
      blocked_reason_text: 'Chưa có phiếu đồng ý dùng thuốc cản quang',
      allowed_actions: ['open_checklist', 'unblock', 'notify_doctor'],
    },
    {
      id: 'demo-prep-3',
      preparation_no: 'PREP202605190003',
      source_type: 'pre_exam',
      status: 'pending',
      priority: 'routine',
      title: 'Chuẩn bị trước khám A021',
      sla_due_at: new Date(Date.now() + 19 * 60000).toISOString(),
      sla_level: 'normal',
      readiness_score: 20,
      checklist_done: 2,
      checklist_total: 9,
      checklist_required_done: 1,
      checklist_required_total: 5,
      patient: { full_name: 'Trần Thị Hà', patient_code: 'BN000151', gender: 'female', age: 27, phone: '0933 777 888' },
      encounter: { encounter_code: 'ENC202605190025', encounter_type: 'outpatient', status: 'arrived', attending_doctor: 'BS. Đỗ An', department: { department_name: 'Sản phụ khoa' } },
      queue: { queue_no: 'A021', status: 'waiting', waiting_minutes: 12 },
      risks: { missing_vital_sign: true },
      allowed_actions: ['assign', 'start', 'open_checklist'],
    },
    {
      id: 'demo-prep-4',
      preparation_no: 'PREP202605190004',
      source_type: 'procedure',
      status: 'ready',
      priority: 'urgent',
      title: 'Nội soi dạ dày',
      sla_due_at: new Date(Date.now() + 38 * 60000).toISOString(),
      sla_level: 'normal',
      readiness_score: 100,
      checklist_done: 12,
      checklist_total: 12,
      checklist_required_done: 8,
      checklist_required_total: 8,
      patient: { full_name: 'Phạm Bảo Long', patient_code: 'BN000172', gender: 'male', age: 46, phone: '0908 321 111' },
      encounter: { encounter_code: 'ENC202605190033', encounter_type: 'outpatient', status: 'in_progress', attending_doctor: 'BS. Nguyễn Khoa', department: { department_name: 'Tiêu hóa' } },
      procedure_order: { procedure_order_no: 'PRO202605190005', procedure_name: 'Nội soi dạ dày', procedure_code: 'NSDD', scheduled_start: new Date(Date.now() + 40 * 60000).toISOString(), status: 'scheduled' },
      order: { order_no: 'ORD202605190035', order_type: 'procedure', status: 'acknowledged', clinical_indication: 'Đau thượng vị kéo dài', ordered_at: new Date(Date.now() - 55 * 60000).toISOString(), ordered_by: 'BS. Nguyễn Khoa' },
      risks: { has_allergy: false, missing_consent: false, missing_vital_sign: false },
      assigned_nurse: { full_name: 'ĐD. Hương' },
      allowed_actions: ['transfer', 'complete', 'notify_destination'],
    },
  ],
  summary: { total: 4, pending: 1, assigned: 0, in_progress: 1, ready: 1, blocked: 1, overdue: 1, stat: 1, missing_required: 2, safety_risk: 1 },
};

function usePreparationWorklist(mode, filters, refresh) {
  const [data, setData] = useState(demoWorklist);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState('');
  const config = modeConfig[mode] || modeConfig.waiting;

  useEffect(() => {
    let cancelled = false;
    const params = {
      date: filters.date,
      source_type: config.sourceType || undefined,
      status: filters.status === 'all' ? undefined : filters.status,
      priority: filters.priority === 'all' ? undefined : filters.priority,
      sla: filters.sla === 'all' ? undefined : filters.sla,
      assigned_nurse_id: filters.owner === 'me' ? 'me' : filters.owner === 'unassigned' ? 'unassigned' : undefined,
      keyword: filters.keyword || undefined,
      include_completed: mode === 'checklists' ? true : undefined,
      limit: 160,
    };
    setLoading(true);
    nursePreparationApi.getWorklist(params)
      .then((payload) => {
        if (cancelled) return;
        const sourceItems = config.sourceType
          ? (payload?.items || []).filter((item) => item.source_type === config.sourceType)
          : payload?.items || [];
        setData({ ...payload, items: sourceItems });
        setIsDemo(false);
        setError('');
      })
      .catch((loadError) => {
        if (cancelled) return;
        const fallbackItems = config.sourceType
          ? demoWorklist.items.filter((item) => item.source_type === config.sourceType)
          : demoWorklist.items;
        setData({ ...demoWorklist, items: fallbackItems });
        setIsDemo(true);
        setError(loadError?.message || 'Không tải được worklist chuẩn bị dịch vụ.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, filters.date, filters.status, filters.priority, filters.sla, filters.owner, filters.keyword, refresh]);

  return { data, loading, isDemo, error };
}

function PrepHeader({ mode, data, loading, isDemo, error, refresh }) {
  const config = modeConfig[mode] || modeConfig.waiting;
  const Icon = config.icon;
  return (
    <header className={`nurse-prep-header nurse-prep-header--${config.tone}`}>
      <div>
        <span>{config.eyebrow}</span>
        <h1><Icon size={30} />{config.title}</h1>
        <div className="nurse-prep-header__meta">
          <em>{formatDate(new Date())}</em>
          <em>{isDemo ? 'Dữ liệu mẫu' : 'API chuẩn bị điều dưỡng'}</em>
          <em>{loading ? 'Đang đồng bộ' : `${data.items?.length || 0} ca hiển thị`}</em>
        </div>
      </div>
      <aside>
        <span className={`nurse-prep-live${isDemo ? ' is-demo' : ''}`}>
          {isDemo ? <AlertTriangle size={15} /> : <Activity size={15} />}
          {isDemo ? 'Dữ liệu mẫu' : 'Thời gian thực sẵn sàng'}
        </span>
        <button type="button" onClick={refresh}><RefreshCw size={16} />Làm mới</button>
        {isDemo && error ? <small>{error}</small> : null}
      </aside>
    </header>
  );
}

function PrepKpiGrid({ summary = {}, items = [], setQuickStatus }) {
  const missingVitals = items.filter((item) => item.risks?.missing_vital_sign).length;
  const missingConsent = items.filter((item) => item.risks?.missing_consent).length;
  const allergy = items.filter((item) => item.risks?.has_allergy).length;
  const contrast = items.filter((item) => item.risks?.has_contrast_risk || item.imaging_order?.contrast_required).length;
  const kpis = [
    ['Tổng ca', summary.total ?? items.length, 'Tất cả nguồn', ClipboardCheck, 'blue', 'all'],
    ['STAT', summary.stat || items.filter((item) => item.priority === 'stat').length, 'Ưu tiên ngay', ShieldAlert, 'red', 'stat'],
    ['Quá SLA', summary.overdue || items.filter((item) => item.sla_level === 'breached').length, 'Cần xử lý', Clock3, 'amber', 'breached'],
    ['Đang chặn', summary.blocked || 0, 'Thiếu điều kiện', PauseCircle, 'red', 'blocked'],
    ['Đang chuẩn bị', summary.in_progress || 0, 'Đã bắt đầu', Play, 'teal', 'in_progress'],
    ['Sẵn sàng', summary.ready || 0, 'Có thể chuyển bước', BadgeCheck, 'green', 'ready'],
    ['Thiếu sinh hiệu', missingVitals, 'Bối cảnh lâm sàng', HeartPulse, 'cyan', 'missing_vitals'],
    ['Thiếu phiếu đồng ý', missingConsent, 'Tài liệu bắt buộc', FileCheck2, 'violet', 'missing_consent'],
    ['Có dị ứng', allergy, 'An toàn', AlertTriangle, 'amber', 'allergy'],
    ['Có cản quang', contrast, 'An toàn CĐHA', ScanLine, 'indigo', 'contrast'],
  ];

  return (
    <section className="nurse-prep-kpis">
      {kpis.map(([label, value, detail, Icon, tone, quick]) => (
        <button key={label} type="button" className={`nurse-prep-kpi nurse-prep-kpi--${tone}`} onClick={() => {
          setQuickStatus?.(quick);
          notifyNurse({ title: label, message: `Đã lọc nhanh nhóm: ${detail}.` });
        }}>
          <Icon size={20} />
          <span>{label}</span>
          <strong>{value || 0}</strong>
          <small>{detail}</small>
        </button>
      ))}
    </section>
  );
}

function PrepFilters({ filters, setFilters, mode, view, setView }) {
  return (
    <section className="nurse-prep-filters">
      <label><span>Ngày</span><input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} /></label>
      <label><span>Trạng thái</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Tất cả</option><option value="pending">Chờ nhận</option><option value="assigned">Đã nhận</option><option value="in_progress">Đang chuẩn bị</option><option value="ready">Sẵn sàng</option><option value="blocked">Bị chặn</option><option value="transferred">Đã chuyển</option><option value="completed">Hoàn tất</option></select></label>
      <label><span>Ưu tiên</span><select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}><option value="all">Tất cả</option><option value="stat">STAT</option><option value="urgent">Khẩn</option><option value="routine">Thường quy</option></select></label>
      <label><span>SLA</span><select value={filters.sla} onChange={(event) => setFilters((current) => ({ ...current, sla: event.target.value }))}><option value="all">Tất cả</option><option value="normal">Đúng hạn</option><option value="warning">Sắp quá SLA</option><option value="breached">Quá SLA</option></select></label>
      <label><span>Phụ trách</span><select value={filters.owner} onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))}><option value="all">Tất cả</option><option value="me">Của tôi</option><option value="unassigned">Chưa ai nhận</option></select></label>
      <label className="nurse-prep-search"><span>Tìm kiếm</span><div><Search size={15} /><input value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder="Tên, mã BN, chỉ định..." /></div></label>
      <div className="nurse-prep-view-switch" aria-label="Đổi kiểu xem">
        {[
          ['table', Table2],
          ['kanban', LayoutGrid],
          ['timeline', CalendarClock],
          ['room', MapPin],
        ].map(([key, Icon]) => (
          <button key={key} type="button" className={view === key ? 'is-active' : ''} onClick={() => setView(key)} disabled={mode === 'checklists' && key === 'room'}>
            <Icon size={16} />
          </button>
        ))}
      </div>
    </section>
  );
}

function PrepProgress({ item }) {
  const percent = checklistPercent(item);
  return (
    <div className="nurse-prep-progress" title={`${item.checklist_done || 0}/${item.checklist_total || 0}`}>
      <span><em style={{ width: `${percent}%` }} /></span>
      <small>{item.checklist_done || 0}/{item.checklist_total || 0} · bắt buộc {item.checklist_required_done || 0}/{item.checklist_required_total || 0}</small>
    </div>
  );
}

function RowActions({ item, onAction }) {
  const actions = (item.allowed_actions || []).filter((action) => action !== 'open_checklist').slice(0, 4);
  return (
    <div className="nurse-prep-row-actions">
      {actions.map((action) => (
        <button key={action} type="button" onClick={(event) => { event.stopPropagation(); onAction(item, action); }}>
          {actionLabels[action] || action}
        </button>
      ))}
    </div>
  );
}

function WorklistTable({ items, onSelect, onAction }) {
  return (
    <div className="nurse-prep-table-wrap">
      <table className="nurse-prep-table">
        <thead>
          <tr>
            <th>Ưu tiên</th>
            <th>SLA</th>
            <th>Bệnh nhân</th>
            <th>Lượt khám / hàng đợi</th>
            <th>Loại</th>
            <th>Dịch vụ</th>
            <th>Chỉ định</th>
            <th>Trạng thái</th>
            <th>Bảng kiểm</th>
            <th>Cảnh báo</th>
            <th>Phụ trách</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} onClick={() => onSelect(item)}>
              <td><span className={`nurse-prep-priority nurse-prep-priority--${item.priority}`}>{priorityLabels[item.priority] || item.priority}</span></td>
              <td><span className={`nurse-prep-sla nurse-prep-sla--${item.sla_level}`}>{slaLabels[item.sla_level] || item.sla_level}</span><small>{formatTime(item.sla_due_at)}</small></td>
              <td><strong>{patientName(item)}</strong><small>{patientCode(item)} · {item.patient?.age ?? '--'}t · {item.patient?.gender || '--'}</small></td>
              <td><strong>{item.encounter?.encounter_code || '--'}</strong><small>{item.queue?.queue_no || '--'} · chờ {waitText(item.queue?.waiting_minutes)}</small></td>
              <td>{sourceLabels[item.source_type] || item.source_type}</td>
              <td><strong>{serviceName(item)}</strong><small>{item.order?.clinical_indication || item.lab_order?.specimen_type || item.imaging_order?.body_part || item.procedure_order?.procedure_code || '--'}</small></td>
              <td><strong>{item.order?.order_no || item.lab_order?.lab_order_no || item.imaging_order?.imaging_order_no || item.procedure_order?.procedure_order_no || '--'}</strong><small>{statusLabels[item.order?.status] || item.order?.status || '--'} · {formatTime(item.order?.ordered_at)}</small></td>
              <td><span className={`nurse-prep-status nurse-prep-status--${item.status}`}>{statusLabels[item.status] || item.status}</span></td>
              <td><PrepProgress item={item} /></td>
              <td><div className="nurse-prep-risk-chips">{riskChips(item).slice(0, 3).map((risk) => <em key={risk}>{risk}</em>)}</div></td>
              <td>{item.assigned_nurse?.full_name || 'Chưa nhận'}</td>
              <td><RowActions item={item} onAction={onAction} /></td>
            </tr>
          ))}
          {!items.length ? <tr><td colSpan={12} className="nurse-prep-empty">Không có ca phù hợp bộ lọc.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function KanbanView({ items, onSelect, onAction }) {
  const columns = [
    ['pending', 'Chờ nhận'],
    ['assigned', 'Đã nhận'],
    ['in_progress', 'Đang chuẩn bị'],
    ['ready', 'Sẵn sàng'],
    ['blocked', 'Đang chặn'],
    ['transferred', 'Đã chuyển'],
  ];
  return (
    <section className="nurse-prep-kanban">
      {columns.map(([status, label]) => {
        const columnItems = items.filter((item) => item.status === status);
        return (
          <section key={status} className={`nurse-prep-kanban__column nurse-prep-kanban__column--${status}`}>
            <header><strong>{label}</strong><span>{columnItems.length}</span></header>
            {columnItems.map((item) => (
              <article key={item.id} className={`nurse-prep-card nurse-prep-card--${item.priority}`} onClick={() => onSelect(item)}>
                <header><span>{sourceLabels[item.source_type]}</span><strong>{serviceName(item)}</strong></header>
                <p>{patientName(item)} · {patientCode(item)}</p>
                <PrepProgress item={item} />
                <footer>
                  <span className={`nurse-prep-sla nurse-prep-sla--${item.sla_level}`}>{slaLabels[item.sla_level]}</span>
                  <RowActions item={item} onAction={onAction} />
                </footer>
              </article>
            ))}
          </section>
        );
      })}
    </section>
  );
}

function TimelineView({ items, onSelect }) {
  const sorted = [...items].sort((a, b) => new Date(a.sla_due_at || 0) - new Date(b.sla_due_at || 0));
  return (
    <section className="nurse-prep-timeline-view">
      {sorted.map((item) => (
        <button key={item.id} type="button" className={`nurse-prep-timeline-item nurse-prep-timeline-item--${item.sla_level}`} onClick={() => onSelect(item)}>
          <time>{formatTime(item.sla_due_at)}</time>
          <span>{sourceLabels[item.source_type]}</span>
          <strong>{serviceName(item)}</strong>
          <small>{patientName(item)} · {statusLabels[item.status] || item.status} · {item.assigned_nurse?.full_name || 'Chưa nhận'}</small>
        </button>
      ))}
    </section>
  );
}

function RoomBoardView({ items, onSelect }) {
  const groups = items.reduce((output, item) => {
    const key = item.destination_department?.department_name || item.encounter?.department?.department_name || 'Chưa có khoa đích';
    output[key] = output[key] || [];
    output[key].push(item);
    return output;
  }, {});
  return (
    <section className="nurse-prep-room-board">
      {Object.entries(groups).map(([room, roomItems]) => (
        <section key={room}>
          <header><MapPin size={16} /><strong>{room}</strong><span>{roomItems.length}</span></header>
          {roomItems.map((item) => (
            <button key={item.id} type="button" onClick={() => onSelect(item)}>
              <span className={`nurse-prep-priority nurse-prep-priority--${item.priority}`}>{priorityLabels[item.priority]}</span>
              <strong>{item.queue?.queue_no || item.preparation_no}</strong>
              <small>{patientName(item)} · {serviceName(item)}</small>
            </button>
          ))}
        </section>
      ))}
    </section>
  );
}

function ServiceSpecificPanel({ item }) {
  if (!item) return null;
  if (item.source_type === 'lab') {
    return (
      <section className="nurse-prep-special-panel">
        <h3><FlaskConical size={16} />Mẫu xét nghiệm</h3>
        <dl>
          <div><dt>Chỉ định xét nghiệm</dt><dd>{item.lab_order?.lab_order_no || '--'}</dd></div>
          <div><dt>Xét nghiệm</dt><dd>{item.lab_order?.test_name || '--'}</dd></div>
          <div><dt>Loại mẫu</dt><dd>{item.lab_order?.specimen_type || '--'}</dd></div>
          <div><dt>Trạng thái</dt><dd>{statusLabels[item.lab_order?.status] || item.lab_order?.status || '--'}</dd></div>
        </dl>
      </section>
    );
  }
  if (item.source_type === 'imaging') {
    return (
      <section className="nurse-prep-special-panel">
        <h3><ScanLine size={16} />An toàn CĐHA</h3>
        <dl>
          <div><dt>Phương thức</dt><dd>{item.imaging_order?.modality?.toUpperCase?.() || '--'}</dd></div>
          <div><dt>Vùng chụp</dt><dd>{item.imaging_order?.body_part || '--'}</dd></div>
          <div><dt>Cản quang</dt><dd>{item.imaging_order?.contrast_required ? 'Có' : 'Không'}</dd></div>
          <div><dt>Lịch</dt><dd>{formatTime(item.imaging_order?.scheduled_at)}</dd></div>
        </dl>
      </section>
    );
  }
  if (item.source_type === 'procedure') {
    return (
      <section className="nurse-prep-special-panel">
        <h3><Stethoscope size={16} />Thủ thuật</h3>
        <dl>
          <div><dt>Mã</dt><dd>{item.procedure_order?.procedure_code || '--'}</dd></div>
          <div><dt>Tên</dt><dd>{item.procedure_order?.procedure_name || '--'}</dd></div>
          <div><dt>Người thực hiện</dt><dd>{item.procedure_order?.performer || '--'}</dd></div>
          <div><dt>Bắt đầu</dt><dd>{formatTime(item.procedure_order?.scheduled_start)}</dd></div>
        </dl>
      </section>
    );
  }
  return (
    <section className="nurse-prep-special-panel">
      <h3><HeartPulse size={16} />Trước khám</h3>
      <dl>
        <div><dt>Hàng đợi</dt><dd>{item.queue?.queue_no || '--'}</dd></div>
        <div><dt>Bác sĩ</dt><dd>{item.encounter?.attending_doctor || '--'}</dd></div>
        <div><dt>Khoa</dt><dd>{item.encounter?.department?.department_name || '--'}</dd></div>
        <div><dt>Chờ</dt><dd>{waitText(item.queue?.waiting_minutes)}</dd></div>
      </dl>
    </section>
  );
}

function PreparationDrawer({ selected, detail, context, loading, onClose, onChecklistAction, onAction }) {
  const [tab, setTab] = useState('overview');
  if (!selected) return null;
  const item = detail?.preparation || selected;
  const checklist = detail?.checklist || [];
  const timeline = detail?.timeline || [];
  const tabs = [
    ['overview', 'Tổng quan', PanelRightOpen],
    ['checklist', 'Bảng kiểm', ListChecks],
    ['safety', 'An toàn', ShieldAlert],
    ['clinical', 'Lâm sàng', HeartPulse],
    ['documents', 'Tài liệu', FileText],
    ['timeline', 'Dòng thời gian', Activity],
  ];

  return (
    <aside className="nurse-prep-drawer">
      <header>
        <button type="button" onClick={onClose}><X size={17} /></button>
        <span className={`nurse-prep-priority nurse-prep-priority--${item.priority}`}>{priorityLabels[item.priority] || item.priority}</span>
        <h2>{patientName(item)}</h2>
        <p>{patientCode(item)} · {item.preparation_no} · {sourceLabels[item.source_type]}</p>
      </header>
      <nav>
        {tabs.map(([key, label, Icon]) => (
          <button key={key} type="button" className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
            <Icon size={15} />{label}
          </button>
        ))}
      </nav>
      {loading ? <div className="nurse-prep-drawer__loading"><Loader2 className="is-spinning" size={17} />Đang tải chi tiết...</div> : null}
      {tab === 'overview' ? (
        <main>
          <ServiceSpecificPanel item={item} />
          <section>
            <h3>Tổng quan</h3>
            <dl>
              <div><dt>Lượt khám</dt><dd>{item.encounter?.encounter_code || '--'}</dd></div>
              <div><dt>Trạng thái</dt><dd>{statusLabels[item.status] || item.status}</dd></div>
              <div><dt>SLA</dt><dd>{slaLabels[item.sla_level] || item.sla_level} · {formatTime(item.sla_due_at)}</dd></div>
              <div><dt>Điều dưỡng</dt><dd>{item.assigned_nurse?.full_name || 'Chưa nhận'}</dd></div>
              <div><dt>Chỉ định</dt><dd>{item.order?.clinical_indication || item.description || '--'}</dd></div>
              <div><dt>Bác sĩ</dt><dd>{item.order?.ordered_by || item.encounter?.attending_doctor || '--'}</dd></div>
            </dl>
          </section>
          <section className="nurse-prep-drawer-actions">
            <button type="button" onClick={() => onAction(item, 'assign')}><UserCheck size={15} />Nhận ca</button>
            <button type="button" onClick={() => onAction(item, 'start')}><Play size={15} />Bắt đầu</button>
            <button type="button" onClick={() => onAction(item, 'ready')}><BadgeCheck size={15} />Sẵn sàng</button>
            <button type="button" onClick={() => onAction(item, 'notify_doctor')}><Send size={15} />Báo bác sĩ</button>
          </section>
        </main>
      ) : null}
      {tab === 'checklist' ? (
        <main className="nurse-prep-checklist-panel">
          <PrepProgress item={item} />
          {checklist.map((entry) => (
            <article key={entry.id || entry._id} className={`nurse-prep-check-item nurse-prep-check-item--${entry.status}`}>
              <div>
                <strong>{entry.label}</strong>
                <span>{entry.category || 'bảng kiểm'}{entry.required ? ' · bắt buộc' : ''}{entry.critical ? ' · quan trọng' : ''}</span>
              </div>
              <em>{statusLabels[entry.status] || entry.status}</em>
              <footer>
                <button type="button" onClick={() => onChecklistAction(item, entry, 'done')}><Check size={14} />Đạt</button>
                <button type="button" onClick={() => onChecklistAction(item, entry, 'failed')}><AlertTriangle size={14} />Không đạt</button>
                <button type="button" onClick={() => onChecklistAction(item, entry, 'waived')}><ArrowRight size={14} />Miễn</button>
              </footer>
            </article>
          ))}
          {!checklist.length ? <p className="nurse-prep-empty-inline">Bảng kiểm chưa có dữ liệu chi tiết.</p> : null}
        </main>
      ) : null}
      {tab === 'safety' ? (
        <main>
          <section>
            <h3>Cảnh báo</h3>
            <div className="nurse-prep-risk-list">
              {riskChips(item).map((risk) => <span key={risk}>{risk}</span>)}
              {!riskChips(item).length ? <span>Không có cảnh báo đang mở</span> : null}
            </div>
          </section>
          <section>
            <h3>Dị ứng</h3>
            {(context?.allergies || []).slice(0, 5).map((allergy) => <p key={allergy.id || allergy._id}>{allergy.allergen} · {allergy.reaction || allergy.severity || '--'}</p>)}
          </section>
        </main>
      ) : null}
      {tab === 'clinical' ? (
        <main>
          <section>
            <h3>Sinh hiệu mới nhất</h3>
            <dl>
              <div><dt>Mạch</dt><dd>{context?.latest_vital_signs?.heart_rate ?? '--'}</dd></div>
              <div><dt>HA</dt><dd>{context?.latest_vital_signs?.systolic_bp ? `${context.latest_vital_signs.systolic_bp}/${context.latest_vital_signs.diastolic_bp}` : '--'}</dd></div>
              <div><dt>SpO2</dt><dd>{context?.latest_vital_signs?.spo2 ?? '--'}</dd></div>
              <div><dt>Nhiệt</dt><dd>{context?.latest_vital_signs?.temperature ?? '--'}</dd></div>
            </dl>
          </section>
          <section>
            <h3>Danh sách vấn đề</h3>
            {(context?.problems || []).slice(0, 6).map((problem) => <p key={problem.id || problem._id}>{problem.problem_name} · {problem.severity || '--'}</p>)}
          </section>
          <section>
            <h3>Ghi chú gần đây</h3>
            {(context?.clinical_notes || []).slice(0, 4).map((note) => <p key={note.id || note._id}>{note.title || note.note_type} · {formatTime(note.created_at)}</p>)}
          </section>
        </main>
      ) : null}
      {tab === 'documents' ? (
        <main>
          <section>
            <h3>Phiếu đồng ý</h3>
            {(context?.consent_records || []).slice(0, 5).map((consent) => <p key={consent.id || consent._id}>{consent.consent_type || 'Phiếu đồng ý'} · {statusLabels[consent.status] || consent.status}</p>)}
          </section>
          <section>
            <h3>Tệp đính kèm</h3>
            {(context?.attachments || []).slice(0, 8).map((file) => <p key={file.id || file._id}>{file.original_name || file.file_name} · {file.category || file.mime_type || '--'}</p>)}
          </section>
        </main>
      ) : null}
      {tab === 'timeline' ? (
        <main className="nurse-prep-drawer-timeline">
          {timeline.map((event) => <article key={event.id || `${event.event_type}-${event.event_time}`}><span>{formatTime(event.event_time)}</span><strong>{event.title}</strong><small>{event.actor?.full_name || 'Hệ thống'}</small></article>)}
          {!timeline.length ? <article><span>--:--</span><strong>Chưa có hoạt động</strong><small>Dòng thời gian sẽ cập nhật khi thao tác</small></article> : null}
        </main>
      ) : null}
    </aside>
  );
}

function ChecklistTemplateManager({ items, onSelect }) {
  const [templates, setTemplates] = useState([]);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      nursePreparationApi.getTemplates({ limit: 120 }),
      nursePreparationApi.previewTemplate({ source_type: 'imaging', modality: 'ct', contrast_required: true }),
    ])
      .then(([templatePayload, previewPayload]) => {
        if (cancelled) return;
        setTemplates(templatePayload.items || []);
        setPreview(previewPayload.items || []);
      })
      .catch(() => {
        if (cancelled) return;
        setTemplates([
          { id: 'tpl-demo-1', template_code: 'PRE_EXAM_DEFAULT', name: 'Trước khám mặc định', source_type: 'pre_exam', version: 1, is_active: true, items: new Array(9).fill(null) },
          { id: 'tpl-demo-2', template_code: 'IMAGING_CT_CONTRAST', name: 'CT có cản quang', source_type: 'imaging', modality: 'ct', version: 1, is_active: true, items: new Array(11).fill(null) },
          { id: 'tpl-demo-3', template_code: 'PROCEDURE_WITH_CONSENT', name: 'Thủ thuật có phiếu đồng ý', source_type: 'procedure', version: 1, is_active: true, items: new Array(12).fill(null) },
        ]);
        setPreview([
          { code: 'identity_confirmed', label: 'Xác nhận đúng bệnh nhân', required: true, critical: true },
          { code: 'contrast_allergy_screened', label: 'Sàng lọc dị ứng thuốc cản quang', required: true, critical: true },
          { code: 'contrast_consent_ready', label: 'Phiếu đồng ý cản quang', required: true, critical: true },
        ]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openChecklistItems = items.filter((item) => item.status !== 'completed' && item.status !== 'cancelled');
  const templateIdOf = (template) => template?._id || template?.id || template?.template_id;

  async function editTemplate(template) {
    const templateId = templateIdOf(template);
    const name = promptNurseText({ title: 'Sửa mẫu bảng kiểm', message: template.template_code || template.name, defaultValue: template.name || '' });
    if (!name) return;
    await runNurseAction({
      label: 'Sửa mẫu bảng kiểm',
      isDemo: !templateId || String(templateId).startsWith('tpl-demo'),
      demoMessage: 'Mẫu demo chưa thể cập nhật backend.',
      confirm: { title: 'Cập nhật mẫu?', message: name },
      run: () => nursePreparationApi.updateTemplate(templateId, { name }),
      successMessage: 'Đã cập nhật mẫu bảng kiểm.',
      onSuccess: () => setTemplates((current) => current.map((entry) => (templateIdOf(entry) === templateId ? { ...entry, name } : entry))),
    });
  }

  async function cloneTemplate(template) {
    const templateId = templateIdOf(template);
    await runNurseAction({
      label: 'Nhân bản mẫu',
      isDemo: !templateId || String(templateId).startsWith('tpl-demo'),
      demoMessage: 'Mẫu demo chưa thể nhân bản backend.',
      confirm: { title: 'Nhân bản mẫu bảng kiểm?', message: template.name || template.template_code },
      run: () => nursePreparationApi.cloneTemplate(templateId, { name: `${template.name || template.template_code} - copy` }),
      successMessage: 'Đã nhân bản mẫu bảng kiểm.',
      onSuccess: (result) => setTemplates((current) => [result, ...current].filter(Boolean)),
    });
  }

  function previewTemplate(template) {
    const items = Array.isArray(template.items) && template.items.length
      ? template.items
      : preview;
    setPreview(items);
    notifyNurse({ title: 'Xem trước mẫu', message: template.name || template.template_code || 'Mẫu bảng kiểm' });
  }

  return (
    <section className="nurse-prep-checklist-manager">
      <main>
        <header><ClipboardList size={17} /><strong>Bảng kiểm đang mở</strong><span>{openChecklistItems.length}</span></header>
        <div className="nurse-prep-open-checklists">
          {openChecklistItems.map((item) => (
            <button key={item.id} type="button" onClick={() => onSelect(item)}>
              <span className={`nurse-prep-sla nurse-prep-sla--${item.sla_level}`}>{slaLabels[item.sla_level]}</span>
              <strong>{patientName(item)} · {sourceLabels[item.source_type]}</strong>
              <small>{serviceName(item)} · bắt buộc {item.checklist_required_done}/{item.checklist_required_total}</small>
              <PrepProgress item={item} />
            </button>
          ))}
        </div>
      </main>
      <aside>
        <header><FileText size={17} /><strong>Mẫu bảng kiểm</strong>{loading ? <Loader2 className="is-spinning" size={15} /> : <span>{templates.length}</span>}</header>
        <div className="nurse-prep-template-table">
          {templates.map((template) => (
            <article key={template.id || template._id || template.template_code}>
              <strong>{template.template_code}</strong>
              <span>{template.name}</span>
              <small>{sourceLabels[template.source_type] || template.source_type} · {template.items?.length || 0} mục · v{template.version}</small>
              <footer>
                <button type="button" onClick={() => editTemplate(template)}>Sửa</button>
                <button type="button" onClick={() => cloneTemplate(template)}>Nhân bản</button>
                <button type="button" onClick={() => previewTemplate(template)}>Xem trước</button>
              </footer>
            </article>
          ))}
        </div>
        <section className="nurse-prep-template-preview">
          <h3>Xem trước CT cản quang</h3>
          {preview.slice(0, 7).map((item) => <p key={item.code}><CheckCircle2 size={14} />{item.label}{item.required ? ' · bắt buộc' : ''}</p>)}
        </section>
      </aside>
    </section>
  );
}

function filterItemsByQuick(items, quick) {
  if (!quick || quick === 'all') return items;
  if (quick === 'stat') return items.filter((item) => item.priority === 'stat');
  if (quick === 'breached') return items.filter((item) => item.sla_level === 'breached');
  if (quick === 'missing_vitals') return items.filter((item) => item.risks?.missing_vital_sign);
  if (quick === 'missing_consent') return items.filter((item) => item.risks?.missing_consent);
  if (quick === 'allergy') return items.filter((item) => item.risks?.has_allergy);
  if (quick === 'contrast') return items.filter((item) => item.risks?.has_contrast_risk || item.imaging_order?.contrast_required);
  return items.filter((item) => item.status === quick);
}

function ServicePreparationPage({ mode }) {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), status: 'all', priority: 'all', sla: 'all', owner: 'all', keyword: '' });
  const [view, setView] = useState(mode === 'checklists' ? 'table' : 'table');
  const [quick, setQuick] = useState('all');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [context, setContext] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = usePreparationWorklist(mode, filters, refresh);
  const items = useMemo(() => filterItemsByQuick(data.items || [], quick), [data.items, quick]);

  useEffect(() => {
    if (!selected?.id || String(selected.id).startsWith('demo-')) {
      setDetail({ preparation: selected, checklist: [], timeline: [] });
      setContext(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    Promise.all([
      nursePreparationApi.getDetail(selected.id),
      nursePreparationApi.getContext(selected.id),
    ])
      .then(([detailPayload, contextPayload]) => {
        if (cancelled) return;
        setDetail(detailPayload);
        setContext(contextPayload);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail({ preparation: selected, checklist: [], timeline: [] });
        setContext(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  async function handleAction(item, action) {
    if (!item?.id || String(item.id).startsWith('demo-')) {
      notifyNurse({ tone: 'warning', title: actionLabels[action] || 'Chuẩn bị dịch vụ', message: 'Dữ liệu mẫu hoặc thiếu preparation_id nên chưa thể gửi thao tác.' });
      return;
    }
    const note = action === 'add_note'
      ? promptNurseText({ title: 'Ghi chú chuẩn bị', message: serviceName(item), defaultValue: 'Cập nhật từ màn chuẩn bị dịch vụ.' })
      : null;
    if (action === 'add_note' && !note) return;
    const actionMap = {
      assign: () => nursePreparationApi.assign(item.id),
      start: () => nursePreparationApi.start(item.id),
      block: () => nursePreparationApi.block(item.id, { reason: 'Thiếu điều kiện chuẩn bị' }),
      unblock: () => nursePreparationApi.unblock(item.id),
      ready: () => nursePreparationApi.ready(item.id, { allow_incomplete: true }),
      transfer: () => nursePreparationApi.transfer(item.id),
      complete: () => nursePreparationApi.complete(item.id),
      notify_doctor: () => nursePreparationApi.notifyDoctor(item.id, { message: 'Bệnh nhân cần bác sĩ xem lại trước khi chuyển bước.' }),
      notify_destination: () => nursePreparationApi.notifyDestination(item.id),
      add_note: () => nursePreparationApi.addNote(item.id, { note }),
    };
    await runNurseAction({
      label: actionLabels[action] || 'Cập nhật chuẩn bị',
      confirm: ['ready', 'transfer', 'complete', 'notify_doctor', 'notify_destination', 'block'].includes(action)
        ? { title: actionLabels[action] || 'Xác nhận thao tác', message: `${patientName(item)} - ${serviceName(item)}` }
        : null,
      run: actionMap[action] || actionMap.add_note,
      successMessage: 'Đã cập nhật chuẩn bị dịch vụ.',
      onSuccess: () => setRefresh((value) => value + 1),
    });
  }

  async function handleChecklistAction(item, entry, action) {
    const itemId = entry?.id || entry?._id;
    if (!item?.id || !itemId || String(item.id).startsWith('demo-')) {
      notifyNurse({ tone: 'warning', title: 'Bảng kiểm', message: 'Mục mẫu hoặc thiếu checklist item id nên chưa thể cập nhật.' });
      return;
    }
    await runNurseAction({
      label: action === 'done' ? 'Đánh dấu đạt' : action === 'failed' ? 'Không đạt' : 'Miễn mục',
      confirm: action !== 'done' ? { title: 'Xác nhận bảng kiểm', message: entry.label || entry.title } : null,
      run: async () => {
        if (action === 'done') return nursePreparationApi.doneChecklistItem(item.id, itemId);
        if (action === 'failed') return nursePreparationApi.failChecklistItem(item.id, itemId, { reason: 'Không đạt điều kiện' });
        return nursePreparationApi.waiveChecklistItem(item.id, itemId, { reason: 'Bác sĩ cho phép bỏ qua' });
      },
      successMessage: 'Đã cập nhật bảng kiểm.',
      onSuccess: () => {
        setSelected({ ...item });
        setRefresh((value) => value + 1);
      },
    });
  }

  return (
    <section className="nurse-prep-page">
      <PrepHeader mode={mode} data={data} loading={loading} isDemo={isDemo} error={error} refresh={() => setRefresh((value) => value + 1)} />
      <PrepKpiGrid summary={data.summary} items={data.items || []} setQuickStatus={setQuick} />
      <PrepFilters filters={filters} setFilters={setFilters} mode={mode} view={view} setView={setView} />
      {quick !== 'all' ? (
        <div className="nurse-prep-quick-strip">
          <Filter size={15} />
          <span>{quick}</span>
          <button type="button" onClick={() => setQuick('all')}>Bỏ lọc nhanh</button>
        </div>
      ) : null}
      {loading ? <div className="nurse-prep-loading"><Loader2 className="is-spinning" size={18} />Đang đồng bộ worklist...</div> : null}
      {mode === 'checklists' ? (
        <ChecklistTemplateManager items={items} onSelect={setSelected} />
      ) : view === 'kanban' ? (
        <KanbanView items={items} onSelect={setSelected} onAction={handleAction} />
      ) : view === 'timeline' ? (
        <TimelineView items={items} onSelect={setSelected} />
      ) : view === 'room' ? (
        <RoomBoardView items={items} onSelect={setSelected} />
      ) : (
        <WorklistTable items={items} onSelect={setSelected} onAction={handleAction} />
      )}
      <PreparationDrawer
        selected={selected}
        detail={detail}
        context={context}
        loading={detailLoading}
        onClose={() => setSelected(null)}
        onChecklistAction={handleChecklistAction}
        onAction={handleAction}
      />
    </section>
  );
}

export function ServicePreparationWaitingPage() {
  return <ServicePreparationPage mode="waiting" />;
}

export function PreExamPreparationPage() {
  return <ServicePreparationPage mode="pre_exam" />;
}

export function PreLabPreparationPage() {
  return <ServicePreparationPage mode="lab" />;
}

export function PreImagingPreparationPage() {
  return <ServicePreparationPage mode="imaging" />;
}

export function PreProcedurePreparationPage() {
  return <ServicePreparationPage mode="procedure" />;
}

export function PreparationChecklistPage() {
  return <ServicePreparationPage mode="checklists" />;
}
