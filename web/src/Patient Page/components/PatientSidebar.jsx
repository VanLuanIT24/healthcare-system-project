import PatientIcon from './PatientIcon'
import { navItems, utilityItems } from '../data/patientPageData'

export default function PatientSidebar({ activeSection, onSectionChange, onLogout }) {
  return (
    <aside className="patient-sidebar">
      <div className="patient-sidebar-top">
        <div className="patient-brand">
          <div className="patient-brand-mark" aria-hidden="true">
            <PatientIcon name="monitor_heart" />
          </div>
          <div>
            <p className="patient-brand-name">HealthCare</p>
            <p className="patient-brand-subtitle">Cổng bệnh nhân</p>
          </div>
        </div>
      </div>

      <nav className="patient-nav patient-nav-scroll" aria-label="Điều hướng bệnh nhân">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`patient-nav-link${activeSection === item.key ? ' is-active' : ''}`}
            type="button"
            onClick={() => onSectionChange(item.key)}
          >
            <span className="patient-nav-icon" aria-hidden="true">
              <PatientIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="patient-sidebar-footer">
        {utilityItems.map((item) => (
          <button
            key={item.key}
            className={`patient-muted-link${activeSection === item.key ? ' is-active' : ''}`}
            type="button"
            onClick={() => onSectionChange(item.key)}
          >
            <span className="patient-nav-icon" aria-hidden="true">
              <PatientIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}

        <div className="patient-sidebar-cta">
          <button
            className="patient-danger-button"
            type="button"
            onClick={() => onSectionChange('emergency')}
          >
            <PatientIcon name="emergency" aria-hidden="true" />
            <span>Cấp cứu</span>
          </button>
        </div>

        <button className="patient-muted-link" type="button" onClick={onLogout}>
          <span className="patient-nav-icon" aria-hidden="true">
            <PatientIcon name="logout" />
          </span>
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  )
}
