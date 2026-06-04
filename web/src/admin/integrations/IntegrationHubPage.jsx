import {
  Activity,
  AlertTriangle,
  Banknote,
  BellRing,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  Download,
  Eye,
  FileClock,
  Gauge,
  Globe2,
  Landmark,
  Link2,
  Mail,
  Play,
  RadioTower,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Webhook,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminActionConfirmDialog } from '../components/AdminActionConfirmDialog';
import { integrationGet, integrationPost } from './integrationApi';

const VIEW_CONFIG = {
  overview: {
    title: 'Trung tâm tích hợp',
    subtitle: 'Điều phối thanh toán, thông báo, OAuth, webhook, sao kê ngân hàng và đối soát.',
    icon: Webhook,
    endpoint: '/summary',
  },
  emailProvider: {
    title: 'Nhà cung cấp email',
    subtitle: 'Gửi SMTP outbound, xử lý hàng đợi và khôi phục delivery lỗi.',
    icon: Mail,
    endpoint: '/email/deliveries',
    healthEndpoint: '/email/health',
    configEndpoint: '/email/config',
    channel: 'email',
  },
  pushProvider: {
    title: 'Nhà cung cấp push',
    subtitle: 'Cầu nối HTTP push, hợp đồng payload, thử lại và sức khỏe provider.',
    icon: Smartphone,
    endpoint: '/push/deliveries',
    healthEndpoint: '/push/health',
    configEndpoint: '/push/config',
    channel: 'push',
  },
  httpChannel: {
    title: 'Kênh thông báo HTTP',
    subtitle: 'Kênh HTTP outbound, hợp đồng payload và nhật ký gửi.',
    icon: Webhook,
    endpoint: '/providers/push_http/events',
    healthEndpoint: '/push/health',
    configEndpoint: '/push/config',
  },
  bankQr: {
    title: 'Nhà cung cấp Bank QR',
    subtitle: 'VietQR tĩnh, xác nhận thủ công và đối soát sao kê ngân hàng.',
    icon: Banknote,
    endpoint: '/bank-qr/intents',
    healthEndpoint: '/bank-qr/health',
    configEndpoint: '/bank-qr/config',
    provider: 'bank_qr',
  },
  momoQr: {
    title: 'MoMo QR cá nhân',
    subtitle: 'QR cá nhân tĩnh, rà soát biên nhận và xác nhận thủ công.',
    icon: Smartphone,
    endpoint: '/momo-personal-qr/intents',
    healthEndpoint: '/momo-personal-qr/health',
    configEndpoint: '/momo-personal-qr/config',
    provider: 'momo_personal_qr',
  },
  paymentWebhook: {
    title: 'Webhook thanh toán',
    subtitle: 'Callback inbound, xác minh chữ ký và xử lý lại.',
    icon: Link2,
    endpoint: '/payment-webhooks',
    provider: 'payment_webhook',
  },
  providerWebhookEvents: {
    title: 'Sự kiện webhook provider',
    subtitle: 'Tất cả sự kiện inbound từ provider, trạng thái xử lý và tương quan.',
    icon: FileClock,
    endpoint: '/provider-webhook-events',
    provider: 'payment_webhook',
  },
  bankTransactions: {
    title: 'Giao dịch sao kê ngân hàng',
    subtitle: 'Giao dịch đã nhập, ghi chú nhận diện, ứng viên và khớp đối soát.',
    icon: Landmark,
    endpoint: '/bank-statement-transactions',
    provider: 'reconciliation',
  },
  reconciliation: {
    title: 'Provider đối soát',
    subtitle: 'Bộ máy đối soát QR thủ công, lô xử lý, tự khớp và ngoại lệ.',
    icon: RefreshCw,
    endpoint: '/reconciliation/batches',
    healthEndpoint: '/reconciliation/overview',
    provider: 'reconciliation',
  },
  googleOAuth: {
    title: 'Google OAuth',
    subtitle: 'Cấu hình đăng nhập Google, chẩn đoán callback và giám sát đăng nhập.',
    icon: Globe2,
    endpoint: '/google-oauth/login-events',
    healthEndpoint: '/google-oauth/health',
    configEndpoint: '/google-oauth/config',
    provider: 'google_oauth',
  },
  health: {
    title: 'Sức khỏe tích hợp',
    subtitle: 'Độ đầy đủ cấu hình, trạng thái provider và rủi ro lỗi.',
    icon: Activity,
    endpoint: '/health',
  },
  logs: {
    title: 'Nhật ký tích hợp',
    subtitle: 'Tra cứu tập trung provider, webhook, delivery và chẩn đoán.',
    icon: FileClock,
    endpoint: '/logs',
  },
};

const NAV_ITEMS = [
  ['overview', 'Tổng quan', Webhook],
  ['emailProvider', 'Email', Mail],
  ['pushProvider', 'Push', Smartphone],
  ['httpChannel', 'Kênh HTTP', Webhook],
  ['bankQr', 'Bank QR', Banknote],
  ['momoQr', 'MoMo QR', Smartphone],
  ['paymentWebhook', 'Webhook thanh toán', Link2],
  ['providerWebhookEvents', 'Sự kiện webhook', FileClock],
  ['bankTransactions', 'Giao dịch ngân hàng', Landmark],
  ['reconciliation', 'Đối soát', RefreshCw],
  ['googleOAuth', 'Google OAuth', Globe2],
  ['health', 'Sức khỏe', Activity],
  ['logs', 'Nhật ký', FileClock],
];

const VALUE_LABELS = {
  healthy: 'Ổn định',
  success: 'Thành công',
  processed: 'Đã xử lý',
  sent: 'Đã gửi',
  delivered: 'Đã nhận',
  matched: 'Đã khớp',
  warning: 'Cảnh báo',
  pending: 'Chờ xử lý',
  received: 'Đã nhận',
  pending_manual_confirmation: 'Chờ xác nhận thủ công',
  submitted_receipt: 'Đã gửi biên nhận',
  manual_review: 'Cần rà soát',
  unmatched: 'Chưa khớp',
  disabled: 'Đã tắt',
  skipped: 'Đã bỏ qua',
  ignored: 'Đã bỏ qua',
  critical: 'Nghiêm trọng',
  failed: 'Lỗi',
  rejected: 'Từ chối',
  disputed: 'Có tranh chấp',
  email: 'Email',
  push: 'Push',
  provider: 'Provider',
  reconciliation: 'Đối soát',
  enabled: 'Đã bật',
  disabled_mode: 'Chế độ tắt',
  live: 'Đang chạy',
  test: 'Kiểm thử',
};

const STATUS_TONE = {
  healthy: 'success',
  success: 'success',
  processed: 'success',
  sent: 'success',
  delivered: 'success',
  matched: 'success',
  warning: 'warning',
  pending: 'warning',
  received: 'warning',
  pending_manual_confirmation: 'warning',
  submitted_receipt: 'warning',
  manual_review: 'danger',
  unmatched: 'warning',
  disabled: 'muted',
  skipped: 'muted',
  ignored: 'muted',
  critical: 'danger',
  failed: 'danger',
  rejected: 'danger',
  disputed: 'danger',
};

function getRowId(row = {}) {
  return row.id || row._id || row.code || row.provider || row.delivery_id || row.payment_intent_id || row.event_id || row.transaction_id || row.batch_no || row.run_id;
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('vi-VN') : '—';
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return new Date(value).toLocaleString('vi-VN');
  }
  if (value instanceof Date) return value.toLocaleString('vi-VN');
  if (typeof value === 'object') {
    return value.intent_code || value.invoice_no || value.payment_no || value.transaction_id || value.batch_no || value.title || value.name || JSON.stringify(value);
  }
  return VALUE_LABELS[String(value).toLowerCase()] || String(value).replace(/_/g, ' ');
}

function getNested(row, path) {
  return String(path || '').split('.').reduce((value, key) => (value ? value[key] : undefined), row);
}

function StatusBadge({ value }) {
  const text = value || 'unknown';
  const tone = STATUS_TONE[text] || STATUS_TONE[String(text).toLowerCase()] || 'neutral';
  return <span className={`ih-badge ih-badge--${tone}`}>{formatValue(text)}</span>;
}

function IconButton({ icon: Icon, label, onClick, disabled = false }) {
  return (
    <button type="button" className="ih-icon-button" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      <Icon size={16} strokeWidth={2.25} />
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, variant = 'default', disabled = false }) {
  return (
    <button type="button" className={`ih-action ih-action--${variant}`} onClick={onClick} disabled={disabled}>
      {Icon ? <Icon size={16} strokeWidth={2.25} aria-hidden="true" /> : null}
      <span>{label}</span>
    </button>
  );
}

function KpiCard({ label, value, tone = 'neutral', icon: Icon }) {
  return (
    <article className={`ih-kpi ih-kpi--${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{formatValue(value)}</strong>
      </div>
      {Icon ? <Icon size={20} strokeWidth={2.25} aria-hidden="true" /> : null}
    </article>
  );
}

function DataTable({ rows = [], columns = [], onOpen, actionSlot }) {
  const safeRows = rows.filter((row) => row && typeof row === 'object');
  const minWidth = Math.max(920, columns.length * 156 + 124);
  return (
    <div className="ih-table-wrap" style={{ '--ih-table-min': `${minWidth}px` }}>
      <table className="ih-table">
        <colgroup>
          {columns.map((column, index) => (
            <col key={column.key} style={{ width: column.width || (index === 0 ? '220px' : '156px') }} />
          ))}
          <col style={{ width: '124px' }} />
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}
            <th scope="col" className="ih-table__action-head">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {safeRows.length ? safeRows.map((row, index) => (
            <tr
              key={getRowId(row) || `${index}-${JSON.stringify(row).slice(0, 80)}`}
              onClick={() => onOpen(row)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onOpen(row);
              }}
            >
              {columns.map((column, colIndex) => {
                const value = column.render ? column.render(row) : getNested(row, column.key);
                return (
                  <td key={column.key} className={colIndex === 0 ? 'ih-table__primary' : ''} title={typeof value === 'object' ? undefined : String(formatValue(value))}>
                    {column.status ? <StatusBadge value={value} /> : formatValue(value)}
                  </td>
                );
              })}
              <td className="ih-table__actions" onClick={(event) => event.stopPropagation()}>
                {actionSlot ? actionSlot(row) : null}
                <IconButton icon={Eye} label="Xem chi tiết" onClick={() => onOpen(row)} />
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length + 1}>
                <div className="ih-empty">
                  <Database size={20} strokeWidth={2.25} />
                  <span>Không có dữ liệu phù hợp</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function JsonBlock({ value }) {
  return <pre className="ih-json">{JSON.stringify(value || {}, null, 2)}</pre>;
}

function DetailDrawer({ item, onClose, title = 'Chi tiết' }) {
  if (!item) return null;
  return (
    <aside className="ih-drawer">
      <div className="ih-drawer__head">
        <div>
          <span>{title}</span>
          <strong>{formatValue(item.name || item.title || item.intent_code || item.event_id || item.transaction_id || getRowId(item))}</strong>
        </div>
        <IconButton icon={X} label="Đóng" onClick={onClose} />
      </div>
      <div className="ih-drawer__grid">
        {Object.entries(item).slice(0, 14).map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{formatValue(value)}</strong>
          </div>
        ))}
      </div>
      <JsonBlock value={item.raw || item} />
    </aside>
  );
}

function ProviderMatrix({ providers = [], onOpen }) {
  const columns = [
    { key: 'name', label: 'Provider' },
    { key: 'type', label: 'Loại' },
    { key: 'enabled', label: 'Bật' },
    { key: 'configured', label: 'Cấu hình' },
    { key: 'health', label: 'Sức khỏe', status: true },
    { key: 'mode', label: 'Chế độ' },
    { key: 'kpi.pending', label: 'Chờ xử lý' },
    { key: 'kpi.failed', label: 'Lỗi' },
    { key: 'last_success_at', label: 'Thành công gần nhất' },
    { key: 'last_failure_at', label: 'Lỗi gần nhất' },
  ];
  return <DataTable rows={providers} columns={columns} onOpen={onOpen} />;
}

function ProviderCards({ providers = [], onOpen }) {
  return (
    <section className="ih-provider-grid">
      {providers.map((provider) => {
        const Icon = providerIcon(provider.code);
        return (
          <button type="button" className="ih-provider-card" key={provider.code} onClick={() => onOpen(provider)}>
            <div className="ih-provider-card__head">
              <span><Icon size={19} strokeWidth={2.25} />{provider.name}</span>
              <StatusBadge value={provider.health} />
            </div>
            <div className="ih-provider-card__metrics">
              <span>Chờ xử lý <strong>{formatValue(provider.kpi?.pending ?? provider.kpi?.unmatched ?? '—')}</strong></span>
              <span>Lỗi <strong>{formatValue(provider.kpi?.failed ?? provider.kpi?.disputed ?? '—')}</strong></span>
              <span>Chế độ <strong>{formatValue(provider.mode)}</strong></span>
            </div>
            <p>{recommendation(provider)}</p>
          </button>
        );
      })}
    </section>
  );
}

function providerIcon(code) {
  if (code === 'email_smtp') return Mail;
  if (code === 'push_http') return Smartphone;
  if (code === 'bank_qr') return Banknote;
  if (code === 'momo_personal_qr') return Smartphone;
  if (code === 'payment_webhook') return Link2;
  if (code === 'reconciliation') return RefreshCw;
  if (code === 'google_oauth') return Globe2;
  if (code === 'realtime_socket') return RadioTower;
  return Webhook;
}

function recommendation(provider = {}) {
  if (!provider.enabled) return 'Đang tắt';
  if (!provider.configured) return 'Thiếu cấu hình bắt buộc';
  if (provider.health === 'critical') return provider.last_error || 'Provider có lỗi nghiêm trọng';
  if (provider.health === 'warning') return 'Backlog hoặc hàng đợi rà soát cần xử lý';
  return 'Đang vận hành';
}

function FailureInbox({ items = [], onOpen }) {
  const columns = [
    { key: 'severity', label: 'Mức độ', status: true },
    { key: 'source', label: 'Nguồn' },
    { key: 'object', label: 'Đối tượng' },
    { key: 'error', label: 'Lỗi' },
    { key: 'age_at', label: 'Tuổi lỗi' },
    { key: 'action', label: 'Hành động' },
  ];
  return <DataTable rows={items} columns={columns} onOpen={onOpen} />;
}

function ConfigPanel({ config }) {
  const values = config?.values || {};
  return (
    <section className="ih-panel">
      <div className="ih-panel__head">
        <strong>Cấu hình đã che giá trị nhạy cảm</strong>
        <StatusBadge value={Object.values(values).every((item) => item?.configured !== false) ? 'healthy' : 'warning'} />
      </div>
      <div className="ih-config-grid">
        {Object.entries(values).map(([key, item]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{formatValue(item?.value ?? item)}</strong>
          </div>
        ))}
      </div>
      {config?.payload_contract ? <JsonBlock value={config.payload_contract} /> : null}
    </section>
  );
}

function PreviewConsole({ view, onRun, result }) {
  const [form, setForm] = useState({ amount: 100000, payment_note: 'BOYTE TEST', send: false });
  const isQr = view === 'bankQr' || view === 'momoQr';
  const isEmail = view === 'emailProvider';
  const isPush = view === 'pushProvider' || view === 'httpChannel';
  if (!isQr && !isEmail && !isPush) return null;
  return (
    <section className="ih-panel ih-console">
      <div className="ih-panel__head">
        <strong>{isQr ? 'Xem trước QR' : 'Kiểm thử provider'}</strong>
        <ActionButton icon={Play} label={isQr ? 'Xem trước' : 'Chạy kiểm thử'} onClick={() => onRun(form)} variant="primary" />
      </div>
      <div className="ih-console__form">
        {isQr ? (
          <>
            <label><span>Số tiền</span><input value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></label>
            <label><span>Nội dung thanh toán</span><input value={form.payment_note} onChange={(event) => setForm((current) => ({ ...current, payment_note: event.target.value }))} /></label>
          </>
        ) : null}
        {isEmail ? (
          <>
            <label><span>Người nhận</span><input placeholder="admin@example.com" value={form.to || ''} onChange={(event) => setForm((current) => ({ ...current, to: event.target.value }))} /></label>
            <label className="ih-toggle"><input type="checkbox" checked={Boolean(form.send)} onChange={(event) => setForm((current) => ({ ...current, send: event.target.checked }))} /><span>Gửi thật</span></label>
          </>
        ) : null}
        {isPush ? (
          <>
            <label><span>ID người nhận</span><input value={form.recipient_id || ''} onChange={(event) => setForm((current) => ({ ...current, recipient_id: event.target.value }))} /></label>
            <label className="ih-toggle"><input type="checkbox" checked={Boolean(form.send)} onChange={(event) => setForm((current) => ({ ...current, send: event.target.checked }))} /><span>Gửi thật</span></label>
          </>
        ) : null}
      </div>
      {result ? (
        <div className="ih-preview-result">
          {result.qr?.qr_image_url ? <img src={result.qr.qr_image_url} alt="Xem trước QR" /> : null}
          <JsonBlock value={result} />
        </div>
      ) : null}
    </section>
  );
}

function getRowsForView(data, view) {
  if (!data) return [];
  if (view === 'overview') return data.providers || [];
  if (view === 'health') return data.checks || [];
  return data.items || data.recent || data.events || data.batches || [];
}

function getColumnsForView(view) {
  if (view === 'overview') {
    return [
      { key: 'name', label: 'Provider' },
      { key: 'type', label: 'Loại' },
      { key: 'health', label: 'Sức khỏe', status: true },
      { key: 'mode', label: 'Chế độ' },
      { key: 'kpi.pending', label: 'Chờ xử lý' },
      { key: 'kpi.failed', label: 'Lỗi' },
    ];
  }
  if (['emailProvider', 'pushProvider', 'httpChannel'].includes(view)) {
    return [
      { key: '_id', label: 'Lượt gửi' },
      { key: 'status', label: 'Trạng thái', status: true },
      { key: 'channel', label: 'Kênh' },
      { key: 'provider', label: 'Provider' },
      { key: 'notification_id.title', label: 'Thông báo' },
      { key: 'attempt_count', label: 'Lần thử' },
      { key: 'last_error', label: 'Lỗi gần nhất' },
      { key: 'next_attempt_at', label: 'Thử tiếp lúc' },
    ];
  }
  if (['bankQr', 'momoQr'].includes(view)) {
    return [
      { key: 'intent_code', label: 'Mã intent' },
      { key: 'status', label: 'Trạng thái', status: true },
      { key: 'provider', label: 'Provider' },
      { key: 'amount', label: 'Số tiền' },
      { key: 'payment_note', label: 'Nội dung thanh toán' },
      { key: 'receipt_image_url', label: 'Biên nhận' },
      { key: 'expires_at', label: 'Hết hạn' },
      { key: 'confirmed_at', label: 'Đã xác nhận' },
    ];
  }
  if (['paymentWebhook', 'providerWebhookEvents'].includes(view)) {
    return [
      { key: 'provider', label: 'Provider' },
      { key: 'event_id', label: 'ID sự kiện' },
      { key: 'event_type', label: 'Loại' },
      { key: 'status', label: 'Trạng thái', status: true },
      { key: 'signature_valid', label: 'Chữ ký' },
      { key: 'transaction_ref', label: 'Tham chiếu giao dịch' },
      { key: 'received_at', label: 'Đã nhận lúc' },
      { key: 'error_message', label: 'Lỗi' },
    ];
  }
  if (view === 'bankTransactions') {
    return [
      { key: 'transaction_id', label: 'Giao dịch' },
      { key: 'match_status', label: 'Trạng thái', status: true },
      { key: 'provider', label: 'Provider' },
      { key: 'amount', label: 'Số tiền' },
      { key: 'transaction_ref', label: 'Tham chiếu' },
      { key: 'detected_intent_code', label: 'Intent nhận diện' },
      { key: 'confidence_score', label: 'Độ tin cậy' },
      { key: 'transaction_at', label: 'Thời gian' },
    ];
  }
  if (view === 'reconciliation') {
    return [
      { key: 'batch_no', label: 'Lô' },
      { key: 'status', label: 'Trạng thái', status: true },
      { key: 'provider', label: 'Provider' },
      { key: 'total_transactions', label: 'Giao dịch' },
      { key: 'matched_count', label: 'Đã khớp' },
      { key: 'unmatched_count', label: 'Chưa khớp' },
      { key: 'mismatch_count', label: 'Sai lệch' },
      { key: 'created_at', label: 'Ngày tạo' },
    ];
  }
  if (view === 'googleOAuth') {
    return [
      { key: 'created_at', label: 'Thời gian' },
      { key: 'status', label: 'Trạng thái', status: true },
      { key: 'action', label: 'Hành động' },
      { key: 'actor_type', label: 'Đối tượng' },
      { key: 'message', label: 'Thông báo' },
      { key: 'request_id', label: 'ID yêu cầu' },
    ];
  }
  if (view === 'health') {
    return [
      { key: 'provider', label: 'Provider' },
      { key: 'check_type', label: 'Kiểm tra' },
      { key: 'status', label: 'Trạng thái', status: true },
      { key: 'configured', label: 'Cấu hình' },
      { key: 'enabled', label: 'Bật' },
      { key: 'recommendation', label: 'Khuyến nghị' },
      { key: 'checked_at', label: 'Đã kiểm lúc' },
    ];
  }
  return [
    { key: 'created_at', label: 'Thời gian' },
    { key: 'severity', label: 'Mức độ', status: true },
    { key: 'provider', label: 'Provider' },
    { key: 'action', label: 'Hành động' },
    { key: 'status', label: 'Trạng thái', status: true },
    { key: 'message', label: 'Thông báo' },
    { key: 'request_id', label: 'ID yêu cầu' },
  ];
}

export function IntegrationHubPage({ view = 'overview' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.overview;
  const Icon = config.icon;
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [maskedConfig, setMaskedConfig] = useState(null);
  const [failures, setFailures] = useState([]);
  const [selected, setSelected] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', provider: '', date_from: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const requestParams = useMemo(() => ({
    search: appliedFilters.search,
    status: appliedFilters.status,
    provider: appliedFilters.provider,
    date_from: appliedFilters.date_from,
    limit: 30,
  }), [appliedFilters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mainData, healthData, configData, failureData] = await Promise.all([
        integrationGet(config.endpoint, view === 'overview' || view === 'health' ? {} : requestParams),
        config.healthEndpoint ? integrationGet(config.healthEndpoint).catch(() => null) : Promise.resolve(null),
        config.configEndpoint ? integrationGet(config.configEndpoint).catch(() => null) : Promise.resolve(null),
        view === 'overview' ? Promise.resolve(null) : integrationGet('/failures', { limit: 8 }).catch(() => null),
      ]);
      setData(mainData);
      setHealth(healthData);
      setMaskedConfig(configData);
      setFailures(failureData?.items || mainData?.failure_inbox || []);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải Trung tâm tích hợp.');
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.healthEndpoint, config.configEndpoint, requestParams, view]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters() {
    setAppliedFilters(filters);
  }

  function actionCopy(action, row = null) {
    const target = row ? (row.title || row.name || row.event_id || row.delivery_id || row.batch_no || getRowId(row)) : config.title;
    const copies = {
      dispatchEmail: ['Gửi email đang chờ?', 'Hệ thống sẽ lấy tối đa 50 email trong hàng đợi để gửi ngay.', 'Gửi hàng đợi', 'warning', false],
      dispatchPush: ['Gửi push đang chờ?', 'Hệ thống sẽ lấy tối đa 50 push notification trong hàng đợi để gửi ngay.', 'Gửi hàng đợi', 'warning', false],
      retryDelivery: ['Thử gửi lại lượt gửi?', 'Lượt gửi lỗi sẽ được đưa vào luồng gửi lại và ghi nhật ký tích hợp.', 'Thử gửi lại', 'warning', false],
      reprocessWebhook: ['Xử lý lại webhook?', 'Webhook provider sẽ được đưa qua pipeline xử lý lại. Thao tác này có thể cập nhật trạng thái thanh toán/đối soát.', 'Xử lý lại', 'warning', true],
      ignoreWebhook: ['Bỏ qua webhook?', 'Sự kiện webhook sẽ được đánh dấu bỏ qua và không tiếp tục xử lý tự động.', 'Bỏ qua', 'danger', true],
      autoMatch: ['Chạy tự khớp đối soát?', 'Engine sẽ tự khớp các giao dịch theo ngưỡng hiện tại và có thể tạo kết quả đối soát mới.', 'Chạy tự khớp', 'warning', false],
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
        { label: 'Đối tượng', value: target },
        { label: 'Mã', value: row ? getRowId(row) : config.provider || 'all' },
      ],
    };
  }

  async function runAction(action, row = null) {
    const copy = actionCopy(action, row);
    if (copy) {
      setConfirmAction({ action, row, ...copy });
      return;
    }
    await executeAction(action, row);
  }

  async function executeAction(action, row = null, reasonInput = '') {
    setError('');
    setActionBusy(true);
    try {
      if (action === 'diagnostics') {
        setSelected(await integrationPost('/diagnostics/run', { provider: config.provider || 'all' }));
      }
      if (action === 'exportLogs') {
        setSelected(await integrationGet('/logs/export', requestParams));
      }
      if (action === 'dispatchEmail') {
        setSelected(await integrationPost('/email/dispatch-queued', { limit: 50 }));
        await load();
      }
      if (action === 'dispatchPush') {
        setSelected(await integrationPost('/push/dispatch-queued', { limit: 50 }));
        await load();
      }
      if (action === 'retryDelivery' && row) {
        const channel = row.channel === 'push' ? 'push' : 'email';
        setSelected(await integrationPost(`/${channel}/deliveries/${getRowId(row)}/retry`, {}));
        await load();
      }
      if (action === 'reprocessWebhook' && row) {
        setSelected(await integrationPost(`/provider-webhook-events/${getRowId(row)}/reprocess`, { reason: reasonInput || 'admin_retry_from_integration_hub' }));
        await load();
      }
      if (action === 'ignoreWebhook' && row) {
        setSelected(await integrationPost(`/provider-webhook-events/${getRowId(row)}/ignore`, { reason: reasonInput || 'admin_ignore_from_integration_hub' }));
        await load();
      }
      if (action === 'autoMatch') {
        setSelected(await integrationPost('/reconciliation/auto-match', { limit: 50, threshold: 90, review_threshold: 70 }));
        await load();
      }
      setConfirmAction(null);
    } catch (actionError) {
      setError(actionError.message || 'Thao tác thất bại.');
    } finally {
      setActionBusy(false);
    }
  }

  async function runPreview(form) {
    const path = view === 'bankQr'
      ? '/bank-qr/preview'
      : view === 'momoQr'
        ? '/momo-personal-qr/preview'
        : view === 'emailProvider'
          ? '/email/test'
          : '/push/test';
    try {
      setPreviewResult(await integrationPost(path, form));
    } catch (previewError) {
      setError(previewError.message || 'Không thể chạy test provider.');
    }
  }

  const rows = useMemo(() => getRowsForView(data, view), [data, view]);
  const kpis = useMemo(() => {
    const provider = health?.code ? health : data?.providers?.find((item) => item.code === config.provider);
    const source = provider?.kpi || data?.health_counts || {};
    return [
      { label: 'Ổn định', value: data?.health_counts?.healthy ?? (provider?.health === 'healthy' ? 1 : 0), tone: 'success', icon: CheckCircle2 },
      { label: 'Cảnh báo', value: data?.health_counts?.warning ?? source.manual_review ?? source.unmatched ?? 0, tone: 'warning', icon: AlertTriangle },
      { label: 'Nghiêm trọng / lỗi', value: data?.health_counts?.critical ?? source.failed ?? source.disputed ?? 0, tone: 'danger', icon: ShieldAlert },
      { label: 'Chờ xử lý / backlog', value: source.pending ?? source.total_pending ?? source.received ?? 0, tone: 'neutral', icon: Clock3 },
    ];
  }, [config.provider, data, health]);

  const actionSlot = (row) => (
    <>
      {['emailProvider', 'pushProvider', 'httpChannel'].includes(view) ? (
        <IconButton icon={RefreshCw} label="Thử gửi lại" onClick={() => runAction('retryDelivery', row)} disabled={row.status !== 'failed'} />
      ) : null}
      {['paymentWebhook', 'providerWebhookEvents'].includes(view) ? (
        <>
          <IconButton icon={RefreshCw} label="Xử lý lại" onClick={() => runAction('reprocessWebhook', row)} />
          <IconButton icon={X} label="Bỏ qua" onClick={() => runAction('ignoreWebhook', row)} />
        </>
      ) : null}
      <IconButton icon={Copy} label="Sao chép ID" onClick={() => navigator.clipboard?.writeText(String(getRowId(row) || ''))} />
    </>
  );

  return (
    <div className="integration-hub">
      <header className="ih-hero">
        <div className="ih-hero__copy">
          <span className="ih-eyebrow"><Icon size={17} strokeWidth={2.25} /> Quản trị hệ thống / Trung tâm tích hợp</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <div className="ih-hero__actions">
          <StatusBadge value={data?.status || health?.health || 'healthy'} />
          <ActionButton icon={RefreshCw} label={loading ? 'Đang làm mới' : 'Làm mới'} onClick={load} />
          <ActionButton icon={Activity} label="Chẩn đoán" onClick={() => runAction('diagnostics')} variant="primary" disabled={actionBusy} />
          <ActionButton icon={Download} label="Xuất nhật ký" onClick={() => runAction('exportLogs')} disabled={actionBusy} />
        </div>
      </header>

      <nav className="ih-tabs" aria-label="Khu vực tích hợp">
        {NAV_ITEMS.map(([key, label, ItemIcon]) => (
          <Link key={key} className={key === view ? 'is-active' : ''} to={routeForView(key) ? `/admin/integrations/${routeForView(key)}` : '/admin/integrations'}>
            <ItemIcon size={15} strokeWidth={2.25} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <section className="ih-kpi-strip">
        {kpis.map((item) => <KpiCard key={item.label} {...item} />)}
      </section>

      {error ? <div className="ih-error"><AlertTriangle size={17} />{error}</div> : null}

      <section className="ih-toolbar">
        <label className="ih-search">
          <Search size={16} strokeWidth={2.25} />
          <input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyFilters();
            }}
            placeholder="Tìm ID, provider, tham chiếu, yêu cầu..."
          />
        </label>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">Mọi trạng thái</option>
          <option value="failed">Lỗi</option>
          <option value="pending">Chờ xử lý</option>
          <option value="processed">Đã xử lý</option>
          <option value="manual_review">Cần rà soát</option>
          <option value="unmatched">Chưa khớp</option>
          <option value="disputed">Có tranh chấp</option>
        </select>
        <select value={filters.provider} onChange={(event) => setFilters((current) => ({ ...current, provider: event.target.value }))}>
          <option value="">Mọi provider</option>
          <option value="bank_qr_manual">Bank QR manual</option>
          <option value="momo_personal_qr">MoMo personal QR</option>
          <option value="email_smtp">Email SMTP</option>
          <option value="push_http">Push HTTP</option>
        </select>
        <input type="date" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} />
        <ActionButton icon={Search} label="Áp dụng" onClick={applyFilters} disabled={loading} />
      </section>

      {view === 'overview' ? (
        <>
          <section className="ih-section">
            <div className="ih-section__head">
              <strong>Ma trận sức khỏe provider</strong>
              <span>{loading ? 'Đang tải' : `${data?.providers?.length || 0} provider`}</span>
            </div>
            <ProviderMatrix providers={data?.providers || []} onOpen={setSelected} />
          </section>
          <ProviderCards providers={data?.providers || []} onOpen={setSelected} />
          <section className="ih-section">
            <div className="ih-section__head">
              <strong>Hộp lỗi</strong>
              <span>Liên provider</span>
            </div>
            <FailureInbox items={data?.failure_inbox || []} onOpen={setSelected} />
          </section>
        </>
      ) : (
        <div className="ih-content-grid">
          <main className="ih-main-stack">
            {maskedConfig ? <ConfigPanel config={maskedConfig} /> : null}
            <PreviewConsole view={view} onRun={runPreview} result={previewResult} />
            {view === 'reconciliation' ? (
              <section className="ih-panel">
                <div className="ih-panel__head">
                  <strong>Bàn xử lý đối soát</strong>
                  <ActionButton icon={Play} label="Tự khớp" onClick={() => runAction('autoMatch')} variant="primary" disabled={actionBusy} />
                </div>
                <JsonBlock value={health} />
              </section>
            ) : null}
            {['emailProvider', 'pushProvider'].includes(view) ? (
              <section className="ih-panel">
                <div className="ih-panel__head">
                  <strong>Thao tác hàng đợi</strong>
                  <ActionButton icon={RefreshCw} label="Gửi hàng đợi" onClick={() => runAction(view === 'emailProvider' ? 'dispatchEmail' : 'dispatchPush')} disabled={actionBusy} />
                </div>
              </section>
            ) : null}
            <section className="ih-section">
              <div className="ih-section__head">
                <strong>Bản ghi {config.title}</strong>
                <span>{loading ? 'Đang tải' : `${rows.length} dòng`}</span>
              </div>
              <DataTable rows={rows} columns={getColumnsForView(view)} onOpen={setSelected} actionSlot={actionSlot} />
            </section>
          </main>
          <aside className="ih-side-stack">
            <section className="ih-panel">
              <div className="ih-panel__head">
                <strong>Sức khỏe provider</strong>
                <StatusBadge value={health?.health || health?.status || data?.status || 'healthy'} />
              </div>
              <JsonBlock value={health} />
            </section>
            <section className="ih-panel">
              <div className="ih-panel__head">
                <strong>Hộp lỗi</strong>
                <span>{failures.length}</span>
              </div>
              <FailureInbox items={failures} onOpen={setSelected} />
            </section>
          </aside>
        </div>
      )}

      <DetailDrawer item={selected} onClose={() => setSelected(null)} title={config.title} />
      <AdminActionConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title}
        description={confirmAction?.description}
        tone={confirmAction?.tone}
        confirmLabel={confirmAction?.confirmLabel}
        details={confirmAction?.details}
        reasonRequired={confirmAction?.reasonRequired}
        submitting={actionBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={(reason) => executeAction(confirmAction.action, confirmAction.row, reason)}
      />
    </div>
  );
}

function routeForView(view) {
  const map = {
    overview: '',
    emailProvider: 'email-provider',
    pushProvider: 'push-provider',
    httpChannel: 'http-notification-channel',
    bankQr: 'bank-qr-provider',
    momoQr: 'momo-personal-qr',
    paymentWebhook: 'payment-webhook',
    providerWebhookEvents: 'provider-webhook-events',
    bankTransactions: 'bank-statement-transactions',
    reconciliation: 'reconciliation-provider',
    googleOAuth: 'google-oauth',
    health: 'integration-health',
    logs: 'integration-logs',
  };
  return map[view] || '';
}
