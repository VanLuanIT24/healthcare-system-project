import PatientIcon from './PatientIcon'
import { sidebarSections } from '../data/patientPageData'

function SidebarItem({ item, activeSection, onSectionChange, variant = 'default' }) {
  const isActive = activeSection === item.key

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
    </button>
  )
}

function SidebarSection({ section, activeSection, onSectionChange }) {
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
            onSectionChange={onSectionChange}
          />
        ))}
      </div>
    </section>
  )
}

export default function PatientSidebar({ activeSection, onSectionChange, onLogout }) {
  return (
    <aside className="patient-sidebar">
      <div className="patient-sidebar__brand">
        <div className="patient-sidebar__brand-mark" aria-hidden="true">
          <PatientIcon name="monitor_heart" />
        </div>

        <div className="patient-sidebar__brand-copy">
          <p className="patient-sidebar__brand-name">HealthCare</p>
          <p className="patient-sidebar__brand-subtitle">CỔNG BỆNH NHÂN</p>
        </div>
      </div>

      <div className="patient-sidebar__overview">
        <SidebarItem
          item={{ key: 'dashboard', icon: 'dashboard', label: 'Tổng quan' }}
          activeSection={activeSection}
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
