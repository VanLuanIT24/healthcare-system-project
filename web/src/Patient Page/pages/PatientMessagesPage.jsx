import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { messageThreads } from '../data/patientPageData'
import { getInitials } from '../utils/patientHelpers'

function getChatInitials(name = '') {
  return getInitials(name.replace(/^ThS\.\s*BS\.\s*|^BS\.\s*/i, '')) || 'BS'
}

export default function PatientMessagesPage() {
  const [threads, setThreads] = useState(messageThreads)
  const [selectedThreadId, setSelectedThreadId] = useState(messageThreads[0]?.id || '')
  const [threadSearch, setThreadSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState([])
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const attachmentMenuRef = useRef(null)
  const deferredSearch = useDeferredValue(threadSearch)

  useEffect(() => {
    function handleClickOutside(event) {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
        setShowAttachmentMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const normalizedSearch = deferredSearch.trim().toLowerCase()
  const visibleThreads = normalizedSearch
    ? threads.filter((thread) => {
        const haystack = `${thread.doctor} ${thread.specialty} ${thread.preview}`.toLowerCase()
        return haystack.includes(normalizedSearch)
      })
    : threads

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) || threads[0]

  const handleSendMessage = () => {
    const nextMessage = draft.trim()

    if ((!nextMessage && attachments.length === 0) || !selectedThread) {
      return
    }

    const currentTime = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const previewMessage =
      nextMessage || (attachments.length > 0 ? `Đã đính kèm ${attachments.length} tệp` : '')

    startTransition(() => {
      setThreads((current) =>
        current.map((thread) =>
          thread.id === selectedThread.id
            ? {
                ...thread,
                preview: previewMessage,
                time: currentTime,
                messages: [
                  ...thread.messages,
                  {
                    id: `${thread.id}-${Date.now()}`,
                    sender: 'patient',
                    text: nextMessage,
                    attachments,
                    time: currentTime,
                    seen: true,
                  },
                ],
              }
            : thread,
        ),
      )
    })

    setDraft('')
    setAttachments([])
  }

  const handleFileSelect = (event) => {
    if (event.target.files?.length) {
      const newFiles = Array.from(event.target.files).map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }))
      setAttachments((current) => [...current, ...newFiles])
    }
    event.target.value = ''
  }

  const removeAttachment = (index) => {
    setAttachments((current) => {
      const nextAttachments = [...current]
      if (nextAttachments[index]?.url && nextAttachments[index].url.startsWith('blob:')) {
        URL.revokeObjectURL(nextAttachments[index].url)
      }
      nextAttachments.splice(index, 1)
      return nextAttachments
    })
  }

  const handleShareLocation = () => {
    const fallbackLocation = {
      name: 'Vị trí hiện tại',
      type: 'location',
      url: 'https://maps.google.com/?q=10.7626,106.6602',
    }

    if (!navigator.geolocation) {
      setAttachments((current) => [...current, fallbackLocation])
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(4)
        const lng = position.coords.longitude.toFixed(4)

        setAttachments((current) => [
          ...current,
          {
            name: `Vị trí (${lat}, ${lng})`,
            type: 'location',
            url: `https://maps.google.com/?q=${lat},${lng}`,
          },
        ])
      },
      () => {
        setAttachments((current) => [...current, fallbackLocation])
      },
    )
  }

  const handleDraftKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  if (!selectedThread) {
    return null
  }

  return (
    <div className="patient-messages-page">
      <div className="patient-chat-mobile-strip">
        <div className="patient-chat-mobile-strip-list">
          {visibleThreads.map((thread) => {
            const active = thread.id === selectedThreadId

            return (
              <button
                key={thread.id}
                className={`patient-chat-mobile-thread${active ? ' is-active' : ''}`}
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
              >
                <div className="patient-chat-thread-avatar">
                  <span>{getChatInitials(thread.doctor)}</span>
                  <i className={thread.online ? 'is-online' : ''} aria-hidden="true" />
                </div>

                <div className="patient-chat-mobile-thread-copy">
                  <strong>{thread.doctor}</strong>
                  <span>{thread.specialty}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="patient-chat-layout">
        <aside className="patient-chat-thread-panel">
          <div className="patient-chat-search-shell">
            <label className="patient-chat-search" aria-label="Tìm bác sĩ">
              <span className="patient-chat-search-icon" aria-hidden="true">
                <PatientIcon name="search" />
              </span>
              <input
                type="text"
                placeholder="Tìm kiếm bác sĩ..."
                value={threadSearch}
                onChange={(event) => setThreadSearch(event.target.value)}
              />
            </label>
          </div>

          <div className="patient-chat-thread-list">
            {visibleThreads.length ? (
              visibleThreads.map((thread) => {
                const active = thread.id === selectedThreadId

                return (
                  <button
                    key={thread.id}
                    className={`patient-chat-thread-card${active ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                  >
                    <div className="patient-chat-thread-avatar">
                      <span>{getChatInitials(thread.doctor)}</span>
                      <i className={thread.online ? 'is-online' : ''} aria-hidden="true" />
                    </div>

                    <div className="patient-chat-thread-copy">
                      <div className="patient-chat-thread-head">
                        <h3>{thread.doctor}</h3>
                        <span>{thread.time}</span>
                      </div>

                      <p className={`patient-chat-thread-specialty${active ? ' is-active' : ''}`}>
                        {thread.specialty}
                      </p>
                      <p className="patient-chat-thread-preview">{thread.preview}</p>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="patient-chat-thread-empty">
                <PatientIcon name="forum" aria-hidden="true" />
                <p>Không tìm thấy cuộc trò chuyện phù hợp.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="patient-chat-main-panel">
          <header className="patient-chat-conversation-head">
            <div className="patient-chat-conversation-profile">
              <div className="patient-chat-conversation-avatar">
                <span>{getChatInitials(selectedThread.doctor)}</span>
                <i className={selectedThread.online ? 'is-online' : ''} aria-hidden="true" />
              </div>

              <div>
                <div className="patient-chat-conversation-title">
                  <h2>{selectedThread.doctor}</h2>
                  <span>{selectedThread.online ? 'Đang hoạt động' : 'Ngoại tuyến'}</span>
                </div>
                <p>{selectedThread.experience}</p>
              </div>
            </div>

            <div className="patient-chat-conversation-actions">
              <button className="patient-hero-button" type="button">
                <PatientIcon name="videocam" aria-hidden="true" />
                <span>Đặt lịch tư vấn video</span>
              </button>

              <button className="patient-chat-icon-button" type="button" aria-label="Thao tác khác">
                <PatientIcon name="more_vert" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="patient-chat-history">
            <div className="patient-chat-day-pill">Hôm nay, ngày 10 tháng 10</div>

            {selectedThread.messages.map((message) => {
              if (message.type === 'ai') {
                return (
                  <div key={message.id} className="patient-chat-ai-card">
                    <div className="patient-chat-ai-head">
                      <PatientIcon name="auto_awesome" aria-hidden="true" />
                      <span>Trợ lý AI gợi ý</span>
                    </div>
                    <p>{message.prompt}</p>
                    <div className="patient-chat-ai-actions">
                      {message.options.map((option) => (
                        <button key={option} type="button">
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              }

              const fromDoctor = message.sender === 'doctor'

              return (
                <div
                  key={message.id}
                  className={`patient-chat-message-row${fromDoctor ? ' is-doctor' : ' is-patient'}`}
                >
                  <div className="patient-chat-message-avatar">
                    <span>{fromDoctor ? getChatInitials(selectedThread.doctor) : 'BN'}</span>
                  </div>

                  <div className="patient-chat-bubble-stack">
                    <div className={`patient-chat-bubble${fromDoctor ? '' : ' is-patient'}`}>
                      {message.text ? <div>{message.text}</div> : null}

                      {message.attachments?.length ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            marginTop: message.text ? '8px' : '0',
                          }}
                        >
                          {message.attachments.map((file, idx) =>
                            file.type === 'location' ? (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  background: fromDoctor
                                    ? 'rgba(0,0,0,0.05)'
                                    : 'rgba(255,255,255,0.2)',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                }}
                              >
                                <PatientIcon name="location_on" aria-hidden="true" />
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: 'inherit',
                                    textDecoration: 'underline',
                                    wordBreak: 'break-all',
                                  }}
                                >
                                  {file.name}
                                </a>
                              </div>
                            ) : file.type?.startsWith('image/') ? (
                              <img
                                key={idx}
                                src={file.url}
                                alt={file.name}
                                style={{
                                  maxWidth: '100%',
                                  borderRadius: '8px',
                                  maxHeight: '200px',
                                  objectFit: 'cover',
                                  cursor: 'pointer',
                                }}
                                onClick={() => window.open(file.url, '_blank')}
                              />
                            ) : (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  background: fromDoctor
                                    ? 'rgba(0,0,0,0.05)'
                                    : 'rgba(255,255,255,0.2)',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                }}
                              >
                                <PatientIcon name="description" aria-hidden="true" />
                                <a
                                  href={file.url}
                                  download={file.name}
                                  style={{
                                    color: 'inherit',
                                    textDecoration: 'none',
                                    wordBreak: 'break-all',
                                  }}
                                >
                                  {file.name}
                                </a>
                              </div>
                            ),
                          )}
                        </div>
                      ) : null}
                    </div>

                    <span className={`patient-chat-message-time${fromDoctor ? '' : ' is-patient'}`}>
                      {message.time}
                      {!fromDoctor && message.seen ? (
                        <strong>
                          <PatientIcon name="done_all" aria-hidden="true" />
                        </strong>
                      ) : null}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="patient-chat-composer-wrap">
            {attachments.length ? (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(160, 174, 203, 0.14)',
                  overflowX: 'auto',
                }}
              >
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(232, 237, 247, 0.78)',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      border: '1px solid rgba(160, 174, 203, 0.14)',
                    }}
                  >
                    {file.type === 'location' ? (
                      <PatientIcon name="location_on" aria-hidden="true" />
                    ) : file.type?.startsWith('image/') ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        style={{
                          width: '24px',
                          height: '24px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                        }}
                      />
                    ) : (
                      <PatientIcon name="description" aria-hidden="true" />
                    )}

                    <span
                      style={{
                        maxWidth: '120px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.name}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      style={{
                        cursor: 'pointer',
                        border: 'none',
                        background: 'none',
                        color: '#ba1a1a',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px',
                        marginLeft: '4px',
                      }}
                    >
                      <PatientIcon name="close" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="patient-chat-composer">
              <div
                className="patient-chat-composer-tools"
                style={{ position: 'relative' }}
                ref={attachmentMenuRef}
              >
                <button
                  type="button"
                  aria-label="Thêm đính kèm"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  style={{ color: 'var(--patient-primary)' }}
                >
                  <PatientIcon name="add_circle" aria-hidden="true" />
                </button>

                {showAttachmentMenu ? (
                  <div
                    className="patient-chat-attachment-menu"
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '0',
                      marginBottom: '8px',
                      background: '#fff',
                      boxShadow: '0 18px 30px rgba(15, 23, 42, 0.12)',
                      borderRadius: '8px',
                      padding: '4px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: '160px',
                      border: '1px solid rgba(160, 174, 203, 0.14)',
                      zIndex: 10,
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'var(--patient-primary)',
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(event) => {
                        event.currentTarget.style.background = 'rgba(232, 237, 247, 0.78)'
                      }}
                      onMouseOut={(event) => {
                        event.currentTarget.style.background = 'none'
                      }}
                      onClick={() => {
                        fileInputRef.current?.click()
                        setShowAttachmentMenu(false)
                      }}
                    >
                      <PatientIcon name="description" aria-hidden="true" />
                      <span style={{ fontWeight: 500 }}>Chia sẻ tệp</span>
                    </button>

                    <button
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'var(--patient-primary)',
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(event) => {
                        event.currentTarget.style.background = 'rgba(232, 237, 247, 0.78)'
                      }}
                      onMouseOut={(event) => {
                        event.currentTarget.style.background = 'none'
                      }}
                      onClick={() => {
                        handleShareLocation()
                        setShowAttachmentMenu(false)
                      }}
                    >
                      <PatientIcon name="location_on" aria-hidden="true" />
                      <span style={{ fontWeight: 500 }}>Chia sẻ vị trí</span>
                    </button>
                  </div>
                ) : null}

                <input type="file" hidden multiple ref={fileInputRef} onChange={handleFileSelect} />

                <button
                  type="button"
                  aria-label="Thêm hình ảnh"
                  onClick={() => imageInputRef.current?.click()}
                  style={{ color: 'var(--patient-primary)' }}
                >
                  <PatientIcon name="image" aria-hidden="true" />
                </button>
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  multiple
                  ref={imageInputRef}
                  onChange={handleFileSelect}
                />
              </div>

              <textarea
                placeholder="Nhập tin nhắn..."
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleDraftKeyDown}
              />

              <div className="patient-chat-composer-actions">
                <button className="patient-chat-ai-support" type="button">
                  <PatientIcon name="auto_awesome" aria-hidden="true" />
                  <span>Hỗ trợ AI</span>
                </button>
                <button className="patient-chat-send" type="button" onClick={handleSendMessage}>
                  <PatientIcon name="send" aria-hidden="true" />
                </button>
              </div>
            </div>

            <p className="patient-chat-security-note">
              <PatientIcon name="lock" aria-hidden="true" />
              <span>Cuộc trò chuyện được mã hóa đầu cuối và bảo mật tuyệt đối.</span>
            </p>
          </div>
        </section>

        <aside className="patient-chat-context-panel">
          <h3>Tóm tắt sức khỏe</h3>

          <div className="patient-chat-snapshot-list">
            {selectedThread.snapshot.map((item) => (
              <article key={item.id} className="patient-chat-snapshot-card">
                <div className="patient-chat-snapshot-head">
                  <div className={`patient-chat-snapshot-icon ${item.tone}`}>
                    <PatientIcon name={item.icon} aria-hidden="true" />
                  </div>
                  <span>{item.label}</span>
                </div>

                <div className="patient-chat-snapshot-value">
                  <strong>{item.value}</strong>
                  <span>{item.unit}</span>
                </div>

                <p>{item.trend}</p>
              </article>
            ))}
          </div>

          <div className="patient-chat-documents">
            <h4>Tài liệu liên quan</h4>

            <div className="patient-chat-document-list">
              {selectedThread.documents.map((document) => (
                <button key={document.id} className="patient-chat-document-card" type="button">
                  <div className={`patient-chat-document-mark ${document.tone}`}>
                    <PatientIcon name={document.icon} aria-hidden="true" />
                  </div>

                  <div className="patient-chat-document-copy">
                    <strong>{document.name}</strong>
                    <span>
                      {document.size} | {document.date}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
