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
import { Link, useLocation } from 'react-router-dom';
import { AdminActionConfirmDialog } from '../components/AdminActionConfirmDialog';
import {
  supportCommDelete,
  supportCommGet,
  supportCommPatch,
  supportCommPost,
} from './supportCommunicationApi';

const VIEW_CONFIG = {
  tickets: {
    title: 'Ticket hỗ trợ',
    subtitle: 'Support inbox cho ticket bệnh nhân, người thân và nhân sự nội bộ với SLA, assignment, conversation và audit.',
    icon: TicketCheck,
    endpoint: '/tickets',
    detail: (row) => `/tickets/${row.id}`,
  },
  sla: {
    title: 'Ticket quá SLA',
    subtitle: 'Phòng xử lý SLA: ticket quá hạn, sắp quá hạn, rủi ro chưa gán và hành động cứu SLA.',
    icon: AlertTriangle,
    endpoint: '/tickets/overdue',
    summaryEndpoint: '/sla/overview',
    detail: (row) => `/tickets/${row.id}`,
    intent: 'danger',
  },
  technical: {
    title: 'Ticket kỹ thuật',
    subtitle: 'Bàn hỗ trợ kỹ thuật cho xác thực, OAuth, RBAC, realtime, thông báo, thanh toán và tải tệp.',
    icon: ServerCog,
    endpoint: '/technical/tickets',
    summaryEndpoint: '/technical/overview',
    detail: (row) => `/tickets/${row.id}`,
  },
  account: {
    title: 'Ticket liên quan tài khoản',
    subtitle: 'Hỗ trợ tài khoản cho đăng nhập, mật khẩu, tài khoản bị khóa, Google OAuth, từ chối quyền và ủy quyền portal.',
    icon: UserRound,
    endpoint: '/account/tickets',
    detail: (row) => `/tickets/${row.id}`,
  },
  billing: {
    title: 'Ticket liên quan thanh toán',
    subtitle: 'Bàn hỗ trợ thanh toán kết nối ticket với hóa đơn, payment intent, QR, giao dịch ngân hàng và đối soát.',
    icon: ReceiptText,
    endpoint: '/billing/tickets',
    detail: (row) => `/tickets/${row.id}`,
  },
  conversations: {
    title: 'Hội thoại nội bộ',
    subtitle: 'Trung tâm hội thoại cho nội bộ, hỗ trợ, thanh toán, bảo hiểm, nhà thuốc, xét nghiệm, chẩn đoán hình ảnh và khẩn cấp.',
    icon: MessageSquare,
    endpoint: '/conversations',
    detail: (row) => `/conversations/${row.id}`,
  },
  systemMessages: {
    title: 'Tin nhắn hệ thống',
    subtitle: 'Tra cứu tin nhắn hệ thống theo sự kiện, đối tượng liên kết, xác nhận đọc và ngữ cảnh hội thoại.',
    icon: BellRing,
    endpoint: '/system-messages',
    detail: (row) => row.conversation_id?._id ? `/conversations/${row.conversation_id._id}` : null,
  },
  notifications: {
    title: 'Thông báo hệ thống',
    subtitle: 'Vận hành thông báo: tạo, gửi, thử lại, hủy, lượt gửi lỗi và sức khỏe kênh.',
    icon: BellRing,
    endpoint: '/notifications',
    summaryEndpoint: '/notifications/overview',
    detail: (row) => `/notifications/${row.id}`,
  },
  broadcast: {
    title: 'Thông báo broadcast',
    subtitle: 'Wizard gửi thông báo hàng loạt theo audience, channel, schedule, safety check và campaign delivery.',
    icon: RadioTower,
    endpoint: '/broadcasts',
    detail: (row) => `/broadcasts/${row.id}`,
  },
  notificationTemplates: {
    title: 'Mẫu thông báo',
    subtitle: 'Quản lý mẫu tự động theo loại sự kiện, ngôn ngữ, kênh, xem trước và kiểm tra hợp lệ.',
    icon: FileText,
    endpoint: '/notification-templates',
    detail: (row) => `/notification-templates/${row.id}`,
  },
  replyTemplates: {
    title: 'Mẫu phản hồi hỗ trợ',
    subtitle: 'Câu trả lời nhanh cho nhân sự hỗ trợ theo danh mục, giọng điệu, biến, mức sử dụng và duyệt.',
    icon: BookOpen,
    endpoint: '/reply-templates',
    detail: (row) => `/reply-templates/${row.id}`,
  },
};

const NAV_ITEMS = [
  ['tickets', 'Ticket hỗ trợ', TicketCheck],
  ['sla', 'Quá SLA', AlertTriangle],
  ['technical', 'Kỹ thuật', ServerCog],
  ['account', 'Tài khoản', UserRound],
  ['billing', 'Thanh toán', ReceiptText],
  ['conversations', 'Hội thoại', MessageSquare],
  ['systemMessages', 'Tin nhắn hệ thống', BellRing],
  ['notifications', 'Thông báo', BellRing],
  ['broadcast', 'Broadcast', RadioTower],
  ['notificationTemplates', 'Mẫu thông báo', FileText],
  ['replyTemplates', 'Mẫu phản hồi', BookOpen],
];

const VALUE_LABELS = {
  open: 'Đang mở',
  waiting_staff: 'Chờ nhân sự',
  waiting_patient: 'Chờ bệnh nhân',
  resolved: 'Đã xử lý',
  closed: 'Đã đóng',
  cancelled: 'Đã hủy',
  breached: 'Quá hạn',
  warning: 'Cảnh báo',
  ok: 'Ổn định',
  urgent: 'Khẩn cấp',
  high: 'Cao',
  normal: 'Bình thường',
  low: 'Thấp',
  sent: 'Đã gửi',
  delivered: 'Đã nhận',
  read: 'Đã đọc',
  queued: 'Trong hàng đợi',
  failed: 'Lỗi',
  draft: 'Bản nháp',
  pending_approval: 'Chờ duyệt',
  approved: 'Đã duyệt',
  sending: 'Đang gửi',
  active: 'Đang hoạt động',
  disabled: 'Đã tắt',
  needs_review: 'Cần rà soát',
  live: 'Đang chạy',
  degraded: 'Suy giảm',
  staff: 'Nhân sự',
  patient: 'Bệnh nhân',
  patient_relative: 'Người thân',
  appointment: 'Lịch hẹn',
  billing: 'Thanh toán',
  insurance: 'Bảo hiểm',
  medical_record: 'Hồ sơ y tế',
  technical: 'Kỹ thuật',
  complaint: 'Khiếu nại',
  pharmacy: 'Nhà thuốc',
  other: 'Khác',
};

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
    ['subject', 'Tiêu đề'],
    ['patient.full_name', 'Bệnh nhân'],
    ['category', 'Danh mục'],
    ['priority', 'Ưu tiên', 'status'],
    ['status', 'Trạng thái', 'status'],
    ['sla_state', 'SLA', 'status'],
    ['assigned_user.full_name', 'Người phụ trách'],
    ['updated_at', 'Hoạt động gần nhất'],
  ],
  sla: [
    ['ticket_code', 'Ticket'],
    ['subject', 'Tiêu đề'],
    ['patient.full_name', 'Bệnh nhân'],
    ['priority', 'Ưu tiên', 'status'],
    ['status', 'Trạng thái', 'status'],
    ['sla_due_at', 'Hạn SLA'],
    ['overdue_ms', 'Quá hạn'],
    ['assigned_department.department_name', 'Khoa/phòng'],
    ['assigned_user.full_name', 'Người phụ trách'],
  ],
  technical: [
    ['ticket_code', 'Ticket'],
    ['subject', 'Tiêu đề'],
    ['metadata.module', 'Module'],
    ['metadata.severity', 'Mức độ', 'status'],
    ['metadata.impact', 'Ảnh hưởng'],
    ['metadata.error_code', 'Mã lỗi'],
    ['metadata.request_id', 'ID yêu cầu'],
    ['priority', 'Ưu tiên', 'status'],
    ['status', 'Trạng thái', 'status'],
  ],
  account: [
    ['ticket_code', 'Ticket'],
    ['subject', 'Tiêu đề'],
    ['patient.full_name', 'Bệnh nhân'],
    ['metadata.issue_type', 'Vấn đề'],
    ['metadata.linked_user_id', 'Người dùng'],
    ['metadata.linked_patient_account_id', 'Tài khoản portal'],
    ['priority', 'Ưu tiên', 'status'],
    ['status', 'Trạng thái', 'status'],
  ],
  billing: [
    ['ticket_code', 'Ticket'],
    ['subject', 'Tiêu đề'],
    ['patient.full_name', 'Bệnh nhân'],
    ['metadata.invoice_id', 'Hóa đơn'],
    ['metadata.payment_intent_id', 'Payment intent'],
    ['metadata.intent_code', 'Mã intent'],
    ['metadata.payment_action_taken', 'Hành động'],
    ['status', 'Trạng thái', 'status'],
  ],
  conversations: [
    ['conversation_code', 'Hội thoại'],
    ['title', 'Tiêu đề'],
    ['type', 'Loại'],
    ['priority', 'Ưu tiên', 'status'],
    ['status', 'Trạng thái', 'status'],
    ['patient.full_name', 'Bệnh nhân'],
    ['assigned_user.full_name', 'Người phụ trách'],
    ['last_message_at', 'Tin gần nhất'],
  ],
  systemMessages: [
    ['created_at', 'Thời gian'],
    ['body', 'Tin nhắn'],
    ['conversation_id.conversation_code', 'Hội thoại'],
    ['sender_actor_type', 'Đối tượng gửi'],
    ['requires_acknowledgement', 'Cần xác nhận'],
    ['status', 'Trạng thái', 'status'],
  ],
  notifications: [
    ['title', 'Thông báo'],
    ['recipient_type', 'Loại người nhận'],
    ['channel', 'Kênh'],
    ['notification_type', 'Loại'],
    ['event_type', 'Sự kiện'],
    ['priority', 'Ưu tiên', 'status'],
    ['status', 'Trạng thái', 'status'],
    ['failure_reason', 'Lý do lỗi'],
    ['created_at', 'Ngày tạo'],
  ],
  broadcast: [
    ['campaign_code', 'Chiến dịch'],
    ['name', 'Tên'],
    ['audience_type', 'Đối tượng nhận'],
    ['resolved_recipient_count', 'Người nhận'],
    ['channels', 'Kênh'],
    ['status', 'Trạng thái', 'status'],
    ['scheduled_at', 'Lịch gửi'],
    ['completed_at', 'Hoàn tất'],
  ],
  notificationTemplates: [
    ['template_code', 'Mã'],
    ['event_type', 'Loại sự kiện'],
    ['language', 'Ngôn ngữ'],
    ['priority', 'Ưu tiên', 'status'],
    ['channels', 'Kênh'],
    ['active', 'Hoạt động'],
    ['updated_at', 'Cập nhật'],
  ],
  replyTemplates: [
    ['template_code', 'Mã'],
    ['name', 'Tên'],
    ['category', 'Danh mục'],
    ['language', 'Ngôn ngữ'],
    ['tone', 'Giọng điệu'],
    ['usage_count', 'Số lần dùng'],
    ['status', 'Trạng thái', 'status'],
    ['active', 'Hoạt động'],
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
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') {
    if (value > 1000000 && value % 1000 !== 0) return `${Math.round(value / 60000).toLocaleString('vi-VN')}m`;
    return value.toLocaleString('vi-VN');
  }
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) return new Date(value).toLocaleString('vi-VN');
  if (typeof value === 'object') return value.full_name || value.name || value.title || value.ticket_code || value.conversation_code || value.id || JSON.stringify(value);
  return VALUE_LABELS[String(value).toLowerCase()] || String(value).replace(/_/g, ' ');
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
      ['Khẩn cấp quá hạn', kpis.urgent_breached, 'danger', ShieldAlert],
      ['Ưu tiên cao quá hạn', kpis.high_breached, 'warning', AlertTriangle],
      ['Rủi ro < 15p', kpis.warning_15m, 'warning', Clock3],
      ['Rủi ro < 60p', kpis.warning_60m, 'info', Clock3],
      ['Rủi ro chưa gán', kpis.unassigned_risk, 'danger', UserRound],
    ];
  }
  if (view === 'notifications') {
    const kpis = summary?.kpis || {};
    return [
      ['Tạo hôm nay', kpis.created_today, 'info', BellRing],
      ['Trong hàng đợi', kpis.queued, 'warning', Clock3],
      ['Đã nhận', kpis.delivered, 'success', CheckCircle2],
      ['Đã đọc', kpis.read, 'success', Eye],
      ['Lỗi', kpis.failed, 'danger', ShieldAlert],
      ['Đã hủy', kpis.cancelled, 'muted', X],
    ];
  }
  const base = overview?.kpis || {};
  return [
    ['Ticket hôm nay', base.today_tickets, 'info', TicketCheck],
    ['Đang mở', base.open_tickets, 'warning', Activity],
    ['Chờ nhân sự', base.waiting_staff, 'warning', Clock3],
    ['Chưa gán', base.unassigned, 'danger', UserRound],
    ['Quá SLA', base.overdue, 'danger', AlertTriangle],
    ['Thông báo lỗi', Number(base.failed_notifications || 0) + Number(base.failed_deliveries || 0), 'danger', ShieldAlert],
    ['Hội thoại', base.open_conversations, 'info', MessageSquare],
    ['Mẫu đang dùng', Number(base.active_templates || 0) + Number(base.active_reply_templates || 0), 'success', FileText],
  ];
}

function DetailDrawer({ view, detail, row, onClose, onAction }) {
  if (!row) return null;
  const ticket = detail?.ticket || row;
  const title = ticket.ticket_code || ticket.conversation_code || ticket.title || ticket.name || ticket.template_code || 'Chi tiết';
  const messages = detail?.messages || [];
  const deliveries = detail?.deliveries || [];
  const context = detail?.context || {};

  return (
    <aside className="scm-drawer">
      <div className="scm-drawer__header">
        <div>
          <span>Chi tiết bản ghi</span>
          <strong>{title}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết"><X size={18} /></button>
      </div>

      {['tickets', 'sla', 'technical', 'account', 'billing'].includes(view) ? (
        <>
          <section className="scm-drawer-card">
            <h3>Tóm tắt ticket</h3>
            <div className="scm-pairs">
              <span>Tiêu đề</span><strong>{formatValue(ticket.subject)}</strong>
              <span>Ưu tiên</span><StatusBadge value={ticket.priority} />
              <span>Trạng thái</span><StatusBadge value={ticket.status} />
              <span>SLA</span><StatusBadge value={ticket.sla_state} />
              <span>Người phụ trách</span><strong>{formatValue(ticket.assigned_user?.full_name)}</strong>
            </div>
          </section>
          <section className="scm-drawer-card">
            <h3>Ngữ cảnh bệnh nhân</h3>
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
            <h3>Hội thoại</h3>
            <div className="scm-message-stream">
              {messages.slice(-6).map((message) => (
                <div key={message.id || message._id} className={`scm-message${message.is_internal_note ? ' is-internal' : ''}`}>
                  <span>{formatValue(message.sender_actor_type)}</span>
                  <p>{message.body || message.message_type}</p>
                </div>
              ))}
              {messages.length === 0 ? <span className="scm-muted">Chưa có tin nhắn trong chi tiết.</span> : null}
            </div>
          </section>
          <div className="scm-drawer-actions">
            <ActionButton icon={Send} label="Phản hồi" onClick={() => onAction('reply', ticket)} />
            <ActionButton icon={UserRound} label="Gán xử lý" onClick={() => onAction('assign', ticket)} />
            <ActionButton icon={CheckCircle2} label="Đánh dấu xử lý" onClick={() => onAction('resolve', ticket)} variant="success" />
            <ActionButton icon={AlertTriangle} label="Nâng mức ưu tiên" onClick={() => onAction('escalate', ticket)} variant="danger" />
          </div>
        </>
      ) : null}

      {view === 'conversations' ? (
        <section className="scm-drawer-card">
          <h3>Luồng hội thoại</h3>
          <div className="scm-message-stream scm-message-stream--tall">
            {(detail?.messages || []).map((message) => (
              <div key={message.id || message._id} className={`scm-message${message.is_internal_note ? ' is-internal' : ''}`}>
                <span>{formatValue(message.sender_actor_type)} · {formatValue(message.created_at)}</span>
                <p>{message.body || message.message_type}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view === 'notifications' ? (
        <>
          <section className="scm-drawer-card">
            <h3>Lần gửi</h3>
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
            <ActionButton icon={RefreshCw} label="Thử lại" onClick={() => onAction('retryNotification', row)} />
            <ActionButton icon={Play} label="Gửi ngay" onClick={() => onAction('dispatchNotification', row)} />
          </div>
        </>
      ) : null}

      <section className="scm-drawer-card">
        <h3>JSON gốc</h3>
        <JsonBlock value={detail || row} />
      </section>
    </aside>
  );
}


function normalizeSupportRows(listData) {
  if (Array.isArray(listData)) return listData;
  if (Array.isArray(listData?.items)) return listData.items;
  if (Array.isArray(listData?.records)) return listData.records;
  if (Array.isArray(listData?.rows)) return listData.rows;
  if (Array.isArray(listData?.data)) return listData.data;
  return [];
}

function CommunicationRunway({ view, config, overview, rows }) {
  const stages = supportStages(view);
  return (
    <section className="scm-runway">
      <article className="scm-runway__copy">
        <span className="scm-eyebrow">Communication operating model</span>
        <h2>{config.title}</h2>
        <p>Đọc trực tiếp từ backend, hiển thị SLA, trạng thái delivery, người phụ trách, hội thoại và thao tác có xác nhận để chạy được trong vận hành thật.</p>
        <div className="scm-stage-row">
          {stages.map((stage, index) => <span key={stage}><b>{index + 1}</b>{stage}</span>)}
        </div>
      </article>
      <article className="scm-runway__health">
        <strong>Live contract</strong>
        <span>Endpoint: /api/admin/support-communication{config.endpoint}</span>
        <span>Dữ liệu bảng: {formatValue(rows.length)}</span>
        <span>Ticket mở: {formatValue(overview?.kpis?.open_tickets || 0)}</span>
        <span>Notification lỗi: {formatValue(Number(overview?.kpis?.failed_notifications || 0) + Number(overview?.kpis?.failed_deliveries || 0))}</span>
      </article>
    </section>
  );
}

function supportStages(view) {
  const map = {
    tickets: ['Tiếp nhận', 'Gán xử lý', 'Trao đổi', 'Đóng SLA'],
    sla: ['Quét hạn', 'Phân tầng rủi ro', 'Cứu SLA', 'Audit quyết định'],
    technical: ['Ghi lỗi', 'Khoanh vùng module', 'Điều phối kỹ thuật', 'Xác nhận khắc phục'],
    account: ['Định danh tài khoản', 'Kiểm tra rủi ro', 'Hỗ trợ truy cập', 'Ghi audit'],
    billing: ['Liên kết hóa đơn', 'Kiểm tra payment', 'Đối soát', 'Phản hồi khách hàng'],
    conversations: ['Mở luồng', 'Trao đổi', 'Ghim ngữ cảnh', 'Lưu transcript'],
    systemMessages: ['Tạo tin', 'Gửi realtime', 'Xác nhận đọc', 'Truy vết'],
    notifications: ['Queue', 'Dispatch', 'Delivery', 'Retry lỗi'],
    broadcast: ['Audience', 'Nội dung', 'Safety check', 'Gửi chiến dịch'],
    notificationTemplates: ['Biến mẫu', 'Kênh', 'Preview', 'Kích hoạt'],
    replyTemplates: ['Soạn mẫu', 'Duyệt', 'Sử dụng', 'Tối ưu'],
  };
  return map[view] || ['Tải dữ liệu', 'Kiểm tra', 'Thao tác', 'Audit'];
}

export function SupportCommunicationPage({ view = 'tickets' }) {
  const location = useLocation();
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.tickets;
  const Icon = config.icon;
  const [overview, setOverview] = useState(null);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', category: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionResult, setActionResult] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const query = useMemo(() => ({
    search: appliedFilters.search,
    status: appliedFilters.status,
    priority: appliedFilters.priority,
    category: appliedFilters.category,
    limit: 30,
  }), [appliedFilters]);
  const targetConversationId = useMemo(() => new URLSearchParams(location.search).get('conversation_id') || '', [location.search]);

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
      setRows(normalizeSupportRows(listData));
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

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

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

  useEffect(() => {
    if (view !== 'conversations' || !targetConversationId || selectedRow) return;
    const row = rows.find((item) => String(getRowId(item)) === targetConversationId || String(item._id || item.id || '') === targetConversationId);
    if (row) openDetail(row);
  }, [rows, selectedRow, targetConversationId, view]);

  const actionCopy = (action, row = selectedRow) => {
    const target = row?.ticket_code || row?.campaign_code || row?.template_code || row?.title || row?.name || getRowId(row) || config.title;
    const copies = {
      scanSla: ['Quét lại SLA?', 'Hệ thống sẽ rà soát tối đa 200 ticket để cập nhật trạng thái SLA và hàng đợi cứu SLA.', 'Quét SLA', 'warning', false],
      dispatchQueued: ['Gửi thông báo đang chờ?', 'Hệ thống sẽ gửi tối đa 100 thông báo trong hàng đợi ngay bây giờ.', 'Gửi hàng đợi', 'warning', false],
      seedNotificationTemplates: ['Seed mẫu thông báo mặc định?', 'Các mẫu mặc định sẽ được tạo hoặc cập nhật theo cấu hình backend.', 'Seed mẫu', 'warning', false],
      seedReplyTemplates: ['Seed mẫu phản hồi mặc định?', 'Các mẫu phản hồi nhanh sẽ được tạo hoặc cập nhật theo cấu hình backend.', 'Seed mẫu', 'warning', false],
      sendBroadcast: ['Gửi broadcast?', 'Chiến dịch sẽ bắt đầu gửi tới nhóm người nhận đã cấu hình.', 'Gửi broadcast', 'danger', true],
      resolve: ['Đánh dấu ticket đã xử lý?', 'Ticket sẽ chuyển sang trạng thái đã xử lý và ghi nhật ký hỗ trợ.', 'Đánh dấu xử lý', 'success', false],
      escalate: ['Nâng mức ưu tiên ticket?', 'Ticket sẽ được đẩy lên mức khẩn cấp để xử lý nhanh hơn.', 'Nâng mức ưu tiên', 'danger', true],
      retryNotification: ['Thử gửi lại thông báo?', 'Thông báo lỗi sẽ được đưa lại vào pipeline gửi.', 'Thử lại', 'warning', false],
      dispatchNotification: ['Gửi thông báo ngay?', 'Thông báo được chọn sẽ được dispatch ngay qua kênh cấu hình.', 'Gửi ngay', 'warning', false],
      deleteNotificationTemplate: ['Xóa mẫu thông báo?', 'Mẫu sẽ bị xóa khỏi hệ thống và không còn dùng cho sự kiện mới.', 'Xóa mẫu', 'danger', true],
      toggleReplyTemplate: ['Đổi trạng thái mẫu phản hồi?', 'Mẫu phản hồi sẽ được bật hoặc tắt theo trạng thái hiện tại.', 'Đổi trạng thái', 'warning', false],
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
        { label: 'Mã', value: row ? getRowId(row) : config.endpoint },
      ],
    };
  };

  const runAction = async (action, row = selectedRow) => {
    const copy = actionCopy(action, row);
    if (copy) {
      setConfirmAction({ action, row, ...copy });
      return null;
    }
    return executeAction(action, row);
  };

  const executeAction = async (action, row = selectedRow, reasonInput = '') => {
    if (!row && !['scanSla', 'dispatchQueued', 'seedNotificationTemplates', 'seedReplyTemplates', 'createBroadcastDraft'].includes(action)) return;
    setActionResult('');
    setActionBusy(true);
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
      if (action === 'resolve') result = await supportCommPost(`/tickets/${getRowId(row)}/resolve`, { reason: reasonInput || 'Đã xử lý từ Support & Communication.' });
      if (action === 'escalate') result = await supportCommPost(`/tickets/${getRowId(row)}/escalate`, { reason: reasonInput || 'Nâng mức ưu tiên từ trung tâm hỗ trợ.', priority: 'urgent' });
      if (action === 'retryNotification') result = await supportCommPost(`/notifications/${getRowId(row)}/retry`);
      if (action === 'dispatchNotification') result = await supportCommPost(`/notifications/${getRowId(row)}/dispatch`);
      if (action === 'sendBroadcast') result = await supportCommPost(`/broadcasts/${getRowId(row)}/send`);
      if (action === 'approveBroadcast') result = await supportCommPost(`/broadcasts/${getRowId(row)}/approve`, { note: 'Đã duyệt từ giao diện quản trị.' });
      if (action === 'deleteNotificationTemplate') result = await supportCommDelete(`/notification-templates/${getRowId(row)}`);
      if (action === 'toggleReplyTemplate') result = await supportCommPatch(`/reply-templates/${getRowId(row)}`, { active: !row.active });
      setConfirmAction(null);
      setActionResult('Thao tác đã hoàn tất.');
      await loadData();
      if (row) await openDetail(row);
      return result;
    } catch (err) {
      setActionResult(err.message || 'Thao tác thất bại.');
      return null;
    } finally {
      setActionBusy(false);
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
          <span>Quản trị hệ thống / Hỗ trợ & Truyền thông</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
          <div className="scm-hero__badges">
            <StatusBadge value={error ? 'degraded' : 'live'} />
            <span>Sẵn sàng realtime</span>
            <span>Admin API: /api/admin/support-communication</span>
          </div>
        </div>
        <div className="scm-hero__actions">
          <ActionButton icon={RefreshCw} label="Làm mới" onClick={loadData} disabled={loading} />
          {view === 'sla' ? <ActionButton icon={Play} label="Quét SLA" onClick={() => runAction('scanSla')} variant="danger" disabled={actionBusy} /> : null}
          {view === 'notifications' ? <ActionButton icon={Send} label="Gửi hàng đợi" onClick={() => runAction('dispatchQueued')} disabled={actionBusy} /> : null}
          {view === 'broadcast' ? <ActionButton icon={RadioTower} label="Tạo bản nháp" onClick={() => runAction('createBroadcastDraft')} disabled={actionBusy} /> : null}
          {view === 'notificationTemplates' ? <ActionButton icon={FileText} label="Seed mẫu mặc định" onClick={() => runAction('seedNotificationTemplates')} disabled={actionBusy} /> : null}
          {view === 'replyTemplates' ? <ActionButton icon={BookOpen} label="Seed mẫu mặc định" onClick={() => runAction('seedReplyTemplates')} disabled={actionBusy} /> : null}
          <ActionButton icon={Download} label="Xuất dữ liệu" onClick={() => setActionResult('Tính năng xuất sẽ dùng endpoint logs/export khi cần file thực tế.')} />
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

      <CommunicationRunway view={view} config={config} overview={overview} rows={rows} />

      <section className="scm-kpi-strip">
        {kpis.map(([label, value, tone, KpiIcon]) => (
          <KpiCard key={label} label={label} value={value ?? 0} tone={tone} icon={KpiIcon} />
        ))}
      </section>

      <section className="scm-command">
        <div className="scm-search">
          <Search size={17} strokeWidth={2.25} />
          <input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyFilters();
            }}
            placeholder="Tìm ticket, bệnh nhân, request_id, event_type, mẫu..."
          />
        </div>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">Mọi trạng thái</option>
          {['open', 'waiting_staff', 'waiting_patient', 'resolved', 'closed', 'queued', 'sent', 'delivered', 'failed', 'draft', 'active'].map((status) => <option key={status} value={status}>{formatValue(status)}</option>)}
        </select>
        <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}>
          <option value="">Mọi mức ưu tiên</option>
          {['urgent', 'high', 'normal', 'low', 'critical'].map((priority) => <option key={priority} value={priority}>{formatValue(priority)}</option>)}
        </select>
        <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
          <option value="">Mọi danh mục</option>
          {['appointment', 'billing', 'insurance', 'medical_record', 'technical', 'complaint', 'pharmacy', 'other'].map((category) => <option key={category} value={category}>{formatValue(category)}</option>)}
        </select>
        <button type="button" onClick={applyFilters} disabled={loading}><Filter size={16} /> Áp dụng</button>
      </section>

      {error ? <div className="scm-alert"><ShieldAlert size={18} />{error}</div> : null}
      {actionResult ? <div className="scm-result"><CheckCircle2 size={18} />{actionResult}</div> : null}

      <main className="scm-workspace">
        <section className="scm-main-panel">
          {view === 'broadcast' ? (
            <div className="scm-wizard">
              {['Đối tượng nhận', 'Soạn nội dung', 'Kênh', 'Lịch gửi', 'Kiểm tra an toàn', 'Kết quả'].map((step, index) => (
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
                  <th>Thao tác</th>
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
                        <IconButton icon={Eye} label="Xem" onClick={(event) => { event.stopPropagation(); openDetail(row); }} />
                        <IconButton icon={Copy} label="Sao chép ID" onClick={(event) => { event.stopPropagation(); navigator.clipboard?.writeText(String(getRowId(row))); }} />
                        {view === 'broadcast' ? <IconButton icon={Play} label="Gửi" onClick={(event) => { event.stopPropagation(); runAction('sendBroadcast', row); }} /> : null}
                        {['tickets', 'sla', 'technical', 'account', 'billing'].includes(view) ? <IconButton icon={CheckCircle2} label="Đánh dấu xử lý" onClick={(event) => { event.stopPropagation(); runAction('resolve', row); }} /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? <EmptyState /> : null}
          </div>

          <footer className="scm-table-footer">
            <span>{formatValue(pagination?.total ?? rows.length)} bản ghi</span>
            <span>{loading ? 'Đang tải...' : `Trang ${pagination?.page || 1}/${pagination?.total_pages || 1}`}</span>
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
            <h2>Hoạt động realtime</h2>
            <div className="scm-activity">
              <div><BellRing size={15} /><span>notification.delivery_failed {'->'} hộp lỗi</span></div>
              <div><TicketCheck size={15} /><span>support_ticket.created {'->'} thêm vào inbox</span></div>
              <div><AlertTriangle size={15} /><span>support_ticket.sla_breached {'->'} phòng xử lý SLA</span></div>
              <div><MessageSquare size={15} /><span>message.sent {'->'} luồng hội thoại</span></div>
            </div>
          </section>
          <section>
            <h2>Sức khỏe</h2>
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
