import { useEffect, useRef, useState } from 'react'
import { primaryNav, statusMeta } from './appointmentCenterData'

export function Icon({ name }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.85',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    viewBox: '0 0 24 24',
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      )
    case 'patients':
      return (
        <svg {...common}>
          <path d="M16 19v-1.2A3.8 3.8 0 0 0 12.2 14H7.8A3.8 3.8 0 0 0 4 17.8V19" />
          <circle cx="10" cy="8" r="3" />
          <path d="M17 8a2.5 2.5 0 0 1 0 5" />
        </svg>
      )
    case 'doctor':
      return (
        <svg {...common}>
          <path d="M12 3v5M9.5 5.5h5" />
          <path d="M6 10h12v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10Z" />
        </svg>
      )
    case 'building':
      return (
        <svg {...common}>
          <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
          <path d="M8 7h.01M12 7h.01M8 11h.01M12 11h.01M8 15h.01M12 15h.01M16 21h4v-8h-4" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 20V9M12 20V4M20 20v-7" />
          <path d="M3 20h18" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M15.5 17H5.3l1.2-1.2a2.1 2.1 0 0 0 .7-1.5V10a5 5 0 1 1 10 0v4.3a2 2 0 0 0 .7 1.5L19 17h-3.5" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
      )
    case 'filter':
      return (
        <svg {...common}>
          <path d="M4 7h16M7 12h10M10 17h4" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 3v11" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 21h14" />
        </svg>
      )
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2.5 12s3.5-5.5 9.5-5.5S21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.3" />
        </svg>
      )
    case 'edit':
      return (
        <svg {...common}>
          <path d="M4 20h4l10-10-4-4L4 16v4Z" />
          <path d="m13 7 4 4" />
        </svg>
      )
    case 'print':
      return (
        <svg {...common}>
          <path d="M7 8V3h10v5" />
          <rect x="4" y="9" width="16" height="8" rx="2" />
          <rect x="6" y="14" width="12" height="7" rx="1.5" />
        </svg>
      )
    case 'cancel':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 9 6 6M15 9l-6 6" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.2 2.2 4.8-5.2" />
        </svg>
      )
    case 'queue':
      return (
        <svg {...common}>
          <path d="M4 7h12M4 12h12M4 17h8" />
          <path d="m15 14 3 3-3 3" />
        </svg>
      )
    case 'shuffle':
      return (
        <svg {...common}>
          <path d="M16 3h5v5M4 20l7-7M11 11l3-3a4 4 0 0 1 2.8-1.2H21" />
          <path d="M16 21h5v-5M4 4l7 7 3 3a4 4 0 0 0 2.8 1.2H21" />
        </svg>
      )
    case 'slash':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M6 6 18 18" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...common}>
          <path d="m12 3 1.4 3.8L17 8.2l-3.6 1.4L12 13.4l-1.4-3.8L7 8.2l3.6-1.4L12 3Z" />
          <path d="m18 16 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.4 1.9Z" />
        </svg>
      )
    case 'help':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9.4a2.9 2.9 0 0 1 5.3 1.6c0 2-2.4 2.6-2.4 4" />
          <path d="M12 17h.01" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...common}>
          <path d="M12 21s-5.5-5-5.5-10A5.5 5.5 0 1 1 17.5 11c0 5-5.5 10-5.5 10Z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      )
    case 'mail':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2.2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...common}>
          <path d="M6.8 3.8h2.6l1.3 4-1.7 1.7a15 15 0 0 0 6.1 6.1l1.7-1.7 4 1.3v2.6a1.7 1.7 0 0 1-1.7 1.7h-.8A15.3 15.3 0 0 1 4.5 5.5v-.8A1.7 1.7 0 0 1 6.2 3h.6Z" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 5 3.2 8.7 7 10 3.8-1.3 7-5 7-10V6l-7-3Z" />
          <path d="m9.5 12 1.8 1.8 3.2-3.6" />
        </svg>
      )
    case 'alert':
      return (
        <svg {...common}>
          <path d="M12 3 2.8 19a1.3 1.3 0 0 0 1.1 2h16.2a1.3 1.3 0 0 0 1.1-2L12 3Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      )
    case 'chevron-left':
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      )
    case 'home':
      return (
        <svg {...common}>
          <path d="m4 11 8-7 8 7" />
          <path d="M6.5 9.5V20h11V9.5" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M10 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m14 17 5-5-5-5" />
          <path d="M19 12H9" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      )
  }
}

export function AvatarChip({ initials = 'AC', tone = 'blue' }) {
  return <span className={`ac-avatar ac-avatar-${tone}`}>{initials}</span>
}

export function StatusPill({ status }) {
  const meta = statusMeta[status] || { label: status, tone: 'neutral' }
  return <span className={`ac-status-pill ac-status-${meta.tone}`}>{meta.label}</span>
}

export function AppointmentSidebar({
  activeSection,
  onOpenDashboard,
  onOpenAppointments,
  onCreateAppointment,
  onGoHome,
}) {
  return (
    <aside className="ac-sidebar">
      <button type="button" className="ac-brand ac-brand-button" onClick={onGoHome}>
        <div className="ac-brand-title">Clinical Curator</div>
        <div className="ac-brand-subtitle">Hospital Management</div>
      </button>

      <nav className="ac-sidebar-nav">
        {primaryNav.map((item) => {
          const isActive = activeSection === item.id
          const handler =
            item.id === 'dashboard' ? onOpenDashboard : item.id === 'appointments' ? onOpenAppointments : undefined

          return (
            <button
              key={item.id}
              type="button"
              className={`ac-nav-link ${isActive ? 'is-active' : ''}`}
              onClick={handler}
            >
              <span className="ac-nav-icon">
                <Icon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="ac-sidebar-footer">
        <button type="button" className="ac-create-button" onClick={onCreateAppointment}>
          Create Appointment
        </button>

        <button type="button" className="ac-aux-link" onClick={onGoHome}>
          <Icon name="home" />
          <span>Trang Chu</span>
        </button>

        <button type="button" className="ac-aux-link">
          <Icon name="settings" />
          <span>Settings</span>
        </button>
        <button type="button" className="ac-aux-link">
          <Icon name="help" />
          <span>Help</span>
        </button>
      </div>
    </aside>
  )
}

export function AppointmentTopbar({
  displayName,
  titleRole,
  subtitleRole,
  searchPlaceholder,
  label,
  userMeta,
  onOpenProfile,
  onGoHome,
  onLogout,
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)
  const initials = String(displayName || titleRole || 'AC')
    .trim()
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpenProfile = () => {
    setProfileOpen(false)
    onOpenProfile?.()
  }

  const handleGoHome = () => {
    setProfileOpen(false)
    onGoHome?.()
  }

  const handleLogout = () => {
    setProfileOpen(false)
    onLogout?.()
  }

  return (
    <header className="ac-topbar">
      <div className="ac-topbar-leading">
        {label ? <div className="ac-topbar-label">{label}</div> : null}
        <div className="ac-topbar-search">
          <Icon name="search" />
          <input placeholder={searchPlaceholder} readOnly aria-label={searchPlaceholder} />
        </div>
      </div>

      <div className="ac-topbar-actions">
        <button type="button" className="ac-topbar-icon" aria-label="Notifications">
          <Icon name="bell" />
        </button>
        <button type="button" className="ac-topbar-icon" aria-label="Locale">
          <Icon name="globe" />
        </button>

        <div className="ac-account-wrap" ref={profileRef}>
          <button type="button" className="ac-user-chip ac-user-chip-button" onClick={() => setProfileOpen((current) => !current)}>
            <div className="ac-user-copy">
              <strong>{titleRole}</strong>
              <span>{displayName}</span>
              {subtitleRole ? <small>{subtitleRole}</small> : null}
            </div>
            <AvatarChip initials={initials} tone="dark" />
          </button>

          {profileOpen ? (
            <div className="ac-account-dropdown">
              <div className="ac-account-header">
                <AvatarChip initials={initials} tone="dark" />
                <div>
                  <strong>{displayName}</strong>
                  <span>{titleRole}</span>
                </div>
              </div>

              <div className="ac-account-meta">
                {userMeta?.email ? (
                  <div>
                    <span>Email</span>
                    <strong>{userMeta.email}</strong>
                  </div>
                ) : null}
                {userMeta?.employeeCode ? (
                  <div>
                    <span>Ma Nhan Su</span>
                    <strong>{userMeta.employeeCode}</strong>
                  </div>
                ) : null}
                {userMeta?.status ? (
                  <div>
                    <span>Trang Thai</span>
                    <strong>{userMeta.status}</strong>
                  </div>
                ) : null}
              </div>

              <div className="ac-account-actions">
                <button type="button" className="ac-outline-button ac-wide-button" onClick={handleOpenProfile}>
                  <Icon name="user" />
                  Xem Ho So Ca Nhan
                </button>
                <button type="button" className="ac-outline-button ac-wide-button" onClick={handleGoHome}>
                  <Icon name="home" />
                  Ve Trang Chu
                </button>
                <button type="button" className="ac-danger-button ac-wide-button" onClick={handleLogout}>
                  <Icon name="logout" />
                  Dang Xuat
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
