import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileWarning,
  Filter,
  FlaskConical,
  ListChecks,
  Loader2,
  MessageSquareWarning,
  MonitorUp,
  RefreshCw,
  Search,
  ShieldAlert,
  Siren,
  Stethoscope,
  Timer,
  TimerOff,
  UploadCloud,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react';
import { diagnosticAlertsAPI, getDiagnosticAlertErrorMessage } from './diagnosticAlertsApi';
import './diagnosticAlerts.css';

const PAGE_CONFIG = {
  all: {
    eyebrow: 'Diagnostic Alert Center',
    title: 'Cảnh báo cận lâm sàng & thủ thuật',
    description: 'Inbox realtime cho critical result, SLA, mẫu bị từ chối, thiếu file, correction và no-show.',
    loader: diagnosticAlertsAPI.list,
    category: '',
    primaryTone: 'command',
    icon: ShieldAlert,
  },
  criticalOpen: {
    eyebrow: 'Patient Safety',
    title: 'Critical results chưa xử lý',
    description: 'Tất cả kết quả nguy cấp lab và chẩn đoán hình ảnh chưa được ACK.',
    loader: diagnosticAlertsAPI.criticalOpen,
    category: 'critical_result_open',
    primaryTone: 'critical',
    icon: Siren,
  },
  criticalOverdue: {
    eyebrow: 'War-room SLA',
    title: 'Critical quá hạn xác nhận',
    description: 'Các critical result đã vượt SLA ACK, cần xử lý hoặc escalation ngay.',
    loader: diagnosticAlertsAPI.criticalOverdue,
    category: 'critical_ack_overdue',
    primaryTone: 'critical',
    icon: TimerOff,
    warRoom: true,
  },
  rejectedSpecimens: {
    eyebrow: 'Specimen Quality',
    title: 'Mẫu bị từ chối',
    description: 'Quản lý mẫu không đạt, kế hoạch lấy lại, notify điều dưỡng/bác sĩ và audit.',
    loader: diagnosticAlertsAPI.rejectedSpecimens,
    category: 'specimen_rejected',
    primaryTone: 'warning',
    icon: FlaskConical,
  },
  overdueOrders: {
    eyebrow: 'SLA Control',
    title: 'Order quá hạn',
    description: 'Theo dõi chỉ định lab, CĐHA và thủ thuật đang trễ SLA theo giai đoạn.',
    loader: diagnosticAlertsAPI.overdueOrders,
    category: 'order_overdue',
    primaryTone: 'danger',
    icon: Clock3,
  },
  missingFiles: {
    eyebrow: 'File Completeness',
    title: 'Thiếu file kết quả',
    description: 'Phát hiện thiếu tệp, scan failed/infected, review pending và file chưa đạt điều kiện.',
    loader: diagnosticAlertsAPI.missingFiles,
    category: 'missing_result_file',
    primaryTone: 'file',
    icon: FileWarning,
  },
  corrections: {
    eyebrow: 'Correction Workflow',
    title: 'Kết quả cần sửa',
    description: 'Hàng đợi amend/correction cho lab result, imaging report và luồng phê duyệt liên quan.',
    loader: diagnosticAlertsAPI.correctionNeeded,
    category: 'result_needs_correction',
    primaryTone: 'review',
    icon: ClipboardCheck,
  },
  noShowCancel: {
    eyebrow: 'Follow-up',
    title: 'No-show / hủy bất thường',
    description: 'Theo dõi các ca CĐHA/thủ thuật không đến hoặc hủy bất thường, có billing và reschedule context.',
    loader: diagnosticAlertsAPI.noShowCancellations,
    category: 'no_show_or_abnormal_cancel',
    primaryTone: 'warning',
    icon: UserRound,
  },
};

const CATEGORY_LABELS = {
  critical_result_open: 'Critical open',
  critical_ack_overdue: 'ACK overdue',
  specimen_rejected: 'Mẫu từ chối',
  order_overdue: 'Order quá hạn',
  missing_result_file: 'Thiếu/lỗi file',
  result_needs_correction: 'Cần sửa',
  no_show_or_abnormal_cancel: 'No-show/hủy',
};

const MODULE_LABELS = {
  lab: 'Lab',
  imaging: 'CĐHA',
  procedure: 'Thủ thuật',
  records: 'Hồ sơ',
  orders: 'Order',
};

const SEVERITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  warning: 'Warning',
  info: 'Info',
};

const STATUS_LABELS = {
  open: 'Open',
  acknowledged: 'Đã ACK',
  assigned: 'Assigned',
  in_progress: 'Đang xử lý',
  escalated: 'Escalated',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

const ACTIONS = {
  acknowledge: { label: 'ACK', icon: CheckCircle2 },
  assign: { label: 'Assign', icon: UserCheck },
  escalate: { label: 'Escalate', icon: BellRing },
  resolve: { label: 'Resolve', icon: ListChecks },
  dismiss: { label: 'Dismiss', icon: X },
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
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMinutes(minutes) {
  const total = Number(minutes || 0);
  if (total >= 1440) return `${Math.floor(total / 1440)}n ${Math.floor((total % 1440) / 60)}g`;
  if (total >= 60) return `${Math.floor(total / 60)}g ${total % 60}p`;
  return `${total}p`;
}

function patientLabel(alert) {
  const patient = alert?.patient || {};
  return patient.full_name || patient.patient_code || 'Chưa rõ bệnh nhân';
}

function patientSubline(alert) {
  const patient = alert?.patient || {};
  return [patient.patient_code, patient.gender, alert?.encounter?.encounter_code].filter(Boolean).join(' · ') || '--';
}

function sourceLabel(alert) {
  return alert?.source?.label || alert?.source?.code || alert?.title || '--';
}

function getSlaText(alert) {
  const sla = alert?.sla || {};
  if (sla.state === 'breached') return `Quá ${formatMinutes(sla.breached_minutes)}`;
  if (sla.state === 'warning') return `Còn ${formatMinutes(sla.remaining_minutes)}`;
  if (sla.due_at || alert?.sla_due_at) return `Còn ${formatMinutes(sla.remaining_minutes)}`;
  return 'Không SLA';
}

function useDiagnosticAlerts(pageKey) {
  const config = PAGE_CONFIG[pageKey] || PAGE_CONFIG.all;
  const [filters, setFilters] = useState({
    date: '',
    module: 'all',
    severity: '',
    status: '',
    sla_status: '',
    priority: '',
    search: '',
  });
  const [state, setState] = useState({ loading: true, error: '', data: { summary: {}, items: [] } });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const paramsKey = JSON.stringify(filters);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    const params = {
      ...filters,
      module: filters.module === 'all' ? '' : filters.module,
      open: filters.status ? 'false' : 'true',
      limit: 80,
    };
    config.loader(params)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data: data || { summary: {}, items: [] } });
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getDiagnosticAlertErrorMessage(error),
            data: { summary: {}, items: [] },
          });
        }
      });
    return () => {
      active = false;
    };
  }, [config, paramsKey, refreshIndex]);

  return {
    config,
    filters,
    setFilter: (key, value) => setFilters((current) => ({ ...current, [key]: value })),
    resetFilters: () => setFilters({ date: '', module: 'all', severity: '', status: '', sla_status: '', priority: '', search: '' }),
    refresh: () => setRefreshIndex((current) => current + 1),
    ...state,
  };
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="diagnostic-alert-toast">
      <CheckCircle2 size={17} strokeWidth={2.25} />
      <span>{message}</span>
      <button type="button" aria-label="Đóng thông báo" onClick={onClose}>
        <X size={15} strokeWidth={2.25} />
      </button>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="diagnostic-alert-error">
      <AlertTriangle size={17} strokeWidth={2.25} />
      <span>{message}</span>
      <button type="button" onClick={onRetry}>Thử lại</button>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="diagnostic-alert-empty">
      <CheckCircle2 size={28} strokeWidth={2.25} />
      <strong>Không có cảnh báo phù hợp</strong>
      <span>Hàng đợi hiện tại đang sạch theo bộ lọc đang chọn.</span>
    </section>
  );
}

function PageHeader({ config, onRefresh, loading }) {
  const Icon = config.icon;
  return (
    <section className={`diagnostic-alert-header is-${config.primaryTone}`}>
      <div className="diagnostic-alert-header__title">
        <span>
          <Icon size={16} strokeWidth={2.4} />
          {config.eyebrow}
        </span>
        <h1>{config.title}</h1>
        <p>{config.description}</p>
      </div>
      <div className="diagnostic-alert-header__actions">
        {config.warRoom ? (
          <>
            <button type="button" className="diagnostic-alert-mode">
              <MonitorUp size={16} strokeWidth={2.25} />
              War-room
            </button>
            <button type="button" className="diagnostic-alert-mode">
              <BellRing size={16} strokeWidth={2.25} />
              Sound alert
            </button>
          </>
        ) : null}
        <button type="button" className="diagnostic-alert-primary-button" onClick={onRefresh}>
          <RefreshCw className={loading ? 'is-spinning' : ''} size={16} strokeWidth={2.25} />
          Refresh realtime
        </button>
      </div>
    </section>
  );
}

function KpiStrip({ summary = {}, loading }) {
  const items = [
    { key: 'critical_open', label: 'Critical open', value: summary.critical_open, icon: Siren, tone: 'critical' },
    { key: 'ack_overdue', label: 'ACK overdue', value: summary.ack_overdue, icon: TimerOff, tone: 'danger' },
    { key: 'rejected_specimens', label: 'Mẫu bị từ chối', value: summary.rejected_specimens, icon: FlaskConical, tone: 'warning' },
    { key: 'overdue_orders', label: 'Order quá hạn', value: summary.overdue_orders, icon: Clock3, tone: 'danger' },
    { key: 'missing_files', label: 'Thiếu/lỗi file', value: summary.missing_files, icon: FileWarning, tone: 'file' },
    { key: 'correction_needed', label: 'Cần sửa', value: summary.correction_needed, icon: ClipboardCheck, tone: 'review' },
    { key: 'no_show_cancel', label: 'No-show/hủy', value: summary.no_show_cancel, icon: UserRound, tone: 'warning' },
  ];

  return (
    <section className="diagnostic-alert-kpis" aria-label="KPI cảnh báo">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.key} className={`diagnostic-alert-kpi is-${item.tone}`}>
            <span className="diagnostic-alert-kpi__icon">
              <Icon size={20} strokeWidth={2.3} />
            </span>
            <span>
              <small>{item.label}</small>
              {loading ? <em className="diagnostic-alert-skeleton is-value" /> : <strong>{formatNumber(item.value)}</strong>}
            </span>
          </article>
        );
      })}
    </section>
  );
}

function FilterBar({ filters, setFilter, resetFilters, onRefresh, loading }) {
  return (
    <section className="diagnostic-alert-filters" aria-label="Bộ lọc cảnh báo">
      <label>
        <Activity size={15} strokeWidth={2.25} />
        <select value={filters.module} onChange={(event) => setFilter('module', event.target.value)}>
          <option value="all">Tất cả module</option>
          <option value="lab">Lab</option>
          <option value="imaging">CĐHA</option>
          <option value="procedure">Thủ thuật</option>
          <option value="records">Hồ sơ file</option>
        </select>
      </label>
      <label>
        <ShieldAlert size={15} strokeWidth={2.25} />
        <select value={filters.severity} onChange={(event) => setFilter('severity', event.target.value)}>
          <option value="">Mọi severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </label>
      <label>
        <Timer size={15} strokeWidth={2.25} />
        <select value={filters.sla_status} onChange={(event) => setFilter('sla_status', event.target.value)}>
          <option value="">Mọi SLA</option>
          <option value="normal">Bình thường</option>
          <option value="warning">Sắp quá hạn</option>
          <option value="breached">Quá hạn</option>
        </select>
      </label>
      <label>
        <Filter size={15} strokeWidth={2.25} />
        <select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
          <option value="">Open queue</option>
          <option value="acknowledged">Đã ACK</option>
          <option value="assigned">Assigned</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </label>
      <label>
        <Clock3 size={15} strokeWidth={2.25} />
        <select value={filters.priority} onChange={(event) => setFilter('priority', event.target.value)}>
          <option value="">Mọi ưu tiên</option>
          <option value="stat">STAT</option>
          <option value="urgent">Urgent</option>
          <option value="routine">Routine</option>
        </select>
      </label>
      <label>
        <Clock3 size={15} strokeWidth={2.25} />
        <input type="date" value={filters.date} onChange={(event) => setFilter('date', event.target.value)} />
      </label>
      <label className="diagnostic-alert-search">
        <Search size={15} strokeWidth={2.25} />
        <input
          value={filters.search}
          onChange={(event) => setFilter('search', event.target.value)}
          placeholder="Tìm BN / order / result / file"
        />
      </label>
      <button type="button" className="diagnostic-alert-icon-command" title="Làm mới" onClick={onRefresh}>
        <RefreshCw className={loading ? 'is-spinning' : ''} size={16} strokeWidth={2.25} />
      </button>
      <button type="button" className="diagnostic-alert-reset" onClick={resetFilters}>Xóa lọc</button>
    </section>
  );
}

function Badge({ className = '', children }) {
  return <span className={`diagnostic-alert-badge ${className}`}>{children}</span>;
}

function SlaBadge({ alert }) {
  const state = alert?.sla?.state || alert?.sla_status || 'none';
  return (
    <Badge className={`is-sla is-${state}`}>
      <Timer size={12} strokeWidth={2.4} />
      {getSlaText(alert)}
    </Badge>
  );
}

function AlertActions({ alert, actioning, onAction }) {
  const available = alert?.allowed_actions || {};
  const actions = [
    available.acknowledge || alert?.category?.startsWith('critical') ? 'acknowledge' : null,
    'assign',
    available.escalate || alert?.sla?.state === 'breached' ? 'escalate' : null,
    'resolve',
  ].filter(Boolean);

  return (
    <div className="diagnostic-alert-actions">
      {actions.map((action) => {
        const Icon = ACTIONS[action].icon;
        return (
          <button
            key={action}
            type="button"
            title={ACTIONS[action].label}
            disabled={actioning === `${alert.alert_id}:${action}`}
            onClick={(event) => {
              event.stopPropagation();
              onAction(action, alert);
            }}
          >
            {actioning === `${alert.alert_id}:${action}` ? (
              <Loader2 className="is-spinning" size={14} strokeWidth={2.25} />
            ) : (
              <Icon size={14} strokeWidth={2.25} />
            )}
            <span>{ACTIONS[action].label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AlertTable({ items = [], loading, selectedId, onSelect, actioning, onAction }) {
  if (loading) {
    return (
      <section className="diagnostic-alert-table-shell">
        <div className="diagnostic-alert-skeleton-stack">
          {Array.from({ length: 8 }).map((_, index) => <span key={index} className="diagnostic-alert-skeleton" />)}
        </div>
      </section>
    );
  }
  if (!items.length) return <EmptyState />;

  return (
    <section className="diagnostic-alert-table-shell">
      <div className="diagnostic-alert-table">
        <div className="diagnostic-alert-table__head">
          <span>Severity</span>
          <span>SLA</span>
          <span>Nguồn</span>
          <span>Bệnh nhân</span>
          <span>Nội dung cảnh báo</span>
          <span>Owner</span>
          <span>Thao tác</span>
        </div>
        {items.map((alert) => (
          <button
            key={alert.alert_id || `${alert.source_type}:${alert.source_id}:${alert.category}`}
            type="button"
            className={`diagnostic-alert-row${selectedId === alert.alert_id ? ' is-selected' : ''}`}
            onClick={() => onSelect(alert)}
          >
            <span className="diagnostic-alert-row__severity">
              <Badge className={`is-severity is-${alert.severity}`}>{SEVERITY_LABELS[alert.severity] || alert.severity}</Badge>
              <Badge className={`is-priority is-${alert.priority}`}>{String(alert.priority || 'routine').toUpperCase()}</Badge>
            </span>
            <span><SlaBadge alert={alert} /></span>
            <span className="diagnostic-alert-row__source">
              <strong>{alert.source?.code || alert.alert_no || '--'}</strong>
              <em>{MODULE_LABELS[alert.module] || alert.module} · {CATEGORY_LABELS[alert.category] || alert.category}</em>
            </span>
            <span className="diagnostic-alert-row__patient">
              <strong>{patientLabel(alert)}</strong>
              <em>{patientSubline(alert)}</em>
            </span>
            <span className="diagnostic-alert-row__message">
              <strong>{alert.title}</strong>
              <em>{alert.critical_summary || alert.message || sourceLabel(alert)}</em>
            </span>
            <span className="diagnostic-alert-row__owner">
              <strong>{alert.assigned_to_role || alert.order?.assigned_to?.name || alert.order?.ordered_by?.name || 'Chưa assign'}</strong>
              <em>{STATUS_LABELS[alert.status] || alert.status} · {formatDateTime(alert.first_detected_at)}</em>
            </span>
            <AlertActions alert={alert} actioning={actioning} onAction={onAction} />
          </button>
        ))}
      </div>
    </section>
  );
}

function DetailMetric({ label, value }) {
  return (
    <div className="diagnostic-alert-detail-metric">
      <span>{label}</span>
      <strong>{value || '--'}</strong>
    </div>
  );
}

function FileMatrix({ rows = [] }) {
  if (!rows?.length) return null;
  return (
    <div className="diagnostic-alert-file-matrix">
      <header>
        <span>Required file</span>
        <span>Status</span>
      </header>
      {rows.map((row, index) => (
        <div key={`${row.category || row.required_file}:${index}`}>
          <strong>{row.required_file || row.category || 'Tệp kết quả'}</strong>
          <Badge className={`is-file is-${row.status}`}>{row.status || 'missing'}</Badge>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ alert, detail, loading, onClose, actioning, onAction }) {
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    setTab('overview');
  }, [alert?.alert_id]);

  if (!alert) {
    return (
      <aside className="diagnostic-alert-detail is-empty">
        <ShieldAlert size={28} strokeWidth={2.25} />
        <strong>Chọn một cảnh báo</strong>
        <span>Thông tin bệnh nhân, nguồn cảnh báo, SLA, file và audit sẽ hiển thị ở đây.</span>
      </aside>
    );
  }

  const source = detail?.source_detail || {};
  const audit = detail?.audit || [];
  const tabs = [
    ['overview', 'Tổng quan'],
    ['source', 'Nguồn'],
    ['timeline', 'Timeline'],
    ['files', 'Files'],
    ['resolution', 'Xử lý'],
    ['audit', 'Audit'],
  ];

  return (
    <aside className="diagnostic-alert-detail">
      <header className="diagnostic-alert-detail__header">
        <div>
          <Badge className={`is-severity is-${alert.severity}`}>{SEVERITY_LABELS[alert.severity] || alert.severity}</Badge>
          <h2>{alert.title}</h2>
          <p>{alert.message || alert.critical_summary || sourceLabel(alert)}</p>
        </div>
        <button type="button" className="diagnostic-alert-icon-command" aria-label="Đóng detail" onClick={onClose}>
          <X size={16} strokeWidth={2.25} />
        </button>
      </header>

      <nav className="diagnostic-alert-tabs">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="diagnostic-alert-detail__loading">
          <Loader2 className="is-spinning" size={22} strokeWidth={2.25} />
          <span>Đang tải chi tiết...</span>
        </div>
      ) : null}

      {!loading && tab === 'overview' ? (
        <div className="diagnostic-alert-detail__body">
          <section className="diagnostic-alert-patient-card">
            <span className="diagnostic-alert-avatar">
              <UserRound size={18} strokeWidth={2.25} />
            </span>
            <div>
              <strong>{patientLabel(alert)}</strong>
              <span>{patientSubline(alert)}</span>
            </div>
          </section>
          <div className="diagnostic-alert-detail-grid">
            <DetailMetric label="SLA" value={getSlaText(alert)} />
            <DetailMetric label="Due at" value={formatDateTime(alert.sla_due_at)} />
            <DetailMetric label="Module" value={MODULE_LABELS[alert.module] || alert.module} />
            <DetailMetric label="Status" value={STATUS_LABELS[alert.status] || alert.status} />
            <DetailMetric label="Order" value={alert.order?.order_no || alert.source?.code} />
            <DetailMetric label="Owner" value={alert.assigned_to_role || alert.assigned_to_user_id || 'Chưa assign'} />
          </div>
          <section className="diagnostic-alert-note">
            <strong>Critical / risk summary</strong>
            <span>{alert.critical_summary || alert.message || sourceLabel(alert)}</span>
          </section>
        </div>
      ) : null}

      {!loading && tab === 'source' ? (
        <div className="diagnostic-alert-detail__body">
          <div className="diagnostic-alert-source-card">
            <Badge>{MODULE_LABELS[alert.module] || alert.module}</Badge>
            <strong>{alert.source?.code || alert.alert_no}</strong>
            <span>{sourceLabel(alert)}</span>
          </div>
          <div className="diagnostic-alert-detail-grid">
            <DetailMetric label="Nguồn" value={alert.source_type} />
            <DetailMetric label="Trạng thái" value={alert.source?.status || source?.status} />
            <DetailMetric label="Phát hiện" value={formatDateTime(alert.first_detected_at)} />
            <DetailMetric label="Notify" value={formatDateTime(alert.notified_at)} />
          </div>
          {alert.critical_items?.length ? (
            <div className="diagnostic-alert-result-items">
              {alert.critical_items.map((item) => (
                <div key={item._id || item.item_code}>
                  <strong>{item.item_name}</strong>
                  <span>{[item.result_value, item.unit, item.reference_range, item.abnormal_flag].filter(Boolean).join(' · ')}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && tab === 'timeline' ? (
        <div className="diagnostic-alert-detail__body">
          <div className="diagnostic-alert-timeline">
            {[
              ['created', 'Alert detected', alert.first_detected_at],
              ['notify', 'Notified', alert.notified_at],
              ['due', 'SLA due', alert.sla_due_at],
              ['ack', 'Acknowledged', alert.acknowledged_at],
              ['escalated', 'Last escalation', alert.last_escalated_at],
            ].filter(([, , time]) => time).map(([key, title, time]) => (
              <div key={key}>
                <i />
                <strong>{title}</strong>
                <span>{formatDateTime(time)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && tab === 'files' ? (
        <div className="diagnostic-alert-detail__body">
          <FileMatrix rows={alert.file_matrix || detail?.source_detail?.file_matrix || []} />
          {!alert.file_matrix?.length ? (
            <section className="diagnostic-alert-note">
              <strong>File context</strong>
              <span>{alert.attachment?.original_name || alert.attachment?.file_name || 'Không có file matrix cho cảnh báo này.'}</span>
            </section>
          ) : null}
        </div>
      ) : null}

      {!loading && tab === 'resolution' ? (
        <div className="diagnostic-alert-detail__body">
          <section className="diagnostic-alert-resolution">
            <AlertActions alert={alert} actioning={actioning} onAction={onAction} />
            <button type="button" onClick={() => onAction('dismiss', alert)}>
              <X size={15} strokeWidth={2.25} />
              Dismiss with reason
            </button>
          </section>
          <section className="diagnostic-alert-note">
            <strong>Allowed workflow</strong>
            <span>{Object.keys(alert.allowed_actions || {}).join(', ') || 'acknowledge, assign, escalate, resolve'}</span>
          </section>
        </div>
      ) : null}

      {!loading && tab === 'audit' ? (
        <div className="diagnostic-alert-detail__body">
          <div className="diagnostic-alert-audit">
            {audit.length ? audit.map((entry) => (
              <div key={entry._id || `${entry.action}:${entry.created_at}`}>
                <strong>{entry.action}</strong>
                <span>{formatDateTime(entry.created_at)} · {entry.status}</span>
              </div>
            )) : (
              <section className="diagnostic-alert-note">
                <strong>Chưa có audit</strong>
                <span>Audit trail sẽ cập nhật khi có thao tác xử lý cảnh báo.</span>
              </section>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function RealtimeFeed({ items = [] }) {
  return (
    <section className="diagnostic-alert-feed">
      <header>
        <span>
          <MonitorUp size={17} strokeWidth={2.25} />
          Realtime activity
        </span>
        <strong>{formatNumber(items.length)} sự kiện</strong>
      </header>
      <div>
        {items.slice(0, 8).map((item) => (
          <article key={`${item.alert_id}:${item.status}:${item.first_detected_at}`}>
            <i className={`is-${item.module}`} />
            <strong>{item.title}</strong>
            <span>{MODULE_LABELS[item.module] || item.module} · {patientLabel(item)} · {formatDateTime(item.first_detected_at)}</span>
          </article>
        ))}
        {!items.length ? <span className="diagnostic-alert-feed__empty">Chưa có activity trong bộ lọc này.</span> : null}
      </div>
    </section>
  );
}

export function DiagnosticAlertsPage({ pageKey = 'all' }) {
  const { config, filters, setFilter, resetFilters, refresh, loading, error, data } = useDiagnosticAlerts(pageKey);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [detailState, setDetailState] = useState({ loading: false, data: null });
  const [toast, setToast] = useState('');
  const [actioning, setActioning] = useState('');
  const items = data.items || [];
  const selectedId = selectedAlert?.alert_id;

  useEffect(() => {
    if (!items.length) {
      setSelectedAlert(null);
      return;
    }
    if (!selectedAlert || !items.some((item) => item.alert_id === selectedAlert.alert_id)) {
      setSelectedAlert(items[0]);
    }
  }, [items, selectedAlert]);

  useEffect(() => {
    let active = true;
    if (!selectedAlert?.alert_id) {
      setDetailState({ loading: false, data: null });
      return undefined;
    }
    setDetailState({ loading: true, data: null });
    diagnosticAlertsAPI.detail(selectedAlert.alert_id)
      .then((detail) => {
        if (active) setDetailState({ loading: false, data: detail });
      })
      .catch(() => {
        if (active) setDetailState({ loading: false, data: null });
      });
    return () => {
      active = false;
    };
  }, [selectedAlert?.alert_id]);

  async function handleAction(action, alert) {
    if (!alert?.alert_id) return;
    setActioning(`${alert.alert_id}:${action}`);
    try {
      if (action === 'acknowledge') await diagnosticAlertsAPI.acknowledge(alert.alert_id, { note: 'ACK từ Diagnostic Alert Center.' });
      if (action === 'assign') await diagnosticAlertsAPI.assign(alert.alert_id, { assigned_to_role: 'diagnostic_alert_owner' });
      if (action === 'escalate') await diagnosticAlertsAPI.escalate(alert.alert_id, { reason: 'Escalate từ Diagnostic Alert Center.', escalation_level: Number(alert.escalation_level || 0) + 1 });
      if (action === 'resolve') await diagnosticAlertsAPI.resolve(alert.alert_id, { resolution_note: 'Đã xử lý từ Diagnostic Alert Center.' });
      if (action === 'dismiss') await diagnosticAlertsAPI.dismiss(alert.alert_id, { reason: 'Không cần xử lý thêm sau rà soát.' });
      setToast(`${ACTIONS[action]?.label || action} thành công`);
      refresh();
    } catch (actionError) {
      setToast(getDiagnosticAlertErrorMessage(actionError, 'Không thể xử lý cảnh báo.'));
    } finally {
      setActioning('');
    }
  }

  const headerSummary = useMemo(() => data.summary || {}, [data.summary]);

  return (
    <div className={`diagnostic-alert-page is-${config.primaryTone}`}>
      <Toast message={toast} onClose={() => setToast('')} />
      <PageHeader config={config} loading={loading} onRefresh={refresh} />
      <KpiStrip summary={headerSummary} loading={loading} />
      <FilterBar
        filters={filters}
        setFilter={setFilter}
        resetFilters={resetFilters}
        onRefresh={refresh}
        loading={loading}
      />
      <ErrorBanner message={error} onRetry={refresh} />
      <section className="diagnostic-alert-workbench">
        <div className="diagnostic-alert-inbox">
          <header className="diagnostic-alert-inbox__header">
            <div>
              <span>Alert inbox</span>
              <strong>{formatNumber(headerSummary.open ?? items.length)} open alerts</strong>
            </div>
            <div className="diagnostic-alert-inbox__tools">
              <button type="button" title="Saved view">
                <ListChecks size={15} strokeWidth={2.25} />
              </button>
              <button type="button" title="Bulk notify">
                <MessageSquareWarning size={15} strokeWidth={2.25} />
              </button>
              <button type="button" title="Ngày hôm nay" onClick={() => setFilter('date', todayKey())}>
                <Clock3 size={15} strokeWidth={2.25} />
              </button>
            </div>
          </header>
          <AlertTable
            items={items}
            loading={loading}
            selectedId={selectedId}
            onSelect={setSelectedAlert}
            actioning={actioning}
            onAction={handleAction}
          />
        </div>
        <DetailPanel
          alert={selectedAlert}
          detail={detailState.data}
          loading={detailState.loading}
          onClose={() => setSelectedAlert(null)}
          actioning={actioning}
          onAction={handleAction}
        />
      </section>
      <RealtimeFeed items={items} />
    </div>
  );
}
