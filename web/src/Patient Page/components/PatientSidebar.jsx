import { AppLogo, APP_BRAND_NAME } from '../../app/AppLogo'
import PatientIcon from './PatientIcon'
import { sidebarSections } from '../data/patientPageData'

function getBadgeValue(itemKey, counters = {}) {
  const safeCounters = counters || {}
  const countMap = {
    dashboard: safeCounters.overview_total,
    appointments: Number(safeCounters.appointments_upcoming || 0) + Number(safeCounters.appointments_pending || 0),
    'checkin-queue': safeCounters.queue_active,
    medications: safeCounters.prescriptions_active,
    'lab-results': safeCounters.lab_results_new,
    imaging: safeCounters.imaging_results_new,
    procedures: safeCounters.procedure_results_new,
    billing: safeCounters.unpaid_invoices,
    'billing-receipts': safeCounters.unpaid_invoices,
    insurance: Number(safeCounters.insurance_expiring || 0) + Number(safeCounters.insurance_missing_documents || 0),
    notifications: safeCounters.notifications_unread,
    support: Number(safeCounters.support_open || 0) + Number(safeCounters.unread_messages || 0),
    documents: safeCounters.documents_pending_review,
    profile: safeCounters.profile_changes_pending,
  }

  const value = countMap[itemKey]
  if (value === undefined || value === null || value === '' || Number(value) <= 0) return ''
  if (itemKey === 'checkin-queue') return 'Đang chờ'
  if (Number(value) > 99) return '99+'
  return String(value)
}

function SidebarItem({ item, activeSection, onSectionChange, counters, variant = 'default' }) {
  const isActive = activeSection === item.key
  const badge = getBadgeValue(item.key, counters)

  return (
    <button
      className={`patient-sidebar__item patient-sidebar__item--${variant}${
        isActive ? ' is-active' : ''
      }`}
      type="button"
      onClick={() => onSectionChange(item.key)}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="patient-sidebar__item-icon" aria-hidden="true">
        <PatientIcon name={item.icon} />
      </span>
      <span className="patient-sidebar__item-label">{item.label}</span>
      {badge ? <span className="patient-sidebar__item-badge">{badge}</span> : null}
    </button>
  )
}

function SidebarSection({ section, activeSection, counters, onSectionChange }) {
  return (
    <section className="patient-sidebar__section" aria-label={section.title}>
      <div className="patient-sidebar__section-head">
        <span>{section.title}</span>
        <span className="patient-sidebar__section-line" aria-hidden="true" />
      </div>

      <div className="patient-sidebar__section-list">
        {section.items.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            activeSection={activeSection}
            counters={counters}
            onSectionChange={onSectionChange}
          />
        ))}
      </div>
    </section>
  )
}

export default function PatientSidebar({ activeSection, counters, onSectionChange, onLogout }) {
  return (
    <aside className="patient-sidebar">
      <div className="patient-sidebar__brand">
        <div className="patient-sidebar__brand-mark" aria-hidden="true">
          <AppLogo variant="mark" alt="" aria-hidden="true" />
        </div>

        <div className="patient-sidebar__brand-copy">
          <p className="patient-sidebar__brand-name">{APP_BRAND_NAME}</p>
          <p className="patient-sidebar__brand-subtitle">CỔNG BỆNH NHÂN</p>
        </div>
      </div>

      <div className="patient-sidebar__overview">
        <SidebarItem
          item={{ key: 'dashboard', icon: 'dashboard', label: 'Tổng quan' }}
          activeSection={activeSection}
          counters={counters}
          onSectionChange={onSectionChange}
          variant="overview"
        />
      </div>

      <nav className="patient-sidebar__sections" aria-label="Điều hướng bệnh nhân">
        {sidebarSections.map((section) => (
          <SidebarSection
            key={section.key}
            section={section}
            activeSection={activeSection}
            counters={counters}
            onSectionChange={onSectionChange}
          />
        ))}
      </nav>

      <div className="patient-sidebar__footer">
        <button
          className="patient-danger-button patient-sidebar__emergency"
          type="button"
          onClick={() => onSectionChange('emergency')}
        >
          <PatientIcon name="emergency" aria-hidden="true" />
          <span>Cấp cứu</span>
        </button>

        <button className="patient-sidebar__logout" type="button" onClick={onLogout}>
          <span className="patient-sidebar__logout-icon" aria-hidden="true">
            <PatientIcon name="logout" />
          </span>
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  )
}
