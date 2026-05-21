import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  BellRing,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Command,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileClock,
  Filter,
  Fingerprint,
  Gauge,
  HeartPulse,
  KeyRound,
  LockKeyhole,
  LogOut,
  Map,
  Network,
  PlayCircle,
  RadioTower,
  RefreshCw,
  Search,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  TableProperties,
  TestTube2,
  UserRound,
  UsersRound,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { commandCenterGet, commandCenterPost } from './commandCenterApi';

const VIEW_CONFIG = {
  dashboard: {
    title: 'Dashboard quản trị',
    endpoint: '/dashboard',
    icon: Command,
  },
  health: {
    title: 'Sức khỏe hệ thống',
    endpoint: '/health',
    icon: Activity,
  },
  tasks: {
    title: 'Việc cần xử lý',
    endpoint: '/work-items',
    icon: ClipboardCheck,
  },
  systemAlerts: {
    title: 'Cảnh báo hệ thống',
    endpoint: '/system-alerts',
    icon: AlertTriangle,
  },
  securityAlerts: {
    title: 'Cảnh báo bảo mật',
    endpoint: '/security-alerts',
    icon: ShieldAlert,
  },
  recentActivity: {
    title: 'Hoạt động gần đây',
    endpoint: '/recent-activities',
    icon: FileClock,
  },
  sessions: {
    title: 'Phiên đăng nhập realtime',
    endpoint: '/sessions',
    icon: RadioTower,
  },
  workers: {
    title: 'Tình trạng worker / queue',
    endpoint: '/workers',
    icon: ServerCog,
  },
  realtime: {
    title: 'Tình trạng realtime',
    endpoint: '/realtime',
    icon: Wifi,
  },
  workspaceMap: {
    title: 'Bản đồ workspace',
    endpoint: '/workspace-map',
    icon: Map,
  },
};

const CARD_ICONS = {
  api_health: Activity,
  database_health: Database,
  worker_health: ServerCog,
  notification_failed: BellRing,
  dead_letter_events: Archive,
  security_risk: ShieldAlert,
  active_staff_sessions: UsersRound,
  pending_admin_tasks: ClipboardCheck,
  locked_staff: LockKeyhole,
  appointments_today: Clock3,
  unpaid_invoices: BarChart3,
  revenue_today: Gauge,
};

const WORKSPACE_ICONS = {
  admin: ShieldCheck,
  scheduling: Clock3,
  reception: ClipboardCheck,
  doctor: Stethoscope,
  nursing: HeartPulse,
  lab: TestTube2,
  pharmacy: BellRing,
  billing: BarChart3,
  reports: TableProperties,
};

const TABLE_COLUMNS = {
  job_run_logs: ['job_name', 'queue_name', 'status', 'started_at', 'finished_at', 'duration_ms', 'records_processed', 'error_message'],
  event_outbox: ['event_type', 'aggregate_type', 'status', 'retry_count', 'next_retry_at', 'last_error', 'created_at'],
  notification_delivery: ['channel', 'provider', 'status', 'attempt_count', 'next_attempt_at', 'last_error', 'created_at'],
  idempotency_records: ['method', 'route', 'status', 'status_code', 'expires_at', 'created_at'],
  qr_tokens: ['type', 'target_type', 'expires_at', 'used_at', 'revoked_at', 'created_at'],
  file_scans: ['file_name', 'scan_status', 'review_status', 'source', 'created_at'],
};

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function compactValue(card) {
  if (card?.key === 'revenue_today') return formatCurrency(card.value);
  return formatNumber(card?.value);
}

function readableLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusLabel(status) {
  return {
    healthy: 'Healthy',
    degraded: 'Degraded',
    critical: 'Critical',
    available: 'Available',
    unavailable: 'Unavailable',
  }[status] || readableLabel(status || 'Unknown');
}

function StatusBadge({ status }) {
  return <span className={`cc-status cc-status--${status || 'neutral'}`}>{statusLabel(status)}</span>;
}

function SeverityBadge({ severity }) {
  return <span className={`cc-severity cc-severity--${severity || 'info'}`}>{readableLabel(severity || 'info')}</span>;
}

function ActionButton({ icon: Icon = Eye, label, onClick, variant = 'ghost', disabled }) {
  return (
    <button type="button" className={`cc-action-button cc-action-button--${variant}`} onClick={onClick} disabled={disabled} title={label}>
      <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function IconButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button type="button" className="cc-icon-button" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      <Icon size={17} strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, meta, action }) {
  return (
    <div className="cc-section-head">
      <div>
        {Icon ? <Icon size={18} strokeWidth={2.25} aria-hidden="true" /> : null}
        <h2>{title}</h2>
      </div>
      <span>{meta}</span>
      {action}
    </div>
  );
}

function EmptyState({ title = 'Chưa có dữ liệu' }) {
  return (
    <div className="cc-empty">
      <CheckCircle2 size={22} strokeWidth={2.25} aria-hidden="true" />
      <span>{title}</span>
    </div>
  );
}

function MiniKpi({ item }) {
  const Icon = CARD_ICONS[item.key] || Gauge;
  return (
    <Link to={item.route || '#'} className={`cc-kpi cc-kpi--${item.status || 'healthy'}`}>
      <span className="cc-kpi__icon"><Icon size={18} strokeWidth={2.25} aria-hidden="true" /></span>
      <span>{item.label}</span>
      <strong>{compactValue(item)}</strong>
      <small>{item.helper}</small>
    </Link>
  );
}

function CriticalStrip({ alerts = [], onAction }) {
  return (
    <section className="cc-critical-strip">
      <SectionHeader icon={AlertTriangle} title="Critical Strip" meta={`${alerts.length} tín hiệu ưu tiên`} />
      {alerts.length ? (
        <div className="cc-alert-ribbon">
          {alerts.slice(0, 8).map((alert) => (
            <button key={alert.id} type="button" className={`cc-alert-pill cc-alert-pill--${alert.severity}`} onClick={() => onAction?.('inspect', alert)}>
              <SeverityBadge severity={alert.severity} />
              <span>{alert.title}</span>
              <strong>{formatNumber(alert.count || 1)}</strong>
            </button>
          ))}
        </div>
      ) : <EmptyState title="Không có cảnh báo ưu tiên" />}
    </section>
  );
}

function WorkspaceTile({ workspace }) {
  const Icon = WORKSPACE_ICONS[workspace.code] || Building2;
  return (
    <article className={`cc-workspace-tile cc-workspace-tile--${workspace.status}`}>
      <div className="cc-workspace-tile__top">
        <span><Icon size={18} strokeWidth={2.25} aria-hidden="true" /></span>
        <StatusBadge status={workspace.status} />
      </div>
      <strong>{workspace.name}</strong>
      <small>{workspace.route}</small>
      <div className="cc-workspace-tile__metrics">
        <span><b>{formatNumber(workspace.pending_tasks)}</b> việc</span>
        <span><b>{formatNumber(workspace.alerts)}</b> alert</span>
        <span><b>{formatNumber(workspace.online_users)}</b> online</span>
      </div>
      <Link to={workspace.route || '#'} className="cc-row-link">
        <ExternalLink size={15} strokeWidth={2.25} aria-hidden="true" />
        <span>Mở workspace</span>
      </Link>
    </article>
  );
}

function WorkItemList({ items = [], onAction, compact = false }) {
  if (!items.length) return <EmptyState title="Không có việc cần xử lý" />;
  return (
    <div className={compact ? 'cc-work-list cc-work-list--compact' : 'cc-work-list'}>
      {items.map((item) => (
        <article key={item.id} className={`cc-work-item cc-work-item--${item.severity}`}>
          <div className="cc-work-item__main">
            <SeverityBadge severity={item.severity} />
            <div>
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </div>
          </div>
          <div className="cc-work-item__meta">
            <span>{readableLabel(item.source_module)}</span>
            <span>{item.sla_due_at ? `SLA ${formatDateTime(item.sla_due_at)}` : formatDateTime(item.created_at)}</span>
          </div>
          <div className="cc-work-item__actions">
            {item.actions?.includes('retry_event') ? (
              <IconButton icon={RefreshCw} label="Retry event" onClick={() => onAction('retry_event', item)} />
            ) : null}
            {item.actions?.some((action) => action.includes('notification')) ? (
              <IconButton icon={BellRing} label="Retry notification" onClick={() => onAction('retry_notification', item)} />
            ) : null}
            <IconButton icon={CheckCircle2} label="Acknowledge" onClick={() => onAction('ack_work_item', item)} />
          </div>
        </article>
      ))}
    </div>
  );
}

function AlertInbox({ alerts = [], onAction, selectedId, onSelect }) {
  if (!alerts.length) return <EmptyState title="Không có cảnh báo đang mở" />;
  return (
    <div className="cc-alert-table">
      <div className="cc-alert-table__head">
        <span>Severity</span>
        <span>Component</span>
        <span>Alert</span>
        <span>Count</span>
        <span>Last seen</span>
        <span>Actions</span>
      </div>
      {alerts.map((alert) => (
        <button
          type="button"
          key={alert.id}
          className={`cc-alert-row${selectedId === alert.id ? ' is-selected' : ''}`}
          onClick={() => onSelect(alert)}
        >
          <SeverityBadge severity={alert.severity} />
          <span>{alert.component}</span>
          <strong>{alert.title}</strong>
          <span>{formatNumber(alert.count || 1)}</span>
          <span>{formatDateTime(alert.last_seen_at || alert.created_at)}</span>
          <span className="cc-alert-row__actions">
            {alert.actions?.includes('retry_event') ? (
              <IconButton icon={RefreshCw} label="Retry event" onClick={(event) => { event.stopPropagation(); onAction('retry_event', alert); }} />
            ) : null}
            {alert.actions?.some((action) => action.includes('notification')) ? (
              <IconButton icon={BellRing} label="Retry notification" onClick={(event) => { event.stopPropagation(); onAction('retry_notification', alert); }} />
            ) : null}
            <IconButton icon={CheckCircle2} label="Resolve" onClick={(event) => { event.stopPropagation(); onAction('resolve_alert', alert); }} />
          </span>
        </button>
      ))}
    </div>
  );
}

function AlertDetail({ alert }) {
  if (!alert) return <EmptyState title="Chọn một cảnh báo" />;
  return (
    <aside className="cc-detail-pane">
      <div className="cc-detail-pane__head">
        <SeverityBadge severity={alert.severity} />
        <strong>{alert.title}</strong>
        <span>{alert.component}</span>
      </div>
      <p>{alert.message}</p>
      <dl>
        <div><dt>Source</dt><dd>{alert.source_type || alert.alert_type}</dd></div>
        <div><dt>Record</dt><dd>{alert.source_id || alert.id}</dd></div>
        <div><dt>Status</dt><dd>{alert.status}</dd></div>
        <div><dt>Last seen</dt><dd>{formatDateTime(alert.last_seen_at || alert.created_at)}</dd></div>
      </dl>
    </aside>
  );
}

function TimelineFeed({ items = [] }) {
  if (!items.length) return <EmptyState title="Chưa có hoạt động gần đây" />;
  return (
    <div className="cc-timeline">
      {items.map((item) => (
        <article key={item._id || item.id || `${item.action}-${item.created_at}`} className={`cc-timeline-item cc-timeline-item--${item.status || 'success'}`}>
          <span className="cc-timeline-item__dot" />
          <div>
            <strong>{item.message || item.action}</strong>
            <span>{item.module_key || item.target_type || 'system'} • {formatDateTime(item.created_at)} • {item.request_id || 'no request id'}</span>
          </div>
          <SeverityBadge severity={item.severity || 'info'} />
        </article>
      ))}
    </div>
  );
}

function SessionTable({ sessions = [], onAction }) {
  if (!sessions.length) return <EmptyState title="Không có phiên staff active" />;
  return (
    <div className="cc-data-table cc-session-table">
      <div className="cc-data-table__head">
        <span>User</span>
        <span>Role</span>
        <span>Device/IP</span>
        <span>Last seen</span>
        <span>Risk</span>
        <span>Actions</span>
      </div>
      {sessions.map((session) => (
        <div key={session.session_id} className="cc-data-table__row">
          <span>
            <strong>{session.full_name}</strong>
            <small>{session.department_name}</small>
          </span>
          <span>{(session.roles || []).slice(0, 2).join(', ') || 'staff'}</span>
          <span>
            <strong>{session.device_name}</strong>
            <small>{session.ip || 'IP unknown'}</small>
          </span>
          <span>{formatDateTime(session.last_seen_at)}</span>
          <span className={`cc-risk cc-risk--${session.risk_score >= 50 ? 'critical' : session.risk_score >= 20 ? 'high' : 'low'}`}>{session.risk_score}</span>
          <span className="cc-data-table__actions">
            <IconButton icon={LogOut} label="Revoke session" onClick={() => onAction('revoke_session', session)} />
          </span>
        </div>
      ))}
    </div>
  );
}

function GenericTable({ rows = [], columns = [] }) {
  if (!rows.length) return <EmptyState title="Không có bản ghi" />;
  return (
    <div className="cc-generic-table" style={{ '--cc-table-cols': columns.length }}>
      <div className="cc-generic-table__head">
        {columns.map((column) => <span key={column}>{readableLabel(column)}</span>)}
      </div>
      {rows.map((row) => (
        <div className="cc-generic-table__row" key={row._id || row.id || JSON.stringify(row).slice(0, 40)}>
          {columns.map((column) => (
            <span key={column} title={String(row[column] || '')}>
              {column.includes('_at') ? formatDateTime(row[column]) : typeof row[column] === 'object' ? JSON.stringify(row[column]) : String(row[column] ?? '—')}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function BarSet({ items = [] }) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 1);
  return (
    <div className="cc-bars">
      {items.map((item) => (
        <div key={item.label}>
          <span style={{ height: `${Math.max((Number(item.value || 0) / max) * 100, item.value > 0 ? 8 : 0)}%` }} />
          <strong>{item.label}</strong>
          <small>{formatNumber(item.value)}</small>
        </div>
      ))}
    </div>
  );
}

function DashboardView({ data, onAction }) {
  return (
    <>
      <div className="cc-kpi-grid">
        {(data.summary_cards || []).slice(0, 12).map((item) => <MiniKpi key={item.key} item={item} />)}
      </div>
      <CriticalStrip alerts={data.critical_alerts || []} onAction={onAction} />
      <section className="cc-grid cc-grid--workspace">
        <div className="cc-panel cc-panel--wide">
          <SectionHeader icon={Map} title="Workspace Health Map" meta={`${data.workspace_health?.length || 0} workspace`} />
          <div className="cc-workspace-grid">
            {(data.workspace_health || []).map((workspace) => <WorkspaceTile key={workspace.code} workspace={workspace} />)}
          </div>
        </div>
        <div className="cc-panel">
          <SectionHeader icon={ClipboardCheck} title="Work Queue" meta={`${data.work_item_summary?.total || 0} việc`} />
          <WorkItemList items={(data.work_items || []).slice(0, 8)} onAction={onAction} compact />
        </div>
      </section>
      <section className="cc-grid cc-grid--two">
        <div className="cc-panel">
          <SectionHeader icon={FileClock} title="Hoạt động gần đây" meta={`${data.recent_activities?.length || 0} dòng`} />
          <TimelineFeed items={(data.recent_activities || []).slice(0, 8)} />
        </div>
        <div className="cc-panel">
          <SectionHeader icon={RadioTower} title="Realtime Sessions" meta={`${data.active_sessions?.length || 0} phiên`} />
          <SessionTable sessions={(data.active_sessions || []).slice(0, 6)} onAction={onAction} />
        </div>
      </section>
      <section className="cc-grid cc-grid--three">
        <div className="cc-panel">
          <SectionHeader icon={Archive} title="Event Outbox" meta="status" />
          <BarSet items={Object.entries(data.ops_snapshot?.outbox || {}).map(([label, value]) => ({ label, value }))} />
        </div>
        <div className="cc-panel">
          <SectionHeader icon={BellRing} title="Notification Delivery" meta="status" />
          <BarSet items={Object.entries(data.ops_snapshot?.notification_delivery || {}).map(([label, value]) => ({ label, value }))} />
        </div>
        <div className="cc-panel">
          <SectionHeader icon={ShieldAlert} title="Security Risk" meta={`${data.security_snapshot?.risk_score || 0}/100`} />
          <div className="cc-risk-dial">
            <strong>{data.security_snapshot?.risk_score || 0}</strong>
            <span>risk score</span>
          </div>
        </div>
      </section>
    </>
  );
}

function HealthView({ data, onRefresh }) {
  return (
    <>
      <section className="cc-health-hero">
        <div>
          <span>Overall health</span>
          <strong>{statusLabel(data.overall_status)}</strong>
          <small>Last check {formatDateTime(data.checked_at)}</small>
        </div>
        <ActionButton icon={PlayCircle} label="Run health check" onClick={onRefresh} variant="primary" />
      </section>
      <div className="cc-component-grid">
        {(data.components || []).map((component) => (
          <article key={component.key} className={`cc-component cc-component--${component.status}`}>
            <div>
              <StatusBadge status={component.status} />
              <strong>{component.name}</strong>
              <span>{component.owner_module}</span>
            </div>
            <dl>
              <div><dt>Failed</dt><dd>{formatNumber(component.failed || component.dead_letter || 0)}</dd></div>
              <div><dt>Pending</dt><dd>{formatNumber(component.pending || 0)}</dd></div>
              <div><dt>Latency</dt><dd>{component.latency_ms ?? '—'}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <section className="cc-panel">
        <SectionHeader icon={Gauge} title="Error Trend" meta="24h" />
        <BarSet items={Object.entries(data.trends || {}).map(([label, value]) => ({ label: readableLabel(label), value }))} />
      </section>
    </>
  );
}

function TasksView({ data, filters, setFilters, onAction }) {
  const items = data.items || [];
  const summary = data.summary || {};
  return (
    <>
      <div className="cc-summary-strip">
        {['total', 'critical', 'high', 'medium', 'low', 'overdue', 'assigned_to_me'].map((key) => (
          <article key={key}>
            <span>{readableLabel(key)}</span>
            <strong>{formatNumber(summary[key])}</strong>
          </article>
        ))}
      </div>
      <FilterBar filters={filters} setFilters={setFilters} modules={['security', 'iam', 'ops', 'billing', 'clinical', 'pharmacy', 'portal', 'support']} />
      <section className="cc-panel">
        <SectionHeader icon={ClipboardCheck} title="Admin Work Queue" meta={`${items.length} bản ghi`} />
        <WorkItemList items={items} onAction={onAction} />
      </section>
    </>
  );
}

function AlertsView({ data, filters, setFilters, onAction, mode }) {
  const [selected, setSelected] = useState(null);
  const alerts = data.items || [];
  const summary = data.summary || {};
  const Icon = mode === 'security' ? ShieldAlert : AlertTriangle;
  return (
    <>
      <div className="cc-summary-strip">
        {['total', 'critical', 'high', 'medium', 'low'].map((key) => (
          <article key={key}>
            <span>{readableLabel(key)}</span>
            <strong>{formatNumber(summary[key])}</strong>
          </article>
        ))}
        {mode === 'security' ? (
          <article>
            <span>Risk score</span>
            <strong>{formatNumber(summary.risk_score)}</strong>
          </article>
        ) : null}
      </div>
      <FilterBar filters={filters} setFilters={setFilters} modules={[]} />
      <section className="cc-alert-layout">
        <div className="cc-panel cc-panel--wide">
          <SectionHeader icon={Icon} title={mode === 'security' ? 'Security Alert Table' : 'Alert Inbox'} meta={`${alerts.length} cảnh báo`} />
          <AlertInbox alerts={alerts} onAction={onAction} selectedId={selected?.id} onSelect={setSelected} />
        </div>
        <AlertDetail alert={selected || alerts[0]} />
      </section>
    </>
  );
}

function RecentActivityView({ data, filters, setFilters }) {
  return (
    <>
      <FilterBar filters={filters} setFilters={setFilters} modules={['auth', 'users', 'roles', 'permissions', 'settings', 'billing', 'security']} />
      <section className="cc-panel">
        <SectionHeader icon={FileClock} title="Activity Feed" meta={`${data.items?.length || 0} dòng`} />
        <TimelineFeed items={data.items || []} />
      </section>
    </>
  );
}

function SessionsView({ data, onAction }) {
  const sessions = data.sessions || [];
  const byRole = sessions.reduce((acc, item) => {
    (item.roles || ['staff']).forEach((role) => { acc[role] = (acc[role] || 0) + 1; });
    return acc;
  }, {});
  const byDepartment = sessions.reduce((acc, item) => {
    acc[item.department_name || 'Chưa gán'] = (acc[item.department_name || 'Chưa gán'] || 0) + 1;
    return acc;
  }, {});
  return (
    <>
      <div className="cc-summary-strip">
        {Object.entries(data.summary || {}).map(([key, value]) => (
          <article key={key}><span>{readableLabel(key)}</span><strong>{formatNumber(value)}</strong></article>
        ))}
      </div>
      <section className="cc-grid cc-grid--two">
        <div className="cc-panel">
          <SectionHeader icon={UsersRound} title="Online theo role" meta={`${Object.keys(byRole).length} role`} />
          <BarSet items={Object.entries(byRole).map(([label, value]) => ({ label, value }))} />
        </div>
        <div className="cc-panel">
          <SectionHeader icon={Building2} title="Online theo khoa/phòng" meta={`${Object.keys(byDepartment).length} nhóm`} />
          <BarSet items={Object.entries(byDepartment).map(([label, value]) => ({ label, value }))} />
        </div>
      </section>
      <section className="cc-panel">
        <SectionHeader icon={RadioTower} title="Session Table" meta={`${sessions.length} phiên`} />
        <SessionTable sessions={sessions} onAction={onAction} />
      </section>
    </>
  );
}

function WorkersView({ data, onAction }) {
  const [tab, setTab] = useState('job_run_logs');
  const tabs = data.tabs || {};
  const summary = data.summary || {};
  const summaryCards = [
    ['Outbox pending', summary.outbox?.pending],
    ['Outbox failed', summary.outbox?.failed],
    ['Dead-letter', summary.outbox?.dead_letter],
    ['Delivery pending', summary.notification_delivery?.pending],
    ['Delivery failed', summary.notification_delivery?.failed],
    ['Jobs failed 24h', summary.failed_jobs_24h],
  ];
  return (
    <>
      <div className="cc-summary-strip">
        {summaryCards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{formatNumber(value)}</strong></article>)}
      </div>
      <section className="cc-panel">
        <SectionHeader icon={ServerCog} title="Worker Tables" meta={readableLabel(tab)} />
        <div className="cc-tabs">
          {Object.keys(tabs).map((key) => (
            <button key={key} type="button" className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{readableLabel(key)}</button>
          ))}
        </div>
        <GenericTable rows={tabs[tab] || []} columns={TABLE_COLUMNS[tab] || []} />
        {tab === 'event_outbox' ? (
          <div className="cc-panel-actions">
            <ActionButton icon={RefreshCw} label="Retry selected từ từng dòng" onClick={() => onAction('noop')} />
          </div>
        ) : null}
      </section>
    </>
  );
}

function RealtimeView({ data, onAction }) {
  return (
    <>
      <section className="cc-health-hero">
        <div>
          <span>Socket status</span>
          <strong>{statusLabel(data.socket_status)}</strong>
          <small>{formatNumber(data.connected_clients)} connected clients</small>
        </div>
        <ActionButton icon={RadioTower} label="Broadcast test to self" onClick={() => onAction('test_realtime')} variant="primary" />
      </section>
      <div className="cc-kpi-grid cc-kpi-grid--compact">
        {(data.cards || []).map((item) => <MiniKpi key={item.key} item={{ ...item, helper: statusLabel(item.status) }} />)}
      </div>
      <section className="cc-grid cc-grid--two">
        <div className="cc-panel">
          <SectionHeader icon={Network} title="Room Monitor" meta={`${data.rooms?.length || 0} room`} />
          <GenericTable rows={data.rooms || []} columns={['room', 'type', 'connected_sockets', 'last_activity_at', 'allowed_actor_types']} />
        </div>
        <div className="cc-panel">
          <SectionHeader icon={UserRound} title="Presence" meta={`${data.presence?.length || 0} actor`} />
          <GenericTable rows={data.presence || []} columns={['actor_type', 'actor_id', 'socket_count', 'last_seen_at', 'rooms']} />
        </div>
      </section>
      <section className="cc-panel">
        <SectionHeader icon={Activity} title="Event Monitor" meta={`${data.events_recent?.length || 0} event`} />
        <GenericTable rows={data.events_recent || []} columns={['event_type', 'aggregate_type', 'status', 'occurred_at', 'created_at']} />
      </section>
    </>
  );
}

function WorkspaceMapView({ data }) {
  return (
    <>
      <div className="cc-summary-strip">
        {Object.entries(data.summary || {}).map(([key, value]) => <article key={key}><span>{readableLabel(key)}</span><strong>{formatNumber(value)}</strong></article>)}
      </div>
      <section className="cc-panel">
        <SectionHeader icon={Map} title="Workspace Grid" meta={`${data.workspaces?.length || 0} workspace`} />
        <div className="cc-workspace-grid cc-workspace-grid--large">
          {(data.workspaces || []).map((workspace) => <WorkspaceTile key={workspace.code} workspace={workspace} />)}
        </div>
      </section>
      <section className="cc-grid cc-grid--two">
        <div className="cc-panel">
          <SectionHeader icon={Network} title="Workspace Dependency Map" meta={`${data.dependencies?.length || 0} dependency`} />
          <div className="cc-dependency-map">
            {(data.dependencies || []).map((edge) => (
              <div key={`${edge.from}-${edge.to}`}>
                <strong>{edge.from}</strong>
                <span>{edge.label}</span>
                <strong>{edge.to}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="cc-panel">
          <SectionHeader icon={TableProperties} title="Access Matrix Preview" meta={`${data.access_matrix?.length || 0} dòng`} />
          <div className="cc-access-matrix">
            {(data.access_matrix || []).slice(0, 8).map((row) => (
              <article key={row.workspace_code}>
                <strong>{row.workspace_name}</strong>
                <div>
                  {(row.roles || []).slice(0, 8).map((role) => (
                    <span key={`${row.workspace_code}-${role.role_code}`} className={role.access === 'allowed' ? 'is-allowed' : ''}>{role.role_code}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function FilterBar({ filters, setFilters, modules = [] }) {
  return (
    <section className="cc-filterbar">
      <label>
        <Search size={16} strokeWidth={2.25} aria-hidden="true" />
        <input value={filters.search || ''} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Tìm kiếm" />
      </label>
      <select value={filters.severity || ''} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}>
        <option value="">Severity</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      {modules.length ? (
        <select value={filters.module || ''} onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))}>
          <option value="">Module</option>
          {modules.map((module) => <option key={module} value={module}>{readableLabel(module)}</option>)}
        </select>
      ) : null}
      <select value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
        <option value="">Status</option>
        <option value="new">New</option>
        <option value="open">Open</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="in_progress">In progress</option>
        <option value="resolved">Resolved</option>
      </select>
      <button type="button" onClick={() => setFilters({})}>
        <Filter size={16} strokeWidth={2.25} aria-hidden="true" />
        <span>Clear</span>
      </button>
    </section>
  );
}

export function CommandCenterPage({ view = 'dashboard' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.dashboard;
  const [bootstrap, setBootstrap] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const serialized = params.toString();
    return serialized ? `?${serialized}` : '';
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [bootstrapPayload, detailPayload] = await Promise.all([
        commandCenterGet('/bootstrap'),
        commandCenterGet(`${config.endpoint}${queryString}`),
      ]);
      setBootstrap(bootstrapPayload);
      setDetail(detailPayload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, queryString]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExportSnapshot() {
    setActionLoading(true);
    try {
      const snapshot = await commandCenterPost('/export-snapshot');
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `command-center-snapshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAction(action, item = {}) {
    if (action === 'noop' || action === 'inspect') return;
    setActionLoading(true);
    setError('');
    try {
      if (action === 'retry_event' && item.source_id) {
        await commandCenterPost(`/events/${item.source_id}/retry`);
      } else if (action === 'retry_notification' && item.source_id) {
        await commandCenterPost(`/notifications/${item.source_id}/retry`);
      } else if (action === 'revoke_session') {
        await commandCenterPost(`/sessions/${item.session_id || item.source_id}/revoke`, { reason: 'Revoked from Command Center UI' });
      } else if (action === 'ack_work_item') {
        await commandCenterPost(`/work-items/${encodeURIComponent(item.id)}/acknowledge`);
      } else if (action === 'resolve_alert') {
        const segment = view === 'securityAlerts' ? 'security-alerts' : 'system-alerts';
        await commandCenterPost(`/${segment}/${encodeURIComponent(item.id)}/resolve`);
      } else if (action === 'test_realtime') {
        await commandCenterPost('/realtime/test-self');
      }
      await load();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setActionLoading(false);
    }
  }

  const data = detail || bootstrap || {};
  const headerData = bootstrap || data;
  const Icon = config.icon;

  function renderView() {
    if (loading && !bootstrap && !detail) {
      return <div className="cc-loading"><RefreshCw size={22} strokeWidth={2.25} aria-hidden="true" />Đang tải Command Center</div>;
    }
    if (view === 'health') return <HealthView data={data} onRefresh={load} />;
    if (view === 'tasks') return <TasksView data={data} filters={filters} setFilters={setFilters} onAction={handleAction} />;
    if (view === 'systemAlerts') return <AlertsView data={data} filters={filters} setFilters={setFilters} onAction={handleAction} mode="system" />;
    if (view === 'securityAlerts') return <AlertsView data={data} filters={filters} setFilters={setFilters} onAction={handleAction} mode="security" />;
    if (view === 'recentActivity') return <RecentActivityView data={data} filters={filters} setFilters={setFilters} />;
    if (view === 'sessions') return <SessionsView data={data} onAction={handleAction} />;
    if (view === 'workers') return <WorkersView data={data} onAction={handleAction} />;
    if (view === 'realtime') return <RealtimeView data={data} onAction={handleAction} />;
    if (view === 'workspaceMap') return <WorkspaceMapView data={data} />;
    return <DashboardView data={data} onAction={handleAction} />;
  }

  return (
    <div className="cc-shell">
      <header className="cc-header">
        <div className="cc-header__title">
          <span><Icon size={22} strokeWidth={2.35} aria-hidden="true" /></span>
          <div>
            <small>Command Center</small>
            <h1>{config.title}</h1>
          </div>
          <StatusBadge status={headerData.overall_status || data.overall_status || data.overall_worker_status || data.socket_status || 'healthy'} />
        </div>
        <div className="cc-header__meta">
          <span>Last checked {formatDateTime(headerData.checked_at || data.checked_at)}</span>
          {error ? <strong className="cc-error"><XCircle size={16} strokeWidth={2.25} aria-hidden="true" />{error}</strong> : null}
        </div>
        <div className="cc-header__actions">
          <ActionButton icon={RefreshCw} label="Refresh" onClick={load} disabled={loading || actionLoading} />
          <Link to="/admin/command-center/health" className="cc-link-button">
            <Activity size={16} strokeWidth={2.25} aria-hidden="true" />
            <span>Open diagnostics</span>
          </Link>
          <ActionButton icon={Download} label="Export snapshot" onClick={handleExportSnapshot} disabled={actionLoading} />
          {headerData.permissions?.can_enable_maintenance ? (
            <ActionButton icon={KeyRound} label="Maintenance mode" onClick={() => handleAction('noop')} />
          ) : null}
        </div>
      </header>

      {view !== 'dashboard' && bootstrap?.summary_cards?.length ? (
        <div className="cc-mini-strip">
          {bootstrap.summary_cards.slice(0, 8).map((item) => (
            <span key={item.key} className={`cc-mini-strip__item cc-mini-strip__item--${item.status}`}>
              {item.label}
              <strong>{compactValue(item)}</strong>
            </span>
          ))}
        </div>
      ) : null}

      {renderView()}
    </div>
  );
}
