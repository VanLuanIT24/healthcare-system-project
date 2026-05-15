import { Link, NavLink } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import BubbleBackground from './BubbleBackground'
import { doctorApi, getDoctorCapabilities } from './doctorApi'
import { doctorNavItems, getInitials, statusToneMap } from './doctorData'
import { notificationAPI, unwrapData } from '../utils/api'

const sidebarNavItems = doctorNavItems.filter((item) => item.id !== 'profile')

const dashboardSidebarGroups = [
  {
    id: 'dashboard',
    label: 'Tổng quan',
    icon: 'dashboard',
    path: '/doctor/dashboard',
  },
  {
    id: 'schedule',
    label: 'Lịch làm việc',
    icon: 'calendar',
    items: [
      { label: 'Hôm nay', path: '/doctor/schedules/today' },
      { label: 'Tuần này', path: '/doctor/schedules/week' },
      { label: 'Lịch trống', path: '/doctor/schedules/empty' },
    ],
  },
  {
    id: 'appointments',
    label: 'Lịch hẹn',
    icon: 'calendar',
    items: [
      { label: 'Hôm nay', path: '/doctor/appointments?view=today' },
      { label: 'Sắp tới', path: '/doctor/appointments?view=upcoming' },
      { label: 'Tất cả lịch hẹn', path: '/doctor/appointments' },
    ],
  },
  {
    id: 'queue',
    label: 'Hàng đợi',
    icon: 'queue',
    items: [
      { label: 'Bảng hàng đợi', path: '/doctor/queue' },
      { label: 'Gọi tiếp theo', path: '/doctor/queue?view=calling' },
      { label: 'Lịch sử hàng đợi', path: '/doctor/queue?view=history' },
    ],
  },
  {
    id: 'encounters',
    label: 'Phiên khám',
    icon: 'doctor',
    items: [
      { label: 'Hôm nay', path: '/doctor/encounters?view=today' },
      { label: 'Đang khám', path: '/doctor/encounters?view=active' },
      { label: 'Đã hoàn tất', path: '/doctor/encounters?view=completed' },
    ],
  },
  {
    id: 'patients',
    label: 'Bệnh nhân',
    icon: 'patients',
    items: [
      { label: 'Danh sách bệnh nhân', path: '/doctor/patients' },
      { label: 'Bệnh nhân gần đây', path: '/doctor/patients?view=recent' },
    ],
  },
  {
    id: 'orders',
    label: 'Chỉ định (Orders)',
    icon: 'clipboard',
    items: [
      { label: 'Đơn chỉ định', path: '/doctor/orders' },
      { label: 'Theo encounter', path: '/doctor/orders?view=encounter' },
      { label: 'Đang chờ xử lý', path: '/doctor/orders?view=pending' },
    ],
  },
  {
    id: 'prescriptions',
    label: 'Đơn thuốc',
    icon: 'pill',
    items: [
      { label: 'Đơn thuốc của tôi', path: '/doctor/prescriptions' },
      { label: 'Theo encounter', path: '/doctor/prescriptions?view=encounter' },
      { label: 'Đơn thuốc đang hoạt động', path: '/doctor/prescriptions?view=active' },
    ],
  },
  {
    id: 'clinical',
    label: 'Cận lâm sàng',
    icon: 'note',
    items: [
      { label: 'Xét nghiệm', path: '/doctor/clinical?view=lab' },
      { label: 'Chẩn đoán hình ảnh', path: '/doctor/clinical?view=imaging' },
      { label: 'Thủ thuật', path: '/doctor/clinical?view=procedure' },
    ],
  },
  {
    id: 'notifications',
    label: 'Thông báo',
    icon: 'bell',
    path: '/doctor/dashboard?panel=notifications',
  },
  {
    id: 'reports',
    label: 'Báo cáo',
    icon: 'pulse',
    items: [
      { label: 'Hiệu suất khám bệnh', path: '/doctor/reports?view=performance' },
      { label: 'Hàng đợi', path: '/doctor/reports?view=queue' },
      { label: 'Báo cáo bác sĩ', path: '/doctor/reports?view=doctor' },
    ],
  },
]

function getInitialExpandedDashboardGroups(location) {
  const currentPath = `${location.pathname}${location.search}`
  return new Set(
    dashboardSidebarGroups
      .filter((group) => Array.isArray(group.items) && group.items.some((item) => item.path === currentPath))
      .map((group) => group.id),
  )
}

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
    case 'message':
      return (
        <svg {...common}>
          <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H11l-4 3v-3H7.5A2.5 2.5 0 0 1 5 13.5z" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...common}>
          <path d="M12 20s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
          <circle cx="12" cy="10" r="2.2" />
        </svg>
      )
    case 'chevron_down':
      return (
        <svg {...common}>
          <path d="m7 10 5 5 5-5" />
        </svg>
      )
    case 'chevron_right':
      return (
        <svg {...common}>
          <path d="m10 7 5 5-5 5" />
        </svg>
      )
    case 'more':
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
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
    case 'arrow_left':
      return (
        <svg {...common}>
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
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

export function StatCard({ label, value, hint, tone = 'blue', icon = 'dashboard', onClick, className = '' }) {
  const Component = onClick ? 'button' : 'article'

  return (
    <Component
      className={`doctor-stat-card doctor-stat-${tone}${onClick ? ' is-actionable' : ''} ${className}`.trim()}
      {...(onClick ? { type: 'button', onClick } : {})}
    >
      <div className="doctor-stat-icon" aria-hidden="true">
        <DoctorIcon name={icon} />
      </div>
      <div className="doctor-stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
    </Component>
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
  confirmDisabled = false,
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
            disabled={busy || confirmDisabled}
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

export function SurfaceHint({ children, tone = 'neutral' }) {
  if (!children) {
    return null
  }

  return <span className={`doctor-surface-hint is-${tone}`}>{children}</span>
}

function getRoleValue(role) {
  if (!role || typeof role !== 'object') {
    return role
  }

  return role.role_code || role.roleCode || role.role_name || role.roleName || role.description || 'doctor'
}

function formatRoleLabel(role) {
  const normalized = String(getRoleValue(role) || 'doctor')
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
    displayName: user?.fullName || user?.full_name || user?.username || user?.email || 'Bác sĩ',
    primaryRole: formatRoleLabel(rawRoles[0]),
    secondaryRoles: rawRoles.slice(1).map(formatRoleLabel),
  }
}

function DoctorDashboardSidebar({ onNavigateHome, onLogout, user }) {
  const location = useLocation()
  const identity = getUserIdentity(user)
  const [expandedGroups, setExpandedGroups] = useState(
    () => new Set(dashboardSidebarGroups.filter((group) => Array.isArray(group.items) && group.items.length).map((group) => group.id)),
  )

  useEffect(() => {
    const activeGroups = getInitialExpandedDashboardGroups(location)
    if (!activeGroups.size) return

    setExpandedGroups((current) => {
      const next = new Set(current)
      activeGroups.forEach((groupId) => next.add(groupId))
      return next
    })
  }, [location.pathname, location.search])

  function toggleGroup(groupId) {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  function isExactPath(target) {
    return `${location.pathname}${location.search}` === target
  }

  function isGroupActive(group) {
    if (group.path && isExactPath(group.path)) {
      return true
    }

    return Array.isArray(group.items) && group.items.some((item) => isExactPath(item.path))
  }

  return (
    <aside className="doctor-reference-sidebar">
      <div className="doctor-reference-sidebar__brand">
        <button className="doctor-reference-sidebar__mark" type="button" onClick={onNavigateHome} aria-label="Về tổng quan bác sĩ">
          <span aria-hidden="true">☆</span>
        </button>
        <div className="doctor-reference-sidebar__brand-copy">
          <p>MediCare</p>
          <span>Doctor Dashboard</span>
        </div>
      </div>

      <nav className="doctor-reference-sidebar__nav" aria-label="Điều hướng dashboard bác sĩ">
        {dashboardSidebarGroups.map((group) =>
          group.items ? (
            <div key={group.id} className={`doctor-reference-sidebar__group${isGroupActive(group) ? ' is-active' : ''}`}>
              <button
                className="doctor-reference-sidebar__group-button"
                type="button"
                aria-expanded={expandedGroups.has(group.id)}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="doctor-reference-sidebar__icon" aria-hidden="true">
                  <DoctorIcon name={group.icon} />
                </span>
                <span className="doctor-reference-sidebar__label">{group.label}</span>
                <span className="doctor-reference-sidebar__chevron" aria-hidden="true">
                  <DoctorIcon name="chevron_down" />
                </span>
              </button>
              <div className={`doctor-reference-sidebar__submenu${expandedGroups.has(group.id) ? ' is-open' : ''}`}>
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`doctor-reference-sidebar__submenu-link${isExactPath(item.path) ? ' is-active' : ''}`}
                  >
                    <span className="doctor-reference-sidebar__dot" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <NavLink
              key={group.id}
              to={group.path}
              className={({ isActive }) => `doctor-reference-sidebar__link${isActive ? ' is-active' : ''}`}
            >
              <span className="doctor-reference-sidebar__icon" aria-hidden="true">
                <DoctorIcon name={group.icon} />
              </span>
              <span className="doctor-reference-sidebar__label">{group.label}</span>
            </NavLink>
          ),
        )}
      </nav>

      <div className="doctor-reference-sidebar__access-card">
        <strong>Quyền truy cập</strong>
        <p>{identity.primaryRole}</p>
        <span>BỆNH VIỆN ĐA KHOA MEDI</span>
        <span>KHOA KHÁM BỆNH</span>
      </div>

      <button className="doctor-reference-sidebar__logout" type="button" onClick={onLogout}>
        <span className="doctor-reference-sidebar__icon" aria-hidden="true">
          <DoctorIcon name="logout" />
        </span>
        <span>Đăng xuất</span>
      </button>
    </aside>
  )
}

function DoctorSidebar({ onNavigateHome, onLogout, user, shellVariant = 'default' }) {
  const location = useLocation()
  const identity = getUserIdentity(user)
  const permissionCount = Array.isArray(user?.permissions) ? user.permissions.length : 0
  const isDashboard = shellVariant === 'dashboard'
  const [expandedGroups, setExpandedGroups] = useState(
    () => new Set(dashboardSidebarGroups.filter((group) => Array.isArray(group.items) && group.items.length).map((group) => group.id)),
  )

  useEffect(() => {
    if (!isDashboard) {
      return
    }

    setExpandedGroups(new Set(dashboardSidebarGroups.filter((group) => Array.isArray(group.items) && group.items.length).map((group) => group.id)))
  }, [isDashboard])

  function isExactPath(target) {
    return `${location.pathname}${location.search}` === target
  }

  function isGroupActive(group) {
    if (group.path && isExactPath(group.path)) {
      return true
    }

    return Array.isArray(group.items) && group.items.some((item) => isExactPath(item.path))
  }

  function toggleGroup(groupId) {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const brandSubtitle = isDashboard ? 'Doctor Dashboard' : 'Doctor Workspace'
  const navItems = sidebarNavItems

  return (
    <aside className={`doctor-sidebar${isDashboard ? ' is-dashboard-sidebar' : ''}`}>
      <div className="doctor-sidebar-brand">
        <button className="doctor-sidebar-brandmark" type="button" onClick={onNavigateHome}>
          <span className="doctor-sidebar-brandmark-symbol" aria-hidden="true">+</span>
        </button>
        <div className="doctor-sidebar-brand-copy">
          <p>MediCare</p>
          <span>{brandSubtitle}</span>
        </div>
      </div>

      {isDashboard ? (
        <nav className="doctor-sidebar-nav doctor-sidebar-nav-grouped" aria-label="Điều hướng không gian làm việc bác sĩ">
          {dashboardSidebarGroups.map((group) =>
            group.items ? (
              <div key={group.id} className="doctor-sidebar-group">
                <button
                  className={`doctor-sidebar-group-toggle${isGroupActive(group) ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                >
                  <span className="doctor-sidebar-icon" aria-hidden="true">
                    <DoctorIcon name={group.icon} />
                  </span>
                  <span>{group.label}</span>
                  <DoctorIcon name="chevron_down" />
                </button>
                <div className={`doctor-sidebar-subnav${expandedGroups.has(group.id) ? ' is-open' : ''}`}>
                  {group.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`doctor-sidebar-subitem${isExactPath(item.path) ? ' is-active' : ''}`}
                    >
                      <span className="doctor-sidebar-subdot" aria-hidden="true">•</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <NavLink
                key={group.id}
                to={group.path}
                className={({ isActive }) => `doctor-sidebar-link doctor-sidebar-link-group${isActive ? ' is-active' : ''}`}
              >
                <span className="doctor-sidebar-icon" aria-hidden="true">
                  <DoctorIcon name={group.icon} />
                </span>
                <span>{group.label}</span>
              </NavLink>
            ),
          )}
        </nav>
      ) : (
        <nav className="doctor-sidebar-nav" aria-label="Điều hướng không gian làm việc bác sĩ">
          {navItems.map((item) => (
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
      )}

      <div className="doctor-sidebar-security-card">
        <strong>Quyền truy cập</strong>
        <p>{identity.primaryRole}</p>
        <span>{permissionCount ? `${permissionCount} quyền đang hoạt động` : 'Chưa có quyền được cấp'}</span>
      </div>

      <div className="doctor-sidebar-footer">
        <div className="doctor-sidebar-footer-links">
          {isDashboard ? (
            <button className="doctor-sidebar-utility doctor-sidebar-logout" type="button" onClick={onLogout}>
              <span className="doctor-sidebar-icon" aria-hidden="true">
                <DoctorIcon name="logout" />
              </span>
              <span>Đăng xuất</span>
            </button>
          ) : (
            <button className="doctor-sidebar-utility doctor-sidebar-collapse" type="button">
              <span className="doctor-sidebar-icon" aria-hidden="true">
                <DoctorIcon name="arrow_left" />
              </span>
              <span>Thu gọn</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

function DoctorTopbar({ title, subtitle, searchPlaceholder, user, onLogout, onNavigateHome, compact = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationActionsOpen, setNotificationActionsOpen] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchState, setSearchState] = useState({ loading: false, error: '', groups: [] })
  const [notificationState, setNotificationState] = useState({
    loading: false,
    loaded: false,
    actionLoading: false,
    error: '',
    items: [],
    unreadCount: 0,
  })
  const menuRef = useRef(null)
  const notificationRef = useRef(null)
  const workspaceRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }

      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false)
        setNotificationActionsOpen(false)
      }

      if (workspaceRef.current && !workspaceRef.current.contains(event.target)) {
        setWorkspaceOpen(false)
      }

      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const headerMeta = useMemo(() => getUserIdentity(user), [user])
  const capabilities = useMemo(() => getDoctorCapabilities(user), [user])
  const headerAvatar =
    user?.avatar_url ||
    user?.avatarUrl ||
    user?.avatar ||
    user?.profile?.avatar_url ||
    user?.profile?.avatar ||
    ''

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

  const notificationTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  )

  function formatNotificationTime(value) {
    const parsed = value ? new Date(value) : null
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return 'Gần đây'
    }
    return notificationTimeFormatter.format(parsed)
  }

  useEffect(() => {
    const keyword = searchTerm.trim()

    if (keyword.length < 2) {
      setSearchState({ loading: false, error: '', groups: [] })
      return undefined
    }

    let isActive = true
    const timer = window.setTimeout(async () => {
      setSearchOpen(true)
      setSearchState((current) => ({ ...current, loading: true, error: '' }))

      try {
        const tasks = [
          doctorApi.patients.searchPage({ search: keyword, limit: 4 }),
          doctorApi.appointments.searchPage({ search: keyword, limit: 4 }),
          doctorApi.encounters.searchPage({ search: keyword, limit: 4 }),
        ]

        if (capabilities.ordersRead) {
          tasks.push(doctorApi.orders.search({ search: keyword, limit: 4 }))
        }

        const [patientsResult, appointmentsResult, encountersResult, ordersResult] = await Promise.allSettled(tasks)

        if (!isActive) return

        const readItems = (result) => {
          if (!result || result.status !== 'fulfilled') return []
          const value = result.value
          if (Array.isArray(value?.items)) return value.items
          return Array.isArray(value) ? value : []
        }

        const groups = [
          {
            id: 'patients',
            label: 'Bệnh nhân',
            items: readItems(patientsResult).map((patient) => ({
              id: patient.patient_id || patient.patient_code || patient.full_name,
              title: patient.full_name || 'Chưa có tên',
              meta: patient.patient_code || patient.phone || patient.email || 'Hồ sơ bệnh nhân',
              to: patient.patient_id ? `/doctor/patients?patientId=${encodeURIComponent(patient.patient_id)}` : '/doctor/patients',
            })),
          },
          {
            id: 'appointments',
            label: 'Lịch hẹn',
            items: readItems(appointmentsResult).map((appointment) => ({
              id: appointment.appointment_id || appointment.patient_id || appointment.appointment_time,
              title: appointment.patient_name || appointment.patient?.full_name || 'Lịch hẹn',
              meta: [appointment.appointment_time, appointment.status].filter(Boolean).join(' · ') || 'Lịch hẹn',
              to: '/doctor/appointments',
            })),
          },
          {
            id: 'encounters',
            label: 'Encounter',
            items: readItems(encountersResult).map((encounter) => ({
              id: encounter.encounter_id || encounter.encounter_code || encounter.patient_id,
              title: encounter.patient_name || encounter.patient?.full_name || encounter.encounter_code || 'Encounter',
              meta: [encounter.encounter_code, encounter.status].filter(Boolean).join(' · ') || 'Phiên khám',
              to: encounter.encounter_id ? `/doctor/encounters?encounterId=${encodeURIComponent(encounter.encounter_id)}` : '/doctor/encounters',
            })),
          },
          {
            id: 'orders',
            label: 'Orders',
            items: readItems(ordersResult).map((order) => ({
              id: order.order_id || order.order_code || order.title,
              title: order.title || order.order_code || 'Order',
              meta: [order.patient_name, order.status].filter(Boolean).join(' · ') || 'Chỉ định',
              to: order.order_id ? `/doctor/orders?orderId=${encodeURIComponent(order.order_id)}` : '/doctor/orders',
            })),
          },
        ].filter((group) => group.items.length)

        setSearchState({ loading: false, error: '', groups })
      } catch (error) {
        if (isActive) {
          setSearchState({
            loading: false,
            error: error?.message || 'Không thể tra cứu dữ liệu lúc này.',
            groups: [],
          })
        }
      }
    }, 320)

    return () => {
      isActive = false
      window.clearTimeout(timer)
    }
  }, [capabilities.ordersRead, searchTerm])

  async function loadNotifications({ force = false } = {}) {
    if (!force && (notificationState.loaded || notificationState.loading)) {
      return
    }

    setNotificationState((current) => ({ ...current, loading: true, error: '' }))

    try {
      const payload = unwrapData(await notificationAPI.listMine({ limit: 8 })) || {}
      setNotificationState((current) => ({
        ...current,
        loading: false,
        loaded: true,
        error: '',
        items: Array.isArray(payload.items) ? payload.items : [],
        unreadCount: Number(payload.unread_count || 0),
      }))
    } catch (error) {
      setNotificationState((current) => ({
        ...current,
        loading: false,
        loaded: true,
        error: error?.message || 'Không thể tải thông báo.',
        items: [],
        unreadCount: 0,
      }))
    }
  }

  useEffect(() => {
    if (notificationOpen) {
      loadNotifications()
    }
  }, [notificationOpen])

  useEffect(() => {
    let isActive = true

    async function loadUnreadCount() {
      try {
        const payload = unwrapData(await notificationAPI.unreadCount()) || {}
        const unreadCount = Number(payload.unread_count ?? payload.count ?? payload.total ?? 0)
        if (isActive) {
          setNotificationState((current) => ({ ...current, unreadCount }))
        }
      } catch (error) {
        if (isActive) {
          setNotificationState((current) => ({ ...current, unreadCount: current.unreadCount || 0 }))
        }
      }
    }

    loadUnreadCount()

    return () => {
      isActive = false
    }
  }, [])

  async function handleMarkAllNotificationsRead() {
    setNotificationState((current) => ({ ...current, actionLoading: true, error: '' }))
    setNotificationActionsOpen(false)

    try {
      const payload = unwrapData(await notificationAPI.markAllRead({ limit: 8 })) || {}
      setNotificationState((current) => ({
        ...current,
        actionLoading: false,
        loaded: true,
        items: Array.isArray(payload.items) ? payload.items : [],
        unreadCount: Number(payload.unread_count || 0),
      }))
    } catch (error) {
      setNotificationState((current) => ({
        ...current,
        actionLoading: false,
        error: error?.message || 'Không thể đánh dấu thông báo.',
      }))
    }
  }

  async function handleClearAllNotifications() {
    setNotificationState((current) => ({ ...current, actionLoading: true, error: '' }))
    setNotificationActionsOpen(false)

    try {
      const payload = unwrapData(await notificationAPI.clearAll({ limit: 8 })) || {}
      setNotificationState((current) => ({
        ...current,
        actionLoading: false,
        loaded: true,
        items: Array.isArray(payload.items) ? payload.items : [],
        unreadCount: Number(payload.unread_count || 0),
      }))
    } catch (error) {
      setNotificationState((current) => ({
        ...current,
        actionLoading: false,
        error: error?.message || 'Không thể xoá thông báo.',
      }))
    }
  }

  const workspaceItems = useMemo(
    () =>
      [
        {
          id: 'appointments',
          title: 'Lịch hẹn',
          description: 'Mở lịch hẹn và trạng thái check-in.',
          time: todayLabel,
          tone: 'teal',
          path: '/doctor/appointments',
          visible: capabilities.appointmentsRead,
        },
        {
          id: 'queue',
          title: 'Hàng chờ',
          description: 'Theo dõi bệnh nhân đang chờ khám.',
          time: 'Workspace',
          tone: 'blue',
          path: '/doctor/queue',
          visible: capabilities.queueManage,
        },
        {
          id: 'orders',
          title: 'Orders',
          description: 'Mở danh sách chỉ định cận lâm sàng.',
          time: 'Orders',
          tone: 'amber',
          path: '/doctor/orders',
          visible: capabilities.ordersRead,
        },
      ].filter((item) => item.visible),
    [capabilities.appointmentsRead, capabilities.ordersRead, capabilities.queueManage, todayLabel],
  )

  return (
    <header className={`doctor-topbar${compact ? ' is-compact' : ''}`}>
      <div className="doctor-topbar-inner">
        {compact ? (
          <div className="doctor-topbar-copy doctor-topbar-dashboard-copy">
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        ) : (
          <div className="doctor-topbar-copy">
            {title === 'Hồ sơ bệnh nhân' ? (
              <div className="doctor-topbar-meta doctor-topbar-breadcrumb">
                <Link to="/doctor/dashboard">Trang chủ</Link>
                <span>›</span>
                <span>Bệnh nhân</span>
              </div>
            ) : (
              <div className="doctor-topbar-meta">
                <span className="doctor-topbar-eyebrow">Khu điều hành lâm sàng</span>
                <span className="doctor-context-pill">Đang trực | {todayLabel}</span>
              </div>
            )}
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        )}

        <div className="doctor-topbar-actions">
          <div className="doctor-search-shell" ref={searchRef}>
            <label className="doctor-searchbox">
              <span className="doctor-searchbox-icon" aria-hidden="true">
                <DoctorIcon name="search" />
              </span>
              <span className="doctor-searchbox-copy">
                <input
                  type="search"
                  value={searchTerm}
                  placeholder={searchPlaceholder || 'Tìm kiếm bệnh nhân, lịch hẹn, encounter...'}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onFocus={() => {
                    if (searchTerm.trim().length >= 2) {
                      setSearchOpen(true)
                    }
                  }}
                />
                <small>TRA CỨU API TRONG WORKSPACE</small>
              </span>
              <span className="doctor-searchbox-shortcut" aria-hidden="true">
                {compact ? '⌘ K' : '/'}
              </span>
            </label>

            {searchOpen && searchTerm.trim().length >= 2 ? (
              <div className="doctor-search-results" role="region" aria-label="Kết quả tra cứu API">
                {searchState.loading ? (
                  <div className="doctor-search-state">Đang tra cứu dữ liệu...</div>
                ) : searchState.error ? (
                  <div className="doctor-search-state is-error">{searchState.error}</div>
                ) : searchState.groups.length ? (
                  searchState.groups.map((group) => (
                    <section className="doctor-search-result-group" key={group.id}>
                      <strong>{group.label}</strong>
                      {group.items.map((item) => (
                        <Link
                          className="doctor-search-result-item"
                          key={`${group.id}-${item.id}`}
                          to={item.to}
                          onClick={() => setSearchOpen(false)}
                        >
                          <span>{getInitials(item.title) || 'NA'}</span>
                          <div>
                            <b>{item.title}</b>
                            <small>{item.meta}</small>
                          </div>
                        </Link>
                      ))}
                    </section>
                  ))
                ) : (
                  <div className="doctor-search-state">Không có dữ liệu phù hợp từ API.</div>
                )}
              </div>
            ) : null}
          </div>

          <div className="doctor-topbar-tools">
            <div className="doctor-notification-menu" ref={notificationRef}>
              <button
                className={`doctor-icon-button doctor-notification-trigger${notificationOpen ? ' is-active' : ''}`}
                type="button"
                aria-label="Thông báo"
                aria-expanded={notificationOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setNotificationOpen((current) => !current)
                  setNotificationActionsOpen(false)
                  setWorkspaceOpen(false)
                  setMenuOpen(false)
                }}
              >
                <DoctorIcon name="bell" />
                {notificationState.unreadCount > 0 ? (
                  <span className="doctor-notification-count" aria-hidden="true">
                    {notificationState.unreadCount > 9 ? '9+' : notificationState.unreadCount}
                  </span>
                ) : null}
              </button>

              {notificationOpen ? (
                <div className="doctor-notification-dropdown" role="menu" aria-label="Thông báo">
                  <div className="doctor-notification-head">
                    <div>
                      <strong>Thông báo</strong>
                      <small>{notificationState.unreadCount ? `${notificationState.unreadCount} thông báo chưa đọc` : 'Không có thông báo mới'}</small>
                    </div>
                    <div className="doctor-notification-actions">
                      <button
                        className="doctor-notification-more"
                        type="button"
                        aria-label="Tùy chọn thông báo"
                        aria-expanded={notificationActionsOpen}
                        onClick={() => setNotificationActionsOpen((current) => !current)}
                        disabled={notificationState.actionLoading}
                      >
                        <DoctorIcon name="more" />
                      </button>
                      {notificationActionsOpen ? (
                        <div className="doctor-notification-action-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={handleMarkAllNotificationsRead}
                            disabled={notificationState.actionLoading || !notificationState.items.length}
                          >
                            Đánh dấu tất cả là đã đọc
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={handleClearAllNotifications}
                            disabled={notificationState.actionLoading || !notificationState.items.length}
                          >
                            Xoá tất cả thông báo
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="doctor-user-dropdown-divider" />
                  <div className="doctor-notification-list">
                    {notificationState.loading ? (
                      <div className="doctor-search-state">Đang tải thông báo...</div>
                    ) : notificationState.error ? (
                      <div className="doctor-search-state is-error">{notificationState.error}</div>
                    ) : notificationState.items.length ? (
                      notificationState.items.map((item, index) => (
                        <Link
                          className={`doctor-notification-item${item.is_read ? '' : ' is-unread'}`}
                          key={`${item.notification_id || item.id}-${index}`}
                          role="menuitem"
                          to={item.path || '/doctor/dashboard'}
                          onClick={() => setNotificationOpen(false)}
                        >
                          <span className={`doctor-notification-marker doctor-notification-${item.tone}`} />
                          <span className="doctor-notification-copy">
                            <strong>{item.title}</strong>
                            <small>{item.message}</small>
                          </span>
                          <span className="doctor-notification-time">{formatNotificationTime(item.occurred_at)}</span>
                        </Link>
                      ))
                    ) : (
                      <div className="doctor-search-state">Chưa có thông báo.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="doctor-notification-menu" ref={workspaceRef}>
              <button
                className={`doctor-icon-button doctor-notification-trigger${workspaceOpen ? ' is-active' : ''}`}
                type="button"
                aria-label="Mở lối tắt workspace"
                aria-expanded={workspaceOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setWorkspaceOpen((current) => !current)
                  setNotificationOpen(false)
                  setMenuOpen(false)
                }}
              >
                <DoctorIcon name="message" />
              </button>

              {workspaceOpen ? (
                <div className="doctor-notification-dropdown" role="menu" aria-label="Lối tắt workspace bác sĩ">
                  <div className="doctor-notification-head">
                    <div>
                      <strong>Lối tắt workspace</strong>
                      <small>Các module thật theo quyền hiện tại</small>
                    </div>
                    <span>Route</span>
                  </div>
                  <div className="doctor-user-dropdown-divider" />
                  <div className="doctor-notification-list">
                    {workspaceItems.length ? (
                      workspaceItems.map((item) => (
                        <Link
                          key={item.id}
                          className="doctor-notification-item"
                          to={item.path}
                          role="menuitem"
                          onClick={() => setWorkspaceOpen(false)}
                        >
                          <span className={`doctor-notification-marker doctor-notification-${item.tone}`} />
                          <span className="doctor-notification-copy">
                            <strong>{item.title}</strong>
                            <small>{item.description}</small>
                          </span>
                          <span className="doctor-notification-time">{item.time}</span>
                        </Link>
                      ))
                    ) : (
                      <div className="doctor-search-state">Không có module phù hợp với quyền hiện tại.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="doctor-user-menu" ref={menuRef}>
              <button
                className="doctor-user-trigger"
                type="button"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
              >
                <span className="doctor-user-avatar">
                  {headerAvatar ? <img src={headerAvatar} alt="" /> : getInitials(headerMeta.displayName) || 'DR'}
                </span>
                <span className="doctor-user-copy">
                  <strong>{headerMeta.displayName}</strong>
                  <small>{headerMeta.primaryRole}</small>
                </span>
                <span className="doctor-user-chevron" aria-hidden="true">
                  <DoctorIcon name="chevron_down" />
                </span>
              </button>

              {menuOpen ? (
                <div className="doctor-user-dropdown">
                  <div className="doctor-user-dropdown-head">
                    <span className="doctor-user-avatar doctor-user-avatar-large">
                      {headerAvatar ? <img src={headerAvatar} alt="" /> : getInitials(headerMeta.displayName) || 'DR'}
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
                  <Link to="/doctor/dashboard?panel=profile" className="doctor-user-dropdown-item" onClick={() => setMenuOpen(false)}>
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
  compactTopbar = false,
  shellVariant = 'default',
  hideTopbar = false,
  children,
}) {
  const shellVariantClass = shellVariant && shellVariant !== 'default' ? ` is-${shellVariant}-variant` : ''
  const isDashboard = shellVariant === 'dashboard'
  const isEncounterShell = shellVariant === 'encounters'
  return (
    <div className={`doctor-shell${shellVariantClass}`}>
      {!isEncounterShell ? <BubbleBackground /> : null}
      {isDashboard ? (
        <DoctorDashboardSidebar onNavigateHome={onNavigateHome} onLogout={onLogout} user={user} />
      ) : (
        <DoctorSidebar onNavigateHome={onNavigateHome} onLogout={onLogout} user={user} shellVariant={shellVariant} />
      )}
      <div className="doctor-shell-main">
        {!isEncounterShell && !hideTopbar ? (
          <DoctorTopbar
            title={title}
            subtitle={subtitle}
            searchPlaceholder={searchPlaceholder}
            user={user}
            onLogout={onLogout}
            onNavigateHome={onNavigateHome}
            compact={compactTopbar}
          />
        ) : null}
        <main className="doctor-shell-content">
          <div className="doctor-shell-inner">{children}</div>
        </main>
      </div>
    </div>
  )
}

