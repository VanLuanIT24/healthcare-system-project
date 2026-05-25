import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  HeartPulse,
  Loader2,
  MessagesSquare,
  PhoneCall,
  Send,
  ShieldCheck,
  Siren,
  Stethoscope,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'
import { chatbotAPI, getApiErrorMessage, unwrapData } from '../utils/api'

export const HEALTHCARE_CHATBOT_EVENT = 'healthcare-chatbot:open'

const hotlineNumber = '19008888'
const emergencyNumber = '115'

function AiAgentMark({ compact = false }) {
  return (
    <span className={`hc-ai-agent-mark${compact ? ' is-compact' : ''}`} aria-hidden="true">
      <span className="hc-ai-agent-mark__antenna" />
      <span className="hc-ai-agent-mark__face">
        <span className="hc-ai-agent-mark__eye" />
        <span className="hc-ai-agent-mark__eye" />
        <span className="hc-ai-agent-mark__mouth" />
      </span>
      <span className="hc-ai-agent-mark__badge">AI</span>
    </span>
  )
}

function createLocalMessage(role, text, structuredPayload = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    sender_type: role,
    text,
    content: text,
    structured_payload: structuredPayload,
  }
}

function normalizeMessage(apiMessage) {
  if (!apiMessage) return null
  const role = apiMessage.role || apiMessage.sender_type || 'bot'
  return {
    ...apiMessage,
    id: apiMessage.id || apiMessage._id || `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text: apiMessage.text || apiMessage.content || '',
    structured_payload: apiMessage.structured_payload || apiMessage.payload || {},
  }
}

function buildQuickActions(contextKey) {
  const sharedActions = [
    {
      id: 'specialty',
      icon: Stethoscope,
      label: 'Tìm chuyên khoa',
      value: 'Tôi nên khám chuyên khoa nào?',
    },
    {
      id: 'doctor',
      icon: UserRound,
      label: 'Tìm bác sĩ',
      value: 'Tôi muốn tìm bác sĩ phù hợp',
    },
    {
      id: 'slots',
      icon: Clock3,
      label: 'Xem lịch trống',
      value: 'Ngày mai còn lịch khám không?',
    },
    {
      id: 'staff',
      icon: MessagesSquare,
      label: 'Gặp nhân viên',
      value: 'Cho tôi gặp nhân viên tư vấn',
    },
  ]

  const contextActions = {
    booking: [
      {
        id: 'symptom',
        icon: HeartPulse,
        label: 'Đặt theo triệu chứng',
        value: 'Tôi đau bụng vài ngày nay, nên khám khoa nào?',
      },
      {
        id: 'service',
        icon: FileText,
        label: 'Đặt theo dịch vụ',
        value: 'Tôi muốn đặt lịch khám tổng quát',
      },
    ],
    doctor: [
      {
        id: 'doctorScope',
        icon: Stethoscope,
        label: 'Bác sĩ khám gì?',
        value: 'Bác sĩ này khám chuyên khoa gì và còn lịch không?',
      },
      {
        id: 'doctorBook',
        icon: CalendarPlus,
        label: 'Đặt với bác sĩ',
        value: 'Tôi muốn đặt lịch với bác sĩ này',
      },
    ],
    portal: [
      {
        id: 'myAppointments',
        icon: CalendarPlus,
        label: 'Lịch hẹn của tôi',
        value: 'Tôi muốn xem lịch hẹn của tôi',
      },
      {
        id: 'documents',
        icon: ShieldCheck,
        label: 'CCCD / bảo hiểm',
        value: 'Tôi cần chuẩn bị CCCD và bảo hiểm thế nào?',
      },
    ],
    billing: [
      {
        id: 'payment',
        icon: WalletCards,
        label: 'Thanh toán QR',
        value: 'Tôi muốn hỏi cách thanh toán QR',
      },
      {
        id: 'invoice',
        icon: CreditCard,
        label: 'Xem hóa đơn',
        value: 'Tôi xem hóa đơn ở đâu?',
      },
    ],
  }

  return [...(contextActions[contextKey] || []), ...sharedActions]
}

function resolveRouteContext(pathname, search) {
  const section = new URLSearchParams(search || '').get('section') || ''

  if (pathname.startsWith('/doctors')) {
    return {
      key: 'doctor',
      title: 'Tư vấn chọn bác sĩ',
      subtitle: 'Lịch khám, phí tham khảo, bảo hiểm và hình thức khám',
      welcome:
        'Bạn đang ở khu vực bác sĩ. Tôi có thể giúp xem bác sĩ khám bệnh gì, lịch tuần này, phí khám, bảo hiểm và mở đặt lịch với bác sĩ phù hợp.',
      placeholder: 'Hỏi về bác sĩ, lịch khám hoặc phí khám...',
    }
  }

  if (pathname.startsWith('/specialties')) {
    return {
      key: 'booking',
      title: 'Tư vấn chuyên khoa',
      subtitle: 'Chọn chuyên khoa, bác sĩ và ngày giờ mong muốn',
      welcome:
        'Bạn có thể mô tả triệu chứng hoặc chọn chuyên khoa. Tôi sẽ hỗ trợ điều phối hành chính và gợi ý nơi đặt lịch phù hợp.',
      placeholder: 'Ví dụ: đau dạ dày muốn khám ngày mai...',
    }
  }

  if (pathname.startsWith('/portal/dashboard')) {
    if (section === 'book-appointment') {
      return {
        key: 'booking',
        title: 'Lễ tân AI đặt lịch',
        subtitle: 'Chuyên khoa, bác sĩ, triệu chứng, dịch vụ, ngày giờ',
        welcome:
          'Bạn đang ở trang đặt lịch. Hãy nhập nhu cầu khám, triệu chứng, bác sĩ hoặc ngày giờ mong muốn. Tôi chỉ hỗ trợ điều phối, không chẩn đoán bệnh.',
        placeholder: 'Nhập nhu cầu đặt lịch...',
      }
    }

    if (section === 'appointments') {
      return {
        key: 'portal',
        title: 'Quản lý lịch hẹn',
        subtitle: 'Xem lịch, đổi lịch, hủy lịch và nhắc giấy tờ',
        welcome:
          'Tôi có thể hướng dẫn xem lịch hẹn, dời lịch, hủy lịch, kiểm tra trạng thái và nhắc giấy tờ cần mang trước khi khám.',
        placeholder: 'Hỏi về lịch hẹn của tôi...',
      }
    }

    if (section === 'billing') {
      return {
        key: 'billing',
        title: 'Hỗ trợ thanh toán',
        subtitle: 'Hóa đơn, QR, chuyển khoản và trạng thái thanh toán',
        welcome:
          'Tôi có thể hướng dẫn xem hóa đơn, chọn khoản thanh toán, dùng QR/chuyển khoản và kết nối nhân viên khi giao dịch cần kiểm tra.',
        placeholder: 'Hỏi về hóa đơn hoặc thanh toán...',
      }
    }

    return {
      key: 'portal',
      title: 'Lễ tân AI cổng bệnh nhân',
      subtitle: 'Lịch hẹn, hóa đơn, hồ sơ và kết quả',
      welcome:
        'Tôi có thể hỗ trợ xem lịch hẹn, đổi/hủy lịch, hóa đơn, thanh toán, giấy tờ cần mang và trạng thái kết quả trong cổng bệnh nhân.',
      placeholder: 'Bạn cần hỗ trợ gì trong cổng bệnh nhân?',
    }
  }

  if (pathname.startsWith('/contact') || pathname.startsWith('/support')) {
    return {
      key: 'booking',
      title: 'Lễ tân AI 24/7',
      subtitle: 'Tiếp nhận yêu cầu và chuyển đúng bộ phận',
      welcome:
        'Tôi có thể giúp bạn đặt lịch, hỏi thông tin cơ sở, giá dịch vụ cơ bản, chuẩn bị hồ sơ hoặc kết nối nhân viên thật.',
      placeholder: 'Nhập câu hỏi cần hỗ trợ...',
    }
  }

  return {
    key: 'public',
    title: 'Lễ tân AI 24/7',
    subtitle: 'Đặt lịch, tìm chuyên khoa, tìm bác sĩ và hướng dẫn hồ sơ',
    welcome:
      'Xin chào, tôi là lễ tân AI. Tôi hỗ trợ hành chính, điều phối và đặt lịch. Tôi không thay bác sĩ chẩn đoán bệnh.',
    placeholder: 'Ví dụ: tôi đau dạ dày muốn khám ngày mai...',
  }
}

function resolveEventContext(detail, fallbackContext) {
  if (!detail) return fallbackContext

  const contextKey = detail.context || fallbackContext.key
  const context = {
    ...fallbackContext,
    key: contextKey,
  }

  if (contextKey === 'doctor') {
    const doctorLine = detail.doctorName
      ? `Bạn đang quan tâm ${detail.doctorName}${detail.specialty ? ` (${detail.specialty})` : ''}. `
      : ''
    return {
      ...context,
      title: detail.title || 'Tư vấn bác sĩ',
      subtitle: detail.subtitle || 'Lịch khám, phạm vi khám, phí và bảo hiểm',
      welcome:
        detail.message ||
        `${doctorLine}Tôi có thể hỗ trợ hỏi lịch tuần này, phí khám, khám online, bảo hiểm và đặt lịch với bác sĩ này.`,
      placeholder: 'Hỏi về bác sĩ này...',
    }
  }

  if (contextKey === 'booking') {
    return {
      ...context,
      title: detail.title || 'Lễ tân AI đặt lịch',
      subtitle: detail.subtitle || 'Chọn theo chuyên khoa, bác sĩ, triệu chứng hoặc ngày giờ',
      welcome:
        detail.message ||
        'Bạn có thể nhập nhu cầu khám, triệu chứng, bác sĩ hoặc ngày giờ mong muốn. Tôi sẽ gợi ý bước đặt lịch phù hợp.',
      placeholder: detail.placeholder || 'Ví dụ: đau dạ dày muốn khám ngày mai...',
    }
  }

  return {
    ...context,
    title: detail.title || context.title,
    subtitle: detail.subtitle || context.subtitle,
    welcome: detail.message || context.welcome,
    placeholder: detail.placeholder || context.placeholder,
  }
}

function shouldShowChatbot(pathname) {
  const visiblePrefixes = [
    '/home',
    '/about',
    '/specialties',
    '/doctors',
    '/faq',
    '/news',
    '/contact',
    '/support',
    '/terms',
    '/portal/dashboard',
  ]

  return visiblePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function openHealthcareChatbot(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(HEALTHCARE_CHATBOT_EVENT, { detail }))
}

export function HealthcareChatAssistCard({
  title = 'Lễ tân AI có thể hỗ trợ',
  description = 'Chọn nhanh nhu cầu để mở chatbot theo đúng ngữ cảnh.',
  context = 'booking',
  prompts = ['Tìm chuyên khoa', 'Tìm bác sĩ', 'Xem lịch trống', 'Đổi hoặc hủy lịch'],
  compact = false,
}) {
  return (
    <section className={`hc-chat-assist-card${compact ? ' is-compact' : ''}`} aria-label={title}>
      <div className="hc-chat-assist-card__icon" aria-hidden="true">
        <AiAgentMark compact />
      </div>
      <div className="hc-chat-assist-card__copy">
        <strong>{title}</strong>
        <p>{description}</p>
        <div className="hc-chat-assist-card__chips">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() =>
                openHealthcareChatbot({
                  context,
                  message: `Bạn chọn "${prompt}". Tôi sẽ hỗ trợ theo luồng hành chính phù hợp và không thay bác sĩ chẩn đoán.`,
                })
              }
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
      <button
        className="hc-chat-assist-card__action"
        type="button"
        onClick={() => openHealthcareChatbot({ context })}
      >
        Mở tư vấn
      </button>
    </section>
  )
}

function QuickReplies({ replies = [], onPick, disabled }) {
  if (!Array.isArray(replies) || replies.length === 0) return null
  return (
    <div className="hc-chatbot-replies">
      {replies.map((reply) => (
        <button
          key={`${reply.label || reply.value}-${reply.href || ''}`}
          type="button"
          onClick={() => onPick(reply)}
          disabled={disabled}
        >
          {reply.label || reply.value}
        </button>
      ))}
    </div>
  )
}

function SlotPicker({ slots = [], onPick, disabled }) {
  if (!Array.isArray(slots) || slots.length === 0) return null
  return (
    <div className="hc-chatbot-card-grid hc-chatbot-card-grid--slots">
      {slots.map((slot) => (
        <button
          key={slot.slot_id}
          type="button"
          className="hc-chatbot-slot-card"
          onClick={() => onPick({ label: `${slot.time} - ${slot.doctor_name}`, value: `Tôi chọn ${slot.time}`, action: { type: 'select_slot', slot } })}
          disabled={disabled}
        >
          <span>{slot.time}</span>
          <strong>{slot.doctor_name}</strong>
          <small>{slot.department_name} · {slot.date}</small>
          {slot.fee_display ? <em>{slot.fee_display}</em> : null}
        </button>
      ))}
    </div>
  )
}

function DepartmentCards({ departments = [], onPick, disabled }) {
  if (!Array.isArray(departments) || departments.length === 0) return null
  return (
    <div className="hc-chatbot-card-grid">
      {departments.map((department) => (
        <article key={department.department_id || department.department_name} className="hc-chatbot-info-card">
          <strong>{department.department_name}</strong>
          <p>{department.description}</p>
          <button
            type="button"
            onClick={() => onPick({ label: `Đặt lịch ${department.department_name}`, value: `Tôi muốn đặt lịch ${department.department_name}` })}
            disabled={disabled}
          >
            <CalendarPlus size={14} />
            Đặt lịch
          </button>
        </article>
      ))}
    </div>
  )
}

function DoctorCards({ doctors = [], onPick, disabled }) {
  if (!Array.isArray(doctors) || doctors.length === 0) return null
  return (
    <div className="hc-chatbot-card-grid">
      {doctors.map((doctor) => (
        <article key={doctor.doctor_id || doctor.doctor_name} className="hc-chatbot-info-card">
          <strong>{doctor.doctor_name}</strong>
          <p>{[doctor.specialty, doctor.department_name, doctor.years_of_experience ? `${doctor.years_of_experience} năm KN` : null].filter(Boolean).join(' · ')}</p>
          {doctor.fee_display ? <span>{doctor.fee_display}</span> : null}
          <button
            type="button"
            onClick={() => onPick({ label: `Đặt với ${doctor.doctor_name}`, value: `Tôi muốn đặt lịch với ${doctor.doctor_name}` })}
            disabled={disabled}
          >
            <CalendarPlus size={14} />
            Xem lịch
          </button>
        </article>
      ))}
    </div>
  )
}

function ServiceCards({ services = [], onPick, disabled }) {
  if (!Array.isArray(services) || services.length === 0) return null
  return (
    <div className="hc-chatbot-card-grid">
      {services.map((service) => (
        <article key={service.service_id || service.service_name} className="hc-chatbot-info-card">
          <strong>{service.service_name}</strong>
          <p>{service.description || service.department_name || service.service_type}</p>
          {service.price_display ? <span>{service.price_display}</span> : null}
          <button
            type="button"
            onClick={() => onPick({ label: `Đặt lịch ${service.service_name}`, value: `Tôi muốn đặt lịch ${service.service_name}` })}
            disabled={disabled}
          >
            <CalendarPlus size={14} />
            Đặt lịch
          </button>
        </article>
      ))}
    </div>
  )
}

function BookingForm({ payload, onSubmit, disabled }) {
  const fields = Array.isArray(payload.fields) ? payload.fields : []
  const [form, setForm] = useState({})

  function submit(event) {
    event.preventDefault()
    onSubmit({
      label: 'Gửi thông tin đặt lịch',
      value: 'Tôi gửi thông tin đặt lịch',
      action: {
        type: 'submit_booking_identity',
        data: form,
      },
    })
  }

  return (
    <form className="hc-chatbot-booking-form" onSubmit={submit}>
      {fields.map((field) => (
        <label key={field.name}>
          <span>{field.label}{field.required ? ' *' : ''}</span>
          {field.name === 'note' ? (
            <textarea
              value={form[field.name] || ''}
              onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
              disabled={disabled}
              rows={2}
            />
          ) : (
            <input
              value={form[field.name] || ''}
              onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
              disabled={disabled}
              required={field.required}
            />
          )}
        </label>
      ))}
      <button type="submit" disabled={disabled}>
        <CheckCircle2 size={15} />
        Gửi thông tin
      </button>
    </form>
  )
}

function AppointmentSummary({ summary = {}, actions = [], onPick, disabled }) {
  const rows = [
    ['Bệnh nhân', summary.patient_name],
    ['SĐT', summary.phone],
    ['Chuyên khoa', summary.department_name],
    ['Bác sĩ', summary.doctor_name],
    ['Ngày', summary.date],
    ['Giờ', summary.time],
    ['Phí dự kiến', summary.fee_display],
    ['Ghi chú', summary.note],
  ].filter(([, value]) => value)

  return (
    <div className="hc-chatbot-summary-card">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <QuickReplies replies={actions} onPick={onPick} disabled={disabled} />
    </div>
  )
}

function EmergencyCard({ payload = {} }) {
  const actions = Array.isArray(payload.actions) ? payload.actions : []
  return (
    <div className="hc-chatbot-emergency-card">
      <AlertTriangle size={18} />
      <strong>Cần xử lý khẩn cấp</strong>
      <div>
        {actions.map((action) => (
          <a key={action.href || action.label} href={action.href}>
            {action.label}
          </a>
        ))}
      </div>
    </div>
  )
}

function MessagePayload({ message, onPick, disabled }) {
  const payload = message.structured_payload || {}
  const type = payload.type

  return (
    <>
      {type === 'slot_picker' ? <SlotPicker slots={payload.slots} onPick={onPick} disabled={disabled} /> : null}
      {type === 'department_cards' ? <DepartmentCards departments={payload.departments} onPick={onPick} disabled={disabled} /> : null}
      {type === 'doctor_cards' ? <DoctorCards doctors={payload.doctors} onPick={onPick} disabled={disabled} /> : null}
      {type === 'service_cards' ? <ServiceCards services={payload.services} onPick={onPick} disabled={disabled} /> : null}
      {type === 'booking_form' ? <BookingForm payload={payload} onSubmit={onPick} disabled={disabled} /> : null}
      {type === 'appointment_summary' ? (
        <AppointmentSummary summary={payload.summary} actions={payload.actions} onPick={onPick} disabled={disabled} />
      ) : null}
      {type === 'emergency_card' ? <EmergencyCard payload={payload} /> : null}
      {type === 'handoff_notice' ? (
        <div className="hc-chatbot-handoff-card">
          <MessagesSquare size={16} />
          <span>Hàng đợi: {payload.queue || 'support_general'}</span>
          {payload.expected_wait_minutes ? <strong>{payload.expected_wait_minutes} phút</strong> : null}
        </div>
      ) : null}
      {type !== 'slot_picker' && type !== 'booking_form' && type !== 'appointment_summary' ? (
        <QuickReplies replies={payload.quick_replies || payload.actions} onPick={onPick} disabled={disabled} />
      ) : null}
    </>
  )
}

export function HealthcareChatbotLayer() {
  const location = useLocation()
  const navigate = useNavigate()
  const bodyRef = useRef(null)
  const routeContext = useMemo(
    () => resolveRouteContext(location.pathname, location.search),
    [location.pathname, location.search],
  )
  const [eventContext, setEventContext] = useState(null)
  const activeContext = useMemo(
    () => resolveEventContext(eventContext, routeContext),
    [eventContext, routeContext],
  )
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState(() => [createLocalMessage('bot', routeContext.welcome)])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const quickActions = useMemo(() => buildQuickActions(activeContext.key), [activeContext.key])
  const visible = shouldShowChatbot(location.pathname)

  useEffect(() => {
    setEventContext(null)
    setSessionId(null)
    setError('')
    setMessages([createLocalMessage('bot', routeContext.welcome)])
  }, [routeContext.key, routeContext.welcome])

  useEffect(() => {
    function handleOpen(event) {
      const detail = event.detail || {}
      const nextContext = resolveEventContext(detail, routeContext)

      setEventContext(detail)
      setSessionId(null)
      setError('')
      setMessages([createLocalMessage('bot', nextContext.welcome)])
      setOpen(true)
    }

    window.addEventListener(HEALTHCARE_CHATBOT_EVENT, handleOpen)
    return () => window.removeEventListener(HEALTHCARE_CHATBOT_EVENT, handleOpen)
  }, [routeContext])

  useEffect(() => {
    if (!bodyRef.current) return
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages, loading])

  async function ensureSession() {
    if (sessionId) return sessionId
    const response = await chatbotAPI.createSession({
      channel: 'website',
      source_page: `${location.pathname}${location.search || ''}`,
      language: 'vi',
      referrer: document.referrer,
    })
    const data = unwrapData(response)
    const nextSessionId = data?.session?.id || data?.session?._id
    const apiMessages = Array.isArray(data?.messages) ? data.messages.map(normalizeMessage).filter(Boolean) : []
    if (nextSessionId) setSessionId(nextSessionId)
    if (apiMessages.length) {
      setMessages((current) => {
        const hasOnlyLocalWelcome = current.length === 1 && current[0]?.role === 'bot'
        if (hasOnlyLocalWelcome) return apiMessages
        const existingIds = new Set(current.map((item) => item.id))
        return [...apiMessages.filter((item) => !existingIds.has(item.id)), ...current]
      })
    }
    return nextSessionId
  }

  async function sendChatMessage({ content, action }) {
    const visibleText = content || action?.label || action?.value || ''
    if (!visibleText && !action) return

    setError('')
    if (visibleText) {
      setMessages((current) => [...current, createLocalMessage('user', visibleText)])
    }
    setLoading(true)

    try {
      const id = await ensureSession()
      if (!id) throw new Error('Không tạo được phiên chatbot.')
      const response = await chatbotAPI.sendMessage(id, {
        content: visibleText,
        action,
        source: `${location.pathname}${location.search || ''}`,
      })
      const data = unwrapData(response)
      const botMessage = normalizeMessage(data?.bot_message)
      if (botMessage) {
        setMessages((current) => [...current, botMessage])
      }
      const nextSessionId = data?.session?.id || data?.session?._id
      if (nextSessionId) setSessionId(nextSessionId)
    } catch (err) {
      const message = getApiErrorMessage(err, 'Chatbot đang tạm thời không phản hồi.')
      setError(message)
      setMessages((current) => [
        ...current,
        createLocalMessage('bot', 'Dạ, em đang gặp lỗi kết nối. Anh/chị có thể thử lại hoặc gọi hotline để được hỗ trợ ngay.', {
          type: 'quick_replies',
          quick_replies: [
            { label: 'Thử lại', value: visibleText || 'Xin chào' },
            { label: 'Gọi hotline', href: `tel:${hotlineNumber}` },
          ],
        }),
      ])
    } finally {
      setLoading(false)
    }
  }

  if (!visible) {
    return null
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || loading) return
    setDraft('')
    sendChatMessage({ content: text })
  }

  const handleReply = (reply) => {
    if (reply.href) {
      window.location.href = reply.href
      return
    }
    sendChatMessage({
      content: reply.value || reply.label,
      action: reply.action,
    })
  }

  const handleQuickAction = (action) => {
    sendChatMessage({ content: action.value || action.label })
  }

  const goToBooking = () => {
    navigate('/portal/dashboard?section=book-appointment')
    setOpen(false)
  }

  return (
    <div className={`hc-chatbot-layer${open ? ' is-open' : ''}`} aria-live="polite">
      <nav className="hc-chatbot-rail" aria-label="Kênh hỗ trợ nhanh">
        <button
          className="hc-chatbot-rail__item is-primary"
          type="button"
          onClick={() => setOpen(true)}
          title="Chatbot / Tư vấn"
        >
          <AiAgentMark compact />
          <span>Tư vấn</span>
        </button>
        <a className="hc-chatbot-rail__item is-zalo" href={`https://zalo.me/${hotlineNumber}`} title="Zalo">
          <span aria-hidden="true">Z</span>
          <span>Zalo</span>
        </a>
        <a
          className="hc-chatbot-rail__item is-messenger"
          href="https://m.me/healthcareplusvn"
          title="Messenger"
        >
          <MessagesSquare size={20} aria-hidden="true" />
          <span>Messenger</span>
        </a>
        <a className="hc-chatbot-rail__item" href={`tel:${hotlineNumber}`} title="Gọi hotline">
          <PhoneCall size={20} aria-hidden="true" />
          <span>Hotline</span>
        </a>
        <button className="hc-chatbot-rail__item" type="button" onClick={goToBooking} title="Đặt lịch nhanh">
          <CalendarPlus size={20} aria-hidden="true" />
          <span>Đặt lịch</span>
        </button>
        <a className="hc-chatbot-rail__item is-sos" href={`tel:${emergencyNumber}`} title="Khẩn cấp / SOS">
          <Siren size={20} aria-hidden="true" />
          <span>SOS</span>
        </a>
      </nav>

      {open ? (
        <aside className="hc-chatbot-window" role="dialog" aria-label={activeContext.title}>
          <header className="hc-chatbot-window__header">
            <div className="hc-chatbot-window__agent">
              <span className="hc-chatbot-window__avatar" aria-hidden="true">
                <AiAgentMark />
              </span>
              <div>
                <h2>{activeContext.title}</h2>
                <p>{activeContext.subtitle}</p>
              </div>
            </div>
            <button type="button" aria-label="Đóng chatbot" onClick={() => setOpen(false)}>
              <X size={19} aria-hidden="true" />
            </button>
          </header>

          <div className="hc-chatbot-window__notice">
            Chỉ hỗ trợ hành chính, điều phối và đặt lịch. Không thay bác sĩ chẩn đoán.
          </div>

          <div className="hc-chatbot-window__body" ref={bodyRef}>
            {messages.map((message) => (
              <article
                className={`hc-chatbot-message hc-chatbot-message--${message.role === 'user' ? 'user' : 'bot'}`}
                key={message.id}
              >
                {message.role !== 'user' ? (
                  <span className="hc-chatbot-message__avatar" aria-hidden="true">
                    <AiAgentMark compact />
                  </span>
                ) : null}
                <div className="hc-chatbot-message__content">
                  {message.text ? <p>{message.text}</p> : null}
                  {message.role !== 'user' ? (
                    <MessagePayload message={message} onPick={handleReply} disabled={loading} />
                  ) : null}
                </div>
              </article>
            ))}
            {loading ? (
              <article className="hc-chatbot-message hc-chatbot-message--bot">
                <span className="hc-chatbot-message__avatar" aria-hidden="true">
                  <AiAgentMark compact />
                </span>
                <div className="hc-chatbot-message__content">
                  <p className="hc-chatbot-typing"><Loader2 size={14} /> Đang kiểm tra dữ liệu...</p>
                </div>
              </article>
            ) : null}
          </div>

          <div className="hc-chatbot-quick-grid" aria-label="Gợi ý nhanh">
            {quickActions.map((action) => {
              const Icon = action.icon

              return (
                <button key={action.id} type="button" onClick={() => handleQuickAction(action)} disabled={loading}>
                  <Icon size={15} aria-hidden="true" />
                  <span>{action.label}</span>
                </button>
              )
            })}
          </div>

          {error ? <div className="hc-chatbot-error">{error}</div> : null}

          <div className="hc-chatbot-window__cta">
            <button type="button" onClick={goToBooking}>
              <CalendarPlus size={16} aria-hidden="true" />
              Đặt lịch nhanh
            </button>
            <a href={`tel:${hotlineNumber}`}>
              <PhoneCall size={16} aria-hidden="true" />
              Gọi 1900 8888
            </a>
          </div>

          <form className="hc-chatbot-input" onSubmit={handleSubmit}>
            <input
              type="text"
              value={draft}
              placeholder={activeContext.placeholder}
              onChange={(event) => setDraft(event.target.value)}
              disabled={loading}
            />
            <button type="submit" aria-label="Gửi tin nhắn" disabled={loading || !draft.trim()}>
              {loading ? <Loader2 size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
            </button>
          </form>
        </aside>
      ) : null}
    </div>
  )
}
