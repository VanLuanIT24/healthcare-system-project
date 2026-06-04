import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
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
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminActionConfirmDialog } from '../components/AdminActionConfirmDialog';
import { commandCenterGet, commandCenterPost } from './commandCenterApi';

const VIEW_CONFIG = {
  dashboard: { title: 'Command Center', subtitle: 'Bảng điều khiển tổng hợp sức khỏe hệ thống, bảo mật, realtime, worker và workspace.', endpoint: '/dashboard', icon: Command, path: '/admin/command-center' },
  health: { title: 'Sức khỏe hệ thống', subtitle: 'Theo dõi API, database, worker, notification, file scan, webhook và security monitor.', endpoint: '/health', icon: Activity, path: '/admin/command-center/health' },
  tasks: { title: 'Việc cần xử lý', subtitle: 'Hàng đợi tác vụ quản trị lấy trực tiếp từ DB: jobs lỗi, notification lỗi, outbox, bảo mật và vận hành.', endpoint: '/work-items', icon: ClipboardCheck, path: '/admin/command-center/tasks' },
  systemAlerts: { title: 'Cảnh báo hệ thống', subtitle: 'Cảnh báo vận hành từ event outbox, notification delivery, worker, webhook, file scan và idempotency.', endpoint: '/system-alerts', icon: AlertTriangle, path: '/admin/command-center/system-alerts' },
  securityAlerts: { title: 'Cảnh báo bảo mật', subtitle: 'Giám sát đăng nhập lỗi, tài khoản khóa, phiên rủi ro, quyền hệ thống và audit nhạy cảm.', endpoint: '/security-alerts', icon: ShieldAlert, path: '/admin/command-center/security-alerts' },
  recentActivity: { title: 'Hoạt động gần đây', subtitle: 'Nhật ký audit mới nhất để truy vết thao tác, lỗi xác thực, thay đổi quyền và cấu hình.', endpoint: '/recent-activities', icon: FileClock, path: '/admin/command-center/recent-activity' },
  sessions: { title: 'Phiên đăng nhập realtime', subtitle: 'Theo dõi session staff đang hoạt động, thiết bị, IP, socket và thu hồi phiên khi cần.', endpoint: '/sessions', icon: RadioTower, path: '/admin/command-center/sessions' },
  workers: { title: 'Worker / Queue', subtitle: 'Quan sát job run logs, event outbox, notification delivery, idempotency, QR token và file scan.', endpoint: '/workers', icon: ServerCog, path: '/admin/command-center/workers' },
  realtime: { title: 'Realtime Control', subtitle: 'Tình trạng Socket.IO, presence, rooms, event realtime gần nhất và broadcast test.', endpoint: '/realtime', icon: Wifi, path: '/admin/command-center/realtime' },
  workspaceMap: { title: 'Bản đồ workspace', subtitle: 'Bản đồ liên kết workspace, role access, cảnh báo, pending tasks và phụ thuộc nghiệp vụ.', endpoint: '/workspace-map', icon: Map, path: '/admin/command-center/workspace-map' },
};

const NAV_ITEMS = Object.entries(VIEW_CONFIG).map(([key, value]) => ({ key, ...value }));

const LABELS = {
  healthy: 'Ổn định', degraded: 'Suy giảm', critical: 'Nghiêm trọng', available: 'Khả dụng', unavailable: 'Không khả dụng', unknown: 'Không rõ',
  high: 'Cao', medium: 'Trung bình', low: 'Thấp', info: 'Thông tin', warning: 'Cảnh báo', success: 'Thành công', failed: 'Lỗi', pending: 'Chờ xử lý', queued: 'Trong hàng đợi',
  open: 'Đang mở', new: 'Mới', acknowledged: 'Đã ghi nhận', in_progress: 'Đang xử lý', resolved: 'Đã xử lý', active: 'Hoạt động', online: 'Online',
  api_health: 'API', database_health: 'Database', worker_health: 'Worker', notification_failed: 'Notification lỗi', dead_letter_events: 'Dead-letter', security_risk: 'Risk bảo mật', active_staff_sessions: 'Staff sessions', pending_admin_tasks: 'Việc chờ xử lý', locked_staff: 'Tài khoản khóa', appointments_today: 'Lịch hẹn hôm nay', unpaid_invoices: 'Hóa đơn chưa thu', revenue_today: 'Doanh thu hôm nay',
  job_run_logs: 'Job logs', event_outbox: 'Event outbox', notification_delivery: 'Notification delivery', idempotency_records: 'Idempotency', qr_tokens: 'QR tokens', file_scans: 'File scans',
  auth_session: 'Phiên đăng nhập', Authentication: 'Xác thực', 'Event Outbox': 'Event outbox', 'Notification Delivery': 'Notification delivery', 'Worker Queue': 'Worker queue', 'Payment Webhook': 'Webhook thanh toán', 'File Scan': 'Quét tệp', Idempotency: 'Idempotency',
  admin: 'Quản trị', scheduling: 'Điều phối lịch', reception: 'Lễ tân', doctor: 'Bác sĩ', nursing: 'Điều dưỡng', lab: 'Cận lâm sàng', pharmacy: 'Nhà thuốc', billing: 'Viện phí', reports: 'Báo cáo', records: 'Hồ sơ', security: 'Bảo mật', notifications: 'Thông báo', workers: 'Worker', events: 'Sự kiện',
};

const STATUS_TONE = {
  healthy: 'success', available: 'success', success: 'success', active: 'success', online: 'success', resolved: 'success',
  degraded: 'warning', warning: 'warning', medium: 'warning', pending: 'warning', queued: 'warning', acknowledged: 'warning', in_progress: 'warning',
  critical: 'danger', high: 'danger', failed: 'danger', unavailable: 'danger', locked: 'danger',
  low: 'info', info: 'info', new: 'info', open: 'info', unknown: 'neutral',
};

const WORKSPACE_ICONS = { admin: ShieldCheck, scheduling: Clock3, reception: ClipboardCheck, doctor: Stethoscope, nursing: HeartPulse, lab: TestTube2, pharmacy: BellRing, billing: BarChart3, reports: TableProperties };
const CARD_ICONS = { api_health: Activity, database_health: Database, worker_health: ServerCog, notification_failed: BellRing, dead_letter_events: Archive, security_risk: ShieldAlert, active_staff_sessions: UsersRound, pending_admin_tasks: ClipboardCheck, locked_staff: LockKeyhole, appointments_today: Clock3, unpaid_invoices: BarChart3, revenue_today: Gauge };
const WORKER_TABS = ['job_run_logs', 'event_outbox', 'notification_delivery', 'idempotency_records', 'qr_tokens', 'file_scans'];

function arr(value) { return Array.isArray(value) ? value : []; }
function obj(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function label(value) { const raw = String(value ?? ''); return LABELS[raw] || LABELS[raw.toLowerCase()] || raw.replace(/_/g, ' '); }
function tone(value) { return STATUS_TONE[String(value || '').toLowerCase()] || 'neutral'; }
function number(value) { return new Intl.NumberFormat('vi-VN').format(Number(value || 0)); }
function currency(value) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0)); }
function dateTime(value) {
  if (!value) return 'Chưa có';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}
function shortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(d);
}
function metricValue(card) { return card?.key === 'revenue_today' ? currency(card.value) : number(card?.value); }
function initials(name = '') { return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?'; }
function pct(value, max = 100) { return Math.max(0, Math.min(100, Number(value || 0) / Number(max || 100) * 100)); }

function Badge({ value, children, className = '' }) {
  const v = value || children;
  return <span className={`cc-badge cc-badge--${tone(v)} ${className}`}>{children || label(v)}</span>;
}
function Severity({ value }) { return <span className={`cc-severity cc-severity--${String(value || 'info').toLowerCase()}`}>{label(value || 'info')}</span>; }
function IconShell({ icon: Icon = Command, toneName = 'info' }) { return <span className={`cc-icon-shell cc-icon-shell--${toneName}`}><Icon size={19} strokeWidth={2.25} /></span>; }
function Empty({ title = 'Chưa có dữ liệu', desc = 'Backend chưa trả bản ghi phù hợp với bộ lọc hiện tại.' }) { return <div className="cc-empty"><CheckCircle2 size={24} /><strong>{title}</strong><span>{desc}</span></div>; }
function Loading() { return <div className="cc-loading"><RefreshCw size={24} className="cc-spin" />Đang đồng bộ dữ liệu Command Center...</div>; }

function CommandTabs({ current }) {
  return (
    <nav className="cc-nav" aria-label="Command Center navigation">
      {NAV_ITEMS.map(({ key, title, path, icon: Icon }) => (
        <Link key={key} to={path} className={`cc-nav__item${current === key ? ' is-active' : ''}`}>
          <Icon size={17} strokeWidth={2.25} />
          <span>{title}</span>
        </Link>
      ))}
    </nav>
  );
}

function StatCard({ item, icon: OverrideIcon, title, value, helper, status, to }) {
  const key = item?.key;
  const Icon = OverrideIcon || CARD_ICONS[key] || Gauge;
  const content = (
    <article className={`cc-stat cc-stat--${tone(item?.status || status)}`}>
      <div className="cc-stat__top"><IconShell icon={Icon} toneName={tone(item?.status || status)} /><Badge value={item?.status || status || 'healthy'} /></div>
      <p>{label(item?.label || title || key)}</p>
      <strong>{item ? metricValue(item) : value}</strong>
      <small>{label(item?.helper || helper || '')}</small>
    </article>
  );
  if (item?.route || to) return <Link to={item?.route || to} className="cc-stat-link">{content}</Link>;
  return content;
}

function Progress({ label: title, value, max = 100, status = 'healthy' }) {
  return <div className="cc-progress"><div><span>{title}</span><strong>{number(value)}</strong></div><i><b className={`cc-progress__bar cc-progress__bar--${tone(status)}`} style={{ width: `${pct(value, max)}%` }} /></i></div>;
}

function FilterBar({ filters, setFilters, onApply, onReset, modules = [], loading }) {
  return (
    <section className="cc-filterbar">
      <label className="cc-filterbar__search"><Search size={17} /><input value={filters.search || ''} onChange={(e) => setFilters((s) => ({ ...s, search: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && onApply()} placeholder="Tìm theo tiêu đề, mô tả, action, request id..." /></label>
      <select value={filters.severity || ''} onChange={(e) => setFilters((s) => ({ ...s, severity: e.target.value }))}><option value="">Mức độ</option><option value="critical">Nghiêm trọng</option><option value="high">Cao</option><option value="medium">Trung bình</option><option value="low">Thấp</option></select>
      <select value={filters.status || ''} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}><option value="">Trạng thái</option><option value="new">Mới</option><option value="open">Đang mở</option><option value="pending">Chờ xử lý</option><option value="failed">Lỗi</option><option value="resolved">Đã xử lý</option></select>
      {modules.length ? <select value={filters.module || ''} onChange={(e) => setFilters((s) => ({ ...s, module: e.target.value }))}><option value="">Module</option>{modules.map((m) => <option key={m} value={m}>{label(m)}</option>)}</select> : null}
      <button type="button" className="cc-btn cc-btn--primary" onClick={onApply} disabled={loading}><Search size={16} />Áp dụng</button>
      <button type="button" className="cc-btn" onClick={onReset} disabled={loading}><Filter size={16} />Reset</button>
    </section>
  );
}

function WorkItemCard({ item, onAction }) {
  return (
    <article className={`cc-work-card cc-work-card--${item.severity || 'info'}`}>
      <div className="cc-work-card__head"><Severity value={item.severity} /><Badge value={item.status || 'open'} /><span>{label(item.workspace_code || item.source_module)}</span></div>
      <h3>{label(item.title)}</h3>
      <p>{item.description || 'Không có mô tả chi tiết.'}</p>
      <div className="cc-work-card__meta"><span>{label(item.source_module)}</span><span>{item.sla_due_at ? `SLA ${shortDate(item.sla_due_at)}` : shortDate(item.created_at)}</span><span>{item.source_type || 'virtual'}</span></div>
      <div className="cc-card-actions">
        {arr(item.actions).some((a) => a.includes('retry_event')) ? <button type="button" onClick={() => onAction('retry_event', item)}><RefreshCw size={15} />Retry event</button> : null}
        {arr(item.actions).some((a) => a.includes('notification')) ? <button type="button" onClick={() => onAction('retry_notification', item)}><BellRing size={15} />Retry notify</button> : null}
        <button type="button" onClick={() => onAction('ack_work_item', item)}><CheckCircle2 size={15} />Ghi nhận</button>
      </div>
    </article>
  );
}

function AlertCard({ item, onAction }) {
  return (
    <article className={`cc-alert-card cc-alert-card--${item.severity || 'info'}`}>
      <div className="cc-alert-card__rail" />
      <div className="cc-alert-card__main">
        <div className="cc-alert-card__top"><Severity value={item.severity} /><Badge value={item.status || 'open'} /><span>{label(item.component)}</span></div>
        <h3>{label(item.title)}</h3>
        <p>{item.message || 'Không có message.'}</p>
        <div className="cc-alert-card__meta"><span>Count: {number(item.count || 1)}</span><span>Last: {shortDate(item.last_seen_at || item.created_at)}</span><span>{item.source_type || item.alert_type || 'summary'}</span></div>
      </div>
      <div className="cc-card-actions cc-card-actions--vertical">
        {arr(item.actions).some((a) => a.includes('retry_event')) && item.source_id ? <button type="button" onClick={() => onAction('retry_event', item)}><RefreshCw size={15} />Retry</button> : null}
        {arr(item.actions).some((a) => a.includes('notification')) && item.source_id ? <button type="button" onClick={() => onAction('retry_notification', item)}><BellRing size={15} />Notify</button> : null}
        <button type="button" onClick={() => onAction('resolve_alert', item)}><CheckCircle2 size={15} />Xử lý</button>
      </div>
    </article>
  );
}

function ActivityRow({ item }) {
  const ok = !['failed', 'critical', 'high'].includes(String(item.status || item.severity || '').toLowerCase());
  return (
    <article className="cc-activity-row">
      <span className={`cc-activity-row__dot${ok ? '' : ' is-danger'}`} />
      <div><strong>{label(item.message || item.action || 'Audit event')}</strong><small>{label(item.module_key || item.target_type || 'system')} · {item.request_id || item.target_id || 'no request id'}</small></div>
      <div><Badge value={item.status || item.severity || 'info'} /><small>{shortDate(item.created_at)}</small></div>
    </article>
  );
}

function DataTable({ rows = [], columns = [], onAction, actionType }) {
  const normalizedRows = arr(rows);
  const cols = columns.length ? columns : Object.keys(obj(normalizedRows[0])).slice(0, 7);
  if (!normalizedRows.length) return <Empty title="Không có bản ghi" />;
  return (
    <div className="cc-table-wrap">
      <table className="cc-table">
        <thead><tr>{cols.map((c) => <th key={c}>{label(c)}</th>)}{onAction ? <th>Thao tác</th> : null}</tr></thead>
        <tbody>
          {normalizedRows.map((row, idx) => (
            <tr key={row._id || row.id || row.session_id || idx}>
              {cols.map((c) => <td key={c}>{renderCell(row[c], c)}</td>)}
              {onAction ? <td><button type="button" className="cc-mini-btn" onClick={() => onAction(actionType, row)}>{actionType === 'revoke_session' ? 'Thu hồi' : 'Thao tác'}</button></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function renderCell(value, key) {
  if (value === null || value === undefined || value === '') return <span className="cc-muted">—</span>;
  if (key?.includes('status') || key === 'severity') return <Badge value={value} />;
  if (key?.includes('_at') || key === 'login_at' || key === 'expires_at') return shortDate(value);
  if (Array.isArray(value)) return <span className="cc-chipline">{value.slice(0, 3).map((x) => <i key={String(x)}>{label(x)}</i>)}{value.length > 3 ? <i>+{value.length - 3}</i> : null}</span>;
  if (typeof value === 'object') return <code>{JSON.stringify(value).slice(0, 90)}</code>;
  return String(value).length > 120 ? `${String(value).slice(0, 120)}...` : String(value);
}

function DashboardView({ data, onAction }) {
  const summaryCards = arr(data.summary_cards);
  const critical = arr(data.critical_alerts);
  const workItems = arr(data.work_items);
  const workspaces = arr(data.workspace_health);
  const security = obj(data.security_snapshot);
  const ops = obj(data.ops_snapshot);
  const billing = obj(data.billing_snapshot);
  return (
    <div className="cc-page-grid">
      <section className="cc-hero-panel cc-hero-panel--wide">
        <div><span className="cc-eyebrow">Live control plane</span><h2>Điều phối toàn hệ thống từ một màn hình</h2><p>Toàn bộ số liệu được lấy trực tiếp từ backend Command Center: staff sessions, worker queue, event outbox, notification delivery, audit, billing và workspace health.</p></div>
        <div className="cc-hero-orbit"><strong>{number(arr(data.active_sessions).length)}</strong><span>active sessions</span><i /></div>
      </section>
      <section className="cc-stat-grid cc-stat-grid--dashboard">{summaryCards.slice(0, 12).map((item) => <StatCard key={item.key} item={item} />)}</section>
      <section className="cc-panel cc-panel--span-7"><PanelHead icon={AlertTriangle} title="Cảnh báo ưu tiên" meta={`${critical.length} tín hiệu`} /><div className="cc-stack">{critical.length ? critical.slice(0, 6).map((x) => <AlertCard key={x.id} item={x} onAction={onAction} />) : <Empty title="Không có cảnh báo nghiêm trọng" />}</div></section>
      <section className="cc-panel cc-panel--span-5"><PanelHead icon={Gauge} title="Risk radar" meta="24h" /><Progress label="Security risk" value={security.risk_score || 0} status={security.status} /><Progress label="Failed jobs" value={ops.failed_jobs_24h || 0} max={20} status={ops.status} /><Progress label="Failed notification" value={(ops.notification_delivery?.failed || 0) + (ops.notifications?.failed || 0)} max={20} status="degraded" /><Progress label="Unpaid invoices" value={billing.unpaid_invoices || 0} max={100} status="warning" /></section>
      <section className="cc-panel cc-panel--span-7"><PanelHead icon={ClipboardCheck} title="Việc cần xử lý" meta={`${workItems.length} việc`} action={<Link to="/admin/command-center/tasks">Mở tất cả <ArrowRight size={14} /></Link>} /><div className="cc-work-grid cc-work-grid--compact">{workItems.length ? workItems.slice(0, 6).map((x) => <WorkItemCard key={x.id} item={x} onAction={onAction} />) : <Empty title="Không có việc tồn" />}</div></section>
      <section className="cc-panel cc-panel--span-5"><PanelHead icon={Map} title="Workspace health" meta={`${workspaces.length} workspace`} /><div className="cc-workspace-mini">{workspaces.slice(0, 8).map((w) => <WorkspaceMini key={w.code} item={w} />)}</div></section>
    </div>
  );
}

function HealthView({ data, onRefresh }) {
  const components = arr(data.components);
  const trends = obj(data.trends);
  return (
    <div className="cc-page-grid">
      <section className="cc-stat-grid cc-stat-grid--four">
        <StatCard title="Trạng thái tổng" value={label(data.overall_status)} helper="Tổng hợp API + DB + worker + security" status={data.overall_status} icon={Activity} />
        <StatCard title="Failed jobs 24h" value={number(trends.failed_jobs_24h)} helper="JobRunLog failed" status={trends.failed_jobs_24h ? 'degraded' : 'healthy'} icon={ServerCog} />
        <StatCard title="Outbox lỗi 24h" value={number(trends.outbox_failed_24h)} helper="EventOutbox failed/dead-letter" status={trends.outbox_failed_24h ? 'critical' : 'healthy'} icon={Archive} />
        <StatCard title="Security events" value={number(trends.security_alert_count)} helper="Audit nhạy cảm" status={trends.security_alert_count ? 'degraded' : 'healthy'} icon={ShieldAlert} />
      </section>
      <section className="cc-panel cc-panel--span-8"><PanelHead icon={Activity} title="Service health matrix" meta={`${components.length} thành phần`} action={<button type="button" onClick={onRefresh}>Refresh</button>} /><div className="cc-service-grid">{components.map((c) => <ServiceCard key={c.key} item={c} />)}</div></section>
      <section className="cc-panel cc-panel--span-4"><PanelHead icon={BarChart3} title="Trend 24h" meta="DB counters" />{Object.entries(trends).map(([k, v]) => <Progress key={k} label={label(k)} value={v} max={Math.max(10, Number(v) * 1.4)} status={v ? 'warning' : 'healthy'} />)}</section>
    </div>
  );
}

function TasksView({ data, filters, setFilters, onApplyFilters, onResetFilters, filterLoading, onAction }) {
  const items = arr(data.items);
  const summary = obj(data.summary);
  const modules = Object.keys(obj(summary.by_module));
  return (
    <div className="cc-page-grid">
      <section className="cc-panel cc-panel--full"><FilterBar filters={filters} setFilters={setFilters} onApply={onApplyFilters} onReset={onResetFilters} modules={modules} loading={filterLoading} /></section>
      <section className="cc-stat-grid cc-stat-grid--six cc-panel--full"><MiniMetric title="Tổng việc" value={summary.total} /><MiniMetric title="Critical" value={summary.critical} toneName="danger" /><MiniMetric title="High" value={summary.high} toneName="danger" /><MiniMetric title="Quá SLA" value={summary.overdue} toneName="warning" /><MiniMetric title="Gán cho tôi" value={summary.assigned_to_me} toneName="info" /><MiniMetric title="Module" value={modules.length} /></section>
      <section className="cc-panel cc-panel--full"><PanelHead icon={ClipboardCheck} title="Action queue" meta={`${items.length} bản ghi`} /><div className="cc-work-grid">{items.length ? items.map((x) => <WorkItemCard key={x.id} item={x} onAction={onAction} />) : <Empty title="Không có việc cần xử lý" />}</div></section>
    </div>
  );
}

function AlertsView({ data, filters, setFilters, onApplyFilters, onResetFilters, filterLoading, onAction, mode }) {
  const items = arr(data.items);
  const summary = obj(data.summary);
  const modules = [...new Set(items.map((x) => x.component || x.workspace_code).filter(Boolean))];
  return (
    <div className="cc-page-grid">
      <section className="cc-panel cc-panel--full"><FilterBar filters={filters} setFilters={setFilters} onApply={onApplyFilters} onReset={onResetFilters} modules={modules} loading={filterLoading} /></section>
      <section className="cc-alert-summary cc-panel--full">
        <MiniMetric title="Tổng cảnh báo" value={summary.total || items.length} />
        <MiniMetric title="Critical" value={summary.critical} toneName="danger" />
        <MiniMetric title="High" value={summary.high} toneName="danger" />
        <MiniMetric title="Medium" value={summary.medium} toneName="warning" />
        <MiniMetric title="Low" value={summary.low} toneName="info" />
        <MiniMetric title={mode === 'security' ? 'Security feed' : 'System feed'} value={items.length} />
      </section>
      <section className="cc-panel cc-panel--full"><PanelHead icon={mode === 'security' ? ShieldAlert : AlertTriangle} title={mode === 'security' ? 'Security alert inbox' : 'System alert inbox'} meta={`${items.length} bản ghi`} /><div className="cc-alert-list">{items.length ? items.map((x) => <AlertCard key={x.id} item={x} onAction={onAction} />) : <Empty title="Không có cảnh báo đang mở" />}</div></section>
    </div>
  );
}

function RecentActivityView({ data, filters, setFilters, onApplyFilters, onResetFilters, filterLoading }) {
  const items = arr(data.items);
  const summary = obj(data.summary);
  const modules = [...new Set(items.map((x) => x.module_key).filter(Boolean))];
  return (
    <div className="cc-page-grid">
      <section className="cc-panel cc-panel--full"><FilterBar filters={filters} setFilters={setFilters} onApply={onApplyFilters} onReset={onResetFilters} modules={modules} loading={filterLoading} /></section>
      <section className="cc-stat-grid cc-stat-grid--three cc-panel--full"><MiniMetric title="Đã tải" value={summary.total_loaded || items.length} /><MiniMetric title="Failed" value={summary.failed} toneName="danger" /><MiniMetric title="High severity" value={summary.high_severity} toneName="warning" /></section>
      <section className="cc-panel cc-panel--full"><PanelHead icon={FileClock} title="Audit timeline" meta={`${items.length} hoạt động`} /><div className="cc-timeline">{items.length ? items.map((x) => <ActivityRow key={x._id || x.id} item={x} />) : <Empty title="Chưa có audit log" />}</div></section>
    </div>
  );
}

function SessionsView({ data, onAction }) {
  const sessions = arr(data.sessions);
  const summary = obj(data.summary);
  return (
    <div className="cc-page-grid">
      <section className="cc-stat-grid cc-stat-grid--three cc-panel--full"><MiniMetric title="Active staff sessions" value={summary.active_staff_sessions} /><MiniMetric title="Suspicious" value={summary.suspicious_sessions} toneName="danger" /><MiniMetric title="Revoked 24h" value={summary.revoked_today} toneName="warning" /></section>
      <section className="cc-panel cc-panel--full"><PanelHead icon={RadioTower} title="Phiên đăng nhập đang hoạt động" meta={`${sessions.length} phiên trả về`} /><div className="cc-session-grid">{sessions.length ? sessions.map((s) => <SessionCard key={s.session_id} item={s} onRevoke={() => onAction('revoke_session', s)} />) : <Empty title="Không có phiên active" />}</div></section>
    </div>
  );
}

function WorkersView({ data, onAction }) {
  const [tab, setTab] = useState('job_run_logs');
  const tabs = obj(data.tabs);
  const rows = arr(tabs[tab]);
  const summary = obj(data.summary);
  const columns = {
    job_run_logs: ['job_name', 'queue_name', 'status', 'started_at', 'finished_at', 'duration_ms', 'records_processed', 'error_message'],
    event_outbox: ['event_type', 'aggregate_type', 'status', 'retry_count', 'next_retry_at', 'last_error', 'created_at'],
    notification_delivery: ['channel', 'provider', 'status', 'attempt_count', 'next_attempt_at', 'last_error', 'created_at'],
    idempotency_records: ['method', 'route', 'status', 'status_code', 'expires_at', 'created_at'],
    qr_tokens: ['type', 'target_type', 'expires_at', 'used_at', 'revoked_at', 'created_at'],
    file_scans: ['file_name', 'scan_status', 'review_status', 'source', 'created_at'],
  }[tab] || [];
  return (
    <div className="cc-page-grid">
      <section className="cc-stat-grid cc-stat-grid--four cc-panel--full"><MiniMetric title="Failed jobs 24h" value={summary.failed_jobs_24h} toneName="danger" /><MiniMetric title="File scan lỗi" value={summary.failed_file_scans_24h} toneName="warning" /><MiniMetric title="Idempotency lỗi" value={summary.failed_idempotency_24h} toneName="warning" /><MiniMetric title="QR hết hạn" value={summary.expired_qr_tokens_24h} /></section>
      <section className="cc-panel cc-panel--full"><PanelHead icon={ServerCog} title="Worker data browser" meta={`${rows.length} bản ghi`} /><div className="cc-subtabs">{WORKER_TABS.map((t) => <button key={t} type="button" className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>{label(t)} <b>{arr(tabs[t]).length}</b></button>)}</div><DataTable rows={rows} columns={columns} onAction={tab === 'event_outbox' ? onAction : null} actionType="retry_event" /></section>
    </div>
  );
}

function RealtimeView({ data, onAction }) {
  const cards = arr(data.cards);
  return (
    <div className="cc-page-grid">
      <section className="cc-stat-grid cc-stat-grid--six cc-panel--full">{cards.map((c) => <StatCard key={c.key} item={c} />)}</section>
      <section className="cc-panel cc-panel--span-5"><PanelHead icon={Wifi} title="Socket status" meta={label(data.socket_status)} action={<button type="button" onClick={() => onAction('test_realtime', data)}><PlayCircle size={15} />Test self</button>} /><div className="cc-realtime-core"><strong>{number(data.connected_clients)}</strong><span>connected clients</span><p>Online staff: {number(data.online_staff)} · Online patients: {number(data.online_patients)} · Active rooms: {number(data.active_rooms)}</p></div>{data.last_event_emitted ? <ActivityRow item={data.last_event_emitted} /> : <Empty title="Chưa có realtime event" />}</section>
      <section className="cc-panel cc-panel--span-7"><PanelHead icon={Network} title="Active rooms" meta={`${arr(data.rooms).length} rooms`} /><DataTable rows={arr(data.rooms)} columns={['room', 'type', 'connected_sockets', 'last_activity_at', 'allowed_actor_types']} /></section>
      <section className="cc-panel cc-panel--full"><PanelHead icon={UserRound} title="Presence" meta={`${arr(data.presence).length} actor online`} /><DataTable rows={arr(data.presence)} columns={['actor_type', 'actor_id', 'socket_count', 'last_seen_at', 'rooms']} /></section>
    </div>
  );
}

function WorkspaceMapView({ data }) {
  const summary = obj(data.summary);
  const workspaces = arr(data.workspaces);
  const dependencies = arr(data.dependencies);
  const matrix = arr(data.access_matrix);
  return (
    <div className="cc-page-grid">
      <section className="cc-stat-grid cc-stat-grid--five cc-panel--full"><MiniMetric title="Workspace" value={summary.total_workspaces} /><MiniMetric title="Tôi truy cập" value={summary.available_to_me} /><MiniMetric title="Có cảnh báo" value={summary.with_alerts} toneName="warning" /><MiniMetric title="Degraded" value={summary.degraded} toneName="warning" /><MiniMetric title="Critical" value={summary.critical} toneName="danger" /></section>
      <section className="cc-panel cc-panel--span-8"><PanelHead icon={Map} title="Workspace topology" meta="Xâu chuỗi nghiệp vụ" /><div className="cc-workspace-grid">{workspaces.map((w) => <WorkspaceTile key={w.code} item={w} />)}</div></section>
      <section className="cc-panel cc-panel--span-4"><PanelHead icon={Network} title="Luồng phụ thuộc" meta={`${dependencies.length} link`} /><div className="cc-dependency-list">{dependencies.map((d) => <article key={`${d.from}-${d.to}`}><strong>{label(d.from)}</strong><ArrowRight size={15} /><strong>{label(d.to)}</strong><span>{d.label}</span></article>)}</div></section>
      <section className="cc-panel cc-panel--full"><PanelHead icon={KeyRound} title="Access matrix preview" meta={`${matrix.length} workspace`} /><div className="cc-matrix">{matrix.slice(0, 8).map((m) => <article key={m.workspace_code}><h3>{m.workspace_name}</h3><div>{arr(m.roles).slice(0, 8).map((r) => <span key={r.role_code} className={r.access === 'allowed' ? 'is-allowed' : ''}>{r.role_code}</span>)}</div></article>)}</div></section>
    </div>
  );
}

function PanelHead({ icon: Icon = Command, title, meta, action }) { return <div className="cc-panel-head"><div><Icon size={19} /><h2>{title}</h2></div><span>{meta}</span>{action ? <div className="cc-panel-head__action">{action}</div> : null}</div>; }
function MiniMetric({ title, value, toneName = 'neutral' }) { return <article className={`cc-mini-metric cc-mini-metric--${toneName}`}><span>{title}</span><strong>{number(value)}</strong></article>; }
function ServiceCard({ item }) { return <article className={`cc-service-card cc-service-card--${tone(item.status)}`}><div><IconShell icon={item.key === 'database' ? Database : item.key === 'security' ? ShieldAlert : item.key === 'worker' ? ServerCog : Activity} toneName={tone(item.status)} /><Badge value={item.status} /></div><h3>{label(item.name || item.key)}</h3><p>Owner: {label(item.owner_module || 'system')}</p><small>Failed: {number(item.failed || item.failed_login_24h || 0)} · {shortDate(item.last_checked_at)}</small></article>; }
function WorkspaceMini({ item }) { const Icon = WORKSPACE_ICONS[item.code] || Building2; return <Link to={item.route || '#'} className={`cc-workspace-mini__item cc-workspace-mini__item--${tone(item.status)}`}><Icon size={16} /><span>{item.name}</span><b>{number(item.pending_tasks)}</b><Badge value={item.status} /></Link>; }
function SessionCard({ item, onRevoke }) { return <article className={`cc-session-card cc-session-card--${item.risk_score >= 20 ? 'danger' : 'success'}`}><div className="cc-session-card__avatar">{initials(item.full_name)}</div><div className="cc-session-card__body"><h3>{item.full_name}</h3><p>{item.email || item.username}</p><div><Badge value={item.status} /><span>{item.department_name}</span><span>{item.device_name}</span><span>{item.ip || 'no ip'}</span></div><small>Login {shortDate(item.login_at)} · Last seen {shortDate(item.last_seen_at)} · Risk {number(item.risk_score)}</small></div><button type="button" onClick={onRevoke}><LogOutIcon /> Thu hồi</button></article>; }
function LogOutIcon() { return <XCircle size={15} />; }
function WorkspaceTile({ item }) { const Icon = WORKSPACE_ICONS[item.code] || Building2; return <article className={`cc-workspace-tile cc-workspace-tile--${tone(item.status)}`}><div><IconShell icon={Icon} toneName={tone(item.status)} /><Badge value={item.status} /></div><h3>{item.name}</h3><p>{item.description || item.route}</p><div className="cc-workspace-tile__metrics"><span><b>{number(item.pending_tasks)}</b> việc</span><span><b>{number(item.alerts)}</b> cảnh báo</span><span><b>{number(item.online_users)}</b> online</span></div><small>{item.allowed ? 'Được phép truy cập' : 'Giới hạn quyền'} · {shortDate(item.last_activity)}</small>{item.route ? <Link to={item.route}>Mở workspace <ExternalLink size={14} /></Link> : null}</article>; }

function getActionCopy(action, item = {}, view = '') {
  const target = item.title || item.full_name || item.event_type || item.job_name || item.id || item.session_id || item.source_id || 'Bản ghi đã chọn';
  const map = {
    retry_event: ['Thử lại event outbox?', 'Sự kiện sẽ được đưa về trạng thái pending để worker xử lý lại. Chỉ thao tác khi đã kiểm tra nguyên nhân lỗi.', 'Thử lại event', 'warning', false],
    retry_notification: ['Thử gửi lại notification?', 'Notification/delivery sẽ được đưa vào hàng đợi gửi lại.', 'Thử gửi lại', 'warning', false],
    revoke_session: ['Thu hồi phiên đăng nhập?', 'Người dùng sẽ bị đăng xuất khỏi phiên này. Thao tác được ghi audit và phát realtime event.', 'Thu hồi phiên', 'danger', true],
    ack_work_item: ['Ghi nhận việc cần xử lý?', 'Command Center sẽ ghi audit rằng quản trị viên đã tiếp nhận việc này.', 'Ghi nhận', 'success', false],
    resolve_alert: ['Đánh dấu cảnh báo đã xử lý?', 'Cảnh báo ảo sẽ được ghi audit trạng thái resolved. Dữ liệu nguồn vẫn giữ nguyên để truy vết.', 'Xác nhận xử lý', 'success', false],
    test_realtime: ['Gửi realtime test?', 'Backend sẽ phát event command_center.test_self đến phiên hiện tại.', 'Gửi test', 'warning', false],
  };
  const copy = map[action];
  if (!copy) return null;
  return { action, item, title: copy[0], description: copy[1], confirmLabel: copy[2], tone: copy[3], reasonRequired: copy[4], details: [{ label: 'Màn hình', value: VIEW_CONFIG[view]?.title || 'Command Center' }, { label: 'Đối tượng', value: target }, { label: 'ID', value: item.session_id || item.source_id || item.id || item._id || '-' }] };
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
  const [notice, setNotice] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(appliedFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [appliedFilters]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [boot, det] = await Promise.all([commandCenterGet('/bootstrap'), commandCenterGet(`${config.endpoint}${queryString}`)]);
      setBootstrap(boot); setDetail(det);
    } catch (e) { setError(e.message || 'Không thể tải Command Center.'); }
    finally { setLoading(false); }
  }, [config.endpoint, queryString]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setFilters({}); setAppliedFilters({}); setNotice(''); }, [view]);

  const data = detail || bootstrap || {};
  const headerData = bootstrap || data;
  const Icon = config.icon;

  async function handleExportSnapshot() {
    setActionLoading(true); setError('');
    try {
      const snapshot = await commandCenterPost('/export-snapshot');
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `command-center-snapshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`; a.click(); URL.revokeObjectURL(url);
      setNotice('Đã xuất snapshot Command Center thành công.');
    } catch (e) { setError(e.message || 'Không thể xuất snapshot.'); }
    finally { setActionLoading(false); }
  }

  function handleAction(action, item = {}) {
    const copy = getActionCopy(action, item, view);
    if (copy) return setConfirmAction(copy);
    executeAction(action, item).catch((e) => setError(e.message));
  }

  async function executeAction(action, item = {}, reason = '') {
    setActionLoading(true); setError(''); setNotice('');
    try {
      if (action === 'retry_event') await commandCenterPost(`/events/${item.source_id || item._id}/retry`);
      else if (action === 'retry_notification') await commandCenterPost(`/notifications/${item.source_id || item._id}/retry`);
      else if (action === 'revoke_session') await commandCenterPost(`/sessions/${item.session_id || item.source_id}/revoke`, { reason: reason || 'Thu hồi từ Command Center' });
      else if (action === 'ack_work_item') await commandCenterPost(`/work-items/${encodeURIComponent(item.id)}/acknowledge`);
      else if (action === 'resolve_alert') await commandCenterPost(`/${view === 'securityAlerts' ? 'security-alerts' : 'system-alerts'}/${encodeURIComponent(item.id)}/resolve`);
      else if (action === 'test_realtime') await commandCenterPost('/realtime/test-self');
      setConfirmAction(null);
      setNotice('Thao tác đã xử lý thành công và được ghi audit.');
      await load();
    } catch (e) { setError(e.message || 'Thao tác thất bại.'); }
    finally { setActionLoading(false); }
  }

  function renderView() {
    if (loading && !detail && !bootstrap) return <Loading />;
    if (view === 'health') return <HealthView data={data} onRefresh={load} />;
    if (view === 'tasks') return <TasksView data={data} filters={filters} setFilters={setFilters} onApplyFilters={() => setAppliedFilters(filters)} onResetFilters={() => { setFilters({}); setAppliedFilters({}); }} filterLoading={loading} onAction={handleAction} />;
    if (view === 'systemAlerts') return <AlertsView data={data} filters={filters} setFilters={setFilters} onApplyFilters={() => setAppliedFilters(filters)} onResetFilters={() => { setFilters({}); setAppliedFilters({}); }} filterLoading={loading} onAction={handleAction} mode="system" />;
    if (view === 'securityAlerts') return <AlertsView data={data} filters={filters} setFilters={setFilters} onApplyFilters={() => setAppliedFilters(filters)} onResetFilters={() => { setFilters({}); setAppliedFilters({}); }} filterLoading={loading} onAction={handleAction} mode="security" />;
    if (view === 'recentActivity') return <RecentActivityView data={data} filters={filters} setFilters={setFilters} onApplyFilters={() => setAppliedFilters(filters)} onResetFilters={() => { setFilters({}); setAppliedFilters({}); }} filterLoading={loading} />;
    if (view === 'sessions') return <SessionsView data={data} onAction={handleAction} />;
    if (view === 'workers') return <WorkersView data={data} onAction={handleAction} />;
    if (view === 'realtime') return <RealtimeView data={data} onAction={handleAction} />;
    if (view === 'workspaceMap') return <WorkspaceMapView data={data} />;
    return <DashboardView data={data} onAction={handleAction} />;
  }

  return (
    <div className="cc-shell cc-shell--pro">
      <header className="cc-command-header">
        <div className="cc-command-header__main">
          <IconShell icon={Icon} toneName={tone(headerData.overall_status || data.overall_status || data.overall_worker_status || data.socket_status || 'healthy')} />
          <div><span className="cc-eyebrow">System Control Plane</span><h1>{config.title}</h1><p>{config.subtitle}</p></div>
        </div>
        <div className="cc-command-header__right">
          <Badge value={headerData.overall_status || data.overall_status || data.overall_worker_status || data.socket_status || 'healthy'} />
          <span>Checked {shortDate(headerData.checked_at || data.checked_at)}</span>
          <button type="button" className="cc-btn" onClick={load} disabled={loading || actionLoading}><RefreshCw size={16} className={loading ? 'cc-spin' : ''} />Làm mới</button>
          <button type="button" className="cc-btn cc-btn--primary" onClick={handleExportSnapshot} disabled={actionLoading}><Download size={16} />Snapshot</button>
        </div>
      </header>
      <CommandTabs current={view} />
      {error ? <div className="cc-message cc-message--error"><XCircle size={17} />{error}<button type="button" onClick={() => setError('')}><X size={15} /></button></div> : null}
      {notice ? <div className="cc-message cc-message--success"><CheckCircle2 size={17} />{notice}<button type="button" onClick={() => setNotice('')}><X size={15} /></button></div> : null}
      {view !== 'dashboard' && arr(bootstrap?.summary_cards).length ? <section className="cc-mini-strip">{bootstrap.summary_cards.slice(0, 8).map((item) => <Link key={item.key} to={item.route || '#'} className={`cc-mini-strip__item cc-mini-strip__item--${tone(item.status)}`}><span>{label(item.label)}</span><strong>{metricValue(item)}</strong></Link>)}</section> : null}
      {renderView()}
      <AdminActionConfirmDialog open={Boolean(confirmAction)} title={confirmAction?.title} description={confirmAction?.description} tone={confirmAction?.tone} confirmLabel={confirmAction?.confirmLabel} details={confirmAction?.details || []} reasonRequired={confirmAction?.reasonRequired} submitting={actionLoading} onCancel={() => setConfirmAction(null)} onConfirm={(reason) => executeAction(confirmAction.action, confirmAction.item, reason)} />
    </div>
  );
}
