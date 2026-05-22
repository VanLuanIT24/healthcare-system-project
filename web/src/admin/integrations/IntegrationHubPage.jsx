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
import { integrationGet, integrationPost } from './integrationApi';

const VIEW_CONFIG = {
  overview: {
    title: 'Integration Hub',
    subtitle: 'Payment, notification, OAuth, webhook, bank statement và reconciliation.',
    icon: Webhook,
    endpoint: '/summary',
  },
  emailProvider: {
    title: 'Email Provider',
    subtitle: 'SMTP outbound delivery, queue dispatch và failed delivery recovery.',
    icon: Mail,
    endpoint: '/email/deliveries',
    healthEndpoint: '/email/health',
    configEndpoint: '/email/config',
    channel: 'email',
  },
  pushProvider: {
    title: 'Push Provider',
    subtitle: 'HTTP push bridge, payload contract, retry và provider health.',
    icon: Smartphone,
    endpoint: '/push/deliveries',
    healthEndpoint: '/push/health',
    configEndpoint: '/push/config',
    channel: 'push',
  },
  httpChannel: {
    title: 'HTTP Notification Channel',
    subtitle: 'Outbound HTTP channels, payload contract và delivery logs.',
    icon: Webhook,
    endpoint: '/providers/push_http/events',
    healthEndpoint: '/push/health',
    configEndpoint: '/push/config',
  },
  bankQr: {
    title: 'Bank QR Provider',
    subtitle: 'VietQR static QR, manual confirmation và bank statement reconciliation.',
    icon: Banknote,
    endpoint: '/bank-qr/intents',
    healthEndpoint: '/bank-qr/health',
    configEndpoint: '/bank-qr/config',
    provider: 'bank_qr',
  },
  momoQr: {
    title: 'MoMo Personal QR',
    subtitle: 'Static personal QR, receipt review và manual confirmation.',
    icon: Smartphone,
    endpoint: '/momo-personal-qr/intents',
    healthEndpoint: '/momo-personal-qr/health',
    configEndpoint: '/momo-personal-qr/config',
    provider: 'momo_personal_qr',
  },
  paymentWebhook: {
    title: 'Payment Webhook',
    subtitle: 'Inbound callbacks, signature verification và reprocessing.',
    icon: Link2,
    endpoint: '/payment-webhooks',
    provider: 'payment_webhook',
  },
  providerWebhookEvents: {
    title: 'Provider Webhook Events',
    subtitle: 'All inbound provider events, processing status và correlation.',
    icon: FileClock,
    endpoint: '/provider-webhook-events',
    provider: 'payment_webhook',
  },
  bankTransactions: {
    title: 'Bank Statement Transactions',
    subtitle: 'Imported transactions, detected notes, candidates và matching.',
    icon: Landmark,
    endpoint: '/bank-statement-transactions',
    provider: 'reconciliation',
  },
  reconciliation: {
    title: 'Reconciliation Provider',
    subtitle: 'Manual QR reconciliation engine, batches, auto-match và exceptions.',
    icon: RefreshCw,
    endpoint: '/reconciliation/batches',
    healthEndpoint: '/reconciliation/overview',
    provider: 'reconciliation',
  },
  googleOAuth: {
    title: 'Google OAuth',
    subtitle: 'Google login config, callback diagnostics và login monitoring.',
    icon: Globe2,
    endpoint: '/google-oauth/login-events',
    healthEndpoint: '/google-oauth/health',
    configEndpoint: '/google-oauth/config',
    provider: 'google_oauth',
  },
  health: {
    title: 'Integration Health',
    subtitle: 'Configuration completeness, provider status và failure risk.',
    icon: Activity,
    endpoint: '/health',
  },
  logs: {
    title: 'Integration Logs',
    subtitle: 'Central log explorer for providers, webhooks, deliveries và diagnostics.',
    icon: FileClock,
    endpoint: '/logs',
  },
};

const NAV_ITEMS = [
  ['overview', 'Overview', Webhook],
  ['emailProvider', 'Email', Mail],
  ['pushProvider', 'Push', Smartphone],
  ['httpChannel', 'HTTP channel', Webhook],
  ['bankQr', 'Bank QR', Banknote],
  ['momoQr', 'MoMo QR', Smartphone],
  ['paymentWebhook', 'Payment webhook', Link2],
  ['providerWebhookEvents', 'Webhook events', FileClock],
  ['bankTransactions', 'Bank transactions', Landmark],
  ['reconciliation', 'Reconciliation', RefreshCw],
  ['googleOAuth', 'Google OAuth', Globe2],
  ['health', 'Health', Activity],
  ['logs', 'Logs', FileClock],
];

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
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('vi-VN') : '—';
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return new Date(value).toLocaleString('vi-VN');
  }
  if (value instanceof Date) return value.toLocaleString('vi-VN');
  if (typeof value === 'object') {
    return value.intent_code || value.invoice_no || value.payment_no || value.transaction_id || value.batch_no || value.title || value.name || JSON.stringify(value);
  }
  return String(value);
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
  return (
    <div className="ih-table" style={{ '--ih-table-cols': `minmax(180px, 1.4fr) repeat(${Math.max(columns.length - 1, 0)}, minmax(130px, 1fr)) 96px` }}>
      <div className="ih-table__head">
        {columns.map((column) => <span key={column.key}>{column.label}</span>)}
        <span>Actions</span>
      </div>
      <div className="ih-table__body">
        {rows.length ? rows.map((row) => (
          <button type="button" className="ih-table__row" key={getRowId(row)} onClick={() => onOpen(row)}>
            {columns.map((column, index) => {
              const value = column.render ? column.render(row) : getNested(row, column.key);
              return (
                <span key={column.key} className={index === 0 ? 'ih-table__primary' : ''}>
                  {column.status ? <StatusBadge value={value} /> : formatValue(value)}
                </span>
              );
            })}
            <span className="ih-table__actions" onClick={(event) => event.stopPropagation()}>
              {actionSlot ? actionSlot(row) : null}
              <IconButton icon={Eye} label="View detail" onClick={() => onOpen(row)} />
            </span>
          </button>
        )) : (
          <div className="ih-empty">
            <Database size={20} strokeWidth={2.25} />
            <span>Không có dữ liệu phù hợp</span>
          </div>
        )}
      </div>
    </div>
  );
}

function JsonBlock({ value }) {
  return <pre className="ih-json">{JSON.stringify(value || {}, null, 2)}</pre>;
}

function DetailDrawer({ item, onClose, title = 'Detail' }) {
  if (!item) return null;
  return (
    <aside className="ih-drawer">
      <div className="ih-drawer__head">
        <div>
          <span>{title}</span>
          <strong>{formatValue(item.name || item.title || item.intent_code || item.event_id || item.transaction_id || getRowId(item))}</strong>
        </div>
        <IconButton icon={X} label="Close" onClick={onClose} />
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
    { key: 'type', label: 'Type' },
    { key: 'enabled', label: 'Enabled' },
    { key: 'configured', label: 'Config' },
    { key: 'health', label: 'Health', status: true },
    { key: 'mode', label: 'Mode' },
    { key: 'kpi.pending', label: 'Pending' },
    { key: 'kpi.failed', label: 'Failed' },
    { key: 'last_success_at', label: 'Last success' },
    { key: 'last_failure_at', label: 'Last failure' },
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
              <span>Pending <strong>{formatValue(provider.kpi?.pending ?? provider.kpi?.unmatched ?? '—')}</strong></span>
              <span>Failed <strong>{formatValue(provider.kpi?.failed ?? provider.kpi?.disputed ?? '—')}</strong></span>
              <span>Mode <strong>{formatValue(provider.mode)}</strong></span>
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
  if (!provider.enabled) return 'Disabled';
  if (!provider.configured) return 'Missing required config';
  if (provider.health === 'critical') return provider.last_error || 'Critical provider issue';
  if (provider.health === 'warning') return 'Backlog or manual review needs attention';
  return 'Operational';
}

function FailureInbox({ items = [], onOpen }) {
  const columns = [
    { key: 'severity', label: 'Severity', status: true },
    { key: 'source', label: 'Source' },
    { key: 'object', label: 'Object' },
    { key: 'error', label: 'Error' },
    { key: 'age_at', label: 'Age' },
    { key: 'action', label: 'Action' },
  ];
  return <DataTable rows={items} columns={columns} onOpen={onOpen} />;
}

function ConfigPanel({ config }) {
  const values = config?.values || {};
  return (
    <section className="ih-panel">
      <div className="ih-panel__head">
        <strong>Masked configuration</strong>
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
  const [form, setForm] = useState({ amount: 100000, payment_note: 'MEDCARE TEST', send: false });
  const isQr = view === 'bankQr' || view === 'momoQr';
  const isEmail = view === 'emailProvider';
  const isPush = view === 'pushProvider' || view === 'httpChannel';
  if (!isQr && !isEmail && !isPush) return null;
  return (
    <section className="ih-panel ih-console">
      <div className="ih-panel__head">
        <strong>{isQr ? 'QR preview' : 'Provider test'}</strong>
        <ActionButton icon={Play} label={isQr ? 'Preview' : 'Run test'} onClick={() => onRun(form)} variant="primary" />
      </div>
      <div className="ih-console__form">
        {isQr ? (
          <>
            <label><span>Amount</span><input value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></label>
            <label><span>Payment note</span><input value={form.payment_note} onChange={(event) => setForm((current) => ({ ...current, payment_note: event.target.value }))} /></label>
          </>
        ) : null}
        {isEmail ? (
          <>
            <label><span>Recipient</span><input placeholder="admin@example.com" value={form.to || ''} onChange={(event) => setForm((current) => ({ ...current, to: event.target.value }))} /></label>
            <label className="ih-toggle"><input type="checkbox" checked={Boolean(form.send)} onChange={(event) => setForm((current) => ({ ...current, send: event.target.checked }))} /><span>Send</span></label>
          </>
        ) : null}
        {isPush ? (
          <>
            <label><span>Recipient ID</span><input value={form.recipient_id || ''} onChange={(event) => setForm((current) => ({ ...current, recipient_id: event.target.value }))} /></label>
            <label className="ih-toggle"><input type="checkbox" checked={Boolean(form.send)} onChange={(event) => setForm((current) => ({ ...current, send: event.target.checked }))} /><span>Send</span></label>
          </>
        ) : null}
      </div>
      {result ? (
        <div className="ih-preview-result">
          {result.qr?.qr_image_url ? <img src={result.qr.qr_image_url} alt="QR preview" /> : null}
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
      { key: 'type', label: 'Type' },
      { key: 'health', label: 'Health', status: true },
      { key: 'mode', label: 'Mode' },
      { key: 'kpi.pending', label: 'Pending' },
      { key: 'kpi.failed', label: 'Failed' },
    ];
  }
  if (['emailProvider', 'pushProvider', 'httpChannel'].includes(view)) {
    return [
      { key: '_id', label: 'Delivery' },
      { key: 'status', label: 'Status', status: true },
      { key: 'channel', label: 'Channel' },
      { key: 'provider', label: 'Provider' },
      { key: 'notification_id.title', label: 'Notification' },
      { key: 'attempt_count', label: 'Attempt' },
      { key: 'last_error', label: 'Last error' },
      { key: 'next_attempt_at', label: 'Next attempt' },
    ];
  }
  if (['bankQr', 'momoQr'].includes(view)) {
    return [
      { key: 'intent_code', label: 'Intent' },
      { key: 'status', label: 'Status', status: true },
      { key: 'provider', label: 'Provider' },
      { key: 'amount', label: 'Amount' },
      { key: 'payment_note', label: 'Payment note' },
      { key: 'receipt_image_url', label: 'Receipt' },
      { key: 'expires_at', label: 'Expires' },
      { key: 'confirmed_at', label: 'Confirmed' },
    ];
  }
  if (['paymentWebhook', 'providerWebhookEvents'].includes(view)) {
    return [
      { key: 'provider', label: 'Provider' },
      { key: 'event_id', label: 'Event ID' },
      { key: 'event_type', label: 'Type' },
      { key: 'status', label: 'Status', status: true },
      { key: 'signature_valid', label: 'Signature' },
      { key: 'transaction_ref', label: 'Transaction ref' },
      { key: 'received_at', label: 'Received' },
      { key: 'error_message', label: 'Error' },
    ];
  }
  if (view === 'bankTransactions') {
    return [
      { key: 'transaction_id', label: 'Transaction' },
      { key: 'match_status', label: 'Status', status: true },
      { key: 'provider', label: 'Provider' },
      { key: 'amount', label: 'Amount' },
      { key: 'transaction_ref', label: 'Ref' },
      { key: 'detected_intent_code', label: 'Detected intent' },
      { key: 'confidence_score', label: 'Confidence' },
      { key: 'transaction_at', label: 'Time' },
    ];
  }
  if (view === 'reconciliation') {
    return [
      { key: 'batch_no', label: 'Batch' },
      { key: 'status', label: 'Status', status: true },
      { key: 'provider', label: 'Provider' },
      { key: 'total_transactions', label: 'Transactions' },
      { key: 'matched_count', label: 'Matched' },
      { key: 'unmatched_count', label: 'Unmatched' },
      { key: 'mismatch_count', label: 'Mismatch' },
      { key: 'created_at', label: 'Created' },
    ];
  }
  if (view === 'googleOAuth') {
    return [
      { key: 'created_at', label: 'Time' },
      { key: 'status', label: 'Status', status: true },
      { key: 'action', label: 'Action' },
      { key: 'actor_type', label: 'Actor' },
      { key: 'message', label: 'Message' },
      { key: 'request_id', label: 'Request ID' },
    ];
  }
  if (view === 'health') {
    return [
      { key: 'provider', label: 'Provider' },
      { key: 'check_type', label: 'Check' },
      { key: 'status', label: 'Status', status: true },
      { key: 'configured', label: 'Config' },
      { key: 'enabled', label: 'Enabled' },
      { key: 'recommendation', label: 'Recommendation' },
      { key: 'checked_at', label: 'Checked' },
    ];
  }
  return [
    { key: 'created_at', label: 'Time' },
    { key: 'severity', label: 'Severity', status: true },
    { key: 'provider', label: 'Provider' },
    { key: 'action', label: 'Action' },
    { key: 'status', label: 'Status', status: true },
    { key: 'message', label: 'Message' },
    { key: 'request_id', label: 'Request ID' },
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestParams = useMemo(() => ({
    search: filters.search,
    status: filters.status,
    provider: filters.provider,
    date_from: filters.date_from,
    limit: 30,
  }), [filters]);

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
      setError(loadError.message || 'Không thể tải Integration Hub.');
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.healthEndpoint, config.configEndpoint, requestParams, view]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(action, row = null) {
    setError('');
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
        setSelected(await integrationPost(`/provider-webhook-events/${getRowId(row)}/reprocess`, { reason: 'admin_retry_from_integration_hub' }));
        await load();
      }
      if (action === 'ignoreWebhook' && row) {
        setSelected(await integrationPost(`/provider-webhook-events/${getRowId(row)}/ignore`, { reason: 'admin_ignore_from_integration_hub' }));
        await load();
      }
      if (action === 'autoMatch') {
        setSelected(await integrationPost('/reconciliation/auto-match', { limit: 50, threshold: 90, review_threshold: 70 }));
        await load();
      }
    } catch (actionError) {
      setError(actionError.message || 'Thao tác thất bại.');
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
      { label: 'Healthy', value: data?.health_counts?.healthy ?? (provider?.health === 'healthy' ? 1 : 0), tone: 'success', icon: CheckCircle2 },
      { label: 'Warning', value: data?.health_counts?.warning ?? source.manual_review ?? source.unmatched ?? 0, tone: 'warning', icon: AlertTriangle },
      { label: 'Critical / failed', value: data?.health_counts?.critical ?? source.failed ?? source.disputed ?? 0, tone: 'danger', icon: ShieldAlert },
      { label: 'Pending / backlog', value: source.pending ?? source.total_pending ?? source.received ?? 0, tone: 'neutral', icon: Clock3 },
    ];
  }, [config.provider, data, health]);

  const actionSlot = (row) => (
    <>
      {['emailProvider', 'pushProvider', 'httpChannel'].includes(view) ? (
        <IconButton icon={RefreshCw} label="Retry delivery" onClick={() => runAction('retryDelivery', row)} disabled={row.status !== 'failed'} />
      ) : null}
      {['paymentWebhook', 'providerWebhookEvents'].includes(view) ? (
        <>
          <IconButton icon={RefreshCw} label="Reprocess" onClick={() => runAction('reprocessWebhook', row)} />
          <IconButton icon={X} label="Ignore" onClick={() => runAction('ignoreWebhook', row)} />
        </>
      ) : null}
      <IconButton icon={Copy} label="Copy ID" onClick={() => navigator.clipboard?.writeText(String(getRowId(row) || ''))} />
    </>
  );

  return (
    <div className="integration-hub">
      <header className="ih-hero">
        <div className="ih-hero__copy">
          <span className="ih-eyebrow"><Icon size={17} strokeWidth={2.25} /> Quản trị hệ thống / Integration Hub</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <div className="ih-hero__actions">
          <StatusBadge value={data?.status || health?.health || 'healthy'} />
          <ActionButton icon={RefreshCw} label={loading ? 'Refreshing' : 'Refresh'} onClick={load} />
          <ActionButton icon={Activity} label="Diagnostics" onClick={() => runAction('diagnostics')} variant="primary" />
          <ActionButton icon={Download} label="Export" onClick={() => runAction('exportLogs')} />
        </div>
      </header>

      <nav className="ih-tabs" aria-label="Integration Hub sections">
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
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search ID, provider, reference, request..." />
        </label>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">All status</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="processed">Processed</option>
          <option value="manual_review">Manual review</option>
          <option value="unmatched">Unmatched</option>
          <option value="disputed">Disputed</option>
        </select>
        <select value={filters.provider} onChange={(event) => setFilters((current) => ({ ...current, provider: event.target.value }))}>
          <option value="">All providers</option>
          <option value="bank_qr_manual">Bank QR manual</option>
          <option value="momo_personal_qr">MoMo personal QR</option>
          <option value="email_smtp">Email SMTP</option>
          <option value="push_http">Push HTTP</option>
        </select>
        <input type="date" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} />
      </section>

      {view === 'overview' ? (
        <>
          <section className="ih-section">
            <div className="ih-section__head">
              <strong>Provider health matrix</strong>
              <span>{loading ? 'Loading' : `${data?.providers?.length || 0} providers`}</span>
            </div>
            <ProviderMatrix providers={data?.providers || []} onOpen={setSelected} />
          </section>
          <ProviderCards providers={data?.providers || []} onOpen={setSelected} />
          <section className="ih-section">
            <div className="ih-section__head">
              <strong>Failure inbox</strong>
              <span>Cross-provider</span>
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
                  <strong>Reconciliation workbench</strong>
                  <ActionButton icon={Play} label="Auto-match" onClick={() => runAction('autoMatch')} variant="primary" />
                </div>
                <JsonBlock value={health} />
              </section>
            ) : null}
            {['emailProvider', 'pushProvider'].includes(view) ? (
              <section className="ih-panel">
                <div className="ih-panel__head">
                  <strong>Queue actions</strong>
                  <ActionButton icon={RefreshCw} label="Dispatch queued" onClick={() => runAction(view === 'emailProvider' ? 'dispatchEmail' : 'dispatchPush')} />
                </div>
              </section>
            ) : null}
            <section className="ih-section">
              <div className="ih-section__head">
                <strong>{config.title} records</strong>
                <span>{loading ? 'Loading' : `${rows.length} rows`}</span>
              </div>
              <DataTable rows={rows} columns={getColumnsForView(view)} onOpen={setSelected} actionSlot={actionSlot} />
            </section>
          </main>
          <aside className="ih-side-stack">
            <section className="ih-panel">
              <div className="ih-panel__head">
                <strong>Provider health</strong>
                <StatusBadge value={health?.health || health?.status || data?.status || 'healthy'} />
              </div>
              <JsonBlock value={health} />
            </section>
            <section className="ih-panel">
              <div className="ih-panel__head">
                <strong>Failure inbox</strong>
                <span>{failures.length}</span>
              </div>
              <FailureInbox items={failures} onOpen={setSelected} />
            </section>
          </aside>
        </div>
      )}

      <DetailDrawer item={selected} onClose={() => setSelected(null)} title={config.title} />
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
