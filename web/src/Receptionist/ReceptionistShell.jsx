import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearStoredAuth, readStoredAuth } from '../lib/storage'
import './receptionist.css'

const menuGroups = [
  { title: '', items: [{ key: 'dashboard', label: 'Tổng quan', icon: 'home' }] },
  {
    title: 'Lịch & đặt lịch',
    items: [
      { key: 'appointments', label: 'Lịch hẹn', icon: 'calendar' },
      { key: 'createAppointment', label: 'Đặt lịch mới', icon: 'plus' },
      { key: 'waitingList', label: 'Lịch chờ', icon: 'calendar', count: 12 },
      { key: 'queue', label: 'Danh sách chờ', icon: 'queue' },
    ],
  },
  {
    title: 'Bệnh nhân',
    items: [
      { key: 'searchPatient', label: 'Tìm bệnh nhân', icon: 'search' },
      { key: 'patientRecords', label: 'Hồ sơ bệnh nhân', icon: 'patient' },
    ],
  },
  {
    title: 'Thanh toán',
    items: [
      { key: 'cashier', label: 'Thu ngân', icon: 'wallet' },
      { key: 'paymentHistory', label: 'Lịch sử thanh toán', icon: 'receipt' },
    ],
  },
  { title: 'Báo cáo', items: [{ key: 'dailyReport', label: 'Báo cáo ngày', icon: 'chart' }, { key: 'productivity', label: 'Hiệu suất làm việc', icon: 'trend' }] },
  { title: 'Cài đặt', items: [{ key: 'settings', label: 'Trạng thái hệ thống', icon: 'settings' }, { key: 'account', label: 'Tài khoản của tôi', icon: 'users' }] },
]

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

function doctorInitials(name) {
  if (!name) return 'R'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase()
}

export default function ReceptionistShell({
  title,
  subtitle,
  activeSection,
  searchTerm,
  onSearchChange,
  onCreateAppointment,
  children,
}) {
  const navigate = useNavigate()
  const auth = readStoredAuth()
  const [activeHeaderPanel, setActiveHeaderPanel] = useState('')
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '')
  const searchInputRef = useRef(null)

  useEffect(() => {
    setLocalSearchTerm(searchTerm || '')
  }, [searchTerm])

  const displayUser = auth?.user?.fullName || auth?.user?.username || 'Receptionist'
  const normalizedSearchTerm = localSearchTerm.trim().toLowerCase()

  function handleMenuSelection(item) {
    if (item.key === 'dashboard') {
      navigate('/receptionist')
      return
    }
    if (item.key === 'appointments') {
      navigate('/receptionist/appointments')
      return
    }
    if (item.key === 'createAppointment') {
      navigate('/receptionist/create')
      return
    }
    if (item.key === 'waitingList') {
      navigate('/receptionist/waiting-list')
      return
    }
    if (item.key === 'queue') {
      navigate('/receptionist/queue')
      return
    }
    if (item.key === 'searchPatient') {
      navigate('/receptionist/patients')
      return
    }
    if (item.key === 'patientRecords') {
      navigate('/receptionist/patient-records')
      return
    }
    if (item.key === 'cashier') {
      navigate('/receptionist/cashier')
      return
    }
    if (item.key === 'paymentHistory') {
      navigate('/receptionist/payment-history')
      return
    }
    if (item.key === 'dailyReport') {
      navigate('/receptionist/daily-report')
      return
    }
    if (item.key === 'productivity') {
      navigate('/receptionist/productivity')
      return
    }
    if (item.key === 'settings') {
      navigate('/receptionist/settings')
      return
    }
    if (item.key === 'account') {
      navigate('/receptionist/account')
      return
    }
    navigate('/receptionist')
  }

  function handleLogout() {
    clearStoredAuth()
    navigate('/staff/login', { replace: true })
  }

  function handleQuickAction(action) {
    if (action === 'Dat lich moi') {
      onCreateAppointment?.()
      return
    }
    if (action === 'Tim benh nhan') {
      setActiveHeaderPanel('search')
      return
    }
    if (action === 'Check-in benh nhan') {
      navigate('/receptionist/appointments')
      return
    }
  }

  return (
    <main className="rd-app appointments-page">
      <aside className="rd-sidebar">
        <div className="rd-brand">
          <div className="rd-logo"><Icon name="logo" /></div>
          <strong>MediCare+</strong>
          <button aria-label="Thu gon">x</button>
        </div>

        <nav className="rd-nav" aria-label="Receptionist navigation">
          {menuGroups.map((group) => (
            <section key={group.title || 'main'}>
              {group.title && <p>{group.title}</p>}
              {group.items.map((item) => (
                <button
                  key={item.key}
                  className={item.key === activeSection ? 'active' : ''}
                  onClick={() => handleMenuSelection(item)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.count && <b>{item.count}</b>}
                </button>
              ))}
            </section>
          ))}
        </nav>
      </aside>

      <section className="rd-main">
        <header className="rd-header">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className={`rd-search-wrap ${activeHeaderPanel === 'search' ? 'open' : ''}`}>
            <label className="rd-search">
              <Icon name="search" />
              <input
                ref={searchInputRef}
                value={localSearchTerm}
                onFocus={() => setActiveHeaderPanel('search')}
                onChange={(event) => {
                  setLocalSearchTerm(event.target.value)
                  onSearchChange?.(event.target.value)
                  setActiveHeaderPanel('search')
                }}
                placeholder="Tìm bệnh nhân, số điện thoại, mã hồ sơ..."
              />
              {localSearchTerm ? (
                <button type="button" aria-label="Xóa tìm kiếm" onClick={() => {
                  setLocalSearchTerm('')
                  onSearchChange?.('')
                }}>x</button>
              ) : (
                <kbd>Ctrl K</kbd>
              )}
            </label>
            {activeHeaderPanel === 'search' && (
              <div className="rd-header-panel rd-search-panel">
                <header>
                  <strong>Tìm nhanh</strong>
                  <button type="button" onClick={() => setActiveHeaderPanel('')}>Đóng</button>
                </header>
                {normalizedSearchTerm ? (
                  <p>Đang tìm kiếm: <strong>{normalizedSearchTerm}</strong></p>
                ) : (
                  <p>Nhập tên bệnh nhân, số điện thoại, mã hồ sơ hoặc tên bác sĩ.</p>
                )}
              </div>
            )}
          </div>

          <div className="rd-user-actions">
            <div className="rd-action-slot">
              <button aria-label="Mở thao tác nhanh" className="rd-primary-action" onClick={() => setActiveHeaderPanel((current) => (current === 'actions' ? '' : 'actions'))}>
                <Icon name="plus" />
              </button>
              {activeHeaderPanel === 'actions' && (
                <div className="rd-header-panel rd-action-panel">
                  <header>
                    <strong>Thao tác nhanh</strong>
                    <button type="button" onClick={() => setActiveHeaderPanel('')}>Đóng</button>
                  </header>
                  <button type="button" onClick={() => handleQuickAction('Dat lich moi')}>
                    <Icon name="calendar" />
                    <span>
                      <strong>Đặt lịch mới</strong>
                      <small>Mở màn hình tạo lịch khám</small>
                    </span>
                  </button>
                  <button type="button" onClick={() => handleQuickAction('Check-in benh nhan')}>
                    <Icon name="check" />
                    <span>
                      <strong>Check-in bệnh nhân</strong>
                      <small>Tiếp nhận lịch gần nhất</small>
                    </span>
                  </button>
                  <button type="button" onClick={() => handleQuickAction('Tim benh nhan')}>
                    <Icon name="search" />
                    <span>
                      <strong>Tìm bệnh nhân</strong>
                      <small>Tra cứu hồ sơ & lịch</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
            <div className="rd-action-slot">
              <button aria-label="Thông báo" onClick={() => setActiveHeaderPanel((current) => (current === 'notifications' ? '' : 'notifications'))}>
                <Icon name="bell" />
              </button>
              {activeHeaderPanel === 'notifications' && (
                <div className="rd-header-panel rd-notification-panel">
                  <header>
                    <strong>Thông báo</strong>
                    <button type="button" onClick={() => setActiveHeaderPanel('')}>Đóng</button>
                  </header>
                  <article>
                    <strong>Thông tin hệ thống</strong>
                    <p>Thông báo mới sẽ hiển thị ở đây.</p>
                  </article>
                </div>
              )}
            </div>
            <div className="rd-action-slot">
              <button aria-label="Tin nhắn" onClick={() => setActiveHeaderPanel((current) => (current === 'messages' ? '' : 'messages'))}>
                <Icon name="message" />
              </button>
              {activeHeaderPanel === 'messages' && (
                <div className="rd-header-panel rd-notification-panel">
                  <header>
                    <strong>Tin nhắn nội bộ</strong>
                    <button type="button" onClick={() => setActiveHeaderPanel('')}>Đóng</button>
                  </header>
                  <article>
                    <strong>Thông báo nội bộ</strong>
                    <p>Không có tin nhắn mới.</p>
                  </article>
                </div>
              )}
            </div>
            <div className="rd-profile rd-action-slot">
              <button className="rd-profile-trigger" type="button" onClick={() => setActiveHeaderPanel((current) => (current === 'profile' ? '' : 'profile'))}>
                <div>{doctorInitials(displayUser)}</div>
                <span><strong>{displayUser}</strong><small>Receptionist</small></span>
              </button>
              {activeHeaderPanel === 'profile' && (
                <div className="rd-header-panel rd-profile-panel">
                  <header>
                    <strong>Tài khoản nhân sự</strong>
                    <button type="button" onClick={() => setActiveHeaderPanel('')}>Đóng</button>
                  </header>
                  <div className="rd-profile-card">
                    <div>{doctorInitials(displayUser)}</div>
                    <span>
                      <strong>{displayUser}</strong>
                      <small>Receptionist Portal</small>
                    </span>
                    <b>Online</b>
                  </div>
                  <button type="button" onClick={handleLogout}>
                    <Icon name="patient" />
                    <span><strong>Đăng xuất</strong><small>Thoát tài khoản</small></span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {children}
      </section>
    </main>
  )
}
