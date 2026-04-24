import { Link, NavLink } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { doctorNavItems, getInitials, statusToneMap } from './doctorData'

export function DoctorIcon({ name }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.85',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    viewBox: '0 0 24 24',
  }

  switch (name) {
    case 'clipboard':
      return (
        <svg {...common}>
          <rect x="6" y="4" width="12" height="16" rx="2.5" />
          <path d="M9 4.5h6M9 9h6M9 13h6M9 17h4" />
        </svg>
      )
    case 'pulse':
      return (
        <svg {...common}>
          <path d="M3 12h4l2-4 3 8 2-4h7" />
        </svg>
      )
    case 'pill':
      return (
        <svg {...common}>
          <path d="M9.5 6.5a4.5 4.5 0 0 1 6.4 0l1.6 1.6a4.5 4.5 0 0 1 0 6.4l-2.9 2.9a4.5 4.5 0 0 1-6.4 0l-1.6-1.6a4.5 4.5 0 0 1 0-6.4Z" />
          <path d="m9 15 6-6" />
        </svg>
      )
    case 'note':
      return (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M15 3v4h4M9 12h6M9 16h6" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 5v6h-6" />
          <path d="M4 19v-6h6" />
          <path d="M19 11a7 7 0 0 0-12-4M5 13a7 7 0 0 0 12 4" />
        </svg>
      )
    case 'warning':
      return (
        <svg {...common}>
          <path d="M12 3 2.8 19a1.3 1.3 0 0 0 1.1 2h16.2a1.3 1.3 0 0 0 1.1-2L12 3Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      )
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
        </svg>
      )
    case 'queue':
      return (
        <svg {...common}>
          <path d="M7 7h10M7 12h10M7 17h6" />
          <circle cx="4" cy="7" r="1" />
          <circle cx="4" cy="12" r="1" />
          <circle cx="4" cy="17" r="1" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5v5l3 2" />
        </svg>
      )
    case 'doctor':
      return (
        <svg {...common}>
          <circle cx="12" cy="8.2" r="3.2" />
          <path d="M6 19c0-3.2 2.7-5.8 6-5.8s6 2.6 6 5.8" />
          <path d="M12 5.5v5.4M9.3 8.2h5.4" />
        </svg>
      )
    case 'patients':
      return (
        <svg {...common}>
          <circle cx="8" cy="9" r="2.5" />
          <circle cx="16" cy="8" r="2" />
          <path d="M3.5 18c.4-2.6 2.6-4.5 5.2-4.5s4.8 1.9 5.2 4.5" />
          <path d="M13.3 17.4c.3-2 2-3.5 4-3.5 1.4 0 2.6.7 3.3 1.9" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 4 1.5 5 2 5H4.5c.5 0 2-1 2-5" />
          <path d="M10 18a2.2 2.2 0 0 0 4 0" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.8-1L14.4 3h-4.8l-.3 2a7 7 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.8 1l.3 2h4.8l.3-2a7 7 0 0 0 1.8-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1Z" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 19c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" />
        </svg>
      )
    case 'home':
      return (
        <svg {...common}>
          <path d="m4 10 8-6 8 6" />
          <path d="M6.5 9.5V20h11V9.5" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      )
    case 'check_circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.5 12.2 2.2 2.3 4.8-5" />
        </svg>
      )
    case 'cancel':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}

export function StatusBadge({ status, className = '' }) {
  const meta = statusToneMap[status] || { label: status || 'Không rõ', tone: 'neutral' }

  return (
    <span className={`doctor-status-badge doctor-status-${meta.tone} ${className}`.trim()}>
      {meta.label}
    </span>
  )
}

export function StatCard({ label, value, hint, tone = 'blue', icon = 'dashboard' }) {
  return (
    <article className={`doctor-stat-card doctor-stat-${tone}`}>
      <div className="doctor-stat-icon" aria-hidden="true">
        <DoctorIcon name={icon} />
      </div>
      <div className="doctor-stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
    </article>
  )
}

export function LoadingState({ label = 'Đang tải không gian làm việc lâm sàng...' }) {
  return (
    <div className="doctor-state doctor-state-loading">
      <div className="doctor-spinner" />
      <p>{label}</p>
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="doctor-state doctor-state-empty">
      <div className="doctor-state-icon">
        <DoctorIcon name="clipboard" />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function ErrorState({ title = 'Không thể tải dữ liệu', message, onRetry }) {
  return (
    <div className="doctor-state doctor-state-error">
      <div className="doctor-state-icon doctor-state-icon-danger">
        <DoctorIcon name="warning" />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry ? (
        <button className="doctor-secondary-button" type="button" onClick={onRetry}>
          Thử lại
        </button>
      ) : null}
    </div>
  )
}

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  tone = 'primary',
  busy = false,
  onCancel,
  onConfirm,
}) {
  if (!open) {
    return null
  }

  return (
    <div className="doctor-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="doctor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doctor-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="doctor-dialog-head">
          <h3 id="doctor-dialog-title">{title}</h3>
          <button className="doctor-icon-button" type="button" onClick={onCancel} aria-label="Đóng hộp thoại">
            <DoctorIcon name="cancel" />
          </button>
        </div>
        <p>{description}</p>
        <div className="doctor-dialog-actions">
          <button className="doctor-secondary-button" type="button" onClick={onCancel} disabled={busy}>
            Hủy
          </button>
          <button
            className={`doctor-primary-button doctor-primary-${tone}`}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PatientSummaryCard({ patient, compact = false, children }) {
  const displayName = patient?.full_name || patient?.fullName || 'Chưa rõ bệnh nhân'
  const age = patient?.age || patient?.patient_age || patient?.years_old
  const metaParts = [
    patient?.patient_code || patient?.patientCode,
    age ? `${age} yrs` : null,
    patient?.gender,
    patient?.blood_type || patient?.bloodType,
  ].filter(Boolean)

  return (
    <aside className={`doctor-patient-card${compact ? ' is-compact' : ''}`}>
      <div className="doctor-patient-head">
        <div className="doctor-patient-avatar">{getInitials(displayName) || 'PT'}</div>
        <div>
          <h3>{displayName}</h3>
          {metaParts.length > 0 ? <p>{metaParts.join(' • ')}</p> : null}
        </div>
      </div>

      <dl className="doctor-summary-grid">
        {(patient?.phone || patient?.email) && (
          <>
            {patient?.phone ? (
              <div>
                <dt>Số điện thoại</dt>
                <dd>{patient.phone}</dd>
              </div>
            ) : null}
            {patient?.email ? (
              <div>
                <dt>Email</dt>
                <dd>{patient.email}</dd>
              </div>
            ) : null}
          </>
        )}
        {patient?.insurance_number ? (
          <div>
            <dt>Bảo hiểm</dt>
            <dd>{patient.insurance_number}</dd>
          </div>
        ) : null}
        {patient?.status ? (
          <div>
            <dt>Trạng thái</dt>
            <dd>
              <StatusBadge status={patient.status} />
            </dd>
          </div>
        ) : null}
      </dl>

      {Array.isArray(patient?.allergies) && patient.allergies.length > 0 ? (
        <div className="doctor-alert-card">
          <div className="doctor-alert-head">
            <DoctorIcon name="warning" />
            <strong>Cảnh báo dị ứng</strong>
          </div>
          <ul>
            {patient.allergies.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {children}
    </aside>
  )
}

export function SectionCard({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`doctor-section-card ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <header className="doctor-section-head">
          <div className="doctor-section-copy">
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="doctor-section-actions">{actions}</div> : null}
        </header>
      )}
      <div className="doctor-section-content">
        {children}
      </div>
    </section>
  )
}

function formatRoleLabel(role) {
  const normalized = String(role || 'doctor')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const roleMap = {
    doctor: 'Bác sĩ',
    receptionist: 'Lễ tân',
    nurse: 'Điều dưỡng',
    admin: 'Quản trị viên',
    pharmacist: 'Dược sĩ',
    lab: 'Xét nghiệm',
    'lab technician': 'Kỹ thuật viên xét nghiệm',
    technician: 'Kỹ thuật viên',
  }

  return roleMap[normalized.toLowerCase()] || normalized.replace(/\b\w/g, (character) => character.toUpperCase())
}

function getUserIdentity(user) {
  const rawRoles =
    Array.isArray(user?.roles) && user.roles.length > 0
      ? user.roles
      : user?.role
        ? [user.role]
        : ['doctor']

  return {
    displayName: user?.fullName || user?.username || user?.email || 'Bác sĩ',
    primaryRole: formatRoleLabel(rawRoles[0]),
    secondaryRoles: rawRoles.slice(1).map(formatRoleLabel),
  }
}

function DoctorSidebar({ onNavigateHome, user }) {
  const identity = getUserIdentity(user)

  return (
    <aside className="doctor-sidebar">
      <div className="doctor-sidebar-brand">
        <button className="doctor-sidebar-brandmark" type="button" onClick={onNavigateHome}>
          <img src="/images/logo.png" alt="HealthCare" />
        </button>
        <div className="doctor-sidebar-brand-copy">
          <p>Không gian Bác sĩ</p>
          <span>Vận hành lâm sàng</span>
        </div>
      </div>

      <div className="doctor-sidebar-section-label">Khu làm việc</div>

      <nav className="doctor-sidebar-nav" aria-label="Điều hướng không gian làm việc bác sĩ">
        {doctorNavItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `doctor-sidebar-link${isActive ? ' is-active' : ''}`}
          >
            <span className="doctor-sidebar-icon" aria-hidden="true">
              <DoctorIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="doctor-sidebar-identity">
        <div className="doctor-sidebar-identity-avatar">{getInitials(identity.displayName) || 'DR'}</div>
        <div>
          <strong>{identity.displayName}</strong>
          <span>{identity.primaryRole}</span>
        </div>
      </div>

      <div className="doctor-sidebar-footer">
        <div className="doctor-sidebar-footer-links">
          <Link className="doctor-sidebar-utility" to="/tai-khoan">
            <span className="doctor-sidebar-icon" aria-hidden="true">
              <DoctorIcon name="user" />
            </span>
            <span>Hồ sơ</span>
          </Link>
          <Link className="doctor-sidebar-utility" to="/">
            <span className="doctor-sidebar-icon" aria-hidden="true">
              <DoctorIcon name="home" />
            </span>
            <span>Trang chủ</span>
          </Link>
        </div>
      </div>
    </aside>
  )
}

function DoctorTopbar({ title, subtitle, searchPlaceholder, user, onLogout, onNavigateHome }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const headerMeta = useMemo(() => getUserIdentity(user), [user])

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date()),
    [],
  )

  return (
    <header className="doctor-topbar">
      <div className="doctor-topbar-inner">
        <div className="doctor-topbar-copy">
          <div className="doctor-topbar-meta">
            <span className="doctor-topbar-eyebrow">Khu điều hành lâm sàng</span>
            <span className="doctor-context-pill">Đang trực | {todayLabel}</span>
          </div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        <div className="doctor-topbar-actions">
          <label className="doctor-searchbox">
            <span className="doctor-searchbox-icon" aria-hidden="true">
              <DoctorIcon name="search" />
            </span>
            <span className="doctor-searchbox-copy">
              <input
                type="search"
                placeholder={searchPlaceholder || 'Tìm bệnh nhân, hồ sơ hoặc phiên khám...'}
              />
              <small>TRA CỨU LÂM SÀNG NHANH</small>
            </span>
            <span className="doctor-searchbox-shortcut" aria-hidden="true">
              /
            </span>
          </label>

          <div className="doctor-topbar-tools">
            <button className="doctor-icon-button" type="button" aria-label="Thông báo">
              <DoctorIcon name="bell" />
            </button>

            <button className="doctor-icon-button" type="button" aria-label="Cài đặt">
              <DoctorIcon name="settings" />
            </button>

            <div className="doctor-user-menu" ref={menuRef}>
              <button
                className="doctor-user-trigger"
                type="button"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
              >
                <span className="doctor-user-copy">
                  <strong>{headerMeta.displayName}</strong>
                  <small>{headerMeta.primaryRole}</small>
                </span>
                <span className="doctor-user-avatar">{getInitials(headerMeta.displayName) || 'DR'}</span>
              </button>

              {menuOpen ? (
                <div className="doctor-user-dropdown">
                  <div className="doctor-user-dropdown-head">
                    <span className="doctor-user-avatar doctor-user-avatar-large">
                      {getInitials(headerMeta.displayName) || 'DR'}
                    </span>
                    <div className="doctor-user-dropdown-copy">
                      <strong>{headerMeta.displayName}</strong>
                      <small>{headerMeta.primaryRole}</small>
                      {headerMeta.secondaryRoles.length ? (
                        <p>{headerMeta.secondaryRoles.join(' / ')}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="doctor-user-dropdown-divider" />
                  <Link to="/tai-khoan" className="doctor-user-dropdown-item" onClick={() => setMenuOpen(false)}>
                    <DoctorIcon name="user" />
                    <span>Xem hồ sơ</span>
                  </Link>
                  <button
                    className="doctor-user-dropdown-item"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onNavigateHome()
                    }}
                  >
                    <DoctorIcon name="home" />
                    <span>Về trang chủ</span>
                  </button>
                  <button
                    className="doctor-user-dropdown-item is-danger"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onLogout()
                    }}
                  >
                    <DoctorIcon name="logout" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export function DoctorAppShell({
  title,
  subtitle,
  searchPlaceholder,
  user,
  onLogout,
  onNavigateHome,
  children,
}) {
  return (
    <div className="doctor-shell">
      <DoctorSidebar onNavigateHome={onNavigateHome} user={user} />
      <div className="doctor-shell-main">
        <DoctorTopbar
          title={title}
          subtitle={subtitle}
          searchPlaceholder={searchPlaceholder}
          user={user}
          onLogout={onLogout}
          onNavigateHome={onNavigateHome}
        />
        <main className="doctor-shell-content">
          <div className="doctor-shell-inner">{children}</div>
        </main>
      </div>
    </div>
  )
}

