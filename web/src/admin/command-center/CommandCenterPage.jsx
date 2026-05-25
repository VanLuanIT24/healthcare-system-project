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
import { AdminActionConfirmDialog } from '../components/AdminActionConfirmDialog';
import { commandCenterGet, commandCenterPost } from './commandCenterApi';

const VIEW_CONFIG = {
  dashboard: {
    title: 'Bảng điều khiển quản trị',
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
    title: 'Phiên đăng nhập thời gian thực',
    endpoint: '/sessions',
    icon: RadioTower,
  },
  workers: {
    title: 'Tình trạng worker / hàng đợi',
    endpoint: '/workers',
    icon: ServerCog,
  },
  realtime: {
    title: 'Tình trạng thời gian thực',
    endpoint: '/realtime',
    icon: Wifi,
  },
  workspaceMap: {
    title: 'Bản đồ workspace',
    endpoint: '/workspace-map',
    icon: Map,
  },
};

const UI_LABELS = {
  healthy: 'Ổn định',
  degraded: 'Suy giảm',
  critical: 'Nghiêm trọng',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
  info: 'Thông tin',
  available: 'Khả dụng',
  unavailable: 'Không khả dụng',
  unknown: 'Không rõ',
  new: 'Mới',
  open: 'Đang mở',
  acknowledged: 'Đã ghi nhận',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
  pending: 'Chờ xử lý',
  failed: 'Lỗi',
  success: 'Thành công',
  total: 'Tổng',
  overdue: 'Quá hạn',
  assigned_to_me: 'Gán cho tôi',
  risk_score: 'Điểm rủi ro',
  job_run_logs: 'Nhật ký chạy tác vụ',
  event_outbox: 'Outbox sự kiện',
  notification_delivery: 'Gửi thông báo',
  idempotency_records: 'Bản ghi idempotency',
  qr_tokens: 'QR token',
  file_scans: 'Quét tệp',
  job_name: 'Tên tác vụ',
  queue_name: 'Hàng đợi',
  status: 'Trạng thái',
  started_at: 'Bắt đầu',
  finished_at: 'Kết thúc',
  duration_ms: 'Thời lượng',
  records_processed: 'Bản ghi',
  error_message: 'Lỗi',
  event_type: 'Loại sự kiện',
  aggregate_type: 'Aggregate',
  retry_count: 'Số lần thử lại',
  next_retry_at: 'Lần thử tiếp theo',
  last_error: 'Lỗi gần nhất',
  created_at: 'Tạo lúc',
  channel: 'Kênh',
  provider: 'Nhà cung cấp',
  attempt_count: 'Lần thử',
  method: 'Method',
  route: 'Route',
  status_code: 'Mã trạng thái',
  expires_at: 'Hết hạn',
  type: 'Loại',
  target_type: 'Đối tượng',
  used_at: 'Dùng lúc',
  revoked_at: 'Thu hồi lúc',
  file_name: 'Tên tệp',
  scan_status: 'Trạng thái quét',
  review_status: 'Trạng thái duyệt',
  source: 'Nguồn',
  room: 'Room',
  connected_sockets: 'Socket kết nối',
  last_activity_at: 'Hoạt động gần nhất',
  allowed_actor_types: 'Loại actor được phép',
  actor_type: 'Loại actor',
  actor_id: 'Actor ID',
  socket_count: 'Số socket',
  last_seen_at: 'Thấy lần cuối',
  rooms: 'Rooms',
  workers: 'Worker',
  events: 'Sự kiện',
  notifications: 'Thông báo',
  security: 'Bảo mật',
  billing: 'Viện phí',
  records: 'Hồ sơ',
};

const TEXT_LABELS = {
  'Worker / Queue': 'Worker / hàng đợi',
  'Event Outbox': 'Outbox sự kiện',
  'Notification Delivery': 'Gửi thông báo',
  'Payment webhook': 'Webhook thanh toán',
  'File scan': 'Quét tệp',
  'Security monitor': 'Giám sát bảo mật',
  'Failed Jobs 24h': 'Tác vụ lỗi 24h',
  'Failed Notifications 24h': 'Thông báo lỗi 24h',
  'Outbox Failed 24h': 'Outbox lỗi 24h',
  'Api Error Audit 24h': 'Audit lỗi API 24h',
  'Security Alert Count': 'Số cảnh báo bảo mật',
  'API Health': 'Sức khỏe API',
  'Database Health': 'Sức khỏe cơ sở dữ liệu',
  'Worker Health': 'Sức khỏe worker',
  'Notification Failed': 'Thông báo lỗi',
  'Dead-letter Events': 'Sự kiện dead-letter',
  'Security Risk': 'Rủi ro bảo mật',
  'Active Staff Sessions': 'Phiên nhân sự đang hoạt động',
  'Pending Admin Tasks': 'Việc quản trị chờ xử lý',
  'Locked Staff': 'Nhân sự bị khóa',
  'Appointments Today': 'Lịch hẹn hôm nay',
  'Unpaid Invoices': 'Hóa đơn chưa thanh toán',
  'Revenue Today': 'Doanh thu hôm nay',
  'Failed': 'Lỗi',
  'Pending': 'Chờ xử lý',
  'Latency': 'Độ trễ',
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
  const raw = String(value || '');
  const normalized = raw.toLowerCase();
  return UI_LABELS[normalized] || TEXT_LABELS[raw] || raw.replace(/_/g, ' ');
}

function statusLabel(status) {
  return readableLabel(status || 'unknown');
}

function actionTargetLabel(item = {}) {
  return item.title
    || item.full_name
    || item.device_name
    || item.event_type
    || item.job_name
    || item.id
    || item.session_id
    || item.source_id
    || 'Bản ghi đã chọn';
}

function getCommandActionCopy(action, item = {}, view = '') {
  const copies = {
    retry_event: ['Thử lại sự kiện?', 'Sự kiện sẽ được đưa vào luồng xử lý lại. Chỉ nên thực hiện khi đã kiểm tra nguyên nhân lỗi.', 'Thử lại sự kiện', 'warning', false],
    retry_notification: ['Thử gửi lại thông báo?', 'Thông báo sẽ được đưa vào hàng đợi gửi lại với trạng thái hiện tại.', 'Thử gửi lại', 'warning', false],
    revoke_session: ['Thu hồi phiên đăng nhập?', 'Phiên người dùng sẽ bị đăng xuất ngay và thao tác được ghi audit.', 'Thu hồi phiên', 'danger', true],
    ack_work_item: ['Ghi nhận việc cần xử lý?', 'Việc này sẽ được đánh dấu đã ghi nhận bởi quản trị viên.', 'Ghi nhận', 'success', false],
    resolve_alert: ['Xử lý cảnh báo?', 'Cảnh báo sẽ được chuyển khỏi hàng đợi đang mở sau khi xác nhận.', 'Xác nhận xử lý', 'success', false],
    test_realtime: ['Gửi broadcast thử?', 'Hệ thống sẽ gửi một sự kiện thử nghiệm đến phiên hiện tại của bạn.', 'Gửi thử', 'warning', false],
  };
  const copy = copies[action];
  if (!copy) return null;
  const [title, description, confirmLabel, tone, reasonRequired] = copy;
  return {
    title,
    description,
    confirmLabel,
    tone,
    reasonRequired,
    details: [
      { label: 'Khu vực', value: VIEW_CONFIG[view]?.title || 'Command Center' },
      { label: 'Đối tượng', value: actionTargetLabel(item) },
      { label: 'ID', value: item.session_id || item.source_id || item.id || item._id || '-' },
    ],
  };
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
      <span>{readableLabel(item.label)}</span>
      <strong>{compactValue(item)}</strong>
      <small>{readableLabel(item.helper)}</small>
    </Link>
  );
}

function CriticalStrip({ alerts = [], onAction }) {
  return (
    <section className="cc-critical-strip">
      <SectionHeader icon={AlertTriangle} title="Dải cảnh báo nghiêm trọng" meta={`${alerts.length} tín hiệu ưu tiên`} />
      {alerts.length ? (
        <div className="cc-alert-ribbon">
          {alerts.slice(0, 8).map((alert) => (
            <button key={alert.id} type="button" className={`cc-alert-pill cc-alert-pill--${alert.severity}`} onClick={() => onAction?.('inspect', alert)}>
              <SeverityBadge severity={alert.severity} />
              <span>{readableLabel(alert.title)}</span>
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
        <span><b>{formatNumber(workspace.alerts)}</b> cảnh báo</span>
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
              <strong>{readableLabel(item.title)}</strong>
              <span>{item.description}</span>
            </div>
          </div>
          <div className="cc-work-item__meta">
            <span>{readableLabel(item.source_module)}</span>
            <span>{item.sla_due_at ? `SLA ${formatDateTime(item.sla_due_at)}` : formatDateTime(item.created_at)}</span>
          </div>
          <div className="cc-work-item__actions">
            {item.actions?.includes('retry_event') ? (
              <IconButton icon={RefreshCw} label="Thử lại sự kiện" onClick={() => onAction('retry_event', item)} />
            ) : null}
            {item.actions?.some((action) => action.includes('notification')) ? (
              <IconButton icon={BellRing} label="Thử gửi lại thông báo" onClick={() => onAction('retry_notification', item)} />
            ) : null}
            <IconButton icon={CheckCircle2} label="Ghi nhận" onClick={() => onAction('ack_work_item', item)} />
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
        <span>Mức độ</span>
        <span>Thành phần</span>
        <span>Cảnh báo</span>
        <span>Số lượng</span>
        <span>Thấy lần cuối</span>
        <span>Thao tác</span>
      </div>
      {alerts.map((alert) => (
        <button
          type="button"
          key={alert.id}
          className={`cc-alert-row${selectedId === alert.id ? ' is-selected' : ''}`}
          onClick={() => onSelect(alert)}
        >
          <SeverityBadge severity={alert.severity} />
          <span>{readableLabel(alert.component)}</span>
          <strong>{readableLabel(alert.title)}</strong>
          <span>{formatNumber(alert.count || 1)}</span>
          <span>{formatDateTime(alert.last_seen_at || alert.created_at)}</span>
          <span className="cc-alert-row__actions">
            {alert.actions?.includes('retry_event') ? (
              <IconButton icon={RefreshCw} label="Thử lại sự kiện" onClick={(event) => { event.stopPropagation(); onAction('retry_event', alert); }} />
            ) : null}
            {alert.actions?.some((action) => action.includes('notification')) ? (
              <IconButton icon={BellRing} label="Thử gửi lại thông báo" onClick={(event) => { event.stopPropagation(); onAction('retry_notification', alert); }} />
            ) : null}
            <IconButton icon={CheckCircle2} label="Xử lý" onClick={(event) => { event.stopPropagation(); onAction('resolve_alert', alert); }} />
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
        <strong>{readableLabel(alert.title)}</strong>
        <span>{readableLabel(alert.component)}</span>
      </div>
      <p>{alert.message}</p>
      <dl>
        <div><dt>Nguồn</dt><dd>{alert.source_type || alert.alert_type}</dd></div>
        <div><dt>Bản ghi</dt><dd>{alert.source_id || alert.id}</dd></div>
        <div><dt>Trạng thái</dt><dd>{readableLabel(alert.status)}</dd></div>
        <div><dt>Thấy lần cuối</dt><dd>{formatDateTime(alert.last_seen_at || alert.created_at)}</dd></div>
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
            <span>{item.module_key || item.target_type || 'system'} • {formatDateTime(item.created_at)} • {item.request_id || 'không có request id'}</span>
          </div>
          <SeverityBadge severity={item.severity || 'info'} />
        </article>
      ))}
    </div>
  );
}

function SessionTable({ sessions = [], onAction }) {
  if (!sessions.length) return <EmptyState title="Không có phiên nhân sự đang hoạt động" />;
  return (
    <div className="cc-data-table cc-session-table">
      <div className="cc-data-table__head">
        <span>Người dùng</span>
        <span>Vai trò</span>
        <span>Device/IP</span>
        <span>Thấy lần cuối</span>
        <span>Rủi ro</span>
        <span>Thao tác</span>
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
            <small>{session.ip || 'IP không rõ'}</small>
          </span>
          <span>{formatDateTime(session.last_seen_at)}</span>
          <span className={`cc-risk cc-risk--${session.risk_score >= 50 ? 'critical' : session.risk_score >= 20 ? 'high' : 'low'}`}>{session.risk_score}</span>
          <span className="cc-data-table__actions">
            <IconButton icon={LogOut} label="Thu hồi phiên" onClick={() => onAction('revoke_session', session)} />
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
          <strong>{readableLabel(item.label)}</strong>
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
          <SectionHeader icon={Map} title="Bản đồ sức khỏe workspace" meta={`${data.workspace_health?.length || 0} workspace`} />
          <div className="cc-workspace-grid">
            {(data.workspace_health || []).map((workspace) => <WorkspaceTile key={workspace.code} workspace={workspace} />)}
          </div>
        </div>
        <div className="cc-panel">
          <SectionHeader icon={ClipboardCheck} title="Hàng đợi công việc" meta={`${data.work_item_summary?.total || 0} việc`} />
          <WorkItemList items={(data.work_items || []).slice(0, 8)} onAction={onAction} compact />
        </div>
      </section>
      <section className="cc-grid cc-grid--two">
        <div className="cc-panel">
          <SectionHeader icon={FileClock} title="Hoạt động gần đây" meta={`${data.recent_activities?.length || 0} dòng`} />
          <TimelineFeed items={(data.recent_activities || []).slice(0, 8)} />
        </div>
        <div className="cc-panel">
          <SectionHeader icon={RadioTower} title="Phiên thời gian thực" meta={`${data.active_sessions?.length || 0} phiên`} />
          <SessionTable sessions={(data.active_sessions || []).slice(0, 6)} onAction={onAction} />
        </div>
      </section>
      <section className="cc-grid cc-grid--three">
        <div className="cc-panel">
          <SectionHeader icon={Archive} title="Outbox sự kiện" meta="trạng thái" />
          <BarSet items={Object.entries(data.ops_snapshot?.outbox || {}).map(([label, value]) => ({ label, value }))} />
        </div>
        <div className="cc-panel">
          <SectionHeader icon={BellRing} title="Gửi thông báo" meta="trạng thái" />
          <BarSet items={Object.entries(data.ops_snapshot?.notification_delivery || {}).map(([label, value]) => ({ label, value }))} />
        </div>
        <div className="cc-panel">
          <SectionHeader icon={ShieldAlert} title="Rủi ro bảo mật" meta={`${data.security_snapshot?.risk_score || 0}/100`} />
          <div className="cc-risk-dial">
            <strong>{data.security_snapshot?.risk_score || 0}</strong>
            <span>điểm rủi ro</span>
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
          <span>Sức khỏe tổng thể</span>
          <strong>{statusLabel(data.overall_status)}</strong>
          <small>Kiểm tra lần cuối {formatDateTime(data.checked_at)}</small>
        </div>
        <ActionButton icon={PlayCircle} label="Chạy kiểm tra sức khỏe" onClick={onRefresh} variant="primary" />
      </section>
      <div className="cc-component-grid">
        {(data.components || []).map((component) => (
          <article key={component.key} className={`cc-component cc-component--${component.status}`}>
            <div>
              <StatusBadge status={component.status} />
              <strong>{readableLabel(component.name)}</strong>
              <span>{readableLabel(component.owner_module)}</span>
            </div>
            <dl>
              <div><dt>Lỗi</dt><dd>{formatNumber(component.failed || component.dead_letter || 0)}</dd></div>
              <div><dt>Chờ xử lý</dt><dd>{formatNumber(component.pending || 0)}</dd></div>
              <div><dt>Độ trễ</dt><dd>{component.latency_ms ?? '—'}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <section className="cc-panel">
        <SectionHeader icon={Gauge} title="Xu hướng lỗi" meta="24h" />
        <BarSet items={Object.entries(data.trends || {}).map(([label, value]) => ({ label: readableLabel(label), value }))} />
      </section>
    </>
  );
}

function TasksView({ data, filters, setFilters, onApplyFilters, onResetFilters, filterLoading, onAction }) {
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
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        modules={['security', 'iam', 'ops', 'billing', 'clinical', 'pharmacy', 'portal', 'support']}
        onApply={onApplyFilters}
        onReset={onResetFilters}
        loading={filterLoading}
      />
      <section className="cc-panel">
        <SectionHeader icon={ClipboardCheck} title="Hàng đợi công việc quản trị" meta={`${items.length} bản ghi`} />
        <WorkItemList items={items} onAction={onAction} />
      </section>
    </>
  );
}

function AlertsView({ data, filters, setFilters, onApplyFilters, onResetFilters, filterLoading, onAction, mode }) {
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
            <span>Điểm rủi ro</span>
            <strong>{formatNumber(summary.risk_score)}</strong>
          </article>
        ) : null}
      </div>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        modules={[]}
        onApply={onApplyFilters}
        onReset={onResetFilters}
        loading={filterLoading}
      />
      <section className="cc-alert-layout">
        <div className="cc-panel cc-panel--wide">
          <SectionHeader icon={Icon} title={mode === 'security' ? 'Bảng cảnh báo bảo mật' : 'Hộp cảnh báo'} meta={`${alerts.length} cảnh báo`} />
          <AlertInbox alerts={alerts} onAction={onAction} selectedId={selected?.id} onSelect={setSelected} />
        </div>
        <AlertDetail alert={selected || alerts[0]} />
      </section>
    </>
  );
}

function RecentActivityView({ data, filters, setFilters, onApplyFilters, onResetFilters, filterLoading }) {
  return (
    <>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        modules={['auth', 'users', 'roles', 'permissions', 'settings', 'billing', 'security']}
        onApply={onApplyFilters}
        onReset={onResetFilters}
        loading={filterLoading}
      />
      <section className="cc-panel">
        <SectionHeader icon={FileClock} title="Luồng hoạt động" meta={`${data.items?.length || 0} dòng`} />
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
          <SectionHeader icon={UsersRound} title="Online theo vai trò" meta={`${Object.keys(byRole).length} vai trò`} />
          <BarSet items={Object.entries(byRole).map(([label, value]) => ({ label, value }))} />
        </div>
        <div className="cc-panel">
          <SectionHeader icon={Building2} title="Online theo khoa/phòng" meta={`${Object.keys(byDepartment).length} nhóm`} />
          <BarSet items={Object.entries(byDepartment).map(([label, value]) => ({ label, value }))} />
        </div>
      </section>
      <section className="cc-panel">
        <SectionHeader icon={RadioTower} title="Bảng phiên đăng nhập" meta={`${sessions.length} phiên`} />
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
    ['Outbox chờ xử lý', summary.outbox?.pending],
    ['Outbox lỗi', summary.outbox?.failed],
    ['Dead-letter', summary.outbox?.dead_letter],
    ['Gửi thông báo chờ xử lý', summary.notification_delivery?.pending],
    ['Gửi thông báo lỗi', summary.notification_delivery?.failed],
    ['Tác vụ lỗi 24h', summary.failed_jobs_24h],
  ];
  return (
    <>
      <div className="cc-summary-strip">
        {summaryCards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{formatNumber(value)}</strong></article>)}
      </div>
      <section className="cc-panel">
        <SectionHeader icon={ServerCog} title="Bảng worker" meta={readableLabel(tab)} />
        <div className="cc-tabs">
          {Object.keys(tabs).map((key) => (
            <button key={key} type="button" className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{readableLabel(key)}</button>
          ))}
        </div>
        <GenericTable rows={tabs[tab] || []} columns={TABLE_COLUMNS[tab] || []} />
        {tab === 'event_outbox' ? (
          <div className="cc-panel-actions">
            <ActionButton icon={RefreshCw} label="Thử lại từ từng dòng" onClick={() => onAction('noop')} />
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
          <span>Trạng thái socket</span>
          <strong>{statusLabel(data.socket_status)}</strong>
          <small>{formatNumber(data.connected_clients)} client đang kết nối</small>
        </div>
        <ActionButton icon={RadioTower} label="Gửi broadcast thử cho tôi" onClick={() => onAction('test_realtime')} variant="primary" />
      </section>
      <div className="cc-kpi-grid cc-kpi-grid--compact">
        {(data.cards || []).map((item) => <MiniKpi key={item.key} item={{ ...item, helper: statusLabel(item.status) }} />)}
      </div>
      <section className="cc-grid cc-grid--two">
        <div className="cc-panel">
          <SectionHeader icon={Network} title="Theo dõi room" meta={`${data.rooms?.length || 0} room`} />
          <GenericTable rows={data.rooms || []} columns={['room', 'type', 'connected_sockets', 'last_activity_at', 'allowed_actor_types']} />
        </div>
        <div className="cc-panel">
          <SectionHeader icon={UserRound} title="Hiện diện" meta={`${data.presence?.length || 0} actor`} />
          <GenericTable rows={data.presence || []} columns={['actor_type', 'actor_id', 'socket_count', 'last_seen_at', 'rooms']} />
        </div>
      </section>
      <section className="cc-panel">
        <SectionHeader icon={Activity} title="Theo dõi sự kiện" meta={`${data.events_recent?.length || 0} sự kiện`} />
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
        <SectionHeader icon={Map} title="Lưới workspace" meta={`${data.workspaces?.length || 0} workspace`} />
        <div className="cc-workspace-grid cc-workspace-grid--large">
          {(data.workspaces || []).map((workspace) => <WorkspaceTile key={workspace.code} workspace={workspace} />)}
        </div>
      </section>
      <section className="cc-grid cc-grid--two">
        <div className="cc-panel">
          <SectionHeader icon={Network} title="Bản đồ phụ thuộc workspace" meta={`${data.dependencies?.length || 0} phụ thuộc`} />
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
          <SectionHeader icon={TableProperties} title="Xem trước ma trận truy cập" meta={`${data.access_matrix?.length || 0} dòng`} />
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

function FilterBar({ filters, setFilters, modules = [], onApply, onReset, loading = false }) {
  return (
    <section className="cc-filterbar">
      <label>
        <Search size={16} strokeWidth={2.25} aria-hidden="true" />
        <input
          value={filters.search || ''}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onApply?.();
          }}
          placeholder="Tìm kiếm"
        />
      </label>
      <select value={filters.severity || ''} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}>
        <option value="">Mức độ</option>
        <option value="critical">Nghiêm trọng</option>
        <option value="high">Cao</option>
        <option value="medium">Trung bình</option>
        <option value="low">Thấp</option>
      </select>
      {modules.length ? (
        <select value={filters.module || ''} onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))}>
          <option value="">Module</option>
          {modules.map((module) => <option key={module} value={module}>{readableLabel(module)}</option>)}
        </select>
      ) : null}
      <select value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
        <option value="">Trạng thái</option>
        <option value="new">Mới</option>
        <option value="open">Đang mở</option>
        <option value="acknowledged">Đã ghi nhận</option>
        <option value="in_progress">Đang xử lý</option>
        <option value="resolved">Đã xử lý</option>
      </select>
      <button type="button" onClick={onApply} disabled={loading}>
        <Search size={16} strokeWidth={2.25} aria-hidden="true" />
        <span>Áp dụng</span>
      </button>
      <button type="button" onClick={onReset} disabled={loading}>
        <Filter size={16} strokeWidth={2.25} aria-hidden="true" />
        <span>Xóa lọc</span>
      </button>
    </section>
  );
}

export function CommandCenterPage({ view = 'dashboard' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.dashboard;
  const [bootstrap, setBootstrap] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const serialized = params.toString();
    return serialized ? `?${serialized}` : '';
  }, [appliedFilters]);

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

  function applyFilters() {
    setAppliedFilters(filters);
  }

  function resetFilters() {
    setFilters({});
    setAppliedFilters({});
  }

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

  function handleAction(action, item = {}) {
    if (action === 'noop' || action === 'inspect') return;
    const copy = getCommandActionCopy(action, item, view);
    if (copy) {
      setConfirmAction({ action, item, ...copy });
      return;
    }
    executeAction(action, item).catch((actionError) => setError(actionError.message));
  }

  async function executeAction(action, item = {}, reason = '') {
    setActionLoading(true);
    setError('');
    try {
      if (action === 'retry_event' && item.source_id) {
        await commandCenterPost(`/events/${item.source_id}/retry`);
      } else if (action === 'retry_notification' && item.source_id) {
        await commandCenterPost(`/notifications/${item.source_id}/retry`);
      } else if (action === 'revoke_session') {
        await commandCenterPost(`/sessions/${item.session_id || item.source_id}/revoke`, { reason: reason || 'Thu hồi từ giao diện trung tâm điều phối' });
      } else if (action === 'ack_work_item') {
        await commandCenterPost(`/work-items/${encodeURIComponent(item.id)}/acknowledge`);
      } else if (action === 'resolve_alert') {
        const segment = view === 'securityAlerts' ? 'security-alerts' : 'system-alerts';
        await commandCenterPost(`/${segment}/${encodeURIComponent(item.id)}/resolve`);
      } else if (action === 'test_realtime') {
        await commandCenterPost('/realtime/test-self');
      }
      setConfirmAction(null);
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
      return <div className="cc-loading"><RefreshCw size={22} strokeWidth={2.25} aria-hidden="true" />Đang tải trung tâm điều phối</div>;
    }
    if (view === 'health') return <HealthView data={data} onRefresh={load} />;
    if (view === 'tasks') return <TasksView data={data} filters={filters} setFilters={setFilters} onApplyFilters={applyFilters} onResetFilters={resetFilters} filterLoading={loading} onAction={handleAction} />;
    if (view === 'systemAlerts') return <AlertsView data={data} filters={filters} setFilters={setFilters} onApplyFilters={applyFilters} onResetFilters={resetFilters} filterLoading={loading} onAction={handleAction} mode="system" />;
    if (view === 'securityAlerts') return <AlertsView data={data} filters={filters} setFilters={setFilters} onApplyFilters={applyFilters} onResetFilters={resetFilters} filterLoading={loading} onAction={handleAction} mode="security" />;
    if (view === 'recentActivity') return <RecentActivityView data={data} filters={filters} setFilters={setFilters} onApplyFilters={applyFilters} onResetFilters={resetFilters} filterLoading={loading} />;
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
            <small>Trung tâm điều phối</small>
            <h1>{config.title}</h1>
          </div>
          <StatusBadge status={headerData.overall_status || data.overall_status || data.overall_worker_status || data.socket_status || 'healthy'} />
        </div>
        <div className="cc-header__meta">
          <span>Kiểm tra lần cuối {formatDateTime(headerData.checked_at || data.checked_at)}</span>
          {error ? <strong className="cc-error"><XCircle size={16} strokeWidth={2.25} aria-hidden="true" />{error}</strong> : null}
        </div>
        <div className="cc-header__actions">
          <ActionButton icon={RefreshCw} label="Làm mới" onClick={load} disabled={loading || actionLoading} />
          <Link to="/admin/command-center/health" className="cc-link-button">
            <Activity size={16} strokeWidth={2.25} aria-hidden="true" />
            <span>Mở chẩn đoán</span>
          </Link>
          <ActionButton icon={Download} label="Xuất snapshot" onClick={handleExportSnapshot} disabled={actionLoading} />
          {headerData.permissions?.can_enable_maintenance ? (
            <ActionButton icon={KeyRound} label="Chế độ bảo trì" onClick={() => handleAction('noop')} />
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
      <AdminActionConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title}
        description={confirmAction?.description}
        tone={confirmAction?.tone}
        confirmLabel={confirmAction?.confirmLabel}
        details={confirmAction?.details}
        reasonRequired={confirmAction?.reasonRequired}
        submitting={actionLoading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={(reason) => executeAction(confirmAction.action, confirmAction.item, reason)}
      />
    </div>
  );
}
