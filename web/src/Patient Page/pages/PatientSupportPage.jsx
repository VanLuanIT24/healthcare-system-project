import { useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'

const supportTabs = [
  { id: 'all', label: 'Tickets của tôi' },
  { id: 'create', label: 'Tạo yêu cầu' },
  { id: 'processing', label: 'Đang xử lý' },
  { id: 'replied', label: 'Đã phản hồi' },
  { id: 'closed', label: 'Đã đóng' },
  { id: 'messages', label: 'Tin nhắn' },
  { id: 'rating', label: 'Đánh giá dịch vụ' },
]

const categoryLabels = {
  appointment: 'Lịch hẹn',
  billing: 'Viện phí',
  insurance: 'Bảo hiểm',
  medical_record: 'Hồ sơ y tế',
  technical: 'Kỹ thuật',
  complaint: 'Phản ánh',
  pharmacy: 'Nhà thuốc',
  other: 'Khác',
}

const statusMeta = {
  open: { label: 'Đang xử lý', tone: 'processing' },
  waiting_staff: { label: 'Chờ nhân viên phản hồi', tone: 'processing' },
  waiting_patient: { label: 'Đã phản hồi', tone: 'replied' },
  resolved: { label: 'Đã xử lý', tone: 'closed' },
  closed: { label: 'Đã đóng', tone: 'closed' },
  cancelled: { label: 'Đã hủy', tone: 'closed' },
}

function getTicketId(ticket, index = 0) {
  return ticket._id || ticket.id || ticket.ticket_id || ticket.ticket_code || `support-ticket-${index}`
}

function formatDate(value) {
  if (!value) return 'Chưa có thời gian'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có thời gian'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function getTicketGroup(ticket) {
  const status = String(ticket.status || 'open').toLowerCase()
  if (['resolved', 'closed', 'cancelled'].includes(status)) return 'closed'
  if (status === 'waiting_patient') return 'replied'
  return 'processing'
}

export default function PatientSupportPage({
  feedback = null,
  loading = false,
  onCreateTicket,
  onOpenSupportChat,
  onReplyTicket,
  summary = null,
  tickets = [],
}) {
  const [activeTab, setActiveTab] = useState('all')
  const [selectedTicketId, setSelectedTicketId] = useState('')
  const [ticketForm, setTicketForm] = useState({
    category: 'other',
    priority: 'normal',
    subject: '',
    description: '',
  })
  const [replyText, setReplyText] = useState('')

  const visibleTickets = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'messages' || activeTab === 'rating') return tickets
    return tickets.filter((ticket) => getTicketGroup(ticket) === activeTab)
  }, [activeTab, tickets])

  const selectedTicket =
    tickets.find((ticket, index) => getTicketId(ticket, index) === selectedTicketId) ||
    visibleTickets[0] ||
    null

  const cards = [
    { label: 'Đang mở', value: summary?.open ?? tickets.filter((ticket) => getTicketGroup(ticket) === 'processing').length, icon: 'support_agent' },
    { label: 'Chờ phản hồi', value: summary?.waiting_reply ?? tickets.filter((ticket) => ticket.status === 'waiting_staff').length, icon: 'forum' },
    { label: 'Đã xử lý', value: summary?.resolved ?? tickets.filter((ticket) => ticket.status === 'resolved').length, icon: 'check_circle' },
    { label: 'Tin nhắn chưa đọc', value: summary?.unread_messages ?? 0, icon: 'mark_email_unread' },
  ]

  const updateForm = (field) => (event) => {
    setTicketForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const submitTicket = async (event) => {
    event.preventDefault()
    const saved = await onCreateTicket?.(ticketForm)
    if (saved !== false) {
      setTicketForm({ category: 'other', priority: 'normal', subject: '', description: '' })
      setActiveTab('all')
    }
  }

  const submitReply = async (event) => {
    event.preventDefault()
    if (!selectedTicket || !replyText.trim()) return
    const saved = await onReplyTicket?.(getTicketId(selectedTicket), { body: replyText.trim() })
    if (saved !== false) setReplyText('')
  }

  return (
    <div className="patient-support-page">
      <section className="patient-support-hero">
        <div className="patient-support-hero-copy">
          <p className="patient-eyebrow">Liên lạc</p>
          <h1>Hỗ trợ</h1>
          <p>Theo dõi ticket, trao đổi với nhân viên và đánh giá chất lượng hỗ trợ.</p>
        </div>
      </section>

      {feedback?.context === 'support' ? (
        <div className={`patient-dashboard-state ${feedback.type === 'error' ? 'patient-dashboard-state-error' : ''}`}>
          {feedback.message || feedback.text}
        </div>
      ) : null}

      <section className="patient-support-categories">
        {cards.map((card) => (
          <article key={card.label} className="patient-support-category">
            <div className="patient-support-category-icon">
              <PatientIcon name={card.icon} aria-hidden="true" />
            </div>
            <h2>{card.value}</h2>
            <p>{card.label}</p>
          </article>
        ))}
      </section>

      <section className="patient-support-faq panel-reset">
        <div className="patient-support-section-head">
          <div>
            <p className="patient-section-label">Support tickets</p>
            <h2>Yêu cầu hỗ trợ</h2>
          </div>

          <button className="patient-inline-link patient-support-inline" type="button" onClick={() => setActiveTab('create')}>
            Tạo ticket
            <PatientIcon name="add_circle" aria-hidden="true" />
          </button>
        </div>

        <div className="patient-support-tabs" role="tablist" aria-label="Lọc ticket hỗ trợ">
          {supportTabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'create' ? (
          <form className="patient-support-ticket-form" onSubmit={submitTicket}>
            <label>
              Loại yêu cầu
              <select value={ticketForm.category} onChange={updateForm('category')}>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Mức độ ưu tiên
              <select value={ticketForm.priority} onChange={updateForm('priority')}>
                <option value="normal">Bình thường</option>
                <option value="high">Cao</option>
                <option value="urgent">Khẩn</option>
                <option value="low">Thấp</option>
              </select>
            </label>
            <label>
              Chủ đề
              <input value={ticketForm.subject} onChange={updateForm('subject')} required />
            </label>
            <label>
              Nội dung
              <textarea value={ticketForm.description} onChange={updateForm('description')} rows="4" />
            </label>
            <button className="patient-support-cta-primary" type="submit">Tạo ticket</button>
          </form>
        ) : (
          <div className="patient-support-ticket-layout">
            <div className="patient-support-ticket-list">
              {loading ? <div className="patient-support-ticket-empty">Đang tải ticket...</div> : null}
              {!loading && !visibleTickets.length ? <div className="patient-support-ticket-empty">Chưa có ticket phù hợp.</div> : null}
              {visibleTickets.map((ticket, index) => {
                const ticketId = getTicketId(ticket, index)
                const meta = statusMeta[ticket.status] || statusMeta.open
                return (
                  <button
                    className={selectedTicket && getTicketId(selectedTicket) === ticketId ? 'is-active' : ''}
                    key={ticketId}
                    type="button"
                    onClick={() => setSelectedTicketId(ticketId)}
                  >
                    <strong>{ticket.ticket_code || ticketId}</strong>
                    <span>{ticket.subject}</span>
                    <small>{categoryLabels[ticket.category] || 'Khác'} | {formatDate(ticket.updated_at || ticket.created_at)}</small>
                    <em className={`is-${meta.tone}`}>{meta.label}</em>
                  </button>
                )
              })}
            </div>

            <aside className="patient-support-ticket-detail">
              {selectedTicket ? (
                <>
                  <span>{selectedTicket.ticket_code}</span>
                  <h3>{selectedTicket.subject}</h3>
                  <p>{selectedTicket.description || 'Chưa có mô tả chi tiết.'}</p>
                  <dl>
                    <div><dt>Loại</dt><dd>{categoryLabels[selectedTicket.category] || 'Khác'}</dd></div>
                    <div><dt>Ưu tiên</dt><dd>{selectedTicket.priority || 'normal'}</dd></div>
                    <div><dt>Người xử lý</dt><dd>{selectedTicket.assigned_user_id?.full_name || 'Chưa phân công'}</dd></div>
                    <div><dt>Lần phản hồi cuối</dt><dd>{formatDate(selectedTicket.updated_at || selectedTicket.created_at)}</dd></div>
                  </dl>
                  <form onSubmit={submitReply}>
                    <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} rows="3" placeholder="Nhập phản hồi" />
                    <button type="submit">Trả lời ticket</button>
                  </form>
                </>
              ) : (
                <p>Chọn ticket để xem chi tiết.</p>
              )}
            </aside>
          </div>
        )}
      </section>

      <section className="patient-support-cta">
        <div className="patient-support-cta-copy">
          <p className="patient-eyebrow support-eyebrow">Tin nhắn</p>
          <h2>Trao đổi trực tiếp với bộ phận hỗ trợ</h2>
          <p>Tạo hội thoại hoặc tiếp tục trao đổi theo ticket đang mở.</p>
          <div className="patient-support-cta-actions">
            <button className="patient-support-cta-primary" type="button" onClick={() => onOpenSupportChat?.()}>
              Mở chat hỗ trợ
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
