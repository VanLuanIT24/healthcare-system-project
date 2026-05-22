import {
  Activity,
  AlertTriangle,
  Archive,
  BellRing,
  CheckCircle2,
  Clipboard,
  Clock3,
  Database,
  Eye,
  FileClock,
  Fingerprint,
  Gauge,
  HardDrive,
  ListFilter,
  LockKeyhole,
  PlayCircle,
  RadioTower,
  RefreshCw,
  Router,
  ScanLine,
  Search,
  Send,
  ServerCog,
  ShieldAlert,
  SlidersHorizontal,
  TerminalSquare,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { opsGet, opsPatch, opsPost } from './operationsApi';

const OPS_VIEWS = [
  { key: 'dashboard', path: '/admin/operations', title: 'Operations Center', endpoint: '/dashboard', icon: ServerCog },
  { key: 'workerHealth', path: '/admin/operations/worker-health', title: 'Worker health', endpoint: '/health', icon: Activity },
  { key: 'jobs', path: '/admin/operations/jobs', title: 'Jobs / Workers', endpoint: '/jobs', icon: ServerCog },
  { key: 'jobRuns', path: '/admin/operations/job-runs', title: 'Job run logs', endpoint: '/job-runs', icon: FileClock },
  { key: 'eventOutbox', path: '/admin/operations/event-outbox', title: 'Event outbox', endpoint: '/event-outbox', icon: Archive },
  { key: 'deadLetter', path: '/admin/operations/dead-letter', title: 'Dead-letter events', endpoint: '/dead-letter-events', icon: ShieldAlert },
  { key: 'retryEvent', path: '/admin/operations/retry-event', title: 'Retry event', endpoint: '/health', icon: RefreshCw },
  { key: 'notificationDelivery', path: '/admin/operations/notification-delivery', title: 'Notification delivery', endpoint: '/notification-deliveries', icon: BellRing },
  { key: 'notificationFailed', path: '/admin/operations/notification-failed', title: 'Notification failed', endpoint: '/notification-failures/groups', icon: AlertTriangle },
  { key: 'realtime', path: '/admin/operations/realtime', title: 'Realtime status', endpoint: '/realtime/status', icon: Wifi },
  { key: 'socketPresence', path: '/admin/operations/socket-presence', title: 'Socket presence', endpoint: '/socket-presence', icon: RadioTower },
  { key: 'idempotency', path: '/admin/operations/idempotency', title: 'Idempotency records', endpoint: '/idempotency-records', icon: Fingerprint },
  { key: 'qrTokens', path: '/admin/operations/qr-tokens', title: 'QR tokens', endpoint: '/qr-tokens', icon: ScanLine },
  { key: 'fileScans', path: '/admin/operations/file-scans', title: 'File scan status', endpoint: '/file-scans', icon: HardDrive },
  { key: 'diagnostics', path: '/admin/operations/diagnostics', title: 'System diagnostics', endpoint: '/diagnostics', icon: TerminalSquare },
  { key: 'maintenance', path: '/admin/operations/maintenance', title: 'Maintenance mode', endpoint: '/maintenance', icon: SlidersHorizontal },
];

const TABLE_COLUMNS = {
  jobRuns: [
    ['status', 'Status'],
    ['job_name', 'Job name'],
    ['queue_name', 'Queue'],
    ['job_id', 'Job ID'],
    ['attempt', 'Attempt'],
    ['worker_id', 'Worker ID'],
    ['started_at', 'Started'],
    ['duration_ms', 'Duration'],
    ['records_processed', 'Records'],
    ['correlation_id', 'Correlation'],
    ['error_message', 'Error'],
  ],
  eventOutbox: [
    ['status', 'Status'],
    ['event_type', 'Event type'],
    ['aggregate_type', 'Aggregate'],
    ['aggregate_id', 'Aggregate ID'],
    ['occurred_at', 'Occurred'],
    ['retry_count', 'Retry'],
    ['next_retry_at', 'Next retry'],
    ['last_error', 'Last error'],
    ['correlation_id', 'Correlation'],
    ['published_channels', 'Channels'],
  ],
  deadLetter: [
    ['event_type', 'Event type'],
    ['aggregate_type', 'Aggregate'],
    ['retry_count', 'Retry'],
    ['dead_letter_at', 'Dead-letter at'],
    ['last_error', 'Last error'],
    ['correlation_id', 'Correlation'],
  ],
  notificationDelivery: [
    ['status', 'Status'],
    ['channel', 'Channel'],
    ['provider', 'Provider'],
    ['notification_id', 'Notification ID'],
    ['attempt_count', 'Attempt'],
    ['max_attempt_count', 'Max'],
    ['next_attempt_at', 'Next attempt'],
    ['last_attempt_at', 'Last attempt'],
    ['last_error', 'Last error'],
    ['sent_at', 'Sent'],
    ['delivered_at', 'Delivered'],
  ],
  socketPresence: [
    ['actor_type', 'Actor type'],
    ['actor_id', 'Actor ID'],
    ['socket_count', 'Sockets'],
    ['rooms', 'Rooms'],
    ['last_seen_at', 'Last seen'],
    ['expires_at', 'Expires'],
  ],
  idempotency: [
    ['status', 'Status'],
    ['key', 'Key'],
    ['actor_type', 'Actor'],
    ['route', 'Route'],
    ['method', 'Method'],
    ['status_code', 'Status code'],
    ['created_at', 'Created'],
    ['expires_at', 'Expires'],
    ['locked_at', 'Locked'],
    ['request_hash', 'Request hash'],
  ],
  qrTokens: [
    ['type', 'Type'],
    ['target_type', 'Target'],
    ['target_id', 'Target ID'],
    ['actor_type', 'Actor'],
    ['created_at', 'Created'],
    ['expires_at', 'Expires'],
    ['used_at', 'Used'],
    ['revoked_at', 'Revoked'],
    ['token_preview', 'Token'],
  ],
  fileScans: [
    ['scan_status', 'Scan'],
    ['file_name', 'File name'],
    ['entity_type', 'Entity'],
    ['entity_id', 'Entity ID'],
    ['uploaded_by', 'Uploaded by'],
    ['source', 'Source'],
    ['mime_type', 'Mime'],
    ['file_size', 'Size'],
    ['storage_provider', 'Provider'],
    ['created_at', 'Queued'],
  ],
};

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function formatDuration(ms) {
  const value = Number(ms || 0);
  if (!value) return '—';
  if (value < 1000) return `${value} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(1)} s`;
  return `${Math.round(value / 60000)} m`;
}

function readable(value) {
  return String(value || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function rowId(row) {
  if (!row || typeof row !== 'object') return '';
  return row.id || row._id || row.event_id || row.run_id || row.group_key || row.key || row.token || row.socket_id || row.room || row.job_name || row.check_name || row.scope || '';
}

function statusTone(value) {
  const text = String(value || '').toLowerCase();
  if (['critical', 'dead_letter', 'failed', 'infected', 'revoked'].includes(text)) return 'critical';
  if (['degraded', 'pending', 'processing', 'running', 'skipped', 'scheduled', 'on'].includes(text)) return 'warning';
  if (['healthy', 'success', 'published', 'delivered', 'sent', 'clean', 'completed', 'active', 'off'].includes(text)) return 'healthy';
  return 'neutral';
}

function valueForCell(row, field) {
  const value = row?.[field];
  if (field === 'duration_ms') return formatDuration(value);
  if (field === 'file_size') return value ? `${Math.round(Number(value) / 1024)} KB` : '—';
  if (field.endsWith('_at') || field === 'created_at' || field === 'updated_at') return formatDateTime(value);
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value ?? '—';
}

function StatusBadge({ value }) {
  return <span className={`ops-status ops-status--${statusTone(value)}`}>{readable(value)}</span>;
}

function ActionButton({ icon: Icon, label, onClick, disabled, tone = 'default' }) {
  return (
    <button type="button" className={`ops-action ops-action--${tone}`} onClick={onClick} disabled={disabled} title={label}>
      <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function IconButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button type="button" className="ops-icon-button" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}

function KpiCard({ label, value, tone = 'neutral', helper, icon: Icon = Gauge }) {
  return (
    <article className={`ops-kpi ops-kpi--${tone}`}>
      <span className="ops-kpi__icon"><Icon size={18} strokeWidth={2.25} aria-hidden="true" /></span>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function EmptyState({ title = 'Không có dữ liệu' }) {
  return (
    <div className="ops-empty">
      <CheckCircle2 size={22} strokeWidth={2.25} aria-hidden="true" />
      <span>{title}</span>
    </div>
  );
}

function JsonViewer({ value }) {
  return <pre className="ops-json">{JSON.stringify(value || {}, null, 2)}</pre>;
}

function DataTable({ rows = [], columns = [], selected, onSelect, actionSlot }) {
  const safeRows = rows.filter((row) => row && typeof row === 'object');
  if (!safeRows.length) return <EmptyState />;
  const template = `${columns.map(() => 'minmax(120px, 1fr)').join(' ')} 96px`;
  return (
    <div className="ops-table" style={{ '--ops-table-template': template, '--ops-table-min': `${(columns.length + 1) * 150}px` }}>
      <div className="ops-table__head">
        {columns.map(([, label]) => <span key={label}>{label}</span>)}
        <span>Actions</span>
      </div>
      {safeRows.map((row, index) => {
        const id = rowId(row);
        const isSelected = rowId(selected) === id;
        return (
          <button type="button" key={id || `${index}-${JSON.stringify(row).slice(0, 60)}`} className={`ops-table__row${isSelected ? ' is-selected' : ''}`} onClick={() => onSelect(row)}>
            {columns.map(([field]) => (
              <span key={field} title={String(valueForCell(row, field))}>
                {field === 'status' || field === 'scan_status' ? <StatusBadge value={row[field]} /> : valueForCell(row, field)}
              </span>
            ))}
            <span className="ops-table__actions">
              <IconButton icon={Eye} label="View detail" onClick={(event) => { event.stopPropagation(); onSelect(row); }} />
              {actionSlot?.(row)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DetailDrawer({ item, onClose }) {
  if (!item) return null;
  return (
    <aside className="ops-drawer">
      <div className="ops-drawer__head">
        <div>
          <small>Selected record</small>
          <strong>{rowId(item) || item.event_type || item.job_name || item.channel || 'Record'}</strong>
        </div>
        <IconButton icon={XCircle} label="Close" onClick={onClose} />
      </div>
      <div className="ops-drawer__quick">
        {item.status || item.scan_status ? <StatusBadge value={item.status || item.scan_status} /> : null}
        {item.correlation_id ? <span>{item.correlation_id}</span> : null}
        {item.event_type ? <span>{item.event_type}</span> : null}
      </div>
      {item.error_stack ? (
        <section className="ops-drawer__section">
          <h3>Error stack</h3>
          <pre className="ops-stack">{item.error_stack}</pre>
        </section>
      ) : null}
      {item.last_error || item.error_message ? (
        <section className="ops-drawer__section">
          <h3>Error</h3>
          <p>{item.last_error || item.error_message}</p>
        </section>
      ) : null}
      <section className="ops-drawer__section">
        <h3>Raw JSON</h3>
        <JsonViewer value={item} />
      </section>
    </aside>
  );
}

function OpsFilterBar({ filters, setFilters, search, setSearch, timeRange, setTimeRange }) {
  return (
    <section className="ops-filterbar">
      <label>
        <Search size={16} strokeWidth={2.25} aria-hidden="true" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="event_id, job_id, correlation_id, actor_id, qr token..." />
      </label>
      <select value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
        <option value="">Status</option>
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="failed">Failed</option>
        <option value="dead_letter">Dead-letter</option>
        <option value="success">Success</option>
        <option value="delivered">Delivered</option>
        <option value="clean">Clean</option>
        <option value="infected">Infected</option>
      </select>
      <select value={timeRange} onChange={(event) => setTimeRange(event.target.value)}>
        <option value="1h">1 giờ</option>
        <option value="24h">24 giờ</option>
        <option value="7d">7 ngày</option>
        <option value="all">Tất cả</option>
      </select>
      <button type="button" onClick={() => setFilters({})}>
        <ListFilter size={16} strokeWidth={2.25} aria-hidden="true" />
        <span>Clear</span>
      </button>
    </section>
  );
}

function timeRangeParams(value) {
  if (!value || value === 'all') return {};
  const hours = value === '1h' ? 1 : value === '24h' ? 24 : value === '7d' ? 24 * 7 : 0;
  if (!hours) return {};
  return { from: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString() };
}

function kpisForView(view, data) {
  const health = data?.health || data;
  const counters = health?.counters || {};
  const summary = data?.summary || data?.health?.counters || {};
  if (view === 'dashboard') {
    return [
      { label: 'Health score', value: health?.score ?? data?.health?.score ?? 0, tone: statusTone(health?.status || data?.health?.status), icon: Gauge },
      { label: 'Outbox failed', value: formatNumber(data?.event_outbox?.statuses?.failed), tone: 'critical', icon: Archive },
      { label: 'Dead-letter', value: formatNumber(data?.event_outbox?.statuses?.dead_letter), tone: 'critical', icon: ShieldAlert },
      { label: 'Delivery failed', value: formatNumber(data?.notification_delivery?.statuses?.failed), tone: 'warning', icon: BellRing },
      { label: 'Online actors', value: formatNumber(data?.realtime?.online_actors), tone: 'healthy', icon: RadioTower },
      { label: 'Failed jobs 24h', value: formatNumber(data?.jobs?.summary?.failed_jobs_24h), tone: 'warning', icon: FileClock },
    ];
  }
  if (view === 'workerHealth' || view === 'retryEvent') {
    return [
      { label: 'Outbox pending', value: formatNumber(counters.outbox?.pending), tone: 'warning', icon: Archive },
      { label: 'Outbox failed', value: formatNumber(counters.outbox?.failed), tone: 'critical', icon: AlertTriangle },
      { label: 'Dead-letter events', value: formatNumber(counters.outbox?.dead_letter), tone: 'critical', icon: ShieldAlert },
      { label: 'Notification pending', value: formatNumber(counters.notification_delivery?.pending), tone: 'warning', icon: BellRing },
      { label: 'Notification failed', value: formatNumber(counters.notification_delivery?.failed), tone: 'critical', icon: BellRing },
      { label: 'Worker mode', value: readable(health?.mode), tone: health?.mode === 'bullmq' ? 'healthy' : 'neutral', icon: Router },
    ];
  }
  if (view === 'jobs') {
    return [
      { label: 'Total jobs', value: formatNumber(data?.summary?.total_jobs), tone: 'neutral', icon: ServerCog },
      { label: 'Enabled jobs', value: formatNumber(data?.summary?.enabled_jobs), tone: 'healthy', icon: CheckCircle2 },
      { label: 'Failed 24h', value: formatNumber(data?.summary?.failed_jobs_24h), tone: 'critical', icon: AlertTriangle },
      { label: 'Queue mode', value: readable(data?.mode), tone: data?.mode === 'bullmq' ? 'healthy' : 'neutral', icon: Router },
    ];
  }
  if (['eventOutbox', 'deadLetter'].includes(view)) {
    const stats = summary?.statuses || data?.summary?.statuses || {};
    return ['pending', 'processing', 'published', 'failed', 'dead_letter'].map((key) => ({
      label: readable(key),
      value: formatNumber(stats[key]),
      tone: statusTone(key === 'published' ? 'healthy' : key),
      icon: key === 'dead_letter' ? ShieldAlert : Archive,
    }));
  }
  if (view === 'notificationDelivery') {
    const stats = summary?.statuses || {};
    return ['pending', 'sent', 'delivered', 'failed', 'skipped'].map((key) => ({
      label: readable(key),
      value: formatNumber(stats[key]),
      tone: statusTone(key),
      icon: BellRing,
    }));
  }
  if (view === 'notificationFailed') {
    return [
      { label: 'Failed deliveries', value: formatNumber(data?.summary?.total_failed), tone: 'critical', icon: BellRing },
      { label: 'Error groups', value: formatNumber(data?.summary?.total_groups), tone: 'warning', icon: AlertTriangle },
      { label: 'Email failed', value: formatNumber(data?.summary?.email_failed), tone: 'warning', icon: BellRing },
      { label: 'Push failed', value: formatNumber(data?.summary?.push_failed), tone: 'warning', icon: BellRing },
      { label: 'Socket failed', value: formatNumber(data?.summary?.socket_failed), tone: 'warning', icon: RadioTower },
    ];
  }
  if (view === 'realtime') {
    return [
      { label: 'Socket server', value: readable(data?.socket_status), tone: data?.socket_status === 'available' ? 'healthy' : 'critical', icon: Wifi },
      { label: 'Connected sockets', value: formatNumber(data?.connected_sockets), tone: 'healthy', icon: RadioTower },
      { label: 'Active rooms', value: formatNumber(data?.active_rooms), tone: 'neutral', icon: Database },
      { label: 'Online staff', value: formatNumber(data?.online_staff), tone: 'healthy', icon: Activity },
      { label: 'Redis adapter', value: readable(data?.redis_adapter_status), tone: data?.redis_adapter_status === 'configured' ? 'healthy' : 'neutral', icon: Router },
    ];
  }
  if (view === 'socketPresence') {
    return [
      { label: 'Online actors', value: formatNumber(data?.summary?.online_actors), tone: 'healthy', icon: RadioTower },
      { label: 'Online staff', value: formatNumber(data?.summary?.online_staff), tone: 'healthy', icon: Activity },
      { label: 'Online patients', value: formatNumber(data?.summary?.online_patients), tone: 'healthy', icon: Activity },
      { label: 'Total sockets', value: formatNumber(data?.summary?.total_sockets), tone: 'neutral', icon: Wifi },
      { label: 'Stale presence', value: formatNumber(data?.summary?.stale_presence), tone: 'warning', icon: Clock3 },
    ];
  }
  if (view === 'idempotency') {
    const stats = data?.summary?.statuses || {};
    return [
      { label: 'Processing', value: formatNumber(stats.processing), tone: 'warning', icon: Fingerprint },
      { label: 'Completed', value: formatNumber(stats.completed), tone: 'healthy', icon: CheckCircle2 },
      { label: 'Failed', value: formatNumber(stats.failed), tone: 'critical', icon: AlertTriangle },
      { label: 'Stuck', value: formatNumber(data?.summary?.stuck_processing), tone: 'critical', icon: LockKeyhole },
      { label: 'Expired soon', value: formatNumber(data?.summary?.expired_soon), tone: 'warning', icon: Clock3 },
    ];
  }
  if (view === 'qrTokens') {
    return [
      { label: 'Active tokens', value: formatNumber(data?.summary?.active), tone: 'healthy', icon: ScanLine },
      { label: 'Expired tokens', value: formatNumber(data?.summary?.expired), tone: 'warning', icon: Clock3 },
      { label: 'Used tokens', value: formatNumber(data?.summary?.used), tone: 'neutral', icon: CheckCircle2 },
      { label: 'Revoked tokens', value: formatNumber(data?.summary?.revoked), tone: 'critical', icon: ShieldAlert },
      { label: 'Verify 15m', value: formatNumber(data?.summary?.verify_requests_last_15m), tone: 'neutral', icon: Eye },
    ];
  }
  if (view === 'fileScans') {
    const stats = data?.summary?.statuses || {};
    return [
      { label: 'Pending scan', value: formatNumber(stats.pending), tone: 'warning', icon: HardDrive },
      { label: 'Clean', value: formatNumber(stats.clean), tone: 'healthy', icon: CheckCircle2 },
      { label: 'Infected', value: formatNumber(stats.infected), tone: 'critical', icon: ShieldAlert },
      { label: 'Failed', value: formatNumber(stats.failed), tone: 'critical', icon: AlertTriangle },
      { label: 'Skipped', value: formatNumber(stats.skipped), tone: 'warning', icon: Eye },
      { label: 'Provider', value: readable(data?.summary?.provider_health?.provider), tone: data?.summary?.provider_health?.manual_mode ? 'warning' : 'healthy', icon: ScanLine },
    ];
  }
  if (view === 'diagnostics') {
    const runs = data?.last_runs || data?.items || [];
    return [
      { label: 'Checks', value: formatNumber(data?.checks?.length), tone: 'neutral', icon: TerminalSquare },
      { label: 'Last runs', value: formatNumber(runs.length), tone: 'neutral', icon: FileClock },
      { label: 'Critical findings', value: formatNumber(runs[0]?.critical_count), tone: 'critical', icon: ShieldAlert },
      { label: 'Warnings', value: formatNumber(runs[0]?.warning_count), tone: 'warning', icon: AlertTriangle },
    ];
  }
  if (view === 'maintenance') {
    return [
      { label: 'Maintenance', value: readable(data?.status || 'off'), tone: data?.status === 'on' ? 'warning' : 'healthy', icon: SlidersHorizontal },
      { label: 'Active windows', value: formatNumber(data?.active?.length), tone: data?.active?.length ? 'warning' : 'healthy', icon: Clock3 },
      { label: 'Recent windows', value: formatNumber(data?.recent?.length), tone: 'neutral', icon: FileClock },
    ];
  }
  return [];
}

function rowsForView(view, data) {
  let rows;
  if (view === 'jobs') rows = data?.registry;
  else if (view === 'notificationFailed') rows = data?.items;
  else if (view === 'realtime') rows = data?.rooms;
  else if (view === 'diagnostics') rows = data?.last_runs;
  else if (view === 'maintenance') rows = data?.active?.length ? data.active : data?.recent;
  else rows = data?.items || data?.recent_job_runs;
  return Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
}

function columnsForView(view) {
  if (view === 'jobs') return [
    ['job_name', 'Job name'],
    ['domain', 'Domain'],
    ['queue_name', 'Queue'],
    ['schedule', 'Schedule'],
    ['enabled', 'Enabled'],
    ['success_rate', 'Success rate'],
    ['avg_duration_ms', 'Avg duration'],
    ['failed_runs', 'Failed'],
  ];
  if (view === 'notificationFailed') return [
    ['channel', 'Channel'],
    ['provider', 'Provider'],
    ['last_error', 'Error'],
    ['count', 'Count'],
    ['affected_notifications', 'Affected'],
    ['first_seen_at', 'First seen'],
    ['last_seen_at', 'Last seen'],
    ['suggested_fix', 'Suggested fix'],
  ];
  if (view === 'realtime') return [
    ['room', 'Room'],
    ['type', 'Type'],
    ['socket_count', 'Sockets'],
    ['last_activity_at', 'Last activity'],
  ];
  if (view === 'diagnostics') return [
    ['status', 'Status'],
    ['run_id', 'Run ID'],
    ['check_name', 'Check'],
    ['started_at', 'Started'],
    ['duration_ms', 'Duration'],
    ['findings_count', 'Findings'],
    ['critical_count', 'Critical'],
    ['warning_count', 'Warnings'],
  ];
  if (view === 'maintenance') return [
    ['status', 'Status'],
    ['scope', 'Scope'],
    ['message', 'Message'],
    ['starts_at', 'Starts'],
    ['ends_at', 'Ends'],
    ['allow_admin_bypass', 'Admin bypass'],
    ['allow_webhooks', 'Webhooks'],
  ];
  return TABLE_COLUMNS[view] || TABLE_COLUMNS.jobRuns;
}

export function OperationsCenterPage({ view = 'dashboard' }) {
  const config = OPS_VIEWS.find((item) => item.key === view) || OPS_VIEWS[0];
  const Icon = config.icon;
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryForm, setRetryForm] = useState({ event_id: '', reason: '', mode: 'retry_original', dispatch_now: true });
  const [retryPreview, setRetryPreview] = useState(null);
  const [diagnosticCheck, setDiagnosticCheck] = useState('all');
  const [maintenanceForm, setMaintenanceForm] = useState({
    scope: 'global',
    message: 'Hệ thống đang bảo trì. Vui lòng quay lại sau.',
    allow_admin_bypass: true,
    allow_webhooks: true,
    allow_health_check: true,
    allow_emergency: true,
  });
  const [realtimeForm, setRealtimeForm] = useState({
    event_name: 'operations.test_emit',
    scope_json: '{\n  "rooms": ["system:admin"]\n}',
    payload_json: '{\n  "message": "Operations Center test"\n}',
    dry_run: true,
  });

  const requestParams = useMemo(() => ({
    ...filters,
    ...(view === 'dashboard' || view === 'workerHealth' || view === 'retryEvent' || view === 'diagnostics' || view === 'maintenance' ? {} : timeRangeParams(timeRange)),
    search,
    limit: 50,
  }), [filters, search, timeRange, view]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await opsGet(config.endpoint, requestParams);
      setData(payload);
      setSelected(null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, requestParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, load]);

  async function runAction(action, row = selected) {
    if (!row && !['diagnostics.run', 'maintenance.start', 'realtime.test'].includes(action)) return;
    setActionLoading(true);
    setError('');
    try {
      const id = rowId(row);
      if (action === 'copy') await navigator.clipboard?.writeText(String(id || ''));
      if (action === 'job.run') await opsPost(`/jobs/${encodeURIComponent(row.job_name)}/run-now`, { reason: 'Run from Operations Center' });
      if (action === 'job.retry') await opsPost(`/job-runs/${encodeURIComponent(id)}/retry`, { reason: 'Retry from Operations Center' });
      if (action === 'event.retry') await opsPost(`/event-outbox/${encodeURIComponent(id)}/retry`, { reason: 'Retry from Operations Center', dispatch_now: true });
      if (action === 'event.replay') await opsPost(`/event-outbox/${encodeURIComponent(id)}/replay`, { reason: 'Replay from Operations Center', dispatch_now: false });
      if (action === 'event.unlock') await opsPost(`/event-outbox/${encodeURIComponent(id)}/unlock`, { reason: 'Unlock from Operations Center' });
      if (action === 'delivery.retry') await opsPost(`/notification-deliveries/${encodeURIComponent(id)}/retry`, { reason: 'Retry from Operations Center', dispatch_now: true });
      if (action === 'delivery.skip') await opsPost(`/notification-deliveries/${encodeURIComponent(id)}/mark-skipped`, { reason: 'Skipped from Operations Center' });
      if (action === 'failure.retry') await opsPost(`/notification-failures/groups/${encodeURIComponent(row.group_key)}/retry`, { reason: 'Retry failure group from Operations Center' });
      if (action === 'socket.disconnect') await opsPost(`/socket-presence/${encodeURIComponent(row.socket_ids?.[0] || row.socket_id || id)}/disconnect`, { reason: 'Disconnected from Operations Center' });
      if (action === 'idempotency.unlock') await opsPost(`/idempotency-records/${encodeURIComponent(id)}/unlock`, { reason: 'Unlock from Operations Center' });
      if (action === 'idempotency.expire') await opsPost(`/idempotency-records/${encodeURIComponent(id)}/expire`, { reason: 'Expire from Operations Center' });
      if (action === 'qr.revoke') await opsPost(`/qr-tokens/${encodeURIComponent(id)}/revoke`, { reason: 'Revoked from Operations Center' });
      if (action === 'file.rescan') await opsPost('/file-scans/bulk-rescan', { attachment_ids: [id], reason: 'Rescan from Operations Center' });
      if (action === 'file.quarantine') await opsPost('/file-scans/bulk-quarantine', { attachment_ids: [id], reason: 'Quarantine from Operations Center' });
      if (action === 'diagnostics.run') {
        const result = await opsPost('/diagnostics/run', { check_name: diagnosticCheck });
        setSelected(result.runs?.[0] || null);
      }
      if (action === 'maintenance.start') await opsPost('/maintenance/start', maintenanceForm);
      if (action === 'maintenance.end') await opsPost(`/maintenance/${encodeURIComponent(id)}/end`, { reason: 'Ended from Operations Center' });
      if (action === 'realtime.test') {
        const scope = JSON.parse(realtimeForm.scope_json || '{}');
        const payload = JSON.parse(realtimeForm.payload_json || '{}');
        const result = await opsPost('/realtime/test-emit', {
          event_name: realtimeForm.event_name,
          scope,
          payload,
          dry_run: realtimeForm.dry_run,
        });
        setSelected(result);
      }
      if (action !== 'copy' && !['diagnostics.run', 'realtime.test'].includes(action)) await load();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function previewRetryEvent() {
    setActionLoading(true);
    setError('');
    try {
      const preview = await opsPost('/events/retry-preview', retryForm);
      setRetryPreview(preview);
      setSelected(preview.event);
    } catch (previewError) {
      setError(previewError.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function executeRetryConsole() {
    setActionLoading(true);
    setError('');
    try {
      const path = retryForm.mode === 'replay_new' ? '/events/replay' : '/events/retry';
      const result = await opsPost(path, retryForm);
      setSelected(result.event || result.replayed_event || result);
      setRetryPreview(result);
      await load();
    } catch (retryError) {
      setError(retryError.message);
    } finally {
      setActionLoading(false);
    }
  }

  const kpis = kpisForView(view, data || {});
  const rows = rowsForView(view, data || {});
  const columns = columnsForView(view);

  function actionSlot(row) {
    if (view === 'jobs') return <IconButton icon={PlayCircle} label="Run now" onClick={(event) => { event.stopPropagation(); runAction('job.run', row); }} disabled={actionLoading} />;
    if (view === 'jobRuns') return <IconButton icon={RefreshCw} label="Retry job" onClick={(event) => { event.stopPropagation(); runAction('job.retry', row); }} disabled={actionLoading} />;
    if (['eventOutbox', 'deadLetter'].includes(view)) return <IconButton icon={RefreshCw} label="Retry event" onClick={(event) => { event.stopPropagation(); runAction('event.retry', row); }} disabled={actionLoading} />;
    if (view === 'notificationDelivery') return <IconButton icon={RefreshCw} label="Retry delivery" onClick={(event) => { event.stopPropagation(); runAction('delivery.retry', row); }} disabled={actionLoading} />;
    if (view === 'notificationFailed') return <IconButton icon={RefreshCw} label="Retry group" onClick={(event) => { event.stopPropagation(); runAction('failure.retry', row); }} disabled={actionLoading} />;
    if (view === 'idempotency') return <IconButton icon={LockKeyhole} label="Unlock" onClick={(event) => { event.stopPropagation(); runAction('idempotency.unlock', row); }} disabled={actionLoading} />;
    if (view === 'qrTokens') return <IconButton icon={ShieldAlert} label="Revoke" onClick={(event) => { event.stopPropagation(); runAction('qr.revoke', row); }} disabled={actionLoading} />;
    if (view === 'fileScans') return <IconButton icon={ScanLine} label="Rescan" onClick={(event) => { event.stopPropagation(); runAction('file.rescan', row); }} disabled={actionLoading} />;
    if (view === 'maintenance' && row.status === 'active') return <IconButton icon={XCircle} label="End maintenance" onClick={(event) => { event.stopPropagation(); runAction('maintenance.end', row); }} disabled={actionLoading} />;
    return null;
  }

  function renderDashboard() {
    const health = data?.health || {};
    return (
      <>
        <section className="ops-health-hero">
          <div>
            <small>Overall system state</small>
            <strong>{readable(health.status)}</strong>
            <span>Score {health.score || 0}/100 • {readable(health.mode)}</span>
          </div>
          <div className="ops-health-ring">
            <strong>{health.score || 0}</strong>
            <span>health</span>
          </div>
        </section>
        <section className="ops-grid ops-grid--two">
          <div className="ops-panel">
            <PanelTitle icon={Activity} title="Component matrix" meta={`${health.components?.length || 0} components`} />
            <ComponentMatrix items={health.components || []} onSelect={setSelected} />
          </div>
          <div className="ops-panel">
            <PanelTitle icon={Archive} title="Event type heatmap" meta={`${data?.event_outbox?.event_types?.length || 0} groups`} />
            <Heatmap items={data?.event_outbox?.event_types || []} />
          </div>
        </section>
        <section className="ops-panel">
          <PanelTitle icon={FileClock} title="Recent job runs" meta={`${health.recent_job_runs?.length || 0} rows`} />
          <DataTable rows={health.recent_job_runs || []} columns={TABLE_COLUMNS.jobRuns.slice(0, 8)} selected={selected} onSelect={setSelected} actionSlot={actionSlot} />
        </section>
      </>
    );
  }

  function renderWorkerHealth() {
    return (
      <section className="ops-grid ops-grid--two">
        <div className="ops-panel">
          <PanelTitle icon={Activity} title="Health component matrix" meta={readable(data?.status)} />
          <ComponentMatrix items={data?.components || []} onSelect={setSelected} />
        </div>
        <div className="ops-panel">
          <PanelTitle icon={FileClock} title="Recent job run panel" meta={`${data?.recent_job_runs?.length || 0} rows`} />
          <DataTable rows={data?.recent_job_runs || []} columns={TABLE_COLUMNS.jobRuns.slice(0, 8)} selected={selected} onSelect={setSelected} actionSlot={actionSlot} />
        </div>
      </section>
    );
  }

  function renderJobs() {
    return (
      <>
        <section className="ops-panel">
          <PanelTitle icon={ServerCog} title="Job registry" meta={`${data?.registry?.length || 0} jobs`} />
          <DataTable rows={data?.registry || []} columns={columns} selected={selected} onSelect={setSelected} actionSlot={actionSlot} />
        </section>
        <section className="ops-grid ops-grid--three">
          {(data?.queues || []).map((queue) => (
            <article key={queue.queue_name} className={`ops-queue-card ops-queue-card--${statusTone(queue.status)}`}>
              <div>
                <StatusBadge value={queue.status} />
                <strong>{queue.queue_name}</strong>
                <span>{readable(queue.mode)}</span>
              </div>
              <dl>
                <div><dt>Waiting</dt><dd>{formatNumber(queue.waiting)}</dd></div>
                <div><dt>Active</dt><dd>{formatNumber(queue.active)}</dd></div>
                <div><dt>Failed</dt><dd>{formatNumber(queue.failed)}</dd></div>
              </dl>
            </article>
          ))}
        </section>
      </>
    );
  }

  function renderRetryConsole() {
    return (
      <section className="ops-console-layout">
        <form className="ops-panel ops-form" onSubmit={(event) => { event.preventDefault(); previewRetryEvent(); }}>
          <PanelTitle icon={RefreshCw} title="Retry console" meta="Pre-check required" />
          <label><span>Event ID</span><input value={retryForm.event_id} onChange={(event) => setRetryForm((current) => ({ ...current, event_id: event.target.value }))} /></label>
          <label><span>Retry mode</span><select value={retryForm.mode} onChange={(event) => setRetryForm((current) => ({ ...current, mode: event.target.value }))}>
            <option value="retry_original">Retry original event</option>
            <option value="replay_new">Replay as new event</option>
            <option value="dry_run">Dry-run dispatch</option>
          </select></label>
          <label><span>Reason</span><textarea value={retryForm.reason} onChange={(event) => setRetryForm((current) => ({ ...current, reason: event.target.value }))} /></label>
          <label className="ops-checkbox"><input type="checkbox" checked={retryForm.dispatch_now} onChange={(event) => setRetryForm((current) => ({ ...current, dispatch_now: event.target.checked }))} /><span>Dispatch now</span></label>
          <div className="ops-form__actions">
            <ActionButton icon={Eye} label="Preview" onClick={previewRetryEvent} disabled={actionLoading || !retryForm.event_id} />
            <ActionButton icon={Send} label={retryForm.mode === 'replay_new' ? 'Replay event' : 'Retry event'} tone="primary" onClick={executeRetryConsole} disabled={actionLoading || !retryPreview} />
          </div>
        </form>
        <div className="ops-panel">
          <PanelTitle icon={ShieldAlert} title="Pre-check panel" meta={retryPreview?.precheck?.side_effect_risk || 'waiting'} />
          {retryPreview ? <JsonViewer value={retryPreview} /> : <EmptyState title="Nhập Event ID để xem pre-check" />}
        </div>
      </section>
    );
  }

  function renderRealtime() {
    return (
      <>
        <section className="ops-console-layout">
          <form className="ops-panel ops-form" onSubmit={(event) => { event.preventDefault(); runAction('realtime.test'); }}>
            <PanelTitle icon={RadioTower} title="Realtime test console" meta={realtimeForm.dry_run ? 'dry-run' : 'emit'} />
            <label><span>Event name</span><input value={realtimeForm.event_name} onChange={(event) => setRealtimeForm((current) => ({ ...current, event_name: event.target.value }))} /></label>
            <label><span>Scope JSON</span><textarea value={realtimeForm.scope_json} onChange={(event) => setRealtimeForm((current) => ({ ...current, scope_json: event.target.value }))} /></label>
            <label><span>Payload JSON</span><textarea value={realtimeForm.payload_json} onChange={(event) => setRealtimeForm((current) => ({ ...current, payload_json: event.target.value }))} /></label>
            <label className="ops-checkbox"><input type="checkbox" checked={realtimeForm.dry_run} onChange={(event) => setRealtimeForm((current) => ({ ...current, dry_run: event.target.checked }))} /><span>Dry-run room resolution</span></label>
            <ActionButton icon={Send} label="Resolve / send" tone="primary" onClick={() => runAction('realtime.test')} disabled={actionLoading} />
          </form>
          <div className="ops-panel">
            <PanelTitle icon={RadioTower} title="Room monitor" meta={`${data?.rooms?.length || 0} rooms`} />
            <DataTable rows={data?.rooms || []} columns={columns} selected={selected} onSelect={setSelected} />
          </div>
        </section>
        <section className="ops-panel">
          <PanelTitle icon={Activity} title="Realtime event monitor" meta={`${data?.events_recent?.length || 0} events`} />
          <DataTable rows={data?.events_recent || []} columns={TABLE_COLUMNS.eventOutbox.slice(0, 7)} selected={selected} onSelect={setSelected} />
        </section>
      </>
    );
  }

  function renderDiagnostics() {
    return (
      <>
        <section className="ops-diagnostic-runner">
          <div>
            <strong>Check runner</strong>
            <span>{data?.checks?.length || 0} diagnostic checks registered</span>
          </div>
          <select value={diagnosticCheck} onChange={(event) => setDiagnosticCheck(event.target.value)}>
            <option value="all">Run all</option>
            {(data?.checks || []).map((check) => <option key={check.check_name} value={check.check_name}>{readable(check.check_name)}</option>)}
          </select>
          <ActionButton icon={PlayCircle} label="Run check" tone="primary" onClick={() => runAction('diagnostics.run')} disabled={actionLoading} />
        </section>
        <section className="ops-grid ops-grid--three">
          {(data?.checks || []).map((check) => (
            <article key={check.check_name} className="ops-check-card">
              <TerminalSquare size={18} strokeWidth={2.25} aria-hidden="true" />
              <strong>{readable(check.check_name)}</strong>
              <span>{check.component}</span>
              <small>{readable(check.severity_when_failed)}</small>
            </article>
          ))}
        </section>
        <section className="ops-panel">
          <PanelTitle icon={FileClock} title="Diagnostic runs" meta={`${data?.last_runs?.length || 0} runs`} />
          <DataTable rows={data?.last_runs || []} columns={columns} selected={selected} onSelect={setSelected} />
        </section>
      </>
    );
  }

  function renderMaintenance() {
    return (
      <section className="ops-console-layout">
        <form className="ops-panel ops-form" onSubmit={(event) => { event.preventDefault(); runAction('maintenance.start'); }}>
          <PanelTitle icon={SlidersHorizontal} title="Rule builder" meta={readable(data?.status || 'off')} />
          <label><span>Scope</span><select value={maintenanceForm.scope} onChange={(event) => setMaintenanceForm((current) => ({ ...current, scope: event.target.value }))}>
            {['global', 'patient_portal', 'billing', 'clinical', 'pharmacy', 'scheduling', 'admin', 'realtime', 'payment_provider', 'file_upload'].map((scope) => <option key={scope} value={scope}>{readable(scope)}</option>)}
          </select></label>
          <label><span>Message</span><textarea value={maintenanceForm.message} onChange={(event) => setMaintenanceForm((current) => ({ ...current, message: event.target.value }))} /></label>
          <label><span>Expected end</span><input type="datetime-local" onChange={(event) => setMaintenanceForm((current) => ({ ...current, ends_at: event.target.value ? new Date(event.target.value).toISOString() : undefined }))} /></label>
          <label className="ops-checkbox"><input type="checkbox" checked={maintenanceForm.allow_admin_bypass} onChange={(event) => setMaintenanceForm((current) => ({ ...current, allow_admin_bypass: event.target.checked }))} /><span>Allow admin bypass</span></label>
          <label className="ops-checkbox"><input type="checkbox" checked={maintenanceForm.allow_webhooks} onChange={(event) => setMaintenanceForm((current) => ({ ...current, allow_webhooks: event.target.checked }))} /><span>Allow webhook bypass</span></label>
          <label className="ops-checkbox"><input type="checkbox" checked={maintenanceForm.allow_emergency} onChange={(event) => setMaintenanceForm((current) => ({ ...current, allow_emergency: event.target.checked }))} /><span>Allow emergency bypass</span></label>
          <ActionButton icon={PlayCircle} label="Start maintenance" tone="primary" onClick={() => runAction('maintenance.start')} disabled={actionLoading} />
        </form>
        <div className="ops-panel">
          <PanelTitle icon={Clock3} title="Active maintenance table" meta={`${data?.active?.length || 0} active`} />
          <DataTable rows={rows} columns={columns} selected={selected} onSelect={setSelected} actionSlot={actionSlot} />
        </div>
      </section>
    );
  }

  function renderGeneric() {
    if (view === 'dashboard') return renderDashboard();
    if (view === 'workerHealth') return renderWorkerHealth();
    if (view === 'jobs') return renderJobs();
    if (view === 'retryEvent') return renderRetryConsole();
    if (view === 'realtime') return renderRealtime();
    if (view === 'diagnostics') return renderDiagnostics();
    if (view === 'maintenance') return renderMaintenance();
    return (
      <section className="ops-panel">
        <PanelTitle icon={config.icon} title={config.title} meta={`${rows.length} rows`} />
        <DataTable rows={rows} columns={columns} selected={selected} onSelect={setSelected} actionSlot={actionSlot} />
      </section>
    );
  }

  return (
    <div className="ops-shell">
      <header className="ops-header">
        <div className="ops-header__title">
          <span><Icon size={22} strokeWidth={2.35} aria-hidden="true" /></span>
          <div>
            <small>Quản trị hệ thống / Operations Center</small>
            <h1>{config.title}</h1>
          </div>
          <StatusBadge value={data?.health?.status || data?.status || data?.socket_status || 'unknown'} />
        </div>
        <div className="ops-header__meta">
          <span>Env {data?.health?.environment || data?.environment || 'local'}</span>
          <span>Checked {formatDateTime(data?.checked_at || data?.health?.checked_at)}</span>
          {error ? <strong><XCircle size={16} strokeWidth={2.25} />{error}</strong> : null}
        </div>
        <div className="ops-header__actions">
          <label className="ops-autorefresh"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /><span>Auto refresh</span></label>
          <ActionButton icon={RefreshCw} label="Refresh" onClick={load} disabled={loading || actionLoading} />
        </div>
      </header>

      <nav className="ops-nav" aria-label="Operations screens">
        {OPS_VIEWS.map((item) => {
          const NavIcon = item.icon;
          return (
            <Link key={item.key} to={item.path} className={item.key === view ? 'is-active' : ''}>
              <NavIcon size={15} strokeWidth={2.3} aria-hidden="true" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <OpsFilterBar filters={filters} setFilters={setFilters} search={search} setSearch={setSearch} timeRange={timeRange} setTimeRange={setTimeRange} />

      <section className="ops-kpi-strip">
        {kpis.map((item) => <KpiCard key={`${item.label}-${item.value}`} {...item} />)}
      </section>

      {loading && !data ? (
        <div className="ops-loading"><RefreshCw size={22} strokeWidth={2.25} aria-hidden="true" />Đang tải Operations Center</div>
      ) : renderGeneric()}

      {selected ? (
        <div className="ops-command-bar">
          <ActionButton icon={Clipboard} label="Copy ID" onClick={() => runAction('copy')} />
          {['eventOutbox', 'deadLetter'].includes(view) ? <ActionButton icon={RefreshCw} label="Retry" tone="primary" onClick={() => runAction('event.retry')} disabled={actionLoading} /> : null}
          {['eventOutbox', 'deadLetter'].includes(view) ? <ActionButton icon={Archive} label="Replay" onClick={() => runAction('event.replay')} disabled={actionLoading} /> : null}
          {view === 'notificationDelivery' ? <ActionButton icon={RefreshCw} label="Retry delivery" tone="primary" onClick={() => runAction('delivery.retry')} disabled={actionLoading} /> : null}
          {view === 'idempotency' ? <ActionButton icon={LockKeyhole} label="Unlock" tone="primary" onClick={() => runAction('idempotency.unlock')} disabled={actionLoading} /> : null}
          {view === 'fileScans' ? <ActionButton icon={ScanLine} label="Rescan" tone="primary" onClick={() => runAction('file.rescan')} disabled={actionLoading} /> : null}
          {view === 'qrTokens' ? <ActionButton icon={ShieldAlert} label="Revoke" tone="danger" onClick={() => runAction('qr.revoke')} disabled={actionLoading} /> : null}
        </div>
      ) : null}

      <DetailDrawer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function PanelTitle({ icon: Icon, title, meta }) {
  return (
    <div className="ops-panel__title">
      <div>
        {Icon ? <Icon size={18} strokeWidth={2.25} aria-hidden="true" /> : null}
        <h2>{title}</h2>
      </div>
      <span>{meta}</span>
    </div>
  );
}

function ComponentMatrix({ items = [], onSelect }) {
  if (!items.length) return <EmptyState />;
  return (
    <div className="ops-component-list">
      {items.map((item) => (
        <button type="button" key={item.key} className={`ops-component ops-component--${statusTone(item.status)}`} onClick={() => onSelect(item)}>
          <StatusBadge value={item.status} />
          <strong>{item.name}</strong>
          <span>{item.signal}</span>
          <small>{readable(item.action)}</small>
        </button>
      ))}
    </div>
  );
}

function Heatmap({ items = [] }) {
  if (!items.length) return <EmptyState />;
  const max = Math.max(...items.map((item) => Number(item.count || 0)), 1);
  return (
    <div className="ops-heatmap">
      {items.slice(0, 18).map((item) => (
        <button type="button" key={`${item._id?.event_type}-${item._id?.status}`} style={{ '--heat': Math.max(Number(item.count || 0) / max, 0.12) }}>
          <strong>{item._id?.event_type || 'unknown'}</strong>
          <span>{readable(item._id?.status)} • {formatNumber(item.count)}</span>
        </button>
      ))}
    </div>
  );
}
