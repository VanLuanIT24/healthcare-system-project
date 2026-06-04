import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  Headphones,
  Loader2,
  LockKeyhole,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { receptionDataApi } from '../api/receptionDataApi';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

function getId(item, keys = []) {
  for (const key of keys) {
    if (item?.[key]) return item[key];
  }
  return item?._id || item?.id || '';
}

function getPatientId(item) {
  return item?.patient_id?._id || item?.patient_id || item?.patient?.patient_id || item?.patient?.id || item?.patient?._id || '';
}

function getPatientName(item) {
  const patient = item?.patient_id || item?.patient || {};
  return patient.full_name || patient.patient_name || item?.patient_name || item?.full_name || 'Bệnh nhân';
}

function getPatientPhone(item) {
  const patient = item?.patient_id || item?.patient || {};
  return patient.phone || patient.patient_phone || item?.phone || item?.patient_phone || '--';
}

function getStatusMeta(status) {
  const map = {
    open: ['Open', 'info'],
    waiting_staff: ['Chờ nhân viên', 'warning'],
    waiting_patient: ['Chờ bệnh nhân', 'teal'],
    resolved: ['Resolved', 'success'],
    closed: ['Closed', 'neutral'],
    urgent: ['Khẩn', 'danger'],
    high: ['Cao', 'danger'],
    normal: ['Bình thường', 'info'],
    low: ['Thấp', 'success'],
    pending: ['Pending', 'warning'],
    sent: ['Sent', 'success'],
    failed: ['Failed', 'danger'],
  };
  const [label, tone] = map[String(status || '').toLowerCase()] || [status || '--', 'neutral'];
  return { label, tone };
}

function SupportBadge({ status }) {
  const meta = getStatusMeta(status);
  return <span className={`reception-status-badge is-${meta.tone}`}>{meta.label}</span>;
}

function InlineError({ message }) {
  if (!message) return null;
  return (
    <div className="reception-appointment-alert is-danger">
      <XCircle size={17} />
      <span>{message}</span>
    </div>
  );
}

function InlineSuccess({ message }) {
  if (!message) return null;
  return (
    <div className="reception-appointment-alert is-success">
      <CheckCircle2 size={17} />
      <span>{message}</span>
    </div>
  );
}

function LoadingBlock({ label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="reception-appointment-loading">
      <Loader2 size={18} />
      <span>{label}</span>
    </div>
  );
}

function SupportHero({ title, subtitle, icon: Icon = Headphones, actions }) {
  return (
    <div className="reception-appointment-hero">
      <div>
        <span className="reception-appointment-eyebrow">
          <Icon size={16} />
          Reception support
        </span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="reception-panel__actions">{actions}</div> : null}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone = 'info', hint = '' }) {
  return (
    <article className={`reception-flow-stat is-${tone}`}>
      <span><Icon size={18} /> {label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function PatientSearch({ selected, onSelect, placeholder = 'Tìm bệnh nhân theo tên / SĐT / mã BN' }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: false, error: '', items: [] });

  async function submit(event) {
    event?.preventDefault?.();
    if (!query.trim()) {
      setState({ loading: false, error: 'Nhập từ khóa để tìm bệnh nhân.', items: [] });
      return;
    }
    setState({ loading: true, error: '', items: [] });
    try {
      const data = await receptionDataApi.searchReceptionPatients({ q: query.trim(), search: query.trim(), limit: 10 })
        .catch(() => receptionDataApi.searchPatients({ search: query.trim(), limit: 10 }));
      setState({ loading: false, error: '', items: safeArray(data?.items || data?.patients) });
    } catch (error) {
      setState({ loading: false, error: error?.payload?.message || error?.message || 'Không tìm được bệnh nhân.', items: [] });
    }
  }

  return (
    <article className="reception-panel">
      <header className="reception-panel__header reception-panel__header--compact">
        <div>
          <h2>Chọn bệnh nhân</h2>
          <p>{selected ? `${getPatientName(selected)} · ${getPatientPhone(selected)}` : 'Tìm bệnh nhân từ database.'}</p>
        </div>
      </header>
      <form className="reception-appointment-search" onSubmit={submit}>
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} />
      </form>
      <InlineError message={state.error} />
      {state.loading ? <LoadingBlock label="Đang tìm bệnh nhân..." /> : null}
      <div className="reception-receipt-results">
        {state.items.map((patient) => (
          <button key={getPatientId(patient) || patient.patient_id || patient._id} type="button" className={(getPatientId(selected) || selected?.patient_id) === (getPatientId(patient) || patient.patient_id) ? 'is-selected' : ''} onClick={() => onSelect?.(patient)}>
            <UserPlus size={18} />
            <span>
              <strong>{getPatientName(patient)}</strong>
              <small>{patient.patient_code || patient.code || '--'} · {getPatientPhone(patient)}</small>
            </span>
          </button>
        ))}
      </div>
    </article>
  );
}

function SupportTicketsPanel({ onSelectPatient }) {
  const [filters, setFilters] = useState({ status: '', priority: '', category: '', limit: 80 });
  const [state, setState] = useState({ loading: true, error: '', items: [], overview: null, sla: null });
  const [detail, setDetail] = useState({ loading: false, error: '', ticket: null, messages: [], context: null });
  const [notice, setNotice] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadTickets() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const [tickets, overview, sla] = await Promise.all([
          receptionDataApi.listSupportTickets(filters),
          receptionDataApi.getSupportOverview().catch(() => null),
          receptionDataApi.getSupportSlaOverview().catch(() => null),
        ]);
        if (!mounted) return;
        setState({ loading: false, error: '', items: safeArray(tickets?.items), overview, sla });
      } catch (error) {
        if (!mounted) return;
        setState({ loading: false, error: error?.payload?.message || error?.message || 'Không tải được support tickets.', items: [], overview: null, sla: null });
      }
    }
    loadTickets();
    return () => {
      mounted = false;
    };
  }, [filters.status, filters.priority, filters.category, filters.limit, refreshToken]);

  async function openTicket(ticket) {
    const ticketId = getId(ticket, ['support_ticket_id', 'ticket_id']);
    if (!ticketId) return;
    setDetail({ loading: true, error: '', ticket: null, messages: [], context: null });
    try {
      const full = await receptionDataApi.getSupportTicket(ticketId);
      const conversationId = getId(full?.conversation_id || full?.conversation, ['conversation_id']);
      const [messages, context] = await Promise.all([
        conversationId ? receptionDataApi.listConversationMessages(conversationId, { limit: 80 }).catch(() => null) : null,
        receptionDataApi.getSupportTicketContext(ticketId).catch(() => null),
      ]);
      setDetail({ loading: false, error: '', ticket: full, messages: safeArray(messages?.items), context });
    } catch (error) {
      setDetail({ loading: false, error: error?.payload?.message || error?.message || 'Không tải được ticket.', ticket: null, messages: [], context: null });
    }
  }

  async function runTicketAction(type, ticket) {
    const ticketId = getId(ticket, ['support_ticket_id', 'ticket_id']);
    if (!ticketId) return;
    try {
      if (type === 'reply') {
        const body = window.prompt('Nội dung trả lời bệnh nhân:');
        if (!body) return;
        await receptionDataApi.replySupportTicket(ticketId, { body });
        setNotice('Đã gửi phản hồi ticket.');
      }
      if (type === 'note') {
        const note = window.prompt('Ghi chú nội bộ:');
        if (!note) return;
        await receptionDataApi.addSupportInternalNote(ticketId, { body: note, note });
        setNotice('Đã thêm ghi chú nội bộ.');
      }
      if (type === 'priority') {
        const priority = window.prompt('Priority mới: low / normal / high / urgent', ticket.priority || 'high');
        if (!priority) return;
        await receptionDataApi.changeSupportTicketPriority(ticketId, { priority });
        setNotice('Đã đổi priority.');
      }
      if (type === 'assign') {
        const assignedUserId = window.prompt('assigned_user_id cần gán:');
        if (assignedUserId === null) return;
        await receptionDataApi.assignSupportTicket(ticketId, { assigned_user_id: assignedUserId.trim() || undefined });
        setNotice('Đã assign ticket.');
      }
      if (type === 'escalate') {
        const reason = window.prompt('Lý do escalate:', 'Cần bộ phận chuyên trách xử lý');
        if (!reason) return;
        await receptionDataApi.escalateSupportTicket(ticketId, { reason });
        setNotice('Đã escalate ticket.');
      }
      if (type === 'resolve') {
        const reason = window.prompt('Ghi chú resolve:', 'Đã hỗ trợ tại quầy');
        if (reason === null) return;
        await receptionDataApi.resolveSupportTicket(ticketId, { reason });
        setNotice('Đã resolve ticket.');
      }
      if (type === 'close') {
        await receptionDataApi.closeSupportTicket(ticketId, { reason: 'Đóng ticket từ quầy lễ tân.' });
        setNotice('Đã close ticket.');
      }
      if (type === 'reopen') {
        await receptionDataApi.reopenSupportTicket(ticketId, { reason: 'Mở lại từ quầy lễ tân.' });
        setNotice('Đã reopen ticket.');
      }
      setRefreshToken((current) => current + 1);
      if (detail.ticket && getId(detail.ticket, ['support_ticket_id', 'ticket_id']) === ticketId) {
        openTicket(ticket);
      }
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không xử lý được ticket.');
    }
  }

  const openCount = state.items.filter((item) => !['resolved', 'closed'].includes(item.status)).length;
  const overdue = state.items.filter((item) => item.sla_due_at && new Date(item.sla_due_at).getTime() < Date.now() && !['resolved', 'closed'].includes(item.status)).length;
  const high = state.items.filter((item) => ['high', 'urgent'].includes(item.priority)).length;

  return (
    <section className="reception-appointment-module">
      <SupportHero
        title="Support tickets"
        subtitle="Ticket queue tại quầy, có patient context, reply, assign, priority, internal note, escalate và close/resolve."
        icon={Headphones}
        actions={<button type="button" className="reception-btn reception-btn--ghost" onClick={() => setRefreshToken((current) => current + 1)}><RefreshCw size={16} /><span>Làm mới</span></button>}
      />
      <InlineSuccess message={notice} />
      <InlineError message={state.error} />
      <div className="reception-flow-stats">
        <Kpi icon={Headphones} label="Đang mở" value={openCount} />
        <Kpi icon={AlertCircle} label="Quá SLA" value={overdue} tone="danger" />
        <Kpi icon={ShieldCheck} label="Ưu tiên cao" value={high} tone="warning" />
        <Kpi icon={CheckCircle2} label="Tổng ticket" value={state.items.length} tone="success" />
      </div>
      <article className="reception-panel">
        <header className="reception-panel__header reception-panel__header--compact">
          <div>
            <h2>Bộ lọc</h2>
            <p>Lọc ticket theo status, priority và category.</p>
          </div>
        </header>
        <div className="reception-form-grid">
          <label><span>Status</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">Tất cả</option><option value="open">Open</option><option value="waiting_staff">Chờ staff</option><option value="waiting_patient">Chờ bệnh nhân</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label>
          <label><span>Priority</span><select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}><option value="">Tất cả</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
          <label><span>Category</span><input value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} placeholder="billing / account / technical..." /></label>
        </div>
      </article>
      {state.loading ? <LoadingBlock /> : (
        <article className="reception-panel">
          <div className="reception-data-table-wrap">
            <table className="reception-data-table reception-flow-table">
              <thead><tr><th>Ticket</th><th>Bệnh nhân</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>SLA</th><th>Assignee</th><th>Action</th></tr></thead>
              <tbody>
                {state.items.map((ticket) => (
                  <tr key={getId(ticket, ['support_ticket_id', 'ticket_id'])}>
                    <td><strong>{ticket.ticket_code || getId(ticket, ['support_ticket_id', 'ticket_id']).slice(-8).toUpperCase()}</strong></td>
                    <td><button type="button" className="reception-inline-link" onClick={() => onSelectPatient?.({ patient_id: getPatientId(ticket), full_name: getPatientName(ticket) })}>{getPatientName(ticket)}</button></td>
                    <td>{ticket.subject || '--'}</td>
                    <td>{ticket.category || '--'}</td>
                    <td><SupportBadge status={ticket.priority} /></td>
                    <td><SupportBadge status={ticket.status} /></td>
                    <td>{formatDateTime(ticket.sla_due_at)}</td>
                    <td>{ticket.assigned_user_id?.full_name || ticket.assigned_user_name || '--'}</td>
                    <td><button type="button" className="reception-btn reception-btn--ghost" onClick={() => openTicket(ticket)}><Eye size={15} /> Xem</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!state.items.length ? <div className="reception-empty-panel">Không có ticket phù hợp.</div> : null}
          </div>
        </article>
      )}
      <TicketDrawer state={detail} onClose={() => setDetail({ loading: false, error: '', ticket: null, messages: [], context: null })} onAction={runTicketAction} onSelectPatient={onSelectPatient} />
    </section>
  );
}

function TicketDrawer({ state, onClose, onAction, onSelectPatient }) {
  if (!state.loading && !state.error && !state.ticket) return null;
  const ticket = state.ticket || {};
  return (
    <aside className="reception-appointment-drawer" aria-label="Chi tiết support ticket">
      <div className="reception-appointment-drawer__header">
        <div><span>Support ticket</span><h3>{ticket.ticket_code || 'Đang tải...'}</h3></div>
        <button type="button" onClick={onClose} aria-label="Đóng"><XCircle size={20} /></button>
      </div>
      {state.loading ? <LoadingBlock label="Đang tải ticket..." /> : null}
      <InlineError message={state.error} />
      {ticket ? (
        <>
          <div className="reception-detail-grid">
            <div><span>Bệnh nhân</span><strong>{getPatientName(ticket)}</strong></div>
            <div><span>Subject</span><strong>{ticket.subject || '--'}</strong></div>
            <div><span>Category</span><strong>{ticket.category || '--'}</strong></div>
            <div><span>Priority</span><strong>{ticket.priority || '--'}</strong></div>
            <div><span>Status</span><strong>{ticket.status || '--'}</strong></div>
            <div><span>SLA</span><strong>{formatDateTime(ticket.sla_due_at)}</strong></div>
          </div>
          <div className="reception-detail-actions">
            <button type="button" className="reception-btn reception-btn--primary" onClick={() => onAction('reply', ticket)}>Trả lời</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('assign', ticket)}>Assign</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('priority', ticket)}>Đổi ưu tiên</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('note', ticket)}>Internal note</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('escalate', ticket)}>Escalate</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('resolve', ticket)}>Resolve</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('close', ticket)}>Close</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('reopen', ticket)}>Reopen</button>
            <button type="button" className="reception-btn reception-btn--ghost" disabled={!getPatientId(ticket)} onClick={() => onSelectPatient?.({ patient_id: getPatientId(ticket), full_name: getPatientName(ticket) })}>Patient card</button>
          </div>
          <section className="reception-detail-notes"><h4>Mô tả</h4><p>{ticket.description || 'Không có mô tả.'}</p></section>
          <section className="reception-detail-timeline">
            <h4>Conversation</h4>
            {state.messages.map((message) => (
              <div key={message.message_id || message._id} className="reception-detail-timeline__item">
                <span>{formatDateTime(message.created_at)}</span>
                <strong>{message.body || message.voice_transcript || '--'}</strong>
                <small>{message.sender_actor_type || '--'}{message.is_internal_note ? ' · internal' : ''}</small>
              </div>
            ))}
            {!state.messages.length ? <div className="reception-empty-panel reception-empty-panel--compact">Chưa có message hoặc chưa được cấp quyền đọc conversation.</div> : null}
          </section>
        </>
      ) : null}
    </aside>
  );
}

function MessagesPanel({ onSelectPatient }) {
  const [state, setState] = useState({ loading: true, error: '', conversations: [], messages: [] });
  const [selected, setSelected] = useState(null);
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadConversations() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const data = await receptionDataApi.listConversations({ limit: 60 });
        if (!mounted) return;
        setState((current) => ({ ...current, loading: false, error: '', conversations: safeArray(data?.items) }));
      } catch (error) {
        if (!mounted) return;
        setState({ loading: false, error: error?.payload?.message || error?.message || 'Không tải được inbox.', conversations: [], messages: [] });
      }
    }
    loadConversations();
    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  async function selectConversation(conversation) {
    const conversationId = getId(conversation, ['conversation_id']);
    setSelected(conversation);
    try {
      const messages = await receptionDataApi.listConversationMessages(conversationId, { limit: 100 });
      await receptionDataApi.markConversationRead(conversationId, {}).catch(() => null);
      setState((current) => ({ ...current, messages: safeArray(messages?.items) }));
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không tải được tin nhắn.');
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!selected || !body.trim()) return;
    const conversationId = getId(selected, ['conversation_id']);
    try {
      await receptionDataApi.sendConversationMessage(conversationId, { body: body.trim() });
      setBody('');
      setNotice('Đã gửi tin nhắn.');
      await selectConversation(selected);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không gửi được tin nhắn.');
    }
  }

  async function conversationAction(type) {
    if (!selected) return;
    const conversationId = getId(selected, ['conversation_id']);
    try {
      if (type === 'assign') {
        const assignedUserId = window.prompt('assigned_user_id:');
        if (assignedUserId === null) return;
        await receptionDataApi.assignConversation(conversationId, { assigned_user_id: assignedUserId.trim() || undefined });
      }
      if (type === 'escalate') {
        const reason = window.prompt('Lý do escalate:', 'Cần hỗ trợ chuyên sâu');
        if (!reason) return;
        await receptionDataApi.escalateConversation(conversationId, { reason });
      }
      if (type === 'close') await receptionDataApi.closeConversation(conversationId, { reason: 'Đóng từ quầy lễ tân.' });
      setNotice('Đã cập nhật conversation.');
      setRefreshToken((current) => current + 1);
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không xử lý được conversation.');
    }
  }

  return (
    <section className="reception-appointment-module">
      <SupportHero title="Tin nhắn bệnh nhân" subtitle="Inbox/chat center đọc từ /messages/conversations và gửi message thật." icon={MessageSquare} actions={<button type="button" className="reception-btn reception-btn--ghost" onClick={() => setRefreshToken((current) => current + 1)}><RefreshCw size={16} />Làm mới</button>} />
      <InlineError message={state.error} />
      <InlineSuccess message={notice} />
      <div className="reception-transfer-layout">
        <article className="reception-panel">
          <header className="reception-panel__header reception-panel__header--compact"><div><h2>Conversations</h2><p>{state.conversations.length} hội thoại.</p></div></header>
          {state.loading ? <LoadingBlock /> : (
            <div className="reception-receipt-results">
              {state.conversations.map((conversation) => (
                <button key={getId(conversation, ['conversation_id'])} type="button" className={getId(selected, ['conversation_id']) === getId(conversation, ['conversation_id']) ? 'is-selected' : ''} onClick={() => selectConversation(conversation)}>
                  <MessageSquare size={18} />
                  <span><strong>{conversation.title || getPatientName(conversation)}</strong><small>{conversation.type || '--'} · unread {conversation.unread_count || 0}</small></span>
                </button>
              ))}
              {!state.conversations.length ? <div className="reception-empty-panel reception-empty-panel--compact">Không có conversation.</div> : null}
            </div>
          )}
        </article>
        <article className="reception-panel">
          <header className="reception-panel__header reception-panel__header--compact">
            <div><h2>{selected?.title || 'Chọn conversation'}</h2><p>{selected ? `${selected.type || '--'} · ${selected.status || '--'}` : 'Nội dung chat sẽ hiển thị tại đây.'}</p></div>
            <div className="reception-panel__actions">
              <button type="button" className="reception-btn reception-btn--ghost" disabled={!selected} onClick={() => onSelectPatient?.({ patient_id: getPatientId(selected), full_name: getPatientName(selected) })}>Patient</button>
              <button type="button" className="reception-btn reception-btn--ghost" disabled={!selected} onClick={() => conversationAction('assign')}>Assign</button>
              <button type="button" className="reception-btn reception-btn--ghost" disabled={!selected} onClick={() => conversationAction('escalate')}>Escalate</button>
              <button type="button" className="reception-btn reception-btn--ghost" disabled={!selected} onClick={() => conversationAction('close')}>Close</button>
            </div>
          </header>
          <div className="reception-detail-timeline">
            {state.messages.map((message) => (
              <div key={message.message_id || message._id} className="reception-detail-timeline__item">
                <span>{formatDateTime(message.created_at)}</span>
                <strong>{message.body || message.voice_transcript || '--'}</strong>
                <small>{message.sender_actor_type || '--'}{message.is_internal_note ? ' · internal' : ''}</small>
              </div>
            ))}
            {!state.messages.length ? <div className="reception-empty-panel reception-empty-panel--compact">Chưa có message.</div> : null}
          </div>
          <form className="reception-flow-searchbar" onSubmit={sendMessage}>
            <label className="reception-appointment-search"><MessageSquare size={18} /><input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Nhập phản hồi..." /></label>
            <button type="submit" className="reception-btn reception-btn--primary" disabled={!selected || !body.trim()}><Send size={16} />Gửi</button>
          </form>
        </article>
      </div>
    </section>
  );
}

function SendNotificationPanel() {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [form, setForm] = useState({ patient_account_id: '', title: '', message: '', notification_type: 'system', priority: 'normal', channel: 'in_app' });
  const [state, setState] = useState({ loading: false, error: '', success: '' });

  useEffect(() => {
    let mounted = true;
    async function loadRefs() {
      const [templateData, deliveryData] = await Promise.all([
        receptionDataApi.listNotificationTemplates({ limit: 50 }).catch(() => null),
        receptionDataApi.listNotificationDeliveries({ limit: 20 }).catch(() => null),
      ]);
      if (!mounted) return;
      setTemplates(safeArray(templateData?.items));
      setDeliveries(safeArray(deliveryData?.items));
    }
    loadRefs();
    return () => {
      mounted = false;
    };
  }, []);

  function applyTemplate(kind) {
    const content = {
      payment: ['Hướng dẫn thanh toán QR', 'Vui lòng quét QR đúng số tiền và giữ nguyên nội dung chuyển khoản.'],
      portal: ['Hướng dẫn portal', 'Vui lòng đăng nhập portal để xem lịch hẹn, hóa đơn và tài liệu cá nhân.'],
      appointment: ['Hướng dẫn đặt lịch', 'Vui lòng chọn chuyên khoa, bác sĩ và khung giờ phù hợp trên portal.'],
    }[kind] || ['', ''];
    setForm((current) => ({ ...current, title: content[0], message: content[1], notification_type: kind === 'payment' ? 'payment' : kind === 'appointment' ? 'appointment' : 'system' }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.patient_account_id.trim()) {
      setState({ loading: false, error: 'Notification recipient của backend cần patient_account_id/recipient_id, không chỉ patient_id.', success: '' });
      return;
    }
    setState({ loading: true, error: '', success: '' });
    try {
      await receptionDataApi.createNotification({
        recipient_type: 'patient',
        patient_account_id: form.patient_account_id.trim(),
        title: form.title,
        message: form.message,
        notification_type: form.notification_type,
        priority: form.priority,
        channel: form.channel,
        payload: {
          patient_id: getPatientId(selectedPatient),
          source: 'reception_support_send_notification',
        },
      });
      setState({ loading: false, error: '', success: 'Đã gửi notification.' });
    } catch (error) {
      setState({ loading: false, error: error?.payload?.message || error?.message || 'Không gửi được notification.', success: '' });
    }
  }

  return (
    <section className="reception-appointment-module">
      <SupportHero title="Gửi thông báo" subtitle="Gửi notification theo scope lễ tân; cần patient_account_id để backend định danh recipient portal." icon={Bell} />
      <div className="reception-transfer-layout">
        <PatientSearch selected={selectedPatient} onSelect={setSelectedPatient} />
        <form className="reception-panel" onSubmit={submit}>
          <header className="reception-panel__header reception-panel__header--compact"><div><h2>Nội dung thông báo</h2><p>Template nhanh: QR, portal, đặt lịch.</p></div></header>
          <div className="reception-row-actions">
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => applyTemplate('payment')}>QR payment</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => applyTemplate('portal')}>Portal</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => applyTemplate('appointment')}>Đặt lịch</button>
          </div>
          <div className="reception-form-grid">
            <label><span>patient_account_id *</span><input value={form.patient_account_id} onChange={(event) => setForm((current) => ({ ...current, patient_account_id: event.target.value }))} placeholder="ObjectId PatientAccount" /></label>
            <label><span>Channel</span><select value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}><option value="in_app">In-app</option><option value="email">Email</option><option value="push">Push</option></select></label>
            <label><span>Type</span><select value={form.notification_type} onChange={(event) => setForm((current) => ({ ...current, notification_type: event.target.value }))}><option value="system">System</option><option value="appointment">Appointment</option><option value="payment">Payment</option></select></label>
            <label><span>Priority</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="low">Low</option><option value="normal">Normal</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label className="is-span-2"><span>Tiêu đề</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label className="is-span-2"><span>Nội dung</span><textarea value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} /></label>
          </div>
          <InlineError message={state.error} />
          <InlineSuccess message={state.success} />
          <footer className="reception-modal__actions"><button type="submit" className="reception-btn reception-btn--primary" disabled={state.loading}>{state.loading ? <Loader2 size={16} /> : <Send size={16} />}Gửi ngay</button></footer>
        </form>
      </div>
      <article className="reception-panel">
        <header className="reception-panel__header reception-panel__header--compact"><div><h2>Template & delivery gần đây</h2><p>{templates.length} template · {deliveries.length} delivery.</p></div></header>
        <div className="reception-detail-timeline">
          {deliveries.slice(0, 8).map((item) => <div key={item.delivery_id || item._id} className="reception-detail-timeline__item"><span>{formatDateTime(item.created_at)}</span><strong>{item.title || item.notification_id || '--'}</strong><small>{item.status || '--'}</small></div>)}
          {!deliveries.length ? <div className="reception-empty-panel reception-empty-panel--compact">Không có delivery hoặc không có quyền admin support communication.</div> : null}
        </div>
      </article>
    </section>
  );
}

function PortalGuidePanel({ onSelectPatient }) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [card, setCard] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function loadCard(patient) {
    setSelectedPatient(patient);
    setError('');
    setNotice('');
    try {
      const data = await receptionDataApi.getPatientCard(getPatientId(patient) || patient.patient_id);
      setCard(data);
      const account = data?.portal_account || data?.account || data?.patient_account;
      setAccountId(account?._id || account?.id || account?.account_id || '');
    } catch (err) {
      setError(err?.payload?.message || err?.message || 'Không tải được patient card.');
    }
  }

  async function createAccount() {
    if (!selectedPatient) return;
    try {
      const data = await receptionDataApi.createPatientPortalAccount(getPatientId(selectedPatient) || selectedPatient.patient_id, {
        email: selectedPatient.email,
        phone: getPatientPhone(selectedPatient),
      });
      setNotice('Đã tạo tài khoản portal nếu backend cho phép.');
      setAccountId(data?.account?._id || data?.account_id || accountId);
    } catch (err) {
      window.alert(err?.payload?.message || err?.message || 'Không tạo được tài khoản portal.');
    }
  }

  async function accountAction(type) {
    if (!accountId) {
      window.alert('Cần accountId.');
      return;
    }
    try {
      if (type === 'reset') await receptionDataApi.resetPatientPortalPassword(accountId, {});
      if (type === 'verify') await receptionDataApi.resendPatientPortalVerification(accountId, {});
      if (type === 'unlock') await receptionDataApi.unlockPatientPortalAccount(accountId, {});
      if (type === 'logout') await receptionDataApi.forceLogoutPatientPortalAccount(accountId, {});
      setNotice('Đã gửi thao tác portal account.');
    } catch (err) {
      window.alert(err?.payload?.message || err?.message || 'Không xử lý được portal account.');
    }
  }

  return (
    <section className="reception-appointment-module">
      <SupportHero title="Hướng dẫn portal" subtitle="Hỗ trợ tạo tài khoản, reset password, resend verification và in/gửi hướng dẫn portal." icon={LockKeyhole} />
      <InlineError message={error} />
      <InlineSuccess message={notice} />
      <div className="reception-transfer-layout">
        <PatientSearch selected={selectedPatient} onSelect={loadCard} />
        <article className="reception-panel">
          <header className="reception-panel__header reception-panel__header--compact"><div><h2>Portal status</h2><p>Đọc từ patient card và admin patient portal nếu có accountId.</p></div></header>
          {selectedPatient ? (
            <>
              <div className="reception-detail-grid">
                <div><span>Bệnh nhân</span><strong>{getPatientName(selectedPatient)}</strong></div>
                <div><span>SĐT</span><strong>{getPatientPhone(selectedPatient)}</strong></div>
                <div><span>Account ID</span><strong>{accountId || '--'}</strong></div>
                <div><span>Portal status</span><strong>{card?.portal_account?.status || card?.account?.status || '--'}</strong></div>
              </div>
              <label className="reception-appointment-search"><Search size={18} /><input value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="Nhập accountId nếu patient card chưa trả về" /></label>
              <div className="reception-detail-actions">
                <button type="button" className="reception-btn reception-btn--primary" onClick={createAccount}>Tạo tài khoản</button>
                <button type="button" className="reception-btn reception-btn--ghost" onClick={() => accountAction('verify')}>Gửi lại xác minh</button>
                <button type="button" className="reception-btn reception-btn--ghost" onClick={() => accountAction('reset')}>Reset mật khẩu</button>
                <button type="button" className="reception-btn reception-btn--ghost" onClick={() => accountAction('unlock')}>Mở khóa</button>
                <button type="button" className="reception-btn reception-btn--ghost" onClick={() => accountAction('logout')}>Force logout</button>
                <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onSelectPatient?.(selectedPatient)}>Patient drawer</button>
              </div>
              <div className="reception-payment-support">
                <strong>Hướng dẫn nhanh</strong>
                <p>Đăng nhập portal, kiểm tra email/SĐT, xem lịch hẹn, xem hóa đơn, tải tài liệu và gửi yêu cầu hỗ trợ khi cần.</p>
              </div>
            </>
          ) : <div className="reception-empty-panel">Chọn bệnh nhân để xem portal status.</div>}
        </article>
      </div>
    </section>
  );
}

function BookingGuidePanel({ onNavigate }) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [notice, setNotice] = useState('');

  async function sendGuide() {
    if (!selectedPatient) {
      window.alert('Chọn bệnh nhân trước.');
      return;
    }
    try {
      await receptionDataApi.createSupportTicket({
        patient_id: getPatientId(selectedPatient) || selectedPatient.patient_id,
        category: 'appointment_help',
        priority: 'normal',
        subject: 'Hướng dẫn đặt lịch qua portal',
        description: 'Lễ tân đã hướng dẫn bệnh nhân tự đặt lịch qua portal hoặc cần hỗ trợ đặt lịch hộ.',
        metadata: { guide_type: 'self_booking', source: 'reception_booking_guide' },
      });
      setNotice('Đã tạo ticket ghi nhận hướng dẫn đặt lịch.');
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không tạo được ticket hướng dẫn.');
    }
  }

  return (
    <section className="reception-appointment-module">
      <SupportHero title="Hướng dẫn đặt lịch" subtitle="Hướng dẫn bệnh nhân tự đặt lịch hoặc chuyển sang wizard đặt lịch hộ tại quầy." icon={CalendarDays} actions={<button type="button" className="reception-btn reception-btn--primary" onClick={() => onNavigate?.('appointments-create')}><CalendarDays size={16} />Đặt lịch hộ</button>} />
      <InlineSuccess message={notice} />
      <div className="reception-transfer-layout">
        <PatientSearch selected={selectedPatient} onSelect={setSelectedPatient} />
        <article className="reception-panel">
          <header className="reception-panel__header reception-panel__header--compact"><div><h2>Quy trình hướng dẫn</h2><p>Không chỉ hiển thị text: có action tạo ticket audit và mở wizard đặt lịch thật.</p></div></header>
          <div className="reception-detail-timeline">
            {['Đăng nhập portal', 'Chọn Đặt lịch khám', 'Chọn chuyên khoa', 'Chọn bác sĩ / khung giờ', 'Xác nhận lịch', 'Nhận QR check-in'].map((step, index) => (
              <div key={step} className="reception-detail-timeline__item"><span>Bước {index + 1}</span><strong>{step}</strong><small>self booking</small></div>
            ))}
          </div>
          <div className="reception-detail-actions">
            <button type="button" className="reception-btn reception-btn--ghost" onClick={sendGuide}>Ghi nhận/tạo ticket hướng dẫn</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => window.print()}>In hướng dẫn</button>
            <button type="button" className="reception-btn reception-btn--primary" onClick={() => onNavigate?.('appointments-create')}>Mở tạo lịch hẹn</button>
          </div>
        </article>
      </div>
    </section>
  );
}

function ComplaintIntakePanel({ onSelectPatient }) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState({ category: 'service_complaint', priority: 'normal', subject: '', description: '', appointment_id: '', invoice_id: '', payment_intent_id: '', queue_ticket_id: '' });
  const [state, setState] = useState({ loading: false, error: '', success: null });

  async function submit(event) {
    event.preventDefault();
    if (!selectedPatient) {
      setState({ loading: false, error: 'Chọn bệnh nhân trước.', success: null });
      return;
    }
    setState({ loading: true, error: '', success: null });
    try {
      const data = await receptionDataApi.createSupportTicket({
        patient_id: getPatientId(selectedPatient) || selectedPatient.patient_id,
        category: form.category,
        priority: form.priority,
        subject: form.subject,
        description: form.description,
        metadata: {
          linked_entities: {
            appointment_id: form.appointment_id || undefined,
            invoice_id: form.invoice_id || undefined,
            payment_intent_id: form.payment_intent_id || undefined,
            queue_ticket_id: form.queue_ticket_id || undefined,
          },
          source: 'reception_complaint_intake',
        },
      });
      setState({ loading: false, error: '', success: data });
    } catch (error) {
      setState({ loading: false, error: error?.payload?.message || error?.message || 'Không tạo được ticket.', success: null });
    }
  }

  return (
    <section className="reception-appointment-module">
      <SupportHero title="Khiếu nại / yêu cầu hỗ trợ" subtitle="Tạo support ticket tại quầy, link nghiệp vụ qua metadata để backend lưu vào database." icon={AlertCircle} />
      <div className="reception-transfer-layout">
        <PatientSearch selected={selectedPatient} onSelect={setSelectedPatient} />
        <form className="reception-panel" onSubmit={submit}>
          <header className="reception-panel__header reception-panel__header--compact"><div><h2>Tạo ticket intake</h2><p>Ticket tạo qua /support/tickets, không lưu local.</p></div></header>
          <div className="reception-form-grid">
            <label><span>Loại yêu cầu</span><select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}><option value="appointment_help">Lịch hẹn</option><option value="payment_help">Thanh toán</option><option value="portal_help">Portal account</option><option value="profile_update">Hồ sơ cá nhân</option><option value="document_help">Tài liệu</option><option value="service_complaint">Khiếu nại dịch vụ</option><option value="staff_complaint">Khiếu nại thái độ</option><option value="technical_issue">Lỗi kỹ thuật</option><option value="other">Khác</option></select></label>
            <label><span>Priority</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option><option value="urgent">Khẩn</option></select></label>
            <label className="is-span-2"><span>Tiêu đề</span><input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} required /></label>
            <label className="is-span-2"><span>Mô tả</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required /></label>
            <label><span>Appointment ID</span><input value={form.appointment_id} onChange={(event) => setForm((current) => ({ ...current, appointment_id: event.target.value }))} /></label>
            <label><span>Invoice ID</span><input value={form.invoice_id} onChange={(event) => setForm((current) => ({ ...current, invoice_id: event.target.value }))} /></label>
            <label><span>Payment intent ID</span><input value={form.payment_intent_id} onChange={(event) => setForm((current) => ({ ...current, payment_intent_id: event.target.value }))} /></label>
            <label><span>Queue ticket ID</span><input value={form.queue_ticket_id} onChange={(event) => setForm((current) => ({ ...current, queue_ticket_id: event.target.value }))} /></label>
          </div>
          <InlineError message={state.error} />
          <InlineSuccess message={state.success ? `Đã tạo ticket ${state.success.ticket_code || state.success.ticket?.ticket_code || ''}` : ''} />
          <footer className="reception-modal__actions">
            <button type="submit" className="reception-btn reception-btn--primary" disabled={state.loading}>{state.loading ? <Loader2 size={16} /> : <Plus size={16} />}Tạo ticket</button>
            <button type="button" className="reception-btn reception-btn--ghost" disabled={!selectedPatient} onClick={() => onSelectPatient?.(selectedPatient)}>Patient drawer</button>
            <button type="button" className="reception-btn reception-btn--ghost" disabled={!state.success} onClick={() => window.print()}>In phiếu tiếp nhận</button>
          </footer>
        </form>
      </div>
    </section>
  );
}

export function ReceptionSupportPanel({ mode = 'support-tickets', onNavigate, onSelectPatient }) {
  if (mode === 'support-patient-messages') return <MessagesPanel onSelectPatient={onSelectPatient} />;
  if (mode === 'support-send-notification') return <SendNotificationPanel onSelectPatient={onSelectPatient} />;
  if (mode === 'support-portal-guide') return <PortalGuidePanel onSelectPatient={onSelectPatient} />;
  if (mode === 'support-booking-guide') return <BookingGuidePanel onNavigate={onNavigate} />;
  if (mode === 'support-complaints') return <ComplaintIntakePanel onSelectPatient={onSelectPatient} />;
  return <SupportTicketsPanel onSelectPatient={onSelectPatient} />;
}
