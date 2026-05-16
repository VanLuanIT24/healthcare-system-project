import { useState } from 'react'
import PatientIcon from './PatientIcon'
import botAvatarVideo from '../assets/bot-avatar.mp4'
import botMessageAvatar from '../assets/bot-message-avatar.jpg'

const defaultMessages = [
  {
    id: 'patient-support-greeting',
    role: 'bot',
    text: 'Xin chào! Tôi có thể hỗ trợ bạn về hồ sơ, lịch hẹn, thanh toán, bảo hiểm và kết quả y tế.',
  },
]

export function PatientSupportChatPrompt({ label = 'mục này', onOpen }) {
  return (
    <section className="patient-support-chat-prompt" aria-label="Hỗ trợ nhanh">
      <div className="patient-support-chat-prompt__icon" aria-hidden="true">
        <img src={botMessageAvatar} alt="" />
      </div>
      <div>
        <strong>Cần hỗ trợ về {label}?</strong>
        <p>Mở bot hỗ trợ để kiểm tra thông tin hoặc gửi câu hỏi nhanh.</p>
      </div>
      <button type="button" onClick={onOpen}>
        <PatientIcon name="chat" aria-hidden="true" />
        Liên hệ hỗ trợ
      </button>
    </section>
  )
}

export default function PatientSupportChatbot({ open, onClose }) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState(defaultMessages)

  if (!open) {
    return null
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const text = draft.trim()

    if (!text) {
      return
    }

    setMessages((current) => [
      ...current,
      {
        id: `patient-support-user-${Date.now()}`,
        role: 'user',
        text,
      },
      {
        id: `patient-support-bot-${Date.now()}`,
        role: 'bot',
        text: 'Tôi đã ghi nhận yêu cầu. Nhân viên hỗ trợ sẽ kiểm tra và phản hồi cho bạn trong thời gian sớm nhất.',
      },
    ])
    setDraft('')
  }

  return (
    <aside className="pi-support-chatbot" role="dialog" aria-label="Hỗ trợ Healthcare">
      <header className="pi-support-chatbot-header">
        <div className="pi-support-chatbot-agent">
          <div className="pi-support-chatbot-avatar">
            <video src={botAvatarVideo} autoPlay muted loop playsInline aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
          <div>
            <h2>Hỗ trợ Healthcare</h2>
            <p>Online</p>
          </div>
        </div>
        <button type="button" aria-label="Đóng hỗ trợ" onClick={onClose}>
          <PatientIcon name="close" aria-hidden="true" />
        </button>
      </header>

      <div className="pi-support-chatbot-body">
        {messages.map((message) => (
          <article
            className={`pi-support-chatbot-message pi-support-chatbot-message--${message.role}`}
            key={message.id}
          >
            {message.role === 'bot' ? (
              <span className="pi-support-chatbot-message-icon">
                <img src={botMessageAvatar} alt="" aria-hidden="true" />
              </span>
            ) : null}
            <div className="pi-support-chatbot-bubble">{message.text}</div>
          </article>
        ))}
      </div>

      <form className="pi-support-chatbot-input" onSubmit={handleSubmit}>
        <div>
          <input
            type="text"
            value={draft}
            placeholder="Nhập tin nhắn..."
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" aria-label="Gửi tin nhắn">
            <PatientIcon name="send" aria-hidden="true" />
          </button>
        </div>
      </form>
    </aside>
  )
}
