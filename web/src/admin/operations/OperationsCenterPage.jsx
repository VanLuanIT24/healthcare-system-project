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
import { AdminActionConfirmDialog } from '../components/AdminActionConfirmDialog';
import { opsGet, opsPatch, opsPost } from './operationsApi';

const OPS_VIEWS = [
  { key: 'dashboard', path: '/admin/operations', title: 'Trung tâm vận hành', endpoint: '/dashboard', icon: ServerCog },
  { key: 'workerHealth', path: '/admin/operations/worker-health', title: 'Sức khỏe worker', endpoint: '/health', icon: Activity },
  { key: 'jobs', path: '/admin/operations/jobs', title: 'Tác vụ / worker', endpoint: '/jobs', icon: ServerCog },
  { key: 'jobRuns', path: '/admin/operations/job-runs', title: 'Nhật ký chạy tác vụ', endpoint: '/job-runs', icon: FileClock },
  { key: 'eventOutbox', path: '/admin/operations/event-outbox', title: 'Outbox sự kiện', endpoint: '/event-outbox', icon: Archive },
  { key: 'deadLetter', path: '/admin/operations/dead-letter', title: 'Sự kiện dead-letter', endpoint: '/dead-letter-events', icon: ShieldAlert },
  { key: 'retryEvent', path: '/admin/operations/retry-event', title: 'Chạy lại sự kiện', endpoint: '/health', icon: RefreshCw },
  { key: 'notificationDelivery', path: '/admin/operations/notification-delivery', title: 'Gửi thông báo', endpoint: '/notification-deliveries', icon: BellRing },
  { key: 'notificationFailed', path: '/admin/operations/notification-failed', title: 'Thông báo lỗi', endpoint: '/notification-failures/groups', icon: AlertTriangle },
  { key: 'realtime', path: '/admin/operations/realtime', title: 'Trạng thái thời gian thực', endpoint: '/realtime/status', icon: Wifi },
  { key: 'socketPresence', path: '/admin/operations/socket-presence', title: 'Hiện diện socket', endpoint: '/socket-presence', icon: RadioTower },
  { key: 'idempotency', path: '/admin/operations/idempotency', title: 'Bản ghi idempotency', endpoint: '/idempotency-records', icon: Fingerprint },
  { key: 'qrTokens', path: '/admin/operations/qr-tokens', title: 'QR token', endpoint: '/qr-tokens', icon: ScanLine },
  { key: 'fileScans', path: '/admin/operations/file-scans', title: 'Trạng thái quét tệp', endpoint: '/file-scans', icon: HardDrive },
  { key: 'diagnostics', path: '/admin/operations/diagnostics', title: 'Chẩn đoán hệ thống', endpoint: '/diagnostics', icon: TerminalSquare },
  { key: 'maintenance', path: '/admin/operations/maintenance', title: 'Chế độ bảo trì', endpoint: '/maintenance', icon: SlidersHorizontal },
];

const TABLE_COLUMNS = {
  jobRuns: [
    ['status', 'Trạng thái'],
    ['job_name', 'Tên tác vụ'],
    ['queue_name', 'Hàng đợi'],
    ['job_id', 'Job ID'],
    ['attempt', 'Lần thử'],
    ['worker_id', 'Worker ID'],
    ['started_at', 'Bắt đầu'],
    ['duration_ms', 'Thời lượng'],
    ['records_processed', 'Bản ghi'],
    ['correlation_id', 'Correlation'],
    ['error_message', 'Lỗi'],
  ],
  eventOutbox: [
    ['status', 'Trạng thái'],
    ['event_type', 'Loại sự kiện'],
    ['aggregate_type', 'Aggregate'],
    ['aggregate_id', 'Aggregate ID'],
    ['occurred_at', 'Thời điểm phát sinh'],
    ['retry_count', 'Số lần thử lại'],
    ['next_retry_at', 'Lần thử tiếp theo'],
    ['last_error', 'Lỗi gần nhất'],
    ['correlation_id', 'Correlation'],
    ['published_channels', 'Kênh phát hành'],
  ],
  deadLetter: [
    ['event_type', 'Loại sự kiện'],
    ['aggregate_type', 'Aggregate'],
    ['retry_count', 'Số lần thử lại'],
    ['dead_letter_at', 'Vào dead-letter lúc'],
    ['last_error', 'Lỗi gần nhất'],
    ['correlation_id', 'Correlation'],
  ],
  notificationDelivery: [
    ['status', 'Trạng thái'],
    ['channel', 'Kênh'],
    ['provider', 'Nhà cung cấp'],
    ['notification_id', 'Notification ID'],
    ['attempt_count', 'Lần thử'],
    ['max_attempt_count', 'Tối đa'],
    ['next_attempt_at', 'Lần thử tiếp theo'],
    ['last_attempt_at', 'Lần thử gần nhất'],
    ['last_error', 'Lỗi gần nhất'],
    ['sent_at', 'Đã gửi lúc'],
    ['delivered_at', 'Đến nơi lúc'],
  ],
  socketPresence: [
    ['actor_type', 'Loại đối tượng'],
    ['actor_id', 'Actor ID'],
    ['socket_count', 'Sockets'],
    ['rooms', 'Rooms'],
    ['last_seen_at', 'Thấy lần cuối'],
    ['expires_at', 'Hết hạn'],
  ],
  idempotency: [
    ['status', 'Trạng thái'],
    ['key', 'Khóa'],
    ['actor_type', 'Actor'],
    ['route', 'Route'],
    ['method', 'Method'],
    ['status_code', 'Mã trạng thái'],
    ['created_at', 'Tạo lúc'],
    ['expires_at', 'Hết hạn'],
    ['locked_at', 'Khóa lúc'],
    ['request_hash', 'Hash request'],
  ],
  qrTokens: [
    ['type', 'Loại'],
    ['target_type', 'Đối tượng'],
    ['target_id', 'Target ID'],
    ['actor_type', 'Actor'],
    ['created_at', 'Tạo lúc'],
    ['expires_at', 'Hết hạn'],
    ['used_at', 'Dùng lúc'],
    ['revoked_at', 'Thu hồi lúc'],
    ['token_preview', 'Token'],
  ],
  fileScans: [
    ['scan_status', 'Quét'],
    ['file_name', 'Tên tệp'],
    ['entity_type', 'Thực thể'],
    ['entity_id', 'Entity ID'],
    ['uploaded_by', 'Người tải lên'],
    ['source', 'Nguồn'],
    ['mime_type', 'Mime'],
    ['file_size', 'Dung lượng'],
    ['storage_provider', 'Nhà cung cấp'],
    ['created_at', 'Vào hàng đợi'],
  ],
};

const VALUE_LABELS = {
  unknown: 'Không rõ',
  critical: 'Nghiêm trọng',
  degraded: 'Suy giảm',
  healthy: 'Ổn định',
  success: 'Thành công',
  failed: 'Lỗi',
  pending: 'Chờ xử lý',
  processing: 'Đang xử lý',
  running: 'Đang chạy',
  scheduled: 'Đã lên lịch',
  skipped: 'Bỏ qua',
  completed: 'Hoàn tất',
  published: 'Đã phát hành',
  sent: 'Đã gửi',
  delivered: 'Đến nơi',
  clean: 'Sạch',
  infected: 'Nhiễm mã độc',
  active: 'Đang hoạt động',
  inactive: 'Ngưng hoạt động',
  revoked: 'Đã thu hồi',
  on: 'Bật',
  off: 'Tắt',
  available: 'Khả dụng',
  configured: 'Đã cấu hình',
  dead_letter: 'Dead-letter',
  retry_original: 'Thử lại sự kiện gốc',
  replay_new: 'Phát lại thành sự kiện mới',
  dry_run: 'Chạy thử',
  emit: 'Phát sự kiện',
  global: 'Toàn hệ thống',
  patient_portal: 'Cổng bệnh nhân',
  billing: 'Viện phí',
  clinical: 'Lâm sàng',
  pharmacy: 'Dược',
  scheduling: 'Lịch khám',
  admin: 'Quản trị',
  realtime: 'Thời gian thực',
  payment_provider: 'Nhà cung cấp thanh toán',
  file_upload: 'Tải tệp',
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
  const text = String(value || 'unknown').toLowerCase();
  if (VALUE_LABELS[text]) return VALUE_LABELS[text];
  return String(value || 'Không rõ').replace(/_/g, ' ');
}

function rowId(row) {
  if (!row || typeof row !== 'object') return '';
  return row.id || row._id || row.event_id || row.run_id || row.group_key || row.key || row.token || row.socket_id || row.room || row.job_name || row.check_name || row.scope || '';
}

function opsActionCopy(action, row = {}, view = '') {
  const copies = {
    'job.run': ['Chạy tác vụ ngay?', 'Tác vụ sẽ được đưa vào hàng đợi chạy ngay lập tức.', 'Chạy ngay', 'warning', false],
    'job.retry': ['Thử lại lần chạy tác vụ?', 'Hệ thống sẽ tạo lượt retry cho job run đã chọn.', 'Thử lại', 'warning', false],
    'event.retry': ['Thử lại sự kiện?', 'Sự kiện outbox sẽ được dispatch lại. Hãy chắc chắn lỗi gốc đã được xử lý.', 'Thử lại sự kiện', 'warning', false],
    'event.replay': ['Phát lại sự kiện?', 'Hệ thống sẽ tạo luồng phát lại mới cho sự kiện đã chọn.', 'Phát lại', 'warning', true],
    'event.unlock': ['Mở khóa sự kiện?', 'Bản ghi event đang khóa sẽ được mở để hệ thống có thể xử lý tiếp.', 'Mở khóa', 'warning', true],
    'delivery.retry': ['Thử gửi lại thông báo?', 'Thông báo sẽ được đưa vào hàng đợi gửi lại.', 'Thử gửi lại', 'warning', false],
    'delivery.skip': ['Bỏ qua lượt gửi?', 'Thông báo này sẽ được đánh dấu bỏ qua trong nhật ký vận hành.', 'Bỏ qua', 'danger', true],
    'failure.retry': ['Thử lại nhóm thông báo lỗi?', 'Toàn bộ nhóm lỗi được chọn sẽ được đưa vào luồng xử lý lại.', 'Thử lại nhóm', 'warning', false],
    'socket.disconnect': ['Ngắt kết nối socket?', 'Socket đang chọn sẽ bị ngắt kết nối ngay.', 'Ngắt kết nối', 'danger', true],
    'idempotency.unlock': ['Mở khóa idempotency?', 'Khóa idempotency sẽ được mở để request liên quan có thể xử lý lại.', 'Mở khóa', 'warning', true],
    'idempotency.expire': ['Cho hết hạn idempotency?', 'Bản ghi idempotency sẽ được đánh dấu hết hạn.', 'Cho hết hạn', 'danger', true],
    'qr.revoke': ['Thu hồi QR token?', 'QR token sẽ không còn hợp lệ sau khi xác nhận.', 'Thu hồi', 'danger', true],
    'file.rescan': ['Quét lại tệp?', 'Tệp sẽ được đưa vào hàng đợi quét bảo mật lại.', 'Quét lại', 'warning', false],
    'file.quarantine': ['Cách ly tệp?', 'Tệp sẽ bị đưa vào trạng thái cách ly để chặn sử dụng.', 'Cách ly', 'danger', true],
    'maintenance.start': ['Bắt đầu chế độ bảo trì?', 'Phạm vi đã chọn sẽ chuyển sang chế độ bảo trì và có thể ảnh hưởng người dùng.', 'Bắt đầu bảo trì', 'danger', true],
    'maintenance.end': ['Kết thúc bảo trì?', 'Quy tắc bảo trì đang hoạt động sẽ được kết thúc.', 'Kết thúc bảo trì', 'warning', true],
    'realtime.test': ['Gửi sự kiện thời gian thực thử?', 'Hệ thống sẽ phân giải room và có thể phát sự kiện thử nghiệm theo cấu hình.', 'Gửi thử', 'warning', false],
    retryConsole: ['Thực thi chạy lại sự kiện?', 'Bảng chạy lại sẽ gọi endpoint retry/replay theo preview hiện tại.', 'Thực thi', 'danger', true],
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
      { label: 'Màn hình', value: OPS_VIEWS.find((item) => item.key === view)?.title || 'Trung tâm vận hành' },
      { label: 'Đối tượng', value: row?.job_name || row?.event_type || row?.file_name || row?.group_key || rowId(row) || 'Theo biểu mẫu hiện tại' },
      { label: 'ID', value: rowId(row) || row?.event_id || '-' },
    ],
  };
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
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
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
        <span>Thao tác</span>
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
              <IconButton icon={Eye} label="Xem chi tiết" onClick={(event) => { event.stopPropagation(); onSelect(row); }} />
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
          <small>Bản ghi đã chọn</small>
          <strong>{rowId(item) || item.event_type || item.job_name || item.channel || 'Bản ghi'}</strong>
        </div>
        <IconButton icon={XCircle} label="Đóng" onClick={onClose} />
      </div>
      <div className="ops-drawer__quick">
        {item.status || item.scan_status ? <StatusBadge value={item.status || item.scan_status} /> : null}
        {item.correlation_id ? <span>{item.correlation_id}</span> : null}
        {item.event_type ? <span>{item.event_type}</span> : null}
      </div>
      {item.error_stack ? (
        <section className="ops-drawer__section">
          <h3>Stack lỗi</h3>
          <pre className="ops-stack">{item.error_stack}</pre>
        </section>
      ) : null}
      {item.last_error || item.error_message ? (
        <section className="ops-drawer__section">
          <h3>Lỗi</h3>
          <p>{item.last_error || item.error_message}</p>
        </section>
      ) : null}
      <section className="ops-drawer__section">
        <h3>JSON gốc</h3>
        <JsonViewer value={item} />
      </section>
    </aside>
  );
}

function OpsFilterBar({ filters, setFilters, search, setSearch, timeRange, setTimeRange, onApply, onReset, loading = false }) {
  return (
    <section className="ops-filterbar">
      <label>
        <Search size={16} strokeWidth={2.25} aria-hidden="true" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onApply?.();
          }}
          placeholder="event_id, job_id, correlation_id, actor_id, QR token..."
        />
      </label>
      <select value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
        <option value="">Trạng thái</option>
        <option value="pending">Chờ xử lý</option>
        <option value="processing">Đang xử lý</option>
        <option value="failed">Lỗi</option>
        <option value="dead_letter">Dead-letter</option>
        <option value="success">Thành công</option>
        <option value="delivered">Đến nơi</option>
        <option value="clean">Sạch</option>
        <option value="infected">Nhiễm mã độc</option>
      </select>
      <select value={timeRange} onChange={(event) => setTimeRange(event.target.value)}>
        <option value="1h">1 giờ</option>
        <option value="24h">24 giờ</option>
        <option value="7d">7 ngày</option>
        <option value="all">Tất cả</option>
      </select>
      <button type="button" onClick={onApply} disabled={loading}>
        <Search size={16} strokeWidth={2.25} aria-hidden="true" />
        <span>Áp dụng</span>
      </button>
      <button type="button" onClick={onReset} disabled={loading}>
        <ListFilter size={16} strokeWidth={2.25} aria-hidden="true" />
        <span>Xóa lọc</span>
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
      { label: 'Điểm sức khỏe', value: health?.score ?? data?.health?.score ?? 0, tone: statusTone(health?.status || data?.health?.status), icon: Gauge },
      { label: 'Outbox lỗi', value: formatNumber(data?.event_outbox?.statuses?.failed), tone: 'critical', icon: Archive },
      { label: 'Dead-letter', value: formatNumber(data?.event_outbox?.statuses?.dead_letter), tone: 'critical', icon: ShieldAlert },
      { label: 'Gửi thất bại', value: formatNumber(data?.notification_delivery?.statuses?.failed), tone: 'warning', icon: BellRing },
      { label: 'Đối tượng online', value: formatNumber(data?.realtime?.online_actors), tone: 'healthy', icon: RadioTower },
      { label: 'Tác vụ lỗi 24h', value: formatNumber(data?.jobs?.summary?.failed_jobs_24h), tone: 'warning', icon: FileClock },
    ];
  }
  if (view === 'workerHealth' || view === 'retryEvent') {
    return [
      { label: 'Outbox chờ xử lý', value: formatNumber(counters.outbox?.pending), tone: 'warning', icon: Archive },
      { label: 'Outbox lỗi', value: formatNumber(counters.outbox?.failed), tone: 'critical', icon: AlertTriangle },
      { label: 'Sự kiện dead-letter', value: formatNumber(counters.outbox?.dead_letter), tone: 'critical', icon: ShieldAlert },
      { label: 'Thông báo chờ gửi', value: formatNumber(counters.notification_delivery?.pending), tone: 'warning', icon: BellRing },
      { label: 'Thông báo lỗi', value: formatNumber(counters.notification_delivery?.failed), tone: 'critical', icon: BellRing },
      { label: 'Chế độ worker', value: readable(health?.mode), tone: health?.mode === 'bullmq' ? 'healthy' : 'neutral', icon: Router },
    ];
  }
  if (view === 'jobs') {
    return [
      { label: 'Tổng tác vụ', value: formatNumber(data?.summary?.total_jobs), tone: 'neutral', icon: ServerCog },
      { label: 'Tác vụ đang bật', value: formatNumber(data?.summary?.enabled_jobs), tone: 'healthy', icon: CheckCircle2 },
      { label: 'Lỗi 24h', value: formatNumber(data?.summary?.failed_jobs_24h), tone: 'critical', icon: AlertTriangle },
      { label: 'Chế độ hàng đợi', value: readable(data?.mode), tone: data?.mode === 'bullmq' ? 'healthy' : 'neutral', icon: Router },
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
      { label: 'Lượt gửi lỗi', value: formatNumber(data?.summary?.total_failed), tone: 'critical', icon: BellRing },
      { label: 'Nhóm lỗi', value: formatNumber(data?.summary?.total_groups), tone: 'warning', icon: AlertTriangle },
      { label: 'Email lỗi', value: formatNumber(data?.summary?.email_failed), tone: 'warning', icon: BellRing },
      { label: 'Push lỗi', value: formatNumber(data?.summary?.push_failed), tone: 'warning', icon: BellRing },
      { label: 'Socket lỗi', value: formatNumber(data?.summary?.socket_failed), tone: 'warning', icon: RadioTower },
    ];
  }
  if (view === 'realtime') {
    return [
      { label: 'Socket server', value: readable(data?.socket_status), tone: data?.socket_status === 'available' ? 'healthy' : 'critical', icon: Wifi },
      { label: 'Socket đang kết nối', value: formatNumber(data?.connected_sockets), tone: 'healthy', icon: RadioTower },
      { label: 'Phòng đang hoạt động', value: formatNumber(data?.active_rooms), tone: 'neutral', icon: Database },
      { label: 'Nhân sự online', value: formatNumber(data?.online_staff), tone: 'healthy', icon: Activity },
      { label: 'Redis adapter', value: readable(data?.redis_adapter_status), tone: data?.redis_adapter_status === 'configured' ? 'healthy' : 'neutral', icon: Router },
    ];
  }
  if (view === 'socketPresence') {
    return [
      { label: 'Đối tượng online', value: formatNumber(data?.summary?.online_actors), tone: 'healthy', icon: RadioTower },
      { label: 'Nhân sự online', value: formatNumber(data?.summary?.online_staff), tone: 'healthy', icon: Activity },
      { label: 'Bệnh nhân online', value: formatNumber(data?.summary?.online_patients), tone: 'healthy', icon: Activity },
      { label: 'Tổng socket', value: formatNumber(data?.summary?.total_sockets), tone: 'neutral', icon: Wifi },
      { label: 'Presence cũ', value: formatNumber(data?.summary?.stale_presence), tone: 'warning', icon: Clock3 },
    ];
  }
  if (view === 'idempotency') {
    const stats = data?.summary?.statuses || {};
    return [
      { label: 'Đang xử lý', value: formatNumber(stats.processing), tone: 'warning', icon: Fingerprint },
      { label: 'Hoàn tất', value: formatNumber(stats.completed), tone: 'healthy', icon: CheckCircle2 },
      { label: 'Lỗi', value: formatNumber(stats.failed), tone: 'critical', icon: AlertTriangle },
      { label: 'Bị kẹt', value: formatNumber(data?.summary?.stuck_processing), tone: 'critical', icon: LockKeyhole },
      { label: 'Sắp hết hạn', value: formatNumber(data?.summary?.expired_soon), tone: 'warning', icon: Clock3 },
    ];
  }
  if (view === 'qrTokens') {
    return [
      { label: 'Token đang hoạt động', value: formatNumber(data?.summary?.active), tone: 'healthy', icon: ScanLine },
      { label: 'Token hết hạn', value: formatNumber(data?.summary?.expired), tone: 'warning', icon: Clock3 },
      { label: 'Token đã dùng', value: formatNumber(data?.summary?.used), tone: 'neutral', icon: CheckCircle2 },
      { label: 'Token đã thu hồi', value: formatNumber(data?.summary?.revoked), tone: 'critical', icon: ShieldAlert },
      { label: 'Xác minh 15p', value: formatNumber(data?.summary?.verify_requests_last_15m), tone: 'neutral', icon: Eye },
    ];
  }
  if (view === 'fileScans') {
    const stats = data?.summary?.statuses || {};
    return [
      { label: 'Chờ quét', value: formatNumber(stats.pending), tone: 'warning', icon: HardDrive },
      { label: 'Sạch', value: formatNumber(stats.clean), tone: 'healthy', icon: CheckCircle2 },
      { label: 'Nhiễm mã độc', value: formatNumber(stats.infected), tone: 'critical', icon: ShieldAlert },
      { label: 'Lỗi', value: formatNumber(stats.failed), tone: 'critical', icon: AlertTriangle },
      { label: 'Bỏ qua', value: formatNumber(stats.skipped), tone: 'warning', icon: Eye },
      { label: 'Nhà cung cấp', value: readable(data?.summary?.provider_health?.provider), tone: data?.summary?.provider_health?.manual_mode ? 'warning' : 'healthy', icon: ScanLine },
    ];
  }
  if (view === 'diagnostics') {
    const runs = data?.last_runs || data?.items || [];
    return [
      { label: 'Bài kiểm tra', value: formatNumber(data?.checks?.length), tone: 'neutral', icon: TerminalSquare },
      { label: 'Lần chạy gần nhất', value: formatNumber(runs.length), tone: 'neutral', icon: FileClock },
      { label: 'Phát hiện nghiêm trọng', value: formatNumber(runs[0]?.critical_count), tone: 'critical', icon: ShieldAlert },
      { label: 'Cảnh báo', value: formatNumber(runs[0]?.warning_count), tone: 'warning', icon: AlertTriangle },
    ];
  }
  if (view === 'maintenance') {
    return [
      { label: 'Bảo trì', value: readable(data?.status || 'off'), tone: data?.status === 'on' ? 'warning' : 'healthy', icon: SlidersHorizontal },
      { label: 'Cửa sổ đang bật', value: formatNumber(data?.active?.length), tone: data?.active?.length ? 'warning' : 'healthy', icon: Clock3 },
      { label: 'Cửa sổ gần đây', value: formatNumber(data?.recent?.length), tone: 'neutral', icon: FileClock },
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
    ['job_name', 'Tên tác vụ'],
    ['domain', 'Domain'],
    ['queue_name', 'Hàng đợi'],
    ['schedule', 'Lịch chạy'],
    ['enabled', 'Đang bật'],
    ['success_rate', 'Tỷ lệ thành công'],
    ['avg_duration_ms', 'Thời lượng TB'],
    ['failed_runs', 'Lỗi'],
  ];
  if (view === 'notificationFailed') return [
    ['channel', 'Kênh'],
    ['provider', 'Nhà cung cấp'],
    ['last_error', 'Lỗi'],
    ['count', 'Số lượng'],
    ['affected_notifications', 'Bị ảnh hưởng'],
    ['first_seen_at', 'Thấy đầu tiên'],
    ['last_seen_at', 'Thấy gần nhất'],
    ['suggested_fix', 'Gợi ý xử lý'],
  ];
  if (view === 'realtime') return [
    ['room', 'Room'],
    ['type', 'Loại'],
    ['socket_count', 'Sockets'],
    ['last_activity_at', 'Hoạt động gần nhất'],
  ];
  if (view === 'diagnostics') return [
    ['status', 'Trạng thái'],
    ['run_id', 'Run ID'],
    ['check_name', 'Bài kiểm tra'],
    ['started_at', 'Bắt đầu'],
    ['duration_ms', 'Thời lượng'],
    ['findings_count', 'Phát hiện'],
    ['critical_count', 'Nghiêm trọng'],
    ['warning_count', 'Cảnh báo'],
  ];
  if (view === 'maintenance') return [
    ['status', 'Trạng thái'],
    ['scope', 'Phạm vi'],
    ['message', 'Thông báo'],
    ['starts_at', 'Bắt đầu'],
    ['ends_at', 'Kết thúc'],
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
  const [appliedFilters, setAppliedFilters] = useState({});
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedTimeRange, setAppliedTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
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
    payload_json: '{\n  "message": "Kiểm thử trung tâm vận hành"\n}',
    dry_run: true,
  });

  const requestParams = useMemo(() => ({
    ...appliedFilters,
    ...(view === 'dashboard' || view === 'workerHealth' || view === 'retryEvent' || view === 'diagnostics' || view === 'maintenance' ? {} : timeRangeParams(appliedTimeRange)),
    search: appliedSearch,
    limit: 50,
  }), [appliedFilters, appliedSearch, appliedTimeRange, view]);

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

  function applyFilters() {
    setAppliedFilters(filters);
    setAppliedSearch(search);
    setAppliedTimeRange(timeRange);
  }

  function resetFilters() {
    setFilters({});
    setSearch('');
    setTimeRange('24h');
    setAppliedFilters({});
    setAppliedSearch('');
    setAppliedTimeRange('24h');
  }

  function runAction(action, row = selected) {
    if (!row && !['diagnostics.run', 'maintenance.start', 'realtime.test'].includes(action)) return;
    const copy = opsActionCopy(action, row, view);
    if (copy && action !== 'copy') {
      setConfirmAction({ action, row, ...copy });
      return;
    }
    executeAction(action, row).catch((actionError) => setError(actionError.message));
  }

  async function executeAction(action, row = selected, reason = '') {
    if (!row && !['diagnostics.run', 'maintenance.start', 'realtime.test'].includes(action)) return;
    setActionLoading(true);
    setError('');
    try {
      const id = rowId(row);
      if (action === 'copy') await navigator.clipboard?.writeText(String(id || ''));
      if (action === 'job.run') await opsPost(`/jobs/${encodeURIComponent(row.job_name)}/run-now`, { reason: reason || 'Chạy từ trung tâm vận hành' });
      if (action === 'job.retry') await opsPost(`/job-runs/${encodeURIComponent(id)}/retry`, { reason: reason || 'Thử lại từ trung tâm vận hành' });
      if (action === 'event.retry') await opsPost(`/event-outbox/${encodeURIComponent(id)}/retry`, { reason: reason || 'Thử lại từ trung tâm vận hành', dispatch_now: true });
      if (action === 'event.replay') await opsPost(`/event-outbox/${encodeURIComponent(id)}/replay`, { reason: reason || 'Phát lại từ trung tâm vận hành', dispatch_now: false });
      if (action === 'event.unlock') await opsPost(`/event-outbox/${encodeURIComponent(id)}/unlock`, { reason: reason || 'Mở khóa từ trung tâm vận hành' });
      if (action === 'delivery.retry') await opsPost(`/notification-deliveries/${encodeURIComponent(id)}/retry`, { reason: reason || 'Thử gửi lại từ trung tâm vận hành', dispatch_now: true });
      if (action === 'delivery.skip') await opsPost(`/notification-deliveries/${encodeURIComponent(id)}/mark-skipped`, { reason: reason || 'Bỏ qua từ trung tâm vận hành' });
      if (action === 'failure.retry') await opsPost(`/notification-failures/groups/${encodeURIComponent(row.group_key)}/retry`, { reason: reason || 'Thử lại nhóm lỗi từ trung tâm vận hành' });
      if (action === 'socket.disconnect') await opsPost(`/socket-presence/${encodeURIComponent(row.socket_ids?.[0] || row.socket_id || id)}/disconnect`, { reason: reason || 'Ngắt kết nối từ trung tâm vận hành' });
      if (action === 'idempotency.unlock') await opsPost(`/idempotency-records/${encodeURIComponent(id)}/unlock`, { reason: reason || 'Mở khóa từ trung tâm vận hành' });
      if (action === 'idempotency.expire') await opsPost(`/idempotency-records/${encodeURIComponent(id)}/expire`, { reason: reason || 'Cho hết hạn từ trung tâm vận hành' });
      if (action === 'qr.revoke') await opsPost(`/qr-tokens/${encodeURIComponent(id)}/revoke`, { reason: reason || 'Thu hồi từ trung tâm vận hành' });
      if (action === 'file.rescan') await opsPost('/file-scans/bulk-rescan', { attachment_ids: [id], reason: reason || 'Quét lại từ trung tâm vận hành' });
      if (action === 'file.quarantine') await opsPost('/file-scans/bulk-quarantine', { attachment_ids: [id], reason: reason || 'Cách ly từ trung tâm vận hành' });
      if (action === 'diagnostics.run') {
        const result = await opsPost('/diagnostics/run', { check_name: diagnosticCheck });
        setSelected(result.runs?.[0] || null);
      }
      if (action === 'maintenance.start') await opsPost('/maintenance/start', { ...maintenanceForm, reason: reason || maintenanceForm.reason });
      if (action === 'maintenance.end') await opsPost(`/maintenance/${encodeURIComponent(id)}/end`, { reason: reason || 'Kết thúc từ trung tâm vận hành' });
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
      setConfirmAction(null);
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

  function requestRetryConsole() {
    const copy = opsActionCopy('retryConsole', { event_id: retryForm.event_id, event_type: retryForm.mode }, view);
    setConfirmAction({ action: 'retryConsole', row: { event_id: retryForm.event_id, event_type: retryForm.mode }, ...copy });
  }

  async function executeRetryConsole(reason = '') {
    setActionLoading(true);
    setError('');
    try {
      const path = retryForm.mode === 'replay_new' ? '/events/replay' : '/events/retry';
      const result = await opsPost(path, { ...retryForm, reason: reason || retryForm.reason });
      setSelected(result.event || result.replayed_event || result);
      setRetryPreview(result);
      setConfirmAction(null);
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
    if (view === 'jobs') return <IconButton icon={PlayCircle} label="Chạy ngay" onClick={(event) => { event.stopPropagation(); runAction('job.run', row); }} disabled={actionLoading} />;
    if (view === 'jobRuns') return <IconButton icon={RefreshCw} label="Thử lại tác vụ" onClick={(event) => { event.stopPropagation(); runAction('job.retry', row); }} disabled={actionLoading} />;
    if (['eventOutbox', 'deadLetter'].includes(view)) return <IconButton icon={RefreshCw} label="Thử lại sự kiện" onClick={(event) => { event.stopPropagation(); runAction('event.retry', row); }} disabled={actionLoading} />;
    if (view === 'notificationDelivery') return <IconButton icon={RefreshCw} label="Thử gửi lại" onClick={(event) => { event.stopPropagation(); runAction('delivery.retry', row); }} disabled={actionLoading} />;
    if (view === 'notificationFailed') return <IconButton icon={RefreshCw} label="Thử lại nhóm lỗi" onClick={(event) => { event.stopPropagation(); runAction('failure.retry', row); }} disabled={actionLoading} />;
    if (view === 'idempotency') return <IconButton icon={LockKeyhole} label="Mở khóa" onClick={(event) => { event.stopPropagation(); runAction('idempotency.unlock', row); }} disabled={actionLoading} />;
    if (view === 'qrTokens') return <IconButton icon={ShieldAlert} label="Thu hồi" onClick={(event) => { event.stopPropagation(); runAction('qr.revoke', row); }} disabled={actionLoading} />;
    if (view === 'fileScans') return <IconButton icon={ScanLine} label="Quét lại" onClick={(event) => { event.stopPropagation(); runAction('file.rescan', row); }} disabled={actionLoading} />;
    if (view === 'maintenance' && row.status === 'active') return <IconButton icon={XCircle} label="Kết thúc bảo trì" onClick={(event) => { event.stopPropagation(); runAction('maintenance.end', row); }} disabled={actionLoading} />;
    return null;
  }

  function renderDashboard() {
    const health = data?.health || {};
    return (
      <>
        <section className="ops-health-hero">
          <div>
            <small>Trạng thái tổng thể hệ thống</small>
            <strong>{readable(health.status)}</strong>
            <span>Điểm {health.score || 0}/100 • {readable(health.mode)}</span>
          </div>
          <div className="ops-health-ring">
            <strong>{health.score || 0}</strong>
            <span>sức khỏe</span>
          </div>
        </section>
        <section className="ops-grid ops-grid--two">
          <div className="ops-panel">
            <PanelTitle icon={Activity} title="Ma trận thành phần" meta={`${health.components?.length || 0} thành phần`} />
            <ComponentMatrix items={health.components || []} onSelect={setSelected} />
          </div>
          <div className="ops-panel">
            <PanelTitle icon={Archive} title="Heatmap loại sự kiện" meta={`${data?.event_outbox?.event_types?.length || 0} nhóm`} />
            <Heatmap items={data?.event_outbox?.event_types || []} />
          </div>
        </section>
        <section className="ops-panel">
          <PanelTitle icon={FileClock} title="Lần chạy tác vụ gần đây" meta={`${health.recent_job_runs?.length || 0} dòng`} />
          <DataTable rows={health.recent_job_runs || []} columns={TABLE_COLUMNS.jobRuns.slice(0, 8)} selected={selected} onSelect={setSelected} actionSlot={actionSlot} />
        </section>
      </>
    );
  }

  function renderWorkerHealth() {
    return (
      <section className="ops-grid ops-grid--two">
        <div className="ops-panel">
          <PanelTitle icon={Activity} title="Ma trận sức khỏe thành phần" meta={readable(data?.status)} />
          <ComponentMatrix items={data?.components || []} onSelect={setSelected} />
        </div>
        <div className="ops-panel">
          <PanelTitle icon={FileClock} title="Bảng lần chạy tác vụ gần đây" meta={`${data?.recent_job_runs?.length || 0} dòng`} />
          <DataTable rows={data?.recent_job_runs || []} columns={TABLE_COLUMNS.jobRuns.slice(0, 8)} selected={selected} onSelect={setSelected} actionSlot={actionSlot} />
        </div>
      </section>
    );
  }

  function renderJobs() {
    return (
      <>
        <section className="ops-panel">
          <PanelTitle icon={ServerCog} title="Sổ đăng ký tác vụ" meta={`${data?.registry?.length || 0} tác vụ`} />
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
                <div><dt>Đang chờ</dt><dd>{formatNumber(queue.waiting)}</dd></div>
                <div><dt>Đang chạy</dt><dd>{formatNumber(queue.active)}</dd></div>
                <div><dt>Lỗi</dt><dd>{formatNumber(queue.failed)}</dd></div>
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
          <PanelTitle icon={RefreshCw} title="Bảng chạy lại" meta="Cần kiểm tra trước" />
          <label><span>Event ID</span><input value={retryForm.event_id} onChange={(event) => setRetryForm((current) => ({ ...current, event_id: event.target.value }))} /></label>
          <label><span>Chế độ chạy lại</span><select value={retryForm.mode} onChange={(event) => setRetryForm((current) => ({ ...current, mode: event.target.value }))}>
            <option value="retry_original">Thử lại sự kiện gốc</option>
            <option value="replay_new">Phát lại thành sự kiện mới</option>
            <option value="dry_run">Chạy thử dispatch</option>
          </select></label>
          <label><span>Lý do</span><textarea value={retryForm.reason} onChange={(event) => setRetryForm((current) => ({ ...current, reason: event.target.value }))} /></label>
          <label className="ops-checkbox"><input type="checkbox" checked={retryForm.dispatch_now} onChange={(event) => setRetryForm((current) => ({ ...current, dispatch_now: event.target.checked }))} /><span>Dispatch ngay</span></label>
          <div className="ops-form__actions">
            <ActionButton icon={Eye} label="Xem trước" onClick={previewRetryEvent} disabled={actionLoading || !retryForm.event_id} />
            <ActionButton icon={Send} label={retryForm.mode === 'replay_new' ? 'Phát lại sự kiện' : 'Thử lại sự kiện'} tone="primary" onClick={requestRetryConsole} disabled={actionLoading || !retryPreview} />
          </div>
        </form>
        <div className="ops-panel">
          <PanelTitle icon={ShieldAlert} title="Bảng kiểm tra trước" meta={retryPreview?.precheck?.side_effect_risk || 'đang chờ'} />
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
            <PanelTitle icon={RadioTower} title="Bảng kiểm thử thời gian thực" meta={realtimeForm.dry_run ? 'dry-run' : 'emit'} />
            <label><span>Tên sự kiện</span><input value={realtimeForm.event_name} onChange={(event) => setRealtimeForm((current) => ({ ...current, event_name: event.target.value }))} /></label>
            <label><span>Scope JSON</span><textarea value={realtimeForm.scope_json} onChange={(event) => setRealtimeForm((current) => ({ ...current, scope_json: event.target.value }))} /></label>
            <label><span>Payload JSON</span><textarea value={realtimeForm.payload_json} onChange={(event) => setRealtimeForm((current) => ({ ...current, payload_json: event.target.value }))} /></label>
            <label className="ops-checkbox"><input type="checkbox" checked={realtimeForm.dry_run} onChange={(event) => setRealtimeForm((current) => ({ ...current, dry_run: event.target.checked }))} /><span>Chạy thử phân giải room</span></label>
            <ActionButton icon={Send} label="Phân giải / gửi" tone="primary" onClick={() => runAction('realtime.test')} disabled={actionLoading} />
          </form>
          <div className="ops-panel">
            <PanelTitle icon={RadioTower} title="Theo dõi room" meta={`${data?.rooms?.length || 0} room`} />
            <DataTable rows={data?.rooms || []} columns={columns} selected={selected} onSelect={setSelected} />
          </div>
        </section>
        <section className="ops-panel">
          <PanelTitle icon={Activity} title="Theo dõi sự kiện thời gian thực" meta={`${data?.events_recent?.length || 0} sự kiện`} />
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
            <strong>Bộ chạy kiểm tra</strong>
            <span>{data?.checks?.length || 0} bài kiểm tra chẩn đoán đã đăng ký</span>
          </div>
          <select value={diagnosticCheck} onChange={(event) => setDiagnosticCheck(event.target.value)}>
            <option value="all">Chạy tất cả</option>
            {(data?.checks || []).map((check) => <option key={check.check_name} value={check.check_name}>{readable(check.check_name)}</option>)}
          </select>
          <ActionButton icon={PlayCircle} label="Chạy kiểm tra" tone="primary" onClick={() => runAction('diagnostics.run')} disabled={actionLoading} />
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
          <PanelTitle icon={FileClock} title="Lần chạy chẩn đoán" meta={`${data?.last_runs?.length || 0} lần chạy`} />
          <DataTable rows={data?.last_runs || []} columns={columns} selected={selected} onSelect={setSelected} />
        </section>
      </>
    );
  }

  function renderMaintenance() {
    return (
      <section className="ops-console-layout">
        <form className="ops-panel ops-form" onSubmit={(event) => { event.preventDefault(); runAction('maintenance.start'); }}>
          <PanelTitle icon={SlidersHorizontal} title="Tạo quy tắc" meta={readable(data?.status || 'off')} />
          <label><span>Phạm vi</span><select value={maintenanceForm.scope} onChange={(event) => setMaintenanceForm((current) => ({ ...current, scope: event.target.value }))}>
            {['global', 'patient_portal', 'billing', 'clinical', 'pharmacy', 'scheduling', 'admin', 'realtime', 'payment_provider', 'file_upload'].map((scope) => <option key={scope} value={scope}>{readable(scope)}</option>)}
          </select></label>
          <label><span>Thông báo</span><textarea value={maintenanceForm.message} onChange={(event) => setMaintenanceForm((current) => ({ ...current, message: event.target.value }))} /></label>
          <label><span>Dự kiến kết thúc</span><input type="datetime-local" onChange={(event) => setMaintenanceForm((current) => ({ ...current, ends_at: event.target.value ? new Date(event.target.value).toISOString() : undefined }))} /></label>
          <label className="ops-checkbox"><input type="checkbox" checked={maintenanceForm.allow_admin_bypass} onChange={(event) => setMaintenanceForm((current) => ({ ...current, allow_admin_bypass: event.target.checked }))} /><span>Cho phép admin bỏ qua</span></label>
          <label className="ops-checkbox"><input type="checkbox" checked={maintenanceForm.allow_webhooks} onChange={(event) => setMaintenanceForm((current) => ({ ...current, allow_webhooks: event.target.checked }))} /><span>Cho phép webhook bỏ qua</span></label>
          <label className="ops-checkbox"><input type="checkbox" checked={maintenanceForm.allow_emergency} onChange={(event) => setMaintenanceForm((current) => ({ ...current, allow_emergency: event.target.checked }))} /><span>Cho phép khẩn cấp bỏ qua</span></label>
          <ActionButton icon={PlayCircle} label="Bắt đầu bảo trì" tone="primary" onClick={() => runAction('maintenance.start')} disabled={actionLoading} />
        </form>
        <div className="ops-panel">
          <PanelTitle icon={Clock3} title="Bảng bảo trì đang bật" meta={`${data?.active?.length || 0} đang bật`} />
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
        <PanelTitle icon={config.icon} title={config.title} meta={`${rows.length} dòng`} />
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
            <small>Quản trị hệ thống / Trung tâm vận hành</small>
            <h1>{config.title}</h1>
          </div>
          <StatusBadge value={data?.health?.status || data?.status || data?.socket_status || 'unknown'} />
        </div>
        <div className="ops-header__meta">
          <span>Env {data?.health?.environment || data?.environment || 'local'}</span>
          <span>Kiểm tra lúc {formatDateTime(data?.checked_at || data?.health?.checked_at)}</span>
          {error ? <strong><XCircle size={16} strokeWidth={2.25} />{error}</strong> : null}
        </div>
        <div className="ops-header__actions">
          <label className="ops-autorefresh"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /><span>Tự làm mới</span></label>
          <ActionButton icon={RefreshCw} label="Làm mới" onClick={load} disabled={loading || actionLoading} />
        </div>
      </header>

      <nav className="ops-nav" aria-label="Màn hình vận hành">
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

      <OpsFilterBar
        filters={filters}
        setFilters={setFilters}
        search={search}
        setSearch={setSearch}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={loading}
      />

      <section className="ops-kpi-strip">
        {kpis.map((item) => <KpiCard key={`${item.label}-${item.value}`} {...item} />)}
      </section>

      {loading && !data ? (
        <div className="ops-loading"><RefreshCw size={22} strokeWidth={2.25} aria-hidden="true" />Đang tải trung tâm vận hành</div>
      ) : renderGeneric()}

      {selected ? (
        <div className="ops-command-bar">
          <ActionButton icon={Clipboard} label="Sao chép ID" onClick={() => runAction('copy')} />
          {['eventOutbox', 'deadLetter'].includes(view) ? <ActionButton icon={RefreshCw} label="Thử lại" tone="primary" onClick={() => runAction('event.retry')} disabled={actionLoading} /> : null}
          {['eventOutbox', 'deadLetter'].includes(view) ? <ActionButton icon={Archive} label="Phát lại" onClick={() => runAction('event.replay')} disabled={actionLoading} /> : null}
          {view === 'notificationDelivery' ? <ActionButton icon={RefreshCw} label="Thử gửi lại" tone="primary" onClick={() => runAction('delivery.retry')} disabled={actionLoading} /> : null}
          {view === 'idempotency' ? <ActionButton icon={LockKeyhole} label="Mở khóa" tone="primary" onClick={() => runAction('idempotency.unlock')} disabled={actionLoading} /> : null}
          {view === 'fileScans' ? <ActionButton icon={ScanLine} label="Quét lại" tone="primary" onClick={() => runAction('file.rescan')} disabled={actionLoading} /> : null}
          {view === 'qrTokens' ? <ActionButton icon={ShieldAlert} label="Thu hồi" tone="danger" onClick={() => runAction('qr.revoke')} disabled={actionLoading} /> : null}
        </div>
      ) : null}

      <DetailDrawer item={selected} onClose={() => setSelected(null)} />
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
        onConfirm={(reason) => (
          confirmAction?.action === 'retryConsole'
            ? executeRetryConsole(reason)
            : executeAction(confirmAction.action, confirmAction.row, reason)
        )}
      />
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
