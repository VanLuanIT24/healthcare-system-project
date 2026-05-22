import {
  Activity,
  AlertTriangle,
  BellRing,
  BookOpen,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Eye,
  FileClock,
  FileText,
  Filter,
  Gauge,
  MessageSquare,
  Play,
  RadioTower,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  ServerCog,
  ShieldAlert,
  TicketCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  supportCommDelete,
  supportCommGet,
  supportCommPatch,
  supportCommPost,
} from './supportCommunicationApi';

const VIEW_CONFIG = {
  tickets: {
    title: 'Support tickets',
    subtitle: 'Support inbox cho ticket bệnh nhân, người thân và nhân sự nội bộ với SLA, assignment, conversation và audit.',
    icon: TicketCheck,
    endpoint: '/tickets',
    detail: (row) => `/tickets/${row.id}`,
  },
  sla: {
    title: 'Ticket quá SLA',
    subtitle: 'SLA War Room: ticket quá hạn, sắp quá hạn, unassigned risk và rescue action.',
    icon: AlertTriangle,
    endpoint: '/tickets/overdue',
    summaryEndpoint: '/sla/overview',
    detail: (row) => `/tickets/${row.id}`,
    intent: 'danger',
  },
  technical: {
    title: 'Ticket kỹ thuật',
    subtitle: 'Technical Support Desk cho auth, OAuth, RBAC, realtime, notification, payment và file upload.',
    icon: ServerCog,
    endpoint: '/technical/tickets',
    summaryEndpoint: '/technical/overview',
    detail: (row) => `/tickets/${row.id}`,
  },
  account: {
    title: 'Ticket liên quan tài khoản',
    subtitle: 'Account Support cho login, password, locked account, Google OAuth, permission denied và portal authorization.',
    icon: UserRound,
    endpoint: '/account/tickets',
    detail: (row) => `/tickets/${row.id}`,
  },
  billing: {
    title: 'Ticket liên quan thanh toán',
    subtitle: 'Billing Support Desk kết nối ticket với invoice, payment intent, QR, bank transaction và reconciliation.',
    icon: ReceiptText,
    endpoint: '/billing/tickets',
    detail: (row) => `/tickets/${row.id}`,
  },
  conversations: {
    title: 'Hội thoại nội bộ',
    subtitle: 'Conversation center cho internal, support, billing, insurance, pharmacy, lab, imaging và emergency.',
    icon: MessageSquare,
    endpoint: '/conversations',
    detail: (row) => `/conversations/${row.id}`,
  },
  systemMessages: {
    title: 'Tin nhắn hệ thống',
    subtitle: 'System message explorer cho event, linked object, acknowledgement và conversation context.',
    icon: BellRing,
    endpoint: '/system-messages',
    detail: (row) => row.conversation_id?._id ? `/conversations/${row.conversation_id._id}` : null,
  },
  notifications: {
    title: 'Thông báo hệ thống',
    subtitle: 'Notification operations: create, dispatch, retry, cancel, failed delivery và channel health.',
    icon: BellRing,
    endpoint: '/notifications',
    summaryEndpoint: '/notifications/overview',
    detail: (row) => `/notifications/${row.id}`,
  },
  broadcast: {
    title: 'Broadcast notification',
    subtitle: 'Wizard gửi thông báo hàng loạt theo audience, channel, schedule, safety check và campaign delivery.',
    icon: RadioTower,
    endpoint: '/broadcasts',
    detail: (row) => `/broadcasts/${row.id}`,
  },
  notificationTemplates: {
    title: 'Notification templates',
    subtitle: 'CRUD template tự động theo event_type, language, channels, preview và validation.',
    icon: FileText,
    endpoint: '/notification-templates',
    detail: (row) => `/notification-templates/${row.id}`,
  },
  replyTemplates: {
    title: 'Mẫu phản hồi hỗ trợ',
    subtitle: 'Quick reply/canned response cho support agent theo category, tone, variables, usage và approval.',
    icon: BookOpen,
    endpoint: '/reply-templates',
    detail: (row) => `/reply-templates/${row.id}`,
  },
};

const NAV_ITEMS = [
  ['tickets', 'Support tickets', TicketCheck],
  ['sla', 'Quá SLA', AlertTriangle],
  ['technical', 'Kỹ thuật', ServerCog],
  ['account', 'Tài khoản', UserRound],
  ['billing', 'Thanh toán', ReceiptText],
  ['conversations', 'Hội thoại', MessageSquare],
  ['systemMessages', 'System messages', BellRing],
  ['notifications', 'Notifications', BellRing],
  ['broadcast', 'Broadcast', RadioTower],
  ['notificationTemplates', 'Notification templates', FileText],
  ['replyTemplates', 'Reply templates', BookOpen],
];

const STATUS_TONE = {
  open: 'info',
  waiting_staff: 'warning',
  waiting_patient: 'warning',
  resolved: 'success',
  closed: 'muted',
  cancelled: 'muted',
  breached: 'danger',
  warning: 'warning',
  ok: 'success',
  urgent: 'danger',
  high: 'warning',
  normal: 'info',
  low: 'muted',
  sent: 'success',
  delivered: 'success',
  read: 'success',
  queued: 'warning',
  failed: 'danger',
  draft: 'muted',
  pending_approval: 'warning',
  approved: 'success',
  sending: 'warning',
  active: 'success',
  disabled: 'muted',
  needs_review: 'warning',
};

const COLUMNS = {
  tickets: [
    ['ticket_code', 'Ticket'],
    ['subject', 'Subject'],
    ['patient.full_name', 'Patient'],
    ['category', 'Category'],
    ['priority', 'Priority', 'status'],
    ['status', 'Status', 'status'],
    ['sla_state', 'SLA', 'status'],
    ['assigned_user.full_name', 'Assignee'],
    ['updated_at', 'Last activity'],
  ],
  sla: [
    ['ticket_code', 'Ticket'],
    ['subject', 'Subject'],
    ['patient.full_name', 'Patient'],
    ['priority', 'Priority', 'status'],
    ['status', 'Status', 'status'],
    ['sla_due_at', 'SLA due'],
    ['overdue_ms', 'Overdue'],
    ['assigned_department.department_name', 'Department'],
    ['assigned_user.full_name', 'Assignee'],
  ],
  technical: [
    ['ticket_code', 'Ticket'],
    ['subject', 'Subject'],
    ['metadata.module', 'Module'],
    ['metadata.severity', 'Severity', 'status'],
    ['metadata.impact', 'Impact'],
    ['metadata.error_code', 'Error code'],
    ['metadata.request_id', 'Request ID'],
    ['priority', 'Priority', 'status'],
    ['status', 'Status', 'status'],
  ],
  account: [
    ['ticket_code', 'Ticket'],
    ['subject', 'Subject'],
    ['patient.full_name', 'Patient'],
    ['metadata.issue_type', 'Issue'],
    ['metadata.linked_user_id', 'User'],
    ['metadata.linked_patient_account_id', 'Portal account'],
    ['priority', 'Priority', 'status'],
    ['status', 'Status', 'status'],
  ],
  billing: [
    ['ticket_code', 'Ticket'],
    ['subject', 'Subject'],
    ['patient.full_name', 'Patient'],
    ['metadata.invoice_id', 'Invoice'],
    ['metadata.payment_intent_id', 'Payment intent'],
    ['metadata.intent_code', 'Intent code'],
    ['metadata.payment_action_taken', 'Action'],
    ['status', 'Status', 'status'],
  ],
  conversations: [
    ['conversation_code', 'Conversation'],
    ['title', 'Title'],
    ['type', 'Type'],
    ['priority', 'Priority', 'status'],
    ['status', 'Status', 'status'],
    ['patient.full_name', 'Patient'],
    ['assigned_user.full_name', 'Assignee'],
    ['last_message_at', 'Last message'],
  ],
  systemMessages: [
    ['created_at', 'Time'],
    ['body', 'Message'],
    ['conversation_id.conversation_code', 'Conversation'],
    ['sender_actor_type', 'Actor'],
    ['requires_acknowledgement', 'Ack'],
    ['status', 'Status', 'status'],
  ],
  notifications: [
    ['title', 'Notification'],
    ['recipient_type', 'Recipient type'],
    ['channel', 'Channel'],
    ['notification_type', 'Type'],
    ['event_type', 'Event'],
    ['priority', 'Priority', 'status'],
    ['status', 'Status', 'status'],
    ['failure_reason', 'Failure'],
    ['created_at', 'Created'],
  ],
  broadcast: [
    ['campaign_code', 'Campaign'],
    ['name', 'Name'],
    ['audience_type', 'Audience'],
    ['resolved_recipient_count', 'Recipients'],
    ['channels', 'Channels'],
    ['status', 'Status', 'status'],
    ['scheduled_at', 'Schedule'],
    ['completed_at', 'Completed'],
  ],
  notificationTemplates: [
    ['template_code', 'Code'],
    ['event_type', 'Event type'],
    ['language', 'Lang'],
    ['priority', 'Priority', 'status'],
    ['channels', 'Channels'],
    ['active', 'Active'],
    ['updated_at', 'Updated'],
  ],
  replyTemplates: [
    ['template_code', 'Code'],
    ['name', 'Name'],
    ['category', 'Category'],
    ['language', 'Lang'],
    ['tone', 'Tone'],
    ['usage_count', 'Used'],
    ['status', 'Status', 'status'],
    ['active', 'Active'],
  ],
};

function getRowId(row = {}) {
  return row.id || row._id || row.ticket_code || row.conversation_code || row.campaign_code || row.template_code;
}

function getNested(row, path) {
  return String(path || '').split('.').reduce((value, key) => (value ? value[key] : undefined), row);
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (value > 1000000 && value % 1000 !== 0) return `${Math.round(value / 60000).toLocaleString('vi-VN')}m`;
    return value.toLocaleString('vi-VN');
  }
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) return new Date(value).toLocaleString('vi-VN');
  if (typeof value === 'object') return value.full_name || value.name || value.title || value.ticket_code || value.conversation_code || value.id || JSON.stringify(value);
  return String(value);
}

function StatusBadge({ value }) {
  const text = value || 'unknown';
  const tone = STATUS_TONE[text] || STATUS_TONE[String(text).toLowerCase()] || 'neutral';
  return <span className={`scm-badge scm-badge--${tone}`}>{formatValue(text)}</span>;
}

function ActionButton({ icon: Icon, label, onClick, variant = 'default', disabled = false }) {
  return (
    <button type="button" className={`scm-action scm-action--${variant}`} onClick={onClick} disabled={disabled}>
      {Icon ? <Icon size={16} strokeWidth={2.25} aria-hidden="true" /> : null}
      <span>{label}</span>
    </button>
  );
}

function IconButton({ icon: Icon, label, onClick, disabled = false }) {
  return (
    <button type="button" className="scm-icon-button" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      <Icon size={16} strokeWidth={2.25} />
    </button>
  );
}

function KpiCard({ label, value, tone = 'neutral', icon: Icon }) {
  return (
    <article className={`scm-kpi scm-kpi--${tone}`}>
      <div className="scm-kpi__icon">{Icon ? <Icon size={18} strokeWidth={2.25} /> : <Gauge size={18} strokeWidth={2.25} />}</div>
      <div>
        <span>{label}</span>
        <strong>{formatValue(value)}</strong>
      </div>
    </article>
  );
}

function JsonBlock({ value }) {
  return <pre className="scm-json">{JSON.stringify(value || {}, null, 2)}</pre>;
}

function EmptyState({ title = 'Chưa có dữ liệu', description = 'Dữ liệu sẽ xuất hiện khi backend có bản ghi phù hợp bộ lọc.' }) {
  return (
    <div className="scm-empty">
      <MessageSquare size={28} strokeWidth={2.1} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function buildKpis(view, overview, summary, rows) {
  if (view === 'sla') {
    const kpis = summary?.kpis || {};
    return [
      ['Quá SLA', kpis.breached ?? rows.length, 'danger', AlertTriangle],
      ['Urgent breach', kpis.urgent_breached, 'danger', ShieldAlert],
      ['High breach', kpis.high_breached, 'warning', AlertTriangle],
      ['Risk < 15m', kpis.warning_15m, 'warning', Clock3],
      ['Risk < 60m', kpis.warning_60m, 'info', Clock3],
      ['Unassigned risk', kpis.unassigned_risk, 'danger', UserRound],
    ];
  }
  if (view === 'notifications') {
    const kpis = summary?.kpis || {};
    return [
      ['Created today', kpis.created_today, 'info', BellRing],
      ['Queued', kpis.queued, 'warning', Clock3],
      ['Delivered', kpis.delivered, 'success', CheckCircle2],
      ['Read', kpis.read, 'success', Eye],
      ['Failed', kpis.failed, 'danger', ShieldAlert],
      ['Cancelled', kpis.cancelled, 'muted', X],
    ];
  }
  const base = overview?.kpis || {};
  return [
    ['Ticket hôm nay', base.today_tickets, 'info', TicketCheck],
    ['Đang mở', base.open_tickets, 'warning', Activity],
    ['Chờ nhân sự', base.waiting_staff, 'warning', Clock3],
    ['Chưa gán', base.unassigned, 'danger', UserRound],
    ['Quá SLA', base.overdue, 'danger', AlertTriangle],
    ['Failed notify', Number(base.failed_notifications || 0) + Number(base.failed_deliveries || 0), 'danger', ShieldAlert],
    ['Conversations', base.open_conversations, 'info', MessageSquare],
    ['Templates', Number(base.active_templates || 0) + Number(base.active_reply_templates || 0), 'success', FileText],
  ];
}

function DetailDrawer({ view, detail, row, onClose, onAction }) {
  if (!row) return null;
  const ticket = detail?.ticket || row;
  const title = ticket.ticket_code || ticket.conversation_code || ticket.title || ticket.name || ticket.template_code || 'Detail';
  const messages = detail?.messages || [];
  const deliveries = detail?.deliveries || [];
  const context = detail?.context || {};

  return (
    <aside className="scm-drawer">
      <div className="scm-drawer__header">
        <div>
          <span>Detail drawer</span>
          <strong>{title}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close detail"><X size={18} /></button>
      </div>

      {['tickets', 'sla', 'technical', 'account', 'billing'].includes(view) ? (
        <>
          <section className="scm-drawer-card">
            <h3>Ticket summary</h3>
            <div className="scm-pairs">
              <span>Subject</span><strong>{formatValue(ticket.subject)}</strong>
              <span>Priority</span><StatusBadge value={ticket.priority} />
              <span>Status</span><StatusBadge value={ticket.status} />
              <span>SLA</span><StatusBadge value={ticket.sla_state} />
              <span>Assignee</span><strong>{formatValue(ticket.assigned_user?.full_name)}</strong>
            </div>
          </section>
          <section className="scm-drawer-card">
            <h3>Patient context</h3>
            <div className="scm-patient-mini">
              <strong>{formatValue(ticket.patient?.full_name || context.patient?.full_name)}</strong>
              <span>{formatValue(ticket.patient?.patient_code || context.patient?.patient_code)}</span>
              <span>{formatValue(ticket.patient?.phone || context.patient?.phone)}</span>
            </div>
            <div className="scm-risk-list">
              {(context.risk_flags || []).map((flag) => (
                <span key={flag.code} className={`scm-risk scm-risk--${flag.severity}`}>{flag.message}</span>
              ))}
            </div>
          </section>
          <section className="scm-drawer-card">
            <h3>Conversation</h3>
            <div className="scm-message-stream">
              {messages.slice(-6).map((message) => (
                <div key={message.id || message._id} className={`scm-message${message.is_internal_note ? ' is-internal' : ''}`}>
                  <span>{message.sender_actor_type}</span>
                  <p>{message.body || message.message_type}</p>
                </div>
              ))}
              {messages.length === 0 ? <span className="scm-muted">Chưa có message trong drawer.</span> : null}
            </div>
          </section>
          <div className="scm-drawer-actions">
            <ActionButton icon={Send} label="Reply" onClick={() => onAction('reply', ticket)} />
            <ActionButton icon={UserRound} label="Assign" onClick={() => onAction('assign', ticket)} />
            <ActionButton icon={CheckCircle2} label="Resolve" onClick={() => onAction('resolve', ticket)} variant="success" />
            <ActionButton icon={AlertTriangle} label="Escalate" onClick={() => onAction('escalate', ticket)} variant="danger" />
          </div>
        </>
      ) : null}

      {view === 'conversations' ? (
        <section className="scm-drawer-card">
          <h3>Conversation stream</h3>
          <div className="scm-message-stream scm-message-stream--tall">
            {(detail?.messages || []).map((message) => (
              <div key={message.id || message._id} className={`scm-message${message.is_internal_note ? ' is-internal' : ''}`}>
                <span>{message.sender_actor_type} · {formatValue(message.created_at)}</span>
                <p>{message.body || message.message_type}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view === 'notifications' ? (
        <>
          <section className="scm-drawer-card">
            <h3>Delivery attempts</h3>
            <div className="scm-mini-table">
              {deliveries.map((delivery) => (
                <div key={delivery.id || delivery._id}>
                  <StatusBadge value={delivery.status} />
                  <span>{delivery.channel}</span>
                  <span>{delivery.provider || 'default'}</span>
                  <span>{delivery.last_error || '—'}</span>
                </div>
              ))}
            </div>
          </section>
          <div className="scm-drawer-actions">
            <ActionButton icon={RefreshCw} label="Retry" onClick={() => onAction('retryNotification', row)} />
            <ActionButton icon={Play} label="Dispatch" onClick={() => onAction('dispatchNotification', row)} />
          </div>
        </>
      ) : null}

      <section className="scm-drawer-card">
        <h3>Raw JSON</h3>
        <JsonBlock value={detail || row} />
      </section>
    </aside>
  );
}

export function SupportCommunicationPage({ view = 'tickets' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.tickets;
  const Icon = config.icon;
  const [overview, setOverview] = useState(null);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', category: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionResult, setActionResult] = useState('');

  const query = useMemo(() => ({
    search: filters.search,
    status: filters.status,
    priority: filters.priority,
    category: filters.category,
    limit: 30,
  }), [filters]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewData, summaryData, listData] = await Promise.all([
        supportCommGet('/overview').catch(() => null),
        config.summaryEndpoint ? supportCommGet(config.summaryEndpoint).catch(() => null) : Promise.resolve(null),
        supportCommGet(config.endpoint, query),
      ]);
      setOverview(overviewData);
      setSummary(summaryData);
      setRows(Array.isArray(listData?.items) ? listData.items : Array.isArray(listData) ? listData : []);
      setPagination(listData?.pagination || null);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.summaryEndpoint, query]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setSelectedRow(null);
    setDetail(null);
    setActionResult('');
  }, [view]);

  const openDetail = async (row) => {
    setSelectedRow(row);
    setDetail(null);
    const detailPath = config.detail?.(row);
    if (!detailPath) {
      setDetail(row);
      return;
    }
    try {
      setDetail(await supportCommGet(detailPath));
    } catch (err) {
      setDetail({ error: err.message, row });
    }
  };

  const runAction = async (action, row = selectedRow) => {
    if (!row && !['scanSla', 'dispatchQueued', 'seedNotificationTemplates', 'seedReplyTemplates', 'createBroadcastDraft'].includes(action)) return;
    setActionResult('');
    try {
      let result = null;
      if (action === 'scanSla') result = await supportCommPost('/sla/scan', { limit: 200 });
      if (action === 'dispatchQueued') result = await supportCommPost('/notifications/dispatch-queued', { limit: 100 });
      if (action === 'seedNotificationTemplates') result = await supportCommPost('/notification-templates/seed-defaults');
      if (action === 'seedReplyTemplates') result = await supportCommPost('/reply-templates/seed-defaults');
      if (action === 'createBroadcastDraft') {
        result = await supportCommPost('/broadcasts', {
          name: `Portal notice ${new Date().toLocaleDateString('vi-VN')}`,
          audience_type: 'staff',
          audience_query: { type: 'staff', limit: 50 },
          channels: ['in_app'],
          title_template: 'Thông báo vận hành',
          body_template: 'Đây là bản nháp broadcast từ Support & Communication.',
          priority: 'normal',
          status: 'draft',
        });
      }
      if (action === 'reply') result = await supportCommPost(`/tickets/${getRowId(row)}/reply`, { body: 'Chúng tôi đã ghi nhận và đang xử lý ticket của bạn.' });
      if (action === 'assign') result = await supportCommPost(`/tickets/${getRowId(row)}/internal-note`, { body: 'Ticket cần được điều phối/gán nhân sự phụ trách.' });
      if (action === 'resolve') result = await supportCommPost(`/tickets/${getRowId(row)}/resolve`, { reason: 'Đã xử lý từ Support & Communication.' });
      if (action === 'escalate') result = await supportCommPost(`/tickets/${getRowId(row)}/escalate`, { reason: 'Escalate từ command center.', priority: 'urgent' });
      if (action === 'retryNotification') result = await supportCommPost(`/notifications/${getRowId(row)}/retry`);
      if (action === 'dispatchNotification') result = await supportCommPost(`/notifications/${getRowId(row)}/dispatch`);
      if (action === 'sendBroadcast') result = await supportCommPost(`/broadcasts/${getRowId(row)}/send`);
      if (action === 'approveBroadcast') result = await supportCommPost(`/broadcasts/${getRowId(row)}/approve`, { note: 'Approved from admin UI.' });
      if (action === 'deleteNotificationTemplate') result = await supportCommDelete(`/notification-templates/${getRowId(row)}`);
      if (action === 'toggleReplyTemplate') result = await supportCommPatch(`/reply-templates/${getRowId(row)}`, { active: !row.active });
      setActionResult(`Đã thực hiện: ${action}`);
      await loadData();
      if (row) await openDetail(row);
      return result;
    } catch (err) {
      setActionResult(err.message || 'Action thất bại.');
      return null;
    }
  };

  const kpis = buildKpis(view, overview, summary, rows);
  const columns = COLUMNS[view] || COLUMNS.tickets;

  return (
    <div className="scm-page">
      <header className={`scm-hero scm-hero--${config.intent || 'default'}`}>
        <div className="scm-hero__icon">
          <Icon size={28} strokeWidth={2.25} />
        </div>
        <div className="scm-hero__copy">
          <span>Quản trị hệ thống / Support & Communication</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
          <div className="scm-hero__badges">
            <StatusBadge value={error ? 'degraded' : 'live'} />
            <span>Realtime ready</span>
            <span>Admin API: /api/admin/support-communication</span>
          </div>
        </div>
        <div className="scm-hero__actions">
          <ActionButton icon={RefreshCw} label="Refresh" onClick={loadData} disabled={loading} />
          {view === 'sla' ? <ActionButton icon={Play} label="Scan SLA" onClick={() => runAction('scanSla')} variant="danger" /> : null}
          {view === 'notifications' ? <ActionButton icon={Send} label="Dispatch queued" onClick={() => runAction('dispatchQueued')} /> : null}
          {view === 'broadcast' ? <ActionButton icon={RadioTower} label="New draft" onClick={() => runAction('createBroadcastDraft')} /> : null}
          {view === 'notificationTemplates' ? <ActionButton icon={FileText} label="Seed defaults" onClick={() => runAction('seedNotificationTemplates')} /> : null}
          {view === 'replyTemplates' ? <ActionButton icon={BookOpen} label="Seed defaults" onClick={() => runAction('seedReplyTemplates')} /> : null}
          <ActionButton icon={Download} label="Export" onClick={() => setActionResult('Export sẽ dùng endpoint logs/export khi cần file thực tế.')} />
        </div>
      </header>

      <nav className="scm-nav">
        {NAV_ITEMS.map(([key, label, NavIcon]) => (
          <Link key={key} to={`/admin/support-communication/${key === 'tickets' ? 'tickets' : key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`} className={`scm-nav__item${view === key ? ' is-active' : ''}`}>
            <NavIcon size={16} strokeWidth={2.25} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <section className="scm-kpi-strip">
        {kpis.map(([label, value, tone, KpiIcon]) => (
          <KpiCard key={label} label={label} value={value ?? 0} tone={tone} icon={KpiIcon} />
        ))}
      </section>

      <section className="scm-command">
        <div className="scm-search">
          <Search size={17} strokeWidth={2.25} />
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search ticket, patient, request_id, event_type, template..." />
        </div>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">All status</option>
          {['open', 'waiting_staff', 'waiting_patient', 'resolved', 'closed', 'queued', 'sent', 'delivered', 'failed', 'draft', 'active'].map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}>
          <option value="">All priority</option>
          {['urgent', 'high', 'normal', 'low', 'critical'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
        <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
          <option value="">All category</option>
          {['appointment', 'billing', 'insurance', 'medical_record', 'technical', 'complaint', 'pharmacy', 'other'].map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <button type="button" onClick={loadData}><Filter size={16} /> Apply</button>
      </section>

      {error ? <div className="scm-alert"><ShieldAlert size={18} />{error}</div> : null}
      {actionResult ? <div className="scm-result"><CheckCircle2 size={18} />{actionResult}</div> : null}

      <main className="scm-workspace">
        <section className="scm-main-panel">
          {view === 'broadcast' ? (
            <div className="scm-wizard">
              {['Audience', 'Compose', 'Channel', 'Schedule', 'Safety check', 'Result'].map((step, index) => (
                <article key={step}>
                  <span>{index + 1}</span>
                  <strong>{step}</strong>
                </article>
              ))}
            </div>
          ) : null}

          {view === 'sla' && summary?.heatmap ? (
            <div className="scm-heatmap">
              {['by_category', 'by_priority', 'by_department'].map((bucket) => (
                <article key={bucket}>
                  <h3>{bucket.replace('by_', 'Theo ')}</h3>
                  {(summary.heatmap[bucket] || []).slice(0, 6).map((item) => (
                    <div key={String(item._id || 'unassigned')}>
                      <span>{formatValue(item._id || 'unassigned')}</span>
                      <strong>{formatValue(item.breached || item.count)}</strong>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          ) : null}

          <div className="scm-table-wrap">
            <table className="scm-table">
              <thead>
                <tr>
                  {columns.map(([, label]) => <th key={label}>{label}</th>)}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={getRowId(row)} className={selectedRow && getRowId(selectedRow) === getRowId(row) ? 'is-selected' : ''} onClick={() => openDetail(row)}>
                    {columns.map(([path, label, type]) => {
                      const value = getNested(row, path);
                      return (
                        <td key={`${getRowId(row)}-${label}`}>
                          {type === 'status' ? <StatusBadge value={value} /> : <span>{formatValue(value)}</span>}
                        </td>
                      );
                    })}
                    <td>
                      <div className="scm-row-actions">
                        <IconButton icon={Eye} label="View" onClick={(event) => { event.stopPropagation(); openDetail(row); }} />
                        <IconButton icon={Copy} label="Copy ID" onClick={(event) => { event.stopPropagation(); navigator.clipboard?.writeText(String(getRowId(row))); }} />
                        {view === 'broadcast' ? <IconButton icon={Play} label="Send" onClick={(event) => { event.stopPropagation(); runAction('sendBroadcast', row); }} /> : null}
                        {['tickets', 'sla', 'technical', 'account', 'billing'].includes(view) ? <IconButton icon={CheckCircle2} label="Resolve" onClick={(event) => { event.stopPropagation(); runAction('resolve', row); }} /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? <EmptyState /> : null}
          </div>

          <footer className="scm-table-footer">
            <span>{formatValue(pagination?.total ?? rows.length)} records</span>
            <span>{loading ? 'Đang tải...' : `Page ${pagination?.page || 1}/${pagination?.total_pages || 1}`}</span>
          </footer>
        </section>

        <aside className="scm-side-panel">
          <section>
            <h2>Việc cần xử lý</h2>
            {(overview?.work_queue || []).map((item) => (
              <Link key={item.type} to={item.action || '#'} className="scm-work-item">
                <span>{item.label}</span>
                <strong>{formatValue(item.count)}</strong>
                {item.sla_overdue ? <StatusBadge value="breached" /> : null}
              </Link>
            ))}
          </section>
          <section>
            <h2>Realtime activity</h2>
            <div className="scm-activity">
              <div><BellRing size={15} /><span>notification.delivery_failed → failed inbox</span></div>
              <div><TicketCheck size={15} /><span>support_ticket.created → inbox prepend</span></div>
              <div><AlertTriangle size={15} /><span>support_ticket.sla_breached → SLA War Room</span></div>
              <div><MessageSquare size={15} /><span>message.sent → conversation stream</span></div>
            </div>
          </section>
          <section>
            <h2>Health</h2>
            {Object.entries(overview?.health || {}).map(([key, value]) => (
              <div key={key} className="scm-health-row">
                <span>{key.replace(/_/g, ' ')}</span>
                <StatusBadge value={value} />
              </div>
            ))}
          </section>
        </aside>
      </main>

      <DetailDrawer view={view} row={selectedRow} detail={detail} onClose={() => setSelectedRow(null)} onAction={runAction} />
    </div>
  );
}
