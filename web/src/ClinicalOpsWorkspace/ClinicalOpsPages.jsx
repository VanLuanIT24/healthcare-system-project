import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileClock,
  FileWarning,
  Filter,
  FlaskConical,
  LayoutGrid,
  MessageSquareWarning,
  MonitorUp,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  Siren,
  Stethoscope,
  Timer,
  TimerOff,
  UploadCloud,
  UserRoundCheck,
  WalletCards,
  X,
} from 'lucide-react';
import { clinicalOpsAPI, getClinicalOpsErrorMessage } from './clinicalOpsApi';
import { notifyClinicalOps } from './clinicalOpsActions';
import './clinicalOps.css';

const MODULE_META = {
  lab: { label: 'Lab', icon: FlaskConical, tone: 'lab' },
  imaging: { label: 'CĐHA', icon: ScanLine, tone: 'imaging' },
  procedure: { label: 'Thủ thuật', icon: Stethoscope, tone: 'procedure' },
};

const PRIORITY_META = {
  stat: { label: 'STAT', tone: 'stat' },
  urgent: { label: 'Urgent', tone: 'urgent' },
  routine: { label: 'Routine', tone: 'routine' },
};

const STATUS_LABELS = {
  ordered: 'Đã chỉ định',
  acknowledged: 'Đã tiếp nhận',
  scheduled: 'Đã xếp lịch',
  collected: 'Đã lấy mẫu',
  received: 'Đã nhận mẫu',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  rejected: 'Bị từ chối',
  no_show: 'No-show',
  preliminary: 'Sơ bộ',
  draft: 'Nháp',
  final: 'Đã ký',
  amended: 'Đã sửa đổi',
};

const ACTION_LABELS = {
  acknowledge: 'Tiếp nhận',
  collect_specimen: 'Lấy mẫu',
  receive_specimen: 'Nhận mẫu',
  reject_specimen: 'Từ chối mẫu',
  process_specimen: 'Chạy mẫu',
  create_lab_result: 'Nhập kết quả',
  update_lab_result: 'Sửa kết quả',
  finalize_lab_result: 'Duyệt kết quả',
  finalize_imaging_report: 'Ký báo cáo',
  schedule_imaging_order: 'Xếp lịch',
  start_imaging_order: 'Bắt đầu',
  complete_imaging_order: 'Hoàn tất kỹ thuật',
  create_imaging_report: 'Tạo report',
  upload_imaging_file: 'Upload file',
  schedule_procedure: 'Xếp lịch',
  start_procedure: 'Bắt đầu',
  complete_procedure: 'Hoàn tất',
  create_procedure_charge: 'Tạo charge',
  upload_procedure_file: 'Upload file',
  add_result_note: 'Bổ sung ghi chú',
  acknowledge_critical: 'Xác nhận critical',
  finalize: 'Duyệt / ký',
  amend: 'Amend',
  upload_file: 'Upload file',
  create_report: 'Tạo report',
  create_charge: 'Tạo charge',
  escalate: 'Escalate',
  open_timeline: 'Timeline',
};

function todayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function parseDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function formatDateTime(value) {
  const parsed = parseDate(value);
  if (!parsed) return '--';
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(value) {
  const parsed = parseDate(value);
  if (!parsed) return '--';
  return parsed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function getPatientName(item) {
  return item?.patient?.full_name || 'Chưa rõ bệnh nhân';
}

function getPatientCode(item) {
  return item?.patient?.patient_code || item?.patient?.id || '--';
}

function getAge(patient) {
  const dob = parseDate(patient?.date_of_birth);
  if (!dob) return '';
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? `${age} tuổi` : '';
}

function useClinicalOpsData(loader, params, fallback = {}) {
  const [state, setState] = useState({ loading: true, error: '', data: fallback });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const paramsKey = JSON.stringify(params || {});

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    loader(params)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data: data || fallback });
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getClinicalOpsErrorMessage(error),
            data: fallback,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [loader, paramsKey, refreshIndex]);

  return {
    ...state,
    refresh: () => setRefreshIndex((current) => current + 1),
  };
}

function useOpsFilters(defaults = {}) {
  const [filters, setFilters] = useState({
    date: todayKey(),
    module: 'all',
    scope: 'department',
    priority: '',
    sla: '',
    search: '',
    ...defaults,
  });

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return [filters, updateFilter, setFilters];
}

function WidgetError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="clinical-ops-widget-error">
      <AlertTriangle size={16} strokeWidth={2.25} />
      <span>{message}</span>
      {onRetry ? <button type="button" onClick={onRetry}>Thử lại</button> : null}
    </div>
  );
}

function EmptyState({ title = 'Không có dữ liệu phù hợp', description = 'Bộ lọc hiện tại không có item cần xử lý.' }) {
  return (
    <div className="clinical-ops-empty">
      <CheckCircle2 size={24} strokeWidth={2.25} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, children }) {
  return (
    <section className="clinical-ops-page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children ? <div className="clinical-ops-page-header__actions">{children}</div> : null}
    </section>
  );
}

function ScopeFilterBar({ filters, onChange, onRefresh, loading, showSearch = true, showSla = false, showStatusGroup = false }) {
  return (
    <section className="clinical-ops-filter-bar" aria-label="Bộ lọc vận hành cận lâm sàng">
      <label>
        <CalendarDays size={15} strokeWidth={2.25} />
        <input type="date" value={filters.date || ''} onChange={(event) => onChange('date', event.target.value)} />
      </label>
      <label>
        <LayoutGrid size={15} strokeWidth={2.25} />
        <select value={filters.module || 'all'} onChange={(event) => onChange('module', event.target.value)}>
          <option value="all">Tất cả module</option>
          <option value="lab">Lab</option>
          <option value="imaging">CĐHA</option>
          <option value="procedure">Thủ thuật</option>
        </select>
      </label>
      <label>
        <UserRoundCheck size={15} strokeWidth={2.25} />
        <select value={filters.scope || 'department'} onChange={(event) => onChange('scope', event.target.value)}>
          <option value="department">Khoa tôi</option>
          <option value="mine">Của tôi</option>
          <option value="all">Tất cả được phân quyền</option>
        </select>
      </label>
      <label>
        <ShieldAlert size={15} strokeWidth={2.25} />
        <select value={filters.priority || ''} onChange={(event) => onChange('priority', event.target.value)}>
          <option value="">Mọi ưu tiên</option>
          <option value="stat">STAT</option>
          <option value="urgent">Urgent</option>
          <option value="routine">Routine</option>
        </select>
      </label>
      {showSla ? (
        <label>
          <Timer size={15} strokeWidth={2.25} />
          <select value={filters.sla || ''} onChange={(event) => onChange('sla', event.target.value)}>
            <option value="">Mọi SLA</option>
            <option value="normal">Bình thường</option>
            <option value="warning">Sắp quá hạn</option>
            <option value="breached">Quá hạn</option>
          </select>
        </label>
      ) : null}
      {showStatusGroup ? (
        <label>
          <Filter size={15} strokeWidth={2.25} />
          <select value={filters.status_group || ''} onChange={(event) => onChange('status_group', event.target.value)}>
            <option value="">Mọi trạng thái</option>
            <option value="waiting_action">Cần xử lý</option>
            <option value="in_progress">Đang thực hiện</option>
            <option value="pending_result">Chờ kết quả</option>
            <option value="pending_sign">Chờ ký</option>
          </select>
        </label>
      ) : null}
      {showSearch ? (
        <label className="clinical-ops-filter-bar__search">
          <Search size={15} strokeWidth={2.25} />
          <input
            value={filters.search || ''}
            onChange={(event) => onChange('search', event.target.value)}
            placeholder="Tìm BN / order / encounter"
          />
        </label>
      ) : null}
      <button type="button" className="clinical-ops-refresh-button" onClick={onRefresh}>
        <RefreshCw className={loading ? 'is-spinning' : ''} size={16} strokeWidth={2.25} />
        Làm mới
      </button>
    </section>
  );
}

function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || { label: priority || '--', tone: 'routine' };
  return <span className={`clinical-ops-priority is-${meta.tone}`}>{meta.label}</span>;
}

function ModuleBadge({ module }) {
  const meta = MODULE_META[module] || { label: module || '--', icon: LayoutGrid, tone: 'neutral' };
  const Icon = meta.icon;
  return (
    <span className={`clinical-ops-module-badge is-${meta.tone}`}>
      <Icon size={13} strokeWidth={2.3} />
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }) {
  return <span className={`clinical-ops-status is-${String(status || '').replace(/_/g, '-')}`}>{STATUS_LABELS[status] || status || '--'}</span>;
}

function SlaTimerBadge({ sla }) {
  if (!sla) return <span className="clinical-ops-sla is-muted">Không SLA</span>;
  const state = sla.state || 'normal';
  const label = state === 'breached'
    ? `Quá ${formatNumber(sla.breached_minutes)}p`
    : state === 'completed'
      ? 'Hoàn tất SLA'
      : `Còn ${formatNumber(Math.max(sla.remaining_minutes || 0, 0))}p`;
  return (
    <span className={`clinical-ops-sla is-${state}`}>
      <Timer size={13} strokeWidth={2.25} />
      {label}
    </span>
  );
}

function CriticalBadge({ active }) {
  if (!active) return null;
  return (
    <span className="clinical-ops-critical-badge">
      <Siren size={13} strokeWidth={2.3} />
      Critical
    </span>
  );
}

function routeForClinicalAction(action, item = {}) {
  if (action === 'open_timeline') return `/clinical-ops/orders/timeline?item=${encodeURIComponent(item.work_item_id || item.entity_id || item.order_id || '')}`;
  if (['acknowledge_critical'].includes(action)) return '/clinical-ops/overview/critical-results';
  if (['finalize', 'finalize_lab_result', 'finalize_imaging_report'].includes(action)) return item.module === 'imaging' ? '/clinical-ops/approvals/imaging-signature' : '/clinical-ops/approvals/lab';
  if (['amend', 'add_result_note'].includes(action)) return '/clinical-ops/approvals/amend-needed';
  if (['release_to_patient'].includes(action)) return '/clinical-ops/approvals/returned-to-patient';
  if (['create_lab_result', 'update_lab_result'].includes(action)) return '/clinical-ops/tests/result-entry';
  if (['collect_specimen'].includes(action)) return '/clinical-ops/tests/waiting-specimen';
  if (['receive_specimen'].includes(action)) return '/clinical-ops/specimens/receive';
  if (['reject_specimen'].includes(action)) return '/clinical-ops/specimens/reject';
  if (['process_specimen'].includes(action)) return '/clinical-ops/specimens/testing';
  if (['schedule_imaging_order'].includes(action)) return '/clinical-ops/imaging/waiting-schedule';
  if (['start_imaging_order'].includes(action)) return '/clinical-ops/imaging/schedule';
  if (['complete_imaging_order'].includes(action)) return '/clinical-ops/imaging/in-progress';
  if (['create_imaging_report', 'create_report'].includes(action)) return '/clinical-ops/imaging/reports';
  if (['upload_imaging_file', 'upload_file'].includes(action)) return item.module === 'procedure' ? '/clinical-ops/procedures/files' : '/clinical-ops/imaging/upload-files';
  if (['schedule_procedure'].includes(action)) return '/clinical-ops/procedures/waiting-schedule';
  if (['start_procedure'].includes(action)) return '/clinical-ops/procedures/schedule';
  if (['complete_procedure'].includes(action)) return '/clinical-ops/procedures/in-progress';
  if (['create_charge', 'create_procedure_charge'].includes(action)) return '/clinical-ops/procedures/fees';
  if (item.module === 'lab') return '/clinical-ops/tests/orders';
  if (item.module === 'imaging') return '/clinical-ops/imaging/orders';
  if (item.module === 'procedure') return '/clinical-ops/procedures/orders';
  return '/clinical-ops/overview/today-worklist';
}

function PatientIdentityCell({ item }) {
  return (
    <div className="clinical-ops-patient-cell">
      <strong>{getPatientCode(item)} - {getPatientName(item)}</strong>
      <span>{[item?.patient?.gender, getAge(item?.patient), item?.encounter?.encounter_code].filter(Boolean).join(' · ') || 'Chưa có encounter'}</span>
    </div>
  );
}

function AllowedActionsMenu({ item, onEscalate }) {
  const navigate = useNavigate();
  const actions = (item.allowed_actions || []).slice(0, 4);
  function runAction(action) {
    if (action === 'escalate') {
      onEscalate?.(item);
      return;
    }
    const route = routeForClinicalAction(action, item);
    notifyClinicalOps({
      title: ACTION_LABELS[action] || 'Mở nghiệp vụ cận lâm sàng',
      message: 'Đã chuyển tới màn nghiệp vụ phù hợp để xử lý với đầy đủ context và quyền backend.',
    });
    navigate(route);
  }
  return (
    <div className="clinical-ops-action-row">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          onClick={() => runAction(action)}
          title={ACTION_LABELS[action] || action}
        >
          {ACTION_LABELS[action] || action}
        </button>
      ))}
    </div>
  );
}

function KpiCard({ item, loading, onClick }) {
  const Icon = item.icon || Activity;
  return (
    <button
      type="button"
      className={`clinical-ops-kpi is-${item.tone || 'neutral'}`}
      onClick={onClick || (() => notifyClinicalOps({ title: item.label, message: item.hint || 'KPI đang phản ánh bộ lọc hiện tại.' }))}
    >
      <span className="clinical-ops-kpi__icon">
        <Icon size={21} strokeWidth={2.25} />
      </span>
      <span className="clinical-ops-kpi__copy">
        <small>{item.label}</small>
        {loading ? <span className="clinical-ops-skeleton clinical-ops-skeleton--value" /> : <strong>{item.value}</strong>}
        <em>{item.hint}</em>
      </span>
      <ArrowRight size={16} strokeWidth={2.25} />
    </button>
  );
}

function ClinicalOpsKpiGrid({ items, loading }) {
  const navigate = useNavigate();
  return (
    <section className="clinical-ops-kpi-grid" aria-label="KPI vận hành cận lâm sàng">
      {items.map((item) => (
        <KpiCard key={item.label} item={item} loading={loading} onClick={item.to ? () => navigate(item.to) : undefined} />
      ))}
    </section>
  );
}

function ClinicalOpsFlowFunnel({ title, icon: Icon, flow = {}, steps = [], tone }) {
  const max = Math.max(...steps.map((step) => Number(flow[step.key] || 0)), 1);
  return (
    <section className={`clinical-ops-flow is-${tone}`}>
      <header>
        <span>
          <Icon size={18} strokeWidth={2.25} />
          {title}
        </span>
      </header>
      <div className="clinical-ops-flow__steps">
        {steps.map((step) => {
          const value = Number(flow[step.key] || 0);
          return (
            <div key={step.key} className="clinical-ops-flow__step">
              <span>
                <strong>{step.label}</strong>
                <em>{formatNumber(value)}</em>
              </span>
              <i style={{ width: `${Math.max((value / max) * 100, value ? 12 : 4)}%` }} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ClinicalOpsBottleneckPanel({ items = [] }) {
  const navigate = useNavigate();
  return (
    <section className="clinical-ops-panel">
      <header className="clinical-ops-panel__header">
        <div>
          <span>Bottleneck</span>
          <h2>Nút thắt cần điều phối</h2>
        </div>
        <MessageSquareWarning size={19} strokeWidth={2.25} />
      </header>
      {items.length ? (
        <div className="clinical-ops-bottlenecks">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`is-${item.severity}`}
              onClick={() => {
                notifyClinicalOps({ title: 'Bottleneck', message: item.next_action || item.title });
                navigate(routeForClinicalAction(item.next_action, item));
              }}
            >
              <span>
                <strong>{item.title}</strong>
                <em>{item.module} · {item.next_action}</em>
              </span>
              <b>{formatNumber(item.count)}</b>
            </button>
          ))}
        </div>
      ) : <EmptyState title="Không có bottleneck nổi bật" description="Các luồng chính đang trong ngưỡng kiểm soát." />}
    </section>
  );
}

function ClinicalOpsRealtimeTimeline({ items = [] }) {
  return (
    <section className="clinical-ops-panel">
      <header className="clinical-ops-panel__header">
        <div>
          <span>Realtime activity</span>
          <h2>Dòng sự kiện vận hành</h2>
        </div>
        <MonitorUp size={19} strokeWidth={2.25} />
      </header>
      {items.length ? (
        <div className="clinical-ops-timeline">
          {items.map((item, index) => (
            <div key={`${item.entity_type}:${item.entity_id}:${index}`}>
              <span className={`clinical-ops-timeline__dot is-${item.module}`} />
              <strong>{item.title}</strong>
              <small>{MODULE_META[item.module]?.label || item.module} · {getPatientCode(item)} · {formatDateTime(item.event_time)}</small>
            </div>
          ))}
        </div>
      ) : <EmptyState title="Chưa có sự kiện" description="Realtime timeline sẽ hiện khi có thay đổi vận hành." />}
    </section>
  );
}

function WorkItemTable({ rows = [], loading, onEscalate, mode = 'worklist' }) {
  if (loading) {
    return (
      <section className="clinical-ops-table-shell">
        <div className="clinical-ops-skeleton-stack">
          {Array.from({ length: 8 }).map((_, index) => <span key={index} className="clinical-ops-skeleton" />)}
        </div>
      </section>
    );
  }
  if (!rows.length) return <section className="clinical-ops-table-shell"><EmptyState /></section>;

  return (
    <section className="clinical-ops-table-shell">
      <div className="clinical-ops-table">
        <div className="clinical-ops-table__head">
          <span>Ưu tiên</span>
          <span>SLA</span>
          <span>Bệnh nhân</span>
          <span>Order</span>
          <span>Giai đoạn</span>
          <span>Owner</span>
          <span>Thao tác</span>
        </div>
        {rows.map((item) => (
          <div key={item.work_item_id || item.critical_id || `${item.entity_type}:${item.entity_id}`} className={`clinical-ops-table__row is-${mode}`}>
            <div className="clinical-ops-table__priority">
              <PriorityBadge priority={item.priority} />
              <ModuleBadge module={item.module} />
              <CriticalBadge active={item.is_critical || item.result?.is_critical || item.report?.is_critical || item.warnings?.includes('critical_unacknowledged')} />
            </div>
            <SlaTimerBadge sla={item.sla} />
            <PatientIdentityCell item={item} />
            <div className="clinical-ops-order-cell">
              <strong>{item.order_no || item.result_no || '--'}</strong>
              <span>{item.service_label || item.title || '--'}</span>
            </div>
            <div className="clinical-ops-stage-cell">
              <StatusBadge status={item.status} />
              <span>{item.stage_label || item.completion_state || item.title || '--'}</span>
              {item.missing?.length ? <em>Thiếu: {item.missing.join(', ')}</em> : null}
            </div>
            <div className="clinical-ops-owner-cell">
              <strong>{item.owner?.name || item.ordered_by?.name || '--'}</strong>
              <span>{formatDateTime(item.last_update_at || item.created_at || item.ordered_at)}</span>
            </div>
            <AllowedActionsMenu item={item} onEscalate={onEscalate} />
          </div>
        ))}
      </div>
    </section>
  );
}

function CriticalStrip({ summary = {}, loading }) {
  const navigate = useNavigate();
  const items = [
    { label: 'STAT đang mở', value: summary.stat_open, tone: 'stat', icon: ShieldAlert, to: '/clinical-ops/overview/stat-urgent' },
    { label: 'Critical chưa acknowledge', value: summary.critical_unacknowledged, tone: 'danger', icon: Siren, to: '/clinical-ops/overview/critical-results' },
    { label: 'Order quá hạn SLA', value: summary.overdue_orders, tone: 'warning', icon: TimerOff, to: '/clinical-ops/overview/overdue-orders' },
    { label: 'Kết quả chờ ký', value: summary.pending_approval, tone: 'info', icon: BadgeCheck, to: '/clinical-ops/overview/pending-approval' },
    { label: 'File thiếu / lỗi', value: summary.file_issue || summary.missing_file || 0, tone: 'neutral', icon: FileWarning, to: '/clinical-ops/result-files/missing' },
    { label: 'No-show hôm nay', value: summary.no_show_today, tone: 'muted', icon: AlertTriangle, to: '/clinical-ops/alerts/no-show-abnormal-cancel' },
  ];
  return (
    <section className="clinical-ops-critical-strip">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.label} type="button" className={`is-${item.tone}`} onClick={() => navigate(item.to)}>
            <Icon size={18} strokeWidth={2.25} />
            <span>
              <small>{item.label}</small>
              {loading ? <em className="clinical-ops-mini-skeleton" /> : <strong>{formatNumber(item.value)}</strong>}
            </span>
          </button>
        );
      })}
    </section>
  );
}

function useEscalationToast(refresh) {
  const [toast, setToast] = useState('');
  async function escalate(item) {
    if (!item?.entity_type || !item?.entity_id) return;
    setToast('');
    try {
      await clinicalOpsAPI.createEscalation({
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        module: item.module,
        escalation_level: item.priority === 'stat' ? 2 : 1,
        reason: `Escalate từ vận hành cận lâm sàng: ${item.stage_label || item.title || item.order_no}`,
      });
      setToast('Đã tạo escalation.');
      refresh?.();
    } catch (error) {
      setToast(getClinicalOpsErrorMessage(error, 'Không thể tạo escalation.'));
    }
  }
  return { toast, setToast, escalate };
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <button type="button" className="clinical-ops-toast" onClick={onClose}>
      <span>{message}</span>
      <X size={14} strokeWidth={2.3} />
    </button>
  );
}

export function ClinicalOpsDashboardPage() {
  const [filters, updateFilter] = useOpsFilters();
  const state = useClinicalOpsData(clinicalOpsAPI.dashboard, filters, {});
  const data = state.data || {};
  const summary = data.summary || {};
  const kpis = [
    { label: 'Tổng order hôm nay', value: formatNumber(summary.total_orders_today), hint: `${formatNumber(summary.new_orders_last_15_minutes)} mới trong 15 phút`, icon: ClipboardCheck, tone: 'info', to: '/clinical-ops/overview/today-worklist' },
    { label: 'STAT đang mở', value: formatNumber(summary.stat_open), hint: `${formatNumber(summary.urgent_open)} urgent`, icon: ShieldAlert, tone: 'danger', to: '/clinical-ops/overview/stat-urgent' },
    { label: 'Critical chưa ACK', value: formatNumber(summary.critical_unacknowledged), hint: `${formatNumber(summary.critical_response_time_minutes)}p median ACK`, icon: Siren, tone: 'critical', to: '/clinical-ops/overview/critical-results' },
    { label: 'Chờ hoàn tất', value: formatNumber(summary.pending_completion), hint: 'Thiếu result/report/file/charge', icon: FileClock, tone: 'warning', to: '/clinical-ops/overview/pending-completion' },
    { label: 'Chờ duyệt / ký', value: formatNumber(summary.pending_approval), hint: 'Lab manager / Radiologist', icon: BadgeCheck, tone: 'info', to: '/clinical-ops/overview/pending-approval' },
    { label: 'Order quá hạn', value: formatNumber(summary.overdue_orders), hint: `${formatNumber(summary.sla_warning)} sắp quá hạn`, icon: TimerOff, tone: 'danger', to: '/clinical-ops/overview/overdue-orders' },
    { label: 'SLA compliance', value: `${Number(summary.sla_compliance_percent || 0).toFixed(1)}%`, hint: `${formatNumber(summary.median_tat_minutes)}p median TAT`, icon: BarChart3, tone: 'success' },
    { label: 'Đã hoàn tất hôm nay', value: formatNumber(summary.completed_today), hint: `${formatNumber(summary.cancelled_today)} hủy · ${formatNumber(summary.no_show_today)} no-show`, icon: FileCheck2, tone: 'neutral' },
  ];

  return (
    <div className="clinical-ops-page">
      <PageHeader
        eyebrow="Command Center"
        title="Dashboard cận lâm sàng"
        description="Điều phối lab, chẩn đoán hình ảnh và thủ thuật theo SLA, critical safety và hàng đợi ký."
      />
      <ScopeFilterBar filters={filters} onChange={updateFilter} onRefresh={state.refresh} loading={state.loading} showSearch={false} />
      <WidgetError message={state.error} onRetry={state.refresh} />
      <CriticalStrip summary={summary} loading={state.loading} />
      <ClinicalOpsKpiGrid items={kpis} loading={state.loading} />
      <section className="clinical-ops-flow-grid">
        <ClinicalOpsFlowFunnel
          title="Lab flow"
          icon={FlaskConical}
          tone="lab"
          flow={data.lab?.flow}
          steps={[
            { key: 'waiting_collection', label: 'Chờ lấy mẫu' },
            { key: 'waiting_receive', label: 'Chờ nhận' },
            { key: 'waiting_process', label: 'Chờ chạy' },
            { key: 'in_testing', label: 'Đang xét nghiệm' },
            { key: 'result_preliminary', label: 'Sơ bộ' },
            { key: 'result_final', label: 'Final' },
          ]}
        />
        <ClinicalOpsFlowFunnel
          title="Imaging flow"
          icon={ScanLine}
          tone="imaging"
          flow={data.imaging?.flow}
          steps={[
            { key: 'waiting_schedule', label: 'Chờ lịch' },
            { key: 'scheduled', label: 'Đã lịch' },
            { key: 'in_progress', label: 'Đang chụp' },
            { key: 'technical_completed', label: 'Hoàn tất kỹ thuật' },
            { key: 'report_preliminary', label: 'Chờ ký' },
            { key: 'report_final', label: 'Đã ký' },
          ]}
        />
        <ClinicalOpsFlowFunnel
          title="Procedure flow"
          icon={Stethoscope}
          tone="procedure"
          flow={data.procedure?.flow}
          steps={[
            { key: 'waiting_schedule', label: 'Chờ lịch' },
            { key: 'scheduled', label: 'Đã lịch' },
            { key: 'in_progress', label: 'Đang làm' },
            { key: 'completed', label: 'Hoàn tất' },
            { key: 'procedure_missing_file', label: 'Thiếu file' },
            { key: 'procedure_missing_charge', label: 'Thiếu charge' },
          ]}
        />
      </section>
      <section className="clinical-ops-dashboard-grid">
        <ClinicalOpsBottleneckPanel items={data.bottlenecks || []} />
        <ClinicalOpsRealtimeTimeline items={data.realtime_events || []} />
      </section>
    </div>
  );
}

export function TodayWorklistPage() {
  const [filters, updateFilter] = useOpsFilters({}, 'today');
  const state = useClinicalOpsData(clinicalOpsAPI.todayWorklist, filters, { summary: {}, items: [] });
  const { toast, setToast, escalate } = useEscalationToast(state.refresh);
  const summary = state.data.summary || {};
  const counters = [
    { label: 'Cần xử lý', value: summary.total, icon: ClipboardCheck, tone: 'info' },
    { label: 'STAT', value: summary.stat, icon: ShieldAlert, tone: 'danger' },
    { label: 'Urgent', value: summary.urgent, icon: Timer, tone: 'warning' },
    { label: 'Sắp quá hạn', value: summary.sla_warning, icon: Clock3, tone: 'warning' },
    { label: 'Quá hạn', value: summary.sla_breached, icon: TimerOff, tone: 'danger' },
    { label: 'Critical', value: summary.critical_unacknowledged, icon: Siren, tone: 'critical' },
  ];

  return (
    <div className="clinical-ops-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <PageHeader
        eyebrow="Smart Worklist"
        title="Việc cần xử lý hôm nay"
        description="Danh sách việc theo vai trò, đã gom next_action, SLA và cảnh báo từ lab, CĐHA, thủ thuật."
      />
      <ScopeFilterBar filters={filters} onChange={updateFilter} onRefresh={state.refresh} loading={state.loading} showSla showStatusGroup />
      <WidgetError message={state.error} onRetry={state.refresh} />
      <section className="clinical-ops-counter-grid">
        {counters.map((counter) => <KpiCard key={counter.label} item={{ ...counter, value: formatNumber(counter.value), hint: 'Realtime counter' }} loading={state.loading} />)}
      </section>
      <WorkItemTable rows={state.data.items || []} loading={state.loading} onEscalate={escalate} />
    </div>
  );
}

export function StatUrgentOrdersPage() {
  const [filters, updateFilter] = useOpsFilters({ priority: '' });
  const state = useClinicalOpsData(clinicalOpsAPI.statUrgent, filters, { summary: {}, lanes: {} });
  const { toast, setToast, escalate } = useEscalationToast(state.refresh);
  const lanes = [
    ['stat_waiting_ack', 'STAT chưa tiếp nhận', ShieldAlert],
    ['stat_in_progress', 'STAT đang xử lý', Activity],
    ['urgent_waiting_ack', 'Urgent chưa tiếp nhận', Clock3],
    ['urgent_in_progress', 'Urgent đang xử lý', Activity],
    ['overdue_or_escalated', 'Quá hạn / escalation', TimerOff],
  ];
  const summary = state.data.summary || {};

  return (
    <div className="clinical-ops-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <PageHeader
        eyebrow="Emergency Board"
        title="STAT / Urgent orders"
        description="Bảng điều phối ưu tiên cao, phân lane theo tiếp nhận, đang xử lý và quá hạn."
      />
      <ScopeFilterBar filters={filters} onChange={updateFilter} onRefresh={state.refresh} loading={state.loading} showSearch={false} />
      <WidgetError message={state.error} onRetry={state.refresh} />
      <CriticalStrip summary={{ stat_open: summary.stat_open, critical_unacknowledged: summary.escalated, overdue_orders: summary.stat_overdue + summary.urgent_overdue, pending_approval: summary.urgent_open, no_show_today: 0 }} loading={state.loading} />
      <section className="clinical-ops-lane-board">
        {lanes.map(([key, label, Icon]) => (
          <section key={key} className={`clinical-ops-lane is-${key}`}>
            <header>
              <Icon size={18} strokeWidth={2.25} />
              <strong>{label}</strong>
              <span>{formatNumber((state.data.lanes?.[key] || []).length)}</span>
            </header>
            <div className="clinical-ops-lane__body">
              {(state.data.lanes?.[key] || []).length ? (state.data.lanes[key] || []).map((item) => (
                <article key={item.work_item_id} className="clinical-ops-order-card">
                  <div className="clinical-ops-order-card__top">
                    <PriorityBadge priority={item.priority} />
                    <SlaTimerBadge sla={item.sla} />
                  </div>
                  <PatientIdentityCell item={item} />
                  <strong>{item.service_label}</strong>
                  <span>{item.stage_label}</span>
                  <AllowedActionsMenu item={item} onEscalate={escalate} />
                </article>
              )) : <EmptyState title="Không có order" description="Lane này đang trống." />}
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}

export function CriticalResultsPage() {
  const [filters, updateFilter] = useOpsFilters({ module: 'all', acknowledgement: 'unacknowledged' });
  const state = useClinicalOpsData(clinicalOpsAPI.criticalResults, filters, { summary: {}, items: [] });
  const { toast, setToast, escalate } = useEscalationToast(state.refresh);
  const summary = state.data.summary || {};
  const kpis = [
    { label: 'Tổng critical', value: formatNumber(summary.total_critical), hint: 'Lab + CĐHA', icon: Siren, tone: 'critical' },
    { label: 'Chưa acknowledge', value: formatNumber(summary.unacknowledged), hint: `${formatNumber(summary.overdue_ack)} quá hạn`, icon: ShieldAlert, tone: 'danger' },
    { label: 'Critical lab', value: formatNumber(summary.lab_critical), hint: 'Xét nghiệm', icon: FlaskConical, tone: 'lab' },
    { label: 'Critical CĐHA', value: formatNumber(summary.imaging_critical), hint: 'Báo cáo hình ảnh', icon: ScanLine, tone: 'imaging' },
    { label: 'Median ACK', value: `${formatNumber(summary.median_ack_minutes)}p`, hint: 'Thời gian xác nhận', icon: Timer, tone: 'success' },
  ];

  return (
    <div className="clinical-ops-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <PageHeader
        eyebrow="Patient Safety"
        title="Critical results"
        description="Trung tâm an toàn người bệnh cho critical lab và critical imaging, có SLA acknowledge và escalation."
      />
      <ScopeFilterBar filters={filters} onChange={updateFilter} onRefresh={state.refresh} loading={state.loading} showSla showSearch={false} />
      <WidgetError message={state.error} onRetry={state.refresh} />
      <ClinicalOpsKpiGrid items={kpis} loading={state.loading} />
      <section className="clinical-ops-table-shell">
        <div className="clinical-ops-critical-table">
          {(state.data.items || []).length ? (state.data.items || []).map((item) => (
            <article key={item.critical_id} className="clinical-ops-critical-row">
              <div>
                <PriorityBadge priority={item.priority} />
                <ModuleBadge module={item.module} />
                <CriticalBadge active />
              </div>
              <SlaTimerBadge sla={item.sla} />
              <PatientIdentityCell item={item} />
              <div className="clinical-ops-critical-row__finding">
                <strong>{item.title}</strong>
                <span>{item.critical_value || item.critical_note || '--'}</span>
              </div>
              <div>
                <strong>{formatDateTime(item.notified_at)}</strong>
                <span>{item.acknowledged_at ? `ACK ${formatDateTime(item.acknowledged_at)}` : 'Chưa ACK'}</span>
              </div>
              <AllowedActionsMenu item={{ ...item, allowed_actions: item.allowed_actions || ['acknowledge_critical', 'escalate', 'open_timeline'] }} onEscalate={escalate} />
            </article>
          )) : <EmptyState title="Không có critical result" description="Không có critical result phù hợp bộ lọc hiện tại." />}
        </div>
      </section>
    </div>
  );
}

function CompletionKanban({ items = [], onEscalate }) {
  const columns = [
    ['waiting_input', 'Chờ dữ liệu đầu vào', ['waiting_collection', 'waiting_receive', 'imaging_missing_file']],
    ['processing', 'Đang xử lý', ['waiting_process', 'in_testing', 'in_progress']],
    ['missing_info', 'Thiếu thông tin', ['procedure_missing_result_note', 'procedure_missing_file', 'procedure_missing_charge']],
    ['ready_approval', 'Sẵn sàng duyệt/ký', ['result_preliminary', 'report_draft', 'report_preliminary']],
    ['blocked', 'Blocked', []],
  ];

  return (
    <section className="clinical-ops-kanban">
      {columns.map(([key, label, states]) => {
        const rows = key === 'blocked'
          ? items.filter((item) => item.missing?.length || item.warnings?.includes('file_issue') || item.sla?.state === 'breached')
          : items.filter((item) => states.includes(item.completion_state || item.stage_code));
        return (
          <div key={key} className={`clinical-ops-kanban__column is-${key}`}>
            <header>
              <strong>{label}</strong>
              <span>{formatNumber(rows.length)}</span>
            </header>
            <div>
              {rows.slice(0, 6).map((item) => (
                <article key={`${key}:${item.work_item_id}`} className="clinical-ops-kanban-card">
                  <div>
                    <PriorityBadge priority={item.priority} />
                    <ModuleBadge module={item.module} />
                  </div>
                  <strong>{item.service_label}</strong>
                  <span>{getPatientCode(item)} · {item.stage_label}</span>
                  <SlaTimerBadge sla={item.sla} />
                  <AllowedActionsMenu item={item} onEscalate={onEscalate} />
                </article>
              ))}
              {!rows.length ? <EmptyState title="Trống" description="Không có item." /> : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function PendingCompletionPage() {
  const [filters, updateFilter] = useOpsFilters();
  const state = useClinicalOpsData(clinicalOpsAPI.pendingCompletion, filters, { summary: {}, items: [] });
  const { toast, setToast, escalate } = useEscalationToast(state.refresh);
  const summary = state.data.summary || {};
  const kpis = [
    { label: 'Tổng chờ hoàn tất', value: formatNumber(summary.total), hint: `${formatNumber(summary.blocked)} blocked`, icon: FileClock, tone: 'warning' },
    { label: 'Lab', value: formatNumber(summary.lab), hint: 'Mẫu/result', icon: FlaskConical, tone: 'lab' },
    { label: 'CĐHA', value: formatNumber(summary.imaging), hint: 'File/report', icon: ScanLine, tone: 'imaging' },
    { label: 'Thủ thuật', value: formatNumber(summary.procedure), hint: 'Note/file/charge', icon: Stethoscope, tone: 'procedure' },
    { label: 'Sẵn sàng duyệt', value: formatNumber(summary.ready_for_approval), hint: 'Chuyển sang ký', icon: BadgeCheck, tone: 'success' },
  ];

  return (
    <div className="clinical-ops-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <PageHeader
        eyebrow="Completion Queue"
        title="Kết quả chờ hoàn tất"
        description="Tách rõ các ca đã qua kỹ thuật nhưng chưa đủ result/report/file/charge để chuyển duyệt."
      />
      <ScopeFilterBar filters={filters} onChange={updateFilter} onRefresh={state.refresh} loading={state.loading} showSla />
      <WidgetError message={state.error} onRetry={state.refresh} />
      <ClinicalOpsKpiGrid items={kpis} loading={state.loading} />
      <CompletionKanban items={state.data.items || []} onEscalate={escalate} />
      <WorkItemTable rows={state.data.items || []} loading={state.loading} onEscalate={escalate} mode="completion" />
    </div>
  );
}

export function PendingApprovalPage() {
  const [filters, updateFilter] = useOpsFilters({ module: 'all', critical_only: '' });
  const state = useClinicalOpsData(clinicalOpsAPI.pendingApproval, filters, { summary: {}, items: [] });
  const { toast, setToast, escalate } = useEscalationToast(state.refresh);
  const summary = state.data.summary || {};
  const kpis = [
    { label: 'Lab chờ duyệt', value: formatNumber(summary.lab_pending), hint: 'LabResult preliminary', icon: FlaskConical, tone: 'lab' },
    { label: 'CĐHA chờ ký', value: formatNumber(summary.imaging_pending), hint: 'Report draft/prelim', icon: ScanLine, tone: 'imaging' },
    { label: 'Critical pending', value: formatNumber(summary.critical_pending), hint: 'Ưu tiên ký trước', icon: Siren, tone: 'critical' },
    { label: 'Tổng hàng đợi', value: formatNumber(summary.total), hint: 'Sắp theo STAT/Critical', icon: BadgeCheck, tone: 'info' },
  ];

  return (
    <div className="clinical-ops-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <PageHeader
        eyebrow="Approval Queue"
        title="Kết quả chờ duyệt / ký"
        description="Hàng đợi kiểm soát chất lượng cho Lab manager và Radiologist trước khi trả kết quả."
      />
      <ScopeFilterBar filters={filters} onChange={updateFilter} onRefresh={state.refresh} loading={state.loading} showSearch={false} />
      <WidgetError message={state.error} onRetry={state.refresh} />
      <ClinicalOpsKpiGrid items={kpis} loading={state.loading} />
      <section className="clinical-ops-table-shell">
        <div className="clinical-ops-review-table">
          {(state.data.items || []).length ? (state.data.items || []).map((item) => (
            <article key={`${item.entity_type}:${item.entity_id}`} className="clinical-ops-review-row">
              <div>
                <PriorityBadge priority={item.priority} />
                <ModuleBadge module={item.module} />
                <CriticalBadge active={item.is_critical} />
              </div>
              <PatientIdentityCell item={item} />
              <div>
                <strong>{item.result_no}</strong>
                <span>{item.service_label}</span>
              </div>
              <div className="clinical-ops-review-row__payload">
                <strong>{formatNumber(item.review_payload?.abnormal_items)} abnormal</strong>
                <span>{formatNumber(item.review_payload?.critical_items)} critical · chờ {formatNumber(item.waiting_minutes)}p</span>
              </div>
              <AllowedActionsMenu item={{ ...item, allowed_actions: item.allowed_actions || ['finalize', 'amend', 'escalate'] }} onEscalate={escalate} />
            </article>
          )) : <EmptyState title="Không có kết quả chờ duyệt" description="Hàng đợi ký đang trống." />}
        </div>
      </section>
    </div>
  );
}

export function OverdueOrdersPage() {
  const [filters, updateFilter] = useOpsFilters({ sla: 'breached' });
  const state = useClinicalOpsData(clinicalOpsAPI.overdueOrders, filters, { summary: {}, items: [] });
  const { toast, setToast, escalate } = useEscalationToast(state.refresh);
  const summary = state.data.summary || {};
  const kpis = [
    { label: 'Tổng quá hạn', value: formatNumber(summary.total_overdue), hint: `${formatNumber(summary.over_2h)} > 2h`, icon: TimerOff, tone: 'danger' },
    { label: 'STAT quá hạn', value: formatNumber(summary.stat_overdue), hint: 'Cần escalation ngay', icon: ShieldAlert, tone: 'critical' },
    { label: 'Urgent quá hạn', value: formatNumber(summary.urgent_overdue), hint: 'Theo dõi sát', icon: Clock3, tone: 'warning' },
    { label: 'Lab quá hạn', value: formatNumber(summary.lab_overdue), hint: 'Mẫu/result', icon: FlaskConical, tone: 'lab' },
    { label: 'CĐHA quá hạn', value: formatNumber(summary.imaging_overdue), hint: 'Lịch/report', icon: ScanLine, tone: 'imaging' },
    { label: 'Procedure quá hạn', value: formatNumber(summary.procedure_overdue), hint: 'Lịch/file/charge', icon: Stethoscope, tone: 'procedure' },
  ];

  return (
    <div className="clinical-ops-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <PageHeader
        eyebrow="SLA Control"
        title="Order quá hạn"
        description="Theo dõi breach theo stage, owner, module và next action để điều phối xử lý."
      />
      <ScopeFilterBar filters={filters} onChange={updateFilter} onRefresh={state.refresh} loading={state.loading} showSearch showSla />
      <WidgetError message={state.error} onRetry={state.refresh} />
      <ClinicalOpsKpiGrid items={kpis} loading={state.loading} />
      <WorkItemTable rows={state.data.items || []} loading={state.loading} onEscalate={escalate} mode="overdue" />
    </div>
  );
}
