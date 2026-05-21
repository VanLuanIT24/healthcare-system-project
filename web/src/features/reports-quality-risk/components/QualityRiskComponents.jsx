import { useState } from 'react';
import { AlertTriangle, Bell, Clock3, RefreshCw, Search, ShieldAlert, X } from 'lucide-react';
import {
  DataErrorStrip,
  ExecutiveKpiCard,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  TrendChart,
} from '../../reports-overview/components/ExecutiveOverviewComponents';
import { formatDateTime, formatNumber, formatPercent, safeNumber } from '../../reports-overview/utils/formatters';
import { qrLabel, qrTone } from '../utils/qualityRiskFormatters';

export { DataErrorStrip, ReportEmptyState, ReportErrorState, ReportSectionCard, ReportSkeleton, TrendChart };

function unitForKey(key = '') {
  if (key.includes('rate') || key.includes('percent') || key.includes('compliance')) return 'percent';
  if (key.includes('minutes')) return 'minutes';
  return 'number';
}

export function qualityRiskCards(summary = {}, labels = {}) {
  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    value: safeNumber(summary[key]),
    unit: unitForKey(key),
    status: key.includes('failed') || key.includes('failure') || key.includes('breached') || key.includes('overdue') || key.includes('critical') || key.includes('risk_score')
      ? (safeNumber(summary[key]) ? 'danger' : 'good')
      : 'neutral',
  }));
}

export function QualityRiskFilterBar({ title, subtitle, filters, onChange, onReset, onRefresh, isRefreshing, lastUpdatedAt }) {
  const [advanced, setAdvanced] = useState(false);
  const update = (field, value) => onChange({ [field]: value, ...(field === 'range' && value !== 'custom' ? { date_from: '', date_to: '' } : {}) });
  return (
    <div className="operation-header qr-header">
      <div>
        <span>Chất lượng / Rủi ro</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="operation-header__tools">
        {['today', '7d', '30d', 'week', 'month', 'custom'].map((range) => (
          <button key={range} type="button" className={filters.range === range ? 'is-active' : ''} onClick={() => update('range', range)}>
            {({ today: 'Hôm nay', '7d': '7 ngày', '30d': '30 ngày', week: 'Tuần này', month: 'Tháng này', custom: 'Custom' })[range]}
          </button>
        ))}
        {filters.range === 'custom' ? (
          <>
            <input type="date" value={filters.date_from || ''} onChange={(event) => update('date_from', event.target.value)} />
            <input type="date" value={filters.date_to || ''} onChange={(event) => update('date_to', event.target.value)} />
          </>
        ) : null}
        <label className="qr-search"><Search size={15} /><input value={filters.search || ''} onChange={(event) => update('search', event.target.value)} placeholder="Tìm alert/audit/ticket..." /></label>
        {advanced ? (
          <>
            <select value={filters.severity || ''} onChange={(event) => update('severity', event.target.value)}>
              <option value="">Tất cả severity</option>
              {['info', 'warning', 'high', 'error', 'critical'].map((item) => <option key={item} value={item}>{qrLabel(item)}</option>)}
            </select>
            <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {['open', 'acknowledged', 'assigned', 'in_progress', 'escalated', 'resolved', 'dismissed', 'active', 'ended', 'failed', 'success', 'queued', 'delivered', 'closed'].map((item) => <option key={item} value={item}>{qrLabel(item)}</option>)}
            </select>
            <select value={filters.priority || ''} onChange={(event) => update('priority', event.target.value)}>
              <option value="">Tất cả ưu tiên</option>
              {['low', 'normal', 'high', 'urgent', 'critical'].map((item) => <option key={item} value={item}>{qrLabel(item)}</option>)}
            </select>
            <input value={filters.module || ''} onChange={(event) => update('module', event.target.value)} placeholder="Module" />
            <input value={filters.department_id || ''} onChange={(event) => update('department_id', event.target.value)} placeholder="Khoa" />
            <input value={filters.actor_id || ''} onChange={(event) => update('actor_id', event.target.value)} placeholder="Actor/User" />
            <input value={filters.channel || ''} onChange={(event) => update('channel', event.target.value)} placeholder="Channel" />
            <input value={filters.provider || ''} onChange={(event) => update('provider', event.target.value)} placeholder="Provider" />
            <input value={filters.job_name || ''} onChange={(event) => update('job_name', event.target.value)} placeholder="Job name" />
          </>
        ) : null}
        {['critical', 'breached', 'failed', 'active', 'urgent', 'warning'].map((chip) => (
          <button key={chip} type="button" className={filters.quick === chip ? 'is-active' : ''} onClick={() => onChange({
            quick: filters.quick === chip ? '' : chip,
            severity: chip === 'critical' || chip === 'warning' ? chip : filters.severity,
            status: ['failed', 'active'].includes(chip) ? chip : filters.status,
            sla_status: chip === 'breached' ? 'breached' : filters.sla_status,
            priority: chip === 'urgent' ? 'urgent' : filters.priority,
          })}
          >
            {qrLabel(chip)}
          </button>
        ))}
        <label className="qr-toggle"><input type="checkbox" checked={Boolean(filters.auto_refresh)} onChange={(event) => update('auto_refresh', event.target.checked)} />Auto refresh</label>
        <button type="button" onClick={() => setAdvanced((value) => !value)}>{advanced ? 'Ẩn lọc nâng cao' : 'Lọc nâng cao'}</button>
        <button type="button" onClick={onReset}>Reset bộ lọc</button>
        <button type="button" onClick={onRefresh}><RefreshCw size={15} className={isRefreshing ? 'is-spinning' : ''} />Refresh</button>
        <span>Cập nhật: {formatDateTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

export function QualityRiskKpiGrid({ cards = [], onOpen }) {
  return <div className="executive-kpi-grid qr-kpi-grid">{cards.map((card, index) => <ExecutiveKpiCard key={card.key || card.label} card={card} index={index} onClick={() => onOpen?.(card, 'KPI chất lượng/rủi ro')} />)}</div>;
}

export const QualityRiskKpiCard = ExecutiveKpiCard;

export function RiskStatusBadge({ status }) {
  return <span className={`executive-badge status-${qrTone(status)}`}>{qrLabel(status)}</span>;
}

export function QualityRiskTable({ rows = [], columns = [], onRowClick }) {
  const [sort, setSort] = useState({ key: columns[0]?.key, direction: 'asc' });
  const sorted = [...(rows || [])].sort((a, b) => {
    const left = a?.[sort.key] ?? '';
    const right = b?.[sort.key] ?? '';
    return sort.direction === 'asc' ? String(left).localeCompare(String(right)) : String(right).localeCompare(String(left));
  });
  if (!rows?.length) return <ReportEmptyState title="Chưa có dữ liệu bảng" description="Bộ lọc hiện tại không có bản ghi phù hợp." />;
  return (
    <div className="qr-table-wrap">
      <table className="executive-table qr-table">
        <thead>
          <tr>{columns.map((column) => (
            <th key={column.key}>
              <button type="button" onClick={() => setSort({ key: column.key, direction: sort.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc' })}>{column.label}</button>
            </th>
          ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={row.id || row.alert_id || row.audit_log_id || row.ticket_id || row.notification_id || row.job_run_id || index} onClick={() => onRowClick?.(row)}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const CriticalAlertBoard = ({ boards = {}, onOpen }) => (
  <div className="qr-board-grid">
    {[
      ['new_alerts', 'Mới'],
      ['unacknowledged', 'Chưa acknowledge'],
      ['overdue', 'Quá hạn'],
      ['escalated', 'Escalated'],
    ].map(([key, label]) => (
      <ReportSectionCard key={key} title={label}>
        <div className="qr-board-list">
          {(boards[key] || []).slice(0, 8).map((item) => (
            <button key={item.id} type="button" onClick={() => onOpen?.(item, 'Alert')}>
              <strong>{item.alert_no || item.title}</strong>
              <span>{item.patient_name} · {qrLabel(item.severity)} · {formatDateTime(item.created_at)}</span>
            </button>
          ))}
          {!(boards[key] || []).length ? <ReportEmptyState title="Không có mục ưu tiên" /> : null}
        </div>
      </ReportSectionCard>
    ))}
  </div>
);

export const RiskScoreCard = ({ panel, onOpen }) => (
  <button type="button" className={`qr-risk-card status-${qrTone(panel?.status)}`} onClick={() => onOpen?.(panel, 'Risk score')}>
    <span>{panel?.label}</span>
    <strong>{formatNumber(panel?.score)}</strong>
    <small>{qrLabel(panel?.status)}</small>
  </button>
);

export const RiskHeatmap = ({ rows = [], onOpen }) => (
  <div className="qr-risk-grid">
    {(rows || []).map((panel) => <RiskScoreCard key={panel.key || panel.label} panel={panel} onOpen={onOpen} />)}
  </div>
);

export const AlertSeverityDonut = ({ rows = [] }) => <TrendChart data={(rows || []).map((row) => ({ ...row, label: qrLabel(row.severity || row.label), value: row.count || row.value }))} type="donut" />;
export const SlaComplianceChart = ({ rows = [] }) => <TrendChart data={(rows || []).map((row) => ({ ...row, label: qrLabel(row.sla_status || row.status || row.label), value: row.count || row.value }))} type="donut" />;
export const BreakGlassTimeline = ({ rows = [] }) => <TrendChart data={(rows || []).map((row) => ({ ...row, label: row.date || row.label, value: row.count || row.value }))} />;
export const RiskInsightCard = ({ title, children }) => <ReportSectionCard title={title}><div className="qr-insight">{children}</div></ReportSectionCard>;

export const CriticalAlertTable = ({ rows, onOpen }) => <QualityRiskTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'alert_no', label: 'Alert code' },
  { key: 'type', label: 'Type', render: (row) => qrLabel(row.type) },
  { key: 'severity', label: 'Severity', render: (row) => <RiskStatusBadge status={row.severity} /> },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'department_name', label: 'Khoa' },
  { key: 'title', label: 'Tiêu đề' },
  { key: 'status', label: 'Trạng thái', render: (row) => <RiskStatusBadge status={row.status} /> },
  { key: 'assigned_user_name', label: 'Owner' },
  { key: 'created_at', label: 'Tạo lúc', render: (row) => formatDateTime(row.created_at) },
  { key: 'sla_status', label: 'SLA', render: (row) => <RiskStatusBadge status={row.sla_status} /> },
]} />;

export const SensitiveAccessTable = ({ rows, onOpen }) => <QualityRiskTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'actor_type', label: 'Actor type' },
  { key: 'actor_id', label: 'Actor' },
  { key: 'action', label: 'Action' },
  { key: 'module_key', label: 'Module' },
  { key: 'target_type', label: 'Target type' },
  { key: 'status', label: 'Status', render: (row) => <RiskStatusBadge status={row.status} /> },
  { key: 'severity', label: 'Severity', render: (row) => <RiskStatusBadge status={row.severity} /> },
  { key: 'ip_address', label: 'IP' },
  { key: 'created_at', label: 'Thời điểm', render: (row) => formatDateTime(row.created_at) },
  { key: 'risk_note', label: 'Risk note' },
]} />;

export const SecurityAuditTable = SensitiveAccessTable;
export const LoginAuditTable = SensitiveAccessTable;

export const SupportTicketBoard = ({ boards = {}, onOpen }) => (
  <div className="qr-board-grid">
    {[
      ['open', 'Open'],
      ['pending', 'Pending'],
      ['in_progress', 'In progress'],
      ['overdue', 'Quá SLA'],
    ].map(([key, label]) => (
      <ReportSectionCard key={key} title={label}>
        <div className="qr-board-list">
          {(boards[key] || []).slice(0, 8).map((item) => (
            <button key={item.id} type="button" onClick={() => onOpen?.(item, 'Support ticket')}>
              <strong>{item.ticket_code} · {qrLabel(item.priority)}</strong>
              <span>{item.subject}</span>
            </button>
          ))}
          {!(boards[key] || []).length ? <ReportEmptyState title="Không có ticket" /> : null}
        </div>
      </ReportSectionCard>
    ))}
  </div>
);

export const SupportTicketTable = ({ rows, onOpen }) => <QualityRiskTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'ticket_code', label: 'Ticket' },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'category', label: 'Category' },
  { key: 'subject', label: 'Subject' },
  { key: 'priority', label: 'Priority', render: (row) => <RiskStatusBadge status={row.priority} /> },
  { key: 'status', label: 'Status', render: (row) => <RiskStatusBadge status={row.status} /> },
  { key: 'assigned_department_name', label: 'Khoa' },
  { key: 'assigned_user_name', label: 'Assignee' },
  { key: 'sla_status', label: 'SLA', render: (row) => <RiskStatusBadge status={row.sla_status} /> },
  { key: 'satisfaction_rating', label: 'Rating', render: (row) => row.satisfaction_rating || '—' },
]} />;

export const ComplaintRatingPanel = ({ data = {} }) => (
  <div className="qr-rating-panel">
    <div><strong>{formatNumber(data.average_satisfaction_rating)}</strong><span>Điểm hài lòng TB</span></div>
    <div><strong>{formatNumber(data.negative_feedback_count)}</strong><span>Negative feedback</span></div>
    <div><strong>{formatNumber(data.complaint_sla_overdue)}</strong><span>Complaint quá SLA</span></div>
  </div>
);

export const SlaBreachTable = ({ rows, onOpen }) => <QualityRiskTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'module', label: 'Module', render: (row) => qrLabel(row.module) },
  { key: 'entity_type', label: 'Entity' },
  { key: 'entity_code', label: 'Code' },
  { key: 'priority', label: 'Priority', render: (row) => <RiskStatusBadge status={row.priority} /> },
  { key: 'sla_status', label: 'SLA', render: (row) => <RiskStatusBadge status={row.sla_status} /> },
  { key: 'sla_due_at', label: 'Due', render: (row) => formatDateTime(row.sla_due_at) },
  { key: 'breach_minutes', label: 'Breach phút', render: (row) => formatNumber(row.breach_minutes) },
  { key: 'owner', label: 'Owner' },
  { key: 'patient', label: 'Patient' },
  { key: 'suggested_action', label: 'Action' },
]} />;

export const JobFailureTable = ({ rows, onOpen }) => <QualityRiskTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'job_name', label: 'Job name' },
  { key: 'queue_name', label: 'Queue' },
  { key: 'job_id', label: 'Job id' },
  { key: 'status', label: 'Status', render: (row) => <RiskStatusBadge status={row.status} /> },
  { key: 'started_at', label: 'Started', render: (row) => formatDateTime(row.started_at) },
  { key: 'duration_seconds', label: 'Duration giây', render: (row) => formatNumber(row.duration_seconds) },
  { key: 'attempt', label: 'Attempt', render: (row) => formatNumber(row.attempt) },
  { key: 'records_processed', label: 'Records', render: (row) => formatNumber(row.records_processed) },
  { key: 'worker_id', label: 'Worker' },
  { key: 'error_message', label: 'Error' },
]} />;

export const NotificationFailurePanel = ({ rows = [], onOpen }) => (
  <div className="qr-board-list">
    {(rows || []).slice(0, 10).map((item) => (
      <button key={item.id} type="button" onClick={() => onOpen?.(item, 'Notification')}>
        <strong>{item.title}</strong>
        <span>{qrLabel(item.channel)} · {item.failure_reason || qrLabel(item.status)}</span>
      </button>
    ))}
    {!rows?.length ? <ReportEmptyState title="Không có notification failed" /> : null}
  </div>
);

export const NotificationDeliveryTable = ({ rows, onOpen }) => <QualityRiskTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'notification_id', label: 'Notification' },
  { key: 'recipient_type', label: 'Recipient' },
  { key: 'channel', label: 'Channel', render: (row) => qrLabel(row.channel) },
  { key: 'notification_type', label: 'Type' },
  { key: 'priority', label: 'Priority', render: (row) => <RiskStatusBadge status={row.priority} /> },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status', render: (row) => <RiskStatusBadge status={row.status} /> },
  { key: 'sent_at', label: 'Sent', render: (row) => formatDateTime(row.sent_at) },
  { key: 'delivered_at', label: 'Delivered', render: (row) => formatDateTime(row.delivered_at) },
  { key: 'failure_reason', label: 'Failure reason' },
]} />;

export const BreakGlassTable = ({ rows, onOpen }) => <QualityRiskTable rows={rows} onRowClick={onOpen} columns={[
  { key: 'patient_name', label: 'Patient' },
  { key: 'accessed_by_user_name', label: 'Accessed by' },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status', render: (row) => <RiskStatusBadge status={row.status} /> },
  { key: 'started_at', label: 'Started', render: (row) => formatDateTime(row.started_at) },
  { key: 'duration_minutes', label: 'Duration phút', render: (row) => formatNumber(row.duration_minutes) },
  { key: 'audit_log_count', label: 'Audit logs', render: (row) => formatNumber(row.audit_log_count) },
  { key: 'risk_level', label: 'Risk', render: (row) => <RiskStatusBadge status={row.risk_level} /> },
]} />;

export function QualityRiskDetailDrawer({ item, type, onClose }) {
  if (!item) return null;
  return (
    <aside className="qr-drawer" aria-label="Chi tiết quality risk">
      <div className="qr-drawer__header">
        <div>
          <span>{type}</span>
          <h2>{item.alert_no || item.ticket_code || item.case_code || item.job_name || item.title || item.action || item.notification_id || item.id}</h2>
        </div>
        <button type="button" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="qr-drawer__body">
        {Object.entries(item).filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object').slice(0, 28).map(([key, value]) => (
          <div key={key} className="qr-drawer__row">
            <span>{key.replaceAll('_', ' ')}</span>
            <strong>{String(key).includes('_at') || String(key).includes('date') ? formatDateTime(value) : String(value)}</strong>
          </div>
        ))}
        <div className="qr-drawer__timeline">
          <h3>Timeline</h3>
          {['created_at', 'started_at', 'acknowledged_at', 'sent_at', 'delivered_at', 'resolved_at', 'closed_at', 'ended_at'].map((key) => item[key] ? (
            <div key={key}><Clock3 size={14} /><span>{key.replaceAll('_', ' ')}</span><strong>{formatDateTime(item[key])}</strong></div>
          ) : null)}
        </div>
      </div>
    </aside>
  );
}

export const DiagnosticAlertDrawer = QualityRiskDetailDrawer;
export const ClinicalAlertDrawer = QualityRiskDetailDrawer;
export const BreakGlassDrawer = QualityRiskDetailDrawer;
export const AuditLogDrawer = QualityRiskDetailDrawer;
export const SupportTicketDrawer = QualityRiskDetailDrawer;
export const SlaItemDrawer = QualityRiskDetailDrawer;
export const JobRunDrawer = QualityRiskDetailDrawer;
export const NotificationDrawer = QualityRiskDetailDrawer;

export function RiskCommandCenter({ actionCenter = {}, onOpen }) {
  const groups = [
    ['critical_unacknowledged', 'Critical chưa acknowledge', AlertTriangle],
    ['break_glass_active', 'Break-glass active', ShieldAlert],
    ['audit_warning_error', 'Audit warning/error', ShieldAlert],
    ['ticket_sla_overdue', 'Ticket quá SLA', Clock3],
    ['notification_failed', 'Notification failed', Bell],
    ['job_failed', 'Job failed', AlertTriangle],
  ];
  return (
    <div className="qr-command-grid">
      {groups.map(([key, label, Icon]) => (
        <ReportSectionCard key={key} title={label}>
          <div className="qr-board-list">
            {(actionCenter[key] || []).slice(0, 8).map((item, index) => (
              <button key={item.id || index} type="button" onClick={() => onOpen?.(item, label)}>
                <Icon size={15} />
                <strong>{item.alert_no || item.ticket_code || item.job_name || item.title || item.action || item.notification_id || item.id}</strong>
                <span>{item.patient_name || item.subject || item.error_message || item.failure_reason || item.risk_note || qrLabel(item.status)}</span>
              </button>
            ))}
            {!(actionCenter[key] || []).length ? <ReportEmptyState title="Không có mục ưu tiên" /> : null}
          </div>
        </ReportSectionCard>
      ))}
    </div>
  );
}

export function SmallMetric({ label, value, unit }) {
  return (
    <div className="qr-small-metric">
      <span>{label}</span>
      <strong>{unit === 'percent' ? formatPercent(value) : formatNumber(value)}</strong>
    </div>
  );
}
